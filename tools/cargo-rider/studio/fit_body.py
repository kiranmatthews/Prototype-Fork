"""Fit the generated garment, continuous shoulders and individual digits to rider-local joints."""

import numpy as np


def ease(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def track(y, rows):
    rows = np.array(rows)
    return np.column_stack([np.interp(y, rows[:, 0], col) for col in rows.T[1:]])


def joint_blend(weights, a, b, t):
    weights[a] = weights.get(a, 0) + 1 - t
    weights[b] = weights.get(b, 0) + t


def fit(points, groups, rest):
    p = points.copy()
    mid = 0.00165
    side = np.where(p[:, 0] < mid, -1.0, 1.0)
    u = np.abs(p[:, 0] - mid)
    y, z = p[:, 1], p[:, 2]
    # The trousers keep their original folds while each knee and sole reaches its game contact.
    b = track(
        y,
        [
            (0, 0.142, 0.215, -0.043, 0.052, 1.53, 1.51, 0.152),
            (0.078, 0.138, 0.215, -0.045, 0.052, 1.58, 1.50, 0.228),
            (0.19, 0.135, 0.191, -0.043, 0.015, 1.35, 1.21, 0.39),
            (0.355, 0.115, 0.159, -0.026, 0, 1.38, 1.30, 0.577),
            (0.53, 0.095, 0.122, -0.017, 0, 1.45, 1.36, 0.806),
            (0.62, 0, 0, -0.020, 0, 1.43, 1.40, 0.908),
            (0.70, 0, 0, -0.021, 0, 1.48, 1.48, 1.018),
            (0.78, 0, 0, -0.002, 0, 1.74, 1.51, 1.16),
            (0.85, 0, 0, -0.026, 0, 1.80, 1.56, 1.30),
            (0.92, 0, 0, -0.047, 0, 1.83, 1.50, 1.422),
            (0.95, 0, 0, -0.048, 0, 1.87, 1.54, 1.49),
            (1, 0, 0, -0.046, 0, 1.91, 1.67, 1.568),
        ],
    )
    # The shoe was sculpted splayed outward; straighten its long axis on the contact strip.
    foot = 1 - ease((y - 0.10) / 0.14)
    shift = (0.031 + 0.182 * z) * foot
    body = np.column_stack(
        (b[:, 1] + (u - b[:, 0] - shift) * b[:, 4], b[:, 6], (z - b[:, 2]) * b[:, 5] + b[:, 3])
    )
    # Anchor the upper arm and forearm in the plane of the native shoulder, elbow and wrist.
    c = track(
        y,
        [
            (0.51, 0.31, -0.012, 0.68, 0.790, 0),
            (0.60, 0.292, -0.014, 0.577, 0.894, 0),
            (0.682, 0.248, -0.022, 0.454, 1.0103, 0),
            (0.735, 0.207, -0.040, 0.403, 1.105, 0),
            (0.802, 0.164, -0.051, 0.3357, 1.2235, 0),
            (0.875, 0.112, -0.053, 0.265, 1.347, 0),
            (0.916, 0.105, -0.049, 0.228, 1.4178, 0),
            (0.947, 0.092, -0.049, 0.191, 1.477, 0),
            (0.965, 0.072, -0.051, 0.142, 1.51, 0),
        ],
    )
    arm = np.column_stack((c[:, 2] + (u - c[:, 0]) * 1.81, c[:, 3], c[:, 4] + (z - c[:, 1]) * 1.78))
    # Classify the arm by continuous source-space axilla, so the front of the tank and
    # the armpit share a smooth deformation field while adjacent fingers keep separate weights.
    edge = np.interp(
        y,
        [0.49, 0.62, 0.71, 0.81, 0.866, 0.89, 0.916, 0.947, 0.967],
        [0.218, 0.196, 0.159, 0.102, 0.086, 0.078, 0.066, 0.052, 0.057],
    )
    arm_mix = ease(
        (u - edge + 0.010)
        / np.interp(y, [0.50, 0.85, 0.89, 0.94, 0.97], [0.022, 0.026, 0.048, 0.068, 0.068])
    )
    arm_mix *= ease((y - 0.48) / 0.032) * (1 - ease((y - 0.943) / 0.032))
    # Each branch is measured in its own section through the hand, including the thumb web.
    tags = ["thumb", "index", "middle", "ring", "outer"]
    source = {
        "thumb": [
            (0.259, 0.646, 0.024),
            (0.247, 0.623, 0.026),
            (0.235, 0.600, 0.033),
            (0.231, 0.569, 0.042),
        ],
        "index": [
            (0.289, 0.603, 0.031),
            (0.300, 0.573, 0.038),
            (0.303, 0.545, 0.042),
            (0.295, 0.522, 0.046),
        ],
        "middle": [
            (0.306, 0.598, 0.001),
            (0.315, 0.566, 0.003),
            (0.318, 0.541, 0.007),
            (0.313, 0.514, 0.013),
        ],
        "ring": [
            (0.308, 0.599, -0.028),
            (0.317, 0.569, -0.030),
            (0.318, 0.544, -0.032),
            (0.310, 0.523, -0.033),
        ],
        "outer": [
            (0.289, 0.598, -0.052),
            (0.295, 0.578, -0.059),
            (0.285, 0.555, -0.060),
            (0.273, 0.542, -0.061),
        ],
    }
    right = lambda n: np.array(rest[n + "-left"]["matrix"][12:15])
    destination = {}
    for tag in tags:
        if tag == "thumb":
            names = ["thumb-metacarpal", "thumb-proximal", "thumb-distal", "socket-thumb"]
        else:
            family = "outer" if tag == "ring" else tag
            names = [f"finger-{family}-{k}" for k in ("proximal", "middle", "distal")] + [
                "socket-finger-" + family
            ]
        verts = np.array([right(k) for k in names])
        if tag == "ring":
            verts = 0.58 * verts + 0.42 * destination["middle"][0]
        destination[tag] = (verts, names)
    q = np.column_stack((u, y, z))
    mapped = []
    distances = []
    finger_weights = []
    for tag in tags:
        src = np.array(source[tag])
        dst, names = destination[tag]
        gaps = []
        projections = []
        locations = []
        for j in range(3):
            a = src[j]
            seg = src[j + 1] - a
            t = np.clip((q - a) @ seg / (seg @ seg), 0, 1)
            local = q - (a + t[:, None] * seg)
            gaps.append(np.sum(local * local, axis=1))
            # Rotate the cross-section onto the direction of the target knuckle.
            v = seg / np.linalg.norm(seg)
            bdir = dst[j + 1] - dst[j]
            d = bdir / np.linalg.norm(bdir)
            cross = np.cross(v, d)
            sin = np.linalg.norm(cross)
            cos = v @ d
            moved = (
                local * cos
                + np.cross(cross, local)
                + np.outer(local @ cross, cross) / max(1e-8, 1 + cos)
            )
            moved += local * (1 - cos) if sin < 1e-8 else 0
            projections.append(dst[j] + t[:, None] * bdir + 1.62 * moved)
            locations.append(j + t)
        gaps = np.array(gaps).T
        closest = np.argmin(gaps, axis=1)
        idx = np.arange(len(q))
        distances.append(gaps[idx, closest])
        mapped.append(np.stack(projections, axis=1)[idx, closest])
        finger_weights.append(np.stack(locations, axis=1)[idx, closest])
    dd = np.array(distances).T
    radial = np.exp(-(dd - dd.min(axis=1, keepdims=True)) / (2 * 0.009**2))
    radial /= radial.sum(axis=1, keepdims=True)
    hand = sum(radial[:, j, None] * v for j, v in enumerate(mapped))
    hand_mix = 1 - ease((y - 0.598) / 0.075)
    arm = arm * (1 - hand_mix[:, None]) + hand * hand_mix[:, None]
    out = body * (1 - arm_mix[:, None]) + arm * arm_mix[:, None]
    out[:, 0] *= side
    weights = []
    for i in range(len(y)):
        h = float(y[i])
        a = float(arm_mix[i])
        s = "left" if side[i] > 0 else "right"
        w = {}

        def put(n, v):
            if v > 1e-7:
                w[n] = w.get(n, 0) + v

        take = 1 - a
        if h < 0.655:
            legs = ease((0.665 - h) / 0.130)
            # Distinct thigh chains meet in the gusset. A skirt-wide midline would bridge both knees.
            for chain, share in [(s, 1.0)]:
                amount = take * legs * share
                knee = ease((h - 0.295) / 0.12)
                toe = ease((z[i] - 0.085) / 0.081) * (1 - ease((h - 0.02) / 0.085))
                ank = 1 - ease((h - 0.048) / 0.100)
                put("toe-" + chain, amount * ank * toe)
                put("ankle-" + chain, amount * ank * (1 - toe))
                put("knee-" + chain, amount * (1 - ank) * (1 - knee))
                put("hip-" + chain, amount * (1 - ank) * knee)
            put("hips", take * (1 - legs))
        else:
            chest = ease((h - 0.733) / 0.104)
            spine = ease((h - 0.650) / 0.098)
            neck = ease((h - 0.938) / 0.029)
            clav = ease((u[i] - 0.042) / 0.085) * ease((h - 0.854) / 0.07) * (1 - neck) * 0.75
            put("hips", take * (1 - spine))
            put("spine", take * spine * (1 - chest))
            put("chest", take * spine * chest * (1 - neck - clav))
            put("clavicle-" + s, take * spine * chest * clav)
            put("neck", take * spine * chest * neck)
        if a > 0:
            wrist = ease((0.714 - h) / 0.059)
            upper = ease((h - 0.763) / 0.078)
            collar = ease((h - 0.907) / 0.053) * 0.54
            put("clavicle-" + s, a * upper * collar)
            put("shoulder-" + s, a * upper * (1 - collar))
            put("elbow-" + s, a * (1 - upper) * (1 - wrist))
            digits = 1 - ease((h - 0.595) / 0.052)
            # Thumb begins higher than the four finger roots.
            for j, tag in enumerate(tags):
                factor = a * wrist * radial[i, j]
                dig = 1 - ease((h - 0.623) / 0.038) if tag == "thumb" else digits
                put("hand-rest-orientation-" + s, factor * (1 - dig))
                t = finger_weights[j][i]
                j0 = min(2, int(t))
                j1 = min(2, j0 + 1)
                t = ease((t - j0 - 0.49) / 0.84)
                names = destination[tag][1]
                put(names[j0] + "-" + s, factor * dig * (1 - t))
                put(names[j1] + "-" + s, factor * dig * t)
        ws = sorted(w.items(), key=lambda pair: -pair[1])[:4]
        total = sum(v for _, v in ws)
        weights.append({k: float(v / total) for k, v in ws})
    return out, weights
