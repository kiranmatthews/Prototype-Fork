"""Add a reflection-only LOD without rewriting any native geometry or texture.
Run after pack_boardwalk_section.py:
  Blender --background --python-exit-code 1 --python this_file
The original GLB byte payload, accessors, UVs, normals and scene nodes are kept.
Only the low-detail mesh exported by Blender is appended to that native file.
"""
from pathlib import Path
import copy,hashlib,json,sys,tempfile
import bpy
import bmesh
import numpy as np
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tools/enemies'))
from glb_rig import Glb

target=ROOT/'public/drowned-crown/excellence/crash-boardwalk-section.glb'
manifest=json.loads((HERE/'boardwalk-section-manifest.json').read_text())
source=Glb(target)
if source.document['asset'].get('extras',{}).get('reflectionOnlyLod'):
 raise RuntimeError('Reflection LOD already packed; run pack_boardwalk_section.py before regenerating.')
original_bytes=target.read_bytes()
assert hashlib.sha256(original_bytes).hexdigest()==manifest['outputSha256'],'Native boardwalk differs from its packing manifest'
original_document=copy.deepcopy(source.document)
original_payload=bytes(source.binary)
original_accessors=[source.read_accessor(i) for i in range(len(source.document['accessors']))]

with tempfile.TemporaryDirectory(prefix='crown-boardwalk-reflection-') as temporary:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(target))
 objects=[obj for obj in bpy.context.scene.objects if obj.type=='MESH']
 assert objects
 bpy.ops.object.select_all(action='DESELECT')
 for obj in objects:obj.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 low=bpy.context.object
 world=low.matrix_world.copy();low.parent=None;low.matrix_world=world
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
 for obj in list(bpy.context.scene.objects):
  if obj!=low:bpy.data.objects.remove(obj,do_unlink=True)
 low.name='Boardwalk reflection_LOD1'
 low.data.calc_loop_triangles();before=len(low.data.loop_triangles)
 # glTF duplicates vertices at UV seams. Weld only this disposable low-copy
 # mesh before decimation; Blender retains UVs on each face corner.
 imported_vertices=len(low.data.vertices)
 bm=bmesh.new();bm.from_mesh(low.data)
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
 bm.to_mesh(low.data);bm.free();low.data.update()
 welded_vertices=len(low.data.vertices)
 modifier=low.modifiers.new('Reflection-only detail','DECIMATE')
 modifier.ratio=.28;modifier.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=modifier.name)
 low.data.calc_loop_triangles();after=len(low.data.loop_triangles)
 assert before==manifest['triangles']['0'] and after<before*.3
 low_path=Path(temporary)/'reflection.glb'
 bpy.ops.export_scene.gltf(filepath=str(low_path),export_format='GLB',export_materials='NONE',
  export_texcoords=True,export_normals=True,export_yup=True,export_animations=False)
 reduced=Glb(low_path);document=reduced.document
 # Transform the exported LOD into game-world coordinates before appending it
 # as a separate scene root. Native high-detail hierarchy is not touched.
 from mathutils import Matrix,Quaternion,Vector
 worlds={}
 def visit(index,parent):
  node=document['nodes'][index]
  if 'matrix' in node:local=Matrix(np.array(node['matrix']).reshape(4,4).T.tolist())
  else:
   q=node.get('rotation',[0,0,0,1])
   local=Matrix.LocRotScale(Vector(node.get('translation',[0,0,0])),Quaternion((q[3],q[0],q[1],q[2])),Vector(node.get('scale',[1,1,1])))
  worlds[index]=parent@local
  for child in node.get('children',[]):visit(child,worlds[index])
 for index in document['scenes'][document.get('scene',0)]['nodes']:visit(index,Matrix.Identity(4))
 primitives=[]
 for index,node in enumerate(document['nodes']):
  if 'mesh' not in node:continue
  world=np.array(worlds[index],dtype=np.float64)
  for primitive in document['meshes'][node['mesh']]['primitives']:
   attrs=primitive['attributes'];positions=reduced.read_accessor(attrs['POSITION'])
   positions=(np.c_[positions,np.ones(len(positions))]@world.T)[:,:3].astype('<f4')
   normals=(reduced.read_accessor(attrs['NORMAL'])@np.linalg.inv(world[:3,:3])).astype('<f4')
   normals/=np.linalg.norm(normals,axis=1)[:,None]
   uvs=reduced.read_accessor(attrs['TEXCOORD_0']).astype('<f4')
   indices=reduced.read_accessor(primitive['indices']).reshape(-1,1).astype('<u4')
   assert np.isfinite(positions).all() and np.isfinite(normals).all() and np.isfinite(uvs).all()
   assert indices.max()<len(positions)
   a=source.add_accessor(positions,5126,'VEC3',34962)
   source.document['accessors'][a].update(min=positions.min(0).tolist(),max=positions.max(0).tolist())
   attributes={'POSITION':a,'NORMAL':source.add_accessor(normals,5126,'VEC3',34962),'TEXCOORD_0':source.add_accessor(uvs,5126,'VEC2',34962)}
   primitives.append({'attributes':attributes,'indices':source.add_accessor(indices,5125,'SCALAR',34963),'material':original_document['meshes'][0]['primitives'][0]['material']})
 mesh_index=len(source.document['meshes']);source.document['meshes'].append({'name':'Boardwalk reflection_LOD1','primitives':primitives})
 node_index=len(source.document['nodes']);source.document['nodes'].append({'name':'Boardwalk reflection_LOD1','mesh':mesh_index})
 source.document['scenes'][source.document.get('scene',0)]['nodes'].append(node_index)
 source.document['asset'].setdefault('extras',{})['reflectionOnlyLod']={'ratio':.28,'nativeSha256':manifest['outputSha256'],'nativeTriangles':before,'reflectionTriangles':after}
 assert bytes(source.binary[:len(original_payload)])==original_payload
 for i,values in enumerate(original_accessors):assert np.array_equal(source.read_accessor(i),values),('Native accessor changed',i)
 for key in ['images','textures','materials']:
  assert source.document[key]==original_document[key],('Native atlas changed',key)
 for key in ['nodes','meshes','bufferViews','accessors']:
  assert source.document[key][:len(original_document[key])]==original_document[key],('Native structure changed',key)
 source.save(target)
 report={'nativeSha256':manifest['outputSha256'],'outputSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
  'nativeBytes':len(original_bytes),'outputBytes':target.stat().st_size,'addedBytes':target.stat().st_size-len(original_bytes),
  'nativeTriangles':before,'reflectionTriangles':after,'ratio':.28,'blenderVersion':bpy.app.version_string,
  'reflectionImportedVertices':imported_vertices,'reflectionWeldedVertices':welded_vertices,'reflectionSeamsWeldedWithCornerUVs':True,
  'nativeBinaryPrefixExact':True,'nativeAccessorsExact':len(original_accessors),'nativeImagesAndMaterialsExact':True,
  'nativeNodesAndMeshesExact':True,'reflectionOnly':True,'newTextures':0}
 (HERE/'boardwalk-reflection-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
 registry=ROOT/'src/drownedCrownSections.generated.ts'
 spec=registry.read_text()
 if 'reflectionLod:true' not in spec:
  assert 'normalStrength:.2,cellSize:20' in spec
  registry.write_text(spec.replace('normalStrength:.2,cellSize:20','normalStrength:.2,reflectionLod:true,cellSize:20'))
 print(json.dumps(report),flush=True)
