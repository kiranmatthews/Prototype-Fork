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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path, help='Official OpenGOAL goal_src directory')
    parser.add_argument('--source-tree', required=True, type=Path, help='Official recursive Git tree JSON for the pinned revision')
    parser.add_argument('--historical-catalogue', type=Path, help='Optional prior full model inventory; no asset availability inferred')
    parser.add_argument('--output', type=Path, default=ROOT/'public/enemies/opengoal-audit.json')
    args = parser.parse_args()
    tree = json.loads(args.source_tree.read_text())
    if tree.get('sha') != REVISION:
        raise ValueError('Source tree is not the pinned revision')
    if tree.get('truncated'):
        raise ValueError('Incomplete source tree')
    blobs = {row['path']:row['sha'] for row in tree['tree'] if row['type']=='blob'}
    verified = set()
    pack = ROOT/'public/jak-lab'
    catalogue = json.loads((pack/'catalogue.json').read_text())
    models = {m['id']: m for m in catalogue['models']}
    history = {m['id']:m for m in json.loads(args.historical_catalogue.read_text())['models']} if args.historical_catalogue else {}
    candidates = json.loads((ROOT/'tools/enemies/opengoal-candidates.json').read_text())
    for row in candidates:
        sources = []
        for relative in row['sources']:
            raw = (args.source/relative).read_bytes()
            blob = hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
            if blobs.get('goal_src/'+relative) != blob:
                raise ValueError(f'Source does not match official tree: {relative}')
            verified.add(relative)
            text = raw.decode()
            # Only public identifiers and their line locations, never function bodies.
            states = [dict(name=m.group(1), line=text.count('\n', 0, m.start())+1)
                      for m in re.finditer(r'^\(defstate\s+([^\s()]+)', text, re.M)]
            referenced = sorted(set(re.findall(r'\b([a-z][a-z0-9-]+)-ja\b', text)))
            sources.append(dict(path=relative, sha256=sha(raw), url=LINK+relative,
                                states=states, referencedClips=referenced))
        row['sources'] = sources
        if row['model'] in models:
            model = models[row['model']]
            row['availability'] = 'playable-clips'
            row['asset'] = measure(model, pack)
            row['areas'] = sorted({m['area'] for m in catalogue['models'] if m['name']==model['name']})
        else:
            row['availability'] = 'inventory-only' if row['model'] in history else 'source-only'
            row['asset'] = None
            row['areas'] = []
            if row['model'] in history:
                old = history[row['model']]
                row['historicalClips'] = [c['name'] for c in old['animations']]
                row['historicalSourceSha256'] = old['sha256']
    live = [r for r in candidates if r['asset']]
    report = dict(schemaVersion=1, auditedOn='2026-11-09', sourceRevision=REVISION,
                  sourceRelease='OpenGOAL v0.3.9', sourceVerification=dict(files=len(verified), gitBlobsMatch=True, treeSha=tree['sha']), sourceGame='User-supplied Jak 1 USA SCUS-97124 NTSC-v1',
                  scope='Curated enemy/host candidate audit across Jak 1–3. Jak 1 retained export measured; Jak 2/3 source survey only. Not an exhaustive trilogy asset inventory.',
                  provenance='Existing lossless reference assets only. No OpenGOAL implementation code copied. Behaviour and retargeting are proposals, not implemented gameplay.',
                  summary=dict(candidates=len(candidates), playableModels=len(live),
                               exportedClips=sum(len(r['asset']['clips']) for r in live),
                               timedClips=sum(c['duration']>0 for r in live for c in r['asset']['clips']),
                               staticPoses=sum(c['duration']==0 for r in live for c in r['asset']['clips']),
                               inventoryOnly=sum(r['availability']=='inventory-only' for r in candidates),
                               sourceOnly=sum(r['availability']=='source-only' for r in candidates),
                               firstPass=sum(r['priority']==1 for r in candidates)), candidates=candidates)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report['summary']))

if __name__ == '__main__':
    main()
