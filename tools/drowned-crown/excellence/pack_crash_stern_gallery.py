#!/usr/bin/env python3
"""Pack the complete Meshy stern gallery without modifying provider surfaces."""
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
from prepare_meshy_walk import compact_textures, world_vertices

NAME='crash-stern-gallery'
SOURCE=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(NAME+'-remeshed')/'downloads/model.glb'
TARGET=ROOT/'public/drowned-crown/excellence'/(NAME+'.glb')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--front-negative',action='store_true',help='Provider windows face the negative depth axis')
    args=parser.parse_args()
    jobs=json.loads((HERE/'tasks.json').read_text())['tasks']
    generation=jobs[NAME+'-textured'];remesh=jobs[NAME+'-remeshed']
    assert generation['state']==remesh['state']=='SUCCEEDED'
    glb=Glb(SOURCE);d=glb.document
    original=[glb.read_accessor(i) for i in range(len(d['accessors']))]
    points=world_vertices(glb);assert np.isfinite(points).all()
    # A root rotation makes the broad horizontal façade axis X. The original
    # front is selected from the provider geometry and texture inspection.
    rotation=np.eye(3)
    if np.ptp(points[:,2])>np.ptp(points[:,0]):
        rotation=np.array([[0,0,1],[0,1,0],[-1,0,0]])
    if args.front_negative:rotation=np.diag([-1,1,-1])@rotation
    oriented=points@rotation.T;lo=oriented.min(0);hi=oriented.max(0)
    scale=16/(hi[0]-lo[0]);size=(hi-lo)*scale
    matrix=np.eye(4);matrix[:3,:3]=rotation*scale
    matrix[:3,3]=-np.array([(lo[0]+hi[0])*.5,lo[1],(lo[2]+hi[2])*.5])*scale
    scene=d['scenes'][d.get('scene',0)];children=scene['nodes'][:]
    scene['nodes']=[len(d['nodes'])]
    d['nodes'].append({'name':'Stern gallery rigid orientation and uniform fit',
                      'matrix':matrix.T.ravel().tolist(),'children':children})
    textures=compact_textures(glb,4096,95,data_limit=2048,lossless_data=True)
    for i,values in enumerate(original):
        assert np.array_equal(glb.read_accessor(i),values),('Changed provider accessor',i)
    triangles=sum(len(glb.read_accessor(p['indices']))//3 for m in d['meshes'] for p in m['primitives'])
    d['asset'].setdefault('extras',{}).update({'provider':'Meshy','generationTaskId':generation['id'],
        'providerRemeshTaskId':remesh['id'],'originalProviderGeometryUVsNormals':True,'rootTransformOnly':True,
        'newGeometryAuthoredLocally':False,'localTexturePainting':False,'windowFace':'positive Z','origin':'bottom center'})
    glb.save(TARGET)
    fitted=world_vertices(glb)
    assert np.allclose(np.ptp(fitted,axis=0),size) and abs(fitted[:,1].min())<1e-8
    report={'provider':'Meshy','generationTaskId':generation['id'],'remeshTaskId':remesh['id'],
        'generationCredits':generation.get('consumedCredits',30),'remeshCredits':remesh.get('consumedCredits',5),
        'reference':generation['reference'],'referenceSha256':generation['referenceSha256'],
        'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':sha(SOURCE),
        'output':str(TARGET.relative_to(ROOT)),'outputSha256':sha(TARGET),'bytes':TARGET.stat().st_size,
        'triangles':triangles,'vertices':len(points),'size':size.round(6).tolist(),'rootMatrix':matrix.T.ravel().tolist(),
        'windowFace':'positive Z','bottomY':0,'sourceFrontNegativeDepth':args.front_negative,
        'providerMeshAccessorsUnchangedDuringPacking':True,'newGeometryAuthoredLocally':False,'textures':textures}
    orientation=HERE/'stern-gallery-orientation.json'
    if orientation.exists():report['orientationInspection']=json.loads(orientation.read_text())
    (HERE/'stern-gallery-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    (ROOT/'src/drownedCrownGallery.generated.ts').write_text(
        '/** Complete Meshy stern gallery; original provider remesh, normals and UVs. */\n'
        'export const DROWNED_CROWN_GALLERY_MODELS={\n'
        ' crowncrashsterngallery:{file:"../drowned-crown/excellence/crash-stern-gallery",'
        'label:"Drowned Crown · sculpted red and gold stern gallery",size:'+json.dumps(report['size'])+
        ',wind:false,normalStrength:.2,cellSize:32,windowGlow:true,doubleSided:false},\n} as const;\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['textures','rootMatrix']}))


if __name__=='__main__':
    main()
