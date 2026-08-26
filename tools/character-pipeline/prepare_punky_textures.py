#!/usr/bin/env python3
"""Create deterministic web texture tiers from the canonical Punky Fox maps."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resize_rgb(source: Path, destination: Path, size: int) -> None:
    image = Image.open(source).convert("RGB")
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    image.save(destination, optimize=True, compress_level=9)


def resize_normal(source: Path, destination: Path, size: int) -> None:
    image = Image.open(source).convert("RGB")
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    encoded = np.asarray(image, dtype=np.float32) / 255.0
    vectors = encoded * 2.0 - 1.0
    lengths = np.linalg.norm(vectors, axis=2, keepdims=True)
    vectors /= np.maximum(lengths, 1e-8)
    output = np.clip((vectors * 0.5 + 0.5) * 255.0 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(output, "RGB").save(destination, optimize=True, compress_level=9)


def resize_scalar(source: Path, destination: Path, size: int) -> None:
    image = Image.open(source).convert("RGB").getchannel(0)
    image = image.resize((size, size), Image.Resampling.LANCZOS)
    image.save(destination, optimize=True, compress_level=9)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, required=True)
    parser.add_argument("--color-size", type=int, default=2048)
    parser.add_argument("--normal-size", type=int, default=2048)
    parser.add_argument("--scalar-size", type=int, default=1024)
    args = parser.parse_args()

    source = args.source_dir.expanduser().resolve()
    output = args.out_dir.expanduser().resolve()
    output.mkdir(parents=True, exist_ok=True)
    inputs = {
        "baseColor": source / "PunkyFox_BaseColor.png",
        "normal": source / "PunkyFox_Normal.png",
        "metallic": source / "PunkyFox_Metallic.png",
        "roughness": source / "PunkyFox_Roughness.png",
    }
    missing = [str(path) for path in inputs.values() if not path.is_file()]
    if missing:
        raise SystemExit("missing source maps: " + ", ".join(missing))

    outputs = {
        "baseColor": output / "punky-basecolor-2k.png",
        "normal": output / "punky-normal-2k.png",
        "metallic": output / "punky-metallic-1k.png",
        "roughness": output / "punky-roughness-1k.png",
    }
    resize_rgb(inputs["baseColor"], outputs["baseColor"], args.color_size)
    resize_normal(inputs["normal"], outputs["normal"], args.normal_size)
    resize_scalar(inputs["metallic"], outputs["metallic"], args.scalar_size)
    resize_scalar(inputs["roughness"], outputs["roughness"], args.scalar_size)

    manifest = {
        "schemaVersion": 1,
        "source": {key: {"path": str(path), "sha256": sha256(path)} for key, path in inputs.items()},
        "outputs": {
            key: {"path": str(path), "bytes": path.stat().st_size, "sha256": sha256(path)}
            for key, path in outputs.items()
        },
        "settings": {
            "colorSize": args.color_size,
            "normalSize": args.normal_size,
            "scalarSize": args.scalar_size,
            "filter": "Lanczos",
            "normalRenormalized": True,
        },
    }
    manifest_path = output / "texture-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": "success", "manifest": str(manifest_path), **manifest["settings"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
