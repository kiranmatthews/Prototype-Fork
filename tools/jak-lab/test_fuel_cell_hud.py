"""Evaluate the four original GOAL callbacks as an independent numeric oracle."""
import argparse
import copy
import json
import random
import struct
import tempfile
import unittest
from pathlib import Path

from catalogue import parse, walk
from fuel_cell_hud import CALLBACKS, CLASSES, SOURCES, extract_fuel_cell_hud


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


class Goal:
    def __init__(self, env):
        self.env = env

    def ref(self, form):
        if form[0] != '->':
            raise ValueError('Unsupported source reference')
        obj = self.run(form[1])
        for key in form[2:-1]:
            obj = obj[self.env.get(key, key) if isinstance(key, str) else self.run(key)]
        key = form[-1]
        return obj, self.env.get(key, key) if isinstance(key, str) else self.run(key)

    def run(self, form):
        if isinstance(form, (float, int)):
            return f32(form) if isinstance(form, float) else form
        if isinstance(form, str):
            if form not in self.env:
                raise ValueError('Unknown source symbol ' + form)
            return self.env[form]
        op, *args = form
        if op == '->':
            obj, key = self.ref(form)
            return obj[key]
        if op == 'let':
            old = self.env.copy()
            values = [(name, self.run(value)) for name, value in args[0]]
            self.env.update(values)
            result = None
            for child in args[1:]:
                result = self.run(child)
            self.env = old
            return result
        if op in ('the-as', 'the'):
            value = self.run(args[-1])
            return int(value) if args[0] == 'int' else value
        if op == 'new':
            if args != [['quote', 'stack-no-clear'], ['quote', 'vector']]:
                raise ValueError('Unsupported source allocation')
            return dict(x=0., y=0., z=0., w=1.)
        if op == 'set!':
            value = self.run(args[1])
            obj, key = self.ref(args[0])
            obj[key] = value
            return value
        if op == 'vector<-cspace!':
            target, source = map(self.run, args)
            # Source cspace's bone column has already been divided by w.
            target.update(source)
            return target
        if op == 'vector-!':
            target, a, b = map(self.run, args)
            target.update({key: f32(a[key] - b[key]) for key in ('x', 'y', 'z', 'w')})
            return target
        if op == 'set-vector!':
            target = self.run(args[0])
            target.update(zip(('x', 'y', 'z', 'w'), map(self.run, args[1:])))
            return target
        if op == '*':
            a, b = map(self.run, args)
            return f32(a * b)
        if op == 'none':
            return None
        raise ValueError('Unsupported GOAL oracle operation ' + str(op))


def callback_samples(source):
    forms = {f[1]: f for f in parse((source / CLASSES).read_text()) if f[0] == 'defun' and f[1] in CALLBACKS}
    library = extract_fuel_cell_hud(source, parse, walk)
    rng = random.Random(180313)
    output = []
    for profile in library['profiles']:
        for index in (4, 5, 6, 7, 9):
            for _ in range(20):
                vector = lambda: {**{k: f32(rng.uniform(-6000, 6000)) for k in ('x', 'y', 'z')}, 'w': 1.}
                joints = {3: vector(), index: vector()}
                hud = {'scale-icon': f32(profile['iconScale']), 'scale-center': f32(profile['centerScale']),
                       'scale-starburst-3-x': f32(profile['starburst3'][0]),
                       'scale-starburst-3-y': f32(profile['starburst3'][1]),
                       'scale-starburst-4-x': f32(profile['starburst4'][0]),
                       'scale-starburst-4-y': f32(profile['starburst4'][1]),
                       'icons': [{'icon': [{'node-list': {'data': joints}, 'root': {'scale': vector()}}]}]}
                results = {}
                for name in CALLBACKS:
                    matrix = {'vector': [vector() for _ in range(4)]}
                    env = {'arg0': {}, 'arg1': {'key': {'proc': hud}, 'user-float': float(index)},
                           'arg2': matrix, '*hud-parts*': {'fuel-cell': [hud]}}
                    evaluator = Goal(env)
                    for form in forms[name][3:]:
                        evaluator.run(form)
                    results[name] = copy.deepcopy(matrix['vector'])
                output.append({'format': profile['id'], 'joint': index, 'joints': joints,
                               'results': results, 'iconScale': hud['icons'][0]['icon'][0]['root']['scale']})
    return {'sources': library['sources'], 'samples': output}


class Extraction(unittest.TestCase):
    def test_missing_fixture_is_optional(self):
        with tempfile.TemporaryDirectory() as path:
            self.assertIsNone(extract_fuel_cell_hud(Path(path), parse, walk))

    def test_oracle_rejects_unknown_operations(self):
        with self.assertRaises(ValueError):
            Goal({}).run(['sin', 0.])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Extraction)
    if not unittest.TextTestRunner().run(suite).wasSuccessful():
        raise SystemExit(1)
    if args.source:
        library = extract_fuel_cell_hud(args.source, parse, walk)
        assert library['model'] == 'fuelcell-naked-lod0'
        assert library['clip'] == 'fuelcell-naked-idle'
        assert len(library['sources']) == len(SOURCES)
        with tempfile.TemporaryDirectory() as path:
            root = Path(path)
            for file in SOURCES:
                (root / file).parent.mkdir(parents=True, exist_ok=True)
                (root / file).write_text((args.source / file).read_text())
            text = (root / CLASSES).read_text()
            (root / CLASSES).write_text(text.replace('(* 182.04445 (/ (-> *display* time-adjust-ratio) 2))',
                                                       '(* 90.0 (/ (-> *display* time-adjust-ratio) 2))'))
            try:
                extract_fuel_cell_hud(root, parse, walk)
            except ValueError:
                pass
            else:
                raise AssertionError('Changed source yaw escaped extraction validation')
        result = callback_samples(args.source)
        if args.output:
            args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
        print(json.dumps({'callbackSamples': len(result['samples']), 'sources': len(result['sources'])}))
