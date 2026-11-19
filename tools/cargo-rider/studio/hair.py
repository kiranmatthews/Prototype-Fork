"""Rigidly unpose the portrait hairstyle at the sockets; secondary movement is sculpted from rest."""

import numpy as np
from fit_body import ease


def design_space(p):
    x = np.array((0.2255, -0.0256, -0.0634))
    x /= np.linalg.norm(x)
    z = np.cross(x, [0, 1, 0])
    z /= np.linalg.norm(z)
    y = np.cross(z, x)
    # The origin is the center of the cowrie ring on the source bust.
    return (p - np.array((0.002, 0.214, 0.042))) @ np.stack((x, y, z)).T


def fit(p):
    v = design_space(p) * [0.891, 0.901, 0.884] + [0, 1.531, -0.020]
    v[:, 0] += 0.012 + 0.034 * ease((v[:, 1] - 1.73) / 0.33)
    v[:, 1] -= 0.076 * v[:, 0]
    return v


def register(v, groups):
    # The two elastics in the three-quarter source are 53 mm apart in depth.
    # Align their shared axis across the neutral skull before fitting the distal locks.
    q = v.copy()
    co, si = np.cos(0.17453), np.sin(0.17453)
    xx = v[:, 0]
    zz = v[:, 2] + 0.035
    q[:, 0] = co * xx + si * zz - 0.010
    q[:, 2] = -si * xx + co * zz - 0.035
    tail = np.isin(groups, [2, 3]) * ease((1.87 - q[:, 1]) / 0.444)
    sign = np.sign(q[:, 0])
    q[:, 0] -= 0.023 * tail
    q[:, 2] -= sign * 0.015 * tail
    q[:, 1] -= sign * 0.012 * tail
    ear = np.isin(groups, [8, 9]) * ease((q[:, 1] - 1.919) / 0.26)
    q[:, 0] += 0.027 * ear
    q[:, 2] += sign * 0.015 * ear
    q[:, 1] -= sign * 0.012 * ear
    return q


def shapes(p, groups):
    v = register(fit(p), groups)
    out = {}
    for sign, suffix in [(1, ".L"), (-1, ".R")]:
        side = groups == (3 if sign == 1 else 2)
        reach = np.clip((1.880 - v[:, 1]) / 0.445, 0, 1)
        # Carry the upper fan and let the distal tips trace a larger arc around the tie.
        t = (0.13 + 0.87 * reach) ** 1.35 * side
        delta = np.zeros_like(v)
        delta[:, 0] = sign * 0.072 * t
        delta[:, 2] = -0.064 * t
        delta[:, 1] = 0.024 * t
        out["PonySwing" + suffix] = delta
        pivot = np.array([sign * 0.18, 1.86, -0.10])
        for key, direction in [("HairSweep.L", 1), ("HairSweep.R", -1)]:
            angle = direction * t * 0.47
            rel = v - pivot
            diff = np.zeros_like(v)
            diff[:, 0] = rel[:, 0] * (np.cos(angle) - 1) + rel[:, 2] * np.sin(angle)
            diff[:, 2] = -rel[:, 0] * np.sin(angle) + rel[:, 2] * (np.cos(angle) - 1)
            diff[:, 1] = 0.016 * t
            out[key] = out.get(key, 0) + diff
        ear = groups == (9 if sign == 1 else 8)
        h = np.clip((v[:, 1] - 1.903) / 0.306, 0, 1)
        factor = ease(h) * ear
        for name, displacement in [
            ("EarFold", (0.047, -0.061, -0.20)),
            ("EarPerk", (-0.047, 0.021, 0.077)),
            ("EarStretch", (0.004, 0.111, 0.007)),
        ]:
            delta = np.column_stack(
                (
                    sign * displacement[0] * factor,
                    displacement[1] * factor,
                    displacement[2] * factor,
                )
            )
            out[name + suffix] = delta
    return out
