#!/usr/bin/env python3
"""Decode the retained Mall wooden-box model and its twelve literal placements.

Inputs are local SKMALL_O.PSX and SKMALL_T.TRG files. No scripts are executed.
Usage: mall-source-props.py RETAIL_DIR OUTPUT_JSON TEXTURE_DIR
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys


def read(fmt, data, offset, end=None):
    if offset < 0 or offset + struct.calcsize(fmt) > (len(data) if end is None else min(end,len(data))):
        raise ValueError('Field exceeds its bounded source record')
    return struct.unpack_from(fmt, data, offset)


def placements(data):
    magic, version, count = read('<4sII', data, 0)
    if magic != b'_TRG' or version != 2 or not 0 < count <= 10000:
        raise ValueError('Expected bounded TRG v2')
    offsets = read(f'<{count}I', data, 12)
    if any(a>=b for a,b in zip(offsets,offsets[1:])) or offsets[0] < 12 + count * 4 or offsets[-1]+2 > len(data):
        raise ValueError('Invalid node offsets')
    result = []
    for node, (start, end) in enumerate(zip(offsets, [*offsets[1:], len(data)])):
        if read('<H', data, start, end)[0] != 1:
            continue
        kind, seed, links = read('<3H', data, start + 2, end)
        if kind != 402:
            continue
        p = start + 8 + links * 2
        flags = []
        while p < end and data[p] != 255:
            flags.append(data[p]); p += 1
        if p >= end:
            raise ValueError('Unterminated platform flags')
        p = (p + 1 + 3) // 4 * 4
        position = read('<3i', data, p, end); angles = read('<3h', data, p + 12, end)
        p += 18
        command, checksum = read('<HI', data, p, end)
        if command != 0x212f or checksum != 0x92331c98:
            continue
        # Model assignment; C_IS_BOUNCY wooden box; label/goto-break loop; done.
        tail = struct.pack('<7H', 0x4309, 5, 0x4104, 0, 0x4102, 0, 0x4100)
        if data[p + 6:end] != tail or links or seed != 4096 or flags != [0, 2, 4]:
            raise ValueError('Wooden box has an unsupported creation/script layout')
        if angles[0] or angles[2]:
            raise ValueError('Unexpected box pitch/roll')
        result.append(dict(node=node, position=list(position), angles=list(angles),
                           model='92331c98', bouncyType=5, flags=flags))
    if len(result) != 12:
        raise ValueError('Expected twelve original wooden boxes')
    return result


def extract(root, texture_dir):
    from PIL import Image
    spec = importlib.util.spec_from_file_location('psx_survey', Path(__file__).with_name('school-source-survey.py'))
    parser = importlib.util.module_from_spec(spec); spec.loader.exec_module(parser)
    path = root / 'SKMALL_O.PSX'; data = path.read_bytes()
    objects, meshes = parser.parse_mesh(path)
    ids = [i for i, mesh in enumerate(meshes) if mesh['checksum'] == '92331c98']
    if len(ids) != 1:
        raise ValueError('Expected one wooden-box model')
    model_id = ids[0]; model = meshes[model_id]
    version, metadata, object_count = read('<3I', data, 0)
    if version != 0x20004:
        raise ValueError('Expected PSX v4')
    table = 12 + object_count * 36; model_count, = read('<I', data, table)
    pointers = read(f'<{model_count}I', data, table + 4)
    header = pointers[model_id]; flags, nv, nn, nf = read('<4H', data, header)
    box = list(read('<6h', data, header + 12))
    p = header + 28 + nv * 8 + nn * 8; faces = []
    for _ in range(nf):
        flags, size = read('<2H', data, p)
        if flags != 0x1003 or size != 28:
            raise ValueError('Expected bounded textured flat quads')
        ids = read('<4B', data, p + 4); color = read('<3B', data, p + 8)
        texture, = read('<I', data, p + 16); uv = read('<8B', data, p + 20)
        order = [0, 1, 3, 2]
        faces.append(dict(vertices=[model['vertices'][ids[i]] for i in order],
                          uv=[[uv[i*2], uv[i*2+1]] for i in order], color=list(color), textureIndex=texture))
        p += size
    p = metadata
    while read('<I', data, p)[0] != 0xffffffff:
        _, size = read('<2I', data, p)
        if size > len(data) - p - 8:
            raise ValueError('Metadata packet exceeds input')
        p += 8 + size
    p += 4 + model_count * 4
    count, = read('<I', data, p); texture_crcs = read(f'<{count}I', data, p + 4); p += 4 + count * 4
    palettes = {}
    for colors in [16, 256]:
        count, = read('<I', data, p); p += 4
        for _ in range(count):
            crc, = read('<I', data, p); palette = read(f'<{colors}H', data, p + 4); p += 4 + colors * 2
            palettes[crc] = palette
    count, = read('<I', data, p); offsets = read(f'<{count}I', data, p + 4)
    needed = {face['textureIndex'] for face in faces}; textures = []
    texture_dir.mkdir(parents=True, exist_ok=True)
    for p in offsets:
        flags, colors, palette, index, w, h = read('<4I2H', data, p)
        if index not in needed:
            continue
        if colors not in [16, 256] or not 0 < w <= 256 or not 0 < h <= 256:
            raise ValueError('Unsupported bounded texture')
        length = w * h * (1 if colors == 256 else .5)
        pixels = read(f'<{int(length)}B', data, p + 20)
        values = pixels if colors == 256 else [n for byte in pixels for n in [byte & 15, byte >> 4]]
        clut = palettes[palette]
        rgba = [((clut[i] & 31) * 255 // 31, ((clut[i] >> 5) & 31) * 255 // 31,
                 ((clut[i] >> 10) & 31) * 255 // 31, 0 if clut[i] == 0 else 255) for i in values]
        image = Image.new('RGBA', (w, h)); image.putdata(rgba)
        name = f'box-{texture_crcs[index]:08x}.png'; image.save(texture_dir / name)
        textures.append(dict(index=index, checksum=f'{texture_crcs[index]:08x}', file=name, width=w, height=h,
                             sha256=hashlib.sha256((texture_dir / name).read_bytes()).hexdigest()))
    if {t['index'] for t in textures} != needed:
        raise ValueError('Missing box texture')
    return dict(schema=1, provenance={'variant':'Original Mall objects retained in THPS2 retail; not byte-verified against the 1999 disc',
                'files':[parser.fingerprint(root / n) for n in ['SKMALL_O.PSX','SKMALL_T.TRG']],
                'sourceRevision':'d9319c8d5b42c431de02bec0f02f0cf955f2fbae'},
                model=dict(checksum='92331c98', vertices=model['vertices'], nativeBounds=box, faces=faces),
                textures=textures, placements=placements((root / 'SKMALL_T.TRG').read_bytes()))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    root, output, textures = map(Path, sys.argv[1:])
    result = extract(root, textures); output.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps({'placements':len(result['placements']), 'faces':len(result['model']['faces']), 'textures':result['textures']}))
