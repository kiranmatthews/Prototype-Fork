#!/usr/bin/env python3
"""Inventory IGA v11 archives and report IGZ level-layout metadata as JSON.

This is a dependency-free, read-only inspector.  It was implemented from
observed IGA/IGZ binary behaviour and contains no game data, decryption keys,
or code from a third-party editor.  Archive members are decoded in memory;
the input archive and IGZ files are never modified or extracted to disk.

Coordinates are emitted exactly as stored in the IGZ.  No unit or axis
conversion is applied.  Euler rotations are radians and quaternions use
``[x, y, z, w]`` order.

Examples::

    python3 tools/iga_igz_layout.py inventory game.pak --igz-only --pretty
    python3 tools/iga_igz_layout.py dump game.pak maps/level.igz -o level.json
    python3 tools/iga_igz_layout.py scan game.pak --contains custom_level
    python3 tools/iga_igz_layout.py dump-file extracted.igz --pretty

The optional type-hierarchy file is ordinary JSON.  It can either be a direct
``{"DerivedType": "BaseType"}`` mapping or contain that mapping under a
``parents`` key.  This keeps title-specific type knowledge outside the tool.
"""

from __future__ import annotations

import argparse
import json
import lzma
import mmap
import os
import struct
import sys
import zlib
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple, Union


IGA_SIGNATURE = 0x1A414749
IGA_VERSION = 11
IGZ_SIGNATURE = 0x49475A01
IGZ_LAYOUT_SCHEMA = "iga-igz-layout-v1"
ARCHIVE_INVENTORY_SCHEMA = "iga-v11-inventory-v1"
ARCHIVE_SCAN_SCHEMA = "iga-igz-scan-v1"
IGZ_LOGICAL_BLOCK_SIZE = 0x8000


class FormatError(ValueError):
    """Raised when an input is unsupported, truncated, or internally invalid."""


def _require_bounds(data: Any, offset: int, size: int, label: str) -> None:
    if offset < 0 or size < 0 or offset > len(data) or size > len(data) - offset:
        raise FormatError(
            "%s is outside the file (offset %#x, size %#x, file size %#x)"
            % (label, offset, size, len(data))
        )


def _unpack(fmt: str, data: Any, offset: int, label: str) -> Tuple[Any, ...]:
    record = struct.Struct(fmt)
    _require_bounds(data, offset, record.size, label)
    return record.unpack_from(data, offset)


def _u16(data: Any, offset: int, label: str = "uint16") -> int:
    return int(_unpack("<H", data, offset, label)[0])


def _u32(data: Any, offset: int, label: str = "uint32") -> int:
    return int(_unpack("<I", data, offset, label)[0])


def _u64(data: Any, offset: int, label: str = "uint64") -> int:
    return int(_unpack("<Q", data, offset, label)[0])


def _vector(data: Any, offset: int, count: int, label: str) -> List[float]:
    return [float(value) for value in _unpack("<%df" % count, data, offset, label)]


@dataclass(frozen=True)
class ArchiveEntry:
    """One member in an IGA archive table of contents."""

    path: str
    full_path: str
    offset: int
    ordinal: int
    size: int
    block_index: int
    file_id: int

    @property
    def compression_code(self) -> int:
        if self.block_index == -1:
            return 0
        return ((self.block_index & 0xFFFFFFFF) >> 28) & 0xF

    @property
    def compression(self) -> str:
        return {0: "stored", 1: "deflate", 2: "lzma"}.get(
            self.compression_code, "unknown-%d" % self.compression_code
        )

    def as_json(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "full_path": self.full_path,
            "file_id": self.file_id,
            "offset": self.offset,
            "size": self.size,
            "ordinal": self.ordinal,
            "block_index": self.block_index,
            "compression": self.compression,
            "compression_code": self.compression_code,
        }


class IgaArchive:
    """Read-only parser and in-memory extractor for an IGA v11 PAK."""

    HEADER = struct.Struct("<10IQ2I")
    FILE_INFO = struct.Struct("<Iiii")
    HEADER_NAMES = (
        "signature",
        "version",
        "toc_size",
        "file_count",
        "sector_size",
        "hash_divider",
        "hash_margin",
        "large_block_count",
        "medium_block_count",
        "small_block_count",
        "path_table_offset",
        "path_table_size",
        "flags",
    )

    def __init__(self, path: Union[str, os.PathLike[str]]) -> None:
        self.path = os.fspath(path)
        self._file = open(self.path, "rb")
        self._data: Optional[mmap.mmap] = None
        self.header: Dict[str, int] = {}
        self.entries: List[ArchiveEntry] = []
        self._by_exact_path: Dict[str, ArchiveEntry] = {}
        self._by_folded_path: Dict[str, List[ArchiveEntry]] = {}
        self._large_blocks: Tuple[int, ...] = ()
        self._medium_blocks: Tuple[int, ...] = ()
        self._small_blocks: Tuple[int, ...] = ()
        try:
            file_size = os.fstat(self._file.fileno()).st_size
            if file_size < self.HEADER.size:
                prefix = self._file.read(8)
                if prefix.startswith(b"Rar!\x1a\x07"):
                    raise FormatError(
                        "input is a RAR container; extract the .pak from the RAR first"
                    )
                raise FormatError("IGA header is truncated")
            self._data = mmap.mmap(self._file.fileno(), 0, access=mmap.ACCESS_READ)
            self._parse()
        except Exception:
            self.close()
            raise

    @property
    def data(self) -> mmap.mmap:
        if self._data is None:
            raise ValueError("archive is closed")
        return self._data

    def __enter__(self) -> "IgaArchive":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def close(self) -> None:
        if self._data is not None:
            self._data.close()
            self._data = None
        if not self._file.closed:
            self._file.close()

    def _parse(self) -> None:
        values = self.HEADER.unpack_from(self.data, 0)
        self.header = dict(zip(self.HEADER_NAMES, (int(value) for value in values)))
        if self.header["signature"] != IGA_SIGNATURE:
            if self.data[:8].startswith(b"Rar!\x1a\x07"):
                raise FormatError(
                    "input is a RAR container; extract the .pak from the RAR first"
                )
            raise FormatError("not an IGA archive (signature %#x)" % self.header["signature"])
        if self.header["version"] != IGA_VERSION:
            raise FormatError(
                "unsupported IGA version %d (this tool supports v%d)"
                % (self.header["version"], IGA_VERSION)
            )
        if self.header["sector_size"] <= 0:
            raise FormatError("IGA sector size must be positive")

        count = self.header["file_count"]
        if count > 10_000_000:
            raise FormatError("implausible IGA member count %d" % count)
        ids_offset = self.HEADER.size
        ids_size = count * 4
        _require_bounds(self.data, ids_offset, ids_size, "IGA file-id table")
        file_ids = (
            struct.unpack_from("<%dI" % count, self.data, ids_offset) if count else ()
        )

        info_offset = ids_offset + ids_size
        info_size = count * self.FILE_INFO.size
        _require_bounds(self.data, info_offset, info_size, "IGA member-info table")
        block_offset = info_offset + info_size

        large_count = self.header["large_block_count"]
        medium_count = self.header["medium_block_count"]
        small_count = self.header["small_block_count"]
        _require_bounds(self.data, block_offset, large_count * 4, "IGA large-block table")
        self._large_blocks = (
            struct.unpack_from("<%dI" % large_count, self.data, block_offset)
            if large_count
            else ()
        )
        block_offset += large_count * 4
        _require_bounds(self.data, block_offset, medium_count * 2, "IGA medium-block table")
        self._medium_blocks = (
            struct.unpack_from("<%dH" % medium_count, self.data, block_offset)
            if medium_count
            else ()
        )
        block_offset += medium_count * 2
        _require_bounds(self.data, block_offset, small_count, "IGA small-block table")
        self._small_blocks = (
            struct.unpack_from("<%dB" % small_count, self.data, block_offset)
            if small_count
            else ()
        )

        path_table_offset = self.header["path_table_offset"]
        path_table_size = self.header["path_table_size"]
        _require_bounds(
            self.data, path_table_offset, path_table_size, "IGA path table"
        )
        _require_bounds(
            self.data, path_table_offset, count * 4, "IGA path-offset table"
        )
        path_table_end = path_table_offset + path_table_size
        path_offsets = (
            struct.unpack_from("<%dI" % count, self.data, path_table_offset)
            if count
            else ()
        )

        for index, relative_path_offset in enumerate(path_offsets):
            string_offset = path_table_offset + int(relative_path_offset)
            full_path, string_offset = self._read_c_string(
                string_offset, path_table_end, "IGA full path"
            )
            path, _ = self._read_c_string(
                string_offset, path_table_end, "IGA member path"
            )
            raw_offset, ordinal, size, block_index = self.FILE_INFO.unpack_from(
                self.data, info_offset + index * self.FILE_INFO.size
            )
            if size < 0:
                raise FormatError("IGA member %r has a negative size" % path)
            global_offset = int(raw_offset) + (0x100000000 if (ordinal & 1) else 0)
            entry = ArchiveEntry(
                path=path,
                full_path=full_path,
                offset=global_offset,
                ordinal=int(ordinal),
                size=int(size),
                block_index=int(block_index),
                file_id=int(file_ids[index]),
            )
            if path in self._by_exact_path:
                raise FormatError("duplicate exact archive path %r" % path)
            self.entries.append(entry)
            self._by_exact_path[path] = entry
            self._by_folded_path.setdefault(path.casefold(), []).append(entry)

    def _read_c_string(self, offset: int, end: int, label: str) -> Tuple[str, int]:
        if offset < 0 or offset >= end:
            raise FormatError("%s starts outside the IGA path table" % label)
        terminator = self.data.find(b"\0", offset, end)
        if terminator < 0:
            raise FormatError("unterminated %s" % label)
        try:
            value = self.data[offset:terminator].decode("utf-8")
        except UnicodeDecodeError:
            value = self.data[offset:terminator].decode("utf-8", "replace")
        return value, terminator + 1

    def get(self, member: str) -> ArchiveEntry:
        exact = self._by_exact_path.get(member)
        if exact is not None:
            return exact
        matches = self._by_folded_path.get(member.casefold(), [])
        if len(matches) == 1:
            return matches[0]
        if len(matches) > 1:
            candidates = ", ".join(repr(entry.path) for entry in matches)
            raise KeyError(
                "ambiguous case-insensitive archive member %r; use exact spelling: %s"
                % (member, candidates)
            )
        try:
            return self._by_folded_path[member.casefold()][0]
        except KeyError as exc:
            raise KeyError("archive member not found: %s" % member) from exc

    @staticmethod
    def _lzma_filter(properties: bytes) -> Dict[str, int]:
        if len(properties) != 5:
            raise FormatError("invalid five-byte LZMA property record")
        packed = properties[0]
        if packed >= 9 * 5 * 5:
            raise FormatError("invalid LZMA property byte %#x" % packed)
        lc = packed % 9
        packed //= 9
        lp = packed % 5
        pb = packed // 5
        dictionary_size = struct.unpack_from("<I", properties, 1)[0]
        if dictionary_size == 0:
            raise FormatError("invalid zero LZMA dictionary size")
        return {
            "id": lzma.FILTER_LZMA1,
            "dict_size": int(dictionary_size),
            "lc": int(lc),
            "lp": int(lp),
            "pb": int(pb),
        }

    def extract_bytes(self, member: Union[str, ArchiveEntry]) -> bytes:
        """Return a member in memory without writing it to disk."""

        entry = member if isinstance(member, ArchiveEntry) else self.get(member)
        if entry.compression_code == 0:
            _require_bounds(self.data, entry.offset, entry.size, "stored archive member")
            return bytes(self.data[entry.offset : entry.offset + entry.size])
        if entry.compression_code not in (1, 2):
            raise FormatError(
                "unsupported compression code %d for %s"
                % (entry.compression_code, entry.path)
            )

        block_count = (entry.size + IGZ_LOGICAL_BLOCK_SIZE - 1) // IGZ_LOGICAL_BLOCK_SIZE
        sector_size = self.header["sector_size"]
        if entry.size <= 0x7F * sector_size:
            table: Sequence[int] = self._small_blocks
            offset_mask, shift = 0x7F, 7
        elif entry.size <= 0x7FFF * sector_size:
            table = self._medium_blocks
            offset_mask, shift = 0x7FFF, 15
        else:
            table = self._large_blocks
            offset_mask, shift = 0x7FFFFFFF, 31

        table_start = entry.block_index & 0x0FFFFFFF
        if table_start > len(table) or block_count > len(table) - table_start:
            raise FormatError("block table range for %s is invalid" % entry.path)

        output = bytearray()
        for block_number in range(block_count):
            block_record = int(table[table_start + block_number])
            source = entry.offset + (block_record & offset_mask) * sector_size
            is_compressed = ((block_record >> shift) & 1) == 1
            expected_size = min(
                IGZ_LOGICAL_BLOCK_SIZE,
                entry.size - block_number * IGZ_LOGICAL_BLOCK_SIZE,
            )
            if not is_compressed:
                _require_bounds(
                    self.data, source, expected_size, "uncompressed member block"
                )
                decoded = bytes(self.data[source : source + expected_size])
            elif entry.compression_code == 1:
                packed_size = _u16(self.data, source, "deflate block size")
                payload_offset = source + 2
                _require_bounds(
                    self.data, payload_offset, packed_size, "deflate block payload"
                )
                try:
                    decoded = zlib.decompress(
                        self.data[payload_offset : payload_offset + packed_size], -15
                    )
                except zlib.error as exc:
                    raise FormatError(
                        "deflate block %d for %s did not decode: %s"
                        % (block_number, entry.path, exc)
                    ) from exc
            else:
                packed_size = _u16(self.data, source, "LZMA block size")
                properties_offset = source + 2
                _require_bounds(self.data, properties_offset, 5, "LZMA properties")
                properties = bytes(self.data[properties_offset : properties_offset + 5])
                payload_offset = properties_offset + 5
                _require_bounds(
                    self.data, payload_offset, packed_size, "LZMA block payload"
                )
                try:
                    decoder = lzma.LZMADecompressor(
                        format=lzma.FORMAT_RAW,
                        filters=[self._lzma_filter(properties)],
                    )
                    decoded = decoder.decompress(
                        self.data[payload_offset : payload_offset + packed_size],
                        max_length=expected_size,
                    )
                except lzma.LZMAError as exc:
                    raise FormatError(
                        "LZMA block %d for %s did not decode: %s"
                        % (block_number, entry.path, exc)
                    ) from exc
            if len(decoded) != expected_size:
                raise FormatError(
                    "block %d for %s decoded to %d bytes; expected %d"
                    % (block_number, entry.path, len(decoded), expected_size)
                )
            output.extend(decoded)

        if len(output) != entry.size:
            raise FormatError(
                "decoded %s to %d bytes; expected %d"
                % (entry.path, len(output), entry.size)
            )
        return bytes(output)

    def inventory(
        self, prefix: str = "", igz_only: bool = False
    ) -> Dict[str, Any]:
        prefix_folded = prefix.casefold()
        entries = [
            entry
            for entry in self.entries
            if entry.path.casefold().startswith(prefix_folded)
            and (not igz_only or entry.path.casefold().endswith(".igz"))
        ]
        return {
            "schema": ARCHIVE_INVENTORY_SCHEMA,
            "archive": self.path,
            "header": dict(self.header),
            "entry_count": len(self.entries),
            "selected_entry_count": len(entries),
            "filters": {"prefix": prefix, "igz_only": igz_only},
            "entries": [entry.as_json() for entry in entries],
        }


class IgzLayout:
    """Parse the object/fixup subset needed for level-layout recovery."""

    STRING_FIXUPS = frozenset(("TSTR", "TMET"))
    INTEGER_FIXUPS = frozenset(("MTSZ", "ONAM", "NSPC"))
    REFERENCE_FIXUPS = frozenset(
        ("RVTB", "RSTT", "ROFS", "RPID", "RHND", "RNEX", "REXT", "ROOT")
    )

    def __init__(
        self,
        data: bytes,
        type_parents: Optional[Mapping[str, str]] = None,
    ) -> None:
        self.data = data
        self.type_parents = dict(type_parents or {})
        self.header: Dict[str, int] = {}
        self.chunks: List[Dict[str, int]] = []
        self.fixups: Dict[str, Any] = {}
        self.fixup_counts: Dict[str, int] = {}
        self.objects_start = 0
        self.objects: List[Dict[str, Any]] = []
        self.object_by_offset: Dict[int, Dict[str, Any]] = {}
        self.object_by_name: Dict[str, Dict[str, Any]] = {}
        self._next_object_offset: Dict[int, int] = {}
        self.rofs: set[int] = set()
        self.rstt: set[int] = set()
        self._parse()

    def _parse(self) -> None:
        signature, version, field_hash, platform, declared_fixups = _unpack(
            "<5I", self.data, 0, "IGZ header"
        )
        if signature != IGZ_SIGNATURE:
            raise FormatError("not an IGZ file (signature %#x)" % signature)
        self.header = {
            "signature": int(signature),
            "version": int(version),
            "field_hash": int(field_hash),
            "platform": int(platform),
            "declared_fixups": int(declared_fixups),
        }
        self._parse_chunks()
        if len(self.chunks) < 2:
            raise FormatError("IGZ does not contain a fixup and object chunk")
        self.objects_start = self.chunks[1]["offset"]
        fixup_chunk = self.chunks[0]
        self._parse_fixups(
            fixup_chunk["offset"], fixup_chunk["offset"] + fixup_chunk["size"]
        )
        self.rofs = {
            self.global_offset(value) for value in self.fixups.get("ROFS", [])
        }
        self.rstt = {
            self.global_offset(value) for value in self.fixups.get("RSTT", [])
        }
        self._parse_objects()
        self._attach_names()
        self.object_by_name = {
            item["name"]: item for item in self.objects if item.get("name")
        }

    def _parse_chunks(self) -> None:
        offset = 20
        for index in range(4096):
            identifier, chunk_offset, size, alignment = _unpack(
                "<4i", self.data, offset, "IGZ chunk descriptor %d" % index
            )
            offset += 16
            if chunk_offset == 0:
                return
            if chunk_offset < 0 or size < 0:
                raise FormatError("IGZ chunk %d has a negative offset or size" % index)
            _require_bounds(self.data, chunk_offset, size, "IGZ chunk %d" % index)
            self.chunks.append(
                {
                    "identifier": int(identifier),
                    "offset": int(chunk_offset),
                    "size": int(size),
                    "alignment": int(alignment),
                }
            )
        raise FormatError("IGZ chunk table has no terminator")

    def _read_c_string(self, offset: int, end: int, label: str) -> Tuple[str, int]:
        if offset < 0 or offset >= end:
            raise FormatError("%s starts outside its fixup" % label)
        terminator = self.data.find(b"\0", offset, end)
        if terminator < 0:
            raise FormatError("unterminated %s" % label)
        return self.data[offset:terminator].decode("utf-8", "replace"), terminator + 1

    @staticmethod
    def _decode_references(
        data: bytes, offset: int, end: int, count: int, name: str
    ) -> List[int]:
        values: List[int] = []
        previous = 0
        current = 0
        shift = 0
        while len(values) < count:
            if offset >= end:
                raise FormatError("%s fixup ended before %d references" % (name, count))
            byte = data[offset]
            offset += 1
            for nibble in (byte & 0xF, byte >> 4):
                current |= (nibble & 7) << shift
                if nibble & 8:
                    shift += 3
                    if shift > 33:
                        raise FormatError("%s fixup contains an oversized delta" % name)
                    continue
                previous += current * 4
                values.append(previous)
                current = 0
                shift = 0
                if len(values) == count:
                    break
        return values

    def _parse_fixups(self, offset: int, end: int) -> None:
        while offset + 16 <= end:
            raw_name = self.data[offset : offset + 4]
            if raw_name == b"\0\0\0\0":
                return
            try:
                name = raw_name.decode("ascii")
            except UnicodeDecodeError as exc:
                raise FormatError("non-ASCII IGZ fixup name at %#x" % offset) from exc
            count, size, header_size = _unpack(
                "<3i", self.data, offset + 4, "%s fixup header" % name
            )
            if count < 0 or size < 16 or header_size < 16 or header_size > size:
                raise FormatError("invalid %s fixup sizes/count" % name)
            record_end = offset + size
            if record_end > end:
                raise FormatError("%s fixup extends beyond the fixup chunk" % name)
            payload = offset + header_size
            if name in self.fixups:
                raise FormatError("duplicate %s fixup" % name)

            if name in self.STRING_FIXUPS:
                values: Any = []
                cursor = payload
                for index in range(count):
                    value, cursor = self._read_c_string(
                        cursor, record_end, "%s string %d" % (name, index)
                    )
                    values.append(value)
                    # Observed files may pad individual strings with a second NUL.
                    if cursor < record_end and self.data[cursor] == 0:
                        cursor += 1
            elif name == "TDEP":
                values = []
                cursor = payload
                for index in range(count):
                    dependency_name, cursor = self._read_c_string(
                        cursor, record_end, "TDEP name %d" % index
                    )
                    dependency_path, cursor = self._read_c_string(
                        cursor, record_end, "TDEP path %d" % index
                    )
                    values.append({"name": dependency_name, "path": dependency_path})
            elif name in self.INTEGER_FIXUPS:
                _require_bounds(
                    self.data, payload, count * 4, "%s integer payload" % name
                )
                if payload + count * 4 > record_end:
                    raise FormatError("%s integer payload exceeds its fixup" % name)
                values = (
                    list(struct.unpack_from("<%di" % count, self.data, payload))
                    if count
                    else []
                )
            elif name in ("EXNM", "EXID"):
                if payload + count * 8 > record_end:
                    raise FormatError("%s pair payload exceeds its fixup" % name)
                values = [
                    tuple(int(item) for item in struct.unpack_from("<II", self.data, payload + index * 8))
                    for index in range(count)
                ]
            elif name in self.REFERENCE_FIXUPS:
                values = self._decode_references(
                    self.data, payload, record_end, count, name
                )
            else:
                values = {"payload_size": record_end - payload}

            self.fixups[name] = values
            self.fixup_counts[name] = int(count)
            offset = record_end

    def global_offset(self, encoded_offset: int) -> int:
        encoded_offset &= 0xFFFFFFFF
        if encoded_offset <= 0x07FFFFFF:
            result = self.objects_start + encoded_offset
        else:
            chunk_index = (encoded_offset >> 27) + 1
            if chunk_index >= len(self.chunks):
                raise FormatError(
                    "encoded IGZ offset %#x refers to missing chunk %d"
                    % (encoded_offset, chunk_index)
                )
            result = self.chunks[chunk_index]["offset"] + (
                encoded_offset & 0x07FFFFFF
            )
        if result < 0 or result > len(self.data):
            raise FormatError("encoded IGZ offset %#x is outside the file" % encoded_offset)
        return result

    def _parse_objects(self) -> None:
        types = self.fixups.get("TMET", [])
        sizes = self.fixups.get("MTSZ", [])
        if not isinstance(types, list) or not isinstance(sizes, list):
            raise FormatError("IGZ TMET/MTSZ fixups are unavailable")
        seen_offsets = set()
        for encoded_offset in self.fixups.get("RVTB", []):
            object_offset = self.global_offset(encoded_offset)
            type_index = _u32(self.data, object_offset, "IGZ object type index")
            if type_index >= len(types):
                raise FormatError(
                    "object at %#x has TMET index %d, but only %d types exist"
                    % (object_offset, type_index, len(types))
                )
            if object_offset in seen_offsets:
                raise FormatError("duplicate IGZ object offset %#x" % object_offset)
            seen_offsets.add(object_offset)
            declared_size = int(sizes[type_index]) if type_index < len(sizes) else None
            if declared_size is not None and declared_size < 4:
                raise FormatError("invalid size %d for IGZ type %s" % (declared_size, types[type_index]))
            if declared_size is not None:
                _require_bounds(
                    self.data, object_offset, declared_size, "IGZ %s object" % types[type_index]
                )
            item = {
                "object_offset": object_offset,
                "encoded_offset": int(encoded_offset),
                "type_index": int(type_index),
                "type": types[type_index],
                "size": declared_size,
                "name": None,
            }
            self.objects.append(item)
            self.object_by_offset[object_offset] = item

        ordered = sorted(self.objects, key=lambda item: item["object_offset"])
        object_chunk_end = self.chunks[1]["offset"] + self.chunks[1]["size"]
        for index, item in enumerate(ordered):
            self._next_object_offset[item["object_offset"]] = (
                ordered[index + 1]["object_offset"]
                if index + 1 < len(ordered)
                else object_chunk_end
            )

    def _memory_reference(self, offset: int, element_size: int) -> List[int]:
        byte_size, _flags = _unpack("<ii", self.data, offset, "IGZ memory reference")
        address = _u64(self.data, offset + 8, "IGZ memory-reference address") & 0xFFFFFFFF
        if byte_size <= 0 or address == 0:
            return []
        if byte_size % element_size:
            raise FormatError(
                "memory reference at %#x has size %d, not divisible by %d"
                % (offset, byte_size, element_size)
            )
        if byte_size // element_size > 10_000_000:
            raise FormatError("implausibly large IGZ memory reference at %#x" % offset)
        start = self.global_offset(address)
        _require_bounds(self.data, start, byte_size, "IGZ memory-reference contents")
        return list(range(start, start + byte_size, element_size))

    def object_reference(self, field_offset: int) -> Optional[int]:
        if field_offset not in self.rofs:
            return None
        encoded = _u64(self.data, field_offset, "IGZ object reference") & 0xFFFFFFFF
        return self.global_offset(encoded) if encoded else None

    def string_reference(self, field_offset: int) -> Optional[str]:
        if field_offset not in self.rstt:
            return None
        index = _u32(self.data, field_offset, "IGZ string reference")
        strings = self.fixups.get("TSTR", [])
        return strings[index] if isinstance(strings, list) and index < len(strings) else None

    def _attach_names(self) -> None:
        roots = self.fixups.get("ROOT", [])
        onams = self.fixups.get("ONAM", [])
        if not roots or not onams:
            return
        root_offset = self.global_offset(int(roots[0]))
        onam_offset = self.global_offset(int(onams[0]))
        object_slots = self._memory_reference(root_offset + 24, 8)
        name_slots = self._memory_reference(onam_offset + 24, 16)
        for object_slot, name_slot in zip(object_slots, name_slots):
            object_offset = self.object_reference(object_slot)
            name = self.string_reference(name_slot)
            if object_offset in self.object_by_offset and name is not None:
                self.object_by_offset[object_offset]["name"] = name

    def is_a(self, type_name: str, target: str) -> bool:
        """Resolve a type through optional caller-supplied parent metadata."""

        seen = set()
        current: Optional[str] = type_name
        while current and current not in seen:
            if current == target:
                return True
            seen.add(current)
            current = self.type_parents.get(current)

        # Conservative fallbacks cover common direct names without embedding a
        # title-specific class graph.  A JSON hierarchy handles other subclasses.
        if target == "igEntity":
            return type_name.endswith("Entity") and not type_name.endswith("EntityData")
        if target == "igSpline2":
            return type_name == "igSpline2"
        if target == "igSplineControlPoint2":
            return type_name == "igSplineControlPoint2"
        if target == "CSplineComponentData":
            return type_name.endswith("SplineComponentData")
        return False

    def _object_extent(self, item: Mapping[str, Any]) -> int:
        size = item.get("size")
        if item["type"] == "CVscComponentData" and item["object_offset"] + 24 in self.rofs:
            return self._next_object_offset[item["object_offset"]]
        if isinstance(size, int):
            return item["object_offset"] + size
        return self._next_object_offset[item["object_offset"]]

    def strings_in_object(self, item: Optional[Mapping[str, Any]]) -> List[str]:
        if item is None:
            return []
        start = int(item["object_offset"])
        end = self._object_extent(item)
        values: List[str] = []
        for field_offset in sorted(value for value in self.rstt if start <= value < end):
            value = self.string_reference(field_offset)
            if value and value not in values:
                values.append(value)
        return values

    def spline_record(self, spline: Optional[Mapping[str, Any]]) -> Optional[Dict[str, Any]]:
        if spline is None or not self.is_a(str(spline["type"]), "igSpline2"):
            return None
        spline_offset = int(spline["object_offset"])
        list_offset = self.object_reference(spline_offset + 16)
        point_list = self.object_by_offset.get(list_offset) if list_offset is not None else None
        points: List[Dict[str, Any]] = []
        if point_list is not None:
            for slot in self._memory_reference(int(point_list["object_offset"]) + 24, 8):
                point_offset = self.object_reference(slot)
                point = self.object_by_offset.get(point_offset) if point_offset is not None else None
                if point is None or not self.is_a(
                    str(point["type"]), "igSplineControlPoint2"
                ):
                    continue
                offset = int(point["object_offset"])
                _require_bounds(self.data, offset, 53, "IGZ spline control point")
                points.append(
                    {
                        "name": point.get("name"),
                        "type": point["type"],
                        "object_offset": offset,
                        "position": _vector(self.data, offset + 16, 3, "spline point position"),
                        "tangent_in": _vector(self.data, offset + 28, 3, "spline point incoming tangent"),
                        "tangent_out": _vector(self.data, offset + 40, 3, "spline point outgoing tangent"),
                        "smooth": bool(self.data[offset + 52]),
                    }
                )
        _require_bounds(self.data, spline_offset + 104, 5, "IGZ spline fields")
        return {
            "name": spline.get("name"),
            "type": spline["type"],
            "object_offset": spline_offset,
            "length": float(
                _unpack("<f", self.data, spline_offset + 104, "spline length")[0]
            ),
            "looping": bool(self.data[spline_offset + 108]),
            "points": points,
        }

    def splines(self) -> List[Dict[str, Any]]:
        return [
            record
            for record in (
                self.spline_record(item)
                for item in self.objects
                if self.is_a(str(item["type"]), "igSpline2")
            )
            if record is not None
        ]

    def _spline_for_component(
        self, component: Mapping[str, Any]
    ) -> Optional[Dict[str, Any]]:
        if not self.is_a(str(component["type"]), "CSplineComponentData"):
            return None
        spline_offset = self.object_reference(int(component["object_offset"]) + 24)
        return self.spline_record(
            self.object_by_offset.get(spline_offset) if spline_offset is not None else None
        )

    def components_for_entity(self, entity: Mapping[str, Any]) -> List[Dict[str, Any]]:
        entity_offset = int(entity["object_offset"])
        data_offset = self.object_reference(entity_offset + 64)
        entity_data = self.object_by_offset.get(data_offset) if data_offset is not None else None
        if entity_data is None:
            return []
        table_offset = self.object_reference(int(entity_data["object_offset"]) + 16)
        table = self.object_by_offset.get(table_offset) if table_offset is not None else None
        if table is None:
            return []
        value_slots = self._memory_reference(int(table["object_offset"]) + 16, 8)
        key_slots = self._memory_reference(int(table["object_offset"]) + 32, 8)
        components: List[Dict[str, Any]] = []
        for key_slot, value_slot in zip(key_slots, value_slots):
            key = self.string_reference(key_slot)
            component_offset = self.object_reference(value_slot)
            component = (
                self.object_by_offset.get(component_offset)
                if component_offset is not None
                else None
            )
            if key is None or component is None:
                continue
            result: Dict[str, Any] = {
                "key": key,
                "name": component.get("name"),
                "type": component["type"],
                "object_offset": component["object_offset"],
                "strings": self.strings_in_object(component),
            }
            spline = self._spline_for_component(component)
            if spline is not None:
                result["spline"] = spline
            components.append(result)
        return components

    def entity_records(self) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []
        for item in self.objects:
            if not item.get("name") or not self.is_a(str(item["type"]), "igEntity"):
                continue
            offset = int(item["object_offset"])
            _require_bounds(self.data, offset + 32, 12, "IGZ entity position")
            transform_offset = self.object_reference(offset + 48)
            transform = (
                self.object_by_offset.get(transform_offset)
                if transform_offset is not None
                else None
            )
            rotation = [0.0, 0.0, 0.0]
            orientation = [0.0, 0.0, 0.0, 1.0]
            scale = [1.0, 1.0, 1.0]
            if transform is not None:
                transform_start = int(transform["object_offset"])
                orientation = _vector(
                    self.data, transform_start + 16, 4, "entity orientation"
                )
                rotation = _vector(
                    self.data, transform_start + 96, 3, "entity Euler rotation"
                )
                scale = _vector(self.data, transform_start + 112, 3, "entity scale")

            data_offset = self.object_reference(offset + 64)
            entity_data = self.object_by_offset.get(data_offset) if data_offset is not None else None
            data_record = None
            if entity_data is not None:
                data_record = {
                    "name": entity_data.get("name"),
                    "type": entity_data["type"],
                    "object_offset": entity_data["object_offset"],
                    "strings": self.strings_in_object(entity_data),
                }
            records.append(
                {
                    "name": item["name"],
                    "type": item["type"],
                    "object_offset": offset,
                    "transform_object_offset": transform_offset,
                    "position": _vector(
                        self.data, offset + 32, 3, "entity position"
                    ),
                    "rotation_radians": rotation,
                    "orientation_xyzw": orientation,
                    "scale": scale,
                    "entity_data": data_record,
                    "components": self.components_for_entity(item),
                }
            )
        return records

    @staticmethod
    def crate_records(
        entities: Iterable[Mapping[str, Any]], crate_prefix: str = "crate_"
    ) -> List[Dict[str, Any]]:
        folded_prefix = crate_prefix.casefold()
        crates: List[Dict[str, Any]] = []
        for entity in entities:
            name = str(entity.get("name") or "")
            if not name.casefold().startswith(folded_prefix):
                continue
            result = dict(entity)
            result["authored"] = any(
                abs(float(value)) > 1e-5 for value in entity["position"]
            )
            result["classification"] = {
                "method": "case-insensitive-name-prefix",
                "prefix": crate_prefix,
            }
            crates.append(result)
        return crates

    def summary(self) -> Dict[str, Any]:
        types = self.fixups.get("TMET", [])
        sizes = self.fixups.get("MTSZ", [])
        type_records = []
        if isinstance(types, list):
            for index, name in enumerate(types):
                type_records.append(
                    {
                        "name": name,
                        "size": sizes[index]
                        if isinstance(sizes, list) and index < len(sizes)
                        else None,
                    }
                )
        return {
            "header": dict(self.header),
            "chunks": list(self.chunks),
            "fixup_counts": dict(self.fixup_counts),
            "types": type_records,
            "object_count": len(self.objects),
        }

    def layout_dump(
        self, source: Mapping[str, Any], crate_prefix: str = "crate_"
    ) -> Dict[str, Any]:
        entities = self.entity_records()
        splines = self.splines()
        crates = self.crate_records(entities, crate_prefix)
        summary = self.summary()
        summary.update(
            {
                "named_entity_count": len(entities),
                "spline_count": len(splines),
                "crate_count": len(crates),
                "authored_crate_count": sum(1 for item in crates if item["authored"]),
            }
        )
        return {
            "schema": IGZ_LAYOUT_SCHEMA,
            "source": dict(source),
            "coordinate_convention": {
                "values": "raw IGZ values; no unit or axis conversion",
                "rotation_radians": "Euler radians as stored",
                "orientation_xyzw": "quaternion component order x, y, z, w",
            },
            "summary": summary,
            "entities": entities,
            "splines": splines,
            "crates": crates,
        }


def load_type_hierarchy(path: Optional[str]) -> Dict[str, str]:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as handle:
        value = json.load(handle)
    if isinstance(value, dict) and "parents" in value:
        value = value["parents"]
    if not isinstance(value, dict):
        raise FormatError("type hierarchy JSON must be an object")
    parents: Dict[str, str] = {}
    for child, parent in value.items():
        if not isinstance(child, str) or not isinstance(parent, str):
            raise FormatError("type hierarchy keys and values must be strings")
        parents[child] = parent
    return parents


def _selected_entries(
    archive: IgaArchive, prefix: str, contains: str
) -> List[ArchiveEntry]:
    prefix_folded = prefix.casefold()
    contains_folded = contains.casefold()
    return [
        entry
        for entry in archive.entries
        if entry.path.casefold().endswith(".igz")
        and entry.path.casefold().startswith(prefix_folded)
        and contains_folded in entry.path.casefold()
    ]


def scan_archive(
    archive: IgaArchive,
    prefix: str = "",
    contains: str = "",
    type_parents: Optional[Mapping[str, str]] = None,
    crate_prefix: str = "crate_",
    strict: bool = False,
) -> Dict[str, Any]:
    selected = _selected_entries(archive, prefix, contains)
    layouts: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    for entry in selected:
        try:
            payload = archive.extract_bytes(entry)
            layout = IgzLayout(payload, type_parents).layout_dump(
                {
                    "kind": "archive-member",
                    "archive": archive.path,
                    "member": entry.path,
                    "member_size": entry.size,
                },
                crate_prefix,
            )
            layouts.append(layout)
        except (FormatError, KeyError, lzma.LZMAError, zlib.error) as exc:
            if strict:
                raise
            errors.append({"member": entry.path, "error": str(exc)})
    return {
        "schema": ARCHIVE_SCAN_SCHEMA,
        "archive": archive.path,
        "filters": {"prefix": prefix, "contains": contains},
        "selected_member_count": len(selected),
        "layout_count": len(layouts),
        "error_count": len(errors),
        "layouts": layouts,
        "errors": errors,
    }


def _add_json_output_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("-o", "--output", default="-", help="JSON path (default: stdout)")
    parser.add_argument("--pretty", action="store_true", help="indent JSON for people")


def _add_layout_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--type-hierarchy",
        help="optional JSON child-to-parent type map for title-specific subclasses",
    )
    parser.add_argument(
        "--crate-prefix",
        default="crate_",
        help="case-insensitive entity-name prefix used for crate placements (default: crate_)",
    )
    _add_json_output_options(parser)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    inventory = subparsers.add_parser(
        "inventory", help="list archive members and compression metadata as JSON"
    )
    inventory.add_argument("archive", help="RAR-extracted IGA v11 .pak")
    inventory.add_argument("--prefix", default="", help="case-insensitive path prefix")
    inventory.add_argument("--igz-only", action="store_true", help="include only .igz members")
    _add_json_output_options(inventory)

    dump = subparsers.add_parser(
        "dump", help="dump layout metadata for one IGZ member in an archive"
    )
    dump.add_argument("archive", help="RAR-extracted IGA v11 .pak")
    dump.add_argument("member", help="archive path of the IGZ member")
    _add_layout_options(dump)

    scan = subparsers.add_parser(
        "scan", help="dump layout metadata for matching IGZ members in an archive"
    )
    scan.add_argument("archive", help="RAR-extracted IGA v11 .pak")
    scan.add_argument("--prefix", default="", help="case-insensitive member path prefix")
    scan.add_argument(
        "--contains", default="", help="case-insensitive text required in member paths"
    )
    scan.add_argument(
        "--strict", action="store_true", help="stop on the first malformed matching IGZ"
    )
    _add_layout_options(scan)

    dump_file = subparsers.add_parser(
        "dump-file", help="dump layout metadata from a standalone IGZ file"
    )
    dump_file.add_argument("igz", help="standalone IGZ file")
    _add_layout_options(dump_file)
    return parser


def _write_json(
    value: Mapping[str, Any],
    output: str,
    pretty: bool,
    protected_inputs: Sequence[str],
) -> None:
    kwargs = {
        "indent": 2 if pretty else None,
        "sort_keys": False,
        "ensure_ascii": False,
        "allow_nan": False,
    }
    if output == "-":
        json.dump(value, sys.stdout, **kwargs)
        sys.stdout.write("\n")
        return
    output_path = Path(output).expanduser().resolve()
    protected = {Path(path).expanduser().resolve() for path in protected_inputs}
    if output_path in protected:
        raise FormatError("refusing to overwrite an input file: %s" % output_path)
    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump(value, handle, **kwargs)
        handle.write("\n")


def run_command(args: argparse.Namespace) -> None:
    if args.command == "inventory":
        with IgaArchive(args.archive) as archive:
            result = archive.inventory(args.prefix, args.igz_only)
        _write_json(result, args.output, args.pretty, [args.archive])
        return

    type_parents = load_type_hierarchy(args.type_hierarchy)
    if args.command == "dump":
        with IgaArchive(args.archive) as archive:
            entry = archive.get(args.member)
            payload = archive.extract_bytes(entry)
            result = IgzLayout(payload, type_parents).layout_dump(
                {
                    "kind": "archive-member",
                    "archive": args.archive,
                    "member": entry.path,
                    "member_size": entry.size,
                },
                args.crate_prefix,
            )
        protected = [args.archive]
        if args.type_hierarchy:
            protected.append(args.type_hierarchy)
        _write_json(result, args.output, args.pretty, protected)
        return

    if args.command == "scan":
        with IgaArchive(args.archive) as archive:
            result = scan_archive(
                archive,
                prefix=args.prefix,
                contains=args.contains,
                type_parents=type_parents,
                crate_prefix=args.crate_prefix,
                strict=args.strict,
            )
        protected = [args.archive]
        if args.type_hierarchy:
            protected.append(args.type_hierarchy)
        _write_json(result, args.output, args.pretty, protected)
        return

    with open(args.igz, "rb") as handle:
        payload = handle.read()
    result = IgzLayout(payload, type_parents).layout_dump(
        {"kind": "standalone-igz", "path": args.igz, "size": len(payload)},
        args.crate_prefix,
    )
    protected = [args.igz]
    if args.type_hierarchy:
        protected.append(args.type_hierarchy)
    _write_json(result, args.output, args.pretty, protected)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)
    try:
        run_command(args)
    except (FormatError, KeyError, OSError, json.JSONDecodeError) as exc:
        parser.exit(2, "error: %s\n" % exc)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
