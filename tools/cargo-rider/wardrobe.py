import math
from functools import partial
import numpy as np
from shoulder import build_arm
from surface import (
    J,
    M,
    parts,
    atrow,
    ball,
    bn,
    chain,
    clamp,
    grid,
    hermite,
    interp,
    leg_weights,
    limb_fit,
    loft,
    mixweights,
    pi,
    ring,
    side,
    smooth,
    stroke,
    torso_fit,
    torso_weights,
    unit,
)


def sculpt_wardrobe():
    # The continuous torso includes the neck, soft abdominal plane and tank. Edge bindings sit above its surface.
    bodyrows = [
        (277, 0, 13, 15, 15, 0),
        (289, 0, 18, 19, 18, 0),
        (306, 0, 18, 20, 18, 0),
        (313, 0, 35, 26, 26, 0),
        (322, 0, 52, 34, 31, 0),
        (338, 0, 62, 39, 34, 0),
        (353, 0, 61, 42, 35, 0),
        (374, 0, 57, 43, 34, 0),
        (394, 0, 53, 39, 32, 0),
        (415, 0, 45, 32, 30, 0),
        (433, 0, 41, 31, 29, 0),
        (449, 0, 40, 29, 27, 0),
        (466, 0, 47, 32, 31, 0),
        (484, 0, 57, 37, 37, 0),
        (502, 0, 62, 38, 40, 0),
        (518, 0, 61, 38, 42, 0),
    ]

    def torso(u, t):
        v = 277 + t * 241
        _, w, fd, bd, dc = atrow(bodyrows, v)
        sn, cs = ring(u)
        x = w * sn
        d = (fd if cs >= 0 else bd) * cs * (1 + 0.13 * math.exp(-(((v - 350) / 42) ** 2)))
        if cs > 0:
            d += (
                8 * math.exp(-(((abs(x) - 27) / 19) ** 2) - ((v - 369) / 21) ** 2)
                - 1.9 * math.exp(-((x / 4) ** 2) - ((v - 458) / 8) ** 2)
            ) * cs
        d -= 11 * (1 - smooth((v - 288) / 25))
        return [x, v, d]

    def upper_body_weights(p, u, t):
        x, v, d = p
        # The ribcage follows the chest, the outer shelf follows the clavicle.
        # Arm rotation starts across the shared deltoid loops.
        shelf = 0.48 * smooth((abs(x) - 25) / 36) * math.exp(-(((v - 332) / 31) ** 2))
        base = {k: n * (1 - shelf) for k, n in torso_weights(v).items()}
        base[bn('clavicle', 1 if x > 0 else -1)] = shelf
        return base

    grid(
        'Fitted tank, neck and midriff',
        64,
        46,
        torso,
        torso_fit,
        upper_body_weights,
        'body',
        group='Body',
        uvsize=(408, 372),
        cyclic=True,
    )
    tank = parts[-1]
    for sg in [-1, 1]:
        build_arm(tank, sg)
    loft(
        'Tank elastic hem',
        [
            (420, 0, 41.8, 31.8, 30, 0),
            (423, 0, 43.4, 33.1, 30.7, 0),
            (431, 0, 43.0, 32.7, 30.5, 0),
            (435, 0, 41.7, 31, 29, 0),
        ],
        48,
        8,
        torso_fit,
        lambda p, u, t: torso_weights(p[1]),
        'pink',
        uvsize=(110, 26),
    )
    # The gathered trousers share their central seam down to the crotch. Outer pockets move with their thigh.
    pantrows = [
        (471, 0, 56, 37, 38),
        (489, 0, 69, 42, 42),
        (514, 0, 82, 45, 47),
        (543, 0, 94, 46, 49),
        (577, 0, 108, 45, 47),
        (605, 2, 112, 46, 47),
        (656, 7, 123, 48, 48),
        (701, 10, 136, 52, 52),
        (747, 15, 148, 55, 54),
        (783, 14, 165, 56, 58),
        (812, 15, 174, 58, 59),
        (835, 12, 165, 53, 55),
        (850, 16, 157, 48, 53),
        (868, 15, 166, 53, 55),
        (884, 23, 163, 50, 53),
        (899, 43, 151, 38, 43),
        (911, 53, 143, 32, 37),
    ]

    def pants_fit(p, sg):
        a = limb_fit(p, sg, 'leg')
        b = torso_fit(p)
        f = smooth((p[1] - 496) / 84)
        return a * f + b * (1 - f)

    def pants_surf(u, t, sg):
        v = 486 + 425 * t
        inn, out, fd, bd = atrow(pantrows, v)
        sn, cs = ring(u)
        mid = (inn + out) / 2
        w = (out - inn) / 2
        # Above the crotch each leg takes half the elliptical seat; medially the two half-rings meet.
        f = smooth((v - 542) / 76)
        lateral = sn * sg
        a = mid + w * lateral
        outside = out * max(0, lateral)
        x = sg * (a * f + outside * (1 - f))
        dep = (fd if cs >= 0 else bd) * cs
        if lateral < 0:
            dep = (fd if cs >= 0 else bd) * cs
        wave = 2.7 * math.sin(3 * (2 * pi * u) + v * 0.069) + 1.6 * math.sin(v * 0.13 - 2 * 2 * pi * u)
        bunch = math.exp(-(((v - 842) / 70) ** 2)) + 0.40 * math.exp(-(((v - 650) / 60) ** 2))
        x += sg * lateral * wave * bunch
        dep += cs * wave * bunch
        return [x, v, dep]

    for sg in [-1, 1]:
        sx = side(sg)
        fit = partial(pants_fit, sg=sg)

        def lw(p, u, t):
            return leg_weights(p[1], sg)

        def trouser_weights(p, u, t):
            v = p[1]
            lateral = smooth((abs(p[0]) - 5) / 44)
            # The crotch stays on the pelvis. Below the seat even the inner seam
            # follows this leg completely as it swings behind the rider.
            blend = smooth((v - 507) / 97) * (lateral + (1 - lateral) * smooth((v - 553) / 83))
            weights = {k: val * (1 - blend) for k, val in torso_weights(v).items()}
            for bone, val in leg_weights(v, sg).items():
                weights[bone] = weights.get(bone, 0) + val * blend
            return weights

        grid(
            'Cargo leg ' + sx,
            48,
            54,
            partial(pants_surf, sg=sg),
            fit,
            trouser_weights,
            'pant',
            uvsize=(302, 454),
            cyclic=True,
        )
        # Pocket is a gusseted panel with its own projecting flap, cord stay and stitched perimeter.

        def pocket(u, t, flap=False):
            a = (u - 0.5) * 2
            v = (591 + 12 * abs(a) ** 3 if flap else 600 + 5 * abs(a) ** 3) + t * (
                (34 - 4 * abs(a)) if flap else 105 - 10 * abs(a) ** 2
            )
            cx = 95 + (v - 590) * 0.26
            x = cx + 22 * a + (2 if flap else 0)
            inn, out, fd, bd = atrow(pantrows, v)
            rel = clamp((x - (inn + out) / 2) / ((out - inn) / 2), -1, 1)
            d = fd * math.sqrt(max(0.045, 1 - rel**2))
            d += 8 + (5 if flap else 0) + 4 * (1 - a * a) * math.sin(pi * t)
            return [sg * x, v, d]

        for flap in [False, True]:
            name = ('Pocket flap ' if flap else 'Bellows pocket ') + sx
            grid(
                name,
                15,
                12,
                partial(pocket, flap=flap),
                fit,
                lw,
                'pocket',
                uvsize=(108, 80 if flap else 114),
                reverse=sg < 0,
            )
            for u in [0.014, 0.986]:
                pts = [pocket(u, t, flap) for t in np.linspace(0.01, 0.98, 8)]
                stroke(name + ' edge ' + str(u), pts, 1.45, fit, lw, 'pocket_edge', uvsize=(42, 16))
            pts = [pocket(u, 0.985, flap) for u in np.linspace(0.01, 0.99, 8)]
            stroke(name + ' welt', pts, 1.55, fit, lw, 'pocket_edge', uvsize=(42, 16))
        cord = [pocket(0.69, 0.08), pocket(0.79, 0.34), pocket(0.88, 0.61), pocket(0.97, 0.79)]
        cord = [[x, v, d + 3] for x, v, d in cord]
        stroke('Pocket zip ' + sx, cord, 1.7, fit, lw, 'espresso', uvsize=(32, 16))
        ball('Cord stop ' + sx, cord[-1], [3, 4.2, 2.8], fit, lw, 'espresso', n=12, m=7, uvsize=(20, 14))
    # Waisted elastic, metal eyelets, individually looped black ties.

    def waist(u, t):
        sn, cs = ring(u)
        v = 468 + 23 * t
        f = math.sin(t * pi)
        pleat = 1.25 * math.sin(29 * 2 * pi * u + 0.6 * math.sin(pi * t)) * f
        return [
            (53 + 18 * t + 2 * f + pleat) * sn,
            v + 2.7 * cs + 2 * math.cos(3 * 2 * pi * u),
            (34 + 11 * t + 2 * f + pleat) * cs,
        ]

    grid(
        'Gathered waistband',
        88,
        12,
        waist,
        torso_fit,
        lambda p, u, t: torso_weights(p[1]),
        'cuff',
        cyclic=True,
        uvsize=(230, 64),
    )
    for sg in [-1, 1]:

        def dw(p, u, t):
            return torso_weights(p[1])

        ball(
            'Belt eyelet ' + side(sg),
            [sg * 14, 491, 40.7],
            [4.1, 3.3, 1.4],
            torso_fit,
            dw,
            'gunmetal',
            n=14,
            m=8,
            material='Metal',
            uvsize=(18, 16),
        )
        pts = [
            [sg * 14, 491, 42],
            [sg * 8, 494, 45],
            [sg * 18, 501, 48],
            [sg * 20, 512, 49],
            [sg * 13, 514, 50],
            [sg * 7, 506, 49],
            [sg * 2, 496, 48],
            [sg * 5, 509, 48],
            [sg * 8, 526, 48],
            [sg * 8, 538 + (3 if sg < 0 else 0), 47],
        ]
        stroke('Knotted drawcord ' + side(sg), pts, 1.65, torso_fit, dw, 'espresso', uvsize=(38, 24))
        ball(
            'Drawcord aglet ' + side(sg),
            pts[-1],
            [2.6, 4.3, 2.2],
            torso_fit,
            dw,
            'gunmetal',
            n=12,
            m=7,
            uvsize=(14, 14),
        )
    ball(
        'Drawstring knot',
        [0, 496, 48],
        [5, 3.5, 3],
        torso_fit,
        lambda p, u, t: torso_weights(p[1]),
        'espresso',
        n=12,
        m=8,
        uvsize=(16, 16),
    )
    # Necklace with shell grooves and a dark string visible in the gaps.

    def necklace(u, t):
        sn, cs = ring(u)
        angle = t * 2 * pi
        return [
            (25 + 1.4 * math.cos(angle)) * sn,
            305 + 5 * cs + 1.4 * math.sin(angle),
            (22 + 1.4 * math.cos(angle)) * cs,
        ]

    grid('Shell necklace cord', 48, 6, necklace, torso_fit, 'neck', 'espresso', cyclic=True, uvsize=(54, 16))
    for i in range(12):
        theta = 2 * pi * i / 12
        sn, cs = math.sin(theta), math.cos(theta)
        c = [25 * sn, 305 + 5 * cs, 22 * cs]

        def shell(u, t):
            around, front = ring(u)
            angle = 0.003 + (pi - 0.006) * t
            lateral = math.sin(angle) * around
            length = math.cos(angle)
            across = 5.6 * lateral * (1 + 0.16 * length)
            # Two convex lobes curve into the incision on the exposed shell face.
            notch = (
                math.exp(-(((lateral - 0.08 * length) / 0.15) ** 2))
                * max(0, front) ** 1.5
                * math.sin(angle) ** 0.7
            )
            deep = 4.0 * math.sin(angle) * front - 1.6 * notch
            along = 3.65 * length + 0.42 * lateral
            return [c[0] + cs * across + sn * deep, c[1] + along, c[2] - sn * across + cs * deep]

        grid(
            'Cowrie %02d' % i,
            16,
            9,
            shell,
            torso_fit,
            'neck',
            'shell',
            cyclic=True,
            group='Jewelry',
            material='Pearl',
            uvsize=(58, 42),
        )
    # Feet are directly registered to the heel and toe contacts. The outsole has a real flat bearing surface.

    def shoe_fit(p, sg):
        x, v, d = p
        ankle = J[bn('ankle', sg)]
        matrix = M[bn('ankle', sg)][:3, :3] / 1.53
        return ankle + matrix @ np.array([x * 0.00242, (991 - v) * 0.00164 - 0.0765, d * 0.00249])

    for sg in [-1, 1]:
        sx = side(sg)
        fit = partial(shoe_fit, sg=sg)
        foot = bn('ankle', sg)
        toe = bn('toe', sg)

        def fw(p, u, t):
            return mixweights(foot, toe, smooth((p[2] - 74) / 41) * 0.67)

        def sole(u, t):
            sn, cs = ring(u)
            z = 38 + 80 * math.copysign(abs(cs) ** 0.80, cs)
            w = 31 + 6 * smooth((z + 29) / 85)
            bevel = 0.92 + 0.08 * math.sin(pi * t) ** 0.4
            return [w * math.copysign(abs(sn) ** 0.75, sn) * bevel, 970 + 21 * t, 38 + (z - 38) * bevel]

        grid(
            'Rubber cupsole ' + sx,
            60,
            8,
            sole,
            fit,
            fw,
            'rubber',
            material='Rubber',
            uvsize=(141, 44),
            cyclic=True,
        )

        def outsole(u, t):
            x, v, z = sole(u, 1)
            return [x * t, 991, 38 + (z - 38) * t]

        grid('Tread ' + sx, 56, 2, outsole, fit, fw, 'tread', material='Rubber', uvsize=(128, 38), cyclic=True)
        sections = [
            (-43, 0.1, 969),
            (-42, 6, 942),
            (-39, 19, 925),
            (-30, 29, 901),
            (-10, 34, 894),
            (9, 34, 902),
            (29, 35, 916),
            (47, 36, 931),
            (68, 36, 942),
            (84, 35, 947),
            (102, 31, 951),
            (113, 22, 956),
            (119, 0.1, 969),
        ]

        def leather_height(x, d):
            width, top = atrow(sections, d)
            factor = math.sqrt(max(0.001, 1 - (x / max(width, abs(x), 0.001)) ** 2))
            return 970 - (970 - top) * factor**0.67

        def upper_shoe(u, t):
            sn, cs = ring(u)
            d = -43 + 162 * t
            w, top = atrow(sections, d)
            return [w * sn, 970 - (970 - top) * max(0, cs) ** 0.67 + max(0, -cs) * 2, d]

        grid(
            'Leather upper ' + sx,
            48,
            30,
            upper_shoe,
            fit,
            fw,
            'leather',
            material='Shoe leather',
            cyclic=True,
            uvsize=(180, 95),
            reverse=True,
        )

        def panel(u, t):
            a = 2 * u - 1
            d = 6 + 76 * t
            x = a * (16 + 7 * t)
            return [x, leather_height(x, d) - 1.2, d]

        grid(
            'Quilted tongue ' + sx,
            20,
            17,
            panel,
            fit,
            fw,
            'leather',
            material='Shoe leather',
            uvsize=(75, 74),
            reverse=True,
        )
        for j in range(5):
            d = 16 + j * 12
            w = 16 + j * 1.1
            pts = []
            for k in [-1, -0.58, 0, 0.58, 1]:
                X = w * k
                D = d + 2 * math.sin(pi * (k + 1) * 0.86)
                pts.append([X, leather_height(X, D) - 3.3 - 0.5 * (1 - k * k), D])
            stroke('Lace %d ' % (j + 1) + sx, pts, 2.3, fit, fw, 'laces', uvsize=(36, 15))
            for k in [-1, 1]:
                ball(
                    'Eyelet %d %d ' % (j, k) + sx,
                    [w * k, leather_height(w * k, d) - 1.5, d],
                    [3.1, 1.6, 3.1],
                    fit,
                    fw,
                    'eyelet',
                    n=10,
                    m=6,
                    uvsize=(12, 10),
                )
        for k in [-1, 1]:
            for j, pts in enumerate(
                [
                    [(18, 909, 16), (23, 919, 36), (26, 941, 64), (30, 959, 79), (32, 964, 87)],
                    [(23, 923, -31), (28, 929, -13), (32, 945, 7), (35, 960, 28), (34, 964, 49)],
                ]
            ):
                stroke(
                    'Shoe overlay %d %d ' % (k, j) + sx,
                    [[x * k, v, d] for x, v, d in pts],
                    1.25,
                    fit,
                    fw,
                    'stitch',
                    uvsize=(28, 14),
                )
    # Glove-compatible hands: each phalanx is aligned to its measured native joint and contact endpoint.
    # The wrist is tapered; the thumb has its own thenar lobe and three articulated segments.
    for sg in [-1, 1]:
        sx = side(sg)
        mount = bn('hand-rest-orientation', sg)
        T = M[mount]

        def handfit(p):
            return (T @ np.array([p[0], p[1], p[2], 1]))[:3]

        def palm(u, t):
            sn, cs = ring(u)
            w, h = atrow(
                [
                    (0, 0.032, 0.032),
                    (0.18, 0.050, 0.045),
                    (0.4, 0.068, 0.053),
                    (0.64, 0.078, 0.052),
                    (0.79, 0.080, 0.046),
                    (0.89, 0.068, 0.036),
                    (0.96, 0.042, 0.022),
                    (1, 0.005, 0.004),
                ],
                t,
            )
            thenar = 0.028 * math.exp(-(((t - 0.42) / 0.19) ** 2)) * smooth(-sg * sn)
            base = math.exp(-(((t - 0.78) / 0.20) ** 2))
            return [
                w * sn - sg * thenar,
                -0.158 * t,
                0.004 + h * cs + 0.004 * base * cs * math.cos(3 * pi * sn),
            ]

        grid(
            'Palm and thenar eminence ' + sx,
            38,
            27,
            palm,
            handfit,
            mount,
            'fur',
            group='Hands',
            uvsize=(110, 100),
            cyclic=True,
        )
        for digit in ['index', 'middle', 'outer', 'thumb']:
            stages = (
                ['metacarpal', 'proximal', 'distal'] if digit == 'thumb' else ['proximal', 'middle', 'distal']
            )
            prefix = '' if digit == 'thumb' else 'finger-'
            base = prefix + digit + '-'
            names = [bn(base + stage, sg) for stage in stages]
            tip = bn('socket-thumb' if digit == 'thumb' else 'socket-finger-' + digit, sg)
            points = [J[name] for name in [*names, tip]]
            inv = np.linalg.inv(T)
            local = [(inv @ np.array([*p, 1]))[:3] for p in points]

            def digit_mesh(u, t):
                p = hermite(local, t)
                tang = unit(hermite(local, min(1, t + 0.003)) - hermite(local, max(0, t - 0.003)))
                a = unit(np.cross(tang, [0, 0, 1]))
                b = unit(np.cross(tang, a))
                sn, cs = ring(u)
                r = interp(
                    t,
                    [
                        (0, 0.034 if digit == 'thumb' else 0.029),
                        (0.32, 0.0265),
                        (0.56, 0.024),
                        (0.7, 0.022),
                        (0.89, 0.019),
                        (0.98, 0.009),
                        (1, 0.0004),
                    ],
                )
                return p + a * r * sn + b * r * 0.98 * cs

            def dw(p, u, t):
                return chain(
                    t, [(0, names[0]), (0.22, names[0]), (0.41, names[1]), (0.59, names[1]), (0.79, names[2])]
                )

            grid(
                'Articulated ' + digit + ' ' + sx,
                16,
                22,
                digit_mesh,
                handfit,
                dw,
                'fur',
                group='Hands',
                uvsize=(55, 54),
                cyclic=True,
            )
            tip_center = hermite(local, 0.88)
            tip_center[2] += 0.015
            ball(
                'Claw ' + digit + ' ' + sx,
                tip_center,
                [0.011, 0.014, 0.0045],
                handfit,
                names[-1],
                'claw',
                n=12,
                m=7,
                group='Hands',
                material='Nail',
                uvsize=(18, 16),
            )

        def band(u, t):
            sn, cs = ring(u)
            v = -0.006 + (t - 0.5) * (0.027 if sg > 0 else 0.026)
            r = 0.045 + 0.0024 * math.sin(pi * t)
            return [r * sn, v, r * 0.90 * cs]

        grid(
            ('Watch strap ' if sg > 0 else 'Braided bracelet ') + sx,
            40,
            8,
            band,
            handfit,
            mount,
            'strap' if sg > 0 else 'band',
            group='Jewelry',
            uvsize=(73, 27),
            cyclic=True,
        )
        if sg > 0:
            ball(
                'Watch bezel',
                [0, -0.006, 0.043],
                [0.019, 0.020, 0.006],
                handfit,
                mount,
                'gold',
                material='Metal',
                group='Jewelry',
                uvsize=(27, 18),
            )
            ball(
                'Watch dial',
                [0, -0.006, 0.048],
                [0.015, 0.016, 0.003],
                handfit,
                mount,
                'dial',
                material='Pearl',
                group='Jewelry',
                uvsize=(24, 16),
            )
        else:
            for j in range(16):
                t = 2 * pi * j / 16
                ball(
                    'Braided knot ' + str(j),
                    [0.045 * math.sin(t), -0.005 + 0.004 * (-1) ** j, 0.0405 * math.cos(t)],
                    [0.0085, 0.009, 0.008],
                    handfit,
                    mount,
                    'band',
                    n=10,
                    m=6,
                    group='Jewelry',
                    uvsize=(12, 12),
                )
