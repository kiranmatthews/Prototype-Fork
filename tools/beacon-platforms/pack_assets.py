#!/usr/bin/env python3
"""Fit Meshy's original meshes to the existing deck; compact embedded PBR maps."""
import hashlib
import io
import json
from pathlib import Path
import struct
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
TOP = 2.2 / 3
RADIUS = 4.85 / 3

def pack(kind):
    source = ROOT / '.img2threejs/beacon-platforms' / (kind + '-green') / 'downloads/model.glb'
    raw = source.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    data = json.loads(raw[20:20 + length])
    binary = bytearray(raw[28 + length:])
    assert len(data['meshes']) == len(data['nodes']) == len(data['materials']) == 1
    assert np.allclose(np.array(data['nodes'][0].get('matrix', np.eye(4).ravel())), np.eye(4).ravel())
    primitive = data['meshes'][0]['primitives'][0]
    def attribute(name):
        accessor = data['accessors'][primitive['attributes'][name]]
        view = data['bufferViews'][accessor['bufferView']]
        assert accessor['componentType'] == 5126 and 'byteStride' not in view
        return np.frombuffer(binary, dtype='<f4', count=accessor['count'] * 3,
            offset=view.get('byteOffset', 0) + accessor.get('byteOffset', 0)).reshape(-1, 3), accessor
    positions, accessor = attribute('POSITION')
    normals, _ = attribute('NORMAL')
    original = positions.copy()
    center = (original.min(axis=0) + original.max(axis=0)) / 2
    positions[:, 0] -= center[0]
    positions[:, 2] -= center[2]
    radius = np.linalg.norm(positions[:, [0, 2]], axis=1)
    bottom = float(positions[:, 1].min())
    upper = (radius < .34) & (normals[:, 1] > .8) & (positions[:, 1] > bottom + np.ptp(positions[:, 1]) * .7)
    deck = float(np.median(positions[upper, 1]))
    scale_xz, scale_y = RADIUS / float(radius.max()), TOP / (deck - bottom)
    positions[:, [0, 2]] *= scale_xz
    positions[:, 1] = (positions[:, 1] - bottom) * scale_y
    # Keep the standing disk flat at the original collision plane, with just
    # 1.5 cm of sculpted rim relief. No change to player physics or pad solids.
    flat = (radius < .385) & (original[:, 1] > deck - .023)
    positions[flat, 1] = TOP
    above = positions[:, 1] > TOP
    positions[above, 1] = TOP + np.minimum((positions[above, 1] - TOP) * .18, .015)
    normals[:, [0, 2]] /= scale_xz
    normals[:, 1] /= scale_y
    normals[:] /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-9)
    normals[flat & (normals[:, 1] > .5)] = [0, 1, 0]
    accessor['min'], accessor['max'] = positions.min(axis=0).tolist(), positions.max(axis=0).tolist()
    image_chunks, textures = {}, []
    for index, image in enumerate(data['images']):
        view = data['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        texture = Image.open(io.BytesIO(binary[start:start + view['byteLength']])).convert('RGB')
        texture.thumbnail((2048, 2048) if index == 0 else (1024, 1024), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        texture.save(encoded, format='JPEG', quality=91, optimize=True, subsampling=0)
        image_chunks[image['bufferView']] = encoded.getvalue()
        image['mimeType'] = 'image/jpeg'
        textures.append({'size': list(texture.size), 'bytes': len(encoded.getvalue())})
    material = data['materials'][0]
    material['name'] = 'Green map beacon / pure white luminous rim'
    material['doubleSided'] = False
    # The diffuse inlay supplies a restrained night-time fill; it reuses the
    # same GPU texture and leaves the authored PBR roughness/normal maps intact.
    material['emissiveTexture'] = material['pbrMetallicRoughness']['baseColorTexture'].copy()
    material['emissiveFactor'] = [.3, .3, .3]
    material['normalTexture']['scale'] = .55
    data['nodes'][0]['name'] = 'Meshy ' + kind + ' beacon platform'
    packed = bytearray()
    for index, view in enumerate(data['bufferViews']):
        packed.extend(b'\0' * (-len(packed) % 4))
        start = view.get('byteOffset', 0)
        chunk = image_chunks.get(index, binary[start:start + view['byteLength']])
        view['byteOffset'], view['byteLength'] = len(packed), len(chunk)
        packed.extend(chunk)
    data['buffers'][0]['byteLength'] = len(packed)
    data['asset']['extras'] = {'provider': 'Meshy', 'reference': f'tools/beacon-platforms/references/{kind}-green.png',
        'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'preparation': 'Original Meshy topology and UVs; metre-space fit, flattened standing disk, compact PBR textures.'}
    header = json.dumps(data, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    packed += b'\0' * (-len(packed) % 4)
    result = struct.pack('<III', 0x46546c67, 2, 28 + len(header) + len(packed)) + struct.pack('<II', len(header), 0x4e4f534a) + header + struct.pack('<II', len(packed), 0x004e4942) + packed
    output = ROOT / 'public/props/beacon-platforms'
    output.mkdir(parents=True, exist_ok=True)
    (output / (kind + '.glb')).write_bytes(result)
    task = json.loads((HERE / 'tasks.json').read_text())['tasks'][kind + '-green']
    provenance = {'provider': 'Meshy', 'taskId': task['id'], 'consumedCredits': task['consumedCredits'],
        'referenceSha256': task['referenceSha256'], 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'runtimeSha256': hashlib.sha256(result).hexdigest(), 'runtimeBytes': len(result), 'sourceBytes': len(raw),
        'triangles': data['accessors'][primitive['indices']]['count'] // 3, 'draws': 1, 'textures': textures,
        'bounds': [accessor['min'], accessor['max']], 'standingPlane': TOP, 'radius': RADIUS,
        'flattenedDeckVertices': int(flat.sum()), 'geometry': data['asset']['extras']['preparation']}
    (output / (kind + '.provenance.json')).write_text(json.dumps(provenance, indent=2) + '\n')
    print(json.dumps({'kind': kind, **provenance}))

if __name__ == '__main__':
    for kind in ['arrival', 'finish']:
        pack(kind)
