"""Pack generated props; resize embedded textures without changing their art."""
import io,json,struct,sys
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/carlisle-coast';OUT=ROOT/'public/carlisle-kit';OUT.mkdir(exist_ok=True)
for name in sys.argv[1:]:
    raw=(WORK/(name+'.glb')).read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n]);bstart=28+n;binary=bytearray(raw[bstart:])
    color={m.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index') for m in doc['materials']}
    normal={m.get('normalTexture',{}).get('index') for m in doc['materials']}
    used=color|normal; used.discard(None)
    image_ids={doc['textures'][i]['source']:i in color for i in used}
    # Original geometry views stay byte-identical; replace only image payloads.
    geo_end=max(v.get('byteOffset',0)+v['byteLength'] for i,v in enumerate(doc['bufferViews']) if i not in {im.get('bufferView') for im in doc['images']})
    binary=binary[:geo_end];binary.extend(b'\0'*(-len(binary)%4))
    new_images=[];image_map={}
    for iid,iscolor in image_ids.items():
        im=doc['images'][iid];v=doc['bufferViews'][im['bufferView']];offset=v.get('byteOffset',0)
        image=Image.open(io.BytesIO(raw[bstart+offset:bstart+offset+v['byteLength']])).convert('RGB');image.thumbnail((1024,1024) if iscolor else (512,512),Image.Resampling.LANCZOS)
        buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=93,subsampling=0);data=buffer.getvalue()
        view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)})
        binary.extend(data);binary.extend(b'\0'*(-len(binary)%4));image_map[iid]=len(new_images)
        new_images.append({'bufferView':view,'mimeType':'image/jpeg','name':im.get('name',name)})
    texmap={};textures=[]
    for i in sorted(used):
        t=doc['textures'][i].copy();t['source']=image_map[t['source']];texmap[i]=len(textures);textures.append(t)
    for m in doc['materials']:
        p=m.setdefault('pbrMetallicRoughness',{});p.pop('metallicRoughnessTexture',None);m.pop('occlusionTexture',None);m.pop('emissiveTexture',None)
        p['metallicFactor']=0;p['roughnessFactor']=.8;m['emissiveFactor']=[0,0,0]
        if 'baseColorTexture' in p:p['baseColorTexture']['index']=texmap[p['baseColorTexture']['index']]
        if 'normalTexture' in m:m['normalTexture']['index']=texmap[m['normalTexture']['index']]
    # Prune unreachable image bufferViews: old views may extend beyond rebuilt BIN.
    referenced=set()
    for accessor in doc['accessors']:
        if 'bufferView' in accessor:referenced.add(accessor['bufferView'])
    referenced.update(im['bufferView'] for im in new_images)
    vmap={old:i for i,old in enumerate(sorted(referenced))};doc['bufferViews']=[doc['bufferViews'][i] for i in sorted(referenced)]
    for accessor in doc['accessors']:
        if 'bufferView' in accessor:accessor['bufferView']=vmap[accessor['bufferView']]
    for im in new_images:im['bufferView']=vmap[im['bufferView']]
    doc['images']=new_images;doc['textures']=textures;doc['buffers']=[{'byteLength':len(binary)}]
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
    output=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    (OUT/(name+'.glb')).write_bytes(output);print(name,len(output),'bytes')
