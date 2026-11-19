import math
import pickle
import numpy as np
from PIL import Image
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
        'brow': (57, 34, 24),
        'lash': (36, 18, 28),
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
        'nose': (59, 39, 29),
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

        if kind in ('face', 'lid', 'ear'):
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
                # Neutralise the study's baked orbital shadows before the game
                # lights the rebuilt lids, nose bridge and cheek volumes.
                warm = ramp(
                    (222, 108, 26), (255, 154, 41), clamp(0.45 + 0.32 * cs + 0.075 * np.sin((v - 400) / 115))
                )
                tone = 0.69 * smooth((715 - v) / 82)
                col = col * (1 - lin(tone)) + warm * lin(tone)
                start = 621 + 19 * np.exp(-((x / 47) ** 2)) + 18 * (abs(x) / 174) ** 2
                muzzle = smooth((v - start) / 22) * smooth((205 - abs(x)) / 43) * smooth((d - 81) / 88)
                cream = ramp((230, 157, 93), (255, 214, 155), clamp(0.55 + 0.29 * cs - 0.15 * (v - 671) / 101))
                col = col * (1 - lin(0.76 * muzzle)) + cream * lin(0.76 * muzzle)
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
                xyz = part['points'].reshape(part['nv'] + 1, part['nu'] + 1, 3)
                model = sample(xyz, U * part['nu'], V * part['nv']).transpose(2, 0, 1)
                lateral, y, z = np.abs(model[0]), model[1], model[2]
                guide = np.array(body_y)[::-1]
                level = np.interp(y, guide[:, 1], guide[:, 0])
                front_face = smooth((z + 0.045) / 0.09)

                def boundary(lateral):
                    neck = (
                        331 + 19 * front_face - (26 + 20 * front_face) * np.minimum(lateral / 0.122, 1) ** 1.9
                    )
                    arm = 302 + 81 * smooth((lateral - 0.149) / 0.060) + 240 * smooth((lateral - 0.205) / 0.040)
                    return np.maximum(neck, arm)

                slope = (boundary(lateral + 0.0005) - boundary(np.maximum(0, lateral - 0.0005))) / 0.001
                edge = (level - boundary(lateral)) / np.hypot(1, slope / 420)
                gy, gx = np.gradient(edge)
                aa = np.maximum(0.65, 0.5 * np.hypot(gx, gy))
                inside = smooth((edge + aa) / (2 * aa))
                trim = inside * (1 - smooth((edge - 3.1) / 1.3))
                upper = smooth((level - 277) / 8) * smooth((405 - level) / 13)
                if kind == 'arm':
                    upper *= 1 - smooth((V - 0.22) / 0.14)
                fabric = ramp(
                    (235, 202, 218),
                    (255, 243, 246),
                    clamp(0.56 + 0.30 * front_face - 0.10 * np.cos(lateral * 21)),
                )
                skin = ramp(
                    (236, 125, 25), (252, 151, 45), clamp(0.40 + 0.31 * front_face + 0.16 * np.sin(pi * V))
                )
                pattern = skin * (1 - lin(inside)) + fabric * lin(inside)
                pattern = pattern * (1 - lin(trim)) + lin(trim) * np.array([240, 79, 151]) / 255
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
            iris = ramp((59, 14, 78), (210, 65, 226), light + fibre)
            iris = iris * lin(rim) + np.array([46, 17, 56]) / 255 * lin(1 - rim)
            pupil = 1 - smooth((np.sqrt((px / 0.48) ** 2 + ((py + 0.10) / 0.61) ** 2) - 0.95) / 0.07)
            iris = iris * (1 - lin(pupil)) + np.array([30, 10, 37]) / 255 * lin(pupil)
            sclera = ramp((228, 215, 223), (255, 249, 242), smooth(0.15 + np.sin(pi * U) * 0.55 + V * 0.28))
            mask = 1 - smooth((rad - 0.988) / 0.015)
            col = iris * lin(mask) + sclera * lin(1 - mask)
            for cx, cy, radius in [(-0.19, -0.065, 0.152), (0.27, 0.065, 0.069)]:
                dot = 1 - smooth((np.hypot(px - cx, py - cy) - radius) / 0.024)
                col = col * (1 - lin(dot)) + lin(dot) * 0.998
        elif kind in ('upper_lip', 'lower_lip'):
            underside = 0.5 + 0.5 * np.sin(2 * pi * V) * (-1 if kind == 'lower_lip' else 1)
            warmth = np.sin(pi * U) ** 0.55
            if kind == 'upper_lip':
                col = ramp((188, 117, 76), (83, 44, 34), 0.19 + 0.70 * warmth * underside)
            else:
                col = ramp((246, 188, 135), (170, 86, 66), 0.15 + 0.62 * warmth * underside**2)
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
