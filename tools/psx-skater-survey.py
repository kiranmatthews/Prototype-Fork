#!/usr/bin/env python3
"""Measure a locally supplied PSX v4 / 0x2c skater animation, without game execution.

This independent reader follows the documented six-channel codec and model-space
transform contract. Original assets are inputs, never bundled with this tool.
See docs/mall/actor-scale.json for source revisions, hashes and calibration limits.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import struct


def signed16(value):
    return (value + 32768) % 65536 - 32768


def saturate16(value):
    return min(32767, max(-32768, value))


def channel(data, cursor, count, end):
    """Decode one bounded stream; signed deltas are packed most-significant-bit first."""
    if not 1 <= count <= 4096 or not 0 <= cursor < end <= len(data):
        raise ValueError('Invalid channel bounds')

    def byte(index):
        if not 0 <= index < end:
            raise ValueError('Truncated compressed channel')
        return data[index]

    def short(index):
        return signed16(byte(index) | byte(index + 1) << 8)

    header = byte(cursor)
    cursor += 1
    interval, mode = (header >> 4) + 1, header & 15
    if mode == 15:
        return [0] * count, cursor
    previous = short(cursor)
    cursor += 2
    if mode == 14:
        return [previous] * count, cursor
    values = [previous]
    segments, remainder = divmod(count - 1, interval)
    bit = cursor * 8
    for width in [interval] * segments + ([remainder] if remainder else []):
        if mode == 0:
            endpoint = short(cursor)
            cursor += 2
            delta = endpoint - previous
        else:
            bits, value = mode + 1, 0
            for _ in range(bits):
                value = value << 1 | (byte(bit // 8) >> (7 - bit % 8)) & 1
                bit += 1
            delta = value - (1 << bits) if value & (1 << (bits - 1)) else value
            endpoint = signed16(previous + delta)
        increment = math.trunc(delta / width)
        for _ in range(width - 1):
            previous += increment
            values.append(signed16(previous))
        previous = endpoint
        values.append(previous)
    return values, (bit + 7) // 8 if mode else cursor


def chunks(data):
    if len(data) < 12:
        raise ValueError('Truncated PSX header')
    cursor = struct.unpack_from('<I', data, 4)[0]
    result = {}
    while True:
        if not 12 <= cursor <= len(data) - 8:
            raise ValueError('Invalid metadata offset')
        tag, size = struct.unpack_from('<II', data, cursor)
        if tag == 0xffffffff:
            return result
        if size > len(data) - cursor - 8 or tag in result:
            raise ValueError('Invalid or duplicate metadata chunk')
        result[tag] = (cursor + 8, size)
        cursor += 8 + size


def sincos(angle):
    radians = (angle & 4095) * math.tau / 4096
    return round(math.sin(radians) * 4096), round(math.cos(radians) * 4096)


def rotation(angles):
    sx, cx = sincos(angles[0])
    sy, cy = sincos(angles[1])
    sz, cz = sincos(angles[2])
    sxsz, cxsz, sxcz, cxcz = sx * sz >> 12, cx * sz >> 12, sx * cz >> 12, cx * cz >> 12
    return [[(sy * sxsz + cy * cz) >> 12, (sy * sxcz - cy * sz) >> 12, sy * cx >> 12],
            [cxsz, cxcz, -sx],
            [(cy * sxsz - sy * cz) >> 12, (cy * sxcz + sy * sz) >> 12, cy * cx >> 12]]


def transform(matrix, point):
    return [saturate16(sum(a * b for a, b in zip(row, point)) >> 12) for row in matrix]


def read_source(path):
    data = path.read_bytes()
    tags = chunks(data)
    if 0x2c not in tags or 0x52454948 not in tags:
        raise ValueError('This survey requires compressed 0x2c animation and HIER chunks')
    spec = importlib.util.spec_from_file_location('psx_mesh_reader', Path(__file__).with_name('school-source-survey.py'))
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    _, meshes = reader.parse_mesh(path)
    base, size = tags[0x2c]
    hierarchy, hierarchy_size = tags[0x52454948]
    if not 0 < len(meshes) <= 128 or hierarchy_size < len(meshes) * 2 or size < 4:
        raise ValueError('Invalid skeleton or animation table')
    parents = list(struct.unpack_from(f'<{len(meshes)}H', data, hierarchy))
    if any(parent >= len(meshes) for parent in parents):
        raise ValueError('Invalid parent index')
    count = struct.unpack_from('<I', data, base)[0]
    if not 0 < count <= 4096 or 4 + count * 8 > size:
        raise ValueError('Invalid animation count')
    entries = [struct.unpack_from('<IHH', data, base + 4 + i * 8) for i in range(count)]
    if any(not 4 + count * 8 <= offset < size or not 0 < frames <= 4096 or tween
           for offset, frames, tween in entries):
        raise ValueError('Invalid animation entry')
    return dict(data=data, meshes=meshes, parents=parents, base=base, size=size, entries=entries)


def decode(source, animation):
    offset, frames, _ = source['entries'][animation]
    base = source['base']
    cursor = base + offset
    end = base + min([entry[0] for entry in source['entries'] if entry[0] > offset] + [source['size']])
    channels = []
    for _ in source['meshes']:
        bone = []
        for _ in range(6):
            values, cursor = channel(source['data'], cursor, frames, end)
            bone.append(values)
        channels.append(bone)
    padding = source['data'][cursor:end]
    if len(padding) > 3 or any(padding):
        raise ValueError(f'Animation {animation} has unexplained trailing bytes')
    return dict(meshes=source['meshes'], parents=source['parents'], frames=frames, channels=channels,
                consumed=cursor - base - offset, budget=end - base - offset, padding=len(padding))


def pose(decoded, frame, near=True):
    if not 0 <= frame < decoded['frames']:
        raise ValueError('Animation frame outside clip')
    values = [[channel[frame] for channel in bone] for bone in decoded['channels']]
    matrices = [rotation(value[:3]) for value in values]
    translations = [None] * len(values)

    def translation(index, visiting=()):
        if index in visiting:
            raise ValueError('Cyclic skeleton')
        if translations[index] is None:
            parent, value = decoded['parents'][index], values[index][3:]
            if parent != index:
                value = [a + b for a, b in zip(transform(matrices[parent], value),
                                               translation(parent, (*visiting, index)))]
            translations[index] = [signed16(v) for v in value]
        return translations[index]

    points, anchors = [], []
    for index, mesh in enumerate(decoded['meshes']):
        translation(index)
        part = []
        for vertex, kind in zip(mesh['vertices'], mesh['types']):
            if kind not in (0, 1, 2):
                raise ValueError('Unsupported super vertex type')
            if kind == 2:
                part.append(None)
                continue
            x, y, z = vertex  # The shared mesh reader has already made Y point up.
            raw = [x, -y, z]
            if near:
                q = [(v + t) / 16 for v, t in zip(transform(matrices[index], raw), translations[index])]
            else:
                q = [v + (t >> 4) for v, t in zip(transform(matrices[index], [v >> 4 for v in raw]), translations[index])]
            point = [q[0], -q[1], q[2]]
            part.append(point)
            if kind == 1:
                anchors.append(point)
        points.append(part)
    # Resolve stitch references after collecting all anchors in mesh-storage order.
    for index, mesh in enumerate(decoded['meshes']):
        for vertex, kind in enumerate(mesh['types']):
            if kind == 2:
                x, negative_anchor, z = mesh['vertices'][vertex]
                anchor = -negative_anchor
                if x or z or not 0 <= anchor < len(anchors):
                    raise ValueError('Invalid stitch reference')
                points[index][vertex] = anchors[anchor]
    return points


def bounds(points):
    low = [min(v[k] for v in points) for k in range(3)]
    high = [max(v[k] for v in points) for k in range(3)]
    return dict(low=low, high=high, size=[high[k] - low[k] for k in range(3)])


def pose_bounds(decoded, frame, near=True):
    posed = pose(decoded, frame, near)
    selected = [(i, posed[i][j]) for i, mesh in enumerate(decoded['meshes'])
                for j in sorted({v for face in mesh['faces'] for v in face['indices']})]
    # This partition is explicitly HAWK's 19-part mesh layout, not a generic bone-name inference.
    return dict(all=bounds([p for _, p in selected]), body=bounds([p for i, p in selected if i >= 3]),
                board=bounds([p for i, p in selected if i < 3]))


def verify_trig(path):
    text = re.sub(r'/\*.*?\*/|//[^\n]*', '', path.read_text(), flags=re.S)
    match = re.search(r'\brcossin_tbl\s*\[\d+\]\s*=\s*\{([^}]+)\}', text)
    if not match:
        raise ValueError('No sin/cos table in reference source')
    values = list(map(int, re.findall(r'-?\d+', match[1])))
    expected = [v for angle in range(4096) for v in sincos(angle)]
    if len(values) < len(expected) or values[:len(expected)] != expected:
        raise ValueError('Computed rotation table differs from source')
    return dict(pairs=4096, mismatches=0, sha256=hashlib.sha256(path.read_bytes()).hexdigest())


def survey(path, trig_source=None):
    source = read_source(path)
    if len(source['meshes']) != 19 or len(source['entries']) != 78:
        raise ValueError('HAWK pose/part selection requires the 19-mesh, 78-clip reference')
    records, clips = [], []
    for animation in range(len(source['entries'])):
        decoded = decode(source, animation)
        clips.append(dict(animation=animation, **{k: decoded[k] for k in ('frames', 'consumed', 'budget', 'padding')}))
        if animation in (0, 8, 14):
            records.append(dict(animation=animation, frames=decoded['frames'],
                                poses=[dict(frame=frame, near=pose_bounds(decoded, frame),
                                            far=pose_bounds(decoded, frame, near=False))
                                       for frame in range(decoded['frames'])]))
    return dict(input=dict(name=path.name, bytes=len(source['data']), sha256=hashlib.sha256(source['data']).hexdigest()),
                coordinates='X, -Y, Z in original whole engine units; no metre conversion',
                superVertexDivisor=16, renderer='Model-space near/far precision; no camera transform or item scaling',
                trig=verify_trig(trig_source) if trig_source else None, clips=clips, measurements=records)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('psx', type=Path)
    parser.add_argument('--trig-source', type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args()
    result = survey(args.psx, args.trig_source)
    args.out.write_text(json.dumps(result, indent=2) + '\n')
    print(f"Surveyed {len(result['clips'])} clips; wrote {args.out}")
