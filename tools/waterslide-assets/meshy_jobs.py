#!/usr/bin/env python3
"""Waterslide art through the existing official Meshy CLI and credit ledger."""
from pathlib import Path
import argparse
import importlib.util
import json

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('waterslide_meshy_adapter',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE
adapter.WORK=ROOT/'.img2threejs/waterslide-art';adapter.LEDGER=HERE/'tasks.json'

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('verb',choices=['image','status','wait','download','balance'])
 p.add_argument('names',nargs='*');a=p.parse_args()
 if a.verb=='balance':
  print(json.dumps(adapter.require_success(adapter.cli('balance'))));return
 assets=json.loads((HERE/'assets.json').read_text())
 if not adapter.LEDGER.exists():
  adapter.write_json(adapter.LEDGER,{'schemaVersion':1,'provider':'Meshy','cliVersion':'0.3.1',
   'budgetCredits':200,'startingBalance':1431,'scope':'The Slipstream abandoned waterslide, existing credits only; user maximum 200','tasks':{}})
 for name in a.names or list(assets):
  s=assets[name]
  if a.verb=='image':
   reference=HERE/'references'/(name+'.png')
   if not reference.is_file():raise RuntimeError('Missing reviewed reference: '+name)
   adapter.submit(name,'image-to-3d',{'image_url':str(reference),'model_type':'smart-topology',
    'ai_model':'meshy-t2','topology':'triangle','target_polycount':s['triangles'],
    'should_texture':True,'enable_pbr':True,'texture_resolution':s.get('textureResolution','2k'),'target_formats':['glb']},15)
  elif a.verb in ('status','wait'):adapter.status(name,50 if a.verb=='wait' else None)
  else:adapter.download(argparse.Namespace(name=name,asset=['model.glb','thumbnail']))

if __name__=='__main__':main()
