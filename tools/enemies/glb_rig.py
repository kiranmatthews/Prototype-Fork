"""Small GLB skin writer for authored enemy rigs.

The input is a baked static mesh in game coordinates. Joint rest transforms are
explicit, Y-up and +Z-forward. This avoids hidden Blender bone-axis corrections
and makes the runtime's semantic segment controls predictable.
"""
from __future__ import annotations

import json
from pathlib import Path
import struct

import numpy as np


class Glb:
    def __init__(self, path: Path):
        raw = path.read_bytes()
        magic, version, length = struct.unpack_from('<III', raw)
        if magic != 0x46546c67 or version != 2 or length != len(raw):
            raise ValueError('Expected a complete GLB 2 file')
        self.document = None
        self.binary = bytearray()
        cursor = 12
        while cursor < length:
            size, kind = struct.unpack_from('<II', raw, cursor)
            chunk = raw[cursor + 8:cursor + 8 + size]
            if kind == 0x4e4f534a:
                self.document = json.loads(chunk)
            elif kind == 0x004e4942:
                self.binary = bytearray(chunk)
            cursor += 8 + size
        if self.document is None:
            raise ValueError('Missing GLB JSON')

    def read_accessor(self, index):
        a = self.document['accessors'][index]
        view = self.document['bufferViews'][a['bufferView']]
        dtype = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2',
                 5125: '<u4', 5126: '<f4'}[a['componentType']]
        columns = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
        offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
        item_size = np.dtype(dtype).itemsize
        return np.ndarray((a['count'], columns), dtype=dtype, buffer=self.binary,
                          offset=offset, strides=(view.get('byteStride', columns * item_size), item_size)).copy()

    def add_accessor(self, values, component_type, type_name, target=None):
        values = np.ascontiguousarray(values)
        while len(self.binary) % 4:
            self.binary.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': values.nbytes}
        if target:
            view['target'] = target
        view_index = len(self.document.setdefault('bufferViews', []))
        self.document['bufferViews'].append(view)
        self.binary.extend(values.tobytes())
        accessor = {'bufferView': view_index, 'componentType': component_type,
                    'count': len(values), 'type': type_name}
        index = len(self.document.setdefault('accessors', []))
        self.document['accessors'].append(accessor)
        return index

    def save(self, path):
        self.document['buffers'] = [{'byteLength': len(self.binary)}]
        encoded = json.dumps(self.document, separators=(',', ':')).encode()
        encoded += b' ' * (-len(encoded) % 4)
        binary = bytes(self.binary) + b'\0' * (-len(self.binary) % 4)
        path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) +
                         struct.pack('<II', len(encoded), 0x4e4f534a) + encoded +
                         struct.pack('<II', len(binary), 0x004e4942) + binary)


def bind_matrix(position, yaw=0):
    c, s = np.cos(yaw), np.sin(yaw)
    return np.array([[c, 0, s, position[0]], [0, 1, 0, position[1]],
                     [-s, 0, c, position[2]], [0, 0, 0, 1]], dtype=np.float64)


def skin_surface(path, joints, weights_for_positions, metadata=None):
    """Add an explicit rig to a single static mesh.

    joints: [{name, position (world), parent (name, optional), yaw (world)}].
    weights_for_positions receives Nx3 game positions, returns NxJ weights.
    Only the strongest four nonzero influences are stored, normalized exactly.
    """
    glb = Glb(path)
    doc = glb.document
    nodes = doc.setdefault('nodes', [])
    mesh_nodes = [i for i, node in enumerate(nodes) if 'mesh' in node]
    for i in mesh_nodes:
        node = nodes[i]
        if ('matrix' in node or node.get('translation', [0, 0, 0]) != [0, 0, 0] or
                node.get('rotation', [0, 0, 0, 1]) != [0, 0, 0, 1] or
                node.get('scale', [1, 1, 1]) != [1, 1, 1]):
            raise ValueError('Skin input mesh transforms must be baked to identity')
    index = {joint['name']: len(nodes) + i for i, joint in enumerate(joints)}
    matrices = {joint['name']: bind_matrix(joint['position'], joint.get('yaw', 0)) for joint in joints}
    for joint in joints:
        parent = joint.get('parent')
        local = np.linalg.inv(matrices[parent]) @ matrices[joint['name']] if parent else matrices[joint['name']]
        yaw = joint.get('yaw', 0) - next((j.get('yaw', 0) for j in joints if j['name'] == parent), 0)
        node = {'name': joint['name'], 'translation': local[:3, 3].tolist()}
        if abs(yaw) > 1e-8:
            node['rotation'] = [0, float(np.sin(yaw / 2)), 0, float(np.cos(yaw / 2))]
        nodes.append(node)
    roots = []
    for joint in joints:
        parent = joint.get('parent')
        if parent:
            nodes[index[parent]].setdefault('children', []).append(index[joint['name']])
        else:
            roots.append(index[joint['name']])
    inverse = np.array([np.linalg.inv(matrices[joint['name']]).T.flatten() for joint in joints], dtype='<f4')
    skin = {'name': 'Authored enemy articulation', 'joints': list(index.values()),
            'inverseBindMatrices': glb.add_accessor(inverse, 5126, 'MAT4')}
    if len(roots) == 1:
        skin['skeleton'] = roots[0]
    skin_index = len(doc.setdefault('skins', []))
    doc['skins'].append(skin)
    for mesh_node in mesh_nodes:
        nodes[mesh_node]['skin'] = skin_index
        for primitive in doc['meshes'][nodes[mesh_node]['mesh']]['primitives']:
            positions = glb.read_accessor(primitive['attributes']['POSITION'])
            weights = np.asarray(weights_for_positions(positions), dtype=float)
            if weights.shape != (len(positions), len(joints)) or not np.isfinite(weights).all() or (weights < 0).any():
                raise ValueError('Invalid authored weights')
            order = np.argsort(-weights, axis=1)[:, :4]
            strongest = np.take_along_axis(weights, order, axis=1)
            total = strongest.sum(axis=1, keepdims=True)
            if (total <= 0).any():
                raise ValueError('Every vertex needs an authored influence')
            strongest /= total
            if strongest.shape[1] < 4:
                width = 4 - strongest.shape[1]
                strongest = np.pad(strongest, ((0, 0), (0, width)))
                order = np.pad(order, ((0, 0), (0, width)))
            primitive['attributes']['JOINTS_0'] = glb.add_accessor(order.astype('<u2'), 5123, 'VEC4', 34962)
            primitive['attributes']['WEIGHTS_0'] = glb.add_accessor(strongest.astype('<f4'), 5126, 'VEC4', 34962)
    scene = doc['scenes'][doc.get('scene', 0)]
    existing_roots = list(scene.get('nodes', []))
    root_index = len(nodes)
    nodes.append({'name': 'enemyRoot', 'children': existing_roots + roots,
                  'extras': {'enemyRig': metadata or {}}})
    scene['nodes'] = [root_index]
    glb.save(path)


def distance_to_segment(points, start, end):
    start, end = np.asarray(start), np.asarray(end)
    line = end - start
    t = np.clip(((points - start) * line).sum(axis=1) / max(float(line @ line), 1e-12), 0, 1)
    return np.linalg.norm(points - start - t[:, None] * line, axis=1)
