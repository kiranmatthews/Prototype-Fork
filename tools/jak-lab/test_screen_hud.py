"""Evaluate the pinned HUD callback bodies independently of the TS port."""
import argparse
import copy
import json
import tempfile
import unittest
from pathlib import Path

from catalogue import parse, walk
from screen_hud import CALLBACKS, CLASSES, SOURCES, extract_screen_hud
from test_fuel_cell_hud import Goal, f32


class SourceGoal(Goal):
    def __init__(self, env, functions):
        super().__init__(env)
        self.functions = functions

    def run(self, form):
        if not isinstance(form, list):
            if form == 'else':
                return True
            return super().run(form)
        op, *args = form
        if op in self.functions:
            function = self.functions[op]
            values = [self.run(value) for value in args]
            old = self.env
            self.env = dict(old, **{param[0]: value for param, value in zip(function[2], values)})
            result = None
            for child in function[3:]:
                result = self.run(child)
            self.env = old
            return result
        if op == 'set!' and isinstance(args[0], str):
            value = self.run(args[1])
            self.env[args[0]] = value
            return value
        if op in ('let', 'let*'):
            old = {name: (name in self.env, self.env.get(name)) for name, _ in args[0]}
            if op == 'let':
                values = [(name, self.run(value)) for name, value in args[0]]
                self.env.update(values)
            else:
                for name, value in args[0]:
                    self.env[name] = self.run(value)
            result = None
            for child in args[1:]:
                result = self.run(child)
            for name, (existed, value) in old.items():
                if existed:
                    self.env[name] = value
                else:
                    del self.env[name]
            return result
        if op == 'if':
            branch = 1 if self.run(args[0]) else 2
            return self.run(args[branch]) if branch < len(args) else None
        if op == 'when':
            result = None
            if self.run(args[0]):
                for child in args[1:]:
                    result = self.run(child)
            return result
        if op == 'cond':
            for clause in args:
                if self.run(clause[0]):
                    result = None
                    for child in clause[1:]:
                        result = self.run(child)
                    return result
            return None
        if op == 'case':
            value = self.run(args[0])
            for clause in args[1:]:
                if clause[0] == 'else' or value in [self.run(key) for key in clause[0]]:
                    result = None
                    for child in clause[1:]:
                        result = self.run(child)
                    return result
            return None
        if op == 'pickup-type':
            return args[0]
        if op == 'and':
            return all(self.run(arg) for arg in args)
        if op == 'not':
            return not self.run(args[0])
        if op == 'zero?':
            return self.run(args[0]) == 0
        if op in ('logand', 'logtest?'):
            a, b = map(self.run, args)
            value = int(a) & int(b)
            return bool(value) if op == 'logtest?' else value
        if op in ('=', '<', '>='):
            a, b = map(self.run, args)
            return a == b if op == '=' else a < b if op == '<' else a >= b
        if op in ('+', '-', '*', '/'):
            a, b = map(self.run, args)
            value = a + b if op == '+' else a - b if op == '-' else a * b if op == '*' else a / b
            return f32(value) if isinstance(a, float) or isinstance(b, float) or op == '/' else value
        if op in ('the', 'the-as'):
            value = self.run(args[1])
            if args[0] == 'float':
                return f32(value)
            if args[0] == 'int':
                return int(value)
            if args[0] == 'uint':
                # These tests use valid non-negative live timer values. No
                # claim is made about an expired host's unsigned underflow.
                if value < 0:
                    raise ValueError('Expired unsigned timer requires its game host')
                return int(value)
            return value
        return super().run(form)


def oracle(source):
    library = extract_screen_hud(source, parse, walk)
    functions = {f[1]: f for f in parse((source / CLASSES).read_text())
                 if f[:1] == ['defun'] and f[1] in CALLBACKS + ('calculate-rotation-and-color-for-slice',)}
    samples = []
    for entry in library['entries']:
        for profile in entry['profiles']:
            cases = []
            if entry['id'] == 'health':
                cases = [(health, 6000, 'blue', frame) for health in (None, 0, .5, 1, 1.5, 2, 2.5, 3, 4) for frame in range(32)]
                callbacks = CALLBACKS[:3]
            elif entry['id'] == 'power':
                cases = [(3, ticks, color, frame) for ticks in (0, 1, 300, 1199, 1200, 1201, 2000, 4000, 6000, 7200)
                         for color in ('blue', 'yellow', 'red', 'green') for frame in (0, 1, 3, 4, 7, 8, 15, 16, 31)]
                callbacks = CALLBACKS[4:]
            else:
                cases = [(3, 6000, 'blue', 0)]
                callbacks = CALLBACKS[3:4]
            for health, ticks, color, frame in cases:
                scales = {key: f32(value) for key, value in profile['scales'].items()}
                hud = {'health': [{'scale': scales.get('scale', 0)}], 'buzzers': [{'scale': scales.get('scale', 0)}],
                       'power': [{'scale-blue': scales.get('scale-blue', 0), 'scale-timer': scales.get('scale-timer', 0),
                                  'scale-backing': scales.get('scale-backing', 0)}]}
                target = None if health is None else {'fact': {'health': float(health), 'eco-type': 'eco-' + color,
                                                              'eco-timeout': ticks, 'eco-pickup-time': 0}}
                results = {}
                for name in callbacks:
                    backing = name == 'part-hud-eco-timer-backing-func'
                    vector = [dict(x=0., y=0., z=0., w=0.) for _ in range(4)]
                    vector[2].update(x=128., y=100. if backing else 128., z=63. if backing else 128., w=64. if backing else 128.)
                    env = {'arg0': {}, 'arg1': {}, 'arg2': {'vector': vector}, '*target*': target, '*hud-parts*': hud,
                           '*FACT-bank*': {'eco-full-timeout': library['ecoFullTicks']}, 'DISPLAY_FPS_RATIO': 1.,
                           '*display*': {'integral-frame-counter': frame, 'game-frame-counter': 0}}
                    evaluator = SourceGoal(env, functions)
                    for form in functions[name][3:]:
                        evaluator.run(form)
                    results[name] = copy.deepcopy(vector)
                samples.append({'kind': entry['id'], 'format': profile['id'], 'health': health,
                                'ticks': ticks, 'color': color, 'frame': frame, 'results': results})
    return {'sources': library['sources'], 'samples': samples}


class Fixtures(unittest.TestCase):
    def test_absent_fixture_is_optional(self):
        with tempfile.TemporaryDirectory() as path:
            self.assertIsNone(extract_screen_hud(Path(path), parse, walk))

    def test_float32_and_short_circuit(self):
        goal = SourceGoal({'absent': None}, {})
        self.assertFalse(goal.run(['and', 'absent', ['unavailable']]))
        self.assertEqual(goal.run(['+', 16777216., 1.]), 16777216.)
        self.assertEqual(goal.run(['let', [['outer', 1]], ['let*', [['inner', 2]], ['set!', 'outer', 3]], 'outer']), 3)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Fixtures)).wasSuccessful():
        raise SystemExit(1)
    library = extract_screen_hud(args.source, parse, walk)
    assert [len(e['profiles'][0]['layers']) for e in library['entries']] == [3, 3, 1]
    assert library['ecoFullTicks'] == 6000
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for file in SOURCES:
            (root / file).parent.mkdir(parents=True, exist_ok=True)
            (root / file).write_text((args.source / file).read_text())
        path = root / CLASSES
        path.write_text(path.read_text().replace('(set! (-> this scale) 6963.2)', '(set! (-> this scale) (+ 6963.2 1))'))
        try:
            extract_screen_hud(root, parse, walk)
        except ValueError:
            pass
        else:
            raise AssertionError('Computed HUD dimensions escaped validation')
    result = oracle(args.source)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(json.dumps({'contexts': len(result['samples']), 'sourceFiles': len(result['sources'])}))
