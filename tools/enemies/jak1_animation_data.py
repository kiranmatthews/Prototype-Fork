"""Read Jak 1 animation DATA omitted by the official GLB name routing.

This is an original data adapter, not an enemy/controller implementation.
The published GLB exporter is the independent oracle for every existing track.
Field offsets and lane encodings describe the pinned Jak 1 file format.
"""
from __future__ import annotations

import copy
import math
import struct

from merc_death import LinkedAssembly


class Lanes:
    def __init__(self, data, offsets, matrix_count=0):
        self.data = data
        self.at = list(offsets)
        self.at[0] += 64 * matrix_count

    def take(self, lane, kind, count, divisor):
        values = struct.unpack_from('<' + kind * count, self.data, self.at[lane])
        self.at[lane] += struct.calcsize(kind) * count
        return [value / divisor for value in values]

    def channel(self, path, wide=False):
        if path == 'rotation':
            return self.take(0, 'h', 4, 32768)
        if path == 'translation' and wide:
            return self.take(0, 'f', 2, 4096) + self.take(1, 'f', 1, 4096)
        divisor = 1024 if path == 'translation' else 4096
        return self.take(1, 'h', 2, divisor) + self.take(2, 'h', 1, divisor)


def read_animations(assembly: LinkedAssembly):
    result = []
    for kind, address in assembly.types:
        if kind != 'art-joint-anim':
            continue
        clock = assembly.pointer(address + 40)
        frames = assembly.read('I', clock)
        fixed = assembly.pointer(clock + 12)
        count = assembly.read('I', fixed + 56)
        matrices = assembly.read('I', fixed + 60) & 3
        modes = [(assembly.read('I', fixed + (j // 8) * 4) >> (j % 8 * 4)) & 15 for j in range(count)]
        offsets = [fixed + 80 + assembly.read('I', fixed + 64 + lane * 4) for lane in range(3)]
        animated_matrices = bin(matrices).count('1')
        stationary = Lanes(assembly.data, offsets, 2 - animated_matrices)
        constants, tracks = {}, {}
        paths = ('translation', 'rotation', 'scale')
        for joint, mode in enumerate(modes, 2):
            for bit, path in enumerate(paths):
                tracks[joint, path] = []
                if not mode & (1 << bit):
                    constants[joint, path] = stationary.channel(path, bool(mode & 8))
        for frame in range(frames):
            start = assembly.pointer(clock + 16 + frame * 4)
            offsets = [start + 16 + assembly.read('I', start + lane * 4) for lane in range(3)]
            moving = Lanes(assembly.data, offsets, animated_matrices)
            for joint, mode in enumerate(modes, 2):
                for bit, path in enumerate(paths):
                    value = moving.channel(path, bool(mode & 8)) if mode & (1 << bit) else constants[joint, path]
                    if not all(math.isfinite(v) for v in value):
                        raise ValueError('Non-finite source animation')
                    tracks[joint, path].append(value)
        speed = assembly.read('f', address + 16)
        result.append(dict(name=assembly.string(assembly.pointer(address + 4)),
                           joints=count + 2, frames=frames, fps=speed * 60 if speed > 0 else 30,
                           tracks=tracks))
    return result


def matching_animations(animations, name, joints, sibling_names):
    """Use the longest model-name prefix, then verify the complete joint count.

    Puffer's two expressions and the three fish colours intentionally share a rig.
    The final robot's 'basic' suffix names its body, not a separate animation bank.
    """
    base = name.removesuffix('-lod0')
    shared = {'puffer-main': 'puffer', 'puffer-mean': 'puffer',
              'robotboss-basic': 'robotboss'}
    if base.startswith('sunkenfisha-'):
        shared[base] = 'sunkenfisha'
    selected = []
    for animation in animations:
        matches = [n.removesuffix('-lod0') for n in sibling_names
                   if animation['name'].startswith(n.removesuffix('-lod0') + '-')]
        owner = max(matches, key=len) if matches else None
        wanted = (animation['name'].startswith(shared[base] + '-') if base in shared else owner == base)
        if wanted:
            if animation['joints'] != joints:
                raise ValueError(f"Wrong rig for {name}: {animation['name']} ({animation['joints']} != {joints})")
            selected.append(animation)
    return selected


def verify_exported_tracks(source, animations):
    """Compare all matching original GLB channels, including each stored key."""
    bank = {a['name']: a for a in animations}
    indices = {node: i for i, node in enumerate(source.doc['skins'][0]['joints'])}
    checked = 0
    for exported in source.doc.get('animations', []):
        original = bank.get(exported['name'])
        if original is None:
            continue  # Cinematic clips can be supplied by a separate stream.
        for channel in exported['channels']:
            path = channel['target']['path']
            if path == 'weights':
                continue  # Facial morphs stay in the original export, untouched.
            joint = indices[channel['target']['node']]
            sampler = exported['samplers'][channel['sampler']]
            expected = original['tracks'][joint, path]
            actual = source.rows(sampler['output'])
            if len(actual) != len(expected):
                raise ValueError(f"Frame mismatch: {exported['name']}")
            for row, values in zip(actual, expected):
                if row != struct.pack('<' + 'f' * len(values), *values):
                    raise ValueError(f"Track mismatch: {exported['name']} / {joint} / {path}")
            checked += 1
    return checked


def repair_animations(source, selected, all_source_names):
    """Keep existing correct tracks/morphs, remove foreign-rig clips, append missing.

    Mesh, texture, inverse-bind, node and existing valid animation data is never
    changed. The packer's semantic check subsequently verifies transport packing.
    """
    doc = copy.deepcopy(source.doc)
    wanted = {a['name'] for a in selected}
    original = doc.get('animations', [])
    doc['animations'] = [a for a in original if a['name'] in wanted or a['name'] not in all_source_names]
    removed = [a['name'] for a in original if a not in doc['animations']]
    existing = {a['name'] for a in doc['animations']}
    added = [a for a in selected if a['name'] not in existing]
    blob = bytearray()
    buffer_index = len(source.buffers)
    if added:
        doc['buffers'].append({'byteLength': 0})

    def accessor(rows, kind):
        while len(blob) % 4:
            blob.append(0)
        flat = [value for row in rows for value in row]
        raw = struct.pack('<' + 'f' * len(flat), *flat)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': buffer_index, 'byteOffset': len(blob), 'byteLength': len(raw)})
        blob.extend(raw)
        index = len(doc['accessors'])
        doc['accessors'].append({'bufferView': view, 'componentType': 5126, 'count': len(rows), 'type': kind})
        return index

    for animation in added:
        times = accessor([[i / animation['fps']] for i in range(animation['frames'])], 'SCALAR')
        channels, samplers = [], []
        for (joint, path), values in animation['tracks'].items():
            output = accessor(values, 'VEC4' if path == 'rotation' else 'VEC3')
            channels.append({'sampler': len(samplers), 'target': {'node': doc['skins'][0]['joints'][joint], 'path': path}})
            samplers.append({'input': times, 'output': output, 'interpolation': 'LINEAR'})
        doc['animations'].append({'name': animation['name'], 'channels': channels, 'samplers': samplers})
    if added:
        doc['buffers'][-1]['byteLength'] = len(blob)
    source.doc = doc
    if added:
        source.buffers.append(bytes(blob))
    return {'added': [a['name'] for a in added], 'removedWrongRig': removed}
