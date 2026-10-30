import datetime,json,os,subprocess,time
from pathlib import Path
root=Path('docs/carlisle-relay/final-validation')
plan=json.loads((root/'remainder-plan.json').read_text())
report={'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'groups':plan['remainingGroups'],'results':[],'status':'running'}
for i,entry in enumerate(plan['commands']):
    path=root/(str(i+1).zfill(3)+'-'+Path(entry['args'][1] if entry['args'][1]!='-B' else entry['args'][2]).stem+'.log')
    start=time.monotonic()
    with path.open('w') as log:
        result=subprocess.run(entry['args'],stdout=log,stderr=subprocess.STDOUT)
    record={**entry,'exitCode':result.returncode,'seconds':round(time.monotonic()-start,2),'log':str(path)}
    report['results'].append(record)
    (root/'remainder-results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'index':i+1,'total':len(plan['commands']),'command':entry['command'],'exitCode':result.returncode}),flush=True)
report['status']='finished';report['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
report['failed']=sum(r['exitCode']!=0 for r in report['results']);report['passed']=len(report['results'])-report['failed']
(root/'remainder-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':'finished','passed':report['passed'],'failed':report['failed']}),flush=True)
