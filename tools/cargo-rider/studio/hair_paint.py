"""Comb fine, non-repeating fibre detail along the three-dimensional locks into the existing UV atlas."""

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from hair import fit
from fit_body import ease


def striation(q, g):
    x, y, z = q.T
    if g in (2, 3):
        if g == 2:
            xc = np.interp(
                y,
                [1.38, 1.50, 1.70, 1.80, 1.95, 2.04],
                [-0.27, -0.235, -0.276, -0.30, -0.245, -0.224],
            )
            zc = np.interp(y, [1.38, 1.65, 1.84, 2.04], [-0.229, -0.250, -0.255, -0.214])
        else:
            xc = np.interp(
                y, [1.42, 1.55, 1.71, 1.83, 1.96, 2.04], [0.39, 0.35, 0.352, 0.377, 0.314, 0.31]
            )
            zc = np.interp(y, [1.42, 1.64, 1.84, 2.04], [-0.08, -0.137, -0.135, -0.136])
        angle = np.arctan2(z - zc, (x - xc) * 0.93)
        phase = angle + 0.25 * np.sin((y - 1.5) * 8) + 0.064 * np.sin(y * 9 + angle * 3)
        a = np.sin(31 * phase + 0.66 * np.sin(12 * phase + y * 4))
        b = np.sin(67 * phase + 0.92 * np.sin(5 * phase - y * 6))
        c = np.sin(127 * phase + 0.57 * np.sin(6 * phase + y * 11))
    else:
        if g == 5:
            flow = y - 0.43 * abs(x) + 0.105 * z + 0.0035 * np.sin(35 * x + 16 * y)
        else:
            flow = np.sqrt(
                (abs(x) + 0.008) ** 2 + ((y - 1.696) * 0.80) ** 2 + ((z - 0.085) * 0.32) ** 2
            )
            flow += 0.29 * (z - 0.1) + 0.0043 * np.sin(13 * x + 18 * y + 4 * z)
        a = np.sin(flow * 780 + 0.68 * np.sin(flow * 194 + 11 * y))
        b = np.sin(flow * 1490 + 1.23 * np.sin(flow * 201 + 15 * x))
        c = np.sin(flow * 2640 + 0.75 * np.sin(flow * 153 + 14 * z))
    return np.clip(0.47 * a + 0.31 * b + 0.22 * c, -1, 1)


def paint(folder):
    folder = Path(folder)
    d = np.load(folder / "bust.npz")
    rgb = np.array(Image.open(folder / "bust-color.jpg").convert("RGB"), dtype=np.float32) / 255
    h, w = rgb.shape[:2]
    tracks = np.zeros((h, w), dtype=np.float32)
    zone = np.zeros_like(tracks)
    locks = np.zeros_like(tracks)
    p = fit(d["pos"])
    faces = d["tri"]
    groups = d["group"][faces[:, 0]]
    for face, g in zip(
        faces[np.isin(groups, [1, 2, 3, 5, 19])], groups[np.isin(groups, [1, 2, 3, 5, 19])]
    ):
        uv = d["uv"][face] * [w - 1, h - 1]
        lo = np.maximum(0, np.floor(uv.min(0) - 1).astype(int))
        hi = np.minimum([w - 1, h - 1], np.ceil(uv.max(0) + 1).astype(int))
        xx, yy = np.meshgrid(
            np.arange(lo[0], hi[0] + 1) - uv[0, 0], np.arange(lo[1], hi[1] + 1) - uv[0, 1]
        )
        a, b = uv[1] - uv[0], uv[2] - uv[0]
        det = a[0] * b[1] - a[1] * b[0]
        if abs(det) < 0.00005:
            continue
        s = (xx * b[1] - yy * b[0]) / det
        t = (a[0] * yy - a[1] * xx) / det
        inside = (s >= -0.032) & (t >= -0.032) & (s + t <= 1.032)
        if not np.any(inside):
            continue
        y, x = np.where(inside)
        xyz = (
            p[face[0]]
            + s[inside, None] * (p[face[1]] - p[face[0]])
            + t[inside, None] * (p[face[2]] - p[face[0]])
        )
        y += lo[1]
        x += lo[0]
        tracks[y, x] = striation(xyz, g)
        zone[y, x] = 1
        if g == 5:
            phase = (xyz[:, 1] - 0.45 * abs(xyz[:, 0] - 0.012) - 1.60) / 0.044
            crest = np.cos(2 * np.pi * phase)
            line = np.exp(-(((crest + 0.77) / 0.25) ** 2))
            locks[y, x] = (0.017 * crest - 0.055 * line) * ease((0.050 - xyz[:, 2]) / 0.13)
    # Preserve the warm root-to-tip pigment with fine variations in red, gold and honey.
    rgb += tracks[:, :, None] * zone[:, :, None] * np.array([0.041, 0.053, 0.048])
    rgb += locks[:, :, None] * np.array([0.73, 0.95, 1.08])
    Image.fromarray(np.rint(np.clip(rgb, 0, 1) * 255).astype("uint8")).save(
        folder / "bust-color.jpg", quality=97, subsampling=0
    )
    norm = np.array(Image.open(folder / "bust-normal.png"), dtype=np.float32) / 127.5 - 1
    field = Image.fromarray(np.rint((tracks * 0.5 + 0.5) * 255).astype("uint8")).resize(
        (norm.shape[1], norm.shape[0]), Image.Resampling.LANCZOS
    )
    field = np.array(field, dtype=np.float32) / 127.5 - 1
    dy, dx = np.gradient(field)
    norm[:, :, 0] -= 0.17 * dx
    norm[:, :, 1] += 0.17 * dy
    norm /= np.maximum(0.01, np.linalg.norm(norm, axis=2, keepdims=True))
    Image.fromarray(np.rint((np.clip(norm, -1, 1) * 0.5 + 0.5) * 255).astype("uint8")).save(
        folder / "bust-normal.png", optimize=True
    )
