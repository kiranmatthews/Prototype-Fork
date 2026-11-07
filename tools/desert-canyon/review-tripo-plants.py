"""Render the shipped, unmodified Tripo plant meshes from four sides."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/desert-canyon/plants/tripo'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=20
scene.cycles.use_denoising=True
scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.world.color=(.4,.4,.4);scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.render.image_settings.file_format='PNG'
for loc,power,size in [((3,-4,5),420,4),((-4,-2,3),250,4),((1,4,4),320,3)]:
    data=bpy.data.lights.new('Softbox','AREA');data.energy=power;data.shape='DISK';data.size=size
    light=bpy.data.objects.new('Softbox',data);scene.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('Review');cam=bpy.data.objects.new('Review',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO'
for asset in json.loads((ROOT/'public/desert-canyon/plants/manifest.json').read_text())['assets']:
    before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/desert-canyon/plants'/asset['file']))
    objects=set(scene.objects)-before
    points=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    target=(lo+hi)*.5;span=max(hi-lo);camdata.ortho_scale=span*1.3
    for angle in [0,90,180,270]:
        a=math.radians(angle+12);cam.location=target+Vector((math.sin(a)*span*2,-math.cos(a)*span*2,span*.35))
        cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/f"{asset['id']}-{angle}.png");bpy.ops.render.render(write_still=True)
    for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
