#!/usr/bin/env python3
"""Synthetic self-test for tools/iga_igz_layout.py.

The fixture is generated in memory and describes one named crate entity and a
two-point spline.  It is deliberately invented data, not an extracted game
asset.
"""

from __future__ import annotations

import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from iga_igz_layout import IGA_SIGNATURE, IGZ_SIGNATURE, IgaArchive, IgzLayout, main


def _align(value: int, alignment: int = 4) -> int:
    return (value + alignment - 1) & ~(alignment - 1)


def _encode_reference_deltas(values: list[int]) -> bytes:
    """Encode the nibble/base-8 delta representation used by IGZ R fixups."""

    nibbles: list[int] = []
    previous = 0
    for value in values:
        if value < previous or value % 4:
            raise ValueError("reference fixture offsets must be sorted multiples of four")
        delta = (value - previous) // 4
        previous = value
        while True:
            digit = delta & 7
            delta >>= 3
            nibbles.append(digit | (8 if delta else 0))
            if not delta:
                break
    result = bytearray()
    for index in range(0, len(nibbles), 2):
        low = nibbles[index]
        high = nibbles[index + 1] if index + 1 < len(nibbles) else 0
        result.append(low | (high << 4))
    return bytes(result)


def _fixup(name: str, count: int, payload: bytes) -> bytes:
    size = _align(16 + len(payload))
    result = bytearray(size)
    struct.pack_into("<4siii", result, 0, name.encode("ascii"), count, size, 16)
    result[16 : 16 + len(payload)] = payload
    return bytes(result)


def _string_fixup(name: str, values: list[str]) -> bytes:
    payload = b"".join(value.encode("utf-8") + b"\0" for value in values)
    return _fixup(name, len(values), payload)


def _int_fixup(name: str, values: list[int]) -> bytes:
    payload = struct.pack("<%di" % len(values), *values) if values else b""
    return _fixup(name, len(values), payload)


def _reference_fixup(name: str, values: list[int]) -> bytes:
    return _fixup(name, len(values), _encode_reference_deltas(values))


def build_synthetic_igz() -> bytes:
    """Build a small structurally valid IGZ with wholly synthetic values."""

    type_names = [
        "igObject",
        "igEntity",
        "igTransform",
        "igSpline2",
        "igObjectList",
        "igSplineControlPoint2",
    ]
    type_sizes = [64, 80, 128, 112, 64, 56]
    object_offsets = [0x000, 0x040, 0x080, 0x100, 0x180, 0x200, 0x240, 0x280]
    object_reference_fields = [
        0x080 + 48,  # entity -> transform
        0x180 + 16,  # spline -> point list
        0x300,
        0x308,
        0x310,
        0x318,  # named-object slots
        0x400,
        0x408,  # spline point slots
    ]
    string_reference_fields = [0x340, 0x350, 0x360, 0x370]
    names = ["crate_synthetic", "route_synthetic", "point_a", "point_b"]

    fixups = b"".join(
        (
            _string_fixup("TMET", type_names),
            _string_fixup("TSTR", names),
            _int_fixup("MTSZ", type_sizes),
            _reference_fixup("RVTB", object_offsets),
            _reference_fixup("ROFS", object_reference_fields),
            _reference_fixup("RSTT", string_reference_fields),
            _reference_fixup("ROOT", [0x000]),
            _int_fixup("ONAM", [0x040]),
        )
    )

    fixup_offset = 0x100
    object_offset = 0x800
    object_chunk_size = 0x500
    if fixup_offset + len(fixups) > object_offset:
        raise AssertionError("synthetic fixup chunk overlaps object chunk")
    data = bytearray(object_offset + object_chunk_size)
    struct.pack_into("<5I", data, 0, IGZ_SIGNATURE, 10, 0, 0, 8)
    struct.pack_into("<4i", data, 20, 0, fixup_offset, len(fixups), 16)
    struct.pack_into("<4i", data, 36, 1, object_offset, object_chunk_size, 16)
    struct.pack_into("<4i", data, 52, 0, 0, 0, 0)
    data[fixup_offset : fixup_offset + len(fixups)] = fixups

    def absolute(relative: int) -> int:
        return object_offset + relative

    # RVTB objects: root, ONAM helper, entity, transform, spline, list, points.
    for relative, type_index in zip(object_offsets, [0, 0, 1, 2, 3, 4, 5, 5]):
        struct.pack_into("<I", data, absolute(relative), type_index)

    # ROOT and ONAM memory references point to invented object/name slot arrays.
    struct.pack_into("<iiQ", data, absolute(0x000 + 24), 4 * 8, 0, 0x300)
    struct.pack_into("<iiQ", data, absolute(0x040 + 24), 4 * 16, 0, 0x340)
    for index, target in enumerate((0x080, 0x180, 0x240, 0x280)):
        struct.pack_into("<Q", data, absolute(0x300 + index * 8), target)
        struct.pack_into("<I", data, absolute(0x340 + index * 16), index)

    # Entity and transform values are conspicuous so axis/order mistakes surface.
    struct.pack_into("<3f", data, absolute(0x080 + 32), 1.25, 2.5, -3.75)
    struct.pack_into("<Q", data, absolute(0x080 + 48), 0x100)
    struct.pack_into("<4f", data, absolute(0x100 + 16), 0.0, 0.5, 0.0, 0.8660254)
    struct.pack_into("<3f", data, absolute(0x100 + 96), 0.1, 0.2, 0.3)
    struct.pack_into("<3f", data, absolute(0x100 + 112), 2.0, 3.0, 4.0)

    # Spline -> object list -> two named control points.
    struct.pack_into("<Q", data, absolute(0x180 + 16), 0x200)
    struct.pack_into("<f", data, absolute(0x180 + 104), 12.5)
    data[absolute(0x180 + 108)] = 1
    struct.pack_into("<iiQ", data, absolute(0x200 + 24), 2 * 8, 0, 0x400)
    struct.pack_into("<Q", data, absolute(0x400), 0x240)
    struct.pack_into("<Q", data, absolute(0x408), 0x280)

    point_values = (
        ((0.0, 1.0, 2.0), (-1.0, 0.0, 0.0), (1.0, 0.0, 0.0), True),
        ((10.0, 3.0, -4.0), (-2.0, 0.0, 1.0), (2.0, 0.0, -1.0), False),
    )
    for relative, (position, tangent_in, tangent_out, smooth) in zip(
        (0x240, 0x280), point_values
    ):
        struct.pack_into("<3f", data, absolute(relative + 16), *position)
        struct.pack_into("<3f", data, absolute(relative + 28), *tangent_in)
        struct.pack_into("<3f", data, absolute(relative + 40), *tangent_out)
        data[absolute(relative + 52)] = int(smooth)
    return bytes(data)


def build_synthetic_iga(igz: bytes) -> bytes:
    """Wrap the synthetic IGZ as one stored member in an IGA v11 archive."""

    member = "maps/Synthetic/Layout.igz"
    path_table_offset = 0x100
    path_strings = member.encode("utf-8") + b"\0" + member.encode("utf-8") + b"\0"
    path_table = struct.pack("<I", 4) + path_strings
    member_offset = 0x800
    data = bytearray(member_offset + len(igz))
    header = struct.pack(
        "<10IQ2I",
        IGA_SIGNATURE,
        11,
        path_table_offset + len(path_table),
        1,
        0x800,
        0,
        0,
        0,
        0,
        0,
        path_table_offset,
        len(path_table),
        0,
    )
    data[: len(header)] = header
    struct.pack_into("<I", data, len(header), 0x12345678)
    struct.pack_into("<Iiii", data, len(header) + 4, member_offset, 0, len(igz), -1)
    data[path_table_offset : path_table_offset + len(path_table)] = path_table
    data[member_offset:] = igz
    return bytes(data)


class IgaIgzLayoutTests(unittest.TestCase):
    def test_synthetic_archive_and_layout(self) -> None:
        igz_bytes = build_synthetic_igz()
        archive_bytes = build_synthetic_iga(igz_bytes)
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            archive_path = root / "synthetic.pak"
            archive_path.write_bytes(archive_bytes)

            with IgaArchive(archive_path) as archive:
                inventory = archive.inventory(igz_only=True)
                self.assertEqual(inventory["entry_count"], 1)
                self.assertEqual(inventory["entries"][0]["compression"], "stored")
                self.assertEqual(
                    archive.extract_bytes("MAPS/synthetic/layout.IGZ"), igz_bytes
                )

            layout = IgzLayout(igz_bytes).layout_dump(
                {"kind": "synthetic-test"}, "crate_"
            )
            self.assertEqual(layout["summary"]["named_entity_count"], 1)
            self.assertEqual(layout["summary"]["spline_count"], 1)
            self.assertEqual(layout["summary"]["crate_count"], 1)
            crate = layout["crates"][0]
            self.assertEqual(crate["name"], "crate_synthetic")
            self.assertEqual(crate["position"], [1.25, 2.5, -3.75])
            self.assertEqual(crate["scale"], [2.0, 3.0, 4.0])
            self.assertTrue(crate["authored"])
            self.assertAlmostEqual(crate["rotation_radians"][2], 0.3, places=6)
            spline = layout["splines"][0]
            self.assertEqual(spline["name"], "route_synthetic")
            self.assertEqual(len(spline["points"]), 2)
            self.assertEqual(spline["points"][1]["position"], [10.0, 3.0, -4.0])
            self.assertTrue(spline["looping"])

    def test_json_cli_inventory_dump_and_scan(self) -> None:
        archive_bytes = build_synthetic_iga(build_synthetic_igz())
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            archive_path = root / "synthetic.pak"
            inventory_path = root / "inventory.json"
            dump_path = root / "layout.json"
            scan_path = root / "scan.json"
            archive_path.write_bytes(archive_bytes)

            self.assertEqual(
                main(
                    [
                        "inventory",
                        str(archive_path),
                        "--igz-only",
                        "--output",
                        str(inventory_path),
                    ]
                ),
                0,
            )
            self.assertEqual(
                main(
                    [
                        "dump",
                        str(archive_path),
                        "maps/Synthetic/Layout.igz",
                        "--output",
                        str(dump_path),
                    ]
                ),
                0,
            )
            self.assertEqual(
                main(
                    [
                        "scan",
                        str(archive_path),
                        "--contains",
                        "synthetic",
                        "--output",
                        str(scan_path),
                    ]
                ),
                0,
            )

            inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
            dumped = json.loads(dump_path.read_text(encoding="utf-8"))
            scan = json.loads(scan_path.read_text(encoding="utf-8"))
            self.assertEqual(inventory["selected_entry_count"], 1)
            self.assertEqual(dumped["crates"][0]["name"], "crate_synthetic")
            self.assertEqual(scan["layout_count"], 1)
            self.assertEqual(scan["error_count"], 0)


if __name__ == "__main__":
    unittest.main()
