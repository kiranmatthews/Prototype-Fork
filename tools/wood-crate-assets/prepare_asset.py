#!/usr/bin/env python3
"""Preserve the Meshy crate mesh/UVs; reduce its single diffuse map to 256 px."""
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]

def prepare(source):
    source = Path(source)
    raw = source.read_bytes()
    size = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20 + size])
    binary = raw[28 + size:]
    assert len(data['meshes']) == 1 and len(data['materials']) == 1 and len(data['images']) == 1
    triangles = sum(data['accessors'][p['indices']]['count'] // 3 for m in data['meshes'] for p in m['primitives'])
    assert triangles <= 256, f'Crate exceeds triangle budget: {triangles}'
    image = data['images'][0]; view = data['bufferViews'][image['bufferView']]
    offset = view.get('byteOffset', 0)
    diffuse = Image.open(io.BytesIO(binary[offset:offset + view['byteLength']])).convert('RGB')
    diffuse.thumbnail((256, 256), Image.Resampling.LANCZOS)
    encoded = io.BytesIO(); diffuse.save(encoded, format='JPEG', quality=90, optimize=True)
    packed = bytearray()
    for index, view in enumerate(data['bufferViews']):
        packed.extend(b'\0' * (-len(packed) % 4))
        offset = view.get('byteOffset', 0)
        chunk = encoded.getvalue() if index == image['bufferView'] else binary[offset:offset + view['byteLength']]
        view['byteOffset'] = len(packed); view['byteLength'] = len(chunk); packed.extend(chunk)
    material = data['materials'][0]
    material['name'] = 'Classic oak crate'; material['doubleSided'] = False
    material['pbrMetallicRoughness']['metallicFactor'] = 0
    data['asset']['extras'] = {'provider': 'Meshy', 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'changes': 'Original Meshy geometry, normals and UVs; 256px diffuse texture; opaque single-sided wood'}
    data['buffers'][0]['byteLength'] = len(packed)
    header = json.dumps(data, separators=(',', ':')).encode(); header += b' ' * (-len(header) % 4)
    packed += b'\0' * (-len(packed) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(packed)) + struct.pack('<II', len(header), 0x4e4f534a) + header + struct.pack('<II', len(packed), 0x004e4942) + packed
    output = ROOT / 'public/props/wood-crate'; output.mkdir(parents=True, exist_ok=True)
    (output / 'classic-wood-crate.glb').write_bytes(result)
    ledger = json.loads((Path(__file__).parent / 'tasks.json').read_text())
    provenance = {'provider': 'Meshy', 'cliVersion': '0.3.1', 'taskIds': [t['id'] for t in ledger['tasks'].values()],
        'credits': sum(t['consumedCredits'] for t in ledger['tasks'].values()), 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'runtimeSha256': hashlib.sha256(result).hexdigest(), 'triangles': triangles, 'draws': 1,
        'textureSize': list(diffuse.size), 'sourceBytes': len(raw), 'runtimeBytes': len(result),
        'geometry': 'Original Meshy vertices, normals, UVs and indices; centred and fitted to the existing cube at runtime.'}
    (output / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    print(json.dumps(provenance))
if __name__ == '__main__': prepare(sys.argv[1])
