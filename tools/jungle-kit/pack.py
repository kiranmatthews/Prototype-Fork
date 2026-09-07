"""Pack Meshy GLBs for the browser without changing topology or UVs.

Core glTF, one material, one 512/1024 base-color map. Sculpted geometry and
paint do the work; removing PBR microdetail keeps the plants simple and costs
one texture fetch. Authoring GLBs with all maps remain in .img2threejs.
"""
from pathlib import Path
import hashlib
import io
import json
import struct
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/jungle-kit'
OUT = ROOT / 'public/jungle-kit'
OUT.mkdir(parents=True, exist_ok=True)
PLANTS = {'broadleaf', 'palm', 'fern'}

def pack(name):
    raw = (WORK / (name + '.glb')).read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    doc = json.loads(raw[20:20 + length])
    binary = raw[28 + length:]
    assert len(doc['materials']) == 1 and len(doc['meshes']) == 1
    base_index = doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
    image_index = doc['textures'][base_index]['source']
    view = doc['bufferViews'][doc['images'][image_index]['bufferView']]
    image = Image.open(io.BytesIO(binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']])).convert('RGB')
    resolution = 512 if name in PLANTS or name == 'thorns' else 1024
    image.thumbnail((resolution, resolution), Image.Resampling.LANCZOS)
    compressed = io.BytesIO()
    image.save(compressed, 'JPEG', quality=90, optimize=True, subsampling=0)
    views, output = [], bytearray()
    def append(data, target=None):
        output.extend(b'\0' * ((-len(output)) % 4))
        v = {'buffer': 0, 'byteOffset': len(output), 'byteLength': len(data)}
        if target: v['target'] = target
        views.append(v); output.extend(data)
        return len(views)-1
    # Only accessors referenced by mesh primitives survive, and their vertex
    # bytes stay exact. Node transforms and source normals are preserved.
    for a in doc['accessors']:
        old = doc['bufferViews'][a['bufferView']]
        start = old.get('byteOffset', 0)
        idx = append(binary[start:start+old['byteLength']], old.get('target'))
        if 'byteStride' in old: views[idx]['byteStride'] = old['byteStride']
        a['bufferView'] = idx
    img_view = append(compressed.getvalue())
    doc['bufferViews'] = views
    doc['buffers'] = [{'byteLength': len(output)}]
    doc['images'] = [{'bufferView': img_view, 'mimeType': 'image/jpeg', 'name': name+'-basecolor'}]
    doc['textures'] = [{'source': 0, 'sampler': 0}]
    doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
    doc['materials'] = [{'name': 'Jungle '+name, 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 0.92},
        'doubleSided': name in PLANTS}]
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']: primitive['material'] = 0
    doc['asset']['generator'] = 'Meshy T2 / Codex Jungle Ruins web pack'
    doc['asset']['copyright'] = 'Created with Meshy and OpenAI image generation for the project owner.'
    doc['asset']['extras'] = {'sourceSha256': hashlib.sha256(raw).hexdigest(), 'textureSize': resolution}
    json_bytes = json.dumps(doc, separators=(',', ':')).encode()
    json_bytes += b' ' * ((-len(json_bytes)) % 4)
    output.extend(b'\0' * ((-len(output)) % 4))
    glb = struct.pack('<III', 0x46546c67, 2, 28+len(json_bytes)+len(output)) + struct.pack('<II', len(json_bytes), 0x4e4f534a) + json_bytes + struct.pack('<II', len(output), 0x004e4942) + output
    (OUT / (name+'.glb')).write_bytes(glb)
    triangles = sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    return {'name':name, 'triangles': triangles, 'bytes': len(glb), 'textureSize': resolution,
        'sourceSha256': hashlib.sha256(raw).hexdigest(), 'sha256': hashlib.sha256(glb).hexdigest()}

if __name__ == '__main__':
    names = sys.argv[1:] or ['broadleaf','palm','fern','log','thorns']
    report = [pack(n) for n in names]
    (OUT/'manifest.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))
