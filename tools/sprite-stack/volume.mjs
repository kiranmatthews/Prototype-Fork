// Sprite-stack bake, pure part: captured views (colour + depth from six sides) -> a coloured voxel volume -> slices.
// Geometry comes from the depth maps (a voxel is solid when no view sees past it); colour comes from the view that
// sees the voxel's surface best. The four side views (and, optionally, the top) are the stills an image model would
// restyle: `colourViews` chooses which views may supply colour, and each view's colour buffer can be swapped for a
// restyled one before reconstruction.

/** Capture box in voxels (x across, y up, z toward the viewer of the front view) and its scale. */
export const GRID = { nx: 56, ny: 72, nz: 56, voxel: 0.05, ss: 4 };
export const boxOf = (grid = GRID) => ({ e: [grid.nx * grid.voxel / 2, grid.ny * grid.voxel / 2, grid.nz * grid.voxel / 2], px: grid.ss / grid.voxel });
export const VIEW_NAMES = ['front', 'left', 'back', 'right', 'top', 'bottom'];

/** The capture's depth bytes: d = r/255 + g/255² + b/255³ (0 at the near plane, 1 at the far plane and where nothing was drawn). */
export const unpackDepth = (d, i) => d[i] / 255 + d[i + 1] / 65025 + d[i + 2] / 16581375;

/** Reduce one captured view to voxel-face cells: mean colour of covered sub-pixels, coverage count, nearest depth (m). */
export const reduceView = (view, ss = GRID.ss) => {
  const w = view.w / ss | 0, h = view.h / ss | 0, n = w * h;
  const rgb = new Float32Array(n * 3), cover = new Uint8Array(n), depth = new Float32Array(n).fill(Infinity);
  for (let cy = 0; cy < h; cy++) for (let cx = 0; cx < w; cx++) {
    let r = 0, g = 0, b = 0, c = 0, dmin = Infinity;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const i = ((cy * ss + sy) * view.w + cx * ss + sx) * 4;
      const d = unpackDepth(view.dep, i);
      if (d < .9999) { const m = view.near + d * (view.far - view.near); if (m < dmin) dmin = m; }
      if (view.col[i + 3] > 127) { r += view.col[i]; g += view.col[i + 1]; b += view.col[i + 2]; c++; }
    }
    const k = cy * w + cx; cover[k] = c; depth[k] = dmin;
    if (c) { rgb[k * 3] = r / c; rgb[k * 3 + 1] = g / c; rgb[k * 3 + 2] = b / c; }
  }
  return { w, h, rgb, cover, depth };
};

/** Unit direction from a surface toward each view's camera, in capture order. */
const VIEW_DIR = [[0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];

/**
 * Rebuild the volume. `views` are six reduced views in capture order; `R` is the camera distance from the box centre.
 * Geometry: a voxel is solid when every view covers it and none sees past it. Colour: each solid voxel takes the colour
 * of the view that faces its surface most squarely among the views that can see it, so a still's silhouette edge (where
 * the surface turns away, and where a painted outline sits) is used only when no other view shows that surface.
 * `colourViews` lists the views that may supply colour. With `borrow`, a surface none of them faces (a sole, seen only
 * from below) may take the colour of a view outside the list; `borrow: false` forbids that, to test a pipeline that
 * never has those stills.
 * Returns `solid` (0/1 per voxel) and `rgb` (3 bytes per voxel); voxel index = (y * nz + z) * nx + x, y = 0 at the bottom.
 */
export const reconstruct = (views, R, { grid = GRID, colourViews = [0, 1, 2, 3, 4], minCover = 2, borrow = true } = {}) => {
  const { nx, ny, nz, voxel: s } = grid, ex = nx * s / 2, ey = ny * s / 2, ez = nz * s / 2;
  const solid = new Uint8Array(nx * ny * nz), rgb = new Uint8Array(nx * ny * nz * 3);
  const eps = .75 * s, skin = 1.3 * s;
  // For each view: cell index and distance from that view's camera plane, for a voxel (i, j, k) centred on (x, y, z).
  const proj = [
    (x, y, z, i, j, k) => [j * nx + i, R - z],
    (x, y, z, i, j, k) => [j * nz + (nz - 1 - k), R - x],
    (x, y, z, i, j, k) => [j * nx + (nx - 1 - i), R + z],
    (x, y, z, i, j, k) => [j * nz + k, R + x],
    (x, y, z, i, j, k) => [(nz - 1 - k) * nx + i, R - y],
    (x, y, z, i, j, k) => [k * nx + i, R + y],
  ];
  let filled = 0;
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const x = (i + .5) * s - ex, y = (j + .5) * s - ey, z = (k + .5) * s - ez;
    let inside = true;
    for (let v = 0; v < 6; v++) {
      const [cell, t] = proj[v](x, y, z, i, j, k), view = views[v];
      if (view.cover[cell] < minCover || !(view.depth[cell] < Infinity) || t - view.depth[cell] < -eps) { inside = false; break; }
    }
    if (inside) { solid[(j * nz + k) * nx + i] = 1; filled++; }
  }
  const at = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz ? solid[(j * nz + k) * nx + i] : 0;
  const penalty = VIEW_DIR.map((_, v) => colourViews.includes(v) ? 0 : borrow ? .6 : Infinity);
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const o = (j * nz + k) * nx + i; if (!solid[o]) continue;
    const x = (i + .5) * s - ex, y = (j + .5) * s - ey, z = (k + .5) * s - ez;
    // Outward direction of the surface here: toward the empty neighbours.
    let gx = 0, gy = 0, gz = 0;
    for (let dj = -1; dj <= 1; dj++) for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) if (!at(i + di, j + dj, k + dk)) { gx += di; gy += dj; gz += dk; }
    const len = Math.hypot(gx, gy, gz) || 1;
    let best = 0, bestScore = -Infinity, bestCell = 0;
    for (let v = 0; v < 6; v++) {
      if (penalty[v] === Infinity) continue;
      const [cell, t] = proj[v](x, y, z, i, j, k), delta = t - views[v].depth[cell];
      const facing = (gx * VIEW_DIR[v][0] + gy * VIEW_DIR[v][1] + gz * VIEW_DIR[v][2]) / len;
      // A view that cannot see this voxel only ever beats another that cannot; then the nearest surface wins.
      const score = (delta < skin ? facing : -2 - delta / s * .05) - penalty[v];
      if (score > bestScore) { bestScore = score; best = v; bestCell = cell; }
    }
    const c = views[best].rgb;
    rgb[o * 3] = c[bestCell * 3]; rgb[o * 3 + 1] = c[bestCell * 3 + 1]; rgb[o * 3 + 2] = c[bestCell * 3 + 2];
  }
  return { solid, rgb, filled };
};

/** Median-cut palette over a 15-bit colour histogram. Returns up to `size` [r, g, b] entries. */
export const buildPalette = (histogram, size = 255) => {
  const entries = [...histogram.entries()].map(([key, count]) => ({ r: (key >> 10 & 31) * 8 + 4, g: (key >> 5 & 31) * 8 + 4, b: (key & 31) * 8 + 4, count }));
  if (!entries.length) return [[0, 0, 0]];
  const measure = (box) => { const lo = [255, 255, 255], hi = [0, 0, 0]; let count = 0; for (const e of box) { count += e.count; for (const [n, ch] of ['r', 'g', 'b'].entries()) { if (e[ch] < lo[n]) lo[n] = e[ch]; if (e[ch] > hi[n]) hi[n] = e[ch]; } } const span = hi.map((v, n) => v - lo[n]); return { box, count, span, axis: span.indexOf(Math.max(...span)) }; };
  let boxes = [measure(entries)];
  while (boxes.length < size) {
    // Split the box with the most colour spread, weighted a little by how many voxels it holds.
    let pick = -1, score = 0;
    for (const [n, b] of boxes.entries()) { if (b.box.length < 2) continue; const sc = Math.max(...b.span) * Math.log2(2 + b.count); if (sc > score) { score = sc; pick = n; } }
    if (pick < 0) break;
    const b = boxes[pick], ch = 'rgb'[b.axis], sorted = b.box.slice().sort((p, q) => p[ch] - q[ch]);
    let acc = 0, cut = 1; for (let n = 0; n < sorted.length - 1; n++) { acc += sorted[n].count; if (acc >= b.count / 2) { cut = n + 1; break; } }
    boxes.splice(pick, 1, measure(sorted.slice(0, cut)), measure(sorted.slice(cut)));
  }
  return boxes.map(b => { let r = 0, g = 0, bl = 0; for (const e of b.box) { r += e.r * e.count; g += e.g * e.count; bl += e.b * e.count; } return [Math.round(r / b.count), Math.round(g / b.count), Math.round(bl / b.count)]; });
};
export const key15 = (r, g, b) => (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
/** Nearest-palette lookup with a per-bin cache; returned indices start at 1 (0 is "empty"). */
export const paletteMapper = (palette) => {
  const cache = new Map();
  return (r, g, b) => {
    const key = key15(r, g, b); let hit = cache.get(key);
    if (hit === undefined) { let best = 0, bd = Infinity; for (let n = 0; n < palette.length; n++) { const p = palette[n], d = (p[0] - r) ** 2 * .9 + (p[1] - g) ** 2 * 1.2 + (p[2] - b) ** 2 * .8; if (d < bd) { bd = d; best = n; } } hit = best + 1; cache.set(key, hit); }
    return hit;
  };
};

/**
 * Lay a clip's frames out as the slice sheet a sprite stack is drawn from: one row per frame, one nx-by-nz tile per
 * layer (bottom layer first). Grey value = palette index; 0 = empty. Tile rows run from the back (z = 0) to the front.
 */
export const sliceSheet = (frames, grid = GRID) => {
  const { nx, ny, nz } = grid, width = nx * ny, height = nz * frames.length, out = new Uint8Array(width * height);
  for (const [f, vol] of frames.entries()) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) out.set(vol.subarray((j * nz + k) * nx, (j * nz + k) * nx + nx), (f * nz + k) * width + j * nx);
  return { pixels: out, width, height };
};

/** Orthographic debug views of a volume (front, left, top), for checking the reconstruction against the captures. */
export const debugViews = (solid, rgb, grid = GRID) => {
  const { nx, ny, nz } = grid, W = nx + nz + nx + 8, H = Math.max(ny, nz), img = new Uint8Array(W * H * 4);
  const put = (px, py, o) => { const q = (py * W + px) * 4; img[q] = rgb[o * 3]; img[q + 1] = rgb[o * 3 + 1]; img[q + 2] = rgb[o * 3 + 2]; img[q + 3] = 255; };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) for (let k = nz - 1; k >= 0; k--) { const o = (j * nz + k) * nx + i; if (solid[o]) { put(i, H - 1 - j, o); break; } }
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) for (let i = nx - 1; i >= 0; i--) { const o = (j * nz + k) * nx + i; if (solid[o]) { put(nx + 4 + (nz - 1 - k), H - 1 - j, o); break; } }
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) for (let j = ny - 1; j >= 0; j--) { const o = (j * nz + k) * nx + i; if (solid[o]) { put(nx + nz + 8 + i, k, o); break; } }
  return { pixels: img, width: W, height: H };
};
