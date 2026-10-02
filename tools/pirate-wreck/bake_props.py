"""Bake Meshy GLBs to editable, palette-shaded bounded mesh components.
Textures are sampled into twelve palette materials; no remote assets or credentials ship.
"""
from pathlib import Path
import json,struct,io,hashlib
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'.img2threejs/pirate-wreck'
PACK={};META={}
for name in ['cannon','treasure','skull-gate']:
 path=WORK/(name+'-textured')/'model.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);data=raw[28+n:]
 def accessor(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5122:'<i2',5121:'u1',5120:'i1'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];stride=v.get('byteStride',np.dtype(dtype).itemsize*w)
  return np.ndarray((a['count'],w),dtype=dtype,buffer=data,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dtype).itemsize)).astype(float)
 def matrix(node):
  if 'matrix'in node:return np.array(node['matrix']).reshape(4,4).T
  x,y,z,w=node.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
 triangles=[];colors=[]
 def visit(idx,parent):
  node=j['nodes'][idx];m=parent@matrix(node)
  if 'mesh'in node:
   for primitive in j['meshes'][node['mesh']]['primitives']:
    pos=accessor(primitive['attributes']['POSITION']);pos=(np.c_[pos,np.ones(len(pos))]@m.T)[:,:3];indices=accessor(primitive['indices']).ravel().astype(int) if 'indices'in primitive else np.arange(len(pos));indices=indices.reshape(-1,3)
    tri=pos[indices];material=j['materials'][primitive.get('material',0)].get('pbrMetallicRoughness',{});base=np.array(material.get('baseColorFactor',[1,1,1,1])[:3]);rgb=np.tile(base,(len(tri),1))
    if 'baseColorTexture'in material:
     tex=j['textures'][material['baseColorTexture']['index']];im=j['images'][tex['source']];v=j['bufferViews'][im['bufferView']];a=v.get('byteOffset',0);img=np.array(Image.open(io.BytesIO(data[a:a+v['byteLength']])).convert('RGB'))/255
     uv=accessor(primitive['attributes']['TEXCOORD_0'])[indices].mean(axis=1);u=np.clip((uv[:,0]*img.shape[1]).astype(int),0,img.shape[1]-1);v=np.clip((uv[:,1]*img.shape[0]).astype(int),0,img.shape[0]-1);rgb=img[v,u]*base
    linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    triangles.append(tri);colors.append(np.repeat(linear[:,None,:],3,axis=1))
  for child in node.get('children',[]):visit(child,m)
 for idx in j['scenes'][j.get('scene',0)]['nodes']:visit(idx,np.eye(4))
 tri=np.concatenate(triangles);col=np.concatenate(colors);low=tri.min(axis=(0,1));high=tri.max(axis=(0,1));size=high-low;origin=(low+high)/2;origin[1]=low[1];scale=max(size[0],size[2]);tri=(tri-origin)/scale
 # Palette materials share positions and avoid repeating three vertex colors
 # per face across every placed prop. This stays under the editor JSON budget.
 srgb=np.where(col[:,0,:]<=.0031308,col[:,0,:]*12.92,1.055*np.maximum(col[:,0,:],0)**(1/2.4)-.055)
 pixels=np.clip(srgb*255,0,255).astype('uint8').reshape(1,-1,3)
 palette_image=Image.fromarray(pixels).quantize(colors=12,dither=Image.Dither.NONE)
 palette=palette_image.getpalette();labels=np.array(palette_image).ravel();chunks=[]
 for label in np.unique(labels):
  chosen=tri[labels==label]
  for start in range(0,len(chosen),1200):
   vertices=[];indices=[];lookup={}
   for vertex in np.round(chosen[start:start+1200],4).reshape(-1,3):
    key=tuple(vertex.tolist())
    if key not in lookup:lookup[key]=len(vertices)//3;vertices.extend(key)
    indices.append(lookup[key])
   rgb=palette[label*3:label*3+3]
   chunks.append({'vertices':vertices,'indices':indices,'color':'#'+''.join(f'{v:02x}' for v in rgb)})
 PACK[name]=chunks;META[name]={'sourceSha256':hashlib.sha256(raw).hexdigest(),'triangles':len(tri),'originalBounds':{'min':low.tolist(),'max':high.tolist()},'unitSize':(size/scale).tolist(),'sourceTask':json.loads((ROOT/'tools/pirate-wreck/tasks.json').read_text())['tasks'][name+'-textured']['id']}
(ROOT/'src/levels/pirate-props.generated.ts').write_text('// Generated from original Meshy props by tools/pirate-wreck/bake_props.py.\n// Palette materials intentionally keeps this retro low-poly art editable and self-contained.\nexport const PIRATE_PROPS = '+json.dumps(PACK,separators=(',',':'))+';\n')
(ROOT/'tools/pirate-wreck/asset-manifest.json').write_text(json.dumps(META,indent=2)+'\n')
print(json.dumps(META,indent=2))
