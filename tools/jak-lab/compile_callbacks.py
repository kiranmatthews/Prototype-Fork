"""Compile source height-contact callbacks; reject unrecognized semantics.

This is deliberately not a general GOAL interpreter. The emitted actions retain
source ordering, contact tests, coordinates, particle system and sound draws.
"""
from __future__ import annotations

import hashlib
import json


class UnsupportedCallback(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise UnsupportedCallback(message)


def compile_contact(callback):
    form = callback['form']
    require(form[:2] == ['defun', callback['name']], 'Not a function definition')
    require(form[2] == [['arg0', 'sparticle-system'], ['arg1', 'sparticle-cpuinfo'],
                        ['arg2', 'vector']], 'Different callback arguments')
    body = [f for f in form[3:] if f != 0 and f != ['none']]
    require(len(body) == 1 and body[0][0] in ('when', 'if'), 'Different contact control flow')
    branch = body[0]
    if branch[0] == 'if':
        require(len(branch) == 3, 'Contact has an else branch')
    condition = branch[1]
    descending = False
    if condition[0] == 'and':
        require(len(condition) == 3 and condition[2] == ['<', ['->', 'arg1', 'vel-sxvel', 'y'], 0],
                'Different velocity condition')
        condition, descending = condition[1], True
    require(condition[0] in ('<', '>=') and condition[1:] == [
        ['->', 'arg2', 'y'], ['->', 'arg1', 'user-float']], 'Different height condition')
    actions, vectors = [], {}
    allocation = ['new', ['quote', 'stack-no-clear'], ['quote', 'vector']]

    def point(name):
        require(isinstance(name, str) and name in vectors, 'Unknown position vector')
        coords = vectors[name]
        require(coords.get('x') == ['->', 'arg2', 'x'] and coords.get('z') == ['->', 'arg2', 'z']
                and coords.get('w') == 1, 'Different contact position')
        require(coords.get('y') in (['->', 'arg2', 'y'], ['->', 'arg1', 'user-float']),
                'Different contact height')
        return 'surface' if coords['y'] == ['->', 'arg1', 'user-float'] else 'particle'

    def visit(node, chance=None):
        if node == allocation or node == 0 or node == ['none']:
            return
        if isinstance(node, str) and node in vectors:
            return  # Returning an otherwise unused local vector has no effect.
        require(isinstance(node, list) and node, 'Unknown callback expression')
        op = node[0]
        if op == 'let':
            require(chance is None, 'Conditional scope')
            for name, value in node[1]:
                require(value == allocation and name not in vectors, 'Different local allocation')
                vectors[name] = {}
            for child in node[2:]:
                visit(child)
        elif op == 'sp-kill-particle':
            require(node == ['sp-kill-particle', 'arg0', 'arg1'] and chance is None, 'Different kill')
            actions.append({'op': 'kill'})
        elif op == 'set-vector!':
            require(len(node) == 6 and node[1] in vectors and chance is None, 'Different vector assignment')
            vectors[node[1]] = dict(zip('xyzw', node[2:]))
            point(node[1])
        elif op == 'set!':
            target = node[1]
            require(len(node) == 3 and isinstance(target, list) and len(target) == 3
                    and target[0] == '->' and target[1] in vectors and target[2] in 'xyzw'
                    and chance is None, 'Different field assignment')
            expected = 1 if target[2] == 'w' else ['->', 'arg2', target[2]]
            require(node[2] == expected or target[2] == 'y' and node[2] == ['->', 'arg1', 'user-float'],
                    'Different coordinate expression')
            vectors[target[1]][target[2]] = node[2]
        elif op == 'if':
            require(chance is None and len(node) == 3 and len(node[1]) == 3
                    and node[1][:2] == ['<', ['rand-float-gen']] and isinstance(node[1][2], (int, float))
                    and 0 <= node[1][2] <= 1 and node[2][0] == 'sound-play', 'Different random branch')
            visit(node[2], node[1][2])
        elif op == 'sound-play':
            require(len(node) in (2, 4) and isinstance(node[1], str) and node[1].startswith('"'),
                    'Different sound expression')
            action = {'op': 'sound', 'name': json.loads(node[1])}
            if chance is not None:
                action['chance'] = chance
            if len(node) == 4:
                require(node[2] == ':position' and node[3][:2] == ['the-as', 'symbol'],
                        'Different positioned sound')
                action['height'] = point(node[3][2])
            actions.append(action)
        elif op == 'launch-particles':
            require(chance is None, 'Conditional particle launch')
            args = list(node[1:])
            is3d = args[:2] == [':system', '*sp-particle-system-3d*']
            if is3d:
                args = args[2:]
            require(len(args) in (2, 4), 'Different launch arguments')
            reference = args[0]
            require(isinstance(reference, list) and reference[:2] == ['->', '*part-id-table*']
                    and len(reference) == 3 and isinstance(reference[2], int), 'Dynamic particle reference')
            if len(args) == 4:
                require(args[2] == ':rate' and (args[3] == 1 or args[3] == ['the-as', 'float', 1]),
                        'Different launch rate')
            actions.append({'op': 'launch', 'particle': reference[2], 'is3d': is3d, 'height': point(args[1])})
        else:
            raise UnsupportedCallback(f'Unknown operation: {op}')

    for node in branch[2:]:
        visit(node)
    require(sum(a['op'] == 'kill' for a in actions) == 1, 'Must kill exactly once on contact')
    return {'kind': 'height-contact', 'comparison': 'below' if condition[0] == '<' else 'at-or-above',
            'descending': descending, 'actions': actions, 'source': callback['source'],
            'formSha256': hashlib.sha256(json.dumps(form, separators=(',', ':')).encode()).hexdigest()}


def compile_callbacks(definitions):
    programs, unsupported = {}, []
    for callback in definitions:
        if not callback['name'].startswith(('check-drop-level-', 'check-water-level-')):
            continue
        try:
            programs[callback['name']] = compile_contact(callback)
        except (UnsupportedCallback, IndexError, KeyError, TypeError) as error:
            unsupported.append({'name': callback['name'], 'source': callback['source'], 'reason': str(error)})
    return programs, unsupported
