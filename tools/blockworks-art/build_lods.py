"""Blender: geometry-only distance LODs derived from the packed Meshy originals.

The original near meshes and all their materials remain byte-for-byte intact.
Sidecars retain painted UVs and normalized coordinates, sharing near materials
at runtime instead of downloading duplicate textures.
"""
import bpy, hashlib, json, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/blockworks-art'
names=sys.argv[sys.argv.index('--')+1:]
report_path=ROOT/'tools/blockworks-art/lod-manifest.json'
report=json.loads(report_path.read_text()) if report_path.exists() else {}
for name in names:
    source=OUT/(name+'.glb')
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert len(meshes)==1, 'Explicit material mapping required for multi-mesh asset'
    original=meshes[0]
    world=original.matrix_world.copy();original.parent=None;original.matrix_world=world
    bpy.ops.object.select_all(action='DESELECT');original.select_set(True)
    bpy.context.view_layer.objects.active=original
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    original.data.calc_loop_triangles();count=len(original.data.loop_triangles)
    levels=[];counts=[]
    for level,ratio in [(1,.32),(2,.10)]:
        obj=original.copy();obj.data=original.data.copy()
        bpy.context.collection.objects.link(obj);obj.name=name+'_LOD'+str(level)
        obj['bwLod']=level;obj.data.materials.clear()
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Meshy distance detail','DECIMATE')
        modifier.ratio=max(ratio,min(1,180/count));modifier.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.calc_loop_triangles();counts.append(len(obj.data.loop_triangles));levels.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in levels:obj.select_set(True)
    target=OUT/(name+'-lod.glb')
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
        export_yup=True,export_animations=False,export_cameras=False,export_lights=False,
        export_materials='NONE',export_extras=True)
    report[name]={'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'output':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
        'triangles':[count,*counts],'bytes':target.stat().st_size,
        'method':'Blender decimation of original Meshy geometry, UVs retained, shared original materials'}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    print('LOD',name,report[name]['triangles'],flush=True)
