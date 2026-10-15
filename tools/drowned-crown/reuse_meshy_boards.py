"""Reuse the existing Meshy boards, changing only their root orientation.

Geometry, UVs, texture bytes and PBR materials remain exactly as delivered by
Meshy. The existing boardwalk manifest supplies the verified axis alignment.
"""
from pathlib import Path
import sys,json,copy,hashlib
import numpy as np
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'));from glb_rig import Glb
HERE=ROOT/'tools/drowned-crown';source_root=Path(sys.argv[1])
manifest=json.loads((ROOT/'tools/boardwalk/asset-manifest.json').read_text())
out=ROOT/'public/drowned-crown/boards';out.mkdir(exist_ok=True)
report=[];registration=[]
for name in ['plank-split','plank-worn','plank-chipped','beam-hewn']:
    folder='beam-hewn-image-v2' if name=='beam-hewn' else name+'-textured'
    source=source_root/folder/'downloads/model.glb';raw=source.read_bytes();spec=manifest[name]
    assert hashlib.sha256(raw).hexdigest()==spec['sourceSha256'],name+' source differs from the existing Meshy boardwalk kit'
    g=Glb(source);d=g.document;binary=bytes(g.binary);materials=copy.deepcopy(d.get('materials'));meshes=copy.deepcopy(d['meshes'])
    # Align the original source's principal axes, exactly as the existing
    # boardwalk runtime does. No vertex, UV, normal or material is rewritten.
    matrix=np.eye(4);matrix[:3,:3]=np.array(spec['sourceBasis']).T
    scene=d['scenes'][d.get('scene',0)];children=scene['nodes'][:];scene['nodes']=[len(d['nodes'])]
    d['nodes'].append({'name':'Existing Meshy board axis alignment','matrix':matrix.T.ravel().tolist(),'children':children})
    d['asset']['extras']={**d['asset'].get('extras',{}),'provider':'Meshy','taskId':spec['task'],'sourceSha256':spec['sourceSha256'],'originalGeometryUVsTexturesAndMaterials':True,'newProviderCredits':0}
    assert bytes(g.binary)==binary and d['materials']==materials and d['meshes']==meshes
    target=out/(name+'.glb');g.save(target)
    size=np.array(spec['sourcePrincipalSize']);size=size*((2.6/size[1]) if spec['family']=='timber' else (.76/size[2]));kind='crownmeshy'+name.replace('-','')
    registration.append(f" {kind}:{{file:'../drowned-crown/boards/{name}',label:'Existing Meshy board · {name}',size:{json.dumps(size.round(6).tolist())},wind:false,normalStrength:.15,doubleSided:false}},")
    report.append({'name':name,'provider':'Meshy','sourceTask':spec['task'],'sourceSha256':spec['sourceSha256'],'output':str(target.relative_to(ROOT)),'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size,'triangles':spec['triangles'],'originalGeometryUVsTexturesAndMaterials':True,'onlyChange':'Root principal-axis rotation','newProviderCredits':0})
(ROOT/'src/drownedCrownBoards.generated.ts').write_text('/** Original Meshy boardwalk planks and support timber, reused without re-authoring. */\nexport const DROWNED_CROWN_BOARD_MODELS={\n'+'\n'.join(registration)+'\n} as const;\n')
(HERE/'meshy-board-reuse.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
