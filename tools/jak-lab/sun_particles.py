"""Extract the actual sun orbits and host visibility predicates, with provenance."""
import hashlib

from particle_lighting import numeric

SKY = 'engine/gfx/sky/sky.gc'
TIME = 'engine/gfx/mood/time-of-day.gc'
SOURCES = (SKY, TIME, 'engine/gfx/sky/sky-utils.gc', 'engine/gfx/sky/sky-tng.gc',
           'engine/gfx/mood/weather-part.gc', 'engine/math/trigonometry.gc')


def hour_predicate(form):
    """Accept source comparisons only, retaining strict/inclusive boundaries."""
    if not isinstance(form, list) or len(form) < 3:
        raise ValueError('Invalid sun visibility predicate')
    if form[0] in ('and', 'or'):
        return {'op': form[0], 'terms': [hour_predicate(part) for part in form[1:]]}
    if form[0] not in ('<', '<=', '>', '>=') or len(form) != 3:
        raise ValueError('Unsupported sun hour comparison')
    hour = ['->', 'self', 'time-of-day']
    if form[1] == hour:
        op, threshold = form[0], numeric(form[2])
    elif form[2] == hour:
        op, threshold = {'<': '>', '<=': '>=', '>': '<', '>=': '<='}[form[0]], numeric(form[1])
    else:
        raise ValueError('Sun visibility does not compare the source hour')
    return {'op': op, 'hour': threshold}


def extract_sun_particles(source, parse, walk):
    if not (source / SKY).exists():
        return None
    texts = {file: (source / file).read_text() for file in SOURCES}
    orbits = []
    for form in parse(texts[SKY]):
        if form[0] != 'sky-set-orbit':
            continue
        if len(form) != 9 or form[1] != '*sky-parms*':
            raise ValueError('Unsupported source sky orbit')
        slot, noon, tilt, rise, distance, *_ = map(numeric, form[2:])
        orbits.append({'slot': slot, 'highNoon': noon, 'tilt': tilt, 'rise': rise, 'distance': distance,
                       'source': {'file': SKY, 'line': form.line}})
    if [o['slot'] for o in orbits] != [0, 1, 2]:
        raise ValueError('Expected both source suns and the moon orbit')
    forms = parse(texts[TIME])
    functions = [f for f in forms if len(f) > 3 and f[:2] == ['defbehavior', 'time-of-day-update']]
    if len(functions) != 1:
        raise ValueError('Missing source sky host update')
    hosts = []
    for host, group, orbit in [('sun', 'group-sun', 0), ('green-sun', 'group-green-sun', 1)]:
        clauses = [f for f in walk(functions[0][4:]) if f and f[0] == 'cond' and
                   any(c == ['spawn', ['->', 'self', host], ['math-camera-pos']] for c in walk(f[1]))]
        if len(clauses) != 1:
            raise ValueError(f'Missing unique {host} spawn lifecycle')
        condition = clauses[0][1][0]
        fade = ['!=', ['->', '*time-of-day-context*', 'sun-fade'], 0.0]
        if condition[0] != 'and' or condition[-1] != fade:
            raise ValueError('Unsupported sun fade gate')
        hours = condition[1:-1]
        predicate = hour_predicate(hours[0] if len(hours) == 1 else ['and', *hours])
        kills = [c for c in walk(clauses[0][2:]) if c == ['kill-and-free-particles', ['->', 'self', host]]]
        bindings = [c for c in walk(forms) if c == ['set!', ['->', 'self', host], ['create-launch-control', group, 'self']]]
        if len(kills) != 1 or len(bindings) != 1:
            raise ValueError('Unproven sun group binding/cleanup')
        hosts.append({'group': group, 'orbit': orbit, 'hours': predicate,
                      'source': {'file': TIME, 'line': clauses[0].line}})
    return {'orbits': orbits, 'hosts': hosts,
            'sources': [{'file': file, 'sha256': hashlib.sha256(text.encode()).hexdigest()} for file, text in texts.items()]}
