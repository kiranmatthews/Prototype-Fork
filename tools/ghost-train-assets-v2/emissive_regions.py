#!/usr/bin/env python3
"""Isolate actual Meshy glass/iris surfaces for runtime emission, no repaint."""
from pathlib import Path
import copy,hashlib,io,json,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE));from measure_assets import surface
from rigid_regions import rebuild
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb

def split(name,label,kind):
 path=ROOT/'public/ghost-train'/(name+'.glb');g,parts=surface(name);selected=[];picked_tri=[];picked_uv=[]
 for primitive,_,_,tri,c,n,_,uv in parts:
  material=g.document['materials'][primitive.get('material',0)]['pbrMetallicRoughness'];image=g.document['images'][g.document['textures'][material['baseColorTexture']['index']]['source']];view=g.document['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0)
  pixels=np.asarray(Image.open(io.BytesIO(bytes(g.binary[offset:offset+view['byteLength']]))).convert('RGB'));samples=uv.mean(1)
  colours=pixels[np.clip((samples[:,1]*pixels.shape[0]).astype(int),0,pixels.shape[0]-1),np.clip((samples[:,0]*pixels.shape[1]).astype(int),0,pixels.shape[1]-1)].astype(float)
  if kind=='glass':
   taper=np.clip((.96-c[:,1])/.30,0,1);mask=(colours.mean(1)<75)&(abs(n[:,2])>.94)&(abs(c[:,0])<.193*taper)&(c[:,1]>.16)&(c[:,1]<.94)
  else:mask=(colours[:,1]>colours[:,0]*1.055)&(colours[:,1]>colours[:,2]*1.18)&(colours[:,1]>38)&(c[:,1]>.75)&(c[:,1]<.84)&(abs(c[:,0])>.070)&(abs(c[:,0])<.16)&(c[:,2]>.29)
  selected.extend(mask.tolist());picked_tri.extend(tri[mask]);picked_uv.extend(uv[mask])
 if not picked_tri:raise ValueError('No genuine '+kind+' region found')
 # Original triangle order is stable in the packed static model; use its exact
 # selected centroid signatures rather than approximate generated geometry.
 keys={tuple(np.round(t.mean(0),7)) for t in picked_tri}
 predicate=lambda c:np.array([tuple(np.round(p,7)) in keys for p in c])
 before=sum(len(part[3]) for part in parts)
 report=rebuild(path,path,{label:predicate,'MeshyStructuralSurface':lambda c:np.ones(len(c),dtype=bool)},
  {'ghostSelectiveEmission':{'region':label,'kind':kind,'originalAlbedoAndUVsPreserved':True}},False)
 assert report['triangles']==before
 packed=Glb(path);doc=packed.document;original=copy.deepcopy(doc['materials'][0]);original['name']='Meshy_'+label;original['extras']={'ghostSurfaceRegion':kind,'source':'Original Meshy painted UV surfaces'};new_index=len(doc['materials']);doc['materials'].append(original)
 for mesh in doc['meshes']:
  if mesh['name']==label:
   for p in mesh['primitives']:p['material']=new_index
  else:
   for p in mesh['primitives']:p['material']=0
 for node in doc['nodes']:
  if node.get('name')==label:node['extras']={'ghostSurfaceRegion':kind}
 packed.save(path)
 vertices=np.concatenate(picked_tri);uvs=np.concatenate(picked_uv)
 info={'node':label,'materialName':'Meshy_'+label,'kind':kind,'triangles':len(picked_tri),'bounds':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist()},
  'uvBounds':{'min':uvs.min(0).tolist(),'max':uvs.max(0).tolist()},'originalAlbedoAndUVsPreserved':True,
  'facadeNormals':[[0,0,1],[0,0,-1]] if kind=='glass' else [[0,0,1]],'operation':'Original painted-triangle selection only; runtime may adjust emission on this material'}
 provenance=path.with_suffix('.provenance.json');data=json.loads(provenance.read_text());data.update(outputSha256=hashlib.sha256(path.read_bytes()).hexdigest(),bytes=path.stat().st_size,selectiveEmission=info);provenance.write_text(json.dumps(data,indent=2)+'\n')
 return data,info

if __name__=='__main__':
 manifest=json.loads((HERE/'asset-manifest.json').read_text());regions={}
 for name,label,kind in [('castle-wall-window-v2','WindowGlass','glass'),('monster-face-portal-v2','PortalEyes','eyes')]:
  data,info=split(name,label,kind);manifest[name]=data;regions[name]=info;print(json.dumps({name:info}))
 (HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(HERE/'emissive-regions.json').write_text(json.dumps(regions,indent=2)+'\n')
