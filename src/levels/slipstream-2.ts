import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

type Point = [number, number, number];
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [
  { id: 1, nm: 'The reservoir gate · short temple climb', editorOnly: true },
  { id: 2, nm: 'Ordered course cameras', editorOnly: true },
  { id: 10, nm: 'Reservoir · broad carving bowl', editorOnly: true },
  { id: 11, nm: 'Fork · low road or high grind', editorOnly: true },
  { id: 12, nm: 'Broken sluice · flight into the gardens', editorOnly: true },
  { id: 13, nm: 'Colonnade · alternating slalom', editorOnly: true },
  { id: 14, nm: 'Last spillway · ocean flight', editorOnly: true },
  { id: 15, nm: 'Sea court · finish', editorOnly: true },
];
const add = (c: CustomComponent) => C.push(c);
const stone = '#cbb993', moss = '#789876', gold = '#eab44e', turquoise = '#43aeb7';
const base = 54, summit = 65.2;
function pad(p: Point, w: number, d: number, name: string, color = stone) {
  add({ t: 'platform', p: [p[0], p[1] - .65, p[2]], s: [w, 1.3, d], tex: 'stone', color, edgeGrinding: false, grp: 1, nm: name });
}
// One readable climb, one moving stone, one refuge. The board course is visible
// beside the gate; the opening no longer repeats this facade three times.
const templePath: Point[] = [[16, base, 0]];
export const SLIPSTREAM_2_TEMPLE: { p: Point; moving: boolean; row: number }[] = [];
pad(templePath[0], 8, 7, 'Reservoir gate court');
add({ t: 'clock', p: [18, base, 1], grp: 1 });
for (const [i, x] of [11.8, 7.4, 2.8, -1.8, -6.4, -11].entries()) {
  const moving = i === 1, p: Point = [x, base + (i + 1) * 1.6, moving ? -1.5 : 0];
  if (moving) add({ t: 'mover', p, s: [3.8, .7, 4.8], axis: 'z', amp: 2.2, speed: .85, phase: 0, tex: 'stone', color: moss, edgeGrinding: false, grp: 1, nm: 'Single sliding gate stone' });
  else pad(p, i === 2 ? 4.6 : 3.8, i === 2 ? 6 : 4.8, i === 2 ? 'Broad halfway refuge' : 'Gate stair ledge');
  SLIPSTREAM_2_TEMPLE.push({ p, moving, row: 0 }); templePath.push(p);
  add({ t: 'wumpa', p: [x, p[1] + 1.1, p[2]], grp: 1 });
}
for (const p of [[-16, summit, 0], [-16, summit, -12], [-16, summit, -25]] as Point[]) {
  pad(p, 9, 15, 'Reservoir rim balcony', moss); templePath.push(p);
}
add({ t: 'checkpoint', p: [-16, summit, 0], grp: 1, nm: 'Reservoir rim' });
add({ t: 'decor', dkind: 'block', p: [0, base + 1, -5.8], s: [44, 20, 4], tex: 'stone', color: stone, grp: 1, nm: 'Reservoir retaining facade' });
add({ t: 'wall', p: [0, base - 9, -3.65], s: [44, 20, .3], collisionHeight: 20, invisible: true, edgeGrinding: false, grp: 1, nm: 'Solid gate facade' });
for (const x of [-22, 22]) add({ t: 'decor', dkind: 'ruinblock', p: [x, base - 14, -4], s: [4, 38, 6], grp: 1, nm: 'Gate tower' });
for (const x of [-12, 0, 12]) add({ t: 'decor', dkind: 'vines', p: [x, summit + 3, -3.3], w: 2.4, rise: 13, n: 4, grp: 1 });
add({ t: 'camnode', p: [0, base + 6, -7], s: [55, 40, 32], cameraView: true, radius: 2,
  cameraPosition: [0, base + 14, 31], cameraTarget: [0, base + 5, -6], cameraFollowDistance: 18,
  cameraFollowTargetHeight: 2.2, cameraFov: 58, cameraAspect: 16 / 9, grp: 2, nm: 'Gate climb · front view' });

export const SLIPSTREAM_2_END = 900;
export const SLIPSTREAM_2_GAPS = [
  { a: 168, b: 186, width: 18, name: 'Reservoir breach', approachDrop: 8, landingDrop: 1, kicker: 1.5 },
  { a: 418, b: 442, width: 24, name: 'Broken sluice', approachDrop: 10, landingDrop: 2, kicker: 2.5 },
  { a: 760, b: 789, width: 29, name: 'Ocean flight', approachDrop: 14, landingDrop: 3, kicker: 2.5 },
];
export const SLIPSTREAM_2_SECTIONS = [
  { a: 0, b: 168, name: 'Reservoir', grp: 10, color: turquoise },
  { a: 186, b: 374, name: 'Two routes', grp: 11, color: '#d6c7a7' },
  { a: 374, b: 538, name: 'Broken sluice', grp: 12, color: '#8dac87' },
  { a: 538, b: 684, name: 'Colonnade', grp: 13, color: '#c4a077' },
  { a: 684, b: 760, name: 'Last spillway', grp: 14, color: '#4b929e' },
  { a: 789, b: 900, name: 'Sea court', grp: 15, color: '#decba1' },
];
const clamp = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
// Individual bends and deliberate straight launch/catch lines. No repeating
// sine-wave road. Station is distance down -Z; curves add real travel length.
const spine = [[0, -16], [90, 32], [140, 42], [225, 42], [275, 0], [368, -28],
  [500, -28], [585, 35], [655, 35], [710, -18], [900, -18]];
function centerX(s: number) {
  const i = Math.max(1, spine.findIndex(p => p[0] >= s));
  const a = spine[i - 1], b = spine[i];
  return a[1] + (b[1] - a[1]) * smooth((s - a[0]) / (b[0] - a[0]));
}
const fork = (s: number) => s > 258 && s < 374 ? 8 * Math.sin(Math.PI * (s - 258) / 116) ** 2 : 0;
export function slipstream2Height(s: number) {
  let y = summit - 27.2 * s / SLIPSTREAM_2_END;
  for (const g of SLIPSTREAM_2_GAPS) {
    y -= g.approachDrop * clamp((s - (g.a - 55)) / 40);
    y -= g.landingDrop * clamp((s - g.a) / g.width);
    if (s > g.a - 15 && s <= g.a) {
      const t = Math.min(1, (s - (g.a - 15)) / 9);
      y += g.kicker * (t < .2 ? t * t / .36 : (t - .1) / .9);
    }
    if (s > g.a && s < g.b) y += g.kicker * (1 - (s - g.a) / g.width);
  }
  return y;
}
export function slipstream2Point(s: number, u = 0, lift = 0): Point {
  s = Math.max(0, Math.min(SLIPSTREAM_2_END, s));
  return [centerX(s) + fork(s) + u, slipstream2Height(s) + lift, -32 - s];
}
export function slipstream2Progress(p: Point | { x: number; z: number }) {
  return Math.max(0, Math.min(SLIPSTREAM_2_END, -(Array.isArray(p) ? p[2] : p.z) - 32));
}
export const SLIPSTREAM_2_SLALOM = [560, 594, 628, 662];
export function slipstream2Line(s: number): Point {
  let u = 0;
  SLIPSTREAM_2_SLALOM.forEach((station, i) => { u += (i % 2 ? 1 : -1) * 3.7 * (1 - smooth((Math.abs(s - station) - 8) / 9)); });
  return slipstream2Point(s, u);
}
function width(s: number) {
  if (s < 110) return 28 - 8 * smooth(s / 110);
  if (s < 225) return 20 - 6 * smooth((s - 190) / 35);
  if (s < 258) return 14;
  if (s < 374) return 14 - 5 * Math.sin(Math.PI * (s - 258) / 116) ** 2;
  if (s < 500) return 22;
  if (s < 538) return 22 - 8 * smooth((s - 500) / 38);
  if (s < 684) return 14;
  if (s < 789) return 18;
  return 18 + 14 * smooth((s - 789) / 65);
}
function rim(s: number) {
  if (s < 168) return 3.2;
  if (s < 374) return .3;
  if (s < 538) return 1.2;
  if (s < 684) return .15;
  if (s < 789) return 2.3;
  return .2;
}
function ribbon(a: number, b: number, grp: number, color: string, name: string,
  branch = false) {
  const p = slipstream2Point(a), vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const rows = Math.ceil((b - a) / 1.5), us = [-1, -.88, -.72, -.55, 0, .55, .72, .88, 1];
  for (let i = 0; i <= rows; i++) {
    const s = a + (b - a) * i / rows, half = branch ? 2.6 : width(s) / 2;
    for (const u of us) {
      const q = slipstream2Point(s, (branch ? -2 * fork(s) : 0) + u * half,
        branch ? fork(s) * .4 : Math.max(0, (Math.abs(u) - .55) / .45) ** 2 * rim(s));
      vertices.push(q[0] - p[0], q[1] - p[1], q[2] - p[2]); uvs.push(u * half / 4, s / 4);
    }
    if (i) for (let j = 0; j < us.length - 1; j++) {
      const q = (i - 1) * us.length + j, n = q + us.length;
      indices.push(q, q + 1, n, n, q + 1, n + 1);
    }
  }
  add({ t: 'mesh', p, vertices, indices, uvs, tex: 'stone', color, solid: true, vert: false,
    gravityTrack: true, edgeGrinding: false, grp, nm: name });
}
for (const section of SLIPSTREAM_2_SECTIONS) {
  let start = section.a;
  for (const g of SLIPSTREAM_2_GAPS) if (g.a > start && g.a < section.b) {
    ribbon(start, g.a, section.grp, section.color, section.name); start = g.b;
  }
  if (start < section.b) ribbon(start, section.b, section.grp, section.color, section.name);
}
// The high route is a genuine shortcut/reward: narrow approach, one exposed
// grind across the missing span, then the crystal balcony and a smooth merge.
ribbon(258, 299, 11, stone, 'High route · approach', true);
ribbon(333, 374, 11, stone, 'High route · crystal balcony', true);
function rail(a: number, b: number, offset: (s: number) => number, lift: (s: number) => number, name: string, grp: number) {
  const p = slipstream2Point(a, offset(a), lift(a)), pts: NonNullable<CustomComponent['pts']> = [];
  const steps = Math.ceil((b - a) / 2);
  for (let i = 0; i <= steps; i++) {
    const s = a + (b - a) * i / steps, q = slipstream2Point(s, offset(s), lift(s));
    pts.push([q[0] - p[0], q[2] - p[2], 0, q[1] - p[1]]);
  }
  add({ t: 'rail', p, pts, grp, nm: name });
}
rail(285, 345, s => -2 * fork(s), s => fork(s) * .4 + .65, 'High route · exposed aqueduct rail', 11);
add({ t: 'crystal', p: slipstream2Point(348, -2 * fork(348), fork(348) * .4 + 1.6), grp: 11 });
add({ t: 'crate', p: slipstream2Point(355, -2 * fork(355) - 1.1, fork(355) * .4), kind: 'life', grp: 11 });
// A single long optional coping line in the reservoir; not a duplicate pair
// placed automatically on every approach.
rail(30, 104, () => -7, () => .7, 'Reservoir coping line', 10);

export const SLIPSTREAM_2_CHECKPOINTS = [28, 204, 382, 493, 692, 828].map(s => ({ s, p: slipstream2Point(s) }));
for (const cp of SLIPSTREAM_2_CHECKPOINTS) add({ t: 'checkpoint', p: cp.p, grp: 2, nm: `Course refuge ${cp.s}` });
for (let s = 30; s < 880; s += 13) {
  if (SLIPSTREAM_2_GAPS.some(g => s > g.a - 20 && s < g.b + 12)) continue;
  const p = slipstream2Line(s); p[1] += 1; add({ t: 'wumpa', p, grp: 2 });
}
for (const [i, s] of SLIPSTREAM_2_SLALOM.entries()) {
  const side = i % 2 ? -1 : 1;
  add({ t: 'wall', p: slipstream2Point(s, side * 3.7), s: [6.6, 5 + i % 2 * 2, 5], tex: 'stone',
    color: stone, edgeGrinding: false, grp: 13, nm: 'Broken colonnade · steer through the open side' });
  add({ t: 'decor', dkind: 'vines', p: slipstream2Point(s, side * 3.7, 6), w: 2, rise: 5, n: 3, grp: 13 });
  add({ t: 'crate', p: slipstream2Point(s, -side * 5.7), kind: i === 2 ? 'mask' : 'wood', grp: 13 });
}
for (const [s, u] of [[69, 5], [98, -4], [228, 4.5], [490, -4.5], [835, -8], [839, -8], [843, -8]])
  add({ t: 'crate', p: slipstream2Point(s, u), kind: 'wood', grp: 2 });
for (const gap of SLIPSTREAM_2_GAPS) {
  const middle = slipstream2Point((gap.a + gap.b) / 2, 0, -15);
  add({ t: 'pit', p: middle, s: [90, 1, gap.width + 12], tex: 'solid', color: '#176e83', grp: 2, nm: `${gap.name} · open water` });
  for (let s = gap.a - 12; s < gap.b + 8; s += 4) {
    const t = clamp((s - gap.a) / gap.width);
    add({ t: 'wumpa', p: slipstream2Point(s, 0, 1 + 6 * Math.sin(Math.PI * t)), grp: 2 });
  }
  const stripe = slipstream2Point(gap.a - 9, 0, .04), vertices: number[] = [];
  for (const [s, u] of [[gap.a - 9, -5], [gap.a - 9, 5], [gap.a - 7, -5], [gap.a - 7, 5]]) {
    const q = slipstream2Point(s, u, .04); vertices.push(q[0] - stripe[0], q[1] - stripe[1], q[2] - stripe[2]);
  }
  add({ t: 'mesh', p: stripe, vertices, indices: [0, 1, 2, 2, 1, 3], tex: 'solid', color: gold, solid: false,
    edgeGrinding: false, doubleSided: true, grp: 2, nm: 'Amber release stripe' });
}
// Landmarks are authored at changes of play: reservoir hoops, the fork's
// isolated shrine, ruined colonnade, and a paired monumental final launch.
function arch(s: number, w: number, h: number, grp: number) {
  for (const u of [-w / 2, w / 2]) add({ t: 'decor', dkind: 'ruinblock', p: slipstream2Point(s, u, -5), s: [2.5, h + 5, 3.5], grp, nm: 'Carved gate pier' });
  add({ t: 'decor', dkind: 'block', p: slipstream2Point(s, 0, h), s: [w + 3, 2, 3.5], tex: 'stone', color: stone, grp, nm: 'Carved gate lintel' });
}
arch(38, 29, 13, 10); arch(118, 23, 10, 10); arch(244, 20, 12, 11); arch(510, 21, 14, 12); arch(742, 25, 22, 14);
for (const [s, side, h] of [[310, -1, 19], [342, -1, 11], [492, 1, 15], [704, -1, 24], [843, 1, 18]]) {
  const offset = side * (width(s) / 2 + (s > 258 && s < 374 ? 23 : 8));
  add({ t: 'decor', dkind: 'ruinblock', p: slipstream2Point(s, offset, -9), s: [7, h + 9, 9], grp: 2, nm: 'Isolated aqueduct remnant' });
  add({ t: 'decor', dkind: 'vines', p: slipstream2Point(s, offset, h), w: 3, rise: h, n: 4, grp: 2 });
}
for (const s of [64, 132, 210, 272, 358, 396, 482, 540, 608, 674, 728, 834, 875]) {
  for (const side of [-1, 1]) add({ t: 'decor', dkind: 'ruinblock', p: slipstream2Point(s, side * (width(s) / 2 - 1), -24), s: [2.4, 22, 3], grp: 2, nm: 'Aqueduct support below the deck' });
}
for (const p of templePath) add({ t: 'camnode', p, grp: 2 });
for (let s = 0; s <= SLIPSTREAM_2_END; s += 5) add({ t: 'camnode', p: slipstream2Point(s), grp: 2 });
add({ t: 'gate', p: slipstream2Point(884), grp: 15 });
export const SLIPSTREAM_2_LEVEL: CustomLevelData = {
  v: 1, name: 'Slipstream 2', spawn: [16, base + .08, 0], killY: -38,
  sky: 'day', cameraLookAhead: 15, cameraAirLift: .25, allBalanceCrates: true, perfectGrindBoost: true,
  medalTimes: { gold: 72, silver: 100, bronze: 145 },
  atmosphere: { fogEnabled: true, fogNear: 105, fogFar: 370, fogColor: '#b2dce3', ambientSky: '#c4e5ee', ambientGround: '#526d6e',
    ambientIntensity: 1.05, sunColor: '#fff0cd', sunIntensity: 1.2, fillColor: '#dcefff', fillIntensity: .3, shadowStrength: .7, drawDistance: 480, backdrop: 'sky' },
  components: C, groups,
};
