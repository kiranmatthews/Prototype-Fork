#!/usr/bin/env python3
"""Partition the measured Meshy armor into rigid, independently editable parts.

This preserves every original textured triangle and the complete rest silhouette.
Joints are model-specific source coordinates for the runtime's robotic pose rig.
"""
from pathlib import Path
import copy
import hashlib
import json
import sys
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb

PATH=ROOT/'public/ghost-train/clockwork-knight.glb'
glb=Glb(PATH)
source=copy.deepcopy(glb.document)
raw=bytes(glb.binary)
if source['asset'].get('extras',{}).get('armorSegmented'):
    raise RuntimeError('Repack the original static knight before segmenting again')
surfaces=[]
for mesh in source['meshes']:
    for primitive in mesh['primitives']:
        arrays={key:glb.read_accessor(index) for key,index in primitive['attributes'].items()}
        types={key:(source['accessors'][index]['componentType'],source['accessors'][index]['type'])
            for key,index in primitive['attributes'].items()}
        indices=glb.read_accessor(primitive['indices']).ravel().astype(int).reshape(-1,3)
        surfaces.append((primitive,arrays,types,indices))

pivots={
    'Torso':[0,.52,-.012], 'Head':[0,.828,.018],
    'LeftUpperArm':[.148,.757,.006], 'LeftForearm':[.219,.663,.025],
    'RightUpperArm':[-.148,.757,.006], 'RightForearm':[-.219,.663,.025],
    'LeftThigh':[.078,.476,.015], 'LeftShin':[.082,.284,.026], 'LeftFoot':[.079,.092,.074],
    'RightThigh':[-.078,.476,.015], 'RightShin':[-.082,.284,.026], 'RightFoot':[-.079,.092,.074],
}

def region(centroid):
    x,y,z=centroid
    side='Left' if x>=0 else 'Right'
    # Pauldron spires can be higher than the head/neck separation plane.
    if abs(x)>.235 and y>.56:
        return side+'Forearm'
    if abs(x)>.135 and y>.585:
        return side+'UpperArm'
    if y>.822:
        return 'Head'
    # The entire cape remains on the breastplate/backplate segment.
    if z<-.078 and y>.135:
        return 'Torso'
    if y<.49:
        if y<.097:return side+'Foot'
        if y<.303:return side+'Shin'
        return side+'Thigh'
    return 'Torso'

glb.binary=bytearray()
doc=glb.document
doc['accessors']=[]
doc['bufferViews']=[]
doc['meshes']=[]
doc['nodes']=[]
for image in doc.get('images',[]):
    previous=source['bufferViews'][image['bufferView']]
    offset=previous.get('byteOffset',0)
    while len(glb.binary)%4:glb.binary.append(0)
    index=len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer':0,'byteOffset':len(glb.binary),'byteLength':previous['byteLength']})
    glb.binary.extend(raw[offset:offset+previous['byteLength']])
    image['bufferView']=index

counts={name:0 for name in pivots}
bounds={}
for name in pivots:
    primitives=[]
    positions=[]
    for primitive,arrays,types,indices in surfaces:
        centres=arrays['POSITION'][indices].mean(axis=1)
        labels=np.array([region(centre) for centre in centres])
        chosen=indices[labels==name]
        if not len(chosen):continue
        selected,remapped=np.unique(chosen.ravel(),return_inverse=True)
        attributes={}
        for key,array in arrays.items():
            component,type_name=types[key]
            values=array[selected]
            index=glb.add_accessor(values,component,type_name,34962)
            if key=='POSITION':
                doc['accessors'][index]['min']=values.min(axis=0).tolist()
                doc['accessors'][index]['max']=values.max(axis=0).tolist()
                positions.append(values)
            attributes[key]=index
        index=glb.add_accessor(remapped.astype('<u2').reshape(-1,1),5123,'SCALAR',34963)
        primitives.append({'attributes':attributes,'indices':index,'material':primitive.get('material',0)})
        counts[name]+=len(chosen)
    if not primitives:raise ValueError('Missing required armor region '+name)
    mesh_index=len(doc['meshes'])
    doc['meshes'].append({'name':name,'primitives':primitives})
    values=np.concatenate(positions)
    bounds[name]={'min':values.min(axis=0).tolist(),'max':values.max(axis=0).tolist()}
    doc['nodes'].append({'name':name,'mesh':mesh_index,'extras':{'ghostTrainRegion':name}})

total=sum(len(surface[3]) for surface in surfaces)
assert sum(counts.values())==total
root_index=len(doc['nodes'])
rig={'pivots':pivots,'trianglesByRegion':counts,'regionBounds':bounds,
    'coordinates':'Y-up,+Z-forward,max dimension 1,ground Y=0',
    'restGeometry':'Every triangle retained; vertices remain in source normalized world coordinates',
    'style':'Rigid articulated armor; robotic joint holds and independent segment elasticity'}
doc['nodes'].append({'name':'GhostTrainKnight','children':list(range(root_index)),
    'extras':{'ghostTrainRig':rig}})
doc['scenes']=[{'nodes':[root_index]}]
doc['scene']=0
doc['asset'].setdefault('extras',{})['armorSegmented']=True
glb.save(PATH)
provenance_path=PATH.with_suffix('.provenance.json')
provenance=json.loads(provenance_path.read_text())
provenance.update(outputSha256=hashlib.sha256(PATH.read_bytes()).hexdigest(),bytes=PATH.stat().st_size,
    semanticRigidSegments=list(pivots),trianglesByRegion=counts,restTrianglesPreserved=True)
provenance_path.write_text(json.dumps(provenance,indent=2)+'\n')
manifest_path=ROOT/'tools/ghost-train-assets/asset-manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['clockwork-knight']=provenance
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'tools/ghost-train-assets/knight-rig.json').write_text(json.dumps(rig,indent=2)+'\n')
print(json.dumps({'triangles':total,'bytes':PATH.stat().st_size,'regions':counts,'pivots':pivots}))
