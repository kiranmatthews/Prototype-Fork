"""Art-directed facial controls in the coordinate system of the original face study."""

import json
import math
import numpy as np
from facial_surface import (
    blink_line,
    cheek_inflation,
    fair_inflation,
    fit_comic_muzzles,
    fit_dentition,
    register_mouth,
)
from surface import ROOT, grid, head_fit, head_scale, head_z, parts, pi, smooth

PRESETS = json.loads((ROOT / 'src/character/cargoRiderExpressions.json').read_text())


def study_coordinates(p):
    return np.column_stack(
        [p[:, 0] / head_scale, 766 - (p[:, 1] - 1.542) / head_scale, (p[:, 2] - head_z) / head_scale]
    )


def fitted_delta(delta):
    return delta * [head_scale, -head_scale, head_scale]


def eye_widen(x, v, z):
    # The alert eye is an oval, with the outer and inner canthi on a shallow
    # diagonal. Stretching the original pointed eye vertically makes its corners spike.
    ax = np.abs(x)
    u = np.clip((ax - 50) / 128, 0, 1)
    a = np.interp(u, [0, 0.1, 0.22, 0.4, 0.6, 0.8, 0.95, 1], [591, 566, 544, 527, 520, 519, 523, 530])
    b = np.interp(u, [0, 0.1, 0.25, 0.45, 0.65, 0.8, 0.95, 1], [591, 600, 605, 606, 602, 592, 566, 530])
    f = np.clip((v - a) / np.maximum(1, b - a), 0, 1)
    mid = 554 - 19 * u
    h = 77 * np.sqrt(np.maximum(0, 1 - (2 * u - 1) ** 2))
    fade = np.clip(1 - (ax - 178) / 70, 0, 1)
    return np.stack(
        [
            np.sign(x) * 0.10 * (ax - 113) * fade,
            ((1 - f) * (mid - h - a) + f * (mid + h - b)) * fade,
            (5 + 9 * np.sin(pi * u)) * fade,
        ],
        axis=-1,
    )


def orbital_skin(sign, skull, aperture, cornea, face_depth):
    # A continuous annulus spans the actual hole in the head to the lash edge.
    # The outer edge is literally the cranium's patch boundary; lids don't float
    # above a second copy of the face or expose the back of a shell in profile.
    cols = skull['nu']
    a, b = max(1, round(cols / 80)), round(15 * cols / 80)
    top, mid, low = 16, 28, 41
    loop = (
        [(a, j) for j in range(mid, top, -1)]
        + [(i, top) for i in range(a, b)]
        + [(b, j) for j in range(top, low)]
        + [(i, low) for i in range(b, a, -1)]
        + [(a, j) for j in range(low, mid, -1)]
    )

    def col(i):
        return i if sign > 0 else cols - i

    first = a if sign > 0 else cols - b
    skull['faces'] = [
        face
        for face in skull['faces']
        if not (top <= min(face) // (cols + 1) < low and first <= min(face) % (cols + 1) < first + b - a)
    ]
    outer = study_coordinates(skull['points'][[j * (cols + 1) + col(i) for i, j in loop]])
    count = len(loop)
    indices = [j * (cols + 1) + col(i) for i, j in loop]
    suffix = '.L' if sign > 0 else '.R'

    def edge(i, j):
        theta = math.atan2((mid - j) / (mid - top if j <= mid else low - mid), (a + b - 2 * i) / (b - a))
        u = (1 - math.cos(theta)) * 0.5
        x = sign * (50 + 128 * u)
        upper, lower = aperture(x)
        v = upper if j < mid else lower
        return x, v, cornea(x, v) + 6.3, blink_line(x, upper, lower)

    rim = np.array([edge(i, j) for i, j in loop])

    def surf(u, t):
        i = round(u * count) % count
        a, b = outer[i], rim[i, :3]
        x, v, z = a * (1 - t) + b * t
        # A Hermite section meets the cheek and cornea tangentially on each
        # side. Above the upper lash it rolls into an oblique palpebral crease.
        dx, dv = b[0] - a[0], b[1] - a[1]
        dz = b[2] - a[2]
        shoulder = (face_depth(a[0] + 0.025 * dx, a[1] + 0.025 * dv) - face_depth(a[0], a[1])) / 0.025
        margin = (cornea(b[0], b[1]) - cornea(b[0] - 0.025 * dx, b[1] - 0.025 * dv)) / 0.025
        span = math.hypot(dx, dv)
        shoulder = float(np.clip(shoulder, -span * 0.91, span * 0.91))
        margin = float(np.clip(margin, -span * 0.90, span * 0.90))
        depth = a[2] + (3 * t * t - 2 * t**3) * dz + (t**3 - 2 * t * t + t) * shoulder + (t**3 - t * t) * margin
        across = math.sin(pi * float(np.clip((abs(b[0]) - 50) / 128, 0, 1))) ** 0.70
        distance = abs(v - b[1])
        upper = loop[i][1] < mid
        roll = (
            (13.2 * math.exp(-(((distance - 13) / 12) ** 2)) - 5.3 * math.exp(-(((distance - 29) / 6.8) ** 2)))
            if upper
            else 2.5 * math.exp(-(((distance - 9) / 10) ** 2))
        )
        depth += across * roll * smooth(t / 0.19) * smooth((1 - t) / 0.075)
        return [x, v, depth]

    def posed(p, u, t, amount, wide=False):
        i = round(u * count) % count
        x, v, z, end = rim[i]
        if wide:
            d = eye_widen(x, v, z) * amount
        else:
            level = v + (end - v) * amount
            d = np.array([0.0, level - v, cornea(x, level) - cornea(x, v)])
        return p + d * t**1.26

    grid(
        'Orbital skin' + suffix,
        count,
        13,
        surf,
        head_fit,
        'head-presentation',
        'lid',
        group='Face',
        cyclic=True,
        uvsize=(244, 100),
        project=lambda p, u, t: [p[0], p[1], math.sqrt(max(0.001, 1 - (p[0] / 223) ** 2)), p[2]],
        reverse=sign < 0,
        keys={
            'Blink' + suffix: lambda p, u, t: posed(p, u, t, 1),
            'Squint' + suffix: lambda p, u, t: posed(p, u, t, 0.54),
            'EyeWide' + suffix: lambda p, u, t: posed(p, u, t, 1, True),
        },
    )
    # Preserve exact equality at the outer ring even across separate glTF
    # morph dictionaries. Lids share the underlying face deformation at t=0.
    parts[-1]['socket_boundary'] = (skull['name'], indices)


def sculpt_iris(sign, aperture, cornea):
    suffix = '.L' if sign > 0 else '.R'
    wide, blink, squint = [n + suffix for n in ('EyeWide', 'Blink', 'Squint')]
    names = [
        wide,
        blink,
        squint,
        'IrisPin',
        'LookLeft',
        'LookRight',
        'LookUp',
        'LookDown',
        'CrossEyes',
        'WallEyes',
    ]

    def iris_uv(u, t):
        return math.cos(2 * pi * u) * t, math.sin(2 * pi * u) * t

    def evaluate(u, t, controls):
        def k(name):
            return controls.get(name, 0)

        dx, dy = iris_uv(u, t)
        scale = 1 - 0.72 * k('IrisPin')
        dxlook = sign * 26 * (k('LookLeft') - k('LookRight')) - 26 * k('CrossEyes') + 15 * k('WallEyes')
        dylook = 18 * (k('LookDown') - k('LookUp')) + sign * 26 * k('WallEyes')
        x = sign * np.clip((96 if sign > 0 else 106) + dxlook + 34 * scale * dx, 50.1, 177.9)
        a, b = aperture(x)
        v = (563 if sign > 0 else 554) + dylook + 43.5 * scale * dy
        w = k(wide)
        da = eye_widen(x, a, 0)
        db = eye_widen(x, b, 0)
        # Set the iris in the *expanded* opening. Its radius is independent of
        # the globe. Crop its geometry at the moving lids, including a full seal.
        top, bottom = a + w * da[1], b + w * db[1]
        shut = min(1, k(blink) + 0.54 * k(squint))
        meet = blink_line(x, top, bottom)
        top += (meet - top) * shut
        bottom += (meet - bottom) * shut
        v = np.clip(v - 12 * w, top, max(top, bottom))
        dxwide = w * eye_widen(x, v, 0)
        # Same cut surface as the white shell, offset only by the lens thickness.
        unwidened = a + (b - a) * (v - (a + w * da[1])) / max(0.01, (b - a) + w * (db[1] - da[1]))
        z = cornea(x, unwidened) + dxwide[2] + 4.7 + 2.5 * (1 - t * t) - 6.1 * shut
        return np.array([x + dxwide[0], v, z])

    grid(
        'Violet iris' + suffix,
        36,
        9,
        lambda u, t: evaluate(u, t, {}),
        head_fit,
        'head-presentation',
        'iris',
        material='Cornea',
        group='Eyes',
        uvsize=(211, 91),
        cyclic=True,
        reverse=sign > 0,
        project=lambda p, u, t: [*iris_uv(u, t), 0, 0],
    )
    island = parts[-1]
    uv = [
        (i / island['nu'], j / island['nv']) for j in range(island['nv'] + 1) for i in range(island['nu'] + 1)
    ]

    def target(controls):
        xyz = np.array([head_fit(evaluate(u, t, controls)) for u, t in uv])
        return xyz - island['points']

    for name in names:
        island['keys'][name] = target({name: 1})
    # Independent gaze, pinning and blinks interact at the lid boundary. Store the
    # residual only on the lenses so each performance pose has exact occlusion.
    for name, pose in PRESETS.items():
        use = {k: v for k, v in pose.items() if k in names}
        if len(use) < 2:
            continue
        corrected = target(use) - sum(island['keys'][k] * v for k, v in use.items())
        if np.max(np.abs(corrected)) > 0.00003:
            island['keys']['IrisFit.' + name] = corrected


def detail_controls():
    for p in parts:
        name, group = p['name'], p['group']
        if group not in ('Face', 'Eyes', 'Ears and hair', 'Dentition'):
            continue
        q = study_coordinates(p['points'])
        x, v, d = q.T
        ax = np.abs(x)

        def add(key, dx=0, dy=0, dz=0):
            a = np.column_stack(np.broadcast_arrays(dx + np.zeros_like(x), dy, dz))
            if np.max(np.abs(a)) > 0.16:
                p['keys'][key] = fitted_delta(a)

        if name.startswith('Sculpted ear'):
            sign = 1 if name.endswith('.L') else -1
            suffix = name[-2:]
            tip = 1 - np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)
            add('EarStretch' + suffix, sign * 4.5 * smooth(tip), -44 * smooth(tip), 4 * smooth(tip))
            for control, degrees, depth in [('EarFold', 31, -57), ('EarPerk', -11, 26)]:
                angle = np.radians(degrees) * sign * smooth(tip)
                local_x, local_y = x - sign * 146, v - 455
                add(
                    control + suffix,
                    (np.cos(angle) - 1) * local_x - np.sin(angle) * local_y,
                    np.sin(angle) * local_x + (np.cos(angle) - 1) * local_y,
                    depth * tip**1.5,
                )
        # The squash is confined to the face mask and fades through the temples
        # where the head meets the hair. Ears and tied ponytails keep their anchors.
        if group in ('Face', 'Eyes', 'Dentition'):
            lower = smooth((v - 375) / 290)
            add('FaceSquash', 0.24 * x * lower, -(v - 470) * 0.30 * lower, 14 * lower)
            add('FaceStretch', -0.125 * x * lower, (v - 480) * 0.15 * lower, -3 * lower)
        if group in ('Eyes', 'Face') and (group == 'Eyes' or name.startswith('Orbital skin')):
            joy = np.clip(1 - ((ax - 113) / 67) ** 2, 0, 1)
            if name.startswith('Orbital skin'):
                joy *= np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)
            add('EyeJoy', 0, -29 * joy, 2 * joy)
        if group == 'Eyes':
            if not name.startswith('Violet iris'):
                suffix = name[-2:]
                p['keys']['EyeWide' + suffix] = fitted_delta(eye_widen(x, v, d))
            continue
        orbital = name.startswith('Orbital skin')
        if group != 'Face':
            continue
        if name.startswith('Tapered eyebrow'):
            # Keep brows clear of the expanded lash line, including surprise at full aperture.
            add('EyeWide' + name[-2:], 0, -18 * np.exp(-(((ax - 100) / 86) ** 2)), 6)
            continue
        is_mouth = name in (
            'Inner mouth',
            'Tongue',
            'Upper lip roll',
            'Lower lip roll',
        )
        lower_lip = name == 'Chin and lower lip'
        jaw = name in ('Cranium, muzzle and cheeks', 'Chin and lower lip') or is_mouth or orbital
        front = smooth((d - 63) / 84)
        muzzle = front * np.exp(-(((v - 702) / 82) ** 2)) * np.exp(-((ax / 147) ** 4))
        orbit_fade = (1 - np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)) if orbital else 1
        muzzle *= orbit_fade
        cheek = orbit_fade * np.exp(-(((ax - 151) / 77) ** 2) - ((v - 665) / 72) ** 2) * smooth((d + 10) / 105)
        nose = orbit_fade * np.exp(-((x / 79) ** 2) - ((v - 645) / 56) ** 2) * front
        add('NoseScrunch', -0.057 * x * nose, -25 * nose, 15 * nose)
        for sg, suffix in [(1, '.L'), (-1, '.R')]:
            sided = smooth((sg * x + 5) / 36)
            h = cheek * sided
            if name in ('Cranium, muzzle and cheeks', 'Chin and lower lip') or orbital:
                expansion = cheek_inflation(q, sg) * np.asarray(orbit_fade)[..., None]
                p['keys']['CheekPuff' + suffix] = fitted_delta(expansion)
            else:
                add('CheekPuff' + suffix, sg * 8 * h, 3 * h, 9 * h)
            if jaw:
                corner = np.exp(-(((ax - 104) / 57) ** 2) - ((v - 682) / 58) ** 2) * front * sided
                add('Frown' + suffix, -sg * 11 * corner, 43 * corner, 6 * corner)
                sneer = np.exp(-(((ax - 69) / 57) ** 2) - ((v - 687) / 60) ** 2) * front * sided
                if is_mouth:
                    row = np.repeat(np.arange(p['nv'] + 1) / p['nv'], p['nu'] + 1)
                    fall = {
                        'Tongue': 0,
                        'Inner mouth': 1 - row,
                        'Upper lip roll': 1,
                        'Lower lip roll': 0,
                    }[name]
                else:
                    fall = 0.05 if lower_lip else 1
                add('LipRaise' + suffix, sg * 7 * sneer, -44 * sneer * fall, 10 * sneer * fall)
                add('JawSide' + suffix, sg * 33 * muzzle * (1 if lower_lip or is_mouth else 0.55), 0, 0)
        if name.startswith(('Nose leather', 'Nostril')):
            add('Pucker', 0, 0, 8)
            add('Funnel', 0, 0, 4)
        if jaw:
            lipline = 711 - 46 * np.minimum(ax / 109, 1.1) ** 2.15 + 3 * np.sin(np.minimum(ax / 109, 1) * pi)
            region = front * np.exp(-(((v - lipline) / 41) ** 2)) * (1 - smooth((ax - 118) / 84)) * orbit_fade
            if lower_lip:
                region *= (1 - 0.94 * np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)) ** 1.5
            if not np.any(region):
                continue
            r2 = np.minimum(ax / 116, 1) ** 2
            add('Funnel', -0.58 * np.clip(x, -118, 118) * region, (78 * r2 - 10) * region, 11 * region)
            add('Pucker', -0.36 * np.clip(x, -118, 118) * region, (39 * r2 + 2) * region, 22 * region)
        if name == 'Tongue':
            row = np.repeat(np.arange(p['nv'] + 1) / p['nv'], p['nu'] + 1)
            col = np.tile(np.linspace(0, 1, p['nu'] + 1), p['nv'] + 1)
            dome = np.cos(2 * pi * col) * np.sin(pi * row)
            add('TongueOut', 0.10 * x * row, 83 * row**1.65 - 8 * dome, 14 + 92 * np.sin(row * 1.48) + 7 * dome)
            add('TongueCurl', 39 * row**1.7, -12 * np.sin(pi * row) + 8 * row, 14 * row**2)

    register_mouth(parts)
    cranium = next(part for part in parts if part['name'] == 'Cranium, muzzle and cheeks')
    for island in [part for part in parts if 'socket_boundary' in part]:
        indices = island['socket_boundary'][1]
        indices = np.asarray(indices + [indices[0]])
        n = len(indices)
        island['points'][:n] = cranium['points'][indices]
        for key, delta in cranium['keys'].items():
            if key not in island['keys'] and np.max(np.abs(delta[indices])) > 1e-8:
                island['keys'][key] = np.zeros_like(island['points'])
            if key in island['keys']:
                island['keys'][key][:n] = delta[indices]

    for island in parts:
        if island['group'] not in ('Face', 'Eyes', 'Dentition'):
            continue
        for pose_name, pose in PRESETS.items():
            squash, stretch = pose.get('FaceSquash', 0), pose.get('FaceStretch', 0)
            if not (squash or stretch):
                continue
            base = island['points']
            keys = island['keys']
            delta = np.zeros_like(base)
            for key, value in pose.items():
                if key in keys and key not in ('FaceSquash', 'FaceStretch'):
                    delta += keys[key] * value
            if 'IrisFit.' + pose_name in keys:
                delta += keys['IrisFit.' + pose_name]
            x, v, d = study_coordinates(base + delta).T
            lower = smooth((v - 375) / 290)
            combined = fitted_delta(
                np.column_stack(
                    [
                        (0.24 * squash - 0.125 * stretch) * x * lower,
                        (-(v - 470) * 0.30 * squash + (v - 480) * 0.15 * stretch) * lower,
                        (14 * squash - 3 * stretch) * lower,
                    ]
                )
            )
            corr = combined - squash * keys.get('FaceSquash', 0) - stretch * keys.get('FaceStretch', 0)
            if np.max(np.abs(corr)) > 0.00006:
                keys['MaskFit.' + pose_name] = corr

    # A sealed, inflated muzzle has a small circular aperture between the cheek
    # pads. Set its two lip contours, gums and surrounding quad rings explicitly.
    inner = next(p for p in parts if p['name'] == 'Inner mouth')
    lip_points = study_coordinates(inner['points'][: inner['nu'] + 1])
    for island in parts:
        name = island['name']
        mouth_parts = (
            'Inner mouth',
            'Upper lip roll',
            'Lower lip roll',
            'Tongue',
        )
        if name not in ('Cranium, muzzle and cheeks', 'Chin and lower lip', *mouth_parts):
            continue
        base = island['points']
        x, v, d = study_coordinates(base).T
        ax = np.abs(x)
        line = 711 - 46 * np.minimum(ax / 109, 1.1) ** 2.15 + 3 * np.sin(np.minimum(ax / 109, 1) * pi)
        depth = np.interp(x, lip_points[:, 0], lip_points[:, 2])
        opening = np.maximum(0, 1 - (x / 116) ** 2) ** 0.58
        upper = name in ('Cranium, muzzle and cheeks', 'Upper lip roll')
        vertical = -6 * opening if upper else 8 * opening
        rows = np.repeat(np.linspace(0, 1, island['nv'] + 1), island['nu'] + 1)
        if name in ('Tongue', 'Inner mouth'):
            vertical = (rows * 14 - 6) * opening
        residuals = island['keys']
        posed = sum(residuals[k] * w for k, w in PRESETS['puffer'].items() if k in residuals)
        posed += residuals.get('MaskFit.puffer', 0)
        current = study_coordinates(base + posed)
        # Extend the contour displacement across each cheek ring with a smooth
        # falloff. The chin and the side of the jaw keep their supporting volume.
        if name in mouth_parts:
            mask = np.ones_like(x)
        else:
            u = np.tile(np.linspace(0, 1, island['nu'] + 1), island['nv'] + 1)
            mask = (
                np.exp(-(((v - line) / 36) ** 2))
                * smooth((np.cos(2 * pi * u) - 0.20) / 0.42)
                * (1 - smooth((ax - 117) / 66))
            )
            if name == 'Chin and lower lip':
                mask *= (1 - rows) ** 1.45
        targetx = x * 0.085 if name in mouth_parts else x - np.clip(x, -116, 116) * 0.915
        targetv = v + (704 - line) + vertical
        targetd = 292 + 6 * opening + (d - depth)
        if name == 'Tongue':
            targetd -= 43
        if name == 'Inner mouth':
            targetd -= 8 + 9 * np.sin(pi * rows)
        correction = fitted_delta((np.column_stack([targetx, targetv, targetd]) - current) * mask[:, None])
        residuals['MaskFit.puffer'] = residuals.get('MaskFit.puffer', 0) + correction
    fit_comic_muzzles(parts, PRESETS, study_coordinates, fitted_delta)
    fair_inflation(parts, PRESETS['puffer'], study_coordinates, fitted_delta)
    # Keep the boundary of the orbital surround attached for *every* corrective.
    # Interpolate the boundary correction across the orbit to the fixed lash rim.
    for island in [part for part in parts if 'socket_boundary' in part]:
        corners = island['socket_boundary'][1]
        corners = np.array(corners + [corners[0]])
        n = len(corners)
        fade = (1 - smooth(np.linspace(0, 1, island['nv'] + 1)))[:, None, None]
        for k, delta in cranium['keys'].items():
            key = island['keys'].get(k)
            if key is None and np.max(np.abs(delta[corners])) < 1e-8:
                continue
            if key is None:
                key = island['keys'][k] = np.zeros_like(island['points'])
            difference = delta[corners] - key[:n]
            key += (fade * difference[None, :, :]).reshape(-1, 3)
    # All four skin charts belong to one welded mesh and one smoothing surface.
    skin = [
        p
        for p in parts
        if p['name'] in ('Cranium, muzzle and cheeks', 'Chin and lower lip') or 'socket_boundary' in p
    ]
    for p in skin:
        p['skin_sheet'] = True
        p['mat'] = 'Facial fur'
        if 'socket_boundary' in p:
            parent, loop = p['socket_boundary']
            p['joins'] = {i: (parent, j) for i, j in enumerate(loop)}
    fit_dentition(parts, PRESETS)
    # GPU morph normals are linear. A complete pose target gives each combined
    # performance its actual deformed normals, particularly across inflated cheeks.
    # Artists can still key or modify every component and its corrective in Blender.
    for island in parts:
        if island['group'] not in ('Face', 'Eyes', 'Ears and hair', 'Dentition'):
            continue
        keys = island['keys']
        for name, pose in PRESETS.items():
            delta = np.zeros_like(island['points'])
            for k, weight in pose.items():
                if k in keys:
                    delta += keys[k] * weight
            delta += keys.get('MaskFit.' + name, 0)
            delta += keys.get('IrisFit.' + name, 0)
            if np.max(np.abs(delta)) > 1e-8:
                keys['Pose.' + name] = delta
