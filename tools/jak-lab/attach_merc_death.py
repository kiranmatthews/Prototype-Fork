#!/usr/bin/env python3
"""Attach verified model-death streams to a local source catalogue."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

from catalogue import parse


def profiles(project):
    relative = 'engine/gfx/merc/merc-death.gc'
    text = (project / 'goal_src/jak1' / relative).read_text()
    result = []
    for form in parse(text):
        if len(form) < 3 or form[0] != 'define' or not isinstance(form[2], list):
            continue
        value = form[2]
        if value[:3] != ['new', ['quote', 'static'], ['quote', 'death-info']]:
            continue
        fields = dict(zip(value[3::2], value[4::2]))
        result.append({'id': form[1], 'vertexSkip': fields.get(':vertex-skip', 0),
                       'frames': fields.get(':timer', 0), 'overlap': fields.get(':overlap', 0),
                       'particle': fields.get(':effect', 0), 'sound': fields.get(':sound', [None, None])[1],
                       'source': {'file': relative, 'line': form.line}})
    return result


def attach(catalogue, topology, project, asset_output):
    library = {'profiles': profiles(project), 'texture': 'effects/falls-particle', 'models': []}
    ids = {p['id'] for p in library['profiles']}
    output = asset_output / 'death'
    output.mkdir(parents=True, exist_ok=True)
    for model in catalogue['models']:
        if model['background']:
            continue
        data_file = topology / (model['area'] + '--' + model['name'] + '.json')
        data = json.loads(data_file.read_text())
        if data['sourceModelSha256'] != model['sha256']:
            raise ValueError('Source model identity changed: ' + model['id'])
        payload = {k: data[k] for k in ['version', 'meshNode', 'sourceVertices', 'positions', 'joints',
                                      'weights', 'morphPositions', 'effects', 'crossCopies']}
        raw = (json.dumps(payload, separators=(',', ':')) + '\n').encode()
        packed = gzip.compress(raw, compresslevel=9, mtime=0)
        digest = hashlib.sha256(packed).hexdigest()
        path = 'death/' + digest + '.json.gz'
        (asset_output / path).write_bytes(packed)
        clips = {a['name'] for a in model['animations']}
        events = [e for e in data['animationEvents'] if e['effect'] in ids and e['clip'] in clips]
        library['models'].append({'model': model['id'], 'path': path, 'bytes': len(packed), 'sha256': digest,
                                  'decodedBytes': len(raw), 'decodedSha256': hashlib.sha256(raw).hexdigest(),
                                  'sourceAssembly': data['sourceAssembly'], 'sourceAssemblySha256': data['sourceAssemblySha256'],
                                  'sourceModelSha256': data['sourceModelSha256'], 'sourceVertexStart': data['sourceVertexStart'],
                                  'sourceVertices': data['sourceVertices'], 'unreferencedVertices': data['unreferencedVertices'],
                                  'crossCopies': data['crossCopies'], 'events': events})
    catalogue['meshDeaths'] = library
    return library


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ['catalogue', 'topology', 'project', 'asset-output', 'output']:
        parser.add_argument('--' + arg, type=Path, required=True)
    args = parser.parse_args()
    catalogue = json.loads(args.catalogue.read_text())
    library = attach(catalogue, args.topology, args.project, args.asset_output)
    args.output.write_text(json.dumps(catalogue, separators=(',', ':')) + '\n')
    unique = {m['path']: m['bytes'] for m in library['models']}
    print(json.dumps({'models': len(library['models']), 'events': sum(len(m['events']) for m in library['models']),
                      'uniqueAssets': len(unique), 'bytes': sum(unique.values())}))


if __name__ == '__main__':
    main()
