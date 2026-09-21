"""Derive runtime PNGs from the untouched full-resolution font masters.

Run with Pillow. Premultiplied-alpha filtering avoids dark transparent rims.
Layout/kerning stay in master coordinates; runtime scales source rectangles.
"""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2]
source = (root / 'src/roo-type/atlas-metrics.ts').read_text()
metrics = json.loads(source[source.index('= {') + 2:].strip().removesuffix(';'))
for palette, data in metrics.items():
    for frame in range(data.get('lightFrames', 1)):
        name = f"roo-{palette}-v{data['version']}" + (f'-light{frame}' if frame else '')
        with Image.open(root / f'public/fonts/{name}.png') as original:
            assert original.size == (data['width'], data['height'])
            for cap in (128, 256):
                scale = cap / data['capPixels']
                size = (round(original.width * scale), round(original.height * scale))
                output = original.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
                output.save(root / f'public/fonts/{name}-cap{cap}.png', optimize=True)
                print(name, cap, size)
