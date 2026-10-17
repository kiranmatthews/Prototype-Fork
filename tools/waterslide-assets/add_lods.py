"""Append distant meshes locally, keeping the near geometry and embedded maps intact.

Called by pack_assets.py after metre fitting. Blender only exports the reduced
mesh; its texture/material re-export never replaces the original packed data.
"""
from pathlib import Path
import copy
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'enemies'))


def reduce_in_blender(source, output, ratio):
    import bpy
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(source), merge_vertices=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(meshes) != 1:
        raise ValueError('Waterpark LOD input must be one static atlas mesh')
    obj = meshes[0]
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new('Distant silhouette', 'DECIMATE')
    modifier.ratio = ratio
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Collapse can leave duplicate/degenerate faces; repair them before export.
    obj.data.validate()
    obj.data.update()
    if obj.data.validate():
        raise ValueError('Reduced mesh remains invalid after validation')
    # Export geometry only. The final LOD references the existing material/maps.
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
                              use_selection=True, export_materials='NONE',
                              export_animations=False, export_cameras=False,
                              export_lights=False)


def append_lod(path, ratio):
    import numpy as np
    from glb_rig import Glb
    from prepare_meshy_walk import matrices
    path = Path(path)
    original = path.read_bytes()
    g = Glb(path)
    doc = g.document
    if (len(doc['meshes']) != 1 or len(doc['nodes']) != 1 or
            len(doc['meshes'][0]['primitives']) != 1 or doc.get('skins')):
        raise ValueError('Regenerate the packed single-mesh source before adding LODs')
    if not 0 < ratio < 1:
        raise ValueError('LOD ratio must be between zero and one')
    original_binary = bytes(g.binary)
    original_mesh = copy.deepcopy(doc['meshes'][0])
    original_views = copy.deepcopy(doc['bufferViews'])
    original_accessors = copy.deepcopy(doc['accessors'])
    blender = os.environ.get('BLENDER') or shutil.which('blender')
    if not blender and Path('/Applications/Blender.app/Contents/MacOS/Blender').exists():
        blender = '/Applications/Blender.app/Contents/MacOS/Blender'
    if not blender:
        raise RuntimeError('Set BLENDER to an existing local Blender executable')
    with tempfile.TemporaryDirectory(prefix='waterslide-lod-') as directory:
        reduced = Path(directory) / 'reduced.glb'
        subprocess.run([blender, '--background', '--factory-startup', '--python',
                        str(Path(__file__).resolve()), '--', str(path.resolve()),
                        str(reduced), str(ratio)], check=True)
        low = Glb(reduced)
    low_doc = low.document
    world = matrices(low_doc)
    primitives = []
    for node_id, matrix in world.items():
        node = low_doc['nodes'][node_id]
        if 'mesh' not in node:
            continue
        for primitive in low_doc['meshes'][node['mesh']]['primitives']:
            attrs = {}
            for name in ('POSITION', 'NORMAL', 'TEXCOORD_0'):
                values = low.read_accessor(primitive['attributes'][name])
                if name == 'POSITION':
                    values = (np.c_[values, np.ones(len(values))] @ matrix.T)[:, :3]
                elif name == 'NORMAL':
                    values = values @ np.linalg.inv(matrix[:3, :3])
                    values /= np.maximum(np.linalg.norm(values, axis=1, keepdims=True), 1e-10)
                values = values.astype('<f4')
                assert np.isfinite(values).all()
                index = g.add_accessor(values, 5126, 'VEC2' if name == 'TEXCOORD_0' else 'VEC3', 34962)
                attrs[name] = index
                if name == 'POSITION':
                    doc['accessors'][index].update(min=values.min(0).tolist(), max=values.max(0).tolist())
            indices = low.read_accessor(primitive['indices']).astype('<u4')
            assert indices.max() < doc['accessors'][attrs['POSITION']]['count']
            small = indices.max() < 65536
            index = g.add_accessor(indices.astype('<u2' if small else '<u4'), 5123 if small else 5125, 'SCALAR', 34963)
            primitives.append({'attributes': attrs, 'indices': index,
                               'material': original_mesh['primitives'][0].get('material', 0)})
    assert len(primitives) == 1
    near_triangles = doc['accessors'][original_mesh['primitives'][0]['indices']]['count'] // 3
    far_triangles = sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives)
    assert 0 < far_triangles < near_triangles * .55
    doc['nodes'][0]['name'] = path.stem + 'LOD0'
    doc['meshes'].append({'name': path.stem + 'LOD1', 'primitives': primitives})
    doc['nodes'].append({'name': path.stem + 'LOD1', 'mesh': 1})
    doc['scenes'][doc.get('scene', 0)]['nodes'].append(1)
    # Proof that no close-up geometry, UV, normal, material or texture was repacked.
    assert doc['meshes'][0] == original_mesh
    assert doc['bufferViews'][:len(original_views)] == original_views
    assert doc['accessors'][:len(original_accessors)] == original_accessors
    assert bytes(g.binary[:len(original_binary)]) == original_binary
    metadata = {'method': 'Blender collapse; existing runtime distance crossfade',
                'ratio': ratio, 'triangles': far_triangles,
                'nearTriangles': near_triangles,
                'nearGeometryAndMapsUnchanged': True,
                'packedSourceSha256': hashlib.sha256(original).hexdigest(),
                'preservedBinaryBytes': len(original_binary),
                'preservedBinarySha256': hashlib.sha256(original_binary).hexdigest()}
    doc['asset'].setdefault('extras', {})['distanceLod'] = metadata
    g.save(path)
    return metadata


if __name__ == '__main__':
    # The subprocess executes only this branch inside Blender's bundled Python.
    args = sys.argv[sys.argv.index('--') + 1:]
    reduce_in_blender(Path(args[0]), Path(args[1]), float(args[2]))
