import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

/**
 * SIDE PIPE LAB — a side-scrolling test course whose path runs THROUGH
 * halfpipes seen across their section.
 *
 * The whole course is one east travel zone on a single plane (z = 0), viewed
 * from the south, so it reads left to right. Between pipes it is on-foot
 * platforming; at a pipe the walker crosses the coping of its west deck and is
 * dropped in on the board automatically (`sideOn` vertramps, see
 * `CustomComponent.sideOn`). Inside, the board rides the one line the camera
 * can see: holding a direction carves the walls for speed, holding X pumps
 * them harder, and reaching a lip pops a vertical hang. Holding the stick OUT
 * over a lip during that hang carries the air across it — onto a deck, or
 * over a shared ridge into the next ramp (a spine transfer).
 *
 * Five pipes, one idea each:
 *   P0  ROLL-IN     equal walls, decks both sides: drop in, hold right, air out.
 *   P1  PUMP        a low west wall and a 7 m east wall that is a spine. One
 *                   swing falls short; the west-lip hang on the way back buys
 *                   the height (or hold X and pump it in one), then the air
 *                   transfers over the ridge and rolls out of the landing ramp.
 *   P2  ENEMY       a crab patrols the flat: spin through it on the way across.
 *   P3  SWITCH      a bare east wall with nothing behind it. The `!` floats
 *                   over the WEST lip; head it out of a hang and the exit slab
 *                   turns solid.
 *   P4  RAIL        a bare east wall again: the way out is the rail above its
 *                   lip — catch it out of the hang and grind down to the gate.
 *
 * Every number here was measured with the real player in this engine
 * (tools/test-side-pipe-lab.mjs replays the route; docs/SIDE_ON_PIPES.md has
 * the table): a held direction alone climbs 4.45 m of P1's 7 m east wall on
 * the first swing and clears it on the second; the west hang of that swing
 * back heads a crate 6 m over a 3.5 m lip; the spine's landing ramp rolls
 * out at 23–30 m/s.
 */

const DEPTH = 6; // every floor and pipe is this deep; the play plane is z = 0
const BASE = -12; // floors are solid blocks down to here, below any camera frame
const PIT_DROP = 7; // a pit's pool sits this far under the floors it divides
// A step a charged ollie (1.7 m) cannot make and the hands can (2.4 m reach).
const CATCH = 2.1;
const LEDGE_CP = 2.8; // where a catch ledge's checkpoint stands, from its edge
const LEDGE_BOXES = 4.4; // ...and where its stack of boxes starts
const G = 0.96; // authored crate grid (crates are enlarged x1.2 at build time)

const STONE = '#6f7f8a';
const STONE_DARK = '#596872';
const PIPE = '#d7dcd6';
const ACCENT = '#e2a640';

const CUBE = {
  vertices: [-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, .5, -.5,
    -.5, -.5, .5, .5, -.5, .5, .5, .5, .5, -.5, .5, .5],
  indices: [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5],
};

const GR = { floor: 1, pipes: 2, crates: 3, enemies: 4, camera: 5, switchExit: 6, finish: 7 } as const;

/** Heights are sums of a few decimals; keep the authored data free of float dust. */
const r = (v: number): number => Math.round(v * 100) / 100;

const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };

/** A solid floor block from x0 to x1 whose top is `top`. */
const floor = (x0: number, x1: number, top: number, nm: string, color = STONE): void =>
  add({ t: 'platform', p: [r((x0 + x1) / 2), r((top + BASE) / 2), 0], s: [r(x1 - x0), r(top - BASE), DEPTH],
    tex: 'stone', color, grp: GR.floor, nm });
/** A lethal gap between two floors: the pool sits a short fall under `top`. */
const pit = (x0: number, x1: number, top: number, nm: string): void =>
  add({ t: 'pit', p: [r((x0 + x1) / 2), r(top - PIT_DROP), 0], s: [r(x1 - x0), 1, DEPTH + 0.4], grp: GR.floor, nm });
const crate = (x: number, y: number, kind: NonNullable<CustomComponent['kind']>, nm: string,
  extra: Partial<CustomComponent> = {}): void =>
  add({ t: 'crate', p: [r(x), r(y), 0], kind, grp: GR.crates, nm, ...extra });
const fruit = (x: number, y: number): void => add({ t: 'wumpa', p: [r(x), r(y), 0], grp: GR.crates });
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
// The lesson with nothing attached: walk off the deck, the board appears, and
// holding right through the far lip lands you on its deck.
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
fruitOnWall(P0, -1, 3);
fruitOnWall(P0, 1, 3);
for (const x of [-1.5, 0, 1.5]) fruit(P0.cross + x, P0.floorY + 1.0);
fruitOverLip(P0, -1, [1.4, 2.6, 3.8]);
// A pipe hands its rider on to the next floor still on the board, so the
// floor it lands on carries nothing a rolling board can trip over: a box or a
// checkpoint under 12.5 m/s is a tumble. Those wait on the far side of a
// CATCH LEDGE — a step just too tall to ollie, which stops the board and has
// its rider climb up by the hands, on foot for the platforming that follows.
floor(P0.eastLip + P0.eastDeck, 34, START_TOP, 'Roll-in: landing floor');
overhead(27.5, START_TOP, ['wood', 'mystery', 'wood'], 'Roll-in: overhead row past the landing');

// ============================================================== 1 · PUMP ==
// A catch ledge, one plain gap on foot, then the pipe whose east wall is
// nearly three times the height of the one you drop in from — and is the
// back of the next ramp. (Every pipe here is about 12 m lip to lip: the widest
// side view shows 13 m ahead, so the far wall is in frame from the near lip.)
const PUMP_TOP = r(START_TOP + CATCH);
// (A mounted rider's crate-contact box is 3 m tall and reaches a metre ahead:
// from the floor BELOW it clips anything within 2 m of a 2.1 m ledge's edge.
// So a catch ledge keeps its first 2.4 m bare, then checkpoint, then boxes.)
floor(34, 44, PUMP_TOP, 'Pump: catch ledge');
add({ t: 'checkpoint', p: [34 + LEDGE_CP, PUMP_TOP, 0], grp: GR.floor, nm: 'Checkpoint 1: on foot before the pump pipe' });
pyramid(34 + LEDGE_BOXES, PUMP_TOP, 'mystery', 'Pump: on-foot stack after the checkpoint');
pit(44, 47.5, PUMP_TOP, 'Gap before the pump pipe');
floor(47.5, 53, PUMP_TOP, 'Pump: approach floor');
for (const x of [48.5, 50, 51.5]) fruit(x, PUMP_TOP + 1.15);
export const P1 = pipe('P1 pump pipe', 57, PUMP_TOP - 2.5, 1.5, [2.5, 7], [4, 0]);
fruitOnWall(P1, 1, 5);
fruitOverLip(P1, -1, [1.5, 3, 4.5]);
// The reward for swinging back: a west hang's worth above the low lip.
crate(P1.westLip + 0.08, P1.westLipY + 8.2, 'life', 'Pump: life over the west lip, a full hang up');
// The landing ramp shares P1's east ridge and has no east wall at all: the
// transfer rolls straight out onto the run-out.
export const L1 = pipe('P1 spine landing ramp', P1.eastLip, P1.eastLipY - 5, 2, [5, 0]);
const RUN_TOP = L1.floorY;
export const RUNOUT = { x0: L1.eastLip, x1: L1.eastLip + 45, top: RUN_TOP };
floor(RUNOUT.x0, RUNOUT.x1, RUN_TOP, 'Pump: spine run-out');
// Two stacks to plough through at the speed the spine hands you (>= 12.5 m/s
// smashes; the exit leaves at 23+), spaced so one contact's loss recovers.
export const SMASH_STACKS = [RUNOUT.x0 + 9, RUNOUT.x0 + 19];
for (const x of SMASH_STACKS) {
  crate(x, RUN_TOP, 'wood', 'Run-out: smash stack');
  crate(x, RUN_TOP + G, 'wood', 'Run-out: smash stack');
}
for (let x = RUNOUT.x0 + 4; x < RUNOUT.x0 + 34; x += 3) fruit(x, RUN_TOP + 1.0);

// ============================================================= 2 · ENEMY ==
// The climb is on foot: the catch ledge, a gap, the crab met alone on a wide
// floor, a step — then the same crab on a pipe's flat, where the answer is the
// same spin at twice the speed. A mask waits on the approach first.
const CLIMB_TOP = r(RUN_TOP + CATCH);
floor(RUNOUT.x1, RUNOUT.x1 + 9, CLIMB_TOP, 'Climb: catch ledge');
add({ t: 'checkpoint', p: [RUNOUT.x1 + LEDGE_CP, CLIMB_TOP, 0], grp: GR.floor, nm: 'Checkpoint 2: on foot after the run-out' });
pyramid(RUNOUT.x1 + LEDGE_BOXES, CLIMB_TOP, 'wood', 'Climb: on-foot stack after the checkpoint');
pit(RUNOUT.x1 + 9, RUNOUT.x1 + 12, CLIMB_TOP, 'Climb: gap');
const CRAB_X0 = RUNOUT.x1 + 12;
floor(CRAB_X0, CRAB_X0 + 13, CLIMB_TOP, 'Climb: crab floor');
// The crab keeps to the far two thirds: the stack by the landing is cleared in peace first.
add({ t: 'enemy', foe: 'grunt', p: [CRAB_X0 + 8.5, CLIMB_TOP, 0], range: 2.5, speed: 2.4, grp: GR.enemies,
  nm: 'Crab: first met on foot, on roomy ground' });
crate(CRAB_X0 + 1.4, CLIMB_TOP, 'wood', 'Climb: crab floor stack');
crate(CRAB_X0 + 1.4, CLIMB_TOP + G, 'wood', 'Climb: crab floor stack');
crate(CRAB_X0 + 1.4 + G, CLIMB_TOP, 'mystery', 'Climb: crab floor stack');
const ENEMY_TOP = r(CLIMB_TOP + 1.6);
const ENEMY_X0 = CRAB_X0 + 13;
floor(ENEMY_X0, ENEMY_X0 + 9, ENEMY_TOP, 'Enemy pipe: approach floor (one step up)');
add({ t: 'checkpoint', p: [ENEMY_X0 + 2.5, ENEMY_TOP, 0], grp: GR.floor, nm: 'Checkpoint 3: before the enemy pipe' });
crate(ENEMY_X0 + 6, ENEMY_TOP, 'mask', 'Enemy pipe: a mask before the crab on the line');
crate(ENEMY_X0 + 6 + G, ENEMY_TOP, 'wood', 'Enemy pipe: the mask stands in a pair');
export const P2 = pipe('P2 enemy pipe', ENEMY_X0 + 13, ENEMY_TOP - 3.5, 2.5, [3.5, 3.5], [4, 6]);
add({ t: 'enemy', foe: 'grunt', p: [P2.cross, P2.floorY, 0], range: 1.4, speed: 1.6, grp: GR.enemies,
  nm: 'Crab: on the flat of the pipe, on the riding line' });
fruitOverLip(P2, -1, [1.4, 2.6, 3.8]);
const P2_OUT = P2.eastLip + P2.eastDeck;
floor(P2_OUT, P2_OUT + 10, ENEMY_TOP, 'Enemy pipe: landing floor');
overhead(P2_OUT + 3.5, ENEMY_TOP, ['wood', 'wood', 'mystery'], 'Enemy pipe: overhead row past the landing');

// ============================================================ 3 · SWITCH ==
// A catch ledge and three short jumps on foot with a rest, then the pipe with
// no way out: its east wall backs onto a hole. The `!` hangs over the west
// lip — the lip a held-right rider only visits on the swing BACK — and
// heading it out of a hang turns the slab solid.
const HOPS_TOP = r(ENEMY_TOP + CATCH);
const HOPS_X0 = P2_OUT + 10;
floor(HOPS_X0, HOPS_X0 + 6, HOPS_TOP, 'Switch approach: catch ledge');
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
add({ t: 'checkpoint', p: [SWITCH_X0 + 3.5, SWITCH_TOP, 0], grp: GR.floor, nm: 'Checkpoint 4: before the switch pipe' });
pyramid(SWITCH_X0 + 6, SWITCH_TOP, 'mystery', 'Switch pipe: on-foot stack on the approach');
export const P3 = pipe('P3 switch pipe', SWITCH_X0 + 14, SWITCH_TOP - 3.5, 2.5, [3.5, 3.5], [4, 0]);
// 6 m over the lip: a double jump off the deck heads 5.5 m, so only a hang
// reaches it — and the first west hang of a held-right swing (7 m) does.
export const SWITCH = { x: P3.westLip + 0.08, y: P3.westLipY + 6 };
crate(SWITCH.x, SWITCH.y, 'bang', 'Switch: the ! over the west lip, headed out of a hang',
  { grp: GR.switchExit });
export const SWITCH_SLAB = { x0: P3.eastLip, x1: P3.eastLip + 9, top: SWITCH_TOP };
add({ t: 'mesh', p: [(SWITCH_SLAB.x0 + SWITCH_SLAB.x1) / 2, SWITCH_TOP - 0.45, 0],
  s: [SWITCH_SLAB.x1 - SWITCH_SLAB.x0, 0.9, DEPTH], ...CUBE, tex: 'stone', color: ACCENT,
  outline: true, grp: GR.switchExit, nm: 'Switch: exit slab, solid once the ! is hit' });
pit(SWITCH_SLAB.x0 + 2.2, SWITCH_SLAB.x1, SWITCH_TOP, 'Switch: the hole behind the east wall');
floor(SWITCH_SLAB.x1, SWITCH_SLAB.x1 + 12, SWITCH_TOP, 'Switch pipe: landing floor');
overhead(SWITCH_SLAB.x1 + 4, SWITCH_TOP, ['mystery', 'wood', 'wood'], 'Switch pipe: overhead row past the landing');

// ============================================================== 4 · RAIL ==
// The last pipe has the same bare east wall and no switch: the rail that
// starts over its lip is the road out, and it runs downhill to the gate so
// the grind gathers the speed a vertical hang could not bring to it.
const RAIL_TOP = r(SWITCH_TOP + CATCH);
const RAIL_X0 = SWITCH_SLAB.x1 + 12;
floor(RAIL_X0, RAIL_X0 + 8, RAIL_TOP, 'Rail pipe: catch ledge');
add({ t: 'checkpoint', p: [RAIL_X0 + LEDGE_CP, RAIL_TOP, 0], grp: GR.floor, nm: 'Checkpoint 5: before the rail pipe' });
pyramid(RAIL_X0 + LEDGE_BOXES, RAIL_TOP, 'wood', 'Rail pipe: on-foot stack after the checkpoint');
export const P4 = pipe('P4 rail pipe', RAIL_X0 + 12, RAIL_TOP - 3.5, 2.5, [3.5, 3.5], [4, 0]);
fruitOverLip(P4, -1, [1.4, 2.6, 3.8]);
// ...and up the EAST hang line to the rail: the way to it is a hang off the
// lip with the grind button pressed in the air. (Held up the wall instead, the
// button parks a lip stall on the coping, 3 m short.)
fruitOverLip(P4, 1, [1.0, 2.0]);
// A vertical hang brings no speed along the rail (the grind starts at 3.5 m/s,
// where the balance needle runs away fastest), so the rail falls away steeply
// at once and only then levels out: the whole grind lasts under a second and
// leaves at 20 m/s. That is a debut — caught, it carries you — not a balance
// exam; a longer or flatter rail is the escalation.
export const RAIL = {
  x0: P4.eastLip - 0.25, y0: r(P4.eastLipY + 3.1),
  kneeX: P4.eastLip + 2.75, kneeY: r(P4.eastLipY + 0.5),
  x1: P4.eastLip + 12, y1: r(P4.eastLipY - 1.3),
};
add({ t: 'rail', p: [RAIL.x0, RAIL.y0, 0],
  pts: [[0, 0, 0, 0], [r(RAIL.kneeX - RAIL.x0), 0, 0, r(RAIL.kneeY - RAIL.y0)], [r(RAIL.x1 - RAIL.x0), 0, 0, r(RAIL.y1 - RAIL.y0)]],
  color: ACCENT, grp: GR.finish, nm: 'Rail: out over the east lip and down to the finish' });
const FINISH_TOP = r(P4.eastLipY - 2.6);
export const FINISH = { x0: P4.eastLip + 8.5, x1: P4.eastLip + 40, top: FINISH_TOP };
pit(P4.eastLip + 2.2, FINISH.x0, FINISH_TOP, 'Rail: the drop under the grind');
floor(FINISH.x0, FINISH.x1, FINISH_TOP, 'Finish floor');
for (const [x, y] of [[RAIL.x0 + 1.5, RAIL.y0 - 0.2], [RAIL.kneeX + 0.5, RAIL.kneeY + 1], [RAIL.kneeX + 3.5, RAIL.kneeY + 0.4],
  [RAIL.kneeX + 6.5, RAIL.kneeY - 0.2]]) fruit(x, y + 0.3);
overhead(FINISH.x0 + 16, FINISH_TOP, ['wood', 'mystery', 'wood'], 'Finish: overhead exit count');
add({ t: 'gate', p: [FINISH.x0 + 24, FINISH_TOP, 0], yaw: 90, grp: GR.finish, nm: 'Finish gate' });

// ====================================================== camera and plane ==
const X_MIN = -20;
const X_MAX = FINISH.x1;
const MID = (X_MIN + X_MAX) / 2;
const SPAN = X_MAX - X_MIN;
// One plane: nothing on this course is ever played toward or away from the lens.
for (const z of [-0.83, 0.83])
  add({ t: 'wall', p: [MID, -16, z], s: [SPAN + 40, 70, 0.6], invisible: true, grp: GR.camera,
    nm: 'Single-plane side-scrolling boundary' });
add({ t: 'wall', p: [X_MIN - 0.3, START_TOP, 0], s: [0.6, 14, DEPTH], invisible: true, grp: GR.camera, nm: 'West end stop' });
add({ t: 'wall', p: [X_MAX + 0.3, FINISH_TOP, 0], s: [0.6, 14, DEPTH], invisible: true, grp: GR.camera, nm: 'East end stop' });
// `sideOn` on the zone: the floors between pipes are one line too, so a board on
// them brakes when the stick is held against travel instead of trying to carve round.
add({ t: 'zone', p: [MID, 0, 0], s: [SPAN + 40, 1, 18], dir: 'E', sideOn: true, grp: GR.camera,
  nm: 'The whole course reads left to right, on one line' });
add({ t: 'camnode', p: [X_MIN - 10, START_TOP, 0], radius: 0, grp: GR.camera });
add({ t: 'camnode', p: [X_MAX + 10, FINISH_TOP, 0], radius: 0, grp: GR.camera });
// The widest side view the rig offers (18 m), from the south and a little
// above: a whole pipe fits the frame from its west lip, and the raised eye
// shows the open trough and the tops of the decks rather than a flat section.
add({ t: 'camnode', p: [MID, 6, 0], s: [SPAN + 60, 120, 18], cameraView: true, cameraPresentationOnly: true,
  cameraPosition: [MID, 8.4, 21.6], cameraTarget: [MID, 3.4, 0], cameraFollowDistance: 18,
  cameraKeepDistance: true, cameraFov: 49, cameraAspect: 16 / 9, radius: 1, grp: GR.camera,
  nm: 'Side view wide enough to read a whole pipe' });

// Only the switch group wires anything (the `!` to its slab); the rest are
// folders for the editor's outliner.
const groups: CustomGroup[] = [
  { id: GR.floor, nm: 'Floors, gaps and checkpoints', editorOnly: true },
  { id: GR.pipes, nm: 'Side-on pipes', editorOnly: true },
  { id: GR.crates, nm: 'Crates and fruit', editorOnly: true },
  { id: GR.enemies, nm: 'Crabs', editorOnly: true },
  { id: GR.camera, nm: 'Side view, travel zone and play plane', editorOnly: true },
  { id: GR.switchExit, nm: 'Switch pipe: the ! and its exit slab' },
  { id: GR.finish, nm: 'Exit rail and finish', editorOnly: true },
];

export const SIDE_PIPE_LAB_LEVEL: CustomLevelData = {
  v: 1,
  name: 'Side Pipe Lab',
  spawn: [-15, START_TOP + 0.12, 0],
  killY: -16,
  sky: 'day',
  components,
  groups,
};
