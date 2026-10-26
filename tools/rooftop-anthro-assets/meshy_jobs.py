"""Animal rooftop cast. Official Meshy CLI owns billing, auth and job waits."""
import argparse
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('anthro_meshy', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/rooftop-anthro'
adapter.LEDGER = HERE/'tasks.json'

def main():
    p=argparse.ArgumentParser()
    p.add_argument('verb',choices=['create','status','wait','download'])
    p.add_argument('names',nargs='+')
    args=p.parse_args()
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER,{'schemaVersion':1,'provider':'Meshy','budgetCredits':180,
            'scope':'User authorized anthro enemy replacements, native Meshy surfaces and articulated components','tasks':{}})
    for name in args.names:
        if args.verb=='create':
            adapter.submit(name,'image-to-3d',{'image_url':str(HERE/'references'/f'{name}.png'),
                'ai_model':'meshy-7.1','geometry_resolution':'4k','should_remesh':False,
                'should_texture':True,'enable_pbr':True,'texture_resolution':'2k',
                'pose_mode':'a-pose','target_formats':['glb']},35)
        elif args.verb in ('status','wait'):
            adapter.status(name,50 if args.verb=='wait' else None)
        else:
            adapter.download(argparse.Namespace(name=name,asset=['model.glb']))

if __name__=='__main__':main()
