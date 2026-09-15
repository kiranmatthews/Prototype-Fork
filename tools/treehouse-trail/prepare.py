"""Pack the Meshy Smart Topology treehouse for the shared JungleAssetKit.

Run with Blender --background --python tools/treehouse-trail/prepare.py.
Only the downloaded model is used; no replacement procedural house is built.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/treehouse-trail'
name = sys.argv[sys.argv.index('--') + 1]
assert name in {'body', 'body-v2', 'balcony', 'stairs', 'landing', 'tree', 'bush', 'host', 'balcony-deck', 'canopy'}
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
source_name = {'balcony-deck': 'balcony', 'canopy': 'tree'}.get(name, name)
bpy.ops.import_scene.gltf(filepath=str(WORK / (source_name + '-source.glb')))
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
assert parts, 'Meshy produced no meshes'
for obj in bpy.context.scene.objects:
    obj.select_set(obj in parts)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
high.name = name + '_LOD0'
# Reuse the actual Meshy deck and crown as distinct modular parts. Removing
# the original railing lets the new stair opening and rope rail be authored
# correctly; a separate crown keeps leaves out of the cabin/trunk junction.
if name in {'balcony-deck', 'canopy'}:
    lower = min(v.co.z for v in high.data.vertices)
    span = max(v.co.z for v in high.data.vertices) - lower
    bm = bmesh.new(); bm.from_mesh(high.data)
    if name == 'balcony-deck':
        remove = [f for f in bm.faces if any((v.co.z-lower)/span > .35 for v in f.verts)]
    else:
        remove = [f for f in bm.faces if any((v.co.z-lower)/span < .53 for v in f.verts)]
    bmesh.ops.delete(bm, geom=remove, context='FACES')
    if name == 'balcony-deck':
        for v in bm.verts:
            if (v.co.z-lower)/span > .27: v.co.z = lower + span * .30
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00003)
        boundary = [e for e in bm.edges if e.is_boundary]
        if boundary: bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    bm.to_mesh(high.data); bm.free(); high.data.update()
# Seat the generated surfaces on reproducible module contact planes. The
# texture/UVs and source silhouette remain Meshy's; these are fitting edits.
source_lo = min(v.co.z for v in high.data.vertices)
source_height = max(v.co.z for v in high.data.vertices) - source_lo
def remap(value, points):
    for (a, x), (b, y) in zip(points, points[1:]):
        if value <= b:
            return x + (y - x) * max(0, value - a) / (b - a)
    return points[-1][1]
for vertex in high.data.vertices:
    height = (vertex.co.z - source_lo) / source_height
    if name == 'balcony':
        height = remap(height, [(0, 0), (.285, 1/6), (.315, 1/6), (1, 1)])
    elif name == 'landing':
        height = remap(height, [(0, 0), (.93, .93), (.96, 1), (1, 1)])
    elif name == 'stairs':
        # Meshy returned seven real treads. Fit their broad top faces to
        # seven equal rises; retain the open risers and diagonal stringers.
        tops = [.195, .316, .438, .575, .710, .840, .978]
        points = [(0, 0)]
        for index, top in enumerate(tops):
            points.extend([(top - .022, (index + 1) / 7), (min(1, top + .022), (index + 1) / 7)])
        if points[-1][0] < 1:
            points.append((1, 1))
        height = remap(height, points)
    vertex.co.z = source_lo + height * source_height
high.data.update()
materials = {slot.material for slot in high.material_slots if slot.material}
assert len(materials) == 1, 'Treehouse needs a shared material atlas before export'
high.data.calc_loop_triangles()
near_triangles = len(high.data.loop_triangles)
low = high.copy()
low.data = high.data.copy()
low.name = name + '_LOD1'
bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active = low
modifier = low.modifiers.new('Distant treehouse silhouette', 'DECIMATE')
modifier.ratio = 0.38
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
low.data.calc_loop_triangles()
far_triangles = len(low.data.loop_triangles)
for obj in bpy.context.scene.objects:
    obj.select_set(obj in [high, low])
bpy.ops.export_scene.gltf(filepath=str(WORK / (name + '-lods.glb')),
    export_format='GLB', use_selection=True, export_yup=True,
    export_animations=False, export_cameras=False, export_lights=False)

# Four source views allow a review of the full 3D silhouette and rear artwork.
low.hide_render = True
coords = [high.matrix_world @ v.co for v in high.data.vertices]
lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center = (lo + hi) / 2
span = hi - lo
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.color = (.18, .20, .23)
scene.view_settings.view_transform = 'AgX'
scene.render.film_transparent = False
for light_name, location, energy, size in [
    ('Key', (3, -4, 6), 100, 5),
    ('Fill', (-4, -1, 3), 55, 5),
    ('Rim', (2, 3, 5), 80, 4),
]:
    bpy.ops.object.light_add(type='AREA', location=center + Vector(location) * max(span) / 4)
    light = bpy.context.object
    light.name = light_name
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (center - light.location).to_track_quat('-Z', 'Y').to_euler()
bpy.ops.object.camera_add()
camera = bpy.context.object
camera.data.type = 'ORTHO'
camera.data.ortho_scale = max(span) * 1.3
scene.camera = camera
for label, angle in [('front', 25), ('rear', 200)]:
    a = math.radians(angle)
    camera.location = center + Vector((math.sin(a) * 3, -math.cos(a) * 3, .75)) * max(span)
    camera.rotation_euler = (center - camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(WORK / (name + '-review-' + label + '.png'))
    bpy.ops.render.render(write_still=True)
surface_samples = []
for i in range(65):
    t = (i + .5) / 65
    y = lo.y + span.y * t
    hit, point, normal, index = high.ray_cast(Vector((center.x, y, hi.z + 1)), Vector((0, 0, -1)))
    surface_samples.append({'along': round(t, 5), 'top': round((point.z - lo.z) / span.z, 5) if hit else None})
(WORK / (name + '-geometry.json')).write_text(json.dumps({
    'triangles': near_triangles, 'lodTriangles': far_triangles,
    'sourceSpanGltf': [span.x, span.z, span.y],
    'sourceBoundsBlender': [list(lo), list(hi)],
    'sourceMeshCount': len(parts), 'materials': len(materials),
    'centerlineFromPositiveZ': surface_samples,
}, indent=2) + '\n')
