from pathlib import Path
import sys, copy, json, hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
source=ROOT/'public/drowned-crown/treasure-hoard.glb'
g=Glb(source);d=g.document;meshes=[];counts=[];bounds=[]
for mesh in d['meshes']:
    p=copy.deepcopy(mesh['primitives'][0]);v=g.read_accessor(p['attributes']['POSITION'])
    ix=g.read_accessor(p['indices']).ravel().reshape(-1,3)
    # Select complete connected coin/gem objects, never sliced triangles.
    # UV seam duplicates are joined only for component discovery; the output
    # keeps the source per-corner attributes and original PBR material.
    _,weld=np.unique(v.round(5),axis=0,return_inverse=True)
    parent=list(range(weld.max()+1))
    def find(a):
        while parent[a]!=a:
            parent[a]=parent[parent[a]];a=parent[a]
        return a
    for tri in weld[ix]:
        a=find(tri[0]);parent[find(tri[1])]=a;parent[find(tri[2])]=a
    labels=np.array([find(a) for a in weld[ix[:,0]]]);mask=np.zeros(len(ix),dtype=bool)
    for label in np.unique(labels):
        faces=labels==label;points=v[ix[faces].ravel()];lo=points.min(0);hi=points.max(0)
        if lo[2]>.07 and hi[1]<-.24 and hi[1]-lo[1]<.09 and max(hi[0]-lo[0],hi[2]-lo[2])<.22:
            mask|=faces
    ix=ix[mask];used,remap=np.unique(ix,return_inverse=True)
    assert len(ix)>100, len(ix)
    p['indices']=g.add_accessor(remap.astype('<u4').reshape(-1,1),5125,'SCALAR',34963)
    for name,accessor in list(p['attributes'].items()):
        values=g.read_accessor(accessor)[used]
        p['attributes'][name]=g.add_accessor(values,5126,d['accessors'][accessor]['type'],34962)
        assert np.isfinite(values).all()
        if name=='POSITION':
            d['accessors'][p['attributes'][name]].update(min=values.min(0).tolist(),max=values.max(0).tolist())
    meshes.append({'name':'Coin_spill_LOD'+str(len(meshes)),'primitives':[p]})
    counts.append(len(ix));bounds.append({'min':v[used].min(0).tolist(),'max':v[used].max(0).tolist()})
d['meshes']=meshes
for i,n in enumerate(d['nodes']):n['name']='Coin_spill_LOD'+str(i)
d['asset']['extras']={**d['asset'].get('extras',{}),'derivedFrom':'treasure-hoard.glb','originalUVsPreserved':True,'newProviderCredits':0}
target=ROOT/'public/drowned-crown/coin-spill.glb';g.save(target)
report={'source':'public/drowned-crown/treasure-hoard.glb','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output':'public/drowned-crown/coin-spill.glb','sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'triangles':counts,'bounds':bounds,'originalUVsPreserved':True,'newProviderCredits':0,'method':'Extract complete connected coins and gems from the existing front scatter; no sliced faces; unchanged UVs, textures and PBR material.'}
(ROOT/'tools/drowned-crown/coin-spill-provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
