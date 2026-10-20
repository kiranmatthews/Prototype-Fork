"""Bake reviewed Meshy component surfaces into small, synchronous runtime buffers.

Run in Blender. Raw GLBs stay in ignored authoring storage. No provider URLs or
credentials enter the runtime. The procedural chassis is deliberately untouched.
"""
import base64, hashlib, json, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/golf-cart'
SPECS={
 'wheel': {'size':[.38,.82,.82], 'center':[0,0,0], 'texture':256},
 'canopy': {'size':[1.80,.20,2.04], 'center':[0,2.08,.05], 'texture':128},
 'bag': {'size':[.44,.72,.38], 'center':[.30,1.08,1.14], 'texture':256},
 'captain-head': {'size':[.50,.50,.45], 'center':[0,.25,-.015], 'texture':256},
}

def packed(values,dtype):
 return base64.b64encode(np.asarray(values,dtype=dtype).tobytes()).decode()

def bake(name,spec):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 path=WORK/(name+'.glb')
 bpy.ops.import_scene.gltf(filepath=str(path))
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
 assert len(objects)==1, 'Review multipart sources before baking'
 obj=objects[0];mesh=obj.data;mesh.calc_loop_triangles()
 raw=np.array([tuple(obj.matrix_world@v.co) for v in mesh.vertices])
 # Blender Z-up -> game Y-up. Meshy faces +Z; the cart faces -Z.
 pos=raw[:,[0,2,1]]*np.array([1,1,-1])
 if name=='wheel':pos=pos[:,[2,1,0]]*np.array([1,1,-1])
 elif name in ('canopy','captain-head'):pos*=np.array([-1,1,-1])
 # The bag pockets face backwards, away from the seat.
 low=pos.min(axis=0);high=pos.max(axis=0)
 pos=(pos-(low+high)/2)/(high-low)*spec['size']+spec['center']
 triangles=[t for t in mesh.loop_triangles if np.linalg.norm(np.cross(pos[t.vertices[1]]-pos[t.vertices[0]],pos[t.vertices[2]]-pos[t.vertices[0]]))>1e-12]
 # Weld only for normal accumulation, retaining every original UV seam.
 keys=[tuple(np.round(p,6)) for p in pos]; sums={};dominant={}
 for triangle in triangles:
  a,b,c=(pos[i] for i in triangle.vertices)
  normal=np.cross(b-a,c-a)
  for index in triangle.vertices:
   key=keys[index];sums[key]=sums.get(key,np.zeros(3))+normal
   if np.linalg.norm(normal)>np.linalg.norm(dominant.get(key,np.zeros(3))):dominant[key]=normal
 def smooth_normal(key):
  value=sums.get(key,np.zeros(3))
  if np.linalg.norm(value)<1e-10:value=dominant.get(key,np.array([0,1,0]))
  return value/np.linalg.norm(value)
 normals=np.array([smooth_normal(k) for k in keys])
 material=obj.data.materials[0]
 bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 link=bsdf.inputs['Base Color'].links[0]
 image=link.from_node.image
 image.scale(spec['texture'],spec['texture'])
 pixels=np.array(image.pixels[:],dtype=np.float32).reshape(spec['texture'],spec['texture'],4)
 pixels=np.clip(pixels,0,1)
 if name=='canopy':pixels[:,:,:3]=pixels[:,:,:3].max(axis=2,keepdims=True)
 # Store top-down pixels and matching glTF UVs, so browser and GLB exports agree.
 pixels=pixels[::-1].copy();pixels[:,:,3]=1
 uv_layer=mesh.uv_layers.active.data
 vertex_map={};positions=[];uvs=[];norm=[];groups={'main':[],'detail':[]}
 for triangle in triangles:
  ids=[];colours=[]
  for vi,li in zip(triangle.vertices,triangle.loops):
   uv=uv_layer[li].uv;u=float(uv.x);v=1-float(uv.y)
   key=(int(vi),round(u,7),round(v,7))
   if key not in vertex_map:
    vertex_map[key]=len(positions);positions.append(pos[vi]);norm.append(normals[vi]);uvs.append([u,v])
   ids.append(vertex_map[key]);colours.append(pixels[min(spec['texture']-1,int(v*spec['texture']))%spec['texture'],min(spec['texture']-1,int(u*spec['texture']))%spec['texture'],:3])
  colour=np.mean(colours,axis=0)
  paint=colour[0]>colour[1]*1.3 and colour[0]>colour[2]*1.4
  groups['detail' if name=='bag' and not paint else 'main'].extend(ids)
 result={'position':packed(positions,'<f4'),'normal':packed(norm,'<f4'),'uv':packed(uvs,'<f4'),
  'indices':{k:packed(v,'<u2') for k,v in groups.items() if v},
  'pixels':packed(np.round(pixels*255),'uint8'),'textureSize':spec['texture']}
 report={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceTask':json.loads((ROOT/'tools/golf-cart/meshy-tasks.json').read_text())['tasks'][name]['id'],
  'triangles':len(triangles),'vertices':len(positions),'bounds':{'min':pos.min(axis=0).tolist(),'max':pos.max(axis=0).tolist()},'textureSize':spec['texture'],'groups':{k:len(v)//3 for k,v in groups.items() if v}}
 return result,report

data={};reports={}
for name,spec in SPECS.items():
 data[name],reports[name]=bake(name,spec)
target=ROOT/'src/golf-cart/sculpted-data.ts'
target.write_text('// Generated from reviewed Meshy surfaces by tools/golf-cart/bake_meshy.py.\nexport const SCULPTED_DATA = '+json.dumps(data,separators=(',',':'))+' as const;\n')
(ROOT/'docs/golf-cart/meshy-provenance.json').write_text(json.dumps({'generation':'Meshy generative-assist; imagegen references; fitted and smooth-shaded locally','body':'Original procedural chassis retained per user direction; generated body is reference-only','assets':reports},indent=2)+'\n')
print(json.dumps(reports,indent=2))
