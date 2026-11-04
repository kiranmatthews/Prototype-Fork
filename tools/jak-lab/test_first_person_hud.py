"""Independent evaluation of the original first-person callbacks and states."""
import argparse
import copy
import json
import tempfile
import unittest
from pathlib import Path

from catalogue import parse, walk
from first_person_hud import CALLBACKS, HOST, SOURCES, extract_first_person_hud
from test_screen_hud import SourceGoal, f32


class FirstPersonGoal(SourceGoal):
    def run(self, form):
        if not isinstance(form, list):
            return super().run(form)
        op, *args = form
        if op == 'quote':
            return args[0]
        if op == 'or':
            return any(self.run(arg) for arg in args)
        if op == 'handle->process':
            return self.run(args[0])
        if op == 'movie?':
            return self.env['movie-active']
        if op == 'suspend':
            return None
        if op == 'go':
            self.env['oracleNextState'] = args[0]
            return None
        if op == 'deactivate':
            self.env['oracleNextState'] = 'hidden'
            return None
        if op == 'loop':
            for child in args:
                self.run(child)
            return None
        if op == 'seekl!':
            obj, key = self.ref(args[0])
            goal, amount = self.run(args[1]), self.run(args[2])
            obj[key] = min(goal, obj[key] + amount) if goal > obj[key] else max(goal, obj[key] - amount)
            return obj[key]
        return super().run(form)


def source_host(profile, offset):
    return {'in-out-position': offset, **{key: f32(value) for key, value in profile['scales'].items()},
            'particles': [{'init-pos': dict(zip('xyz', layer['position'])), 'pos': dict(x=0., y=0., z=0.)}
                          for layer in profile['layers']]}


def callbacks(functions, hud, setting_movie=False, movie=False):
    results = {}
    for index, name in enumerate(CALLBACKS):
        vector = [dict(x=0., y=0., z=0., w=0.) for _ in range(4)]
        vector[0]['w'] = f32(4096. if index == 2 else 14336.)
        vector[1]['w'] = f32(4096. if index == 2 else 53248.)
        vector[1]['z'] = 32768. if index == 1 else 0.
        vector[2].update(x=128., y=128., z=128., w=128.)
        env = {'arg0': {}, 'arg1': {}, 'arg2': {'vector': vector}, '*target*': {'fp-hud': hud},
               '*setting-control*': {'current': {'movie': setting_movie}}, 'movie-active': movie}
        evaluator = FirstPersonGoal(env, functions)
        for form in functions[name][3:]:
            evaluator.run(form)
        results[name] = copy.deepcopy(vector)
    return results


def oracle(source):
    definition = extract_first_person_hud(source, parse, walk)
    forms = parse((source / HOST).read_text())
    functions = {f[1]: f for f in forms if f[:1] == ['defun'] and f[1] in CALLBACKS}
    states = {f[1]: f for f in forms if f[:1] == ['defstate'] and f[2] == ['first-person-hud']}
    waiting = states['hud-waiting']; waiting_loop = waiting[waiting.index(':code') + 1][2]
    assert waiting_loop[-3:] == [['suspend'], ['go', 'hud-coming-in'], ['suspend']]
    spawn = next(f for f in forms if f[:3] == ['defmethod', 'spawn-particles!', [['this', 'first-person-hud']]])
    body = spawn[3]
    assert body[:2] == ['dotimes', ['s5-0', ['->', 'this', 'nb-of-particles']]]
    placement = body[2:5]
    assert [f[1][-1] for f in placement] == ['x', 'y', 'z']
    offsets = sorted(set([0, 1, 1023, 1024, 1025, 2047, 2048, 2049, 4095, 4096] +
                         list(range(0, 4097, 173)) + list(range(0, 4097, 200)) +
                         list(range(0, 4097, 150)) + [max(0, 4096 - 350 * i) for i in range(13)]))
    samples = []
    timelines = []
    for profile in definition['profiles']:
        for offset in offsets:
            for setting_movie, movie in ((False, False), (True, False), (False, True), (True, True)):
                hud = source_host(profile, offset)
                values = callbacks(functions, hud, setting_movie, movie)
                samples.append({'format': profile['id'], 'offset': offset, 'movie': setting_movie or movie,
                                'results': values, 'positions': [list(p['init-pos'].values()) for p in hud['particles']]})
        for ending in ('absent', 'going-out', 'gone'):
            hud = source_host(profile, definition['maximumOffset'])
            phase = 'hud-coming-in'
            records = [{'phase': 'waiting', 'offset': hud['in-out-position'], 'active': False,
                        'progress': 'absent', 'movie': False, 'action': 'wait'}]
            for progress, movie, action, frames in [('absent', False, 'arrive', 40), ('open', False, 'suppress', 30),
                                                   (ending, False, 'restore', 40), (ending, True, 'movie', 4),
                                                   (ending, False, 'restore', 4), (ending, False, 'hide', 24)]:
                if action == 'hide':
                    phase = 'hud-going-out'
                for _ in range(frames):
                    active = phase != 'hidden'
                    origins = []
                    values = {}
                    if active:
                        env = {'self': hud, '*display*': {'time-adjust-ratio': 1.},
                               '*progress-process*': None if progress == 'absent' else
                               [{'next-state': {'name': 'progress-' + progress}}], 'oracleNextState': phase}
                        evaluator = FirstPersonGoal(env, functions)
                        form = states[phase]
                        evaluator.run(form[form.index(':code') + 1][2])
                        phase = evaluator.env['oracleNextState']
                        active = phase != 'hidden'
                    if active:
                        for index in range(3):
                            evaluator = FirstPersonGoal({'this': hud, 's5-0': index,
                                '*video-parms*': {'relative-y-scale': 1., 'screen-sy': 224}}, functions)
                            for form in placement:
                                evaluator.run(form)
                            origins.append(list(hud['particles'][index]['pos'].values()))
                        values = callbacks(functions, hud, False, movie)
                    records.append({'phase': {'hud-coming-in': 'arriving', 'hud-normal': 'in',
                        'hud-going-out': 'leaving', 'hidden': 'hidden'}[phase], 'offset': hud['in-out-position'],
                        'active': active, 'progress': progress, 'movie': movie, 'action': action,
                        'origins': origins, 'results': values})
            timelines.append({'format': profile['id'], 'ending': ending, 'records': records})
    return {'sources': definition['sources'], 'samples': samples, 'timelines': timelines}


class Extraction(unittest.TestCase):
    def test_optional_source(self):
        with tempfile.TemporaryDirectory() as path:
            self.assertIsNone(extract_first_person_hud(Path(path), parse, walk))

    def test_unknown_oracle_operation(self):
        with self.assertRaises(ValueError):
            FirstPersonGoal({}, {}).run(['unsupported', 1])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(Extraction)).wasSuccessful():
        raise SystemExit(1)
    if args.source:
        result = oracle(args.source)
        with tempfile.TemporaryDirectory() as path:
            root = Path(path)
            for file in SOURCES:
                (root / file).parent.mkdir(parents=True, exist_ok=True)
                (root / file).write_text((args.source / file).read_text())
            original = (root / HOST).read_text()
            for old, new in [('sides-y-scale) 13.0', 'unexpected-scale) 13.0'),
                             ('(* 350.0 (-> *display* time-adjust-ratio))', '(+ 350.0 (-> *display* time-adjust-ratio))'),
                             ('group-part-first-person-hud-selector self', 'group-unexpected self')]:
                assert old in original
                (root / HOST).write_text(original.replace(old, new))
                try:
                    extract_first_person_hud(root, parse, walk)
                except ValueError:
                    pass
                else:
                    raise AssertionError('Unsupported source mutation was accepted: ' + old)
        args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
        print(json.dumps({'callbackCases': len(result['samples']) * 3,
                          'hostFrames': sum(len(t['records']) for t in result['timelines'])}))
