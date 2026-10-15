"""Hollowwake assets through the existing official Meshy CLI adapter."""
from pathlib import Path
import argparse,importlib.util,json,os
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hollowwake_meshy',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE;adapter.WORK=ROOT/'.img2threejs/hollowwake/meshy';adapter.LEDGER=HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI','/private/tmp/codex-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
SPECS=json.loads((HERE/'assets.json').read_text())
p=argparse.ArgumentParser();p.add_argument('verb',choices=['create','status','download','balance']);p.add_argument('names',nargs='*');a=p.parse_args()
if a.verb=='balance':print(json.dumps(adapter.require_success(adapter.cli('balance'))));raise SystemExit
for name in a.names or SPECS:
 v=SPECS[name]
 if a.verb=='create':
  assert adapter.ledger()['budgetCredits']==200
  adapter.submit(name,'image-to-3d',{'image_url':str(HERE/'references'/(name+'.png')),'model_type':'standard','ai_model':'meshy-7','should_texture':True,'enable_pbr':True,'texture_resolution':'4k','remove_lighting':True,'texture_prompt':v['texture'],'target_formats':['glb']},v['estimatedCredits'])
 elif a.verb=='status':adapter.status(name)
 elif a.verb=='download':adapter.download(argparse.Namespace(name=name,asset=['model.glb','thumbnail']))
