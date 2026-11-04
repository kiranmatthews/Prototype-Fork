"""Author the open Wumpa cage from the approved ImageGen/Crash 4 reference.

Blender --background --python tools/build-multihit-cage.py -- asset-directory
The frame is simple authored geometry with its own ImageGen timber atlas.
No distance variants or decimation are used. Fracture clips the
same complete slats, retaining their exterior, UVs and normals.
"""
import bpy
import bmesh
import json
import math
import os
import random
import sys
from mathutils import Vector, Matrix

directory = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
wood = bpy.data.materials.new('Natural chestnut · ImageGen painted timber')
wood.use_nodes = True
wood.use_backface_culling = True
image_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'docs/crate-art-followup/multihit-wood-albedo.png')
texture=wood.node_tree.nodes.new('ShaderNodeTexImage');texture.image=bpy.data.images.load(image_path)
texture.image.pack()
bsdf=wood.node_tree.nodes.get('Principled BSDF')
wood.node_tree.links.new(texture.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value=.82
cut = bpy.data.materials.new('Fresh split timber')
cut.diffuse_color = (.69, .46, .22, 1)
cut.use_nodes = True
cut.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = cut.diffuse_color
cut.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .94

# Broad continuous grain, with an independent swatch on each member's faces.
# The lower eight percent of the ImageGen atlas is reserved for iron nails.
pieces = []
seed = 100

def uv_for(side, u, v, variant):
    x0=.02+((variant+side)%4)*.24
    if variant % 2: v = 1-v
    return (x0+.21*u,.10+.88*v)

def mesh_object(name, vertices, faces, uv, material=wood):
    mesh = bpy.data.meshes.new(name)
    # Author in the game's Y-up coordinates; Blender's exporter converts Z-up.
    mesh.from_pydata([(p[0],-p[2],p[1]) for p in vertices], [], faces)
    mesh.materials.append(material)
    layer = mesh.uv_layers.new(name='Painted timber')
    for polygon, coords in zip(mesh.polygons,uv):
        for index, point in zip(polygon.loop_indices,coords): layer.data[index].uv=point
        polygon.use_smooth = False
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj

def beam(name, width, depth, length, center, rotation=None, bow=(0,0), neck=.03, miter=False):
    global seed
    seed += 1
    rng = random.Random(seed)
    # Broad bevels, a slightly bowed waist and sparse edge nicks; no noisy
    # random displacement on the main faces. Each member remains closed.
    stations = [-.5,-.475,-.39,-.27,-.13,.02,.16,.30,.41,.475,.5]
    section = [(-1,-.70),(-.70,-1),(.70,-1),(1,-.70),
               (1,.70),(.70,1),(-.70,1),(-1,.70)]
    verts, faces, uvs = [], [], []
    nick_ring = rng.choice([2,3,6,8])
    nick_corner = rng.choice([0,2,4,6])
    phase = rng.random()*math.tau
    rot = rotation or Matrix.Identity(3)
    for k,t in enumerate(stations):
        bulge=math.cos(t*math.pi)
        taper=1-neck*bulge
        cap=.88 if k in (0,len(stations)-1) else 1
        for j,(x,z) in enumerate(section):
            chip = .82 if k == nick_ring and j in (nick_corner,(nick_corner+1)%8) else 1
            xx=x*width*.5*taper*cap*chip+bow[0]*bulge
            zz=z*depth*.5*taper*cap*chip+bow[1]*bulge
            yy=t*length
            if miter: yy=t*(length+z*depth)
            # A restrained oblique cut gives each end a hand-hewn silhouette.
            yy += x*width*.028*math.sin(phase)*abs(t)*2
            p=rot@Vector((xx,yy,zz))+Vector(center)
            verts.append(tuple(p))
    for k in range(len(stations)-1):
        v0,v1=k/(len(stations)-1),(k+1)/(len(stations)-1)
        for j in range(8):
            j1=(j+1)%8
            faces.append((k*8+j,k*8+j1,(k+1)*8+j1,(k+1)*8+j))
            # Opposite wide faces have independent patches and matched length.
            side=j//2; a=.12 if j%2==0 else 0; b=.88 if j%2==0 else 1
            uvs.append([uv_for(side,a,v0,seed),uv_for(side,b,v0,seed),uv_for(side,b,v1,seed),uv_for(side,a,v1,seed)])
    faces.extend([tuple(range(7,-1,-1)),tuple((len(stations)-1)*8+i for i in range(8))])
    uvs.extend([[uv_for(0,.5+.45*x,.5+.45*z,seed) for x,z in reversed(section)],
                [uv_for(0,.5+.45*x,.5+.45*z,seed) for x,z in section]])
    obj=mesh_object(name,verts,faces,uvs)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    pieces.append(obj)
    return obj

def nail(name, center, normal):
    normal=Vector(normal); right=normal.cross(Vector((0,1,0))).normalized(); up=right.cross(normal)
    verts=[]; faces=[]
    for radius,height in [(.022,0),(.022,.007),(.015,.018),(.004,.023)]:
        for j in range(8):
            a=j*math.tau/8
            p=Vector(center)+right*(math.cos(a)*radius)+up*(math.sin(a)*radius)+normal*height
            verts.append(tuple(p))
    for ring in range(3):
        for j in range(8): faces.append((ring*8+j,ring*8+(j+1)%8,(ring+1)*8+(j+1)%8,(ring+1)*8+j))
    faces.extend([tuple(range(7,-1,-1)),tuple(24+i for i in range(8))])
    uv=(.5,.035)
    obj=mesh_object(name,verts,faces,[[uv]*len(f) for f in faces])
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj

def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join(); objects[0].name=name
    return objects[0]

# Four double-faced bowed corner posts; paired nails belong to their timber
# fragment and cannot float away independently at the fracture's first frame.
for x in [-1,1]:
    for z in [-1,1]:
        post=beam(f'Corner post {x} {z}',.160,.160,.81,(x*.413,0,z*.413),bow=(-x*.037,-z*.037),neck=.13)
        nails=[]
        for y in [-.315,.315]:
            nails.append(nail('Iron nail', (x*.413,y,z*.482),(0,0,z)))
            nails.append(nail('Iron nail', (x*.482,y,z*.413),(x,0,0)))
        join([post,*nails],post.name)

# Mitered top/bottom rings. Rails meet without square overlapping end blocks.
for level in [-1,1]:
    for face in range(4):
        r=Matrix.Rotation(face*math.pi/2,3,'Y')
        center=r@Vector((0,level*.427,.427))
        beam(f'{"Upper" if level>0 else "Lower"} rail {face}',.146,.146,.854,center,
             r@Matrix.Rotation(-math.pi/2,3,'Z'),bow=(level*.022,.009),neck=.025,miter=True)

# Three narrow vertical bowed members on each side, with honest empty space
# between them and the same finished interior on all four sides.
for face in range(4):
    r=Matrix.Rotation(face*math.pi/2,3,'Y')
    for column in [-1,0,1]:
        beam(f'Slat {face} {column}',.091,.054,.755,r@Vector((column*.210,0,.421)),r,
             bow=(.017*math.sin(face*1.6+column),.016),neck=.08)

# Three recessed planks on each cap, including the underside.
for top in [-1,1]:
    for column in [-1,0,1]:
        beam(f'{"Lid" if top>0 else "Floor"} plank {column}',.239,.058,.755,(column*.237,top*.425,0),
             Matrix.Rotation(math.pi/2,3,'X'),bow=(.003*column,.003),neck=.005)

def export(objects,filename):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(directory,filename),export_format='GLB',use_selection=True,
        export_yup=True,export_animations=False,export_extras=True,export_materials='EXPORT',
        export_texcoords=True,export_normals=True,export_cameras=False,export_lights=False,
        export_image_format='JPEG',export_jpeg_quality=90)

def audit(obj):
    obj.data.calc_loop_triangles()
    bm=bmesh.new();bm.from_mesh(obj.data);bm.normal_update()
    result={'name':obj.name,'triangles':len(obj.data.loop_triangles),
            'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'signedVolume':bm.calc_volume(signed=True)}
    bm.free();return result

for obj in pieces:
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    bm.to_mesh(obj.data);bm.free()
intact_report=[audit(obj) for obj in pieces]
assert all(p['nonManifoldEdges']==0 and p['signedVolume']>0 for p in intact_report)
assert sum(p['triangles'] for p in intact_report)<=7800
export(pieces,'multihit-cage.glb')

fragments=[]
for obj in pieces:
    # Split the narrow slats on oblique planes; preserve every original outer
    # face. The heavy frame and cap boards disassemble as complete members.
    halves=[-1,1] if obj.name.startswith('Slat') else [0]
    cut_height=.04*math.sin(len(fragments))
    for half in halves:
        part=obj.copy();part.data=obj.data.copy();bpy.context.collection.objects.link(part)
        part.name=f'fragment_{len(fragments):02d}'
        if half:
            part.data.materials.append(cut)
            bm=bmesh.new();bm.from_mesh(part.data)
            normal=Vector((.23,.16,1)).normalized()*half
            result=bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                dist=1e-7,plane_co=(0,0,cut_height),plane_no=normal,clear_outer=True)
            edges=[e for e in bm.edges if e.is_boundary]
            caps=bmesh.ops.holes_fill(bm,edges=edges,sides=0)
            for face in caps['faces']:face.material_index=1;face.smooth=False
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(part.data);bm.free()
        fragments.append(part)
report=[audit(obj) for obj in fragments]
assert all(p['nonManifoldEdges']==0 and p['signedVolume']>0 for p in report),report
export(fragments,'multihit-fracture.glb')
manifest={'authoring':'Modeled timber frame following the Crash 4 / ImageGen reference; own ImageGen albedo',
          'sourceReference':'https://www.artstation.com/artwork/9mPL0a',
          'intactTriangles':sum(p['triangles'] for p in intact_report),'intactMembers':len(pieces),
          'pieceCount':len(fragments),'pieces':report,'totalTriangles':sum(p['triangles'] for p in report)}
with open(os.path.join(directory,'multihit-authoring.json'),'w') as f:json.dump(manifest,f,indent=2)
print(json.dumps({k:v for k,v in manifest.items() if k!='pieces'}))
