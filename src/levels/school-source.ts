import { Vector3 } from 'three';
import source from '../../docs/school/source-geometry.json';
import type { CustomComponent, CustomLevelData } from '../level';

type P = [number, number, number];
type Face = { id: string; object: number; points: P[]; normal: Vector3; flags: number; collision: number; color: number[] };
// Match the animated original board-to-head coast pose to our existing rider.
// The opt-in source movement parameters below preserve the original gym lips
// at this scale; no character dimensions or global tuning are changed.
export const SCHOOL_SOURCE_SCALE = 2.9 / 208.1875;
export const SCHOOL_SOURCE_ORIGIN: P = [-6149, 1599, 6391];
export const schoolSourcePoint = (x: number, y: number, z: number): P => [
  -(x - SCHOOL_SOURCE_ORIGIN[0]) * SCHOOL_SOURCE_SCALE,
  (y - SCHOOL_SOURCE_ORIGIN[1]) * SCHOOL_SOURCE_SCALE,
  (z - SCHOOL_SOURCE_ORIGIN[2]) * SCHOOL_SOURCE_SCALE,
];
export const schoolOriginalPoint = (x: number, y: number, z: number): P => [
  SCHOOL_SOURCE_ORIGIN[0] - x / SCHOOL_SOURCE_SCALE,
  SCHOOL_SOURCE_ORIGIN[1] + y / SCHOOL_SOURCE_SCALE,
  SCHOOL_SOURCE_ORIGIN[2] + z / SCHOOL_SOURCE_SCALE,
];
const key = (p: P) => p.map(v => Math.round(v * 1e5)).join(',');
const edgeKey = (a: P, b: P) => [key(a), key(b)].sort().join('|');
const normal = (a: P, b: P, c: P) => new Vector3(...b).sub(new Vector3(...a)).cross(new Vector3(...c).sub(new Vector3(...a))).normalize();
const faces: Face[] = [], edges = new Map<string, number[]>();
for (const mesh of source.meshes) {
  const vertices = Array.from({ length: mesh.vertices.length / 3 }, (_, i) => schoolSourcePoint(...mesh.vertices.slice(i * 3, i * 3 + 3) as P));
  for (const f of mesh.faces) {
    // X reflection changes winding. Retain each original polygon boundary.
    const points = f.slice(6).reverse().map(i => vertices[i]);
    const n = normal(points[0], points[1], points[2]);
    if (n.lengthSq() < .5) continue;
    const index = faces.length;
    faces.push({ id: `${mesh.id}:${f[0]}`, object: mesh.id, points, normal: n, flags: f[1], collision: f[2], color: f.slice(3, 6) });
    for (let j = 0; j < points.length; j++) {
      const k = edgeKey(points[j], points[(j + 1) % points.length]);
      if (!edges.has(k)) edges.set(k, []);
      edges.get(k)!.push(index);
    }
  }
}
// 0x1 disables collision; 0x2 is a trigger plane, explicitly non-solid.
const isSolid = (f: Face) => !(f.collision & 3);
const invisible = (f: Face) => !!(f.flags & 0x80) && !(f.flags & 0x40);
// Source VERT is an upper-face flag. Follow its connected, smoothly changing
// skateable slope down to the toe, across object/material storage boundaries.
const transitions = new Set<number>(), queue: number[] = [];
faces.forEach((f, i) => { if (isSolid(f) && (f.collision & 0x40) && !(f.collision & 0x100) && f.normal.y >= -.1) { transitions.add(i); queue.push(i); } });
for (let q = 0; q < queue.length; q++) {
  const f = faces[queue[q]];
  for (let j = 0; j < f.points.length; j++) for (const i of edges.get(edgeKey(f.points[j], f.points[(j + 1) % f.points.length])) ?? []) {
    const g = faces[i];
    if (transitions.has(i) || !isSolid(g) || (g.collision & 0x100) || g.normal.y < -.1 || g.normal.y > .9995 || g.normal.dot(f.normal) < .7) continue;
    transitions.add(i); queue.push(i);
  }
}
const tangentNormals = new Map<string, Vector3>(), verticalNormals = new Map<string, Vector3>();
for (const i of transitions) {
  const f = faces[i];
  for (const p of f.points) {
    const k = key(p);
    if (!tangentNormals.has(k)) tangentNormals.set(k, new Vector3());
    tangentNormals.get(k)!.add(f.normal);
    if (Math.abs(f.normal.y) < .001) {
      if (!verticalNormals.has(k)) verticalNormals.set(k, new Vector3());
      verticalNormals.get(k)!.add(f.normal);
    }
  }
}
for (const [k, n] of tangentNormals) n.copy(verticalNormals.get(k) ?? n).normalize();

type Triangle = { points: [P, P, P]; normal: Vector3; object: number };
const floor: Triangle[] = [];
for (const f of faces) if (isSolid(f) && f.normal.y > .001) for (let j = 1; j < f.points.length - 1; j++) floor.push({ points: [f.points[0], f.points[j], f.points[j + 1]], normal: f.normal, object: f.object });
export function schoolMeasuredSupport(x: number, z: number, ceiling = Infinity, lowest = false): number {
  let height = lowest ? Infinity : -Infinity;
  for (const { points: [a, b, c] } of floor) {
    if (x < Math.min(a[0], b[0], c[0]) - 1e-6 || x > Math.max(a[0], b[0], c[0]) + 1e-6 || z < Math.min(a[2], b[2], c[2]) - 1e-6 || z > Math.max(a[2], b[2], c[2]) + 1e-6) continue;
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) continue;
    const h = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    if (h <= ceiling && (lowest ? h < height : h > height)) height = h;
  }
  return height;
}
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
export const SCHOOL_SOURCE_STATS = { sourceObjects: source.meshes.length, sourceFaces: faces.length, sourceRailNodes: source.railNodes.length, activeRailNodes: source.railActivation.activeNodes, transitionFaces: transitions.size, wallSegments: 0, railEdges: 0, railSegments: 0, railPaths: 0 };
type Batch = { vertices: number[]; indices: number[]; normals: number[]; solid: boolean; vert: boolean; hidden: boolean; color: string; tex: string };
const batches = new Map<string, Batch>();
for (const [i, f] of faces.entries()) {
  const vert = transitions.has(i), solid = isSolid(f), hidden = invisible(f);
  if (hidden && !solid) continue;
  const terrain = (f.collision >> 9) & 15;
  const color = terrain === 2 ? '#bb9c70' : terrain === 11 ? '#829176' : terrain === 5 ? '#6f8992' : f.normal.y < -.3 ? '#858c87' : f.normal.y > .6 ? '#abb6ae' : '#8c9996';
  const tex = terrain === 2 ? 'wood' : f.normal.y > .6 ? 'pavement' : 'stone';
  const centre = f.points.reduce((p, q) => p.map((v, j) => v + q[j] / f.points.length) as P, [0, 0, 0] as P);
  // Bound render/contact batches spatially. Authored normals cross storage
  // boundaries; the preview retains the original polygon stations.
  const k = `${Math.floor(centre[0] / 40)}:${Math.floor(centre[2] / 40)}:${solid}:${vert}:${hidden}:${color}:${tex}`;
  if (!batches.has(k)) batches.set(k, { vertices: [], indices: [], normals: [], solid, vert, hidden, color, tex });
  const b = batches.get(k)!, base = b.vertices.length / 3;
  for (const p of f.points) { b.vertices.push(...p); b.normals.push(...(vert ? tangentNormals.get(key(p))! : f.normal).toArray()); }
  for (let j = 1; j < f.points.length - 1; j++) b.indices.push(base, base + j, base + j + 1);
}
for (const b of batches.values()) {
  // Split by complete triangles and keep bounded native component arrays.
  for (let start = 0; start < b.indices.length; start += 3600) {
    const vertices: number[] = [], indices: number[] = [], normals: number[] = [], remap = new Map<number, number>();
    for (const i of b.indices.slice(start, start + 3600)) {
      if (!remap.has(i)) { remap.set(i, remap.size); vertices.push(...b.vertices.slice(i * 3, i * 3 + 3)); normals.push(...b.normals.slice(i * 3, i * 3 + 3)); }
      indices.push(remap.get(i)!);
    }
    add({ t: 'mesh', p: [0, 0, 0], vertices, indices, normals, solid: b.solid, vert: b.vert, smoothCollision: b.vert, ...(b.vert ? { skateCamera: true } : {}), invisible: b.hidden, color: b.color, tex: b.tex, doubleSided: false, edgeGrinding: false, grp: 1, nm: b.vert ? 'School measured transition' : b.solid ? 'School measured architecture' : 'School measured scenery' });
  }
}

export const SCHOOL_SOURCE_WALLS: { a: P; b: P; height: number; heights: [number, number]; face: string }[] = [];
// Reassemble coplanar polygons before making native wall contacts. Treating
// each original triangle separately creates thousands of tiny diagonal walls.
// Cross-section unions preserve openings and elevated lintels in each plane.
type WallPlane = { ux: number; uz: number; offset: number; faces: Face[] };
const wallPlanes = new Map<string, WallPlane>();
for (const [i, f] of faces.entries()) {
  if (!isSolid(f) || transitions.has(i) || Math.abs(f.normal.y) > .025) continue;
  let nx = f.normal.x, nz = f.normal.z; const n = Math.hypot(nx, nz); nx /= n; nz /= n;
  if (nx < -.00001 || (Math.abs(nx) < .00001 && nz < 0)) { nx = -nx; nz = -nz; }
  const offset = nx * f.points[0][0] + nz * f.points[0][2];
  const k = [nx, nz, offset].map(v => Math.round(v * 10000)).join(':');
  if (!wallPlanes.has(k)) wallPlanes.set(k, { ux: -nz, uz: nx, offset, faces: [] });
  wallPlanes.get(k)!.faces.push(f);
}
for (const plane of wallPlanes.values()) {
  const { ux, uz, offset } = plane, nx = uz, nz = -ux;
  const along = (p: P) => p[0] * ux + p[2] * uz;
  const ranges = plane.faces.map(f => ({ f, lo: Math.min(...f.points.map(along)), hi: Math.max(...f.points.map(along)) }));
  const stations = [...new Set(ranges.flatMap(({ f }) => f.points.map(p => Math.round(along(p) * 1e5) / 1e5)))].sort((a, b) => a - b);
  const section = (f: Face, s: number): [number, number] => {
    const ys: number[] = [];
    for (let j = 0; j < f.points.length; j++) {
      const p = f.points[j], q = f.points[(j + 1) % f.points.length], u = along(p), v = along(q);
      if (s < Math.min(u, v) - 1e-4 || s > Math.max(u, v) + 1e-4) continue;
      if (Math.abs(v - u) < 1e-5) ys.push(p[1], q[1]);
      else ys.push(p[1] + (q[1] - p[1]) * (s - u) / (v - u));
    }
    return [Math.min(...ys), Math.max(...ys)];
  };
  for (let j = 1; j < stations.length; j++) {
    const lo = stations[j - 1], hi = stations[j]; if (hi - lo < .02) continue;
    const active = ranges.filter(r => r.lo < (lo + hi) / 2 && r.hi > (lo + hi) / 2).map(r => ({ f: r.f, interval: section(r.f, (lo + hi) / 2) })).sort((a, b) => a.interval[0] - b.interval[0]);
    const spans: { lo: number; hi: number; faces: Face[] }[] = [];
    for (const { f, interval: [low, high] } of active) {
      const last = spans[spans.length - 1];
      if (last && low <= last.hi + .001) { last.hi = Math.max(last.hi, high); last.faces.push(f); }
      else spans.push({ lo: low, hi: high, faces: [f] });
    }
    for (const span of spans) {
      const limits = (s: number): [number, number] => {
        const bounds = span.faces.map(f => section(f, s));
        return [Math.min(...bounds.map(b => b[0])), Math.max(...bounds.map(b => b[1]))];
      };
      const [yl, yh] = limits(lo), [zl, zh] = limits(hi);
      const heights: [number, number] = [Math.max(0, yh - yl), Math.max(0, zh - zl)], height = Math.max(...heights);
      if (!Number.isFinite(height) || height < .2) continue;
      const p: P = [nx * offset + lo * ux, yl, nz * offset + lo * uz], q: P = [nx * offset + hi * ux, zl, nz * offset + hi * uz];
      const mid: P = p.map((v, n) => (v + q[n]) / 2) as P, top = (yh + zh) / 2;
      if ([-1, 1].every(side => schoolMeasuredSupport(mid[0] + nx * .02 * side, mid[2] + nz * .02 * side, top + .01) >= top - .03)) continue;
      const face = span.faces.map(f => f.id).join('/');
      SCHOOL_SOURCE_WALLS.push({ a: p, b: q, height, heights, face });
      add({ t: 'wallpath', p, pts: [[0, 0, 0, 0], [q[0] - p[0], q[2] - p[2], 0, q[1] - p[1]]], w: .1, rise: height, wallHeights: heights, invisible: true, edgeGrinding: false, curve: 'corner', grp: 2, nm: `School measured wall ${span.faces[0].id}` });
    }
  }
}
SCHOOL_SOURCE_STATS.wallSegments = SCHOOL_SOURCE_WALLS.length;

// Each original normal-start pulse constructs one directed rail chain. Keep
// those boundaries and their intentional overlaps; do not join a raw graph
// through an endpoint or activate the alternate-mode-only rail 189 -> 190.
const nodeById = new Map(source.railNodes.map(n => [n.id, n]));
export const SCHOOL_SOURCE_RAILS: { ids: number[]; points: P[]; closed: boolean; coping: boolean }[] = [];
// TRG knots can sit just outside a polygon edge, and short end caps can hang
// beyond the bank. Measure the neighbouring riding surface along the span:
// a flush edge is coping, while a rail suspended over the floor is a barrier.
function measuredCoping(points: P[], closed: boolean): boolean {
  let supportedLength = 0, totalLength = 0;
  for (let i = 0; i < points.length - (closed ? 0 : 1); i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    if (length < .01) continue;
    for (const t of [.25, .5, .75]) {
      const p = a.map((v, j) => v + (b[j] - v) * t) as P;
      const flush = [-1, 1].some(side => {
        const y = schoolMeasuredSupport(p[0] - dz / length * .3 * side, p[2] + dx / length * .3 * side, p[1] + .2);
        return Math.abs(p[1] - y) < .2;
      });
      totalLength += length / 3;
      if (flush) supportedLength += length / 3;
    }
  }
  return totalLength > 0 && supportedLength / totalLength >= .9;
}
for (const ids of source.railActivation.paths) {
  const closed = false;
  const points = ids.map(i => schoolSourcePoint(...nodeById.get(i)!.position as P));
  if (points.every(p => new Vector3(...p).distanceTo(new Vector3(...points[0])) < .01)) throw Error('Degenerate activated School rail');
  const coping = measuredCoping(points, closed);
  const p = points[0]; SCHOOL_SOURCE_RAILS.push({ ids, points, closed, coping });
  add({ t: 'rail', p, pts: points.map(q => [q[0] - p[0], q[2] - p[2], 0, q[1] - p[1]]), closed, coping, curve: 'corner', invisible: true, edgeGrinding: false, grp: 3, nm: `School original rail ${ids[0]}–${ids[ids.length - 1]}` });
}
SCHOOL_SOURCE_STATS.railEdges = source.railActivation.activeUniqueEdges;
SCHOOL_SOURCE_STATS.railSegments = source.railActivation.activeSegments;
SCHOOL_SOURCE_STATS.railPaths = SCHOOL_SOURCE_RAILS.length;

export const SCHOOL_SOURCE_PLACES: { name: string; source: P; heading: P }[] = [
  // TRG yaw 1023 becomes +X in FudgeAngles, but HandleKick accelerates
  // along -mFront. Reflect that travel direction in X: native +X (east).
  { name: 'Start', source: [-6149, 2792, 6391], heading: [1, 0, 0] },
  { name: 'Courtyard', source: [-11718, 231, -6274], heading: [0, 0, -1] },
  { name: 'Gym', source: [-15150, 1650, 11000], heading: [-1, 0, 0] },
  { name: 'Gym roof', source: [-18000, 3100, 15000], heading: [0, 0, -1] },
  { name: 'Pools', source: [5467, 50, -2970], heading: [-1, 0, 0] },
  { name: 'Halfpipe', source: [2752, 100, -9011], heading: [1, 0, 0] },
  { name: 'Street', source: [-2053, 235, -12212], heading: [1, 0, 0] },
];
export function schoolSourcePlacement(place: typeof SCHOOL_SOURCE_PLACES[number]): P {
  const p = schoolSourcePoint(...place.source); p[1] = schoolMeasuredSupport(p[0], p[2], p[1] + .2) + .12; return p;
}
for (const place of SCHOOL_SOURCE_PLACES.slice(1)) add({ t: 'checkpoint', p: schoolSourcePlacement(place), nm: place.name, grp: 4 });
for (const place of SCHOOL_SOURCE_PLACES) add({ t: 'camnode', p: schoolSourcePlacement(place), grp: 4 });
const spawn = schoolSourcePlacement(SCHOOL_SOURCE_PLACES[0]);
add({ t: 'zone', p: spawn, s: [28, 3, 8], dir: 'E', grp: 4, nm: 'Original starting canopy direction' });
export const SCHOOL_SOURCE_LEVEL: CustomLevelData = {
  v: 1, name: 'School · measured geometry', spawn, killY: -42, skatepark: true,
  skateReference: { kind: 'thps1', metresPerUnit: SCHOOL_SOURCE_SCALE, stats: { ollie: 4, speed: 8, air: 8 } },
  sky: 'day', keepPlayFog: true,
  atmosphere: { fogEnabled: true, fogNear: 270, fogFar: 610, fogColor: '#b3c1bc', backdrop: 'fog', ambientSky: '#e0eced', ambientGround: '#7b8071', ambientIntensity: 1.15, sunColor: '#fff0d1', sunIntensity: 1.35, fillColor: '#a6c8d0', fillIntensity: .4, drawDistance: 700, shadowStrength: .65 },
  components: C,
  groups: ['Measured surfaces', 'Measured walls', 'Original grind graph', 'Session recovery'].map((nm, i) => ({ id: i + 1, nm, editorOnly: true })),
};
