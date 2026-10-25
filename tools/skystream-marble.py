"""Deterministic, seamless ivory marble and fine brass inlay for the sky road.

All source artwork is procedural and owned by this project. The periodic
fields keep the 6 m UV repeat continuous around the native curved surfaces.
"""
from pathlib import Path
import numpy as np
from PIL import Image

size = 1024
y, x = np.mgrid[0:size, 0:size] / size
tau = 2 * np.pi
warp = (.26 * np.sin(tau * (x + y)) + .11 * np.sin(tau * (3*x - 2*y))
        + .045 * np.sin(tau * (9*x + 5*y)) + .018 * np.sin(tau * (23*x - 11*y)))
vein = np.abs(np.sin(tau * (2*x + y + warp)))
cloud = np.sin(tau * (x-y)) * np.cos(tau * (2*x+y))
grain = np.sin(tau * (123*x + 67*y)) * np.cos(tau * (81*x - 113*y))
color = np.zeros((size, size, 3)) + [239, 238, 228]
color += cloud[:, :, None] * [4, 4, 6]
color -= np.exp(-vein * 33)[:, :, None] * [47, 39, 23]
color -= np.exp(-vein * 7)[:, :, None] * [12, 9, 2]
color += grain[:, :, None] * 1.4
# Four shallow panel seams, not a dark checkerboard. A narrow brass pinstripe
# marks the long edges of each tile, with smaller alternating inset details.
gx = np.minimum((x * 2) % 1, 1 - (x * 2) % 1)
gy = np.minimum((y * 2) % 1, 1 - (y * 2) % 1)
seam = np.minimum(gx, gy)
color[seam < .0028] = [174, 182, 184]
color[(seam >= .0028) & (seam < .005)] = [252, 248, 232]
gold = (np.abs(gx - .036) < .0015) | (np.abs(gy - .036) < .0015)
color[gold] = [187, 156, 99]
target = Path(__file__).resolve().parents[1] / 'public/skystream/ivory-marble.webp'
target.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.clip(color, 0, 255).astype('uint8')).save(target, quality=94, method=6)
print(target, target.stat().st_size)
