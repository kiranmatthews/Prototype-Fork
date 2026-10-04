#!/usr/bin/env python3
"""Derelict bathhouse kit through the existing official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json
import os

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('ghost_v3_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT / '.img2threejs/ghost-train-v3'
adapter.LEDGER = HERE / 'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/ghost-train-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE', str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPTS = json.loads((HERE / 'prompts.json').read_text())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb', choices=['preview', 'refine', 'retexture', 'status', 'wait', 'download', 'balance'])
    parser.add_argument('name', nargs='?', default='all')
    parser.add_argument('--textured', action='store_true')
    parser.add_argument('--repaint', action='store_true')
    args = parser.parse_args()
    if args.verb == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion': 1, 'provider': 'Meshy', 'cliVersion': '0.3.1', 'budgetCredits': 60, 'tasks': {}})
    for name in list(PROMPTS) if args.name == 'all' else [args.name]:
        brief = PROMPTS[name]
        if args.verb == 'preview':
            assert len(brief['prompt']) <= 600
            adapter.submit(name, 'text-to-3d', {'mode': 'preview', 'prompt': brief['prompt'],
                'model_type': 'smart-topology', 'ai_model': 'meshy-t2', 'topology': 'triangle',
                'target_polycount': brief['triangles'], 'target_formats': ['glb']}, 5)
        elif args.verb == 'refine':
            source = adapter.ledger()['tasks'][name]
            if source['state'] != 'SUCCEEDED':
                raise RuntimeError('A successful recorded preview is required')
            adapter.submit(name + '-textured', 'text-to-3d', {'mode': 'refine', 'preview_task_id': source['id'],
                'texture_prompt': brief['texture'], 'texture_resolution': '2k', 'enable_pbr': False,
                'remove_lighting': True, 'target_formats': ['glb']}, 10)
        elif args.verb == 'retexture':
            source=adapter.ledger()['tasks'][name+'-textured']
            if source['state']!='SUCCEEDED':raise RuntimeError('Successful textured source required')
            adapter.submit(name+'-repaint','retexture',{'input_task_id':source['id'],
                'text_style_prompt':brief['repaint'],'enable_original_uv':True,'enable_pbr':False,
                'texture_resolution':'2k','remove_lighting':True,'target_formats':['glb']},10)
        elif args.verb in ['status', 'wait']:
            adapter.status(name + ('-repaint' if args.repaint else '-textured' if args.textured else ''), 50 if args.verb == 'wait' else None)
        else:
            args.name = name + ('-repaint' if args.repaint else '-textured' if args.textured else '')
            args.asset = ['model.glb', 'thumbnail']
            adapter.download(args)

if __name__ == '__main__':
    main()
