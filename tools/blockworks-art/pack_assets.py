#!/usr/bin/env python3
"""Pack original static Meshy components, retaining topology, UVs and textures."""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
WORK=ROOT/'.img2threejs/blockworks-assets'
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures

def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def matrix(node):
    if 'matrix' in node: return np.array(node['matrix']).reshape(4,4).T
    x,y,z,w=node.get('rotation',[0,0,0,1])
    result=np.eye(4)
    result[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
        [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
        [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
    result[:3,3]=node.get('translation',[0,0,0])
    return result

def pack(name,brief,task):
    if task['state']!='SUCCEEDED': raise RuntimeError('Refresh successful provider status first: '+name)
    source=WORK/name/'downloads/model.glb'
    target=ROOT/'public/blockworks-art'/(name+'.glb')
    glb=Glb(source);doc=glb.document
    paint=None
    if brief.get('paintedAlbedo'):
        painted=ROOT/brief['paintedAlbedo'];data=painted.read_bytes()
        while len(glb.binary)%4:glb.binary.append(0)
        texture=doc['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']
        index=doc['textures'][texture]['source'];view=doc['images'][index]['bufferView']
        doc['bufferViews'][view]={'buffer':0,'byteOffset':len(glb.binary),'byteLength':len(data)}
        glb.binary.extend(data)
        doc['images'][index]={'bufferView':view,'mimeType':'image/png','name':'ImageGen paint baked to original Meshy UVs'}
        paint={'provider':'built-in ImageGen','bakedAlbedo':brief['paintedAlbedo'],'sha256':digest(painted),
               'paintReference':brief.get('paintReference','docs/blockworks-art/component-paint/flagstone-top-painted.png'),
               'projection':brief.get('paintProjection','orthographic top'),
               'method':'Blender emission bake, original Meshy geometry and UV buffers untouched'}
    if doc.get('skins') or doc.get('animations'): raise ValueError('Static scenery only')
    positions=[];surfaces=[];triangles=0
    def visit(index,parent):
        nonlocal triangles
        node=doc['nodes'][index];world=parent@matrix(node)
        if 'mesh' in node:
            for p in doc['meshes'][node['mesh']]['primitives']:
                if p.get('mode',4)!=4: raise ValueError('Expected triangle surfaces')
                points=glb.read_accessor(p['attributes']['POSITION'])
                transformed=(np.c_[points,np.ones(len(points))]@world.T)[:,:3]
                positions.append(transformed)
                indices=glb.read_accessor(p['indices']).ravel().astype(int).reshape(-1,3) if 'indices' in p else np.arange(len(points)).reshape(-1,3)
                surfaces.append(transformed[indices])
                triangles+=(doc['accessors'][p['indices']]['count'] if 'indices' in p else len(points))//3
        for child in node.get('children',[]):visit(child,world)
    scene=doc['scenes'][doc.get('scene',0)]
    for node in scene['nodes']: visit(node,np.eye(4))
    points=np.concatenate(positions);low=points.min(0);high=points.max(0);span=high-low
    if not np.isfinite(points).all() or min(span)<=0: raise ValueError('Invalid measured asset bounds')
    centre=(low+high)/2;centre[1]=low[1];scale=float(max(span))
    root_index=len(doc['nodes'])
    doc['nodes'].append({'name':'Blockworks normalized placement root','children':scene['nodes'],
        'translation':(-centre/scale).tolist(),'scale':[1/scale]*3})
    scene['nodes']=[root_index]
    if brief.get('longAxis')=='z' and span[0]>span[2]:
        n=doc['nodes'][root_index];n['rotation']=[0,2**-.5,0,2**-.5]
        tx,ty,tz=n['translation'];n['translation']=[tz,ty,-tx]
        span=span[[2,1,0]]
    if name in ['aqueduct-module','aqueduct-v2','aqueduct-v3']:
        # Meshy emitted its wide cross-section along Z; align that to game X.
        n=doc['nodes'][root_index];n['rotation']=[0,2**-.5,0,2**-.5]
        tx,ty,tz=n['translation'];n['translation']=[tz,ty,-tx]
        span=span[[2,1,0]]
        tri=(np.concatenate(surfaces)-centre)/scale
        tri=tri[:,:,[2,1,0]];tri[:,:,2]*=-1
        a,b,c=tri[:,0],tri[:,1],tri[:,2]
        v1=b-a;v2=c-a;den=v1[:,0]*v2[:,2]-v2[:,0]*v1[:,2]
        valid=np.abs(den)>1e-10;den=np.where(valid,den,1)
        count=65 if name=='aqueduct-module' else 129;grid=[]
        xs=np.linspace(-span[0]/scale/2+.00001,span[0]/scale/2-.00001,count)
        zs=np.linspace(-span[2]/scale/2+.00001,span[2]/scale/2-.00001,count)
        for z in zs:
            dx=xs[:,None]-a[None,:,0];dz=z-a[None,:,2]
            u=(dx*v2[None,:,2]-dz*v2[None,:,0])/den
            v=(v1[None,:,0]*dz-v1[None,:,2]*dx)/den
            hit=valid[None,:]&(u>=-1e-6)&(v>=-1e-6)&(u+v<=1.000001)
            y=a[None,:,1]+u*v1[None,:,1]+v*v2[None,:,1]
            heights=np.max(np.where(hit,y,-1),axis=1)
            grid.extend(np.maximum(0,heights).round(6).tolist())
        scene.setdefault('extras',{})['bwRideSurface']={'size':count,'heights':grid}

    if brief.get('role')=='wedge-module':
        # Fit the actual Meshy riding plane, excluding vertical sides/bottom.
        # Its residual sculpting and painted UVs are retained by the runtime.
        tri=np.concatenate(surfaces)
        tri=(np.c_[tri.reshape(-1,3),np.ones(tri.size//3)]@matrix(doc['nodes'][root_index]).T)[:,:3].reshape(-1,3,3)
        normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(normal,axis=1)
        centroid=tri.mean(axis=1);up=normal[:,1]/np.maximum(area,1e-12)
        select=(up>.4)&(centroid[:,1]>.01*(span[1]/scale))
        z=centroid[select,2];y=centroid[select,1];weight=normal[select,1]
        design=np.c_[np.ones(len(z)),z];fit=np.linalg.lstsq(design*np.sqrt(weight[:,None]),y*np.sqrt(weight),rcond=None)[0]
        residual=y-design@fit;order=np.argsort(residual)
        fit[0]+=np.interp(.7,np.cumsum(weight[order])/weight.sum(),residual[order])
        zmin,zmax=tri[:,:,2].min(),tri[:,:,2].max()
        ymin=float(fit[0]+fit[1]*zmin);ymax=float(fit[0]+fit[1]*zmax)
        if min(ymin,ymax)<=0 or abs(ymin-ymax)<.03:raise ValueError('Invalid measured wedge riding plane')
        scene.setdefault('extras',{})['bwWedge']={'low':min(ymin,ymax),'high':max(ymin,ymax),
            'toeZ':1 if ymax<ymin else -1,'base':float(tri[:,:,1].min())}

    # Keep the supplied materials and every original UV; only compress textures.
    limit=2048 if brief.get('role')=='surface-module' or name in ['turret','wall-bay','wheel'] or name.endswith('-v2') else 1024
    limit=brief.get('textureLimit',limit)
    textures=compact_textures(glb,limit,92,data_limit=1024,lossless_data=True)
    doc['asset'].setdefault('extras',{}).update({'provider':'Meshy','taskId':task['id'],
        'originalTopologyAndUVs':True,'placement':'Y-up, centered XZ, bottom Y=0, max span=1'})
    target.parent.mkdir(parents=True,exist_ok=True);glb.save(target)
    report={'name':name,'provider':'Meshy','taskId':task['id'],'source':str(source.relative_to(ROOT)),
        'output':str(target.relative_to(ROOT)),'sourceSha256':digest(source),'sha256':digest(target),
        'bytes':target.stat().st_size,'triangles':triangles,'requestedTriangles':brief['triangles'],
        'sourceBounds':{'min':low.tolist(),'max':high.tolist()},'normalizedSize':(span/scale).tolist(),
        'targetMetres':brief['dimensions'],'textures':textures,'originalTopologyAndUVs':True,
        'inspection':'pending'}
    if paint:report['surfacePaint']=paint
    if brief.get('role')=='wedge-module':report['wedgeFit']=scene['extras']['bwWedge']
    target.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    briefs=json.loads((HERE/'asset-prompts.json').read_text())['props']
    tasks=json.loads((HERE/'meshy-tasks.json').read_text())['tasks']
    path=HERE/'asset-manifest.json';manifest=json.loads(path.read_text()) if path.exists() else {}
    names=sys.argv[1:] or [n for n in tasks if tasks[n]['state']=='SUCCEEDED' and (WORK/n/'downloads/model.glb').exists()]
    for name in names:
        manifest[name]=pack(name,briefs[name],tasks[name])
        print(json.dumps({k:manifest[name][k] for k in ['name','triangles','bytes','normalizedSize']}))
        path.write_text(json.dumps(manifest,indent=2)+'\n')
