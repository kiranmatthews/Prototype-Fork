"""Add full-resolution UASTC textures; preserve every geometry/fallback byte.

Requires Pillow and Khronos toktx 4.4.2. Set TREEHOUSE_TOKTX to the executable.
No remeshing, resizing, normal renormalization or additional RDO distortion.
"""
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/treehouse-trail'
ENCODER = os.environ['TREEHOUSE_TOKTX']
WORK = Path(tempfile.gettempdir()) / 'treehouse-gpu-textures'
WORK.mkdir(exist_ok=True)
NAMES = ['body-v2', 'host', 'balcony-deck', 'canopy', 'stairs', 'landing', 'tree', 'bush']

def digest(data):
    return hashlib.sha256(data).hexdigest()

for name in NAMES:
    path = OUT / (name + '.glb')
    raw = path.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    source = raw[28+length:]
    old_views = doc['bufferViews']
    def view_bytes(index):
        view = old_views[index]
        start = view.get('byteOffset', 0)
        return source[start:start+view['byteLength']]
    old_gpu = {image['bufferView'] for image in doc['images'] if image.get('mimeType') == 'image/ktx2'}
    views, binary, remap = [], bytearray(), {}
    def append(data, metadata=None):
        binary.extend(b'\0' * (-len(binary) % 4))
        view = dict(metadata or {})
        view.update(buffer=0, byteOffset=len(binary), byteLength=len(data))
        views.append(view)
        binary.extend(data)
        return len(views)-1
    for index, view in enumerate(old_views):
        if index not in old_gpu:
            remap[index] = append(view_bytes(index), view)
    for accessor in doc['accessors']:
        accessor['bufferView'] = remap[accessor['bufferView']]
    images = [dict(image) for image in doc['images'] if image.get('mimeType') != 'image/ktx2']
    for image in images:
        image['bufferView'] = remap[image['bufferView']]
    report = []
    for index, texture in enumerate(doc['textures']):
        image = doc['images'][texture['source']]
        original = view_bytes(image['bufferView'])
        color_space = 'srgb' if index == 0 else 'linear'
        key = digest(original + color_space.encode() + b'|uastc2-zstd18-mips-v1')
        png, ktx = WORK / (key + '.png'), WORK / (key + '.ktx2')
        decoded = Image.open(io.BytesIO(original)).convert('RGB')
        if not ktx.exists() or ktx.stat().st_size < 128:
            decoded.save(png)
            subprocess.run([ENCODER, '--t2', '--encode', 'uastc', '--uastc_quality', '2',
                '--zcmp', '18', '--threads', '2', '--genmipmap', '--assign_oetf', color_space,
                str(ktx), str(png)], check=True, capture_output=True)
        compressed = ktx.read_bytes()
        assert struct.unpack_from('<II', compressed, 20) == decoded.size
        levels = struct.unpack_from('<I', compressed, 40)[0]
        gpu_bytes = sum(((max(1, decoded.width >> level)+3)//4)*((max(1, decoded.height >> level)+3)//4)*16 for level in range(levels))
        images.append({'name': image.get('name', name) + '-gpu', 'mimeType': 'image/ktx2', 'bufferView': append(compressed)})
        texture.setdefault('extensions', {})['KHR_texture_basisu'] = {'source': len(images)-1}
        report.append({'fallbackSha256': digest(original), 'ktxSha256': digest(compressed),
            'width': decoded.width, 'height': decoded.height, 'mipLevels': levels,
            'astc4x4Bytes': gpu_bytes, 'encodedBytes': len(compressed)})
    doc['images'], doc['bufferViews'] = images, views
    doc['buffers'] = [{'byteLength': len(binary)}]
    doc['extensionsUsed'] = sorted(set(doc.get('extensionsUsed', []) + ['KHR_texture_basisu']))
    doc['extensionsRequired'] = [x for x in doc.get('extensionsRequired', []) if x != 'KHR_texture_basisu']
    if not doc['extensionsRequired']:
        doc.pop('extensionsRequired')
    encoded = json.dumps(doc, separators=(',', ':')).encode()
    encoded += b' ' * (-len(encoded) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    output = struct.pack('<III', 0x46546c67, 2, 28+len(encoded)+len(binary)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(binary), 0x004e4942) + binary
    path.write_bytes(output)
    manifest_path = OUT / (name + '-manifest.json')
    manifest = json.loads(manifest_path.read_text())
    manifest.update(bytes=len(output), sha256=digest(output), gpuTextures={'encoder': 'Khronos toktx 4.4.2 / UASTC quality 2 / lossless Zstd 18', 'textures': report})
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(name, 'ASTC MiB', round(sum(t['astc4x4Bytes'] for t in report)/1048576, 2), flush=True)

provenance_path = OUT / 'provenance.json'
provenance = json.loads(provenance_path.read_text())
provenance['models'] = [{**model, **json.loads((OUT / (model['name'] + '-manifest.json')).read_text())} for model in provenance['models']]
provenance['gpuTextureEncoding'] = 'Full-resolution UASTC quality 2 with original JPEG fallbacks; geometry and UV buffers unchanged.'
provenance_path.write_text(json.dumps(provenance, indent=2) + '\n')
