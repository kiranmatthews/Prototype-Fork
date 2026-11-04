from pathlib import Path
import tempfile
import json
import unittest

from catalogue import parse, refresh_inventory, walk
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
        self.assertEqual(result['coverage']['particlesOutsideGroupGraph'], [4])
        self.assertTrue(result['standaloneParticles'][0]['alsoInGroupGraph'])
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

    def test_state_host_references_keep_context_and_tracker_arguments(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'state.gc').write_text('''
(defstate die (crate)
  :code (behavior ()
    (process-spawn part-tracker :init part-tracker-init group-explode -1 #f #f #f position :to pool)))
''')
            result = inventory(root, [], [{'name': 'group-explode', 'items': [],
                                           'duration': 75, 'linger-duration': 300}], parse, walk)
        self.assertEqual(result['groupUses'][0]['source']['function'], 'state:die:crate')
        replay = result['partTrackerLaunches'][0]['replay']
        self.assertEqual(replay['source']['function'], 'state:die:crate')
        self.assertEqual(replay['duration'], 75)
        self.assertEqual(result['coverage']['partTrackerReplayGroups'], 1)

    def test_inventory_refresh_reuses_only_an_identical_source_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / 'goal_src/jak1'
            source.mkdir(parents=True)
            code = source / 'a.gc'
            code.write_text('(defun host () (none))')
            previous = root / 'catalogue.json'
            previous.write_text(json.dumps({'particles': [], 'groups': [], 'models': ['unchanged'], 'coverage': {},
                                             'sourceInventory': inventory(source, [], [], parse, walk)}))
            self.assertEqual(refresh_inventory(previous, root)['models'], ['unchanged'])
            code.write_text('(defun changed () (none))')
            with self.assertRaisesRegex(ValueError, 'Source tree changed'):
                refresh_inventory(previous, root)


if __name__ == '__main__':
    unittest.main()
