"""Stomped Coral Crab through the existing official Meshy CLI adapter."""
from pathlib import Path
import importlib.util
import os
import sys

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('crab_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
adapter.HERE = HERE
adapter.WORK = ROOT/'.img2threejs/crab-carcass'
adapter.LEDGER = HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI', '/private/tmp/crab-carcass-meshy/node_modules/@meshy-ai/cli/dist/index.js')

def create(args):
    image = Path(args.image).resolve() if args.image else HERE/'references'/(args.name+'.png')
    if not image.is_file():
        raise RuntimeError('A reviewed reference image is required')
    if not adapter.LEDGER.exists():
        adapter.write_json(adapter.LEDGER, {'schemaVersion':1, 'provider':'Meshy',
            'model':'meshy-t2', 'modelType':'smart-topology', 'budgetCredits':15,
            'authorization':'User requested one new Meshy crab stomp carcass', 'tasks':{}})
    if not 100 <= args.triangles <= 15000:
        raise RuntimeError('Smart Topology target must be 100-15000 triangles')
    adapter.submit(args.name, 'image-to-3d', {
        'image_url':str(image), 'model_type':'smart-topology', 'ai_model':'meshy-t2',
        'target_polycount':args.triangles, 'should_texture':True, 'enable_pbr':True,
        'texture_resolution':'2k', 'target_formats':['glb'],
        'texture_prompt':('Defeated stomp-flattened red-orange cartoon crab, speckled shell, cream underside, limp claws and splayed legs. Exactly two bold DARK BROWN X marks painted directly on the smooth continuous red-orange face, matching the reference. The X marks ARE the eyes. No eyeballs, eye whites, pupils, round eye pads, sockets, eyelids, eyebrows, brow ridges or eye stalks. Keep both Xs crisp and visible from above. Preserve the detailed hand-painted cartoon materials. No extra objects or base.' if args.name == 'crab-stomped-x-only' else 'Preserve the reference character: defeated flattened red-orange cartoon crab with orange speckled shell, cream belly, limp red claws and four splayed legs. Both large ivory eyes have bold DARK BROWN X marks replacing pupils. Keep both X eyes crisp, readable and painted on the eyes. Matte hand-painted detailed cartoon game character. No extra objects, no base, no shadow baked into texture.'),
    }, 15, args.dry_run)

adapter.create = create
if __name__ == '__main__':
    if sys.argv[1:] == ['repair-x-only']:
        source = adapter.ledger()['tasks']['crab-stomped-x-only']
        assert source['state'] == 'SUCCEEDED'
        adapter.submit('crab-stomped-x-only-repaired', 'repair-printability',
            {'input_task_id':source['id']}, 10)
    elif sys.argv[1:] == ['texture-x-only']:
        source = adapter.ledger()['tasks']['crab-stomped-x-only-repaired']
        assert source['state'] == 'SUCCEEDED'
        adapter.submit('crab-stomped-x-only-final', 'retexture', {
            'input_task_id':source['id'],
            'image_style_url':str(HERE/'references/crab-stomped-x-only.png'),
            'enable_original_uv':False, 'enable_pbr':True,
            'texture_resolution':'2k', 'remove_lighting':True, 'target_formats':['glb'],
        }, 10)
    else:
        adapter.main()
