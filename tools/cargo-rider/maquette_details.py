"""Sculpt the folded pinnae and the oval shell collar in reference-panel coordinates."""

import math
import numpy as np
from maquette import REAR_AXIS, SIDE_AXIS, fit
from surface import atrow, bn, grid, pi, ring, unit


def make_ear(sign):
    # Each entry gives the rear silhouette and the profile silhouette at one height.
    rows = [
        (12, 195, 196.2, 302, 303.3),
        (25, 193, 209, 299, 318),
        (50, 192, 228, 296, 343),
        (88, 192, 250, 296, 370),
        (127, 196, 273, 298, 393),
        (163, 206, 295, 303, 410),
        (194, 220, 307, 314, 421),
        (218, 238, 313, 333, 419),
        (235, 251, 308, 347, 402),
        (251, 257, 295, 357, 387),
        (271, 268, 282, 362, 375),
        (281, 274, 275, 367, 368.1),
    ]

    def pinna(u, t):
        row = 12 + 269 * t
        outer, inner, front, back = atrow(rows, row)
        sx, z = REAR_AXIS - (outer + inner) * 0.5, SIDE_AXIS - (front + back) * 0.5
        wx, wz = (inner - outer) * 0.5, (back - front) * 0.5
        sn, cs = ring(u)
        # The hollow opens forwards. Most of the profile thickness is the turned
        # orange back of the pinna, with the red well folded into the front edge.
        edge = max(0.05, math.sin(pi * t) ** 0.66)
        rim = 8.1 * math.exp(-(((abs(sn) - 0.79) / 0.13) ** 2)) * max(0, cs) ** 0.5
        bowl = 12.4 * max(0, cs) ** 2.2 * (1 - abs(sn)) ** 0.68
        horiz = wx * (sn * 0.98 + 0.16 * cs) + (0.30 * rim - 0.18 * bowl) * edge
        depth = wz * (0.79 * cs - 0.613 * sn) + (rim - bowl) * edge
        return [sign * (sx + horiz), row, z + depth]

    def pigment(p, u, t):
        sn, cs = ring(u)
        return [sn, p[1], cs, sign]

    grid(
        'Sculpted ear' + ('.L' if sign > 0 else '.R'),
        40,
        38,
        pinna,
        fit,
        bn('ear', sign),
        'maquette_ear',
        material='Satin',
        group='Ears and hair',
        uvsize=(400, 470),
        cyclic=True,
        reverse=sign < 0,
        project=pigment,
    )


def shell_necklace():
    def center(a):
        return np.array([55.5 * math.sin(a), 573 + 12.8 * math.cos(a), 4 + 57 * math.cos(a)])

    def string(u, t):
        a = 2 * pi * u
        s, c = ring(t)
        return center(a) + np.array([math.sin(a) * 2.1 * c, 2.1 * s, math.cos(a) * 2.1 * c])

    grid('Shell necklace cord', 54, 6, string, fit, 'neck', 'espresso', cyclic=True, uvsize=(100, 18))
    for i in range(12):
        a = 2 * pi * (i + 0.12) / 12
        along = unit(center(a + 0.001) - center(a - 0.001))
        front = unit(np.array([math.sin(a), 0.0, math.cos(a)]))
        vertical = unit(np.cross(front, along))
        if vertical[1] < 0:
            vertical = -vertical
        origin = center(a)

        def shell(u, t):
            phi = 2 * pi * u
            latitude = pi * (t - 0.5) * 0.998
            y = math.sin(latitude)
            swell = math.cos(latitude) ** 0.91
            slit = 1 - 0.066 * math.exp(-(((y - 0.012) / 0.085) ** 2))
            return (
                origin
                + along * (15.1 * math.sin(phi) * swell * slit)
                + front * (11.7 * math.cos(phi) * swell * slit)
                + vertical * (12.25 * y)
            )

        grid(
            'Oval shell %02d' % (i + 1),
            22,
            12,
            shell,
            fit,
            'neck',
            'maquette_shell',
            cyclic=True,
            material='Pearl',
            group='Jewelry',
            uvsize=(80, 55),
            project=lambda p, u, t: [u, t, 0, 0],
        )
