// Every level in the game, plus the toolkit they are all assembled from.
// Built-ins are hand-coded builders picked by id; user levels carry component
// data and build through the same pipeline the editor writes. Courses run
// along -Z: a corridor of decks, gaps, rails, crates and set pieces, with a
// finish gate at the far end.

import * as THREE from "three";
import { Rail } from "./rails";
import {
  PROP_SCALE,
  PropFamily,
  PropRoleName,
  propRoll,
  propVariant,
  propSurfaces,
  propTint,
} from "./props";
import { Halfpipe } from "./halfpipe";
import {
  createWarpPad,
  WarpPad,
  WARP_PAD_GLOW_RADIUS,
  WARP_PAD_GLOW_BASE,
  WARP_PAD_GLOW_TOP,
} from "./warpPad";
import { CONST, TUNING } from "./tuning";
import { sfx } from "./audio";
import { rooReady, rooLoaded } from "./roofont"; // crate stencils are set in Roo
import { puffs, PUFF_PRESETS } from "./puffs";
import { swirls, SWIRL_PRESETS } from "./swirls";
import { CoastWater, type ShoreSample } from "./water";

const CAR_AIM = new THREE.Vector3(); // carStep lookAt scratch
import { wumpaMesh, WUMPA_SIZE } from "./wumpa";

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
  fallVel?: number; // >0 while the crate is settling down a smashed stack
  nitroBang?: boolean; // green '!' crate: breaking it detonates every nitro on the map
  pending?: boolean; // OUTLINE state: ghost visual, no collision, no interactions — until a '!' fires
  wasOutline?: boolean; // authored as an outline: resets re-ghost it
  groupIds?: number[]; // editor group chain: wires '!' switches to their outlines
  realMat?: THREE.Material; // the true face (kept while ghosted)
  ghostMat?: THREE.Material; // the translucent shell (kept for resets)
  ghostEdges?: THREE.LineSegments; // outline wireframe, hidden on materialize
  timeSecs?: number; // TIME TRIAL: breaking this crate freezes the clock this many seconds
  boost?: "speed" | "balance"; // COMBO RUN: breaking this crate = a speed burst / a perfect-balance window
  ttOrigMap?: THREE.Texture | null; // the normal-mode face, restored when the trial ends
}

// Functionally distinct foes. Defeat rules and movement differ per kind —
// the level's update owns each FSM and publishes per-frame combat flags
// (spinKill/stompKill/...) that the player's collision simply reads.
export type EnemyKind =
  | "grunt" // baseline: patrols, any attack kills, touch hurts
  | "spiker" // SPIN-ONLY: spikes on top, stomping it hurts you
  | "turtle" // STOMP-ONLY: hard shell, a spin just recoils it
  | "charger" // bull: patrol → telegraph → dash (invincible) → recover
  | "hopper" // frog: leaps in arcs; stompable only while grounded
  | "floater" // drone: hovers above stomp range, swoops; spin it down
  | "sentry" // turret: stationary, tracks + fires slow orbs on a cycle
  | "spinner" // sawblade: blades OUT = untouchable touch-kill, IN = vulnerable
  | "car"; // oncoming traffic: follows the road ribbon, touch hurts, cannot be killed

export interface Enemy {
  group: THREE.Group;
  box: THREE.Box3;
  alive: boolean;
  x0: number; // patrol bounds — x for corridor levels, z for side-scroll levels
  x1: number;
  dir: number;
  speed: number;
  axis?: "x" | "z";
  // Spun enemies ping away ballistically and can smash what they hit.
  flungVel?: THREE.Vector3;
  flungT?: number;
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
/**
 * A corridor centreline: how far the path has drifted sideways and risen or
 * fallen by a given world z. One function drives the floor mesh, the kerbs
 * along it, the dressing on both banks and the camera lane, so they can never
 * disagree about where the path actually goes.
 */
type Spine = (wz: number) => { dx: number; dy: number };

interface SlideRibbon {
  len: number; // arc length of the spine
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
  torch?: Torch; // a brazier riding the deck — the mover IS a moving light in a dark level
}

// A CYCLE: the sine every moving thing in a dark level runs on. Shared by the
// travelling rails and the travelling rope anchors so "moves like that platform
// over there" is one set of numbers everywhere.
interface Cycle {
  base: THREE.Vector3;
  axisV: THREE.Vector3;
  amp: number;
  speed: number;
  phase: number;
}
function cycleOffset(c: Cycle, time: number): number {
  return Math.sin(time * c.speed + c.phase) * c.amp;
}

// FIRE. The light source of a dark level: a post, a bowl, and a flame that
// never stops moving. The flame meshes are UNLIT (basic material), so a torch
// reads as bright no matter how black the scene lighting is; the real
// illumination it throws comes from the shared light pool (see torchLights),
// which is a fixed set of point lights re-aimed at whichever torches are
// nearest the player. Fixed count = no per-frame shader recompiles.
const PUFF_TORCH = PUFF_PRESETS.torchSmoke;
const PUFF_TORCH_RATE: [number, number] = Array.isArray(PUFF_TORCH.rate)
  ? PUFF_TORCH.rate
  : [PUFF_TORCH.rate ?? 8, PUFF_TORCH.rate ?? 8];

interface Torch {
  group: THREE.Group; // post + bowl + flame, parked at the torch's base
  flames: THREE.Mesh[]; // the licking cones, scaled + spun on their own phase
  lightAt: THREE.Vector3; // world point the pooled light sits at (the flame's heart)
  seed: number; // per-torch offset so no two flicker in step
  burn: number; // 0..1 — eased; a phase pad's torch dies as the pad goes ghost
  wantBurn: number; // what it's easing TOWARD (1 lit, 0 out)
  smokeT: number; // countdown to this torch's next puff (its own irregular clock)
}

// A platform that FLIPS between real and not. Active: solid, lit, its torch
// burning. Inactive: a dark ghost you fall straight through. The flip is a
// membership change in groundMeshes — three.js raycasts do NOT skip invisible
// meshes, so hiding one would leave an invisible floor in mid-air.
interface PhasePad {
  mesh: THREE.Mesh;
  torches: Torch[];
  cycle: number; // seconds for one full on->off->on round
  phase: number; // 0..1 offset into that round
  duty: number; // share of the round spent SOLID (0.5 = half the time)
  on: boolean;
  litMat: THREE.Material;
  ghostMat: THREE.Material;
}

// A grind line that travels. Rail geometry (segment directions, lengths, arc
// length) is baked at construction and never recomputed, so the ONE motion
// that stays correct is a rigid translation: every node moves by the same
// delta, which leaves directions and lengths untouched. Rotating or stretching
// a rail would desync the grind from the bar.
interface MovingRail extends Cycle {
  rail: Rail;
  object: THREE.Group; // the visual, whose children are baked at world coords
}

// Crumble pad: stand on it and it shakes, drops away, and (maybe) regrows.
interface Crumble {
  mesh: THREE.Mesh;
  base: THREE.Vector3;
  state: "idle" | "shake" | "fall" | "gone";
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
  state: "idle" | "sag" | "break" | "gone";
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
  // Optional TRAVELLING anchor: the whole rope slides along a cycle, so a
  // swing can ferry you across a gap as well as across its own arc. Both
  // `anchor` and `pivot.position` are moved in lockstep — everything
  // downstream (grab, ride, jump-off) is computed off `anchor`.
  travel?: Cycle;
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
  // A Group, not a Mesh: the fruit is an authored model handed out by
  // src/wumpa.ts, which wraps it so the idle spin turns about its centre.
  mesh: THREE.Object3D;
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

// ---- CUSTOM LEVEL: a data-driven course the in-game editor builds ----------
// Every component maps onto an existing primitive. Positions are centers
// (except where noted); pits are simply where you DON'T put floor — anything
// falling below killY dies.
export interface CustomComponent {
  t:
    | "platform" // solid box: p = center, s = [w,h,d], yaw degrees, slip = icy
    | "ramp" // slope along Z (low end at +Z): p = center of the base line, len along z, rise = height gained, w = width, yaw
    | "wall" // solid barrier: p = base center, s = [w,h,d]; invisible = collider only (ghost in the editor)
    | "rail" // grind rail: p = center (at rail height), len, yaw degrees (0 = along Z). Give it amp/speed/axis and the whole line TRAVELS on that cycle — a grind that ferries you across a gap
    | "pipe" // LEGACY straight halfpipe (old saves) — migration folds it into 'vertramp'
    | "vertramp" // THE VERT PART: one swept transition profile that covers quarter pipes, half pipes, bowl corners, whole pools and banked slide troughs. Straight along `len`/`yaw`, or drawn along `pts` (rail node convention, plus an optional 5th number = bank degrees). rise = transition radius, w = flat half-width, arc = degrees round the transition, deck = platform past the lip, closed = loop the spine, curve picks filleted corners or a spline, bank auto-leans into turns. Faces carry userData.vert unless `vert` is false.
    | "crumble" // breakaway pad: p = top center, s = [w,-,d], shake = fall delay in seconds (0.02 = instant), speed = fall accel (default 30)
    | "pit" // death zone: touch = wipeout; p = center of the dark pool, s = [w,-,d]
    | "crate" // p = [x, deckY, z], kind picks the crate; outline = ghost until a '!' in its group is hit
    | "metal" // unbreakable steel crate: solid terrain, spin/slam-proof
    | "rock" // low-poly boulder: p = center, s = [w,h,d] bounds, seed shapes it; solid + walkable
    | "camnode" // camera-lane node: nodes chain in order into the lane the camera + controls steer along
    | "outline" // LEGACY ghost crate (old saves) — loads as a wood crate with outline: true
    | "checkpoint"
    | "enemy" // patrols along X around p, range each way
    | "crusher" // stomping block: p = [x, deckY, z], s = [w,-,d], cycle seconds, phase
    | "mover" // moving platform: p = [x, topY, z], s = [w,-,d], axis x/y/z, amp = travel each way, speed, phase
    | "torch" // fire on a bracket: p = base of the post, rise = post height, w = flame scale. THE light source in a dark level — it burns, flickers, throws embers and lights what's around it
    | "phasepad" // platform that FLIPS between solid+burning and ghost+dark: p = top center, s = [w,-,d], cycle = seconds for a full on/off round, phase offsets it, amp = the on-share of that round (0.5 = half lit). Runs a warning pulse before it goes
    | "stone" // rolling boulder: p = [x, floorY, z] (patrol center), range = half the travel along Z, speed, radius
    | "pendulum" // swinging bob: p = [x, pivotY, z], len arm, amp radians, speed
    | "ropeswing" // swinging grab-rope: p = [x, anchorY, z], len rope, amp radians, speed (0 = natural pendulum), phase, yaw = swing plane. `range` + `cycle` send the whole anchor TRAVELLING along `axis` — a swing that also ferries
    | "gate" // finish gate: crossing its plane ends the run; p = [x, deckY, z], yaw turns it with the course. One per level.
    | "clock" // time-trial activator: the gold stopwatch near the start; p = [x, deckY, z]. One per level.
    | "comboorb" // combo-run activator: the green plus near the start; p = [x, deckY, z]. One per level.
    | "zone" // travel zone: inside its rect the course runs dir 'E'/'W' (side-scroll) or 'N' (run AT the camera); p = center, s = [w,-,d]
    | "rope" // sagging grindable rope: p = center (rope height), len along yaw, amp = sag, shake = grind-seconds before it snaps
    | "terrain" // DISPLACED GROUND STRIP: a rolling, winding, bumpy floor. p = the near end (highest z), pts = centreline nodes in the rail convention ([dx, dz, corner radius, dy]) relative to p, w = width across, amp = bump height, berms = mossy kerbs + grindable lips down both sides. The one component that is not a flat box.
    | "decor" // scenery prop: p = base point, dkind picks it, w = scale, rise = height/length, amp = lean, yaw. Visual only, except the idol and the log, which are solid.
    | "wumpa"
    | "crystal"; // one per level (the editor enforces it)
  p: [number, number, number];
  s?: [number, number, number];
  slip?: boolean; // platform only: an icy/slick deck (friction cut, you can't stop short)
  len?: number;
  rise?: number;
  w?: number;
  yaw?: number;
  axis?: "z" | "x" | "y"; // mover: which way it slides ("y" = a lift)
  vkind?: "quarter" | "half"; // vertramp: one wall, or two facing each other with a flat between
  arc?: number; // vertramp: degrees round the transition (90 = vertical lip, ~60 = a crestable bowl wall)
  deck?: number; // vertramp: flat platform past the lip, with a skirt to the floor (0 = bare coping)
  closed?: boolean; // vertramp: loop the spine end to end — a rounded-rect path becomes a pool
  bank?: number; // vertramp: auto-lean into turns, in world units of curvature gain (0 = never lean)
  curve?: "corner" | "spline"; // vertramp: filleted corners (parks) or one flowing Catmull-Rom (slides)
  vert?: boolean; // vertramp: carry the vert surface flag (default true; false = an ordinary banked road)
  shake?: number;
  kind?:
    | "wood"
    | "bouncy"
    | "metalbounce"
    | "nitro"
    | "tnt"
    | "mask"
    | "mystery"
    | "bang"
    | "nitrobang";
  dkind?: DecorKind; // decor: which prop (see DECOR_KINDS)
  // The library families (tree/plants/boulder/rocks/trunk/slab) are one kind
  // holding many models: `vr` picks the model, `tn` picks the colour set. Both
  // wrap, so a stale index from an old save still draws something.
  vr?: number; // decor: which model within the family (see props.ts)
  tn?: number; // decor: which tint within the family

  lit?: boolean; // mover: carries a burning brazier (warm-iron deck, a moving light in the dark)
  berms?: boolean; // terrain: kerbs + grindable lips down both edges
  n?: number; // decor: strand/piece count (hanging vines)
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
  pts?: (
    | [number, number]
    | [number, number, number]
    | [number, number, number, number]
    | [number, number, number, number, number]
  )[];
  radius?: number; // camnode: lane corner radius · stone: the boulder's radius
  color?: string; // '#rrggbb' tint for platform / ramp / wall / crumble / rock
  tex?: string; // surface texture kind (see TEX_KINDS) for platform / ramp / wall / crumble / rock — tinted by color
  dir?: "E" | "W" | "N" | "S"; // zone: travel direction — E/W turn the course sideways (side-scroll), N runs it INTO the camera, S = the normal corridor (still overrides a camera lane)
  layer?: number; // LEGACY editor layer id (folded into lk by migration)
  grp?: number; // innermost editor group id — groups wire '!' crates to their outlines
  lk?: boolean; // editor lock: click-through, marquee-proof, edit-proof
  nm?: string; // editor display name (outliner rename)
}

// EDITOR BUILD MODE. Scenery batches into one mesh per shape for play, which
// is what keeps a jungle inside a phone's draw-call budget — but a batch has
// no per-plant object, so nothing in it can be clicked. The editor flips this
// on and rebuilds, trading the batching back for a pickable mesh per prop; on
// exit it flips off and rebuilds again. Set by main.ts, which can see both.
let EDITOR_BUILD = false;
export function setEditorBuild(on: boolean): boolean {
  const changed = EDITOR_BUILD !== on;
  EDITOR_BUILD = on;
  return changed;
}

// EVERY PIECE OF SCENERY IS A COMPONENT. Decor used to be drawn straight into
// the scene and recorded nowhere, so capturing a level threw all of it away —
// edit the jungle and the jungle vanished. These are the placeable props; the
// editor builds its FOLIAGE palette straight off this list, so a new one shows
// up in the add panel the moment it is added here and wired in decorProp().
export const DECOR_KINDS = [
  "fern",
  "broadleaf",
  "flowers",
  "toadstool",
  "toadstools",
  "mossrock",
  "jungletree",
  "palm",
  "vines",
  "planter",
  "idol",
  "ruinblock",
  "log",
  "block", // plain textured box, visual only: earth banks, backdrops, massing
  // THE LIBRARY FAMILIES. Six kinds backed by fifty-six external meshes (see
  // props.ts). Each one is a whole species rather than a single shape: pick a
  // model, a tint, a size, a spin and a lean and no two placings match.
  "tree",
  "plants",
  "boulder",
  "rocks",
  "trunk",
  "slab",
] as const;
export type DecorKind = (typeof DECOR_KINDS)[number];
/** Human labels for the palette + the props dropdown. */
export const DECOR_LABELS: Record<DecorKind, string> = {
  fern: "fern",
  broadleaf: "broadleaf",
  flowers: "flowers",
  toadstool: "toadstool",
  toadstools: "toadstool cluster",
  mossrock: "mossy rock",
  jungletree: "canopy tree",
  palm: "palm",
  vines: "hanging vines",
  planter: "planter",
  idol: "carved idol",
  ruinblock: "ruin block",
  log: "fallen log",
  block: "scenery block",
  tree: "tree (library)",
  plants: "plant (library)",
  boulder: "boulder (library)",
  rocks: "rocks (library)",
  trunk: "trunk (library)",
  slab: "temple slab (library)",
};

// Every paintable surface kind the texture system offers. The editor's
// texture dropdown is built from this list; 'checker' is the classic default.
export const TEX_KINDS = [
  "checker",
  "grass",
  "jungle",
  "moss",
  "dirt",
  "sand",
  "stone",
  "wood",
  "plank",
  "pavement",
  "asphalt",
  "metal",
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

// ---- TIME OF DAY ----------------------------------------------------------
// One authored knob that swings the whole atmosphere: which painted skybox is
// on the dome, what colour the world fades into, and how the lights are tinted
// and scaled. The three presets share the same painting geometry (the images
// are the same size with their horizon on the same row), so a switch is pure
// colour — see SKY_PRESETS in main.ts, which owns the actual values.
export const SKY_PRESETS = ["day", "sunset", "night", "coast"] as const;
export type SkyPreset = (typeof SKY_PRESETS)[number];
export const DEFAULT_SKY: SkyPreset = "sunset";
export function asSkyPreset(v: unknown): SkyPreset {
  return (SKY_PRESETS as readonly string[]).includes(v as string)
    ? (v as SkyPreset)
    : DEFAULT_SKY;
}

export interface CustomLevelData {
  v: 1;
  name: string;
  spawn: [number, number, number];
  killY: number;
  sky?: SkyPreset; // time of day; absent = sunset (what every level was before)
  components: CustomComponent[];
  layers?: CustomLayer[];
  groups?: CustomGroup[];
}

// the full ancestor chain of group ids for a component (innermost first)
export function groupChainOf(
  c: CustomComponent,
  data: CustomLevelData,
): number[] {
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
    if (c.t !== "platform") continue;
    if (!best || c.p[2] < best.p[2]) best = c;
  }
  if (!best)
    return {
      t: "gate",
      p: [d.spawn[0], Math.max(d.spawn[1] - 1, 0), d.spawn[2] - 12],
    };
  const top = best.p[1] + (best.s?.[1] ?? 1);
  // box decks: near the far (-z) edge; drawn blobs: their anchor point
  const gz = best.pts ? best.p[2] : best.p[2] - (best.s?.[2] ?? 8) / 2 + 2.5;
  return {
    t: "gate",
    p: [+best.p[0].toFixed(2), +top.toFixed(2), +gz.toFixed(2)],
  };
}

// LEGACY MIGRATION: t:'outline' predates outline-as-a-state; load it as a
// wood crate flagged outline so the new '!' wiring applies uniformly. Named
// layer containers fold into per-component locks (the outliner replaced them).
export function migrateCustomLevel(d: CustomLevelData): CustomLevelData {
  d.components = d.components.map((c) => {
    if (c.t === "outline")
      return {
        ...c,
        t: "crate" as const,
        kind: "wood" as const,
        outline: true,
      };
    // ONE VERT COMPONENT. The old 'pipe' was a straight axis-aligned halfpipe,
    // which is exactly what a straight 90° 'vertramp' half is — and the build
    // still puts it on the same analytic backing, so nothing about the ride
    // changes. Old saves fold into the new part on load.
    if (c.t === "pipe") {
      const { axis, ...rest } = c;
      return {
        ...rest,
        t: "vertramp" as const,
        vkind: "half" as const,
        yaw: axis === "x" ? 90 : (c.yaw ?? 0),
      };
    }
    return c;
  });
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
  const lastGate = d.components.map((c) => c.t).lastIndexOf("gate");
  if (lastGate === -1) d.components.push(defaultGateFor(d));
  else
    d.components = d.components.filter(
      (c, i) => c.t !== "gate" || i === lastGate,
    );
  // RUN-MODE ACTIVATORS: the stopwatch and the combo orb are level furniture
  // the same way the spawn and the gate are — old saves get them beside the
  // spawn (move them wherever afterwards); duplicates collapse to the last.
  for (const t of ["clock", "comboorb"] as const) {
    const last = d.components.map((c) => c.t).lastIndexOf(t);
    if (last === -1)
      d.components.push({
        t,
        p: [d.spawn[0] + (t === "clock" ? 2 : -2), d.spawn[1], d.spawn[2] - 5],
      });
    else d.components = d.components.filter((c, i) => c.t !== t || i === last);
  }
  return d;
}

export function starterCustomLevel(): CustomLevelData {
  return {
    v: 1,
    name: "My Level",
    spawn: [0, 0.6, 20],
    killY: -12,
    components: [
      { t: "platform", p: [0, 0, 12], s: [26, 1, 32] }, // home deck
      { t: "platform", p: [0, 0, -18], s: [26, 1, 20] }, // across the first pit
      { t: "rail", p: [6, 1.0, -2], len: 16, yaw: 0 },
      {
        t: "vertramp",
        p: [-24, -0.5, -8],
        len: 36,
        w: 3,
        rise: 6,
        vkind: "half",
      },
      { t: "crate", p: [-4, 0.5, 4], kind: "wood" },
      { t: "crate", p: [-4, 0.5, 0], kind: "bouncy" },
      { t: "wumpa", p: [0, 1.2, 4] },
      { t: "wumpa", p: [0, 1.2, 0] },
      { t: "wumpa", p: [0, 1.2, -4] },
      { t: "enemy", p: [4, 0.5, -20], range: 5, speed: 3 },
      { t: "crystal", p: [0, 0.5, -24] },
      { t: "gate", p: [0, 0.5, -26] },
    ],
  };
}

// The four corners of a w×d rectangle spun by yaw degrees (relative offsets)
// — matches mesh.rotation.y = yaw applied to a BoxGeometry footprint.

// ---------------------------------------------------------------- vert ramp --
// Sweep a skatepark transition profile along a spine. This is the AUTHORED vert
// primitive: unlike the analytic Halfpipe (which is axis-aligned and owns its
// own ride physics), this is plain geometry that carries userData.vert, so it
// can follow any path and the tracked-wall physics handles it.
//
//   cross-section, lateral to the right:
//        y=R  ___                      lip (surface vertical)
//            /
//           |   quarter arc, radius R
//    y=0 ___|________                  flat half-width F
//         F      F+R
//
// phi runs 0 (flat, tangent horizontal) -> arc (the lip; 90 = surface vertical):
//   lateral = F + R*sin(phi)      y = R*(1 - cos(phi))
// so the concave side faces the flat — you ride INTO it, exactly like a real
// quarter pipe. 'half' mirrors it across the spine with the flat between.
//
// Four knobs turn that one profile into the whole skatepark vocabulary:
//   arc     how far round the transition goes. 90 = vertical lip; the bowls
//           use ~60, because a wall that goes past vertical is a dead end at
//           this game's speeds (you can never crest it).
//   deck    a flat platform past the lip plus a thin outer skirt to the floor.
//           THPS pool rules: roll over the lip un-popped and you land ON the
//           deck. A bare knife edge fails both ways — the short drop behind it
//           sits inside the ground-snap window, so cresting glues you down the
//           outside instead of letting you ride the deck.
//   closed  loop the spine, so a rounded-rect or circular path becomes a pool.
//   roll    per-sample bank about the spine tangent. Zero for park transitions;
//           the slide ribbons lean on it hard (a corkscrew is just roll).
export interface VertRampNode {
  x: number;
  y: number;
  z: number;
  roll?: number; // radians, banked about the spine tangent
}
export interface VertRampOpts {
  radius: number; // transition radius
  flatHalf: number; // half-width of the flat (a quarter's run-up, a half's trough)
  kind: "quarter" | "half";
  arcDeg?: number; // default 90
  deck?: number; // flat deck past the lip (0 = bare coping edge)
  closed?: boolean; // loop the spine end-to-end
  arcSteps?: number;
}
export interface VertRampResult {
  geometry: THREE.BufferGeometry;
  copings: THREE.Vector3[][]; // lip polylines (one per wall) — grindable
  lipY: number; // coping height above the spine
  lipLat: number; // coping distance from the spine, laterally
}

export interface VertRampFrame {
  rx: number; // lateral (across the profile)
  ry: number;
  rz: number;
  ux: number; // surface up
  uy: number;
  uz: number;
}

// Per-sample orthonormal frame along a spine. The tangent is TRUE 3D — a
// ribbon diving down a hillside stays perpendicular to its own slope, not to
// the ground plane — and `roll` spins the frame about that tangent.
export function vertRampFrames(
  P: readonly VertRampNode[],
  closed: boolean,
): VertRampFrame[] {
  const N = P.length;
  const wrap = (i: number): number =>
    closed ? ((i % N) + N) % N : THREE.MathUtils.clamp(i, 0, N - 1);
  return P.map((_, i) => {
    const a = P[wrap(i - 1)];
    const b = P[wrap(i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    let tz = b.z - a.z;
    let tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-6) {
      tx = 0;
      ty = 0;
      tz = 1;
      tl = 1;
    }
    tx /= tl;
    ty /= tl;
    tz /= tl;
    // lateral: the tangent's ground heading turned -90
    let rx = tz;
    let rz = -tx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl;
    rz /= rl;
    // up = tangent x lateral (right-handed, so it points skyward on the flat)
    let ux = ty * rz;
    let uy = tz * rx - tx * rz;
    let uz = -ty * rx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const th = P[i].roll ?? 0;
    if (th === 0) return { rx, ry: 0, rz, ux, uy, uz };
    // Rodrigues about the tangent: both axes are already perpendicular to it,
    // and tangent x lateral = up, so the rotation collapses to a 2D spin.
    const co = Math.cos(th);
    const si = Math.sin(th);
    return {
      rx: rx * co + ux * si,
      ry: uy * si,
      rz: rz * co + uz * si,
      ux: ux * co - rx * si,
      uy: uy * co,
      uz: uz * co - rz * si,
    };
  });
}

// A sampler over a finished spine: `frame(t, lat, h)` is the world point `lat`
// across the swept surface and `h` above it, at arc-length fraction t. This is
// the ONE source of truth a level uses to hang things on a swept part — edge
// rails, crates, fruit all sit exactly on the surface the mesh was built from.
export interface VertRampPath {
  spine: VertRampNode[];
  len: number;
  frame(t: number, lat: number, h: number): THREE.Vector3;
}
export function vertRampPath(
  spine: VertRampNode[],
  closed = false,
): VertRampPath {
  const F = vertRampFrames(spine, closed);
  const s: number[] = [0];
  for (let i = 1; i < spine.length; i++) {
    s.push(
      s[i - 1] +
        Math.hypot(
          spine[i].x - spine[i - 1].x,
          spine[i].y - spine[i - 1].y,
          spine[i].z - spine[i - 1].z,
        ),
    );
  }
  const len = s[s.length - 1] || 1;
  return {
    spine,
    len,
    frame(t: number, lat: number, h: number): THREE.Vector3 {
      const target = THREE.MathUtils.clamp(t, 0, 1) * len;
      let i = 0;
      while (i < s.length - 2 && s[i + 1] < target) i++;
      const span = s[i + 1] - s[i];
      const u = span > 1e-6 ? (target - s[i]) / span : 0;
      const a = spine[i];
      const b = spine[i + 1];
      const fa = F[i];
      const fb = F[i + 1];
      const L = (p: number, q: number): number => p + (q - p) * u;
      return new THREE.Vector3(
        L(a.x, b.x) + L(fa.rx, fb.rx) * lat + L(fa.ux, fb.ux) * h,
        L(a.y, b.y) + L(fa.ry, fb.ry) * lat + L(fa.uy, fb.uy) * h,
        L(a.z, b.z) + L(fa.rz, fb.rz) * lat + L(fa.uz, fb.uz) * h,
      );
    },
  };
}
export function buildVertRampGeometry(
  spine: readonly VertRampNode[],
  o: VertRampOpts,
): VertRampResult {
  const { radius, flatHalf, kind } = o;
  const arcSteps = o.arcSteps ?? 8;
  const deck = Math.max(0, o.deck ?? 0);
  const closed = o.closed === true && spine.length > 2;
  const arcRad = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(o.arcDeg ?? 90, 5, 90),
  );
  const lipLat = flatHalf + radius * Math.sin(arcRad);
  const lipY = radius * (1 - Math.cos(arcRad));

  // Half the cross-section, centre outward: transition arc, then deck + skirt.
  const half: { lat: number; y: number }[] = [];
  for (let j = 0; j <= arcSteps; j++) {
    const phi = (j / arcSteps) * arcRad;
    half.push({
      lat: flatHalf + radius * Math.sin(phi),
      y: radius * (1 - Math.cos(phi)),
    });
  }
  const lipK = half.length - 1; // the coping, within `half`
  if (deck > 0) {
    half.push({ lat: lipLat + deck, y: lipY }); // deck out to its edge
    half.push({ lat: lipLat + deck + 0.1, y: lipY }); // knife the edge
    half.push({ lat: lipLat + deck + 0.1, y: 0 }); // skirt down to the floor
  }
  let prof: { lat: number; y: number }[];
  let copK: number[]; // profile indices that are copings
  if (kind === "half") {
    const left = half.map((p) => ({ lat: -p.lat, y: p.y })).reverse();
    prof = [...left, ...half];
    copK = [left.length - 1 - lipK, left.length + lipK];
  } else {
    prof = [{ lat: 0, y: 0 }, ...half]; // flat run-up from the spine out
    copK = [1 + lipK];
  }

  const P = spine;
  const N = P.length;
  const wrap = (i: number): number =>
    closed ? ((i % N) + N) % N : THREE.MathUtils.clamp(i, 0, N - 1);
  const frames = vertRampFrames(P, closed);
  const world = (i: number, k: number): THREE.Vector3 => {
    const f = frames[i];
    const lat = prof[k].lat;
    const h = prof[k].y;
    return new THREE.Vector3(
      P[i].x + f.rx * lat + f.ux * h,
      P[i].y + f.ry * lat + f.uy * h,
      P[i].z + f.rz * lat + f.uz * h,
    );
  };

  const pos: number[] = [];
  const uv: number[] = [];
  // arc length along the spine, so a repeating texture doesn't stretch on bends
  let s = 0;
  const sAt: number[] = [0];
  for (let i = 1; i < N; i++) {
    s += Math.hypot(
      P[i].x - P[i - 1].x,
      P[i].y - P[i - 1].y,
      P[i].z - P[i - 1].z,
    );
    sAt.push(s);
  }
  const segs = closed ? N : N - 1;
  for (let i = 0; i < segs; i++) {
    const j = wrap(i + 1);
    const s0 = sAt[i];
    const s1 = j === 0 ? s + 1 : sAt[j];
    for (let k = 0; k < prof.length - 1; k++) {
      const a = world(i, k);
      const b = world(i, k + 1);
      const c = world(j, k + 1);
      const d = world(j, k);
      // two triangles, wound so the normal faces the concave (rideable) side
      pos.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      pos.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
      const u0 = prof[k].lat / 6;
      const u1 = prof[k + 1].lat / 6;
      const v0 = s0 / 6;
      const v1 = s1 / 6;
      uv.push(u0, v0, u1, v1, u1, v0);
      uv.push(u0, v0, u0, v1, u1, v1);
    }
  }
  const copings = copK.map((k) => {
    const line: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) line.push(world(i, k));
    if (closed) line.push(world(0, k));
    return line;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return { geometry, copings, lipY, lipLat };
}

// The dense world-space spine a vertramp sweeps along, built from its editor
// nodes. Nodes are the rail convention — [x, z, cornerRadius, yOffset, bankDeg]
// relative to p — turned by `yaw` like every other component's footprint. Two
// path modes: 'corner' fillets the bends (parks want straight runs and crisp
// corners), 'spline' runs one Catmull-Rom through the lot (a slide is a single
// flowing curve). Bank comes from the per-node value plus an optional automatic
// lean into the turn, and is interpolated so the roll never steps.
export function vertRampSpine(c: CustomComponent): VertRampNode[] {
  const yaw = THREE.MathUtils.degToRad(c.yaw ?? 0);
  const cs = Math.cos(yaw);
  const sn = Math.sin(yaw);
  const place = (
    x: number,
    y: number,
    z: number,
    roll: number,
  ): VertRampNode => ({
    x: c.p[0] + x * cs + z * sn,
    y: c.p[1] + y,
    z: c.p[2] - x * sn + z * cs,
    roll,
  });
  // node list: explicit path, or the two ends of a straight run along +Z
  let nodes: number[][];
  if (c.pts && c.pts.length >= 2) {
    nodes = c.pts.map((q) => [...q]);
  } else {
    const len = c.len ?? 30;
    nodes = [
      [0, -len / 2],
      [0, len / 2],
    ];
  }
  const closed = c.closed === true && nodes.length > 2;
  const roll = nodes.map((q) => THREE.MathUtils.degToRad(q[4] ?? 0));
  const out: VertRampNode[] = [];

  if (c.curve === "spline") {
    const N = nodes.length;
    const pts3 = nodes.map((q) => new THREE.Vector3(q[0], q[3] ?? 0, q[1]));
    const cv = new THREE.CatmullRomCurve3(pts3, closed, "centripetal", 0.5);
    const steps = Math.max(8, Math.round(cv.getLength() / 1.6));
    const span = closed ? N : N - 1;
    for (let i = 0; i <= steps; i++) {
      if (closed && i === steps) break; // the loop closes itself
      const u = i / steps;
      const p = cv.getPointAt(u);
      // getUtoTmapping undoes the arc-length reparametrisation, so the node
      // index (and its bank) tracks the SAME point the position came from
      const t = cv.getUtoTmapping(u, 0); // 0 is falsy inside, so `u` still drives it
      const f = t * span;
      const k = Math.min(span - 1, Math.floor(f));
      const r = THREE.MathUtils.lerp(roll[k % N], roll[(k + 1) % N], f - k);
      out.push(place(p.x, p.y, p.z, r));
    }
  } else {
    const dense = roundCorners(nodes, closed);
    if (dense.length === 0) return [];
    // Bank anchors at the MIDDLE of each node's run of samples, then a straight
    // lerp between anchors — a filleted corner banks in and out of its turn
    // instead of snapping to the node's value the instant the fillet starts.
    const anchor: { at: number; roll: number }[] = [];
    for (let i = 0, run = 0; i <= dense.length; i++) {
      if (i === dense.length || dense[i].i !== dense[run].i) {
        anchor.push({ at: (run + i - 1) / 2, roll: roll[dense[run].i] ?? 0 });
        run = i;
      }
    }
    let a = 0;
    for (let i = 0; i < dense.length; i++) {
      while (a < anchor.length - 2 && anchor[a + 1].at < i) a++;
      const lo = anchor[a];
      const hi = anchor[Math.min(anchor.length - 1, a + 1)];
      const t =
        hi.at > lo.at
          ? THREE.MathUtils.clamp((i - lo.at) / (hi.at - lo.at), 0, 1)
          : 0;
      out.push(
        place(
          dense[i].x,
          dense[i].y,
          dense[i].z,
          THREE.MathUtils.lerp(lo.roll, hi.roll, t),
        ),
      );
    }
  }

  // AUTO LEAN: signed curvature of the finished spine, smoothed, added on top.
  // This is what makes a sweeping road feel like a road — the deck rolls into
  // the bend without anyone authoring a number for it.
  const gain = c.bank ?? 0;
  if (gain !== 0 && out.length > 2) {
    const n = out.length;
    const wrap = (i: number): number =>
      closed ? ((i % n) + n) % n : THREE.MathUtils.clamp(i, 0, n - 1);
    const auto = out.map((_, i) => {
      const a = out[wrap(i - 1)];
      const b = out[i];
      const d = out[wrap(i + 1)];
      const ax = b.x - a.x;
      const az = b.z - a.z;
      const bx = d.x - b.x;
      const bz = d.z - b.z;
      const la = Math.hypot(ax, az);
      const lb = Math.hypot(bx, bz);
      if (la < 1e-5 || lb < 1e-5) return 0;
      const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz); // signed
      return THREE.MathUtils.clamp(
        (gain * turn) / ((la + lb) / 2),
        -0.28,
        0.28,
      );
    });
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < n; i++)
        auto[i] = (auto[wrap(i - 1)] + 2 * auto[i] + auto[wrap(i + 1)]) / 4;
    }
    for (let i = 0; i < n; i++) out[i].roll = (out[i].roll ?? 0) + auto[i];
  }
  return out;
}

// Fillet the corners of a polyline/polygon (Figma corner radius). Each
// vertex is [x, z, radius?, y?]; a radiused corner is replaced by a
// quadratic fillet trimmed to just under half of the shorter adjacent edge.
// The optional per-node HEIGHT rides the same bezier, so a rounded bend on
// a climbing rail rises smoothly through the turn. Returns dense points
// tagged with the source vertex index `i` (aux data can follow the tag).
// Open paths never round their endpoints. Consecutive near-duplicates are
// dropped (zero-length rail segments would blow up direction math).
// Ramer-Douglas-Peucker: drop points that sit within `eps` of the straight
// line between their neighbours. A hand-authored camera lane is sampled every
// few units, which is right for the maths and useless in the editor — a
// hundred draggable diamonds down one road. Simplifying keeps the curve and
// hands back a chain you can actually grab.
// How far a camera-lane node may drift from the straight line between its
// neighbours before capture keeps it. Kept TIGHT on purpose: a long chord
// across a curve is not the curve, and the steering follows the chain. Every
// value below was MEASURED on the Slipstream (whose spine curves almost end
// to end) by rebuilding the level and comparing its steering vector against
// the hand-coded spine at all 170 sample points:
//   eps 0.5 ->  85 nodes, 0.7deg mean /  3.6deg worst  <- here
//   eps 1   ->  55 nodes, 1.6deg mean / 11.4deg worst
//   eps 2   ->  36 nodes, 3.0deg mean / 26.2deg worst  (visibly wrong mid-sweep)
// So the count is not freely compressible. Grouping the nodes is what makes
// them tolerable in the outliner — thinning past this bends the camera.
export const LANE_SIMPLIFY_EPS = 0.5;

/** The combo prize is the same gem cut, run through green glass. Shared so the
 *  HUD's copy of it can't drift from the one standing at the gate. */
export const COMBO_GEM_TINT = 0x46e882;

/**
 * Where a rider was on the camera lane last frame, in metres along the spine.
 * `s < 0` means "no history — take the global best and adopt it", which is
 * what a respawn or a level change wants. One of these per rider; sharing it
 * between two players in split-screen would have them yanking each other's
 * camera around.
 */
export interface LaneCursor {
  s: number;
}
export function newLaneCursor(): LaneCursor {
  return { s: -1 };
}
// How far along the spine the match may travel between queries for free. A
// rider covers under a metre per frame even at full tilt; the slack is for
// frames dropped to a level load or a pause.
// scratch for the per-frame translation of travelling rails and rope anchors
// (update runs every frame — allocating a Vector3 in there is garbage churn)
const MR_DELTA = new THREE.Vector3();
const LANE_FREE_TRAVEL = 40;
// What a bigger leap costs, per metre squared. The Slipstream's loop sits 26m
// from the deck below it and 188m away along the spine: (188-40)^2 * 0.25 is
// worth ~74m of distance, so the lower deck can never win — while a real
// relocation, which lands hundreds of metres from the cursor, still does.
const LANE_LEAP_COST = 0.25;

export function simplifyPath<T extends { x: number; y: number; z: number }>(
  pts: readonly T[],
  eps: number,
): T[] {
  if (pts.length <= 2) return pts.slice();
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = pts[a].x;
    const ay = pts[a].y;
    const az = pts[a].z;
    const dx = pts[b].x - ax;
    const dy = pts[b].y - ay;
    const dz = pts[b].z - az;
    const len = Math.hypot(dx, dy, dz);
    let worst = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      // perpendicular distance to the chord in 3D (cross product / |chord|),
      // or to the point itself if the chord degenerates
      const vx = pts[i].x - ax;
      const vy = pts[i].y - ay;
      const vz = pts[i].z - az;
      const d =
        len < 1e-6
          ? Math.hypot(vx, vy, vz)
          : Math.hypot(
              vy * dz - vz * dy,
              vz * dx - vx * dz,
              vx * dy - vy * dx,
            ) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > eps && at > 0) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export function roundCorners(
  pts: readonly (readonly number[])[],
  closed: boolean,
): { x: number; z: number; y: number; i: number }[] {
  const n = pts.length;
  const out: { x: number; z: number; y: number; i: number }[] = [];
  const push = (x: number, z: number, y: number, i: number): void => {
    const last = out[out.length - 1];
    if (
      last &&
      (last.x - x) * (last.x - x) + (last.z - z) * (last.z - z) < 4e-4
    )
      return;
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

export function rectCorners(
  w: number,
  d: number,
  yawDeg: number,
): [number, number][] {
  const r = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const base: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  return base.map(
    ([x, z]) => [x * cos + z * sin, -x * sin + z * cos] as [number, number],
  );
}

// Even-odd point-in-polygon test (pts relative to the same origin as x/z).
export function pointInPoly(
  x: number,
  z: number,
  pts: [number, number][],
): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i];
    const [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)
      inside = !inside;
  }
  return inside;
}

// ---- LEVEL REGISTRY -------------------------------------------------------
// Every level the menu offers is an entry here. Built-ins run a hand-coded
// builder chosen by their id; user levels carry `data` and build through the
// component pipeline — the same pipeline the editor writes, so anything in the
// list is directly editable. Ids are stable SLUGS, never list indices: adding
// or deleting a level can no longer silently re-point a saved best time, a
// replay, or a saved editor target at somebody else's course.
export interface LevelEntry {
  id: string; // "jungle"/"flats"/... for built-ins, "uN" for user levels
  name: string; // what the menu row shows; user levels can rename it
  data?: CustomLevelData; // user levels only — built-ins have none
}

export const BUILTIN_LEVELS: LevelEntry[] = [
  { id: "jungle", name: "Jungle Ruins" }, // enclosed corridor: pit hops, a trunk grind, a temple climb
  { id: "flats", name: "Flats & Pipes" }, // sky-deck runway opening into the transition yard
  { id: "sky", name: "Sky Bridge" },
  { id: "slip", name: "The Slipstream" }, // banked ribbon slide high over the sea
  { id: "dark", name: "The Nightworks" }, // torch-lit machine hall: cycling platforms, phase pads, travelling rails and ropes
  { id: "warproom", name: "The Warp Room" }, // five wormhole gates round a dais
  { id: "descent", name: "The Descent" }, // two-lane mountain road, very long, very downhill
];
export const DEFAULT_LEVEL_ID = "jungle";
const BUILTIN_IDS = new Set(BUILTIN_LEVELS.map((l) => l.id));
export function isBuiltin(id: string): boolean {
  return BUILTIN_IDS.has(id);
}

// ---- USER LEVELS: the editable, syncable half of the list ------------------
// One localStorage key holds the whole list, in menu order, data and all. It
// is also exactly the payload the cloud sync pushes and restores, so "what I
// see" and "what I publish" can never drift apart.
const USER_KEY = "protoUserLevels";
let USER_CACHE: LevelEntry[] | null = null;

function sane(e: unknown): e is LevelEntry {
  const l = e as LevelEntry | null;
  return (
    !!l &&
    typeof l.id === "string" &&
    l.id.length > 0 &&
    typeof l.name === "string" &&
    !!l.data &&
    Array.isArray(l.data.components)
  );
}

export function getUserLevels(): LevelEntry[] {
  if (USER_CACHE) return USER_CACHE;
  let list: LevelEntry[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem(USER_KEY) ?? "[]") as unknown;
    if (Array.isArray(raw)) list = raw.filter(sane);
  } catch {
    /* corrupt store reads as "no user levels" rather than breaking boot */
  }
  // An entry under a BUILT-IN's id is that level's edited version — it takes
  // the built-in's place in the menu (see levelList). Duplicate ids would make
  // findLevel ambiguous, so drop the later of any clash.
  const seen = new Set<string>();
  list = list.filter((l) => !seen.has(l.id) && (seen.add(l.id), true));
  USER_CACHE = list;
  return list;
}

export function setUserLevels(list: LevelEntry[]): void {
  USER_CACHE = list.filter(sane);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(USER_CACHE));
  } catch {
    /* storage full: the session still has the list in memory */
  }
}

/**
 * Built-ins first (in their fixed order), then user levels in the order they
 * were added. A built-in that has been EDITED is stored under its own id, and
 * replaces itself in place — same row, same slot, so editing Jungle Ruins
 * gives you back Jungle Ruins and not a second thing beside it. The hand-coded
 * builder is still there underneath: drop the entry and the original returns.
 */
export function levelList(): LevelEntry[] {
  const user = getUserLevels();
  const edited = new Map(user.map((l) => [l.id, l]));
  const out = BUILTIN_LEVELS.map((b) => edited.get(b.id) ?? b);
  for (const u of user) if (!isBuiltin(u.id)) out.push(u);
  return out;
}

/** True when this built-in has been edited and is building from data. */
export function isOverridden(id: string): boolean {
  return isBuiltin(id) && getUserLevels().some((l) => l.id === id);
}

export function findLevel(id: string): LevelEntry | null {
  return levelList().find((l) => l.id === id) ?? null;
}

/** Lowest free "uN" — stable across sessions, never reuses a live id. */
export function newLevelId(): string {
  const taken = new Set(levelList().map((l) => l.id));
  for (let n = 1; ; n++) if (!taken.has(`u${n}`)) return `u${n}`;
}

/** A menu-safe name: non-empty, whitespace-collapsed, length-capped. */
export function cleanLevelName(name: string): string {
  const t = String(name ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
  return t || "Untitled";
}

/** Insert or replace a user level. Returns the id actually stored. */
export function saveUserLevel(entry: LevelEntry): string {
  const list = [...getUserLevels()];
  const e: LevelEntry = {
    // only a BLANK id mints a new one; a built-in's id is kept, which is what
    // makes editing one edit the level itself instead of forking a copy
    id: entry.id || newLevelId(),
    name: cleanLevelName(entry.name),
    data: entry.data,
  };
  const at = list.findIndex((l) => l.id === e.id);
  if (at >= 0) list[at] = e;
  else list.push(e);
  setUserLevels(list);
  return e.id;
}

/**
 * Drop a built-in's edits and hand the hand-coded design back. The level does
 * not leave the menu — it just stops building from data. Best times are kept:
 * it is the same course either way.
 */
export function restoreBuiltin(id: string): void {
  if (!isBuiltin(id)) return;
  setUserLevels(getUserLevels().filter((l) => l.id !== id));
}

export function deleteUserLevel(id: string): void {
  if (isBuiltin(id)) return restoreBuiltin(id); // a built-in can't leave the menu
  setUserLevels(getUserLevels().filter((l) => l.id !== id));
  try {
    // the level is gone, so its best times are unreachable — drop them with it
    const all = JSON.parse(
      localStorage.getItem("protoTTtimes") ?? "{}",
    ) as Record<string, number[]>;
    if (all && typeof all === "object" && id in all) {
      delete all[id];
      localStorage.setItem("protoTTtimes", JSON.stringify(all));
    }
  } catch {
    /* nothing persisted, nothing to drop */
  }
}

export function renameUserLevel(id: string, name: string): boolean {
  const list = [...getUserLevels()];
  const at = list.findIndex((l) => l.id === id);
  if (at < 0) return false;
  list[at] = { ...list[at], name: cleanLevelName(name) };
  setUserLevels(list);
  return true;
}

/** The editor's working copy for a level: its own data, else a blank slate. */
export function getEditData(id: string): CustomLevelData {
  const e = findLevel(id);
  if (e?.data)
    return migrateCustomLevel(
      JSON.parse(JSON.stringify(e.data)) as CustomLevelData,
    );
  return migrateCustomLevel(starterCustomLevel());
}

/** Editor save: write the working JSON back into the level's list entry. */
export function persistEditData(id: string, json: string): void {
  const e = findLevel(id);
  if (!e) return;
  try {
    saveUserLevel({ ...e, data: JSON.parse(json) as CustomLevelData });
  } catch {
    /* unparseable: keep the last good copy on disk */
  }
}

// ---- ONE-TIME ADOPTION of the old single-slot storage ----------------------
// Before the registry there was one "Custom" sandbox plus a per-level override
// slot keyed by the level's INDEX. Both are gone, but a device that used them
// still holds real work, so on first boot each surviving slot becomes a proper
// named user level. Runs once; the marker means a later delete stays deleted.
const LEGACY_NAMES: Record<string, string> = {
  "0": "Test Course",
  "1": "Random",
  "2": "Boulder Dash",
  "3": "Flats & Pipes",
  "4": "Sky Bridge",
  "6": "The Slipstream",
};
// Which old list index was which SURVIVING level. 0 (the test course) is
// deliberately absent now that it is gone: re-keying its best times onto the
// jungle would credit an unrelated course with a time nobody set on it. The
// old slot-0 EDIT still adopts, as a named user level (see LEGACY_NAMES).
const LEGACY_SLUGS: Record<string, string> = {
  "3": "flats",
  "4": "sky",
  "6": "slip",
};
export function adoptLegacyLevels(): number {
  let n = 0;
  try {
    if (localStorage.getItem("protoLevelsAdopted") === "1") return 0;
    const read = (k: string): CustomLevelData | null => {
      try {
        const raw = JSON.parse(
          localStorage.getItem(k) ?? "null",
        ) as CustomLevelData | null;
        return raw && Array.isArray(raw.components) ? raw : null;
      } catch {
        return null;
      }
    };
    const legacy: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("protoLevelEdit:")) legacy.push(k);
    }
    legacy.sort();
    for (const k of legacy) {
      const d = read(k);
      const old = k.slice("protoLevelEdit:".length);
      if (d) {
        saveUserLevel({
          id: "",
          name: `${LEGACY_NAMES[old] ?? `Level ${old}`} (saved)`,
          data: migrateCustomLevel(d),
        });
        n++;
      }
      localStorage.removeItem(k);
    }
    const sandbox = read("protoCustomLevel");
    if (sandbox) {
      saveUserLevel({
        id: "",
        name: "Custom (saved)",
        data: migrateCustomLevel(sandbox),
      });
      n++;
    }
    localStorage.removeItem("protoCustomLevel");
    localStorage.removeItem("protoCustomLevelBackup");
    localStorage.removeItem("protoLevelDirty");
    // Best times were keyed by list INDEX. Re-key the ones whose level still
    // exists; without this every recorded time is silently unreachable.
    try {
      const times = JSON.parse(
        localStorage.getItem("protoTTtimes") ?? "{}",
      ) as Record<string, number[]>;
      const out: Record<string, number[]> = {};
      let moved = false;
      for (const [k, v] of Object.entries(times ?? {})) {
        const slug = LEGACY_SLUGS[k];
        if (slug) {
          out[slug] = v;
          moved = true;
        } else if (!/^\d+$/.test(k)) out[k] = v; // already a slug: keep
      }
      if (moved) localStorage.setItem("protoTTtimes", JSON.stringify(out));
    } catch {
      /* unreadable times: not worth failing the adoption over */
    }
    // and the numeric last-played becomes its slug
    const lastNum = localStorage.getItem("protoLevel");
    if (lastNum && LEGACY_SLUGS[lastNum])
      localStorage.setItem("protoLevelId", LEGACY_SLUGS[lastNum]);
    localStorage.removeItem("protoLevel");
    localStorage.setItem("protoLevelsAdopted", "1");
  } catch {
    /* private mode: nothing persisted, nothing to adopt */
  }
  return n;
}

// ---- DIRECT-EDIT UNLOCK: a client-side passcode gate ----------------------
// Flips a built-in level's edit button from "edit a copy" to "edit this level
// directly" and reveals the phone-sync controls. Not real security (the real
// write credential is the GitHub token) — just a gate so a casual visitor to
// the public build never trips into overwriting levels. SHA-256 of the
// passcode is baked in; the cleartext never ships.
const EDIT_PASS_HASH =
  "64145f0b744709a636dad052192339220347504f5c17ed4d0c22c5c27e416295";
export async function checkEditPass(pass: string): Promise<boolean> {
  const bytes = new TextEncoder().encode(pass);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex === EDIT_PASS_HASH) {
    localStorage.setItem("protoEditUnlocked", "1");
    return true;
  }
  return false;
}
export function isEditUnlocked(): boolean {
  return localStorage.getItem("protoEditUnlocked") === "1";
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
  zones: {
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
    dir: "E" | "W" | "N" | "S";
  }[] = [];
  finishBox = new THREE.Box3();
  // The pad's plasma column. Jumping through this ends the run too — you do
  // not have to touch down on the masonry.
  finishGlow = new THREE.Box3();
  finishZ = -1005; // fallback: every builder authors its own
  gateYaw = 0; // finish-gate turn in degrees — sideways courses spin the whole gate
  endWallZ = -1021; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint
  activeCheckpoint: Checkpoint | null = null; // owns the respawn snapshot
  walls: THREE.Box3[] = []; // solid barriers: bump = full stop, never break
  killY = -48; // per-level death height (every builder authors its own)
  name = BUILTIN_LEVELS[0].name;
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
  torches: Torch[] = [];
  phasePads: PhasePad[] = [];
  movingRails: MovingRail[] = [];
  // Point lights are EXPENSIVE here: every world material is Lambert/Phong
  // forward-lit, so each light multiplies shader cost across the whole scene
  // and adding one recompiles materials. So the pool is built ONCE at a fixed
  // size and re-aimed at the nearest torches every frame — dozens of fires,
  // a handful of lights, no recompiles.
  private torchLights: THREE.PointLight[] = [];
  killBoxes: THREE.Box3[] = []; // touch-kill hazard volumes, rebuilt each update
  pitBoxes: THREE.Box3[] = []; // static death-pit volumes (custom levels), re-fed into killBoxes
  tumbleBoxes: THREE.Box3[] = []; // ragdoll-on-touch volumes (the coast bluffs): bail + tumble down the face, not an instant kill

  // --- visual pass ---
  // combo-mode dress: true = EVERY convertible crate becomes a balance crate
  // (levels built around one long grind line); false = every third
  private allBalanceCrates = false;
  // Ride a rail end to end here and popping off launches you past every normal
  // speed ceiling. Only set on the level built around one long grind line —
  // elsewhere it would quietly rewrite the speed balance of the whole park.
  perfectGrindBoost = false;
  // Time of day for THIS level. Hand-coded levels are all sunset (the look the
  // game shipped with); a data-built level takes it from its authored data.
  skyPreset: SkyPreset = DEFAULT_SKY;
  // Keep the fog ON the course surfaces (see clearPlayFog): the dark level's
  // sightline discipline depends on the haze eating its own geometry.
  private keepPlayFog = false;
  // Fallback look only — every hand-coded builder assigns its own theme, and a
  // data-built level inherits whichever one its builder set. Kept as a sane
  // lagoon default so a level that forgets still renders like a place.
  theme: Theme = {
    skyTop: "#0fa3c2",
    skyBottom: "#ffe6ae",
    sunColorHex: "#fff0b8",
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
  private scrollTexes: { tex: THREE.CanvasTexture; su: number; sv: number }[] =
    [];
  private warpPads: WarpPad[] = []; // end-of-level warp platforms: rings rise, plume flickers
  private seaMats: THREE.ShaderMaterial[] = []; // open water: uTime is the only thing that moves
  private ambient: { points: THREE.Points; drift: Float32Array } | null = null;

  // safe = triggered by the player's own spin/slam: breaks the world, not them
  explosions: {
    center: THREE.Vector3;
    t: number;
    radius: number;
    safe: boolean;
  }[] = [];

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
  crystalPickup: {
    group: THREE.Group;
    box: THREE.Box3;
    collected: boolean;
  } | null = null;
  // TIME TRIAL: the gold stopwatch near spawn — touch it to start the clock.
  clockPickup: {
    group: THREE.Group;
    box: THREE.Box3;
    collected: boolean;
  } | null = null;
  timeTrial = false; // trial live: checkpoints/fruit dormant, time crates active
  // COMBO RUN: the green orb near spawn — touch it and the green gem appears
  // at the finish gate; reach it in ONE combo and it's yours.
  // PLAYTEST SWITCH (see setRunModesEnabled): with this off, the trial
  // stopwatch and the combo orb are hidden and cannot be picked up, so a plain
  // platforming pass is never interrupted by a mode starting.
  runModesOn = true;
  comboOrb: { group: THREE.Group; box: THREE.Box3; collected: boolean } | null =
    null;
  comboRun = false;
  comboGem: { group: THREE.Group; box: THREE.Box3 } | null = null;
  private gateSpec: { x: number; y: number; z: number } | null = null; // where finishGate stood (capture + clock placement)
  // authored activator spots (custom levels) — idx ties the built pickup back
  // to its component so the editor can pick and drag it
  private clockSpot: { x: number; y: number; z: number; idx: number } | null =
    null;
  private orbSpot: { x: number; y: number; z: number; idx: number } | null =
    null;

  // either special play mode: checkpoints/fruit/crystal sit out, boxes go empty
  get runMode(): boolean {
    return this.timeTrial || this.comboRun;
  }
  private gemG: THREE.Group | null = null; // materializes when every box breaks
  // ...and it is a PICKUP, not an award: it hangs there until you touch it
  gemPickup: {
    group: THREE.Group;
    box: THREE.Box3;
    collected: boolean;
  } | null = null;
  private vfxT = 0; // animation clock for all the procedural magic
  private glintTex: THREE.CanvasTexture | null = null;
  private flareTex: THREE.CanvasTexture | null = null; // big collection starburst
  private static glowTex: THREE.CanvasTexture | null = null; // soft radial halo
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
  private blastBroken: Crate[] = []; // crates broken by blasts, for the player to tally
  private checkerTex: THREE.CanvasTexture | null = null;

  // THE DEFAULT SURFACE. This used to be a literal white/grey checkerboard with
  // a black outline round every tile — the universal "this is placeholder"
  // texture, and the loudest grey-box tell left in the game. It is now sealed
  // panel: fine tonal grain, a soft seam every panel, and a light wear pass.
  // It keeps the job the checker was actually there for (ground movement has
  // to read even with no landmarks, which the side-scroll camera depends on)
  // without announcing itself as a placeholder. Near-white, so each deck's
  // colour still tints it. The 'checker' KEY stays — saved levels reference it.
  private checkerTexture(): THREE.CanvasTexture {
    if (this.checkerTex) return this.checkerTex;
    const SS = Level.TEX_SS;
    const canvas = document.createElement("canvas");
    canvas.width = 64 * SS;
    canvas.height = 64 * SS;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SS, SS);
    ctx.fillStyle = "#f2f1ee";
    ctx.fillRect(0, 0, 64, 64);
    // tonal drift: broad soft pools so a big deck never reads as dead flat
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const r = 9 + Math.random() * 15;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const v = Math.random() < 0.5 ? "226,224,218" : "255,255,252";
      g.addColorStop(0, `rgba(${v},0.5)`);
      g.addColorStop(1, `rgba(${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // panel seams: one soft groove each way, with a hairline highlight on the
    // far side so the joint reads cut rather than drawn on
    ctx.strokeStyle = "rgba(150,146,138,0.5)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0.35);
    ctx.lineTo(64, 0.35);
    ctx.moveTo(0.35, 0);
    ctx.lineTo(0.35, 64);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 1.1);
    ctx.lineTo(64, 1.1);
    ctx.moveTo(1.1, 0);
    ctx.lineTo(1.1, 64);
    ctx.stroke();
    // wear: faint scuffs, denser toward the seams where feet land
    ctx.strokeStyle = "rgba(168,164,155,0.20)";
    ctx.lineWidth = 0.45;
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      const a = Math.random() * Math.PI;
      const l = 2 + Math.random() * 7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    this.checkerTex = Level.finishTex(new THREE.CanvasTexture(canvas));
    return this.checkerTex;
  }

  // Light-toned surface textures — near-white so each deck's material color
  // tints them. Every kind is PAINTED in a 64/128 unit coordinate space, which
  // is what all the blob radii and stripe widths below are written against,
  // but the canvas underneath is SS times bigger and the context is scaled to
  // match. Same art, four times the texels: the pattern keeps its designed
  // scale on the surface while the edges resolve instead of staircasing.
  private static readonly TEX_SS = 4;
  private surfTexCache = new Map<string, THREE.CanvasTexture>();
  private surfaceTexture(kind: string): THREE.CanvasTexture {
    if (kind === "checker") return this.checkerTexture();
    const cached = this.surfTexCache.get(kind);
    if (cached) return cached;
    const soft =
      kind === "grass" ||
      kind === "jungle" ||
      kind === "dirt" ||
      kind === "sand" ||
      kind === "wood" ||
      kind === "moss";
    const S = soft ? 128 : 64;
    const SS = Level.TEX_SS;
    const canvas = document.createElement("canvas");
    canvas.width = S * SS;
    canvas.height = S * SS;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SS, SS);
    // Soft gradient blob, stamped at every wrapped position so tiles seam.
    const blob = (x: number, y: number, r: number, color: string): void => {
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          const bx = x + ox;
          const by = y + oy;
          if (bx < -r || bx > S + r || by < -r || by > S + r) continue;
          const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
          g.addColorStop(0, color);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        }
      }
    };
    if (kind === "grass") {
      // meadow wash: overlapping green pools, shade, sun patches — painterly
      ctx.fillStyle = "#e6eed8";
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) {
        const g = 205 + Math.floor(Math.random() * 34);
        const r = g - 24 - Math.floor(Math.random() * 14);
        blob(
          Math.random() * S,
          Math.random() * S,
          14 + Math.random() * 16,
          `rgba(${r},${g},${g - 36},0.5)`,
        );
      }
      for (let i = 0; i < 10; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          10 + Math.random() * 12,
          "rgba(112,138,88,0.2)",
        );
      for (let i = 0; i < 12; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          5 + Math.random() * 8,
          "rgba(255,255,236,0.3)",
        );
    } else if (kind === "stone") {
      ctx.fillStyle = "#9a9a9a";
      ctx.fillRect(0, 0, 64, 64);
      for (let row = 0; row < 2; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let cx = -1; cx < 3; cx++) {
          const v = 215 + Math.floor(Math.random() * 25);
          ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 2, 28, 28);
          ctx.fillStyle = "rgba(120,120,120,0.35)";
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 26, 28, 4); // bottom shade
        }
      }
    } else if (kind === "wood") {
      // sun-warmed timber: per-plank tonal wash, soft grain, shaded seams
      for (let p = 0; p < 4; p++) {
        const v = 218 + Math.floor(Math.random() * 24);
        const gr = ctx.createLinearGradient(p * 32, 0, p * 32 + 32, 0);
        gr.addColorStop(0, `rgb(${v - 10},${v - 26},${v - 46})`);
        gr.addColorStop(0.5, `rgb(${v},${v - 14},${v - 34})`);
        gr.addColorStop(1, `rgb(${v - 12},${v - 28},${v - 48})`);
        ctx.fillStyle = gr;
        ctx.fillRect(p * 32, 0, 32, S);
        ctx.strokeStyle = "rgba(126,94,60,0.35)";
        ctx.lineWidth = 2;
        for (let g = 0; g < 3; g++) {
          const gx = p * 32 + 7 + g * 9;
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.bezierCurveTo(gx + 4, S * 0.3, gx - 4, S * 0.65, gx, S);
          ctx.stroke();
        }
        blob(
          p * 32 + 8 + Math.random() * 16,
          Math.random() * S,
          4 + Math.random() * 3,
          "rgba(122,88,52,0.45)",
        ); // knot
        ctx.fillStyle = "rgba(96,72,48,0.5)";
        ctx.fillRect(p * 32, 0, 2, S); // seam
      }
    } else if (kind === "jungle") {
      // canopy floor: deep leaf pools under sunlit tops, all soft-edged
      ctx.fillStyle = "#dbe6c4";
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 30; i++) {
        const g = 196 + Math.floor(Math.random() * 44);
        const b = g - 48 + Math.floor(Math.random() * 16);
        blob(
          Math.random() * S,
          Math.random() * S,
          10 + Math.random() * 14,
          `rgba(${g - 40},${g},${b},0.55)`,
        );
      }
      for (let i = 0; i < 14; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          8 + Math.random() * 12,
          "rgba(74,102,60,0.24)",
        );
      for (let i = 0; i < 12; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          4 + Math.random() * 7,
          "rgba(255,255,232,0.32)",
        );
    } else if (kind === "dirt") {
      // trodden earth: warm soft blotches, moss creep, dry sunlit patches
      ctx.fillStyle = "#e5dabd";
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 16; i++) {
        const v = 198 + Math.floor(Math.random() * 36);
        blob(
          Math.random() * S,
          Math.random() * S,
          12 + Math.random() * 18,
          `rgba(${v},${v - 20},${v - 52},0.5)`,
        );
      }
      for (let i = 0; i < 8; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          8 + Math.random() * 10,
          "rgba(140,132,86,0.2)",
        );
      for (let i = 0; i < 14; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          2.5 + Math.random() * 3.5,
          "rgba(122,96,62,0.4)",
        ); // pebbles
      for (let i = 0; i < 8; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          6 + Math.random() * 9,
          "rgba(255,246,220,0.32)",
        );
    } else if (kind === "moss") {
      // grown-over stonework: pale block courses drowning under soft green
      // creep — the lush-ruin wall the jungle levels want
      ctx.fillStyle = "#c9cfbe";
      ctx.fillRect(0, 0, S, S);
      for (let row = 0; row < 4; row++) {
        const off = row % 2 === 0 ? 0 : 16;
        for (let cx = -1; cx < 5; cx++) {
          const v = 200 + Math.floor(Math.random() * 26);
          ctx.fillStyle = `rgb(${v - 6},${v},${v - 14})`;
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 2, 28, 28);
          ctx.fillStyle = "rgba(96,108,88,0.4)";
          ctx.fillRect(cx * 32 + off + 2, row * 32 + 26, 28, 4);
        }
      }
      for (let i = 0; i < 22; i++) {
        const g = 170 + Math.floor(Math.random() * 46);
        blob(
          Math.random() * S,
          Math.random() * S,
          9 + Math.random() * 14,
          `rgba(${g - 62},${g},${g - 78},0.5)`,
        );
      }
      for (let i = 0; i < 8; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          6 + Math.random() * 9,
          "rgba(70,96,58,0.3)",
        );
      for (let i = 0; i < 6; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          4 + Math.random() * 6,
          "rgba(240,248,220,0.28)",
        );
    } else if (kind === "pavement") {
      // concrete: 32px slabs, expansion lines, speckle so aprons don't band
      for (let py = 0; py < 2; py++) {
        for (let px = 0; px < 2; px++) {
          const v = 214 + Math.floor(Math.random() * 22);
          ctx.fillStyle = `rgb(${v},${v},${v - 6})`;
          ctx.fillRect(px * 32, py * 32, 32, 32);
        }
      }
      ctx.fillStyle = "rgba(150,150,145,0.5)";
      for (let i = 0; i < 44; i++)
        ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      ctx.fillStyle = "rgba(105,105,100,0.65)"; // expansion joints
      ctx.fillRect(0, 31, 64, 2);
      ctx.fillRect(31, 0, 2, 64);
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 64);
      ctx.fillStyle = "rgba(255,255,250,0.5)"; // sun-bleached slab lips
      ctx.fillRect(0, 33, 64, 1);
      ctx.fillRect(33, 0, 1, 64);
    } else if (kind === "asphalt") {
      // FULL-COLOUR (pair with a white material): blacktop + painted lane
      // line along one tile edge — tiled, it reads as parking-lot bays.
      ctx.fillStyle = "#3e4046";
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 120; i++) {
        const v = 44 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
        ctx.fillRect(Math.random() * 63, Math.random() * 63, 1.5, 1.5);
      }
      ctx.strokeStyle = "rgba(22,22,26,0.7)"; // hairline cracks
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
      ctx.fillStyle = "#e8e2c8"; // worn paint stripe
      ctx.fillRect(0, 0, 64, 3);
      ctx.fillStyle = "rgba(62,64,70,0.5)"; // scuff it back
      for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * 62, 0, 3, 2);
    } else if (kind === "metal") {
      // brushed deck plate: lengthwise strokes, panel seams, corner rivets
      ctx.fillStyle = "#dde0e4";
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 40; i++) {
        const v = 200 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.7)`;
        ctx.fillRect(0, Math.random() * 63, 34 + Math.random() * 30, 1);
      }
      ctx.fillStyle = "rgba(110,116,128,0.8)"; // seams
      ctx.fillRect(0, 0, 64, 2);
      ctx.fillRect(0, 0, 2, 64);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(0, 2, 64, 1);
      ctx.fillStyle = "rgba(90,96,108,0.9)"; // rivets
      for (const [rx, ry] of [
        [6, 6],
        [58, 6],
        [6, 58],
        [58, 58],
        [32, 6],
        [32, 58],
      ] as const) {
        ctx.fillRect(rx - 1, ry - 1, 3, 3);
      }
    } else if (kind === "plank") {
      // boardwalk: 8px cross-planks, staggered butt joints, worn grain
      for (let p = 0; p < 8; p++) {
        const v = 216 + Math.floor(Math.random() * 26);
        ctx.fillStyle = `rgb(${v},${v - 18},${v - 40})`;
        ctx.fillRect(0, p * 8, 64, 8);
        ctx.fillStyle = "rgba(110,80,50,0.8)";
        ctx.fillRect(0, p * 8, 64, 1); // seam
        ctx.fillRect(((p * 29) % 61) + 2, p * 8, 1, 8); // butt joint
        ctx.fillStyle = "rgba(140,105,65,0.5)"; // grain scratch
        ctx.fillRect(
          Math.random() * 40,
          p * 8 + 2 + Math.random() * 4,
          14 + Math.random() * 18,
          1,
        );
      }
      ctx.fillStyle = "rgba(255,240,210,0.35)";
      for (let i = 0; i < 12; i++)
        ctx.fillRect(Math.random() * 60, Math.random() * 62, 3, 1);
    } else {
      // sand: warm tonal pools under soft ripple shadows
      ctx.fillStyle = "#f3ecd6";
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 18; i++) {
        const v = 205 + Math.floor(Math.random() * 34);
        blob(
          Math.random() * S,
          Math.random() * S,
          16 + Math.random() * 20,
          `rgba(${v},${v - 12},${v - 40},0.35)`,
        );
      }
      for (let i = 0; i < 8; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          10 + Math.random() * 12,
          "rgba(255,250,232,0.35)",
        );
      ctx.strokeStyle = "rgba(186,164,120,0.22)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const y = 12 + i * 24;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 7, S * 0.7, y - 7, S, y);
        ctx.stroke();
      }
    }
    const tex = Level.finishTex(new THREE.CanvasTexture(canvas));
    this.surfTexCache.set(kind, tex);
    return tex;
  }

  // ONE place that finishes a painted texture, so no surface in the game is
  // accidentally left raw. Three things matter and all three were missing:
  //   colorSpace  — a canvas holds sRGB values. Left unset, three samples them
  //                 as if they were already linear and the output pass
  //                 brightens them again, which is why every deck read washed
  //                 out and chalky no matter what colour it was tinted.
  //   anisotropy  — floors are viewed at grazing angles almost all the time,
  //                 which is exactly where isotropic mipmaps smear to mush.
  //   filtering   — trilinear both ways. Nearest was a deliberate era choice.
  private static maxAniso = 8;
  static finishTex<T extends THREE.Texture>(tex: T, repeatWrap = true): T {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Level.maxAniso;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (repeatWrap) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    tex.needsUpdate = true;
    return tex;
  }
  // The renderer knows the real cap; main calls this once at boot.
  static setMaxAnisotropy(n: number): void {
    Level.maxAniso = Math.max(1, Math.min(16, Math.floor(n)));
  }

  // How a surface catches the light. Lambert has no specular term at all,
  // which is why every deck read like matte paper no matter what it was made
  // of. These are deliberately restrained — a sealed concrete floor has a
  // sheen, it is not a mirror — but it is the difference between a shape and
  // a silhouette when the sun is low.
  private static readonly SHEEN: Record<
    string,
    { spec: number; shine: number }
  > = {
    metal: { spec: 0x6e7784, shine: 60 },
    pavement: { spec: 0x2e3238, shine: 22 },
    asphalt: { spec: 0x24262a, shine: 14 },
    stone: { spec: 0x2a2c30, shine: 18 },
    checker: { spec: 0x34383e, shine: 26 },
    plank: { spec: 0x22201c, shine: 12 },
    wood: { spec: 0x1e1c18, shine: 10 },
    sand: { spec: 0x141414, shine: 4 },
    dirt: { spec: 0x121212, shine: 3 },
    grass: { spec: 0x101410, shine: 3 },
    jungle: { spec: 0x101410, shine: 3 },
    moss: { spec: 0x0e120e, shine: 3 },
  };
  // Rebuild a source material as a lit surface with a tiled texture on it,
  // keeping whatever the caller had set (tint, emissive, side, transparency).
  private surfaceMat(
    src: THREE.Material,
    kind: string,
  ): THREE.MeshPhongMaterial {
    const l = src as THREE.MeshLambertMaterial;
    const sheen = Level.SHEEN[kind] ?? { spec: 0x1a1c20, shine: 12 };
    const m = new THREE.MeshPhongMaterial({
      color: l.color ? l.color.clone() : new THREE.Color(0xffffff),
      emissive: l.emissive ? l.emissive.clone() : new THREE.Color(0x000000),
      specular: new THREE.Color(sheen.spec),
      shininess: sheen.shine,
      side: src.side,
      transparent: src.transparent,
      opacity: src.opacity,
      depthWrite: src.depthWrite,
      alphaTest: src.alphaTest,
      flatShading:
        (l as unknown as { flatShading?: boolean }).flatShading ?? false,
    });
    m.userData = { ...src.userData };
    return m;
  }

  // Per-deck copy of a base material with a surface texture tiled on it.
  private patterned(
    mat: THREE.Material,
    w: number,
    d: number,
    kind = "checker",
  ): THREE.MeshPhongMaterial {
    const m = this.surfaceMat(mat, kind);
    const tex = this.surfaceTexture(kind).clone();
    const density =
      kind === "grass"
        ? 8.5 // soft 128px kinds tile larger so blobs read
        : kind === "jungle"
          ? 8
          : kind === "wood"
            ? 3.2
            : kind === "plank"
              ? 3.4
              : kind === "sand"
                ? 7.5
                : kind === "dirt"
                  ? 7
                  : kind === "moss"
                    ? 6
                    : kind === "pavement"
                      ? 6
                      : kind === "asphalt"
                        ? 8 // one paint stripe per 8u = parking bays
                        : kind === "metal"
                          ? 3
                          : 4;
    tex.repeat.set(
      Math.max(1, Math.round(w / density)),
      Math.max(1, Math.round(d / density)),
    );
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
  private baseMats = new Map<string, THREE.MeshPhongMaterial>();
  private baseMat(
    key: string,
    color: number,
    kind = "",
    rx = 2,
    ry = 2,
  ): THREE.MeshPhongMaterial {
    let m = this.baseMats.get(key);
    if (m) return m;
    const sheen = Level.SHEEN[kind] ?? { spec: 0x1a1c20, shine: 12 };
    m = new THREE.MeshPhongMaterial({
      color,
      specular: sheen.spec,
      shininess: sheen.shine,
    });
    if (kind !== "") {
      const tex = this.surfaceTexture(kind).clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      m.map = tex;
      m.userData.texKind = kind; // capture reads this back
    }
    this.baseMats.set(key, m);
    return m;
  }

  // Per-level structural palette. Builders re-tint these before placing.
  private wallTint = 0xb89a70; // perimeter walls / end wall
  private blockTint = 0xc0a878; // step blocks, stair climbs
  private curbTint = 0xe8a84e; // painted deck-edge strips
  private bermTint = 0x3f8a34; // jungle strip shoulders

  // Rails come out of rails.ts plain grey; reskin every segment in light steel
  // and the posts in dark iron. They used to carry a drifting violet chrome
  // texture, which read as a magic effect rather than as something to grind —
  // a rail wants to look like metal and get out of the way. Shared materials.
  // Visual only: rail snap logic never looks at these meshes.
  private dressRails(): void {
    const railMat = new THREE.MeshPhongMaterial({
      color: 0xc9d0d8,
      specular: 0x6a727c,
      shininess: 40,
    });
    const postMat = new THREE.MeshLambertMaterial({
      color: 0x3c424e,
      emissive: 0x11141a,
    });
    for (const rail of this.rails) {
      rail.object.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = m.geometry.type === "CylinderGeometry" ? railMat : postMat;
      });
    }
  }

  constructor(scene: THREE.Scene, entry: LevelEntry = BUILTIN_LEVELS[0]) {
    this.scene = scene;
    scene.add(this.root);
    this.name = entry.name;
    // A user level carries its own component data and builds through the same
    // pipeline the editor writes. A built-in has none, so its id picks the
    // hand-coded builder — built-ins stay pristine, editing one forks a copy.
    if (entry.data)
      this.buildCustom(
        migrateCustomLevel(
          JSON.parse(JSON.stringify(entry.data)) as CustomLevelData,
        ),
      );
    else if (entry.id === "flats") this.buildFlats();
    else if (entry.id === "sky") this.buildSkyBridge();
    else if (entry.id === "slip") this.buildSlipstream();
    else if (entry.id === "dark") this.buildNightworks();
    else if (entry.id === "warproom") this.buildWarpRoom();
    else if (entry.id === "descent") this.buildDescent();
    else this.buildJungle(); // "jungle": the enclosed corridor course
    this.sealVertBacks(); // every pipe is placed by now, so shared ridges are known
    this.dressRails(); // every builder is done adding rails by now
    this.placeClock(); // time-trial stopwatch near spawn (only where a finish gate exists)
    this.placeComboOrb(); // combo-run orb, the other side of the racing line
    this.bakeDecor(); // any batched decor the builder didn't flush itself
    this.buildTorchLights(); // every torch is placed by now — the pool is sized once
    this.buildAmbient(); // theme is set by the builder above
    this.clearPlayFog(); // ...and the course you run on comes back out of it
  }

  // FOG OFF THE COURSE ITSELF.
  //
  // The haze is there to make distance read and to hide where the world ends,
  // and it does that job on the scenery and the backdrop. On the surfaces you
  // are actually playing — the path under your feet, the platform you are
  // aiming at, the wall you are about to ride — it just washes them out and
  // takes the edges off the things you need to judge. So the fog flag comes
  // off every ground mesh and every structural material, and stays on for
  // everything else. Same scene fog, applied where it helps and not where it
  // hurts.
  private clearPlayFog(): void {
    // A DARK level opts out: there the haze is a design tool — the course
    // ahead is supposed to vanish into the black and arrive as firelight,
    // not sit fully readable across the void. Everywhere else the course
    // stays fog-free so it never washes out at distance.
    if (this.keepPlayFog) return;
    const off = (m: THREE.Material | THREE.Material[]): void => {
      for (const one of Array.isArray(m) ? m : [m]) {
        const f = one as THREE.Material & { fog?: boolean };
        if (f.fog === false) continue;
        f.fog = false;
        f.needsUpdate = true; // the flag is compiled into the shader
      }
    };
    for (const g of this.groundMeshes) off(g.material);
    for (const m of this.baseMats.values()) off(m); // walls, blocks, ramps
  }

  // SOLID BACKS. A transition is a one-sided sheet: from behind you'd ride up
  // its convex face, or drop straight through into the pipe. A thin collision
  // slab just outside each coping line stops that, ending 0.4 short of the lip
  // so lip play stays clear. Skipped where ANOTHER pipe's mouth opens across
  // that line — that's a shared ridge, and the spine transfer plus the
  // ride-through both need it open. Runs once, after every builder is done, so
  // it can see all the pipes at the time it decides.
  private sealVertBacks(): void {
    for (const hp of this.halfpipes) {
      const along = (hp.l0 + hp.l1) / 2;
      const len = Math.abs(hp.l1 - hp.l0);
      for (const side of [-1, 1]) {
        const lipC = hp.cross + side * hp.lipX;
        const probe = lipC + side * 1.0;
        const shared = this.halfpipes.some((o) => {
          if (o === hp || o.axis !== hp.axis) return false;
          const oAlong = (o.l0 + o.l1) / 2;
          if (Math.abs(oAlong - along) > (Math.abs(o.l1 - o.l0) + len) / 2)
            return false;
          return Math.abs(probe - o.cross) <= o.lipX - 0.3; // inside its mouth
        });
        if (shared) continue;
        const h = hp.lipY - hp.yBottom - 0.4;
        const cy = hp.yBottom + h / 2;
        // 1.45 clear of the lip line: a rider hugging the INSIDE face at the
        // coping reaches within a player-half of it, and the back slab must
        // never clip that climb
        const bc = lipC + side * 1.45;
        this.walls.push(
          new THREE.Box3().setFromCenterAndSize(
            hp.axis === "z"
              ? new THREE.Vector3(bc, cy, along)
              : new THREE.Vector3(along, cy, bc),
            hp.axis === "z"
              ? new THREE.Vector3(1.3, h, len)
              : new THREE.Vector3(len, h, 1.3),
          ),
        );
      }
    }
  }

  // The editor raycasts level geometry for picking; everything a component
  // creates is tagged with userData.editorIdx (see buildCustom).
  get pickRoot(): THREE.Group {
    return this.root;
  }

  // ---- CAPTURE: any level -> editor components -----------------------------
  // Levels built from data return their own data verbatim. Hand-coded levels
  // are HARVESTED from the live scene after building — positions are read off
  // the final meshes/entities, so anything a builder moved after creating it
  // comes through correct by construction. Bespoke set pieces with no component
  // language (boulder chase, movers, decor foliage, finish gates) are
  // skipped: the copy is the editable geometry. Travel zones and sagging
  // ropes DO come through — they have components now.
  private builtFromData: CustomLevelData | null = null;
  captureData(): CustomLevelData {
    if (this.builtFromData) {
      return migrateCustomLevel(
        JSON.parse(JSON.stringify(this.builtFromData)) as CustomLevelData,
      );
    }
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    const C: CustomComponent[] = [];
    const groups: CustomGroup[] = [];
    const matInfo = (m: THREE.Mesh): { color?: string; tex?: string } => {
      const mat = m.material as THREE.MeshLambertMaterial;
      const color = mat?.color ? "#" + mat.color.getHexString() : undefined;
      const tex = (mat?.userData?.texKind as string) || undefined;
      return {
        color: color === "#ffffff" ? undefined : color,
        tex: tex === "checker" ? undefined : tex,
      };
    };
    const hpWalls = new Set(this.halfpipes.flatMap((hp) => hp.walls));
    const crumbleMeshes = new Set(this.crumbles.map((c) => c.mesh));
    // The warp pad's masonry stands in groundMeshes so you can ride onto it,
    // but it is NOT level geometry — the gate component rebuilds it. Without
    // this the drum's cylinders fell through to the exotic-standable branch
    // below, were captured as three bounding-box platforms, and the gate then
    // built a real pad on top of them: three phantom slabs at the finish, and
    // three more with every further edit.
    const padSolids = new Set(this.warpPads.flatMap((w) => w.solids));
    // a moving platform IS a groundMesh, but its own 'mover' component rebuilds
    // it — capturing it here too would leave a static slab at its rest spot
    const moverMeshes = new Set(this.movers.map((mv) => mv.mesh));
    // decks, ramps, step blocks, metal crates — everything standable
    for (const m of this.groundMeshes) {
      if (
        hpWalls.has(m) ||
        crumbleMeshes.has(m) ||
        padSolids.has(m) ||
        moverMeshes.has(m)
      )
        continue;
      // A displaced ground strip carries its own component (see jungle()).
      // Without this it fell through to the bounding-box branch below and an
      // edited level traded its rolling floor for a slab.
      const tc = m.userData.terrainComp as CustomComponent | undefined;
      if (tc) {
        C.push(JSON.parse(JSON.stringify(tc)) as CustomComponent);
        continue;
      }
      // Transition surfaces belong to their vertramp component, which rebuilds
      // them. hpWalls only covers the ANALYTIC pipes; a swept one is a plain
      // mesh, so it used to be captured as a bounding-box platform AND rebuilt
      // by its component — a flat slab buried in the bowl, one more per edit.
      // The flag catches every sweep, including the non-vert 'slide deck'
      // variant the Slipstream is made of, which the name check missed.
      if (m.userData.vertRampMesh || m.name === "halfpipe") continue;
      if (m.userData.metalCrate) {
        C.push({
          t: "metal",
          p: [r2(m.position.x), r2(m.position.y - 0.48), r2(m.position.z)],
        });
        continue;
      }
      const geo = m.geometry as THREE.BoxGeometry;
      const { color, tex } = matInfo(m);
      if (geo.type === "BoxGeometry" && (geo as THREE.BoxGeometry).parameters) {
        const gp = (geo as THREE.BoxGeometry).parameters;
        if (Math.abs(m.rotation.x) > 0.01) {
          // a slope built by ramp(): invert its construction — recover the two
          // top-surface edge lines from the rotation and the surface normal
          const len = gp.depth;
          const dy = Math.sin(m.rotation.x) * len;
          const dz = -Math.cos(m.rotation.x) * len;
          const cy = m.position.y - (dz / len) * 0.5;
          const cz = m.position.z + (dy / len) * 0.5;
          let z0 = cz - dz / 2,
            z1 = cz + dz / 2,
            y0 = cy - dy / 2,
            y1 = cy + dy / 2;
          if (z0 < z1) {
            [z0, z1] = [z1, z0];
            [y0, y1] = [y1, y0];
          }
          C.push({
            t: "ramp",
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
            t: "platform",
            p: [r2(m.position.x), r2(m.position.y), r2(m.position.z)],
            s: [r2(gp.width), r2(gp.height), r2(gp.depth)],
            yaw: yaw !== 0 ? yaw : undefined,
            color,
            tex,
            // the Sky Bridge's icy planks are a HAZARD, not a colour: without
            // this a captured copy of that level turned every slippy plank
            // into ordinary wood and the level lost its whole point
            slip: m.userData.slippy === true ? true : undefined,
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
          t: "platform",
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
    // SCENERY. Logged by the decor helpers as they draw (see noteDecor), so
    // capturing a hand-coded level keeps its foliage instead of stripping the
    // world back to grey boxes.
    for (const d of this.decorLog) C.push(JSON.parse(JSON.stringify(d)) as CustomComponent);
    // visible walls (built by wall(); positions live off the meshes)
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      const spec = m.userData?.wallSpec as
        | { w: number; d: number; h: number; visH: number }
        | undefined;
      if (!spec) return;
      C.push({
        t: "wall",
        p: [
          r2(m.position.x),
          r2(m.position.y - spec.visH / 2),
          r2(m.position.z),
        ],
        s: [r2(spec.w), r2(spec.visH), r2(spec.d)],
        ...matInfo(m),
      });
    });
    // halfpipes, with their true profile (flat half + radius). They come back
    // as the vert part, straight and 90°, which rebuilds on the same backing.
    for (const hp of this.halfpipes) {
      const along = (hp.l0 + hp.l1) / 2;
      C.push({
        t: "vertramp",
        p:
          hp.axis === "z"
            ? [r2(hp.cross), r2(hp.yBottom), r2(along)]
            : [r2(along), r2(hp.yBottom), r2(hp.cross)],
        len: r2(Math.abs(hp.l1 - hp.l0)),
        yaw: hp.axis === "x" ? 90 : 0,
        w: r2(hp.flatHalf),
        rise: r2(hp.radius),
        vkind: "half",
      });
    }
    // swept vert parts (bowls, corners, spines, banked troughs) come back as
    // the component that drew them — they carry it on the mesh
    const sweptCopings: THREE.Vector3[][] = [];
    for (const o of this.root.children) {
      const vc = o.userData.vertComp as CustomComponent | undefined;
      if (!vc) continue;
      C.push(JSON.parse(JSON.stringify(vc)) as CustomComponent);
      for (const line of (o.userData.vertCopings as
        | THREE.Vector3[][]
        | undefined) ?? [])
        sweptCopings.push(line);
    }
    // rails — skipping coping lines, which the vert parts regrow themselves
    const isCoping = (pts: THREE.Vector3[]): boolean =>
      sweptCopings.some(
        (line) =>
          line.length === pts.length &&
          line.every((q, i) => q.distanceToSquared(pts[i]) < 0.05),
      ) ||
      this.halfpipes.some((hp) => {
        const y = hp.lipY + 0.05;
        return pts.every((p) => {
          const crossV = hp.axis === "z" ? p.x : p.z;
          const alongV = hp.axis === "z" ? p.z : p.x;
          return (
            Math.abs(p.y - y) < 0.2 &&
            Math.abs(Math.abs(crossV - hp.cross) - hp.lipX) < 0.3 &&
            alongV > Math.min(hp.l0, hp.l1) - 1 &&
            alongV < Math.max(hp.l0, hp.l1) + 1
          );
        });
      });
    const ropeRails = new Set(this.ropes.map((r) => r.rail));
    // A TRAVELLING rail is captured from its BUILD position (the live nodes
    // are wherever the cycle has carried them this frame) plus its motion.
    const movingRailSet = new Set(this.movingRails.map((m) => m.rail));
    for (const mr of this.movingRails) {
      const off = mr.object.position;
      const a = mr.rail.points[0];
      const b = mr.rail.points[mr.rail.points.length - 1];
      C.push({
        t: "rail",
        p: [
          r2((a.x + b.x) / 2 - off.x),
          r2((a.y + b.y) / 2 - off.y),
          r2((a.z + b.z) / 2 - off.z),
        ],
        len: r2(Math.hypot(b.x - a.x, b.z - a.z)),
        yaw: r2(THREE.MathUtils.radToDeg(Math.atan2(b.x - a.x, b.z - a.z))),
        axis:
          Math.abs(mr.axisV.x) > 0.5
            ? "x"
            : Math.abs(mr.axisV.y) > 0.5
              ? "y"
              : "z",
        amp: r2(mr.amp),
        speed: r2(mr.speed),
        phase: r2(mr.phase),
      });
    }
    for (const rail of this.rails) {
      const pts = rail.points;
      if (
        pts.length < 2 ||
        isCoping(pts) ||
        ropeRails.has(rail) ||
        movingRailSet.has(rail) ||
        this.terrainRails.has(rail)
      )
        continue;
      const p0 = pts[0];
      C.push({
        t: "rail",
        p: [r2(p0.x), r2(p0.y), r2(p0.z)],
        pts: pts.map(
          (p) =>
            [r2(p.x - p0.x), r2(p.z - p0.z), 0, r2(p.y - p0.y)] as [
              number,
              number,
              number,
              number,
            ],
        ),
        invisible: rail.object.children.length === 0 ? true : undefined,
      });
    }
    // finish gate (where the run ends) + the run-mode activators beside spawn
    if (this.gateSpec) {
      C.push({
        t: "gate",
        p: [r2(this.gateSpec.x), r2(this.gateSpec.y), r2(this.gateSpec.z)],
        yaw: this.gateYaw ? r2(this.gateYaw) : undefined,
      });
    }
    if (this.clockPickup) {
      const g = this.clockPickup.group; // baseY, not live y — the bob animation is mid-flight
      C.push({
        t: "clock",
        p: [
          r2(g.position.x),
          r2((g.userData.baseY as number) - 1.35),
          r2(g.position.z),
        ],
      });
    }
    if (this.comboOrb) {
      const g = this.comboOrb.group;
      C.push({
        t: "comboorb",
        p: [
          r2(g.position.x),
          r2((g.userData.baseY as number) - 1.3),
          r2(g.position.z),
        ],
      });
    }
    // crumble pads
    for (const cr of this.crumbles) {
      const gp = (cr.mesh.geometry as THREE.BoxGeometry).parameters;
      C.push({
        t: "crumble",
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
        ? cr.nitroBang
          ? "nitrobang"
          : "nitro"
        : cr.bouncy
          ? "bouncy"
          : cr.metalBounce
            ? "metalbounce"
            : cr.tnt
              ? "tnt"
              : cr.mask
                ? "mask"
                : cr.mystery
                  ? "mystery"
                  : cr.bang
                    ? "bang"
                    : "wood";
      const gids = cr.groupIds ?? [];
      for (let gi = 0; gi < gids.length; gi++) {
        if (!seenGroups.has(gids[gi])) {
          seenGroups.add(gids[gi]);
          groups.push({ id: gids[gi], parent: gids[gi + 1] });
        }
      }
      C.push({
        t: "crate",
        p: [
          r2(cr.mesh.position.x),
          r2(cr.mesh.position.y - 0.48),
          r2(cr.mesh.position.z),
        ],
        kind: kind === "wood" ? "wood" : (kind as CustomComponent["kind"]),
        outline: cr.wasOutline || undefined,
        grp: gids[0],
      });
    }
    for (const e of this.enemies) {
      const range = r2((e.x1 - e.x0) / 2);
      const foe = e.kind !== "grunt" ? e.kind : undefined;
      C.push(
        e.axis === "z"
          ? {
              t: "enemy",
              p: [r2(e.group.position.x), r2(e.baseY), r2((e.x0 + e.x1) / 2)],
              range,
              speed: r2(e.speed),
              foe,
              yaw: 90,
            }
          : {
              t: "enemy",
              p: [r2((e.x0 + e.x1) / 2), r2(e.baseY), r2(e.group.position.z)],
              range,
              speed: r2(e.speed),
              foe,
            },
      );
    }
    for (const cp of this.checkpoints) {
      C.push({
        t: "checkpoint",
        p: [r2(cp.spawnPos.x), r2(cp.spawnPos.y - 0.1), r2(cp.spawnPos.z)],
      });
    }
    for (const pk of this.pickups) {
      const y = (pk.mesh.userData.baseY as number) ?? pk.mesh.position.y;
      C.push({
        t: "wumpa",
        p: [r2(pk.mesh.position.x), r2(y), r2(pk.mesh.position.z)],
      });
    }
    for (const mv of this.movers) {
      const par = (mv.mesh.geometry as THREE.BoxGeometry).parameters;
      C.push({
        t: "mover",
        p: [r2(mv.base.x), r2(mv.base.y + 0.4), r2(mv.base.z)], // base is the deck CENTER; p is its top
        s: [r2(par.width), r2(par.height), r2(par.depth)],
        axis:
          Math.abs(mv.axisV.x) > 0.5
            ? "x"
            : Math.abs(mv.axisV.y) > 0.5
              ? "y"
              : "z",
        amp: r2(mv.amp),
        speed: r2(mv.speed),
        phase: r2(mv.phase),
        lit: mv.torch ? true : undefined,
      });
    }
    // Torches carried BY a phase pad or riding a mover are that component's
    // own dressing — it rebuilds them, so capturing them again would double
    // them up.
    const carriedTorches = new Set([
      ...this.phasePads.flatMap((p) => p.torches),
      ...this.movers.flatMap((m) => (m.torch ? [m.torch] : [])),
    ]);
    for (const t of this.torches) {
      if (carriedTorches.has(t)) continue;
      const spec = t.group.userData.torchSpec as
        | { h: number; scale: number }
        | undefined;
      C.push({
        t: "torch",
        p: [r2(t.group.position.x), r2(t.group.position.y), r2(t.group.position.z)],
        rise: spec ? r2(spec.h) : undefined,
        w: spec ? r2(spec.scale) : undefined,
      });
    }
    for (const pad of this.phasePads) {
      const par = (pad.mesh.geometry as THREE.BoxGeometry).parameters;
      C.push({
        t: "phasepad",
        p: [
          r2(pad.mesh.position.x),
          r2(pad.mesh.position.y + 0.3), // mesh centre -> the top surface p means
          r2(pad.mesh.position.z),
        ],
        s: [r2(par.width), r2(par.height), r2(par.depth)],
        cycle: r2(pad.cycle),
        phase: r2(pad.phase),
        amp: r2(pad.duty),
      });
    }
    for (const st of this.stones) {
      C.push({
        t: "stone",
        // the mesh sits r above the floor it found; hand that floor back as
        // the y hint so a rebuild lands the boulder on the same deck
        p: [
          r2(st.x),
          r2(st.mesh.position.y - st.r),
          r2((st.z0 + st.z1) / 2),
        ],
        range: r2((st.z0 - st.z1) / 2),
        speed: r2(st.speed),
        radius: r2(st.r),
      });
    }
    for (const cu of this.crushers) {
      C.push({
        t: "crusher",
        p: [r2(cu.x), r2(cu.restY - cu.h / 2), r2(cu.z)],
        s: [r2(cu.w), r2(cu.h), r2(cu.d)],
        cycle: r2(cu.cycle),
        phase: r2(cu.phase),
      });
    }
    for (const pe of this.pendulums) {
      C.push({
        t: "pendulum",
        p: [
          r2(pe.pivot.position.x),
          r2(pe.pivot.position.y),
          r2(pe.pivot.position.z),
        ],
        len: r2(pe.len),
        amp: r2(pe.amp),
        speed: r2(pe.speed),
        phase: r2(pe.phase),
        yaw: pe.yaw ? Math.round(THREE.MathUtils.radToDeg(pe.yaw)) : undefined,
      });
    }
    for (const rs of this.ropeSwings) {
      C.push({
        t: "ropeswing",
        // a TRAVELLING rope is captured at the base of its run, not wherever
        // the cycle has carried the anchor this frame
        p: rs.travel
          ? [r2(rs.travel.base.x), r2(rs.travel.base.y), r2(rs.travel.base.z)]
          : [r2(rs.anchor.x), r2(rs.anchor.y), r2(rs.anchor.z)],
        len: r2(rs.len),
        amp: r2(rs.amp),
        speed: r2(rs.speed),
        phase: r2(rs.phase),
        yaw: rs.yaw ? Math.round(THREE.MathUtils.radToDeg(rs.yaw)) : undefined,
        // `range` + `axis` + `cycle` are the anchor's own travel
        range: rs.travel ? r2(rs.travel.amp) : undefined,
        axis: rs.travel
          ? Math.abs(rs.travel.axisV.x) > 0.5
            ? "x"
            : Math.abs(rs.travel.axisV.y) > 0.5
              ? "y"
              : "z"
          : undefined,
        cycle: rs.travel ? r2(rs.travel.speed) : undefined,
      });
    }
    // sagging ropes: endpoints off the taut rest nodes
    for (const rope of this.ropes) {
      const a = rope.rest[0];
      const bnd = rope.rest[rope.rest.length - 1];
      const len = Math.hypot(bnd.x - a.x, bnd.z - a.z);
      const yaw = Math.round(
        THREE.MathUtils.radToDeg(Math.atan2(bnd.x - a.x, bnd.z - a.z)),
      );
      C.push({
        t: "rope",
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
        t: "zone",
        p: [r2((zn.xMin + zn.xMax) / 2), 0.5, r2((zn.zMin + zn.zMax) / 2)],
        s: [r2(zn.xMax - zn.xMin), 1, r2(zn.zMax - zn.zMin)],
        dir: zn.dir,
      });
    }
    if (this.crystalPickup) {
      const p = this.crystalPickup.group.position;
      C.push({ t: "crystal", p: [r2(p.x), r2(p.y), r2(p.z)] });
    }
    // CAMERA LANE. The rig and the control frame ease along this spine, so a
    // level that loses it stops steering with the course — which is exactly
    // what happened to the Slipstream the moment it became editable. (A level
    // built FROM data returns that data verbatim at the top of this method,
    // camnodes included; this is the hand-coded path, which holds a dense
    // centreline sample instead.) Hand it back in the editor's own language:
    // camnodes, near-losslessly simplified and gathered into one group.
    if (this.lanePts.length >= 2) {
      // A node's HEIGHT is load-bearing, not decoration: laneDirAt picks the
      // nearest segment in 3D so a course that passes over itself steers by
      // the deck you are actually on. Emit the spine's own y — lifting the
      // nodes to make them prettier in the editor would move the lane off the
      // road and hand the steering back to the wrong deck.
      // one collapsible outliner row instead of a hundred loose diamonds
      const laneGrp = groups.reduce((m, g) => Math.max(m, g.id), 0) + 1;
      groups.push({ id: laneGrp, nm: "camera lane" });
      for (const p of simplifyPath(this.lanePts, LANE_SIMPLIFY_EPS))
        C.push({
          t: "camnode",
          p: [r2(p.x), r2(p.y), r2(p.z)],
          grp: laneGrp,
        });
    }
    return {
      v: 1,
      name: `${this.name} (copy)`,
      spawn: [r2(this.spawnPos.x), r2(this.spawnPos.y), r2(this.spawnPos.z)],
      killY: r2(this.killY),
      // only when it isn't the default, so the saved JSON stays quiet
      sky: this.skyPreset === DEFAULT_SKY ? undefined : this.skyPreset,
      components: C,
      groups,
    };
  }

  // CUSTOM: build the editor's level from data. Two passes so entities that
  // seat themselves on the ground (crates, enemies, checkpoints) see the
  // geometry pass's floors. Every scene object a component creates gets
  // tagged with its component index for editor picking.
  private buildCustom(data: CustomLevelData): void {
    this.builtFromData = data; // captureData: a data-built level IS its own capture
    this.skyPreset = asSkyPreset(data.sky); // unknown/absent -> sunset
    this.killY = data.killY;
    this.finishZ = -1e9; // endless playground: no finish gate
    this.endWallZ = -1e9;
    this.theme = {
      skyTop: "#159ecd",
      skyBottom: "#c9f0e4",
      sunColorHex: "#fff8dc",
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
    // Bake the scenery for PLAY (hundreds of one-plant meshes is the whole
    // frame budget on a phone); leave it loose for the EDITOR, which has to
    // be able to click an individual fern.
    this.batchDecor = !EDITOR_BUILD;

    const deck = new THREE.MeshLambertMaterial({ color: 0xffffff });
    // tag every root child a component adds with that component's index
    const buildTagged = (idx: number, fn: () => void): void => {
      const before = this.root.children.length;
      fn();
      for (let c = before; c < this.root.children.length; c++) {
        this.root.children[c].traverse((o) => (o.userData.editorIdx = idx));
        this.root.children[c].userData.editorIdx = idx;
      }
    };
    const geomPass = new Set([
      "terrain",
      "platform",
      "ramp",
      "wall",
      "vertramp",
      "rail",
      "rope",
      "crumble",
      "pit",
      "metal",
      "rock",
      "gate",
      "mover", // a moving platform is terrain: crates seat on it
    ]);
    const laneVis: THREE.Vector3[] = []; // camnode positions, in chain order
    const laneRaw: [number, number, number, number][] = []; // [x, z, corner radius, y] per node
    // '!' WIRING IS THE GROUPING: every group that holds (or contains, via
    // nesting) a '!' switch. Breakable crates in these groups start as
    // outline ghosts automatically — no per-crate flag to remember.
    const bangGroups = new Set<number>();
    for (const c of data.components) {
      if (c.t === "crate" && c.kind === "bang")
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
          const tinted = (
            fallback: THREE.MeshLambertMaterial,
          ): THREE.MeshLambertMaterial =>
            c.color
              ? new THREE.MeshLambertMaterial({
                  color: new THREE.Color(c.color),
                })
              : fallback;
          // VECTOR SHAPES: a 3+ point outline turns platform/wall/pit into a
          // drawn polygon. Shape points are authored in XZ around p; three.js
          // Shapes live in XY, so (x, -z) + rotateX(-90°) lands them flat.
          // corner radii fillet the outline BEFORE any geometry/collision is
          // derived, so the rounding is real everywhere (edits stay on the
          // raw nodes — handles and saves never see the fillet points)
          const polyPts =
            c.pts && c.pts.length >= 3
              ? roundCorners(c.pts, true).map(
                  (q) => [q.x, q.z] as [number, number],
                )
              : null;
          const polyShape = (): THREE.Shape => {
            const sh = new THREE.Shape();
            sh.moveTo(polyPts![0][0], -polyPts![0][1]);
            for (let k = 1; k < polyPts!.length; k++)
              sh.lineTo(polyPts![k][0], -polyPts![k][1]);
            sh.closePath();
            return sh;
          };
          // texture tiling for drawn polygons follows the outline's bounds
          const polySpan = (): [number, number] => {
            let nx = Infinity,
              xx = -Infinity,
              nz = Infinity,
              xz = -Infinity;
            for (const [px, pz] of polyPts!) {
              nx = Math.min(nx, px);
              xx = Math.max(xx, px);
              nz = Math.min(nz, pz);
              xz = Math.max(xz, pz);
            }
            return [xx - nx, xz - nz];
          };
          if (c.t === "platform" && polyPts) {
            // drawn deck: extruded slab, walkable via the ground raycast.
            // Sides are raycast-only (the collision engine is AABB — same
            // deal as free-spun rectangles).
            const th = c.s?.[1] ?? 1;
            const geo = new THREE.ExtrudeGeometry(polyShape(), {
              depth: th,
              bevelEnabled: false,
            });
            geo.rotateX(-Math.PI / 2);
            const [pw, pd] = polySpan();
            const mesh = new THREE.Mesh(
              geo,
              this.patterned(tinted(deck), pw, pd, c.tex ?? "checker"),
            );
            mesh.position.set(c.p[0], c.p[1] - th / 2, c.p[2]); // extrude spans local y 0..th; p is the slab centre
            mesh.name = "platform";
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
          } else if (c.t === "wall" && polyPts) {
            // drawn wall/blocker: extruded up from the base; the solid inside
            // is filled with 1-unit scanline slabs so the AABB engine pushes
            // back everywhere, including diagonal faces (coarsely).
            const h = c.s?.[1] ?? 4;
            const geo = new THREE.ExtrudeGeometry(polyShape(), {
              depth: h,
              bevelEnabled: false,
            });
            geo.rotateX(-Math.PI / 2);
            const wallBase = tinted(
              new THREE.MeshLambertMaterial({ color: 0x9a8a7a }),
            );
            const [ww, wd] = polySpan();
            const mesh = new THREE.Mesh(
              geo,
              c.tex
                ? this.patterned(wallBase, Math.max(ww, wd), h + 2, c.tex)
                : wallBase,
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]); // extrude spans local y 0..h; p is the base centre
            this.root.add(mesh);
            this.groundMeshes.push(mesh); // the top is standable
            this.fillWallSlabs(polyPts, c.p[0], c.p[2], c.p[1], h);
          } else if (c.t === "pit" && polyPts) {
            // drawn death pool: dark polygon visual; the kill volume is the
            // bounding box gated by a true point-in-polygon test (see
            // pitMissesPoly) so only the drawn shape burns.
            const geo = new THREE.ShapeGeometry(polyShape());
            geo.rotateX(-Math.PI / 2);
            const pool = new THREE.Mesh(
              geo,
              new THREE.MeshBasicMaterial({
                color: 0x0a0a10,
                side: THREE.DoubleSide,
              }),
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
              new THREE.Vector3(
                c.p[0] + (minX + maxX) / 2,
                c.p[1] - 0.75,
                c.p[2] + (minZ + maxZ) / 2,
              ),
              new THREE.Vector3(maxX - minX, 2.0, maxZ - minZ),
            );
            this.pitBoxes.push(box);
            this.pitPolyByBox.set(box, {
              cx: c.p[0],
              cz: c.p[2],
              pts: polyPts,
            });
          } else if (c.t === "platform") {
            const s = c.s ?? [8, 1, 8];
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], s[1], s[2]),
              this.patterned(tinted(deck), s[0], s[2], c.tex ?? "checker"),
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]);
            mesh.rotation.y = THREE.MathUtils.degToRad(c.yaw ?? 0); // ride surface is raycast: free spin is fine
            mesh.name = c.slip ? "slippy plank" : "platform";
            if (c.slip) mesh.userData.slippy = true; // friction cut: can't stop short
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
          } else if (c.t === "rock") {
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
            const pos = geo.getAttribute("position") as THREE.BufferAttribute;
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
            geo.rotateY(
              (seed % 7) * 0.9 + THREE.MathUtils.degToRad(c.yaw ?? 0),
            );
            geo.computeVertexNormals(); // non-indexed = flat faceted shading
            geo.computeBoundingBox();
            const bb = geo.boundingBox!;
            const rockColor = c.color
              ? new THREE.Color(c.color).getHex()
              : 0x8d8678;
            const mesh = new THREE.Mesh(
              geo,
              new THREE.MeshLambertMaterial({
                color: rockColor,
                map: this.surfaceTexture(c.tex ?? "stone"),
              }),
            );
            mesh.position.set(c.p[0], c.p[1], c.p[2]);
            mesh.name = "rock";
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
                  new THREE.Vector3(
                    (bb.max.x - bb.min.x) * 0.94,
                    top - bottom,
                    (bb.max.z - bb.min.z) * 0.94,
                  ),
                ),
              );
            }
          } else if (c.t === "ramp") {
            const len = c.len ?? 10;
            const rise = c.rise ?? 4;
            const w = c.w ?? 8;
            this.ramp(
              "ramp",
              c.p[2] + len / 2,
              c.p[1],
              c.p[2] - len / 2,
              c.p[1] + rise,
              w,
              tinted(deck),
              c.p[0],
              c.tex ?? "stone",
            );
            const rad = THREE.MathUtils.degToRad(c.yaw ?? 0);
            if (rad) {
              // spin the built slope around the component centre: orbit its
              // offset position and compose the yaw BEFORE the slope pitch
              const m = this.root.children[this.root.children.length - 1];
              const dx = m.position.x - c.p[0];
              const dz = m.position.z - c.p[2];
              m.position.x = c.p[0] + dx * Math.cos(rad) + dz * Math.sin(rad);
              m.position.z = c.p[2] - dx * Math.sin(rad) + dz * Math.cos(rad);
              m.rotation.order = "YXZ";
              m.rotation.y = rad;
            }
          } else if (c.t === "wall") {
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
                    new THREE.Vector3(
                      swapped ? s[2] : s[0],
                      s[1],
                      swapped ? s[0] : s[2],
                    ),
                  ),
                );
              } else {
                this.fillWallSlabs(
                  rectCorners(s[0], s[2], yawQ),
                  c.p[0],
                  c.p[2],
                  c.p[1],
                  s[1],
                );
              }
            };
            if (c.invisible) {
              // collider only + an editor-mode ghost so it stays selectable
              wallCollider();
              const ghost = new THREE.Mesh(
                new THREE.BoxGeometry(s[0], s[1], s[2]),
                new THREE.MeshBasicMaterial({
                  color: 0x64d8ff,
                  transparent: true,
                  opacity: 0.22,
                  depthWrite: false,
                }),
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
                  new THREE.MeshLambertMaterial({
                    color: c.color
                      ? new THREE.Color(c.color)
                      : new THREE.Color(0x9a8a7a),
                  }),
                  s[0],
                  s[1],
                  c.tex ?? "stone",
                ),
              );
              mesh.position.set(c.p[0], c.p[1] + s[1] / 2, c.p[2]);
              mesh.rotation.y = yawRad;
              this.root.add(mesh);
              wallCollider();
            } else {
              // axis-aligned default texture path; 90/270 swaps footprint
              const swapped = yawQ % 180 !== 0;
              this.wall(
                c.p[0],
                c.p[2],
                swapped ? s[2] : s[0],
                swapped ? s[0] : s[2],
                c.p[1],
                s[1],
              );
            }
          } else if (c.t === "pit") {
            const s = c.s ?? [6, 1, 6];
            const yawQ = (((c.yaw ?? 0) % 360) + 360) % 360;
            const yawRad = THREE.MathUtils.degToRad(yawQ);
            // dark pool + faint ember rim; the volume is a touch-kill box
            const pool = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], 0.18, s[2]),
              new THREE.MeshLambertMaterial({
                color: 0x07070c,
                emissive: 0x1a0406,
              }),
            );
            pool.position.set(c.p[0], c.p[1] + 0.02, c.p[2]);
            pool.rotation.y = yawRad;
            this.root.add(pool);
            const rim = new THREE.Mesh(
              new THREE.BoxGeometry(s[0] + 0.5, 0.06, s[2] + 0.5),
              new THREE.MeshBasicMaterial({
                color: 0xb0402a,
                transparent: true,
                opacity: 0.5,
              }),
            );
            rim.position.set(c.p[0], c.p[1] + 0.001, c.p[2]);
            rim.rotation.y = yawRad;
            this.root.add(rim);
            // Kill volume hugs the pool: only 0.25 above the surface (feet must
            // actually touch the lava — landing on a crate seated over the pit
            // is safe), and 2.0 deep so a max-gravity fall can't step past it.
            // A spun pit kills through the rotated-corner polygon; the box is
            // just its broad phase (same machinery as drawn pits).
            const corners =
              yawQ % 180 === 0 ? null : rectCorners(s[0], s[2], yawQ);
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
              this.pitPolyByBox.set(box, {
                cx: c.p[0],
                cz: c.p[2],
                pts: corners,
              });
            } else {
              this.pitBoxes.push(
                new THREE.Box3().setFromCenterAndSize(
                  new THREE.Vector3(c.p[0], c.p[1] - 0.75, c.p[2]),
                  new THREE.Vector3(s[0], 2.0, s[2]),
                ),
              );
            }
          } else if (c.t === "metal") {
            // unbreakable steel box: stand on it, bonk off it, never break it
            const size = 0.96;
            const mesh = new THREE.Mesh(
              new THREE.BoxGeometry(size, size, size),
              new THREE.MeshLambertMaterial({
                color: 0xffffff,
                map: this.metalTexture(),
              }),
            );
            mesh.userData.metalCrate = true; // capture tag
            mesh.position.set(c.p[0], c.p[1] + size / 2, c.p[2]);
            this.root.add(mesh);
            this.groundMeshes.push(mesh);
            // side collider stops under the top face — standing on the box
            // must not trigger the XZ push-out (see the platform note)
            this.walls.push(
              new THREE.Box3().setFromCenterAndSize(
                new THREE.Vector3(
                  mesh.position.x,
                  mesh.position.y - 0.125,
                  mesh.position.z,
                ),
                new THREE.Vector3(size, size - 0.25, size),
              ),
            );
          } else if (c.t === "rail") {
            // invisible = a bare grind line (captured deck-edge ledges): full
            // physics, no chrome — the editor still shows its node handles
            if (c.pts && c.pts.length >= 2) {
              // multi-node rail: pen-drawn path — corner radii round the
              // bends, per-node height offsets climb and dive
              const rp = roundCorners(c.pts, false);
              const rail = new Rail(
                rp.map(
                  (q) =>
                    new THREE.Vector3(c.p[0] + q.x, c.p[1] + q.y, c.p[2] + q.z),
                ),
                !c.invisible,
              );
              this.rails.push(rail);
              this.root.add(rail.object);
            } else if (c.amp) {
              // amp on a straight rail = the whole line TRAVELS on a cycle
              this.movingRail(
                c.p[0],
                c.p[1],
                c.p[2],
                c.len ?? 12,
                c.yaw ?? 0,
                c.axis ?? "x",
                c.amp,
                c.speed ?? 0.6,
                c.phase ?? 0,
              );
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
          } else if (c.t === "vertramp") {
            this.buildVertRamp(c);
          } else if (c.t === "rope") {
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
          } else if (c.t === "gate") {
            // finish gate: crossing its plane ends the run (and the time trial)
            this.finishZ = c.p[2];
            this.finishGate(c.p[1], c.p[2], c.p[0], c.yaw ?? 0);
          } else if (c.t === "clock" || c.t === "comboorb") {
            // run-mode activators: just remember the authored spot — the
            // pickups build after every level's geometry (placeClock /
            // placeComboOrb), which tags them back to this component
            const spot = { x: c.p[0], y: c.p[1], z: c.p[2], idx: i };
            if (c.t === "clock") this.clockSpot = spot;
            else this.orbSpot = spot;
          } else if (c.t === "zone") {
            // travel zone: a region that turns the course sideways (E/W) or
            // runs it straight AT the camera (N). Invisible in play; the
            // editor reveals a tinted slab ghost with a direction arrow.
            const s = c.s ?? [14, 1, 10];
            this.zones.push({
              xMin: c.p[0] - s[0] / 2,
              xMax: c.p[0] + s[0] / 2,
              zMin: c.p[2] - s[2] / 2,
              zMax: c.p[2] + s[2] / 2,
              dir: c.dir ?? "E",
            });
            const ghost = new THREE.Mesh(
              new THREE.BoxGeometry(s[0], 0.3, s[2]),
              new THREE.MeshBasicMaterial({
                color: c.dir === "N" ? 0xffb060 : 0x9a6cff,
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
                color: c.dir === "N" ? 0xffb060 : 0x9a6cff,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
              }),
            );
            arrow.position.set(c.p[0], c.p[1] + 1.4, c.p[2]);
            arrow.rotation.z =
              c.dir === "E" ? -Math.PI / 2 : c.dir === "W" ? Math.PI / 2 : 0;
            if (c.dir === "N") arrow.rotation.x = Math.PI / 2; // points at the lens
            if (c.dir === "S") arrow.rotation.x = -Math.PI / 2; // points down-course
            arrow.visible = false;
            arrow.userData.editorGhost = true;
            this.root.add(arrow);
          } else if (c.t === "crumble") {
            const s = c.s ?? [3, 1, 3];
            const col = c.color ? new THREE.Color(c.color).getHex() : undefined;
            this.crumblePad(
              c.p[0],
              c.p[1],
              c.p[2],
              s[0],
              s[2],
              null,
              c.shake ?? 0.7,
              col,
              c.yaw ?? 0,
              c.tex ?? "wood",
              c.speed ?? 30,
            );
          } else if (c.t === "crate") {
            const gids = groupChainOf(c, data);
            // sharing a group with a '!' switch ghosts the crate until the
            // switch fires (switches themselves stay solid)
            const wiredToBang =
              c.kind !== "bang" &&
              c.kind !== "nitrobang" &&
              gids.some((id) => bangGroups.has(id));
            this.crate(
              c.p[0],
              c.p[1],
              c.p[2],
              c.kind === "wood" ? undefined : c.kind,
              {
                outline: c.outline || wiredToBang,
                groupIds: gids,
                noAuto: true, // the data already carries the fruit crate
              },
            );
          } else if (c.t === "outline") {
            // LEGACY saves: build as a wood crate in the outline state
            this.crate(c.p[0], c.p[1], c.p[2], undefined, {
              outline: true,
              groupIds: groupChainOf(c, data),
            });
          } else if (c.t === "checkpoint") {
            this.checkpoint(c.p[1], c.p[2], c.p[0]);
          } else if (c.t === "enemy") {
            const r = c.range ?? 5;
            const foe = (c.foe ?? "grunt") as EnemyKind;
            // yaw 90/270 turns the patrol onto the Z axis (the walk is
            // axis-bound; the editor exposes it as a patrol-direction toggle)
            const eYaw = (((c.yaw ?? 0) % 360) + 360) % 360;
            if (eYaw % 180 >= 45 && eYaw % 180 < 135) {
              this.enemy(
                c.p[2] - r,
                c.p[2] + r,
                c.p[1],
                c.p[0],
                c.speed ?? 3,
                "z",
                foe,
              );
            } else {
              this.enemy(
                c.p[0] - r,
                c.p[0] + r,
                c.p[1],
                c.p[2],
                c.speed ?? 3,
                "x",
                foe,
              );
            }
          } else if (c.t === "mover") {
            const s = c.s ?? [6, 0.8, 6];
            this.mover(
              c.p[0],
              c.p[1],
              c.p[2],
              s[0],
              s[2],
              c.axis ?? "x",
              c.amp ?? 4,
              c.speed ?? 0.6,
              c.phase ?? 0,
              !!c.lit,
            );
          } else if (c.t === "torch") {
            this.torch(c.p[0], c.p[1], c.p[2], c.rise ?? 2.2, c.w ?? 1);
          } else if (c.t === "phasepad") {
            const s = c.s ?? [5, 0.6, 5];
            this.phasePad(
              c.p[0],
              c.p[1],
              c.p[2],
              s[0],
              s[2],
              c.cycle ?? 4,
              c.phase ?? 0,
              c.amp ?? 0.5,
            );
          } else if (c.t === "stone") {
            const half = Math.abs(c.range ?? 20);
            this.stone(
              c.p[0],
              c.p[1],
              c.p[2] + half,
              c.p[2] - half,
              c.speed ?? 6,
              c.radius ?? 0.9,
            );
          } else if (c.t === "crusher") {
            const s = c.s ?? [4, 3, 3];
            this.crusher(
              c.p[0],
              c.p[1],
              c.p[2],
              s[0],
              s[2],
              c.cycle ?? 3.2,
              c.phase ?? 0,
            );
          } else if (c.t === "ropeswing") {
            this.ropeSwing(
              c.p[0],
              c.p[1],
              c.p[2],
              c.len ?? 6,
              c.amp ?? 0.85,
              c.speed ?? 0,
              c.phase ?? 0,
              c.yaw ?? 0,
              // `range` travels the anchor along `axis` on its own `cycle`
              c.range ? (c.axis ?? "x") : null,
              c.range ?? 0,
              c.cycle ?? 0.5,
              c.phase ?? 0,
            );
          } else if (c.t === "pendulum") {
            this.pendulum(
              c.p[0],
              c.p[1],
              c.p[2],
              c.len ?? 5,
              c.amp ?? 1.0,
              c.speed ?? 1.6,
              c.phase ?? 0,
              c.yaw ?? 0,
            );
          } else if (c.t === "wumpa") {
            this.pickup(c.p[0], c.p[1], c.p[2]);
          } else if (c.t === "camnode") {
            // camera-lane node: pure editor object — a floating diamond you
            // drag around; invisible (and non-physical) in play. lanePts is
            // built AFTER the loop so per-node corner radii can round the
            // whole path at once.
            laneRaw.push([c.p[0], c.p[2], c.radius ?? 0, c.p[1]]);
            laneVis.push(new THREE.Vector3(c.p[0], c.p[1], c.p[2]));
            const marker = new THREE.Mesh(
              new THREE.OctahedronGeometry(0.5, 0),
              new THREE.MeshBasicMaterial({
                color: 0xff5ad2,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
              }),
            );
            marker.position.set(c.p[0], c.p[1], c.p[2]);
            marker.visible = false;
            marker.userData.editorGhost = true;
            this.root.add(marker);
          } else if (c.t === "crystal") {
            this.crystal(c.p[0], c.p[1], c.p[2]);
          } else if (c.t === "decor") {
            this.decorProp(c);
          } else if (c.t === "terrain") {
            this.buildTerrain(c);
          }
        });
      });
      this.bakeDecor(); // one mesh per shape per pass, when batching is on
      // the lane itself: a ghost line with direction cones, editor-only and
      // unpickable (no editorIdx — the NODES are the editable things).
      // Corner radii round the STEERING path — the camera and controls sweep
      // through the bend instead of pivoting at the node.
      if (laneVis.length >= 2) {
        const laneRound = roundCorners(laneRaw, false);
        this.lanePts = laneRound.map((q) => ({ x: q.x, y: q.y, z: q.z }));
        this.measureLane();
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
            new THREE.MeshBasicMaterial({
              color: 0xff8ae0,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
            }),
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
    // Anything flagged `shared` is a process-wide singleton that outlives this
    // level — the one wumpa geometry/material/texture behind every apple in
    // the game (see src/wumpa.ts), which the player's fruit pool and the HUD
    // icon are still drawing after this level is gone. Freeing it here would
    // yank the GPU buffers out from under them on every level switch.
    const disposeMat = (x: THREE.Material): void => {
      if (x.userData.shared) return;
      const map = (x as THREE.MeshLambertMaterial).map;
      if (map) map.dispose();
      x.dispose();
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else if (mat) disposeMat(mat);
    });
    this.scene.remove(this.root);
  }

  get totalCrates(): number {
    // the gem tally: real breakable boxes. Wood arrow crates count (they
    // break now); explosives, switches, and the metal family never do.
    return this.crates.filter(
      (c) => !c.nitro && !c.tnt && !c.bang && !c.nitroBang && !c.metalBounce,
    ).length;
  }

  zoneAt(x: number, z: number): { dir: "E" | "W" | "N" | "S" } | null {
    for (const zn of this.zones) {
      if (x >= zn.xMin && x <= zn.xMax && z >= zn.zMin && z <= zn.zMax)
        return zn;
    }
    return null;
  }

  // Fill a polygon footprint with 1-unit-deep axis-aligned collision slabs
  // (scanline, even-odd) — how drawn walls and spun rectangles get solid
  // sides out of an AABB-only collision engine. pts are relative to cx/cz.
  private fillWallSlabs(
    pts: [number, number][],
    cx: number,
    cz: number,
    y0: number,
    h: number,
  ): void {
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
  private pitPolyByBox = new Map<
    THREE.Box3,
    { cx: number; cz: number; pts: [number, number][] }
  >();
  pitMissesPoly(box: THREE.Box3, x: number, z: number): boolean {
    const poly = this.pitPolyByBox.get(box);
    if (!poly) return false;
    return !pointInPoly(x - poly.cx, z - poly.cz, poly.pts);
  }

  // CAMERA LANE (Crash 3 camera rails): camnode components chain into a
  // polyline; the tangent of the nearest segment is the local "down-course"
  // direction the camera and the controls steer along.
  private lanePts: { x: number; y: number; z: number }[] = [];
  // The Descent's road spine, kept for the oncoming cars to drive along.
  private roadRibbon: SlideRibbon | null = null;
  water: CoastWater | null = null; // the coast's procedural sea (main drives its update with the camera)
  // arc length to each lane point, so "how far along the course" is metres
  private laneArc: number[] = [];
  get laneActive(): boolean {
    return this.lanePts.length >= 2;
  }

  /** Rebuild the arc-length table. Called wherever lanePts is assigned. */
  private measureLane(): void {
    this.laneArc = [0];
    for (let i = 1; i < this.lanePts.length; i++) {
      const a = this.lanePts[i - 1];
      const b = this.lanePts[i];
      this.laneArc.push(
        this.laneArc[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z),
      );
    }
  }

  /**
   * Local "down-course" direction at a world position.
   *
   * Two things stop this handing back the wrong stretch of a course that
   * passes over itself, which the Slipstream's ribbon does with 26m of
   * clearance between the loop and the deck beneath it:
   *
   *  1. the search is in FULL 3D. A plan-view lookup cannot tell those two
   *     decks apart at all — they sit within 3m of each other in x/z.
   *  2. it prefers to stay WHERE IT WAS along the spine. 3D alone is enough
   *     while you are on the road, but a big air puts you far from every
   *     segment, and then the branch below can win on raw distance and point
   *     "forward" across the gap — turning the loop into a shortcut the game
   *     steers you into. `cursor` carries the last match's arc position; a
   *     candidate far from it has to be dramatically closer to take over, so
   *     the frame follows the road you are actually riding. Pass a cursor per
   *     player; omit it for one-off queries that have no history.
   */
  laneDirAt(
    x: number,
    y: number,
    z: number,
    cursor?: LaneCursor,
  ): { x: number; z: number } | null {
    // a travel ZONE is a deliberate LOCAL override of the camera spine:
    // inside its rectangle the zone owns the course frame (side-scroll /
    // run-at-camera), and the lane resumes where the zone ends
    if (this.zoneAt(x, z)) return null;
    const pts = this.lanePts;
    if (pts.length < 2) return null;
    let best = Infinity;
    let bi = -1;
    let bt = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].x;
      const az = pts[i].z;
      const ay = pts[i].y;
      const dx = pts[i + 1].x - ax;
      const dy = pts[i + 1].y - ay;
      const dz = pts[i + 1].z - az;
      const len2 = dx * dx + dy * dy + dz * dz;
      if (len2 < 1e-6) continue;
      let t = ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t;
      const py = ay + dy * t;
      const pz = az + dz * t;
      let d2 =
        (x - px) * (x - px) + (y - py) * (y - py) + (z - pz) * (z - pz);
      // continuity: leaving the stretch you were on costs, and the cost grows
      // with the size of the leap. Sized against the measured geometry — the
      // loop's two decks are 26m apart and 188m apart along the spine, so the
      // near branch can never buy its way past this; a genuine relocation
      // (checkpoint respawn hundreds of metres on) still wins easily.
      if (cursor && cursor.s >= 0) {
        const at =
          this.laneArc[i] + t * (this.laneArc[i + 1] - this.laneArc[i]);
        const leap = Math.abs(at - cursor.s) - LANE_FREE_TRAVEL;
        if (leap > 0) d2 += leap * leap * LANE_LEAP_COST;
      }
      if (d2 < best) {
        best = d2;
        bi = i;
        bt = t;
      }
    }
    if (bi < 0) return null;
    if (cursor) cursor.s = this.laneArc[bi] + bt * (this.laneArc[bi + 1] - this.laneArc[bi]);
    // the heading itself is flattened to the ground plane — the camera yaws,
    // it does not pitch with the road
    const dirOf = (i: number): { x: number; z: number } | null => {
      if (i < 0 || i >= pts.length - 1) return null;
      const dx = pts[i + 1].x - pts[i].x;
      const dz = pts[i + 1].z - pts[i].z;
      const l = Math.hypot(dx, dz);
      return l > 1e-4 ? { x: dx / l, z: dz / l } : null;
    };
    const cur = dirOf(bi);
    if (!cur) return null;
    // Blend ACROSS the vertex rather than snapping to one segment. Two
    // segments meeting at a corner point in different directions, so taking
    // the nearest one alone makes the steering jump as you cross the joint —
    // fine when the chain is a dense sample of a curve, badly wrong on a
    // hand-drawn camnode chain with long spans. Weighting toward whichever
    // neighbour the closest point leans to makes the direction continuous
    // along the whole lane, at any node spacing.
    const lean = bt < 0.5 ? dirOf(bi - 1) : dirOf(bi + 1);
    const w = Math.abs(bt - 0.5);
    if (!lean) return cur;
    const rx = cur.x * (1 - w) + lean.x * w;
    const rz = cur.z * (1 - w) + lean.z * w;
    const rl = Math.hypot(rx, rz);
    return rl > 1e-4 ? { x: rx / rl, z: rz / rl } : cur;
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
        if (!c.alive || c.bouncy || c.metalBounce || c.bang || c.pending)
          continue;
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
        sfx.play("crunch", 0.9, 0.55);
      }
      if (b.active) {
        const gap = this.playerPos.z - p.z; // how far ahead the runner is
        // Rubber-band around the tunable base speed (ratios preserved).
        const base = TUNING.boulderSpeed;
        let sp = base;
        if (gap < -2)
          sp = base * 1.36; // it already passed you: let it thunder off
        else if (gap < 14)
          sp = base * 0.84; // right on your heels: a sliver of mercy
        else if (gap > 50) sp = base * 1.28; // never let it fall out of frame
        st.speed = sp;
        p.z += sp * dt;
        p.y = this.boulderGroundY(p.z) + st.r * 0.92;
        st.mesh.rotation.x += (sp * dt) / st.r;
        // Wall-to-wall kill box: you outrun a boulder, you don't sidestep it.
        st.box.setFromCenterAndSize(
          p,
          new THREE.Vector3(12.5, st.r * 1.9, st.r * 1.4),
        );
        for (const c of this.crates) {
          if (!c.alive || c.pending || c.metalBounce) continue; // the boulder can still slam a '!' switch
          const cp = c.mesh.position;
          if (
            Math.abs(cp.z - p.z) < st.r + 0.8 &&
            Math.abs(cp.x - p.x) < st.r + 0.8
          ) {
            if (c.nitro || c.tnt) this.detonate(c);
            else this.breakCrate(c);
          }
        }
        for (const e of this.enemies) {
          if (e.alive && Math.abs(e.group.position.z - p.z) < st.r + 0.8)
            this.killEnemy(e);
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
      m.lastDelta.copy(m.base).addScaledVector(m.axisV, s).sub(m.mesh.position);
      m.mesh.position.add(m.lastDelta);
      if (m.torch) {
        // the brazier rides the deck: flame AND its pooled light follow
        m.torch.group.position.add(m.lastDelta);
        m.torch.lightAt.add(m.lastDelta);
      }
    }

    // TRAVELLING RAILS: rigid translation only. The rail baked its segment
    // directions and arc length at construction, and translation leaves both
    // untouched — so nodes and visual move by the SAME delta and the grind
    // line stays exactly under the bar.
    for (const mr of this.movingRails) {
      const s = cycleOffset(mr, this.time);
      MR_DELTA.copy(mr.axisV)
        .multiplyScalar(s)
        .sub(mr.object.position); // object.position IS the accumulated offset
      if (MR_DELTA.lengthSq() < 1e-12) continue;
      mr.object.position.add(MR_DELTA);
      for (const p of mr.rail.points) p.add(MR_DELTA);
    }

    // TRAVELLING SWING ROPES: anchor and pivot move together.
    for (const rs of this.ropeSwings) {
      if (!rs.travel) continue;
      const s = cycleOffset(rs.travel, this.time);
      MR_DELTA.copy(rs.travel.base)
        .addScaledVector(rs.travel.axisV, s)
        .sub(rs.anchor);
      rs.anchor.add(MR_DELTA);
      rs.pivot.position.add(MR_DELTA);
    }

    // PHASE PADS: solid + burning, then ghost + dark, on their own round.
    for (const pad of this.phasePads) {
      const k = (this.time / pad.cycle + pad.phase) % 1;
      const on = k < pad.duty;
      // The last beat before it goes is a WARNING, not a surprise: the deck
      // strobes and the fire gutters, so a fair player can read the flip.
      const untilOff = on ? (pad.duty - k) * pad.cycle : Infinity;
      const warn = on && untilOff < 0.9;
      if (on !== pad.on) {
        pad.on = on;
        pad.mesh.material = on ? pad.litMat : pad.ghostMat;
        const at = this.groundMeshes.indexOf(pad.mesh);
        if (on) {
          if (at === -1) this.groundMeshes.push(pad.mesh);
        } else if (at !== -1) {
          this.groundMeshes.splice(at, 1);
        }
        for (const t of pad.torches) t.wantBurn = on ? 1 : 0;
        if (Math.abs(pad.mesh.position.z - this.playerPos.z) < 40)
          sfx.play(on ? "woosh2" : "crunch", 0.32, on ? 1.5 : 1.2);
      }
      if (warn) {
        // strobe the fire down and back up ~4 times over the last beat
        const s = 0.45 + 0.55 * Math.abs(Math.sin(untilOff * 12));
        for (const t of pad.torches) t.wantBurn = s;
      }
    }

    // TORCHES: flicker every fire, then aim the small pool of real lights at
    // whichever ones are nearest the skater.
    for (const t of this.torches) {
      t.burn += (t.wantBurn - t.burn) * Math.min(1, 9 * dt);
      const lick = 0.82 + 0.18 * Math.sin(this.time * 11 + t.seed * 3.1);
      const sway = Math.sin(this.time * 7 + t.seed) * 0.12;
      for (let i = 0; i < t.flames.length; i++) {
        const f = t.flames[i];
        const k = t.burn * (lick + i * 0.04);
        f.scale.set(0.85 + 0.15 * k, Math.max(0.02, k), 0.85 + 0.15 * k);
        f.rotation.z = sway * (i + 1) * 0.5;
        f.visible = t.burn > 0.03;
      }
    }
    if (this.torchLights.length > 0) {
      // nearest-N by squared distance: a partial selection sort over a handful
      // of slots, cheap enough to run every frame with dozens of fires
      const px = this.playerPos.x;
      const py = this.playerPos.y;
      const pz = this.playerPos.z;
      const taken = new Set<number>();
      for (const light of this.torchLights) {
        let best = -1;
        let bestD = Infinity;
        for (let i = 0; i < this.torches.length; i++) {
          if (taken.has(i)) continue;
          const t = this.torches[i];
          if (t.burn <= 0.03) continue;
          const dx = t.lightAt.x - px;
          const dy = t.lightAt.y - py;
          const dz = t.lightAt.z - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < bestD) {
            bestD = d2;
            best = i;
          }
        }
        if (best === -1) {
          light.intensity = 0;
          continue;
        }
        taken.add(best);
        const t = this.torches[best];
        light.position.copy(t.lightAt);
        // flicker the pool too, or the fires dance over a dead-still pool of
        // light and the whole effect reads as a decal
        const flick = 0.85 + 0.15 * Math.sin(this.time * 13 + t.seed * 2.3);
        light.intensity = 7.2 * t.burn * flick;
      }
    }

    // Crumble pads: shake, drop, (maybe) regrow.
    for (const c of this.crumbles) {
      if (c.state === "idle") continue;
      c.t += dt;
      if (c.state === "shake") {
        c.mesh.position.x = c.base.x + Math.sin(c.t * 55) * 0.06;
        c.mesh.position.y = c.base.y - c.t * 0.25;
        if (c.t > c.shakeTime) {
          c.state = "fall";
          c.t = 0;
          if (Math.abs(c.base.z - this.playerPos.z) < 45)
            sfx.play("crunch", 0.45, 0.9);
        }
      } else if (c.state === "fall") {
        c.mesh.position.y -= c.fallSpeed * c.t * dt;
        c.mesh.rotation.x += 1.6 * dt;
        c.mesh.rotation.z += 0.9 * dt;
        // vanish once it has tumbled well out of sight (distance-based so a
        // slow faller stays visible all the way down); time cap catches speed ~0
        if (c.base.y - c.mesh.position.y > 18 || c.t > 8) {
          c.state = "gone";
          c.t = 0;
          c.mesh.visible = false;
          c.mesh.position.y = c.base.y - 400; // park far below any raycast
        }
      } else if (c.state === "gone" && c.regen !== null && c.t > c.regen) {
        c.state = "idle";
        c.mesh.visible = true;
        c.mesh.position.copy(c.base);
        c.mesh.rotation.set(0, c.yaw, 0);
      }
    }

    // Sky-bridge ropes: sag + wobble under a grinder, snap if you linger too
    // long, ease back taut if you hop off in time, restring after the fall.
    for (const r of this.ropes) {
      const N = r.rest.length - 1;
      if (r.state === "break") {
        r.t += dt;
        for (let i = 1; i < N; i++) r.rail.points[i].y -= 34 * r.t * dt; // the span plunges — a grinder rides it into the void
        this.syncRope(r);
        if (r.t > 1.2) {
          r.state = "gone";
          r.t = 0;
          for (const s of r.segs) s.visible = false;
        }
        r.active = false;
        continue;
      }
      if (r.state === "gone") {
        r.t += dt;
        if (r.regen !== null && r.t > r.regen) {
          r.state = "idle";
          r.t = 0;
          for (let i = 0; i <= N; i++) r.rail.points[i].copy(r.rest[i]);
          for (const s of r.segs) s.visible = true;
          this.syncRope(r);
        }
        r.active = false;
        continue;
      }
      if (r.active) {
        if (r.state === "idle") {
          r.state = "sag";
          r.t = 0;
        }
        r.t += dt;
        if (r.t > r.breakTime) {
          r.state = "break";
          r.t = 0;
          r.active = false;
          if (Math.abs(r.rest[0].z - this.playerPos.z) < 55)
            sfx.play("crunch", 0.5, 1.15);
          continue;
        }
      } else if (r.state === "sag") {
        r.t = Math.max(0, r.t - dt * 1.6); // hopped off: recover toward taut
        if (r.t <= 0) r.state = "idle";
      }
      const load = r.state === "sag" ? Math.min(1, r.t / 0.25) : 0;
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
          if (Math.abs(cr.z - this.playerPos.z) < 45)
            sfx.play("crunch", 0.8, 0.5);
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
        if (dz < 26 && dx < 26) sfx.play("woosh", 0.28, 1.25);
      }
    }

    // Swing ropes: driven pendulums (the player attaches via player code —
    // here they just keep swinging).
    for (const rs of this.ropeSwings) {
      rs.theta = Math.sin(this.time * rs.speed + rs.phase) * rs.amp;
      rs.thetaV = Math.cos(this.time * rs.speed + rs.phase) * rs.amp * rs.speed;
      rs.pivot.rotation.z = rs.theta;
    }

    // Scrolling pit textures (lava/void) drift forever.
    for (const s of this.scrollTexes) {
      s.tex.offset.x = (s.tex.offset.x + s.su * dt) % 1;
      s.tex.offset.y = (s.tex.offset.y + s.sv * dt) % 1;
    }
    // The sea moves by advancing one clock. Wrapped at 1000s: the swells all
    // have irrational-ish periods, so nothing snaps, and a float stays precise.
    for (const p of this.warpPads) p.update(dt);
    for (const m of this.seaMats)
      m.uniforms.uTime.value = (m.uniforms.uTime.value + dt) % 1000;

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
        let x =
          attr.getX(i) +
          (wx + drift[i * 3]) * dt +
          Math.sin(this.time * 0.9 + i) * 0.5 * dt;
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
    // Floating wumpa bob and turn in place. The model is baked centred on its
    // own origin (tools/bake-wumpa.mjs), so this is a turn rather than an
    // orbit. Twice the speed it was: the gentle rate came from an argument
    // that the fruit is readable art now and no longer needs speed to look
    // alive, which is true of a still frame and wrong in motion — a slow turn
    // reads as scenery, and a collectable wants to catch the eye.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.mesh.position.y =
        (p.mesh.userData.baseY as number) +
        Math.sin(this.time * 3 + p.mesh.position.z * 0.7) * 0.12;
      p.mesh.rotation.y += dt * 1.8;
    }
    // Unbroken checkpoint boxes idle-spin so they read as special.
    for (const c of this.checkpoints) {
      if (!c.active) c.mesh.rotation.y += dt * 1.2;
    }
    this.settleCrates(dt);
    // Nitro crates bob menacingly.
    this.time += dt;
    for (const c of this.crates) {
      if (!c.nitro) continue;
      c.mesh.position.y =
        (c.mesh.userData.baseY as number) +
        Math.sin(this.time * 4 + c.mesh.position.z) * 0.12;
    }
    // Lit TNT fuses: pulse faster and faster, then blow.
    for (const c of this.crates) {
      if (!c.tnt || !c.alive || c.fuse === undefined) continue;
      c.fuse -= dt;
      const digit = Math.max(1, Math.ceil(c.fuse));
      if (c.mesh.userData.digit !== digit) {
        c.mesh.userData.digit = digit;
        (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture(
          String(digit),
        );
        sfx.play(digit % 2 === 0 ? "tntCount2" : "tntCount", 0.7);
      }
      const urgency = 6 + (CONST.tntFuse - c.fuse) * 6;
      c.mesh.scale.setScalar(
        1 + Math.abs(Math.sin(this.time * urgency)) * 0.06,
      );
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
            else if (c.bang)
              this.triggerBang(c); // a blast can flip the switch
            else {
              this.breakCrate(c);
              this.blastBroken.push(c);
            }
          }
        }
        for (const e of this.enemies) {
          if (e.alive && e.group.position.distanceTo(ex.center) < r + 0.8)
            this.killEnemy(e);
        }
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

  // ---- stacks settle ----
  // Smash the bottom of a tower and the boxes above it have nothing under them.
  // Leaving them hanging in the air is the read that a stack is scenery; they
  // should come down. Each unsupported crate falls under gravity onto whatever
  // is now the top of its column (another crate, or the floor the column was
  // built on), so a tower you eat from the bottom repacks itself downward.
  // Nitros are exempt — they bob on their own baseY and touching one is death,
  // so a nitro dropping on your head is not a fair thing to build.
  private settleLiveCrates = -1;
  private settleFalling = 0;
  private settleCrates(dt: number): void {
    const SIZE = 0.96;
    // Nothing can START falling unless a crate has just left the stack, so the
    // footprint scan below (every crate against every other) only runs on the
    // frames that can matter: the count changed, or something is still on its
    // way down. A level with a few hundred crates would otherwise pay for the
    // whole n^2 sweep every frame to discover that nothing moved.
    let live = 0;
    for (const c of this.crates) if (c.alive && !c.pending) live++;
    const changed = live !== this.settleLiveCrates;
    this.settleLiveCrates = live;
    if (!changed && this.settleFalling === 0) return;
    let falling = 0;
    for (const c of this.crates) {
      if (!c.alive || c.pending || c.nitro) continue;
      const p = c.mesh.position;
      const myBase = p.y - SIZE / 2;
      // the highest thing under this crate's footprint
      let rest = (c.mesh.userData.groundBaseY as number | undefined) ?? myBase;
      for (const o of this.crates) {
        if (o === c || !o.alive || o.pending) continue;
        const q = o.mesh.position;
        if (Math.abs(q.x - p.x) > 0.6 || Math.abs(q.z - p.z) > 0.6) continue;
        const top = q.y + SIZE / 2;
        if (top <= myBase + 0.02 && top > rest) rest = top;
      }
      if (myBase <= rest + 0.01) {
        if (c.fallVel !== undefined) {
          // touchdown: seat it exactly, and let the tally know it moved
          c.fallVel = undefined;
          p.y = rest + SIZE / 2;
          c.mesh.userData.baseY = p.y;
          c.box.setFromCenterAndSize(
            p.clone(),
            new THREE.Vector3(SIZE, SIZE, SIZE),
          );
          sfx.play("crateBounce", 0.35, 1.15);
        }
        continue;
      }
      // in the air with a gap under it: fall
      falling++;
      c.fallVel = (c.fallVel ?? 0) + 42 * dt;
      p.y = Math.max(rest + SIZE / 2, p.y - c.fallVel * dt);
      c.mesh.userData.baseY = p.y;
      c.box.setFromCenterAndSize(
        p.clone(),
        new THREE.Vector3(SIZE, SIZE, SIZE),
      );
    }
    this.settleFalling = falling;
  }

  breakCrate(crate: Crate): void {
    // metal-family crates never break: the '!' switch fires instead, the
    // metal arrow crate just shrugs it off. Outline ghosts aren't there yet.
    if (crate.bang) {
      this.triggerBang(crate);
      return;
    }
    if (crate.nitroBang) {
      this.triggerBang(crate);
      return;
    }
    if (crate.metalBounce || crate.pending) return;
    crate.alive = false;
    this.pops.push({ obj: crate.mesh, t: 0.12 });
    sfx.play(Math.random() < 0.5 ? "crateBreak1" : "crateBreak2", 0.8);
  }

  // Repaint a crate's face in place (both '!' switches when they go spent).
  // Handles the per-face material list the arrow crates carry.
  private setCrateFace(
    crate: Crate,
    map: THREE.CanvasTexture,
    shade: number,
  ): void {
    const mats = Array.isArray(crate.mesh.material)
      ? crate.mesh.material
      : [crate.mesh.material];
    for (const m of mats as THREE.MeshLambertMaterial[]) {
      m.map = map;
      m.emissive?.setScalar(0);
      m.color.setScalar(shade);
      m.needsUpdate = true;
    }
  }

  // '!' SWITCH — either colour, one-shot. The METAL one materializes the
  // outline crates wired to it (those sharing an editor group anywhere up its
  // chain; a switch with no group fires every ungrouped outline). The GREEN one
  // sets off every nitro on the map, safely, classic rules.
  //
  // Neither one BREAKS. The box stays where it is, still solid, still something
  // you can land on, and its face goes blank metal so a spent switch reads as
  // spent at a glance. The green one used to pop like a wooden crate, which
  // meant using it also deleted whatever you were standing on.
  triggerBang(crate: Crate): void {
    if (!crate.alive || crate.bangUsed || crate.pending) return;
    if (!crate.bang && !crate.nitroBang) return;
    crate.bangUsed = true;
    this.setCrateFace(crate, this.metalPlainTexture(), 0.8);
    if (crate.nitroBang) {
      for (const c of this.crates) if (c.alive && c.nitro) this.detonate(c, true);
      sfx.play("crateBreak1", 0.6, 1.2);
      return;
    }
    this.activateOutlines(
      crate.groupIds && crate.groupIds.length > 0 ? crate.groupIds : null,
    );
    sfx.play("crateBreak1", 0.6, 1.4);
  }

  // Swap outline ghosts for the real crates. `filter` = group ids that count
  // as wired; null = only outlines with no group of their own.
  private activateOutlines(filter: number[] | null): void {
    for (const c of this.crates) {
      if (!c.pending) continue;
      const ids = c.groupIds ?? [];
      const wired =
        filter === null
          ? ids.length === 0
          : ids.some((id) => filter.includes(id));
      if (wired) this.setCratePending(c, false);
    }
  }

  // Flip a crate between ghost (outline) and real — both faces are kept so
  // level resets and checkpoint restores can flip it back.
  private setCratePending(c: Crate, pending: boolean): void {
    c.pending = pending;
    if (!c.wasOutline) return;
    if (c.realMat && c.ghostMat)
      c.mesh.material = pending ? c.ghostMat : c.realMat;
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
    sfx.play("tntBoom", 0.9);
    // The puff cloud carries the crate's temperament: TNT goes up fiery
    // yellow-into-red, nitro in the same bang gone radioactive green. Chained
    // crates each fire their own burst, so a stack reads as a rolling series.
    // Strength 1 on purpose: the studio previews at 1, so the numbers that
    // were dialled by eye are the numbers that play. Anything above it would
    // quietly inflate the throw and the count past what was approved.
    puffs.burst(c.tnt ? "boomTnt" : "boomNitro", center.x, center.y + 0.2, center.z, {});
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
      sfx.play("fruitSpun", 0.8); // the "spun away" zing
    } else {
      // The squash pop gets a little cartoon poof where the body was — the
      // stomp (and the slide/uber plough-through) reads as a puff of dust
      // rather than a mesh blinking out.
      const ep = enemy.group.position;
      puffs.burst("enemyPoof", ep.x, ep.y + 0.35, ep.z, {});
      this.pops.push({ obj: enemy.group, t: 0.12 });
      sfx.play("enemyDown", 0.7);
    }
  }

  // Broken (spun/stomped) like a normal box; banks the respawn point and a
  // snapshot of exactly which crates are broken + the counter at this moment.
  activateCheckpoint(
    cp: Checkpoint,
    cratesBroken: number,
    fruit = 0,
    masks = 0,
    points = 0,
  ): void {
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
    sfx.play("lifeGet", 0.8);
  }

  // A '!' switch's face follows its bangUsed flag — both colours of switch, and
  // the green one carries an emissive glow that has to come back with it.
  private restoreBangFace(c: Crate): void {
    if (!c.bang && !c.nitroBang) return;
    if (c.bangUsed) {
      this.setCrateFace(c, this.metalPlainTexture(), 0.8);
      return;
    }
    this.setCrateFace(
      c,
      c.bang ? this.bangTexture() : this.nitroBangTexture(),
      1,
    );
    if (c.nitroBang)
      for (const m of (
        Array.isArray(c.mesh.material) ? c.mesh.material : [c.mesh.material]
      ) as THREE.MeshLambertMaterial[])
        m.emissive?.setHex(0x0c3a16);
  }

  private restoreTntFace(c: Crate): void {
    if (c.tnt && c.mesh.userData.digit !== undefined) {
      c.mesh.userData.digit = undefined;
      (c.mesh.material as THREE.MeshLambertMaterial).map =
        this.tntTexture("TNT");
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
        this.clockPickup.group.visible = this.runModesOn;
      }
      // ...and so does the combo orb
      if (this.comboOrb && !this.comboRun) {
        this.comboOrb.collected = false;
        this.comboOrb.group.visible = this.runModesOn;
      }
      if (this.gemG) {
        this.root.remove(this.gemG);
        this.gemG = null;
        this.gemPickup = null;
      }
    }
    this.pops.length = 0;
    this.explosions.length = 0;
    this.blastBroken.length = 0;

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
        this.restoreBangFace(c);
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
        this.restoreBangFace(c);
      }
    }

    for (const e of this.enemies) {
      e.alive = true;
      e.group.visible = e.alive;
      e.flungT = undefined;
      e.flungVel = undefined;
      if (e.axis === "z") e.group.position.z = (e.x0 + e.x1) / 2;
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

    // Crumble pads grow back whole.
    for (const c of this.crumbles) {
      c.state = "idle";
      c.t = 0;
      c.mesh.visible = true;
      c.mesh.position.copy(c.base);
      c.mesh.rotation.set(0, c.yaw, 0);
    }
    // Phase pads come back solid and lit; their cycle is driven off level
    // time, which the reset rewinds, so they re-sync on their own from here.
    for (const pad of this.phasePads) {
      pad.on = true;
      pad.mesh.material = pad.litMat;
      if (this.groundMeshes.indexOf(pad.mesh) === -1)
        this.groundMeshes.push(pad.mesh);
      for (const t of pad.torches) t.wantBurn = 1;
    }
    // Travelling rails back to their build position (nodes AND visual).
    for (const mr of this.movingRails) {
      MR_DELTA.copy(mr.object.position).negate();
      if (MR_DELTA.lengthSq() > 1e-12) {
        mr.object.position.set(0, 0, 0);
        for (const p of mr.rail.points) p.add(MR_DELTA);
      }
    }
    // ...and travelling rope anchors.
    for (const rs of this.ropeSwings) {
      if (!rs.travel) continue;
      MR_DELTA.copy(rs.travel.base).sub(rs.anchor);
      rs.anchor.add(MR_DELTA);
      rs.pivot.position.add(MR_DELTA);
    }

    // Sky-bridge ropes restring taut.
    for (const r of this.ropes) {
      r.state = "idle";
      r.t = 0;
      r.active = false;
      for (let i = 0; i < r.rest.length; i++) r.rail.points[i].copy(r.rest[i]);
      for (const s of r.segs) s.visible = true;
      this.syncRope(r);
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

  // ---- "JUNGLE RUINS" ------------------------------------------------------
  // The corridor level, and the one every other level's furniture came from.
  // One route, walled the whole way: mossy berms at the path edge, a solid
  // earth bank behind them, a standing wall of canopy above that. You can see
  // out; you can never leave.
  //
  // The floor is never flat and never straight. Every walkable strip is a
  // displaced plane riding a SPINE — one shared centreline that drifts left and
  // right and rolls up and down across the whole level, with faster local bumps
  // on top of it. Strips, berms, earth bank, planting, and the camera lane all
  // read that same spine, so they bend together and every join stays flush.
  // Through the temple the spine relaxes to dead straight, because built
  // masonry takes over from ground, and again at the finish landing.
  //
  // Three beats, in the order the reference art suggests: undergrowth pit hops,
  // a fallen trunk grind over a ravine, then a stepped temple climb onto a ruin
  // terrace and back down. About a third the length of the course it replaces.

// THE DESCENT. A two-lane mountain road out of the reference frame: very
  // long, very curvy, mainly downhill with flats, gentle rises and a few
  // outright -20%+ dives, hemmed by tall hillsides and roadside pines that
  // hide and reveal the course, metal barriers down both edges, and far
  // snow ranges over the valley. Oncoming cars run the left lane.
  //
  // Construction notes, learned the hard way:
  //  - the road is one slideRibbon spline with lip=false: a FLAT deck edge
  //    to edge (the up-curled sides were the slide trough's gutters);
  //  - the y profile is smoothed after generation — Catmull-Rom through
  //    kinked heights was where the random lumps came from;
  //  - everything long (paint, barriers, hills, pines) is built in ~240m
  //    CHUNKS so the far course frustum-culls; the single full-course meshes
  //    of the first pass were why the opening seconds stuttered.
  private buildDescent(): void {
    this.batchDecor = true;
    this.killY = -10; // the bay is the pit: a few metres under the surface
    this.skyPreset = "coast"; // the beach painting, horizon pinned to sea level
    this.theme = {
      skyTop: "#3f8fd8",
      skyBottom: "#eaf6fa", // bright noon haze over open water
      sunColorHex: "#fff8e0",
      sunU: 0.55,
      sunV: 0.26,
      stars: false,
      fog: 0xdfeef2,
      fogNear: 110,
      fogFar: 560, // aspirational: the sky preset caps this
      hemiSky: 0xd8eef8,
      hemiGround: 0x7a9a88, // sand + sea bounce
      hemiI: 1.15,
      sunColor: 0xfff2d0,
      sunI: 1.3,
      particleColor: 0xffffff,
      particleWind: [0.4, 0.05, 0.2],
    };

    // ---- the road line ----------------------------------------------------
    const V = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z);
    const DS = 16; // dense control nodes: the spline has no room to invent
    const NODES = 160; // ~2.55km around the bay
    const LEN = DS * NODES;
    const pts: THREE.Vector3[] = [];
    let px = 0;
    let py = 430;
    let pz = 0;
    // THE BAY. A slow, relentless right-hand drift bends the whole course
    // around the water: you set off high on the coast and come off the last
    // bend pointing along the far shore, right at the beach.
    const drift = (sArc: number): number => 1.78 * Math.pow(sArc / LEN, 1.18);
    // SOFT limits everywhere. Hard clamps put corners into the heading and
    // slope functions, corners put kinks in the spline, and kinks were the
    // rattle you felt the whole way down. tanh bends instead of breaking.
    const softc = (v: number, lim: number): number => lim * Math.tanh(v / lim);
    const headAt = (sArc: number): number => {
      const wig = softc(
        (Math.PI / 180) *
          (44 * Math.sin((sArc * Math.PI * 2) / 560 + 0.8) +
            20 * Math.sin((sArc * Math.PI * 2) / 187 + 2.6)),
        1.05,
      );
      // ease onto the fixed final heading — no snap at the run-out
      const endBlend = THREE.MathUtils.smoothstep(sArc, LEN - 230, LEN - 90);
      return THREE.MathUtils.lerp(
        softc(drift(sArc) + wig, 2.3),
        softc(drift(LEN - 140), 2.3),
        endBlend,
      );
    };
    for (let i = 0; i < NODES; i++) {
      const sArc = i * DS;
      // the coast road DIVES: -9..-19% most of the way, past -30% in the big
      // plunges, and it only flattens for the final roll onto the beach flat
      let slope =
        -0.155 +
        softc(
          0.09 * Math.sin(sArc * 0.006 + 1.7) +
            0.07 * Math.sin(sArc * 0.0023 + 4.2),
          0.16,
        );
      slope = THREE.MathUtils.lerp(
        slope,
        -0.015,
        THREE.MathUtils.smoothstep(i, NODES - 15, NODES - 4),
      );
      pts.push(V(px, py, pz));
      const head = headAt(sArc);
      px += Math.sin(head) * DS;
      pz -= Math.cos(head) * DS;
      py += slope * DS;
    }
    // smooth EVERY axis: binomial passes kill the spline lumps in the height
    // profile AND the lateral jitter that banking amplifies into rattle
    for (let pass = 0; pass < 5; pass++)
      for (let i = 1; i < NODES - 1; i++)
        pts[i].y = (pts[i - 1].y + 2 * pts[i].y + pts[i + 1].y) / 4;
    for (let pass = 0; pass < 2; pass++)
      for (let i = 1; i < NODES - 1; i++) {
        pts[i].x = (pts[i - 1].x + 2 * pts[i].x + pts[i + 1].x) / 4;
        pts[i].z = (pts[i - 1].z + 2 * pts[i].z + pts[i + 1].z) / 4;
      }
    // pin the arrival: rescale every drop so the last node lands EXACTLY at
    // beach height — all 430m of mountain get spent reaching the sea
    const yScale = (430 - 3) / Math.max(1, 430 - pts[NODES - 1].y);
    for (const p of pts) p.y = 430 - (430 - p.y) * yScale;

    const W = 22.8; // wider again: a broad two-lane coast highway
    // AUTHORED banking from the analytic heading. The kernel's auto-lean
    // estimates curvature by finite differences over the finished spline —
    // Catmull-Rom curvature oscillates inside every segment, so the deck
    // wobbled its roll a few degrees every couple of metres. The closed-form
    // derivative of headAt is glass, so the lean is too. bank=0 turns the
    // noisy estimator OFF.
    const rollDeg: number[] = [];
    for (let i = 0; i < NODES; i++) {
      const s = i * DS;
      // sample INSIDE the course: drift uses pow(s/LEN, 1.18), and a negative
      // argument turns the whole first node's bank into NaN
      const s0 = Math.max(0, s - 9);
      const s1 = Math.min(LEN, s + 9);
      const kappa = (headAt(s1) - headAt(s0)) / (s1 - s0); // rad per metre
      rollDeg.push(THREE.MathUtils.clamp(kappa * 620, -13, 13));
    }
    const groundBefore = this.groundMeshes.length;
    const road = this.slideRibbon(pts, W, 0x565b61, rollDeg, 0, "asphalt", false);
    this.roadRibbon = road;
    // THE LAG FIX. The ribbon arrives as ONE ~50k-triangle mesh, and three's
    // raycaster has no BVH: every ground ray brute-forced the whole 2.4km of
    // deck every frame (44.7ms a step, measured). Split its index by triangle
    // position into ~240m meshes, each with compact re-packed vertices and
    // its OWN bounds — the ray's bounding-sphere test now skips everything
    // but the chunk underfoot, and the far deck frustum-culls too.
    for (let gi = this.groundMeshes.length - 1; gi >= groundBefore; gi--) {
      const big = this.groundMeshes[gi];
      // buildVertRampGeometry emits an UNINDEXED soup — normalise to that
      // form so every triangle owns 3 consecutive vertices and carving is a
      // straight copy of triples, no index remapping
      const soup = big.geometry.getIndex()
        ? big.geometry.toNonIndexed()
        : big.geometry;
      const posA = soup.getAttribute("position") as THREE.BufferAttribute;
      const triCount = posA.count / 3;
      if (triCount < 10000) continue;
      const buckets = new Map<number, number[]>();
      for (let f = 0; f < triCount; f++) {
        // bucket by the FIRST vertex's z — plain spatial slabs. The bay curve
        // can revisit a slab; that chunk just holds both pieces, still exact.
        const key = Math.floor(posA.getZ(f * 3) / 80);
        let arr = buckets.get(key);
        if (!arr) buckets.set(key, (arr = []));
        arr.push(f);
      }
      const attrs = Object.entries(soup.attributes) as [string, THREE.BufferAttribute][];
      for (const tris of buckets.values()) {
        const g = new THREE.BufferGeometry();
        for (const [name, attr] of attrs) {
          const item = attr.itemSize;
          const span = 3 * item; // floats per triangle in this attribute
          const out = new Float32Array(tris.length * span);
          const srcArr = attr.array as Float32Array;
          let w = 0;
          for (const f of tris) {
            const base = f * span;
            for (let c = 0; c < span; c++) out[w++] = srcArr[base + c];
          }
          g.setAttribute(name, new THREE.BufferAttribute(out, item));
        }
        // a precomputed box makes Mesh.raycast run its TIGHT AABB pre-test
        // (it only does so when boundingBox is non-null) — a long ribbon
        // chunk's sphere is fat with empty air, the box hugs the deck
        g.computeBoundingSphere();
        g.computeBoundingBox();
        const m = new THREE.Mesh(g, big.material);
        m.name = "road deck chunk";
        m.userData = big.userData;
        m.castShadow = big.castShadow;
        m.receiveShadow = big.receiveShadow;
        this.root.add(m);
        this.groundMeshes.push(m);
      }
      this.root.remove(big);
      if (soup !== big.geometry) soup.dispose();
      big.geometry.dispose();
      this.groundMeshes.splice(gi, 1);
    }
    const F = (t: number, off: number, h: number): THREE.Vector3 =>
      road.frame(THREE.MathUtils.clamp(t, 0.001, 0.999), off, h);
    const CHUNK = 240; // metres of course per mesh — the culling grain

    // spawn in the right lane — the sea side — looking down the hill
    const sp = F(0.004, 5.6, 0.15);
    this.spawnPos.set(sp.x, sp.y, sp.z);
    this.currentSpawn.copy(this.spawnPos);

    // ---- camera lane ------------------------------------------------------
    const lane: { x: number; y: number; z: number }[] = [];
    for (let sArc = 0; sArc <= road.len; sArc += 8) {
      const p = F(sArc / road.len, 0, 0);
      lane.push({ x: p.x, y: p.y, z: p.z });
    }
    this.lanePts = lane;
    this.measureLane();

    // ---- chunked ribbon-strip builder ------------------------------------
    // One quad strip between two (off, h) profiles over [s0, s1]. Everything
    // long on this course goes through here so it culls chunk by chunk.
    const strip = (
      s0: number,
      s1: number,
      offA: (s: number) => number,
      hA: (s: number) => number,
      offB: (s: number) => number,
      hB: (s: number) => number,
      mat: THREE.Material,
      ground: boolean,
      name: string,
      step = 8,
    ): void => {
      const posArr: number[] = [];
      const idx: number[] = [];
      let n = 0;
      for (let sArc = s0; sArc <= s1 + 0.01; sArc += step) {
        const t = sArc / road.len;
        const a = F(t, offA(sArc), hA(sArc));
        const b = F(t, offB(sArc), hB(sArc));
        posArr.push(a.x, a.y, a.z, b.x, b.y, b.z);
        if (n > 0) {
          const k = n * 2;
          idx.push(k - 2, k - 1, k, k, k - 1, k + 1);
        }
        n++;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posArr), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = name;
      this.root.add(mesh);
      if (ground) this.groundMeshes.push(mesh);
    };
    const chunks = (cb: (s0: number, s1: number) => void): void => {
      for (let s0 = 0; s0 < road.len; s0 += CHUNK)
        cb(s0, Math.min(road.len, s0 + CHUNK));
    };

    // ---- road paint: full-width markings ---------------------------------
    // Double yellow on the crown, solid white edge lines right at the deck
    // edges — the lane system spans the full width of the road.
    const yellowMat = new THREE.MeshLambertMaterial({
      color: 0xd8a428,
      emissive: 0x3a2c08,
      side: THREE.DoubleSide,
    });
    const whiteMat = new THREE.MeshLambertMaterial({
      color: 0xe8e8e0,
      emissive: 0x333330,
      side: THREE.DoubleSide,
    });
    chunks((s0, s1) => {
      for (const off of [-0.24, 0.24])
        strip(s0, s1, () => off - 0.085, () => 0.05, () => off + 0.085, () => 0.05,
          yellowMat, false, "centre line", 7);
      for (const off of [-10.45, 10.45])
        strip(s0, s1, () => off - 0.09, () => 0.05, () => off + 0.09, () => 0.05,
          whiteMat, false, "edge line", 7);
    });

    // ---- the metal barriers ----------------------------------------------
    // A continuous beam band down BOTH edges, posts every 9m, and a
    // grindable rail running the barrier's whole top edge.
    const beamMat = new THREE.MeshLambertMaterial({
      color: 0x9aa2ac,
      emissive: 0x1a1d22,
      side: THREE.DoubleSide,
    });
    const postGeo = new THREE.BoxGeometry(0.16, 0.9, 0.32);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a616b });
    const PQ = new THREE.Quaternion();
    for (const side of [-1, 1] as const) {
      const bOff = side * 10.95;
      chunks((s0, s1) => {
        strip(s0, s1, () => bOff, () => 0.45, () => bOff, () => 0.88,
          beamMat, false, "barrier beam", 8);
      });
      for (let sArc = 6; sArc < road.len - 6; sArc += 9) {
        const p = F(sArc / road.len, bOff, 0);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, p.y + 0.45, p.z),
          PQ,
          new THREE.Vector3(1, 1, 1),
        );
        this.putDecor("barrier post", postGeo, postMat, m);
      }
      // the grind line along the barrier top, full course length
      const rpts: THREE.Vector3[] = [];
      for (let sArc = 4; sArc <= road.len - 4; sArc += 10)
        rpts.push(F(sArc / road.len, bOff, 0.92));
      const rail = new Rail(rpts);
      this.rails.push(rail);
      this.root.add(rail.object);
    }

    // ---- the two sides of a COAST road -----------------------------------
    // LEFT is the mountain: shoulder, hill wall, then a crag face that climbs
    // a couple hundred metres and hides the inland world.
    // RIGHT is the drop: a strip of scrub past the barrier, then bluffs that
    // fall all the way into the bay.
    const hillL = (sArc: number): number => {
      const h =
        30 +
        18 * Math.sin(sArc * 0.007 + 2.1) +
        10 * Math.sin(sArc * 0.019 + 5.0);
      // no vista gaps any more: the left is a WALL now, and a wall with
      // windows is an invitation to ride through one
      return Math.max(12, h);
    };
    const shoulderMat = new THREE.MeshLambertMaterial({
      color: 0x4e8a3c,
      side: THREE.DoubleSide,
    });
    const hillMat = new THREE.MeshLambertMaterial({
      color: 0x5a6b4a,
      side: THREE.DoubleSide,
    });
    const cragMat = new THREE.MeshLambertMaterial({
      color: 0x6a6a5e,
      side: THREE.DoubleSide,
    });
    const scrubMat = new THREE.MeshLambertMaterial({
      color: 0x6e8248,
      side: THREE.DoubleSide,
    });
    const bluffMat = new THREE.MeshLambertMaterial({
      color: 0x7c6f58,
      side: THREE.DoubleSide,
    });
    const mistMat = new THREE.MeshLambertMaterial({
      color: 0x6e7a88,
      side: THREE.DoubleSide,
    });
    const deckY = (sArc: number): number => F(sArc / road.len, 0, 0).y;
    chunks((s0, s1) => {
      // the mountain side: a green verge, then ROCK, straight up. The road
      // is a shelf cut into the mountain and the cut face is the boundary —
      // set back a couple of metres so the wall looms beside the lane, not
      // over it.
      strip(s0, s1,
        () => -(W / 2 + 0.05), () => 0.05,
        () => -(W / 2 + 2.6), () => 0.5,
        shoulderMat, true, "road verge", 12);
      strip(s0, s1,
        () => -(W / 2 + 2.6), () => 0.5,
        () => -(W / 2 + 6.3), () => 9,
        cragMat, false, "rock face", 12);
      strip(s0, s1,
        () => -(W / 2 + 6.3), () => 9,
        () => -(W / 2 + 26),
        (sArc) => hillL(sArc),
        hillMat, false, "hillside", 12);
      strip(s0, s1,
        () => -(W / 2 + 26),
        (sArc) => hillL(sArc),
        () => -(W / 2 + 74),
        (sArc) => hillL(sArc) * 2.8 + 40,
        cragMat, false, "crag", 24);
      // the sea side: a 1.2m lip of scrub is ALL the mercy there is
      strip(s0, s1,
        () => W / 2 + 0.05, () => 0.05,
        () => W / 2 + 1.2, () => 0.3,
        scrubMat, true, "cliff shoulder", 12);
      strip(s0, s1,
        () => W / 2 + 1.2, () => 0.3,
        () => W / 2 + 13, () => -36,
        scrubMat, true, "bluff top", 12);
      // the sea cliff proper: its foot is pinned below sea level in ABSOLUTE
      // terms, so the rock always meets the water and the shoreline is simply
      // where this face crosses y=0. It stays NARROW on purpose — the fog
      // saturates at ~260m, so the water has to arrive well inside that or
      // the bay never reads from the deck.
      strip(s0, s1,
        () => W / 2 + 13, () => -36,
        () => W / 2 + 55,
        (sArc) => -26 - deckY(sArc),
        bluffMat, false, "sea cliff", 24);
      // and behind the crag, a second ridge band climbs into the haze — at
      // ~100-170m out it fogs to a towering misty wall, which is the only
      // kind of tall that survives the 400m draw distance
      strip(s0, s1,
        () => -(W / 2 + 74),
        (sArc) => hillL(sArc) * 2.8 + 40,
        () => -(W / 2 + 170),
        (sArc) => hillL(sArc) * 1.9 + 260,
        mistMat, false, "high ridge", 24);
    });

    // ---- the mountain PUSHES BACK ----------------------------------------
    // Short overlapping AABBs down the whole rock face feed the same blocker
    // engine as drawn walls: ride at the cut and it shrugs you back onto the
    // road. Segments stay short so the boxes hug the curve instead of
    // bulging across it.
    for (let sArc = 0; sArc < road.len; sArc += 3) {
      const t0 = sArc / road.len;
      const t1 = Math.min(0.999, (sArc + 3.6) / road.len);
      const a0 = F(t0, -(W / 2 + 2.7), 0);
      const a1 = F(t1, -(W / 2 + 2.7), 0);
      const b0 = F(t0, -(W / 2 + 6.5), 0);
      const b1 = F(t1, -(W / 2 + 6.5), 0);
      const box = new THREE.Box3();
      for (const p of [a0, a1, b0, b1]) box.expandByPoint(p);
      box.min.y = Math.min(a0.y, a1.y) - 2;
      box.max.y = Math.max(a0.y, a1.y) + 8;
      this.walls.push(box);
    }
    // ---- the cliff does NOT --------------------------------------------
    // Tumble volumes hug the bluff face from just under the scrub lip down
    // to the water: past the lip you don't die on the spot — the body is
    // thrown into a ragdoll bail and the steep-bail physics rides it down
    // the fall line, dust and all, until the sea finishes the job (killY).
    // Their tops sit ~2m BELOW deck height, so airs over the barrier that
    // come back clean are never clipped — only bodies that go down.
    for (let sArc = 0; sArc < road.len; sArc += 11) {
      const t0 = sArc / road.len;
      const t1 = Math.min(0.999, (sArc + 12) / road.len);
      const a0 = F(t0, W / 2 + 2.4, 0);
      const a1 = F(t1, W / 2 + 2.4, 0);
      const b0 = F(t0, W / 2 + 14.5, 0);
      const b1 = F(t1, W / 2 + 14.5, 0);
      const box = new THREE.Box3();
      for (const p of [a0, a1, b0, b1]) box.expandByPoint(p);
      box.max.y = Math.min(a0.y, a1.y) - 1.8;
      box.min.y = box.max.y - 44;
      this.tumbleBoxes.push(box);
    }

    // ---- pines, baked chunk by chunk -------------------------------------
    let rs = 7;
    const rnd = (): number => {
      rs = (rs * 16807) % 2147483647;
      return rs / 2147483647;
    };
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.6, 5);
    const coneGeo = new THREE.ConeGeometry(1.7, 3.8, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    const pineMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
    const Q = new THREE.Quaternion();
    const E = new THREE.Euler();
    const pine = (x: number, y: number, z: number, sc: number): void => {
      Q.setFromEuler(E.set(0, rnd() * 6.28, 0));
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, y + 1.3 * sc, z),
        Q,
        new THREE.Vector3(sc, sc, sc),
      );
      this.putDecor("pine trunk", trunkGeo, trunkMat, m);
      for (let c = 0; c < 2; c++) {
        const cm = new THREE.Matrix4().compose(
          new THREE.Vector3(x, y + (2.6 + c * 2.1) * sc, z),
          Q,
          new THREE.Vector3(sc * (1 - c * 0.28), sc, sc * (1 - c * 0.28)),
        );
        this.putDecor("pine crown", coneGeo, pineMat, cm);
      }
    };
    chunks((s0, s1) => {
      for (let sArc = Math.max(30, s0); sArc < Math.min(s1, road.len - 40); sArc += 9) {
        // a dense treeline STANDING ON the rock lip: the visible half of the
        // barrier, thick enough to read as "the mountain starts here".
        // The sea side gets nothing — the view is the point, and so is the
        // drop.
        if (rnd() > 0.22) {
          const off = -(W / 2 + 5.3 + rnd() * 1.8);
          const p = F(sArc / road.len, off, 8.8);
          pine(p.x, p.y, p.z, 0.9 + rnd() * 0.9);
        }
      }
      this.bakeDecor(); // one merged pine mesh per chunk: the far forest culls
    });

    // ---- the bay itself --------------------------------------------------
    // No flat plane any more: the sea is the CoastWater system (src/water.ts)
    // built at the arrival — a camera-following far-ocean fan plus the
    // nearshore ribbon at the beach. Every sea-side terrain face is still
    // pinned below y=0, so the coastline draws itself where rock meets water.

    // ---- islands in the bay ----------------------------------------------
    // No far shore: the draw distance is 400m and the fog owns everything
    // past ~260, so distant headlands are just the painted sky. What CAN
    // read is rock standing in the water a couple hundred metres off the
    // cliffs — small islands, half-dipped in haze, exactly the PS1 trick.
    const lateral = (t: number, d: number): THREE.Vector3 => {
      const c = F(t, 0, 0);
      const u = F(t, 1, 0); // one metre toward the deck's right
      return new THREE.Vector3(c.x + (u.x - c.x) * d, 0, c.z + (u.z - c.z) * d);
    };
    const isleMat = new THREE.MeshLambertMaterial({ color: 0x74836e });
    for (const [tt, d, r, h] of [
      [0.18, 210, 70, 85],
      [0.45, 300, 110, 150],
      [0.62, 170, 55, 60],
      [0.88, 260, 90, 110],
    ] as const) {
      const c = lateral(tt, d);
      const isle = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), isleMat);
      isle.position.set(c.x, h / 2 - 6, c.z);
      this.root.add(isle);
    }

    // ---- oncoming traffic -------------------------------------------------
    const carCols = [0xb03a2e, 0x3a62b0, 0xd8c090, 0x4a8a4a, 0x8a4a8a, 0xc07838];
    // Base traffic holds the left lane; three OVERTAKERS run head-on in the
    // player's own lane, faster, each closing on a slower partner ahead of
    // it — the pass plays out right in front of you and YOUR lane is the
    // one that is briefly not yours.
    // Cars build 30% OVERSIZED, baked into the geometry — group scale would
    // not survive resetEnemyVisual, which snaps every foe back to scale 1.
    // The enemy box in updateEnemies ("car" case) matches this factor.
    const CAR_S = 1.3;
    const makeCar = (col: number): { group: THREE.Group; body: THREE.Mesh } => {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2.1 * CAR_S, 0.75 * CAR_S, 4.2 * CAR_S),
        new THREE.MeshLambertMaterial({ color: col }),
      );
      body.position.y = 0.75 * CAR_S;
      group.add(body);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.7 * CAR_S, 0.62 * CAR_S, 2.0 * CAR_S),
        new THREE.MeshLambertMaterial({ color: 0xcfe0ea }),
      );
      cabin.position.set(0, 1.35 * CAR_S, 0.25 * CAR_S);
      group.add(cabin);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c20 });
      for (const [wx, wz] of [[-1, -1.35], [1, -1.35], [-1, 1.35], [1, 1.35]] as const) {
        const wheel = new THREE.Mesh(
          new THREE.BoxGeometry(0.34 * CAR_S, 0.62 * CAR_S, 0.62 * CAR_S),
          wheelMat,
        );
        wheel.position.set(wx * 1.02 * CAR_S, 0.31 * CAR_S, wz * CAR_S);
        group.add(wheel);
      }
      const lampMat = new THREE.MeshLambertMaterial({
        color: 0xfff4c0,
        emissive: 0x8a7a30,
      });
      for (const lx of [-0.6, 0.6]) {
        const lamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.4 * CAR_S, 0.22 * CAR_S, 0.1 * CAR_S),
          lampMat,
        );
        lamp.position.set(lx * CAR_S, 0.82 * CAR_S, -2.12 * CAR_S);
        group.add(lamp);
      }
      return { group, body };
    };
    const traffic: { s0: number; lane: number; speed: number }[] = [];
    for (let i = 0; i < 8; i++)
      traffic.push({ s0: 280 + i * 280, lane: -5.6, speed: 9.5 + (i % 3) * 1.6 });
    for (const os of [700, 1400, 2050]) traffic.push({ s0: os + 16, lane: 5.6, speed: 14.5 });
    for (let i = 0; i < traffic.length; i++) {
      const { group, body } = makeCar(carCols[i % carCols.length]);
      this.root.add(group);
      this.enemies.push({
        group,
        box: new THREE.Box3(),
        alive: true,
        x0: traffic[i].s0,
        x1: 0,
        dir: 1,
        speed: traffic[i].speed,
        axis: "z",
        kind: "car",
        state: "drive",
        stateT: 0,
        baseY: 0,
        cross: traffic[i].lane,
        body,
        vy: 0,
        spinKill: false,
        stompKill: false,
        meleeKill: false,
        touchHurt: true,
        spinRecoil: false,
      });
    }

    // ---- road furniture: crates, nitros, oil slicks ----------------------
    // Everything smashable or lethal lives on the strips traffic never uses
    // (the lanes run at cross ±5.6): the centre line and the two shoulders.
    // Wood crates are the fun — a smash-speed roll pops straight through —
    // and every nitro is avoidable on purpose: green means DON'T, and it is
    // never parked where dodging a car would push you into one.
    const put = (
      t: number,
      cross: number,
      kind?: "nitro" | "bouncy",
      stack = 1,
    ): void => {
      const p = F(t, cross, 0);
      for (let i = 0; i < stack; i++) this.crate(p.x, p.y + i * 0.96, p.z, kind);
    };
    // wood: singles, pairs, walls-of-three, shoulder runs, little towers
    put(0.05, -1.1); put(0.05, 0); put(0.05, 1.1); // opening wall: blast through it
    put(0.09, -8.4);
    put(0.12, 8.5, undefined, 2);
    put(0.16, -0.6); put(0.16, 0.6);
    put(0.2, -8.6); put(0.204, -8.6); put(0.208, -8.6); // shoulder run
    put(0.24, 0.3);
    put(0.275, 8.1); put(0.275, 9.2);
    put(0.31, -8.3, "bouncy"); // arrow crate: launch clean over the next pass
    put(0.34, 0, undefined, 2);
    put(0.38, 8.3);
    put(0.42, -1.1); put(0.42, 0); put(0.42, 1.1);
    put(0.46, -8.5, undefined, 2);
    put(0.52, 8.4, "bouncy");
    put(0.55, -0.6); put(0.55, 0.6);
    put(0.59, -8.3);
    put(0.63, 0.5, undefined, 3); // the tower
    put(0.67, 8.5); put(0.674, 8.5); put(0.678, 8.5);
    put(0.71, -0.4);
    put(0.75, -8.1); put(0.75, -9.2);
    put(0.79, 0, "bouncy"); // centre-line arrow: big air down the home hill
    put(0.83, 8.4, undefined, 2);
    put(0.87, -1.1); put(0.87, 0); put(0.87, 1.1);
    put(0.9, -8.4);
    put(0.925, -0.6); put(0.925, 0.6);
    // nitros: landmines with lots of warning, all on the safe strips
    put(0.07, 1.8, "nitro");
    put(0.11, -1.5, "nitro");
    put(0.145, 8.7, "nitro");
    put(0.19, 0.4, "nitro");
    put(0.235, -8.5, "nitro");
    put(0.29, 2, "nitro");
    put(0.36, -1.8, "nitro");
    put(0.44, 8.8, "nitro");
    put(0.5, -0.6, "nitro");
    put(0.57, 1.4, "nitro");
    put(0.65, -8.6, "nitro");
    put(0.73, 0.8, "nitro");
    put(0.81, -1.9, "nitro");
    put(0.885, 8.4, "nitro");
    // oil slicks: dark rainbow-sheen blobs smeared down the tarmac — ride one
    // and the wheels go greasy (steering and brakes cut, see the slippy
    // handling player-side). Some sit in the traffic lanes: dodging a car
    // through an oil patch is the intended chaos.
    const oilMat = new THREE.MeshLambertMaterial({
      color: 0x0d0f13,
      emissive: 0x14202a, // cold blue-teal sheen: wet oil, not purple carpet
    });
    const slickAt = (t: number, cross: number, r: number): void => {
      const c = F(t, cross, 0);
      const lat = F(t, cross + 1.2, 0).sub(F(t, cross - 1.2, 0)).normalize();
      const fwd = F(Math.min(0.999, t + 0.003), cross, 0)
        .sub(F(Math.max(0, t - 0.003), cross, 0))
        .normalize();
      const nrm = new THREE.Vector3().crossVectors(fwd, lat);
      if (nrm.y < 0) nrm.negate();
      nrm.normalize();
      const geo = new THREE.CircleGeometry(1, 16);
      const posA = geo.getAttribute("position") as THREE.BufferAttribute;
      let k1 = 1; // ring seam: first and last ring verts must jitter as one
      for (let i = 1; i < posA.count; i++) {
        const k = i === posA.count - 1 ? k1 : 0.72 + rnd() * 0.45;
        if (i === 1) k1 = k;
        posA.setXY(i, posA.getX(i) * k, posA.getY(i) * k);
      }
      geo.rotateX(-Math.PI / 2); // wobbly PS1 blob, facing up
      const mesh = new THREE.Mesh(geo, oilMat);
      const bz = new THREE.Vector3().crossVectors(lat, nrm).normalize();
      mesh.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(lat, nrm, bz),
      );
      mesh.scale.set(r, 1, r * 1.9); // smeared along the direction of travel
      mesh.position.copy(c).addScaledVector(nrm, 0.06);
      mesh.name = "oil slick";
      mesh.userData.slippy = true;
      this.root.add(mesh);
      this.groundMeshes.push(mesh);
    };
    const slicks: [number, number, number][] = [
      [0.065, -5.6, 1.9], [0.13, 0, 2.1], [0.22, 5, 1.8], [0.3, -2.2, 2],
      [0.415, 5.8, 2.2], [0.49, -5.2, 1.9], [0.61, 1.6, 2.1], [0.7, -5.8, 1.8],
      [0.78, 3.4, 1.9], [0.86, -1.2, 2.1],
    ];
    for (const [st, sc, sr] of slicks) slickAt(st, sc, sr);

    // ---- pickups, checkpoints, the finish --------------------------------
    this.ribbonFruit(road, 0.03, 0.09, 8);
    this.ribbonFruit(road, 0.18, 0.24, 8);
    this.ribbonFruit(road, 0.33, 0.38, 6);
    this.ribbonFruit(road, 0.5, 0.56, 8);
    this.ribbonFruit(road, 0.66, 0.72, 6);
    this.ribbonFruit(road, 0.85, 0.92, 8);
    const gem = F(0.48, 5.6, 1.2);
    this.crystal(gem.x, gem.y, gem.z);
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const p = F(t, 5.6, 0);
      this.checkpoint(p.y, p.z, p.x);
    }

    // ---- THE ARRIVAL: the beach car park ---------------------------------
    // The road empties onto a tarmac apron by the sand: painted bays, a kerb
    // wall on the sea side, parked cars, palms — and the warp pad waiting at
    // the entrance.
    const end = F(0.997, 0, 0);
    const back = F(0.985, 0, 0);
    const D = new THREE.Vector3().subVectors(end, back).setY(0).normalize();
    const Rv = new THREE.Vector3()
      .subVectors(F(0.997, 1, 0), end)
      .setY(0)
      .normalize();
    const yawEnd = Math.atan2(-Rv.z, Rv.x); // yawed local +x lands on deck-right
    const lotAt = (a: number, b: number): THREE.Vector3 =>
      new THREE.Vector3(
        end.x + D.x * 20 + Rv.x * a + D.x * b,
        0,
        end.z + D.z * 20 + Rv.z * a + D.z * b,
      );
    const lotTop = end.y - 0.02;
    const lotMat = new THREE.MeshLambertMaterial({ color: 0x4e5257 });
    const lot = new THREE.Mesh(new THREE.BoxGeometry(66, 0.8, 44), lotMat);
    const lc = lotAt(0, 0);
    lot.position.set(lc.x, lotTop - 0.4, lc.z);
    lot.rotation.y = yawEnd;
    lot.name = "beach car park";
    this.root.add(lot);
    this.groundMeshes.push(lot);
    // painted bay dividers along the seaward row
    const bayGeo = new THREE.BoxGeometry(0.16, 0.06, 5.4);
    const bayMat = new THREE.MeshLambertMaterial({
      color: 0xe8e8e0,
      emissive: 0x333330,
    });
    const yawQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yawEnd, 0));
    for (let b = -4; b <= 4; b++) {
      const p = lotAt(b * 3.4, 14);
      this.putDecor("bay line", bayGeo, bayMat,
        new THREE.Matrix4().compose(
          new THREE.Vector3(p.x, lotTop + 0.03, p.z),
          yawQ,
          new THREE.Vector3(1, 1, 1),
        ));
    }
    // low kerb wall so the lot does not just pour into the sea
    const kerbGeo = new THREE.BoxGeometry(66, 0.5, 0.5);
    const kerbMat = new THREE.MeshLambertMaterial({ color: 0xb8b4a8 });
    const kp = lotAt(0, 21.6);
    this.putDecor("sea kerb", kerbGeo, kerbMat,
      new THREE.Matrix4().compose(
        new THREE.Vector3(kp.x, lotTop + 0.25, kp.z),
        yawQ,
        new THREE.Vector3(1, 1, 1),
      ));
    // parked cars nosed into the bays (plain scenery, nobody home)
    for (const [slot, ci] of [[-3.5, 1], [-1.5, 4], [0.5, 2], [2.5, 5], [3.5, 0]] as const) {
      const { group } = makeCar(carCols[ci]);
      const p = lotAt(slot * 3.4 + 1.7, 14);
      group.position.set(p.x, lotTop, p.z);
      group.rotation.y = yawEnd + (rnd() - 0.5) * 0.12;
      this.root.add(group);
    }
    // ---- THE BEACH, expanded -------------------------------------------
    // A ~190m crescent of sand built from the same shoreline spline the
    // water system runs on, so the swash, wet sand and moving waterline all
    // land exactly on this surface. The inland edge climbs to meet the
    // tarmac; the seaward rows dive under the sea so the shoreline is a
    // real geometric intersection.
    const shore: ShoreSample[] = [];
    const NSHORE = 34;
    const shoreA = (s: number): number => 44 + 12 * Math.pow(s / 95, 2);
    const inlandA = (s: number): number =>
      17 + 14 * (1 - THREE.MathUtils.smoothstep(Math.abs(s), 26, 34)); // 31 beside the lot: tucks 2m UNDER its slab, no sliver of sea
    for (let i = 0; i < NSHORE; i++) {
      const s = -95 + (190 * i) / (NSHORE - 1);
      const p = lotAt(shoreA(s), s);
      shore.push({ x: p.x, z: p.z, sx: Rv.x, sz: Rv.z, beachSlope: 0.055, bedSlope: 0.13 });
    }
    {
      const rows = 7;
      const posArr: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < NSHORE; i++) {
        const s = -95 + (190 * i) / (NSHORE - 1);
        const aSh = shoreA(s);
        const span = aSh - inlandA(s);
        for (let r = 0; r < rows; r++) {
          const dIn = r < 5 ? span * (1 - r / 4.4) : r === 5 ? -4 : -9;
          const p = lotAt(aSh - dIn, s);
          let h = 0.15 + (dIn > 0 ? dIn * 0.055 : dIn * 0.13);
          const f = span > 0 ? dIn / span : 0;
          h = THREE.MathUtils.lerp(h, lotTop - 0.12, THREE.MathUtils.smoothstep(f, 0.55, 1));
          posArr.push(p.x, h, p.z);
        }
      }
      for (let i = 0; i < NSHORE - 1; i++)
        for (let r = 0; r < rows - 1; r++) {
          const k = i * rows + r;
          idx.push(k, k + rows, k + 1, k + 1, k + rows, k + rows + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(posArr), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      // winding depends on the lot frame's handedness — a down-facing beach
      // is invisible to lighting AND to the ground raycast (you fall through)
      const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
      if (nrm.getY(0) < 0) {
        const ia = g.getIndex()!.array as Uint32Array;
        for (let k = 0; k < ia.length; k += 3) {
          const tmp = ia[k + 1];
          ia[k + 1] = ia[k + 2];
          ia[k + 2] = tmp;
        }
        g.getIndex()!.needsUpdate = true;
        g.computeVertexNormals();
      }
      const sand = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xe2d0a4 }));
      sand.name = "beach sand";
      this.root.add(sand);
      this.groundMeshes.push(sand);
    }
    // the sea itself: fixed world-space ocean chunks + the nearshore ribbon
    // + foam/swash/wet sand. The beach height function is shared with the
    // sand ribbon above, so clipping, swash and wet sand land EXACTLY on it.
    const beachHeight = (x: number, z: number): number => {
      const dx = x - lc.x;
      const dz = z - lc.z;
      const a = dx * Rv.x + dz * Rv.z;
      const s = THREE.MathUtils.clamp(dx * D.x + dz * D.z, -95, 95);
      const aSh = shoreA(s);
      const dIn = aSh - a;
      let h = 0.15 + (dIn > 0 ? dIn * 0.055 : dIn * 0.13);
      const span = aSh - inlandA(s);
      const f = span > 0 ? dIn / span : 0;
      h = THREE.MathUtils.lerp(h, lotTop - 0.12, THREE.MathUtils.smoothstep(f, 0.55, 1));
      return h;
    };
    this.water = new CoastWater({
      shore,
      seaLevel: 0,
      shoreDirX: -Rv.x,
      shoreDirZ: -Rv.z,
      course: this.lanePts.map((q) => ({ x: q.x, z: q.z })),
      terrainHeight: beachHeight,
    });
    this.root.add(this.water.group);
    // palms: a lean trunk and a whorl of drooping fronds, PS1 cheap
    const palmTrunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 5.2, 5);
    const palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
    const frondGeo = new THREE.ConeGeometry(0.5, 3.2, 4);
    frondGeo.scale(1, 1, 0.22);
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x3e8a3e });
    const palm = (x: number, y: number, z: number, sc2: number): void => {
      const leanE = new THREE.Euler(0.1 + rnd() * 0.12, rnd() * 6.28, 0);
      const leanQ = new THREE.Quaternion().setFromEuler(leanE);
      this.putDecor("palm trunk", palmTrunkGeo, palmTrunkMat,
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y + 2.6 * sc2, z),
          leanQ,
          new THREE.Vector3(sc2, sc2, sc2),
        ));
      for (let fr = 0; fr < 6; fr++) {
        const a = (fr / 6) * Math.PI * 2 + rnd() * 0.5;
        const fq = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(1.62 + rnd() * 0.25, a, 0, "YXZ"),
        );
        this.putDecor("palm frond", frondGeo, frondMat,
          new THREE.Matrix4().compose(
            new THREE.Vector3(
              x + Math.sin(a) * 1.1 * sc2,
              y + 5.2 * sc2,
              z + Math.cos(a) * 1.1 * sc2,
            ),
            fq,
            new THREE.Vector3(sc2, sc2, sc2),
          ));
      }
    };
    for (const [a, b] of [[-28, 3], [-25, 19], [28, 2], [25, 19], [-8, 23.5], [10, 23.5]] as const) {
      const p = lotAt(a, b);
      palm(p.x, lotTop, p.z, 0.85 + rnd() * 0.35);
    }
    this.bakeDecor(); // bay lines, kerb, surf + palms in one arrival batch

    this.finishZ = end.z;
    this.finishGate(end.y, end.z, end.x, THREE.MathUtils.radToDeg(yawEnd));
  }

  // THE WARP ROOM. Not a course — a chamber, straight out of the Crash 2
  // reference: five great circular stone gates stand in a ring around a gold
  // dais, each filled with the wormhole. The gate hardware is the trick that
  // completes the loop illusion: a deep stone collar overlaps the disc's
  // outer band on both faces, so newborn rings (born at 0.99 of the disc)
  // fade in BEHIND the masonry and emerge already travelling — the endless
  // swallow never shows its seam.
  private buildWarpRoom(): void {
    this.skyPreset = "night";
    this.killY = -24;
    this.theme = {
      skyTop: "#060a1c",
      skyBottom: "#101a38",
      sunColorHex: "", // no sun down here — the gates are the light
      sunU: 0.5,
      sunV: 0.5,
      stars: true,
      fog: 0x070b1a,
      fogNear: 26,
      fogFar: 120,
      hemiSky: 0x39466b,
      hemiGround: 0x151a28,
      hemiI: 0.85,
      sunColor: 0x8fa8e8,
      sunI: 0.6,
      particleColor: 0x9fc4ff, // slow drifting motes, warp-room dust
      particleWind: [0.08, 0.12, 0.08],
    };

    const stone = new THREE.MeshLambertMaterial({
      color: 0x46536d,
      emissive: 0x0c101c,
    });
    const frameMat = new THREE.MeshLambertMaterial({
      color: 0x5b6478,
      emissive: 0x0e1119,
    });
    const boltMat = new THREE.MeshLambertMaterial({
      color: 0x8b93a8,
      emissive: 0x14161e,
    });
    const collarMat = new THREE.MeshLambertMaterial({
      color: 0x2a3040,
      emissive: 0x080a12,
      side: THREE.DoubleSide,
    });

    // the chamber: one broad stone drum, a raised rim lip, a gold dais
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(30, 31.5, 2, 24), stone);
    floor.position.y = -1;
    floor.name = "warp chamber floor";
    this.root.add(floor);
    this.groundMeshes.push(floor);
    const lip = new THREE.Mesh(new THREE.CylinderGeometry(31.5, 31.8, 1.6, 24), frameMat);
    lip.position.y = -0.2;
    lip.name = "chamber rim";
    this.root.add(lip);
    this.groundMeshes.push(lip);
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(31.8, 31.8, 16, 24, 1, true),
      new THREE.MeshLambertMaterial({
        color: 0x232c42,
        emissive: 0x060810,
        side: THREE.BackSide,
      }),
    );
    wall.position.y = 8;
    this.root.add(wall);
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(5.4, 6, 0.7, 20),
      new THREE.MeshLambertMaterial({ color: 0x8a6b3a, emissive: 0x1c1206 }),
    );
    dais.position.y = 0.35;
    dais.name = "warp dais";
    this.root.add(dais);
    this.groundMeshes.push(dais);

    // five gates in a pentagon, wormholes inside, faces turned to the dais
    const RS = 4.4; // the warpPortal preset's world radius
    const portalPreset = { ...SWIRL_PRESETS.warpPortal, billboard: false };
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      const gx = Math.cos(a) * 21;
      const gz = Math.sin(a) * 21;
      const cy = 5.1; // portal centre height: disc bottom clears the floor
      const gate = new THREE.Group();
      gate.position.set(gx, 0, gz);
      gate.lookAt(0, 0, 0);
      this.root.add(gate);

      // the collar that hides the seam: a deep annulus over the disc's outer
      // band, one plate each side, plus masonry blocks with studs
      const collarGeo = new THREE.RingGeometry(RS * 0.73, RS * 1.26, 24);
      for (const zs of [0.55, -0.55]) {
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.set(0, cy, zs);
        gate.add(collar);
      }
      for (let b = 0; b < 10; b++) {
        const sa = (b / 10) * Math.PI * 2 + (i % 2 === 0 ? 0 : 0.31);
        const bx = Math.cos(sa) * RS * 1.06;
        const by = cy + Math.sin(sa) * RS * 1.06;
        const block = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 1.5), frameMat);
        block.position.set(bx, by, 0);
        block.rotation.z = sa + Math.PI / 2;
        gate.add(block);
        if (b % 2 === 0) {
          const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 2.1), boltMat);
          bolt.position.set(bx, by, 0);
          bolt.rotation.z = sa;
          gate.add(bolt);
        }
      }
      for (const fx of [-1, 1]) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.8, 2.6), frameMat);
        foot.position.set(fx * RS * 0.98, 0.9, 0);
        gate.add(foot);
      }
      const step = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.7, 3.2), stone);
      step.position.set(0, 0.35, 2.2);
      step.name = "gate step";
      gate.add(step);
      this.groundMeshes.push(step);

      // the wormhole itself — fixed facing (no billboard), phase-offset per
      // gate so the five swallows never sync up
      const sw = swirls.spawn(portalPreset, gx, cy, gz, { seed: 11 + i * 7 });
      sw.group.quaternion.copy(gate.quaternion);
    }
  }

  private buildJungle(): void {
    this.wallTint = 0xa79f7e; // ruin masonry, sandstone rather than slate
    this.blockTint = 0xb3ab89; // temple courses
    this.curbTint = 0xd8b45c; // painted lips
    this.bermTint = 0x3d7a2c; // mossy path shoulders
    this.batchDecor = true; // hundreds of plants, baked one stretch at a time
    // Full daylight. Under the sunset dome the corridor's greens fought a pink
    // horizon and the canopy read as silhouette; the day painting puts the
    // light where a jungle floor wants it.
    this.skyPreset = "day";
    this.killY = -12; // well under the lowest strip, well over the ravine floor
    this.finishZ = -694;
    this.endWallZ = -714;
    // Late morning under a closed canopy: green humid haze, warm shafts.
    this.theme = {
      skyTop: "#1f6f86",
      skyBottom: "#ffe0a4",
      sunColorHex: "#fff2c4",
      sunU: 0.36,
      sunV: 0.34,
      stars: false,
      fog: 0x6fae7e, // the jungle closes the distance, so the haze is green
      fogNear: 26,
      fogFar: 155,
      hemiSky: 0xa6e2b4,
      hemiGround: 0x54401e,
      hemiI: 1.2,
      sunColor: 0xffeab0,
      sunI: 1.5,
      particleColor: 0xdaf0a0, // leaf motes on a slow downdraft
      particleWind: [0.65, -0.35, 0.2],
    };

    const matA = new THREE.MeshLambertMaterial({ color: 0x4f9a42 });
    const matB = new THREE.MeshLambertMaterial({ color: 0x5cab4c });
    const matStone = new THREE.MeshLambertMaterial({ color: 0xaea684 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x9e9678 });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0xa9b072 });

    // ---- THE SPINE ---------------------------------------------------------
    // straight() is how much WIND is allowed at this z: 1 out in the jungle, 0
    // where a built structure takes over. Because it multiplies both the drift
    // and the roll, a strip that ends inside a straight zone ends at exactly
    // x 0, y 0 — which is how the corridors meet the temple and the finish
    // landing flush without a single hand-tuned offset.
    const straight = (z: number): number =>
      1 -
      THREE.MathUtils.smoothstep(-z, 276, 300) + // into the temple
      THREE.MathUtils.smoothstep(-z, 486, 510) - // back out of it
      THREE.MathUtils.smoothstep(-z, 640, 664); // into the finish landing
    // Two beats each, long against short, so the path never repeats visibly.
    // Peak drift ~8u sideways over ~150u of course (about 8 degrees off axis)
    // and ~3u of roll (about 3.5 degrees) — gentle enough that it reads as
    // terrain rather than as a slalom, steep enough to see from the deck.
    const gx = (z: number): number =>
      (Math.sin(z * 0.021) * 5.4 + Math.sin(z * 0.0083 + 1.7) * 3.1) *
      straight(z);
    // Hollows in the jungle floor: shallow dished bowls you run down into and
    // back out of. They live in the SPINE rather than in jungle()'s own `dips`
    // option, because a dip that only moves the walking surface leaves the
    // berms, the earth bank and the camera lane hanging in the air above it —
    // a hole in the corridor wall you can walk out through. In the spine the
    // whole cross-section drops together.
    const DIPS = [-74, -148, -268, -618, -652];
    const dip = (z: number): number => {
      let d = 0;
      for (const c of DIPS) {
        const t = z - c;
        d -= 2.2 * Math.exp(-(t * t) / (2 * 3.2 * 3.2));
      }
      return d;
    };
    const gy = (z: number): number =>
      (Math.sin(z * 0.0155 + 0.6) * 2.2 + Math.sin(z * 0.034 + 2.4) * 0.8) *
        straight(z) +
      dip(z);
    const spine: Spine = (z) => ({ dx: gx(z), dy: gy(z) });
    // deterministic jitter: the jungle must plant itself the same way every
    // load, or a captured copy would not match what you were just looking at
    const rnd = (i: number): number => {
      const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
      return s - Math.floor(s);
    };

    // ---- THE EARTH BANK ----------------------------------------------------
    // Solid ground either side of the path and under it, so a gap reads as a
    // cut THROUGH the jungle instead of a hole in the sky, and so the wall of
    // trees has something to stand on. Chunked to follow the spine, then baked
    // into ONE mesh: pure scenery, never a groundMesh, never a collider.
    const BANK_H = 14;
    const bank = (
      zNear: number,
      zFar: number,
      base = 0,
      inset = 5.1, // inner face — sits flush behind the berm, so no daylight
      underW = 10.4, // 0 = the structure below is solid already (the temple)
    ): void => {
      const depth = Math.abs(zNear - zFar);
      const n = Math.max(2, Math.round(depth / 7));
      const d = depth / n;
      for (let i = 0; i < n; i++) {
        const zm = zNear - d * (i + 0.5);
        const cy = base + gy(zm);
        // Scenery BLOCKS, not a bespoke merged mesh. It used to be one baked
        // mesh, which meant capturing the level dropped the whole bank on the
        // floor — you edited the jungle and the ground it stood in vanished.
        // As components they survive a capture, and the decor batcher merges
        // them right back into one draw call for play.
        const push = (w: number, ox: number, top: number): void =>
          this.decorBlock(
            gx(zm) + ox,
            top - BANK_H / 2,
            zm,
            w,
            BANK_H,
            d + 0.15,
          );
        // shoulders: tops tucked up INSIDE the berm's own height so the seam
        // between path and jungle floor never opens from a low camera.
        // 34 wide, not 20 — the far treeline stands on the outer end of this,
        // and a rank of trunks with nothing under it shows daylight below the
        // trunks, which is the level's own edge in frame.
        push(34, -(inset + 17), cy + 0.35);
        push(34, inset + 17, cy + 0.35);
        // and the mass under the path, capped below its deepest bump
        if (underW > 0) push(underW, 0, cy - 0.62);
      }
    };

    // ---- THE FAR TREELINE --------------------------------------------------
    // Past the last rank of trunks the jungle used to stop, and from a low
    // camera you could see straight out of the world at knee height — 17 of
    // 108 sampled sightlines did. What closes it is not more trees: it is a
    // band of deep-green massing standing behind them, which under this
    // level's green haze reads as jungle going on forever and costs twelve
    // triangles a chunk where another three hundred trees would have cost
    // sixty thousand.
    //
    // The TOP EDGE is the whole trick. A band of even height is a wall; this
    // one steps every chunk and overlaps its neighbours, so what you see over
    // the canopy is a ragged treeline against the sky. Two ranks, the further
    // one taller and darker, because one flat silhouette has no depth in it.
    const treeline = (
      zNear: number,
      zFar: number,
      base = 0,
      inset = 27,
    ): void => {
      const depth = Math.abs(zNear - zFar);
      const n = Math.max(2, Math.round(depth / 8));
      const d = depth / n;
      for (let i = 0; i < n; i++) {
        const zm = zNear - d * (i + 0.5);
        const cy = base + gy(zm);
        for (const side of [-1, 1]) {
          const k = (i * 2 + (side > 0 ? 1 : 0)) * 13;
          // near rank: broken, mid green, tops between 15 and 23
          const h1 = 15 + rnd(k) * 8;
          this.decorBlock(
            gx(zm) + side * (inset + rnd(k + 3) * 3),
            cy + h1 / 2 - 2,
            zm,
            9 + rnd(k + 7) * 4,
            h1,
            d * 1.25,
            0x2f6b2c,
            "jungle",
          );
          // far rank: taller, darker, set back — the depth cue that stops the
          // near one reading as a painted flat
          const h2 = 22 + rnd(k + 11) * 10;
          this.decorBlock(
            gx(zm) + side * (inset + 11 + rnd(k + 17) * 4),
            cy + h2 / 2 - 2,
            zm + (rnd(k + 23) - 0.5) * d,
            12 + rnd(k + 29) * 6,
            h2,
            d * 1.4,
            0x1d4a26,
            "jungle",
          );
        }
      }
    };

    // ---- THE COLONNADE -----------------------------------------------------
    // An avenue of masonry the forest has grown up through, standing just
    // outside the undergrowth on both flanks. The point is RHYTHM: scattered
    // stones read as debris, but a repeating beat reads as something that was
    // BUILT here and then lost, which is the story the level is telling. So
    // the uprights land on a fixed interval, every third pair squares off
    // directly opposite to make a gateway, and the beat is dressed with
    // fallen pieces at the feet so it never looks like fenceposts.
    const UPRIGHT = [
      "statue_column",
      "statue_columnDamaged",
      "pillar-square",
      "pillar-obelisk",
      "ruins#Column_Round_Short",
      "statue_obelisk",
    ].map((id) => propVariant("slab", id));
    // the plants with mass in them, for anything that has to hang over the path
    const ARCHING = [
      "plant_bushDetailed",
      "plant_bushLargeTriangle",
      "plant_bushLarge",
      "grass_leafsLarge",
      "bigleaf",
    ].map((id) => propVariant("plants", id));
    const FALLEN = [
      "debris",
      "ruins#Bricks",
      "ruins#Floor_Diamond",
      "cobble",
      "platform_stone",
      "path_stoneCircle",
    ].map((id) => propVariant("slab", id));
    const colonnade = (
      zNear: number,
      zFar: number,
      base = 0,
      inset = 12.5,
      step = 16,
    ): void => {
      const n = Math.max(1, Math.round(Math.abs(zNear - zFar) / step));
      for (let i = 0; i < n; i++) {
        const z = zNear - (Math.abs(zNear - zFar) * (i + 0.5)) / n;
        const cy = base + gy(z) + 0.2;
        const paired = i % 3 === 0; // every third beat is a gateway
        for (const side of [-1, 1]) {
          const k = i * 197 + (side > 0 ? 61 : 0);
          if (!paired && (i + (side > 0 ? 1 : 0)) % 2 === 0) continue;
          const off = inset + rnd(k) * 2.2;
          this.propAt(
            "slab",
            gx(z) + side * off,
            cy,
            z + (rnd(k + 5) - 0.5) * 3,
            k,
            0.85 + rnd(k + 9) * 0.5,
            UPRIGHT,
            side * (rnd(k + 13) * 7 - 2), // most lean out, a few lean in
          );
          // something down at its foot, so the upright has a story
          if (rnd(k + 17) > 0.35)
            this.propAt(
              "slab",
              gx(z) + side * (off - 1.6 - rnd(k + 21) * 2.4),
              cy - 0.15,
              z + (rnd(k + 25) - 0.5) * 5,
              k + 3,
              0.8 + rnd(k + 29) * 0.6,
              FALLEN,
            );
        }
      }
    };

    // ---- THE WALL OF JUNGLE ------------------------------------------------
    // Undergrowth crowding the berm line, canopy standing behind it on the
    // bank, vines dropping through. Planted along the spine, so the greenery
    // bends with the path; '?lite' drops all of it (each helper self-skips).
    let slot = 0;
    const thicket = (
      zNear: number,
      zFar: number,
      base = 0,
      inset = 6.3, // where the undergrowth starts, just outside the berm
      ruins = false, // the temple stretch: masonry among the trees
    ): void => {
      const depth = Math.abs(zNear - zFar);
      const n = Math.max(2, Math.round(depth / 4.2));
      for (let i = 0; i < n; i++) {
        const z = zNear - (depth * (i + 0.5)) / n;
        const cx = gx(z);
        const y = base + gy(z) + 0.35;
        for (const side of [-1, 1]) {
          const k = slot++;
          const a = rnd(k);
          const b = rnd(k + 101);
          const c = rnd(k + 211);
          const d = rnd(k + 331);
          const jz = z + c * 3.4 - 1.7;
          // ROW 1 — undergrowth crowding the kerb, one of three characters
          if (a < 0.44)
            this.broadleaf(cx + side * (inset + b * 1.6), y, jz, 1 + b * 0.9);
          else if (a < 0.74)
            this.fern(cx + side * (inset + b * 1.4), y, jz, 1.2 + b * 1);
          else
            this.toadstools(
              cx + side * (inset + 0.3 + b * 1.5),
              y,
              jz,
              0.7 + b * 0.6,
            );
          // ...and a second plant behind it, so the floor is never bare dirt
          if (d < 0.62)
            this.fern(cx + side * (inset + 1.9 + d * 2.6), y, z + d * 4 - 2, 0.9 + d);
          else if (d < 0.86)
            this.broadleaf(cx + side * (inset + 2.2 + c * 2.4), y, z - d * 3, 1.1 + c * 0.8);
          // ROW 2 — the canopy that closes the corridor overhead.
          // ROW 3 — a taller, deeper rank: without it the greenery reads as a
          // painted fringe with sky behind it instead of as a jungle.
          //
          // Both ranks used to be the hand-built jungleTree and nothing else,
          // which is four hundred and forty-one copies of ONE silhouette
          // standing in a row — and no amount of scale jitter hides that. They
          // now come out of the library nine times in twelve, so the canopy is
          // palms and figs and flat-tops and slender trunks, and the original
          // tree is one voice in it rather than the whole choir.
          const libTree = (
            ox: number,
            oy: number,
            oz: number,
            h: number,
            slot2: number,
          ): void => {
            if (rnd(k + slot2) < 0.25) {
              this.jungleTree(cx + side * ox, y + oy, z + oz, h, side * (0.03 + a * 0.08));
            } else {
              this.propAt(
                "tree",
                cx + side * ox,
                y + oy,
                z + oz,
                k * 977 + slot2,
                h / 11, // the family stands ~11u tall at scale 1
                undefined,
                side * (1.5 + rnd(k + slot2 + 7) * 4), // canopies lean off the bank
              );
            }
          };
          if (b < 0.66) libTree(inset + 3.2 + c * 6, 0, a * 4 - 2, 8 + c * 5, 401);
          if (a > 0.3) libTree(inset + 9.4 + b * 8, -0.35, c * 6 - 3, 11 + a * 7, 409);
          if (c > 0.62)
            this.vines(
              cx + side * (inset + 1.1 + a * 2),
              y + 7.4 + b * 2.4,
              z + b * 3 - 1.5,
              3 + a * 3.4,
              3,
            );
          if (b > 0.8)
            this.rock(cx + side * (inset + a * 1.8), y - 0.25, jz, 1 + a * 1.1);
          if (a > 0.86) this.flowers(cx + side * (inset + c * 1.2), y, jz);
          // ---- THE LIBRARY LAYER ----------------------------------------
          // The same stretch again, drawn from the external kit. A hand-built
          // fern is always the same fern; these roll a model, a colour, a
          // size, a spin and a lean out of where they stand, so the second
          // pass never repeats the first — that is the whole point of it.
          if (d > 0.28)
            this.propAt(
              "plants",
              cx + side * (inset + 0.4 + b * 3.4),
              y,
              jz + 0.9,
              k * 977 + 11,
              0.85 + c * 0.6,
            );
          // FOREGROUND OVERHANG. A big frond up on the bank, leaning IN over
          // the path. This is what frames the corridor top-left and top-right
          // the way the reference does — without it the greenery is a wall you
          // run between rather than a canopy you run under, however dense it
          // gets. Leans toward -x on the right flank and +x on the left, so
          // both sides reach across.
          // Only the BUSHY models: a couple of these plants are flat fans, and
          // a flat fan tipped forty degrees is a signboard, not a frond.
          if (c > 0.5)
            this.propAt(
              "plants",
              cx + side * (inset + 0.9 + a * 1.9),
              y + 3.0 + b * 2.2,
              jz - 1.1,
              k * 977 + 131,
              0.95 + a * 0.45,
              ARCHING,
              side * (15 + b * 15),
            );
          if (a > 0.52)
            this.propAt(
              "tree",
              cx + side * (inset + 6.5 + c * 9),
              y - 0.3,
              z + b * 5 - 2.5,
              k * 977 + 23,
              0.85 + b * 0.45,
            );
          // Boulders and fallen trunks were the two families barely getting
          // used — fifty-four and thirty-two across six hundred metres of
          // course, which is not a jungle floor, it is a garnish. A fallen
          // trunk in particular is one of the shapes this level was asked for.
          if (c > 0.68)
            this.propAt(
              "boulder",
              cx + side * (inset + 2.6 + a * 3.2),
              y - 0.25,
              z - c * 3,
              k * 977 + 37,
              0.8 + b * 0.5,
            );
          if (b > 0.7)
            this.propAt(
              "rocks",
              cx + side * (inset + 1.2 + c * 2.8),
              y - 0.1,
              jz - 1.3,
              k * 977 + 53,
            );
          if (a > 0.66)
            this.propAt(
              "trunk",
              cx + side * (inset + 3 + b * 2.6),
              y - 0.1,
              z + c * 4 - 2,
              k * 977 + 71,
              0.9 + a * 0.5,
            );
          // ...and where the temple stands, its masonry lying about in the
          // undergrowth: columns, stelae, broken wall, rubble
          if (ruins && d > 0.42)
            this.propAt(
              "slab",
              cx + side * (inset + 1.4 + a * 6),
              y - 0.15,
              z + d * 5 - 2.5,
              k * 977 + 97,
              0.75 + c * 0.55,
            );
        }
      }
      // one mesh per shape for THIS stretch, so the jungle still frustum-culls
      this.bakeDecor();
    };

    // ---- GROUND ------------------------------------------------------------
    // A. the clearing you wake up in — wide, soft, nothing to fall off
    this.jungle("clearing", 14, -34, 0, 14, matB, {
      amp: 0.3,
      spine,
      tex: "grass",
    });
    bank(14, -34);
    this.spawnPos.set(gx(6), gy(6) + 0.2, 6);
    this.currentSpawn.copy(this.spawnPos);

    // B. undergrowth corridors, split by two hops over cuts in the jungle
    //    floor (5.5 and 6.0 — clearable at a walk, comfortable at a cruise)
    this.jungle("corridor A", -39.5, -104, 0, 12, matA, {
      amp: 0.45,
      spine,
    });
    bank(-39.5, -104);
    this.jungle("corridor B", -110, -176, 0, 12, matB, {
      amp: 0.45,
      spine,
    });
    bank(-110, -176);

    // C. THE RAVINE: 60 units of nothing, one fallen trunk laid across it
    // the ravine keeps its SIDES — the walls of the cut are what make it read
    // as 60 units of missing jungle floor rather than a hole in the world
    bank(-176, -236, 0, 5.1, 0);
    this.jungle("corridor C", -236, -300, 0, 12, matA, {
      amp: 0.45,
      spine,
    });
    bank(-236, -300);

    // D. THE TEMPLE: the spine is straight here, so everything below is
    //    plain masonry at x 0 and the corridors meet it dead flush
    this.slab("temple floor", -300, -390, 0, 16, matStone, true, 0, "stone");
    const TIER = 2.3; // one course under the 2.97 jump apex, so each is a hop
    const tierX = [-2.6, 2.6, -2.6, 2.6, 0];
    for (let i = 0; i < 5; i++) {
      const top = TIER * (i + 1);
      const z = -332 - i * 12;
      const d = i === 4 ? 14 : 10; // the last course runs into the terrace
      this.stepBlock(tierX[i], z, 8, d, Math.max(-0.8, top - 5), top);
    }
    this.slab("ruin terrace", -386, -444, 11.5, 16, matStone, true, 0, "stone");
    this.ramp("temple descent", -444, 11.5, -486, 0.4, 14, matRamp, 0, "stone");
    // ruin walls hold the whole temple in — 16 tall, so the terrace has a
    // parapet you cannot hop
    for (let z = -300; z > -486; z -= 26) {
      const d = Math.min(26, z + 486);
      this.wall(-9, z - d / 2, 1.2, d, 0, 16);
      this.wall(9, z - d / 2, 1.2, d, 0, 16);
    }
    // Behind the walls the jungle floor stands HIGH — the temple is a cutting
    // through it, which is why the climb exists. Planting up there is also the
    // only way the canopy clears a 16-tall parapet; at ground level you look
    // off the terrace into blank sky.
    bank(-300, -486, 5, 9.6, 0); // no under-mass: the temple floor is solid

    // E. back into the jungle, two more cuts, then the landing
    this.jungle("corridor D", -492.5, -566, 0, 12, matB, { amp: 0.45, spine });
    bank(-492.5, -566);
    this.jungle("corridor E", -572, -676, 0, 12, matA, {
      amp: 0.45,
      spine,
    });
    bank(-572, -676);
    this.slab("finish landing", -676, -718, 0, 14, matFinish, true, 0, "stone");
    bank(-676, -718);
    // the landing is straight masonry, so it gets masonry sides rather than
    // berms — but it still has to be closed, same as everywhere else
    for (let z = -676; z > -718; z -= 21) {
      this.wall(-7.6, z - 10.5, 1.2, 21, 0, 6);
      this.wall(7.6, z - 10.5, 1.2, 21, 0, 6);
    }

    // the ravine floor, far enough down to be scenery: killY catches you 1.2
    // above it, so it is something to look into and never something to land on
    this.decorBlock(0, -13.7, -352, 140, 1, 940, 0x1e3521, "moss");

    // ---- HARD PIT INTERIORS ------------------------------------------------
    // Every cut used to be open air between two displaced planes: nothing to
    // hit, nothing to bounce off, and a short jump just vanished under the
    // lip. The gaps are lined with MASONRY now — real wall() components
    // (captured to the editor like any other), faces flush with the strip
    // ends and bodies tucked UNDER the strips so the pit mouth stays fully
    // open. Collider tops sit 0.5 under the wavy floor (no phantom curb);
    // the visual runs a little higher and reads as a stone pit edging.
    // Smack into them, wallride them, ledge-grab their lips — the inside of
    // a pit is a place now, not an absence.
    const pitWalls = (
      z0: number, // near strip's END (less negative z)
      z1: number, // far strip's START
      sideX: number, // half-width of the visible cut (the scenery walls' line)
      lip0 = gy(z0),
      lip1 = gy(z1),
    ): void => {
      const base = -12.5;
      const hN = lip0 - 0.5 - base;
      const hF = lip1 - 0.5 - base;
      this.wall(gx(z0), z0 + 0.6, 15, 1.2, base, hN, hN + 0.45);
      this.wall(gx(z1), z1 - 0.6, 15, 1.2, base, hF, hF + 0.45);
      const zm = (z0 + z1) / 2;
      const d = Math.abs(z0 - z1);
      const hS = Math.min(hN, hF);
      this.wall(gx(zm) - sideX - 0.6, zm, 1.2, d, base, hS, hS + 0.45);
      this.wall(gx(zm) + sideX + 0.6, zm, 1.2, d, base, hS, hS + 0.45);
    };
    pitWalls(-104, -110, 5.2); // hop 1
    pitWalls(-176, -236, 5.1); // THE RAVINE: 60 units of pit with real walls
    pitWalls(-486, -492.5, 5.2, 0.4); // below the temple descent (ramp ends at y 0.4)
    pitWalls(-566, -572, 5.2); // hop 2 on the run home

    // ---- THE FALLEN TRUNK --------------------------------------------------
    // The ravine crossing. The trunk IS the rail: the grind line is sampled
    // off the spine and the bark segments are hung underneath it, so the ride
    // follows the corridor's own bend instead of cutting the corner. Visual
    // only — no collider on the wood, so nothing can snag you mid-grind.
    {
      const N = 6;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= N; i++) {
        const z = THREE.MathUtils.lerp(-172, -240, i / N);
        pts.push(new THREE.Vector3(gx(z), gy(z) + 0.62, z));
      }
      const barkMat = this.baseMat("fallenLog", 0x7a5533, "wood", 1, 6);
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < N; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.62, 0.62, a.distanceTo(b) + 0.12, 8),
          barkMat,
        );
        seg.position.copy(a).lerp(b, 0.5).setY(seg.position.y - 0.62);
        seg.quaternion.setFromUnitVectors(
          up,
          b.clone().sub(a).normalize(),
        );
        this.root.add(seg);
      }
      this.rails.push(new Rail(pts, false)); // the trunk is the visual
      // the stump it fell from, and the root plate at the far side
      this.jungleTree(gx(-168) - 7.4, 0.35, -168, 5.2, 0.06);
      this.rock(gx(-244) + 6.6, 0.1, -244, 2.1);
    }

    // a grind line down the temple descent, for anyone who would rather ride
    // the ramp than run it
    const rampRail = new Rail([
      new THREE.Vector3(3.7, 11.7, -444),
      new THREE.Vector3(3.7, 0.6, -486),
    ]);
    this.rails.push(rampRail);
    this.root.add(rampRail.object);

    // ---- DRESSING THE RUIN -------------------------------------------------
    // Idols frame the temple mouth (they are solid, so they narrow the way in),
    // mossy masonry stacks against the walls, vines pour off the parapet.
    this.idol(-6.1, 0, -306, 1.5, 0.22);
    this.idol(6.1, 0, -306, 1.5, -0.22);
    this.idol(-5.4, 11.5, -436, 1.3, 0.5);
    this.idol(5.4, 11.5, -436, 1.3, -0.5);
    for (let i = 0; i < 9; i++) {
      const z = -304 - i * 20;
      const h = 1.4 + rnd(i * 7) * 2.6;
      this.ruinBlock(-7.4, 0, z, 2.4, h, 3.4, rnd(i) * 0.2 - 0.1);
      this.ruinBlock(7.4, 0, z - 9, 2.4, 1.2 + rnd(i * 3) * 2.4, 3.4, 0.08);
      this.vines(-8.2, 15.4, z - 4, 5 + rnd(i * 11) * 4, 3);
      this.vines(8.2, 15.4, z - 13, 5 + rnd(i * 13) * 4, 3);
    }
    // the jungle taking the ruin back: growth out of every wall base, moss and
    // creepers down the faces, caps in the damp corners
    for (let i = 0; i < 14; i++) {
      const z = -302 - i * 13;
      const e = rnd(i * 5 + 3);
      const f = rnd(i * 9 + 17);
      const onTerrace = z < -386 && z > -444;
      const y = onTerrace ? 11.5 : z < -444 ? 11.5 - ((-444 - z) / 42) * 11.1 : 0;
      this.fern(-7.2 + e * 0.9, y, z, 1.1 + e * 0.8);
      this.fern(7.2 - f * 0.9, y, z - 6, 1 + f * 0.9);
      if (e > 0.45) this.broadleaf(-6.9, y, z - 3, 1.1 + f * 0.7);
      if (f > 0.5) this.broadleaf(6.9, y, z - 9, 1 + e * 0.8);
      if (e > 0.68) this.toadstools(-6.6, y, z - 10, 0.75 + f * 0.5);
      if (f > 0.72) this.toadstools(6.6, y, z - 2, 0.7 + e * 0.5);
      this.vines(-7.9, y + 9.5 + (onTerrace ? 3 : 0), z - 5, 3.5 + e * 4, 3);
      this.vines(7.9, y + 9.5 + (onTerrace ? 3 : 0), z - 11, 3.5 + f * 4, 3);
    }

    // toppled courses lying on the temple floor and the terrace
    this.ruinBlock(-4.6, 0, -318, 3.2, 0.9, 2.2, 0.34);
    this.ruinBlock(4.9, 0, -368, 2.6, 0.7, 2.6, -0.22);
    this.ruinBlock(-5.8, 11.5, -400, 3.4, 1.1, 2.4, 0.16);
    this.ruinBlock(5.6, 11.5, -418, 2.8, 1.6, 2.8, -0.3);
    this.toadstools(-6.4, 11.5, -408, 1.1);
    this.toadstools(6.2, 0, -344, 0.95);
    this.broadleaf(-6.6, 11.5, -428, 1.4);
    this.broadleaf(6.7, 11.5, -394, 1.2);
    this.fern(-6.8, 0, -382, 1.3);
    this.fern(6.5, 0, -310, 1.2);

    // ---- PLANTING ----------------------------------------------------------
    // Four depths, every stretch, and they are four different jobs. UNDERGROWTH
    // and canopy crowd the kerb; the COLONNADE stands behind that and gives the
    // corridor its architecture; the TREELINE closes every sightline that gets
    // past both. Read outward from the path: leaves, trunks, stone, forest.
    const stretches: [number, number, number, number, boolean][] = [
      // zNear, zFar, base, inset, ruins lying in the undergrowth
      [14, -34, 0, 6.3, false],
      [-39.5, -104, 0, 6.3, false],
      [-110, -176, 0, 6.3, false],
      // the ravine gets a canopy too — it is a cut, not a void
      [-176, -236, 0, 6.3, false],
      // the approach: masonry starts showing up in the undergrowth BEFORE the
      // temple, because once you are inside the climb its own walls are all you
      // can see and the ruins on the high ground outside never read
      [-236, -300, 0, 6.3, true],
      // on the high ground outside the ruin walls
      [-300, -486, 5, 10.2, true],
      [-492.5, -566, 0, 6.3, false],
      [-572, -676, 0, 6.3, false],
      [-676, -718, 0, 6.3, false],
    ];
    for (const [zn, zf, base, inset, ruins] of stretches) {
      // the treeline OVERLAPS its neighbours by 9 units. Butt-joined, the seam
      // between two stretches opened a slot you could see straight through —
      // and the worst of them was exactly where the temple steps back down to
      // the run home, because there the two bands are at different heights too
      treeline(zn + 9, zf - 9, base, inset + 21);
      colonnade(zn, zf, base, inset + 6.2);
      thicket(zn, zf, base, inset, ruins); // flushes the batch for the stretch
    }

    // ---- FURNITURE ---------------------------------------------------------
    // Every seat below raycasts the terrain through floorY, and a mesh built
    // this frame still carries an identity world matrix until something asks
    // for one. Without this every crate would sit at its nominal height and
    // hover over (or sink into) the bumps.
    this.root.updateMatrixWorld(true);
    // `up` stacks: crate() only auto-stacks when the deck height it is handed
    // is within 0.9 of the crate below, and on a rolling floor that test can
    // just miss — which silently drops the second crate INSIDE the first
    // instead of on top of it. Handing it the stacked height is exact.
    const crateAt = (
      z: number,
      off: number,
      kind?: Parameters<Level["crate"]>[3],
      up = 0,
    ): void => this.crate(gx(z) + off, gy(z) + up * 0.96, z, kind);
    const fruitAt = (z: number, off = 0, h = 1.25): void =>
      this.pickup(gx(z) + off, gy(z) + h, z);

    // A. the clearing: a crate line to learn the spin on, one arrow crate
    crateAt(-8, -1.5);
    crateAt(-8, 0);
    crateAt(-8, 1.5);
    crateAt(-18, -2.2);
    crateAt(-18, 2.2);
    crateAt(-24, 0, "bouncy");
    fruitAt(-13, -1.5);
    fruitAt(-13, 1.5);
    this.log(gx(-28) - 6.5, gx(-28) + 6.5, gy(-28), -28); // first thing to hop

    // B. corridors: fruit strung over both cuts, crates around the dip
    for (let i = 0; i < 5; i++) fruitAt(-33 - i * 2.6, 0, 1.6);
    crateAt(-52, -1.4);
    crateAt(-52, 1.4);
    crateAt(-52, -1.4, undefined, 1); // stacked on the one below
    this.enemy(gx(-64) - 3.6, gx(-64) + 3.6, gy(-64), -64, 3, "x", "grunt");
    for (let i = 0; i < 4; i++) fruitAt(-70 - i * 2.4, 0, 1.5); // over the dip
    crateAt(-88, 0, "tnt");
    crateAt(-88, -1.6);
    crateAt(-88, 1.6);
    this.log(gx(-96) - 6.5, gx(-96) + 6.5, gy(-96), -96);
    for (let i = 0; i < 5; i++) fruitAt(-103 - i * 2.4, 0, 1.6);

    this.checkpoint(gy(-116), -116, gx(-116));
    crateAt(-124, -2.4);
    crateAt(-124, 2.4);
    crateAt(-131, 0, "nitro");
    this.enemy(gx(-140) - 3.4, gx(-140) + 3.4, gy(-140), -140, 2.6, "x", "turtle");
    for (let i = 0; i < 4; i++) fruitAt(-146 - i * 2.4, 0, 1.5);
    crateAt(-160, -1.5);
    crateAt(-160, 1.5);
    crateAt(-168, 0, "mystery");

    // C. the trunk: fruit strung along it, so the grind pays
    for (let i = 0; i < 9; i++) {
      const z = -178 - i * 7;
      this.pickup(gx(z), gy(z) + 1.5, z);
    }
    this.checkpoint(gy(-246), -246, gx(-246));
    crateAt(-254, -1.6);
    crateAt(-254, 1.6);
    this.enemy(gx(-266) - 3.8, gx(-266) + 3.8, gy(-266), -266, 4.4, "x", "charger");
    crateAt(-282, 0, "bouncy");
    crateAt(-290, -2);
    crateAt(-290, 2);

    // D. the temple: a hopper guarding the mouth, crates on the courses, a
    //    sentry holding the terrace, and the crystal off the racing line
    this.enemy(-4, 4, 0, -314, 3.4, "x", "hopper");
    this.crate(-2.6, 2.3, -330);
    this.crate(2.6, 4.6, -342);
    this.crate(-2.6, 6.9, -354, "mask");
    this.crate(2.6, 9.2, -366);
    this.pickup(-2.6, 3.6, -334);
    this.pickup(2.6, 5.9, -346);
    this.pickup(-2.6, 8.2, -358);
    this.pickup(2.6, 10.5, -370);
    this.enemy(-3, 3, 11.5, -404, 0, "x", "sentry");
    this.fruitRow(-394, -424, 12.8, 7, 0);
    this.crate(-3.4, 11.5, -414);
    this.crate(3.4, 11.5, -414);
    this.crate(0, 11.5, -428, "tnt");
    this.crystal(5.6, 11.5, -430);
    this.checkpoint(11.5, -396, 0);

    // E. the run home: a spinner on the last straight, then the landing
    this.enemy(0, 0, 0.4, -470, 0, "x", "spinner");
    crateAt(-500, -1.8);
    crateAt(-500, 1.8);
    for (let i = 0; i < 5; i++) fruitAt(-508 - i * 2.6, 0, 1.5);
    this.enemy(gx(-528) - 4, gx(-528) + 4, gy(-528), -528, 3.2, "x", "floater");
    crateAt(-542, 0, "bouncy");
    crateAt(-556, -1.5);
    crateAt(-556, 1.5);
    for (let i = 0; i < 5; i++) fruitAt(-565 - i * 2.4, 0, 1.6);
    this.checkpoint(gy(-580), -580, gx(-580));
    this.log(gx(-592) - 6.5, gx(-592) + 6.5, gy(-592), -592);
    crateAt(-604, -2.2);
    crateAt(-604, 2.2);
    crateAt(-604, -2.2, undefined, 1);
    crateAt(-604, 2.2, undefined, 1);
    this.enemy(gx(-616) - 3.6, gx(-616) + 3.6, gy(-616), -616, 3, "x", "spiker");
    for (let i = 0; i < 4; i++) fruitAt(-622 - i * 2.4, 0, 1.5);
    crateAt(-636, 0, "nitro");
    crateAt(-644, -1.6);
    crateAt(-644, 1.6);
    for (let i = 0; i < 4; i++) fruitAt(-656 - i * 2.4, 0, 1.6);
    crateAt(-668, 0, "mystery");

    this.finishGate(0, this.finishZ);
    this.endWall(0);

    // ---- CAMERA LANE -------------------------------------------------------
    // The spine again. Without it the frame would keep facing down -z while
    // the path bent out from under it; with it, screen-up is always "onward"
    // and the corridor stays centred through every bend. Height is authored
    // too, so the climb tilts the frame up instead of losing the player behind
    // the courses.
    const laneY = (z: number): number => {
      if (z > -300 || z < -486) return gy(z);
      if (z > -324) return 0; // temple approach
      if (z > -386)
        return THREE.MathUtils.clamp((-324 - z) / 62, 0, 1) * 11.5; // the climb
      if (z > -444) return 11.5; // terrace
      return THREE.MathUtils.mapLinear(z, -444, -486, 11.5, 0.4); // descent
    };
    const lane: { x: number; y: number; z: number }[] = [];
    for (let z = 20; z >= -718; z -= 6)
      lane.push({ x: gx(z), y: laneY(z), z });
    this.lanePts = lane;
    this.measureLane();
  }

  // Build-time ground probe: what the terrain actually is at (x, z). Used to
  // seat crates/enemies/checkpoints on wavy floors. Falls back to the given y.
  private floorY(x: number, z: number, fallback: number): number {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, fallback + 6, z),
      new THREE.Vector3(0, -1, 0),
      0,
      14,
    );
    const hits = ray.intersectObjects(this.groundMeshes, false);
    if (hits.length === 0) return fallback;
    return Math.abs(hits[0].point.y - fallback) <= 1.1
      ? hits[0].point.y
      : fallback;
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
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, deckY + 8, z),
      new THREE.Vector3(0, -1, 0),
      0,
      400,
    );
    const hits = ray.intersectObjects(this.groundMeshes, false);
    let best: number | null = null;
    for (const h of hits) {
      const y = h.point.y;
      if (y >= deckY - 0.6 && y <= deckY + 4 && (best === null || y < best))
        best = y;
    }
    return best;
  }

  // Wavy jungle floor strip: a heightfield with rolling bumps, and firm berm
  // walls (with grindable lips) along both sides so you can't fall off
  // sideways. Deterministic per strip. Anything that has to move the whole
  // cross-section — a bend, a climb, a hollow — belongs in the SPINE, not
  // here, so the berms and the bank move with it.
  private jungle(
    name: string,
    z0: number,
    z1: number,
    baseY: number,
    width: number,
    mat: THREE.Material,
    opts: {
      amp?: number;
      berms?: boolean;
      tex?: string;
      spine?: Spine;
    } = {},
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
      // The SPINE bends and rolls the whole strip. Unlike the surface noise it
      // is NOT faded at the ends — neighbouring strips have to meet flush, and
      // they only do that if both evaluate the same centreline at the join.
      if (opts.spine) {
        const sp = opts.spine(wz);
        pos.setX(i, lx + sp.dx);
        h += sp.dy;
      }
      pos.setY(i, h);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(
      geo,
      this.patterned(mat, width, depth, opts.tex ?? "jungle"),
    );
    mesh.position.set(cx, baseY, cz);
    mesh.name = name;
    // THE STRIP IS ITS OWN COMPONENT. Capture used to flatten a displaced
    // plane to its bounding box, so editing a level traded every roll, bend
    // and bump for one dead-level slab. The centreline is sampled off the
    // spine here and rides on the mesh; captureData ships it instead of the
    // box, and buildTerrain plays it back through this same function.
    //
    // BERMS BELONG TO THE STRIP. They used to capture separately, as chunk
    // walls plus lip rails, which round-tripped but came back grey and
    // straight-edged — a generic wall has no idea it was a mossy kerb bending
    // along a path. As a property of the strip they rebuild from the same
    // spine, in the same material, and a level sheds ~330 components.
    const nearZ = Math.max(z0, z1);
    const r2 = (n: number): number => Math.round(n * 100) / 100;
    const nodes: [number, number, number, number][] = [];
    const steps = Math.max(2, Math.round(depth / 6));
    for (let i = 0; i <= steps; i++) {
      const wz = nearZ - (depth * i) / steps;
      const sp = opts.spine ? opts.spine(wz) : { dx: 0, dy: 0 };
      nodes.push([r2(sp.dx), r2(wz - nearZ), 0, r2(sp.dy)]);
    }
    mesh.userData.terrainComp = {
      t: "terrain",
      p: [r2(cx), r2(baseY), r2(nearZ)],
      w: r2(width),
      amp: r2(amp),
      berms: opts.berms !== false,
      tex: opts.tex ?? "jungle",
      color:
        "#" +
        (mat as THREE.MeshLambertMaterial).color.getHexString(),
      pts: nodes,
      nm: name,
    } as CustomComponent;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    if (opts.berms !== false)
      this.berms(z0, z1, baseY, width, cx, opts.spine);
  }

  /** Build one terrain component — the other half of the stamp in jungle(). */
  private buildTerrain(c: CustomComponent): void {
    // nodes are [dx, dz, corner radius, dy] from p, the rail convention, so
    // the pen tool and the per-node fields work on a floor the same way they
    // work on a grind line. Sorted near-to-far, because a dragged node can
    // cross its neighbour and the strip must not turn inside out.
    const raw = (c.pts && c.pts.length >= 2 ? c.pts : [[0, 0], [0, -40]]) as (
      | [number, number]
      | [number, number, number]
      | [number, number, number, number]
    )[];
    const nodes = raw
      .map((q) => ({ dx: q[0] ?? 0, z: c.p[2] + (q[1] ?? 0), dy: q[3] ?? 0 }))
      .sort((a, b) => b.z - a.z);
    const spine: Spine = (wz) => {
      if (wz >= nodes[0].z) return { dx: nodes[0].dx, dy: nodes[0].dy };
      const last = nodes[nodes.length - 1];
      if (wz <= last.z) return { dx: last.dx, dy: last.dy };
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i];
        const b = nodes[i + 1];
        if (wz <= a.z && wz >= b.z) {
          const t = a.z === b.z ? 0 : (a.z - wz) / (a.z - b.z);
          return {
            dx: a.dx + (b.dx - a.dx) * t,
            dy: a.dy + (b.dy - a.dy) * t,
          };
        }
      }
      return { dx: 0, dy: 0 };
    };
    const z0 = nodes[0].z;
    const z1 = nodes[nodes.length - 1].z;
    if (Math.abs(z0 - z1) < 1) return; // degenerate: nothing to sweep
    this.jungle(
      c.nm ?? "terrain",
      z0,
      z1,
      c.p[1],
      Math.max(1, c.w ?? 12),
      new THREE.MeshLambertMaterial({
        color: c.color ? new THREE.Color(c.color) : 0x4f9a42,
      }),
      {
        amp: c.amp ?? 0.45,
        tex: c.tex ?? "jungle",
        spine,
        berms: c.berms === true,
      },
      c.p[0],
    );
  }

  // Firm raised edges: visible ridge + solid collider + a grindable lip rail.
  // Along a SPINE the ridge is cut into short chunks that follow the bend —
  // one long box cannot curve, and a straight kerb beside a winding path
  // reads instantly as a mistake.
  private berms(
    z0: number,
    z1: number,
    baseY: number,
    width: number,
    cx = 0,
    spine?: Spine,
  ): void {
    const depth = Math.abs(z1 - z0);
    const mat = this.baseMat("berm", this.bermTint, "jungle", 1, 8);
    if (spine) {
      const zNear = Math.max(z0, z1);
      const CHUNK = 4; // short enough that the kerb reads as a curve
      const n = Math.max(2, Math.round(depth / CHUNK));
      const segD = depth / n + 0.25;
      for (const side of [-1, 1]) {
        const pts: THREE.Vector3[] = [];
        // one chunk per box, but ONE draw call for the whole kerb: a winding
        // corridor needs dozens of chunks a side, and dozens of one-box meshes
        // is the single most expensive thing in a level like this
        const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
        for (let i = 0; i < n; i++) {
          const za = zNear - (depth * i) / n;
          const zb = zNear - (depth * (i + 1)) / n;
          const zm = (za + zb) / 2;
          const sp = spine(zm);
          const x = cx + sp.dx + side * (width / 2 - 0.45);
          const y = baseY + sp.dy + 0.55;
          parts.push({
            geo: new THREE.BoxGeometry(0.9, 1.5, segD),
            m: new THREE.Matrix4().makeTranslation(x, y, zm),
          });
          this.walls.push(
            new THREE.Box3().setFromCenterAndSize(
              new THREE.Vector3(x, y, zm),
              new THREE.Vector3(0.9, 1.5, segD),
            ),
          );
          if (i === 0) {
            const s0 = spine(zNear);
            pts.push(
              new THREE.Vector3(
                cx + s0.dx + side * (width / 2 - 0.45),
                baseY + s0.dy + 1.35,
                zNear,
              ),
            );
          }
          const s1 = spine(zb);
          pts.push(
            new THREE.Vector3(
              cx + s1.dx + side * (width / 2 - 0.45),
              baseY + s1.dy + 1.35,
              zb,
            ),
          );
        }
        const kerb = new THREE.Mesh(Level.mergeGeos(parts), mat);
        for (const p of parts) p.geo.dispose();
        kerb.name = "berm";
        this.root.add(kerb);
        const lip = new Rail(pts, false); // the grindable lip, bent to match
        this.rails.push(lip);
        this.terrainRails.add(lip); // the strip regrows it; capture must not
      }
      return;
    }
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
        [
          new THREE.Vector3(x, baseY + 1.35, z0),
          new THREE.Vector3(x, baseY + 1.35, z1),
        ],
        false,
      );
      this.rails.push(lip);
      this.terrainRails.add(lip); // ...same for a straight strip's lip
    }
  }

  // ---------------------------------------------------------- motion kit --

  moverDelta(id: number): THREE.Vector3 {
    return this.movers[id]?.lastDelta ?? new THREE.Vector3();
  }

  touchCrumble(id: number): void {
    const c = this.crumbles[id];
    if (c && c.state === "idle") {
      c.state = "shake";
      c.t = 0;
    }
  }

  // The player grinds a rope this frame — flag its rope so the update loop sags
  // it and counts down to the snap. No-op for ordinary rails.
  grindRope(rail: Rail): void {
    for (const r of this.ropes) {
      if (r.rail === rail && (r.state === "idle" || r.state === "sag")) {
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
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 1, 6),
        ropeMat,
      );
      group.add(seg);
      segs.push(seg);
    }
    const postMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    for (const [px, pz] of [
      [x0, z0],
      [x1, z1],
    ]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.3, 1.8, 7),
        postMat,
      );
      post.position.set(px, y - 0.5, pz);
      group.add(post);
    }
    this.root.add(group);
    const rope: SkyRope = {
      rail,
      segs,
      rest,
      state: "idle",
      t: 0,
      active: false,
      breakTime,
      regen,
      sagAmt,
    };
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
    axis: "x" | "y" | "z",
    amp: number,
    speed: number,
    phase = 0,
    // FIRE-LIT variant (the dark level): warm iron deck + a brazier riding a
    // corner, so the platform is its own light — a pale hover-plate against a
    // navy sky is invisible exactly when you need to land on it.
    fire = false,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.8, d),
      this.patterned(
        fire
          ? new THREE.MeshLambertMaterial({ color: 0x5a4632, emissive: 0x5a2c0c })
          : new THREE.MeshLambertMaterial({ color: 0x8a96c8, emissive: 0x141c38 }),
        w,
        d,
        "metal", // riveted hover-plate
      ),
    );
    mesh.position.set(x, topY - 0.4, z);
    mesh.name = "moving platform";
    mesh.userData.moverId = this.movers.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const axisV =
      axis === "x"
        ? new THREE.Vector3(1, 0, 0)
        : axis === "y"
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    this.movers.push({
      mesh,
      base: mesh.position.clone(),
      axisV,
      amp,
      speed,
      phase,
      lastDelta: new THREE.Vector3(),
      torch: fire
        ? this.torch(x + w / 2 - 0.55, topY, z + d / 2 - 0.55, 0.32, 0.7)
        : undefined,
    });
  }

  // ------------------------------------------------------- fire and phase --

  // A TORCH. Post, iron bowl, and three licking flames. The flames are
  // MeshBasic — unlit — so a fire stays the brightest thing on screen however
  // black the level's lighting is; the warm pool it casts on the deck around
  // it comes from the shared point-light pool. `h` is post height, `scale`
  // sizes the fire. Returns it so a phase pad can douse its own.
  private torch(
    x: number,
    baseY: number,
    z: number,
    h = 2.2,
    scale = 1,
    cool = false, // burns cold blue instead of orange (the metronome's other team)
  ): Torch {
    const group = new THREE.Group();
    group.position.set(x, baseY, z);
    if (h > 0.05) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.13, h, 6),
        new THREE.MeshLambertMaterial({ color: 0x2e2a26, emissive: 0x140d08 }),
      );
      post.position.y = h / 2;
      group.add(post);
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3 * scale, 0.16 * scale, 0.26 * scale, 7),
        new THREE.MeshLambertMaterial({ color: 0x4a4038, emissive: 0x2a1206 }),
      );
      bowl.position.y = h + 0.1 * scale;
      group.add(bowl);
    }
    // Three nested cones, hot core outward to a smoky tip. Basic material: a
    // fire is not lit BY the scene, it IS the light in it.
    const coneCols = cool
      ? [0xe4f4ff, 0x5cc8ff, 0x1a63d8] // cold-burning: the metronome's blue team
      : [0xfff0b0, 0xffa32c, 0xd8410e];
    const flames: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const r = (0.3 - i * 0.07) * scale;
      const fh = (0.55 + i * 0.42) * scale;
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(r, fh, 6),
        new THREE.MeshBasicMaterial({
          color: coneCols[i],
          transparent: true,
          opacity: i === 0 ? 1 : 0.55 - i * 0.12,
          depthWrite: i === 0,
          // fires DO fog: a flame two sections over dims into the black
          // instead of drawing a torch-line to the horizon. Near fires (the
          // ones you play by) sit inside fogNear and stay bright.
        }),
      );
      f.position.y = h + 0.2 * scale + fh * 0.42;
      f.renderOrder = 4 + i;
      group.add(f);
      flames.push(f);
    }
    group.userData.torchSpec = { h, scale }; // capture: position is read live off the group
    this.root.add(group);
    const t: Torch = {
      group,
      flames,
      lightAt: new THREE.Vector3(x, baseY + h + 0.55 * scale, z),
      seed: this.torches.length * 1.7,
      burn: 1,
      wantBurn: 1,
      // Stagger the first puff across the pool so a room full of torches does
      // not cough in unison the moment the level loads.
      smokeT: (this.torches.length % 7) * 0.31,
    };
    this.torches.push(t);
    return t;
  }

  // The light pool. Built once, at a fixed size, AFTER the builder has placed
  // every torch — adding a light later would recompile every material in the
  // scene. Aimed each frame at whichever fires are nearest the skater.
  private buildTorchLights(): void {
    if (this.torches.length === 0) return;
    const n = Math.min(6, this.torches.length);
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffa542, 0, 21, 1.6);
      this.root.add(l);
      this.torchLights.push(l);
    }
  }

  // A PHASE PAD: solid and burning for `duty` of its cycle, a dark ghost you
  // drop through for the rest. Collision is membership in groundMeshes —
  // three.js raycasts ignore `visible`, so a hidden pad would still be a floor.
  private phasePad(
    x: number,
    topY: number,
    z: number,
    w: number,
    d: number,
    cycle = 4,
    phase = 0,
    duty = 0.5,
  ): void {
    // TWO FAMILIES, one metronome. A pad's phase picks its team: near 0 =
    // AMBER, near a half-turn = COLD BLUE — so "amber lit, blue dark, then
    // they trade" is something a human reads in one look. Derived from phase
    // (not authored separately) so it survives capture/rebuild for free.
    const k = ((phase % 1) + 1) % 1;
    const coolFam = k >= 0.25 && k < 0.75;
    // ONE lit look for every pad, both teams: solid warm stone means STAND
    // HERE, full stop. Giving the teams different SLAB colours made a trade
    // read as "the platform turned a different colour" rather than "that one
    // went away" — the flip stopped looking like a disappearance at all
    // (playtest). The team you belong to lives in the FIRE instead: this
    // metronome's other half burns cold blue, so you can still see the two
    // sets at a glance without either of them looking less solid.
    const litMat = this.patterned(
      new THREE.MeshLambertMaterial({ color: 0x9a7f5c, emissive: 0x3a2008 }),
      w,
      d,
      "wood",
    );
    const ghostMat = new THREE.MeshBasicMaterial({
      color: 0x4a6a8c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      wireframe: true,
      // fogs like everything else: the ghost only needs to read up close,
      // where you're judging the next stand — not from across the works
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), litMat);
    mesh.position.set(x, topY - 0.3, z);
    mesh.name = "phase pad";
    this.root.add(mesh);
    this.groundMeshes.push(mesh); // starts solid; update() flips membership
    const pad: PhasePad = {
      mesh,
      torches: [
        // corner braziers, low so they light the deck rather than the eyes —
        // and these carry the team colour now, warm or cold
        this.torch(x - w / 2 + 0.45, topY, z - d / 2 + 0.45, 0.5, 0.72, coolFam),
        this.torch(x + w / 2 - 0.45, topY, z + d / 2 - 0.45, 0.5, 0.72, coolFam),
      ],
      cycle: Math.max(0.5, cycle),
      phase,
      duty: THREE.MathUtils.clamp(duty, 0.1, 0.9),
      on: true,
      litMat,
      ghostMat,
    };
    this.phasePads.push(pad);
  }

  // A grind line that TRAVELS. Only a rigid translation is safe (the rail
  // bakes its segment directions and arc length at construction), so every
  // node and the whole visual move by the same delta.
  private movingRail(
    x: number,
    y: number,
    z: number,
    len: number,
    yawDeg: number,
    axis: "x" | "y" | "z",
    amp: number,
    speed: number,
    phase = 0,
  ): void {
    const a = THREE.MathUtils.degToRad(yawDeg);
    const dx = (Math.sin(a) * len) / 2;
    const dz = (Math.cos(a) * len) / 2;
    const rail = new Rail([
      new THREE.Vector3(x - dx, y, z - dz),
      new THREE.Vector3(x + dx, y, z + dz),
    ]);
    this.rails.push(rail);
    this.root.add(rail.object);
    this.movingRails.push({
      rail,
      object: rail.object,
      base: new THREE.Vector3(0, 0, 0), // offsets are tracked from zero
      axisV:
        axis === "x"
          ? new THREE.Vector3(1, 0, 0)
          : axis === "y"
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(0, 0, 1),
      amp,
      speed,
      phase,
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
    tex = "wood",
    fallSpeed = 30,
  ): Crumble {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.5, d),
      this.patterned(new THREE.MeshLambertMaterial({ color }), w, d, tex),
    );
    mesh.position.set(x, topY - 0.25, z);
    mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg); // stand-detection is the ground raycast: free spin is fine
    mesh.name = "crumble pad";
    mesh.userData.crumbleId = this.crumbles.length;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    const c: Crumble = {
      mesh,
      base: mesh.position.clone(),
      state: "idle",
      t: 0,
      regen,
      shakeTime,
      fallSpeed,
      yaw: mesh.rotation.y,
    };
    this.crumbles.push(c);
    return c;
  }

  // Timed crusher block over the path.
  private crusher(
    x: number,
    deckY: number,
    z: number,
    w: number,
    d: number,
    cycle = 3.2,
    phase = 0,
    h = 3,
    raise = 4.4,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.patterned(
        new THREE.MeshLambertMaterial({ color: 0x8f8f98 }),
        w,
        h,
        "stone",
      ),
    );
    const restY = deckY + h / 2 - 0.1;
    mesh.position.set(x, restY + raise, z);
    mesh.name = "crusher";
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
  private pendulum(
    x: number,
    pivotY: number,
    z: number,
    len: number,
    amp = 1.0,
    speed = 1.6,
    phase = 0,
    yawDeg = 0,
  ): void {
    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6a7078 });
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, z);
    pivot.rotation.order = "YZX"; // yaw FIRST, then the animated z-swing lives in the spun frame
    pivot.rotation.y = yaw;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, len, 0.22), mat);
    arm.position.y = -len / 2;
    pivot.add(arm);
    const bob = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x565c66, emissive: 0x16181c }),
    );
    bob.position.y = -len;
    pivot.add(bob);
    this.root.add(pivot);
    // gallows: two posts + a crossbeam so the thing reads at speed — the
    // whole frame spins with the swing plane
    const postMat = this.baseMat("gallows", 0x8a6a48, "wood", 1, 2);
    const postH = len + 2.5;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, postH, 0.6),
        postMat,
      );
      const dx = side * (len + 1.2);
      post.position.set(x + dx * cos, pivotY - postH / 2 + 0.8, z - dx * sin);
      post.rotation.y = yaw;
      this.root.add(post);
    }
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry((len + 1.2) * 2 + 0.6, 0.5, 0.7),
      postMat,
    );
    beam.position.set(x, pivotY + 0.3, z);
    beam.rotation.y = yaw;
    this.root.add(beam);
    this.pendulums.push({
      pivot,
      len,
      amp,
      speed,
      phase,
      yaw,
      box: new THREE.Box3(),
      lastSign: 1,
    });
  }

  // ROUNDED-RECTANGLE BOWL: a quarter-pipe profile swept around a rounded-rect
  // path — four straight vert walls joined by curved corners, THPS pool
  // style. Built as MESH geometry: the transition is ridden by the ordinary
  // surface-tangent physics and airs off the lip use the tracked vert hang,
  // which is exactly what lets hang time follow the corners. An entry CHANNEL
  // (a smooth dip of the wall to floor level) on the +Z side lets riders roll
  // in; a coping rail runs the rest of the rim.
  // A grindable lip, unless that exact lip is already there. Two pipes butted
  // together SHARE a ridge — that's the classic park shape, and each of them
  // wants a coping rail on it. Two rails on one line make the grind attach
  // flicker between them, so the second one is dropped.
  private copingRail(pts: THREE.Vector3[]): void {
    const same = (a: THREE.Vector3[], b: THREE.Vector3[]): boolean => {
      if (a.length !== b.length) return false;
      const fwd = a.every((p, i) => p.distanceToSquared(b[i]) < 0.04);
      const rev = a.every(
        (p, i) => p.distanceToSquared(b[b.length - 1 - i]) < 0.04,
      );
      return fwd || rev;
    };
    for (const r of this.rails) if (same(r.points, pts)) return;
    const rail = new Rail(pts);
    this.rails.push(rail);
    this.root.add(rail.object);
  }

  // THE VERT PART. Every transition in the game comes through here: straight
  // quarter and half pipes, bowl corners, whole pools, and the slide troughs.
  //
  // One special case, and it earns its keep. A straight, axis-aligned, 90°
  // half pipe with no deck is backed by the analytic Halfpipe instead of a
  // swept mesh, because that class owns the mature ride physics — the arc-length
  // pendulum, coping launches, lip stalls and spine transfers all key off a
  // Halfpipe instance. Everything the swept mesh can't be axis-aligned about
  // (corners, spines, banks, sub-vertical walls) rides the tracked-wall
  // physics, exactly as the hand-built pool always did. Same component, same
  // fields, same editor handles either way. Returns the dense spine (null on
  // the analytic path) so a hand-built level can hang rails and crates on the
  // exact surface it just swept.
  buildVertRamp(c: CustomComponent): VertRampNode[] | null {
    const R = Math.max(0.5, c.rise ?? 6);
    const F = Math.max(0, c.w ?? 3);
    const vkind = c.vkind ?? "quarter";
    const arc = THREE.MathUtils.clamp(c.arc ?? 90, 5, 90);
    const deck = Math.max(0, c.deck ?? 0);
    const closed = c.closed === true;
    const yawQ = (((c.yaw ?? 0) % 360) + 360) % 360;
    const straight = !c.pts || c.pts.length < 2;
    const col = c.color ? new THREE.Color(c.color).getHex() : 0xaab4ba;
    const mat = this.patterned(
      new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }),
      6,
      6,
      c.tex ?? "pavement",
    );

    if (
      straight &&
      vkind === "half" &&
      arc === 90 &&
      deck === 0 &&
      yawQ % 90 === 0
    ) {
      // ---- analytic backing: full lip-trick / pendulum / transfer physics ----
      const len = c.len ?? 30;
      const axis: "z" | "x" = yawQ === 90 || yawQ === 270 ? "x" : "z";
      const along = axis === "z" ? c.p[2] : c.p[0];
      const cross = axis === "z" ? c.p[0] : c.p[2];
      const hp = new Halfpipe(
        along + len / 2,
        along - len / 2,
        c.p[1],
        F,
        R,
        mat,
        cross,
        axis,
      );
      this.halfpipes.push(hp);
      this.root.add(hp.object);
      for (const wm of hp.walls) {
        wm.userData.vert = c.vert !== false; // the flag rides the analytic path too
        this.groundMeshes.push(wm);
      }
      for (const side of [-1, 1]) {
        const lipC = cross + side * hp.lipX;
        const y = hp.lipY + 0.05;
        const a =
          axis === "z"
            ? new THREE.Vector3(lipC, y, along + len / 2)
            : new THREE.Vector3(along + len / 2, y, lipC);
        const b =
          axis === "z"
            ? new THREE.Vector3(lipC, y, along - len / 2)
            : new THREE.Vector3(along - len / 2, y, lipC);
        this.copingRail([a, b]);
      }
      return null;
    }

    // ---- swept mesh: any path, any bank, any arc ----
    const spine = vertRampSpine(c);
    if (spine.length < 2) return null;
    const vr = buildVertRampGeometry(spine, {
      radius: R,
      flatHalf: F,
      kind: vkind,
      arcDeg: arc,
      deck,
      closed,
    });
    const mesh = new THREE.Mesh(vr.geometry, mat);
    mesh.name = c.vert === false ? "slide deck" : "vertramp";
    mesh.userData.vertRampMesh = true; // capture: its vertramp component rebuilds it
    // THE POINT OF ALL THIS: the level DECLARES what this is, so the physics
    // stops guessing from normal.y. And it declares it BOTH ways — `false` is
    // not "unflagged", it is "this is a ROAD", which is what keeps a slide's
    // banked gutters from being tracked as vert walls and gluing riders to
    // them. The player reads all three states (see Player.onTransition).
    mesh.userData.vert = c.vert !== false;
    // the component that drew this, so CAPTURE can hand it straight back
    mesh.userData.vertComp = JSON.parse(JSON.stringify(c)) as CustomComponent;
    mesh.userData.vertCopings = vr.copings.map((cop) =>
      cop.map((q) => new THREE.Vector3(q.x, q.y + 0.05, q.z)),
    );
    this.root.add(mesh); // = pickRoot, so the editor can select and box it
    this.groundMeshes.push(mesh);
    // Copings are grindable — but only on a real transition. A banked road's
    // gutter lip is a kerb, not a coping; auto-railing every slide edge would
    // hijack the whole course.
    if (c.vert !== false) {
      for (const cop of vr.copings) {
        if (cop.length < 2) continue;
        this.copingRail(
          cop.map((q) => new THREE.Vector3(q.x, q.y + 0.05, q.z)),
        );
      }
    }
    return spine;
  }

  // Swinging grab-rope: a driven pendulum the player can hang from. speed 0 =
  // natural pendulum frequency for the length (long ropes swing slow).
  private ropeSwing(
    x: number,
    anchorY: number,
    z: number,
    len = 6,
    amp = 0.85,
    speed = 0,
    phase = 0,
    yawDeg = 0,
    // optional TRAVEL: the anchor itself slides on this cycle, so the swing
    // ferries you across as well as swinging you
    travelAxis: "x" | "y" | "z" | null = null,
    travelAmp = 0,
    travelSpeed = 0.5,
    travelPhase = 0,
  ): void {
    const yaw = THREE.MathUtils.degToRad(yawDeg);
    const pivot = new THREE.Group();
    pivot.position.set(x, anchorY, z);
    pivot.rotation.order = "YZX"; // yaw FIRST, the animated z-swing lives in the spun frame
    pivot.rotation.y = yaw;
    const ropeMat = new THREE.MeshLambertMaterial({ color: 0xa8845a });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, len, 5),
      ropeMat,
    );
    rope.position.y = -len / 2;
    pivot.add(rope);
    // knot bands down the line sell "rope" at PS1 fidelity — and mark the grips
    for (let d = 1.2; d < len - 0.3; d += 1.2) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.14, 6),
        bandMat,
      );
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
      travel:
        travelAxis && travelAmp !== 0
          ? {
              base: new THREE.Vector3(x, anchorY, z),
              axisV:
                travelAxis === "x"
                  ? new THREE.Vector3(1, 0, 0)
                  : travelAxis === "y"
                    ? new THREE.Vector3(0, 1, 0)
                    : new THREE.Vector3(0, 0, 1),
              amp: travelAmp,
              speed: travelSpeed,
              phase: travelPhase,
            }
          : undefined,
    });
  }

  // World position `d` meters down a swing rope (d may exceed len — the body
  // dangles on the same line below the hands).
  ropePointAt(rs: RopeSwing, d: number, out: THREE.Vector3): THREE.Vector3 {
    const swing = Math.sin(rs.theta) * d;
    const cos = Math.cos(rs.yaw);
    const sin = Math.sin(rs.yaw);
    out.set(
      rs.anchor.x + swing * cos,
      rs.anchor.y - Math.cos(rs.theta) * d,
      rs.anchor.z - swing * sin,
    );
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

  // ---- THE SEA -----------------------------------------------------------
  //
  // Open water, drawn by arithmetic instead of by a bitmap.
  //
  // It used to be a 128px canvas tiled 171 times across a 2400-unit plane. One
  // texel covered about 11cm of sea, so anywhere near the surface the whole
  // thing turned to soft mush — the magnified-bitmap look, which is NOT the
  // look this is after. The machines being imitated never had that problem:
  // their water was maths evaluated at the corners and smeared smooth across
  // the polygon by the rasteriser, so it stayed clean however close you got.
  //
  // Same idea, one step finer — three crossing swells summed per PIXEL. No
  // texture, no tiling, no resolution: exact at any distance, from eleven
  // sines on two triangles. It uploads nothing and it never needs a mipmap.
  //
  // The trick worth knowing is fwidth(). The bright crests are the contour
  // where the swell field crosses a level, and the contour's width is taken
  // from that field's own screen-space gradient — hair-thin up close, and as
  // the sea tilts away toward the horizon and one pixel starts spanning whole
  // waves, the line widens to exactly the average it ought to be. So it
  // neither blocks up near nor boils into moiré far. That is the part a
  // stretched bitmap cannot do at any price.
  private seaSurface(y: number, cx: number, cz: number, size: number): void {
    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color("#07376e") }, // trough: open-ocean navy
        uMid: { value: new THREE.Color("#1276b8") },
        uBright: { value: new THREE.Color("#54d2e2") }, // sunlit face of a swell
        uFoam: { value: new THREE.Color("#e8fdff") }, // crest glint
      },
    ]);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      fog: true, // the horizon haze is the level's own fog, same as everything else
      vertexShader: /* glsl */ `
        varying vec2 vSea;
        #include <fog_pars_vertex>
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vSea = wp.xz;                       // world metres: the pattern is pinned to the world, not to UVs
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uDeep, uMid, uBright, uFoam;
        varying vec2 vSea;
        #include <fog_pars_fragment>

        // Three swells crossing at angles, wavelengths and speeds that never
        // line back up, so the sea has no period you can catch.
        float swell(vec2 p, float t) {
          float h = sin(dot(p, vec2( 0.42,  0.91)) * 0.075 + t * 0.55);
          h += sin(dot(p, vec2(-0.83,  0.56)) * 0.113 - t * 0.41) * 0.80;
          h += sin(dot(p, vec2( 0.97, -0.24)) * 0.181 + t * 0.83) * 0.55;
          return h * 0.4255;                  // back into roughly -1..1
        }

        void main() {
          float t = uTime;
          // Drag the field through a slow copy of itself. Plain crossed sines
          // read as corrugated iron; warped ones read as water.
          vec2 warp = vec2(swell(vSea * 0.6 + 11.0, t * 0.50),
                           swell(vSea * 0.6 - 23.0, t * 0.43)) * 6.0;
          vec2 q = vSea + warp;

          // THE RADIAL HALF — the part that makes it read as plasma rather
          // than as swell. Plane waves alone give parallel ribbons; adding
          // sin(distance-to-a-point) bends the level sets closed, and closed
          // level sets are the lava-lamp pools.
          //
          // The centres crawl round slow Lissajous loops, so no ring ever sits
          // still long enough to read as a stone dropped in the water. Far
          // from a centre the term flattens into just another plane wave, so
          // it degrades gracefully across a 2400-unit plane instead of leaving
          // a bullseye at the origin and nothing anywhere else.
          vec2 c1 = vec2(sin(t * 0.11), cos(t * 0.13)) * 130.0;
          vec2 c2 = vec2(cos(t * 0.07), sin(t * 0.10)) * 210.0 + vec2(160.0, -95.0);
          float f = swell(q, t);
          f += sin(length(q - c1) * 0.125 - t * 0.55) * 0.85;
          f += sin(length(q - c2) * 0.098 + t * 0.42) * 0.70;
          f *= 0.42;                          // back to roughly -1..1

          // Body of the water: deep in the troughs, lifting through mid to a
          // sunlit turquoise where the interference piles up.
          float lit = f * 0.5 + 0.5;
          vec3 col = mix(uDeep, uMid, smoothstep(0.04, 0.60, lit));
          col = mix(col, uBright, smoothstep(0.46, 0.98, lit) * 0.85);

          // THE POOLS. These are level sets of the 2D field, so they close
          // into blobs — which is exactly the look wanted. The whole trick is
          // WIDTH: at hairline width a closed contour reads as an oil slick,
          // at pool width it reads as light gathering on the surface. So the
          // floor is large and does the shaping, and fwidth only adds what the
          // pixel needs on top to stay clean.
          float wPool = fwidth(f) * 1.5 + 0.30;
          float pool = 1.0 - smoothstep(0.0, wPool, abs(f - 0.36));
          // A second, tighter ring just inside it — plasma's banding, and what
          // gives each pool a lit rim instead of a flat fill.
          float wRim = fwidth(f) * 1.5 + 0.10;
          float rim = 1.0 - smoothstep(0.0, wRim, abs(f - 0.66));

          // DETAIL FALLOFF. fwidth of the field is how much of the pattern a
          // pixel can actually resolve. Past a point the bands stop being
          // features and start being clutter, so fade them out — detail
          // arrives as you come down to the water and dissolves into flat tone
          // beyond, which is what the eye expects of a sea.
          float det = 1.0 - smoothstep(0.25, 0.95, fwidth(f));

          col = mix(col, uBright, pool * 0.45 * det);
          col = mix(col, uFoam, rim * 0.22 * det);

          gl_FragColor = vec4(col, 1.0);
          #include <fog_fragment>
        }`,
    });
    // Two triangles. Every bit of the detail is in the pixel maths, so there
    // is nothing to gain from subdividing it.
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, y, cz);
    mesh.userData.noShadow = true; // an effect, not a surface — and it is 2400 units wide
    this.root.add(mesh);
    this.seaMats.push(mat);
  }

  // Animated pit floor: scrolling lava or drifting void haze (water goes to
  // seaSurface, which needs no texture at all).
  private pitPlane(
    kind: "water" | "lava" | "void",
    y: number,
    cx: number,
    cz: number,
    size = 1400,
  ): void {
    if (kind === "water") {
      this.seaSurface(y, cx, cz, size);
      return;
    }
    const canvas = document.createElement("canvas");
    const S = 64;
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    let su = 0.004;
    let sv = 0.002;
    if (kind === "lava") {
      ctx.fillStyle = "#1c0a08";
      ctx.fillRect(0, 0, 64, 64);
      // sparse thin veins at partial alpha: the chase cam fills the frame
      // with this plane, so crust must dominate and embers stay accents
      ctx.strokeStyle = "rgba(255,106,34,0.6)";
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
      ctx.fillStyle = "rgba(90,38,24,0.7)"; // cooled crust plates
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * 64,
          Math.random() * 64,
          6 + Math.random() * 9,
          4 + Math.random() * 6,
          Math.random() * 3,
          0,
          7,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#ffb050";
      for (let i = 0; i < 6; i++)
        ctx.fillRect(Math.random() * 62, Math.random() * 62, 2, 2);
      su = 0.0035;
      sv = 0.0018;
    } else {
      ctx.fillStyle = "#0c0a12";
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "rgba(60,50,80,0.5)";
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.ellipse(
          Math.random() * 64,
          Math.random() * 64,
          8 + Math.random() * 10,
          5 + Math.random() * 6,
          0,
          0,
          7,
        );
        ctx.fill();
      }
      su = 0.0016;
      sv = 0.001;
    }
    const tex = Level.finishTex(new THREE.CanvasTexture(canvas));
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
    if (window.location.search.includes("lite")) return; // headless smoke mode
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
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
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
    this.noteDecor("log", (x0 + x1) / 2, y, z, { len: Math.abs(x1 - x0) });
    const len = Math.abs(x1 - x0);
    const geo = new THREE.CylinderGeometry(0.55, 0.55, len, 8);
    geo.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      this.baseMat("log", 0x96683c, "wood", 2, 1),
    );
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
  // A part may carry a TINT, which is baked in as a vertex colour rather than
  // set on a material. That is what makes the library props' colour variety
  // free: six shades of the same plant still merge into one mesh, where six
  // materials would have been six draw calls. Parts without a tint get white,
  // so a batch can mix tinted and untinted geometry.
  private static mergeGeos(
    parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4; tint?: THREE.Color }[],
  ): THREE.BufferGeometry {
    const pos: number[] = [];
    const norm: number[] = [];
    const uv: number[] = [];
    const col: number[] = [];
    const tinted = parts.some((p) => p.tint);
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const part of parts) {
      const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
      nm.getNormalMatrix(part.m);
      const p = g.attributes.position as THREE.BufferAttribute;
      const n = g.attributes.normal as THREE.BufferAttribute;
      const u = g.attributes.uv as THREE.BufferAttribute;
      const t = part.tint;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(part.m);
        pos.push(v.x, v.y, v.z);
        v.fromBufferAttribute(n, i).applyNormalMatrix(nm).normalize();
        norm.push(v.x, v.y, v.z);
        uv.push(u.getX(i), u.getY(i));
        if (tinted) col.push(t ? t.r : 1, t ? t.g : 1, t ? t.b : 1);
      }
      if (g !== part.geo) g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
    out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (tinted)
      out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return out;
  }

  // One leaf blade: a narrow plane arched up then drooped, tapered to the
  // tip, running +X from the origin. Smooth vertex normals do the shading.
  private static bladeGeo(
    len: number,
    wid: number,
    droop: number,
  ): THREE.BufferGeometry {
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
  private static fanGeo(
    blade: THREE.BufferGeometry,
    count: number,
    tilt: number,
  ): THREE.BufferGeometry {
    const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      e.set(0, (i / count) * Math.PI * 2 + i * 0.7, tilt + (i % 2) * 0.16);
      q.setFromEuler(e);
      parts.push({
        geo: blade,
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(0, (i % 3) * 0.05, 0),
          q,
          one,
        ),
      });
    }
    const out = Level.mergeGeos(parts);
    blade.dispose();
    return out;
  }

  // Soft-painted decor canvases (128px, LinearFilter). Per level, like
  // surfTexCache, so dispose() frees them with everything else level-owned.
  private decorTexCache = new Map<string, THREE.CanvasTexture>();
  private decorTexture(kind: "leaf" | "moss"): THREE.CanvasTexture {
    const cached = this.decorTexCache.get(kind);
    if (cached) return cached;
    const S = 128;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    const blob = (x: number, y: number, r: number, color: string): void => {
      const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    if (kind === "leaf") {
      // two-tone frond: lit rib band shading darker toward both edges
      const gr = ctx.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, "#c6dda2");
      gr.addColorStop(0.5, "#f0f7d6");
      gr.addColorStop(1, "#b9d494");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = "rgba(120,150,80,0.35)"; // veins sweeping tipward
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const y0 = 8 + i * 14;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.quadraticCurveTo(S * 0.55, y0 + (i % 2 === 0 ? 9 : -9), S, y0);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          12 + Math.random() * 14,
          "rgba(255,255,238,0.22)",
        );
    } else {
      // moss: grey-green stone under soft growth pads (near-white, tintable)
      ctx.fillStyle = "#e2e4d6";
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 14; i++) {
        const v = 200 + Math.floor(Math.random() * 30);
        blob(
          Math.random() * S,
          Math.random() * S,
          12 + Math.random() * 16,
          `rgba(${v - 26},${v},${v - 40},0.45)`,
        );
      }
      for (let i = 0; i < 8; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          8 + Math.random() * 10,
          "rgba(128,132,118,0.3)",
        );
      for (let i = 0; i < 6; i++)
        blob(
          Math.random() * S,
          Math.random() * S,
          5 + Math.random() * 7,
          "rgba(255,255,240,0.3)",
        );
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.decorTexCache.set(kind, tex);
    return tex;
  }

  // Shared decor materials — one per role per level, tinted at first call.
  private decorMats = new Map<string, THREE.MeshLambertMaterial>();
  private decorMat(
    key: string,
    color: number,
    tex: "leaf" | "moss" | "" = "",
    double = false,
  ): THREE.MeshLambertMaterial {
    let m = this.decorMats.get(key);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color });
    if (tex !== "") m.map = this.decorTexture(tex);
    if (double) m.side = THREE.DoubleSide;
    this.decorMats.set(key, m);
    return m;
  }

  // ---- DECOR AS DATA -------------------------------------------------------
  // Every scenery helper logs its own placement here, captureData ships the
  // log, and buildCustom feeds it back through the same helper. Logged at the
  // TOP of each helper, before the '?lite' early-outs, so a headless capture
  // still carries the foliage it is deliberately not drawing. Skipped when the
  // level was built FROM data — that capture returns its own components.
  private decorLog: CustomComponent[] = [];
  // Grind lips that a terrain strip grows itself. They are real rails to
  // play against, but capturing them would hand the rebuild a second set on
  // top of the ones the strip regrows.
  private terrainRails = new Set<Rail>();
  // Set while a COMPOSITE prop draws its members (a toadstool family, a
  // planter's fern): the members belong to the parent component and must not
  // log themselves, or a captured cluster comes back as four loose props.
  private decorQuiet = false;
  private noteDecor(
    dkind: DecorKind,
    x: number,
    y: number,
    z: number,
    extra: Partial<CustomComponent> = {},
  ): void {
    if (this.builtFromData || this.decorQuiet) return;
    const r = (n: number): number => Math.round(n * 100) / 100;
    const c: CustomComponent = {
      t: "decor",
      dkind,
      p: [r(x), r(y), r(z)],
      ...extra,
    };
    for (const k of ["w", "rise", "amp", "yaw", "len"] as const)
      if (c[k] !== undefined) c[k] = r(c[k] as number);
    if (c.s) c.s = [r(c.s[0]), r(c.s[1]), r(c.s[2])];
    this.decorLog.push(c);
  }

  // Plain scenery box: massing that must LOOK solid without being solid —
  // the earth banks either side of a corridor, a backdrop cliff, a ravine
  // floor. Never a groundMesh, never a collider, so it cannot change how a
  // level plays; it only changes what you can see. Batches with everything
  // else, so a hundred of them is still one draw call in play.
  private decorBlock(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color = 0x6b5232,
    tex = "dirt",
    yaw = 0,
  ): void {
    this.noteDecor("block", x, y, z, {
      s: [w, h, d],
      yaw: THREE.MathUtils.radToDeg(yaw),
      color: "#" + color.toString(16).padStart(6, "0"),
      tex,
    });
    if (this.liteDecor) return;
    this.putDecor(
      `block:${color.toString(16)}:${tex}`,
      new THREE.BoxGeometry(w, h, d),
      this.baseMat(`block:${color.toString(16)}:${tex}`, color, tex, 3, 3),
      Level.trs(x, y, z, yaw),
    );
  }

  // ---- THE PROP LIBRARY ----------------------------------------------------
  // Six families of external mesh (see props.ts) placed through the same decor
  // pipeline as everything else, so they capture, round-trip and batch exactly
  // like a hand-built fern does.
  //
  // One material per SURFACE, not per prop and not per colour: every tree in
  // the level shares the bark material and the leaf material, and the colour
  // that makes one tree olive and the next one emerald rides in as a vertex
  // attribute. Fifty-six models across six tint palettes still costs five
  // draw calls a section.
  private propMats = new Map<string, THREE.MeshLambertMaterial>();
  private propMat(role: PropRoleName): THREE.MeshLambertMaterial {
    let m = this.propMats.get(role);
    if (m) return m;
    m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    const kind =
      role === "leaf"
        ? "leaf"
        : role === "bark"
          ? "wood"
          : role === "sawn"
            ? "plank"
            : role === "stone"
              ? "stone"
              : "dirt";
    const tex =
      role === "leaf" ? this.decorTexture("leaf") : this.surfaceTexture(kind);
    // the box projection in props.ts already put the UVs in world scale, so
    // the shared texture is used at repeat 1 and never cloned
    m.map = tex;
    // fronds and blade planes are single-sided in the source meshes
    if (role === "leaf") m.side = THREE.DoubleSide;
    this.propMats.set(role, m);
    return m;
  }

  private static PROP_TINT = new THREE.Color();
  /**
   * Plant one library prop. Everything that makes it look unlike its
   * neighbours — model, colour, size, spin, lean — comes in through the
   * component, and anything left out is rolled from the seed.
   */
  private prop(family: PropFamily, c: CustomComponent): void {
    const [x, y, z] = c.p;
    const roll = propRoll(family, c.seed ?? Math.round(x * 71 + z * 131));
    const vr = c.vr ?? roll.variant;
    const tn = c.tn ?? roll.tint;
    const w = c.w ?? 1;
    const yaw = c.yaw ?? 0;
    const tilt = c.amp ?? 0;
    this.noteDecor(family, x, y, z, { vr, tn, w, yaw, amp: tilt, seed: c.seed });
    if (this.liteDecor) return;
    const surfaces = propSurfaces(family, vr);
    if (!surfaces.length) return;
    const tint = propTint(family, tn);
    const s = (PROP_SCALE[family] ?? 1) * w;
    // ZXY, so the yaw spins the model about its OWN axis and the lean is then
    // applied about world Z — a fixed direction across the course. Under the
    // old order the lean axis rode along with a random yaw, which is fine for
    // a wobble but useless for the thing that actually dresses a corridor:
    // a frond up on the bank hanging IN over the path. Positive leans toward
    // -x, so a prop on the right flank wants a positive lean to reach in.
    const e = new THREE.Euler(
      0,
      THREE.MathUtils.degToRad(yaw),
      THREE.MathUtils.degToRad(tilt),
      "ZXY",
    );
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(e),
      new THREE.Vector3(s, s, s),
    );
    for (const surf of surfaces) {
      const hex = tint?.roles[surf.role];
      this.putDecor(
        `prop:${surf.role}`,
        surf.geo,
        this.propMat(surf.role),
        m,
        hex === undefined
          ? undefined
          : Level.PROP_TINT.setHex(hex, THREE.SRGBColorSpace).clone(),
      );
    }
  }

  /**
   * Plant one library prop at (x, y, z) with everything else rolled from a
   * seed. Builders call this rather than prop() directly: it is the whole
   * point of the library that a scatter does not have to choose a model, a
   * colour, a size, a spin and a lean for every single plant.
   */
  private propAt(
    family: PropFamily,
    x: number,
    y: number,
    z: number,
    seed: number,
    scale = 1,
    pick?: number[], // choose only from these models, e.g. the columns
    lean = 0, // extra tilt, for foliage that hangs IN over the path
  ): void {
    const roll = propRoll(family, seed);
    const r = (n: number): number => Math.round(n * 100) / 100;
    this.prop(family, {
      t: "decor",
      dkind: family,
      p: [r(x), r(y), r(z)],
      vr: pick ? pick[roll.variant % pick.length] : roll.variant,
      tn: roll.tint,
      w: r(roll.w * scale),
      yaw: Math.round(roll.yaw),
      amp: Math.round((roll.tilt + lean) * 10) / 10,
    });
  }

  /** Build one decor component — the other half of noteDecor. */
  private decorProp(c: CustomComponent): void {
    const [x, y, z] = c.p;
    const s = c.w ?? 1;
    switch (c.dkind) {
      case "fern":
        return this.fern(x, y, z, s);
      case "broadleaf":
        return this.broadleaf(x, y, z, s);
      case "flowers":
        return this.flowers(x, y, z);
      case "toadstool":
        return this.toadstool(x, y, z, s);
      case "toadstools":
        return this.toadstools(x, y, z, s);
      case "mossrock":
        return this.rock(x, y, z, c.w ?? 1.6);
      case "jungletree":
        return this.jungleTree(x, y, z, c.rise ?? 9, c.amp ?? 0);
      case "palm":
        return this.palm(x, y, z, c.rise ?? 4.8, c.amp ?? 0.12);
      case "vines":
        return this.vines(x, y, z, c.rise ?? 4, Math.max(1, Math.round(c.n ?? 3)));
      case "planter":
        return this.planter(x, y, z);
      case "idol":
        return this.idol(x, y, z, s, THREE.MathUtils.degToRad(c.yaw ?? 0));
      case "ruinblock":
        return this.ruinBlock(
          x,
          y,
          z,
          c.s?.[0] ?? 2.4,
          c.s?.[1] ?? 1.6,
          c.s?.[2] ?? 2.4,
          THREE.MathUtils.degToRad(c.yaw ?? 0),
        );
      case "log": {
        const half = (c.len ?? 13) / 2;
        return this.log(x - half, x + half, y, z);
      }
      case "tree":
      case "plants":
      case "boulder":
      case "rocks":
      case "trunk":
      case "slab":
        return this.prop(c.dkind, c);
      case "block":
        return this.decorBlock(
          x,
          y,
          z,
          c.s?.[0] ?? 6,
          c.s?.[1] ?? 6,
          c.s?.[2] ?? 6,
          c.color ? new THREE.Color(c.color).getHex() : 0x6b5232,
          c.tex ?? "dirt",
          THREE.MathUtils.degToRad(c.yaw ?? 0),
        );
    }
  }

  // Tropical dressing is pure garnish: '?lite' (headless smoke) skips ALL of
  // it — software rendering can't afford the fill rate, and slow frames
  // desync the suite's wall-clock input scripting.
  private readonly liteDecor = window.location.search.includes("lite");

  // ---- DECOR BATCHING ------------------------------------------------------
  // A wall of jungle is hundreds of copies of a handful of shapes, and hundreds
  // of one-shape meshes is the most expensive thing a level can do — on a phone
  // the draw calls ARE the frame budget. So every scattered plant registers a
  // TRANSFORM here instead of a mesh, and each (shape, material) pair bakes
  // into one mesh when the section is done. The baked vertices land exactly
  // where the loose meshes would have, and nothing in the game ever looked up
  // a decor mesh, so this is invisible to everything but the profiler.
  //
  // OPT-IN, and per SECTION. One merged mesh spanning a whole level would have
  // a level-sized bounding sphere and never cull, so a course that plants
  // heavily flushes every stretch (see buildJungle's thicket), and a course
  // with a dozen palms leaves the flag off and keeps per-instance culling.
  private batchDecor = false;
  private decorParts = new Map<
    string,
    {
      mat: THREE.Material;
      parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4; tint?: THREE.Color }[];
    }
  >();
  private putDecor(
    key: string,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    m: THREE.Matrix4,
    tint?: THREE.Color,
  ): void {
    if (!this.batchDecor) {
      // Unbatched (the editor's pickable-mesh mode): the shared geometry has
      // no room for this copy's tint, so give this one its own colour attribute
      // over a clone. One prop, one mesh — the cost is already being paid.
      let g = geo;
      if (tint) {
        g = geo.clone();
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          col[i * 3] = tint.r;
          col[i * 3 + 1] = tint.g;
          col[i * 3 + 2] = tint.b;
        }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      }
      const mesh = new THREE.Mesh(g, mat);
      m.decompose(mesh.position, mesh.quaternion, mesh.scale);
      this.root.add(mesh);
      return;
    }
    let b = this.decorParts.get(key);
    if (!b) {
      b = { mat, parts: [] };
      this.decorParts.set(key, b);
    }
    b.parts.push({ geo, m, tint });
  }
  /** Bake everything scattered since the last call into one mesh per shape. */
  private bakeDecor(): void {
    for (const [key, b] of this.decorParts) {
      if (b.parts.length === 0) continue;
      const mesh = new THREE.Mesh(Level.mergeGeos(b.parts), b.mat);
      mesh.name = key;
      this.root.add(mesh);
    }
    this.decorParts.clear();
  }
  /** The transform a loose decor mesh would have had (three's XYZ euler). */
  private static trs(
    px: number,
    py: number,
    pz: number,
    ry = 0,
    s = 1,
    rz = 0,
    sy = s,
    sz = s,
  ): THREE.Matrix4 {
    return new THREE.Matrix4().compose(
      new THREE.Vector3(px, py, pz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)),
      new THREE.Vector3(s, sy, sz),
    );
  }

  // Jak-era palm: bowed trunk, merged frond crown, coconut cluster — three
  // meshes on shared geometry. h scales the whole tree; lean > 0 tips the
  // top toward -x (the trunk's baked bow runs +x, so leans read as S-curves).
  private static palmTrunkGeo: THREE.BufferGeometry | null = null;
  private static palmCrownGeo: THREE.BufferGeometry | null = null;
  private static coconutGeo: THREE.BufferGeometry | null = null;
  private palm(x: number, y: number, z: number, h = 4.8, lean = 0.12): void {
    this.noteDecor("palm", x, y, z, { rise: h, amp: lean });
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
    if (!Level.palmCrownGeo)
      Level.palmCrownGeo = Level.fanGeo(
        Level.bladeGeo(2.7, 0.62, 0.72),
        8,
        0.08,
      );
    if (!Level.coconutGeo) {
      const nut = new THREE.SphereGeometry(0.17, 7, 5);
      Level.coconutGeo = Level.mergeGeos([
        { geo: nut, m: new THREE.Matrix4().makeTranslation(0.17, 0, 0.03) },
        { geo: nut, m: new THREE.Matrix4().makeTranslation(-0.1, 0.05, 0.15) },
        {
          geo: nut,
          m: new THREE.Matrix4().makeTranslation(-0.06, -0.03, -0.15),
        },
      ]);
      nut.dispose();
    }
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        Level.palmTrunkGeo,
        this.baseMat("palmTrunk", 0xb08556, "wood", 1, 3),
      ),
    );
    const two = Math.abs(Math.round(x + z)) % 2 === 0;
    const crown = new THREE.Mesh(
      Level.palmCrownGeo,
      this.decorMat(
        two ? "frondA" : "frondB",
        two ? 0x3fa04a : 0x5cae3c,
        "leaf",
        true,
      ),
    );
    crown.position.set(0.85, 4.72, 0);
    crown.rotation.y = x * 1.7 + z * 0.4; // deterministic twist per tree
    g.add(crown);
    const nuts = new THREE.Mesh(
      Level.coconutGeo,
      this.decorMat("coconut", 0x7a5a34),
    );
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
    this.noteDecor("fern", x, y, z, { w: s });
    if (this.liteDecor) return;
    if (!Level.fernGeoCache)
      Level.fernGeoCache = Level.fanGeo(
        Level.bladeGeo(1.15, 0.3, 0.95),
        6,
        0.7,
      );
    this.putDecor(
      "fern",
      Level.fernGeoCache,
      this.decorMat("fern", 0x4a9a40, "leaf", true),
      Level.trs(x, y + 0.02, z, x * 2.1 + z * 0.6, s),
    );
  }

  // Broadleaf plant: five wide paddles. Key/color per role (jungle, succulent).
  private static leafGeoCache: THREE.BufferGeometry | null = null;
  private broadleaf(
    x: number,
    y: number,
    z: number,
    s = 1,
    key = "leafy",
    color = 0x3e8e46,
  ): void {
    this.noteDecor("broadleaf", x, y, z, { w: s });
    if (this.liteDecor) return;
    if (!Level.leafGeoCache)
      Level.leafGeoCache = Level.fanGeo(Level.bladeGeo(1.5, 0.95, 0.5), 5, 0.5);
    this.putDecor(
      key,
      Level.leafGeoCache,
      this.decorMat(key, color, "leaf", true),
      Level.trs(x, y + 0.02, z, x * 1.9 + z * 0.8, s),
    );
  }

  // Flower dots: a bright six-berry cluster, one buffer, coral/orange/pink.
  private static flowerGeoCache: THREE.BufferGeometry | null = null;
  private flowers(x: number, y: number, z: number): void {
    this.noteDecor("flowers", x, y, z);
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
    const keys = [
      ["bloomA", 0xff5a48],
      ["bloomB", 0xff9a2e],
      ["bloomC", 0xf84a8e],
    ] as const;
    const [key, color] = keys[Math.abs(Math.round(x * 3 + z * 5)) % 3];
    this.putDecor(
      key,
      Level.flowerGeoCache!,
      this.decorMat(key, color),
      Level.trs(x, y, z),
    );
  }

  // Deck planter: terracotta pot with a fern spilling out.
  private static potGeo: THREE.CylinderGeometry | null = null;
  private planter(x: number, y: number, z: number): void {
    this.noteDecor("planter", x, y, z);
    if (this.liteDecor) return;
    this.decorQuiet = true; // the fern spilling out is part of the pot
    if (!Level.potGeo)
      Level.potGeo = new THREE.CylinderGeometry(0.52, 0.38, 0.6, 9);
    const pot = new THREE.Mesh(Level.potGeo, this.decorMat("pot", 0xc86a42));
    pot.position.set(x, y + 0.3, z);
    this.root.add(pot);
    this.fern(x, y + 0.55, z, 0.9);
    this.decorQuiet = false;
  }

  // Rounded mossy boulder: squashed sphere, soft shading. Visual only.
  private static rockGeo: THREE.SphereGeometry | null = null;
  private rock(x: number, y: number, z: number, s = 1.6): void {
    this.noteDecor("mossrock", x, y, z, { w: s });
    if (!Level.rockGeo) Level.rockGeo = new THREE.SphereGeometry(1, 10, 8);
    this.putDecor(
      "mossRock",
      Level.rockGeo,
      this.decorMat("mossRock", 0xa8b090, "moss"),
      // deterministic tumble, then squashed on two axes
      Level.trs(x, y + s * 0.4, z, x * 1.3 + z * 0.7, s, 0, s * 0.6, s * 0.82),
    );
  }

  // ------------------------------------------------------ jungle dressing --
  // The pieces the corridor jungle needs that the tropical set didn't have:
  // spotted toadstools, canopy trees with vines, carved idols and mossy ruin
  // masonry. Same rules as the rest of the decor — geometry cached on the
  // class, materials shared through decorMat, added to root only, so none of
  // it can touch physics or a floorY probe. '?lite' skips the lot.

  // Spotted toadstool: cream stem, domed red cap, white blobs sunk into it.
  // The single most recognisable thing in the reference art, so it gets its
  // own cluster helper below rather than being sprinkled one at a time.
  private static toadStemGeo: THREE.BufferGeometry | null = null;
  private static toadCapGeo: THREE.BufferGeometry | null = null;
  private static toadSpotGeo: THREE.BufferGeometry | null = null;
  private toadstool(x: number, y: number, z: number, s = 1): void {
    this.noteDecor("toadstool", x, y, z, { w: s });
    if (this.liteDecor) return;
    if (!Level.toadStemGeo) {
      const g = new THREE.CylinderGeometry(0.13, 0.19, 0.62, 7);
      g.translate(0, 0.31, 0);
      Level.toadStemGeo = g;
      // cap: a squashed hemisphere with a slight lip, flat underneath
      const cap = new THREE.SphereGeometry(0.46, 10, 6, 0, Math.PI * 2, 0, 1.35);
      cap.scale(1, 0.72, 1);
      cap.translate(0, 0.6, 0);
      Level.toadCapGeo = cap;
      // spots ride ON the dome, so each one is placed by spherical angle
      // 4x3, not 6x5. This is an eight-centimetre dot on a mushroom cap seen
      // from five metres, and at 6x5 the seven of them were forty-eight
      // triangles each — a hundred and thirty THOUSAND triangles of mushroom
      // spot across the jungle, more than every tree in the level put
      // together. At 4x3 they are indistinguishable and cost a twentieth.
      const dot = new THREE.SphereGeometry(0.085, 4, 3);
      const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      for (let i = 0; i < 7; i++) {
        const th = (i / 7) * Math.PI * 2 + 0.6;
        const ph = 0.35 + (i % 3) * 0.33; // ring them down the dome
        const r = 0.44;
        parts.push({
          geo: dot,
          m: new THREE.Matrix4()
            .makeTranslation(
              Math.sin(ph) * Math.cos(th) * r,
              0.6 + Math.cos(ph) * r * 0.72,
              Math.sin(ph) * Math.sin(th) * r,
            )
            .scale(new THREE.Vector3(1, 0.6, 1)),
        });
      }
      Level.toadSpotGeo = Level.mergeGeos(parts);
      dot.dispose();
    }
    // stem, cap and spots share one transform, so they go in as three parts
    const t = Level.trs(x, y, z, x * 2.7 + z * 1.3, s);
    this.putDecor("toadStem", Level.toadStemGeo!, this.decorMat("toadStem", 0xf0e4c8), t);
    this.putDecor("toadCap", Level.toadCapGeo!, this.decorMat("toadCap", 0xd2402f), t);
    this.putDecor("toadSpot", Level.toadSpotGeo!, this.decorMat("toadSpot", 0xfff4e2), t);
  }

  // Toadstools grow in families in the reference, never alone: one big cap
  // with two or three smaller ones leaning around its foot.
  private toadstools(x: number, y: number, z: number, s = 1): void {
    this.noteDecor("toadstools", x, y, z, { w: s });
    if (this.liteDecor) return;
    this.decorQuiet = true; // the family is one component, not four
    this.toadstool(x, y, z, s);
    const n = 2 + (Math.abs(Math.round(x * 3 + z)) % 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + x * 0.7;
      const r = 0.55 * s + (i % 2) * 0.3 * s;
      this.toadstool(
        x + Math.cos(a) * r,
        y,
        z + Math.sin(a) * r,
        s * (0.42 + (i % 3) * 0.13),
      );
    }
    this.decorQuiet = false;
  }

  // Canopy tree: straight dark trunk with a buttressed foot and a broad
  // drooping crown, sized to close the corridor overhead. Nothing like the
  // beach palm — this is the wall-of-jungle tree.
  private static jTrunkGeo: THREE.BufferGeometry | null = null;
  private static jCrownGeo: THREE.BufferGeometry | null = null;
  private jungleTree(x: number, y: number, z: number, h = 9, lean = 0): void {
    this.noteDecor("jungletree", x, y, z, { rise: h, amp: lean });
    if (this.liteDecor) return;
    if (!Level.jTrunkGeo) {
      // taper hard at the base so it reads as a buttress root flare
      const g = new THREE.CylinderGeometry(0.34, 0.95, 9, 8, 5);
      g.translate(0, 4.5, 0);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / 9;
        // a lazy S so a stand of them never looks like a row of posts
        p.setX(i, p.getX(i) + Math.sin(t * 2.3) * 0.5 * t);
      }
      g.computeVertexNormals();
      Level.jTrunkGeo = g;
    }
    if (!Level.jCrownGeo) {
      // two stacked fans of long drooping paddles = a closed canopy blob
      const lower = Level.fanGeo(Level.bladeGeo(3.4, 1.5, 1.15), 9, 0.34);
      const upper = Level.fanGeo(Level.bladeGeo(2.5, 1.2, 0.9), 7, 0.62);
      Level.jCrownGeo = Level.mergeGeos([
        { geo: lower, m: new THREE.Matrix4() },
        { geo: upper, m: new THREE.Matrix4().makeTranslation(0, 0.85, 0) },
      ]);
      lower.dispose();
      upper.dispose();
    }
    // the tree's own frame: h/9 tall, leaning by `lean`
    const g = Level.trs(x, y, z, 0, h / 9, lean);
    this.putDecor(
      "jTrunk",
      Level.jTrunkGeo!,
      this.baseMat("jTrunk", 0x6b4a2f, "wood", 1, 4),
      g,
    );
    this.putDecor(
      "jCanopy",
      Level.jCrownGeo!,
      this.decorMat("jCanopy", 0x2f7a38, "leaf", true),
      // crown sits at the top of the trunk, twisted so no two stands match
      g.clone().multiply(Level.trs(0, 8.6, 0, x * 1.3 + z * 0.9)),
    );
  }

  // Hanging vines: a few tapered strands dropping out of the canopy. Read as
  // depth cues across the top of frame in an enclosed corridor.
  private static vineGeo: THREE.BufferGeometry | null = null;
  private vines(x: number, y: number, z: number, drop = 4, n = 3): void {
    this.noteDecor("vines", x, y, z, { rise: drop, n });
    if (this.liteDecor) return;
    if (!Level.vineGeo) {
      const g = new THREE.CylinderGeometry(0.045, 0.09, 1, 5);
      g.translate(0, -0.5, 0); // hangs DOWN from its anchor
      Level.vineGeo = g;
    }
    const mat = this.decorMat("vine", 0x3d7a33);
    for (let i = 0; i < n; i++) {
      const a = x * 1.7 + z * 0.9 + i * 2.1;
      const len = drop * (0.6 + ((i * 37) % 40) / 100);
      this.putDecor(
        "vine",
        Level.vineGeo,
        mat,
        // a lazy sway, baked
        Level.trs(
          x + Math.cos(a) * 0.7,
          y,
          z + Math.sin(a) * 0.7,
          0,
          1,
          Math.sin(a) * 0.1,
          len,
          1,
        ),
      );
    }
  }

  // Carved idol: the stacked tiki head from the reference. Stone blocks with
  // sunken eyes and a mouth slot — dark recesses do all the work at this
  // poly count. Solid: it blocks, so it can frame a doorway.
  private idol(x: number, y: number, z: number, s = 1, yaw = 0): void {
    this.noteDecor("idol", x, y, z, { w: s, yaw: THREE.MathUtils.radToDeg(yaw) });
    const stone = this.baseMat("idolStone", 0x9aa093, "stone", 1, 1);
    const dark = this.decorMat("idolCut", 0x2b2f2c);
    const g = new THREE.Group();
    const box = (
      w: number,
      hh: number,
      d: number,
      px: number,
      py: number,
      pz: number,
      mat: THREE.Material,
    ): void => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat);
      m.position.set(px, py, pz);
      g.add(m);
    };
    box(2.2, 0.5, 1.9, 0, 0.25, 0, stone); // plinth
    box(1.8, 2.0, 1.6, 0, 1.5, 0, stone); // head
    box(2.05, 0.34, 1.75, 0, 2.05, 0, stone); // brow ridge
    box(0.42, 0.3, 0.2, -0.42, 1.72, 0.82, dark); // eyes
    box(0.42, 0.3, 0.2, 0.42, 1.72, 0.82, dark);
    box(1.15, 0.34, 0.2, 0, 1.0, 0.82, dark); // mouth slot
    box(0.3, 0.9, 0.5, -0.98, 1.45, 0, stone); // ears
    box(0.3, 0.9, 0.5, 0.98, 1.45, 0, stone);
    g.scale.setScalar(s);
    g.rotation.y = yaw;
    g.position.set(x, y, z);
    this.root.add(g);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.3 * s, z),
        new THREE.Vector3(2.2 * s, 2.6 * s, 1.9 * s),
      ),
    );
  }

  // Mossy ruin block: masonry the temple is dressed with. Visual only by
  // default — the climb's collision comes from real slabs underneath, so a
  // decorative block can overhang without becoming a snag.
  private ruinBlock(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    yaw = 0,
  ): void {
    this.noteDecor("ruinblock", x, y, z, {
      s: [w, h, d],
      yaw: THREE.MathUtils.radToDeg(yaw),
    });
    if (this.liteDecor) return;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.baseMat("ruin", 0x8f9488, "stone", Math.max(1, w / 3), Math.max(1, h / 3)),
    );
    m.position.set(x, y + h / 2, z);
    m.rotation.y = yaw;
    this.root.add(m);
    // SOLID. Masonry you can see at knee height is masonry you can stand on —
    // these used to be scenery-only, so a hop onto a toppled course floated
    // straight through to the floor. Walkable top for the ground ray, a wall
    // box for pushes and ledge grabs. (The yawed AABB runs a little proud at
    // the corners; at these sizes and small yaws that reads as forgiveness.)
    m.updateWorldMatrix(true, false);
    this.groundMeshes.push(m);
    this.walls.push(new THREE.Box3().setFromObject(m));
    // a moss cap on top: the reference's ruins are all green-shouldered
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.98, 0.12, d * 0.98),
      this.decorMat("ruinMoss", 0x4e7a3e, "moss"),
    );
    cap.position.set(x, y + h + 0.05, z);
    cap.rotation.y = yaw;
    this.root.add(cap);
  }

  // Rolling stone hazard patrolling the course between z0 (near) and z1 (far).
  private stone(
    x: number,
    y: number,
    z0: number,
    z1: number,
    speed: number,
    r = 0.9,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 8),
      this.baseMat("rock", 0xa08a70, "dirt", 2, 2),
    );
    mesh.position.set(x, this.floorY(x, (z0 + z1) / 2, y) + r, (z0 + z1) / 2);
    this.root.add(mesh);
    this.stones.push({
      mesh,
      box: new THREE.Box3(),
      x,
      z0: Math.max(z0, z1),
      z1: Math.min(z0, z1),
      dir: 1,
      speed,
      r,
    });
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
    tex = "checker",
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
  private edgeRails(
    z0: number,
    y0: number,
    z1: number,
    y1: number,
    width: number,
    cx = 0,
  ): void {
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.15);
      const rail = new Rail(
        [
          new THREE.Vector3(x, y0 + 0.05, z0),
          new THREE.Vector3(x, y1 + 0.05, z1),
        ],
        false,
      );
      this.rails.push(rail);
    }
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(
    name: string,
    z0: number,
    y0: number,
    z1: number,
    y1: number,
    width: number,
    mat: THREE.Material,
    cx = 0,
    tex = "stone",
  ): void {
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
    // An authored ramp is a KICKER, never a transition, however steep it is.
    // Without this the angle test alone decides, so anything past steepStand
    // (40.5 degrees) got the halfpipe treatment: the board popped out and
    // pipeCarve + pipePumpGain handed back the entire climb, so a 62-degree
    // ramp cost nothing to go up. Transitions are authored deliberately, as
    // vertramp components or the analytic Halfpipe — not by a slope being steep.
    mesh.userData.vert = false;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Solid barrier: visual box + collider. Bump = full stop, never breaks.
  // visH: the VISIBLE wall height — the collider always stands the full h.
  // Spawn-side back walls use a low visH curb so the trailing camera sees
  // over them instead of eating a face full of bricks.
  private wall(
    cx: number,
    cz: number,
    w: number,
    d: number,
    baseY: number,
    h = 5,
    visH = h,
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, visH, d),
      this.baseMat("wall", this.wallTint, "stone", 3, 1),
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
  private stepBlock(
    x: number,
    z: number,
    w: number,
    d: number,
    baseY: number,
    topY: number,
  ): void {
    const h = topY - baseY;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.baseMat("step", this.blockTint, "stone", 2, 2),
    );
    mesh.position.set(x, baseY + h / 2, z);
    mesh.name = "step block";
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

  // Painted edge strips so deck borders read at speed. Visual only — the
  // per-level accent tint (THPS painted-curb energy) is set by each builder.
  private curbs(
    z0: number,
    z1: number,
    topY: number,
    width: number,
    cx = 0,
  ): void {
    const mat = this.baseMat("curb", this.curbTint);
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.22, depth),
        mat,
      );
      curb.position.set(
        cx + side * (width / 2 - 0.2),
        topY + 0.11,
        (z0 + z1) / 2,
      );
      this.root.add(curb);
    }
  }

  private crate(
    x: number,
    deckY: number,
    z: number,
    kind?:
      | "nitro"
      | "bouncy"
      | "metalbounce"
      | "tnt"
      | "mask"
      | "mystery"
      | "bang"
      | "nitrobang",
    opts?: { outline?: boolean; groupIds?: number[]; noAuto?: boolean },
  ): void {
    const size = 0.96; // uniform crate size (was 1.2; checkpoints matched at 1.4)
    // ARROW CRATES get a per-face material list: the arrow reads on the four
    // SIDES and the lid/floor stay blank. An arrow drawn on the top face is
    // pointing at the player who is already standing on it, and the one on the
    // bottom is never seen at all. BoxGeometry group order is +X, -X, +Y, -Y,
    // +Z, -Z, so indices 2 and 3 are the two that lose it.
    let mat: THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[];
    if (kind === "bouncy" || kind === "metalbounce") {
      const wood = kind === "bouncy";
      const side = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: wood ? this.arrowTexture() : this.metalArrowTexture(),
      });
      const lid = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: wood ? this.woodPlainTexture() : this.metalPlainTexture(),
      });
      mat = [side, side, lid, lid, side, side];
    } else if (kind === "nitro") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x0c3a16,
        map: this.nitroTexture(),
      });
    } else if (kind === "tnt") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: this.tntTexture("TNT"),
      });
    } else if (kind === "mask") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: this.maskTexture(),
      });
    } else if (kind === "mystery") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: this.mysteryTexture(),
      });
    } else if (kind === "bang") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: this.bangTexture(),
      });
    } else if (kind === "nitrobang") {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x0c3a16,
        map: this.nitroBangTexture(),
      });
    } else {
      mat = new THREE.MeshLambertMaterial({
        color: 0xffffff,
        map: this.plainTexture(),
      });
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
    let groundBase = base;
    if (!onStack) {
      if (this.builtFromData) {
        // captured/edited level: rest on the surface beneath (see crateRestSurface)
        const surf = this.crateRestSurface(x, z, deckY);
        base = surf !== null ? surf : deckY;
      } else {
        base = this.floorY(x, z, deckY);
      }
      groundBase = base;
    } else {
      // stacked: remember the FLOOR under the column too, so that if everything
      // below is smashed this crate knows where it is finally going to land
      groundBase = this.builtFromData
        ? (this.crateRestSurface(x, z, deckY) ?? deckY)
        : this.floorY(x, z, deckY);
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, base + size / 2, z);
    mesh.userData.baseY = mesh.position.y;
    mesh.userData.groundBaseY = groundBase; // the floor of this crate's column
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
      nitro: kind === "nitro",
      bouncy: kind === "bouncy",
      metalBounce: kind === "metalbounce",
      tnt: kind === "tnt",
      mask: kind === "mask",
      mystery: kind === "mystery",
      bang: kind === "bang",
      nitroBang: kind === "nitrobang",
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
    // AUTHORING ONLY. Data-built levels pass noAuto, because their partner is
    // already an explicit crate in the data: capture recorded it, so spawning
    // another here stacked a second fruit crate on every arrow crate, one more
    // per edit. It also has to stay explicit so the editor obeys you when you
    // move or delete that crate.
    if (kind === "bouncy" && !opts?.outline && !opts?.noAuto) {
      this.crate(x, base + size + 3.2, z);
    }
  }

  // A light metal plate face for the unbreakable arrow crate: same green
  // bounce arrow, riveted steel instead of planks.
  private metalArrowTex: THREE.CanvasTexture | null = null;
  private metalArrowTexture(): THREE.CanvasTexture {
    if (!this.metalArrowTex)
      this.metalArrowTex = Level.makeTex((ctx) => {
        this.crateMetalBase(ctx);
        ctx.fillStyle = "#3a9a4a";
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
        ctx.strokeStyle = "#1c5a28";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    return this.metalArrowTex;
  }

  // Brushed plate + rivets, shared by the metal-family crate faces.
  private crateMetalBase(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#9aa2ac";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = "#8a929c";
    ctx.fillRect(0, 8, 32, 2);
    ctx.fillRect(0, 22, 32, 2);
    ctx.fillStyle = "#666e78";
    ctx.fillRect(0, 0, 32, 2);
    ctx.fillRect(0, 30, 32, 2);
    ctx.fillRect(0, 0, 2, 32);
    ctx.fillRect(30, 0, 2, 32);
    ctx.fillStyle = "#b8c0ca";
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = "#565e68";
    for (const [rx, ry] of [
      [4, 4],
      [26, 4],
      [4, 26],
      [26, 26],
    ] as const) {
      ctx.fillRect(rx, ry, 3, 3);
    }
  }

  // Classic PSX crate face: light planked wood, beveled frame, corner studs.
  // Every crate variant draws its icon over this base (drawn per reference
  // rips of the original series' crate sheet, recreated by hand).
  private static crateWood(ctx: CanvasRenderingContext2D, brace: boolean): void {
    ctx.fillStyle = "#b5762f";
    ctx.fillRect(0, 0, 32, 32);
    // plank seams + grain flecks
    ctx.fillStyle = "#94601f";
    ctx.fillRect(0, 10, 32, 1);
    ctx.fillRect(0, 21, 32, 1);
    ctx.fillRect(6, 5, 4, 1);
    ctx.fillRect(20, 15, 5, 1);
    ctx.fillRect(9, 26, 5, 1);
    if (brace) {
      // X brace
      ctx.strokeStyle = "#8a5a22";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.lineTo(29, 29);
      ctx.moveTo(29, 3);
      ctx.lineTo(3, 29);
      ctx.stroke();
    }
    // beveled frame + corner studs
    ctx.fillStyle = "#8a5a22";
    ctx.fillRect(0, 0, 32, 3);
    ctx.fillRect(0, 29, 32, 3);
    ctx.fillRect(0, 0, 3, 32);
    ctx.fillRect(29, 0, 3, 32);
    ctx.fillStyle = "#d19b4a";
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillStyle = "#6e4517";
    for (const [cx, cy] of [
      [1, 1],
      [27, 1],
      [1, 27],
      [27, 27],
    ] as const) {
      ctx.fillRect(cx, cy, 4, 4);
    }
  }

  // Outlined icon text, chunky PSX style — the Roo face, painted flat. The
  // HUD's gradient / bevel / extrusion chrome is deliberately NOT here: a
  // crate stencil is read at a glance from across a room, so it stays a
  // solid fill with a hard keyline. (Roo is loaded before the first texture
  // is baked and every canvas is re-painted if it lands late — see makeTex.)
  private crateLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    px: number,
    fill: string,
    outline: string,
    x = 16,
    y = 18,
  ): void {
    // Family LIST, not two shorthands: `24px Roo, bold 24px monospace` is not
    // valid CSS font and the canvas silently keeps 10px sans-serif.
    ctx.font = `${px}px "Roo", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = outline;
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      ctx.fillText(text, x + ox, y + oy);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  // Painted in a 32-unit space (every draw call below is written against it)
  // onto an 8x canvas, so the crate faces keep their layout and lose their
  // staircase.
  private static makeTex(
    draw: (ctx: CanvasRenderingContext2D) => void,
  ): THREE.CanvasTexture {
    const SS = 8;
    const canvas = document.createElement("canvas");
    canvas.width = 32 * SS;
    canvas.height = 32 * SS;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(SS, SS);
    draw(ctx);
    const tex = Level.finishTex(new THREE.CanvasTexture(canvas), false);
    // A level can be built before Roo finishes loading (the first one always
    // is — it is constructed at module scope). Rather than bake a fallback
    // font into the atlas, every face keeps its draw call and paints itself
    // again the moment the real face arrives.
    if (!rooLoaded) {
      void rooReady.then(() => {
        ctx.clearRect(0, 0, 32, 32);
        draw(ctx);
        tex.needsUpdate = true;
      });
    }
    return tex;
  }

  // Plain wooden crate: planks + X brace, nothing else.
  private plainTexture(): THREE.CanvasTexture {
    if (!this.plainTex) this.plainTex = Level.plainCrateTexture();
    return this.plainTex;
  }

  /** The plain crate face, owned by the class so the HUD can have one too. */
  private static plainCrateTex: THREE.CanvasTexture | null = null;
  static plainCrateTexture(): THREE.CanvasTexture {
    if (!Level.plainCrateTex)
      Level.plainCrateTex = Level.makeTex((ctx) => Level.crateWood(ctx, true));
    return Level.plainCrateTex;
  }

  /**
   * A standalone plain crate, for the HUD counter icon — the SAME box and the
   * SAME painted face the level builds, so the thing you are counting and the
   * thing you are smashing are visibly one object. Centred on its own origin
   * so it turns on the spot.
   */
  static crateMesh(size = 1): THREE.Group {
    const g = new THREE.Group();
    g.add(
      new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshLambertMaterial({
          color: 0xffffff,
          map: Level.plainCrateTexture(),
        }),
      ),
    );
    return g;
  }

  // Yellow '!' on METAL: the switch that materializes its group's outline
  // crates. Never breaks, never counts toward the box tally.
  private bangTex: THREE.CanvasTexture | null = null;
  private bangTexture(): THREE.CanvasTexture {
    if (!this.bangTex)
      this.bangTex = Level.makeTex((ctx) => {
        this.crateMetalBase(ctx);
        this.crateLabel(ctx, "!", 24, "#ffd934", "#3a3f46", 16, 18);
      });
    return this.bangTex;
  }

  // A BLANK metal face. Three jobs: a fired '!' switch (metal or nitro) keeps
  // its box and loses its mark, and the arrow crates wear it on their lid and
  // floor — an arrow you can only see from above tells you nothing, since the
  // bounce is a thing you land ON.
  private spentBangTex: THREE.CanvasTexture | null = null;
  private metalPlainTexture(): THREE.CanvasTexture {
    if (!this.spentBangTex)
      this.spentBangTex = Level.makeTex((ctx) => this.crateMetalBase(ctx));
    return this.spentBangTex;
  }

  // ...and the same for wood: the arrow crate's own plank base, no arrow.
  private woodPlainTex: THREE.CanvasTexture | null = null;
  private woodPlainTexture(): THREE.CanvasTexture {
    if (!this.woodPlainTex)
      this.woodPlainTex = Level.makeTex((ctx) => Level.crateWood(ctx, false));
    return this.woodPlainTex;
  }

  // White '!' on nitro green: breaking it detonates every nitro on the map.
  private nitroBangTex: THREE.CanvasTexture | null = null;
  private nitroBangTexture(): THREE.CanvasTexture {
    if (!this.nitroBangTex)
      this.nitroBangTex = Level.makeTex((ctx) => {
        ctx.fillStyle = "#2fae44";
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = "#1c7a2c";
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        this.crateLabel(ctx, "!", 24, "#eafff0", "#0e4a18", 16, 18);
      });
    return this.nitroBangTex;
  }

  // Riveted steel: the UNBREAKABLE crate (solid terrain, spin/slam-proof).
  private metalTex: THREE.CanvasTexture | null = null;
  private metalTexture(): THREE.CanvasTexture {
    if (!this.metalTex)
      this.metalTex = Level.makeTex((ctx) => {
        ctx.fillStyle = "#9aa2ac";
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = "#7d8590";
        ctx.fillRect(0, 0, 32, 4);
        ctx.fillRect(0, 28, 32, 4);
        ctx.fillRect(0, 0, 4, 32);
        ctx.fillRect(28, 0, 4, 32);
        ctx.fillStyle = "#b8c0ca";
        ctx.fillRect(4, 4, 24, 2); // top sheen
        ctx.fillStyle = "#666e78";
        for (const [rx, ry] of [
          [6, 6],
          [24, 6],
          [6, 24],
          [24, 24],
        ] as const) {
          ctx.fillRect(rx, ry, 3, 3); // corner rivets
        }
        ctx.fillStyle = "#8a929c";
        ctx.fillRect(14, 8, 4, 16); // center brace
        ctx.fillRect(8, 14, 16, 4);
      });
    return this.metalTex;
  }

  // Big orange '?' on plain wood.
  private mysteryTexture(): THREE.CanvasTexture {
    if (!this.mysteryTex)
      this.mysteryTex = Level.makeTex((ctx) => {
        Level.crateWood(ctx, false);
        this.crateLabel(ctx, "?", 22, "#ff8c1a", "#5a2d08", 16, 17);
      });
    return this.mysteryTex;
  }

  // Mask crate: the authored crossbones sticker (public/crossbones.png, alpha)
  // composited over a wood crate face. Higher-res than the 32px PSX faces so the
  // painted bones read; the sticker loads async and repaints when ready.
  private maskTexture(): THREE.CanvasTexture {
    if (this.maskTex) return this.maskTex;
    const S = 128;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.scale(S / 32, S / 32); // crateWood authors in 32-space
    Level.crateWood(ctx, false);
    ctx.restore();
    const tex = new THREE.CanvasTexture(canvas);
    this.maskTex = tex;
    const img = new Image();
    img.onload = () => {
      const pad = Math.round(S * 0.11); // sit the sticker inside the crate's beveled frame
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, pad, pad, S - pad * 2, S - pad * 2);
      tex.needsUpdate = true;
    };
    img.src = import.meta.env.BASE_URL + "crossbones.png";
    return tex;
  }

  // Classic red TNT face; lit fuses swap it for big 3 / 2 / 1 digits.
  private tntTexture(label: string): THREE.CanvasTexture {
    const cached = this.tntTexCache.get(label);
    if (cached) return cached;
    const tex = Level.makeTex((ctx) => {
      ctx.fillStyle = "#c23a30";
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = "#8f2018";
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = "#e06a52";
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      if (label.length > 1)
        this.crateLabel(ctx, label, 12, "#ffffff", "#3a0c08", 16, 17);
      else this.crateLabel(ctx, label, 24, "#ffe84a", "#3a0c08", 16, 17);
    });
    this.tntTexCache.set(label, tex);
    return tex;
  }

  // Green NITRO: jittery goo crate, hazard-striped frame.
  private nitroTexture(): THREE.CanvasTexture {
    if (!this.nitroTex)
      this.nitroTex = Level.makeTex((ctx) => {
        ctx.fillStyle = "#2fae44";
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = "#1c7a2c";
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        // hazard notches on the frame
        ctx.fillStyle = "#0e4a18";
        for (let x = 0; x < 32; x += 8) {
          ctx.fillRect(x, 0, 4, 3);
          ctx.fillRect(x + 4, 29, 4, 3);
        }
        ctx.fillStyle = "#7ce890";
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, "NITRO", 9, "#eafff0", "#0e4a18", 16, 16);
        this.crateLabel(ctx, "!", 12, "#ffe84a", "#0e4a18", 16, 25);
      });
    return this.nitroTex;
  }

  // Chunky green up-arrow on wood (the super-bounce crate).
  private arrowTexture(): THREE.CanvasTexture {
    if (!this.arrowTex)
      this.arrowTex = Level.makeTex((ctx) => {
        Level.crateWood(ctx, false);
        ctx.fillStyle = "#1c6a28";
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
        ctx.fillStyle = "#3fae4a";
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
      this.cpTex = Level.makeTex((ctx) => {
        ctx.fillStyle = "#4aa0e0";
        ctx.fillRect(0, 0, 32, 32);
        ctx.fillStyle = "#2a6ba0";
        ctx.fillRect(0, 10, 32, 1);
        ctx.fillRect(0, 21, 32, 1);
        ctx.fillRect(0, 0, 32, 3);
        ctx.fillRect(0, 29, 32, 3);
        ctx.fillRect(0, 0, 3, 32);
        ctx.fillRect(29, 0, 3, 32);
        ctx.fillStyle = "#9fd4ff";
        ctx.fillRect(0, 0, 32, 1);
        ctx.fillRect(0, 0, 1, 32);
        this.crateLabel(ctx, "C", 22, "#ffffff", "#123049", 16, 17);
      });
    return this.cpTex;
  }

  // -------------------------------------------------- warp-room VFX --

  // Sharp 4-point twinkle for the additive sparkle billboards. Drawn WHITE so
  // a per-sprite material colour tints it (purple crystal glints, cyan gem).
  private glintTexture(): THREE.CanvasTexture {
    if (this.glintTex) return this.glintTex;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
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
    cg.addColorStop(0, "rgba(255,255,255,1)");
    cg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = cg;
    ctx.fillRect(20, 20, 24, 24);
    this.glintTex = Level.finishTex(new THREE.CanvasTexture(canvas), false);
    return this.glintTex;
  }

  // The big collection flash: a blazing white core with long anamorphic rays
  // (the lens-flare starbursts in the reference). White; tinted per burst.
  private flareTexture(): THREE.CanvasTexture {
    if (this.flareTex) return this.flareTex;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.translate(64, 64);
    // eight rays, cardinals long, diagonals shorter — additive so they streak
    ctx.fillStyle = "rgba(255,255,255,0.85)";
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
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
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
  private static matcapTex: {
    crystal?: THREE.CanvasTexture;
    gem?: THREE.CanvasTexture;
  } = {};
  private static matcapTexture(
    kind: "crystal" | "gem",
  ): THREE.CanvasTexture {
    const cached = Level.matcapTex[kind];
    if (cached) return cached;
    const S = 128;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    const c = S / 2;
    const blob = (x: number, y: number, r: number, col: string) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    if (kind === "crystal") {
      // BRIGHT white-lavender crystal: the front face reads near-white and only
      // the rim/side facets go saturated purple → magenta (matches the ref,
      // which glows white-hot with purple edges, not a dark purple stone).
      const base = ctx.createRadialGradient(c - 12, c - 14, 4, c, c, c);
      base.addColorStop(0, "#ffffff");
      base.addColorStop(0.3, "#f0e2ff");
      base.addColorStop(0.55, "#d3a6f2");
      base.addColorStop(0.78, "#a848e0");
      base.addColorStop(0.92, "#6a1cb0");
      base.addColorStop(1, "#3c0c72");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, S, S);
      // hot core + a lavender bloom so the facing face blazes
      blob(c - 12, c - 16, 30, "rgba(255,255,255,0.9)");
      blob(c - 16, c - 20, 12, "rgba(255,255,255,1)");
      blob(c + 34, c + 30, 30, "rgba(200,60,215,0.55)"); // magenta rim bounce
    } else {
      // silver-white sphere: bright silver centre, cool slate at the rim
      const base = ctx.createRadialGradient(c - 10, c - 12, 4, c, c, c);
      base.addColorStop(0, "#ffffff");
      base.addColorStop(0.42, "#c6d4e2");
      base.addColorStop(0.72, "#7d8d9d");
      base.addColorStop(0.9, "#4c5c6c");
      base.addColorStop(1, "#2c3742");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, S, S);
      // diamonds throw multiple hard glints: bright streaks + spots that sweep
      ctx.save();
      ctx.translate(c - 16, c - 26);
      ctx.rotate(-0.5);
      ctx.scale(0.42, 1.4);
      blob(0, 0, 40, "rgba(255,255,255,1)");
      ctx.restore();
      blob(c + 28, c + 8, 18, "rgba(255,255,255,0.9)");
      blob(c - 32, c + 32, 13, "rgba(225,238,250,0.8)");
    }
    const tex = Level.finishTex(new THREE.CanvasTexture(canvas), false);
    Level.matcapTex[kind] = tex;
    return tex;
  }

  // Soft round halo — the pink/cyan glow that hangs around the pickups. White,
  // tinted by the sprite material.
  private static glowTexture(): THREE.CanvasTexture {
    if (Level.glowTex) return Level.glowTex;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,0.62)");
    g.addColorStop(0.3, "rgba(255,255,255,0.3)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    Level.glowTex = new THREE.CanvasTexture(canvas);
    Level.glowTex.magFilter = THREE.LinearFilter;
    return Level.glowTex;
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
      slot = {
        spr,
        life: 0,
        max: 0.6,
        vx: 0,
        vy: 0,
        vz: 0,
        spin: 0,
        scale: 1,
        pop: false,
      };
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
        {
          tex: this.flareTexture(),
          color: i === 0 ? 0xffffff : hue,
          vy: 0.3,
          life: 0.45,
          pop: true,
        },
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
  static crystalMesh(scale = 1): THREE.Group {
    const g = new THREE.Group();
    const R = 0.52 * scale;
    const HTOP = 0.72 * scale; // short upper pyramid
    const HBOT = 1.5 * scale; // long lower point
    // CANNED reflection: matcap, not scene lighting. Each flat facet samples
    // the painted highlight by its normal, so the bright face sweeps as the
    // crystal spins — independent of the world's real lights.
    const shellMat = new THREE.MeshMatcapMaterial({
      matcap: Level.matcapTexture("crystal"),
      flatShading: true,
      transparent: true,
      opacity: 0.96,
    });
    const SIDES = 5; // few big facets = a sharp shard
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(R, HTOP, SIDES),
      shellMat,
    );
    top.position.y = HTOP / 2; // belt (widest ring) sits at y=0
    g.add(top);
    const bot = new THREE.Mesh(
      new THREE.ConeGeometry(R, HBOT, SIDES),
      shellMat,
    );
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
    const ctop = new THREE.Mesh(
      new THREE.ConeGeometry(R * 0.4, HTOP * 0.95, SIDES),
      coreMat,
    );
    ctop.position.y = HTOP / 2;
    g.add(ctop);
    const cbot = new THREE.Mesh(
      new THREE.ConeGeometry(R * 0.4, HBOT * 0.95, SIDES),
      coreMat,
    );
    cbot.rotation.z = Math.PI;
    cbot.position.y = -HBOT / 2;
    g.add(cbot);
    // pink glow halo (billboard), taller and offset DOWN so it blazes at the
    // long bottom tip like the reference
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: Level.glowTexture(),
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
        map: Level.glowTexture(),
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
  static gemMesh(scale = 1, tint?: number): THREE.Group {
    const g = new THREE.Group();
    const girdle = 0.72 * scale;
    const table = 0.4 * scale;
    const crownH = 0.42 * scale;
    const pavH = 0.8 * scale;
    // canned reflection (matcap) so the silver glints sweep the crown facets
    // as the gem spins, no scene lighting
    const mat = new THREE.MeshMatcapMaterial({
      matcap: Level.matcapTexture("gem"),
      flatShading: true,
      transparent: true,
      opacity: 0.9,
    });
    // tint runs the clear gem through coloured glass — the combo prize is the
    // same cut in green
    if (tint !== undefined) mat.color.setHex(tint);
    // crown: 8-sided frustum, wide girdle at the bottom, narrow table on top
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(table, girdle, crownH, 8),
      mat,
    );
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
        map: Level.glowTexture(),
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
    const g = Level.crystalMesh(1);
    // belt sits at the group origin; the long bottom point reaches ~1.5 below,
    // so float the group up to keep the tip hovering just above the ground
    g.position.set(x, y + 1.75, z);
    g.userData.baseY = y + 1.75;
    this.root.add(g);
    this.crystalPickup = {
      group: g,
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(x, y + 1.3, z),
        new THREE.Vector3(2.0, 3.4, 2.0),
      ),
      collected: false,
    };
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
    // 3 out, not 2. Both activators sat close enough to the spawn line that
    // running straight off the start tripped one of them by accident, and a
    // time trial you did not mean to begin is a run you have to restart.
    const x = spot ? spot.x : this.spawnPos.x + 3;
    const z = spot ? spot.z : this.spawnPos.z + dir * 5;
    const y = this.floorY(x, z, spot ? spot.y : this.spawnPos.y);
    const before = this.root.children.length;

    const g = new THREE.Group();
    const gold = new THREE.MeshLambertMaterial({
      color: 0xe8b53a,
      emissive: 0x40300a,
    });
    // face: white dial, gold rim, hands at ten-past-ten
    const faceTex = Level.makeTex((ctx) => {
      ctx.fillStyle = "#f4efdf";
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = "#c79a2e";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(16, 16, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#3a3020";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.fillRect(
          16 + Math.cos(a) * 11 - 1,
          16 + Math.sin(a) * 11 - 1,
          2,
          2,
        );
      }
      ctx.strokeStyle = "#20242c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, 16);
      ctx.lineTo(16 + 7, 16 - 4);
      ctx.moveTo(16, 16);
      ctx.lineTo(16 - 3, 16 - 8);
      ctx.stroke();
    });
    const faceMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      map: faceTex,
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 0.3, 14),
      [gold, faceMat, faceMat],
    );
    body.rotation.x = Math.PI / 2; // dial fronts the corridor
    g.add(body);
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.18, 8),
      gold,
    );
    crown.position.y = 0.72;
    g.add(crown);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.05, 6, 10),
      gold,
    );
    ring.position.y = 0.92;
    g.add(ring);
    g.position.set(x, y + 1.35, z);
    g.userData.baseY = y + 1.35;
    this.root.add(g);
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

  // Show or hide the two run-mode activators. The pickups keep their boxes and
  // their collected flags either way — the player's touch checks read
  // runModesOn — so flipping this back on mid-level restores them exactly as
  // they were rather than handing out a second stopwatch.
  setRunModesEnabled(on: boolean): void {
    this.runModesOn = on;
    if (this.clockPickup)
      this.clockPickup.group.visible = on && !this.clockPickup.collected;
    if (this.comboOrb)
      this.comboOrb.group.visible = on && !this.comboOrb.collected;
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
    const x = spot ? spot.x : this.spawnPos.x - 3; // the far side, same reason
    const z = spot ? spot.z : this.spawnPos.z + dir * 5;
    const y = this.floorY(x, z, spot ? spot.y : this.spawnPos.y);
    const before = this.root.children.length;
    const g = new THREE.Group();
    // a chunky 3D plus, spinning on the spot (bobSpin drives the turn)
    const plusMat = new THREE.MeshLambertMaterial({
      color: 0x46e882,
      emissive: 0x0e5c2c,
      flatShading: true,
    });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.15, 0.36), plusMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.36), plusMat));
    // a soft translucent plus around it reads "glowy" at PS1 fidelity
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x46e882,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.38, 0.56), shellMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.56, 0.56), shellMat));
    g.position.set(x, y + 1.3, z);
    g.userData.baseY = y + 1.3;
    this.root.add(g);
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
    const g = Level.gemMesh(1.1, COMBO_GEM_TINT);
    g.position.set(gx, y + 1.7, gz);
    g.userData.baseY = y + 1.7;
    this.root.add(g);
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
    if (this.crystalPickup && !this.crystalPickup.collected)
      this.crystalPickup.group.visible = !on;
    const secsPattern = [2, 1, 3, 1, 2, 4]; // mostly small freezes, the odd jackpot
    let i = 0;
    for (const c of this.crates) {
      const convertible =
        !c.nitro &&
        !c.bouncy &&
        !c.metalBounce &&
        !c.tnt &&
        !c.mask &&
        !c.bang &&
        !c.nitroBang;
      if (!convertible) continue;
      // pending outlines keep their ghost shell — repaint the REAL face under it
      const mat = (
        c.pending && c.realMat ? c.realMat : c.mesh.material
      ) as THREE.MeshLambertMaterial;
      if (on) {
        c.ttOrigMap = mat.map;
        c.timeSecs = undefined;
        c.boost = undefined;
        if (!withTimeCrates && this.allBalanceCrates) {
          // levels built around one long grind line (The Slipstream): EVERY
          // crate is a stacking perfect-balance window in combo mode
          c.boost = "balance";
          mat.map = this.boostTexture("balance");
        } else if (i % 3 === 2) {
          if (withTimeCrates) {
            // time trial: numbered freeze crates
            c.timeSecs = secsPattern[Math.floor(i / 3) % secsPattern.length];
            mat.map = this.timeTexture(c.timeSecs);
          } else {
            // combo run: perfect-balance crates — the windows STACK
            c.boost = "balance";
            mat.map = this.boostTexture("balance");
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
    const tex = Level.makeTex((ctx) => {
      ctx.fillStyle = "#e8c33a";
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = "#b08a1c";
      ctx.fillRect(0, 10, 32, 1);
      ctx.fillRect(0, 21, 32, 1);
      ctx.fillRect(0, 0, 32, 3);
      ctx.fillRect(0, 29, 32, 3);
      ctx.fillRect(0, 0, 3, 32);
      ctx.fillRect(29, 0, 3, 32);
      ctx.fillStyle = "#ffe89a";
      ctx.fillRect(0, 0, 32, 1);
      ctx.fillRect(0, 0, 1, 32);
      this.crateLabel(ctx, String(n), 24, "#ffffff", "#5a4008", 16, 17);
    });
    this.timeTexCache.set(n, tex);
    return tex;
  }

  // Combo-run boost crates: orange chevrons = speed burst, cyan needle =
  // perfect balance for a few seconds.
  private boostTexCache = new Map<string, THREE.CanvasTexture>();
  private boostTexture(kind: "speed" | "balance"): THREE.CanvasTexture {
    const cached = this.boostTexCache.get(kind);
    if (cached) return cached;
    const tex = Level.makeTex((ctx) => {
      const base = kind === "speed" ? "#e8763a" : "#3ac2e8";
      const dark = kind === "speed" ? "#a8481c" : "#1c7ea8";
      const light = kind === "speed" ? "#ffb98a" : "#a8e8ff";
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
      if (kind === "speed") {
        // double chevron pointing right
        ctx.fillStyle = "#ffffff";
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
        ctx.fillStyle = "#ffffff";
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

  // All boxes broken: the gem MATERIALIZES. It used to appear three metres
  // over your head and be yours the same instant, which made it a trophy that
  // announced itself rather than a thing you got — you never actually touched
  // it. Now it drops in at body height and waits to be collected, so breaking
  // the last box is the moment it appears and picking it up is the reward.
  awardGem(pos: THREE.Vector3): void {
    if (this.gemPickup) return;
    const g = Level.gemMesh(1);
    // Seat it on the FLOOR under you, not at your own height. It only had to
    // appear before, so where did not matter; now it has to be reachable, and
    // the last box can perfectly well break while you are airborne over a pit.
    // No floor under there (the pit case) = leave it where you were.
    const ground = this.floorY(pos.x, pos.z, NaN);
    const y = (Number.isNaN(ground) ? pos.y : Math.min(pos.y, ground)) + 1.5;
    g.position.set(pos.x, y, pos.z);
    g.userData.baseY = y;
    this.root.add(g);
    this.gemG = g;
    this.gemPickup = {
      group: g,
      // generous: it can materialize mid-air off a ramp, and chasing your own
      // gem back down a corridor is not the game
      box: new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(pos.x, y, pos.z),
        new THREE.Vector3(2.4, 3.0, 2.4),
      ),
      collected: false,
    };
    // no magic ring on the gem — the reference is a clean spinning diamond
    this.glimmerBurst(g.position, 0x9fe0ff);
  }

  /** Touched the materialized gem: it's yours. */
  collectGem(): void {
    if (!this.gemPickup) return;
    this.gemPickup.collected = true;
    this.gemPickup.group.visible = false;
    this.glimmerBurst(this.gemPickup.group.position, 0xaee6ff);
  }

  // Per-frame VFX tick: bobs, spins, glints.
  // Every lit torch trails smoke. It is the same PS1 puff system the skater's
  // trail uses, on the same two-ring falloff — an ember-white core cooling into
  // the dark as the plume climbs, which is what gives the hall depth instead of
  // a row of flames floating in black.
  //
  // A torch only smokes when it is BURNING and when the skater is near enough
  // to see it: the level has dozens of fires and a plume each would spend the
  // whole particle pool on scenery nobody is looking at, starving the effects
  // that are actually about play.
  private smokeTorches(dt: number): void {
    const px = this.playerPos.x, py = this.playerPos.y, pz = this.playerPos.z;
    for (const t of this.torches) {
      if (t.burn < 0.35) continue; // a dying or dead fire stops smoking
      const at = t.lightAt;
      const dx = at.x - px, dy = at.y - py, dz = at.z - pz;
      if (dx * dx + dy * dy + dz * dz > 46 * 46) continue;
      t.smokeT -= dt * t.burn;
      if (t.smokeT > 0) continue;
      const r = Math.abs(Math.sin(this.vfxT * 12.9898 + t.seed * 78.233)) % 1;
      // The interval comes from the PRESET's own rate, so a rate dialled in
      // the smoke studio is the rate the torches actually run at — a hardcoded
      // clock here would silently ignore it. Irregular around that rate by
      // design: a fixed interval reads as a machine, and real smoke comes in
      // uneven clumps with the odd pause and the odd double.
      const rate = PUFF_TORCH_RATE[0] + r * (PUFF_TORCH_RATE[1] - PUFF_TORCH_RATE[0]);
      const j = PUFF_TORCH.jitter ?? 0.5;
      t.smokeT = (1 / rate) * (1 - j * 0.5 + r * j);
      puffs.spawn(PUFF_TORCH, at.x, at.y + 0.35, at.z, {
        strength: 0.8 + r * 0.5,
        ambient: true, // scenery: yields the pool to landings, crates and trails
      });
    }
  }

  private updateVfx(dt: number): void {
    this.vfxT += dt;
    this.smokeTorches(dt);
    const pulse = 0.75 + 0.25 * Math.sin(this.vfxT * 3.3); // shared glow breathe
    const bobSpin = (g: THREE.Group | null, rate: number): void => {
      if (!g || !g.visible) return;
      g.position.y =
        (g.userData.baseY as number) + Math.sin(this.vfxT * 2.1) * 0.22;
      g.rotation.y += rate * dt;
      // breathe the glow halos so the lighting loop lives even at rest
      for (const child of g.children) {
        if (child.userData.pulse) {
          ((child as THREE.Sprite).material as THREE.SpriteMaterial).opacity =
            pulse;
        }
      }
    };
    if (this.crystalPickup && !this.crystalPickup.collected)
      bobSpin(this.crystalPickup.group, 1.7);
    if (this.clockPickup && !this.clockPickup.collected)
      bobSpin(this.clockPickup.group, 1.3);
    if (this.comboOrb && !this.comboOrb.collected)
      bobSpin(this.comboOrb.group, 1.6);
    if (this.comboGem) bobSpin(this.comboGem.group, 2.0);
    bobSpin(this.gemG, 2.4);
    // ambient glints drip off whatever magic is live (tinted to the pickup)
    this.glintT -= dt;
    if (this.glintT <= 0) {
      this.glintT = 0.2;
      const anchors: { p: THREE.Vector3; c: number }[] = [];
      if (
        this.crystalPickup &&
        !this.crystalPickup.collected &&
        !this.timeTrial
      )
        anchors.push({ p: this.crystalPickup.group.position, c: 0xd863f2 });
      if (this.gemG) anchors.push({ p: this.gemG.position, c: 0xaee6ff });
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
      const k = g.pop
        ? prog < 0.25
          ? prog / 0.25
          : 1 - (prog - 0.25) / 0.75
        : Math.sin(prog * Math.PI);
      const s = g.scale * k;
      g.spr.scale.set(s, s, 1);
      (g.spr.material as THREE.SpriteMaterial).rotation += g.spin * dt;
    }
  }

  // Two white pupil eyes on the front face at height y.
  private enemyEyes(
    group: THREE.Group,
    y: number,
    z = 0.56,
    spread = 0.22,
  ): void {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-spread, spread]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.1),
        eyeMat,
      );
      eye.position.set(side, y, z);
      group.add(eye);
    }
  }

  // Build the mesh for a foe. Returns the group and the "body" — the mesh a
  // kind squashes / flashes / spins for its state animation.
  private enemyGroup(kind: EnemyKind): {
    group: THREE.Group;
    body: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const lam = (c: number, e = 0): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({ color: c, emissive: e });
    let body: THREE.Mesh;
    if (kind === "spiker") {
      // squat purple body wearing a crown of up-pointing spikes (land = ouch)
      body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 1.05), lam(0x7a3a8a));
      body.position.y = 0.42;
      group.add(body);
      const spikeMat = lam(0xe8e0f0);
      for (const [sx, sz] of [
        [-0.28, -0.28],
        [0.28, -0.28],
        [-0.28, 0.28],
        [0.28, 0.28],
        [0, 0],
      ]) {
        const spike = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.42, 4),
          spikeMat,
        );
        spike.position.set(sx, 0.86, sz);
        group.add(spike);
      }
      this.enemyEyes(group, 0.55, 0.55);
    } else if (kind === "turtle") {
      // domed green shell (safe to land on), gold side plates, a poking head.
      // NO top spikes — stomping is the ONLY way through it.
      body = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2),
        lam(0x2f7a44),
      );
      body.scale.set(1, 0.75, 1.15);
      body.position.y = 0.34;
      group.add(body);
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.4, 0.9),
          lam(0x8a6a2a),
        );
        plate.position.set(side * 0.6, 0.3, 0);
        group.add(plate);
      }
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.36, 0.4),
        lam(0x6cae5a),
      );
      head.position.set(0, 0.34, 0.62);
      group.add(head);
      this.enemyEyes(group, 0.42, 0.82, 0.12);
    } else if (kind === "charger") {
      // bulky bull with forward horns — the reared-back telegraph reads clearly
      body = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.95, 1.45),
        lam(0x8a4a26),
      );
      body.position.y = 0.6;
      group.add(body);
      for (const side of [-0.34, 0.34]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.13, 0.5, 5),
          lam(0xf0e6d0),
        );
        horn.position.set(side, 0.82, 0.82);
        horn.rotation.x = Math.PI / 2.1;
        group.add(horn);
      }
      const snout = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.4, 0.3),
        lam(0x6e3a1e),
      );
      snout.position.set(0, 0.42, 0.82);
      group.add(snout);
      this.enemyEyes(group, 0.82, 0.74, 0.28);
    } else if (kind === "hopper") {
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
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.24, 0.4),
          lam(0x35862c),
        );
        leg.position.set(side, 0.2, -0.18);
        group.add(leg);
      }
    } else if (kind === "floater") {
      // hovering drone: a violet core diamond ringed by a spinning rotor blur,
      // a single wary eye. It never touches the ground.
      body = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42),
        lam(0x9a6cff, 0x2a1466),
      );
      body.position.y = 0.05;
      group.add(body);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.07, 6, 16),
        lam(0x6c4ad0, 0x160a40),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      ring.name = "rotor";
      group.add(ring);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe27a }),
      );
      eye.position.set(0, 0.05, 0.4);
      group.add(eye);
    } else if (kind === "sentry") {
      // fixed base + a rotating head with a barrel and a charge-eye that glows
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.62, 0.5, 8),
        lam(0x4c525e),
      );
      base.position.y = 0.25;
      group.add(base);
      body = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.6, 0.85),
        lam(0x8a3a3a),
      );
      body.position.y = 0.72;
      body.name = "head";
      group.add(body);
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.6, 8),
        lam(0x33373f),
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.72, 0.55);
      barrel.name = "barrel";
      body.add(barrel);
      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff6a3a }),
      );
      eye.position.set(0, 0.72, 0.44);
      eye.name = "eye";
      body.add(eye);
    } else if (kind === "spinner") {
      // a brass hub with radial blades that telescope out (danger) and in (safe)
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.5, 8),
        lam(0xb08a2a, 0x2a1e06),
      );
      hub.position.y = 0.55;
      group.add(hub);
      body = hub;
      const bladeMat = lam(0xd8dde2, 0x22262a);
      for (let i = 0; i < 4; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (i / 4) * Math.PI * 2;
        pivot.position.y = 0.55;
        pivot.name = "blade";
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, 0.12, 0.28),
          bladeMat,
        );
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
    axis: "x" | "z" = "x",
    kind: EnemyKind = "grunt",
  ): void {
    const { group, body } = this.enemyGroup(kind);
    // snap to real ground (wavy jungle floors), then remember it for resets
    const mid = (a0 + a1) / 2;
    const gx = axis === "z" ? cross : mid;
    const gz = axis === "z" ? mid : cross;
    const gy = this.floorY(gx, gz, deckY);
    group.position.set(gx, gy, gz);
    group.userData.baseY = gy;
    // sentry/spinner are stationary — collapse the patrol span so they hold post
    if (kind === "sentry" || kind === "spinner") {
      a0 = a1 = mid;
    }
    this.enemies.push({
      group,
      box: new THREE.Box3(),
      alive: true,
      x0: a0,
      x1: a1,
      dir: 1,
      speed,
      axis,
      kind,
      state: this.enemyStartState(kind),
      stateT: 0,
      baseY: gy,
      cross,
      body,
      vy: 0,
      spinKill: true,
      stompKill: true,
      meleeKill: true,
      touchHurt: true,
      spinRecoil: false,
    });
  }

  private enemyStartState(kind: EnemyKind): string {
    if (kind === "charger") return "patrol";
    if (kind === "hopper") return "crouch";
    if (kind === "floater") return "hover";
    if (kind === "sentry") return "track";
    if (kind === "spinner") return "out";
    return "patrol";
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
      if (o.name === "blade") o.scale.setScalar(1);
      if (o.name === "eye") o.scale.setScalar(1);
    });
  }

  // Facing yaw for an axis-bound walker given travel direction.
  private faceDir(e: Enemy, d: number): void {
    e.group.rotation.y =
      e.axis === "z"
        ? d > 0
          ? 0
          : Math.PI
        : d > 0
          ? Math.PI / 2
          : -Math.PI / 2;
  }

  // Back-and-forth patrol between x0/x1 along the enemy's axis (speedMul lets a
  // charger amble at half pace, etc). Returns true on a bound bounce.
  private patrolStep(e: Enemy, dt: number, speedMul = 1): boolean {
    const key = e.axis === "z" ? "z" : "x";
    e.group.position[key] += e.dir * e.speed * speedMul * dt;
    let bounced = false;
    if (e.group.position[key] > e.x1) {
      e.group.position[key] = e.x1;
      e.dir = -1;
      bounced = true;
    } else if (e.group.position[key] < e.x0) {
      e.group.position[key] = e.x0;
      e.dir = 1;
      bounced = true;
    }
    this.faceDir(e, e.dir);
    return bounced;
  }

  // player position resolved onto the enemy's own along/cross axes
  private playerAlong(e: Enemy): number {
    return e.axis === "z" ? this.playerPos.z : this.playerPos.x;
  }
  private playerCross(e: Enemy): number {
    return e.axis === "z" ? this.playerPos.x : this.playerPos.z;
  }
  private enemyAlong(e: Enemy): number {
    return e.axis === "z" ? e.group.position.z : e.group.position.x;
  }

  // Drive every foe's FSM + movement, and publish the per-frame combat flags
  // (spinKill/stompKill/meleeKill/touchHurt/spinRecoil) the player reads.
  // ONCOMING TRAFFIC. A car owns an arc position (x0, in units) on the road
  // ribbon and drives UP-course — toward the player — in the left lane
  // (cross holds the lane offset). Off the far end it wraps back downhill,
  // so the supply of traffic never runs out.
  private carStep(e: Enemy, dt: number): void {
    const r = this.roadRibbon;
    if (!r) return;
    e.x0 -= e.speed * dt;
    if (e.x0 < 40) e.x0 += r.len - 90;
    const t = e.x0 / r.len;
    const p = r.frame(t, e.cross, 0);
    const q = r.frame(Math.max(0, (e.x0 - 4) / r.len), e.cross, 0);
    e.group.position.set(p.x, p.y + 0.08, p.z);
    CAR_AIM.set(q.x, q.y + 0.08, q.z);
    e.group.lookAt(CAR_AIM);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // grunt defaults — each kind tweaks what differs
      e.spinKill = true;
      e.stompKill = true;
      e.meleeKill = true;
      e.touchHurt = true;
      e.spinRecoil = false;
      let boxW = 1.3,
        boxH = 1.1,
        cy = 0.55;
      switch (e.kind) {
        case "grunt":
          this.patrolStep(e, dt);
          break;
        case "spiker":
          this.patrolStep(e, dt);
          e.stompKill = false; // land on the spikes = you take the hit
          break;
        case "turtle":
          this.patrolStep(e, dt, 0.7);
          e.spinKill = false;
          e.spinRecoil = true; // a spin just bumps the shell
          boxH = 0.9;
          cy = 0.42;
          break;
        case "charger":
          this.chargerStep(e, dt);
          boxW = 1.45;
          break;
        case "hopper":
          this.hopperStep(e, dt);
          break;
        case "floater":
          this.floaterStep(e, dt);
          e.stompKill = false; // it flies above your feet — spin it down
          cy = 0.05;
          break;
        case "sentry":
          this.sentryStep(e, dt);
          boxW = 1.05;
          boxH = 1.15;
          cy = 0.6;
          break;
        case "spinner":
          this.spinnerStep(e, dt);
          boxW = e.state === "out" ? 2.1 : 0.8;
          cy = 0.55;
          break;
        case "car":
          this.carStep(e, dt);
          // a car is a car: nothing kills it, everything about it hurts —
          // except the roof (player.ts skims a top touch off with a pop).
          // Dims match CAR_S in buildDescent's makeCar (30% oversized).
          e.spinKill = false;
          e.stompKill = false;
          e.meleeKill = false;
          e.touchHurt = true;
          boxW = 2.7 * 1.3;
          boxH = 1.5 * 1.3;
          cy = 0.75 * 1.3;
          break;
      }
      e.box.setFromCenterAndSize(
        new THREE.Vector3(
          e.group.position.x,
          e.group.position.y + cy,
          e.group.position.z,
        ),
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
    if (e.state === "patrol") {
      e.body.rotation.x = 0;
      e.group.scale.setScalar(1);
      this.patrolStep(e, dt, 0.5);
      if (inLane && Math.abs(gap) > 2.5 && Math.abs(gap) < 26) {
        e.dir = Math.sign(gap) || 1;
        this.faceDir(e, e.dir);
        e.state = "telegraph";
        e.stateT = 0;
        sfx.play("woosh", 0.5, 0.7);
      }
    } else if (e.state === "telegraph") {
      // rear back and shudder
      e.body.rotation.x = -0.35;
      e.group.scale.setScalar(1 + Math.sin(e.stateT * 40) * 0.06);
      if (e.stateT > 0.55) {
        e.state = "dash";
        e.stateT = 0;
        e.group.scale.setScalar(1);
        sfx.play("crunch", 0.7, 0.8);
      }
    } else if (e.state === "dash") {
      e.spinKill = false;
      e.stompKill = false;
      e.meleeKill = false; // nothing stops a charge
      e.body.rotation.x = 0.3;
      const key = e.axis === "z" ? "z" : "x";
      e.group.position[key] += e.dir * e.speed * 3.4 * dt;
      const hitBound =
        e.group.position[key] >= e.x1 || e.group.position[key] <= e.x0;
      e.group.position[key] = THREE.MathUtils.clamp(
        e.group.position[key],
        e.x0,
        e.x1,
      );
      if (hitBound || e.stateT > 1.3) {
        e.state = "recover";
        e.stateT = 0;
        sfx.play("crunch", 0.6, 1.1);
      }
    } else {
      // recover: dizzy, harmless, wide open
      e.touchHurt = false;
      e.body.rotation.x = 0;
      e.group.rotation.z = Math.sin(e.stateT * 18) * 0.18;
      if (e.stateT > 1.1) {
        e.group.rotation.z = 0;
        e.state = "patrol";
        e.stateT = 0;
      }
    }
  }

  // FROG: crouches, then leaps in a forward arc. While airborne the stomp misses
  // (your feet pass under it) — spin it out of the air, or wait for the landing.
  private hopperStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    const key = e.axis === "z" ? "z" : "x";
    if (e.state === "crouch") {
      e.body.scale.set(1.15, 0.7, 1.0);
      e.body.position.y = 0.36;
      if (e.stateT > 0.45) {
        e.state = "leap";
        e.stateT = 0;
        e.vy = 8.6;
        e.body.scale.set(0.9, 1.2, 0.95);
        e.body.position.y = 0.5;
        sfx.play("woosh3", 0.4, 1.3);
      }
    } else {
      // airborne arc
      e.vy -= 24 * dt;
      e.group.position.y += e.vy * dt;
      e.group.position[key] += e.dir * e.speed * dt;
      if (e.group.position[key] > e.x1) {
        e.group.position[key] = e.x1;
        e.dir = -1;
      } else if (e.group.position[key] < e.x0) {
        e.group.position[key] = e.x0;
        e.dir = 1;
      }
      this.faceDir(e, e.dir);
      if (e.group.position.y <= e.baseY && e.vy < 0) {
        e.group.position.y = e.baseY;
        e.vy = 0;
        e.state = "crouch";
        e.stateT = 0;
        e.body.scale.set(1.15, 0.85, 1.0);
        e.body.position.y = 0.46;
        sfx.play("crunch", 0.4, 1.4);
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
    const rotor = e.group.getObjectByName("rotor");
    if (rotor) rotor.rotation.z += dt * 12;
    if (e.state === "hover") {
      e.group.position.y =
        e.baseY + hoverH + Math.sin(this.time * 3 + e.cross) * 0.18;
      const near =
        Math.abs(this.playerAlong(e) - this.enemyAlong(e)) < 12 &&
        Math.abs(this.playerCross(e) - e.cross) < 6;
      if (e.stateT > 2.6 && near) {
        e.state = "swoop";
        e.stateT = 0;
        sfx.play("woosh2", 0.5, 0.8);
      }
    } else {
      // dip toward the deck and rise back over ~0.8s
      const k = Math.sin(Math.min(1, e.stateT / 0.8) * Math.PI);
      e.group.position.y = e.baseY + hoverH - k * (hoverH - 0.35);
      if (e.stateT > 0.8) {
        e.state = "hover";
        e.stateT = 0;
      }
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
    const eye = head.getObjectByName("eye");
    const inRange = Math.hypot(dx, dz) < 44;
    if (e.state === "track") {
      if (eye) eye.scale.setScalar(1);
      if (e.stateT > 1.3 && inRange) {
        e.state = "charge";
        e.stateT = 0;
      }
    } else if (e.state === "charge") {
      if (eye) eye.scale.setScalar(1 + e.stateT * 2.4);
      if (e.stateT > 0.55) {
        e.state = "fire";
        e.stateT = 0;
        const muzzle = new THREE.Vector3(
          e.group.position.x + Math.sin(head.rotation.y) * 0.8,
          e.group.position.y + 0.72,
          e.group.position.z + Math.cos(head.rotation.y) * 0.8,
        );
        this.spawnProjectile(
          muzzle,
          new THREE.Vector3(
            this.playerPos.x,
            this.playerPos.y + 0.7,
            this.playerPos.z,
          ),
        );
      }
    } else if (e.state === "fire") {
      if (eye) eye.scale.setScalar(1);
      if (e.stateT > 0.15) {
        e.state = "cooldown";
        e.stateT = 0;
      }
    } else {
      if (e.stateT > 0.7) {
        e.state = "track";
        e.stateT = 0;
      }
    }
  }

  // SAWBLADE: blades telescope OUT (spinning, untouchable, touch-kill) then IN
  // (retracted, dead-still window where any attack finishes it). Pure timing.
  private spinnerStep(e: Enemy, dt: number): void {
    e.stateT += dt;
    if (e.state === "out") {
      e.body.rotation.y += dt * 9;
      e.spinKill = false;
      e.stompKill = false;
      e.meleeKill = false;
      e.touchHurt = true;
      if (e.stateT > 2.2) {
        e.state = "in";
        e.stateT = 0;
        sfx.play("woosh", 0.4, 1.6);
      }
    } else {
      e.body.rotation.y += dt * 1.5;
      e.touchHurt = false; // retracted: safe to brush, wide open to any hit
      if (e.stateT > 1.35) {
        e.state = "out";
        e.stateT = 0;
        sfx.play("woosh2", 0.4, 0.7);
      }
    }
    // lerp the blades over the first 0.2s of a state change for a mechanical feel
    const cur =
      e.state === "out"
        ? Math.min(1, 0.2 + e.stateT * 4)
        : Math.max(0.2, 1 - e.stateT * 4);
    e.group.traverse((o) => {
      if (o.name === "blade") o.scale.x = cur;
    });
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
    sfx.play("woosh2", 0.55, 1.5);
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.mesh.rotation.x += dt * 6;
      pr.mesh.rotation.y += dt * 4;
      pr.box.setFromCenterAndSize(
        pr.mesh.position,
        new THREE.Vector3(0.7, 0.7, 0.7),
      );
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
    // WUMPA_SIZE, like every other wumpa in the game — see the note on it.
    // The pickup box below is untouched: how big the fruit LOOKS and how
    // generous it is to grab are separate questions.
    const mesh = wumpaMesh(WUMPA_SIZE);
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
      this.pickup(
        x,
        y,
        THREE.MathUtils.lerp(z0, z1, n === 1 ? 0 : i / (n - 1)),
      );
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
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        emissive: 0x123049,
        map: this.cpTexture(),
      }),
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

  // Level 6, "The Flats": a gigantic featureless slab for movement testing.
  // No gaps, no hazards, no finish — walls only at the far perimeter, so
  // there is nothing to fall off. Marker posts along the axes give bearings.
  private buildFlats(): void {
    // Tropical resort noon over an endless blacktop lot: high sun, turquoise
    // horizon haze, parking-bay stripes to give the eye a texel scale.
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // asphalt is full-colour
    // The Flats now floats as an elevated SKY-DECK over the sunset cloud sea:
    // a narrow-ish runway lifted to y=E, so past the deck edges you look DOWN
    // onto the below-horizon cloud detail instead of endless asphalt. Skate off
    // an edge and you drop into the sea (respawn).
    const E = 90; // deck elevation over the sea
    this.spawnPos.set(0, E + 0.1, 40);
    this.killY = E - 28; // below the deck: skate off the edge and you splash in
    // The run does not stop at the rail garden any more: the deck opens out
    // into the pipe park at its far end, and the line is drawn past THAT.
    this.finishZ = -420;
    this.endWallZ = -450;
    this.theme = {
      skyTop: "#159ecd",
      skyBottom: "#c9f0e4",
      sunColorHex: "#fff8dc",
      sunU: 0.68,
      sunV: 0.14,
      stars: false,
      fog: 0xbee8dd, // turquoise haze
      // The run is 460 units end to end now, so the haze has to reach: at the
      // old 320 the pipe park was a ghost from halfway down the runway. 400 is
      // the play draw distance, so this fades things out exactly as they clip.
      fogNear: 110,
      fogFar: 400,
      hemiSky: 0xeafcff,
      hemiGround: 0x94a294,
      hemiI: 1.2,
      sunColor: 0xfff6dc,
      sunI: 1.55,
      particleColor: 0xffffff,
      particleWind: [0.5, -0.3, 0.2],
    };
    // a finite runway deck (was a 4km lot); no 2km perimeter walls — the edges
    // just drop away to the sea on both sides.
    this.slab("the flats", 100, -250, E, 84, mat, false, 0, "asphalt");
    // --- wallride walls: tall faces just west of spawn. Skate at one, ollie (X)
    // and HOLD GRIND (E) to stick and ride along it, jump to kick off. Two
    // parallel walls let you transfer wall-to-wall. Doubled height (10) so the
    // wallie pop has room to climb the face.
    this.wall(-16, 0, 1.2, 70, E, 10);
    this.wall(-32, 0, 1.2, 70, E, 10);
    // a cross wall to the NE, for wallriding along the other axis
    this.wall(12, 28, 34, 1.2, E, 10);

    // --- rail garden: practice lines just south of spawn -------------------
    const V = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z);
    // flat starter rail (0.9 above the deck: crates on the line DO clip a
    // grinder)
    const flatRail = new Rail([V(5, E + 0.9, -25), V(5, E + 0.9, -85)]);
    // sloped rail: grind it up to a high dismount (or bomb it back down)
    const slopeRail = new Rail([V(12, E + 0.9, -25), V(12, E + 6.5, -95)]);
    // three staggered parallel rails — hop rail-to-rail without touching down
    const parA = new Rail([V(-6, E + 0.9, -25), V(-6, E + 0.9, -110)]);
    const parB = new Rail([V(-10, E + 0.9, -40), V(-10, E + 0.9, -125)]);
    const parC = new Rail([V(-14, E + 0.9, -55), V(-14, E + 0.9, -140)]);
    for (const r of [flatRail, slopeRail, parA, parB, parC]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    // crates in the lanes between the parallel rails (smash practice)
    for (let z = -48; z >= -108; z -= 12) {
      this.crate(-8, E, z);
      this.crate(-12, E, z + 6);
    }
    // crates ON the center rail line: plain ones punish slow grinds, the
    // mask crate always pops (grind-through reward)
    this.crate(-10, E, -70);
    this.crate(-10, E, -100, "mask");
    // arrow crates with their classic floating fruit crate above
    this.crate(9, E, -40, "bouncy");
    this.crate(-2, E, -60, "bouncy");
    // a TNT and a nitro for blast testing, well apart
    this.crate(16, E, -60, "tnt");
    this.crate(20, E, -75, "nitro");

    // --- ramp staircase: seven ramps of increasing steepness ---------------
    // grades 0.15 (8.5 deg) up to 1.9 (62 deg): walk, roll, and pump tests.
    const matRampF = new THREE.MeshLambertMaterial({ color: 0xaab4ba }); // skatepark concrete
    const grades = [0.15, 0.3, 0.5, 0.75, 1.0, 1.4, 1.9];
    for (let i = 0; i < grades.length; i++) {
      const x = -36 + i * 12; // spread ACROSS the narrow deck, not far off to the side
      const len = 8;
      this.ramp(
        `test ramp ${i + 1}`,
        -148,
        E,
        -148 - len,
        E + grades[i] * len,
        5,
        matRampF,
        x,
        "pavement",
      );
    }

    // --- dressing: palms lining the deck edges (elevated with the lot) ------
    for (let i = 0; i < 6; i++) {
      const z = 40 - i * 55;
      this.palm(-38, E, z, 5 + (i % 3) * 0.6, i % 2 === 0 ? 0.12 : -0.1);
      this.palm(38, E, z - 20, 5.3 - (i % 2) * 0.5, i % 2 === 0 ? -0.1 : 0.12);
    }
    for (let i = 0; i < 5; i++) {
      this.palm(-32 + i * 16, E, 70, 4.8 + (i % 2) * 0.7, 0.1 - (i % 3) * 0.08);
    }
    // --- foe sampler: one of each takedown, lined up down the centre lane past
    // the trick lanes (rail garden/ramps sit at x -20..115, z 0..-160) --------
    this.enemy(-6, 6, E, -166, 4, "x", "grunt");
    this.enemy(-6, 6, E, -172, 4, "x", "spiker"); // spin
    this.enemy(-6, 6, E, -178, 3, "x", "turtle"); // stomp
    this.enemy(-12, 12, E, -184, 5, "x", "charger"); // bull runway
    this.enemy(-6, 6, E, -190, 4, "x", "hopper");
    this.enemy(-8, 8, E, -196, 3.5, "x", "floater");
    this.enemy(0, 0, E, -175, 0, "x", "sentry"); // turret watching the lane
    this.enemy(0, 0, E, -187, 0, "x", "spinner");
    // planter islands, tucked at the deck corners (elevated with the lot)
    for (const [ix, iz] of [
      [-36, -30],
      [36, -110],
      [-34, 84],
    ] as const) {
      this.rock(ix, E, iz, 2.2);
      this.palm(ix + 2.5, E, iz + 2, 5.8, -0.12);
      this.fern(ix - 2.2, E, iz - 1.5, 1.3);
      this.fern(ix + 1.8, E, iz - 2.6, 1.1);
      this.flowers(ix - 1.5, E, iz + 2.2);
      this.planter(ix + 4, E, iz - 1);
    }
    // ...and the runway opens out into the pipe park, flush with the deck end.
    this.pipePark(E, -310);
  }

  // THE PIPE PARK: the far end of the runway opens out into a transition yard —
  // two halfpipes right up against each other (a shared coping ridge, a "W" you
  // can pump one side and drop the other), a neighbouring pair rotated 90° so
  // you can transfer between orientations, and a deep pool.
  //
  // This used to be its own level at ground height. It is the same yard, lifted
  // onto the sky-deck (baseY) and pushed down-course (dz) so it sits flush with
  // the end of the flats runway — one place instead of two. Its north perimeter
  // wall is gone: that edge is now the doorway you skate in through.
  private pipePark(baseY: number, dz: number): void {
    const ground = new THREE.MeshLambertMaterial({ color: 0xffffff }); // full-colour asphalt
    this.slab(
      "pipe park floor",
      60 + dz,
      -120 + dz,
      baseY,
      130,
      ground,
      false,
      0,
      "asphalt",
    );
    this.wall(0, -118 + dz, 130, 4, baseY, 6); // south backstop
    this.wall(64, -30 + dz, 4, 180, baseY, 6); // side rails keep you out of the sea
    this.wall(-64, -30 + dz, 4, 180, baseY, 6);

    const F = 3;
    const R = 6; // lipX = 9, coping at y = 6, each pipe 18 wide
    const lipY = R;
    // Every transition in the park is the same editor component. A straight,
    // axis-aligned, 90° half comes up on the analytic backing — full lip-trick,
    // pendulum and spine-transfer physics — and brings its own coping rails.
    const addPipe = (
      len: number,
      cross: number,
      alongZ: boolean,
      mid = 0,
    ): void => {
      this.buildVertRamp({
        t: "vertramp",
        p: alongZ ? [cross, baseY, mid + dz] : [mid, baseY, cross + dz],
        len,
        w: F,
        rise: R,
        vkind: "half",
        yaw: alongZ ? 0 : 90,
        color: "#aab4ba",
      });
    };

    // --- PAIR 1: two pipes running along Z, right up against each other -------
    // A centred at x -9, B at x +9 → their inner copings meet at x 0 (a shared
    // ridge). Troughs at x -9 and x +9.
    addPipe(40, -9, true);
    addPipe(40, 9, true);
    // fruit lines down each trough, and the level's crystal on the shared ridge
    for (const cx of [-9, 9])
      for (let z = 14; z >= -14; z -= 7) this.pickup(cx, baseY + 0.4, z + dz);
    this.crystal(0, baseY + lipY + 0.6, dz);

    // --- PAIR 2: two more pipes rotated 90° (running along X), neighbouring ----
    // C centred at z -38, D at z -56 → shared ridge at z -47. Length x -18 → 18.
    addPipe(36, -38, false);
    addPipe(36, -56, false);
    for (const cz of [-38, -56])
      for (let x = -14; x <= 14; x += 7) this.pickup(x, baseY + 0.4, cz + dz);

    // --- a few foes on the SIDE flats, clear of the pipe runs (|x| < 18) ------
    this.enemy(26, 44, baseY, -10 + dz, 4, "x", "grunt"); // patrols the east flat
    this.enemy(-44, -26, baseY, -30 + dz, 3.5, "x", "floater"); // drifts the west flat
    this.enemy(38, 38, baseY, -47 + dz, 0, "x", "spinner"); // blades parked off the ridge

    // --- THE POOL: the same vert part, drawn as one spine round a rounded
    // rectangle — four walls joined by curved corners, which is what "bowl
    // parts like corners" means here: a corner is just a quarter swept along a
    // filleted bend. Airs ride the TRACKED vert hang around the bends (the
    // analytic pipes can't corner; a swept spine can). The path stops 3 units
    // either side of x=0 on the north rim, and THAT GAP IS THE CHANNEL you
    // roll in through — no special-case taper, just where the spine ends.
    // R 10 to 60 degrees (lip ~5): a DEEP pool. Cresting from a flat run-up is
    // out of reach; the loop is pump the walls, pop X at the lip for the
    // tracked hang, land rolling, pump again.
    this.buildVertRamp({
      t: "vertramp",
      p: [0, baseY + 0.01, -87 + dz],
      // ordered so the sweep's lateral points OUT of the bowl
      pts: [
        [-3, 8],
        [-13, 8, 5],
        [-13, -8, 5],
        [13, -8, 5],
        [13, 8, 5],
        [3, 8],
      ],
      w: 0, // the transition starts right at the floor edge
      rise: 10,
      arc: 60,
      deck: 2.3, // pool rules: crest un-popped and you land ON the rim
      vkind: "quarter",
      color: "#aab4ba",
    });
    for (let a = 0; a < 8; a++) {
      const th = (a / 8) * Math.PI * 2;
      this.pickup(Math.cos(th) * 7, baseY + 0.4, -87 + dz + Math.sin(th) * 4.5);
    }

    // x 36, not 0. The line still lands past the pool at the south wall, but
    // NOT on the centre line: the pool's south rim stands 5 proud of the deck
    // and the backstop wall is only 10 further on, so a centred pad sat in a
    // slot too tight to even get a camera into — you met it with a wall in your
    // face. The old gate got away with it by being tall enough to see over the
    // rim; a pad a third that height cannot. 36 is on the open asphalt outside
    // the pool's ±24 footprint, with a clear sightline the length of the park.
    this.finishGate(baseY, this.finishZ, 36);
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
      skyTop: "#8fbfe6",
      skyBottom: "#f2f6f8",
      sunColorHex: "#fff4d8",
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
        this.patterned(
          new THREE.MeshLambertMaterial({ color: slippy ? iceCol : woodCol }),
          w,
          d,
          "wood",
        ),
      );
      mesh.position.set(0, -0.25, z);
      mesh.name = slippy ? "slippy plank" : "plank";
      if (slippy) mesh.userData.slippy = true;
      this.root.add(mesh);
      this.groundMeshes.push(mesh);
      return mesh;
    };
    const breakOnLand = (z: number, d = 2): void =>
      void this.crumblePad(0, 0, z, W, d, null, 0.02, 0xcf6a48);
    const breakSoon = (z: number, d = 2): void =>
      void this.crumblePad(0, 0, z, W, d, null, 0.7, 0xd0a24a);

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
    this.enemy(-2, 2, 0, -45, 3.2, "x", "floater");
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
    this.enemy(-2, 2, 0, -96, 4, "x", "spiker");
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

  // ---- THE NIGHTWORKS: platforming in the dark ---------------------------
  //
  // No skating course, no lines to carve — a machine hall at night where the
  // only ground is machinery on a cycle and the only light is fire. Every
  // hazard is a TIMING hazard, so the level is really one long lesson in
  // reading a rhythm, taught the classic way: one idea per section, on its
  // own, then two at once, then everything.
  //
  // The course is a CLIMBING ZIGZAG — ten hard turns, y0 at the dock to y70
  // at the summit gate. The -z stretches ride a camera lane (the frame and
  // the controls swing round the bend, radius 14 so the swing leads you in);
  // the CROSS-stretches are travel ZONES — classic side-scroll platforming
  // where the camera never yaws at all — and every corner isle runs long in
  // the outgoing direction so the frame has settled before the first
  // obstacle asks for a jump. Every ferry and lift carries a burning brazier
  // (a mover in the dark IS a moving light), and the phase pads run ONE
  // metronome in two teams — AMBER lit while BLUE is dark, then they trade.
  //
  //   A  fire-ferries out                                       (-z)
  //   B  the lift bank                SIDE-SCROLL LEFT   (-x)  y0->12
  //   C  the pad metronome                  turn RIGHT   (-z)
  //   D  GRAND RAILS over pure void          SWITCHBACK  (+x)
  //   E  the ferry line + the lift stair     turn RIGHT  (-z)  y12->26
  //   F  rope ferries over pure void   SIDE-SCROLL LEFT   (-x)
  //   G  metronome II, a ferry, up again     turn RIGHT  (-z)  y26->34
  //   H  the lift tower               SIDE-SCROLL RIGHT  (+x)  y34->56
  //   I  the long rail, moving landing       turn RIGHT  (-z)
  //   J  everything on the beat       SIDE-SCROLL LEFT   (-x)  y56->64
  //   K  last lift, last swing, summit       turn RIGHT  (-z)  y64->70
  //
  // No safety floor under the rails or the ropes: they ARE the route, with a
  // checkpoint right before each crossing so the void costs seconds, not
  // progress.
  private buildNightworks(): void {
    this.skyPreset = "night";
    this.keepPlayFog = true; // the dark eats the course: no seeing three sections over
    this.killY = -26; // a long, quiet drop off any edge — even from the summit
    this.finishZ = -353;
    this.endWallZ = -376;
    this.wallTint = 0x2a2f3c;
    this.blockTint = 0x333a48;
    this.theme = {
      skyTop: "#03060f",
      skyBottom: "#0b1226",
      sunColorHex: "", // no disc: the only light in this place is on fire
      sunU: 0.5,
      sunV: 0.5,
      stars: true,
      fog: 0x05070f, // near-black: an island is a glow before it is a shape
      fogNear: 12,
      fogFar: 58, // the parallel stretch across the void is a rumour, not a view
      hemiSky: 0x24304e,
      hemiGround: 0x12151f,
      hemiI: 0.62, // dark, not blind: unlit stone still reads as stone
      sunColor: 0x6f8cd4,
      sunI: 0.68,
      particleColor: 0xff9a3c, // embers rising off the works
      particleWind: [0.12, 0.55, 0.05],
    };

    const stoneMat = new THREE.MeshLambertMaterial({
      color: 0x6d7484,
      emissive: 0x10131c, // a whisper of self-light so unlit stone never goes full black
    });
    // An island of solid stone, lit at its corners. Safe ground, and the only
    // place in the level you can stop and read what's coming.
    const isle = (
      z: number,
      w: number,
      d: number,
      x = 0,
      y = 0,
      torchH = 2.2,
    ): void => {
      this.slab("platform", z + d / 2, z - d / 2, y, w, stoneMat, false, x, "stone");
      this.torch(x - w / 2 + 0.7, y, z + d / 2 - 0.7, torchH);
      this.torch(x + w / 2 - 0.7, y, z - d / 2 + 0.7, torchH);
    };
    // A GANTRY PAD: the small fixed footing that keeps the rail and rope
    // sections honest. Every one carries a fire, because in this level a
    // light IS the promise that there's something to land on.
    const ledge = (x: number, z: number, y = 3, s = 4.5): void => {
      this.slab("platform", z + s / 2, z - s / 2, y, s, stoneMat, false, x, "stone");
      // fire at the BACK corner: it marks the pad from a distance without
      // standing in the middle of the only place you have to land
      this.torch(x + s / 2 - 0.6, y, z + s / 2 - 0.6, 1.5, 0.8);
    };

    // The two pad teams, one metronome: same clock, half a turn apart, with
    // a beat of overlap where both stand. AMBER = phase 0, BLUE = phase 0.5
    // (the pad derives its colour from its phase, so the teams read on sight).
    // Duty EXACTLY half: the teams hand over cleanly, so at every instant one
    // set is solid and the other is genuinely gone. (At 0.55 they overlapped
    // for a fifth of a second and every pad in the row stood at once — which
    // is what "half of them don't disappear" was: the trade never looked like
    // anything left.) The 0.9s warning strobe is the fairness, not an overlap.
    const padA = (x: number, y: number, z: number, s = 5): void =>
      this.phasePad(x, y, z, s, s, 4.4, 0, 0.5);
    const padB = (x: number, y: number, z: number, s = 5): void =>
      this.phasePad(x, y, z, s, s, 4.4, 0.5, 0.5);
    // Every mover in this level burns: warm iron deck + a brazier riding it.
    const fmover = (
      x: number,
      y: number,
      z: number,
      w: number,
      d: number,
      axis: "x" | "y" | "z",
      amp: number,
      speed: number,
      phase = 0,
    ): void => this.mover(x, y, z, w, d, axis, amp, speed, phase, true);
    // SIDE-SCROLL STRETCHES: inside a travel zone the course itself runs
    // along X and the camera never yaws — the cross-stretches become classic
    // side-scroll platforming with NO swing to wait for. The lane handles the
    // -z stretches; the zones handle the crossings.
    const sideScroll = (
      xMin: number,
      xMax: number,
      zMin: number,
      zMax: number,
      dir: "E" | "W",
    ): void => {
      this.zones.push({ xMin, xMax, zMin, zMax, dir });
    };

    // --- start: a wide lit dock, and the dark ahead --------------------------
    isle(2, 11, 12, 0, 0, 2.6);
    this.spawnPos.set(0, 0.1, 4);
    this.currentSpawn.copy(this.spawnPos);
    this.torch(-4.4, 0, 7.2, 2.6);
    this.torch(4.4, 0, 7.2, 2.6);

    // --- A (out, -z): fire-ferries ------------------------------------------
    fmover(0, 0, -10, 5, 5, "x", 5.5, 0.5, 0);
    fmover(0, 0, -19, 5, 5, "x", 6, 0.55, Math.PI);
    fmover(0, 0, -28, 4.5, 4.5, "x", 6, 0.6, Math.PI / 2);
    this.pickup(0, 1.3, -19);
    isle(-36, 10, 10, 0, 0, 2.6); // the landing off the ferries...
    // ...and the corner slab runs WEST — a real runway toward the lift bank,
    // so the frame has finished its business before the first lift asks
    isle(-46, 16, 10, 0, 0, 2.6);
    this.checkpoint(0, -44);

    // --- B (LEFT, -x, SIDE-SCROLL): the lift bank, y0 -> y12 ----------------
    // A ZONE SPANS NODE TO NODE IN X, AND IS TIGHT TO THE CROSS LEG IN Z.
    // That rule is what keeps the spine and the zone from fighting, and it is
    // worth stating once here because all four side-scroll zones follow it.
    //
    // The lane's corner arc and the zone both want to own the frame. The arc
    // eases the camera toward the corner; the zone forces it back to facing
    // down-course, because that IS the side-scroll shot. Measured at this
    // corner, the lane was asking for -45 degrees and the zone snapped it back
    // to 0 four units later — swing out, snap back, on every cross-stretch.
    //
    // The fix is not to shrink the arc (that only makes the snap sharper) or
    // to swallow the bend (that reaches back onto the -Z approach and swaps
    // the stick while you are still running forward). It is to start the zone
    // AT THE CORNER NODE, where the arc has not begun yet and the lane is
    // still pointing straight down-course — the same thing the zone forces.
    // The handover is then continuous, and the whole arc lives inside the
    // zone where nothing reads it.
    //
    // In z the zone hugs the cross leg only, so the -Z approach never enters
    // it: this leg sits at z -48 and the approach corridor ends at z -41.
    sideScroll(-47, 0, -54, -42, "W");
    fmover(-11, 1, -45, 4.5, 4.5, "y", 3.2, 0.7, 0);
    fmover(-19, 4, -51, 4.5, 4.5, "y", 3.4, 0.7, Math.PI);
    fmover(-27, 7, -45, 4.5, 4.5, "y", 3.2, 0.75, Math.PI / 2);
    fmover(-35, 10, -51, 4.5, 4.5, "y", 3.0, 0.65, 0);
    this.pickup(-27, 9, -45);
    // corner isle runs LONG down-course: the camera finishes its swing while
    // you cross it, before the first pad ever asks for a jump
    isle(-51, 16, 16, -47, 12);
    this.checkpoint(12, -48, -47);

    // --- C (RIGHT, -z): the pad metronome, y12 ------------------------------
    padA(-47, 12, -64);
    padB(-47, 12, -72);
    padA(-47, 12, -80);
    this.pickup(-47, 13.3, -72);
    ledge(-47, -87, 12, 5);
    padA(-50.2, 12, -95, 4.4);
    padB(-43.8, 12, -95, 4.4);
    padB(-50.2, 12, -103, 4.4);
    padA(-43.8, 12, -103, 4.4);
    isle(-112, 16, 14, -47, 12);
    this.checkpoint(12, -112, -47);
    // The switchback is the BIGGEST swing in the level, so its runway is the
    // longest: a mount platform reaching east under the first rail's near
    // end — walk it while the camera comes round, then ollie onto the bar
    // anywhere along it.
    this.slab("platform", -105, -119, 12, 8, stoneMat, false, -35, "stone");
    this.torch(-31.8, 12, -105.8, 1.5, 0.8);

    // --- D (SWITCHBACK, +x): THE GRAND RAILS, y12 ---------------------------
    // Two 22u travelling rails over pure void, in strict antiphase: twice a
    // cycle their inner ends sweep past each other at the centre line — THAT
    // is the hop. Miss it and you ride your rail back out over the dark.
    this.movingRail(-29, 13.7, -112, 22, 90, "z", 6.5, 0.6, 0);
    this.movingRail(-7, 13.7, -112, 22, 90, "z", 6.5, 0.6, Math.PI);
    this.pickup(-18, 15.4, -112); // hangs exactly over the crossing point
    isle(-112, 12, 20, 10, 12); // long landing: settle before the ferry line
    this.checkpoint(12, -112, 10);

    // --- E (RIGHT, -z): the ferry line, then the lift stair, y12 -> y26 -----
    // Sit the ferry out over the void, TIME the hop onto the rail sweeping
    // crosswise, ride it down the dark, drop to the second ferry — then climb
    // a staircase of burning lifts to the high deck.
    fmover(10, 12, -130, 5, 5, "z", 6, 0.55, 0);
    this.movingRail(10, 13.7, -147, 14, 0, "x", 5, 0.55, Math.PI / 2);
    this.pickup(10, 15.4, -147);
    fmover(10, 12, -159, 5, 5, "z", 4.5, 0.5, Math.PI);
    isle(-170, 12, 10, 10, 12);
    this.checkpoint(12, -170, 10);
    fmover(10, 14, -180, 4.5, 4.5, "y", 3, 0.7, 0);
    fmover(10, 17.5, -185, 4.5, 4.5, "y", 3, 0.7, Math.PI);
    fmover(10, 21, -190, 4.5, 4.5, "y", 3, 0.75, Math.PI / 2);
    fmover(10, 24.5, -195, 4.5, 4.5, "y", 3, 0.65, 0);
    isle(-202, 20, 10, 8, 26); // a REAL west runway: the first rope's arc crosses its lip
    this.checkpoint(26, -202, 10);

    // --- F (LEFT, -x, SIDE-SCROLL): rope ferries over pure void, y26 --------
    // The ropes swing AND ferry along x, so the whole crossing plays flat
    // against the screen like the lift banks.
    //
    // NODE TO NODE, like B, H and J: x -48..10 spans the cross leg's own two
    // corner nodes, and z -208..-197 is exactly the runway isle. That is the
    // rule, and F used to be the one exception to it — the zone stopped at the
    // runway's west lip (x -2) so that the lift stair could drop you onto the
    // runway at x 10 with your own frame instead of a swapped stick.
    //
    // The reason it had to be an exception is gone. The stair lands you at the
    // corner node, so entering the zone meant flipping the travel frame WHILE
    // AIRBORNE, and that flip zeroes your speed — it dropped you into the void
    // short of the runway. The frame flip now waits for touchdown (player.ts),
    // so you fly the last hop on the momentum you left the lift with, land on
    // the runway, and the crossing's frame takes over under your feet.
    //
    // Getting the exception back costs nothing and buys the framing: with the
    // corner inside the zone, the spine's arc is never visible to the rig, so
    // the camera holds straight down -Z across the whole crossing instead of
    // swinging 81 degrees out and unwinding again over those 12 units.
    sideScroll(-48, 10, -208, -197, "W");
    this.ropeSwing(-8, 34.6, -202, 7, 0.7, 0, 0, 0, "x", 5.5, 0.45, 0);
    this.ropeSwing(-22, 34.6, -202, 7, 0.7, 0, Math.PI, 0, "x", 5.5, 0.45, Math.PI);
    this.ropeSwing(-36, 34.6, -202, 7, 0.75, 0, 0, 0, "x", 5.5, 0.4, Math.PI / 2);
    this.torch(-8, 32.2, -204.6, 1.0, 0.8); // beacons under the anchor line
    this.torch(-22, 32.2, -204.6, 1.0, 0.8);
    this.torch(-36, 32.2, -204.6, 1.0, 0.8);
    this.pickup(-22, 29.5, -202);
    isle(-202, 12, 16, -48, 26); // long south runway into metronome II
    this.checkpoint(26, -202, -48);

    // --- G (RIGHT, -z): metronome II, a ferry, then up again, y26 -> y34 ----
    padA(-48, 26, -216);
    padB(-48, 26, -224);
    this.pickup(-48, 27.3, -224);
    fmover(-48, 26, -233, 4.5, 4.5, "z", 5, 0.5, 0);
    padA(-51.2, 26, -246, 4.4);
    padB(-44.8, 26, -246, 4.4);
    padB(-51.2, 26, -254, 4.4);
    padA(-44.8, 26, -254, 4.4);
    fmover(-48, 28, -262, 4.5, 4.5, "y", 3, 0.7, 0);
    fmover(-48, 32.5, -268, 4.5, 4.5, "y", 3, 0.7, Math.PI);
    isle(-278, 12, 12, -48, 34);
    this.checkpoint(34, -278, -48);

    // --- H (SWITCHBACK, +x, SIDE-SCROLL): the lift tower, y34 -> y56 --------
    // Eight burning lifts, each a step higher — the long climb, played flat
    // against the screen like the classic towers.
    sideScroll(-48, 9, -284, -272, "E"); // node to node (x -48..9), tight to the leg — see the note on B
    fmover(-41, 36, -275, 4.5, 4.5, "y", 2.75, 0.7, 0);
    fmover(-35, 38.75, -281, 4.5, 4.5, "y", 2.75, 0.7, Math.PI);
    fmover(-29, 41.5, -275, 4.5, 4.5, "y", 2.75, 0.75, Math.PI / 2);
    fmover(-23, 44.25, -281, 4.5, 4.5, "y", 2.75, 0.65, 0);
    fmover(-17, 47, -275, 4.5, 4.5, "y", 2.75, 0.7, Math.PI / 2);
    fmover(-11, 49.75, -281, 4.5, 4.5, "y", 2.75, 0.7, Math.PI);
    fmover(-5, 52.5, -275, 4.5, 4.5, "y", 2.75, 0.75, 0);
    fmover(1, 55.25, -281, 4.5, 4.5, "y", 2.75, 0.65, Math.PI / 2);
    this.pickup(-17, 51, -275);
    isle(-278, 12, 16, 9, 56); // long south runway into the long rail
    this.checkpoint(56, -278, 9);

    // --- I (RIGHT, -z): the long rail with a MOVING destination, y56 --------
    // 24 units of grind over nothing, sweeping side to side — and the landing
    // is a big fire-lit isle that is ITSELF a mover. Time the dismount for
    // when it swings under the rail's end, or scramble mid-air for it.
    this.movingRail(9, 57.7, -296, 24, 0, "x", 6, 0.5, 0);
    this.pickup(9, 59.4, -296);
    fmover(9, 56, -314, 6, 6, "x", 7, 0.4, Math.PI / 2);
    isle(-324, 12, 10, 9, 56);
    this.checkpoint(56, -324, 9);

    // --- J (LEFT, -x, SIDE-SCROLL): everything on the beat, y56 -> y64 ------
    sideScroll(-43, 9, -330, -318, "W"); // node to node (x -43..9), tight to the leg — see the note on B
    padB(-2, 56, -324);
    fmover(-9.5, 56, -324, 4.5, 4.5, "x", 4, 0.6, 0);
    this.movingRail(-19, 57.7, -324, 10, 90, "z", 4, 0.6, Math.PI / 2);
    this.pickup(-19, 59.4, -324);
    fmover(-29, 58, -324, 4.5, 4.5, "y", 2, 0.7, Math.PI);
    fmover(-35, 62, -324, 4.5, 4.5, "y", 2.5, 0.7, 0);
    isle(-324, 10, 14, -43, 64); // runs south toward the last lift: the swing out of the side-scroll happens on stone
    this.checkpoint(64, -324, -43);

    // --- K (RIGHT, -z): the last lift, one last swing, y64 -> y70 -----------
    fmover(-43, 68, -334, 4.5, 4.5, "y", 2.5, 1.0, 0); // quick cycle: the two rhythms align often
    // A rope cannot be leapt TO on foot — it has to come to YOU. Hung so the
    // pendulum's inbound tip sweeps right across the lift's column at hop
    // height: ride the lift near its top, hop as the rope arrives, done.
    this.ropeSwing(-43, 75.8, -338.5, 7.4, 0.8, 0, 0, 90); // swings down-course

    // --- goal: the summit of the works, lit up ------------------------------
    isle(-353, 14, 12, -43, 70, 3.2);
    this.torch(-48, 70, -356, 3.2);
    this.torch(-38, 70, -356, 3.2);
    this.crystal(-43, 70.6, -350);
    this.finishGate(70, this.finishZ, -43);

    // --- THE CAMERA SPINE ----------------------------------------------------
    // The -z stretches ride the lane; the cross-stretches are ZONES and never
    // swing at all. Every corner isle runs long in the outgoing direction, so
    // the frame has settled before the first obstacle asks for a jump.
    //
    // CORNER RADIUS 5, and the number matters more than it looks. The lane's
    // tangent is not just the camera — the CONTROL FRAME eases onto it too
    // (player.ts, axisF), so screen-up is whatever the spine says. A corner
    // radius is therefore how far back up the straight the steering starts
    // turning, and these corner isles are only 10-20 units across.
    //
    // It was 9, and I raised it to 14 "so the swing starts well before the
    // corner, leading you into the next stretch" — thinking about the camera
    // and forgetting the stick rides the same tangent. Measured, that put the
    // A->B lane 17 degrees off straight at z -40 and 31 at z -44, on a
    // corridor slab that runs dead straight to z -41. You hold forward on a
    // visibly straight platform and get walked sideways off it. At I->J the
    // two 14s ate a 46-unit leg from both ends and left almost no straight at
    // all. Five keeps the arc inside the corner isle where the turn actually
    // happens; the camera still eases (camF lerps at 3.5/s in main.ts), it
    // just no longer starts turning you a bus-length early.
    const laneNodes: [number, number, number, number][] = [
      [0, 10, 0, 0], // behind spawn
      [0, -48, 5, 0], // A->B: left into the side-scroll
      [-47, -48, 5, 12], // B->C: right, onto the mid deck
      [-47, -112, 5, 12], // C->D: the first switchback
      [10, -112, 5, 12], // D->E: right
      [10, -202, 5, 26], // E->F: left, up the lift stair
      [-48, -202, 5, 26], // F->G: right
      [-48, -278, 5, 34], // G->H: the tower switchback
      [9, -278, 5, 56], // H->I: right, off the tower
      [9, -324, 5, 56], // I->J: left into the last side-scroll
      [-43, -324, 5, 64], // J->K: right
      [-43, -363, 0, 70], // out through the gate at the summit
    ];
    const rp = roundCorners(laneNodes, false);
    this.lanePts = rp.map((q) => ({ x: q.x, y: q.y, z: q.z }));
    this.measureLane();
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
  //
  // Every ribbon is the SAME vert part the skateparks are built from, drawn
  // along a spline of xyz nodes: a shallow half section (radius 3 through 53°)
  // whose two lips are the slide's gutters, banked by the auto-lean plus a
  // per-node roll where the course wants a corkscrew or a velodrome wall.
  // It opts OUT of the vert flag — the deck between the gutters is a road, not
  // a trough — so the ordinary surface-tangent riding does all the work: dips
  // feed speed, crests pop airs, and the gutter lips carve like a slide.
  //
  // frame(t, off, h): a world point `off` across the banked deck and `h`
  // above it — the exact surface the mesh was swept from, so edge rails,
  // crates and fruit all sit on the geometry rather than near it.
  private slideRibbon(
    pts: THREE.Vector3[],
    width = 12,
    color = 0x3ec8d8,
    roll?: number[], // per-node bank in DEGREES, one per point (0 where omitted)
    bank = 42, // auto-lean gain: how hard the deck rolls into its own turns
    tex = "stone", // surface texture kind — The Descent runs on asphalt
    lip = true, // slide gutters at the edges; false = a flat ROAD deck
  ): SlideRibbon {
    const r2v = (n: number): number => Math.round(n * 100) / 100;
    const o = pts[0];
    const comp: CustomComponent = {
      t: "vertramp",
      p: [r2v(o.x), r2v(o.y), r2v(o.z)],
      // rail node convention, plus the 5th number: bank degrees
      pts: pts.map((v, i) => [
        r2v(v.x - o.x),
        r2v(v.z - o.z),
        0,
        r2v(v.y - o.y),
        roll?.[i] ?? 0,
      ]),
      curve: "spline", // one flowing road, not filleted corners
      vkind: "half",
      // lip=true: a slide trough with 2.4-wide gutters. lip=false: a ROAD —
      // the transition shrinks to a 15cm kerb bevel and the deck runs flat
      // right across.
      w: r2v(width / 2 - (lip ? 2.4 : 0.16)),
      rise: lip ? 3 : 0.45,
      arc: lip ? 53 : 18,
      bank,
      vert: false, // a banked ROAD, not a trough — no pumping, no auto-copings
      color: "#" + color.toString(16).padStart(6, "0"),
      tex,
    };
    const spine = this.buildVertRamp(comp);
    const path = vertRampPath(spine ?? [], false);
    // `off` keeps its old sense (+ = the deck's right looking down-course), so
    // every crate and edge rail placed against it lands where it always did.
    return {
      len: path.len,
      width,
      frame: (t, off, h) => path.frame(t, -off, h),
    };
  }

  // fruit strung along a stretch of ribbon, floating just over the deck line
  private ribbonFruit(r: SlideRibbon, t0: number, t1: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = r.frame(
        THREE.MathUtils.lerp(t0, t1, n === 1 ? 0 : i / (n - 1)),
        0,
        1.3,
      );
      this.pickup(p.x, p.y, p.z);
    }
  }

  private buildSlipstream(): void {
    this.allBalanceCrates = true; // one long combo line: every crate = balance
    this.perfectGrindBoost = true; // ...and riding a whole rail pays out in speed
    this.theme = {
      skyTop: "#1d6fb8",
      skyBottom: "#bfeef4", // bright noon haze over open water
      sunColorHex: "#fff6d8",
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
    const V = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z);

    // start plateau: a wide launch deck way up in the sky
    this.slab(
      "launch deck",
      26,
      -6,
      150,
      22,
      new THREE.MeshLambertMaterial({ color: 0x7fb6c4 }),
      true,
      0,
      "stone",
    );
    this.spawnPos.set(0, 150.1, 18);
    this.currentSpawn.copy(this.spawnPos);

    // ---- THE RUN: ONE spine, start to kicker ------------------------------
    // The old course was six ribbons abutted end to end, each guessing at its
    // neighbour's tangent; every join was a seam you could catch a wheel on.
    // This is a single node list, so there are no joins to get wrong — the
    // spline is continuous by construction and the whole descent is one sweep.
    // The only real break in the level is the water gap, and that one is
    // deliberate.
    const CX = -32; // corkscrew centre
    const CZ = -302;
    const CR = 30; // wide enough that the fat trough never eats its own inside
    const spiral: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const th = (-k * 45 * Math.PI) / 180; // 0 .. -270°, clockwise from the east point
      spiral.push(
        V(CX + CR * Math.cos(th), 98 - k * 3.6, CZ + CR * Math.sin(th)),
      );
    }
    const run: THREE.Vector3[] = [
      // the opening mega-drop: a huge sweeping S out east and back
      V(0, 150, -4),
      V(0, 146, -30),
      V(24, 138, -64),
      V(52, 128, -104),
      V(55, 122, -140),
      V(30, 114, -172),
      V(-10, 108, -206),
      V(-30, 104, -234),
      ...spiral, // THE CORKSCREW: a full 270° clockwise spiral, dropping all the way round
      V(-6, 73, -286),
      V(14, 70, -310), // unwind east, back onto the course line
      // the big banked right-hander — leaned hard, but the trough walls do the
      // containing now instead of a wall-of-death you could get stranded on
      V(12, 66, -348),
      V(-6, 63, -370),
      V(-34, 61, -380),
      V(-64, 58, -392),
      // the long S bomb back down-course, with a crest to pop
      V(-94, 54, -404),
      V(-102, 50, -430),
      V(-96, 46, -458),
      V(-80, 42, -486),
      V(-56, 38, -518),
      V(-30, 35, -550),
      V(-14, 31, -584),
      V(-10, 29, -612),
      // THE RUN-UP: straight, steep, into an up-kicked lip. The gap past it is
      // sized for full speed AND a jump — one alone drops you in the water.
      V(-8, 25, -640),
      V(-6, 19, -668),
      V(-1, 11, -698),
      V(3, 5.5, -722),
      V(6, 7.5, -738),
    ];
    // Extra lean where the course wants to feel banked, on top of the automatic
    // turn-in. Negative = the deck's right side comes up. The corkscrew holds a
    // steady lean the whole way round; the right-hander leans through its apex.
    const roll = new Array<number>(run.length).fill(0);
    const spiral0 = 8; // index of the first spiral node
    for (const [i, r] of [
      [-1, -8],
      [0, -18],
      [1, -24],
      [2, -24],
      [3, -24],
      [4, -24],
      [5, -18],
      [6, -10],
      [7, -4],
    ] as const) {
      roll[spiral0 + i] = r;
    }
    for (const [i, r] of [
      [18, -6],
      [19, -12],
      [20, -10],
      [21, -4],
    ] as const)
      roll[i] = r;

    const main = this.slideRibbon(run, 16, 0x3ec8d8, roll, 46);
    // THE GAP: ~18 units of open water, then the landing ribbon
    const land = this.slideRibbon(
      [V(7, 0.8, -756), V(6, 0.4, -790), V(2, 0.2, -816)],
      16,
      0x46b8d0,
    );

    // ---- furniture, hung off the ribbon's own frame ------------------------
    // Everything sits at (t, off) on the surface, so nothing floats or sinks
    // when the line is re-tuned.
    const onDeck = (
      r: SlideRibbon,
      t: number,
      off: number,
      kind?: "nitro" | "tnt" | "mystery",
    ): void => {
      const p = r.frame(t, off, 0);
      this.crate(p.x, p.y + 0.6, p.z, kind);
    };
    this.ribbonFruit(main, 0.03, 0.11, 8); // the drop
    this.ribbonFruit(main, 0.16, 0.24, 7);
    this.ribbonFruit(main, 0.33, 0.46, 10); // round the corkscrew
    this.ribbonFruit(main, 0.56, 0.63, 6); // the right-hander
    this.ribbonFruit(main, 0.7, 0.8, 8); // the S bomb
    this.ribbonFruit(main, 0.9, 0.96, 6); // the run-up
    onDeck(main, 0.075, -5);
    onDeck(main, 0.13, 5, "mystery");
    onDeck(main, 0.19, -5, "tnt");
    onDeck(main, 0.73, 5);
    onDeck(main, 0.78, -5.5, "nitro"); // off the racing line: a hazard for sloppy lines, not an ambush
    const gem = main.frame(0.4, 0, 2.2); // parked mid-spiral: hold the line round to it
    this.crystal(gem.x, gem.y, gem.z);
    for (const t of [0.5, 0.86]) {
      const p = main.frame(t, 0, 0);
      this.checkpoint(p.y, p.z, p.x);
    }

    // rope swing over the gap, WEST of the racing line: the flight line stays
    // honest (speed + jump), but a leap toward the rope opens a slower, showier
    // crossing — catch, ride the arc, release onto the landing
    this.ropeSwing(-3, 19, -747, 9.5, 0.8, 0, 0, 90);

    // THE WEAVE: alternating edge rails all the way down the course — grind
    // one, pop off, manual across the deck, catch the next on the other side.
    // A crate trio seeds every crossing (the combo dress turns a third of
    // them into balance windows), so the whole run reads as one combo line.
    const edgeRail = (
      r: SlideRibbon,
      t0: number,
      t1: number,
      side: -1 | 1,
    ): void => {
      const off = side * (r.width / 2 - 2.2); // just inside the trough wall
      const n = Math.max(2, Math.round(((t1 - t0) * r.len) / 6));
      const rpts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++)
        rpts.push(r.frame(THREE.MathUtils.lerp(t0, t1, i / n), off, 0.72));
      const rail = new Rail(rpts);
      this.rails.push(rail);
      this.root.add(rail.object);
    };
    const crossCrates = (r: SlideRibbon, t: number): void => {
      // flank the line, never block it: cruise speed (12) is BELOW smash
      // speed (12.5), so a crate on the centerline is a wall for anyone slow.
      // Banked spots get no crates at all — a leaned deck drifts slow riders
      // onto the flanks, and a crate there shoves them into the wall.
      const lo = r.frame(t, -2.4, 0);
      const hi = r.frame(t, 2.4, 0);
      if (Math.abs(hi.y - lo.y) > 1.1) return; // ~13°+ of lean: keep it clear
      for (const p of [lo, hi]) this.crate(p.x, p.y + 0.6, p.z);
    };
    // one crate on the FAR flank, level ground only — the manual line past a
    // grinding rider runs right through it
    const flankCrate = (r: SlideRibbon, t: number, off: number): void => {
      const lo = r.frame(t, -2.4, 0);
      const hi = r.frame(t, 2.4, 0);
      if (Math.abs(hi.y - lo.y) > 1.1) return;
      const p = r.frame(t, off, 0);
      this.crate(p.x, p.y + 0.6, p.z);
    };
    const weave = (
      r: SlideRibbon,
      first: -1 | 1,
      railLen: number,
      gap: number,
      t0: number,
      t1: number,
    ): -1 | 1 => {
      let side = first;
      let a = t0 * r.len; // arc-length cursor down the ribbon
      const end = t1 * r.len;
      while (a + railLen * 0.6 < end) {
        const b = Math.min(a + railLen, end);
        edgeRail(r, a / r.len, b / r.len, side);
        // opposite the rail's midpoint: a target you line up while grinding
        flankCrate(r, (a + b) / 2 / r.len, -side * 2.4);
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
    // one uninterrupted weave the length of the run, stopping short of the lip
    // so the gap stays an honest speed-and-jump test
    const wside = weave(main, 1, 46, 22, 0.02, 0.955);
    weave(land, wside, 30, 14, 0.12, 0.85); // last cash-out line into the finish

    // finish flat: run it out through the gate
    this.slab(
      "finish run",
      -810,
      -874,
      0.2,
      22,
      new THREE.MeshLambertMaterial({ color: 0x7fb6c4 }),
      true,
      0,
      "stone",
    );
    this.finishZ = -842;
    this.endWallZ = -868;
    this.finishGate(0.2, this.finishZ, 0);
    this.endWall(0.2, 0);

    this.killY = -26;
    this.pitPlane("water", -34, 0, -420, 2400);

    // CAMERA SPINE: the ribbon's own centerline is the camera lane — the rig
    // and the control frame ease along its tangent, so screen-up is always
    // "down the slide" and the road stays centered through every sweep (the
    // same machinery the editor's camnode chains drive).
    // HEIGHT MATTERS HERE: this ribbon drops 150 units and passes over itself,
    // so two stretches can sit almost on top of each other in plan view. A
    // spine without y would let the steering lock onto the deck below and
    // walk you straight off the loop.
    const lane: { x: number; y: number; z: number }[] = [];
    for (const r of [main, land]) {
      const n = Math.max(2, Math.round(r.len / 7));
      for (let i = 0; i <= n; i++) {
        const p = r.frame(i / n, 0, 0);
        lane.push({ x: p.x, y: p.y, z: p.z });
      }
    }
    // lead-in from the spawn deck and run-out past the finish, both held at
    // the height of the ribbon end they attach to
    lane.unshift({ x: 0, y: lane[0].y, z: 20 });
    lane.push({ x: 0, y: lane[lane.length - 1].y, z: -874 });
    this.lanePts = lane;
    this.measureLane();
  }

  private endWall(deckY: number, cx = 0): void {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4, 1),
      this.baseMat("wall", this.wallTint, "stone", 3, 1),
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
    // THE WARP PAD replaces the old checkered finish gate: a Crash-style stone
    // plinth with a plasma column standing on it (see src/warpPad.ts, rebuilt
    // from a video reference through the img2threejs sculpt pipeline). The
    // trigger box above is unchanged, so every level still finishes at exactly
    // the same place and no call site moves.
    // the column, as a volume you can fly through
    this.finishGlow.setFromCenterAndSize(
      new THREE.Vector3(
        cx,
        deckY + (WARP_PAD_GLOW_BASE + WARP_PAD_GLOW_TOP) / 2,
        z,
      ),
      new THREE.Vector3(
        WARP_PAD_GLOW_RADIUS * 2,
        WARP_PAD_GLOW_TOP - WARP_PAD_GLOW_BASE,
        WARP_PAD_GLOW_RADIUS * 2,
      ),
    );
    const pad = createWarpPad();
    gate.add(pad.group);
    this.warpPads.push(pad);
    for (const m of pad.solids) {
      m.userData.vert = false; // masonry, never a transition
      m.userData.finishPad = true; // standing on THIS is what ends the run
      this.groundMeshes.push(m);
    }
    // No relic scoreboard here. The floating crystal/gem pair belonged to the
    // old checkered gate — they hung off its crossbar. The warp pad is the
    // whole marker now, and the haul is already read off the HUD counters.
  }
}
