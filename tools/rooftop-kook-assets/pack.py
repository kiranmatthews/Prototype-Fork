"""Pack portable JPEG atlases into component GLBs without changing meshes."""
from pathlib import Path
import hashlib
import io
import json
import struct
import sys
from PIL import Image

ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'.img2threejs/rooftop-kook';OUT=ROOT/'public/rooftop-kook'
for name in sys.argv[1:]:
    source=WORK/(name+'-native.glb');raw=source.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n]);binary=raw[28+n:];images={i['bufferView']:i for i in doc.get('images',[])}
    packed=bytearray();resolution=2048
    for index,view in enumerate(doc['bufferViews']):
        data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        if index in images:
            im=Image.open(io.BytesIO(data)).convert('RGB');im.thumbnail((resolution,resolution),Image.Resampling.LANCZOS)
            buffer=io.BytesIO();im.save(buffer,'JPEG',quality=93,optimize=True);data=buffer.getvalue()
            images[index]['mimeType']='image/jpeg'
        packed.extend(b'\0'*(-len(packed)%4));view['byteOffset']=len(packed);view['byteLength']=len(data);packed.extend(data)
    for mat in doc['materials']:
        pbr=mat['pbrMetallicRoughness'];pbr['metallicFactor']=0;pbr['roughnessFactor']=.88
        mat.pop('normalTexture',None);mat.pop('occlusionTexture',None);pbr.pop('metallicRoughnessTexture',None)
    for sampler in doc.get('samplers',[]):sampler['minFilter']=9987;sampler['magFilter']=9729
    doc['asset']['generator']='Rooftop coastal Meshy web pack (source geometry and UVs preserved)'
    doc['buffers']=[{'byteLength':len(packed)}]
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*(-len(data)%4);packed.extend(b'\0'*(-len(packed)%4))
    final=struct.pack('<III',0x46546c67,2,28+len(data)+len(packed))+struct.pack('<II',len(data),0x4e4f534a)+data+struct.pack('<II',len(packed),0x004e4942)+packed
    target=OUT/(name+'.glb');target.write_bytes(final)
    manifest=json.loads((OUT/(name+'.json')).read_text());manifest.update(bytes=len(final),sha256=hashlib.sha256(final).hexdigest(),atlasResolution=resolution)
    (OUT/(name+'.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'name':name,'bytes':len(final),'resolution':resolution}))
