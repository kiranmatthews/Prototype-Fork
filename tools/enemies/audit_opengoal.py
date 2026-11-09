#!/usr/bin/env python3
"""Inventory enemy reference facts without importing OpenGOAL implementation code.

Reads an existing official source checkout and this project's lossless GLB pack.
Outputs hashes, identifiers, clip/skin measurements and our editorial assessment.
It never copies source expressions, changes game assets or alters the effects lab.
"""
import argparse
import gzip
import hashlib
import json
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'b6c8430c0b0a5cb139b939bcf0ffd25285b896c7'
LINK = f'https://github.com/open-goal/jak-project/blob/{REVISION}/goal_src/'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def glb(data):
    magic, version, size = struct.unpack_from('<III', data)
    if magic != 0x46546c67 or version != 2 or size != len(data):
        raise ValueError('Invalid GLB header')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4e4f534a:
        raise ValueError('Missing GLB JSON')
    document = json.loads(data[20:20+length])
    start = 20 + length
    binary = b''
    if start < len(data):
        length, kind = struct.unpack_from('<II', data, start)
        if kind != 0x004e4942:
            raise ValueError('Missing GLB BIN')
        binary = data[start+8:start+8+length]
    return document, binary

def floats(document, binary, index):
    accessor = document['accessors'][index]
    if accessor['componentType'] != 5126 or 'sparse' in accessor:
        raise ValueError('Unsupported animation accessor')
    size = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    view = document['bufferViews'][accessor['bufferView']]
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    stride = view.get('byteStride', size * 4)
    return [struct.unpack_from('<'+'f'*size, binary, offset+i*stride) for i in range(accessor['count'])]

def measure(model, pack):
    compressed = (pack / 'assets' / model['path']).read_bytes()
    if sha(compressed) != model['sha256']:
        raise ValueError(f"Changed model: {model['id']}")
    data = gzip.decompress(compressed)
    if sha(data) != model['decodedSha256']:
        raise ValueError('Decoded hash mismatch')
    document, binary = glb(data)
    parents = {child: i for i, node in enumerate(document['nodes']) for child in node.get('children', [])}
    joints = sorted({i for skin in document.get('skins', []) for i in skin['joints']})
    clips = []
    for animation in document.get('animations', []):
        clocks = [floats(document, binary, s['input']) for s in animation['samplers']]
        times = [v[0] for clock in clocks for v in clock]
        paths = sorted({c['target']['path'] for c in animation['channels']})
        nodes = sorted({c['target']['node'] for c in animation['channels']})
        clips.append(dict(name=animation['name'], duration=round(max(times, default=0), 6),
                          channels=len(animation['channels']), animatedNodes=len(nodes), paths=paths,
                          maxKeys=max((len(clock) for clock in clocks), default=0)))
    triangles = 0
    for mesh in document.get('meshes', []):
        for primitive in mesh['primitives']:
            if primitive.get('mode', 4) != 4:
                raise ValueError('Unsupported non-triangle primitive')
            triangles += document['accessors'][primitive['indices']]['count'] // 3
    return dict(path='jak-lab/assets/'+model['path'], sha256=model['sha256'],
                decodedSha256=model['decodedSha256'], decodedBytes=model['decodedBytes'],
                sourceSha256=model['sourceSha256'], bytes=len(compressed), triangles=triangles,
                skinCount=len(document.get('skins', [])), jointCount=len(joints),
                joints=[dict(index=i, name=document['nodes'][i].get('name', str(i)),
                             parent=parents.get(i)) for i in joints], clips=clips)

def main():
    # Keep the original audit command usable; character preparation now owns
    # the Jak 1-only catalogue and recovered action data.
    from prepare_jak1_characters import main as prepare
    prepare()


if __name__ == '__main__':
    main()
