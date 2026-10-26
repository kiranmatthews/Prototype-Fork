"""Compact flame nozzle, using the repository's official Meshy CLI adapter."""
from pathlib import Path
import argparse,importlib.util,json
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('nozzle_meshy',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE;adapter.WORK=ROOT/'.img2threejs/flame-nozzle';adapter.LEDGER=HERE/'tasks.json'
p=argparse.ArgumentParser();p.add_argument('verb',choices=['create','wait','status','download']);args=p.parse_args()
name='triple-nozzle'
if args.verb=='create':
 if not adapter.LEDGER.exists():adapter.write_json(adapter.LEDGER,{'schemaVersion':1,'provider':'Meshy','budgetCredits':30,'scope':'User requested one-third-size Meshy kart flamethrower hardware','tasks':{}})
 adapter.submit(name,'image-to-3d',{'image_url':str(HERE/'references/triple-nozzle.png'),'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle','target_polycount':1600,'should_texture':True,'enable_pbr':True,'texture_resolution':'2k','target_formats':['glb'],'texture_prompt':'Match the single shared cream housing with exactly three side-by-side dark exhaust openings, three brass lips and small orange ridges. Keep the whole connected compact cartoon prop.'},15)
elif args.verb in ('wait','status'):adapter.status(name,50 if args.verb=='wait' else None)
else:adapter.download(argparse.Namespace(name=name,asset=['model.glb','thumbnail']))
