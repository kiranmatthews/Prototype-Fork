import math
import pickle
import numpy as np
from PIL import Image, ImageDraw
from maquette import coordinates
from tank_binding import garment_edge
from surface import ART, body_y, clamp, parts, pi, smooth


def pack(parts, width, padding):
    level = [0] * width
    for p in sorted(parts, key=lambda p: (-max(p['uvsize']), -p['uvsize'][1])):
        w, h = p['uvsize']
        span = w + 2 * padding
        candidates = {0, width - span}
        for i in range(1, width):
            if level[i] != level[i - 1]:
                if i + span <= width:
                    candidates.add(i)
                if i >= span:
                    candidates.add(i - span)

        def fit(x):
            heights = level[x : x + span]
            y = max(heights)
            return y, y * span - sum(heights), x

        y, _, x = min(map(fit, candidates))
        level[x : x + span] = [y + h + 2 * padding] * span
        p['rect'] = (x + padding, y + padding, w, h)
    return max(level)


def bake_character(work):
    # Bake two-view color to a UV atlas. Padded pigment plates prevent the background crossing a UV island.
    A = np.asarray(Image.open(ART / 'turnaround.png').convert('RGB'), dtype=np.float32) / 255
    H = np.asarray(Image.open(ART / 'head-study.png').convert('RGB'), dtype=np.float32) / 255

    fibres = (
        np.asarray(Image.open(ART / 'performance/hair-pigment.webp').convert('RGB'), dtype=np.float32) / 255
    )

    def extend(image, mask):
        sizes = []
        last = np.uint8(clamp(image) * 255)
        valid = np.uint8(mask) * 255
        while min(valid.shape) > 2:
            sizes.append((last, valid))
            small = (max(1, last.shape[1] // 2), max(1, last.shape[0] // 2))
            mask2 = np.asarray(Image.fromarray(valid).resize(small, Image.Resampling.BOX)).astype(float) / 255
            avg = np.asarray(
                Image.fromarray(np.uint8(last * (valid[:, :, None] / 255))).resize(small, Image.Resampling.BOX)
            )
            last = np.uint8(clamp(avg / np.maximum(mask2[:, :, None], 1e-4), 0, 255))
            valid = np.uint8(mask2 > 0) * 255
        for orig, mask in reversed(sizes):
            scaled = np.asarray(
                Image.fromarray(last).resize((orig.shape[1], orig.shape[0]), Image.Resampling.BILINEAR)
            )
            last = np.where(mask[:, :, None] > 0, orig, scaled).astype('uint8')
        return last.astype(np.float32) / 255

    sheet = np.asarray(Image.open(ART / 'likeness/three-view.webp').convert('RGB'), dtype=np.float32) / 255
    views = np.split(sheet, 3, axis=1)
    gold_views = []
    from study_pigment import masks

    for index, reference in enumerate(views):
        red, green, blue = reference.transpose(2, 0, 1)
        hair = (
            (red > 0.42)
            & (green > red * 0.54)
            & (green > blue * 1.13)
            & (red > blue * 1.08)
            & (green < red * 1.02)
        )
        # The orange pinnae and fur are outside the blonde pigment range.
        hair &= (blue > red * 0.24) & ((green - red * 0.53) > 0.045)
        gold_views.append(extend(reference, hair & masks(index, reference)[1]))
    ear_rows = np.array(
        [
            (12, 207, 209),
            (27, 205, 225),
            (55, 205, 258),
            (83, 207, 291),
            (116, 212, 314),
            (150, 223, 337),
            (183, 239, 352),
            (210, 258, 361),
            (237, 284, 355),
            (265, 313, 342),
            (282, 316, 328),
        ]
    )
    er, eg, eb = views[0].transpose(2, 0, 1)
    ear_region = (
        (np.indices(er.shape)[1] < 365)
        & (np.indices(er.shape)[0] < 282)
        & (er > eg * 1.4)
        & (eg > eb * 0.8)
        & (eb < er * 0.47)
    )
    ear_study = extend(views[0], ear_region)

    def soft_mask(contour):
        from PIL import ImageFilter

        im = Image.new('L', (724, 724))
        ImageDraw.Draw(im).polygon(contour, fill=255)
        return (np.asarray(im.filter(ImageFilter.GaussianBlur(2.2)), dtype=np.float32) / 255)[:, :, None]

    cheek_front = soft_mask(
        [
            (336, 464),
            (342, 454),
            (353, 449),
            (367, 447),
            (380, 448),
            (393, 452),
            (408, 455),
            (423, 456),
            (443, 452),
            (458, 456),
            (477, 461),
            (493, 462),
            (514, 467),
            (530, 470),
            (537, 479),
            (532, 493),
            (510, 515),
            (486, 535),
            (456, 545),
            (431, 537),
            (392, 521),
            (366, 509),
            (346, 493),
            (337, 477),
        ]
    )
    cheek_side = soft_mask(
        [
            (155, 464),
            (163, 458),
            (177, 452),
            (189, 453),
            (201, 456),
            (212, 452),
            (228, 446),
            (241, 446),
            (252, 451),
            (265, 464),
            (275, 481),
            (280, 499),
            (277, 514),
            (266, 525),
            (223, 538),
            (208, 535),
            (191, 524),
            (179, 515),
            (177, 506),
            (163, 499),
            (156, 489),
            (152, 479),
        ]
    )
    muzzle_plates = []
    for panel, contour in [
        (
            views[0],
            [
                (468, 292),
                (495, 294),
                (530, 325),
                (550, 365),
                (556, 438),
                (561, 465),
                (549, 494),
                (493, 532),
                (455, 543),
                (420, 532),
                (376, 515),
                (316, 489),
                (272, 455),
                (294, 425),
                (316, 382),
                (352, 342),
                (397, 312),
            ],
        ),
        (
            views[2],
            [
                (195, 279),
                (229, 296),
                (253, 366),
                (271, 417),
                (296, 474),
                (301, 496),
                (272, 524),
                (218, 537),
                (193, 532),
                (175, 514),
                (154, 498),
                (149, 473),
                (158, 446),
                (177, 438),
                (175, 385),
                (176, 327),
            ],
        ),
    ]:
        mask = Image.new('1', (panel.shape[1], panel.shape[0]))
        ImageDraw.Draw(mask).polygon(contour, fill=1)
        rr, gg, bb = panel.transpose(2, 0, 1)
        yy = np.indices(rr.shape)[0]
        pigment = (
            np.asarray(mask)
            & (rr > 0.42)
            & (rr > gg * 1.12)
            & (gg > bb * 1.35)
            & ((bb < 0.32 * rr) | (yy > 445))
        )
        muzzle_plates.append(extend(panel, pigment))
    R, G, B = A.transpose(2, 0, 1)
    hr, hg, hb = H.transpose(2, 0, 1)
    plates = {
        'turn': A,
        'hair': extend(A, (R > G * 0.99) & (G > B * 1.095) & (R > 0.52) & (G > R * 0.63)),
        'arm': extend(A, (R > G * 1.15) & (G > B * 1.35) & (R > 0.45)),
        'pant': extend(A, (B > G * 1.17) & (B > R * 0.99) & (R > 0.26)),
        'face': extend(H, (hr > hg * 1.025) & (hg > hb * 1.09) & (hr > 0.46) & (hg > 0.22)),
        'ear': extend(H, (hr > hg * 1.11) & (hg > hb * 0.91) & (hr > 0.39)),
    }

    # Remove the reference's static makeup and nose shadow where articulated islands cover the face.
    yy, xx = np.indices(H.shape[:2])
    ax = abs(xx - 500)
    mask = (hr > hg * 1.025) & (hg > hb * 1.09) & (hr > 0.46) & (hg > 0.22)
    makeup = (
        ((ax > 36) & (ax < 222) & (yy > 395) & (yy < 496))
        | ((ax > 42) & (ax < 240) & (yy > 469) & (yy < 614))
        | ((ax < 41) & (yy > 621) & (yy < 675))
    )
    seam = 711 - 46 * np.minimum(ax / 109, 1.1) ** 2.15 + 3 * np.sin(np.minimum(ax / 109, 1) * pi)
    lip_ink = (ax < 145) & (np.abs(yy - seam) < 11)
    plates['face'] = extend(H, mask & ~makeup & ~lip_ink)

    def sample(im, x, y):
        x = clamp(x, 0, im.shape[1] - 1.01)
        y = clamp(y, 0, im.shape[0] - 1.01)
        ix = x.astype(int)
        iy = y.astype(int)
        fx = (x - ix)[:, :, None]
        fy = (y - iy)[:, :, None]
        return (im[iy, ix] * (1 - fx) + im[iy, ix + 1] * fx) * (1 - fy) + (
            im[iy + 1, ix] * (1 - fx) + im[iy + 1, ix + 1] * fx
        ) * fy

    def ramp(a, b, t):
        return np.array(a) / 255 * (1 - t[:, :, None]) + np.array(b) / 255 * t[:, :, None]

    colors = {
        'fur': (240, 128, 17),
        'brow': (35, 22, 18),
        'lash': (17, 9, 17),
        'espresso': (49, 34, 42),
        'mouth': (79, 29, 40),
        'enamel': (247, 237, 216),
        'tongue': (234, 112, 128),
        'claw': (245, 201, 153),
        'gunmetal': (75, 65, 83),
        'pocket_edge': (154, 91, 197),
        'cuff': (154, 88, 201),
        'pink': (229, 86, 168),
        'gold': (229, 166, 63),
        'dial': (250, 224, 172),
        'strap': (236, 217, 214),
        'shell': (244, 225, 207),
        'tread': (210, 196, 188),
        'leather': (248, 235, 230),
        'rubber': (238, 224, 218),
        'laces': (254, 245, 237),
        'eyelet': (219, 197, 190),
        'stitch': (228, 209, 201),
        'band': (128, 54, 163),
        'violet_elastic': (107, 34, 133),
        'nose': (45, 29, 21),
    }

    def texture(part):
        w, h = part['uvsize']
        U, V = np.meshgrid(np.linspace(0, 1, w), np.linspace(0, 1, h))
        x, v, cs, d = sample(part['proj'], U * part['nu'], V * part['nv']).transpose(2, 0, 1)
        kind = part['paint']
        n = np.zeros_like(U)
        roughness = np.full_like(
            U,
            {
                'Facial fur': 0.70,
                'Cornea': 0.245,
                'Wet tongue': 0.34,
                'Enamel': 0.32,
                'Gold silk hair': 0.43,
                'Nose leather': 0.43,
                'Metal': 0.31,
                'Shoe leather': 0.51,
                'Rubber': 0.76,
                'Pearl': 0.34,
                'Nail': 0.42,
                'Satin': 0.71,
            }[part['mat']],
        )
        metal = 0.63 if part['mat'] == 'Metal' else 0.0
        grain = np.sin(2 * pi * (U * w * 0.18 + np.sin(V * h * 0.16) * 0.35)) * np.cos(V * h * 1.43)

        def lin(t):
            return t[:, :, None]

        if kind == 'maquette_ear':
            sn = x
            skin = ramp((225, 99, 10), (255, 153, 26), clamp(0.53 + 0.21 * cs + 0.15 * (1 - V)))
            inside = (
                smooth((0.794 - abs(sn)) / 0.112)
                * smooth((V - 0.042) / 0.080)
                * smooth((0.96 - V) / 0.075)
                * smooth((cs + 0.02) / 0.25)
            )
            well = ramp((122, 27, 16), (211, 57, 31), clamp(0.42 + 0.32 * (1 - V) - 0.20 * sn + 0.15 * abs(sn)))
            left = np.interp(v, ear_rows[:, 0], ear_rows[:, 1])
            right = np.interp(v, ear_rows[:, 0], ear_rows[:, 2])
            tex = sample(ear_study, left + (1 - sn) * 0.5 * (right - left), v)
            pigment = skin * (1 - lin(inside)) + well * lin(inside)
            front = smooth((cs - 0.02) / 0.39) * smooth((0.97 - V) / 0.14)
            col = pigment * (1 - lin(front * 0.87)) + tex * lin(front * 0.87)
            n = 0.18 * grain + 0.25 * np.exp(-(((abs(sn) - 0.85) / 0.065) ** 2))
            roughness = 0.68 + 0.035 * grain
        elif kind == 'nape_fur':
            col = ramp((181, 73, 6), (241, 126, 17), clamp(0.31 + 0.36 * V + 0.15 * np.cos(2 * pi * U)))
            n = 0.25 * grain
            roughness = 0.67 + 0.04 * grain
        elif kind == 'violet_elastic':
            cord = np.cos(2 * pi * U * 74 + 0.18 * np.sin(2 * pi * V))
            col = ramp((81, 26, 105), (148, 54, 163), clamp(0.53 + 0.16 * np.cos(2 * pi * V) + 0.027 * cord))
            n = 0.31 * cord + 0.07 * grain
            roughness = 0.39 + 0.037 * cord
        elif kind == 'knit_binding':
            ribs = np.sin(2 * pi * (U * 112 + 0.15 * np.sin(2 * pi * V)))
            edge = np.cos(2 * pi * V)
            col = ramp((184, 53, 133), (246, 118, 190), clamp(0.52 + 0.17 * edge + 0.055 * ribs))
            n = 0.22 * ribs + 0.12 * grain
            roughness = 0.65 + 0.033 * grain
        elif kind == 'maquette_shell':
            center = 0.50 + 0.012 * np.sin(2 * pi * U)
            groove = np.exp(-(((V - center) / 0.023) ** 2))
            col = ramp(
                (222, 195, 188),
                (254, 244, 232),
                clamp(0.60 + 0.21 * np.cos(2 * pi * U) + 0.10 * np.sin(pi * V)),
            )
            col *= lin(1 - 0.18 * groove)
            n = -1.1 * groove + 0.08 * grain
            roughness = 0.315 + 0.08 * groove
        elif kind.startswith('maquette_'):
            if kind == 'maquette_fringe':
                front = sample(gold_views[0], x, v)
                side = sample(gold_views[2], cs, v)
                col = front * (1 - lin(d)) + side * lin(d)
            else:
                rear = sample(gold_views[1], x, v)
                side = sample(gold_views[2], d, v)
                side_weight = clamp(cs)
                col = rear * (1 - lin(side_weight)) + side * lin(side_weight)
                if kind == 'maquette_crown':
                    anterior = smooth((np.cos(2 * pi * U) - 0.06) / 0.64)
                    front = sample(gold_views[0], 400 - 0.899 * (372 - x) + 0.438 * (330 - d), v)
                    col = col * (1 - lin(anterior)) + front * lin(anterior)
            lum = col @ np.array([0.23, 0.64, 0.13])
            f = sample(
                fibres,
                (0.12 + 0.72 * U + 0.025 * np.sin(pi * V)) * (fibres.shape[1] - 1),
                (0.07 + 0.85 * V) * (fibres.shape[0] - 1),
            )
            # Retain the drawing's honey valleys and the broad direction of its
            # specular ribbons; add the separate strand plate at the fine scale.
            col = col * 0.89 + f * 0.11
            col *= np.array([0.985, 0.955, 0.92])
            flow = U + 0.071 * np.sin(pi * V) + 0.023 * np.sin(2 * pi * V + U * 4)
            strand = np.sin(2 * pi * flow * 51 + 0.45 * np.sin(2 * pi * (7 * U + 0.23 * V)))
            strand += 0.39 * np.sin(2 * pi * (flow * 81 + 0.4 * V))
            n = 4.4 * (lum - 0.62) + 0.65 * (f @ np.array([0.23, 0.64, 0.13]) - 0.65) + 0.24 * strand
            col *= lin(1 + 0.009 * strand)
            roughness = 0.40 + 0.085 * (1 - lum)
        elif kind in ('face', 'lid', 'ear'):
            is_face = kind == 'face' or part['name'].startswith('Orbital skin')
            im = plates['ear' if kind == 'ear' else 'face']
            front = sample(im, 500 + x, v)
            prof = sample(im, 1370 - d, v)
            b = smooth((np.abs(x) / 224 - 0.63) / 0.36) * 0.55 if is_face else np.zeros_like(x)
            if is_face:
                b = np.maximum(b, smooth((0.4 - cs) / 0.64))
            if kind == 'ear':
                c = ramp((226, 117, 18), (254, 162, 32), clamp(1 - V * 0.57))
                front = front * lin(smooth((cs + 0.08) / 0.55)) + c * lin(1 - smooth((cs + 0.08) / 0.55))
            if kind == 'lid':
                # Eyelid pigment is orange all the way to the moving lash.
                front = sample(im, 500 + x, v)
            col = front * (1 - lin(b)) + prof * lin(b)
            if is_face:
                xyz = part['points'].reshape(part['nv'] + 1, part['nu'] + 1, 3)
                X, Y, D = coordinates(sample(xyz, U * part['nu'], V * part['nv'])).transpose(2, 0, 1)
                ax = abs(X)
                front = sample(
                    muzzle_plates[0], 400 - 0.899 * ax + 0.438 * D, Y + 0.061 * (0.438 * ax + 0.899 * D)
                )
                profile = sample(muzzle_plates[1], 330 - D, Y)
                side = smooth((ax - 65) / 88) * 0.68
                study = front * (1 - lin(side)) + profile * lin(side)
                orange = ramp((205, 80, 7), (247, 125, 12), clamp(0.65 + 0.24 * cs + 0.065 * np.cos(X * 0.030)))
                cream = ramp((234, 158, 85), (255, 210, 145), clamp(0.60 + 0.29 * cs - 0.09 * (Y - 479) / 52))
                start = np.interp(
                    ax,
                    [0, 18, 39, 58, 77, 92, 102, 116, 129, 144, 160],
                    [455, 452, 449, 447, 444, 441, 442, 450, 467, 498, 530],
                )
                edge = 0.39 * np.sin(X * 1.19 + 0.42 * np.sin(Y * 1.71)) + 0.28 * np.sin(X * 0.54 + Y * 0.73)
                muzzle = smooth((Y - start + edge) / 5.2) * smooth((127 - ax) / 20) * smooth((D - 16) / 39)
                observed_front = sample(
                    cheek_front, 400 - 0.899 * ax + 0.438 * D, Y + 0.061 * (0.438 * ax + 0.899 * D)
                )[:, :, 0]
                observed_side = sample(cheek_side, 330 - D, Y)[:, :, 0]
                anatomy = observed_front * (1 - side) + observed_side * side
                muzzle = 0.29 * muzzle + 0.71 * anatomy * smooth((D - 15) / 35)
                orange = orange * 0.77 + np.minimum(study, orange * 1.10) * 0.23
                cream = cream * 0.76 + np.maximum(study, cream * 0.81) * 0.24
                cleft = np.exp(-((X / 2.8) ** 2)) * smooth((Y - 476) / 7) * smooth((506 - Y) / 6)
                soft = np.exp(-((X / 7.2) ** 2) - ((Y - 491) / 13) ** 2)
                cream *= lin(1 - 0.22 * cleft - 0.072 * soft)
                col = orange * (1 - lin(muzzle)) + cream * lin(muzzle)
                if kind == 'lid':
                    # Pigment at the mobile eyelid maintains the sculpted hood
                    # and its crease through full blinks and widened expressions.
                    ap = np.interp(
                        np.clip((abs(x) - 50) / 128, 0, 1),
                        [0, 0.10, 0.22, 0.40, 0.60, 0.80, 0.95, 1],
                        [591, 566, 544, 527, 520, 519, 523, 530],
                    )
                    across = smooth((abs(x) - 53) / 27) * smooth((184 - abs(x)) / 29)
                    dist = ap - v
                    col *= lin(
                        1
                        + across
                        * (
                            0.043 * np.exp(-(((dist - 12) / 10) ** 2))
                            - 0.16 * np.exp(-(((dist - 28) / 5.5) ** 2))
                        )
                    )
            n = 0.13 * grain
        elif kind in ('body', 'hair', 'pant', 'pocket', 'arm'):
            im = plates[{'body': 'turn', 'pocket': 'pant'}.get(kind, kind)]
            front = sample(im, 428 + x, v)
            back = sample(im, 1107 - x, v + 1)
            f = smooth((cs + 0.34) / 0.68)
            col = front * lin(f) + back * (1 - lin(f))
            if kind == 'hair':
                # Longitudinal fibres follow each lock's own UV chart. Their
                # direction turns with the section and is stable while swinging.
                offset = (sum(ord(c) for c in part['name']) % 53) / 67
                flow = U + 0.035 * np.sin(pi * V) + 0.009 * np.sin(pi * V * 2 + offset * 5)
                tx = (0.08 + np.mod(0.74 * flow + offset, 0.85)) * (fibres.shape[1] - 1)
                ty = (0.035 + 0.91 * V) * (fibres.shape[0] - 1)
                gold = sample(fibres, tx, ty)
                lum = gold @ np.array([0.23, 0.64, 0.13])
                broad = np.cos(2 * pi * (2 * flow + 0.16 * np.sin(pi * V + offset * 3)))
                edge = np.exp(-((np.sin(pi * (2 * flow + 0.18 * np.sin(pi * V + offset * 3))) / 0.24) ** 2))
                warmth = clamp(0.46 + 0.24 * np.sin(pi * V) - 0.10 * edge + 0.085 * broad)
                under = ramp((190, 119, 55), (255, 220, 148), warmth)
                col = 0.70 * gold + 0.22 * under + 0.08 * col
                col *= lin(0.96 + 0.04 * np.sin(pi * V) ** 0.6 - 0.035 * edge)
                n = 0.56 * broad - 0.40 * edge + 3.5 * (lum - 0.62)
                roughness = 0.38 + 0.065 * (1 - lum) + 0.024 * edge
            elif kind in ('pant', 'pocket'):
                col = col * 0.84 + np.array([172, 108, 215]) / 255 * 0.16
                if kind == 'pocket':
                    col = col * 0.78 + np.array([175, 113, 211]) / 255 * 0.22
                n = 0.34 * grain + 0.06 * np.sin(3 * pi * V)
                roughness = 0.78 + 0.035 * grain
            elif kind == 'arm':
                col = col * 0.34 + np.array([245, 135, 23]) / 255 * 0.66
                n = 0.10 * grain
            if kind in ('arm', 'body'):
                # Cut the front, rear and two shoulder straps in common model
                # space. The fabric crosses the welded shoulder UV seam.
                xyz = part.get('tank_pattern', part['points']).reshape(part['nv'] + 1, part['nu'] + 1, 3)
                model = sample(xyz, U * part['nu'], V * part['nv']).transpose(2, 0, 1)
                lateral, y, z = np.abs(model[0]), model[1], model[2]
                guide = np.array(body_y)[::-1]
                level = np.interp(y, guide[:, 1], guide[:, 0])
                front_face = smooth((z + 0.045) / 0.09)

                if 'garment_field' in part:
                    edge = sample(part['garment_field'][:, :, None], U * part['nu'], V * part['nv'])[:, :, 0]
                else:
                    edge = garment_edge(model.transpose(1, 2, 0), V if kind == 'arm' else None)
                gy, gx = np.gradient(edge)
                aa = np.maximum(0.65, 0.5 * np.hypot(gx, gy))
                inside = smooth((edge + aa) / (2 * aa))
                trim = 1 - smooth((abs(edge) - 1.35) / 2.1)
                upper = smooth((level - 277) / 8) * smooth((405 - level) / 13)
                if kind == 'arm':
                    upper *= 1 - smooth((V - 0.22) / 0.14)
                fabric = ramp(
                    (221, 195, 199),
                    (254, 240, 235),
                    clamp(0.56 + 0.30 * front_face - 0.10 * np.cos(lateral * 21)),
                )
                skin = ramp(
                    (214, 90, 7), (249, 124, 15), clamp(0.40 + 0.31 * front_face + 0.16 * np.sin(pi * V))
                )
                pattern = skin * (1 - lin(inside)) + fabric * lin(inside)
                # The separate knit tube supplies the pink at the cut edge.
                col = col * (1 - lin(upper)) + pattern * lin(upper)
                n = 0.15 * grain + upper * (
                    1.65 * np.exp(-(((edge - 1.55) / 1.8) ** 2)) + 0.22 * inside * grain
                )
                roughness = 0.68 + 0.028 * grain + upper * inside * 0.10 - upper * trim * 0.095
        elif kind == 'nape':
            h = 2 * U - 1
            sweep = 3.8 * V + 0.84 * abs(h) ** 1.45 + 0.30 * V * abs(h)
            phase = 2 * pi * sweep
            cut = np.exp(-((np.sin(phase * 0.5) / 0.31) ** 2))
            weave = np.mod(0.12 + 0.24 * sweep, 0.83) * (fibres.shape[1] - 1)
            gold = sample(fibres, weave, (0.08 + 0.82 * abs(h)) * (fibres.shape[0] - 1))
            shaded = sample(plates['hair'], 1107 - x, v)
            col = (0.79 * gold + 0.21 * shaded) * lin(0.97 + 0.035 * np.cos(phase) - 0.058 * cut)
            n = 0.64 * np.cos(phase) - 0.51 * cut + 2.8 * (gold @ np.array([0.23, 0.64, 0.13]) - 0.62)
            roughness = 0.415 + 0.035 * cut
        elif kind == 'iris':
            px, py = x, v
            rad = np.sqrt(px * px + py * py)
            theta = np.arctan2(px, py)
            rim = 1 - smooth((rad - 0.81) / 0.18)
            light = smooth((py + 0.65) / 1.61)
            fibre = (np.sin(theta * 73 + rad * 3) + np.sin(theta * 117 - rad * 5)) * 0.021 * rad
            iris = ramp((37, 5, 55), (215, 57, 229), light + fibre)
            iris = iris * lin(rim) + np.array([46, 17, 56]) / 255 * lin(1 - rim)
            pupil = 1 - smooth((np.sqrt((px / 0.48) ** 2 + ((py + 0.10) / 0.61) ** 2) - 0.95) / 0.07)
            iris = iris * (1 - lin(pupil)) + np.array([13, 3, 17]) / 255 * lin(pupil)
            sclera = ramp((228, 215, 223), (255, 249, 242), smooth(0.15 + np.sin(pi * U) * 0.55 + V * 0.28))
            mask = 1 - smooth((rad - 0.988) / 0.015)
            col = iris * lin(mask) + sclera * lin(1 - mask)
            for cx, cy, radius in [(-0.30, -0.35, 0.130), (0.21, -0.17, 0.088)]:
                dot = 1 - smooth((np.hypot(px - cx, py - cy) - radius) / 0.024)
                col = col * (1 - lin(dot)) + lin(dot) * 0.998
        elif kind in ('upper_lip', 'lower_lip'):
            underside = 0.5 + 0.5 * np.sin(2 * pi * V) * (-1 if kind == 'lower_lip' else 1)
            warmth = np.sin(pi * U) ** 0.55
            if kind == 'upper_lip':
                col = ramp((200, 132, 77), (75, 35, 26), 0.12 + 0.76 * warmth * underside)
            else:
                col = ramp((246, 188, 135), (170, 86, 66), 0.15 + 0.62 * warmth * underside**2)
            if kind == 'lower_lip':
                vermilion = np.exp(-(((U - 0.5) / 0.18) ** 4)) * (0.43 + 0.30 * underside)
                col = col * (1 - lin(vermilion)) + np.array([226, 100, 82]) / 255 * lin(vermilion)
            n = 0.11 * grain
        elif kind == 'sclera':
            col = ramp((228, 207, 213), (255, 248, 239), smooth(0.25 + np.sin(pi * U) * 0.55 + V * 0.28))
        else:
            base = np.array(colors[kind]) / 255
            col = np.broadcast_to(base, (*U.shape, 3)).copy()
            shade = 0.025 * np.sin(pi * V) + 0.007 * grain
            if kind == 'mouth':
                shade -= 0.092 * np.sin(pi * V) * np.sin(pi * U)
                shade += 0.027 * ((2 * U - 1) ** 2 + V**3)
            elif kind == 'enamel':
                gum = V if part['tooth'] == 'lower' else 1 - V
                shade += 0.018 * np.sin(pi * V) - 0.048 * gum**3
                n = 0.07 * grain
                roughness = 0.27 + 0.07 * gum
            elif kind == 'tongue':
                shade -= (
                    0.098
                    * (np.exp(-((np.sin(2 * pi * U) / 0.09) ** 2)) * np.maximum(0, np.cos(2 * pi * U)))
                    * np.sin(pi * V) ** 0.7
                )
                shade += 0.055 * np.sin(pi * U) + 0.012 * grain
                n = 0.29 * grain - 0.35 * np.exp(-(((U - 0.5) / 0.028) ** 2))
            elif kind == 'shell':
                shade += (
                    0.065 * np.cos(2 * pi * U)
                    - 0.14 * np.exp(-(((np.sin(2 * pi * U) - 0.09) / 0.11) ** 2)) * np.sin(pi * V) ** 4
                )
            if kind in ('band', 'strap', 'cuff'):
                n = 0.52 * np.sin(2 * pi * (U * (18 if kind == 'cuff' else 12) + 0.5 * V)) + 0.20 * grain
                shade += 0.024 * n
            elif kind in ('leather', 'rubber', 'laces'):
                n = 0.20 * grain
                shade += 0.014 * np.sin(U * pi)
            elif kind == 'tread':
                n = np.sin(U * 2 * pi * 20 + np.sin(V * 18))
                shade += 0.036 * n
            elif kind == 'brow':
                shade += 0.026 * np.cos(3 * pi * U) * np.sin(pi * V)
                n = 0.18 * grain
            elif kind == 'nose':
                pit = (
                    np.exp(-(((abs(x) - 22) / 8.2) ** 2) - ((v - 651 - 0.20 * (abs(x) - 22)) / 4.6) ** 2)
                    * np.maximum(cs, 0) ** 0.52
                )
                shade += 0.015 * np.sin(pi * V) - 0.108 * pit
                n = 0.24 * grain - 0.64 * pit
                roughness = 0.39 + 0.08 * pit + 0.03 * grain
            col += lin(shade)
        if part.get('skin_sheet'):
            # Air spreads the cream underfur over the cheek. Store the pale
            # albedo in the map and the resting undertone in the vertex colours.
            # Both the Blender shader and the GLB morph blend the same pigments.
            mask = (
                smooth((abs(x) - 22) / 45)
                * smooth((v - 592) / 38)
                * smooth((774 - v) / 34)
                * smooth((d + 5) / 138)
            )
            cream = ramp((236, 167, 110), (255, 213, 156), clamp(0.48 + 0.32 * cs - 0.14 * (v - 670) / 103))
            lifted = np.maximum(col, col * (1 - lin(0.94 * mask)) + cream * lin(0.94 * mask))

            def linear(c):
                return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

            ratio = clamp(linear(clamp(col)) / np.maximum(0.001, linear(clamp(lifted))))
            gu, gv = np.meshgrid(np.linspace(0, w - 1, part['nu'] + 1), np.linspace(0, h - 1, part['nv'] + 1))
            part['undertone'] = sample(ratio, gu, gv).reshape(-1, 3)
            col = lifted
        col = np.uint8(clamp(col) * 255 + 0.5)
        gy, gx = np.gradient(n)
        vec = np.stack([-gx * 0.29, gy * 0.29, np.ones_like(gx)], axis=-1)
        vec /= np.linalg.norm(vec, axis=-1, keepdims=True)
        normal = np.uint8((vec * 0.5 + 0.5) * 255 + 0.5)
        response = np.stack(
            [np.ones_like(U), np.broadcast_to(clamp(roughness), U.shape), np.broadcast_to(metal, U.shape)],
            axis=-1,
        )
        return col, normal, np.uint8(response * 255 + 0.5)

    # Pack charts with a replicated border and uniform texel density on the hero features.
    W = 4096
    pad = 8
    sizes = {
        'body': (1008, 710),
        'arm': (465, 590),
        'pant': (540, 750),
        'pocket': (208, 205),
        'ear': (425, 540),
        'iris': (304, 250),
        'sclera': (210, 135),
        'enamel': (80, 64),
        'nose': (302, 162),
        'upper_lip': (400, 52),
        'lower_lip': (400, 52),
        'tongue': (288, 120),
        'nape': (502, 462),
        'mouth': (398, 166),
    }
    for p in parts:
        if p['name'] == 'Cranium, muzzle and cheeks':
            p['uvsize'] = (2048, 760)
        elif p['name'] == 'Chin and lower lip':
            p['uvsize'] = (1600, 270)
        elif p['name'].startswith('Orbital skin'):
            p['uvsize'] = (590, 205)
        elif p['paint'] == 'hair':
            p['uvsize'] = tuple(
                round(v * (1.98 if p['name'].startswith(('Ponytail', 'Curtain', 'Parted')) else 1.6))
                for v in p['uvsize']
            )
        elif p['paint'] in sizes:
            p['uvsize'] = sizes[p['paint']]
    # Retain full facial density and a padded 4K by 2K atlas. Chart boundaries
    # are measured at vertex samples. This keeps the tank trim aligned through both armpits.
    for p in parts:
        if p['group'] not in ('Face', 'Eyes'):
            p['uvsize'] = tuple(round(x * 0.95) for x in p['uvsize'])
    extent = pack(parts, W, pad)
    Hh = 2 ** math.ceil(math.log2(extent))
    canvas = np.full((Hh, W, 3), 170, dtype=np.uint8)
    normal = np.full_like(canvas, (128, 128, 255))
    response = np.full_like(canvas, (255, 175, 0))
    for p in parts:
        x, y, w, h = p['rect']
        color, bump, material = texture(p)
        for dest, img in [(canvas, color), (normal, bump), (response, material)]:
            dest[y - pad : y + h + pad, x - pad : x + w + pad] = np.pad(
                img, [(pad, pad), (pad, pad), (0, 0)], mode='edge'
            )
        del p['proj']
        p.pop('tank_pattern', None)
        p.pop('garment_field', None)
        p['weights'] = [
            {k: float(v) / sum(ww.values()) for k, v in ww.items() if v > 1e-8} for ww in p['weights']
        ]
    Image.fromarray(canvas).save(work / 'pigment.png', optimize=True)
    Image.fromarray(normal).save(work / 'relief.png', optimize=True)
    Image.fromarray(response).save(work / 'surface-response.png', optimize=True)
    with (work / 'surface.pickle').open('wb') as f:
        pickle.dump((parts, W, Hh), f, protocol=4)
    print(
        'Sculpt:',
        len(parts),
        'patches,',
        sum(len(p['faces']) * 2 for p in parts),
        'triangles; atlas',
        W,
        Hh,
        flush=True,
    )
