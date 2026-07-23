// A long linear test course structured like Crash 1's N. Sanity Beach: a wide
// "beach" intro, a funnel into corridor sections with crate/enemy rhythm,
// gaps, two grind rails over pits, checkpoints, and a fast downhill finish.
// The course runs along -Z, roughly 860 units, ~1-2 minutes of play.

import * as THREE from 'three';
import { Rail } from './rails';
import { Halfpipe } from './halfpipe';
import { CONST, TUNING } from './tuning';
import { sfx } from './audio';

export interface Crate {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
  nitro?: boolean; // green, bobbing, touch = instant detonation
  bouncy?: boolean; // WOOD arrow crate: stomp = super bounce; spin/slam breaks it
  metalBounce?: boolean; // METAL arrow crate: same bounce, never breaks, uncounted
  tnt?: boolean; // red TNT: solid box; stomp lights the 3-2-1 fuse, spin/slam detonates
  fuse?: number; // seconds left on a lit TNT
  mask?: boolean; // Aku crate: breaking it grants a protective mask
  mystery?: boolean; // ? crate: random reward (wumpa burst, mask, or a life)
  bang?: boolean; // metal '!' SWITCH: hitting it materializes its group's outline crates; never breaks, uncounted
  bangUsed?: boolean; // the switch fires once, then dims
  nitroBang?: boolean; // green '!' crate: breaking it detonates every nitro on the map
  pending?: boolean; // OUTLINE state: ghost visual, no collision, no interactions — until a '!' fires
  wasOutline?: boolean; // authored as an outline: resets re-ghost it
  groupIds?: number[]; // editor group chain: wires '!' switches to their outlines
  realMat?: THREE.Material; // the true face (kept while ghosted)
  ghostMat?: THREE.Material; // the translucent shell (kept for resets)
  ghostEdges?: THREE.LineSegments; // outline wireframe, hidden on materialize
  timeSecs?: number; // TIME TRIAL: breaking this crate freezes the clock this many seconds
  boost?: 'speed' | 'balance'; // COMBO RUN: breaking this crate = a speed burst / a perfect-balance window
  ttOrigMap?: THREE.Texture | null; // the normal-mode face, restored when the trial ends
}

// Functionally distinct foes. Defeat rules and movement differ per kind —
// the level's update owns each FSM and publishes per-frame combat flags
// (spinKill/stompKill/...) that the player's collision simply reads.
export type EnemyKind =
  | 'grunt' // baseline: patrols, any attack kills, touch hurts
  | 'spiker' // SPIN-ONLY: spikes on top, stomping it hurts you
  | 'turtle' // STOMP-ONLY: hard shell, a spin just recoils it
  | 'charger' // bull: patrol → telegraph → dash (invincible) → recover
  | 'hopper' // frog: leaps in arcs; stompable only while grounded
  | 'floater' // drone: hovers above stomp range, swoops; spin it down
  | 'sentry' // turret: stationary, tracks + fires slow orbs on a cycle
  | 'spinner'; // sawblade: blades OUT = untouchable touch-kill, IN = vulnerable

export interface Enemy {
  group: THREE.Group;
  box: THREE.Box3;
  alive: boolean;
  x0: number; // patrol bounds — x for corridor levels, z for side-scroll levels
  x1: number;
  dir: number;
  speed: number;
  axis?: 'x' | 'z';
  // Spun enemies ping away ballistically and can smash what they hit.
  flungVel?: THREE.Vector3;
  flungT?: number;
  // Arena-fight enemies stay hidden until their wave is called.
  arenaWave?: number;
  // ---- typed foes ----
  kind: EnemyKind;
  state: string; // per-kind FSM state
  stateT: number; // seconds accumulated in the current state / cycle
  baseY: number; // deck level; hop/float/dash offsets work from here
  cross: number; // fixed cross-axis coordinate (facing / aim reference)
  body: THREE.Mesh; // main body mesh, for squash/flash/state anims
  vy: number; // hopper vertical velocity
  // per-frame combat flags the player's collision reads (set each update):
  spinKill: boolean; // a spin attack defeats it now
  stompKill: boolean; // a jump-stomp defeats it now
  meleeKill: boolean; // slide / uber / slam defeats it now
  touchHurt: boolean; // plain body contact hurts the player now
  spinRecoil: boolean; // spinning into it (when !spinKill) is SAFE + knocks it back
}

// A slow orb lobbed by a sentry. Straight-line flight; hitting the player
// hurts (mask/die), same as any touch hazard.
interface SlideRibbon {
  curve: THREE.CatmullRomCurve3;
  len: number;
  width: number;
  frame: (t: number, off: number, h: number) => THREE.Vector3;
}

interface Projectile {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  box: THREE.Box3;
}

// Moving platform: slides along one axis on a sine, carrying the rider.
interface Mover {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  axisV: THREE.Vector3;
  amp: number;
  speed: number;
  phase: number;
  lastDelta: THREE.Vector3;
}

// Crumble pad: stand on it and it shakes, drops away, and (maybe) regrows.
interface Crumble {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  state: 'idle' | 'shake' | 'fall' | 'gone';
  t: number;
  regen: number | null; // seconds until it comes back; null = only on reset
  shakeTime: number; // seconds of shaking before it drops (near-0 = breaks on landing)
  fallSpeed: number; // how hard it drops once it goes (accel, world units/s²) — 30 is the classic tumble
  yaw: number; // resting spin (radians) — restored after the tumble-and-regrow animation
}

// Sky-bridge side rope: a grindable rail that SAGS + wobbles under a grinder
// and, if you linger, snaps and drops you into the void. Eases back to taut
// if you hop off in time.
interface SkyRope {
  rail: Rail;
  segs: THREE.Mesh[]; // visual rope segments, repositioned each frame to the live nodes
  rest: THREE.Vector3[]; // taut rest positions of the N+1 nodes
  state: 'idle' | 'sag' | 'break' | 'gone';
  t: number; // time in the current state / grind-load timer
  active: boolean; // being ground THIS frame (set by grindRope, cleared each update)
  breakTime: number; // seconds of continuous grinding before it snaps
  regen: number | null; // seconds to restring after it's gone; null = only on reset
  sagAmt: number; // how far the middle dips
}

// Timed crusher block: hangs, slams, rests, rises. Solid except when falling.
interface Crusher {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  restY: number; // block center when it sits on the deck
  raise: number; // how far above rest it hangs
  cycle: number;
  phase: number;
  crushing: boolean;
  slammed: boolean; // edge flag for the impact thud
}

// Swinging grab-rope: jump at it to hang on, climb its length, leap off with
// the swing's momentum. Pure driven pendulum — the player rides it, never
// bends it.
export interface RopeSwing {
  pivot: THREE.Group; // at the anchor; rotation.y = yaw, rotation.z = the swing
  anchor: THREE.Vector3;
  len: number;
  amp: number; // max swing angle (radians)
  speed: number; // drive frequency (rad/s)
  phase: number;
  yaw: number; // radians: spins the swing plane
  theta: number; // current angle (animated)
  thetaV: number; // current angular velocity (jump-off momentum)
}

// Swinging pendulum blade across the corridor.
interface Pendulum {
  pivot: THREE.Group;
  len: number;
  amp: number;
  speed: number;
  phase: number;
  yaw: number; // radians: spins the swing plane (and the gallows frame)
  box: THREE.Box3;
  lastSign: number;
}

// Per-level look: sky gradient, fog, lights, ambient particle weather.
export interface Theme {
  skyTop: string;
  skyBottom: string;
  sunColorHex: string; // sky-dome sun disc tint ('' = no disc)
  sunU: number; // disc position on the dome (0..1 around, 0..1 down from top)
  sunV: number;
  stars: boolean;
  fog: number;
  fogNear: number;
  fogFar: number;
  hemiSky: number;
  hemiGround: number;
  hemiI: number;
  sunColor: number;
  sunI: number;
  particleColor: number;
  particleWind: [number, number, number]; // drift per second (y up = rising embers)
}

// Rolling stone hazard: patrols along the course, flattens careless riders.
export interface Stone {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  x: number;
  z0: number;
  z1: number;
  dir: number;
  speed: number;
  r: number;
  chase?: boolean; // boulder-chase mode: rolls after the player instead of patrolling
}

// Floating wumpa, Crash-style: touch to collect (side-scroll levels).
export interface Pickup {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
}

export interface Checkpoint {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  active: boolean;
  spawnPos: THREE.Vector3;
  savedAlive: boolean[]; // crate alive-states captured when this was broken
  savedPending: boolean[]; // outline-ghost states captured alongside
  savedBangUsed: boolean[]; // '!' switch states captured alongside
  savedCratesBroken: number; // crate counter captured when this was broken
  savedFruit: number; // wumpa counter captured when this was broken
  savedMasks: number;
  savedPoints: number;
}

export const LEVEL_NAMES = [
  'Test Course', // the test course flows straight into the gauntlet (combined)
  'Sideways',
  'Random',
  'Boulder Dash',
  'The Flats',
  'Half Pipes',
  'Sky Bridge',
  'Custom', // built from CUSTOM_LEVEL data (the in-game level editor owns it)
  'The Overgrowth', // authored jungle corridor, built through the component pipeline
  'The Slipstream', // elevated ribbon slide: sweeping banked curves high over the sea
];

// ---- CUSTOM LEVEL: a data-driven course the in-game editor builds ----------
// Every component maps onto an existing primitive. Positions are centers
// (except where noted); pits are simply where you DON'T put floor — anything
// falling below killY dies.
export interface CustomComponent {
  t:
    | 'platform' // solid box: p = center, s = [w,h,d], yaw degrees
    | 'ramp' // slope along Z (low end at +Z): p = center of the base line, len along z, rise = height gained, w = width, yaw
    | 'wall' // solid barrier: p = base center, s = [w,h,d]; invisible = collider only (ghost in the editor)
    | 'rail' // grind rail: p = center (at rail height), len, yaw degrees (0 = along Z)
    | 'pipe' // halfpipe: p = trough center at ground, len along its axis, axis 'z'|'x'
    | 'crumble' // breakaway pad: p = top center, s = [w,-,d], shake = fall delay in seconds (0.02 = instant), speed = fall accel (default 30)
    | 'pit' // death zone: touch = wipeout; p = center of the dark pool, s = [w,-,d]
    | 'crate' // p = [x, deckY, z], kind picks the crate; outline = ghost until a '!' in its group is hit
    | 'metal' // unbreakable steel crate: solid terrain, spin/slam-proof
    | 'rock' // low-poly boulder: p = center, s = [w,h,d] bounds, seed shapes it; solid + walkable
    | 'camnode' // camera-lane node: nodes chain in order into the lane the camera + controls steer along
    | 'outline' // LEGACY ghost crate (old saves) — loads as a wood crate with outline: true
    | 'checkpoint'
    | 'enemy' // patrols along X around p, range each way
    | 'crusher' // stomping block: p = [x, deckY, z], s = [w,-,d], cycle seconds, phase
    | 'pendulum' // swinging bob: p = [x, pivotY, z], len arm, amp radians, speed
    | 'ropeswing' // swinging grab-rope: p = [x, anchorY, z], len rope, amp radians, speed (0 = natural pendulum), phase, yaw = swing plane
    | 'gate' // finish gate: crossing its plane ends the run; p = [x, deckY, z], yaw turns it with the course. One per level.
    | 'clock' // time-trial activator: the gold stopwatch near the start; p = [x, deckY, z]. One per level.
    | 'comboorb' // combo-run activator: the green plus near the start; p = [x, deckY, z]. One per level.
    | 'zone' // travel zone: inside its rect the course runs dir 'E'/'W' (side-scroll) or 'N' (run AT the camera); p = center, s = [w,-,d]
    | 'rope' // sagging grindable rope: p = center (rope height), len along yaw, amp = sag, shake = grind-seconds before it snaps
    | 'wumpa'
    | 'crystal'; // one per level (the editor enforces it)
  p: [number, number, number];
  s?: [number, number, number];
  len?: number;
  rise?: number;
  w?: number;
  yaw?: number;
  axis?: 'z' | 'x';
  shake?: number;
  kind?: 'wood' | 'bouncy' | 'metalbounce' | 'nitro' | 'tnt' | 'mask' | 'mystery' | 'bang' | 'nitrobang';
  outline?: boolean; // crate starts as a pass-through ghost; a grouped '!' makes it real
  range?: number;
  speed?: number;
  foe?: EnemyKind; // enemy variant (grunt/spiker/turtle/charger/hopper/floater/sentry/spinner)
  invisible?: boolean;
  cycle?: number;
  phase?: number;
  amp?: number;
  seed?: number; // rock: shapes the jitter deterministically
  // VECTOR SHAPE: node outline in XZ relative to p. 3+ points turns
  // platform/wall/pit into a polygon; 2+ points turns a rail into a
  // multi-node path. Each node's optional 3rd number is a CORNER RADIUS
  // (world units, Figma-style) — the corner gets filleted in the visual,
  // the collision, the kill footprint, and the grind line alike. The
  // optional 4th number is a HEIGHT OFFSET from p[1] — rails only (grind
  // lines climb and dive node to node; polygons stay planar, their
  // collision model depends on it).
  pts?: ([number, number] | [number, number, number] | [number, number, number, number])[];
  radius?: number; // camnode: corner radius where the camera lane turns at this node
  color?: string; // '#rrggbb' tint for platform / ramp / wall / crumble / rock
  tex?: string; // surface texture kind (see TEX_KINDS) for platform / ramp / wall / crumble / rock — tinted by color
  dir?: 'E' | 'W' | 'N' | 'S'; // zone: travel direction — E/W turn the course sideways (side-scroll), N runs it INTO the camera, S = the normal corridor (still overrides a camera lane)
  layer?: number; // LEGACY editor layer id (folded into lk by migration)
  grp?: number; // innermost editor group id — groups wire '!' crates to their outlines
  lk?: boolean; // editor lock: click-through, marquee-proof, edit-proof
  nm?: string; // editor display name (outliner rename)
}

// Every paintable surface kind the texture system offers. The editor's
// texture dropdown is built from this list; 'checker' is the classic default.
export const TEX_KINDS = [
  'checker',
  'grass',
  'jungle',
  'moss',
  'dirt',
  'sand',
  'stone',
  'wood',
  'plank',
  'pavement',
  'asphalt',
  'metal',
] as const;

// LEGACY: the old named-layer containers. Migration folds their locks into
// per-component lk flags; the outliner (items + groups) replaced them.
export interface CustomLayer {
  id: number;
  name: string;
  locked?: boolean;
}

export interface CustomGroup {
  id: number;
  parent?: number; // nesting: groups can live inside groups
  nm?: string; // editor display name (outliner rename)
}

export interface CustomLevelData {
  v: 1;
  name: string;
  spawn: [number, number, number];
  killY: number;
  components: CustomComponent[];
  layers?: CustomLayer[];
  groups?: CustomGroup[];
}

// the full ancestor chain of group ids for a component (innermost first)
export function groupChainOf(c: CustomComponent, data: CustomLevelData): number[] {
  const chain: number[] = [];
  let id = c.grp;
  let guard = 0;
  while (id !== undefined && guard++ < 64) {
    if (chain.includes(id)) break;
    chain.push(id);
    id = data.groups?.find((g) => g.id === id)?.parent;
  }
  return chain;
}

// Where a finish gate lands when a level never had one: the deck of the
// furthest down-course (-z) platform — guaranteed solid ground. Falls back
// to just past spawn on a level with no platforms at all.
function defaultGateFor(d: CustomLevelData): CustomComponent {
  let best: CustomComponent | null = null;
  for (const c of d.components) {
    if (c.t !== 'platform') continue;
    if (!best || c.p[2] < best.p[2]) best = c;
  }
  if (!best) return { t: 'gate', p: [d.spawn[0], Math.max(d.spawn[1] - 1, 0), d.spawn[2] - 12] };
  const top = best.p[1] + (best.s?.[1] ?? 1);
  // box decks: near the far (-z) edge; drawn blobs: their anchor point
  const gz = best.pts ? best.p[2] : best.p[2] - (best.s?.[2] ?? 8) / 2 + 2.5;
  return { t: 'gate', p: [+best.p[0].toFixed(2), +top.toFixed(2), +gz.toFixed(2)] };
}

// LEGACY MIGRATION: t:'outline' predates outline-as-a-state; load it as a
// wood crate flagged outline so the new '!' wiring applies uniformly. Named
// layer containers fold into per-component locks (the outliner replaced them).
export function migrateCustomLevel(d: CustomLevelData): CustomLevelData {
  d.components = d.components.map((c) =>
    c.t === 'outline' ? { ...c, t: 'crate' as const, kind: 'wood' as const, outline: true } : c,
  );
  if (d.layers && d.layers.length > 0) {
    const locked = new Set(d.layers.filter((l) => l.locked).map((l) => l.id));
    for (const c of d.components) {
      if (c.layer !== undefined && locked.has(c.layer)) c.lk = true;
      delete c.layer;
    }
    delete d.layers;
  }
  if (!d.groups) d.groups = [];
  // TIME TRIAL PARADIGM: every level carries a finish gate the same way it
  // carries a spawn point — without one a run could never end. Saves from
  // before gates existed get one on their furthest down-course deck (move it
  // wherever afterwards); duplicate gates collapse to the last one placed.
  const lastGate = d.components.map((c) => c.t).lastIndexOf('gate');
  if (lastGate === -1) d.components.push(defaultGateFor(d));
  else d.components = d.components.filter((c, i) => c.t !== 'gate' || i === lastGate);
  // RUN-MODE ACTIVATORS: the stopwatch and the combo orb are level furniture
  // the same way the spawn and the gate are — old saves get them beside the
  // spawn (move them wherever afterwards); duplicates collapse to the last.
  for (const t of ['clock', 'comboorb'] as const) {
    const last = d.components.map((c) => c.t).lastIndexOf(t);
    if (last === -1)
      d.components.push({ t, p: [d.spawn[0] + (t === 'clock' ? 2 : -2), d.spawn[1], d.spawn[2] - 5] });
    else d.components = d.components.filter((c, i) => c.t !== t || i === last);
  }
  return d;
}

// ---- THE OVERGROWTH: an authored Crash-1-style jungle corridor ------------
// Built entirely from editor components so it exercises the vector pipeline:
// every deck, bank, wall and pit is a pen-tool polygon with per-node corner
// radii, so all the edges read organic instead of boxy. Deterministic: a
// seeded LCG jitters the blob outlines, never Math.random.
function overgrownLevel(): CustomLevelData {
  let rng = 1337;
  const rand = (): number => {
    rng = (Math.imul(rng, 1103515245) + 12345) & 0x7fffffff;
    return rng / 0x7fffffff;
  };
  // organic outline: n points around an rx×rz oval, radius + angle jittered,
  // every node carrying a fat corner radius so roundCorners melts it soft
  const blob = (rx: number, rz: number, n = 9, wobble = 0.3): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / n);
      const kr = 1 - wobble / 2 + rand() * wobble;
      const fil = Math.min(rx, rz) * (0.35 + rand() * 0.3);
      pts.push([+(Math.cos(a) * rx * kr).toFixed(2), +(Math.sin(a) * rz * kr).toFixed(2), +fil.toFixed(2)]);
    }
    return pts;
  };
  const C: CustomComponent[] = [];
  // -- the dirt path: three organic decks with the two pits as true gaps
  const dirt = '#8a6a3f';
  C.push({ t: 'platform', p: [0, 0, 31], s: [1, 1, 1], pts: blob(10, 15.5), color: dirt, tex: 'dirt' });
  C.push({ t: 'platform', p: [0, 0, -14], s: [1, 1, 1], pts: blob(10, 14.5), color: dirt, tex: 'dirt' });
  C.push({ t: 'platform', p: [0, 0, -60], s: [1, 1, 1], pts: blob(12.5, 14.5), color: '#7d6038', tex: 'jungle' });
  // -- PIT ONE: the corridor gap, crossed by a narrow orange truss beam.
  // Pool sits a unit below the decks so the kill band can never reach feet
  // standing on an overlapping deck rim — and the hole reads DEEP.
  C.push({ t: 'pit', p: [0, -0.5, 8], pts: blob(10.8, 8.2, 10, 0.22) });
  // earthen pit lining: dark faces descending into the black
  C.push({ t: 'wall', p: [0, -1.9, 15.2], s: [19, 1.5, 0.8], color: '#33261a' });
  C.push({ t: 'wall', p: [0, -1.9, 0.8], s: [19, 1.5, 0.8], color: '#33261a' });
  C.push({ t: 'wall', p: [-9.5, -1.9, 8], s: [0.8, 1.5, 13.5], color: '#33261a' });
  C.push({ t: 'wall', p: [9.5, -1.9, 8], s: [0.8, 1.5, 13.5], color: '#33261a' });
  C.push({ t: 'platform', p: [0, 0.05, 8], s: [1.5, 0.9, 19], color: '#c47a24', tex: 'plank' }); // the beam
  // truss sleepers across the beam top — pure dressing, 6cm proud
  for (const z of [3, 6, 9, 12]) C.push({ t: 'platform', p: [0, 0.53, z], s: [2.0, 0.12, 0.55], color: '#93551a', tex: 'wood' });
  C.push({ t: 'rail', p: [4.6, 1.0, 8], len: 21, yaw: 0 }); // skater's line over the pit
  C.push({ t: 'metal', p: [-5.2, 0.5, 17.8, ] as [number, number, number] }); // the steel block by the drop
  for (const z of [14, 11, 8, 5, 2]) C.push({ t: 'wumpa', p: [0, 1.5, z] });
  // -- PIT TWO: wider maw, crossed on organic stepping stones
  C.push({ t: 'pit', p: [0, -0.5, -37], pts: blob(11.2, 9.6, 10, 0.22) });
  C.push({ t: 'wall', p: [0, -1.9, -28.4], s: [20, 1.5, 0.8], color: '#33261a' });
  C.push({ t: 'wall', p: [0, -1.9, -45.6], s: [20, 1.5, 0.8], color: '#33261a' });
  C.push({ t: 'wall', p: [-10, -1.9, -37], s: [0.8, 1.5, 15], color: '#33261a' });
  C.push({ t: 'wall', p: [10, -1.9, -37], s: [0.8, 1.5, 15], color: '#33261a' });
  const stones: [number, number, number][] = [
    [-3.8, -31.6, 2.8],
    [2.6, -37, 2.6],
    [-2.4, -42.6, 2.7],
  ];
  for (const [sx, sz, sr] of stones) {
    C.push({ t: 'platform', p: [sx, 0, sz], s: [1, 1, 1], pts: blob(sr, sr * 0.9, 7, 0.35), color: '#84936c', tex: 'stone' });
    C.push({ t: 'wumpa', p: [sx, 1.5, sz] });
  }
  C.push({ t: 'rail', p: [6.8, 1.0, -37], len: 22, yaw: 0 }); // grind line past the stones
  // -- grass banks: raised mossy shoulders squeezing the path organic
  const banks: [number, number, number, number, string][] = [
    [-10.8, 33, 3.6, 9, '#57a53d'],
    [10.8, 29, 3.4, 8, '#4a9636'],
    [-10.6, 12, 3.2, 6.5, '#4a9636'],
    [10.6, 6, 3.2, 7, '#57a53d'],
    [-10.8, -13, 3.6, 9.5, '#57a53d'],
    [10.8, -19, 3.4, 8, '#4a9636'],
    [-11.8, -37, 3.2, 8, '#4a9636'],
    [11.8, -35, 3.2, 8, '#57a53d'],
    [-13, -58, 3.8, 9, '#57a53d'],
    [13, -62, 3.8, 9, '#4a9636'],
    [0, -75, 9, 3.4, '#4a9636'],
  ];
  for (const [bx, bz, brx, brz, col] of banks) {
    C.push({ t: 'platform', p: [bx, 0.55, bz], s: [1, 0.9, 1], pts: blob(brx, brz, 8, 0.34), color: col, tex: 'grass' });
  }
  // -- mossy stone walls: tall organic slabs closing the corridor in
  const wallCol = ['#66755d', '#5c6b54', '#707e66'];
  const wallRuns: [number, number, number, number, number][] = [
    [-14.8, 24, 3.6, 26, 8.5],
    [14.8, 18, 3.6, 24, 9],
    [-15, -20, 3.4, 18, 8],
    [15, -24, 3.4, 18, 8.5],
    [-16, -50, 3.6, 16, 9],
    [16, -52, 3.6, 16, 8],
    [-17.5, -68, 3.4, 9, 8.5],
    [17.5, -68, 3.4, 9, 9],
    [0, -79.5, 13, 3.2, 9.5],
  ];
  wallRuns.forEach(([wx, wz, wrx, wrz, wh], i) => {
    C.push({ t: 'wall', p: [wx, 0, wz], s: [1, wh, 1], pts: blob(wrx, wrz, 8, 0.3), color: wallCol[i % 3], tex: 'moss' });
  });
  // -- crude trees: a trunk rock wearing a canopy rock, rooted on the banks
  const trees: [number, number][] = [
    [-9.8, 26],
    [10.2, -8],
    [-10.6, -55],
    [11.6, -64],
  ];
  trees.forEach(([tx, tz], i) => {
    C.push({ t: 'rock', p: [tx, 1.2, tz], s: [1.3, 5, 1.3], seed: 40 + i, color: '#6b4a2c', tex: 'wood' });
    C.push({ t: 'rock', p: [tx, 5.6, tz], s: [4.8, 2.2, 4.8], seed: 80 + i, color: '#3b7a32', tex: 'jungle' });
  });
  // -- undergrowth: bushes + flowering plants scattered along the shoulders
  const bushes: [number, number, number][] = [
    [-9.4, 38, 0],
    [9.6, 33, 1],
    [-9.8, 17, 2],
    [9.2, 10, 0],
    [-9.6, -9, 1],
    [10, -22, 2],
    [-10.8, -33, 0],
    [11, -41, 1],
    [-11.6, -63, 2],
    [11.4, -57, 0],
  ];
  const bushCol = ['#469634', '#3a842e', '#67ad46'];
  bushes.forEach(([bx, bz, ci], i) => {
    C.push({ t: 'rock', p: [bx, 1.35, bz], s: [1.7, 1.3, 1.7], seed: 120 + i, color: bushCol[ci], tex: 'jungle' });
  });
  const flowers: [number, number, string][] = [
    [-8.8, 30, '#c74e8a'],
    [9.0, 22, '#4a63c9'],
    [-9.2, -16, '#d98a2b'],
    [9.4, -28.5, '#c74e8a'],
    [-10.9, -48, '#4a63c9'],
    [10.6, -68, '#c74e8a'],
  ];
  flowers.forEach(([fx, fz, fc], i) => {
    C.push({ t: 'rock', p: [fx, 1.35, fz], s: [0.75, 0.95, 0.75], seed: 200 + i, color: fc });
  });
  // -- crates, hazards, and the goodies
  C.push({ t: 'crate', p: [4.2, 0.5, 27], kind: 'wood' });
  C.push({ t: 'crate', p: [4.2, 1.46, 27], kind: 'mystery' });
  C.push({ t: 'crate', p: [-4.4, 0.5, 34], kind: 'wood' });
  C.push({ t: 'crate', p: [-3.6, 0.5, 19.4], kind: 'bouncy' }); // bounce line over pit one
  C.push({ t: 'checkpoint', p: [3.2, 0.5, -3.4] });
  C.push({ t: 'enemy', p: [0, 0.5, -14], range: 5.5, speed: 3, foe: 'hopper' });
  C.push({ t: 'crate', p: [-5, 0.5, -18.6], kind: 'wood' });
  C.push({ t: 'crate', p: [5.2, 0.5, -20.4], kind: 'tnt' });
  C.push({ t: 'enemy', p: [-2, 0.5, -22], range: 4, speed: 3, foe: 'floater' }); // spin it out of the canopy
  C.push({ t: 'crate', p: [-4.6, 0.5, -24], kind: 'wood' });
  C.push({ t: 'enemy', p: [0, 0.5, -40], range: 0, speed: 0, foe: 'spinner' }); // blades guard the third pit
  C.push({ t: 'crate', p: [5.4, 0.5, -55.6], kind: 'mask' });
  C.push({ t: 'enemy', p: [3, 0.5, -57], range: 4, speed: 3, foe: 'spiker' });
  C.push({ t: 'crate', p: [-5.8, 0.5, -60], kind: 'bouncy' });
  for (const [wx, wz] of [
    [0, 24],
    [0, 20],
    [-2, -8],
    [-2, -11],
    [2.6, -50],
    [1.4, -53.4],
  ] as [number, number][]) {
    C.push({ t: 'wumpa', p: [wx, 1.4, wz] });
  }
  C.push({ t: 'crystal', p: [0, 1.5, -64] });
  C.push({ t: 'gate', p: [0, 0, -70] }); // the run ends on the third deck
  return {
    v: 1,
    name: 'The Overgrowth',
    spawn: [0, 1.1, 44],
    killY: -10,
    components: C,
    groups: [],
  };
}

export function starterCustomLevel(): CustomLevelData {
  return {
    v: 1,
    name: 'My Level',
    spawn: [0, 0.6, 20],
    killY: -12,
    components: [
      { t: 'platform', p: [0, 0, 12], s: [26, 1, 32] }, // home deck
      { t: 'platform', p: [0, 0, -18], s: [26, 1, 20] }, // across the first pit
      { t: 'rail', p: [6, 1.0, -2], len: 16, yaw: 0 },
      { t: 'pipe', p: [-24, -0.5, -8], len: 36, axis: 'z' },
      { t: 'crate', p: [-4, 0.5, 4], kind: 'wood' },
      { t: 'crate', p: [-4, 0.5, 0], kind: 'bouncy' },
      { t: 'wumpa', p: [0, 1.2, 4] },
      { t: 'wumpa', p: [0, 1.2, 0] },
      { t: 'wumpa', p: [0, 1.2, -4] },
      { t: 'enemy', p: [4, 0.5, -20], range: 5, speed: 3 },
      { t: 'crystal', p: [0, 0.5, -24] },
      { t: 'gate', p: [0, 0.5, -26] },
    ],
  };
}

// The four corners of a w×d rectangle spun by yaw degrees (relative offsets)
// — matches mesh.rotation.y = yaw applied to a BoxGeometry footprint.
// Fillet the corners of a polyline/polygon (Figma corner radius). Each
// vertex is [x, z, radius?, y?]; a radiused corner is replaced by a
// quadratic fillet trimmed to just under half of the shorter adjacent edge.
// The optional per-node HEIGHT rides the same bezier, so a rounded bend on
// a climbing rail rises smoothly through the turn. Returns dense points
// tagged with the source vertex index `i` (aux data can follow the tag).
// Open paths never round their endpoints. Consecutive near-duplicates are
// dropped (zero-length rail segments would blow up direction math).
export function roundCorners(
  pts: readonly (readonly number[])[],
  closed: boolean,
): { x: number; z: number; y: number; i: number }[] {
  const n = pts.length;
  const out: { x: number; z: number; y: number; i: number }[] = [];
  const push = (x: number, z: number, y: number, i: number): void => {
    const last = out[out.length - 1];
    if (last && (last.x - x) * (last.x - x) + (last.z - z) * (last.z - z) < 4e-4) return;
    out.push({ x, z, y, i });
  };
  const yOf = (k: number): number => pts[((k % n) + n) % n][3] ?? 0;
  for (let i = 0; i < n; i++) {
    const r = pts[i][2] ?? 0;
    const px = pts[i][0];
    const pz = pts[i][1];
    const py = yOf(i);
    if (r <= 0.01 || n < 3 || (!closed && (i === 0 || i === n - 1))) {
      push(px, pz, py, i);
      continue;
    }
    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const inX = px - A[0];
    const inZ = pz - A[1];
    const outX = B[0] - px;
    const outZ = B[1] - pz;
    const inL = Math.hypot(inX, inZ);
    const outL = Math.hypot(outX, outZ);
    if (inL < 1e-4 || outL < 1e-4) {
      push(px, pz, py, i);
      continue;
    }
    const t = Math.min(r, inL * 0.49, outL * 0.49);
    const ax = px - (inX / inL) * t;
    const az = pz - (inZ / inL) * t;
    const bx = px + (outX / outL) * t;
    const bz = pz + (outZ / outL) * t;
    // heights at the trim points sit on the straight edges' slopes
    const ay = py + (yOf(i - 1) - py) * (t / inL);
    const by = py + (yOf(i + 1) - py) * (t / outL);
    const SEGS = 6;
    for (let k = 0; k <= SEGS; k++) {
      const u = k / SEGS;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      push(
        w0 * ax + w1 * px + w2 * bx,
        w0 * az + w1 * pz + w2 * bz,
        w0 * ay + w1 * py + w2 * by,
        i,
      );
    }
  }
  return out;
}

export function rectCorners(w: number, d: number, yawDeg: number): [number, number][] {
  const r = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const base: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  return base.map(([x, z]) => [x * cos + z * sin, -x * sin + z * cos] as [number, number]);
}

// Even-odd point-in-polygon test (pts relative to the same origin as x/z).
export function pointInPoly(x: number, z: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// The working custom level, set by the editor / loaded from storage before a
// Level with courseId 7 is constructed.
let CUSTOM_LEVEL: CustomLevelData | null = null;
export function setCustomLevelData(d: CustomLevelData): void {
  CUSTOM_LEVEL = d;
}
export function getCustomLevelData(): CustomLevelData {
  if (!CUSTOM_LEVEL) {
    try {
      const raw = JSON.parse(localStorage.getItem('protoCustomLevel') ?? 'null') as CustomLevelData | null;
      if (raw && raw.v === 1 && Array.isArray(raw.components)) CUSTOM_LEVEL = raw;
    } catch {
      /* fall through to starter */
    }
    if (!CUSTOM_LEVEL) CUSTOM_LEVEL = starterCustomLevel();
    CUSTOM_LEVEL = migrateCustomLevel(CUSTOM_LEVEL);
  }
  return CUSTOM_LEVEL;
}

// ---- DIRECT LEVEL EDITING: per-level override slots ------------------------
// A synced editor writes a built-in level's edits to that level's own storage
// slot; when a slot holds data, the level builds from it (through the same
// component pipeline as Custom) instead of its hand-coded builder. Clearing
// the slot brings the original back — the builders are never touched. These
// slots double as the offline cache for the GitHub-synced levels file.
export const EDITABLE_IDS = [0, 1, 2, 3, 4, 5, 6, 8]; // every level except the Custom sandbox
export function levelOverrideKey(id: number): string {
  return `protoLevelEdit:${id}`;
}
export function getLevelOverride(id: number): CustomLevelData | null {
  try {
    const raw = JSON.parse(localStorage.getItem(levelOverrideKey(id)) ?? 'null') as CustomLevelData | null;
    if (raw && raw.v === 1 && Array.isArray(raw.components)) return raw;
  } catch {
    /* corrupt slot reads as pristine */
  }
  return null;
}
export function clearLevelOverride(id: number): void {
  localStorage.removeItem(levelOverrideKey(id));
}
export function allLevelOverrides(): Record<string, CustomLevelData> {
  const out: Record<string, CustomLevelData> = {};
  for (const id of EDITABLE_IDS) {
    const d = getLevelOverride(id);
    if (d) out[String(id)] = d;
  }
  return out;
}
// Bring the local slots in line with the synced file. `skip` protects levels
// with unpushed local edits (local wins until the push lands). Returns the
// ids whose local data actually changed.
export function applyRemoteLevels(remote: Record<string, CustomLevelData>, skip: Set<number>): number[] {
  const changed: number[] = [];
  for (const id of EDITABLE_IDS) {
    if (skip.has(id)) continue;
    const key = levelOverrideKey(id);
    const local = localStorage.getItem(key);
    const rem = remote[String(id)] ? JSON.stringify(remote[String(id)]) : null;
    if (rem === local) continue;
    if (rem) localStorage.setItem(key, rem);
    else localStorage.removeItem(key);
    changed.push(id);
  }
  return changed;
}

// DIRTY = edited locally since the last successful push. Dirty levels win over
// the synced file (so a fetch never clobbers edits mid-session) and are the
// payload a push sends.
export function markLevelDirty(id: number): void {
  const s = getDirtyIds();
  s.add(id);
  localStorage.setItem('protoLevelDirty', JSON.stringify([...s]));
}
export function getDirtyIds(): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem('protoLevelDirty') ?? '[]') as number[];
    if (Array.isArray(raw)) return new Set(raw);
  } catch {
    /* reset below */
  }
  return new Set();
}
export function clearDirty(ids: number[]): void {
  const s = getDirtyIds();
  for (const id of ids) s.delete(id);
  localStorage.setItem('protoLevelDirty', JSON.stringify([...s]));
}

// The editor's working data for a given course: an existing override, else the
// live custom sandbox (course 7). Always migrated so the gate/activators exist.
export function getEditData(id: number): CustomLevelData {
  if (id !== 7) {
    const ov = getLevelOverride(id);
    if (ov) return migrateCustomLevel(JSON.parse(JSON.stringify(ov)) as CustomLevelData);
  }
  return getCustomLevelData();
}
// Persist the editor's working data to the right slot for its target course
// (the custom sandbox, or a built-in level's override — which marks it dirty).
export function persistEditData(id: number, json: string): void {
  try {
    if (id === 7) {
      localStorage.setItem('protoCustomLevel', json);
    } else {
      localStorage.setItem(levelOverrideKey(id), json);
      markLevelDirty(id);
    }
  } catch {
    /* storage full: the working copy still lives in memory */
  }
}

// ---- DIRECT-EDIT UNLOCK: a client-side passcode gate ----------------------
// Flips a built-in level's edit button from "edit a copy" to "edit this level
// directly" and reveals the phone-sync controls. Not real security (the real
// write credential is the GitHub token) — just a gate so a casual visitor to
// the public build never trips into overwriting levels. SHA-256 of the
// passcode is baked in; the cleartext never ships.
const EDIT_PASS_HASH = '64145f0b744709a636dad052192339220347504f5c17ed4d0c22c5c27e416295';
export async function checkEditPass(pass: string): Promise<boolean> {
  const bytes = new TextEncoder().encode(pass);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (hex === EDIT_PASS_HASH) {
    localStorage.setItem('protoEditUnlocked', '1');
    return true;
  }
  return false;
}
export function isEditUnlocked(): boolean {
  return localStorage.getItem('protoEditUnlocked') === '1';
}

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = []; // sentry orbs in flight
  stones: Stone[] = [];
  checkpoints: Checkpoint[] = [];
  pickups: Pickup[] = [];
  rails: Rail[] = [];
  halfpipes: Halfpipe[] = []; // dedicated smooth transitions ridden by the pipe physics
  // Travel zones: rectangular regions where the course itself runs along X
  // instead of -Z (a real right-angle turn in the path). The camera never
  // yaws — the turned path is what makes those stretches side-scrolling.
  zones: { xMin: number; xMax: number; zMin: number; zMax: number; dir: 'E' | 'W' | 'N' | 'S' }[] = [];
  finishBox = new THREE.Box3();
  finishZ = -1005;
  gateYaw = 0; // finish-gate turn in degrees — sideways courses spin the whole gate
  endWallZ = -1021; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint
  activeCheckpoint: Checkpoint | null = null; // owns the respawn snapshot
  walls: THREE.Box3[] = []; // solid barriers: bump = full stop, never break
  killY = -48; // per-level death height
  name = LEVEL_NAMES[0];
  // Boulder-chase machinery (Boulder Dash). player.step reports its position
  // here each step so the chase can trigger, rubber-band, and reset fairly.
  playerPos = new THREE.Vector3(0, 0, -1e9);
  chaseCam = false; // high, pulled-back framing: the player runs AT the lens
  boulder: {
    st: Stone;
    active: boolean;
    falling: boolean;
    fallV: number;
    endZ: number; // where the floor runs out — the boulder tips into the pit
    triggerZ: number; // player crossing this line starts the roll
    h0: number; // ground-height profile sampled at build time
    hStep: number;
    heights: number[];
  } | null = null;

  // --- motion toolkit ---
  movers: Mover[] = [];
  crumbles: Crumble[] = [];
  ropes: SkyRope[] = [];
  crushers: Crusher[] = [];
  pendulums: Pendulum[] = [];
  ropeSwings: RopeSwing[] = [];
  killBoxes: THREE.Box3[] = []; // touch-kill hazard volumes, rebuilt each update
  pitBoxes: THREE.Box3[] = []; // static death-pit volumes (custom levels), re-fed into killBoxes

  // --- set pieces ---
  // Arena lock: enter the zone, gates slam shut, survive the waves. The
  // gates BREATHE on a cycle while the fight is on — up long enough to
  // matter, down long enough to slip through — so a run is never hard-stuck.
  arena: {
    zone: THREE.Box3;
    state: 'idle' | 'active' | 'done';
    wave: number;
    waveT: number;
    cycleT: number; // gate breathing clock while active
    up: boolean; // gates currently raised (walls live)
    waves: Enemy[][];
    gates: { mesh: THREE.Mesh; upY: number; downY: number; box: THREE.Box3 }[];
  } | null = null;
  // Collapse wave: cross the trigger and the bridge falls away behind you.
  collapse: {
    planks: Crumble[];
    xMin: number;
    xMax: number;
    triggerZ: number;
    endZ: number;
    startZ: number;
    frontZ: number;
    speed: number;
    active: boolean;
  } | null = null;

  // --- visual pass ---
  // Default = Test Course: Sentinel-Beach morning. Brilliant turquoise zenith
  // over warm sand haze, high gold sun, jungle bounce light, drifting motes.
  // combo-mode dress: true = EVERY convertible crate becomes a balance crate
  // (levels built around one long grind line); false = every third
  private allBalanceCrates = false;
  theme: Theme = {
    skyTop: '#0fa3c2',
    skyBottom: '#ffe6ae',
    sunColorHex: '#fff0b8',
    sunU: 0.3,
    sunV: 0.4,
    stars: false,
    fog: 0xbfe0cd, // warm aqua haze so distance melts into the lagoon
    fogNear: 24,
    fogFar: 150,
    hemiSky: 0x9fdfe4,
    hemiGround: 0x8a6a3a,
    hemiI: 1.1,
    sunColor: 0xffe0a0,
    sunI: 1.45,
    particleColor: 0xfff0c0,
    particleWind: [0.8, -0.4, 0.3],
  };
  private scrollTexes: { tex: THREE.CanvasTexture; su: number; sv: number }[] = [];
  private ambient: { points: THREE.Points; drift: Float32Array } | null = null;

  // safe = triggered by the player's own spin/slam: breaks the world, not them
  explosions: { center: THREE.Vector3; t: number; radius: number; safe: boolean }[] = [];

  private scene: THREE.Scene;
  private root = new THREE.Group(); // everything the level owns, for disposal
  private pops: { obj: THREE.Object3D; t: number }[] = [];
  private time = 0;
  private arrowTex: THREE.CanvasTexture | null = null;
  private tntTexCache = new Map<string, THREE.CanvasTexture>();
  private maskTex: THREE.CanvasTexture | null = null;
  private mysteryTex: THREE.CanvasTexture | null = null;
  private plainTex: THREE.CanvasTexture | null = null;
  private nitroTex: THREE.CanvasTexture | null = null;
  private cpTex: THREE.CanvasTexture | null = null;

  // ---- warp-room VFX + collectathon relics (demoscene math, PS1 budget) ----
  crystalPickup: { group: THREE.Group; box: THREE.Box3; collected: boolean } | null = null;
  // TIME TRIAL: the gold stopwatch near spawn — touch it to start the clock.
  clockPickup: { group: THREE.Group; box: THREE.Box3; collected: boolean } | null = null;
  timeTrial = false; // trial live: checkpoints/fruit dormant, time crates active
  // COMBO RUN: the green orb near spawn — touch it and the green gem appears
  // at the finish gate; reach it in ONE combo and it's yours.
  comboOrb: { group: THREE.Group; box: THREE.Box3; collected: boolean } | null = null;
  comboRun = false;
  comboGem: { group: THREE.Group; box: THREE.Box3 } | null = null;
  private gateSpec: { x: number; y: number; z: number } | null = null; // where finishGate stood (capture + clock placement)
  // authored activator spots (custom levels) — idx ties the built pickup back
  // to its component so the editor can pick and drag it
  private clockSpot: { x: number; y: number; z: number; idx: number } | null = null;
  private orbSpot: { x: number; y: number; z: number; idx: number } | null = null;

  // either special play mode: checkpoints/fruit/crystal sit out, boxes go empty
  get runMode(): boolean {
    return this.timeTrial || this.comboRun;
  }
  private crystalPlaced = false; // Random level: drop it on one mid-course deck
  private gemG: THREE.Group | null = null; // materializes when every box breaks
  private vfxT = 0; // animation clock for all the procedural magic
  private plasmaTex: THREE.CanvasTexture | null = null;
  private plasmaData: ImageData | null = null;
  private plasmaCtx: CanvasRenderingContext2D | null = null;
  private plasmaPal: Uint8Array | null = null; // 256-entry blue/cyan palette
  private plasmaFrame = 0;
  private chromeTex: THREE.CanvasTexture | null = null; // UV-scrolled fake chrome
  private glintTex: THREE.CanvasTexture | null = null;
  private flareTex: THREE.CanvasTexture | null = null; // big collection starburst
  private glowTex: THREE.CanvasTexture | null = null; // soft radial halo
  // sparkle/burst billboards: outward drift (vx/vz), spin, per-sprite tint, and
  // an optional grow-then-shrink pop for the big collection flare.
  private glints: {
    spr: THREE.Sprite;
    life: number;
    max: number;
    vx: number;
    vy: number;
    vz: number;
    spin: number;
    scale: number;
    pop: boolean;
  }[] = [];
  private glintT = 0;
  private glowRings: { mesh: THREE.Mesh; phase: number; speed: number; base: number }[] = [];
  private gateCrystalIcon: THREE.Mesh | null = null;
  private gateGemIcon: THREE.Mesh | null = null;
  private relics = { crystal: false, gem: false };
  private blastMeshes: { outer: THREE.Mesh; inner: THREE.Mesh; ex: { center: THREE.Vector3; t: number; radius: number } }[] = [];
  private blastBroken: Crate[] = []; // crates broken by blasts, for the player to tally
  private static blastGeo = new THREE.SphereGeometry(1, 10, 8);
  private static pickupGeo = new THREE.SphereGeometry(0.24, 8, 6);
  private checkerTex: THREE.CanvasTexture | null = null;

  // Subtle checker tiles (tinted by each deck's color) so ground movement
  // reads even without landmarks — crucial on the side-scroll camera.
  private checkerTexture(): THREE.CanvasTexture {
    if (this.checkerTex) return this.checkerTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#cfcfcf';
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    this.checkerTex = new THREE.CanvasTexture(canvas);
    this.checkerTex.magFilter = THREE.NearestFilter;
    this.checkerTex.wrapS = THREE.RepeatWrapping;
    this.checkerTex.wrapT = THREE.RepeatWrapping;
    return this.checkerTex;
  }

  // Light-toned surface textures — near-white so each deck's material color
  // tints them. Organic kinds (grass/jungle/dirt/sand/wood) paint at 128px
  // with layered soft radial blobs and keep the default LinearFilter — the
  // smooth PS2 read. Man-made kinds stay 64px pixel-crisp. Cached per kind.
  private surfTexCache = new Map<string, THREE.CanvasTexture>();
  private surfaceTexture(kind: string): THREE.CanvasTexture {
    if (kind === 'checker') return this.checkerTexture();
    const cached = this.surfTexCache.get(kind);
    if (cached) return cached;
    const soft =
      kind === 'grass' || kind === 'jungle' || kind === 'dirt' || kind === 'sand' || kind === 'wood' || kind === 'moss';
    const S = soft ? 128 : 64;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    // Soft gradient blob, stamped at every wrapped position so tiles seam.
    const blob = (x: number, y: number, r: number, color: string): void => {
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const bx = x + ox;
          const by = y + oy;
          if (bx < -r || bx > S + r || by < -r || by > S + r) continue;
          const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
          g.addColorStop(0, color);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        }
      }
    };
    if (kind === 'grass') {
      // meadow wash: overlapping green pools, shade, sun patches — painterly
      ctx.fillStyle = '#e6eed8';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        const g = 205 + Math.floor(Math.random() * 34);
        const r = g - 24 - Math.floor(Math.random() * 14);
        blob(Math.random() * S, Math.random() * S, 14 + Math.random() * 16, `rgba(${r},${g},${g - 36},0.5)`);
      }
      for (let i = 0; i < 10; i++) blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 12, 'rgba(112,138,88,0.2)');
      for (let i = 0; i < 12; i++) blob(Math.random() * S, Math.random() * S, 5 + Math.random() * 8, 'rgba(255,255,236,0.3)');
    } else if (kind === 'stone') {
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 2; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let cx = -1; cx < 3; cx++) {
          const v = 215 + Math.floor(Math.random() * 25);
          ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 2, 28, 28);
          ctx.fillStyle = 'rgba(120,120,120,0.35)';
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 26, 28, 4); // bottom shade
        }
      }
    } else if (kind === 'wood') {
      // sun-warmed timber: per-plank tonal wash, soft grain, shaded seams
      for (let p = 0; p < 4; p++) {
        const v = 218 + Math.floor(Math.random() * 24);
        const gr = ctx.createLinearGradient(p * 32, 0, p * 32 + 32, 0);
        gr.addColorStop(0, `rgb(${v - 10},${v - 26},${v - 46})`);
        gr.addColorStop(0.5, `rgb(${v},${v - 14},${v - 34})`);
        gr.addColorStop(1, `rgb(${v - 12},${v - 28},${v - 48})`);
        ctx.fillStyle = gr;
        ctx.fillRect(p * 32, 0, 32, S);
        ctx.strokeStyle = 'rgba(126,94,60,0.35)';
        ctx.lineWidth = 2;
        for (let g = 0; g < 3; g++) {
          const gx = p * 32 + 7 + g * 9;
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 4, S * 0.3, gx - 4, S * 0.65, gx, S);
          ctx.stroke();
        }
        blob(p * 32 + 8 + Math.random() * 16, Math.random() * S, 4 + Math.random() * 3, 'rgba(122,88,52,0.45)'); // knot
        ctx.fillStyle = 'rgba(96,72,48,0.5)';
        ctx.fillRect(p * 32, 0, 2, S); // seam
      }
    } else if (kind === 'jungle') {
      // canopy floor: deep leaf pools under sunlit tops, all soft-edged
      ctx.fillStyle = '#dbe6c4';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 30; i++) {
        const g = 196 + Math.floor(Math.random() * 44);
        const b = g - 48 + Math.floor(Math.random() * 16);
        blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 14, `rgba(${g - 40},${g},${b},0.55)`);
      }
      for (let i = 0; i < 14; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 12, 'rgba(74,102,60,0.24)');
      for (let i = 0; i < 12; i++) blob(Math.random() * S, Math.random() * S, 4 + Math.random() * 7, 'rgba(255,255,232,0.32)');
    } else if (kind === 'dirt') {
      // trodden earth: warm soft blotches, moss creep, dry sunlit patches
      ctx.fillStyle = '#e5dabd';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 16; i++) {
        const v = 198 + Math.floor(Math.random() * 36);
        blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 18, `rgba(${v},${v - 20},${v - 52},0.5)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 10, 'rgba(140,132,86,0.2)');
      for (let i = 0; i < 14; i++) blob(Math.random() * S, Math.random() * S, 2.5 + Math.random() * 3.5, 'rgba(122,96,62,0.4)'); // pebbles
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 6 + Math.random() * 9, 'rgba(255,246,220,0.32)');
    } else if (kind === 'moss') {
      // grown-over stonework: pale block courses drowning under soft green
      // creep — the lush-ruin wall the jungle levels want
      ctx.fillStyle = '#c9cfbe';
      ctx.fillRect(0, 0, S, S);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let cx = -1; cx < 5; cx++) {
          const v = 200 + Math.floor(Math.random() * 26);
          ctx.fillStyle = `rgb(${v - 6},${v},${v - 14})`;
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 2, 28, 28);
          ctx.fillStyle = 'rgba(96,108,88,0.4)';
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 26, 28, 4);
        }
      }
      for (let i = 0; i < 22; i++) {
        const g = 170 + Math.floor(Math.random() * 46);
        blob(Math.random() * S, Math.random() * S, 9 + Math.random() * 14, `rgba(${g - 62},${g},${g - 78},0.5)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 6 + Math.random() * 9, 'rgba(70,96,58,0.3)');
      for (let i = 0; i < 6; i++) blob(Math.random() * S, Math.random() * S, 4 + Math.random() * 6, 'rgba(240,248,220,0.28)');
    } else if (kind === 'pavement') {
      // concrete: 32px slabs, expansion lines, speckle so aprons don't band
      for (let py = 0; py < 2; py++) {
        for (let px = 0; px < 2; px++) {
          const v = 214 + Math.floor(Math.random() * 22);
          ctx.fillStyle = `rgb(${v},${v},${v - 6})`;
          ctx.fillRect(px * 32, py * 32, 32, 32);
        }
      }
      ctx.fillStyle = 'rgba(150,150,145,0.5)';
      for (let i = 0; i < 44; i++) ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      ctx.fillStyle = 'rgba(105,105,100,0.65)'; // expansion joints
      ctx.fillRect(0, 31, 64, 2);
      ctx.fillRect(31, 0, 2, 64);
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 64);
      ctx.fillStyle = 'rgba(255,255,250,0.5)'; // sun-bleached slab lips
      ctx.fillRect(0, 33, 64, 1);
      ctx.fillRect(33, 0, 1, 64);
    } else if (kind === 'asphalt') {
      // FULL-COLOUR (pair with a white material): blacktop + painted lane
      // line along one tile edge — tiled, it reads as parking-lot bays.
      ctx.fillStyle = '#3e4046';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 120; i++) {
        const v = 44 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      }
      ctx.strokeStyle = 'rgba(22,22,26,0.7)'; // hairline cracks
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        let px = Math.random() * 64;
        ctx.moveTo(px, 0);
        for (let s = 1; s <= 4; s++) {
          px += (Math.random() - 0.5) * 14;
          ctx.lineTo(px, s * 16);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#e8e2c8'; // worn paint stripe
      ctx.fillRect(0, 0, 64, 3);
      ctx.fillStyle = 'rgba(62,64,70,0.5)'; // scuff it back
      for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * 62, 0, 3, 2);
    } else if (kind === 'metal') {
      // brushed deck plate: lengthwise strokes, panel seams, corner rivets
      ctx.fillStyle = '#dde0e4';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 40; i++) {
        const v = 200 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.7)`;
        ctx.fillRect(0, Math.random() * 63, 34 + Math.random() * 30, 1);
      }
      ctx.fillStyle = 'rgba(110,116,128,0.8)'; // seams
      ctx.fillRect(0, 0, 64, 2);
      ctx.fillRect(0, 0, 2, 64);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(0, 2, 64, 1);
      ctx.fillStyle = 'rgba(90,96,108,0.9)'; // rivets
      for (const [rx, ry] of [[6, 6], [58, 6], [6, 58], [58, 58], [32, 6], [32, 58]] as const) {
        ctx.fillRect(rx - 1, ry - 1, 3, 3);
      }
    } else if (kind === 'plank') {
      // boardwalk: 8px cross-planks, staggered butt joints, worn grain
      for (let p = 0; p < 8; p++) {
        const v = 216 + Math.floor(Math.random() * 26);
        ctx.fillStyle = `rgb(${v},${v - 18},${v - 40})`;
        ctx.fillRect(0, p * 8, 64, 8);
        ctx.fillStyle = 'rgba(110,80,50,0.8)';
        ctx.fillRect(0, p * 8, 64, 1); // seam
        ctx.fillRect(((p * 29) % 61) + 2, p * 8, 1, 8); // butt joint
        ctx.fillStyle = 'rgba(140,105,65,0.5)'; // grain scratch
        ctx.fillRect(Math.random() * 40, p * 8 + 2 + Math.random() * 4, 14 + Math.random() * 18, 1);
      }
      ctx.fillStyle = 'rgba(255,240,210,0.35)';
      for (let i = 0; i < 12; i++) ctx.fillRect(Math.random() * 60, Math.random() * 62, 3, 1);
    } else {
      // sand: warm tonal pools under soft ripple shadows
      ctx.fillStyle = '#f3ecd6';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 18; i++) {
        const v = 205 + Math.floor(Math.random() * 34);
        blob(Math.random() * S, Math.random() * S, 16 + Math.random() * 20, `rgba(${v},${v - 12},${v - 40},0.35)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 10 + Math.random() * 12, 'rgba(255,250,232,0.35)');
      ctx.strokeStyle = 'rgba(186,164,120,0.22)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const y = 12 + i * 24;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 7, S * 0.7, y - 7, S, y);
        ctx.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    if (!soft) tex.magFilter = THREE.NearestFilter; // crisp = man-made only
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.surfTexCache.set(kind, tex);
    return tex;
  }

  // Per-deck clone of a base material with a surface texture tiled on it.
  private patterned(mat: THREE.Material, w: number, d: number, kind = 'checker'): THREE.MeshLambertMaterial {
    const m = (mat as THREE.MeshLambertMaterial).clone();
    const tex = this.surfaceTexture(kind).clone();
    const density =
      kind === 'grass' ? 8.5 // soft 128px kinds tile larger so blobs read
      : kind === 'jungle' ? 8
      : kind === 'wood' ? 3.2
      : kind === 'plank' ? 3.4
      : kind === 'sand' ? 7.5
      : kind === 'dirt' ? 7
      : kind === 'moss' ? 6
      : kind === 'pavement' ? 6
      : kind === 'asphalt' ? 8 // one paint stripe per 8u = parking bays
      : kind === 'metal' ? 3
      : 4;
    tex.repeat.set(Math.max(1, Math.round(w / density)), Math.max(1, Math.round(d / density)));
    tex.needsUpdate = true;
    m.map = tex;
    m.userData.texKind = kind; // capture: editing a copy of a level reads this back
    return m;
  }

  // Shared structural materials — one per role per level (walls, blocks,
  // curbs, logs, rocks...), fixed texture repeat. Box UVs run 0..1 per face,
  // so texel size breathes with mesh size: very PS1, very cheap. kind '' = no
  // map (flat painted accents). Builders re-tint via the *Tint fields below
  // BEFORE placing geometry.
  private baseMats = new Map<string, THREE.MeshLambertMaterial>();
  private baseMat(key: string, color: number, kind = '', rx = 2, ry = 2): THREE.MeshLambertMaterial {
    let m = this.baseMats.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color });
    if (kind !== '') {
      const tex = this.surfaceTexture(kind).clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      m.map = tex;
      m.userData.texKind = kind; // capture reads this back
    }
    this.baseMats.set(key, m);
    return m;
  }

  // Per-level structural palette (defaults suit the Test Course beach).
  private wallTint = 0xb89a70; // perimeter walls / end wall
  private blockTint = 0xc0a878; // step blocks, stair climbs
  private curbTint = 0xe8a84e; // painted deck-edge strips
  private bermTint = 0x3f8a34; // jungle strip shoulders

  // Rails come out of rails.ts plain grey; reskin every segment in the
  // warp-room chrome (cool-tinted so it reads as polished steel with a magic
  // sheen) and the posts in dark iron. Shared materials, and the chrome clone
  // rides the scrollTexes list so the bands drift — grind lines glint from
  // across the map. Visual only: rail snap logic never looks at these meshes.
  private dressRails(): void {
    const chrome = this.chromeTexture().clone();
    chrome.repeat.set(1, 5); // bands streak along the pipe
    chrome.needsUpdate = true;
    this.scrollTexes.push({ tex: chrome, su: 0.22, sv: 0.045 });
    const railMat = new THREE.MeshLambertMaterial({ map: chrome, color: 0xdce8f2, emissive: 0x46506a });
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3c424e, emissive: 0x11141a });
    for (const rail of this.rails) {
      rail.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = m.geometry.type === 'CylinderGeometry' ? railMat : postMat;
      });
    }
  }

  constructor(scene: THREE.Scene, courseId = 0) {
    this.scene = scene;
    scene.add(this.root);
    this.name = LEVEL_NAMES[courseId] ?? LEVEL_NAMES[0];
    // DIRECT EDIT: a built-in level with a saved override builds from that
    // data (through the component pipeline) instead of its hand-coded builder.
    // Clearing the override brings the original straight back.
    const override = courseId !== 7 ? getLevelOverride(courseId) : null;
    if (override) this.buildCustom(migrateCustomLevel(override), courseId === 8);
    else if (courseId === 1) this.buildSideways();
    else if (courseId === 2) this.buildRandom();
    else if (courseId === 3) this.buildBoulderDash();
    else if (courseId === 4) this.buildFlats();
    else if (courseId === 5) this.buildHalfpipePark();
    else if (courseId === 6) this.buildSkyBridge();
    else if (courseId === 7) this.buildCustom();
    else if (courseId === 8) this.buildCustom(overgrownLevel(), true);
    else if (courseId === 9) this.buildSlipstream();
    else this.buildTestGauntlet(); // courseId 0: test course + gauntlet combined
    this.dressRails(); // every builder is done adding rails by now
    this.placeClock(); // time-trial stopwatch near spawn (only where a finish gate exists)
    this.placeComboOrb(); // combo-run orb, the other side of the racing line
    this.buildAmbient(); // theme is set by the builder above
  }

  // The editor raycasts level geometry for picking; everything a component
  // creates is tagged with userData.editorIdx (see buildCustom).
  get pickRoot(): THREE.Group {
    return this.root;
  }

  // ---- CAPTURE: any level -> editor components -----------------------------
  // Levels built from data return their own data verbatim. Hand-coded levels
  // are HARVESTED from the live scene after building — positions are read off
  // the final meshes/entities, so authored shifts (the gauntlet offset) come
  // through correct by construction. Bespoke set pieces with no component
  // language (boulder chase, movers, decor foliage, finish gates) are
  // skipped: the copy is the editable geometry. Travel zones and sagging
  // ropes DO come through — they have components now.
  private builtFromData: CustomLevelData | null = null;
  captureData(): CustomLevelData {
    if (this.builtFromData) {
      return migrateCustomLevel(JSON.parse(JSON.stringify(this.builtFromData)) as CustomLevelData);
    }
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    const C: CustomComponent[] = [];
    const groups: CustomGroup[] = [];
    const matInfo = (m: THREE.Mesh): { color?: string; tex?: string } => {
      const mat = m.material as THREE.MeshLambertMaterial;
      const color = mat?.color ? '#' + mat.color.getHexString() : undefined;
      const tex = (mat?.userData?.texKind as string) || undefined;
      return { color: color === '#ffffff' ? undefined : color, tex: tex === 'checker' ? undefined : tex };
    };
    const hpWalls = new Set(this.halfpipes.flatMap((hp) => hp.walls));
    const crumbleMeshes = new Set(this.crumbles.map((c) => c.mesh));
    // decks, ramps, step blocks, metal crates — everything standable
    for (const m of this.groundMeshes) {
      if (hpWalls.has(m) || crumbleMeshes.has(m)) continue;
      if (m.userData.metalCrate) {
        C.push({ t: 'metal', p: [r2(m.position.x), r2(m.position.y - 0.48), r2(m.position.z)] });
        continue;
      }
      const geo = m.geometry as THREE.BoxGeometry;
      const { color, tex } = matInfo(m);
      if (geo.type === 'BoxGeometry' && (geo as THREE.BoxGeometry).parameters) {
        const gp = (geo as THREE.BoxGeometry).parameters;
        if (Math.abs(m.rotation.x) > 0.01) {
          // a slope built by ramp(): invert its construction — recover the two
          // top-surface edge lines from the rotation and the surface normal
          const len = gp.depth;
          const dy = Math.sin(m.rotation.x) * len;
          const dz = -Math.cos(m.rotation.x) * len;
          const cy = m.position.y - (dz / len) * 0.5;
          const cz = m.position.z + (dy / len) * 0.5;
          let z0 = cz - dz / 2, z1 = cz + dz / 2, y0 = cy - dy / 2, y1 = cy + dy / 2;
          if (z0 < z1) {
            [z0, z1] = [z1, z0];
            [y0, y1] = [y1, y0];
          }
          C.push({
            t: 'ramp',
            p: [r2(m.position.x), r2(y0), r2((z0 + z1) / 2)],
            len: r2(z0 - z1),
            rise: r2(y1 - y0),
            w: r2(gp.width),
            color,
            tex,
          });
        } else {
          const yaw = Math.round(THREE.MathUtils.radToDeg(m.rotation.y)) % 360;
          C.push({
            t: 'platform',
            p: [r2(m.position.x), r2(m.position.y), r2(m.position.z)],
            s: [r2(gp.width), r2(gp.height), r2(gp.depth)],
            yaw: yaw !== 0 ? yaw : undefined,
            color,
            tex,
          });
        }
      } else {
        // exotic standable (wavy jungle floors, displaced planes): flatten to
        // the bounding box — an editable stand-in for the sculpted original
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        if (!bb) continue;
        const sy = Math.max(0.5, bb.max.y - bb.min.y);
        C.push({
          t: 'platform',
          p: [
            r2(m.position.x + (bb.min.x + bb.max.x) / 2),
            r2(m.position.y + bb.max.y - sy / 2),
            r2(m.position.z + (bb.min.z + bb.max.z) / 2),
          ],
          s: [r2(bb.max.x - bb.min.x), r2(sy), r2(bb.max.z - bb.min.z)],
          color,
          tex,
        });
      }
    }
    // visible walls (built by wall(); positions live off the meshes)
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      const spec = m.userData?.wallSpec as { w: number; d: number; h: number; visH: number } | undefined;
      if (!spec) return;
      C.push({
        t: 'wall',
        p: [r2(m.position.x), r2(m.position.y - spec.visH / 2), r2(m.position.z)],
        s: [r2(spec.w), r2(spec.visH), r2(spec.d)],
        ...matInfo(m),
      });
    });
    // halfpipes, with their true profile (flat half + radius)
    for (const hp of this.halfpipes) {
      const along = (hp.l0 + hp.l1) / 2;
      C.push({
        t: 'pipe',
        p: hp.axis === 'z' ? [r2(hp.cross), r2(hp.yBottom), r2(along)] : [r2(along), r2(hp.yBottom), r2(hp.cross)],
        len: r2(Math.abs(hp.l1 - hp.l0)),
        axis: hp.axis,
        w: r2(hp.flatHalf),
        rise: r2(hp.radius),
      });
    }
    // rails — skipping halfpipe coping lines (the pipe component regrows them)
    const isCoping = (pts: THREE.Vector3[]): boolean =>
      this.halfpipes.some((hp) => {
        const y = hp.lipY + 0.05;
        return pts.every((p) => {
          const crossV = hp.axis === 'z' ? p.x : p.z;
          const alongV = hp.axis === 'z' ? p.z : p.x;
          return (
            Math.abs(p.y - y) < 0.2 &&
            Math.abs(Math.abs(crossV - hp.cross) - hp.lipX) < 0.3 &&
            alongV > Math.min(hp.l0, hp.l1) - 1 &&
            alongV < Math.max(hp.l0, hp.l1) + 1
          );
        });
      });
    const ropeRails = new Set(this.ropes.map((r) => r.rail));
    for (const rail of this.rails) {
      const pts = rail.points;
      if (pts.length < 2 || isCoping(pts) || ropeRails.has(rail)) continue;
      const p0 = pts[0];
      C.push({
        t: 'rail',
        p: [r2(p0.x), r2(p0.y), r2(p0.z)],
        pts: pts.map((p) => [r2(p.x - p0.x), r2(p.z - p0.z), 0, r2(p.y - p0.y)] as [number, number, number, number]),
        invisible: rail.object.children.length === 0 ? true : undefined,
      });
    }
    // finish gate (where the run ends) + the run-mode activators beside spawn
    if (this.gateSpec) {
      C.push({
        t: 'gate',
        p: [r2(this.gateSpec.x), r2(this.gateSpec.y), r2(this.gateSpec.z)],
        yaw: this.gateYaw ? r2(this.gateYaw) : undefined,
      });
    }
    if (this.clockPickup) {
      const g = this.clockPickup.group; // baseY, not live y — the bob animation is mid-flight
      C.push({ t: 'clock', p: [r2(g.position.x), r2((g.userData.baseY as number) - 1.35), r2(g.position.z)] });
    }
    if (this.comboOrb) {
      const g = this.comboOrb.group;
      C.push({ t: 'comboorb', p: [r2(g.position.x), r2((g.userData.baseY as number) - 1.3), r2(g.position.z)] });
    }
    // crumble pads
    for (const cr of this.crumbles) {
      const gp = (cr.mesh.geometry as THREE.BoxGeometry).parameters;
      C.push({
        t: 'crumble',
        p: [r2(cr.base.x), r2(cr.base.y + 0.25), r2(cr.base.z)],
        s: [r2(gp.width), 1, r2(gp.depth)],
        shake: r2(cr.shakeTime),
        speed: cr.fallSpeed !== 30 ? r2(cr.fallSpeed) : undefined,
        yaw: cr.yaw ? Math.round(THREE.MathUtils.radToDeg(cr.yaw)) : undefined,
        ...matInfo(cr.mesh),
      });
    }
    // crates (kind read back off the entity flags; outline wiring keeps its groups)
    const seenGroups = new Set<number>();
    for (const cr of this.crates) {
      const kind = cr.nitro
        ? cr.nitroBang ? 'nitrobang' : 'nitro'
        : cr.bouncy ? 'bouncy'
        : cr.metalBounce ? 'metalbounce'
        : cr.tnt ? 'tnt'
        : cr.mask ? 'mask'
        : cr.mystery ? 'mystery'
        : cr.bang ? 'bang'
        : 'wood';
      const gids = cr.groupIds ?? [];
      for (let gi = 0; gi < gids.length; gi++) {
        if (!seenGroups.has(gids[gi])) {
          seenGroups.add(gids[gi]);
          groups.push({ id: gids[gi], parent: gids[gi + 1] });
        }
      }
      C.push({
        t: 'crate',
        p: [r2(cr.mesh.position.x), r2(cr.mesh.position.y - 0.48), r2(cr.mesh.position.z)],
        kind: kind === 'wood' ? 'wood' : (kind as CustomComponent['kind']),
        outline: cr.wasOutline || undefined,
        grp: gids[0],
      });
    }
    for (const e of this.enemies) {
      const range = r2((e.x1 - e.x0) / 2);
      const foe = e.kind !== 'grunt' ? e.kind : undefined;
      C.push(
        e.axis === 'z'
          ? {
              t: 'enemy',
              p: [r2(e.group.position.x), r2(e.baseY), r2((e.x0 + e.x1) / 2)],
              range,
              speed: r2(e.speed),
              foe,
              yaw: 90,
            }
          : {
              t: 'enemy',
              p: [r2((e.x0 + e.x1) / 2), r2(e.baseY), r2(e.group.position.z)],
              range,
              speed: r2(e.speed),
              foe,
            },
      );
    }
    for (const cp of this.checkpoints) {
      C.push({ t: 'checkpoint', p: [r2(cp.spawnPos.x), r2(cp.spawnPos.y - 0.1), r2(cp.spawnPos.z)] });
    }
    for (const pk of this.pickups) {
      const y = (pk.mesh.userData.baseY as number) ?? pk.mesh.position.y;
      C.push({ t: 'wumpa', p: [r2(pk.mesh.position.x), r2(y), r2(pk.mesh.position.z)] });
    }
    for (const cu of this.crushers) {
      C.push({
        t: 'crusher',
        p: [r2(cu.x), r2(cu.restY - cu.h / 2), r2(cu.z)],
        s: [r2(cu.w), r2(cu.h), r2(cu.d)],
        cycle: r2(cu.cycle),
        phase: r2(cu.phase),
      });
    }
    for (const pe of this.pendulums) {
      C.push({
        t: 'pendulum',
        p: [r2(pe.pivot.position.x), r2(pe.pivot.position.y), r2(pe.pivot.position.z)],
        len: r2(pe.len),
        amp: r2(pe.amp),
        speed: r2(pe.speed),
        phase: r2(pe.phase),
        yaw: pe.yaw ? Math.round(THREE.MathUtils.radToDeg(pe.yaw)) : undefined,
      });
    }
    for (const rs of this.ropeSwings) {
      C.push({
        t: 'ropeswing',
        p: [r2(rs.anchor.x), r2(rs.anchor.y), r2(rs.anchor.z)],
        len: r2(rs.len),
        amp: r2(rs.amp),
        speed: r2(rs.speed),
        phase: r2(rs.phase),
        yaw: rs.yaw ? Math.round(THREE.MathUtils.radToDeg(rs.yaw)) : undefined,
      });
    }
    // sagging ropes: endpoints off the taut rest nodes
    for (const rope of this.ropes) {
      const a = rope.rest[0];
      const bnd = rope.rest[rope.rest.length - 1];
      const len = Math.hypot(bnd.x - a.x, bnd.z - a.z);
      const yaw = Math.round(THREE.MathUtils.radToDeg(Math.atan2(bnd.x - a.x, bnd.z - a.z)));
      C.push({
        t: 'rope',
        p: [r2((a.x + bnd.x) / 2), r2(a.y), r2((a.z + bnd.z) / 2)],
        len: r2(len),
        yaw: yaw !== 0 ? yaw : undefined,
        amp: r2(rope.sagAmt),
        shake: r2(rope.breakTime),
      });
    }
    // travel zones: side-scroll stretches / run-at-camera regions
    for (const zn of this.zones) {
      C.push({
        t: 'zone',
        p: [r2((zn.xMin + zn.xMax) / 2), 0.5, r2((zn.zMin + zn.zMax) / 2)],
        s: [r2(zn.xMax - zn.xMin), 1, r2(zn.zMax - zn.zMin)],
        dir: zn.dir,
      });
    }
    if (this.crystalPickup) {
      const p = this.crystalPickup.group.position;
      C.push({ t: 'crystal', p: [r2(p.x), r2(p.y), r2(p.z)] });
    }
    return {
      v: 1,
      name: `${this.name} (copy)`,
      spawn: [r2(this.spawnPos.x), r2(this.spawnPos.y), r2(this.spawnPos.z)],
      killY: r2(this.killY),
      components: C,
      groups,
    };
  }

  // CUSTOM: build the editor's level from data. Two passes so entities that
  // seat themselves on the ground (crates, enemies, checkpoints) see the
  // geometry pass's floors. Every scene object a component creates gets
  // tagged with its component index for editor picking.
  private buildCustom(data: CustomLevelData = getCustomLevelData(), jungle = false): void {
    this.builtFromData = data; // captureData: a data-built level IS its own capture
    this.killY = data.killY;
    this.finishZ = -1e9; // endless playground: no finish gate
    this.endWallZ = -1e9;
    this.theme = jungle
      ? {
          // deep-jungle corridor: low green fog closes the canopy in, warm
          // shafts of sun, drifting spores
          skyTop: '#175243',
          skyBottom: '#a4cc96',
          sunColorHex: '#fff2c0',
          sunU: 0.32,
          sunV: 0.2,
          stars: false,
          fog: 0x41604a,
          fogNear: 55,
          fogFar: 240,
          hemiSky: 0xe2f4dc,
          hemiGround: 0x39482c,
          hemiI: 1.3,
          sunColor: 0xfff2c0,
          sunI: 1.5,
          particleColor: 0xd6eda6,
          particleWind: [0.22, -0.1, 0.08],
        }
      : {
          skyTop: '#159ecd',
          skyBottom: '#c9f0e4',
          sunColorHex: '#fff8dc',
          sunU: 0.68,
          sunV: 0.14,
          stars: false,
          fog: 0xbee8dd,
          fogNear: 90,
          fogFar: 380,
          hemiSky: 0xeafcff,
          hemiGround: 0x94a294,
          hemiI: 1.2,
          sunColor: 0xfff6dc,
          sunI: 1.55,
          particleColor: 0xffffff,
          particleWind: [0.5, -0.3, 0.2],
        };
    this.spawnPos.set(data.spawn[0], data.spawn[1], data.spawn[2]);
    this.currentSpawn.copy(this.spawnPos);

    const deck = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matPipe = new THREE.MeshLambertMaterial({ color: 0xaab4ba });
    // tag every root child a component adds with that component's index
    const buildTagged = (idx: number, fn: () => void): void => {
      const before = this.root.children.length;
      fn();
      for (let c = before; c < this.root.children.length; c++) {
        this.root.children[c].traverse((o) => (o.userData.editorIdx = idx));
        this.root.children[c].userData.editorIdx = idx;
      }
    };
    const geomPass = new Set(['platform', 'ramp', 'wall', 'pipe', 'rail', 'rope', 'crumble', 'pit', 'metal', 'rock', 'gate']);
    const laneVis: THREE.Vector3[] = []; // camnode positions, in chain order
    const laneRaw: [number, number, number, number][] = []; // [x, z, corner radius, y] per node
    // '!' WIRING IS THE GROUPING: every group that holds (or contains, via
    // nesting) a '!' switch. Breakable crates in these groups start as
    // outline ghosts automatically — no per-crate flag to remember.
    const bangGroups = new Set<number>();
    for (const c of data.components) {
      if (c.t === 'crate' && c.kind === 'bang')
        for (const id of groupChainOf(c, data)) bangGroups.add(id);
    }
    for (const pass of [true, false]) {
      // geometry built first (pass 1); before the entity pass, flush world
      // matrices so build-time raycasts (crate seating) hit the real decks
      // — freshly added meshes carry an identity matrixWorld until now.
      if (!pass) this.root.updateMatrixWorld(true);
      data.components.forEach((c, i) => {
        if (geomPass.has(c.t) !== pass) return;
        buildTagged(i, () => {
          const tinted = (fallback: THREE.MeshLambertMaterial): THREE.MeshLambertMaterial =>
            c.color ? new THREE.MeshLambertMaterial({ color: new THREE.Color(c.color) }) : fallback;
          // VECTOR SHAPES: a 3+ point outline turns platform/wall/pit into a
          // drawn polygon. Shape points are authored in XZ around p; three.js
          // Shapes live in XY, so (x, -z) + rotateX(-90°) lands them flat.
          // corner radii fillet the outline BEFORE any geometry/collision is
          // derived, so the rounding is real everywhere (edits stay on the
          // raw nodes — handles and saves never see the fillet points)
          const polyPts =
            c.pts && c.pts.length >= 3
              ? roundCorners(c.pts, true).map((q) => [q.x, q.z] as [number, number])
              : null;
          const polyShape = (): THREE.Shape => {
            const sh = new THREE.Shape();
            sh.moveTo(polyPts![0][0], -polyPts![0][1]);
            for (let k = 1; k < polyPts!.length; k++) sh.lineTo(polyPts![k][0], -polyPts![k][1]);
            sh.closePath();
            return sh;
          };
          // texture tiling for drawn polygons follows the outline's bounds
          const polySpan = (): [number, number] => {
            let nx = Infinity, xx = -Infinity, nz = Infinity, xz = -Infinity;
            for (const [px, pz] of polyPts!) {
              nx = Math.min(nx, px); xx = Math.max(xx, px);
              nz = Math.min(nz, pz); xz = Math.max(xz, pz);
            }
            return [xx - nx, xz - nz];
          };
          if (c.t === 'platform' && polyPts) {
            // drawn deck: extruded slab, walkable via the ground raycast.
            // Sides are raycast-only (the collision engine is AABB — same
            // deal as free-spun rectangles).
            const th = c.s?.[1] ?? 1;
            const geo = new THREE.ExtrudeGeometry(polyShape(), { depth: th, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            const [pw, pd] = polySpan();
            const mesh = new THREE.Mesh(geo, this.patterned(tinted(deck), pw, pd, c.tex ?? 'checker'));
            mesh.position.set(c.p[0], c.p[1] - th / 2, c.p[2]); // extrude spans local y 0..th; p is the slab centre
            mesh.name = 'platform';
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
          } else if (c.t === 'wall' && polyPts) {
            // drawn wall/blocker: extruded up from the base; the solid inside
            // is filled with 1-unit scanline slabs so the AABB engine pushes
            // back everywhere, including diagonal faces (coarsely).
            const h = c.s?.[1] ?? 4;
            const geo = new THREE.ExtrudeGeometry(polyShape(), { depth: h, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            const wallBase = tinted(new THREE.MeshLambertMaterial({ color: 0x9a8a7a }));
            const [ww, wd] = polySpan();
            const mesh = new THREE.Mesh(
              geo,
              c.tex ? this.patterned(wallBase, Math.max(ww, wd), h + 2, c.tex) : wallBase,
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]); // extrude spans local y 0..h; p is the base centre
            this.root.add(mesh);
            this.groundMeshes.push(mesh); // the top is standable
            this.fillWallSlabs(polyPts, c.p[0], c.p[2], c.p[1], h);
          } else if (c.t === 'pit' && polyPts) {
            // drawn death pool: dark polygon visual; the kill volume is the
            // bounding box gated by a true point-in-polygon test (see
            // pitMissesPoly) so only the drawn shape burns.
            const geo = new THREE.ShapeGeometry(polyShape());
            geo.rotateX(-Math.PI / 2);
            const pool = new THREE.Mesh(
              geo,
              new THREE.MeshBasicMaterial({ color: 0x0a0a10, side: THREE.DoubleSide }),
            );
            pool.position.set(c.p[0], c.p[1] + 0.02, c.p[2]);
            this.root.add(pool);
            let minX = Infinity;
            let maxX = -Infinity;
            let minZ = Infinity;
            let maxZ = -Infinity;
            for (const [px, pz] of polyPts) {
              minX = Math.min(minX, px);
              maxX = Math.max(maxX, px);
              minZ = Math.min(minZ, pz);
              maxZ = Math.max(maxZ, pz);
            }
            const box = new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(c.p[0] + (minX + maxX) / 2, c.p[1] - 0.75, c.p[2] + (minZ + maxZ) / 2),
              new THREE.Vector3(maxX - minX, 2.0, maxZ - minZ),
            );
            this.pitBoxes.push(box);
            this.pitPolyByBox.set(box, { cx: c.p[0], cz: c.p[2], pts: polyPts });
          } else if (c.t === 'platform') {
            const s = c.s ?? [8, 1, 8];
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], s[1], s[2]),
              this.patterned(tinted(deck), s[0], s[2], c.tex ?? 'checker'),
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]);
            mesh.rotation.y = THREE.MathUtils.degToRad(c.yaw ?? 0); // ride surface is raycast: free spin is fine
            mesh.name = 'platform';
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
            // SIDE COLLISION: without it you clip into a thick platform's
            // face, and from inside the box the ground raycast sees only
            // backfaces — you fall through the map. The collider's top is
            // tucked UNDER the walk surface (wall pushes are XZ-only and the
            // boxes are boundary-inclusive, so a full-height box would shove
            // anyone standing on top). Axis-aligned yaws only — the collision
            // engine is AABB; free-spun platforms stay raycast-only.
            const yawQ = (((c.yaw ?? 0) % 360) + 360) % 360;
            {
              const top = c.p[1] + s[1] / 2 - 0.25;
              const bottom = c.p[1] - s[1] / 2;
              if (top > bottom) {
                if (yawQ % 90 === 0) {
                  const swapped = yawQ % 180 !== 0;
                  const w = swapped ? s[2] : s[0];
                  const d = swapped ? s[0] : s[2];
                  this.walls.push(
                    new THREE.Box3().setFromCenterAndSize(
                      new THREE.Vector3(c.p[0], (top + bottom) / 2, c.p[2]),
                      new THREE.Vector3(w, top - bottom, d),
                    ),
                  );
                } else {
                  // free-spun: fill the rotated footprint with slabs (slight
                  // inset — the walk surface must win at the rim)
                  this.fillWallSlabs(
                    rectCorners(s[0] * 0.96, s[2] * 0.96, yawQ),
                    c.p[0],
                    c.p[2],
                    bottom,
                    top - bottom,
                  );
                }
              }
            }
          } else if (c.t === 'rock') {
            // Low-poly boulder: a seeded, jittered dodecahedron squeezed into
            // the s-box. Walkable via the ground raycast; sides push like a
            // slightly-inset wall so the round face doesn't feel like glass.
            const s = c.s ?? [3, 2, 3];
            const seed = c.seed ?? i * 7919;
            let rng = (seed | 0) + 0x6d2b79f5;
            const rand = (): number => {
              rng = Math.imul(rng ^ (rng >>> 15), rng | 1);
              rng ^= rng + Math.imul(rng ^ (rng >>> 7), rng | 61);
              return ((rng ^ (rng >>> 14)) >>> 0) / 4294967296;
            };
            const geo = new THREE.DodecahedronGeometry(0.5, 0).toNonIndexed();
            const pos = geo.getAttribute('position') as THREE.BufferAttribute;
            // jitter shared corners identically (keyed by rounded position)
            // so the faceted shell stays watertight
            const jit = new Map<string, number>();
            for (let v = 0; v < pos.count; v++) {
              const key = `${pos.getX(v).toFixed(3)},${pos.getY(v).toFixed(3)},${pos.getZ(v).toFixed(3)}`;
              if (!jit.has(key)) jit.set(key, 0.78 + rand() * 0.42);
              const k = jit.get(key)!;
              pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k, pos.getZ(v) * k);
            }
            geo.scale(s[0], s[1], s[2]);
            // bake the seed spin AND the editor yaw into the geometry, so the
            // collider below reads the rock's REAL world-space extents — the
            // old fixed 0.8-inset box sat inside the jitter bulges (up to
            // 1.2×) and let you wade straight through the fat sides.
            geo.rotateY((seed % 7) * 0.9 + THREE.MathUtils.degToRad(c.yaw ?? 0));
            geo.computeVertexNormals(); // non-indexed = flat faceted shading
            geo.computeBoundingBox();
            const bb = geo.boundingBox!;
            const rockColor = c.color ? new THREE.Color(c.color).getHex() : 0x8d8678;
            const mesh = new THREE.Mesh(
              geo,
              new THREE.MeshLambertMaterial({ color: rockColor, map: this.surfaceTexture(c.tex ?? 'stone') }),
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]);
            mesh.name = 'rock';
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
            const top = c.p[1] + bb.max.y - 0.25; // tucked under the walk surface
            const bottom = c.p[1] + bb.min.y;
            if (top > bottom) {
              this.walls.push(
                new THREE.Box3().setFromCenterAndSize(
                  new THREE.Vector3(
                    c.p[0] + (bb.min.x + bb.max.x) / 2,
                    (top + bottom) / 2,
                    c.p[2] + (bb.min.z + bb.max.z) / 2,
                  ),
                  new THREE.Vector3((bb.max.x - bb.min.x) * 0.94, top - bottom, (bb.max.z - bb.min.z) * 0.94),
                ),
              );
            }
          } else if (c.t === 'ramp') {
            const len = c.len ?? 10;
            const rise = c.rise ?? 4;
            const w = c.w ?? 8;
            this.ramp('ramp', c.p[2] + len / 2, c.p[1], c.p[2] - len / 2, c.p[1] + rise, w, tinted(deck), c.p[0], c.tex ?? 'stone');
            const rad = THREE.MathUtils.degToRad(c.yaw ?? 0);
            if (rad) {
              // spin the built slope around the component centre: orbit its
              // offset position and compose the yaw BEFORE the slope pitch
              const m = this.root.children[this.root.children.length - 1];
              const dx = m.position.x - c.p[0];
              const dz = m.position.z - c.p[2];
              m.position.x = c.p[0] + dx * Math.cos(rad) + dz * Math.sin(rad);
              m.position.z = c.p[2] - dx * Math.sin(rad) + dz * Math.cos(rad);
              m.rotation.order = 'YXZ';
              m.rotation.y = rad;
            }
          } else if (c.t === 'wall') {
            const s = c.s ?? [8, 4, 1];
            const yawQ = (((c.yaw ?? 0) % 360) + 360) % 360;
            const yawRad = THREE.MathUtils.degToRad(yawQ);
            // one collider recipe for every wall flavor: exact box when the
            // yaw is axis-aligned, rotated-footprint slabs otherwise
            const wallCollider = (): void => {
              if (yawQ % 90 === 0) {
                const swapped = yawQ % 180 !== 0;
                this.walls.push(
                  new THREE.Box3().setFromCenterAndSize(
                    new THREE.Vector3(c.p[0], c.p[1] + s[1] / 2, c.p[2]),
                    new THREE.Vector3(swapped ? s[2] : s[0], s[1], swapped ? s[0] : s[2]),
                  ),
                );
              } else {
                this.fillWallSlabs(rectCorners(s[0], s[2], yawQ), c.p[0], c.p[2], c.p[1], s[1]);
              }
            };
            if (c.invisible) {
              // collider only + an editor-mode ghost so it stays selectable
              wallCollider();
              const ghost = new THREE.Mesh(
                new THREE.BoxGeometry(s[0], s[1], s[2]),
                new THREE.MeshBasicMaterial({ color: 0x64d8ff, transparent: true, opacity: 0.22, depthWrite: false }),
              );
              ghost.position.set(c.p[0], c.p[1] + s[1] / 2, c.p[2]);
              ghost.rotation.y = yawRad;
              ghost.visible = false; // the editor reveals it while editing
              ghost.userData.editorGhost = true;
              this.root.add(ghost);
            } else if (c.color || c.tex || yawQ % 90 !== 0) {
              // tinted / textured / spun wall: own mesh so the yaw can rotate it
              const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(s[0], s[1], s[2]),
                this.patterned(
                  new THREE.MeshLambertMaterial({ color: c.color ? new THREE.Color(c.color) : new THREE.Color(0x9a8a7a) }),
                  s[0],
                  s[1],
                  c.tex ?? 'stone',
                ),
              );
              mesh.position.set(c.p[0], c.p[1] + s[1] / 2, c.p[2]);
              mesh.rotation.y = yawRad;
              this.root.add(mesh);
              wallCollider();
            } else {
              // axis-aligned default texture path; 90/270 swaps footprint
              const swapped = yawQ % 180 !== 0;
              this.wall(c.p[0], c.p[2], swapped ? s[2] : s[0], swapped ? s[0] : s[2], c.p[1], s[1]);
            }
          } else if (c.t === 'pit') {
            const s = c.s ?? [6, 1, 6];
            const yawQ = (((c.yaw ?? 0) % 360) + 360) % 360;
            const yawRad = THREE.MathUtils.degToRad(yawQ);
            // dark pool + faint ember rim; the volume is a touch-kill box
            const pool = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], 0.18, s[2]),
              new THREE.MeshLambertMaterial({ color: 0x07070c, emissive: 0x1a0406 }),
            );
            pool.position.set(c.p[0], c.p[1] + 0.02, c.p[2]);
            pool.rotation.y = yawRad;
            this.root.add(pool);
            const rim = new THREE.Mesh(
              new THREE.BoxGeometry(s[0] + 0.5, 0.06, s[2] + 0.5),
              new THREE.MeshBasicMaterial({ color: 0xb0402a, transparent: true, opacity: 0.5 }),
            );
            rim.position.set(c.p[0], c.p[1] + 0.001, c.p[2]);
            rim.rotation.y = yawRad;
            this.root.add(rim);
            // Kill volume hugs the pool: only 0.25 above the surface (feet must
            // actually touch the lava — landing on a crate seated over the pit
            // is safe), and 2.0 deep so a max-gravity fall can't step past it.
            // A spun pit kills through the rotated-corner polygon; the box is
            // just its broad phase (same machinery as drawn pits).
            const corners = yawQ % 180 === 0 ? null : rectCorners(s[0], s[2], yawQ);
            if (corners) {
              let minX = Infinity;
              let maxX = -Infinity;
              let minZ = Infinity;
              let maxZ = -Infinity;
              for (const [px, pz] of corners) {
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minZ = Math.min(minZ, pz);
                maxZ = Math.max(maxZ, pz);
              }
              const box = new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(c.p[0], c.p[1] - 0.75, c.p[2]),
                new THREE.Vector3(maxX - minX, 2.0, maxZ - minZ),
              );
              this.pitBoxes.push(box);
              this.pitPolyByBox.set(box, { cx: c.p[0], cz: c.p[2], pts: corners });
            } else {
              this.pitBoxes.push(
                new THREE.Box3().setFromCenterAndSize(
                  new THREE.Vector3(c.p[0], c.p[1] - 0.75, c.p[2]),
                  new THREE.Vector3(s[0], 2.0, s[2]),
                ),
              );
            }
          } else if (c.t === 'metal') {
            // unbreakable steel box: stand on it, bonk off it, never break it
            const size = 0.96;
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(size, size, size),
              new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.metalTexture() }),
            );
            mesh.userData.metalCrate = true; // capture tag
            mesh.position.set(c.p[0], c.p[1] + size / 2, c.p[2]);
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
            // side collider stops under the top face — standing on the box
            // must not trigger the XZ push-out (see the platform note)
            this.walls.push(
              new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(mesh.position.x, mesh.position.y - 0.125, mesh.position.z),
                new THREE.Vector3(size, size - 0.25, size),
              ),
            );
          } else if (c.t === 'rail') {
            // invisible = a bare grind line (captured deck-edge ledges): full
            // physics, no chrome — the editor still shows its node handles
            if (c.pts && c.pts.length >= 2) {
              // multi-node rail: pen-drawn path — corner radii round the
              // bends, per-node height offsets climb and dive
              const rp = roundCorners(c.pts, false);
              const rail = new Rail(
                rp.map((q) => new THREE.Vector3(c.p[0] + q.x, c.p[1] + q.y, c.p[2] + q.z)),
                !c.invisible,
              );
              this.rails.push(rail);
              this.root.add(rail.object);
            } else {
              const len = c.len ?? 12;
              const a = THREE.MathUtils.degToRad(c.yaw ?? 0);
              const dx = (Math.sin(a) * len) / 2;
              const dz = (Math.cos(a) * len) / 2;
              const rail = new Rail(
                [
                  new THREE.Vector3(c.p[0] - dx, c.p[1], c.p[2] - dz),
                  new THREE.Vector3(c.p[0] + dx, c.p[1], c.p[2] + dz),
                ],
                !c.invisible,
              );
              this.rails.push(rail);
              this.root.add(rail.object);
            }
          } else if (c.t === 'pipe') {
            const len = c.len ?? 36;
            const axis = c.axis ?? 'z';
            const along = axis === 'z' ? c.p[2] : c.p[0];
            const cross = axis === 'z' ? c.p[0] : c.p[2];
            // captured levels carry the source pipe's true profile in w/rise
            const hp = new Halfpipe(along + len / 2, along - len / 2, c.p[1], c.w ?? 3, c.rise ?? 6, matPipe, cross, axis);
            this.halfpipes.push(hp);
            this.root.add(hp.object);
            for (const wm of hp.walls) this.groundMeshes.push(wm);
            // both copings are grindable, like the authored pipes
            for (const side of [-1, 1]) {
              const lipC = cross + side * hp.lipX;
              const y = hp.lipY + 0.05;
              const rail =
                axis === 'z'
                  ? new Rail([new THREE.Vector3(lipC, y, along + len / 2), new THREE.Vector3(lipC, y, along - len / 2)])
                  : new Rail([new THREE.Vector3(along + len / 2, y, lipC), new THREE.Vector3(along - len / 2, y, lipC)]);
              this.rails.push(rail);
              this.root.add(rail.object);
              // SOLID BACK: the transition is a one-sided sheet — from behind
              // you'd walk (or fall) straight through into the pipe. A box
              // just outside each wall blocks that, stopping under the coping
              // so lip play stays clear. Skipped when another pipe's mouth is
              // right across this lip line (a shared ridge — the spine
              // transfer and ride-through must stay open).
              const probe = lipC + side * 1.0;
              const covered = data.components.some((o) => {
                if (o === c || o.t !== 'pipe' || (o.axis ?? 'z') !== axis) return false;
                const oCross = axis === 'z' ? o.p[0] : o.p[2];
                const oAlong = axis === 'z' ? o.p[2] : o.p[0];
                const oLen = o.len ?? 36;
                if (Math.abs(oAlong - along) > (oLen + len) / 2) return false;
                return Math.abs(probe - oCross) <= 9 - 0.3; // inside its mouth (lipX = 9)
              });
              if (!covered) {
                const h = hp.lipY - hp.yBottom - 0.4;
                const cy = hp.yBottom + h / 2;
                // offset 0.8 clear of the lip line: a rider hugging the
                // INSIDE face at the coping reaches within a player-half of
                // it, and the back box must never clip the climb
                const bc = lipC + side * 1.45;
                this.walls.push(
                  new THREE.Box3().setFromCenterAndSize(
                    axis === 'z' ? new THREE.Vector3(bc, cy, along) : new THREE.Vector3(along, cy, bc),
                    axis === 'z' ? new THREE.Vector3(1.3, h, len) : new THREE.Vector3(len, h, 1.3),
                  ),
                );
              }
            }
          } else if (c.t === 'rope') {
            // sagging grindable rope strung between two posts: len along yaw
            const len = c.len ?? 12;
            const a = THREE.MathUtils.degToRad(c.yaw ?? 0);
            const dx = (Math.sin(a) * len) / 2;
            const dz = (Math.cos(a) * len) / 2;
            this.skyRope(
              c.p[0] - dx,
              c.p[2] - dz,
              c.p[0] + dx,
              c.p[2] + dz,
              c.p[1],
              c.shake ?? 3,
              c.amp ?? 1.2,
              4,
            );
          } else if (c.t === 'gate') {
            // finish gate: crossing its plane ends the run (and the time trial)
            this.finishZ = c.p[2];
            this.finishGate(c.p[1], c.p[2], c.p[0], c.yaw ?? 0);
          } else if (c.t === 'clock' || c.t === 'comboorb') {
            // run-mode activators: just remember the authored spot — the
            // pickups build after every level's geometry (placeClock /
            // placeComboOrb), which tags them back to this component
            const spot = { x: c.p[0], y: c.p[1], z: c.p[2], idx: i };
            if (c.t === 'clock') this.clockSpot = spot;
            else this.orbSpot = spot;
          } else if (c.t === 'zone') {
            // travel zone: a region that turns the course sideways (E/W) or
            // runs it straight AT the camera (N). Invisible in play; the
            // editor reveals a tinted slab ghost with a direction arrow.
            const s = c.s ?? [14, 1, 10];
            this.zones.push({
              xMin: c.p[0] - s[0] / 2,
              xMax: c.p[0] + s[0] / 2,
              zMin: c.p[2] - s[2] / 2,
              zMax: c.p[2] + s[2] / 2,
              dir: c.dir ?? 'E',
            });
            const ghost = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], 0.3, s[2]),
              new THREE.MeshBasicMaterial({
                color: c.dir === 'N' ? 0xffb060 : 0x9a6cff,
                transparent: true,
                opacity: 0.2,
                depthWrite: false,
              }),
            );
            ghost.position.set(c.p[0], c.p[1] + 0.3, c.p[2]);
            ghost.visible = false;
            ghost.userData.editorGhost = true;
            this.root.add(ghost);
            const arrow = new THREE.Mesh(
              new THREE.ConeGeometry(0.9, 2.6, 5),
              new THREE.MeshBasicMaterial({
                color: c.dir === 'N' ? 0xffb060 : 0x9a6cff,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
              }),
            );
            arrow.position.set(c.p[0], c.p[1] + 1.4, c.p[2]);
            arrow.rotation.z = c.dir === 'E' ? -Math.PI / 2 : c.dir === 'W' ? Math.PI / 2 : 0;
            if (c.dir === 'N') arrow.rotation.x = Math.PI / 2; // points at the lens
            if (c.dir === 'S') arrow.rotation.x = -Math.PI / 2; // points down-course
            arrow.visible = false;
            arrow.userData.editorGhost = true;
            this.root.add(arrow);
          } else if (c.t === 'crumble') {
            const s = c.s ?? [3, 1, 3];
            const col = c.color ? new THREE.Color(c.color).getHex() : undefined;
            this.crumblePad(c.p[0], c.p[1], c.p[2], s[0], s[2], null, c.shake ?? 0.7, col, c.yaw ?? 0, c.tex ?? 'wood', c.speed ?? 30);
          } else if (c.t === 'crate') {
            const gids = groupChainOf(c, data);
            // sharing a group with a '!' switch ghosts the crate until the
            // switch fires (switches themselves stay solid)
            const wiredToBang =
              c.kind !== 'bang' && c.kind !== 'nitrobang' && gids.some((id) => bangGroups.has(id));
            this.crate(c.p[0], c.p[1], c.p[2], c.kind === 'wood' ? undefined : c.kind, {
              outline: c.outline || wiredToBang,
              groupIds: gids,
            });
          } else if (c.t === 'outline') {
            // LEGACY saves: build as a wood crate in the outline state
            this.crate(c.p[0], c.p[1], c.p[2], undefined, {
              outline: true,
              groupIds: groupChainOf(c, data),
            });
          } else if (c.t === 'checkpoint') {
            this.checkpoint(c.p[1], c.p[2], c.p[0]);
          } else if (c.t === 'enemy') {
            const r = c.range ?? 5;
            const foe = (c.foe ?? 'grunt') as EnemyKind;
            // yaw 90/270 turns the patrol onto the Z axis (the walk is
            // axis-bound; the editor exposes it as a patrol-direction toggle)
            const eYaw = (((c.yaw ?? 0) % 360) + 360) % 360;
            if (eYaw % 180 >= 45 && eYaw % 180 < 135) {
              this.enemy(c.p[2] - r, c.p[2] + r, c.p[1], c.p[0], c.speed ?? 3, 'z', foe);
            } else {
              this.enemy(c.p[0] - r, c.p[0] + r, c.p[1], c.p[2], c.speed ?? 3, 'x', foe);
            }
          } else if (c.t === 'crusher') {
            const s = c.s ?? [4, 3, 3];
            this.crusher(c.p[0], c.p[1], c.p[2], s[0], s[2], c.cycle ?? 3.2, c.phase ?? 0);
          } else if (c.t === 'ropeswing') {
            this.ropeSwing(c.p[0], c.p[1], c.p[2], c.len ?? 6, c.amp ?? 0.85, c.speed ?? 0, c.phase ?? 0, c.yaw ?? 0);
          } else if (c.t === 'pendulum') {
            this.pendulum(c.p[0], c.p[1], c.p[2], c.len ?? 5, c.amp ?? 1.0, c.speed ?? 1.6, c.phase ?? 0, c.yaw ?? 0);
          } else if (c.t === 'wumpa') {
            this.pickup(c.p[0], c.p[1], c.p[2]);
          } else if (c.t === 'camnode') {
            // camera-lane node: pure editor object — a floating diamond you
            // drag around; invisible (and non-physical) in play. lanePts is
            // built AFTER the loop so per-node corner radii can round the
            // whole path at once.
            laneRaw.push([c.p[0], c.p[2], c.radius ?? 0, c.p[1]]);
            laneVis.push(new THREE.Vector3(c.p[0], c.p[1], c.p[2]));
            const marker = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.5, 0),
              new THREE.MeshBasicMaterial({ color: 0xff5ad2, transparent: true, opacity: 0.85, depthWrite: false }),
            );
            marker.position.set(c.p[0], c.p[1], c.p[2]);
            marker.visible = false;
            marker.userData.editorGhost = true;
            this.root.add(marker);
          } else if (c.t === 'crystal') {
            this.crystal(c.p[0], c.p[1], c.p[2]);
          }
        });
      });
      // the lane itself: a ghost line with direction cones, editor-only and
      // unpickable (no editorIdx — the NODES are the editable things).
      // Corner radii round the STEERING path — the camera and controls sweep
      // through the bend instead of pivoting at the node.
      if (laneVis.length >= 2) {
        const laneRound = roundCorners(laneRaw, false);
        this.lanePts = laneRound.map((q) => ({ x: q.x, z: q.z }));
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(
            laneRound.map((q) => new THREE.Vector3(q.x, q.y, q.z)),
          ),
          new THREE.LineBasicMaterial({ color: 0xff5ad2 }),
        );
        line.visible = false;
        line.userData.editorGhost = true;
        this.root.add(line);
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i < laneVis.length - 1; i++) {
          const dir = laneVis[i + 1].clone().sub(laneVis[i]);
          if (dir.lengthSq() < 1e-4) continue;
          const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.32, 0.85, 6),
            new THREE.MeshBasicMaterial({ color: 0xff8ae0, transparent: true, opacity: 0.8, depthWrite: false }),
          );
          cone.position.copy(laneVis[i]).addScaledVector(dir, 0.5);
          cone.quaternion.setFromUnitVectors(up, dir.clone().normalize());
          cone.visible = false;
          cone.userData.editorGhost = true;
          this.root.add(cone);
        }
      }
    }
  }

  dispose(): void {
    const disposeMat = (x: THREE.Material): void => {
      const map = (x as THREE.MeshLambertMaterial).map;
      if (map) map.dispose();
      x.dispose();
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else if (mat) disposeMat(mat);
    });
    this.scene.remove(this.root);
  }

  get totalCrates(): number {
    // the gem tally: real breakable boxes. Wood arrow crates count (they
    // break now); explosives, switches, and the metal family never do.
    return this.crates.filter((c) => !c.nitro && !c.tnt && !c.bang && !c.nitroBang && !c.metalBounce)
      .length;
  }

  zoneAt(x: number, z: number): { dir: 'E' | 'W' | 'N' | 'S' } | null {
    for (const zn of this.zones) {
      if (x >= zn.xMin && x <= zn.xMax && z >= zn.zMin && z <= zn.zMax) return zn;
    }
    return null;
  }

  // Fill a polygon footprint with 1-unit-deep axis-aligned collision slabs
  // (scanline, even-odd) — how drawn walls and spun rectangles get solid
  // sides out of an AABB-only collision engine. pts are relative to cx/cz.
  private fillWallSlabs(pts: [number, number][], cx: number, cz: number, y0: number, h: number): void {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [, pz] of pts) {
      minZ = Math.min(minZ, pz);
      maxZ = Math.max(maxZ, pz);
    }
    let slabs = 0;
    for (let z = Math.floor(minZ) + 0.5; z < maxZ && slabs < 240; z += 1) {
      const xs: number[] = [];
      for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
        const [xa, za] = pts[k];
        const [xb, zb] = pts[j];
        if (za > z !== zb > z) xs.push(xa + ((xb - xa) * (z - za)) / (zb - za));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const span = xs[k + 1] - xs[k];
        if (span < 0.2) continue;
        slabs++;
        this.walls.push(
          new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(cx + (xs[k] + xs[k + 1]) / 2, y0 + h / 2, cz + z),
            new THREE.Vector3(span, h, 1),
          ),
        );
      }
    }
  }

  // POLYGON death pits: the coarse Box3 lives in pitBoxes like any pit; the
  // actual shape is tested here. Returns true when the box HAS a polygon and
  // the point falls outside it — the kill should be skipped.
  private pitPolyByBox = new Map<THREE.Box3, { cx: number; cz: number; pts: [number, number][] }>();
  pitMissesPoly(box: THREE.Box3, x: number, z: number): boolean {
    const poly = this.pitPolyByBox.get(box);
    if (!poly) return false;
    return !pointInPoly(x - poly.cx, z - poly.cz, poly.pts);
  }

  // CAMERA LANE (Crash 3 camera rails): camnode components chain into a
  // polyline; the tangent of the nearest segment is the local "down-course"
  // direction the camera and the controls steer along.
  private lanePts: { x: number; z: number }[] = [];
  get laneActive(): boolean {
    return this.lanePts.length >= 2;
  }

  laneDirAt(x: number, z: number): { x: number; z: number } | null {
    // a travel ZONE is a deliberate LOCAL override of the camera spine:
    // inside its rectangle the zone owns the course frame (side-scroll /
    // run-at-camera), and the lane resumes where the zone ends
    if (this.zoneAt(x, z)) return null;
    const pts = this.lanePts;
    if (pts.length < 2) return null;
    let best = Infinity;
    let bx = 0;
    let bz = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x;
      const az = pts[i].z;
      const dx = pts[i + 1].x - ax;
      const dz = pts[i + 1].z - az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) continue;
      let t = ((x - ax) * dx + (z - az) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const d2 = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (d2 < best) {
        best = d2;
        bx = dx;
        bz = dz;
      }
    }
    const l = Math.hypot(bx, bz);
    return l > 1e-4 ? { x: bx / l, z: bz / l } : null;
  }

  update(dt: number): void {
    this.updateVfx(dt);
    // Spun-away enemies: ballistic tumble; anything they hit, breaks.
    for (const e of this.enemies) {
      if (e.flungT === undefined || !e.flungVel) continue;
      e.flungT += dt;
      e.flungVel.y -= 30 * dt;
      e.group.position.addScaledVector(e.flungVel, dt);
      e.group.rotation.x += 9 * dt;
      e.group.rotation.y += 5 * dt;
      for (const c of this.crates) {
        if (!c.alive || c.bouncy || c.metalBounce || c.bang || c.pending) continue;
        if (e.group.position.distanceTo(c.mesh.position) < 1.5) {
          if (c.nitro || c.tnt) this.detonate(c);
          else {
            this.breakCrate(c);
            this.blastBroken.push(c); // player tallies it like blast debris
          }
        }
      }
      if (e.flungT > 1.4) {
        e.flungT = undefined;
        e.flungVel = undefined;
        e.group.visible = false;
      }
    }

    // Rolling stones: back and forth along the course, always turning.
    for (const st of this.stones) {
      if (st.chase) continue; // the boulder has its own brain below
      st.mesh.position.z += st.dir * st.speed * dt;
      if (st.mesh.position.z < st.z1) {
        st.mesh.position.z = st.z1;
        st.dir = 1;
      } else if (st.mesh.position.z > st.z0) {
        st.mesh.position.z = st.z0;
        st.dir = -1;
      }
      st.mesh.rotation.x -= (st.dir * st.speed * dt) / st.r;
      st.box.setFromCenterAndSize(
        st.mesh.position,
        new THREE.Vector3(st.r * 1.7, st.r * 2, st.r * 1.7),
      );
    }

    // THE BOULDER. Waits behind the spawn until the player bolts, then rolls
    // +Z after them — rubber-banding so it stays scary but beatable. It fills
    // the corridor wall to wall (no dodging sideways), crushes crates, sets
    // off explosives, flattens enemies, and finally tips into the end pit.
    const b = this.boulder;
    if (b) {
      const st = b.st;
      const p = st.mesh.position;
      if (!b.active && !b.falling && this.playerPos.z > b.triggerZ) {
        b.active = true;
        sfx.play('crunch', 0.9, 0.55);
      }
      if (b.active) {
        const gap = this.playerPos.z - p.z; // how far ahead the runner is
        // Rubber-band around the tunable base speed (ratios preserved).
        const base = TUNING.boulderSpeed;
        let sp = base;
        if (gap < -2) sp = base * 1.36; // it already passed you: let it thunder off
        else if (gap < 14) sp = base * 0.84; // right on your heels: a sliver of mercy
        else if (gap > 50) sp = base * 1.28; // never let it fall out of frame
        st.speed = sp;
        p.z += sp * dt;
        p.y = this.boulderGroundY(p.z) + st.r * 0.92;
        st.mesh.rotation.x += (sp * dt) / st.r;
        // Wall-to-wall kill box: you outrun a boulder, you don't sidestep it.
        st.box.setFromCenterAndSize(p, new THREE.Vector3(12.5, st.r * 1.9, st.r * 1.4));
        for (const c of this.crates) {
          if (!c.alive || c.pending || c.metalBounce) continue; // the boulder can still slam a '!' switch
          const cp = c.mesh.position;
          if (Math.abs(cp.z - p.z) < st.r + 0.8 && Math.abs(cp.x - p.x) < st.r + 0.8) {
            if (c.nitro || c.tnt) this.detonate(c);
            else this.breakCrate(c);
          }
        }
        for (const e of this.enemies) {
          if (e.alive && Math.abs(e.group.position.z - p.z) < st.r + 0.8) this.killEnemy(e);
        }
        if (p.z >= b.endZ) {
          b.active = false;
          b.falling = true;
          st.box.makeEmpty();
        }
      } else if (b.falling) {
        b.fallV += 32 * dt;
        p.y -= b.fallV * dt;
        p.z += 5 * dt; // tips forward into the pit
        st.mesh.rotation.x += 2 * dt;
        if (p.y < this.killY - 20) b.falling = false;
      }
    }

    // Moving platforms: sine slide along one axis; the player reads lastDelta
    // at the top of their step so they ride along.
    for (const m of this.movers) {
      const s = Math.sin(this.time * m.speed + m.phase) * m.amp;
      m.lastDelta
        .copy(m.base)
        .addScaledVector(m.axisV, s)
        .sub(m.mesh.position);
      m.mesh.position.add(m.lastDelta);
    }

    // Crumble pads: shake, drop, (maybe) regrow.
    for (const c of this.crumbles) {
      if (c.state === 'idle') continue;
      c.t += dt;
      if (c.state === 'shake') {
        c.mesh.position.x = c.base.x + Math.sin(c.t * 55) * 0.06;
        c.mesh.position.y = c.base.y - c.t * 0.25;
        if (c.t > c.shakeTime) {
          c.state = 'fall';
          c.t = 0;
          if (Math.abs(c.base.z - this.playerPos.z) < 45) sfx.play('crunch', 0.45, 0.9);
        }
      } else if (c.state === 'fall') {
        c.mesh.position.y -= c.fallSpeed * c.t * dt;
        c.mesh.rotation.x += 1.6 * dt;
        c.mesh.rotation.z += 0.9 * dt;
        // vanish once it has tumbled well out of sight (distance-based so a
        // slow faller stays visible all the way down); time cap catches speed ~0
        if (c.base.y - c.mesh.position.y > 18 || c.t > 8) {
          c.state = 'gone';
          c.t = 0;
          c.mesh.visible = false;
          c.mesh.position.y = c.base.y - 400; // park far below any raycast
        }
      } else if (c.state === 'gone' && c.regen !== null && c.t > c.regen) {
        c.state = 'idle';
        c.mesh.visible = true;
        c.mesh.position.copy(c.base);
        c.mesh.rotation.set(0, c.yaw, 0);
      }
    }

    // Sky-bridge ropes: sag + wobble under a grinder, snap if you linger too
    // long, ease back taut if you hop off in time, restring after the fall.
    for (const r of this.ropes) {
      const N = r.rest.length - 1;
      if (r.state === 'break') {
        r.t += dt;
        for (let i = 1; i < N; i++) r.rail.points[i].y -= 34 * r.t * dt; // the span plunges — a grinder rides it into the void
        this.syncRope(r);
        if (r.t > 1.2) {
          r.state = 'gone';
          r.t = 0;
          for (const s of r.segs) s.visible = false;
        }
        r.active = false;
        continue;
      }
      if (r.state === 'gone') {
        r.t += dt;
        if (r.regen !== null && r.t > r.regen) {
          r.state = 'idle';
          r.t = 0;
          for (let i = 0; i <= N; i++) r.rail.points[i].copy(r.rest[i]);
          for (const s of r.segs) s.visible = true;
          this.syncRope(r);
        }
        r.active = false;
        continue;
      }
      if (r.active) {
        if (r.state === 'idle') {
          r.state = 'sag';
          r.t = 0;
        }
        r.t += dt;
        if (r.t > r.breakTime) {
          r.state = 'break';
          r.t = 0;
          r.active = false;
          if (Math.abs(r.rest[0].z - this.playerPos.z) < 55) sfx.play('crunch', 0.5, 1.15);
          continue;
        }
      } else if (r.state === 'sag') {
        r.t = Math.max(0, r.t - dt * 1.6); // hopped off: recover toward taut
        if (r.t <= 0) r.state = 'idle';
      }
      const load = r.state === 'sag' ? Math.min(1, r.t / 0.25) : 0;
      for (let i = 1; i < N; i++) {
        const shape = Math.sin((Math.PI * i) / N); // 0 at the posts, 1 at mid-span
        const wob = Math.sin(this.time * 9 + i * 1.3) * 0.09 * shape * load;
        r.rail.points[i].y = r.rest[i].y - shape * r.sagAmt * load + wob;
      }
      this.syncRope(r);
      r.active = false;
    }

    // Crushers: hang -> slam -> rest -> rise, on a loop.
    for (const cr of this.crushers) {
      const t = (this.time + cr.phase) % cr.cycle;
      const f = t / cr.cycle;
      let y: number;
      cr.crushing = false;
      if (f < 0.38) {
        y = cr.restY + cr.raise; // hanging, shadow of doom below
        cr.slammed = false;
      } else if (f < 0.46) {
        y = cr.restY + cr.raise * (1 - (f - 0.38) / 0.08); // the slam
        cr.crushing = true;
      } else if (f < 0.7) {
        y = cr.restY; // resting: a solid wall
        if (!cr.slammed) {
          cr.slammed = true;
          if (Math.abs(cr.z - this.playerPos.z) < 45) sfx.play('crunch', 0.8, 0.5);
        }
      } else {
        y = cr.restY + cr.raise * ((f - 0.7) / 0.3); // slow menacing rise
      }
      cr.mesh.position.y = y;
      cr.box.setFromCenterAndSize(
        new THREE.Vector3(cr.x, y, cr.z),
        new THREE.Vector3(cr.w, cr.h, cr.d),
      );
    }

    // Pendulum blades: swing across the corridor; the bob is a kill box.
    this.killBoxes.length = 0;
    // static death pits (editor component): always-on touch-kill volumes
    for (const b of this.pitBoxes) this.killBoxes.push(b);
    for (const pd of this.pendulums) {
      const a = Math.sin(this.time * pd.speed + pd.phase) * pd.amp;
      pd.pivot.rotation.z = a;
      // bob world offset: the local x-swing spun by the pendulum's yaw
      const swing = Math.sin(a) * pd.len;
      const cos = Math.cos(pd.yaw);
      const sin = Math.sin(pd.yaw);
      const bx = pd.pivot.position.x + swing * cos;
      const bz = pd.pivot.position.z - swing * sin;
      const by = pd.pivot.position.y - Math.cos(a) * pd.len;
      pd.box.setFromCenterAndSize(
        new THREE.Vector3(bx, by, bz),
        new THREE.Vector3(
          2.0 * Math.abs(cos) + 1.6 * Math.abs(sin),
          2.0,
          2.0 * Math.abs(sin) + 1.6 * Math.abs(cos),
        ),
      );
      this.killBoxes.push(pd.box);
      const sign = Math.sign(a) || 1;
      if (sign !== pd.lastSign) {
        pd.lastSign = sign;
        const dz = Math.abs(pd.pivot.position.z - this.playerPos.z);
        const dx = Math.abs(pd.pivot.position.x - this.playerPos.x);
        if (dz < 26 && dx < 26) sfx.play('woosh', 0.28, 1.25);
      }
    }

    // Swing ropes: driven pendulums (the player attaches via player code —
    // here they just keep swinging).
    for (const rs of this.ropeSwings) {
      rs.theta = Math.sin(this.time * rs.speed + rs.phase) * rs.amp;
      rs.thetaV = Math.cos(this.time * rs.speed + rs.phase) * rs.amp * rs.speed;
      rs.pivot.rotation.z = rs.theta;
    }

    // Arena lock: gates up, waves in, gates down when the pit is clear.
    const ar = this.arena;
    if (ar) {
      if (ar.state === 'idle' && ar.zone.containsPoint(this.playerPos)) {
        ar.state = 'active';
        ar.wave = 0;
        ar.waveT = 0.4;
        ar.cycleT = 0;
        ar.up = true;
        for (const g of ar.gates) this.walls.push(g.box);
        sfx.play('railLand', 0.9, 0.6);
      }
      if (ar.state === 'active') {
        // gate breathing: 2.4s raised, 1.2s sunk, repeat — timing a dash
        // through the down-beat is always an option
        ar.cycleT += dt;
        const upNow = ar.cycleT % 3.6 < 2.4;
        if (upNow !== ar.up) {
          ar.up = upNow;
          if (upNow) sfx.play('railLand', 0.5, 0.7);
          for (const g of ar.gates) {
            const i = this.walls.indexOf(g.box);
            if (upNow && i < 0) this.walls.push(g.box);
            else if (!upNow && i >= 0) this.walls.splice(i, 1);
          }
        }
        if (ar.waveT > 0) {
          // countdown, then the wave drops in
          ar.waveT -= dt;
          if (ar.waveT <= 0) {
            for (const e of ar.waves[ar.wave]) {
              e.alive = true;
              e.group.visible = true;
              e.group.scale.setScalar(1);
            }
            sfx.play('enemyDown', 0.6, 1.2);
            ar.waveT = 0;
          }
        } else if (!ar.waves[ar.wave].some((e) => e.alive)) {
          ar.wave++;
          if (ar.wave >= ar.waves.length) {
            ar.state = 'done';
            for (const g of ar.gates) {
              const i = this.walls.indexOf(g.box);
              if (i >= 0) this.walls.splice(i, 1);
            }
            sfx.play('lifeGet', 0.9);
          } else {
            ar.waveT = 0.7; // breather before the next wave
          }
        }
      }
      // gate meshes chase their target height
      for (const g of ar.gates) {
        const target = ar.state === 'active' && ar.up ? g.upY : g.downY;
        g.mesh.position.y += THREE.MathUtils.clamp(target - g.mesh.position.y, -9 * dt, 9 * dt);
      }
    }

    // Collapse wave: once triggered, the bridge falls away toward the exit —
    // slightly slower than a committed sprint, so hesitation is what kills.
    const cw = this.collapse;
    if (cw) {
      if (
        !cw.active &&
        this.playerPos.z < cw.triggerZ &&
        this.playerPos.z > cw.endZ &&
        this.playerPos.x > cw.xMin &&
        this.playerPos.x < cw.xMax
      ) {
        cw.active = true;
        cw.frontZ = cw.startZ;
      }
      if (cw.active) {
        cw.frontZ -= cw.speed * dt;
        for (const p of cw.planks) {
          if (p.state === 'idle' && p.base.z > cw.frontZ) {
            p.state = 'shake';
            p.t = 0;
          }
        }
        if (cw.frontZ < cw.endZ - 10) cw.active = false; // spent
      }
    }

    // Scrolling pit textures (water/lava) drift forever.
    for (const s of this.scrollTexes) {
      s.tex.offset.x = (s.tex.offset.x + s.su * dt) % 1;
      s.tex.offset.y = (s.tex.offset.y + s.sv * dt) % 1;
    }

    // Ambient weather: leaves/embers/dust drifting in a box around the player.
    if (this.ambient) {
      const pts = this.ambient.points;
      const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
      const drift = this.ambient.drift;
      const [wx, wy, wz] = this.theme.particleWind;
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;
      const R = 34;
      const RY = 18;
      for (let i = 0; i < attr.count; i++) {
        let x = attr.getX(i) + (wx + drift[i * 3]) * dt + Math.sin(this.time * 0.9 + i) * 0.5 * dt;
        let y = attr.getY(i) + (wy + drift[i * 3 + 1]) * dt;
        let z = attr.getZ(i) + (wz + drift[i * 3 + 2]) * dt;
        // wrap into the box around the player
        if (x < px - R) x += R * 2;
        else if (x > px + R) x -= R * 2;
        if (y < py - 6) y += RY + 6;
        else if (y > py + RY) y -= RY + 6;
        if (z < pz - R) z += R * 2;
        else if (z > pz + R) z -= R * 2;
        attr.setXYZ(i, x, y, z);
      }
      attr.needsUpdate = true;
    }

    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    // Floating wumpa bob in place.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.mesh.position.y =
        (p.mesh.userData.baseY as number) + Math.sin(this.time * 3 + p.mesh.position.z * 0.7) * 0.12;
      p.mesh.rotation.y += dt * 2;
    }
    // Unbroken checkpoint boxes idle-spin so they read as special.
    for (const c of this.checkpoints) {
      if (!c.active) c.mesh.rotation.y += dt * 1.2;
    }
    // Nitro crates bob menacingly.
    this.time += dt;
    for (const c of this.crates) {
      if (!c.nitro) continue;
      c.mesh.position.y =
        (c.mesh.userData.baseY as number) + Math.sin(this.time * 4 + c.mesh.position.z) * 0.12;
    }
    // Lit TNT fuses: pulse faster and faster, then blow.
    for (const c of this.crates) {
      if (!c.tnt || !c.alive || c.fuse === undefined) continue;
      c.fuse -= dt;
      const digit = Math.max(1, Math.ceil(c.fuse));
      if (c.mesh.userData.digit !== digit) {
        c.mesh.userData.digit = digit;
        (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture(String(digit));
        sfx.play(digit % 2 === 0 ? 'tntCount2' : 'tntCount', 0.7);
      }
      const urgency = 6 + (CONST.tntFuse - c.fuse) * 6;
      c.mesh.scale.setScalar(1 + Math.abs(Math.sin(this.time * urgency)) * 0.06);
      if (c.fuse <= 0) this.detonate(c);
    }

    // Expanding blasts: chain explosives, break crates, kill enemies.
    for (const ex of this.explosions) {
      ex.t += dt;
      if (ex.t <= CONST.blastGrow + 0.05) {
        const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
        for (const c of this.crates) {
          if (!c.alive || c.bouncy || c.metalBounce || c.pending) continue;
          if (c.mesh.position.distanceTo(ex.center) < r + 0.6) {
            if (c.nitro || c.tnt) this.detonate(c);
            else if (c.bang) this.triggerBang(c); // a blast can flip the switch
            else {
              this.breakCrate(c);
              this.blastBroken.push(c);
            }
          }
        }
        for (const e of this.enemies) {
          if (e.alive && e.group.position.distanceTo(ex.center) < r + 0.8) this.killEnemy(e);
        }
      }
    }
    for (let i = this.blastMeshes.length - 1; i >= 0; i--) {
      const b = this.blastMeshes[i];
      const r = Math.max(0.01, b.ex.radius * Math.min(1, b.ex.t / CONST.blastGrow));
      b.outer.scale.setScalar(r);
      b.inner.scale.setScalar(r * 0.55);
      const fade = Math.max(0, 1 - b.ex.t / 0.6);
      (b.outer.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
      (b.inner.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      if (b.ex.t > 0.6) {
        this.root.remove(b.outer);
        this.root.remove(b.inner);
        (b.outer.material as THREE.Material).dispose();
        (b.inner.material as THREE.Material).dispose();
        this.blastMeshes.splice(i, 1);
      }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].t > 0.7) this.explosions.splice(i, 1);
    }

    // Quick scale-pop for broken crates / squashed enemies.
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t -= dt;
      const s = Math.max(p.t / 0.12, 0.001);
      p.obj.scale.setScalar(s);
      if (p.t <= 0) {
        p.obj.visible = false;
        this.pops.splice(i, 1);
      }
    }
  }

  breakCrate(crate: Crate): void {
    // metal-family crates never break: the '!' switch fires instead, the
    // metal arrow crate just shrugs it off. Outline ghosts aren't there yet.
    if (crate.bang) {
      this.triggerBang(crate);
      return;
    }
    if (crate.metalBounce || crate.pending) return;
    crate.alive = false;
    this.pops.push({ obj: crate.mesh, t: 0.12 });
    sfx.play(Math.random() < 0.5 ? 'crateBreak1' : 'crateBreak2', 0.8);
    // green '!': detonates every nitro on the map (safely — classic rules)
    if (crate.nitroBang) {
      for (const c of this.crates) {
        if (c.alive && c.nitro) this.detonate(c, true);
      }
    }
  }

  // '!' SWITCH: one-shot. Materializes outline crates wired to it — those
  // sharing an editor group anywhere up its chain — then dims. A switch with
  // no group fires every ungrouped outline (and legacy imports).
  triggerBang(crate: Crate): void {
    if (!crate.alive || crate.bangUsed || crate.pending) return;
    crate.bangUsed = true;
    // spent switch: the '!' face comes OFF — it's just a plain metal box now
    const m = crate.mesh.material as THREE.MeshLambertMaterial;
    m.map = this.spentBangTexture();
    m.color.setScalar(0.8);
    m.needsUpdate = true;
    this.activateOutlines(crate.groupIds && crate.groupIds.length > 0 ? crate.groupIds : null);
    sfx.play('crateBreak1', 0.6, 1.4);
  }

  // Swap outline ghosts for the real crates. `filter` = group ids that count
  // as wired; null = only outlines with no group of their own.
  private activateOutlines(filter: number[] | null): void {
    for (const c of this.crates) {
      if (!c.pending) continue;
      const ids = c.groupIds ?? [];
      const wired = filter === null ? ids.length === 0 : ids.some((id) => filter.includes(id));
      if (wired) this.setCratePending(c, false);
    }
  }

  // Flip a crate between ghost (outline) and real — both faces are kept so
  // level resets and checkpoint restores can flip it back.
  private setCratePending(c: Crate, pending: boolean): void {
    c.pending = pending;
    if (!c.wasOutline) return;
    if (c.realMat && c.ghostMat) c.mesh.material = pending ? c.ghostMat : c.realMat;
    if (c.ghostEdges) c.ghostEdges.visible = pending;
  }

  lightFuse(c: Crate): void {
    if (c.alive && c.tnt && c.fuse === undefined) c.fuse = CONST.tntFuse;
  }

  // Blow up a nitro/TNT box: expanding blast that chains neighbors, breaks
  // normal crates, kills enemies, and (checked player-side) kills the rider.
  // safe=true (the player spun/slammed it themselves) spares the rider — but
  // anything it CHAINS detonates unsafe, so popping a stack up close is a risk.
  detonate(c: Crate, safe = false): void {
    if (!c.alive) return;
    c.alive = false;
    c.fuse = undefined;
    c.mesh.visible = false;
    const center = c.mesh.position.clone();
    const radius = c.tnt ? TUNING.tntRadius : TUNING.nitroRadius;
    const ex = { center, t: 0, radius, safe };
    this.explosions.push(ex);
    sfx.play('tntBoom', 0.9);
    const outer = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xff7a28, transparent: true, opacity: 0.55 }),
    );
    const inner = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.9 }),
    );
    outer.position.copy(center);
    inner.position.copy(center);
    outer.scale.setScalar(0.01);
    inner.scale.setScalar(0.01);
    this.root.add(outer);
    this.root.add(inner);
    this.blastMeshes.push({ outer, inner, ex });
  }

  consumeBlastBroken(): Crate[] {
    const b = this.blastBroken;
    this.blastBroken = [];
    return b;
  }

  killEnemy(enemy: Enemy, fling?: THREE.Vector3): void {
    enemy.alive = false;
    if (fling) {
      // ping away instead of popping; update() flies it into whatever lines up
      enemy.flungVel = fling.clone();
      enemy.flungT = 0;
      sfx.play('fruitSpun', 0.8); // the "spun away" zing
    } else {
      this.pops.push({ obj: enemy.group, t: 0.12 });
      sfx.play('enemyDown', 0.7);
    }
  }

  // Broken (spun/stomped) like a normal box; banks the respawn point and a
  // snapshot of exactly which crates are broken + the counter at this moment.
  activateCheckpoint(cp: Checkpoint, cratesBroken: number, fruit = 0, masks = 0, points = 0): void {
    cp.active = true;
    cp.savedAlive = this.crates.map((c) => c.alive);
    cp.savedPending = this.crates.map((c) => !!c.pending);
    cp.savedBangUsed = this.crates.map((c) => !!c.bangUsed);
    cp.savedCratesBroken = cratesBroken;
    cp.savedFruit = fruit;
    cp.savedMasks = masks;
    cp.savedPoints = points;
    this.currentSpawn.copy(cp.spawnPos);
    this.activeCheckpoint = cp;
    cp.mesh.scale.setScalar(1);
    this.pops.push({ obj: cp.mesh, t: 0.12 }); // break it like a crate
    sfx.play('lifeGet', 0.8);
  }

  private restoreTntFace(c: Crate): void {
    if (c.tnt && c.mesh.userData.digit !== undefined) {
      c.mesh.userData.digit = undefined;
      (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture('TNT');
    }
  }

  // Soft reset (death): restore the crate world to the last checkpoint's
  // snapshot — boxes broken before it stay broken, boxes broken after it come
  // back; banked checkpoints stay consumed. Hard reset (R / new run) revives
  // everything and relights every checkpoint box.
  reset(hard: boolean): void {
    // Hard reset re-seats the crystal and clears the materialized gem; a soft
    // (death) respawn keeps them — Crash rules, once it's yours it's yours.
    if (hard) {
      if (this.crystalPickup) {
        this.crystalPickup.collected = false;
        this.crystalPickup.group.visible = true;
      }
      // the trial stopwatch reappears — a fresh run can opt in again
      if (this.clockPickup && !this.timeTrial) {
        this.clockPickup.collected = false;
        this.clockPickup.group.visible = true;
      }
      // ...and so does the combo orb
      if (this.comboOrb && !this.comboRun) {
        this.comboOrb.collected = false;
        this.comboOrb.group.visible = true;
      }
      if (this.gemG) {
        this.root.remove(this.gemG);
        this.gemG = null;
      }
      this.relics = { crystal: true, gem: true };
      this.setRelics(false, false);
    }
    this.pops.length = 0;
    this.explosions.length = 0;
    this.blastBroken.length = 0;
    for (const b of this.blastMeshes) {
      this.root.remove(b.outer);
      this.root.remove(b.inner);
      (b.outer.material as THREE.Material).dispose();
      (b.inner.material as THREE.Material).dispose();
    }
    this.blastMeshes.length = 0;

    if (!hard && this.activeCheckpoint) {
      const cpSnap = this.activeCheckpoint;
      this.crates.forEach((c, i) => {
        c.alive = cpSnap.savedAlive[i];
        c.mesh.visible = cpSnap.savedAlive[i];
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
        this.setCratePending(c, cpSnap.savedPending?.[i] ?? !!c.pending);
        c.bangUsed = cpSnap.savedBangUsed?.[i] ?? c.bangUsed;
        if (c.bang) {
          const m = c.mesh.material as THREE.MeshLambertMaterial;
          m.map = c.bangUsed ? this.spentBangTexture() : this.bangTexture();
          m.color.setScalar(c.bangUsed ? 0.8 : 1);
          m.needsUpdate = true;
        }
      });
    } else {
      for (const c of this.crates) {
        c.alive = true;
        c.mesh.visible = true;
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
        // outlines return to ghosts, switches re-arm
        this.setCratePending(c, !!c.wasOutline);
        c.bangUsed = false;
        if (c.bang) {
          const m = c.mesh.material as THREE.MeshLambertMaterial;
          m.map = this.bangTexture();
          m.color.setScalar(1);
          m.needsUpdate = true;
        }
      }
    }

    for (const e of this.enemies) {
      e.alive = e.arenaWave === undefined; // arena waves wait to be called
      e.group.visible = e.alive;
      e.flungT = undefined;
      e.flungVel = undefined;
      if (e.axis === 'z') e.group.position.z = (e.x0 + e.x1) / 2;
      else e.group.position.x = (e.x0 + e.x1) / 2;
      this.resetEnemyVisual(e); // pose + FSM back to start (handles y/rotation/scale)
      e.box.makeEmpty();
    }
    this.clearProjectiles();

    for (const st of this.stones) {
      st.mesh.position.set(st.x, st.mesh.position.y, (st.z0 + st.z1) / 2);
      st.dir = 1;
    }

    // Floating wumpa always comes back (the fruit counter reverts with the
    // checkpoint snapshot, so it stays collectable).
    for (const p of this.pickups) {
      p.alive = true;
      p.mesh.visible = true;
    }

    for (const cp of this.checkpoints) {
      cp.mesh.scale.setScalar(1);
      if (hard) {
        cp.active = false;
        cp.mesh.visible = true;
      } else {
        cp.mesh.visible = !cp.active; // consumed checkpoints stay broken
      }
    }

    if (hard) {
      this.activeCheckpoint = null;
      this.currentSpawn.copy(this.spawnPos);
    }

    // Crumble pads grow back whole; the collapse wave re-arms.
    for (const c of this.crumbles) {
      c.state = 'idle';
      c.t = 0;
      c.mesh.visible = true;
      c.mesh.position.copy(c.base);
      c.mesh.rotation.set(0, c.yaw, 0);
    }
    // Sky-bridge ropes restring taut.
    for (const r of this.ropes) {
      r.state = 'idle';
      r.t = 0;
      r.active = false;
      for (let i = 0; i < r.rest.length; i++) r.rail.points[i].copy(r.rest[i]);
      for (const s of r.segs) s.visible = true;
      this.syncRope(r);
    }
    if (this.collapse) {
      this.collapse.active = false;
      this.collapse.frontZ = this.collapse.startZ;
    }

    // Arena: unlock, sink the gates, waves back on standby.
    if (this.arena) {
      const ar = this.arena;
      ar.state = 'idle';
      ar.wave = 0;
      ar.waveT = 0;
      ar.cycleT = 0;
      ar.up = false;
      for (const g of ar.gates) {
        const i = this.walls.indexOf(g.box);
        if (i >= 0) this.walls.splice(i, 1);
        g.mesh.position.y = g.downY;
      }
    }

    // Boulder: back to its mark a fair headstart behind wherever you respawn,
    // waiting for you to move before it rolls again.
    if (this.boulder) {
      const b = this.boulder;
      b.active = false;
      b.falling = false;
      b.fallV = 0;
      b.triggerZ = this.currentSpawn.z + 5;
      const bz = this.currentSpawn.z - 39;
      b.st.mesh.position.set(0, this.boulderGroundY(bz) + b.st.r * 0.92, bz);
      b.st.mesh.rotation.set(0, 0, 0);
      b.st.mesh.visible = true;
      b.st.box.makeEmpty();
    }
  }

  // ---------------------------------------------------------------- build --

  private buildTestCourse(asPrefix = false): void {
    // Sentinel-Beach morning: saturated jungle greens, sandstone banks, warm
    // gold sand. Textures are near-white, so these tints carry the look.
    // asPrefix: this course flows straight into another (the combined
    // Test+Gauntlet level), so skip the finish gate + end wall at the far end.
    const matA = new THREE.MeshLambertMaterial({ color: 0x5da84e });
    const matB = new THREE.MeshLambertMaterial({ color: 0x4c9a44 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0xd0a86e });
    const matBeach = new THREE.MeshLambertMaterial({ color: 0xf0d092 });
    const matPlaza = new THREE.MeshLambertMaterial({ color: 0xb0a08a }); // rail-yard stonework
    const matFinish = new THREE.MeshLambertMaterial({ color: 0xd0b070 });

    // --- decks (N. Sanity flow: beach -> funnel -> corridors -> finish) ---
    this.slab('beach', 14, -40, 0, 20, matBeach, false, 0, 'sand');

    // --- practice pen: walled rail playground east of the beach ---
    const penMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 54),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x7cb45a }), 30, 54, 'grass'),
    );
    penMesh.position.set(25, -0.5, -13);
    penMesh.name = 'practice pen';
    this.root.add(penMesh);
    this.groundMeshes.push(penMesh);
    // Perimeter walls (also backstop the beach so you can't fall off the start).
    this.wall(15, 15, 52, 1, 0, 5, 0.7); // north, behind spawn: curb-high so the camera sees out
    this.wall(-10.5, -13, 1, 54, 0); // west edge of the beach
    this.wall(40.5, -13, 1, 54, 0); // east edge of the pen
    this.wall(25, -40.5, 30, 1, 0); // south edge of the pen
    this.ramp('funnel slope', -40, 0, -80, -5, 14, matRamp);
    this.jungle('corridor A', -80, -153, -5, 12, matA, { dips: [-112] });
    // gap 1: -153 .. -162 (rebalanced for the slower feel)
    // rope swing over the gap, just off the main line: jump at it, climb,
    // ride the arc across (or keep taking the gap straight — your call)
    this.ropeSwing(4, 3.5, -157.5, 6.5, 0.85, 0, 0, 90);
    this.jungle('corridor B', -162, -235, -5.5, 12, matB, { dips: [-222] });
    this.ramp('big slope', -235, -5.5, -275, -13, 12, matRamp);
    // gap 2: -275 .. -288 (carry speed)
    this.jungle('corridor C', -288, -350, -13, 12, matA);
    // rail 1 pit: -350 .. -410
    this.jungle('rail 1 landing', -410, -465, -13, 12, matB, { dips: [-445] });
    this.ramp('kicker', -465, -13, -475, -10.2, 12, matRamp);
    // gap 3: -475 .. -488 (kicker lip + drop to the landing)
    this.jungle('corridor D', -488, -575, -13, 12, matA);
    this.crystal(0, -12.4, -530); // the level crystal, dead on the main route
    // rail 2 pit: -575 .. -655
    this.jungle('rail 2 landing', -655, -710, -13.5, 12, matB);
    // Halfpipe: a dedicated SMOOTH transition ridden by the pipe rail-physics
    // (see player.stepPipe). Carve up either wall, pump on the way up to build
    // height, pop off the coping for hang-time air, drop back in. The flat
    // bottom is a normal ground slab; the walls are the analytic Halfpipe.
    this.slab('halfpipe floor', -710, -830, -13.5, 6, matRamp, false, 0, 'pavement');
    const hp = new Halfpipe(-710, -830, -13.5, 3, 7, matRamp); // F=3, R=7 → lip x±10, y-6.5 (twice as long)
    this.halfpipes.push(hp);
    this.root.add(hp.object);
    for (const w of hp.walls) this.groundMeshes.push(w); // SOLID walls (no more clip-through-and-die)
    // rail yard entry deck, then a pit crossed by three parallel rails
    this.slab('rail yard entry', -830, -838, -13.5, 14, matPlaza, true, 0, 'stone');
    // pit: -838 .. -910
    this.slab('rail yard landing', -910, -945, -13.5, 14, matPlaza, true, 0, 'stone');
    this.berms(-910, -945, -13.5, 14);
    this.ramp('final downhill', -945, -13.5, -1000, -22, 12, matRamp);
    // gap 4: -1000 .. -1013 (fast, downhill speed carries you)
    this.jungle('finish run', -1013, -1085, -22, 12, matFinish);

    // --- death pit floor (visual only, below killY) ---
    this.pitPlane('lava', -60, 0, -420);

    // --- grind rails ---
    const rail1 = new Rail([
      new THREE.Vector3(0, -12, -346),
      new THREE.Vector3(0, -11, -380),
      new THREE.Vector3(0, -11.8, -414),
    ]);
    // S-curve rail: the balance test.
    const rail2 = new Rail([
      new THREE.Vector3(0, -11.8, -571),
      new THREE.Vector3(2.5, -11, -595),
      new THREE.Vector3(-2.5, -10.5, -620),
      new THREE.Vector3(0, -11.5, -659),
    ]);
    // Halfpipe lip rails along both top edges (full doubled length).
    const lipL = new Rail([new THREE.Vector3(-10.1, -6.4, -710), new THREE.Vector3(-10.1, -6.4, -830)]);
    const lipR = new Rail([new THREE.Vector3(10.1, -6.4, -710), new THREE.Vector3(10.1, -6.4, -830)]);
    // Rail yard: three parallel rails over the pit — jump between them.
    const yardL = new Rail([new THREE.Vector3(-3.5, -12.6, -836), new THREE.Vector3(-3.5, -12.6, -912)]);
    const yardC = new Rail([new THREE.Vector3(0, -12.6, -836), new THREE.Vector3(0, -12.6, -912)]);
    const yardR = new Rail([new THREE.Vector3(3.5, -12.6, -836), new THREE.Vector3(3.5, -12.6, -912)]);
    // Practice pen rails: straight, zigzag, and a high line.
    const penStraight = new Rail([new THREE.Vector3(18, 1, -2), new THREE.Vector3(18, 1, -32)]);
    const penZigzag = new Rail([
      new THREE.Vector3(26, 1.2, 2),
      new THREE.Vector3(30, 1.6, -10),
      new THREE.Vector3(24, 1.4, -22),
      new THREE.Vector3(28, 1.2, -34),
    ]);
    const penHigh = new Rail([new THREE.Vector3(35, 2.8, -4), new THREE.Vector3(35, 2.8, -30)]);

    for (const rail of [rail1, rail2, lipL, lipR, yardL, yardC, yardR, penStraight, penZigzag, penHigh]) {
      this.rails.push(rail);
      this.root.add(rail.object);
    }

    // --- crates ---
    // Beach: one dead-ahead (bump = full stop now: spin it or hop on it).
    this.crate(0, 0, -25);
    this.crate(-3, -5, -95, 'mask');
    this.crate(2.5, -13.5, -932, 'mask');
    this.crate(5, 0, -32);
    this.crate(6.5, 0, -32);
    // Corridor A: full-width wall — spin through, or jump on top to bounce.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -5, -100);
    this.crate(-4.5, -5, -132);
    this.crate(-4.5, -3.8, -132); // stack
    this.crate(4.5, -5, -145);
    this.crate(4.5, -3.8, -145); // stack
    // Corridor B: a 4-story step string on the right with crate rewards.
    this.stepBlock(4, -192, 4, 6, -5.5, -3.3);
    this.crate(4, -3.3, -192);
    this.stepBlock(4, -199, 4, 6, -5.5, -1.1);
    this.crate(4, -1.1, -199);
    this.stepBlock(4, -206, 4, 6, -3, 1.1);
    this.crate(4, 1.1, -206);
    this.stepBlock(4, -213, 4, 6, -1, 3.3);
    this.crate(4, 3.3, -213);
    // Corridor B: risky edge lines between the enemies.
    this.crate(5, -5.5, -205);
    this.crate(5, -5.5, -208);
    this.crate(-5, -5.5, -222);
    this.crate(-5, -5.5, -195, 'mask');
    // Corridor C: center cluster + risky pair before the first rail.
    this.crate(-1.5, -13, -315);
    this.crate(0, -13, -315);
    this.crate(1.5, -13, -315);
    this.crate(0, -11.8, -315); // stack
    this.crate(5.2, -13, -330);
    this.crate(5.2, -13, -333);
    this.crate(-5, -13, -322, 'mask');
    // Rail 1 entry flanks.
    this.crate(-2.4, -13, -342);
    this.crate(2.4, -13, -342);
    // Corridor D: second full-width wall + edge stacks.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -13, -520);
    this.crate(-4.8, -13, -565);
    this.crate(-4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -565);
    this.crate(4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -545, 'mask');
    // Rail 2 entry flanks.
    this.crate(-2.4, -13, -567);
    this.crate(2.4, -13, -567);
    // Practice pen toys — including a mask row for testing triple-mask mode.
    this.crate(22, 0, -6, 'mask');
    this.crate(25, 0, -6, 'mask');
    this.crate(28, 0, -6, 'mask');
    this.crate(14, 0, -20);
    this.crate(31, 0, -28);
    this.crate(37, 0, -12, 'bouncy');
    this.towerClimb(-8, 0, 4, 34); // staggered tower: four stories, crates up top
    this.stairClimb(10, 0, 7, 13, 7); // flush guarded stair: seven stories, hard to fall off
    // Motion-toolkit sandbox: ride the mover, hop the crumble pads, time the
    // crusher, duck the pendulum guarding the beach-pen doorway.
    this.mover(20, 1.2, -36, 3.2, 3.2, 'x', 3.2, 0.9);
    this.crumblePad(26, 1.2, -30, 3, 3);
    this.crumblePad(26, 1.2, -26, 3, 3);
    this.crusher(24, 0, 8, 4.5, 3, 3.4, 0);
    this.pendulum(14, 7, 8, 5.2, 1.0, 1.7);
    // Halfpipe is kept clear — no crates or obstacles in the transition, so the
    // carve/pump/air line is pure. (Pickups live on the approach and the exit.)
    // Rail yard: crates and nitro at grind height above the rails.
    // Center rail: two smashables, then a nitro you must jump, then a snack.
    this.crate(0, -12.8, -850);
    this.crate(0, -12.8, -860);
    this.crate(0, -12.8, -875, 'nitro');
    this.crate(0, -12.8, -895);
    // Left rail: nitro early, then safe smashables.
    this.crate(-3.5, -12.8, -855, 'nitro');
    this.crate(-3.5, -12.8, -880);
    this.crate(-3.5, -12.8, -888);
    // Right rail: smashable, nitro, smashable.
    this.crate(3.5, -12.8, -848);
    this.crate(3.5, -12.8, -882, 'nitro');
    this.crate(3.5, -12.8, -900);
    // Corridor D: a big mixed explosive block off the left lane — spin the
    // TNT to pop it (your own pop is safe, the chained nitro blast is NOT).
    this.crate(-2.6, -13, -530, 'tnt');
    this.crate(-2.6, -11.8, -530, 'nitro');
    this.crate(-1.3, -13, -530, 'tnt');
    this.crate(-3.9, -13, -530);
    // Rail yard landing: a bouncy crate off the racing line, and a 2x2 nitro
    // block guarding the left side.
    this.crate(2.5, -13.5, -928, 'bouncy');
    this.crate(-3, -13.5, -926, 'nitro');
    this.crate(-4.3, -13.5, -926, 'nitro');
    this.crate(-3, -12.3, -926, 'nitro');
    this.crate(-4.3, -12.3, -926, 'nitro');
    // Final downhill: offset dodge crates (thread between them at speed).
    this.crate(-2.2, this.downhillY(-965), -965);
    this.crate(2.2, this.downhillY(-985), -985);

    // --- jungle furniture: fallen logs (hop them) + rolling stones ---
    this.log(-6, 1.2, -5, -145); // corridor A, cleared by the gap-1 flight
    this.log(2.0, 5.8, -5.5, -228); // corridor B, right half
    this.log(-5.8, -2.0, -13, -430); // rail 1 landing, left half
    this.log(2.0, 5.8, -13, -560); // corridor D, right half
    this.stone(32, 0, -6, -34, 7); // practice pen patroller
    this.stone(4, -5.5, -200, -230, 6); // corridor B, off the racing line

    // --- ? crates ---
    this.crate(24, 0, -18, 'mystery');
    this.crate(4, -5, -118, 'mystery');
    this.crate(-4, -13, -345, 'mystery');
    this.crate(-3, -13, -558, 'mystery');
    this.crate(5, -13.5, -934, 'mystery');

    // --- enemies (a teaching order of the foe roster) ---
    this.enemy(-3.5, 3.5, -5, -120, 5, 'x', 'grunt'); // meet the baseline first
    this.enemy(-4, 4, -5, -138, 7, 'x', 'spiker'); // SPIN this one — don't land on it
    this.enemy(-4, 4, -5.5, -200, 6, 'x', 'turtle'); // STOMP this one — a spin bounces off
    this.enemy(-3, 3, -5.5, -228, 5, 'x', 'hopper'); // time the leaps
    this.enemy(0, 0, -252, 4, 0, 'x', 'sentry'); // turret watching the choke
    this.enemy(-4.5, 4.5, -13, -340, 9, 'x', 'charger'); // long straight = a bull's runway
    this.enemy(-4, 4, -13, -445, 7, 'x', 'grunt');
    this.enemy(-4.5, 4.5, -13, -540, 8, 'x', 'floater'); // spin it out of the air
    this.enemy(0, 0, -556, 5, 0, 'x', 'spinner'); // blades gate the corridor
    this.enemy(-4, 4, -13, -562, 6, 'x', 'grunt');
    // (no enemy at the halfpipe mouth — the run into the pipe stays clean)

    // --- checkpoints ---
    this.checkpoint(-5.5, -185);
    this.checkpoint(-13, -425);
    this.checkpoint(-13.5, -670);
    this.checkpoint(-13.5, -922);

    // --- extra enemy guarding the rail yard landing ---
    this.enemy(-4, 4, -13.5, -936, 6, 'x', 'turtle');

    // --- dressing: tropical fringe off the play space (visual only) ---
    // west beach edge + spawn surrounds
    this.palm(-13, 0, -4, 5.6, 0.14);
    this.palm(-15, 0, -19, 4.6, -0.09);
    this.palm(-12.6, 0, -33, 5.9, 0.1);
    this.palm(-14, 0, 9, 4.3, 0.05);
    this.fern(-8.6, 0, 5, 1.2);
    this.fern(-8.9, 0, -13);
    this.broadleaf(-8.3, 0, -34, 1.2);
    this.flowers(-7.6, 0, 12);
    this.flowers(-8.2, 0, -20);
    this.rock(-8.6, 0, 13, 1.4);
    // east of the practice pen
    this.palm(43.5, 0, -2, 5.4, -0.12);
    this.palm(45, 0, -21, 4.6, 0.08);
    this.palm(43.2, 0, -37, 5.7, -0.06);
    this.fern(38.9, 0, 3, 1.1);
    this.flowers(39.4, 0, -37);
    // halfpipe surrounds (lips at x ±10.3 — everything sits outside them); the
    // pipe is now twice as long (z −710..−830), so the fringe spans further.
    this.palm(13.6, -13.5, -716, 5.4, -0.1);
    this.palm(14.6, -13.5, -748, 4.7, 0.12);
    this.palm(13.4, -13.5, -782, 5.8, -0.07);
    this.palm(14.2, -13.5, -816, 5.1, 0.09);
    this.palm(-13.8, -13.5, -722, 5.2, 0.1);
    this.palm(-14.6, -13.5, -756, 4.5, -0.1);
    this.palm(-13.4, -13.5, -790, 5.6, 0.06);
    this.palm(-14.0, -13.5, -824, 5.0, -0.08);
    this.fern(-12.2, -13.5, -735, 1.3);
    this.fern(12.4, -13.5, -800, 1.2);
    this.rock(12.8, -13.5, -710, 1.6);
    this.rock(-12.6, -13.5, -828, 1.9);
    this.flowers(-12.4, -13.5, -770);
    // rail-yard landing fringe
    this.palm(9.4, -13.5, -918, 4.9, -0.1);
    this.palm(-9.6, -13.5, -936, 5.3, 0.1);
    this.fern(-8.9, -13.5, -916, 1.2);
    // finish deck, behind the gate
    this.palm(4.6, -22, -1074, 4.8, -0.12);
    this.palm(-4.6, -22, -1077, 5.2, 0.1);
    this.broadleaf(7.4, -22, -1068, 1.3);
    this.broadleaf(-7.6, -22, -1070, 1.1);
    this.flowers(6.8, -22, -1073);

    // --- finish gate + end wall ---
    if (!asPrefix) {
      this.finishGate(-22, this.finishZ);
      this.endWall(-22);
    }
  }

  // Combined "Test Course": the whole test course flows straight into the
  // whole Gauntlet, the gauntlet shifted down-course so the two never overlap
  // (no crates clipping each other or the wall obstacles at the seam).
  private buildTestGauntlet(): void {
    this.buildTestCourse(true); // prefix mode: no finish gate, flows onward
    const savedSpawn = this.spawnPos.clone();
    const savedTheme = this.theme;
    const preArena = this.arena;
    const preCollapse = this.collapse;
    const preCrystal = this.crystalPickup;
    const snap = {
      root: this.root.children.length,
      crates: this.crates.length,
      enemies: this.enemies.length,
      stones: this.stones.length,
      checkpoints: this.checkpoints.length,
      pickups: this.pickups.length,
      rails: this.rails.length,
      walls: this.walls.length,
      movers: this.movers.length,
      crumbles: this.crumbles.length,
      crushers: this.crushers.length,
      zones: this.zones.length,
    };
    this.buildGauntlet(true); // continuation: no behind-spawn wall at the seam
    // The test course's finish-run corridor ends at z≈−1025, y=−22. Drop the
    // gauntlet in so its start slab OVERLAPS that corridor end at the same
    // height (its +Z edge lands at z≈−1021), so you skate straight across.
    const DZ = -1095; // test course is 60u longer now (doubled halfpipe) — seam the gauntlet on after it
    const DY = -22;
    this.shiftBuilt(snap, 0, DY, DZ, preArena, preCollapse, preCrystal);
    this.finishZ += DZ; // gauntlet −1200 → −2240 becomes the combined finish
    this.endWallZ += DZ; // −1212 → −2252
    this.killY = -48; // below every floor in either half
    this.spawnPos.copy(savedSpawn); // keep the beach spawn
    this.currentSpawn.copy(savedSpawn);
    this.theme = savedTheme; // and the Test Course beach look throughout
  }

  // Translate everything created since `snap` by (dx,dy,dz). Visual meshes and
  // the groundMeshes that reference them all live in root, so one pass moves
  // the geometry plus each object's bob/ground-snap baseY; the rest is the
  // logic/collision state that isn't re-derived from a mesh each frame (static
  // boxes, patrol/roll ranges, rail points, zones, and the set-pieces).
  private shiftBuilt(
    snap: {
      root: number; crates: number; enemies: number; stones: number; checkpoints: number;
      pickups: number; rails: number; walls: number; movers: number; crumbles: number;
      crushers: number; zones: number;
    },
    dx: number,
    dy: number,
    dz: number,
    preArena: Level['arena'],
    preCollapse: Level['collapse'],
    preCrystal: Level['crystalPickup'],
  ): void {
    const off = new THREE.Vector3(dx, dy, dz);
    const kids = this.root.children;
    for (let i = snap.root; i < kids.length; i++) {
      kids[i].position.add(off);
      const b = kids[i].userData.baseY;
      if (typeof b === 'number') kids[i].userData.baseY = b + dy;
    }
    for (let i = snap.crates; i < this.crates.length; i++) this.crates[i].box.translate(off);
    for (let i = snap.walls; i < this.walls.length; i++) this.walls[i].translate(off);
    for (let i = snap.rails; i < this.rails.length; i++)
      for (const p of this.rails[i].points) p.add(off);
    for (let i = snap.enemies; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      // box rebuilds each update from the (shifted) group; only side-scroll
      // patrols store world-Z bounds that must move with it.
      if (e.axis === 'z') { e.x0 += dz; e.x1 += dz; }
    }
    for (let i = snap.stones; i < this.stones.length; i++) {
      const s = this.stones[i];
      s.x += dx; s.z0 += dz; s.z1 += dz;
    }
    for (let i = snap.checkpoints; i < this.checkpoints.length; i++) {
      this.checkpoints[i].box.translate(off);
      this.checkpoints[i].spawnPos.add(off);
    }
    for (let i = snap.pickups; i < this.pickups.length; i++) this.pickups[i].box.translate(off);
    for (let i = snap.movers; i < this.movers.length; i++) this.movers[i].base.add(off);
    for (let i = snap.crumbles; i < this.crumbles.length; i++) this.crumbles[i].base.add(off);
    for (let i = snap.crushers; i < this.crushers.length; i++) {
      const c = this.crushers[i];
      c.x += dx; c.z += dz; c.restY += dy;
      c.box.translate(off);
    }
    // pendulum boxes re-derive from their (shifted) pivot group each update.
    for (let i = snap.zones; i < this.zones.length; i++) {
      const z = this.zones[i];
      z.xMin += dx; z.xMax += dx; z.zMin += dz; z.zMax += dz;
    }
    if (this.arena && this.arena !== preArena) {
      this.arena.zone.translate(off);
      for (const g of this.arena.gates) {
        g.box.translate(off);
        g.upY += dy;
        g.downY += dy;
      }
    }
    if (this.collapse && this.collapse !== preCollapse) {
      const c = this.collapse;
      c.xMin += dx; c.xMax += dx;
      c.triggerZ += dz; c.endZ += dz; c.startZ += dz; c.frontZ += dz;
    }
    if (this.crystalPickup && this.crystalPickup !== preCrystal)
      this.crystalPickup.box.translate(off);
    this.finishBox.translate(off);
  }

  // Deck height along the final downhill ramp (for crate placement).
  private downhillY(z: number): number {
    return THREE.MathUtils.mapLinear(z, -945, -1000, -13.5, -22);
  }

  // The "Sideways" level is an L-shaped course now: a corridor intro heading
  // down -Z, a right-angle turn onto a stretch that runs along +X — which the
  // fixed camera therefore sees side-on (real side-scroll platforming, no
  // camera move) — then a second corner back onto -Z for the finish.
  private buildSideways(): void {
    // Coral dusk: vaporwave warmed toward the tropics — lavender concrete,
    // lush turf, hot-pink platforms under a coral horizon band.
    this.wallTint = 0x7a5a9a;
    this.blockTint = 0x8a6aa8;
    this.curbTint = 0xff79c8;
    const matA = new THREE.MeshLambertMaterial({ color: 0xa898c8 });
    const matGround = new THREE.MeshLambertMaterial({ color: 0x62a878 });
    const matPlat = new THREE.MeshLambertMaterial({ color: 0xc87ab0 });
    const matStone = new THREE.MeshLambertMaterial({ color: 0x8a7ab8 });

    this.killY = -20;
    this.finishZ = -104;
    this.endWallZ = -116;
    this.theme = {
      skyTop: '#2a1650',
      skyBottom: '#ff8a70',
      sunColorHex: '#ffc0a0',
      sunU: 0.35,
      sunV: 0.3,
      stars: true, // first stars over a coral horizon
      fog: 0x9a5464, // rose haze to match the coral band
      fogNear: 20,
      fogFar: 120,
      hemiSky: 0xd8a8c0,
      hemiGround: 0x3a2840,
      hemiI: 1.05,
      sunColor: 0xffa888,
      sunI: 1.2,
      particleColor: 0xffc8a8,
      particleWind: [0.8, -0.3, 0.3],
    };

    // the turned stretch: path runs +X between the two corner decks
    this.zones = [{ xMin: 9, xMax: 146, zMin: -62, zMax: -38, dir: 'E' }];

    // cliff backdrop behind the sideways stretch, and the pit below it —
    // a giant stone-block silhouette going violet into the dusk
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(200, 60, 1.5),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x3a2a5c }), 200, 60, 'stone'),
    );
    cliff.position.set(88, 8, -64);
    this.root.add(cliff);
    this.pitPlane('void', -24, 80, -60, 900);

    // corridor intro heading down -Z
    this.slab('start', 16, -12, 0, 10, matA, false);
    this.wall(0, 17, 12, 1, 0, 5, 0.7); // behind spawn: low curb, full-height collider
    this.crate(0, 0, -3, 'mask');
    this.fruitRow(-16, -22, 1.3, 4);
    this.slab('approach', -12, -38, 0, 10, matGround, true, 0, 'grass');
    this.crate(0, 0, -24);
    this.crate(0, 1.2, -24); // stack: spin, bounce, or headbutt
    this.enemy(-3, 3, 0, -31, 4, 'x', 'hopper');

    // CORNER 1: the path right-angles east; a wall dead ahead sells the turn
    this.slab('corner', -38, -56, 0, 18, matA, false, 4);
    this.wall(4, -57.5, 18, 1.5, 0);
    this.rock(11.5, 0, -54, 1.8); // tucked corner dressing, off the racing line
    this.rock(-3.8, 0, -55, 1.2);
    this.crystal(70, 0.4, -47); // mid east-stretch, on the main line

    // the sideways stretch: everything below runs along +X at the z band -47
    const CZ = -47;
    this.slabX('ruin walk', 13, 34, 0, 9, matGround, CZ, 'grass');
    this.crate(24, 0, CZ);
    this.crate(24, 1.2, CZ);
    this.crate(24, 2.4, CZ, 'mask'); // crown the stack
    this.fruitRowX(15, 21, 1.3, 4, CZ);
    // ascending floating platforms over the pit
    this.slabX('plat A', 40, 50, 1.5, 9, matPlat, CZ);
    this.crate(45, 1.5, CZ, 'tnt');
    this.slabX('plat B', 56, 66, 3, 9, matPlat, CZ);
    this.crate(58, 3, CZ, 'mystery');
    this.checkpoint(3, CZ, 61);
    // big pit: grind the rail across (fruit lines it), or hop the pads
    const pitRail = new Rail([new THREE.Vector3(66, 3.9, CZ), new THREE.Vector3(90, 3.3, CZ)]);
    this.rails.push(pitRail);
    this.root.add(pitRail.object);
    this.fruitRowX(70, 86, 5.2, 5, CZ);
    this.slabX('pit pad', 74, 80, 3, 9, matPlat, CZ);
    // landing shelf: nitro squats the lane, crab patrols the screen
    this.slabX('mid shelf', 90, 108, 3.2, 9, matGround, CZ, 'grass');
    this.crate(98, 3.2, CZ, 'nitro');
    this.enemy(94, 106, 3.2, CZ, 5, 'x', 'spiker');
    // split: bounce the arrow crate up to the high ledge, or run the TNT road
    this.crate(107, 3.2, CZ, 'bouncy');
    this.slabX('high ledge', 110, 128, 8.4, 9, matPlat, CZ);
    this.crate(118, 8.4, CZ, 'mask');
    this.fruitRowX(112, 126, 9.7, 6, CZ);
    this.slabX('low road', 110, 132, 2.8, 9, matStone, CZ, 'stone');
    this.crate(117, 2.8, CZ, 'tnt');
    this.crate(124, 2.8, CZ, 'tnt');
    // rejoin before the second corner
    this.slabX('rejoin', 136, 146, 3.6, 9, matGround, CZ, 'grass');
    this.checkpoint(3.6, CZ, 141);

    // CORNER 2: the path turns back south toward the gate
    this.slab('corner 2', -38, -56, 3.6, 18, matA, false, 152);
    this.wall(161.5, -47, 1.5, 18, 3.6);
    this.rock(158.5, 3.6, -54.5, 1.6);
    this.wall(152, -37, 18, 1.5, 3.6); // north lip of the corner

    // corridor finish at the far end of the L
    this.slab('descent', -56, -70, 3.6, 10, matPlat, true, 152);
    this.slab('step down', -74, -84, 1.6, 10, matPlat, true, 152);
    this.slab('final run', -88, -120, 0, 12, matStone, true, 152, 'stone');
    this.crate(149, 0, -91, 'mask');
    this.crate(152, 0, -94);
    this.crate(152, 1.2, -94);
    this.crate(152, 2.4, -94); // tower: spin through or bounce up
    this.enemy(148, 156, 0, -99, 5, 'x', 'charger');
    this.fruitRow(-90, -96, 1.4, 4, 149);
    this.finishGate(0, this.finishZ, 152);
    this.endWall(0, 152);

    // --- dressing: hanging gardens off the floating decks (visual only) ---
    const VZ = CZ + 4.4; // south lip of the sideways decks, facing the camera
    this.vine(16, -0.05, VZ, 2.4);
    this.vine(30, -0.05, VZ, 3.0);
    this.vine(43, 1.45, VZ, 2.2);
    this.vine(60, 2.95, VZ, 2.6);
    this.vine(77, 2.95, VZ, 2.0);
    this.vine(94, 3.15, VZ, 3.2);
    this.vine(104, 3.15, VZ, 2.4);
    this.vine(114, 8.35, VZ, 3.4);
    this.vine(124, 8.35, VZ, 2.8);
    this.vine(128, 2.75, VZ, 2.2);
    this.vine(140, 3.55, VZ, 2.6);
    // corner decks: planters + blooms tucked against the turn walls
    this.planter(0.5, 0, -54.6);
    this.planter(8.5, 0, -55);
    this.flowers(4.5, 0, -54.8);
    this.fern(-3.6, 0, -54.9, 1.1);
    this.planter(147.5, 3.6, -54.6);
    this.planter(158, 3.6, -52.5);
    this.flowers(154, 3.6, -54.6);
    // finish stretch: dusk palms behind the gate
    this.palm(147.6, 0, -110, 4.9, 0.1);
    this.palm(156.4, 0, -112, 5.3, -0.1);
  }

  // Build-time ground probe: what the terrain actually is at (x, z). Used to
  // seat crates/enemies/checkpoints on wavy floors. Falls back to the given y.
  private floorY(x: number, z: number, fallback: number): number {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, fallback + 6, z), new THREE.Vector3(0, -1, 0), 0, 14);
    const hits = ray.intersectObjects(this.groundMeshes, false);
    if (hits.length === 0) return fallback;
    return Math.abs(hits[0].point.y - fallback) <= 1.1 ? hits[0].point.y : fallback;
  }

  // Ground a captured crate should rest on. Capture flattens wavy jungle
  // floors to a box at their PEAK, so a crate recorded at its lower wavy rest
  // height must rise to sit on the flat top instead of sinking through it.
  // floorY can't: its ±1.1 snap band gives up once the flat top is more than
  // ~1 above the recorded base, and the crate stays buried. This returns the
  // LOWEST ground within a band around the recorded base — raised up to ~4 for
  // deep dips — so overhangs far above and any deliberate float below are
  // ignored. Null when nothing sensible sits beneath/around it (keep base).
  private crateRestSurface(x: number, z: number, deckY: number): number | null {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, deckY + 8, z), new THREE.Vector3(0, -1, 0), 0, 400);
    const hits = ray.intersectObjects(this.groundMeshes, false);
    let best: number | null = null;
    for (const h of hits) {
      const y = h.point.y;
      if (y >= deckY - 0.6 && y <= deckY + 4 && (best === null || y < best)) best = y;
    }
    return best;
  }

  // Wavy jungle floor strip: a heightfield with rolling bumps, optional
  // non-lethal dips to hop, and firm berm walls (with grindable lips) along
  // both sides so you can't fall off sideways. Deterministic per strip.
  private jungle(
    name: string,
    z0: number,
    z1: number,
    baseY: number,
    width: number,
    mat: THREE.Material,
    opts: { amp?: number; dips?: number[]; berms?: boolean; tex?: string } = {},
    cx = 0,
  ): void {
    const depth = Math.abs(z1 - z0);
    const cz = (z0 + z1) / 2;
    const amp = opts.amp ?? 0.35;
    const segZ = Math.max(8, Math.round(depth / 3));
    const segX = 4;
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const phase = (Math.abs(z0) * 0.37) % (Math.PI * 2); // deterministic
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i);
      const lz = pos.getZ(i);
      const wz = cz + lz;
      // fade the wave to zero near both strip ends: flush joins, clean jumps
      const edge = Math.min(1, (depth / 2 - Math.abs(lz)) / 5);
      let h =
        amp *
        edge *
        (Math.sin(wz * 0.55 + phase) * 0.55 +
          Math.sin(wz * 0.21 + lx * 0.45 + phase * 1.7) * 0.45 +
          Math.sin(lx * 0.9 + wz * 0.13 + phase * 0.6) * 0.3);
      if (opts.dips) {
        for (const dz of opts.dips) {
          const d = wz - dz;
          h -= 2.4 * Math.exp(-(d * d) / (2 * 2.2 * 2.2)) * edge;
        }
      }
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.patterned(mat, width, depth, opts.tex ?? 'jungle'));
    mesh.position.set(cx, baseY, cz);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    if (opts.berms !== false) this.berms(z0, z1, baseY, width, cx);
  }

  // Firm raised edges: visible ridge + solid collider + a grindable lip rail.
  private berms(z0: number, z1: number, baseY: number, width: number, cx = 0): void {
    const depth = Math.abs(z1 - z0);
    const mat = this.baseMat('berm', this.bermTint, 'jungle', 1, 8);
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.45);
      const berm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, depth), mat);
      berm.position.set(x, baseY + 0.55, (z0 + z1) / 2);
      this.root.add(berm);
      // Collider matches the VISUAL (1.5 tall). It used to be 3 tall — an
      // invisible extension that swallowed the lip rail above it, so grinding
      // the lip fought the wall push every frame and glitched you off.
      this.walls.push(
        new THREE.Box3().setFromCenterAndSize(
          berm.position.clone(),
          new THREE.Vector3(0.9, 1.5, depth),
        ),
      );
      const lip = new Rail(
        [new THREE.Vector3(x, baseY + 1.35, z0), new THREE.Vector3(x, baseY + 1.35, z1)],
        false,
      );
      this.rails.push(lip);
    }
  }

  // ---------------------------------------------------------- motion kit --

  moverDelta(id: number): THREE.Vector3 {
    return this.movers[id]?.lastDelta ?? new THREE.Vector3();
  }

  touchCrumble(id: number): void {
    const c = this.crumbles[id];
    if (c && c.state === 'idle') {
      c.state = 'shake';
      c.t = 0;
    }
  }

  // The player grinds a rope this frame — flag its rope so the update loop sags
  // it and counts down to the snap. No-op for ordinary rails.
  grindRope(rail: Rail): void {
    for (const r of this.ropes) {
      if (r.rail === rail && (r.state === 'idle' || r.state === 'sag')) {
        r.active = true;
        return;
      }
    }
  }

  // Repoint a rope's visual segments onto its live (sagged) grind nodes.
  private syncRope(r: SkyRope): void {
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    for (let i = 0; i < r.segs.length; i++) {
      const a = r.rail.points[i];
      const bb = r.rail.points[i + 1];
      dir.copy(bb).sub(a);
      const len = dir.length() || 1e-3;
      dir.divideScalar(len);
      const seg = r.segs[i];
      seg.position.copy(a).addScaledVector(dir, len / 2);
      seg.quaternion.setFromUnitVectors(up, dir);
      seg.scale.y = len;
    }
  }

  // Sky-bridge side rope: a grindable, saggable, breakable rope running along Z.
  private skyRope(
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    breakTime = 3,
    sagAmt = 1.2,
    regen: number | null = 4,
  ): void {
    const N = 8;
    const rest: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      rest.push(
        new THREE.Vector3(
          THREE.MathUtils.lerp(x0, x1, i / N),
          y,
          THREE.MathUtils.lerp(z0, z1, i / N),
        ),
      );
    }
    const rail = new Rail(
      rest.map((p) => p.clone()),
      false, // grindable, but we draw our own dynamic rope
    );
    this.rails.push(rail);
    const group = new THREE.Group();
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xc2a878 });
    const segs: THREE.Mesh[] = [];
    for (let i = 0; i < N; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), ropeMat);
      group.add(seg);
      segs.push(seg);
    }
    const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    for (const [px, pz] of [
      [x0, z0],
      [x1, z1],
    ]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 1.8, 7), postMat);
      post.position.set(px, y - 0.5, pz);
      group.add(post);
    }
    this.root.add(group);
    const rope: SkyRope = { rail, segs, rest, state: 'idle', t: 0, active: false, breakTime, regen, sagAmt };
    this.ropes.push(rope);
    this.syncRope(rope);
  }

  // Moving platform sliding along one axis on a sine.
  private mover(
    x: number,
    topY: number,
    z: number,
    w: number,
    d: number,
    axis: 'x' | 'y' | 'z',
    amp: number,
    speed: number,
    phase = 0,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.8, d),
      this.patterned(
        new THREE.MeshLambertMaterial({ color: 0x8a96c8, emissive: 0x141c38 }),
        w,
        d,
        'metal', // riveted hover-plate
      ),
    );
    mesh.position.set(x, topY - 0.4, z);
    mesh.name = 'moving platform';
    mesh.userData.moverId = this.movers.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const axisV = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    this.movers.push({
      mesh,
      base: mesh.position.clone(),
      axisV,
      amp,
      speed,
      phase,
      lastDelta: new THREE.Vector3(),
    });
  }

  // Crumble pad: plank that shakes and drops when stood on. shakeTime near 0
  // breaks on landing; a longer shakeTime gives you a beat before it goes.
  private crumblePad(
    x: number,
    topY: number,
    z: number,
    w: number,
    d: number,
    regen: number | null = 3,
    shakeTime = 0.35,
    color = 0xa8845c,
    yawDeg = 0,
    tex = 'wood',
    fallSpeed = 30,
  ): Crumble {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.5, d),
      this.patterned(new THREE.MeshLambertMaterial({ color }), w, d, tex),
    );
    mesh.position.set(x, topY - 0.25, z);
    mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg); // stand-detection is the ground raycast: free spin is fine
    mesh.name = 'crumble pad';
    mesh.userData.crumbleId = this.crumbles.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const c: Crumble = { mesh, base: mesh.position.clone(), state: 'idle', t: 0, regen, shakeTime, fallSpeed, yaw: mesh.rotation.y };
    this.crumbles.push(c);
    return c;
  }

  // Timed crusher block over the path.
  private crusher(x: number, deckY: number, z: number, w: number, d: number, cycle = 3.2, phase = 0, h = 3, raise = 4.4): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.patterned(new THREE.MeshLambertMaterial({ color: 0x8f8f98 }), w, h, 'stone'),
    );
    const restY = deckY + h / 2 - 0.1;
    mesh.position.set(x, restY + raise, z);
    mesh.name = 'crusher';
    this.root.add(mesh);
    this.crushers.push({
      mesh,
      box: new THREE.Box3(),
      x,
      z,
      w,
      d,
      h,
      restY,
      raise,
      cycle,
      phase,
      crushing: false,
      slammed: false,
    });
  }

  // Pendulum blade swinging across the corridor between two posts.
  private pendulum(x: number, pivotY: number, z: number, len: number, amp = 1.0, speed = 1.6, phase = 0, yawDeg = 0): void {
    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a7078 });
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, z);
    pivot.rotation.order = 'YZX'; // yaw FIRST, then the animated z-swing lives in the spun frame
    pivot.rotation.y = yaw;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.22), mat);
    arm.position.y = -len / 2;
    pivot.add(arm);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.95, 10, 8), new THREE.MeshLambertMaterial({ color: 0x565c66, emissive: 0x16181c }));
    bob.position.y = -len;
    pivot.add(bob);
    this.root.add(pivot);
    // gallows: two posts + a crossbeam so the thing reads at speed — the
    // whole frame spins with the swing plane
    const postMat = this.baseMat('gallows', 0x8a6a48, 'wood', 1, 2);
    const postH = len + 2.5;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, postH, 0.6), postMat);
      const dx = side * (len + 1.2);
      post.position.set(x + dx * cos, pivotY - postH / 2 + 0.8, z - dx * sin);
      post.rotation.y = yaw;
      this.root.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry((len + 1.2) * 2 + 0.6, 0.5, 0.7), postMat);
    beam.position.set(x, pivotY + 0.3, z);
    beam.rotation.y = yaw;
    this.root.add(beam);
    this.pendulums.push({ pivot, len, amp, speed, phase, yaw, box: new THREE.Box3(), lastSign: 1 });
  }

  // Swinging grab-rope: a driven pendulum the player can hang from. speed 0 =
  // natural pendulum frequency for the length (long ropes swing slow).
  private ropeSwing(x: number, anchorY: number, z: number, len = 6, amp = 0.85, speed = 0, phase = 0, yawDeg = 0): void {
    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const pivot = new THREE.Group();
    pivot.position.set(x, anchorY, z);
    pivot.rotation.order = 'YZX'; // yaw FIRST, the animated z-swing lives in the spun frame
    pivot.rotation.y = yaw;
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xa8845a });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 5), ropeMat);
    rope.position.y = -len / 2;
    pivot.add(rope);
    // knot bands down the line sell "rope" at PS1 fidelity — and mark the grips
    for (let d = 1.2; d < len - 0.3; d += 1.2) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 6), bandMat);
      band.position.y = -d;
      pivot.add(band);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), bandMat);
    knot.position.y = -len;
    pivot.add(knot);
    // anchor mount so a floating anchor still reads attached to SOMETHING
    const mount = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.35, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x6a5138 }),
    );
    mount.position.y = 0.18;
    pivot.add(mount);
    this.root.add(pivot);
    this.ropeSwings.push({
      pivot,
      anchor: new THREE.Vector3(x, anchorY, z),
      len,
      amp,
      speed: speed > 0 ? speed : Math.sqrt(11 / Math.max(1, len)),
      phase,
      yaw,
      theta: 0,
      thetaV: 0,
    });
  }

  // World position `d` meters down a swing rope (d may exceed len — the body
  // dangles on the same line below the hands).
  ropePointAt(rs: RopeSwing, d: number, out: THREE.Vector3): THREE.Vector3 {
    const swing = Math.sin(rs.theta) * d;
    const cos = Math.cos(rs.yaw);
    const sin = Math.sin(rs.yaw);
    out.set(rs.anchor.x + swing * cos, rs.anchor.y - Math.cos(rs.theta) * d, rs.anchor.z - swing * sin);
    return out;
  }

  // Velocity of that point — the momentum a jump-off inherits.
  ropeVelAt(rs: RopeSwing, d: number, out: THREE.Vector3): THREE.Vector3 {
    const tang = d * rs.thetaV; // speed along the swing arc
    const cos = Math.cos(rs.yaw);
    const sin = Math.sin(rs.yaw);
    const planar = tang * Math.cos(rs.theta);
    out.set(planar * cos, tang * Math.sin(rs.theta), -planar * sin);
    return out;
  }

  // ---------------------------------------------------------- visual kit --

  // Animated pit floor: scrolling water, lava, or drifting void haze. Water
  // paints soft at 128 (lagoon two-tone + caustics); lava/void stay crisp.
  private pitPlane(kind: 'water' | 'lava' | 'void', y: number, cx: number, cz: number, size = 1400): void {
    const canvas = document.createElement('canvas');
    const S = kind === 'water' ? 128 : 64;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    let su = 0.004;
    let sv = 0.002;
    if (kind === 'water') {
      ctx.fillStyle = '#2b8a96';
      ctx.fillRect(0, 0, S, S);
      const pool = (px: number, py: number, r: number, color: string): void => {
        for (const ox of [-S, 0, S]) {
          for (const oy of [-S, 0, S]) {
            const bx = px + ox;
            const by = py + oy;
            if (bx < -r || bx > S + r || by < -r || by > S + r) continue;
            const g = ctx.createRadialGradient(bx, by, r * 0.2, bx, by, r);
            g.addColorStop(0, color);
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(bx - r, by - r, r * 2, r * 2);
          }
        }
      };
      for (let i = 0; i < 12; i++) pool(Math.random() * S, Math.random() * S, 16 + Math.random() * 20, 'rgba(23,105,128,0.5)'); // deep pools
      for (let i = 0; i < 10; i++) pool(Math.random() * S, Math.random() * S, 10 + Math.random() * 16, 'rgba(94,196,196,0.45)'); // shallows
      ctx.strokeStyle = 'rgba(214,246,240,0.4)'; // caustic arcs
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        const yy = 10 + i * 20;
        ctx.moveTo(0, yy);
        ctx.bezierCurveTo(S * 0.28, yy + 8, S * 0.72, yy - 8, S, yy);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) pool(Math.random() * S, Math.random() * S, 3 + Math.random() * 4, 'rgba(232,255,250,0.5)'); // sparkle
      su = 0.008;
      sv = 0.004;
    } else if (kind === 'lava') {
      ctx.fillStyle = '#1c0a08';
      ctx.fillRect(0, 0, 64, 64);
      // sparse thin veins at partial alpha: the chase cam fills the frame
      // with this plane, so crust must dominate and embers stay accents
      ctx.strokeStyle = 'rgba(255,106,34,0.6)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 64, 0);
        let px = Math.random() * 64;
        for (let s = 1; s <= 4; s++) {
          px += (Math.random() - 0.5) * 26;
          ctx.lineTo(px, s * 16);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,38,24,0.7)'; // cooled crust plates
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 6 + Math.random() * 9, 4 + Math.random() * 6, Math.random() * 3, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = '#ffb050';
      for (let i = 0; i < 6; i++) ctx.fillRect(Math.random() * 62, Math.random() * 62, 2, 2);
      su = 0.0035;
      sv = 0.0018;
    } else {
      ctx.fillStyle = '#0c0a12';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = 'rgba(60,50,80,0.5)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * 64, Math.random() * 64, 8 + Math.random() * 10, 5 + Math.random() * 6, 0, 0, 7);
        ctx.fill();
      }
      su = 0.0016;
      sv = 0.001;
    }
    const tex = new THREE.CanvasTexture(canvas);
    if (kind !== 'water') tex.magFilter = THREE.NearestFilter; // water blends
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // one tile per ~14u: veins/waves read as surface detail, not spaghetti,
    // even when the tilted boulder-chase camera fills the frame with the pit
    tex.repeat.set(size / 14, size / 14);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    this.root.add(mesh);
    this.scrollTexes.push({ tex, su, sv });
  }

  // Ambient weather: a wrapping cloud of leaves/embers/dust near the player.
  private buildAmbient(): void {
    if (window.location.search.includes('lite')) return; // headless smoke mode
    const N = 130;
    const pos = new Float32Array(N * 3);
    const drift = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 68;
      pos[i * 3 + 1] = Math.random() * 20 - 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 68;
      drift[i * 3] = (Math.random() - 0.5) * 1.2;
      drift[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      drift[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: this.theme.particleColor,
      size: 0.28,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.root.add(points);
    this.ambient = { points, drift };
  }

  // A fallen log across (part of) the path: hop it. Solid, never breaks.
  private log(x0: number, x1: number, y: number, z: number): void {
    const len = Math.abs(x1 - x0);
    const geo = new THREE.CylinderGeometry(0.55, 0.55, len, 8);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(geo, this.baseMat('log', 0x96683c, 'wood', 2, 1));
    const gy = this.floorY((x0 + x1) / 2, z, y);
    mesh.position.set((x0 + x1) / 2, gy + 0.55, z);
    this.root.add(mesh);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(
        mesh.position.clone(),
        new THREE.Vector3(len, 1.1, 1.1),
      ),
    );
  }

  // ------------------------------------------------------- tropical decor --
  // Everything below is pure dressing: added to root only, never a collider,
  // never a groundMesh, so it cannot touch physics or floorY probes. Blades
  // and clusters bake into one buffer each — a whole palm is three meshes.

  // Bake transformed copies of a geometry into one smooth-shaded buffer.
  private static mergeGeos(parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[]): THREE.BufferGeometry {
    const pos: number[] = [];
    const norm: number[] = [];
    const uv: number[] = [];
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const part of parts) {
      const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
      nm.getNormalMatrix(part.m);
      const p = g.attributes.position as THREE.BufferAttribute;
      const n = g.attributes.normal as THREE.BufferAttribute;
      const u = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(part.m);
        pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyNormalMatrix(nm).normalize();
        norm.push(v.x, v.y, v.z);
        uv.push(u.getX(i), u.getY(i));
      }
      if (g !== part.geo) g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  }

  // One leaf blade: a narrow plane arched up then drooped, tapered to the
  // tip, running +X from the origin. Smooth vertex normals do the shading.
  private static bladeGeo(len: number, wid: number, droop: number): THREE.BufferGeometry {
    const g = new THREE.PlaneGeometry(len, wid, 4, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(len / 2, 0, 0);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = p.getX(i) / len;
      p.setY(i, len * (0.32 * Math.sin(t * 2.2) - droop * t * t));
      p.setZ(i, p.getZ(i) * (1 - 0.7 * t));
    }
    g.computeVertexNormals();
    return g;
  }

  // Fan `count` copies of a blade around the origin; consumes the blade.
  private static fanGeo(blade: THREE.BufferGeometry, count: number, tilt: number): THREE.BufferGeometry {
    const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      e.set(0, (i / count) * Math.PI * 2 + i * 0.7, tilt + (i % 2) * 0.16);
      q.setFromEuler(e);
      parts.push({
        geo: blade,
        m: new THREE.Matrix4().compose(new THREE.Vector3(0, (i % 3) * 0.05, 0), q, one),
      });
    }
    const out = Level.mergeGeos(parts);
    blade.dispose();
    return out;
  }

  // Soft-painted decor canvases (128px, LinearFilter). Per level, like
  // surfTexCache, so dispose() frees them with everything else level-owned.
  private decorTexCache = new Map<string, THREE.CanvasTexture>();
  private decorTexture(kind: 'leaf' | 'moss'): THREE.CanvasTexture {
    const cached = this.decorTexCache.get(kind);
    if (cached) return cached;
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const blob = (x: number, y: number, r: number, color: string): void => {
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (kind === 'leaf') {
      // two-tone frond: lit rib band shading darker toward both edges
      const gr = ctx.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, '#c6dda2');
      gr.addColorStop(0.5, '#f0f7d6');
      gr.addColorStop(1, '#b9d494');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = 'rgba(120,150,80,0.35)'; // veins sweeping tipward
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const y0 = 8 + i * 14;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(S * 0.55, y0 + (i % 2 === 0 ? 9 : -9), S, y0);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 14, 'rgba(255,255,238,0.22)');
    } else {
      // moss: grey-green stone under soft growth pads (near-white, tintable)
      ctx.fillStyle = '#e2e4d6';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 14; i++) {
        const v = 200 + Math.floor(Math.random() * 30);
        blob(Math.random() * S, Math.random() * S, 12 + Math.random() * 16, `rgba(${v - 26},${v},${v - 40},0.45)`);
      }
      for (let i = 0; i < 8; i++) blob(Math.random() * S, Math.random() * S, 8 + Math.random() * 10, 'rgba(128,132,118,0.3)');
      for (let i = 0; i < 6; i++) blob(Math.random() * S, Math.random() * S, 5 + Math.random() * 7, 'rgba(255,255,240,0.3)');
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.decorTexCache.set(kind, tex);
    return tex;
  }

  // Shared decor materials — one per role per level, tinted at first call.
  private decorMats = new Map<string, THREE.MeshLambertMaterial>();
  private decorMat(key: string, color: number, tex: 'leaf' | 'moss' | '' = '', double = false): THREE.MeshLambertMaterial {
    let m = this.decorMats.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color });
    if (tex !== '') m.map = this.decorTexture(tex);
    if (double) m.side = THREE.DoubleSide;
    this.decorMats.set(key, m);
    return m;
  }

  // Tropical dressing is pure garnish: '?lite' (headless smoke) skips ALL of
  // it — software rendering can't afford the fill rate, and slow frames
  // desync the suite's wall-clock input scripting.
  private readonly liteDecor = window.location.search.includes('lite');

  // Jak-era palm: bowed trunk, merged frond crown, coconut cluster — three
  // meshes on shared geometry. h scales the whole tree; lean > 0 tips the
  // top toward -x (the trunk's baked bow runs +x, so leans read as S-curves).
  private static palmTrunkGeo: THREE.BufferGeometry | null = null;
  private static palmCrownGeo: THREE.BufferGeometry | null = null;
  private static coconutGeo: THREE.BufferGeometry | null = null;
  private palm(x: number, y: number, z: number, h = 4.8, lean = 0.12): void {
    if (this.liteDecor) return;
    if (!Level.palmTrunkGeo) {
      const g = new THREE.CylinderGeometry(0.13, 0.3, 4.8, 7, 6);
      g.translate(0, 2.4, 0);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / 4.8;
        p.setX(i, p.getX(i) + 0.85 * t * t); // bow toward +x
      }
      Level.palmTrunkGeo = g;
    }
    if (!Level.palmCrownGeo) Level.palmCrownGeo = Level.fanGeo(Level.bladeGeo(2.7, 0.62, 0.72), 8, 0.08);
    if (!Level.coconutGeo) {
      const nut = new THREE.SphereGeometry(0.17, 7, 5);
      Level.coconutGeo = Level.mergeGeos([
        { geo: nut, m: new THREE.Matrix4().makeTranslation(0.17, 0, 0.03) },
        { geo: nut, m: new THREE.Matrix4().makeTranslation(-0.1, 0.05, 0.15) },
        { geo: nut, m: new THREE.Matrix4().makeTranslation(-0.06, -0.03, -0.15) },
      ]);
      nut.dispose();
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(Level.palmTrunkGeo, this.baseMat('palmTrunk', 0xb08556, 'wood', 1, 3)));
    const two = Math.abs(Math.round(x + z)) % 2 === 0;
    const crown = new THREE.Mesh(
      Level.palmCrownGeo,
      this.decorMat(two ? 'frondA' : 'frondB', two ? 0x3fa04a : 0x5cae3c, 'leaf', true),
    );
    crown.position.set(0.85, 4.72, 0);
    crown.rotation.y = x * 1.7 + z * 0.4; // deterministic twist per tree
    g.add(crown);
    const nuts = new THREE.Mesh(Level.coconutGeo, this.decorMat('coconut', 0x7a5a34));
    nuts.position.set(0.85, 4.45, 0);
    g.add(nuts);
    g.scale.setScalar(h / 4.8);
    g.position.set(x, y, z);
    g.rotation.z = lean;
    this.root.add(g);
  }

  // Fern tuft: six arcing blades in one buffer.
  private static fernGeoCache: THREE.BufferGeometry | null = null;
  private fern(x: number, y: number, z: number, s = 1): void {
    if (this.liteDecor) return;
    if (!Level.fernGeoCache) Level.fernGeoCache = Level.fanGeo(Level.bladeGeo(1.15, 0.3, 0.95), 6, 0.7);
    const m = new THREE.Mesh(Level.fernGeoCache, this.decorMat('fern', 0x4a9a40, 'leaf', true));
    m.scale.setScalar(s);
    m.rotation.y = x * 2.1 + z * 0.6;
    m.position.set(x, y + 0.02, z);
    this.root.add(m);
  }

  // Broadleaf plant: five wide paddles. Key/color per role (jungle, succulent).
  private static leafGeoCache: THREE.BufferGeometry | null = null;
  private broadleaf(x: number, y: number, z: number, s = 1, key = 'leafy', color = 0x3e8e46): void {
    if (this.liteDecor) return;
    if (!Level.leafGeoCache) Level.leafGeoCache = Level.fanGeo(Level.bladeGeo(1.5, 0.95, 0.5), 5, 0.5);
    const m = new THREE.Mesh(Level.leafGeoCache, this.decorMat(key, color, 'leaf', true));
    m.scale.setScalar(s);
    m.rotation.y = x * 1.9 + z * 0.8;
    m.position.set(x, y + 0.02, z);
    this.root.add(m);
  }

  // Hanging vine spill: nine down-turned blades in one buffer; len scales it.
  private static vineGeoCache: THREE.BufferGeometry | null = null;
  private vine(x: number, y: number, z: number, len = 2.6): void {
    if (this.liteDecor) return;
    if (!Level.vineGeoCache) {
      const blade = Level.bladeGeo(1.0, 0.3, 0.85);
      const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      const q = new THREE.Quaternion();
      for (let i = 0; i < 9; i++) {
        q.setFromEuler(new THREE.Euler(0, i * 2.4, -0.95 - (i % 3) * 0.3));
        parts.push({
          geo: blade,
          m: new THREE.Matrix4().compose(
            new THREE.Vector3(0, -i * 0.34, 0),
            q.clone(),
            new THREE.Vector3().setScalar(1 - i * 0.05),
          ),
        });
      }
      Level.vineGeoCache = Level.mergeGeos(parts);
      blade.dispose();
    }
    const m = new THREE.Mesh(Level.vineGeoCache, this.decorMat('vine', 0x55a848, 'leaf', true));
    m.scale.set(0.9, len / 3.4, 0.9);
    m.rotation.y = x * 1.3 + z;
    m.position.set(x, y, z);
    this.root.add(m);
  }

  // Flower dots: a bright six-berry cluster, one buffer, coral/orange/pink.
  private static flowerGeoCache: THREE.BufferGeometry | null = null;
  private flowers(x: number, y: number, z: number): void {
    if (this.liteDecor) return;
    if (!Level.flowerGeoCache) {
      const bud = new THREE.SphereGeometry(0.09, 6, 5);
      const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push({
          geo: bud,
          m: new THREE.Matrix4().makeTranslation(
            Math.cos(a) * (0.12 + (i % 3) * 0.09),
            0.1 + (i % 3) * 0.09,
            Math.sin(a) * (0.12 + (i % 2) * 0.11),
          ),
        });
      }
      Level.flowerGeoCache = Level.mergeGeos(parts);
      bud.dispose();
    }
    const keys = [['bloomA', 0xff5a48], ['bloomB', 0xff9a2e], ['bloomC', 0xf84a8e]] as const;
    const [key, color] = keys[Math.abs(Math.round(x * 3 + z * 5)) % 3];
    const m = new THREE.Mesh(Level.flowerGeoCache, this.decorMat(key, color));
    m.position.set(x, y, z);
    this.root.add(m);
  }

  // Deck planter: terracotta pot with a fern spilling out.
  private static potGeo: THREE.CylinderGeometry | null = null;
  private planter(x: number, y: number, z: number): void {
    if (this.liteDecor) return;
    if (!Level.potGeo) Level.potGeo = new THREE.CylinderGeometry(0.52, 0.38, 0.6, 9);
    const pot = new THREE.Mesh(Level.potGeo, this.decorMat('pot', 0xc86a42));
    pot.position.set(x, y + 0.3, z);
    this.root.add(pot);
    this.fern(x, y + 0.55, z, 0.9);
  }

  // Rounded mossy boulder: squashed sphere, soft shading. Visual only.
  private static rockGeo: THREE.SphereGeometry | null = null;
  private rock(x: number, y: number, z: number, s = 1.6): void {
    if (!Level.rockGeo) Level.rockGeo = new THREE.SphereGeometry(1, 10, 8);
    const m = new THREE.Mesh(Level.rockGeo, this.decorMat('mossRock', 0xa8b090, 'moss'));
    m.scale.set(s, s * 0.6, s * 0.82);
    m.rotation.y = x * 1.3 + z * 0.7; // deterministic tumble
    m.position.set(x, y + s * 0.4, z);
    this.root.add(m);
  }

  // Rolling stone hazard patrolling the course between z0 (near) and z1 (far).
  private stone(x: number, y: number, z0: number, z1: number, speed: number, r = 0.9): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      this.baseMat('rock', 0xa08a70, 'dirt', 2, 2),
    );
    mesh.position.set(x, this.floorY(x, (z0 + z1) / 2, y) + r, (z0 + z1) / 2);
    this.root.add(mesh);
    this.stones.push({ mesh, box: new THREE.Box3(), x, z0: Math.max(z0, z1), z1: Math.min(z0, z1), dir: 1, speed, r });
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on. cx offsets the deck laterally.
  private slab(
    name: string,
    z0: number,
    z1: number,
    topY: number,
    width: number,
    mat: THREE.Material,
    grindEdges = true,
    cx = 0,
    tex = 'checker',
  ): THREE.Mesh {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, depth),
      this.patterned(mat, width, depth, tex),
    );
    mesh.position.set(cx, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    // Deck edges are solid + ledge-grabbable: the collider is the slab's own
    // volume (top tucked 0.2 under the walk surface so standing never shoves),
    // so an undershot gap jump bonks the face and the hands can catch the lip
    // instead of clipping through the 1u-thin edge into the pit.
    this.walls.push(
      new THREE.Box3(
        new THREE.Vector3(cx - width / 2, topY - 1, Math.min(z0, z1)),
        new THREE.Vector3(cx + width / 2, topY - 0.2, Math.max(z0, z1)),
      ),
    );
    this.curbs(z0, z1, topY, width, cx);
    if (grindEdges) this.edgeRails(z0, topY, z1, topY, width, cx);
    return mesh;
  }

  // The curb lines themselves are grindable: invisible rails along both deck
  // edges, THPS ledge-style.
  private edgeRails(z0: number, y0: number, z1: number, y1: number, width: number, cx = 0): void {
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.15);
      const rail = new Rail(
        [new THREE.Vector3(x, y0 + 0.05, z0), new THREE.Vector3(x, y1 + 0.05, z1)],
        false,
      );
      this.rails.push(rail);
    }
  }

  // Flat deck running along X (for turned, side-scrolling stretches).
  // x0 < x1; depth is the deck's size along z, centered on cz.
  private slabX(
    name: string,
    x0: number,
    x1: number,
    topY: number,
    depth: number,
    mat: THREE.Material,
    cz: number,
    tex = 'checker',
  ): THREE.Mesh {
    const len = Math.abs(x1 - x0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1, depth),
      this.patterned(mat, len, depth, tex),
    );
    mesh.position.set((x0 + x1) / 2, topY - 0.5, cz);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    // same solid, grabbable edge treatment as slab() (see there)
    this.walls.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), topY - 1, cz - depth / 2),
        new THREE.Vector3(Math.max(x0, x1), topY - 0.2, cz + depth / 2),
      ),
    );
    return mesh;
  }

  private fruitRowX(x0: number, x1: number, y: number, n: number, z: number): void {
    for (let i = 0; i < n; i++) {
      this.pickup(THREE.MathUtils.lerp(x0, x1, n === 1 ? 0 : i / (n - 1)), y, z);
    }
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(name: string, z0: number, y0: number, z1: number, y1: number, width: number, mat: THREE.Material, cx = 0, tex = 'stone'): void {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const dyn = dy / len;
    const dzn = dz / len;
    // Box local +Z under rotation.x = a maps to (0, -sin a, cos a). The course
    // runs toward -Z, so align local +Z with the *reverse* travel direction.
    const alpha = Math.atan2(dyn, -dzn);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, len),
      this.patterned(mat, width, len, tex),
    );
    mesh.rotation.x = alpha;
    const normal = new THREE.Vector3(0, -dzn, dyn);
    mesh.position
      .set(cx, (y0 + y1) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Solid barrier: visual box + collider. Bump = full stop, never breaks.
  // visH: the VISIBLE wall height — the collider always stands the full h.
  // Spawn-side back walls use a low visH curb so the trailing camera sees
  // over them instead of eating a face full of bricks.
  private wall(cx: number, cz: number, w: number, d: number, baseY: number, h = 5, visH = h): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, visH, d),
      this.baseMat('wall', this.wallTint, 'stone', 3, 1),
    );
    mesh.userData.wallSpec = { w, d, h, visH }; // capture: position is read live off the mesh
    mesh.position.set(cx, baseY + visH / 2, cz);
    this.root.add(mesh);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cx, baseY + h / 2, cz),
        new THREE.Vector3(w, h, d),
      ),
    );
  }

  // Solid raised platform: walkable top, solid sides (jump up onto it).
  private stepBlock(x: number, z: number, w: number, d: number, baseY: number, topY: number): void {
    const h = topY - baseY;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.baseMat('step', this.blockTint, 'stone', 2, 2),
    );
    mesh.position.set(x, baseY + h / 2, z);
    mesh.name = 'step block';
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    // Side collider stops a hair below the top so standing on it doesn't shove.
    this.walls.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, baseY - 1, z - d / 2),
        new THREE.Vector3(x + w / 2, topY - 0.2, z + d / 2),
      ),
    );
  }

  // Crash-style temple stair: staggered solid columns strung into a real
  // multi-story climb (each step ~2.6 up, small hop between). Returns where
  // the top block ends so the course can continue at height.
  private towerClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
  ): { endZ: number; topY: number } {
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      const x = xCenter + (i % 2 === 0 ? -2.2 : 2.2);
      this.stepBlock(x, z - 2.5, 5, 5, y - 9, y);
      if (i % 2 === 1 || i === stories - 1) this.crate(x, y, z - 2.5);
      z -= 7;
    }
    return { endZ: z, topY: y };
  }

  // Flush staircase: steps butt directly against each other (no gap to fall
  // through) with guard rails along both sides — the safe way to gain real
  // height. Bonk the riser, hop up, repeat.
  private stairClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
    width = 8,
  ): { endZ: number; topY: number } {
    const depth = 5;
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      this.stepBlock(xCenter, z - depth / 2, width, depth, y - 10, y);
      // guard rails so you can't slip off the sides
      for (const side of [-1, 1]) {
        this.wall(xCenter + side * (width / 2 + 0.3), z - depth / 2, 0.6, depth, y, 1.6);
      }
      if (i % 2 === 1) this.crate(xCenter, y, z - depth / 2);
      z -= depth;
    }
    return { endZ: z, topY: y };
  }

  // Painted edge strips so deck borders read at speed. Visual only — the
  // per-level accent tint (THPS painted-curb energy) is set by each builder.
  private curbs(z0: number, z1: number, topY: number, width: number, cx = 0): void {
    const mat = this.baseMat('curb', this.curbTint);
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(cx + side * (width / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
      this.root.add(curb);
    }
  }

  private crate(
    x: number,
    deckY: number,
    z: number,
    kind?: 'nitro' | 'bouncy' | 'metalbounce' | 'tnt' | 'mask' | 'mystery' | 'bang' | 'nitrobang',
    opts?: { outline?: boolean; groupIds?: number[] },
  ): void {
    const size = 0.96; // uniform crate size (was 1.2; checkpoints matched at 1.4)
    let mat: THREE.MeshLambertMaterial;
    if (kind === 'nitro') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0c3a16, map: this.nitroTexture() });
    } else if (kind === 'bouncy') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.arrowTexture() });
    } else if (kind === 'metalbounce') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.metalArrowTexture() });
    } else if (kind === 'tnt') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.tntTexture('TNT') });
    } else if (kind === 'mask') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.maskTexture() });
    } else if (kind === 'mystery') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.mysteryTexture() });
    } else if (kind === 'bang') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.bangTexture() });
    } else if (kind === 'nitrobang') {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0c3a16, map: this.nitroBangTexture() });
    } else {
      mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: this.plainTexture() });
    }
    // Seat the box: on top of an existing crate at this spot (stacks), else
    // on the actual terrain (wavy jungle floors), else at the given height.
    let base = deckY;
    let onStack = false;
    for (const other of this.crates) {
      const p = other.mesh.position;
      if (Math.abs(p.x - x) < 0.6 && Math.abs(p.z - z) < 0.6) {
        const top = p.y + size / 2;
        if (Math.abs(deckY - top) < 0.9) {
          base = top;
          onStack = true;
        }
      }
    }
    if (!onStack) {
      if (this.builtFromData) {
        // captured/edited level: rest on the surface beneath (see crateRestSurface)
        const surf = this.crateRestSurface(x, z, deckY);
        base = surf !== null ? surf : deckY;
      } else {
        base = this.floorY(x, z, deckY);
      }
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, base + size / 2, z);
    mesh.userData.baseY = mesh.position.y;
    if (!kind) mesh.rotation.y = 0.15;
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    const entry: Crate = {
      mesh,
      box,
      alive: true,
      nitro: kind === 'nitro',
      bouncy: kind === 'bouncy',
      metalBounce: kind === 'metalbounce',
      tnt: kind === 'tnt',
      mask: kind === 'mask',
      mystery: kind === 'mystery',
      bang: kind === 'bang',
      nitroBang: kind === 'nitrobang',
      groupIds: opts?.groupIds,
    };
    // OUTLINE state: keep the true face stashed and show a pass-through ghost
    // shell. A grouped '!' switch swaps the real thing in; resets re-ghost it.
    if (opts?.outline) {
      entry.wasOutline = true;
      entry.pending = true;
      entry.realMat = mesh.material as THREE.Material;
      entry.ghostMat = new THREE.MeshBasicMaterial({
        color: 0xe8d9a8,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
      (mesh as THREE.Mesh).material = entry.ghostMat;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry as THREE.BufferGeometry),
        new THREE.LineBasicMaterial({ color: 0xf2e2b0 }),
      );
      mesh.add(edges);
      entry.ghostEdges = edges;
    }
    this.crates.push(entry);
    // Classic Crash formation: every arrow crate carries a breakable fruit
    // crate floating above it — bounce off the arrow, headbutt the reward.
    if (kind === 'bouncy' && !opts?.outline) {
      this.crate(x, base + size + 3.2, z);
    }
  }

  // A light metal plate face for the unbreakable arrow crate: same green
  // bounce arrow, riveted steel instead of planks.
  private metalArrowTex: THREE.CanvasTexture | null = null;
  private metalArrowTexture(): THREE.CanvasTexture {
    if (!this.metalArrowTex)
      this.metalArrowTex = this.makeTex((ctx) => {
        this.crateMetalBase(ctx);
        ctx.fillStyle = '#3a9a4a';
        ctx.beginPath();
        ctx.moveTo(16, 5);
        ctx.lineTo(25, 15);
        ctx.lineTo(20, 15);
        ctx.lineTo(20, 26);
        ctx.lineTo(12, 26);
        ctx.lineTo(12, 15);
        ctx.lineTo(7, 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1c5a28';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    return this.metalArrowTex;
  }

  // Brushed plate + rivets, shared by the metal-family crate faces.
  private crateMetalBase(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#9aa2ac';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#8a929c';
    ctx.fillRect(0, 8, 32, 2);
    ctx.fillRect(0, 22, 32, 2);
    ctx.fillStyle = '#666e78';
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 30, 32, 2);
    ctx.fillRect(0, 0, 2, 32);
    ctx.fillRect(30, 0, 2, 32);
    ctx.fillStyle = '#b8c0ca';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = '#565e68';
    for (const [rx, ry] of [[4, 4], [26, 4], [4, 26], [26, 26]] as const) {
      ctx.fillRect(rx, ry, 3, 3);
    }
  }

  // Classic PSX crate face: light planked wood, beveled frame, corner studs.
  // Every crate variant draws its icon over this base (drawn per reference
  // rips of the original series' crate sheet, recreated by hand).
  private crateWood(ctx: CanvasRenderingContext2D, brace: boolean): void {
    ctx.fillStyle = '#b5762f';
    ctx.fillRect(0, 0, 32, 32);
    // plank seams + grain flecks
    ctx.fillStyle = '#94601f';
    ctx.fillRect(0, 10, 32, 1);
    ctx.fillRect(0, 21, 32, 1);
    ctx.fillRect(6, 5, 4, 1);
    ctx.fillRect(20, 15, 5, 1);
    ctx.fillRect(9, 26, 5, 1);
    if (brace) {
      // X brace
      ctx.strokeStyle = '#8a5a22';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.lineTo(29, 29);
      ctx.moveTo(29, 3);
      ctx.lineTo(3, 29);
      ctx.stroke();
    }
    // beveled frame + corner studs
    ctx.fillStyle = '#8a5a22';
    ctx.fillRect(0, 0, 32, 3);
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillRect(0, 0, 3, 32);
    ctx.fillRect(29, 0, 3, 32);
    ctx.fillStyle = '#d19b4a';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = '#6e4517';
    for (const [cx, cy] of [[1, 1], [27, 1], [1, 27], [27, 27]] as const) {
      ctx.fillRect(cx, cy, 4, 4);
    }
  }

  // Outlined icon text, chunky PSX style.
  private crateLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    px: number,
    fill: string,
    outline: string,
    x = 16,
    y = 18,
  ): void {
    ctx.font = `bold ${px}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = outline;
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      ctx.fillText(text, x + ox, y + oy);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  private makeTex(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    draw(canvas.getContext('2d')!);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // Plain wooden crate: planks + X brace, nothing else.
  private plainTexture(): THREE.CanvasTexture {
    if (!this.plainTex) this.plainTex = this.makeTex((ctx) => this.crateWood(ctx, true));
    return this.plainTex;
  }

  // Yellow '!' on METAL: the switch that materializes its group's outline
  // crates. Never breaks, never counts toward the box tally.
  private bangTex: THREE.CanvasTexture | null = null;
  private bangTexture(): THREE.CanvasTexture {
    if (!this.bangTex)
      this.bangTex = this.makeTex((ctx) => {
        this.crateMetalBase(ctx);
        this.crateLabel(ctx, '!', 24, '#ffd934', '#3a3f46', 16, 18);
      });
    return this.bangTex;
  }

  // A fired '!' switch: same metal box, mark gone.
  private spentBangTex: THREE.CanvasTexture | null = null;
  private spentBangTexture(): THREE.CanvasTexture {
    if (!this.spentBangTex) this.spentBangTex = this.makeTex((ctx) => this.crateMetalBase(ctx));
    return this.spentBangTex;
  }

  // White '!' on nitro green: breaking it detonates every nitro on the map.
  private nitroBangTex: THREE.CanvasTexture | null = null;
  private nitroBangTexture(): THREE.CanvasTexture {
    if (!this.nitroBangTex)
      this.nitroBangTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#2fae44';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#1c7a2c';
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        this.crateLabel(ctx, '!', 24, '#eafff0', '#0e4a18', 16, 18);
      });
    return this.nitroBangTex;
  }

  // Riveted steel: the UNBREAKABLE crate (solid terrain, spin/slam-proof).
  private metalTex: THREE.CanvasTexture | null = null;
  private metalTexture(): THREE.CanvasTexture {
    if (!this.metalTex)
      this.metalTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#9aa2ac';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#7d8590';
        ctx.fillRect(0, 0, 32, 4);
        ctx.fillRect(0, 28, 32, 4);
        ctx.fillRect(0, 0, 4, 32);
        ctx.fillRect(28, 0, 4, 32);
        ctx.fillStyle = '#b8c0ca';
        ctx.fillRect(4, 4, 24, 2); // top sheen
        ctx.fillStyle = '#666e78';
        for (const [rx, ry] of [[6, 6], [24, 6], [6, 24], [24, 24]] as const) {
          ctx.fillRect(rx, ry, 3, 3); // corner rivets
        }
        ctx.fillStyle = '#8a929c';
        ctx.fillRect(14, 8, 4, 16); // center brace
        ctx.fillRect(8, 14, 16, 4);
      });
    return this.metalTex;
  }

  // Big orange '?' on plain wood.
  private mysteryTexture(): THREE.CanvasTexture {
    if (!this.mysteryTex)
      this.mysteryTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        this.crateLabel(ctx, '?', 22, '#ff8c1a', '#5a2d08', 16, 17);
      });
    return this.mysteryTex;
  }

  // Aku mask on wood: orange face, feathered headdress band, heavy brows.
  private maskTexture(): THREE.CanvasTexture {
    if (!this.maskTex)
      this.maskTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        // feathers
        for (const [fx, fc] of [[8, '#c03a2a'], [13, '#3a9a4a'], [18, '#c03a2a']] as const) {
          ctx.fillStyle = fc;
          ctx.fillRect(fx, 3, 4, 5);
        }
        // face
        ctx.fillStyle = '#e89040';
        ctx.fillRect(8, 7, 16, 20);
        ctx.fillStyle = '#5a2d12';
        ctx.fillRect(8, 7, 16, 3); // brow band
        ctx.fillRect(10, 13, 4, 5); // eyes
        ctx.fillRect(18, 13, 4, 5);
        ctx.fillRect(11, 22, 10, 3); // grin
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(12, 23, 2, 1); // teeth glints
        ctx.fillRect(17, 23, 2, 1);
      });
    return this.maskTex;
  }

  // Classic red TNT face; lit fuses swap it for big 3 / 2 / 1 digits.
  private tntTexture(label: string): THREE.CanvasTexture {
    const cached = this.tntTexCache.get(label);
    if (cached) return cached;
    const tex = this.makeTex((ctx) => {
      ctx.fillStyle = '#c23a30';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#8f2018';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = '#e06a52';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      if (label.length > 1) this.crateLabel(ctx, label, 12, '#ffffff', '#3a0c08', 16, 17);
      else this.crateLabel(ctx, label, 24, '#ffe84a', '#3a0c08', 16, 17);
    });
    this.tntTexCache.set(label, tex);
    return tex;
  }

  // Green NITRO: jittery goo crate, hazard-striped frame.
  private nitroTexture(): THREE.CanvasTexture {
    if (!this.nitroTex)
      this.nitroTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#2fae44';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#1c7a2c';
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        // hazard notches on the frame
        ctx.fillStyle = '#0e4a18';
        for (let x = 0; x < 32; x += 8) {
          ctx.fillRect(x, 0, 4, 3);
          ctx.fillRect(x + 4, 29, 4, 3);
        }
        ctx.fillStyle = '#7ce890';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, 'NITRO', 9, '#eafff0', '#0e4a18', 16, 16);
        this.crateLabel(ctx, '!', 12, '#ffe84a', '#0e4a18', 16, 25);
      });
    return this.nitroTex;
  }

  // Chunky green up-arrow on wood (the super-bounce crate).
  private arrowTexture(): THREE.CanvasTexture {
    if (!this.arrowTex)
      this.arrowTex = this.makeTex((ctx) => {
        this.crateWood(ctx, false);
        ctx.fillStyle = '#1c6a28';
        ctx.beginPath();
        ctx.moveTo(16, 4);
        ctx.lineTo(28, 17);
        ctx.lineTo(21, 17);
        ctx.lineTo(21, 29);
        ctx.lineTo(11, 29);
        ctx.lineTo(11, 17);
        ctx.lineTo(4, 17);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3fae4a';
        ctx.beginPath();
        ctx.moveTo(16, 6);
        ctx.lineTo(26, 16);
        ctx.lineTo(20, 16);
        ctx.lineTo(20, 28);
        ctx.lineTo(12, 28);
        ctx.lineTo(12, 16);
        ctx.lineTo(6, 16);
        ctx.closePath();
        ctx.fill();
      });
    return this.arrowTex;
  }

  // Blue checkpoint crate with the classic 'C'.
  private cpTexture(): THREE.CanvasTexture {
    if (!this.cpTex)
      this.cpTex = this.makeTex((ctx) => {
        ctx.fillStyle = '#4aa0e0';
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = '#2a6ba0';
        ctx.fillRect(0, 10, 32, 1);
        ctx.fillRect(0, 21, 32, 1);
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        ctx.fillStyle = '#9fd4ff';
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, 'C', 22, '#ffffff', '#123049', 16, 17);
      });
    return this.cpTex;
  }

  // -------------------------------------------- warp-room VFX + relics --

  // Diagonal magenta/white bands; scrolled through the crystal's UVs every
  // frame = cheap fake chrome (texture-coordinate animation, no reflections).
  private chromeTexture(): THREE.CanvasTexture {
    if (this.chromeTex) return this.chromeTex;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const band = (Math.sin((x + y * 2) * 0.55) + Math.sin((x - y) * 0.23)) * 0.5;
        const t = band * 0.5 + 0.5;
        const r = Math.floor(150 + 105 * t);
        const g = Math.floor(40 + 160 * t * t);
        const b = Math.floor(200 + 55 * t);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    this.chromeTex = new THREE.CanvasTexture(canvas);
    this.chromeTex.magFilter = THREE.NearestFilter;
    this.chromeTex.wrapS = THREE.RepeatWrapping;
    this.chromeTex.wrapT = THREE.RepeatWrapping;
    return this.chromeTex;
  }

  // Sharp 4-point twinkle for the additive sparkle billboards. Drawn WHITE so
  // a per-sprite material colour tints it (purple crystal glints, cyan gem).
  private glintTexture(): THREE.CanvasTexture {
    if (this.glintTex) return this.glintTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 64);
    // long thin diamond arms: taper from the hot centre to sharp points
    const arm = (len: number, w: number, a: number) => {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); // vertical spindle
      ctx.moveTo(32, 32 - len);
      ctx.lineTo(32 + w, 32);
      ctx.lineTo(32, 32 + len);
      ctx.lineTo(32 - w, 32);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); // horizontal spindle
      ctx.moveTo(32 - len, 32);
      ctx.lineTo(32, 32 - w);
      ctx.lineTo(32 + len, 32);
      ctx.lineTo(32, 32 + w);
      ctx.closePath();
      ctx.fill();
    };
    arm(30, 6, 0.5);
    arm(30, 2.5, 0.9);
    // white-hot core
    const cg = ctx.createRadialGradient(32, 32, 0, 32, 32, 9);
    cg.addColorStop(0, 'rgba(255,255,255,1)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(20, 20, 24, 24);
    this.glintTex = new THREE.CanvasTexture(canvas);
    this.glintTex.magFilter = THREE.NearestFilter;
    return this.glintTex;
  }

  // The big collection flash: a blazing white core with long anamorphic rays
  // (the lens-flare starbursts in the reference). White; tinted per burst.
  private flareTexture(): THREE.CanvasTexture {
    if (this.flareTex) return this.flareTex;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    // eight rays, cardinals long, diagonals shorter — additive so they streak
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let k = 0; k < 8; k++) {
      const len = k % 2 === 0 ? 62 : 34;
      const w = k % 2 === 0 ? 3.5 : 2;
      ctx.save();
      ctx.rotate((k * Math.PI) / 4);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(w, 0);
      ctx.lineTo(0, len);
      ctx.lineTo(-w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // fat radial core
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();
    this.flareTex = new THREE.CanvasTexture(canvas);
    this.flareTex.magFilter = THREE.LinearFilter;
    return this.flareTex;
  }

  // CANNED REFLECTION (matcap): a painted "photo of a lit sphere" that the
  // material samples by the surface normal — so the bright highlight is baked
  // INTO the surface and sweeps across the facets as the crystal/gem spins,
  // with zero dependence on the scene's real lights (the PS1 studio-reflection
  // look). kind picks the purple crystal vs the silver gem palette.
  private matcapTex: { crystal?: THREE.CanvasTexture; gem?: THREE.CanvasTexture } = {};
  private matcapTexture(kind: 'crystal' | 'gem'): THREE.CanvasTexture {
    const cached = this.matcapTex[kind];
    if (cached) return cached;
    const S = 128;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext('2d')!;
    const c = S / 2;
    const blob = (x: number, y: number, r: number, col: string) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (kind === 'crystal') {
      // BRIGHT white-lavender crystal: the front face reads near-white and only
      // the rim/side facets go saturated purple → magenta (matches the ref,
      // which glows white-hot with purple edges, not a dark purple stone).
      const base = ctx.createRadialGradient(c - 12, c - 14, 4, c, c, c);
      base.addColorStop(0, '#ffffff');
      base.addColorStop(0.3, '#f0e2ff');
      base.addColorStop(0.55, '#d3a6f2');
      base.addColorStop(0.78, '#a848e0');
      base.addColorStop(0.92, '#6a1cb0');
      base.addColorStop(1, '#3c0c72');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, S, S);
      // hot core + a lavender bloom so the facing face blazes
      blob(c - 12, c - 16, 30, 'rgba(255,255,255,0.9)');
      blob(c - 16, c - 20, 12, 'rgba(255,255,255,1)');
      blob(c + 34, c + 30, 30, 'rgba(200,60,215,0.55)'); // magenta rim bounce
    } else {
      // silver-white sphere: bright silver centre, cool slate at the rim
      const base = ctx.createRadialGradient(c - 10, c - 12, 4, c, c, c);
      base.addColorStop(0, '#ffffff');
      base.addColorStop(0.42, '#c6d4e2');
      base.addColorStop(0.72, '#7d8d9d');
      base.addColorStop(0.9, '#4c5c6c');
      base.addColorStop(1, '#2c3742');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, S, S);
      // diamonds throw multiple hard glints: bright streaks + spots that sweep
      ctx.save();
      ctx.translate(c - 16, c - 26);
      ctx.rotate(-0.5);
      ctx.scale(0.42, 1.4);
      blob(0, 0, 40, 'rgba(255,255,255,1)');
      ctx.restore();
      blob(c + 28, c + 8, 18, 'rgba(255,255,255,0.9)');
      blob(c - 32, c + 32, 13, 'rgba(225,238,250,0.8)');
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // chunky PS1 texels
    tex.minFilter = THREE.NearestFilter;
    this.matcapTex[kind] = tex;
    return tex;
  }

  // Soft round halo — the pink/cyan glow that hangs around the pickups. White,
  // tinted by the sprite material.
  private glowTexture(): THREE.CanvasTexture {
    if (this.glowTex) return this.glowTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.62)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    this.glowTex = new THREE.CanvasTexture(canvas);
    this.glowTex.magFilter = THREE.LinearFilter;
    return this.glowTex;
  }

  // Flat additive ring; pulses + spins in update (radial-wave magic circle).
  private glowRing(x: number, y: number, z: number, r: number, color: number, upright = false): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.62, r, 20),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    mesh.position.set(x, y, z);
    if (!upright) mesh.rotation.x = -Math.PI / 2;
    this.root.add(mesh);
    this.glowRings.push({ mesh, phase: Math.random() * 6, speed: 1.6 + Math.random(), base: 1 });
    return mesh;
  }

  private spawnGlint(
    x: number,
    y: number,
    z: number,
    scale = 1,
    opts: {
      tex?: THREE.CanvasTexture;
      color?: number;
      vx?: number;
      vy?: number;
      vz?: number;
      life?: number;
      pop?: boolean;
    } = {},
  ): void {
    let slot = this.glints.find((g) => g.life <= 0);
    if (!slot && this.glints.length < 48) {
      const spr = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glintTexture(),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      spr.visible = false;
      this.root.add(spr);
      slot = { spr, life: 0, max: 0.6, vx: 0, vy: 0, vz: 0, spin: 0, scale: 1, pop: false };
      this.glints.push(slot);
    }
    if (!slot) return;
    const mat = slot.spr.material as THREE.SpriteMaterial;
    mat.map = opts.tex ?? this.glintTexture();
    mat.color.setHex(opts.color ?? 0xffffff);
    mat.needsUpdate = true;
    slot.max = opts.life ?? 0.4 + Math.random() * 0.45;
    slot.life = slot.max;
    slot.vx = opts.vx ?? 0;
    slot.vy = opts.vy ?? 0.4 + Math.random() * 0.8;
    slot.vz = opts.vz ?? 0;
    slot.spin = (Math.random() - 0.5) * 4;
    slot.scale = scale;
    slot.pop = opts.pop ?? false;
    slot.spr.position.set(x, y, z);
    slot.spr.visible = true;
  }

  // COLLECTION GLIMMER (Crash relic pickup): a blazing white-cored starburst at
  // the pickup, then a shower of small purple/cyan twinkles that fan outward
  // and fade — recreated from the reference capture.
  private glimmerBurst(pos: THREE.Vector3, hue: number): void {
    // central flares: big flash that pops up then shrinks fast
    for (let i = 0; i < 3; i++) {
      this.spawnGlint(
        pos.x + (Math.random() - 0.5) * 0.8,
        pos.y + (Math.random() - 0.5) * 0.8,
        pos.z + (Math.random() - 0.5) * 0.8,
        7 + Math.random() * 3,
        { tex: this.flareTexture(), color: i === 0 ? 0xffffff : hue, vy: 0.3, life: 0.45, pop: true },
      );
    }
    // dispersing sparkle shower: fan outward across a wide radius, staggered
    for (let i = 0; i < 26; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 6;
      this.spawnGlint(
        pos.x + (Math.random() - 0.5) * 1.5,
        pos.y + (Math.random() - 0.2) * 1.5,
        pos.z + (Math.random() - 0.5) * 1.5,
        1.1 + Math.random() * 1.4,
        {
          color: hue,
          vx: Math.cos(ang) * spd,
          vz: Math.sin(ang) * spd,
          vy: 1 + Math.random() * 3,
          life: 0.5 + Math.random() * 0.7,
        },
      );
    }
  }

  // ---- collectible geometry (reference-accurate) ----------------------------

  // Tall white-lavender crystal shard: an ASYMMETRIC bipyramid — a short blunt
  // top over a long tapering bottom point (matches the ref proportions) — with
  // a canned matcap sweep and a pink glow that blazes at the bottom tip.
  private crystalMesh(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const R = 0.52 * scale;
    const HTOP = 0.72 * scale; // short upper pyramid
    const HBOT = 1.5 * scale; // long lower point
    // CANNED reflection: matcap, not scene lighting. Each flat facet samples
    // the painted highlight by its normal, so the bright face sweeps as the
    // crystal spins — independent of the world's real lights.
    const shellMat = new THREE.MeshMatcapMaterial({
      matcap: this.matcapTexture('crystal'),
      flatShading: true,
      transparent: true,
      opacity: 0.96,
    });
    const SIDES = 5; // few big facets = a sharp shard
    const top = new THREE.Mesh(new THREE.ConeGeometry(R, HTOP, SIDES), shellMat);
    top.position.y = HTOP / 2; // belt (widest ring) sits at y=0
    g.add(top);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(R, HBOT, SIDES), shellMat);
    bot.rotation.z = Math.PI;
    bot.position.y = -HBOT / 2;
    g.add(bot);
    // hot inner streak: a slim bright core following the same asymmetric shape
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffe6ff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ctop = new THREE.Mesh(new THREE.ConeGeometry(R * 0.4, HTOP * 0.95, SIDES), coreMat);
    ctop.position.y = HTOP / 2;
    g.add(ctop);
    const cbot = new THREE.Mesh(new THREE.ConeGeometry(R * 0.4, HBOT * 0.95, SIDES), coreMat);
    cbot.rotation.z = Math.PI;
    cbot.position.y = -HBOT / 2;
    g.add(cbot);
    // pink glow halo (billboard), taller and offset DOWN so it blazes at the
    // long bottom tip like the reference
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    (halo.material as THREE.SpriteMaterial).color.setHex(0xe24cf0);
    halo.scale.set(3.0 * scale, 4.4 * scale, 1);
    halo.position.y = -0.55 * scale;
    halo.userData.pulse = true;
    g.add(halo);
    // a second hot pink glow concentrated at the bottom point
    const tipGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    (tipGlow.material as THREE.SpriteMaterial).color.setHex(0xff6ae0);
    tipGlow.scale.set(1.6 * scale, 1.6 * scale, 1);
    tipGlow.position.y = -HBOT * 0.95;
    tipGlow.userData.pulse = true;
    g.add(tipGlow);
    return g;
  }

  // Clear brilliant-cut diamond: octagonal table + crown facets over a pointed
  // pavilion, silvery-white with a cool glow (Crash clear-gem look).
  private gemMesh(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const girdle = 0.72 * scale;
    const table = 0.4 * scale;
    const crownH = 0.42 * scale;
    const pavH = 0.8 * scale;
    // canned reflection (matcap) so the silver glints sweep the crown facets
    // as the gem spins, no scene lighting
    const mat = new THREE.MeshMatcapMaterial({
      matcap: this.matcapTexture('gem'),
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });
    // crown: 8-sided frustum, wide girdle at the bottom, narrow table on top
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(table, girdle, crownH, 8), mat);
    crown.position.y = crownH / 2;
    g.add(crown);
    // pavilion: 8-sided cone to a point below the girdle
    const pav = new THREE.Mesh(new THREE.ConeGeometry(girdle, pavH, 8), mat);
    pav.rotation.z = Math.PI; // apex down
    pav.position.y = -pavH / 2;
    g.add(pav);
    // faint white sparkle core
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.3 * scale),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.scale.y = 1.4;
    g.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture(),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    // faint cool aura only — the reference gem is clean silver, no glow blob
    (halo.material as THREE.SpriteMaterial).color.setHex(0x5c86a8);
    halo.scale.set(1.7 * scale, 1.6 * scale, 1);
    g.add(halo);
    return g;
  }

  // The crystal: Crash 2/3 style pickup on the main route. Faceted octahedron
  // wearing the scrolling chrome, magic ring at its base, glints in update.
  private crystal(x: number, y: number, z: number): void {
    const g = this.crystalMesh(1);
    // belt sits at the group origin; the long bottom point reaches ~1.5 below,
    // so float the group up to keep the tip hovering just above the ground
    g.position.set(x, y + 1.75, z);
    g.userData.baseY = y + 1.75;
    this.root.add(g);
    this.glowRing(x, y + 0.12, z, 1.5, 0xd06aff);
    this.crystalPickup = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.3, z),
        new THREE.Vector3(2.0, 3.4, 2.0),
      ),
      collected: false,
    };
    this.crystalPlaced = true;
  }

  collectCrystal(): void {
    const c = this.crystalPickup;
    if (!c) return;
    c.collected = true;
    c.group.visible = false;
    this.glimmerBurst(c.group.position, 0xc83af0);
  }

  // ------------------------------------------------------------ time trial --
  // The gold stopwatch floats just off the racing line at spawn. Touching it
  // starts the trial; skirting it is a normal run. Only levels with a finish
  // gate get one — a trial with no line to cross could never end.
  // Tag everything a placer added to root since `before` with an editor
  // component index — the activators build outside buildCustom's tagged loop.
  private tagFrom(before: number, idx: number): void {
    for (let k = before; k < this.root.children.length; k++) {
      this.root.children[k].traverse((o) => (o.userData.editorIdx = idx));
      this.root.children[k].userData.editorIdx = idx;
    }
  }

  private placeClock(): void {
    if (this.finishZ < -1e8 || !this.gateSpec) return;
    this.root.updateMatrixWorld(true); // floorY raycasts — fresh builder meshes still hold identity matrices
    const spot = this.clockSpot; // authored spot (custom levels) beats the spawn-side default
    const dir = this.chaseCam ? 1 : -1; // boulder chases run AT +z; everything else runs -z
    const x = spot ? spot.x : this.spawnPos.x + 2;
    const z = spot ? spot.z : this.spawnPos.z + dir * 5;
    const y = this.floorY(x, z, spot ? spot.y : this.spawnPos.y);
    const before = this.root.children.length;

    const g = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({ color: 0xe8b53a, emissive: 0x40300a });
    // face: white dial, gold rim, hands at ten-past-ten
    const faceTex = this.makeTex((ctx) => {
      ctx.fillStyle = '#f4efdf';
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = '#c79a2e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3a3020';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.fillRect(16 + Math.cos(a) * 11 - 1, 16 + Math.sin(a) * 11 - 1, 2, 2);
      }
      ctx.strokeStyle = '#20242c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(16 + 7, 16 - 4);
      ctx.moveTo(16, 16);
      ctx.lineTo(16 - 3, 16 - 8);
      ctx.stroke();
    });
    const faceMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: faceTex });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 14), [gold, faceMat, faceMat]);
    body.rotation.x = Math.PI / 2; // dial fronts the corridor
    g.add(body);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8), gold);
    crown.position.y = 0.72;
    g.add(crown);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10), gold);
    ring.position.y = 0.92;
    g.add(ring);
    g.position.set(x, y + 1.35, z);
    g.userData.baseY = y + 1.35;
    this.root.add(g);
    this.glowRing(x, y + 0.12, z, 1.4, 0xffd75e);
    if (spot) this.tagFrom(before, spot.idx);
    this.clockPickup = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.2, z),
        new THREE.Vector3(2.0, 2.8, 2.0),
      ),
      collected: false,
    };
  }

  collectClock(): void {
    const c = this.clockPickup;
    if (!c) return;
    c.collected = true;
    c.group.visible = false;
    this.glimmerBurst(c.group.position, 0xffd75e);
  }

  // ------------------------------------------------------------ combo run --
  // The green orb floats opposite the stopwatch at spawn. Touch it and the
  // green gem appears at the finish gate — yours if you reach it in ONE combo.
  private placeComboOrb(): void {
    if (this.finishZ < -1e8 || !this.gateSpec) return;
    this.root.updateMatrixWorld(true);
    const spot = this.orbSpot;
    const dir = this.chaseCam ? 1 : -1;
    const x = spot ? spot.x : this.spawnPos.x - 2;
    const z = spot ? spot.z : this.spawnPos.z + dir * 5;
    const y = this.floorY(x, z, spot ? spot.y : this.spawnPos.y);
    const before = this.root.children.length;
    const g = new THREE.Group();
    // a chunky 3D plus, spinning on the spot (bobSpin drives the turn)
    const plusMat = new THREE.MeshLambertMaterial({ color: 0x46e882, emissive: 0x0e5c2c, flatShading: true });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.15, 0.36), plusMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.36), plusMat));
    // a soft translucent plus around it reads "glowy" at PS1 fidelity
    const shellMat = new THREE.MeshBasicMaterial({ color: 0x46e882, transparent: true, opacity: 0.22, depthWrite: false });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.38, 0.56), shellMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.56, 0.56), shellMat));
    g.position.set(x, y + 1.3, z);
    g.userData.baseY = y + 1.3;
    this.root.add(g);
    this.glowRing(x, y + 0.12, z, 1.4, 0x46e882);
    if (spot) this.tagFrom(before, spot.idx);
    this.comboOrb = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.2, z),
        new THREE.Vector3(2.0, 2.8, 2.0),
      ),
      collected: false,
    };
  }

  collectComboOrb(): void {
    const o = this.comboOrb;
    if (!o) return;
    o.collected = true;
    o.group.visible = false;
    this.glimmerBurst(o.group.position, 0x46e882);
  }

  // The prize materializes just before the gate the moment the run starts,
  // and stays exactly as long as the combo does.
  spawnComboGem(): void {
    if (!this.gateSpec || this.comboGem) return;
    const dir = this.chaseCam ? -1 : 1; // a couple units on the NEAR side of the gate plane
    const { x, y, z } = this.gateSpec;
    // the near-side offset turns with the gate, so rotated gates still park
    // the prize on the approach side
    const yawR = THREE.MathUtils.degToRad(this.gateYaw);
    const gx = x + Math.sin(yawR) * dir * 2.5;
    const gz = z + Math.cos(yawR) * dir * 2.5;
    const g = this.gemMesh(1.1);
    g.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const m = mesh.material as THREE.MeshMatcapMaterial;
        if (m && m.color) m.color.set(0x46e882); // the clear gem, run through green glass
      }
    });
    g.position.set(gx, y + 1.7, gz);
    g.userData.baseY = y + 1.7;
    this.root.add(g);
    this.glowRing(gx, y + 0.12, gz, 1.5, 0x46e882);
    this.comboGem = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(gx, y + 1.5, gz),
        new THREE.Vector3(2.2, 3.2, 2.2),
      ),
    };
  }

  // The combo broke (or was cashed in): the prize evaporates.
  removeComboGem(burst = false): void {
    if (!this.comboGem) return;
    if (burst) this.glimmerBurst(this.comboGem.group.position, 0x46e882);
    this.root.remove(this.comboGem.group);
    this.comboGem = null;
  }

  setComboRun(on: boolean): void {
    if (this.comboRun === on) return;
    this.comboRun = on;
    this.applyRunDress(on, false);
    if (!on) this.removeComboGem();
  }

  // Flip the whole level in/out of trial dress: checkpoints + wumpa vanish,
  // and the breakable boxes reshuffle — every third plain/mystery box becomes
  // a numbered TIME crate (breaking it freezes the clock that many seconds),
  // the rest turn into plain boxes with nothing inside. Arrows, masks, nitros,
  // TNTs, switches, and metal keep their jobs. Fully reversible.
  setTimeTrial(on: boolean): void {
    if (this.timeTrial === on) return;
    this.timeTrial = on;
    this.applyRunDress(on, true);
  }

  private applyRunDress(on: boolean, withTimeCrates: boolean): void {
    for (const cp of this.checkpoints) cp.mesh.visible = !on && !cp.active;
    for (const p of this.pickups) p.mesh.visible = !on && p.alive;
    // the crystal sits the trial out too — pure racing, no collectathon
    if (this.crystalPickup && !this.crystalPickup.collected) this.crystalPickup.group.visible = !on;
    const secsPattern = [2, 1, 3, 1, 2, 4]; // mostly small freezes, the odd jackpot
    let i = 0;
    for (const c of this.crates) {
      const convertible =
        !c.nitro && !c.bouncy && !c.metalBounce && !c.tnt && !c.mask && !c.bang && !c.nitroBang;
      if (!convertible) continue;
      // pending outlines keep their ghost shell — repaint the REAL face under it
      const mat = (c.pending && c.realMat ? c.realMat : c.mesh.material) as THREE.MeshLambertMaterial;
      if (on) {
        c.ttOrigMap = mat.map;
        c.timeSecs = undefined;
        c.boost = undefined;
        if (!withTimeCrates && this.allBalanceCrates) {
          // levels built around one long grind line (The Slipstream): EVERY
          // crate is a stacking perfect-balance window in combo mode
          c.boost = 'balance';
          mat.map = this.boostTexture('balance');
        } else if (i % 3 === 2) {
          if (withTimeCrates) {
            // time trial: numbered freeze crates
            c.timeSecs = secsPattern[Math.floor(i / 3) % secsPattern.length];
            mat.map = this.timeTexture(c.timeSecs);
          } else {
            // combo run: perfect-balance crates — the windows STACK
            c.boost = 'balance';
            mat.map = this.boostTexture('balance');
          }
        } else {
          mat.map = this.plainTexture();
        }
        mat.needsUpdate = true;
      } else {
        if (c.ttOrigMap !== undefined) {
          mat.map = c.ttOrigMap;
          mat.needsUpdate = true;
          c.ttOrigMap = undefined;
        }
        c.timeSecs = undefined;
        c.boost = undefined;
      }
      i++;
    }
  }

  // Yellow numbered box: the Crash 3 time crate.
  private timeTexCache = new Map<number, THREE.CanvasTexture>();
  private timeTexture(n: number): THREE.CanvasTexture {
    const cached = this.timeTexCache.get(n);
    if (cached) return cached;
    const tex = this.makeTex((ctx) => {
      ctx.fillStyle = '#e8c33a';
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#b08a1c';
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = '#ffe89a';
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      this.crateLabel(ctx, String(n), 24, '#ffffff', '#5a4008', 16, 17);
    });
    this.timeTexCache.set(n, tex);
    return tex;
  }

  // Combo-run boost crates: orange chevrons = speed burst, cyan needle =
  // perfect balance for a few seconds.
  private boostTexCache = new Map<string, THREE.CanvasTexture>();
  private boostTexture(kind: 'speed' | 'balance'): THREE.CanvasTexture {
    const cached = this.boostTexCache.get(kind);
    if (cached) return cached;
    const tex = this.makeTex((ctx) => {
      const base = kind === 'speed' ? '#e8763a' : '#3ac2e8';
      const dark = kind === 'speed' ? '#a8481c' : '#1c7ea8';
      const light = kind === 'speed' ? '#ffb98a' : '#a8e8ff';
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = dark;
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      if (kind === 'speed') {
        // double chevron pointing right
        ctx.fillStyle = '#ffffff';
        for (const ox of [8, 15]) {
          ctx.beginPath();
          ctx.moveTo(ox, 9);
          ctx.lineTo(ox + 6, 16);
          ctx.lineTo(ox, 23);
          ctx.lineTo(ox + 3, 23);
          ctx.lineTo(ox + 9, 16);
          ctx.lineTo(ox + 3, 9);
          ctx.closePath();
          ctx.fill();
        }
      } else {
        // balance needle: beam + centered pivot triangle
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(7, 12, 18, 3);
        ctx.beginPath();
        ctx.moveTo(16, 15);
        ctx.lineTo(11, 23);
        ctx.lineTo(21, 23);
        ctx.closePath();
        ctx.fill();
      }
    });
    this.boostTexCache.set(kind, tex);
    return tex;
  }

  // All boxes broken: the gem materializes over the player, THPS-photo style.
  awardGem(pos: THREE.Vector3): void {
    if (this.gemG) return;
    const g = this.gemMesh(1);
    g.position.set(pos.x, pos.y + 3.2, pos.z);
    g.userData.baseY = pos.y + 3.2;
    this.root.add(g);
    this.gemG = g;
    // no magic ring on the gem — the reference is a clean spinning diamond
    this.glimmerBurst(g.position, 0x9fe0ff);
  }

  // The finish gate mirrors your relic haul: earned icons light up and spin.
  setRelics(crystal: boolean, gem: boolean): void {
    if (crystal === this.relics.crystal && gem === this.relics.gem) return;
    this.relics = { crystal, gem };
    const style = (icon: THREE.Mesh | null, earned: boolean, emissive: number): void => {
      if (!icon) return;
      const m = icon.material as THREE.MeshLambertMaterial;
      if (earned) {
        m.color.set(0xffffff);
        m.emissive.set(emissive);
        m.emissiveIntensity = 0.85;
        m.opacity = 1;
      } else {
        m.color.set(0x2a2f3a);
        m.emissive.set(0x000000);
        m.opacity = 0.4;
      }
    };
    style(this.gateCrystalIcon, crystal, 0xc03fe0);
    style(this.gateGemIcon, gem, 0x20c8e0);
  }

  // 256-entry blue -> cyan -> white palette for the plasma (palette cycling:
  // the field is static-ish maths; the LOOKUP slides, so it always moves).
  private plasmaSetup(): void {
    if (this.plasmaTex) return;
    const pal = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const w = Math.sin(t * Math.PI); // bright mid-band
      pal[i * 3] = Math.floor(18 + 90 * t * t + 60 * w * t);
      pal[i * 3 + 1] = Math.floor(40 + 170 * t);
      pal[i * 3 + 2] = Math.floor(120 + 135 * Math.min(1, t * 1.4));
    }
    this.plasmaPal = pal;
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    this.plasmaCtx = canvas.getContext('2d')!;
    this.plasmaData = this.plasmaCtx.createImageData(48, 48);
    this.plasmaTex = new THREE.CanvasTexture(canvas);
    this.plasmaTex.magFilter = THREE.NearestFilter; // chunky PS1 texels
  }

  // Classic demoscene plasma: three drifting sine bands + one radial ripple,
  // summed (interference), palette-cycled. 48x48, every third frame.
  private updatePlasma(): void {
    if (!this.plasmaTex || !this.plasmaData || !this.plasmaCtx || !this.plasmaPal) return;
    const t = this.vfxT;
    const d = this.plasmaData.data;
    const pal = this.plasmaPal;
    let i = 0;
    for (let y = 0; y < 48; y++) {
      for (let x = 0; x < 48; x++) {
        const dx = x - 24;
        const dy = y - 24;
        const v =
          Math.sin(x * 0.32 + t * 1.3) +
          Math.sin(y * 0.27 - t * 0.9) +
          Math.sin((x + y) * 0.17 + t * 0.6) +
          Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.55 - t * 2.2);
        const idx = (Math.floor((v + 4) * 31.9 + t * 26) & 255) * 3;
        d[i] = pal[idx];
        d[i + 1] = pal[idx + 1];
        d[i + 2] = pal[idx + 2];
        d[i + 3] = 255;
        i += 4;
      }
    }
    this.plasmaCtx.putImageData(this.plasmaData, 0, 0);
    this.plasmaTex.needsUpdate = true;
  }

  // Per-frame VFX tick: plasma, chrome scroll, bobs, spins, rings, glints.
  private updateVfx(dt: number): void {
    this.vfxT += dt;
    this.plasmaFrame++;
    if (this.plasmaFrame % 3 === 0) this.updatePlasma();
    // fake chrome = UV scroll + a sine wobble (texture-coordinate distortion),
    // so the bands swim liquidly across the facets instead of gliding straight
    if (this.chromeTex) {
      this.chromeTex.offset.x = (this.vfxT * 0.34 + Math.sin(this.vfxT * 2.7) * 0.08) % 1;
      this.chromeTex.offset.y = (this.vfxT * 0.11 + Math.cos(this.vfxT * 1.9) * 0.06) % 1;
    }
    const pulse = 0.75 + 0.25 * Math.sin(this.vfxT * 3.3); // shared glow breathe
    const bobSpin = (g: THREE.Group | null, rate: number): void => {
      if (!g || !g.visible) return;
      g.position.y = (g.userData.baseY as number) + Math.sin(this.vfxT * 2.1) * 0.22;
      g.rotation.y += rate * dt;
      // breathe the glow halos so the lighting loop lives even at rest
      for (const child of g.children) {
        if (child.userData.pulse) {
          ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity = pulse;
        }
      }
    };
    if (this.crystalPickup && !this.crystalPickup.collected) bobSpin(this.crystalPickup.group, 1.7);
    if (this.clockPickup && !this.clockPickup.collected) bobSpin(this.clockPickup.group, 1.3);
    if (this.comboOrb && !this.comboOrb.collected) bobSpin(this.comboOrb.group, 1.6);
    if (this.comboGem) bobSpin(this.comboGem.group, 2.0);
    bobSpin(this.gemG, 2.4);
    // gate relic icons: earned ones spin and bob, ghosts sit still
    if (this.gateCrystalIcon && this.relics.crystal) this.gateCrystalIcon.rotation.y += 2.2 * dt;
    if (this.gateGemIcon && this.relics.gem) this.gateGemIcon.rotation.y += 2.2 * dt;
    // magic rings: radial pulse + slow spin
    for (const r of this.glowRings) {
      const p = 1 + 0.16 * Math.sin(this.vfxT * r.speed + r.phase);
      r.mesh.scale.setScalar(p);
      r.mesh.rotation.z += 0.5 * dt;
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(this.vfxT * r.speed * 1.3 + r.phase);
    }
    // ambient glints drip off whatever magic is live (tinted to the pickup)
    this.glintT -= dt;
    if (this.glintT <= 0) {
      this.glintT = 0.2;
      const anchors: { p: THREE.Vector3; c: number }[] = [];
      if (this.crystalPickup && !this.crystalPickup.collected && !this.timeTrial)
        anchors.push({ p: this.crystalPickup.group.position, c: 0xd863f2 });
      if (this.gemG) anchors.push({ p: this.gemG.position, c: 0xaee6ff });
      if (this.gateCrystalIcon && this.relics.crystal)
        anchors.push({ p: this.gateCrystalIcon.position, c: 0xd863f2 });
      if (this.gateGemIcon && this.relics.gem) anchors.push({ p: this.gateGemIcon.position, c: 0xaee6ff });
      if (anchors.length > 0) {
        const a = anchors[Math.floor(Math.random() * anchors.length)];
        this.spawnGlint(
          a.p.x + (Math.random() - 0.5) * 1.6,
          a.p.y + (Math.random() - 0.5) * 1.9,
          a.p.z + (Math.random() - 0.5) * 1.6,
          0.9 + Math.random() * 0.5,
          { color: a.c, vy: 0.5 + Math.random() * 0.7 },
        );
      }
    }
    for (const g of this.glints) {
      if (g.life <= 0) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.spr.visible = false;
        continue;
      }
      // drift outward + up; the shower decelerates as it fans (air drag feel)
      g.spr.position.x += g.vx * dt;
      g.spr.position.y += g.vy * dt;
      g.spr.position.z += g.vz * dt;
      const drag = Math.max(0, 1 - 2.2 * dt);
      g.vx *= drag;
      g.vz *= drag;
      const prog = 1 - g.life / g.max;
      // pop flares grow fast then shrink; sparkles ease in-out; both fade at end
      const k = g.pop ? (prog < 0.25 ? prog / 0.25 : 1 - (prog - 0.25) / 0.75) : Math.sin(prog * Math.PI);
      const s = g.scale * k;
      g.spr.scale.set(s, s, 1);
      (g.spr.material as THREE.SpriteMaterial).rotation += g.spin * dt;
    }
  }

  // Two white pupil eyes on the front face at height y.
  private enemyEyes(group: THREE.Group, y: number, z = 0.56, spread = 0.22): void {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-spread, spread]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), eyeMat);
      eye.position.set(side, y, z);
      group.add(eye);
    }
  }

  // Build the mesh for a foe. Returns the group and the "body" — the mesh a
  // kind squashes / flashes / spins for its state animation.
  private enemyGroup(kind: EnemyKind): { group: THREE.Group; body: THREE.Mesh } {
    const group = new THREE.Group();
    const lam = (c: number, e = 0): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({ color: c, emissive: e });
    let body: THREE.Mesh;
    if (kind === 'spiker') {
      // squat purple body wearing a crown of up-pointing spikes (land = ouch)
      body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 1.05), lam(0x7a3a8a));
      body.position.y = 0.42;
      group.add(body);
      const spikeMat = lam(0xe8e0f0);
      for (const [sx, sz] of [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28], [0, 0]]) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), spikeMat);
        spike.position.set(sx, 0.86, sz);
        group.add(spike);
      }
      this.enemyEyes(group, 0.55, 0.55);
    } else if (kind === 'turtle') {
      // domed green shell (safe to land on), gold side plates, a poking head.
      // NO top spikes — stomping is the ONLY way through it.
      body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x2f7a44));
      body.scale.set(1, 0.75, 1.15);
      body.position.y = 0.34;
      group.add(body);
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.9), lam(0x8a6a2a));
        plate.position.set(side * 0.6, 0.3, 0);
        group.add(plate);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.36, 0.4), lam(0x6cae5a));
      head.position.set(0, 0.34, 0.62);
      group.add(head);
      this.enemyEyes(group, 0.42, 0.82, 0.12);
    } else if (kind === 'charger') {
      // bulky bull with forward horns — the reared-back telegraph reads clearly
      body = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 1.45), lam(0x8a4a26));
      body.position.y = 0.6;
      group.add(body);
      for (const side of [-0.34, 0.34]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 5), lam(0xf0e6d0));
        horn.position.set(side, 0.82, 0.82);
        horn.rotation.x = Math.PI / 2.1;
        group.add(horn);
      }
      const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.3), lam(0x6e3a1e));
      snout.position.set(0, 0.42, 0.82);
      group.add(snout);
      this.enemyEyes(group, 0.82, 0.74, 0.28);
    } else if (kind === 'hopper') {
      // rounded frog, eyes bulging on top, folded hind legs (springs on launch)
      body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 9, 7), lam(0x46a83a));
      body.scale.set(1.1, 0.85, 1);
      body.position.y = 0.46;
      group.add(body);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupMat = new THREE.MeshBasicMaterial({ color: 0x101010 });
      for (const side of [-0.24, 0.24]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.17, 7, 6), eyeMat);
        e.position.set(side, 0.86, 0.16);
        group.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), pupMat);
        p.position.set(side, 0.9, 0.29);
        group.add(p);
      }
      for (const side of [-0.4, 0.4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.4), lam(0x35862c));
        leg.position.set(side, 0.2, -0.18);
        group.add(leg);
      }
    } else if (kind === 'floater') {
      // hovering drone: a violet core diamond ringed by a spinning rotor blur,
      // a single wary eye. It never touches the ground.
      body = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), lam(0x9a6cff, 0x2a1466));
      body.position.y = 0.05;
      group.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 16), lam(0x6c4ad0, 0x160a40));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      ring.name = 'rotor';
      group.add(ring);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe27a }));
      eye.position.set(0, 0.05, 0.4);
      group.add(eye);
    } else if (kind === 'sentry') {
      // fixed base + a rotating head with a barrel and a charge-eye that glows
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.5, 8), lam(0x4c525e));
      base.position.y = 0.25;
      group.add(base);
      body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.6, 0.85), lam(0x8a3a3a));
      body.position.y = 0.72;
      body.name = 'head';
      group.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8), lam(0x33373f));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.72, 0.55);
      barrel.name = 'barrel';
      body.add(barrel);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6a3a }));
      eye.position.set(0, 0.72, 0.44);
      eye.name = 'eye';
      body.add(eye);
    } else if (kind === 'spinner') {
      // a brass hub with radial blades that telescope out (danger) and in (safe)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.5, 8), lam(0xb08a2a, 0x2a1e06));
      hub.position.y = 0.55;
      group.add(hub);
      body = hub;
      const bladeMat = lam(0xd8dde2, 0x22262a);
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 4) * Math.PI * 2;
        pivot.position.y = 0.55;
        pivot.name = 'blade';
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.28), bladeMat);
        blade.position.x = 0.7;
        pivot.add(blade);
        group.add(pivot);
      }
    } else {
      // grunt (default): the classic red box crab with two eyes
      body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.9, 1.1), lam(0xa03a3a));
      body.position.y = 0.55;
      group.add(body);
      this.enemyEyes(group, 0.75);
    }
    body.userData.baseY = body.position.y; // rest height, for pose reset
    this.root.add(group);
    return { group, body };
  }

  // Patrols a0..a1 along `axis` at the given cross coordinate (the Enemy
  // struct's x0/x1 are axis-generic bounds — see its comment). `kind` picks
  // the foe's look, movement pattern, and which attacks defeat it.
  private enemy(
    a0: number,
    a1: number,
    deckY: number,
    cross: number,
    speed: number,
    axis: 'x' | 'z' = 'x',
    kind: EnemyKind = 'grunt',
  ): void {
    const { group, body } = this.enemyGroup(kind);
    // snap to real ground (wavy jungle floors), then remember it for resets
    const mid = (a0 + a1) / 2;
    const gx = axis === 'z' ? cross : mid;
    const gz = axis === 'z' ? mid : cross;
    const gy = this.floorY(gx, gz, deckY);
    group.position.set(gx, gy, gz);
    group.userData.baseY = gy;
    // sentry/spinner are stationary — collapse the patrol span so they hold post
    if (kind === 'sentry' || kind === 'spinner') { a0 = a1 = mid; }
    this.enemies.push({
      group, box: new THREE.Box3(), alive: true, x0: a0, x1: a1, dir: 1, speed, axis,
      kind, state: this.enemyStartState(kind), stateT: 0, baseY: gy, cross, body, vy: 0,
      spinKill: true, stompKill: true, meleeKill: true, touchHurt: true, spinRecoil: false,
    });
  }

  private enemyStartState(kind: EnemyKind): string {
    if (kind === 'charger') return 'patrol';
    if (kind === 'hopper') return 'crouch';
    if (kind === 'floater') return 'hover';
    if (kind === 'sentry') return 'track';
    if (kind === 'spinner') return 'out';
    return 'patrol';
  }

  // Restore a foe's pose + FSM to its starting state (respawn / checkpoint).
  private resetEnemyVisual(e: Enemy): void {
    e.state = this.enemyStartState(e.kind);
    e.stateT = 0;
    e.vy = 0;
    e.dir = 1;
    e.group.position.y = e.baseY;
    e.group.rotation.set(0, 0, 0);
    e.group.scale.setScalar(1);
    e.body.rotation.set(0, 0, 0);
    e.body.scale.setScalar(1);
    e.body.position.y = e.body.userData.baseY ?? e.body.position.y;
    e.spinKill = e.stompKill = e.meleeKill = e.touchHurt = true;
    e.spinRecoil = false;
    e.group.traverse((o) => {
      if (o.name === 'blade') o.scale.setScalar(1);
      if (o.name === 'eye') o.scale.setScalar(1);
    });
  }

  // Facing yaw for an axis-bound walker given travel direction.
  private faceDir(e: Enemy, d: number): void {
    e.group.rotation.y = e.axis === 'z' ? (d > 0 ? 0 : Math.PI) : d > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  // Back-and-forth patrol between x0/x1 along the enemy's axis (speedMul lets a
  // charger amble at half pace, etc). Returns true on a bound bounce.
  private patrolStep(e: Enemy, dt: number, speedMul = 1): boolean {
    const key = e.axis === 'z' ? 'z' : 'x';
    e.group.position[key] += e.dir * e.speed * speedMul * dt;
    let bounced = false;
    if (e.group.position[key] > e.x1) { e.group.position[key] = e.x1; e.dir = -1; bounced = true; }
    else if (e.group.position[key] < e.x0) { e.group.position[key] = e.x0; e.dir = 1; bounced = true; }
    this.faceDir(e, e.dir);
    return bounced;
  }

  // player position resolved onto the enemy's own along/cross axes
  private playerAlong(e: Enemy): number { return e.axis === 'z' ? this.playerPos.z : this.playerPos.x; }
  private playerCross(e: Enemy): number { return e.axis === 'z' ? this.playerPos.x : this.playerPos.z; }
  private enemyAlong(e: Enemy): number { return e.axis === 'z' ? e.group.position.z : e.group.position.x; }

  // Drive every foe's FSM + movement, and publish the per-frame combat flags
  // (spinKill/stompKill/meleeKill/touchHurt/spinRecoil) the player reads.
  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // grunt defaults — each kind tweaks what differs
      e.spinKill = true; e.stompKill = true; e.meleeKill = true; e.touchHurt = true; e.spinRecoil = false;
      let boxW = 1.3, boxH = 1.1, cy = 0.55;
      switch (e.kind) {
        case 'grunt':
          this.patrolStep(e, dt);
          break;
        case 'spiker':
          this.patrolStep(e, dt);
          e.stompKill = false; // land on the spikes = you take the hit
          break;
        case 'turtle':
          this.patrolStep(e, dt, 0.7);
          e.spinKill = false; e.spinRecoil = true; // a spin just bumps the shell
          boxH = 0.9; cy = 0.42;
          break;
        case 'charger':
          this.chargerStep(e, dt);
          boxW = 1.45;
          break;
        case 'hopper':
          this.hopperStep(e, dt);
          break;
        case 'floater':
          this.floaterStep(e, dt);
          e.stompKill = false; // it flies above your feet — spin it down
          cy = 0.05;
          break;
        case 'sentry':
          this.sentryStep(e, dt);
          boxW = 1.05; boxH = 1.15; cy = 0.6;
          break;
        case 'spinner':
          this.spinnerStep(e, dt);
          boxW = e.state === 'out' ? 2.1 : 0.8; cy = 0.55;
          break;
      }
      e.box.setFromCenterAndSize(
        new THREE.Vector3(e.group.position.x, e.group.position.y + cy, e.group.position.z),
        new THREE.Vector3(boxW, boxH, boxW),
      );
    }
  }

  // BULL: amble → spot you in its lane → rear back (telegraph) → DASH (invincible,
  // touch-kill) → overshoot into a dizzy recover (safe to hit) → amble again.
  private chargerStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    const along = this.enemyAlong(e);
    const pAlong = this.playerAlong(e);
    const gap = pAlong - along; // +/- ahead along the lane
    const inLane = Math.abs(this.playerCross(e) - e.cross) < 3.6;
    if (e.state === 'patrol') {
      e.body.rotation.x = 0; e.group.scale.setScalar(1);
      this.patrolStep(e, dt, 0.5);
      if (inLane && Math.abs(gap) > 2.5 && Math.abs(gap) < 26) {
        e.dir = Math.sign(gap) || 1;
        this.faceDir(e, e.dir);
        e.state = 'telegraph'; e.stateT = 0;
        sfx.play('woosh', 0.5, 0.7);
      }
    } else if (e.state === 'telegraph') {
      // rear back and shudder
      e.body.rotation.x = -0.35;
      e.group.scale.setScalar(1 + Math.sin(e.stateT * 40) * 0.06);
      if (e.stateT > 0.55) { e.state = 'dash'; e.stateT = 0; e.group.scale.setScalar(1); sfx.play('crunch', 0.7, 0.8); }
    } else if (e.state === 'dash') {
      e.spinKill = false; e.stompKill = false; e.meleeKill = false; // nothing stops a charge
      e.body.rotation.x = 0.3;
      const key = e.axis === 'z' ? 'z' : 'x';
      e.group.position[key] += e.dir * e.speed * 3.4 * dt;
      const hitBound = e.group.position[key] >= e.x1 || e.group.position[key] <= e.x0;
      e.group.position[key] = THREE.MathUtils.clamp(e.group.position[key], e.x0, e.x1);
      if (hitBound || e.stateT > 1.3) { e.state = 'recover'; e.stateT = 0; sfx.play('crunch', 0.6, 1.1); }
    } else { // recover: dizzy, harmless, wide open
      e.touchHurt = false;
      e.body.rotation.x = 0;
      e.group.rotation.z = Math.sin(e.stateT * 18) * 0.18;
      if (e.stateT > 1.1) { e.group.rotation.z = 0; e.state = 'patrol'; e.stateT = 0; }
    }
  }

  // FROG: crouches, then leaps in a forward arc. While airborne the stomp misses
  // (your feet pass under it) — spin it out of the air, or wait for the landing.
  private hopperStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    const key = e.axis === 'z' ? 'z' : 'x';
    if (e.state === 'crouch') {
      e.body.scale.set(1.15, 0.7, 1.0); e.body.position.y = 0.36;
      if (e.stateT > 0.45) {
        e.state = 'leap'; e.stateT = 0; e.vy = 8.6;
        e.body.scale.set(0.9, 1.2, 0.95); e.body.position.y = 0.5;
        sfx.play('woosh3', 0.4, 1.3);
      }
    } else {
      // airborne arc
      e.vy -= 24 * dt;
      e.group.position.y += e.vy * dt;
      e.group.position[key] += e.dir * e.speed * dt;
      if (e.group.position[key] > e.x1) { e.group.position[key] = e.x1; e.dir = -1; }
      else if (e.group.position[key] < e.x0) { e.group.position[key] = e.x0; e.dir = 1; }
      this.faceDir(e, e.dir);
      if (e.group.position.y <= e.baseY && e.vy < 0) {
        e.group.position.y = e.baseY; e.vy = 0;
        e.state = 'crouch'; e.stateT = 0;
        e.body.scale.set(1.15, 0.85, 1.0); e.body.position.y = 0.46;
        sfx.play('crunch', 0.4, 1.4);
      }
    }
    e.stompKill = e.group.position.y <= e.baseY + 0.06; // only squashable on the ground
  }

  // DRONE: hovers above stomp range, drifts its lane, and periodically swoops at
  // the deck. Too high to jump on — spin it (a jump-spin) to bring it down.
  private floaterStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    const hoverH = 1.65;
    this.patrolStep(e, dt);
    const rotor = e.group.getObjectByName('rotor');
    if (rotor) rotor.rotation.z += dt * 12;
    if (e.state === 'hover') {
      e.group.position.y = e.baseY + hoverH + Math.sin(this.time * 3 + e.cross) * 0.18;
      const near = Math.abs(this.playerAlong(e) - this.enemyAlong(e)) < 12 && Math.abs(this.playerCross(e) - e.cross) < 6;
      if (e.stateT > 2.6 && near) { e.state = 'swoop'; e.stateT = 0; sfx.play('woosh2', 0.5, 0.8); }
    } else {
      // dip toward the deck and rise back over ~0.8s
      const k = Math.sin(Math.min(1, e.stateT / 0.8) * Math.PI);
      e.group.position.y = e.baseY + hoverH - k * (hoverH - 0.35);
      if (e.stateT > 0.8) { e.state = 'hover'; e.stateT = 0; }
    }
  }

  // TURRET: rooted, tracks you, and fires a slow orb on a track→charge→fire→cool
  // cycle. The body itself dies to anything — the danger is the shot.
  private sentryStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    const head = e.body;
    const dx = this.playerPos.x - e.group.position.x;
    const dz = this.playerPos.z - e.group.position.z;
    const targetYaw = Math.atan2(dx, dz);
    // ease the head toward the player
    let dy = targetYaw - head.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    head.rotation.y += dy * Math.min(1, dt * 6);
    const eye = head.getObjectByName('eye');
    const inRange = Math.hypot(dx, dz) < 44;
    if (e.state === 'track') {
      if (eye) eye.scale.setScalar(1);
      if (e.stateT > 1.3 && inRange) { e.state = 'charge'; e.stateT = 0; }
    } else if (e.state === 'charge') {
      if (eye) eye.scale.setScalar(1 + e.stateT * 2.4);
      if (e.stateT > 0.55) {
        e.state = 'fire'; e.stateT = 0;
        const muzzle = new THREE.Vector3(
          e.group.position.x + Math.sin(head.rotation.y) * 0.8,
          e.group.position.y + 0.72,
          e.group.position.z + Math.cos(head.rotation.y) * 0.8,
        );
        this.spawnProjectile(muzzle, new THREE.Vector3(this.playerPos.x, this.playerPos.y + 0.7, this.playerPos.z));
      }
    } else if (e.state === 'fire') {
      if (eye) eye.scale.setScalar(1);
      if (e.stateT > 0.15) { e.state = 'cooldown'; e.stateT = 0; }
    } else {
      if (e.stateT > 0.7) { e.state = 'track'; e.stateT = 0; }
    }
  }

  // SAWBLADE: blades telescope OUT (spinning, untouchable, touch-kill) then IN
  // (retracted, dead-still window where any attack finishes it). Pure timing.
  private spinnerStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    if (e.state === 'out') {
      e.body.rotation.y += dt * 9;
      e.spinKill = false; e.stompKill = false; e.meleeKill = false; e.touchHurt = true;
      if (e.stateT > 2.2) { e.state = 'in'; e.stateT = 0; sfx.play('woosh', 0.4, 1.6); }
    } else {
      e.body.rotation.y += dt * 1.5;
      e.touchHurt = false; // retracted: safe to brush, wide open to any hit
      if (e.stateT > 1.35) { e.state = 'out'; e.stateT = 0; sfx.play('woosh2', 0.4, 0.7); }
    }
    // lerp the blades over the first 0.2s of a state change for a mechanical feel
    const cur = e.state === 'out' ? Math.min(1, 0.2 + e.stateT * 4) : Math.max(0.2, 1 - e.stateT * 4);
    e.group.traverse((o) => { if (o.name === 'blade') o.scale.x = cur; });
  }

  private spawnProjectile(from: THREE.Vector3, target: THREE.Vector3): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6a3a }),
    );
    mesh.position.copy(from);
    this.root.add(mesh);
    const dir = target.clone().sub(from);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize().multiplyScalar(15);
    this.projectiles.push({ mesh, vel: dir, life: 3.4, box: new THREE.Box3() });
    sfx.play('woosh2', 0.55, 1.5);
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.mesh.rotation.x += dt * 6;
      pr.mesh.rotation.y += dt * 4;
      pr.box.setFromCenterAndSize(pr.mesh.position, new THREE.Vector3(0.7, 0.7, 0.7));
      if (pr.life <= 0 || pr.mesh.position.y < this.killY - 4) {
        this.root.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  // Clear every in-flight sentry orb (respawn / level switch).
  private clearProjectiles(): void {
    for (const pr of this.projectiles) this.root.remove(pr.mesh);
    this.projectiles.length = 0;
  }

  // Remove a single orb by index (the player caught it — see player collision).
  popProjectile(index: number): void {
    const pr = this.projectiles[index];
    if (!pr) return;
    this.root.remove(pr.mesh);
    this.projectiles.splice(index, 1);
  }

  // Floating collectable wumpa.
  private pickup(x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(
      Level.pickupGeo,
      new THREE.MeshLambertMaterial({ color: 0xff9028, emissive: 0x4a2006 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.baseY = y;
    this.root.add(mesh);
    this.pickups.push({
      mesh,
      alive: true,
      box: new THREE.Box3().setFromCenterAndSize(
        mesh.position.clone(),
        new THREE.Vector3(1.2, 1.5, 1.2),
      ),
    });
  }

  private fruitRow(z0: number, z1: number, y: number, n: number, x = 0): void {
    for (let i = 0; i < n; i++) {
      this.pickup(x, y, THREE.MathUtils.lerp(z0, z1, n === 1 ? 0 : i / (n - 1)));
    }
  }

  // A distinct blue box that sits on the deck like a normal crate. Spin or
  // stomp it (bumping is a wall) to bank the checkpoint; its trigger matches
  // the box, so it can be dodged rather than being an unmissable gate.
  private checkpoint(deckY: number, z: number, x = 0): void {
    const size = 0.96; // same footprint as every other crate now
    const gy = this.floorY(x, z, deckY);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x123049, map: this.cpTexture() }),
    );
    mesh.position.set(x, gy + size / 2, z);
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.checkpoints.push({
      mesh,
      box,
      active: false,
      spawnPos: new THREE.Vector3(x, gy + 0.1, z),
      savedAlive: [],
      savedPending: [],
      savedBangUsed: [],
      savedCratesBroken: 0,
      savedFruit: 0,
      savedMasks: 0,
      savedPoints: 0,
    });
  }

  // Level 4, "The Gauntlet": everything the toolkit can do in one long run —
  // jungle approach, terraced climb with a scaffold-rail bypass, a high ridge
  // with real gaps, a kicker launch, a halfpipe alley, a right-angle turn
  // across floating ruins, a downhill slalom, a rail canyon, a crate maze,
  // vine bridges, and a rolling-stone finale. Roughly 1.5x the Test Course.
  private buildGauntlet(asContinuation = false): void {
    // asContinuation: spliced onto the end of another course (the combined
    // Test+Gauntlet level), so skip the behind-spawn wall that would otherwise
    // block the seam you skate in through.
    // Terracotta canyon dusk: scrub greens against warm clay rock.
    this.wallTint = 0xa86048;
    this.blockTint = 0xb07050;
    this.curbTint = 0xe89a4a;
    this.bermTint = 0x6a5a34;
    const matSand = new THREE.MeshLambertMaterial({ color: 0xd8b276 });
    const matJungle = new THREE.MeshLambertMaterial({ color: 0x71a048 });
    const matJungle2 = new THREE.MeshLambertMaterial({ color: 0x62933f });
    const matStone = new THREE.MeshLambertMaterial({ color: 0xa87a5c });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0xba8a56 });
    const matPlat = new THREE.MeshLambertMaterial({ color: 0xb09a6e });
    const matWood = new THREE.MeshLambertMaterial({ color: 0xa87848 });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0xc9a86a });

    this.killY = -34;
    this.finishZ = -1200;
    this.endWallZ = -1212;
    this.theme = {
      skyTop: '#4a1c22',
      skyBottom: '#ffa060',
      sunColorHex: '#ffd890',
      sunU: 0.72,
      sunV: 0.3,
      stars: false,
      fog: 0xc06a40, // canyon dust — distance goes to warm terracotta
      fogNear: 25,
      fogFar: 155,
      hemiSky: 0xf0b088,
      hemiGround: 0x50241a,
      hemiI: 1.0,
      sunColor: 0xffb868,
      sunI: 1.5,
      particleColor: 0xffd0a0,
      particleWind: [1.1, -0.5, 0.3],
    };

    // river far below everything
    this.pitPlane('water', -44, 70, -620, 1900);

    // --- A: walled start + jungle approach ---------------------------------
    this.slab('start', 14, -30, 0, 20, matSand, false, 0, 'sand');
    if (!asContinuation) this.wall(0, 15, 22, 1, 0, 5, 0.7); // behind spawn: low curb, full-height collider
    this.wall(-10.5, -8, 1, 46, 0);
    this.wall(10.5, -8, 1, 46, 0);
    this.crate(3, 0, -12);
    this.crate(4.5, 0, -12);
    this.crate(3.75, 1.2, -12); // little pyramid
    this.crate(-4, 0, -20, 'mask');
    this.fruitRow(-6, -24, 1.3, 5, -1);
    this.jungle('approach A', -30, -95, 0, 12, matJungle, { dips: [-60] });
    this.log(1.5, 5.5, 0, -70);
    this.crate(-3, 0, -48);
    this.crate(2, 0, -82, 'mystery');
    this.enemy(-3.5, 3.5, 0, -55, 5, 'x', 'spiker');
    this.enemy(-4, 4, 0, -85, 6, 'x', 'hopper');
    this.jungle('approach B', -95, -150, 0, 12, matJungle2, { dips: [-130] });
    for (let i = 0; i < 8; i++) this.crate(-4.6 + i * 1.3, 0, -115); // crate fence
    this.crate(4.8, 0, -115, 'tnt'); // pop the fence from the flank
    this.stone(-3, 0, -100, -145, 6);
    this.crate(-4, 0, -140, 'bouncy');
    this.checkpoint(0, -143);

    // --- B: terraced climb (0 -> +9) with a scaffold-rail bypass ------------
    this.ramp('terrace ramp 1', -150, 0, -175, 3, 12, matRamp);
    this.jungle('terrace 1', -175, -215, 3, 12, matJungle);
    this.crate(0, 3, -190);
    this.crate(0, 4.2, -190); // stack
    this.crate(-4.5, 3, -205, 'nitro');
    this.log(2, 5.8, 3, -183);
    this.enemy(-4, 4, 3, -198, 6, 'x', 'turtle');
    this.ramp('terrace ramp 2', -215, 3, -240, 6, 12, matRamp);
    this.jungle('terrace 2', -240, -280, 6, 12, matJungle2, { dips: [-262] });
    this.crate(2.6, 6, -256);
    this.crate(3.9, 6, -256, 'tnt');
    this.crate(5.2, 6, -256);
    this.crate(-5, 6, -268, 'mask');
    this.enemy(-4, 4, 6, -250, 5, 'x', 'floater');
    this.enemy(-3.5, 3.5, 6, -270, 7, 'x', 'grunt');
    this.checkpoint(6, -276);
    this.ramp('terrace ramp 3', -280, 6, -300, 9, 10, matRamp);
    const scaffold = new Rail([
      new THREE.Vector3(5, 1.4, -152),
      new THREE.Vector3(5, 4.6, -215),
      new THREE.Vector3(5, 7.6, -280),
      new THREE.Vector3(5, 10.4, -302),
    ]);
    this.rails.push(scaffold);
    this.root.add(scaffold.object);

    // --- C: high ridge with two gaps and a bypass rail ----------------------
    this.jungle('ridge A', -300, -347, 9, 11, matJungle);
    this.checkpoint(9, -308);
    this.crate(-3, 9, -320);
    this.crate(-3, 10.2, -320); // stack
    this.fruitRow(-315, -338, 10.3, 5);
    // gap: -347 .. -355 (rebalanced)
    this.jungle('ridge B', -355, -400, 9, 11, matJungle2, { dips: [-380] });
    this.stone(3.2, 9, -362, -396, 8);
    this.crate(-4, 9, -370, 'mystery');
    this.log(-5.4, -2, 9, -388);
    const bypass = new Rail([new THREE.Vector3(-4, 10.2, -396), new THREE.Vector3(-4, 10.4, -421)]);
    this.rails.push(bypass);
    this.root.add(bypass.object);
    // gap: -400 .. -416 (long: carry speed, grind the bypass line, or trust
    // the crumble pads — they won't hold long)
    this.crumblePad(1.5, 9, -404, 4, 4.6);
    this.crumblePad(-1.5, 9, -410.5, 4, 4.6);
    this.jungle('ridge C', -416, -450, 9, 11, matJungle);
    this.enemy(-4, 4, 9, -432, 7, 'x', 'charger');
    this.crate(4.5, 9, -440, 'mask');
    this.crate(-2, 9, -425);
    this.crate(2, 9, -425);
    this.checkpoint(9, -445, -3.5);

    // --- D: kicker launch off the ridge, 8 units down to the pipe deck ------
    this.ramp('ridge kicker', -450, 9, -460, 11, 10, matRamp);
    // flight gap: -460 .. -470 (rebalanced — kicker + 8u drop still clears it)
    this.fruitRow(-464, -469, 13.5, 3);
    this.jungle('drop landing', -470, -540, 3, 13, matJungle2, { dips: [-518] });
    this.crate(-5, 3, -500, 'mystery');
    this.crate(5, 3, -520, 'bouncy');
    this.stepBlock(5, -527, 4, 6, 3, 8.2);
    this.crate(5, 8.2, -527, 'mask'); // bounce up for it
    this.enemy(-4, 4, 3, -510, 6, 'x', 'spinner');
    this.checkpoint(3, -534, -4);
    // elevator up to a lookout shelf — drop onto the halfpipe lip from it
    this.mover(-5, 8.5, -528, 3.4, 3.4, 'y', 4.6, 0.55);
    this.slab('lookout', -534, -539, 13, 5, matPlat, false, -5, 'stone');
    this.crate(-5, 13, -537, 'mystery');
    this.fruitRow(-535, -538, 14.3, 2, -5);

    // --- E: open alley (was a faceted "halfpipe" — removed; the good halfpipe
    // is the dedicated one back on the beach stretch) ------------------------
    const hpBase = 3;
    this.slab('gauntlet alley', -540, -595, hpBase, 22, matStone, true, 0, 'stone');
    this.crate(-2.2, hpBase, -560, 'bouncy');
    this.crate(2.2, hpBase, -575);
    this.crystal(0, hpBase + 0.4, -567); // pipe-alley centre: ride through it
    this.pickup(-7, hpBase + 3.4, -555);
    this.pickup(7, hpBase + 3.4, -580);
    this.slab('pipe exit', -595, -615, hpBase, 14, matStone, true, 0, 'stone');

    // --- F: the turn — floating ruins running east ---------------------------
    this.slab('corner east', -615, -635, 3, 20, matPlat, false, 4, 'stone');
    this.wall(4, -636.5, 20, 1.5, 3);
    this.wall(-6.5, -625, 1.5, 20, 3);
    this.zones.push({ xMin: 9, xMax: 141, zMin: -635, zMax: -615, dir: 'E' });
    const CZ = -625;
    this.slabX('ruin walk', 13, 36, 3, 9, matPlat, CZ);
    this.crate(24, 3, CZ);
    this.crate(24, 4.2, CZ); // stack
    this.fruitRowX(15, 33, 4.3, 5, CZ);
    this.slabX('ruin pad A', 44, 56, 4.5, 9, matPlat, CZ);
    this.crate(50, 4.5, CZ, 'tnt');
    this.slabX('ruin pad B', 62, 74, 6, 9, matPlat, CZ);
    this.crate(64, 6, CZ, 'mystery');
    this.checkpoint(6, CZ, 69);
    const pitRail = new Rail([new THREE.Vector3(74, 6.9, CZ), new THREE.Vector3(100, 6.3, CZ)]);
    this.rails.push(pitRail);
    this.root.add(pitRail.object);
    this.fruitRowX(78, 96, 8.2, 5, CZ);
    this.mover(84, 5.4, CZ, 6, 7, 'x', 6, 0.55); // ferry pad under the rail
    this.slabX('ruin shelf', 100, 118, 6, 9, matJungle, CZ);
    this.crate(108, 6, CZ, 'nitro');
    this.enemy(103, 115, 6, CZ, 5, 'x', 'sentry');
    // split: bounce up to the high fruit ledge, or run the TNT low road
    this.crate(117, 6, CZ, 'bouncy');
    this.slabX('high ledge', 120, 134, 10.5, 9, matPlat, CZ);
    this.crate(127, 10.5, CZ, 'mask');
    this.fruitRowX(122, 132, 11.8, 5, CZ);
    this.slabX('low road', 120, 134, 5.4, 9, matStone, CZ);
    this.crate(126, 5.4, CZ, 'tnt');
    this.crate(131, 5.4, CZ, 'tnt');
    this.slabX('rejoin', 136, 141.5, 6, 9, matPlat, CZ);

    // --- G: corner back south, then the downhill slalom ----------------------
    this.slab('corner south', -615, -635, 6, 20, matPlat, false, 152, 'stone');
    this.wall(162.5, -625, 1.5, 20, 6);
    this.wall(152, -613.5, 20, 1.5, 6);
    const dhY = (z: number): number => THREE.MathUtils.mapLinear(z, -635, -705, 6, -4);
    this.ramp('gauntlet downhill', -635, 6, -705, -4, 12, matRamp, 152);
    this.crate(149, dhY(-655), -655);
    this.crate(155, dhY(-668), -668);
    this.crate(149.5, dhY(-681), -681, 'nitro');
    this.crate(154.5, dhY(-692), -692, 'nitro');
    this.fruitRow(-648, -662, dhY(-655) + 1.3, 4, 152);
    this.fruitRow(-676, -690, dhY(-683) + 1.3, 4, 152);
    this.jungle('runout', -705, -760, -4, 12, matJungle, { dips: [-730] }, 152);
    // twin crushers guard the runout, alternating: read the rhythm, pick a side
    this.crusher(149.3, -4, -718, 5.6, 3, 3.4, 0);
    this.crusher(154.7, -4, -736, 5.6, 3, 3.4, 1.7);
    this.crate(152, -4, -748);
    this.crate(152, -2.8, -748); // stack
    this.enemy(148, 156, -4, -752, 6, 'x', 'hopper');
    this.checkpoint(-4, -757, 152);

    // --- H: rail canyon — S-curve line left, rail-hop chain right ------------
    this.slab('canyon ledge', -760, -775, -4, 14, matStone, true, 152, 'stone');
    // pit: -775 .. -860
    const sCurve = new Rail([
      new THREE.Vector3(149, -3, -772),
      new THREE.Vector3(147, -2.2, -800),
      new THREE.Vector3(151.5, -2.6, -830),
      new THREE.Vector3(149.5, -3.4, -858),
    ]);
    const chainA = new Rail([
      new THREE.Vector3(155.5, -3, -772),
      new THREE.Vector3(155.5, -3.4, -814),
    ]);
    const chainB = new Rail([
      new THREE.Vector3(158, -3.1, -822),
      new THREE.Vector3(158, -3.6, -858),
    ]);
    for (const r of [sCurve, chainA, chainB]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    this.crate(155.5, -2.6, -795); // smash it or get knocked into the pit
    this.crate(149.5, -2.9, -850, 'mask'); // floats at grind height on the S-curve
    this.fruitRow(-782, -808, -1.4, 4, 147.5);
    this.fruitRow(-826, -852, -1.8, 4, 158);
    this.slab('canyon landing', -860, -885, -4, 14, matStone, true, 152, 'stone');
    this.berms(-860, -885, -4, 14, 152);
    // ARENA: land off the rails and the gates slam shut — two waves to clear
    this.buildArena(152, -4, -861, -884, 14);
    this.checkpoint(-4, -890, 152);

    // --- I: crate maze --------------------------------------------------------
    this.slab('crate maze', -885, -960, -4, 18, matSand, false, 152, 'sand');
    this.wall(142.9, -922.5, 1.2, 75, -4);
    this.wall(161.1, -922.5, 1.2, 75, -4);
    // row 1: pass on the right (or spin the TNT)
    for (let i = 0; i < 9; i++) this.crate(144 + i * 1.3, -4, -900, i === 3 ? 'tnt' : undefined);
    this.crate(159, -4, -895, 'mystery');
    this.enemy(155.5, 160, -4, -907, 4, 'x', 'spiker');
    // row 2: pass on the left (nitro in the wall — no spinning through blind)
    for (let i = 0; i < 9; i++) this.crate(149.7 + i * 1.3, -4, -915, i === 5 ? 'nitro' : undefined);
    this.enemy(144, 148.5, -4, -922, 4, 'x', 'turtle');
    // row 3: full width — bounce over it, or blow the TNT posts
    this.crate(152, -4, -925, 'bouncy');
    for (let i = 0; i < 14; i++) {
      this.crate(143.6 + i * 1.3, -4, -930, i === 4 || i === 9 ? 'tnt' : undefined);
    }
    this.crate(145, -4, -940, 'mystery');
    this.crate(152, -4, -950, 'mask');
    this.fruitRow(-892, -898, -2.7, 3, 158);
    this.fruitRow(-908, -914, -2.7, 3, 145.5);
    this.checkpoint(-4, -955, 152);

    // --- J: vine bridges — pick a lane over the long pit ----------------------
    // left is broken mid-span, center is mined, right is logged. Edges grind.
    // pit: -960 .. -1050
    this.slab('bridge left A', -960, -998, -4, 3.2, matWood, true, 146.5, 'wood');
    this.slab('bridge left B', -1010, -1050, -4, 3.2, matWood, true, 146.5, 'wood');
    // center bridge: planks that collapse in a wave behind you once you
    // commit past the trigger — sprint, don't sightsee
    const planks: Crumble[] = [];
    for (let i = 0; i < 12; i++) {
      planks.push(this.crumblePad(152, -4, -963.7 - i * 7.5, 3.2, 7.3, null));
    }
    this.collapse = {
      planks,
      xMin: 149.6,
      xMax: 154.4,
      triggerZ: -974,
      endZ: -1050,
      startZ: -958,
      frontZ: -958,
      speed: 15,
      active: false,
    };
    this.slab('bridge right', -960, -1050, -4, 3.2, matWood, true, 157.5, 'wood');
    this.log(155.9, 159.1, -4, -980);
    this.log(155.9, 159.1, -4, -1022);
    this.fruitRow(-966, -1044, -2.7, 8, 146.5);
    this.fruitRow(-970, -1040, -2.7, 6, 157.5);
    this.slab('bridge landing', -1050, -1075, -4, 14, matStone, true, 152, 'stone');
    this.checkpoint(-4, -1070, 152);

    // --- K: stone gauntlet + finish -------------------------------------------
    this.jungle('gauntlet A', -1075, -1133, -4, 11, matJungle2, { dips: [-1102] }, 152);
    this.stone(149.5, -4, -1080, -1102, 10);
    this.stone(154.5, -4, -1080, -1102, 13);
    // twin pendulum blades close out the stretch, out of phase
    this.pendulum(152, 2.0, -1112, 4.6, 1.15, 1.8);
    this.pendulum(152, 2.0, -1122, 4.6, 1.15, 1.5, Math.PI);
    // gap: -1133 .. -1139 (rebalanced)
    this.jungle('gauntlet B', -1139, -1185, -4, 11, matJungle, {}, 152);
    this.enemy(148.5, 155.5, -4, -1160, 7, 'x', 'charger');
    this.enemy(149, 155, -4, -1175, 9, 'x', 'floater');
    this.fruitRow(-1148, -1180, -2.6, 6, 152);
    this.slab('finish run', -1185, -1215, -4, 14, matFinish, true, 152, 'stone');
    this.finishGate(-4, this.finishZ, 152);
    this.endWall(-4, 152);

    // --- dressing: hardy palms + succulents on the fringes (visual only) ---
    this.palm(-13, 0, 2, 4.6, 0.18);
    this.palm(13.5, 0, -6, 5.2, -0.12);
    this.palm(-8.2, 0, -58, 4.4, 0.1);
    this.palm(8.4, 0, -104, 4.8, -0.08);
    this.palm(-8.2, 3, -196, 4.3, 0.12);
    this.palm(8.2, 6, -252, 4.9, -0.1);
    this.palm(-8, 9, -318, 4.4, 0.1);
    this.palm(8, 9, -430, 4.6, -0.12);
    this.broadleaf(-4.9, 0, -40, 1.1, 'succulent', 0x9ab060);
    this.broadleaf(4.9, 0, -92, 1.0, 'succulent', 0x9ab060);
    this.broadleaf(-4.9, 3, -180, 1.2, 'succulent', 0x9ab060);
    this.broadleaf(4.9, 6, -246, 1.0, 'succulent', 0x9ab060);
    this.broadleaf(-4.8, 9, -312, 1.1, 'succulent', 0x9ab060);
    this.broadleaf(4.8, 3, -488, 1.2, 'succulent', 0x9ab060);
    this.fern(-5.9, 3, -498, 1.1);
    this.fern(4.9, 0, -68, 1.2);
    this.rock(-8.4, 0, -20, 1.7);
    this.rock(13, 0, -14, 1.3);
    this.flowers(-4.4, 0, -32);
    // crate-maze rim + finish
    this.palm(140.4, -4, -898, 4.7, 0.1);
    this.palm(163.6, -4, -912, 5.1, -0.1);
    this.palm(140.6, -4, -934, 4.4, 0.08);
    this.palm(163.4, -4, -948, 4.9, -0.08);
    this.rock(140.8, -4, -952, 1.5);
    this.palm(146.4, -4, -1206, 4.8, 0.1);
    this.palm(157.6, -4, -1209, 5.2, -0.1);
    this.broadleaf(147, -4, -1191, 1.1, 'succulent', 0x9ab060);
    this.flowers(157, -4, -1192);
  }

  // Arena lock: two gates and two waves of critters on an enclosed deck.
  // Trigger zone sits well inside the gates so nobody gets pinched at entry.
  private buildArena(cx: number, deckY: number, zNear: number, zFar: number, width: number): void {
    const gates: { mesh: THREE.Mesh; upY: number; downY: number; box: THREE.Box3 }[] = [];
    for (const gz of [zNear, zFar]) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 3.6, 1),
        this.patterned(new THREE.MeshLambertMaterial({ color: 0x8a6034 }), width, 3.6, 'wood'),
      );
      const upY = deckY + 1.7;
      const downY = deckY - 2.7;
      mesh.position.set(cx, downY, gz);
      this.root.add(mesh);
      gates.push({
        mesh,
        upY,
        downY,
        box: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(cx, deckY + 1.8, gz),
          new THREE.Vector3(width, 4.2, 1.3),
        ),
      });
    }
    // each wave leans on a different foe so the fight escalates in skill demand
    const waveKinds: EnemyKind[] = ['grunt', 'spiker', 'turtle', 'charger', 'hopper'];
    const mkWave = (idx: number, defs: [number, number, number, number][]): Enemy[] =>
      defs.map(([x0, x1, z, speed], i) => {
        // one odd foe per wave keeps you honest (mix a floater/spinner in)
        const kind = i === 0 && idx >= 2 ? (idx % 2 ? 'floater' : 'spinner') : waveKinds[idx % waveKinds.length];
        this.enemy(x0, x1, deckY, z, speed, 'x', kind);
        const e = this.enemies[this.enemies.length - 1];
        e.arenaWave = idx;
        e.alive = false;
        e.group.visible = false;
        return e;
      });
    const zm = (zNear + zFar) / 2;
    this.arena = {
      zone: new THREE.Box3(
        new THREE.Vector3(cx - width / 2, deckY - 2, zFar + 5),
        new THREE.Vector3(cx + width / 2, deckY + 4, zNear - 5),
      ),
      state: 'idle',
      wave: 0,
      waveT: 0,
      cycleT: 0,
      up: false,
      waves: [
        mkWave(0, [
          [cx - 5, cx + 5, zm + 4, 6],
          [cx - 4, cx + 4, zm - 5, 5],
        ]),
        mkWave(1, [
          [cx - 5, cx + 5, zm + 6, 8],
          [cx - 5, cx + 5, zm, 7],
          [cx - 4, cx + 4, zm - 6, 9],
        ]),
      ],
      gates,
    };
  }

  // Level 6, "The Flats": a gigantic featureless slab for movement testing.
  // No gaps, no hazards, no finish — walls only at the far perimeter, so
  // there is nothing to fall off. Marker posts along the axes give bearings.
  private buildFlats(): void {
    // Tropical resort noon over an endless blacktop lot: high sun, turquoise
    // horizon haze, parking-bay stripes to give the eye a texel scale.
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // asphalt is full-colour
    this.killY = -60;
    this.finishZ = -200; // gate past the rail garden: the lot's time-trial line
    this.endWallZ = -2100;
    this.theme = {
      skyTop: '#159ecd',
      skyBottom: '#c9f0e4',
      sunColorHex: '#fff8dc',
      sunU: 0.68,
      sunV: 0.14,
      stars: false,
      fog: 0xbee8dd, // turquoise haze
      fogNear: 70,
      fogFar: 320,
      hemiSky: 0xeafcff,
      hemiGround: 0x94a294,
      hemiI: 1.2,
      sunColor: 0xfff6dc,
      sunI: 1.55,
      particleColor: 0xffffff,
      particleWind: [0.5, -0.3, 0.2],
    };
    this.slab('the flats', 2100, -2100, 0, 4200, mat, false, 0, 'asphalt');
    // perimeter walls, two kilometres out in every direction
    this.wall(0, 2098, 4200, 4, 0, 8);
    this.wall(0, -2098, 4200, 4, 0, 8);
    this.wall(2098, 0, 4, 4200, 0, 8);
    this.wall(-2098, 0, 4, 4200, 0, 8);
    // --- wallride walls: tall faces just west of spawn. Skate at one, ollie (X)
    // and HOLD GRIND (E) to stick and ride along it, jump to kick off. Two
    // parallel walls let you transfer wall-to-wall. Doubled height (10) so the
    // wallie pop has room to climb the face.
    this.wall(-16, 0, 1.2, 70, 0, 10);
    this.wall(-32, 0, 1.2, 70, 0, 10);
    // a cross wall to the NE, for wallriding along the other axis
    this.wall(26, 28, 48, 1.2, 0, 10);
    // bearing markers along both axes (visual only — nothing to bump into)
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a6470 });
    for (let d = 50; d <= 400; d += 50) {
      const h = 2 + d / 100;
      for (const [x, z] of [
        [d, 0],
        [-d, 0],
        [0, d],
        [0, -d],
      ]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), postMat);
        post.position.set(x, h / 2, z);
        this.root.add(post);
      }
    }

    // --- rail garden: practice lines just south of spawn -------------------
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    // flat starter rail (0.9 above the deck: crates on the line DO clip a
    // grinder, same as the Test Course rail yard)
    const flatRail = new Rail([V(5, 0.9, -25), V(5, 0.9, -85)]);
    // sloped rail: grind it up to a high dismount (or bomb it back down)
    const slopeRail = new Rail([V(12, 0.9, -25), V(12, 6.5, -95)]);
    // three staggered parallel rails — hop rail-to-rail without touching down
    const parA = new Rail([V(-6, 0.9, -25), V(-6, 0.9, -110)]);
    const parB = new Rail([V(-10, 0.9, -40), V(-10, 0.9, -125)]);
    const parC = new Rail([V(-14, 0.9, -55), V(-14, 0.9, -140)]);
    for (const r of [flatRail, slopeRail, parA, parB, parC]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    // crates in the lanes between the parallel rails (smash practice)
    for (let z = -48; z >= -108; z -= 12) {
      this.crate(-8, 0, z);
      this.crate(-12, 0, z + 6);
    }
    // crates ON the center rail line: plain ones punish slow grinds, the
    // mask crate always pops (grind-through reward)
    this.crate(-10, 0, -70);
    this.crate(-10, 0, -100, 'mask');
    // arrow crates with their classic floating fruit crate above
    this.crate(9, 0, -40, 'bouncy');
    this.crate(-2, 0, -60, 'bouncy');
    // a TNT and a nitro for blast testing, well apart
    this.crate(16, 0, -60, 'tnt');
    this.crate(20, 0, -75, 'nitro');
    this.crystal(0, 0.4, -45); // test crystal between the lanes

    // --- ramp staircase: seven ramps of increasing steepness ---------------
    // grades 0.15 (8.5 deg) up to 1.9 (62 deg): walk, roll, and pump tests.
    const matRampF = new THREE.MeshLambertMaterial({ color: 0xaab4ba }); // skatepark concrete
    const grades = [0.15, 0.3, 0.5, 0.75, 1.0, 1.4, 1.9];
    for (let i = 0; i < grades.length; i++) {
      const x = 38 + i * 12;
      const len = 8;
      this.ramp(`test ramp ${i + 1}`, -40, 0, -40 - len, grades[i] * len, 5, matRampF, x, 'pavement');
    }

    // --- dressing: resort avenues, well clear of every test lane -----------
    // (nothing within 30u of the rail garden / ramp block: x -20..115, z 0..-160)
    for (let i = 0; i < 6; i++) {
      const z = 45 - i * 62;
      this.palm(-78, 0, z, 5 + (i % 3) * 0.6, i % 2 === 0 ? 0.12 : -0.1);
      this.palm(150, 0, z - 20, 5.3 - (i % 2) * 0.5, i % 2 === 0 ? -0.1 : 0.12);
    }
    for (let i = 0; i < 5; i++) {
      this.palm(-60 + i * 45, 0, 64, 4.8 + (i % 2) * 0.7, 0.1 - (i % 3) * 0.08);
    }
    // --- foe sampler: one of each takedown, lined up down the centre lane past
    // the trick lanes (rail garden/ramps sit at x -20..115, z 0..-160) --------
    this.enemy(-6, 6, 0, -166, 4, 'x', 'grunt');
    this.enemy(-6, 6, 0, -172, 4, 'x', 'spiker'); // spin
    this.enemy(-6, 6, 0, -178, 3, 'x', 'turtle'); // stomp
    this.enemy(-12, 12, 0, -184, 5, 'x', 'charger'); // bull runway
    this.enemy(-6, 6, 0, -190, 4, 'x', 'hopper');
    this.enemy(-8, 8, 0, -196, 3.5, 'x', 'floater');
    this.enemy(0, 0, 0, -175, 0, 'x', 'sentry'); // turret watching the lane
    this.enemy(0, 0, 0, -187, 0, 'x', 'spinner');
    // finish gate: a straight sprint down the lot past the rail garden
    this.finishGate(0, this.finishZ);
    // planter islands
    for (const [ix, iz] of [[-78, -400], [150, -400], [-140, 70]] as const) {
      this.rock(ix, 0, iz, 2.2);
      this.palm(ix + 2.5, 0, iz + 2, 5.8, -0.12);
      this.fern(ix - 2.2, 0, iz - 1.5, 1.3);
      this.fern(ix + 1.8, 0, iz - 2.6, 1.1);
      this.flowers(ix - 1.5, 0, iz + 2.2);
      this.planter(ix + 4, 0, iz - 1);
    }
  }

  // HALF PIPES: a flats-style blacktop with nothing but transition. Two
  // halfpipes sit right up against each other (a shared coping ridge — a "W"
  // you can pump one side and drop the other), then a neighbouring pair rotated
  // 90° so you can transfer between the two orientations.
  private buildHalfpipePark(): void {
    const ground = new THREE.MeshLambertMaterial({ color: 0xffffff }); // full-colour asphalt
    const matPipe = new THREE.MeshLambertMaterial({ color: 0xaab4ba }); // skatepark concrete
    this.killY = -60;
    this.finishZ = -110; // gate at the park's south end, past both pipe pairs
    this.endWallZ = -2100;
    this.theme = {
      skyTop: '#159ecd',
      skyBottom: '#c9f0e4',
      sunColorHex: '#fff8dc',
      sunU: 0.68,
      sunV: 0.14,
      stars: false,
      fog: 0xbee8dd,
      fogNear: 80,
      fogFar: 340,
      hemiSky: 0xeafcff,
      hemiGround: 0x94a294,
      hemiI: 1.2,
      sunColor: 0xfff6dc,
      sunI: 1.55,
      particleColor: 0xffffff,
      particleWind: [0.5, -0.3, 0.2],
    };
    this.spawnPos.set(0, 0.1, 32);
    this.currentSpawn.copy(this.spawnPos);

    // The whole lot is one flat slab at y=0; the pipe troughs ARE this floor and
    // the transition walls climb up out of it.
    this.slab('park floor', 60, -120, 0, 130, ground, false, 0, 'asphalt');
    this.wall(0, 58, 130, 4, 0, 6); // perimeter
    this.wall(0, -118, 130, 4, 0, 6);
    this.wall(64, -30, 4, 180, 0, 6);
    this.wall(-64, -30, 4, 180, 0, 6);

    const F = 3;
    const R = 6; // lipX = 9, coping at y = 6, each pipe 18 wide
    const lipX = F + R;
    const lipY = R;
    const addPipe = (l0: number, l1: number, cross: number, axis: 'z' | 'x'): Halfpipe => {
      const hp = new Halfpipe(l0, l1, 0, F, R, matPipe, cross, axis);
      this.halfpipes.push(hp);
      this.root.add(hp.object);
      for (const w of hp.walls) this.groundMeshes.push(w); // SOLID transitions
      return hp;
    };
    const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
    const copingRail = (a: THREE.Vector3, b: THREE.Vector3): void => {
      const r = new Rail([a, b]);
      this.rails.push(r);
      this.root.add(r.object);
    };

    // --- PAIR 1: two pipes running along Z, right up against each other -------
    // A centred at x -9, B at x +9 → their inner copings meet at x 0 (a shared
    // ridge). Troughs at x -9 and x +9, length z 20 → -20.
    addPipe(20, -20, -9, 'z');
    addPipe(20, -20, 9, 'z');
    for (const x of [-9 - lipX, 0, 9 + lipX]) copingRail(V(x, lipY + 0.05, 20), V(x, lipY + 0.05, -20));
    // fruit lines down each trough, a crystal on the shared ridge
    for (const cx of [-9, 9]) for (let z = 14; z >= -14; z -= 7) this.pickup(cx, 0.4, z);
    this.crystal(0, lipY + 0.6, 0);

    // --- PAIR 2: two more pipes rotated 90° (running along X), neighbouring ----
    // C centred at z -38, D at z -56 → shared ridge at z -47. Length x -18 → 18.
    addPipe(18, -18, -38, 'x');
    addPipe(18, -18, -56, 'x');
    // outer copings at -29 and -65, shared ridge at -47 (the old signs put
    // all three rails ON the ridge and left the outer lips bare)
    for (const z of [-38 + lipX, -47, -56 - lipX]) copingRail(V(-18, lipY + 0.05, z), V(18, lipY + 0.05, z));
    for (const cz of [-38, -56]) for (let x = -14; x <= 14; x += 7) this.pickup(x, 0.4, cz);

    // --- a few foes on the SIDE flats, clear of the spawn sprint + the pipe
    // runs (pipes sit within |x|<18; spawn is dead-centre) ------------------
    this.enemy(26, 44, 0, -10, 4, 'x', 'grunt'); // patrols the east flat
    this.enemy(-44, -26, 0, -30, 3.5, 'x', 'floater'); // drifts the west flat
    this.enemy(38, 38, 0, -47, 0, 'x', 'spinner'); // blades parked off the ridge

    this.finishGate(0, this.finishZ); // run the pipes, cross the line at the south wall
  }

  // SKY BRIDGE: a long, narrow plank bridge strung across an open sky with rope
  // handrails running BOTH sides most of the way. Precision platforming — slick
  // planks, planks that drop the instant you land (or a beat later), patrolling
  // foes — and the twist: those side ropes are grindable, but they sag, wobble,
  // and snap after a few seconds, so grinding the rail is a gamble. One misstep
  // is a long way down.
  private buildSkyBridge(): void {
    this.killY = -22; // off the bridge = a fatal drop into the clouds
    this.finishZ = -127; // gate on the goal deck
    this.endWallZ = -400;
    this.theme = {
      skyTop: '#8fbfe6',
      skyBottom: '#f2f6f8',
      sunColorHex: '#fff4d8',
      sunU: 0.6,
      sunV: 0.2,
      stars: false,
      fog: 0xeef4f8, // the void below is bright cloud haze
      fogNear: 40,
      fogFar: 210,
      hemiSky: 0xdff0ff,
      hemiGround: 0xb9c6cf,
      hemiI: 1.25,
      sunColor: 0xfff2d4,
      sunI: 1.5,
      particleColor: 0xffffff,
      particleWind: [0.3, -0.15, 0.25],
    };
    const woodCol = 0xb98a52;
    const iceCol = 0x9fc7de;
    // A fixed board footprint keeps the bridge cramped: the deck is barely
    // wider than Crash, so a slippy carry or a sloppy jump goes over the side.
    const W = 2.6;
    const plank = (z: number, d = 2, slippy = false, w = W): THREE.Mesh => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.5, d),
        this.patterned(new THREE.MeshLambertMaterial({ color: slippy ? iceCol : woodCol }), w, d, 'wood'),
      );
      mesh.position.set(0, -0.25, z);
      mesh.name = slippy ? 'slippy plank' : 'plank';
      if (slippy) mesh.userData.slippy = true;
      this.root.add(mesh);
      this.groundMeshes.push(mesh);
      return mesh;
    };
    const breakOnLand = (z: number, d = 2): void => void this.crumblePad(0, 0, z, W, d, null, 0.02, 0xcf6a48);
    const breakSoon = (z: number, d = 2): void => void this.crumblePad(0, 0, z, W, d, null, 0.7, 0xd0a24a);

    // --- start deck ---------------------------------------------------------
    plank(3, 9, false, 7); // wide safe landing to launch from
    this.spawnPos.set(0, 0.1, 4);
    this.currentSpawn.copy(this.spawnPos);

    // --- section A: warm-up hops, then slick planks -------------------------
    plank(-4);
    plank(-8);
    // gap
    plank(-14, 2, true); // slippy trio: carry bleeds slow, so stop short or slide off
    plank(-17.5, 2, true);
    plank(-21, 2, true);
    this.pickup(0, 1.2, -17.5);

    // --- section B: drop planks ---------------------------------------------
    plank(-27); // safe breather
    breakOnLand(-31); // land + it's already gone — keep moving
    breakOnLand(-34.5);
    plank(-39); // safe landing
    this.checkpoint(0, -39); // first checkpoint

    // --- section C: enemy on a wide deck ------------------------------------
    plank(-45, 5, false, 5); // wide enough to dodge on
    this.enemy(-2, 2, 0, -45, 3.2, 'x', 'floater');
    plank(-51);
    breakSoon(-55); // stand a beat, then it drops
    breakSoon(-58.5);

    // --- section D: stepping-stone hops (grind the side ropes for a fast line)
    plank(-63);
    plank(-68, 1.6);
    plank(-73, 1.6);
    plank(-78, 1.6);
    plank(-82, 3, false, 4); // landing deck
    this.pickup(0, 1.2, -73);
    this.checkpoint(0, -82);

    // --- section E: everything at once --------------------------------------
    plank(-88, 2, true); // slippy launch
    breakOnLand(-92);
    plank(-96, 5, false, 5);
    this.enemy(-2, 2, 0, -96, 4, 'x', 'spiker');
    breakSoon(-101);
    plank(-105, 2, true);
    plank(-110, 1.6);
    breakSoon(-115);
    plank(-120, 1.6);

    // --- goal deck ----------------------------------------------------------
    plank(-125, 8, false, 7);
    this.pickup(0, 1.2, -125);
    this.crystal(0, 0.6, -125);
    this.finishGate(0, this.finishZ);

    // --- SIDE ROPES: grindable handrails running the whole span, both sides.
    // Segmented so each snaps on its own; they sag + wobble under a grinder and
    // break after a few seconds — the safe-looking rail is a gamble.
    const ropeY = 1.0;
    const ropeX = W / 2 + 0.5; // just outside the deck edge
    // Longer segments (~24u) so a grinder is on ONE rope long enough for the
    // ~3s snap to bite — linger and it drops you; zip across fast and you make it.
    const zEdges = [-2, -26, -50, -74, -98, -122];
    for (let s = 0; s < zEdges.length - 1; s++) {
      for (const rx of [-ropeX, ropeX]) {
        this.skyRope(rx, zEdges[s], rx, zEdges[s + 1], ropeY, 3.0, 1.15, 4);
      }
    }
  }

  private buildBoulderDash(): void {
    // Deep jungle under a lava sky: rich greens lit warm amber, so the
    // corridor reads lush even while everything behind you is on fire.
    const matJungle = new THREE.MeshLambertMaterial({ color: 0x4f9440 });
    const matJungle2 = new THREE.MeshLambertMaterial({ color: 0x5aa048 });
    const matSand = new THREE.MeshLambertMaterial({ color: 0xd2bc7e });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x6f9a50 });

    this.chaseCam = true;
    this.killY = -30;
    this.finishZ = 8;
    this.endWallZ = -470; // the far-end clamp doubles as the wall behind spawn
    this.spawnPos.set(0, 0.1, -448);
    this.currentSpawn.copy(this.spawnPos);
    this.theme = {
      skyTop: '#14322a',
      skyBottom: '#c85f28',
      sunColorHex: '#ff8a4a',
      sunU: 0.5,
      sunV: 0.42,
      stars: false,
      fog: 0x4c3c22, // amber-green murk under the canopy
      fogNear: 21,
      fogFar: 130,
      hemiSky: 0xd8b878, // warm amber sky light keeps the greens green
      hemiGround: 0x22381e,
      hemiI: 1.0,
      sunColor: 0xffa055,
      sunI: 1.25,
      particleColor: 0xff9a52,
      particleWind: [0.3, 1.4, 0.2], // rising embers
    };

    // the floor of the world is lava — very motivating
    this.pitPlane('lava', -40, 0, -220, 1200);

    // spawn deck — open behind, so you can SEE the thing waiting for you
    this.slab('chase start', -440, -458, 0, 14, matSand, false, 0, 'sand');
    this.wall(-7.5, -449, 1, 18, 0);
    this.wall(7.5, -449, 1, 18, 0);

    this.jungle('chase A', -377, -440, 0, 12, matJungle, { dips: [-410] });
    this.fruitRow(-434, -390, 1.3, 8);
    this.log(0.5, 5.5, 0, -396);
    this.crate(-4.5, 0, -420, 'nitro');
    // gap 1: -371 .. -377 (rebalanced — clearable mid-chase)
    this.jungle('chase B', -300, -371, 0, 12, matJungle2, { dips: [-330] });
    this.crate(-1.3, 0, -350, 'tnt');
    this.crate(1.3, 0, -350, 'tnt'); // swerve or hop the pair
    this.log(-5.5, -0.5, 0, -318);
    this.fruitRow(-362, -306, 1.3, 8);
    this.checkpoint(0, -308, -3.5);
    this.ramp('chase rise', -285, 2, -300, 0, 12, matRamp);
    this.jungle('chase C', -212, -285, 2, 12, matJungle, { dips: [-240] });
    this.crate(-3.2, 2, -260, 'nitro');
    this.crate(3.2, 2, -260, 'nitro'); // thread the middle
    this.crystal(0, 2.4, -250); // grab it WHILE fleeing — right up the middle
    this.log(-5.5, -1.5, 2, -228);
    this.fruitRow(-278, -222, 3.3, 8);
    // gap 2: -207 .. -212 (rebalanced)
    this.jungle('chase D', -130, -207, 2, 12, matJungle2, { dips: [-160] });
    this.crate(0, 2, -182, 'tnt');
    this.crate(-2.6, 2, -176, 'tnt');
    this.crate(2.6, 2, -170, 'tnt'); // staggered minefield: weave it
    this.enemy(-4, 4, 2, -150, 6, 'x', 'hopper');
    this.fruitRow(-198, -140, 3.3, 8);
    this.checkpoint(2, -138, 3.5);
    this.ramp('chase drop', -112, 0, -130, 2, 12, matRamp);
    this.jungle('chase E', -42, -112, 0, 13, matJungle, { dips: [-75] });
    this.log(0.5, 6, 0, -95);
    this.crate(-4.8, 0, -60, 'nitro');
    this.fruitRow(-106, -52, 1.3, 8);
    // the boulder pit: -35 .. -42 — you jump it; the boulder tips in
    this.slab('escape', 14, -35, 0, 14, matSand, true, 0, 'sand');
    this.wall(-7.5, -9, 1, 46, 0);
    this.wall(7.5, -9, 1, 46, 0);
    this.crate(-3, 0, -20, 'mask');
    this.crate(3, 0, -16, 'mystery');
    this.crate(0, 0, -24);
    this.fruitRow(-28, -12, 1.3, 5);
    this.finishGate(0, this.finishZ);
    // no end-wall mesh — the far clamp sits invisibly behind the spawn deck

    this.buildChaseBoulder(-487, -44);

    // --- dressing: jungle walls tight outside the 12u corridor (visual only,
    // x ±7.5 clears the ±6 deck edge) + canopy palms bowing over the lane ---
    const strips: [number, number, number][] = [
      [0, -388, -434],
      [0, -306, -366],
      [2, -218, -280],
      [2, -136, -202],
      [0, -48, -108],
    ];
    let k = 0;
    for (const [sy, zn, zf] of strips) {
      for (let z = zn; z >= zf; z -= 16) {
        const side = k % 2 === 0 ? 1 : -1;
        if (k % 3 === 2) this.broadleaf(side * 7.6, sy, z, 1.35);
        else this.fern(side * 7.5, sy, z, 1.45);
        if (k % 4 === 1) this.fern(-side * 7.7, sy, z - 5, 1.25);
        k++;
      }
    }
    this.palm(7.9, 0, -400, 7.4, 0.45);
    this.palm(-7.9, 0, -330, 7.2, -0.45);
    this.palm(7.9, 2, -250, 7.6, 0.42);
    this.palm(-7.9, 2, -168, 7.3, -0.42);
    this.palm(7.9, 0, -84, 7.5, 0.44);
    this.palm(-7.9, 0, -60, 7.1, -0.4);
    // escape deck: the beach you were sprinting for
    this.palm(-6.4, 0, -1, 5.4, 0.1);
    this.palm(6.4, 0, -3, 5.8, -0.1);
    this.flowers(-6.4, 0, -28);
    this.fern(6.6, 0, -30, 1.2);
  }

  // The chase boulder: a boulder-sized Stone that rolls +Z after the player.
  private buildChaseBoulder(startZ: number, endZ: number): void {
    const r = 4.3;
    const geo = new THREE.SphereGeometry(r, 16, 12);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const lump = 1 + 0.07 * Math.sin(v.x * 2.1) * Math.sin(v.y * 2.7 + 1.3) * Math.sin(v.z * 1.9 + 2.6);
      v.multiplyScalar(lump);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.baseMat('boulder', 0x8a7660, 'dirt', 3, 2));
    this.root.add(mesh);
    const st: Stone = {
      mesh,
      box: new THREE.Box3(),
      x: 0,
      z0: startZ,
      z1: startZ,
      dir: 1,
      speed: 25,
      r,
      chase: true,
    };
    this.stones.push(st);
    // Ground profile sampled once at build time; gaps carry the last height,
    // so the big fella rolls right over them.
    const h0 = startZ - 12;
    const hStep = 3;
    const heights: number[] = [];
    let prev = 0;
    for (let z = h0; z <= 20; z += hStep) {
      prev = this.floorY(0, z, prev);
      heights.push(prev);
    }
    this.boulder = {
      st,
      active: false,
      falling: false,
      fallV: 0,
      endZ,
      triggerZ: this.spawnPos.z + 5,
      h0,
      hStep,
      heights,
    };
    mesh.position.set(0, this.boulderGroundY(startZ) + r * 0.92, startZ);
  }

  private boulderGroundY(z: number): number {
    const b = this.boulder;
    if (!b) return 0;
    const t = (z - b.h0) / b.hStep;
    const i = Math.max(0, Math.min(b.heights.length - 2, Math.floor(t)));
    const f = Math.max(0, Math.min(1, t - i));
    return b.heights[i] * (1 - f) + b.heights[i + 1] * f;
  }

  // Crude seedless random course: flats with random furniture, gaps, slopes,
  // rails over pits, kickers, step blocks — and the camera occasionally
  // swings sideways for a stretch. Re-select "Random" to reroll.
  // ---- THE SLIPSTREAM: an endless-waterslide skyway — one huge ribbon of
  // banked, sweeping, mostly-downhill road curving high over open water.
  // The deck is real curved geometry (a spline-swept ribbon in groundMeshes),
  // so the ordinary surface-tangent riding does all the work: dips feed
  // speed, crests pop airs, and the raised gutter lips carve like a slide.
  // frame(t, off, h): a world point `off` across the banked deck and `h`
  // above it — the exact surface the ribbon mesh was extruded from.
  private slideRibbon(
    pts: THREE.Vector3[],
    width = 12,
    color = 0x3ec8d8,
    bankFn?: (t: number, auto: number) => number, // override the lean (vert walls, corkscrews)
  ): SlideRibbon {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
    const len = curve.getLength();
    const steps = Math.max(24, Math.round(len / 1.6));
    const UP = new THREE.Vector3(0, 1, 0);
    // The banked deck frame at parameter t: a point `off` across the deck and
    // `h` above it, leaned by the same bank the mesh gets — the ONE source of
    // truth, so edge rails and crates sit exactly on the surface they follow.
    const frame = (t: number, off: number, h: number): THREE.Vector3 => {
      const p = curve.getPointAt(t);
      const tanA = curve.getTangentAt(t);
      // signed turn rate ahead of this ring -> bank INTO the curve
      const tanB = curve.getTangentAt(Math.min(1, t + 0.02));
      const turn = Math.atan2(tanA.x * tanB.z - tanA.z * tanB.x, tanA.x * tanB.x + tanA.z * tanB.z);
      const auto = THREE.MathUtils.clamp(turn * 7, -0.28, 0.28); // a lean, not a wall
      const bank = bankFn ? bankFn(t, auto) : auto;
      const right = new THREE.Vector3().crossVectors(tanA, UP);
      if (right.lengthSq() < 1e-5) right.set(1, 0, 0);
      right.normalize();
      const upv = new THREE.Vector3().crossVectors(right, tanA).normalize();
      return p
        .addScaledVector(right.applyAxisAngle(tanA, bank), off)
        .addScaledVector(upv.applyAxisAngle(tanA, bank), h);
    };
    // gutter profile across the deck: raised lips keep the flow in the slide
    const prof: Array<[number, number]> = [
      [-width / 2, 1.25],
      [-width / 2 + 2.4, 0],
      [width / 2 - 2.4, 0],
      [width / 2, 1.25],
    ];
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      for (const [off, h] of prof) {
        const v = frame(t, off, h);
        pos.push(v.x, v.y, v.z);
        uv.push((off / width + 0.5) * 1.5, (t * len) / 9);
      }
      if (i > 0) {
        const a = (i - 1) * 4;
        const b = i * 4;
        for (let q = 0; q < 3; q++) {
          idx.push(a + q, a + q + 1, b + q, a + q + 1, b + q + 1, b + q);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      this.patterned(new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }), 10, 10, 'stone'),
    );
    mesh.name = 'slipstream';
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    return { curve, len, width, frame };
  }

  // fruit strung along a stretch of ribbon, floating just over the deck line
  private ribbonFruit(curve: THREE.CatmullRomCurve3, t0: number, t1: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = curve.getPointAt(THREE.MathUtils.lerp(t0, t1, n === 1 ? 0 : i / (n - 1)));
      this.pickup(p.x, p.y + 1.3, p.z);
    }
  }

  private buildSlipstream(): void {
    this.allBalanceCrates = true; // one long combo line: every crate = balance
    this.theme = {
      skyTop: '#1d6fb8',
      skyBottom: '#bfeef4', // bright noon haze over open water
      sunColorHex: '#fff6d8',
      sunU: 0.68,
      sunV: 0.24,
      stars: false,
      fog: 0xa8dfeb,
      fogNear: 60,
      fogFar: 260,
      hemiSky: 0xbfe8f2,
      hemiGround: 0x2a6a80,
      hemiI: 1.05,
      sunColor: 0xfff2c8,
      sunI: 1.1,
      particleColor: 0xffffff, // spray motes drifting off the slide
      particleWind: [0.5, 0.1, 0.3],
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    // start plateau: a wide launch deck way up in the sky
    this.slab('launch deck', 26, -6, 150, 16, new THREE.MeshLambertMaterial({ color: 0x7fb6c4 }), true, 0, 'stone');
    this.spawnPos.set(0, 150.1, 18);
    this.currentSpawn.copy(this.spawnPos);

    // R1 — the opening mega-drop: a huge sweeping S out to x=55 and back
    const r1 = this.slideRibbon([
      V(0, 150, -4),
      V(0, 146, -30),
      V(24, 138, -64),
      V(52, 128, -104),
      V(55, 122, -140),
      V(30, 114, -172),
      V(-10, 108, -206),
      V(-32, 104, -232),
    ], 13);
    this.ribbonFruit(r1.curve, 0.12, 0.4, 8);
    this.ribbonFruit(r1.curve, 0.6, 0.86, 7);
    this.crate(52, 128.6, -110);
    this.crate(55, 122.4, -136, 'mystery');
    this.crate(30, 114.5, -172, 'tnt');

    // R2 — THE CORKSCREW: a full 270° clockwise spiral, dropping the whole
    // way round, then unwinding east into the course line again
    const CX = -30;
    const CZ = -300;
    const CR = 26;
    const spiralPts: THREE.Vector3[] = [V(-25, 105, -224)]; // starts ON R1's tail (true overlap, no seam crack)
    for (let k = 0; k <= 6; k++) {
      const th = (-k * 45 * Math.PI) / 180; // 0 .. -270°, clockwise from the east point
      spiralPts.push(V(CX + CR * Math.cos(th), 98 - k * 3.2, CZ + CR * Math.sin(th)));
    }
    spiralPts.push(V(-2, 76, -278), V(16, 72, -306));
    const r2 = this.slideRibbon(spiralPts, 12, 0x3ec8d8, (_t, auto) =>
      THREE.MathUtils.clamp(auto * 2.4, -0.55, 0.55),
    );
    this.ribbonFruit(r2.curve, 0.2, 0.75, 10);
    this.crystal(CX, 90.5, CZ - CR); // parked mid-spiral: hold the high line round to it
    this.checkpoint(72.9, -310, 20);

    // R3 — THE VERT WALL: a hard right turn ridden up a near-vertical bank,
    // velodrome style — the deck rolls to ~60° through the apex
    const r3 = this.slideRibbon([
      V(12, 73, -299), // starts ON the spiral's unwind (true overlap)
      V(12, 67, -348),
      V(-4, 64, -368),
      V(-28, 62, -378),
      V(-52, 61, -380),
    ], 13, 0x46b8d0, (t, auto) => {
      const peak = Math.exp(-(((t - 0.55) / 0.22) ** 2));
      return THREE.MathUtils.clamp(auto + 1.05 * peak, -1.1, 1.1);
    });
    this.ribbonFruit(r3.curve, 0.3, 0.8, 6);

    // R4 — unwind left and bomb a long wide S back down-course, with a crest
    // air and a grind line down the middle
    const r4 = this.slideRibbon([
      V(-44, 62, -379), // starts ON the vert wall's exit (true overlap)
      V(-94, 55, -394),
      V(-100, 51, -420),
      V(-94, 47, -450),
      V(-80, 43, -480),
      V(-56, 38, -514),
      V(-30, 35, -548), // crest bump
      V(-14, 31, -584),
      V(-10, 29, -612),
    ], 14);
    this.ribbonFruit(r4.curve, 0.15, 0.5, 9);
    this.crate(-80, 43.6, -480);
    this.crate(-63, 38.9, -518, 'nitro'); // off the racing line — a hazard for sloppy lines, not an ambush
    this.checkpoint(29.8, -612, -15);

    // R5 — THE RUN-UP: a straight, steep bomb into an up-kicked launch lip.
    // The gap past it is sized for full speed AND a jump — one or the other
    // alone drops you in the water.
    const r5 = this.slideRibbon([
      V(-11, 30, -604), // starts ON R4's tail — the ONLY real gap is past the lip
      V(-6, 21, -662),
      V(0, 11, -696),
      V(4, 5.5, -722),
      V(6, 7.5, -738), // the lip kicks up
    ], 12);
    this.ribbonFruit(r5.curve, 0.2, 0.7, 6);

    // rope swing over the gap, WEST of the racing line: the flight line stays
    // honest (speed + jump), but a leap toward the rope opens a slower, showier
    // crossing — catch, ride the arc, release onto the landing
    this.ropeSwing(-3, 19, -747, 9.5, 0.8, 0, 0, 90);

    // THE GAP: ~20 units of open water, then the landing ribbon
    const r6 = this.slideRibbon([
      V(7, 0.8, -756),
      V(6, 0.4, -790),
      V(2, 0.2, -816),
    ], 14);

    // THE WEAVE: alternating edge rails all the way down the course — grind
    // one, pop off, manual across the deck, catch the next on the other side.
    // A crate trio seeds every crossing (the combo dress turns a third of
    // them into balance windows), so the whole run reads as one combo line.
    const edgeRail = (r: SlideRibbon, t0: number, t1: number, side: -1 | 1): void => {
      const off = side * (r.width / 2 - 2.5); // just inside the gutter lip
      const n = Math.max(2, Math.round(((t1 - t0) * r.len) / 6));
      const rpts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) rpts.push(r.frame(THREE.MathUtils.lerp(t0, t1, i / n), off, 0.72));
      const rail = new Rail(rpts);
      this.rails.push(rail);
      this.root.add(rail.object);
    };
    const crossCrates = (r: SlideRibbon, t: number): void => {
      // flank the line, never block it: cruise speed (12) is BELOW smash
      // speed (12.5), so a crate on the centerline is a wall for anyone slow.
      // Banked spots get no crates at all — a leaned deck drifts slow riders
      // onto the flanks, and a crate there shoves them over the gutter.
      const lo = r.frame(t, -2.1, 0);
      const hi = r.frame(t, 2.1, 0);
      if (Math.abs(hi.y - lo.y) > 1.0) return; // ~14°+ of lean: keep it clear
      for (const p of [lo, hi]) this.crate(p.x, p.y + 0.6, p.z);
    };
    // one crate on the FAR flank, level ground only — the manual line past a
    // grinding rider runs right through it
    const flankCrate = (r: SlideRibbon, t: number, off: number): void => {
      const lo = r.frame(t, -2.1, 0);
      const hi = r.frame(t, 2.1, 0);
      if (Math.abs(hi.y - lo.y) > 1.0) return;
      const p = r.frame(t, off, 0);
      this.crate(p.x, p.y + 0.6, p.z);
    };
    const weave = (r: SlideRibbon, first: -1 | 1, railLen: number, gap: number, t0: number, t1: number): -1 | 1 => {
      let side = first;
      let a = t0 * r.len; // arc-length cursor down the ribbon
      const end = t1 * r.len;
      while (a + railLen * 0.6 < end) {
        const b = Math.min(a + railLen, end);
        edgeRail(r, a / r.len, b / r.len, side);
        // opposite the rail's midpoint: a target you line up while grinding
        flankCrate(r, (a + b) / 2 / r.len, -side * 2.1);
        if (b + gap < end) {
          // two beats of crates through the crossing — smash line for the manual
          crossCrates(r, (b + gap * 0.33) / r.len);
          crossCrates(r, (b + gap * 0.67) / r.len);
        }
        a = b + gap;
        side = side === 1 ? -1 : 1;
      }
      return side; // hand the alternation to the next ribbon
    };
    let wside: -1 | 1 = 1;
    wside = weave(r1, wside, 42, 20, 0.05, 0.96);
    wside = weave(r2, wside, 34, 18, 0.08, 0.92); // corkscrew: shorter bites
    wside = weave(r3, wside, 30, 16, 0.06, 0.94); // one of these rides the vert wall
    wside = weave(r4, wside, 42, 20, 0.04, 0.96);
    wside = weave(r5, wside, 34, 18, 0.05, 0.8); // stops short of the lip — the gap stays honest
    weave(r6, wside, 30, 14, 0.12, 0.85); // last cash-out line into the finish

    // finish flat: run it out through the gate
    this.slab('finish run', -810, -874, 0.2, 18, new THREE.MeshLambertMaterial({ color: 0x7fb6c4 }), true, 0, 'stone');
    this.finishZ = -842;
    this.endWallZ = -868;
    this.finishGate(0.2, this.finishZ, 0);
    this.endWall(0.2, 0);

    this.killY = -26;
    this.pitPlane('water', -34, 0, -420, 2400);

    // CAMERA SPINE: the ribbons' own centerline is the camera lane — the rig
    // and the control frame ease along its tangent, so screen-up is always
    // "down the slide" and the road stays centered through every sweep (the
    // same machinery the editor's camnode chains drive).
    const lane: { x: number; z: number }[] = [{ x: 0, z: 20 }];
    for (const r of [r1, r2, r3, r4, r5, r6]) {
      const n = Math.max(2, Math.round(r.len / 7));
      for (let i = 0; i <= n; i++) {
        const p = r.curve.getPointAt(i / n);
        lane.push({ x: p.x, z: p.z });
      }
    }
    lane.push({ x: 0, z: -874 });
    this.lanePts = lane;
  }

  private buildRandom(): void {
    const mats = [0x87939a, 0x74838a, 0x7a99a0, 0x7f9884].map(
      (c) => new THREE.MeshLambertMaterial({ color: c }),
    );
    const mat = () => mats[Math.floor(Math.random() * mats.length)];
    // Jungle night: deep teal dark, moonlit decks, warm fireflies adrift.
    this.theme = {
      skyTop: '#0a2a34',
      skyBottom: '#1e6a5e',
      sunColorHex: '#c8f2dc', // low moon
      sunU: 0.25,
      sunV: 0.48,
      stars: true,
      fog: 0x16403e,
      fogNear: 24,
      fogFar: 132,
      hemiSky: 0x64b0a4,
      hemiGround: 0x18302a,
      hemiI: 1.0,
      sunColor: 0x9ae8cc,
      sunI: 1.15,
      particleColor: 0xffd86e, // fireflies
      particleWind: [0.3, 0.25, 0.2],
    };
    let z = 14;
    let y = 0;
    let minY = 0;
    let dist = 0;
    let lastGap = false;
    let cpDue = 170;
    let xc = 0; // course centerline: a sideways jog shifts everything after it
    let jogDone = false;
    this.slab('start', z, z - 30, y, 14, mat(), true, xc);
    z -= 30;
    while (dist < 800) {
      const roll = Math.random();
      if (!jogDone && !lastGap && dist > 150 && dist < 600 && roll < 0.12) {
        // SIDEWAYS JOG: the path right-angles east across floating pads, then
        // turns south again — the fixed camera sees the stretch side-on.
        const JOG = 70;
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + 3);
        this.wall(xc + 3, z - 17.5, 16, 1.5, y);
        this.zones.push({ xMin: xc + 9, xMax: xc + JOG - 9, zMin: z - 16, zMax: z, dir: 'E' });
        const cz = z - 8;
        for (let px = xc + 11; px + 9 <= xc + JOG - 8; px += 14) {
          this.slabX('side pad', px, px + 9, y, 9, mat(), cz);
          if (Math.random() < 0.4) this.crate(px + 4.5, y, cz);
          if (Math.random() < 0.5) this.fruitRowX(px + 2, px + 7, y + 1.3, 3, cz);
        }
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + JOG - 3);
        this.wall(xc + JOG + 6.5, z - 8, 1.5, 16, y);
        xc += JOG - 3;
        z -= 16;
        dist += 50;
        cpDue -= 16;
        lastGap = false;
        jogDone = true;
      } else if (roll < 0.34 || lastGap) {
        // flat deck with random furniture
        const len = 28 + Math.random() * 22;
        const w = 10 + Math.random() * 4;
        this.slab('deck', z, z - len, y, w, mat(), true, xc);
        if (!this.crystalPlaced && dist > 300) this.crystal(xc, y + 0.4, z - len * 0.5);
        const crates = Math.floor(Math.random() * 3);
        for (let i = 0; i < crates; i++) {
          this.crate(xc + Math.round(Math.random() * 8 - 4), y, z - 6 - Math.random() * (len - 12));
        }
        if (Math.random() < 0.5) {
          const roster: EnemyKind[] = ['grunt', 'spiker', 'turtle', 'charger', 'hopper', 'floater', 'sentry', 'spinner'];
          const foe = roster[Math.floor(Math.random() * roster.length)];
          this.enemy(xc - 3.5, xc + 3.5, y, z - len / 2, 3 + Math.random() * 5, 'x', foe);
        }
        if (Math.random() < 0.35) this.crate(xc + (Math.random() < 0.5 ? -4 : 4), y, z - len * 0.7, 'nitro');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -3 : 3), y, z - len * 0.4, 'tnt');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -2 : 2), y, z - len * 0.3, 'mask');
        if (Math.random() < 0.15) this.crate(xc + (Math.random() < 0.5 ? -3 : 3), y, z - len * 0.55, 'mystery');
        if (Math.random() < 0.25) this.fruitRow(z - 8, z - len + 8, y + 1.4, 4, xc);
        if (Math.random() < 0.3) {
          const bx = xc + (Math.random() < 0.5 ? -2.5 : 2.5);
          this.stepBlock(bx, z - len * 0.5, 4, 5, y, y + 2.2);
          this.crate(bx, y + 2.2, z - len * 0.5);
        }
        if (cpDue <= 0) {
          this.checkpoint(y, z - len + 6, xc);
          cpDue = 200 + Math.random() * 80;
        }
        z -= len;
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.49) {
        // gap over the void (rebalanced for the slower feel: 7-11u)
        const len = 7 + Math.random() * 4;
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.64) {
        // slope (downhill-biased)
        const len = 28 + Math.random() * 12;
        const dy = Math.random() < 0.65 ? -(3 + Math.random() * 5) : 2 + Math.random() * 2.5;
        this.ramp('slope', z, y, z - len, y + dy, 10, mat(), xc);
        z -= len;
        y += dy;
        minY = Math.min(minY, y);
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.82) {
        // rail over a pit (always follows solid ground)
        const len = 36 + Math.random() * 20;
        const rail = new Rail([
          new THREE.Vector3(xc, y + 0.9, z + 4),
          new THREE.Vector3(xc + Math.round(Math.random() * 5 - 2.5), y + 1.1, z - len / 2),
          new THREE.Vector3(xc, y + 0.9, z - len - 4),
        ]);
        this.rails.push(rail);
        this.root.add(rail.object);
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.9) {
        // flush temple stair over the void
        const t = this.stairClimb(z - 2, y, 4, xc);
        dist += z - t.endZ + 4;
        z = t.endZ - 4;
        y = t.topY;
        lastGap = true; // force a solid deck right after the top block
      } else {
        // kicker lip into a gap (rebalanced: 7-10u gap after the lip)
        this.ramp('kicker', z, y, z - 10, y + 2.4, 10, mat(), xc);
        z -= 10 + 7 + Math.random() * 3;
        dist += 20;
        minY = Math.min(minY, y);
        lastGap = true;
      }
    }
    if (lastGap) {
      this.slab('landing', z, z - 30, y, 12, mat(), true, xc);
      z -= 30;
    }
    this.slab('finish run', z, z - 45, y, 14, mat(), true, xc);
    if (!this.crystalPlaced) this.crystal(xc, y + 0.4, z - 10); // fallback: pre-gate
    this.finishZ = z - 30;
    this.endWallZ = z - 42;
    this.finishGate(y, this.finishZ, xc);
    this.endWall(y, xc);
    this.killY = minY - 26;
    this.pitPlane('void', minY - 34, 0, z / 2, 1400);
  }

  private endWall(deckY: number, cx = 0): void {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4, 1),
      this.baseMat('wall', this.wallTint, 'stone', 3, 1),
    );
    wall.position.set(cx, deckY + 2, this.endWallZ - 1);
    this.root.add(wall);
  }

  private finishGate(deckY: number, z: number, cx = 0, yawDeg = 0): void {
    this.gateSpec = { x: cx, y: deckY, z };
    this.gateYaw = yawDeg;
    const yawR = THREE.MathUtils.degToRad(yawDeg);
    // the trigger slab (14 across the posts, 2 through) turns with the gate;
    // its AABB is exact at the cardinal angles, a safe cover in between
    const hx = Math.abs(Math.cos(yawR)) * 7 + Math.abs(Math.sin(yawR)) * 1;
    const hz = Math.abs(Math.sin(yawR)) * 7 + Math.abs(Math.cos(yawR)) * 1;
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(cx, deckY + 15, z),
      new THREE.Vector3(hx * 2, 30, hz * 2),
    );
    // every piece hangs off one group in gate-local space, so yaw is one turn
    const gate = new THREE.Group();
    gate.position.set(cx, deckY, z);
    gate.rotation.y = yawR;
    this.root.add(gate);
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(side * 5.5, 3.5, 0);
      gate.add(post);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#20242c';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 1.2, 0.2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    banner.position.set(0, 6.4, 0);
    gate.add(banner);

    // Warp portal: the demoscene plasma plane hangs between the posts, framed
    // by a pulsing additive ring — Crash warp room meets iTunes visualizer.
    this.plasmaSetup();
    const portal = new THREE.Mesh(
      new THREE.PlaneGeometry(10.4, 5.4),
      new THREE.MeshBasicMaterial({
        map: this.plasmaTex!,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    portal.position.set(0, 3.1, -0.35);
    gate.add(portal);
    const ring = this.glowRing(0, 3.1, -0.25, 3.6, 0x66eaff, true);
    gate.add(ring); // re-parents out of root: the ring spins with the gate

    // Relic scoreboard: crystal + gem icons over the gate — dark ghosts until
    // earned, then they light up and spin (see setRelics).
    const iconMat = (): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({
        map: this.chromeTexture(),
        color: 0x2a2f3a,
        transparent: true,
        opacity: 0.4,
        flatShading: true,
      });
    const cIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iconMat());
    cIcon.scale.y = 1.5;
    cIcon.position.set(-1.7, 8.1, 0);
    gate.add(cIcon);
    this.gateCrystalIcon = cIcon;
    const gIcon = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iconMat());
    gIcon.scale.set(1.25, 0.7, 1.25);
    gIcon.position.set(1.7, 8.1, 0);
    gate.add(gIcon);
    this.gateGemIcon = gIcon;
    this.relics = { crystal: true, gem: true }; // force the ghost restyle below
    this.setRelics(false, false);
  }
}
