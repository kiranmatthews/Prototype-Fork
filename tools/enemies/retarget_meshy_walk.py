#!/usr/bin/env python3
"""Retarget sampled, user-owned Meshy quadruped walking onto an authored skin.

The Meshy FBX supplies every foot's timing and path. Model-specific rest joints
supply limb anchors/lengths; two-bone IK keeps the source stance phases on the
new model's ground plane. Only animation accessors and provenance are appended.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_rig import Glb
from prepare_meshy_walk import matrices

ROOT = Path(__file__).resolve().parents[2]
LEGS = {'frontLeft': ('front', 'Left', 'frontleg'), 'frontRight': ('front', 'Right', 'R_frontleg'),
        'hindLeft': ('hind', 'Left', 'backleg'), 'hindRight': ('hind', 'Right', 'R_backleg')}
CLIP_NAME = 'Meshy Quadruped Walk'


def unit(v):
    return v / max(1e-12, np.linalg.norm(v))


def rotation(matrix):
    u, _, vt = np.linalg.svd(np.asarray(matrix)[:3, :3])
    result = u @ vt
    if np.linalg.det(result) < 0:
        u[:, -1] *= -1; result = u @ vt
    return result


def quat(matrix):
    m = matrix
    trace = np.trace(m)
    if trace > 0:
        s = np.sqrt(trace+1)*2
        q = np.array([(m[2,1]-m[1,2])/s, (m[0,2]-m[2,0])/s, (m[1,0]-m[0,1])/s, .25*s])
    else:
        i = int(np.argmax(np.diag(m))); j = (i+1)%3; k = (i+2)%3
        s = np.sqrt(max(0,1+m[i,i]-m[j,j]-m[k,k]))*2
        q = np.zeros(4); q[i] = .25*s
        q[j] = (m[i,j]+m[j,i])/max(1e-12,s); q[k] = (m[i,k]+m[k,i])/max(1e-12,s)
        q[3] = (m[k,j]-m[j,k])/max(1e-12,s)
    return unit(q)


def quaternion_matrix(q):
    x,y,z,w = q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])


def scaled_rotation(matrix, strength):
    q = quat(matrix)
    if q[3] < 0: q = -q
    angle = np.arccos(np.clip(q[3],-1,1)); axis = unit(q[:3])
    return quaternion_matrix(np.r_[axis*np.sin(angle*strength),np.cos(angle*strength)])


def between(a,b):
    a,b = unit(a),unit(b); dot = float(np.clip(a@b,-1,1))
    if dot < -.999999:
        axis = unit(np.cross(a, [1,0,0] if abs(a[0]) < .8 else [0,1,0]))
        return quaternion_matrix(np.r_[axis,0])
    return quaternion_matrix(unit(np.r_[np.cross(a,b),1+dot]))


def intervals(contact, times, duration):
    # Explicit non-wrapping intervals make the loop boundary unambiguous.
    result=[]; start=None
    for i, value in enumerate(contact):
        if value and start is None: start=times[i]/duration
        if start is not None and (not value or i==len(contact)-1):
            end=times[i-1 if not value else i]/duration
            result.append([float(start),float(end)]); start=None
    return result


def solve_knee(a,c,l1,l2,pole):
    delta=c-a; distance=np.linalg.norm(delta)
    if distance > l1+l2+1e-7 or distance < abs(l1-l2)-1e-7:
        raise ValueError('Foot target outside authored limb reach')
    direction=unit(delta)
    along=(l1*l1-l2*l2+distance*distance)/max(1e-12,2*distance)
    height=np.sqrt(max(0,l1*l1-along*along))
    bend=unit(pole-direction*(pole@direction))
    return a+direction*along+bend*height


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('kind',choices=('grunt','spiker','turtle','charger'))
    parser.add_argument('--motion',type=Path,default=ROOT/'.img2threejs/enemies/motion-source/battle-turtle/walk.json')
    parser.add_argument('--input',type=Path); parser.add_argument('--output',type=Path)
    parser.add_argument('--rig-spec',type=Path); parser.add_argument('--report',type=Path)
    parser.add_argument('--stance-center',type=float,default=.5,
        help='Move the walk stance center this fraction from bind paw Z toward hip Z, without changing bind anchors')
    args=parser.parse_args()
    if not 0 <= args.stance_center <= .7: raise ValueError('Reviewed stance adaptation range is 0..0.7')
    source=args.input or ROOT/'public/enemies'/f'{args.kind}.glb'
    output=args.output or source
    spec_path=args.rig_spec or ROOT/'tools/enemies/rigs'/f'{args.kind}.json'
    spec=json.loads(spec_path.read_text()); motion=json.loads(args.motion.read_text())
    glb=Glb(source); doc=glb.document
    if not doc.get('skins'): raise ValueError('Retarget input must be the new model-specific authored skin')
    protected={key:copy.deepcopy(doc.get(key)) for key in ('meshes','skins','nodes')}
    original_arrays=[glb.read_accessor(i) for i in range(len(doc.get('accessors',[])))]
    node_index={n.get('name'):i for i,n in enumerate(doc['nodes'])}
    worlds=matrices(doc); parents={c:i for i,n in enumerate(doc['nodes']) for c in n.get('children',[])}
    samples=motion['samples']; times=np.array([s['time'] for s in samples]); count=len(times)
    duration=float(times[-1]-times[0]); times-=times[0]
    if count<20 or duration<=0: raise ValueError('Expected a complete sampled Meshy walking cycle')
    source_heads={name:np.array([s['joints'][name]['head'] for s in samples]) for name in motion['rest']}
    def delta_rotation(name,strength):
        all_rot=[rotation(s['joints'][name]['matrix']) for s in samples]
        result=[scaled_rotation(value@all_rot[0].T,strength) for value in all_rot]
        result[-1]=result[0].copy(); return np.array(result)
    body_rot=delta_rotation('Hips',.65)
    torso=node_index['torso']; torso_rest=worlds[torso][:3,3]
    rest_rot={i:rotation(w) for i,w in worlds.items()}
    leg_data={}
    for leg,(prefix,side,source_prefix) in LEGS.items():
        names=[prefix+segment+side for segment in ('Upper','Lower','Foot')]
        ids=[node_index[name] for name in names]
        a,b,c=[worlds[i][:3,3] for i in ids]
        lengths=[np.linalg.norm(b-a),np.linalg.norm(c-b)]
        chain=[source_prefix,source_prefix+'0',source_prefix+'1',source_prefix+'2']
        rest_points=[np.asarray(motion['rest'][name]['head']) for name in chain]
        source_length=sum(np.linalg.norm(y-x) for x,y in zip(rest_points,rest_points[1:]))
        foot=source_heads[chain[-1]].copy()
        foot[:,[0,2]]-=source_heads['Hips'][:,[0,2]]
        foot[-1]=foot[0]
        low=float(foot[:,1].min()); height=float(np.ptp(foot[:,1])); threshold=height*.20
        contact=foot[:,1] <= low+threshold+1e-12; contact[-1]=contact[0]
        delta=foot-foot.mean(axis=0)
        delta[:,1]=np.maximum(0,foot[:,1]-low-threshold)
        ratio=sum(lengths)/source_length
        delta*=ratio
        # Source side sway is retained at modest amplitude for each new stance width.
        delta[:,0]*=.35
        delta[-1]=delta[0]
        direction=unit(c-a); pole=b-a-direction*((b-a)@direction)
        if np.linalg.norm(pole)<1e-5:
            pole=np.array([(.4 if side=='Left' else -.4),0,(-1 if prefix=='front' else 1)])
        leg_data[leg]={'ids':ids,'names':names,'rest':[a,b,c],'lengths':lengths,'delta':delta,
            'centerOffset':np.array([0.,0.,(a[2]-c[2])*args.stance_center]),
            'contact':contact,'pole':unit(pole),'sourceFoot':chain[-1],
            'sourceLength':source_length,'sourceScale':ratio,'footRotation':delta_rotation(chain[-1],.32)}
        sole_points=[]
        for mesh_id,node in enumerate(doc['nodes']):
            if 'mesh' not in node or 'skin' not in node:continue
            skin=doc['skins'][node['skin']]
            if ids[2] not in skin['joints']:continue
            foot_index=skin['joints'].index(ids[2])
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                attrs=primitive['attributes'];j=glb.read_accessor(attrs['JOINTS_0']);w=glb.read_accessor(attrs['WEIGHTS_0'])
                ownership=np.sum(np.where(j==foot_index,w,0),axis=1)
                p=glb.read_accessor(attrs['POSITION'])[ownership>.5]
                if len(p):sole_points.append(p@worlds[mesh_id][:3,:3].T+worlds[mesh_id][:3,3])
        if not sole_points:raise ValueError(f'{names[2]} needs authored sole weights before walk clearance can be checked')
        foot_points=np.concatenate(sole_points)
        leg_data[leg]['footOffsets']=(foot_points-c)@rest_rot[ids[2]]
        leg_data[leg]['footRotationGain']=[]
    shortest=min(sum(d['lengths']) for d in leg_data.values())
    drop=shortest*.075
    hips_y=source_heads['Hips'][:,1]; hips_y-=hips_y.mean()
    bob=hips_y*np.median([d['sourceScale'] for d in leg_data.values()])
    bob[-1]=bob[0]
    torso_translation=np.tile(np.asarray(doc['nodes'][torso].get('translation',[0,0,0])),(count,1))
    torso_translation[:,1]+=bob-drop
    body_positions=np.tile(torso_rest,(count,1)); body_positions[:,1]+=bob-drop
    # Adapt stride amplitude to this model's actual reach, retaining phase and
    # footfall ordering. The contact targets remain on the exact rest plane.
    for data in leg_data.values():
        a,_,c=data['rest']; total=sum(data['lengths']); minimum=abs(data['lengths'][0]-data['lengths'][1])
        anchors=np.array([body_positions[i]+body_rot[i]@(a-torso_rest) for i in range(count)])
        def feasible(gain):
            targets=c+data['centerOffset']+data['delta']*np.array([gain,1,gain])
            distances=np.linalg.norm(targets-anchors,axis=1)
            return bool(np.all(distances<total*.998) and np.all(distances>minimum*1.002))
        gain=1.0
        if not feasible(gain):
            if not feasible(0): raise ValueError(f'{data["names"][0]} cannot reach neutral contacts; review its anchors')
            low,high=0.,1.
            for _ in range(40):
                middle=(low+high)*.5
                if feasible(middle):low=middle
                else:high=middle
            gain=low*.98
        data['strideGain']=gain; data['anchors']=anchors
        data['targets']=c+data['centerOffset']+data['delta']*np.array([gain,1,gain])
    # All four stance paws share the same ground-travel speed. Independent
    # limb reach adaptation must not make a long foreleg skid twice as far as
    # a shorter hindleg. Phase and vertical Meshy curves remain unchanged.
    def stance_speed(data):
        speeds=[]
        for i in range(1,count-1):
            if data['contact'][i-1:i+2].all():
                value=-(data['targets'][i+1,2]-data['targets'][i-1,2])/(times[i+1]-times[i-1])
                if value>0:speeds.append(value)
        return float(np.median(speeds))
    shared_speed=min(stance_speed(data) for data in leg_data.values())
    for data in leg_data.values():
        gain=shared_speed/stance_speed(data)
        data['speedEqualization']=gain;data['strideGain']*=gain
        data['targets']=data['rest'][2]+data['centerOffset']+data['delta']*np.array([data['strideGain'],1,data['strideGain']])
    tracks={torso:{'translation':torso_translation,'rotation':[]}}
    for name in ('head','tail'):
        if name in node_index:tracks[node_index[name]]={'rotation':[]}
    for data in leg_data.values():
        for index in data['ids']:tracks[index]={'rotation':[]}
    head_rot=delta_rotation('head',.25 if args.kind=='grunt' else .65); tail_rot=delta_rotation('tail',.65)
    max_error=0.
    for frame in range(count):
        body=body_rot[frame]@rest_rot[torso]; parent=parents.get(torso)
        tracks[torso]['rotation'].append(quat((rest_rot[parent].T if parent is not None else np.eye(3))@body))
        for name,values in (('head',head_rot),('tail',tail_rot)):
            if name in node_index:
                i=node_index[name]; tracks[i]['rotation'].append(quat(body.T@values[frame]@rest_rot[i]))
        for data in leg_data.values():
            upper,lower,foot=data['ids']; a,b,c=data['rest']; anchor=data['anchors'][frame]; target=data['targets'][frame]
            knee=solve_knee(anchor,target,*data['lengths'],body_rot[frame]@data['pole'])
            upper_world=between(b-a,knee-anchor)@rest_rot[upper]
            lower_world=between(c-b,target-knee)@rest_rot[lower]
            foot_gain=0. if data['contact'][frame] else 1.
            def foot_pose(gain):return scaled_rotation(data['footRotation'][frame],gain)@rest_rot[foot]
            def sole_clear(gain):return (data['footOffsets']@foot_pose(gain).T+target)[:,1].min()>=-1e-6
            # A big crab paw cannot take the source turtle's ankle pitch at
            # low clearance. Keep the source orientation as far as its actual
            # weighted sole allows; phase/trajectory/stance timing stay exact.
            if foot_gain and not sole_clear(foot_gain):
                low,high=0.,1.
                for _ in range(32):
                    middle=(low+high)*.5
                    if sole_clear(middle):low=middle
                    else:high=middle
                foot_gain=low*.97
            foot_world=foot_pose(foot_gain);data['footRotationGain'].append(foot_gain)
            tracks[upper]['rotation'].append(quat(body.T@upper_world))
            tracks[lower]['rotation'].append(quat(upper_world.T@lower_world))
            tracks[foot]['rotation'].append(quat(lower_world.T@foot_world))
            reached=anchor+upper_world@rest_rot[upper].T@(b-a)+lower_world@rest_rot[lower].T@(c-b)
            max_error=max(max_error,float(np.linalg.norm(reached-target)))
    time_accessor=glb.add_accessor(times.astype('<f4')[:,None],5126,'SCALAR')
    doc['accessors'][time_accessor].update(min=[float(times.min())],max=[float(times.max())])
    clip={'name':CLIP_NAME,'samplers':[],'channels':[]}
    for index,paths in tracks.items():
        for path,raw in paths.items():
            values=np.asarray(raw,dtype='<f4'); values[-1]=values[0]
            if path=='rotation':
                for i in range(1,len(values)):
                    if values[i-1]@values[i]<0:values[i]*=-1
            accessor=glb.add_accessor(values,5126,'VEC4' if path=='rotation' else 'VEC3')
            sampler=len(clip['samplers']);clip['samplers'].append({'input':time_accessor,'output':accessor,'interpolation':'LINEAR'})
            clip['channels'].append({'sampler':sampler,'target':{'node':index,'path':path}})
    doc['animations']=[a for a in doc.get('animations',[]) if a.get('name')!=CLIP_NAME]+[clip]
    contact_map={leg:intervals(d['contact'],times,duration) for leg,d in leg_data.items()}
    speeds=[]
    for data in leg_data.values():
        for i in range(1,count-1):
            if data['contact'][i-1:i+2].all():
                speed=-(data['targets'][i+1,2]-data['targets'][i-1,2])/(times[i+1]-times[i-1])
                if speed>0:speeds.append(speed)
    walk_speed=float(np.median(speeds))
    metadata=copy.deepcopy(spec.get('enemyRig',{}))
    metadata.update(walkClip=CLIP_NAME,walkSpeed=walk_speed,walkContacts=contact_map)
    metadata['sourceSha256']=spec['sourceSha256']
    metadata['generatedSourceSha256']=spec.get('generatedSourceSha256',spec['sourceSha256'])
    catalog=json.loads((ROOT/'tools/enemies/motion-sources.json').read_text())
    motion_record=next(record for record in catalog['sources'] if any(
        file['sha256']==motion['sourceSha256'] for file in record['files']))
    metadata['motionProvenance']={'provider':'Meshy','sourceFbxSha256':motion['sourceSha256'],
        'sourceArchiveSha256':motion_record['archiveSha256'],'sourceId':motion_record['id'],
        'sourceAction':motion['action'],'sourceFps':motion['fps'],'sourceDuration':motion['duration'],
        'adaptation':'Sampled foot trajectories with model-specific two-bone IK and ground-contact correction'}
    # Both locations remain compatible with existing authored-GLB loaders.
    doc['scenes'][doc.get('scene',0)].setdefault('extras',{})['enemyRig']=metadata
    for node in doc['nodes']:
        if node.get('name')=='enemyRoot':node.setdefault('extras',{})['enemyRig']=metadata
    output.parent.mkdir(parents=True,exist_ok=True);glb.save(output)
    after=Glb(output)
    assert after.document['meshes']==protected['meshes'] and after.document['skins']==protected['skins']
    for i,values in enumerate(original_arrays):assert np.array_equal(after.read_accessor(i),values),i
    assert max_error<1e-6,max_error
    report={'kind':args.kind,'clip':CLIP_NAME,'duration':duration,'fps':motion['fps'],'frames':count,
        'walkSpeed':walk_speed,'contacts':contact_map,'sourceFbxSha256':motion['sourceSha256'],
        'sourceMotionJsonSha256':hashlib.sha256(args.motion.read_bytes()).hexdigest(),
        'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'outputBytes':output.stat().st_size,
        'maxAnalyticIkError':max_error,'bodyDrop':drop,'stanceCenter':args.stance_center,
        'sharedStanceSpeed':shared_speed,
        'legs':{leg:{'sourceFoot':d['sourceFoot'],'sourceScale':d['sourceScale'],'strideGain':d['strideGain'],
            'sourceLiftPeakFrame':int(np.argmax(source_heads[d['sourceFoot']][:,1])),
            'speedEqualization':d['speedEqualization'],'centerOffset':d['centerOffset'].tolist(),
            'targetLiftPeakFrame':int(np.argmax(d['targets'][:,1])),
            'targetFootRange':np.ptp(d['targets'],axis=0).tolist(),
            'restAnchor':d['rest'][2].tolist(),'targets':d['targets'].tolist(),
            'footRotationGain':d['footRotationGain'],
            'planted':d['contact'].tolist()} for leg,d in leg_data.items()}}
    report_path=args.report or ROOT/'.img2threejs/enemies'/f'{args.kind}-walk-retarget.json'
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    # Preserve every model-specific anatomy field authored by the rig baker.
    spec['enemyRig']=metadata;spec['walkSourceSha256']=motion['sourceSha256']
    spec['animationSource']='Existing user-owned Meshy quadruped FBX walk, retargeted with model-specific IK'
    spec['outputSha256']=report['outputSha256'];spec['outputBytes']=report['outputBytes']
    spec['walkRetarget']={k:report[k] for k in ('sourceMotionJsonSha256','duration','fps','frames','maxAnalyticIkError','walkSpeed','stanceCenter','sharedStanceSpeed')}
    spec['walkRetarget']['adaptation']='Halfway hip-centered walking stance; original bind anchors unchanged; source contact timing/vertical curves retained; equalized stance travel speed; per-paw sole clearance limits swing pitch.'
    spec_path.write_text(json.dumps(spec,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='legs'},indent=2))


if __name__=='__main__':main()
