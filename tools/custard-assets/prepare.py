"""Fit original Meshy scenery into the shared LOD loader without replacing its geometry."""
import bpy,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
for name in sys.argv[sys.argv.index('--')+1:]:
    work=ROOT/'.img2threejs/custard-creek'/name
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(work/(name+'-source.glb')))
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for obj in bpy.context.scene.objects:obj.select_set(obj in parts)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    high=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    high.name=name+'_LOD0';high.data.calc_loop_triangles()
    if name=='cliff-foliage':
        # Pin the upper woody attachment; the hanging leaf clusters flex.
        z=[v.co.z for v in high.data.vertices];lo=min(z);span=max(z)-lo
        weight=high.data.attributes.new('_wind_flex','FLOAT','POINT')
        for i,v in enumerate(high.data.vertices):
            y=(v.co.z-lo)/span
            weight.data[i].value=max(0,min(1,(.86-y)/.78))**1.4*.55
    near=len(high.data.loop_triangles)
    low=high.copy();low.data=high.data.copy();low.name=name+'_LOD1';bpy.context.collection.objects.link(low)
    bpy.context.view_layer.objects.active=low
    dec=low.modifiers.new('Distant original silhouette','DECIMATE');dec.ratio=min(.3,1800/near);dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name);low.data.calc_loop_triangles()
    coords=[v.co for v in high.data.vertices]
    spans=[max(v[i] for v in coords)-min(v[i] for v in coords) for i in range(3)]
    for obj in bpy.context.scene.objects:obj.select_set(obj in (high,low))
    bpy.context.view_layer.objects.active=high
    bpy.ops.export_scene.gltf(filepath=str(work/(name+'-lods.glb')),export_format='GLB',use_selection=True,
      export_yup=True,export_attributes=True,export_animations=False,export_cameras=False,export_lights=False)
    report={'triangles':near,'lodTriangles':len(low.data.loop_triangles),'sourceSizeXYZ':[spans[0],spans[2],spans[1]],'lods':2}
    (work/'geometry.json').write_text(json.dumps(report,indent=2)+'\n')
    print(name,report,flush=True)
