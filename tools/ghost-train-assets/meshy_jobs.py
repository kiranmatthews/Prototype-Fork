#!/usr/bin/env python3
"""Ghost train assets through the authenticated official Meshy CLI.

New tasks have stable local operation IDs and are recorded before submission.
Credentials and expiring provider URLs remain outside shipping assets.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ghost_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/ghost-train'
adapter.LEDGER = HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/pirate-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE', str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPTS = json.loads((HERE/'prompts.json').read_text())

def preview(name, dry_run=False):
    spec = PROMPTS[name]
    if len(spec['prompt']) > 600:
        raise ValueError('Preview prompt exceeds Meshy 600-character contract')
    payload = {'mode':'preview', 'prompt':spec['prompt'], 'model_type':'smart-topology',
        'ai_model':'meshy-t2', 'topology':'triangle', 'target_polycount':spec['triangles'],
        'target_formats':['glb']}
    if spec.get('pose'):
        payload['pose_mode'] = spec['pose']
    adapter.submit(name, 'text-to-3d', payload, 20, dry_run)

def refine(name, dry_run=False):
    source = adapter.ledger()['tasks'][name]
    if source.get('state') != 'SUCCEEDED':
        raise RuntimeError('Refine requires successful preview')
    payload = {'mode':'refine', 'preview_task_id':source['id'],
        'texture_prompt':PROMPTS[name]['texture'], 'texture_resolution':'2k',
        'enable_pbr':False, 'remove_lighting':True, 'target_formats':['glb']}
    adapter.submit(name+'-textured', 'text-to-3d', payload, 10, dry_run)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['preview','refine','status','wait','download','balance'])
    parser.add_argument('name', nargs='?')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--asset', action='append')
    args = parser.parse_args()
    if args.verb == 'preview': preview(args.name, args.dry_run)
    elif args.verb == 'refine': refine(args.name, args.dry_run)
    elif args.verb == 'status': adapter.status(args.name)
    elif args.verb == 'wait': adapter.status(args.name, 50)
    elif args.verb == 'download':
        args.asset = args.asset or ['model.glb']
        adapter.download(args)
    elif args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))

if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
