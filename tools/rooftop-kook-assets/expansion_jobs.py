"""User-authorized second pass; official Meshy CLI owns all jobs and waits."""
import argparse
import json
from pathlib import Path
from meshy_jobs import adapter, HERE

def main():
 p=argparse.ArgumentParser();p.add_argument('verb',choices=['create','status','wait','download','rig','animations']);p.add_argument('names',nargs='+');args=p.parse_args()
 for name in args.names:
  if args.verb=='create':
   character=name in ('karen','kook','karen-rain','kook-rain')
   payload={'image_url':str(HERE/'references'/f'{name}.png'),'ai_model':'meshy-7.1','geometry_resolution':'4k','should_remesh':True,'topology':'triangle','target_polycount':40000 if character else 80000,'should_texture':True,'enable_pbr':True,'texture_resolution':'4k','target_formats':['glb']}
   if name=='heirloom-shotgun':payload.update(target_polycount=20000,geometry_resolution='2k',texture_resolution='2k')
   if name=='storm-balustrade':payload.update(target_polycount=24000,geometry_resolution='2k',texture_resolution='2k')
   if character:payload['pose_mode']='a-pose'
   adapter.submit(name,'image-to-3d',payload,35)
  elif args.verb=='rig':
   source=adapter.ledger()['tasks'][name]
   if source.get('status')!='SUCCEEDED' and source.get('state')!='SUCCEEDED':
    response=json.loads((adapter.WORK/name/'response.json').read_text());raw=response.get('result',{});assert 'SUCCEEDED' in json.dumps(raw)
   adapter.submit(name+'-rig','rigging',{'input_task_id':source['id'],'height_meters':2.35 if name.startswith('karen') else 2.5},5)
  elif args.verb in ('status','wait'):adapter.status(name,50 if args.verb=='wait' else None)
  elif args.verb=='download':adapter.download(argparse.Namespace(name=name,asset=None))
  else:
   clips={'karen-idle':('karen',0),'karen-shout':('karen',51),'karen-angry':('karen',311),
    'kook-idle':('kook',0),'kook-aim':('kook',585),'kook-shoot':('kook',234),
    'karen-rain-idle':('karen-rain',0),'karen-rain-shout':('karen-rain',51),'karen-rain-angry':('karen-rain',311),'kook-rain-idle':('kook-rain',0)}
   character,action=clips[name]
   adapter.submit(name,'animate',{'rig_task_id':adapter.ledger()['tasks'][character+'-rig']['id'],'action_id':action},3)

if __name__=='__main__':main()
