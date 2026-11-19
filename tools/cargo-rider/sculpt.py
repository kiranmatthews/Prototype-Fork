"""Bake the Cargo Roo sculpt and texture atlases for Blender."""

import argparse
from pathlib import Path
from head import sculpt_head
from performance import detail_controls
from wardrobe import sculpt_wardrobe
from bake import bake_character

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path, help='Local directory for intermediate geometry and textures')
    output = parser.parse_args().output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    sculpt_head()
    detail_controls()
    sculpt_wardrobe()
    bake_character(output)
