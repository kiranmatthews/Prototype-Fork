"""Render the registered maquette cameras. Add --uv to record the visible material surfaces."""

import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from reference_pose import REFERENCE_VIEWS, place_camera, portrait_lights, reference_pose

args = sys.argv[sys.argv.index('--') + 1 :]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
cam = scene.camera
rig = next(o for o in scene.objects if o.type == 'ARMATURE')
views = REFERENCE_VIEWS
if rig.animation_data:
    rig.animation_data.action = None
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.resolution_x = scene.render.resolution_y = 724
scene.render.resolution_percentage = 100
bpy.data.objects['Studio ground'].hide_render = True
cam.data.ortho_scale = 724 * 0.00125


def frame(name, az, pitch, u0):
    reference_pose(rig, name == 'three-quarter')
    bpy.context.view_layer.update()
    portrait_lights(bpy.data.objects, place_camera(cam, az, pitch, u0))


for shot in views:
    frame(*shot)
    scene.render.filepath = str(out / (shot[0] + '.png'))
    bpy.ops.render.render(write_still=True)


def category(name):
    if name.startswith(
        ('Swept ponytail', 'Outer ponytail', 'Inner ponytail', 'Upper ponytail', 'Gathered hair inside')
    ):
        return 1
    if name.startswith(
        ('Sculpted face-framing', 'Swept temple', 'Forward fringe', 'Anterior temple', 'Central part')
    ):
        return 2
    if name.startswith(('Cranium', 'Chin and lower', 'Orbital skin', 'Short nape')):
        return 3
    if name.startswith('Sculpted ear'):
        return 4
    if name.startswith('Violet iris'):
        return 5
    if name.startswith('Sclera'):
        return 6
    if name.startswith('Nose leather'):
        return 7
    if name.startswith('Oval shell'):
        return 8
    if name.startswith(('Winged upper', 'Lower lash', 'Outer lash tip')):
        return 9
    if name.startswith('Tapered eyebrow'):
        return 10
    if name.startswith('Double violet'):
        return 11
    if name in ('Upper lip roll', 'Lower lip roll'):
        return 12
    if 'bound knit' in name:
        return 13
    if name.startswith(('Fitted tank', 'Arm ')):
        return 14
    return 0


if '--uv' in args:
    # Encode the visible pigment UV, surface class and view incidence in a linear
    # emission pass. Occluded face, hair and clothing never receive donor pixels.
    shaders = {}
    for number in range(15):
        m = bpy.data.materials.new('Visible pigment ' + str(number))
        m.use_nodes = True
        nt = m.node_tree
        nt.nodes.clear()

        def node(kind):
            return nt.nodes.new(kind)

        def wire(a, b):
            nt.links.new(a, b)

        uv = node('ShaderNodeTexCoord')
        sep = node('ShaderNodeSeparateXYZ')
        wire(uv.outputs['UV'], sep.inputs[0])
        geom = node('ShaderNodeNewGeometry')
        dot = node('ShaderNodeVectorMath')
        dot.operation = 'DOT_PRODUCT'
        wire(geom.outputs['Normal'], dot.inputs[0])
        wire(geom.outputs['Incoming'], dot.inputs[1])
        absolute = node('ShaderNodeMath')
        absolute.operation = 'ABSOLUTE'
        wire(dot.outputs['Value'], absolute.inputs[0])
        code = node('ShaderNodeMath')
        code.operation = 'MULTIPLY_ADD'
        wire(absolute.outputs[0], code.inputs[0])
        code.inputs[1].default_value = 0.83 / 16
        code.inputs[2].default_value = (number + 0.08) / 16
        ch = node('ShaderNodeCombineColor')
        wire(sep.outputs[0], ch.inputs[0])
        wire(sep.outputs[1], ch.inputs[1])
        wire(code.outputs[0], ch.inputs[2])
        em = node('ShaderNodeEmission')
        wire(ch.outputs[0], em.inputs[0])
        end = node('ShaderNodeOutputMaterial')
        wire(em.outputs[0], end.inputs['Surface'])
        shaders[number] = m
    for o in scene.objects:
        if o.type != 'MESH' or not o.get('cargoSection'):
            continue
        groups = {
            vg.index: category(vg.name.removeprefix('Island • '))
            for vg in o.vertex_groups
            if vg.name.startswith('Island • ')
        }
        vcat = [next((groups[g.group] for g in v.groups if g.group in groups), 0) for v in o.data.vertices]
        o.data.materials.clear()
        for material in shaders.values():
            o.data.materials.append(material)
        for poly in o.data.polygons:
            poly.material_index = vcat[poly.vertices[0]]
    scene.view_settings.view_transform = 'Raw'
    scene.view_settings.exposure = 0
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '32'
    for shot in views:
        frame(*shot)
        name = shot[0]
        path = out / (name + '-coordinates.exr')
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(str(path))
        pixels = np.empty(724 * 724 * 4, np.float32)
        im.pixels.foreach_get(pixels)
        np.savez_compressed(out / (name + '-coordinates.npz'), surface=pixels.reshape(724, 724, 4)[::-1])
