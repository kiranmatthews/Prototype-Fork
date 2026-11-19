"""Broad, bevelled locks with a twisting crest and two unequal ribbon faces."""

import math
import numpy as np
from surface import grid, hermite, pi, ring, smooth, unit


def ponytail_depth(rows, spread):
    # The ties sit behind the pinnae. Fan the locks away from the back of the
    # skull so their full C-curve reads in profile as well as the front view.
    result = []
    for i, (x, v, d, w, h) in enumerate(rows):
        t = i / (len(rows) - 1)
        back = 29 + spread * (0.82 * smooth(t / 0.68) + 0.18 * t)
        result.append([x, v, d - back, w, h])
    return result


def sculpt_lock(name, rows, nu, nv, fit, weight, paint, *, parting=0, **options):
    guides = np.asarray(rows, float)
    side = 1 if guides[len(guides) // 2, 0] > 0 else -1
    fringe = name.startswith('Curtain')
    back = name.startswith('Combed')
    phase = parting * 0.83

    def ribbon(u, t):
        c = hermite(guides, t)
        tangent = unit(hermite(guides, min(1, t + 0.0007))[:3] - hermite(guides, max(0, t - 0.0007))[:3])
        across = unit(np.array([tangent[1], -tangent[0], 0.0]))
        deep = unit(np.cross(across, tangent))
        twist = side * math.radians((9 + 6 * math.sin(phase)) * (1 - t) - (16 + 7 * math.cos(phase)) * t)
        wide = math.cos(twist) * across + math.sin(twist) * deep
        fore = math.cos(twist) * deep - math.sin(twist) * across
        s, b = ring(u)
        breadth = max(0.045, c[3]) * (1.03 if fringe else 1.04) * (0.84 + 0.16 * smooth(t / 0.25))
        height = (
            max(0.035, c[4])
            * (0.72 if fringe else (0.69 if back else 0.79))
            * (1 - 0.34 * smooth((t - 0.63) / 0.36))
        )
        # The raised ridge is off-centre. Its crease follows a curved part along
        # the flow rather than making parallel flutes around a round tube.
        crest = side * (0.20 + 0.15 * math.sin(pi * t + phase))
        cut = math.exp(-(((s - crest) / 0.18) ** 2))
        plane = (1 - 0.25 * abs(s - crest)) * (1 - 0.18 * cut * math.sin(pi * t) ** 0.65)
        depth = math.copysign(abs(b) ** 0.82, b) * height * plane
        bias = 0.095 * (1 - s * s) * math.sin(pi * t + phase) * side
        return c[:3] + wide * breadth * (s + bias) + fore * depth

    grid(name, nu, nv, ribbon, fit, weight, paint, cyclic=True, **options)
