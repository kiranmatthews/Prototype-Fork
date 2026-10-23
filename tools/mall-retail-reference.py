#!/usr/bin/env python3
"""Register locally supplied retail Mall PSX/TRG measurements to the conversion.

Usage: python3 tools/mall-retail-reference.py RETAIL_DIR CONVERSION_JSON OUTPUT
The PSX v4 / TRG v2 decoder is shared with school-source-survey.py. No game
code is executed and this tool performs no network reads. The retained THPS2
records are not, by themselves, a byte-for-byte verification of THPS1 media.
"""
import collections
import importlib.util
import itertools
import json
import math
from pathlib import Path
import struct
import sys


def decoder():
    path = Path(__file__).with_name('school-source-survey.py')
    spec = importlib.util.spec_from_file_location('psx_survey', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def register(original, converted):
    # The approximate seed comes from repeated coordinate planes, independently
    # of node placement. Refine one UNIFORM factor, never per-axis stretching.
    factor = .904 / 2.25
    shift = [5181.89, 33.515, 9332.30]
    original = sorted(set((x, y, -z) for x, y, z in original))
    converted = sorted(set(converted))
    cell = .05
    for _ in range(3):
        grid = collections.defaultdict(list)
        for raw in original:
            point = tuple(factor * raw[k] + shift[k] for k in range(3))
            grid[tuple(math.floor(v / cell) for v in point)].append((point, raw))
        pairs = []
        for point in converted:
            key = tuple(math.floor(v / cell) for v in point)
            nearby = [entry for delta in itertools.product((-1, 0, 1), repeat=3)
                      for entry in grid.get(tuple(key[k] + delta[k] for k in range(3)), ())]
            if not nearby:
                continue
            candidate = min(nearby, key=lambda entry: math.dist(point, entry[0]))
            if math.dist(point, candidate[0]) < .03:
                pairs.append((candidate[1], point))
        if len(pairs) < 1000:
            raise ValueError('Insufficient independent geometry matches for registration')
        a = [sum(p[0][k] for p in pairs) / len(pairs) for k in range(3)]
        b = [sum(p[1][k] for p in pairs) / len(pairs) for k in range(3)]
        numerator = sum((raw[k] - a[k]) * (point[k] - b[k]) for raw, point in pairs for k in range(3))
        denominator = sum((raw[k] - a[k]) ** 2 for raw, _ in pairs for k in range(3))
        factor = numerator / denominator
        shift = [b[k] - factor * a[k] for k in range(3)]
    residuals = sorted(math.dist(point, [factor * raw[k] + shift[k] for k in range(3)])
                       for raw, point in pairs)
    return dict(factor=factor, axisSigns=[1, 1, -1], translation=shift,
                originalUniqueVertices=len(original), convertedUniqueVertices=len(converted),
                matchedUniqueVertices=len(pairs), matchedFraction=len(pairs) / len(converted),
                matchedOriginalVertices=len({raw for raw, _ in pairs}),
                rmsError=math.sqrt(sum(d*d for d in residuals) / len(residuals)),
                p95Error=residuals[int(.95 * (len(residuals)-1))], maxError=max(residuals),
                method='Uniform least-squares fit to matched static vertices; 0.03 converted-unit correspondence bound. Converted duplicates with different floating-point values are counted separately.')


def segment_distance(p, a, b):
    ab = [b[k] - a[k] for k in range(3)]
    denom = sum(v*v for v in ab)
    t = max(0, min(1, sum((p[k]-a[k])*ab[k] for k in range(3))/denom)) if denom else 0
    return math.dist(p, [a[k] + t*ab[k] for k in range(3)])


def activation(data, nodes):
    """Read the normal restart's pulse lists; reject unknown command layouts.

    Rail nodes are not automatically active. Trig_SendPulseToNode constructs
    a CRail when a restart/command point pulses its link. In this Mall record,
    command points 0 and 441 serve the normal start; 759 serves other restarts.
    This is a bounded data decoder, not a general trigger/script interpreter.
    """
    offsets = struct.unpack_from(f'<{len(nodes)}I', data, 12)
    def word(p):
        return struct.unpack_from('<H', data, p)[0]
    def links(i):
        kind, p = nodes[i]['type'], offsets[i]
        skip = 6 if kind in (1, 7) else 4 if kind == 5 else 2
        if kind not in (1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 1000, 1001):
            return []
        count = word(p + skip)
        end = offsets[i+1] if i+1 < len(offsets) else len(data)
        if p + skip + 2 + count*2 > end:
            raise ValueError('Node links exceed their record')
        result = list(struct.unpack_from(f'<{count}H', data, p+skip+2))
        if any(n >= len(nodes) for n in result):
            raise ValueError('Invalid activation link')
        return result
    restart = next(n for n in nodes if n.get('name') == 'Re_Start_Mall')
    i = restart['id']
    p = (offsets[i] + 4 + len(links(i))*2 + 3)//4*4 + 18
    end = offsets[i+1]
    terminator = data.index(b'\0', p, end)
    p = (terminator+2)//2*2
    commands = []
    lengths = {0x9d: 1, 0x68: 3, 0xa6: 1, 0xa9: 1, 0x03: 0, 0xca: 2, 0xffff: 0}
    while p < end:
        op = word(p); p += 2
        args = []
        if op in (0x02, 0x80):
            while True:
                q = data.index(b'\0', p, end)
                value = data[p:q].decode('ascii'); p = (q+2)//2*2
                if value:
                    args.append(value)
                if op == 0x80 or not value:
                    break
        elif op in lengths:
            count = lengths[op]
            if p + count*2 > end:
                raise ValueError('Restart command exceeds its node')
            args = list(struct.unpack_from(f'<{count}H', data, p)); p += count*2
        else:
            raise ValueError(f'Unsupported restart command {op:#x}')
        commands.append([op, args])
        if op == 0xffff:
            break
    if not commands or commands[-1][0] != 0xffff or end-p >= 4 or [3, []] not in commands:
        raise ValueError('Normal restart does not contain the expected bounded pulse list')
    activators = []
    for n in nodes:
        if n['type'] in (10, 11):
            continue
        children = [i for i in links(n['id']) if nodes[i]['type'] in (10, 11)]
        if not children:
            continue
        if n['type'] != 6:
            raise ValueError('Unexpected rail activation source')
        q = (offsets[n['id']] + 4 + len(links(n['id']))*2 + 3)//4*4 + 4
        last = offsets[n['id']+1]
        if data[q:last] != struct.pack('<4H', 0x86, 1, 3, 0xffff):
            raise ValueError('Rail activator has unsupported conditional commands')
        activators.append(dict(node=n['id'], roots=children, normalStart=n['id'] in restart['links']))
    paths = []
    for a in activators:
        if not a['normalStart']:
            continue
        for root in a['roots']:
            chain = [root]
            while True:
                choices = [i for i in nodes[chain[-1]]['links'] if nodes[i]['type'] in (10, 11)]
                if not choices:
                    break
                if len(choices) != 1 or choices[0] in chain:
                    raise ValueError('Ambiguous or cyclic source rail chain')
                chain.append(choices[0])
            if len(chain) < 2:
                raise ValueError('Activated rail has no segment')
            paths.append(chain)
    return dict(restart=i, name=restart['name'], restartLinks=restart['links'],
                restartCommands=commands, activators=activators, paths=paths,
                activeSegments=sum(len(p)-1 for p in paths),
                activeUniqueEdges=len({tuple(sorted(e)) for p in paths for e in zip(p, p[1:])}))


def survey(root, conversion):
    parser = decoder()
    objects, meshes = parser.parse_mesh(root / 'SKMALL.PSX')
    nodes = parser.parse_nodes(root / 'SKMALL_T.TRG')
    active = activation((root / 'SKMALL_T.TRG').read_bytes(), nodes)
    raw = [tuple(o['position'][k] + v[k] for k in range(3))
           for o in objects for v in meshes[o['mesh']]['vertices']]
    converted = [tuple(m['vertices'][i:i+3]) for m in conversion['meshes'] if 18 <= m['id'] < 54
                 for i in range(0, len(m['vertices']), 3)]
    registration = register(raw, converted)
    def transform(p):
        return [p[k] * registration['axisSigns'][k] * registration['factor'] + registration['translation'][k] for k in range(3)]
    rails = [dict(index=n['id'], type=n['type'], rawPosition=n['position'],
                  p=transform(n['position']), links=[i for i in n['links'] if nodes[i]['type'] in (10, 11)])
             for n in nodes if n['type'] in (10, 11)]
    lookup = {n['index']: n for n in rails}
    edges = sorted({tuple(sorted((n['index'], i))) for n in rails for i in n['links']})
    old = {n['index']: n for n in conversion['railNodes']}
    old_edges = sorted({tuple(sorted((n['index'], i))) for n in old.values() for i in n['links'] if i in old})
    old_segments = [(old[a]['p'], old[b]['p']) for a, b in old_edges]
    distances = []
    for a, b in edges:
        p, q = lookup[a]['p'], lookup[b]['p']
        samples = [p, [(p[k]+q[k])/2 for k in range(3)], q]
        distances.append(dict(nodes=[a, b], maxDistance=max(min(segment_distance(s, u, v)
                              for u, v in old_segments) for s in samples)))
    return dict(schema=1,
        variant='Original Mall retained in THPS2 PC retail; PSX v4 and TRG v2. File sizes match the published THPS2 PS1 inventory. THPS1 retail bytes are not independently verified.',
        files=[parser.fingerprint(root / name) for name in ['SKMALL.PSX', 'SKMALL_T.TRG']],
        objects=len(objects), vertices=len(raw), faces=sum(len(m['faces']) for m in meshes),
        nodes=len(nodes), nodeTypes=dict(collections.Counter(n['type'] for n in nodes)),
        registration=registration, activation=active, railNodes=rails, railEdges=edges,
        railComparison=dict(convertedNodes=len(old), convertedRawEdges=len(old_edges),
            retailNodes=len(rails), retailEdges=len(edges),
            sampling='Each retail segment endpoint and midpoint to the nearest conversion segment',
            withinOneConvertedUnit=sum(d['maxDistance'] < 1 for d in distances),
            withinTenConvertedUnits=sum(d['maxDistance'] < 10 for d in distances), segments=distances),
        restarts=[dict(n, convertedPosition=transform(n['position'])) for n in nodes if n['type'] == 8])


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    root, conversion, output = map(Path, sys.argv[1:])
    result = survey(root, json.loads(conversion.read_text()))
    output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('railNodes', 'railEdges', 'restarts', 'railComparison', 'activation')}, indent=2))
    print(json.dumps({k: v for k, v in result['activation'].items() if k not in ('paths', 'restartCommands', 'activators')}))
    print(json.dumps({k: v for k, v in result['railComparison'].items() if k != 'segments'}, indent=2))
