"""Bake Unity's 4096px spin base-colour atlas to its WebGL 2048px limit."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    with Image.open(args.source) as image:
        image = image.convert("RGB")
        image.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        args.destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.destination, "WEBP", quality=90, method=6)


if __name__ == "__main__":
    main()
