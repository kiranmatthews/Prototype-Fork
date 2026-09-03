#!/usr/bin/env python3
"""Resize a character texture and encode it as deterministic lossless WebP.

Colour textures receive a direct bicubic resize followed by a restrained
unsharp mask, approximating a "Bicubic Sharper" export. Scalar/data masks use
the same bicubic resize without sharpening so their values do not acquire
edge halos.

Examples:

  python tools/optimize-character-texture.py source.png output.webp --size 512
  python tools/optimize-character-texture.py roughness.png roughness.webp \
    --size 256 --kind mask

The WebP encoder is lossless relative to the processed pixels. Source metadata
is deliberately omitted, and a stable JSON report is written to stdout.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import struct
import sys
import tempfile
from pathlib import Path
from typing import Any

try:
    from PIL import Image, ImageFilter, ImageOps, features
    import PIL
except ModuleNotFoundError as error:  # pragma: no cover - depends on host setup
    if error.name == "PIL":
        raise SystemExit(
            "Pillow with WebP support is required; install it with "
            "`python -m pip install Pillow`."
        ) from error
    raise


SCHEMA_VERSION = 1
SHARPEN_RADIUS = 0.6
SHARPEN_PERCENT = 45
SHARPEN_THRESHOLD = 2
WEBP_METHOD = 6
WEBP_QUALITY = 100


class TextureError(ValueError):
    """An invalid or unverifiable texture conversion."""


def parse_size(value: str) -> tuple[int, int]:
    normalized = value.lower().replace("×", "x")
    fields = normalized.split("x")
    if len(fields) == 1:
        fields *= 2
    if len(fields) != 2:
        raise argparse.ArgumentTypeError("size must be PIXELS or WIDTHxHEIGHT")
    try:
        width, height = (int(field) for field in fields)
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            "size must be PIXELS or WIDTHxHEIGHT"
        ) from error
    if width <= 0 or height <= 0:
        raise argparse.ArgumentTypeError("width and height must be positive")
    return width, height


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def pixel_sha256(image: Image.Image) -> str:
    """Hash pixels together with their interpretation and dimensions."""

    digest = hashlib.sha256()
    digest.update(image.mode.encode("ascii"))
    digest.update(b"\0")
    digest.update(struct.pack(">II", *image.size))
    digest.update(image.tobytes())
    return digest.hexdigest()


def has_alpha(image: Image.Image) -> bool:
    return "A" in image.getbands() or (
        image.mode == "P" and "transparency" in image.info
    )


def canonical_colour(image: Image.Image) -> Image.Image:
    return image.convert("RGBA" if has_alpha(image) else "RGB")


def canonical_mask(image: Image.Image) -> Image.Image:
    if image.mode in {"L", "LA", "RGB", "RGBA"}:
        return image.copy()
    if image.mode == "1":
        return image.convert("L")
    if image.mode == "P":
        return image.convert("RGBA" if has_alpha(image) else "RGB")
    raise TextureError(
        "mask input must use 8-bit L, LA, RGB, RGBA, 1, or P pixels; "
        f"got {image.mode!r}"
    )


def sharpen_colour(image: Image.Image) -> Image.Image:
    unsharp = ImageFilter.UnsharpMask(
        radius=SHARPEN_RADIUS,
        percent=SHARPEN_PERCENT,
        threshold=SHARPEN_THRESHOLD,
    )
    if image.mode == "RGBA":
        alpha = image.getchannel("A")
        colour = image.convert("RGB").filter(unsharp)
        colour.putalpha(alpha)
        return colour
    return image.filter(unsharp)


def webp_pixels(image: Image.Image) -> Image.Image:
    """Return the RGB(A) pixel representation WebP will decode to."""

    if image.mode == "L":
        return Image.merge("RGB", (image, image, image))
    if image.mode == "LA":
        luminance, alpha = image.getchannel("L"), image.getchannel("A")
        return Image.merge("RGBA", (luminance, luminance, luminance, alpha))
    if image.mode in {"RGB", "RGBA"}:
        return image.copy()
    raise TextureError(f"unsupported processed image mode {image.mode!r}")


def webp_chunk_types(path: Path) -> list[str]:
    data = path.read_bytes()
    if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise TextureError("encoder did not produce a RIFF WebP file")
    chunks: list[str] = []
    offset = 12
    while offset + 8 <= len(data):
        chunk = data[offset : offset + 4]
        length = int.from_bytes(data[offset + 4 : offset + 8], "little")
        try:
            chunks.append(chunk.decode("ascii"))
        except UnicodeDecodeError as error:
            raise TextureError("WebP contains an invalid chunk name") from error
        offset += 8 + length + (length & 1)
    if offset != len(data):
        raise TextureError("WebP has a truncated or misaligned chunk")
    return chunks


def atomic_save_webp(
    image: Image.Image,
    destination: Path,
    expected_pixel_sha256: str,
) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=f".{destination.name}.",
            suffix=".webp",
            dir=destination.parent,
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
        image.save(
            temporary_path,
            "WEBP",
            lossless=True,
            quality=WEBP_QUALITY,
            method=WEBP_METHOD,
            exact=True,
            exif=b"",
            icc_profile=b"",
            xmp=b"",
        )
        with Image.open(temporary_path) as verified:
            verified.load()
            decoded = verified.convert(image.mode)
            output_format = verified.format
            output_mode = verified.mode
            output_size = verified.size
        decoded_pixel_sha256 = pixel_sha256(decoded)
        if decoded_pixel_sha256 != expected_pixel_sha256:
            raise TextureError("lossless WebP pixel verification failed")
        chunks = webp_chunk_types(temporary_path)
        metadata_chunks = sorted(set(chunks) & {"EXIF", "ICCP", "XMP "})
        if metadata_chunks:
            raise TextureError(
                "WebP unexpectedly contains metadata: "
                + ", ".join(metadata_chunks)
            )
        os.replace(temporary_path, destination)
        temporary_path = None
        return {
            "chunkTypes": chunks,
            "decodedMode": output_mode,
            "decodedPixelSha256": decoded_pixel_sha256,
            "format": output_format,
            "size": output_size,
        }
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def optimize(
    source: Path,
    destination: Path,
    size: tuple[int, int],
    kind: str,
    allow_upscale: bool,
    overwrite: bool,
) -> dict[str, Any]:
    source = source.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if not source.is_file():
        raise TextureError(f"source is not a file: {source}")
    if source == destination:
        raise TextureError("source and destination must be different files")
    if destination.suffix.lower() != ".webp":
        raise TextureError("destination must end in .webp")
    if destination.exists() and not overwrite:
        raise TextureError(f"destination exists; pass --force to replace it: {destination}")
    if not features.check("webp"):
        raise TextureError("this Pillow build has no WebP encoder")

    source_bytes = source.stat().st_size
    source_sha256 = sha256_file(source)
    with Image.open(source) as opened:
        opened.load()
        source_format = opened.format
        source_mode = opened.mode
        source_size = opened.size
        oriented = ImageOps.exif_transpose(opened)
        working = (
            canonical_colour(oriented)
            if kind == "color"
            else canonical_mask(oriented)
        )

    if not allow_upscale and (
        size[0] > working.width or size[1] > working.height
    ):
        raise TextureError(
            f"refusing to upscale {working.size[0]}x{working.size[1]} to "
            f"{size[0]}x{size[1]}; pass --allow-upscale to override"
        )

    resized = working.resize(size, resample=Image.Resampling.BICUBIC)
    processed = sharpen_colour(resized) if kind == "color" else resized
    encoded_pixels = webp_pixels(processed)

    # Rebuild from raw pixels so no source EXIF/ICC/XMP or timestamps can leak
    # into the deterministic web asset.
    encoded_pixels = Image.frombytes(
        encoded_pixels.mode,
        encoded_pixels.size,
        encoded_pixels.tobytes(),
    )
    expected_pixel_sha256 = pixel_sha256(encoded_pixels)
    verification = atomic_save_webp(
        encoded_pixels,
        destination,
        expected_pixel_sha256,
    )
    decoded_pixel_sha256 = verification["decodedPixelSha256"]

    output_bytes = destination.stat().st_size
    webp_version = features.version("webp")
    return {
        "encoder": {
            "exactTransparentRgb": True,
            "format": "WEBP",
            "lossless": True,
            "method": WEBP_METHOD,
            "quality": WEBP_QUALITY,
        },
        "operation": {
            "kind": kind,
            "resample": "Pillow.Image.Resampling.BICUBIC",
            "sharpen": None
            if kind == "mask"
            else {
                "filter": "Pillow.ImageFilter.UnsharpMask",
                "percent": SHARPEN_PERCENT,
                "radius": SHARPEN_RADIUS,
                "threshold": SHARPEN_THRESHOLD,
            },
            "targetSize": list(size),
        },
        "output": {
            "bytes": output_bytes,
            "chunkTypes": verification["chunkTypes"],
            "decodedMode": verification["decodedMode"],
            "embeddedMetadataChunks": [],
            "format": verification["format"],
            "path": str(destination),
            "pixelSha256": decoded_pixel_sha256,
            "sha256": sha256_file(destination),
            "size": list(verification["size"]),
        },
        "runtime": {
            "pillow": PIL.__version__,
            "python": ".".join(str(value) for value in sys.version_info[:3]),
            "webp": webp_version,
        },
        "schemaVersion": SCHEMA_VERSION,
        "source": {
            "bytes": source_bytes,
            "format": source_format,
            "mode": source_mode,
            "path": str(source),
            "sha256": source_sha256,
            "size": list(source_size),
        },
        "verification": {
            "decodedPixelSha256": decoded_pixel_sha256,
            "expectedPixelSha256": expected_pixel_sha256,
            "pixelExact": True,
        },
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="source raster image")
    parser.add_argument("destination", type=Path, help="lossless .webp output")
    parser.add_argument(
        "--size",
        required=True,
        type=parse_size,
        metavar="PIXELS|WIDTHxHEIGHT",
        help="exact output dimensions; a single value produces a square texture",
    )
    parser.add_argument(
        "--mode",
        "--kind",
        dest="kind",
        choices=("color", "colour", "mask"),
        default="color",
        help="color adds light post-resize sharpening; mask never sharpens",
    )
    parser.add_argument(
        "--allow-upscale",
        action="store_true",
        help="allow target dimensions larger than the source",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="replace an existing destination",
    )
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    kind = "color" if args.kind in {"color", "colour"} else args.kind
    try:
        report = optimize(
            source=args.source,
            destination=args.destination,
            size=args.size,
            kind=kind,
            allow_upscale=args.allow_upscale,
            overwrite=args.force,
        )
    except (OSError, TextureError) as error:
        parser.exit(2, f"error: {error}\n")
    print(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
