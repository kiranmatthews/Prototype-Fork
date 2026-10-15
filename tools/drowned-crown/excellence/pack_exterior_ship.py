#!/usr/bin/env python3
"""Pack the provider-remeshed exterior ship without changing mesh accessors.

A single rigid root rotation and uniform scale align the existing ship. Texture
packing changes file encoding only; no surface is modeled, decimated or painted.
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
from prepare_meshy_walk import compact_textures, world_vertices

NAME='crash-exterior-ship'
SOURCE=ROOT/'.img2threejs/drowned-crown/excellence/meshy'/(NAME+'-remeshed')/'downloads/model.glb'
TARGET=ROOT/'public/drowned-crown/excellence'/(NAME+'.glb')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--flip-bow',action='store_true',help='Reverse the measured bowsprit direction after visual review')
    args=parser.parse_args()
    jobs=json.loads((HERE/'tasks.json').read_text())['tasks']
    generation=jobs[NAME+'-textured'];remesh=jobs[NAME+'-remeshed']
    assert generation['state']==remesh['state']=='SUCCEEDED'
    glb=Glb(SOURCE);d=glb.document
    before=[glb.read_accessor(i) for i in range(len(d['accessors']))]
    points=world_vertices(glb)
    assert np.isfinite(points).all()
    # The hull's lower half supplies heading without tall flags/rigging bias.
    hull=points[points[:,1]<points[:,1].min()+np.ptp(points[:,1])*.48]
    _,basis=np.linalg.eigh(np.cov(hull[:,[0,2]],rowvar=False))
    along=basis[:,-1];across=np.array([along[1],-along[0]])
    longitudinal=points[:,[0,2]]@along;transverse=points[:,[0,2]]@across
    low,high=longitudinal.min(),longitudinal.max();span=high-low
    end_low=longitudinal<low+span*.1;end_high=longitudinal>high-span*.1
    end_widths=[float(np.ptp(transverse[mask])) for mask in [end_low,end_high]]
    # A bowsprit is slender at the longitudinal extreme; the stern gallery is
    # broad. Keep this inference in provenance for the native model review.
    bow_low=end_widths[0]<end_widths[1]
    if args.flip_bow:bow_low=not bow_low
    sign=1 if bow_low else -1
    z=np.array([along[0],0,along[1]])*sign
    rotation=np.array([[z[2],0,-z[0]],[0,1,0],z])
    assert abs(np.linalg.det(rotation)-1)<1e-9
    oriented=points@rotation.T;lo=oriented.min(0);hi=oriented.max(0)
    scale=60/(hi[2]-lo[2]);size=(hi-lo)*scale
    matrix=np.eye(4);matrix[:3,:3]=rotation*scale
    matrix[:3,3]=-np.array([(lo[0]+hi[0])*.5,lo[1],(lo[2]+hi[2])*.5])*scale
    scene=d['scenes'][d.get('scene',0)];children=scene['nodes'][:]
    scene['nodes']=[len(d['nodes'])]
    d['nodes'].append({'name':'Exterior ship rigid orientation and uniform fit',
                      'matrix':matrix.T.ravel().tolist(),'children':children})
    textures=compact_textures(glb,4096,95,data_limit=2048,lossless_data=True)
    for i,values in enumerate(before):
        assert np.array_equal(glb.read_accessor(i),values),('Changed provider accessor',i)
    triangle_count=sum(len(glb.read_accessor(p['indices']))//3 for m in d['meshes'] for p in m['primitives'])
    d['asset'].setdefault('extras',{}).update({'provider':'Meshy','generationTaskId':generation['id'],
        'providerRemeshTaskId':remesh['id'],'originalProviderGeometryUVsNormals':True,
        'rootTransformOnly':True,'newGeometryAuthoredLocally':False,'localTexturePainting':False,
        'bowDirection':'negative Z','longAxis':'Z','origin':'bottom center'})
    glb.save(TARGET)
    fitted=world_vertices(glb)
    assert np.allclose(np.ptp(fitted,axis=0),size) and abs(fitted[:,1].min())<1e-8
    report={'provider':'Meshy','generationTaskId':generation['id'],'remeshTaskId':remesh['id'],
        'generationCredits':generation.get('consumedCredits',30),'remeshCredits':remesh.get('consumedCredits',5),
        'reference':generation['reference'],'referenceSha256':generation['referenceSha256'],
        'source':str(SOURCE.relative_to(ROOT)),'sourceSha256':sha(SOURCE),
        'output':str(TARGET.relative_to(ROOT)),'outputSha256':sha(TARGET),'bytes':TARGET.stat().st_size,
        'triangles':triangle_count,'vertices':len(points),'size':size.round(6).tolist(),
        'rootMatrix':matrix.T.ravel().tolist(),'longAxis':'Z','bowDirection':'negative Z','bottomY':0,
        'bowDirectionMethod':'Narrow bowsprit versus broad stern in end 10 percent, with optional visual reversal',
        'sourceEndWidths':end_widths,'bowLowBeforeRotation':bow_low,
        'providerMeshAccessorsUnchangedDuringPacking':True,'newGeometryAuthoredLocally':False,
        'textures':textures}
    (HERE/'exterior-ship-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
    (ROOT/'src/drownedCrownExterior.generated.ts').write_text(
        '/** Complete Meshy exterior ship; rigid fit, original provider remesh and UVs. */\n'
        'export const DROWNED_CROWN_EXTERIOR_MODELS={\n'
        ' crowncrashexteriorship:{file:"../drowned-crown/excellence/crash-exterior-ship",'
        'label:"Drowned Crown · complete Meshy exterior ship",size:'+json.dumps(report['size'])+
        ',wind:false,normalStrength:.2,cellSize:96,doubleSided:true},\n} as const;\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['textures','rootMatrix']}))


if __name__=='__main__':
    main()
