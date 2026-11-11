"""Independent execution of all original progress-menu callback bodies."""
import argparse
import tempfile
import unittest
import copy
import hashlib
import json
import random
from pathlib import Path

from catalogue import parse, walk
from progress_hud import extract_progress_hud, SOURCES, HOST, PART
from test_first_person_hud import FirstPersonGoal
from test_screen_hud import f32


class ProgressGoal(FirstPersonGoal):
    def run(self, form):
        if not isinstance(form, list):
            return super().run(form)
        op, *args = form
        if op == '#cond':
            for clause in args:
                if self.run(clause[0]):
                    result = None
                    for child in clause[1:]:
                        result = self.run(child)
                    return result
            return None
        if op == '#when':
            if self.run(args[0]):
                for child in args[1:]:
                    self.run(child)
            return None
        if op == 'unless':
            if not self.run(args[0]):
                for child in args[1:]:
                    self.run(child)
            return None
        if op == 'sar':
            return self.run(args[0]) >> self.run(args[1])
        if op == 'dotimes':
            name, limit = args[0]
            for index in range(self.run(limit)):
                self.env[name] = index
                for child in args[1:]:
                    self.run(child)
            self.env.pop(name, None)
            return None
        if op == '+!':
            if not isinstance(args[0], str):
                raise ValueError('Unsupported compound reference')
            self.env[args[0]] += self.run(args[1])
            return self.env[args[0]]
        if op == 'meters':
            return f32(self.run(args[0]) * 4096)
        return super().run(form)


def callback_oracle(root):
    file = 'engine/ui/progress/progress-part.gc'
    source = (root / file).read_bytes()
    forms = {f[1]: f for f in parse(source.decode()) if f[:1] == ['defun']}
    assert len(forms) == 13
    rng = random.Random(20261105)


    def vector():
        return dict(x=f32(rng.uniform(-40, 40)), y=f32(rng.uniform(-40, 40)),
                    z=f32(rng.uniform(-40, 40)), w=1.)


    def evaluate(name, hud, cpu):
        initial = [vector() for _ in range(4)]
        matrix = copy.deepcopy(initial)
        env = {'arg0': {}, 'arg1': cpu, 'arg2': {'vector': matrix}, '*progress-process*': [hud],
               'PC_PORT': False, '#t': True, '#f': False, '*pc-settings*': {'use-vis?': True}}
        goal = ProgressGoal(env, forms)
        for form in forms[name][3:]:
            goal.run(form)
        return initial, matrix


    samples = []
    orbit = 'fuel-cell-progress-hud-orbit-callback'
    for aspect, sx, sy, slot in [('4:3', 1., 13., 8192.), ('16:9', 1.2, 9.8, 6144.)]:
        for offset in [0, 1, 65, 1023, 1024, 2048, 2866, 2867, 4095, 4096]:
            for transition in [0., .25, .49999997, .5, .50000006, .75, 1.]:
                for option in range(4):
                    hud = {'left-side-x-scale': f32(rng.uniform(1000, 60000)),
                           'left-side-y-scale': f32(rng.uniform(1000, 90000)),
                           'right-side-x-scale': f32(rng.uniform(1000, 60000)),
                           'right-side-y-scale': f32(rng.uniform(1000, 90000)),
                           'sides-x-scale': f32(sx), 'sides-y-scale': f32(sy),
                           'slot-scale': slot, 'in-out-position': offset,
                           'transition-percentage-invert': f32(transition), 'option-index': option}
                    for name in forms:
                        if name == orbit:
                            continue
                        initial, result = evaluate(name, hud, {})
                        samples.append({'name': name, 'aspect': aspect, 'host': hud,
                                        'initial': initial, 'result': result})

    orbit_samples = []
    for owner in [-1, 0, 1, 2, 3, 6, 7, 8, 9, 13, 16, 31]:
        for state in range(4):
            for joint in [-1, 3, 4, 5, 6, 7, 9]:
                # The source center branch assumes its launch owner exists.
                if owner == -1 and joint == 3:
                    continue
                joints = [{i: vector() for i in (3, 4, 5, 6, 7, 9)} for _ in range(4)]
                hud = {'nb-of-particles': 32, 'particles': [{'part': {'matrix': i + 1000}} for i in range(32)],
                       'particle-state': [state] * 32,
                       'icons': [{'icon': [{'node-list': {'data': values}}]} for values in joints]}
                cpu = {'key': {'proc': hud, 'matrix': owner + 1000 if owner >= 0 else 9999},
                       'user-float': float(joint)}
                initial, result = evaluate(orbit, hud, cpu)
                orbit_samples.append({'owner': owner, 'state': state, 'joint': joint,
                                      'joints': joints, 'initial': initial, 'result': result})

    result = {'status': 'SOURCE_ORACLE_ONLY', 'source': {'file': file, 'sha256': hashlib.sha256(source).hexdigest()},
              'originalVisualMode': {'PC_PORT': False, 'use-vis?': True},
              'samples': samples, 'orbitSamples': orbit_samples}
    return result


class Extraction(unittest.TestCase):
    def test_optional_source(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertIsNone(extract_progress_hud(Path(directory),parse,walk))
    def test_unknown_operation(self):
        with self.assertRaises(ValueError):ProgressGoal({},{}).run(['unsupported-op',1])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    if not unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Extraction)).wasSuccessful():raise SystemExit(1)
    if args.source:
        definition=extract_progress_hud(args.source,parse,walk)
        result=callback_oracle(args.source);result['sources']=definition['sources']
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for file in SOURCES:
                (root/file).parent.mkdir(parents=True,exist_ok=True);(root/file).write_text((args.source/file).read_text())
            mutations=[(HOST,'(* 170.0 (-> *display* time-adjust-ratio))','(+ 170.0 (-> *display* time-adjust-ratio))'),
                (HOST,'(set! (-> this transition-speed) 15.0)','(set! (-> this transition-speed) 16.0)'),
                (HOST,'(< (-> self in-out-position) 2867)','(< (-> self in-out-position) 2800)'),
                (HOST,'(< 153 (-> self transition-offset))','(< 154 (-> self transition-offset))'),
                (HOST,'(seekl! (-> self transition-offset) 512','(seekl! (-> self transition-offset) 513'),
                (HOST,'(set! (-> self transition-speed) 30.0)','(set! (-> self transition-speed) 31.0)'),
                (PART,':part 615',':part 99999'),
                ('engine/common-obs/generic-obs.gc','num-func) num-func-identity','num-func) num-func-loop!')]
            for file,old,new in mutations:
                original=(args.source/file).read_text();assert old in original
                (root/file).write_text(original.replace(old,new))
                try:extract_progress_hud(root,parse,walk)
                except (ValueError,KeyError,AssertionError):pass
                else:raise AssertionError('Unsupported source mutation accepted: '+old)
                (root/file).write_text(original)
        args.output.write_text(json.dumps(result,separators=(',',':'))+'\n')
        print(json.dumps({'scalarCases':len(result['samples']),'orbitCases':len(result['orbitSamples']),
            'layers':len(definition['profiles'][0]['layers']),'mutations':len(mutations)}))
