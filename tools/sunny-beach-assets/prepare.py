"""Preserve Meshy LOD0 and UVs, adding an inexpensive shared-atlas far LOD."""
from pathlib import Path
import bpy, json, math
ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/sunny-beach'
OUT=ROOT/'public/sunny-beach'
OUT.mkdir(parents=True,exist_ok=True)
for name,width in [('sunny-sandstone',12),('sunny-hibiscus',2.6)]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    source=WORK/name/'downloads/model.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in bpy.context.scene.objects:o.select_set(o in parts)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    high=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    high.name=name+'_LOD0'
    assert high.data.uv_layers
    bounds=[(min(v.co[i] for v in high.data.vertices),max(v.co[i] for v in high.data.vertices)) for i in range(3)]
    spans=[b-a for a,b in bounds]
    assert all(math.isfinite(v) and v>0 for v in spans)
    high.data.calc_loop_triangles();near=len(high.data.loop_triangles)
    low=high.copy();low.data=high.data.copy();low.name=name+'_LOD1';bpy.context.collection.objects.link(low)
    bpy.context.view_layer.objects.active=low
    m=low.modifiers.new('Distant silhouette','DECIMATE');m.ratio=.22;m.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=m.name)
    low.data.calc_loop_triangles();far=len(low.data.loop_triangles)
    for o in bpy.context.scene.objects:o.select_set(o in (high,low))
    bpy.ops.export_scene.gltf(filepath=str(WORK/(name+'-lods.glb')),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
    natural=[spans[0],spans[2],spans[1]]
    report={'name':name,'source':str(source.relative_to(ROOT)),'sourceSize':natural,'sizeAtDefaultWidth':[round(x*width/natural[0],5) for x in natural],
      'nearTriangles':near,'farTriangles':far,'sourceGeometryPreserved':True,'originalUVsPreserved':True,'role':'shared instanced visual scenery; source cliff collision remains authoritative'}
    (OUT/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    print('SUNNY_PREPARED',json.dumps(report))
