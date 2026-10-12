"""Blender: preserve Meshy's UVs/materials, simplify parts and add real far LODs."""
import bpy, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
LIMITS={'iron-weight':(3600,900),'iron-link':(320,96)}
for name in sys.argv[sys.argv.index('--')+1:]:
    work=ROOT/'.img2threejs/hazards'/name
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(work/(name+'-source.glb')))
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in bpy.context.scene.objects:obj.select_set(obj in parts)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    high=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    high.name=name+'_LOD0';high.data.calc_loop_triangles()
    source_triangles=len(high.data.loop_triangles)
    def simplify(obj,target):
        bpy.context.view_layer.objects.active=obj;obj.data.calc_loop_triangles()
        count=len(obj.data.loop_triangles)
        if count>target:
            modifier=obj.modifiers.new('Bounded original Meshy geometry','DECIMATE')
            modifier.ratio=target/count;modifier.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.calc_loop_triangles()
    simplify(high,LIMITS[name][0])
    low=high.copy();low.data=high.data.copy();low.name=name+'_LOD1';bpy.context.collection.objects.link(low)
    simplify(low,LIMITS[name][1])
    coords=[v.co for v in high.data.vertices]
    spans=[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
    for obj in bpy.context.scene.objects:obj.select_set(obj in (high,low))
    bpy.context.view_layer.objects.active=high
    bpy.ops.export_scene.gltf(filepath=str(work/(name+'-lods.glb')),export_format='GLB',use_selection=True,
        export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    report={'sourceTriangles':source_triangles,'triangles':len(high.data.loop_triangles),
        'lodTriangles':len(low.data.loop_triangles),'sourceSizeXYZ':[spans[0],spans[2],spans[1]],'lods':2}
    (work/'geometry.json').write_text(json.dumps(report,indent=2)+'\n');print(name,report,flush=True)
