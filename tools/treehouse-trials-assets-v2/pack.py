"""Keep Meshy geometry/UVs and budget hero/repeated painted texture atlases."""
from pathlib import Path
import hashlib
import io
import json
import os
import struct
import sys
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
KIT = os.environ.get('TREEHOUSE_ASSET_KIT', 'treehouse-trials-v2')
WORK = ROOT / '.img2threejs' / KIT
OUT = ROOT / 'public' / KIT
name = sys.argv[1]
spec=json.loads((ROOT/'tools'/KIT/'specs.json').read_text())[name]
albedo_resolution = 2048 if spec['hero'] else 1024
normal_resolution = albedo_resolution // 2
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
def values(index):
    accessor=doc['accessors'][index]
    old=doc['bufferViews'][accessor['bufferView']]
    start=old.get('byteOffset',0)+accessor.get('byteOffset',0)
    columns={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[accessor['type']]
    fmt,width={5121:('B',1),5123:('H',2),5125:('I',4),5126:('f',4)}[accessor['componentType']]
    stride=old.get('byteStride',columns*width)
    result=[struct.unpack_from('<'+fmt*columns,binary,start+i*stride) for i in range(accessor['count'])]
    if accessor.get('normalized'):
        divisor={5121:255,5123:65535}[accessor['componentType']]
        result=[tuple(v/divisor for v in row) for row in result]
    return result
custom=[]
# Gather the temporary Blender AO channel and source-space leaf/cloth flex
# before remapping bufferViews. Custom attributes are appended as floats later.
pbr=source_material['pbrMetallicRoughness']
base_image=doc['images'][doc['textures'][pbr['baseColorTexture']['index']]['source']]
base_view=doc['bufferViews'][base_image['bufferView']]
source_image=Image.open(io.BytesIO(binary[base_view.get('byteOffset',0):base_view.get('byteOffset',0)+base_view['byteLength']])).convert('RGB')
for mesh in doc['meshes']:
    for primitive in mesh['primitives']:
        attributes=primitive['attributes']
        xyz=values(attributes['POSITION']);uv=values(attributes['TEXCOORD_0'])
        lower=[min(p[i] for p in xyz) for i in range(3)];upper=[max(p[i] for p in xyz) for i in range(3)]
        normalized=[tuple((p[i]-lower[i])/max(1e-8,upper[i]-lower[i]) for i in range(3)) for p in xyz]
        color=values(attributes['COLOR_0']) if 'COLOR_0' in attributes else [(1,1,1,1)]*len(xyz)
        ao=[max(.8,min(1,c[0])) for c in color]
        flex=[]
        for p,texcoord in zip(normalized,uv):
            if spec.get('cloth'):
                # All four attachment corners stay fixed. Only free front
                # centre fabric gets full vertical billow.
                value=(p[2]**1.7)*(max(0,1-abs(p[0]-.5)*2)**.55)
            elif spec['wind']:
                x=min(source_image.width-1,max(0,int(texcoord[0]*source_image.width)))
                # glTF UV v=0 addresses the image's first (upper) row.
                y=min(source_image.height-1,max(0,int(texcoord[1]*source_image.height)))
                r,g,b=source_image.getpixel((x,y))
                green=g>r*1.10 and g>b*1.10 and g>38
                red=(name.startswith('fern-') or name.startswith('groundcover-')) and r>g*1.15 and r>b*1.15 and r>45
                bottom=min(1,max(0,p[1]/.18))
                value=(1 if green or red else 0)*bottom
                if name.startswith('tree-'):value*=min(1,max(0,(p[1]-.34)/.30))
            else:value=0
            if spec.get('hangingVines'):
                x,y,z=p[0]-.5,p[1],p[2]-.5
                on_vine=(abs(x+.185)<.04 and abs(z-.15)<.045 or abs(x+.09)<.04 and abs(z-.01)<.04
                    or abs(x+.042)<.035 and -.105<z<-.015 or abs(x-.16)<.045 and abs(z)<.04)
                value=.35*min(1,max(0,(.6-y)/.55)) if on_vine and y<.6 else value*.45
            flex.append(value)
        custom.append((attributes,ao,flex))
        attributes.pop('COLOR_0',None)
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
for attributes,ao,flex in custom:
    for label,series in [('_JUNGLE_AO',ao),('_WIND_FLEX',flex)]:
        index=len(doc['accessors'])
        view=append(struct.pack('<'+'f'*len(series),*series),34962)
        doc['accessors'].append({'bufferView':view,'componentType':5126,'count':len(series),
            'type':'SCALAR','min':[min(series)],'max':[max(series)]})
        attributes[label]=index
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
material = {'name': 'Treehouse Trials V2 reference-painted environment atlas', 'doubleSided': spec['wind'],
    'pbrMetallicRoughness': {'baseColorTexture': {'index': texture(pbr['baseColorTexture']['index'], albedo_resolution, name + '-albedo', 95)},
    'metallicFactor': 0, 'roughnessFactor': .91}}
if 'normalTexture' in source_material:
    material['normalTexture'] = {'index': texture(source_material['normalTexture']['index'], normal_resolution, name + '-normal', 96), 'scale': .18}
doc['materials'] = [material]
doc['bufferViews'] = views
doc['images'] = images
doc['textures'] = textures
doc['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
doc['buffers'] = [{'byteLength': len(packed)}]
doc.pop('extensionsUsed', None)
doc.pop('extensionsRequired', None)
source_name = name
source_hash = hashlib.sha256((WORK / (source_name + '-source.glb')).read_bytes()).hexdigest()
doc['asset'] = {'version': '2.0', 'generator': 'Meshy Smart Topology / Treehouse Trials V2 surface-measured web pack',
    'copyright': 'Created with Meshy and OpenAI image generation for the project owner.',
    'extras': {'sourceSha256': source_hash, 'lods': 2, 'albedoResolution': albedo_resolution, 'normalResolution': normal_resolution}}
js = json.dumps(doc, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
packed.extend(b'\0' * (-len(packed) % 4))
glb = struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(packed)) + struct.pack('<II', len(js), 0x4e4f534a) + js + struct.pack('<II', len(packed), 0x004e4942) + packed
(OUT / (name + '.glb')).write_bytes(glb)
report = {'name': name, **json.loads((WORK / (name + '-geometry.json')).read_text()), 'bytes': len(glb),
    'sha256': hashlib.sha256(glb).hexdigest(), 'sourceSha256': source_hash,
    'albedoResolution': albedo_resolution, 'normalResolution': normal_resolution}
(OUT / (name + '-manifest.json')).write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: report[k] for k in ['name', 'triangles', 'lodTriangles', 'bytes', 'sha256']}, indent=2))
