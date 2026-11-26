import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

/**
 * SIDE PIPE LAB — a side-scrolling test course whose path runs THROUGH
 * halfpipes seen across their section.
 *
 * The whole course is one east travel zone on a single plane (z = 0), viewed
 * from the south through a long lens, so it reads left to right and flat.
 * Between pipes it is on-foot platforming; at a pipe the walker reaches the
 * coping of its west deck and is on his board there, tail set on the coping,
 * waiting: Jump, or the stick pressed on again, drops him in
 * (`sideOn` vertramps, see `CustomComponent.sideOn`). Inside, the board rides
 * the one line the camera can see: holding a direction carves the walls for
 * speed, holding X pumps them harder, and reaching a lip pops a vertical
 * hang. JUMP in that hang with the stick held OUT over the lip — the spine
 * transfer's input — pops the air out across it: over a shared ridge into the
 * next pipe, or onto a deck, where the rider lands on the board like any other
 * air (and gets off it by braking, or rides on).
 *
 * SIDE PIPE LAB (FORWARD), at the foot of this file, is the same component
 * list met head-on: no side view, the camera behind the rider.
 *
 * The height of the course is the other subject. It climbs, plunges, bottoms
 * out, climbs half as far again and comes down twice, 830 m in all:
 *
 *   0  ROLL-IN   P0, equal walls, decks both sides: drop in, hold right, pop out.
 *   1  PUMP      P1, a low west wall and a 7 m east wall that is a spine. One
 *                swing falls short; the west hang on the way back buys the
 *                height (or hold X and pump it in one), then the air transfers
 *                over the ridge into a second pipe and out onto its deck.
 *   2  PLUNGE    P2, a wall 8.5 m deep under your feet and a 3.5 m wall to
 *                leave by: everything the drop gathers is one big air. Then
 *                on foot down a stair of slabs that fall away.
 *   3  BASIN     the low point, 11 m under the brink: the crab, the
 *                Bristleback and the Mossback, each met alone on a wide floor.
 *   4  CLIMB     16 m up on foot. A trampoline, a lift over solid ground,
 *                timed pads, a lift over a drop, a frog, a ferry with a
 *                Bristleback at its landing, two crushers with a crab behind
 *                them. Each tool is met alone first, then with a partner.
 *   5  VALLEY    P3, a 7 m drop into a 28 m flat with a stack to smash and a
 *                crab to spin on the riding line.
 *   6  SWITCH    P4, a bare east wall with nothing behind it. The `!` floats
 *                over the WEST lip; head it out of a hang and the exit slab
 *                turns solid. A Whirler guards the floor beyond.
 *   7  CASCADE   P5–P7, three pipes sharing two ridges, each floor 7 m under
 *                the ridge before it: two spine transfers in a row, downhill.
 *   8  RAIL      P8, a bare east wall again: the way out is the rail over its
 *                lip, a second long, which drops you into P9.
 *   9  LONG RAIL P10, the same catch on a rail 52 m long that falls 16 m to
 *                the gate: let go of the stick and balance it.
 *
 * Every number here was measured with the real player in this engine
 * (tools/test-side-pipe-lab.mjs replays the route; docs/SIDE_ON_PIPES.md has
 * the table): a held direction alone climbs 4.45 m of P1's 7 m east wall on
 * the first swing and clears it on the second; the west hang of that swing
 * back heads a crate 6 m over a 3.5 m lip; a tap jump on foot rises 2.1 m.
 */

const DEPTH = 6; // every floor and pipe is this deep; the play plane is z = 0
const BASE = -26; // floors are solid blocks down to here, below any camera frame (the basin floor is at -2.4)
const PIT_DROP = 7; // a pit's pool sits this far under the floors it divides
// A step up on an on-foot stretch. It is JUMPED: a tap rises 2.1 m. (Walking
// into a wall lower than the skater's own reach is a bump, never a grab.)
const STEP = 1.6;
const STEP_CP = 2.8; // where the checkpoint on top of a step stands, from its edge
const STEP_BOXES = 4.4; // ...and where its stack of boxes starts
const G = 0.96; // authored crate grid (crates are enlarged x1.2 at build time)

const STONE = '#6f7f8a';
const STONE_DARK = '#596872';
const SLATE = '#5f7186'; // the plunge, the basin and the cascade: the way down
const SAND = '#8a8271'; // the climb
const PIPE = '#d7dcd6';
const ACCENT = '#e2a640';

const CUBE = {
  vertices: [-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, .5, -.5,
    -.5, -.5, .5, .5, -.5, .5, .5, .5, .5, -.5, .5, .5],
  indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5],
};

const GR = { floor: 1, pipes: 2, crates: 3, enemies: 4, camera: 5, switchExit: 6, finish: 7, hazards: 8 } as const;

/** Heights are sums of a few decimals; keep the authored data free of float dust. */
const r = (v: number): number => Math.round(v * 100) / 100;

const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };

/** A solid floor block from x0 to x1 whose top is `top`. */
let actStone = STONE; // each act's floors carry one tint, so the height graph reads as acts
const floor = (x0: number, x1: number, top: number, nm: string, color = actStone): void =>
  add({ t: 'platform', p: [r((x0 + x1) / 2), r((top + BASE) / 2), 0], s: [r(x1 - x0), r(top - BASE), DEPTH],
    tex: 'stone', color, grp: GR.floor, nm });
/** A lethal gap between two floors: the pool sits a short fall under `top`. */
const pit = (x0: number, x1: number, top: number, nm: string): void =>
  add({ t: 'pit', p: [r((x0 + x1) / 2), r(top - PIT_DROP), 0], s: [r(x1 - x0), 1, DEPTH + 0.4], grp: GR.floor, nm });
const crate = (x: number, y: number, kind: NonNullable<CustomComponent['kind']>, nm: string,
  extra: Partial<CustomComponent> = {}): void =>
  add({ t: 'crate', p: [r(x), r(y), 0], kind, grp: GR.crates, nm, ...extra });
const fruit = (x: number, y: number): void => add({ t: 'wumpa', p: [r(x), r(y), 0], grp: GR.crates });
/** A floating slab, half a metre thick, whose top is `top`: a platform with air under it. */
const slab = (x0: number, x1: number, top: number, nm: string): void =>
  add({ t: 'platform', p: [r((x0 + x1) / 2), r(top - 0.25), 0], s: [r(x1 - x0), 0.5, DEPTH],
    tex: 'stone', color: ACCENT, grp: GR.floor, nm });
const checkpoint = (x: number, top: number, nm: string): void =>
  add({ t: 'checkpoint', p: [r(x), r(top), 0], grp: GR.floor, nm });
const foe = (kind: NonNullable<CustomComponent['foe']>, x: number, top: number, range: number, speed: number, nm: string): void =>
  add({ t: 'enemy', foe: kind, p: [r(x), r(top), 0], range, speed, grp: GR.enemies, nm });
/** Two boxes and a cap, standing in the lane of a floor that is only ever WALKED: spin through. */
const pyramid = (x: number, top: number, cap: NonNullable<CustomComponent['kind']>, nm: string): void => {
  crate(x, top, 'wood', nm);
  crate(x + G, top, 'wood', nm);
  crate(x + G / 2, top + G, cap, `${nm} (cap)`);
};
/** A touching row floated clear over a rolling board's head; a jump or an ollie heads it. */
const OVERHEAD = 3.4; // a mounted rider's crate-contact box stands 3.0 m; a full on-foot jump still heads 3.8 m
const overhead = (x: number, top: number, kinds: NonNullable<CustomComponent['kind']>[], nm: string): void =>
  kinds.forEach((kind, i) => crate(x + i * G, top + OVERHEAD, kind, nm));

export interface SidePipe {
  name: string;
  /** World x of the west and east copings (the flat's edge on an open side). */
  westLip: number; eastLip: number;
  cross: number; flatHalf: number; floorY: number;
  westRise: number; eastRise: number; westDeck: number; eastDeck: number;
  westLipY: number; eastLipY: number;
}

/**
 * A side-on pipe placed by its WEST lip (or the west edge of its flat when
 * that side is open). It stands on its own block so the filled section the
 * camera sees is seated on solid ground.
 */
function pipe(name: string, westLip: number, floor: number, flatHalf: number,
  rise: [number, number], deck: [number, number] = [0, 0]): SidePipe {
  const floorY = r(floor);
  const cross = westLip + rise[0] + flatHalf;
  const eastLip = cross + flatHalf + rise[1];
  add({ t: 'platform', p: [(westLip - deck[0] + eastLip + deck[1]) / 2, r((floorY - 0.06 + BASE) / 2), 0],
    s: [eastLip + deck[1] - (westLip - deck[0]), r(floorY - 0.06 - BASE), DEPTH],
    tex: 'stone', color: STONE_DARK, grp: GR.floor, nm: `${name}: footing` });
  add({ t: 'vertramp', vkind: 'half', sideOn: true, p: [cross, floorY, 0], len: DEPTH, yaw: 0,
    w: flatHalf, rise: Math.max(rise[0], rise[1]), wallRise: rise, wallDeck: deck,
    tex: 'pavement', color: PIPE, grp: GR.pipes, nm: name });
  return { name, westLip, eastLip, cross, flatHalf, floorY, westRise: rise[0], eastRise: rise[1],
    westDeck: deck[0], eastDeck: deck[1], westLipY: r(floorY + rise[0]), eastLipY: r(floorY + rise[1]) };
}
/** Fruit hung a little off a transition, so a clean swing collects the curve. */
function fruitOnWall(p: SidePipe, side: -1 | 1, count: number): void {
  const rise = side < 0 ? p.westRise : p.eastRise;
  for (let i = 1; i <= count; i++) {
    const phi = (i / (count + 1)) * (Math.PI / 2) * 0.85;
    const x = p.cross + side * (p.flatHalf + rise * Math.sin(phi) - 0.75 * Math.sin(phi));
    fruit(x, p.floorY + rise * (1 - Math.cos(phi)) + 0.75 * Math.cos(phi) + 0.2);
  }
}
/** Fruit stacked on the hang line over a lip: the height you earned, counted. */
function fruitOverLip(p: SidePipe, side: -1 | 1, heights: number[]): void {
  const x = (side < 0 ? p.westLip : p.eastLip) - side * 0.08;
  const y = side < 0 ? p.westLipY : p.eastLipY;
  for (const h of heights) fruit(x, y + h);
}

// ============================================================ 0 · ROLL-IN ==
// The lesson with nothing attached: walk to the lip and the board is under you,
// waiting on the coping; Jump drops in, and Jump again in the far hang with
// right held lands you on its deck.
const START_TOP = 4;
floor(-20, 0, START_TOP, 'Start: arrival floor');
// On one plane the default stopwatch would stand two strides down the only
// lane, and a time trial strips the checkpoints. It waits BEHIND the spawn:
// walking west for it is a decision.
add({ t: 'clock', p: [-18.6, START_TOP, 0], grp: GR.floor, nm: 'Time-trial stopwatch, behind the start' });
crate(-10.5, START_TOP, 'wood', 'Start: arrival supplies');
crate(-10.5 + G, START_TOP, 'wood', 'Start: arrival supplies');
crate(-10.5 + G, START_TOP + G, 'mystery', 'Start: arrival supplies (cap)');
for (const x of [-6, -4, -2]) fruit(x, START_TOP + 1.15);
export const P0 = pipe('P0 roll-in pipe', 4, START_TOP - 3.5, 2.5, [3.5, 3.5], [4, 6]);

// =========================================== 0b · THE WALL YARD (optional) ==
// Behind the start, four verts met ON FOOT, each on the last one's deck.
// What a runner does at the top of a transition depends on one measurement:
// the lip's height above the last place a running foot holds (where the wall
// passes 60°; src/vertRunUp.ts). The four walls are the same 2.5 m curve
// with more straight vertical above it each time, so the only thing that
// changes is that measurement, and it reads at a glance as "taller":
//   1.25 m  he climbs out: the lip is at his hips, and it is a vault
//   2.6 m   he climbs out: two steps up the wall, hands on the coping, a mantle
//   3.75 m  he leaps, catches the lip at the top of the jump and hangs (then the ordinary pull-up)
//   4.9 m   he leaps, comes up short, slides down the face and is thrown back down the transition.
// Nothing here is on the course: it is a place to see all of them in a row.
/** A quarter facing east (its wall rises to the west), with a deck behind its lip, on solid ground. */
function yardWall(name: string, baseX: number, floorY: number, lipRise: number, deck: number): YardWall {
  const RADIUS = 2.5, lipX = baseX - RADIUS, lipY = r(floorY + RADIUS + lipRise);
  floor(lipX - deck, baseX, floorY, `${name}: footing`, STONE_DARK);
  add({ t: 'vertramp', vkind: 'quarter', sideOn: true, p: [baseX, floorY, 0], len: DEPTH, yaw: 180, rise: RADIUS, w: 0, deck, lipRise,
    tex: 'pavement', color: PIPE, grp: GR.pipes, nm: name });
  // Fruit up the face: a line the eye follows to the lip (and what a short leap still collects).
  for (const phi of [0.42, 0.78, 1.12]) fruit(baseX - RADIUS * Math.sin(phi) + 0.6 * Math.sin(phi), floorY + RADIUS * (1 - Math.cos(phi)) + 0.6 * Math.cos(phi) + 0.2);
  for (let h = 0.5; h < lipRise - 0.4; h += 0.75) fruit(lipX + 0.55, floorY + RADIUS + h);
  return { name, baseX, lipX, floorY, lipY, deck, rise: r(RADIUS / 2 + lipRise) };
}
export interface YardWall {
  name: string;
  /** World x of the foot of the transition and of the coping; the wall rises to the west. */
  baseX: number; lipX: number;
  floorY: number; lipY: number; deck: number;
  /** The lip's height above the last place a running foot holds. */
  rise: number;
}
const YARD_X0 = -26;
floor(YARD_X0, -20, START_TOP, 'Wall yard: run-up floor behind the start');
export const YARD_VAULT = yardWall('Wall yard 1: vaulted out of', YARD_X0, START_TOP, 0, 7);
// (overhead, because a deck here is a run-up: a box standing in the lane would stop the run at the wall)
overhead(YARD_VAULT.lipX - 4.9, YARD_VAULT.lipY, ['wood', 'mystery', 'wood'], 'Wall yard: overhead row on the first deck');
export const YARD_CLIMB = yardWall('Wall yard 2: climbed out of', YARD_VAULT.lipX - YARD_VAULT.deck, YARD_VAULT.lipY, 1.35, 7);
for (const x of [1.6, 2.6, 3.6, 4.6]) fruit(YARD_CLIMB.lipX - x, YARD_CLIMB.lipY + 1.15);
export const YARD_GRAB = yardWall('Wall yard 3: leapt for and caught', YARD_CLIMB.lipX - YARD_CLIMB.deck, YARD_CLIMB.lipY, 2.5, 7);
for (const x of [1.6, 2.6, 3.6, 4.6]) fruit(YARD_GRAB.lipX - x, YARD_GRAB.lipY + 1.15);
export const YARD_MISS = yardWall('Wall yard 4: too high', YARD_GRAB.lipX - YARD_GRAB.deck, YARD_GRAB.lipY, 3.65, 4);
fruitOnWall(P0, -1, 3);
fruitOnWall(P0, 1, 3);
for (const x of [-1.5, 0, 1.5]) fruit(P0.cross + x, P0.floorY + 1.0);
fruitOverLip(P0, -1, [1.4, 2.6, 3.8]);
// Popping out of a pipe lands its rider on the deck on the board at 4.5 m/s;
// braked there he is on his feet 1.7 m on, so everything between pipes can be
// played as ordinary platforming: steps to jump, gaps, boxes to spin.
floor(P0.eastLip + P0.eastDeck, 34, START_TOP, 'Roll-in: landing floor');
overhead(27.5, START_TOP, ['wood', 'mystery', 'wood'], 'Roll-in: overhead row past the landing');

// ============================================================== 1 · PUMP ==
// A step, one plain gap on foot, then the pipe whose east wall is nearly
// three times the height of the one you drop in from — and is the back of
// the next pipe. (A pipe that has to be read at a glance is about 12 m lip
// to lip: the view shows 13 m ahead, so the far wall is in frame from the
// near lip. The plunge and the valley are longer on purpose.)
const PUMP_TOP = r(START_TOP + STEP);
floor(34, 44, PUMP_TOP, 'Pump: step up');
checkpoint(34 + STEP_CP, PUMP_TOP, 'Checkpoint 1: on foot before the pump pipe');
pyramid(34 + STEP_BOXES, PUMP_TOP, 'mystery', 'Pump: on-foot stack after the checkpoint');
pit(44, 47.5, PUMP_TOP, 'Gap before the pump pipe');
floor(47.5, 53, PUMP_TOP, 'Pump: approach floor');
for (const x of [48.5, 50, 51.5]) fruit(x, PUMP_TOP + 1.15);
export const P1 = pipe('P1 pump pipe', 57, PUMP_TOP - 2.5, 1.5, [2.5, 7], [4, 0]);
fruitOnWall(P1, 1, 5);
fruitOverLip(P1, -1, [1.5, 3, 4.5]);
// The reward for swinging back: a west hang's worth above the low lip.
crate(P1.westLip + 0.08, P1.westLipY + 8.2, 'life', 'Pump: life over the west lip, a full hang up');
// The second pipe shares P1's east ridge: its 5 m west wall IS the back of
// P1's east wall, so the transfer drops straight into it. Its own east wall is
// lower and decked — the next landing — and the swing off the spine carries
// far over that lip.
export const L1 = pipe('P1 spine catch pipe', P1.eastLip, P1.eastLipY - 5, 2, [5, 3.5], [0, 6]);
fruitOnWall(L1, 1, 3);
export const SPINE_LANDING = { x0: L1.eastLip + L1.eastDeck, x1: L1.eastLip + L1.eastDeck + 8, top: L1.eastLipY };
floor(SPINE_LANDING.x0, SPINE_LANDING.x1, SPINE_LANDING.top, 'Pump: landing floor past the spine');
overhead(SPINE_LANDING.x0 + 2.5, SPINE_LANDING.top, ['wood', 'wood', 'mystery'], 'Pump: overhead row past the spine');

// ============================================================ 2 · PLUNGE ==
actStone = SLATE;
// The first way DOWN. The floor past the spine ends at a pipe whose near wall
// is 8.5 m deep and whose far wall is 3.5: the drop-in is a plunge, and all
// it gathers goes into one air off the low east lip.
const BRINK = { x0: SPINE_LANDING.x1, x1: SPINE_LANDING.x1 + 10, top: SPINE_LANDING.top };
floor(BRINK.x0, BRINK.x1, BRINK.top, 'Plunge: the brink');
checkpoint(BRINK.x0 + 2.5, BRINK.top, 'Checkpoint 2: at the brink of the deep pipe');
pyramid(BRINK.x0 + 5, BRINK.top, 'wood', 'Plunge: stack at the brink');
export const DEEP = pipe('P2 deep pipe', BRINK.x1 + 4, BRINK.top - 8.5, 3, [8.5, 3.5], [4, 6]);
fruitOnWall(DEEP, -1, 7);
for (const dx of [-2, 0, 2]) fruit(DEEP.cross + dx, DEEP.floorY + 1.0);
fruitOnWall(DEEP, 1, 3);
// Ridden instead of popped, that air has 10.5 m in it over the east lip —
// 5.5 m more than the brink it dropped from — and hangs for 1.7 s. The fruit
// counts it; the box near the top is for the rider who waits to press Jump
// (it hangs a metre INSIDE the lip: an air popped out early has drifted clear
// of it by the time it is that high).
fruitOverLip(DEEP, 1, [1.5, 3, 4.5, 6, 7.5, 9]);
export const BIG_AIR = { x: DEEP.eastLip - 1.2, y: r(DEEP.eastLipY + 10.2) };
crate(BIG_AIR.x, BIG_AIR.y, 'life', 'Plunge: the big-air box, a full hang up');
// Then down on foot. A slab that falls away is met first over a trench you
// can jump back out of; the stairs after it are three of them over a drop,
// each 1.5 m under the last, and they are run, not stood on.
export const DOWN = { x0: DEEP.eastLip + DEEP.eastDeck, x1: DEEP.eastLip + DEEP.eastDeck + 11, top: DEEP.eastLipY };
floor(DOWN.x0, DOWN.x1, DOWN.top, 'Plunge: landing floor');
overhead(DOWN.x0 + 3.5, DOWN.top, ['wood', 'mystery', 'wood'], 'Plunge: overhead row past the landing');
export const TRENCH = { x0: DOWN.x1, x1: DOWN.x1 + 5, top: DOWN.top, floor: r(DOWN.top - 1.5) };
floor(TRENCH.x0, TRENCH.x1, TRENCH.floor, 'Plunge: the trench under the first falling slab', STONE_DARK);
add({ t: 'crumble', p: [(TRENCH.x0 + TRENCH.x1) / 2, TRENCH.top, 0], s: [5, 0.6, DEPTH], grp: GR.hazards,
  nm: 'Falling slab: first met over a trench you can jump out of' });
const STAIRS_X0 = TRENCH.x1 + 12;
floor(TRENCH.x1, STAIRS_X0, DOWN.top, 'Plunge: rest floor before the falling stairs');
// (The stack stands 9 m back from the brink: its cap drops into the lane when the base is spun.)
checkpoint(TRENCH.x1 + 0.9, DOWN.top, 'Checkpoint 3: before the falling stairs');
pyramid(TRENCH.x1 + 2.3, DOWN.top, 'mystery', 'Plunge: stack before the falling stairs');
// (A running jump carries 5.3 m, and 5.8 m to a landing 1.5 m lower: each
// slab is 5 m long behind a 3 m gap, so the jump lands on its first half.)
export const CRUMBLE_STAIRS = [0, 1, 2].map(k => ({
  x0: STAIRS_X0 + 3 + 8 * k, x1: STAIRS_X0 + 8 + 8 * k, top: r(DOWN.top - 1.5 * (k + 1)),
}));
for (const pad of CRUMBLE_STAIRS) {
  add({ t: 'crumble', p: [(pad.x0 + pad.x1) / 2, pad.top, 0], s: [pad.x1 - pad.x0, 0.6, DEPTH], grp: GR.hazards,
    nm: 'Falling stairs: one jump each, and keep moving' });
  fruit((pad.x0 + pad.x1) / 2, pad.top + 1.15);
}

// ============================================================= 3 · BASIN ==
// The low point, and the roomiest floor on the course. Each enemy kind is
// met here alone with space behind you: the crab (any attack), the
// Bristleback (spin it, never land on it) and the Mossback, whose shell is a
// spring — the one row in the basin hangs a shell bounce up.
export const BASIN = { x0: STAIRS_X0 + 27, x1: STAIRS_X0 + 87, top: r(DOWN.top - 6) };
pit(STAIRS_X0, BASIN.x0, BASIN.top, 'Plunge: the drop under the falling stairs');
export const TRAMPOLINE = { x0: BASIN.x1 - 6, x1: BASIN.x1, top: BASIN.top, speed: 16, held: 1.4 };
floor(BASIN.x0, TRAMPOLINE.x0, BASIN.top, 'Basin floor');
checkpoint(BASIN.x0 + 3, BASIN.top, 'Checkpoint 4: the bottom of the plunge');
pyramid(BASIN.x0 + 6.5, BASIN.top, 'wood', 'Basin: stack after the checkpoint');
foe('grunt', BASIN.x0 + 16, BASIN.top, 2.5, 2.4, 'Crab: first met on foot, on roomy ground');
foe('spiker', BASIN.x0 + 29, BASIN.top, 2.5, 2.4, 'Bristleback: first met alone. Spin it; never land on it');
foe('turtle', BASIN.x0 + 41, BASIN.top, 1.5, 2, 'Mossback: land on it and its shell is a spring');
// A shell bounce heads 6.1 m; a double jump off the floor heads 5.5.
(['wood', 'mystery', 'wood'] as const).forEach((kind, i) =>
  crate(BASIN.x0 + 40 + i * G, BASIN.top + 5.7, kind, 'Basin: the row over the Mossback, one shell bounce up'));

// ============================================================= 4 · CLIMB ==
actStone = SAND;
// Sixteen metres up, on foot, and no two stages of it the same. The way out
// of the basin is a trampoline under a 3 m wall: any jump onto it clears the
// wall, and Jump held from the landing to the top of the bounce throws you
// onto the perch above the ledge. (Let go on the way up and the rise is cut.)
floor(TRAMPOLINE.x0, TRAMPOLINE.x1, r(BASIN.top - 0.5), 'Basin: the bed under the trampoline', STONE_DARK);
add({ t: 'trampoline', p: [(TRAMPOLINE.x0 + TRAMPOLINE.x1) / 2, TRAMPOLINE.top, 0], s: [TRAMPOLINE.x1 - TRAMPOLINE.x0, 0.5, DEPTH],
  speed: TRAMPOLINE.speed, amp: TRAMPOLINE.held, grp: GR.hazards, nm: 'Trampoline: jump onto it; keep Jump held through the bounce for the high one' });
for (const h of [1.6, 2.8, 4]) fruit(TRAMPOLINE.x0 + 2, TRAMPOLINE.top + h);
export const LEDGE_A = { x0: BASIN.x1, x1: BASIN.x1 + 18, top: r(BASIN.top + 3) };
floor(LEDGE_A.x0, LEDGE_A.x1, LEDGE_A.top, 'Climb: first ledge');
export const PERCH = { x0: LEDGE_A.x0 + 1.5, x1: LEDGE_A.x0 + 7.5, top: r(LEDGE_A.top + 3.8) };
slab(PERCH.x0, PERCH.x1, PERCH.top, 'Climb: the perch only the held bounce reaches');
pyramid(PERCH.x0 + 3, PERCH.top, 'mystery', 'Climb: stack on the perch');
foe('floater', LEDGE_A.x0 + 12, LEDGE_A.top, 2, 2, 'Watcher: first met on roomy ground. Spin it as it swoops');
// A lift, met with solid ground under it: its deck rests flush in a recess
// of the ledge, and a walker who arrives while it is up is simply collected.
export const LIFT1 = { x0: LEDGE_A.x1, x1: LEDGE_A.x1 + 4, low: LEDGE_A.top, high: r(LEDGE_A.top + 5), speed: 0.9 };
floor(LIFT1.x0, LIFT1.x1, r(LIFT1.low - 0.5), 'Climb: the recess the first lift rests in', STONE_DARK);
add({ t: 'mover', p: [(LIFT1.x0 + LIFT1.x1) / 2, r((LIFT1.low + LIFT1.high) / 2), 0], s: [LIFT1.x1 - LIFT1.x0, 0.5, DEPTH],
  axis: 'y', amp: r((LIFT1.high - LIFT1.low) / 2), speed: LIFT1.speed, phase: -1.57, grp: GR.hazards,
  nm: 'Lift: first met over solid ground' });
export const LEDGE_B = { x0: LIFT1.x1, x1: LIFT1.x1 + 16, top: LIFT1.high };
floor(LEDGE_B.x0, LEDGE_B.x1, LEDGE_B.top, 'Climb: second ledge');
checkpoint(LEDGE_B.x0 + 3, LEDGE_B.top, 'Checkpoint 5: the top of the first lift');
pyramid(LEDGE_B.x0 + 5.5, LEDGE_B.top, 'mystery', 'Climb: stack on the second ledge');
// Timed footing. The first pad bridges a gap a jump clears anyway, in view of
// a fixed floor to watch a whole cycle from: lit 2.4 s in every 4, strobing
// through its last 0.9. The pair after it alternates over a drop — when the
// pad under you starts to strobe, the one ahead has just lit.
export const PHASE = { cycle: 4, share: 0.6 };
export const PHASE_DEBUT = { x0: LEDGE_B.x1, x1: LEDGE_B.x1 + 4.5, phase: 0 };
pit(PHASE_DEBUT.x0, PHASE_DEBUT.x1, LEDGE_B.top, 'Climb: a gap a jump clears, bridged by the first timed pad');
const REST_X0 = PHASE_DEBUT.x1;
const REST_X1 = REST_X0 + 12;
floor(REST_X0, REST_X1, LEDGE_B.top, 'Climb: fixed floor between the timed pads');
pyramid(REST_X0 + 2.5, LEDGE_B.top, 'wood', 'Climb: stack between the timed pads');
export const PHASE_PAIR = [
  { x0: REST_X1 + 0.5, x1: REST_X1 + 5.25, phase: 0 },
  { x0: REST_X1 + 6.75, x1: REST_X1 + 11.5, phase: 0.5 },
];
const BANK_X0 = REST_X1 + 12;
pit(REST_X1, BANK_X0, LEDGE_B.top, 'Climb: the drop under the timed pair');
for (const pad of [PHASE_DEBUT, ...PHASE_PAIR])
  add({ t: 'phasepad', p: [(pad.x0 + pad.x1) / 2, LEDGE_B.top, 0], s: [pad.x1 - pad.x0, 0.5, DEPTH],
    cycle: PHASE.cycle, amp: PHASE.share, phase: pad.phase, grp: GR.hazards,
    nm: pad === PHASE_DEBUT ? 'Timed pad: first met over a gap a jump clears' : 'Timed pair: each lights as the other starts to strobe' });
// The lift again, now over a drop: wait on the bank for the deck, ride it up.
const BANK_X1 = BANK_X0 + 14;
floor(BANK_X0, BANK_X1, LEDGE_B.top, 'Climb: the bank of the second lift');
foe('floater', BANK_X0 + 4, LEDGE_B.top, 1.5, 2, 'Watcher: over the bank where you wait for the lift');
// (Its deck dips 0.4 m under the bank at the bottom of its travel, so there is
// a second and more in which stepping on is stepping DOWN.)
export const LIFT2 = { x0: BANK_X1, x1: BANK_X1 + 4, low: LEDGE_B.top, high: r(LEDGE_B.top + 5), dip: 0.4, speed: 0.9 };
pit(LIFT2.x0, LIFT2.x1, LEDGE_B.top, 'Climb: the shaft under the second lift');
add({ t: 'mover', p: [(LIFT2.x0 + LIFT2.x1) / 2, r((LIFT2.low - LIFT2.dip + LIFT2.high) / 2), 0], s: [LIFT2.x1 - LIFT2.x0, 0.5, DEPTH],
  axis: 'y', amp: r((LIFT2.high - LIFT2.low + LIFT2.dip) / 2), speed: LIFT2.speed, phase: 1.57, grp: GR.hazards,
  nm: 'Lift: the same lift over a drop' });
export const LEDGE_C = { x0: LIFT2.x1, x1: LIFT2.x1 + 20, top: LIFT2.high };
floor(LEDGE_C.x0, LEDGE_C.x1, LEDGE_C.top, 'Climb: third ledge');
checkpoint(LEDGE_C.x0 + 3, LEDGE_C.top, 'Checkpoint 6: the top of the second lift');
pyramid(LEDGE_C.x0 + 6, LEDGE_C.top, 'mask', 'Climb: a mask before the frog, the ferry and the gallery');
overhead(LEDGE_C.x0 + 8.6, LEDGE_C.top, ['wood', 'wood', 'mystery'], 'Climb: overhead row on the third ledge');
foe('hopper', LEDGE_C.x0 + 14, LEDGE_C.top, 2, 2.4, 'Spring frog: first met on roomy ground');
// A ferry over a 16 m drop, and the Bristleback from the basin waiting where
// it lands: the spin you learned on open ground, now at the end of a ride.
export const FERRY = { x0: LEDGE_C.x1, x1: LEDGE_C.x1 + 16, top: LEDGE_C.top, width: 4, amp: 5.9, speed: 0.8 };
pit(FERRY.x0, FERRY.x1, FERRY.top, 'Climb: the drop the ferry crosses');
add({ t: 'mover', p: [(FERRY.x0 + FERRY.x1) / 2, FERRY.top, 0], s: [FERRY.width, 0.5, DEPTH],
  axis: 'x', amp: FERRY.amp, speed: FERRY.speed, phase: 1.57, grp: GR.hazards, nm: 'Ferry: rests a moment at each bank' });
export const GALLERY = { x0: FERRY.x1, x1: FERRY.x1 + 36, top: FERRY.top };
floor(GALLERY.x0, GALLERY.x1, GALLERY.top, 'Climb: the crusher gallery');
foe('spiker', GALLERY.x0 + 5, GALLERY.top, 2, 2.4, 'Bristleback: waiting where the ferry lands');
checkpoint(GALLERY.x0 + 10, GALLERY.top, 'Checkpoint 7: the far bank, before the crushers');
// Two crushers half a cycle apart (hang 1.2 s, slam, rest 0.8 s as a wall,
// rise 1 s), six metres of fixed floor before the first, and a crab on the
// far side of the second.
export const CRUSHERS = [{ x: GALLERY.x0 + 15.5, phase: 0 }, { x: GALLERY.x0 + 24.5, phase: 1.6 }];
for (const [i, c] of CRUSHERS.entries())
  add({ t: 'crusher', p: [c.x, GALLERY.top, 0], s: [3, 3, DEPTH], cycle: 3.2, phase: c.phase, grp: GR.hazards,
    nm: i === 0 ? 'Crusher: first met alone, with a floor to watch it from' : 'Crusher: half a cycle behind the first' });
// (The row between them is the dare: there is a second and a half to head it in.)
overhead(GALLERY.x0 + 19.05, GALLERY.top, ['wood', 'mystery', 'wood'], 'Climb: overhead row between the crushers');
foe('grunt', GALLERY.x0 + 31, GALLERY.top, 2, 2.4, 'Crab: just past the second crusher');
const RISE = { x0: GALLERY.x1, x1: GALLERY.x1 + 8, top: r(GALLERY.top + STEP) };
floor(RISE.x0, RISE.x1, RISE.top, 'Climb: step up');
pyramid(RISE.x0 + 3.2, RISE.top, 'wood', 'Climb: stack on the step');

// ============================================================ 5 · VALLEY ==
actStone = STONE;
// The top of the course, and the long way down on the board: a 7 m drop into
// a flat 28 m long. A stack stands on the riding line (the drop brings more
// than the 12.5 m/s that smashes it) and the crab from the basin patrols
// beyond it: the same spin, at twice the speed. A mask waits on the brink.
export const VALLEY_BRINK = { x0: RISE.x1, x1: RISE.x1 + 10, top: r(RISE.top + STEP) };
floor(VALLEY_BRINK.x0, VALLEY_BRINK.x1, VALLEY_BRINK.top, 'Valley: the brink');
checkpoint(VALLEY_BRINK.x0 + STEP_CP, VALLEY_BRINK.top, 'Checkpoint 8: before the valley');
crate(VALLEY_BRINK.x0 + 6, VALLEY_BRINK.top, 'mask', 'Valley: a mask before the crab on the line');
crate(VALLEY_BRINK.x0 + 6 + G, VALLEY_BRINK.top, 'wood', 'Valley: the mask stands in a pair');
export const VALLEY = pipe('P3 valley pipe', VALLEY_BRINK.x1 + 4, VALLEY_BRINK.top - 7, 14, [7, 4.5], [4, 6]);
fruitOnWall(VALLEY, -1, 6);
export const VALLEY_STACK = { x: VALLEY.cross - 8 };
crate(VALLEY_STACK.x, VALLEY.floorY, 'wood', 'Valley: a stack on the riding line, smashed at speed');
crate(VALLEY_STACK.x, VALLEY.floorY + G, 'wood', 'Valley: a stack on the riding line, smashed at speed');
for (const dx of [-4, -2, 0]) fruit(VALLEY.cross + dx, VALLEY.floorY + 1.0);
foe('grunt', VALLEY.cross + 6, VALLEY.floorY, 2, 1.6, 'Crab: on the flat of the valley, on the riding line');
fruitOnWall(VALLEY, 1, 4);
fruitOverLip(VALLEY, 1, [1.5, 3]);
const VALLEY_OUT = VALLEY.eastLip + VALLEY.eastDeck;
floor(VALLEY_OUT, VALLEY_OUT + 12, VALLEY.eastLipY, 'Valley: landing floor');
overhead(VALLEY_OUT + 3.5, VALLEY.eastLipY, ['wood', 'wood', 'mystery'], 'Valley: overhead row past the landing');

// ============================================================ 6 · SWITCH ==
// A step and three short jumps on foot with a rest, then the pipe with no
// way out: its east wall backs onto a hole. The `!` hangs over the west lip
// — the lip a held-right rider only visits on the swing BACK — and heading
// it out of a hang turns the slab solid.
const HOPS_TOP = r(VALLEY.eastLipY + STEP);
const HOPS_X0 = VALLEY_OUT + 12;
floor(HOPS_X0, HOPS_X0 + 6, HOPS_TOP, 'Switch approach: step up');
pit(HOPS_X0 + 6, HOPS_X0 + 9.5, HOPS_TOP, 'Switch approach: first gap');
floor(HOPS_X0 + 9.5, HOPS_X0 + 13.5, HOPS_TOP, 'Switch approach: stepping floor');
pit(HOPS_X0 + 13.5, HOPS_X0 + 17, HOPS_TOP, 'Switch approach: second gap');
const SWITCH_TOP = r(HOPS_TOP + 0.8);
floor(HOPS_X0 + 17, HOPS_X0 + 21, SWITCH_TOP, 'Switch approach: stepping floor (up)');
pit(HOPS_X0 + 21, HOPS_X0 + 24, SWITCH_TOP, 'Switch approach: third gap');
const SWITCH_X0 = HOPS_X0 + 24;
floor(SWITCH_X0, SWITCH_X0 + 10, SWITCH_TOP, 'Switch pipe: approach floor');
for (const [x, top] of [[HOPS_X0 + 11.5, HOPS_TOP], [HOPS_X0 + 19, SWITCH_TOP], [SWITCH_X0 + 2, SWITCH_TOP]])
  fruit(x, top + 1.15);
checkpoint(SWITCH_X0 + 3.5, SWITCH_TOP, 'Checkpoint 9: before the switch pipe');
pyramid(SWITCH_X0 + 6, SWITCH_TOP, 'mystery', 'Switch pipe: on-foot stack on the approach');
export const SWITCH_PIPE = pipe('P4 switch pipe', SWITCH_X0 + 14, SWITCH_TOP - 3.5, 2.5, [3.5, 3.5], [4, 0]);
// 6 m over the lip: a double jump off the deck heads 5.5 m, so only a hang
// reaches it — and the first west hang of a held-right swing (7 m) does.
export const SWITCH = { x: SWITCH_PIPE.westLip + 0.08, y: SWITCH_PIPE.westLipY + 6 };
crate(SWITCH.x, SWITCH.y, 'bang', 'Switch: the ! over the west lip, headed out of a hang',
  { grp: GR.switchExit });
export const SWITCH_SLAB = { x0: SWITCH_PIPE.eastLip, x1: SWITCH_PIPE.eastLip + 9, top: SWITCH_TOP };
add({ t: 'mesh', p: [(SWITCH_SLAB.x0 + SWITCH_SLAB.x1) / 2, SWITCH_TOP - 0.45, 0],
  s: [SWITCH_SLAB.x1 - SWITCH_SLAB.x0, 0.9, DEPTH], ...CUBE, tex: 'stone', color: ACCENT,
  outline: true, grp: GR.switchExit, nm: 'Switch: exit slab, solid once the ! is hit' });
pit(SWITCH_SLAB.x0 + 2.2, SWITCH_SLAB.x1, SWITCH_TOP, 'Switch: the hole behind the east wall');
// The floor past the slab is long and plain, for one timed enemy met alone:
// the Whirler's blades are out 2.2 s and in 1.35. Wait short of it; go in.
export const SWITCH_OUT = { x0: SWITCH_SLAB.x1, x1: SWITCH_SLAB.x1 + 20, top: SWITCH_TOP };
floor(SWITCH_OUT.x0, SWITCH_OUT.x1, SWITCH_TOP, 'Switch pipe: landing floor');
overhead(SWITCH_OUT.x0 + 4, SWITCH_TOP, ['mystery', 'wood', 'wood'], 'Switch pipe: overhead row past the landing');
foe('spinner', SWITCH_OUT.x0 + 14, SWITCH_TOP, 0, 0, 'Whirler: first met alone, with a floor to wait on');

// =========================================================== 7 · CASCADE ==
actStone = SLATE;
// Down again, by board, and this time the spine is the staircase: three
// pipes share two ridges, and each floor lies 7 m under the ridge before it.
// A held direction clears the first ridge in one swing; after that each
// transfer drops you further than the wall ahead climbs.
const CASCADE_X0 = SWITCH_OUT.x1;
floor(CASCADE_X0, CASCADE_X0 + 9, SWITCH_TOP, 'Cascade: approach floor');
checkpoint(CASCADE_X0 + 2.5, SWITCH_TOP, 'Checkpoint 10: before the cascade');
pyramid(CASCADE_X0 + 5, SWITCH_TOP, 'wood', 'Cascade: on-foot stack on the approach');
export const C1 = pipe('P5 cascade top pipe', CASCADE_X0 + 13, SWITCH_TOP - 3.5, 2, [3.5, 5.5], [4, 0]);
fruitOverLip(C1, -1, [1.4, 2.6, 3.8]);
fruitOnWall(C1, 1, 4);
export const C2 = pipe('P6 cascade middle pipe', C1.eastLip, C1.eastLipY - 7, 2, [7, 5], [0, 0]);
fruitOnWall(C2, -1, 5);
fruitOnWall(C2, 1, 4);
export const C3 = pipe('P7 cascade last pipe', C2.eastLip, C2.eastLipY - 7, 2.5, [7, 3.5], [0, 6]);
fruitOnWall(C3, -1, 5);
fruitOnWall(C3, 1, 3);
fruitOverLip(C3, 1, [1.5, 3, 4.5]);
export const CASCADE_OUT = { x0: C3.eastLip + C3.eastDeck, x1: C3.eastLip + C3.eastDeck + 14, top: C3.eastLipY };
floor(CASCADE_OUT.x0, CASCADE_OUT.x1, CASCADE_OUT.top, 'Cascade: landing floor');
overhead(CASCADE_OUT.x0 + 5, CASCADE_OUT.top, ['wood', 'mystery', 'wood'], 'Cascade: overhead row past the landing');

// ============================================================== 8 · RAIL ==
actStone = STONE;
// A bare east wall again and no switch: the rail that starts over its lip is
// the road out. A vertical hang brings no speed along a rail (the grind
// starts at 3.5 m/s, where the balance needle runs away fastest), so this
// one falls away steeply at once: caught, it carries you — under a second,
// with the travel stick still held — and drops you into the next pipe.
const RAIL_TOP = r(CASCADE_OUT.top + STEP);
const RAIL_X0 = CASCADE_OUT.x1;
floor(RAIL_X0, RAIL_X0 + 8, RAIL_TOP, 'Rail pipe: step up');
checkpoint(RAIL_X0 + STEP_CP, RAIL_TOP, 'Checkpoint 11: before the rail pipe');
pyramid(RAIL_X0 + STEP_BOXES, RAIL_TOP, 'wood', 'Rail pipe: on-foot stack after the checkpoint');
export const RAIL_PIPE = pipe('P8 rail pipe', RAIL_X0 + 12, RAIL_TOP - 3.5, 2.5, [3.5, 3.5], [4, 0]);
fruitOverLip(RAIL_PIPE, -1, [1.4, 2.6, 3.8]);
// ...and up the EAST hang line to the rail: the way to it is a hang off the
// lip with the grind button pressed in the air. (Held up the wall instead, the
// button parks a lip stall on the coping, 3 m short.)
fruitOverLip(RAIL_PIPE, 1, [1.0, 2.0]);
/** A rail from `[x0, y0]` through `nodes` ([dx, dy] from its start), with fruit along it. */
function railLine(x0: number, y0: number, nodes: [number, number][], nm: string): { x0: number; y0: number; x1: number; y1: number } {
  add({ t: 'rail', p: [x0, y0, 0], pts: nodes.map(([dx, dy]) => [dx, 0, 0, dy]), color: ACCENT, grp: GR.finish, nm });
  for (let i = 1; i < nodes.length; i++) {
    const [ax, ay] = nodes[i - 1];
    const [bx, by] = nodes[i];
    const count = Math.max(1, Math.round((bx - ax) / 4));
    for (let k = 1; k <= count; k++)
      fruit(x0 + ax + (bx - ax) * k / (count + 1), y0 + ay + (by - ay) * k / (count + 1) + 0.6);
  }
  const [dx, dy] = nodes[nodes.length - 1];
  return { x0, y0, x1: x0 + dx, y1: r(y0 + dy) };
}
export const RAIL = railLine(RAIL_PIPE.eastLip - 0.25, r(RAIL_PIPE.eastLipY + 3.1), [[0, 0], [3, -2.6], [12.25, -4.4]],
  'Rail: out over the east lip and down into the next pipe');
// The pipe it ends in has a west wall a metre high and nothing behind it: its
// flat lies 1.3 m under the rail's end, and its decked east wall is the exit.
export const RAIL_CATCH = pipe('P9 rail catch pipe', RAIL.x1 - 1.5, RAIL.y1 - 1.3, 4, [1, 3.5], [0, 6]);
pit(RAIL_PIPE.eastLip + 2.2, RAIL_CATCH.westLip, RAIL_CATCH.floorY, 'Rail: the drop under the grind');
fruitOnWall(RAIL_CATCH, 1, 3);
export const RAIL_OUT = { x0: RAIL_CATCH.eastLip + RAIL_CATCH.eastDeck, x1: RAIL_CATCH.eastLip + RAIL_CATCH.eastDeck + 12, top: RAIL_CATCH.eastLipY };
floor(RAIL_OUT.x0, RAIL_OUT.x1, RAIL_OUT.top, 'Rail: landing floor');
overhead(RAIL_OUT.x0 + 3.5, RAIL_OUT.top, ['wood', 'wood', 'mystery'], 'Rail: overhead row past the landing');

// ========================================================= 9 · LONG RAIL ==
// The same catch, and now the rail is 52 m long and falls 16 m to the gate.
// It cannot be ridden on the travel stick: let go, and keep the needle in
// the middle with left and right. It eases, steepens and runs out level over
// the finish floor, and a clean grind leaves it at full speed.
const LONG_TOP = r(RAIL_OUT.top + STEP);
const LONG_X0 = RAIL_OUT.x1;
floor(LONG_X0, LONG_X0 + 8, LONG_TOP, 'Long rail pipe: step up');
checkpoint(LONG_X0 + STEP_CP, LONG_TOP, 'Checkpoint 12: before the long rail');
pyramid(LONG_X0 + STEP_BOXES, LONG_TOP, 'mystery', 'Long rail pipe: on-foot stack after the checkpoint');
export const LONG_PIPE = pipe('P10 long rail pipe', LONG_X0 + 12, LONG_TOP - 3.5, 2.5, [3.5, 3.5], [4, 0]);
fruitOverLip(LONG_PIPE, -1, [1.4, 2.6, 3.8]);
fruitOverLip(LONG_PIPE, 1, [1.0, 2.0]);
export const LONG_RAIL = railLine(LONG_PIPE.eastLip - 0.25, r(LONG_PIPE.eastLipY + 3.1),
  [[0, 0], [3, -2.6], [13, -4.6], [29, -11], [43, -15], [52, -16.2]], 'Long rail: down to the finish, on the balance');
const FINISH_TOP = r(LONG_RAIL.y1 - 1.3);
export const FINISH = { x0: LONG_RAIL.x1 - 3.5, x1: LONG_RAIL.x1 + 48.5, top: FINISH_TOP };
pit(LONG_PIPE.eastLip + 2.2, FINISH.x0, FINISH_TOP, 'Long rail: the drop under the grind');
floor(FINISH.x0, FINISH.x1, FINISH_TOP, 'Finish floor');
overhead(FINISH.x0 + 26, FINISH_TOP, ['wood', 'mystery', 'wood'], 'Finish: overhead exit count');
add({ t: 'gate', p: [FINISH.x0 + 38, FINISH_TOP, 0], yaw: 90, grp: GR.finish, nm: 'Finish gate' });

// ====================================================== camera and plane ==
const X_MIN = YARD_MISS.lipX - YARD_MISS.deck;
const X_MAX = FINISH.x1;
const MID = (X_MIN + X_MAX) / 2;
const SPAN = X_MAX - X_MIN;
// One plane: nothing on this course is ever played toward or away from the lens.
for (const z of [-0.83, 0.83])
  add({ t: 'wall', p: [MID, -30, z], s: [SPAN + 40, 90, 0.6], invisible: true, grp: GR.camera,
    nm: 'Single-plane side-scrolling boundary' });
add({ t: 'wall', p: [X_MIN - 0.3, START_TOP + 12, 0], s: [0.6, 40, DEPTH], invisible: true, grp: GR.camera, nm: 'West end stop' });
add({ t: 'wall', p: [X_MAX + 0.3, FINISH_TOP, 0], s: [0.6, 14, DEPTH], invisible: true, grp: GR.camera, nm: 'East end stop' });
// `sideOn` on the zone: the floors between pipes are one line too, so a board on
// them brakes when the stick is held against travel instead of trying to carve round.
add({ t: 'zone', p: [MID, 0, 0], s: [SPAN + 40, 1, 18], dir: 'E', sideOn: true, grp: GR.camera,
  nm: 'The whole course reads left to right, on one line' });
add({ t: 'camnode', p: [X_MIN - 10, START_TOP, 0], radius: 0, grp: GR.camera });
add({ t: 'camnode', p: [X_MAX + 10, FINISH_TOP, 0], radius: 0, grp: GR.camera });
// A LONG LENS, for a flat picture. The frame is the size it was through the
// rig's widest side view (18 m away at 49°: about 16 m tall on the play
// plane, so a whole pipe still fits from its west lip), but it is taken from
// 52 m through 18°. The 6 m of depth behind the line changes scale by 12 %
// front to back instead of 40 %, and a 6° eye (it was 13°) shows the tops of
// the decks as an edge rather than a floor running away from the camera.
const LENS = { fov: 18, distance: 52, pitch: 6 };
const EYE_UP = r(LENS.distance * Math.sin(LENS.pitch * Math.PI / 180));
const EYE_OUT = r(LENS.distance * Math.cos(LENS.pitch * Math.PI / 180));
add({ t: 'camnode', p: [MID, 6, 0], s: [SPAN + 60, 160, 18], cameraView: true, cameraPresentationOnly: true,
  cameraPosition: [MID, r(3.4 + EYE_UP), EYE_OUT], cameraTarget: [MID, 3.4, 0], cameraFollowDistance: LENS.distance,
  cameraKeepDistance: true, cameraTelephoto: true, cameraFov: LENS.fov, cameraAspect: 16 / 9, radius: 1, grp: GR.camera,
  nm: 'Flat side view through a long lens, wide enough to read a whole pipe' });

// Only the switch group wires anything (the `!` to its slab); the rest are
// folders for the editor's outliner.
const groups: CustomGroup[] = [
  { id: GR.floor, nm: 'Floors, gaps and checkpoints', editorOnly: true },
  { id: GR.pipes, nm: 'Side-on pipes', editorOnly: true },
  { id: GR.crates, nm: 'Crates and fruit', editorOnly: true },
  { id: GR.enemies, nm: 'Enemies', editorOnly: true },
  { id: GR.hazards, nm: 'Lifts, ferry, timed pads, falling slabs and crushers', editorOnly: true },
  { id: GR.camera, nm: 'Side view, travel zone and play plane', editorOnly: true },
  { id: GR.switchExit, nm: 'Switch pipe: the ! and its exit slab' },
  { id: GR.finish, nm: 'Exit rail and finish', editorOnly: true },
];

export const SIDE_PIPE_LAB_LEVEL: CustomLevelData = {
  v: 1,
  name: 'Side Pipe Lab',
  spawn: [-15, START_TOP + 0.12, 0],
  killY: -32,
  sky: 'day',
  components,
  groups,
};

// ================================================= the same course, head-on ==
// SIDE PIPE LAB (FORWARD) is the course above, part for part, with the lens
// behind the rider instead of beside him. Nothing in it is authored twice:
// it is this file's own component list without the camera group (the side
// view, its travel zone and the two walls that hold the play to one plane),
// so a change to the course is a change to both.
//
// What replaces that group:
//   - a lane from the west end to the east end. With no travel zone over it
//     the lane owns the frame: the camera follows from behind, looking east,
//     and forward on the stick is down the course;
//   - a view over the wall yard that turns that frame round to face WEST,
//     because the yard is played away from the course (the turn is asked
//     for over the 2.5 m behind the spawn and passes through the side view;
//     the rig takes about a second to come round, which at a run is the rest
//     of the way to the first wall);
//   - walls at the two edges of the 6 m the floors are deep. The whole width
//     is play here: a board carves on it, a walker can go round a stack;
//   - its own follow rig. A pipe met head-on has a near wall, and a camera
//     that trails low behind the rider loses him behind its deck: this one
//     rides higher and steeper than the game's (7.5 m up, 6.5 m back, 34°
//     down), and rises with him, so a hang ten metres over a lip stays in
//     the picture.
// The pipes are the same parts (`sideOn` on a vert is what says the course
// crosses it; the side-scrolling lab's zone says so too), so the drop-in over
// a lip, the pendulum, the hang, the air out and the run-up at a wall are the
// same moves, met going into the picture instead of across it.
// (One part moves. On the side-scrolling plane the stopwatch can only stand in
// the lane behind the spawn; here it stands beside that lane, so walking back
// to the yard does not start a time trial by accident.)
const course = components.filter(c => c.grp !== GR.camera)
  .map(c => c.t === 'clock' ? { ...c, p: [c.p[0], c.p[1], 2.2] as [number, number, number] } : c);
const forwardView: CustomComponent[] = [];
for (const z of [-(DEPTH / 2 + 0.3), DEPTH / 2 + 0.3])
  forwardView.push({ t: 'wall', p: [MID, -15, z], s: [SPAN + 40, 150, 0.6], invisible: true, grp: GR.camera,
    nm: 'Edge of the course: the floors are 6 m wide and so is the play' });
forwardView.push({ t: 'wall', p: [X_MIN - 0.3, START_TOP + 12, 0], s: [0.6, 40, DEPTH], invisible: true, grp: GR.camera, nm: 'West end stop' });
forwardView.push({ t: 'wall', p: [X_MAX + 0.3, FINISH_TOP, 0], s: [0.6, 14, DEPTH], invisible: true, grp: GR.camera, nm: 'East end stop' });
forwardView.push({ t: 'camnode', p: [X_MIN - 10, START_TOP, 0], radius: 0, grp: GR.camera });
forwardView.push({ t: 'camnode', p: [X_MAX + 10, FINISH_TOP, 0], radius: 0, grp: GR.camera });
/** The yard view's east face stands just behind the spawn, and its turn is complete this far in. */
export const FORWARD_YARD_VIEW = { x1: -15.2, turn: 2.5 };
const YARD_VIEW_X0 = X_MIN - 30;
forwardView.push({ t: 'camnode', p: [r((YARD_VIEW_X0 + FORWARD_YARD_VIEW.x1) / 2), 0, 0],
  s: [DEPTH + 40, 200, r(FORWARD_YARD_VIEW.x1 - YARD_VIEW_X0)], yaw: 90, cameraView: true, radius: FORWARD_YARD_VIEW.turn,
  grp: GR.camera, nm: 'Wall yard: the view turns round to face the walls' });

export const SIDE_PIPE_LAB_FORWARD_LEVEL: CustomLevelData = {
  v: 1,
  name: 'Side Pipe Lab (Forward)',
  spawn: [-15, START_TOP + 0.12, 0],
  killY: -32,
  sky: 'day',
  cameraRig: { camDist: 6.5, camHeight: 7.5, camPitch: 34, camFov: 56 },
  cameraAirLift: 1,
  components: JSON.parse(JSON.stringify([...course, ...forwardView])) as CustomComponent[],
  groups: groups.map(g => g.id === GR.camera ? { ...g, nm: 'Forward view: lane, yard view and edge walls' } : { ...g }),
};
