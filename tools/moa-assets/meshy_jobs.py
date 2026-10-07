"""Moa and roast-chicken surfaces through the existing official Meshy CLI adapter."""
from pathlib import Path
import importlib.util
import os

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('moa_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/moa'
adapter.LEDGER = HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/treehouse-trials-meshy-cli/node_modules/.pnpm/@meshy-ai+cli@0.3.1/node_modules/@meshy-ai/cli/dist/index.js')

def create(args):
    image = Path(args.image).resolve() if args.image else HERE/'references'/(args.name+'.png')
    if not image.is_file():
        raise RuntimeError('A reviewed reference image is required')
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion':1, 'provider':'Meshy',
            'model':'meshy-t2', 'modelType':'smart-topology', 'budgetCredits':60, 'tasks':{}})
    if not 100 <= args.triangles <= 15000:
        raise RuntimeError('Smart Topology target must be 100–15000 triangles')
    adapter.submit(args.name, 'image-to-3d', {
        'image_url':str(image), 'model_type':'smart-topology', 'ai_model':'meshy-t2',
        'target_polycount':args.triangles, 'should_texture':True, 'enable_pbr':False,
        'texture_resolution':'2k', 'target_formats':['glb'],
        'texture_prompt':'Match this original reference: polished 1990s cartoon platformer art, broad hand-painted warm colours, bold readable features, matte surfaces, visible low-poly facets, no text, no extra objects. Preserve the exact character and colours.',
    }, 15, args.dry_run)

adapter.create = create
if __name__ == '__main__':
    adapter.main()
