#!/usr/bin/env python3
"""Inventory the complete local Jak 1 source and OpenGOAL asset export.

The output contains game-derived data and belongs outside public/ and Git.
No network requests, game downloads, or changes to the input project occur.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import struct

from source_inventory import inventory
from compile_callbacks import compile_callbacks
from particle_lighting import extract_particle_lighting
from sun_particles import extract_sun_particles
from fuel_cell_hud import extract_fuel_cell_hud
from screen_hud import extract_screen_hud
from first_person_hud import extract_first_person_hud


class Form(list):
    def __init__(self, items=(), line=1):
        super().__init__(items)
        self.line = line


def tokens(text):
    """GOAL tokens, including nested block comments and reader abbreviations."""
    i, line = 0, 1
    while i < len(text):
        c = text[i]
        if c.isspace():
            line += c == '\n'
            i += 1
        elif c == ';':
            end = text.find('\n', i)
            i = len(text) if end < 0 else end
        elif text.startswith('#|', i):
            depth = 1
            i += 2
            while depth and i < len(text):
                if text.startswith('#|', i):
                    depth += 1
                    i += 2
                elif text.startswith('|#', i):
                    depth -= 1
                    i += 2
                else:
                    line += text[i] == '\n'
                    i += 1
            if depth:
                raise ValueError('Unterminated block comment')
        elif c == '"':
            start, start_line = i, line
            i += 1
            while i < len(text):
                if text[i] == '\\':
                    i += 2
                elif text[i] == '"':
                    i += 1
                    break
                else:
                    line += text[i] == '\n'
                    i += 1
            yield text[start:i], start_line
        elif text.startswith('#\\', i):
            start = i
            i += 3  # A character literal may itself contain a delimiter.
            while i < len(text) and not text[i].isspace() and text[i] not in '()':
                i += 1
            yield text[start:i], line
        elif c in "()'`,":
            if text.startswith(',@', i):
                yield ',@', line
                i += 2
            else:
                yield c, line
                i += 1
        else:
            start = i
            while i < len(text) and not text[i].isspace() and text[i] not in '();':
                i += 1
            yield text[start:i], line


def parse(text):
    stream = iter(tokens(text))

    def read(token, line):
        if token == '(':
            result = Form(line=line)
            for token, at in stream:
                if token == ')':
                    return result
                result.append(read(token, at))
            raise ValueError(f'Unclosed form at line {line}')
        if token == ')':
            raise ValueError(f'Unexpected closing delimiter at line {line}')
        if token in ("'", '`', ',', ',@'):
            value, at = next(stream)
            return Form([{"'": 'quote', '`': 'quasiquote', ',': 'unquote', ',@': 'unquote-splicing'}[token], read(value, at)], line)
        if re.fullmatch(r'[-+]?\d+', token):
            return int(token)
        if re.fullmatch(r'[-+]?(?:\d+\.\d*|\d*\.\d+)(?:[eE][-+]?\d+)?', token):
            return float(token)
        if re.fullmatch(r'#x[0-9a-fA-F]+', token):
            return int(token[2:], 16)
        if re.fullmatch(r'#b[01]+', token):
            return int(token[2:], 2)
        return token

    return [read(token, line) for token, line in stream]


def walk(forms):
    for form in forms:
        if isinstance(form, list):
            yield form
            yield from walk(form)


def properties(form, start=2):
    if (len(form) - start) % 2:
        raise ValueError(f'Unpaired properties at line {form.line}')
    return {str(form[i]).removeprefix(':'): form[i + 1] for i in range(start, len(form), 2)}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def number(value):
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, list) and len(value) == 2:
        scale = {'meters': 4096.0, 'degrees': 65536 / 360, 'seconds': 300}.get(value[0])
        if scale is not None:
            result = value[1] * scale
            return int(result) if value[0] == 'seconds' else result
    raise ValueError(f'Not a numeric particle value: {value}')


def is_integer(value):
    return isinstance(value, int) or isinstance(value, list) and value and value[0] == 'seconds'


def compile_spec(spec, texture_ids):
    field, values = spec[0][1:], spec[1:]
    if field == 'texture':
        value = values[0]
        if value[0] == 'new':
            props = dict(zip(value[3::2], value[4::2]))
            texture = texture_ids.get((props.get(':page', 0) << 16) | props.get(':index', 0))
            name = (texture['tpage_name'] + '/' + texture['name']) if texture else \
                f"@dynamic/{props.get(':page', 0)}/{props.get(':index', 0)}"
        else:
            name = value[1] + '/' + value[0]
        return {'field': field, 'op': 'value', 'value': name}
    if field == 'flags':
        return {'field': field, 'op': 'value', 'value': values[0]}
    if len(values) == 2 and values[0] == ':copy':
        return {'field': field, 'op': 'copy', 'value': values[1]}
    if len(values) == 1 and isinstance(values[0], list) and values[0][0] == 'quote':
        return {'field': field, 'op': 'value', 'value': values[0][1]}
    if field == 'sound' or values[0] == ':data':
        return {'field': field, 'op': 'data', 'value': values}
    values = [v for v in values if v != ':store']
    mode = 'int' if is_integer(values[0]) else 'float'
    if len(values) == 3 and mode == 'float' and is_integer(values[1]):
        mode = 'float-int'
    numbers = [number(v) for v in values]
    return {'field': field, 'op': mode, 'base': numbers[0],
            'range': numbers[1] if len(numbers) > 1 else 0,
            'mult': numbers[2] if len(numbers) > 2 else 1}


def glb_document(path):
    with path.open('rb') as stream:
        header = stream.read(20)
        magic, version, length, json_length, chunk_type = struct.unpack('<5I', header)
        if magic != 0x46546C67 or version != 2 or chunk_type != 0x4E4F534A:
            raise ValueError(f'Not GLB 2: {path}')
        return json.loads(stream.read(json_length)), length


def build_catalogue(project: Path):
    source = project / 'goal_src/jak1'
    exported = project / 'decompiler_out/jak1'
    texture_ids = dict(json.loads((project / 'decompiler/config/jak1/ntsc_v1/tex-info.min.json').read_text()))
    particles, groups, definitions = [], [], []
    fields, callbacks = collections.Counter(), collections.Counter()
    for path in sorted(source.rglob('*.gc')):
        text = path.read_text()
        # Scan all source, not just *-part files: objects own many effects.
        if not re.search(r'\(defpart(?:group)?\s', text):
            continue
        relative = str(path.relative_to(source))
        forms = parse(text)
        count = {'particles': 0, 'groups': 0}
        bundles = next((f[1:] for f in forms if isinstance(f, list) and f and f[0] == 'bundles'), [])
        for form in walk(forms):
            if not form or form[0] not in ('defpart', 'defpartgroup'):
                continue
            props = properties(form)
            provenance = {'file': relative, 'line': form.line}
            if form[0] == 'defpart':
                specs = props.get('init-specs', [])
                particles.append({'id': form[1], 'source': provenance, 'specs': specs,
                                  'fields': [compile_spec(s, texture_ids) for s in specs]})
                count['particles'] += 1
                for spec in specs:
                    fields[spec[0]] += 1
                    if spec[0] in (':func', ':birth-func'):
                        callbacks[json.dumps(spec[1:])] += 1
            else:
                runtime_items = []
                for item in props.get('parts', []):
                    properties_ = properties(item)
                    runtime_items.append({'particle': item[1], **{
                        key: number(value) if key != 'flags' else value
                        for key, value in properties_.items()}})
                groups.append({'name': form[1], 'source': provenance, **props, 'items': runtime_items,
                               'duration': number(props.get('duration', 3000)),
                               'linger-duration': number(props.get('linger-duration', 1500))})
                count['groups'] += 1
        definitions.append({'file': relative, 'sha256': digest(path), 'bundles': bundles, **count})

    objects = json.loads((source / 'build/all_objs.json').read_text())
    art_groups = [{'name': o[0], 'exportName': o[1], 'archives': o[3], 'sourceDirectory': o[4]}
                  for o in objects if o[2] == 4 and o[0].endswith('-ag')]
    models = []
    for path in sorted((exported / 'levels').rglob('*.glb')):
        # Keep the complete highest-detail mesh. Other LODs are source variants,
        # never replacements selected by camera distance.
        if re.search(r'-lod[1-9]\d*\.glb$', path.name):
            continue
        doc, length = glb_document(path)
        models.append({'id': str(path.relative_to(exported / 'levels')).removesuffix('.glb'),
                       'path': str(path.relative_to(exported)), 'bytes': length,
                       'name': path.stem, 'area': path.parent.name,
                       'background': path.stem.endswith('-background'),
                       'meshes': [m.get('name', '') for m in doc.get('meshes', [])],
                       'animations': [{'name': a.get('name', ''), 'channels': len(a.get('channels', []))}
                                      for a in doc.get('animations', [])],
                       'materials': len(doc.get('materials', [])), 'sha256': digest(path)})
    textures = [{'id': str(p.relative_to(exported / 'textures')).removesuffix('.png'),
                 'path': str(p.relative_to(exported)), 'bytes': p.stat().st_size, 'sha256': digest(p)}
                for p in sorted((exported / 'textures').rglob('*.png'))]

    part_ids = {p['id'] for p in particles}
    references = []
    for group in groups:
        for item in group.get('parts', []):
            if item[0] != 'sp-item':
                raise ValueError(f'Unknown group item: {item}')
            references.append({'group': group['name'], 'particle': item[1]})
    next_refs = [{'from': p['id'], 'particle': s[1]} for p in particles for s in p['specs'] if s[0] == ':next-launcher']
    missing = [r for r in references + next_refs if r['particle'] not in part_ids]
    duplicate_parts = {str(k): v for k, v in collections.Counter(p['id'] for p in particles).items() if v > 1}
    duplicate_groups = {str(k): v for k, v in collections.Counter(g['id'] for g in groups).items() if v > 1}
    table_path = source / 'engine/data/part-groups.gc'
    table = [{'name': f[1], 'id': f[2][2]} for f in parse(table_path.read_text())
             if isinstance(f, list) and f and f[0] == 'defconstant' and isinstance(f[2], list)
             and len(f[2]) == 3 and f[2][1] == '*part-group-id-table*']
    defined = {g['name'] for g in groups}
    art_info = json.loads((project / 'decompiler/config/jak1/ntsc_v1/art-group-info.min.json').read_text())
    exported_names = {m['name'] for m in models}
    geometry = [{'name': n.removesuffix('-jg'), 'artGroup': ag}
                for ag, entries in art_info.items() for _, n in entries
                if n.endswith('-jg') and not re.search(r'-lod[1-9]\d*', n)]
    referenced_textures = {f['value'] for p in particles for f in p['fields'] if f['field'] == 'texture'}
    exported_textures = {t['id'] for t in textures}
    source_inventory = inventory(source, particles, groups, parse, walk)
    callback_programs, callback_failures = compile_callbacks(source_inventory['callbackDefinitions'])
    coverage = {'sourceFiles': len(definitions), 'particleDefinitions': len(particles),
                'effectGroups': len(groups), 'groupTableEntries': len(table),
                'artGroups': len(art_groups), 'exportedModels': len(models),
                'exportedTextures': len(textures), 'missingParticleReferences': missing,
                'expectedJointGeometries': len(geometry),
                'missingJointGeometries': [g for g in geometry if g['name'] not in exported_names],
                'particleTextures': len(referenced_textures),
                'missingParticleTextures': sorted(referenced_textures - exported_textures),
                'duplicateParticleIds': duplicate_parts, 'duplicateGroupIds': duplicate_groups,
                'tableGroupsWithoutDefinitions': [g for g in table if g['name'] not in defined],
                'fields': dict(fields.most_common()), 'callbacks': dict(callbacks.most_common()),
                'compiledContactCallbacks': len(callback_programs), 'unsupportedContactCallbacks': callback_failures,
                'sourceAudit': source_inventory['coverage']}
    return {'schemaVersion': 1, 'game': 'Jak and Daxter: The Precursor Legacy',
            'sourceVersion': 'OpenGOAL v0.3.9 / supplied SCUS-97124 NTSC-v1 data',
            'coverage': coverage, 'sourceFiles': definitions, 'groupTable': table,
            'particles': particles, 'groups': groups, 'artGroups': art_groups,
            'jointGeometries': geometry, 'models': models, 'textures': textures,
            'sourceInventory': source_inventory, 'callbackPrograms': callback_programs,
            'particleLighting': extract_particle_lighting(source, parse, walk),
            'sunParticles': extract_sun_particles(source, parse, walk),
            'fuelCellHud': extract_fuel_cell_hud(source, parse, walk),
            'screenHud': extract_screen_hud(source, parse, walk),
            'firstPersonHud': extract_first_person_hud(source, parse, walk)}


def refresh_inventory(previous_file: Path, project: Path):
    """Re-run source analysis without reading unchanged multi-GB model files.

    This only accepts the exact already-catalogued source tree. New/changed
    source definitions require a complete catalogue rebuild.
    """
    catalogue = json.loads(previous_file.read_text())
    source = project / 'goal_src/jak1'
    updated = inventory(source, catalogue['particles'], catalogue['groups'], parse, walk)
    if updated['sourceFiles'] != catalogue['sourceInventory']['sourceFiles']:
        raise ValueError('Source tree changed; rebuild the complete catalogue')
    callbacks, failures = compile_callbacks(updated['callbackDefinitions'])
    catalogue.update(sourceInventory=updated, callbackPrograms=callbacks,
                     particleLighting=extract_particle_lighting(source, parse, walk),
                     sunParticles=extract_sun_particles(source, parse, walk),
                     fuelCellHud=extract_fuel_cell_hud(source, parse, walk),
                     screenHud=extract_screen_hud(source, parse, walk),
                     firstPersonHud=extract_first_person_hud(source, parse, walk))
    catalogue['coverage'].update(sourceAudit=updated['coverage'],
                                 compiledContactCallbacks=len(callbacks), unsupportedContactCallbacks=failures)
    return catalogue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--refresh-inventory-from', type=Path,
                        help='Re-analyse an identical source tree, preserving existing asset metadata')
    args = parser.parse_args()
    catalogue = refresh_inventory(args.refresh_inventory_from, args.project.resolve()) if args.refresh_inventory_from else build_catalogue(args.project.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalogue, separators=(',', ':')) + '\n')
    print(json.dumps(catalogue['coverage'], indent=2))


if __name__ == '__main__':
    main()
