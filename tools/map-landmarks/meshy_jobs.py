#!/usr/bin/env python3
"""Campaign landmarks through the existing official Meshy workflow."""
from pathlib import Path
import argparse,importlib.util,json,os
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('map_meshy_adapter',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE;adapter.WORK=ROOT/'.img2threejs/map-landmarks';adapter.LEDGER=HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI','/private/tmp/codex-country-club-meshy/node_modules/@meshy-ai/cli/dist/index.js')
PROMPTS=json.loads((HERE/'prompts.json').read_text())
def preview(name,dry_run=False):
    specification=PROMPTS[name]
    if len(specification['prompt'])>600:raise ValueError('Preview prompt exceeds 600 characters: '+name)
    adapter.submit(name,'text-to-3d',{'mode':'preview','prompt':specification['prompt'],
        'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle',
        'target_polycount':specification['triangles'],'target_formats':['glb']},5,dry_run)

def refine(name,dry_run=False):
    source=adapter.ledger()['tasks'][name]
    if source.get('state')!='SUCCEEDED':raise RuntimeError('Successful preview required before texture refinement: '+name)
    adapter.submit(name+'-textured','text-to-3d',{'mode':'refine','preview_task_id':source['id'],
        'texture_prompt':PROMPTS[name]['texture'],'texture_resolution':'2k','enable_pbr':False,
        'remove_lighting':True,'target_formats':['glb']},10,dry_run)


if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('verb',choices=['preview','refine','status','download','balance']);p.add_argument('names',nargs='*');p.add_argument('--textured',action='store_true');a=p.parse_args()
 if a.verb=='balance':print(json.dumps(adapter.require_success(adapter.cli('balance'))))
 else:
  for name in a.names or PROMPTS:
   key=name+('-textured' if a.textured else '')
   if a.verb=='preview':preview(name)
   elif a.verb=='refine':refine(name)
   elif a.verb=='status':adapter.status(key)
   else:adapter.download(argparse.Namespace(name=key,asset=['model.glb','thumbnail']))
