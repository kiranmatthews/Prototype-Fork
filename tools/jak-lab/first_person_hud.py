"""Recover the original first-person particle HUD, including its host rates."""
import copy
import hashlib

from particle_lighting import numeric

HOST = 'engine/target/target2.gc'
SOURCES = (HOST, 'engine/target/target-part.gc', 'engine/ui/hud-h.gc',
           'engine/gfx/hw/video.gc', 'engine/gfx/sprite/sprite.gc', 'engine/gfx/math-camera.gc')
CALLBACKS = tuple('part-first-person-hud-' + part + '-func' for part in ('left', 'right', 'selector'))


def extract_first_person_hud(source, parse, walk):
    if not (source / HOST).exists():
        return None
    texts = {file: (source / file).read_text() for file in SOURCES}
    forms = parse(texts[HOST])

    def unique(predicate, label):
        found = [f for f in forms if predicate(f)]
        if len(found) != 1:
            raise ValueError('Expected one first-person HUD ' + label)
        return found[0]

    init = unique(lambda f: f[:3] == ['defbehavior', 'first-person-hud-init-by-other', 'first-person-hud'], 'initializer')
    layers = []
    for block in walk(init):
        if block[:1] != ['let'] or len(block[1]) != 1 or block[1][0][1] != ['->', 'self', 'nb-of-particles']:
            continue
        index = block[1][0][0]
        launches = [f for f in walk(block) if f[:1] == ['create-launch-control']]
        if len(launches) != 1 or launches[0][2:] != ['self']:
            raise ValueError('Unsupported first-person HUD launch binding')
        position = {}
        for f in walk(block):
            if f[:1] == ['set!'] and f[1][:5] == ['->', 'self', 'particles', index, 'init-pos']:
                position[f[1][5]] = numeric(f[2])
        if set(position) != set('xyz'):
            raise ValueError('Incomplete first-person HUD placement')
        layers.append({'group': launches[0][1], 'position': [position[k] for k in 'xyz'],
                       'source': {'file': HOST, 'line': block.line}})
    expected = ['group-part-first-person-hud-' + part for part in ('left', 'right', 'selector')]
    if [layer['group'] for layer in layers] != expected:
        raise ValueError('Unexpected first-person HUD layer order')
    aspect = [f for f in walk(init) if f[:2] == ['case', ['get-aspect-ratio']]]
    if len(aspect) != 1:
        raise ValueError('Missing first-person HUD display profiles')
    profiles = []
    for name, key in (('4:3', 'aspect4x3'), ('16:9', 'aspect16x9')):
        clauses = [c for c in aspect[0][2:] if c[0] == [['quote', key]]]
        if len(clauses) != 1:
            raise ValueError('Missing original HUD aspect ' + key)
        scales = {}
        for f in clauses[0][1:]:
            if f == 0:
                continue
            if f[:1] != ['set!'] or f[1][:2] != ['->', 'self'] or len(f[1]) != 3:
                raise ValueError('Unsupported first-person HUD scale assignment')
            scales[f[1][2]] = numeric(f[2])
        if set(scales) != {'sides-x-scale', 'sides-y-scale', 'x-offset'}:
            raise ValueError('Incomplete first-person HUD display scale')
        profiles.append({'id': name, 'layers': copy.deepcopy(layers), 'scales': scales,
                         'source': {'file': HOST, 'line': clauses[0].line}})
    initial = [f[2] for f in init[4:] if isinstance(f, list) and f[:2] == ['set!', ['->', 'self', 'in-out-position']]]
    if len(initial) != 1:
        raise ValueError('Missing first-person HUD initial offset')
    maximum = numeric(initial[0])
    rates = {}
    for state, keys in (('hud-coming-in', ('arrival',)), ('hud-going-out', ('departure',)),
                        ('hud-normal', ('restore', 'suppress'))):
        form = unique(lambda f: f[:3] == ['defstate', state, ['first-person-hud']], state)
        seeks = [f for f in walk(form) if f[:1] == ['seekl!']]
        if len(seeks) != len(keys):
            raise ValueError('Unexpected first-person HUD state rates')
        for key, seek in zip(keys, seeks):
            expected_target = maximum if key in ('departure', 'suppress') else 0
            rate = seek[3]
            if seek[1:3] != [['->', 'self', 'in-out-position'], expected_target] or rate[:2] != ['the', 'int'] or \
                    rate[2][:1] != ['*'] or rate[2][2] != ['->', '*display*', 'time-adjust-ratio']:
                raise ValueError('Unsupported first-person HUD rate expression')
            rates[key] = numeric(rate[2][1])
    callbacks = []
    for name in CALLBACKS:
        form = unique(lambda f: f[:2] == ['defun', name], name)
        callbacks.append({'name': name, 'source': {'file': HOST, 'line': form.line},
                          'formSha256': hashlib.sha256(repr(form).encode()).hexdigest()})
    return {'id': 'first-person', 'name': 'First-person overlay', 'xSign': 0, 'ySign': 0,
            'profiles': profiles, 'maximumOffset': maximum, 'rates': rates,
            'source': {'file': HOST, 'line': init.line}, 'callbacks': callbacks,
            'sources': [{'file': file, 'sha256': hashlib.sha256(text.encode()).hexdigest()}
                        for file, text in texts.items()]}
