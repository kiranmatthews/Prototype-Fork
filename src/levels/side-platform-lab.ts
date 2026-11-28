import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

/**
 * SIDE PLATFORM LAB — the second side-scrolling test course. Side Pipe Lab
 * (`side-pipe-lab.ts`) is about halfpipes seen across their section, and
 * carries the handful of platforming objects that fitted between them. This
 * one carries every other object the game has, one station each: ramps,
 * rolling ground, a timber road, rocks, ice, deep sand, water to swim and
 * water that kills, arrow crates and steel, explosives, spin bridges, rope
 * bridges, rope trampolines, rope swings, orbiting / bouncing / spinning decks, pendulums
 * (across the line and along it), rolling stones, fire, thorns, and the three
 * enemies the other lab lacks; then a board line: ropes to grind, a speed
 * pad, a ferrying rail, a trick gate and a trick rail, a spine to ride, a
 * ball in a pipe, glass to go through and the plane that takes the board
 * away; and a finale of portals, a cloud with a gem, the bonus round's
 * stone, the crystal and the gate.
 *
 * It is laid out like the other lab: one east travel zone on a single plane
 * (z = 0), seen from the south through a long lens, so it reads left to right
 * and flat. Every station opens on a checkpoint (K and L warp between them),
 * shows its object once where a mistake is cheap, and then once more with
 * something at stake. Nothing here is a level to be beaten in one breath: it
 * is a bench to play each object on.
 *
 * Conventions the stations rely on, each checked in this engine
 * (tools/test-side-platform-lab.mjs plays every station with the real player;
 * docs/SIDE_PLATFORM_LAB.md has the measurements):
 *   - a `ramp` rises toward -Z before yaw: yaw -90 rises east, yaw 90 falls east;
 *   - a `rail` or a `rope` at yaw 90 runs along X; a `ropeswing` or a
 *     `pendulum` at yaw 0 swings along X, at yaw 90 across the line;
 *   - a `stone` rolls along `axis`; an enemy patrols along X at yaw 0;
 *   - a `firetiki` at yaw 0 breathes toward the camera, so it stands behind
 *     the line and fires across it.
 */

const DEPTH = 6; // every floor is this deep; the play plane is z = 0
const BASE = -34; // floors are solid blocks down to here, below any camera frame
const PIT_DROP = 7; // a pit's pool sits this far under the floors it divides
const G = 0.96; // authored crate grid (crates are enlarged x1.2 at build time)
const CP = 2.5; // a station's checkpoint stands this far onto its first floor

const STONE = '#6f7f8a';
const STONE_DARK = '#596872';
const EARTH = '#7a6a4f';
const ICE = '#a9dcf2';
const SAND = '#c9b27a';
const TIMBER = '#d7ac71';
const SLATE = '#5f7186';
const PEN = '#8a5a4a'; // the floor an enemy owns: stay off it until it is safe
const TRIP = '#c8553d'; // the posts of the plane that takes the board
const PIPE = '#d7dcd6';
const WATER = '#36a4b7';
const LAVA = '#ff5a1e';

const GR = { floor: 1, crates: 2, enemies: 3, hazards: 4, camera: 5, movers: 6, board: 7, secrets: 8, finish: 9 } as const;

/** Heights are sums of a few decimals; keep the authored data free of float dust. */
const r = (v: number): number => Math.round(v * 100) / 100;

const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };
type Extra = Partial<CustomComponent>;
type Kind = NonNullable<CustomComponent['kind']>;

let tint = STONE; // each act's floors carry one tint
/** A solid floor block from x0 to x1 whose top is `top`. */
const floor = (x0: number, x1: number, top: number, nm: string, extra: Extra = {}): void =>
  add({ t: 'platform', p: [r((x0 + x1) / 2), r((top + BASE) / 2), 0], s: [r(x1 - x0), r(top - BASE), DEPTH],
    tex: 'stone', color: tint, grp: GR.floor, nm, ...extra });
/** A box from y0 up to y1: a raised block, a thin deck, a sheet laid on a floor. */
const block = (x0: number, x1: number, y0: number, y1: number, nm: string, extra: Extra = {}): void =>
  add({ t: 'platform', p: [r((x0 + x1) / 2), r((y0 + y1) / 2), 0], s: [r(x1 - x0), r(y1 - y0), DEPTH],
    tex: 'stone', color: tint, grp: GR.floor, nm, ...extra });
/** A lethal gap between two floors: the pool sits a short fall under `top`. */
const pit = (x0: number, x1: number, top: number, nm: string): void =>
  add({ t: 'pit', p: [r((x0 + x1) / 2), r(top - PIT_DROP), 0], s: [r(x1 - x0), 1, DEPTH + 0.4], grp: GR.floor, nm });
/** A slope from (xLow, base) up to (xHigh, base + rise): rising east when xHigh > xLow, falling east otherwise. */
const ramp = (xLow: number, xHigh: number, base: number, rise: number, nm: string, extra: Extra = {}): void =>
  add({ t: 'ramp', p: [r((xLow + xHigh) / 2), r(base), 0], len: r(Math.abs(xHigh - xLow)), rise, w: DEPTH,
    yaw: xHigh > xLow ? -90 : 90, tex: 'stone', color: tint, grp: GR.floor, nm, ...extra });
const crate = (x: number, y: number, kind: Kind, nm: string, extra: Extra = {}): void =>
  add({ t: 'crate', p: [r(x), r(y), 0], kind, grp: GR.crates, nm, ...extra });
const fruit = (x: number, y: number): void => add({ t: 'wumpa', p: [r(x), r(y), 0], grp: GR.crates });
const fruitRow = (x0: number, x1: number, y: number, n: number): void => {
  for (let i = 0; i < n; i++) fruit(x0 + (x1 - x0) * (n === 1 ? 0.5 : i / (n - 1)), y);
};
const checkpoint = (x: number, top: number, nm: string): void =>
  add({ t: 'checkpoint', p: [r(x), r(top), 0], grp: GR.floor, nm });
const foe = (kind: NonNullable<CustomComponent['foe']>, x: number, top: number, range: number, speed: number, nm: string): void =>
  add({ t: 'enemy', foe: kind, p: [r(x), r(top), 0], range, speed, grp: GR.enemies, nm });
/** Two boxes and a cap, standing in the lane of a floor that is walked: spin through. */
const pyramid = (x: number, top: number, cap: Kind, nm: string): void => {
  crate(x, top, 'wood', nm);
  crate(x + G, top, 'wood', nm);
  crate(x + G / 2, top + G, cap, `${nm} (cap)`);
};
/** A flat sheet across the whole depth at height y: water, lava. */
const sheet = (x0: number, x1: number, y: number, nm: string, extra: Extra): void => {
  const hx = r((x1 - x0) / 2), hz = DEPTH / 2;
  add({ t: 'mesh', p: [r((x0 + x1) / 2), r(y), 0], vertices: [-hx, 0, -hz, hx, 0, -hz, hx, 0, hz, -hx, 0, hz],
    indices: [0, 2, 1, 0, 3, 2], edgeGrinding: false, grp: GR.hazards, nm, ...extra });
};

// ---- stations -------------------------------------------------------------
export interface Station {
  id: string; name: string;
  /** Where the station begins and ends along the line, and the floor heights there. */
  x0: number; x1: number; top: number; endTop: number;
  /** Feet point of each checkpoint in the station, the first being the one it opens on. */
  checkpoints: [number, number][];
  /** Named places a test or a reader needs: brinks, anchors, hinges. */
  marks: Record<string, number>;
}
export const STATIONS: Station[] = [];
let X = 0; // the east edge of what has been built
let TOP = 4; // the height of the floor there
let open: Station | null = null;
/** Open a station at the course's east edge: its first checkpoint is placed, and its marks begin. */
function begin(id: string, name: string, colour: string): { a: number; t: number; mark: (key: string, value: number) => void; again: (x: number, top: number) => void } {
  const station: Station = { id, name, x0: X, x1: X, top: TOP, endTop: TOP, checkpoints: [], marks: {} };
  STATIONS.push(station); open = station; tint = colour;
  const again = (x: number, top: number): void => { checkpoint(x, top, `Checkpoint: ${name}${station.checkpoints.length ? ` (${station.checkpoints.length + 1})` : ''}`); station.checkpoints.push([r(x), r(top)]); };
  again(X + CP, TOP);
  return { a: X, t: TOP, mark: (key, value) => { station.marks[key] = r(value); }, again };
}
function end(x1: number, top: number): void {
  if (!open) throw new Error('no station is open');
  open.x1 = r(x1); open.endTop = r(top); X = r(x1); TOP = r(top); open = null;
}

// ================================================================ START ==
export const START = { x0: -24, x1: 0, top: TOP };
floor(START.x0, START.x1, TOP, 'Start: arrival floor');
// On one plane the default stopwatch would stand in the only lane, and a time
// trial strips the checkpoints. It waits BEHIND the spawn.
add({ t: 'clock', p: [-20.6, TOP, 0], grp: GR.floor, nm: 'Time-trial stopwatch, behind the start' });
pyramid(-9, TOP, 'mystery', 'Start: the first boxes');

// =============================================================== GROUND ==
// The things you stand on that are not a flat box.

{ // ---- RAMPS: a slope up, a slope down, and a kicker at a brink
  const { a, t, mark } = begin('ramps', 'Ramps', STONE);
  floor(a, a + 36, t, 'Ramps: ground');
  ramp(a + 8, a + 14, t, 1.5, 'Ramp rising east (yaw -90)');
  block(a + 14, a + 22, t, t + 1.5, 'Ramps: the block between them');
  ramp(a + 28, a + 22, t, 1.5, 'Ramp falling east (yaw 90)');
  pyramid(a + 17, t + 1.5, 'mystery', 'Ramps: boxes on the block');
  fruitRow(a + 9, a + 13, t + 1.9, 3);
  // ...and a ramp with something at stake: it ends on a brink, and what it gives is height over the gap
  ramp(a + 30, a + 36, t, 1.3, 'Kicker to the brink');
  pit(a + 36, a + 40, t, 'Gap off the kicker');
  fruitRow(a + 36.6, a + 39.4, t + 3.2, 3);
  floor(a + 40, a + 50, t, 'Ramps: landing');
  mark('kicker', a + 36); mark('landing', a + 40);
  end(a + 50, t);
}

{ // ---- ROLLING GROUND: a `terrain` strip, hill and hollow
  const { a, t, mark } = begin('terrain', 'Rolling ground', EARTH);
  floor(a, a + 8, t, 'Rolling ground: way on');
  // (bedrock just under its deepest hollow, so that no sky shows under the strip)
  block(a + 8, a + 40, BASE, t - 0.75, 'Rolling ground: bedrock', { color: STONE_DARK });
  // (authored along -Z from its near end and turned east, as a ramp is. No kerbs: seen from the side, the
  // near one stands a metre proud of the ground and hides him to the chest.)
  add({ t: 'terrain', p: [r(a + 8), r(t), 0], pts: [[0, 0, 0, 0], [0, -8, 0, 0.9], [0, -16, 0, -0.4], [0, -24, 0, 1.1], [0, -32, 0, 0]],
    w: DEPTH, amp: 0.25, curve: 'spline', berms: false, yaw: -90, tex: 'dirt', color: EARTH, grp: GR.floor,
    nm: 'Rolling ground: 32 m of hill and hollow' });
  fruitRow(a + 14, a + 18, t + 2.2, 3);
  fruitRow(a + 30, a + 34, t + 2.4, 3);
  floor(a + 40, a + 48, t, 'Rolling ground: way off');
  mark('from', a + 8); mark('to', a + 40);
  end(a + 48, t);
}

{ // ---- TIMBER ROAD: a `woodpath` on its own scaffold, over a drop
  const { a, t, mark } = begin('timber', 'Timber road', EARTH);
  floor(a, a + 8, t, 'Timber road: way on');
  pit(a + 8, a + 38, t, 'Under the timber road');
  add({ t: 'woodpath', p: [r(a + 8), r(t), 0], pts: [[0, 0, 0, 0], [8, 0, 0, 1.4], [15, 0, 0, 1.4], [22, 0, 0, 0.4], [30, 0, 0, 0]],
    w: 5, s: [5, 0.32, 1], curve: 'spline', structureStyle: 'light', scaffold: true, supports: true, rails: true,
    terrainSupports: false, supportDepth: 9, baySpacing: 5, spacing: 0.55, grp: GR.floor,
    nm: 'Timber road: 30 m of planks on bamboo, humped in the middle' });
  pyramid(a + 19, t + 1.4, 'mystery', 'Timber road: boxes on the hump');
  floor(a + 38, a + 46, t, 'Timber road: way off');
  mark('from', a + 8); mark('to', a + 38);
  end(a + 46, t);
}

{ // ---- ROCKS: a log to hop, boulders to climb, a statue to vault, a wall that wanders across the line
  const { a, t, mark } = begin('rocks', 'Rocks and a log', STONE);
  floor(a, a + 58, t, 'Rocks: ground');
  add({ t: 'decor', dkind: 'log', p: [r(a + 11), r(t), 0], len: DEPTH, yaw: 90, grp: GR.floor, nm: 'A log across the line: 1.1 m, hopped' });
  // (a boulder is a dome, not a box: its top is a little under its height and its sides fall away, so
  // these overlap by a quarter of a metre and leave no crevice to drop into)
  const rocks: [number, number][] = [[19, 0.9], [22.4, 1.7], [25.8, 2.5], [29.2, 1.3]];
  rocks.forEach(([dx, h], i) => add({ t: 'rock', p: [r(a + dx), r(t + h / 2), 0], s: [3.8, h, 4.6], seed: 4100 + i * 37, color: STONE_DARK,
    grp: GR.floor, nm: `Boulder ${i + 1}: ${h} m` }));
  fruit(a + 25.8, t + 4.2);
  add({ t: 'decor', dkind: 'idol', p: [r(a + 41), r(t), 0], w: 0.7, grp: GR.floor, nm: 'A statue in the lane: 1.8 m, vaulted' });
  add({ t: 'wallpath', p: [r(a + 49), r(t), 0], pts: [[0, -3, 0, 0], [0.9, -1, 0, 0], [-0.3, 1, 0, 0], [0.7, 3, 0, 0]], w: 0.6, rise: 1.1,
    collisionHeight: 1.1, curve: 'spline', tex: 'stone', color: STONE_DARK, grp: GR.floor, nm: 'A low wall wandering across the line (wallpath)' });
  mark('log', a + 11); mark('rocks', a + 19); mark('idol', a + 41); mark('wall', a + 49);
  end(a + 58, t);
}

{ // ---- ICE: a sheet between two floors, then a chute you cannot stop on and a gap at the end of it
  const { a, t, mark } = begin('ice', 'Ice', SLATE);
  floor(a, a + 8, t, 'Ice: way on');
  floor(a + 8, a + 22, t - 0.3, 'Under the first sheet');
  block(a + 8, a + 22, t - 0.3, t, 'Ice sheet: 14 m, safe at both ends', { slip: true, iceGrip: 0.12, tex: 'ice', color: ICE });
  floor(a + 22, a + 28, t, 'Ice: a place to stand');
  floor(a + 28, a + 36, t - 2, 'Under the chute');
  ramp(a + 36, a + 28, t - 2, 2, 'Ice chute: it carries you down whatever you hold', { slip: true, iceGrip: 0.05, slipGravity: 1, tex: 'ice', color: ICE });
  floor(a + 36, a + 46, t - 2.3, 'Under the run-out');
  block(a + 36, a + 46, t - 2.3, t - 2, 'Ice run-out to the brink', { slip: true, iceGrip: 0.12, tex: 'ice', color: ICE });
  pit(a + 46, a + 49.5, t - 2, 'Gap at the end of the ice');
  fruitRow(a + 46.6, a + 48.9, t + 0.4, 3);
  floor(a + 49.5, a + 60, t - 2, 'Ice: landing on stone');
  mark('sheet', a + 8); mark('chute', a + 28); mark('brink', a + 46); mark('landing', a + 49.5);
  end(a + 60, t - 2);
}

{ // ---- DEEP SAND: ground that holds you to a walk (`groundSpeedLimit`)
  const { a, t, mark } = begin('sand', 'Deep sand', SLATE);
  floor(a, a + 8, t, 'Deep sand: way on');
  floor(a + 8, a + 20, t - 0.3, 'Under the sand');
  block(a + 8, a + 20, t - 0.3, t, 'Deep sand: 12 m at 2.4 m/s', { groundSpeedLimit: 2.4, tex: 'sand', color: SAND });
  floor(a + 20, a + 27, t, 'Deep sand: firm ground');
  floor(a + 27, a + 33, t - 0.3, 'Under the second patch');
  block(a + 27, a + 33, t - 0.3, t, 'Deep sand: boxes in it', { groundSpeedLimit: 2.4, tex: 'sand', color: SAND });
  pyramid(a + 29.4, t, 'mystery', 'Boxes standing in the sand');
  floor(a + 33, a + 40, t, 'Deep sand: way off');
  mark('from', a + 8); mark('to', a + 20);
  end(a + 40, t);
}

{ // ---- WATER: a pool to swim, with a ramp in and a ramp out; then water that kills
  const { a, t, mark } = begin('water', 'Water', SLATE);
  floor(a, a + 8, t, 'Water: way on');
  floor(a + 8, a + 30, t - 3, 'Pool: bed');
  ramp(a + 14, a + 8, t - 3, 3, 'Pool: the way in');
  ramp(a + 24, a + 30, t - 3, 3, 'Pool: the way out');
  sheet(a + 8.4, a + 29.6, t - 0.35, 'Pool: water to swim in', { solid: false, vert: false, materialStyle: 'water', swimDepth: 3, opacity: 0.84, tex: 'solid', color: WATER });
  fruitRow(a + 15, a + 23, t + 0.5, 4);
  floor(a + 30, a + 38, t, 'Water: between the two');
  floor(a + 38, a + 42, t - 3.4, 'Lethal water: bed');
  sheet(a + 38, a + 42, t - 1, 'Water that kills: jumped', { solid: false, materialStyle: 'water', lethal: true, opacity: 0.9, tex: 'solid', color: '#2b5f78', castShadow: false });
  fruitRow(a + 38.8, a + 41.2, t + 2.6, 3);
  floor(a + 42, a + 50, t, 'Water: way off');
  mark('pool', a + 8); mark('poolEnd', a + 30); mark('lethal', a + 38); mark('lethalEnd', a + 42);
  end(a + 50, t);
}

// =============================================================== CRATES ==

{ // ---- ARROWS AND STEEL: empty boxes, a five-hit box, a wooden arrow up a wall, steel to stand on, a steel arrow held
  const { a, t, mark } = begin('arrows', 'Arrows and steel', STONE);
  const WALL_1 = 4.6, WALL_2 = 6;
  floor(a, a + 18, t, 'Arrows: ground');
  crate(a + 5.5, t, 'empty', 'Empty boxes: they count, they pay nothing');
  crate(a + 5.5 + G, t, 'empty', 'Empty boxes: they count, they pay nothing');
  crate(a + 5.5 + G / 2, t + G, 'wood', 'Empty boxes: the one that pays');
  crate(a + 9.5, t, 'multihit', 'Five-hit box: bounce on it five times');
  // (a jump that passes within a stride of a floating box is drawn up into it: this row hangs 3 m short of
  // where the hop at the arrow begins)
  for (let i = -1; i <= 1; i++) crate(a + 9.5 + i * G, t + 3.5, 'mystery', 'What the five-hit box bounces you into');
  // (an arrow stands AGAINST its wall: a jump at the wall comes down on it, and the bounce goes up the face)
  crate(a + 17.4, t, 'bouncy', 'Wooden arrow at the foot of the wall');
  for (const dy of [2.4, 3.6, 4.8]) fruit(a + 17.4, t + dy);
  floor(a + 18, a + 36, t + WALL_1, 'Arrows: the first shelf');
  // steel is ground: a row of it to walk along, and one block of the other kind of steel to hop
  for (let i = 0; i < 3; i++) crate(a + 23 + i * G, t + WALL_1, 'metal', 'Steel crates: a deck 1.15 m up');
  add({ t: 'metal', p: [r(a + 29.5), r(t + WALL_1), 0], grp: GR.crates, nm: 'A steel block that is not a crate (the `metal` part)' });
  crate(a + 23 + G, t + WALL_1 + 3.7, 'mystery', 'A box over the steel deck: a jump from the deck is drawn up into it');
  crate(a + 35.4, t + WALL_1, 'metalbounce', 'Steel arrow: hold Jump as you land on it');
  for (const dy of [2.6, 4, 5.4, 6.6]) fruit(a + 35.4, t + WALL_1 + dy);
  floor(a + 36, a + 48, t + WALL_1 + WALL_2, 'Arrows: the high road');
  mark('arrow', a + 17.4); mark('wall1', a + 18); mark('steel', a + 23); mark('block', a + 29.5); mark('steelArrow', a + 35.4); mark('wall2', a + 36);
  end(a + 48, t + WALL_1 + WALL_2);
}

{ // ---- EXPLOSIVES: TNT alone, a nitro alone, and a nitro that cannot be jumped until the green ! has cleared it
  const { a, t, mark } = begin('explosives', 'Explosives', STONE);
  floor(a, a + 60, t, 'Explosives: ground');
  crate(a + 6, t, 'mask', 'A mask before the explosives');
  for (let i = -2; i <= 2; i++) crate(a + 14 + i * G, t, i === 0 ? 'tnt' : 'wood', i === 0 ? 'TNT: stomp it and leave (three seconds)' : 'What the TNT takes with it');
  crate(a + 28, t, 'nitro', 'A nitro alone in the lane: jumped');
  crate(a + 38, t, 'nitrobang', 'Green !: every nitro goes off, from here');
  // a nitro under a roof too low to jump it (2.6 m: a jump under it rises 1.16 m, and a nitro is 1.15):
  // the way under is the green !; the way over is the roof, by its lip, and the life is up there
  block(a + 44, a + 52, t + 2.6, t + 3.1, 'Low roof over the second nitro', { color: STONE_DARK });
  crate(a + 49, t, 'nitro', 'A nitro under a low roof: it cannot be jumped');
  crate(a + 48, t + 3.1, 'life', 'A life on the roof');
  mark('tnt', a + 14); mark('nitro', a + 28); mark('green', a + 38); mark('roof', a + 44); mark('nitro2', a + 49);
  end(a + 60, t);
}

// ====================================================== THINGS THAT MOVE ==

{ // ---- SPIN BRIDGES: a leaf that stands on end until it is spun; then one that folds again
  const { a, t, mark } = begin('spinbridge', 'Spin bridges', STONE);
  floor(a, a + 12, t, 'Spin bridges: way on');
  add({ t: 'spinbridge', p: [r(a + 12), r(t), 0], s: [8, 0.4, DEPTH], cycle: 0.7, tex: 'bridge-timber', color: TIMBER, grp: GR.movers,
    nm: 'Spin bridge: spin beside it and it lies down for good' });
  pit(a + 12, a + 20, t, 'Under the first spin bridge');
  floor(a + 20, a + 32, t, 'Spin bridges: between the two');
  add({ t: 'spinbridge', p: [r(a + 32), r(t), 0], s: [10, 0.4, DEPTH], cycle: 0.7, hold: 4, tex: 'bridge-timber', color: TIMBER, grp: GR.movers,
    nm: 'Timed spin bridge: four seconds, then it folds' });
  pit(a + 32, a + 42, t, 'Under the timed spin bridge');
  fruitRow(a + 34, a + 40, t + 1.2, 4);
  floor(a + 42, a + 52, t, 'Spin bridges: way off');
  mark('hinge1', a + 12); mark('far1', a + 20); mark('hinge2', a + 32); mark('far2', a + 42);
  end(a + 52, t);
}

/** A suspended deck between two pinned ends: boards, two hand ropes and two bearer ropes on one span. */
function ropeBridge(x0: number, x1: number, top: number, boards: ('sound' | 'rotten')[], nm: string): void {
  const bridgeSpan: NonNullable<CustomComponent['bridgeSpan']> = [[r(x0), r(top), 0], [r(x1), r(top), 0]];
  const each = (x1 - x0) / boards.length, mid = r((x0 + x1) / 2), len = r(x1 - x0);
  boards.forEach((board, i) => {
    const cx = r(x0 + (i + 0.5) * each);
    if (board === 'sound') add({ t: 'platform', p: [cx, r(top - 0.09), 0], s: [r(each), 0.18, 4.2], tex: 'bridge-timber', color: '#ffffff', bridgeSpan,
      grp: GR.movers, nm: `${nm}: lashed boards` });
    else add({ t: 'crumble', p: [cx, r(top), 0], s: [r(each), 0.18, 4.2], shake: 1, speed: 30, tex: 'bridge-timber', bridgeSpan,
      grp: GR.movers, nm: `${nm}: rotten boards` });
  });
  for (const side of [-1, 1]) {
    add({ t: 'rope', p: [mid, r(top + 1.35), side * 2.3], len, yaw: 90, shake: 3, amp: 0.65, bridgeSpan, grp: GR.movers, nm: `${nm}: hand rope` });
    add({ t: 'decor', dkind: 'braidedrope', p: [mid, r(top - 0.3), side * 1.72], s: [0.24, 0.24, len], yaw: 90, solid: false, bridgeSpan,
      grp: GR.movers, nm: `${nm}: bearer rope` });
  }
  pit(x0, x1, top, `Under ${nm}`);
}

{ // ---- ROPE BRIDGES: a deck hung between two ends that gives under you; then one with rotten boards in it
  const { a, t, mark } = begin('ropebridge', 'Rope bridges', STONE);
  floor(a, a + 10, t, 'Rope bridges: way on');
  ropeBridge(a + 10, a + 32, t, ['sound', 'sound', 'sound', 'sound', 'sound'], 'Rope bridge');
  floor(a + 32, a + 40, t, 'Rope bridges: the pier between');
  ropeBridge(a + 40, a + 60, t, ['sound', 'rotten', 'sound', 'rotten', 'sound'], 'Rotten rope bridge');
  floor(a + 60, a + 68, t, 'Rope bridges: way off');
  mark('span1', a + 10); mark('pier', a + 32); mark('span2', a + 40); mark('far', a + 60);
  end(a + 68, t);
}

// A rope trampoline is what every `trampoline` is: a knotted net in a timber frame, the size of its pad. It is
// walked on like a floor and gives under a walker; a body that LANDS on it is thrown (16 m/s: 3.9 m), and
// thrown a quarter harder with Jump held at the landing (20 m/s: 6.1 m). A board that rolls onto one trips.
const NET = { speed: 16, held: 1.25, deep: 0.9 };
{ // ---- TRAMPOLINES: one set in the floor to walk on and hop on; one out over a pit, under a shelf only the held bounce reaches
  const { a, t, mark } = begin('trampoline', 'Trampolines', STONE);
  const pad = (x0: number, x1: number, nm: string): void =>
    add({ t: 'trampoline', p: [r((x0 + x1) / 2), r(t), 0], s: [r(x1 - x0), NET.deep, DEPTH], speed: NET.speed, amp: NET.held, grp: GR.movers, nm });
  floor(a, a + 10, t, 'Trampolines: way on');
  // the first: nothing under it but its own bed, so the net sags to the full under a walker
  floor(a + 10, a + 15, r(t - NET.deep - 0.9), 'Trampolines: the bed under the first', { color: STONE_DARK });
  pad(a + 10, a + 15, 'Rope trampoline: walk onto it and it gives; land on it and it throws you');
  for (const h of [1.6, 2.8, 4, 5.4]) fruit(a + 12.5, t + h); // the top one is the held bounce's
  floor(a + 15, a + 26, t, 'Trampolines: between the two');
  // the second: out over a pit on four piles, against a wall 5 m high. The plain bounce comes up short of the top
  pit(a + 26, a + 35.5, t, 'Under the second trampoline');
  pad(a + 29.5, a + 35.5, 'Rope trampoline over the pit: keep Jump held through the bounce for the shelf');
  for (const x of [a + 29.8, a + 35.2]) for (const z of [-2.7, 2.7])
    add({ t: 'platform', p: [r(x), r(t - NET.deep - (PIT_DROP - NET.deep) / 2), z], s: [0.5, r(PIT_DROP - NET.deep), 0.5], tex: 'wood', color: TIMBER,
      grp: GR.movers, nm: 'Trampoline pile' });
  block(a + 35.5, a + 41.5, BASE, t + 5, 'Trampolines: the shelf');
  fruitRow(a + 37, a + 40, t + 5 + 1.2, 3);
  block(a + 41.5, a + 45, BASE, t + 2.5, 'Trampolines: the step down');
  floor(a + 45, a + 52, t, 'Trampolines: way off');
  mark('net1', a + 10); mark('net1End', a + 15); mark('brink', a + 26); mark('net2', a + 29.5); mark('shelf', a + 35.5); mark('shelfEnd', a + 41.5);
  end(a + 52, t);
}

// A rope hangs 6 m from an anchor 8 m over the floors, 5 m out from the edge it is jumped from, and swings
// 3.4 m each way on a round of 4.6 s. A tap jump off the brink runs into it whenever it hangs on the near
// side of straight down (wider than this and its end lifts out of reach at the near end of the swing). Let
// go, a body is thrown up and steers itself 6.8 m on.
const SWING = { up: 8, len: 6, amp: 0.6, out: 5 };
const swing = (x: number, top: number, nm: string, extra: Extra = {}): void =>
  add({ t: 'ropeswing', p: [r(x), r(top + SWING.up), 0], len: SWING.len, amp: SWING.amp, speed: 0, phase: 0, yaw: 0, grp: GR.movers, nm, ...extra });

{ // ---- ROPE SWINGS: one over a trench, two in a row over a drop, and one whose anchor travels
  const { a, t, mark, again } = begin('swings', 'Rope swings', STONE);
  floor(a, a + 10, t, 'Rope swings: way on');
  floor(a + 10, a + 23, t - 1.5, 'Trench under the first swing: a miss costs a climb');
  swing(a + 10 + SWING.out, t, 'Rope swing: jump into it while it is on your side, Jump to let go');
  floor(a + 23, a + 33, t, 'Rope swings: after the first');
  again(a + 25, t);
  pit(a + 33, a + 54, t, 'Under the two swings');
  // (half a round apart, and 9.3 m apart: when the first is at the far end of its swing the second is at
  // the near end of its own, 2.5 m off)
  swing(a + 33 + SWING.out, t, 'First of two swings');
  swing(a + 33 + SWING.out + 9.3, t, 'Second of two swings: it comes to meet you', { phase: Math.PI });
  floor(a + 54, a + 67, t, 'Rope swings: after the two');
  again(a + 59, t);
  // The anchor ferries 8 m each way on a round of 7.9 s, and the rope under it barely swings (1.2 m each way),
  // so it is a ferry to be met. A tap jump off the brink runs into a rope that is 1 to 3 m out: it turns at
  // the near end 2.2 m out, and is within reach for about a second as it does. It turns at the far end 4 m
  // short of the floor.
  pit(a + 67, a + 89, t, 'Under the travelling swing');
  swing(a + 67 + 2.2 + 8, t, 'Travelling swing: its anchor ferries, and you ride it across', { amp: 0.2, range: 8, cycle: 0.8, axis: 'x', travelPhase: 0 });
  floor(a + 89, a + 108, t, 'Rope swings: way off');
  mark('brink1', a + 10); mark('far1', a + 23); mark('brink2', a + 33); mark('far2', a + 54); mark('brink3', a + 67); mark('far3', a + 89);
  end(a + 108, t);
}

{ // ---- MOVING DECKS the other lab has not: a wheel, a springboard that slides, a turntable, a lift with a fire on it
  const { a, t, mark, again } = begin('decks', 'Moving decks', STONE);
  floor(a, a + 10, t, 'Moving decks: way on');
  pit(a + 10, a + 24, t, 'Under the wheel');
  // (a walker slower than 6 m/s is held at the brink of a drop that would kill him: a deck he is to step
  // onto has to be UNDER his first step, so at each end of its turn a deck laps the floor's edge by 5 cm.
  // The wheel turns one way only: over the top going west, down past the west floor, under, up past the east.)
  for (const phase of [0, Math.PI]) add({ t: 'mover', p: [r(a + 17), r(t), 0], s: [4.1, 0.6, DEPTH], axis: 'z', amp: 0, speed: 0.5, phase, orbit: [5, 3.2],
    tex: 'stone', color: '#e2a640', grp: GR.movers, nm: 'Wheel: a deck on an orbit (two of them, opposite)' });
  floor(a + 24, a + 43, t, 'Moving decks: after the wheel');
  again(a + 26, t);
  // (a bounce of 16 m/s rises 3.75 m and carries a running body 5.5 m before it is down to the shelf's height:
  // the board slides no further from the wall than its middle can throw him)
  add({ t: 'mover', p: [r(a + 39.4), r(t + 0.8), 0], s: [3.5, 0.8, DEPTH], axis: 'x', amp: 1.3, speed: 0.8, bounce: 16, tex: 'stone', color: '#e2a640',
    grp: GR.movers, nm: 'Sliding springboard: land on it from a jump' });
  for (const dy of [2.4, 3.4, 4.4]) fruit(a + 42.3, t + dy);
  floor(a + 43, a + 55, t + 3, 'Moving decks: the shelf the springboard reaches');
  again(a + 45, t + 3);
  pit(a + 55, a + 65, t + 3, 'Under the turntable');
  // (for the same reason its ends lap the two brinks when it lies along the line, and it stands 2 cm proud of
  // them so that the two tops are never one surface. Across the line it is a 3.6 m island, a tap jump from either side.)
  add({ t: 'mover', p: [r(a + 60), r(t + 3.02), 0], s: [10.1, 0.6, 3.6], axis: 'x', amp: 0, speed: 0.5, spin: 20, tex: 'stone', color: '#e2a640',
    grp: GR.movers, nm: 'Turntable: a plank that lines up with the line twice a turn' });
  floor(a + 65, a + 75, t + 3, 'Moving decks: after the turntable');
  floor(a + 75, a + 81, t - 0.6, 'Lift shaft');
  // (it fills its shaft from wall to wall: a gap beside a deck is somewhere to fall into)
  add({ t: 'mover', p: [r(a + 78), r(t + 1.5), 0], s: [6, 0.6, DEPTH], axis: 'y', amp: 1.5, speed: 0.7, lit: true, tex: 'stone', color: '#e2a640',
    grp: GR.movers, nm: 'Lift with a brazier on it' });
  floor(a + 81, a + 92, t, 'Moving decks: way off');
  mark('wheel', a + 17); mark('spring', a + 39.4); mark('shelf', a + 43); mark('turntable', a + 60); mark('lift', a + 78);
  end(a + 92, t);
}

// ============================================================== HAZARDS ==

/** A pendulum swinging ACROSS the line. Its gallows stands 7.2 m before and behind the line: each post gets a plinth. */
const pendulum = (x: number, top: number, phase: number, nm: string): void => {
  add({ t: 'pendulum', p: [r(x), r(top + 7), 0], len: 6, amp: 0.95, speed: 1.25, phase, yaw: 90, grp: GR.hazards, nm });
  for (const z of [-7.2, 7.2]) add({ t: 'platform', p: [r(x), r((top + BASE) / 2), z], s: [2, r(top - BASE), 2], tex: 'stone', color: STONE_DARK,
    grp: GR.floor, nm: `${nm}: plinth under a gallows post` });
};

{ // ---- PENDULUMS: one, then two half a beat apart, one over ground that holds you to a walk, and one swinging along the line
  const { a, t, mark } = begin('pendulums', 'Pendulums', STONE_DARK);
  floor(a, a + 38, t, 'Pendulums: ground');
  pendulum(a + 14, t, 0, 'Pendulum: it swings across the line');
  pendulum(a + 26, t, 0, 'First of two pendulums');
  pendulum(a + 32, t, Math.PI / 2, 'Second of two pendulums, half a beat later');
  floor(a + 38, a + 50, t - 0.3, 'Under the sand');
  block(a + 38, a + 50, t - 0.3, t, 'Deep sand under a pendulum', { groundSpeedLimit: 2.4, tex: 'sand', color: SAND });
  pendulum(a + 44, t, Math.PI, 'Pendulum over deep sand');
  floor(a + 50, a + 84, t, 'Pendulums: the long one, and the way off');
  // ...and one that swings ALONG the line, where a side view shows all of it. Its bob is at head height or
  // lower for a second in every three (anywhere within 4.7 m of its post), and up out of the way for two:
  // the 9.4 m under it are run while it is up. (It hangs 0.9 m behind the line, so that its posts stand
  // behind him and not through him; its bob is 1.6 m deep and still crosses the line.)
  add({ t: 'pendulum', p: [r(a + 68), r(t + 7), -0.9], len: 6, amp: 1.1, speed: 1, phase: 0, yaw: 0, grp: GR.hazards, nm: 'Pendulum swinging along the line: run under it while it is up' });
  mark('first', a + 14); mark('pairA', a + 26); mark('pairB', a + 32); mark('sand', a + 44); mark('along', a + 68);
  end(a + 84, t);
}

{ // ---- ROLLING STONES: one that comes down the line at you, one that crosses it
  const { a, t, mark, again } = begin('stones', 'Rolling stones', STONE_DARK);
  floor(a, a + 43.5, t, 'Rolling stones: the alley');
  add({ t: 'stone', p: [r(a + 24), r(t), 0], axis: 'x', range: 9, speed: 5, radius: 0.7, grp: GR.hazards, nm: 'A stone rolling along the line: jumped' });
  again(a + 37.5, t);
  // (a stone needs flat ground under all of its run: this slab is as deep as the stone travels)
  add({ t: 'platform', p: [r(a + 46), r((t + BASE) / 2), 0], s: [5, r(t - BASE), 24], tex: 'stone', color: STONE_DARK, grp: GR.floor, nm: 'Slab the crossing stone rolls on' });
  add({ t: 'stone', p: [r(a + 46), r(t), 0], axis: 'z', range: 10, speed: 6, radius: 0.9, grp: GR.hazards, nm: 'A stone rolling across the line: timed' });
  floor(a + 48.5, a + 60, t, 'Rolling stones: way off');
  mark('along', a + 24); mark('across', a + 46);
  end(a + 60, t);
}

/** A carved head behind the line, breathing across it. Scaled to 0.8 so the breath is at chest height (it clears a body at 1). */
const tiki = (x: number, top: number, phase: number, amp: number, nm: string): void => {
  add({ t: 'platform', p: [r(x), r((top + BASE) / 2), -4.3], s: [3, r(top - BASE), 2.6], tex: 'stone', color: tint, grp: GR.floor, nm: `${nm}: plinth` });
  add({ t: 'wall', p: [r(x), r(top), -4.3], s: [2.2, 2.3, 2.2], invisible: true, edgeGrinding: false, grp: GR.hazards, nm: `${nm}: head core` });
  add({ t: 'firetiki', p: [r(x), r(top), -4.3], yaw: 0, range: r(7.1 / 0.8), cycle: 5, phase, amp, w: 0.8, grp: GR.hazards, nm });
};

{ // ---- FIRE: torches to light the way in, a head that breathes across the line, two of them out of step, and lava
  const { a, t, mark } = begin('fire', 'Fire', STONE_DARK);
  floor(a, a + 40, t, 'Fire: ground');
  for (const dx of [5, 9]) add({ t: 'torch', p: [r(a + dx), r(t), -2.6], rise: 1.8, w: 1.1, grp: GR.hazards, nm: 'Torch: a light, and nothing else' });
  tiki(a + 16, t, 0, 0, 'Fire head');
  tiki(a + 28, t, 0, 0, 'First of two fire heads');
  tiki(a + 33, t, 2.5, 20, 'Second of two fire heads: out of step, and it turns');
  floor(a + 40, a + 44, t - 1.25, 'Under the lava');
  sheet(a + 40, a + 44, t - 1.2, 'Lava: a floor that kills', { solid: true, lethal: true, tex: 'solid', color: LAVA, emissive: '#ff3b00' });
  fruitRow(a + 40.8, a + 43.2, t + 2.6, 3);
  floor(a + 44, a + 54, t, 'Fire: way off');
  mark('head', a + 16); mark('pairA', a + 28); mark('pairB', a + 33); mark('lava', a + 40); mark('lavaEnd', a + 44);
  end(a + 54, t);
}

{ // ---- THORNS: spikes are a picture over a pit
  const { a, t, mark } = begin('thorns', 'Thorns', STONE_DARK);
  floor(a, a + 40, t, 'Thorns: ground');
  // (a tap jump lands 4.95 m on: the patches are 7 m apart, so each landing has 2 m of run before the next,
  // and the last is two patches wide)
  for (const [i, dx] of [12, 19, 26, 27.15].entries()) {
    add({ t: 'pit', p: [r(a + dx), r(t + 0.2), 0], s: [1.15, 1, 1.25], invisible: true, grp: GR.hazards, nm: `Thorn patch ${i + 1}: what kills` });
    add({ t: 'thorn', p: [r(a + dx), r(t), 0], s: [2.14, 1.01, 2.26], seed: 27200 + i * 977, grp: GR.hazards, nm: `Thorn patch ${i + 1}: what is seen` });
  }
  mark('thorn1', a + 12); mark('thorn2', a + 19); mark('thorn3', a + 26.58);
  end(a + 40, t);
}

// ============================================================== ENEMIES ==

{ // ---- THE BULL: it charges the length of its floor and then stands dizzy
  const { a, t, mark } = begin('bull', 'The bull', STONE);
  floor(a, a + 14, t, 'Bull: a place to watch from');
  crate(a + 7, t, 'mask', 'A mask before the bull');
  floor(a + 14, a + 34, t, 'Bull: its floor', { color: PEN });
  foe('charger', a + 24, t, 9, 2.4, 'Russet Bull: struck while it winds up or while it is dizzy');
  floor(a + 34, a + 46, t, 'Bull: way off');
  pyramid(a + 38, t, 'mystery', 'Boxes behind the bull');
  mark('pen', a + 14); mark('bull', a + 24); mark('penEnd', a + 34);
  end(a + 46, t);
}

{ // ---- THE TURRET: it fires down the line at what it can see; steel hides you, and so does a hole in the floor
  const { a, t, mark } = begin('turret', 'The turret', STONE);
  // An orb flies 0.7 m over the floor at 10.5 m/s, one every 2.7 s, and the turret sees 32 m. On one line
  // anything that stands between you and it hides you all the way back, so cover along the way is a HOLE:
  // 1.6 m down you are out of its sight (its muzzle is a metre up: against the wall nearest it, always),
  // and the orb in flight passes over your head. The holes are 7 m apart (out of one as an orb passes over
  // it, and you are in the next before another arrives), and the last is 3 m short of the turret. Out in
  // the open an orb is jumped. It fires only at what it sees: shown nothing, it waits.
  const HOLE = 1.6, S = a + 41;
  floor(a, S - 16, t, 'Turret: the corridor, to the first hole');
  crate(S - 25, t, 'metal', 'Steel: behind it the turret cannot see you, and an orb breaks on it');
  floor(S - 16, S - 13, t - HOLE, 'A hole to be in while an orb passes');
  floor(S - 13, S - 6, t, 'Turret: between the holes');
  floor(S - 6, S - 3, t - HOLE, 'A second hole, at its feet');
  floor(S - 3, a + 50, t, 'Turret: its end of the corridor');
  foe('sentry', S, t, 0, 1, 'Ember Sentry: an orb every 2.7 s at what it can see');
  // (it sees behind itself as well as before: a wall at its back, taller than its muzzle, keeps the next
  // station's checkpoint out of its sight. A tap jump clears it.)
  block(S + 2.2, S + 2.8, t, t + 1.5, 'The wall at the turret\'s back', { color: STONE_DARK });
  mark('cover', S - 25); mark('hole1', S - 16); mark('hole1End', S - 13); mark('hole2', S - 6); mark('hole2End', S - 3); mark('sentry', S); mark('backWall', S + 2.2);
  end(a + 50, t);
}

{ // ---- THE BIRD: tall, slow to strike, harmless after it has
  const { a, t, mark } = begin('bird', 'The bird', STONE);
  floor(a, a + 34, t, 'Bird: ground');
  foe('moa', a + 18, t, 2.2, 1.5, 'Moa: it pecks, then stands recovering');
  pyramid(a + 26, t, 'life', 'What the bird guards');
  mark('moa', a + 18);
  end(a + 34, t);
}

// ================================================================ BOARD ==
// From here the line is ridden. Catching a rope or a rail puts the board under you.

{ // ---- ROPES: a line to grind that breaks after three seconds of it
  const { a, t, mark, again } = begin('rope', 'Ropes', SLATE);
  floor(a, a + 12, t, 'Ropes: way on');
  floor(a + 12, a + 24, t - 1.5, 'Trench under the first rope');
  add({ t: 'rope', p: [r(a + 18), r(t + 1.2), 0], len: 13, yaw: 90, shake: 3, amp: 0.5, grp: GR.board, nm: 'Rope: jump and press Grind' });
  floor(a + 24, a + 36, t, 'Ropes: between the two');
  again(a + 26, t);
  pit(a + 36, a + 56, t, 'Under the long rope');
  add({ t: 'rope', p: [r(a + 46), r(t + 1.2), 0], len: 21, yaw: 90, shake: 3, amp: 0.9, grp: GR.board, nm: 'Long rope: it snaps after three seconds of grinding' });
  floor(a + 56, a + 70, t, 'Ropes: way off');
  mark('rope1', a + 11.5); mark('far1', a + 24); mark('rope2', a + 35.5); mark('far2', a + 56);
  end(a + 70, t);
}

{ // ---- SPEED: a pad that gives a board what a charge would, a wall of boxes that needs it, and the way down
  const { a, t, mark } = begin('speed', 'Speed pad', SLATE);
  floor(a, a + 50, t, 'Speed pad: the strip');
  // (a pad's chevrons run along its own -Z: turned a quarter turn they run east, the way this line does)
  add({ t: 'speedpad', p: [r(a + 14), r(t + 0.06), 0], s: [5, 0.12, 4], yaw: -90, speed: 22, cycle: 1.2, grp: GR.board, nm: 'Speed pad: riders only' });
  for (const dx of [0, G]) for (const dy of [0, G]) crate(a + 34 + dx, t + dy, 'wood', 'A wall of boxes: a board goes through it at 12.5 m/s');
  floor(a + 50, a + 62, t - 3, 'Under the way down');
  ramp(a + 62, a + 50, t - 3, 3, 'The way down');
  floor(a + 62, a + 104, t - 3, 'Speed pad: run-out');
  mark('pad', a + 14); mark('boxes', a + 34); mark('down', a + 50);
  end(a + 104, t - 3);
}

{ // ---- A RAIL THAT TRAVELS: it ferries along the line over a drop
  const { a, t, mark } = begin('ferry', 'Ferrying rail', SLATE);
  floor(a, a + 12, t, 'Ferrying rail: way on');
  // (12 m of rail travelling 4.6 m each way: its west end comes to within a stride of the near brink, and
  // by the time it has been ridden to its east end, that end is a hop from the far floor or over it)
  pit(a + 12, a + 31, t, 'Under the ferrying rail');
  add({ t: 'rail', p: [r(a + 23), r(t + 1), 0], len: 12, yaw: 90, axis: 'x', amp: 4.6, speed: 0.7, phase: 0, grp: GR.board, nm: 'A rail that travels: caught when it comes west' });
  floor(a + 31, a + 50, t, 'Ferrying rail: way off');
  mark('brink', a + 12); mark('rail', a + 23); mark('far', a + 31);
  end(a + 50, t);
}

{ // ---- TRICKS: a gate that opens for a kickflip thrown in the air that passes it; a rail that is not there until a heelflip
  const { a, t, mark, again } = begin('tricks', 'Trick gate and trick rail', SLATE);
  floor(a, a + 96, t, 'Tricks: the strip');
  add({ t: 'trickgate', p: [r(a + 30), r(t + 1.7), 0], yaw: 90, radius: 2.2, trick: 'kick', grp: GR.board, nm: 'Trick gate: a kickflip (Spin with the stick at rest) in the air that goes through it' });
  again(a + 46, t);
  add({ t: 'trickrail', p: [r(a + 72), r(t + 1), 0], len: 14, yaw: 90, trick: 'heel', grp: GR.board, nm: 'Trick rail: a heelflip (Spin with the stick to the right) makes it real' });
  mark('gate', a + 30); mark('rail', a + 65);
  end(a + 96, t);
}

{ // ---- THE SPINE: a body that kills, with a rail along its back
  const { a, t, mark } = begin('spine', 'The spine', SLATE);
  floor(a, a + 12, t, 'Spine: way on');
  block(a + 8, a + 12, t, t + 1.2, 'Spine: the step up to it');
  floor(a + 12, a + 26, t, 'Spine: its floor', { color: PEN });
  add({ t: 'grindosaurus', p: [r(a + 19), r(t), 0], range: 3, speed: 1.5, coverage: 0.65, yaw: 0, grp: GR.board, nm: 'Grindosaurus: grind two thirds of its back and off the end' });
  floor(a + 26, a + 44, t, 'Spine: way off');
  mark('step', a + 12); mark('spine', a + 19); mark('off', a + 26);
  end(a + 44, t);
}

{ // ---- THE BALL: a pipe with something in it that rolls at you
  const { a, t, mark } = begin('ball', 'The ball', SLATE);
  const RISE = 3.5, FLAT = 3, WEST_DECK = 8, EAST_DECK = 10;
  const westLip = a + WEST_DECK, cross = westLip + RISE + FLAT, eastLip = cross + FLAT + RISE, floorY = r(t - RISE);
  add({ t: 'platform', p: [r((a + eastLip + EAST_DECK) / 2), r((floorY - 0.06 + BASE) / 2), 0], s: [r(eastLip + EAST_DECK - a), r(floorY - 0.06 - BASE), DEPTH],
    tex: 'stone', color: STONE_DARK, grp: GR.floor, nm: 'Ball pipe: footing' });
  add({ t: 'vertramp', vkind: 'half', sideOn: true, p: [r(cross), floorY, 0], len: DEPTH, yaw: 0, w: FLAT, rise: RISE, wallRise: [RISE, RISE],
    wallDeck: [WEST_DECK, EAST_DECK], tex: 'pavement', color: PIPE, grp: GR.board, nm: 'Ball pipe' });
  add({ t: 'angryball', p: [r(cross), floorY, 0], w: FLAT, rise: RISE, radius: 0.8, range: 12, speed: 7, yaw: 0, grp: GR.board, nm: 'Angry ball: spun, stomped or slid through' });
  mark('westLip', westLip); mark('cross', cross); mark('eastLip', eastLip); mark('floorY', floorY);
  end(eastLip + EAST_DECK, t);
}

{ // ---- GLASS AND THE TRIP: panes that break on anything, and the plane that takes a rider's board
  const { a, t, mark } = begin('glass', 'Glass and the board trip', SLATE);
  floor(a, a + 50, t, 'Glass: the strip');
  const pane = (x: number, y0: number, y1: number, kind: 'glass' | 'sign', breakGroup: number, nm: string, color: string, opacity: number): void => {
    add({ t: 'mesh', p: [r(x), r(y0), 0], vertices: [0, 0, -2.4, 0, 0, 2.4, 0, r(y1 - y0), 2.4, 0, r(y1 - y0), -2.4], indices: [0, 1, 2, 0, 2, 3],
      solid: false, edgeGrinding: false, doubleSided: true, breakable: kind, breakGroup, tex: 'solid', color, opacity, grp: GR.board, nm });
  };
  pane(a + 16, t, t + 3.2, 'glass', 1, 'A pane of glass across the line', '#cfeef7', 0.4);
  pane(a + 24, t + 1.4, t + 3.4, 'sign', 2, 'A sign hung over the line', '#e2a640', 1);
  pane(a + 30, t, t + 3.2, 'glass', 3, 'A second pane', '#cfeef7', 0.4);
  // The plane a rider crosses to be put on his feet: posts mark it.
  for (const z of [-2.7, 2.7]) add({ t: 'wall', p: [r(a + 40), r(t), z], s: [0.4, 3.6, 0.4], tex: 'stone', color: TRIP, grp: GR.board, nm: 'Board trip: post' });
  add({ t: 'tumblezone', checkpointTrip: true, p: [r(a + 40), r(t + 3), 0], s: [DEPTH + 2, 8, 1.2], yaw: 270, grp: GR.board, nm: 'Board trip: a rider who crosses it is thrown off his board' });
  mark('glass', a + 16); mark('sign', a + 24); mark('trip', a + 40);
  end(a + 50, t);
}

// =============================================================== FINALE ==

export const ISLAND = { x0: 0, x1: 0, top: 0 }; // filled in below: the cloud over the finale
{ // ---- PORTALS, THE BONUS DOOR, THE GEM, THE CRYSTAL AND THE GATE
  const { a, t, mark } = begin('finale', 'Portals and prizes', STONE);
  floor(a, a + 16, t, 'Finale: way on');
  // the only way over the chasm is the door
  // (a door on the ground is sunk 0.3 m into it: what it tests is the point at a walker's feet, and that is ON the floor)
  add({ t: 'returnportal', p: [r(a + 13), r(t - 0.3), 0], s: [3, 3.3, 0.9], yaw: 90, to: [r(a + 52), r(t + 0.12), 0], exitYaw: 90, grp: GR.secrets, nm: 'Portal: the way over the chasm' });
  pit(a + 16, a + 48, t, 'The chasm the portal crosses');
  floor(a + 48, a + 112, t, 'Finale: the far side');
  // an arrow under a door in the air: a bounce into it is the way up to the cloud (a jump OVER the arrow
  // passes under the door: it is 3.2 m up, and a tap's feet rise 2.3)
  crate(a + 60, t, 'bouncy', 'Arrow under the door in the air');
  add({ t: 'returnportal', p: [r(a + 60), r(t + 3.2), 0], s: [3, 2.2, 1.2], yaw: 90, airOnly: true, to: [r(a + 62), r(t + 14.12), 0], exitYaw: 90, grp: GR.secrets,
    nm: 'Door in the air: only a body in the air goes through it' });
  ISLAND.x0 = r(a + 58); ISLAND.x1 = r(a + 78); ISLAND.top = r(t + 14);
  add({ t: 'platform', p: [r(a + 68), r(t + 13.91), 0], s: [20, 0.18, DEPTH], cloudRoad: true, tex: 'solid', seed: 3841, grp: GR.secrets, nm: 'The cloud over the finale' });
  add({ t: 'colouredgem', gemColour: 'blue', p: [r(a + 71), r(t + 14), 0], grp: GR.secrets, nm: 'The blue gem, on the cloud' });
  add({ t: 'returnportal', p: [r(a + 76), r(t + 13.7), 0], s: [3, 3.3, 0.9], yaw: 90, to: [r(a + 76), r(t + 0.12), 0], exitYaw: 90, grp: GR.secrets, nm: 'Portal: back down from the cloud' });
  // the bonus round's stone stands on its own ledge, off the line: a steel arrow throws you up to it, and
  // the way on runs under it. (The arrow is 3.4 m short of the ledge: a jump over it is down again before
  // the ledge's underside, which is 2.6 m up and would cut a jump short.)
  crate(a + 84.6, t, 'metalbounce', 'Steel arrow up to the bonus ledge');
  for (const dy of [2.4, 3.6, 4.6]) fruit(a + 84.6 + (dy - 2.4) * 0.9, t + dy);
  block(a + 88, a + 94, t + 2.6, t + 3.1, 'Ledge the bonus stone stands on', { color: '#e2a640' });
  add({ t: 'bonusplatform', p: [r(a + 91), r(t + 3.1), 0], to: [r(a + 98), r(t + 0.12), 0], grp: GR.secrets, nm: 'Bonus round: jump onto it' });
  add({ t: 'crystal', p: [r(a + 103), r(t), 0], grp: GR.finish, nm: 'The crystal' });
  add({ t: 'gate', p: [r(a + 108), r(t), 0], yaw: 90, grp: GR.finish, nm: 'Finish gate' });
  mark('portal', a + 13); mark('far', a + 48); mark('airDoor', a + 60); mark('cloudPortal', a + 76); mark('bonusArrow', a + 84.6); mark('ledge', a + 88); mark('bonus', a + 91);
  mark('bonusReturn', a + 98); mark('crystal', a + 103); mark('gate', a + 108);
  end(a + 112, t);
}

// ====================================================== camera and plane ==
const X_MIN = START.x0;
const X_MAX = X;
const MID = r((X_MIN + X_MAX) / 2);
const SPAN = r(X_MAX - X_MIN);
// One plane: nothing on this course is played toward or away from the lens.
for (const z of [-0.83, 0.83])
  add({ t: 'wall', p: [MID, 0, z], s: [SPAN + 40, 160, 0.6], invisible: true, grp: GR.camera, nm: 'Single-plane side-scrolling boundary' });
add({ t: 'wall', p: [r(X_MIN - 0.3), START.top + 12, 0], s: [0.6, 40, DEPTH], invisible: true, grp: GR.camera, nm: 'West end stop' });
// (the east end stop is the game's other boundary part, a coast wall)
add({ t: 'coastwall', p: [r(X_MAX + 0.4), r(TOP), 0], pts: [[0, -4], [0, 4]], w: 0.5, rise: 16, edgeGrinding: false, grp: GR.camera, nm: 'East end stop (coast wall)' });
add({ t: 'zone', p: [MID, 0, 0], s: [SPAN + 40, 1, 30], dir: 'E', sideOn: true, grp: GR.camera, nm: 'The whole course reads left to right, on one line' });
add({ t: 'camnode', p: [r(X_MIN - 10), START.top, 0], radius: 0, grp: GR.camera });
add({ t: 'camnode', p: [r(X_MAX + 10), r(TOP), 0], radius: 0, grp: GR.camera });
// The other lab's long lens: 52 m away through 18 degrees, so the depth behind the line reads flat.
const LENS = { fov: 18, distance: 52, pitch: 6 };
const EYE_UP = r(LENS.distance * Math.sin(LENS.pitch * Math.PI / 180));
const EYE_OUT = r(LENS.distance * Math.cos(LENS.pitch * Math.PI / 180));
add({ t: 'camnode', p: [MID, 8, 0], s: [SPAN + 60, 200, 30], cameraView: true, cameraPresentationOnly: true,
  cameraPosition: [MID, r(3.4 + EYE_UP), EYE_OUT], cameraTarget: [MID, 3.4, 0], cameraFollowDistance: LENS.distance,
  cameraKeepDistance: true, cameraTelephoto: true, cameraFov: LENS.fov, cameraAspect: 16 / 9, radius: 1, grp: GR.camera,
  nm: 'Flat side view through a long lens' });

const groups: CustomGroup[] = [
  { id: GR.floor, nm: 'Floors, gaps, ground and checkpoints', editorOnly: true },
  { id: GR.crates, nm: 'Crates and fruit', editorOnly: true },
  { id: GR.enemies, nm: 'Enemies', editorOnly: true },
  { id: GR.hazards, nm: 'Water, fire, pendulums, stones and thorns', editorOnly: true },
  { id: GR.movers, nm: 'Bridges, swings and moving decks', editorOnly: true },
  { id: GR.board, nm: 'The board line', editorOnly: true },
  { id: GR.secrets, nm: 'Portals, the bonus door and the gem', editorOnly: true },
  { id: GR.camera, nm: 'Side view, travel zone and play plane', editorOnly: true },
  { id: GR.finish, nm: 'Crystal and finish', editorOnly: true },
];

export const SIDE_PLATFORM_LAB_SPAN = { x0: X_MIN, x1: X_MAX };
export const SIDE_PLATFORM_LAB_LEVEL: CustomLevelData = {
  v: 1,
  name: 'Side Platform Lab',
  spawn: [-15, START.top + 0.12, 0],
  killY: -44,
  sky: 'day',
  components,
  groups,
};
