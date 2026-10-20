"""Pack the supplied Meshy OBJ/MTL/PNG zip as one indexed, textured GLB.

Usage: python prepare_asset.py /path/to/Meshy_export.zip
Requires NumPy and Pillow. Preserve the source mesh, normals and UV seams; resize only
the colour atlas. The game owns the pickup's uniform scale and placement.
"""
import hashlib
import io
import json
import struct
import sys
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[2]
source = Path(sys.argv[1])
with ZipFile(source) as archive:
    def entry(suffix):
        names = [n for n in archive.namelist() if n.lower().endswith(suffix)]
        assert len(names) == 1, f"Expected one {suffix} file"
        return names[0], archive.read(names[0])
    obj_name, obj_bytes = entry('.obj')
    _, material_bytes = entry('.mtl')
    image_name, image_bytes = entry('.png')
assert 'map_Kd ' in material_bytes.decode(), 'Expected the supplied colour atlas'
positions, normals, uvs, vertices, indices, lookup = [], [], [], [], [], {}
for line in obj_bytes.decode().splitlines():
    parts = line.split()
    if not parts:
        continue
    if parts[0] == 'v':
        positions.append(tuple(map(float, parts[1:4])))
    elif parts[0] == 'vn':
        normals.append(tuple(map(float, parts[1:4])))
    elif parts[0] == 'vt':
        uvs.append(tuple(map(float, parts[1:3])))
    elif parts[0] == 'f':
        face = []
        for corner in parts[1:]:
            if corner not in lookup:
                vi, ti, ni = (int(value) - 1 for value in corner.split('/'))
                assert min(vi, ti, ni) >= 0, 'Expected positive OBJ indices'
                u, v = uvs[ti]
                lookup[corner] = len(vertices)
                # glTF images use a top-left origin; OBJ UVs use bottom-left.
                vertices.append((*positions[vi], *normals[ni], u, 1 - v))
            face.append(lookup[corner])
        for i in range(1, len(face) - 1):
            indices.extend((face[0], face[i], face[i + 1]))
assert vertices and indices and len(vertices) < 65536
image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
original_size = list(image.size)
# Average light, not gamma-encoded RGB: thin bright markings remain readable
# without turning the high-contrast neon borders into dark jagged fringes.
ratio = min(1, 1024 / max(image.size))
target_size = tuple(max(1, round(n * ratio)) for n in image.size)
pixels = np.asarray(image)
srgb = np.arange(256, dtype=np.float32) / 255
linear_lut = np.where(srgb <= .04045, srgb / 12.92, ((srgb + .055) / 1.055) ** 2.4)
channels = []
for channel in range(3):
    linear = Image.fromarray(linear_lut[pixels[:, :, channel]])
    channels.append(np.asarray(linear.resize(target_size, Image.Resampling.LANCZOS)))
linear = np.clip(np.stack(channels, axis=2), 0, 1)
srgb = np.where(linear <= .0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - .055)
image = Image.fromarray(np.round(srgb * 255).astype(np.uint8))
# Restore a little small-scale contrast, with a hard halo limit. Thresholding
# leaves smooth colour/glow gradients alone; mipmaps handle distance filtering.
base = np.asarray(image).astype(np.int16)
sharpened = np.asarray(image.filter(ImageFilter.UnsharpMask(radius=.65, percent=40, threshold=3))).astype(np.int16)
image = Image.fromarray(np.clip(base + np.clip(sharpened - base, -8, 8), 0, 255).astype(np.uint8))
encoded = io.BytesIO()
image.save(encoded, format='JPEG', quality=94, optimize=True, subsampling=0)
payload, views = bytearray(), []
def buffer_view(data, **options):
    payload.extend(b'\0' * (-len(payload) % 4))
    views.append({'buffer': 0, 'byteOffset': len(payload), 'byteLength': len(data), **options})
    payload.extend(data)
    return len(views) - 1
vertex_view = buffer_view(b''.join(struct.pack('<8f', *v) for v in vertices), byteStride=32, target=34962)
index_view = buffer_view(struct.pack(f'<{len(indices)}H', *indices), target=34963)
image_view = buffer_view(encoded.getvalue())
minimum = [min(v[axis] for v in vertices) for axis in range(3)]
maximum = [max(v[axis] for v in vertices) for axis in range(3)]
digest = lambda data: hashlib.sha256(data).hexdigest()
provenance = {
    'source': 'User-supplied Meshy Neon Trial Timer export',
    'archive': source.name, 'archiveSha256': digest(source.read_bytes()),
    'obj': Path(obj_name).name, 'objSha256': digest(obj_bytes),
    'texture': Path(image_name).name, 'textureSha256': digest(image_bytes),
    'changes': 'Original positions, normals, UV seams and triangles; OBJ-to-glTF UV origin conversion; 1024px JPEG colour atlas. No remeshing.',
    'triangles': len(indices) // 3, 'sourceVertices': len(positions), 'glbVertices': len(vertices),
    'sourceTextureSize': original_size, 'textureSize': list(image.size),
    'textureFilter': {'downsample': 'linear-light Lanczos', 'sharpenRadius': .65, 'sharpenPercent': 40,
                      'sharpenThreshold': 3, 'maxSharpenDelta': 8, 'jpegQuality': 94, 'chromaSubsampling': '4:4:4',
                      'runtime': 'trilinear mipmaps and 8x anisotropy'},
    'sourceBounds': {'min': minimum, 'max': maximum},
}
document = {
    'asset': {'version': '2.0', 'generator': 'Prototype Fork trial-clock OBJ packer', 'extras': provenance},
    'scene': 0, 'scenes': [{'nodes': [0]}],
    'nodes': [{'name': 'Neon Trial Timer', 'mesh': 0}],
    'meshes': [{'name': 'Meshy Neon Trial Timer', 'primitives': [{'attributes': {'POSITION': 0, 'NORMAL': 1, 'TEXCOORD_0': 2}, 'indices': 3, 'material': 0}]}],
    'materials': [{'name': 'Neon timer painted atlas', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .8}}],
    'textures': [{'source': 0, 'sampler': 0}],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
    'images': [{'name': 'Neon timer colour', 'bufferView': image_view, 'mimeType': 'image/jpeg'}],
    'accessors': [
        {'bufferView': vertex_view, 'byteOffset': 0, 'componentType': 5126, 'count': len(vertices), 'type': 'VEC3', 'min': minimum, 'max': maximum},
        {'bufferView': vertex_view, 'byteOffset': 12, 'componentType': 5126, 'count': len(vertices), 'type': 'VEC3'},
        {'bufferView': vertex_view, 'byteOffset': 24, 'componentType': 5126, 'count': len(vertices), 'type': 'VEC2'},
        {'bufferView': index_view, 'componentType': 5123, 'count': len(indices), 'type': 'SCALAR'},
    ],
    'bufferViews': views, 'buffers': [{'byteLength': len(payload)}],
}
header = json.dumps(document, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
payload += b'\0' * (-len(payload) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 28 + len(header) + len(payload)) + struct.pack('<II', len(header), 0x4E4F534A) + header + struct.pack('<II', len(payload), 0x004E4942) + payload
output = root / 'public/props/trial-clock'
output.mkdir(parents=True, exist_ok=True)
(output / 'neon-trial-timer.glb').write_bytes(glb)
provenance.update({'output': 'neon-trial-timer.glb', 'outputBytes': len(glb), 'outputSha256': digest(glb)})
(output / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print(json.dumps(provenance, indent=2))
