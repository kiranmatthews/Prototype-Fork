"""Produce the masonry question-mark pad with the shared official Meshy CLI adapter."""
from pathlib import Path
import argparse
import importlib.util
import json
import os
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.WORK = ROOT / '.img2threejs/bonus-question'
adapter.LEDGER = ROOT / 'tools/bonus-platform/question-task.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/treehouse-trials-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
NAME = 'question-masonry'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['submit', 'status', 'wait', 'download', 'balance'])
    args = parser.parse_args()
    if args.command == 'balance':
        print(json.dumps(adapter.require_success(adapter.cli('balance'))))
        return
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion': 1, 'provider': 'Meshy',
            'budgetCredits': 15, 'model': 'meshy-t2', 'modelType': 'smart-topology', 'tasks': {}})
    if args.command == 'submit':
        adapter.submit(NAME, 'image-to-3d', {
            'image_url': str(ROOT / 'art/bonus-platform/question-masonry.png'),
            'model_type': 'smart-topology', 'ai_model': 'meshy-t2', 'target_polycount': 3500,
            'should_texture': True, 'enable_pbr': True, 'texture_resolution': '2k',
            'texture_prompt': 'Match the reference: a broad chunky question mark made from warm golden sandstone masonry blocks, embedded in the top of a circular dark blue-grey stone platform. Preserve the distinct individual stone colours, narrow mortar joints and bevelled stone edges. Readable simple painted stone, no extra symbols or text.',
            'target_formats': ['glb'],
        }, 15)
    elif args.command == 'download':
        adapter.download(SimpleNamespace(name=NAME, asset=['model.glb']))
    else:
        adapter.status(NAME, 50 if args.command == 'wait' else None)

if __name__ == '__main__':
    main()
