#!/usr/bin/env python3
"""Chief/scenery production through the existing official Meshy CLI adapter."""
from pathlib import Path
import importlib.util

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('chief_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.ROOT = ROOT
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/crab-chief'
adapter.LEDGER = HERE/'tasks.json'
# Set ENEMY_MESHY_CLI for a non-global official CLI installation.

def create(args):
    image = Path(args.image).resolve() if args.image else HERE/'references'/(args.name+'.png')
    if not image.is_file():
        raise RuntimeError('Generate and save the reference image before submitting Meshy')
    if not 100 <= args.triangles <= 15000:
        raise RuntimeError('Smart Topology target must be 100–15000 triangles')
    payload = {'image_url': str(image), 'model_type': 'smart-topology', 'ai_model': 'meshy-t2',
        'target_polycount': args.triangles, 'should_texture': True, 'enable_pbr': False,
        'texture_resolution': '2k', 'target_formats': ['glb']}
    if args.name.startswith('chief-'):
        payload['pose_mode'] = 'a-pose'
    adapter.submit(args.name, 'image-to-3d', payload, 15, args.dry_run)

adapter.create = create
if __name__ == '__main__':
    adapter.main()
