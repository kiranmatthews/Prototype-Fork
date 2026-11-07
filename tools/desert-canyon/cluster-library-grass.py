"""Batch four complete existing grass tufts into one authored native patch.

No simplification, atlas changes or distance variants. All LOD0 triangles,
attributes and embedded texture bytes survive in every copy. The unused
source LOD1 is an alternate model, not part of the native LOD0 surface.
"""
import copy
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'public/carlisle-coast-fidelity/grass-tuft-b.glb'
raw = source.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
data = bytearray(raw[28 + json_size:])
formats = {5120: 'b', 5121: 'B', 5122: 'h', 5123: 'H', 5125: 'I', 5126: 'f'}
widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def read(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    fmt = '<' + formats[a['componentType']] * widths[a['type']]
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', struct.calcsize(fmt))
    return copy.deepcopy(a), [list(struct.unpack_from(fmt, data, offset + i * stride)) for i in range(a['count'])]

def append(a, values):
    while len(data) % 4:
        data.append(0)
    offset = len(data)
    fmt = '<' + formats[a['componentType']] * widths[a['type']]
    for row in values:
        data.extend(struct.pack(fmt, *row))
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data) - offset})
    a.update(bufferView=view, byteOffset=0, count=len(values))
    a.pop('min', None)
    a.pop('max', None)
    index = len(doc['accessors'])
    doc['accessors'].append(a)
    return index

primitive = doc['meshes'][0]['primitives'][0]
attributes = {key: read(index) for key, index in primitive['attributes'].items()}
positions = attributes['POSITION'][1]
lo = [min(p[k] for p in positions) for k in range(3)]
hi = [max(p[k] for p in positions) for k in range(3)]
centre = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]
copies = [(-.36, -.26, 12, .94), (.34, -.18, 104, 1.08), (.08, .34, 219, .85), (-.12, .02, 292, 1.02)]
expanded = {key: [] for key in attributes}
for dx, dz, degrees, scale in copies:
    angle = math.radians(degrees)
    cs, sn = math.cos(angle), math.sin(angle)
    for key, (_, values) in attributes.items():
        for row in values:
            q = list(row)
            if key == 'POSITION':
                x, y, z = [(row[k] - centre[k]) * scale for k in range(3)]
                q = [x * cs + z * sn + dx, y, z * cs - x * sn + dz]
            elif key in ('NORMAL', 'TANGENT'):
                q[0], q[2] = row[0] * cs + row[2] * sn, row[2] * cs - row[0] * sn
            expanded[key].append(q)
primitive['attributes'] = {key: append(attributes[key][0], values) for key, values in expanded.items()}
pa = doc['accessors'][primitive['attributes']['POSITION']]
pa['min'] = [min(p[k] for p in expanded['POSITION']) for k in range(3)]
pa['max'] = [max(p[k] for p in expanded['POSITION']) for k in range(3)]
ia, indices = read(primitive['indices'])
ia['componentType'] = 5125
primitive['indices'] = append(ia, [[i[0] + n * len(positions)] for n in range(4) for i in indices])
doc['meshes'] = [{'name': 'Four complete native dry grass tufts', 'primitives': [primitive]}]
doc['nodes'] = [{'mesh': 0, 'name': 'Native canyon grass patch'}]
doc['scenes'] = [{'nodes': [0]}]
doc['scene'] = 0
doc['buffers'] = [{'byteLength': len(data)}]
text = json.dumps(doc, separators=(',', ':')).encode()
text += b' ' * (-len(text) % 4)
data.extend(b'\0' * (-len(data) % 4))
output = struct.pack('<4sII', b'glTF', 2, 28 + len(text) + len(data)) + struct.pack('<I4s', len(text), b'JSON') + text + struct.pack('<I4s', len(data), b'BIN\0') + data
target = ROOT / 'public/desert-canyon/grass-cluster.glb'
target.write_bytes(output)
manifest = {'source': str(source.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'file': target.name, 'sha256': hashlib.sha256(output).hexdigest(), 'copies': len(copies),
            'sourceTriangles': len(indices) // 3, 'triangles': len(indices) // 3 * 4,
            'size': [pa['max'][k] - pa['min'][k] for k in range(3)],
            'policy': 'Four full native LOD0 meshes; all LOD0 attributes, indices and embedded atlases retained; no distance substitutions'}
(target.parent / 'grass-cluster-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))
