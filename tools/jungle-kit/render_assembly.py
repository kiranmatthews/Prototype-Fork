"""Neutral Blender review of the runtime temple-part matrices (not a gameplay image)."""
from pathlib import Path
import json
import math
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/jungle-kit'
specs = {s['kind']: s for s in json.loads((ROOT/'tools/jungle-kit/module-specs.json').read_text())}
parts = json.loads((WORK/'temple-assembly-review.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

templates = {}
for kind in sorted({p['kind'] for p in parts}):
    if kind in ('joint', 'earth'):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0,0,.5))
        obj = bpy.context.object
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        mat = bpy.data.materials.new(kind)
        mat.diffuse_color = (.19,.22,.16,1) if kind=='joint' else (.29,.19,.09,1)
        obj.data.materials.append(mat)
    else:
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/jungle-kit/modular'/(specs[kind]['file']+'.glb')))
        imported = set(bpy.context.scene.objects) - before
        obj = next(o for o in imported if o.type=='MESH' and o.name.endswith('LOD0'))
        mesh = obj.data.copy()
        mesh.transform(obj.matrix_world)
        lo = Vector(tuple(min(v.co[i] for v in mesh.vertices) for i in range(3)))
        hi = Vector(tuple(max(v.co[i] for v in mesh.vertices) for i in range(3)))
        size = hi-lo
        center = (hi+lo)*.5
        for v in mesh.vertices:
            v.co = ((v.co.x-center.x)/size.x, (v.co.y-center.y)/size.y, (v.co.z-lo.z)/size.z)
        obj.data = mesh
        obj.matrix_world = Matrix.Identity(4)
        for other in imported:
            if other != obj:
                bpy.data.objects.remove(other, do_unlink=True)
    templates[kind] = obj
    obj.hide_render = True

# Three.js X/Y/Z becomes Blender X/-Z/Y.
convert = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
for index, part in enumerate(parts):
    obj = bpy.data.objects.new(f"{part['kind']} {index+1}", templates[part['kind']].data)
    bpy.context.collection.objects.link(obj)
    values = part['matrix']
    matrix = Matrix(tuple(tuple(values[c*4+r] for c in range(4)) for r in range(4)))
    obj.matrix_world = convert @ matrix @ convert.inverted()

for obj in templates.values():
    bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.025))
ground = bpy.data.materials.new('neutral studio ground')
ground.diffuse_color = (.36,.39,.35,1)
bpy.context.object.data.materials.append(ground)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 1400
scene.render.resolution_percentage = 100
scene.world.color = (.32,.38,.42)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .35

for name, pos, power, size in [('key',(4,-12,24),2600,11), ('fill',(-14,-6,12),1700,12), ('rim',(8,12,18),2100,9)]:
    data = bpy.data.lights.new(name,'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector((0,0,6))-obj.location).to_track_quat('-Z','Y').to_euler()

bpy.ops.object.camera_add(location=(21,-27,21))
camera = bpy.context.object
camera.rotation_euler = (Vector((0,0,5.8))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 25
scene.camera = camera
output = ROOT/'docs/art-reviews/jungle-ruins-modular-temple.png'
output.parent.mkdir(parents=True,exist_ok=True)
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
print(f'Rendered {len(parts)} actual modular temple parts: {output}')
