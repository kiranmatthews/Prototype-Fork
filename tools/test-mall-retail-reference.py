#!/usr/bin/env python3
"""Check local retail bytes, independent rail positions and bounded decoding.

python3 tools/test-mall-retail-reference.py /path/to/retail
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('mall_survey', root / 'tools/mall-retail-reference.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
source = Path(sys.argv[1])
saved = json.loads((root / 'docs/mall/retail-rails.json').read_text())
conversion = json.loads((root / 'docs/mall/source-survey.json').read_text())
result = json.loads(json.dumps(module.survey(source, conversion)))
for key in ('files', 'registration', 'activation', 'railNodes', 'railEdges'):
    assert result[key] == saved[key], key
assert (result['objects'], result['vertices'], result['faces'], result['nodes']) == (900, 10630, 6591, 765)
assert result['registration']['matchedFraction'] > .974
assert result['registration']['maxError'] < .008
assert abs(result['registration']['factor'] - .904/2.25) < 4e-8
active = result['activation']
assert (active['restart'], active['activeSegments'], active['activeUniqueEdges']) == (40, 214, 210)
assert len(active['paths']) == 73
assert [a['node'] for a in active['activators'] if a['normalStart']] == [0, 441]
assert [a['node'] for a in active['activators'] if not a['normalStart']] == [759]
assert not {760, 761, 762, 763}.intersection(n for path in active['paths'] for n in path)
assert [282, 281] in active['paths'] and [134, 135] in active['paths']

# Read the binary TRG independently from the dataset and registration code.
data = (source / 'SKMALL_T.TRG').read_bytes()
assert hashlib.sha256(data).hexdigest() == '7efd11c44a8e83d61b189088961dce2d38dcbd76a0257d6706dffb93aa6cd0ab'
for node in saved['railNodes']:
    p, = struct.unpack_from('<I', data, 12+node['index']*4)
    kind, count = struct.unpack_from('<2H', data, p)
    p = (p+4+count*2+3)//4*4
    x, y, z = struct.unpack_from('<3i', data, p)
    assert node['type'] == kind and node['rawPosition'] == [x, -y, z]

# Fail closed if the activation list develops an unhandled command instead
# of silently importing every available rail (including alternate modes).
bad = bytearray(data)
struct.pack_into('<H', bad, 0xc80, 0x9999)
parser = module.decoder()
nodes = parser.parse_nodes(source / 'SKMALL_T.TRG')
try:
    module.activation(bad, nodes)
except ValueError:
    pass
else:
    raise AssertionError('Unknown rail activation command was accepted')
with tempfile.TemporaryDirectory() as tmp:
    broken = Path(tmp)/'short.psx'
    broken.write_bytes((source/'SKMALL.PSX').read_bytes()[:100])
    try:
        parser.parse_mesh(broken)
    except ValueError:
        pass
    else:
        raise AssertionError('Truncated source geometry was accepted')
print('PASS: retail byte fingerprints, uniform registration, 73 active chains / 210 unique edges, independent node positions, alternate-mode exclusion and malformed input rejection')
