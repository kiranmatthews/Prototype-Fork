"""Fit continuous deformation cages to the three photographed outlines."""

from pathlib import Path
import numpy as np
from maquette import SCALE
from surface import ART


def family(p):
    name = p['name']
    if name.startswith('Sculpted ear'):
        return 'pinna' + name[-1]
    if p['group'] in ('Eyes', 'Face', 'Dentition') or name.startswith('Short nape'):
        return 'mask'
    if name.startswith(('Swept ponytail', 'Upper ponytail', 'Outer ponytail', 'Inner ponytail')):
        return 'tail' + name[-1]
    if name.startswith(('Double violet', 'Gathered hair')):
        return 'tie' + name[-1]
    if name.startswith(
        ('Sculpted face-framing', 'Swept temple', 'Forward fringe', 'Anterior temple', 'Central part')
    ):
        return 'coiffure'
    if p['paint'] in ('arm', 'body', 'knit_binding'):
        return 'shoulders'
    if 'necklace' in name or name.startswith('Oval shell'):
        return 'collar'
    return None


def coefficients(co, lo, hi, dims):
    v = np.clip((co - lo) / np.maximum(hi - lo, 1e-4), 0, 1) * (dims - 1)
    i = np.minimum(v.astype(int), dims - 2)
    t = v - i
    basis = np.stack(
        [((1 - t) ** 3) / 6, (3 * t**3 - 6 * t * t + 4) / 6, (-3 * t**3 + 3 * t * t + 3 * t + 1) / 6, t**3 / 6]
    )
    keys = []
    weights = []
    for x in range(4):
        for y in range(4):
            for z in range(4):
                j = np.clip(i + [x - 1, y - 1, z - 1], 0, dims - 1)
                keys.append(np.ravel_multi_index(j.T, dims))
                weights.append(basis[x, :, 0] * basis[y, :, 1] * basis[z, :, 2])
    return np.stack(keys, 1), np.stack(weights, 1)


def apply_cages(parts, folder=None):
    location = Path(folder or ART / 'likeness')
    for file in sorted(location.glob('contours-*.npz')):
        with np.load(file) as cage:
            for p in parts:
                f = family(p)
                if not f or f + '.delta' not in cage:
                    continue
                co = p['points'] / SCALE
                lo, hi, dims = cage[f + '.lo'], cage[f + '.hi'], cage[f + '.dims']
                ids, weight = coefficients(co, lo, hi, dims)
                off = np.sum(cage[f + '.delta'][ids] * weight[:, :, None], axis=1)
                if f == 'shoulders':
                    mask = np.clip((p['points'][:, 1] - 1.235) / 0.09, 0, 1)
                    mask *= np.clip((1.57 - p['points'][:, 1]) / 0.07, 0, 1)
                    off *= mask[:, None]
                p['points'] += off * SCALE


def solve(bake, renders, output):
    import pickle
    import json
    from PIL import Image, ImageFilter
    from compare_likeness import silhouette
    from study_pigment import VIEWS, masks

    parts, W, H = pickle.load((bake / 'surface.pickle').open('rb'))
    atlas = np.full((H, W), -1, np.int16)
    groups = {}
    for i, p in enumerate(parts):
        f = family(p)
        if not f:
            continue
        groups.setdefault(f, []).append(p)
        x, y, w, h = p['rect']
        atlas[y : y + h, x : x + w] = i
    sample = {k: [] for k in groups}
    ref = Image.open(ART / 'likeness/three-view.webp').convert('RGB')
    design = json.loads((ART / 'likeness/registration.json').read_text())

    def contour(mask):
        im = Image.fromarray((mask.astype(np.uint8) * 255))
        border = mask & ~(np.asarray(im.filter(ImageFilter.MinFilter(3))) > 127)
        sm = np.asarray(im.filter(ImageFilter.GaussianBlur(2.1)), dtype=float)
        sy, sx = np.gradient(sm)
        normal = -np.dstack([sx, sy])
        normal /= np.maximum(0.01, np.linalg.norm(normal, axis=2, keepdims=True))
        y, x = np.where(border)
        valid = (x > 3) & (x < 720) & (y > 2) & (y < 719)
        x = x[valid]
        y = y[valid]
        return np.column_stack([x, y]), normal[y, x]

    def clean(mask, width):
        im = Image.fromarray(mask.astype('uint8') * 255)
        return np.asarray(im.filter(ImageFilter.MaxFilter(width)).filter(ImageFilter.MinFilter(width))) > 127

    for view, name in enumerate(VIEWS):
        target = ref.crop((view * 724, 0, (view + 1) * 724, 724))
        refmask = silhouette(target)
        donor = masks(view, np.asarray(target, dtype=float) / 255)
        uv = np.load(renders / (name + '-coordinates.npz'))['surface']
        hit = uv[:, :, 3] > 0.97
        cats = np.floor(uv[:, :, 2] * 16).astype(int)
        a = np.radians([-26, 180, 90][view])
        e = np.radians(3.5 if not view else 0)
        right = np.array([np.cos(a), 0, -np.sin(a)])
        down = np.array([np.sin(a) * np.sin(e), -np.cos(e), np.cos(a) * np.sin(e)])

        def record(s, n, d, weight):
            x = int(s[0])
            y = int(s[1])
            if not hit[y, x]:
                return
            u, v = uv[y, x, :2]
            px = np.clip(u * W - 0.5, 0, W - 1)
            py = np.clip((1 - v) * H - 0.5, 0, H - 1)
            pid = atlas[round(float(py)), round(float(px))]
            if pid < 0:
                return
            p = parts[pid]
            f = family(p)
            rx, ry, rw, rh = p['rect']
            nu, nv = p['nu'], p['nv']
            q = np.clip([(px - rx) / (rw - 1), (py - ry) / (rh - 1)], 0, 1) * [nu, nv]
            i, j = np.minimum(q.astype(int), [nu - 1, nv - 1])
            s, t = q - [i, j]
            pos = p['points'].reshape(nv + 1, nu + 1, 3)
            co = (
                (pos[j, i] * (1 - s) + pos[j, i + 1] * s) * (1 - t)
                + (pos[j + 1, i] * (1 - s) + pos[j + 1, i + 1] * s) * t
            ) / SCALE
            if f == 'shoulders' and co[1] * SCALE < 1.275:
                return
            sample[f].append((co, n[0] * right + n[1] * down, d, weight))

        def fit(actual, wanted, weight, maxreach):
            aa, na = contour(actual)
            bb, nb = contour(wanted)
            if not len(aa) or not len(bb):
                return
            # Work in both directions so a missing tuft tip attracts the adjacent
            # silhouette, with normals filtering out the other side of a narrow lock.
            for reverse in [False, True]:
                p, n, q, m = (bb, nb, aa, na) if reverse else (aa, na, bb, nb)
                for row in range(0, len(p), 4):
                    delta = q - p[row]
                    valid = (
                        (abs(delta[:, 0]) < maxreach) & (abs(delta[:, 1]) < maxreach) & ((m @ n[row]) > 0.48)
                    )
                    if not np.any(valid):
                        continue
                    ids = np.nonzero(valid)[0]
                    j = ids[np.argmin(np.sum(delta[ids] ** 2, axis=1))]
                    a, norm, t = (q[j], m[j], p[row]) if reverse else (p[row], n[row], q[j])
                    # An inward sample carries a reliable, unfiltered UV even at
                    # hair tips. The actual boundary remains the displacement origin.
                    off = float((t - a) @ norm)
                    for inset in (1.5, 2.5, 3.8):
                        at = np.clip(np.rint(a - inset * norm), 0, 723).astype(int)
                        if hit[at[1], at[0]]:
                            record(at, norm, np.clip(off, -32, 32), weight * (0.64 if reverse else 1))
                            break

        fit(hit, refmask, 1.0, 47)
        # Local boundaries of the pinnae, front fringe and collar also fit where
        # they cross another piece of the character inside the outer silhouette.
        fit(hit & (cats == 4), clean(donor[4], 5), 0.74, 38)
        fit(hit & np.isin(cats, [1, 2]), clean(donor[1] | donor[2], 9), 0.48, 35)
        fit(hit & (cats == 8), clean(donor[8], 7), 0.38, 19)
        if view != 1:
            fit(hit & np.isin(cats, [5, 6]), donor[6], 0.80, 31)
            fit(hit & (cats == 10), clean(donor[10], 3), 0.90, 31)
            fit(hit & (cats == 7), clean(donor[7], 3), 0.87, 22)
        for x, y, rx, ry in design[name]:
            if hit[y, x] and np.hypot(x - rx, y - ry) <= 32:
                record((x, y), (1, 0), rx - x, 3.2)
                record((x, y), (0, 1), ry - y, 3.2)
    result = {}
    for f, data in sample.items():
        if len(data) < 7:
            continue
        coords, norms, dist, importance = map(np.array, zip(*data))
        all_points = np.concatenate([p['points'] for p in groups[f]]) / SCALE
        if f == 'shoulders':
            all_points = all_points[(all_points[:, 1] * SCALE > 1.25) & (all_points[:, 1] * SCALE < 1.57)]
        lo = all_points.min(0) - 1
        hi = all_points.max(0) + 1
        dims = np.array(
            [5, 7, 4]
            if f.startswith(('tail', 'pinna'))
            else [7, 6, 5]
            if f in ('coiffure', 'mask', 'shoulders')
            else [4, 4, 3]
        )
        ids, w = coefficients(coords, lo, hi, dims)
        count = int(np.prod(dims))
        B = np.zeros((len(coords), count))
        np.add.at(B, (np.arange(len(coords))[:, None], ids), w)
        m = (B[:, :, None] * norms[:, None, :]).reshape(len(coords), count * 3)
        lattice = np.arange(count).reshape(dims)
        adj = []
        for axis in range(3):
            j = np.swapaxes(lattice, 0, axis)
            adj.extend(zip(j[1:].ravel(), j[:-1].ravel()))
        smooth = np.zeros((len(adj), count))
        for i, (a, b) in enumerate(adj):
            smooth[i, a] = 1
            smooth[i, b] = -1
        bending = []
        for axis in range(3):
            j = np.swapaxes(lattice, 0, axis)
            bending.extend(zip(j[2:].ravel(), j[1:-1].ravel(), j[:-2].ravel()))
        second = np.zeros((len(bending), count))
        for i, (a, b, c) in enumerate(bending):
            second[i, a] = 1
            second[i, b] = -2
            second[i, c] = 1
        strength = 1.12 if f.startswith('pinna') else 1.85
        reg = np.kron(
            strength * (smooth.T @ smooth) + 2.65 * (second.T @ second) + np.eye(count) * 0.09, np.eye(3)
        )
        importance = importance**0.5
        m *= importance[:, None]
        d = dist * importance
        delta = np.linalg.solve(m.T @ m + reg, m.T @ d).reshape(-1, 3)
        length = np.linalg.norm(delta, axis=1)
        limit = 12 if f == 'shoulders' else 17 if f in ('mask', 'collar') else 34
        delta *= np.minimum(1, limit / np.maximum(length, 0.01))[:, None]
        for k, x in [('delta', delta), ('lo', lo), ('hi', hi), ('dims', dims)]:
            result[f + '.' + k] = x
    np.savez_compressed(output, **result)
    print({k: len(v) for k, v in sample.items()})


if __name__ == '__main__':
    import argparse

    ap = argparse.ArgumentParser(description=__doc__)
    for k in ('bake', 'renders', 'output'):
        ap.add_argument(k, type=Path)
    solve(**vars(ap.parse_args()))
