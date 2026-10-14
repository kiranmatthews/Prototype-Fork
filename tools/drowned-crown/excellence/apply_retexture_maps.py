"""Transfer a verified original-UV retexture onto both original fitted LODs."""
from pathlib import Path
import sys,json,copy,hashlib,itertools
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb
name=sys.argv[1];specs=json.loads((HERE/'assets.json').read_text());spec=specs[name]
source=ROOT/spec['retextureSource'];input_path=ROOT/spec['retextureInput'];paint_path=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(name+'-textured/downloads/model.glb')
original=Glb(source);submitted=Glb(input_path);paint=Glb(paint_path)
def points_uv(g):
    p=g.document['meshes'][0]['primitives'][0];pos=g.read_accessor(p['attributes']['POSITION']).astype(float);uv=g.read_accessor(p['attributes']['TEXCOORD_0']).astype(float)
    norm=(pos-(pos.max(0)+pos.min(0))/2)/(np.ptp(pos,axis=0).max()/2)
    return np.c_[norm,uv]
def correspondence(x,y):
    bins={}
    for i,key in enumerate(np.rint(y[:,:3]*10000).astype(int)):bins.setdefault(tuple(key),[]).append(i)
    errors=[]
    for p in x:
        key=tuple(np.rint(p[:3]*10000).astype(int));ids=bins.get(key,[])
        if not ids:ids=[i for delta in itertools.product([-1,0,1],repeat=3) for i in bins.get(tuple(key[k]+delta[k] for k in range(3)),[])]
        assert ids,'Retexture changed the source surface'
        errors.append(float(np.linalg.norm(y[ids]-p,axis=1).min()))
    assert max(errors)<1e-4,('Retexture did not preserve the UV surface',max(errors))
    return max(errors)
a,b=points_uv(submitted),points_uv(paint);errors=[correspondence(a,b),correspondence(b,a)]
def geometry_hashes(g):
    return [{key:hashlib.sha256(g.read_accessor(value).tobytes()).hexdigest() for key,value in {**p['attributes'],'indices':p['indices']}.items()} for m in g.document['meshes'] for p in m['primitives']]
before=geometry_hashes(original);d=original.document;pd=paint.document
assert len(pd['materials'])==1 and len(d['materials'])==1
images=[]
for image in pd['images']:
    view=pd['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0);blob=paint.binary[offset:offset+view['byteLength']]
    while len(original.binary)%4:original.binary.append(0)
    index=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(original.binary),'byteLength':len(blob)});original.binary.extend(blob)
    images.append({**copy.deepcopy(image),'bufferView':index})
d['images']=images
for key in ['materials','textures','samplers']:
    if key in pd:d[key]=copy.deepcopy(pd[key])
    else:d.pop(key,None)
# Discard superseded image storage while preserving every geometry byte.
used={a['bufferView'] for a in d['accessors']}|{i['bufferView'] for i in d['images']};views=[];mapping={};packed=bytearray()
for index in sorted(used):
    view=copy.deepcopy(d['bufferViews'][index]);offset=view.get('byteOffset',0);blob=original.binary[offset:offset+view['byteLength']]
    while len(packed)%4:packed.append(0)
    mapping[index]=len(views);view.update(buffer=0,byteOffset=len(packed));views.append(view);packed.extend(blob)
for accessor in d['accessors']:accessor['bufferView']=mapping[accessor['bufferView']]
for image in d['images']:image['bufferView']=mapping[image['bufferView']]
d['bufferViews']=views;original.binary=packed
assert geometry_hashes(original)==before,'Texture transfer altered fitted geometry'
task=json.loads((HERE/'tasks.json').read_text())['tasks'][name+'-textured']
d['asset']['extras']={**d['asset'].get('extras',{}),'textureTaskId':task['id'],'geometryAndBothLODsUnchanged':True}
target=ROOT/'.img2threejs/drowned-crown/excellence/prepared'/(name+'.glb');original.save(target)
report={'source':spec['retextureSource'],'textureTaskId':task['id'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'textureOutputSha256':hashlib.sha256(paint_path.read_bytes()).hexdigest(),'maxNormalizedPositionAndUVError':max(errors),'geometryAndUVsAndNormalsAndIndicesByteIdentical':True,'retainedLODs':len(d['meshes']),'geometryHashes':before}
(HERE/(name+'-transfer.json')).write_text(json.dumps(report,indent=2)+'\n')
manifest=json.loads((HERE/'asset-manifest.json').read_text())
spec['size']=spec.get('sourceRuntimeSize') or manifest[source.stem]['size']
spec.update(production=True,sourceTaskId=task['id'],lodRange=spec.get('lodRange',[250,300]),doubleSided=True)
(HERE/'assets.json').write_text(json.dumps(specs,indent=2)+'\n');print(json.dumps(report))
