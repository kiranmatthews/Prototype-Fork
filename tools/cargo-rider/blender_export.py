"""Blender background authoring/export. Use -- <bake-directory> [preview-directory]."""

import bpy
import sys
import json
import pickle
import math
import collections
from pathlib import Path
from mathutils import Vector
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from blender_actions import install_actions
from pigment_morph import install_source_shader, write_color_morphs

ROOT = HERE.parent.parent
ART = ROOT / 'art/cargo-rider'
args = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
work = Path(args[0])
review = Path(args[1]) if len(args) > 1 else None
parts, width, height = pickle.load((work / 'surface.pickle').open('rb'))
rest = json.loads((HERE / 'calibration.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 60
bpy.context.preferences.filepaths.save_version = 0


def xyz(v):
    return (float(v[0]), float(-v[2]), float(v[1]))


def link(o):
    bpy.context.collection.objects.link(o)
    return o


rig = link(bpy.data.objects.new('Cargo Roo • Bone Man', bpy.data.armatures.new('Bone Man | measured A-stance')))
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
rig.show_in_front = True
rig.data.display_type = 'STICK'
bpy.ops.object.mode_set(mode='EDIT')
children = collections.defaultdict(list)
for name, r in rest.items():
    children[r['parent']].append(name)
excluded = {'tail-root'}
used = {k for p in parts for w in p['weights'] for k in w}
for name, r in rest.items():
    if name in excluded:
        continue
    b = rig.data.edit_bones.new(name)
    b.head = xyz(r['matrix'][12:15])
    candidates = [c for c in children[name] if c not in excluded and not c.startswith('socket')]
    candidates.sort(key=lambda c: c.startswith(('ear', 'pony', 'clavicle', 'hip-', 'finger', 'thumb')))
    choose = next(
        (
            c
            for c in candidates + children[name]
            if (Vector(xyz(rest[c]['matrix'][12:15])) - b.head).length > 0.012
        ),
        None,
    )
    b.tail = xyz(rest[choose]['matrix'][12:15]) if choose else b.head + Vector((0, -0.012, 0.027))
    b.use_deform = name in used
for name, r in rest.items():
    if name in excluded:
        continue
    if r['parent'] and r['parent'] in rig.data.edit_bones:
        rig.data.edit_bones[name].parent = rig.data.edit_bones[r['parent']]
bpy.ops.object.mode_set(mode='OBJECT')
for b in rig.data.bones:
    b['boneManRest'] = rest[b.name]['matrix']
    category = (
        'Contact sockets'
        if b.name.startswith('socket')
        else ('Hands' if any(x in b.name for x in ('finger', 'thumb', 'hand-rest')) else 'Body')
    )
    coll = rig.data.collections.get(category) or rig.data.collections.new(category)
    coll.assign(b)
    if category == 'Contact sockets':
        coll.is_visible = False
rig['rigSource'] = 'Bone Man / rider-local +Z forward / shipped proportions in calibration stance'
images = []
for file, colorspace in [
    ('pigment.png', 'sRGB'),
    ('relief.png', 'Non-Color'),
    ('surface-response.png', 'Non-Color'),
]:
    im = bpy.data.images.load(str(work / file))
    im.colorspace_settings.name = colorspace
    im.pack()
    images.append(im)
materials = {}
rough = {
    'Facial fur': 0.70,
    'Cornea': 0.24,
    'Wet tongue': 0.31,
    'Enamel': 0.37,
    'Gold silk hair': 0.39,
    'Nose leather': 0.35,
    'Metal': 0.30,
    'Shoe leather': 0.49,
    'Rubber': 0.76,
    'Pearl': 0.34,
    'Nail': 0.38,
    'Satin': 0.67,
}
for kind in sorted(set(p['mat'] for p in parts)):
    m = bpy.data.materials.new(kind)
    m.use_nodes = True
    m.diffuse_color = (0.9, 0.67, 0.38, 1)
    nt = m.node_tree
    bs = nt.nodes.get('Principled BSDF')
    bs.inputs['Roughness'].default_value = rough[kind]
    bs.inputs['Metallic'].default_value = 0.62 if kind == 'Metal' else 0
    bs.inputs['Specular IOR Level'].default_value = {
        'Cornea': 0.11,
        'Satin': 0.18,
        'Facial fur': 0.19,
        'Gold silk hair': 0.25,
    }.get(kind, 0.32)
    if kind == 'Facial fur':
        bs.inputs['Sheen Weight'].default_value = 0.08
        bs.inputs['Sheen Roughness'].default_value = 0.65
        bs.inputs['Subsurface Weight'].default_value = 0.045
        bs.inputs['Subsurface Scale'].default_value = 0.012
    if kind == 'Pearl':
        bs.inputs['IOR'].default_value = 1.55
        bs.inputs['Coat Weight'].default_value = 0.27
        bs.inputs['Coat Roughness'].default_value = 0.17
    if kind == 'Gold silk hair':
        bs.inputs['Anisotropic'].default_value = 0.33
        bs.inputs['Coat Weight'].default_value = 0.06
        bs.inputs['Sheen Weight'].default_value = 0.11
    for index, im in enumerate(images):
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = im
        n.location = (-620, 200 - 280 * index)
        if not index:
            nt.links.new(n.outputs['Color'], bs.inputs['Base Color'])
            nt.nodes.active = n
        elif index == 1:
            norm = nt.nodes.new('ShaderNodeNormalMap')
            norm.inputs['Strength'].default_value = 0.53
            norm.location = (-300, -100)
            nt.links.new(n.outputs['Color'], norm.inputs['Color'])
            nt.links.new(norm.outputs['Normal'], bs.inputs['Normal'])
        else:
            separate = nt.nodes.new('ShaderNodeSeparateColor')
            separate.location = (-280, -450)
            nt.links.new(n.outputs['Color'], separate.inputs['Color'])
            nt.links.new(separate.outputs['Green'], bs.inputs['Roughness'])
            nt.links.new(separate.outputs['Blue'], bs.inputs['Metallic'])
    materials[kind] = m
# Merge islands which share a deformation contract. Each remains selectable as a named vertex group in Blender.
groups = collections.defaultdict(list)
skin_keys = tuple(sorted(set().union(*(p['keys'] for p in parts if p.get('skin_sheet')))))
for p in parts:
    keys = skin_keys if p.get('skin_sheet') else tuple(sorted(p['keys']))
    groups[(p['group'], p['mat'], keys)].append(p)
for idx, ((section, mat, keys), islands) in enumerate(groups.items()):
    vertices = []
    undertones = []
    faces = []
    uvs = []
    influences = collections.defaultdict(list)
    landmarks = []
    deltas = {k: [] for k in keys}
    patch_indices = {}
    for p in islands:
        mapped = {}
        used = {k for face in p['faces'] for k in face}
        nu, nv = p['nu'], p['nv']
        wrap = p['cyclic']
        row = nu if wrap else nu + 1
        rx, ry, rw, rh = p['rect']
        for j in range(nv + 1):
            for i in range(row):
                k = j * (nu + 1) + i
                wrapped = j * (nu + 1) if wrap and i == 0 else k
                if k not in used and not (wrap and i == 0 and k + nu in used):
                    continue
                join = p.get('joins', {}).get(k)
                vi = patch_indices[join[0]][join[1]] if join else len(vertices)
                mapped[k] = vi
                if wrap and i == 0:
                    mapped[wrapped + nu] = vi
                if join:
                    continue
                vertices.append(xyz(p['points'][k]))
                if 'undertone' in p:
                    undertones.append([*p['undertone'][k], 1])
                for bone, w in p['weights'][k].items():
                    influences[bone].append((vi, w))
                for key in keys:
                    deltas[key].append(
                        xyz(p['points'][k] + p['keys'][key][k]) if key in p['keys'] else vertices[vi]
                    )
        patch_indices[p['name']] = mapped
        landmarks.append((p['name'], sorted(set(mapped.values()))))
        for face in p['faces']:
            corners = [divmod(k, nu + 1) for k in face]
            faces.append(tuple(mapped[k] for k in face))
            uvs.extend(
                ((rx + 0.5 + (rw - 1) * i / nu) / width, 1 - (ry + 0.5 + (rh - 1) * j / nv) / height)
                for j, i in corners
            )
    label = islands[0]['name'] if len(islands) == 1 else section + ' | ' + mat + ' ' + str(idx + 1)
    geo = bpy.data.meshes.new(label)
    geo.from_pydata(vertices, [], faces)
    geo.update()
    geo.polygons.foreach_set('use_smooth', [True] * len(faces))
    uv = geo.uv_layers.new(name='Pigment UV')
    uv.uv.foreach_set('vector', np.array(uvs, dtype=np.float32).ravel())
    obj = link(bpy.data.objects.new(label, geo))
    geo.materials.append(materials[mat])
    obj.parent = rig
    obj['cargoSection'] = section
    if undertones:
        tint = geo.color_attributes.new(name='Cheek undertone', type='FLOAT_COLOR', domain='POINT')
        tint.data.foreach_set('color', np.asarray(undertones, dtype=np.float32).ravel())
        geo.color_attributes.active_color = tint
        obj['cargoCheekUndertone'] = True
    for n, values in influences.items():
        vg = obj.vertex_groups.new(name=n)
        solid = [i for i, w in values if w >= 0.999999]
        if solid:
            vg.add(solid, 1, 'REPLACE')
        for i, w in values:
            if w < 0.999999:
                vg.add([i], w, 'REPLACE')
    for name, indices in landmarks:
        vg = obj.vertex_groups.new(name='Island • ' + name)
        vg.add(indices, 1, 'REPLACE')
    if keys:
        obj.shape_key_add(name='Basis')
        for key in keys:
            block = obj.shape_key_add(name=key)
            block.data.foreach_set('co', np.array(deltas[key], dtype=np.float32).ravel())
            if key not in rig:
                rig[key] = 0.0
                rig.id_properties_ui(key).update(
                    min=0.0,
                    max=1.0,
                    soft_min=0.0,
                    soft_max=1.0,
                    description='Facial or secondary-motion control',
                )
            driver = block.driver_add('value').driver
            driver.type = 'AVERAGE'
            var = driver.variables.new()
            var.name = 'control'
            var.targets[0].id = rig
            var.targets[0].data_path = '["' + key + '"]'
    mod = obj.modifiers.new(name='Bone Man • skin', type='ARMATURE')
    mod.object = rig
    obj.select_set(True)
from shoulder_pose import add_shoulder_correctives, install_chest_space

add_shoulder_correctives(bpy, rig)
# Capture native expression channels independently of Blender drivers.
# Blender keeps its slider rig in the source file.
export_dir = ROOT / 'public/characters/cargo-rider'
export_dir.mkdir(parents=True, exist_ok=True)
options = dict(
    filepath=str(export_dir / 'cargo-roo.glb'),
    export_format='GLB',
    export_animations=False,
    export_extras=True,
    export_yup=True,
    export_skins=True,
    export_morph=True,
    export_morph_normal=True,
    export_all_influences=False,
    export_texcoords=True,
    export_vertex_color='ACTIVE',
    export_normals=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False,
    export_def_bones=False,
)
bpy.ops.export_scene.gltf(**options)
write_color_morphs(export_dir / 'cargo-roo.glb')
install_chest_space(bpy, rig)
install_source_shader(materials['Facial fur'], rig)
install_actions(bpy, rig, rest, work)
# Keep a rig- and render-ready studio with a shadow receiver in the editable source only.
studio = bpy.data.collections.new('Studio • render only')
scene.collection.children.link(studio)


def studio_object(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    studio.objects.link(o)


world = bpy.data.worlds.new('Warm neutral cyclorama')
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs[0].default_value = (0.62, 0.67, 0.78, 1)
world.node_tree.nodes.get('Background').inputs[1].default_value = 0.38
# Give camera rays the charcoal studio background while the neutral environment
# supplies illumination to the character.
world_nodes = world.node_tree.nodes
camera_bg = world_nodes.new('ShaderNodeBackground')
camera_bg.inputs['Color'].default_value = (0.256, 0.223, 0.238, 1)
paths = world_nodes.new('ShaderNodeLightPath')
mix = world_nodes.new('ShaderNodeMixShader')
world.node_tree.links.new(paths.outputs['Is Camera Ray'], mix.inputs[0])
world.node_tree.links.new(world_nodes['Background'].outputs[0], mix.inputs[1])
world.node_tree.links.new(camera_bg.outputs[0], mix.inputs[2])
world.node_tree.links.new(
    mix.outputs[0], next(n for n in world_nodes if n.type == 'OUTPUT_WORLD').inputs['Surface']
)
scene.world = world
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0.1511))
floor = bpy.context.object
floor.name = 'Studio ground'
fm = bpy.data.materials.new('Warm stone')
fm.use_nodes = True
fm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (0.34, 0.29, 0.34, 1)
fm.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.91
floor.data.materials.append(fm)
studio_object(floor)


def aim(o, p):
    o.rotation_euler = (Vector(p) - o.location).to_track_quat('-Z', 'Y').to_euler()


for name, loc, power, size, c in [
    ('Key softbox', (-3, -4, 5.4), 375, 3.4, (1, 0.87, 0.76)),
    ('Cool fill', (3, -2.8, 3.2), 140, 3.6, (0.8, 0.88, 1)),
    ('Rim', (1.1, 2.4, 4), 183, 3.6, (1, 0.83, 0.64)),
    ('Portrait bounce', (-0.65, -3.0, 0.28), 112, 3.8, (1, 0.85, 0.71)),
]:
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.shape = 'DISK'
    light.size = size
    light.color = c
    o = link(bpy.data.objects.new(name, light))
    o.location = loc
    aim(o, (0, 0, 1.2))
    studio_object(o)
cam = link(bpy.data.objects.new('Character portrait', bpy.data.cameras.new('Portrait lens')))
studio_object(cam)
scene.camera = cam
cam.data.type = 'ORTHO'
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.exposure = -0.43
scene.render.resolution_percentage = 100


def view(angle, framing):
    h = {'hero': 1.18, 'face': 1.86, 'shoe': 0.29}[framing]
    pitch = 0.12 if framing == 'hero' else 0.035
    ang = math.radians(angle)
    cam.location = (4.0 * math.sin(ang), -4.0 * math.cos(ang), h + pitch * 4)
    aim(cam, (0, 0, h))
    cam.data.ortho_scale = {'hero': 2.30, 'face': 0.95, 'shoe': 0.83}[framing]
    scene.render.resolution_x = 800
    scene.render.resolution_y = 890 if framing == 'hero' else 620


view(13, 'hero')
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
            area.spaces.active.shading.color_type = 'TEXTURE'
            area.spaces.active.shading.type = 'MATERIAL'
            area.spaces.active.shading.use_scene_lights = True
            area.spaces.active.shading.use_scene_world = True
            area.spaces.active.overlay.show_overlays = False
from reference_pose import REFERENCE_VIEWS, place_camera, portrait_lights

reference_cameras = {}
for title, az, pitch, u0 in REFERENCE_VIEWS:
    shot = link(bpy.data.objects.new('Reference | ' + title.title(), bpy.data.cameras.new(title + ' • 724 px')))
    studio_object(shot)
    frame = place_camera(shot, az, pitch, u0)
    reference_cameras[title] = shot
    if title == 'three-quarter':
        portrait_lights(bpy.data.objects, frame)
scene.camera = reference_cameras['three-quarter']
scene.render.resolution_x = scene.render.resolution_y = 724
rig.animation_data.action = bpy.data.actions['Portrait | Three-quarter reference']
scene.frame_set(1)
floor.hide_render = True
scene.render.filepath = '//portrait.png'
bpy.ops.wm.save_as_mainfile(filepath=str(ART / 'Cargo Roo.blend'), compress=True)
# Render the actual rig for the life crate and HUD portrait, sharing the in-game face identity.
if review:
    floor.hide_render = True
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = 384
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.quality = 93
    scene.render.filepath = str(export_dir / 'portrait.webp')
    bpy.ops.render.render(write_still=True)
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    floor.hide_render = False
# The source opens on its editable reference action. Keep the neutral calibration
# available for the full-body gallery.
rig.animation_data.action = None
from mathutils import Matrix

for bone in rig.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
for prop in list(rig.keys()):
    if isinstance(rig[prop], float):
        rig[prop] = 0.0
rig.update_tag()
bpy.context.view_layer.update()
scene.camera = cam
floor.hide_render = False
if review:
    review.mkdir(parents=True, exist_ok=True)
    for angle, framing, title in [
        (13, 'hero', 'hero'),
        (0, 'face', 'face'),
        (88, 'hero', 'profile'),
        (177, 'hero', 'rear'),
        (12, 'face', 'expression'),
    ]:
        if title == 'expression':
            for k, v in {
                'Blink.L': 1.0,
                'Blink.R': 1.0,
                'JawOpen': 0.78,
                'Smile': 0.48,
                'BrowUp.L': 0.65,
            }.items():
                rig[k] = v
            rig.update_tag()
            bpy.context.view_layer.update()
        view(angle, framing)
        scene.render.filepath = str(review / (title + '.png'))
        bpy.ops.render.render(write_still=True)
