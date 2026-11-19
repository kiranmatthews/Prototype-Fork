"""Compare the three registered Blender renders with the original image at native scale."""

import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from surface import ART
from study_pigment import VIEWS


def silhouette(photo):
    a = np.asarray(photo.convert('RGB'), dtype=int)
    bright = a.max(axis=2)
    chroma = bright - a.min(axis=2)
    blocked = Image.fromarray(((chroma > 31) | (bright > 157) | (bright < 61)).astype('uint8') * 255)
    blocked = blocked.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    # Recover neutral-coloured clothing and the whites of the eyes inside the
    # outer contour without including any portion of the connected backdrop.
    a = np.pad(np.asarray(blocked), 1).copy()
    area = Image.fromarray(a).copy()
    ImageDraw.floodfill(area, (0, 0), 128)
    mask = np.asarray(area)[1:-1, 1:-1] != 128
    mask[:, 0] = mask[:, 1]
    mask[:, -1] = mask[:, -2]
    if mask[8, 8] or mask.mean() > 0.9:
        raise ValueError('The exterior of the maquette could not be segmented')
    return mask


def compare(baseline, current, out):
    out.mkdir(parents=True, exist_ok=True)
    ref = Image.open(ART / 'likeness/three-view.webp').convert('RGB')
    font = '/System/Library/Fonts/Supplemental/Arial.ttf'
    board = Image.new('RGB', (3 * 724, 2 * 724 + 120), (39, 34, 37))
    draw = ImageDraw.Draw(board)
    labels = ImageFont.truetype(font, 21) if Path(font).exists() else ImageFont.load_default(size=21)
    stats = {}
    for i, name in enumerate(VIEWS):
        target = ref.crop((i * 724, 0, (i + 1) * 724, 724))
        board.paste(target, (i * 724, 37))
        render = Image.open(current / (name + '.png')).convert('RGBA')
        base = Image.new('RGB', render.size, (117, 109, 112))
        base.paste(render, mask=render.getchannel('A'))
        board.paste(base, (i * 724, 724 + 77))
        t = silhouette(target)
        record = {}
        for label, folder in [('previous', baseline), ('revised', current)]:
            native = np.asarray(Image.open(folder / (name + '.png')).convert('RGBA'))[:, :, 3] > 127
            both = native & t
            either = native | t
            record[label] = {
                sub: round(float(both[:rows].sum() / either[:rows].sum()), 4)
                for sub, rows in [('wholeFrame', 724), ('headAndHair', 548)]
            }
        stats[name] = record
    for y, title in [(7, 'SUPPLIED THREE-VIEW'), (724 + 47, 'BLENDER RENDER')]:
        draw.text((18, y), title, font=labels, fill=(247, 238, 228))
    for i, label in enumerate(('THREE-QUARTER', 'REAR', 'PROFILE')):
        draw.text((i * 724 + 18, 2 * 724 + 86), label, font=labels, fill=(219, 209, 203))
    board.save(out / 'Cargo-Roo-comparison.jpg', quality=94, subsampling=0)
    (out / 'silhouettes.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(json.dumps(stats))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    for k in ('baseline', 'current', 'out'):
        ap.add_argument(k, type=Path)
    a = ap.parse_args()
    compare(**vars(a))
