import math
import numpy as np
from facial_surface import blink_line, dental_arch
from surface import (
    atrow,
    clamp,
    grid,
    head_fit,
    interp,
    pi,
    parts,
    ring,
    smooth,
    sweep,
)


def sculpt_head():
    # Head construction in the 1774 x 887 facial orthographic. Values are measured about x=500.
    face_rows = [
        (299, 0, 2, 5, 5, 0),
        (308, 0, 62, 72, 73, 0),
        (334, 0, 112, 139, 132, 0),
        (374, 0, 159, 190, 170, 0),
        (426, 0, 194, 225, 190, 0),
        (485, 0, 215, 247, 201, 0),
        (546, 0, 221, 243, 200, 0),
        (601, 0, 224, 239, 189, 0),
        (641, 0, 213, 240, 172, 0),
        (676, 0, 192, 229, 153, 0),
        (710, 0, 151, 215, 129, 0),
        (739, 0, 101, 187, 89, 12),
        (758, 0, 55, 137, 50, 35),
        (767, 0, 1.5, 3, 3, 90),
    ]

    def lipline(x):
        return 711 - 46 * min(abs(x) / 109, 1.1) ** 2.15 + 3 * math.sin(min(abs(x) / 109, 1) * pi)

    def jaw_factor(x):
        return max(0, 1 - (abs(x) / 116) ** 3.25) ** 0.75

    def base_depth(x, v):
        _, rw, fd, bd, c = atrow(face_rows, v)
        co = math.sqrt(max(0.0003, 1 - (x / max(abs(x), rw, 0.1)) ** 2))
        a = abs(x)
        pad = 60 * math.exp(-(((a - 35) / 70) ** 2) - ((v - 670) / 45) ** 2) + 11 * math.exp(
            -((a / 54) ** 2) - ((v - 600) / 70) ** 2
        )
        cheek = 21 * math.exp(-(((a - 132) / 60) ** 2) - ((v - 643) / 47) ** 2)
        chin = 22 * math.exp(-((a / 78) ** 2) - ((v - 733) / 31) ** 2)
        bridge = 27 * math.exp(-((a / 43) ** 2) - ((v - 642) / 32) ** 2)
        cleft = 7 * math.exp(-((x / 8.5) ** 2) - ((v - 689) / 20) ** 2)
        corner = 10 * math.exp(-(((a - 108) / 17) ** 2) - ((v - 673) / 16) ** 2)
        return c + fd * co + (pad + cheek * 1.16 + chin + bridge - cleft - corner) * co

    def cornea(x, v):
        a = abs(x)
        depth = base_depth(x, 558) + 10 - 1.5 * math.exp(-(((a - 109) / 56) ** 2))
        if x > 0:
            # The far lens turns toward the portrait camera. Its crown flattens
            # through the iris before the temporal sclera curves into the outer canthus.
            side = float(
                np.interp(
                    a,
                    [45, 50, 63, 77, 92, 110, 129, 145, 160, 178, 202],
                    [183, 184, 198, 212, 217, 218, 221, 232, 244, 254, 273],
                )
            )
            fitted = (359.6 - side) / 0.708 + 9.0
            fade = smooth((a - 46) / 15) * smooth((193 - a) / 26)
            depth += (fitted - depth) * fade
        return depth + 0.025 * (v - 558) - 0.0009 * (v - 558) ** 2

    def face_depth(x, v):
        depth = base_depth(x, v)
        a = abs(x)
        if 34 < a < 206 and 459 < v < 650:
            feather = (
                smooth((a - 34) / 48) * smooth((206 - a) / 33) * smooth((v - 459) / 41) * smooth((650 - v) / 47)
            )
            depth += max(0, cornea(x, v) - 3.3 - depth) * feather
        return depth

    def pucker(p, u, t):
        weight = math.exp(-((p[0] / 108) ** 2) - ((p[1] - 702) / 37) ** 2) * smooth((p[2] - 137) / 52)
        p[0] *= 1 - 0.23 * weight
        p[2] += 15 * weight
        p[1] -= 2.8 * weight
        return p

    def face_half(lower):
        def surf(u, t):
            sn, cs = ring(u)
            base = (
                (710 + t * 57)
                if lower
                else float(np.interp(t, [0, 16 / 58, 28 / 58, 41 / 58, 1], [299, 436, 539, 645, 710]))
            )
            _, w, *_ = atrow(face_rows, base)
            x = w * sn
            local = math.exp(-(((base - 710) / 63) ** 2)) * smooth((cs - 0.40) / 0.25)
            local *= 1 - smooth((abs(x) - 116) / 73)
            v = base + (lipline(x) - 710) * local
            _, w, fd, bd, c = atrow(face_rows, max(299, min(767, v)))
            d = face_depth(x, v) if cs >= 0 else c + bd * cs
            # Tufts break the side silhouette as folds in the cheek itself.
            # Their bases share the smooth face and follow every expression.
            accent = 0.0
            for end, reach in [(618, 17), (647, 18), (675, 15)]:
                q = (v - end) / (21 if v < end else 8.5)
                accent += reach * math.exp(-q * q)
            lateral = abs(sn) ** 14 * (0.30 + 0.70 * smooth((cs + 0.39) / 0.62))
            x += np.sign(sn) * accent * lateral
            d -= accent * lateral * (0.44 - 0.12 * cs)
            return [x, v, d]

        def openjaw(p, u, t):
            if lower:
                amount = jaw_factor(p[0]) * smooth((math.cos(2 * pi * u) - 0.28) / 0.5)
                amount = (1 - t) * amount + t * 0.80
                p[1] += 130 * amount
                p[2] -= 36 * amount
            else:
                lift = (
                    jaw_factor(p[0])
                    * smooth((math.cos(2 * pi * u) - 0.28) / 0.5)
                    * math.exp(-(((p[1] - lipline(p[0])) / 47) ** 2))
                )
                p[1] -= 39 * lift
                p[2] += 9 * lift
            return p

        def smile(p, u, t):
            a = abs(p[0])
            h = math.exp(-(((a - 103) / 45) ** 2) - ((p[1] - 672) / 54) ** 2) * max(0, math.cos(2 * pi * u))
            p[1] -= 31 * h
            p[0] += np.sign(p[0]) * 28 * h
            return p

        grid(
            'Chin and lower lip' if lower else 'Cranium, muzzle and cheeks',
            120,
            17 if lower else 58,
            surf,
            head_fit,
            'head-presentation',
            'face',
            uvsize=(600, 118 if lower else 410),
            keys={
                'JawOpen': openjaw,
                'Smile': smile,
                'Smile.L': lambda p, u, t: smile(p, u, t) if p[0] > 0 else p,
                'Smile.R': lambda p, u, t: smile(p, u, t) if p[0] < 0 else p,
                'Pucker': pucker,
            },
            group='Face',
            cyclic=True,
        )

    for lower in [False, True]:
        face_half(lower)
    skull = next(p for p in parts if p['name'] == 'Cranium, muzzle and cheeks')
    # Recessed oral cavity, with upper teeth and tongue exposed by the articulated lip seam.

    def mouth_patch(name, halfwidth, top, bottom, paint):
        def surf(u, t):
            width = halfwidth
            if paint == 'tongue':
                width *= 0.09 + 0.91 * (1 - t**3.5) ** 0.52
            x = (math.sin(2 * pi * u) if paint == 'tongue' else u * 2 - 1) * width
            v = lipline(x)
            return [
                x,
                v + (0.15 + 0.50 * t) * jaw_factor(x),
                face_depth(x, v) + (0.18 if paint == 'mouth' else -2.5),
            ]

        def open_mouth(p, u, t):
            x = p[0]
            v = lipline(x)
            g = jaw_factor(x)
            f = top + (bottom - top) * t
            p[1] = v + (f * 130 - 39 * (1 - f) - 0.10) * g
            depth = (1.5 + 36 * f + 43 * math.sin(pi * f)) * g
            if paint == 'tongue':
                depth = (12 + 35 * f - 7 * math.sin(t * pi)) * g
                p[2] += 4 * math.sin(pi * u)
            p[2] = face_depth(x, v) - depth + 9 * (1 - f) * g + (2.5 if paint != 'mouth' else 0)
            if paint == 'tongue':
                p[2] += 9 * math.cos(2 * pi * u) * math.sin(pi * t)
                p[1] -= 5 * math.cos(2 * pi * u) * math.sin(pi * t)
            return p

        def grin(p, u, t):
            a = abs(p[0])
            h = math.exp(-(((a - 103) / 45) ** 2) - ((p[1] - 672) / 54) ** 2)
            p[1] -= 31 * h
            p[0] += np.sign(p[0]) * 28 * h
            return p

        grid(
            name,
            40 if paint == 'tongue' else 44,
            18 if paint == 'tongue' else 8,
            surf,
            head_fit,
            'head-presentation',
            paint,
            group='Face',
            cyclic=paint == 'tongue',
            material='Wet tongue' if paint == 'tongue' else 'Satin',
            uvsize=(150, 44),
            keys={
                'JawOpen': open_mouth,
                'Smile': grin,
                'Smile.L': lambda p, u, t: grin(p, u, t) if p[0] > 0 else p,
                'Smile.R': lambda p, u, t: grin(p, u, t) if p[0] < 0 else p,
                'Pucker': pucker,
            },
        )

    mouth_patch('Inner mouth', 115, -0.045, 1.045, 'mouth')
    dental_arch(lipline, face_depth)
    mouth_patch('Tongue', 70, 0.64, 0.91, 'tongue')
    # The pigmented lip rolls make closed poses readable even when the mouth
    # is compressed to one quarter of its normal width. The inner wall shares
    # the same commissure and mandible travel as the head and the dental rows.
    for lower_roll in [False, True]:

        def lip(u, t):
            x = (2 * u - 1) * 115.8
            f = max(0, math.sin(pi * u)) ** 0.48
            radius = (3.6 if lower_roll else 2.4) * f
            v = lipline(x)
            return [
                x,
                v + (1 if lower_roll else -1) * 1.7 * f + math.sin(2 * pi * t) * radius,
                face_depth(x, v) + 1.2 * f + math.cos(2 * pi * t) * radius,
            ]

        def lip_open(p, u, t):
            g = jaw_factor(p[0])
            p[1] += (130 if lower_roll else -39) * g
            p[2] += (-36 if lower_roll else 9) * g
            return p

        def lip_smile(p, u, t):
            cos = math.sqrt(max(0, 1 - (p[0] / 151) ** 2))
            h = math.exp(-(((abs(p[0]) - 103) / 45) ** 2) - ((p[1] - 672) / 54) ** 2) * cos
            p[1] -= 31 * h
            p[0] += np.sign(p[0]) * 28 * h
            return p

        grid(
            'Lower lip roll' if lower_roll else 'Upper lip roll',
            64,
            8,
            lip,
            head_fit,
            'head-presentation',
            'lower_lip' if lower_roll else 'upper_lip',
            group='Face',
            uvsize=(218, 26),
            reverse=True,
            keys={
                'JawOpen': lip_open,
                'Smile': lip_smile,
                'Smile.L': lambda p, u, t: lip_smile(p, u, t) if p[0] > 0 else p,
                'Smile.R': lambda p, u, t: lip_smile(p, u, t) if p[0] < 0 else p,
            },
        )
    # Nose leather is a rounded triangular wedge, not a spherical bead.
    nose_rows = [
        (625, 0, 3, 4, 4, 304),
        (628, 0, 23, 12, 8, 310),
        (634, 0, 34, 22, 9, 312),
        (645, 0, 36, 28, 12, 310),
        (654, 0, 29, 27, 12, 307),
        (664, 0, 16, 20, 8, 303),
        (674, 0, 3, 9, 4, 297),
    ]

    def leather(u, t):
        v = 625 + 49 * t
        _, w, front, back, center = atrow(nose_rows, v)
        sn, cs = ring(u)
        x = w * sn
        slit = (abs(x) - 22) / 8.2
        slant = (v - 651 - 0.20 * (abs(x) - 22)) / 4.6
        pit = math.exp(-slit * slit - slant * slant) * max(0, cs) ** 0.50
        return [x, v, center + cs * (front if cs >= 0 else back) - 8.1 * pit]

    grid(
        'Nose leather',
        48,
        23,
        leather,
        head_fit,
        'head-presentation',
        'nose',
        cyclic=True,
        material='Nose leather',
        uvsize=(230, 120),
        group='Face',
    )
    # Eyeball patches, iris lenses, independent eyelid shells and lash borders share one corneal surface.
    upper = [(0, 591), (0.1, 566), (0.22, 544), (0.40, 527), (0.6, 520), (0.8, 519), (0.95, 523), (1, 530)]
    lower = [(0, 591), (0.1, 600), (0.25, 605), (0.45, 606), (0.65, 602), (0.8, 592), (0.95, 566), (1, 530)]

    def eye_range(x):
        t = float(clamp((abs(x) - 50) / 128))
        return interp(t, upper), interp(t, lower)

    for sg in [-1, 1]:
        sfx = '.L' if sg == 1 else '.R'
        group = 'Eyes'
        eye = 'head-presentation'
        close = 'Blink' + sfx
        squint = 'Squint' + sfx

        def eye_patch(u, t):
            x = sg * (50 + 128 * u)
            a, b = eye_range(x)
            v = a + (b - a) * t
            return [x, v, cornea(x, v) - 3.8]

        def eye_shut(p, u, t, amount):
            a, b = eye_range(p[0])
            v = p[1] + amount * (blink_line(p[0], a, b) - p[1])
            return np.array([p[0], v, cornea(p[0], v) - 3.8 - amount * 2.8])

        grid(
            'Sclera' + sfx,
            36,
            15,
            eye_patch,
            head_fit,
            eye,
            'sclera',
            group=group,
            material='Cornea',
            uvsize=(96, 62),
            reverse=sg < 0,
            keys={close: lambda p, u, t: eye_shut(p, u, t, 1), squint: lambda p, u, t: eye_shut(p, u, t, 0.54)},
        )
        from performance import orbital_skin, sculpt_iris

        orbital_skin(sg, skull, eye_range, cornea, face_depth)
        sculpt_iris(sg, eye_range, cornea)

        for isupper in [True, False]:

            def lash(u, t, upper=isupper):
                wing = 0.32 if upper else 0.0
                g = u * (1 + wing)
                x = sg * (50 + 128 * g)
                a, b = eye_range(x)
                if g <= 1:
                    v = a if upper else b
                    th = (4.1 + 17.2 * g**1.3 if upper else 1.3 + 1.65 * g) * smooth(g / 0.10)
                    z = cornea(x, v) + 8.4
                else:
                    f = (g - 1) / wing
                    v = 530 - 25 * f - 15 * f * f
                    th = 21.3 * max(0, 1 - f) ** 0.86
                    # Lay the wing over the temple rather than projecting the
                    # entire lash into empty space at the depth of the cornea.
                    follow = smooth(f)
                    z = (cornea(x, v) + 8.4) * (1 - follow) + (face_depth(x, v) + 7.8) * follow
                if upper:
                    points = 0
                else:
                    points = sum(
                        h * max(0.0, 1 - abs(g - tip) / 0.063) ** 1.4 for tip, h in [(0.76, 5), (0.87, 6)]
                    )
                return [
                    x + sg * points * 0.64 * t,
                    v + (-1 if upper else 1) * (th * (t - 0.19) + points * t**1.5),
                    z + (3.4 * smooth(g / 0.62) if upper else 0.0) + 2.2 * math.sin(pi * t) * min(1, th / 3),
                ]

            def lashmove(p, u, t, scale, upper=isupper):
                g = u * (1.32 if upper else 1)
                a, b = eye_range(p[0])
                delta = (blink_line(p[0], a, b) - (a if upper else b)) * scale
                if g > 1:
                    delta = 2.9 * math.sin(pi * (g - 1) / 0.32) * scale
                old = p[1]
                p[1] += delta
                p[2] += cornea(p[0], p[1]) - cornea(p[0], old)
                return p

            grid(
                ('Winged upper lashes' if isupper else 'Lower lash line') + sfx,
                56,
                4,
                lash,
                head_fit,
                eye,
                'lash',
                group=group,
                uvsize=(80, 16),
                keys={
                    close: lambda p, u, t: lashmove(p, u, t, 1),
                    squint: lambda p, u, t: lashmove(p, u, t, 0.54),
                },
                reverse=(sg > 0) == isupper,
            )

            if isupper:
                for k, (g, length, lift, radius) in enumerate([(0.89, 14, 18, 4.5), (1.015, 18, 23, 5.4)]):
                    # Each tapered eyelash physically enters the mobile black rim.
                    root = lash(g / 1.32, 0.70)

                    def quill(u, t):
                        sn, cs = ring(u)
                        taper = (1 - t) ** 0.85
                        return [
                            root[0] + sg * (length * t + radius * sn * taper),
                            root[1] - lift * t**1.35 + 2.4 * sn * taper,
                            root[2] + 2.2 * cs * taper - 1.4 * t,
                        ]

                    def close_quill(p, u, t, f):
                        moved = lashmove(np.array(root), g / 1.32, 0.70, f)
                        return p + (moved - root) * (1 - 0.18 * t)

                    grid(
                        'Outer lash tip ' + str(k + 1) + sfx,
                        6,
                        6,
                        quill,
                        head_fit,
                        eye,
                        'lash',
                        group=group,
                        cyclic=True,
                        uvsize=(40, 22),
                        keys={
                            close: lambda p, u, t: close_quill(p, u, t, 1),
                            squint: lambda p, u, t: close_quill(p, u, t, 0.54),
                        },
                    )
        browpts = [
            (43, 492, 0.9, 0.7),
            (47, 490, 9.5, 4.2),
            (61, 478, 12.7, 6.2),
            (93, 457, 14, 7),
            (125, 445, 12, 6),
            (149, 447, 9, 5),
            (174, 464, 6, 3),
            (186, 479, 0.6, 0.4),
        ]
        brows = [[sg * x, v, face_depth(sg * x, v) + 9, w, h] for x, v, w, h in browpts]

        def browmove(p, u, t, amount, inner=False):
            v = p[1]
            p[1] += amount * ((1 - t) ** 1.25 if inner else 0.45 + 0.55 * math.sin(pi * (t + 0.16)))
            if inner:
                p[0] -= sg * 17 * (1 - t) ** 1.5
            else:
                p[0] += sg * 5 * math.sin(pi * t)
            p[2] += face_depth(p[0], p[1]) - face_depth(p[0], v)
            return p

        sweep(
            'Tapered eyebrow' + sfx,
            brows,
            14,
            30,
            head_fit,
            eye,
            'brow',
            keys={
                'BrowUp' + sfx: lambda p, u, t: browmove(p, u, t, -46),
                'BrowDown' + sfx: lambda p, u, t: browmove(p, u, t, 46, True),
            },
            uvsize=(95, 40),
            group='Face',
        )
        from maquette_details import make_ear

        make_ear(sg)
    from maquette_hair import sculpt_maquette_hair

    sculpt_maquette_hair()
