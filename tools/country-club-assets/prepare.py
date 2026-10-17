"""Preserve each Meshy component's geometry/UVs; add a shared-atlas far LOD.

Blender --background --python prepare.py -- NAME [NAME ...]
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/country-club-art'
OUT=ROOT/'public/country-club-art'
SPECS=json.loads((Path(__file__).parent/'assets.json').read_text())
OUT.mkdir(parents=True,exist_ok=True)
for name in sys.argv[sys.argv.index('--')+1:]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    source=WORK/name/'downloads/model.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    parts=[o for o in bpy.context.scene.objects if o.type=='MESH']
    assert parts,name+': missing mesh'
    for o in bpy.context.scene.objects:o.select_set(o in parts)
    bpy.context.view_layer.objects.active=parts[0]
    if len(parts)>1:bpy.ops.object.join()
    high=bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    high.name=name+'_LOD0'
    mats={s.material for s in high.material_slots if s.material}
    assert len(mats)==1,name+': expected one atlas'
    assert high.data.uv_layers,name+': no UVs'
    bounds=[(min(v.co[i] for v in high.data.vertices),max(v.co[i] for v in high.data.vertices)) for i in range(3)]
    spans=[b-a for a,b in bounds]
    assert all(math.isfinite(v) and v>0 for v in spans)
    high.data.calc_loop_triangles();near=len(high.data.loop_triangles)
    low=high.copy();low.data=high.data.copy();low.name=name+'_LOD1';bpy.context.collection.objects.link(low)
    bpy.context.view_layer.objects.active=low
    m=low.modifiers.new('Far silhouette','DECIMATE');m.ratio=.06 if name=='oak' else .25;m.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=m.name)
    low.data.calc_loop_triangles();far=len(low.data.loop_triangles)
    for o in bpy.context.scene.objects:o.select_set(o in (high,low))
    bpy.ops.export_scene.gltf(filepath=str(WORK/(name+'-lods.glb')),export_format='GLB',
      use_selection=True,export_yup=True,export_animations=False,export_cameras=False,export_lights=False)
    natural=[spans[0],spans[2],spans[1]]
    width=SPECS[name]['width'];size=[round(x*width/natural[0],5) for x in natural]
    report={'name':name,'source':str(source.relative_to(ROOT)),'sourceSize':natural,
      'sizeAtDefaultWidth':size,'nearTriangles':near,'farTriangles':far,'materials':1,
      'sourceGeometryPreserved':True,'originalUVsPreserved':True,'role':'editable modular scenery; non-colliding'}
    (OUT/(name+'.json')).write_text(json.dumps(report,indent=2)+'\n')
    # Review at original proportions, with the same material that will ship.
    low.hide_render=True
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12
    scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.world.color=(.62,.68,.73)
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
    center=Vector([(a+b)/2 for a,b in bounds]);radius=max(spans)*1.7
    camera_data=bpy.data.cameras.new('review-camera');camera=bpy.data.objects.new('review-camera',camera_data)
    scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=max(spans)*1.65
    for i,(location,power,size_light) in enumerate([((2,-4,6),900,5),((-4,-1,3),500,4),((0,4,5),650,4)]):
        data=bpy.data.lights.new('softbox'+str(i),'AREA');obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj)
        obj.location=center+Vector(location)*max(spans)*.5;data.energy=power*.12*max(spans)**2;data.shape='DISK';data.size=size_light*max(spans)*.5
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    for label,view in [('front',(0,-1,.25)),('quarter',(.7,-1,.5)),('rear',(.7,1,.35))]:
        camera.location=center+Vector(view).normalized()*radius
        camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(WORK/(name+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
    print('COASTAL_PREPARED',json.dumps(report))
