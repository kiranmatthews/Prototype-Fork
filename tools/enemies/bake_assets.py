"""Inspect and prepare Meshy enemy surfaces for the game.

Run with Blender, e.g.:
  Blender --background --python tools/enemies/bake_assets.py -- inspect grunt

Authoring inputs live in ignored .img2threejs/enemies. Public exports contain
only locally baked surfaces and semantic animation parts; no API credentials
or expiring provider URLs are written by this tool.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_rig import distance_to_segment, skin_surface
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.img2threejs' / 'enemies'
OUT = ROOT / 'public' / 'enemies'


def reset_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.armatures):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def load_surface(path: Path):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and
              not obj.hide_render and any(not collection.hide_render for collection in obj.users_collection)]
    if not meshes:
        raise RuntimeError(f'No meshes in {path}')
    return meshes


def bounds(meshes):
    points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    return (Vector(tuple(min(p[i] for p in points) for i in range(3))),
            Vector(tuple(max(p[i] for p in points) for i in range(3))))


def geometric_islands(obj):
    """Join duplicate UV-seam positions only for semantic connectivity queries."""
    parent = list(range(len(obj.data.vertices)))
    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index
    def union(a, b):
        parent[find(a)] = find(b)
    positions = {}
    for vertex in obj.data.vertices:
        key = tuple(round(value, 6) for value in vertex.co)
        if key in positions:
            union(vertex.index, positions[key])
        else:
            positions[key] = vertex.index
    for edge in obj.data.edges:
        union(*edge.vertices)
    members = {}
    for vertex in obj.data.vertices:
        members.setdefault(find(vertex.index), []).append(vertex.index)
    groups = sorted(members.values(), key=lambda group: (-len(group), min(group)))
    labels = {}
    reports = []
    for index, group in enumerate(groups):
        points = [obj.matrix_world @ obj.data.vertices[i].co for i in group]
        points = [Vector((point.x, point.z, -point.y)) for point in points]
        low = [min(p[i] for p in points) for i in range(3)]
        high = [max(p[i] for p in points) for i in range(3)]
        reports.append({'id': index, 'vertices': len(group), 'min': low, 'max': high,
                        'center': [(low[i]+high[i])*.5 for i in range(3)]})
        for vertex in group:
            labels[vertex] = index
    return labels, reports


def mesh_report(meshes):
    lo, hi = bounds(meshes)
    objects = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        # Surface islands help identify genuine mechanical seams before any
        # reviewed split is authored. Large counts are summarized, not printed.
        adjacency = [[] for _ in obj.data.vertices]
        for edge in obj.data.edges:
            a, b = edge.vertices
            adjacency[a].append(b)
            adjacency[b].append(a)
        unseen = set(range(len(adjacency)))
        islands = []
        while unseen:
            pending = [unseen.pop()]
            members = []
            while pending:
                vertex = pending.pop()
                members.append(vertex)
                for neighbor in adjacency[vertex]:
                    if neighbor in unseen:
                        unseen.remove(neighbor)
                        pending.append(neighbor)
            points = [obj.matrix_world @ obj.data.vertices[v].co for v in members]
            islands.append({'vertices': len(members), 'boundsBlender':
                [[min(p[i] for p in points) for i in range(3)],
                 [max(p[i] for p in points) for i in range(3)]]})
        islands.sort(key=lambda value: -value['vertices'])
        objects.append({'name': obj.name, 'vertices': len(obj.data.vertices),
                        'triangles': len(obj.data.loop_triangles),
                        'materials': [mat.name for mat in obj.data.materials if mat],
                        'islandCount': len(islands), 'largestIslands': islands[:30],
                        'geometricIslands': geometric_islands(obj)[1]})
    return {'boundsBlender': [list(lo), list(hi)],
            'sizeGameXYZ': [hi.x - lo.x, hi.z - lo.z, hi.y - lo.y],
            'meshes': objects,
            'images': [{'name': image.name, 'size': list(image.size)}
                       for image in bpy.data.images if image.users and image.type == 'IMAGE'],
            'armatures': [{'name': obj.name, 'bones': [bone.name for bone in obj.data.bones]}
                          for obj in bpy.context.scene.objects if obj.type == 'ARMATURE']}


def aim(obj, position):
    obj.rotation_euler = (Vector(position) - obj.location).to_track_quat('-Z', 'Y').to_euler()


def studio(meshes, size=768):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world.color = (0.35, 0.35, 0.35)
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'Medium High Contrast' if 'Medium High Contrast' in [i.name for i in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    lo, hi = bounds(meshes)
    center = (lo + hi) * 0.5
    extent = max(hi - lo)
    for label, offset, energy, area in (
            ('key', (2.5, -3, 4), 500, 3),
            ('fill', (-3, -1, 2), 300, 4),
            ('rim', (1, 3, 3), 400, 3)):
        data = bpy.data.lights.new(label, 'AREA')
        data.energy = energy * extent * extent
        data.shape = 'DISK'
        data.size = area * extent
        obj = bpy.data.objects.new(label, data)
        scene.collection.objects.link(obj)
        obj.location = center + Vector(offset) * extent
        aim(obj, center)
    data = bpy.data.cameras.new('Review camera')
    camera = bpy.data.objects.new('Review camera', data)
    scene.collection.objects.link(camera)
    data.type = 'ORTHO'
    data.ortho_scale = extent * 1.28
    scene.camera = camera
    return camera, center, extent


def render_views(meshes, folder: Path, size=768):
    folder.mkdir(parents=True, exist_ok=True)
    camera, center, extent = studio(meshes, size)
    points = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    for label, direction in (
            ('front', (0, -3, 0.2)), ('quarter', (2.6, -3.7, 1.7)),
            ('side', (3, 0, 0.2)), ('back', (0, 3, 0.2)),
            ('top', (0, 0, 3))):
        camera.location = center + Vector(direction) * extent
        aim(camera, center)
        rotation = camera.rotation_euler.to_quaternion()
        projected = [rotation.inverted() @ (point-center) for point in points]
        low = Vector((min(p.x for p in projected), min(p.y for p in projected), 0))
        high = Vector((max(p.x for p in projected), max(p.y for p in projected), 0))
        camera.location += rotation @ ((low+high)*.5)
        camera.data.ortho_scale = max(high.x-low.x, high.y-low.y)*1.16
        bpy.context.scene.render.filepath = str(folder / (label + '.png'))
        bpy.ops.render.render(write_still=True)


def normalized_surface(meshes, spec):
    """Apply a reviewed orientation and a uniform fit without changing silhouette."""
    if any(obj.find_armature() for obj in meshes):
        raise ValueError('This custom-rig bake expects the unrigged source surface')
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # Blender Z maps to game Y; Blender -Y maps to game +Z.
    rotation = Matrix.Rotation(math.radians(spec.get('yawDegrees', 0)), 4, 'Z')
    world = obj.matrix_world.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(rotation @ world)
    retained_normals = None
    if spec.get('removeSourceIslands') or spec.get('sourceAdjustments'):
        normals = [normal.vector.copy() for normal in obj.data.corner_normals]
        retained_normals = obj.data.attributes.new('authoring_source_normal', 'FLOAT_VECTOR', 'CORNER')
        for index, normal in enumerate(normals):
            retained_normals.data[index].vector = normal
    if spec.get('removeSourceIslands'):
        vertex_islands, _ = geometric_islands(obj)
        faces = [face.index for face in obj.data.polygons if
                 vertex_islands[face.vertices[0]] in spec['removeSourceIslands']]
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in faces], context='FACES')
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    for adjustment in spec.get('sourceAdjustments', []):
        if adjustment['type'] != 'compressBeyondPlane':
            raise ValueError('Unknown reviewed surface adjustment')
        axis = {'x': 0, 'y': 2, 'z': 1}[adjustment['axis']]
        sign = -1 if adjustment['axis'] == 'z' else 1
        pivot = adjustment['pivot']
        adjusted = set()
        for vertex in obj.data.vertices:
            value = vertex.co[axis]*sign
            if (value-pivot)*adjustment.get('side', -1) > 0:
                vertex.co[axis] = (pivot+(value-pivot)*adjustment['scale'])*sign
                adjusted.add(vertex.index)
        if retained_normals:
            retained_normals = obj.data.attributes['authoring_source_normal']
            for loop in obj.data.loops:
                if loop.vertex_index in adjusted:
                    normal = retained_normals.data[loop.index].vector.copy()
                    normal[axis] /= adjustment['scale']
                    retained_normals.data[loop.index].vector = normal.normalized()
    fit_points = [vertex.co for vertex in obj.data.vertices if not any(
        select_part((vertex.co.x, vertex.co.z, -vertex.co.y), selection)
        for selection in spec.get('fitExclude', []))]
    if not fit_points:
        raise ValueError('Reviewed fit exclusions removed every source vertex')
    lo = Vector(tuple(min(point[i] for point in fit_points) for i in range(3)))
    hi = Vector(tuple(max(point[i] for point in fit_points) for i in range(3)))
    target = spec['maxSize']
    factor = min(target[0] / (hi.x-lo.x), target[1] / (hi.z-lo.z), target[2] / (hi.y-lo.y))
    center = Vector(((lo.x+hi.x)/2, (lo.y+hi.y)/2, lo.z))
    if spec.get('maxRadiusXZ') is not None:
        radius = max(math.hypot(v.co.x-center.x, v.co.y-center.y) for v in obj.data.vertices)
        factor = min(factor, spec['maxRadiusXZ']/radius)
    if spec.get('centerY') is not None:
        center.z = (lo.z+hi.z)/2 - spec['centerY']/factor
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co-center)*factor
    if retained_normals:
        retained_normals = obj.data.attributes['authoring_source_normal']
        obj.data.normals_split_custom_set([value.vector[:] for value in retained_normals.data])
        obj.data.attributes.remove(retained_normals)
    obj.name = 'enemySurface'
    return obj


def compact_textures(limit):
    for image in bpy.data.images:
        if not image.users or image.type != 'IMAGE':
            continue
        width, height = image.size
        if max(width, height) > limit:
            scale = limit / max(width, height)
            image.scale(max(1, round(width*scale)), max(1, round(height*scale)))
        image.pack()


def add_socket_linings(obj, spec):
    """Close reviewed generated socket cavities behind the original surface."""
    obj.data.update()
    labels, _ = geometric_islands(obj)
    point_map = {tuple(round(float(v), 6) for v in (vertex.co.x, vertex.co.z, -vertex.co.y)):
                 labels[vertex.index] for vertex in obj.data.vertices}
    originals = [obj]
    color_image = next(node.image for material in obj.data.materials for node in material.node_tree.nodes
                       if node.type == 'TEX_IMAGE' and node.image and node.image.colorspace_settings.name == 'sRGB')
    for patch in spec['socketLinings']:
        point = Vector((patch['samplePoint'][0], -patch['samplePoint'][2], patch['samplePoint'][1]))
        face = min(obj.data.polygons, key=lambda face: (face.center-point).length_squared)
        uv = sum((obj.data.uv_layers.active.data[i].uv for i in face.loop_indices), Vector((0, 0)))/len(face.loop_indices)
        material = bpy.data.materials.new(patch['name']+'Material')
        material.use_nodes = True
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = .88
        texture = material.node_tree.nodes.new('ShaderNodeTexImage')
        texture.image = color_image
        material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1)
        liner = bpy.context.object
        liner.name = patch['name']
        liner.data.materials.append(material)
        x, y, z = patch['center']
        rx, ry, rz = patch['radii']
        for vertex in liner.data.vertices:
            vertex.co = Vector((x+vertex.co.x*rx, -z+vertex.co.y*rz, y+vertex.co.z*ry))
            key = tuple(round(float(v), 6) for v in (vertex.co.x, vertex.co.z, -vertex.co.y))
            point_map[key] = patch['islandId']
        for polygon in liner.data.polygons:
            polygon.use_smooth = True
        for loop in liner.data.uv_layers.active.data:
            loop.uv = uv
        originals.append(liner)
    for node in bpy.context.scene.objects:
        node.select_set(node in originals)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    return point_map


def weights_from_spec(joints, point_islands=None):
    """Capsule fields with explicitly authored anatomical windows.

    No automatic rig placement is attempted. Field endpoints/windows are stored
    with the reviewed model's bake spec in game-space metres.
    """
    def smooth(value):
        value = np.clip(value, 0, 1)
        return value * value * (3 - 2 * value)

    def weights(points):
        result = np.zeros((len(points), len(joints)), dtype=float)
        islands = None
        if point_islands is not None:
            islands = np.array([point_islands[tuple(round(float(v), 6) for v in point)] for point in points])
        for index, joint in enumerate(joints):
            for field in joint.get('fields', []):
                distance = distance_to_segment(points, field.get('start', joint['position']),
                                               field.get('end', joint['position']))
                values = field.get('strength', 1) / (1 + (distance/field['radius'])**4)
                if 'islands' in field:
                    if islands is None:
                        raise ValueError('Island-weighted fields require source connectivity')
                    values *= np.isin(islands, field['islands'])
                for axis, window in field.get('windows', {}).items():
                    coordinate = points[:, {'x': 0, 'y': 1, 'z': 2}[axis]]
                    low, high = window[:2]
                    fade = window[2] if len(window) > 2 else .04
                    values *= smooth((coordinate-low)/fade) * smooth((high-coordinate)/fade)
                for plane in field.get('planes', []):
                    coordinate = points @ np.asarray(plane['normal'], dtype=float)
                    low, high = plane['range']
                    fade = plane.get('fade', .1)
                    values *= smooth((coordinate-low)/fade) * smooth((high-coordinate)/fade)
                if joint.get('combineFields') == 'max':
                    result[:, index] = np.maximum(result[:, index], values)
                else:
                    result[:, index] += values
        source_values = result.copy()
        names = {joint['name']: index for index, joint in enumerate(joints)}
        for index, joint in enumerate(joints):
            if joint.get('complementOf'):
                deduction = sum((source_values[:, names[name]] for name in joint['complementOf']),
                                np.zeros(len(points)))
                result[:, index] = np.maximum(0, source_values[:, index]-deduction)
        missing = result.sum(axis=1) <= 1e-12
        if missing.any():
            values = points[missing]
            raise ValueError(f'{missing.sum()} vertices outside authored weight fields; '
                f'bounds={values.min(axis=0).tolist()}..{values.max(axis=0).tolist()}, '
                f'first={values[:6].tolist()}')
        return result
    return weights


def select_part(point, selection, island=None):
    """Evaluate one reviewed selection in normalized game coordinates."""
    x, y, z = point
    if 'islands' in selection and (not island or island['id'] not in selection['islands']):
        return False
    for measure, axes in selection.get('islandBounds', {}).items():
        if island is None:
            return False
        for axis, interval in axes.items():
            value = island[measure][{'x': 0, 'y': 1, 'z': 2}[axis]]
            if not interval[0] <= value <= interval[1]:
                return False
    if 'islandRadiusXZ' in selection:
        if island is None:
            return False
        radius = math.hypot(island['center'][0], island['center'][2])
        if not selection['islandRadiusXZ'][0] <= radius <= selection['islandRadiusXZ'][1]:
            return False
    for axis, interval in selection.get('bounds', {}).items():
        value = {'x': x, 'y': y, 'z': z}[axis]
        if value < interval[0] or value > interval[1]:
            return False
    if 'radiusXZ' in selection:
        origin = selection.get('center', [0, 0, 0])
        radius = math.hypot(x-origin[0], z-origin[2])
        if not selection['radiusXZ'][0] <= radius <= selection['radiusXZ'][1]:
            return False
    if 'angleXZ' in selection:
        angle = math.degrees(math.atan2(-z, x)) % 360
        low, high = [a % 360 for a in selection['angleXZ']]
        if not ((low <= angle <= high) if low <= high else (angle >= low or angle <= high)):
            return False
    return True


def rigid_parts(obj, spec):
    """Split at explicitly reviewed mechanical seams, retaining original UVs."""
    parts = spec['parts']
    names = {part['name'] for part in parts}
    if len(names) != len(parts):
        raise ValueError('Mechanical part names must be unique')
    cuts = spec.get('cuts', [])
    if cuts:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        # glTF UV seams duplicate position vertices. BMesh loop UVs keep those
        # seams while welding the geometric boundary needed for closed caps.
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
        for cut in cuts:
            n = cut['normal']
            normal = Vector((n[0], -n[2], n[1]))
            point = normal * (cut['offset']/normal.length_squared)
            bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                dist=1e-7, plane_co=point, plane_no=normal)
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    labels = []
    vertex_islands, island_reports = geometric_islands(obj)
    for face in obj.data.polygons:
        center = sum((obj.data.vertices[i].co for i in face.vertices), Vector()) / len(face.vertices)
        game = (center.x, center.z, -center.y)
        island = island_reports[vertex_islands[face.vertices[0]]]
        match = next((part['name'] for part in parts if
                      any(select_part(game, selection, island) for selection in part.get('select', []))), None)
        labels.append(match or spec['defaultPart'])
    if any(name not in names for name in labels):
        raise ValueError('defaultPart must name an authored mechanical part')
    root = bpy.data.objects.new('enemyRoot', None)
    bpy.context.scene.collection.objects.link(root)
    root['enemyRig'] = spec.get('enemyRig', {})
    pivots = {}
    for part in parts:
        pivot = bpy.data.objects.new(part['name'], None)
        bpy.context.scene.collection.objects.link(pivot)
        p = part.get('position', [0, 0, 0])
        pivot.matrix_world = Matrix.Translation(Vector((p[0], -p[2], p[1]))) @ Matrix.Rotation(part.get('yaw', 0), 4, 'Z')
        pivots[part['name']] = pivot
    meshes = []
    for part in parts:
        name = part['name']
        pivot = pivots[name]
        world = pivot.matrix_world.copy()
        pivot.parent = pivots[part['parent']] if part.get('parent') else root
        pivot.matrix_world = world
        if name not in labels:
            continue
        mesh = obj.data.copy()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bm.faces.ensure_lookup_table()
        discard = [face for face in bm.faces if labels[face.index] != name]
        bmesh.ops.delete(bm, geom=discard, context='FACES')
        if cuts:
            cap_material = bpy.data.materials.new(name + 'Seam')
            cap_material.diffuse_color = tuple(part.get('seamColor', [.1, .06, .04])) + (1,)
            cap_material.use_nodes = True
            shader = cap_material.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Base Color'].default_value = cap_material.diffuse_color
            shader.inputs['Roughness'].default_value = .78
            mesh.materials.append(cap_material)
            for cut in cuts:
                n = cut['normal']
                normal = Vector((n[0], -n[2], n[1]))
                edges = [edge for edge in bm.edges if edge.is_boundary and
                         all(abs(normal.dot(vertex.co)-cut['offset']) < 2e-6 for vertex in edge.verts)]
                if edges:
                    filled = bmesh.ops.holes_fill(bm, edges=edges, sides=0)
                    for face in filled['faces']:
                        face.material_index = len(mesh.materials)-1
                    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(mesh)
        bm.free()
        mesh.transform(world.inverted())
        mesh.update()
        part_obj = bpy.data.objects.new(name + 'Surface', mesh)
        bpy.context.scene.collection.objects.link(part_obj)
        part_obj.parent = pivot
        part_obj.matrix_basis = Matrix.Identity(4)
        if part.get('ownMaterial'):
            for index, material in enumerate(mesh.materials):
                if material:
                    copied = material.copy()
                    copied.name = name + 'Material'
                    mesh.materials[index] = copied
        meshes.append(part_obj)
    bpy.data.objects.remove(obj, do_unlink=True)
    return root, meshes


def bake(meshes, kind, spec, render=True):
    if not spec.get('reviewedSource'):
        raise ValueError('Bake spec must record reviewedSource evidence before publication')
    obj = normalized_surface(meshes, spec)
    compact_textures(spec.get('textureSize', 1024))
    authored_point_islands = add_socket_linings(obj, spec) if spec.get('socketLinings') else None
    if spec.get('parts'):
        root, meshes = rigid_parts(obj, spec)
        export_objects = [root, *root.children_recursive]
    else:
        meshes = [obj]
        export_objects = [obj]
    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / (kind + '.glb')
    staged = WORK / 'baking' / (kind + '.glb')
    staged.parent.mkdir(parents=True, exist_ok=True)
    for item in bpy.context.scene.objects:
        item.select_set(item in export_objects)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.export_scene.gltf(filepath=str(staged), export_format='GLB', use_selection=True,
        export_yup=True, export_apply=True, export_materials='EXPORT', export_animations=False,
        export_cameras=False, export_lights=False, export_image_format='JPEG',
        export_jpeg_quality=spec.get('textureQuality', 86), export_extras=True)
    if spec.get('joints'):
        vertex_islands, _ = geometric_islands(obj)
        point_islands = {tuple(round(float(v), 6) for v in (vertex.co.x, vertex.co.z, -vertex.co.y)):
                        vertex_islands[vertex.index] for vertex in obj.data.vertices}
        if authored_point_islands is not None:
            point_islands = authored_point_islands
        skin_surface(staged, spec['joints'], weights_from_spec(spec['joints'], point_islands), spec.get('enemyRig'))
    report = mesh_report(meshes)
    report.update({'kind': kind, 'output': str(output.relative_to(ROOT)), 'bytes': staged.stat().st_size,
                   'reviewedSource': spec['reviewedSource'], 'rigJoints': len(spec.get('joints', []))})
    folder = WORK / 'review' / (kind + '-baked')
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'bake-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('ENEMY_BAKED', json.dumps({key: report[key] for key in
          ('kind', 'output', 'bytes', 'sizeGameXYZ', 'rigJoints')}), flush=True)
    if render:
        render_views(load_surface(staged), folder)
    staged.replace(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['inspect', 'bake'])
    parser.add_argument('kind')
    parser.add_argument('--source', type=Path)
    parser.add_argument('--size', type=int, default=768)
    parser.add_argument('--spec', type=Path)
    parser.add_argument('--no-render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    source = args.source or WORK / (args.kind + '.glb')
    spec = json.loads(args.spec.read_text()) if args.spec else None
    if spec and spec.get('sourceSha256') and hashlib.sha256(source.read_bytes()).hexdigest() != spec['sourceSha256']:
        raise ValueError('Source differs from the reviewed model used to author this rig')
    meshes = load_surface(source)
    if args.command == 'bake':
        if args.spec is None:
            parser.error('bake requires --spec with reviewed model-specific authoring data')
        output = bake(meshes, args.kind, spec, not args.no_render)
        spec['outputSha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
        spec['outputBytes'] = output.stat().st_size
        args.spec.write_text(json.dumps(spec, indent=2) + '\n')
        return
    if args.spec:
        meshes = [normalized_surface(meshes, spec)]
    report = mesh_report(meshes)
    folder = WORK / 'review' / args.kind
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'source-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print('ENEMY_SOURCE', json.dumps({'sizeGameXYZ': report['sizeGameXYZ'],
          'meshes': [{'name': m['name'], 'triangles': m['triangles'],
                      'geometricIslands': len(m['geometricIslands'])} for m in report['meshes']]}), flush=True)
    render_views(meshes, folder, args.size)


if __name__ == '__main__':
    main()
