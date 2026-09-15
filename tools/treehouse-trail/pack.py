"""Keep Meshy geometry/UVs and the detailed 2K color / 1K normal atlases."""
from pathlib import Path
import hashlib
import io
import json
import struct
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/treehouse-trail'
OUT = ROOT / 'public/treehouse-trail'
name = sys.argv[1]
assert name in {'body', 'body-v2', 'balcony', 'stairs', 'landing', 'tree', 'bush', 'host', 'balcony-deck', 'canopy'}
raw = (WORK / (name + '-lods.glb')).read_bytes()
n = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+n])
binary = raw[28+n:]
assert len(doc['materials']) == 1
source_material = doc['materials'][0]
views, packed = [], bytearray()
def append(data, target=None):
    packed.extend(b'\0' * (-len(packed) % 4))
    view = {'buffer': 0, 'byteOffset': len(packed), 'byteLength': len(data)}
    if target:
        view['target'] = target
    views.append(view)
    packed.extend(data)
    return len(views) - 1
mapping = {}
for accessor in doc['accessors']:
    old_id = accessor['bufferView']
    if old_id not in mapping:
        old = doc['bufferViews'][old_id]
        start = old.get('byteOffset', 0)
        new = append(binary[start:start + old['byteLength']], old.get('target'))
        if 'byteStride' in old:
            views[new]['byteStride'] = old['byteStride']
        mapping[old_id] = new
    accessor['bufferView'] = mapping[old_id]
images, textures = [], []
def texture(index, resolution, name, quality):
    definition = doc['images'][doc['textures'][index]['source']]
    old = doc['bufferViews'][definition['bufferView']]
    start = old.get('byteOffset', 0)
    image = Image.open(io.BytesIO(binary[start:start + old['byteLength']])).convert('RGB')
    image.thumbnail((resolution, resolution), Image.Resampling.LANCZOS)
    encoded = io.BytesIO()
    image.save(encoded, 'JPEG', quality=quality, subsampling=0, optimize=True)
    images.append({'name': name, 'bufferView': append(encoded.getvalue()), 'mimeType': 'image/jpeg'})
    textures.append({'source': len(images)-1, 'sampler': 0})
    return len(textures)-1
pbr = source_material['pbrMetallicRoughness']
material = {'name': 'Treehouse Trail painted wood and leaves', 'doubleSided': False,
    'pbrMetallicRoughness': {'baseColorTexture': {'index': texture(pbr['baseColorTexture']['index'], 2048, name + '-albedo', 95)},
    'metallicFactor': 0, 'roughnessFactor': .91}}
if 'normalTexture' in source_material:
    material['normalTexture'] = {'index': texture(source_material['normalTexture']['index'], 1024, name + '-normal', 96), 'scale': .18}
doc['materials'] = [material]
doc['bufferViews'] = views
doc['images'] = images
doc['textures'] = textures
doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
doc['buffers'] = [{'byteLength': len(packed)}]
doc.pop('extensionsUsed', None)
doc.pop('extensionsRequired', None)
source_name = {'balcony-deck': 'balcony', 'canopy': 'tree'}.get(name, name)
source_hash = hashlib.sha256((WORK / (source_name + '-source.glb')).read_bytes()).hexdigest()
doc['asset'] = {'version': '2.0', 'generator': 'Meshy Smart Topology / Treehouse Trail web pack',
    'copyright': 'Created with Meshy and OpenAI image generation for the project owner.',
    'extras': {'sourceSha256': source_hash, 'lods': 2, 'albedoResolution': 2048, 'normalResolution': 1024}}
js = json.dumps(doc, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
packed.extend(b'\0' * (-len(packed) % 4))
glb = struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(packed)) + struct.pack('<II', len(js), 0x4e4f534a) + js + struct.pack('<II', len(packed), 0x004e4942) + packed
(OUT / (name + '.glb')).write_bytes(glb)
report = {'name': name, **json.loads((WORK / (name + '-geometry.json')).read_text()), 'bytes': len(glb),
    'sha256': hashlib.sha256(glb).hexdigest(), 'sourceSha256': source_hash,
    'albedoResolution': 2048, 'normalResolution': 1024}
(OUT / (name + '-manifest.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['name', 'triangles', 'lodTriangles', 'bytes', 'sha256']}, indent=2))
