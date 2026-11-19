"""Measure the same ribcage edges in both sculpts using the running player's matrices."""

import argparse
import json
import pickle
from pathlib import Path
import numpy as np
from surface import M

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('previous', type=Path)
parser.add_argument('current', type=Path)
parser.add_argument('actions', type=Path)
args = parser.parse_args()


def read(path):
    with path.open('rb') as f:
        return {p['name']: p for p in pickle.load(f)[0]}


sculpts = [read(args.previous), read(args.current)]
actions = json.loads(args.actions.read_text())


def edges(p):
    e = set()
    for face in p['faces']:
        for a, b in zip(face, face[1:] + face[:1]):
            if min(a, b) // (p['nu'] + 1) >= 7 and max(a, b) // (p['nu'] + 1) <= 23:
                e.add(tuple(sorted([a, b])))
    return e


tanks = [s['Fitted tank, neck and midriff'] for s in sculpts]
e = np.array(sorted(edges(tanks[0]) & edges(tanks[1])))


def skin_edges(part, clip):
    bones = clip['bones']
    n = len(part['points'])
    skin = np.zeros((n, 4, 4))
    ids = np.zeros((n, 4), dtype=int)
    p = np.column_stack([part['points'], np.ones(n)])
    for i, weights in enumerate(part['weights']):
        for j, (bone, amount) in enumerate(weights.items()):
            ids[i, j] = bones.index(bone)
            skin[i, j] = np.linalg.solve(M[bone], p[i]) * amount
    l0 = np.linalg.norm(p[e[:, 0], :3] - p[e[:, 1], :3], axis=1)
    ratios = []
    for frame in clip['frames']:
        matrices = np.asarray(frame).reshape(-1, 4, 4).transpose(0, 2, 1)
        posed = np.einsum('nkij,nkj->ni', matrices[ids], skin)[:, :3]
        lengths = np.linalg.norm(posed[e[:, 0]] - posed[e[:, 1]], axis=1)
        strain = lengths / l0
        ratios.extend(np.maximum(strain, 1 / strain))
    return np.asarray(ratios)


report = {'commonChestEdges': len(e), 'clips': {}, 'proportions': {}}
for clip in actions:
    if clip['id'] not in [
        'player.rope',
        'player.rope-climb',
        'player.grab',
        'player.climb',
        'player.hang',
        'player.run',
        'player.swim',
    ]:
        continue
    before, after = [skin_edges(p, clip) for p in tanks]
    report['clips'][clip['id']] = {
        k: [round(float(fn(before)), 3), round(float(fn(after)), 3)]
        for k, fn in [
            ('p95', lambda r: np.percentile(r, 95)),
            ('p99', lambda r: np.percentile(r, 99)),
            ('max', np.max),
        ]
    }
for name, t0, t1 in [('Upper arm at midshaft', 0.34, 0.43), ('Forearm at widest belly', 0.655, 0.76)]:
    measure = []
    for s, t in zip(sculpts, [t0, t1]):
        p = s['Arm left']
        ring = p['points'].reshape(p['nv'] + 1, p['nu'] + 1, 3)[round(t * p['nv'])]
        measure.append(round(float(np.ptp(ring[:, 2])), 4))
    report['proportions'][name + ' depth'] = measure
for axis, label in [(0, 'width'), (2, 'depth')]:
    vals = []
    for s in sculpts:
        p = s['Palm and thenar eminence left']
        points = (
            np.column_stack([p['points'], np.ones(len(p['points']))])
            @ np.linalg.inv(M['hand-rest-orientation-left']).T
        )
        vals.append(
            round(float(np.max(np.ptp(points.reshape(p['nv'] + 1, p['nu'] + 1, 4)[:, :, axis], axis=1))), 4)
        )
    report['proportions']['Palm ' + label + ' in glove space'] = vals
for p in [sculpts[1]['Arm left'], sculpts[1]['Arm right']]:
    assert p['joins']
    for index, (target, vertex) in p['joins'].items():
        np.testing.assert_allclose(p['points'][index], sculpts[1][target]['points'][vertex], atol=1e-8)
print(json.dumps(report, indent=2))
