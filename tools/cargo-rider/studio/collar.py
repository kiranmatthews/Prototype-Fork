"""Join the measured neck section of each component underneath the cowrie strand."""

import numpy as np


def bridge(bottom, top):
    def order(v):
        center = 0.5 * (v[:, [0, 2]].min(0) + v[:, [0, 2]].max(0))
        t = np.arctan2(v[:, 2] - center[1], v[:, 0] - center[0]) % (2 * np.pi)
        i = np.argsort(t)
        t, v = t[i], v[i]
        keep = np.r_[True, np.diff(t) > 1e-5]
        return t[keep], v[keep]

    a, b = order(bottom), order(top)
    t = np.linspace(0, 2 * np.pi, 64, endpoint=False)

    def uniform(section):
        angles, co = section
        return np.stack([np.interp(t, angles, col, period=2 * np.pi) for col in co.T], axis=1)

    q, r = uniform(a), uniform(b)
    rings = [a, (t, q * 0.72 + r * 0.28), (t, q * 0.28 + r * 0.72), b]
    pts = []
    faces = []
    ids = []
    for _, co in rings:
        ids.append(np.arange(len(co)) + len(pts))
        pts.extend(co)
    for j in range(len(rings) - 1):
        angles1, angles2 = rings[j][0], rings[j + 1][0]
        lo, hi = ids[j : j + 2]
        i = k = 0
        while i < len(lo) or k < len(hi):
            nextlo = (
                angles1[(i + 1) % len(lo)] + 2 * np.pi * ((i + 1) // len(lo))
                if i < len(lo)
                else np.inf
            )
            nexthi = (
                angles2[(k + 1) % len(hi)] + 2 * np.pi * ((k + 1) // len(hi))
                if k < len(hi)
                else np.inf
            )
            l, h = lo[i % len(lo)], hi[k % len(hi)]
            if nextlo < nexthi:
                i += 1
                faces.append((l, h, lo[i % len(lo)]))
            else:
                k += 1
                faces.append((l, h, hi[k % len(hi)]))
    return np.asarray(pts), np.asarray(faces)
