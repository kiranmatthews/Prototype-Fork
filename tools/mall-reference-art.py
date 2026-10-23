#!/usr/bin/env python3
"""Read the already-downloaded Mall conversion's static scene and texture data.

Usage: python3 tools/mall-reference-art.py archive.zip scene.json texture-directory
The THUG2 field layout is documented by denetii/io_thps_scene's import_thug2.py,
material.py and tex.py. This independent bounded reader executes no game code.
Pillow is used only to decode the archive's DXT texture blocks.
"""
import collections
import hashlib
import importlib.util
import io
import json
import math
from pathlib import Path
import struct
import sys
import zipfile


class Reader:
    def __init__(self, data):
        self.data, self.offset = data, 0

    def read(self, fmt):
        fmt = '<' + fmt
        size = struct.calcsize(fmt)
        assert self.offset + size <= len(self.data), (self.offset, size)
        result = struct.unpack_from(fmt, self.data, self.offset)
        self.offset += size
        return result[0] if len(result) == 1 else list(result)

    def take(self, size):
        assert 0 <= size and self.offset + size <= len(self.data)
        result = self.data[self.offset:self.offset + size]
        self.offset += size
        return result


def scene(data):
    r = Reader(data)
    assert r.read('3I') == [1, 1, 1]
    materials = {}
    count = r.read('I')
    assert 0 < count < 10000
    for _ in range(count):
        checksum, name, passes, cutoff = r.read('4I')
        assert 0 < passes <= 8
        sort, order, single, double, bias, grass = [r.read(f) for f in ['?', 'f', '?', '?', 'i', '?']]
        if grass:
            r.take(8)
        specular = r.read('f')
        if specular > 0:
            r.take(12)
        material = dict(checksum=checksum, name=name, cutoff=cutoff, sorted=sort,
                        order=order, single=single, double=double, bias=bias, passes=[])
        for i in range(passes):
            texture, flags = r.read('2I')
            has_color, color = r.read('?'), r.read('3f')
            blend, alpha, wrap_u, wrap_v = r.read('4I')
            environment, filtering = r.read('2f'), r.read('I')
            item = dict(texture=texture, flags=flags, color=color, blend=blend,
                        alpha=alpha & 255, wrap=[wrap_u, wrap_v])
            if flags & 1:
                item['uvAnimation'] = r.read('8f')
            if i == 0 and flags & 2:
                for _ in range(r.read('I')):
                    keys = r.read('I')
                    r.take(4 + keys * 8)
            if flags & 2048:
                keys, period, iterations, phase = r.read('4i')
                item['textureAnimation'] = dict(period=period, iterations=iterations,
                                                 phase=phase, keys=[r.read('2I') for _ in range(keys)])
            r.take(16)  # minification/magnification and LOD settings
            material['passes'].append(item)
        assert checksum not in materials
        materials[checksum] = material
    sectors = []
    count = r.read('i')
    assert 0 < count < 10000
    for sector_id in range(count):
        checksum, bone, flags, meshes = r.read('IiII')
        assert bone == -1 and not (flags & 16), 'Static, unweighted scene expected'
        bbox, sphere = r.read('6f'), r.read('4f')
        billboard = None
        if flags & 0x800000:
            billboard = dict(type=r.read('I'), origin=r.read('3f'), pivot=r.read('3f'), axis=r.read('3f'))
        sector = dict(id=sector_id, checksum=checksum, flags=flags, bbox=bbox, billboard=billboard, meshes=[])
        assert 0 <= meshes < 10000
        for mesh_id in range(meshes):
            r.take(40)  # mesh bounding sphere and box
            mesh_flags, material, lods = r.read('3I')
            assert material in materials and 0 < lods <= 16
            for lod in range(lods):
                r.take(r.read('I') * 2)
                count = r.read('H')
                strip = r.read(str(count) + 'H') if count else []
                r.take(14)
                stride, nv, buffers = r.read('BHH')
                assert 12 <= stride <= 128 and 0 < buffers <= 8
                vertices, colors, uvs, normals = [], [], [], []
                for buffer in range(buffers):
                    if buffer:
                        r.take(1)
                    length = r.read('i')
                    assert length == nv * stride
                    raw = r.take(length)
                    if buffer:
                        continue
                    for vertex in range(nv):
                        at = vertex * stride
                        p = list(struct.unpack_from('<3f', raw, at))
                        assert all(math.isfinite(x) for x in p)
                        vertices.extend(p)
                        used = 12
                        if flags & 4:
                            normals.extend(struct.unpack_from('<3f', raw, at + used))
                            used += 12
                        if flags & 2:
                            b, g, red, a = struct.unpack_from('<4B', raw, at + used)
                            colors.extend([red, g, b, a])
                            used += 4
                        if flags & 1:
                            assert (stride - used) % 8 == 0
                            uvs.extend(struct.unpack_from('<2f', raw, at + used))
                indices = []
                for k in range(2, len(strip)):
                    triangle = [strip[k - 2], strip[k - 1], strip[k]] if k % 2 == 0 else [strip[k - 2], strip[k], strip[k - 1]]
                    assert all(i < nv for i in triangle)
                    if len(set(triangle)) == 3:
                        indices.extend(triangle)
                r.take(11)
                if r.read('B'):
                    r.take(nv)
                r.take(4)
                shader = r.read('i')
                if shader == 1:
                    r.take(4)
                    r.take(r.read('i'))
                if lod == 0:
                    sector['meshes'].append(dict(id=mesh_id, material=material, flags=mesh_flags,
                                                vertices=vertices, indices=indices, colors=colors,
                                                normals=normals, uvs=uvs))
        sectors.append(sector)
    if r.offset + 4 == len(data):
        assert r.read('I') == 0  # Empty hierarchy table.
    assert r.offset == len(data), (r.offset, len(data))
    return dict(materials=list(materials.values()), sectors=sectors)


def textures(data, folder, wanted):
    from PIL import Image
    r = Reader(data)
    assert r.read('I') == 777
    result = []
    for _ in range(r.read('I')):
        checksum, width, height, levels, depth, palette_depth, dxt, palette_size = r.read('8I')
        assert 0 < width <= 4096 and 0 < height <= 4096 and depth == 32 and not palette_size
        assert 0 < levels <= 16
        for level in range(levels):
            pixels = r.take(r.read('I'))
            if level or checksum not in wanted:
                continue
            if dxt in [1, 2, 5]:
                fourcc = int.from_bytes(b'DXT5' if dxt == 5 else b'DXT1', 'little')
                header = [124, 0x81007, height, width, len(pixels), 0, 0] + [0] * 11
                header += [32, 4, fourcc, 0, 0, 0, 0, 0, 0x1000, 0, 0, 0, 0]
                image = Image.open(io.BytesIO(b'DDS ' + struct.pack('<31I', *header) + pixels)).convert('RGBA')
            else:
                assert dxt == 0 and len(pixels) == width * height * 4
                image = Image.frombytes('RGBA', (width, height), pixels, 'raw', 'BGRA')
            path = folder / f'{checksum:08x}.png'
            image.save(path, optimize=True)
            histogram = image.getchannel('A').histogram()
            result.append(dict(checksum=checksum, width=width, height=height, file=path.name,
                               alpha=image.getextrema()[3], translucent=sum(histogram[1:255]) > width * height * .01,
                               sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    assert r.offset == len(data)
    return result


def main(archive, output, texture_folder):
    spec = importlib.util.spec_from_file_location('mall_survey', Path(__file__).with_name('mall-reference-survey.py'))
    survey = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(survey)
    with zipfile.ZipFile(archive) as z:
        entries = survey.pre_entries(z.read('user/data/pre/THPS1Mallscn.prx'))
    raw_scene = entries['Levels\\THPS1Mall\\THPS1Mall.scn.xbx']
    raw_textures = entries['Levels\\THPS1Mall\\THPS1Mall.tex.xbx']
    result = scene(raw_scene)
    # The archive's first 18 sectors are its modified movable cereal boxes;
    # its final six are conversion gameplay helpers. Static PS1 scenery is
    # already in world coordinates, including the two visual-only sectors.
    assert len(result['sectors']) == 49
    result['sectors'] = [s for s in result['sectors'] if 18 <= s['id'] < 43]
    used_materials = {m['material'] for s in result['sectors'] for m in s['meshes']}
    result['materials'] = [m for m in result['materials'] if m['checksum'] in used_materials]
    wanted = {p['texture'] for m in result['materials'] for p in m['passes']}
    texture_folder.mkdir(parents=True, exist_ok=True)
    result['textures'] = textures(raw_textures, texture_folder, wanted)
    result['provenance'] = dict(page='https://thpsx.com/creation-details/?obj=958',
                                archive='THPS1Mallv2.0.zip',
                                archiveSHA256=hashlib.sha256(archive.read_bytes()).hexdigest(),
                                credit='PS1 Mall by Neversoft; ripped and noded by letmynutzgo; conversion scripting by TylerLasagna.',
                                sceneSHA256=hashlib.sha256(raw_scene).hexdigest(),
                                textureSHA256=hashlib.sha256(raw_textures).hexdigest(),
                                formatReference='https://github.com/denetii/io_thps_scene')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    lookup = {t['checksum']: t for t in result['textures']}
    manifest = []
    for m in result['materials']:
        p = m['passes'][0]
        t = lookup.get(p['texture'])
        if not t:
            continue
        manifest.append(dict(kind=f"mall-{m['checksum']:08x}", file=f"mall-reference/{t['file']}",
                             cutoff=max(1, m['cutoff']) / 255,
                             transparent=p['blend'] != 0 and t['translucent'], wrap=p['wrap']))
    output.with_name(output.stem + '-textures.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(json.dumps(dict(materials=len(result['materials']), sectors=len(result['sectors']),
                          meshes=sum(len(s['meshes']) for s in result['sectors']), textures=len(result['textures']),
                          vertices=sum(len(m['vertices']) // 3 for s in result['sectors'] for m in s['meshes']),
                          triangles=sum(len(m['indices']) // 3 for s in result['sectors'] for m in s['meshes']))))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*map(Path, sys.argv[1:]))
