"""Fit Meshy floating rocks, replace overlapping top shells with a clean rim,
build LODs and export the exact same vertices for synchronous collision.
Run Blender --background --python tools/nightworks-kit/bake.py -- [names].
"""
import bpy
import bmesh
import json
import math
import os
import sys
import argparse
import numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import convex_hull_2d

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(os.environ.get('JUNGLE_ASSET_WORK', ROOT / '.img2threejs/nightworks-kit'))
OUT = WORK / 'modular-baked'
OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--spec', default='tools/nightworks-kit/module-specs.json')
parser.add_argument('names', nargs='*')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
specs = json.loads((ROOT/args.spec).read_text())
if args.names: specs = [s for s in specs if s['file'] in args.names]
report = []

for spec in specs:
    name = spec['file']
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(WORK/spec.get('sourceFile',name+'.glb')))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.scene.objects: o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mesh = obj.data
    coords = [v.co.copy() for v in mesh.vertices]
    lo = Vector(tuple(min(v[i] for v in coords) for i in range(3)))
    hi = Vector(tuple(max(v[i] for v in coords) for i in range(3)))
    span = hi-lo
    # Blender is Z-up; the exported GLB will return to Y-up.
    size = Vector((1, 1, 1))
    center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    for v in mesh.vertices:
        v.co = Vector(tuple((v.co[i]-center[i])*size[i]/span[i] for i in range(3)))
        if v.co.z < size.z * 0.035: v.co.z = 0

    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.000001)
    bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=0.0000001)
    if spec.get('flatTop'):
        # Cut away generated folded top triangles; fill the actual cliff contour.
        plane=.86
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-6,
            plane_co=Vector((0,0,plane)),plane_no=Vector((0,0,1)),clear_outer=True)
        edges=[e for e in bm.edges if e.is_boundary and all(abs(v.co.z-plane)<1e-5 for v in e.verts)]
        # Generated rock clusters may contain overlapping closed shells. Their
        # individual hole fills overlap too. One convex outer rim removes those
        # internal seams and leaves one continuous, unambiguous landing face.
        rim=list({v for e in edges for v in e.verts})
        rim=[rim[i] for i in convex_hull_2d([v.co.xy for v in rim])]
        top=[bm.verts.new(Vector((v.co.x,v.co.y,plane+.01))) for v in rim]
        caps=[bm.faces.new(top)]
        for i,v in enumerate(rim):
            j=(i+1)%len(rim);caps.append(bm.faces.new([top[i],top[j],rim[j],v]))
        uv=bm.loops.layers.uv.active
        for face in bm.faces:
            for loop in face.loops:
                if face in caps:
                    loop[uv].uv=((loop.vert.co.x+.5)*.49+.505,(-loop.vert.co.y+.5)*.98+.01)
                else: loop[uv].uv.x*=.5
        for v in bm.verts:v.co.z/=(plane+.01)
        bmesh.ops.triangulate(bm,faces=list(caps))
        # Atlas packaging keeps one material/draw: source Meshy sides on the left,
        # original generated top albedo on the right, with flat cap PBR channels.
        for mat in obj.data.materials:
            for node in mat.node_tree.nodes:
                if node.type!='TEX_IMAGE' or not node.image:continue
                original=node.image;w,h=original.size
                source=np.empty(w*h*4,dtype=np.float32);original.pixels.foreach_get(source);source=source.reshape((h,w,4))
                atlas=np.ones((h,w*2,4),dtype=np.float32);atlas[:,:w]=source
                is_color=original.colorspace_settings.name=='sRGB'
                if is_color:
                    top=bpy.data.images.load(str(ROOT/'tools/nightworks-kit/references/top-albedo.png'),check_existing=False)
                    top.scale(w,h);values=np.empty(w*h*4,dtype=np.float32);top.pixels.foreach_get(values);atlas[:,w:]=values.reshape((h,w,4));bpy.data.images.remove(top)
                else:
                    # Normal images are linked to a normal-map node; remaining packed maps are roughness/metal.
                    normal=any(link.to_node.type=='NORMAL_MAP' for link in node.outputs['Color'].links)
                    atlas[:,w:,:3]=(.5,.5,1) if normal else (1,1,0)
                image=bpy.data.images.new(name+'-'+original.name+'-atlas',width=w*2,height=h,alpha=True)
                image.colorspace_settings.name=original.colorspace_settings.name
                image.pixels.foreach_set(atlas.ravel());image.pack();node.image=image
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh);bm.free()
    mesh.update()
    # Smooth the broad bevels while keeping the main planes and large fractures.
    for face in mesh.polygons: face.use_smooth = True
    if hasattr(mesh, 'set_sharp_from_angle'): mesh.set_sharp_from_angle(angle=math.radians(42))
    if hasattr(mesh, 'use_auto_smooth'): mesh.use_auto_smooth = True
    normal = obj.modifiers.new('Face-weighted bevel normals', 'WEIGHTED_NORMAL')
    normal.keep_sharp = True
    normal.weight = 50
    bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.name = name + '_LOD0'
    mesh.calc_loop_triangles()
    collision = {
        'positions': [round(q, 6) for v in mesh.vertices for q in (v.co.x,v.co.z,-v.co.y)],
        'indices': [i for tri in mesh.loop_triangles for i in tri.vertices],
    }
    (OUT/(name+'-collision.json')).write_text(json.dumps(collision,separators=(',',':'))+'\n')
    low = obj.copy()
    low.data = obj.data.copy()
    low.name = name + '_LOD1'
    bpy.context.collection.objects.link(low)
    bpy.context.view_layer.objects.active = low
    decimate = low.modifiers.new('Distant silhouette', 'DECIMATE')
    decimate.ratio = spec['lod']
    decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    for o in bpy.context.scene.objects: o.select_set(o in (obj,low))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')), export_format='GLB',
        use_selection=True, export_yup=True, export_apply=True, export_materials='EXPORT',
        export_animations=False, export_cameras=False, export_lights=False)
    obj.data.calc_loop_triangles(); low.data.calc_loop_triangles()
    row = {'file':name, 'size':spec['size'], 'triangles':len(obj.data.loop_triangles), 'lodTriangles':len(low.data.loop_triangles)}
    report.append(row)
    print('MODULE',json.dumps(row),flush=True)
    for collection in [bpy.data.images,bpy.data.materials,bpy.data.meshes]:
        for block in list(collection):
            if block.users == 0: collection.remove(block)

(OUT/('bake-report-'+('-'.join(args.names) or 'all')+'.json')).write_text(json.dumps(report,indent=2)+'\n')
