"""Complete the Tripo crate's bare underside with its own authored fasteners.

Keep all original geometry, UVs, normals and embedded PBR maps. Copy only
disconnected top fasteners, rotate them under the crate and seat each base on
the actual underside surface. No simplification or camera-dependent geometry.
"""
import collections
import json
import pathlib
import struct
import sys

source, destination = map(pathlib.Path, sys.argv[1:3])
data = source.read_bytes()
json_size = struct.unpack_from('<I', data, 12)[0]
doc = json.loads(data[20:20 + json_size])
binary_size = struct.unpack_from('<I', data, 20 + json_size)[0]
binary = bytearray(data[28 + json_size:28 + json_size + binary_size])
primitive = doc['meshes'][0]['primitives'][0]

def read(index, width):
    accessor = doc['accessors'][index]
    view = doc['bufferViews'][accessor['bufferView']]
    fmt = {5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', struct.calcsize('<' + fmt * width))
    return [struct.unpack_from('<' + fmt * width, binary, offset + i * stride)
            for i in range(accessor['count'])]

positions = read(primitive['attributes']['POSITION'], 3)
normals = read(primitive['attributes']['NORMAL'], 3)
uvs = read(primitive['attributes']['TEXCOORD_0'], 2)
indices = [row[0] for row in read(primitive['indices'], 1)]
parent = list(range(len(positions)))

def root(index):
    while parent[index] != index:
        parent[index] = parent[parent[index]]
        index = parent[index]
    return index

def join(a, b):
    parent[root(a)] = root(b)

welded = {}
for index, point in enumerate(positions):
    key = tuple(round(value, 5) for value in point)
    if key in welded:
        join(index, welded[key])
    else:
        welded[key] = index
triangles = [indices[i:i + 3] for i in range(0, len(indices), 3)]
for a, b, c in triangles:
    join(a, b)
    join(a, c)
groups = collections.defaultdict(list)
for triangle in triangles:
    groups[root(triangle[0])].append(triangle)

lo = [min(p[i] for p in positions) for i in range(3)]
hi = [max(p[i] for p in positions) for i in range(3)]
height = hi[1] - lo[1]

def underside_y(x, z):
    hits = []
    for triangle in triangles:
        a, b, c = (positions[i] for i in triangle)
        denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
        if abs(denominator) < 1e-10:
            continue
        u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator
        if u >= -1e-6 and v >= -1e-6 and u + v <= 1.000001:
            hits.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
    assert hits, 'Fastener has no underlying surface'
    return min(hits)

added_positions, added_normals, added_uvs, added_indices = [], [], [], []
fasteners = 0
for group in groups.values():
    vertices = sorted(set(i for triangle in group for i in triangle))
    points = [positions[i] for i in vertices]
    minimum = [min(p[i] for p in points) for i in range(3)]
    maximum = [max(p[i] for p in points) for i in range(3)]
    if minimum[1] < lo[1] + height * .94 or max(maximum[i] - minimum[i] for i in (0, 2)) > height * .14:
        continue
    if maximum[1] - minimum[1] > height * .06:
        continue
    rotated = [(p[0], lo[1] + hi[1] - p[1], lo[2] + hi[2] - p[2]) for p in points]
    x = sum(p[0] for p in rotated) / len(rotated)
    z = sum(p[2] for p in rotated) / len(rotated)
    offset = underside_y(x, z) - max(p[1] for p in rotated) + .001
    remap = {}
    for original, p in zip(vertices, rotated):
        remap[original] = len(added_positions)
        added_positions.append((p[0], p[1] + offset, p[2]))
        n = normals[original]
        added_normals.append((n[0], -n[1], -n[2]))
        added_uvs.append(uvs[original])
    added_indices.extend(remap[i] for triangle in group for i in triangle)
    fasteners += 1
assert fasteners >= 8, 'Expected the authored top rail and corner fasteners'

def append_accessor(rows, width, component, kind, target):
    while len(binary) % 4:
        binary.append(0)
    offset = len(binary)
    fmt = {5125: 'I', 5126: 'f'}[component]
    for row in rows:
        binary.extend(struct.pack('<' + fmt * width, *row))
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(binary) - offset, 'target': target})
    accessor = {'bufferView': view, 'componentType': component, 'count': len(rows), 'type': kind}
    if kind == 'VEC3':
        accessor['min'] = [min(row[i] for row in rows) for i in range(width)]
        accessor['max'] = [max(row[i] for row in rows) for i in range(width)]
    index = len(doc['accessors'])
    doc['accessors'].append(accessor)
    return index

attributes = {
    'POSITION': append_accessor(added_positions, 3, 5126, 'VEC3', 34962),
    'NORMAL': append_accessor(added_normals, 3, 5126, 'VEC3', 34962),
    'TEXCOORD_0': append_accessor(added_uvs, 2, 5126, 'VEC2', 34962),
}
index_accessor = append_accessor([(i,) for i in added_indices], 1, 5125, 'SCALAR', 34963)
doc['meshes'][0]['primitives'].append({'attributes': attributes, 'indices': index_accessor, 'material': primitive['material'], 'mode': 4})
doc['buffers'][0]['byteLength'] = len(binary)
while len(binary) % 4:
    binary.append(0)
text = json.dumps(doc, separators=(',', ':')).encode()
text += b' ' * (-len(text) % 4)
total = 28 + len(text) + len(binary)
output = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(text), 0x4E4F534A) + text + struct.pack('<II', len(binary), 0x004E4942) + binary
triangle_count = (len(indices) + len(added_indices)) // 3
assert triangle_count <= 8000, 'Completed metal crate exceeds its authoring budget'
destination.write_bytes(output)
print(json.dumps({'sourceTriangles': len(indices) // 3, 'copiedFasteners': fasteners, 'completedTriangles': triangle_count, 'bytes': len(output)}))
