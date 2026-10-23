#!/usr/bin/env python3
"""Codec/transform fixtures, plus optional checks against a locally supplied HAWK.PSX."""
import importlib.util
from pathlib import Path
import struct
import sys

spec = importlib.util.spec_from_file_location('skater_survey', Path(__file__).with_name('psx-skater-survey.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def check(data, count, expected):
    actual, consumed = m.channel(data, 0, count, len(data))
    assert actual == expected, (actual, expected)
    assert consumed == len(data)


check(bytes([0x0f]), 7, [0] * 7)
check(bytes([0x0e, 0xfd, 0xff]), 4, [-3] * 4)
# Five-frame interpolation, negative division truncates toward zero; the endpoint is exact.
check(bytes([0x30]) + struct.pack('<3h', 5, -2, 4), 7, [5, 4, 3, 2, -2, 1, 4])
# Three signed 3-bit deltas: +3, -4, +1 packed MSB first across a byte boundary.
check(bytes([0x02, 10, 0, 0b01110000, 0b10000000]), 4, [10, 13, 9, 10])
check(bytes([0x01, 0xff, 0x7f, 0b01000000]), 2, [32767, -32768])
try:
    m.channel(bytes([0x00, 1]), 0, 2, 2)
except ValueError:
    pass
else:
    raise AssertionError('Truncated channel was accepted')
try:
    m.chunks(b'\0' * 10)
except ValueError:
    pass
else:
    raise AssertionError('Truncated container was accepted')

assert m.sincos(0) == (0, 4096)
assert m.sincos(1024) == (4096, 0)
assert m.transform(m.rotation([0, 1024, 0]), [16, 0, 0]) == [0, 0, -16]
# Both bones have absolute 90-degree rotation. The child's translated origin
# follows the parent, but its vertex rotation must not accumulate to 180 degrees.
mesh = dict(vertices=[[16, 0, 0]], types=[1], faces=[dict(indices=[0])])
decoded = dict(meshes=[mesh, mesh], parents=[0, 0], frames=1,
               channels=[[[v] for v in values] for values in
                         ([0, 1024, 0, 0, 0, 0], [0, 1024, 0, 16, 0, 0])])
assert m.pose(decoded, 0) == [[[0, 0, -1]], [[0, 0, -2]]]
decoded['meshes'][1] = dict(vertices=[[0, 0, 0]], types=[2], faces=[dict(indices=[0])])
assert m.pose(decoded, 0) == [[[0, 0, -1]], [[0, 0, -1]]]
decoded['parents'] = [1, 0]
try:
    m.pose(decoded, 0)
except ValueError:
    pass
else:
    raise AssertionError('Cyclic hierarchy was accepted')

if len(sys.argv) > 1:
    source = Path(sys.argv[1])
    result = m.survey(source, Path(sys.argv[2]) if len(sys.argv) > 2 else None)
    assert result['input']['sha256'] == '7e43dec317b8f35691df66c99df3a86f1618cce19c80fabbd12b283deb449fd5'
    assert sum(clip['padding'] for clip in result['clips']) == 2
    assert len(result['clips']) == 78
    assert all(clip['consumed'] + clip['padding'] == clip['budget'] for clip in result['clips'])
    poses = {entry['animation']: entry['poses'] for entry in result['measurements']}
    assert poses[0][0]['near']['body']['size'][1] == 192.8125
    assert poses[8][19]['near']['body']['size'][1] == 140.1875
    assert poses[8][26]['near']['body']['size'][1] == 145.875
    assert all(abs(p['near']['body']['size'][1] - p['far']['body']['size'][1]) < 2
               for clip in poses.values() for p in clip)
    print('PASS: retained retail hash, all 78 compressed byte budgets, stitch-aware poses and near/far precision')
print('PASS: independent codec vectors, signed overflow, hierarchy composition, stitch references and malformed input rejection')
