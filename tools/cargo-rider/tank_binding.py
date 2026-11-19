"""Cut and sew the tank neckline and armholes across the weighted torso and deltoids."""

import numpy as np
from maquette import coordinates
from surface import ART, grid, smooth, unit


def garment_edge(model, arm_t=None):
    xyz = coordinates(model)
    x, row, d = xyz[..., 0], xyz[..., 1], xyz[..., 2]
    a = abs(x)
    facing = smooth((d + 24) / 64)
    # Front and back scoop to different depths. The shoulder strap crosses
    # the acromion and comes back up around the underside of the axilla.
    neckline = (624 + 29 * facing) - (55 + 34 * facing) * np.minimum(a / 81, 1) ** 1.85
    width = np.interp(
        row, [550, 576, 598, 633, 675, 701, 718, 736, 753, 810], [116, 116, 106, 93, 86, 94, 109, 149, 184, 184]
    )
    width += facing * (10 + 23 * smooth((row - 580) / 50)) * (1 - smooth((row - 718) / 40))
    armpit = width - a
    if arm_t is not None:
        armpit = np.minimum(armpit, (0.28 - arm_t) * 270)
    return np.minimum(row - neckline, armpit)


def sew_bindings(surfaces):
    # Each crossed triangle contributes one segment. Identical positions on the UV
    # seams and welded shoulder loops resolve to the same point before stitching.
    pattern = ART / 'likeness/tank-pattern.npz'
    fitted = dict(np.load(pattern)) if pattern.exists() else {}
    positions = {}
    weights = {}
    normals = {}
    edges = {}
    for p in surfaces:
        xyz = p['points']
        faces = np.array(p['faces'])
        p['tank_pattern'] = xyz.copy()
        vn = np.zeros_like(xyz)
        for tri in (faces[:, [0, 1, 2]], faces[:, [0, 2, 3]]):
            normal = np.cross(xyz[tri[:, 1]] - xyz[tri[:, 0]], xyz[tri[:, 2]] - xyz[tri[:, 0]])
            for column in tri.T:
                np.add.at(vn, column, normal)
        uvrow = np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1) if p['paint'] == 'arm' else None
        if p['name'] in fitted:
            # Blend the photographed cut with the continuous three-loop sewing pattern.
            base = garment_edge(xyz, uvrow).reshape(p['nv'] + 1, p['nu'] + 1)
            p['garment_field'] = 0.10 * base + 0.90 * fitted[p['name']]
            field = p['garment_field'].ravel().astype(float)
        else:
            field = garment_edge(xyz, uvrow)
        for face in faces:
            for tri in (face[[0, 1, 2]], face[[0, 2, 3]]):
                if np.min(field[tri]) >= 0 or np.max(field[tri]) < 0:
                    continue
                ends = []
                for a, b in zip(tri, np.roll(tri, -1)):
                    if (field[a] >= 0) == (field[b] >= 0):
                        continue
                    if a > b:
                        a, b = b, a
                    f = field[a] / (field[a] - field[b])
                    pos = xyz[a] * (1 - f) + xyz[b] * f
                    key = tuple(np.round(pos, 7))
                    n = unit(vn[a] * (1 - f) + vn[b] * f)
                    positions[key] = pos
                    normals[key] = normals.get(key, 0) + n
                    mix = {
                        k: p['weights'][a].get(k, 0) * (1 - f) + p['weights'][b].get(k, 0) * f
                        for k in p['weights'][a] | p['weights'][b]
                    }
                    weights[key] = mix
                    ends.append(key)
                if len(ends) == 2 and ends[0] != ends[1]:
                    for a, b in (ends, ends[::-1]):
                        edges.setdefault(a, set()).add(b)
    loops = []
    visited = set()
    for start in edges:
        if start in visited:
            continue
        loop = []
        last = None
        cur = start
        while cur not in visited:
            visited.add(cur)
            loop.append(cur)
            candidates = edges[cur] - {last}
            if not candidates:
                break
            last, cur = cur, next(iter(candidates))
        if len(loop) > 12 and cur == start:
            loops.append(loop)
    if len(loops) != 3:
        raise ValueError(f'The tank must have three closed binding loops, found {[len(x) for x in loops]}')
    for loop in loops:
        loop.append(loop[0])
        pos = np.array([positions[k] for k in loop])
        ns = np.array([unit(normals[k]) for k in loop])
        # Outward is unambiguous on a convex ribcage; use it to check the averaged patch normals.
        horizontal = np.column_stack([pos[:, 0], np.zeros(len(pos)), pos[:, 2]])
        if np.sum(ns * horizontal) < 0:
            ns = -ns
        lengths = np.r_[0, np.cumsum(np.linalg.norm(np.diff(pos, axis=0), axis=1))]
        n = max(54, round(lengths[-1] / 0.0083))
        ss = np.linspace(0, lengths[-1], n + 1)
        ij = np.minimum(np.searchsorted(lengths, ss, side='right') - 1, len(loop) - 2)
        f = (ss - lengths[ij]) / np.maximum(1e-9, lengths[ij + 1] - lengths[ij])
        center = pos[ij] * (1 - f[:, None]) + pos[ij + 1] * f[:, None]
        normal = ns[ij] * (1 - f[:, None]) + ns[ij + 1] * f[:, None]
        normal /= np.maximum(1e-9, np.linalg.norm(normal, axis=1, keepdims=True))
        tangent = np.roll(center[:-1], -1, axis=0) - np.roll(center[:-1], 1, axis=0)
        tangent = np.vstack([tangent, tangent[0]])
        across = np.cross(normal, tangent)
        across /= np.maximum(1e-9, np.linalg.norm(across, axis=1, keepdims=True))
        lookup = []
        for j, g in zip(ij, f):
            a, b = weights[loop[j]], weights[loop[j + 1]]
            lookup.append({k: a.get(k, 0) * (1 - g) + b.get(k, 0) * g for k in a | b})

        def surf(u, t):
            i = round(u * n)
            angle = 2 * np.pi * t
            return (
                center[i]
                + normal[i] * (0.0016 + 0.00165 * np.cos(angle))
                + across[i] * (0.0044 * np.sin(angle))
            )

        name = (
            'Scoop neckline'
            if np.min(pos[:, 0]) < 0 < np.max(pos[:, 0])
            else ('Left armhole' if pos[:, 0].mean() > 0 else 'Right armhole')
        )
        grid(
            name + ' | bound knit',
            n,
            6,
            surf,
            lambda p: p,
            lambda p, u, t: lookup[round(u * n)],
            'knit_binding',
            group='Body',
            cyclic=True,
            uvsize=(370, 32),
            project=lambda p, u, t: [u, t, 0, 0],
        )
