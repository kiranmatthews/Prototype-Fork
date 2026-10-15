#!/usr/bin/env python3
"""Pack source-textured Meshy LODs and emit measured scenery registrations."""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures,matrices
WORK=ROOT/'.img2threejs/drowned-crown/excellence';OUT=ROOT/'public/drowned-crown/excellence';OUT.mkdir(exist_ok=True)
SPECS=json.loads((HERE/'assets.json').read_text());TASKS=json.loads((HERE/'tasks.json').read_text())['tasks']
HERO={'headland','warehouse','stern-gallery','fort-bastion','royal-portal','hull-panel','limestone-wall'}
WIDTH_FIT={'headland','warehouse','stern-gallery','limestone-wall','stalactite-vault','hull-panel','ship-ribs','torn-sail','cargo-stack','treasure-hoard','chart-table','royal-portal'}
DEPTH_FIT={'cargo-lighter','naval-cannon','galleon-hull'}
manifest={};registrations=[]
for name,spec in SPECS.items():
 if spec.get('rejected') or spec.get('production') is False or spec.get('customPacker'):continue
 source=WORK/'prepared'/(name+'.glb')
 if not source.exists():continue
 logical=spec.get('replaces',name);g=Glb(source);d=g.document;worlds=matrices(d)
 positions=[];triangles={0:0,1:0}
 for index,node in enumerate(d['nodes']):
  if 'mesh' not in node:continue
  lod=1 if node.get('name','').endswith('LOD1') else 0
  for prim in d['meshes'][node['mesh']]['primitives']:
   p=g.read_accessor(prim['attributes']['POSITION']);w=worlds[index]
   if not lod:positions.append((np.c_[p,np.ones(len(p))]@w.T)[:,:3])
   if 'TEXCOORD_0' not in prim['attributes']:raise ValueError('Missing source UVs: '+name)
   indices=g.read_accessor(prim['indices']).ravel() if 'indices' in prim else np.arange(len(p))
   assert len(indices)%3==0 and indices.max()<len(p)
   triangles[lod]+=len(indices)//3
 points=np.concatenate(positions);span=np.ptp(points,axis=0)
 if logical in DEPTH_FIT and span[0]>span[2]*1.15:
  # Some generated ships/guns retain an X-long canonical pose after import.
  # A single static ancestor corrects that pose without touching UVs or LODs.
  scene=d['scenes'][d.get('scene',0)];roots=scene['nodes'][:]
  scene['nodes']=[len(d['nodes'])]
  d['nodes'].append({'name':logical+'-axis-fit','rotation':[0,-2**-.5,0,2**-.5],'children':roots})
  points=points@np.array([[0,0,1],[0,1,0],[-1,0,0]])
  span=np.ptp(points,axis=0)
 assert np.isfinite(points).all() and min(span)>1e-6
 axis=0 if logical in WIDTH_FIT else 2 if logical in DEPTH_FIT else 1
 scale=spec['size'][axis]/span[axis];size=(span*scale).round(4).tolist()
 textures=compact_textures(g,spec.get('textureMax',4096 if logical in ['headland','cavern-buttress','galleon-hull'] else 2048 if logical in HERO else 1024),92,data_limit=512,lossless_data=True)
 task={'id':spec['sourceTaskId']} if spec.get('sourceTaskId') else TASKS[spec.get('sourceJob',name+'-textured')];d['asset']={'version':'2.0','generator':'Meshy; Drowned Crown measured LOD packer',
  'extras':{'provider':'Meshy','taskId':task['id'],'originalUVsPreserved':True,'nearFarLODs':True}}
 target=OUT/(logical+'.glb');g.save(target)
 manifest[logical]={'sourceVariant':name,'taskId':task['id'],'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'triangles':triangles,
  'sourceBounds':{'min':points.min(0).tolist(),'max':points.max(0).tolist()},'size':size,'fitAxis':axis,'textures':textures,
  'originalUVsPreserved':True,'axes':'Y-up, centered XZ, bottom anchored by shared scenery loader'}
 flags=',windowGlow:true' if logical in ['stern-gallery','brass-lantern'] else ''
 if spec.get('lodRange'):flags+=',lodRange:'+json.dumps(spec['lodRange'])
 flags+=',doubleSided:true' if spec.get('doubleSided') or logical in ['torn-sail','tropical-palm'] else ',doubleSided:false'
 registrations.append(f"  {spec['kind']}:{{file:'../drowned-crown/excellence/{logical}',label:'Drowned Crown · {logical.replace('-',' ')}',size:{json.dumps(size)},wind:false,normalStrength:.2,lod:true,distanceLod:true{flags}}},")
 print(json.dumps({'asset':logical,'triangles':triangles,'bytes':target.stat().st_size,'size':size}))
(HERE/'asset-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'provenance.json').write_text(json.dumps({'provider':'Meshy','assets':manifest,
 'consumedCredits':sum(t.get('consumedCredits',0) for t in TASKS.values()),'jobsIncludeRejectedDrafts':True},indent=2)+'\n')
(ROOT/'src/drownedCrownExcellence.generated.ts').write_text('/** Generated from the measured, original-UV Meshy production kit. */\nexport const DROWNED_CROWN_EXCELLENCE_MODELS = {\n'+'\n'.join(registrations)+'\n} as const;\n')
