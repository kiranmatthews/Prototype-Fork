"""Smooth transverse portrait sections measured at the lip, whisker pads and zygoma."""

import numpy as np
from surface import smooth

# Each row describes the depth across the front skin, in the two registered
# orthographic panels. The nose leather and eyelid margins remain separate.
AX = np.array([0, 16, 32, 47, 63, 77, 90, 104, 120, 138, 156, 174.0])
ROWS = np.array([419, 436, 447, 455, 465, 477, 487, 497, 506, 516, 526, 539.0])
DEPTH = np.array(
    [
        [151, 150, 148, 145, 141, 135, 128, 118, 104, 81, 39, 2],
        [150, 148, 146, 142, 138, 132, 124, 114, 99, 72, 35, 1],
        [149, 148, 146, 143, 138, 132, 123, 114, 99, 70, 31, -1],
        [160, 158, 154, 148, 141, 133, 123, 118, 101, 65, 27, -3],
        [167, 171, 170, 163, 151, 136, 128, 123, 102, 61, 24, -4],
        [166, 172, 173, 167, 151, 125, 121, 115, 90, 54, 20, -6],
        [164, 171, 172, 163, 143, 122, 113, 102, 74, 42, 15, -8],
        [159, 166, 163, 149, 133, 116, 103, 85, 59, 32, 8, -9],
        [151, 154, 151, 139, 124, 105, 90, 72, 48, 24, 5, -9],
        [145, 147, 143, 133, 112, 90, 76, 58, 34, 17, 2, -10],
        [133, 133, 129, 115, 93, 72, 59, 43, 23, 11, 0, -12],
        [115, 112, 103, 88, 68, 51, 39, 26, 12, 6, -2, -13],
    ],
    float,
)


def curve(axis, values, query):
    # Shape-preserving cubic Hermite interpolation with weighted harmonic tangents.
    h = np.diff(axis)
    s = np.diff(values) / h
    slope = np.r_[s[0], np.zeros(len(axis) - 2), s[-1]]
    same = s[:-1] * s[1:] > 0
    a, b = 2 * h[1:] + h[:-1], h[1:] + 2 * h[:-1]
    slope[1:-1][same] = (a[same] + b[same]) / (a[same] / s[:-1][same] + b[same] / s[1:][same])
    q = np.clip(query, axis[0], axis[-1])
    i = np.minimum(np.searchsorted(axis, q, side='right') - 1, len(h) - 1)
    t = (q - axis[i]) / h[i]
    return (
        (2 * t**3 - 3 * t**2 + 1) * values[i]
        + (t**3 - 2 * t**2 + t) * h[i] * slope[i]
        + (-2 * t**3 + 3 * t**2) * values[i + 1]
        + (t**3 - t**2) * h[i] * slope[i + 1]
    )


def whisker_depth(a, row):
    ax = np.arange(176.0)
    ys = np.arange(418, 541.0)
    section = np.array([curve(AX, values, ax) for values in DEPTH])
    table = np.array([curve(ROWS, r, ys) for r in section.T]).T
    u = np.clip(a, 0, 174.999)
    v = np.clip(row - 418, 0, 121.999)
    i, j = u.astype(int), v.astype(int)
    s, t = u - i, v - j
    return (table[j, i] * (1 - s) + table[j, i + 1] * s) * (1 - t) + (
        table[j + 1, i] * (1 - s) + table[j + 1, i + 1] * s
    ) * t


def rebuild_jaw(islands):
    from maquette import SCALE

    sheets = {p['name']: p for p in islands}
    high = sheets['Cranium, muzzle and cheeks']
    low = sheets['Chin and lower lip']
    original = high['points'].copy()
    # Every transverse loop uses the same angle around the whole head. In
    # particular the mandible closes onto one chin pole ahead of the neck.
    rows = np.array([401, 416, 434, 451, 469, 485, 498, 511, 524, 534, 539.0])
    width = np.array([159, 163, 163, 157, 144, 128, 108, 90, 68, 36, 1.1])
    center = np.array([-17, -16, -13, -8, -3, 6, 20, 39, 68, 96, 111.0])
    rear = np.array([-122, -117, -111, -100, -86, -73, -53, -26, 16, 69, 109.5])
    lift = np.array([-2, -3, -5, -8, -11, -14, -18, -24, -23, -11, 0.0])
    for p, is_lower in ((high, False), (low, True)):
        nu, nv = p['nu'], p['nv']
        u, t = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1))
        t = t.ravel()
        u = u.ravel()
        sn, cs = np.sin(2 * np.pi * u), np.cos(2 * np.pi * u)
        base = (
            498 + 41 * t
            if is_lower
            else np.interp(t, [0, 16 / 58, 28 / 58, 41 / 58, 1], [207.4, 304.3, 377.3, 452.4, 498.0])
        )
        r = curve(rows, width, base)
        dc = curve(rows, center, base)
        bd = curve(rows, rear, base)
        temple = smooth((0.51 - cs) / 0.47) * smooth((base - 390) / 48)
        r *= 1 - 0.039 * smooth((base - 392) / 51)
        X = r * sn * (1 - 0.025 * temple)
        crease = (
            506
            - 32 * np.minimum(abs(X) / 83.5, 1.0) ** 2.15
            + 1.7 * np.sin(np.pi * np.minimum(abs(X) / 83.5, 1))
        )
        front = smooth((cs - 0.09) / 0.38)
        influence = (1 - smooth(t / 0.93)) if is_lower else np.exp(-(((base - 498) / 43) ** 2))
        Y = base + (crease - 498) * front * influence + curve(rows, lift, base) * (1 - cs) * 0.5
        Y -= 8.0 * temple * np.exp(-(((base - 465) / 47) ** 2))
        tuft = (
            4.4 * np.exp(-(((Y - 432) / 6.4) ** 2))
            + 6.4 * np.exp(-(((Y - 446) / 5.8) ** 2))
            + 4.5 * np.exp(-(((Y - 459) / 5.1) ** 2))
        ) * np.exp(-(((cs - 0.46) / 0.17) ** 2))
        X += np.sign(X) * tuft
        front_face = whisker_depth(abs(X), Y)
        # Match position and tangent as the cheek turns behind the jaw. The
        # anterior row has a narrower tapered temple than its original radius.
        # Evaluating the lateral depth at that same radius removes a steep shelf.
        edge_depth = whisker_depth(r * (1 - 0.025 * smooth((base - 390) / 48)), Y)
        D = front_face + (dc - edge_depth) * (1 - smooth(cs / 0.59))
        D += (dc - bd) * cs * (1 - smooth(cs / 0.45))
        D -= front * (
            2.5 * np.exp(-((X / 5.8) ** 2) - ((Y - 487) / 11.5) ** 2)
            + 7 * np.exp(-(((abs(X) - 81) / 10) ** 2) - ((Y - 476) / 9.5) ** 2)
        )
        D += front * (
            4.8 * np.exp(-(((abs(X) - 33) / 22) ** 2) - ((Y - 478) / 17) ** 2)
            + 9.0 * np.exp(-(((abs(X) - 98) / 29) ** 2) - ((Y - 463) / 20) ** 2)
            - 8.7 * np.exp(-((X / 13) ** 2) - ((Y - 484) / 16) ** 2)
        )
        oral = 506 - 31 * np.minimum(abs(X) / 82, 1.1) ** 2.05
        lip_depth = 156 - 44 * np.minimum(abs(X) / 82, 1.1) ** 2.05
        follow = front * np.exp(-(((Y - oral) / 15.4) ** 2)) * (1 - smooth((abs(X) - 82) / 24))
        D += (lip_depth - D) * follow
        D = np.where(cs >= 0, D, dc + (dc - bd) * cs)
        if is_lower:
            Y += (
                17
                * np.exp(-(((D - 61) / 47) ** 2))
                * smooth((base - 491) / 29)
                * (1 - smooth((base - 534) / 6))
            )
        # Close the pole with a small round cap of finite area.
        pole = smooth((base - 532) / 7)
        D = (1 - pole) * D + pole * (dc + cs * (dc - bd))
        target = np.column_stack((X * SCALE, 1.542 + (538 - Y) * SCALE, -0.015 + D * SCALE))
        blend = smooth((base - 408) / 48)
        p['points'] += (target - p['points']) * blend[:, None]
    # The eye surround and the cranium meet along the same sewn quad loop.
    for p in (p for p in islands if 'socket_boundary' in p):
        edge = p['socket_boundary'][1]
        ids = np.asarray(edge + [edge[0]])
        difference = high['points'][ids] - original[ids]
        radii = (1 - smooth(np.linspace(0, 1, p['nv'] + 1))) ** 1.65
        p['points'] += (radii[:, None, None] * difference[None]).reshape(-1, 3)


def fair_cheeks(islands):
    """Relax the closed neutral cheek over its sewn orbital margin and mandibular seam."""
    from maquette import coordinates

    sheets = [p for p in islands if p.get('skin_sheet')]
    ids = {}
    all_points, edges, eyelid = [], [], []
    for p in sheets:
        name, nu, nv = p['name'], p['nu'], p['nv']
        ix = np.arange(len(p['points'])) + len(all_points)
        all_points.extend(p['points'])
        grid = ix.reshape(nv + 1, nu + 1)
        grid[:, -1] = grid[:, 0]
        if name == 'Chin and lower lip':
            grid[0] = ids['Cranium, muzzle and cheeks'][-(nu + 1) :]
        else:
            for i, (parent, k) in p.get('joins', {}).items():
                ix[i] = ids[parent][k]
        grid[:, -1] = grid[:, 0]
        ids[name] = ix
        f = ix[np.asarray(p['faces'])]
        edges.append(np.column_stack((f.ravel(), np.roll(f, 1, axis=1).ravel())))
        if p.get('socket_boundary'):
            eyelid.extend(grid[-5:].ravel())
    co = np.array(all_points)
    initial = co.copy()
    x, y, d = coordinates(co).T
    mask = smooth((y - 421) / 23) * smooth((543 - y) / 19) * smooth((d + 36) / 59)
    # Preserve the philtrum and bulb of the whisker pads while fairing the
    # turn at each mouth corner from both sides of the split.
    mask *= 0.58 + 0.42 * smooth((abs(x) - 32) / 37)
    mask[eyelid] = 0
    pairs = np.unique(np.sort(np.concatenate(edges), axis=1), axis=0)
    src, dst = np.vstack((pairs, pairs[:, ::-1])).T
    deg = np.maximum(1, np.bincount(src, minlength=len(co)))
    for step in range(78):
        avg = np.column_stack([np.bincount(src, weights=co[dst, k], minlength=len(co)) / deg for k in range(3)])
        rate = 0.54 if step % 4 != 3 else -0.45
        co += (avg - co) * (rate * mask[:, None])
    # Build two convex whisker pads with a short central philtrum and a
    # broad rolled cheek at their outer ends. The depth field is continuous.
    x, y, d = coordinates(co).T
    front = smooth((d - 46) / 69)
    push = front * (
        9.4 * np.exp(-(((abs(x) - 47) / 30) ** 2) - ((y - 473) / 22) ** 2)
        - 5.4 * np.exp(-((x / 10) ** 2) - ((y - 486) / 14) ** 2)
    )
    lobes = np.exp(-(((abs(x) - 25) / 20) ** 2) - ((y - 491) / 17) ** 2)
    split = np.exp(-((x / 6.5) ** 2) - ((y - 490) / 15) ** 2)
    push += front * (6.3 * lobes - 4.8 * split)
    oral = front * np.exp(-(((y - 500) / 13) ** 2))
    co[:, 1] -= 0.00125 * oral * (2.6 * np.exp(-(((abs(x) - 22) / 14) ** 2)) - 1.6 * np.exp(-((x / 9.0) ** 2)))
    push -= front * 4.7 * np.exp(-(((abs(x) - 77) / 8.8) ** 2) - ((y - 478) / 7.5) ** 2)
    co[:, 2] += push * 0.00125
    # Three pointed rolls emerge from the same cheek surface as the muzzle.
    # Their thick upper roots and quick lower returns form the furry silhouette.
    tufts = np.zeros_like(x)
    for level, reach in ((447.5, 19.0), (459.0, 21.0), (469.5, 16.0)):
        width = np.where(y < level, 9.3, 2.3)
        tufts += reach * np.exp(-(((y - level) / width) ** 2))
    tufts *= np.exp(-(((d + 6) / 39) ** 2)) * smooth((abs(x) - 67) / 34)
    co[:, 0] += np.sign(x) * 0.00125 * tufts
    co[:, 2] -= 0.00125 * 0.20 * tufts
    for p in sheets:
        p['points'] += (co - initial)[ids[p['name']]]
