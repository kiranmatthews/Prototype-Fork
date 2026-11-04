"""Author closed fracture pieces from the approved crate surface.

Run in Blender, not at runtime. The intact exterior is never decimated or
re-sculpted. Voronoi planes clip the original surface directly. Each open
surface island receives an inward shell and joined cut walls; the original
painted exterior and its UVs remain intact. No cutter geometry is exported.

Blender --background --python tools/build-crate-fracture.py -- source.glb out-dir
"""
import bpy
import bmesh
import json
import os
import random
import sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

args = sys.argv[sys.argv.index('--') + 1:]
source_path, output_dir = args[0], args[1]
metal = len(args) > 2 and args[2] == 'metal'
cap_inset = .018 if metal else .045
os.makedirs(output_dir, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(source_path))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
assert meshes, 'No source mesh'
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
source = bpy.context.object
source.name = 'Sculpted steel crate exterior' if metal else 'Sculpted crate exterior'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
points = [vertex.co.copy() for vertex in source.data.vertices]
minimum = Vector([min(p[i] for p in points) for i in range(3)])
maximum = Vector([max(p[i] for p in points) for i in range(3)])
center, size = (minimum + maximum) * .5, maximum - minimum
for vertex in source.data.vertices:
    vertex.co = Vector([(vertex.co[i] - center[i]) / size[i] for i in range(3)])
source.data.update()
for polygon in source.data.polygons:
    polygon.use_smooth = True

def export_selected(path):
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB',
                              use_selection=True, export_yup=True,
                              export_animations=False, export_extras=True,
                              export_materials='EXPORT', export_texcoords=True,
                              export_normals=True, export_cameras=False,
                              export_lights=False)

source.select_set(True)
if not metal:
    export_selected(os.path.join(output_dir, 'wood-sculpt.glb'))

# Transfer the approved exterior's smooth normals onto each clipped surface.
# This prevents visible shading seams at the first fracture frame.
source.data.calc_loop_triangles()
original_points = [v.co.copy() for v in source.data.vertices]
original_triangles = [tuple(t.vertices) for t in source.data.loop_triangles]
original_normals = [[source.data.corner_normals[i].vector.copy() for i in t.loops]
                    for t in source.data.loop_triangles]
normal_bvh = BVHTree.FromPolygons(original_points, original_triangles, all_triangles=True)

def restore_exterior_normals(mesh):
    mesh.update()
    normals = [loop.normal.copy() for loop in mesh.loops]
    for polygon in mesh.polygons:
        if polygon.material_index == cut_index:
            for loop_index in polygon.loop_indices:
                normals[loop_index] = polygon.normal.copy()
            continue
        polygon.use_smooth = True
        for loop_index in polygon.loop_indices:
            point = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            nearest, _, index, _ = normal_bvh.find_nearest(point)
            tri = original_triangles[index]
            normal = barycentric_transform(nearest, *(original_points[i] for i in tri), *original_normals[index])
            normals[loop_index] = normal.normalized()
    mesh.normals_split_custom_set(normals)

# The GLB can split a geometric vertex at UV/normal seams. Rejoin coincident
# vertices only for fracture authoring; per-loop UVs remain intact. Without
# this, an apparently closed crate is dozens of disconnected triangle islands.
bm = bmesh.new()
bm.from_mesh(source.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.000001)
bm.normal_update()
bm.to_mesh(source.data)
bm.free()

cut_material = bpy.data.materials.new('Fresh split steel' if metal else 'Fresh split timber')
cut_material.use_nodes = True
cut_material.diffuse_color = (.27, .33, .38, 1) if metal else (.69, .46, .22, 1)
bsdf = cut_material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = cut_material.diffuse_color
bsdf.inputs['Roughness'].default_value = .92
source.data.materials.append(cut_material)
cut_index = len(source.data.materials) - 1

def clip_surface(obj, planes):
    """Clip source triangles directly; never Boolean an open generated shell."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for midpoint, normal in planes:
        bmesh.ops.bisect_plane(
            bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
            dist=0.0000001, plane_co=midpoint, plane_no=normal,
            clear_outer=True, clear_inner=False)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context='EDGES')
    branches = [edge for edge in bm.edges if len(edge.link_faces) > 2]
    if branches:
        bmesh.ops.split_edges(bm, edges=branches)
    # Generated surfaces can meet only at a single vertex. Separate those
    # face fans before adding thickness, otherwise four cut walls would
    # share one inward connector edge. Preserve every exterior loop and UV.
    for vertex in list(bm.verts):
        if sum(len(edge.link_faces) == 1 for edge in vertex.link_edges) <= 2:
            continue
        waiting, fans = set(vertex.link_faces), []
        while waiting:
            fan, pending = [], [next(iter(waiting))]
            while pending:
                face = pending.pop()
                if face not in waiting:
                    continue
                waiting.remove(face); fan.append(face)
                for edge in face.edges:
                    if vertex in edge.verts and len(edge.link_faces) == 2:
                        pending.extend(other for other in edge.link_faces if other in waiting)
            fans.append(fan)
        for fan in fans[1:]:
            replacement = bm.verts.new(vertex.co)
            for face in fan:
                loops = list(face.loops)
                new_face = bm.faces.new([replacement if loop.vert == vertex else loop.vert for loop in loops])
                new_face.material_index = face.material_index; new_face.smooth = face.smooth
                for new_loop, old_loop in zip(new_face.loops, loops):
                    for uv in bm.loops.layers.uv.values():
                        new_loop[uv].uv = old_loop[uv].uv
            bmesh.ops.delete(bm, geom=fan, context='FACES_ONLY')
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context='EDGES')
    bm.to_mesh(obj.data)
    bm.free()


def thicken(obj, amount):
    # Preserve the original surface and give open pieces an inward shell.
    # Only newly authored interior vertices are simplified; no approved
    # exterior vertex, face or UV is removed or moved.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.normal_update()
    remaining = set(bm.faces)
    while remaining:
        island, pending = [], [next(iter(remaining))]
        while pending:
            face = pending.pop()
            if face not in remaining:
                continue
            remaining.remove(face)
            island.append(face)
            for edge in face.edges:
                pending.extend(other for other in edge.link_faces if other in remaining)
        boundaries = []
        for face in island:
            for loop in face.loops:
                if len(loop.edge.link_faces) == 1:
                    boundaries.append((loop.vert, loop.link_loop_next.vert))
        if not boundaries:
            continue
        original = {v for face in island for v in face.verts}
        original_edges = {edge for face in island for edge in face.edges}
        duplicate = bmesh.ops.duplicate(bm, geom=list(original) + list(original_edges) + island)
        mapping = duplicate['vert_map']
        inside = mapping if all(v in mapping for v in original) else {value:key for key,value in mapping.items()}
        inside = {v:inside[v] for v in original}
        for vertex, inner in inside.items():
            inner.co = vertex.co - vertex.normal * amount
        inner_faces = [element for element in duplicate['geom'] if isinstance(element, bmesh.types.BMFace)]
        bmesh.ops.reverse_faces(bm, faces=inner_faces)
        for inner in inner_faces:
            inner.material_index = cut_index
            inner.smooth = False
        for start, end in boundaries:
            wall = bm.faces.new((end, start, inside[start], inside[end]))
            wall.material_index = cut_index
            wall.smooth = False
        # Broad fresh-cut timber/steel needs much less detail than the outer
        # paint. Remove alternating new inner boundary vertices, retaining
        # every outer edge and the connecting closed cut wall.
        degrees = {}
        for edge in boundaries:
            for vertex in edge:
                degrees[vertex] = degrees.get(vertex, 0) + 1
        boundary = sorted({inside[v] for v, degree in degrees.items() if degree == 2}, key=lambda v: tuple(v.co))
        chosen = boundary[1::2]
        if chosen:
            bmesh.ops.dissolve_verts(bm, verts=chosen, use_face_split=False, use_boundary_tear=False)
        inner_verts = [v for v in inside.values() if v.is_valid]
        inner_set = set(inner_verts)
        inner_edges = [edge for edge in bm.edges if all(v in inner_set for v in edge.verts)
                       and all(face.material_index == cut_index for face in edge.link_faces)]
        if inner_edges and not metal:
            bmesh.ops.dissolve_limit(bm, angle_limit=.65, use_dissolve_boundaries=False,
                                    verts=inner_verts, edges=inner_edges, delimit=set())
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context='EDGES')
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()


def cap_brace(obj, amount):
    bm = bmesh.new(); bm.from_mesh(obj.data); bm.normal_update()
    boundaries, outgoing = {}, {}
    for edge in bm.edges:
        if len(edge.link_faces) != 1: continue
        face = edge.link_faces[0]
        loop = next(loop for loop in face.loops if loop.edge == edge)
        start, end = loop.vert, loop.link_loop_next.vert
        boundaries[edge] = (start, end, face.normal.copy())
        outgoing.setdefault(start, []).append(edge)
    remaining = set(boundaries)
    while remaining:
        first = next(iter(remaining)); cursor = boundaries[first][0]
        visited, path = {}, []
        while cursor not in visited:
            visited[cursor] = len(path)
            candidates = [edge for edge in outgoing.get(cursor, []) if edge in remaining]
            assert candidates, 'Open brace boundary'
            edge = candidates[0]; path.append(edge); cursor = boundaries[edge][1]
        cycle = path[visited[cursor]:]; remaining.difference_update(cycle)
        center = sum((boundaries[edge][0].co for edge in cycle), Vector()) / len(cycle)
        normal = sum((boundaries[edge][2] for edge in cycle), Vector()).normalized()
        interior = bm.verts.new(center - normal * amount)
        for edge in cycle:
            start, end, _ = boundaries[edge]
            face = bm.faces.new((end, start, interior)); face.material_index = cut_index; face.smooth = False
    bm.to_mesh(obj.data); bm.free()

# Reuse the source rail's complete carved exterior and UVs for each brace.
brace_triangles = 0
if not metal:
    brace = source.copy(); brace.data = source.data.copy()
    bpy.context.collection.objects.link(brace); brace.name = 'Carved diagonal brace'
    clip_surface(brace, [
        (Vector((.35,0,0)),Vector((1,0,0))), (Vector((-.35,0,0)),Vector((-1,0,0))),
        (Vector((0,-.375,0)),Vector((0,1,0))),
        (Vector((0,0,.495)),Vector((0,0,1))), (Vector((0,0,.319)),Vector((0,0,-1))),
    ])
    cap_brace(brace,.025)
    points=[v.co.copy() for v in brace.data.vertices]
    lo=Vector([min(v[i] for v in points) for i in range(3)])
    hi=Vector([max(v[i] for v in points) for i in range(3)])
    middle,span=(lo+hi)*.5,hi-lo
    for vertex in brace.data.vertices:
        p=vertex.co-middle; vertex.co=Vector((p.z/span.z*.112,p.y/span.y*.044,p.x/span.x))
    bm=bmesh.new(); bm.from_mesh(brace.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(brace.data); bm.free()
    brace.data.calc_loop_triangles(); brace_triangles=len(brace.data.loop_triangles)
    bpy.ops.object.select_all(action='DESELECT'); brace.select_set(True); bpy.context.view_layer.objects.active=brace
    export_selected(os.path.join(output_dir,'wood-brace.glb'))
    bpy.data.objects.remove(brace,do_unlink=True)

# Eight chunky corner joins, plus one broad panel fragment on each face.
# Small asymmetry avoids a regular shattering grid while retaining the grain
# direction. These cells partition the entire casing without missing faces.
random.seed(81412)
seeds = []
for x in [-1, 1]:
    for y in [-1, 1]:
        for z in [-1, 1]:
            seeds.append(Vector((x * .405, y * .405, z * .405)))
for axis in range(3):
    for side in [-1, 1]:
        for offset in [0]:
            p = Vector((0, 0, 0))
            p[axis] = side * .40
            p[(axis + 1) % 3] = offset
            p[(axis + 2) % 3] = (random.random() - .5) * .08
            seeds.append(p)

def cell_planes(index):
    return [((position + seeds[index]) * .5, (position - seeds[index]).normalized())
            for other, position in enumerate(seeds) if other != index]

pieces = []
report = []
for index, seed in enumerate(seeds):
    piece = source.copy()
    piece.data = source.data.copy()
    bpy.context.collection.objects.link(piece)
    piece.name = f'fragment_{index:02d}'
    clip_surface(piece, cell_planes(index))
    if len(piece.data.polygons) == 0:
        bpy.data.objects.remove(piece, do_unlink=True)
        continue
    thicken(piece, cap_inset)
    restore_exterior_normals(piece.data)
    # Triangulation is export-only. No simplification or surface decimation.
    piece.data.calc_loop_triangles()
    triangles = len(piece.data.loop_triangles)
    for polygon in piece.data.polygons:
        if polygon.material_index == cut_index:
            polygon.use_smooth = False
    bm = bmesh.new()
    bm.from_mesh(piece.data)
    open_edges = sum(1 for edge in bm.edges if not edge.is_manifold)
    if open_edges:
        print(json.dumps({'openEdgeDetail': piece.name, 'edges': [
            {'faces': len(edge.link_faces), 'materials': [f.material_index for f in edge.link_faces],
             'points': [list(v.co) for v in edge.verts]} for edge in bm.edges if not edge.is_manifold]}))
    volume = bm.calc_volume(signed=True)
    bm.free()
    piece['fracturePiece'] = index
    piece['cutMaterial'] = cut_index
    points = [v.co for v in piece.data.vertices]
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    report.append({'name': piece.name, 'triangles': triangles,
                   'nonManifoldEdges': open_edges, 'signedVolume': volume, 'boundsBlender': [lo, hi]})
    assert min(lo) >= -.56 and max(hi) <= .56, f'Fragment escaped source bounds: {piece.name}'
    pieces.append(piece)

print(json.dumps({'diagnosticPieces': report, 'diagnosticTriangles': sum(p['triangles'] for p in report), 'braceTriangles': brace_triangles}))
assert sum(p['triangles'] for p in report) <= 30000, 'Fracture assembly exceeds the model budget'
assert sum(p['triangles'] for p in report) + brace_triangles * 8 <= 30000, 'Braced fracture assembly exceeds the model budget'
assert all(p['nonManifoldEdges'] == 0 for p in report), 'Fracture contains open seams'
assert all(p['signedVolume'] > 0 for p in report), 'Fracture has an inverted closed shell'
bpy.ops.object.select_all(action='DESELECT')
for piece in pieces:
    piece.select_set(True)
bpy.context.view_layer.objects.active = pieces[0]
export_selected(os.path.join(output_dir, 'metal-fracture.glb' if metal else 'wood-fracture.glb'))
with open(os.path.join(output_dir, 'metal-fracture-authoring.json' if metal else 'fracture-authoring.json'), 'w') as handle:
    json.dump({'source': os.path.basename(source_path), 'capInset': cap_inset,
               'pieceCount': len(pieces), 'pieces': report,
               'totalTriangles': sum(p['triangles'] for p in report)}, handle, indent=2)
print(json.dumps({'pieces': len(pieces), 'triangles': sum(p['triangles'] for p in report)}))
