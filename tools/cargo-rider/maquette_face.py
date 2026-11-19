"""Fit the articulated portrait surfaces to the muzzle, temples and jaw of the maquette."""

import numpy as np
from maquette import SCALE, coordinates
from surface import smooth


def fit_portrait(islands):
    original = {p['name']: p['points'].copy() for p in islands if p['group'] in ('Face', 'Eyes')}
    for part in islands:
        if part['group'] not in ('Face', 'Eyes', 'Dentition'):
            continue
        points = part['points']
        x, row, d = coordinates(points).T
        ax = abs(x)
        front = smooth((d + 9) / 102)
        upper = np.exp(-(((row - 391) / 94) ** 4))
        # Move both lids, the lens and the surrounding socket through the same field.
        dy = front * (12.0 * upper + 10.3 * np.exp(-(((row - 458) / 45) ** 2)))
        dy += 5.6 * smooth(x / 84) * upper * front
        depth = front * np.interp(
            row,
            [268, 325, 388, 422, 444, 460, 476, 487, 503, 516, 536],
            [0, -2, -5, -5, -16, -19, -10, 1, 8, 11, 2],
        )
        back = 1 - smooth((d + 5) / 75)
        dy -= back * (6 + 43 * smooth((row - 393) / 145))
        dx = -x * back * (0.095 + 0.27 * smooth((row - 354) / 151))
        depth += back * np.maximum(0, -d) * (0.34 + 0.12 * smooth((row - 411) / 92))
        socket = front * np.exp(-(((row - 391) / 75) ** 4)) * smooth((x - 5) / 32)
        dx -= 12.0 * socket * np.exp(-(((x - 47) / 39) ** 2))
        dy += 4.6 * socket
        name = part['name']
        # Sink the covered occiput under the rear hair shell at its upper pole.
        depth += back * (44 * np.exp(-(((row - 228) / 41) ** 2)))
        if name.startswith('Tapered eyebrow'):
            dy += 10 + 10 * smooth((ax - 71) / 40)
        if name == 'Nose leather':
            dy -= 3.5
            dx -= x * 0.14
            depth -= 6
        part['points'] = points + np.stack([dx, -dy, depth], axis=-1) * SCALE

    from muzzle_profile import fair_cheeks, rebuild_jaw

    rebuild_jaw(islands)
    fair_cheeks(islands)
    # All oral islands follow the actual split in the fitted skin. The teeth lie
    # behind these curves, including where the neutral whisker pads turn inwards.
    by_name = {p['name']: p for p in islands}
    hi, lo = [by_name[n] for n in ('Cranium, muzzle and cheeks', 'Chin and lower lip')]
    count = hi['nu']
    indexes = np.array([i % count for i in range(-count // 4, count // 4 + 1)])
    rims = [hi['points'][hi['nv'] * (count + 1) + indexes], lo['points'][indexes]]
    # The lateral jaw turns back under the cheek. Interpolation applies only on
    # the monotone front arc, before either UV edge turns toward the neck.
    rims = [r[np.argmin(r[:, 0]) : np.argmax(r[:, 0]) + 1] for r in rims]
    assert all(np.all(np.diff(r[:, 0]) > 0) for r in rims)
    for label in ('Upper lip roll', 'Lower lip roll', 'Inner mouth', 'Tongue'):
        p = by_name[label]
        pts = p['points'].reshape(p['nv'] + 1, p['nu'] + 1, 3)
        is_roll = 'lip roll' in label
        center = pts.mean(axis=0) if is_roll else pts[0]
        x = center[:, 0]
        rim = rims[0 if label != 'Lower lip roll' else 1]
        level = np.interp(x, rim[:, 0], rim[:, 1])
        depth = np.interp(x, rim[:, 0], rim[:, 2])
        fade = np.sqrt(np.maximum(0, 1 - (np.clip(x / 0.103, -1, 1)) ** 2))
        if is_roll:
            pts[:, :, 1] += level - center[:, 1] + (0.0012 if label == 'Upper lip roll' else -0.0014) * fade
            pts[:, :, 2] += depth - center[:, 2] + 0.0007 * fade
            if label == 'Lower lip roll':
                plush = np.exp(-((x / 0.036) ** 4))
                pts[:, :, 1] -= 0.0005 * plush
                pts[:, :, 2] += 0.0014 * plush
        else:
            for j, t in enumerate(np.linspace(0, 1, p['nv'] + 1)):
                x = pts[j, :, 0]
                pts[j, :, 1] = np.interp(x, rim[:, 0], rim[:, 1]) - 0.0008 * t
                pts[j, :, 2] = np.interp(x, rim[:, 0], rim[:, 2]) - (0.012 if label == 'Tongue' else 0.0017)

    # Preserve the inflated cheek volumes and the closed commissures of the
    # acting sculpts. A neutral jaw relocation should not be added twice to an
    # extreme pose whose teeth and mouth were already independently fitted.
    from performance import study_coordinates

    for p in islands:
        name = p['name']
        if name not in original or not (
            p.get('skin_sheet')
            or name in ('Upper lip roll', 'Lower lip roll', 'Inner mouth', 'Tongue', 'Nose leather')
        ):
            continue
        old = original[name]
        x, v, d = study_coordinates(old).T
        region = smooth((v - 550) / 66) * smooth((d + 32) / 119)
        if p.get('socket_boundary'):
            region *= 1 - smooth(np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1))
        diff = (old - p['points']) * region[:, None]
        for action, amount in {
            'puffer': 1.0,
            'splat': 0.73,
            'snarl': 0.56,
            'cackle': 0.37,
            'yikes': 0.39,
            'howl': 0.38,
            'dazed': 0.32,
            'gasp': 0.25,
            'raspberry': 0.25,
        }.items():
            if 'Pose.' + action not in p['keys']:
                continue
            change = amount * diff
            if np.max(abs(change)) < 1e-8:
                continue
            p['keys']['MaskFit.' + action] = p['keys'].get('MaskFit.' + action, 0) + change
            p['keys']['Pose.' + action] += change
    # Fit both dental rows to the new lip plane, including their animated extremes.
    from facial_surface import fit_dentition
    from performance import PRESETS

    fit_dentition(islands, PRESETS)
    for part in (p for p in islands if 'tooth' in p):
        keys = part['keys']
        for n, pose in PRESETS.items():
            delta = sum((keys[k] * v for k, v in pose.items() if k in keys), np.zeros_like(part['points']))
            delta += keys.get('MaskFit.' + n, 0)
            if np.max(abs(delta)) > 1e-8:
                keys['Pose.' + n] = delta
