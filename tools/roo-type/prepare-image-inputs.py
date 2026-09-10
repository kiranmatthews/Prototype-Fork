"""Rasterize the original font as shape-only inputs for per-glyph image editing.

These are constraints for the image model, not finished HUD artwork.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
target = root / 'art/roo-reference-match/inputs'
target.mkdir(parents=True, exist_ok=True)
source = json.loads((root / 'public/fonts/roo-bevel-source-v1.json').read_text())
side, cap, pad, ss = 1024, 780, 122, 3
font = ImageFont.truetype(str(root / 'public/fonts/RooRegular.ttf'), round(cap * 1000 / 882 * ss))
manifest = {}
for char, glyph in source['glyphs'].items():
    if not glyph['commands']:
        continue
    canvas = Image.new('RGB', (side * ss, side * ss), 'white')
    draw = ImageDraw.Draw(canvas)
    left, bottom, right, top = glyph['bounds']
    x = (side / 2 - (left + right) / 2 * cap) * ss
    baseline = (pad + source['capBand']['top'] / source['capBand']['height'] * cap) * ss
    draw.text((x, baseline), char, font=font, anchor='ls', fill='#202020')
    canvas = canvas.resize((side, side), Image.Resampling.LANCZOS)
    filename = f'u{ord(char):04x}-roo-shape.png'
    canvas.save(target / filename)
    manifest[char] = {'file': filename, 'capPixels': cap, 'capTop': pad, 'penX': x / ss,
                      'sourceBounds': glyph['bounds'], 'advance': glyph['advance']}
(target / 'manifest.json').write_text(json.dumps({'fontSha256': source['sha256'], 'glyphs': manifest}, indent=2) + '\n')
print(json.dumps({'glyphs': len(manifest), 'folder': str(target)}))
