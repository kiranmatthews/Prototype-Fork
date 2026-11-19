"""Cut the tank in its arms-down stance from the rear and profile contours."""

import argparse
import pickle
from pathlib import Path
import numpy as np
from surface import smooth
from muzzle_profile import curve


def fit(bake, registration, output):
    parts, _, _ = pickle.load((bake / 'surface.pickle').open('rb'))
    posed = np.load(registration)
    # Outer edge of the pink facing in the rear drawing. The lower return
    # is outside the portrait, where the armhole closes under the deltoid.
    rows = np.array([546, 568, 583, 590, 599, 615, 640, 659, 679, 698, 714, 725, 742, 764, 800, 950])
    widths = np.array([99, 99, 98, 94, 88, 82, 78, 78, 80, 85, 92, 100, 118, 150, 176, 183])
    result = {}
    for p in parts:
        if p['paint'] not in ('body', 'arm'):
            continue
        name = p['name']
        q = posed['rear / ' + name]
        profile = posed['profile / ' + name]
        x = np.abs(372 - q[:, :, 0])
        y = q[:, :, 1]
        depth = 330 - profile[:, :, 0]
        anterior = smooth((depth + 38) / 82)
        # The front scoop bottoms beneath the collarbone, the back scoop above
        # it. The cloth rounds the highest part of the shoulder before turning
        # down into the front and back axillary folds.
        neck = 626 + 30 * anterior - (56 + 29 * anterior) * np.minimum(x / 84, 1.19) ** 1.90
        neck -= 10.0 * smooth((x - 48) / 28) * smooth((611 - y) / 38)
        width = curve(rows, widths, y) + 5.0 * smooth((613 - y) / 37)
        width += anterior * (4.0 + 5.5 * smooth((y - 599) / 52))
        armhole = width - x
        field = np.minimum(y - neck, armhole)
        field += 11.0 * smooth((625 - y) / 32) * smooth((x - 52) / 25)
        if p['paint'] == 'arm':
            length = np.linspace(0, 1, p['nv'] + 1)[:, None]
            field = np.minimum(field, (0.31 - length) * 275)
        result[name] = field
    # Index the actual sewn boundaries. The same body-space cut accommodates
    # small differences in the two posed deltoids and remains continuous.
    parts = [p for p in parts if p['name'] in result]
    groups = {}
    ids = []
    for p in parts:
        ids.append(
            np.array([groups.setdefault(tuple(np.round(point, 7)), len(groups)) for point in p['points']])
        )
    count = np.zeros(len(groups))
    values = np.zeros(len(groups))
    edges = []
    for p, ii in zip(parts, ids):
        np.add.at(count, ii, 1)
        np.add.at(values, ii, result[p['name']].ravel())
        f = ii[np.asarray(p['faces'])]
        edges.append(np.column_stack((f.ravel(), np.roll(f, 1, axis=1).ravel())))
    values /= np.maximum(1, count)
    adj = np.concatenate(edges)
    src, dst = np.vstack((adj, adj[:, ::-1])).T
    degree = np.bincount(src, minlength=len(values))
    for _ in range(3):
        avg = np.bincount(src, weights=values[dst], minlength=len(values)) / np.maximum(1, degree)
        values += np.where(degree, 0.34 * (avg - values), 0)
    np.savez_compressed(
        output,
        **{
            p['name']: values[ii].reshape(p['nv'] + 1, p['nu'] + 1).astype('float32')
            for p, ii in zip(parts, ids)
        },
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('bake', 'registration', 'output'):
        parser.add_argument(key, type=Path)
    fit(**vars(parser.parse_args()))
