"""Read the original health, eco-power and scout-fly particle HUD hosts."""
import copy
import hashlib

from particle_lighting import numeric

CLASSES = 'engine/ui/hud-classes.gc'
SOURCES = (CLASSES, 'engine/ui/hud.gc', 'engine/ui/hud-h.gc',
           'engine/game/fact-h.gc', 'engine/gfx/hw/video.gc',
           'engine/gfx/sprite/sprite.gc', 'engine/gfx/math-camera.gc')
CALLBACKS = tuple('part-hud-health-0%d-func' % i for i in (1, 2, 3)) + (
    'part-hud-buzzer-func', 'part-hud-eco-timer-func', 'part-hud-eco-timer-backing-func',
    'part-hud-eco-timer-01-func', 'part-hud-eco-timer-02-func', 'part-hud-eco-timer-03-func')


def extract_screen_hud(source, parse, walk):
    if not (source / CLASSES).exists():
        return None
    texts = {file: (source / file).read_text() for file in SOURCES}
    forms = parse(texts[CLASSES])

    def unique(predicate, label):
        found = [f for f in forms if predicate(f)]
        if len(found) != 1:
            raise ValueError('Expected one source HUD ' + label)
        return found[0]

    def method(name, kind):
        return unique(lambda f: f[:2] == ['defmethod', name] and
                      f[2][0] == ['this', 'hud-' + kind], name + '/' + kind)

    entries = []
    for kind, title in (('health', 'Health meter'), ('power', 'Eco timer'), ('buzzers', 'Scout-fly HUD')):
        init = method('init-particles!', kind)
        layers = []
        for block in walk(init):
            if block[:1] != ['let'] or len(block[1]) != 1 or block[1][0][1] != ['->', 'this', 'nb-of-particles']:
                continue
            index = block[1][0][0]
            launches = [f for f in walk(block) if f[:1] == ['create-launch-control']]
            if len(launches) != 1 or launches[0][2:] != ['this']:
                raise ValueError('Unsupported HUD launch binding')
            position = {}
            for f in walk(block):
                if f[:1] == ['set!'] and f[1][:5] == ['->', 'this', 'particles', index, 'init-pos']:
                    position[f[1][5]] = numeric(f[2])
            if set(position) != set('xyz'):
                raise ValueError('Incomplete HUD layer placement')
            layers.append({'group': launches[0][1], 'position': [position[k] for k in 'xyz'],
                           'source': {'file': CLASSES, 'line': block.line}})
        signs = {}
        for f in init[3:]:
            if isinstance(f, list) and f[:1] == ['set!'] and f[1] in (['->', 'this', 'x-sgn'], ['->', 'this', 'y-sgn']):
                signs[f[1][2]] = numeric(f[2])
        if set(signs) != {'x-sgn', 'y-sgn'} or not layers:
            raise ValueError('Incomplete HUD host')
        sizes = method('set-pos-and-scale', kind)
        cond = sizes[3]
        if cond[0] != 'cond' or [c[0] for c in cond[1:]] != ['arg0', 'else']:
            raise ValueError('Unsupported HUD aspect selection')
        profiles = []
        for name, clause in zip(('16:9', '4:3'), cond[1:]):
            placed = copy.deepcopy(layers)
            scales = {}
            for f in clause[1:]:
                # Original console placement; PC arbitrary-aspect patches are
                # not part of these explicit 4:3/16:9 NTSC profiles.
                if f == 0 or f[:1] == ['with-pc']:
                    continue
                if f[0] != 'set!' or f[1][:2] != ['->', 'this']:
                    raise ValueError('Unsupported HUD size assignment')
                field = f[1][2:]
                if field[:1] == ['particles'] and field[2] == 'init-pos':
                    placed[field[1]]['position']['xyz'.index(field[3])] = numeric(f[2])
                elif len(field) == 1 and (field[0].startswith('scale') or field[0] == 'text-y-offset'):
                    scales[field[0]] = numeric(f[2])
                else:
                    raise ValueError('Unknown HUD size field ' + str(field))
            profiles.append({'id': name, 'layers': placed, 'scales': scales,
                             'source': {'file': CLASSES, 'line': clause.line}})
        entries.append({'id': kind, 'name': title, 'xSign': signs['x-sgn'], 'ySign': signs['y-sgn'],
                        'profiles': profiles, 'source': {'file': CLASSES, 'line': init.line}})
    callbacks = []
    for name in CALLBACKS + ('calculate-rotation-and-color-for-slice',):
        form = unique(lambda f: f[:2] == ['defun', name], name)
        callbacks.append({'name': name, 'source': {'file': CLASSES, 'line': form.line},
                          'formSha256': hashlib.sha256(repr(form).encode()).hexdigest()})
    facts = [f for f in parse(texts['engine/game/fact-h.gc']) if f[:2] == ['define', '*FACT-bank*']]
    bank = facts[0][2]
    timeout = bank[bank.index(':eco-full-timeout') + 1]
    if timeout[:1] != ['seconds'] or len(timeout) != 2:
        raise ValueError('Unsupported eco full timeout')
    return {'entries': entries, 'ecoFullTicks': numeric(timeout[1]) * 300, 'callbacks': callbacks,
            'sources': [{'file': file, 'sha256': hashlib.sha256(text.encode()).hexdigest()}
                        for file, text in texts.items()]}
