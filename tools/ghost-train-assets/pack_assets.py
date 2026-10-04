#!/usr/bin/env python3
"""Normalize original Meshy static props and compact their embedded textures.

Ships core glTF only: faceted geometry, 512 px base color and scalar PBR.
No provider URL, credential, or source-account metadata is copied into assets.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures

def matrix(node):
    if 'matrix' in node:
        return np.array(node['matrix']).reshape(4, 4).T
    x,y,z,w = node.get('rotation', [0,0,0,1])
    result = np.eye(4)
    result[:3,:3] = np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]) @ np.diag(node.get('scale',[1,1,1]))
    result[:3,3] = node.get('translation', [0,0,0])
    return result

def write_accessor(glb, index, values):
    accessor = glb.document['accessors'][index]
    view = glb.document['bufferViews'][accessor['bufferView']]
    assert accessor['componentType'] == 5126
    offset = view.get('byteOffset',0) + accessor.get('byteOffset',0)
    shape = values.shape
    array = np.ndarray(shape, dtype='<f4', buffer=glb.binary, offset=offset,
        strides=(view.get('byteStride',shape[1]*4),4))
    array[:] = values
    if accessor['type'] == 'VEC3':
        accessor['min'] = values.min(axis=0).tolist()
        accessor['max'] = values.max(axis=0).tolist()

def pack(name, yaw):
    specifications = json.loads((HERE/'prompts.json').read_text())
    shipping_name = specifications[name].get('shippingName',name)
    source = ROOT/'.img2threejs/ghost-train'/(name+'-textured')/'downloads/model.glb'
    output = ROOT/'public/ghost-train'/(shipping_name+'.glb')
    output.parent.mkdir(parents=True, exist_ok=True)
    glb = Glb(source)
    doc = glb.document
    if doc.get('skins') or doc.get('animations'):
        raise ValueError('Static asset packing cannot bake deformation or motion')
    c,s = math.cos(yaw),math.sin(yaw)
    orient = np.array([[c,0,s,0],[0,1,0,0],[-s,0,c,0],[0,0,0,1]])
    transformed = []
    seen = set()
    def visit(index, parent):
        node = doc['nodes'][index]
        world = parent @ matrix(node)
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                attrs = primitive['attributes']
                position_id = attrs['POSITION']
                if position_id in seen:
                    raise ValueError('Instanced shared accessor needs explicit baking')
                seen.add(position_id)
                position = glb.read_accessor(position_id)
                position = (np.c_[position,np.ones(len(position))] @ world.T)[:,:3]
                transformed.append((position_id, position))
                for field in ['NORMAL','TANGENT']:
                    if field in attrs:
                        vector = glb.read_accessor(attrs[field])
                        xyz = vector[:,:3] @ np.linalg.inv(world[:3,:3])
                        xyz /= np.maximum(np.linalg.norm(xyz,axis=1,keepdims=True),1e-9)
                        vector[:,:3] = xyz
                        write_accessor(glb,attrs[field],vector)
        for child in node.get('children',[]):
            visit(child,world)
        for field in ['matrix','translation','rotation','scale']:
            node.pop(field,None)
    for index in doc['scenes'][doc.get('scene',0)]['nodes']:
        visit(index,orient)
    positions = np.concatenate([position for _,position in transformed])
    low,high = positions.min(axis=0),positions.max(axis=0)
    size = high-low
    origin = (low+high)/2
    origin[1] = low[1]
    scale = float(max(size))
    for index,position in transformed:
        write_accessor(glb,index,(position-origin)/scale)
    triangles = sum(doc['accessors'][p['indices']]['count']//3 if 'indices' in p else
        doc['accessors'][p['attributes']['POSITION']]['count']//3
        for mesh in doc['meshes'] for p in mesh['primitives'])
    textures = compact_textures(glb,512,88)
    for material in doc.get('materials',[]):
        material.setdefault('pbrMetallicRoughness',{})['metallicFactor'] = 0.2 if shipping_name in ['ghost-cart','clockwork-knight'] else 0
        material['pbrMetallicRoughness']['roughnessFactor'] = 0.76
        material['doubleSided'] = False
    task = json.loads((HERE/'tasks.json').read_text())['tasks'][name+'-textured']
    doc['asset'] = {'version':'2.0','generator':'Meshy T2 Smart Topology; tools/ghost-train-assets/pack_assets.py',
        'extras':{'provider':'Meshy','sourceTask':task['id'],'triangles':triangles,
            'axes':'Y-up,+Z-forward','normalized':'max dimension 1; centered X/Z; ground Y=0'}}
    glb.save(output)
    actual = Glb(output)
    after = np.concatenate([actual.read_accessor(p['attributes']['POSITION'])
        for mesh in actual.document['meshes'] for p in mesh['primitives']])
    assert np.isfinite(after).all()
    normalized_size = after.max(axis=0)-after.min(axis=0)
    assert abs(max(normalized_size)-1) < 1e-5 and abs(after.min(axis=0)[1]) < 1e-5
    report = {'provider':'Meshy','generation':'text-to-3d','aiModel':'meshy-t2','taskId':task['id'],
        'previewTaskId':json.loads((HERE/'tasks.json').read_text())['tasks'][name]['id'],
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'triangles':triangles,'bytes':output.stat().st_size,'textures':textures,
        'sourceBounds':{'min':low.tolist(),'max':high.tolist()},
        'bounds':{'min':after.min(axis=0).tolist(),'max':after.max(axis=0).tolist()},
        'size':normalized_size.tolist(),'yawAppliedRadians':yaw,
        'axes':'Y-up, +Z-forward, centered X/Z, ground Y=0, maximum dimension 1'}
    output.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('name',nargs='?',default='all')
    parser.add_argument('--yaw',type=float)
    args = parser.parse_args()
    names = list(json.loads((HERE/'prompts.json').read_text())) if args.name == 'all' else [args.name]
    specifications=json.loads((HERE/'prompts.json').read_text())
    reports = {specifications[name].get('shippingName',name):pack(name,args.yaw if args.yaw is not None else specifications[name].get('yaw',0)) for name in names}
    existing = json.loads((HERE/'asset-manifest.json').read_text()) if (HERE/'asset-manifest.json').exists() else {}
    existing.update(reports)
    (HERE/'asset-manifest.json').write_text(json.dumps(existing,indent=2)+'\n')
    print(json.dumps({k:{'triangles':v['triangles'],'bytes':v['bytes'],'size':v['size']} for k,v in reports.items()}))
