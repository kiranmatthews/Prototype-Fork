from pathlib import Path
import tempfile
import unittest

from catalogue import parse, walk
from particle_lighting import extract_particle_lighting, TABLES, RUNTIME, LEVELS


class ParticleLightingTests(unittest.TestCase):
    def extract(self, transform=lambda s: s):
        tables = '''
(define *fixture-lights* (new 'static 'mood-lights-table :data
 (new 'static 'inline-array mood-lights 8
  (new 'static 'mood-lights :lgt-color (new 'static 'vector :x 2.0 :y 1.0)
   :amb-color (new 'static 'vector :z 0.4)) REPEAT_LIGHTS)))
(define *fixture-hours* (new 'static 'sky-color-day :hour
 (new 'static 'inline-array sky-color-hour 24 REPEAT_HOURS)))
(define *fixture-mood* (new 'global 'mood-context))
(set! (-> *fixture-mood* mood-lights-table) *fixture-lights*)
(set! (-> *fixture-mood* palette-interp) *fixture-hours*)
'''.replace('REPEAT_LIGHTS', "(new 'static 'mood-lights) " * 7).replace(
            'REPEAT_HOURS', "(new 'static 'sky-color-hour :snapshot2 1 :morph-end 0.5) " * 24)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for file, text in {
                TABLES: transform(tables),
                RUNTIME: '''(defun update-fixture ((arg0 mood-context))
                  (if (condition) (update-mood-palette arg0 time 0)
                   (update-mood-quick arg0 0 0 1 0)))
                  (defun other () (update-mood-quick other-context 0 0 7 0))''',
                LEVELS: "(define beach (new 'static 'level-load-info :name 'beach :mood '*fixture-mood* :mood-func 'update-fixture))",
            }.items():
                path = root / file
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)
            return extract_particle_lighting(root, parse, walk)

    def test_defaults_full_arrays_level_owner_and_real_selectors(self):
        data = self.extract()
        self.assertEqual(len(data['lightTables'][0]['snapshots']), 8)
        first, empty = data['lightTables'][0]['snapshots'][:2]
        self.assertEqual(first['particle'], [0, 0, 0, 0])
        self.assertEqual(first['light'], [2, 1, 0, 0])
        self.assertEqual(empty['light'], [0, 0, 0, 0])
        self.assertEqual(data['palettes'][0]['hours'][0],
                         {'snapshot1': 0, 'snapshot2': 1, 'morph-start': 0, 'morph-end': .5})
        context = data['contexts'][0]
        self.assertEqual(context['levels'], ['beach'])
        self.assertEqual([(s['kind'], s['snapshot']) for s in context['presets']], [('cycle', None), ('snapshot', 1)])
        self.assertTrue(all(s['function'] == 'update-fixture' for s in context['presets']))
        self.assertTrue(all(len(s['sha256']) == 64 for s in data['sources']))

    def test_rejects_truncation_computed_numbers_and_dangling_tables(self):
        for old, new in [('mood-lights 8', 'mood-lights 7'),
                         (':x 2.0', ':x (computed)'), (':snapshot2 1', ':snapshot2 8'),
                         (':morph-end 0.5', ':morph-end 1.1'),
                         ('palette-interp) *fixture-hours*', 'palette-interp) *missing*')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                self.extract(lambda text: text.replace(old, new))


if __name__ == '__main__':
    unittest.main()
