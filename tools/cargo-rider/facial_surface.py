"""Continuous facial skin, dental arches and volume-preserving cheek inflation."""

import math
import numpy as np
from surface import grid, head_fit, parts, pi, smooth


def blink_line(x, upper, lower):
    t = np.clip((abs(x) - 50) / 128, 0, 1)
    return np.maximum(upper, np.minimum(lower, upper + 0.78 * (lower - upper) - 15 * np.sin(pi * t) ** 1.45))


def cheek_inflation(points, sign):
    """Project radial skin rays onto the union of the face and an inflated cheek."""
    origin = np.array([0.0, 652.0, -20.0])
    ray = points - origin
    distance = np.linalg.norm(ray, axis=1)
    direction = ray / np.maximum(distance[:, None], 0.001)
    center = np.array([sign * 119.0, 662.0, 172.0])
    radii = np.array([116.0, 79.0, 127.0])
    n = direction / radii
    o = (origin - center) / radii
    a = np.sum(n * n, axis=1)
    b = n @ o
    disc = b * b - a * (o @ o - 1)
    far = (-b + np.sqrt(np.maximum(0, disc))) / np.maximum(a, 1e-12)
    excess = np.maximum(0, far - distance)
    # Ease into the cheek instead of creating a hard intersection line.
    shell = excess * smooth(excess / 25) * smooth(np.maximum(0, disc) / 0.000005)
    return direction * shell[:, None]


def dental_arch(lipline, depth_at):
    # Six incisors/canines per jaw. Each crown is rounded in depth, slightly
    # overlaps its neighbour at the gum and follows the arc of the short muzzle.
    for lower in (False, True):
        centers = [-88, -60, -25, 14, 50, 83] if lower else [-91, -62, -23, 19, 59, 90]
        widths = [12, 18, 20, 19, 17, 12] if lower else [13, 18, 21, 21, 18, 13]
        for i, (cx, w) in enumerate(zip(centers, widths)):
            canine = i in (0, 5)
            length = (19 if lower else 25) + (4 if canine else 0)

            def surface(u, t):
                theta = 2 * pi * u
                angle = pi * (0.002 + 0.996 * t)
                shoulder = max(0.001, math.sin(angle)) ** 0.39
                # Rounded sides and a gently scalloped cutting edge with a small canine.
                across = math.copysign(abs(math.sin(theta)) ** 0.70, math.sin(theta))
                fore = math.copysign(abs(math.cos(theta)) ** 0.69, math.cos(theta))
                x = cx + w * shoulder * across
                bite = 1.8 * (1 - abs(across)) + (4.2 * (1 - abs(across)) if canine else 0)
                if lower:
                    v = lipline(x) - 3 + length * t - bite * (1 - t) ** 2
                else:
                    v = lipline(x) - length + 3 + length * t + bite * t * t
                d = depth_at(x, lipline(x)) - 12 + fore * 6.4 * shoulder - 2.5 * (x - cx) ** 2 / (w * w)
                return [x, v, d]

            grid(
                ('Mandibular' if lower else 'Maxillary') + ' crown ' + str(i + 1),
                16,
                7,
                surface,
                head_fit,
                'head-presentation',
                'enamel',
                group='Dentition',
                material='Enamel',
                cyclic=True,
                uvsize=(62, 42),
            )
            parts[-1]['tooth'] = 'lower' if lower else 'upper'


def register_mouth(islands):
    """Bind the lip rolls, cavity and tongue surface to the deformed oral aperture."""
    upper = next(p for p in islands if p['name'] == 'Cranium, muzzle and cheeks')
    lower = next(p for p in islands if p['name'] == 'Chin and lower lip')
    nu = upper['nu']
    indices = np.array([i % nu for i in range(-nu // 4, nu // 4 + 1)])
    up = upper['nv'] * (nu + 1) + indices
    lo = indices
    x = upper['points'][up, 0]
    shared = {k for k in upper['keys'] | lower['keys'] if not k.startswith(('IrisFit.', 'MaskFit.', 'Pose.'))}
    for p in islands:
        name = p['name']
        if name not in ('Inner mouth', 'Upper lip roll', 'Lower lip roll', 'Tongue'):
            continue
        points = p['points']
        reference = points[:, 0]
        row = np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)
        if name == 'Upper lip roll':
            fraction = 0.0
        elif name == 'Lower lip roll':
            fraction = 1.0
        elif name == 'Inner mouth':
            fraction = -0.015 + 1.03 * row
        else:
            fraction = 0.63 + 0.28 * row
        for k in shared:

            def sample(part, idx):
                d = part['keys'].get(k)
                if d is None:
                    return np.zeros_like(points)
                return np.stack([np.interp(reference, x, d[idx, i]) for i in range(3)], axis=-1)

            a, b = sample(upper, up), sample(lower, lo)
            t = fraction[:, None] if isinstance(fraction, np.ndarray) else fraction
            delta = a * (1 - t) + b * t
            if k == 'JawOpen' and name == 'Inner mouth':
                xrel = np.clip(abs(reference) / 0.103, 0, 1)
                delta[:, 2] -= (
                    0.037 * np.sin(pi * row)
                    + 0.016 * (1 - np.exp(-row / 0.060)) * (1 - np.exp(-(1 - row) / 0.065))
                ) * (1 - xrel**3)
            if k == 'JawOpen' and name == 'Tongue':
                delta[:, 2] -= 0.008 * np.sin(pi * row)
            if np.max(np.abs(delta)) > 1e-8:
                p['keys'][k] = delta
    # Keep the back and sides of the mandible physically welded. The front
    # commissures remain openable. Fade joint corrections into three chin loops.
    joins = {}
    for i in range(nu):
        theta = 2 * pi * i / nu
        outer = abs(upper['points'][upper['nv'] * (nu + 1) + i, 0]) > 115.8 * 0.000885
        if math.cos(theta) <= 0.30 or outer:
            joins[i] = (upper['name'], upper['nv'] * (nu + 1) + i)
    lower['joins'] = joins
    for i, (_, idx) in joins.items():
        for k in upper['keys'] | lower['keys']:
            a = upper['keys'][k][idx] if k in upper['keys'] else np.zeros(3)
            if k not in lower['keys']:
                if max(abs(a)) < 1e-9:
                    continue
                lower['keys'][k] = np.zeros_like(lower['points'])
            d = lower['keys'][k]
            diff = a - d[i]
            for j, weight in enumerate([1, 0.62, 0.24, 0.05]):
                d[j * (nu + 1) + i] += diff * weight


def fit_dentition(islands, poses):
    """Fit both crown rows behind the moving commissures, including combined expressions."""
    lips = [next(p for p in islands if p['name'] == name) for name in ('Upper lip roll', 'Lower lip roll')]
    curves = [p['points'][: p['nu'] + 1] for p in lips]
    controls = {k for p in lips for k in p['keys'] if not k.startswith(('MaskFit.', 'Pose.', 'IrisFit.'))}
    controls.update(('TeethRetract', 'Clench'))
    for tooth in (p for p in islands if 'tooth' in p):
        x = tooth['points'][:, 0].copy()
        t = np.repeat(np.linspace(0, 1, tooth['nv'] + 1), tooth['nu'] + 1)
        u = np.tile(np.linspace(0, 1, tooth['nu'] + 1), tooth['nv'] + 1)
        bulge = (np.cos(2 * pi * u) * np.sin(pi * t) ** 0.42 - 1) * 0.0038
        lower = tooth['tooth'] == 'lower'
        canine = tooth['name'].endswith((' 1', ' 6'))
        tip = t if lower else 1 - t
        scallop = (1 - np.abs(np.sin(2 * pi * u))) * (0.002 if canine else 0.0011) * (1 - tip) ** 2

        def targets(weights, name=None):
            rims = []
            for p, curve in zip(lips, curves):
                target = curve.copy()
                for k, w in weights.items():
                    if k in p['keys']:
                        target += w * p['keys'][k][: len(curve)]
                if name and 'MaskFit.' + name in p['keys']:
                    target += p['keys']['MaskFit.' + name][: len(curve)]
                rims.append(np.stack([np.interp(x, curve[:, 0], target[:, j]) for j in range(3)], axis=-1))
            hi, lo = rims
            gap = np.maximum(hi[:, 1] - lo[:, 1], 0)
            show = smooth((gap - 0.004) / 0.038)
            retract = weights.get('TeethRetract', 0)
            clench = weights.get('Clench', 0)
            exposed = np.minimum(gap * (0.28 if lower else 0.36), 0.022 if lower else 0.025)
            exposed *= 1 - 0.82 * retract
            exposed += np.minimum(gap * 0.20, 0.012) * clench
            exposed -= 0.0028 * (1 - show)
            height = (0.021 if lower else 0.029) * (0.32 + 0.68 * show) + (0.002 if canine else 0)
            result = (lo if lower else hi).copy()
            result[:, 1] += (1 if lower else -1) * (exposed + scallop - height * tip)
            # The lower gum turns back under the lip and never traverses the thin chin.
            depth = (
                0.0045
                + 0.021 * (1 - show)
                + tip * (0.034 if lower else 0.018)
                + 0.021 * retract
                - 0.0045 * clench
            )
            result[:, 2] += bulge - depth
            return result

        base = targets({})
        keys = {}
        for k in controls:
            delta = targets({k: 1}) - base
            if np.max(abs(delta)) > 1e-8:
                keys[k] = delta
        for n, weights in poses.items():
            delta = targets(weights, n) - base
            combined = sum((keys[k] * v for k, v in weights.items() if k in keys), np.zeros_like(base))
            residue = delta - combined
            if np.max(abs(residue)) > 1e-7:
                keys['MaskFit.' + n] = residue
        tooth['points'] = base
        tooth['keys'] = keys


def fit_comic_muzzles(islands, poses, coordinates, delta_to_model):
    """Shape the air-filled cheeks and the lip contours of the two clenched performances."""
    lips = [next(p for p in islands if p['name'] == name) for name in ('Upper lip roll', 'Lower lip roll')]

    def posed(part, name):
        keys = part['keys']
        result = part['points'].copy()
        for k, v in poses[name].items():
            if k in keys:
                result += v * keys[k]
        return coordinates(result + keys.get('MaskFit.' + name, 0))

    def correct(part, name, delta):
        key = 'MaskFit.' + name
        part['keys'][key] = part['keys'].get(key, 0) + delta_to_model(delta)

    for p in islands:
        if p['name'] not in ('Cranium, muzzle and cheeks', 'Chin and lower lip') and 'socket_boundary' not in p:
            continue
        base = coordinates(p['points'])
        current = posed(p, 'puffer')
        # Both ellipsoids contain the ray origin. Their far intersection supplies
        # one closed, round skin surface on the front, sides and underside.
        origin = np.array([0.0, 677.0, 169.0])
        ray = current - origin
        length = np.linalg.norm(ray, axis=1)
        direction = ray / np.maximum(length[:, None], 0.001)
        radii = np.array([138.0, 85.0, 121.0])
        d = direction / radii
        a = np.sum(d * d, axis=1)
        distances = []
        for sign in (-1, 1):
            center = np.array([sign * 113.0, 674.0, 215.0])
            o = (origin - center) / radii
            b = d @ o
            distances.append((-b + np.sqrt(np.maximum(0, b * b - a * (o @ o - 1)))) / np.maximum(a, 1e-15))
        rounded = origin + direction * np.maximum(*distances)[:, None]
        mask = (
            smooth((abs(current[:, 0]) - 18) / 38)
            * smooth((base[:, 1] - 583) / 55)
            * smooth((base[:, 2] + 38) / 125)
        )
        if 'socket_boundary' in p:
            mask *= 1 - smooth(np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1))
        correct(p, 'puffer', (rounded - current) * mask[:, None])

    x = coordinates(lips[0]['points'][: lips[0]['nu'] + 1])[:, 0]
    t = x / 115.8
    for name in ('snarl', 'splat'):
        contours = [posed(p, name)[: len(x), 1] for p in lips]
        reach = np.sqrt(np.maximum(0, 1 - t * t))
        if name == 'snarl':
            mid = 701 + 30 * t + 5 * t * t
            gape = 2.1 + (20 - 5 * t) * reach
        else:
            mid = 635 + 24 * abs(t) ** 1.5 + 3 * t
            gape = 1.7 + (13 + 10 * abs(t)) * reach
        displacement = [mid - gape - contours[0], mid + gape - contours[1]]
        for p in islands:
            label = p['name']
            if label not in (
                'Cranium, muzzle and cheeks',
                'Chin and lower lip',
                'Upper lip roll',
                'Lower lip roll',
                'Inner mouth',
                'Tongue',
            ):
                continue
            base = coordinates(p['points'])
            bx, v, d = base.T
            rows = np.repeat(np.linspace(0, 1, p['nv'] + 1), p['nu'] + 1)
            hi, lo = [np.interp(bx, x, values) for values in displacement]
            fraction = {
                'Cranium, muzzle and cheeks': 0.0,
                'Chin and lower lip': 1.0,
                'Upper lip roll': 0.0,
                'Lower lip roll': 1.0,
                'Inner mouth': rows,
                'Tongue': 0.63 + 0.28 * rows,
            }[label]
            dy = hi * (1 - fraction) + lo * fraction
            if label in ('Cranium, muzzle and cheeks', 'Chin and lower lip'):
                line = (
                    711
                    - 46 * np.minimum(abs(bx) / 109, 1.1) ** 2.15
                    + 3 * np.sin(np.minimum(abs(bx) / 109, 1) * pi)
                )
                fade = (
                    np.exp(-(((v - line) / 47) ** 2))
                    * smooth((d - 69) / 85)
                    * (1 - smooth((abs(bx) - 116) / 66))
                )
                if label == 'Chin and lower lip':
                    fade *= (1 - rows) ** 1.22
                dy *= fade
            correct(p, name, np.stack([np.zeros_like(dy), dy, np.zeros_like(dy)], axis=-1))


def fair_inflation(islands, weights, coordinates, delta_to_model):
    """Redistribute crowded quads around the inflated commissures while preserving volume."""
    sheets = [
        next(p for p in islands if p['name'] == n) for n in ('Cranium, muzzle and cheeks', 'Chin and lower lip')
    ]
    sheets.extend(p for p in islands if 'socket_boundary' in p)
    originals = []
    posed = []
    neutral = []
    mappings = []
    edges = []
    for p in sheets:
        mesh = p['points'].copy()
        for k, v in weights.items():
            if k in p['keys']:
                mesh += p['keys'][k] * v
        mesh = coordinates(mesh + p['keys'].get('MaskFit.puffer', 0))
        originals.append(mesh)
        bind = coordinates(p['points'])
        nu, nv = p['nu'], p['nv']
        ids = np.empty((nu + 1) * (nv + 1), dtype=int)
        joins = p.get('joins', {})
        if 'socket_boundary' in p:
            parent, loop = p['socket_boundary']
            joins = {i: (parent, j) for i, j in enumerate(loop)}
        for j in range(nv + 1):
            for i in range(nu):
                k = j * (nu + 1) + i
                if k in joins:
                    ids[k] = mappings[0][joins[k][1]]
                else:
                    ids[k] = len(posed)
                    posed.append(mesh[k])
                    neutral.append(bind[k])
            ids[j * (nu + 1) + nu] = ids[j * (nu + 1)]
        for face in p['faces']:
            edges.extend((ids[a], ids[b]) for a, b in zip(face, face[1:] + face[:1]))
        mappings.append(ids)
    current = np.array(posed)
    initial = current.copy()
    bind = np.array(neutral)
    pairs = np.unique(np.sort(np.array(edges), axis=1), axis=0)
    src = np.concatenate([pairs[:, 0], pairs[:, 1]])
    dest = np.concatenate([pairs[:, 1], pairs[:, 0]])
    degree = np.bincount(src, minlength=len(current))
    mask = (
        smooth((abs(initial[:, 0]) - 12) / 33)
        * smooth((bind[:, 1] - 591) / 52)
        * smooth((bind[:, 2] + 29) / 98)
    )
    mask[degree < 3] = 0
    for p, ids in zip(sheets, mappings):
        if 'socket_boundary' in p:
            width = p['nu'] + 1
            mask[ids[-width:]] = 0
            mask[ids[-2 * width : -width]] *= 0.10
    centers = np.tile([113.0, 674.0, 215.0], (len(current), 1))
    centers[:, 0] *= np.sign(initial[:, 0])
    radii = np.array([138.0, 85.0, 121.0])
    for _ in range(24):
        mean = np.column_stack(
            [np.bincount(src, weights=current[dest, i], minlength=len(current)) for i in range(3)]
        )
        offset = mean / np.maximum(degree[:, None], 1) - current
        current += 0.42 * mask[:, None] * offset
        # Slide the cheek vertices on a rounded volume. All four charts use the
        # same graph across the socket and jaw, right up to the moving lid margin.
        local = current - centers
        dist = np.maximum(0.1, np.linalg.norm(local / radii, axis=1, keepdims=True))
        surface = centers + local / dist
        current += 0.26 * mask[:, None] ** 3 * (surface - current)
    for p, ids, original in zip(sheets, mappings, originals):
        key = 'MaskFit.puffer'
        p['keys'][key] = p['keys'].get(key, 0) + delta_to_model(current[ids] - original)
