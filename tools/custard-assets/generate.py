"""Generate the requested scenery with the official Meshy CLI; its wait owns polling.

Set MESHY_CLI to the installed official CLI command. Private API responses and
download URLs stay in ignored .img2threejs. The public ledger contains provenance.
Recorded operation IDs prevent duplicate submissions on a resumed run.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import hashlib, json, os, shlex, subprocess, sys, uuid

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
WORK=ROOT/'.img2threejs/custard-creek'
SPECS={'moss-boulder':6000,'willow-grove':12000,'mill-house':12000,'gorge-cliff':6500,'cliff-foliage':6500,'eroded-cliff':10000,'shore-rocks':4500,'bank-shrub':6500}
CLI=shlex.split(os.environ.get('MESHY_CLI','meshy'))

def run(name):
    folder=WORK/name;folder.mkdir(parents=True,exist_ok=True)
    public=HERE/(name+'-task.json')
    if public.exists():
        record=json.loads(public.read_text())
    else:
        reference=HERE/'references'/(name+'.png')
        record={'provider':'Meshy','model':'meshy-t2','resource':'image-to-3d','operationId':str(uuid.uuid4()),
          'createdAt':datetime.now(timezone.utc).isoformat(),'reference':str(reference.relative_to(ROOT)),
          'referenceSha256':hashlib.sha256(reference.read_bytes()).hexdigest(),'targetTriangles':SPECS[name],
          'state':'reserved'}
        public.write_text(json.dumps(record,indent=2)+'\n')
    if record['state']=='SUCCEEDED':print(name+': already generated',flush=True);return
    payload={'image_url':str(HERE/'references'/(name+'.png')),'model_type':'smart-topology','ai_model':'meshy-t2',
      'target_polycount':SPECS[name],'should_texture':True,'enable_pbr':True,'texture_resolution':'2k',
      'texture_prompt':'Match the reference exactly: warm natural ochre sandstone, olive moss and sage willow foliage, honey-brown weathered timber. Fine painterly texture detail, soft material variation. Neutral albedo with no baked strong directional lighting. Preserve every source material region.',
      'target_formats':['glb']}
    request=folder/'request.json';request.write_text(json.dumps(payload))
    command=CLI+['image-to-3d','create','--data','@'+str(request),'--operation-id',record['operationId'],
      '--timeout','1200','-o',str(folder/'download'),'--output-schema','v1','--no-update-check']
    print(name+': official Meshy generation started',flush=True)
    with (folder/'response.json').open('w') as out,(folder/'stderr.log').open('w') as err:
        result=subprocess.run(command,cwd=ROOT,stdout=out,stderr=err)
    response=json.loads((folder/'response.json').read_text())
    files=list((folder/'download').rglob('*.glb')) if (folder/'download').exists() else []
    record['state']='SUCCEEDED' if response.get('ok') and files else 'inspect-local-response'
    record['exitCode']=result.returncode
    if files:
        source=folder/(name+'-source.glb');source.write_bytes(files[0].read_bytes())
        record['sourceSha256']=hashlib.sha256(source.read_bytes()).hexdigest()
        record['sourceBytes']=source.stat().st_size
    public.write_text(json.dumps(record,indent=2)+'\n')
    print(name+': '+record['state'],flush=True)

if __name__=='__main__':
    selected=sys.argv[1:] or list(SPECS)
    assert all(name in SPECS for name in selected)
    with ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(run,selected))
