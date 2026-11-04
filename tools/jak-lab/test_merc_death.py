import gzip
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from merc_death import LinkedAssembly, animation_events, match_model
from pack_assets import GLB, supplemental_assets
from test_pack_assets import fixture


class MercDeathTests(unittest.TestCase):
    def test_artist_frames_and_named_effect_offsets(self):
        def word(value):
            return '    .word 0x%08x\n' % struct.unpack('<I', struct.pack('<f', value))[0]

        for speed, seconds in [(0.25, 0.2), (0, 0.1)]:
            text = ('    .type art-joint-anim\nL1:\n    .word 0x0\n    .word L2\n    .word 0x0\n'
                    '    .word L3\n' + word(speed) + word(1) + word(2) +
                    'L2:\n    .word 0x4\n    .word 0x74736574\n'
                    '    .type res-lump\nL3:\n    .word 0x2\n    .word 0x0\n    .word L4\n'
                    '    .word 0x0\n    .word 0x0\n    .word 0x0\n    .word L5\n'
                    'L4:\n    .symbol ignored\n    .symbol death-default\nL5:\n'
                    '    .symbol effect-name\n' + word(7) + '    .word 0x0\n    .word 0x4\n'
                    '    .symbol unrelated-tag\n' + word(9) + '    .word 0x0\n    .word 0x0\n')
            assembly = LinkedAssembly(text)
            events = animation_events(assembly)
            self.assertEqual(events, [{'clip': 'test', 'effect': 'death-default', 'artistFrame': 7,
                                       'seconds': seconds, 'assemblyLine': assembly.lines[assembly.labels['L4'] + 4]}])
            with self.assertRaisesRegex(ValueError, 'non-symbol effect marker'):
                animation_events(LinkedAssembly(text.replace('    .symbol death-default', '    .word 0x0')))

    def test_linked_labels_and_symbols_are_distinct(self):
        assembly = LinkedAssembly('    .type test\nL1:\n    .word L2\n    .symbol hello\nL2:\n    .word 0x12345678\n')
        self.assertEqual(assembly.pointer(4), 12)
        self.assertEqual(assembly.read('I', 12), 0x12345678)
        self.assertEqual(assembly.symbols[8], 'hello')
        self.assertEqual(assembly.types, [('test', 4)])
        with self.assertRaises(ValueError):
            assembly.pointer(8)
        with self.assertRaises(ValueError):
            LinkedAssembly('    .word missing-label\n')
        with self.assertRaises(ValueError):
            LinkedAssembly('    .space 10\n')

    def test_complete_input_domain_retains_unreferenced_vertices(self):
        glb = GLB(fixture())
        glb.doc['meshes'][0]['name'] = 'fixture'
        decoded = {'name': 'fixture', 'positions': [999,999,999,0,0,0,1,0,0,0,1,0], 'effects': [], 'crossCopies': 0}
        matched = match_model(decoded, glb)
        self.assertEqual(matched['sourceVertexStart'], 0)
        self.assertEqual(matched['sourceVertices'], 4)
        self.assertEqual(matched['unreferencedVertices'], 1)
        self.assertEqual(len(matched['joints']), 16)
        self.assertEqual(len(matched['morphPositions'][0]), 12)
        decoded['positions'][0] = 998
        with self.assertRaisesRegex(ValueError, 'exact GLB matches'):
            match_model(decoded, glb)

    def test_supplemental_transport_is_hashed_and_bounded(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = b'{"version":1}\n'
            data = gzip.compress(raw, mtime=0)
            digest = hashlib.sha256(data).hexdigest()
            path = 'death/' + digest + '.json.gz'
            (root / 'input/death').mkdir(parents=True)
            (root / 'input' / path).write_bytes(data)
            reference = {'model': 'fixture', 'path': path, 'bytes': len(data), 'sha256': digest,
                         'decodedBytes': len(raw), 'decodedSha256': hashlib.sha256(raw).hexdigest()}
            catalogue = {'meshDeaths': {'models': [reference]}}
            files = supplemental_assets(catalogue, root / 'input', root / 'assets')
            self.assertEqual(files[path]['sha256'], digest)
            self.assertEqual((root / 'assets' / path).read_bytes(), data)
            reference['decodedBytes'] += 1
            with self.assertRaisesRegex(ValueError, 'transport mismatch'):
                supplemental_assets(catalogue, root / 'input', root / 'assets')
            reference['path'] = '../escape.json.gz'
            with self.assertRaisesRegex(ValueError, 'asset path'):
                supplemental_assets(catalogue, root / 'input', root / 'assets')


if __name__ == '__main__':
    unittest.main()
