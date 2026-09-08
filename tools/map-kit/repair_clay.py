"""Blender: seal the two Meshy clay modules, bake soft vertex colours, make LODs.

The complete source mesh remains local. Voxel union fixes open/overlapping
surfaces, then a measured closed-edge gate runs on both exported detail levels.
No alpha/double-sided material is used to disguise missing geometry.
"""
import bpy
import bmesh
import json
import math
from array import array
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[2]
WORK=ROOT/'.img2threejs/map-kit'
OUT=ROOT/'public/map-kit'
SPECS=[('clay-buttress',(12,18,10)),('clay-terrace',(22,11,12))]

def audit(obj):
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
    unseen=set(bm.verts);components=[]
    while unseen:
        todo=[unseen.pop()];verts=set(todo);edges=set();faces=set()
        while todo:
            vert=todo.pop()
            for edge in vert.link_edges:
                edges.add(edge);faces.update(edge.link_faces);other=edge.other_vert(vert)
                if other in unseen:unseen.remove(other);verts.add(other);todo.append(other)
        components.append({'vertices':len(verts),'faces':len(faces),'euler':len(verts)-len(edges)+len(faces)})
    result={'boundaryEdges':sum(e.is_boundary for e in bm.edges),'nonManifoldEdges':sum(not e.is_manifold for e in bm.edges),'components':components,
      'volume':bm.calc_volume(signed=True),'vertices':len(bm.verts),'faces':len(bm.faces)}
    bm.free();obj.data.calc_loop_triangles();result['triangles']=len(obj.data.loop_triangles)
    return result

def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4

def prune_tiny_pieces(obj):
    bm=bmesh.new();bm.from_mesh(obj.data);unseen=set(bm.verts);components=[]
    while unseen:
        group={unseen.pop()};todo=list(group)
        while todo:
            v=todo.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other in unseen:unseen.remove(other);group.add(other);todo.append(other)
        components.append(group)
    components.sort(key=len,reverse=True)
    remove=[v for group in components[1:] if len(group)<=max(16,len(components[0])*.005) for v in group]
    if remove:bmesh.ops.delete(bm,geom=remove,context='VERTS')
    bm.to_mesh(obj.data);bm.free();obj.data.validate();obj.data.update();return len(remove)

report=[]
for name,size in SPECS:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(WORK/(name+'.glb')))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in bpy.context.scene.objects:o.select_set(o in meshes)
    bpy.context.view_layer.objects.active=meshes[0]
    if len(meshes)>1:bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active;bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    lo=Vector([min(v.co[i] for v in obj.data.vertices) for i in range(3)])
    hi=Vector([max(v.co[i] for v in obj.data.vertices) for i in range(3)])
    desired=Vector((size[0],size[2],size[1]));center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    for v in obj.data.vertices:v.co=Vector([(v.co[i]-center[i])*desired[i]/(hi[i]-lo[i]) for i in range(3)])
    before=audit(obj)
    source=obj.data.copy();source.calc_loop_triangles()
    vertices=[v.co.copy() for v in source.vertices];triangles=[tuple(t.vertices) for t in source.loop_triangles]
    bvh=BVHTree.FromPolygons(vertices,triangles,all_triangles=True)
    uv=source.uv_layers.active
    image=None
    for material in source.materials:
        if material and material.use_nodes:
            principal=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if principal and principal.inputs['Base Color'].is_linked:
                image=getattr(principal.inputs['Base Color'].links[0].from_node,'image',None)
                if image:break
    pixels=array('f',[0])*(len(image.pixels) if image else 0)
    if image:image.pixels.foreach_get(pixels)
    # A tight voxel union closes holes and fuses grass caps without erasing
    # the source's large bevels. It is a repair of each module, not an island.
    remesh=obj.modifiers.new('Closed solid union','REMESH');remesh.mode='VOXEL';remesh.voxel_size=min(desired)/150;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    # Watertight alone is insufficient: a closed tunnel is still a visible
    # hole. Morphological closing removes unintended handles while retaining
    # the source's broad terraces. A plain cliff must be one genus-zero solid.
    closings=[]
    for radius in [.12,.25,.5,.85]:
        topology=audit(obj)
        if len(topology['components'])==1 and topology['components'][0]['euler']==2:break
        for amount in [radius,-radius]:
            disp=obj.modifiers.new('Close unintended tunnels','DISPLACE');disp.direction='NORMAL';disp.strength=amount;disp.mid_level=0
            bpy.ops.object.modifier_apply(modifier=disp.name)
            remesh=obj.modifiers.new('Solid closure','REMESH');remesh.mode='VOXEL';remesh.voxel_size=min(desired)/150;remesh.use_smooth_shade=True
            bpy.ops.object.modifier_apply(modifier=remesh.name)
        closings.append(radius)
    smooth=obj.modifiers.new('Polished clay surface','SMOOTH');smooth.factor=.35;smooth.iterations=2
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    # These are exposed-face modules, not freestanding monuments. Give the
    # hidden rear a clean seating plane instead of retaining invented lumps.
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.00001,
        plane_co=(0,desired.y*.24,0),plane_no=(0,1,0),clear_outer=True,clear_inner=False)
    boundary=[e for e in bm.edges if e.is_boundary]
    if boundary:bmesh.ops.holes_fill(bm,edges=boundary,sides=0)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free();obj.data.update()
    obj.data.calc_loop_triangles()
    dec=obj.modifiers.new('Game triangle budget','DECIMATE');dec.ratio=min(1,6500/len(obj.data.loop_triangles));dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    obj.data.update()
    colours=obj.data.color_attributes.new(name='Clay colour',type='FLOAT_COLOR',domain='POINT')
    for vert in obj.data.vertices:
        nearest,normal,index,distance=bvh.find_nearest(vert.co)
        rgb=(.55,.56,.49)
        if image and uv and index is not None:
            t=source.loop_triangles[index];a,b,c=[vertices[i] for i in t.vertices]
            v0=b-a;v1=c-a;v2=nearest-a;d00=v0.dot(v0);d01=v0.dot(v1);d11=v1.dot(v1);d20=v2.dot(v0);d21=v2.dot(v1);den=d00*d11-d01*d01
            if abs(den)>1e-12:
                v=(d11*d20-d01*d21)/den;w=(d00*d21-d01*d20)/den;u=1-v-w
                coords=uv.data[t.loops[0]].uv*u+uv.data[t.loops[1]].uv*v+uv.data[t.loops[2]].uv*w
                ix=min(image.size[0]-1,max(0,int(coords.x*image.size[0])));iy=min(image.size[1]-1,max(0,int(coords.y*image.size[1])))
                at=(iy*image.size[0]+ix)*4;rgb=tuple(pixels[at+i] for i in range(3))
        y=vert.co.z/desired.z;lum=sum(rgb)/3
        if rgb[1]>rgb[0]*1.03 and rgb[1]>rgb[2]*1.25 and y>.3 and vert.normal.z>.45:
            t=max(0,min(1,y*.6+lum*.3));low=(.24,.40,.22);high=(.49,.62,.31)
        else:
            t=max(0,min(1,.15+y*.42+lum*.3));low=(.34,.41,.39);high=(.69,.71,.64)
        colours.data[vert.index].color=tuple(linear(low[i]+(high[i]-low[i])*t) for i in range(3))+(1,)
    for face in obj.data.polygons:face.use_smooth=True;face.material_index=0
    material=bpy.data.materials.new('Solid clay');material.use_nodes=True
    material.use_backface_culling=True
    bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.67
    attribute=material.node_tree.nodes.new('ShaderNodeVertexColor');attribute.layer_name='Clay colour'
    material.node_tree.links.new(attribute.outputs['Color'],bsdf.inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(material);obj.name=name+'_LOD0'
    obj.data.validate(verbose=True);obj.data.update()
    removed_near=prune_tiny_pieces(obj)
    high=audit(obj)
    low=obj.copy();low.data=obj.data.copy();bpy.context.collection.objects.link(low);low.name=name+'_LOD1'
    bpy.context.view_layer.objects.active=low
    dec=low.modifiers.new('Distant solid silhouette','DECIMATE');dec.ratio=.3;dec.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=dec.name)
    low.data.validate(verbose=True);low.data.update()
    removed_far=prune_tiny_pieces(low)
    far=audit(low)
    for check in [high,far]:
        assert check['boundaryEdges']==0 and check['nonManifoldEdges']==0 and check['volume']>0,check
        assert len(check['components'])==1 and check['components'][0]['euler']==2,check
        assert check['triangles']<15000,check
    for o in bpy.context.scene.objects:o.select_set(o in [obj,low])
    bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,
      export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_all_vertex_colors=True)
    row={'file':name,'size':size,'source':before,'near':high,'far':far,'closingRadii':closings,'discardedTinyVertices':[removed_near,removed_far],'colour':'opaque vertex gradients, sampled from the generated clay palette'}
    report.append(row);print('SEALED',json.dumps(row),flush=True)
(ROOT/'tools/map-kit/clay-geometry-audit.json').write_text(json.dumps(report,indent=2)+'\n')
