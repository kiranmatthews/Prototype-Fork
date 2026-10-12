#!/usr/bin/env python3
"""Blockworks static kit; compose the established official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json
import os

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('blockworks_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT, adapter.HERE = ROOT, HERE
adapter.WORK = ROOT / '.img2threejs/blockworks-assets'
adapter.LEDGER = HERE / 'meshy-tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/blockworks-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
BRIEFS = json.loads((HERE / 'asset-prompts.json').read_text())['props']

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['create', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('names', nargs='*')
    args = parser.parse_args()
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    names = args.names or list(BRIEFS)
    for name in names:
        brief = BRIEFS[name]
        if args.verb == 'create':
            # One named operation, with durable pre-submission reservation.
            # Reject any budget drift before delegating provider transport.
            data = adapter.ledger()
            if data['budgetCredits'] > 1000:
                raise RuntimeError('Blockworks Meshy budget exceeds user authorization')
            actual = sum(max(t.get('consumedCredits', 0), t.get('estimatedCredits', 0)) for t in data['tasks'].values())
            if name not in data['tasks'] and actual + 15 > 1000:
                raise RuntimeError('Blockworks Meshy credit ceiling reached')
            image = ROOT / brief['reference']
            adapter.create(argparse.Namespace(name=name,image=str(image),triangles=brief['triangles'],dry_run=False))
        elif args.verb == 'download':
            adapter.download(argparse.Namespace(name=name, asset=['model.glb', 'thumbnail']))
        else:
            adapter.status(name, 50 if args.verb == 'wait' else None)

if __name__ == '__main__':
    main()
