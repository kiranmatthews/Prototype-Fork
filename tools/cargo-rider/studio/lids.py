"""Independent tarsal plates follow the measured globe curvature through the blink."""

import numpy as np
from fit_body import ease


def build(put, lib, ctrl):
    from facial import to_world, eye_curve

    mat = lib.make(
        "Velvet | articulated eyelids", None, 0.59, 0.255, 0, 0.085, color=(0.839, 0.161, 0.0034)
    )
    for side, suffix in [(1, ".L"), (-1, ".R")]:
        upper, lower = ctrl.eyes[side]
        q = ctrl.skin
        t = np.linspace(0, 1, 44)
        t = 0.5 - 0.5 * np.cos(np.pi * t)
        h = np.interp(t, [0, 1], [min(q[upper, 0] * side), max(q[upper, 0] * side)])
        top = eye_curve(q, upper, side, h)
        lo = eye_curve(q, lower, side, h)
        gap = top - lo
        meet = lo + 0.245 * gap
        cx = 0.103742
        cy = 0.36503
        cz = 0.06453
        phase = np.sin(np.pi * t) ** 0.66
        for high in (True, False):
            sign = 1 if high else -1
            border = top if high else lo
            end = meet + (-0.0030 if high else 0.0030) * phase
            anchor = border + sign * (0.011 + 0.042 * phase)

            def arc(pos, r, closed, open_wide=0, angle=0):
                start = anchor + sign * 0.006 * open_wide * phase
                free = (
                    border
                    + sign * 0.007 * phase
                    + closed * (end - border - sign * 0.007 * phase)
                    + sign * open_wide * 0.037 * phase
                )
                free += angle * phase * (-(0.054 - 0.040 * t) if high else 0.005)
                y = (1 - r) * start + r * free
                rad = np.maximum(0.000012, 0.0944**2 - (h - cx) ** 2 - (y - cy) ** 2)
                shell = cz + np.sqrt(rad)
                near = np.exp(-(((h - 0.119) / 0.108) ** 6))
                # Fall under the original orbital skin at the fold and cover the cornea at the free edge.
                z = shell + (0.0041 * r - 0.0043 * (1 - r)) * phase - 0.0026 * (1 - closed) * phase
                z += closed * phase * (0.0052 * np.sin(np.pi * r * 0.91) + 0.0020 * r)
                return np.column_stack((h * side, y, z - 0.0006 * (1 - near)))

            rows = np.linspace(0, 1, 8)

            def surface(blink=0, wide=0, angle=0):
                return np.vstack([arc(t, float(r), blink, wide, angle) for r in rows])

            p = surface()
            v = to_world(p)
            closed = to_world(surface(1))
            half = to_world(surface(0.5))
            wide = to_world(surface(0, 1))
            keys = ctrl.shapes(p, "lid", side)
            keys["Blink" + suffix] = closed - v
            keys["LidArc" + suffix] = half - 0.5 * (v + closed)
            keys["Squint" + suffix] = to_world(surface(0.36 if high else 0.51)) - v
            keys["EyeWide" + suffix] = wide - v
            keys["LidAngle" + suffix] = to_world(surface(angle=1)) - v
            keys["EyeJoy"] = to_world(surface(0.10 if high else 0.28)) - v
            f = []
            n = len(t)
            for j in range(len(rows) - 1):
                for i in range(n - 1):
                    a = j * n + i
                    b = a + 1
                    c = a + n
                    d = c + 1
                    f.extend(((a, c, b), (b, c, d)))
            f = np.array(f)
            if (high and side == -1) or (not high and side == 1):
                f = f[:, ::-1]
            put(
                ("Upper" if high else "Lower") + " moving eyelid " + suffix,
                "Eyes",
                v,
                f,
                [],
                "head-presentation",
                mat,
                keys,
            )
