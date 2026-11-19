"""Continue the ribcage quad surface through the deltoid, elbow and wrist."""

import math
import numpy as np
from surface import J, arm_weights, atrow, bn, grid, parts, side, smooth


def build_arm(tank, sign):
    # Excise a rectangular loop on the outer ribcage. The first arm ring shares
    # the actual tank vertices, UV seams notwithstanding, including skin weights.
    cols = tank['nu']
    mid = cols // 4 if sign > 0 else 3 * cols // 4
    j0, jm, j1, half = 7, 12, 17, 6
    ring = (
        [(-half, j) for j in range(jm, j0, -1)]
        + [(i, j0) for i in range(-half, half)]
        + [(half, j) for j in range(j0, j1)]
        + [(i, j1) for i in range(half, -half, -1)]
        + [(-half, j) for j in range(j1, jm, -1)]
    )
    count = len(ring)
    indices = [j * (cols + 1) + mid + sign * i for i, j in ring]
    angles = [math.atan2((jm - j) / (jm - j0), -i / half) for i, j in ring]
    tank['faces'] = [
        face
        for face in tank['faces']
        if not (j0 <= min(face) // (cols + 1) < j1 and mid - half <= min(face) % (cols + 1) < mid + half)
    ]
    shoulder, elbow, wrist = [J[bn(name, sign)] for name in ('shoulder', 'elbow', 'wrist')]

    def along(a, b, f):
        return a * (1 - f) + b * f

    # Path, normal in the frontal plane, lateral and sagittal radii. The humeral
    # head rolls out from the shoulder shelf; the forearm narrows at the carpus.
    guides = [
        (0, shoulder + [-sign * 0.064, 0.002, 0], 0.035, 0.060, 0.12),
        (0.09, shoulder + [-sign * 0.039, 0.005, 0], 0.048, 0.070, 0.30),
        (0.17, shoulder + [-sign * 0.013, 0.001, 0.001], 0.056, 0.074, 0.59),
        (0.24, along(shoulder, elbow, 0.095), 0.060, 0.072, 0.79),
        (0.32, along(shoulder, elbow, 0.24), 0.060, 0.064, 0.88),
        (0.43, along(shoulder, elbow, 0.52), 0.054, 0.059, 0.89),
        (0.55, along(shoulder, elbow, 0.84), 0.043, 0.047, 0.89),
        (0.61, elbow, 0.040, 0.044, 0.89),
        (0.68, along(elbow, wrist, 0.19), 0.047, 0.054, 0.88),
        (0.76, along(elbow, wrist, 0.40), 0.049, 0.054, 0.88),
        (0.87, along(elbow, wrist, 0.69), 0.041, 0.045, 0.88),
        (1, along(elbow, wrist, 1.04), 0.031, 0.035, 0.88),
    ]
    profile = [[t, *p, radius, depth, nx] for t, p, radius, depth, nx in guides]
    axial = 38
    sections = [atrow(profile, j / axial) for j in range(axial + 1)]

    def arm_section(i, j):
        t = j / axial
        ca, sa = math.cos(angles[i]), math.sin(angles[i])
        x, y, z, r, depth, nx = sections[j]
        ny = math.sqrt(1 - nx * nx)
        # Brachialis and forearm extensor masses sit on opposite diagonals.
        volume = 1 + 0.065 * math.sin(2 * angles[i] - 0.7) * math.sin(math.pi * t) ** 2
        return np.array([x + sign * nx * r * sa, y + ny * r * sa, z + depth * ca * volume])

    # Carry the tangent across the sewn sleeve opening. Passing through an
    # interior shoulder guide folds the first two quad rings back over the tank.
    socket = tank['points'][indices]
    tangents = []
    for k, (i, j) in enumerate(ring):
        neighbours = []
        for di, dj, on_edge in [(-1, 0, i == -half), (1, 0, i == half), (0, -1, j == j0), (0, 1, j == j1)]:
            if on_edge:
                neighbours.append(tank['points'][(j + dj) * (cols + 1) + mid + sign * (i + di)])
        direction = socket[k] - np.mean(neighbours, axis=0)
        tangents.append(direction / np.linalg.norm(direction))
    start_direction = (
        np.roll(tangents, 1, axis=0) + 2 * np.array(tangents) + np.roll(tangents, -1, axis=0)
    ) * 0.25
    start_direction /= np.linalg.norm(start_direction, axis=1, keepdims=True)
    section = 8
    settled = np.array([arm_section(i, section) for i in range(count)])
    chord = settled - socket
    incoming = 0.23 * start_direction * np.linalg.norm(chord, axis=1, keepdims=True) + 0.67 * chord
    outgoing = (
        3 * np.array([arm_section(i, section + 1) - arm_section(i, section - 1) for i in range(count)])
        + 0.25 * chord
    )

    def geom(u, t):
        i = round(u * count) % count
        j = round(t * axial)
        if j >= section:
            return arm_section(i, j)
        f = j / section
        return (
            socket[i] * (2 * f**3 - 3 * f * f + 1)
            + settled[i] * (3 * f * f - 2 * f**3)
            + incoming[i] * (f**3 - 2 * f * f + f)
            + outgoing[i] * (f**3 - f * f)
        )

    def weights(p, u, t):
        i = round(u * count) % count
        if t < 0.36:
            # Keep the axillary fold anchored. The deltoid insertion follows the humerus.
            root = tank['weights'][indices[i]]
            reach = float(smooth(t / (0.33 - 0.035 * math.sin(angles[i]))))
            w = {k: v * (1 - reach) for k, v in root.items()}
            joint = bn('shoulder', sign)
            w[joint] = w.get(joint, 0) + reach
            return w
        v = float(np.interp(t, [0.36, 0.61, 1], [362, 425, 520]))
        return arm_weights(v, sign)

    def pigment(p, u, t):
        i = round(u * count) % count
        cos = math.cos(angles[i])
        v = np.interp(t, [0, 0.2, 0.61, 1], [328, 336, 425, 516])
        cx = np.interp(v, [328, 336, 425, 516], [55, 64, 114, 171])
        return [sign * (cx + 10 * math.sin(angles[i])), v, cos, cos * 15]

    grid(
        'Arm ' + side(sign),
        count,
        axial,
        geom,
        lambda p: p,
        weights,
        'arm',
        group='Body',
        cyclic=True,
        reverse=sign < 0,
        project=pigment,
        uvsize=(190, 332),
    )
    parts[-1]['joins'] = {i: (tank['name'], idx) for i, idx in enumerate(indices)}
