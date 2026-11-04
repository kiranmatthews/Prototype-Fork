import base64
import json
import struct
import unittest

from pack_assets import GLB, pack, semantic_fingerprint


def fixture(unindexed=False):
    blob, views, accessors = bytearray(), [], []

    def accessor(data, count, kind, component=5126, stride=None, normalized=False):
        while len(blob) % 4:
            blob.append(0)
        view = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)}
        if stride:
            view['byteStride'] = stride
        blob.extend(data)
        views.append(view)
        accessors.append({'bufferView': len(views) - 1, 'componentType': component,
                          'count': count, 'type': kind, 'normalized': normalized})
        return len(accessors) - 1

    position = accessor(b''.join(struct.pack('<3fI', *p, 0x12345678)
                        for p in [(999, 999, 999), (0, 0, 0), (1, 0, 0), (0, 1, 0)]), 4, 'VEC3', stride=16)
    colors = accessor(bytes(range(16)), 4, 'VEC4', 5121, normalized=True)
    joints = accessor(bytes(16), 4, 'VEC4', 5121)
    weights = accessor(struct.pack('<16f', *([1, 0, 0, 0] * 4)), 4, 'VEC4')
    morph = accessor(struct.pack('<12f', *[i / 10 for i in range(12)]), 4, 'VEC3')
    indices = accessor(struct.pack('<6H', 1, 2, 3, 3, 2, 1), 6, 'SCALAR', 5123)
    inverse = accessor(struct.pack('<16f', *[int(i % 5 == 0) for i in range(16)]), 1, 'MAT4')
    times = accessor(struct.pack('<2f', 0, 1), 2, 'SCALAR')
    poses = accessor(struct.pack('<6f', 0, 0, 0, 2, 3, 4), 2, 'VEC3')
    accessor(bytes(1200), 100, 'VEC3')  # Unreachable level buffer data.
    primitive = {'attributes': {'POSITION': position, 'COLOR_0': colors, 'JOINTS_0': joints, 'WEIGHTS_0': weights},
                 'targets': [{'POSITION': morph}], 'material': 0, 'mode': 0 if unindexed else 4}
    if not unindexed:
        primitive['indices'] = indices
    image = b'\x89PNG\r\n\x1a\nexact-original-image-bytes'
    doc = {'asset': {'version': '2.0'}, 'buffers': [{'byteLength': len(blob)}],
           'bufferViews': views, 'accessors': accessors,
           'meshes': [{'primitives': [primitive], 'weights': [.25]}],
           'nodes': [{'mesh': 0, 'skin': 0, 'children': [1]}, {'translation': [0, 1, 0]}],
           'scenes': [{'nodes': [0]}], 'scene': 0,
           'skins': [{'joints': [1], 'inverseBindMatrices': inverse}],
           'animations': [{'samplers': [{'input': times, 'output': poses, 'interpolation': 'LINEAR'}],
                           'channels': [{'sampler': 0, 'target': {'node': 1, 'path': 'translation'}}]}],
           'images': [{'name': 'source', 'uri': 'data:image/png;base64,' + base64.b64encode(image).decode()}],
           'textures': [{'source': 0}], 'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}]}
    raw = json.dumps(doc).encode()
    raw += b' ' * (-len(raw) % 4)
    blob.extend(b'\0' * (-len(blob) % 4))
    return struct.pack('<III', 0x46546c67, 2, 28 + len(raw) + len(blob)) + struct.pack('<II', len(raw), 0x4e4f534a) + raw + struct.pack('<II', len(blob), 0x004e4942) + blob


class PackTests(unittest.TestCase):
    def roundtrip(self, source):
        images = {}

        def sink(data, extension):
            key = 'images/source.' + extension
            images['../' + key] = data
            return key

        packed = pack(source, sink)
        restored = GLB(packed)
        restored.uri = lambda key: images[key]
        return packed, restored

    def test_preserves_draw_streams_skin_morphs_and_animation(self):
        original = fixture()
        source = GLB(original)
        packed, result = self.roundtrip(source)
        self.assertEqual(semantic_fingerprint(source), semantic_fingerprint(result))
        self.assertLess(len(packed), len(original))
        primitive = result.doc['meshes'][0]['primitives'][0]
        positions = result.doc['accessors'][primitive['attributes']['POSITION']]
        self.assertEqual(positions['count'], 3)
        self.assertEqual(positions['min'], [0, 0, 0])
        self.assertEqual(positions['max'], [1, 1, 0])
        self.assertEqual(result.indices(primitive), [0, 1, 2, 2, 1, 0])
        self.assertEqual(result.doc['skins'][0]['joints'], [1])
        self.assertEqual(result.doc['meshes'][0]['weights'], [.25])
        self.assertEqual(packed, self.roundtrip(source)[0])

    def test_unindexed_vertices_are_not_discarded(self):
        source = GLB(fixture(unindexed=True))
        _, result = self.roundtrip(source)
        self.assertEqual(semantic_fingerprint(source), semantic_fingerprint(result))
        primitive = result.doc['meshes'][0]['primitives'][0]
        self.assertNotIn('indices', primitive)
        self.assertEqual(result.doc['accessors'][primitive['attributes']['POSITION']]['count'], 4)

    def test_verifier_detects_changed_animation_and_image(self):
        source = GLB(fixture())
        _, result = self.roundtrip(source)
        baseline = semantic_fingerprint(source)
        result.doc['animations'][0]['samplers'][0]['interpolation'] = 'STEP'
        self.assertNotEqual(semantic_fingerprint(result), baseline)
        _, result = self.roundtrip(source)
        result.uri = lambda _: b'changed-image'
        self.assertNotEqual(semantic_fingerprint(result), baseline)

    def test_sparse_accessors_fail_explicitly(self):
        source = GLB(fixture())
        source.doc['accessors'][0]['sparse'] = {'count': 1}
        with self.assertRaisesRegex(ValueError, 'Sparse'):
            self.roundtrip(source)


if __name__ == '__main__':
    unittest.main()
