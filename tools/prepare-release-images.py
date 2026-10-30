"""Regenerate the reviewed standalone lossless images. Requires Pillow/WebP.

The manifest is an explicit allowlist, never a blanket conversion of user art.
Full font PNGs are deliberately excluded: their download exports retain bytes.
Run test-release-images-browser.mjs after regenerating to check browser pixels.
"""
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
library = root / 'release-images'
manifest = json.loads((library / 'manifest.json').read_text())
rows = []
for previous in manifest['files']:
    file = Path(previous['file'])
    assert not file.is_absolute() and '..' not in file.parts and file.suffix == '.png'
    source = (root / 'public' / file).read_bytes()
    image = Image.open(io.BytesIO(source))
    assert not any(key in image.info for key in ['icc_profile', 'exif', 'gamma', 'chromaticity']), file
    rgba = image.convert('RGBA')
    buffer = io.BytesIO()
    rgba.save(buffer, format='WEBP', lossless=True, quality=100, method=6, exact=True)
    encoded = buffer.getvalue()
    assert Image.open(io.BytesIO(encoded)).convert('RGBA').tobytes() == rgba.tobytes()
    assert len(encoded) < len(source), file
    digest = hashlib.sha256(encoded).hexdigest()
    (library / 'encoded' / (digest + '.webp')).write_bytes(encoded)
    rows.append(dict(file=file.as_posix(), encoded=digest + '.webp',
                     sourceBytes=len(source), bytes=len(encoded),
                     sourceSha256=hashlib.sha256(source).hexdigest(), sha256=digest,
                     width=image.width, height=image.height,
                     pixelSha256=hashlib.sha256(rgba.tobytes()).hexdigest()))
manifest['files'] = rows
(library / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f"Encoded {len(rows)} images with identical RGBA pixels.")
