"""Reproject the maquette's local pigment and fibres into visible, corresponding UV islands."""

import argparse
import pickle
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from surface import ART

VIEWS = ('three-quarter', 'rear', 'profile')


def polygon(points):
    mask = Image.new('1', (724, 724))
    ImageDraw.Draw(mask).polygon(points, fill=1)
    return np.array(mask, copy=True)


PORTRAIT = [
    (469, 292),
    (494, 294),
    (533, 325),
    (549, 367),
    (556, 436),
    (561, 465),
    (549, 495),
    (493, 533),
    (455, 543),
    (419, 532),
    (368, 513),
    (313, 489),
    (272, 455),
    (295, 422),
    (317, 381),
    (351, 343),
    (397, 311),
]
PROFILE = [
    (192, 278),
    (228, 296),
    (254, 366),
    (272, 418),
    (296, 474),
    (300, 495),
    (273, 524),
    (218, 537),
    (193, 532),
    (175, 515),
    (153, 498),
    (145, 475),
    (154, 449),
    (177, 436),
    (174, 386),
    (176, 327),
]
SHELLS = [
    [(330, 545), (361, 545), (452, 570), (455, 595), (420, 600), (329, 568)],
    [(305, 551), (438, 551), (441, 583), (306, 585)],
    [(259, 582), (376, 551), (391, 557), (391, 577), (272, 608), (257, 604)],
]
FRONT_EYES = [
    [
        (326, 365),
        (357, 370),
        (390, 378),
        (416, 393),
        (432, 419),
        (435, 444),
        (411, 447),
        (373, 435),
        (346, 417),
        (334, 399),
    ],
    [
        (482, 454),
        (485, 431),
        (505, 407),
        (529, 397),
        (555, 398),
        (573, 394),
        (553, 421),
        (541, 447),
        (523, 460),
        (498, 461),
    ],
]


def masks(view, ref):
    r, g, b = ref.transpose(2, 0, 1)
    y, x = np.indices(r.shape)
    chroma = np.max(ref, axis=2) - np.min(ref, axis=2)
    orange = (r > g * 1.29) & (g > b * 0.90) & (r > 0.37) & (b < r * 0.49)
    gold = (r > g * 0.99) & (r > b * 1.12) & (g > r * 0.53) & (b > r * 0.21) & (chroma > 0.084)
    eyes = np.zeros(r.shape, bool)
    face = np.zeros_like(eyes)
    if view == 0:
        face = polygon(PORTRAIT)
        for contour in FRONT_EYES:
            eyes |= polygon(contour)
        ear = ((x > 195) & (x < 376) | (x > 460) & (x < 626)) & (y < 264) & orange
        skin = face | ((y > 506) & (y < 648) & (x > 320) & (x < 490))
    elif view == 2:
        face = polygon(PROFILE)
        eyes = polygon(
            [
                (180, 390),
                (192, 379),
                (214, 371),
                (234, 370),
                (250, 361),
                (261, 358),
                (245, 399),
                (222, 430),
                (206, 443),
                (193, 435),
            ]
        )
        ear = (x > 287) & (x < 431) & (y < 237) & orange
        skin = face | ((y > 483) & (y < 633) & (x > 279) & (x < 385))
    else:
        ear = (y < 233) & (x > 181) & (x < 570) & orange
        skin = (y > 398) & (x > 221) & (x < 519) & orange
    fur = (
        skin
        & ~eyes
        & (r > 0.39)
        & (g > b * 1.30)
        & ((b < r * 0.46) | ((y > 442) & (r > g * 1.10) & (b < r * 0.76)))
    )
    gold &= ~face & ~ear & (y < 680)
    # The three drawovers include the full blonde range, from honey roots to
    # light-catching ribbons. Surrounding eyes, skin, elastic and backdrop stay out.
    caps = [(x > 221) & (x < 619) & (y < 551), (x > 218) & (x < 526) & (y < 515), (x < 491) & (y < 557)]
    pearl = polygon(SHELLS[view]) & (chroma < 0.22) & (r > 0.48) & (g > 0.39)
    ties = (r > b * 0.56) & (r < b * 1.26) & (b > g * 1.42) & (y < 362)
    nose = np.zeros_like(eyes)
    brow = np.zeros_like(eyes)
    aperture = np.zeros_like(eyes)
    if view == 0:
        nose = polygon([(452, 455), (477, 453), (499, 459), (504, 472), (487, 492), (468, 491), (452, 481)])
        brow = polygon(
            [
                (343, 339),
                (356, 321),
                (384, 315),
                (409, 323),
                (456, 360),
                (462, 380),
                (448, 384),
                (419, 366),
                (386, 343),
                (361, 343),
            ]
        )
        brow |= polygon(
            [
                (493, 389),
                (502, 368),
                (533, 348),
                (553, 347),
                (562, 359),
                (558, 377),
                (541, 371),
                (520, 387),
                (500, 394),
            ]
        )
        aperture = polygon(
            [
                (343, 386),
                (348, 378),
                (360, 375),
                (378, 379),
                (396, 386),
                (413, 396),
                (426, 411),
                (433, 434),
                (432, 442),
                (418, 442),
                (395, 438),
                (373, 430),
                (355, 420),
                (347, 407),
            ]
        )
        aperture |= polygon(
            [
                (486, 452),
                (487, 439),
                (494, 427),
                (503, 417),
                (517, 410),
                (531, 408),
                (548, 409),
                (545, 421),
                (537, 437),
                (527, 448),
                (514, 454),
                (497, 456),
            ]
        )
    if view == 2:
        nose = polygon([(139, 454), (163, 450), (169, 460), (160, 480), (150, 484), (140, 475)])
        brow = polygon(
            [
                (174, 375),
                (171, 354),
                (185, 331),
                (202, 316),
                (221, 312),
                (241, 324),
                (241, 338),
                (217, 330),
                (199, 341),
                (183, 370),
            ]
        )
        aperture = polygon(
            [
                (190, 398),
                (202, 385),
                (219, 378),
                (236, 377),
                (246, 381),
                (242, 401),
                (234, 416),
                (219, 434),
                (207, 439),
                (197, 433),
                (192, 419),
            ]
        )
    brow &= np.max(ref, axis=2) < 0.41
    return {
        1: gold,
        2: gold & caps[view],
        3: fur,
        4: ear,
        7: nose & (r < 0.38) & (g < 0.26),
        6: aperture,
        8: pearl,
        10: brow,
        11: ties,
        13: (g < r * 0.81) & (b > g * 1.23) & (r > 0.50) & (y > 557),
        14: ((orange | (chroma < 0.13) & (r > 0.61)) & (y > 535)),
    }


def deformation(norm, pairs):
    # Thin-plate registration of matching landmarks in each drawing. This only
    # chooses pigment samples. Vertices, silhouette and rig weights stay in 3D.
    if not pairs:
        return norm.copy()
    anchors = np.array(
        [(*p, *p) for p in [(0, 0), (362, 0), (723, 0), (0, 362), (723, 362), (0, 723), (362, 723), (723, 723)]]
    )
    pts = np.vstack([pairs, anchors]) / 724
    a = pts[:, :2]
    displacements = pts[:, 2:] - a

    def kernel(q):
        r2 = np.sum((q[:, None, :] - a[None, :, :]) ** 2, axis=2)
        return r2 * np.log(np.maximum(r2, 1e-10))

    affine = np.column_stack((np.ones(len(a)), a))
    lhs = np.block([[kernel(a) + np.eye(len(a)) * 0.00028, affine], [affine.T, np.zeros((3, 3))]])
    fit = np.linalg.solve(lhs, np.vstack([displacements, np.zeros((3, 2))]))
    moved = []
    q = norm.reshape(-1, 2) / 724
    for chunk in np.array_split(q, 48):
        moved.append((chunk + kernel(chunk) @ fit[:-3] + fit[-3] + chunk @ fit[-2:]) * 724)
    return np.concatenate(moved).reshape(norm.shape)


def blur(a, radius):
    for axis in (0, 1, 0, 1):
        tmp = np.swapaxes(a, 0, axis)
        pad = [(radius + 1, radius), *([(0, 0)] * (tmp.ndim - 1))]
        integral = np.cumsum(np.pad(tmp, pad, mode='edge'), axis=0, dtype=np.float64)
        a = np.swapaxes(
            ((integral[1 + 2 * radius :] - integral[: -1 - 2 * radius]) / (2 * radius + 1)).astype(np.float32),
            0,
            axis,
        )
    return a


def reproject(bake, renders, output, registration):
    import json

    poses = json.loads(registration.read_text())
    maps = np.asarray(Image.open(bake / 'pigment.png').convert('RGB'), dtype=np.float32) / 255
    parts, W, H = pickle.load((bake / 'surface.pickle').open('rb'))
    summed = np.zeros((H * W, 5), np.float32)
    normals = np.asarray(Image.open(bake / 'relief.png').convert('RGB'), dtype=np.float32) / 127.5 - 1
    photos = np.split(
        np.asarray(Image.open(ART / 'likeness/three-view.webp').convert('RGB'), dtype=np.float32) / 255,
        3,
        axis=1,
    )
    yy, xx = np.indices((724, 724))
    coords = np.stack((xx, yy), axis=2)
    stats = {}
    for i, name in enumerate(VIEWS):
        render = np.asarray(Image.open(renders / (name + '.png')).convert('RGBA'), dtype=np.float32) / 255
        uv = np.load(renders / (name + '-coordinates.npz'))['surface']
        codes = uv[:, :, 2] * 16
        group = np.floor(codes).astype(int)
        incidence = np.clip((codes - group - 0.08) / 0.83, 0, 1)
        target = photos[i]
        allowed = masks(i, target)
        moved = np.clip(np.rint(deformation(coords, poses.get(name, []))), 0, 723).astype(int)
        tx, ty = moved.transpose(2, 0, 1)
        donor = target[ty, tx]
        means = (
            np.asarray(
                Image.fromarray((target * 255 + 0.5).astype('uint8')).filter(ImageFilter.GaussianBlur(2.4)),
                dtype=np.float32,
            )
            / 255
        )
        fibre = np.clip(np.log((donor + 0.09) / (means[ty, tx] + 0.09)), -0.12, 0.12)
        valid = (uv[:, :, 3] > 0.993) & (render[:, :, 3] > 0.993)
        stats[name] = {}
        for k, mask in allowed.items():
            if k in (6, 10):
                continue
            keep = valid & (group == k) & mask[ty, tx] & (incidence > 0.25)
            if k == 14:
                skin_native = (render[:, :, 0] > render[:, :, 1] * 1.28) & (
                    render[:, :, 2] < render[:, :, 0] * 0.54
                )
                skin_donor = (donor[:, :, 0] > donor[:, :, 1] * 1.28) & (donor[:, :, 2] < donor[:, :, 0] * 0.54)
                keep &= skin_native == skin_donor
            if not np.any(keep):
                continue
            xxuv = np.clip(np.rint(uv[:, :, 0][keep] * W - 0.5), 0, W - 1).astype(int)
            yyuv = np.clip(np.rint((1 - uv[:, :, 1][keep]) * H - 0.5), 0, H - 1).astype(int)
            ix = yyuv * W + xxuv
            # Inverse lighting from the same PBR render. Limit low frequency
            # correction, retaining some native shading and the editable cheek undertone.
            ratio = np.log((donor[keep] + 0.045) / (render[keep, :3] + 0.045))
            ratio = np.clip(ratio, -0.55, 0.55)
            luminance = ratio @ np.array([0.26, 0.59, 0.15])
            ratio = 0.30 * ratio + 0.70 * luminance[:, None]
            ratio *= {1: 0.82, 2: 0.83, 3: 0.76, 4: 0.79, 7: 0.35, 8: 0.58, 11: 0.74, 13: 0.47, 14: 0.52}[k]
            if k == 3:
                # The orange border beneath the lids and the cream whisker pads
                # have different albedos, even under the same light. Retain that
                # measured chromatic border on the moving fur UVs.
                measured = np.log((donor[keep] + 0.035) / (render[keep, :3] + 0.035))
                measured -= measured[:, :1].copy()
                cheek = np.clip((coords[:, :, 1][keep] - 422) / 22, 0, 1)[:, None]
                ratio += 0.75 * cheek * np.clip(measured, -1.0, 0.86)
            if k in (1, 2):
                # Only broad dye changes survive a moving light; deep shadows
                # from overlapping locks remain the studio shader's responsibility.
                ratio = np.clip(ratio, -0.098, 0.19)
            if k == 3:
                # Keep the under-fringe and lip contact shadows attached to their
                # geometry. Local fur hue survives without baking a second shadow.
                ratio = np.clip(ratio, -0.23, 0.23)
                low = ratio @ np.array([0.26, 0.59, 0.15])
                ratio -= low[:, None]
                ratio += np.clip(low, -0.05, 0.10)[:, None]
            ratio += 0.23 * fibre[keep]
            w = incidence[keep] ** 2 * (1.25 if (k == 2 and i == 1) or (k == 3 and i == 0) else 1)
            for c in range(3):
                np.add.at(summed[:, c], ix, w * ratio[:, c])
            np.add.at(summed[:, 3], ix, w)
            np.add.at(summed[:, 4], ix, w * (fibre[keep] @ np.array([0.26, 0.59, 0.15])))
            stats[name][k] = int(np.count_nonzero(keep))
    summed = summed.reshape(H, W, 5)
    for p in parts:
        x, y, w, h = p['rect']
        block = summed[y : y + h, x : x + w]
        if not np.any(block[:, :, 3]):
            continue
        sample = blur(block, max(3, min(9, round(w / 100))))
        density = sample[:, :, 3:4]
        correction = sample[:, :, :3] / np.maximum(0.0001, density)
        strength = np.clip(density * 23, 0, 1)
        tile = maps[y : y + h, x : x + w] * np.exp(correction * strength)
        # Preserve hue at the diffuse ceiling. Clipping the red channel on its
        # own turns warm highlights yellow-green on the rendered hair and muzzle.
        tile /= np.maximum(1.0, tile.max(axis=2, keepdims=True))
        if p['paint'] in ('maquette_hair', 'maquette_crown', 'maquette_fringe', 'face', 'lid'):
            r, g, b = tile.transpose(2, 0, 1)
            chroma = np.maximum(0.015, r - b)
            hue = np.clip((g - b) / chroma, 0.31, 0.62 if p['mat'] == 'Gold silk hair' else 0.57)
            tile[:, :, 1] = b + hue * chroma
        pad = 8
        if p['paint'] in (
            'maquette_hair',
            'maquette_crown',
            'maquette_fringe',
            'face',
            'lid',
            'body',
            'arm',
            'knit_binding',
        ):
            detail = blur(block, 2)
            height = detail[:, :, 4] / np.maximum(0.001, detail[:, :, 3])
            gy, gx = np.gradient(height)
            tangent = normals[y : y + h, x : x + w].copy()
            gain = 1.8 if p['mat'] == 'Gold silk hair' else 0.78
            coverage = np.clip(detail[:, :, 3] * 15, 0, 1)
            tangent[:, :, 0] -= gain * gx * coverage
            tangent[:, :, 1] += gain * gy * coverage
            tangent /= np.maximum(0.001, np.linalg.norm(tangent, axis=-1, keepdims=True))
            normals[y - pad : y + h + pad, x - pad : x + w + pad] = np.pad(
                tangent, [(pad, pad), (pad, pad), (0, 0)], mode='edge'
            )
        maps[y - pad : y + h + pad, x - pad : x + w + pad] = np.pad(
            tile, [(pad, pad), (pad, pad), (0, 0)], mode='edge'
        )
    output.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.clip(maps, 0, 1) * 255 + 0.5).astype('uint8')).save(
        output / 'pigment.png', optimize=True
    )
    Image.fromarray(np.uint8(np.clip((normals + 1) * 127.5 + 0.5, 0, 255))).save(
        output / 'relief.png', optimize=True
    )
    print(json.dumps(stats))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    for k in ('bake', 'renders', 'output', 'registration'):
        ap.add_argument(k, type=Path)
    args = ap.parse_args()
    reproject(**vars(args))
