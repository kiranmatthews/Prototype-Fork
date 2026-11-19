"""Anatomical rest-space facial animation for the frontal, expression-neutral draft."""

import heapq
import numpy as np
import geometry
from fit_body import ease, track


def to_world(p):
    x, y, z = p.T
    # Compact chin and cheeks above the collar. The neck follows the same centerline as the body.
    fit = track(
        y,
        [
            (0, 1.483, 0.525, 0.49, 0.085),
            (0.05, 1.521, 0.51, 0.45, 0.085),
            (0.105, 1.552, 0.69, 0.61, 0.061),
            (0.186, 1.600, 0.721, 0.638, 0.033),
            (0.268, 1.648, 0.735, 0.64, 0.033),
            (0.365, 1.718, 0.734, 0.687, 0.052),
            (0.47, 1.796, 0.720, 0.689, 0.048),
            (0.57, 1.849, 0.722, 0.660, 0.024),
            (0.67, 1.922, 0.70, 0.649, 0.022),
            (1, 2.145, 0.706, 0.65, 0.023),
        ],
    )
    # Chin displacement is continuous behind the muzzle. Compress the buried cranium inside the cap.
    v = np.column_stack((x * fit[:, 1], fit[:, 0], z * fit[:, 2] + fit[:, 3]))
    neck = (1 - ease((y - 0.091) / 0.098)) * (1 - ease((z + 0.075) / 0.115))
    # Normalize the generated angled neck stump to the rider's upright neck at the collar.
    cx = np.interp(y, [0.0, 0.055, 0.095, 0.17], [0.181, 0.183, 0.162, 0.11])
    v[:, 2] = v[:, 2] * (1 - neck) + ((z + cx) * 0.392) * neck
    v[:, 0] = v[:, 0] * (1 - neck) + x * (0.528 + 0.10 * ease((y - 0.075) / 0.08)) * neck
    # Match the back of the neutral cranium to the measured occiput and nape
    # inside the coiffure. The source bald draft has a much deeper, rounder nape.
    back = ease((0.073 - v[:, 2]) / 0.142)
    nape = (
        np.interp(
            v[:, 1],
            [1.522, 1.549, 1.572, 1.594, 1.62, 1.65, 1.68, 1.72, 1.76, 1.81, 1.86],
            [0, 0.035, 0.29, 0.56, 0.58, 0.50, 0.40, 0.29, 0.18, 0.065, 0],
        )
        * back
    )
    v[:, 2] += (0.012 - v[:, 2]) * nape
    v[:, 0] *= 1 - 0.70 * nape
    return v


def graph(p, f):
    edges = np.unique(
        np.sort(np.vstack((f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]])), axis=1),
        axis=0,
        return_counts=True,
    )
    links = [[] for _ in p]
    for (a, b), dist in zip(
        edges[0], np.linalg.norm(p[edges[0][:, 0]] - p[edges[0][:, 1]], axis=1)
    ):
        links[a].append((b, float(dist)))
        links[b].append((a, float(dist)))
    return links, edges[0][edges[1] == 1]


def distance(adjacency, seeds):
    d = np.full(len(adjacency), np.inf)
    d[seeds] = 0
    todo = [(0, int(i)) for i in seeds]
    heapq.heapify(todo)
    while todo:
        val, i = heapq.heappop(todo)
        if val != d[i]:
            continue
        for j, length in adjacency[i]:
            v = val + length
            if v < d[j]:
                d[j] = v
                heapq.heappush(todo, (v, j))
    return d


def rings(edges):
    g = {}
    for a, b in edges:
        g.setdefault(int(a), []).append(int(b))
        g.setdefault(int(b), []).append(int(a))
    free = set(g)
    loops = []
    while free:
        first = min(free)
        prev = -1
        i = first
        loop = []
        while i in free:
            loop.append(i)
            free.remove(i)
            opts = [j for j in g[i] if j != prev]
            if not opts:
                break
            prev, i = i, opts[0]
        if len(loop) > 8:
            loops.append(np.array(loop))
    return loops


def halves(p, loop, side=1):
    x = p[loop, 0] * side
    a = int(x.argmin())
    loop = np.roll(loop, -a)
    b = int(np.argmax(p[loop, 0] * side))
    one = loop[: b + 1]
    two = np.r_[loop[0], loop[: b - 1 : -1]]
    return (one, two) if p[one, 1].mean() > p[two, 1].mean() else (two, one)


def eye_curve(p, arc, sign, x):
    ix = np.argsort(p[arc, 0] * sign)
    q = p[arc[ix]]
    return np.interp(x, q[:, 0] * sign, q[:, 1])


class Controls:
    def __init__(self, skin, faces):
        self.skin = skin
        adjacency, boundary = graph(skin, faces)
        loops = rings(boundary)
        q = skin[boundary].mean(1)
        edges = boundary[(q[:, 1] > 0.183) & (q[:, 1] < 0.202) & (q[:, 2] > 0.205)]
        oral = {}
        for a, b in edges:
            oral.setdefault(int(a), []).append(int(b))
            oral.setdefault(int(b), []).append(int(a))
        start = min(oral, key=lambda i: skin[i, 0])
        # A four-way vertex borders the tiny terminal pocket in the right commissure.
        end = max(
            (i for i in oral if len(oral[i]) > 2),
            key=lambda i: skin[i, 0],
            default=max(oral, key=lambda i: skin[i, 0]),
        )
        paths = []
        for first in oral[start]:
            path = [start, first]
            while path[-1] != end:
                choices = [j for j in oral[path[-1]] if j != path[-2] and j not in path]
                if not choices:
                    break
                path.append(choices[0])
            paths.append(np.array(path))
        # The lips turn back into the mouth. The higher internal edge enters the
        # LOWER external lip. Identify the boundary by its geodesic route to the chin.
        probe = np.linalg.norm(skin - np.array((0, 0.168, 0.267)), axis=1).argmin()
        route = distance(adjacency, [int(probe)])
        self.lips = tuple(sorted(paths, key=lambda a: -np.median(route[a])))
        self.mouth = np.r_[self.lips[0], self.lips[1][-2:0:-1]]
        self.eyes = {}
        self.distance = {}
        self.adjacency = adjacency
        for s in (1, -1):
            loop = next(
                l for l in loops if 0.33 < skin[l, 1].mean() < 0.40 and s * skin[l, 0].mean() > 0.08
            )
            self.eyes[s] = halves(skin, loop, s)
        for key, arcs in [("lip", self.lips), *self.eyes.items()]:
            self.distance[key] = [distance(adjacency, a) for a in arcs]

    def fair_jaw(self, values, p):
        # A harmonic falloff over the real skin surface crosses cheeks and chin,
        # with separate Dirichlet boundaries on either side of the lip opening.
        adjacency = self.adjacency
        edges = np.array([(i, j) for i, ns in enumerate(adjacency) for j, d in ns if i < j])
        a, b = edges.T
        wt = 1 / np.maximum(0.0021, np.linalg.norm(p[a] - p[b], axis=1))
        total = np.bincount(a, weights=wt, minlength=len(p)) + np.bincount(
            b, weights=wt, minlength=len(p)
        )
        total = np.maximum(total, 0.001)
        u, l = self.distance["lip"]
        near = np.minimum(l, u)
        free = (abs(p[:, 0]) < 0.25) & (p[:, 1] > 0.103) & (p[:, 1] < 0.281) & (p[:, 2] > 0.056)
        length = np.clip((0.103 - abs(p[:, 0])) / 0.035, 0, 1)
        length = ease(length)
        fixed = np.zeros(len(p), bool)
        for arc, w in [(self.lips[0], 0.0), (self.lips[1], 1.0)]:
            edge = length[arc]
            values[arc] = 0.38 + (w - 0.38) * edge
            fixed[arc] = True
        fixed |= (p[:, 1] > 0.230) & (near > 0.038)
        fixed |= (p[:, 1] < 0.164) & (p[:, 2] > 0.10) & (abs(p[:, 0]) < 0.104)
        lock = free & ~fixed
        base = values.copy()
        for _ in range(80):
            avg = (
                np.bincount(a, weights=values[b] * wt, minlength=len(p))
                + np.bincount(b, weights=values[a] * wt, minlength=len(p))
            ) / total
            values[lock] = 0.34 * values[lock] + 0.65 * avg[lock] + 0.01 * base[lock]
        return values

    def shapes(self, p, kind, side=None, lip_mix=None):
        x, y, z = p.T
        ax = abs(x)
        zero = np.zeros_like(x)

        def vec(x=0, y=0, z=0):
            return np.column_stack((zero + x, zero + y, zero + z))

        keys = {}
        oral = kind.startswith(("mouth", "teeth", "tongue"))
        if kind == "skin":
            upper, lower = self.distance["lip"]
            # Opposing interior surfaces may be 1mm apart in space and 6cm apart over the skin.
            lower_field = ease(0.50 + (upper - lower) / (0.026 + np.minimum(lower, upper) * 1.2))
            back = ease((z + 0.16) / 0.27)
            below = 1 - ease((y - 0.185) / 0.082)
            # The open seam extends back into the mouth. On the outside, the lip
            # roll doubles over that rim. Classify its outer skin from both height and topology.
            lower_field *= below * back
            jawline = 1 - ease((y - 0.175) / 0.054)
            front = ease((z - 0.075) / 0.09)
            far = ease((np.minimum(upper, lower) - 0.053) / 0.079)
            lower_field = lower_field * (1 - far) + jawline * front * far
            lower_field = self.fair_jaw(lower_field, p)
        elif oral:
            lower_field = (
                lip_mix
                if lip_mix is not None
                else (np.ones(len(p)) if kind in ("teeth-lower", "tongue") else zero)
            )
        else:
            lower_field = zero
        muzzle = (
            ease((z - 0.08) / 0.12) * (1 - ease((y - 0.225) / 0.103)) * ease((y - 0.079) / 0.069)
        )
        corner = np.exp(-(((ax - 0.081) / 0.075) ** 2) - ((y - 0.193) / 0.073) ** 2) * ease(
            (z - 0.086) / 0.10
        )
        cheeks = np.exp(
            -(((ax - 0.158) / 0.112) ** 2) - ((y - 0.248) / 0.100) ** 2 - ((z - 0.165) / 0.17) ** 2
        )
        if kind in ("skin", "nose") or oral:
            hinge_y = 0.237
            hinge_z = -0.027
            angle = 0.47
            dy = y - hinge_y
            dz = z - hinge_z
            keys["JawOpen"] = vec(
                0,
                (dy * (np.cos(angle) - 1) - dz * np.sin(angle)) * lower_field,
                (dy * np.sin(angle) + dz * (np.cos(angle) - 1)) * lower_field,
            )
            # The cranial pads lift a little as the mandible opens, preserving a readable upper lip.
            if kind in ("skin", "nose"):
                keys["JawOpen"] += vec(0, 0.015 * muzzle * (1 - lower_field), 0)
            keys["Smile"] = vec(
                np.sign(x) * (0.055 * corner + 0.011 * cheeks),
                0.066 * corner + 0.016 * cheeks,
                -0.032 * corner,
            )
            keys["Pucker"] = vec(-x * 0.48 * muzzle, 0.008 * muzzle, 0.060 * muzzle)
            keys["Funnel"] = vec(-x * 0.39 * muzzle, -0.014 * muzzle * lower_field, 0.043 * muzzle)
            keys["Clench"] = vec(
                np.sign(x) * 0.014 * corner, 0.021 * muzzle * lower_field, -0.014 * muzzle
            )
            middle = np.exp(-((x / 0.080) ** 4)) * muzzle
            keys["LipPress"] = vec(0, 0.013 * middle * (2 * lower_field - 1), -0.017 * middle)
            keys["LowerLipDrop"] = vec(
                0, -0.024 * middle * lower_field, 0.009 * middle * lower_field
            )
            keys["JawForward"] = vec(0, 0.003 * lower_field, 0.033 * lower_field)
            keys["NoseScrunch"] = vec(
                0,
                0.028 * np.exp(-(((y - 0.280) / 0.065) ** 2)) * ease((z - 0.10) / 0.14),
                -0.021 * muzzle,
            )
            for s, suf in [(1, ".L"), (-1, ".R")]:
                hemi = ease((s * x + 0.007) / 0.083)
                keys["Smile" + suf] = vec(
                    s * 0.052 * corner * hemi, 0.073 * corner * hemi, -0.034 * corner * hemi
                )
                keys["Frown" + suf] = vec(
                    -s * 0.015 * corner * hemi, -0.051 * corner * hemi, 0.013 * corner * hemi
                )
                keys["LipRaise" + suf] = vec(
                    0, 0.067 * corner * hemi * (1 - lower_field), 0.009 * corner * hemi
                )
                keys["JawSide" + suf] = vec(s * 0.058 * lower_field, 0, -0.013 * lower_field)
                cheek = cheeks * hemi
                keys["CheekPuff" + suf] = vec(
                    (s * 0.051 + (x - s * 0.153) * 0.33) * cheek,
                    (0.007 + (y - 0.230) * 0.43) * cheek,
                    (0.091 + 0.19 * (z - 0.152)) * cheek,
                )
                keys["CheekLift" + suf] = vec(s * 0.012 * cheek, 0.032 * cheek, 0.012 * cheek)
            if kind == "skin":
                # Inflate the transition from the buccal pads to the sealed upper lip.
                soft = np.exp(-(((ax - 0.096) / 0.064) ** 2) - ((y - 0.210) / 0.042) ** 2) * muzzle
                keys["MaskFit.puffer"] = vec(np.sign(x) * 0.005 * soft, 0.002 * soft, 0.012 * soft)
        if kind in ("skin", "upper-lash", "lower-lash", "brow"):
            for s, suf in [(1, ".L"), (-1, ".R")]:
                if side is not None and side != s:
                    continue
                h = s * x
                up, lo = self.eyes[s]
                top = eye_curve(self.skin, up, s, h)
                bottom = eye_curve(self.skin, lo, s, h)
                start = self.skin[up, 0].min() if s == 1 else -self.skin[up, 0].max()
                stop = np.max(self.skin[up, 0] * s)
                t = np.clip((h - start) / (stop - start), 0, 1)
                span = np.maximum(0, top - bottom)
                meet = bottom + 0.255 * span
                center = np.array((s * 0.103742, 0.36503, 0.06453))
                if kind == "skin":
                    du, dl = self.distance[s]
                    u = np.exp(-((du / 0.085) ** 2))
                    l = np.exp(-((dl / 0.068) ** 2))
                    # The corner itself is common to both arcs.
                    upper = ease(0.5 + (dl - du) / 0.027)
                    u *= upper
                    l *= 1 - upper
                elif kind == "upper-lash":
                    # All ink and the tapered outer canthus travel with the upper lid.
                    u = 1 - ease((h - stop) / 0.102)
                    l = zero
                elif kind == "lower-lash":
                    l = 1 - ease((h - stop) / 0.067)
                    u = zero
                else:
                    u = l = zero
                if kind != "brow":
                    drop = (meet - top - 0.003) * u + (meet - bottom + 0.0015) * l
                    if kind == "upper-lash":
                        # The span narrows at the outer canthus. Roll the outlying lash fan with it.
                        drop += (np.sin(t * np.pi) * -0.013 - 0.024 * ease((h - 0.167) / 0.065)) * u
                    near = np.clip(u + l, 0, 1)
                    xx = x - center[0]
                    yy = y - center[1]

                    def shell(ty):
                        return np.sqrt(np.maximum(0.00003, 0.0945**2 - xx * xx - ty * ty))

                    upper_glide = shell(meet - center[1]) - shell(top - center[1])
                    lower_glide = shell(meet - center[1]) - shell(bottom - center[1])
                    slide = (upper_glide * u + lower_glide * l) * (1 - ease((h - 0.19) / 0.038))
                    blink = vec(0, drop, slide + 0.001 * near * np.sin(np.pi * t))
                    if kind == "skin":
                        blink *= 0.22
                        # Roll the relaxed upper socket under the moving plate during closure.
                        # The exposed corneal surface then has one continuous lid contour.
                        fold = np.sin(np.pi * t) * u * np.exp(-(((y - top - 0.021) / 0.064) ** 2))
                        blink += vec(0, -0.006 * fold, -0.023 * fold)
                    keys["Blink" + suf] = blink
                    lid_line = np.sin(np.pi * t) * (0.054 - 0.040 * t)
                    keys["LidAngle" + suf] = vec(
                        0,
                        -u * lid_line
                        + 0.005 * l * np.sin(np.pi * t)
                        + 0.011 * u * ease((h - 0.168) / 0.054),
                        0.005 * u * np.sin(np.pi * t),
                    )
                    keys["Squint" + suf] = vec(
                        0,
                        -0.030 * u * np.sin(np.pi * t) + 0.040 * l * np.sin(np.pi * t),
                        0.006 * near,
                    )
                    keys["EyeWide" + suf] = vec(
                        0,
                        0.038 * u * np.sin(np.pi * t) - 0.025 * l * np.sin(np.pi * t),
                        -0.004 * near,
                    )
                    keys["EyeJoy"] = keys.get("EyeJoy", 0) + vec(
                        0, 0.024 * near * np.sin(np.pi * t), 0.003 * near
                    )
                bw = (
                    np.exp(-(((h - 0.132) / 0.119) ** 2) - ((y - 0.47) / 0.058) ** 2)
                    * ease((z - 0.008) / 0.11)
                    if kind == "skin"
                    else (np.ones_like(x) if kind == "brow" else zero)
                )
                inside = 1 - ease((h - 0.054) / 0.14)
                keys["BrowUp" + suf] = vec(
                    s * 0.008 * bw, (0.050 + 0.016 * inside) * bw, -0.013 * bw
                )
                keys["BrowDown" + suf] = vec(
                    -s * 0.014 * bw, (-0.014 - 0.042 * inside) * bw, 0.017 * bw
                )
                # Rotate the inner third toward the bridge while keeping the tail clear of the fringe.
                tilt = (ease((h - 0.040) / 0.145) - 0.57) * 0.083
                keys["BrowAngle" + suf] = vec(
                    s * 0.006 * bw, bw * tilt, (0.008 + 0.004 * inside) * bw
                )
        cranial = ease((y - 0.052) / 0.16)
        keys["FaceStretch"] = vec(
            -0.105 * x * cranial, (y - 0.281) * 0.27 * cranial, -0.026 * cranial
        )
        keys["FaceSquash"] = vec(
            0.178 * x * cranial, -(y - 0.281) * 0.31 * cranial, 0.025 * cranial
        )
        if kind.startswith("teeth"):
            keys["TeethRetract"] = vec(0, (0.017 if kind == "teeth-upper" else -0.016), -0.042)
        if kind == "tongue":
            tip = ease((z - 0.120) / 0.113)
            keys["TongueOut"] = vec(0, -0.043 * tip, 0.177 * tip)
            keys["TongueCurl"] = vec(0.013 * tip, 0.077 * tip**2, -0.015 * tip**2)
        if kind.startswith("teeth") or kind == "tongue":
            # The teeth and tongue follow the mandible independently of the lip pads.
            articulated = {
                "JawOpen",
                "JawSide.L",
                "JawSide.R",
                "JawForward",
                "TeethRetract",
                "TongueOut",
                "TongueCurl",
                "FaceStretch",
                "FaceSquash",
            }
            keys = {k: v for k, v in keys.items() if k in articulated}
        # The neutral registration describes this bind surface. Animated vertices never
        # pass through the registration for a different anatomical region.
        return {key: d * np.array((0.732, 0.705, 0.65)) for key, d in keys.items()}


def eye_keys(p, s):
    center = np.array((s * 0.103742, 0.36503, 0.06453))
    v = p - center

    def turn(yaw, pitch):
        co, si = np.cos(yaw), np.sin(yaw)
        moved = v.copy()
        moved[:, 0] = v[:, 0] * co + v[:, 2] * si
        d = -v[:, 0] * si + v[:, 2] * co
        co, si = np.cos(pitch), np.sin(pitch)
        moved[:, 1] = v[:, 1] * co + d * si
        moved[:, 2] = -v[:, 1] * si + d * co
        return to_world(center + moved) - to_world(p)

    result = {
        name: turn(yaw, pitch)
        for name, yaw, pitch in [
            ("LookLeft", 0.45, 0),
            ("LookRight", -0.45, 0),
            ("LookUp", 0, 0.29),
            ("LookDown", 0, -0.31),
            ("CrossEyes", -s * 0.49, 0),
            ("WallEyes", s * 0.57, 0),
        ]
    }
    direction = np.array((s * 0.066, 0.05, 0.997))
    direction /= np.linalg.norm(direction)
    radial = np.linalg.norm(v, axis=1)
    norm = v / np.maximum(0.00001, radial[:, None])
    dot = np.clip(norm @ direction, -1, 1)
    angle = np.arccos(dot)
    tangent = norm - dot[:, None] * direction
    tangent /= np.maximum(0.00001, np.linalg.norm(tangent, axis=1, keepdims=True))
    theta = angle * (0.39 + 0.61 * ease((angle - 0.43) / 0.99))
    moved = (np.cos(theta)[:, None] * direction + np.sin(theta)[:, None] * tangent) * radial[
        :, None
    ]
    result["IrisPin"] = to_world(center + moved) - to_world(p)
    return result


def ellipsoid(center, radii, slices=16, rings=10, shape=1.0):
    """A rounded dental crown, with individual width and enamel thickness."""
    v = []
    f = []
    for j in range(rings + 1):
        lat = -np.pi / 2 + np.pi * j / rings
        for i in range(slices):
            angle = 2 * np.pi * i / slices
            q = np.array((np.cos(lat) * np.cos(angle), np.sin(lat), np.cos(lat) * np.sin(angle)))
            v.append(center + np.sign(q) * abs(q) ** shape * radii)
    for j in range(rings):
        for i in range(slices):
            a = j * slices + i
            b = j * slices + (i + 1) % slices
            c = a + slices
            d = b + slices
            if j > 0:
                f.append((a, c, b))
            if j < rings - 1:
                f.append((b, c, d))
    return np.array(v), np.array(f)


def mouth_interior(put, lib, ctrl, p):
    boundary = ctrl.mouth
    q = p[boundary]
    up, lo = ctrl.lips
    # Follow the exact two rim arcs into the mouth bag. They have independent deformation weights.
    lower = set(lo[1:-1].tolist())
    w = np.array([0.49 if i in (up[0], up[-1]) else float(i in lower) for i in boundary])
    n = len(q)
    all_rows = []
    weights = []
    faces = []
    levels = [0, 0.15, 0.37, 0.68, 1]
    for level in levels:
        v = q.copy()
        v[:, 0] *= 1 - 0.28 * level
        v[:, 1] += (0.193 - v[:, 1]) * level * 0.42 + (1 - 2 * w) * 0.057 * np.sin(level * np.pi)
        v[:, 2] -= level * 0.121
        all_rows.append(v)
        weights.extend(w)
    for j in range(4):
        for i in range(n):
            a = j * n + i
            b = j * n + (i + 1) % n
            faces += [(a, b, a + n), (b, b + n, a + n)]
    all_rows = np.vstack(all_rows)
    origin = len(all_rows)
    v = np.vstack([all_rows, [0, 0.194, 0.100]])
    weights = np.r_[weights, 0.50]
    for i in range(n):
        faces.append((4 * n + i, 4 * n + (i + 1) % n, origin))
    pmat = lib.make(
        "Mulberry | inner cheeks and palate", None, 0.47, 0.29, 0.10, color=(0.10, 0.010, 0.018)
    )
    skin_keys = ctrl.shapes(p, "skin")
    inner = {}
    for key, d in skin_keys.items():
        rim = d[boundary]
        center = rim.mean(axis=0)
        rows = [rim * (1 - 0.76 * level) + center * 0.76 * level for level in levels]
        inner[key] = np.vstack([*rows, center])
    put(
        "Continuous oral vestibule and palate",
        "Dentition",
        to_world(v),
        np.array(faces),
        [],
        "head-presentation",
        pmat,
        inner,
    )
    dental = lib.make("Ivory | dental enamel", None, 0.29, 0.44, 0.19, color=(0.85, 0.73, 0.60))
    for upper in [True, False]:
        verts = []
        faces = []
        kind = "teeth-upper" if upper else "teeth-lower"
        for side in (1, -1):
            for i in range(5):
                t = (i + 0.5) / 5
                x = side * 0.083 * np.sin(t * 1.28)
                y = (0.199 if upper else 0.167) + 0.003 * t
                z = 0.234 - 0.043 * t**1.42 - (0 if upper else 0.005)
                ry = (0.014 if upper else 0.010) * (0.96 + 0.34 * (i == 2))
                rad = np.array((0.011 * (1 - 0.25 * t), ry, 0.009))
                v, f = ellipsoid(np.array((x, y, z)), rad, 14, 9, 0.67)
                faces.extend(f + len(verts))
                verts.extend(v)
        verts = np.array(verts)
        put(
            "Upper individual crowns" if upper else "Lower individual crowns",
            "Dentition",
            to_world(verts),
            np.array(faces),
            [],
            "head-presentation",
            dental,
            ctrl.shapes(verts, kind),
        )
    tongue = lib.make("Rose | tongue", None, 0.40, 0.4, 0.14, color=(0.57, 0.105, 0.14))
    v, f = ellipsoid(np.array((0, 0.175, 0.191)), np.array((0.063, 0.0105, 0.060)), 28, 16, 0.92)
    v[:, 1] -= 0.0022 * np.exp(-((v[:, 0] / 0.006) ** 2)) * ease((v[:, 2] - 0.165) / 0.055)
    put(
        "Tongue | body, groove and tip",
        "Dentition",
        to_world(v),
        f,
        [],
        "head-presentation",
        tongue,
        ctrl.shapes(v, "tongue"),
    )


def build(put, lib, work, rest):
    d = np.load(work / "neutral.npz")
    p, f, uv, g = geometry.isolate(d, [0])
    co = p[f].mean(axis=1)
    # Remove the two bare ears and their attachment stalks underneath the hairstyle.
    # Preserve the actual neutral forehead, sockets, oral aperture, cheeks and mandible.
    keep = (co[:, 1] < 0.625) & ~((co[:, 1] > 0.505) & (abs(co[:, 0]) > 0.188) & (co[:, 2] < 0.05))
    p, f, uv, g = geometry.crop(p, f, uv, g, keep)
    p, f, uv, g = geometry.clip_height(p, f, uv, g, 0.0715, True)
    co = p[f].mean(axis=1)
    region = (co[:, 1] > 0.117) & (co[:, 1] < 0.492) & (co[:, 2] > 0.045) & (abs(co[:, 0]) < 0.244)
    p, f, uv, g = geometry.refine(p, f, uv, g, region)
    ctrl = Controls(p, f)
    sk = lib.make("Golden pelt | face and chin", "neutral", 0.53, 0.31, 0.035, 0.095, 0.73)
    shade = sk.node_tree.nodes.get("Principled BSDF")
    shade.inputs["Subsurface Weight"].default_value = 0.029
    shade.inputs["Subsurface Scale"].default_value = 0.009
    v = to_world(p)
    tint = np.ones((len(p), 4))
    cheeks = np.exp(
        -(((abs(p[:, 0]) - 0.181) / 0.060) ** 2)
        - ((p[:, 1] - 0.240) / 0.061) ** 2
        - ((p[:, 2] - 0.167) / 0.09) ** 2
    )
    tint[:, 1] -= 0.248 * cheeks
    tint[:, 2] -= 0.197 * cheeks
    weights = []
    for raw in p:
        neck_amount = (1 - ease((raw[1] - 0.082) / 0.105)) * (1 - ease((raw[2] + 0.040) / 0.125))
        weights.append({"neck": float(neck_amount), "head-presentation": float(1 - neck_amount)})
    put(
        "Face | neutral orbital and lip loops",
        "Face",
        v,
        f,
        uv,
        weights,
        sk,
        ctrl.shapes(p, "skin"),
        tint=tint,
    )
    lash = lib.make("Carbon velvet | eyelash sculpture", "neutral", 0.47, 0.29, 0.045, 0.035, 0.50)
    brow = lib.make("Espresso | brows", "neutral", 0.55, 0.28, 0.03, 0.105, 0.61)
    nose = lib.make("Soft black | nose leather", "neutral", 0.31, 0.43, 0.18, 0.02, 0.63)
    iris = lib.eye()
    for name, ids, kind, side, mat in [
        ("Upper lashes and margin • R", [1], "upper-lash", -1, lash),
        ("Upper lashes and margin • L", [2], "upper-lash", 1, lash),
        ("Outer lower lashes • L", [3], "lower-lash", 1, lash),
        ("Nose leather and nostrils", [4], "nose", None, nose),
        ("Eye • R", [5], "eye", -1, iris),
        ("Eye • L", [6], "eye", 1, iris),
        ("Brow • R", [7], "brow", -1, brow),
        ("Brow • L", [8], "brow", 1, brow),
    ]:
        raw, faces, tex, labels = geometry.isolate(d, ids)
        if kind == "brow":
            h = abs(raw[:, 0])
            mid = np.interp(
                h,
                [0.037, 0.062, 0.11, 0.16, 0.19, 0.216, 0.234],
                [0.475, 0.479, 0.487, 0.488, 0.481, 0.465, 0.453],
            )
            tip = ease((h - 0.036) / 0.045)
            raw[:, 1] = mid + (raw[:, 1] - mid) * (0.33 + 0.67 * tip) - 0.006 * (1 - tip)
            raw[:, 0] += side * (0.002 - 0.003 * (1 - tip))
        if kind in ("upper-lash", "lower-lash"):
            h = side * raw[:, 0]
            wing = ease((h - 0.177) / 0.102)
            raw[:, 0] -= side * 0.030 * wing
            raw[:, 1] -= 0.008 * wing
        if kind == "eye":
            center = np.array((side * 0.103742, 0.36503, 0.06453))
            raw, faces = ellipsoid(center, np.array((0.0941, 0.0941, 0.0941)), 44, 26)
            local = (raw - center) / 0.0941
            coords = np.column_stack((0.5 + 0.5 * local[:, 0], 0.5 - 0.5 * local[:, 1]))
            tex = coords[faces].copy()
            tex[(local[faces, 2].mean(1) < -0.06)] = [0.012, 0.012]
        keys = ctrl.shapes(raw, kind, side)
        if kind == "eye":
            keys.update(eye_keys(raw, side))
        put(
            name,
            "Eyes" if kind in ("eye", "upper-lash", "lower-lash") else "Face",
            to_world(raw),
            faces,
            tex,
            "head-presentation",
            mat,
            keys,
        )
    from lids import build as build_lids

    build_lids(put, lib, ctrl)
    mouth_interior(put, lib, ctrl, p)
    return v[abs(p[:, 1] - 0.0715) < 1e-7]
