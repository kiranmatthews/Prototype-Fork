"""Build the twin ponytails, double ties, parted fringe and combed nape from three views."""

import math
import numpy as np
from maquette import fit, hair_projection, REAR_AXIS, SIDE_AXIS
from surface import atrow, grid, hermite, pi, ring, smooth, unit

MAT = 'Gold silk hair'
GROUP = 'Ears and hair'
BONE = 'head-presentation'


def sculpt_maquette_hair():
    for sign in (-1, 1):
        suffix = '.L' if sign > 0 else '.R'

        def swing(p, u, t):
            strength = t * t
            p[0] += sign * 24 * strength
            p[2] -= 26 * strength
            return p

        def sweep_side(p, direction):
            dx = p[0] - sign * 123
            dz = p[2] + 111
            falloff = smooth((math.hypot(dx, dz) - 13) / 107)
            angle = math.radians(direction * 27) * falloff * (1 if direction * sign < 0 else 0.55)
            x, d = p[0], p[2]
            p[0] = math.cos(angle) * x + math.sin(angle) * d
            p[2] = -math.sin(angle) * x + math.cos(angle) * d
            p[0] -= sign * 23 * falloff * math.exp(-(((p[1] - 342) / 142) ** 2))
            near = direction * sign > 0
            p[1] += falloff * (
                (17 if near else 40) * math.exp(-(((p[1] - 190) / 84) ** 2))
                + (18 if near else -11) * smooth((p[1] - 390) / 245)
            )
            return p

        swing_keys = {
            'PonySwing' + suffix: swing,
            'HairSweep.L': lambda p, u, t: sweep_side(p, -1),
            'HairSweep.R': lambda p, u, t: sweep_side(p, 1),
        }
        # The two silhouette intervals at each height are read independently from
        # the rear and side drawings. One continuous mass carries the long tip.
        contours = [
            (211, 150, 184, 471, 525),
            (218, 127, 211, 461, 550),
            (234, 100, 230, 450, 584),
            (256, 81, 235, 448, 610),
            (282, 65, 227, 456, 628),
            (313, 54, 215, 475, 643),
            (354, 48, 204, 496, 657),
            (401, 49, 195, 510, 661),
            (449, 57, 184, 519, 648),
            (487, 74, 181, 522, 633),
            (531, 96, 187, 521, 609),
            (567, 113, 189, 522, 592),
            (598, 128, 184, 530, 583),
            (630, 138, 169, 546, 582),
            (654, 134, 150, 567, 589),
            (675, 125, 126.1, 601, 602.1),
        ]

        def main_lock(u, t):
            row = contours[0][0] + t * (contours[-1][0] - contours[0][0])
            outer, inner, forward, rear = atrow(contours, row)
            rx = (inner - outer) * 0.5
            rz = (rear - forward) * 0.5
            sn, cs = ring(u)
            # A mildly diagonal section gives the front cheek room in a
            # three-quarter view while retaining both measured silhouettes.
            correlation = -0.28 + 0.17 * t
            d = (
                SIDE_AXIS
                - (forward + rear) * 0.5
                + rz * (math.sqrt(1 - correlation * correlation) * cs + correlation * sn)
            )
            x = REAR_AXIS - (outer + inner) * 0.5 + rx * sn
            grooves = 0.90 * math.cos(2 * pi * (u * 3 + 0.095 * math.sin(pi * t))) + 0.30 * math.cos(
                2 * pi * (u * 7 + 0.10 * math.sin(pi * t))
            )
            relief = 2.4 * math.sin(pi * t) ** 0.85 * grooves
            return [sign * (x + relief * sn), row, d + relief * cs]

        grid(
            'Swept ponytail' + suffix,
            36,
            43,
            main_lock,
            fit,
            BONE,
            'maquette_hair',
            cyclic=True,
            reverse=sign < 0,
            group=GROUP,
            material=MAT,
            keys=swing_keys,
            uvsize=(290, 370),
            project=hair_projection,
        )

        # A few broad blades occupy the same root. In profile their widths are
        # measured separately, giving a full swept ponytail around the central mass.
        def blade(label, guides, nu=17, nv=23, animated=False, fringe=False):
            rows = np.array([[sign * x, y, SIDE_AXIS - side, w, h] for x, y, side, w, h in guides])

            def shell(u, t):
                center = hermite(rows, t)
                tangent = unit(hermite(rows, min(1, t + 0.001))[:3] - hermite(rows, max(0, t - 0.001))[:3])
                lateral = unit(np.array([tangent[1], -tangent[0], 0.0]))
                depth = unit(np.cross(lateral, tangent))
                twist = sign * math.radians((3 if fringe else 10) - 18 * t)
                across = math.cos(twist) * lateral + math.sin(twist) * depth
                deep = math.cos(twist) * depth - math.sin(twist) * lateral
                sn, cs = ring(u)
                width = max(0.22, center[3])
                height = max(0.18, center[4])
                ridge = sign * (0.15 + 0.14 * math.sin(pi * t))
                face = math.copysign(abs(cs) ** 0.77, cs) * (1 - 0.22 * abs(sn - ridge))
                crease = 0.14 * math.exp(-(((sn - ridge) / 0.18) ** 2)) * math.sin(pi * t) ** 0.7
                return center[:3] + across * sn * width + deep * face * (1 - crease) * height

            grid(
                label + suffix,
                nu,
                nv,
                shell,
                fit,
                BONE,
                'maquette_fringe' if fringe else 'maquette_hair',
                cyclic=True,
                material=MAT,
                group=GROUP,
                uvsize=(222, 308) if fringe else (175, 246),
                keys=swing_keys if animated else None,
                project=hair_projection,
            )

        blade(
            'Upper ponytail sweep',
            [
                (124, 271, 447, 14, 16),
                (148, 232, 467, 24, 27),
                (178, 203, 501, 34, 37),
                (216, 183, 542, 26, 30),
                (253, 179, 582, 15, 19),
                (278, 187, 616, 8, 10),
                (299, 201, 647, 0.3, 0.3),
            ],
            animated=True,
        )
        blade(
            'Outer ponytail sweep',
            [
                (128, 270, 449, 18, 19),
                (165, 241, 485, 28, 31),
                (215, 230, 543, 33, 34),
                (263, 247, 600, 33, 32),
                (304, 278, 643, 29, 30),
                (333, 319, 674, 22, 21),
                (346, 365, 693, 12, 11),
                (350, 409, 700, 0.3, 0.3),
            ],
            animated=True,
        )
        blade(
            'Inner ponytail sweep',
            [
                (120, 279, 444, 13, 16),
                (149, 294, 471, 24, 27),
                (168, 336, 495, 23, 23),
                (173, 385, 510, 17, 17),
                (168, 432, 515, 13, 13),
                (155, 479, 510, 8, 8),
                (124, 523, 505, 0.3, 0.3),
            ],
            nu=16,
            nv=28,
            animated=True,
        )
        # Two elastic coils wrap the bundle on a raked axis, leaving the gold
        # root visible through the inner opening. Both bands are real tori.
        axis = unit(np.array([sign * 0.87, -0.20, -0.48]))
        first = unit(np.cross(axis, [0.0, 1.0, 0.0]))
        second = unit(np.cross(axis, first))
        origin = np.array([sign * 123.0, 279.0, SIDE_AXIS - 441])

        def tied_bundle(u, t):
            sn, cs = ring(u)
            radius = 0.90 + 0.10 * (2 * t - 1) ** 2
            center = origin + axis * (-33 + 70 * t)
            # The ends taper inside the cap and into the ponytail. There is no
            # exposed cylinder end at either side of the elastic.
            taper = 0.36 + 0.64 * math.sin(pi * t) ** 0.40
            return center + (sn * first * 35 + cs * second * 50) * radius * taper

        grid(
            'Gathered hair inside ties' + suffix,
            22,
            13,
            tied_bundle,
            fit,
            BONE,
            'maquette_hair',
            cyclic=True,
            group=GROUP,
            material=MAT,
            uvsize=(160, 112),
            project=hair_projection,
        )
        for i, h in enumerate((-5.8, 5.8)):

            def tie(u, t):
                long, front = ring(u)
                around = long * first * 37 + front * second * 53
                radial = unit(around)
                a = 2 * pi * t
                return origin + axis * (h + 6.5 * math.sin(a)) + around + radial * 6.6 * math.cos(a)

            grid(
                'Double violet elastic ' + str(i + 1) + suffix,
                40,
                9,
                tie,
                fit,
                BONE,
                'violet_elastic',
                cyclic=True,
                group=GROUP,
                uvsize=(160, 38),
            )

        # Match both boundaries of the broad near curtain in the portrait and
        # profile. Correlation between the two intervals turns the surface around
        # the brow. The opposite forelock shares its construction and central part.
        def curtain(label, contours, correlation, nu=28, nv=42):
            if sign > 0:
                # The right forelock is visible in both the frontal portrait and
                # the near profile. Fit its own projected sides from those views.
                # Mirroring the other curtain alone leaves the far cheek bare.
                if label == 'Sculpted face-framing forelock':
                    edge = [
                        (431, 433),
                        (426, 450),
                        (430, 477),
                        (435, 515),
                        (443, 551),
                        (466, 575),
                        (492, 583),
                        (506, 590),
                        (526, 596),
                        (547, 604),
                        (561, 607),
                        (566, 605),
                        (562, 597),
                        (555, 582),
                        (547, 548),
                    ]
                else:
                    edge = [
                        (433, 435),
                        (428, 457),
                        (437, 503),
                        (454, 555),
                        (495, 583),
                        (537, 602),
                        (562, 611),
                        (566, 604),
                        (559, 590),
                        (553, 577),
                        (546, 562),
                        (543, 544),
                    ]
                assert len(edge) == len(contours)
                contours = [(row, l, r, f, b) for (row, _, _, f, b), (l, r) in zip(contours, edge)]
                correlation = -0.58

            def lock(u, t):
                row = contours[0][0] + (contours[-1][0] - contours[0][0]) * t
                left, right, near, far = atrow(contours, row)
                mid_u = (left + right) * 0.5
                mid_z = SIDE_AXIS - (near + far) * 0.5
                ru = max(0.3, (right - left) * 0.5)
                rz = max(0.3, (far - near) * 0.5)
                center = np.array([(mid_u - 400 - 0.43837 * mid_z) / 0.89879, mid_z])
                shape = np.array(
                    [
                        [
                            (ru - 0.43837 * rz * correlation) / 0.89879,
                            -0.43837 * rz * math.sqrt(1 - correlation**2) / 0.89879,
                        ],
                        [rz * correlation, rz * math.sqrt(1 - correlation**2)],
                    ]
                )
                sn, cs = ring(u)
                x, depth = center + shape @ np.array([sn, cs])
                # The front seam is broad at the scalp and becomes a cheek-framing
                # point below the brow. The far return is a separate branch below it.
                if label == 'Sculpted face-framing forelock':
                    depth += 11 * math.exp(-(((row - 235) / 43) ** 2)) * max(cs, 0)
                flute = (
                    1.3 * math.cos(2 * pi * (3 * u - 0.22 * t)) + 0.48 * math.cos(2 * pi * (5 * u - 0.14 * t))
                ) * math.sin(pi * t) ** 0.75
                if label == 'Swept temple curtain' and sign < 0:
                    row -= 72 * smooth((row - 369) / 178)
                return [x + flute * sn, row, depth + flute * cs]

            def fringe_pigment(p, u, t):
                row = contours[0][0] + (contours[-1][0] - contours[0][0]) * t
                left, right, near, far = atrow(contours, row)
                sn, cs = ring(u)
                front = left + (right - left) * (0.5 + 0.47 * sn)
                side = near + (far - near) * (
                    0.5 - 0.44 * (correlation * sn + math.sqrt(1 - correlation**2) * cs)
                )
                return [front, row, side, 0.13 + 0.51 * abs(sn) ** 2]

            grid(
                label + suffix,
                nu,
                nv,
                lock,
                fit,
                BONE,
                'maquette_fringe',
                cyclic=True,
                reverse=False,
                group=GROUP,
                material=MAT,
                uvsize=(340, 394),
                project=fringe_pigment,
            )

        curtain(
            'Sculpted face-framing forelock',
            [
                (185, 415, 417, 220, 222),
                (191, 383, 439, 217, 241),
                (201, 360, 452, 208, 263),
                (216, 340, 459, 195, 282),
                (238, 320, 468, 187, 303),
                (263, 303, 475, 188, 317),
                (282, 293, 476, 193, 326),
                (296, 286, 451, 199, 332),
                (315, 278, 422, 209, 338),
                (343, 266, 381, 228, 343),
                (374, 255, 349, 245, 345),
                (407, 247, 320, 262, 341),
                (441, 241, 286, 279, 331),
                (467, 240, 262, 289, 318),
                (490, 245, 246, 297, 298),
            ],
            0.82,
            30,
            42,
        )
        curtain(
            'Swept temple curtain',
            [
                (175, 410, 414, 247, 250),
                (185, 384, 441, 240, 274),
                (208, 346, 442, 236, 305),
                (245, 310, 410, 246, 331),
                (287, 283, 368, 265, 350),
                (335, 260, 338, 281, 370),
                (383, 250, 310, 296, 381),
                (429, 253, 289, 307, 378),
                (468, 263, 282, 314, 365),
                (498, 264, 278, 319, 354),
                (526, 261, 269, 322, 338),
                (546, 256, 257, 325, 326),
            ],
            0.78,
            24,
            37,
        )
        # The small forward return is on the central fringe, clear of the eyes.
        if sign < 0:
            # The anterior leaf starts inside the sagittal part. It climbs out of
            # the scalp, then curves around the far temple in the profile drawing.
            guide = [
                (188, 13, 227, 4, 5),
                (202, 32, 210, 17, 19),
                (215, 51, 194, 22, 26),
                (236, 76, 176, 23, 31),
                (264, 104, 156, 23, 36),
                (301, 130, 143, 21, 33),
                (332, 146, 138, 19, 30),
                (363, 157, 138, 17, 27),
                (397, 167, 146, 14, 24),
                (426, 174, 153, 10, 18),
                (448, 180, 159, 6, 9),
                (461, 183, 162, 0.3, 0.3),
            ]

            def anterior(u, t):
                row = 188 + 273 * t
                x, side, wide, deep = atrow(guide, row)
                sn, cs = ring(u)
                exterior = 67.0 * smooth((row - 185) / 141) * (1 - 0.26 * smooth((row - 389) / 65))
                return [
                    -x - exterior - wide * 0.94 * sn,
                    row,
                    SIDE_AXIS - side + deep * (0.28 * sn + 0.96 * cs),
                ]

            def anterior_ink(p, u, t):
                sn, cs = ring(u)
                y = p[1]
                sides = np.array(
                    [
                        (188, 217, 234),
                        (210, 163, 218),
                        (250, 128, 200),
                        (303, 111, 181),
                        (355, 111, 164),
                        (400, 123, 169),
                        (440, 140, 169),
                        (461, 160, 164),
                    ]
                )
                near, far = atrow(sides, y)
                return [
                    float(np.interp(y, [188, 235, 300, 363, 428, 461], [404, 367, 322, 300, 270, 260]))
                    + 14 * sn,
                    y,
                    near + (far - near) * (0.50 - 0.45 * cs),
                    0.78,
                ]

            grid(
                'Anterior temple leaf' + suffix,
                20,
                32,
                anterior,
                fit,
                BONE,
                'maquette_fringe',
                cyclic=True,
                reverse=True,
                group=GROUP,
                material=MAT,
                uvsize=(187, 287),
                project=anterior_ink,
            )
    cap_profile = [
        (167, 2, 276, 280),
        (177, 38, 246, 311),
        (189, 75, 211, 353),
        (209, 101, 186, 386),
        (241, 121, 173, 419),
        (280, 137, 170, 448),
        (322, 147, 174, 470),
        (367, 149, 193, 480),
        (405, 140, 211, 473),
        (445, 125, 248, 454),
        (473, 101, 285, 431),
        (494, 63, 318, 399),
        (506, 2, 339, 375),
    ]

    def crown(u, t):
        sn, cs = ring(u)
        end = 504 - 24 * (1 + cs) - 192 * max(cs, 0) ** 2.1
        end += (
            13.5 * math.exp(-((sn / 0.19) ** 2)) * max(0, cs) ** 4
            - 6.2 * math.exp(-(((abs(sn) - 0.28) / 0.14) ** 2)) * max(0, cs) ** 5
        )
        row = 167 + (end - 167) * t
        width, front, rear = atrow(cap_profile, row)
        x = sn * width
        phase = row + (0.28 + 0.17 * t) * abs(x) + 0.0017 * x * x
        fold = 0
        for level in (191, 217, 246, 279, 317, 360, 406, 450, 491):
            fold += 4.8 * math.exp(-(((phase - level + 12) / 10) ** 2)) - 3.9 * math.exp(
                -(((phase - level) / 4.3) ** 2)
            )
        fade = math.sin(pi * t) ** 0.63 * smooth((0.5 - cs) / 0.8)
        part = 2.8 * math.exp(-((x / 4.6) ** 2)) * math.sin(pi * t)
        rr = fold * fade - part
        depth = SIDE_AXIS - (front + rear) * 0.5 + cs * (rear - front) * 0.5
        front_blend = smooth((cs + 0.12) / 0.79)
        # The combed cap runs beneath the face-framing sheets around the temples.
        x *= 1 - 0.22 * front_blend
        depth -= 49 * front_blend * smooth((row - 207) / 90)
        depth += (
            front_blend
            * (6.1 * math.exp(-(((abs(x) - 19) / 15) ** 2)) - 4.5 * math.exp(-((x / 4.5) ** 2)))
            * smooth((row - 181) / 46)
        )
        # The central cap runs beneath the paired frontal sections at the part.
        depth -= 21.0 * front_blend * smooth((row - 169) / 39) * (1 - smooth((row - 248) / 66))
        row += 5.0 * front_blend * np.exp(-(((row - 202) / 45) ** 2))
        return [x + rr * sn, row, depth + rr * cs]

    grid(
        'Central part and combed chevron',
        78,
        41,
        crown,
        fit,
        BONE,
        'maquette_crown',
        cyclic=True,
        material=MAT,
        group=GROUP,
        uvsize=(780, 460),
        project=hair_projection,
    )

    # At the nape the short underfur peeks out from below the swept blonde cap.
    from surface import sweep

    tufts = [
        (0, 466, 0, 523, 416, 387),
        (-27, 466, -17, 514, 416, 390),
        (27, 466, 18, 515, 416, 390),
        (-53, 458, -40, 508, 421, 398),
        (53, 458, 40, 508, 421, 398),
        (-81, 448, -68, 495, 423, 405),
        (81, 448, 68, 495, 423, 405),
        (-98, 436, -84, 480, 426, 414),
        (98, 436, 84, 480, 426, 414),
    ]
    for i, (root_x, root, tip_x, tip, root_side, tip_side) in enumerate(tufts):
        guides = [
            [root_x, root, SIDE_AXIS - root_side, 8, 5],
            [0.67 * root_x + 0.33 * tip_x, root + 13, SIDE_AXIS - root_side - 1, 15, 8],
            [0.25 * root_x + 0.75 * tip_x, tip - 16, SIDE_AXIS - (0.5 * root_side + 0.5 * tip_side), 11, 6.5],
            [tip_x, tip, SIDE_AXIS - tip_side, 0.24, 0.24],
        ]
        sweep(
            'Short nape tuft %02d' % (i + 1),
            guides,
            10,
            10,
            fit,
            BONE,
            'nape_fur',
            group=GROUP,
            uvsize=(48, 45),
        )
