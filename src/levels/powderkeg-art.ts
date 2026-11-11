import type { CustomComponent } from '../level';
import { clamp, fbm, hash2, lerp, noise2, r3, smooth, type P3 } from './powderkeg-terrain';

/**
 * POWDERKEG PEAK · scenery made in code.
 *
 * Rock faces are faceted strips swept along a plan line and layered in strata,
 * with snow on every shelf and ice where meltwater seeps; snow caps are soft
 * rounded strips; timber is hewn beams between two points. Everything here is
 * seen and never stood on: collision stays with the plain blocks underneath.
 */
type V3 = [number, number, number];
const hex = (c: string): V3 => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const mix = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scale = (a: V3, k: number): V3 => [clamp(a[0] * k), clamp(a[1] * k), clamp(a[2] * k)];

export interface Palette { a: V3; b: V3; shelf: V3; seep: V3; }
export const ROCK: Palette = { a: hex('#7d8498'), b: hex('#565d73'), shelf: hex('#f4f8fd'), seep: hex('#9fd6f0') };
export const BLUE_ICE: Palette = { a: hex('#8ecbea'), b: hex('#3f7fc0'), shelf: hex('#e9f4fc'), seep: hex('#d3eefb') };
const SNOW_LIT = hex('#f6f9fe'), SNOW_SHADE = hex('#cfdef2');

/** Collects triangles into mesh components, starting a new one before the engine's per-mesh limits. */
class MeshBag {
  private v: number[] = []; private c: number[] = []; private i: number[] = []; private n: number[] = []; readonly out: CustomComponent[] = [];
  constructor(private readonly base: Partial<CustomComponent> & { nm: string; grp: number }, private readonly withNormals = false) {}
  private flush() {
    if (!this.i.length) return;
    this.out.push({ t: 'mesh', p: [0, 0, 0], vertices: this.v, colors: this.c, indices: this.i, ...(this.withNormals ? { normals: this.n } : {}), tex: 'solid', color: '#ffffff', solid: false, castShadow: false, ...this.base, nm: `${this.base.nm} ${this.out.length + 1}` });
    this.v = []; this.c = []; this.i = []; this.n = [];
  }
  /** Reserve room for `verts`/`tris`, then return the index of the first new vertex. */
  open(verts: number, tris: number): number { if (this.v.length / 3 + verts > 4096 || this.i.length / 3 + tris > 4096) this.flush(); return this.v.length / 3; }
  vert(p: readonly number[], col: V3, normal?: readonly number[]) { this.v.push(r3(p[0]), r3(p[1]), r3(p[2])); this.c.push(r3(clamp(col[0])), r3(clamp(col[1])), r3(clamp(col[2]))); if (this.withNormals) this.n.push(r3(normal?.[0] ?? 0), r3(normal?.[1] ?? 1), r3(normal?.[2] ?? 0)); }
  tri(a: number, b: number, c: number) { this.i.push(a, b, c); }
  done(): CustomComponent[] { this.flush(); return this.out; }
}

export interface CliffOptions {
  /** Plan line along the foot of the face, in travel order. */ line: readonly (readonly [number, number])[];
  /** +1: the face looks to the left of the line's direction; −1: to its right. */ side: 1 | -1;
  bottom: number | ((t: number) => number); top: number | ((t: number) => number);
  palette?: Palette; relief?: number; seed?: number; step?: number; rowStep?: number;
  /** Lean of the face away from the viewer, metres per metre of height. */ batter?: number;
  /** Close the line into a loop (a free-standing pillar). */ closed?: boolean;
  /** 0..1: how much of the face is glazed with seep ice. */ ice?: number;
  nm: string; grp: number;
}
/** A faceted rock (or ice) face swept along a plan line: strata, shelves holding snow, seep ice, a talus foot. */
export const cliff = (o: CliffOptions): CustomComponent[] => {
  const step = o.step ?? 2.1, rowStep = o.rowStep ?? 1.25, relief = o.relief ?? .55, seed = o.seed ?? 1, palette = o.palette ?? ROCK, batter = o.batter ?? .07, iceAmount = o.ice ?? .25;
  const bottom = typeof o.bottom === 'number' ? () => o.bottom as number : o.bottom, top = typeof o.top === 'number' ? () => o.top as number : o.top;
  // Resample the line.
  const src = o.closed ? [...o.line, o.line[0]] : o.line, pts: { x: number; z: number; t: number; nx: number; nz: number }[] = [];
  let total = 0; const lens: number[] = [];
  for (let k = 1; k < src.length; k++) { lens.push(Math.hypot(src[k][0] - src[k - 1][0], src[k][1] - src[k - 1][1])); total += lens[k - 1]; }
  const count = Math.max(2, Math.round(total / step));
  for (let c = 0; c <= count; c++) {
    let d = total * c / count, k = 0; while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; }
    const u = lens[k] ? d / lens[k] : 0, dx = (src[k + 1][0] - src[k][0]) / (lens[k] || 1), dz = (src[k + 1][1] - src[k][1]) / (lens[k] || 1);
    pts.push({ x: lerp(src[k][0], src[k + 1][0], u), z: lerp(src[k][1], src[k + 1][1], u), t: total * c / count, nx: dz * o.side, nz: -dx * o.side });
  }
  if (o.closed) { // average the normals at corners so a pillar's faces meet in a chamfer rather than a crack
    const n = pts.length - 1;
    for (let c = 0; c < n; c++) { const p = pts[(c + n - 1) % n], q = pts[(c + 1) % n], ax = (p.nx + pts[c].nx + q.nx), az = (p.nz + pts[c].nz + q.nz), l = Math.hypot(ax, az) || 1; pts[c] = { ...pts[c], nx: ax / l, nz: az / l }; }
    pts[n] = { ...pts[0], t: total };
  }
  let tallest = 0; for (const p of pts) tallest = Math.max(tallest, top(p.t) - bottom(p.t));
  const rows = Math.max(2, Math.round(tallest / rowStep)), bag = new MeshBag({ nm: o.nm, grp: o.grp, flatShading: true });
  const perChunk = Math.max(1, Math.floor(Math.min(4096 / (rows + 1) - 1, 2048 / rows)));
  for (let start = 0; start < pts.length - 1; start += perChunk) {
    const cols = Math.min(perChunk, pts.length - 1 - start), first = bag.open((cols + 1) * (rows + 1), cols * rows * 2);
    for (let c = 0; c <= cols; c++) {
      const p = pts[start + c], y0 = bottom(p.t), y1 = top(p.t), wrapT = o.closed && start + c === pts.length - 1 ? 0 : p.t;
      for (let r = 0; r <= rows; r++) {
        const v = r / rows, y = lerp(y0, y1, v), band = y / 2.5 + noise2(wrapT / 9 + seed, seed * 3.1) * .7, f = band - Math.floor(band), layer = hash2(Math.floor(band) + seed * 7, seed);
        const shelf = f > .82 ? 1 : 0, rough = fbm(wrapT / 5 + seed * 11, y / 3, 2) * .9 + noise2(wrapT / 1.6 + seed, y / 1.1) * .45;
        const out = relief * ((layer - .5) * 1.1 + shelf * .75 + rough) + (r === 0 ? .7 : 0) - batter * (y - y0) - (r === rows ? .35 : 0);
        const jitter = (hash2(start + c + seed * 5, r + seed) - .5) * .5, dx = -p.nz * o.side * jitter, dz = p.nx * o.side * jitter;
        const seep = iceAmount > 0 ? smooth((fbm(wrapT / 6 + seed * 31, 9, 2) + iceAmount - .35) / .3) * (.55 + .45 * noise2(wrapT / 1.3, y / 4)) : 0;
        let col = scale(mix(palette.a, palette.b, clamp(layer * .8 + rough * .25 + .1)), .9 + noise2(wrapT / 2.2, y / 1.7 + seed) * .12);
        col = mix(col, palette.seep, seep * .8);
        if (shelf || r === rows) col = mix(col, palette.shelf, .9);
        bag.vert([p.x + p.nx * out + dx, y, p.z + p.nz * out + dz], col);
      }
    }
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const a = first + c * (rows + 1) + r, b = a + rows + 1, d = a + 1;
      if (o.side > 0) { bag.tri(a, d, b); bag.tri(b, d, d + rows + 1); } else { bag.tri(a, b, d); bag.tri(b, d + rows + 1, d); }
    }
  }
  return bag.done();
};

export interface CapOptions {
  /** Plan line along the lip the cap overhangs, in travel order. */ line: readonly (readonly [number, number])[];
  /** +1: the cap's body lies to the right of the line's direction; −1: to its left. */ side: 1 | -1;
  y: number | ((t: number) => number); depth: number; height?: number; overhang?: number; seed?: number; nm: string; grp: number;
}
/** A soft rounded snow cap along a lip: a little cornice over the edge, a drifted crown, a fall-away behind. */
export const snowCap = (o: CapOptions): CustomComponent[] => {
  const y = typeof o.y === 'number' ? () => o.y as number : o.y, height = o.height ?? .7, overhang = o.overhang ?? .3, seed = o.seed ?? 1, step = 1.8;
  const pts: { x: number; z: number; t: number; rx: number; rz: number }[] = []; let t = 0;
  for (let k = 1; k < o.line.length; k++) {
    const ax = o.line[k - 1][0], az = o.line[k - 1][1], bx = o.line[k][0], bz = o.line[k][1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / step)), dx = (bx - ax) / (len || 1), dz = (bz - az) / (len || 1);
    for (let i = k === 1 ? 0 : 1; i <= n; i++) pts.push({ x: lerp(ax, bx, i / n), z: lerp(az, bz, i / n), t: t + len * i / n, rx: -dz * o.side, rz: dx * o.side });
    t += len;
  }
  const profile: [number, number][] = [[-overhang, -.22], [-overhang * .9, .12], [o.depth * .18, .72], [o.depth * .5, 1], [o.depth * .85, .55], [o.depth + .25, -.2]];
  const bag = new MeshBag({ nm: o.nm, grp: o.grp, tex: 'snow' }, true), cols = profile.length - 1, perChunk = Math.floor(4096 / (cols + 1)) - 1;
  for (let start = 0; start < pts.length - 1; start += perChunk) {
    const rows = Math.min(perChunk, pts.length - 1 - start), first = bag.open((rows + 1) * (cols + 1), rows * cols * 2);
    for (let r = 0; r <= rows; r++) {
      const p = pts[start + r], swell = 1 + noise2(p.t / 4.3 + seed, seed * 2.7) * .35;
      profile.forEach(([u, h], c) => {
        const lift = h > 0 ? h * height * swell : h, wob = (c > 0 && c < cols ? noise2(p.t / 2.1 + c, seed) * .18 : 0);
        const slope = c === 0 ? -1 : c === cols ? 1 : (profile[c + 1][1] - profile[c - 1][1]) * -height / (profile[c + 1][0] - profile[c - 1][0]), nl = Math.hypot(slope, 1);
        bag.vert([p.x + p.rx * (u + wob), y(p.t) + lift, p.z + p.rz * (u + wob)], mix(SNOW_LIT, SNOW_SHADE, clamp(.12 + (c === 0 || c === cols ? .55 : 0) + noise2(p.t / 3 + c, seed + 4) * .12)), [p.rx * slope / nl, 1 / nl, p.rz * slope / nl]);
      });
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = first + r * (cols + 1) + c, b = a + 1, d = a + cols + 1;
      if (o.side > 0) { bag.tri(a, b, d); bag.tri(b, d + 1, d); } else { bag.tri(a, d, b); bag.tri(b, d, d + 1); }
    }
  }
  return bag.done();
};

const TIMBER_A = hex('#8d6740'), TIMBER_B = hex('#5f4329');
/** Hewn timber: each beam is a box between two points. Call `beam` any number of times, then `done`. */
export class Timber {
  private readonly bag: MeshBag;
  constructor(nm: string, grp: number, tex = 'plank') { this.bag = new MeshBag({ nm, grp, tex, flatShading: true, castShadow: true, doubleSided: true }); }
  beam(a: P3, b: P3, w = .28, d = w, tint?: string): this {
    const ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2], len = Math.hypot(ax, ay, az) || 1, f: V3 = [ax / len, ay / len, az / len];
    // A side vector that is never parallel to the beam.
    const up: V3 = Math.abs(f[1]) > .9 ? [1, 0, 0] : [0, 1, 0];
    let s: V3 = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]]; const sl = Math.hypot(...s) || 1; s = [s[0] / sl, s[1] / sl, s[2] / sl];
    const u: V3 = [s[1] * f[2] - s[2] * f[1], s[2] * f[0] - s[0] * f[2], s[0] * f[1] - s[1] * f[0]];
    const base = tint ? hex(tint) : mix(TIMBER_A, TIMBER_B, hash2(a[0] * 3.1 + b[2], a[2] * 1.7 + b[0])), first = this.bag.open(8, 12);
    for (const end of [a, b]) for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
      this.bag.vert([end[0] + s[0] * i * w / 2 + u[0] * j * d / 2, end[1] + s[1] * i * w / 2 + u[1] * j * d / 2, end[2] + s[2] * i * w / 2 + u[2] * j * d / 2], scale(base, end === a ? .82 : 1.05));
    const q = (i0: number, i1: number, i2: number, i3: number) => { this.bag.tri(first + i0, first + i1, first + i2); this.bag.tri(first + i0, first + i2, first + i3); };
    q(0, 1, 5, 4); q(1, 2, 6, 5); q(2, 3, 7, 6); q(3, 0, 4, 7); q(3, 2, 1, 0); q(4, 5, 6, 7);
    return this;
  }
  /** A flat panel (a flag, a sign board) from four corners, drawn on both faces. */
  panel(c: readonly P3[], tint: string): this {
    const col = hex(tint), first = this.bag.open(8, 4);
    for (let pass = 0; pass < 2; pass++) c.forEach((p, i) => this.bag.vert(p, scale(col, i < 2 ? 1 : .86)));
    this.bag.tri(first, first + 1, first + 2); this.bag.tri(first, first + 2, first + 3); this.bag.tri(first + 4, first + 6, first + 5); this.bag.tri(first + 4, first + 7, first + 6);
    return this;
  }
  done(): CustomComponent[] { return this.bag.done(); }
}

/** A rectangle's outline as a closed plan line (clockwise seen from above, +X then +Z), for `cliff({ closed: true, side: 1 })`. */
export const boxLine = (x0: number, z0: number, x1: number, z1: number): [number, number][] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
