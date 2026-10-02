"""Pirate props through the official Meshy CLI; credentials never enter assets."""
import json, os, subprocess, sys, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'.img2threejs/pirate-wreck';LEDGER=ROOT/'tools/pirate-wreck/tasks.json'
CLI=os.environ.get('PIRATE_MESHY_CLI','/private/tmp/pirate-meshy-cli/node_modules/@meshy-ai/cli/dist/index.js')
NODE=os.environ.get('PIRATE_NODE',str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'))
PROMPTS={
'cannon':'Stylized low poly ancient pirate naval cannon on a chunky wooden wheeled carriage. Long dark iron barrel with a flared muzzle, brass bands, two large wooden wheels, weathered oak carriage, rope fastening. Strong clear silhouette, handcrafted polygonal game asset, no ground, no background, no people. Single isolated prop.',
 'treasure':'Stylized low poly pirate treasure chest, open lid with ornate thick gold straps and a skull lock, weathered dark oak, overflowing with large gold coins, rubies and emeralds. Broad readable polygonal silhouette, charming 1980s treasure adventure game prop, no ground, no people, no background. Single isolated chest.',
 'skull-gate':'Stylized low poly monumental pirate skull cave doorway carved from ancient stone. Hollow dark eye sockets, enormous open mouth wide enough to walk through, broken teeth around the opening, rough faceted stone arch integrated around skull. Moss in cracks, weathered sea cave artifact. Isolated freestanding arch, open passage through mouth, no floor, no background, no people.'}
def cli(*args):
 p=subprocess.run([NODE,CLI,*args,'--output-schema','v1','--no-update-check'],capture_output=True,text=True,cwd=ROOT)
 try:b=json.loads(p.stdout)
 except ValueError:raise SystemExit('Official Meshy CLI returned non-JSON')
 if not b.get('ok'):raise SystemExit(json.dumps({k:(b.get('error')or{}).get(k) for k in ['code','http_status']}))
 return b['result']
def save(d):LEDGER.write_text(json.dumps(d,indent=2)+'\n')
WORK.mkdir(parents=True,exist_ok=True)
d=json.loads(LEDGER.read_text()) if LEDGER.exists() else {'provider':'Meshy','model':'meshy-t2','authorization':'User explicitly approved all Meshy jobs with positive existing balance; no purchases or upgrades.','tasks':{}}
verb=sys.argv[1];name=sys.argv[2] if len(sys.argv)>2 else None
if verb in ['create','refine']:
 key=name if verb=='create' else name+'-textured'
 if key in d['tasks']:print(json.dumps(d['tasks'][key]));sys.exit()
 balance=cli('balance').get('balance',0)
 if balance<=0:raise SystemExit('No existing credits remain; purchases and upgrades are forbidden')
 record={'operation':str(uuid.uuid4()),'prompt':PROMPTS[name],'status':'submitting','balanceBefore':balance};d['tasks'][key]=record;save(d)
 payload={'mode':'preview','prompt':PROMPTS[name],'model_type':'smart-topology','ai_model':'meshy-t2','topology':'triangle','target_polycount':2500,'target_formats':['glb']} if verb=='create' else {'mode':'refine','preview_task_id':d['tasks'][name]['id'],'texture_prompt':'Hand painted stylized low polygon game prop, warm weathered oak, aged brass, turquoise patina, readable broad color regions. No baked shadows.','texture_resolution':'2k','enable_pbr':False,'target_formats':['glb']}
 path=WORK/(key+'-request.json');path.write_text(json.dumps(payload))
 result=cli('text-to-3d','create','--data','@'+str(path),'--operation-id',record['operation'],'--async');(WORK/(key+'-submission.json')).write_text(json.dumps(result,indent=2))
 task=result.get('task') or result;record['id']=task.get('id') or task.get('task_id') or result.get('task_id');record['status']='submitted';save(d)
 print(json.dumps({'name':key,'id':record['id'],'keys':list(result)}))
elif verb=='status':
 record=d['tasks'][name];result=cli('text-to-3d','get',record['id']);(WORK/(name+'-status.json')).write_text(json.dumps(result,indent=2));task=result.get('task') or result
 record['status']=task.get('status');record['credits']=task.get('consumed_credits');save(d);print(json.dumps({k:task.get(k) for k in ['id','status','progress','credits_consumed','task_error']}))
elif verb=='download':
 record=d['tasks'][name];cli('download','--resource','text-to-3d','--task-id',record['id'],'--output-dir',str(WORK/name),'--asset','model.glb');print(json.dumps({'name':name,'downloaded':True}))
