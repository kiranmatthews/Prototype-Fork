"""Pack original Meshy PBR maps while preserving UVs, geometry and both LODs."""
from pathlib import Path
from PIL import Image
import hashlib,io,json,struct,sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/hazards';OUT.mkdir(exist_ok=True)
for name in sys.argv[1:]:
    work=ROOT/'.img2threejs/hazards'/name
    raw=(work/(name+'-lods.glb')).read_bytes();length=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+length]);binary=raw[28+length:];packed=bytearray();views=[]
    images={im['bufferView']:i for i,im in enumerate(doc.get('images',[]))}
    normal=set();rough=set()
    for mat in doc['materials']:
        if 'normalTexture' in mat:normal.add(doc['textures'][mat['normalTexture']['index']]['source'])
        pbr=mat['pbrMetallicRoughness'];pbr['metallicFactor']=.62;pbr['roughnessFactor']=.82
        if 'metallicRoughnessTexture' in pbr:rough.add(doc['textures'][pbr['metallicRoughnessTexture']['index']]['source'])
    for i,view in enumerate(doc['bufferViews']):
        offset=view.get('byteOffset',0);data=binary[offset:offset+view['byteLength']]
        if i in images:
            image_id=images[i];im=Image.open(io.BytesIO(data)).convert('RGB')
            size=1024 if image_id in normal else 512 if image_id in rough else (2048 if name=='iron-weight' else 1024)
            im.thumbnail((size,size),Image.Resampling.LANCZOS);out=io.BytesIO();im.save(out,format='JPEG',quality=95,optimize=True)
            data=out.getvalue();doc['images'][image_id]['mimeType']='image/jpeg'
        packed.extend(b'\0'*(-len(packed)%4));views.append({**view,'byteOffset':len(packed),'byteLength':len(data)});packed.extend(data)
    doc['bufferViews']=views;doc['buffers']=[{'byteLength':len(packed)}]
    source_hash=hashlib.sha256((work/(name+'-source.glb')).read_bytes()).hexdigest()
    doc['asset']={'version':'2.0','generator':'Meshy Smart Topology / shared hazard web pack',
        'copyright':'Created with Meshy and OpenAI image generation for the project owner.',
        'extras':{'sourceSha256':source_hash,'lods':2}}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4);packed.extend(b'\0'*(-len(packed)%4))
    glb=struct.pack('<III',0x46546c67,2,28+len(js)+len(packed))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(packed),0x004e4942)+packed
    (OUT/(name+'.glb')).write_bytes(glb)
    report={**json.loads((work/'geometry.json').read_text()),'provider':'Meshy','sourceSha256':source_hash,
        'sha256':hashlib.sha256(glb).hexdigest(),'bytes':len(glb),'albedoResolution':2048 if name=='iron-weight' else 1024,'normalResolution':1024}
    (OUT/(name+'-manifest.json')).write_text(json.dumps(report,indent=2)+'\n');print(name,report)
