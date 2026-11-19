import math
import pickle
import numpy as np
from PIL import Image
from surface import ART, clamp, parts, pi, smooth


def bake_character(work):
    # Bake two-view color to a UV atlas. Padded pigment plates prevent the background crossing a UV island.
    A = np.asarray(Image.open(ART / 'turnaround.png').convert('RGB'), dtype=np.float32) / 255
    H = np.asarray(Image.open(ART / 'head-study.png').convert('RGB'), dtype=np.float32) / 255

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
    plates['face'] = extend(H, mask & ~makeup)

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
        'brow': (67, 38, 24),
        'lash': (36, 18, 28),
        'espresso': (49, 34, 42),
        'mouth': (79, 29, 40),
        'teeth': (252, 231, 201),
        'tongue': (217, 112, 117),
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
        arr = np.array(
            [
                np.asarray(
                    Image.fromarray(part['proj'][:, :, k].astype('float32')).resize(
                        (w, h), Image.Resampling.BILINEAR
                    )
                )
                for k in range(4)
            ]
        )
        x, v, cs, d = arr
        kind = part['paint']
        n = np.zeros_like(U)
        grain = np.sin(2 * pi * (U * w * 0.18 + np.sin(V * h * 0.16) * 0.35)) * np.cos(V * h * 1.43)

        def lin(t):
            return t[:, :, None]

        if kind in ('face', 'lid', 'ear'):
            im = plates['ear' if kind == 'ear' else 'face']
            front = sample(im, 500 + x, v)
            prof = sample(im, 1370 - d, v)
            b = smooth((np.abs(x) / 224 - 0.63) / 0.36) * 0.55 if kind == 'face' else np.zeros_like(x)
            if kind == 'face':
                b = np.maximum(b, smooth((0.4 - cs) / 0.64))
            if kind == 'ear':
                c = ramp((226, 117, 18), (254, 162, 32), clamp(1 - V * 0.57))
                front = front * lin(smooth((cs + 0.08) / 0.55)) + c * lin(1 - smooth((cs + 0.08) / 0.55))
            if kind == 'lid':
                # Eyelid pigment is orange all the way to the moving lash.
                front = sample(im, 500 + x, v)
            col = front * (1 - lin(b)) + prof * lin(b)
            n = 0.13 * grain
        elif kind in ('body', 'hair', 'pant', 'pocket', 'arm'):
            im = plates[{'body': 'turn', 'pocket': 'pant'}.get(kind, kind)]
            front = sample(im, 428 + x, v)
            back = sample(im, 1107 - x, v + 1)
            f = smooth((cs + 0.34) / 0.68)
            col = front * lin(f) + back * (1 - lin(f))
            if kind == 'hair':
                stripe = np.cos(2 * pi * (U * 4.1 + 0.14 * np.sin(pi * V))) + 0.26 * np.cos(
                    2 * pi * (U * 14 + 0.19 * np.sin(2 * pi * V))
                )
                strand = clamp(0.53 + 0.22 * stripe + 0.12 * np.sin(pi * V) - 0.15 * np.exp(-V * 5))
                base = ramp((207, 129, 52), (255, 220, 149), strand)
                groove = (
                    np.exp(-(((np.sin(pi * (U * 5.0 + 0.18 * np.sin(pi * V)))) / 0.21) ** 2))
                    * np.sin(np.pi * V) ** 0.54
                )
                col = (
                    col * 0.42
                    + base * 0.58
                    + lin(0.010 * stripe)
                    - lin(groove) * np.array([0.042, 0.074, 0.081])
                )
                n = 0.90 * stripe - 0.52 * groove + 0.13 * grain
            elif kind in ('pant', 'pocket'):
                col = col * 0.84 + np.array([172, 108, 215]) / 255 * 0.16
                if kind == 'pocket':
                    col = col * 0.78 + np.array([175, 113, 211]) / 255 * 0.22
                n = 0.24 * grain + 0.06 * np.sin(3 * pi * V)
            elif kind == 'arm':
                col = col * 0.34 + np.array([245, 135, 23]) / 255 * 0.66
                n = 0.10 * grain
            else:
                n = 0.15 * grain
        elif kind == 'nape':
            col = sample(plates['hair'], 1107 - x, v) * 0.80 + np.array([242, 180, 91]) / 255 * 0.20
            n = 0.49 * np.cos(2 * pi * (U * 9 + 2.2 * V * np.sign(U - 0.5))) + 0.10 * grain
        elif kind == 'eyeball':
            px = (abs(x) - 104) / 41
            py = (v - 553) / 46
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
            mask = 1 - smooth((rad - 0.99) / 0.025)
            col = iris * lin(mask) + sclera * lin(1 - mask)
            for cx, cy, radius in [(-0.19, -0.065, 0.152), (0.27, 0.065, 0.069)]:
                dot = 1 - smooth((np.hypot(px - cx, py - cy) - radius) / 0.024)
                col = col * (1 - lin(dot)) + lin(dot) * 0.998
        elif kind == 'sclera':
            col = ramp((228, 207, 213), (255, 248, 239), smooth(0.25 + np.sin(pi * U) * 0.55 + V * 0.28))
        else:
            base = np.array(colors[kind]) / 255
            col = np.broadcast_to(base, (*U.shape, 3)).copy()
            shade = 0.025 * np.sin(pi * V) + 0.007 * grain
            if kind == 'shell':
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
                shade += 0.018 * np.sin(pi * V)
                n = 0.24 * grain
            col += lin(shade)
        col = np.uint8(clamp(col) * 255 + 0.5)
        gy, gx = np.gradient(n)
        vec = np.stack([-gx * 0.29, gy * 0.29, np.ones_like(gx)], axis=-1)
        vec /= np.linalg.norm(vec, axis=-1, keepdims=True)
        normal = np.uint8((vec * 0.5 + 0.5) * 255 + 0.5)
        return col, normal

    # Pack charts with a replicated border and uniform texel density on the hero features.
    W = 2048
    pad = 5
    xx = 0
    yy = 0
    row = 0
    for p in sorted(parts, key=lambda p: -p['uvsize'][1]):
        w, h = p['uvsize']
        if xx + w + pad * 2 > W:
            xx = 0
            yy += row
            row = 0
        p['rect'] = (xx + pad, yy + pad, w, h)
        xx += w + 2 * pad
        row = max(row, h + 2 * pad)
    Hh = 2 ** math.ceil(math.log2(yy + row))
    canvas = np.full((Hh, W, 3), 170, dtype=np.uint8)
    normal = np.full_like(canvas, (128, 128, 255))
    for p in parts:
        x, y, w, h = p['rect']
        color, bump = texture(p)
        for dest, img in [(canvas, color), (normal, bump)]:
            dest[y - pad : y + h + pad, x - pad : x + w + pad] = np.pad(
                img, [(pad, pad), (pad, pad), (0, 0)], mode='edge'
            )
        del p['proj']
        p['weights'] = [
            {k: float(v) / sum(ww.values()) for k, v in ww.items() if v > 1e-8} for ww in p['weights']
        ]
    Image.fromarray(canvas).save(work / 'pigment.png', optimize=True)
    Image.fromarray(normal).save(work / 'relief.png', optimize=True)
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
