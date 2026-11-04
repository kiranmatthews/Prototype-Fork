"""Source evidence beyond named effect groups: direct launches and live patches."""
from __future__ import annotations

from collections import defaultdict
import hashlib
from host_replays import tracker_launch
from source_aliases import analyse, FUNCTIONS


def inventory(source, particles, groups, parse, walk):
    definitions = {p['id']: p for p in particles}
    callback_names = {f['value'] for p in particles for f in p['fields']
                      if f['field'] in ('func', 'birth-func') and f['op'] == 'value'
                      and isinstance(f.get('value'), str)}
    callbacks, launches, patches, group_uses, renderers, failures = [], [], [], [], [], []
    source_files, direct_ids = [], set()
    group_names = {g['name'] for g in groups}
    group_lookup = {g['name']: g for g in groups}
    tracker_launches = []

    def particle_references(form):
        references = []
        for f in walk([form]):
            values = [f[2]] if len(f) >= 3 and f[:2] == ['->', '*part-id-table*'] else []
            if id(f) in alias_references:
                values += sorted(alias_references[id(f)].particles)
            if id(f) in alias_launches:
                values += sorted(alias_launches[id(f)][0].particles)
            for value in values:
                if value not in references:
                    references.append(value)
        return references

    def callback_launch_references(form, root=True):
        if not isinstance(form, list) or not form:
            return set()
        head = form[0]
        if head in ('quote', 'quasiquote', 'defmacro') or (not root and isinstance(head, str) and head in FUNCTIONS):
            return set()
        resolution = alias_launches.get(id(form))
        references = set(resolution[0].particles) if resolution else set()
        for child in form:
            references.update(callback_launch_references(child, False))
        return references

    def function_name(form):
        if form[0] in ('defun', 'defun-debug', 'defbehavior'):
            return str(form[1])
        if form[0] == 'defmethod':
            args = form[2]
            owner = args[0][1] if isinstance(args, list) and args and isinstance(args[0], list) else args
            return f'{form[1]}:{owner}'
        if form[0] == 'defstate':
            return f'state:{form[1]}:{form[2][0]}'
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
        alias_launches, alias_references = analyse(forms)

        def visit(form, context=None):
            if not isinstance(form, list) or not form:
                return
            head = form[0]
            if head in ('quote', 'quasiquote', 'defmacro'):
                return
            if isinstance(head, str) and head in ('defun', 'defun-debug', 'defbehavior', 'defmethod', 'defstate'):
                context = function_name(form)
                if context in callback_names:
                    callbacks.append({'name': context, 'source': {'file': relative, 'line': form.line},
                                      'form': form, 'directParticleReferences': sorted(callback_launch_references(form))})
                # Candidates are evidence for a manual procedural-render audit,
                # not a claim that every draw method is a novel effect.
                if any(word in context.lower() for word in ('draw', 'render')):
                    renderers.append({'name': context, 'source': {'file': relative, 'line': form.line}})
            provenance = {'file': relative, 'line': form.line, 'function': context}
            tracker = tracker_launch(form, provenance, group_lookup)
            if tracker is not None:
                tracker_launches.append(tracker)
            if head in ('launch-particles', 'sp-launch-particles', 'sp-launch-particles-var',
                        'sp-launch-particles-death', 'sp-queue-launch'):
                resolution = alias_launches.get(id(form))
                references = sorted(resolution[0].particles) if resolution else []
                systems = sorted(s.removeprefix('*sp-particle-system-').removesuffix('*')
                                 for s in resolution[1].systems) if resolution else []
                direct_ids.update(i for i in references if isinstance(i, int))
                launches.append({'source': provenance, 'call': head, 'particles': references,
                                 'is3d': systems == ['3d'], 'systems': systems,
                                 'launcherResolved': bool(resolution and resolution[0].complete
                                                          and not resolution[0].systems and not resolution[0].other),
                                 'systemResolved': bool(resolution and resolution[1].complete and systems
                                                        and not resolution[1].particles and not resolution[1].other),
                                 'form': form})
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
    callback_edges = {c['name']: {i for i in c['directParticleReferences'] if isinstance(i, int)} for c in callbacks}
    for particle in particles:
        for field in particle['fields']:
            if field['field'] in ('func', 'birth-func') and isinstance(field.get('value'), str):
                edges[particle['id']].update(callback_edges.get(field['value'], set()))

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
        for particle_id in launch['particles']:
            if isinstance(particle_id, int):
                # Keep known possible systems distinct. An unknown host system
                # is not evidence for a made-up 2D standalone exhibit.
                for system in launch['systems']:
                    direct_sources[particle_id].append({'source': launch['source'], 'is3d': system == '3d'})
    standalones = [{'particle': id, 'source': definitions[id]['source'], 'launches': direct_sources[id],
                    'alsoInGroupGraph': id in group_reached}
                   for id in sorted(direct_ids & definitions.keys()) if definitions[id]['fields']]
    return {
        'sourceFiles': source_files, 'parseFailures': failures,
        'callbackDefinitions': callbacks, 'missingCallbackDefinitions': sorted(callback_names - {c['name'] for c in callbacks}),
        'directLaunches': launches, 'runtimeParticlePatches': patches, 'groupUses': group_uses,
        'partTrackerLaunches': tracker_launches,
        'proceduralRendererCandidates': renderers, 'standaloneParticles': standalones,
        'coverage': {
            'scannedSourceFiles': len(source_files), 'parseFailures': len(failures),
            'particlesInGroupGraph': len(group_reached), 'particlesOutsideGroupGraph': sorted(definitions.keys() - group_reached),
            'directLaunchSites': len(launches), 'directParticleRoots': len(direct_ids),
            'definedDirectParticleRoots': len(direct_ids & definitions.keys()),
            'emptyDirectParticleDefinitions': sorted(i for i in direct_ids & definitions.keys() if not definitions[i]['fields']),
            'unresolvedDirectLauncherSites': sum(not item['launcherResolved'] for item in launches),
            'unresolvedDirectSystemSites': sum(not item['systemResolved'] for item in launches),
            'runtimePatchSites': len(patches), 'callbackDefinitions': len(callbacks),
            'particlesOutsideGroupAndDirectGraphs': sorted(definitions.keys() - all_reached),
            'undefinedDirectParticleReferences': sorted(direct_ids - definitions.keys()),
            'proceduralRendererCandidates': len(renderers),
            'partTrackerLaunchSites': len(tracker_launches),
            'partTrackerReplaySites': sum('replay' in item for item in tracker_launches),
            'partTrackerReplayGroups': len({item['group'] for item in tracker_launches if 'replay' in item}),
        },
    }
