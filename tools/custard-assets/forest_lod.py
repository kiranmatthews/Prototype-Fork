"""The distant forest uses reduced Meshy topology; the close bonus tree stays full quality."""
import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];work=ROOT/'.img2threejs/custard-creek/willow-forest';work.mkdir(parents=True,exist_ok=True)
source=ROOT/'.img2threejs/custard-creek/willow-grove/willow-grove-source.glb'
(work/'willow-forest-source.glb').write_bytes(source.read_bytes())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source));high=next(o for o in bpy.context.scene.objects if o.type=='MESH')
bpy.context.view_layer.objects.active=high;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
high.data.calc_loop_triangles();modifier=high.modifiers.new('Measured distant canopy','DECIMATE');modifier.ratio=2000/len(high.data.loop_triangles)
modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name);high.name='willow-forest_LOD0'
low=high.copy();low.data=high.data.copy();low.name='willow-forest_LOD1';bpy.context.collection.objects.link(low);bpy.context.view_layer.objects.active=low
low.data.calc_loop_triangles();modifier=low.modifiers.new('Far canopy silhouette','DECIMATE');modifier.ratio=450/len(low.data.loop_triangles)
modifier.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=modifier.name)
for obj in bpy.context.scene.objects:obj.select_set(obj in (high,low))
bpy.ops.export_scene.gltf(filepath=str(work/'willow-forest-lods.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
for obj in (high,low):obj.data.calc_loop_triangles()
(work/'geometry.json').write_text(json.dumps({'triangles':len(high.data.loop_triangles),'lodTriangles':len(low.data.loop_triangles),'lods':2}))
