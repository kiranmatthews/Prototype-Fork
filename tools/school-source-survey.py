"""Survey local School PSX v4 / TRG v2 files.

Usage: python3 tools/school-source-survey.py --psx SKSCHL.PSX
       --trg SKSCHL_T.TRG --out report.json [--geometry-out source.json]

Coordinates retain whole engine units; only Y is inverted for a Y-up survey.
Object translations use 20.12 fixed point, mesh vertices use signed shorts,
and TRG positions use whole units. No metre or skater scale is inferred.

Format reference: slfx77/neversoft-multitool at
3c9028e0178deb9060190362d1c47039a32846e2, Core/Formats/Mesh/Psx and Trg.
"""
import argparse
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import struct


def unpack(fmt, data, offset):
    size = struct.calcsize(fmt)
    if offset < 0 or offset + size > len(data):
        raise ValueError(f'{fmt} at {offset} exceeds {len(data)} bytes')
    return struct.unpack_from(fmt, data, offset)


def fingerprint(path):
    data = path.read_bytes()
    return {'file': path.name, 'bytes': len(data),
            'sha256': hashlib.sha256(data).hexdigest()}


def parse_mesh(path):
    data = path.read_bytes()
    version, meta, count = unpack('<3I', data, 0)
    if version != 0x00020004:
        raise ValueError('Expected PSX v4 with the 0x0002 marker')
    objects = []
    for i in range(count):
        p = 12 + i * 36
        flags, x, y, z = unpack('<I3i', data, p)
        mesh, = unpack('<H', data, p + 22)
        objects.append({'id': i, 'flags': flags, 'mesh': mesh,
                        'position': [x / 4096, -y / 4096, z / 4096]})
    p = 12 + count * 36
    mesh_count, = unpack('<I', data, p)
    pointers = unpack(f'<{mesh_count}I', data, p + 4)
    meshes = []
    for p in pointers:
        flags, nv, nn, nf = unpack('<4H', data, p)
        lod_depth, lod_next = unpack('<hH', data, p + 24)
        p += 28
        vertices, types = [], []
        for _ in range(nv):
            x, y, z, kind = unpack('<3hH', data, p)
            p += 8
            vertices.append([x, -y, z])
            types.append(kind)
        p += nn * 8
        faces = []
        for _ in range(nf):
            face_flags, size = unpack('<2H', data, p)
            if size < 16 or p + size > len(data):
                raise ValueError(f'Invalid face record at {p}')
            ids = list(unpack('<4B', data, p + 4))
            ids = ids[:3] if face_flags & 0x10 else [ids[k] for k in (0, 1, 3, 2)]
            if max(ids) >= nv:
                raise ValueError(f'Face vertex index exceeds {nv} vertices')
            collision, = unpack('<H', data, p + 14)
            rgb = list(unpack('<3B', data, p + 8))
            faces.append({'indices': ids, 'flags': face_flags, 'collision': collision,
                          'color': rgb})
            p += size
        meshes.append({'flags': flags, 'vertices': vertices, 'types': types,
                       'faces': faces, 'lodDepth': lod_depth, 'lodNext': lod_next})
    p = meta
    while unpack('<I', data, p)[0] != 0xffffffff:
        size, = unpack('<I', data, p + 4)
        if p + 8 + size > len(data):
            raise ValueError('Metadata chunk exceeds file')
        p += 8 + size
    checksums = unpack(f'<{mesh_count}I', data, p + 4)
    for mesh, checksum in zip(meshes, checksums):
        mesh['checksum'] = f'{checksum:08x}'
    if any(o['mesh'] >= mesh_count for o in objects):
        raise ValueError('Object references an unavailable mesh')
    return objects, meshes


def parse_nodes(path):
    data = path.read_bytes()
    magic, version, count = unpack('<4s2I', data, 0)
    if magic != b'_TRG' or version != 2:
        raise ValueError('Expected TRG v2.0')
    offsets = unpack(f'<{count}I', data, 12)
    if list(offsets) != sorted(offsets) or offsets[0] < 12 + count * 4:
        raise ValueError('Invalid node offset table')
    nodes = []
    for i, p in enumerate(offsets):
        kind, = unpack('<H', data, p)
        node = {'id': i, 'type': kind}
        if kind in (3, 8, 10, 11):
            n, = unpack('<H', data, p + 2)
            links = list(unpack(f'<{n}H', data, p + 4))
            if any(link >= count for link in links):
                raise ValueError('Node link is outside node table')
            q = (p + 4 + n * 2 + 3) // 4 * 4
            x, y, z = unpack('<3i', data, q)
            node.update(links=links, position=[x, -y, z])
            if kind == 8:
                end = offsets[i + 1] if i + 1 < count else len(data)
                terminator = data.find(b'\0', q + 18, end)
                if terminator < 0:
                    raise ValueError('Unterminated restart name')
                node['name'] = data[q + 18:terminator].decode('ascii')
        nodes.append(node)
    return nodes


def survey(psx_path, trg_path):
    objects, meshes = parse_mesh(psx_path)
    nodes = parse_nodes(trg_path)
    rails = [n for n in nodes if n['type'] in (10, 11)]
    edges = {(n['id'], link) for n in rails for link in n['links']
             if nodes[link]['type'] in (10, 11)}
    result = {
        'files': [fingerprint(psx_path), fingerprint(trg_path)],
        'coordinates': 'X, -Y, Z in whole engine units; no metre conversion',
        'objects': len(objects), 'meshes': len(meshes),
        'vertices': sum(len(m['vertices']) for m in meshes),
        'faces': sum(len(m['faces']) for m in meshes),
        'vertexTypes': dict(Counter(t for m in meshes for t in m['types'])),
        'nodes': len(nodes), 'nodeTypes': dict(Counter(n['type'] for n in nodes)),
        'railNodes': len(rails), 'directedRailLinks': len(edges),
        'restarts': [n for n in nodes if n['type'] == 8],
    }
    # This cross-section is identified by object AND mesh checksum, not by a
    # collision-array index. Fail closed on a different School revision.
    bank = objects[718] if len(objects) > 718 else None
    if bank and meshes[bank['mesh']]['checksum'] == '63a7309c':
        mesh = meshes[bank['mesh']]
        points = set()
        for face in mesh['faces']:
            if face['collision'] != 0x400:
                continue
            for index in face['indices']:
                v = tuple(mesh['vertices'][index][k] + bank['position'][k] for k in range(3))
                if v[2] == 9031:
                    points.add(v)
        section = sorted(points, reverse=True)
        if len(section) != 3:
            raise ValueError('School bank section did not have the expected three stations')
        toe, middle, top = section
        run, rise = abs(top[0] - toe[0]), top[1] - toe[1]
        floor_y = min(v[1] + bank['position'][1] for v in mesh['vertices'])
        result['gymBankCrossSection'] = {
            'object': 718, 'meshChecksum': mesh['checksum'], 'stations': section,
            'floorY': floor_y, 'toeStep': toe[1] - floor_y,
            'faceRun': run, 'faceRise': rise, 'heightAboveFloor': top[1] - floor_y,
            'faceAngleDegrees': math.degrees(math.atan2(rise, run)),
        }
    return result


def geometry(psx_path, trg_path):
    """Keep source measurements and flags; omit textures, scripts and sprites.

    The level factory owns the unit conversion. Collision-only faces remain
    present: the opaque draw-enable flag is independent of solid geometry.
    """
    objects, meshes = parse_mesh(psx_path)
    result = {'v': 1, 'files': [fingerprint(psx_path), fingerprint(trg_path)],
              'coordinates': 'X, -Y, Z in whole original engine units',
              'meshes': [], 'railNodes': [], 'restarts': [], 'skippedSpriteFaces': 0}
    for obj in objects:
        mesh = meshes[obj['mesh']]
        vertices = [v[k] + obj['position'][k] for v in mesh['vertices'] for k in range(3)]
        faces = []
        for index, face in enumerate(mesh['faces']):
            if any(mesh['types'][i] & 16 for i in face['indices']):
                result['skippedSpriteFaces'] += 1
                continue
            faces.append([index, face['flags'], face['collision'],
                          *face['color'], *face['indices']])
        if faces:
            used = sorted({i for f in faces for i in f[6:]})
            remap = {index: i for i, index in enumerate(used)}
            result['meshes'].append({
                'id': obj['id'], 'checksum': mesh['checksum'],
                'vertices': [vertices[i * 3 + k] for i in used for k in range(3)],
                'faces': [f[:6] + [remap[i] for i in f[6:]] for f in faces],
            })
    nodes = parse_nodes(trg_path)
    result['railNodes'] = [n for n in nodes if n['type'] in (10, 11)]
    result['restarts'] = [n for n in nodes if n['type'] == 8]
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--psx', required=True, type=Path)
    parser.add_argument('--trg', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--geometry-out', type=Path)
    args = parser.parse_args()
    result = survey(args.psx, args.trg)
    args.out.write_text(json.dumps(result, indent=2) + '\n')
    if args.geometry_out:
        args.geometry_out.parent.mkdir(parents=True, exist_ok=True)
        args.geometry_out.write_text(json.dumps(geometry(args.psx, args.trg), separators=(',', ':')) + '\n')
    print(f"School survey: {result['objects']} objects, {result['faces']} faces, "
          f"{result['railNodes']} rail nodes; geometry export: {bool(args.geometry_out)}")
