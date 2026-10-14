#!/usr/bin/env python3
"""Sunny beach scenery using the repository's official Meshy CLI adapter."""
from pathlib import Path
import argparse, importlib.util, json
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('sunny_meshy',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT=ROOT
adapter.HERE=HERE
adapter.WORK=ROOT/'.img2threejs/sunny-beach'
adapter.LEDGER=HERE/'tasks.json'
ASSETS={a['id']:a for a in json.loads((HERE/'prompts.json').read_text())['assets']}
p=argparse.ArgumentParser()
p.add_argument('verb',choices=['image','status','wait','download'])
p.add_argument('names',nargs='*')
a=p.parse_args()
if not adapter.LEDGER.exists():
    adapter.write_json(adapter.LEDGER,{'schemaVersion':1,'provider':'Meshy','cliVersion':'0.3.1','budgetCredits':30,'startingBalance':1881,'scope':'Two sunny beach scenery assets authorized by the level brief','tasks':{}})
for name in a.names or list(ASSETS):
    asset=ASSETS[name]
    if a.verb=='image':
        adapter.submit(name,'image-to-3d',{'image_url':str(HERE/'references'/f'{name}.png'),'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle','target_polycount':asset['triangles'],'should_texture':True,'enable_pbr':False,'texture_resolution':'2k','target_formats':['glb']},15)
    elif a.verb in ('status','wait'): adapter.status(name,50 if a.verb=='wait' else None)
    else: adapter.download(argparse.Namespace(name=name,asset=['model.glb','thumbnail']))
