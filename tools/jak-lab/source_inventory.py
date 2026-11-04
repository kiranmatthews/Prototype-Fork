"""Source evidence beyond named effect groups: direct launches and live patches."""
from __future__ import annotations

from collections import defaultdict
import hashlib


def inventory(source, particles, groups, parse, walk):
    definitions = {p['id']: p for p in particles}
    callback_names = {f['value'] for p in particles for f in p['fields']
                      if f['field'] in ('func', 'birth-func') and f['op'] == 'value'
                      and isinstance(f.get('value'), str)}
    callbacks, launches, patches, group_uses, renderers, failures = [], [], [], [], [], []
    source_files, direct_ids = [], set()
    group_names = {g['name'] for g in groups}

    def particle_references(form):
        return [f[2] for f in walk([form]) if len(f) >= 3 and f[:2] == ['->', '*part-id-table*']]

    def function_name(form):
        if form[0] in ('defun', 'defun-debug', 'defbehavior'):
            return str(form[1])
        if form[0] == 'defmethod':
            args = form[2]
            owner = args[0][1] if isinstance(args, list) and args and isinstance(args[0], list) else args
            return f'{form[1]}:{owner}'
        return None

    for path in sorted(source.rglob('*.gc')):
        text = path.read_text()
        relative = str(path.relative_to(source))
        source_files.append({'file': relative, 'sha256': hashlib.sha256(text.encode()).hexdigest()})
        try:
            forms = parse(text)
        except (ValueError, StopIteration, RecursionError) as error:
            failures.append({'file': relative, 'error': str(error)})
            continue

        def visit(form, context=None):
            if not isinstance(form, list) or not form:
                return
            head = form[0]
            if isinstance(head, str) and head in ('defun', 'defun-debug', 'defbehavior', 'defmethod'):
                context = function_name(form)
                if context in callback_names:
                    callbacks.append({'name': context, 'source': {'file': relative, 'line': form.line},
                                      'form': form, 'directParticleReferences': particle_references(form)})
                # Candidates are evidence for a manual procedural-render audit,
                # not a claim that every draw method is a novel effect.
                if any(word in context.lower() for word in ('draw', 'render')):
                    renderers.append({'name': context, 'source': {'file': relative, 'line': form.line}})
            provenance = {'file': relative, 'line': form.line, 'function': context}
            if head in ('launch-particles', 'sp-launch-particles', 'sp-launch-particles-var',
                        'sp-launch-particles-death', 'sp-queue-launch'):
                references = particle_references(form)
                direct_ids.update(i for i in references if isinstance(i, int))
                launches.append({'source': provenance, 'call': head, 'particles': references,
                                 'is3d': '*sp-particle-system-3d*' in form, 'form': form})
            if head in ('set!', '+!', '-!', '*!', '/!', 'logior!', 'logclear!') and len(form) > 2:
                references = particle_references(form[1]) if isinstance(form[1], list) else []
                if references:
                    patches.append({'source': provenance, 'particles': references, 'form': form})
            if context:
                names = sorted({item for item in form if isinstance(item, str) and item in group_names})
                if names:
                    group_uses.append({'source': provenance, 'groups': names, 'call': head if isinstance(head, str) else None})
            for child in form:
                if isinstance(child, list):
                    visit(child, context)
        for form in forms:
            visit(form)

    roots = {item['particle'] for group in groups for item in group['items']}
    edges = {p['id']: {int(f['base']) for f in p['fields'] if f['field'] == 'next-launcher'} for p in particles}

    def reachable(roots):
        seen = set(roots)
        todo = list(roots)
        while todo:
            for child in edges.get(todo.pop(), set()) - seen:
                seen.add(child)
                todo.append(child)
        return seen & definitions.keys()

    group_reached = reachable(roots)
    all_reached = reachable(roots | direct_ids)
    direct_sources = defaultdict(list)
    for launch in launches:
        for id in launch['particles']:
            if isinstance(id, int):
                direct_sources[id].append({'source': launch['source'], 'is3d': launch['is3d']})
    standalones = [{'particle': id, 'source': definitions[id]['source'], 'launches': direct_sources[id],
                    'alsoInGroupGraph': id in group_reached}
                   for id in sorted(direct_ids & definitions.keys())]
    return {
        'sourceFiles': source_files, 'parseFailures': failures,
        'callbackDefinitions': callbacks, 'missingCallbackDefinitions': sorted(callback_names - {c['name'] for c in callbacks}),
        'directLaunches': launches, 'runtimeParticlePatches': patches, 'groupUses': group_uses,
        'proceduralRendererCandidates': renderers, 'standaloneParticles': standalones,
        'coverage': {
            'scannedSourceFiles': len(source_files), 'parseFailures': len(failures),
            'particlesInGroupGraph': len(group_reached), 'particlesOutsideGroupGraph': sorted(definitions.keys() - group_reached),
            'directLaunchSites': len(launches), 'directParticleRoots': len(direct_ids),
            'runtimePatchSites': len(patches), 'callbackDefinitions': len(callbacks),
            'particlesOutsideGroupAndDirectGraphs': sorted(definitions.keys() - all_reached),
            'undefinedDirectParticleReferences': sorted(direct_ids - definitions.keys()),
            'proceduralRendererCandidates': len(renderers),
        },
    }
