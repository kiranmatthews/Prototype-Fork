"""Fit the existing full native pine to canyon proportions; preserve its atlas.

This is an authored vertex deformation, not a distance substitute. Every source
LOD0 vertex and triangle survives. The original asset is left unchanged.
"""
import io
import hashlib
import json
import math
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / 'public/country-club-art/umbrella-pine.glb'
raw = source.read_bytes()
json_size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + json_size])
bin_start = 20 + json_size + 8
data = bytearray(raw[bin_start:])

def accessor(index):
    a = doc['accessors'][index]
    v = doc['bufferViews'][a['bufferView']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = {5123: 'H', 5125: 'I', 5126: 'f'}[a['componentType']]
    width = struct.calcsize('<' + fmt * n)
    offset = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', width)
    return a, [list(struct.unpack_from('<' + fmt * n, data, offset + i * stride)) for i in range(a['count'])], offset, stride, fmt

primitive = doc['meshes'][0]['primitives'][0]
attrs = primitive['attributes']
pa, positions, po, ps, _ = accessor(attrs['POSITION'])
na, normals, no, ns, _ = accessor(attrs['NORMAL'])
_, uvs, _, _, _ = accessor(attrs['TEXCOORD_0'])
_, indices, _, _, _ = accessor(primitive['indices'])
image_index = doc['textures'][doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
image_view = doc['bufferViews'][doc['images'][image_index]['bufferView']]
image_offset = image_view.get('byteOffset', 0)
atlas = Image.open(io.BytesIO(data[image_offset:image_offset + image_view['byteLength']])).convert('RGB')
lo = [min(p[i] for p in positions) for i in range(3)]
hi = [max(p[i] for p in positions) for i in range(3)]
cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
height = hi[1] - lo[1]
# Keep every disconnected leaf cluster, but arrange the complete pieces into
# open branch whorls. A single radial squeeze made oversized solid cones.
parents = list(range(len(positions)))
def root(i):
    while parents[i] != i:
        parents[i] = parents[parents[i]]
        i = parents[i]
    return i
def join(a, b): parents[root(a)] = root(b)
seen = {}
for i, p in enumerate(positions):
    key = tuple(round(v, 5) for v in p)
    if key in seen: join(i, seen[key])
    else: seen[key] = i
for i in range(0, len(indices), 3):
    join(indices[i][0], indices[i+1][0]); join(indices[i][0], indices[i+2][0])
groups = {}
for i in range(len(positions)): groups.setdefault(root(i), []).append(i)
trunk = max(groups.values(), key=len)
clusters = [group for group in groups.values() if group is not trunk]
branches = []
for ring in range(14):
    t = .22 + ring / 13 * .74
    for branch in range(7):
        angle = branch * math.tau / 7 + ring * 2.399
        radius = .32 * (1 - (t - .16) / .84) ** .6 * (.92 + .08 * math.sin(branch * 8 + ring))
        branches.append((angle, radius, t * 1.4))
for i in trunk:
    p = positions[i]
    t = (p[1] - lo[1]) / height
    p[:] = [(p[0]-cx)*.20, t*1.4, (p[2]-cz)*.20]
for number, group in enumerate(clusters):
    angle, radius, y = branches[(number * 53) % len(branches)]
    along = .10 + .88 * ((number // len(branches) + .5) / math.ceil(len(clusters) / len(branches)))
    side = math.sin(number * 2.399) * .024 * (1 - along * .6)
    centre = [sum(positions[i][k] for i in group) / len(group) for k in range(3)]
    cs, sn = math.cos(angle), math.sin(angle)
    for i in group:
        p = positions[i]; dx, dy, dz = [(p[k]-centre[k])*.45 for k in range(3)]
        p[:] = [cs*(radius*along+dx)-sn*(side+dz), y-.04*along+dy, sn*(radius*along+dx)+cs*(side+dz)]
colours = []
for i, p in enumerate(positions):
    struct.pack_into('<3f', data, po + i * ps, *p)
    u, v = uvs[i]
    r, g, b = atlas.getpixel((min(atlas.width - 1, int(u % 1 * atlas.width)), min(atlas.height - 1, int(v % 1 * atlas.height))))
    leaf = g > r * 1.03 and g > b * 1.15
    colours.extend((.52, .67, .53) if leaf else (.78, .72, .65))

# Recompute the normals of the deformed full mesh with its original indices.
sums = [[0., 0., 0.] for _ in positions]
for i in range(0, len(indices), 3):
    ia, ib, ic = (indices[i + k][0] for k in range(3))
    a, b, c = positions[ia], positions[ib], positions[ic]
    u, v = [b[k] - a[k] for k in range(3)], [c[k] - a[k] for k in range(3)]
    n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    for ix in (ia, ib, ic):
        for k in range(3): sums[ix][k] += n[k]
for i, n in enumerate(sums):
    length = math.sqrt(sum(x*x for x in n)) or 1
    struct.pack_into('<3f', data, no + i * ns, *(x / length for x in n))
pa['min'] = [min(p[i] for p in positions) for i in range(3)]
pa['max'] = [max(p[i] for p in positions) for i in range(3)]
while len(data) % 4: data.append(0)
offset = len(data)
data.extend(struct.pack('<' + 'f' * len(colours), *colours))
doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(colours) * 4, 'target': 34962})
doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3'})
attrs['COLOR_0'] = len(doc['accessors']) - 1
# Fine branch supports and a tapering leader use the same bark atlas.
def append_attribute(values, kind, count, component=5126):
    while len(data) % 4: data.append(0)
    offset = len(data)
    data.extend(struct.pack('<' + ('f' if component == 5126 else 'I') * len(values), *values))
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(values)*4})
    out = {'bufferView': len(doc['bufferViews'])-1, 'componentType': component, 'count': count, 'type': kind}
    if kind == 'VEC3':
        out['min'] = [min(values[k::3]) for k in range(3)]
        out['max'] = [max(values[k::3]) for k in range(3)]
    doc['accessors'].append(out)
    return len(doc['accessors'])-1
bp, bn, buv, bc, bi = [], [], [], [], []
bark_uv = uvs[min(trunk, key=lambda i: positions[i][1])]
def cylinder(start, end, radius, tip):
    axis = [end[k]-start[k] for k in range(3)]
    length = math.sqrt(sum(x*x for x in axis)); axis = [x/length for x in axis]
    tangent = [axis[2], 0, -axis[0]] if abs(axis[1]) < .99 else [1, 0, 0]
    length = math.sqrt(sum(x*x for x in tangent)); tangent = [x/length for x in tangent]
    bit = [axis[1]*tangent[2]-axis[2]*tangent[1], axis[2]*tangent[0]-axis[0]*tangent[2], axis[0]*tangent[1]-axis[1]*tangent[0]]
    first = len(bp)//3
    for centre, r in [(start, radius), (end, tip)]:
        for j in range(6):
            a = j*math.tau/6; n = [math.cos(a)*tangent[k]+math.sin(a)*bit[k] for k in range(3)]
            bp.extend(centre[k]+n[k]*r for k in range(3)); bn.extend(n); buv.extend(bark_uv); bc.extend((.65,.60,.51))
    for j in range(6):
        a, b = first+j, first+(j+1)%6
        bi.extend((a,a+6,b,b,a+6,b+6))
cylinder([0,0,0],[0,1.4,0],.014,.0007)
for angle, radius, y in branches:
    cylinder([0,y,0],[math.cos(angle)*radius,y-.04,math.sin(angle)*radius],.0038,.0004)
branch_attributes = {'POSITION':append_attribute(bp,'VEC3',len(bp)//3),'NORMAL':append_attribute(bn,'VEC3',len(bn)//3),'TEXCOORD_0':append_attribute(buv,'VEC2',len(buv)//2),'COLOR_0':append_attribute(bc,'VEC3',len(bc)//3)}
doc['meshes'][0]['primitives'].append({'attributes':branch_attributes,'indices':append_attribute(bi,'SCALAR',len(bi),5125),'material':0,'mode':4})
# Reuse the same complete leaf pieces in two small offsets for dense fronds,
# retaining the original mesh and adding detail rather than simplifying it.
trunk_indices = set(trunk)
leaf_triangles = [[indices[i+k][0] for k in range(3)] for i in range(0,len(indices),3) if indices[i][0] not in trunk_indices]
leaf_vertices = sorted({i for face in leaf_triangles for i in face})
remap = {old:new for new,old in enumerate(leaf_vertices)}
leaf_indices = [remap[i] for face in leaf_triangles for i in face]
for turn, lift in [(-.04,-.012),(.04,.012)]:
    cp, cn, cuv, cc = [], [], [], []
    cs, sn = math.cos(turn), math.sin(turn)
    for i in leaf_vertices:
        x,y,z = positions[i]; cp.extend((x*cs-z*sn,y+lift,x*sn+z*cs))
        n = sums[i]; length = math.sqrt(sum(v*v for v in n)) or 1
        cn.extend(((n[0]*cs-n[2]*sn)/length,n[1]/length,(n[0]*sn+n[2]*cs)/length))
        cuv.extend(uvs[i]); cc.extend(colours[i*3:i*3+3])
    attributes={'POSITION':append_attribute(cp,'VEC3',len(cp)//3),'NORMAL':append_attribute(cn,'VEC3',len(cn)//3),'TEXCOORD_0':append_attribute(cuv,'VEC2',len(cuv)//2),'COLOR_0':append_attribute(cc,'VEC3',len(cc)//3)}
    doc['meshes'][0]['primitives'].append({'attributes':attributes,'indices':append_attribute(leaf_indices,'SCALAR',len(leaf_indices),5125),'material':0,'mode':4})
triangle_count=len(indices)//3+len(bi)//3+len(leaf_indices)//3*2
assert triangle_count<=30000
doc['scenes'] = [{'nodes': [0]}]
doc['scene'] = 0
doc['nodes'][0]['name'] = 'Canyon pine — complete library geometry'
doc['buffers'][0]['byteLength'] = len(data)
encoded = json.dumps(doc, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
result = struct.pack('<III', 0x46546c67, 2, 12 + 8 + len(encoded) + 8 + len(data))
result += struct.pack('<II', len(encoded), 0x4e4f534a) + encoded
result += struct.pack('<II', len(data), 0x004e4942) + data
output = ROOT / 'public/desert-canyon/canyon-pine.glb'
output.write_bytes(result)
manifest = {'source': str(source.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'output': str(output.relative_to(ROOT)), 'outputSha256': hashlib.sha256(result).hexdigest(),
            'trianglesRetained': len(indices) // 3, 'branchTriangles': len(bi)//3,
            'finalTriangles': triangle_count, 'verticesRetained': len(positions),
            'originalAtlasPreserved': True, 'distanceSubstitution': False,
            'authoring': 'Complete native trunk and leaf pieces rearranged into tapered branch whorls; leaf pieces duplicated for density; original UVs and atlas retained.'}
(output.parent / 'pine-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))
