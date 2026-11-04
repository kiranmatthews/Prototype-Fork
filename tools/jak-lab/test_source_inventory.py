from pathlib import Path
import tempfile
import json
import unittest

from catalogue import parse, refresh_inventory, walk
from source_inventory import inventory


class InventoryTests(unittest.TestCase):
    def source_result(self, code):
        particles = [{'id': i, 'source': {'file': 'fixture.gc', 'line': i},
                      'fields': [{'field': 'num', 'op': 'float', 'base': 1}]}
                     for i in range(1, 10)]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'fixture.gc').write_text(code)
            return inventory(root, particles, [], parse, walk)

    def test_local_aliases_shadowing_parallel_let_and_sequential_let(self):
        result = self.source_result('''
(defun fixture ()
  (let ((p (-> *part-id-table* 2)) (system *sp-particle-system-3d*))
    (launch-particles :system system p pos)
    (let ((p (-> *part-id-table* 5))) (launch-particles p pos))
    (launch-particles p pos)
    (let ((p (-> *part-id-table* 3)) (q p)) (launch-particles q pos))
    (let* ((p (-> *part-id-table* 4)) (q p)) (launch-particles q pos))
    (set! p (computed-launcher))
    (launch-particles p pos)))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[2], [5], [2], [2], [4], []])
        self.assertEqual(result['directLaunches'][0]['systems'], ['3d'])
        self.assertEqual(result['coverage']['unresolvedDirectLauncherSites'], 1)

    def test_branch_return_values_exclude_side_effect_lookups(self):
        result = self.source_result('''
(defun fixture ()
  (let ((p (cond
             ((condition) (set! (-> *part-id-table* 9 init-specs 1 initial-valuef) 3.0)
                          (-> *part-id-table* 2))
             ((other) (the-as sparticle-launcher (-> *part-id-table* 3)))
             (else 0))))
    (launch-particles p pos))
  (let ((p (-> *part-id-table* 4)))
    (when (condition) (set! p (-> *part-id-table* 5)))
    (launch-particles p pos)))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[2, 3], [4, 5]])
        self.assertEqual(result['runtimeParticlePatches'][0]['particles'], [9])
        self.assertNotIn(9, [p['particle'] for p in result['standaloneParticles']])

    def test_loop_mutation_and_loop_variable_cannot_reuse_stale_aliases(self):
        result = self.source_result('''
(defun fixture ()
  (let ((p (-> *part-id-table* 2)))
    (dotimes (i 3) (launch-particles p pos) (set! p (-> *part-id-table* 3)))
    (launch-particles p pos))
  (let ((p (-> *part-id-table* 7)))
    (dotimes (i 3) (let ((q p)) (launch-particles q pos)))
    (dotimes (p 3) (launch-particles p pos))))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[], [], [7], []])

    def test_unknown_systems_are_flagged_and_known_branches_keep_both_variants(self):
        result = self.source_result('''
(defun fixture ()
  (let ((p (-> *part-id-table* 2)) (three #f))
    (launch-particles :system (if three *sp-particle-system-3d* *sp-particle-system-2d*) p pos))
  (launch-particles :system (if (condition) *sp-particle-system-3d* *sp-particle-system-2d*) (-> *part-id-table* 3) pos)
  (launch-particles :system (unknown-system) (-> *part-id-table* 4) pos))
''')
        self.assertEqual([e['systems'] for e in result['directLaunches']], [['2d'], ['2d', '3d'], []])
        self.assertEqual(result['coverage']['unresolvedDirectSystemSites'], 1)
        entries = {e['particle']: e for e in result['standaloneParticles']}
        self.assertEqual([e['is3d'] for e in entries[3]['launches']], [False, True])
        self.assertEqual(entries[4]['launches'], [])

    def test_alias_patches_and_argument_evaluation_order(self):
        result = self.source_result('''
(defun fixture ()
  (let* ((index 2) (p (-> *part-id-table* index)))
    (set! (-> p init-specs 1 initial-valuef) 8.0)
    (launch-particles :system (begin (set! p (-> *part-id-table* 3)) *sp-particle-system-2d*) p pos)))
''')
        self.assertEqual(result['runtimeParticlePatches'][0]['particles'], [2])
        self.assertEqual(result['directLaunches'][0]['particles'], [3])

    def test_mixed_numeric_pointer_is_not_a_fully_resolved_launcher(self):
        result = self.source_result('''
(defun fixture ()
  (let ((p (if (condition) (-> *part-id-table* 2) 99)))
    (launch-particles p pos))
  (let ((p (cond (#f (-> *part-id-table* 9)) (else (-> *part-id-table* 3)))))
    (launch-particles p pos)))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[2], [3]])
        self.assertFalse(result['directLaunches'][0]['launcherResolved'])
        self.assertTrue(result['directLaunches'][1]['launcherResolved'])

    def test_finite_conditional_indices_and_partially_unknown_indices(self):
        result = self.source_result('''
(defun fixture ()
  (launch-particles (-> *part-id-table* (if (random-choice) 2 3)) pos)
  (let ((index (cond ((one) 4) ((two) 5) (else 6))))
    (launch-particles (-> *part-id-table* index) pos))
  (launch-particles (-> *part-id-table* (if (choice) 7 (computed-index))) pos))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[2, 3], [4, 5, 6], [7]])
        self.assertEqual([e['launcherResolved'] for e in result['directLaunches']], [True, True, False])

    def test_function_parameters_quote_and_unknown_mutation(self):
        result = self.source_result('''
(defmacro unused () `(launch-particles (-> *part-id-table* 9) pos))
(defun fixture ()
  (let ((p (-> *part-id-table* 2)))
    (defun inner ((p object)) (launch-particles p pos))
    '(launch-particles (-> *part-id-table* 8) pos)
    (mystery! p)
    (launch-particles p pos)
    (launch-particles (computed-launcher) (-> *part-id-table* 7))))
''')
        self.assertEqual([e['particles'] for e in result['directLaunches']], [[], [], []])
        self.assertEqual(result['standaloneParticles'], [])

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

    def test_empty_source_definition_is_audited_without_a_fake_visual_exhibit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'fixture.gc').write_text('(defun fixture () (launch-particles (-> *part-id-table* 97) pos))')
            result = inventory(root, [{'id': 97, 'fields': [], 'source': {'file': 'fixture.gc', 'line': 1}}], [], parse, walk)
        self.assertEqual(result['standaloneParticles'], [])
        self.assertEqual(result['coverage']['emptyDirectParticleDefinitions'], [97])
        self.assertEqual(result['coverage']['definedDirectParticleRoots'], 1)
        self.assertEqual(result['coverage']['particlesOutsideGroupAndDirectGraphs'], [])

    def test_callback_graph_follows_alias_launches_not_lookups_or_nested_definitions(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'fixture.gc').write_text('''
(defun fixture ()
  (let ((p (-> *part-id-table* 2))) (launch-particles p pos))
  '(launch-particles (-> *part-id-table* 3) pos)
  (defun inner () (launch-particles (-> *part-id-table* 4) pos))
  (-> *part-id-table* 5))
''')
            particles = [{'id': i, 'source': {'file': 'fixture.gc', 'line': i},
                          'fields': [{'field': 'num', 'op': 'float', 'base': 1}]} for i in range(1, 6)]
            particles[0]['fields'].append({'field': 'func', 'op': 'value', 'value': 'fixture'})
            result = inventory(root, particles, [{'name': 'group-fixture', 'items': [{'particle': 1}]}], parse, walk)
        self.assertEqual(result['callbackDefinitions'][0]['directParticleReferences'], [2])
        self.assertEqual(result['coverage']['particlesOutsideGroupGraph'], [3, 4, 5])

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
