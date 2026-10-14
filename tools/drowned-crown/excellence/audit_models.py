"""Audit shipped geometry, including topology lost by disconnected reduction."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
report={}
for name in ['headland','cavern-buttress','galleon-hull','vault-floor','grotto-floor']:
 path=ROOT/'public/drowned-crown/excellence'/f'{name}.glb';g=Glb(path);d=g.document;lods={};vertices=0;triangles=0
 for node in d['nodes']:
  if 'mesh' not in node:continue
  lod=1 if node.get('name','').endswith('LOD1') else 0
  assert len(d['meshes'][node['mesh']]['primitives'])==1
  prim=d['meshes'][node['mesh']]['primitives'][0];p=g.read_accessor(prim['attributes']['POSITION']);uv=g.read_accessor(prim['attributes']['TEXCOORD_0']);norm=g.read_accessor(prim['attributes']['NORMAL']);ids=g.read_accessor(prim['indices']).reshape(-1,3)
  assert np.isfinite(p).all() and np.isfinite(uv).all() and np.isfinite(norm).all()
  assert ids.min()>=0 and ids.max()<len(p)
  _,back=np.unique(p.round(4),axis=0,return_inverse=True);t=back[ids]
  edges=np.sort(np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True)
  boundaries=int((counts==1).sum())
  # The uncut source rock must stay closed at both LODs. The old broken
  # reduction produced 15,309 / 6,237 open edges on this same model.
  if name=='cavern-buttress':assert boundaries==0,(name,lod,boundaries)
  # Route-cut models legitimately have openings, but should not fragment
  # into separate triangles (the old outputs exceeded one edge per face).
  if name in ['headland','galleon-hull']:assert boundaries/len(ids)<.35,(name,lod,boundaries,len(ids))
  lods[str(lod)]={'triangles':len(ids),'vertices':len(p),'geometricBoundaryEdges':boundaries}
  vertices+=len(p);triangles+=len(ids)
 assert set(lods)=={'0','1'} and len(d['materials'])==1
 report[name]={'finiteGeometry':True,'validIndices':True,'finiteSourceUVsAndNormals':True,'materials':1,'trianglesIncludingLODs':triangles,'verticesIncludingLODs':vertices,'lods':lods,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(HERE/'model-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pass':True,'assets':len(report),'closedRockLODs':2,'originalTextureCoordinates':'present and finite'}))
