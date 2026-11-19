"""Build quad patches in reference pixels and fit them to the measured Bone Man rig.
Authoring coordinates are horizontal, down the reference, and depth towards the camera.
"""

from pathlib import Path
import json
import math
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
ART = ROOT / 'art/cargo-rider'
RIG = json.loads((HERE / 'calibration.json').read_text())
M = {k: np.array(v['matrix']).reshape(4, 4).T for k, v in RIG.items()}
J = {k: v[:3, 3] for k, v in M.items()}
parts = []
pi = np.pi


def unit(v):
    return v / max(np.linalg.norm(v), 1e-10)


def clamp(x, a=0, b=1):
    return np.clip(x, a, b)


def smooth(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def interp(v, profile):
    return float(np.interp(v, [k[0] for k in profile], [k[1] for k in profile]))


def hermite(rows, t):
    """Cardinal interpolation through a row of sculpt handles, clamped at each end."""
    a = np.asarray(rows, float)
    q = float(clamp(t)) * (len(a) - 1)
    i = min(int(q), len(a) - 2)
    f = q - i
    p0, p1, p2, p3 = a[max(i - 1, 0)], a[i], a[i + 1], a[min(i + 2, len(a) - 1)]
    return 0.5 * (
        (2 * p1)
        + (-p0 + p2) * f
        + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
        + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f
    )


def atrow(rows, v):
    idx = np.interp(v, [r[0] for r in rows], np.arange(len(rows)))
    return hermite(rows, idx / (len(rows) - 1))[1:]


def ring(t):
    return math.sin(2 * pi * t), math.cos(2 * pi * t)


def mixweights(a, b, t):
    if a == b:
        return {a: 1.0}
    t = float(clamp(t))
    result = {a: 1 - t, b: t}
    return {k: v for k, v in result.items() if v > 1e-6}


def chain(v, knots):
    names = [k[1] for k in knots]
    positions = [k[0] for k in knots]
    if v <= positions[0]:
        return {names[0]: 1.0}
    for i in range(1, len(knots)):
        if v <= positions[i]:
            return mixweights(
                names[i - 1], names[i], smooth((v - positions[i - 1]) / (positions[i] - positions[i - 1]))
            )
    return {names[-1]: 1.0}


def side(sign):
    return 'left' if sign > 0 else 'right'


def bn(name, sign):
    return name + '-' + side(sign)


# A continuous guide per region. Local line and ankle offsets follow the real rider's measured sockets.
body_y = [
    (266, 1.625),
    (282, 1.572),
    (290, 1.535),
    (337, J['shoulder-left'][1]),
    (405, J['chest'][1]),
    (490, J['spine'][1]),
    (550, J['hips'][1]),
    (600, 0.819),
]
body_x = 0.00263
head_scale = 0.000885
head_z = -0.052


def torso_fit(p):
    x, v, d = p
    shoulder = 1 + 0.29 * math.exp(-(((v - 334) / 32) ** 2))
    return np.array([x * body_x * shoulder, interp(v, body_y), d * 0.00242])


def head_fit(p):
    x, v, d = p
    return np.array([x * head_scale, 1.542 + (766 - v) * head_scale, head_z + d * head_scale])


def hair_fit(p):
    x, v, d = p
    s = 0.00258
    return np.array([x * s, 1.542 + (291 - v) * s, head_z + d * s])


def limb_fit(p, sg, kind):
    x, v, d = p
    if kind == 'arm':
        rows = [(305, 47), (337, 63), (425, 115), (515, 171), (568, 190)]
        names = ['shoulder', 'elbow', 'wrist']
        pix = [337, 425, 515]
        thick = 0.0024
    else:
        rows = [(465, 41), (550, 53), (751, 79), (913, 100), (995, 102)]
        names = ['hip', 'knee', 'ankle']
        pix = [550, 751, 913]
        thick = 0.00202
    anchors = [J[bn(n, sg)] for n in names]
    ii = 0 if v < pix[1] else 1
    f = (v - pix[ii]) / (pix[ii + 1] - pix[ii])
    base = anchors[ii] * (1 - f) + anchors[ii + 1] * f
    result = base + np.array([(sg * x - interp(v, rows)) * thick * sg, 0, d * thick])
    return result


def leg_weights(v, sg):
    return chain(
        v,
        [
            (484, 'hips'),
            (548, bn('hip', sg)),
            (698, bn('hip', sg)),
            (790, bn('knee', sg)),
            (884, bn('knee', sg)),
            (930, bn('ankle', sg)),
        ],
    )


def arm_weights(v, sg):
    return chain(
        v,
        [
            (305, bn('clavicle', sg)),
            (345, bn('shoulder', sg)),
            (398, bn('shoulder', sg)),
            (448, bn('elbow', sg)),
            (490, bn('elbow', sg)),
            (523, bn('wrist', sg)),
        ],
    )


def torso_weights(v):
    return chain(
        v,
        [
            (284, 'head-presentation'),
            (299, 'head'),
            (309, 'neck'),
            (332, 'chest'),
            (398, 'chest'),
            (452, 'spine'),
            (480, 'spine'),
            (541, 'hips'),
        ],
    )


# Helpers produce parametric quad patches. The seam duplicates UVs; normals are stitched on export.


def grid(
    name,
    nu,
    nv,
    surface,
    fit,
    weights,
    paint,
    *,
    uvsize=(96, 96),
    material='Satin',
    cyclic=False,
    keys=None,
    group='Wardrobe',
    project=None,
    reverse=False,
):
    points = []
    ws = []
    proj = []
    morph = {k: [] for k in keys or {}}
    for j in range(nv + 1):
        v = j / nv
        for i in range(nu + 1):
            u = i / nu
            p = np.array(surface(u, v), float)
            points.append(fit(p))
            w = weights(p, u, v) if callable(weights) else {weights: 1.0}
            ws.append(w)
            proj.append(project(p, u, v) if project else [p[0], p[1], math.cos(2 * pi * u), p[2]])
            for key, fn in (keys or {}).items():
                morph[key].append(fit(fn(p.copy(), u, v)) - points[-1])
    faces = []
    for j in range(nv):
        for i in range(nu):
            n = j * (nu + 1) + i
            quad = [n, n + 1, n + nu + 2, n + nu + 1]
            faces.append(quad if reverse else quad[::-1])
    parts.append(
        dict(
            name=name,
            nu=nu,
            nv=nv,
            points=np.array(points),
            weights=ws,
            faces=faces,
            proj=np.array(proj).reshape(nv + 1, nu + 1, 4),
            paint=paint,
            uvsize=uvsize,
            mat=material,
            cyclic=cyclic,
            keys={k: np.array(a) for k, a in morph.items()},
            group=group,
        )
    )


def loft(name, rows, n, m, fit, weight, paint, **kw):
    # (v,cx,width,front depth,back depth,depth center)
    def surf(u, t):
        v = rows[0][0] + t * (rows[-1][0] - rows[0][0])
        cx, w, fd, bd, dc = atrow(rows, v)
        sn, cs = ring(u)
        return [cx + w * sn, v, dc + cs * (fd if cs >= 0 else bd)]

    grid(name, n, m, surf, fit, weight, paint, cyclic=True, **kw)


def sweep(name, rows, n, m, fit, weight, paint, *, flutes=0, **kw):
    # (x,v,d,half width,half thickness). Flatten each lock across the local flow.
    def surf(u, t):
        c = hermite(rows, t)
        tangent = hermite(rows, min(1, t + 0.001))[:3] - hermite(rows, max(0, t - 0.001))[:3]
        normal = unit(np.array([tangent[1], -tangent[0], 0.0]))
        up = unit(np.cross(normal, unit(tangent)))
        sn, cs = ring(u)
        groove = 1 + (0.045 * math.cos(2 * pi * u * flutes + 0.65 * math.sin(t * pi)) if flutes else 0)
        return c[:3] + normal * max(0.05, c[3]) * sn * groove + up * max(0.05, c[4]) * cs * groove

    grid(name, n, m, surf, fit, weight, paint, cyclic=True, **kw)


def ball(name, center, radii, fit, weight, paint, *, n=20, m=12, **kw):
    def surf(u, t):
        sn, cs = ring(u)
        a = 0.002 + (pi - 0.004) * t
        h = math.sin(a)
        return [
            center[0] + radii[0] * sn * h,
            center[1] - radii[1] * math.cos(a),
            center[2] + radii[2] * cs * h,
        ]

    grid(name, n, m, surf, fit, weight, paint, cyclic=True, **kw)


def stroke(name, pts, r, fit, weights, paint, **kw):
    rows = [
        [*p, r * (0.26 if i in (0, len(pts) - 1) else 1), r * (0.28 if i in (0, len(pts) - 1) else 1)]
        for i, p in enumerate(pts)
    ]
    sweep(name, rows, 8, max(9, len(pts) * 3), fit, weights, paint, **kw)


def profile_point(x, v, rows):
    cx, w, fd, bd, dc = atrow(rows, v)
    rel = clamp((x - cx) / max(0.01, w), -1, 1)
    return dc + fd * math.sqrt(max(0, 1 - rel * rel))
