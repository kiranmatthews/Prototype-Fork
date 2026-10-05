"""Write public-safe provenance with exact billing and final model budgets."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'public/carlisle-coast-fidelity'
data=json.loads((HERE/'tasks.json').read_text())
tasks={}
models=[]
for name,task in data['tasks'].items():
    assert task['state']=='SUCCEEDED', 'Refresh all source task states first'
    assert task['consumedCredits']==15, 'Reconcile billing before publication'
    clean={k:v for k,v in task.items() if k!='payload'}
    for attempt in clean.get('previousAttempts',[]):
        if attempt.get('errorCode')=='validation' and not attempt.get('id'):
            attempt['state']='rejected'; attempt['consumedCredits']=0
    tasks[name]=clean
    model=json.loads((OUT/(name+'-manifest.json')).read_text())
    model.update(path=name+'.glb',kind=task['kind'],size=task['size'],
        taskId=task['id'],referenceSha256=task['referenceSha256'])
    models.append(model)
total=sum(t['consumedCredits'] for t in tasks.values())
assert data['startingBalance']-data['latestBalance']==total
report={
    'schemaVersion':1,'provider':'Meshy','officialCliVersion':data['cliVersion'],
    'model':'meshy-t2','modelType':'smart-topology','textureGeneratedResolution':'2k',
    'referenceGenerator':'Built-in image_gen original isolated 3D reference concepts inspired by supplied Tiki Pits video','prompts':'tools/carlisle-coast-fidelity-assets/prompts.json',
    'request':data['request'],'tasks':tasks,'models':models,
    'credits':{'startingBalance':data['startingBalance'],'endingBalance':data['latestBalance'],
        'consumed':total,'validationRejected':0,'evidence':'Official CLI consumed_credits for both task handles and balance audit.'},
    'budgets':{'modelBytes':sum(m['bytes'] for m in models),
        'nearTriangles':sum(m['triangles'] for m in models),'farTriangles':sum(m['lodTriangles'] for m in models),
        'gpuAstc4x4Bytes':sum(t['astc4x4Bytes'] for m in models for t in m.get('gpuTextures',{}).get('textures',[]))},
    'textureEncoding':'UASTC quality 2 / lossless Zstd 18 with full mip chains and retained JPEG fallback. Geometry and UV bytes unchanged.',
    'placementContract':'One merged LOD0 and one LOD1, one atlas material, _JUNGLE_AO indirect-only scalar and _WIND_FLEX zero mask. Contact grids and profiles are measured from actual generated surfaces. Bottom anchored; fronts +Z.',
    'contactSurfaces':'contact-surfaces.json',
    'heroTextureLimit':2,
    'customAttributes':{'_JUNGLE_AO':'Scalar0.8–1.0 from5hemisphere rays, indirect light only; radius0.14largest span/offset0.0018span.', '_WIND_FLEX':'Zero scalar: the sandstone masses and fixed turf contain no wind-deforming parts.'},
    'review':'Each generated source was reviewed from front, rear and side in Blender at measured natural proportions; review renders remain in ignored .img2threejs/carlisle-coast-fidelity.',
}
(OUT/'contact-surfaces.json').write_text(json.dumps({name:json.loads((ROOT/'.img2threejs/carlisle-coast-fidelity'/(name+'-contacts.json')).read_text()) for name in tasks},indent=2)+'\n')
(OUT/'provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'models':len(models),'credits':report['credits'], 'budgets':report['budgets']},indent=2))
