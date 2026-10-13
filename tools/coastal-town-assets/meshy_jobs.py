#!/usr/bin/env python3
"""Modular Coastal scenery through the existing official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json
import sys

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('coastal_meshy_adapter',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT=ROOT
adapter.HERE=HERE
adapter.WORK=ROOT/'.img2threejs/coastal-town'
adapter.LEDGER=HERE/'tasks.json'
ASSETS={a['id']:a for a in json.loads((HERE/'modular-prompts.json').read_text())['assets']}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('verb',choices=['image','status','wait','download','balance'])
    p.add_argument('names',nargs='*')
    a=p.parse_args()
    if a.verb=='balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))));return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER,{'schemaVersion':1,'provider':'Meshy','cliVersion':'0.3.1',
          'budgetCredits':300,'startingBalance':2811,'scope':'Coastal and Rooftop Deliveries modular art; no signage; no whole buildings','tasks':{}})
    for name in (a.names or list(ASSETS)):
        s=ASSETS[name]
        if a.verb=='image':
            reference=HERE/'references'/(name+'.png')
            if not reference.is_file():raise RuntimeError('Missing modular reference: '+name)
            adapter.submit(name,'image-to-3d',{'image_url':str(reference),'model_type':'smart-topology',
              'ai_model':'meshy-t2','topology':'triangle','target_polycount':s['triangles'],
              'should_texture':True,'enable_pbr':False,'texture_resolution':'2k','target_formats':['glb']},15)
        elif a.verb in ('status','wait'):adapter.status(name,50 if a.verb=='wait' else None)
        else:adapter.download(argparse.Namespace(name=name,asset=['model.glb','thumbnail']))

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,KeyError,OSError) as e:
        print(str(e),file=sys.stderr);sys.exit(1)
