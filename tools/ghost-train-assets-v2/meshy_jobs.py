#!/usr/bin/env python3
"""Nine original castle kit assets through the pinned official Meshy CLI.

One named operation per billable stage; no blind re-submission. Credentials and
expiring provider responses stay with the CLI/ignored authoring workspace.
"""
from pathlib import Path
import argparse
import importlib.util
import json
import os
import sys

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ghost_v2_meshy_adapter',ROOT/'tools/enemies/meshy_assets.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
adapter.ROOT=ROOT;adapter.HERE=HERE;adapter.WORK=ROOT/'.img2threejs/ghost-train-v2';adapter.LEDGER=HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI','/private/tmp/ghost-train-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPTS=json.loads((HERE/'prompts.json').read_text())

def preview(name,dry_run=False):
    specification=PROMPTS[name]
    if len(specification['prompt'])>600:raise ValueError('Preview prompt exceeds 600 characters: '+name)
    adapter.submit(name,'text-to-3d',{'mode':'preview','prompt':specification['prompt'],
        'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle',
        'target_polycount':specification['triangles'],'target_formats':['glb']},5,dry_run)

def refine(name,dry_run=False):
    source=adapter.ledger()['tasks'][name]
    if source.get('state')!='SUCCEEDED':raise RuntimeError('Successful preview required before texture refinement: '+name)
    adapter.submit(name+'-textured','text-to-3d',{'mode':'refine','preview_task_id':source['id'],
        'texture_prompt':PROMPTS[name]['texture'],'texture_resolution':'2k','enable_pbr':False,
        'remove_lighting':True,'target_formats':['glb']},10,dry_run)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb',choices=['preview','refine','status','wait','download','balance','cloth-retexture'])
    parser.add_argument('name',nargs='?',default='all')
    parser.add_argument('--dry-run',action='store_true');parser.add_argument('--textured',action='store_true')
    args=parser.parse_args()
    if args.verb=='balance':print(json.dumps(adapter.require_success(adapter.cli('balance'))));return
    if args.verb=='cloth-retexture':
        source=adapter.ledger()['tasks']['banquet-table-v2-textured']
        if source.get('state')!='SUCCEEDED':raise RuntimeError('Successful textured table required')
        adapter.submit('banquet-table-v2-cloth','retexture',{'input_task_id':source['id'],
            'text_style_prompt':'Hand painted gothic haunted banquet table. MOST OF THE TABLETOP is covered by a rich deep burgundy purple velvet tablecloth runner, ornate visible GOLD embroidered scrollwork and gold edging across the tabletop and down the thin apron sides. Dark honey oak wood only on carved claw legs and narrow tabletop borders. Worn antique gold metal accents. Clear strong burgundy red and gold surface regions, handcrafted rich game texture. Preserve all original geometry and UV layout. No heavy black baked shadows, no directional light.',
            'enable_original_uv':True,'enable_pbr':False,'texture_resolution':'2k','remove_lighting':True,'target_formats':['glb']},10,args.dry_run);return
    names=list(PROMPTS) if args.name=='all' else [args.name]
    for name in names:
        if args.verb=='preview':preview(name,args.dry_run)
        elif args.verb=='refine':refine(name,args.dry_run)
        elif args.verb in ['status','wait']:adapter.status(name+('-textured' if args.textured else ''),50 if args.verb=='wait' else None)
        elif args.verb=='download':
            args.name=name+('-textured' if args.textured else '');args.asset=['model.glb','thumbnail'];adapter.download(args)

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,KeyError,OSError) as error:print(str(error),file=sys.stderr);sys.exit(1)
