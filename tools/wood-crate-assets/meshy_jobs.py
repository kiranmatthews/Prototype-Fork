#!/usr/bin/env python3
"""One classic wood crate, using the existing official Meshy CLI adapter."""
import argparse
import importlib.util
import os
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('wood_crate_meshy_adapter', ROOT/'tools/enemies/meshy_assets.py')
adapter = importlib.util.module_from_spec(spec); spec.loader.exec_module(adapter)
adapter.ROOT=ROOT; adapter.HERE=HERE; adapter.WORK=ROOT/'.img2threejs/wood-crate'; adapter.LEDGER=HERE/'tasks.json'
os.environ.setdefault('ENEMY_MESHY_CLI','/private/tmp/ghost-train-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
os.environ.setdefault('ENEMY_NODE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPT = 'One classic wooden shipping crate. Perfect CLOSED CUBE, equally wide tall and deep. Warm honey oak planks. Thick square timber frame at all twelve edges, broad diagonal X braces on all four vertical faces, flat closed wooden plank top and bottom. Subtle bevels, few dark iron nail heads. Strong clean iconic game silhouette, charming handcrafted low poly platformer prop. Extremely simple solid geometry, no contents, gaps, handles, lid protrusions, markings, text, background, ground or props. All detail fits inside cube. 240 triangle game mesh.'
TEXTURE = 'Beautiful hand painted classic wood crate, honey amber oak planks, warm chestnut timber frame and diagonal X braces. Clear dark narrow plank seams, subtle long grain and tiny knots, worn pale golden edges, restrained dark iron nail heads. All six faces wooden, top and bottom closed plank panels. Crisp broad readable warm wood regions, restrained contrast. No letters, logos, stickers, milk, plastic, cast shadows or directional lighting. Original cartoon platformer prop.'
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('verb',choices=['preview','refine','status','wait','download','balance'])
    parser.add_argument('--textured',action='store_true'); parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args(); name='classic-wood-crate'+('-textured' if args.textured else '')
    if args.verb=='preview':
        adapter.submit(name,'text-to-3d',{'mode':'preview','prompt':PROMPT,'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle','target_polycount':240,'target_formats':['glb']},5,args.dry_run)
    elif args.verb=='refine':
        source=adapter.ledger()['tasks']['classic-wood-crate']
        if source.get('state')!='SUCCEEDED':raise RuntimeError('Successful preview required before texturing')
        adapter.submit('classic-wood-crate-textured','text-to-3d',{'mode':'refine','preview_task_id':source['id'],'texture_prompt':TEXTURE,'texture_resolution':'2k','enable_pbr':False,'remove_lighting':True,'target_formats':['glb']},10,args.dry_run)
    elif args.verb in ['status','wait']:adapter.status(name,50 if args.verb=='wait' else None)
    elif args.verb=='download':
        args.name=name;args.asset=['model.glb','thumbnail'];adapter.download(args)
    else:print(adapter.require_success(adapter.cli('balance')))
if __name__=='__main__':main()
