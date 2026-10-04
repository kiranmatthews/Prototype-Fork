#!/usr/bin/env python3
"""Pack original Meshy surfaces, preserve UVs and record placement contracts."""
from pathlib import Path
import copy,hashlib,io,json,math,sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb
from prepare_meshy_walk import compact_textures
SPECS=json.loads((HERE/'prompts.json').read_text())
HERO={'castle-wall-window-v2','banquet-table-v2','monster-face-portal-v2','demon-ghost-cart-v2','castle-flagstone-v2'}

def node_matrix(node):
 if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
 x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4)
 m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]))
 m[:3,3]=node.get('translation',[0,0,0]);return m
def rotation(name):
 yaw=math.pi/2 if name in ['demon-ghost-cart-v2','castle-clockwork-v2'] else -math.pi/2 if name in ['banquet-table-v2','broken-rail-trestle-v2'] else 0
 pitch=-math.pi/2 if name=='castle-flagstone-v2' else 0
 c,s=math.cos(yaw),math.sin(yaw);a,b=math.cos(pitch),math.sin(pitch)
 return np.array([[c,0,s],[0,1,0],[-s,0,c]])@np.array([[1,0,0],[0,a,-b],[0,b,a]]),yaw,pitch

def pack(name):
 ledger=json.loads((HERE/'tasks.json').read_text())['tasks'];source_key=name+'-textured'
 if name=='banquet-table-v2' and ledger.get('banquet-table-v2-cloth',{}).get('state')=='SUCCEEDED':source_key='banquet-table-v2-cloth'
 source=ROOT/'.img2threejs/ghost-train-v2'/source_key/'downloads/model.glb'
 output=ROOT/'public/ghost-train'/(name+'.glb');output.parent.mkdir(parents=True,exist_ok=True)
 glb=Glb(source);original=copy.deepcopy(glb.document);binary=bytes(glb.binary)
 if original.get('skins') or original.get('animations'):raise ValueError('Static kit pack cannot flatten a deformation rig')
 surfaces=[];before=0;removed=0;orient,yaw,pitch=rotation(name)
 def visit(index,parent):
  nonlocal before,removed
  node=original['nodes'][index];world=parent@node_matrix(node)
  if 'mesh' in node:
   for primitive in original['meshes'][node['mesh']]['primitives']:
    attrs={key:glb.read_accessor(i) for key,i in primitive['attributes'].items()}
    types={key:(original['accessors'][i]['componentType'],original['accessors'][i]['type']) for key,i in primitive['attributes'].items()}
    pos=(np.c_[attrs['POSITION'],np.ones(len(attrs['POSITION']))]@world.T)[:,:3]
    indices=glb.read_accessor(primitive['indices']).ravel().astype(int).reshape(-1,3) if 'indices' in primitive else np.arange(len(pos)).reshape(-1,3)
    before+=len(indices);centres=pos[indices].mean(1);keep=np.ones(len(indices),dtype=bool)
    if name=='skull-axe-head-v2':keep=pos[indices][:,:,1].min(axis=1)>=-.10
    if name=='demon-ghost-cart-v2':keep=~((centres[:,0]>-.10)&(centres[:,1]>.10))
    removed+=int((~keep).sum());indices=indices[keep]
    if not len(indices):continue
    chosen,remapped=np.unique(indices.ravel(),return_inverse=True);attrs={key:value[chosen].copy() for key,value in attrs.items()}
    attrs['POSITION']=pos[chosen]@orient.T
    for key in ['NORMAL','TANGENT']:
     if key in attrs:
      xyz=attrs[key][:,:3]@np.linalg.inv(world[:3,:3])@orient.T;xyz/=np.maximum(np.linalg.norm(xyz,axis=1,keepdims=True),1e-12);attrs[key][:,:3]=xyz
    surfaces.append({'attributes':attrs,'types':types,'indices':remapped.reshape(-1,3),'material':primitive.get('material',0)})
  for child in node.get('children',[]):visit(child,world)
 for index in original['scenes'][original.get('scene',0)]['nodes']:visit(index,np.eye(4))
 all_positions=np.concatenate([p['attributes']['POSITION'] for p in surfaces]);low,high=all_positions.min(0),all_positions.max(0);span=high-low;origin=(low+high)/2;origin[1]=low[1];scale=float(max(span))
 for surface in surfaces:surface['attributes']['POSITION']=((surface['attributes']['POSITION']-origin)/scale).astype('<f4')
 doc=glb.document;doc['accessors']=[];doc['bufferViews']=[];doc['nodes']=[];doc['meshes']=[];glb.binary=bytearray()
 atlas_directory=ROOT/'.img2threejs/ghost-train-v2/atlases';atlas_directory.mkdir(exist_ok=True)
 exported=[]
 for image_index,image in enumerate(doc.get('images',[])):
  previous=original['bufferViews'][image['bufferView']];offset=previous.get('byteOffset',0);encoded=binary[offset:offset+previous['byteLength']]
  path=atlas_directory/f'{name}-atlas-{image_index}.png';Image.open(io.BytesIO(encoded)).save(path)
  exported.append({'path':str(path.relative_to(ROOT)),'size':list(Image.open(path).size),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
  while len(glb.binary)%4:glb.binary.append(0)
  image['bufferView']=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(glb.binary),'byteLength':len(encoded)});glb.binary.extend(encoded)
 primitives=[]
 for surface in surfaces:
  attrs={}
  for key,array in surface['attributes'].items():
   component,type_name=surface['types'][key];i=glb.add_accessor(array.astype('<f4') if component==5126 else array,component,type_name,34962);attrs[key]=i
   if key=='POSITION':doc['accessors'][i]['min']=array.min(0).tolist();doc['accessors'][i]['max']=array.max(0).tolist()
  indices=glb.add_accessor(surface['indices'].astype('<u4').reshape(-1,1),5125,'SCALAR',34963)
  primitives.append({'attributes':attrs,'indices':indices,'material':surface['material']})
 doc['meshes']=[{'name':name,'primitives':primitives}];doc['nodes']=[{'name':name,'mesh':0}];doc['scenes']=[{'nodes':[0]}];doc['scene']=0
 textures=compact_textures(glb,1024 if name in HERO else 512,90)
 task=ledger[source_key];doc['asset']={'version':'2.0','generator':'Meshy T2 Smart Topology; tools/ghost-train-assets-v2/pack_assets.py','extras':{'provider':'Meshy','taskId':task['id'],'axes':'Y-up,+Z-front,centeredXZ,bottomY0,max dimension1','originalUVsPreserved':True}}
 glb.save(output)
 packed=Glb(output);positions=np.concatenate([packed.read_accessor(p['attributes']['POSITION']) for p in packed.document['meshes'][0]['primitives']]);normalized_low,normalized_high=positions.min(0),positions.max(0);normalized_span=normalized_high-normalized_low
 depth_scale=SPECS[name]['dimensions'][2]/normalized_span[2]
 uniform_scale=(SPECS[name]['dimensions'][0]/normalized_span[0]) if name=='castle-flagstone-v2' else depth_scale if name in ['broken-rail-trestle-v2','demon-ghost-cart-v2'] else SPECS[name]['dimensions'][1]/normalized_span[1]
 report={'provider':'Meshy','model':'meshy-t2','taskId':task['id'],'previewTaskId':json.loads((HERE/'tasks.json').read_text())['tasks'][name]['id'],
  'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'bytes':output.stat().st_size,
  'trianglesBefore':before,'trianglesRemoved':removed,'triangles':before-removed,'originalUVsPreserved':True,'textures':textures,'originalAtlases':exported,
  'bounds':{'min':normalized_low.tolist(),'max':normalized_high.tolist()},'size':normalized_span.tolist(),'targetMetres':SPECS[name]['dimensions'],
  'suggestedUniformScale':float(uniform_scale),'suggestedUniformMetres':(normalized_span*uniform_scale).tolist(),
  'transform':{'sourceBounds':{'min':low.tolist(),'max':high.tolist()},'yawRadians':yaw,'pitchRadians':pitch,'maxDimensionScale':scale,
    'trim':('Drop generated grip triangles below source Y=-.10' if name=='skull-axe-head-v2' else 'Remove upper rear driver/canopy frame, source centroidX>-.10 andY>.10' if name=='demon-ghost-cart-v2' else None)},
  'axes':'Y-up,+Z-front,centeredXZ,bottomY0,max dimension1','sourceStage':source_key}
 output.with_suffix('.provenance.json').write_text(json.dumps(report,indent=2)+'\n');return report

if __name__=='__main__':
 names=list(SPECS) if len(sys.argv)<2 or sys.argv[1]=='all' else sys.argv[1:]
 manifest_path=HERE/'asset-manifest.json';manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
 for name in names:
  report=pack(name);manifest[name]=report;print(json.dumps({name:{key:report[key] for key in ['triangles','bytes','size','suggestedUniformMetres']}}))
 manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
