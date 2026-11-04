"""Extract immutable particle-lighting tables and their actual source selectors.

This is base palette data, not a reconstruction of local flashes, quest state,
camera/zone blending, or mutations made by the area's mood callback.
"""
from __future__ import annotations

import hashlib
import math


TABLES = 'engine/gfx/mood/mood-tables.gc'
RUNTIME = 'engine/gfx/mood/mood.gc'
LEVELS = 'engine/level/level-info.gc'


def unquote(value):
    return value[1] if isinstance(value, list) and len(value) == 2 and value[0] == 'quote' else value


def properties(form):
    if len(form) < 3 or form[0] != 'new' or (len(form) - 3) % 2:
        raise ValueError(f'Invalid static lighting structure: {form}')
    result = {}
    for i in range(3, len(form), 2):
        if not isinstance(form[i], str) or not form[i].startswith(':') or form[i] in result:
            raise ValueError(f'Invalid/duplicate lighting property: {form[i]}')
        result[form[i]] = form[i + 1]
    return result


def numeric(value):
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError(f'Nonliteral lighting value: {value}')
    return value


def vector(form):
    if form is None:
        return [0, 0, 0, 0]
    if unquote(form[2]) != 'vector':
        raise ValueError('Expected a source vector')
    fields = properties(form)
    if set(fields) - {':x', ':y', ':z', ':w'}:
        raise ValueError('Unknown source vector fields')
    return [numeric(fields.get(':' + axis, 0)) for axis in 'xyzw']


def array(form, kind, count):
    if not isinstance(form, list) or form[:3] != ['new', ['quote', 'static'], ['quote', 'inline-array']] or form[3:5] != [kind, count] or len(form) != 5 + count:
        raise ValueError(f'Expected all {count} entries of {kind}')
    if any(unquote(row[2]) != kind for row in form[5:]):
        raise ValueError(f'Unexpected entry in {kind}')
    return form[5:]


def extract_particle_lighting(source, parse, walk):
    # Small inventory fixtures do not contain engine tables. Real builds do.
    if not (source / TABLES).exists():
        return None
    texts = {name: (source / name).read_text() for name in (TABLES, RUNTIME, LEVELS)}
    forms = {name: parse(text) for name, text in texts.items()}
    provenance = lambda file, form: {'file': file, 'line': form.line}
    lights, palettes, contexts = {}, {}, {}
    for form in forms[TABLES]:
        if len(form) != 3 or form[0] != 'define' or not isinstance(form[2], list) or form[2][0] != 'new':
            continue
        symbol, value = form[1:]
        kind = unquote(value[2])
        if kind == 'mood-lights-table':
            rows = array(properties(value)[':data'], 'mood-lights', 8)
            lights[symbol] = {'id': symbol, 'source': provenance(TABLES, form), 'snapshots': [
                {'source': provenance(TABLES, row), **{name: vector(properties(row).get(key)) for name, key in
                 [('particle', ':prt-color'), ('ambient', ':amb-color'), ('light', ':lgt-color')]}}
                for row in rows]}
        elif kind == 'sky-color-day':
            rows = array(properties(value)[':hour'], 'sky-color-hour', 24)
            hours = []
            for row in rows:
                fields = properties(row)
                values = {key: numeric(fields.get(':' + key, 0)) for key in
                          ('snapshot1', 'snapshot2', 'morph-start', 'morph-end')}
                if any(type(values[k]) is not int or not 0 <= values[k] < 8 for k in ('snapshot1', 'snapshot2')):
                    raise ValueError('Invalid source snapshot index')
                if any(not 0 <= values[k] <= 1 for k in ('morph-start', 'morph-end')):
                    raise ValueError('Invalid source morph range')
                hours.append(values)
            palettes[symbol] = {'id': symbol, 'source': provenance(TABLES, form), 'hours': hours}
        elif kind == 'mood-context':
            contexts[symbol] = {'id': symbol.strip('*').removesuffix('-mood'),
                                'source': provenance(TABLES, form), 'levels': [], 'presets': []}
    for form in forms[TABLES]:
        if len(form) == 3 and form[0] == 'set!' and isinstance(form[1], list) and len(form[1]) == 3 and form[1][0] == '->':
            symbol, field = form[1][1:]
            if symbol in contexts and field in ('mood-lights-table', 'palette-interp'):
                contexts[symbol][{'mood-lights-table': 'lights', 'palette-interp': 'palette'}[field]] = form[2]
    functions = {f[1]: f for f in forms[RUNTIME] if len(f) >= 4 and f[0] == 'defun'}
    owners = {'*default-mood*': {'update-mood-default'}}
    for form in forms[LEVELS]:
        if len(form) != 3 or form[0] != 'define' or not isinstance(form[2], list) or len(form[2]) < 3 or unquote(form[2][2]) != 'level-load-info':
            continue
        fields = properties(form[2])
        context = unquote(fields.get(':mood'))
        if context in contexts:
            contexts[context]['levels'].append(unquote(fields[':name']))
            owners.setdefault(context, set()).add(unquote(fields[':mood-func']))
    for symbol, context in contexts.items():
        if context.get('lights') not in lights or context.get('palette') not in palettes:
            raise ValueError(f'Missing source lighting table: {symbol}')
        # A real callback can choose both day-cycle and fixed snapshots. Keep
        # every selector, but do not invent its gameplay condition in the lab.
        choices = {}
        for name, function in functions.items():
            for call in walk(function[3:]):
                if len(call) < 2 or call[0] not in ('update-mood-palette', 'update-mood-quick'):
                    continue
                if call[1] != symbol and not (call[1] == 'arg0' and name in owners.get(symbol, set())):
                    continue
                if call[0] == 'update-mood-palette':
                    kind, snapshot = 'cycle', None
                else:
                    snapshot = numeric(call[4])
                    if type(snapshot) is not int or not 0 <= snapshot < 8:
                        raise ValueError('Computed quick lighting selector is not supported')
                    kind = 'snapshot'
                key = (kind, snapshot)
                choices.setdefault(key, {'kind': kind, 'snapshot': snapshot, 'source': provenance(RUNTIME, call), 'function': name})
        context['presets'] = list(choices.values())
        if not context['presets']:
            raise ValueError(f'No proven lighting selector for {symbol}')
    return {'sources': [{'file': name, 'sha256': hashlib.sha256(text.encode()).hexdigest()} for name, text in texts.items()],
            'lightTables': list(lights.values()), 'palettes': list(palettes.values()), 'contexts': list(contexts.values())}
