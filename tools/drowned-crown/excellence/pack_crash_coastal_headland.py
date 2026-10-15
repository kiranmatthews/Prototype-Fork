"""Pack the fitted provider-remeshed headland, retaining its clipped UVs/normals."""
from pathlib import Path
import hashlib,json,sys
import numpy as np
ROOT=Path(__file__).resolve().parents[3];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures
NAME='crash-coastal-headland'
source=ROOT/'.img2threejs/drowned-crown/excellence/prepared'/(NAME+'-fitted.glb')
raw=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(NAME+'-remeshed')/'downloads/model.glb'
target=ROOT/'public/drowned-crown/excellence'/(NAME+'.glb')
fit=json.loads((HERE/'fitted-crash-coastal-headland.json').read_text())
jobs=json.loads((HERE/'tasks.json').read_text())['tasks'];generation=jobs[NAME+'-textured'];remesh=jobs[NAME+'-remeshed']
assert generation['state']==remesh['state']=='SUCCEEDED'
g=Glb(source);original=[g.read_accessor(i).copy() for i in range(len(g.document['accessors']))]
textures=compact_textures(g,4096,96,data_limit=2048,lossless_data=True)
for i,values in enumerate(original):assert np.array_equal(g.read_accessor(i),values),('Changed fitted accessor',i)
g.document['asset'].setdefault('extras',{}).update({'provider':'Meshy','generationTaskId':generation['id'],
 'providerRemeshTaskId':remesh['id'],'uniformFitOnly':True,'passageCutsOnly':True,'originalUVsRetained':True,
 'localDecimation':False,'localTexturePainting':False})
g.save(target)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={**fit,'provider':'Meshy','generationTaskId':generation['id'],'remeshTaskId':remesh['id'],
 'generationCredits':generation.get('consumedCredits',30),'remeshCredits':remesh.get('consumedCredits',5),
 'reference':generation['reference'],'referenceSha256':generation['referenceSha256'],
 'sourceSha256':sha(raw),'fittedSource':str(source.relative_to(ROOT)),'fittedSourceSha256':sha(source),
 'output':str(target.relative_to(ROOT)),'outputSha256':sha(target),'bytes':target.stat().st_size,
 'textures':textures,'fittedAccessorsUnchangedDuringPacking':True}
(HERE/'crash-coastal-headland-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
(ROOT/'src/drownedCrownCoastal.generated.ts').write_text(
 '/** Provider-remeshed Crash coastal headland; uniform fit and existing route cuts. */\n'
 'export const DROWNED_CROWN_COASTAL_MODELS={\n'
 ' crowncrashheadland:{file:"../drowned-crown/excellence/crash-coastal-headland",label:"Drowned Crown · Crash coastal headland",size:'+json.dumps(fit['size'])+',wind:false,normalStrength:.2,cellSize:200,doubleSided:false},\n} as const;\n'
 'export const DROWNED_CRASH_HEADLAND_POSITION='+json.dumps(fit['position'])+' as const;\n'
 'export const DROWNED_CRASH_HEADLAND_FORT_ANCHORS='+json.dumps(fit['fortAnchors'])+' as const;\n'
 'export const DROWNED_CRASH_HEADLAND_PALM_ANCHORS='+json.dumps(fit['palmAnchors'])+' as const;\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['textures','passages']}))
