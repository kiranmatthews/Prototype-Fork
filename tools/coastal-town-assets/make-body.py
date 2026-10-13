"""Code-authored bevelled structural primitive; Imagegen stucco, no Meshy job."""
from pathlib import Path
import bpy
import json
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/coastal-town'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Tintable Imagegen stucco');mat.use_nodes=True
nodes=mat.node_tree.nodes;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.9
image=nodes.new('ShaderNodeTexImage');image.image=bpy.data.images.load(str(ROOT/'tools/coastal-town-assets/references/stucco-albedo.png'))
mat.node_tree.links.new(image.outputs['Color'],shader.inputs['Base Color'])
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.5))
high=bpy.context.object;high.name='stucco-body_LOD0';high.data.materials.append(mat)
bevel=high.modifiers.new('Small architectural bevel','BEVEL');bevel.width=.025;bevel.segments=2
bpy.ops.object.modifier_apply(modifier=bevel.name)
for poly in high.data.polygons:poly.use_smooth=True
normal=high.modifiers.new('Keep broad stucco faces planar','WEIGHTED_NORMAL');normal.keep_sharp=True
bpy.ops.object.modifier_apply(modifier=normal.name)
high.data.calc_loop_triangles();near=len(high.data.loop_triangles)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.5))
low=bpy.context.object;low.name='stucco-body_LOD1';low.data.materials.append(mat)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(WORK/'stucco-body-lods.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
(ROOT/'public/coastal-town/stucco-body.json').write_text(json.dumps({'name':'stucco-body',
 'source':'tools/coastal-town-assets/make-body.py','sourceSize':[1,1,1],'sizeAtDefaultWidth':[8,8,8],
 'nearTriangles':near,'farTriangles':12,'materials':1,'geometryLicense':'Apache-2.0',
 'provider':'Code-authored geometry with built-in Imagegen stucco','consumedCredits':0},indent=2)+'\n')
