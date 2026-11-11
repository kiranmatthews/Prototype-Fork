import type { CustomComponent } from '../level';

/**
 * POWDERKEG PEAK · the mountain.
 *
 * One analytic height function owns the whole massif. Routes carve their own
 * beds into it, the ridden pistes and walked pads are fine solid patches of
 * that same function, and the surrounding slopes are coarse visual tiles of
 * it, so nothing on the mountain floats, sinks or leaves a seam: every prop
 * asks the function for its footing.
 *
 * Engine yaw: 0 faces −Z, +90 faces −X (Three.js rotation.y).
 */
export type P3 = [number, number, number];
export const RAD = Math.PI / 180;
export const r3 = (v: number): number => Math.round(v * 1000) / 1000;
export const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { const u = clamp(t); return u * u * (3 - 2 * u); };
export const ramp = (v: number, a: number, b: number): number => smooth((v - a) / (b - a || 1));

/** Deterministic lattice hash in 0..1. */
export const hash2 = (x: number, z: number): number => {
  const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
};
/** Smooth value noise in −1..1. */
export const noise2 = (x: number, z: number): number => {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (lerp(lerp(a, b, ux), lerp(c, d, ux), uz)) * 2 - 1;
};
export const fbm = (x: number, z: number, octaves = 3): number => {
  let sum = 0, amp = .5, f = 1;
  for (let i = 0; i < octaves; i++) { sum += noise2(x * f + i * 17.3, z * f - i * 9.1) * amp; amp *= .5; f *= 2.03; }
  return sum;
};

/** Monotone cubic through `[s, y]` nodes: smooth pitches and benches without overshoot. */
export const profile = (nodes: readonly (readonly [number, number])[]): ((s: number) => number) => {
  const n = nodes.length, d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((nodes[i + 1][1] - nodes[i][1]) / (nodes[i + 1][0] - nodes[i][0]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
    if (q > 9) { const t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (s: number): number => {
    if (s <= nodes[0][0]) return nodes[0][1] + m[0] * (s - nodes[0][0]);
    if (s >= nodes[n - 1][0]) return nodes[n - 1][1] + m[n - 1] * (s - nodes[n - 1][0]);
    let i = 0; while (i < n - 2 && s > nodes[i + 1][0]) i++;
    const h = nodes[i + 1][0] - nodes[i][0], t = (s - nodes[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * nodes[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * nodes[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
};

export type Piece = { len: number } | { turn: number; r: number };
export interface Frame { s: number; x: number; z: number; y: number; yaw: number; fx: number; fz: number; rx: number; rz: number; }

/**
 * A route centreline: straights and circular bends in plan (turn > 0 bends
 * left, toward +yaw), with its own elevation profile. Stations are metres
 * along the plan centreline; `lat` is metres to the right of travel.
 */
export class Path {
  readonly length: number;
  private readonly xs: number[] = []; private readonly zs: number[] = []; private readonly yaws: number[] = [];
  private readonly grid = new Map<string, number[]>();
  private static readonly CELL = 12;
  constructor(readonly name: string, x0: number, z0: number, yaw0: number, readonly pieces: readonly Piece[], readonly elev: (s: number) => number) {
    let x = x0, z = z0, yaw = yaw0 * RAD, total = 0;
    for (const piece of pieces) total += 'len' in piece ? piece.len : Math.abs(piece.turn) * RAD * piece.r;
    this.length = total;
    const STEP = .25; let s = 0, pieceIndex = 0, pieceStart = 0;
    const pieceLen = (q: Piece) => 'len' in q ? q.len : Math.abs(q.turn) * RAD * q.r;
    const count = Math.round(total);
    for (let i = 0; i <= count * 4; i++) {
      if (i % 4 === 0) { this.xs.push(x); this.zs.push(z); this.yaws.push(yaw); }
      while (pieceIndex < pieces.length - 1 && s - pieceStart >= pieceLen(pieces[pieceIndex]) - 1e-9) { pieceStart += pieceLen(pieces[pieceIndex]); pieceIndex++; }
      const q = pieces[pieceIndex], k = 'len' in q ? 0 : Math.sign(q.turn) / q.r, mid = yaw + k * STEP / 2;
      x += -Math.sin(mid) * STEP; z += -Math.cos(mid) * STEP; yaw += k * STEP; s += STEP;
    }
    for (let i = 0; i < this.xs.length; i++) {
      const key = `${Math.floor(this.xs[i] / Path.CELL)},${Math.floor(this.zs[i] / Path.CELL)}`;
      const cell = this.grid.get(key); if (cell) cell.push(i); else this.grid.set(key, [i]);
    }
  }
  /** Frame at station `s`; stations beyond either end continue straight. */
  at(s: number): Frame {
    const last = this.xs.length - 1, c = clamp(s, 0, last), i = Math.min(last - 1, Math.floor(c)), t = c - i;
    const yaw = lerp(this.yaws[i], this.yaws[i + 1], t), fx = -Math.sin(yaw), fz = -Math.cos(yaw), over = s - c;
    return { s, x: lerp(this.xs[i], this.xs[i + 1], t) + fx * over, z: lerp(this.zs[i], this.zs[i + 1], t) + fz * over, y: this.elev(s), yaw: yaw / RAD, fx, fz, rx: Math.cos(yaw), rz: -Math.sin(yaw) };
  }
  /** World point at station `s`, `lat` metres right of the centreline, `dy` above the bed. */
  w(s: number, lat = 0, dy = 0): P3 { const f = this.at(s); return [r3(f.x + f.rx * lat), r3(f.y + dy), r3(f.z + f.rz * lat)]; }
  yawAt(s: number): number { return this.at(s).yaw; }
  /** The camera-lane polygon: tangent intersections of every bend, each rounded by its own radius. */
  lane(): { p: P3; radius: number }[] {
    const out: { p: P3; radius: number }[] = [{ p: this.w(0), radius: 0 }]; let s = 0;
    for (const piece of this.pieces) {
      if ('len' in piece) { s += piece.len; continue; }
      const arc = Math.abs(piece.turn) * RAD * piece.r, f = this.at(s), t = piece.r * Math.tan(Math.abs(piece.turn) * RAD / 2);
      out.push({ p: [r3(f.x + f.fx * t), r3(this.elev(s + arc / 2)), r3(f.z + f.fz * t)], radius: piece.r }); s += arc;
    }
    out.push({ p: this.w(this.length), radius: 0 });
    return out;
  }
  /** Nearest centreline station to a world point within `reach` metres, with signed lateral offset. */
  nearest(x: number, z: number, reach: number): { s: number; lat: number; d: number } | null {
    const span = Math.ceil(reach / Path.CELL), cx = Math.floor(x / Path.CELL), cz = Math.floor(z / Path.CELL);
    let best = -1, bestD = reach * reach;
    for (let gx = cx - span; gx <= cx + span; gx++) for (let gz = cz - span; gz <= cz + span; gz++) {
      const cell = this.grid.get(`${gx},${gz}`); if (!cell) continue;
      for (const i of cell) { const dx = x - this.xs[i], dz = z - this.zs[i], d = dx * dx + dz * dz; if (d < bestD) { bestD = d; best = i; } }
    }
    if (best < 0) return null;
    const yaw = this.yaws[best], fx = -Math.sin(yaw), fz = -Math.cos(yaw), dx = x - this.xs[best], dz = z - this.zs[best];
    const along = dx * fx + dz * fz, lat = dx * Math.cos(yaw) + dz * -Math.sin(yaw);
    const s = best + along;
    return { s, lat, d: Math.abs(lat) };
  }
}

/** A carve reshapes the mountain near a route or pad. `w` blends 0..1 toward `y`; `cover` 0..1 marks ground a fine solid patch owns. */
export interface CarveHit { y: number; w: number; cover: number; kind: Ground; /** Metres below the lip, inside a crevasse. */ depth?: number; }
export type Carve = (x: number, z: number) => CarveHit | null;
export type Ground = 'snow' | 'piste' | 'ice' | 'rock' | 'path' | 'crevasse';

/** A crevasse across a route bed between stations `a` and `b`; `lat0`/`lat1` (bed column stations) limit it to part of the width. */
export interface Gap { a: number; b: number; depth: number; lat0?: number; lat1?: number; }
/** How far inside the lips of a crevasse a point lies (zero or less: outside it). */
const gapInset = (g: Gap, s: number, lat: number): number => Math.min(s - g.a, g.b - s, lat - (g.lat0 ?? -Infinity), (g.lat1 ?? Infinity) - lat);
/** Insets of the crevasse's wall rows: the lip, a rim of pale ice, a band of hard blue, then the sheer drop into the dark. */
export const GAP_ROWS = [.055, .105, .16] as const;
const gapDepth = (g: Gap, inset: number): number => inset < .08 ? .4 : inset < .13 ? 1.35 : g.depth;
export interface BedOptions {
  /** Half-width of the flat bed at a station. */ half: number | ((s: number) => number);
  /** Rise of the side banks above the bed, and their run. */ bank?: number; bankRun?: number;
  /** Run over which the banks melt back into the mountain. */ blend?: number;
  /** Depth of the bed's cup across its width. */ cup?: number;
  from?: number; to?: number; kind?: Ground;
  /** Run past either end over which the bed fades out. */ fade?: number;
  /** Crevasses: the bed drops `depth` between stations `a` and `b`, sheer at both lips. */ gaps?: readonly Gap[];
  /** Bank height override per side and station (negative lat = left). */ bankAt?: (s: number, side: -1 | 1) => number;
}
/** A route bed: flat (or cupped) core, raised snow banks, then a blend back into the mountain. */
export const bed = (path: Path, o: BedOptions): Carve => {
  const half = typeof o.half === 'number' ? () => o.half as number : o.half, bank = o.bank ?? 1.2, bankRun = o.bankRun ?? 3, blend = o.blend ?? 10;
  const from = o.from ?? 0, to = o.to ?? path.length, cup = o.cup ?? 0, kind = o.kind ?? 'piste', fade = o.fade ?? 10;
  const reach = Math.max(...[from, (from + to) / 2, to].map(half)) + bankRun + blend + 6;
  return (x, z) => {
    const q = path.nearest(x, z, reach); if (!q) return null;
    // Past either end the bed runs straight on and fades out over `fade` metres: an open mouth, never a cap.
    const over = q.s < from ? from - q.s : q.s > to ? q.s - to : 0;
    if (over > fade) return null;
    const s = clamp(q.s, from, to), u = Math.abs(q.lat), open = 1 - smooth(over / fade);
    const gap = o.gaps?.find(g => gapInset(g, q.s, q.lat) > .03);
    // Just inside each lip the snow gives way to ice that darkens quickly with depth: the rider sees only the top of the far wall.
    const sunk = gap ? gapDepth(gap, gapInset(gap, q.s, q.lat)) : 0;
    const h = half(s), side = q.lat < 0 ? -1 : 1, rise = o.bankAt ? o.bankAt(s, side) : bank, y0 = path.elev(s) - sunk;
    if (gap) { if (u > h + bankRun + blend) return null; const edge = u <= h + bankRun ? 1 : 1 - smooth((u - h - bankRun) / blend); return { y: y0 + (u > h ? rise * smooth((u - h) / bankRun) * .4 : 0), w: edge * open, cover: u <= h + bankRun ? 1 : 0, kind: 'crevasse', depth: sunk }; }
    if (u > h + bankRun + blend) return null;
    if (u <= h) return { y: y0 + cup * (u / h) ** 2, w: open, cover: over > 0 ? 0 : 1, kind };
    if (u <= h + bankRun) { const t = (u - h) / bankRun; return { y: y0 + cup + rise * smooth(t), w: open, cover: over > 0 ? 0 : smooth((1 - t) * 2.5), kind: t < .35 ? kind : 'snow' }; }
    return { y: y0 + cup + rise, w: (1 - smooth((u - h - bankRun) / blend)) * open, cover: 0, kind: 'snow' };
  };
};
/** A level pad: an ellipse of flat ground that melts into the mountain over `blend` metres. */
export const pad = (cx: number, cz: number, rx: number, rz: number, y: number, blend = 8, kind: Ground = 'path'): Carve => (x, z) => {
  const dx = (x - cx) / rx, dz = (z - cz) / rz, d = Math.hypot(dx, dz);
  if (d <= 1) return { y, w: 1, cover: 1, kind };
  const edge = (d - 1) * Math.min(rx, rz); if (edge > blend) return null;
  return { y, w: 1 - smooth(edge / blend), cover: 0, kind: 'snow' };
};

/** A rectangle of level ground (or, with `y` omitted, a pure mask a hand-built structure owns) melting out over `blend` metres. */
export const rectPad = (x0: number, z0: number, x1: number, z1: number, y: number | undefined, blend = 8, kind: Ground = 'path', owned = true): Carve => (x, z) => {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), edge = Math.hypot(dx, dz);
  if (edge <= 0) return { y: y ?? 0, w: y === undefined ? 0 : 1, cover: owned ? 1 : 0, kind: owned ? kind : 'snow' };
  if (y === undefined || edge > blend) return null;
  return { y, w: 1 - smooth(edge / blend), cover: 0, kind: 'snow' };
};

export interface Knoll { x: number; z: number; y: number; r: number; }
export interface MountainSpec { knolls: readonly Knoll[]; carves: readonly Carve[]; rough?: number; roughFree?: number; }
export interface GroundSample { y: number; cover: number; kind: Ground; depth?: number; }

/** The mountain: a kernel blend of height controls, roughened away from the routes, then carved. */
export class Mountain {
  constructor(private readonly spec: MountainSpec) {}
  base(x: number, z: number): number {
    let sum = 0, weight = 0;
    for (const k of this.spec.knolls) { const dx = x - k.x, dz = z - k.z, w = Math.exp(-(dx * dx + dz * dz) / (2 * k.r * k.r)); sum += w * k.y; weight += w; }
    return weight > 1e-9 ? sum / weight : 0;
  }
  sample(x: number, z: number): GroundSample {
    let y = this.base(x, z), cover = 0, kind: Ground = 'snow', free = 1;
    const hits: CarveHit[] = [];
    for (const carve of this.spec.carves) { const hit = carve(x, z); if (hit) hits.push(hit); }
    for (const hit of hits) free = Math.min(free, 1 - hit.w);
    y += (fbm(x / 70, z / 70, 3) * (this.spec.rough ?? 5) + fbm(x / 19, z / 19, 2) * 1.1) * free;
    let depth: number | undefined;
    for (const hit of hits) { y = lerp(y, hit.y, hit.w); if (hit.cover > cover || (hit.kind === 'crevasse' && hit.cover >= cover)) { cover = hit.cover; kind = hit.kind; depth = hit.depth; } }
    return { y, cover, kind, depth };
  }
  y(x: number, z: number): number { return this.sample(x, z).y; }
  normal(x: number, z: number, e = .6): P3 {
    const dx = (this.y(x + e, z) - this.y(x - e, z)) / (2 * e), dz = (this.y(x, z + e) - this.y(x, z - e)) / (2 * e), l = Math.hypot(dx, 1, dz);
    return [-dx / l, 1 / l, -dz / l];
  }
}

const hex = (c: string): P3 => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const mix3 = (a: P3, b: P3, t: number): P3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const CREVASSE_RIM = hex('#93cdee'), CREVASSE_BAND = hex('#2a6fc0'), CREVASSE_DEEP = hex('#0f2c5e');
const SNOW = hex('#f4f7fc'), SNOW_SHADE = hex('#c9d9f0'), PISTE = hex('#e9f0fa'), ROCK_A = hex('#7b7f8e'), ROCK_B = hex('#565a6b'), ICE = hex('#9fd4ee'), PATH = hex('#e2e8f2');
/** Vertex paint: clean snow, blue in the hollows, bare rock where the face is too steep to hold it. */
export const paint = (m: Mountain, x: number, z: number, g: GroundSample, n: P3): P3 => {
  const steep = ramp(1 - n[1], .2, .36), hollow = clamp((m.y(x + 3, z) + m.y(x - 3, z) + m.y(x, z + 3) + m.y(x, z - 3)) / 4 - g.y, -1, 1);
  let c = mix3(SNOW, SNOW_SHADE, clamp(.18 + hollow * .9 + noise2(x / 5, z / 5) * .08));
  if (g.kind === 'piste') c = mix3(c, PISTE, g.cover * (.55 + .2 * Math.sin((x + z) * 2.1)));
  else if (g.kind === 'path') c = mix3(c, PATH, g.cover * .6);
  else if (g.kind === 'ice') c = mix3(c, ICE, g.cover);
  else if (g.kind === 'crevasse') { const d = g.depth ?? 9, t = noise2(x / 1.9, z / 1.9) * .16; return d < .8 ? mix3(CREVASSE_RIM, CREVASSE_BAND, clamp(.12 + t)) : d < 2 ? mix3(CREVASSE_BAND, CREVASSE_DEEP, clamp(.1 + t)) : mix3(CREVASSE_DEEP, CREVASSE_BAND, clamp(.04 + t * .6)); }
  const rock = mix3(ROCK_A, ROCK_B, clamp(.5 + noise2(x / 3.1, g.y / 1.7) * .6 + Math.sin(g.y * 1.9) * .2));
  return mix3(c, rock, steep * (1 - g.cover));
};

export interface PatchOptions { nm: string; grp: number; solid?: boolean; tex?: string; gravityTrack?: boolean; }
/** Points are `[x, z, drop]` plus an optional `[nx, nz]`: where to read the surface normal when the point sits on a sheer lip. */
const meshOf = (m: Mountain, points: readonly (readonly number[])[], cols: number, rows: number, keep: (row: number, col: number) => boolean, o: PatchOptions, alongPath = false): CustomComponent | null => {
  const vertices: number[] = [], colors: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const [x, z, drop, nx, nz] of points) {
    const g = m.sample(x, z), n = m.normal(nx ?? x, nz ?? z), c = paint(m, x, z, g, n);
    vertices.push(r3(x), r3(g.y - drop), r3(z)); normals.push(r3(n[0]), r3(n[1]), r3(n[2])); colors.push(r3(c[0]), r3(c[1]), r3(c[2])); uvs.push(r3(x / 6), r3(z / 6));
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (!keep(row, col)) continue;
    const a = row * (cols + 1) + col, b = a + 1, d = a + cols + 1;
    if (alongPath) indices.push(a, b, d, b, d + 1, d); else indices.push(a, d, b, b, d, d + 1);
  }
  if (!indices.length) return null;
  const solid = o.solid ?? false;
  return { t: 'mesh', p: [0, 0, 0], vertices, normals, colors, uvs, indices, tex: o.tex ?? 'solid', color: '#ffffff', grp: o.grp, nm: o.nm,
    ...(solid ? { smoothCollision: true, ...(o.gravityTrack ? { gravityTrack: true } : {}) } : { solid: false, castShadow: false }) };
};

/**
 * A fine solid patch of the mountain along a route: rows every `step` metres,
 * `lats` lateral stations (metres right of the centreline). The outer column on
 * each side is a skirt that dips under the coarse slopes.
 */
export const pisteMeshes = (m: Mountain, path: Path, from: number, to: number, lats: (s: number) => readonly number[], o: PatchOptions & { step?: number; gaps?: readonly Gap[] }): CustomComponent[] => {
  const step = o.step ?? 1.5, out: CustomComponent[] = [], cols = lats(from).length - 1;
  const gaps = [...(o.gaps ?? [])].filter(g => g.b > from && g.a < to).sort((a, b) => a.a - b.a);
  const perMesh = Math.max(1, Math.floor(Math.min(4096 / (cols + 1) - 1, 4096 / (cols * 2))));
  /** Beside a crevasse the ridden surface keeps the slope's own normal: read it a stride back from the lip, along or across. */
  const normalFrom = (st: number, lat: number): [number, number] | [] => {
    for (const g of gaps) {
      const l0 = g.lat0 ?? -Infinity, l1 = g.lat1 ?? Infinity;
      const nearS = (Math.abs(st - g.a) < 1.6 || Math.abs(st - g.b) < 1.6) && lat > l0 - 1.6 && lat < l1 + 1.6;
      const nearLat = st > g.a - 1.6 && st < g.b + 1.6 && (Math.abs(lat - l0) < 1.6 || Math.abs(lat - l1) < 1.6);
      if (!nearS && !nearLat) continue;
      const s2 = nearS ? (Math.abs(st - g.a) < 1.6 ? g.a - 1.7 : g.b + 1.7) : st, lat2 = nearLat && !nearS ? (Math.abs(lat - l0) < 1.6 ? l0 - 1.7 : l1 + 1.7) : lat, f = path.at(s2);
      return [f.x + f.rx * lat2, f.z + f.rz * lat2];
    }
    return [];
  };
  const emit = (stations: readonly number[], solid: boolean, nm: string, laterals: (s: number) => readonly number[] = lats, keep: (row: number, col: number) => boolean = () => true) => {
    const n = laterals(stations[0]).length - 1, per = Math.max(1, Math.floor(Math.min(4096 / (n + 1) - 1, 4096 / (n * 2))));
    for (let start = 0; start < stations.length - 1; start += per) {
      const rows = Math.min(per, stations.length - 1 - start), points: number[][] = [];
      for (let row = 0; row <= rows; row++) {
        const st = stations[start + row], f = path.at(st), ls = laterals(st);
        ls.forEach((lat, i) => points.push([f.x + f.rx * lat, f.z + f.rz * lat, solid && laterals === lats && (i === 0 || i === n) ? .45 : 0, ...(solid ? normalFrom(st, lat) : [])]));
      }
      const mesh = meshOf(m, points, n, rows, keep, { ...o, solid, gravityTrack: solid && o.gravityTrack, nm }, true);
      if (mesh) out.push(mesh);
    }
  };
  void perMesh;
  let cursor = from, part = 1;
  const span = (a: number, b: number) => { const n = Math.max(1, Math.round((b - a) / step)); return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n); };
  for (const g of [...gaps, null]) {
    const end = g ? g.a : to;
    if (end > cursor + .01) emit(span(cursor, end), true, `${o.nm} ${part++}`);
    if (!g) break;
    const base = lats(g.a), l0 = g.lat0 ?? -Infinity, l1 = g.lat1 ?? Infinity, partial = Number.isFinite(l0) || Number.isFinite(l1);
    // Where the crevasse takes only part of the width, the rest of the bed rides straight on beside it.
    if (partial) emit(span(g.a, g.b), true, `${o.nm} ${part++}`, lats, (_, col) => !(base[col] >= l0 - 1e-6 && base[col + 1] <= l1 + 1e-6));
    // The crevasse itself is seen, never stood on: the lip, a shelf of ice, the sheer drop, the floor.
    const inside = base.filter(v => v > l0 + .3 && v < l1 - .3), deep = GAP_ROWS[GAP_ROWS.length - 1];
    const across = [...(Number.isFinite(l0) ? [l0, ...GAP_ROWS.map(v => l0 + v)] : []), ...inside, ...(Number.isFinite(l1) ? [...GAP_ROWS.map(v => l1 - v).reverse(), l1] : [])];
    emit([g.a, ...GAP_ROWS.map(v => g.a + v), ...span(g.a + deep, g.b - deep).slice(1, -1), ...GAP_ROWS.map(v => g.b - v).reverse(), g.b], false, `${o.nm}: crevasse ${g.a.toFixed(0)}`, () => across);
    cursor = g.b;
  }
  return out;
};

/** A fine solid patch over a rectangle of the mountain (pads, shores, landings). */
export const padMeshes = (m: Mountain, x0: number, z0: number, x1: number, z1: number, cell: number, o: PatchOptions): CustomComponent[] => {
  const cols = Math.max(1, Math.round((x1 - x0) / cell)), rowsAll = Math.max(1, Math.round((z1 - z0) / cell)), out: CustomComponent[] = [];
  const perMesh = Math.max(1, Math.floor(Math.min(4096 / (cols + 1) - 1, 4096 / (cols * 2))));
  for (let start = 0; start < rowsAll; start += perMesh) {
    const rows = Math.min(perMesh, rowsAll - start), points: [number, number, number][] = [];
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) points.push([lerp(x0, x1, col / cols), lerp(z0, z1, (start + row) / rowsAll), 0]);
    const mesh = meshOf(m, points, cols, rows, () => true, { ...o, solid: true, nm: `${o.nm} ${out.length + 1}` });
    if (mesh) out.push(mesh);
  }
  return out;
};

/** Coarse visual slopes over a rectangle. Quads a fine patch owns outright are left out; the rest sink a little beneath it. */
export const slopeMeshes = (m: Mountain, x0: number, z0: number, x1: number, z1: number, cell: number, o: PatchOptions & { wanted?: (x: number, z: number) => boolean }): CustomComponent[] => {
  const colsAll = Math.max(1, Math.round((x1 - x0) / cell)), rowsAll = Math.max(1, Math.round((z1 - z0) / cell)), out: CustomComponent[] = [];
  const tile = 44;
  for (let rowStart = 0; rowStart < rowsAll; rowStart += tile) for (let colStart = 0; colStart < colsAll; colStart += tile) {
    const rows = Math.min(tile, rowsAll - rowStart), cols = Math.min(tile, colsAll - colStart), points: [number, number, number][] = [], covered: boolean[] = [];
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const x = lerp(x0, x1, (colStart + col) / colsAll), z = lerp(z0, z1, (rowStart + row) / rowsAll), cover = m.sample(x, z).cover;
      points.push([x, z, cover > .02 ? .9 * smooth(cover * 3) : 0]); covered.push(cover > .98 || (o.wanted ? !o.wanted(x, z) : false));
    }
    const mesh = meshOf(m, points, cols, rows, (row, col) => { const a = row * (cols + 1) + col; return !(covered[a] && covered[a + 1] && covered[a + cols + 1] && covered[a + cols + 2]); }, { ...o, nm: `${o.nm} ${out.length + 1}` });
    if (mesh) out.push(mesh);
  }
  return out;
};
