"""Merge actual Meshy parts, retain their atlas and create lightweight GLB LODs.

Run Blender --background --python tools/treehouse-trials-assets/prepare.py -- NAME.
No procedural replacement geometry is used. Placement/collision remain level data.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs/carlisle-coast-fidelity'
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
spec=json.loads((ROOT/'tools/carlisle-coast-fidelity-assets/specs.json').read_text())[name]
if name in {'plank','beam'}:
    sx=max(v.co.x for v in high.data.vertices)-min(v.co.x for v in high.data.vertices)
    sy=max(v.co.y for v in high.data.vertices)-min(v.co.y for v in high.data.vertices)
    if sy>sx:
        high.rotation_mode='XYZ'
        high.rotation_euler.z=math.pi/2
        bpy.context.view_layer.update()
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
        high.data.update()
# Contact fitting changes only top-level source surface planes and restores
# normals. Texture/UVs and the irregular source outline remain Meshy's.
coords=[v.co for v in high.data.vertices]
low_z=min(v.z for v in coords);high_z=max(v.z for v in coords);height=high_z-low_z
if name.startswith('riverstone-') and name!='riverstone-a' and 'no-fit' not in sys.argv:
    # A clear flat player contact plane is more useful than ambiguous pebble
    # bumps. The shallow edge bevel and irregular footprint remain untouched.
    high.data.update()
    upper=[v.co.z for v in high.data.vertices if v.normal.z>.7 and v.co.z>low_z+height*.65]
    plane=sorted(upper)[len(upper)//2]
    for v in high.data.vertices:
        # Only actual upward surface vertices move. Flattening the complete
        # bevel band also collapses vertical triangles onto the top, which
        # can create coplanar inward faces and visible self-intersection.
        if v.normal.z>.7 and v.co.z>low_z+height*.65:
            v.co.z=plane
    bm=bmesh.new();bm.from_mesh(high.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=height*.00001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=height*.00001)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(high.data);bm.free()
    # Fitted surfaces need fresh geometric normals instead of the imported
    # smooth loop normals authored for the original curved top.
    high.data.normals_split_custom_set([(0,0,0)]*len(high.data.loops))
    high.data.update()
materials = {slot.material for slot in high.material_slots if slot.material}
assert len(materials) == 1, 'Source needs one shared atlas material'
high.data.calc_loop_triangles()
near_triangles = len(high.data.loop_triangles)
low = high.copy(); low.data = high.data.copy(); low.name = name + '_LOD1'
bpy.context.collection.objects.link(low)
bpy.context.view_layer.objects.active = low
modifier = low.modifiers.new('Distant broad silhouette', 'DECIMATE')
modifier.ratio = min(.32, spec["farTriangles"]/near_triangles)
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
low.data.calc_loop_triangles()
far_triangles = len(low.data.loop_triangles)
# Measure self-occlusion as scalar AO for indirect light only. The temporary
# COLOR_0 export channel is moved into _JUNGLE_AO by the web packer, preventing
# it from tinting direct sunlight or the hand-painted diffuse atlas.
ao_reports=[]
for obj in [high,low]:
    mesh=obj.data
    mesh.update();bvh=BVHTree.FromObject(obj,bpy.context.evaluated_depsgraph_get())
    max_span=max(max(v.co[i] for v in mesh.vertices)-min(v.co[i] for v in mesh.vertices) for i in range(3))
    radius=max_span*.14;offset=max_span*.0018
    layer=mesh.color_attributes.new(name='TRIALS_INDIRECT_AO',type='FLOAT_COLOR',domain='POINT')
    values=[]
    for vertex in mesh.vertices:
        normal=vertex.normal.normalized()
        tangent=normal.cross(Vector((0,0,1)) if abs(normal.z)<.8 else Vector((0,1,0))).normalized()
        bitangent=normal.cross(tangent).normalized()
        hits=0
        for dx,dy in [(0,0),(.55,0),(-.55,0),(0,.55),(0,-.55)]:
            direction=(normal+tangent*dx+bitangent*dy).normalized()
            hit,hit_normal,index,distance=bvh.ray_cast(vertex.co+normal*offset,direction,radius)
            if hit is not None:hits+=1
        value=1-.20*(hits/5)
        values.append(value);layer.data[vertex.index].color=(value,value,value,1)
    mesh.color_attributes.active_color=layer
    ao_reports.append({'mesh':obj.name,'min':min(values),'max':max(values),'mean':sum(values)/len(values),
        'raysPerVertex':5,'radiusRelativeToLargestSpan':.14,'offsetRelativeToLargestSpan':.0018})
source_coords=[v.co.copy() for v in high.data.vertices]
source_lo=Vector(tuple(min(v[i] for v in source_coords) for i in range(3)))
source_hi=Vector(tuple(max(v[i] for v in source_coords) for i in range(3)))
source_span=source_hi-source_lo
source_center=(source_hi+source_lo)/2
for obj in [high,low]:
    obj.location=Vector((-source_center.x/source_span.x,-source_center.y/source_span.y,-source_lo.z/source_span.z))
    obj.scale=Vector((1/source_span.x,1/source_span.y,1/source_span.z))
    for other in bpy.context.scene.objects: other.select_set(other==obj)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for obj in bpy.context.scene.objects: obj.select_set(obj in [high,low])
bpy.ops.export_scene.gltf(filepath=str(WORK / (name + '-lods.glb')),
    export_format='GLB', use_selection=True, export_yup=True,
    export_vertex_color='ACTIVE', export_all_vertex_colors=False,
    export_animations=False, export_cameras=False, export_lights=False)
coords = [high.matrix_world @ v.co for v in high.data.vertices]
lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center = (lo+hi)/2; span = hi-lo
surface_grid=[]
grid_size=41
for row in range(grid_size):
    along=row/(grid_size-1)
    world_y=lo.y+span.y*along
    cells=[]
    for col in range(grid_size):
        across=col/(grid_size-1)
        world_x=lo.x+span.x*across
        hit,point,normal,index=high.ray_cast(Vector((world_x,world_y,hi.z+span.z+1)),Vector((0,0,-1)))
        cells.append({'y':round((point.z-lo.z)/span.z,5),'up':round(normal.z,4)} if hit else None)
    surface_grid.append(cells)
centerline=[]
for row,cells in enumerate(surface_grid):
    supported=[c['y'] for c in cells[16:25] if c and c['up']>.65]
    centerline.append({'alongFromPositiveZ':round(row/(grid_size-1),4),
        'y':round(sorted(supported)[len(supported)//2],5) if supported else None})
contact_report={'gridSize':grid_size,'normalizedXRange':[-.5,.5],
    'normalizedZRows':'+.5 to -.5 (front to rear)','normalizedY':'0 at asset bottom, 1 at highest source geometry',
    'topGrid':surface_grid,'centerline':centerline}
if name.startswith('riverstone-'):
    y=[c['y'] for row in surface_grid[10:31] for c in row[10:31] if c and c['up']>.9]
    contact_report['broadTopPlaneNormalizedY']=round(sorted(y)[len(y)//2],5)
    contact_report['broadTopDeviation']=round(max(y)-min(y),5)
    contact_report['suggestedBoxNormalized']={'center':[0,contact_report['broadTopPlaneNormalizedY']-.04,0],
        'size':[.60,.08,.58]}
(WORK/(name+'-contacts.json')).write_text(json.dumps(contact_report,indent=2)+'\n')
opening=None
if name=='temple-lintel':
    bvh=BVHTree.FromObject(high,bpy.context.evaluated_depsgraph_get())
    def blocked(x,z):
        return bvh.ray_cast(Vector((x,-1.0,z)),Vector((0,1,0)),2.0)[0] is not None
    target_height=8/spec['size'][1]
    xs=[-.5+i/160 for i in range(161)]
    zs=[.01+target_height*i/96 for i in range(97)]
    empty=[x for x in xs if all(not blocked(x,z) for z in zs)]
    center_index=80
    left=right=center_index
    while left>0 and xs[left-1] in empty:left-=1
    while right<160 and xs[right+1] in empty:right+=1
    width=xs[right]-xs[left]
    first_center_hit=next((.01+i*.99/200 for i in range(201) if blocked(0,.01+i*.99/200)),1.0)
    opening={'sampling':'Front-to-rear BVH rays through actual normalized source mesh; 161 columns by97 height probes.',
       'clearCenteredWidthAt8mHeight':round(width*spec['size'][0],3),
       'normalizedClearCenteredWidthAtTargetHeight':round(width,5),
       'centerUnderLintelHeight':round(first_center_hit*spec['size'][1],3),
       'normalizedUnderLintelHeight':round(first_center_hit,5),
       'requiredTargetClearance':[12,8]}
low.hide_render = True
# Inspect the actual measured aspect ratio at the authored default width.
natural_scale=spec['size'][0]/source_span.x
high.scale=Vector((source_span.x*natural_scale,source_span.y*natural_scale,source_span.z*natural_scale))
bpy.context.view_layer.update()
coords=[high.matrix_world@v.co for v in high.data.vertices]
lo=Vector(tuple(min(v[i] for v in coords) for i in range(3)))
hi=Vector(tuple(max(v[i] for v in coords) for i in range(3)))
center=(lo+hi)/2;span=hi-lo
scene = bpy.context.scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24
scene.render.resolution_x = 720; scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.world.color = (.22,.24,.25)
scene.view_settings.view_transform = 'AgX'
# Review with the exact matte web material response rather than Meshy's full
# shiny ORM stack. Strong source normal maps would exaggerate leaf relief.
for material in materials:
    for node in material.node_tree.nodes:
        if node.type=='BSDF_PRINCIPLED':
            for label,value in [('Metallic',0),('Roughness',.91)]:
                socket=node.inputs[label]
                for link in list(socket.links):material.node_tree.links.remove(link)
                socket.default_value=value
        elif node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.18
for label, direction, energy in [('Key',(3,-4,5),130),('Fill',(-4,-1,3),85),('Rim',(2,3,4),110)]:
    bpy.ops.object.light_add(type='AREA', location=center+Vector(direction)*max(span)/4)
    light = bpy.context.object; light.name = label
    light.data.energy = energy*max(span)**2; light.data.shape = 'DISK'; light.data.size = max(span)*1.5
    light.rotation_euler = (center-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); camera = bpy.context.object
camera.data.type = 'ORTHO'; camera.data.ortho_scale = max(span)*1.32
scene.camera = camera
for label, angle in [('front',20),('rear',200),('side',110)]:
    a = math.radians(angle)
    camera.location = center+Vector((math.sin(a)*3,-math.cos(a)*3,1))*max(span)
    camera.rotation_euler = (center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(WORK / (name+'-review-'+label+'.png'))
    bpy.ops.render.render(write_still=True)
(WORK / (name+'-geometry.json')).write_text(json.dumps({
    'triangles': near_triangles, 'lodTriangles': far_triangles,
    'sourceSpanGltf': [source_span.x,source_span.z,source_span.y], 'sourceBoundsBlender': [list(source_lo),list(source_hi)], 'normalizedBoundsGltf':[[-.5,0,-.5],[.5,1,.5]],
    'sourceMeshCount': len(parts), 'materials': len(materials),
    'uniformScaleSizeAtDefaultWidth':[spec['size'][0],round(spec['size'][0]*source_span.z/source_span.x,3),round(spec['size'][0]*source_span.y/source_span.x,3)],
    'contactCenterline':centerline,
    'broadTopPlaneNormalizedY':contact_report.get('broadTopPlaneNormalizedY'),
    'suggestedBoxNormalized':contact_report.get('suggestedBoxNormalized'),
    'placement': 'Physically normalized X/Z[-.5,.5],Y[0,1]; front+Z; no collision.', 'openingMeasured':opening,
    'indirectAO':ao_reports,
    'contactFit':'Original riverstone A surface retained; attempted flat fit was visually rejected for creating coplanar triangles. Natural top deviation is measured.' if name=='riverstone-a' else 'Broad riverstone upper vertices fitted to one contact plane; other original source surfaces retained.' if name.startswith('riverstone-') else 'Original source surface retained.',
},indent=2)+'\n')
