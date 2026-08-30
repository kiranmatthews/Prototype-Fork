"""Resize the owner-supplied Unity skateboard rasters for browser delivery."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def bake(source: Path, destination: Path, size: tuple[int, int], quality: int) -> None:
    with Image.open(source) as image:
        image = image.convert("RGB")
        image.thumbnail(size, Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=quality, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("unity_project", type=Path)
    parser.add_argument("web_public", type=Path)
    args = parser.parse_args()
    boards = args.unity_project / "Assets/Game/Art/Boards"
    output = args.web_public / "skateboard"
    bake(
        boards / "Textures/SurfCruiser_OrangeSun_BaseArtwork.png",
        output / "surf-cruiser-orange-sun.webp",
        (1024, 2048),
        90,
    )
    bake(
        boards / "Hardware/Truck/Source/SkateboardTruck_BaseColor.png",
        output / "skateboard-truck.webp",
        (1024, 1024),
        88,
    )
    bake(
        boards / "References/SurfCruiser_Reference.png",
        output / "surf-cruiser-reference.webp",
        (1200, 900),
        88,
    )


if __name__ == "__main__":
    main()
