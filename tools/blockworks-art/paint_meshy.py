"""Blender: render the real deck for ImageGen, then bake its repaint to original UVs.

No geometry is exported or replaced. pack_assets.py embeds the baked albedo in
the original Meshy GLB; its vertex/index/UV buffers remain untouched.
"""
import argparse
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('mode',choices=['reference','bake']);p.add_argument('--paint')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
work=ROOT/'.img2threejs/blockworks-assets/flagstone-deck-v3';work.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/blockworks-art/flagstone-deck-v3.glb'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box]
low=Vector(tuple(min(v[i] for v in points) for i in range(3)))
high=Vector(tuple(max(v[i] for v in points) for i in range(3)))
span=high-low;centre=(low+high)/2
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
scene.world=bpy.data.worlds.new('Transparent studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=0
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.view_settings.exposure=0;scene.view_settings.gamma=1
scene.render.film_transparent=True
scene.render.resolution_x=2048;scene.render.resolution_y=2048;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
camera_data=bpy.data.cameras.new('Exact orthographic top');camera=bpy.data.objects.new('Exact orthographic top',camera_data)
scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=max(span.x,span.y)
camera.location=(centre.x,centre.y,high.z+3);camera.rotation_euler=(0,0,0)
paint=bpy.data.images.load(str(ROOT/args.paint)) if args.paint else None
target=bpy.data.images.new('Original Meshy UV paint bake',width=4096,height=4096,alpha=False) if paint else None
for o in objects:
 for material in o.data.materials:
  nodes=material.node_tree.nodes;links=material.node_tree.links
  bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
  colour=bsdf.inputs['Base Color'].links[0].from_socket
  output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
  emission=nodes.new('ShaderNodeEmission');links.new(colour,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
  if paint:
   geometry=nodes.new('ShaderNodeNewGeometry');separate=nodes.new('ShaderNodeSeparateXYZ');links.new(geometry.outputs['Position'],separate.inputs[0])
   vector=nodes.new('ShaderNodeCombineXYZ')
   for axis,index in [('X',0),('Y',1)]:
    m=nodes.new('ShaderNodeMapRange');m.clamp=False
    m.inputs['From Min'].default_value=centre[index]-camera_data.ortho_scale/2
    m.inputs['From Max'].default_value=centre[index]+camera_data.ortho_scale/2
    links.new(separate.outputs[axis],m.inputs['Value']);links.new(m.outputs[0],vector.inputs[axis])
   texture=nodes.new('ShaderNodeTexImage');texture.image=paint;texture.extension='EXTEND';links.new(vector.outputs[0],texture.inputs['Vector'])
   normal=nodes.new('ShaderNodeSeparateXYZ');links.new(geometry.outputs['True Normal'],normal.inputs[0])
   facing=nodes.new('ShaderNodeMapRange');facing.clamp=True;facing.inputs['From Min'].default_value=.2;facing.inputs['From Max'].default_value=.75
   links.new(normal.outputs['Z'],facing.inputs['Value'])
   blend=nodes.new('ShaderNodeMixRGB');links.new(facing.outputs[0],blend.inputs[0]);links.new(colour,blend.inputs[1]);links.new(texture.outputs['Color'],blend.inputs[2]);links.new(blend.outputs[0],emission.inputs['Color'])
   bake=nodes.new('ShaderNodeTexImage');bake.image=target;nodes.active=bake
if args.mode=='reference':
 scene.render.filepath=str(work/'top-reference.png');bpy.ops.render.render(write_still=True)
else:
 if not paint:raise ValueError('--paint is required')
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 scene.render.bake.margin=16;scene.render.bake.use_clear=True
 bpy.ops.object.bake(type='EMIT')
 target.filepath_raw=str(work/'painted-albedo.png');target.file_format='PNG';target.save()
print('Meshy paint operation complete:',args.mode)
