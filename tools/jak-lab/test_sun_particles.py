"""Source parser fixtures and an independent AST-evaluated sky-orbit oracle."""
import argparse
import json
from pathlib import Path
import random
import struct
import tempfile
import unittest

from catalogue import parse, walk
from sun_particles import extract_sun_particles, hour_predicate, SKY, TIME, SOURCES


class SunExtractionTests(unittest.TestCase):
    def fixture(self, change=lambda s: s):
        sky = '\n'.join(f'(sky-set-orbit *sky-parms* {i} {12.5 if i == 0 else 4.0} -15.0 60.0 9950.0 120.0 120.0)' for i in range(3))
        host = '''(defbehavior time-of-day-update time-of-day-proc ()
 (cond ((and (>= (-> self time-of-day) 6.25) (< (-> self time-of-day) 18.75)
   (!= (-> *time-of-day-context* sun-fade) 0.0)) (spawn (-> self sun) (math-camera-pos)))
   (else (kill-and-free-particles (-> self sun))))
 (cond ((and (or (>= (-> self time-of-day) 21.75) (>= 10.25 (-> self time-of-day)))
   (!= (-> *time-of-day-context* sun-fade) 0.0)) (spawn (-> self green-sun) (math-camera-pos)))
   (else (kill-and-free-particles (-> self green-sun)))))
(set! (-> self sun) (create-launch-control group-sun self))
(set! (-> self green-sun) (create-launch-control group-green-sun self))'''
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for file in SOURCES:
                path = root / file
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(change(sky if file == SKY else host if file == TIME else ''))
            return extract_sun_particles(root, parse, walk)

    def test_provenance_orbits_and_strict_inclusive_hours(self):
        data = self.fixture()
        self.assertEqual(len(data['sources']), len(SOURCES))
        self.assertEqual(data['orbits'][0]['distance'], 9950)
        self.assertEqual(data['hosts'][0]['hours'], {'op': 'and', 'terms': [
            {'op': '>=', 'hour': 6.25}, {'op': '<', 'hour': 18.75}]})
        self.assertEqual(data['hosts'][1]['hours'], {'op': 'or', 'terms': [
            {'op': '>=', 'hour': 21.75}, {'op': '<=', 'hour': 10.25}]})

    def test_rejects_changed_gate_unknown_predicate_and_wrong_binding(self):
        for old, new in [('sun-fade) 0.0', 'sun-fade) 0.1'), ('group-sun self', 'group-other self'),
                         ('18.75', '(computed)'), ('*sky-parms* 2', '*sky-parms* 3')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                self.fixture(lambda text: text.replace(old, new))
        with self.assertRaises(ValueError):
            hour_predicate(['=', ['->', 'self', 'time-of-day'], 12])


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


class SourceMath:
    """Evaluate the pinned GOAL expressions rather than copying the TS formula.

    Only the arithmetic/control/structure subset used by these six functions
    is accepted. Unknown forms fail, and every float operation rounds to f32.
    """
    def __init__(self, source):
        self.functions = {}
        for file in [SKY, 'engine/math/trigonometry.gc']:
            for form in parse((source / file).read_text()):
                if len(form) > 3 and form[0] == 'defun' and form[1] in (
                        'sky-make-sun-data', 'sin', 'cos', 'sin-rad', 'cos-rad'):
                    self.functions[form[1]] = form

    def call(self, name, args):
        form = self.functions[name]
        env = {param[0]: f32(arg) if param[1] == 'float' else arg for param, arg in zip(form[2], args)}
        result = None
        for expression in form[3:]:
            result = self.run(expression, env)
        return result

    def path(self, expression, env):
        value = env[expression[1]]
        for key in expression[2:-1]:
            value = value[env.get(key, key) if isinstance(key, str) else key]
        key = expression[-1]
        return value, env.get(key, key) if isinstance(key, str) else key

    def run(self, expression, env):
        if not isinstance(expression, list):
            if type(expression) is float:
                return f32(expression)
            if type(expression) is int:
                return expression
            if expression.startswith('"'):
                return None
            return env[expression]
        if not expression:
            return None
        op, *args = expression
        if isinstance(op, list):  # decompiler's single-expression grouping
            result = None
            for item in expression:
                result = self.run(item, env)
            return result
        if op in ('let', 'let*'):
            local = env.copy()
            for key, value in args[0]:
                local[key] = self.run(value, local if op == 'let*' else env)
            result = None
            for item in args[1:]:
                result = self.run(item, local)
            return result
        if op == 'local-vars':
            for name, _ in args:
                env[name] = 0.0
            return None
        if op == '->':
            parent, key = self.path(expression, env)
            return parent[key]
        if op == 'set!':
            value = self.run(args[1], env)
            if isinstance(args[0], list):
                parent, key = self.path(args[0], env)
                parent[key] = value
            else:
                env[args[0]] = value
            return value
        if op == 'if':
            return self.run(args[1] if self.run(args[0], env) else args[2], env)
        if op == 'the':
            value = self.run(args[1], env)
            return int(value) if args[0] == 'int' else f32(value)
        if op == 'the-as' and args[0] == 'float':
            return struct.unpack('<f', struct.pack('<I', args[1]))[0]
        if op == 'none':
            return None
        values = [self.run(arg, env) for arg in args]
        if op in self.functions:
            return self.call(op, values)
        if op == '<':
            return values[0] < values[1]
        if op == 'shl':
            value = (values[0] << values[1]) & ((1 << 64) - 1)
            return value - (1 << 64) if value >= 1 << 63 else value
        if op == 'sar':
            return values[0] >> values[1]
        if op in ('+', '-', '*'):
            value = sum(values) if op == '+' else -values[0] if op == '-' and len(values) == 1 else (
                values[0] - values[1] if op == '-' else values[0] * values[1])
            return f32(value) if any(type(v) is float for v in values) else value
        raise ValueError(f'Unsupported oracle expression: {expression}')


def write_oracle(source, output):
    library = extract_sun_particles(source, parse, walk)
    evaluator = SourceMath(source)
    samples = []
    random_hours = random.Random(1)
    hours = sorted({i / 16 for i in range(385)} | {random_hours.random() * 24 for _ in range(256)} |
                   {6.2499, 6.25, 10.25, 10.2501, 18.7499, 18.75, 21.7499, 21.75})
    for orbit in library['orbits'][:2]:
        for hour in hours:
            sky = {'orbit': [{**orbit, 'high-noon': orbit['highNoon'], 'dist': orbit['distance'],
                              'tilt': f32(f32(.017453292) * orbit['tilt']), 'rise': f32(f32(.017453292) * orbit['rise']),
                              'min-halo': 120.0, 'max-halo': 300.0}] * 3,
                   'upload-data': {'sun': [{'pos': {}} for _ in range(3)]}}
            evaluator.call('sky-make-sun-data', [sky, orbit['slot'], hour])
            samples.append({'slot': orbit['slot'], 'hour': hour,
                            'position': [sky['upload-data']['sun'][orbit['slot']]['pos'][axis] for axis in 'xyz']})
    output.write_text(json.dumps({'samples': samples, 'sources': library['sources']}, separators=(',', ':')) + '\n')
    print(f'Source AST orbit oracle: {len(samples)} samples')


if __name__ == '__main__':
    if '--source' in __import__('sys').argv:
        parser = argparse.ArgumentParser()
        parser.add_argument('--source', type=Path, required=True)
        parser.add_argument('--output', type=Path, required=True)
        args = parser.parse_args()
        write_oracle(args.source, args.output)
    else:
        unittest.main()
