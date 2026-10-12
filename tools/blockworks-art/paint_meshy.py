"""Blender: render the real deck for ImageGen, then bake its repaint to original UVs.

No geometry is exported or replaced. pack_assets.py embeds the baked albedo in
the original Meshy GLB; its vertex/index/UV buffers remain untouched.
"""
import argparse
import sys
import json
import struct
import math
import statistics
from pathlib import Path
import bpy
from mathutils import Vector,Matrix

ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('mode',choices=['reference','bake']);p.add_argument('--paint');p.add_argument('--asset',default='flagstone-deck-v3');p.add_argument('--source');p.add_argument('--unroll',action='store_true')
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
work=ROOT/'.img2threejs/blockworks-assets'/args.asset;work.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
source=ROOT/args.source if args.source else work/'downloads/model.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
if args.unroll:
 # Temporary authoring projection only: flatten the measured U-shaped Meshy
 # shell by cross-section arc length. The shipped geometry is never exported.
 raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+size]);grid=doc['scenes'][doc.get('scene',0)]['extras']['bwRideSurface'];n=grid['size'];heights=grid['heights']
 vertices=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 minx=min(v.x for v in vertices);maxx=max(v.x for v in vertices);miny=min(v.y for v in vertices);maxy=max(v.y for v in vertices)
 profile=[statistics.median(heights[z*n+x] for z in range(5,n-5)) for x in range(n)]
 arc=[0.]
 for i in range(1,n):arc.append(arc[-1]+math.hypot((maxx-minx)/(n-1),profile[i]-profile[i-1]))
 def sample(nx,nz):
  x=max(0,min(.999999,nx))*(n-1);z=max(0,min(.999999,nz))*(n-1);ix=int(x);iz=int(z);a=x-ix;b=z-iz
  return (heights[iz*n+ix]*(1-a)+heights[iz*n+ix+1]*a)*(1-b)+(heights[(iz+1)*n+ix]*(1-a)+heights[(iz+1)*n+ix+1]*a)*b
 for o in objects:
  positions=[o.matrix_world@v.co for v in o.data.vertices];o.parent=None;o.matrix_world=Matrix.Identity(4)
  for v,w in zip(o.data.vertices,positions):
   nx=(w.x-minx)/(maxx-minx);nz=(maxy-w.y)/(maxy-miny);t=max(0,min(.999999,nx))*(n-1);i=int(t)
   v.co=(arc[i]+(arc[i+1]-arc[i])*(t-i)-arc[-1]/2,w.y,w.z-sample(nx,nz))
  o.data.update()
bpy.context.view_layer.update()
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
if args.unroll:scene.render.resolution_y=round(2048*span.y/span.x/16)*16
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
camera_data=bpy.data.cameras.new('Exact orthographic top');camera=bpy.data.objects.new('Exact orthographic top',camera_data)
scene.collection.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=max(span.x,span.y)
camera.location=(centre.x,centre.y,high.z+3);camera.rotation_euler=(0,0,0)
projection_span=[camera_data.ortho_scale,camera_data.ortho_scale*scene.render.resolution_y/scene.render.resolution_x]
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
    m.inputs['From Min'].default_value=centre[index]-projection_span[index]/2
    m.inputs['From Max'].default_value=centre[index]+projection_span[index]/2
    links.new(separate.outputs[axis],m.inputs['Value']);links.new(m.outputs[0],vector.inputs[axis])
   texture=nodes.new('ShaderNodeTexImage');texture.image=paint;texture.extension='EXTEND';links.new(vector.outputs[0],texture.inputs['Vector'])
   normal=nodes.new('ShaderNodeSeparateXYZ');links.new(geometry.outputs['True Normal'],normal.inputs[0])
   facing=nodes.new('ShaderNodeMapRange');facing.clamp=True;facing.inputs['From Min'].default_value=.2;facing.inputs['From Max'].default_value=.75
   links.new(normal.outputs['Z'],facing.inputs['Value'])
   # Transparent source gaps do not carry paint. Reject antialiased fringe RGB
   # and keep the original Meshy albedo where the generated cutout has no face.
   opaque=nodes.new('ShaderNodeMath');opaque.operation='GREATER_THAN';opaque.inputs[1].default_value=.98;links.new(texture.outputs['Alpha'],opaque.inputs[0])
   coverage=nodes.new('ShaderNodeMath');coverage.operation='MULTIPLY';links.new(facing.outputs[0],coverage.inputs[0]);links.new(opaque.outputs[0],coverage.inputs[1])
   blend=nodes.new('ShaderNodeMixRGB');links.new(coverage.outputs[0],blend.inputs[0]);links.new(colour,blend.inputs[1]);links.new(texture.outputs['Color'],blend.inputs[2]);links.new(blend.outputs[0],emission.inputs['Color'])
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
