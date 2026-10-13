"""Three reusable cream moulding courses, kept separate from each wall shell."""
from pathlib import Path
import bpy
import json
ROOT=Path(__file__).resolve().parents[2];WORK=ROOT/'.img2threejs/coastal-town'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Cream Imagegen plaster');mat.use_nodes=True
shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.9
tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'tools/coastal-town-assets/references/stucco-albedo.png'))
mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
counts=[]
for lod in [0,1]:
 parts=[]
 for z,w,h in [(.325,8.25,.65),(4.37,8.2,.24),(7.95,8.35,.4)]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,z));obj=bpy.context.object;obj.scale=(w,w,h)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(mat)
  if lod==0:
   bevel=obj.modifiers.new('Rounded moulding edges','BEVEL');bevel.width=.07;bevel.segments=2;bpy.ops.object.modifier_apply(modifier=bevel.name)
  parts.append(obj)
 bpy.ops.object.select_all(action='DESELECT')
 for obj in parts:obj.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=f'stucco-trim_LOD{lod}'
 obj.data.calc_loop_triangles();counts.append(len(obj.data.loop_triangles))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(WORK/'stucco-trim-lods.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
(ROOT/'public/coastal-town/stucco-trim.json').write_text(json.dumps({'name':'stucco-trim','source':'tools/coastal-town-assets/make-trim.py',
 'sourceSize':[8.35,8.15,8.35],'sizeAtDefaultWidth':[8.35,8.15,8.35],'nearTriangles':counts[0],'farTriangles':counts[1],
 'materials':1,'geometryLicense':'Apache-2.0','provider':'Code-authored geometry with built-in Imagegen plaster','consumedCredits':0},indent=2)+'\n')
