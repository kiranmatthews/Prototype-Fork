#!/usr/bin/env python3
"""Beacon start/finish pair through the repository's official Meshy adapter."""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('beacon_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT / '.img2threejs/beacon-platforms'
adapter.LEDGER = HERE / 'tasks.json'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['create', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('names', nargs='*')
    args = parser.parse_args()
    if any(name not in ['arrival', 'finish', 'arrival-green', 'finish-green'] for name in args.names):
        parser.error('Asset names must be arrival, finish, arrival-green or finish-green')
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion': 1, 'provider': 'Meshy',
            'cliVersion': '0.3.1', 'budgetCredits': 60,
            'authorization': 'User requested new image-generated Meshy replacements for level start/end platforms.', 'tasks': {}})
    for name in args.names or ['arrival-green', 'finish-green']:
        if args.verb == 'create':
            adapter.submit(name, 'image-to-3d', {
                'image_url': str(HERE / 'references' / (name + '.png')),
                'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
                'topology': 'triangle', 'target_polycount': 6000,
                'should_texture': True, 'enable_pbr': True,
                'texture_resolution': '2k',
                'texture_prompt': 'Match the reference precisely: vivid fresh GRASS GREEN unpatterned flat center disk, broad continuous PURE WHITE luminous rounded rim, dark charcoal gray smooth stepped foundation and thin GREEN light strip around the side. Minimal refined premium stylized game world-map beacon. Satin enamel materials, restrained material texture. No turquoise, cyan, teal, gold, bronze, compass, engraving, symbols, gems, masonry blocks, text or environment. Broad clear playable flat deck.',
                'target_formats': ['glb'],
            }, 15)
        elif args.verb in ['status', 'wait']:
            adapter.status(name, 50 if args.verb == 'wait' else None)
        else:
            adapter.download(argparse.Namespace(name=name, asset=['model.glb', 'thumbnail']))

if __name__ == '__main__':
    main()
