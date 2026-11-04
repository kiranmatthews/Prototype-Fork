import copy
import unittest

from catalogue import parse
from compile_callbacks import compile_contact, UnsupportedCallback


SOURCE = '''(defun check-drop-level-fixture ((arg0 sparticle-system) (arg1 sparticle-cpuinfo) (arg2 vector))
  (when (and (< (-> arg2 y) (-> arg1 user-float)) (< (-> arg1 vel-sxvel y) 0.0))
    (let ((pos (new 'stack-no-clear 'vector)))
      (sp-kill-particle arg0 arg1)
      (if (< (rand-float-gen) 0.25) (sound-play "water-drop"))
      (set-vector! pos (-> arg2 x) (-> arg1 user-float) (-> arg2 z) 1.0)
      (launch-particles (-> *part-id-table* 39) pos :rate 1.0)
      (launch-particles :system *sp-particle-system-3d* (-> *part-id-table* 40) pos)))
  (none))'''


class CallbackCompilerTest(unittest.TestCase):
    def callback(self, text=SOURCE):
        return {'name': 'check-drop-level-fixture', 'source': {'file': 'fixture.gc', 'line': 1},
                'form': parse(text)[0]}

    def test_preserves_condition_system_position_and_action_order(self):
        program = compile_contact(self.callback())
        self.assertEqual(program['comparison'], 'below')
        self.assertTrue(program['descending'])
        self.assertEqual(program['actions'], [
            {'op': 'kill'}, {'op': 'sound', 'name': 'water-drop', 'chance': .25},
            {'op': 'launch', 'particle': 39, 'is3d': False, 'height': 'surface'},
            {'op': 'launch', 'particle': 40, 'is3d': True, 'height': 'surface'}])
        self.assertEqual(len(program['formSha256']), 64)

    def test_preserves_current_position_instead_of_snapping_every_effect(self):
        program = compile_contact(self.callback(SOURCE.replace('(set-vector! pos (-> arg2 x) (-> arg1 user-float)',
                                                               '(set-vector! pos (-> arg2 x) (-> arg2 y)')))
        self.assertEqual(program['actions'][2]['height'], 'particle')

    def test_rejects_unported_semantics_instead_of_silently_dropping_them(self):
        for source in [SOURCE.replace(':rate 1.0', ':rate 2.0'),
                       SOURCE.replace('(-> *part-id-table* 39)', '(-> *part-id-table* (dynamic-id))'),
                       SOURCE.replace('(sp-kill-particle arg0 arg1)', '(do-something-new arg0)')]:
            with self.assertRaises(UnsupportedCallback):
                compile_contact(self.callback(source))

    def test_rejects_a_new_top_level_action(self):
        callback = copy.deepcopy(self.callback())
        callback['form'].insert(-1, ['set!', ['->', 'arg1', 'timer'], 10])
        with self.assertRaises(UnsupportedCallback):
            compile_contact(callback)


if __name__ == '__main__':
    unittest.main()
