"""Merge actual Meshy parts, retain their atlas and create lightweight GLB LODs.

Run Blender --background --python tools/treehouse-trials-assets/prepare.py -- NAME.
No procedural replacement geometry is used. Placement/collision remain level data.
"""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/treehouse-trials'
name = sys.argv[sys.argv.index('--') + 1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(WORK / (name + '-source.glb')))
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert parts, 'Meshy source has no meshes'
for obj in bpy.context.scene.objects: obj.select_set(obj in parts)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1: bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
high.name = name + '_LOD0'
materials = {slot.material for slot in high.material_slots if slot.material}
assert len(materials) == 1, 'Source needs one shared atlas material'
high.data.calc_loop_triangles()
near_triangles = len(high.data.loop_triangles)
low = high.copy(); low.data = high.data.copy(); low.name = name + '_LOD1'
bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active = low
modifier = low.modifiers.new('Distant broad silhouette', 'DECIMATE')
modifier.ratio = .32
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
low.data.calc_loop_triangles()
far_triangles = len(low.data.loop_triangles)
for obj in bpy.context.scene.objects: obj.select_set(obj in [high,low])
bpy.ops.export_scene.gltf(filepath=str(WORK / (name + '-lods.glb')),
    export_format='GLB', use_selection=True, export_yup=True,
    export_animations=False, export_cameras=False, export_lights=False)
coords = [high.matrix_world @ v.co for v in high.data.vertices]
lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center = (lo+hi)/2; span = hi-lo
low.hide_render = True
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
scene.render.resolution_x = 720; scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.color = (.22,.24,.25)
scene.view_settings.view_transform = 'AgX'
for label, direction, energy in [('Key',(3,-4,5),130),('Fill',(-4,-1,3),85),('Rim',(2,3,4),110)]:
    bpy.ops.object.light_add(type='AREA', location=center+Vector(direction)*max(span)/4)
    light = bpy.context.object; light.name = label
    light.data.energy = energy; light.data.shape = 'DISK'; light.data.size = 5
    light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); camera = bpy.context.object
camera.data.type = 'ORTHO'; camera.data.ortho_scale = max(span)*1.32
scene.camera = camera
for label, angle in [('front',20),('rear',200)]:
    a = math.radians(angle)
    camera.location = center+Vector((math.sin(a)*3,-math.cos(a)*3,1))*max(span)
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(WORK / (name+'-review-'+label+'.png'))
    bpy.ops.render.render(write_still=True)
(WORK / (name+'-geometry.json')).write_text(json.dumps({
    'triangles': near_triangles, 'lodTriangles': far_triangles,
    'sourceSpanGltf': [span.x,span.z,span.y], 'sourceBoundsBlender': [list(lo),list(hi)],
    'sourceMeshCount': len(parts), 'materials': len(materials),
    'placement': 'Bottom anchored; front +Z in glTF. Collision is authored separately.',
},indent=2)+'\n')
