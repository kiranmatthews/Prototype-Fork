#!/usr/bin/env python3
"""Golf-cart art jobs using the repository's official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('cart_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT / '.img2threejs/golf-cart'
adapter.LEDGER = HERE / 'meshy-tasks.json'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['image', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('names', nargs='*')
    args = parser.parse_args()
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    assets = json.loads((HERE / 'meshy-assets.json').read_text())
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1',
            'budgetCredits': 90, 'startingBalance': 1136,
            'scope': 'Rounded Crash 4-inspired modular golf cart components, existing credits only', 'tasks': {}})
    for name in args.names or list(assets):
        item = assets[name]
        if args.verb == 'image':
            reference = HERE / 'references' / (name + '.png')
            if not reference.is_file():
                reference = reference.with_suffix('.webp')
            if not reference.is_file():
                raise RuntimeError('Missing reviewed reference: ' + name)
            adapter.submit(name, 'image-to-3d', {'image_url': str(reference),
                'model_type': 'smart-topology', 'ai_model': 'meshy-t2', 'topology': 'triangle',
                'target_polycount': item['triangles'], 'should_texture': True, 'enable_pbr': True,
                'texture_resolution': '2k', 'target_formats': ['glb'],
                'texture_prompt': 'Crash Bandicoot 4-inspired smooth sculpted cartoon prop. Preserve the reference colours, soft painterly highlights, curved surfaces and clear material regions. No visible low-poly facets.'}, 15)
        elif args.verb in ('status', 'wait'):
            adapter.status(name, 50 if args.verb == 'wait' else None)
        else:
            adapter.download(argparse.Namespace(name=name, asset=['model.glb', 'thumbnail']))

if __name__ == '__main__':
    main()
