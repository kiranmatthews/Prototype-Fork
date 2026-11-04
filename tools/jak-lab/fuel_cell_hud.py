"""Read the power-cell HUD's authored dimensions and host bindings."""
import hashlib

from particle_lighting import numeric

CLASSES = 'engine/ui/hud-classes.gc'
HUD = 'engine/ui/hud.gc'
SOURCES = (CLASSES, HUD, 'engine/ui/hud-h.gc', 'engine/gfx/hw/video.gc',
           'engine/gfx/hw/display.gc', 'engine/gfx/hw/display-h.gc', 'engine/gfx/math-camera.gc',
           'engine/gfx/sprite/sprite.gc', 'engine/draw/drawable.gc',
           'engine/common-obs/process-drawable.gc', 'engine/gfx/foreground/bones.gc')
CALLBACKS = ('fuel-cell-hud-orbit-callback', 'fuel-cell-hud-center-callback',
             'fuel-cell-hud-starburst-3-callback', 'fuel-cell-hud-starburst-4-callback')


def extract_fuel_cell_hud(source, parse, walk):
    if not (source / CLASSES).exists():
        return None
    texts = {file: (source / file).read_text() for file in SOURCES}
    forms = parse(texts[CLASSES])

    def unique(predicate, label):
        found = [f for f in forms if predicate(f)]
        if len(found) != 1:
            raise ValueError('Expected one power-cell HUD ' + label)
        return found[0]

    def method(name):
        return unique(lambda f: f[:3] == ['defmethod', name, [['this', 'hud-fuel-cell']]], name)

    scales = unique(
        lambda f: f[:2] == ['defmethod', 'set-pos-and-scale'] and
        f[2][0] == ['this', 'hud-fuel-cell'], 'size table')
    cond = scales[3]
    if cond[0] != 'cond' or [c[0] for c in cond[1:]] != ['arg0', 'else']:
        raise ValueError('Unsupported HUD aspect selection')
    profiles = []
    for name, clause in zip(('16:9', '4:3'), cond[1:]):
        values = {}
        for form in clause[1:]:
            if form[0] != 'set!' or form[1][:2] != ['->', 'this']:
                raise ValueError('Unsupported HUD scale assignment')
            values[form[1][2]] = numeric(form[2])
        profiles.append({'id': name, 'iconScale': values.pop('scale-icon'),
                         'centerScale': values.pop('scale-center'), 'iconY': values.pop('icon-pos-y'),
                         'starburst3': [values.pop('scale-starburst-3-x'), values.pop('scale-starburst-3-y')],
                         'starburst4': [values.pop('scale-starburst-4-x'), values.pop('scale-starburst-4-y')],
                         'source': {'file': CLASSES, 'line': clause.line}})
        if values:
            raise ValueError('Unconsumed HUD size fields')
    skel = unique(lambda f: f[:2] == ['defskelgroup', '*fuelcell-naked-sg*'], 'skeleton')
    init = unique(lambda f: f[:2] == ['defmethod', 'init-particles!'] and
                  f[2][0] == ['this', 'hud-fuel-cell'], 'initializer')
    spawn = [f for f in walk(init) if f[:1] == ['create-launch-control']]
    if spawn != [['create-launch-control', 'group-part-hud-power-cell-whole', 'this']]:
        raise ValueError('Power-cell group binding changed')
    callbacks = []
    for name in CALLBACKS:
        form = unique(lambda f: f[:2] == ['defun', name], name)
        callbacks.append({'name': name, 'source': {'file': CLASSES, 'line': form.line},
                          'formSha256': hashlib.sha256(repr(form).encode()).hexdigest()})
    update = method('hud-update')
    yaw = [f for f in walk(update) if f[:1] == ['set-yaw-angle-clear-roll-pitch!']]
    if len(yaw) != 1 or yaw[0][2][2] != ['*', 182.04445, ['/', ['->', '*display*', 'time-adjust-ratio'], 2]]:
        raise ValueError('Unsupported power-cell rotation clock')
    return {'group': spawn[0][1], 'model': skel[5][0][0].removesuffix('-mg'), 'clip': skel[4].removesuffix('-ja'),
            'profiles': profiles, 'yawStart': 16384, 'yawPerFrame': numeric(yaw[0][2][2][1]) / 2,
            'callbacks': callbacks,
            'sources': [{'file': file, 'sha256': hashlib.sha256(text.encode()).hexdigest()}
                        for file, text in texts.items()]}
