"""Recover merc death emission topology from the supplied game's linked data.

The generic renderer emits from its transformed input vertices AND appended
cross-fragment copies. GLB triangle indices alone do not retain this stream.
This reader consumes the official extractor's data disassembly, resolves its
labels, and checks every decoded input position against the original GLB.
Generated game data belongs outside Git and public/.
"""
from __future__ import annotations

import hashlib
import json
import re
import struct
from pathlib import Path

from pack_assets import GLB


def f32(value):
    return struct.unpack('<f', struct.pack('<f', value))[0]


def bits_float(value):
    return struct.unpack('<f', struct.pack('<I', value))[0]


def float_bits(value):
    return struct.unpack('<I', struct.pack('<f', value))[0]


class LinkedAssembly:
    """A strict, word-addressed view of the extractor's linked data listing."""
    def __init__(self, text):
        self.words, self.labels, self.types, self.symbols = [], {}, [], {}
        self.lines = {}
        for line_number, line in enumerate(text.splitlines(), 1):
            label = re.fullmatch(r'(L\d+):', line)
            if label:
                self.labels[label[1]] = len(self.words) * 4
            directive = re.match(r'^\s+\.(word|type|symbol)\s+(\S+)\s*$', line)
            if not directive:
                if re.match(r'^\s+\.[a-z]', line):
                    raise ValueError(f'Unsupported linked-data directive: {line}')
                continue
            kind, value = directive.groups()
            address = len(self.words) * 4
            self.lines[address] = line_number
            self.words.append((kind, value))
            if kind == 'type':
                self.types.append((value, address + 4))
            if kind == 'symbol':
                self.symbols[address] = value
        values = []
        for kind, value in self.words:
            if kind != 'word':
                values.append(0)
            elif value in self.labels:
                values.append(self.labels[value])
            elif re.fullmatch(r'0x[0-9a-fA-F]+', value):
                values.append(int(value, 16))
            else:
                raise ValueError(f'Unsupported linked-data value: {value}')
        self.data = struct.pack('<' + 'I' * len(values), *values)

    def read(self, format, address):
        return struct.unpack_from('<' + format, self.data, address)[0]

    def pointer(self, address):
        kind, value = self.words[address // 4]
        if kind != 'word' or value not in self.labels:
            raise ValueError(f'Expected a resolved data pointer at {address}: {kind} {value}')
        return self.labels[value]

    def string(self, address):
        size = self.read('I', address)
        return self.data[address + 4:address + 4 + size].decode('utf8')


def animation_events(assembly):
    """Authored effect-name markers, retaining artist-frame and source time."""
    events = []
    for kind, animation in assembly.types:
        if kind != 'art-joint-anim' or assembly.words[(animation + 12) // 4][0] != 'word':
            continue
        extra = assembly.pointer(animation + 12)
        name = assembly.string(assembly.pointer(animation + 4))
        speed, base, step = (assembly.read('f', animation + n) for n in (16, 20, 24))
        tags, data = assembly.pointer(extra + 24), assembly.pointer(extra + 8)
        for index in range(assembly.read('I', extra)):
            tag = tags + 16 * index
            if assembly.symbols.get(tag) != 'effect-name':
                continue
            offset = assembly.read('H', tag + 12)
            symbol = assembly.symbols.get(data + offset)
            if symbol is None:
                raise ValueError(f'{name}: non-symbol effect marker')
            frame = assembly.read('f', tag + 4)
            events.append({'clip': name, 'effect': symbol, 'artistFrame': frame,
                           'seconds': (frame - base) / step / (speed * 60 if speed > 0 else 30),
                           'assemblyLine': assembly.lines[data + offset]})
    return events


def decode_models(assembly, names=None):
    """Input vertices in exporter order, plus the generic renderer's copy order.

    Offsets are the pinned Jak 1 merc-h.gc structures. Each effect resets its
    two alternating fragment buffers. Same-copies alias an existing vertex;
    cross-copies append another transformed vertex to the death stream.
    """
    models = []
    for kind, control in assembly.types:
        if kind != 'merc-ctrl':
            continue
        name = assembly.string(assembly.pointer(control + 4))
        if names is not None and name not in names:
            continue
        scale = assembly.read('f', control + 28)
        st_add = assembly.read('I', control + 44)
        st_out = assembly.read('f', control + 36)
        effect_count = assembly.read('I', control + 52)
        expected_vertices = assembly.read('H', control + 66)
        model = {'name': name, 'assemblyLine': assembly.lines[control - 4],
                 'positions': [], 'effects': [], 'crossCopies': 0}
        for effect_index in range(effect_count):
            effect = control + 108 + effect_index * 32
            geometry = assembly.pointer(effect)
            fragment_control = assembly.pointer(effect + 4)
            fragment_count = assembly.read('H', effect + 18)
            memory = [{}, {}]
            fragments = []
            for fragment in range(fragment_count):
                header = assembly.data[geometry:geometry + 23]
                u4, l4, _, matrix_count = assembly.data[fragment_control:fragment_control + 4]
                assert matrix_count < 10
                fragment_control += 4 + 2 * matrix_count
                lump_start = geometry + ((u4 + 3) // 4) * 16
                assert ((u4 + 3) // 4 + (l4 + 3) // 4) == header[10]
                fp = geometry + header[10] * 16
                offsets = struct.unpack_from('<3f', assembly.data, fp)
                count = sum(header[4:7])
                assert count * 3 <= l4
                current, previous = memory[fragment % 2], memory[(fragment + 1) % 2]
                input_start = len(model['positions']) // 3
                for vertex in range(count):
                    packed = assembly.data[lump_start + vertex * 12:lump_start + vertex * 12 + 12]
                    index = len(model['positions']) // 3
                    for axis in range(3):
                        value = f32(bits_float(0x4b010000 + packed[axis * 4 + 3]) + offsets[axis])
                        model['positions'].append(f32(f32(value * scale) / 4096))
                    for byte in packed[4:6]:
                        address = (float_bits(f32(bits_float(st_add + byte) + st_out)) - 371) & 0xffff
                        assert 0 <= address < 1022, (name, fragment, address)
                        current[address] = index
                        current[address + 1] = current[address + 2] = None
                copy_start = geometry + header[0] * 4
                for copy in range(header[7]):
                    src, dst = assembly.data[copy_start + copy * 4:copy_start + copy * 4 + 2]
                    assert current.get(src) is not None, (name, fragment, 'same', src)
                    current[dst] = current[src]
                copy_start += header[7] * 4
                copies = []
                for copy in range(header[8]):
                    src, dst = assembly.data[copy_start + copy * 4:copy_start + copy * 4 + 2]
                    assert previous.get(src) is not None, (name, fragment, 'cross', src)
                    current[dst] = previous[src]
                    copies.append(previous[src])
                model['crossCopies'] += len(copies)
                fragments.append({'start': input_start, 'count': count, 'copies': copies})
                geometry += header[11] * 16
            model['effects'].append(fragments)
        assert len(model['positions']) // 3 == expected_vertices, (name, expected_vertices, len(model['positions']) // 3)
        models.append(model)
    return models


def match_model(decoded, glb):
    """Prove the contiguous input domain against every exported position.

    Exported merc GLBs share their level-wide vertex buffer. A minimum triangle
    index is not sufficient: an unreferenced input vertex can still emit sparks.
    Find an exact complete source domain containing every model triangle index.
    """
    mesh = next(m for m in glb.doc['meshes'] if m['name'] == decoded['name'])
    primitives = mesh['primitives']
    attributes = primitives[0]['attributes']
    assert all(p['attributes'] == attributes for p in primitives)
    used = {i for p in primitives for i in glb.indices(p)}
    rows = glb.rows(attributes['POSITION'])
    needle = struct.pack('<' + 'f' * len(decoded['positions']), *decoded['positions'])
    count = len(decoded['positions']) // 3
    matches = [start for start in range(max(0, max(used) - count + 1), min(used) + 1)
               if rows[start] == needle[:12] and b''.join(rows[start:start + count]) == needle]
    if len(matches) != 1:
        raise ValueError(f"{decoded['name']}: source domain has {len(matches)} exact GLB matches")
    start = matches[0]
    node_index = next(i for i, n in enumerate(glb.doc['nodes']) if n.get('mesh') == glb.doc['meshes'].index(mesh))
    result = {**decoded, 'version': 1, 'meshNode': node_index, 'sourceVertexStart': start,
              'sourceVertices': count, 'triangleVertices': len(used),
              'unreferencedVertices': count - len(used)}
    for name, output, format in [('JOINTS_0', 'joints', '4B'), ('WEIGHTS_0', 'weights', '4f')]:
        result[output] = [v for row in glb.rows(attributes[name])[start:start + count]
                          for v in struct.unpack('<' + format, row)]
    result['morphPositions'] = []
    for target in primitives[0].get('targets', []):
        assert all(p.get('targets') == primitives[0]['targets'] for p in primitives)
        result['morphPositions'].append([v for row in glb.rows(target['POSITION'])[start:start + count]
                                        for v in struct.unpack('<3f', row)])
    return result


def main():
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--assembly-directory', type=Path, required=True)
    parser.add_argument('--source-models', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--catalogue', type=Path, help='Restrict to the lab\'s complete-detail model list')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    catalogue = json.loads(args.catalogue.read_text()) if args.catalogue else None
    allowed = {m['path'].removeprefix('levels/') for m in catalogue['models'] if not m['background']} if catalogue else None
    paths = {}
    for path in args.source_models.rglob('*.glb'):
        if allowed is not None and str(path.relative_to(args.source_models)) not in allowed:
            continue
        paths.setdefault(path.stem, []).append(path)
    reports = []
    for assembly_path in sorted(args.assembly_directory.glob('*.asm')):
        data = assembly_path.read_bytes()
        assembly = LinkedAssembly(data.decode())
        events = animation_events(assembly)
        for model in decode_models(assembly, paths.keys()):
            for path in paths.get(model['name'], []):
                source = path.read_bytes()
                result = match_model(model, GLB(source, path.parent))
                result.update(sourceAssembly=assembly_path.name, sourceAssemblySha256=hashlib.sha256(data).hexdigest(),
                              sourceModel=str(path.relative_to(args.source_models)), sourceModelSha256=hashlib.sha256(source).hexdigest(),
                              animationEvents=events)
                destination = args.output / (path.parent.name + '--' + path.stem + '.json')
                destination.write_text(json.dumps(result, separators=(',', ':')) + '\n')
                report = {key: result[key] for key in ['name', 'sourceModel', 'sourceVertices', 'triangleVertices', 'unreferencedVertices', 'crossCopies']}
                report['effects'] = len(result['effects'])
                report['fragments'] = sum(map(len, result['effects']))
                reports.append(report)
                print(json.dumps(report), flush=True)
    (args.output / 'report.json').write_text(json.dumps(reports, indent=2) + '\n')


if __name__ == '__main__':
    main()
