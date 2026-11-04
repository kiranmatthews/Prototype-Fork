from pathlib import Path
import tempfile
import unittest

from catalogue import parse, walk
from source_inventory import inventory


class InventoryTests(unittest.TestCase):
    def test_direct_launches_patches_and_missing_graph_stages(self):
        source = '''
(defun drop ((cpu object))
  (launch-particles :system *sp-particle-system-3d* (-> *part-id-table* 2) cpu))
(defun live-change ()
  (set! (-> *part-id-table* 2 init-specs 1 initial-valuef) 3.0)
  (create-launch-control group-main self))
(defmethod draw ((this water)) (render-water this))
'''
        particles = [
            {'id': 1, 'source': {'file': 'a.gc', 'line': 1}, 'fields': [{'field': 'func', 'op': 'value', 'value': 'drop'}]},
            {'id': 2, 'source': {'file': 'a.gc', 'line': 2}, 'fields': [{'field': 'next-launcher', 'op': 'int', 'base': 3}]},
            {'id': 3, 'source': {'file': 'a.gc', 'line': 3}, 'fields': []},
            {'id': 4, 'source': {'file': 'a.gc', 'line': 4}, 'fields': []},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'a.gc').write_text(source)
            result = inventory(root, particles, [{'name': 'group-main', 'items': [{'particle': 1}]}], parse, walk)
        self.assertEqual(result['parseFailures'], [])
        self.assertEqual(result['coverage']['particlesOutsideGroupGraph'], [2, 3, 4])
        self.assertEqual(result['coverage']['particlesOutsideGroupAndDirectGraphs'], [4])
        self.assertEqual(result['missingCallbackDefinitions'], [])
        self.assertEqual(result['directLaunches'][0]['source']['function'], 'drop')
        self.assertTrue(result['directLaunches'][0]['is3d'])
        self.assertEqual(result['runtimeParticlePatches'][0]['particles'], [2])
        self.assertEqual(result['proceduralRendererCandidates'][0]['name'], 'draw:water')
        self.assertEqual(result['groupUses'][0]['groups'], ['group-main'])

    def test_malformed_file_cannot_silently_pass_coverage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'broken.gc').write_text('(defun unfinished (')
            result = inventory(root, [], [], parse, walk)
        self.assertEqual(result['coverage']['parseFailures'], 1)


if __name__ == '__main__':
    unittest.main()
