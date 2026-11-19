"""A fitted high-back tank panel with a bound scoop, sampled on the native body skin."""

import numpy as np


def make_maps(folder):
    from PIL import Image

    w, h = 384, 512
    yy, xx = np.indices((h, w), dtype=np.float32)
    x = (xx + 0.5) / w
    t = 1 - (yy + 0.5) / h

    def soft(q):
        q = np.clip(q, 0, 1)
        return q * q * (3 - 2 * q)

    edge = np.minimum(1 - t, np.minimum(x, 1 - x) * 1.17)
    binding = 1 - soft((edge - 0.019) / 0.005)
    jersey = 0.5 * np.sin(xx * 2.9 + np.sin(yy * 0.71)) + 0.5 * np.sin(yy * 1.65 + xx * 0.45)
    rib = np.sin(xx * 2.2 + yy * 0.10)
    warm = np.array([0.963, 0.920, 0.908])[None, None, :] + jersey[:, :, None] * np.array(
        [0.010, 0.012, 0.013]
    )
    pink = np.array([0.925, 0.383, 0.650])[None, None, :] + rib[:, :, None] * 0.011
    stitch = np.exp(-(((edge - 0.029) / 0.0027) ** 2)) * (
        0.45 + 0.55 * (np.cos(xx * 0.9 + yy * 0.25) > 0.15)
    )
    color = (
        warm * (1 - binding[:, :, None]) + pink * binding[:, :, None] - 0.025 * stitch[:, :, None]
    )
    Image.fromarray(np.rint(np.clip(color, 0, 1) * 255).astype("uint8")).save(
        folder / "knit-color.jpg", quality=94, subsampling=0
    )
    height = 0.11 * jersey + 0.24 * binding + 0.10 * stitch
    dy, dx = np.gradient(height)
    n = np.stack((-0.30 * dx, 0.30 * dy, np.ones_like(dx)), 2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    Image.fromarray(np.rint((n * 0.5 + 0.5) * 255).astype("uint8")).save(
        folder / "knit-normal.png", optimize=True
    )
    Image.fromarray(np.rint((0.92 - 0.08 * binding + 0.015 * jersey) * 255).astype("uint8")).save(
        folder / "knit-rough.png", optimize=True
    )


def build(put, lib, body, faces, weights, shoulders):
    p = body[faces]
    mask = (
        (p[:, :, 1].max(1) > 1.18)
        & (p[:, :, 1].min(1) < 1.51)
        & (abs(p[:, :, 0]).min(1) < 0.18)
        & (p[:, :, 2].min(1) < -0.005)
    )
    ids = faces[mask]
    a, b, c = body[ids[:, 0]], body[ids[:, 1]], body[ids[:, 2]]
    ab = b - a
    ac = c - a
    den = ab[:, 0] * ac[:, 1] - ab[:, 1] * ac[:, 0]
    den = np.where(abs(den) > 1e-10, den, np.nan)

    def surface(x, y):
        u = ((x - a[:, 0]) * ac[:, 1] - (y - a[:, 1]) * ac[:, 0]) / den
        v = (ab[:, 0] * (y - a[:, 1]) - ab[:, 1] * (x - a[:, 0])) / den
        z = a[:, 2] + u * ab[:, 2] + v * ac[:, 2]
        z = np.where((u >= -0.0004) & (v >= -0.0004) & (u + v <= 1.0004), z, np.inf)
        i = int(np.argmin(z))
        if not np.isfinite(z[i]) or z[i] > 0.045:
            return None
        bary = np.maximum([1 - u[i] - v[i], u[i], v[i]], 0)
        bary /= sum(bary)
        return z[i], ids[i], bary

    verts = []
    uv = []
    skin = []
    tris = []
    targets = {k: [] for k in shoulders}
    cols = 32
    rows = 23
    for j in range(rows + 1):
        t = j / rows
        for i in range(cols + 1):
            u = 2 * i / cols - 1
            bottom = 1.210 + 0.012 * (1 - u * u)
            top = 1.449 + 0.043 * abs(u) ** 2.15
            y = (1 - t) * bottom + t * top
            half = np.interp(
                y,
                [1.21, 1.26, 1.30, 1.35, 1.39, 1.44, 1.495],
                [0.111, 0.121, 0.140, 0.142, 0.131, 0.124, 0.105],
            )
            x = u * half
            hit = surface(x, y)
            while hit is None and abs(x) > 0.002:
                x -= np.sign(x) * 0.0015
                hit = surface(x, y)
            if hit is None:
                raise ValueError(f"Dorsal sample misses the torso at {x:.3f}, {y:.3f}")
            z, index, bary = hit
            edge = min(1 - t, (1 - abs(u)) * 0.585)
            z -= 0.0038 + 0.0008 * np.exp(-(((edge - 0.014) / 0.017) ** 2))
            verts.append((x, y, z))
            uv.append(((u + 1) * 0.5, 1 - t))
            binding = {}
            for idx, weight in zip(index, bary):
                for bone, amount in weights[idx].items():
                    binding[bone] = binding.get(bone, 0) + amount * weight
            top_weights = sorted(binding.items(), key=lambda item: -item[1])[:4]
            total = sum(v for _, v in top_weights)
            skin.append({k: v / total for k, v in top_weights if v > 0})
            for key, delta in shoulders.items():
                targets[key].append((delta[index] * bary[:, None]).sum(axis=0))
            if i and j:
                d = len(verts) - 1
                c0 = d - 1
                b0 = d - cols - 1
                a0 = b0 - 1
                tris.extend(((a0, c0, b0), (b0, c0, d)))
    tris = np.array(tris)
    panel = np.array(verts)
    grid = panel[:, 2].reshape(rows + 1, cols + 1)
    smooth = grid.copy()
    for _ in range(14):
        border = np.pad(smooth, 1, mode="edge")
        smooth = (
            4 * border[1:-1, 1:-1]
            + 2 * (border[:-2, 1:-1] + border[2:, 1:-1] + border[1:-1, :-2] + border[1:-1, 2:])
            + border[:-2, :-2]
            + border[:-2, 2:]
            + border[2:, :-2]
            + border[2:, 2:]
        ) / 16
    # Cloth bridges the shoulder-blade contours and the removed strap impressions.
    # Keep the binding registered to the underlying armholes and hem.
    u, v = np.array(uv).T
    fade = np.clip(np.minimum.reduce([u, 1 - u, v, 1 - v]) / 0.065, 0, 1).reshape(grid.shape)
    grid[:] = grid * (1 - fade) + (smooth - 0.0013) * fade
    mat = lib.make("Ivory jersey | pink bound back", "knit", 0.72, 0.26, 0, 0.15, 0.48)
    obj = put(
        "Tank | fitted bound back",
        "Wardrobe",
        panel,
        tris,
        np.array(uv)[tris],
        skin,
        mat,
        targets,
    )
    panel_uv = np.array(uv)
    covered = np.zeros(len(body), dtype=bool)
    for tri in tris:
        corners = panel[tri]
        left = corners.min(axis=0)
        right = corners.max(axis=0)
        candidates = np.flatnonzero(
            (body[:, 0] >= left[0])
            & (body[:, 0] <= right[0])
            & (body[:, 1] >= left[1])
            & (body[:, 1] <= right[1])
            & (body[:, 2] >= left[2] - 0.017)
            & (body[:, 2] <= min(0.027, right[2] + 0.069))
        )
        if not len(candidates):
            continue
        v0, v1 = corners[1, :2] - corners[0, :2], corners[2, :2] - corners[0, :2]
        d = body[candidates, :2] - corners[0, :2]
        det = v0[0] * v1[1] - v0[1] * v1[0]
        if abs(det) < 1e-10:
            continue
        a = (d[:, 0] * v1[1] - d[:, 1] * v1[0]) / det
        b = (v0[0] * d[:, 1] - v0[1] * d[:, 0]) / det
        bary = np.column_stack((1 - a - b, a, b))
        tex = bary @ panel_uv[tri]
        inside = (
            (bary.min(1) > -0.001)
            & (tex[:, 0] > 0.019)
            & (tex[:, 0] < 0.981)
            & (tex[:, 1] > 0.016)
            & (tex[:, 1] < 0.982)
        )
        covered[candidates[inside]] = True
    # Keep an overlap under all four seams. Remove the superseded crossed straps
    # and skin only in the covered interior, including during shoulder deformation.
    return obj, ~np.all(covered[faces], axis=1)
