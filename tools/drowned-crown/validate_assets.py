#!/usr/bin/env python3
"""Validate the shipped Drowned Crown kit without contacting generation APIs."""
from pathlib import Path
import json,hashlib,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import matrices
from PIL import Image
manifest=json.loads((ROOT/'tools/drowned-crown/asset-manifest.json').read_text())
triangles=0;total=0
for name,record in manifest.items():
 path=ROOT/'public/drowned-crown'/(name+'.glb');raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()==record['outputSha256'],name+' changed after packing'
 g=Glb(path);d=g.document;worlds=matrices(d);counts={0:0,1:0};pos=[]
 assert len(d['materials'])==1,name+' must share one atlas material'
 for i,node in enumerate(d['nodes']):
  if 'mesh' not in node:continue
  assert node['name'].endswith(('LOD0','LOD1'))
  lod=int(node['name'][-1])
  for p in d['meshes'][node['mesh']]['primitives']:
   xyz=g.read_accessor(p['attributes']['POSITION']);uv=g.read_accessor(p['attributes']['TEXCOORD_0'])
   idx=g.read_accessor(p['indices']).ravel();assert np.isfinite(xyz).all() and np.isfinite(uv).all()
   assert idx.max()<len(xyz) and len(idx)%3==0
   counts[lod]+=len(idx)//3
   if not lod:pos.append((np.c_[xyz,np.ones(len(xyz))]@worlds[i].T)[:,:3])
 assert counts[0]>100 and 0<counts[1]<counts[0]*.35,name+' LOD budget'
 points=np.concatenate(pos);assert min(np.ptp(points,axis=0))>1e-6
 assert np.allclose(points.min(0),record['sourceBounds']['min'],atol=.0001),name+' placement bounds'
 assert np.allclose(points.max(0),record['sourceBounds']['max'],atol=.0001),name+' placement bounds'
 assert d['materials'][0]['pbrMetallicRoughness'].get('baseColorTexture'),name+' missing painted atlas'
 triangles+=counts[0];total+=len(raw)
images=json.loads((ROOT/'tools/drowned-crown/image-manifest.json').read_text())
for name,record in images.items():
 path=ROOT/record['output'];assert hashlib.sha256(path.read_bytes()).hexdigest()==record['sha256']
 with Image.open(path) as im:assert min(im.size)>=512
with Image.open(ROOT/'public/drowned-crown/harbour-matte.webp') as im:
 assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255),'Preserve generated transparency'
ledger=json.loads((ROOT/'tools/drowned-crown/tasks.json').read_text())['tasks']
assert all(t['state']=='SUCCEEDED' for t in ledger.values())
assert sum(t.get('consumedCredits',0) for t in ledger.values())==435
print(json.dumps({'pass':True,'models':len(manifest),'nearTriangles':triangles,'modelBytes':total,'imageAssets':len(images),'creditsIncludingRejectedDrafts':435}))
