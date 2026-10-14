#!/usr/bin/env python3
"""Drowned Crown production kit using the existing official Meshy CLI adapter.

Every billable operation is reserved and recorded before submission. Unknown
outcomes are reconciled by task/operation ID; never silently resubmit a job.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import os

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('drowned_meshy',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE;adapter.WORK=ROOT/'.img2threejs/drowned-crown/excellence/meshy';adapter.LEDGER=HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI','/private/tmp/codex-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
SPECS=json.loads((HERE/'assets.json').read_text())

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('verb',choices=['preview','image','refine','retexture','status','download','balance'])
 p.add_argument('names',nargs='*');p.add_argument('--textured',action='store_true');p.add_argument('--retry-rejected',action='store_true')
 a=p.parse_args()
 if a.verb in ['preview','image','refine','retexture'] and not adapter.ledger().get('directUserApproval'):
  raise RuntimeError('Billable generation remains blocked pending direct user confirmation after automatic approval review rejection.')
 if a.verb=='balance':
  print(json.dumps(adapter.require_success(adapter.cli('balance'))));return
 names=list(SPECS) if not a.names or a.names==['all'] else a.names
 for name in names:
  v=SPECS[name]
  if v.get('derived') and a.verb in ['preview','image','refine']:continue
  if a.verb=='preview':
   if v['image']:continue
   adapter.submit(name,'text-to-3d',{'mode':'preview','prompt':v['prompt'],'model_type':'smart-topology',
    'ai_model':'meshy-t2','topology':'triangle','target_polycount':v['triangles'],'target_formats':['glb']},5)
  elif a.verb=='image':
   if not v['image'] or v.get('retextureInput'):continue
   reference=HERE/'references'/(name+'.png');assert reference.is_file()
   model_type=v.get('modelType','smart-topology')
   payload={'image_url':str(reference),'model_type':model_type,'ai_model':v.get('aiModel','meshy-t2'),
    'should_texture':True,'enable_pbr':True,'texture_resolution':'4k','texture_prompt':v['texture'],'target_formats':['glb']}
   if model_type=='smart-topology':payload['target_polycount']=v['triangles']
   else:payload['remove_lighting']=True
   adapter.submit(name+'-textured','image-to-3d',payload,v.get('estimatedCredits',15),retry_rejected=a.retry_rejected)
  elif a.verb=='retexture':
   model=ROOT/v['retextureInput'];reference=ROOT/v['retextureReference'];assert model.is_file() and reference.is_file()
   adapter.submit(name+'-textured','retexture',{'model_url':str(model),'image_style_url':str(reference),
    'enable_original_uv':True,'enable_pbr':True,'texture_resolution':'4k','remove_lighting':True,'target_formats':['glb']},v.get('estimatedCredits',10),retry_rejected=a.retry_rejected)
  elif a.verb=='refine':
   if v['image']:continue
   source=adapter.ledger()['tasks'][name]
   if source['state']!='SUCCEEDED':raise RuntimeError('Recorded successful preview required: '+name)
   adapter.submit(name+'-textured','text-to-3d',{'mode':'refine','preview_task_id':source['id'],
    'texture_prompt':v['texture'],'texture_resolution':'4k','enable_pbr':True,'remove_lighting':True,'target_formats':['glb']},10)
  else:
   key=name+'-textured' if a.textured else name
   if key not in adapter.ledger()['tasks']:continue
   if a.verb=='status':adapter.status(key)
   else:adapter.download(argparse.Namespace(name=key,asset=['model.glb','thumbnail']))

if __name__=='__main__':main()
