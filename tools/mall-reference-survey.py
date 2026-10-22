#!/usr/bin/env python3
"""Read the public PS1 Mall conversion as measurement evidence, without running it.

Usage: python3 tools/mall-reference-survey.py /path/THPS1Mallv2.0.zip output.json
Only collision vertices, face flags, rail nodes and object placements are emitted.
The conversion's rails are author-created evidence, not verified original TRG data.
"""
import collections
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys
import zipfile
import zlib


def pre_entries(data):
    size, version, count = struct.unpack_from('<3I', data)
    assert size == len(data) and version == 0xabcd0003
    offset = 12
    result = {}
    for _ in range(count):
        length, packed, name_length, _checksum = struct.unpack_from('<4I', data, offset)
        offset += 16
        assert 0 < name_length < 4096 and offset + name_length <= len(data)
        name = data[offset:offset + name_length].split(b'\0')[0].decode('ascii')
        offset += name_length
        assert packed == 0, 'This measured archive has uncompressed PRE3 entries'
        assert offset + length <= len(data)
        assert name not in result
        result[name] = data[offset:offset + length]
        offset = (offset + length + 3) & ~3
    assert offset == len(data)
    return result


def collision(data):
    version, count, total_v, large_f, small_f, large_v, small_v, _ = struct.unpack_from('<8I', data)
    assert version == 10 and 0 < count < 10000
    assert total_v == large_v + small_v
    vertex_base = (32 + 64 * count + 15) & ~15
    intensity_base = vertex_base + 12 * large_v + 6 * small_v
    face_base = (intensity_base + total_v + 3) & ~3
    meshes = []
    for index in range(count):
        at = 32 + index * 64
        checksum, flags, nv, nf, small, fixed, face_start = struct.unpack_from('<IHHHBBI', data, at)
        assert small in (0, 1) and fixed in (0, 1)
        low = struct.unpack_from('<4f', data, at + 16)
        high = struct.unpack_from('<4f', data, at + 32)
        vertex_start = struct.unpack_from('<I', data, at + 48)[0]
        vertices, indices, face_flags, terrain = [], [], [], []
        for j in range(nv):
            p = vertex_base + vertex_start + j * (6 if fixed else 12)
            v = struct.unpack_from('<3H' if fixed else '<3f', data, p)
            if fixed:
                v = [low[k] + v[k] * .0625 for k in range(3)]
            assert all(math.isfinite(x) for x in v)
            assert all(low[k] - .1 <= v[k] <= high[k] + .1 for k in range(3))
            vertices.extend(v)
        for j in range(nf):
            p = face_base + face_start + j * (8 if small else 10)
            ff, tt = struct.unpack_from('<2H', data, p)
            triangle = struct.unpack_from('<3B' if small else '<3H', data, p + 4)
            assert all(i < nv for i in triangle)
            indices.extend(triangle)
            face_flags.append(ff)
            terrain.append(tt)
        meshes.append(dict(id=index, checksum=f'0x{checksum:08x}', objectFlags=flags,
                           vertices=vertices, indices=indices, flags=face_flags, terrain=terrain))
    assert sum(len(m['vertices']) // 3 for m in meshes) == total_v
    assert sum(len(m['indices']) // 3 for m in meshes) == large_f + small_f
    return meshes


def qb_name(name):
    return zlib.crc32(name.lower().replace('/', '\\').encode()) ^ 0xffffffff


def node_array(data):
    # Only the literal NodeArray is parsed. Game scripts and all bytecode outside
    # this array are ignored, and no original code is executed.
    known = ['Pos', 'Angles', 'Name', 'Class', 'RailNode', 'LevelGeometry', 'LevelObject',
             'EnvironmentObject', 'Restart', 'Type', 'TerrainType', 'Links', 'CreatedAtStart',
             'TrickObject', 'CollisionMode', 'TriggerScript', 'RestartName', 'GameObject']
    names = {qb_name(s): s for s in known}
    for match in re.finditer(rb'\x2b(.{4})([ -~]{1,180})\x00', data, re.S):
        checksum = struct.unpack('<I', match[1])[0]
        name = match[2].decode('ascii')
        if qb_name(name) == checksum:
            names[checksum] = name
    start = data.index(b'\x16' + struct.pack('<I', qb_name('THPS1Mall_NodeArray')))
    assert data[start + 5] == 7
    offset = start + 6

    def skip():
        nonlocal offset
        while data[offset] in (1, 9):
            offset += 1

    def value():
        nonlocal offset
        skip()
        token = data[offset]
        offset += 1
        if token == 3:
            item = {}
            while True:
                skip()
                if data[offset] == 4:
                    offset += 1
                    return item
                assert data[offset] == 0x16, (offset, data[offset])
                key = struct.unpack_from('<I', data, offset + 1)[0]
                offset += 5
                key = names.get(key, f'0x{key:08x}')
                assert key not in item
                if data[offset] == 7:
                    offset += 1
                    item[key] = value()
                else:
                    item[key] = True
        if token == 5:
            items = []
            while True:
                skip()
                if data[offset] == 6:
                    offset += 1
                    return items
                items.append(value())
        if token == 0x16:
            key = struct.unpack_from('<I', data, offset)[0]
            offset += 4
            return names.get(key, f'0x{key:08x}')
        if token in (0x17, 0x1a):
            result = struct.unpack_from('<i' if token == 0x17 else '<f', data, offset)[0]
            offset += 4
            return result
        if token in (0x1e, 0x1f):
            count = 3 if token == 0x1e else 2
            result = list(struct.unpack_from('<' + 'f' * count, data, offset))
            offset += 4 * count
            return result
        if token in (0x1b, 0x1c):
            length = struct.unpack_from('<I', data, offset)[0]
            offset += 4
            result = data[offset:offset + length].rstrip(b'\0').decode('utf-8')
            offset += length
            return result
        raise ValueError(f'Unsupported literal token {token:#x} at {offset - 1}')

    nodes = value()
    assert isinstance(nodes, list) and all(isinstance(n, dict) for n in nodes)
    for index, node in enumerate(nodes):
        node['index'] = index
        assert all(isinstance(j, int) and 0 <= j < len(nodes) for j in node.get('Links', []))
        assert len(node['Pos']) == 3 and all(math.isfinite(x) for x in node['Pos'])
    return nodes, names


def main(archive, output):
    raw = archive.read_bytes()
    with zipfile.ZipFile(archive) as source:
        # Read exact members in memory; no archive paths are written to disk.
        col_pre = source.read('user/data/pre/THPS1Mallcol.prx')
        script_pre = source.read('user/data/pre/THPS1Mall_scripts.prx')
    col = pre_entries(col_pre)['Levels\\THPS1Mall\\THPS1Mall.col.xbx']
    qb = pre_entries(script_pre)['Levels\\THPS1Mall\\THPS1Mall.qb']
    meshes = collision(col)
    nodes, names = node_array(qb)
    for mesh in meshes:
        mesh['name'] = names.get(int(mesh['checksum'], 16), mesh['checksum'])
    rails = [dict(index=n['index'], p=n['Pos'], links=n.get('Links', []),
                  terrain=n.get('TerrainType'), name=n.get('Name'))
             for n in nodes if n.get('Class') == 'RailNode']
    rail_ids = {n['index'] for n in rails}
    assert all(j in rail_ids for n in rails for j in n['links'])
    placements = [{k: n[k] for k in ['index', 'Name', 'Class', 'Pos', 'Angles', 'CreatedAtStart', 'TriggerScript'] if k in n}
                  for n in nodes if n.get('Class') != 'RailNode']
    stats = dict(meshes=len(meshes), vertices=sum(len(m['vertices']) // 3 for m in meshes),
                 triangles=sum(len(m['indices']) // 3 for m in meshes), railNodes=len(rails),
                 railLinks=sum(len(n['links']) for n in rails),
                 nodeClasses=dict(collections.Counter(n.get('Class', 'unclassified') for n in nodes)))
    result = dict(schema=1, provenance=dict(
        page='https://thpsx.com/creation-details/?obj=958',
        archive='THPS1Mallv2.0.zip', archiveSHA256=hashlib.sha256(raw).hexdigest(),
        collisionSHA256=hashlib.sha256(col).hexdigest(), nodesSHA256=hashlib.sha256(qb).hexdigest(),
        credit='PS1 Mall by Neversoft; ripped and noded by letmynutzgo; conversion scripting by TylerLasagna.',
        status='Measurement reference only; not integrated into the playable recreation yet.',
        limitations=['The conversion includes author-created rail nodes and gameplay changes; these are not original TRG rails.',
                     'Cereal-box appearance and multiplayer nodes are conversion changes; validate movable-object placement independently.',
                     'Coordinates retain source units and Y-up orientation; skater scale remains to be calibrated.',
                     'Static collision vertices are already world positions. Movable objects need separate placement.',
                     'No render meshes, texture artwork, audio, original scripts or executable data are emitted.']),
        statistics=stats, meshes=meshes, railNodes=rails, placements=placements)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(json.dumps(dict(output=str(output), **stats)))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(Path(sys.argv[1]), Path(sys.argv[2]))
