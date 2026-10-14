"""Reuse the existing painted plank's low mesh and original atlas verbatim."""
from pathlib import Path
import sys,json,hashlib,numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb
from prepare_meshy_walk import matrices
source=ROOT/'public/treehouse-trials-v2/plank.glb';g=Glb(source);d=g.document;worlds=matrices(d)
index=next(i for i,n in enumerate(d['nodes']) if 'mesh' in n and n.get('name','').endswith('LOD1'))
prim=d['meshes'][d['nodes'][index]['mesh']]['primitives'][0];a=prim['attributes'];p=g.read_accessor(a['POSITION']);w=worlds[index];p=(np.c_[p,np.ones(len(p))]@w.T)[:,:3]
n=g.read_accessor(a['NORMAL'])@np.linalg.inv(w[:3,:3]);uv=g.read_accessor(a['TEXCOORD_0']);ids=g.read_accessor(prim['indices']).ravel()
lo=p.min(0);hi=p.max(0);span=hi-lo
if span[2]>span[0]:
 rotation=np.array([[0,0,1],[0,1,0],[-1,0,0]]);p=p@rotation;n=n@rotation;lo=p.min(0);hi=p.max(0);span=hi-lo
p=(p-(lo+hi)/2)/span;n=n*span;n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-8)
data={'positions':p.round(7).ravel().tolist(),'normals':n.round(7).ravel().tolist(),'uvs':uv.round(7).ravel().tolist(),'indices':ids.tolist()}
(ROOT/'src/drownedPlank.generated.ts').write_text('/** Existing Treehouse Trials plank; original UVs and measured unit bounds. */\nexport const DROWNED_PLANK_DATA='+json.dumps(data,separators=(',',':'))+' as const;\n')
material=d['materials'][prim.get('material',0)];out=ROOT/'public/boardwalk';saved=[]
for label,info in [('color',material['pbrMetallicRoughness']['baseColorTexture']),('normal',material.get('normalTexture'))]:
 if not info:continue
 texture=d['textures'][info['index']];img=d['images'][texture['source']];assert img['mimeType'] in ['image/jpeg','image/png']
 view=d['bufferViews'][img['bufferView']];data=bytes(g.binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);ext='jpg' if img['mimeType']=='image/jpeg' else 'png'
 path=out/f'drowned-plank-{label}.{ext}';path.write_bytes(data);saved.append(str(path.relative_to(ROOT)))
report={'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'triangles':len(ids)//3,'vertices':len(p),'originalUVs':True,'originalTextureBytes':True,'newProviderCredits':0,'images':saved}
(HERE/'reused-plank.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
