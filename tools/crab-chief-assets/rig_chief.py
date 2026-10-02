#!/usr/bin/env python3
"""Model-specific independent-segment skin for the actual Meshy chief surface."""
from pathlib import Path
import json
import hashlib
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures

source = ROOT/'.img2threejs/crab-chief/chief-v2/downloads/model.glb'
if not source.is_file(): source = ROOT/'.img2threejs/crab-chief/chief-v2.glb'
output = ROOT/'public/boss/crab-chief.glb'
glb = Glb(source); doc = glb.document
primitive = doc['meshes'][0]['primitives'][0]
positions = glb.read_accessor(primitive['attributes']['POSITION']).astype(np.float64)
positions[:, 1] += .5; positions *= 8.2
pi = glb.add_accessor(positions.astype('<f4'), 5126, 'VEC3', 34962)
doc['accessors'][pi]['min'] = positions.min(axis=0).tolist(); doc['accessors'][pi]['max'] = positions.max(axis=0).tolist()
primitive['attributes']['POSITION'] = pi
doc['nodes'][0].pop('matrix', None)
doc['nodes'][0]['name'] = 'MeshyChiefSurface'

joints = {'torso':[0,3.05,0], 'head':[0,6.0,.12], 'crown':[0,7.05,0],
    'skirtFront':[0,3.0,.65], 'skirtBack':[0,3.0,-.65], 'skirtLeft':[-1.65,3.0,0], 'skirtRight':[1.65,3.0,0]}
segments = {}
for side, sign in [('Left',-1),('Right',1)]:
    joints.update({f'upperArm{side}':[sign*1.75,5.05,0],f'forearm{side}':[sign*2.5,3.85,.1],
        f'claw{side}':[sign*3.05,2.75,.18],f'pincer{side}':[sign*3.4,2.05,.48],
        f'upperLeg{side}':[sign*.9,3.0,0],f'lowerLeg{side}':[sign*1.13,1.65,.1],
        f'foot{side}':[sign*1.23,.48,.22]})
    segments.update({f'upperArm{side}':(joints[f'upperArm{side}'],joints[f'forearm{side}']),
        f'forearm{side}':(joints[f'forearm{side}'],joints[f'claw{side}']),
        f'upperLeg{side}':(joints[f'upperLeg{side}'],joints[f'lowerLeg{side}']),
        f'lowerLeg{side}':(joints[f'lowerLeg{side}'],joints[f'foot{side}'])})

def rotate_up(direction):
    target=np.asarray(direction,dtype=float);target/=np.linalg.norm(target)
    up=np.array([0.,1.,0.]); axis=np.cross(up,target); c=np.dot(up,target)
    if c < -.999999: return np.diag([1.,-1.,-1.])
    k=np.array([[0,-axis[2],axis[1]],[axis[2],0,-axis[0]],[-axis[1],axis[0],0]])
    return np.eye(3)+k+k@k/(1+c)

names=list(joints); matrices=[]
for name in names:
    matrix=np.eye(4);matrix[:3,3]=joints[name]
    if name in segments: matrix[:3,:3]=rotate_up(np.asarray(segments[name][1])-segments[name][0])
    matrices.append(matrix)
    doc['nodes'].append({'name':name,'matrix':matrix.T.flatten().tolist()})
joint_indices=list(range(1,1+len(names)))
inverse=np.array([np.linalg.inv(m).T.flatten() for m in matrices],dtype='<f4')
ibm=glb.add_accessor(inverse,5126,'MAT4')

# Semantic masks fitted to this chief: outer low vertices are claw tips,
# not feet; the broad shoulder mantle stays with the torso.
weights=np.zeros((len(positions),len(names)),dtype=float)
def blend(i, a, b, t):
    t=float(np.clip(t,0,1));weights[i,names.index(a)]=1-t;weights[i,names.index(b)]=t
for i,p in enumerate(positions):
    x,y,z=p; side='Left' if x<0 else 'Right'; ax=abs(x)
    if y<.95 and ax<2.25: blend(i,f'lowerLeg{side}',f'foot{side}',(.95-y)/.25)
    elif y>7.05: blend(i,'head','crown',(y-7.05)/.25)
    elif y>5.55: blend(i,'torso','head',(y-5.55)/.45)
    elif y>4.9: weights[i,names.index('torso')]=1
    elif ax>1.9 and y>3.35:
        blend(i,f'upperArm{side}',f'forearm{side}',(4.45-y)/.65)
    elif ax>1.85:
        blend(i,f'forearm{side}',f'claw{side}',(3.75-y)/.45)
        # The inside jaw is a small, independent hinge. Blend its base across
        # the shell rather than cutting a rigid skin boundary through triangles.
        jaw=float(np.clip((z-.4)/.3,0,1)*np.clip((2.55-y)/.4,0,1)*.55)
        weights[i]*=1-jaw;weights[i,names.index(f'pincer{side}')]+=jaw
    elif y<.95: blend(i,f'lowerLeg{side}',f'foot{side}',(.95-y)/.25)
    elif y<2.45 and ax>.45 and abs(z)<.65:
        blend(i,f'upperLeg{side}',f'lowerLeg{side}',(1.95-y)/.55)
    elif y<3.1 and (abs(z)>.42 or ax>1.35):
        role='skirtFront' if z>.2 else 'skirtBack' if z<-.2 else f'skirt{side}'
        blend(i,'torso',role,(3.1-y)/.45)
    else: weights[i,names.index('torso')]=1
# Smooth skin boundaries on welded geometric neighbours. UV/hard-normal seams
# receive identical weights, preserving the generated surface when articulated.
_,weld=np.unique(np.round(positions,4),axis=0,return_inverse=True)
count=int(weld.max())+1
w=np.zeros((count,len(names)));n=np.bincount(weld,minlength=count)
np.add.at(w,weld,weights);w/=n[:,None]
tri=weld[glb.read_accessor(primitive['indices']).astype(int).reshape(-1,3)]
edges=np.unique(np.sort(np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]),axis=1),axis=0)
src=np.concatenate([edges[:,0],edges[:,1]]);dst=np.concatenate([edges[:,1],edges[:,0]])
degree=np.bincount(src,minlength=count)
for _ in range(5):
    mean=np.zeros_like(w);np.add.at(mean,src,w[dst]);mean/=np.maximum(1,degree)[:,None]
    w=.65*w+.35*mean;w/=np.maximum(1e-12,w.sum(axis=1))[:,None]
weights=w[weld]
# Flood each boot from its sole through the generated surface. The boots have
# wide crab toes reaching +/-2.8m, so a rectangular shin mask is insufficient.
vertices=np.zeros((count,3));np.add.at(vertices,weld,positions);vertices/=n[:,None]
links=[[] for _ in range(count)]
for a,b in edges:
    if vertices[a,1]<1.35 and vertices[b,1]<1.35:
        links[a].append(b);links[b].append(a)
boot=np.zeros(count,dtype=bool)
queue=list(np.flatnonzero((vertices[:,1]<.08)&(np.abs(vertices[:,0])<3.0)))
boot[queue]=True
while queue:
    a=queue.pop()
    for b in links[a]:
        if not boot[b]:boot[b]=True;queue.append(b)
for i,(x,y,z) in enumerate(positions):
    if boot[weld[i]]:
        weights[i]=0;weights[i,names.index('footLeft' if x<0 else 'footRight')]=1
order=np.argsort(-weights,axis=1)[:,:4];values=np.take_along_axis(weights,order,axis=1)
values/=values.sum(axis=1,keepdims=True)
primitive['attributes']['JOINTS_0']=glb.add_accessor(order.astype('<u2'),5123,'VEC4',34962)
primitive['attributes']['WEIGHTS_0']=glb.add_accessor(values.astype('<f4'),5126,'VEC4',34962)
doc['nodes'][0]['skin']=0
doc['skins']=[{'name':'Chief fitted independent segment rig','joints':joint_indices,'inverseBindMatrices':ibm}]
root_index=len(doc['nodes'])
metadata={'provider':'Meshy','taskId':'01a0fc87-0dbf-71be-b1d2-76ba0c02411c','height':8.2,
    'rigProvenance':'model-specific authored skin; provider humanoid rig rejected giant pincers',
    'joints':joints,'segments':segments,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
doc['nodes'].append({'name':'ChiefRig','children':[0]+joint_indices,'extras':{'chiefRig':metadata}})
doc['scenes'][doc.get('scene',0)]['nodes']=[root_index]
textures=compact_textures(glb,1024,88)
output.parent.mkdir(parents=True,exist_ok=True);glb.save(output)
report={'sourceSha256':metadata['sourceSha256'],'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
    'joints':len(names),'triangles':doc['accessors'][primitive['indices']]['count']//3,
    'vertices':len(positions),'bytes':output.stat().st_size,'textures':textures,
    'minimumWeightSum':float(values.sum(axis=1).min()),'maximumWeightSum':float(values.sum(axis=1).max()),
    'bounds':[positions.min(axis=0).tolist(),positions.max(axis=0).tolist()]}
output.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
