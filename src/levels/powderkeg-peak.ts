import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { BLUE_ICE, SLATE, SLATE_DEEP, Timber, boxLine, cliff, snowCap } from './powderkeg-art';
import { Mountain, Path, bed, pad, rectPad, padMeshes, pisteMeshes, profile, slopeMeshes, r3, smooth, type Carve, type Gap, type Knoll, type P3 } from './powderkeg-terrain';

/**
 * POWDERKEG PEAK
 *
 * A mountain you climb on foot and come down on the board. Its shape follows the
 * Crash 2 mountain levels in the bible's record (into the screen, a vertical join
 * with a checkpoint, side-scroll rows up a wall, a one-way turn, into the screen
 * again) and Air Crash's strict alternation of boots and board, sized like a
 * Crash 2/3 course: four main sections of about ten beats.
 *
 *   S1  Kindling Steps   on foot, north up a walled gully in terraces      (new: ice underfoot)
 *   S2  First Tracks     board, a square-wave descent to the frozen tarn   (new: rolling boulders)
 *       the tarn, the hoist: the camera turns side-on on the way up
 *   S3  The Headwall     on foot, side-on: east along the lower ledge row, up
 *                        the east buttress, back west along the upper row   (new: ice stampers)
 *   S4  Powderkeg Run    board, west along the summit ridge and south down
 *                        the long face to the powder works                  (everything, combined)
 *
 * World: X east, Z south, so "into the screen" is −Z. Engine yaw 0 faces −Z,
 * +90 faces −X. Climbs are played on foot and carry the pits, ledges and
 * enemies; speed lives on the two descents.
 */
type Kind = NonNullable<CustomComponent['kind']>;
type Foe = NonNullable<CustomComponent['foe']>;
type Decor = NonNullable<CustomComponent['dkind']>;

const G = { course: 1, ground: 2, slopes: 3, scenery: 4, bounds: 5, crates: 6, hazards: 7, enemies: 8, camera: 9, fruit: 10, rock: 11 } as const;
const groups: CustomGroup[] = [
  { id: G.course, nm: 'Course: spawn, checkpoints, gate' }, { id: G.ground, nm: 'Ridden and walked ground' }, { id: G.slopes, nm: 'Mountain slopes' },
  { id: G.scenery, nm: 'Scenery' }, { id: G.bounds, nm: 'Bounds and kill volumes' }, { id: G.crates, nm: 'Crates' }, { id: G.hazards, nm: 'Hazards' },
  { id: G.enemies, nm: 'Enemies' }, { id: G.camera, nm: 'Camera lane and zones' }, { id: G.fruit, nm: 'Fruit lines' }, { id: G.rock, nm: 'Rock and ice structure' },
];
const C: CustomComponent[] = [];
const add = (c: CustomComponent): CustomComponent => { if (c.nm && c.nm.length > 120) throw new Error(`Powderkeg Peak: label over 120 characters: ${c.nm}`); C.push(c); return c; };
const SNOW = '#f2f6fc', ICE = '#a9dcf2', DEEP = '#1d3d6e';

/** A solid block given by its top face: x0..x1 east, z0..z1 south (z0 < z1), top at `y`, `thick` deep. */
const block = (x0: number, x1: number, z0: number, z1: number, y: number, thick: number, nm: string, o: Partial<CustomComponent> = {}): CustomComponent =>
  add({ t: 'platform', p: [r3((x0 + x1) / 2), r3(y - thick / 2), r3((z0 + z1) / 2)], s: [r3(x1 - x0), r3(thick), r3(z1 - z0)], tex: 'snow', color: SNOW, grp: G.ground, nm, ...o });
const SLAB = .5;
/** A walked floor: a snow (or ice) slab on a body that the art clads. The slab is the collision players read. */
const floorBlock = (x0: number, x1: number, z0: number, z1: number, y: number, thick: number, nm: string, ice = false): void => {
  block(x0, x1, z0, z1, y, SLAB, nm, ice ? { tex: 'ice', color: ICE, slip: true } : {});
  block(x0, x1, z0, z1, y - SLAB, thick - SLAB, `${nm}: body`, { artProxy: true, edgeGrinding: false, grp: G.rock });
};
/** A mass of slate filling a box from `bottom` to `top`. Seen, never stood on: collision stays with the plain blocks. */
const slate = (x0: number, x1: number, z0: number, z1: number, bottom: number, top: number, seed: number, nm: string): CustomComponent =>
  add({ t: 'decor', dkind: 'crowncrashcavernrock', p: [r3((x0 + x1) / 2), r3(bottom), r3((z0 + z1) / 2)], s: [r3(x1 - x0), r3(top - bottom), r3(z1 - z0)], yaw: seed % 2 ? 180 : 0, seed, scenerySolid: false, grp: G.rock, nm });
/** Shadowed rock behind the slate pieces: the clefts between them close on this, never on sky. */
const backing = (x0: number, x1: number, z0: number, z1: number, bottom: number, top: number, nm: string): CustomComponent =>
  block(x0, x1, z0, z1, top, top - bottom, nm, { tex: 'solid', color: '#3d4259', edgeGrinding: false, grp: G.rock });
/** A touch-kill sheet at height `y` (the engine's box reaches 0.25 m above and 1.75 m below it). */
const kill = (x0: number, x1: number, z0: number, z1: number, y: number, nm: string): CustomComponent =>
  add({ t: 'pit', p: [r3((x0 + x1) / 2), r3(y), r3((z0 + z1) / 2)], s: [r3(x1 - x0), 1, r3(z1 - z0)], invisible: true, grp: G.bounds, nm });
/** An invisible barrier from `y0` up `h` metres. */
const fence = (x0: number, x1: number, z0: number, z1: number, y0: number, h: number, nm: string): CustomComponent =>
  add({ t: 'wall', p: [r3((x0 + x1) / 2), r3(y0), r3((z0 + z1) / 2)], s: [r3(Math.max(.4, x1 - x0)), r3(h), r3(Math.max(.4, z1 - z0))], invisible: true, grp: G.bounds, nm });

const checkpoint = (p: P3, nm: string) => add({ t: 'checkpoint', p, grp: G.course, nm });
// Crates are authored on the engine's 0.96 m grid; touching formations are enlarged to 1.152 m when the level is built.
const CR = .96;
const crate = (x: number, y: number, z: number, kind: Kind, nm: string, o: Partial<CustomComponent> = {}): CustomComponent =>
  add({ t: 'crate', p: [r3(x), r3(y), r3(z)], kind, grp: G.crates, nm, ...o });
/** A column of crates, bottom first. */
const stack = (x: number, y: number, z: number, kinds: readonly Kind[], nm: string) => kinds.forEach((kind, i) => crate(x, y + i * CR, z, kind, i ? `${nm}: tier ${i + 1}` : nm));
/** A touching row of crates from (x, z), stepping along +X (`dz` false) or −Z (`dz` true). */
const rowOf = (x: number, y: number, z: number, kinds: readonly Kind[], nm: string, alongZ = false, o: Partial<CustomComponent> = {}) =>
  kinds.forEach((kind, i) => crate(alongZ ? x : x + i * CR, y, alongZ ? z - i * CR : z, kind, `${nm} ${i + 1}`, o));
const fruit = (x: number, y: number, z: number) => add({ t: 'wumpa', p: [r3(x), r3(y + 1), r3(z)], grp: G.fruit });
/** Fruit from one floor point to another; `rise` bows the line into a jump arc. */
const fruitLine = (a: P3, b: P3, n: number, rise = 0) => { for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1); fruit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * rise, a[2] + (b[2] - a[2]) * t); } };
const foe = (kind: Foe, x: number, y: number, z: number, range: number, speed: number, nm: string, o: Partial<CustomComponent> = {}): CustomComponent =>
  add({ t: 'enemy', foe: kind, p: [r3(x), r3(y), r3(z)], range, speed, terrainSupports: true, grp: G.enemies, nm, ...o });
/** An ice stamper over a deck: `w` along the ledge, the full lane deep. Hangs 38 % of its cycle, slams, rests as a wall, rises. */
const stamper = (x: number, y: number, z: number, phase: number, nm: string, o: Partial<CustomComponent> = {}): CustomComponent =>
  add({ t: 'crusher', p: [r3(x), r3(y), r3(z)], s: [3, 3, 4], cycle: 3.2, phase: r3(phase), tex: 'ice', color: '#8fd0ee', grp: G.hazards, nm, ...o });

// ───────────────────────────── S1 · Kindling Steps ─────────────────────────────
// Stations run north from the lodge yard: z = −s. The gully is twelve metres wide between two rock walls.
const HALF = 6, CREST_Y = 10.5, CREST_S = 197;
interface Terrace { a: number; b: number; y: number; x?: number; w?: number; ice?: boolean; nm: string; }
const TERRACES: Terrace[] = [
  { a: 20, b: 37, y: 1.6, nm: 'Crab shelf' },
  { a: 37, b: 54, y: 2.5, ice: true, nm: 'Mill pond: the first ice' },
  { a: 54, b: 71, y: 2.5, nm: 'Boulder terrace' },
  { a: 71, b: 74, y: 2.5, x: 3, w: 6, nm: 'Half bridge beside the first open crevasse' },
  { a: 74, b: 85, y: 2.5, nm: 'Arrow runway' },
  { a: 88.2, b: 99, y: 2.5, nm: 'First landing' },
  { a: 105, b: 113.4, y: 5, ice: true, nm: 'Ice shelf above the second crevasse' },
  { a: 113.4, b: 116, y: 5, nm: 'Snow lip of the ice shelf: firm footing for the take-off' },
  { a: 119, b: 131, y: 5, nm: 'Powder landing' },
  { a: 137, b: 151, y: 7, nm: 'Bristleback shelf' },
  { a: 153.8, b: 157.3, y: 7.5, x: 0, w: 5, nm: 'First pillar' },
  { a: 160.3, b: 163.8, y: 8, x: 0, w: 5, nm: 'Second pillar' },
  { a: 167, b: 171, y: 8.5, x: 0, w: 6, nm: 'Third pillar' },
  { a: 171, b: 184, y: 9.4, nm: 'Lookout shelf' },
];
const RAMPS: { a: number; b: number; y0: number; y1: number; w: number; nm: string }[] = [
  { a: 14, b: 20, y0: 0, y1: 1.6, w: 12, nm: 'Yard ramp' },
  { a: 99, b: 105, y0: 2.5, y1: 5, w: 8, nm: 'Drift ramp to the ice shelf' },
  { a: 131, b: 137, y0: 5, y1: 7, w: 8, nm: 'Drift ramp to the bristleback shelf' },
  { a: 184, b: 189, y0: 9.4, y1: CREST_Y, w: 8, nm: 'Last rise to the crest' },
];
/** Open ground in the gully: [from, to, floor it interrupts]. Each gets a kill sheet and a blue-black floor. */
const CREVASSES: { a: number; b: number; y: number; x0?: number; x1?: number; nm: string }[] = [
  { a: 71, b: 74, y: 2.5, x0: -HALF, x1: 0, nm: 'Half crevasse' },
  { a: 85, b: 88.2, y: 2.5, nm: 'First crevasse' },
  { a: 116, b: 119, y: 5, nm: 'Second crevasse' },
  { a: 151, b: 171, y: 7, nm: 'Pillar field' },
];
for (const t of TERRACES) {
  const w = t.w ?? HALF * 2, x = t.x ?? 0;
  floorBlock(x - w / 2, x + w / 2, -t.b, -t.a, t.y, t.w ? 9 : 8, t.nm, t.ice);
  // Free-standing pillars and the half bridge are columns of blue ice.
  if (t.w) C.push(...cliff({ line: boxLine(x - w / 2, -t.b, x + w / 2, -t.a), side: 1, closed: true, bottom: t.y - 9, top: t.y - .18, palette: BLUE_ICE, relief: .3, batter: .03, seed: Math.round(t.a), ice: 0, nm: `${t.nm}: ice column`, grp: G.rock }));
}
for (const q of RAMPS) {
  add({ t: 'ramp', p: [0, q.y0, r3(-(q.a + q.b) / 2)], len: q.b - q.a, rise: r3(q.y1 - q.y0), w: HALF * 2, yaw: 0, tex: 'snow', color: SNOW, grp: G.ground, nm: q.nm });
  block(-HALF, HALF, -q.b, -q.a, q.y0 - .02, 8, `${q.nm}: body`, { artProxy: true, edgeGrinding: false, grp: G.rock });
}
for (const q of CREVASSES) {
  const x0 = q.x0 ?? -HALF, x1 = q.x1 ?? HALF;
  kill(x0, x1, -q.b, -q.a, q.y - 3.6, `${q.nm}: fall`);
  block(x0, x1, -q.b, -q.a, q.y - 8, 1, `${q.nm}: depths`, { tex: 'ice', color: DEEP, grp: G.rock, edgeGrinding: false });
}
// Gully walls: rock to either side, stepped with the climb, and a tall unseen fence along each lip.
const WALLS: [number, number, number][] = [[12, 37, 5.2], [37, 99, 6.2], [99, 131, 8.8], [131, 151, 10.8], [151, 191, 13.6]];
for (const [a, b, top] of WALLS) for (const side of [-1, 1])
  block(side > 0 ? HALF : -HALF - 3, side > 0 ? HALF + 3 : -HALF, -b, -a, top, top + 9, `Gully wall ${a}-${b}`, { artProxy: true, grp: G.rock, edgeGrinding: false });
// The walls as seen: rock faces in strata with snow on every shelf, a drifted cap along each lip.
const wallTop = (s: number): number => { let y = WALLS[0][2]; for (let i = 0; i < WALLS.length; i++) { const [a, , top] = WALLS[i]; if (i === 0) { y = top; continue; } y += (top - WALLS[i - 1][2]) * Math.max(0, Math.min(1, (s - a + 2.5) / 5)); } return y; };
const gullyFloor = (s: number): number => { let y = 0; for (const t of TERRACES) if (!t.w && s >= t.a - .01) y = t.y; for (const q of RAMPS) if (s > q.a && s < q.b) y = q.y0; return y; };
for (const side of [-1, 1] as const) {
  const x = side * HALF, line: [number, number][] = [[x, -12], [x, -191]];
  for (let a = 10, i = 0; a < 191; a += 14, i++) {
    const b = Math.min(193, a + 17), top = Math.max(wallTop(a), wallTop(b)) + .35, bottom = gullyFloor(a) - 9;
    slate(side > 0 ? x : x - 6.5, side > 0 ? x + 6.5 : x, -b, -a, bottom, top, i * 2 + (side > 0 ? 1 : 0) + 3, `Gully wall slate ${side > 0 ? 'east' : 'west'} ${a}`);
  }
  for (const [a, b, top] of WALLS) backing(side > 0 ? x + 2.2 : x - 3.4, side > 0 ? x + 3.4 : x - 2.2, -b, -a, gullyFloor(a) - 9, top - .5, `Gully wall heart ${a}`);
  // Where a slate piece falls back from the gully, a faceted face of the same rock shows behind it, never a flat slab.
  C.push(...cliff({ line: [[x + side * 1.7, -12], [x + side * 1.7, -191]], side, bottom: t => gullyFloor(12 + t) - 8.6, top: t => wallTop(12 + t) - .2, palette: SLATE, relief: .5, batter: .03, seed: side > 0 ? 31 : 37, ice: .08, nm: `Gully wall face ${side > 0 ? 'east' : 'west'}`, grp: G.rock }));
  C.push(...snowCap({ line, side: side > 0 ? 1 : -1, y: t => wallTop(12 + t) - .1, depth: 3.6, height: 1, overhang: .15, seed: side > 0 ? 5 : 2, nm: `Gully wall cap ${side > 0 ? 'east' : 'west'}`, grp: G.rock }));
}
// Far walls of the crevasses (the ones the camera faces): blue ice from the depths to the next floor.
for (const q of CREVASSES) {
  const x0 = q.x0 ?? -HALF, x1 = q.x1 ?? HALF, far = gullyFloor(q.b + .2);
  C.push(...cliff({ line: [[x0, -q.b], [x1, -q.b]], side: -1, bottom: q.y - 8.4, top: far - .2, palette: BLUE_ICE, relief: .32, batter: .02, seed: Math.round(q.a), ice: 0, nm: `${q.nm}: far wall`, grp: G.rock }));
}
for (const side of [-1, 1]) fence(side * (HALF + .2) - .2, side * (HALF + .2) + .2, -191, -12, -2, 30, 'Gully lip fence');

// Kindling Steps · content. Jobs are named per cluster (bible, law 3).
stack(-4, 0, -8, ['wood', 'mystery'], 'Yard stack (teach: top first or the fruit crate drops)'); crate(-4.96, 0, -8, 'wood', 'Yard stack: the step beside it');
fruitLine([0, 0, -10], [0, 1.6, -20], 5); fruitLine([0, 1.6, -22], [0, 1.6, -26], 3);
foe('grunt', 0, 1.6, -29, 3.6, 2.5, 'Snow crab, alone on a wide shelf (debut)');
rowOf(3.5, 1.6, -34, ['wood', 'wood'], 'Pair past the crab (reward)');
fruitLine([0, 1.6, -35.6], [0, 2.5, -38.8], 3, .9);
fruitLine([0, 2.5, -41], [0, 2.5, -47], 4);
rowOf(-.96, 2.5, -50, ['wood', 'mystery', 'wood'], 'Row at the far end of the mill pond (teach: spin while you slide)');
fruitLine([0, 2.5, -56], [0, 2.5, -60], 3);
add({ t: 'stone', p: [0, 2.5, -62.5], axis: 'x', range: 4.5, speed: 4.5, radius: 1.1, tex: 'snow', color: '#e4edf9', grp: G.hazards, nm: 'Boulder in its trough across the gully (debut: stand and watch, cross behind it)' });
fruitLine([0, 2.5, -65.5], [3, 2.5, -70], 3); fruitLine([3, 2.5, -71.4], [3, 2.5, -73.6], 2);
crate(-3, 2.5 + 1.4, -72.5, 'mystery', 'Over the open half of the crevasse, above a spin from either bank (reward for the risk: jump the gap through it)');
rowOf(-4.36, 2.5, -79, ['wood', 'bouncy', 'wood'], 'Arrow crate between two boxes on the runway (teach the tool; break its neighbours first and it is still there)');
// The pair hangs 8.3 m over the runway: past a floor double jump (7.5 m to the top of the hair), inside the arrow's
// bounce with a double jump at its top (9.5 m) or with Jump held on the arrow (9.9 m). Both are what the adit asks later.
stack(-3.4, 2.5 + 8.3, -79, ['wood', 'mystery'], 'The pair only the arrow reaches (teach: double jump at the top of the bounce)');
for (const dy of [3, 4.6, 6.2]) fruit(-3.4, 2.5 + dy, -79);
fruitLine([0, 2.5, -84.6], [0, 2.5, -88.6], 5, 1.8);
stack(3.8, 2.5, -95, ['wood', 'wood', 'mystery'], 'Stack on the first landing (marks the landing; the double jump reaches its top)');
fruitLine([0, 2.5, -99.6], [0, 5, -105], 4); fruitLine([0, 5, -107], [0, 5, -113], 4); fruitLine([0, 5, -115.6], [0, 5, -119.4], 5, 1.7);
rowOf(3.6, 5, -127, ['tnt', 'wood'], 'TNT with one box beside it on the powder landing (debut: the whole west half is the refuge)');
fruitLine([0, 5, -131.6], [0, 7, -137], 4);
foe('spiker', 0, 7, -141.5, 3, 2.5, 'Bristleback, alone on a wide shelf (debut: do not stomp; seven clear metres between its beat and the pillar field)');
stack(-4.2, 7, -148.6, ['wood', 'mask'], 'Mask on a box before the pillar field');
fruitLine([0, 7, -150.6], [0, 7.5, -154.4], 4, 1.4); fruitLine([0, 7.5, -157], [0, 8, -160.8], 4, 1.4); fruitLine([0, 8, -163.5], [0, 8.5, -167.4], 4, 1.4);
foe('grunt', 0, 8.5, -169.2, 1.5, 1.6, 'Snow crab on the third pillar (occupied landing: spin as you land)');
for (const dy of [0, CR]) rowOf(-3.9, 9.4 + dy, -178, ['wood', 'wood'], dy ? 'Lookout block, upper tier' : 'Lookout block (reward after the pillar field)');
rowOf(4.3, 9.4, -176.2, ['nitro', 'nitro'], 'Nitro by the east wall of the lookout shelf (debut, on foot and at rest: look, do not touch)', true);
fruitLine([0, 9.4, -184.4], [0, CREST_Y, -189], 3);
crate(-.96, CREST_Y, -CREST_S, 'wood', 'Flanking the crest checkpoint, west'); crate(.96, CREST_Y, -CREST_S, 'wood', 'Flanking the crest checkpoint, east');
stack(3.4, CREST_Y, -191.6, ['wood', 'mystery'], 'Behind the crest checkpoint, toward the camera (count trap at an attractor)');

// ───────────────────────────── The two runs ─────────────────────────────
const RUN1 = new Path('First Tracks', 0, -206, 0,
  [{ len: 50 }, { turn: -90, r: 40 }, { len: 60 }, { turn: 90, r: 40 }, { len: 80 }, { turn: 90, r: 40 }, { len: 60 }, { turn: -90, r: 40 }, { len: 60 }],
  profile([[0, CREST_Y], [8, 10.3], [50, 5.2], [113, 3.6], [173, 2.2], [236, .6], [316, -3.2], [379, -4.6], [439, -6.2], [502, -7.4], [545, -8], [561.4, -8]]));
const TARN_Y = -8, SUMMIT_Y = 28;
const RUN2 = new Path('Powderkeg Run', -30, -614, 90,
  [{ len: 90 }, { turn: 90, r: 44 }, { len: 130 }, { turn: -45, r: 50 }, { turn: 45, r: 50 }, { len: 110 }, { turn: 45, r: 50 }, { turn: -45, r: 50 }, { len: 100 }],
  profile([[0, SUMMIT_Y], [14, 27.8], [90, 26.5], [159, 21], [289, 11], [368, 6], [478, -3], [556, -8.5], [640, -12], [656.2, -12]]));
const CLIMB = new Path('Kindling Steps', 0, 0, 0, [{ len: CREST_S + 9 }],
  profile([[0, 3.2], [12, 4.4], [37, 5.2], [99, 6], [131, 8.4], [151, 10.4], [191, 13], [206, CREST_Y + 1.2]]));
const finish = RUN2.at(RUN2.length), FINISH: P3 = [r3(finish.x), -12, r3(finish.z)];

// Run features that shape the ground: crevasses to ollie and level troughs for the boulders to roll in.
const RUN_HALF = 6.5, BANK_RUN = 3.5;
// The first crevasse on a board takes only the left half of the piste: the right half rides straight on beside it.
const RUN1_GAPS: Gap[] = [{ a: 404, b: 410, depth: 7, lat1: 0 }];
const RUN2_GAPS: Gap[] = [{ a: 244, b: 253, depth: 8 }, { a: 452, b: 461, depth: 8 }, { a: 596, b: 607, depth: 9 }];
interface Trough { path: Path; s: number; centre: number; range: number; speed: number; radius: number; nm: string; }
const TROUGHS: Trough[] = [
  // Every trough sits a second and a half of clear straight past the bend before it.
  { path: RUN1, s: 270, centre: 0, range: 8.4, speed: 5, radius: 1.2, nm: 'First boulder on the board: a second and a half of straight to read it from' },
  { path: RUN1, s: 301, centre: 0, range: 8.4, speed: 6.5, radius: 1.2, nm: 'Second boulder, quicker' },
  { path: RUN2, s: 200, centre: -4.2, range: 3.6, speed: 5, radius: 1.2, nm: 'Twin boulders rolling in step, left: the clear lane between them moves' },
  { path: RUN2, s: 200, centre: 4.2, range: 3.6, speed: 5, radius: 1.2, nm: 'Twin boulders rolling in step, right' },
  { path: RUN2, s: 424, centre: 0, range: 8.4, speed: 8, radius: 1.3, nm: 'Fast boulder before the crate bridge' },
];
const troughRect = (t: Trough): [number, number, number, number] => {
  const f = t.path.at(t.s), reach = RUN_HALF + 4.2, along = 1.9;
  const xs = [-1, 1].flatMap(a => [-1, 1].map(b => f.x + f.fx * along * a + f.rx * reach * b)), zs = [-1, 1].flatMap(a => [-1, 1].map(b => f.z + f.fz * along * a + f.rz * reach * b));
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
};
const troughCarves: Carve[] = TROUGHS.map(t => { const [x0, z0, x1, z1] = troughRect(t); return rectPad(x0, z0, x1, z1, t.path.elev(t.s), 2.4, 'piste'); });

// ───────────────────────────── The mountain ─────────────────────────────
const knolls: Knoll[] = [];
const flank = (path: Path, from: number, to: number, every: number, lat: number, rise: number, r: number, sides: readonly number[] = [-1, 1]) => {
  for (let s = from; s <= to; s += every) for (const side of sides) { const f = path.at(s); knolls.push({ x: f.x + f.rx * lat * side, z: f.z + f.rz * lat * side, y: f.y + rise, r }); }
};
flank(CLIMB, 0, 200, 40, 26, 1.5, 22);
flank(CLIMB, 0, 200, 50, 70, 9, 36);
flank(RUN1, 0, RUN1.length, 36, 30, 5, 24);
flank(RUN1, 0, RUN1.length, 60, 75, 13, 40);
flank(RUN2, 100, RUN2.length, 36, 30, 5, 24);
flank(RUN2, 100, RUN2.length, 60, 80, 12, 40);
flank(RUN2, 0, 90, 30, 26, -9, 22); // the summit ridge falls away on both sides
knolls.push(
  { x: 0, z: 46, y: -5, r: 34 }, { x: 0, z: 0, y: 1, r: 22 },
  { x: 0, z: -578, y: TARN_Y, r: 30 }, { x: 60, z: -640, y: 38, r: 34 }, { x: 130, z: -650, y: 52, r: 44 }, { x: -20, z: -650, y: 33, r: 30 },
  { x: -70, z: -640, y: 22, r: 26 }, { x: 150, z: -600, y: 30, r: 36 }, { x: -90, z: -540, y: 16, r: 30 }, { x: FINISH[0], z: FINISH[2] + 60, y: -16, r: 34 },
);
const mountain = new Mountain({
  knolls, rough: 6,
  carves: [
    bed(CLIMB, { half: HALF + 3, bank: 0, bankRun: 1, blend: 13, kind: 'snow', from: 12, to: CREST_S - 6 }),
    bed(RUN1, { half: RUN_HALF, bank: 1.4, bankRun: BANK_RUN, blend: 15, cup: .2, gaps: RUN1_GAPS }),
    bed(RUN2, { half: RUN_HALF, bank: 1.4, bankRun: BANK_RUN, blend: 15, cup: .2, gaps: RUN2_GAPS }),
    ...troughCarves,
    rectPad(-HALF - 3, -191, HALF + 3, -12, undefined),
    pad(0, 2, 15, 15, 0, 12),
    pad(0, -CREST_S, 10, 10, CREST_Y, 9),
    pad(0, -578, 31, 27, TARN_Y, 12),
    rectPad(-42, -627, 110, -602.5, undefined),
    pad(-28, -614, 14, 12.6, SUMMIT_Y, 8),
    // Level snow lies along the whole foot of the headwall: sheer against the rock (the summit's skirt must never drape
    // down the cliff), melting back into the mountain to the south and at both ends. The slopes draw it; the part the
    // walker can reach belongs to the shore patch.
    // East of the hoist the ledge fronts stand back from the mask's edge, so there the level snow runs on under the
    // lower row: no slope tile may climb from the shore to the mountain's own height in front of the ledges.
    (x, z) => {
      const north = x < -6 ? -602.4 : -612; if (z < north && x <= 110) return null;
      const edge = Math.hypot(Math.max(-44 - x, 0, x - 112), Math.max(0, z + 586, north - z));
      return edge > 12 ? null : { y: TARN_Y, w: edge <= 0 ? 1 : 1 - smooth(edge / 12), cover: 0, kind: 'snow' };
    },
    rectPad(-33, -602.4, 33, -591, TARN_Y, 0, 'path'),
    pad(FINISH[0], FINISH[2] + 10, 13, 18, FINISH[1], 10),
  ],
});
const BOUNDS = { x0: -250, z0: -690, x1: 200, z1: 60 };
const lats = () => [-(RUN_HALF + BANK_RUN + .9), -(RUN_HALF + BANK_RUN), -(RUN_HALF + BANK_RUN * .5), -RUN_HALF, -RUN_HALF * .5, 0, RUN_HALF * .5, RUN_HALF, RUN_HALF + BANK_RUN * .5, RUN_HALF + BANK_RUN, RUN_HALF + BANK_RUN + .9];
C.push(...pisteMeshes(mountain, RUN1, 0, RUN1.length, lats, { nm: 'First Tracks piste', grp: G.ground, gravityTrack: true, tex: 'snow', gaps: RUN1_GAPS }));
C.push(...pisteMeshes(mountain, RUN2, 0, RUN2.length, lats, { nm: 'Powderkeg Run piste', grp: G.ground, gravityTrack: true, tex: 'snow', gaps: RUN2_GAPS }));
for (const t of TROUGHS) {
  const [x0, z0, x1, z1] = troughRect(t), f = t.path.at(t.s), acrossX = Math.abs(f.rx) > .5, c = t.path.w(t.s, t.centre);
  C.push(...padMeshes(mountain, x0 - 1.2, z0 - 1.2, x1 + 1.2, z1 + 1.2, 1.1, { nm: `Boulder trough ${t.path.name} ${t.s}`, grp: G.ground, tex: 'snow' }));
  add({ t: 'stone', p: [c[0], r3(t.path.elev(t.s)), c[2]], ...(acrossX ? { axis: 'x' as const } : {}), range: t.range, speed: t.speed, radius: t.radius, tex: 'snow', color: '#e4edf9', grp: G.hazards, nm: t.nm });
}
for (const [path, gaps] of [[RUN1, RUN1_GAPS], [RUN2, RUN2_GAPS]] as const) for (const g of gaps) {
  const reach = RUN_HALF + BANK_RUN + 2, corners = [g.a, g.b].flatMap(st => [Math.max(-reach, (g.lat0 ?? -reach) + .5), Math.min(reach, (g.lat1 ?? reach) - .5)].map(lat => path.w(st, lat)));
  kill(Math.min(...corners.map(q => q[0])), Math.max(...corners.map(q => q[0])), Math.min(...corners.map(q => q[2])), Math.max(...corners.map(q => q[2])), path.elev((g.a + g.b) / 2) - 3.2, `${path.name}: crevasse ${g.a}`);
}
C.push(...padMeshes(mountain, -17, -14, 17, 19, 1.6, { nm: 'Lodge yard', grp: G.ground, tex: 'snow' }));
C.push(...padMeshes(mountain, -11, -208, 11, -188, 1.6, { nm: 'First crest', grp: G.ground, tex: 'snow' }));
C.push(...padMeshes(mountain, -33, -602.4, 33, -552, 2, { nm: 'Tarn shore', grp: G.ground, tex: 'snow' }));
C.push(...padMeshes(mountain, -44, -626, -14, -602.7, 1.6, { nm: 'Summit', grp: G.ground, tex: 'snow' }));
C.push(...padMeshes(mountain, FINISH[0] - 14, FINISH[2] - 8, FINISH[0] + 14, FINISH[2] + 28, 1.6, { nm: 'Powder works yard', grp: G.ground, tex: 'snow' }));
const routes = [CLIMB, RUN1, RUN2];
const nearRoute = (x: number, z: number): boolean => routes.some(path => path.nearest(x, z, 85) !== null) || (Math.abs(x - 34) < 120 && z < -520 && z > -690);
C.push(...slopeMeshes(mountain, BOUNDS.x0, BOUNDS.z0, BOUNDS.x1, BOUNDS.z1, 3.6, { nm: 'Slopes', grp: G.slopes, tex: 'snow', wanted: nearRoute }));
// Piste bounds: a tall unseen fence along each bank crest.
for (const path of [RUN1, RUN2]) for (const side of [-1, 1]) for (let from = 0; from < path.length; from += 120) {
  const to = Math.min(path.length, from + 120), origin = path.w(from, side * (RUN_HALF + 2.4)), pts: [number, number, number, number][] = [];
  for (let s = from; s <= to + .01; s += 6) { const q = path.w(Math.min(s, to), side * (RUN_HALF + 2.4)); pts.push([r3(q[0] - origin[0]), r3(q[2] - origin[2]), 0, r3(q[1] - origin[1])]); }
  add({ t: 'wallpath', p: origin, pts, w: .5, rise: 9, collisionHeight: 9, containment: true, invisible: true, grp: G.bounds, nm: `${path.name}: bank fence` });
}

// ───────────────────────────── Run content ─────────────────────────────
/** A point on a run's snow: station, metres right of the centreline, lift above the ground. */
const on = (path: Path, s: number, lat = 0, dy = 0): P3 => { const q = path.w(s, lat); return [q[0], r3(mountain.y(q[0], q[2]) + dy), q[2]]; };
const runStack = (path: Path, s: number, lat: number, kinds: readonly Kind[], nm: string) => { const q = on(path, s, lat, -.03); stack(q[0], q[1], q[2], kinds, nm); };
const runFruit = (path: Path, s0: number, s1: number, lat0: number, lat1: number, n: number, rise = 0) => {
  for (let i = 0; i < n; i++) { const t = n === 1 ? .5 : i / (n - 1), q = on(path, s0 + (s1 - s0) * t, lat0 + (lat1 - lat0) * t); fruit(q[0], q[1] + Math.sin(t * Math.PI) * rise, q[2]); }
};
/** A straight grind rail between two stations of a run, `lift` above the snow at each end. */
const runRail = (path: Path, s0: number, s1: number, lat: number, lift: number, nm: string): CustomComponent => {
  const a = on(path, s0, lat, lift), b = on(path, s1, lat, lift);
  railPosts.push({ path, s0, s1, lat, lift });
  return add({ t: 'rail', p: a, pts: [[0, 0, 0, 0], [r3(b[0] - a[0]), r3(b[2] - a[2]), 0, r3(b[1] - a[1])]], grp: G.course, nm });
};
const railPosts: { path: Path; s0: number; s1: number; lat: number; lift: number }[] = [];
const runNitro = (path: Path, s: number, side: -1 | 1, nm: string) => { for (const lat of [4.5, 5.46]) { const q = on(path, s, side * lat); crate(q[0], q[1], q[2], 'nitro', nm); } };

// First Tracks. One decision every second or two at 23 m/s. Speed is the key to every box on a run: below 12.5 m/s a
// crate trips the board, and a checkpoint is a box like any other. So each checkpoint closes its crate group rather
// than opening one: a rider who restarts there has clear snow in which to get going again.
runFruit(RUN1, 8, 40, 0, 0, 6);
runStack(RUN1, 46, 0, ['wood', 'wood'], 'First stack, dead ahead at the foot of the first pitch (teach: a board at speed smashes a whole stack)');
runFruit(RUN1, 56, 88, -1.5, 3, 5);
runStack(RUN1, 96, 3, ['wood', 'wood', 'wood'], 'Tall stack on the inside of the first bend (one contact clears it)');
runFruit(RUN1, 103, 118, 3, -2.6, 3);
runStack(RUN1, 124, -2.6, ['wood', 'wood'], 'Slalom, left');
runFruit(RUN1, 130, 146, -2.6, 2.6, 4);
runStack(RUN1, 152, 2.6, ['wood', 'mystery'], 'Slalom, right (it leaves the rider on the far side from the Nitro)');
runNitro(RUN1, 168, -1, 'Nitro on the left edge of the straight (debut on a board: beside the line, in view for the whole straight)');
runFruit(RUN1, 160, 178, 2.6, 0, 4); runFruit(RUN1, 184, 198, -.6, -2.8, 3);
runStack(RUN1, 204, -2.8, ['wood', 'wood', 'wood'], 'Tall stack at the apex of the second bend');
runFruit(RUN1, 211, 232, -2.8, 0, 4); runFruit(RUN1, 240, 258, 0, 0, 4); runFruit(RUN1, 280, 292, 0, 0, 3);
runFruit(RUN1, 310, 318, 0, -1.2, 3);
runStack(RUN1, 322, -1.2, ['wood', 'wood', 'mystery'], 'Tall stack past the boulders (the group the checkpoint closes)');
runFruit(RUN1, 346, 372, -1.2, 1.5, 5);
// The half crevasse: ride on down the right, ollie it for the tall stack, or grind the log across it.
runFruit(RUN1, 384, 399, .4, -1.5, 3); runFruit(RUN1, 402.5, 411.5, -1.5, -1.5, 5, 1.3);
runRail(RUN1, 396, 420, -3.7, .55, 'Log rail over the half crevasse (the other way across)');
runFruit(RUN1, 398, 418, -3.7, -3.7, 5);
runStack(RUN1, 433, -2.6, ['wood', 'wood', 'mystery'], 'Tall stack where the jump and the grind meet again (either way across pays; the fruit differs)');
runFruit(RUN1, 440, 456, -1, 2.6, 4);
runStack(RUN1, 462, 2.6, ['wood', 'wood', 'wood'], 'Tall stack on the inside of the last bend');
runFruit(RUN1, 469, 489, 2.6, -2.4, 4);
runStack(RUN1, 496, -2.8, ['wood', 'wood'], 'Run-out stack, left'); runStack(RUN1, 520, 2.8, ['wood', 'mystery'], 'Run-out stack, right (a second of travel after the left, and before anyone brakes for the shore)');
runFruit(RUN1, 538, 554, 0, 0, 3);

// Powderkeg Run: everything the mountain has taught, at speed.
runFruit(RUN2, 6, 30, 0, 0, 5);
runStack(RUN2, 40, -.48, ['wood', 'wood'], 'Block to ram through at the mount (charge: the ridge is level, so only a held push reaches smashing speed)');
runStack(RUN2, 40, .48, ['wood', 'mask'], 'Block at the mount: the mask in it');
runRail(RUN2, 52, 84, 3.2, .6, 'Ridge fence rail');
runFruit(RUN2, 54, 82, 3.2, 3.2, 6);
foe('floater', on(RUN2, 68, 3.2)[0], on(RUN2, 68, 3.2)[1], on(RUN2, 68, 3.2)[2], 8, 3, 'Watcher over the ridge rail (spin from the grind)');
runFruit(RUN2, 92, 104, 3.2, 3.2, 3);
runStack(RUN2, 110, 3.2, ['wood', 'wood', 'mystery'], 'Tall stack beyond the ridge rail, where the face has given the board its speed');
runFruit(RUN2, 117, 136, 3.2, -2.4, 4);
runStack(RUN2, 142, -2.4, ['wood', 'wood', 'wood'], 'Tall stack on the inside of the long bend');
runFruit(RUN2, 150, 176, -2.4, 0, 4);
runFruit(RUN2, 212, 236, 0, 0, 4); runFruit(RUN2, 242.5, 254.5, 0, 0, 6, 1.5);
runStack(RUN2, 270, 0, ['wood', 'wood', 'mystery'], 'Tall stack dead ahead of the landing (the group the checkpoint closes)');
runNitro(RUN2, 312, 1, 'Nitro on the inside of the first chicane bend');
runFruit(RUN2, 296, 326, -1, -2.6, 5); runFruit(RUN2, 332, 362, 2.6, 0, 5);
runNitro(RUN2, 346, -1, 'Nitro on the inside of the second chicane bend');
runStack(RUN2, 372, 0, ['wood', 'wood', 'wood'], 'Tall stack out of the chicane (the group the checkpoint closes)');
runFruit(RUN2, 394, 412, 0, 0, 3);
{ // One-way grind bridge: a crate row at deck height across the second crevasse. Ridden, it is consumed behind the rider.
  const lip = on(RUN2, 452, -3.6), far = on(RUN2, 461, -3.6), n = 8, z0 = (lip[2] + far[2]) / 2 + (n - 1) / 2 * CR;
  rowOf(lip[0], lip[1] - .3 - 1.152, z0, ['wood', 'wood', 'wood', 'mystery', 'wood', 'wood', 'wood', 'wood'], 'Crate bridge over the crevasse', true);
}
runFruit(RUN2, 450.5, 462.5, 2, 2, 6, 1.5);
// Third rung of the Nitro ladder: both edges at once, a stride apart, and the lane is the middle.
runNitro(RUN2, 494, -1, 'Nitro gate in the last chicane, left'); runNitro(RUN2, 503, 1, 'Nitro gate in the last chicane, right');
runFruit(RUN2, 472, 488, 0, 0, 3); runFruit(RUN2, 508, 526, 0, 0, 4);
runStack(RUN2, 534, 0, ['wood', 'wood', 'wood'], 'Tall stack before the last checkpoint (the group the checkpoint closes)');
runFruit(RUN2, 594.5, 608.5, 0, 0, 7, 1.6);
runStack(RUN2, 617, 0, ['wood', 'wood', 'mystery'], 'Tall stack dead ahead of the landing past the long gap');
stack(FINISH[0] - 4.6, FINISH[1], FINISH[2] + 8, ['wood', 'mystery'], 'Works yard stack'); crate(FINISH[0] - 3.64, FINISH[1], FINISH[2] + 8, 'wood', 'Works yard stack: the step beside it');

// ───────────────────────────── The tarn and the hoist ─────────────────────────────
add({ t: 'platform', p: [0, TARN_Y - .13, -582], s: [34, .3, 22], pts: [[-17, -11, 9], [17, -11, 9], [17, 11, 9], [-17, 11, 9]], tex: 'ice', color: ICE, slip: true, edgeGrinding: false, grp: G.ground, nm: 'Tarn ice' });
for (const dx of [0, CR]) rowOf(-.48 + dx, TARN_Y + .17, -581.5, ['wood', 'wood'], 'Block in the middle of the tarn ice (slide and spin)', true);
foe('floater', 5.5, TARN_Y, -596.5, 3.5, 2, 'Watcher over the north shore by the hoist (debut on foot, on firm snow with room: spin, never stomp)');
const ROW_A = -606, ROW_B = -614, A0_Y = 6;
block(-6, -.4, ROW_A - 1.4, ROW_A + 3.6, TARN_Y - .62, 1.2, 'Hoist pit floor: nothing to fall into under a risen deck', { tex: 'plank', color: '#8d6c46', edgeGrinding: false });
add({ t: 'mover', p: [-3, r3((TARN_Y + A0_Y) / 2), ROW_A + 1], s: [4, .6, 4], axis: 'y', amp: (A0_Y - TARN_Y) / 2, speed: .7, phase: -Math.PI / 2, tex: 'plank', color: '#b98f5e', grp: G.hazards, nm: 'The hoist: rises fourteen metres to the lower ledge row' });

// ───────────────────────────── S3 · The Headwall ─────────────────────────────
// Side-on. Row A runs east along z = ROW_A, row B west along z = ROW_B, eight metres behind and above it.
interface Ledge { x0: number; x1: number; y: number; ice?: boolean; crumble?: boolean; /** A shelf pinned to the wall rather than a column from the floor. */ shelf?: boolean; nm: string; }
const ROW_A_LEDGES: Ledge[] = [
  { x0: -1, x1: 26, y: 6, nm: 'Hoist landing and the first stamper' },
  { x0: 28.6, x1: 38, y: 7, nm: 'Bristleback ledge' },
  { x0: 41, x1: 44.5, y: 8, nm: 'Lone pillar' },
  { x0: 47.7, x1: 66, y: 9, nm: 'Stamper gallery' },
  { x0: 66, x1: 69, y: 9, crumble: true, nm: 'Rotten ice plank (debut: level with both banks)' },
  { x0: 69, x1: 79, y: 9, nm: 'Rest ledge' },
  { x0: 82, x1: 90, y: 10.2, nm: 'Far bank under the stamper' },
  { x0: 91.5, x1: 95.5, y: 12.4, nm: 'Buttress tier one' },
  { x0: 97, x1: 101, y: 14.6, nm: 'Buttress tier two' },
  { x0: 91.5, x1: 95.5, y: 16.8, shelf: true, nm: 'Buttress tier three' },
];
const B0_Y = 19;
const ROW_B_LEDGES: Ledge[] = [
  { x0: 66, x1: 80, y: B0_Y, ice: true, nm: 'Glazed gallery under the stamper' },
  { x0: 59.2, x1: 63.4, y: 19.8, nm: 'Bristleback pillar: its near end is clear to land on' },
  { x0: 53.3, x1: 56.3, y: 20.2, crumble: true, nm: 'Rotten shelf one' },
  { x0: 48.8, x1: 51.8, y: 20.7, crumble: true, nm: 'Rotten shelf two' },
  { x0: 44.3, x1: 47.3, y: 21.2, crumble: true, nm: 'Rotten shelf three' },
  { x0: 31, x1: 43, y: 21.8, nm: 'Switch ledge' },
  { x0: 10, x1: 25.4, y: 22.6, nm: 'Twin stamper gallery, with four metres of floor to read it from' },
  { x0: 3, x1: 6.6, y: 23.6, nm: 'Last pillar' },
  { x0: -14, x1: 0, y: 24.6, nm: 'Summit approach' },
];
const APPROACH_Y = 24.6;
const row = (ledges: readonly Ledge[], z: number, floor: number) => {
  for (const l of ledges) {
    if (l.crumble) { add({ t: 'crumble', p: [r3((l.x0 + l.x1) / 2), l.y, z], s: [r3(l.x1 - l.x0), .5, 4], tex: 'bridge-ice', color: ICE, grp: G.hazards, nm: l.nm }); continue; }
    if (l.shelf) { block(l.x0, l.x1, z - 2, z + 2, l.y, .8, l.nm, { tex: 'bridge-ice', color: '#d9ecf8' }); continue; }
    floorBlock(l.x0, l.x1, z - 2, z + 2, l.y, l.y - floor, l.nm, l.ice);
    slate(l.x0 - .3, l.x1 + .3, z - 2.4, z + 2.15, floor - .5, l.y - .22, Math.round(Math.abs(l.x0)) + (z < -610 ? 1 : 0), `${l.nm}: slate`);
  }
};
row(ROW_A_LEDGES, ROW_A, -12);
row(ROW_B_LEDGES, ROW_B, 4);
floorBlock(80, 90, ROW_B - 2, ROW_A + 2, B0_Y, 3, 'East landing: the turn back west');
slate(79.7, 90.3, ROW_B - 2.3, ROW_A + 2.2, B0_Y - 3.4, B0_Y - .22, 65, 'East landing: slate lip');
// The wall itself: behind row A up to row B's floor, behind row B up to the ridge, and the two end buttresses.
const proxy = { artProxy: true, grp: G.rock, edgeGrinding: false } as const;
block(-8, 30, ROW_A - 6, ROW_A - 2, 20.3, 32.3, 'Headwall behind the lower row, west', proxy);
block(30, 60, ROW_A - 6, ROW_A - 2, 18.1, 30.1, 'Headwall behind the lower row, middle', proxy);
block(60, 104, ROW_A - 6, ROW_A - 2, 17.5, 29.5, 'Headwall behind the lower row, east', proxy);
block(-16, 104, ROW_B - 8, ROW_B - 2, 36, 48, 'Headwall behind the upper row', proxy);
block(104, 110, ROW_B - 8, ROW_A + 3.4, 30, 42, 'East buttress', proxy);
block(-42, -14, ROW_B - 12, ROW_A + 3.4, SUMMIT_Y - .12, 40, 'Summit block', proxy);
block(-14, -6, ROW_A - 6, ROW_A + 3.4, SUMMIT_Y - .12, 40, 'Rock beside the hoist', proxy);
block(90, 104, ROW_B - 2, ROW_B + 2, 30, 42, 'Rock closing the east landing', proxy);
// The headwall as seen: two great faces of slate, the buttresses that close each end, snow along every shelf.
// Kept under the upper row's floors, snow cap and all, so the shelf never hides a walker's feet up there.
const lowerTop = (x: number): number => 17.5 + .6 * Math.max(0, Math.min(1, (62 - x) / 4)) + 2.2 * Math.max(0, Math.min(1, (32 - x) / 4));
for (let x = -9, i = 0; x < 104; x += 23, i++) slate(x, Math.min(105, x + 26), ROW_A - 7.5, ROW_A - 2, -11, Math.max(lowerTop(x), lowerTop(x + 26)) - .15, 40 + i, `Headwall slate, lower ${i + 1}`);
for (let x = -17, i = 0; x < 104; x += 24, i++) slate(x, Math.min(105, x + 27), ROW_B - 9, ROW_B - 2, 12, 36.6 + (i % 2) * 1.2, 50 + i, `Headwall slate, upper ${i + 1}`);
// A second course behind the first, half a piece along, so the clefts of one close on the faces of the other.
for (let x = 3, i = 0; x < 96; x += 23, i++) slate(x, Math.min(104, x + 24), ROW_A - 8, ROW_A - 3.1, -11, Math.max(lowerTop(x), lowerTop(x + 24)) - .5, 70 + i, `Headwall slate, lower second course ${i + 1}`);
for (let x = -5, i = 0; x < 96; x += 24, i++) slate(x, Math.min(104, x + 25), ROW_B - 9.5, ROW_B - 3.1, 12, 35.8, 80 + i, `Headwall slate, upper second course ${i + 1}`);
backing(-8, 30, ROW_A - 6, ROW_A - 4.2, -11, 19.5, 'Headwall heart, lower west'); backing(30, 60, ROW_A - 6, ROW_A - 4.2, -11, 17.3, 'Headwall heart, lower middle'); backing(60, 104, ROW_A - 6, ROW_A - 4.2, -11, 16.7, 'Headwall heart, lower east');
backing(-15.6, 104, ROW_B - 8, ROW_B - 4.2, 12, 35.4, 'Headwall heart, upper');
// In front of each heart, a faceted face of the same slate in shadow: what shows where a rock piece falls back is
// rock, and it stays dark, so the white ledges of both rows read against it.
C.push(...cliff({ line: [[-8, ROW_A - 3.8], [104, ROW_A - 3.8]], side: -1, bottom: -11, top: t => lowerTop(-8 + t) - .9, palette: SLATE_DEEP, relief: .5, batter: .02, seed: 43, ice: 0, nm: 'Headwall face, lower', grp: G.rock }));
C.push(...cliff({ line: [[-16, ROW_B - 8], [-16, ROW_B - 3.8], [104, ROW_B - 3.8]], side: -1, bottom: 12, top: 35.2, palette: SLATE_DEEP, relief: .5, batter: .02, seed: 45, ice: 0, nm: 'Headwall face, upper', grp: G.rock }));
C.push(...snowCap({ line: [[-8, ROW_A - 2], [104, ROW_A - 2]], side: -1, y: t => lowerTop(-8 + t) - .3, depth: 4, height: .7, overhang: .1, seed: 42, nm: 'Headwall shelf snow', grp: G.rock }));
C.push(...snowCap({ line: [[-16, ROW_B - 2], [104, ROW_B - 2]], side: -1, y: 36.2, depth: 6, height: 1.6, overhang: .5, seed: 44, nm: 'Ridge cornice', grp: G.rock }));
slate(104, 111.5, ROW_B - 9, ROW_A + 3.6, -11, 31, 61, 'East buttress slate');
C.push(...snowCap({ line: [[104, ROW_A + 3.4], [104, ROW_B - 8]], side: 1, y: 30.4, depth: 6.5, height: 1.2, seed: 47, nm: 'East buttress cap', grp: G.rock }));
slate(-43, -22, ROW_B - 12, ROW_A + 3.6, -10, SUMMIT_Y - .3, 62, 'Summit block slate, west'); slate(-25, -6, ROW_B - 3, ROW_A + 3.6, -10, SUMMIT_Y - .3, 63, 'Summit block slate, east');
slate(90, 104.5, ROW_B - 2.4, ROW_B + 2.2, 16, 30.6, 64, 'East landing slate');
C.push(...snowCap({ line: [[90, ROW_B + 2], [104, ROW_B + 2]], side: -1, y: 30.2, depth: 4, height: 1, seed: 52, nm: 'East landing cap', grp: G.rock }));
add({ t: 'ramp', p: [-10, APPROACH_Y, ROW_B], len: 8, rise: r3(SUMMIT_Y - APPROACH_Y), w: 4, yaw: 90, tex: 'snow', color: SNOW, grp: G.ground, nm: 'Drift ramp onto the summit' });
// Falls: one sheet under each row, and an unseen fence along each row's open (south) edge.
kill(-1, 104, ROW_A - 2, ROW_A + 2, 1.5, 'Lower row: fall');
kill(-16, 80, ROW_B - 2, ROW_B + 2, 14, 'Upper row: fall');
fence(-1, 104, ROW_A + 2, ROW_A + 2.4, 4, 40, 'Lower row: lip fence');
fence(-16, 80, ROW_B + 2, ROW_B + 2.4, 18, 30, 'Upper row: lip fence');
fence(90, 104, ROW_B + 2, ROW_B + 2.4, 18, 30, 'East landing: lip fence');
add({ t: 'zone', p: [46, 6, ROW_A], s: [108, 1, 8], dir: 'E', grp: G.camera, nm: 'Lower row: side-on, heading east' });
add({ t: 'zone', p: [42, 20, ROW_B], s: [116, 1, 7.98], dir: 'W', grp: G.camera, nm: 'Upper row: side-on, heading west' });

// The Headwall · content.
const SWITCH = 12;
groups.push({ id: SWITCH, nm: 'Switch bridge over the long gap: outlines until the ! fires' });
rowOf(8, 6, ROW_A, ['wood', 'wood'], 'Pair on the hoist landing (open the row)'); crate(8.96, 6 + CR, ROW_A, 'mystery', 'On the hoist landing pair');
stamper(17, 6, ROW_A, 0, 'Ice stamper over solid ledge (debut: eleven metres of floor to watch a full cycle from)');
fruitLine([25.6, 6, ROW_A], [29, 7, ROW_A], 3, 1.2);
foe('spiker', 35.2, 7, ROW_A, 1.8, 2, 'Bristleback patrolling the take-off (the landing end of its ledge stays clear)');
fruitLine([37.6, 7, ROW_A], [41.4, 8, ROW_A], 3, 1.3);
crate(42.75, 8 + 2.3, ROW_A, 'mystery', 'Over the lone pillar (marks the landing; a jump collects it)');
fruitLine([44.2, 8, ROW_A], [48.1, 9, ROW_A], 3, 1.3);
stamper(53, 9, ROW_A, 0, 'Stamper pair, first');
crate(57, 9, ROW_A, 'wood', 'In the pocket between the stampers (one crate per safe window)');
stamper(61, 9, ROW_A, 3.2 - 8 / 9, 'Stamper pair, second: open 0.9 s after the first for a walker who keeps going');
rowOf(70.04, 9, ROW_A - 1.4, ['wood', 'tnt', 'wood'], 'TNT between two boxes at the near end of the rest ledge (test: the far end and its take-off lie outside the blast)');
fruitLine([78.6, 9, ROW_A], [82.4, 10.2, ROW_A], 3, 1.6);
stamper(84.5, 10.2, ROW_A, 0, 'Stamper on the far bank: jump as it rises');
stack(100.2, 14.6, ROW_A, ['wood', 'mystery'], 'At the dead end of the second buttress tier (reward for going the wrong way first)');
stamper(75.5, B0_Y, ROW_B, 2, 'Stamper over glazed ice (invert: you cannot stop under it, so wait on the dry landing and run)', { cycle: 4 });
rowOf(67.3, B0_Y, ROW_B, ['wood', 'wood'], 'On the ice by the far lip (bait: the slide carries you at the gap)');
foe('spiker', 60.6, 19.8, ROW_B, .7, 1.4, 'Bristleback on the far half of the landing pillar: land short and spin, or spin as you land');
// The mask waits on the far side of the crate bridge: a third mask smashes every box it touches, the bridge included.
stack(23.8, 22.6, ROW_B - 1.4, ['wood', 'mask'], 'Mask on a box at the end of the bridge, before the twin stampers');
rowOf(36.04, 21.8, ROW_B - 1.4, ['nitro', 'life', 'nitro'], 'Life framed by Nitro against the wall: only from above');
crate(31.9, 21.8, ROW_B - 1.4, 'bang', 'Switch by the lip, against the wall, three clear metres from the Nitro: it builds the crate bridge', { grp: SWITCH });
rowOf(28.2 - 2 * CR, 21.8 - 1.152, ROW_B, ['wood', 'wood', 'mystery', 'wood', 'wood'], 'Switch bridge', false, { grp: SWITCH, outline: true });
stamper(19.5, 22.6, ROW_B, 0, 'Twin stampers, first');
foe('grunt', 16.5, 22.6, ROW_B, .7, 1.4, 'Snow crab in the pocket between the twin stampers (arrive spinning)');
stamper(13.5, 22.6, ROW_B, 1.6, 'Twin stampers, second: half a cycle off, so the pocket is a stop');
stack(-3.5, APPROACH_Y, ROW_B, ['wood', 'wood', 'wood'], 'Tower on the summit approach (the double jump reaches its top)');

// ───────────────────────────── The Old Adit · the gem route ─────────────────────────────
// A mine door in the headwall above the east landing, where the two ledge rows meet: by then the lower row has taught
// every piece the adit recombines. Only the steel arrow in the landing's corner reaches its sill, 8.6 m up (arrow,
// double jump, grab: 9.0 m): a floor double jump with a grab falls short (7.0 m), even off a stomped box (8.1 m). Inside, a detached ice gallery
// carries the hard versions (ice with Nitro beside the slide, rotten shelves, quick twin stampers, a committed gap
// onto an occupied pillar, an arrow climb) to the blue gem. No checkpoint stands inside, so the mountain's restart
// point never moves into the adit; a ring by the entrance leads back out, as does the ring past the gem. Its boxes
// are not needed to finish. (A portal's box starts at its base, so each base sits a little under the floor it serves.)
const DOOR: P3 = [84.5, r3(B0_Y + 8.6), ROW_B - 1.5], CAVE_X = 500, CAVE_Z = 0, ADIT_BACK: P3 = [86, r3(B0_Y + .14), ROW_B + 4];
block(82, 87, ROW_B - 2, ROW_B + .6, DOOR[1], .45, 'Adit door sill', { tex: 'plank', color: '#a98558' });
block(83, 86, ROW_B - 2.3, ROW_B - 1.95, DOOR[1] + 3.3, 3.3, 'Adit door: the dark of the tunnel', { tex: 'solid', color: '#0d0f18', edgeGrinding: false, grp: G.rock });
const ARROW: P3 = [88.7, B0_Y, ROW_B - .7];
crate(ARROW[0], ARROW[1], ARROW[2], 'metalbounce', 'Steel arrow in the corner of the east landing, under the adit door (the tool: it cannot be smashed or spent)');
for (const dy of [2.2, 3.8, 5.4, 7]) fruit(ARROW[0], B0_Y + dy, ARROW[2]);
add({ t: 'returnportal', p: [DOOR[0], r3(DOOR[1] - .3), DOOR[2]], s: [3, 3.3, .9], yaw: 0, to: [CAVE_X + 2.5, .12, CAVE_Z], exitYaw: 270, artProxy: true, grp: G.course, nm: 'Into the Old Adit' });
interface Shelf { x0: number; x1: number; y: number; ice?: boolean; crumble?: boolean; nm: string; }
// 8.5 m above the arrow floor: past a double jump and a grab even from a stomped box (8.14 m), inside a plain bounce
// off the arrow with a double jump and a grab (9.0 m), and well inside one with Jump held on the arrow.
const GEM_Y = 12.9;
const ADIT: Shelf[] = [
  { x0: 0, x1: 10, y: 0, nm: 'Adit landing' },
  { x0: 13.2, x1: 23, y: .8, ice: true, nm: 'Glazed drift, Nitro by the wall' },
  { x0: 26.2, x1: 29.2, y: 1.6, crumble: true, nm: 'Rotten shelf, first' },
  { x0: 31, x1: 34, y: 2.2, crumble: true, nm: 'Rotten shelf, second' },
  { x0: 35.8, x1: 54.6, y: 2.8, nm: 'Quick stamper gallery: sound floor to read it from, and a run-up beyond it' },
  { x0: 58.6, x1: 63.6, y: 3.6, nm: 'Bristleback pillar past the wide gap' },
  { x0: 66.6, x1: 74.2, y: 4.4, nm: 'Arrow floor' },
  { x0: 74.7, x1: 86, y: GEM_Y, nm: 'Gem shelf' },
];
const ADIT_LEN = 86;
for (const q of ADIT) {
  const x0 = CAVE_X + q.x0, x1 = CAVE_X + q.x1;
  if (q.crumble) { add({ t: 'crumble', p: [r3((x0 + x1) / 2), q.y, CAVE_Z], s: [r3(x1 - x0), .5, 4], tex: 'bridge-ice', color: ICE, grp: G.hazards, nm: q.nm }); continue; }
  block(x0, x1, CAVE_Z - 2, CAVE_Z + 2, q.y, SLAB, q.nm, q.ice ? { tex: 'ice', color: ICE, slip: true } : { tex: 'plank', color: '#b08a5c' });
  block(x0, x1, CAVE_Z - 2, CAVE_Z + 2, q.y - SLAB, q.y + 6 - SLAB, `${q.nm}: body`, { artProxy: true, edgeGrinding: false, grp: G.rock });
  C.push(...cliff({ line: [[x0, CAVE_Z - 2], [x0, CAVE_Z + 2], [x1, CAVE_Z + 2], [x1, CAVE_Z - 2]], side: -1, bottom: -6.4, top: q.y - .4, palette: BLUE_ICE, relief: .3, batter: .02, seed: Math.round(q.x0) + 5, ice: 0, nm: `${q.nm}: ice column`, grp: G.rock }));
}
// The gallery itself: a wall of blue ice behind, a roof that keeps the sun out, dark floor far below, pit props along the wall.
const CAVE_TOP = 24.4;
block(CAVE_X - 8, CAVE_X + ADIT_LEN + 8, CAVE_Z - 7, CAVE_Z - 2.6, CAVE_TOP - 2, CAVE_TOP + 6, 'Adit: ice wall heart', { tex: 'solid', color: '#1c3a66', edgeGrinding: false, grp: G.rock });
block(CAVE_X - 8, CAVE_X + ADIT_LEN + 8, CAVE_Z - 7, CAVE_Z + 3.4, CAVE_TOP, 2.4, 'Adit: roof', { tex: 'solid', color: '#16294a', edgeGrinding: false, grp: G.rock });
block(CAVE_X - 8, CAVE_X + ADIT_LEN + 8, CAVE_Z - 7, CAVE_Z + 3.4, -6.4, 1.6, 'Adit: the dark below', { tex: 'solid', color: '#0e1a33', edgeGrinding: false, grp: G.rock });
for (const x of [CAVE_X - 8, CAVE_X + ADIT_LEN + 5.6]) block(x, x + 2.4, CAVE_Z - 7, CAVE_Z + 3.4, CAVE_TOP - 2, CAVE_TOP + 6, 'Adit: end wall', { tex: 'solid', color: '#1c3a66', edgeGrinding: false, grp: G.rock });
C.push(...cliff({ line: [[CAVE_X - 6, CAVE_Z - 2.4], [CAVE_X + ADIT_LEN + 6, CAVE_Z - 2.4]], side: -1, bottom: -6.4, top: CAVE_TOP - 2.2, palette: BLUE_ICE, relief: .75, batter: 0, seed: 77, ice: 0, nm: 'Adit: ice wall', grp: G.rock }));
{
  const props = new Timber('Adit pit props', G.scenery);
  for (let x = CAVE_X + 5; x < CAVE_X + ADIT_LEN + 3; x += 9.5) { const base = -6.4; props.beam([x, base, CAVE_Z - 2.1], [x, 19, CAVE_Z - 2.1], .34); props.beam([x - 1.2, 19, CAVE_Z - 2.1], [x + 1.2, 19, CAVE_Z - 2.1], .3); }
  // The door in the headwall: jambs, a lintel, and the struts that carry its sill.
  for (const dx of [-1.75, 1.75]) props.beam([DOOR[0] + dx, DOOR[1] - .1, ROW_B - 1.9], [DOOR[0] + dx, DOOR[1] + 3.4, ROW_B - 1.9], .3);
  props.beam([DOOR[0] - 2.1, DOOR[1] + 3.5, ROW_B - 1.9], [DOOR[0] + 2.1, DOOR[1] + 3.5, ROW_B - 1.9], .34);
  for (const x of [82.4, 84.5, 86.6]) { props.beam([x, DOOR[1] - .5, ROW_B - 1.9], [x, DOOR[1] - .5, ROW_B + .5], .22); props.beam([x, DOOR[1] - 2.6, ROW_B - 1.9], [x, DOOR[1] - .55, ROW_B + .3], .18); }
  // The old ladder to the sill, broken off well above the landing: the eye is led up, and the feet must find another way.
  for (const x of [83.05, 83.75]) props.beam([x, DOOR[1] - 4.4 - (x > 83.4 ? .5 : 0), ROW_B - 1.85], [x, DOOR[1] - .5, ROW_B - 1.85], .12);
  for (let y = DOOR[1] - 1; y > DOOR[1] - 4.3; y -= .55) props.beam([83.05, y, ROW_B - 1.85], [83.75, y, ROW_B - 1.85], .09);
  C.push(...props.done());
}
kill(CAVE_X - 6, CAVE_X + ADIT_LEN + 6, CAVE_Z - 2.6, CAVE_Z + 2.6, -3.4, 'Adit: fall');
fence(CAVE_X - 6, CAVE_X + ADIT_LEN + 6, CAVE_Z + 2, CAVE_Z + 2.4, -4, 32, 'Adit: lip fence');
add({ t: 'zone', p: [CAVE_X + ADIT_LEN / 2, 0, CAVE_Z], s: [ADIT_LEN + 14, 1, 8], dir: 'E', grp: G.camera, nm: 'Old Adit: side-on, heading east' });
add({ t: 'camnode', p: [CAVE_X + ADIT_LEN / 2, 8, CAVE_Z - 2], s: [ADIT_LEN + 20, 40, 16], cameraView: true, cameraPresentationOnly: true, cameraPosition: [CAVE_X + ADIT_LEN / 2, 8, CAVE_Z + 22], cameraTarget: [CAVE_X + ADIT_LEN / 2, 5.4, CAVE_Z],
  cameraFollowDistance: 16.5, cameraKeepDistance: true, cameraFollowTargetHeight: 2.3, cameraFov: 52, cameraAspect: 16 / 9, radius: 3, grp: G.camera, nm: 'Old Adit: side view' });
// Adit content.
add({ t: 'returnportal', p: [CAVE_X + .7, -.3, CAVE_Z], s: [.9, 3.3, 3], yaw: 0, to: ADIT_BACK, exitYaw: 0, grp: G.course, nm: 'Back out to the east landing (for anyone who has seen enough)' });
rowOf(CAVE_X + 6.6, 0, CAVE_Z - 1.4, ['wood', 'wood'], 'Pair on the adit landing, against the wall (open the route)');
rowOf(CAVE_X + 17, .8, CAVE_Z - 1.4, ['wood', 'mystery'], 'Pair on the glazed drift, against the wall (bait: the slide carries a spin on toward the Nitro)');
crate(CAVE_X + 21.5, .8, CAVE_Z - 1.4, 'nitro', 'Nitro by the wall near the end of the ice (the lane along the lip stays clear, and so does the take-off)');
stamper(CAVE_X + 41.3, 2.8, CAVE_Z, 0, 'Quick stamper, first: four metres of sound floor to read it from', { cycle: 2.6 });
crate(CAVE_X + 44.3, 2.8, CAVE_Z, 'mystery', 'In the pocket between the quick stampers');
stamper(CAVE_X + 47.3, 2.8, CAVE_Z, 1.3, 'Quick stamper, second: half a cycle off, with six metres of floor beyond it for the run-up', { cycle: 2.6 });
foe('spiker', CAVE_X + 62, 3.6, CAVE_Z, .9, 1.4, 'Bristleback on the far half of the pillar past the wide gap (the near half is the landing)');
rowOf(CAVE_X + 67.6, 4.4, CAVE_Z - 1.4, ['wood', 'mystery'], 'Pair on the arrow floor, against the wall (rest before the climb)');
crate(CAVE_X + 73.2, 4.4, CAVE_Z, 'metalbounce', 'Steel arrow to the gem shelf (it cannot be spent, and no box stands near enough to stand in for it)');
stack(CAVE_X + 81, GEM_Y, CAVE_Z - 1.4, ['wood', 'wood', 'life'], 'Tower on the gem shelf: the life on top');
add({ t: 'colouredgem', gemColour: 'blue', p: [CAVE_X + 78.6, GEM_Y, CAVE_Z], grp: G.course, nm: 'The blue gem' });
add({ t: 'returnportal', p: [CAVE_X + 85.2, r3(GEM_Y - .3), CAVE_Z], s: [.9, 3.3, 3], yaw: 0, to: ADIT_BACK, exitYaw: 0, grp: G.course, nm: 'Back to the east landing' });
for (const [x, y] of [[3.4, 0], [19.4, .8], [37.2, 2.8], [51.6, 2.8], [70.6, 4.4], [76.4, GEM_Y]] as const) add({ t: 'torch', p: [CAVE_X + x, y, CAVE_Z - 1.6], rise: 2.2, w: 1, grp: G.scenery, nm: 'Adit lamp' });
fruitLine([CAVE_X + 9.6, 0, CAVE_Z], [CAVE_X + 13.6, .8, CAVE_Z], 3, 1.3); fruitLine([CAVE_X + 50, 2.8, CAVE_Z], [CAVE_X + 53.6, 2.8, CAVE_Z], 3); fruitLine([CAVE_X + 54.4, 2.8, CAVE_Z], [CAVE_X + 58.8, 3.6, CAVE_Z], 4, 1.8);

// ───────────────────────────── Dressing ─────────────────────────────
const ground = (x: number, z: number, dy = 0): P3 => [r3(x), r3(mountain.y(x, z) + dy), r3(z)];
const prop = (dkind: Decor, p: P3, yaw: number, nm: string, o: Partial<CustomComponent> = {}): CustomComponent =>
  add({ t: 'decor', dkind, p, yaw, scenerySolid: false, grp: G.scenery, nm, ...o });
const lamp = (x: number, z: number, y?: number) => prop('baylamp', y === undefined ? ground(x, z) : [x, y, z], 0, 'Lamp');
const torch = (x: number, y: number, z: number, rise = 2.2) => add({ t: 'torch', p: [r3(x), r3(y), r3(z)], rise, w: 1, grp: G.scenery, nm: 'Brazier' });
const rnd = (n: number): number => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

// The lodge yard: two huts with lit windows, lamps, the trailhead arch at the mouth of the gully.
prop('treehouseporchhut', ground(-12.5, 3), 90, 'Lodge hut, west'); prop('trialsv2crabshack', ground(13.5, 6), 270, 'Lodge store, east');
prop('crowncrashoakarch', [0, -.1, -11.2], 0, 'Trailhead arch', { s: [15.5, 9.4, 3.5] });
lamp(-6.4, 11); lamp(6.4, 11); lamp(-7.2, -6); lamp(7.2, -6);
// Braziers up the climb, one per rest.
for (const [x, s2, y] of [[-5.2, 30, 1.6], [5.2, 57, 2.5], [-5.2, 95, 2.5], [5.2, 121.5, 5], [-5.2, 140, 7], [-5.2, 182, 9.4]] as const) torch(x, y, -s2);
// The crest: the start arch of First Tracks, a wardens' hut.
prop('crowncrashoakarch', [0, CREST_Y - .1, -207.5], 0, 'First Tracks start arch', { s: [15, 9.4, 3.5] });
prop('treehouseporchhut', ground(-13.5, -197), 90, 'Crest hut'); lamp(8.6, -192); lamp(-8.6, -204);

// Marker poles with red pennants down both banks of each run, and the forest beyond them.
for (const path of [RUN1, RUN2]) {
  const poles = new Timber(`${path.name}: marker poles`, G.scenery);
  for (let st = 6; st < path.length - 2; st += 17) for (const side of [-1, 1]) {
    if ([...RUN1_GAPS, ...RUN2_GAPS].some(g => path === (RUN1_GAPS.includes(g) ? RUN1 : RUN2) && st > g.a - 2 && st < g.b + 2)) continue;
    const q = on(path, st, side * (RUN_HALF + 2.3)), f = path.at(st), top = q[1] + 2;
    poles.beam([q[0], q[1] - .3, q[2]], [q[0], top, q[2]], .1, .1, '#3c2f25');
    poles.panel([[q[0], top - .05, q[2]], [q[0] + f.fx * .62, top - .2, q[2] + f.fz * .62], [q[0] + f.fx * .62, top - .52, q[2] + f.fz * .62], [q[0], top - .5, q[2]]], '#e2452c');
  }
  C.push(...poles.done());
}
const routesAll = [CLIMB, RUN1, RUN2];
const clearOfRoutes = (x: number, z: number, reach: number): boolean => routesAll.every(path => { const q = path.nearest(x, z, reach + 2); return !q || q.s < -6 || q.s > path.length + 6 || Math.abs(q.lat) > reach; });
const inHeadwall = (x: number, z: number): boolean => x > -48 && x < 116 && z < -598 && z > -632;
const TREES: Decor[] = ['pine', 'canyonpine', 'pine', 'canyonpinegrove', 'pine'];
let treeCount = 0;
const tree = (x: number, z: number, n: number) => {
  if (!clearOfRoutes(x, z, 11.5) || inHeadwall(x, z) || Math.hypot(x, z - 2) < 19 || Math.hypot(x, z + 578) < 36 || Math.hypot(x + 28, z + 614) < 17 || Math.hypot(x - FINISH[0], z - FINISH[2] - 10) < 24 || mountain.normal(x, z)[1] < .83) return;
  const kind = TREES[Math.floor(rnd(n * 3.7) * TREES.length)];
  prop(kind, ground(x, z, -.15), Math.round(rnd(n * 9.1) * 360), 'Pine', { w: r3(.85 + rnd(n * 5.3) * .75) }); treeCount++;
};
for (const path of routesAll) for (let st = 4, n = path.length * 7; st < path.length; st += 6.5, n++) for (const side of [-1, 1]) {
  const lat = side * (13.5 + rnd(n + side * 31) * 26), f = path.at(st); tree(f.x + f.rx * lat + (rnd(n * 2.2) - .5) * 4, f.z + f.rz * lat + (rnd(n * 4.4) - .5) * 4, n * 2 + side);
}
// Slate outcrops breaking the snow beside the runs.
for (const path of [RUN1, RUN2]) for (let st = 30, n = 0; st < path.length - 20; st += 47, n++) {
  const side = n % 2 ? 1 : -1, lat = side * (15 + rnd(n * 7 + path.length) * 7), f = path.at(st), x = f.x + f.rx * lat, z = f.z + f.rz * lat;
  if (!clearOfRoutes(x, z, 13) || inHeadwall(x, z)) continue;
  const w = 6 + rnd(n * 3) * 6, h = 3 + rnd(n * 5) * 4;
  prop('crowncrashcavernrock', ground(x, z, -1.2), Math.round(rnd(n * 11) * 360), 'Slate outcrop', { s: [r3(w), r3(h), r3(w * .8)] });
}

// Each grind rail stands on hewn posts (none over a crevasse).
{
  const posts = new Timber('Rail posts', G.scenery);
  for (const q of railPosts) {
    const gaps = q.path === RUN1 ? RUN1_GAPS : RUN2_GAPS, a = on(q.path, q.s0, q.lat, q.lift), b = on(q.path, q.s1, q.lat, q.lift), n = Math.round((q.s1 - q.s0) / 3.5);
    for (let i = 0; i <= n; i++) {
      const st = q.s0 + (q.s1 - q.s0) * i / n; if (gaps.some(g => st > g.a - .8 && st < g.b + .8)) continue;
      const foot = on(q.path, st, q.lat), y = a[1] + (b[1] - a[1]) * i / n;
      posts.beam([foot[0], foot[1] - .4, foot[2]], [foot[0], y - .04, foot[2]], .16); posts.beam([foot[0] - .22, y - .09, foot[2] - .22], [foot[0] + .22, y - .09, foot[2] + .22], .12);
    }
  }
  C.push(...posts.done());
}
// The tarn: a hut by the shore, lamps, and the hoist's timber tower against the rock.
prop('treehouseporchhut', ground(27.9, -563), 270, 'Tarn hut'); lamp(9, -556); lamp(-9, -556); lamp(4.5, -600.5);
{
  const tower = new Timber('Hoist tower', G.scenery), x0 = -5.35, x1 = -.65, z0 = ROW_A - 1.35, z1 = ROW_A + 3.35, top = A0_Y + 4.6;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) tower.beam([x, TARN_Y - .6, z], [x, top, z], .34);
  for (const y of [top, top - 4.2]) { tower.beam([x0, y, z0], [x1, y, z0], .3); tower.beam([x0, y, z1], [x1, y, z1], .3); tower.beam([x0, y, z0], [x0, y, z1], .3); tower.beam([x1, y, z0], [x1, y, z1], .3); }
  for (let y = TARN_Y; y < A0_Y - 2; y += 4.4) { tower.beam([x0, y, z0], [x1, y + 4.4, z0], .2); tower.beam([x0, y + 4.4, z0], [x0, y, z1], .2); }
  tower.beam([x0 - .5, top + .5, (z0 + z1) / 2], [x1 + .5, top + .5, (z0 + z1) / 2], .42);
  C.push(...tower.done());
}
// The Headwall: a gallows frame behind every stamper (the telegraph is geometry), braziers on the rest ledges, a wide side camera.
{
  const frames = new Timber('Stamper frames', G.scenery);
  for (const c of C.filter(q => q.t === 'crusher')) {
    const [x, y, z] = c.p, back = z - 1.75, top = y + 8.3;
    for (const dx of [-1.95, 1.95]) { frames.beam([x + dx, y - .2, back], [x + dx, top, back], .3); frames.beam([x + dx, top, back], [x + dx, top, z + .6], .26); frames.beam([x + dx, top - 2.2, back], [x + dx, top, back + 2], .18); }
    frames.beam([x - 2.2, top + .1, z + .3], [x + 2.2, top + .1, z + .3], .3);
  }
  C.push(...frames.done());
}
for (const [x, y, z] of [[1.2, A0_Y, ROW_A - 1.5], [77.4, 9, ROW_A - 1.5], [81.2, B0_Y, ROW_B - 1.5], [42.2, 21.8, ROW_B - 1.5], [-9, APPROACH_Y, ROW_B - 1.5]] as const) torch(x, y, z);
add({ t: 'camnode', p: [45, 14, ROW_A - 4], s: [132, 62, 21], cameraView: true, cameraPresentationOnly: true, cameraPosition: [45, 17, ROW_A + 22], cameraTarget: [45, 14.4, ROW_A],
  cameraFollowDistance: 16.5, cameraKeepDistance: true, cameraFollowTargetHeight: 2.3, cameraFov: 52, cameraAspect: 16 / 9, radius: 4, grp: G.camera, nm: 'Headwall: a side view wide enough to read a stamper before you reach it' });

// The summit: the last hut and the start arch of Powderkeg Run.
prop('treehouseporchhut', ground(-24.5, -622.5), 0, 'Summit hut'); lamp(-17.4, -619.2);
add({ t: 'bonusplatform', p: [-21, SUMMIT_Y, -607.2], to: [-21, r3(SUMMIT_Y + .12), -610.8], grp: G.course, nm: 'Cold Storage: the bonus round and its safe return (on the summit, once the Headwall has taught everything in it)' });
{ const q = on(RUN2, 9, 0); prop('crowncrashoakarch', [q[0], q[1] - .1, q[2]], 90, 'Powderkeg Run start arch', { s: [15, 9.4, 3.5] }); }
// The powder works: the yard at the bottom of the mountain.
prop('trialsv2crabshack', ground(FINISH[0] + 12, FINISH[2] + 14), 270, 'Powder works store'); prop('treehouseporchhut', ground(FINISH[0] - 12.5, FINISH[2] + 16), 90, 'Powder works hut');
prop('crowncargostack', ground(FINISH[0] - 8, FINISH[2] + 22), 30, 'Powder kegs'); prop('crowncargostack', ground(FINISH[0] + 8.5, FINISH[2] + 24), 200, 'Powder kegs');
lamp(FINISH[0] - 6.5, FINISH[2] + 3); lamp(FINISH[0] + 6.5, FINISH[2] + 3);
{ const q = on(RUN2, RUN2.length - 6, 0); prop('crowncrashoakarch', [q[0], q[1] - .1, q[2]], 0, 'Powder works arch', { s: [15, 9.4, 3.5] }); }

// ───────────────────────────── Bounds of the walked ground ─────────────────────────────
// Snow beyond a pad is scenery, not ground. Each pad is closed by an unseen wall, and a post-and-rail fence stands along
// it wherever open snow would otherwise invite a walk; hut fronts and rock faces need no fence to explain themselves.
/** Points round an ellipse between two bearings, in degrees clockwise from north (−Z). */
const arc = (cx: number, cz: number, rx: number, rz: number, from: number, to: number): [number, number][] => {
  const n = Math.max(2, Math.ceil(Math.abs(to - from) / 10)), out: [number, number][] = [];
  for (let i = 0; i <= n; i++) { const a = (from + (to - from) * i / n) * Math.PI / 180; out.push([cx + rx * Math.sin(a), cz - rz * Math.cos(a)]); }
  return out;
};
const paddock = (nm: string, line: [number, number][], shown: (x: number, z: number) => boolean = () => true): void => {
  const [ox, oz] = line[0], oy = mountain.y(ox, oz);
  add({ t: 'wallpath', p: [r3(ox), r3(oy), r3(oz)], pts: line.map(([x, z]) => [r3(x - ox), r3(z - oz), 0, r3(mountain.y(x, z) - oy)]), w: .5, rise: 9, collisionHeight: 9, containment: true, invisible: true, grp: G.bounds, nm: `${nm}: bounds` });
  const rails = new Timber(`${nm}: fence`, G.scenery); let last: P3 | null = null, next = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, az] = line[i], [bx, bz] = line[i + 1], len = Math.hypot(bx - ax, bz - az); let d = next;
    for (; d <= len; d += 2.7) {
      const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len;
      if (!shown(x, z)) { last = null; continue; }
      const y = mountain.y(x, z);
      rails.beam([x, y - .3, z], [x, y + 1.15, z], .15, .15, '#4a3a2c');
      if (last) for (const h of [.55, 1]) rails.beam([last[0], last[1] + h, last[2]], [x, y + h, z], .09, .09, '#6d5540');
      last = [x, y, z];
    }
    next = d - len;
  }
  C.push(...rails.done());
};
paddock('Lodge yard', [[6.3, -12.6], ...arc(0, 2, 10.2, 15.2, 37, 323), [-6.3, -12.6]], (x, z) => !(Math.abs(z - 3) < 3.4 && x < -8) && !(Math.abs(z - 6) < 3.4 && x > 8));
paddock('First crest, west', [[-6.3, -190.6], [-9.2, -192.6], [-10.2, -196], [-10.2, -201], [-9.4, -204.5], [-8.9, -206.6]], (_, z) => !(z < -193.6 && z > -200.4));
paddock('First crest, east', [[6.3, -190.6], [9.2, -192.6], [10.2, -196], [10.2, -201], [9.4, -204.5], [8.9, -206.6]]);
// The tarn: both shores from the run's banks round to the foot of the wall, and along the wall as far as the hoist.
paddock('Tarn, east shore', [[8.9, -555.8], ...arc(0, -578, 31.5, 25, 162, 90), [31.5, -602.2], [-.3, -602.2]], (x, z) => z > -600 && !(Math.abs(z + 563) < 3.4 && x > 22));
paddock('Tarn, west shore', [[-8.9, -555.8], ...arc(0, -578, 31.5, 25, 198, 270), [-31.5, -602.2]], (_, z) => z > -600);
// The summit: a rail along the cliff top, the hut's front, the flanks of the ramp.
paddock('Summit, south', [[-14.3, -611.6], [-14.3, -604.6], [-15.6, -603.5], [-29.4, -603.5], [-30.4, -605.3]]);
paddock('Summit, north', [[-14.3, -616.4], [-14.3, -621.4], [-17, -623.2], [-21.3, -623.2], [-21.3, -619.6], [-27.7, -619.6], [-27.7, -622.9], [-30.4, -622.9]], (x, z) => !(z > -620.4 && x < -21 && x > -28));
{ const [fx, , fz] = FINISH; paddock('Powder works yard', [[fx + 8.9, fz - .4], ...arc(fx, fz + 10, 9.6, 17.2, 65, 295), [fx - 8.9, fz - .4]], (x, z) => !(Math.abs(z - fz - 14) < 3.4 && x > fx + 7) && !(Math.abs(z - fz - 16) < 3.4 && x < fx - 7)); }

// ───────────────────────────── Course frame ─────────────────────────────
const laneNodes: { p: P3; radius: number }[] = [
  { p: [0, 0, 16], radius: 0 }, { p: [0, CREST_Y, -CREST_S], radius: 0 },
  ...RUN1.lane(), { p: [0, TARN_Y, -598], radius: 0 }, { p: [-24, SUMMIT_Y, ROW_B], radius: 0 }, ...RUN2.lane(),
  { p: [FINISH[0], FINISH[1], FINISH[2] + 26], radius: 0 },
];
for (const node of laneNodes) add({ t: 'camnode', p: node.p, radius: node.radius, grp: G.camera });
// Checkpoints in route order (the playtest warps step through them as authored). On a run a checkpoint is a box to ride
// through at speed, on the fruit line, closing the crate group before it.
checkpoint([-3.4, 5, -124], 'C1 · Powder landing');
checkpoint([0, CREST_Y, -CREST_S], 'C2 · First crest: board from here');
checkpoint(on(RUN1, 334, -1.2), 'C3 · First Tracks, past the boulders');
checkpoint([0, TARN_Y, -560], 'C4 · Tarn shore');
checkpoint([4, A0_Y, ROW_A], 'C5 · Hoist landing');
checkpoint([86.5, B0_Y, ROW_A + .4], 'C6 · East landing');
checkpoint([-24, SUMMIT_Y, ROW_B], 'C7 · Summit: board from here');
checkpoint(on(RUN2, 281, 0), 'C8 · Powderkeg Run, past the first crevasse');
checkpoint(on(RUN2, 384, 0), 'C9 · Mid-run, before the fast boulder');
checkpoint(on(RUN2, 548, 0), 'C10 · Before the long gap (from a standing start, only a held push carries it)');
add({ t: 'crystal', p: [-19, SUMMIT_Y + .5, ROW_B], grp: G.course, nm: 'The crystal, on the top of the mountain' });
add({ t: 'gate', p: [FINISH[0], FINISH[1], FINISH[2] + 20], yaw: 180, grp: G.course, nm: 'Powder works gate' });
crate(FINISH[0] + 5.5, FINISH[1], FINISH[2] + 9, 'nitrobang', 'Green switch in the works yard, on foot after the ride: it counts every Nitro on the mountain');

export const POWDERKEG_PATHS = { CLIMB, RUN1, RUN2 };
export const POWDERKEG_MOUNTAIN = mountain;
export const POWDERKEG_BOUNDS = BOUNDS;
export const POWDERKEG_TREES = treeCount;
export const POWDERKEG_PLAN = { DOOR, ARROW, ADIT_BACK, CAVE_X, CAVE_Z, ADIT, GEM_Y, HALF, CREST_Y, CREST_S, TARN_Y, SUMMIT_Y, ROW_A, ROW_B, A0_Y, B0_Y, APPROACH_Y, FINISH, TERRACES, RAMPS, CREVASSES, ROW_A_LEDGES, ROW_B_LEDGES, RUN_HALF };
export const POWDERKEG_PEAK_LEVEL: CustomLevelData = {
  v: 1, name: 'Powderkeg Peak', spawn: [0, .14, 8], killY: -44, sky: 'day', groups, components: C,
  // The main route, walked and ridden without the optional adit, takes a careful pilot 175 s; pushing on both runs saves ten.
  medalTimes: { gold: 165, silver: 195, bronze: 240 },
  // Late light: a low warm sun out of the south-west, blue in every shadow, haze that keeps the far slopes soft.
  atmosphere: { fogColor: '#dbe7f6', fogNear: 70, fogFar: 460, ambientSky: '#a9c4ee', ambientGround: '#e6edf8', sunColor: '#ffe3bf', sunIntensity: 1.35, sunDirection: [-.6, .55, .58] },
};
