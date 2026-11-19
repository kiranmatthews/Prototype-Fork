import math
import numpy as np
from surface import (
    atrow,
    ball,
    bn,
    clamp,
    grid,
    hair_fit,
    head_fit,
    interp,
    loft,
    pi,
    ring,
    side,
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
        return max(0, 1 - (abs(x) / 116) ** 2) ** 0.8

    def base_depth(x, v):
        _, rw, fd, bd, c = atrow(face_rows, v)
        co = math.sqrt(max(0.0003, 1 - (x / max(abs(x), rw, 0.1)) ** 2))
        a = abs(x)
        pad = 60 * math.exp(-(((a - 35) / 70) ** 2) - ((v - 670) / 45) ** 2) + 18 * math.exp(
            -((a / 39) ** 2) - ((v - 600) / 69) ** 2
        )
        cheek = 21 * math.exp(-(((a - 132) / 60) ** 2) - ((v - 643) / 47) ** 2)
        chin = 22 * math.exp(-((a / 78) ** 2) - ((v - 733) / 31) ** 2)
        bridge = 35 * math.exp(-((a / 36) ** 2) - ((v - 642) / 29) ** 2)
        return c + fd * co + (pad + cheek + chin + bridge) * co

    def cornea(x, v):
        a = abs(x)
        return (
            base_depth(x, 558)
            + 13
            + 19 * math.exp(-(((a - 110) / 78) ** 2))
            + 0.025 * (v - 558)
            - 0.0009 * (v - 558) ** 2
        )

    def face_depth(x, v):
        depth = base_depth(x, v)
        a = abs(x)
        if 34 < a < 206 and 459 < v < 650:
            feather = (
                smooth((a - 34) / 24) * smooth((206 - a) / 33) * smooth((v - 459) / 41) * smooth((650 - v) / 47)
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
            base = (710 + t * 57) if lower else (299 + t * 411)
            _, w, *_ = atrow(face_rows, base)
            x = w * sn
            local = math.exp(-(((base - 710) / 63) ** 2)) * smooth((cs - 0.40) / 0.25)
            v = base + (lipline(x) - 710) * local
            _, w, fd, bd, c = atrow(face_rows, max(299, min(767, v)))
            d = face_depth(x, v) if cs >= 0 else c + bd * cs
            return [x, v, d]

        def openjaw(p, u, t):
            if lower:
                amount = jaw_factor(p[0]) * smooth((math.cos(2 * pi * u) - 0.28) / 0.5) * (1 - 0.38 * t)
                p[1] += 35 * amount
                p[2] -= 12 * amount
            return p

        def smile(p, u, t):
            a = abs(p[0])
            h = math.exp(-(((a - 103) / 45) ** 2) - ((p[1] - 672) / 54) ** 2) * max(0, math.cos(2 * pi * u))
            p[1] -= 15 * h
            p[0] += np.sign(p[0]) * 9 * h
            return p

        grid(
            'Chin and lower lip' if lower else 'Cranium, muzzle and cheeks',
            80,
            17 if lower else 48,
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
    # Recessed oral cavity, with upper teeth and tongue exposed by the articulated lip seam.

    def mouth_patch(name, halfwidth, top, bottom, paint):
        def surf(u, t):
            x = (u * 2 - 1) * halfwidth
            v = lipline(x)
            return [
                x,
                v + (0.15 + 0.50 * t) * jaw_factor(x),
                face_depth(x, v) + (0.18 if paint == 'mouth' else -2),
            ]

        def open_mouth(p, u, t):
            x = p[0]
            v = lipline(x)
            g = jaw_factor(x)
            f = top + (bottom - top) * t
            p[1] = v + (f * 35.5 - 0.2) * g
            p[2] = (
                face_depth(x, v) - (0.5 + f * 12 + 13 * math.sin(pi * f)) * g + (1.7 if paint != 'mouth' else 0)
            )
            return p

        def grin(p, u, t):
            a = abs(p[0])
            h = math.exp(-(((a - 103) / 45) ** 2) - ((p[1] - 672) / 54) ** 2)
            p[1] -= 15 * h
            p[0] += np.sign(p[0]) * 9 * h
            return p

        grid(
            name,
            44,
            8,
            surf,
            head_fit,
            'head-presentation',
            paint,
            group='Face',
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
    mouth_patch('Upper teeth', 94, -0.005, 0.20, 'teeth')
    mouth_patch('Tongue', 75, 0.68, 1.005, 'tongue')
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
    loft(
        'Nose leather',
        nose_rows,
        40,
        15,
        head_fit,
        'head-presentation',
        'nose',
        material='Nose leather',
        uvsize=(180, 90),
        group='Face',
    )
    for sg in [-1, 1]:
        ball(
            'Nostril ' + side(sg),
            [sg * 23, 652, 329],
            [7, 3.7, 2.8],
            head_fit,
            'head-presentation',
            'espresso',
            n=16,
            m=8,
            group='Face',
            uvsize=(24, 16),
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
        wide = 'EyeWide' + sfx
        squint = 'Squint' + sfx

        def eye_patch(u, t):
            x = sg * (50 + 128 * u)
            a, b = eye_range(x)
            v = a + (b - a) * t
            return [x, v, cornea(x, v)]

        def eye_gaze(p, u, t, dx, dy):
            x = p[0]
            a, b = eye_range(x)
            x += dx * math.sin(pi * u) ** 0.7
            new_a, new_b = eye_range(x)
            h = t + dy * math.sin(pi * t) ** 0.8 / max(5, b - a)
            v = new_a + (new_b - new_a) * h
            return np.array([x, v, cornea(x, v)])

        def eye_shut(p, u, t, amount):
            a, b = eye_range(p[0])
            v = p[1] + amount * (a + 0.83 * (b - a) - p[1])
            return np.array([p[0], v, cornea(p[0], v) - amount * 2.8])

        grid(
            'Violet eye and cornea' + sfx,
            44,
            22,
            eye_patch,
            head_fit,
            eye,
            'eyeball',
            group=group,
            material='Cornea',
            uvsize=(265, 166),
            reverse=sg < 0,
            keys={
                close: lambda p, u, t: eye_shut(p, u, t, 1),
                squint: lambda p, u, t: eye_shut(p, u, t, 0.32),
                'LookLeft': lambda p, u, t: eye_gaze(p, u, t, 17, 0),
                'LookRight': lambda p, u, t: eye_gaze(p, u, t, -17, 0),
                'LookUp': lambda p, u, t: eye_gaze(p, u, t, 0, -12),
                'LookDown': lambda p, u, t: eye_gaze(p, u, t, 0, 12),
            },
        )
        for isupper in [True, False]:

            def eyelid(u, t, upper=isupper):
                x = sg * (50 + 128 * u)
                a, b = eye_range(x)
                edge = a if upper else b
                span = math.sin(pi * u) ** 0.55
                outside = a - 53 * span if upper else b + 30 * span
                v = outside * (1 - t) + edge * t
                return [x, v, lid_depth(x, v)]

            def lid_depth(x, v):
                a, b = eye_range(x)
                f = smooth(1 - max(a - v, v - b, 0) / 30)
                base = face_depth(x, v) + 0.6
                return base + (cornea(x, v) + 6.5 - base) * f

            def lidmove(p, u, t, scale, upper=isupper):
                a, b = eye_range(p[0])
                delta = (b - a) * (0.83 if upper else -0.17) * scale * t
                p[1] += delta
                p[2] = lid_depth(p[0], p[1])
                return p

            grid(
                ('Upper lid' if isupper else 'Lower lid') + sfx,
                36,
                12,
                eyelid,
                head_fit,
                eye,
                'lid',
                group=group,
                uvsize=(166, 72),
                keys={
                    close: lambda p, u, t: lidmove(p, u, t, 1),
                    squint: lambda p, u, t: lidmove(p, u, t, 0.54),
                    wide: lambda p, u, t: lidmove(p, u, t, -0.16),
                },
                reverse=(sg < 0) == isupper,
            )

            def lash(u, t, upper=isupper):
                # Outer taper and wing rise past the corner of the eye.
                g = u * (1.43 if upper else 1.01)
                x = sg * (50 + 128 * g)
                a, b = eye_range(x)
                if g <= 1:
                    v = a if upper else b
                    th = (3.2 + 15 * g**1.25 if upper else 1.3 + 2.2 * g) * max(0.25, min(1, g * 10))
                    z = cornea(x, v) + 8.5
                else:
                    f = (g - 1) / (0.43 if upper else 0.01)
                    v = 530 - 34 * f**1.3
                    th = (16 if upper else 2) * max(0, 1 - f) ** 0.7
                    z = cornea(x, v) + 8.1
                return [x, v + ((-1 if upper else 1) * th * (t - 0.22)), z + 2 * math.sin(pi * t)]

            def lashmove(p, u, t, scale, upper=isupper):
                f = u * (1.43 if upper else 1.01)
                a, b = eye_range(p[0])
                delta = (b - a) * (0.83 if upper else -0.17) * scale
                if f > 1:
                    delta = 13 * (f - 1) / 0.43 * scale if upper else 0
                v = p[1]
                p[1] += delta
                p[2] += cornea(p[0], p[1]) - cornea(p[0], v)
                return p

            grid(
                ('Winged upper lashes' if isupper else 'Lower lash line') + sfx,
                45,
                5,
                lash,
                head_fit,
                eye,
                'lash',
                group=group,
                uvsize=(80, 16),
                keys={
                    close: lambda p, u, t: lashmove(p, u, t, 1),
                    squint: lambda p, u, t: lashmove(p, u, t, 0.54),
                    wide: lambda p, u, t: lashmove(p, u, t, -0.16),
                },
                reverse=(sg > 0) == isupper,
            )

        def flick(u, t):
            x = sg * (162 + 56 * u)
            v = 522 - 28 * u - 20 * u * u - 10 * (1 - u) * t
            return [x, v, cornea(x, v) + 8.5 + 2 * math.sin(pi * t)]

        def flickmove(p, u, t, amount):
            delta = (9 - 3 * u) * amount
            z = cornea(p[0], p[1])
            p[1] += delta
            p[2] += cornea(p[0], p[1]) - z
            return p

        grid(
            'Outer lash flick' + sfx,
            16,
            4,
            flick,
            head_fit,
            eye,
            'lash',
            group=group,
            uvsize=(50, 14),
            keys={
                close: lambda p, u, t: flickmove(p, u, t, 1),
                squint: lambda p, u, t: flickmove(p, u, t, 0.54),
                wide: lambda p, u, t: flickmove(p, u, t, -0.16),
            },
            reverse=sg > 0,
        )
        browpts = [
            (47, 481, 5.5, 3),
            (62, 467, 13, 6),
            (93, 451, 15, 8),
            (125, 440, 12, 7),
            (149, 436, 8.5, 5),
            (174, 441, 5, 3),
            (193, 453, 0.6, 0.4),
        ]
        brows = [[sg * x, v, face_depth(sg * x, v) + 9, w, h] for x, v, w, h in browpts]

        def browmove(p, u, t, amount, inner=False):
            v = p[1]
            p[1] += amount * ((1 - t) ** 1.4 if inner else 0.35 + 0.65 * math.sin(pi * (t + 0.2)))
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
                'BrowUp' + sfx: lambda p, u, t: browmove(p, u, t, -25),
                'BrowDown' + sfx: lambda p, u, t: browmove(p, u, t, 24, True),
            },
            uvsize=(95, 40),
            group='Face',
        )
        # Crisp cheek tufts grow out of the cheek plane.
        for j, (x, v, d) in enumerate([(243, 620, 72), (235, 652, 72), (216, 677, 86)]):
            sweep(
                'Cheek tuft ' + str(j) + sfx,
                [
                    [sg * (x - 58), v - 32, d - 12, 7, 10],
                    [sg * (x - 36), v - 18, d, 25, 24],
                    [sg * x, v + 2, d - 4, 0.4, 0.4],
                ],
                16,
                15,
                head_fit,
                eye,
                'fur',
                group='Face',
                uvsize=(55, 36),
            )
        # Pinna is a continuous rolled outer rim, scooped concha and rounded rear shell.
        earrows = [
            (23, 318, 1, 0),
            (57, 310, 21, 0),
            (112, 287, 43, 0),
            (181, 257, 66, 0),
            (255, 231, 78, 0),
            (314, 215, 77, 0),
            (375, 191, 65, 0),
            (418, 170, 46, 0),
            (456, 149, 12, 0),
            (462, 145, 2, 0),
        ]

        def ear(u, t):
            v = 23 + 439 * t
            cx, w, _ = atrow(earrows, v)
            sn, cs = ring(u)
            x = sg * (cx + w * sn)
            c = -85 + 49 * t
            d = c + (35 * (1 - cs**2.3) - 5 * cs if cs >= 0 else 44 * cs) * max(0.1, math.sin(pi * t) ** 0.48)
            return [x, v, d]

        grid(
            'Sculpted ear' + sfx,
            44,
            48,
            ear,
            head_fit,
            bn('ear', sg),
            'ear',
            group='Ears and hair',
            uvsize=(240, 315),
            cyclic=True,
            reverse=sg < 0,
        )
    # Hair is modeled in the coordinates of the full-body turnaround, with clump-local fluting.
    for sg in [-1, 1]:
        sfx = '.L' if sg > 0 else '.R'
        hgroup = 'Ears and hair'
        fit = hair_fit
        weight = 'head-presentation'
        pony = [
            [
                (87, 158, -6, 12, 13),
                (108, 132, -14, 23, 23),
                (146, 114, -12, 23, 19),
                (181, 111, -10, 12, 12),
                (198, 120, -8, 0.3, 0.3),
            ],
            [
                (92, 159, -6, 15, 16),
                (130, 141, -21, 29, 25),
                (167, 147, -20, 27, 23),
                (196, 182, -14, 18, 15),
                (205, 229, -7, 0.4, 0.3),
            ],
            [
                (91, 170, -7, 15, 13),
                (123, 153, -6, 28, 19),
                (155, 168, 1, 33, 23),
                (174, 202, 6, 32, 21),
                (168, 240, 7, 23, 18),
                (151, 287, 8, 0.3, 0.3),
            ],
            [
                (92, 171, -8, 12, 16),
                (130, 163, -16, 26, 25),
                (158, 192, -20, 31, 25),
                (160, 237, -23, 28, 22),
                (142, 282, -18, 16, 12),
                (129, 316, -11, 0.4, 0.3),
            ],
            [
                (92, 174, -7, 14, 16),
                (121, 171, 7, 23, 20),
                (143, 195, 16, 30, 23),
                (148, 231, 19, 29, 23),
                (137, 277, 19, 21, 18),
                (139, 314, 18, 12, 10),
                (157, 357, 13, 0.4, 0.3),
            ],
            [
                (93, 172, 2, 9, 10),
                (111, 185, 18, 17, 14),
                (121, 213, 20, 18, 12),
                (121, 252, 19, 12, 11),
                (107, 294, 12, 0.3, 0.3),
            ],
        ]

        def pony_shape(p, u, t):
            p[0] += sg * 12 * t * t
            p[2] -= 14 * t * t
            return p

        for i, rows in enumerate(pony):
            rows = [[sg * x, v, d, w, h] for x, v, d, w, h in rows]
            sweep(
                'Ponytail lock %02d%s' % (i + 1, sfx),
                rows,
                20,
                31,
                fit,
                weight,
                'hair',
                material='Gold silk hair',
                flutes=5,
                keys={'PonySwing' + sfx: pony_shape},
                uvsize=(117, 145),
                group=hgroup,
            )
        sweep(
            'Violet hair tie' + sfx,
            [
                [sg * 85, 174, 0, 19, 23],
                [sg * 91, 171, 4, 30, 29],
                [sg * 98, 165, 5, 28, 28],
                [sg * 104, 160, 2, 20, 21],
            ],
            28,
            16,
            fit,
            weight,
            'band',
            group=hgroup,
            uvsize=(55, 65),
        )
        bang = [
            [
                (0, 131, 44, 7, 8),
                (8, 130, 62, 15, 13),
                (25, 138, 75, 20, 14),
                (44, 157, 76, 18, 13),
                (63, 189, 64, 15, 12),
                (76, 225, 50, 10, 9),
                (83, 275, 35, 0.4, 0.3),
            ],
            [
                (2, 122, 36, 6, 6),
                (19, 117, 49, 13, 11),
                (45, 135, 58, 16, 13),
                (63, 157, 61, 13, 12),
                (78, 190, 54, 10, 9),
                (89, 238, 38, 0.4, 0.3),
            ],
            [
                (4, 116, 24, 6, 6),
                (22, 111, 36, 11, 10),
                (46, 120, 48, 14, 13),
                (64, 141, 48, 12, 10),
                (80, 173, 41, 9, 8),
                (90, 211, 29, 0.4, 0.3),
            ],
        ]
        for i, rows in enumerate(bang):
            rows = [
                [sg * (x + 17 * smooth((v - 127) / 59) - 4 * smooth((v - 227) / 48)), v, d, w * 0.93, h]
                for x, v, d, w, h in rows
            ]
            sweep(
                'Curtain fringe %02d%s' % (i + 1, sfx),
                rows,
                20,
                30,
                fit,
                weight,
                'hair',
                material='Gold silk hair',
                flutes=4,
                uvsize=(110, 146),
                group=hgroup,
            )
        # Narrow secondary blades split the outer silhouette and catch a grazing light.
        for j, rows in enumerate(
            [
                [
                    (108, 167, 9, 3, 4),
                    (137, 173, 19, 10, 9),
                    (153, 195, 23, 10, 8),
                    (160, 229, 23, 8, 5),
                    (154, 264, 20, 4, 3),
                    (148, 283, 18, 0.2, 0.2),
                ],
                [
                    (116, 141, -16, 3, 4),
                    (149, 138, -13, 9, 8),
                    (174, 154, -9, 10, 7),
                    (191, 184, -5, 6, 5),
                    (198, 207, -5, 0.2, 0.2),
                ],
            ]
        ):
            sweep(
                'Flyaway lock %d%s' % (j + 1, sfx),
                [[sg * x, v, d, w, h] for x, v, d, w, h in rows],
                14,
                24,
                fit,
                weight,
                'hair',
                material='Gold silk hair',
                flutes=3,
                keys={'PonySwing' + sfx: pony_shape},
                uvsize=(69, 94),
                group=hgroup,
            )
        # Interlocking locks wrap the back of the skull from part to nape.
        for i in range(4):
            q = i / 3
            rows = [
                [sg * 3, 111 + q * 5, -30 + q * 19, 6, 7],
                [sg * (28 + q * 7), 123 + q * 11, -57 + q * 16, 17, 12],
                [sg * (54 + q * 11), 149 + q * 14, -64 + q * 26, 17, 13],
                [sg * (53 + q * 15), 185 + q * 15, -66 + q * 29, 16, 12],
                [sg * (33 + q * 25), 226 + q * 8, -62 + q * 24, 14, 9],
                [sg * (3 + q * 32), 271 - q * 9, -36 + q * 17, 0.4, 0.4],
            ]
            sweep(
                'Combed nape %02d%s' % (i + 1, sfx),
                rows,
                16,
                29,
                fit,
                weight,
                'hair',
                material='Gold silk hair',
                flutes=4,
                uvsize=(76, 100),
                group=hgroup,
            )

    def crown(u, t):
        sn, cs = ring(u)
        end = 1.56 - 0.55 * cs if cs >= 0 else 1.56 - 0.91 * cs
        a = 0.006 + (end - 0.006) * t
        return [76 * math.sin(a) * sn, 183 - 77 * math.cos(a), -4 + (71 if cs > 0 else 77) * cs * math.sin(a)]

    grid(
        'Parted crown',
        52,
        24,
        crown,
        hair_fit,
        'head-presentation',
        'hair',
        material='Gold silk hair',
        uvsize=(276, 160),
        cyclic=True,
        group='Ears and hair',
    )

    # The rear camera sees a chevron of combed hair converging at the nape. Lay the
    # central section over the round cranium and taper its lower contour into one point.
    back_profile = [
        (111, 11, 19),
        (126, 47, 53),
        (152, 69, 75),
        (180, 79, 84),
        (207, 74, 86),
        (231, 62, 81),
        (253, 42, 71),
        (266, 23, 59),
        (276, 1.0, 44),
    ]

    def nape_patch(u, t):
        v = 111 + 165 * t
        w, depth = atrow(back_profile, v)
        h = u * 2 - 1
        x = w * h
        wrap = math.sqrt(max(0.03, 1 - 0.91 * h * h))
        phase = 2 * pi * (4.2 * h + 2.4 * t * np.sign(h))
        groove = 1.2 * math.cos(phase) * math.sin(pi * t)
        return [x, v, -7 - (depth + groove) * wrap]

    grid(
        'Central nape chevron',
        44,
        29,
        nape_patch,
        hair_fit,
        'head-presentation',
        'nape',
        material='Gold silk hair',
        uvsize=(207, 210),
        group='Ears and hair',
        reverse=True,
    )
