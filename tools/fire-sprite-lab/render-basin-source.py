"""Project JangaFX's CC0 Small Camp Fire volumes into fixed-proportion sprites.

Blender 5.2, invoked from the repository root. No simulation, deformation,
per-frame camera fitting, or spatial image warp is performed. The source's
flames channel supplies emission/opacity; smoke is deliberately omitted.
Download/unzip the source archive at the path in basin-source/provenance.json.
"""
import bpy
import hashlib
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'art/fire-sprites/basin-source'
VOLUMES = SOURCE / 'original/smallCampfire/smallCampfireVDB'
OUTPUT = SOURCE / 'frames'
OUTPUT.mkdir(parents=True, exist_ok=True)
files = sorted(VOLUMES.glob('smallCampfire_*.vdb'))
assert len(files) == 200, 'Expected the complete 200-frame source sequence'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE'
scene.eevee.volumetric_tile_size = '2'
scene.eevee.volumetric_samples = 256
scene.eevee.taa_render_samples = 64
scene.eevee.use_volume_custom_range = True
scene.eevee.volumetric_start = 3
scene.eevee.volumetric_end = 7
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'

bpy.ops.object.volume_import(filepath=str(files[0]))
volume = bpy.context.object
volume.scale = (.01, .01, .01)  # Uniform unit conversion only.
material = bpy.data.materials.new('Fixed flame-channel projection')
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
shader = nodes.new('ShaderNodeVolumePrincipled')
shader.inputs['Density Attribute'].default_value = 'flames'
shader.inputs['Density'].default_value = .1
shader.inputs['Color'].default_value = (1, 1, 1, 1)
shader.inputs['Emission Color'].default_value = (1, 1, 1, 1)
attribute = nodes.new('ShaderNodeAttribute')
attribute.attribute_name = 'flames'
strength = nodes.new('ShaderNodeMath')
strength.operation = 'MULTIPLY'
strength.inputs[1].default_value = .1
links.new(attribute.outputs['Fac'], strength.inputs[0])
links.new(strength.outputs[0], shader.inputs['Emission Strength'])
links.new(shader.outputs['Volume'], out.inputs['Volume'])
volume.data.materials.append(material)

bpy.ops.object.camera_add()
camera = bpy.context.object
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.6
camera.data.clip_end = 100
centre = Vector((-.08, 1.515, -1.05))
camera.location = centre + Vector((0, -5, 0))
camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()

frames = []
for index, path in enumerate(files):
    volume.data.filepath = str(path)
    volume.data.grids.load()
    volume.data.update_tag()
    bpy.context.view_layer.update()
    destination = OUTPUT / f'{index:03d}.png'
    scene.render.filepath = str(destination)
    bpy.ops.render.render(write_still=True)
    frames.append({'index': index, 'vdb': path.name,
                   'vdbSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                   'pngSha256': hashlib.sha256(destination.read_bytes()).hexdigest()})

provenance = {
    'author': 'JangaFX', 'name': 'Small Camp Fire', 'license': 'CC0-1.0',
    'sourcePage': 'https://jangafx.com/software/embergen/download/free-vdb-animations',
    'download': 'https://www.mediafire.com/file/9xx9icyomy2txv7/SmallCampfireVDB.zip/file',
    'archiveSha256': hashlib.sha256((SOURCE / 'SmallCampfireVDB.zip').read_bytes()).hexdigest(),
    'blenderVersion': bpy.app.version_string, 'sourceFrames': 200,
    'projection': {'camera': 'orthographic', 'centre': list(centre),
                   'verticalSpan': 1.6, 'resolution': [512, 512],
                   'volumeScale': [.01, .01, .01], 'channel': 'flames',
                   'density': .1, 'emission': .1,
                   'volumeSamples': 256, 'renderSamples': 64},
    'frames': frames,
}
(SOURCE / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
print('BASIN_SOURCE_COMPLETE', len(frames), flush=True)
