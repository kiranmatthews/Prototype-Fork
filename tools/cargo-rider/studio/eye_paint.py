"""Paint the whole eyeball, including sclera revealed only during an exaggerated look."""

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter


def paint_eye(folder):
    n = 1024
    v, u = np.indices((n, n), dtype=np.float32)
    x = (u + 0.5) / n * 2 - 1
    y = 1 - (v + 0.5) / n * 2
    r = np.hypot(x, y)
    t = np.arctan2(y, x)
    radius = 0.525
    a = r / radius
    random = np.random.default_rng(1910)
    fib = np.zeros_like(r)
    low = np.zeros_like(r)
    for f in (19, 34, 48, 63, 91, 127, 178, 255, 334):
        phase = random.uniform(0, 2 * np.pi)
        w = 1.0 / (1 + (f / 123.0) ** 1.2)
        fib += w * np.sin(
            t * f + phase + 0.65 * np.sin(a * 8 + t * 3 + phase) + a * (0.5 + f * 0.015)
        )
    for f in (7, 11, 17):
        low += np.sin(t * f + random.uniform(0, 6.283) + a * 5.1) / 3
    fiber = np.tanh(fib * 0.65) * 0.5 + 0.5

    def ramp(a, b, v):
        h = np.clip((v - a) / (b - a), 0, 1)
        return h * h * (3 - 2 * h)

    center = ramp(0.47, 0.59, a)
    outer = 1 - ramp(0.84, 1.02, a)
    iris = np.array([0.338, 0.087, 0.425])[None, None, :] + np.stack(
        (0.26 * outer, 0.076 * outer, 0.34 * outer), axis=-1
    )
    glow = (0.33 + 0.67 * ramp(-0.75, 0.87, -y / radius)) * (0.51 + 0.49 * fiber) + 0.16 * low
    iris += np.stack((0.21 * glow, 0.066 * glow, 0.19 * glow), axis=-1)
    shadow = ramp(-0.18, 0.74, y / radius)
    iris *= 1 - shadow[:, :, None] * np.array([0.36, 0.39, 0.23])
    flare = ramp(0.06, 0.90, -y / radius) * (0.42 + 0.58 * fiber)
    iris += flare[:, :, None] * np.array([0.14, 0.052, 0.08])
    iris *= center[:, :, None] * 0.53 + 0.47
    edge = ramp(0.88, 0.993, a)
    iris = iris * (1 - 0.78 * edge[..., None])
    pupil = 1 - ramp(0.486, 0.508, a)
    iris = iris * (1 - pupil[:, :, None]) + np.array([0.040, 0.020, 0.056]) * pupil[:, :, None]
    ring = np.exp(-(((a - 0.57) / 0.035) ** 2)) * (0.4 + 0.6 * fiber)
    iris += ring[:, :, None] * np.array([0.11, 0.029, 0.100])
    sclera = np.zeros_like(iris) + [0.988, 0.963, 0.949]
    blood = ramp(0.64, 1.04, np.abs(x)) * 0.09 + ramp(0.74, 1.02, r) * 0.025
    sclera[:, :, 1] -= blood
    sclera[:, :, 2] -= blood * 0.69
    alpha = (1 - ramp(0.985, 1.015, a))[:, :, None]
    rgb = iris * alpha + sclera * (1 - alpha)
    # A restrained graphic catchlight reads in the normal game camera; the corneal BRDF
    # supplies the much larger, moving studio reflection at close range.
    for cx, cy, rad, strength in [(-0.139, 0.200, 0.043, 0.93), (0.115, 0.128, 0.018, 0.71)]:
        spot = (1 - ramp(rad * 0.72, rad, np.hypot(x - cx, y - cy))) * strength
        rgb = rgb * (1 - spot[..., None]) + np.array([1, 0.985, 1]) * spot[..., None]
    Image.fromarray(np.rint(np.clip(rgb, 0, 1) * 255).astype("uint8")).save(
        Path(folder) / "iris-color.jpg", quality=97, subsampling=0
    )


def paint_skin(folder):
    folder = Path(folder)
    d = np.load(folder / "neutral.npz")
    color = np.array(Image.open(folder / "neutral-color.jpg").convert("RGB"), dtype=np.float32)
    n = color.shape[0]
    mask = np.zeros((n, n), dtype=np.float32)
    f = d["tri"]
    f = f[d["group"][f[:, 0]] == 0]
    for face in f:
        xyz = d["pos"][face]
        zone = xyz.mean(0)
        if not 0.273 < zone[1] < 0.535 or not 0.027 < abs(zone[0]) < 0.286 or zone[2] < 0.018:
            continue
        uv = d["uv"][face] * (n - 1)
        lo = np.maximum(0, np.floor(uv.min(0) - 1).astype(int))
        hi = np.minimum(n - 1, np.ceil(uv.max(0) + 1).astype(int))
        xx, yy = np.meshgrid(
            np.arange(lo[0], hi[0] + 1) - uv[0, 0], np.arange(lo[1], hi[1] + 1) - uv[0, 1]
        )
        a, b = uv[1] - uv[0], uv[2] - uv[0]
        det = a[0] * b[1] - a[1] * b[0]
        if abs(det) < 0.0001:
            continue
        q = (xx * b[1] - yy * b[0]) / det
        r = (a[0] * yy - a[1] * xx) / det
        inside = (q >= -0.045) & (r >= -0.045) & (q + r <= 1.045)
        w = np.where(inside, 1.0, 0.0)
        mask[lo[1] : hi[1] + 1, lo[0] : hi[0] + 1] = np.maximum(
            mask[lo[1] : hi[1] + 1, lo[0] : hi[0] + 1], w
        )
    c = color / 255
    r, g, b = c.transpose(2, 0, 1)
    # Remove occluded black ink, projected sclera and violet shadows from the fur underneath
    # the independent brows and lid margins. Preserve the marked lashes on their own geometry.
    ink = np.clip((0.56 - r) * 4.8, 0, 1)
    nonfur = np.clip((b + 0.085 - g) * 5.5, 0, 1)
    white = np.clip((np.minimum(g, b) - 0.42) * 4, 0, 1)
    shadow = 0.67 * np.clip((0.77 - r) / 0.34, 0, 1)
    strength = mask * np.maximum.reduce([ink, nonfur, white, shadow])
    pigment = np.zeros_like(c) + [0.925, 0.405, 0.025]
    c = c * (1 - strength[..., None]) + pigment * strength[..., None]
    Image.fromarray(np.rint(np.clip(c, 0, 1) * 255).astype("uint8")).save(
        folder / "neutral-color.jpg", quality=97, subsampling=0
    )
    # The source photograph shades the old open socket. Keep that ink and its
    # baked relief off the underlying skin that becomes visible during a blink.
    normal_path = folder / "neutral-normal.png"
    source = Image.open(normal_path).convert("RGB")
    smooth = Image.fromarray(np.rint(mask * 255).astype("uint8")).resize(
        source.size, Image.Resampling.BOX
    )
    smooth = np.asarray(smooth.filter(ImageFilter.GaussianBlur(1.3)), dtype=np.float32) / 255
    vectors = np.asarray(source, dtype=np.float32) / 127.5 - 1
    vectors[:, :, :2] *= 1 - 0.83 * smooth[:, :, None]
    vectors /= np.maximum(0.001, np.linalg.norm(vectors, axis=2, keepdims=True))
    Image.fromarray(np.rint(np.clip(vectors * 0.5 + 0.5, 0, 1) * 255).astype("uint8")).save(
        normal_path, optimize=True
    )
