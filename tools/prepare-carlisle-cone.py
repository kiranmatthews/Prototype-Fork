#!/usr/bin/env python3
"""Install the original literal cone; --legacy-evidence packages the old biped.
Raw and runtime GLBs stay local per TRIPO_CHARACTER_PIPELINE.md. This repeatable
step merges animation buffers, removes horizontal root travel, and fixes +X
source facing to +Z. It makes no network requests and spends no credits.
"""
import copy
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import shutil

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'tools/tripo-character/work/carlisle-cone-biped'
OUT = ROOT / 'public/props/carlisle-cone'

def read(path):
    data=path.read_bytes(); assert data[:4]==b'glTF'
    pos=12; document=None; binary=None
    while pos<len(data):
        size,kind=struct.unpack_from('<II',data,pos); chunk=data[pos+8:pos+8+size];pos+=8+size
        if kind==0x4E4F534A: document=json.loads(chunk)
        if kind==0x004E4942: binary=chunk
    assert document and binary is not None
    return document,binary

def write(path,doc,binary):
    binary+=b'\0'*(-len(binary)%4); doc['buffers']=[{'byteLength':len(binary)}]
    header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*(-len(header)%4)
    data=struct.pack('<III',0x46546C67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4E4F534A)+header+struct.pack('<II',len(binary),0x004E4942)+binary
    path.write_bytes(data)

if '--legacy-evidence' not in sys.argv:
    source=ROOT/'tools/tripo-character/work/carlisle-angry-cone/01-generate/tripo-out/carlisle-angry-cone-surface-9b3cba61/model.glb'
    doc,_=read(source)
    OUT.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,OUT/'cone-body.glb')
    report={'kind':'generative-assist','reference':'art/carlisle-cone/reference.png',
      'model':'P1-20260311','sourceTask':'9b3cba61-3202-46d7-93a7-fad1eaec23b4',
      'file':'public/props/carlisle-cone/cone-body.glb','runtimeSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'bytes':source.stat().st_size,'sourceForward':'+X','runtimeForward':'+Z',
      'geometryPolicy':'complete original literal-cone geometry and textures; no torso or neck',
      'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']),
      'joints':13,'rig':'src/carlisleConeRig.ts; tailored local skinning and motion, not the rejected Tripo humanoid rig',
      'clips':[{'name':'idle','duration':3.2},{'name':'walk','duration':1.25},{'name':'slash','duration':2.8}],
      'additionalCredits':0}
    (OUT/'asset.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    sys.exit(0)

records={clip:json.loads((WORK/'legacy-clips'/clip/'result.json').read_text()) for clip in ['idle','walk','slash']}
paths={clip:Path(result['model_file']) for clip,result in records.items()}
base,binary=read(paths['idle']); binary=bytearray(binary);base['animations']=[]
node_names={n.get('name'):i for i,n in enumerate(base['nodes'])}
report={'kind':'generative-assist','sourceForward':'+X','runtimeForward':'+Z','geometryPolicy':'complete authored geometry at every distance','clips':[]}
for clip,path in paths.items():
    doc,buf=read(path); assert doc.get('animations'), f'{clip}: no source animation'
    mapping={}
    def accessor(index):
        if index in mapping:return mapping[index]
        source=copy.deepcopy(doc['accessors'][index]);assert 'sparse' not in source
        view=copy.deepcopy(doc['bufferViews'][source['bufferView']]);assert view.get('buffer',0)==0
        start=view.get('byteOffset',0);blob=buf[start:start+view['byteLength']]
        binary.extend(b'\0'*(-len(binary)%4));view['byteOffset']=len(binary);view['buffer']=0
        source['bufferView']=len(base['bufferViews']);base['bufferViews'].append(view);binary.extend(blob)
        mapping[index]=len(base['accessors']);base['accessors'].append(source);return mapping[index]
    assert len(doc['animations'])==1, f'{clip}: expected one clip'
    anim=copy.deepcopy(doc['animations'][0]);anim['name']=clip
    for sampler in anim['samplers']:
        sampler['input']=accessor(sampler['input']);sampler['output']=accessor(sampler['output'])
    locked=[]
    for channel in anim['channels']:
        original=channel['target']['node'];name=doc['nodes'][original]['name'];assert name in node_names
        channel['target']['node']=node_names[name]
        if channel['target']['path']=='translation' and name in ('tripo::Root','Root','mixamorig:Hips','Hips'):
            sample=anim['samplers'][channel['sampler']];a=base['accessors'][sample['output']];view=base['bufferViews'][a['bufferView']]
            assert a['componentType']==5126 and a['type']=='VEC3' and sample.get('interpolation','LINEAR')!='CUBICSPLINE'
            offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',12)
            x,_,z=struct.unpack_from('<fff',binary,offset)
            for frame in range(a['count']):
                at=offset+stride*frame;struct.pack_into('<f',binary,at,x);struct.pack_into('<f',binary,at+8,z)
            a.pop('min',None);a.pop('max',None);locked.append(name)
    base['animations'].append(anim)
    report['clips'].append({'name':clip,'task':records[clip]['task_id'],'credits':records[clip].get('credits_consumed'),
        'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourcePreset':'preset:biped:'+('angry_01' if clip=='slash' else clip),'channels':len(anim['channels']),'horizontalRootLocked':locked})
# Put the entire skeleton and mesh under the same fixed facing transform.
scene=base['scenes'][base.get('scene',0)];root=len(base['nodes']);base['nodes'].append({'name':'cone-forward','rotation':[0,-math.sqrt(.5),0,math.sqrt(.5)],'children':scene['nodes']});scene['nodes']=[root]
base.setdefault('asset',{}).setdefault('extras',{})['provenance']={'kind':'generative-assist','generator':'Tripo P1 / rig v1.0','reference':'art/carlisle-cone/reference-biped.png'}
OUT.mkdir(parents=True,exist_ok=True);path=OUT/'cone.glb';write(path,base,bytes(binary))
report['runtimeSha256']=hashlib.sha256(path.read_bytes()).hexdigest();report['bytes']=path.stat().st_size
report['triangles']=sum(base['accessors'][p['indices']]['count']//3 for m in base['meshes'] for p in m['primitives'])
report['joints']=len(base['skins'][0]['joints']);report['rigTask']=json.loads((WORK/'legacy-clips/rig-v1/result.json').read_text())['task_id']
(OUT/'asset-biped-evidence.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
