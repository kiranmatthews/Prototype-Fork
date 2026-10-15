#!/usr/bin/env python3
"""Bake texture-independent contact meshes from accepted Meshy geometry."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import matrices
FILES={'warehouselight':'warehouse/industrial-fluorescent.glb','warehousepipes':'warehouse/rusted-pipe-manifold.glb',
 'warehouseshutter':'warehouse/graffiti-shutter.glb','warehousecabinet':'warehouse/electrical-cabinet.glb',
 'warehousedumpster':'warehouse/graffiti-dumpster.glb','warehousejunk':'ghost-train/haunted-junk-v3.glb',
 'warehouseboiler':'ghost-train/haunted-boiler-v3.glb','warehousecrate':'props/wood-crate/classic-wood-crate.glb',
 'warehouseplaster':'warehouse/broken-plaster-panel.glb','warehousependant':'warehouse/industrial-pendant.glb'}
out={}
for kind,file in FILES.items():
 source=ROOT/'public'/file;g=Glb(source);vertices=[];indices=[];offset=0
 for node,matrix in matrices(g.document).items():
  n=g.document['nodes'][node]
  if 'mesh' not in n:continue
  for part in g.document['meshes'][n['mesh']]['primitives']:
   pos=g.read_accessor(part['attributes']['POSITION']);world=(np.c_[pos,np.ones(len(pos))]@matrix.T)[:,:3]
   idx=g.read_accessor(part['indices']).ravel().astype(int) if 'indices' in part else np.arange(len(pos))
   vertices.extend(world.tolist());indices.extend((idx+offset).tolist());offset+=len(pos)
 v=np.array(vertices);assert np.isfinite(v).all();lo,hi=v.min(0),v.max(0);centre=(lo+hi)/2;centre[1]=lo[1];v-=centre
 if kind in ['warehousejunk','warehouseboiler','warehousecrate']:v*= {'warehousejunk':1,'warehouseboiler':2.4,'warehousecrate':1.2}[kind]/(hi[1]-lo[1])
 if kind=='warehouselight':
  v[:,1]-=(hi[1]-lo[1])/2;v=v[:,[0,2,1]];v[:,1]*=-1;v[:,1]-=v[:,1].min()
 unique={};points=[];remap=[]
 for vertex in v:
  key=tuple(round(float(x),6) for x in vertex)
  if key not in unique:unique[key]=len(points);points.append(key)
  remap.append(unique[key])
 triangles=[];pv=np.array(points)
 for triangle in np.array(indices).reshape(-1,3):
  ids=[remap[i] for i in triangle];a,b,c=pv[ids]
  if len(set(ids))<3 or np.linalg.norm(np.cross(b-a,c-a))<1e-9:continue
  triangles.extend(ids)
 out[kind]={'vertices':pv.ravel().tolist(),'indices':triangles,'source':file,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()}
 print(kind,len(points),len(triangles)//3,flush=True)
target=ROOT/'src/warehouseContacts.generated.ts'
target.write_text('// Baked from the accepted Meshy meshes by tools/warehouse-assets/bake_contacts.py.\nexport const WAREHOUSE_CONTACTS:Record<string,{vertices:number[];indices:number[];source:string;sha256:string}>='+json.dumps(out,separators=(',',':'))+';\n')
from prepare_meshy_walk import world_vertices
metrics={}
all_files={**FILES,'warehousewindow':'warehouse/broken-factory-window.glb','warehousehoist':'warehouse/rusted-crane-hoist.glb','warehousefan':'warehouse/broken-ventilation-fan.glb','warehousetoken':'warehouse/warehouse-token.glb','warehouseivy':'blockworks-art/hanging-vines.glb','warehousewalllower':'warehouse/factory-wall-lower.glb','warehousewallupper':'warehouse/factory-wall-upper.glb'}
for kind,file in all_files.items():
 v=world_vertices(Glb(ROOT/'public'/file));span=np.ptp(v,axis=0)
 if kind in ['warehousejunk','warehouseboiler','warehousecrate']:span*= {'warehousejunk':1,'warehouseboiler':2.4,'warehousecrate':1.2}[kind]/span[1]
 if kind=='warehouseivy':span*=3/span[1]
 if kind=='warehouselight':span=span[[0,2,1]]
 metrics[kind]=[round(float(x),8) for x in span]
(ROOT/'src/warehouseAssetMetrics.ts').write_text('// Measured packed Meshy bounds in metres; generated with bake_contacts.py.\nexport const WAREHOUSE_ASSET_SIZE = '+json.dumps(metrics,indent=2)+' as const;\n')
