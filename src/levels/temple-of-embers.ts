import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { TEMPLE_NIGHT_ATMOSPHERE } from './temple-night-atmosphere';

/**
 * TEMPLE OF EMBERS · third design: a temple built into a ravine.
 *
 * World space, course along -Z (station s = -z, x across, negative left).
 * Five rooms: the open ravine floor, the broken Great Stair (on foot), the
 * sluice and broken aqueduct (board), the Cistern hall with the one bowl, and
 * the sanctuary terrace. Uphill is platforming: pits, gaps, height changes and
 * enemies. Skating lines sit on the flats and descents where speed exists.
 * Every surface is masonry from the Jungle Ruins kit or landscape from the
 * Treehouse kit; nothing is a test-lab box. Everything placed is registered and
 * the module refuses to build if a hazard stands in scenery, a rail runs
 * through a crate, or a checkpoint respawns beside a hazard.
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
  rails: { a: number; b: number; x: number; ya: number; yb: number; name: string }[];
}
export interface TempleRoute {
  id: string; data: CustomLevelData; sourceComponents: CustomComponent[];
  toWorld: (s: number, y: number, side?: number) => P; toLocal: (p: readonly number[]) => P;
  frameAt: (s: number) => { x: number; z: number; fx: number; fz: number; scale: number; yaw: number }; groundAt: (s: number) => number;
  profile: readonly (readonly [number, number])[]; pipes: TemplePipe[]; gaps: TempleGap[]; rooms: TempleRoom[]; climbs: TempleClimb[];
  voids: TempleVoid[]; chapters: TempleChapter[]; setPieces: TempleSetPieces; tikiTrials: { s: number; side: number }[];
  peak: number; end: number; countedCrates: number; checks: string[];
  floors: readonly TempleFloor[]; floorAt: (s: number, x?: number) => number | undefined;
}
/** A registered walking surface. `x0..x1` is the lateral extent; when `xa`/`xb` are
 * given they are the centreline x at `a` and `b` and `x0..x1` are offsets from the
 * interpolated centreline (used by swept channels whose centre drifts). */
export interface TempleFloor { a: number; b: number; ya: number; yb: number; x0: number; x1: number; xa?: number; xb?: number; kind: 'main' | 'ledge' | 'side'; nm: string; }
export const templeFloorCentre = (f: TempleFloor, s: number): number => f.xa === undefined || f.xb === undefined ? 0 : f.xa + (f.xb - f.xa) * (s - f.a) / (f.b - f.a || 1);

const STONE = '#c8bc94', JADE = '#79a996', GOLD = '#cfb36c', CRATE = 1.152;
/** A quarter pipe laid across the course, its wall rising away from a rider who arrives along -z. */
const QUARTER_YAW = 90;
/** Height of the cistern's exit gallery; the sanctuary steps climb from it to the terrace at 30. */
const GALLERY = 19.5;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const G = { ground: 1, masonry: 2, lines: 3, crates: 4, course: 5, camera: 6, hazards: 7, patrols: 8, landscape: 90, planting: 91, lamps: 92, bounds: 93 };

type Floor = TempleFloor;
interface PlacedCrate { s: number; x: number; y: number; kind: Kind; nm: string; flags: Set<string>; }
interface Scenery { s: number; x: number; y: number; radius: number; nm: string; }

export function buildTempleOfEmbers(): TempleRoute {
  const C: CustomComponent[] = [];
  const groups: CustomGroup[] = [
    { id: G.ground, nm: 'Ravine floors and ramps', editorOnly: true }, { id: G.masonry, nm: 'Bonded temple masonry', editorOnly: true },
    { id: G.lines, nm: 'Grind lines and fruit', editorOnly: true }, { id: G.crates, nm: 'Crates', editorOnly: true },
    { id: G.course, nm: 'Checkpoints, bonus and finish', editorOnly: true }, { id: G.camera, nm: 'Camera spine', editorOnly: true },
    { id: G.hazards, nm: 'Fire sentinels and censers', editorOnly: true }, { id: G.patrols, nm: 'Patrols', editorOnly: true },
    { id: G.landscape, nm: 'Ravine walls and stones', editorOnly: true }, { id: G.planting, nm: 'Treehouse planting', editorOnly: true },
    { id: G.lamps, nm: 'Braziers and lamps', editorOnly: true }, { id: G.bounds, nm: 'Containment', editorOnly: true },
  ];
  const add = (c: CustomComponent) => C.push(c);
  const z = (s: number) => -s;
  const pt = (s: number, y: number, x = 0): P => [r4(x), r4(y), r4(z(s))];

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
      const bump = rim * (.16 + Math.sin(q.s * .41 + x * .3) * .08);
      vertices.push(r4(x), r4(q.y + bump), r4(z(q.s)));
      uvs.push(r4(x / 8), r4(q.s / 8));
      const paint = centre.clone().lerp(edge, THREE.MathUtils.smoothstep(Math.abs(u), .12, .42)).multiplyScalar(.96 + Math.sin(q.s * .27 + x * .37) * .04);
      colors.push(r4(paint.r), r4(paint.g), r4(paint.b));
    }
    for (let row = 0; row < samples.length - 1; row++) for (let c = 0; c < cols; c++) { const a = row * (cols + 1) + c, b = a + 1, d = a + cols + 1; indices.push(a, b, d, b, d + 1, d); }
    add({ t: 'mesh', p: [0, 0, 0], vertices, colors, uvs, indices, tex: surface === 'loam' ? 'treehouse-loam' : 'treehouse-stone', color: '#ffffff', solidSides: true, grp: G.ground, nm });
  };
  /** Bonded masonry slab: native collision with the Jungle Ruins templeplatform rendering and a carved lip. */
  const masonry = (s0: number, s1: number, x0: number, x1: number, top: number, nm: string, opts: { thick?: number; lip?: boolean; kind?: Floor['kind'] } = {}) => {
    const thick = opts.thick ?? 1.2, w = x1 - x0, d = s1 - s0, cx = (x0 + x1) / 2, cs = (s0 + s1) / 2;
    add({ t: 'platform', p: pt(cs, top - thick / 2, cx), s: [r4(w), thick, r4(d)], tex: 'jungle', color: STONE, artProxy: true, grp: G.masonry, nm });
    add({ t: 'decor', dkind: 'templeplatform', p: pt(cs, top - thick - .025, cx), s: [r4(w), thick, r4(d)], seed: Math.round(s0 * 7 + x0 * 3) & 0xffff, nm: `${nm} · bonded masonry`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false });
    if (opts.lip !== false) { const n = Math.max(1, Math.ceil(w / 3)), span = w / n; for (let i = 0; i < n; i++) add({ t: 'decor', dkind: 'stonecornice', p: pt(s1 - .55, top - .38, x0 + (i + .5) * span), s: [r4(span + .015), .35, 1.05], nm: `${nm} · carved lip`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false, color: '#e7e2ca' }); }
    floors.push({ a: s0, b: s1, ya: top, yb: top, x0, x1, kind: opts.kind ?? 'main', nm });
  };
  /** A monumental flight: a rideable bank with real stair treads sunk to its surface. */
  const flight = (s0: number, s1: number, y0: number, y1: number, x0: number, x1: number, nm: string, treads = true) => {
    const w = x1 - x0, len = s1 - s0, rise = y1 - y0;
    add({ t: 'ramp', p: pt((s0 + s1) / 2, y0, (x0 + x1) / 2), len: r4(len), rise: r4(rise), w: r4(w), tex: 'jungle', color: STONE, grp: G.ground, nm });
    floors.push({ a: s0, b: s1, ya: y0, yb: y1, x0, x1, kind: 'main', nm });
    if (!treads) return;
    const pitch = 1.05, slope = rise / len, pieces = Math.max(1, Math.round(w / 3)), span = w / pieces;
    for (let s = s0 + pitch / 2; s < s1 - .3; s += pitch) {
      const surface = y0 + slope * (s + pitch / 2 - s0);
      for (let i = 0; i < pieces; i++) add({ t: 'decor', dkind: 'stonestep', p: pt(s, surface - .45, x0 + (i + .5) * span), s: [r4(span + .01), .45, pitch], nm: `${nm} · stair tread`, grp: G.masonry, solid: false, scenerySolid: false, castShadow: false, color: i % 2 ? '#d8d0b4' : '#cfc7aa' });
    }
  };
  const pit = (s0: number, s1: number, x0: number, x1: number, y: number, nm: string) => {
    add({ t: 'pit', p: pt((s0 + s1) / 2, y - 9, (x0 + x1) / 2), s: [r4(x1 - x0), 8, r4(s1 - s0)], invisible: true, grp: G.ground, nm });
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
  const fruit = (s: number, x: number, y: number, nm = 'Fruit line') => add({ t: 'wumpa', p: pt(s, y + 1, x), grp: G.lines, nm });
  const arc = (s0: number, s1: number, x: number, y: number, rise = 1.6, nm = 'Fruit arc over the gap') => { for (let n = 0; n < 5; n++) add({ t: 'wumpa', p: pt(s0 + (s1 - s0) * n / 4, y + 1 + Math.sin(n / 4 * Math.PI) * rise, x), grp: G.lines, nm }); };
  const rail = (s0: number, s1: number, x: number, y0: number, y1: number, nm: string, coping = false) => {
    add({ t: 'rail', p: pt(s0, y0, x), pts: [[0, 0], [0, r4(z(s1) - z(s0)), 0, r4(y1 - y0)]], color: GOLD, coping, grp: G.lines, nm });
    setPieces.rails.push({ a: s0, b: s1, x, ya: y0, yb: y1, name: nm });
  };
  const torch = (s: number, x: number, y: number, nm: string, rise = 1.7, w = 1) => { add({ t: 'torch', p: pt(s, y, x), rise, w, grp: G.lamps, nm }); scenery.push({ s, x, y, radius: .4, nm }); };
  /** Gold coping rails along both lips of a banked channel: the grind line of the flats and descents. */
  const copingRails = (nodes: { s: number; x: number; y: number; r?: number }[], flatHalf: number, rise: number, arc: number, deck: number, nm: string) => {
    const off = flatHalf + rise * Math.sin(arc * Math.PI / 180) + deck - .25, lift = rise * (1 - Math.cos(arc * Math.PI / 180)) + .05, [a] = nodes;
    for (const side of [-1, 1]) {
      add({ t: 'rail', p: pt(a.s, a.y + lift, a.x + side * off), pts: nodes.map(q => [r4(q.x - a.x), r4(z(q.s) - z(a.s)), q.r ?? 0, r4(q.y - a.y)]), color: GOLD, coping: true, grp: G.lines, nm: `${nm} · ${side < 0 ? 'left' : 'right'} coping` });
      setPieces.rails.push({ a: a.s, b: nodes[nodes.length - 1].s, x: a.x + side * off, ya: a.y + lift, yb: nodes[nodes.length - 1].y + lift, name: nm });
    }
  };
  void rail;
  const checkpoint = (s: number, x: number, y: number, nm: string) => {
    add({ t: 'checkpoint', p: pt(s, y, x), grp: G.course, nm }); checkpoints.push({ s, x, nm });
    for (const side of [-1, 1]) { const px = x + side * 3.2; add({ t: 'decor', dkind: 'stonebase', p: pt(s - .8, y + .02, px), s: [1.1, .5, 1.1], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Checkpoint lamp pedestal' }); torch(s - .8, px, y + .5, 'Paired checkpoint lamps', 1.45, .85); }
  };

  // ---- hazards and foes ---------------------------------------------------
  /** A sentinel on its own carved pedestal with a clear apron; it faces across the room. */
  /** The breath leaves a full-size head 0.85–1.25 m above its base, over a rider's 0.92 m body. The heads stand on a
   * paving slab at floor level and are scaled to 0.8, which brings the breath to chest height; the range is widened by
   * the same factor so each head still reaches 7.1 m. */
  const TIKI_W = .8, TIKI_REACH = 7.1, SLAB = .06;
  const sentinel = (s: number, x: number, y: number, facing: number, cycle: number, amp: number, phase: number, nm: string) => {
    const top = y + SLAB;
    add({ t: 'decor', dkind: 'templeplatform', p: pt(s, y - .3 + SLAB, x), s: [3, .3, 3], seed: Math.round(s) & 0xffff, solid: false, scenerySolid: false, castShadow: false, grp: G.hazards, nm: `${nm} · carved slab` });
    add({ t: 'wall', p: pt(s, top, x), s: [2.2, 2.3, 2.2], invisible: true, edgeGrinding: false, grp: G.hazards, nm: `${nm} · head core` });
    add({ t: 'firetiki', p: pt(s, top, x), yaw: facing > 0 ? 90 : -90, range: r4(TIKI_REACH / TIKI_W), cycle, phase, amp, w: TIKI_W, grp: G.hazards, nm });
    setPieces.sentinels.push({ s, x, y: top, facing, cycle, amp, name: nm });
    floors.push({ a: s - 1.1, b: s + 1.1, ya: top, yb: top, x0: x - 1.1, x1: x + 1.1, kind: 'side', nm: `${nm} pedestal` });
  };
  const censer = (s: number, x: number, pivotY: number, len: number, amp: number, speed: number, phase: number, nm: string) => {
    add({ t: 'pendulum', p: pt(s, pivotY, x), len, amp, speed, phase, yaw: 0, grp: G.hazards, nm }); // yaw 0 swings across the course (along x)
    setPieces.censers.push({ s, x, pivotY, len, amp, speed, phase });
  };
  const patrol = (s: number, x: number, y: number, foe: Foe, range: number, speed: number, nm: string, along = false) => {
    add({ t: 'enemy', foe, p: pt(s, y, x), yaw: along ? 90 : 0, range, speed, terrainSupports: true, grp: G.patrols, nm: `Temple ${foe}: ${nm}` });
    patrols.push({ s, x, y, along, range, foe, nm });
  };

  // ---- landscape ----------------------------------------------------------
  const ratios: Record<string, [number, number]> = { trialsv2treea: [17.766 / 26, 25.911 / 26], trialsv2treeb: [16.741 / 26, 17.709 / 26], trialsv2crowna: [11.292 / 26, 23.015 / 26], trialsv2crownb: [9.405 / 26, 1],
    trialsv2groundcovera: [1.043 / 5, 2.581 / 5], trialsv2groundcoverb: [1.826 / 5, 4.516 / 5], trialsv2ferna: [1.601 / 3, 2.798 / 3], trialsv2fernb: [1.838 / 3, 2.957 / 3],
    trialsv2earthbanka: [1.316 / 8, 3.996 / 8], trialsv2earthbankb: [1.628 / 8, 3.149 / 8], trialsv2cavewalla: [7.468 / 12, 6.705 / 12], trialsv2cavewallb: [11.708 / 12, 7.415 / 12],
    trialsv2caveroofa: [8.348 / 18, 13.766 / 18], trialsv2caveroofb: [6.26 / 18, 9.006 / 18], trialsv2riverstonea: [.6, .9], trialsv2riverstoneb: [.55, .85], trialsv2riverstonec: [.5, .8] };
  const plant = (kind: Decor, s: number, x: number, y: number, width: number, nm: string, yaw = 0, grp = G.planting) => {
    const ratio = ratios[kind] ?? [1, 1], size: P = [r4(width), r4(width * ratio[0]), r4(width * ratio[1])];
    add({ t: 'decor', dkind: kind, p: pt(s, y, x), s: size, yaw, solid: false, scenerySolid: false, cameraCutaway: true, color: '#ffffff', grp, nm });
    scenery.push({ s, x, y, radius: Math.min(size[0], size[2]) * .35, nm });
  };
  const rnd = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  /** Ravine walls: stacked Treehouse cave walls along both sides, earth banks at their feet, trees on the rim. */
  const ravine = (s0: number, s1: number, halfAt: (s: number) => number, floorY: (s: number) => number, rimHeight = 16) => {
    for (let s = s0 + 5, i = 0; s < s1; s += 11, i++) for (const side of [-1, 1]) {
      const half = halfAt(s), y = floorY(s);
      plant(i % 2 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', s, side * (half + 5.5), y - .6, 12.5, 'Ravine wall', side > 0 ? 180 : 0, G.landscape);
      plant(i % 2 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', s + 4, side * (half + 7.5), y + 6.2, 12.5, 'Ravine wall, upper course', side > 0 ? 180 : 0, G.landscape);
      if (i % 2 === 0) plant(i % 4 ? 'trialsv2earthbanka' : 'trialsv2earthbankb', s + 2, side * (half + 1.6), y - .15, 8, 'Earth bank at the wall foot', rnd(s + side) * 30 - 15 + (side > 0 ? 180 : 0), G.landscape);
      plant(i % 2 ? 'trialsv2ferna' : 'trialsv2fernb', s + 7, side * (half + 1.3), y + .1, 3.2, 'Fern at the wall foot', rnd(s * 3 + side) * 360);
      plant(i % 2 ? 'trialsv2groundcovera' : 'trialsv2groundcoverb', s - 3, side * (half + 1.6), y + .05, 4.5, 'Groundcover at the wall foot', rnd(s * 5 + side) * 360);
      plant(i % 2 ? 'trialsv2treea' : 'trialsv2treeb', s + 3, side * (half + 10 + rnd(s + side * 7) * 4), y + rimHeight - 1, 22 + rnd(s) * 4, 'Rim tree', rnd(s * 11 + side) * 360);
      if (i % 2 === 0) plant(i % 4 ? 'trialsv2crowna' : 'trialsv2crownb', s + 8, side * (half + 15), y + rimHeight + 9, 24, 'Rim canopy', rnd(s * 13) * 360);
    }
    // Containment keeps a slipping rider on the floor where the wall foot has no pit.
    for (const side of [-1, 1]) {
      const pts: NonNullable<CustomComponent['pts']>[number][] = [], origin = pt(s0, floorY(s0) - .2, side * (halfAt(s0) + .3));
      for (let s = s0; s <= s1 + .01; s += (s1 - s0) / Math.max(2, Math.ceil((s1 - s0) / 6))) { const p = pt(s, floorY(s) - .2, side * (halfAt(s) + .3)); pts.push([r4(p[0] - origin[0]), r4(p[2] - origin[2]), 0, r4(p[1] - origin[1])]); }
      add({ t: 'wallpath', p: origin, pts, w: .5, rise: 6, collisionHeight: 6, containment: true, invisible: true, grp: G.bounds, nm: 'Ravine wall containment' });
    }
  };
  const riverStones = (s0: number, s1: number, halfAt: (s: number) => number, floorY: (s: number) => number) => {
    for (let s = s0 + 3, i = 0; s < s1; s += 7.5, i++) {
      const side = i % 2 ? -1 : 1, x = side * (halfAt(s) - 1.6 - rnd(s) * 1.4), kinds: Decor[] = ['trialsv2riverstonea', 'trialsv2riverstoneb', 'trialsv2riverstonec'];
      if (side > 0 && s > 54 && s < 136) continue; // the gutter and its grind line own the right side here
      plant(kinds[i % 3], s, x, floorY(s) - .1, 1.6 + rnd(s * 2) * 1.2, 'River stone', rnd(s * 3) * 360, G.landscape);
      if (i % 3 === 0) add({ t: 'rock', p: pt(s + 2.5, floorY(s) - .4, x * .75), s: [2.4, 1.3, 2.1], seed: Math.round(s), color: '#8e9a7c', grp: G.landscape, nm: 'Mossy boulder' });
      if (i % 3 === 0) scenery.push({ s: s + 2.5, x: x * .75, y: floorY(s), radius: 1.3, nm: 'Mossy boulder' });
    }
  };
  const gateway = (s: number, x: number, y: number, width: number, nm: string) => {
    add({ t: 'decor', dkind: 'hangingarch', p: pt(s, y - .18, x), s: [width, 12.5, 2.8], seed: Math.round(s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm });
    for (const side of [-1, 1]) { add({ t: 'wall', p: pt(s, y, x + side * (width / 2 - 1.6)), s: [2.1, 7.8, 2.1], invisible: true, grp: G.masonry, nm: `${nm} · solid pier` }); scenery.push({ s, x: x + side * (width / 2 - 1.6), y, radius: 1.2, nm }); }
  };
  const shrine = (s: number, x: number, y: number, facing: number, nm: string) => {
    // Three temple walls make a niche open toward the room; a lintel carries a brazier.
    add({ t: 'decor', dkind: 'templewall', p: pt(s, y, x - facing * 2.4), s: [5.2, 4.6, 1.2], yaw: 90, seed: Math.round(s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · back wall` });
    for (const side of [-1, 1]) add({ t: 'decor', dkind: 'templewall', p: pt(s + side * 2.4, y, x), s: [4.4, 4.6, 1.2], seed: Math.round(s) + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · side wall` });
    add({ t: 'decor', dkind: 'stonelintel', p: pt(s, y + 4.3, x), s: [5.6, 1, 1.1], yaw: 90, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · lintel` });
    for (const side of [-1, 1]) add({ t: 'wall', p: pt(s + side * 2.4, y, x), s: [.6, 4.6, 4.4], invisible: true, grp: G.masonry, nm: `${nm} · solid side` });
    add({ t: 'wall', p: pt(s, y, x - facing * 2.4), s: [4.8, 4.6, .6], invisible: true, grp: G.masonry, nm: `${nm} · solid back` });
    torch(s, x, y + 5.3, `${nm} · brazier`, .6, 1.1);
    scenery.push({ s, x, y, radius: 2.8, nm });
  };

  // =========================================================================
  // ROOM 1 · THE RAVINE FLOOR (−16 → 180, floor at 0). Open sky, 28 m wide
  // narrowing to 16 m at the stair foot. Learn the spin on a carving line among
  // river stones, take the mask from the shrine, read the sleeping sentinel,
  // meet two crabs in the open. The stair and its lit landings are visible ahead.
  // =========================================================================
  rooms.push({ name: 'Ravine floor', a: -16, b: 180, mode: 'board', lesson: 'carve the crate line, take the mask, read the sleeping flame, meet the crabs in the open' });
  masonry(-18, 0, -7, 7, 4, 'Ravine lip: the arrival ledge');
  flight(0, 30, 4, 0, -7, 7, 'Arrival bank down to the ravine floor', false);
  const r1half = (s: number) => s < 120 ? 14 : 14 - 6 * (Math.min(180, s) - 120) / 60, r1y = () => 0;
  ground([{ s: 28, y: 0, half: 10 }, { s: 40, y: 0, half: 14 }, { s: 120, y: 0, half: 14 }, { s: 180, y: 0, half: 8.4 }], 'Ravine floor');
  for (const [s, x] of [[36, -2.5], [42, 2.5], [48, -2.5], [54, 2.5], [60, -2.5]] as const) crate(s, x, 0, 'wood', 'Carving line among the river stones');
  shrine(40, -11.4, 0, 1, 'Mask shrine');
  crate(40, -10.2, 0, 'mask', 'The shrine mask: protection before the first flame');
  checkpoint(50, 0, 0, 'Ravine floor checkpoint');
  // The dry channel's lowest stretch: a shallow stone gutter along the right side whose coping is the first grind.
  // A raised jade channel on the floor: its bed is at grade and its copings stand 0.67 m up, an ollie onto the grind.
  const gutterBed = 0;
  add({ t: 'vertramp', p: pt(90, gutterBed, 9.5), len: 60, yaw: 0, w: 1.1, rise: .9, arc: 72, deck: .5, arcSteps: 10, vkind: 'half', vert: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'Dry overflow gutter: the first coping grind' });
  floors.push({ a: 60, b: 120, ya: gutterBed, yb: gutterBed, x0: 8.4, x1: 10.6, kind: 'side', nm: 'gutter floor' });
  copingRails([{ s: 60, x: 9.5, y: gutterBed }, { s: 120, x: 9.5, y: gutterBed }], 1.1, .9, 72, .5, 'Gutter coping');
  for (let s = 66; s <= 114; s += 6) fruit(s, 11.7, .3, 'Gutter coping fruit');
  sentinel(70, -9.5, 0, 1, 14, 12, 0, 'Sleeping sentinel of the ravine: a slow, narrow sigh');
  stack(70, -5, 0, 'wood', 'mystery', 'Offering inside the sleeping sentinel\'s sigh', 'sweep');
  patrol(95, 0, 0, 'grunt', 2.5, 1.35, 'first crab crossing the open floor: spin or stomp, escape either side');
  patrol(120, 3, 0, 'grunt', 2, 1.5, 'second crab, nearer the gutter');
  stack(104, -4, 0, 'wood', 'wood', 'Offering between the crabs');
  for (let s = 128; s <= 152; s += 8) fruit(s, (s / 8) % 2 ? -1.5 : 1.5, 0);
  crate(140, 0, 0, 'wood', 'Last offering before the stair');
  checkpoint(165, 0, 0, 'Stair foot checkpoint');
  gateway(176, 0, 0, 18, 'Gateway of the Great Stair');
  riverStones(34, 160, r1half, r1y);
  ravine(28, 180, r1half, r1y, 16);
  for (const s of [84, 112, 150]) torch(s, 12.2, 0, 'Ravine brazier', 1.9, 1.1);
  for (const s of [92, 132]) torch(s, -12.2, 0, 'Ravine brazier', 1.9, 1.1);

  // =========================================================================
  // ROOM 2 · THE GREAT STAIR (180 → 420, 0 → 24, on foot). Three flights of
  // 8 m with landings at 8 and 16. Flight one has collapsed in the middle: a
  // death pit with two plinths. Flight two has fallen into eight ledges that
  // zigzag up over the ravine. Flight three is narrow with pits on both sides
  // and a censer swinging over its top steps.
  // =========================================================================
  rooms.push({ name: 'The Great Stair', a: 180, b: 420, mode: 'foot', lesson: 'hop the collapse, climb the fallen ledges, time the censer; crates on every landing' });
  const stairHalf = 10;
  flight(180, 200, 0, 2.667, -stairHalf, stairHalf, 'First flight, lower run');
  pit(200, 212, -stairHalf - 2, stairHalf + 2, 2.7, 'The collapse: first flight has fallen into the ravine');
  ledge(203.5, -1.5, 3.1, 2.5, 2.5, 'Collapse plinth one', true); ledge(208, 1.5, 3.6, 2.5, 2.5, 'Collapse plinth two', true);
  crate(203.5, -1.5, 3.1, 'wood', 'Offering on the first plinth'); crate(208, 1.5, 3.6, 'wood', 'Offering on the second plinth');
  arc(200, 212, 0, 3.2, 1.2, 'Fruit over the collapse');
  // Debris of the collapse: fractured blocks and fallen treads at the pit edges and on the flights' margins.
  for (const [q, x, y, yaw] of [[199, -7.5, 2.6, 20], [199.4, 6.8, 2.75, -35], [213, -8, 4.5, 60], [212.6, 7.2, 4.3, 10], [238, -8.5, 7.9, 40], [226, 8.6, 6.1, 75]] as const) add({ t: 'decor', dkind: 'fracturedstoneblock', p: pt(q, y, x), s: [2.2, 1.1, 1.1], yaw, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Fallen block of the collapse' });
  flight(212, 240, 4.267, 8, -stairHalf, stairHalf, 'First flight, upper run');
  patrol(190, 0, 1.333, 'grunt', 3, 1.4, 'crab on the lower run of the first flight');
  // Landing one.
  masonry(240, 256, -stairHalf, stairHalf, 8, 'First landing');
  checkpoint(243, -2, 8, 'First landing checkpoint');
  for (const [s, x] of [[244, -6], [248, -4], [252, -3]] as const) crate(s, x, 8, 'wood', 'First landing offerings on the safe left half');
  patrol(254, 4, 8, 'turtle', 1.5, 1.3, 'mossback crossing the right half of the first landing: stomp it');
  // The sentinel owns the landing's right half for seven metres; the left half is the safe lane.
  sentinel(249, 9, 8, -1, 10, 20, 1.3, 'Waking sentinel of the first landing');
  stack(250, 5, 8, 'wood', 'wood', 'Offering inside the first landing sentinel\'s sweep', 'sweep');
  gateway(256.5, 0, 8, 22, 'First landing arch');
  // Flight two: eight fallen ledges rising a metre each with four-metre gaps, zigzagging over the ravine.
  pit(256, 322, -stairHalf - 2, stairHalf + 2, 8, 'The ravine under the fallen second flight');
  // Corner to corner each hop is about six metres with a one-metre rise: a double jump with room to spare.
  const ledgeX = [-3, 2, -2, 3, -1, 2, -3, 0], ledgeS = [260, 268, 276, 284, 292, 300, 308, 316];
  // Ledge three is a bigger fallen block, six metres deep, so the frog at its far end never shares the landing.
  for (let i = 0; i < 8; i++) { const s = ledgeS[i], y = 9 + i; ledge(s, ledgeX[i], y, i === 2 ? 5 : 4, i === 2 ? 6 : 4, `Fallen ledge ${i + 1}`); if (i % 2 === 1) crate(s, ledgeX[i], y, i === 7 ? 'mystery' : 'wood', `Offering on fallen ledge ${i + 1}`); }
  ledge(292, -9.5, 13, 3.5, 3.5, 'Side ledge over the ravine: a double jump out and back'); crate(292, -9.5, 13, 'life', 'Life on the side ledge');
  patrol(277.6, -3.4, 11, 'hopper', 1, 1.1, 'spring frog on the big block\'s left: pass it on the right, spin only while it is grounded');
  for (let i = 0; i < 7; i++) arc(ledgeS[i] + 2, ledgeS[i + 1] - 2, (ledgeX[i] + ledgeX[i + 1]) / 2, 9.5 + i, 1.1, 'Fruit between the fallen ledges');
  arc(318, 322, 0, 16, 1, 'Fruit onto the second landing');
  // Landing two: the fuse court.
  masonry(322, 346, -stairHalf, stairHalf, 16, 'Second landing: the fuse court');
  checkpoint(332, 4, 16, 'Second landing checkpoint');
  sentinel(340, -9, 16, 1, 9, 24, 2.6, 'Waking sentinel of the fuse court');
  stack(339, -5, 16, 'wood', 'wood', 'Offering inside the fuse court sentinel\'s sweep', 'sweep');
  stack(343, 3, 16, 'tnt', 'wood', 'Fuse court: take the cap, prime the fuse, retreat', 'fuse');
  crate(344.5, 8.2, 16, 'mystery', 'Refuge reward beyond the blast');
  gateway(346.5, 0, 16, 22, 'Second landing arch');
  // Flight three: narrow, pits both sides, a censer over the top steps.
  flight(346, 400, 16, 24, -3, 3, 'Third flight: the narrow stair');
  pit(346, 400, -stairHalf - 2, -3.2, 16, 'Drop beside the narrow stair, left'); pit(346, 400, 3.2, stairHalf + 2, 16, 'Drop beside the narrow stair, right');
  patrol(350, 0, 16 + 8 * 4 / 54, 'turtle', 1.2, 1.2, 'mossback on the first steps of the narrow stair: stomp it or wait for its turn');
  crate(360, -1.4, 16 + 8 * 14 / 54, 'wood', 'Narrow stair offering'); crate(372, 1.4, 16 + 8 * 26 / 54, 'wood', 'Narrow stair offering pair');
  censer(386, 0, 24 + 6.6, 8, .9, 1.35, 0, 'Censer swinging over the top steps: it clears the treads only at the ends of its swing');
  for (let s = 350; s <= 396; s += 6) fruit(s, 0, mainFloorAt(s));
  // Stair top: the sluice head.
  masonry(400, 424, -8, 8, 24, 'Stair top: the sluice head terrace');
  checkpoint(410, 0, 24, 'Stair top checkpoint');
  crate(405, -3.5, 24, 'wood', 'Sluice head offering'); crate(405, 3.5, 24, 'wood', 'Sluice head offering pair');
  ravine(180, 424, () => stairHalf + 3, s => Math.min(24, mainFloorAt(Math.min(424, Math.max(180, s)))), 14);
  for (const s of [222, 300, 376]) for (const side of [-1, 1]) torch(s, side * (stairHalf + 1.2), mainFloorAt(s) + .3, 'Stair brazier', 1.8, 1.05);

  // =========================================================================
  // THE SLUICE (424 → 476, 24 → 16, board). The one descent: a banked stone
  // channel with two gentle bends that drops eight metres off the stair top
  // and gives the crossing its speed. Coping rails on both lips are the line.
  // =========================================================================
  rooms.push({ name: 'The sluice', a: 424, b: 476, mode: 'board', lesson: 'drop in, pump the bends, carry speed into the crossing' });
  const SL = { w: 1.7, rise: 1.3, arc: 64, deck: .6 }; // flat half-width, bank radius, bank arc, lip deck
  const channelHalf = SL.w + SL.rise * Math.sin(SL.arc * Math.PI / 180) + SL.deck;
  const channel = (nodes: { s: number; x: number; y: number; r?: number }[], nm: string) => {
    const [a] = nodes;
    add({ t: 'vertramp', p: pt(a.s, a.y, a.x), pts: nodes.map(q => [r4(q.x - a.x), r4(z(q.s) - z(a.s)), q.r ?? 0, r4(q.y - a.y)]), w: SL.w, rise: SL.rise, arc: SL.arc, deck: SL.deck, arcSteps: 8, vkind: 'half', vert: false, tex: 'jungle', color: JADE, grp: G.lines, nm });
    // Only the flat bed is a standing floor; the banks are ridden, not walked.
    for (let i = 1; i < nodes.length; i++) { const q0 = nodes[i - 1], q1 = nodes[i]; floors.push({ a: q0.s, b: q1.s, ya: q0.y, yb: q1.y, x0: -(SL.w - .2), x1: SL.w - .2, xa: q0.x, xb: q1.x, kind: 'main', nm }); }
    copingRails(nodes, SL.w, SL.rise, SL.arc, SL.deck, nm);
    // Carved masonry carries the channel: a skirt of bonded stone under its full run.
    for (let i = 1; i < nodes.length; i++) { const q0 = nodes[i - 1], q1 = nodes[i]; add({ t: 'decor', dkind: 'templeplatform', p: pt((q0.s + q1.s) / 2, Math.min(q0.y, q1.y) - SL.rise - 1.4, (q0.x + q1.x) / 2), s: [r4(channelHalf * 2 + .8), 1.4, r4(q1.s - q0.s)], seed: Math.round(q0.s), solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: `${nm} · masonry bed` }); }
  };
  channel([{ s: 424, x: 0, y: 24 }, { s: 440, x: 2.4, y: 21.6, r: 9 }, { s: 458, x: -2.4, y: 18.6, r: 9 }, { s: 476, x: 0, y: 16 }], 'The sluice: a banked stone channel down to the aqueduct');
  for (let q = 428; q <= 472; q += 6) fruit(q, 0, mainFloorAt(q) - .2, 'Sluice fruit line');
  crate(448, 0, mainFloorAt(448), 'wood', 'Sluice offering at speed'); crate(466, 0, mainFloorAt(466), 'wood', 'Second sluice offering');
  // The stair top terrace and the sluice head sit in the same ravine; walls continue.

  // =========================================================================
  // THE BROKEN AQUEDUCT (476 → 656, level at 16, board). The channel crosses a
  // chasm on arches with two breaks, each announced by a six-metre lip. A
  // covered colonnade along the right wall carries walkers across with three
  // fallen-floor gaps. Both routes meet on the abutment between a sentinel pair.
  // =========================================================================
  rooms.push({ name: 'Broken aqueduct', a: 476, b: 656, mode: 'board', lesson: 'Ravine Break and Far Break at speed; the colonnade on foot; cross the abutment as both sentinels exhale' });
  channel([{ s: 476, x: 0, y: 16 }, { s: 514, x: 0, y: 16 }, { s: 520, x: 0, y: 16.9 }], 'Aqueduct channel, first span');
  gaps.push({ a: 520, b: 527, y: 16 });
  channel([{ s: 527, x: 0, y: 16 }, { s: 584, x: 0, y: 16 }, { s: 590, x: 0, y: 16.9 }], 'Aqueduct channel, second span');
  gaps.push({ a: 590, b: 599, y: 16 });
  channel([{ s: 599, x: 0, y: 16 }, { s: 640, x: 0, y: 16 }], 'Aqueduct channel, third span');
  pit(474, 642, -40, 40, 16, 'The chasm beneath the aqueduct');
  arc(520, 527, 0, 16.9, 1.8, 'Ravine Break'); arc(590, 599, 0, 16.9, 2.2, 'Far Break');
  for (let q = 482; q <= 636; q += 7) if (!(q > 514 && q < 530) && !(q > 584 && q < 602)) fruit(q, 0, 16 - .2, 'Aqueduct fruit line');
  // Arches: column pairs every twelve metres from the ravine floor to the channel bed, lintels between them.
  for (let q = 480; q <= 636; q += 12) for (const side of [-1, 1]) {
    const x = side * 2.6;
    add({ t: 'decor', dkind: 'stonebase', p: pt(q, -4, x), s: [2.6, .85, 2.6], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier base' });
    for (let y = -3.15; y < 12.4; y += 1.8) add({ t: 'decor', dkind: 'stoneshaft', p: pt(q, y, x), s: [1.65, 1.8, 1.65], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier' });
    add({ t: 'decor', dkind: 'stonecapital', p: pt(q, 12.45, x), s: [2.8, 1.15, 2.8], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct pier capital' });
  }
  for (let q = 486; q <= 636; q += 12) add({ t: 'decor', dkind: 'stonearch', p: pt(q, 13.3, 0), s: [6.2, 1.2, 1.2], yaw: 90, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Aqueduct arch' });
  // The colonnade: a six-metre walkway on the right with columns and lintels, three fallen floors.
  const colX = 12, colHalf = 3;
  for (const [a, b] of [[474, 500], [502.8, 540], [543, 580], [582.6, 642]] as const) masonry(a, b, colX - colHalf, colX + colHalf, 16, 'Colonnade walkway', { lip: false });
  for (const [a, b] of [[500, 502.8], [540, 543], [580, 582.6]] as const) arc(a, b, colX, 16, .9, 'Fruit over the fallen floor');
  for (let q = 478; q <= 640; q += 6) {
    add({ t: 'decor', dkind: 'stonebase', p: pt(q, 16, colX + colHalf + .9), s: [2.2, .8, 2.2], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade column base' });
    for (let y = 16.8; y < 21.5; y += 1.8) add({ t: 'decor', dkind: 'stoneshaft', p: pt(q, y, colX + colHalf + .9), s: [1.5, 1.8, 1.5], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade column' });
    add({ t: 'decor', dkind: 'stonecapital', p: pt(q, 22.2, colX + colHalf + .9), s: [2.4, 1.1, 2.4], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade capital' });
    add({ t: 'wall', p: pt(q, 16, colX + colHalf + .9), s: [1.6, 6.2, 1.6], invisible: true, grp: G.masonry, nm: 'Colonnade column core' });
    scenery.push({ s: q, x: colX + colHalf + .9, y: 16, radius: 1, nm: 'Colonnade column' });
  }
  for (let q = 481; q <= 640; q += 6) { add({ t: 'decor', dkind: 'stonelintel', p: pt(q, 23.3, colX + colHalf + .9), s: [6.3, 1, 1.1], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade lintel' }); add({ t: 'decor', dkind: 'stoneroof', p: pt(q, 24.3, colX + 1.2), s: [6.3, 1.1, 6], solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade roof' }); }
  add({ t: 'decor', dkind: 'templewall', p: pt(558, 16, colX - colHalf - .7), s: [60, 1.1, 1.2], yaw: 90, seed: 558, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Colonnade parapet toward the channel' });
  // The aqueduct head joins the channel bank to the colonnade, so a walker coming down the sluice bed can step over the lip and onto the walkway.
  masonry(474, 486, 3.4, colX - colHalf, 16, 'Aqueduct head: the walkers\' way onto the colonnade', { lip: false });
  checkpoint(480, 7.5, 16, 'Aqueduct head checkpoint');
  for (const q of [496, 520, 566, 598]) crate(q, colX, 16, 'wood', 'Colonnade offering');
  patrol(560, colX, 16, 'hopper', 1.2, 1.1, 'spring frog on the colonnade: spin only while it is grounded');
  // The abutment court: channel and colonnade meet between two sentinels breathing in step.
  masonry(640, 658, -8, 8, 16, 'Abutment court');
  masonry(640, 658, 8, colX + colHalf, 16, 'Abutment court, colonnade side', { lip: false });
  checkpoint(642, 0, 16, 'Abutment court checkpoint: where both ways meet');
  // Seven point four metres from the centre, the two breaths meet in the middle: there is no safe lane, only the cool phase.
  sentinel(649, -7.4, 16, 1, 8, 24, 0, 'Abutment sentinel, left'); sentinel(649, 7.4, 16, -1, 8, 24, 0, 'Abutment sentinel, right');
  crate(654, -3, 16, 'wood', 'Abutment offering beyond the sweep'); crate(654, 3, 16, 'wood', 'Abutment offering pair');
  gateway(657, 0, 16, 20, 'Cistern gateway');
  // Ravine for the crossing: walls far out on both sides, the arches standing in the open.
  ravine(424, 474, () => 11, q => mainFloorAt(q), 14);
  ravine(474, 642, () => 30, () => -4, 24);
  for (let q = 478; q < 642; q += 11) for (const side of [-1, 1]) { plant(q % 22 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', q + 6, side * 36.5, 12.6, 14, 'Ravine cliff, third course', side > 0 ? 180 : 0, G.landscape); plant(q % 22 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', q + 2, side * 34, 4.8, 13, 'Ravine cliff, second course', side > 0 ? 180 : 0, G.landscape); }
  for (const q of [490, 540, 600]) for (const side of [-1, 1]) torch(q, side * 33, -4 + 22, 'Ravine rim brazier', 1.9, 1.1);

  // =========================================================================
  // THE CISTERN (656 → 740, 16 → 21). A cave hall under a dome, dark but for
  // braziers. The reservoir bowl fills the floor between a left cornice ledge
  // that climbs in broken steps and a right floor where the ember sentry
  // stands. A sentinel in a niche sweeps the exit lip; the quarter pipe at the
  // far wall is the fast way up to the gallery. The bonus door is in a side chapel.
  // =========================================================================
  rooms.push({ name: 'The Cistern', a: 656, b: 740, mode: 'foot', lesson: 'drop in and pump, or climb the broken cornice over the drain; time the exit under the niche sentinel' });
  masonry(658, 672, -8, 8, 16, 'Cistern entry passage'); checkpoint(664, 0, 16, 'Cistern entry checkpoint');
  // The reservoir is a banked basin, not a vert pipe: a vert wall zeroes forward speed at its lip and a deck reads as a
  // coping to crest, so the rider would be thrown upward at the drop-in and stalled at the exit. A 45-degree bank drops
  // the rider in cleanly and throws a fast crossing forward out of the far side toward the launch bank.
  // A short flat rim on the basin keeps the side floors' vertical faces behind the lip: a rider cresting the exit bank
  // would otherwise clip the floor's face and wreck.
  const hallA = 672, hallB = 721.6, bowlC = 695, bowlR = 7, bowlArc = 45, bowlW = 6, bowlDeck = .6;
  const bowlHalf = bowlW + bowlR * Math.sin(bowlArc * Math.PI / 180) + bowlDeck, bowlBase = 16 - bowlR * (1 - Math.cos(bowlArc * Math.PI / 180));
  // yaw 90 lays the trough across the course: the rider drops in over the entry lip and climbs out over the exit lip.
  add({ t: 'vertramp', p: pt(bowlC, bowlBase, 0), len: 24, w: bowlW, rise: bowlR, arc: bowlArc, deck: bowlDeck, arcSteps: 24, vkind: 'half', yaw: 90, vert: false, rails: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'The jade reservoir' });
  // The trough's open ends are closed by bonded stone below the side floors, so a sideways drift meets a wall, not the void.
  for (const side of [-1, 1]) { add({ t: 'decor', dkind: 'templeplatform', p: pt(bowlC, bowlBase - 1.5, side * 12.7), s: [1.4, 17.5 - bowlBase, r4(bowlHalf * 2 + .4)], seed: 695 + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Reservoir end wall' }); add({ t: 'wall', p: pt(bowlC, bowlBase - 1.5, side * 12.7), s: [1.4, 17.5 - bowlBase, r4(bowlHalf * 2 + .4)], invisible: true, grp: G.masonry, nm: 'Reservoir end wall core' }); }
  pipes.push({ name: 'The jade reservoir', a: bowlC - bowlHalf, b: bowlC + bowlHalf, lipY: 16, radius: bowlR, arc: bowlArc, baseY: bowlBase });
  floors.push({ a: bowlC - bowlHalf, b: bowlC + bowlHalf, ya: 16, yb: 16, x0: -12, x1: 12, kind: 'main', nm: 'reservoir lips' });
  masonry(hallA, bowlC - bowlHalf, -12, 12, 16, 'Cistern floor before the bowl', { lip: false });
  masonry(bowlC + bowlHalf, hallB, -12, 12, 16, 'Cistern floor beyond the bowl', { lip: false });
  masonry(hallA, hallB, 12, 20, 16, 'Cistern right floor', { lip: false });
  masonry(hallA, 690, -20, -12, 16, 'Cistern left cornice', { lip: false });
  // Caps where the air arrives: above the entry lip and above the exit lip.
  crate(bowlC - bowlHalf + 1.2, 0, 18.6, 'wood', 'Cap above the entry lip: pop off the lip before the drop', 'suspended');
  crate(711, -2.5, 18, 'life', 'Life on the exit arc: a fast crossing flies out of the bowl; veer left at the top', 'suspended');
  for (const q of [bowlC - 4, bowlC, bowlC + 4]) fruit(q, 0, q === bowlC ? bowlBase : bowlBase + 1.2, 'Reservoir fruit');
  // The broken cornice: six ledges climbing the left wall, the last two over the drain shaft.
  const cornice: [number, number, number][] = [[694, -16, 17.5], [700, -15, 18.5], [706, -17, GALLERY], [712, -15, GALLERY], [718, -17, GALLERY], [724, -15, GALLERY], [729, -11, GALLERY]];
  for (const [i, [q, x, y]] of cornice.entries()) { ledge(q, x, y, 4, 4, i === 6 ? 'Cornice landing before the gallery' : `Cornice step ${i + 1}`); if (i === 1 || i === 3) crate(q, x, y, 'wood', `Offering on cornice step ${i + 1}`); if (i === 5) crate(q, x, y, 'mystery', 'Mystery at the top of the cornice'); }
  pit(709, 730, -20, -12, 16, 'The cistern drain: a shaft under the last cornice steps');
  patrol(697, 16, 16, 'sentry', 0, 1, 'ember sentry on the right floor: its orbs cross the hall; jump them from the ledges');
  crate(703, 16, 16, 'wood', 'Offering behind the sentry'); crate(708, 17, 16, 'wood', 'Second offering behind the sentry');
  sentinel(716, 9, 16, -1, 8, 28, 1.6, 'Niche sentinel sweeping the exit lip');
  // The ramp at the far wall: a straight stone incline up to the gallery, the fast way for a rider who kept speed out of the basin.
  flight(hallB, 731.6, 16, GALLERY, -8, 8, 'Cistern ramp up to the gallery', false);
  // Side chapel: the bonus door off the left cornice.
  masonry(680, 688, -27, -20, 16, 'Side chapel of the Reliquary', { lip: false, kind: 'side' });
  add({ t: 'bonusplatform', p: pt(684, 16, -24), to: pt(684, 16.12, -15), grp: G.course, nm: 'Ember Reliquary: the single temple bonus and safe return' });
  for (const q of [680, 688]) add({ t: 'decor', dkind: 'templewall', p: pt(q, 16, -23.5), s: [7, 4.6, 1.2], seed: q, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Chapel wall' });
  torch(684, -26.5, 16, 'Chapel brazier', 1.5, 1);
  // The exit gallery at 21.
  masonry(731.6, 744, -8, 8, GALLERY, 'Cistern exit gallery'); checkpoint(738, 0, GALLERY, 'Gallery checkpoint');
  // The cave: walls on both sides, a dome of cave roof, braziers on bases.
  for (let q = 660; q <= 744; q += 11) for (const side of [-1, 1]) { const half = q < 672 ? 9 : q > 724 ? 9 : side < 0 ? 28 : 21; plant(q % 22 ? 'trialsv2cavewalla' : 'trialsv2cavewallb', q, side * (half + 5), 15.4, 12.5, 'Cistern wall', side > 0 ? 180 : 0, G.landscape); plant(q % 22 ? 'trialsv2cavewallb' : 'trialsv2cavewalla', q + 4, side * (half + 6), 22, 12.5, 'Cistern wall, upper course', side > 0 ? 180 : 0, G.landscape); }
  for (let q = 672; q <= 724; q += 18) for (const x of [-12, 6]) plant(q % 36 ? 'trialsv2caveroofa' : 'trialsv2caveroofb', q, x, 29, 20, 'Cistern dome', 0, G.landscape);
  for (const [q, x] of [[676, 18], [720, 18], [676, -19], [690, -19]] as const) { add({ t: 'decor', dkind: 'stonebase', p: pt(q, 16, x), s: [1.6, .55, 1.6], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Cistern brazier base' }); torch(q, x, 16.5, 'Cistern brazier', 1.7, 1.2); }

  // =========================================================================
  // THE SANCTUARY STEPS (744 → 772, 21 → 30, on foot). Four ledges rising
  // 2.25 m each with three-metre gaps over the drain; a bristleback on the second.
  // =========================================================================
  rooms.push({ name: 'Sanctuary steps', a: 744, b: 772, mode: 'foot', lesson: 'four jumps up over the drain; the bristleback punishes a stomp' });
  const sanctuarySteps: [number, number, number][] = [[748, -2, GALLERY + 2.25], [756, 2, GALLERY + 4.5], [764, -2, GALLERY + 6.75], [772, 2, GALLERY + 9]];
  for (const [i, [q, x, y]] of sanctuarySteps.entries()) { ledge(q, x, y, 5, 5, `Sanctuary step ${i + 1}`); if (i !== 1) crate(q, x + (i === 3 ? 0 : -1.4), y, i === 3 ? 'mystery' : 'wood', `Offering on sanctuary step ${i + 1}`); }
  pit(744, 776, -12, 12, GALLERY, 'The drain below the sanctuary steps');
  patrol(756, 2, GALLERY + 4.5, 'spiker', 1.2, 1.2, 'bristleback on the second step: spin only');
  for (let i = 0; i < 3; i++) arc(sanctuarySteps[i][0] + 2.5, sanctuarySteps[i + 1][0] - 2.5, (sanctuarySteps[i][1] + sanctuarySteps[i + 1][1]) / 2, sanctuarySteps[i][2] + 1.5, 1, 'Fruit between the sanctuary steps');
  ravine(744, 776, () => 12, q => GALLERY + (30 - GALLERY) * (q - 744) / 32, 14);

  // =========================================================================
  // THE SANCTUARY TERRACE (774 → 876, 30). Release: an open court with the
  // brazier dais at its centre inside a ring of nitro, three fast sentinels
  // on pedestals facing the dais, the russet bull on the right, the crystal
  // on the dais, the green switch beyond it and the gate under a roofed sanctuary.
  // =========================================================================
  rooms.push({ name: 'Sanctuary terrace', a: 774, b: 876, mode: 'board', lesson: 'build speed down the centre, launch off the bank onto the dais inside the nitro ring, drop off its back, hit the green switch last' });
  masonry(774.5, 877, -20, 20, 30, 'Sanctuary terrace', { lip: false });
  const terraceSentinels: [number, number][] = [[800, -10], [818, 15], [840, -10]];
  for (let q = 777; q < 870; q += 2.65) for (let x = -18.5; x <= 18.5; x += 2.65) { if ((q > 810 && q < 836 && Math.abs(x) < 7.5) || terraceSentinels.some(([ts, tx]) => Math.abs(q - ts) < 3.2 && Math.abs(x - tx) < 3.2) || rnd(q * 3 + x) < .14) continue; add({ t: 'decor', dkind: 'stonepaver', p: pt(q, 29.85, x), s: [2.5, .23, 2.55], yaw: 90, solid: false, scenerySolid: false, castShadow: false, color: rnd(q + x) > .5 ? '#e2dcc3' : '#f1e6cb', grp: G.masonry, nm: 'Terrace paving' }); }
  checkpoint(778, 0, 30, 'Terrace checkpoint');
  for (let q = 782; q <= 802; q += 4) crate(q, -16, 30, 'wood', 'Procession offerings along the left side');
  // The dais and its launch bank: twenty metres of landing for any speed from a push to the cap.
  const DAIS = 32;
  masonry(812, 834, -6, 6, DAIS, 'Brazier dais', { thick: 2, lip: true });
  // A long, shallow curved bank (32 degrees at the lip: steeper reads as a vert coping and the engine zeroes forward speed
  // into a hang). Any push from nine metres a second up to the cap lands on the twenty-two-metre dais over a two-metre gap.
  const bank = { rise: 13.2, arc: 32 }, bankLip = 803 + bank.rise * Math.sin(bank.arc * Math.PI / 180);
  add({ t: 'vertramp', p: pt(803, 30, 0), len: 9, w: 0, rise: bank.rise, arc: bank.arc, deck: 0, arcSteps: 12, vkind: 'quarter', yaw: QUARTER_YAW, vert: false, rails: false, tex: 'jungle', color: JADE, grp: G.lines, nm: 'Dais launch bank' });
  floors.push({ a: 803, b: bankLip, ya: 30, yb: 30 + bank.rise * (1 - Math.cos(bank.arc * Math.PI / 180)), x0: -4.5, x1: 4.5, kind: 'main', nm: 'launch bank quarter' });
  arc(bankLip, 812, 0, DAIS, 1, 'Fruit over the gap to the dais');
  add({ t: 'crystal', p: pt(823, DAIS, 0), grp: G.course, nm: 'Temple summit crystal' });
  torch(823, -4.4, DAIS, 'Dais brazier', 2.2, 1.6); torch(823, 4.4, DAIS, 'Dais brazier', 2.2, 1.6);
  torch(833, -5, DAIS, 'Dais corner lamp', 1.4, .9); torch(833, 5, DAIS, 'Dais corner lamp', 1.4, .9);
  // The nitro ring stands clear of the approach lane and of the drop off the dais's back: fourteen metres from the dais centre, turned half a step.
  for (let k = 0; k < 6; k++) { const ang = Math.PI / 6 + k * Math.PI / 3, q = 823 + Math.cos(ang) * 14, x = Math.sin(ang) * 14; crate(q, x, 30, 'nitro', 'Volatile offering of the nitro ring: never touch it; the green switch counts it', 'nitro'); }
  void QUARTER_YAW;
  sentinel(800, -10, 30, 1, 7.8, 28, 0, 'Terrace sentinel, first'); sentinel(818, 15, 30, -1, 7.8, 28, 2.6, 'Terrace sentinel, second'); sentinel(840, -10, 30, 1, 7.8, 28, 5.2, 'Terrace sentinel, third');
  patrol(812, 18.2, 30, 'charger', 18, 2.4, 'russet bull running the right side of the terrace: read the windup, keep left, strike while it is dizzy', true);
  crate(848, -4, 30, 'mystery', 'Mystery behind the dais'); crate(848, 4, 30, 'mystery', 'Second mystery behind the dais');
  crate(852, -6, 30, 'nitrobang', 'Green switch beyond the dais: detonate every volatile offering for the complete count');
  add({ t: 'decor', dkind: 'roofedtemple', p: pt(860, 30, 0), s: [19, 13.5, 14], openFloor: true, seed: 860, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Sanctuary roof over the gate' });
  for (const side of [-1, 1]) for (const along of [-5.3, 5.3]) { add({ t: 'wall', p: pt(860 + along, 30, side * 7.8), s: [2.2, 8, 2.2], invisible: true, grp: G.masonry, nm: 'Sanctuary column core' }); scenery.push({ s: 860 + along, x: side * 7.8, y: 30, radius: 1.2, nm: 'Sanctuary column' }); }
  add({ t: 'gate', p: pt(862, 30, 0), grp: G.course, nm: 'Temple sanctuary finish' });
  add({ t: 'decor', dkind: 'templewall', p: pt(875.5, 30, 0), s: [40, 3.2, 1.2], yaw: 90, seed: 872, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Terrace back wall' });
  add({ t: 'wall', p: pt(875.8, 30, 0), s: [40, 3.2, .6], invisible: true, grp: G.bounds, nm: 'Terrace back containment' });
  for (const side of [-1, 1]) { add({ t: 'decor', dkind: 'templewall', p: pt(823, 30, side * 20.6), s: [97, 1.6, 1.2], seed: 823 + side, solid: false, scenerySolid: false, castShadow: false, grp: G.masonry, nm: 'Terrace parapet' }); add({ t: 'wallpath', p: pt(774.5, 29.9, side * 20.6), pts: [[0, 0], [0, r4(z(877) - z(774.5))]], w: .5, rise: 1.6, collisionHeight: 5, containment: true, invisible: true, grp: G.bounds, nm: 'Terrace parapet containment' }); }
  for (let q = 780, i = 0; q < 872; q += 14, i++) for (const side of [-1, 1]) { plant(i % 2 ? 'trialsv2treea' : 'trialsv2treeb', q, side * (26 + rnd(q + side) * 5), 29 - rnd(q) * 2, 22 + rnd(q * 3) * 4, 'Summit tree', rnd(q * 11 + side) * 360); if (i % 2 === 0) plant('trialsv2crowna', q + 7, side * 33, 38, 24, 'Summit canopy', rnd(q * 13) * 360); if (i % 3 === 0) plant(i % 2 ? 'trialsv2ferna' : 'trialsv2fernb', q + 3, side * 19.2, 30.1, 3, 'Terrace fern', rnd(q * 5 + side) * 360); }
  for (const [q, x] of [[780, -18.6], [780, 18.6], [856, -18.6], [856, 18.6]] as const) { add({ t: 'decor', dkind: 'stonebase', p: pt(q, 30, x), s: [1.6, .55, 1.6], solid: false, scenerySolid: false, grp: G.lamps, nm: 'Terrace brazier base' }); torch(q, x, 30.5, 'Terrace brazier', 1.8, 1.2); }
  add({ t: 'clock', p: pt(-10, 4, -3), grp: G.course });
  const END = 876;

  // ---- verification -------------------------------------------------------
  const checks: string[] = [], problems: string[] = [];
  const check = (label: string, body: () => void) => { checks.push(label); body(); };
  check('every crate stands on authored floor', () => { for (const c of crates) { if (c.flags.has('cap') || c.flags.has('suspended')) continue; const y = floorAt(c.s, c.x); if (y === undefined || Math.abs(y - c.y) > .06) problems.push(`${c.nm} at ${c.s}/${c.x} floats (floor ${y}, crate ${c.y})`); } });
  check('no rail passes within a crate', () => { for (const r of setPieces.rails) for (const c of crates) { if (c.s < r.a - .6 || c.s > r.b + .6 || Math.abs(c.x - r.x) >= 1.3) continue; const ry = r.ya + (r.yb - r.ya) * (Math.max(r.a, Math.min(r.b, c.s)) - r.a) / (r.b - r.a || 1); if (c.y + CRATE > ry - 1.6 && c.y < ry + 2.6) problems.push(`${r.name} passes through ${c.nm}`); } });
  check('crates stand inside a flame sweep only on purpose', () => {
    for (const f of setPieces.sentinels) for (const c of crates) {
      const hot = Math.abs(c.s - f.s) <= 3.6 && (c.x - f.x) * f.facing > 0 && Math.abs(c.x - f.x) <= 7.1 + 1.6 && Math.abs(c.y - f.y) < 3;
      if (hot && !c.flags.has('sweep')) problems.push(`${c.nm} stands inside ${f.name}`);
      if (!hot && c.flags.has('sweep') && Math.abs(c.s - f.s) <= 3.6 && Math.abs(c.y - f.y) < 3) problems.push(`${c.nm} is marked as a sweep offering but ${f.name} cannot reach it`);
    }
  });
  check('no hazard stands in scenery and no scenery stands on a pedestal', () => {
    for (const f of setPieces.sentinels) for (const q of scenery) if (!q.nm.includes('lamp') && Math.hypot(q.s - f.s, q.x - f.x) < q.radius + 2.2 && Math.abs(q.y - f.y) < 8) problems.push(`${q.nm} at ${q.s}/${q.x} crowds ${f.name}`);
    for (const f of setPieces.sentinels) for (const o of C) if ((o.t === 'wall' || o.t === 'wallpath') && !o.nm?.includes(f.name) && o.t === 'wall' && Math.hypot(-o.p[2] - f.s, o.p[0] - f.x) < 2.6) problems.push(`${o.nm} intersects ${f.name}`);
  });
  check('no crate inside a censer swing', () => { for (const q of setPieces.censers) for (const c of crates) if (Math.abs(c.s - q.s) < 1.9 && Math.abs(c.x - q.x) < q.len * Math.sin(q.amp) + 1.2 && c.y + CRATE > q.pivotY - q.len - 1.1) problems.push(`${c.nm} is clipped by the censer at ${q.s}`); });
  check('no crate inside a patrol walk', () => { for (const q of patrols) for (const c of crates) { const inside = q.along ? Math.abs(c.s - q.s) < q.range + 1.4 && Math.abs(c.x - q.x) < 1.8 : Math.abs(c.s - q.s) < 1.4 && Math.abs(c.x - q.x) < q.range + 1.2; if (inside && Math.abs(c.y - q.y) < 2) problems.push(`${c.nm} stands inside the ${q.foe} walk at ${q.s}`); } });
  check('patrols walk on floor', () => { for (const q of patrols) for (const t of [-1, -.5, 0, .5, 1]) { const s = q.along ? q.s + t * q.range : q.s, x = q.along ? q.x : q.x + t * q.range; const y = floorAt(s, x); if (y === undefined || Math.abs(y - q.y) > .4) problems.push(`the ${q.foe} at ${q.s} walks off the floor at ${s}/${x}`); } });
  check('checkpoints respawn ten metres clear of flames, nitro, patrols and swings', () => {
    for (const cp of checkpoints) {
      for (const f of setPieces.sentinels) if (Math.hypot(f.s - cp.s, f.x - cp.x) < 10) problems.push(`${cp.nm} is ${Math.hypot(f.s - cp.s, f.x - cp.x).toFixed(1)} m from ${f.name}`);
      for (const q of patrols) if (Math.hypot(q.s - cp.s, q.x - cp.x) < 8 + (q.along ? q.range : 0)) problems.push(`${cp.nm} is beside the ${q.foe} at ${q.s}`);
      for (const c of crates) if (c.kind === 'nitro' && Math.hypot(c.s - cp.s, c.x - cp.x) < 10) problems.push(`${cp.nm} is beside ${c.nm}`);
      for (const q of setPieces.censers) if (Math.abs(q.s - cp.s) < 10) problems.push(`${cp.nm} is under the censer at ${q.s}`);
      const y = floorAt(cp.s, cp.x); if (y === undefined) problems.push(`${cp.nm} has no floor`);
    }
  });
  check('volatile crates keep their blast away from other boxes', () => { for (const c of crates) { if (c.kind !== 'nitro' && c.kind !== 'tnt') continue; for (const o of crates) { if (o === c || (o.kind === 'nitro' && c.kind === 'nitro') || (c.kind === 'tnt' && o.flags.has('cap') && o.s === c.s && o.x === c.x)) continue; if (Math.hypot(o.s - c.s, o.x - c.x) < 2.75 + .6 && Math.abs(o.y - c.y) < 3) problems.push(`${o.nm} stands inside the blast of ${c.nm}`); } } });
  check('platforming gaps are within a single jump and ledges within a jump\'s height', () => {
    for (const chain of [setPieces.plinths, setPieces.ledges]) {
      const steps = [...chain].filter(q => !q.name.includes('Side ledge')).sort((a, b) => a.s - b.s);
      for (let i = 1; i < steps.length; i++) { const a = steps[i - 1], b = steps[i], gap = (b.s - b.d / 2) - (a.s + a.d / 2), rise = b.y - a.y; if (gap > 12) continue; if (gap > 4.6 || rise > 2.4) problems.push(`${a.name} → ${b.name}: gap ${gap.toFixed(1)} m, rise ${rise.toFixed(1)} m`); }
    }
  });
  if (problems.length) throw new Error(`Temple of Embers cannot be built:\n${problems.join('\n')}`);

  // ---- camera spine and level data ---------------------------------------
  for (let s = -16; s <= END; s += 5) add({ t: 'camnode', p: pt(s, mainFloorAt(Math.min(END, Math.max(-16, s))) + 1, 0), radius: 0, grp: G.camera, nm: 'Ravine camera spine' });
  const profile: [number, number][] = [];
  for (let s = -16; s <= END; s += 2) profile.push([s, mainFloorAt(s)]);
  const countedCrates = crates.filter(c => !['bang', 'nitrobang', 'metal', 'metalbounce'].includes(c.kind)).length;
  const data: CustomLevelData = {
    v: 1, name: 'Temple of Embers', spawn: pt(-8, 4.12, 1.2), killY: -24, sky: 'night', jungleAtmosphere: true, keepPlayFog: true,
    jungleDepthFade: false, jungleStyle: 'painterly', cameraAirLift: .8, atmosphere: TEMPLE_NIGHT_ATMOSPHERE,
    relicTime: 220, medalTimes: { gold: 220, silver: 300, bronze: 420 }, groups, components: C,
  };
  const toWorld = (s: number, y: number, side = 0): P => pt(s, y, side);
  return { id: 'jungle-terraces', data, sourceComponents: C, toWorld, toLocal: p => [r4(-p[2]), r4(p[1]), r4(p[0])], frameAt: s => ({ x: 0, z: z(s), fx: 0, fz: -1, scale: 1, yaw: 90 }),
    groundAt: s => mainFloorAt(Math.min(END, Math.max(-16, s))), profile, pipes, gaps, rooms, climbs: [], voids, chapters: rooms, setPieces,
    tikiTrials: setPieces.sentinels.map(f => ({ s: f.s, side: Math.sign(f.x) })), peak: 32, end: END, countedCrates, checks, floors, floorAt };
}

export const TEMPLE_OF_EMBERS_ROUTE = buildTempleOfEmbers();
export const TEMPLE_OF_EMBERS_LEVEL = TEMPLE_OF_EMBERS_ROUTE.data;
