"""Conservative local value flow for particle launcher/source-system evidence.

This is a source inventory, not a GOAL interpreter. Unknown calls/addresses stay
unknown; branches contribute only their return values, never every table lookup
in their bodies. Mutated loop-carried locals are deliberately not guessed.
"""
from dataclasses import dataclass


UNKNOWN = object()
LAUNCH_CALLS = {'launch-particles', 'sp-launch-particles', 'sp-launch-particles-var',
                'sp-launch-particles-death', 'sp-queue-launch'}
FUNCTIONS = {'defun', 'defun-debug', 'defbehavior', 'defmethod', 'defstate'}


@dataclass(frozen=True)
class Value:
    particles: frozenset = frozenset()
    systems: frozenset = frozenset()
    constant: object = UNKNOWN
    complete: bool = False
    other: bool = False
    integers: frozenset = frozenset()
    integer_only: bool = False


def union(values):
    values = list(values)
    if not values:
        return Value(constant='#f', complete=True)
    constant = values[0].constant
    return Value(particles=frozenset().union(*(v.particles for v in values)),
                 systems=frozenset().union(*(v.systems for v in values)),
                 constant=constant if all(v.constant == constant for v in values) else UNKNOWN,
                 complete=all(v.complete for v in values), other=any(v.other for v in values),
                 integers=frozenset().union(*(v.integers for v in values)),
                 integer_only=all(v.integer_only for v in values))


def launch_arguments(form):
    if form[0] != 'launch-particles':
        return (form[2], form[1]) if len(form) > 2 else (None, None)
    positional, system, i = [], '*sp-particle-system-2d*', 1
    while i < len(form):
        arg = form[i]
        if isinstance(arg, str) and arg.startswith(':'):
            if i + 1 >= len(form):
                return None, None
            if arg == ':system':
                system = form[i + 1]
            i += 2
        else:
            positional.append(arg)
            i += 1
    return (positional[0] if positional else None), system


def analyse(forms):
    """Return launch/dereference observations keyed by identity of parsed forms."""
    launches, dereferences = {}, {}

    def remember(table, key, value):
        table[key] = union([table[key], value]) if key in table else value

    def merge_env(target, branches):
        for name in target:
            target[name] = union(branch.get(name, Value()) for branch in branches)

    def sequence(body, env):
        result = Value(constant='#f', complete=True)
        for form in body:
            result = evaluate(form, env)
        return result

    def mutations(form):
        # Invalidating a shadowed name too is conservative: it loses evidence,
        # but cannot invent a launcher used by an arbitrary loop iteration.
        if not isinstance(form, list) or not form or form[0] in ('quote', 'quasiquote'):
            return set()
        names = {form[1]} if (isinstance(form[0], str) and form[0].endswith('!')
                             and len(form) > 1 and isinstance(form[1], str)) else set()
        return names.union(*(mutations(child) for child in form if isinstance(child, list)))

    def branches(forms, env):
        results, states = [], []
        for body in forms:
            state = dict(env)
            results.append(sequence(body, state))
            states.append(state)
        merge_env(env, states)
        return union(results)

    def evaluate(form, env):
        if isinstance(form, (int, float)):
            return Value(constant=form, complete=True, other=form != 0,
                         integers=frozenset([form]) if type(form) is int else frozenset(),
                         integer_only=type(form) is int)
        if isinstance(form, str):
            if form in env:
                return env[form]
            if form in ('*sp-particle-system-2d*', '*sp-particle-system-3d*'):
                return Value(systems=frozenset([form]), complete=True)
            if form in ('#f', '#t'):
                return Value(constant=form, complete=True, other=form == '#t')
            return Value()
        if not isinstance(form, list) or not form:
            return Value()
        head = form[0]
        if not isinstance(head, str):
            sequence(form, env)
            return Value()
        if head in ('quote', 'quasiquote', 'defmacro'):
            return Value()
        if head in FUNCTIONS:
            # Named functions have no caller-local bindings. Inventory visits
            # nested behavior bodies, whose explicit arguments shadow locals.
            sequence(form[2:], {})
            return Value()
        if head in ('behavior', 'lambda') and len(form) > 1:
            scope = dict(env)
            if isinstance(form[1], list):
                for arg in form[1]:
                    name = arg[0] if isinstance(arg, list) and arg else arg
                    if isinstance(name, str):
                        scope[name] = Value()
            return sequence(form[2:], scope)
        if head in ('let', 'let*') and len(form) > 1 and isinstance(form[1], list):
            scope, names = dict(env), set()
            for binding in form[1]:
                if not isinstance(binding, list) or not binding or not isinstance(binding[0], str):
                    continue
                name = binding[0]
                value = evaluate(binding[1], scope if head == 'let*' else env) if len(binding) > 1 else Value()
                names.add(name)
                scope[name] = value
            # Parallel-let initializer side effects affect non-shadowed locals.
            if head == 'let':
                scope.update({name: value for name, value in env.items() if name not in names})
            result = sequence(form[2:], scope)
            env.update({name: scope[name] for name in env if name not in names})
            return result
        if head in ('begin', 'progn'):
            return sequence(form[1:], env)
        if head == 'local-vars':
            for binding in form[1:]:
                if isinstance(binding, list) and binding and isinstance(binding[0], str):
                    env[binding[0]] = Value()
            return Value()
        if head == 'set!' and len(form) == 3:
            evaluate(form[1], env)
            value = evaluate(form[2], env)
            if isinstance(form[1], str):
                env[form[1]] = value
            return value
        if head in ('the', 'the-as') and len(form) == 3:
            return evaluate(form[2], env)
        if head == 'if' and len(form) >= 3:
            test = evaluate(form[1], env)
            choices = [[form[2]], form[3:4] or ['#f']]
            if test.constant == '#f':
                choices = choices[1:]
            elif test.constant == '#t':
                choices = choices[:1]
            return branches(choices, env)
        if head in ('when', 'unless') and len(form) >= 2:
            evaluate(form[1], env)
            return branches([form[2:], ['#f']], env)
        if head == 'cond':
            choices, fallthrough = [], dict(env)
            has_else = False
            for clause in form[1:]:
                if not isinstance(clause, list) or not clause:
                    continue
                test = evaluate(clause[0], fallthrough)
                if test.constant == '#f':
                    continue
                # Preserve test side effects without treating test results or
                # unrelated body lookups as a returned particle launcher.
                choices.append((clause[1:], dict(fallthrough)))
                if clause[0] == 'else' or test.constant == '#t':
                    has_else = True
                    break
            if not has_else:
                choices.append((['#f'], fallthrough))
            values = [sequence(body, state) for body, state in choices]
            merge_env(env, [state for _, state in choices])
            return union(values)
        if head == 'case' and len(form) >= 2:
            evaluate(form[1], env)
            choices = [clause[1:] for clause in form[2:] if isinstance(clause, list) and clause]
            if not any(isinstance(c, list) and c and c[0] == 'else' for c in form[2:]):
                choices.append(['#f'])
            return branches(choices, env)
        if head in ('and', 'or'):
            # Short-circuit expressions may assign a later-read local.
            states, state = [dict(env)], dict(env)
            for item in form[1:]:
                evaluate(item, state)
                states.append(dict(state))
            merge_env(env, states)
            return Value()
        if head in ('loop', 'while', 'until', 'dotimes', 'dolist'):
            written = mutations(form)
            for name in written & env.keys():
                env[name] = Value()
            scope = dict(env)
            body = form[1:]
            if head in ('dotimes', 'dolist') and len(form) > 1 and isinstance(form[1], list):
                if form[1] and isinstance(form[1][0], str):
                    scope[form[1][0]] = Value()
                sequence(form[1][1:], scope)
                body = form[2:]
            sequence(body, scope)
            for name in written & env.keys():
                env[name] = Value()
            return Value()
        if head == '->' and len(form) >= 3:
            if form[1] == '*part-id-table*':
                index = evaluate(form[2], env)
                reference = Value(particles=index.integers, complete=index.complete and index.integer_only)
            else:
                reference = evaluate(form[1], env)
            if reference.particles:
                remember(dereferences, id(form), reference)
            sequence(form[2:], env)
            return reference if form[1] == '*part-id-table*' and len(form) == 3 else Value()
        if head in LAUNCH_CALLS:
            launcher, system = launch_arguments(form)
            particle_value, system_value = None, None
            for argument in form[1:]:
                value = evaluate(argument, env)
                if argument is launcher and particle_value is None:
                    particle_value = value
                if argument is system and system_value is None:
                    system_value = value
            particle_value = particle_value or Value()
            system_value = system_value or evaluate(system, env)
            previous = launches.get(id(form))
            if previous:
                particle_value = union([previous[0], particle_value])
                system_value = union([previous[1], system_value])
            launches[id(form)] = particle_value, system_value
            return Value()
        sequence(form[1:], env)
        if head.endswith('!') and len(form) > 1 and isinstance(form[1], str) and form[1] in env:
            env[form[1]] = Value()
        return Value()

    sequence(forms, {})
    return launches, dereferences
