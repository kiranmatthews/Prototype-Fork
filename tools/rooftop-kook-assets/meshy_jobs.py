"""Rooftop art through the repository's official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('rooftop_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/rooftop-kook'
adapter.LEDGER = HERE/'tasks.json'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['image', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('names', nargs='*')
    args = parser.parse_args()
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance')))); return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1',
            'budgetCredits': 90, 'startingBalance': 611,
            'scope': 'Six original affluent Outer Banks rooftop scenery assets; user authorized credits', 'tasks': {}})
    assets = json.loads((HERE/'assets.json').read_text())
    for name in args.names or assets:
        if args.verb == 'image':
            adapter.submit(name, 'image-to-3d', {
                'image_url': str(HERE/'references'/(name+'.png')),
                'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
                'topology': 'triangle', 'target_polycount': assets[name]['triangles'],
                'should_texture': True, 'enable_pbr': False,
                'texture_resolution': '2k', 'target_formats': ['glb']}, 15)
        elif args.verb in ('status', 'wait'):
            adapter.status(name, 50 if args.verb == 'wait' else None)
        else:
            adapter.download(argparse.Namespace(name=name, asset=['model.glb', 'thumbnail']))

if __name__ == '__main__':
    main()
