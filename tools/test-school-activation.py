"""Check normal School rail activation against a locally supplied TRG file.

Usage: python3 tools/test-school-activation.py /path/to/SKSCHL_T.TRG
No game binary is bundled or executed.
"""
import copy
import importlib.util
from pathlib import Path
import struct
import sys

spec = importlib.util.spec_from_file_location('school_survey', Path(__file__).with_name('school-source-survey.py'))
survey = importlib.util.module_from_spec(spec)
spec.loader.exec_module(survey)
path = Path(sys.argv[1])
data = path.read_bytes()
nodes = survey.parse_nodes(path)
actual = survey.rail_activation(data, nodes)
assert actual['restart'] == 393
assert [a['node'] for a in actual['activators'] if a['normalStart']] == [3, 506, 608, 879]
assert [a['node'] for a in actual['activators'] if not a['normalStart']] == [961]
assert (len(actual['paths']), actual['activeNodes'], actual['activeSegments'], actual['activeUniqueEdges']) == (128, 390, 331, 270)
assert actual['excludedEdges'] == [[189, 190]]
assert nodes[393]['angles'] == [0, 1023, 0]
assert nodes[393]['position'] == [-6149, 2792, 6391]
assert [163, 164] in actual['paths']
assert [206, 165, 166, 167, 546, 547] in actual['paths']
assert [790, 258, 259, 791] in actual['paths']
offsets = struct.unpack_from(f'<{len(nodes)}I', data, 12)

def reject(changed, message, changed_nodes=None):
    try:
        survey.rail_activation(changed, changed_nodes or nodes)
    except ValueError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError(f'Expected rejection: {message}')

# Unknown/conditional restart instructions must not silently enable rails.
q = (offsets[393] + 4 + len(nodes[393]['links']) * 2 + 3) // 4 * 4 + 18
q = (data.index(b'\0', q, offsets[394]) + 2) // 2 * 2
changed = bytearray(data)
struct.pack_into('<H', changed, q, 0x94)
reject(changed, 'Unsupported restart command')

# More than one pulse changes the rail list; no implicit deduplication.
changed = bytearray(data)
struct.pack_into('<H', changed, offsets[4] - 6, 2)
reject(changed, 'unsupported conditional commands')

# A command point referencing a rail activator requires a wider script audit.
changed_nodes = copy.deepcopy(nodes)
changed_nodes[394]['type'] = 6
reject(data, 'indirect pulse audit', changed_nodes)

# Source chains are directed, and malformed cycles fail instead of hanging.
changed = bytearray(data)
root, neighbour = next(p[:2] for p in actual['paths'] if len(p) > 2)
assert nodes[neighbour]['links']
struct.pack_into('<H', changed, offsets[neighbour] + 4, root)
reject(changed, 'Invalid or cyclic')

# A RailDef may put its metadata link before its actual path neighbour.
root = next(p[0] for p in actual['paths'] if nodes[p[0]]['type'] == 11 and len(nodes[p[0]]['links']) == 2)
changed = bytearray(data)
a, b = struct.unpack_from('<2H', data, offsets[root] + 4)
struct.pack_into('<2H', changed, offsets[root] + 4, b, a)
assert survey.rail_activation(changed, nodes)['paths'] == actual['paths']

# A count cannot spill into the following node's record.
changed = bytearray(data)
struct.pack_into('<H', changed, offsets[3] + 2, 65535)
reject(changed, 'exceeds its node record')
print('PASS: 128 original chains / 270 unique edges; five malformed layouts rejected; RailDef metadata order handled')
