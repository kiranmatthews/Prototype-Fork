#!/usr/bin/env python3
"""Fit original Meshy members and pack their paint into one local 1024px atlas.

Planks use a centred unit XYZ envelope. Timber and rope use local Y as the
length, from -.5 to .5, with their radial silhouette within [-1,1] in X/Z.
Node transforms and UV seams are preserved; credentials/remote URLs never ship.
"""
from pathlib import Path
import hashlib
import io
import json
import struct
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
WORK = ROOT / '.img2threejs/boardwalk'
PROMPTS = json.loads((HERE / 'prompts.json').read_text())
TASKS = json.loads((HERE / 'tasks.json').read_text())['tasks']
ATLAS_SIZE, TILE, PADDING = 1024, 336, 8
atlas = Image.new('RGB', (ATLAS_SIZE, ATLAS_SIZE), (193, 156, 103))
pack, manifest = {}, {}


def read_glb(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF'
    json_size = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + json_size])
    data = raw[28 + json_size:]

    def accessor(index):
        a = doc['accessors'][index]
        view = doc['bufferViews'][a['bufferView']]
        dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']])
        width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        return np.ndarray((a['count'], width), dtype=dtype, buffer=data,
            offset=view.get('byteOffset', 0) + a.get('byteOffset', 0),
            strides=(view.get('byteStride', dtype.itemsize * width), dtype.itemsize)).copy()

    def transform(node):
        if 'matrix' in node:
            return np.array(node['matrix']).reshape(4, 4).T
        x, y, z, w = node.get('rotation', [0, 0, 0, 1])
        m = np.eye(4)
        m[:3, :3] = np.array([
            [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
            [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
            [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)],
        ]) @ np.diag(node.get('scale', [1, 1, 1]))
        m[:3, 3] = node.get('translation', [0, 0, 0])
        return m

    chunks = []
    def visit(index, parent):
        node = doc['nodes'][index]
        m = parent @ transform(node)
        if 'mesh' in node:
            for part in doc['meshes'][node['mesh']]['primitives']:
                assert part.get('mode', 4) == 4, 'Triangle meshes required'
                pos = accessor(part['attributes']['POSITION'])
                pos = (np.c_[pos, np.ones(len(pos))] @ m.T)[:, :3]
                indices = accessor(part['indices']).ravel().astype(int) if 'indices' in part else np.arange(len(pos))
                if np.linalg.det(m[:3, :3]) < 0:
                    indices = indices.reshape(-1, 3)[:, [0, 2, 1]].ravel()
                uv = accessor(part['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in part['attributes'] else np.zeros((len(pos), 2))
                mat = doc.get('materials', [{}])[part.get('material', 0)].get('pbrMetallicRoughness', {})
                color = np.array(mat.get('baseColorFactor', [1, 1, 1, 1])[:3])
                image = Image.new('RGB', (16, 16), tuple(np.round(color * 255).astype(int)))
                if 'baseColorTexture' in mat:
                    tex = doc['textures'][mat['baseColorTexture']['index']]
                    view = doc['bufferViews'][doc['images'][tex['source']]['bufferView']]
                    offset = view.get('byteOffset', 0)
                    image = Image.open(io.BytesIO(data[offset:offset + view['byteLength']])).convert('RGB')
                    if not np.allclose(color, 1):
                        image = Image.fromarray(np.clip(np.array(image) * color, 0, 255).astype('uint8'))
                chunks.append((pos, indices, uv, image))
        for child in node.get('children', []):
            visit(child, m)
    for node in doc['scenes'][doc.get('scene', 0)]['nodes']:
        visit(node, np.eye(4))
    return raw, chunks


def fitted_positions(pos, family):
    # Principal axes remove incidental provider rotation. The thin plank's
    # normal remains its thickness axis, rather than an arbitrary GLB Y axis.
    centre = pos.mean(axis=0)
    _, axes = np.linalg.eigh(np.cov((pos-centre).T))
    long = axes[:, 2]
    if long[np.argmax(abs(long))] < 0:
        long = -long
    if family == 'plank':
        up = axes[:, 0]
        if up[np.argmax(abs(up))] < 0:
            up = -up
        basis = np.column_stack((long, up, np.cross(long, up)))
    else:
        right = np.array([1., 0., 0.])
        if abs(long[0]) > .9:
            right = np.array([0., 0., 1.])
        right -= long * np.dot(right, long)
        right /= np.linalg.norm(right)
        basis = np.column_stack((right, long, np.cross(right, long)))
    local = (pos-centre) @ basis
    lo, hi = local.min(axis=0), local.max(axis=0)
    size = hi-lo
    assert min(size) > 1e-6
    local -= (lo+hi)/2
    scale = 1/size if family == 'plank' else np.array([2/max(size[0], size[2]), 1/size[1], 2/max(size[0], size[2])])
    return local*scale, size.tolist(), basis.tolist()


for tile_index, (name, art) in enumerate(PROMPTS.items()):
    job = art.get('texturedJob', name+'-textured')
    path = WORK / job / 'downloads/model.glb'
    raw, chunks = read_glb(path)
    # A member's material parts share one provider texture. Verify rather than
    # accidentally mapping a second material onto the first material's paint.
    assert all(image.tobytes() == chunks[0][3].tobytes() for _, _, _, image in chunks), 'Different paint maps need separate atlas tiles'
    image = chunks[0][3]
    inner = TILE-2*PADDING
    image = image.resize((inner, inner), Image.Resampling.LANCZOS)
    ox, oy = (tile_index % 3)*TILE, (tile_index//3)*TILE
    # Replicate each border into the gutter for mipmaps and linear filtering.
    atlas.paste(image.resize((TILE, TILE)), (ox, oy))
    atlas.paste(image, (ox+PADDING, oy+PADDING))
    for dx in range(PADDING):
        atlas.paste(image.crop((0, 0, 1, inner)), (ox+dx, oy+PADDING))
        atlas.paste(image.crop((inner-1, 0, inner, inner)), (ox+TILE-1-dx, oy+PADDING))
        atlas.paste(image.crop((0, 0, inner, 1)), (ox+PADDING, oy+dx))
        atlas.paste(image.crop((0, inner-1, inner, inner)), (ox+PADDING, oy+TILE-1-dx))
    positions = np.concatenate([p for p, _, _, _ in chunks])
    fitted, source_size, source_basis = fitted_positions(positions, art['family'])
    uv = np.concatenate([uv for _, _, uv, _ in chunks])
    indices, offset = [], 0
    for pos, idx, _, _ in chunks:
        indices.extend((idx+offset).tolist())
        offset += len(pos)
    pixels = np.array(image)/255.
    # glTF texture images use a top-left image origin (flipY=false in runtime).
    sampled = pixels[np.clip((uv[:, 1]*inner).astype(int), 0, inner-1), np.clip((uv[:, 0]*inner).astype(int), 0, inner-1)]
    colors = np.where(sampled <= .04045, sampled/12.92, ((sampled+.055)/1.055)**2.4)
    atlas_uv = (uv*inner + np.array([ox+PADDING, oy+PADDING]))/ATLAS_SIZE
    pack[name] = {'family': art['family'], 'positions': fitted.round(6).ravel().tolist(),
        'indices': indices, 'uvs': atlas_uv.round(6).ravel().tolist(),
        'colors': colors.round(4).ravel().tolist()}
    manifest[name] = {'provider': 'Meshy', 'task': TASKS[job]['id'],
        'sourceSha256': hashlib.sha256(raw).hexdigest(), 'family': art['family'],
        'triangles': len(indices)//3, 'vertices': len(positions),
        'sourcePrincipalSize': source_size, 'sourceBasis': source_basis,
        'fittedBounds': {'min': fitted.min(axis=0).tolist(), 'max': fitted.max(axis=0).tolist()}}

output = ROOT / 'public/boardwalk'
output.mkdir(parents=True, exist_ok=True)
atlas.save(output / 'rustic-atlas.webp', quality=88, method=6)
source = '// Generated from nine original Meshy members by tools/boardwalk/bake_kit.py.\n'
source += 'export const BOARDWALK_MESH_DATA = '+json.dumps(pack, separators=(',', ':'))+';\n'
(ROOT / 'src/boardwalkMeshes.generated.ts').write_text(source)
manifest['atlas'] = {'path': 'boardwalk/rustic-atlas.webp', 'size': ATLAS_SIZE,
    'bytes': (output / 'rustic-atlas.webp').stat().st_size,
    'sha256': hashlib.sha256((output / 'rustic-atlas.webp').read_bytes()).hexdigest()}
(HERE / 'asset-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({name: entry.get('triangles', entry.get('bytes')) for name, entry in manifest.items()}))
