"""Moonbone scenery through the existing official Meshy CLI and credit ledger."""
from pathlib import Path
import importlib.util
import os
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('moonbone_meshy_adapter', ROOT / 'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.HERE = HERE
adapter.WORK = ROOT / '.img2threejs/moonbone'
adapter.LEDGER = HERE / 'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/crab-carcass-meshy/node_modules/@meshy-ai/cli/dist/index.js')

def create(args):
    if args.name not in ('moonbone-skull', 'moonbone-rib-arch', 'moonbone-crypt'):
        raise RuntimeError('Only the three authorized Moonbone props may be generated')
    image = HERE / 'references' / (args.name + '.png')
    if not image.is_file():
        raise RuntimeError('Reviewed reference image is required')
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {
            'schemaVersion': 1, 'provider': 'Meshy', 'model': 'meshy-t2',
            'modelType': 'smart-topology', 'budgetCredits': 50,
            'authorization': 'User authorized up to 50 Meshy credits for Moonbone Vault props; Crash 4 / punk / 90s art direction. Three textured jobs at 15 credits each. No credit purchases.',
            'tasks': {},
        })
    adapter.submit(args.name, 'image-to-3d', {
        'image_url': str(image), 'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
        'target_polycount': 12000 if args.name == 'moonbone-crypt' else 10000,
        'should_texture': True, 'enable_pbr': True, 'texture_resolution': '4k',
        'target_formats': ['glb'],
        'texture_prompt': 'Match the reference exactly: playful chunky cartoon platform-game prop, hand-painted broad color blocks, warm creamy ivory, indigo and lavender painted shadows, cobalt stone, bold cyan and hot-magenta punk paint. Preserve exaggerated asymmetry, thick sculpted bevels, big deliberate chips and clean readable silhouette. Matte finish, no realistic gritty noise or fine cracks. Preserve the crystal eyes or shrine relic where present. No floor, background, pedestal, extra props or moon ornament.',
    }, 15, args.dry_run)

adapter.create = create
if __name__ == '__main__':
    adapter.main()
