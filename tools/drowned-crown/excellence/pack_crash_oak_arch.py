#!/usr/bin/env python3
"""Pack the Meshy-remeshed oak arch with one rigid root and uniform scale.

Original position, normal, UV and index accessors remain byte-identical.
Texture changes are file encoding only: 4K colour JPEG95 and 2K data PNG.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import numpy as np

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures,world_vertices,matrices

NAME='crash-oak-arch'
SOURCE=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(NAME+'-remeshed')/'downloads/model.glb'
TARGET=ROOT/'public/drowned-crown/excellence'/(NAME+'.glb')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def world_triangles(glb):
    doc=glb.document
    parts=[]
    for index,matrix in matrices(doc).items():
        node=doc['nodes'][index]
        if 'mesh' not in node:
            continue
        for primitive in doc['meshes'][node['mesh']]['primitives']:
            assert primitive.get('mode',4)==4,'Expected provider GLB triangle primitives'
            points=glb.read_accessor(primitive['attributes']['POSITION'])
            points=points@matrix[:3,:3].T+matrix[:3,3]
            indices=(glb.read_accessor(primitive['indices']).reshape(-1) if 'indices' in primitive else np.arange(len(points)))
            parts.append(points[indices.reshape(-1,3)])
    return np.concatenate(parts)


def opening_report(triangles,height):
    # Orthographic rays through the complete depth reveal any added threshold
    # or filled centre. Only inspect the provider mesh; never cut/remodel it.
    a=triangles[:,0,:2]
    e1=triangles[:,1,:2]-a
    e2=triangles[:,2,:2]-a
    det=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0]
    live=np.abs(det)>1e-10
    a,e1,e2,det=a[live],e1[live],e2[live],det[live]
    def blocked(x,y):
        delta=np.array([x,y])-a
        u=(delta[:,0]*e2[:,1]-delta[:,1]*e2[:,0])/det
        v=(e1[:,0]*delta[:,1]-e1[:,1]*delta[:,0])/det
        return bool(np.any((u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)))
    centre=[{'x':0,'y':round(float(y),4),'blocked':blocked(0,y)}
            for y in [.08,.25,.6,1,2,3,4,5,min(6,height*.62)]]
    widths=[]
    for y in [1,3,5,7,height*.7]:
        if y>=height:
            continue
        right=next((x for x in np.arange(0,7.01,.05) if blocked(x,y)),7)
        left=next((x for x in np.arange(0,-7.01,-.05) if blocked(x,y)),-7)
        widths.append({'height':round(float(y),4),'left':round(float(left),3),
                       'right':round(float(right),3),'clearWidth':round(float(right-left),3)})
    return {'method':'Depth-through silhouette rays against all original provider triangles',
            'centralOpeningClear':not any(p['blocked'] for p in centre),
            'bottomCrossbarAbsentAtCentre':not any(p['blocked'] for p in centre if p['y']<=.6),
            'centreProbes':centre,'clearWidths':widths}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--flip-front',action='store_true',help='Rigidly reverse front after model review')
    args=parser.parse_args()
    tasks=json.loads((HERE/'tasks.json').read_text())['tasks']
    generation,remesh=tasks[NAME+'-textured'],tasks[NAME+'-remeshed']
    assert generation['state']==remesh['state']=='SUCCEEDED'
    glb=Glb(SOURCE);doc=glb.document
    before=[glb.read_accessor(i) for i in range(len(doc['accessors']))]
    points=world_vertices(glb)
    assert np.isfinite(points).all()
    _,axes=np.linalg.eigh(np.cov(points[:,[0,2]],rowvar=False))
    width=axes[:,-1]
    if width[0]<0:
        width=-width
    x=np.array([width[0],0,width[1]])
    z=np.array([-width[1],0,width[0]])
    if args.flip_front:
        x=-x;z=-z
    rotation=np.array([x,[0,1,0],z])
    assert abs(np.linalg.det(rotation)-1)<1e-9
    oriented=points@rotation.T
    lo,hi=oriented.min(0),oriented.max(0)
    scale=14/(hi[0]-lo[0]);size=(hi-lo)*scale
    matrix=np.eye(4);matrix[:3,:3]=rotation*scale
    matrix[:3,3]=-np.array([(lo[0]+hi[0])*.5,lo[1],(lo[2]+hi[2])*.5])*scale
    scene=doc['scenes'][doc.get('scene',0)]
    children=scene['nodes'][:];scene['nodes']=[len(doc['nodes'])]
    doc['nodes'].append({'name':'Oak arch rigid orientation and uniform 14m width',
                        'matrix':matrix.T.ravel().tolist(),'children':children})
    textures=compact_textures(glb,4096,95,data_limit=2048,lossless_data=True)
    for i,values in enumerate(before):
        assert np.array_equal(glb.read_accessor(i),values),('Changed provider accessor',i)
    fitted=world_vertices(glb)
    assert np.allclose(np.ptp(fitted,axis=0),size) and abs(fitted[:,1].min())<1e-8
    triangles=world_triangles(glb)
    opening=opening_report(triangles,float(size[1]))
    assert opening['centralOpeningClear'],'Provider arch has a filled opening or bottom crossbar; do not integrate'
    doc['asset'].setdefault('extras',{}).update({'provider':'Meshy','generationTaskId':generation['id'],
        'providerRemeshTaskId':remesh['id'],'originalProviderGeometryUVsNormals':True,
        'rootTransformOnly':True,'newGeometryAuthoredLocally':False,'localTexturePainting':False,
        'frontDirection':'positive Z','longAxis':'X','origin':'feet bottom center',
        'openCentreConfirmed':opening['centralOpeningClear']})
    TARGET.parent.mkdir(parents=True,exist_ok=True);glb.save(TARGET)
    report={'provider':'Meshy','generationTaskId':generation['id'],'remeshTaskId':remesh['id'],
        'generationCredits':generation.get('consumedCredits',30),'remeshCredits':remesh.get('consumedCredits',5),
        'reference':generation['reference'],'referenceSha256':generation['referenceSha256'],
        'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':sha(SOURCE),
        'output':str(TARGET.relative_to(ROOT)),'outputSha256':sha(TARGET),'bytes':TARGET.stat().st_size,
        'triangles':len(triangles),'vertices':len(points),'size':size.round(6).tolist(),
        'rootMatrix':matrix.T.ravel().tolist(),'longAxis':'X','frontDirection':'positive Z','bottomY':0,
        'orientationMethod':'Horizontal principal width, source-positive-Z front; Y retained; optional rigid reversal',
        'frontReversed':args.flip_front,'providerMeshAccessorsUnchangedDuringPacking':True,
        'newGeometryAuthoredLocally':False,'localTexturePainting':False,'opening':opening,'textures':textures}
    (HERE/'crash-oak-arch-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    (ROOT/'src/drownedCrownArch.generated.ts').write_text(
        '/** Complete Meshy oak arch; original provider remesh, UVs and paint. */\n'
        'export const DROWNED_CROWN_ARCH_MODELS={\n'
        ' crowncrashoakarch:{file:"../drowned-crown/excellence/crash-oak-arch",'
        'label:"Drowned Crown · complete Meshy oak arch",size:'+json.dumps(report['size'])+
        ',wind:false,normalStrength:.2,cellSize:40,doubleSided:false},\n} as const;\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['textures','rootMatrix']}))


if __name__=='__main__':
    main()
