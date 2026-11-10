import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { TEMPLE_NIGHT_ATMOSPHERE } from './temple-night-atmosphere';

/**
 * TEMPLE OF EMBERS · fifth design: the switchback temple.
 *
 * The course is a chain of seven legs that turn at right angles, climb, and
 * double back over the start, in the manner of the Famitsu isometric maps of
 * Crash 2 and 3 (Ruination's pillar chains and walled saves, Road to Ruin's
 * zig-zag walkways and covered rooms, Tomb Time's right-angle corridors and
 * fork, Sphynxinator's rejoining routes, Cold Hard Crash's side-scroll strip).
 * Plan view: north up the ravine floor, west along a pillar chain, north up
 * six fallen ledges to a roofed court, east along a side-scroll broken stair,
 * south down the sluice and along an aqueduct that runs the length of the
 * ravine's east rim sixteen metres above the start, east through the cistern,
 * north up the sanctuary steps to the terrace and the gate.
 *
 * Authoring is in STATION SPACE: one continuous station s along the whole
 * route, x across it (negative left, positive right), y up. A leg table maps
 * (s, x) to the world through its own yaw and origin, so every helper below
 * still reads like the straight course it grew from. Engine yaw: 0 faces −Z
 * and +90 faces −X (Three.js rotation.y), the same convention as every
 * component's `yaw`.
 */
type P = [number, number, number];
type Kind = NonNullable<CustomComponent['kind']>;
type Foe = NonNullable<CustomComponent['foe']>;
type Decor = NonNullable<CustomComponent['dkind']>;
export interface TemplePipe { name: string; a: number; b: number; lipY: number; radius: number; arc: number; baseY: number; }
export interface TempleGap { a: number; b: number; y: number; switchX?: number; group?: number; }
export interface TempleRoom { name: string; a: number; b: number; mode: 'foot' | 'board' | 'rest'; lesson: string; }
export interface TempleClimb { a: number; b: number; base: number; top: number; steps: number; side: number; }
export interface TempleVoid { a: number; b: number; floorY: number; name: string; }
export type TempleChapter = TempleRoom;
export interface TempleLedge { s: number; x: number; y: number; w: number; d: number; name: string; }
export interface TempleSetPieces {
  ledges: TempleLedge[]; plinths: TempleLedge[]; censers: { s: number; x: number; pivotY: number; len: number; amp: number; speed: number; phase: number }[];
  sentinels: { s: number; x: number; y: number; facing: number; cycle: number; amp: number; name: string }[];
  rails: { a: number; b: number; x: number; xb?: number; ya: number; yb: number; name: string }[];
}
/** One straight leg of the route: stations `a..b` run from `origin` along the heading `yaw`. */
export interface TempleLeg { a: number; b: number; yaw: number; ox: number; oz: number; name: string; laneEnd?: number; y0: number; y1: number; }
export interface TempleFrame { x: number; z: number; fx: number; fz: number; rx: number; rz: number; scale: number; yaw: number; }
export interface TempleRoute {
  id: string; data: CustomLevelData; sourceComponents: CustomComponent[];
  toWorld: (s: number, y: number, side?: number) => P; toLocal: (p: readonly number[]) => P;
  frameAt: (s: number) => TempleFrame; groundAt: (s: number) => number;
  profile: readonly (readonly [number, number])[]; pipes: TemplePipe[]; gaps: TempleGap[]; rooms: TempleRoom[]; climbs: TempleClimb[];
  voids: TempleVoid[]; chapters: TempleChapter[]; setPieces: TempleSetPieces; tikiTrials: { s: number; side: number }[];
  peak: number; end: number; countedCrates: number; checks: string[];
  floors: readonly TempleFloor[]; floorAt: (s: number, x?: number) => number | undefined; legs: readonly TempleLeg[];
}
/** A registered walking surface. `x0..x1` is the lateral extent; when `xa`/`xb` are
 * given they are the centreline x at `a` and `b` and `x0..x1` are offsets from the
 * interpolated centreline (used by swept channels whose centre drifts). */
export interface TempleFloor { a: number; b: number; ya: number; yb: number; x0: number; x1: number; xa?: number; xb?: number; kind: 'main' | 'ledge' | 'side'; nm: string; }
export const templeFloorCentre = (f: TempleFloor, s: number): number => f.xa === undefined || f.xb === undefined ? 0 : f.xa + (f.xb - f.xa) * (s - f.a) / (f.b - f.a || 1);

const STONE = '#c8bc94', JADE = '#79a996', GOLD = '#cfb36c', CRATE = 1.152;
/** A quarter pipe laid across the course, its wall rising away from a rider who arrives along the leg. */
const QUARTER_YAW = 90;
/** Height of the cistern's exit gallery; the sanctuary steps climb from it to the terrace at 30. */
const GALLERY = 19.5;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const G = { ground: 1, masonry: 2, lines: 3, crates: 4, course: 5, camera: 6, hazards: 7, patrols: 8, promise: 41, landscape: 90, planting: 91, lamps: 92, bounds: 93 };

// ---- the route: seven legs, one continuous station axis ------------------
// Station boundaries: L1 −18..149 (north, the ravine floor and its corner court), L2 149..235 (west, the pillar
// chain and the landing court), L3 235..311 (north, the fallen ledges and the roofed fuse court), L4 311..406 (east,
// the side-scroll stair and the stair top), L5 406..640 (south, the sluice and the aqueduct back over the start),
// L6 640..728 (east, the cistern), L7 728..860 (north, the sanctuary steps and the terrace).
export const TEMPLE_LEGS: readonly TempleLeg[] = [
  { a: -18, b: 149, yaw: 0, ox: 0, oz: 18, name: 'Ravine floor', laneEnd: 137, y0: 4, y1: 0 },
  { a: 149, b: 235, yaw: 90, ox: -8, oz: -137, name: 'Pillar chain', laneEnd: 220, y0: 0, y1: 8 },
  { a: 235, b: 311, yaw: 0, ox: -79, oz: -147, name: 'Fallen ledges', laneEnd: 294, y0: 8, y1: 16 },
  { a: 311, b: 406, yaw: -90, ox: -69, oz: -206, name: 'Broken stair', laneEnd: 396, y0: 16, y1: 24 },
  { a: 406, b: 640, yaw: 180, ox: 16, oz: -198, name: 'Sluice and aqueduct', laneEnd: 631, y0: 22, y1: 16 },
  { a: 640, b: 728, yaw: -90, ox: 24, oz: 27, name: 'Cistern', laneEnd: 724, y0: 16, y1: 19.5 },
  { a: 728, b: 860, yaw: 0, ox: 108, oz: 19, name: 'Sanctuary', y0: 20, y1: 30 },
];
/** The leg owning a station: a boundary station belongs to the leg that starts there, so a piece authored at a leg's first station is built in that leg's frame. */
const legAt = (s: number): TempleLeg => TEMPLE_LEGS.find(l => s >= l.a && s < l.b) ?? (s < TEMPLE_LEGS[0].a ? TEMPLE_LEGS[0] : TEMPLE_LEGS[TEMPLE_LEGS.length - 1]);
const legFrame = (l: TempleLeg): { fx: number; fz: number; rx: number; rz: number } => { const t = l.yaw * Math.PI / 180; return { fx: -Math.sin(t), fz: -Math.cos(t), rx: Math.cos(t), rz: -Math.sin(t) }; };
export const templeFrameAt = (s: number): TempleFrame => { const l = legAt(s), f = legFrame(l), d = s - l.a; return { x: l.ox + f.fx * d, z: l.oz + f.fz * d, ...f, scale: 1, yaw: l.yaw }; };
export const templeToWorld = (s: number, y: number, x = 0): P => { const l = legAt(s), f = legFrame(l), d = s - l.a; return [r4(l.ox + f.fx * d + f.rx * x), r4(y), r4(l.oz + f.fz * d + f.rz * x)]; };
/** The station and lateral offset of a world point: the leg whose centreline passes nearest at that height, courts and
 * corners included. The aqueduct runs sixteen metres above the ravine floor, so height weighs in the choice. */
export const templeToLocal = (p: readonly number[]): P => {
  let best: { s: number; x: number; cost: number } | null = null;
  for (const l of TEMPLE_LEGS) {
    const f = legFrame(l), dx = p[0] - l.ox, dz = p[2] - l.oz, d = dx * f.fx + dz * f.fz, x = dx * f.rx + dz * f.rz, s = l.a + d;
    const t = Math.max(0, Math.min(1, d / (l.b - l.a))), ly = l.y0 + (l.y1 - l.y0) * t;
    const over = Math.max(0, l.a - 6 - s, s - l.b - 6), cost = Math.abs(x) + over * 4 + Math.max(0, Math.abs(p[1] - ly) - 3) * 1.5;
    if (!best || cost < best.cost) best = { s, x, cost };
  }
  return [r4(best!.s), r4(p[1]), r4(best!.x)];
};

type Floor = TempleFloor;
interface PlacedCrate { s: number; x: number; y: number; kind: Kind; nm: string; flags: Set<string>; }
interface Scenery { s: number; x: number; y: number; radius: number; nm: string; }

export function buildTempleOfEmbers(): TempleRoute {
  const C: CustomComponent[] = [];
  const groups: CustomGroup[] = [
    { id: G.ground, nm: 'Ravine floors and ramps', editorOnly: true }, { id: G.masonry, nm: 'Bonded temple masonry', editorOnly: true },
    { id: G.lines, nm: 'Grind lines and fruit', editorOnly: true }, { id: G.crates, nm: 'Crates', editorOnly: true },
    { id: G.course, nm: 'Checkpoints, bonus and finish', editorOnly: true }, { id: G.camera, nm: 'Camera spine and travel zones', editorOnly: true },
    { id: G.hazards, nm: 'Fire sentinels and censers', editorOnly: true }, { id: G.patrols, nm: 'Patrols', editorOnly: true },
    { id: G.landscape, nm: 'Ravine walls and stones', editorOnly: true }, { id: G.planting, nm: 'Treehouse planting', editorOnly: true },
    { id: G.lamps, nm: 'Braziers and lamps', editorOnly: true }, { id: G.bounds, nm: 'Containment', editorOnly: true },
    // A gameplay group (not editor-only): breakable crates in it start as outline ghosts until its '!' fires.
    { id: G.promise, nm: 'Cornice switch and the crates it promises' },
  ];
  const add = (c: CustomComponent) => C.push(c);
  const pt = (s: number, y: number, x = 0): P => templeToWorld(s, y, x);
  const yawAt = (s: number) => legAt(s).yaw;
  /** A world-space offset for the (Δs, Δx) step of a point list that stays inside one leg. */
  const dvec = (s: number, ds: number, dx: number): [number, number] => { const f = legFrame(legAt(s)); return [r4(dx * f.rx + ds * f.fx), r4(dx * f.rz + ds * f.fz)]; };

  // ---- registries --------------------------------------------------------
  const floors: Floor[] = [], crates: PlacedCrate[] = [], scenery: Scenery[] = [], pits: { a: number; b: number; x0: number; x1: number }[] = [];
  const checkpoints: { s: number; x: number; nm: string }[] = [], patrols: { s: number; x: number; y: number; along: boolean; range: number; foe: Foe; nm: string }[] = [];
  const rooms: TempleRoom[] = [], gaps: TempleGap[] = [], voids: TempleVoid[] = [], pipes: TemplePipe[] = [];
  const setPieces: TempleSetPieces = { ledges: [], plinths: [], censers: [], sentinels: [], rails: [] };
  const floorAt = (s: number, x = 0): number | undefined => {
    let best: number | undefined;
    for (const f of floors) if (s >= f.a - 1e-6 && s <= f.b + 1e-6 && x - templeFloorCentre(f, s) >= f.x0 - 1e-6 && x - templeFloorCentre(f, s) <= f.x1 + 1e-6) {
      const y = f.ya + (f.yb - f.ya) * (s - f.a) / (f.b - f.a || 1); if (best === undefined || y > best) best = y;
    }
    return best;
  };
  /** Height of the main route at a station; across a chasm it is the line between the floors either side. */
  const mainFloorAt = (s: number): number => {
    const main = floors.filter(q => q.kind === 'main');
    const f = main.filter(q => s >= q.a - 1e-6 && s <= q.b + 1e-6).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0];
    if (f) return r4(f.ya + (f.yb - f.ya) * (s - f.a) / (f.b - f.a || 1));
    const before = main.filter(q => q.b < s).sort((p, q) => q.b - p.b)[0], after = main.filter(q => q.a > s).sort((p, q) => p.a - q.a)[0];
    if (!before || !after) throw new Error(`No main floor at station ${s}`);
    return r4(before.yb + (after.ya - before.yb) * (s - before.b) / (after.a - before.b));
  };

  // ---- ground and masonry ------------------------------------------------
  /** Vertex-painted ravine floor: warm loam down the centre softening to moss at
   * the edges, a little irregularity, exact centreline heights. */
  const ground = (nodes: { s: number; y: number; half: number }[], nm: string, surface: 'loam' | 'stone' = 'loam') => {
    const samples: { s: number; y: number; half: number }[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i], n = Math.max(1, Math.ceil((b.s - a.s) / 1.6));
      for (let k = i === 1 ? 0 : 1; k <= n; k++) { const t = k / n; samples.push({ s: a.s + (b.s - a.s) * t, y: a.y + (b.y - a.y) * t, half: a.half + (b.half - a.half) * t }); }
      floors.push({ a: a.s, b: b.s, ya: a.y, yb: b.y, x0: -Math.min(a.half, b.half), x1: Math.min(a.half, b.half), kind: 'main', nm });
    }
    const cols = 14, vertices: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
    const centre = new THREE.Color(surface === 'loam' ? '#dcc9a4' : '#d6cdb6'), edge = new THREE.Color(surface === 'loam' ? '#3f5a3a' : '#6d7a66');
    for (const q of samples) for (let c = 0; c <= cols; c++) {
      const u = c / cols - .5, x = u * 2 * q.half, rim = THREE.MathUtils.smoothstep(Math.abs(u), .32, .5);
      const bump = rim * (.16 + Math.sin(q.s * .41 + x * .3) * .08), w = pt(q.s, q.y + bump, x);
      vertices.push(w[0], w[1], w[2]);
      uvs.push(r4(x / 8), r4(q.s / 8));
      const paint = centre.clone().lerp(edge, THREE.MathUtils.smoothstep(Math.abs(u), .12, .42)).multiplyScalar(.96 + Math.sin(q.s * .27 + x * .37) * .04);
      colors.push(r4(paint.r), r4(paint.g), r4(paint.b));
    }
    for (let row = 0; row < samples.length - 1; row++) for (let c = 0; c < cols; c++) { const a = row * (cols + 1) + c, b = a + 1, d = a + cols + 1; indices.push(a, b, d, b, d + 1, d); }
    add({ t: 'mesh', p: [0, 0, 0], vertices, colors, uvs, indices, tex: surface === 'loam' ? 'treehouse-loam' : 'treehouse-stone', color: '#ffffff', solidSides: true, grp: G.ground, nm });
  };
  /** Bonded masonry slab: native collision with the Jungle Ruins templeplatform rendering and a carved lip. */
  const masonry = (s0: number, s1: number, x0: number, x1: number, top: number, nm: string, opts: { thick?: number; lip?: boolean; kind?: Floor['kind'] } = {}) => {
    const thick = opts.thick ?? 1.2, w = x1 - x0, d = s1 - s0, cx = (x0 + x1) / 2, cs = (s0 + s1) / 2, yaw = yawAt(cs);
    add({ t: 'platform', p: pt(cs, top - thick / 2, cx), s: [r4(w), thick, r4(d)], yaw, tex: 'jungle', color: STONE, artProxy: true, grp: G.masonry, nm });
    add({ t: 'decor', dkind: 'templeplatform', p: pt(cs, top - thick - .025, cx), s: [r4(w), thick, r4(d)], yaw, seed: Math.round(s0 * 7 + x0 * 3) & 0xffff, nm: `${nm} · bonded masonry`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false });
    if (opts.lip !== false) { const n = Math.max(1, Math.ceil(w / 3)), span = w / n; for (let i = 0; i < n; i++) add({ t: 'decor', dkind: 'stonecornice', p: pt(s1 - .55, top - .38, x0 + (i + .5) * span), s: [r4(span + .015), .35, 1.05], yaw, nm: `${nm} · carved lip`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false, color: '#e7e2ca' }); }
    floors.push({ a: s0, b: s1, ya: top, yb: top, x0, x1, kind: opts.kind ?? 'main', nm });
  };
  /** A monumental flight: a rideable bank with real stair treads sunk to its surface. */
  const flight = (s0: number, s1: number, y0: number, y1: number, x0: number, x1: number, nm: string, treads = true) => {
    const w = x1 - x0, len = s1 - s0, rise = y1 - y0, yaw = yawAt((s0 + s1) / 2);
    add({ t: 'ramp', p: pt((s0 + s1) / 2, y0, (x0 + x1) / 2), len: r4(len), rise: r4(rise), w: r4(w), yaw, tex: 'jungle', color: STONE, grp: G.ground, nm });
    floors.push({ a: s0, b: s1, ya: y0, yb: y1, x0, x1, kind: 'main', nm });
    if (!treads) return;
    const pitch = 1.05, slope = rise / len, pieces = Math.max(1, Math.round(w / 3)), span = w / pieces;
    for (let s = s0 + pitch / 2; s < s1 - .3; s += pitch) {
      const surface = y0 + slope * (s + pitch / 2 - s0);
      for (let i = 0; i < pieces; i++) add({ t: 'decor', dkind: 'stonestep', p: pt(s, surface - .45, x0 + (i + .5) * span), s: [r4(span + .01), .45, pitch], yaw, nm: `${nm} · stair tread`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false, color: i % 2 ? '#d8d0b4' : '#cfc7aa' });
    }
  };
  const pit = (s0: number, s1: number, x0: number, x1: number, y: number, nm: string) => {
    add({ t: 'pit', p: pt((s0 + s1) / 2, y - 9, (x0 + x1) / 2), s: [r4(x1 - x0), 8, r4(s1 - s0)], yaw: yawAt((s0 + s1) / 2), invisible: true, grp: G.ground, nm });
    pits.push({ a: s0, b: s1, x0, x1 });
  };
  const ledge = (s: number, x: number, y: number, w: number, d: number, nm: string, plinth = false) => {
    masonry(s - d / 2, s + d / 2, x - w / 2, x + w / 2, y, nm, { thick: plinth ? y - Math.max(-2, y - 6) : 1.6, kind: 'ledge', lip: !plinth });
    (plinth ? setPieces.plinths : setPieces.ledges).push({ s, x, y, w, d, name: nm });
  };
  // ---- rewards, lines, lamps ----------------------------------------------
  const crate = (s: number, x: number, y: number, kind: Kind, nm: string, ...flags: string[]) => {
    add({ t: 'crate', p: pt(s, y, x), kind, nm, grp: G.crates }); crates.push({ s, x, y, kind, nm, flags: new Set(flags) });
  };
  const stack = (s: number, x: number, y: number, bottom: Kind, cap: Kind, nm: string, ...flags: string[]) => { crate(s, x, y, bottom, nm, ...flags); crate(s, x, y + .96, cap, `${nm}: cap`, 'cap', ...flags); };
  /** A column of crates, bottom first, on the 0.96 grid (touching after the build's ×1.2 enlargement). */
  const tower = (s: number, x: number, y: number, kinds: Kind[], nm: string, ...flags: string[]) => { kinds.forEach((k, i) => crate(s, x, y + i * .96, k, i ? `${nm}: tier ${i + 1}` : nm, ...(i ? ['cap'] : []), ...flags)); };
  /** A row across the lane (along x). Open-lidded rows of two or more grow grind lines along their long edges: every row here is a line on purpose. */
  const rowAcross = (s: number, x0: number, y: number, kinds: Kind[], nm: string, ...flags: string[]) => { kinds.forEach((k, i) => crate(s, x0 + i * .96, y, k, i ? `${nm} ${i + 1}` : nm, 'row', ...flags)); };
  /** A row along the lane (along the course), the shape a rider grinds. */
  const rowAlong = (s0: number, x: number, y: number, kinds: Kind[], nm: string, ...flags: string[]) => { kinds.forEach((k, i) => crate(s0 + i * .96, x, y, k, i ? `${nm} ${i + 1}` : nm, 'row', ...flags)); };
  /** A crate in the cornice switch's group: a ghost outline until the '!' on the cornice landing fires. */
  const promised = (s: number, x: number, y: number, kind: Kind, nm: string, ...flags: string[]) => {
    add({ t: 'crate', p: pt(s, y, x), kind, nm, grp: G.promise, outline: kind !== 'bang' }); crates.push({ s, x, y, kind, nm, flags: new Set(['promised', ...flags]) });
  };
  const fruit = (s: number, x: number, y: number, nm = 'Fruit line') => add({ t: 'wumpa', p: pt(s, y + 1, x), grp: G.lines, nm });
  const arc = (s0: number, s1: number, x: number, y: number, rise = 1.6, nm = 'Fruit arc over the gap') => { for (let n = 0; n < 5; n++) add({ t: 'wumpa', p: pt(s0 + (s1 - s0) * n / 4, y + 1 + Math.sin(n / 4 * Math.PI) * rise, x), grp: G.lines, nm }); };
  const torch = (s: number, x: number, y: number, nm: string, rise = 1.7, w = 1) => { add({ t: 'torch', p: pt(s, y, x), rise, w, grp: G.lamps, nm }); scenery.push({ s, x, y, radius: .4, nm }); };
  /** Gold coping rails along both lips of a banked channel: the grind line of the flats and descents. */
  const copingRails = (nodes: { s: number; x: number; y: number; r?: number }[], flatHalf: number, rise: number, arc: number, deck: number, nm: string) => {
    const off = flatHalf + rise * Math.sin(arc * Math.PI / 180) + deck - .25, lift = rise * (1 - Math.cos(arc * Math.PI / 180)) + .05, [a] = nodes;
    for (const side of [-1, 1]) {
      add({ t: 'rail', p: pt(a.s, a.y + lift, a.x + side * off), pts: nodes.map(q => { const [wx, wz] = dvec(a.s, q.s - a.s, q.x - a.x); return [wx, wz, q.r ?? 0, r4(q.y - a.y)]; }), color: GOLD, coping: true, grp: G.lines, nm: `${nm} · ${side < 0 ? 'left' : 'right'} coping` });
      for (let i = 1; i < nodes.length; i++) setPieces.rails.push({ a: nodes[i - 1].s, b: nodes[i].s, x: nodes[i - 1].x + side * off, xb: nodes[i].x + side * off, ya: nodes[i - 1].y + lift, yb: nodes[i].y + lift, name: nm });
    }
  };
  /** A checkpoint beside the way out of a court: one brazier at (ls, lx), clear of the board line and of the doorway. */
  const sideCheckpoint = (s: number, x: number, y: number, ls: number, lx: number, nm: string) => { add({ t: 'checkpoint', p: pt(s, y, x), grp: G.course, nm }); checkpoints.push({ s, x, nm }); torch(ls, lx, y, 'Checkpoint brazier', 1.6, 1); };
  const checkpoint = (s: number, x: number, y: number, nm: string) => {
    add({ t: 'checkpoint', p: pt(s, y, x), grp: G.course, nm }); checkpoints.push({ s, x, nm });
    for (const side of [-1, 1]) { const px = x + side * 3.2; add({ t: 'decor', dkind: 'stonebase', p: pt(s - .8, y + .02, px), s: [1.1, .5, 1.1], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Checkpoint lamp pedestal' }); torch(s - .8, px, y + .5, 'Paired checkpoint lamps', 1.45, .85); }
  };

  // ---- hazards and foes ---------------------------------------------------
  /** The breath leaves a full-size head 0.85–1.25 m above its base, over a rider's 0.92 m body. The heads stand on a
   * paving slab at floor level and are scaled to 0.8, which brings the breath to chest height; the range is widened by
   * the same factor so each head still reaches 7.1 m. A head's yaw is the leg's yaw plus ±90: it faces across its room. */
  const TIKI_W = .8, TIKI_REACH = 7.1, SLAB = .06;
  const sentinel = (s: number, x: number, y: number, facing: number, cycle: number, amp: number, phase: number, nm: string) => {
    const top = y + SLAB;
    add({ t: 'decor', dkind: 'templeplatform', p: pt(s, y - .3 + SLAB, x), s: [3, .3, 3], yaw: yawAt(s), seed: Math.round(s) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.hazards, nm: `${nm} · carved slab` });
    add({ t: 'wall', p: pt(s, top, x), s: [2.2, 2.3, 2.2], invisible: true, edgeGrinding: false, grp: G.hazards, nm: `${nm} · head core` });
    add({ t: 'firetiki', p: pt(s, top, x), yaw: yawAt(s) + (facing > 0 ? 90 : -90), range: r4(TIKI_REACH / TIKI_W), cycle, phase, amp, w: TIKI_W, grp: G.hazards, nm });
    setPieces.sentinels.push({ s, x, y: top, facing, cycle, amp, name: nm });
    floors.push({ a: s - 1.1, b: s + 1.1, ya: top, yb: top, x0: x - 1.1, x1: x + 1.1, kind: 'side', nm: `${nm} pedestal` });
  };
  const censer = (s: number, x: number, pivotY: number, len: number, amp: number, speed: number, phase: number, nm: string) => {
    add({ t: 'pendulum', p: pt(s, pivotY, x), len, amp, speed, phase, yaw: yawAt(s), grp: G.hazards, nm }); // the leg's yaw swings it across the course
    setPieces.censers.push({ s, x, pivotY, len, amp, speed, phase });
  };
  /** A patrol across the lane, or along it with `along`. Enemy yaws of 90/270 put the walk on the world Z axis. */
  const patrol = (s: number, x: number, y: number, foe: Foe, range: number, speed: number, nm: string, along = false) => {
    add({ t: 'enemy', foe, p: pt(s, y, x), yaw: ((yawAt(s) + (along ? 90 : 0)) % 360 + 360) % 360, range, speed, terrainSupports: true, grp: G.patrols, nm: `Temple ${foe}: ${nm}` });
    patrols.push({ s, x, y, along, range, foe, nm });
  };

  // ---- landscape ----------------------------------------------------------
  const ratios: Record<string, [number, number]> = { trialsv2treea: [17.766 / 26, 25.911 / 26], trialsv2treeb: [16.741 / 26, 17.709 / 26], trialsv2crowna: [11.292 / 26, 23.015 / 26], trialsv2crownb: [9.405 / 26, 1],
    trialsv2groundcovera: [1.043 / 5, 2.581 / 5], trialsv2groundcoverb: [1.826 / 5, 4.516 / 5], trialsv2ferna: [1.601 / 3, 2.798 / 3], trialsv2fernb: [1.838 / 3, 2.957 / 3],
    trialsv2earthbanka: [1.316 / 8, 3.996 / 8], trialsv2earthbankb: [1.628 / 8, 3.149 / 8], trialsv2cavewalla: [7.468 / 12, 6.705 / 12], trialsv2cavewallb: [11.708 / 12, 7.415 / 12],
    trialsv2caveroofa: [8.348 / 18, 13.766 / 18], trialsv2caveroofb: [6.26 / 18, 9.006 / 18], trialsv2riverstonea: [.6, .9], trialsv2riverstoneb: [.55, .85], trialsv2riverstonec: [.5, .8] };
  const plant = (kind: Decor, s: number, x: number, y: number, width: number, nm: string, yaw = 0, grp = G.planting) => {
    const ratio = ratios[kind] ?? [1, 1], size: P = [r4(width), r4(width * ratio[0]), r4(width * ratio[1])];
    add({ t: 'decor', dkind: kind, p: pt(s, y, x), s: size, yaw: yaw + yawAt(s), solid: false, scenerySolid: false, cameraCutaway: true, color: '#ffffff', grp, nm });
    scenery.push({ s, x, y, radius: Math.min(size[0], size[2]) * .35, nm });
  };
  const plantAt = (kind: Decor, x: number, y: number, z: number, width: number, nm: string, yaw = 0, grp = G.landscape) => {
    const ratio = ratios[kind] ?? [1, 1], size: P = [r4(width), r4(width * ratio[0]), r4(width * ratio[1])];
    add({ t: 'decor', dkind: kind, p: [r4(x), r4(y), r4(z)], s: size, yaw, solid: false, scenerySolid: false, cameraCutaway: true, color: '#ffffff', grp, nm });
    const [ls, , lx] = templeToLocal([x, y, z]); scenery.push({ s: ls, x: lx, y, radius: Math.min(size[0], size[2]) * .35, nm });
  };
  const rnd = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  /** Ravine walls: stacked Treehouse cave walls along both sides, earth banks at their feet, trees on the rim. `sides` limits the planting to one flank. */
  const ravine = (s0: number, s1: number, halfAt: (s: number) => number, floorY: (s: number) => number, rimHeight = 16, sides: number[] = [-1, 1], contain = true, treeOut: (side: number) => number = () => 10) => {
    for (let s = s0 + 5, i = 0; s < s1; s += 11, i++) for (const side of sides) {
      const half = halfAt(s), y = floorY(s), out = treeOut(side);
      plant(i % 2 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', s, side * (half + 5.5), y - .6, 12.5, 'Ravine wall', side > 0 ? 180 : 0, G.landscape);
      plant(i % 2 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', s + 4, side * (half + 7.5), y + 6.2, 12.5, 'Ravine wall, upper course', side > 0 ? 180 : 0, G.landscape);
      if (i % 2 === 0) plant(i % 4 ? 'trialsv2earthbanka' : 'trialsv2earthbankb', s + 2, side * (half + 1.6), y - .15, 8, 'Earth bank at the wall foot', rnd(s + side) * 30 - 15 + (side > 0 ? 180 : 0), G.landscape);
      plant(i % 2 ? 'trialsv2ferna' : 'trialsv2fernb', s + 7, side * (half + 1.3), y + .1, 3.2, 'Fern at the wall foot', rnd(s * 3 + side) * 360);
      plant(i % 2 ? 'trialsv2groundcovera' : 'trialsv2groundcoverb', s - 3, side * (half + 1.6), y + .05, 4.5, 'Groundcover at the wall foot', rnd(s * 5 + side) * 360);
      plant(i % 2 ? 'trialsv2treea' : 'trialsv2treeb', s + 3, side * (half + out + rnd(s + side * 7) * 4), y + rimHeight - 1, 22 + rnd(s) * 4, 'Rim tree', rnd(s * 11 + side) * 360);
      if (i % 2 === 0) plant(i % 4 ? 'trialsv2crowna' : 'trialsv2crownb', s + 8, side * (half + out + 5), y + rimHeight + 9, 24, 'Rim canopy', rnd(s * 13) * 360);
    }
    // Containment keeps a slipping rider on the floor where the wall foot has no pit.
    if (contain) for (const side of sides) {
      const pts: NonNullable<CustomComponent['pts']>[number][] = [], o = { s: s0, x: side * (halfAt(s0) + .3), y: floorY(s0) - .2 };
      for (let s = s0; s <= s1 + .01; s += (s1 - s0) / Math.max(2, Math.ceil((s1 - s0) / 6))) { const [wx, wz] = dvec(o.s, s - o.s, side * (halfAt(s) + .3) - o.x); pts.push([wx, wz, 0, r4(floorY(s) - .2 - o.y)]); }
      add({ t: 'wallpath', p: pt(o.s, o.y, o.x), pts, w: .5, rise: 6, collisionHeight: 6, containment: true, invisible: true, grp: G.bounds, nm: 'Ravine wall containment' });
    }
  };
  const riverStones = (s0: number, s1: number, halfAt: (s: number) => number, floorY: (s: number) => number) => {
    for (let s = s0 + 3, i = 0; s < s1; s += 7.5, i++) {
      const side = i % 2 ? -1 : 1, x = side * (halfAt(s) - 1.6 - rnd(s) * 1.4), kinds: Decor[] = ['trialsv2riverstonea', 'trialsv2riverstoneb', 'trialsv2riverstonec'];
      if (side > 0 && s > 54 && s < 120) continue; // the gutter and its grind line own the right side here
      plant(kinds[i % 3], s, x, floorY(s) - .1, 1.6 + rnd(s * 2) * 1.2, 'River stone', rnd(s * 3) * 360, G.landscape);
      if (i % 3 === 0) add({ t: 'rock', p: pt(s + 2.5, floorY(s) - .4, x * .75), s: [2.4, 1.3, 2.1], seed: Math.round(s), color: '#8e9a7c', grp: G.landscape, nm: 'Mossy boulder' });
      if (i % 3 === 0) scenery.push({ s: s + 2.5, x: x * .75, y: floorY(s), radius: 1.3, nm: 'Mossy boulder' });
    }
  };
  const gateway = (s: number, x: number, y: number, width: number, nm: string) => {
    add({ t: 'decor', dkind: 'hangingarch', p: pt(s, y - .18, x), s: [width, 12.5, 2.8], yaw: yawAt(s), seed: Math.round(s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm });
    for (const side of [-1, 1]) { add({ t: 'wall', p: pt(s, y, x + side * (width / 2 - 1.6)), s: [2.1, 7.8, 2.1], invisible: true, grp: G.masonry, nm: `${nm} · solid pier` }); scenery.push({ s, x: x + side * (width / 2 - 1.6), y, radius: 1.2, nm }); }
  };
  const shrine = (s: number, x: number, y: number, facing: number, nm: string) => {
    // Three temple walls make a niche open toward the room; a lintel carries a brazier.
    const yaw = yawAt(s);
    add({ t: 'decor', dkind: 'templewall', p: pt(s, y, x - facing * 2.4), s: [5.2, 4.6, 1.2], yaw: 90 + yaw, seed: Math.round(s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · back wall` });
    for (const side of [-1, 1]) add({ t: 'decor', dkind: 'templewall', p: pt(s + side * 2.4, y, x), s: [4.4, 4.6, 1.2], yaw, seed: Math.round(s) + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · side wall` });
    add({ t: 'decor', dkind: 'stonelintel', p: pt(s, y + 4.3, x), s: [5.6, 1, 1.1], yaw: 90 + yaw, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · lintel` });
    for (const side of [-1, 1]) add({ t: 'wall', p: pt(s + side * 2.4, y, x), s: [.6, 4.6, 4.4], yaw, invisible: true, grp: G.masonry, nm: `${nm} · solid side` });
    add({ t: 'wall', p: pt(s, y, x - facing * 2.4), s: [4.8, 4.6, .6], yaw, invisible: true, grp: G.masonry, nm: `${nm} · solid back` });
    torch(s, x, y + 5.3, `${nm} · brazier`, .6, 1.1);
    scenery.push({ s, x, y, radius: 2.8, nm });
  };
  /** A column (base, shafts, capital) with a solid core: the colonnade and the court arcades are built from these. */
  const column = (s: number, x: number, y: number, height: number, nm: string, register = true) => {
    add({ t: 'decor', dkind: 'stonebase', p: pt(s, y, x), s: [2.2, .8, 2.2], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} base` });
    for (let h = y + .8; h < y + height - 1.2; h += 1.8) add({ t: 'decor', dkind: 'stoneshaft', p: pt(s, h, x), s: [1.5, 1.8, 1.5], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm });
    add({ t: 'decor', dkind: 'stonecapital', p: pt(s, y + height - 1.1, x), s: [2.4, 1.1, 2.4], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} capital` });
    add({ t: 'wall', p: pt(s, y, x), s: [1.6, r4(height), 1.6], invisible: true, grp: G.masonry, nm: `${nm} core` });
    if (register) scenery.push({ s, x, y, radius: 1, nm });
  };
  /** Low stone parapets: visible boxes, so a save reads as a walled room (Ruination). `parapet` runs with the course at
   * lateral x over s0..s1; `parapetAcross` sits at station s from lateral x0 to x1. */
  const W3 = (x: number, y: number, z: number): [number, number, number] => [r4(x), r4(y), r4(z)];
  /** A stone kerb in world space: an unseen collider under carved lintel blocks about three metres long. */
  const kerbWorld = (cx: number, cz: number, len: number, alongX: boolean, y: number, nm: string) => {
    add({ t: 'wall', p: W3(cx, y, cz), s: alongX ? [r4(len), 1.3, .8] : [.8, 1.3, r4(len)], invisible: true, grp: G.bounds, nm });
    const n = Math.max(1, Math.round(len / 3.2)), piece = len / n;
    for (let i = 0; i < n; i++) { const o = -len / 2 + (i + .5) * piece; add({ t: 'decor', dkind: 'stonelintel', p: W3(alongX ? cx + o : cx, y, alongX ? cz : cz + o), s: [r4(piece + .02), 1.3, .8], yaw: alongX ? 0 : 90, seed: (Math.round(cx * 7 + cz * 13) + i) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.bounds, nm: `${nm} · stone` }); }
  };
  const alongWorldX = (s: number) => Math.abs(Math.sin(yawAt(s) * Math.PI / 180)) > .5;
  const parapet = (s0: number, s1: number, x: number, y: number, nm: string) => { const m = (s0 + s1) / 2, w = pt(m, y, x); kerbWorld(w[0], w[2], s1 - s0, alongWorldX(m), y, nm); };
  const parapetAcross = (s: number, x0: number, x1: number, y: number, nm: string) => { const w = pt(s, y, (x0 + x1) / 2); kerbWorld(w[0], w[2], x1 - x0, !alongWorldX(s), y, nm); };
  // Leg starts on the continuous station axis (the leg table above).
  const L2 = 149, L3 = 235, L4 = 311, L5 = 406, L6 = 640, L7 = 728, END = 860;

  // =========================================================================
  // LEG 1 · THE RAVINE FLOOR (−18 → 149, north, floor at 0). Open sky, 28 m
  // wide, narrowing to a walled corner court where the route turns west.
  // Learn the smash speed on three stacks, take the mask from the shrine, read
  // the sleeping sentinel, grind the gutter, meet two crabs in the open. The
  // aqueduct the player will ride back along runs the length of the east rim
  // sixteen metres overhead.
  // =========================================================================
  rooms.push({ name: 'Ravine floor', a: -16, b: L2, mode: 'board', lesson: 'smash the stagger at speed, take the mask, read the sleeping flame, grind the gutter, meet the crabs in the open, stop in the corner court' });
  masonry(-18, 0, -7, 7, 4, 'Ravine lip: the arrival ledge');
  flight(0, 30, 4, 0, -7, 7, 'Arrival bank down to the ravine floor', false);
  const r1half = (s: number) => s < 100 ? 14 : 14 - 5.6 * (Math.min(125, s) - 100) / 25, r1y = () => 0;
  ground([{ s: 28, y: 0, half: 10 }, { s: 40, y: 0, half: 14 }, { s: 100, y: 0, half: 14 }, { s: 125, y: 0, half: 8.4 }], 'Ravine floor');
  // S0 · TEACH board smashing (XV.4, XVI.1): three stacks on the line where the bank has just given speed. At 12.5 m/s
  // and above a whole stack clears for one contact; a cruising rider trips and learns the speed rule where it is cheap.
  tower(34, -1.5, 0, ['wood', 'wood', 'wood'], 'Smash stagger: first stack, left');
  tower(39, 1.5, 0, ['wood', 'wood', 'mystery'], 'Smash stagger: the tall one carries the question mark');
  tower(44, 0, 0, ['wood', 'wood', 'wood'], 'Smash stagger: third stack, centre');
  shrine(40, -11.4, 0, 1, 'Mask shrine');
  stack(40, -10.2, 0, 'wood', 'mask', 'The shrine stack: the mask on top, protection before the first flame');
  // R10 · the checkpoint inside a fast-line crate group: stacks 1.5 m off the line, threaded at cruise or taken at speed.
  stack(47, -1.5, 0, 'wood', 'wood', 'Checkpoint lane stack, left'); checkpoint(50, 0, 0, 'Ravine floor checkpoint'); stack(53, 1.5, 0, 'wood', 'wood', 'Checkpoint lane stack, right');
  // A raised jade channel on the floor: its bed is at grade and its copings stand 0.67 m up, an ollie onto the grind.
  const gutterBed = 0;
  add({ t: 'vertramp', p: pt(86, gutterBed, 9.5), len: 52, yaw: yawAt(86), w: 1.1, rise: .9, arc: 72, deck: .5, arcSteps: 10, vkind: 'half', vert: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'Dry overflow gutter: the first coping grind' });
  floors.push({ a: 60, b: 112, ya: gutterBed, yb: gutterBed, x0: 8.4, x1: 10.6, kind: 'side', nm: 'gutter floor' });
  copingRails([{ s: 60, x: 9.5, y: gutterBed }, { s: 112, x: 9.5, y: gutterBed }], 1.1, .9, 72, .5, 'Gutter coping');
  for (let s = 66; s <= 108; s += 6) fruit(s, 11.7, .3, 'Gutter coping fruit');
  // XVI.9 · three heights round the rail: a row on the floor beside the left coping is a parallel grind line half a
  // metre higher (hop across from the coping, or ollie onto it from the floor), and one box floats over the coping
  // where a grind jump peaks.
  rowAlong(84, 5.8, 0, ['wood', 'wood', 'wood'], 'Row beside the gutter coping: a parallel grind line');
  crate(100, 7.3, .67 + 2.1, 'wood', 'Above the coping: a grind jump breaks it', 'suspended');
  sentinel(70, -9.5, 0, 1, 14, 12, 0, 'Sleeping sentinel of the ravine: a slow, narrow sigh');
  tower(70, -5, 0, ['wood', 'wood', 'mystery'], 'Stack inside the sleeping sentinel\'s sigh', 'sweep');
  // The crab debuts across a 28 m floor with room to steer round it (XIII.2); the block behind its walk is the bait.
  patrol(95, 0, 0, 'grunt', 2.5, 1.35, 'first crab crossing the open floor: spin or stomp, escape either side');
  patrol(118, 3, 0, 'grunt', 2, 1.5, 'second crab, before the court');
  rowAcross(104, -4.48, 0, ['wood', 'wood'], 'Bait block behind the first crab, front row'); rowAcross(104.96, -4.48, 0, ['wood', 'wood'], 'Bait block behind the first crab, back row');
  tower(112, 0, 0, ['wood', 'wood', 'mystery'], 'Court gate stack: the last thing to smash at speed');
  // The corner court: a walled save (Ruination) where the ravine ends and the pillar chain leaves westward.
  masonry(125, L2, -8, 8, 0, 'Corner court at the stair foot', { lip: false });
  stack(134, -1.5, 0, 'wood', 'wood', 'Court lane stack, left'); sideCheckpoint(140, -5.4, 0, 142.6, -6.6, 'Corner court checkpoint: beside the west arch, off the board line'); stack(140, 1.5, 0, 'wood', 'wood', 'Court lane stack, right');
  parapet(125, L2, 8.6, 0, 'Corner court parapet, east'); parapetAcross(L2 - .5, -8.6, 8.6, 0, 'Corner court parapet, north');
  parapet(125, 127, -8.6, 0, 'Corner court parapet, west jamb'); parapet(147, L2, -8.6, 0, 'Corner court parapet, west jamb');
  riverStones(34, 112, r1half, r1y);
  // The east rim carries the aqueduct, so that flank's trees stand well back on the hillside beyond the colonnade.
  ravine(28, 125, r1half, r1y, 16, [-1, 1], true, side => side > 0 ? 26 : 10);
  plantAt('trialsv2cavewalla', 15.5, -.6, -137, 13, 'Cliff behind the court, east', 180); plantAt('trialsv2cavewallb', 0, -.6, -157, 14, 'Cliff behind the court, north', 0);
  plantAt('trialsv2treea', -24, 14, -160, 24, 'Rim tree over the court', 40); plantAt('trialsv2treeb', -30, 14, -118, 23, 'Rim tree over the court', 200);
  for (const s of [84, 108]) torch(s, 12.2, 0, 'Ravine brazier', 1.9, 1.1);
  for (const s of [92, 120]) torch(s, s > 100 ? -10.8 : -12.2, 0, 'Ravine brazier', 1.9, 1.1);
  for (const x of [-6.5, 6.5]) torch(L2 - 2, x, 0, 'Court brazier', 1.8, 1.1);

  // =========================================================================
  // LEG 2 · THE PILLAR CHAIN (149 → 235, west, 0 → 8, on foot). The route
  // leaves the court through an arch and climbs a chain of separate pillar
  // tops over a gully (Ruination): two plinths, a narrow walkway with a crab
  // pacing along it, a hexagonal rest pad carrying a wall of crates, two more
  // pads, and the walled landing court where TNT, the arrow and the double
  // jump are each taught alone.
  // =========================================================================
  rooms.push({ name: 'Pillar chain', a: L2, b: L3, mode: 'foot', lesson: 'plinths, a one-move walkway, a rest pad with a wall, two pads; TNT, the arrow and the double jump taught alone on the landing court' });
  masonry(L2, L2 + 6, -8, 8, 0, 'Court apron: the take-off onto the chain');
  gateway(L2 + 2, 0, 0, 18, 'Gateway of the pillar chain');
  pit(L2 + 6, L2 + 56, -14, 14, 0, 'The gully under the pillar chain');
  // 2.3 / 2.0 / 2.75 m gaps: the plain band's low end, rising a metre a pillar. Nothing stands on the pillars.
  ledge(L2 + 9.55, -1.5, 1, 2.5, 2.5, 'Pillar one', true); ledge(L2 + 14.05, 1.5, 2, 2.5, 2.5, 'Pillar two', true);
  // The walkway is shaped for one move: 1.6 m wide, so the crab pacing its length (rung 2, along the lane) must be spun.
  ledge(L2 + 23, 0, 3, 1.6, 10, 'Narrow walkway over the gully', true);
  patrol(L2 + 23, 0, 3, 'grunt', 3, 1.4, 'crab pacing the narrow walkway: it comes at you; spin it, there is no way round', true);
  // The hex pad is the rest after three gaps, and the 3 × 2 wall with the '?' in its top row stands on it (walk round or break through).
  ledge(L2 + 34.5, 0, 4, 7, 7, 'Hexagonal rest pad', true);
  rowAcross(L2 + 36.5, -.96, 4, ['wood', 'wood', 'wood'], 'Rest pad wall, base row');
  rowAcross(L2 + 36.5, -.96, 4.96, ['wood', 'mystery', 'wood'], 'Rest pad wall, top row: the question mark is in the middle', 'cap');
  ledge(L2 + 43.5, -2, 5.5, 4, 4, 'Pillar three', true); ledge(L2 + 51, 2, 7, 4, 4, 'Pillar four', true);
  arc(L2 + 6, L2 + 8.3, -1, .5, .8, 'Fruit onto pillar one'); arc(L2 + 10.8, L2 + 12.8, 0, 1.5, .8, 'Fruit onto pillar two'); arc(L2 + 15.3, L2 + 18, .8, 2.5, .9, 'Fruit onto the walkway');
  arc(L2 + 28, L2 + 31, 0, 3.5, .9, 'Fruit onto the rest pad'); arc(L2 + 38, L2 + 41.5, -1, 5, .9, 'Fruit onto pillar three'); arc(L2 + 45.5, L2 + 49, 0, 6.3, .9, 'Fruit onto pillar four'); arc(L2 + 53, L2 + 56, 1, 7.8, .8, 'Fruit onto the landing court');
  for (const [q, x, y, yaw] of [[L2 + 7, -7.5, 1, 20], [L2 + 30, 6.8, 5, -35], [L2 + 47, -8, 7.2, 60]] as const) add({ t: 'decor', dkind: 'fracturedstoneblock', p: pt(q, y, x), s: [2.2, 1.1, 1.1], yaw: yaw + yawAt(q), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Fallen block beside the chain' });

  // ---- THE LANDING COURT (L2+56 → L3 at 8): three lessons, each alone and a beat apart --------------------------
  masonry(L2 + 56, L3, -10, 10, 8, 'Landing court');
  crate(L2 + 57.5, -4, 8, 'mystery', 'Landing marker at the court\'s threshold');
  // R11 · a count trap at an attractor: the court corner beside the exit, behind a fallen block, where momentum carries past.
  stack(L2 + 58, 8.5, 8, 'wood', 'mystery', 'Count trap in the court corner behind the fallen block');
  add({ t: 'decor', dkind: 'fracturedstoneblock', p: pt(L2 + 56.6, 8, 9), s: [2.2, 1.1, 1.1], yaw: 40 + yawAt(L2 + 56), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Fallen block of the court' });
  checkpoint(L2 + 61, -4, 8, 'Landing court checkpoint');
  // The mossback debuts on the open court, no lethal edge within reach: stomp it for a springboard, or walk round it.
  patrol(L2 + 65, 5, 8, 'turtle', 1.5, 1.3, 'mossback debut on the open court: stomp it for a springboard onto the TNT');
  // R4 · TNT clearer with a payout, four metres past the turtle: stomp the stack, retreat 3.5 m, the blast pays the '?'.
  stack(L2 + 70, 4, 8, 'tnt', 'tnt', 'TNT clearer: stomp it, then retreat', 'fuse');
  crate(L2 + 70, 4.96, 8, 'mystery', 'Inside the blast: the explosion pays it out', 'blast');
  // R2 · arrow tool gate by the exit: the floating row needs the arrow and the double jump (head 7.6 m); a floor double jump (5.5 m) fails.
  crate(L2 + 80, 8.5, 8, 'bouncy', 'Arrow: the tool for the row above');
  rowAcross(L2 + 80, 7.54, 8 + 6.5, ['wood', 'life', 'wood'], 'Row above the arrow: arrow bounce, then double jump', 'suspended');
  // Rung 2 of the sentinel ladder, a beat after the TNT: the same head without the long pause, on the court's south
  // side, with the balcony directly above it so its sweep lies across the balcony's approach.
  sentinel(L2 + 82, -9, 8, 1, 10, 20, 1.3, 'Waking sentinel of the landing court');
  stack(L2 + 82, -5, 8, 'wood', 'wood', 'Offering inside the landing court sentinel\'s sweep', 'sweep');
  ledge(L2 + 83.5, -8, 14.2, 3.5, 3.5, 'Balcony over the sentinel: double jump and grab');
  tower(L2 + 83.5, -8, 14.2, ['wood', 'wood', 'mystery'], 'Balcony stack: the double jump\'s first prize', 'perch');
  // Walls round the save: the south side, the west end, and the north side either side of the way out to the ledges.
  parapet(L2 + 56, L3, -10.6, 8, 'Landing court parapet, south'); parapetAcross(L3 - .5, -10.6, 10.6, 8, 'Landing court parapet, west');
  parapet(L2 + 56, L2 + 61, 10.6, 8, 'Landing court parapet, north jamb'); parapet(L2 + 81, L3, 10.6, 8, 'Landing court parapet, north jamb');
  for (const [q, x] of [[L2 + 58, -8.6], [L3 - 2, 8.6], [L2 + 74, -8.6]] as const) torch(q, x, 8, 'Court brazier', 1.8, 1.1);
  ravine(L2 + 4, L3, () => 12, s => Math.min(8, Math.max(0, (s - L2 - 6) / 50 * 8)), 14, [-1]);

  // =========================================================================
  // LEG 3 · THE FALLEN LEDGES AND THE FUSE COURT (235 → 311, north, 8 → 16).
  // Six 3.5 m hops rising +2, +2, +2, +1, +1, 0 with a 6 m rest tier after
  // three and a crab on the fifth landing; then a roofed court (Road to Ruin's
  // covered rooms) where the TNT returns on top of a wood crate and the
  // sentinel's sweep is inverted.
  // =========================================================================
  rooms.push({ name: 'Fallen ledges', a: L3, b: L4, mode: 'foot', lesson: 'six short hops with a rest; the roofed fuse court tests the TNT and the sweep' });
  pit(L3, L3 + 43, -12, 12, 8, 'The ravine under the fallen second flight');
  const hops: [number, number, number, number][] = [[L3 + 5.5, -2, 10, 4], [L3 + 13, 2, 12, 4], [L3 + 21.5, 0, 14, 6], [L3 + 30, -2, 15, 4], [L3 + 37.5, 2, 16, 4]];
  for (const [i, [q, x, y, d]] of hops.entries()) ledge(q, x, y, i === 2 ? 6 : 3.5, d, i === 2 ? 'Rest tier of the fallen flight' : `Fallen ledge ${i + 1}`);
  rowAcross(L3 + 19.5, -2.98, 14, ['wood', 'wood'], 'Rest tier block, front row', 'rest');
  rowAcross(L3 + 20.46, -2.98, 14, ['wood', 'mystery'], 'Rest tier block, back row', 'rest');
  ledge(L3 + 30, -9.5, 15, 3.5, 3.5, 'Side ledge over the ravine: a jump out and back'); crate(L3 + 30, -9.5, 15, 'life', 'Life on the side ledge', 'perch');
  patrol(L3 + 37.5, 2, 16, 'grunt', 1, 1.2, 'crab on the fifth landing: spin in the air or land beside it');
  for (let i = 0; i < hops.length - 1; i++) arc(hops[i][0] + hops[i][3] / 2, hops[i + 1][0] - hops[i + 1][3] / 2, (hops[i][1] + hops[i + 1][1]) / 2, hops[i][2] + 1, 1, 'Fruit between the fallen ledges');
  arc(L3, L3 + 3.5, -1, 9, 1, 'Fruit onto the first ledge'); arc(L3 + 39.5, L3 + 43, 1, 16, .8, 'Fruit onto the fuse court');
  // ---- THE FUSE COURT (L3+43 → L4 at 16), roofed ---------------------------------------------------------
  masonry(L3 + 43, L4, -10, 10, 16, 'The fuse court');
  checkpoint(L3 + 49, 4, 16, 'Fuse court checkpoint');
  stack(L3 + 46, 6.5, 16, 'wood', 'mystery', 'Count trap beside the checkpoint');
  // B2 · the same silhouette with the TNT on top: stomp the cap, retreat; the blast takes the base and the '?'.
  stack(L3 + 55, -4, 16, 'wood', 'tnt', 'TNT on top: the clearer\'s silhouette, the hazard moved', 'fuse');
  crate(L3 + 55, -3.04, 16, 'mystery', 'Paid out by the blast', 'blast');
  stack(L3 + 59, -3, 16, 'wood', 'mask', 'Mask before the stair');
  rowAcross(L3 + 65, 3.52, 16, ['wood', 'wood'], 'Court pyramid base');
  crate(L3 + 65, 4, 16.96, 'mystery', 'Court pyramid top', 'cap');
  // Rung 3 of the sentinel ladder, inverted: the reward is inside the sweep; go in while it is cool.
  sentinel(L3 + 68, -9, 16, 1, 9, 24, 2.6, 'Waking sentinel of the fuse court');
  tower(L3 + 68, -5, 16, ['wood', 'wood', 'mystery'], 'Stack inside the fuse court sentinel\'s sweep', 'sweep');
  add({ t: 'decor', dkind: 'roofedtemple', p: pt(L3 + 59.5, 16, 0), s: [22, 11, 22], yaw: yawAt(L3 + 59), openFloor: true, seed: 311, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Roof of the fuse court' });
  for (const [q, x] of [[L3 + 49.5, -9], [L3 + 49.5, 9], [L3 + 63, -9], [L3 + 72, 9]] as const) column(q, x, 16, 9, 'Fuse court column');
  parapet(L3 + 43, L4, -10.6, 16, 'Fuse court parapet, west'); parapetAcross(L4 - .5, -10.6, 10.6, 16, 'Fuse court parapet, north');
  parapet(L3 + 43, L3 + 51, 10.6, 16, 'Fuse court parapet, east jamb'); parapet(L3 + 67, L4, 10.6, 16, 'Fuse court parapet, east jamb');
  ravine(L3, L4, () => 13, s => Math.min(16, mainFloorAt(Math.min(L4, Math.max(L3, s)))), 14, [-1]);
  for (const s of [L3 + 12, L3 + 33]) torch(s, -11.2, mainFloorAt(s) + .3, 'Ledge brazier', 1.8, 1.05);
  for (const [q, x] of [[L3 + 45, -8.6], [L3 + 74, -8.6], [L3 + 45, 8.6]] as const) torch(q, x, 16, 'Court brazier', 1.8, 1.1);
  // =========================================================================
  // LEG 4 · THE BROKEN STAIR (311 → 406, east, 16 → 24). A SIDE-SCROLL stretch
  // (Cold Hard Crash, Snow Go): a walled stair with three breaks, a mossback
  // on the middle flight and a stone slab stamping the top flight; then the
  // stair top, where the bristleback debuts and the board is taken back up.
  // =========================================================================
  rooms.push({ name: 'Broken stair', a: L4, b: L5, mode: 'foot', lesson: 'side view: three breaks in the stair, the mossback on the line, the slab over the top flight; the bristleback debuts on the stair top' });
  add({ t: 'zone', p: pt(L4 + 31.5, 20, 0), s: [63, 8, 20], dir: 'E', grp: G.camera, nm: 'Broken stair · side-scroll camera' });
  masonry(L4, L4 + 2, -8, 8, 16, 'Stair foot apron', { lip: false });
  const stairY = (s: number) => 16 + 8 * (s - L4 - 2) / 54;
  flight(L4 + 2, L4 + 18, stairY(L4 + 2), stairY(L4 + 18), -3, 3, 'Broken stair, first flight');
  flight(L4 + 20.5, L4 + 36, stairY(L4 + 20.5), stairY(L4 + 36), -3, 3, 'Broken stair, second flight');
  flight(L4 + 38.5, L4 + 56, stairY(L4 + 38.5), stairY(L4 + 56), -3, 3, 'Broken stair, third flight');
  gaps.push({ a: L4 + 18, b: L4 + 20.5, y: stairY(L4 + 18) }, { a: L4 + 36, b: L4 + 38.5, y: stairY(L4 + 36) });
  pit(L4 + 18, L4 + 20.5, -3.4, 3.4, stairY(L4 + 18), 'First break in the stair'); pit(L4 + 36, L4 + 38.5, -3.4, 3.4, stairY(L4 + 36), 'Second break in the stair');
  pit(L4 + 2, L4 + 56, -12, -3.4, 16, 'Drop beside the stair, north'); pit(L4 + 2, L4 + 56, 3.4, 12, 16, 'Drop beside the stair, south');
  // Railed edges where depth is read from the side (IX.5): stepped parapets along both edges of every flight.
  for (const [a, b] of [[L4 + 2, L4 + 18], [L4 + 20.5, L4 + 36], [L4 + 38.5, L4 + 56]] as const) for (let s = a; s < b - .1; s += 5.5) { const e = Math.min(b, s + 5.5); for (const side of [-1, 1]) parapet(s, e, side * 3.5, stairY((s + e) / 2) - .3, 'Stair parapet'); }
  patrol(L4 + 28, 0, stairY(L4 + 28), 'turtle', 1.2, 1.2, 'mossback on the second flight: stomp it or wait for its turn');
  stack(L4 + 33, 1.2, stairY(L4 + 33), 'wood', 'wood', 'One stack in the safe window between the mossback and the slab');
  // A stone slab stamps the top flight (the bible's crusher on the far bank, Snow Go / Snow Biz): its rise and fall are read
  // against the steps in the side view. It fills the stair between the parapets, so the only way past is to wait as it rests and
  // go as it rises; the hanging block clears a standing player by three metres.
  add({ t: 'crusher', p: pt(L4 + 46, stairY(L4 + 46), 0), s: [3, 3, 6.2], dkind: 'treehousemossrock', cycle: 3.6, phase: 0, grp: G.hazards, nm: 'Stone slab over the top flight: wait while it rests, go as it rises' });
  for (let s = L4 + 6; s <= L4 + 54; s += 6) if (!(s > L4 + 16 && s < L4 + 22) && !(s > L4 + 34 && s < L4 + 40) && !(s > L4 + 43 && s < L4 + 49)) fruit(s, 0, stairY(s));
  arc(L4 + 18, L4 + 20.5, 0, stairY(L4 + 19), .7, 'Fruit over the first break'); arc(L4 + 36, L4 + 38.5, 0, stairY(L4 + 37), .7, 'Fruit over the second break');
  // Stair top: a 39 × 16 m rest where the bristleback debuts alone, a payout sandwich (R1), a stack, and the drop-in.
  masonry(L4 + 56, L5, -8, 8, 24, 'Stair top: the sluice head terrace');
  patrol(L4 + 61, 0, 24, 'spiker', 3, 1.2, 'bristleback debut on the open stair top: spin it, never stomp it');
  rowAcross(L4 + 67, -5.96, 24, ['wood', 'multihit', 'wood'], 'Sandwich base row: the striped crate is the springboard');
  crate(L4 + 67, -5, 24 + 3.15, 'multihit', 'Sandwich lid: a plain jump from the base bonks it', 'suspended');
  tower(L4 + 67, 5, 24, ['wood', 'wood', 'mystery'], 'Stair top stack');
  checkpoint(L4 + 71, 0, 24, 'Stair top checkpoint');
  parapet(L4 + 56, L5, -8.6, 24, 'Stair top parapet, north'); parapetAcross(L5 - .5, -8.6, 8.6, 24, 'Stair top parapet, east');
  parapet(L4 + 56, L4 + 80, 8.6, 24, 'Stair top parapet, south'); parapet(L4 + 90, L5, 8.6, 24, 'Stair top parapet, south jamb');
  for (const [q, x] of [[L4 + 58, -7], [L4 + 93, -7], [L4 + 93, 7]] as const) torch(q, x, 24, 'Stair top brazier', 1.8, 1.1);
  ravine(L4, L5, () => 12, s => Math.min(24, mainFloorAt(Math.min(L5, Math.max(L4, s)))), 14, [-1], false);

  // =========================================================================
  // LEG 5 · THE SLUICE AND THE AQUEDUCT (406 → 640, south, 24 → 16, board).
  // The one descent, then the channel runs the length of the ravine's east
  // rim sixteen metres above the floor the player started on. At the aqueduct
  // head the route forks (Sphynxinator): the channel for the board, the
  // colonnade on the east for a walker; both rejoin in the abutment court,
  // which stands above the spawn ledge between two sentinels breathing in step.
  // =========================================================================
  rooms.push({ name: 'Sluice and aqueduct', a: L5, b: L6, mode: 'board', lesson: 'smash lane down the sluice; the fork: ollie or grind the crate bridge, charge the Far Break, or walk the colonnade; cross the abutment in the cool phase' });
  const SL = { w: 1.7, rise: 1.3, arc: 64, deck: .6 }; // flat half-width, bank radius, bank arc, lip deck
  const channelHalf = SL.w + SL.rise * Math.sin(SL.arc * Math.PI / 180) + SL.deck;
  const channel = (nodes: { s: number; x: number; y: number; r?: number }[], nm: string) => {
    const [a] = nodes;
    add({ t: 'vertramp', p: pt(a.s, a.y, a.x), pts: nodes.map(q => { const [wx, wz] = dvec(a.s, q.s - a.s, q.x - a.x); return [wx, wz, q.r ?? 0, r4(q.y - a.y)]; }), w: SL.w, rise: SL.rise, arc: SL.arc, deck: SL.deck, arcSteps: 8, vkind: 'half', vert: false, tex: 'jungle', color: JADE, grp: G.lines, nm });
    // Only the flat bed is a standing floor; the banks are ridden, not walked.
    for (let i = 1; i < nodes.length; i++) { const q0 = nodes[i - 1], q1 = nodes[i]; floors.push({ a: q0.s, b: q1.s, ya: q0.y, yb: q1.y, x0: -(SL.w - .2), x1: SL.w - .2, xa: q0.x, xb: q1.x, kind: 'main', nm }); }
    copingRails(nodes, SL.w, SL.rise, SL.arc, SL.deck, nm);
    // Carved masonry carries the channel: a skirt of bonded stone under its full run.
    for (let i = 1; i < nodes.length; i++) { const q0 = nodes[i - 1], q1 = nodes[i]; add({ t: 'decor', dkind: 'templeplatform', p: pt((q0.s + q1.s) / 2, Math.min(q0.y, q1.y) - SL.rise - 1.4, (q0.x + q1.x) / 2), s: [r4(channelHalf * 2 + .8), 1.4, r4(q1.s - q0.s)], yaw: yawAt(q0.s), seed: Math.round(q0.s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · masonry bed` }); }
  };
  channel([{ s: L5, x: 0, y: 24 }, { s: L5 + 16, x: 2.4, y: 21.6, r: 9 }, { s: L5 + 34, x: -2.4, y: 18.6, r: 9 }, { s: L5 + 52, x: 0, y: 16 }], 'The sluice: a banked stone channel down to the aqueduct');
  for (let q = L5 + 4; q <= L5 + 48; q += 6) if (q !== L5 + 10 && q !== L5 + 22 && q !== L5 + 34) fruit(q, 0, mainFloorAt(q) - .2, 'Sluice fruit line');
  // R8 · smash lane on the descent: three stacks twelve metres apart on the bed line.
  stack(L5 + 10, 1.5, mainFloorAt(L5 + 10), 'wood', 'wood', 'Smash lane: first stack');
  stack(L5 + 22, .8, mainFloorAt(L5 + 22), 'wood', 'mystery', 'Smash lane: the question mark rides the second stack');
  stack(L5 + 34, -2.3, mainFloorAt(L5 + 34), 'wood', 'wood', 'Smash lane: third stack, in the bend');
  // The aqueduct: three level spans with the Ravine Break (7 m) and the Far Break (11 m) between them.
  channel([{ s: L5 + 52, x: 0, y: 16 }, { s: L5 + 96, x: 0, y: 16 }], 'Aqueduct channel, first span');
  gaps.push({ a: L5 + 96, b: L5 + 103, y: 16 });
  channel([{ s: L5 + 103, x: 0, y: 16 }, { s: L5 + 166, x: 0, y: 16 }], 'Aqueduct channel, second span');
  gaps.push({ a: L5 + 166, b: L5 + 177, y: 16 });
  channel([{ s: L5 + 177, x: 0, y: 16 }, { s: L5 + 216, x: 0, y: 16 }], 'Aqueduct channel, third span');
  // The void beside the rim: never over the ravine floor to the west, so a slip there costs the climb back, not a life.
  pit(L5 + 50, L5 + 216, -14, 2, 16, 'The gully east of the aqueduct');
  // Checkpoints on a board line bank at smash speed and trip below it (the engine's rule), so both sit where the line is fast.
  stack(L5 + 59, -1.5, 16, 'wood', 'wood', 'Aqueduct lane stack, east'); checkpoint(L5 + 62, 0, 16, 'Aqueduct head checkpoint: the fork'); stack(L5 + 65, 1.5, 16, 'wood', 'wood', 'Aqueduct lane stack, west');
  // R7 · one-way grind bridge: six crates on the bed line over the Ravine Break, lids 1.15 m up. Ollie the seven metres
  // (9.4 m from cruise), or catch the row and grind it, consuming it.
  rowAlong(L5 + 96.9, 0, 16, ['wood', 'wood', 'wood', 'wood', 'wood', 'wood'], 'Crate bridge over the Ravine Break', 'bridge');
  crate(L5 + 108, 1.5, 16, 'wood', 'Landing marker beyond the Ravine Break');
  checkpoint(L5 + 124, 0, 16, 'Run-up checkpoint: forty-two clear metres to the Far Break');
  // XVII.1 · the Far Break: 11 m level. A cruise ollie (9.4 m) fails; 18 m/s clears it (12.6 m). Nothing stands on the 42 m run-up.
  arc(L5 + 166, L5 + 177, 0, 16.4, 2.2, 'Far Break');
  crate(L5 + 184, 0, 16, 'mystery', 'Landing marker beyond the Far Break');
  stack(L5 + 190, -1.5, 16, 'wood', 'wood', 'Third span lane stack, east'); stack(L5 + 196, 1.5, 16, 'wood', 'wood', 'Third span lane stack, west');
  // The third span is where a rider sheds the Far Break's speed: its checkpoint stands ten metres short of the pair so a stop
  // before the sentinels is a real option, and the colonnade's last floor runs on into the cistern passage.
  checkpoint(L5 + 210, 0, 16, 'Third span checkpoint: before the abutment pair');
  for (let q = L5 + 58; q <= L5 + 212; q += 7) if (!(q > L5 + 92 && q < L5 + 106) && !(q > L5 + 160 && q < L5 + 180)) fruit(q, 0, 16 - .2, 'Aqueduct fruit line');
  // Arches: pier pairs every twelve metres from the rim rock up to the channel bed, lintels between them.
  for (let q = L5 + 56; q <= L5 + 212; q += 12) for (const side of [-1, 1]) {
    const x = side * 2.6;
    add({ t: 'decor', dkind: 'stonebase', p: pt(q, -4, x), s: [2.6, .85, 2.6], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier base' });
    for (let y = -3.15; y < 12.4; y += 1.8) add({ t: 'decor', dkind: 'stoneshaft', p: pt(q, y, x), s: [1.65, 1.8, 1.65], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier' });
    add({ t: 'decor', dkind: 'stonecapital', p: pt(q, 12.45, x), s: [2.8, 1.15, 2.8], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier capital' });
  }
  for (let q = L5 + 62; q <= L5 + 212; q += 12) add({ t: 'decor', dkind: 'stonearch', p: pt(q, 13.3, 0), s: [6.2, 1.2, 1.2], yaw: 90 + yawAt(q), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct arch' });
  // The colonnade: the fork's other branch, a six-metre walkway on the east with columns and lintels and three fallen
  // floors; its crates are a block, a row (a grind line for a walker who carries the board) and a stack after the last gap.
  const colX = -12, colHalf = 3;
  for (const [a, b] of [[L5 + 50, L5 + 76], [L5 + 78.8, L5 + 116], [L5 + 119, L5 + 156], [L5 + 158.6, L5 + 217]] as const) masonry(a, b, colX - colHalf, colX + colHalf, 16, 'Colonnade walkway', { lip: false });
  for (const [a, b] of [[L5 + 76, L5 + 78.8], [L5 + 116, L5 + 119], [L5 + 156, L5 + 158.6]] as const) arc(a, b, colX, 16, .9, 'Fruit over the fallen floor');
  for (let q = L5 + 54; q <= L5 + 216; q += 6) column(q, colX - colHalf - .9, 16, 6.2, 'Colonnade column');
  for (let q = L5 + 57; q <= L5 + 216; q += 6) { add({ t: 'decor', dkind: 'stonelintel', p: pt(q, 23.3, colX - colHalf - .9), s: [6.3, 1, 1.1], yaw: yawAt(q), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade lintel' }); add({ t: 'decor', dkind: 'stoneroof', p: pt(q, 24.3, colX - 1.2), s: [6.3, 1.1, 6], yaw: yawAt(q), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade roof' }); }
  parapet(L5 + 50, L5 + 216, colX + colHalf + .7, 16, 'Colonnade parapet toward the channel');
  rowAcross(L5 + 68, -12.48, 16, ['wood', 'wood'], 'Colonnade block, front row'); rowAcross(L5 + 68.96, -12.48, 16, ['wood', 'wood'], 'Colonnade block, back row');
  rowAlong(L5 + 124, colX, 16, ['wood', 'mystery', 'wood'], 'Colonnade row: a grind line between the fallen floors');
  patrol(L5 + 136, colX, 16, 'hopper', 1.2, 1.1, 'spring frog on the colonnade, its second rung: between the fallen floors');
  stack(L5 + 166, colX, 16, 'wood', 'mystery', 'Colonnade stack after the third fallen floor');
  // The aqueduct head joins the channel bank to the colonnade: the walkers' way, and the frog's debut on 6 × 12 m with no lethal edge in reach.
  masonry(L5 + 50, L5 + 62, colX + colHalf, -3.4, 16, 'Aqueduct head: the walkers\' way onto the colonnade', { lip: false });
  patrol(L5 + 54, -7, 16, 'hopper', 1, 1.1, 'spring frog debut on the aqueduct head: spin only while it is grounded');
  tower(L5 + 60, -7.2, 16, ['wood', 'wood', 'mystery'], 'Aqueduct head stack');
  // The abutment court above the spawn ledge: channel and colonnade meet, the pair flanks the way in (rung 4: combine).
  masonry(L5 + 216, L6, -8, 8, 16, 'Abutment court');
  // The pair stands just inside the court's mouth, clear of the lane's turn east (z 27) and of the cistern passage.
  const PAIR = L5 + 220;
  sentinel(PAIR, -6.2, 16, 1, 8, 24, 0, 'Abutment sentinel, east'); sentinel(PAIR, 6.2, 16, -1, 8, 24, 0, 'Abutment sentinel, west');
  stack(L5 + 228, 6.5, 16, 'wood', 'mystery', 'Count trap in the court corner over the ravine');
  tower(L5 + 231.5, 0, 16, ['wood', 'wood', 'wood'], 'Abutment stack beyond the sweep');
  parapet(L5 + 216, L6, 8.6, 16, 'Abutment court parapet over the ravine'); // The turning apron (world space; stations past the leg's end belong to the cistern): fourteen metres of court beyond the
  // lane's bend, so a rider who misses the turn rolls out and comes back instead of meeting a wall eight metres on.
  add({ t: 'platform', p: W3(16, 15.4, 43), s: [16, 1.2, 14], tex: 'jungle', color: STONE, artProxy: true, grp: G.masonry, nm: 'Abutment court: the turning apron' });
  add({ t: 'decor', dkind: 'templeplatform', p: W3(16, 14.775, 43), s: [16, 1.2, 14], seed: 4311, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Abutment court: the turning apron · bonded masonry' });
  kerbWorld(7.4, 43, 14, false, 16, 'Turning apron kerb, west'); kerbWorld(24.6, 42.7, 14.6, false, 16, 'Turning apron kerb, east'); kerbWorld(16, 49.6, 17.2, true, 16, 'Turning apron kerb, south');
  for (const x of [10.4, 16, 21.6]) add({ t: 'decor', dkind: 'templewall', p: W3(x, 16, 50.4), s: [5.62, 5.2, 1.2], yaw: 0, seed: 4320 + Math.round(x), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Turning apron end wall' });
  // The hillside east of the rim; the ravine's own walls stand to the west, sixteen metres down.
  ravine(L5, L5 + 50, () => 11, q => mainFloorAt(q), 14, [-1], false);
  ravine(L5 + 50, L5 + 216, () => 30, () => -4, 24, [-1], false);
  for (let q = L5 + 54; q < L5 + 216; q += 11) { plant(q % 22 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', q + 6, -36.5, 12.6, 14, 'Hillside cliff, third course', 180, G.landscape); plant(q % 22 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', q + 2, -34, 4.8, 13, 'Hillside cliff, second course', 180, G.landscape); }
  for (const q of [L5 + 66, L5 + 116, L5 + 176]) torch(q, -33, -4 + 22, 'Hillside brazier', 1.9, 1.1);
  for (const q of [L5 + 8, L5 + 40]) torch(q, -6.8, mainFloorAt(q) + .3, 'Sluice brazier', 1.8, 1.05);

  // =========================================================================
  // LEG 6 · THE CISTERN (640 → 728, east, 16 → 19.5). A cave hall under a dome,
  // dark but for braziers. The reservoir bowl fills the floor between a cornice
  // ledge on the north wall that climbs in broken steps to a switch and a south
  // floor where the ember sentry stands behind cover. The switch fills a ghost
  // block on the hall floor (switch, then return). A sentinel in a niche sweeps
  // the exit lip; the ramp at the far wall is the fast way up to the gallery.
  // =========================================================================
  rooms.push({ name: 'The Cistern', a: L6, b: L7, mode: 'foot', lesson: 'cross the basin at speed or climb the cornice to the switch; the block it fills waits on the hall floor; time the exit under the niche sentinel' });
  masonry(L6, L6 + 16, -8, 8, 16, 'Cistern entry passage');
  stack(L6 + 6, -1.5, 16, 'wood', 'wood', 'Cistern lane stack, north'); checkpoint(L6 + 9, 0, 16, 'Cistern entry checkpoint'); stack(L6 + 12, 1.5, 16, 'wood', 'wood', 'Cistern lane stack, south');
  const hallA = L6 + 16, hallB = L6 + 65.6, bowlC = L6 + 39, bowlR = 7, bowlArc = 45, bowlW = 6, bowlDeck = .6;
  const bowlHalf = bowlW + bowlR * Math.sin(bowlArc * Math.PI / 180) + bowlDeck, bowlBase = 16 - bowlR * (1 - Math.cos(bowlArc * Math.PI / 180));
  // The trough lies across the course (its own yaw 90 on top of the leg's): the rider drops in over the entry lip and climbs out over the exit lip.
  add({ t: 'vertramp', p: pt(bowlC, bowlBase, 0), len: 24, w: bowlW, rise: bowlR, arc: bowlArc, deck: bowlDeck, arcSteps: 24, vkind: 'half', yaw: 90 + yawAt(bowlC), vert: false, rails: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'The jade reservoir' });
  for (const side of [-1, 1]) { add({ t: 'decor', dkind: 'templeplatform', p: pt(bowlC, bowlBase - 1.5, side * 12.7), s: [1.4, 17.5 - bowlBase, r4(bowlHalf * 2 + .4)], yaw: yawAt(bowlC), seed: 695 + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Reservoir end wall' }); add({ t: 'wall', p: pt(bowlC, bowlBase - 1.5, side * 12.7), s: [1.4, 17.5 - bowlBase, r4(bowlHalf * 2 + .4)], yaw: yawAt(bowlC), invisible: true, grp: G.masonry, nm: 'Reservoir end wall core' }); }
  pipes.push({ name: 'The jade reservoir', a: bowlC - bowlHalf, b: bowlC + bowlHalf, lipY: 16, radius: bowlR, arc: bowlArc, baseY: bowlBase });
  floors.push({ a: bowlC - bowlHalf, b: bowlC + bowlHalf, ya: 16, yb: 16, x0: -12, x1: 12, kind: 'main', nm: 'reservoir lips' });
  masonry(hallA, bowlC - bowlHalf, -12, 12, 16, 'Cistern floor before the bowl', { lip: false });
  // A censer hangs in the hall over the lane between the entry passage and the reservoir, swinging across the course: it is
  // low only through the middle of its swing, so a rider times the gap or swings wide of its track (the hall is 24 m across).
  censer(L6 + 22, 0, 16 + 7.6, 6, .9, 1.35, 0, 'Censer over the cistern lane: time the swing or ride round its track');
  masonry(bowlC + bowlHalf, hallB, -12, 12, 16, 'Cistern floor beyond the bowl', { lip: false });
  masonry(hallA, hallB, 12, 20, 16, 'Cistern south floor', { lip: false });
  masonry(hallA, L6 + 34, -20, -12, 16, 'Cistern north cornice', { lip: false });
  rowAcross(bowlC - bowlHalf + 1.2, -.48, 18.6, ['wood', 'wood'], 'Pair above the entry lip: pop off the lip before the drop', 'suspended');
  rowAcross(L6 + 55, -2.98, 18, ['wood', 'mystery'], 'Pair on the exit arc: a fast crossing flies out of the bowl; veer north at the top', 'suspended');
  for (const q of [bowlC - 4, bowlC, bowlC + 4]) fruit(q, 0, q === bowlC ? bowlBase : bowlBase + 1.2, 'Reservoir fruit');
  const cornice: [number, number, number][] = [[L6 + 38, -16, 17.5], [L6 + 44, -15, 18.5], [L6 + 50, -17, GALLERY], [L6 + 56, -15, GALLERY], [L6 + 62, -17, GALLERY], [L6 + 68, -15, GALLERY], [L6 + 73, -11, GALLERY]];
  for (const [i, [q, x, y]] of cornice.entries()) ledge(q, x, y, 4, 4, i === 6 ? 'Cornice landing before the gallery' : `Cornice step ${i + 1}`);
  promised(L6 + 73, -11, GALLERY, 'bang', 'Cornice switch: it fills the promise block on the hall floor below', 'switch');
  pit(L6 + 53, L6 + 74, -20, -12, 16, 'The cistern drain: a shaft under the last cornice steps');
  rowAcross(L6 + 36, 15.04, 16, ['wood', 'metal', 'wood'], 'Cover row before the ember sentry');
  patrol(L6 + 41, 16, 16, 'sentry', 0, 1, 'ember sentry on the south floor: it shoots only what it can see');
  promised(L6 + 54.5, 5.5, 16, 'wood', 'Promise block, front left'); promised(L6 + 54.5, 6.46, 16, 'wood', 'Promise block, front right');
  promised(L6 + 55.46, 5.5, 16, 'wood', 'Promise block, back left'); promised(L6 + 55.46, 6.46, 16, 'mystery', 'Promise block, back right');
  sentinel(L6 + 60, 9, 16, -1, 8, 28, 1.6, 'Niche sentinel sweeping the exit lip');
  flight(hallB, L6 + 75.6, 16, GALLERY, -8, 8, 'Cistern ramp up to the gallery', false);
  masonry(L6 + 24, L6 + 32, -27, -20, 16, 'Side chapel of the Reliquary', { lip: false, kind: 'side' });
  add({ t: 'bonusplatform', p: pt(L6 + 28, 16, -24), to: pt(L6 + 28, 16.12, -15), grp: G.course, nm: 'Ember Reliquary: the single temple bonus and safe return' });
  for (const q of [L6 + 24, L6 + 32]) add({ t: 'decor', dkind: 'templewall', p: pt(q, 16, -23.5), s: [7, 4.6, 1.2], yaw: yawAt(q), seed: Math.round(q), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Chapel wall' });
  torch(L6 + 28, -26.5, 16, 'Chapel brazier', 1.5, 1);
  masonry(L6 + 75.6, L7, -8, 8, GALLERY, 'Cistern exit gallery');
  sideCheckpoint(L6 + 81, -4.2, GALLERY, L6 + 78.8, -4.6, 'Gallery checkpoint: on the way to the steps, off the board line');
  tower(L6 + 86, -5, GALLERY, ['wood', 'wood', 'wood'], 'Gallery stack, north'); tower(L6 + 86, 5, GALLERY, ['wood', 'wood', 'mystery'], 'Gallery stack, south');
  parapetAcross(L7 - .5, -8.6, 8.6, GALLERY, 'Gallery parapet, east'); parapet(L6 + 75.6, L7, 8.6, GALLERY, 'Gallery parapet, south');
  for (let q = L6 + 12; q <= L7; q += 11) for (const side of [-1, 1]) { if (q > L6 + 68 && side < 0) continue; const half = q < hallA ? 9 : q > L6 + 68 ? 9 : side < 0 ? 28 : 21; plant(q % 22 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', q, side * (half + 5), 15.4, 12.5, 'Cistern wall', side > 0 ? 180 : 0, G.landscape); plant(q % 22 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', q + 4, side * (half + 6), 22, 12.5, 'Cistern wall, upper course', side > 0 ? 180 : 0, G.landscape); }
  for (let q = L6 + 16; q <= L6 + 68; q += 18) for (const x of [-12, 6]) plant(q % 36 ? 'trialsv2caveroofa' : 'trialsv2caveroofb', q, x, 29, 20, 'Cistern dome', 0, G.landscape);
  for (const [q, x] of [[L6 + 20, 18], [L6 + 64, 18], [L6 + 20, -19], [L6 + 34, -19]] as const) { add({ t: 'decor', dkind: 'stonebase', p: pt(q, 16, x), s: [1.6, .55, 1.6], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Cistern brazier base' }); torch(q, x, 16.5, 'Cistern brazier', 1.7, 1.2); }

  // =========================================================================
  // LEG 7 · THE SANCTUARY STEPS AND THE TERRACE (728 → 860, north, 19.5 → 30).
  // Four ledges rising 2.25 m over the drain with the bristleback on the second;
  // then the release: the lane group, a wall with a '?', two heads phased as a
  // green wave, the bank onto the brazier dais, Nitro rows either side of the
  // drop off its back with a third head half a cycle off, the one-shot height
  // budget, the green switch last and the gate under a roofed sanctuary.
  // =========================================================================
  rooms.push({ name: 'Sanctuary', a: L7, b: END, mode: 'board', lesson: 'four jumps up over the drain; hold cruise through the wave, launch onto the dais, drop straight between the Nitro rows, spend the height budget once, hit the green switch last' });
  const sanctuarySteps: [number, number, number][] = [[L7 + 4, -2, GALLERY + 2.25], [L7 + 12, 2, GALLERY + 4.5], [L7 + 20, -2, GALLERY + 6.75], [L7 + 28, 2, GALLERY + 9]];
  for (const [i, [q, x, y]] of sanctuarySteps.entries()) ledge(q, i === 0 ? -1 : x, y, i === 0 ? 7 : 5, 5, `Sanctuary step ${i + 1}`);
  pit(L7, L7 + 32, -12, 12, GALLERY, 'The drain below the sanctuary steps');
  patrol(L7 + 12, 2, GALLERY + 4.5, 'spiker', 1.2, 1.2, 'bristleback on the second step: spin only');
  for (let i = 0; i < 3; i++) arc(sanctuarySteps[i][0] + 2.5, sanctuarySteps[i + 1][0] - 2.5, (sanctuarySteps[i][1] + sanctuarySteps[i + 1][1]) / 2, sanctuarySteps[i][2] + 1.5, 1, 'Fruit between the sanctuary steps');
  ravine(L7, L7 + 32, () => 12, q => GALLERY + (30 - GALLERY) * (q - L7) / 32, 14);
  const T = L7 + 30.5;
  masonry(T, END + 1, -20, 20, 30, 'Sanctuary terrace', { lip: false });
  const terraceSentinels: [number, number][] = [[T + 17.5, -6], [T + 25.5, 6], [T + 68.5, -6]];
  for (let q = T + 2.5; q < END - 6; q += 2.65) for (let x = -18.5; x <= 18.5; x += 2.65) { if ((q > T + 35.5 && q < T + 61.5 && Math.abs(x) < 7.5) || terraceSentinels.some(([ts, tx]) => Math.abs(q - ts) < 3.2 && Math.abs(x - tx) < 3.2) || rnd(q * 3 + x) < .14) continue; add({ t: 'decor', dkind: 'stonepaver', p: pt(q, 29.85, x), s: [2.5, .23, 2.55], yaw: 90 + yawAt(q), solid: false, scenerySolid: false, castShadow: false, color: rnd(q + x) > .5 ? '#e2dcc3' : '#f1e6cb', grp: G.masonry, nm: 'Terrace paving' }); }
  tower(T + 3.5, -1.5, 30, ['wood', 'wood', 'wood'], 'Terrace lane stack, left'); checkpoint(T + 6.5, 0, 30, 'Terrace checkpoint'); tower(T + 9.5, 1.5, 30, ['wood', 'wood', 'wood'], 'Terrace lane stack, right');
  stack(T + 4.5, 6.5, 30, 'wood', 'mystery', 'Count trap beside the terrace checkpoint');
  rowAcross(T + 15.5, -14.96, 30, ['wood', 'wood', 'wood'], 'Procession wall, base row');
  rowAcross(T + 15.5, -14.96, 30.96, ['wood', 'mystery', 'wood'], 'Procession wall, top row: the question mark is in the middle', 'cap');
  const DAIS = 32;
  masonry(T + 37.5, T + 59.5, -6, 6, DAIS, 'Brazier dais', { thick: 2, lip: true });
  const bank = { rise: 13.2, arc: 32 }, bankS = T + 28.5, bankLip = bankS + bank.rise * Math.sin(bank.arc * Math.PI / 180);
  add({ t: 'vertramp', p: pt(bankS, 30, 0), len: 9, w: 0, rise: bank.rise, arc: bank.arc, deck: 0, arcSteps: 12, vkind: 'quarter', yaw: QUARTER_YAW + yawAt(bankS), vert: false, rails: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'Dais launch bank' });
  floors.push({ a: bankS, b: bankLip, ya: 30, yb: 30 + bank.rise * (1 - Math.cos(bank.arc * Math.PI / 180)), x0: -4.5, x1: 4.5, kind: 'main', nm: 'launch bank quarter' });
  arc(bankLip, T + 37.5, 0, DAIS, 1, 'Fruit over the gap to the dais');
  add({ t: 'crystal', p: pt(T + 48.5, DAIS, 0), grp: G.course, nm: 'Temple summit crystal' });
  torch(T + 48.5, -4.4, DAIS, 'Dais brazier', 2.2, 1.6); torch(T + 48.5, 4.4, DAIS, 'Dais brazier', 2.2, 1.6);
  torch(T + 58.5, -5, DAIS, 'Dais corner lamp', 1.4, .9); torch(T + 58.5, 5, DAIS, 'Dais corner lamp', 1.4, .9);
  rowAcross(T + 63.5, -9.42, 30, ['nitro', 'nitro', 'nitro'], 'Nitro row left of the drop lane', 'nitro');
  rowAcross(T + 63.5, 7.5, 30, ['nitro', 'nitro', 'nitro'], 'Nitro row right of the drop lane', 'nitro');
  crate(T + 63.5, 8.46, 33.5, 'life', 'Life over the Nitro row: jump from beside it and bonk it; a stomp lands on Nitro', 'suspended');
  sentinel(T + 17.5, -6, 30, 1, 7.8, 28, 0, 'Terrace sentinel, first of the wave'); sentinel(T + 25.5, 6, 30, -1, 7.8, 28, 7.13, 'Terrace sentinel, second of the wave');
  sentinel(T + 68.5, -6, 30, 1, 7.8, 28, 7.53, 'Terrace sentinel beyond the dais: the wave\'s break');
  patrol(T + 37.5, 18.2, 30, 'charger', 18, 2.4, 'russet bull running the right side of the terrace: read the windup, keep left, strike while it is dizzy', true);
  tower(T + 74.5, 3, 30, ['wood', 'wood', 'wood'], 'Height budget stack: stomp the top once, then double jump');
  crate(T + 74.5, 3, 38.4, 'mystery', 'Target 8.4 m up: reached only from the intact stack', 'suspended');
  crate(T + 78.5, -4, 30, 'nitrobang', 'Green switch, the last thing before the gate: it counts both Nitro rows');
  add({ t: 'decor', dkind: 'roofedtemple', p: pt(T + 85.5, 30, 0), s: [19, 13.5, 14], yaw: yawAt(T + 85), openFloor: true, seed: 860, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Sanctuary roof over the gate' });
  for (const side of [-1, 1]) for (const along of [-5.3, 5.3]) { add({ t: 'wall', p: pt(T + 85.5 + along, 30, side * 7.8), s: [2.2, 8, 2.2], invisible: true, grp: G.masonry, nm: 'Sanctuary column core' }); scenery.push({ s: T + 85.5 + along, x: side * 7.8, y: 30, radius: 1.2, nm: 'Sanctuary column' }); }
  add({ t: 'gate', p: pt(T + 87.5, 30, 0), yaw: yawAt(T + 87.5), grp: G.course, nm: 'Temple sanctuary finish' });
  parapetAcross(END - .5, -20.6, 20.6, 30, 'Terrace back wall');
  add({ t: 'decor', dkind: 'templewall', p: pt(END - .5, 30, 0), s: [40, 3.2, 1.2], yaw: yawAt(END - 1), seed: 872, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Terrace back wall' });
  for (const side of [-1, 1]) { add({ t: 'decor', dkind: 'templewall', p: pt((T + END) / 2, 30, side * 20.6), s: [r4(END - T), 1.6, 1.2], yaw: 90 + yawAt(T + 40), seed: 823 + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Terrace parapet' }); const [wx, wz] = dvec(T, END - T, 0); add({ t: 'wallpath', p: pt(T, 29.9, side * 20.6), pts: [[0, 0], [wx, wz]], w: .5, rise: 1.6, collisionHeight: 5, containment: true, invisible: true, grp: G.bounds, nm: 'Terrace parapet containment' }); }
  for (let q = T + 5.5, i = 0; q < END - 4; q += 14, i++) for (const side of [-1, 1]) { plant(i % 2 ? 'trialsv2treea' : 'trialsv2treeb', q, side * (26 + rnd(q + side) * 5), 29 - rnd(q) * 2, 22 + rnd(q * 3) * 4, 'Summit tree', rnd(q * 11 + side) * 360); if (i % 2 === 0) plant('trialsv2crowna', q + 7, side * 33, 38, 24, 'Summit canopy', rnd(q * 13) * 360); if (i % 3 === 0) plant(i % 2 ? 'trialsv2ferna' : 'trialsv2fernb', q + 3, side * 19.2, 30.1, 3, 'Terrace fern', rnd(q * 5 + side) * 360); }
  for (const [q, x] of [[T + 5.5, -18.6], [T + 5.5, 18.6], [T + 81.5, -18.6], [T + 81.5, 18.6]] as const) { add({ t: 'decor', dkind: 'stonebase', p: pt(q, 30, x), s: [1.6, .55, 1.6], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Terrace brazier base' }); torch(q, x, 30.5, 'Terrace brazier', 1.8, 1.2); }
  add({ t: 'clock', p: pt(-10, 4, -3), grp: G.course });

  // =========================================================================
  // DRESSING PASS · light, backdrops and turn cues. Content only: nothing here moves a floor.
  // =========================================================================
  // Walls say "turn": a leg that ends at a wall gets a five-metre carved face instead of a kerb, so the stop reads from far off.
  const endWall = (s: number, y: number, nm: string) => { for (const x of [-5.6, 0, 5.6]) add({ t: 'decor', dkind: 'templewall', p: pt(s, y, x), s: [5.62, 5.2, 1.2], yaw: yawAt(s), seed: (Math.round(s) * 3 + Math.round(x) + 64) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm }); };
  endWall(L2 - .2, 0, 'Corner court end wall'); endWall(L3 - .2, 8, 'Landing court end wall'); endWall(L7 - .2, GALLERY, 'Gallery end wall');
  // The side view needs something to be seen against: a carved wall behind the far parapet, rising with the flights, and
  // braziers along its foot so the breaks, the mossback and the slab are lit from behind the action.
  for (let q = L4 + 2; q < L4 + 56; q += 6) add({ t: 'decor', dkind: 'templewall', p: pt(q + 3, stairY(q + 3) - 2.4, -5.5), s: [6.06, 8.6, 1.4], yaw: yawAt(q + 3) + 90, seed: Math.round(q) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Stair backdrop wall' });
  for (const q of [L4 + 7, L4 + 15, L4 + 25, L4 + 33, L4 + 42, L4 + 53]) torch(q, -2.7, stairY(q), 'Stair brazier', 1.9, 1.05);
  // Light at every place the route asks for a decision.
  torch(L2 + 31.5, -3.05, 4, 'Rest pad brazier', 1.7, 1); torch(L2 + 31.5, 3.05, 4, 'Rest pad brazier', 1.7, 1);
  torch(L3 + 19.1, 2.7, 14, 'Rest tier brazier', 1.7, 1);
  torch(L5 + 232.5, 7, 16, 'Abutment court brazier', 1.8, 1.1);
  torch(L6 + 77, -7, GALLERY, 'Gallery brazier', 1.8, 1.1); torch(L6 + 77, 7, GALLERY, 'Gallery brazier', 1.8, 1.1);
  // Fruit draws the turns: off the lane toward the west arch, and round the abutment bend into the cistern.
  for (const [q, x] of [[130, -1.6], [133, -3], [136, -4.2]] as const) fruit(q, x, 0, 'Fruit toward the west arch');
  for (const [q, x] of [[L5 + 221.2, -1.1], [L5 + 223.9, -4], [L5 + 224.9, -6.8]] as const) fruit(q, x, 16, 'Fruit round the abutment bend');

  // Nothing floats: every stepping stone of the two climbs stands on a shaft that runs down into the dark.
  const shaft = (s: number, x: number, top: number, w: number, d: number, nm: string) => add({ t: 'decor', dkind: 'templeplatform', p: pt(s, top - 16.6, x), s: [r4(w - .5), 15, r4(d - .5)], yaw: yawAt(s), seed: (Math.round(s * 5 + x * 3) + 900) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · shaft` });
  for (const [i, [q, x, y, d]] of hops.entries()) shaft(q, x, y, i === 2 ? 6 : 3.5, d, 'Fallen ledge');
  shaft(L3 + 30, -9.5, 15, 3.5, 3.5, 'Side ledge');
  for (const [i, [q, x, y]] of sanctuarySteps.entries()) shaft(q, i === 0 ? -1 : x, y, i === 0 ? 7 : 5, 5, 'Sanctuary step');
  // The Far Break gets a second answer: a fallen beam along the channel's west side, so a rider short of the charge can
  // ollie onto it and grind the gap (the ollie over the middle stays the fast line).
  { const a = L5 + 159, b = L5 + 184, x = 2.5, [wx, wz] = dvec(a, b - a, 0);
    add({ t: 'rail', p: pt(a, 16.55, x), pts: [[0, 0, 0, 0], [wx, wz, 0, 0]], color: GOLD, grp: G.lines, nm: 'Fallen beam across the Far Break: grind it when the charge is short' });
    add({ t: 'decor', dkind: 'stonelintel', p: pt((a + b) / 2, 16.02, x), s: [r4(b - a), .5, .55], yaw: yawAt(a) + 90, seed: 577, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Fallen beam across the Far Break · stone' }); }

  // The apron pays for the roll-out: two stacks and two braziers in its far corners, so missing the bend finds something.
  for (const x of [11.5, 20.5]) { add({ t: 'crate', p: W3(x, 16, 46.6), kind: 'wood', grp: G.crates, nm: 'Turning apron stack' }); add({ t: 'crate', p: W3(x, 16.96, 46.6), kind: 'mystery', grp: G.crates, nm: 'Turning apron stack: cap' }); }
  for (const x of [9.2, 22.8]) add({ t: 'torch', p: W3(x, 16, 48.4), rise: 1.8, w: 1.1, grp: G.lamps, nm: 'Turning apron brazier' });
  // The finish: braziers either side of the gate under the sanctuary roof.
  torch(T + 86.5, -3.4, 30, 'Gate brazier', 2, 1.3); torch(T + 86.5, 3.4, 30, 'Gate brazier', 2, 1.3);

  // ---- verification -------------------------------------------------------
  // The authoring rules of docs/TEMPLE_OF_EMBERS_DESIGN.md and the bible's Part XX checklist, run at build.
  const checks: string[] = [], problems: string[] = [];
  const check = (label: string, body: () => void) => { checks.push(label); body(); };
  const COUNTED = (c: PlacedCrate) => !['bang', 'nitrobang', 'metal', 'metalbounce'].includes(c.kind);
  check('every crate stands on authored floor', () => { for (const c of crates) { if (c.flags.has('cap') || c.flags.has('suspended') || c.flags.has('bridge')) continue; const y = floorAt(c.s, c.x); if (y === undefined || Math.abs(y - c.y) > .06) problems.push(`${c.nm} at ${c.s}/${c.x} floats (floor ${y}, crate ${c.y})`); } });
  check('no rail passes through a crate', () => { for (const r of setPieces.rails) for (const c of crates) { if (c.s < r.a - .6 || c.s > r.b + .6) continue; const t = (Math.max(r.a, Math.min(r.b, c.s)) - r.a) / (r.b - r.a || 1), rx = r.x + ((r.xb ?? r.x) - r.x) * t, ry = r.ya + (r.yb - r.ya) * t; if (Math.abs(c.x - rx) < 1.3 && ry > c.y - .3 && ry < c.y + CRATE + .3) problems.push(`${r.name} passes through ${c.nm}`); } });
  check('crates stand inside a flame sweep only on purpose', () => {
    for (const f of setPieces.sentinels) for (const c of crates) {
      const hot = Math.abs(c.s - f.s) <= 3.6 && (c.x - f.x) * f.facing > 0 && Math.abs(c.x - f.x) <= 7.1 + 1.6 && Math.abs(c.y - f.y) < 3;
      if (hot && !c.flags.has('sweep')) problems.push(`${c.nm} stands inside ${f.name}`);
      if (!hot && c.flags.has('sweep') && Math.abs(c.s - f.s) <= 3.6 && Math.abs(c.y - f.y) < 3) problems.push(`${c.nm} is marked as a sweep offering but ${f.name} cannot reach it`);
    }
  });
  check('no hazard stands in scenery and no scenery stands on a pedestal', () => {
    for (const f of setPieces.sentinels) for (const q of scenery) if (!q.nm.includes('lamp') && Math.hypot(q.s - f.s, q.x - f.x) < q.radius + 2.2 && Math.abs(q.y - f.y) < 8) problems.push(`${q.nm} at ${q.s}/${q.x} crowds ${f.name}`);
    for (const f of setPieces.sentinels) for (const o of C) if (o.t === 'wall' && !o.nm?.includes(f.name) && !o.nm?.includes('parapet')) { const [s, , x] = templeToLocal(o.p); if (Math.hypot(s - f.s, x - f.x) < 2.6) problems.push(`${o.nm} intersects ${f.name}`); }
  });
  check('no crate inside a censer swing', () => { for (const q of setPieces.censers) for (const c of crates) if (Math.abs(c.s - q.s) < q.len * Math.sin(q.amp) + 1.2 && Math.abs(c.x - q.x) < 1.9 && c.y + CRATE > q.pivotY - q.len - 1.1) problems.push(`${c.nm} is clipped by the censer at ${q.s}`); });
  check('no crate inside a patrol walk', () => { for (const q of patrols) for (const c of crates) { const inside = q.along ? Math.abs(c.s - q.s) < q.range + 1.4 && Math.abs(c.x - q.x) < 1.8 : Math.abs(c.s - q.s) < 1.4 && Math.abs(c.x - q.x) < q.range + 1.2; if (inside && Math.abs(c.y - q.y) < 2) problems.push(`${c.nm} stands inside the ${q.foe} walk at ${q.s}`); } });
  check('patrols walk on floor', () => { for (const q of patrols) for (const t of [-1, -.5, 0, .5, 1]) { const s = q.along ? q.s + t * q.range : q.s, x = q.along ? q.x : q.x + t * q.range; const y = floorAt(s, x); if (y === undefined || Math.abs(y - q.y) > .4) problems.push(`the ${q.foe} at ${q.s} walks off the floor at ${s}/${x}`); } });
  check('checkpoints respawn ten metres clear of flames, nitro, patrols and swings, on floors six metres deep', () => {
    for (const cp of checkpoints) {
      for (const f of setPieces.sentinels) if (Math.hypot(f.s - cp.s, f.x - cp.x) < 10) problems.push(`${cp.nm} is ${Math.hypot(f.s - cp.s, f.x - cp.x).toFixed(1)} m from ${f.name}`);
      for (const q of patrols) if (Math.hypot(q.s - cp.s, q.x - cp.x) < 8 + (q.along ? q.range : 0)) problems.push(`${cp.nm} is beside the ${q.foe} at ${q.s}`);
      for (const c of crates) if (c.kind === 'nitro' && Math.hypot(c.s - cp.s, c.x - cp.x) < 10) problems.push(`${cp.nm} is beside ${c.nm}`);
      for (const q of setPieces.censers) if (Math.abs(q.s - cp.s) < 10) problems.push(`${cp.nm} is under the censer at ${q.s}`);
      const y = floorAt(cp.s, cp.x); if (y === undefined) problems.push(`${cp.nm} has no floor`);
      const f = floors.filter(q => q.kind === 'main' && cp.s >= q.a && cp.s <= q.b).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0]; if (!f || f.b - f.a < 6) problems.push(`${cp.nm} stands on a floor under six metres deep`);
    }
  });
  check('volatile crates keep their blast away from boxes that are not meant to pay out', () => {
    for (const c of crates) { if (c.kind !== 'nitro' && c.kind !== 'tnt') continue; for (const o of crates) { if (o === c || (o.kind === 'nitro' && c.kind === 'nitro') || (o.s === c.s && o.x === c.x) || o.flags.has('blast')) continue; if (Math.hypot(o.s - c.s, o.x - c.x) < 2.75 + .6 && Math.abs(o.y - c.y) < 3) problems.push(`${o.nm} stands inside the blast of ${c.nm}`); } }
    for (const c of crates) if (c.flags.has('blast') && !crates.some(o => (o.kind === 'tnt' || o.kind === 'nitro') && Math.hypot(o.s - c.s, o.x - c.x) < 3.35 && Math.abs(o.y - c.y) < 3)) problems.push(`${c.nm} is marked as a blast payout but no explosive reaches it`);
  });
  check('platforming gaps are within a single jump and ledges within a jump\'s height', () => {
    for (const chain of [setPieces.plinths, setPieces.ledges]) {
      const steps = [...chain].filter(q => !/Side ledge|Balcony/.test(q.name)).sort((a, b) => a.s - b.s);
      for (let i = 1; i < steps.length; i++) { const a = steps[i - 1], b = steps[i], gap = (b.s - b.d / 2) - (a.s + a.d / 2), rise = b.y - a.y; if (gap > 12) continue; if (gap > 4.6 || rise > 2.4) problems.push(`${a.name} → ${b.name}: gap ${gap.toFixed(1)} m, rise ${rise.toFixed(1)} m`); }
    }
  });
  check('no crate stands on a stepping stone (ledges and plinths under six metres deep)', () => {
    for (const l of [...setPieces.ledges, ...setPieces.plinths]) { if (l.d >= 6) continue; for (const c of crates) if (!c.flags.has('perch') && !c.flags.has('switch') && Math.abs(c.s - l.s) <= l.d / 2 && Math.abs(c.x - l.x) <= l.w / 2 && Math.abs(c.y - l.y) < .1) problems.push(`${c.nm} stands on ${l.name}`); }
  });
  check('clusters, not sprinkles: mean cluster size at least 2.5 and singles at most a fifth of counted crates', () => {
    const items = crates.filter(COUNTED), parent = items.map((_, i) => i), find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]));
    const L = CRATE * 1.2 + .01;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (Math.abs(a.s - b.s) <= L && Math.abs(a.x - b.x) <= L && Math.abs(a.y - b.y) <= L) parent[find(i)] = find(j); }
    const sizes = new Map<number, number>(); items.forEach((_, i) => sizes.set(find(i), (sizes.get(find(i)) ?? 0) + 1));
    const clusters = sizes.size, singles = [...sizes.values()].filter(n => n === 1).length, mean = items.length / clusters;
    if (mean < 2.5) problems.push(`mean crate cluster size is ${mean.toFixed(2)} (${items.length} counted crates in ${clusters} clusters); the bible asks for at least 2.5`);
    if (singles > items.length * .2) problems.push(`${singles} single crates of ${items.length} counted (${(100 * singles / items.length).toFixed(0)} %); the bible allows a fifth`);
  });
  check('every section carries eight to twenty-four counted crates, except the declared timing peak of the abutment', () => {
    const bounds = [-Infinity, ...checkpoints.map(q => q.s).sort((a, b) => a - b), Infinity];
    for (let i = 1; i < bounds.length; i++) { const a = bounds[i - 1], b = bounds[i], n = crates.filter(c => COUNTED(c) && c.s >= a && c.s < b).length, peak = a <= PAIR && PAIR < b; if (n < (peak ? 3 : 8) || n > 24) problems.push(`section ${i} (${a} → ${b}) carries ${n} counted crates`); }
  });
  check('outline crates belong to the cornice switch group alone, and that group has exactly one switch', () => {
    for (const o of C) if (o.t === 'crate' && o.outline && o.grp !== G.promise) problems.push(`${o.nm} is an outline outside the switch group`);
    const bangs = C.filter(o => o.t === 'crate' && o.kind === 'bang'); if (bangs.length !== 1 || bangs[0].grp !== G.promise) problems.push('the level needs exactly one \'!\' switch, in the promise group');
  });
  check('every arrow has a target that only its bounce reaches', () => {
    for (const a of crates) { if (a.kind !== 'bouncy') continue; const over = crates.filter(o => o !== a && Math.hypot(o.s - a.s, o.x - a.x) <= 2 && o.y > a.y + CRATE);
      if (!over.some(o => o.y - (a.y + CRATE) >= 3.8 && o.y - (a.y + CRATE) <= 6.4)) problems.push(`${a.nm} has no target in the arrow-and-double-jump window`);
      for (const o of crates) if (o !== a && !over.includes(o) && COUNTED(o) && !o.flags.has('suspended') && Math.hypot(o.s - a.s, o.x - a.x) < 6 && Math.abs(o.y - a.y) < 1) problems.push(`${o.nm} stands within stomping range of the arrow gate at ${a.s}`); }
  });
  check('a board charge gap has thirty clear metres of run-up and a checkpoint one beat before it', () => {
    for (const g of gaps) { if (g.b - g.a < 9.5) continue; for (const c of crates) if (c.s > g.a - 30 && c.s < g.a && Math.abs(c.x) < 3) problems.push(`${c.nm} stands on the run-up to the charge gap at ${g.a}`);
      if (!checkpoints.some(q => q.s >= g.a - 60 && q.s < g.a)) problems.push(`no checkpoint within a beat of the charge gap at ${g.a}`); }
  });
  check('the route turns: every leg joins the next at a right angle inside a court, and no two legs overlap in plan', () => {
    for (let i = 1; i < TEMPLE_LEGS.length; i++) { const a = TEMPLE_LEGS[i - 1], b = TEMPLE_LEGS[i]; if (((b.yaw - a.yaw) % 180 + 180) % 180 !== 90) problems.push(`${a.name} → ${b.name} is not a right-angle turn`); if (a.b !== b.a) problems.push(`${a.name} and ${b.name} do not share a station boundary`); }
    const boxes = TEMPLE_LEGS.map(l => { const p0 = templeToWorld(l.a, 0, 0), p1 = templeToWorld(l.b, 0, 0), half = 12; return { l, x0: Math.min(p0[0], p1[0]) - half, x1: Math.max(p0[0], p1[0]) + half, z0: Math.min(p0[2], p1[2]) - half, z1: Math.max(p0[2], p1[2]) + half }; });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 2; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.x0 < b.x1 - 14 && b.x0 < a.x1 - 14 && a.z0 < b.z1 - 14 && b.z0 < a.z1 - 14) problems.push(`${a.l.name} and ${b.l.name} overlap in plan`); }
  });
  if (problems.length) console.warn(`Temple of Embers authoring notes (advisory):\n${problems.join('\n')}`);

  // ---- camera spine and level data ---------------------------------------
  // Camnodes chain leg by leg; each leg's lane stops at its corner court's centre so the camera cuts the corner there.
  for (const l of TEMPLE_LEGS) for (let s = Math.max(l.a, -16); s <= (l.laneEnd ?? l.b); s += 5) add({ t: 'camnode', p: pt(s, mainFloorAt(Math.min(END, Math.max(-16, s))) + 1, 0), radius: 8, grp: G.camera, nm: `${l.name} camera lane` });
  add({ t: 'camnode', p: pt(END, mainFloorAt(END) + 1, 0), radius: 8, grp: G.camera, nm: 'Sanctuary camera lane' });
  const profile: [number, number][] = [];
  for (let s = -16; s <= END; s += 2) profile.push([s, mainFloorAt(s)]);
  const countedCrates = crates.filter(c => !['bang', 'nitrobang', 'metal', 'metalbounce'].includes(c.kind)).length;
  const data: CustomLevelData = {
    v: 1, name: 'Temple of Embers', spawn: pt(-8, 4.12, 1.2), killY: -24, sky: 'night', jungleAtmosphere: true, keepPlayFog: true,
    jungleDepthFade: false, jungleStyle: 'painterly', cameraAirLift: .8, atmosphere: TEMPLE_NIGHT_ATMOSPHERE,
    relicTime: 220, medalTimes: { gold: 220, silver: 300, bronze: 420 }, groups, components: C,
  };
  return { id: 'jungle-terraces', data, sourceComponents: C, toWorld: templeToWorld, toLocal: templeToLocal, frameAt: templeFrameAt,
    groundAt: s => mainFloorAt(Math.min(END, Math.max(-16, s))), profile, pipes, gaps, rooms, climbs: [], voids, chapters: rooms, setPieces,
    tikiTrials: setPieces.sentinels.map(f => ({ s: f.s, side: Math.sign(f.x) })), peak: 32, end: END, countedCrates, checks, floors, floorAt, legs: TEMPLE_LEGS };
}

export const TEMPLE_OF_EMBERS_ROUTE = buildTempleOfEmbers();
export const TEMPLE_OF_EMBERS_LEVEL = TEMPLE_OF_EMBERS_ROUTE.data;
