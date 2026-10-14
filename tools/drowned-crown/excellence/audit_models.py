"""Audit shipped geometry, including topology lost by disconnected reduction."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
report={}
manifest=json.loads((HERE/'asset-manifest.json').read_text())
assert manifest['crash-galleon-painted']['size']==manifest['galleon-hull']['size'],'Hull runtime scale changed'
for name in ['headland','cavern-buttress','galleon-hull','vault-floor','grotto-floor','crash-cavern-rock','crash-cavern-skylight','crash-cavern-canopy','crash-mine-shell','crash-galleon-painted']:
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
  if name in ['cavern-buttress','crash-cavern-rock','crash-cavern-skylight','crash-mine-shell']:assert boundaries==0,(name,lod,boundaries)
  # Route-cut models legitimately have openings, but should not fragment
  # into separate triangles (the old outputs exceeded one edge per face).
  if name in ['headland','galleon-hull','crash-galleon-painted']:assert boundaries/len(ids)<.35,(name,lod,boundaries,len(ids))
  if name=='crash-galleon-painted':
   original=Glb(ROOT/'public/drowned-crown/excellence/galleon-hull.glb')
   oldnode=next(n for n in original.document['nodes'] if 'mesh' in n and (1 if n.get('name','').endswith('LOD1') else 0)==lod)
   oldprim=original.document['meshes'][oldnode['mesh']]['primitives'][0]
   for key,index in {**prim['attributes'],'indices':prim['indices']}.items():
    oldindex=oldprim['indices'] if key=='indices' else oldprim['attributes'][key]
    assert np.array_equal(g.read_accessor(index),original.read_accessor(oldindex)),('Hull geometry changed',lod,key)
  if name=='crash-mine-shell':
   directed=np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]);_,edge_ids=np.unique(np.sort(directed,axis=1),axis=0,return_inverse=True)
   winding=np.bincount(edge_ids,weights=np.sign(directed[:,1]-directed[:,0]))
   assert not np.any(winding),('Inconsistent mine surface winding',lod,int(np.count_nonzero(winding)))
   # Intersect the exported triangles along both body-height centre lines,
   # including the optional branch, independently of the fitting algorithm.
   q=p[ids];edge1=q[:,1]-q[:,0];edge2=q[:,2]-q[:,0]
   for route_path in json.loads((HERE/'mine-source.json').read_text())['paths']:
    for height in [1,3]:
     a=np.array(route_path['a'],dtype=float)+[0,height,0];b=np.array(route_path['b'],dtype=float)+[0,height,0];direction=b-a
     h=np.cross(np.broadcast_to(direction,edge2.shape),edge2);det=(edge1*h).sum(1);valid=np.abs(det)>1e-8
     inv=np.divide(1,det,out=np.zeros_like(det),where=valid);delta=a-q[:,0]
     u=inv*(delta*h).sum(1);r=np.cross(delta,edge1);v=inv*(r*direction).sum(1);t=inv*(edge2*r).sum(1)
     hits=valid&(u>=0)&(v>=0)&(u+v<=1)&(t>.001)&(t<.999)
     assert not hits.any(),('Rock blocks mine route',lod,route_path,height,int(hits.sum()))
  if name=='crash-cavern-canopy':
   # Test the actual exported triangles, independently of the cutting code.
   q=p[ids];a=q[:,0][:,[0,2]];b=q[:,1][:,[0,2]]-a;c=q[:,2][:,[0,2]]-a
   det=b[:,0]*c[:,1]-b[:,1]*c[:,0];valid=np.abs(det)>1e-8
   def roof_hits(x,z):
    delta=np.array([x,z])-a
    u=np.divide(delta[:,0]*c[:,1]-delta[:,1]*c[:,0],det,out=np.zeros_like(det),where=valid)
    w=np.divide(b[:,0]*delta[:,1]-b[:,1]*delta[:,0],det,out=np.zeros_like(det),where=valid)
    return int(np.count_nonzero(valid&(u>=-1e-5)&(w>=-1e-5)&(u+w<=1.00001)))
   assert roof_hits(-30,-190)==0 and roof_hits(40,-136)==0,(lod,'blocked skylight')
   assert roof_hits(0,-250)>0,(lod,'missing canopy between openings')
   assert p[:,1].min()>=57.99,(lod,'canopy intrudes into the 51 m mast envelope')
  lods[str(lod)]={'triangles':len(ids),'vertices':len(p),'geometricBoundaryEdges':boundaries}
  vertices+=len(p);triangles+=len(ids)
 assert set(lods)=={'0','1'} and len(d['materials'])==1
 report[name]={'finiteGeometry':True,'validIndices':True,'finiteSourceUVsAndNormals':True,'materials':1,'trianglesIncludingLODs':triangles,'verticesIncludingLODs':vertices,'lods':lods,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(HERE/'model-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'pass':True,'assets':len(report),'closedRockLODs':8,'originalTextureCoordinates':'present and finite'}))
