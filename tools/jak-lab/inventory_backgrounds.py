#!/usr/bin/env python3
"""Read source GLB headers to inventory exact exported TIE/shrub node boundaries.

No connected-component splitting, guessed instances or vertex changes. This
small header audit does not re-read/decode the multi-GB model buffers.
"""
import argparse
import datetime
import json
from pathlib import Path
import re
import struct


def inventory(document):
    parts = []
    for tree_index, tree in enumerate(document.get('nodes', [])):
        match = re.search(r'-(tie|shrub)-\d+$', tree.get('name', ''))
        if not match:
            continue
        for node_index in tree.get('children', []):
            node = document['nodes'][node_index]
            if 'mesh' not in node:
                continue
            mesh = document['meshes'][node['mesh']]
            name = node.get('name', f'node-{node_index}')
            kind = 'shrub' if match[1] == 'shrub' else \
                'wind-draw' if re.fullmatch(r'wind-group-\d+-\d+', name) else 'prop'
            triangles = 0
            for primitive in mesh['primitives']:
                if primitive.get('mode', 4) != 4:
                    raise ValueError(f'Non-triangle source prototype: {name}')
                accessor = primitive.get('indices', primitive['attributes']['POSITION'])
                count = document['accessors'][accessor]['count']
                if count % 3:
                    raise ValueError(f'Partial source triangle: {name}')
                triangles += count // 3
            parts.append({'node': node_index, 'name': name, 'kind': kind,
                          'tree': tree['name'], 'treeNode': tree_index,
                          'primitives': len(mesh['primitives']), 'triangles': triangles,
                          'hasPlacementMatrix': 'matrix' in node})
    return parts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalogue', type=Path, required=True)
    parser.add_argument('--exported', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    catalogue = json.loads(args.catalogue.read_text())
    rows = []
    for model in catalogue['models']:
        if not model['background']:
            continue
        with (args.exported / model['path']).open('rb') as source:
            magic, version, size, length, chunk = struct.unpack('<5I', source.read(20))
            if magic != 0x46546c67 or version != 2 or chunk != 0x4e4f534a or size != model['bytes']:
                raise ValueError(f'Unexpected source GLB header: {model["path"]}')
            document = json.loads(source.read(length))
        rows.append({'model': model['id'], 'sourceSha256': model['sha256'], 'parts': inventory(document)})
    kinds = {kind: sum(p['kind'] == kind for row in rows for p in row['parts'])
             for kind in ('prop', 'shrub', 'wind-draw')}
    report = {'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'sourceRevision': 'b6c8430c0b0a5cb139b939bcf0ffd25285b896c7',
              'backgrounds': len(rows), 'partKinds': kinds,
              'parts': sum(kinds.values()), 'rows': rows,
              'scope': 'Source prototype placements and wind draw groups; not inferred individual instances.'}
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'rows'}, indent=2))


if __name__ == '__main__':
    main()
