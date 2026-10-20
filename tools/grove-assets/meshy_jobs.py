#!/usr/bin/env python3
"""No-Man’s Grove checkpoint shelter through the repository's official Meshy adapter.

Each named billable stage is journalled before submission. Authoring GLBs and
signed responses stay ignored; only the baked local mesh kit ships.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import os
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('grove_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT / '.img2threejs/grove'
adapter.LEDGER = HERE / 'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/codex-country-club-meshy/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE', str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPTS = json.loads((HERE / 'prompts.json').read_text())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['preview', 'refine', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('name', nargs='?', default='all')
    parser.add_argument('--textured', action='store_true')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {
            'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1',
            'budgetCredits': 15, 'tasks': {},
        })
    for name in (list(PROMPTS) if args.name == 'all' else [args.name]):
        art = PROMPTS[name]
        key = art.get('texturedJob', name+'-textured') if args.textured else name
        if args.verb == 'preview':
            adapter.submit(name, 'text-to-3d', {
                'mode': 'preview', 'prompt': art['prompt'], 'model_type': 'smart-topology',
                'ai_model': 'meshy-t2', 'topology': 'triangle',
                'target_polycount': art['triangles'], 'target_formats': ['glb'],
            }, 5, args.dry_run)
        elif args.verb == 'refine':
            source = adapter.ledger()['tasks'][name]
            if source.get('state') != 'SUCCEEDED':
                raise RuntimeError('Successful preview required: ' + name)
            adapter.submit(name + '-textured', 'text-to-3d', {
                'mode': 'refine', 'preview_task_id': source['id'],
                'texture_prompt': art['texture'], 'texture_resolution': '2k',
                'enable_pbr': False, 'remove_lighting': True, 'target_formats': ['glb'],
            }, 10, args.dry_run)
        elif args.verb in ['status', 'wait']:
            adapter.status(key, 50 if args.verb == 'wait' else None)
        elif args.verb == 'download':
            adapter.download(argparse.Namespace(name=key, asset=['model.glb', 'thumbnail']))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, ValueError, KeyError, OSError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
