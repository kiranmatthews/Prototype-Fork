// Authored fake-physics board movement. No rigidbody, no forces: just a
// heading, a scalar speed, a vertical velocity, and hand-tuned numbers from
// tuning.ts. Ground following is a single downward raycast; slopes only exist
// as fake boost/slowdown numbers derived from the surface normal.

import * as THREE from 'three';
import { TUNING, CONST } from './tuning';
import { HANG_ANIMS } from './hangAnims';
import { Input } from './input';
import {
  Checkpoint,
  Crate,
  deckTrickFromInput,
  deckTrickInfo,
  type DeckTrickKind,
  LaneCursor,
  Level,
  RopeSwing,
  type WallPathRuntime,
  newLaneCursor,
} from './level';
import { sfx } from './audio';
import { Rail, RailSample, nearestRail } from './rails';
import { Halfpipe } from './halfpipe';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { wumpaMesh, WUMPA_SIZE } from './wumpa';
import { puffs, surfaceFromName } from './puffs';
import { Tail, type TailCollider } from './tail';
import {
  PROCEDURAL_SHIN_LENGTH,
  PROCEDURAL_THIGH_LENGTH,
  solveSagittalLegTarget,
  type SagittalLegPose,
} from './legRig';
import { RenderInterpolator } from './renderInterpolation';
import {
  createSkateboardPresentation,
  rebuildSkateboardPresentation,
  SKATEBOARD_GRIP_TOP,
  skateboardRestingPivotLift,
} from './skateboard/model';
import { skateboardSettings } from './skateboard/settings';
import {
  ledgeBasis,
  ledgeBlockerIntersects,
  ledgeBodyBox,
  ledgeCatchEnvelope,
  ledgeEdgePoint,
  ledgeLandingPoint,
  ledgeTraversePoint,
  type LedgeBasis,
  type LedgeCatchEnvelope,
} from './ledgeTraversal';
import { RUN_REVERSAL_YAW_RATE, stepFacingYaw } from './runFacing';
import {
  SpinEffectsPresentation,
  type SpinPresentationDiagnostics,
} from './spin-effects/presentation';
import { groundedSkateSpinEligible } from './spin-effects/routing';
import { SpecialSystem, type SpecialTrick } from './specialTricks';
import {
  projectComboLabels,
  sourceComboLabelLine,
  type ComboHudPreview,
} from './comboHud';
import {
  PlayerAnimationBridge,
  type PlayerAnimationOverlay,
  type PlayerAnimationRig,
} from './animation/bridge';
import type { ProceduralMotionContext } from './animation/types';
import {
  BAIL_RECOVERY_SPRAWL_PITCH,
  sampleBailRecovery,
} from './bailRecovery';
import { CharacterProportionLayer } from './character/proportionLayer';
import {
  characterProportionSettings,
  type CharacterProportionSettingsValue,
} from './character/settings';
import {
  CARTOON_GLOVE_POSES,
  blendCartoonGlovePose,
  createCartoonGlove,
  removeProceduralCartoonGloveSurface,
  setCartoonGlovePose,
  type CartoonGloveRig,
  type CartoonGlovePoseName,
} from './character/cartoonGlove';
import {
  attachAndSyncRiggedCartoonHandPair,
  loadRiggedCartoonHandPair,
  RIGGED_CARTOON_HAND_COLOR,
  RIGGED_CARTOON_HAND_MARK_COLOR,
  type RiggedCartoonHandPair,
} from './character/riggedCartoonHand';
import {
  createStretchableBone,
  stretchableBoneTriangleCount,
  type StretchableBoneComponent,
} from './character/stretchableBone';
import {
  createMeshyTorso,
  meshyTorsoTextureDiagnostics,
  type MeshyTorsoComponent,
} from './character/meshyTorso';
import {
  MESHY_HEAD_DEFAULT_GAP,
  MESHY_HEAD_EYE_CENTER_Y,
  MESHY_HEAD_VISUAL_CENTER_Y,
  createMeshyHead,
  meshyHeadTextureDiagnostics,
  type MeshyHeadComponent,
} from './character/meshyHead';
import {
  createMeshyShorts,
  meshyShortsTextureDiagnostics,
  type MeshyShortsComponent,
} from './character/meshyShorts';
import {
  createMeshyFootwear,
  meshyFootwearTextureDiagnostics,
  type MeshyFootwearComponent,
} from './character/meshyFootwear';

const CHARACTER_TAIL_VISIBILITY_STORAGE_KEY = 'solProtoCharacterTailVisibleV1';

const TAIL_V = new THREE.Vector3(); // scratch for the tail collider read
const LEG_SOLVE_R: SagittalLegPose = {
  hipPitch: 0,
  kneeFlex: 0,
  anklePitch: 0,
  verticalReach: 0,
  forwardReach: 0,
};
const LEG_SOLVE_L: SagittalLegPose = { ...LEG_SOLVE_R };

// WUMPA. World size is WUMPA_SIZE, shared with every other fruit in the game
// (see the note on it in wumpa.ts). Once collected, a fruit is this fraction
// of the SCREEN HEIGHT instead, held for the whole flight — no perspective, no
// shrink into the counter. Roughly the size of the HUD icon it is flying to,
// so it arrives looking like the thing it is about to become.
const FRUIT_SCREEN = 0.085;
// THE HOP. Crate fruit does one small canned bounce as the box breaks — up
// about a crate height and back down — and is UNTOUCHABLE by a spin while it
// does it. Straight off the Crash 3 footage: the box goes, the clump pops, it
// settles, and the spin that broke the box does not blow it away. 0.45s is
// spinDuration + spinCooldown, so the swing that opened the crate is always
// spent before the fruit is fair game again — the earliest a second spin can
// even start is the frame the hop ends.
// Scratch for the puff calls: these run every step, and a `new Vector3()` per
// frame in the hot path is exactly the allocation churn the pooled particle
// system exists to avoid.
const PUFF_UP = new THREE.Vector3(0, 1, 0);
const PUFF_DIR = new THREE.Vector3();
const PUFF_VEL = new THREE.Vector3();
const SIM_SEED0 = 0x9e3779b9; // level-load seed for the sim's PRNG (see simRand)
const PUFF_C = new THREE.Vector3();
const FRUIT_HOP_TIME = 0.45;
const FRUIT_HOP_RISE = 0.9;
// ...and the WHOLE hop is lifted by this much, so the clump comes to rest at
// the height a level's own loose wumpa floats at rather than down at the
// crate's centre. The hand-placed fruit hangs 1.2-1.3 above the deck; a crate
// is 0.96 tall and sits on the ground, putting its centre at 0.48, so +0.8
// lands the payload at 1.28 — level with the fruit already lying around it.
const FRUIT_REST_LIFT = 0.8;
// ...and it crosses the screen at this many screen-heights per second, flat.
// A 16:9 screen is 2.04 of those units corner to corner, so a worst-case trip
// takes about 0.9s and a typical mid-screen pickup reaches the counter in 0.4s.
const FRUIT_FLY_SPEED = 2.2;
// A runaway guard on the fruit pool, not a design limit — a level would have
// to drop several hundred wumpa on the floor at once to reach it.
const FRUIT_MAX = 600;
const FRUIT_P = new THREE.Vector3(); // scratch: fruit world position -> screen
const FRUIT_BOX = new THREE.Box3(); // scratch: the grab box around idle fruit
const FRUIT_REACH = new THREE.Box3(); // scratch: the player's body box, this frame
const REACH_C = new THREE.Vector3();
const REACH_S = new THREE.Vector3();
const FRUIT_SIZE = new THREE.Vector2(); // scratch: renderer size, split-screen draw
const FRUIT_PREV = new THREE.Vector4(); // scratch: viewport to put back
const FRUIT_GRAB = new THREE.Vector3(1.2, 1.5, 1.2); // same reach a level pickup has

export type MoveState = 'ride' | 'air' | 'grind' | 'hang' | 'rope' | 'dead' | 'gameover' | 'finished';

/** Presentation-only route into the browser-authored player clip catalog. */
export type PlayerAnimationClipHint =
  | 'player.idle'
  | 'player.run'
  | 'player.jump'
  | 'player.fall'
  | 'player.crouch'
  | 'player.crawl'
  | 'player.slide'
  | 'player.skate'
  | 'player.grind'
  | 'player.grab'
  | 'player.hang'
  | 'player.climb'
  | 'player.rope'
  | 'player.slam'
  | 'player.bail'
  | 'player.spin';

export interface PlayerAnimationIntent {
  readonly clipId: PlayerAnimationClipHint;
  readonly motion: ProceduralMotionContext;
}

// Ledge grab geometry: how far below the TRUE lip the body hangs (hands at the
// lip, head just under it), and how long the catch takes to settle (a caught
// grip eases in — never a teleport).
const LEDGE_HANG_DEPTH = 1.25;
const LEDGE_EASE = 0.12;
const LEDGE_DOWN = new THREE.Vector3(0, -1, 0);
const LEDGE_EDGE = new THREE.Vector3();
const LEDGE_CANDIDATE = new THREE.Vector3();
const LEDGE_RAY_ORIGIN = new THREE.Vector3();
const LEDGE_LANDING = new THREE.Vector3();
const LEDGE_PATH = new THREE.Vector3();
const LEDGE_FACE_NORMAL = new THREE.Vector3();
const LEDGE_NORMAL_MATRIX = new THREE.Matrix3();
const LEDGE_BODY = new THREE.Box3();
const LEDGE_INWARD_DEPTHS = [0.42, 0.56, 0.72, 0.9] as const;
const LEDGE_FRAME_DIRECTIONS = [
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [0, 1],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0],
  [-Math.SQRT1_2, -Math.SQRT1_2],
  [0, -1],
  [Math.SQRT1_2, -Math.SQRT1_2],
] as const;
const HANG_BOX = new THREE.Box3();
const ROPE_P = new THREE.Vector3();
const ROPE_DIR = new THREE.Vector3();
const ROPE_V = new THREE.Vector3();
const VERT_RAY_O = new THREE.Vector3();
const VERT_RAY_D = new THREE.Vector3();
// feeler height ladder relative to the remembered lip: slightly above first
// (a rising lip pulls the hang up), then at, then a short scan below (a
// dipping lip is re-caught instead of lost)
const VERT_TRACK_STEPS = [0.15, 0.05, 0, -0.12, -0.26, -0.45, -0.7];
// Under-rail hang: how far the FEET ride below the rail line while hanging
// underneath (hands + crosswise board grip the rail overhead), and how long
// the committed swing between top and under takes.
const UNDER_RAIL_DEPTH = 1.65;
const UNDER_RAIL_SWING = 0.32;
// Deck-plant fallback for a malformed/custom board. The production value is
// read live from boardG.userData.gripTop so the Unity shape lab can tune it.
const PLANT_DECK_TOP = SKATEBOARD_GRIP_TOP;
// How far up from a foot's lowest vertex still counts as "the sole".
const SOLE_BAND = 0.03;
// Additional animation pivot seated at the procedural rider's waist. The
// legacy upper-body root stays at zero so existing gameplay poses are unchanged.
const PROCEDURAL_SPINE_Y = 0.82;
/** Convex hull of a point cloud in the XZ plane; each point keeps its own Y. */
function convexHullXZ(pts: THREE.Vector3[]): THREE.Vector3[] {
  if (pts.length < 4) return pts.slice();
  const sorted = pts.slice().sort((a, b) => a.x - b.x || a.z - b.z);
  const turn = (o: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): number =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (src: THREE.Vector3[]): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [];
    for (const p of src) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop(); // shared endpoint — the other half picks it up
    return out;
  };
  const lower = half(sorted);
  const upper = half(sorted.slice().reverse());
  const hull = lower.concat(upper);
  return hull.length > 0 ? hull : pts.slice();
}
// Grind trick table (THPS3+ vocabulary): the stick at snap — or at a fresh
// Triangle press MID-grind — picks the trick. Names/scores per style; the
// lipslide is the sideways catch where you came over the TOP of the rail.
type GrindStyle = 'normal' | 'nose' | 'five0' | 'board' | 'lip' | 'smith' | 'feeble' | 'crook';
const GRIND_NAMES: Record<GrindStyle, string> = {
  normal: '50-50',
  nose: 'Nosegrind',
  five0: '5-0',
  board: 'Boardslide',
  lip: 'Lipslide',
  smith: 'Smith Grind',
  feeble: 'Feeble Grind',
  crook: 'Crooked Grind',
};
const GRIND_MULTS: Record<GrindStyle, number> = {
  normal: 1,
  nose: 1.25,
  five0: 1.25,
  board: 1.5,
  lip: 1.6,
  smith: 1.4,
  feeble: 1.4,
  crook: 1.35,
};
const _plantInv = new THREE.Matrix4();
const _plantMR = new THREE.Matrix4();
const _plantML = new THREE.Matrix4();
const _plantV = new THREE.Vector3();
const _plantO = new THREE.Vector3();
const _plantC = new THREE.Vector3();

interface GroundHit {
  y: number;
  normal: THREE.Vector3;
  name: string;
  crate?: Crate; // identity-bearing temporary lid support
  moverId?: number; // standing on a moving platform: ride along with it
  crumbleId?: number; // standing on a crumble pad: it starts breaking
  slippy?: boolean; // an icy/slick plank: friction cut so you skate on and can't stop short
  vert?: boolean; // AUTHORED transition face: the level says "this is vert", overriding the normal.y guesswork
  finishPad?: boolean; // the warp pad's masonry: standing on it ends the run
  halfpipe?: Halfpipe; // the transition wall we're on (drives the pendulum + coping launch)
  pipeCross?: number; // analytic pipe hit: exact cross-axis coordinate of the surface point
  trampolineBounce?: number;
  trampolineHeldMult?: number;
  speedPadSpeed?: number;
  speedPadHold?: number;
  speedPadId?: number;
  undersideThickness?: number;
}

interface LedgeTop {
  y: number;
  moverId?: number;
}

const DOWN = new THREE.Vector3(0, -1, 0);

// STANDING ON A BOX.
//
// Crates are NOT ground meshes and must never become them: the whole crate
// game — land on one and it breaks — depends on a fall onto a box being
// resolved in collide(), which runs AFTER the state step. Hand the ground
// raycast a crate lid and stepAir lands on it a frame before collide ever sees
// a stomp, and nothing you jump on breaks again.
//
// So a lid is ground only while this LATCH is live, and the latch is only ever
// lit by collide() deciding the box under your feet is one you cannot break
// (the metal slab, or any box at all when you have no board). From there it is
// refreshed every frame you stay on a crate, which is what lets you walk from
// box to box across a stack top and — the point of the whole thing — jump off
// one, including one that is bouncing.
const CRATE_STAND_GRACE = 0.25;
// Seat the feet a hair PROUD of the lid. Flush would leave playerBox.min.y
// exactly equal to the crate's box.max.y, which Box3 counts as an overlap, and
// the crate loop would answer a stationary stander with a sideways pushOutOf.
const CRATE_STAND_LIFT = 0.02;
// How far above the feet a lid may still be claimed while the latch is live —
// enough for a bouncing box to catch you on the way up (the fastest hop the
// crateHopSpeed slider allows covers 0.43 in a frame) without letting you walk
// up a whole extra layer, which is a jump.
const CRATE_STAND_REACH = 0.55;
const CRATE_STAND_MIN_OVERLAP = 0.08;
const CRATE_UP = new THREE.Vector3(0, 1, 0);
const CRATE_CONTACT_SHIFT = new THREE.Vector3();
const NO_CRATE_CONTACTS: ReadonlySet<Crate> = new Set();
// Procedural bail recovery: the physical ragdoll owns the impact/bounces, then
// stable ground hands the final beat to a shoulder-roll and moving stand-up.
const BAIL_RECOVER_TIME = 0.72;
const BAIL_STABLE_TIME = 0.12;
const BAIL_RECOVER_START_SPEED = 2.8;
const BAIL_MOVE_START = 0.18;
const BAIL_MOVE_END = 0.88;
const BAIL_EXIT_CARRY = 0.4;
const BAIL_EXIT_MIN = 1.8;
const BAIL_EXIT_MAX = 5.4;
const BAIL_MAX_STEP = 0.85;
const RAG_FLAIL_MAX_JUMPS = 2;
const RAG_FLAIL_MAX_UP_SPEED = 10;
const BAIL_V = new THREE.Vector3();
const BAIL_TARGET = new THREE.Vector3();
const BAIL_DELTA = new THREE.Vector3();
const BAIL_CONTROL_F = new THREE.Vector3();
const BAIL_CONTROL_L = new THREE.Vector3();
const BAIL_PITCH_AXIS = new THREE.Vector3(1, 0, 0);
// Forgive a near-simultaneous Square/X smoosh at takeoff, but never bank an
// old ground spin through an arbitrarily long held ollie charge.
const OLLIE_DECK_TRICK_CHORD = 0.1;
// Keep authored locomotion routing on the same any-direction threshold as the
// legacy gait. Tiny release-coast motion belongs to the stop transition, while
// a genuine lateral run must never be mistaken for idle just because the
// forward-only `speed` scalar is near zero.
const RUN_ANIMATION_THRESHOLD = 1.5;

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

// scratch objects for the hang-time body tilt (no per-frame allocation)
// Landing-X strength at full height (it fades in from nothing as you rise).
const X_ALPHA = 0.85;
const BLAST_AT = new THREE.Vector3(); // scratch for the blast test
const VERT_UP = new THREE.Vector3(0, 1, 0);
const VERT_Q = new THREE.Quaternion();
const VERT_Q2 = new THREE.Quaternion();
const LEAN_AXIS = new THREE.Vector3(); // heading, for the carve/balance roll
const LEAN_Q = new THREE.Quaternion();
const _renderDelta = new THREE.Vector3(); // post-step PVP root correction

export class Player {
  pos = new THREE.Vector3(); // feet position
  /** Feet position currently presented to the renderer/camera. Never gameplay. */
  readonly renderPosition = new THREE.Vector3();
  private readonly renderInterpolator = new RenderInterpolator();
  private readonly renderObjects: THREE.Object3D[] = [];
  private _renderSnapVersion = 0;
  // this rider's place on the camera lane — private, so split-screen players
  // don't drag each other's frame around (see Level.laneDirAt)
  readonly laneCursor: LaneCursor = newLaneCursor();
  speed = 0; // signed along-course velocity (+ = forward, - = toward camera)
  vVel = 0;
  state: MoveState = 'ride';
  grounded = false;
  surfaceName = '-';
  runTime = 0;
  cratesBroken = 0;
  fruit = 0; // wumpa collected
  masks = 0; // Aku masks held (max 2): absorb one hit or bail; the 3rd = uber
  uberTimer = 0; // Crash third-mask invincibility: auto-smash, perfect balance
  lives = 3; // Crash lives: death costs one, 100 wumpa earns one, out = fresh start
  endlessDeaths = false; // selectable standard-run rule: deaths replace lives and never game-over
  totalDeaths = 0;
  points = 0; // banked score
  comboPoints = 0; // pending combo: sum of base values...
  comboMult = 0; // ...times the number of actions strung together
  comboLabels: string[] = []; // THPS-style trick names for the combo readout
  comboHasTrick = false; // a REAL trick (grab/grind/wallride/slide) is in the combo — gates the HUD plate; bare spins/bounces/enemy pops don't show it
  private comboHudActionRevision = 0; // fixed awards snap; timed accrual alone tickers
  private deckTrickPreviewSequence = 0;
  private readonly special = new SpecialSystem();
  private specialActivationCount = 0;
  private comboTimer = 0; // plain-rolling time left before the combo banks
  onComboBank: (amount: number, labels: string) => void = () => {}; // combo landed clean → cash-in ticker
  onComboBail: (labels: string, points: number, multiplier: number) => void = () => {}; // combo lost → frozen red fall-away

  // debug readouts
  railCandidateDist = Infinity;
  balance = 0; // THPS grind balance needle, -1..1
  balanceVel = 0; // needle VELOCITY — second-order momentum (THUG's mManualLeanDir); 0 at neutral inertia keeps the model exactly first-order
  private noisePhase = 0; // deterministic 'sketch' phase (rad), reseeded once per trick entry

  // wired up by main.ts
  onDeath: () => void = () => {};
  onGameOver: () => void = () => {};
  onFinish: (time: number) => void = () => {};
  onRespawn: () => void = () => {};
  onCheckpoint: () => void = () => {};
  onRelic: (title: string, sub: string) => void = () => {};
  onTrickGateBlocked: (trick: DeckTrickKind) => void = () => {};
  // TIME TRIAL: grab the stopwatch at spawn to start the clock, cross the
  // finish gate to stop it. Numbered time crates freeze it; dying restarts
  // the level with the trial OFF (grab the clock again to retry).
  ttActive = false;
  ttTime = 0; // the running trial clock
  ttFreeze = 0; // banked freeze seconds still counting down
  private ttDied = false; // a trial death: the respawn goes to the very start
  // COMBO RUN: grab the green orb, then reach the green gem at the gate in
  // ONE combo. The gem lives exactly as long as the combo does.
  comboRun = false;
  comboGemEarned = false;
  private comboWasLive = false; // last frame's "a combo is pending" — the falling edge is the fail
  private comboFailT = 0; // the despair beat: halo dissipates, then fade out + restart
  private comboGraceT = 0; // seconds after the grab to START a combo — no strolling to the gem
  private comboGraceWarned = false;
  private comboDied = false;
  onComboGraceLow: () => void = () => {}; // grace nearly gone and still no combo — nudge the HUD
  balanceBoostT = 0; // perfect-balance window from boost crates — stacks, the HUD ring laps it
  onComboRunStart: () => void = () => {};
  onComboRunFail: () => void = () => {};
  onComboRunWin: () => void = () => {};
  onComboRunEnd: () => void = () => {}; // mode dropped without ceremony (restart / level switch)
  private bounceJump = false; // a crate bounce re-arms the double jump — even off a skate air
  onTTStart: () => void = () => {};
  onTTEnd: () => void = () => {}; // trial dropped without finishing (death / restart)
  onTTFinish: (time: number) => void = () => {};
  hasCrystal = false; // Crash collectathon: the level crystal
  gemSpawned = false; // every box broken: the gem has MATERIALIZED
  gemEarned = false; // ...and you have since touched it. The HUD reads this.

  // ---- relic vault -------------------------------------------------------
  // A relic, once earned, is EARNED. Resetting the level (R, a death, a
  // game over) is how you retry a run — it must not confiscate the trophies
  // already on the shelf, which is what wiping the three flags above used to
  // do. So they are banked here on the way out of a run and handed back on the
  // way in.
  //
  // Deliberately a plain in-memory Map and NOT localStorage: the whole point
  // is that an IN-GAME reset keeps them while a page reload starts clean, and
  // localStorage would survive the reload too. Keyed by level, so the row
  // shows what you earned HERE rather than a running total from somewhere else.
  // scratch for the wallride deck pose (see the wallride block in the boardG
  // section): world-space target frame, parent world rotation, flush offset
  private static readonly WALL_X = new THREE.Vector3();
  private static readonly WALL_Y = new THREE.Vector3();
  private static readonly WALL_Z = new THREE.Vector3();
  private static readonly WALL_OFF = new THREE.Vector3();
  private static readonly WALL_M = new THREE.Matrix4();
  private static readonly WALL_QT = new THREE.Quaternion();
  private static readonly WALL_QP = new THREE.Quaternion();
  private static relicVault = new Map<
    string,
    { crystal: boolean; gem: boolean; combo: boolean }
  >();
  /** Which level's shelf to read and write. main.ts sets it on every switch. */
  relicKey = '';

  private relicSlot(): { crystal: boolean; gem: boolean; combo: boolean } {
    let v = Player.relicVault.get(this.relicKey);
    if (!v) {
      v = { crystal: false, gem: false, combo: false };
      Player.relicVault.set(this.relicKey, v);
    }
    return v;
  }

  /** Whatever this run earned goes onto the current level's shelf. */
  private bankRelics(): void {
    const v = this.relicSlot();
    v.crystal = v.crystal || this.hasCrystal;
    v.gem = v.gem || this.gemEarned;
    v.combo = v.combo || this.comboGemEarned;
  }

  /** Take the shelf as it stands. ADOPTS, never merges — see enterLevel. */
  private restoreRelics(): void {
    const v = this.relicSlot();
    this.hasCrystal = v.crystal;
    this.gemEarned = v.gem;
    this.comboGemEarned = v.combo;
  }

  /**
   * Moving to another level: bank what this one earned under the OLD key, then
   * adopt the target's shelf. Two things matter here. The key can only change
   * AFTER banking, or this level's relics get filed against the next one. And
   * the restore has to ADOPT rather than merge — merging would carry the
   * relics you're holding into a level you have never collected anything in.
   */
  enterLevel(id: string): void {
    if (this.relicKey) this.bankRelics();
    this.relicKey = id;
    this.restoreRelics();
  }

  readonly group: THREE.Group;
  private bodyGroup: THREE.Group; // rotates for the spin/trick
  private readonly playerAnimationBridge: PlayerAnimationBridge;
  private readonly characterProportionLayer: CharacterProportionLayer;
  private characterTailVisibleValue = true;

  private spinTimer = 0;
  private spinCd = 0;
  // "A crate lid is ground right now" — see CRATE_STAND_GRACE.
  private crateFloorT = 0;
  private crateFloor: Crate | null = null;
  private crateSupportLostThisStep = false;
  // Grab is a little state machine: reaching into the pose, holding it, and
  // reaching back out. Landing anywhere but 'none' is a bail.
  private grabPhase: 'none' | 'enter' | 'held' | 'exit' = 'none';
  private grabT = 0;
  private grabGraceTimer = 0;
  private grabPose = 0;
  private grabPitch = 0; // smoothed pose-variant params (up/left/right grabs)
  private grabRoll = 0;
  private armRPose = 0;
  private armLPose = 0;
  private pendingSpecialGrab: SpecialTrick | null = null;
  private specialGrab: SpecialTrick | null = null;
  private specialGrabT = 0;
  private specialGrabStartAngle = 0;
  private specialGrabLanding = false;
  private slideTimer = 0;
  private slideCd = 0;
  private slidePose = 0;
  private slideFromWalk = false; // slid off your feet: don't launch into skating
  private slideLandClamp = false; // walk-slide touchdown: cap the next measured planar too
  private slideVec = new THREE.Vector3(); // world-space slide direction (8-axis)
  private slideSpd = 0;
  private slideDistanceLeft = 0; // exact authored travel remaining; slideTimer is only the derived time/readability channel
  private slideContactLatch = false; // this fixed step translated as a slide, even if the exact final partial step consumed its timer
  private slideEndPending = false; // a slide is running; its end (scrub+recharge) not yet resolved
  private slideGraceHold = false; // preserve freshly refreshed grace through the first ordinary tick after an exact partial-step finish
  private slideAirLat = 0; // slide-jump: launch velocity component ACROSS the heading (keeps sideways slide-jumps sideways)
  private slideJumpAir = false; // in a committed slide-jump arc: no input air-steer (no diagonal drift)
  private slideRecoverT = 0; // get-up beat after a slide: movement locked while the skater gets off the ground
  private skateBlockT = 0; // brief window after a slide-jump touchdown where the board CAN'T pop (a slide jump lands on foot, period — slope re-accel or a held direction mustn't flip it out)
  private slideCrawlChain = false; // Circle held through a slide: flow straight into the crawl on the way out (no get-up beat)
  private landingScoring = false; // landing-tick payouts still count as air tricks
  private crawling = false; // Circle held while stopped: all-fours crawl
  private crawlPose = 0;
  private slamActive = false; // Circle+down in the air: pancake body slam
  private slamHangT = 0; // cartoon hang before the drop
  private slamFlatT = 0; // lie pancaked on the ground for a beat after impact
  private hangPose = 0;
  private dropPose = 0;
  private skatePose = 0; // feet-on-the-board stance while rolling
  private deckPose = 0; // 0..1: the deck is under the feet; articulated knees + sole planting own the stance
  // SIDE-ON STANCE: a real skater faces 90° across the board — face and
  // belly toward the rail side, head turned to look down the line. This
  // blends the whole body into that pose whenever the board is under you
  // (riding, ollie airs, non-boardslide grinds); stance flips the side.
  private sidePose = 0;
  private slopePose = 0; // body pitches to match the ground under the board
  private starTimer = 0; // Crash star-jump beat after crouch/slide jumps
  private starPose = 0;
  private slopeRoll = 0; // ...and rolls to match the cross-slope (bank/wall)
  private slamSquash = 0; // pancake pose timer after a slam lands
  private bailing = false; // death with a tumble animation instead of a blink-out
  private bailSpin = 0;
  // Knockdown lifetime: physical tumble first, then a supported procedural
  // roll-up whose latter half accepts movement intent. Non-lethal by itself.
  private bailDownT = 0;
  private bailMash = 0; // button mashing shortens the knockdown (THUG's bash factor)
  private bailRush = 1; // 1..1+bailMashMax — also speeds the get-up pose so the mash READS
  private bailRecoverT = -1; // <0 physical tumble/settle; >=0 procedural roll-up
  private bailRecoverDuration = BAIL_RECOVER_TIME;
  private bailRecoveryPose = 0; // 0..1 fixed-step roll/kneel/rise phase
  private bailGroundT = 0; // uninterrupted stable support before roll-up may start
  private bailExitSpeed = 0; // capped run-out target when direction is held
  private readonly bailVelocity = new THREE.Vector3(); // world-space recovery carry
  private bailRecoverSide: -1 | 1 = 1; // visual shoulder only; never gameplay
  private vertGravT = 0; // easing back from vert gravity to street gravity after a hang drops
  // RAGDOLL WIPEOUT. Not articulated physics — an animated ragdoll, the THPS
  // way: the ROOT does the real work (ballistic arc + restitution bounces off
  // the same ground query everything else uses) while the BODY tumbles with an
  // angular velocity seeded by whatever went wrong (a trip pitches you forward,
  // a wall hit slams you backward, a rail bail rolls you off sideways) and the
  // limbs windmill on per-wipeout random phases. Stable walkable support hands
  // the body into the shoulder-roll recovery below. bailDownT is the complete
  // lifetime: ragActive can only be true inside it.
  private ragActive = false;
  private airRose = false; // this air had an upward phase (a jump, a bounce) — see railLandSmack
  private ragAngVel = new THREE.Vector3(); // tumble rates: x pitch (over axisL), y yaw, z roll (over axisF)
  private ragQ = new THREE.Quaternion(); // accumulated tumble orientation, WORLD space
  private ragBlend = 0; // how much of the pose the tumble owns (eases in/out)
  private ragPoseAnchor = new THREE.Vector3(); // parent-local waist point preserved across roll interruption
  private ragPoseAnchorW = 0;
  private ragBounces = 0; // ground hits so far this wipeout (capped)
  private ragImpacts = 0; // every actual ground contact, including a final non-rebound settle
  private ragJumpAttemptImpact = 0; // one unreliable X roll per impact
  private ragSteerAttemptImpact = 0; // one unreliable direction roll per impact
  private ragSteerInputLatched = false; // held-through-impact stick must release before a pulse
  private ragFishJumps = 0; // hard cap prevents flailing from extending a bail forever
  private ragFlailKickT = 0; // presentation-only whole-body thrash after an attempted input
  private ragSeedA = 0; // per-wipeout flail phases so no two crashes thrash alike
  private ragSeedB = 0;
  private ragRollAcc = 0; // accumulated slope-roll angle: a thud every half turn
  private flyBoard: THREE.Group | null = null; // the deck, mid-flight after a skate wipeout
  private flyBoardVel = new THREE.Vector3();
  private flyBoardAng = new THREE.Vector3(); // its own tumble rates (euler rates, cheap and chaotic)
  private flyBoardT = 0;
  private flyBoardRest = false; // landed and lying still
  private static readonly RAG_DQ = new THREE.Quaternion();
  private static readonly RAG_AXIS = new THREE.Vector3();
  private static readonly RAG_PIVOT_BASE = new THREE.Vector3();
  private static readonly RAG_QP = new THREE.Quaternion();
  private static readonly RAG_QT = new THREE.Quaternion();
  // ONE capability mask for "is the skater currently wiping out". Everything a
  // downed body must not be able to start reads this. It used to be safe by
  // ACCIDENT — a bail parked speed at 0, so no crest/grind/wallride test could
  // ever fire — but now that bails carry momentum a tumbling body would sail up
  // a pipe wall and get thrown into a hang mid-wipeout.
  private get isBailing(): boolean {
    return this.bailDownT > 0;
  }

  // ---- the SIM's own random stream -----------------------------------------
  // replay.ts promises that replaying a file reproduces the run exactly. That
  // is only true if every random number that reaches SIM STATE comes from a
  // seeded stream which restarts identically on level load — Math.random()
  // does not, so the balance needle, trip launches and '?' crate rewards used
  // to make replays drift out of sync with the run they recorded.
  //
  // VISUAL randomness (sparks, dust, ragdoll flail, thrown-deck spin, canvas
  // textures) deliberately stays on Math.random(). It never feeds sim state,
  // and keeping it OFF this stream is what stops a headless/lite run that
  // skips particle emission from consuming different draws and desyncing.
  private simSeed = SIM_SEED0;
  private simRand(): number {
    // mulberry32: tiny, fast, good enough distribution, trivially portable
    // (the Unity port needs the same generator to replay these files)
    this.simSeed = (this.simSeed + 0x6d2b79f5) | 0;
    let t = this.simSeed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // "Is the surface under me a TRANSITION?" — the authored flag OR the angle
  // heuristic, never the flag alone. An unflagged steep face still behaves
  // exactly as it always did; a flagged face is vert even where the angle is
  // too shallow to guess (a mellow bank the designer wants ridden as vert).
  // The vert flag is a TRI-STATE and all three states matter. `true` is "ride
  // this as vert whatever its angle"; `false` is "this is a ROAD, never vert,
  // however steeply it banks" — a banked slide deck is not a transition just
  // because it leans; and `undefined` is unflagged geometry, where the angle
  // heuristic is all we have. Reading `false` as "unflagged" is what let the
  // Slipstream's gutters get tracked as walls and glue riders to them.
  private get onTransition(): boolean {
    if (this.groundHit === null || this.groundHit.vert === false) return false;
    return this.groundHit.vert === true || this.groundHit.normal.y < TUNING.steepStand;
  }
  // The slope a launch should convert: the steepest climb still in memory,
  // falling back to the live one. Never lower than lastTy, so nothing that
  // launches correctly today launches lower.
  private get takeoffTy(): number {
    return this.liftTyT > 0 ? Math.max(this.lastTy, this.liftTy) : this.lastTy;
  }
  // Whether the current airtime started from SKATING (ollie, slide/grind
  // jump, vert launch, skate edge-fall). Grabs are board tricks: a standing
  // Crash hop never offers them (the slam stays available from any air).
  private airFromSkate = false;
  // WHICH GRAVITY THIS AIRTIME FLIES UNDER. A skate air and a platforming hop
  // are different arcs now, so the choice has to be a property of the LAUNCH,
  // declared once and never re-read from live state. Mounted state chooses a
  // board launch even at walking pace; speed only distinguishes running and
  // standing jumps after board/slide ownership has been resolved. airFromSkate
  // remains a trick-window token which traversal catches and bails may clear
  // mid-arc, so it cannot safely own the gravity choice frame by frame.
  // Defaults to 'foot' and resets to 'foot' on every touchdown, so a launch
  // site that forgets to declare gets the old behaviour instead of silently
  // inheriting the last air's.
  private airGrav: 'foot' | 'board' = 'foot';
  private grabSpinAngle = 0; // directional grab-spin; land off-axis = bail
  private spinAngle = 0; // spin-attack rotation (visual only)
  private visualYaw = 0; // Crash-style body facing vs. movement heading
  private flipTimer = 0; // front-flip on jump (visual only)
  private dirHoldT = 0; // seconds a direction has been held (roll-jump trigger)
  private airJumpUsed = false; // double jump: one extra pop per air
  private airTapT = 0; // double jump tap timer: armed on press, dies if held (that's a charge)
  private doubleJumpAir = false; // ordinary foot-air drive stays at the authored retained traversal scale after the second pop
  private airborneT = 0; // seconds since leaving the ground — gates how LATE a double can fire
  private airPeakY = 0; // highest feet position in this authored air; huge-drop landing evidence
  private launchVy = 0; // vertical pop this air started with — scales the double-jump window
  private skateCharge = 0; // commit meter: time X has been held WITH a direction
  private lastPlanar = 0; // measured ground speed last step, any direction
  private lastVelX = 0; // measured horizontal velocity last step (u/s) —
  private lastVelZ = 0; // direction-of-travel source that no convention can lie about
  // ON-FOOT SLIP: ground steeper than footGrip can't be walked — feet slither
  // down the fall line. slipClamp caps next frame's measured planar (same latch
  // pattern as slideLandClamp) so the descent can't trip the skate gate.
  slipping = false;
  private slipClamp = false;
  // GREASY WHEELS: touching an oil slick (or skating an icy plank) kills the
  // contact patch — carve and brake barely bite while this runs down. The
  // linger matters: a 3m patch crossed at 20 u/s is only a few frames of
  // actual contact, so without it the slick would never register at speed.
  private greaseT = 0;
  // Momentum exits (grind jumps, slide jumps) keep their speed in the air:
  // footAir's direct-drive zeroing never applies until the next touchdown.
  private airMomentum = false;
  // An ordinary board ollie may be abandoned once with a second charged X
  // press/release. The deck keeps flying independently; the rider takes a
  // foot-gravity escape whose first landing is deterministically judged.
  private boardOllieAir = false;
  private emergencyEjectChargeT = 0;
  private emergencyEjectCharging = false;
  private emergencyEjectUsed = false;
  private emergencyEjectLandingPending = false;
  private emergencyEjectLandingWillBail = false;
  // FREE-HEADING SKATE: while on the board (not walking / pipe / sliding),
  // the travel axes ARE the board's heading and the stick carves them around
  // — no more axis-locked "brake if you turn too far".
  private freeSkate = false;
  // Deliberate dismount (pull-back brake bled to walking pace): drop the
  // skate persistence THIS frame so the feet take the stick immediately.
  private stepOff = false;
  // SWITCH STANCE: 1 = regular, -1 = switch (landed a 180 — the body faces
  // opposite the travel direction until the next 180 or stepping off).
  private stance: 1 | -1 = 1;
  // THPS2 VERT HANG TIME: an air earned off a vert lip stays GLUED to the
  // wall — the planar position is pulled back to the launch plane so gravity
  // drops you into the same transition, stick drift allowed ALONG the coping
  // only. Escape at the lip by RELEASING X (ollie out over the coping).
  vertAir = false;
  readonly vertNormal = new THREE.Vector3(); // wall outward normal, horizontal
  readonly vertAnchor = new THREE.Vector3(); // the lip point we launched from
  vertLatVel = 0; // hang-time lateral drift along the coping (from the approach angle)
  // THUG-style wall tracking (non-pipe vert airs): the feeler re-finds the
  // wall each frame so the hang follows CURVED walls and bowl corners.
  private vertTracked = false; // the feeler has seen a real vert face this hang
  private vertLossT = 0; // time since a tracked hang last saw its wall
  private vertLandGraceT = 0; // just landed from a vert air: coping rails yield
  private vertLaunchT = 0; // X released while climbing a vert wall: arm a lip launch
  // HALFPIPE stall-flip cooldown: after the pendulum flips your heading down the
  // fall line at the top of a wall, a brief lockout stops it re-flipping while
  // you're still slow near the apex.
  private pipeFlipCd = 0;
  // Popped off a halfpipe coping into the hang: SUPPRESS the hang-time stick-spin
  // (you hold a direction to CLIMB the wall, and that hold must not be read as a
  // trick-spin that then bails you on the drop-back-in). Deliberate spins off the
  // lip still work via the Square spin button.
  private pipeHang = false;
  // THPS MANUAL: flick the stick up-then-down (manual, nose up) or down-then-up
  // (nose manual) while rolling — or finish the flick just before touchdown to
  // LAND INTO it — and ride on two wheels. The needle lives on the pitch axis
  // (up/down fights it, reusing the grind balance field + visuals); pegging it
  // is a bail. It's the combo CONNECTOR: ticks refresh the combo window, and
  // landing an air into a manual keeps the string alive instead of banking.
  manualing: 0 | 1 | -1 = 0; // 0 = four wheels, 1 = manual (nose up), -1 = nose manual
  private manualTime = 0; // how long this manual has held (difficulty ramps)
  private manualTickT = 0;
  private manualPitch = 0; // eased visual pitch
  private prevMoveY = 0; // stick edge detection for the flick
  private flickUpT = 99; // seconds since the stick flicked up / down
  private flickDownT = 99;
  private manualArmed: 0 | 1 | -1 = 0; // flick completed mid-air: land into it
  private manualArmT = 0;
  private manualCoyoteT = 0; // time the live manual has been off the deck (crest-hop grace)

  // ROPE SWING: jump at a swinging rope to hang on. Up/down climbs the rope,
  // hold/release X leaps off with the swing's momentum, Square spins to smash
  // mid-air crates and enemies. stepRope owns the state.
  private ropeObj: RopeSwing | null = null;
  private ropeD = 0; // grip distance down the rope from the anchor
  private ropeCoolT = 0; // re-grab cooldown after leaping off
  private ropeJumpArm = false; // X must come UP once on the rope before hold-to-charge arms
  private ropeFaceYaw = 0; // body faces the swing's travel line, not the flip-flopping velocity
  // LIP TRICKS: reach the coping slow holding Triangle -> stall on the lip
  // (Rock to Fakie / Axle Stall / Disaster from the air), points tick while
  // held, release/jump/timeout drops back in fakie.
  lipStallT = 0; // > 0 = stalled on the coping (counts down to auto-drop)
  private lipPipe: Halfpipe | null = null;
  private lipSide = 1; // sign of u at the stall (which coping)
  private lipTickT = 0;
  private lipCoolT = 0; // no instant re-catch right after dropping in
  // SPINE TRANSFER: which pipe the current hang crested from; landing a hang on
  // a DIFFERENT pipe = carried across the ridge.
  private hangPipe: Halfpipe | null = null;
  private transferCoolT = 0; // debounce between R2 spine transfers
  // Where the follow camera is AIMING (XZ-projected, unit), fed by main every
  // frame. The lip stall projects its tip axis onto this so the balance meter
  // and the stick axis that fights it match what's on screen.
  readonly camDir = new THREE.Vector3(0, 0, -1);
  private lipMeterH = false; // stall meter reads horizontal (screen L/R) vs vertical
  private lipDispSign = 1; // needle sign: + always points where you're leaning on screen
  // Post-drop-in grace: after a pipe-hang landing, the stick is usually still
  // held the way you were CLIMBING — which is now opposite travel. For this
  // beat that stale hold must not read as a pull-back brake (the skateHalt
  // stall) or carve you back up the face: the drop-in flows.
  private pipeLandGraceT = 0;
  // THPS WALLRIDE: ollie into a wall HOLDING GRIND and stick to its face, riding
  // along it under gentle gravity; jump to kick off. Owns its own motion while
  // active (its own branch in stepAir).
  wallriding = false;
  private wallTickT = 0; // THPS accrual while wallriding
  private readonly wallNormal = new THREE.Vector3(); // wall outward normal (horizontal, toward the skater)
  private wallBox: THREE.Box3 | null = null; // the wall we're riding (for glue + run-off)
  private wallPath: WallPathRuntime | null = null;
  private wallPathS = 0;
  private wallPathSide = 1;
  private wallPathDir = 1;
  // --- LEDGE GRAB: hang off a lip you hit head-on; stepHang owns the state ---
  private ledgeT = 0; // grip time left before the hands give out
  private ledgeCoolT = 0; // re-grab lockout after a climb / hop / slip
  private ledgeEaseT = 0; // catch ease clock: pos glides from ledgeFrom to ledgeAnchor
  private readonly ledgeNormal = new THREE.Vector3(); // outward from the grabbed face
  private readonly ledgeAnchor = new THREE.Vector3(); // hang position (hands at the lip)
  private readonly ledgeLanding = new THREE.Vector3(); // validated feet point inward of the lip
  private ledgeMoverId: number | undefined; // moving support carried while hanging/climbing
  private readonly ledgeFrom = new THREE.Vector3(); // where the catch started (ease origin)
  private ledgeLip = 0; // TRUE landing height (probed walk surface, not the collider top)
  private ledgePose = 0; // visual weight of the hanging pose
  // the CLAMBER: a committed, animated pull-up-and-over (not a snap) — the
  // body eases up the face then over the lip along a rounded corner path
  private ledgePhase: 'grip' | 'climb' = 'grip';
  private ledgeClimbT = 0; // clamber clock
  private ledgeClimbK = 0; // clamber progress 0..1 (drives the mantle pose)
  private readonly ledgeClimbFrom = new THREE.Vector3();
  private readonly ledgeClimbTo = new THREE.Vector3();
  private ledgeAwayT = 0; // stick held AWAY this long lets go (hop down, no X needed)
  private ledgeShimmy = 0; // live along-ledge slide input (-1..1) — drives the hand-over-hand
  private ledgeClimbQueued = false; // preserves X pressed/held on the catch frame
  private ledgeControlRightSign: 1 | -1 = 1; // latch axisL handedness before a mounted catch drops the deck
  private readonly ledgeEnvelope: LedgeCatchEnvelope =
    ledgeCatchEnvelope(TUNING.ledgeReach, 0);
  // baked Mixamo braced-hang clips: which one is playing, its clock, and the
  // exit overlay weight (drop/fall clips bleed into the first beat of the air)
  private hangClipName: keyof typeof HANG_ANIMS | null = null;
  private hangClipT = 0;
  private hangClipRate = 1;
  private hangClipLoop = false;
  private hangExitW = 0;
  private wallSpeed = 0; // along-wall speed (heading held in axisF)
  private wallrideT = 0; // remaining ride time
  private wallCoolT = 0; // brief no-restick window after leaving a wall
  private wallrideLatched = false; // one wallride per air-time: blocks a new one until you touch ground or a rail
  private wallChargeT = 0; // how long X has been PUMPED on the wall — release to spring off, bigger with more charge
  private wallridePose = 0; // 0..1 visual tilt onto the wall
  private wallChargePose = 0; // 0..1 eased crouch while pumping the wall (visual charge tell)
  // Short timer set every frame you're on a halfpipe surface. ANY vert launch
  // taken while it's fresh becomes a pipeHang (suppressed stick-spin) — covers
  // both the dedicated coping launch AND the general crest a fast pump takes.
  private pipeRideT = 0;
  // UNIFIED SURFACE ALIGNMENT: one eased tilt that lays the whole rig onto the
  // surface — gently on banks, flat-out on vert walls, all the way through hang
  // time — so the body tracks the wall while riding AND while glued in the air.
  alignPose = 0; // 0 = upright, 1 = fully lying on alignNormal
  // Gameplay owns its own copy of the eased surface tilt. Touchdown judging
  // reads this, never a transform that Animation Studio is allowed to edit.
  private landingAlignPose = 0;
  readonly alignNormal = new THREE.Vector3(0, 1, 0); // eased surface normal the rig lies on
  skateOn = false; // debug: the charge is currently driving the board
  lastJumpType = '—'; // debug: what the last X release produced
  private jumpBufferT = 0; // X released just before touchdown: jump on landing
  private jumpBufferCharge = 0;
  private slideGraceT = 0; // window after a slide ends where a jump still slide-boosts
  private grindTime = 0; // how long this grind has lasted (balance ramps up)
  private grindCalmT = 0; // entry calm beat: seconds of steadied needle, bought by momentum carried ALONG the bar at the catch
  private grindStickStale = 0; // SIGN of the stick direction already held when the rail was caught (a side-scroll travel hold, not a lean): it can never push the needle outward, only steady it — until released or flipped once (0 = none)
  private balanceCritT = 0; // time spent pegged at the meter edge (bail grace)
  private snapOffset = new THREE.Vector3(); // entry offset, eased away on the rail
  private snapEase = 1; // 0 -> 1 over railSnapEase seconds after a grind starts
  private prevPos = new THREE.Vector3(); // for travel-direction facing
  private grindRail: Rail | null = null;
  private grindEntryT = 0; // where on the rail this grind STARTED, for the end-to-end check
  private grindBoostT = 0; // a perfect grind is briefly allowed past the normal speed ceiling
  private activeSpeedPadId = 0;
  private speedPadCap = 0;
  private returnPortalCoolT = 0;
  private readonly primitiveAirTricks = new Set<DeckTrickKind>();
  private readonly primitiveComboTricks = new Set<DeckTrickKind>();
  private trickGateHintT = 0; // throttle repeated lock copy while held into one gate
  private trickGateHintKind: DeckTrickKind | null = null;
  private trickGateImpactT = 0; // shorter physical-hit sound debounce (frame or lock)
  private readonly primitiveFrom = new THREE.Vector3();
  private readonly primitiveTo = new THREE.Vector3();
  private boostGlow!: THREE.Sprite; // pink bloom worn for the length of that window
  private grindT = 0;
  private grindDir = 1;
  private grindVel = 0; // grind speed = your speed at entry, bleeding slowly
  private grindStyle: GrindStyle = 'normal'; // held dir at entry (or last mid-grind switch)
  private pendingSpecialGrind: SpecialTrick | null = null;
  private specialGrind: SpecialTrick | null = null;
  // The boxes of the crate run currently being ground. THE LEDGE IS NOT AN
  // OBSTACLE: collide() reaches 0.35 below the feet on a grind so that crates
  // sitting ON a rail still clip you, and that same reach dips into the tops
  // of the very boxes you are riding. These are skipped for as long as the
  // grind lasts, and only these — a crate stacked on the run, or the next run
  // along, still hits you exactly as it should.
  private grindRun: Set<Crate> | null = null;
  // The box currently under the grind. Each one breaks as the rider CLEARS it
  // — when the next box takes over, and the last when the manoeuvre ends — so
  // riding a line of crates takes the line apart behind you and pays out every
  // box's contents on the way, rather than costing exactly one at the end.
  private grindCrate: Crate | null = null;
  private grindPoseX = 0; // nose-up / nose-down grind lean
  private grindPoseZ = 0; // which side the free end of the deck hangs off (smith/feeble/crook)
  private grindYawPose = 0; // boardslide: body across the rail
  private grindArmPose = 0; // arms out wide for balance on the rail
  private railUnder = false; // hanging BENEATH the rail (board crosswise in the hands)
  private underK = 0; // 0 = on top, 1 = hanging under; eases through the committed swing
  private grindUsedUnder = false; // Grindosaurus runs must remain top-side for the whole ride
  private underCoolT = 0; // switch cooldown: no rapid top/under spam
  private underProbeT = 0; // periodic clearance re-check while hanging (terrain rises -> pop back up)
  private boardSnapT = 0; // board snapped by an under-hang bail: hidden until this runs out
  private grindYawDir = 1;
  private grabTrickName = 'Grab'; // variant name for the combo readout
  private airGrabShown: string | null = null; // exact plate label this air's grab was pushed under (renamed live; merged with a landed spin)
  private grabPaid = 0; // what this air's grab actually paid — repriced when the variant resolves to a different trick's decay pool
  private comboUses = new Map<string, number>(); // per-combo trick use counts — repeats pay a declining share (THPS4/THUG)
  private sketchyT = 0; // off-balance shimmy after a SKETCHY landing (kept it, barely)
  private flipT = 0; // deck flip trick in progress: time left of CONST.flipTime
  private flipKind: DeckTrickKind = 'kick';
  private flipName = 'Kickflip';
  // Read-only gameplay evidence for trick gates/rails. The air set resets on
  // ground/bail/reset; the combo set survives connector landings and resets
  // only when that combo banks or is lost.
  private readonly deckTricksThisAir = new Set<DeckTrickKind>();
  private readonly deckTricksThisCombo = new Set<DeckTrickKind>();
  private ollieDeckTrickBufferT = 0; // recent Square edge during a held ground ollie charge
  private pendingSpecialFlip: SpecialTrick | null = null;
  private specialFlip: SpecialTrick | null = null;
  private flipDuration = CONST.flipTime;
  private revertT = 0; // beat after a vert-air touchdown where R2 = Revert (the THPS3+/THUG combo bridge)
  private vertInDrift = 0; // NON-pipe vert airs: gentle into-the-ramp carry so the ballistic arc comes down over the transition face, not the deck behind the coping
  private pipeEndFly = false; // flew off a pipe's END mid-hang: the landing judges it — a vert/rail/wall catch saves it, flat ground is the bail
  private rollOffT = 0; // rode out a pipe's open END partway up the wall: seconds left of the gradual level-out — land before the wheels are down and the tilt is judged like a fly-off
  private grindExitAir = false; // this air left a RAIL: held R2 may add transfer strafe; left/right alone only rotates
  private floatAir = false; // this air left the ground off a ramp/kicker/slope: fall at rampFallGravity (ballistic), not the flat-ollie snap
  private grabTickT = 0; // THPS accrual while the grab is held
  private grindTickT = 0; // THPS accrual while grinding
  private regrindCd = 0;
  // The rail we most recently left, and whether Triangle has been held down
  // continuously since. See tryGrind: a held button must not re-grab it.
  private lastRail: Rail | null = null;
  private grindLatched = false;
  private respawnTimer = 0;
  private coyoteTimer = 0; // jump grace after running off a ledge
  private crouchGraceT = 0; // crouch-jump grace: a static crouch that just ended still boosts a jump this long after
  private chargeTimer = 0; // X held on the ground: builds jump power + speed
  private charging = false;
  private chargePlanted = false; // charge began at a standstill: feet pinned
  private chargePose = 0;
  private invulnTimer = 0; // grace after a mask absorbs a hit
  // The alpha flicker used to double as the bail indicator. Now the RAGDOLL is
  // the indicator, so wipeout-origin grace runs silent — the flicker is only
  // for a mask absorbing a hit, where the body isn't tumbling to tell you.
  private invulnSilent = false;
  private maskMesh: THREE.Mesh | null = null;
  private maskBones: THREE.Object3D | null = null; // 3D crossbones under the skull on the 2nd mask
  private maskAnchor = new THREE.Vector3(); // scratch: head world position for the floating mask
  private maskSparks: { sprite: THREE.Sprite; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private maskSparkT = 0; // pink-spark emission accumulator (2nd + 3rd mask)
  private spinEffects: SpinEffectsPresentation | null = null;
  private floorX!: THREE.Group; // landing X pinned to the floor under the skater
  private floorXMat!: THREE.MeshBasicMaterial; // shared by both bars — one opacity
  private armR: THREE.Bone | null = null; // upper-arm bones (fur arm + fishnet + glove inside)
  private armL: THREE.Bone | null = null;
  private elbowR: THREE.Bone | null = null; // lower-arm bones inside each arm
  private elbowL: THREE.Bone | null = null;
  private wristR: THREE.Bone | null = null; // hand bones + grip sockets
  private wristL: THREE.Bone | null = null;
  private gloveLeft: CartoonGloveRig | null = null;
  private gloveRight: CartoonGloveRig | null = null;
  private riggedCartoonHands: RiggedCartoonHandPair | null = null;
  private riggedCartoonHandState: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
  private riggedCartoonHandError: string | null = null;
  private readonly stretchableBones: StretchableBoneComponent[] = [];
  private meshyTorso: MeshyTorsoComponent | null = null;
  private meshyHead: MeshyHeadComponent | null = null;
  private meshyShorts: MeshyShortsComponent | null = null;
  private readonly meshyFootwear: MeshyFootwearComponent[] = [];
  private headVisualCenter: THREE.Object3D | null = null;
  private headLookSocket: THREE.Object3D | null = null;
  private readonly headForward = new THREE.Vector3();
  private readonly headWorldQuaternion = new THREE.Quaternion();
  private upperG: THREE.Bone | null = null; // legacy torso control below the lower spine
  private spineG: THREE.Bone | null = null; // lower-spine additive/keyframe bone
  private headM: THREE.Bone | null = null; // semantic head bone carrying the imported skull
  private legs: THREE.Bone | null = null;
  private legL: THREE.Bone | null = null; // upper-leg bones
  private legR: THREE.Bone | null = null;
  private kneeL: THREE.Bone | null = null; // lower-leg bones
  private kneeR: THREE.Bone | null = null;
  private ankleL: THREE.Bone | null = null; // foot bones + contact sockets
  private ankleR: THREE.Bone | null = null;
  private toeL: THREE.Bone | null = null;
  private toeR: THREE.Bone | null = null;
  private humanoidSkeleton: THREE.Skeleton | null = null;
  // Kangaroo appendages — jointed for follow-through animation.
  // The tail is drawn in code and simulated (src/tail.ts), and Character Lab
  // can hide it without deleting its animation-ready semantic joint.
  private tail: Tail | null = null;
  /** Character Lab needs the tail and the body it hangs off. */
  get tailRef(): Tail | null {
    return this.tail;
  }
  get riderRef(): THREE.Group | null {
    return this.riderG;
  }
  private tailBodies: TailCollider[] = [];
  // hip anchor half-widths (rig space) — the placeholder + roo use ±0.115/z0;
  // a skinned model (fox) sets these from its actual hip bones so syncVisual's
  // leg-position formula plants the feet under the real hips
  private hipBaseR = { x: 0.115, z: 0 };
  private hipBaseL = { x: -0.115, z: 0 };
  // Live effective lengths used by the fixed-length leg solver. Character Lab
  // scales these without changing the canonical semantic joint identities.
  private upperLegLengthR = PROCEDURAL_THIGH_LENGTH;
  private upperLegLengthL = PROCEDURAL_THIGH_LENGTH;
  private lowerLegLengthR = PROCEDURAL_SHIN_LENGTH;
  private lowerLegLengthL = PROCEDURAL_SHIN_LENGTH;
  private ponyA: THREE.Group | null = null; // empty saved-track compatibility nodes
  private ponyB: THREE.Group | null = null;
  private walkPhase = 0; // procedural run cycle
  private walkAmp = 0;
  private idleAmp = 0;
  private boardG: THREE.Group | null = null; // board + wheels: pulled up during grabs
  // Everything that is HER (legs, tail, torso) under one group, so the rider
  // can be shifted as a unit relative to the board without disturbing a single
  // pose write — see plantOnDeck().
  private riderG: THREE.Group | null = null;
  // Sole footprint: the bottom corners of each foot, in its lowest available
  // joint's local space (ankle for the procedural rig, knee for imported
  // chunks). Constant for a given rig, measured once and pushed through the
  // live joint chain by plantOnDeck() each frame.
  private soleR: THREE.Vector3[] | null = null;
  private soleL: THREE.Vector3[] | null = null;
  private teetering = false; // stopped on a ledge lip, Crash-style wobble
  private teeterPhase = 0;
  private teeterPose = 0;
  // Sine of the slope along travel (from the SMOOTHED ride plane):
  // > 0 climbing, < 0 descending. Bounded ±1 by construction, so vert walls
  // pull hard but never explode the way the old tan-based grade did.
  private lastTy = 0;
  // TAKEOFF LIFT MEMORY. lastTy is read from the ride plane on the CURRENT
  // frame, and on the frame you actually cross a kicker's lip the ground ray
  // has already slid onto the flat beyond it — measured on the Flats 45-degree
  // ramp, ty collapses 0.707 -> 0.164 one frame before the wheels leave, so
  // the launch converted a sixth of the climb and you rolled off the edge with
  // no lift at all. Peak-hold the climbing slope for a beat so the takeoff
  // converts the ramp you were RIDING, not the frame you left it on.
  private liftTy = 0;
  private liftTyT = 0;
  // The ride plane: ground normal eased over time, so segmented transitions
  // read as one continuous curve instead of a stack of facets.
  private rideNormal = new THREE.Vector3(0, 1, 0);
  private shadowGroundY: number | null = null; // long-range floor probe for the blob shadow
  private lastGroundY = 0; // most recent real floor level — the landing X hovers here over a pit
  private groundHit: GroundHit | null = null;
  private railCand: { rail: Rail; sample: RailSample } | null = null;
  private lean = 0;

  private rawInput!: Input; // pre-remap stick (see step): slam/grab-spin/balance
  // Travel axes, latched across zone boundaries: the course usually runs
  // along -Z ('S'), but turned stretches run along +X ('E') / -X ('W').
  private travelDir: 'S' | 'E' | 'W' | 'N' = 'S';
  private axisF = new THREE.Vector3(0, 0, -1); // along-course
  private axisL = new THREE.Vector3(1, 0, 0); // stick-right sidestep
  private haltCd = 0; // screech-sound cooldown for wall stops
  private brakeT = 0; // how long Circle has been held as a brake on the board (eases the slow-down in)
  private brakeLockT = 0; // pull-back-brake RUN lock timer; refreshed while braking near a stop, counts down once the brake releases (then eases the walk back)
  private brakeRampT = 0; // after the run lock, walk/sidestep ease-back timer (counts down; movement scales 0->1 over brakeLockRamp)
  private oBrakeHold = false; // Circle brake CROUCH lock: no crawl until you release Circle (the classic lock-til-release, kept separate from the run lock)
  private walkRamp = 0; // regular-walk intent fraction (0->1 over walkRampTime, then eases down over walkSlowdownTime)
  private walkVelocity = new THREE.Vector3(); // physical on-foot momentum, including sidesteps and release coast
  private walkTarget = new THREE.Vector3(); // scratch: desired course-relative on-foot velocity
  private walkTurnaround = false; // full-run direction change: gait/facing lead while momentum crosses over
  private walkIntent = new THREE.Vector3(); // world heading presented immediately during a committed turnaround
  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private feetBox = new THREE.Box3(); // body box WITHOUT the grind reach-down (pit checks)
  private spinBox = new THREE.Box3();
  private enemyTouch = new THREE.Box3(); // scratch: shrunken enemy touch box
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; dust?: boolean }[] = [];
  // PS1 puff bookkeeping. The landing burst needs the descent speed from the
  // step BEFORE touchdown — by the time `grounded` flips, vVel has been zeroed
  // by the landing itself, so it has to be carried forward a tick.
  private pfWasGrounded = true;
  private pfPrevVVel = 0;
  private pfWasSlamming = false;
  private runStepSign = 1; // footfall edge detector for the run dust trail
  private jumpPose = 0; // on-foot jump: overhead arm throw + leg tuck (Crash reference)
  // One wumpa out of a smashed crate, through its whole life.
  //
  //   idle  hanging where the crate was, WAITING TO BE PICKED UP
  //   fly   collected: on the flat overlay layer, sailing to the HUD counter
  //   flung spun away instead of collected, ballistic then gone
  //
  // `idle` is the phase this pool didn't used to have. Fruit arced out of the
  // box and homed to the counter on its own, which meant breaking a box WAS
  // collecting its fruit — the burst was decoration over a number that had
  // already gone up. Now the box gives you fruit and picking it up is still a
  // thing you do.
  //
  // Nothing falls on the way IN any more: fruit does not arc, scatter or land,
  // it appears in a clump where the box stood and hangs there (see spawnFruit).
  // `flung` is the one ballistic path left, and it is an exit — fruit you chose
  // to smack away rather than collect.
  //
  // `mesh` is a holder Group, NOT the wumpaMesh itself: the fruit is an
  // authored model that arrives async and rescales its own group when it
  // lands (src/wumpa.ts), so anything that resizes the fruit — the overlay
  // does, every frame — has to own a wrapper the loader will not touch.
  private fruits: {
    mesh: THREE.Group;
    vel: THREE.Vector3;
    phase: 'off' | 'idle' | 'fly' | 'flung';
    t: number; // seconds in the current phase
    hop: number; // seconds left of the canned spawn bounce (spin-proof while > 0)
    home: THREE.Vector3; // where it hangs, before the idle bob
    sx: number; // overlay position, screen fractions (0..1)
    sy: number;
  }[] = [];
  cam: THREE.PerspectiveCamera | null = null; // set by main: wumpa fly to the HUD counter, which lives on the lens
  /** Set by main: where the HUD fruit counter is, in 0..1 screen fractions. */
  hudFruitAt: (() => { x: number; y: number } | null) | null = null;
  // The collected-fruit layer: a flat scene with an orthographic camera whose
  // frustum is one unit tall, so a fruit placed in it is a FIXED FRACTION OF
  // THE SCREEN however far the world position it came from happened to be.
  // That is the whole reason it exists — a fruit flying through world space
  // toward the lens swells as it comes, and the flight is a UI gesture, not an
  // object moving through the level.
  private fruitLayer: THREE.Scene | null = null;
  private fruitLayerCam: THREE.OrthographicCamera | null = null;
  /** Viewport aspect, from the last overlay draw — the flight measures its
   *  remaining distance in overlay units, not raw screen fractions. */
  private fruitAspect = 16 / 9;
  /** Last seen run-mode state, so entering one can clear the loose fruit once. */
  private fruitRunMode = false;
  /** The world scene, kept so a retired fruit can be put back on it. */
  private worldScene!: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.bodyGroup = this.buildVisual();
    this.restoreCharacterTailVisibilityPreference();
    // YXZ so the yaw (facing travel) is the OUTERMOST rotation: the flip and
    // pose pitch on rotation.x then happen in the FACING frame, so a front
    // flip always tumbles along the direction you're actually moving — not
    // about a fixed world axis (which made it look wrong going sideways/back).
    this.bodyGroup.rotation.order = 'YXZ';
    // Slightly chunkier character, Crash-proportioned against the corridor,
    // stretched a little extra in Y (taller, not wider). Visual only — the
    // collision box in tuning.ts is unchanged (slightly forgiving hitboxes).
    this.bodyGroup.scale.set(1.18, 1.36, 1.18);
    this.group.add(this.bodyGroup);
    this.group.rotation.y = Math.PI; // model nose points down the course (-Z)
    scene.add(this.group);
    this.rebuildHumanoidSkeleton();
    this.playerAnimationBridge = new PlayerAnimationBridge(this.group, this.bodyGroup);
    this.characterProportionLayer = new CharacterProportionLayer(this.bodyGroup);
    characterProportionSettings.subscribe(() => {
      this.syncCharacterAppearance();
      this.resetRenderInterpolation();
    }, true);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      void this.installRiggedCartoonHands();
    }
    this.installSpinEffects(); // Unity Whirlwind Vixen + orbital rings

    // Landing X: a small cross pinned to the floor under the skater — the
    // precise "you land HERE" mark. There used to be a soft dark blob under it
    // too, from back when that was the only shadow in the game; the real cast
    // shadow does that job now, so the blob was just a second smudge stacked
    // on the first. The X rides a long-range floor probe, growing a touch with
    // height so it stays readable from big airs, and FADING with that height
    // so it is gone while you are stood on the floor (where it marks nothing
    // you can't already see) and reads back in as you leave the ground.
    const xMat = new THREE.MeshBasicMaterial({
      color: 0xffe36e,
      transparent: true,
      opacity: X_ALPHA,
      depthWrite: false,
    });
    const xGroup = new THREE.Group();
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.08), xMat);
      bar.rotation.z = a;
      bar.renderOrder = 2;
      xGroup.add(bar);
    }
    xGroup.rotation.x = -Math.PI / 2;
    xGroup.visible = false;
    scene.add(xGroup);
    this.floorX = xGroup;
    this.floorXMat = xMat;

    // Floating Aku mask, visible while you hold one.
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.12),
      new THREE.MeshLambertMaterial({ color: 0xd08a3a }),
    );
    const maskEyeMat = new THREE.MeshBasicMaterial({ color: 0x3a2210 });
    for (const side of [-0.1, 0.1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.03), maskEyeMat);
      eye.position.set(side, 0.08, 0.07);
      mask.add(eye);
    }
    mask.visible = false;
    scene.add(mask);
    this.maskMesh = mask;
    this.installSkullMask(); // swap the box mask for the sculpted spiked skull once it loads
    this.installMaskBones(); // 3D crossbones under the skull, shown only on the 2nd mask

    // (The mask used to wear a big fiery-pink aura sprite behind it. It read as
    // a bloom smeared over the skull rather than light coming off it, and it
    // fought the black rim the skull already carries, so it is gone. The radial
    // helper below still builds the perfect-grind halo.)
    const radial = (stops: [number, string][]): THREE.CanvasTexture => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 128;
      const c = cv.getContext('2d')!;
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      for (const [o, col] of stops) g.addColorStop(o, col);
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv);
      t.needsUpdate = true;
      return t;
    };
    // A second bloom of the same make for the perfect-grind boost. Its own
    // sprite rather than sharing the mask's: both can be live at once (uber
    // AND a perfect grind), and one would otherwise be overwriting the
    // other's position and scale every frame.
    const boostGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        // A HALO, not a fireball. The first build peaked white-hot at the
        // centre and additive-blended the skater clean out of the picture —
        // you could see the boost but not who was having it. The ramp now
        // dips in the middle and peaks in a ring outside the body, so the
        // character reads through it.
        map: radial([
          [0.0, 'rgba(255,150,220,0.16)'],
          [0.3, 'rgba(255,90,205,0.30)'],
          [0.5, 'rgba(255,45,180,0.52)'],
          [0.72, 'rgba(235,10,150,0.26)'],
          [0.9, 'rgba(210,0,130,0)'],
          [1.0, 'rgba(210,0,130,0)'],
        ]),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    boostGlow.renderOrder = -2;
    boostGlow.visible = false;
    scene.add(boostGlow);
    this.boostGlow = boostGlow;
    // Pink spark pool: a comet-tail of embers streaming off the mask on the 2nd
    // mask and off the skater on the 3rd. Reused round-robin.
    const sparkTex = radial([
      [0.0, 'rgba(255,190,225,1.0)'],
      [0.4, 'rgba(255,45,150,0.9)'],
      [1.0, 'rgba(230,0,110,0)'],
    ]);
    for (let i = 0; i < 28; i++) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: sparkTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sp.visible = false;
      scene.add(sp);
      this.maskSparks.push({ sprite: sp, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    // Chunky PS1 spark pool for grinds and grab-boost landings.
    const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffb545 }));
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    // Wumpa pool: fruit appears where a box was and waits to be picked up.
    this.worldScene = scene;
    // Seed enough bodies for a normal crate or two; freeFruit grows the pool
    // from here on demand, so this is a warm-up, not a budget.
    for (let i = 0; i < 12; i++) this.addFruitBody();

    // The collected-fruit overlay. Its own lights, because a scene draws with
    // the lights it holds and this one holds nothing else.
    const layer = new THREE.Scene();
    layer.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(0.4, 0.8, 1);
    layer.add(key);
    this.fruitLayer = layer;
    // 1 unit tall, width set per frame from the aspect. Depth range is roomy
    // because nothing in here has depth to speak of.
    this.fruitLayerCam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -10, 10);
  }

  get spinning(): boolean {
    return this.spinTimer > 0;
  }

  get specialMeter(): number {
    return this.special.value;
  }

  get specialReady(): boolean {
    return this.special.ready;
  }

  get activeSpecialName(): string | null {
    return this.specialFlip?.label ?? this.specialGrab?.label ?? this.specialGrind?.label ?? null;
  }

  get specialSequence(): number {
    return this.specialActivationCount;
  }

  get comboActionRevision(): number {
    return this.comboHudActionRevision;
  }

  /** Non-authoritative Unity-style plate projection while a deck trick turns. */
  get comboHudPreview(): ComboHudPreview | null {
    if (
      this.flipT <= 0 ||
      this.state !== 'air' ||
      this.grounded ||
      this.isBailing
    ) return null;
    const base = this.specialFlip?.points ?? CONST.ptsFlip;
    const uses = this.comboUses.get(this.flipName) ?? 0;
    const curve = CONST.repeatDecay;
    let pay = Math.round(base * curve[Math.min(uses, curve.length - 1)]);
    if (this.uberTimer > 0) pay *= CONST.uberScoreMult;
    const shown = `${this.uberTimer > 0 ? 'Tiki ' : ''}${this.flipName}`;
    return {
      points: this.comboPoints + pay,
      multiplier: this.comboMult + 1,
      labels: sourceComboLabelLine(projectComboLabels(this.comboLabels, shown)),
      sequence: this.deckTrickPreviewSequence,
    };
  }

  // The floor under the skater, wherever they are in the air — the camera
  // rig anchors its height to THIS (Crash rules: jumps tilt the view, they
  // never yank the rig skyward), and it's what the shadow/landing-X ride.
  get groundBelowY(): number | null {
    return this.shadowGroundY;
  }

  // CHASE CAM: is the current travel a real heading — flat-ish ground or a
  // grind — rather than cross-pipe oscillation or an air the camera should
  // coast through? Transition walls and pipe troughs never steer the chase
  // (the level's spine is camera noise); main.ts reads this every frame.
  get chaseSteady(): boolean {
    if (this.state === 'grind') return true;
    if (this.state !== 'ride' || !this.grounded) return false;
    const g = this.groundHit;
    return !g || (g.normal.y > 0.9 && g.halfpipe === undefined);
  }

  get sliding(): boolean {
    return this.slideContactLatch || (this.slideTimer > 0 && this.state === 'ride' && this.grounded);
  }

  private get animationPlanarSpeed(): number {
    if (this.state === 'rope' || this.state === 'hang') return 0;
    return Math.max(
      0,
      this.lastPlanar,
      this.walkVelocity.length(),
      Math.abs(this.speed),
    );
  }

  /**
   * Read-only presentation intent for the authored-animation runtime. Landing
   * and the run-to-idle pacing stop are deliberately detected there from
   * gameplay-state edges rather than becoming movement states themselves.
   */
  get animationClipHint(): PlayerAnimationClipHint {
    if (this.isBailing || this.state === 'dead' || this.state === 'gameover') return 'player.bail';
    if (this.state === 'rope') return 'player.rope';
    if (this.state === 'hang') return this.ledgePhase === 'climb' ? 'player.climb' : 'player.hang';
    if (this.state === 'grind') return 'player.grind';
    if (this.slamActive || this.slamFlatT > 0 || this.slamSquash > 0) return 'player.slam';
    if (this.grabbing || this.grabPose > 0.25 || this.specialGrab !== null) return 'player.grab';
    if (this.spinTimer > 0 || this.flipT > 0) return 'player.spin';
    if (this.sliding || this.slidePose > 0.25) return 'player.slide';
    if (this.crawling) {
      return Math.abs(this.speed) > 0.5 ? 'player.crawl' : 'player.crouch';
    }
    if (this.state === 'air' || !this.grounded) {
      return this.vVel > 0 ? 'player.jump' : 'player.fall';
    }
    if (this.freeSkate || this.skatePose > 0.25 || this.deckPose > 0.25) return 'player.skate';
    return this.animationPlanarSpeed > RUN_ANIMATION_THRESHOLD ? 'player.run' : 'player.idle';
  }

  /**
   * Deterministic fixed-step inputs for pure procedural animation drivers.
   * Every value is presentation-only and copied out as a finite scalar.
   */
  get animationIntent(): PlayerAnimationIntent {
    const clipId = this.animationClipHint;
    const gaitPhase = ((this.walkPhase / (Math.PI * 2)) % 1 + 1) % 1;
    const speedReference =
      clipId === 'player.crawl' || clipId === 'player.crouch'
        ? Math.max(TUNING.crawlSpeed, 0.001)
        : this.freeSkate || this.airFromSkate || this.state === 'grind'
          ? Math.max(TUNING.maxSpeed, 0.001)
          : Math.max(TUNING.walkSpeed, 0.001);
    const planarSpeed = this.animationPlanarSpeed;
    const normalizedSpeed = THREE.MathUtils.clamp(planarSpeed / speedReference, 0, 1);
    const crawlMotion = this.crawlPose * Math.min(1, planarSpeed / 1.2);
    const crouchPose = Math.max(0, this.crawlPose - crawlMotion);
    const charge = THREE.MathUtils.clamp(
      this.chargeTimer / Math.max(TUNING.jumpChargeTime, 0.001),
      0,
      1,
    );
    const skateCharge = THREE.MathUtils.clamp(
      this.skateCharge / Math.max(TUNING.skateHoldTime, 0.001),
      0,
      1,
    );
    const slideProgress = THREE.MathUtils.clamp(
      1 - this.slideDistanceLeft / Math.max(TUNING.slideDistance, 0.001),
      0,
      1,
    );
    const spinProgress = this.spinTimer > 0
      ? THREE.MathUtils.clamp(1 - this.spinTimer / Math.max(TUNING.spinDuration, 0.001), 0, 1)
      : this.flipT > 0
        ? THREE.MathUtils.clamp(1 - this.flipT / Math.max(this.flipDuration, 0.001), 0, 1)
        : 0;
    const slamProgress = this.slamActive
      ? this.slamHangT > 0
        ? 0.33 * (1 - this.slamHangT / Math.max(CONST.slamHang, 0.001))
        : 0.66
      : this.slamSquash > 0
        ? 0.66 + 0.17 * (1 - this.slamSquash / Math.max(CONST.slamSquashTime, 0.001))
        : this.slamFlatT > 0
          ? 0.83 + 0.17 * (1 - this.slamFlatT / Math.max(CONST.slamFlat, 0.001))
          : 0;
    const bailProgress = this.isBailing
      ? this.bailRecoverT >= 0
        ? 0.5 + 0.5 * this.bailRecoveryPose
        : 0.5 * (1 - this.bailDownT / Math.max(CONST.bailDownTime, 0.001))
      : 0;
    let actionProgress = 0;
    if (clipId === 'player.idle' || clipId === 'player.run' || clipId === 'player.crawl' || clipId === 'player.skate') {
      actionProgress = gaitPhase;
    } else if (clipId === 'player.jump') {
      actionProgress = this.launchVy > 0
        ? 1 - Math.max(0, this.vVel) / this.launchVy
        : this.airborneT;
    } else if (clipId === 'player.fall') {
      actionProgress = -this.vVel / Math.max(TUNING.hugeDropImpact, 0.001);
    } else if (clipId === 'player.crouch') {
      actionProgress = this.crawlPose;
    } else if (clipId === 'player.slide') {
      actionProgress = slideProgress;
    } else if (clipId === 'player.grind') {
      actionProgress = this.grindTime;
    } else if (clipId === 'player.grab') {
      actionProgress = this.grabPose;
    } else if (clipId === 'player.hang') {
      actionProgress = this.ledgeEaseT / LEDGE_EASE;
    } else if (clipId === 'player.climb') {
      actionProgress = this.ledgeClimbK;
    } else if (clipId === 'player.rope') {
      actionProgress = charge;
    } else if (clipId === 'player.slam') {
      actionProgress = slamProgress;
    } else if (clipId === 'player.bail') {
      actionProgress = bailProgress;
    } else if (clipId === 'player.spin') {
      actionProgress = spinProgress;
    }
    actionProgress = THREE.MathUtils.clamp(actionProgress, 0, 1);
    const travelSign = Math.sign(this.speed);
    return {
      clipId,
      motion: {
        normalizedSpeed,
        gaitPhase,
        verticalVelocity: Number.isFinite(this.vVel) ? this.vVel : 0,
        grounded: this.grounded,
        actionProgress,
        inputs: {
          travelSign,
          signedSpeed: normalizedSpeed * travelSign,
          balance: THREE.MathUtils.clamp(this.balance, -1, 1),
          charge,
          skateCharge,
          crawl: THREE.MathUtils.clamp(crawlMotion, 0, 1),
          crouch: THREE.MathUtils.clamp(crouchPose, 0, 1),
          skate: THREE.MathUtils.clamp(this.skatePose, 0, 1),
          deck: THREE.MathUtils.clamp(this.deckPose, 0, 1),
          slide: THREE.MathUtils.clamp(this.slidePose, 0, 1),
          grab: THREE.MathUtils.clamp(this.grabPose, 0, 1),
          hang: THREE.MathUtils.clamp(Math.max(this.hangPose, this.ledgePose), 0, 1),
          climb: THREE.MathUtils.clamp(this.ledgeClimbK, 0, 1),
          rope: this.state === 'rope' ? 1 : 0,
          grind: this.state === 'grind' ? 1 : 0,
          slam: THREE.MathUtils.clamp(slamProgress, 0, 1),
          bail: this.isBailing ? 1 : 0,
          spin: spinProgress,
          manual: this.manualing,
          stance: this.stance,
          slope: THREE.MathUtils.clamp(this.slopePose, 0, 1),
          align: THREE.MathUtils.clamp(this.alignPose, 0, 1),
          wallride: this.wallriding ? 1 : 0,
          airborne: this.grounded ? 0 : 1,
        },
      },
    };
  }

  // Reaching for or holding the grab (air control locks during these).
  private get grabbing(): boolean {
    return this.grabPhase === 'enter' || this.grabPhase === 'held';
  }

  // debug readouts for the jump/skate-commit system
  get xHoldT(): number {
    return this.chargeTimer;
  }
  get skateChargeT(): number {
    return this.skateCharge;
  }

  get bailRecoveryK(): number {
    return this.bailRecoveryPose;
  }

  get bailTimeLeft(): number {
    return this.bailDownT;
  }

  get ragdollImpactCount(): number {
    return this.ragImpacts;
  }

  get ragdollFishJumps(): number {
    return this.ragFishJumps;
  }

  get spinEffectDiagnostics(): SpinPresentationDiagnostics | null {
    return this.spinEffects?.diagnostics ?? null;
  }

  /** Monotonic teleport epoch consumed by the render-clock camera. */
  get renderSnapVersion(): number {
    return this._renderSnapVersion;
  }

  /** Stable semantic rig data for Animation Studio and authored overlays. */
  get animationRig(): PlayerAnimationRig {
    return this.playerAnimationBridge.rig;
  }

  /** Conventional live humanoid skeleton shared by authoring and future skins. */
  get humanoidSkeletonRef(): THREE.Skeleton | null {
    return this.humanoidSkeleton;
  }

  get characterTailVisible(): boolean {
    return this.characterTailVisibleValue;
  }

  get cartoonGloveDiagnostics(): {
    readonly ready: boolean;
    readonly bonesPerHand: number;
    readonly digitCountPerHand: number;
    readonly gripSockets: readonly string[];
  } {
    const gloves = [this.gloveLeft, this.gloveRight].filter(
      (glove): glove is CartoonGloveRig => glove !== null,
    );
    return {
      ready: gloves.length === 2,
      bonesPerHand: gloves[0]?.bones.length ?? 0,
      digitCountPerHand: gloves[0] ? Object.keys(gloves[0].fingers).length : 0,
      gripSockets: gloves.map((glove) => glove.gripSocket.name),
    };
  }

  get riggedCartoonHandDiagnostics(): {
    readonly state: 'idle' | 'loading' | 'ready' | 'failed';
    readonly ready: boolean;
    readonly sides: readonly string[];
    readonly bonesPerHand: number;
    readonly triangles: number;
    readonly decorationTriangles: number;
    readonly dorsalMarks: number;
    readonly cuffColor: number;
    readonly dorsalMarkColor: number;
    readonly credit: string | null;
    readonly error: string | null;
  } {
    const pair = this.riggedCartoonHands;
    return {
      state: this.riggedCartoonHandState,
      ready: pair !== null,
      sides: pair ? [pair.left.side, pair.right.side] : [],
      bonesPerHand: pair ? pair.left.bonesByName.size : 0,
      triangles: pair?.triangleCount ?? 0,
      decorationTriangles: pair?.decorationTriangleCount ?? 0,
      dorsalMarks: pair
        ? pair.left.decorations.length / 2 + pair.right.decorations.length / 2
        : 0,
      cuffColor: RIGGED_CARTOON_HAND_COLOR,
      dorsalMarkColor: RIGGED_CARTOON_HAND_MARK_COLOR,
      credit: pair?.credit ?? null,
      error: this.riggedCartoonHandError,
    };
  }

  get stretchableBoneDiagnostics(): {
    readonly ready: boolean;
    readonly componentCount: number;
    readonly ids: readonly string[];
    readonly triangles: number;
    readonly minScale: number;
    readonly maxScale: number;
    readonly surfaces: Readonly<Record<string, number>>;
  } {
    const surfaces: Record<string, number> = {};
    for (const component of this.stretchableBones) {
      const surface = component.root.userData.stretchableBoneRuntime?.surface ?? 'unknown';
      surfaces[surface] = (surfaces[surface] ?? 0) + 1;
    }
    return {
      ready: this.stretchableBones.length === 8,
      componentCount: this.stretchableBones.length,
      ids: this.stretchableBones.map((component) => component.id),
      triangles: this.stretchableBones.reduce(
        (sum, component) => sum + stretchableBoneTriangleCount(component),
        0,
      ),
      minScale: Math.min(...this.stretchableBones.map((component) => component.minScale), 1),
      maxScale: Math.max(...this.stretchableBones.map((component) => component.maxScale), 1),
      surfaces,
    };
  }

  get meshyTorsoDiagnostics(): {
    readonly ready: boolean;
    readonly triangles: number;
    readonly sourceSha256: string | null;
    readonly skinBones: readonly string[];
    readonly textureState: 'idle' | 'loading' | 'ready' | 'failed';
    readonly texturesLoaded: number;
    readonly textureError: string | null;
  } {
    const component = this.meshyTorso;
    const textures = meshyTorsoTextureDiagnostics();
    return {
      ready: component !== null,
      triangles: component?.triangles ?? 0,
      sourceSha256: component?.sourceSha256 ?? null,
      skinBones: component?.skeleton.bones.map((bone) => bone.name) ?? [],
      textureState: textures.state,
      texturesLoaded: textures.loaded,
      textureError: textures.error,
    };
  }

  get meshyHeadDiagnostics(): {
    readonly ready: boolean;
    readonly triangles: number;
    readonly sourceSha256: string | null;
    readonly textureState: 'idle' | 'loading' | 'ready' | 'failed';
    readonly texturesLoaded: number;
    readonly textureError: string | null;
  } {
    const component = this.meshyHead;
    const textures = meshyHeadTextureDiagnostics();
    return {
      ready: component !== null,
      triangles: component?.triangles ?? 0,
      sourceSha256: component?.sourceSha256 ?? null,
      textureState: textures.state,
      texturesLoaded: textures.loaded,
      textureError: textures.error,
    };
  }

  get meshyShortsDiagnostics(): {
    readonly ready: boolean;
    readonly triangles: number;
    readonly sourceSha256: string | null;
    readonly skinBones: readonly string[];
    readonly textureState: 'idle' | 'loading' | 'ready' | 'failed';
    readonly texturesLoaded: number;
    readonly textureError: string | null;
  } {
    const component = this.meshyShorts;
    const textures = meshyShortsTextureDiagnostics();
    return {
      ready: component !== null,
      triangles: component?.triangles ?? 0,
      sourceSha256: component?.sourceSha256 ?? null,
      skinBones: component?.skeleton.bones.map((bone) => bone.name) ?? [],
      textureState: textures.state,
      texturesLoaded: textures.loaded,
      textureError: textures.error,
    };
  }

  get meshyFootwearDiagnostics(): {
    readonly ready: boolean;
    readonly triangles: number;
    readonly sourceSha256: string | null;
    readonly sides: readonly string[];
    readonly sockSkinBones: readonly (readonly string[])[];
    readonly textureState: 'idle' | 'loading' | 'ready' | 'failed';
    readonly texturesLoaded: number;
    readonly textureError: string | null;
  } {
    const textures = meshyFootwearTextureDiagnostics();
    return {
      ready: this.meshyFootwear.length === 2,
      triangles: this.meshyFootwear.reduce((sum, component) => sum + component.triangles, 0),
      sourceSha256: this.meshyFootwear[0]?.sourceSha256 ?? null,
      sides: this.meshyFootwear.map((component) => component.side),
      sockSkinBones: this.meshyFootwear.map((component) =>
        component.skeleton.bones.map((bone) => bone.name)),
      textureState: textures.state,
      texturesLoaded: textures.loaded,
      textureError: textures.error,
    };
  }

  setCartoonGlovePreviewPose(name: CartoonGlovePoseName): void {
    if (!this.playerAnimationBridge.previewActive) {
      throw new Error('cartoon glove preview poses require an animation preview session');
    }
    const pose = CARTOON_GLOVE_POSES[name];
    if (!pose) throw new Error(`unknown cartoon glove pose: ${String(name)}`);
    if (this.gloveLeft) setCartoonGlovePose(this.gloveLeft, pose);
    if (this.gloveRight) setCartoonGlovePose(this.gloveRight, pose);
    this.syncRiggedCartoonHands();
    this.bodyGroup.updateMatrixWorld(true);
    this.resetRenderInterpolation();
  }

  get characterProportions(): Readonly<CharacterProportionSettingsValue> {
    return characterProportionSettings.value;
  }

  get characterProportionDiagnostics(): {
    readonly settings: Readonly<CharacterProportionSettingsValue>;
    readonly appliedObjectCount: number;
    readonly tailVisible: boolean;
  } {
    return {
      settings: { ...characterProportionSettings.value },
      appliedObjectCount: this.characterProportionLayer.appliedObjectCount,
      tailVisible: this.characterTailVisibleValue,
    };
  }

  setCharacterProportions(patch: Partial<CharacterProportionSettingsValue>): void {
    characterProportionSettings.patch(patch);
  }

  resetCharacterProportions(): void {
    characterProportionSettings.reset();
  }

  private characterLegHeightDelta(): number {
    const shape = characterProportionSettings.value;
    return (
      PROCEDURAL_THIGH_LENGTH * (shape.thighLength - 1) +
      PROCEDURAL_SHIN_LENGTH * (shape.shinLength - 1)
    );
  }

  private characterWaistLocal(base: number): number {
    return base + this.characterLegHeightDelta();
  }

  private characterWaistHeight(base: number): number {
    const shape = characterProportionSettings.value;
    return this.characterWaistLocal(base) * shape.overallScale * shape.height;
  }

  get characterTailVisibilityState(): {
    label: 'ON' | 'OFF';
    active: boolean;
    detail: string;
  } {
    return {
      label: this.characterTailVisibleValue ? 'ON' : 'OFF',
      active: this.characterTailVisibleValue,
      detail: this.characterTailVisibleValue
        ? 'Procedural character tail shown · click to hide it'
        : 'Procedural character tail hidden · click to restore it',
    };
  }

  setCharacterTailVisible(visible: boolean): void {
    this.characterTailVisibleValue = Boolean(visible);
    try {
      localStorage.setItem(
        CHARACTER_TAIL_VISIBILITY_STORAGE_KEY,
        this.characterTailVisibleValue ? '1' : '0',
      );
    } catch {
      // Private browsing can disable persistence without disabling the toggle.
    }
    this.syncCharacterTailVisibility();
    this.resetRenderInterpolation();
  }

  toggleCharacterTailVisibility(): void {
    this.setCharacterTailVisible(!this.characterTailVisibleValue);
  }

  /** Reapply the persistent Character Lab design after any pose/snapshot write. */
  syncCharacterAppearance(): void {
    this.characterProportionLayer.apply(characterProportionSettings.value);
    this.syncCharacterTailVisibility();
    this.bodyGroup.updateMatrixWorld(true);
    this.syncRiggedCartoonHands();
  }

  private async installRiggedCartoonHands(): Promise<void> {
    if (this.riggedCartoonHandState !== 'idle' || !this.gloveLeft || !this.gloveRight) return;
    const left = this.gloveLeft;
    const right = this.gloveRight;
    this.riggedCartoonHandState = 'loading';
    this.riggedCartoonHandError = null;
    let pendingPair: RiggedCartoonHandPair | null = null;
    try {
      pendingPair = await loadRiggedCartoonHandPair();
      attachAndSyncRiggedCartoonHandPair(pendingPair, left, right);
      this.bodyGroup.updateMatrixWorld(true);
      this.riggedCartoonHands = pendingPair;
      this.riggedCartoonHandState = 'ready';
      removeProceduralCartoonGloveSurface(left);
      removeProceduralCartoonGloveSurface(right);
      this.resetRenderInterpolation();
    } catch (error) {
      pendingPair?.left.root.removeFromParent();
      pendingPair?.right.root.removeFromParent();
      this.riggedCartoonHands = null;
      this.riggedCartoonHandState = 'failed';
      this.riggedCartoonHandError = error instanceof Error ? error.message : String(error);
      // The procedural fallback was not removed, so the character remains usable.
      console.error('Rigged cartoon hand failed to load', error);
    }
  }

  private syncRiggedCartoonHands(): void {
    if (!this.riggedCartoonHands || !this.gloveLeft || !this.gloveRight) return;
    this.riggedCartoonHands.left.syncFrom(this.gloveLeft);
    this.riggedCartoonHands.right.syncFrom(this.gloveRight);
  }

  private clearCharacterAppearance(): void {
    this.characterProportionLayer.clear();
  }

  private restoreCharacterTailVisibilityPreference(): void {
    try {
      const saved = localStorage.getItem(CHARACTER_TAIL_VISIBILITY_STORAGE_KEY);
      if (saved === '0') this.characterTailVisibleValue = false;
      else if (saved === '1') this.characterTailVisibleValue = true;
    } catch {
      // Default-on remains available when browser storage is blocked.
    }
    this.syncCharacterTailVisibility();
  }

  private syncCharacterTailVisibility(): void {
    if (this.tail) this.tail.root.visible = this.characterTailVisibleValue;
  }

  /**
   * Rebuild bind inverses only after every bone has a current world matrix.
   * The body is still assembled from rigid meshes, but exposing one ordinary
   * THREE.Skeleton lets a later SkinnedMesh bind to this exact live rig.
   */
  private rebuildHumanoidSkeleton(): void {
    const boneNames: string[] = [
      'hips',
      'torso-root',
      'spine',
      'chest',
      'neck',
      'head',
      'clavicle-left',
      'shoulder-left',
      'elbow-left',
      'wrist-left',
      'clavicle-right',
      'shoulder-right',
      'elbow-right',
      'wrist-right',
      'hip-left',
      'knee-left',
      'ankle-left',
      'toe-left',
      'hip-right',
      'knee-right',
      'ankle-right',
      'toe-right',
      ...(this.gloveLeft?.bones.map((bone) => bone.name) ?? []),
      ...(this.gloveRight?.bones.map((bone) => bone.name) ?? []),
    ];
    const bones: THREE.Bone[] = [];
    for (const name of boneNames) {
      const node = this.bodyGroup.getObjectByName(name);
      if ((node as THREE.Bone | undefined)?.isBone) bones.push(node as THREE.Bone);
    }
    if (bones.length !== boneNames.length) {
      throw new Error(`humanoid rig resolved ${bones.length}/${boneNames.length} bones`);
    }
    this.bodyGroup.updateWorldMatrix(true, true);
    this.humanoidSkeleton?.dispose();
    this.humanoidSkeleton = new THREE.Skeleton(bones);
    // THREE.Skeleton's constructor also initializes inverses, but this explicit
    // pass documents and enforces the important ordering above.
    this.humanoidSkeleton.calculateInverses();
  }

  get animationPreviewActive(): boolean {
    return this.playerAnimationBridge.previewActive;
  }

  /**
   * Give Animation Studio temporary ownership of the visual hierarchy.
   * Interpolated RAF transforms are removed before the authoritative pose is
   * captured, so closing the studio can never feed an in-between pose back to
   * gameplay.
   */
  enterAnimationPreview(): PlayerAnimationRig {
    this.restoreRenderPose();
    this.clearCharacterAppearance();
    this.resetRenderInterpolation();
    return this.playerAnimationBridge.enterPreview();
  }

  /** Restore the entry pose but retain Animation Studio ownership. */
  resetAnimationPreview(): void {
    this.clearCharacterAppearance();
    this.playerAnimationBridge.resetPreview();
    this.tail?.reset();
    this.resetRenderInterpolation();
    this.syncCharacterAppearance();
  }

  /** Restore the entry pose and return pose ownership to gameplay. */
  exitAnimationPreview(): void {
    this.clearCharacterAppearance();
    this.playerAnimationBridge.exitPreview();
    this.tail?.reset();
    this.resetRenderInterpolation();
    this.syncCharacterAppearance();
  }

  /**
   * Animation Studio's scalar-track adapter. It is deliberately preview-only;
   * live gameplay uses setAuthoredPoseOverlay(), whose callback receives the
   * same deformation operation inside a guarded post-legacy pass.
   */
  applyAnimationDeformations(values: Readonly<Record<string, number>>): void {
    if (!this.playerAnimationBridge.previewActive)
      throw new Error('independent deformation writes require an animation preview session');
    // Studio may be resampling over the previous Character Lab pass. Return
    // visual children to the bridge-owned deformation result before it
    // resolves a fresh scalar pose, then syncCharacterAppearance reapplies the
    // persistent design once the complete pose has settled.
    this.clearCharacterAppearance();
    this.playerAnimationBridge.applyDeformations(values);
  }

  /**
   * Install the future AnimationSession's final authored-pose layer. The
   * returned disposer only removes the overlay it installed, so replacing a
   * session cannot let an older cleanup tear down the newer one.
   */
  setAuthoredPoseOverlay(overlay: PlayerAnimationOverlay | null): () => void {
    this.clearCharacterAppearance();
    const dispose = this.playerAnimationBridge.setOverlay(overlay);
    this.syncCharacterAppearance();
    this.resetRenderInterpolation();
    return () => {
      this.clearCharacterAppearance();
      dispose();
      this.syncCharacterAppearance();
      this.resetRenderInterpolation();
    };
  }

  /**
   * Discard presentation history without telling the camera the player moved.
   * Used for pause boundaries and an asynchronously replaced model hierarchy.
   */
  resetRenderInterpolation(): void {
    this.renderInterpolator.snap();
    this.group.position.copy(this.pos);
    this.renderPosition.copy(this.pos);
  }

  /** Freeze both endpoints at current without introducing resume latency. */
  collapseRenderInterpolation(): void {
    this.renderInterpolator.collapse();
    this.group.position.copy(this.pos);
    this.renderPosition.copy(this.pos);
  }

  /** A semantic teleport: collapse pose history and snap the camera subject. */
  snapRenderInterpolation(): void {
    this.resetRenderInterpolation();
    this._renderSnapVersion++;
  }

  /** Capture the visual pose after every completed fixed step. */
  private collectRenderHierarchy(object: THREE.Object3D): void {
    // The Unity whirlwind deliberately holds at authoritative 60 Hz. Its
    // parent root still glides with the rider, but interpolating local poses
    // would turn the authored presentation into an ordinary smooth rotation.
    if (object === this.spinEffects?.root) return;
    this.renderObjects.push(object);
    for (const child of object.children) this.collectRenderHierarchy(child);
  }

  commitRenderStep(level: Level): void {
    // PVP separation/kicks run after Player.step() authored the pose. Fold that
    // final root correction into the snapshot and carry player-attached world
    // effects with it; the loose board/fruit/sparks have their own trajectories.
    const dx = this.pos.x - this.group.position.x;
    const dy = this.pos.y - this.group.position.y;
    const dz = this.pos.z - this.group.position.z;
    this.group.position.copy(this.pos);
    if (dx * dx + dy * dy + dz * dz > 1e-12) {
      if (this.maskMesh?.visible) this.maskMesh.position.add(_renderDelta.set(dx, dy, dz));
      if (this.boostGlow.visible) this.boostGlow.position.add(_renderDelta.set(dx, dy, dz));
    }
    // Player.step authored the pose before Level.update advanced movers. Probe
    // only now, at the final PVP-corrected player position against the final
    // world transforms, so the landing X cannot flash on stale/old ground.
    this.refreshGroundPresentation(level);

    const objects = this.renderObjects;
    objects.length = 0;
    this.collectRenderHierarchy(this.group);
    objects.push(this.floorX, this.boostGlow);
    if (this.maskMesh) objects.push(this.maskMesh);
    if (this.flyBoard) objects.push(this.flyBoard);
    for (const fruit of this.fruits)
      if (fruit.phase !== 'off' && fruit.phase !== 'fly') objects.push(fruit.mesh);
    for (const spark of this.sparks)
      if (spark.life > 0) objects.push(spark.mesh);
    for (const spark of this.maskSparks)
      if (spark.life > 0) objects.push(spark.sprite);
    this.renderInterpolator.capture(objects);
    this.renderPosition.copy(this.pos);
  }

  /** Temporarily author the interpolated render pose for this RAF. */
  applyRenderInterpolation(alpha: number): void {
    if (this.renderInterpolator.hasPose) this.renderInterpolator.apply(alpha);
    else this.group.position.copy(this.pos);
    this.renderPosition.copy(this.group.position);
  }

  /** Put authoritative fixed-step transforms back immediately after drawing. */
  restoreRenderPose(): void {
    this.renderInterpolator.restore();
    this.renderPosition.copy(this.pos);
  }

  // Momentum-skate mode is live (board down, heading model driving) — used by
  // the audio loop so slow carves on a transition still sound like rolling.
  get boardRolling(): boolean {
    return this.freeSkate;
  }

  /** Gameplay-only deck-trick evidence for reusable trick gates and rails. */
  hasDeckTrickStarted(kind: DeckTrickKind, scope: 'air' | 'combo' = 'air'): boolean {
    return (scope === 'combo' ? this.deckTricksThisCombo : this.deckTricksThisAir).has(kind);
  }

  private syncReusablePrimitives(level: Level): void {
    this.primitiveAirTricks.clear();
    this.primitiveComboTricks.clear();
    for (const kind of ['kick', 'heel', 'shove', 'imposs', 'varial'] as const) {
      if (this.hasDeckTrickStarted(kind, 'air')) this.primitiveAirTricks.add(kind);
      if (this.hasDeckTrickStarted(kind, 'combo')) this.primitiveComboTricks.add(kind);
    }
    level.syncTrickPrimitives(
      this.primitiveComboTricks,
      this.comboMult > 0 || this.primitiveComboTricks.size > 0,
      this,
    );
  }

  private cancelSlideTraversal(): void {
    this.slideTimer = 0;
    this.slideDistanceLeft = 0;
    this.slideContactLatch = false;
    this.slideSpd = 0;
    this.slideVec.set(0, 0, 0);
    this.slideGraceT = 0;
    this.slideGraceHold = false;
    this.slideEndPending = false;
    this.slideRecoverT = 0;
    this.slideCrawlChain = false;
    this.slideFromWalk = false;
    this.slideLandClamp = false;
    this.slideAirLat = 0;
    this.slideJumpAir = false;
    this.crawling = false;
  }

  private applySpeedPad(): void {
    const hit = this.groundHit;
    const id =
      this.state === 'ride' &&
      this.grounded &&
      this.freeSkate &&
      !this.isBailing
        ? (hit?.speedPadId ?? 0)
        : 0;
    if (id === 0) {
      this.activeSpeedPadId = 0;
      return;
    }
    if (id === this.activeSpeedPadId) return;
    this.activeSpeedPadId = id;
    const sign = Math.sign(this.speed || 1);
    this.speed = sign * Math.max(Math.abs(this.speed), hit?.speedPadSpeed ?? 48);
    this.grindBoostT = Math.max(this.grindBoostT, hit?.speedPadHold ?? 3.9);
    this.speedPadCap = Math.max(this.speedPadCap, hit?.speedPadSpeed ?? 48);
    this.emitSparks(10, 0x2bdfff, 1.8);
    sfx.play('skateTransition', 0.75, 1.35);
  }

  private launchFromTrampoline(hit: GroundHit, input: Input): boolean {
    if (
      hit.trampolineBounce === undefined ||
      this.isBailing ||
      this.slamActive ||
      this.slamFlatT > 0 ||
      this.state !== 'ride' ||
      !this.grounded
    )
      return false;
    this.pos.y = hit.y;
    const heldMultiplier = input.jumpHeld ? (hit.trampolineHeldMult ?? 1) : 1;
    if (this.manualing !== 0) this.endManual();
    this.cancelSlideTraversal();
    this.slamActive = false;
    this.slamHangT = 0;
    this.slamFlatT = 0;
    this.charging = false;
    this.chargePlanted = false;
    this.chargeTimer = 0;
    this.jumpBufferT = 0;
    this.vVel = hit.trampolineBounce * heldMultiplier;
    this.state = 'air';
    this.grounded = false;
    this.surfaceName = hit.name;
    this.rideNormal.copy(hit.normal);
    this.airFromSkate = this.freeSkate;
    this.airGrav = this.freeSkate ? 'board' : 'foot';
    this.airMomentum = this.freeSkate;
    this.floatAir = false;
    this.bounceRefresh();
    this.score(CONST.ptsBouncy, 'Boing');
    sfx.play('crateBounce', 0.8, input.jumpHeld ? 1.25 : 1.05);
    return true;
  }

  private setTravelDir(dir: 'S' | 'E' | 'W' | 'N'): void {
    this.travelDir = dir;
    if (dir === 'S') {
      this.axisF.set(0, 0, -1);
      this.axisL.set(1, 0, 0);
    } else if (dir === 'N') {
      // RUN AT THE CAMERA (boulder-chase framing): forward is +Z, straight
      // into the lens; stick-right stays screen-right (+X), so controls read
      // exactly like the normal corridor — mirrored world, same hands
      this.axisF.set(0, 0, 1);
      this.axisL.set(1, 0, 0);
    } else if (dir === 'E') {
      // stick-up = away from the camera (-Z) on turned stretches
      this.axisF.set(1, 0, 0);
      this.axisL.set(0, 0, -1);
    } else {
      this.axisF.set(-1, 0, 0);
      this.axisL.set(0, 0, -1);
    }
  }

  // Soft respawn (death) returns to the last checkpoint; hard (R / new run)
  // returns to the start and relights checkpoints.
  respawn(level: Level, hard = false): void {
    // Checkpoints restore the authored world/counters, but an endless-mode
    // death penalty is permanent for this run and must not be overwritten by
    // the checkpoint's older score snapshot.
    const endlessScore = this.endlessDeaths && !hard ? this.points : null;
    // A respawn teleports you: the camera lane must forget where it thought
    // you were, or the continuity bias pins the frame to the stretch you just
    // left. -1 means "take the global best next query".
    this.laneCursor.s = -1;
    // any respawn drops a live trial or combo run: back to normal dress
    if (this.ttActive || level.timeTrial) {
      this.ttActive = false;
      level.setTimeTrial(false);
      this.onTTEnd();
    }
    if (this.comboRun || level.comboRun) {
      this.comboRun = false;
      level.setComboRun(false);
      this.onComboRunEnd();
    }
    this.ttTime = 0;
    this.ttFreeze = 0;
    this.grindBoostT = 0; // a leftover over-ceiling window must not survive a respawn
    this.ttDied = false;
    this.comboFailT = 0;
    this.comboGraceT = 0;
    this.comboGraceWarned = false;
    this.comboDied = false;
    this.comboWasLive = false;
    this.balanceBoostT = 0;
    if (hard) {
      this.simSeed = SIM_SEED0; // a fresh run replays from the same stream
      this.lives = 3;
      this.totalDeaths = 0;
      // The boxes are all back, so the gem has to be able to MATERIALIZE
      // again — but whether it was already earned is the vault's business.
      this.gemSpawned = false;
      this.bankRelics();
      this.restoreRelics();
    }
    level.reset(hard);
    this.pos.copy(hard ? level.spawnPos : level.currentSpawn);
    level.playerPos.copy(this.pos); // keep the boulder trigger honest across respawns
    if (hard) this.runTime = 0;
    // Respawning at a checkpoint restores the counters it banked; a hard
    // reset (reset() cleared activeCheckpoint) starts from zero.
    this.cratesBroken = level.activeCheckpoint ? level.activeCheckpoint.savedCratesBroken : 0;
    this.fruit = level.activeCheckpoint ? level.activeCheckpoint.savedFruit : 0;
    this.masks = level.activeCheckpoint ? level.activeCheckpoint.savedMasks : 0;
    this.points = level.activeCheckpoint ? level.activeCheckpoint.savedPoints : 0;
    if (this.endlessDeaths) this.fruit = 0;
    if (endlessScore !== null) this.points = endlessScore;
    this.settle(level);
    this.onRespawn();
  }

  // Everything a body has to LET GO OF when it is put down somewhere new:
  // every timer, every latch, every hold on a rail/rope/ledge, and the frame
  // it faces. Shared by the death respawn and the checkpoint warp, because a
  // warp that skipped any of this would arrive still grinding a rail that is
  // now four hundred units behind you.
  private settle(level: Level): void {
    this.speed = 0;
    this.vVel = 0;
    this.state = 'ride';
    this.grounded = true;
    this.spinTimer = 0;
    this.spinCd = 0;
    this.slamFlatT = 0; // dying mid-pancake must not respawn you still flattened
    this.bodyGroup.rotation.y = 0;
    this.grindRail = null;
    this.regrindCd = 0;
    this.activeSpeedPadId = 0;
    this.speedPadCap = 0;
    this.returnPortalCoolT = 0;
    this.primitiveAirTricks.clear();
    this.primitiveComboTricks.clear();
    this.trickGateHintT = 0;
    this.trickGateHintKind = null;
    this.trickGateImpactT = 0;
    this.lastRail = null;
    this.grindLatched = false;
    this.uberTimer = 0;
    this.slideFromWalk = false;
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
    this.comboTimer = 0;
    this.comboUses.clear();
    this.special.reset();
    this.clearSpecialMoves();
    this.specialActivationCount = 0;
    this.airGrabShown = null;
    this.sketchyT = 0;
    this.flipT = 0;
    this.deckTricksThisAir.clear();
    this.deckTricksThisCombo.clear();
    this.ollieDeckTrickBufferT = 0;
    this.floatAir = false;
    this.revertT = 0;
    this.pipeEndFly = false;
    this.rollOffT = 0;
    this.invulnTimer = 0;
    this.invulnSilent = false;
    this.slideTimer = 0;
    this.slideDistanceLeft = 0;
    this.slideContactLatch = false;
    this.slideSpd = 0;
    this.slideCd = 0;
    this.slideGraceT = 0;
    this.slideEndPending = false;
    this.slideGraceHold = false;
    this.slideAirLat = 0;
    this.slideJumpAir = false;
    this.slideRecoverT = 0;
    this.skateBlockT = 0;
    this.slideCrawlChain = false;
    this.railUnder = false;
    this.underK = 0;
    this.grindUsedUnder = false;
    this.underCoolT = 0;
    this.boardSnapT = 0;
    this.brakeT = 0;
    this.brakeLockT = 0;
    this.brakeRampT = 0;
    this.oBrakeHold = false;
    this.walkRamp = 0;
    this.walkVelocity.set(0, 0, 0);
    this.walkTarget.set(0, 0, 0);
    this.walkTurnaround = false;
    this.walkIntent.set(0, 0, 0);
    this.crawling = false;
    this.slamActive = false;
    this.slamHangT = 0;
    this.bailDownT = 0;
    this.bailRecoverT = -1;
    this.bailRecoveryPose = 0;
    this.bailGroundT = 0;
    this.bailExitSpeed = 0;
    this.bailVelocity.set(0, 0, 0);
    this.ragActive = false;
    this.ragBlend = 0;
    this.ragPoseAnchor.set(0, 0, 0);
    this.ragPoseAnchorW = 0;
    this.ragAngVel.set(0, 0, 0);
    this.ragBounces = 0;
    this.ragImpacts = 0;
    this.ragJumpAttemptImpact = 0;
    this.ragSteerAttemptImpact = 0;
    this.ragSteerInputLatched = false;
    this.ragFishJumps = 0;
    this.ragFlailKickT = 0;
    if (this.flyBoard) this.flyBoard.visible = false;
    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.grindExitAir = false;
    this.boardOllieAir = false;
    this.emergencyEjectChargeT = 0;
    this.emergencyEjectCharging = false;
    this.emergencyEjectUsed = false;
    this.emergencyEjectLandingPending = false;
    this.emergencyEjectLandingWillBail = false;
    this.stepOff = false;
    this.stance = 1;
    this.vertAir = false;
    this.vertLatVel = 0;
    this.pipeFlipCd = 0;
    this.pipeHang = false;
    this.pipeRideT = 0;
    this.pipeLandGraceT = 0;
    this.manualing = 0;
    this.manualArmed = 0;
    this.manualArmT = 0;
    this.manualCoyoteT = 0;
    this.ropeObj = null;
    this.ropeCoolT = 0;
    this.ropeJumpArm = false;
    this.lipStallT = 0;
    this.lipPipe = null;
    this.lipCoolT = 0;
    this.hangPipe = null;
    this.slamSquash = 0;
    this.bailing = false;
    this.bailSpin = 0;
    this.bodyGroup.rotation.x = 0;
    for (const f of this.fruits) this.retireFruit(f);
    this.groundHit = null;
    this.coyoteTimer = 0;
    this.crateFloorT = 0; // a respawn never inherits "stood on a box"
    this.crateFloor = null;
    this.crateSupportLostThisStep = false;
    this.crouchGraceT = 0;
    this.wallriding = false;
    this.wallPath = null;
    this.wallCoolT = 0;
    this.wallrideLatched = false;
    this.wallChargeT = 0;
    this.ledgeT = 0;
    this.ledgeCoolT = 0;
    this.ledgeEaseT = 0;
    this.ledgeLanding.set(0, 0, 0);
    this.ledgeMoverId = undefined;
    this.ledgePose = 0;
    this.ledgePhase = 'grip';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.ledgeAwayT = 0;
    this.ledgeShimmy = 0;
    this.ledgeClimbQueued = false;
    this.hangClipName = null;
    this.hangExitW = 0;
    this.wallridePose = 0;
    this.deckPose = 0;
    this.wallChargePose = 0;
    this.slopePose = 0;
    this.slopeRoll = 0;
    this.alignPose = 0;
    this.landingAlignPose = 0;
    this.alignNormal.set(0, 1, 0);
    this.slipping = false;
    this.slipClamp = false;
    this.greaseT = 0;
    const zn = level.zoneAt(this.pos.x, this.pos.z);
    this.setTravelDir(zn ? zn.dir : 'S');
    // a camera lane owns the course frame: spawn facing straight down it
    const lf0 = level.laneDirAt(this.pos.x, this.pos.y, this.pos.z, this.laneCursor);
    if (lf0) {
      this.axisF.set(lf0.x, 0, lf0.z);
      this.axisL.set(-this.axisF.z, 0, this.axisF.x);
    }
    this.charging = false;
    this.chargePlanted = false;
    this.chargeTimer = 0;
    this.skateCharge = 0;
    this.freeSkate = false;
    this.airMomentum = false;
    this.airJumpUsed = false;
    this.doubleJumpAir = false;
    this.airborneT = 0;
    this.airPeakY = this.pos.y;
    this.jumpBufferT = 0;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.spinAngle = 0;
    this.visualYaw = 0;
    this.flipTimer = 0;
    this.balance = 0;
    this.balanceVel = 0;
    this.balanceCritT = 0;
    this.lastTy = 0;
    this.rideNormal.set(0, 1, 0);
    this.prevPos.copy(this.pos);
    this.snapRenderInterpolation();
    for (const s of this.sparks) {
      s.life = 0;
      s.mesh.visible = false;
    }
  }

  // Playtest warp: K steps back a checkpoint, L forward. `dir` is -1 or +1.
  //
  // The stops are the level's own start plus every checkpoint IN AUTHORING
  // ORDER, which for every hand-built course is course order. Which one you
  // are "at" is resolved fresh on each press from whichever stop is nearest,
  // so it keeps working after you have skated, died or warped — there is no
  // index to fall out of step with where you actually are.
  //
  // Arriving BANKS the checkpoint exactly as smashing it would: you are now
  // at that point in the course, so a death should return you there, and the
  // crate snapshot it takes is the honest one for having got here without
  // breaking anything on the way.
  warpCheckpoint(level: Level, dir: number): boolean {
    if (level.runMode) return false; // no checkpoints in a trial/combo run
    const stops = [{ cp: null as Checkpoint | null, at: level.spawnPos }];
    for (const cp of level.checkpoints) stops.push({ cp, at: cp.spawnPos });
    if (stops.length < 2) return false;
    let near = 0;
    let best = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = this.pos.distanceToSquared(stops[i].at);
      if (d < best) {
        best = d;
        near = i;
      }
    }
    const i = near + (dir < 0 ? -1 : 1);
    if (i < 0 || i >= stops.length) return false;
    const stop = stops[i];
    this.laneCursor.s = -1; // a teleport invalidates the lane's continuity bias
    this.pos.copy(stop.at);
    level.playerPos.copy(this.pos);
    level.clearProjectiles(); // no orange orb may follow a debug warp from the old section
    this.settle(level);
    if (stop.cp && !stop.cp.active)
      level.activateCheckpoint(stop.cp, this.cratesBroken, this.fruit, this.masks, this.points);
    else if (stop.cp) level.currentSpawn.copy(stop.cp.spawnPos);
    return true;
  }

  // One deterministic fixed step.
  step(dt: number, input: Input, level: Level): void {
    // Downstream collision/VFX run after movement. Clear last step's evidence
    // here; an active slide step below relatches it before consuming any exact
    // final partial step and zeroing slideTimer.
    this.slideContactLatch = false;
    // Moving ground: ride along with the platform you're standing on (the
    // platform advanced once in level.update since our last step — apply that
    // delta before this step's movement so we stay glued). Crumble pads get
    // told they've been stepped on.
    if (this.grounded && this.groundHit) {
      if (this.groundHit.moverId !== undefined) this.pos.add(level.moverDelta(this.groundHit.moverId));
      if (this.groundHit.crumbleId !== undefined) level.touchCrumble(this.groundHit.crumbleId);
    }
    level.playerPos.copy(this.pos); // the boulder chase reads this
    this.returnPortalCoolT = Math.max(0, this.returnPortalCoolT - dt);
    this.trickGateHintT = Math.max(0, this.trickGateHintT - dt);
    if (this.trickGateHintT <= 0) this.trickGateHintKind = null;
    this.trickGateImpactT = Math.max(0, this.trickGateImpactT - dt);
    this.syncReusablePrimitives(level);
    // While sliding, keep the slide-jump grace topped up; after the slide it
    // runs down, and a release inside it still counts as a slide jump.
    if (this.slideTimer > 0) {
      this.slideGraceT = TUNING.slideJumpGrace;
      this.slideEndPending = true; // a slide is running; its end isn't resolved yet
    } else if (this.slideGraceHold) {
      // The exact-distance slide may finish on a partial fixed step. Keep the
      // grace that was refreshed before that step intact through the first
      // ordinary-movement tick, matching the tightened Unity chain timing.
      this.slideGraceHold = false;
    } else if (this.slideGraceT > 0) {
      this.slideGraceT = Math.max(0, this.slideGraceT - dt);
      // Grace fully elapsed with NO slide jump taken (a slide jump zeroes
      // slideGraceT in chargedJump, so we never reach here after one): a PLAIN
      // slide just ended. If it was an ON-FOOT slide (walk pace — the player was
      // "running", now clamped back to walk), arm the get-up beat: the skater
      // picks themselves off the ground for a moment, controls dead, so slides
      // can't be chained for constant free travel. A fast SKATE-slide keeps its
      // momentum (you're on the board, not sprawled) and a slide JUMP launches
      // straight out — both exempt.
      if (this.slideGraceT <= 0 && this.slideEndPending) {
        this.slideEndPending = false;
        if (
          this.state === 'ride' &&
          this.grounded &&
          !this.crawling && // flowed into the crawl instead (Circle held out of the slide) — no get-up beat
          Math.abs(this.speed) <= TUNING.walkSpeed + 0.5
        )
          this.slideRecoverT = TUNING.slideRecover;
      }
    }
    this.jumpBufferT = Math.max(0, this.jumpBufferT - dt);
    // Still stood on a box? Every ground accept writes surfaceName, so this one
    // test covers walking box-to-box across a stack as well as staying put; the
    // latch only runs down once a jump (or a step onto real ground) ends it.
    this.crateSupportLostThisStep = false;
    if (
      this.crateFloor !== null &&
      (!this.crateFloor.alive || this.crateFloor.pending)
    ) {
      // A destroyed support releases the rider for at least this fixed step;
      // do not spend the old latch by snapping straight to a lower stack box.
      this.crateFloorT = 0;
      this.crateFloor = null;
      this.crateSupportLostThisStep = true;
    } else if (
      this.grounded &&
      this.surfaceName === 'crate' &&
      this.crateFloor?.alive &&
      !this.crateFloor.pending
    ) {
      this.crateFloorT = CRATE_STAND_GRACE;
    } else {
      this.crateFloorT = Math.max(0, this.crateFloorT - dt);
      if (this.crateFloorT === 0) this.crateFloor = null;
    }
    this.vertLaunchT = Math.max(0, this.vertLaunchT - dt);
    this.ledgeCoolT = Math.max(0, this.ledgeCoolT - dt);
    this.hangExitW = Math.max(0, this.hangExitW - dt * 2.6);
    if (this.state !== 'hang' && this.hangClipName) {
      if (this.hangExitW > 0) this.hangClipT += dt * this.hangClipRate;
      else this.hangClipName = null; // overlay finished — release the clip
    }
    // Side-scroll levels: the camera sits off to the +X side, so screen right
    // = down-course. Remap the stick — left/right drives speed, and up/down
    // is the depth sidestep (up = away from the camera), the exact same
    // direct-velocity move as left/right in corridor levels. The raw stick
    // stays available (rawInput) for the slam, grab-spin direction, and
    // grind balance.
    this.rawInput = input;
    // SPECIAL commands live in raw SCREEN directions, before course/skate
    // remapping. Decode the two direction taps now so Triangle can reach grind
    // routing and same-tick ollie releases can reach Square air specials.
    this.special.step(dt, input.moveX, input.moveY);
    this.pendingSpecialFlip = input.spinPressed ? this.special.peek('flip') : null;
    this.pendingSpecialGrab = input.grabPressed ? this.special.peek('grab') : null;
    this.pendingSpecialGrind = input.grindPressed ? this.special.peek('grind') : null;
    // LEDGE HANG owns the whole step: no movement, physics, or collision runs
    // while gripped — climb up, hop off, or the grip gives out. stepHang ticks
    // the essential shared timers itself.
    if (this.state === 'rope') {
      if (input.restartPressed) {
        this.respawn(level, true);
        this.finishVisualStep(input, dt);
        return;
      }
      this.stepRope(dt, input, level);
      this.blastCheck(level); // a bomb under the rope/ledge still gets you
      this.updateSpin(dt, input); // Square spins on the rope: mid-air smash
      this.updateSparks(dt);
      this.updatePuffs();
      this.updateFlyBoard(dt, level);
      this.updateFruit(dt);
      this.finishVisualStep(input, dt);
      return;
    }
    if (this.state === 'hang') {
      if (input.restartPressed) {
        this.respawn(level, true);
        this.finishVisualStep(input, dt);
        return;
      }
      this.stepHang(dt, input, level);
      this.blastCheck(level); // a bomb under the rope/ledge still gets you
      this.updateSparks(dt);
      this.updatePuffs();
      this.updateFlyBoard(dt, level);
      this.updateFruit(dt);
      this.finishVisualStep(input, dt);
      return;
    }
    // MANUAL FLICK: watch the raw stick's vertical axis for the two-beat flick.
    // Up-then-down pops a manual (nose up), down-then-up a nose manual. On the
    // ground it fires immediately; mid-air it ARMS a land-into-manual for a
    // beat, so finishing the flick just before touchdown keeps the combo alive.
    this.flickUpT += dt;
    this.flickDownT += dt;
    this.manualArmT = Math.max(0, this.manualArmT - dt);
    this.ropeCoolT = Math.max(0, this.ropeCoolT - dt);
    this.vertLandGraceT = Math.max(0, this.vertLandGraceT - dt);
    {
      const my = this.rawInput.moveY;
      const win = TUNING.manualFlickWindow;
      if (my > 0.6 && this.prevMoveY <= 0.6) {
        if (this.flickDownT < win) this.tryManual(-1); // down-then-up: nose manual
        this.flickUpT = 0;
      } else if (my < -0.6 && this.prevMoveY >= -0.6) {
        if (this.flickUpT < win) this.tryManual(1); // up-then-down: manual
        this.flickDownT = 0;
      }
      this.prevMoveY = my;
    }
    // A manual lives on rideable ground — but courses ROLL: going light over
    // a crest (a few airborne frames) must not drop it. A short coyote window
    // carries the manual across bumps; real departures still end it. An ollie
    // out is unaffected — the jump ends the manual explicitly before takeoff.
    if (this.manualing !== 0) {
      if (this.state !== 'ride' && this.state !== 'air') this.endManual();
      else if (this.state !== 'ride' || !this.grounded) {
        this.manualCoyoteT += dt;
        if (this.manualCoyoteT > TUNING.manualCoyote) this.endManual();
      } else this.manualCoyoteT = 0;
    }
    // ARMED LAND-INTO-MANUAL: retry every grounded frame while the window
    // lasts — the touchdown frame itself can be inhospitable (a steep patch,
    // a speed dip) and one bad frame must not eat the flick.
    if (
      this.manualing === 0 &&
      this.manualArmed !== 0 &&
      this.manualArmT > 0 &&
      this.canManual()
    ) {
      this.enterManual(this.manualArmed);
    }
    // ZONES (built-in levels): the path can right-angle into an X-running
    // stretch — there the camera holds its frame and the turned path IS the
    // side-scroll view, so axes flip the instant you cross a corner (no lock,
    // no latch) and held skate speed transfers if the stick pushes along the
    // new direction. Custom levels steer with the camera LANE above instead.
    // CAMERA LANE (Crash 3 rails): when the level has a drawn lane, the
    // course frame EASES along the local lane tangent — the camera turns with
    // it (main.ts follows the same tangent), so a held "forward" walks
    // winding corridors without the player steering the bends. The stick
    // passes straight through: screen-up IS the lane direction.
    // CHASE CAM: the course frame follows the CAMERA's forward (which main
    // is easing behind the travel direction) — stick-up is always "away from
    // camera", and the skater reads always-facing-forward.
    const chaseMode = TUNING.chaseCam > 0.5 && !level.boulder;
    const laneDir =
      this.state !== 'grind' && !this.freeSkate
        ? (level.laneDirAt(this.pos.x, this.pos.y, this.pos.z, this.laneCursor) ??
          (chaseMode ? { x: this.camDir.x, z: this.camDir.z } : null))
        : null;
    if (laneDir) {
      const k = Math.min(1, 6 * dt);
      this.axisF.x += (laneDir.x - this.axisF.x) * k;
      this.axisF.z += (laneDir.z - this.axisF.z) * k;
      this.axisF.y = 0;
      const al = Math.hypot(this.axisF.x, this.axisF.z) || 1;
      this.axisF.x /= al;
      this.axisF.z /= al;
      this.axisL.set(-this.axisF.z, 0, this.axisF.x);
    }
    const zone = level.zoneAt(this.pos.x, this.pos.z);
    const wantDir = zone ? zone.dir : 'S';
    // Corner flips are a WALKING concept — free-heading skating just carves
    // through corners, so the axes are left alone while on the board. A lane
    // owns the axes outright (continuous turns, no cardinal flips) — EXCEPT
    // inside a travel zone, which is a deliberate local override of the lane
    // (laneDirAt already returns null in there).
    //
    // ON THE GROUND ONLY. The flip rescales `speed` from the stick, and speed
    // is motion along the axis it just replaced — so firing it in mid-air
    // deletes the momentum that was carrying you, because a stick held
    // "forward" reads as zero throttle the instant forward becomes sideways.
    // A zone whose edge you cross while airborne would drop you out of your
    // own jump. Airborne you keep the frame you left the ground with (nothing
    // is lost: air steering is lateral and doesn't care), and the frame flips
    // on touchdown, which is the only moment the new axis means anything.
    if (this.grounded && !laneDir && !(level.laneActive && !zone) && !chaseMode && wantDir !== this.travelDir && this.state !== 'grind' && !this.freeSkate) {
      const oldSpeed = this.speed;
      this.setTravelDir(wantDir);
      const alongNew =
        wantDir === 'S' || wantDir === 'N' ? input.moveY : wantDir === 'E' ? input.moveX : -input.moveX;
      this.speed =
        Math.abs(alongNew) > 0.3 ? Math.sign(alongNew) * Math.abs(oldSpeed) * 0.7 : 0;
    }
    // ...and the COURSE AXES have to MATCH that travel direction, every frame
    // plain walking is what's happening. Walking is course-relative by
    // definition — stick-up is screen-up — but several canned moves rewrite
    // axisF while you are on your feet: stepping off a lip stall aims you out
    // across the coping, a rail drop-off aims you at the drop, a bail tumbles
    // you down the fall line. The ONLY place that ever put the axes back was
    // the board dismount, so coming out of one of those already on foot left
    // the walking frame rotated for the rest of the run — "up" kept driving
    // you along a heading you set minutes ago. Re-assert it here; the states
    // that legitimately own the heading on foot are excluded.
    if (
      !laneDir &&
      !chaseMode &&
      !this.freeSkate &&
      this.state === 'ride' &&
      this.slideTimer <= 0 &&
      !this.isBailing &&
      !this.teetering &&
      this.lipPipe === null &&
      !this.wallriding
    ) {
      this.setTravelDir(this.travelDir);
    }
    let ctl =
      this.travelDir === 'S' || this.travelDir === 'N' || (level.laneActive && !zone)
        ? input
        : this.travelDir === 'E'
          ? ({ ...input, moveY: input.moveX, moveX: input.moveY } as unknown as Input)
          : ({ ...input, moveY: -input.moveX, moveX: input.moveY } as unknown as Input);
    if (this.freeSkate) {
      // Decompose the screen-space stick onto the CURRENT heading axes, so
      // downstream code (acceleration, slides, air control, lean) reads
      // "forward" as "along the board" no matter where it points.
      const rx = input.moveX;
      const ry = input.moveY;
      if (rx !== 0 || ry !== 0) {
        // screen-up = the camera's forward: -Z normally, the lane tangent on
        // lane levels, the live camera aim in chase mode (the rig turns to
        // match all three). screen-right is its perpendicular (-f.z, f.x).
        const cf =
          level.laneDirAt(this.pos.x, this.pos.y, this.pos.z, this.laneCursor) ??
          (chaseMode ? { x: this.camDir.x, z: this.camDir.z } : { x: 0, z: -1 });
        const inv = 1 / Math.hypot(rx, ry);
        const wx = (cf.x * ry - cf.z * rx) * inv;
        const wz = (cf.z * ry + cf.x * rx) * inv;
        ctl = {
          ...input,
          moveY: wx * this.axisF.x + wz * this.axisF.z,
          moveX: wx * this.axisL.x + wz * this.axisL.z,
        } as unknown as Input;
      }
    }
    input = ctl;

    // GET-UP BEAT: a plain slide leaves the skater sprawled on the ground.
    // While the recover timer runs (and they're back on their feet, not
    // airborne) the controls are dead — no running, no fresh slide/crawl, and
    // any leftover speed is bled to a stop — so a slide can't be chained into
    // constant free speed. It clears the instant they go airborne (a slide
    // JUMP launches straight out and never arms this).
    if (this.slideRecoverT > 0 && this.state === 'ride' && this.grounded) {
      input = { ...input, moveX: 0, moveY: 0, grabPressed: false, grabHeld: false } as Input;
      this.speed = 0;
      this.charging = false;
    }

    this.liftTyT = Math.max(0, this.liftTyT - dt);
    if (this.liftTyT === 0) this.liftTy = 0;
    this.regrindCd = Math.max(0, this.regrindCd - dt);
    // Letting Triangle go re-arms it: the rail you left is grabbable again.
    if (!input.grindHeld) this.grindLatched = false;
    this.grindBoostT = Math.max(0, this.grindBoostT - dt);
    if (this.grindBoostT === 0) this.speedPadCap = 0;
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.crouchGraceT = Math.max(0, this.crouchGraceT - dt);
    this.vertGravT = Math.max(0, this.vertGravT - dt);
    // the pipe ride-out level-out clock only runs while that air lasts; the
    // landing block reads it AT touchdown (still 'air' this step) to judge
    if (this.state === 'air') this.rollOffT = Math.max(0, this.rollOffT - dt);
    // touching down mid-somersault cuts it — Crash lands upright, no carry-over tumble
    this.flipTimer = this.grounded ? 0 : Math.max(0, this.flipTimer - dt);
    if (this.grounded || this.state === 'grind') {
      this.airJumpUsed = false; // double jump re-arms on any contact
      this.doubleJumpAir = false;
      this.airborneT = 0; // the double-jump window clock starts at takeoff
      this.airPeakY = this.pos.y;
      this.bounceJump = false;
    } else {
      // first airborne frame records the pop that launched this air, so the
      // double-jump window can scale with the jump's actual size
      if (this.airborneT === 0) this.launchVy = Math.max(0, this.vVel);
      this.airborneT += dt;
      this.airPeakY = Math.max(this.airPeakY, this.pos.y);
    }
    // The roll-jump gate: how long a direction has been HELD going into a
    // jump. Steering only after takeoff never rolls — this is read AT launch.
    this.dirHoldT = Math.hypot(input.moveX, input.moveY) > 0.5 ? this.dirHoldT + dt : 0;
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.underCoolT = Math.max(0, this.underCoolT - dt);
    this.boardSnapT = Math.max(0, this.boardSnapT - dt);
    // Active slide time is derived from the exact distance/speed invariant in
    // stepRide. A free-running countdown would end between fixed samples and
    // silently shave distance off the authored five-metre path.
    this.slideRecoverT = Math.max(0, this.slideRecoverT - dt);
    this.skateBlockT = Math.max(0, this.skateBlockT - dt);
    // Post-brake lock: the timer is refreshed each frame the brake is still
    // holding you near a stop (see the brake branches), so it only starts
    // counting down once you LET GO of the brake. When it lands on zero it arms
    // the ease-back ramp; movement then scales 0->1 over brakeLockRamp.
    if (this.brakeLockT > 0) {
      this.brakeLockT = Math.max(0, this.brakeLockT - dt);
      if (this.brakeLockT === 0) this.brakeRampT = TUNING.brakeLockRamp;
    } else {
      this.brakeRampT = Math.max(0, this.brakeRampT - dt);
    }
    this.haltCd = Math.max(0, this.haltCd - dt);
    this.wallCoolT = Math.max(0, this.wallCoolT - dt);
    this.pipeFlipCd = Math.max(0, this.pipeFlipCd - dt);
    // TIME TRIAL clock: runs through everything you do — except while a
    // broken time crate's freeze is counting down, and never once you're
    // dead or across the line.
    if (this.ttActive && this.state !== 'dead' && this.state !== 'gameover' && this.state !== 'finished') {
      if (this.ttFreeze > 0) this.ttFreeze = Math.max(0, this.ttFreeze - dt);
      else this.ttTime += dt;
    }
    // Perfect-balance boost window (combo-run crates): green sparkle cue.
    this.balanceBoostT = Math.max(0, this.balanceBoostT - dt);
    if (this.balanceBoostT > 0 && Math.random() < 0.3) this.emitSparks(1, 0x46e882, 1.2);
    // COMBO RUN: the run lives exactly as long as the combo does. Any end —
    // banked, bailed, eaten — with the gem still out there = run failed. And
    // the combo must START promptly: the grace clock stops anyone strolling
    // the whole course and popping one trick at the gem.
    if (this.comboRun && this.comboFailT <= 0 && this.state !== 'dead') {
      const live = this.comboMult > 0;
      if (live) {
        this.comboGraceT = 0; // the chain is rolling — grace did its job
        this.comboWasLive = true;
      } else if (this.comboWasLive) {
        this.comboWasLive = false;
        this.failComboRun(level);
      } else if (this.comboGraceT > 0) {
        this.comboGraceT -= dt;
        if (this.comboGraceT < 1.0 && !this.comboGraceWarned) {
          this.comboGraceWarned = true;
          this.onComboGraceLow();
        }
        if (this.comboGraceT <= 0) this.failComboRun(level); // never started one
      }
    } else {
      this.comboWasLive = this.comboMult > 0;
    }
    // The despair beat: the halo dissipates over it, then the standard
    // fade-out carries you back to the very start of the level.
    if (this.comboFailT > 0) {
      this.comboFailT -= dt;
      if (this.comboFailT <= 0 && this.state !== 'dead' && this.state !== 'gameover') {
        this.comboDied = true;
        this.state = 'dead';
        this.bailing = false;
        this.respawnTimer = CONST.respawnDelay;
        this.onDeath(); // fade to black; the respawn restores normal dress
      }
    }
    this.pipeRideT = Math.max(0, this.pipeRideT - dt);
    this.pipeLandGraceT = Math.max(0, this.pipeLandGraceT - dt);
    this.lipCoolT = Math.max(0, this.lipCoolT - dt);
    this.transferCoolT = Math.max(0, this.transferCoolT - dt);
    this.slamSquash = Math.max(0, this.slamSquash - dt);
    this.slamFlatT = Math.max(0, this.slamFlatT - dt);
    this.ragFlailKickT = Math.max(0, this.ragFlailKickT - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    const bailWas = this.bailDownT;
    // TUMBLE -> STABLE CONTACT -> PROCEDURAL ROLL-UP. The old single timer
    // counted down in the air, then left a full 1.1s belly-down pause after
    // friction had already stopped the body. Reserve the final recovery window
    // until there is stable ground; once the slide is slow (or the impact clock
    // reaches that window), hand the body to a mashable forward roll instead.
    if (this.bailDownT > 0) {
      // Some bails begin already supported (a lost manual or a tumble-zone
      // spill) instead of crossing the ground through stepAir. That grounded
      // frame is still the first real body impact; launched trips remain
      // ineligible until their later landing records one below.
      if (
        this.ragImpacts === 0 &&
        this.ragActive &&
        this.bailRecoverT < 0 &&
        this.state === 'ride' &&
        this.grounded
      )
        this.noteRagdollGroundImpact();
      const edges =
        (input.jumpPressed ? 1 : 0) +
        (input.spinPressed ? 1 : 0) +
        (input.grabPressed ? 1 : 0) +
        (input.grindPressed ? 1 : 0);
      this.bailMash = Math.max(0, this.bailMash - dt / TUNING.bailMashWindow) + edges;
      this.bailRush = 1 + Math.min(this.bailMash * TUNING.bailMashGain, TUNING.bailMashMax);
      // Once the body has actually hit ground, X and the stick get one flaky
      // chance per impact to make the helpless tumble do something useful.
      // This runs before stable-ground arbitration so a lucky grounded fish
      // kick can interrupt the get-up and put the body back in the air.
      this.stepRagdollFlailInput(input, level);
      const stableGround =
        this.grounded &&
        this.state === 'ride' &&
        this.groundHit !== null &&
        !this.slipping &&
        this.rideNormal.y >= TUNING.footGrip - 0.03 &&
        !(this.onTransition && Math.abs(this.speed) > 3);
      this.bailGroundT = stableGround
        ? Math.min(BAIL_STABLE_TIME, this.bailGroundT + dt)
        : 0;
      const recoverDuration = Math.max(0.05, this.bailRecoverDuration);
      // A recovery is a supported forward roll, never a mid-air animation.
      // If the support really disappears (a ledge, collapsing platform, or a
      // new impact), return control to the ragdoll and earn a fresh stable
      // contact before trying again.
      if (this.bailRecoverT >= 0 && !stableGround) {
        this.bailRecoverT = -1;
        this.bailRecoveryPose = 0;
        this.bailGroundT = 0;
        this.bailDownT = Math.max(this.bailDownT, recoverDuration);
        this.bailVelocity.copy(this.axisF).multiplyScalar(this.speed);
        // Preserve the outgoing roll pose on the rare mid-rise fall. The new
        // rag quaternion is captured from that exact pose; a strong blend
        // prevents one frame of flat base pose showing through underneath it.
        this.ragBlend = 1;
        this.startRagdoll('air', 0, this.riderG ?? this.bodyGroup);
      }
      const canStartRecovery =
        this.bailRecoverT < 0 &&
        this.bailGroundT >= BAIL_STABLE_TIME &&
        (this.bailDownT <= recoverDuration + 1e-6 ||
          Math.abs(this.speed) <= BAIL_RECOVER_START_SPEED);
      if (canStartRecovery) {
        this.bailRecoverT = 0;
        this.bailDownT = Math.min(this.bailDownT, recoverDuration);
        // Cache the REAL travel heading once. Several wall/rail bails express
        // an away rebound as negative speed on the old approach axis; driving
        // +axisF from that representation would turn the roll back into the
        // obstacle. Flip the frame while preserving the exact velocity.
        if (this.speed < 0) {
          this.axisF.negate();
          this.axisL.negate();
          this.speed = -this.speed;
        }
        this.bailVelocity.copy(this.axisF).multiplyScalar(this.speed);
        this.bailExitSpeed = THREE.MathUtils.clamp(
          Math.max(this.bailExitSpeed, Math.abs(this.speed) * BAIL_EXIT_CARRY),
          BAIL_EXIT_MIN,
          BAIL_EXIT_MAX,
        );
        this.ragActive = false; // ragBlend now reveals the roll-up underneath
      }
      if (this.bailRecoverT >= 0) {
        this.bailRecoverT = Math.min(
          recoverDuration,
          this.bailRecoverT + dt * this.bailRush,
        );
        this.bailDownT = Math.max(0, recoverDuration - this.bailRecoverT);
        const u = THREE.MathUtils.clamp(
          this.bailRecoverT / recoverDuration,
          0,
          1,
        );
        this.bailRecoveryPose = u * u * (3 - 2 * u);
      } else {
        this.bailDownT = Math.max(
          recoverDuration,
          this.bailDownT - dt * this.bailRush,
        );
        this.bailRecoveryPose = 0;
      }
      // Long airs may hold the reserved recovery window for more wall-clock
      // time than the initial estimate. Protection follows the real state.
      this.invulnTimer = Math.max(this.invulnTimer, this.bailDownT + 0.15);
    } else {
      this.bailMash = 0;
      this.bailRush = 1;
      if (bailWas <= 0) {
        this.bailRecoverT = -1;
        this.bailRecoveryPose = 0;
        this.bailGroundT = 0;
      }
    }
    if (this.bailDownT === 0) this.ragActive = false; // the get-up owns the body again
    // A bail's tumble steers axisF/axisL down the fall line (free-skate
    // convention). If the get-up ends ON FOOT, restore the course control
    // frame — otherwise you walk away with rotated/inverted controls until
    // something else happens to reset them (the halfpipe-bail hijack).
    if (bailWas > 0 && this.bailDownT === 0 && !this.freeSkate && (this.state === 'ride' || this.state === 'air')) {
      // Collision is authoritative. The cached recovery vector is authored
      // before collide(), so a wall may have stopped or redirected it since;
      // axisF*speed is the actual final fixed-step velocity.
      BAIL_V.copy(this.axisF).multiplyScalar(this.speed);
      this.resolveBailControlFrame(level);
      this.axisF.copy(BAIL_CONTROL_F);
      this.axisL.copy(BAIL_CONTROL_L);
      this.walkVelocity.copy(BAIL_V);
      this.speed = this.walkVelocity.dot(this.axisF);
      this.walkRamp = Math.max(
        this.walkRamp,
        Math.min(1, this.walkVelocity.length() / Math.max(TUNING.walkSpeed, 0.01)),
      );
      this.bailGroundT = 0;
    }
    if (this.state !== 'air') {
      this.airRose = false; // each new air re-earns its "this was a jump" flag
      this.vertAir = false;
      this.pipeHang = false;
      this.vertLatVel = 0;
      this.hangPipe = null;
    }
    // The crit flag only means something while a balance meter is live —
    // anywhere else it must be OFF, or the last-chance arm flail plays
    // forever (grinds/manuals/stalls each reset it, but every exit path has
    // to agree, so enforce it centrally).
    if (this.state !== 'grind' && this.manualing === 0 && this.lipStallT <= 0) {
      this.balanceCritT = 0;
      this.balanceVel = 0; // no needle momentum survives a gap between balance tricks
    }
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    this.sketchyT = Math.max(0, this.sketchyT - dt);
    if (this.uberTimer > 0 && Math.random() < 0.5) this.emitSparks(1, 0xffd700, 1.2);
    if (this.grindBoostT > 0 && Math.random() < 0.7) this.emitSparks(1, 0xff4fd8, 1.6);
    // Actual planar speed from last step's displacement (any direction) —
    // the skate-entry gate uses this so sideways motion counts, not just the
    // forward-axis `speed` scalar. Computed before prevPos is overwritten.
    this.measurePlanar(dt);
    if (this.slideLandClamp) {
      // first full frame after a walk-slide touchdown: the measurement above
      // still holds the landing step's air speed — keep it at walking pace so
      // the skate-entry gate can't read the burst and take over
      this.lastPlanar = Math.min(this.lastPlanar, TUNING.walkSpeed);
      this.slideLandClamp = false;
    }
    if (this.slipClamp) {
      // a slither down a steep face can measure faster than a walk — cap it so
      // the descent never trips the skate-entry gate into a phantom board pop
      this.lastPlanar = Math.min(this.lastPlanar, TUNING.walkSpeed);
      this.slipClamp = false;
    }
    this.teetering = false; // stepRide re-detects it each tick

    // A slide taken from your feet ends back on your feet — the burst never
    // launches you into skating. lastPlanar still holds the slide's burst
    // speed from the previous step, so clamp it too or the skate-entry gate
    // reads it and takes over anyway.
    if (this.slideFromWalk && this.slideTimer <= 0 && this.state === 'ride' && this.grounded) {
      this.speed = THREE.MathUtils.clamp(this.speed, -TUNING.walkSpeed, TUNING.walkSpeed);
      this.lastPlanar = Math.min(this.lastPlanar, TUNING.walkSpeed);
      this.slideFromWalk = false;
    }

    // REVERT (THPS3+/THUG): R2 in the beat after a transition touchdown
    // pivots the board 180 — stance flips, a little speed pays for it, and
    // the combo string stays alive into the manual window instead of
    // banking. This is THE bridge that turns a vert air into a street line.
    if (this.revertT > 0) {
      this.revertT -= dt;
      // (no freeSkate gate: a dead-vertical pop can land at ~0 speed and step
      // you off the deck the same frame — the window itself is only ever
      // opened by a vert-air touchdown, so R2 here is always the revert)
      if (input.transferPressed && this.grounded && this.state === 'ride' && !this.isBailing) {
        this.revertT = 0;
        const oldStance = this.stance;
        this.stance = -this.stance as 1 | -1;
        this.visualYaw = wrapAngle(this.visualYaw + oldStance * Math.PI * this.sidePose);
        this.speed *= 0.88; // the pivot scrubs a little — THPS's revert tax
        this.landingScoring = true; // the revert IS part of the landing's trick window
        this.score(CONST.ptsRevert, 'Revert');
        this.landingScoring = false;
        this.comboTimer = Math.max(this.comboTimer, TUNING.manualLandGrace);
        this.emitSparks(6, 0xa0e8ff, 1.4);
        sfx.play('skateTransition', 0.55, 1.3);
      }
    }

    // The combo clock only runs while plain-rolling — airs, grinds, and
    // slides keep the string alive. Roll clean for the window and it banks.
    // Plain rolling runs the combo window out — but a live MANUAL or LIP STALL
    // is the connector itself: like a grind, the string never decays while
    // you're still balancing on it.
    if (
      this.comboTimer > 0 &&
      this.state === 'ride' &&
      this.grounded &&
      !this.sliding &&
      this.manualing === 0 &&
      this.lipStallT <= 0
    ) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.bankCombo();
    }

    // Circle/Q ON FOOT while moving fires a brief canned Crash slide:
    // direction locked, bursts to slideSpeed, smashes crates. All three feel
    // numbers (trigger threshold, duration, speed) are sliders. (Stopped,
    // holding it crawls instead — see stepRide. In the air it's a grab. ON THE
    // BOARD it's a brake/dismount instead — see the freeSkate branch below.)
    const stickMag = Math.abs(input.moveX) + Math.abs(input.moveY);
    if (
      input.grabPressed &&
      !this.isBailing &&
      this.state === 'ride' &&
      this.grounded &&
      !this.freeSkate && // skating? O is the brake, not a slide — this is an on-foot move only
      !this.crawling &&
      this.slideTimer <= 0 &&
      this.slideCd <= 0 &&
      !this.slideEndPending && // the last slide hasn't fully resolved (its grace/get-up beat is still running) — no re-fire yet
      this.slideRecoverT <= 0 &&
      (Math.abs(this.speed) >= TUNING.slideMinSpeed || stickMag > 0.4)
    ) {
      // 8-axis slide: it fires along the stick (diagonals included), or along
      // current travel if the stick is idle. A slide off your feet is Crash's
      // slide: canned burst, then back to walking.
      this.slideFromWalk = !this.charging && Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
      if (stickMag > 0.4) {
        this.slideVec
          .copy(this.axisF)
          .multiplyScalar(input.moveY)
          .addScaledVector(this.axisL, input.moveX)
          .normalize();
      } else if (this.walkVelocity.lengthSq() > 0.01) {
        this.slideVec.copy(this.walkVelocity).normalize();
      } else {
        this.slideVec.copy(this.axisF).multiplyScalar(Math.sign(this.speed || 1));
      }
      this.slideSpd = Math.min(
        Math.max(Math.abs(this.speed), TUNING.slideSpeed),
        TUNING.downhillMax,
      );
      this.slideDistanceLeft = Math.max(0, TUNING.slideDistance);
      this.slideGraceHold = false;
      // A constant-deceleration stop satisfies t = 2d/v. The timer remains a
      // useful pose/spin-cancel channel, while distance is the authority.
      this.slideTimer =
        this.slideDistanceLeft > 0 && this.slideSpd > 0
          ? (2 * this.slideDistanceLeft) / this.slideSpd
          : 0;
      this.walkVelocity.set(0, 0, 0);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
      this.walkRamp = 0;
      // Keeping Circle held out the far side of the slide flows into the crawl
      // instead of the get-up beat (a release drops it — see stepRide).
      this.slideCrawlChain = true;
      // Entering the slide drops any charge held from BEFORE it — only a
      // FRESH X press during the slide arms the Crash slide-jump.
      this.charging = false;
      this.chargeTimer = 0;
      this.jumpBufferT = 0;
      this.score(CONST.ptsSlide, 'Slide');
      sfx.play('woosh', 0.7);
    }

    // Rail candidate is computed once per step: used for grind entry, the
    // assisted landing snap, and the debug panel.
    // grindRails = the authored bars PLUS the tops of any crate runs. The
    // on-foot rail block and the fall-onto-a-bar smack keep reading
    // level.rails, so a crate still behaves like a crate for both of those.
    this.railCand = nearestRail(level.grindRails, this.pos);
    this.railCandidateDist = this.railCand ? this.railCand.sample.distance : Infinity;

    if (input.restartPressed) {
      this.respawn(level, true);
      this.finishVisualStep(input, dt);
      return;
    }

    this.applySpeedPad();
    if (this.state === 'ride' && this.grounded && this.groundHit)
      this.launchFromTrampoline(this.groundHit, input);

    switch (this.state) {
      case 'dead':
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          if (this.ttDied || this.comboDied) {
            // a special-mode death: back to the very start, mode off
            this.ttDied = false;
            this.comboDied = false;
            this.respawn(level, true);
          } else if (this.lives < 0) {
            // out of lives: hold on the black screen until any button
            this.state = 'gameover';
            this.onGameOver();
          } else {
            this.respawn(level);
          }
        }
        break;
      case 'gameover':
        if (
          input.jumpPressed ||
          input.spinPressed ||
          input.grabPressed ||
          input.grindPressed ||
          input.restartPressed
        ) {
          this.respawn(level, true);
        }
        break;
      case 'finished':
        this.stepFinished(dt, level);
        break;
      case 'ride': {
        this.runTime += dt;
        // Triangle on a halfpipe TRANSITION splits by approach angle: SQUARE
        // to the wall (within lipAngle of 90°) it means the LIP STALL, so the
        // rail snap must not steal the coping mid-climb. OFF-AXIS, the coping
        // is a rail like any other — Triangle grinds it. On the flat, decks,
        // and everywhere else Triangle always grabs rails as usual. A live
        // stall also owns the button.
        const wallPipe =
          this.grounded && this.groundHit !== null && this.groundHit.normal.y < 0.9
            ? this.groundHit.halfpipe
            : undefined;
        const stallApproach = wallPipe !== undefined && this.lipHeadOn(wallPipe);
        if (
          this.lipStallT <= 0 &&
          !stallApproach &&
          (input.grindPressed || input.grindHeld) &&
          this.tryGrind(input.grindPressed, level)
        ) {
          // snapped straight onto the rail this tick
        } else {
          this.stepRide(dt, input, level);
        }
        break;
      }
      case 'air':
        this.runTime += dt;
        // A second Jump release may be the once-per-ollie emergency eject.
        // Resolve that transaction before any new attachment so one edge can
        // never both throw the board and catch a rope (or rail) on this tick.
        const emergencyEjected = this.tickEmergencyBoardEject(dt, input);
        // SPINE TRANSFER: R2 mid-hang pops the hang over the coping onto the
        // adjacent vert (when there is one). Deliberate, edge-triggered.
        if (!emergencyEjected && !this.isBailing && input.transferPressed)
          this.trySpineTransfer(level);
        // NOTE: there is deliberately NO lip-stall catch from the air. The
        // stall is committed ON the wall (climb square holding Triangle,
        // through the crest) — once you're in hangtime, coming down onto the
        // lip drops you back in (or snaps a coping grind like any rail if
        // Triangle is held). Getting parked on the coping out of a big hang
        // killed the flow.
        if (
          !emergencyEjected &&
          this.ropeCoolT <= 0 &&
          !this.wallriding &&
          !this.slamActive &&
          !this.isBailing &&
          this.tryRopeGrab(level)
        ) {
          // hands on the swing rope
        } else if (
          !emergencyEjected &&
          !this.wallriding &&
          (input.grindPressed || input.grindHeld) &&
          this.tryGrind(input.grindPressed, level)
        ) {
          // grabbed the rail
        } else {
          this.stepAir(dt, input, level, emergencyEjected);
        }
        break;
      case 'grind':
        this.runTime += dt;
        this.stepGrind(dt, input, level);
        break;
    }

    this.updateSpin(dt, input);
    // A trick can start on this very tick. Refresh before gate/rail collision
    // so a correctly timed press is never delayed one fixed step.
    this.syncReusablePrimitives(level);
    this.updateGrab(dt, input);
    if (this.sliding) this.emitDust(2); // baseball-slide dust off the ground
    // Running kicks up a puff at every footfall — the Crash dust trail.
    if (this.grounded && this.walkAmp > 0.5) {
      const stepSgn = Math.sign(Math.sin(this.walkPhase)) || 1;
      if (stepSgn !== this.runStepSign) {
        this.runStepSign = stepSgn;
        this.emitDust(2);
      }
    }
    this.updateSparks(dt);
    this.updatePuffs();
    this.updateFlyBoard(dt, level);
    this.updateFruit(dt);

    if (this.state === 'ride' || this.state === 'air' || this.state === 'grind') {
      this.collide(level);
      // All boxes broken -> the gem materializes on the spot, Crash rules.
      // Breaking the last box no longer HANDS you the gem — it makes the gem
      // exist. Picking it up is below, and that is where the points are.
      if (
        !this.gemSpawned &&
        level.totalCrates > 0 &&
        this.cratesBroken >= level.totalCrates &&
        (this.state as MoveState) !== 'dead'
      ) {
        this.gemSpawned = true;
        const where = level.awardGem(this.pos);
        sfx.play('lifeGet', 0.9);
        this.onRelic('ALL BOXES!', where === 'gate' ? 'the gem is at the finish' : 'grab the gem');
      }
      // Blast aftermath: tally crates the explosions broke, and die if we're
      // inside an expanding blast sphere.
      for (const c of level.consumeBlastBroken()) {
        this.cratesBroken++;
        this.score(CONST.ptsCrate, 'Box');
        this.crateReward(c);
      }
      if (this.pos.y < level.killY) this.die();
    }

    this.blastCheck(level);

    // Re-arm the wallride once you've touched the ground or caught a rail grind
    // (you get one wallride per air-time — no wall-to-wall chaining).
    if (this.grounded || this.state === 'grind') this.wallrideLatched = false;

    this.finishVisualStep(input, dt);
  }

  // ---------------------------------------------------------------- states --

  private confirmSpecial(trick: SpecialTrick): void {
    this.special.commit(trick);
    this.specialActivationCount++;
    // The supplied sting is a signature cue, so keep it at exact pitch rather
    // than applying the ordinary one-shot jitter.
    sfx.play('specialTrick', 0.82, 1, 0);
    this.emitSparks(14, 0xffd22e, 2.4);
  }

  private clearSpecialMoves(): void {
    this.pendingSpecialFlip = null;
    this.pendingSpecialGrab = null;
    this.pendingSpecialGrind = null;
    this.specialFlip = null;
    this.flipDuration = CONST.flipTime;
    this.specialGrab = null;
    this.specialGrabT = 0;
    this.specialGrabLanding = false;
    this.specialGrind = null;
  }

  private grindTrickName(): string {
    return this.specialGrind?.label ?? GRIND_NAMES[this.grindStyle];
  }

  // Score an action. Combos live in the AIR and on rails/slides only: those
  // actions stack base + multiplier, THPS-style, and bank on a clean landing.
  // Plain ground actions (spinning a box while standing there) just pay flat
  // points — they never start or feed a combo. Bail or die = the combo dies.
  private score(base: number, label?: string): { shown: string | undefined; pay: number } {
    const inTrick =
      this.landingScoring ||
      this.state === 'air' ||
      this.state === 'grind' ||
      this.state === 'rope' || // hanging on the swing: airborne in spirit
      this.sliding ||
      this.manualing !== 0 || // balanced on two wheels: the combo connector
      this.lipStallT > 0; // parked on the coping: same deal
    // World rewards (crates, fruit, enemies, pickups) always pay face value.
    // Actual TRICKS are subject to the two THPS score rules below.
    const isTrick = !!label && !/Boing|Flattened|Takedown|Bonk|^Box$|Slam Smash|Crystal|Gem/.test(label);
    let pay = base;
    let shown = label;
    if (inTrick && isTrick && label) {
      // THPS4/THUG anti-farming: the Nth use of the same trick in ONE combo
      // pays a declining share of its base (the plate still shows it).
      const uses = this.comboUses.get(label) ?? 0;
      this.comboUses.set(label, uses + 1);
      const curve = CONST.repeatDecay;
      pay = Math.round(base * curve[Math.min(uses, curve.length - 1)]);
    }
    // Three masks banked = the special state: every trick is renamed on the
    // plate and pays extra — the THPS special-meter payoff, earned Crash-style.
    if (isTrick && this.uberTimer > 0 && label) {
      pay *= CONST.uberScoreMult;
      shown = 'Tiki ' + label;
    }
    if (inTrick && isTrick) this.special.award(pay);
    if (inTrick) {
      this.comboPoints += pay;
      // THE MULTIPLIER COUNTS TRICKS, not scoring events. World rewards —
      // fruit (label-less!), crates, bounces, enemies, pickups — bank their
      // points INTO the combo but mint no X: the jungle log is strewn with
      // wumpa, and grinding it was silently pumping one Lipslide to X10+,
      // one invisible +1 per fruit swallowed.
      if (isTrick) this.comboMult += 1;
      // never SHORTEN the remaining window — a spin bonus scored right after
      // touchdown must not eat the post-landing manual grace
      this.comboTimer = Math.max(this.comboTimer, CONST.comboWindow);
      if (shown) {
        this.pushLabel(shown);
        // Real tricks (grabs, grinds, wallride, slide, body slam) light up the
        // combo plate; bare platforming — spins (…°), crate bounces (Boing),
        // enemy pops (Flattened/Takedown/Bonk), box smashes — do not on their own.
        if (!/°$|Boing|Flattened|Takedown|Bonk|^Box$|Slam Smash|Crystal|Gem/.test(shown))
          this.comboHasTrick = true;
      }
      this.comboHudActionRevision++;
    } else {
      this.points += pay;
    }
    return { shown, pay };
  }

  // The plate follows a trick whose name resolves after it scored (grab
  // variants, a spin folding into its grab): rewrite the entry in place,
  // keeping any "xN" collapse it picked up.
  private renameLabel(from: string, to: string): void {
    for (let i = this.comboLabels.length - 1; i >= 0; i--) {
      const l = this.comboLabels[i];
      if (l === from) {
        this.comboLabels[i] = to;
        return;
      }
      const m = l.match(/^(.*) x(\d+)$/);
      if (m && m[1] === from) {
        this.comboLabels[i] = `${to} x${m[2]}`;
        return;
      }
    }
  }

  // THPS readout: repeated tricks collapse into "Box x3".
  private pushLabel(label: string): void {
    const n = this.comboLabels.length;
    if (n > 0) {
      const last = this.comboLabels[n - 1];
      const m = last.match(/^(.*) x(\d+)$/);
      const base = m ? m[1] : last;
      if (base === label) {
        const count = m ? parseInt(m[2], 10) + 1 : 2;
        this.comboLabels[n - 1] = `${label} x${count}`;
        return;
      }
    }
    this.comboLabels.push(label);
  }

  private bankCombo(): void {
    if (this.comboPoints > 0) {
      // World rewards collected mid-air with no trick still land their points
      // — multiplied by the TRICK count when there is one, at face value when
      // there is not (mult floors at x1 here, it no longer counts pickups).
      const amount = this.comboPoints * Math.max(1, this.comboMult);
      this.points += amount;
      // Cash-in ticker only when the plate was actually up (a real trick chained);
      // platforming-only points just land on the score.
      if (this.comboHasTrick && this.comboMult > 0)
        this.onComboBank(amount, sourceComboLabelLine(this.comboLabels));
    }
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
    this.comboUses.clear();
    this.deckTricksThisCombo.clear();
  }

  // Crash mask rules: masks come from mask crates only. The first two are
  // held; the THIRD triggers temporary invincibility (uber) — auto-smash on
  // touch, perfect rail balance, immune to everything except the pit.
  private gainMask(): void {
    if (this.masks >= 2 || this.uberTimer > 0) {
      this.uberTimer = CONST.uberTime;
      this.emitSparks(14, 0xffd700, 2.5);
      sfx.play('lifeGet', 1.0);
    } else {
      this.masks++;
      sfx.play('maskGet', 0.9);
    }
  }

  // Spend a mask to survive something. Returns true if one was available.
  // A BLAST DOESN'T CARE WHAT YOU WERE DOING. This used to live inside the
  // ride/air/grind block of step(), which meant a bomb going off in your face
  // while you hung off a ledge or rode a rope did nothing at all — and the
  // rope spin can set off a TNT itself. Called from every live path now.
  // Uber, masks, and the flicker after spending one still block it.
  private blastCheck(level: Level): void {
    const st = this.state as MoveState;
    if (st === 'dead' || st === 'gameover' || st === 'finished') return;
    if (this.invulnTimer > 0 || this.uberTimer > 0) return;
    const center = BLAST_AT.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
    for (const ex of level.explosions) {
      if (ex.safe || ex.t > CONST.blastGrow + 0.05) continue;
      const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
      if (center.distanceTo(ex.center) < r + 0.5) {
        if (!this.spendMask()) this.die();
        return;
      }
    }
  }

  private spendMask(): boolean {
    if (this.masks <= 0) return false;
    this.masks--;
    this.invulnTimer = CONST.maskInvuln;
    this.invulnSilent = false; // a mask absorb DOES flicker — no tumble to read
    sfx.play('maskLoss', 0.9);
    this.emitSparks(8, 0xffd27a, 2);
    return true;
  }

  // Release-triggered charged jump: tap = jumpMinVelocity, full hold =
  // jumpVelocity. The jump's IDENTITY is decided here, at release, from the
  // state and speed you're carrying — not from how X was pressed.
  private chargedJump(dt: number): void {
    this.boardOllieAir = false;
    this.emergencyEjectChargeT = 0;
    this.emergencyEjectCharging = false;
    this.emergencyEjectUsed = false;
    this.emergencyEjectLandingPending = false;
    this.emergencyEjectLandingWillBail = false;
    this.deckTricksThisAir.clear();
    const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
    // A crouch that ended within the grace window still counts as a crouch jump.
    const wasCrawling = this.crawling || this.crouchGraceT > 0;
    this.crouchGraceT = 0; // consumed by this jump either way
    // Ollieing out of a manual is the CLEAN exit — back to four wheels in the
    // air, combo string still alive (the air refreshes it with the next trick).
    if (this.manualing !== 0) this.endManual();
    // The slide boost applies during the slide AND for slideJumpGrace seconds
    // after it ends — the old exact-window timing was nearly unhittable.
    const fromSlide = this.slideTimer > 0 || this.slideGraceT > 0;
    // Grabs are board tricks: only a launch that is actually mounted offers
    // them. A slide jump is explicitly a boardless platforming move.
    this.airFromSkate = this.freeSkate && !fromSlide;
    // Gravity is declared by the branch that actually picks the launch. Start
    // at 'foot' and let the mounted-board branches claim the skating arc.
    this.airGrav = 'foot';
    this.slideGraceT = 0;
    // THE RAMP CLIMB. Rolling off a lip with NO input converts the climb into
    // height (see the crest paths: `lastTy * speed`). The board ollie below used
    // to OVERWRITE vVel with its own pop, so pressing X at a 30 degree kicker at
    // speed 23 launched you at ollieMinVelocity instead of the 11.5 you'd have
    // got for free — pressing jump made you jump LOWER. Stack the pop on the
    // climb instead, exactly like the vert branch already does. lastTy is 0
    // while walking and while airborne, so this is self-gating.
    const rampClimb =
      this.grounded && this.takeoffTy > 0 ? Math.max(0, this.speed * this.takeoffTy) : 0;
    // VERT OLLIE: X popped while riding a halfpipe TRANSITION face. The flat
    // ollie below would carry the whole climb speed as HORIZONTAL velocity —
    // an unglued air that sails clean across the pipe (THE "float out of
    // hangtime": pump with X held, release at the lip, fly to the flat).
    // On the wall, the pop converts the climb to HEIGHT and the wall glue
    // owns the air, exactly like cresting — locked-in hang time, spins and
    // grabs included. The pipe's flat bottom (normal.y ~ 1) still gets the
    // ordinary ollie: jumping ACROSS the trough from the flat is legit.
    if (
      this.grounded &&
      this.freeSkate &&
      !fromSlide &&
      this.groundHit !== null &&
      this.groundHit.normal.y < 0.9 &&
      // analytic pipe wall, OR any steep MESH transition (bowls, banked
      // walls) — the pop is a vert launch on both; mesh faces skip the
      // pipe-hang rules and take the TRACKED hang instead
      (this.groundHit.halfpipe !== undefined || this.onTransition)
    ) {
      // The pop off a wall used to run the on-foot 10..13 scale — roughly TWICE
      // what cresting the same wall at the same speed paid (pipePop 6). That's a
      // shortcut: the pop alone carried the air, so pump quality stopped
      // mattering and pipePumpGain/pipeCarve lost the risk/reward they exist to
      // build. Scale it off pipePop instead (THPS's own floor ratio ~0.36), and
      // give the climb the same lastTy floor the crest path uses so popping from
      // a shallow part of the wall is never strictly worse than cresting it.
      const pop = THREE.MathUtils.lerp(TUNING.pipePop * 0.4, TUNING.pipePop, t);
      const climb = Math.max(0, this.speed * Math.max(this.lastTy, 0.6));
      this.vVel = Math.min(pop + climb, CONST.maxFallSpeed);
      if (this.groundHit.halfpipe) {
        this.hangPipe = this.groundHit.halfpipe;
        this.pipeRideT = Math.max(this.pipeRideT, 0.05); // enterVertAir: pipe-hang rules
      }
      this.lastJumpType = 'Board Ollie';
      this.state = 'air';
      this.grounded = false;
      this.airGrav = 'board'; // (vert owns the gravity while glued; this is what the blend eases back TO)
      this.coyoteTimer = 0;
      this.charging = false;
      this.chargeTimer = 0;
      this.crawling = false;
      this.enterVertAir(false); // the pop IS the launch: glue on, speed into the hang
      sfx.play('ollie', 0.7);
      return;
    }
    // Measured planar speed this step, so the jump reads your ACTUAL movement
    // in any direction — a fast sideways walk stores nothing in `speed` (that
    // scalar is the forward axis), but it still deserves a Forward Flip.
    const planar =
      Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.crawling = false;
    this.vVel =
      THREE.MathUtils.lerp(TUNING.jumpMinVelocity, TUNING.jumpVelocity, t) *
      (fromSlide ? TUNING.slideJumpHeight : 1);
    if (wasCrawling) this.vVel *= CONST.crouchJumpMult; // crouch jump: extra height
    const spd = Math.max(Math.abs(this.speed), planar); // direction-agnostic
    // Crouch and slide jumps strike the classic Crash star pose in the air.
    if (fromSlide || wasCrawling) this.starTimer = 0.6;
    if (fromSlide) {
      // Crash slide-jump: a HIGH, CONTROLLED platforming leap — deliberately NOT
      // a skating move. The horizontal launch is a consistent punch over WALK
      // speed (independent of how fast the slide was, so distance is
      // predictable), it grants no board tricks, and it always lands back on
      // your feet — never flipping out the board into skating. slideJumpHeight
      // owns the pop; slideJumpTravel is the extra horizontal reach over a walk.
      // Launch in the SLIDE's actual direction: split the controlled magnitude
      // into along-heading (speed) and across-heading (slideAirLat) parts so a
      // SIDEWAYS slide-jump flies sideways, a forward one flies forward — no
      // forced forward component turning it diagonal.
      const sjMag = TUNING.walkSpeed * (1 + TUNING.slideJumpTravel);
      const dir = this.slideVec.lengthSq() > 0.01 ? this.slideVec : this.axisF;
      const fwd = dir.x * this.axisF.x + dir.z * this.axisF.z;
      const lat = dir.x * this.axisL.x + dir.z * this.axisL.z;
      this.speed = sjMag * fwd;
      this.slideAirLat = sjMag * lat;
      this.slideJumpAir = true; // committed arc: input can't add a diagonal
      this.airFromSkate = false; // a platforming hop, not a board air (no grabs, no skate carry)
      this.slideFromWalk = true; // force the on-foot touchdown clamp: no skate takeover on landing
      this.freeSkate = false; // DROP the board — a slide jump is on-foot even if you slid out of a skate
      this.stepOff = true;
      this.slideTimer = 0;
      this.slideDistanceLeft = 0;
      this.slideSpd = 0;
      this.slideGraceHold = false;
      this.slideEndPending = false; // consumed by a slide JUMP: no plain-slide scrub
      this.slideCrawlChain = false; // a jump out of the slide, not a crawl chain
      this.slideCd = CONST.slideCooldown;
      this.airMomentum = true;
      this.lastJumpType = 'Slide Jump';
      sfx.play('woosh2', 0.6);
    } else if (this.freeSkate) {
      // Leaving the mounted board: THPS board ollie at any rolling speed. The
      // deck's ownership, not an arbitrary speed threshold, defines the move.
      // The ollie charges on its
      // OWN min..max scale, decoupled from the on-foot jump — X doubles as
      // the skate accelerator, so riding the charge scale up to jumpVelocity
      // made every accelerating jump a moon jump. Cruising on direction keys
      // and tapping X gives the small pop; a held charge earns the big one.
      const pop = THREE.MathUtils.lerp(TUNING.ollieMinVelocity, TUNING.ollieVelocity, t);
      // DOWNHILL OLLIE: the road keeps falling away under the arc, so a flat
      // pop up there buys near-double the airtime and reads as floaty. Fold
      // a tunable fraction of the descent rate (slope x speed, negative) back
      // into the pop so the arc follows the hill — floored so a charged ollie
      // is never robbed of its crate clearance.
      const descent = Math.min(0, this.speed * this.takeoffTy);
      this.vVel = Math.min(
        rampClimb + Math.max(pop * 0.45, pop + descent * TUNING.ollieDownCouple),
        CONST.maxFallSpeed,
      );
      this.lastJumpType = 'Board Ollie';
      this.boardOllieAir = true;
      this.airGrav = 'board'; // the one branch that is unambiguously a skate air
      // Launched off a ramp or an UPHILL face: ballistic (rampFallGravity)
      // instead of the flat-ollie snap. A DOWNHILL launch keeps the snap —
      // the ballistic glide on a descending road was the other half of the
      // float.
      this.floatAir = (rampClimb > 0.5 || this.rideNormal.y < 0.985) && descent >= -0.5;
      sfx.play('ollie', 0.7);
    } else if (spd > TUNING.walkSpeed * 0.45) {
      // On foot with real run speed. The Crash rule from the reference: a
      // direction HELD into the jump (flipHoldTime slider) is a committed
      // running leap — full forward somersault. A neutral jump that's only
      // steered after takeoff stays a plain jump, no roll.
      if (CONST.frontFlip && this.dirHoldT >= TUNING.flipHoldTime && this.starTimer <= 0) {
        this.lastJumpType = 'Forward Flip';
        this.flipTimer = CONST.flipDuration;
      } else {
        this.lastJumpType = 'Running Jump';
      }
      sfx.play('footstep2', 0.55, 1.5);
    } else {
      // (near-)standing: plain vertical Crash hop
      this.lastJumpType = wasCrawling ? 'Crouch Jump' : 'Neutral Hop';
      sfx.play('footstep2', 0.55, 1.5);
    }
    this.state = 'air';
    this.grounded = false;
    this.coyoteTimer = 0;
    this.charging = false;
    this.chargeTimer = 0;
  }

  private noteRagdollGroundImpact(): void {
    this.ragImpacts++;
    this.ragFlailKickT = Math.max(this.ragFlailKickT, 0.12);
    // Contact-created bails did not exist during the pre-collision input pass.
    // Latch any stick already held on this exact impact so only a release and
    // fresh post-impact pulse may spend the new steering opportunity.
    if (
      this.rawInput &&
      Math.hypot(this.rawInput.moveX, this.rawInput.moveY) > 0.35
    )
      this.ragSteerInputLatched = true;
  }

  private stepRagdollFlailInput(input: Input, level: Level): void {
    const moveX = this.rawInput.moveX;
    const moveY = this.rawInput.moveY;
    const moveHeld = Math.hypot(moveX, moveY) > 0.35;
    if (!moveHeld) this.ragSteerInputLatched = false;
    else if (this.ragImpacts <= 0) this.ragSteerInputLatched = true;
    if (
      !this.ragActive ||
      this.ragImpacts <= 0 ||
      this.bailRecoverT >= 0 ||
      this.state === 'dead' ||
      this.state === 'gameover'
    )
      return;

    // X remains part of the mash-out rhythm, but after impact its first edge
    // also rolls the dice on a deliberately bad "fish jump". One roll per
    // impact and two successes per bail keep it playful without allowing an
    // infinite invulnerable air chain.
    if (
      input.jumpPressed &&
      this.ragJumpAttemptImpact < this.ragImpacts &&
      this.ragFishJumps < RAG_FLAIL_MAX_JUMPS
    ) {
      this.ragJumpAttemptImpact = this.ragImpacts;
      this.ragFlailKickT = Math.max(this.ragFlailKickT, 0.28);
      const jumpChance = THREE.MathUtils.clamp(TUNING.ragFlailJumpChance, 0, 1);
      if (jumpChance > 0 && this.simRand() < jumpChance) {
        const impulse = Math.max(0, TUNING.ragFlailJumpVelocity) *
          THREE.MathUtils.lerp(0.72, 1.12, this.simRand());
        this.vVel = Math.min(
          RAG_FLAIL_MAX_UP_SPEED,
          Math.max(0, this.vVel) * 0.42 + impulse,
        );
        this.state = 'air';
        this.grounded = false;
        this.groundHit = null;
        this.airFromSkate = false;
        this.airGrav = 'foot';
        this.airMomentum = true;
        this.airRose = true;
        this.airborneT = 0;
        this.launchVy = this.vVel;
        this.airPeakY = this.pos.y;
        this.bailGroundT = 0;
        this.bailDownT = Math.max(this.bailDownT, this.bailRecoverDuration);
        this.ragFishJumps++;
        // Cosmetic chaos stays off the replay RNG stream.
        this.ragAngVel.x += (3 + Math.random() * 4) * (Math.random() < 0.5 ? -1 : 1);
        this.ragAngVel.z += (Math.random() - 0.5) * 5;
        sfx.play('woosh2', 0.45, 0.72 + Math.random() * 0.18);
        this.emitDust(2);
      } else {
        // A miss still reads as input: the body arches and kicks, but gains no
        // authoritative velocity. That visible lie is the flaky-control joke.
        this.ragAngVel.x += (Math.random() - 0.5) * 3;
        this.ragAngVel.z += (Math.random() - 0.5) * 4;
      }
    }

    // One course/camera-relative steering pulse per impact. Even a success is
    // rotated away from the requested direction and only partially blends the
    // current velocity toward it, so this never becomes ordinary air control.
    if (
      this.state === 'air' &&
      !this.grounded &&
      moveHeld &&
      !this.ragSteerInputLatched &&
      this.ragSteerAttemptImpact < this.ragImpacts
    ) {
      this.ragSteerInputLatched = true;
      this.ragSteerAttemptImpact = this.ragImpacts;
      this.ragFlailKickT = Math.max(this.ragFlailKickT, 0.2);
      const steerChance = THREE.MathUtils.clamp(TUNING.ragFlailSteerChance, 0, 1);
      if (steerChance > 0 && this.simRand() < steerChance) {
        this.resolveBailControlFrame(level);
        BAIL_TARGET.copy(BAIL_CONTROL_F)
          .multiplyScalar(moveY)
          .addScaledVector(BAIL_CONTROL_L, moveX)
          .normalize();
        const error = THREE.MathUtils.degToRad(
          THREE.MathUtils.clamp(TUNING.ragFlailSteerJitter, 0, 180),
        ) * (this.simRand() * 2 - 1);
        const cos = Math.cos(error);
        const sin = Math.sin(error);
        const tx = BAIL_TARGET.x;
        const tz = BAIL_TARGET.z;
        BAIL_TARGET.x = tx * cos - tz * sin;
        BAIL_TARGET.z = tx * sin + tz * cos;
        const kickSpeed = Math.max(0, TUNING.ragFlailSteerSpeed) *
          THREE.MathUtils.lerp(0.65, 1, this.simRand());
        const currentSpeed = Math.abs(this.speed);
        BAIL_V.copy(this.axisF).multiplyScalar(this.speed);
        BAIL_TARGET.multiplyScalar(Math.max(kickSpeed, currentSpeed));
        BAIL_V.lerp(BAIL_TARGET, THREE.MathUtils.lerp(0.34, 0.58, this.simRand()));
        const velocity = BAIL_V.length();
        if (velocity > 1e-4) {
          const cap = Math.max(TUNING.downhillMax, currentSpeed);
          this.speed = Math.min(velocity, cap);
          this.axisF.copy(BAIL_V).multiplyScalar(1 / velocity);
          this.axisL.set(this.axisF.z, 0, -this.axisF.x);
          this.bailVelocity.copy(this.axisF).multiplyScalar(this.speed);
        }
        this.ragAngVel.y += (Math.random() - 0.5) * 5;
        this.ragAngVel.z += (Math.random() - 0.5) * 6;
      }
    }
  }

  private stepBailRecoveryMotion(dt: number, input: Input, level: Level): void {
    const p = this.bailRecoveryPose;
    const recovery = sampleBailRecovery(p);
    this.bailVelocity.copy(this.axisF).multiplyScalar(this.speed);
    const intent = Math.min(1, Math.hypot(input.moveX, input.moveY));
    const moveU = THREE.MathUtils.clamp(
      (p - BAIL_MOVE_START) / (BAIL_MOVE_END - BAIL_MOVE_START),
      0,
      1,
    );
    const moveW = moveU * moveU * (3 - 2 * moveU) * intent;
    // The roll owns a modest forward run-out even with no stick held. This is
    // what moves the recovery off the planted feet and hands real velocity to
    // the run state instead of finishing as a stationary rake pop.
    const carriedCrash = THREE.MathUtils.clamp(
      (this.bailExitSpeed - BAIL_EXIT_MIN) / Math.max(0.01, BAIL_EXIT_MAX - BAIL_EXIT_MIN),
      0,
      1,
    );
    const automaticRunOut = Math.max(0, TUNING.bailRollOutSpeed) *
      THREE.MathUtils.lerp(0.85, 1.25, carriedCrash);
    BAIL_TARGET.copy(this.axisF).multiplyScalar(automaticRunOut * recovery.drive);
    if (moveW > 0) {
      // Recovery motion turns the gameplay axes to its ACTUAL travel vector
      // below. Deriving the next input target from those same rotating axes
      // made a held sidestep chase itself around in a circle. Resolve the
      // already-remapped stick through the stable course/camera frame instead.
      this.resolveBailControlFrame(level);
      BAIL_TARGET.copy(BAIL_CONTROL_F)
        .multiplyScalar(input.moveY)
        .addScaledVector(BAIL_CONTROL_L, input.moveX);
      if (BAIL_TARGET.lengthSq() > 1e-6) {
        BAIL_TARGET.normalize();
        const runOut = Math.min(
          TUNING.walkSpeed * 0.62,
          Math.max(this.bailExitSpeed, TUNING.walkSpeed * 0.45),
        );
        BAIL_TARGET.multiplyScalar(runOut);
        BAIL_V.copy(this.axisF).multiplyScalar(automaticRunOut * recovery.drive);
        BAIL_TARGET.lerp(BAIL_V, 1 - moveW);
      }
    }
    BAIL_DELTA.copy(BAIL_TARGET).sub(this.bailVelocity);
    const delta = BAIL_DELTA.length();
    const walkAccel =
      TUNING.walkRampTime > 0
        ? TUNING.walkSpeed / TUNING.walkRampTime
        : TUNING.bailFriction;
    const response = THREE.MathUtils.lerp(
      TUNING.bailFriction,
      walkAccel,
      moveW,
    );
    const maxChange = response * dt;
    if (delta <= maxChange || delta <= 1e-6) this.bailVelocity.copy(BAIL_TARGET);
    else this.bailVelocity.addScaledVector(BAIL_DELTA, maxChange / delta);

    const velocity = this.bailVelocity.length();
    if (velocity <= 0.05) {
      this.bailVelocity.set(0, 0, 0);
      this.speed = 0;
      return;
    }
    BAIL_V.copy(this.bailVelocity).multiplyScalar(1 / velocity);
    // No locked recovery input may roll a helpless body into a lethal gap.
    const ahead = this.queryGround(
      level,
      BAIL_V.x * 0.9,
      BAIL_V.z * 0.9,
      this.pos.y + BAIL_MAX_STEP,
    );
    if (
      ahead === null ||
      ahead.y <= level.killY ||
      ahead.y < this.pos.y - BAIL_MAX_STEP ||
      ahead.normal.y < TUNING.footGrip - 0.03
    ) {
      this.bailVelocity.set(0, 0, 0);
      this.speed = 0;
      return;
    }
    this.axisF.copy(BAIL_V);
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.speed = velocity;
  }

  /** Stable input frame for a recovery whose physical heading is still free. */
  private resolveBailControlFrame(level: Level): void {
    const chaseMode = TUNING.chaseCam > 0.5 && !level.boulder;
    const laneDir = level.laneDirAt(
      this.pos.x,
      this.pos.y,
      this.pos.z,
      this.laneCursor,
    );
    if (laneDir || chaseMode) {
      const fx = laneDir?.x ?? this.camDir.x;
      const fz = laneDir?.z ?? this.camDir.z;
      const inv = 1 / (Math.hypot(fx, fz) || 1);
      BAIL_CONTROL_F.set(fx * inv, 0, fz * inv);
      BAIL_CONTROL_L.set(-fz * inv, 0, fx * inv);
      return;
    }
    if (this.travelDir === 'S') {
      BAIL_CONTROL_F.set(0, 0, -1);
      BAIL_CONTROL_L.set(1, 0, 0);
    } else if (this.travelDir === 'N') {
      BAIL_CONTROL_F.set(0, 0, 1);
      BAIL_CONTROL_L.set(1, 0, 0);
    } else if (this.travelDir === 'E') {
      BAIL_CONTROL_F.set(1, 0, 0);
      BAIL_CONTROL_L.set(0, 0, -1);
    } else {
      BAIL_CONTROL_F.set(-1, 0, 0);
      BAIL_CONTROL_L.set(0, 0, -1);
    }
  }

  private stepRide(dt: number, input: Input, level: Level): void {
    // LIP STALL owns the whole frame: parked stationary on the coping,
    // BALANCING — the needle (up/down on the stick, the vertical meter) tips
    // between the pipe below and the deck out back. Points tick, combo alive.
    //  - tip INTO the pipe (needle pegs low)  -> drop back in, trick KEPT
    //  - tip OUT THE BACK (needle pegs high)  -> the honest bail
    //  - ollie out any time                    -> an air; land it and it banks
    //  - release Triangle / timer up           -> drop back in, trick kept
    if (this.lipStallT > 0) {
      this.lipStallT -= dt;
      // (no runTime here: the 'ride' case in step() already counted this frame
      // before calling stepRide — adding it again ran the clock at 2x through
      // every lip stall, inflating trial times and the animation clock)
      this.speed = 0;
      this.vVel = 0;
      // needle: + = tipping into the pipe (drifts there naturally), − = deck.
      // Difficulty ramps the longer you hold the stall.
      const stallAge = TUNING.lipMaxTime - this.lipStallT;
      const lipRamp = Math.min(
        Math.max(0, TUNING.balanceRampMax - 1),
        stallAge * TUNING.balanceRamp * 2,
      );
      const instability = TUNING.lipDrift * (1 + lipRamp);
      const runSign = Math.sign(this.balance || 1); // + drifts INTO the pipe (forgiving)
      // fight along the SCREEN axis the tip reads on (see lipAim)
      const lipSgn = this.lipAim(false);
      const fightStick = this.lipMeterH ? this.rawInput.moveX : this.rawInput.moveY;
      let control = fightStick * lipSgn * TUNING.lipControl;
      control *= this.safeGain(stallAge, control, runSign);
      this.stepBalanceCore(dt, runSign, instability, control, lipRamp);
      if (this.uberTimer > 0 || this.balanceBoostT > 0) {
        this.balance = 0;
        this.balanceVel = 0;
      }
      if (Math.abs(this.balance) >= 1) {
        this.balance = Math.sign(this.balance);
        if (Math.sign(this.balanceVel) === this.balance) this.balanceVel = 0;
        this.balanceCritT += dt;
        if (this.balanceCritT > TUNING.bailGrace) {
          if (this.balance > 0) this.lipDrop(false); // fell into the pipe: ride it out
          else {
            // fell out the back — onto the DECK it's the honest bail, but on
            // a spine/ridge stall the "back" is another vert: ride that out
            const back = this.pipeBehindLip(level);
            if (back) this.lipDrop(false, back);
            else this.lipBail();
          }
          return;
        }
      } else {
        this.balanceCritT = 0;
      }
      this.lipTickT += dt;
      while (this.lipTickT >= 0.25) {
        this.lipTickT -= 0.25;
        this.comboPoints += CONST.ptsLipTick;
        this.special.award(CONST.ptsLipTick);
        this.comboTimer = CONST.comboWindow;
      }
      this.emitSparks(Math.random() < 0.3 ? 1 : 0, 0xffe08a, 0.6);
      // R2 from the stall: a DELIBERATE exit out the back — onto the deck
      // (clean, no bail) or through a shared ridge into the other pipe.
      if (input.transferPressed) {
        const back = this.pipeBehindLip(level);
        if (back) this.lipDrop(false, back);
        else this.lipExit();
        return;
      }
      // The press got you ON the lip; BALANCE keeps you there (THPS2: no
      // hold-to-maintain). You leave by ollieing out (X), tipping the needle
      // (into the pipe = ride it out, out the back = bail), or timing out.
      if (input.jumpPressed || this.lipStallT <= 0) {
        this.lipDrop(input.jumpPressed);
      }
      return;
    }

    // Flattened after a slam OR knocked down by a bail. A slam stays parked;
    // a bail's latter phase routes held movement through its roll-up below.
    const slamFlat = this.slamFlatT > 0 || this.bailDownT > 0;

    // Letting go of Circle forgets the slide->crawl chain and lifts the Circle
    // brake's crouch lock (both re-arm only on a fresh press).
    if (!input.grabHeld) {
      this.slideCrawlChain = false;
      this.oBrakeHold = false;
    }
    // The Circle brake's ease-in only accumulates while it's actually braking
    // (skating + held); anything else re-arms it from a light tap.
    if (!input.grabHeld || !this.freeSkate) this.brakeT = 0;
    // Post-PULL-BACK-brake RUN lock -> ease-back scale. 0 while the lock timer
    // runs (walk dead, no reverse-run), then ramps 0->1 over brakeLockRamp. This
    // is the RUN lock only; the crawl lock is a separate lock-til-release below.
    const moveScale =
      this.brakeLockT > 0
        ? 0
        : this.brakeRampT > 0 && TUNING.brakeLockRamp > 0
          ? 1 - this.brakeRampT / TUNING.brakeLockRamp
          : 1;
    // Crash crouch-crawl: holding Circle while (nearly) stopped drops you into
    // a low, slow, all-fours crawl — direct velocity, no inertia, until release.
    // Holding Circle THROUGH a slide flows straight out of it into the crawl
    // (slideCrawlChain), so a slide + held Circle + direction keeps you low and
    // moving instead of triggering the get-up beat. But Circle held out of a
    // BRAKE (oBrakeHold) does NOT crouch until you release it — the classic
    // lock-til-release, separate from the timed run lock.
    const wasCrouching = this.crawling;
    if (
      !slamFlat &&
      input.grabHeld &&
      !this.oBrakeHold &&
      (this.crawling ||
        (this.slideCrawlChain && this.slideTimer <= 0) ||
        (Math.abs(this.speed) < TUNING.slideMinSpeed && this.slideTimer <= 0))
    ) {
      this.crawling = true;
    } else {
      this.crawling = false;
    }
    // Crouch-jump coyote time: releasing Circle a hair before pressing X used to
    // drop the height boost entirely (crawling was already false at jump). Keep a
    // short grace after a STATIC crouch ends so a just-late crouch jump still
    // launches high. Gated on low speed so a fast crawl — which jumps as a
    // running leap — doesn't inherit the boost.
    if (wasCrouching && !this.crawling && Math.abs(this.speed) < TUNING.walkSpeed * 0.5) {
      this.crouchGraceT = CONST.crouchJumpGrace;
    }

    // Walk vs skate: on foot by default (Crash direct drive); holding X puts
    // the board down and builds speed, and any carried momentum — downhill,
    // rail exits, slides, boosts — keeps you skating until it bleeds back to
    // walking pace.
    // X is release-to-jump; HOLDING it is the commit meter. Skate drive only
    // engages after skateHoldTime of X + a held direction AND skateEntrySpeed
    // of real movement — quick taps and stationary crouches stay pure Crash.
    // ANY held direction commits (digital), and the entry speed gate reads
    // actual movement in any direction — so pushing sideways skates exactly
    // like pushing forward, never stuck in second-class walk.
    const stickHeld = input.moveX !== 0 || input.moveY !== 0;
    if (this.charging && stickHeld) this.skateCharge += dt;
    else this.skateCharge = 0;
    const planarSpeed = Math.max(Math.abs(this.speed), this.lastPlanar);
    // Standstill launch: a charge planted from a dead stop keeps the feet pinned
    // the whole time (no slide), then pops STRAIGHT onto the board the instant
    // it's held long enough with a direction — no entry-speed gate, because the
    // feet never moved to build one. The seed below gives it its first roll.
    const plantedPush =
      this.charging &&
      this.chargePlanted &&
      stickHeld &&
      this.skateCharge >= TUNING.skateHoldTime;
    const pushingOff =
      plantedPush ||
      (this.charging &&
        stickHeld &&
        this.skateCharge >= TUNING.skateHoldTime &&
        planarSpeed >= TUNING.skateEntrySpeed);
    this.skateOn = pushingOff;
    // Ground too steep to RIDE (halfpipe transitions, steep banks): with real
    // momentum the board pops out here. Steepness reads the SMOOTHED ride plane,
    // not the raw facet: seams between transition boxes can return a side-face
    // normal for one frame, and a single spike must not snap the board out.
    const steepGround = this.groundHit !== null && this.rideNormal.y < TUNING.steepStand;
    // HALFPIPE surface (analytic transition wall or its flat bottom). Riding one
    // swaps the general ramp physics for a clean, energy-CONSERVING pendulum:
    // symmetric wall gravity, near-frictionless, and a stall-flip that turns you
    // down the fall line at the top of the wall no matter your heading — so you
    // whip wall-to-wall and pump up over the coping instead of freezing on the
    // face (which is exactly what the old asymmetric ramp physics did).
    const onPipe = this.groundHit !== null && this.groundHit.name.startsWith('halfpipe');
    if (onPipe) this.pipeRideT = 0.2; // any vert launch off this becomes a pipeHang (no phantom spin)
    // ON FOOT the ONE authority is footGrip: a walker (no board momentum, no
    // charge) can stand/walk on anything with rideNormal.y >= footGrip and
    // SLIPS down anything steeper — no matter the stick direction. This is what
    // makes footGrip the single legible knob for "can I walk up this pipe".
    // A hair of hysteresis stops the boundary flickering into a slither.
    const walkerCtx =
      !this.freeSkate &&
      !this.charging &&
      !pushingOff &&
      this.slideTimer <= 0 &&
      planarSpeed <= TUNING.walkSpeed + 0.5;
    const gripEdge = TUNING.footGrip - (this.slipping ? 0.03 : 0);
    const footSlip = walkerCtx && steepGround && this.rideNormal.y < gripEdge;
    const footPlant = walkerCtx && steepGround && !footSlip;
    this.slipping = footSlip;
    // ROLLOUT: skating is a STATE, not a speed threshold. Once the board is
    // out it stays under you — through the whole friction roll-out down to a
    // dead stop — so re-holding a direction ramps you back to cruise instead
    // of dumping you to feet, and the wheels/pose persist to zero. Only a
    // true stop or the deliberate pull-back dismount steps off.
    const rollingOut = this.freeSkate && Math.abs(this.speed) > 0.08 && !this.stepOff;
    this.stepOff = false;
    const looseDeck = !!(this.flyBoard && this.flyBoard.visible);
    // A thrown deck is never recovered by proximity or carried speed. Only
    // the normal hold-X + direction commitment recalls it; until that point
    // steep ground and bailout momentum remain genuinely on foot.
    const boardAvailable = !looseDeck || pushingOff;
    // On steep ground the board only pops out when it's a RIDER (charge/
    // momentum/rollout) — a walker (footPlant OR footSlip) stays on foot and
    // obeys footGrip. Standing still on a bank no longer flashes the board.
    const skating =
      pushingOff ||
      this.slideTimer > 0 ||
      (boardAvailable &&
        ((steepGround && !footPlant && !footSlip) ||
          planarSpeed > TUNING.walkSpeed + 0.5 ||
          rollingOut));

    // Enter/leave free-heading mode. Walking and canned slides keep the
    // classic course-axis model; the board carves free — everywhere,
    // transitions included.
    const free =
      skating &&
      boardAvailable &&
      this.slideTimer <= 0 &&
      !slamFlat &&
      !this.crawling &&
      this.skateBlockT <= 0;
    if (free && !this.freeSkate) {
      if (pushingOff && this.flyBoard?.visible) {
        this.flyBoard.visible = false;
        this.flyBoardT = 0;
        this.flyBoardRest = false;
        // Deliberate recall is authoritative even if mash shortened the bail
        // below the original hide timer. Without clearing it, the loose clone
        // disappears but the mounted deck can remain invisible too.
        this.boardSnapT = 0;
      }
      // Seed the skate velocity from the direction you're actually going, so
      // a sideways walk hands its momentum straight into the skate (the
      // forward-only `speed` scalar was 0 for pure sideways).
      const rx = this.rawInput.moveX;
      const ry = this.rawInput.moveY;
      if (rx !== 0 || ry !== 0) {
        const inv = 1 / Math.hypot(rx, ry);
        // Resolve the stick through the SAME frame the carve block uses:
        // screen-up is -Z only on straight courses, the LANE tangent on
        // camera-spine levels, the live camera aim in chase mode. This seed
        // used to read the raw stick as world -Z — the exact bug the carve
        // block's own comment says was fixed — so on a lane-driven level the
        // very first frame of skating snapped the heading (and the momentum
        // it had just inherited) off-course, and on a stretch pointing near
        // +Z the error exceeded carveBrakeAngle, so mounting the board fired
        // the pull-back brake instead of a carve.
        const cfc =
          level.laneDirAt(this.pos.x, this.pos.y, this.pos.z, this.laneCursor) ??
          (TUNING.chaseCam > 0.5 && !level.boulder
            ? { x: this.camDir.x, z: this.camDir.z }
            : { x: 0, z: -1 });
        this.axisF.set(
          (cfc.x * ry - cfc.z * rx) * inv,
          0,
          (cfc.z * ry + cfc.x * rx) * inv,
        );
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
        this.speed = Math.max(Math.abs(this.speed), this.lastPlanar);
        // Popped straight onto the board from a standstill: hand it a first roll
        // so it skates off immediately instead of revving up from a dead stop.
        if (plantedPush) this.speed = Math.max(this.speed, TUNING.skateEntrySpeed);
      } else if (this.speed < 0) {
        // coasting in on backward momentum: flip to a positive heading
        this.axisF.negate();
        this.axisL.negate();
        this.speed = -this.speed;
      }
      this.walkVelocity.set(0, 0, 0);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
    } else if (!free && this.freeSkate) {
      this.stance = 1; // feet down: the next push starts regular
      // back onto the course grid: keep the along-course velocity component
      const vx = this.axisF.x * this.speed;
      const vz = this.axisF.z * this.speed;
      const zn = level.zoneAt(this.pos.x, this.pos.z);
      this.setTravelDir(zn ? zn.dir : 'S');
      this.speed = vx * this.axisF.x + vz * this.axisF.z;
      this.walkVelocity.copy(this.axisF).multiplyScalar(this.speed);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
    }
    this.freeSkate = free;

    // Regular-walk intent envelope: fresh input reaches full pace over
    // walkRampTime; releasing it lets that intent and the physical velocity
    // coast to rest over walkSlowdownTime. runScale also folds in the
    // post-brake lock/recovery (whichever is more restrictive wins).
    const walkDir = input.moveX !== 0 || input.moveY !== 0;
    const slickWalk = this.groundHit !== null && !!this.groundHit.slippy;
    if (this.freeSkate || this.crawling || slamFlat || this.slideTimer > 0) this.walkRamp = 0;
    else if (walkDir && TUNING.walkRampTime > 0)
      this.walkRamp = Math.min(1, this.walkRamp + dt / TUNING.walkRampTime);
    else if (walkDir) this.walkRamp = 1;
    else if (!slickWalk && TUNING.walkSlowdownTime > 0)
      this.walkRamp = Math.max(0, this.walkRamp - dt / TUNING.walkSlowdownTime);
    else this.walkRamp = 0;
    const runScale = Math.min(moveScale, this.walkRamp);
    let slideStepDistance = -1;

    if (slamFlat) {
      this.walkVelocity.set(0, 0, 0);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
      // Before the supported recovery starts, a bail ON A TRANSITION TUMBLES
      // down the face instead of sticking to a near-vertical wall:
      // the body swings down the fall line and slides into the flat (the
      // lying-flat pose riding downhill with dust IS the tumble).
      const steepBail = this.bailDownT > 0 && this.grounded && this.onTransition;
      if (this.bailDownT > 0 && this.bailRecoverT >= 0) {
        this.stepBailRecoveryMotion(dt, input, level);
      } else if (steepBail) {
        const n = this.groundHit!.normal;
        const l = Math.hypot(n.x, n.z) || 1;
        this.axisF.set(n.x / l, 0, n.z / l); // the fall line (normal leans toward the flat)
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
        this.speed = Math.min(this.speed + TUNING.groundGravity * 0.6 * dt, 12);
        this.emitDust(1);
      } else if (this.slamFlatT > 0) {
        this.speed = 0; // the pancake slam is AUTHORED as a dead stop
      } else {
        // A bail keeps its momentum and SCRUBS it: crashing at 23 should carry
        // you further than crashing at walking pace. Zeroing made every wipeout
        // the same event regardless of how fast you were going.
        this.speed -=
          Math.sign(this.speed) * Math.min(TUNING.bailFriction * dt, Math.abs(this.speed));
        // ...but we're a platformer with LETHAL pits and THPS is not. A downed
        // body with no control must never slide off a brink and cost a life, so
        // the tumble stops dead at the lip of a death drop.
        if (Math.abs(this.speed) > 0.1) {
          const ahead = this.queryGround(level, this.axisF.x * 0.9, this.axisF.z * 0.9);
          if (ahead === null || ahead.y <= level.killY) this.speed = 0;
          else this.emitDust(1);
        }
      }
      this.lastTy = 0;
    } else if (this.crawling) {
      // Direct-drive crawl. Speed snaps to the stick; no slopes, no friction, no
      // ramp — the crawl is instant (its own lock-til-release owns the delay).
      this.walkVelocity.set(0, 0, 0);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
      this.speed = input.moveY * TUNING.crawlSpeed;
      this.lastTy = 0;
    } else if (!skating) {
      // WALK: physical velocity is a world-space vector, so releasing the stick
      // can coast a sideways/diagonal run honestly and a committed turnaround
      // can slide through the old vector rather than snapping through zero.
      // A planted charge remains pinned exactly as before.
      const planted = this.charging && this.chargePlanted;
      const targetForward = planted ? 0 : input.moveY * TUNING.walkSpeed * runScale;
      const targetLateral = planted ? 0 : input.moveX * TUNING.walkSpeed * runScale;
      this.walkTarget
        .copy(this.axisF)
        .multiplyScalar(targetForward)
        .addScaledVector(this.axisL, targetLateral);

      if (planted) {
        this.walkVelocity.set(0, 0, 0);
        this.walkTurnaround = false;
        this.walkIntent.set(0, 0, 0);
      } else if (slickWalk) {
        // Preserve the established ice rule: eased along-course velocity and
        // direct lateral drive. Ordinary dry ground owns the new release coast.
        const previousForward = this.walkVelocity.dot(this.axisF);
        const response = Math.min(1, CONST.slipAccel * dt);
        const forward = previousForward + (targetForward - previousForward) * response;
        this.walkVelocity
          .copy(this.axisF)
          .multiplyScalar(forward)
          .addScaledVector(this.axisL, targetLateral);
        this.walkTurnaround = false;
        this.walkIntent.set(0, 0, 0);
      } else if (!walkDir) {
        this.walkTurnaround = false;
        this.walkIntent.set(0, 0, 0);
        const speed = this.walkVelocity.length();
        const maxChange =
          TUNING.walkSlowdownTime > 0
            ? (TUNING.walkSpeed * dt) / TUNING.walkSlowdownTime
            : speed;
        if (speed <= maxChange || speed <= 1e-6) this.walkVelocity.set(0, 0, 0);
        else this.walkVelocity.multiplyScalar((speed - maxChange) / speed);
        if (TUNING.walkSpeed > 0)
          this.walkRamp = Math.min(this.walkRamp, this.walkVelocity.length() / TUNING.walkSpeed);
      } else {
        const previousSpeed = this.walkVelocity.length();
        const targetSpeed = this.walkTarget.length();
        const startsTurnaround =
          TUNING.walkSlowdownTime > 0 &&
          previousSpeed >= TUNING.walkSpeed * 0.5 &&
          targetSpeed >= TUNING.walkSpeed * 0.5 &&
          this.walkVelocity.dot(this.walkTarget) / Math.max(previousSpeed * targetSpeed, 1e-6) < 0.95;
        if ((this.walkTurnaround || startsTurnaround) && targetSpeed > 1e-6) {
          this.walkTurnaround = true;
          this.walkIntent.copy(this.walkTarget).multiplyScalar(1 / targetSpeed);
          const dx = this.walkTarget.x - this.walkVelocity.x;
          const dz = this.walkTarget.z - this.walkVelocity.z;
          const delta = Math.hypot(dx, dz);
          const maxChange =
            TUNING.walkSlowdownTime > 0
              ? (2 * TUNING.walkSpeed * dt) / TUNING.walkSlowdownTime
              : delta;
          if (delta <= maxChange || delta <= 1e-6) {
            this.walkVelocity.copy(this.walkTarget);
            this.walkTurnaround = false;
            this.walkIntent.set(0, 0, 0);
          } else {
            this.walkVelocity.x += (dx / delta) * maxChange;
            this.walkVelocity.z += (dz / delta) * maxChange;
          }
        } else {
          this.walkVelocity.copy(this.walkTarget);
          this.walkTurnaround = false;
          this.walkIntent.set(0, 0, 0);
        }
      }
      this.speed = this.walkVelocity.dot(this.axisF);
      this.lastTy = 0;
    } else {
      // SKATE: authored momentum. X (charge) is the only accelerator; input
      // against travel brakes hard (turnaround); input with travel coasts
      // easy; no input bleeds friction back toward walking pace. A slide is
      // canned: it ignores the stick entirely and keeps its momentum.
      let braking = false; // set by either brake, so the downhill boost yields to it
      if (this.slideTimer > 0) {
        this.slideContactLatch = true;
        // Exact-distance slide. From the invariant v^2 = 2ad, solve the
        // deceleration from the CURRENT speed and remaining distance each
        // fixed step. This reaches a genuine zero on the exact five-metre mark
        // even when the final sample is only a partial tick.
        const remaining = Math.max(0, this.slideDistanceLeft);
        const current = Math.max(0, this.slideSpd);
        if (remaining <= 1e-6 || current <= 1e-6) {
          slideStepDistance = 0;
          this.slideDistanceLeft = 0;
          this.slideSpd = 0;
          this.slideTimer = 0;
          this.slideGraceHold = true;
          this.speed = 0;
        } else {
          const deceleration = (current * current) / (2 * remaining);
          const stopSeconds = current / deceleration;
          const distance =
            dt >= stopSeconds
              ? remaining
              : THREE.MathUtils.clamp(
                  current * dt - 0.5 * deceleration * dt * dt,
                  0,
                  remaining,
                );
          const nextSpeed = dt >= stopSeconds ? 0 : Math.max(0, current - deceleration * dt);
          const nextDistance = Math.max(0, remaining - distance);
          slideStepDistance = distance;
          this.slideSpd = nextDistance <= 1e-6 ? 0 : nextSpeed;
          this.slideDistanceLeft = nextDistance <= 1e-6 ? 0 : nextDistance;
          if (this.slideDistanceLeft === 0) this.slideGraceHold = true;
          this.slideTimer =
            this.slideDistanceLeft > 0 && this.slideSpd > 0
              ? (2 * this.slideDistanceLeft) / this.slideSpd
              : 0;
          this.speed =
            this.slideSpd * (this.slideVec.x * this.axisF.x + this.slideVec.z * this.axisF.z);
        }
      } else if (this.freeSkate && input.grabHeld) {
        // O = BRAKE: held on the board it bleeds speed (ignoring the stick) and
        // rolls you to a FULL stop, then steps off at ~0. Two shaping curves:
        //  - EASE-IN over the hold (quadratic ramp to full force over
        //    brakeRampTime) so a quick tap barely bites and can't insta-stop.
        //  - EASE-OUT near rest (rate scales with speed) so it settles to zero
        //    smoothly, the same roll-to-a-stop feel as the no-input decay,
        //    instead of snapping off the board at walking pace.
        // Circle while skating is a brake; sliding is on-foot only.
        this.brakeT += dt;
        const s = Math.abs(this.speed);
        const ramp = Math.min(1, this.brakeT / TUNING.brakeRampTime);
        const ease = 0.25 + 0.75 * Math.min(1, s / Math.max(TUNING.cruiseSpeed, 1));
        const rate = TUNING.turnaround * ramp * ramp * ease;
        this.speed = Math.sign(this.speed) * Math.max(0, s - rate * dt);
        braking = true;
        // screech only once the brake is really biting, not on a light tap
        if (this.brakeT > 0.25 && s > 12 && this.haltCd <= 0) {
          sfx.play('skateHalt', 0.6);
          this.haltCd = 0.6;
        }
        // Circle brake arms the CROUCH lock (lock-til-release): no crawl until
        // you let Circle go. If a DIRECTION is also held (a turnaround while
        // Circle-braking), arm the timed RUN lock too — a combined brake still
        // gets the running delay, not just a bare pull-back.
        this.oBrakeHold = true;
        const dirHeld = Math.abs(this.rawInput.moveX) > 0.3 || Math.abs(this.rawInput.moveY) > 0.3;
        if (dirHeld && Math.abs(this.speed) <= TUNING.walkSpeed + 0.5)
          this.brakeLockT = TUNING.brakeLockTime;
      } else if (this.freeSkate) {
        // OMNIDIRECTIONAL SKATE: whichever way you push, the heading turns to
        // follow it — carrying your speed with it (a carve, not a brake), so
        // forward, sideways, and back are all first-class. X accelerates along
        // the heading; release everything and you coast down to your feet.
        if (this.grounded && this.groundHit && this.groundHit.slippy)
          this.greaseT = 0.35;
        else this.greaseT = Math.max(0, this.greaseT - dt);
        const slick = this.greaseT > 0 ? 0.22 : 1; // greasy wheels: see greaseT
        const rx = this.rawInput.moveX;
        const ry = this.manualing !== 0 ? 0 : this.rawInput.moveY;
        // (during a MANUAL, up/down is the balance pole ONLY — no accel, no
        // pull-back brake — while left/right keeps steering the line; a pure
        // side stick sits at 90° off the heading, well under the brake angle)
        if (rx !== 0 || ry !== 0) {
          const inv = 1 / Math.hypot(rx, ry);
          // screen-up = the camera's forward: -Z normally, the LANE tangent on
          // camera-spine levels, the live camera aim in chase mode — the same
          // frame the stick decomposition uses. Reading the raw stick as
          // world -Z here is what made "forward" stop meaning forward the
          // moment the spine turned the course.
          const cfc =
            level.laneDirAt(this.pos.x, this.pos.y, this.pos.z, this.laneCursor) ??
            (TUNING.chaseCam > 0.5 && !level.boulder
              ? { x: this.camDir.x, z: this.camDir.z }
              : { x: 0, z: -1 });
          const dx = (cfc.x * ry - cfc.z * rx) * inv;
          const dz = (cfc.z * ry + cfc.x * rx) * inv;
          // signed angle from heading toward the stick, then turn (capped by
          // carveGrip) while KEEPING the speed — momentum survives the carve.
          const fwd = dx * this.axisF.x + dz * this.axisF.z;
          const side = dx * this.axisF.z - dz * this.axisF.x;
          const ang = Math.atan2(side, fwd);
          if (
            Math.abs(ang) > CONST.carveBrakeAngle &&
            (this.pipeLandGraceT > 0 || (steepGround && Math.abs(this.speed) < 4))
          ) {
            // Fresh off a pipe drop-in: the stick is still held the way you were
            // CLIMBING, which is now behind you. That's stale intent, not a
            // brake — ignore it and let the transition carry the swing.
            // Same for a near-stalled body on ground too steep to STAND on: you
            // cannot skid to a halt on a wall. Letting the brake bite there
            // clamps speed to 0 and (via `braking && ty < 0`) cancels slope
            // gravity too, so a held stick welded you to a 62-degree kicker face
            // and nothing could move you off it.
          } else if (Math.abs(ang) > CONST.carveBrakeAngle) {
            // Pulling (nearly) opposite your travel = the brake: speed bleeds to
            // a FULL stop and then steps off at ~0. It EASES OUT near rest (rate
            // scales with speed) so it rolls smoothly to zero like the no-input
            // decay, instead of snapping off at walking pace. Diagonals still
            // carve — only a true pull-back skids.
            if (this.speed > 12 && this.haltCd <= 0) {
              sfx.play('skateHalt', 0.6);
              this.haltCd = 0.6;
            }
            const s = Math.abs(this.speed);
            const ease = 0.25 + 0.75 * Math.min(1, s / Math.max(TUNING.cruiseSpeed, 1));
            this.speed = Math.max(0, this.speed - TUNING.turnaround * ease * slick * dt);
            braking = true;
            // The stick is still yanked BACKWARD, so once you're under walking
            // pace refresh the post-brake lock: walk/sidestep stay dead (no
            // instant reverse sprint), and the lock counts down + eases back only
            // after you let the stick go. Meanwhile the brake bleeds to a full
            // stop on the board and the rollout steps you off at ~0 (no snap).
            if (this.speed <= TUNING.walkSpeed + 0.5) this.brakeLockT = TUNING.brakeLockTime;
          } else {
            // Grip grows with speed: at cruise you get carveGrip exactly;
            // faster carves sharper, slower carves lazier. carveGripRatio is
            // the coupling strength (0 = constant, 1 = turn radius stays the
            // same size at any speed), clamped to x0.5..x2 of the base rate.
            const speedFrac = Math.abs(this.speed) / Math.max(TUNING.cruiseSpeed, 1);
            const grip =
              TUNING.carveGrip *
              THREE.MathUtils.clamp(1 + (speedFrac - 1) * TUNING.carveGripRatio, 0.5, 2);
            const maxTurn = THREE.MathUtils.degToRad(grip) * slick * dt;
            const turn = THREE.MathUtils.clamp(ang, -maxTurn, maxTurn);
            const c = Math.cos(turn);
            const s = Math.sin(turn);
            const nfx = this.axisF.x * c + this.axisF.z * s;
            const nfz = -this.axisF.x * s + this.axisF.z * c;
            this.axisF.set(nfx, 0, nfz);
            this.axisL.set(this.axisF.z, 0, -this.axisF.x);
            // The charge only ADDS speed up to maxSpeed — it must never chop
            // hard-earned downhill overspeed back down (that read as greasy).
            if (this.charging && this.speed < TUNING.maxSpeed)
              this.speed = Math.min(this.speed + TUNING.chargeBoost * dt, TUNING.maxSpeed);
            else if (!this.charging && !onPipe) this.cruiseEase(dt, steepGround);
          }
        } else if (this.charging && this.speed > 1) {
          if (this.speed < TUNING.maxSpeed)
            this.speed = Math.min(this.speed + TUNING.chargeBoost * dt, TUNING.maxSpeed);
        } else {
          // TRULY idle (no stick, no X): friction bleeds you all the way to a
          // stop, below cruise. Coasting WITH a direction held (above) settles
          // to cruise and holds; letting go completely rolls you out. The pipe
          // keeps its own tiny bleed (the slope response) instead.
          if (!onPipe) this.frictionBleed(dt, steepGround);
        }
      } else if (this.charging) {
        // build toward maxSpeed in the stick's direction; with no direction
        // held, only maintain momentum you already have (no phantom takeoff)
        const dir =
          Math.abs(input.moveY) > 0.35
            ? Math.sign(input.moveY)
            : Math.abs(this.speed) > 1
              ? Math.sign(this.speed)
              : 0;
        if (dir !== 0) {
          const rate = dir * this.speed < -0.01 ? TUNING.turnaround : TUNING.chargeBoost;
          this.speed = THREE.MathUtils.clamp(
            this.speed + rate * dir * dt,
            -TUNING.maxSpeed,
            TUNING.maxSpeed,
          );
        }
      } else if (Math.abs(input.moveY) > 0.05 && input.moveY * this.speed < 0) {
        // stick against travel: snappy brake (crossing walking pace drops
        // you onto your feet, where the walk logic takes the stick)
        this.speed += TUNING.turnaround * Math.sign(input.moveY) * dt;
      } else if (onPipe) {
        // halfpipe carries its own tiny friction (below the slope response) — the
        // heavy general roll-out would bleed a swing dead in a second.
      } else if (Math.abs(input.moveY) > 0.05) {
        // stick with travel: easy coast, light bleed
        const drop = TUNING.friction * 0.35 * dt;
        this.speed -= Math.sign(this.speed) * Math.min(drop, Math.abs(this.speed));
      } else {
        const drop = TUNING.friction * dt;
        this.speed -= Math.sign(this.speed) * Math.min(drop, Math.abs(this.speed));
      }

      // Slope response from the SMOOTHED ride plane: project the heading onto
      // the surface — the tangent's rise is the SINE of the slope along
      // travel. Bounded ±1, so a vert wall pulls hard but never explodes;
      // sign-safe, so stalling on a ramp rolls you back down it.
      let ty = 0;
      if (this.groundHit) {
        const n = this.rideNormal;
        const fdotn = this.axisF.x * n.x + this.axisF.z * n.z; // axisF.y is 0
        const tx = this.axisF.x - n.x * fdotn;
        const tyRaw = -n.y * fdotn;
        const tz = this.axisF.z - n.z * fdotn;
        const tl = Math.hypot(tx, tyRaw, tz);
        if (tl > 1e-4) ty = tyRaw / tl; // > 0 climbing, < 0 descending
      }
      // ONE SYMMETRIC GRAVITY, every surface. Downhill used to accelerate you
      // 1.4x harder than uphill decelerated (3.3x with X held), so every dip-and-
      // rise handed back MORE than it took and a bowl was a free-speed dispenser
      // that pinned you at the cap in two swings — which also made the pump
      // sliders unreadable, because geometry alone saturated them. The analytic
      // halfpipe was already fixed this way (a clean energy-conserving pendulum);
      // this just generalises it past the `name.startsWith('halfpipe')` check.
      // The braking guard stays: it's what lets the brake beat gravity on a hill.
      if (Math.abs(ty) > 0.02 && !(braking && ty < 0)) {
        this.speed += -TUNING.groundGravity * ty * dt;
      }
      // HALFPIPE CARVE: just HOLDING a direction on the transition works the wall
      // for momentum — no X needed. This is the "carving pumps you" feel: hold
      // toward the wall and you drive up it and build speed. Scaled by steepness,
      // so the flat bottom gives no free speed and the wall carves hardest.
      // Mesh transitions (bowls, banked walls) count as pipe walls here —
      // the carve pump is THE speed loop of THPS and it must work everywhere
      // there is a transition to work.
      // Steepness weight for carve/pump. A FLAGGED face gets a floor: the level
      // said "ride this as vert", so a mellow authored bank must still pump
      // meaningfully instead of paying ~0 because (1 - normal.y) is tiny.
      // (a face flagged as a ROAD pays nothing, however hard it banks)
      const transWeight =
        this.groundHit && this.groundHit.vert !== false
          ? Math.max(
              1 - this.groundHit.normal.y,
              this.groundHit.vert ? 1 - TUNING.steepStand : 0,
            )
          : 0;
      if ((onPipe || this.onTransition) && (input.moveX !== 0 || input.moveY !== 0)) {
        this.speed += TUNING.pipeCarve * transWeight * dt;
      }
      // PUMP: hold X to work the transition for EXTRA speed — the hard pump on
      // top of the carve, the honest way to build vert height. ONE gain now
      // (pipePumpGain) on every transition face: it has to out-build gravity
      // and friction over successive swings to clear the coping. There used to
      // be a second, gentler pipePump for general steep banks; the single gain
      // replaced it and the slider was retired. Scales with steepness, so the
      // pump is hardest below the coping.
      if (this.charging && this.onTransition) {
        // full pump on ANY transition face — analytic pipe, mesh bowl wall, or
        // anything the level flagged as vert
        this.speed += TUNING.pipePumpGain * transWeight * dt;
      }
      // Sustained powered push on an ORDINARY uphill road must not chatter
      // across the rollout threshold: X + steering is active drive even when
      // symmetric slope gravity is stronger. Reuse the authored board-entry
      // speed as the slow floor. Transitions/pipes deliberately retain honest
      // stalls and rollback because pumping them is its own skill law.
      const poweredOrdinaryUphill =
        this.freeSkate &&
        this.charging &&
        !braking &&
        (this.rawInput.moveX !== 0 || this.rawInput.moveY !== 0) &&
        ty > 0.02 &&
        !this.onTransition &&
        !onPipe;
      if (poweredOrdinaryUphill)
        this.speed = Math.max(this.speed, TUNING.skateEntrySpeed);
      // HALFPIPE near-frictionless: the general idle friction (7) bleeds a swing
      // dead in a couple of seconds; on the pipe a tiny bleed lets momentum
      // carry wall-to-wall. Applied here so it hits every frame, not just idle.
      if (onPipe && Math.abs(this.speed) > 0) {
        const fr = Math.min(TUNING.pipeFriction * dt, Math.abs(this.speed));
        this.speed -= Math.sign(this.speed) * fr;
      }
      this.lastTy = ty;
      // peak-hold the climb for the takeoff (see liftTy)
      if (ty > this.liftTy) {
        this.liftTy = ty;
        this.liftTyT = CONST.liftMemory;
      }

      // OVERSPEED: anything above maxSpeed bleeds off through a QUADRATIC drag,
      // always, on every surface. The old flat bleed only fired on level ground
      // (|ty| <= 0.02), so earned speed was immortal on a slope and then got
      // confiscated the instant the ground flattened — an unpredictable step the
      // player can't read. Quadratic also gives the top end texture: it bites
      // ~2.7x harder at 38 than at 23, so there's a wall to press against rather
      // than a linear countdown. Transitions get their own, higher ceiling —
      // vert is where the big speed is supposed to live.
      const onTrans = this.onTransition;
      let hardCap = onTrans ? TUNING.vertMax : TUNING.downhillMax;
      // A perfect grind pays out ABOVE the normal ceiling, so for a moment the
      // clamp has to let it through — otherwise the launch would be confiscated
      // on the very next frame and the reward would be invisible. heavyDrag is
      // still pulling it down the whole time; this only stops the hard clamp.
      if (this.grindBoostT > 0)
        hardCap = Math.max(
          hardCap,
          TUNING.perfectGrindSpeed,
          this.speedPadCap,
        );
      const over = Math.abs(this.speed);
      if (over > TUNING.maxSpeed) {
        this.speed -= Math.sign(this.speed) * Math.min(TUNING.heavyDrag * over * over * dt, over);
      }
      // The ceiling is a fast BLEED, not a one-frame chop: arriving on a
      // transition carrying downhill speed eases to the cap over a few frames
      // so the touchdown never hitches (measured: the old clamp confiscated
      // ~10 u/s in a single step at the bank's foot).
      const capOver = Math.abs(this.speed) - hardCap;
      if (capOver > 0) {
        this.speed -= Math.sign(this.speed) * Math.min(capOver, (10 + capOver * 3) * dt);
      }
      // A free heading never reverses through zero — stalling on a hill just
      // stops you. On ground too steep to stand, you can't hover: whenever the
      // board is SLOW and pointed roughly along the coping (|ty| small — not
      // already committed up or down the wall), swing it down the fall line and
      // roll back into the transition. The |ty| gate lets a fast descent/climb
      // pass untouched, and beating the pump lift (which fires just above)
      // is why this can't be a `speed <= 0` check — it would never trigger.
      if (this.freeSkate) {
        if (onPipe && steepGround && this.rideNormal.y > 0.25 && this.speed < 2 && this.pipeFlipCd <= 0) {
          // HALFPIPE APEX FLIP: stalled part-way up a wall (but below the coping,
          // rideNormal.y > 0.25) — turn the heading DOWN the fall line (in X,
          // toward centre) so you drop back in, but KEEP the channel (Z) heading
          // so you keep flowing down the pipe. Fires at ANY heading (the general
          // flip below only fires along the coping). Right AT the coping
          // (rideNormal.y <= 0.25) the flip yields to the coping launch instead,
          // so you pop over into hang time rather than flipping just short of it.
          const nx = this.rideNormal.x; // < 0 on the +X wall, > 0 on the −X wall (points to centre)
          if (Math.abs(nx) > 1e-3) {
            this.axisF.set(Math.sign(nx), 0, this.axisF.z);
            const l = this.axisF.length() || 1;
            this.axisF.divideScalar(l);
            this.axisL.set(this.axisF.z, 0, -this.axisF.x);
            this.speed = Math.max(this.speed, 1.5);
            this.pipeFlipCd = 0.3; // don't re-flip until gravity has pulled you away
            this.pipeLandGraceT = 0.35; // the flip turned you around: a still-held stick is stale intent, not a brake
          }
        } else if (steepGround && this.speed < 2 && this.lastTy > -0.15) {
          // GENERAL STALL FLIP, for every transition the analytic pipes don't
          // cover — bowls, corners, banked mesh walls.
          //
          // This used to read |lastTy| < 0.15: it only rescued you when you
          // were pointing ACROSS the fall line, and did nothing when you were
          // pointing UP it. But pointing up the fall line is the MOST stalled
          // you can be, and the free-skate clamp below floors speed at 0 — so
          // gravity would push it negative, the clamp would erase it, and you
          // were welded to the wall at exactly zero forever. Worse than stuck:
          // the carve steers by turning the HEADING, which needs speed, so the
          // frozen heading became the control frame and "up" stopped meaning
          // up the screen. The gate is now "not already heading down the fall
          // line" — descending (ty < 0) needs no rescue, everything else does.
          const n = this.groundHit!.normal;
          const len = Math.hypot(n.x, n.z);
          if (len > 1e-4) {
            this.axisF.set(n.x / len, 0, n.z / len); // the normal leans toward the flat
            this.axisL.set(this.axisF.z, 0, -this.axisF.x);
            this.speed = Math.max(this.speed, 1.5);
            // The flip just spun the heading 180 degrees under a stick that is
            // still held the way you were CLIMBING. Without this the pull-back
            // brake fires on the very next frame, clamps speed to 0 AND cancels
            // slope gravity (the `braking && ty < 0` guard) — so you weld to the
            // face at exactly zero and nothing can move you. Same stale-intent
            // grace the pipe drop-in already uses.
            this.pipeLandGraceT = 0.35;
          }
        }
        this.speed = Math.max(0, this.speed);
      }
    }

    // MANUAL: balanced on two wheels while everything else about riding keeps
    // working (carve, slopes, the combo window). The needle lives on the PITCH
    // axis — up/down on the stick fights it (reusing the grind balance field, so
    // the balance arms/flail visuals just work). Pegging past the grace = the
    // honest bail; rolling too slow / steep ground / leaving the deck simply
    // drops you back onto four wheels, combo timer still running.
    if (this.manualing !== 0) {
      if (this.manualCoyoteT > 0 || !this.grounded) {
        // light over a crest: the coyote window upstairs owns the drop —
        // freeze the needle so airborne frames never punish the balance
      } else if (!this.canHoldManual()) {
        this.endManual();
      } else {
        this.manualTime += dt;
        const ramp = Math.min(
          Math.max(0, TUNING.balanceRampMax - 1),
          Math.max(0, this.manualTime - TUNING.balanceGrace * 0.5) * TUNING.balanceRamp * 1.5,
        );
        const instability = TUNING.manualDrift * (1 + ramp);
        const runSign = Math.sign(this.balance || this.manualing);
        let control = -this.rawInput.moveY * TUNING.manualControl; // up/down fights the pitch needle
        control *= this.safeGain(this.manualTime, control, runSign);
        this.stepBalanceCore(dt, runSign, instability, control, ramp);
        if (this.uberTimer > 0 || this.balanceBoostT > 0) {
          this.balance = 0;
          this.balanceVel = 0;
        }
        if (Math.abs(this.balance) >= 1) {
          this.balance = Math.sign(this.balance);
          if (Math.sign(this.balanceVel) === this.balance) this.balanceVel = 0;
          this.balanceCritT += dt;
          if (this.balanceCritT > TUNING.bailGrace) {
            this.endManual();
            const spd = Math.abs(this.speed);
            const dir = Math.sign(this.speed || 1);
            this.bail();
            this.startRagdoll('forward'); // a lost manual digs the nose in
            // THE BOARD SQUIRTS OUT from under you — low, fast, ahead of the
            // body, spinning flat like a plate. bail() already threw it with
            // the generic arc, which flew WITH the body and read as nothing;
            // a manual bail is specifically the deck leaving without you.
            if (this.flyBoard && this.flyBoard.visible) {
              this.flyBoardVel.set(
                this.axisF.x * dir * (9 + spd * 0.6),
                2.1,
                this.axisF.z * dir * (9 + spd * 0.6),
              );
              this.flyBoardAng.set((Math.random() - 0.5) * 6, dir * 24, (Math.random() - 0.5) * 6);
            }
            return;
          }
        } else {
          this.balanceCritT = 0;
        }
        this.manualTickT += dt;
        while (this.manualTickT >= 0.25) {
          this.manualTickT -= 0.25;
          this.comboPoints += CONST.ptsManualTick;
          this.special.award(CONST.ptsManualTick);
          this.comboTimer = CONST.comboWindow;
        }
      }
    }

    // The exact slide envelope owns its speed as well as its displacement.
    // Generic slope/overspeed bookkeeping above may inspect the frame, but it
    // cannot re-accelerate an authored foot slide or leave a stale mount speed.
    if (slideStepDistance >= 0) {
      this.speed =
        this.slideSpd * (this.slideVec.x * this.axisF.x + this.slideVec.z * this.axisF.z);
    }

    // Ride the SURFACE, not the map. On a slope the heading projects onto the
    // ride plane, splitting speed honestly between planar travel and climb —
    // a vert wall climbs at speed*sin(slope) instead of the old full-speed
    // horizontal advance with a hidden vertical teleport from the snap. Walks
    // and flat ground keep the crisp planar step (identical math at n.y≈1).
    if (slideStepDistance >= 0) {
      this.pos.addScaledVector(this.slideVec, slideStepDistance);
    } else if (this.freeSkate && this.grounded && this.groundHit && this.rideNormal.y < 0.995) {
      const n = this.rideNormal;
      const fdotn = this.axisF.x * n.x + this.axisF.z * n.z;
      const tx = this.axisF.x - n.x * fdotn;
      const tyRaw = -n.y * fdotn;
      const tz = this.axisF.z - n.z * fdotn;
      const tl = Math.hypot(tx, tyRaw, tz);
      if (tl > 1e-4) {
        const s = (this.speed * dt) / tl;
        this.pos.x += tx * s;
        this.pos.y += tyRaw * s;
        this.pos.z += tz * s;
      } else {
        this.pos.addScaledVector(this.axisF, this.speed * dt);
      }
    } else {
      this.pos.addScaledVector(this.axisF, this.speed * dt);
    }

    // Course-lateral movement. Ordinary walking reads the persistent physical
    // walk vector, so sideways/diagonal momentum coasts and turns with the same
    // rules as forward travel. Slides already applied their locked world-space
    // displacement atomically above.
    if (slamFlat) {
      // pancaked: no steering
    } else if (this.crawling) {
      if (input.moveX !== 0) {
        this.pos.addScaledVector(this.axisL, input.moveX * TUNING.crawlSpeed * dt);
      }
    } else if (slideStepDistance >= 0) {
      // exact slide displacement already includes both course components
    } else if (!this.freeSkate && !skating && !(this.charging && this.chargePlanted)) {
      const lateral = this.walkVelocity.dot(this.axisL);
      if (Math.abs(lateral) > 1e-6) this.pos.addScaledVector(this.axisL, lateral * dt);
    }

    // FOOT SLIP: too steep to grip. Cancel whatever UPHILL displacement the
    // walk/sidestep just wrote (so feet can never claw up the fall line), then
    // slither DOWN it — faster the steeper it gets. Sideways/downhill input
    // survives (strafe off the wall, or ride the slide down), so this reads as
    // Crash scrabbling on a bank, never as a snap to the board.
    if (footSlip && this.groundHit) {
      const n = this.groundHit.normal;
      const nl = Math.hypot(n.x, n.z);
      if (nl > 1e-4) {
        const ux = -n.x / nl; // world uphill (horizontal)
        const uz = -n.z / nl;
        const dpx = this.pos.x - this.prevPos.x;
        const dpz = this.pos.z - this.prevPos.z;
        const up = dpx * ux + dpz * uz;
        if (up > 0) {
          this.pos.x -= ux * up;
          this.pos.z -= uz * up;
        }
        const steepFrac = THREE.MathUtils.clamp((TUNING.footGrip - n.y) * 5, 0.25, 1);
        const slip = TUNING.walkSpeed * 0.75 * steepFrac;
        this.pos.x -= ux * slip * dt;
        this.pos.z -= uz * slip * dt;
        this.slipClamp = true;
      }
    }

    // Follow the ground within a chunky snap window, otherwise we ran off an
    // edge and go airborne. Steep transitions (halfpipe walls, banks) get a
    // taller window both ways so fast climbs and descents stick to the surface.
    // ANALYTIC PIPE ATTACH: riding a halfpipe, the body glues to the exact
    // parametric curve instead of chasing raycasts — a down-ray runs parallel
    // to the near-vertical top and flickers/misses (the stutter climbing the
    // wall), and the eased normal lagged the curve. Attached, position and
    // normal are exact every frame: seamless from flat to coping. The attach
    // hands back to the normal path past the coping (the launch logic) or off
    // the pipe's ends.
    let hit: GroundHit | null = null;
    const ridingPipe = this.grounded && this.groundHit ? this.groundHit.halfpipe : undefined;
    // LIP STALL CATCH: climbed SQUARE to the wall (within lipAngle of head-on),
    // holding Triangle, and actually REACHED the coping — park on the lip, at
    // any speed. Checked before the attach/launch so a fast climb can't blow
    // straight past the catch zone into a hang.
    if (
      ridingPipe &&
      this.freeSkate &&
      this.lipCoolT <= 0 &&
      this.rawInput.grindHeld &&
      this.pos.y >= ridingPipe.lipY - 0.9 &&
      this.lipHeadOn(ridingPipe)
    ) {
      this.enterLipStall(ridingPipe);
      return;
    }
    if (ridingPipe) {
      const along = ridingPipe.alongCoord(this.pos.x, this.pos.z);
      const previousRideSide = ridingPipe.isRideSide(
        ridingPipe.crossCoord(this.prevPos.x, this.prevPos.z),
        this.prevPos.y,
      );
      const lo = Math.min(ridingPipe.l0, ridingPipe.l1) - 0.3;
      const hi = Math.max(ridingPipe.l0, ridingPipe.l1) + 0.3;
      if (along >= lo && along <= hi && previousRideSide) {
        const pr = ridingPipe.project(
          ridingPipe.crossCoord(this.pos.x, this.pos.z),
          this.pos.y,
        );
        // |pen| window ≈ the old wallStick: near or into the surface = attached
        if (
          pr &&
          Math.abs(pr.u) < ridingPipe.uLip - 0.02 &&
          Math.abs(pr.pen) < TUNING.wallStick
        ) {
          if (ridingPipe.axis === 'z') this.pos.x = pr.cross;
          else this.pos.z = pr.cross;
          // exact surface point; the y-window below passes trivially (dy = 0)
          hit = {
            y: pr.y,
            normal: ridingPipe.normalAt(pr.u, new THREE.Vector3()),
            name: 'halfpipe',
            halfpipe: ridingPipe,
          };
          // the analytic normal IS smooth — track it exactly, no easing lag
          this.rideNormal.copy(hit.normal);
        }
      }
    }
    if (!hit) hit = this.queryGround(level);
    const steepHit = hit !== null && hit.normal.y < CONST.steepSnapNormal;
    const upWindow = steepHit ? TUNING.wallStick : 0.8;
    const downWindow = steepHit ? TUNING.wallStick : 1.4;
    // Cresting a vert lip: the board was climbing a near-vertical face; now the
    // surface ahead has gone flat (the coping's backside). Convert the climb
    // straight into UP-air — the vertical launch IS the climb rate you earned.
    // The lip fires on the STEEPER of: slope-along-travel (head-on) OR the wall
    // itself being near-vert (rideNormal) — so an ANGLED approach still crests
    // into hang time (with lateral), instead of failing because the projected
    // slope dropped below vertLip. vertLip maps to the wall-normal threshold.
    const vertWallY = Math.sqrt(Math.max(0, 1 - TUNING.vertLip * TUNING.vertLip));
    // ...but a face the level flagged as a ROAD never launches a hang, however
    // hard it banks. A slide's gutter lip is a kerb that holds you in the
    // course, not a coping that throws you off it.
    const vertFace = (h: GroundHit | null): boolean => h !== null && h.vert !== false;
    // HALFPIPE COPING LAUNCH: climbing a transition and reaching the near-vert
    // top (rideNormal.y <= 0.25, up near the lip height) pops you over into the
    // EXISTING vert hang-time — a big air if you rocketed up with speed, a small
    // pop if you just pumped to the lip. Either way you HANG and drop back into
    // the pipe (reusing the mature glue) instead of freezing on the face or
    // flinging off to your death. This is what the old dedicated launch lacked.
    const hpNow = this.freeSkate && hit ? hit.halfpipe : undefined;
    if (
      hpNow &&
      !this.isBailing && // a tumbling body must never be thrown into a hang
      this.lastTy > 0.15 && // heading is still climbing (not dropping back down)
      this.rideNormal.y <= 0.25 && // at the near-vertical coping stretch
      this.pos.y > hpNow.lipY - 1.2 // and up near the lip
    ) {
      // LIP STALL: reaching the top IS this launch condition — so the stall
      // check lives here, ahead of the pop. Holding Triangle, SQUARE to the
      // wall (within lipAngle of 90°): park on the coping instead of hanging.
      // Speed doesn't matter — only that you actually made it up here.
      if (this.lipCoolT <= 0 && this.rawInput.grindHeld && this.lipHeadOn(hpNow)) {
        this.enterLipStall(hpNow);
        return;
      }
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.airFromSkate = true;
      this.airGrav = 'board';
      this.pipeHang = true; // climb-hold must not read as a trick-spin (no phantom bail)
      this.hangPipe = hpNow; // remember which pipe launched this hang (spine transfers)
      this.grabSpinAngle = 0;
      // vertical launch = the climb speed you carried up, plus a pop so even a
      // gentle arrival clears the coping into a hang.
      this.vVel = Math.min(
        this.speed * Math.max(this.lastTy, 0.6) + TUNING.pipePop,
        CONST.maxFallSpeed,
      );
      this.enterVertAir(
        input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0 || !input.jumpHeld,
      );
      // (no woosh here: this fires on EVERY vert-air entry, so pumping a pipe
      // spammed it into a wind tunnel. The sparks carry the moment.)
      this.emitSparks(5, 0xfff3d0, 1.2);
      this.coyoteTimer = 0;
    } else if (
      hit &&
      !this.isBailing && // ...same for the general crest
      this.speed > 0.5 &&
      vertFace(hit) &&
      (this.lastTy > TUNING.vertLip || this.rideNormal.y < vertWallY) &&
      hit.normal.y >= CONST.steepSnapNormal
    ) {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.airFromSkate = true; // vert launches only happen from riding
      this.airGrav = 'board';
      this.hangPipe = ridingPipe ?? hit.halfpipe ?? null; // spine-transfer bookkeeping
      this.vVel = Math.min(this.takeoffTy * this.speed, CONST.maxFallSpeed);
      // ALWAYS hang time. Releasing X (or a fresh tap) at the lip LAUNCHES you
      // higher into the hang (the intuitive pop); holding X = a mellow hang.
      // Approach angle decides straight-in vs a sideways gap (see enterVertAir).
      this.enterVertAir(
        input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0 || this.vertLaunchT > 0,
      );
      // (same spam rule as the crest pop: no per-entry woosh)
      this.emitSparks(5, 0xfff3d0, 1.2);
      this.coyoteTimer = 0;
    } else if (hit && hit.y >= this.pos.y - downWindow && hit.y <= this.pos.y + upWindow) {
      this.pos.y = hit.y;
      this.groundHit = hit;
      this.grounded = true;
      this.surfaceName = hit.name;
      this.crateFloor = hit.crate ?? null;
      // Ease the ride plane toward the facet under the board: segmented
      // transitions blend into one continuous curve. Fresh landings snap so
      // a stale plane can't misread the first frames of a new surface.
      const ease = Math.min(1, TUNING.pipeSmooth * dt);
      this.rideNormal.lerp(hit.normal, ease).normalize();

      // Crash teeter: slow/stopped with part of the board hanging over an
      // edge — wobble as a warning; step back (or jump) to save yourself.
      // Steep transitions don't count: their "edges" are just the next slab.
      this.teetering = false;
      if (Math.abs(this.speed) < CONST.teeterSpeed && !steepHit) {
        for (const [ox, oz] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) {
          if (!this.queryGround(level, ox, oz)) {
            this.teetering = true;
            break;
          }
        }
      }
    } else if (this.slideTimer > 0) {
      // CARTOON SLIDE: a canned slide carries you straight over a gap at a
      // FIXED height — no edge-drop, no gravity, no teeter — so sliding (and
      // slide-jumping) along a ledge can't yeet you off. Gravity resumes the
      // instant the slide ends, so you fall then if there's nothing under you.
      this.grounded = true;
      this.vVel = 0;
      this.teetering = false;
      // pos.y stays exactly where it was (the slide moved planar only)
    } else if (
      // Slow onto a LETHAL edge: catch at the brink and teeter instead of
      // yeeting off. Only for genuine death drops (pit/void below, not a
      // survivable step-down), only below teeterCatchSpeed, never off a lip
      // (that's a launch) or mid-slide (slides carry over gaps on their own).
      TUNING.teeterCatchSpeed > 0 &&
      Math.abs(this.speed) < TUNING.teeterCatchSpeed &&
      this.slideTimer <= 0 &&
      this.lastTy < TUNING.vertLip &&
      (() => {
        const belowY = this.queryShadowGround(level);
        return belowY === null || belowY <= level.killY;
      })() &&
      (() => {
        // Only teeter if there's an actual LEDGE to step back onto. If the plank
        // under you just broke away (nothing at prevPos either), there's nothing
        // to catch — you fall, not hover in mid-air.
        const back = this.queryGround(level, this.prevPos.x - this.pos.x, this.prevPos.z - this.pos.z);
        return back !== null && Math.abs(back.y - this.prevPos.y) < 1.0;
      })()
    ) {
      this.pos.copy(this.prevPos); // step back onto the ledge
      this.grounded = true;
      this.speed = 0;
      this.vVel = 0;
      this.teetering = true;
    } else {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.crawling = false;
      this.airFromSkate = this.freeSkate; // rolling off on the board keeps tricks live
      // Left the ground without jumping: rolling off a kicker on the board is a
      // board air; stepping off a ledge on foot is a platforming fall.
      this.airGrav = this.freeSkate ? 'board' : 'foot';
      // Off a kicker lip or a sloped run-out (Slipstream downhill): ballistic.
      this.floatAir = this.freeSkate && (this.takeoffTy > 0.05 || this.rideNormal.y < 0.985);
      // Authored kicker launch: leaving an uphill lip converts the climb to
      // lift (forward travel only — backing off an edge just drops).
      const liftTy = this.takeoffTy;
      this.vVel =
        this.speed > 0 && liftTy > 0.05
          ? Math.min(liftTy * this.speed, CONST.maxFallSpeed)
          : 0;
      // A near-vertical lip (halfpipe coping) is hang time; releasing X launches.
      // Same head-on-OR-vert-wall test as the grounded crest (angled entries too).
      if (this.vVel > 0.5 && vertFace(hit) && (this.lastTy > TUNING.vertLip || this.rideNormal.y < vertWallY)) {
        this.enterVertAir(
          input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0 || this.vertLaunchT > 0,
        );
        // (same spam rule: vert-air entries are silent, the ride is the sound)
      }
      this.coyoteTimer = CONST.coyoteTime;
    }

    // Crash slide-jump: a charge held from BEFORE the slide was dropped at
    // slide start, so releasing it mid-slide does nothing — but a FRESH X
    // press during the slide arms a high leap, fired on release.
    if (this.slideTimer > 0) {
      this.jumpBufferT = 0;
      if (input.jumpPressed) this.charging = true;
      if (this.charging && input.jumpHeld) {
        this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
      }
      if (input.jumpReleased && this.charging) {
        this.chargedJump(dt);
        return;
      }
    } else {
      // Buffered pre-landing release: fire it now that we're down. If X is
      // already held again, the fresh charge wins and the buffer is dropped.
      if (this.jumpBufferT > 0 && !slamFlat && this.state === 'ride') {
        this.jumpBufferT = 0;
        if (!input.jumpHeld) {
          this.chargeTimer = this.jumpBufferCharge;
          this.chargedJump(dt);
          return;
        }
      }

      // Charge jump: holding X drops the board, crouches, builds jump power,
      // and skates (the speed build lives in the skate branch above); releasing
      // fires the jump (coyote grace applies at ledges). A quick tap still
      // gives a serviceable hop.
      if (this.state === 'ride' && input.jumpHeld && !slamFlat) {
        if (!this.charging) {
          // A charge begun at a STANDSTILL plants the feet: holding a
          // direction won't slide you around or trip the skate — it aims the
          // jump, playing out as air movement the moment you release.
          // (lastPlanar = PREVIOUS frame's measured movement — the walk drive
          // above may have already set this frame's speed before we arm.)
          this.chargePlanted = this.lastPlanar < 1 && this.slideTimer <= 0;
        }
        this.charging = true;
        this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
      }
      if (input.jumpReleased && this.charging && !slamFlat && (this.state === 'ride' || this.coyoteTimer > 0)) {
        // Climbing a near-vert wall: DON'T ollie into the wall — reserve the
        // release as the lip LAUNCH (the imminent crest reads vertLaunchT and
        // flies you higher into hang time). If no crest comes, it just fizzles.
        // (onTransition, not bare steepness — swallowing the ollie on a banked
        // ROAD would just eat the jump, since no vert crest is ever coming)
        const climbingVert =
          steepGround && this.onTransition && this.speed > 0.5 && this.lastTy > TUNING.vertLip * 0.5;
        if (climbingVert) this.vertLaunchT = 0.25;
        else this.chargedJump(dt);
      }
    }
  }

  private tickEmergencyBoardEject(dt: number, input: Input): boolean {
    const eligible =
      this.state === 'air' &&
      this.boardOllieAir &&
      this.freeSkate &&
      this.airFromSkate &&
      this.airGrav === 'board' &&
      !this.emergencyEjectUsed &&
      !this.vertAir &&
      !this.pipeHang &&
      !this.wallriding &&
      !this.isBailing &&
      !this.slamActive;
    if (!eligible) {
      this.emergencyEjectCharging = false;
      this.emergencyEjectChargeT = 0;
      return false;
    }

    if (input.jumpPressed) {
      this.emergencyEjectCharging = true;
      this.emergencyEjectChargeT = 1e-4;
    }
    if (this.emergencyEjectCharging && input.jumpHeld)
      this.emergencyEjectChargeT = Math.min(0.4, this.emergencyEjectChargeT + dt);
    if (!input.jumpReleased || !this.emergencyEjectCharging) return false;

    const charge = THREE.MathUtils.clamp(this.emergencyEjectChargeT / 0.4, 0, 1);
    // Capture and launch the real deck before handing its velocity back to the
    // rider at the reduced retention rate.
    this.throwBoard(true);
    this.speed *= 0.82;
    this.vVel = THREE.MathUtils.lerp(10.5, 15, charge);
    this.launchVy = this.vVel;
    this.airborneT = 0;
    this.airPeakY = this.pos.y;
    this.airJumpUsed = true;
    this.bounceJump = false;
    this.doubleJumpAir = false;
    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.airMomentum = true;
    this.freeSkate = false;
    this.stepOff = true;
    this.slideFromWalk = true; // first touchdown stays on foot; no speed-remount
    this.boardOllieAir = false;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.emergencyEjectUsed = true;
    this.emergencyEjectLandingPending = true;
    this.emergencyEjectLandingWillBail = this.simRand() >= 0.1;
    this.charging = false;
    this.chargeTimer = 0;
    this.jumpBufferT = 0;
    this.flipT = 0;
    this.deckTricksThisAir.clear();
    this.flipTimer = CONST.frontFlip ? CONST.flipDuration : 0;
    this.lastJumpType = 'Emergency Eject';
    sfx.play('ollie', 0.75, 0.9 + charge * 0.2);
    sfx.play('woosh2', 0.6);
    return true;
  }

  // Consume first-contact evidence exactly once. The caller decides whether a
  // sampled failure should start a new bail; an already-bailing contact merely
  // clears the now-obsolete eject judgment after its ragdoll response wins.
  private consumeEmergencyEjectLanding(): boolean | null {
    if (!this.emergencyEjectLandingPending) return null;
    const shouldBail = this.emergencyEjectLandingWillBail;
    this.emergencyEjectLandingPending = false;
    this.emergencyEjectLandingWillBail = false;
    this.emergencyEjectUsed = false;
    this.boardOllieAir = false;
    this.deckTricksThisAir.clear();
    return shouldBail;
  }

  private stepAir(
    dt: number,
    input: Input,
    level: Level,
    emergencyEjected: boolean,
  ): void {
    if (this.wallriding) {
      this.stepWallride(dt, input, level);
      return;
    }
    // Did this air ever actually GO UP? A jump did; rolling off an edge (a
    // drop-in across its own coping) never does. The rail smack reads this to
    // tell the two apart — fall speed alone can't: an ollie ONTO a deck-height
    // rail crosses the line near the apex, falling barely faster than a
    // drop-in crossing its lip.
    if (this.vVel > 1) this.airRose = true;
    // Coyote release: letting go of a charge just after rolling off a ledge
    // still jumps. A press-then-release fully in the air (tap) works too.
    if (emergencyEjected) {
      this.jumpBufferT = 0;
      this.charging = false;
      this.chargeTimer = 0;
    } else if (!this.isBailing && this.coyoteTimer > 0) {
      if (input.jumpHeld && !this.charging) this.charging = true; // tap started mid-air
      if (input.jumpReleased && this.charging) {
        this.chargedJump(dt);
      }
    } else if (!this.isBailing) {
      if (input.jumpReleased) {
        // X let go in the air: buffer a landing jump for a beat, so a release
        // a hair before touchdown still hops (it only fires if landing soon).
        this.jumpBufferT = 0.14;
        this.jumpBufferCharge = this.charging ? this.chargeTimer : 0;
      }
      if (this.charging) {
        // grace expired: the charge fizzles
        this.charging = false;
        this.chargeTimer = 0;
      }
    } else {
      this.jumpBufferT = 0;
      this.airTapT = 0;
      this.charging = false;
      this.chargeTimer = 0;
    }

    // DOUBLE JUMP (tuner toggle): a quick mid-air TAP of X pops a second,
    // smaller jump — one per air, on-foot airs only. A TAP, specifically:
    // press-and-HOLD is the landing recharge (the skate habit of loading X
    // back up mid-air), and that must never pop — so the double fires on
    // the release of a sub-0.2s press, not on the press itself. Hangs,
    // slams, and grabs own their airs; the coyote window keeps priority.
    // The window SCALES with the jump: doubleJumpWindow is the allowance on a
    // FULL-CHARGE jump, and each air multiplies it by its launch pop relative
    // to that (arrow-crate boosts get longer, quick taps shorter). A plain
    // walk-off fall launches with no pop — it keeps the base window so ledge
    // saves still work.
    const djWindow =
      TUNING.doubleJumpWindow *
      (this.launchVy > 1
        ? THREE.MathUtils.clamp(this.launchVy / Math.max(TUNING.jumpVelocity, 1), 0.3, 2)
        : 1);
    if (
      TUNING.doubleJump > 0.5 &&
      !this.isBailing &&
      this.airborneT <= djWindow && // only this early into the air
      (!this.airFromSkate || this.bounceJump) && // a crate bounce earns a tap even mid-skate-air
      this.coyoteTimer <= 0 &&
      !this.vertAir &&
      !this.slamActive &&
      !this.grabbing
    ) {
      if (input.jumpPressed && !this.airJumpUsed) this.airTapT = 1e-4; // arm the tap
      else if (this.airTapT > 0 && input.jumpHeld) this.airTapT += dt;
      if (this.airTapT > 0.2) this.airTapT = 0; // held past a tap: it's a charge
      if (input.jumpReleased && this.airTapT > 0 && !this.airJumpUsed) {
        this.airTapT = 0;
        this.airJumpUsed = true;
        this.doubleJumpAir = true;
        this.vVel = TUNING.doubleJumpVelocity;
        this.speed *= TUNING.doubleJumpHorizontalScale;
        this.slideAirLat *= TUNING.doubleJumpHorizontalScale;
        this.walkVelocity.multiplyScalar(TUNING.doubleJumpHorizontalScale);
        // The Unity second jump is a high split-legged lift, not another copy
        // of the running somersault. Choosing it cleanly interrupts any first-
        // jump flip that was still in progress.
        this.flipTimer = 0;
        this.starTimer = 0;
        this.lastJumpType = 'Double Jump';
        sfx.play('footstep2', 0.6, 1.8);
      }
    } else {
      this.airTapT = 0;
    }

    // Circle + down: pancake body slam, Wile E. Coyote rules — engage, FREEZE
    // in the air for a beat (momentum screeches to nothing), then plummet.
    // The impact breaks everything around you (TNT pops safely, nitro does NOT).
    // VERT HANG TIME: glued to the wall. The planar position eases back to
    // the launch plane (gravity brings you down INTO the transition), while
    // the stick drifts you along the coping — never away from the wall.
    // Non-pipe hangs first RE-AIM that plane at whatever the wall feeler
    // finds, so curved walls and bowl corners carry the hang around with them.
    if (this.vertAir && !this.hangPipe) this.trackVertWall(level, dt);
    if (this.vertAir) {
      // BALLISTIC VERT (THPS): the air is free flight. The launch already did
      // the assist work — enterVertAir zeroes the into-ramp component, so with
      // nothing pushing you across the wall normal you rise and fall on the
      // launch line by plain physics, no per-frame plane glue pulling the
      // position back. (The old glue also bent flights around bowl corners
      // mid-air; trackVertWall still watches the wall, but only to know when
      // the vert ended — the flight itself is gravity's.)
      const tx = -this.vertNormal.z; // wall tangent (along the coping)
      const tz = this.vertNormal.x;
      // carried lateral momentum from an off-axis entry: conserved for the
      // WHOLE hang (air has no friction) — a hard angled carve genuinely
      // flies you down the pipe, lines up transfers, covers ground. Running
      // out of pipe is the hang-end bail's problem, not a damper's.
      if (this.vertLatVel !== 0) {
        this.pos.x += tx * this.vertLatVel * dt;
        this.pos.z += tz * this.vertLatVel * dt;
      }
      // NON-pipe verts (bowls, mesh walls): the crest detection fires a beat
      // PAST the lip, over the deck — so a touch of into-the-ramp drift puts
      // the arc back over the transition face, the job the old 1.2-inset glue
      // anchor used to do. Analytic pipes launch on the face and stay pure.
      if (!this.pipeHang && this.vertInDrift !== 0) {
        this.pos.x += this.vertNormal.x * this.vertInDrift * dt;
        this.pos.z += this.vertNormal.z * this.vertInDrift * dt;
      }
      // Stick steering along the coping — OFF during a pipe hang (locked-in
      // vert: the stick SPINS you, it never translates you; this slide is
      // exactly why spin attempts floated you down the pipe). vertDrift
      // keeps it available for general non-pipe crests via the tuner.
      const rx = this.rawInput.moveX;
      const ry = this.rawInput.moveY;
      if ((rx !== 0 || ry !== 0) && !this.pipeHang) {
        const inv = 1 / Math.hypot(rx, ry);
        const along = rx * inv * tx + -ry * inv * tz;
        this.pos.x += tx * along * TUNING.vertDrift * dt;
        this.pos.z += tz * along * TUNING.vertDrift * dt;
      }
      // (The old SPINE CARRY — holding into the lip walked the glue plane
      // across the ridge — is REMOVED, not just zeroed: a stale saved-tuning
      // snapshot kept resurrecting it, marching the anchor out the back of
      // the wall at spineDrift u/s and dumping glued hangs onto the deck
      // floor. That WAS the "float out of hangtime". Spine transfers return
      // as a deliberate mechanic in the redesign.)
      // THPS RULES at the END of the pipe: drift past it during hang time and
      // there is no wall to catch you — you LEFT the vert, and that's a bail.
      // The old clamp levelled you out and parked you on the line like a
      // guardian angel; now the angel lets go: the hang breaks, the lateral
      // carry rides off the end, and the body ragdolls down whatever's there.
      if (this.hangPipe) {
        const hp = this.hangPipe;
        const lo = Math.min(hp.l0, hp.l1) + 0.4;
        const hi = Math.max(hp.l0, hp.l1) - 0.4;
        const along = hp.alongCoord(this.pos.x, this.pos.z);
        if (along < lo || along > hi) {
          // OFF THE END: the hang breaks into plain flight carrying the drift
          // — sideways to your facing, board not really under you. What you
          // hit next decides it: another vert, a rail, a wall = saved and you
          // ride on; the FLAT ground = the bail you had coming (judged at
          // touchdown via pipeEndFly).
          const lat = this.vertLatVel;
          this.vertAir = false;
          this.pipeHang = false;
          this.hangPipe = null;
          this.airGrav = 'board';
          this.airMomentum = true;
          // ...unless the "hang" tripped this check the instant it began: that
          // was never hang time — you RODE out the open end partway up the
          // wall. That exit is a roll-off air with homework: the body levels
          // from the wall tilt to wheels-down over rollOffLevelTime, and
          // touching down before it's level (off a saving surface) is still
          // the bail you were carrying — just with a window to earn the ride.
          this.pipeEndFly = this.airborneT >= 0.2;
          if (!this.pipeEndFly) this.rollOffT = CONST.rollOffLevelTime;
          if (Math.abs(lat) > 0.5) {
            // Heading comes from the WALL TANGENT the drift was measured in
            // (the same (-n.z, n.x) frame enterVertAir seeded lat with).
            // sign(lat) on the raw world axis is backwards on one wall of
            // every pipe — THE "flung me back the other way" exit.
            const fx = -this.vertNormal.z * Math.sign(lat);
            const fz = this.vertNormal.x * Math.sign(lat);
            const fl = Math.hypot(fx, fz) || 1;
            this.axisF.set(fx / fl, 0, fz / fl);
            this.axisL.set(this.axisF.z, 0, -this.axisF.x);
            this.speed = Math.abs(lat);
          }
          this.vertLatVel = 0;
          // (no woosh: it made slipping past the coping sound like a boost)
        }
      }
    }

    // PANCAKE SLAM. On foot it is Circle ALONE — that is the move you reach for
    // mid-air over a crate and it should not want a direction as well. On the
    // BOARD it is Circle + DOWN, because there Circle on its own has to stay
    // free for the grab. Either way it is a platforming move, so a board slam
    // also STOWS THE BOARD: you plummet, land on your feet, and carry on
    // running (exactly like a slide jump, which is the other way off the deck).
    // Vert air is the one place it never fires — a pipe/wall air belongs to the
    // grab and the spin, and a slam there would eat the drop back in.
    const vertTrick = this.vertAir || this.pipeHang;
    const slamNow =
      !this.slamActive &&
      !this.isBailing && // a ragdolling body can't slam (Circle may still be held from the crash)
      !vertTrick &&
      // a street grab already committed owns its air — rolling the stick to
      // down mid-Melon must not detonate into a slam. A FRESH Circle+down
      // chord still slams, because updateGrab runs AFTER the state step (see
      // the call order in step()): this test reads the phase as it stood at
      // the top of the frame, which for a brand-new chord is still 'none'.
      // updateGrab's own hard-down guard then refuses to open the grab.
      this.grabPhase !== 'enter' &&
      this.grabPhase !== 'held' &&
      this.pendingSpecialGrab === null &&
      input.grabHeld &&
      (!this.airFromSkate || this.rawInput.moveY < -0.5);
    if (slamNow) {
      if (this.airFromSkate) {
        // off the deck: the rest of this air, the landing and everything after
        // it are on foot
        this.airFromSkate = false;
        this.airGrav = 'foot';
        this.freeSkate = false;
        this.slideFromWalk = true; // on-foot touchdown clamp: no skate takeover on landing
        this.stepOff = true;
        this.airMomentum = false;
      }
      this.slamActive = true;
      this.vertAir = false; // the slam plummets straight down, no wall glue
      this.vertLatVel = 0;
      this.slamHangT = CONST.slamHang;
      this.grabPhase = 'none';
      this.grabT = 0;
      this.grabGraceTimer = 0;
      this.grabSpinAngle = 0;
      this.flipT = 0; // the deck is stowed — a mid-flip must not score under the slam
      this.specialFlip = null;
      this.flipDuration = CONST.flipTime;
      this.specialGrab = null;
      this.specialGrabT = 0;
      this.specialGrabLanding = false;
      this.charging = false;
      this.chargeTimer = 0;
      this.flipTimer = 0;
      sfx.play('woosh3', 0.8);
    }

    if (this.slamActive) {
      if (this.slamHangT > 0) {
        // the cartoon hang: no gravity, forward motion screeches off
        this.slamHangT -= dt;
        this.vVel = 0;
        this.speed *= Math.max(0, 1 - 10 * dt);
      } else {
        this.vVel = -CONST.slamSpeed; // authored plummet, gravity doesn't apply
      }
    } else {
      // Asymmetric fake gravity: heavier on the way down for a snappy arc.
      // EXCEPT vert air — ANY vert air, pipes and tracked walls alike:
      // SYMMETRIC gravity (THPS rules) so you drop back in at the speed you
      // launched — the asymmetric fall (119 vs 33) would slam you down at 2x
      // the launch speed, converting into a huge down-wall speed on landing
      // that pings you across the pipe. Symmetric keeps the vert energy honest.
      // ...and leaving vert must not be a CLIFF. trackVertWall gives up after
      // 0.3s with no wall and drops vertAir outright, which flipped gravity 33
      // -> 119 in a single frame — a 3.6x step in the middle of an arc the
      // player is reading. Blend back to street gravity over vertGravityBlend
      // instead. (This is the one place the deliberate Crash asymmetry was
      // leaking somewhere it was never meant to apply.)
      // ...and that asymmetry is a PLATFORMING choice, so it now applies to
      // platforming airs only. A board air — ollie, kicker, roll-off, rail or
      // wall exit — flies under its own pair. On foot the fall is 3.6x the
      // rise, which is the Crash snap and is right for a jump you aim at a
      // crate; on the board that same slam is what made every ollie and every
      // ramp launch read as short, spitting you at the floor at 24-46 u/s.
      // The mode was decided at LAUNCH (see airGrav), never re-derived here,
      // or gravity would flip mid-arc.
      const board = this.airGrav === 'board';
      let flatG =
        this.vVel > 0
          ? board
            ? TUNING.boardRiseGravity
            : TUNING.riseGravity
          : board
            ? this.floatAir
              ? TUNING.rampFallGravity // ramp/downhill launch: ballistic fall, THPS-style
              : TUNING.boardFallGravity
            : TUNING.fallGravity;
      // APEX FLOAT (board only): bleed a slice of gravity out of the top of the
      // arc and hand it straight back on the way down. The hang lands where the
      // player is actually reading the trick, and because the window is a fixed
      // band of vertical speed it costs a big kicker air proportionally far
      // less than a little ollie — which is what stops authored gaps going
      // trivial. At boardApexFloat 0 this is exactly the plain two-value model.
      if (board && TUNING.boardApexFloat > 0 && TUNING.boardApexBand > 0) {
        const nearApex = 1 - Math.min(1, Math.abs(this.vVel) / TUNING.boardApexBand);
        flatG *= 1 - TUNING.boardApexFloat * nearApex;
      }
      const g =
        this.vertAir || this.pipeHang
          ? TUNING.pipeAirGravity
          : this.vertGravT > 0 && TUNING.vertGravityBlend > 0
            ? THREE.MathUtils.lerp(
                flatG,
                TUNING.pipeAirGravity,
                this.vertGravT / TUNING.vertGravityBlend,
              )
            : flatG;
      this.vVel -= g * dt;
      // Terminal velocity: cap the fall so one step can never drop farther
      // than the ground ray can reach up (2.5u) — otherwise a fast fall
      // tunnels straight through a deck and you die under the level.
      if (this.vVel < -CONST.maxFallSpeed) this.vVel = -CONST.maxFallSpeed;
    }

    // Crash-style directional air control: up/down stretches or shortens the
    // jump (down brakes extra hard for precision), left/right sidesteps
    // laterally. Locked while holding a grab, slamming, or GLUED IN HANG TIME
    // (there the wall glue + vertDrift own all motion, so vertDrift is the sole
    // coping-drift control and nothing zeroes the parked speed).
    if (
      !this.isBailing &&
      !this.grabbing &&
      !this.slamActive &&
      !this.vertAir &&
      !this.slideJumpAir
    ) {
      const footAir =
        !this.charging &&
        !this.airMomentum && // grind/slide exits keep flying, even when slow
        Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
      const doubleScale = this.doubleJumpAir ? TUNING.doubleJumpHorizontalScale : 1;
      // Digital diagonals in the air get the same normalization as the walk.
      const diag = footAir && input.moveX !== 0 && input.moveY !== 0 ? Math.SQRT1_2 : 1;
      const railTransferStrafe =
        this.grindExitAir && input.transferHeld && !this.isBailing;
      if (footAir) {
        // On-foot air control is DIRECT DRIVE like the walk: zero inertia, so
        // precision hops (bouncy crates!) never drift. After a double jump the
        // same direct authority is intentionally capped at 55% traversal.
        this.speed = input.moveY * TUNING.walkSpeed * diag * doubleScale;
        this.walkVelocity
          .copy(this.axisF)
          .multiplyScalar(this.speed)
          .addScaledVector(
            this.axisL,
            input.moveX * TUNING.walkSpeed * diag * doubleScale,
          );
      } else if (Math.abs(input.moveY) > 0.05) {
        // Braking (input against travel) bites harder than stretching, in
        // either direction.
        const opposing = input.moveY * this.speed < 0;
        const rate = opposing ? TUNING.airControl * CONST.airBrakeFactor : TUNING.airControl;
        const cap = TUNING.downhillMax;
        this.speed = THREE.MathUtils.clamp(this.speed + rate * input.moveY * dt, -cap, cap);
      }
      // The lateral sidestep is a FOOT-AIR move only now (precision hops).
      // On the board that stick axis is the THPS spin — a board air flies
      // ballistic and left/right rotates the body instead (see updateGrab).
      // A rail hop gets that translation only while R2 is deliberately held.
      // Without R2 the same left/right axis remains THPS rotation only.
      if ((footAir || railTransferStrafe) && Math.abs(input.moveX) > 0.05) {
        this.pos.addScaledVector(
          this.axisL,
          input.moveX * TUNING.walkSpeed * diag * doubleScale * dt,
        );
      }
    }

    this.pos.addScaledVector(this.axisF, this.speed * dt);
    if (this.slideAirLat !== 0) this.pos.addScaledVector(this.axisL, this.slideAirLat * dt); // slide-jump cross-heading launch
    this.pos.y += this.vVel * dt;
    const incomingPlanarX = (this.pos.x - this.prevPos.x) / Math.max(dt, 1e-6);
    const incomingPlanarZ = (this.pos.z - this.prevPos.z) / Math.max(dt, 1e-6);
    this.airPeakY = Math.max(this.airPeakY, this.pos.y);

    let hit = this.queryGround(level);
    // ANALYTIC PIPE CATCH: crossed a halfpipe's cross-section curve this step
    // (jumped/fell INTO the transition — rising or falling, any speed). Land
    // exactly ON the curve: position snaps to the surface point and the landing
    // below runs unconditionally (the energy projection converts the flight
    // into riding the wall, THPS-style). This replaces the raycast for pipe
    // walls — a down-ray is parallel to a near-vertical face and tunnels.
    const pipeCatch = this.wallriding ? null : this.pipeCrossHit(level);
    if (pipeCatch) {
      const hp = pipeCatch.halfpipe!;
      if (hp.axis === 'z') this.pos.x = pipeCatch.pipeCross!;
      else this.pos.z = pipeCatch.pipeCross!;
      this.pos.y = pipeCatch.y;
      hit = pipeCatch;
      this.pipeRideT = 0.2; // landing on a pipe: the next crest is a pipe hang
    }
    this.groundHit = hit;

    // Ceiling: rising into the UNDERSIDE of a deck or ramp belly bonks
    // (surfaces are 1 thick; tall blocks already have wall colliders). Stops
    // the head passing up through elevated platforms AND sloped ramp
    // undersides. Only near-vertical transition faces are exempt — rising
    // past one must not bonk you on its coping.
    if (hit && this.vVel > 0 && hit.normal.y >= 0.4) {
      const underside =
        hit.y -
        (hit.undersideThickness ?? 1) * Math.max(0.1, hit.normal.y);
      const head = this.pos.y + CONST.playerHalf.y * 2;
      if (this.pos.y < underside - 0.05 && head > underside) {
        this.pos.y = underside - CONST.playerHalf.y * 2;
        this.vVel = 0;
      }
    }

    // RAIL SMACK: come down ON a rail without asking for the grind and you
    // don't ghost through it — you fold over the bar and get wrecked. Holding
    // or pressing Triangle is the ask (tryGrind owns that path, hit or miss);
    // everything else that lands on the line eats it. The pop it fires makes
    // vVel positive, so the landing check below naturally sits this frame out.
    if (this.railLandSmack(input, level)) {
      // folded over the bar — the ragdoll owns everything from here
      this.consumeEmergencyEjectLanding();
    }
    // Land only on surfaces we were actually ABOVE last step (with a small
    // ledge forgiveness) — a surface overhead must never teleport us onto it.
    // Steep transitions get a much deeper forgiveness: falling with sideways
    // drift can cross a rising bank face by more than a deck's worth in one
    // step, and that's a landing, not a clip-through. A HALFPIPE wall always
    // gets a deep window no matter how low the slider is set — its transition
    // is near-vertical near the coping, so a fast, drifting descent must LAND
    // on the pipe, never punch through it into the pit below.
    let landGive =
      hit && hit.halfpipe
        ? Math.max(TUNING.landGive, 4)
        : hit && hit.normal.y < CONST.steepSnapNormal
          ? TUNING.landGive
          : 0.35;
    let landNow =
      hit !== null &&
      (pipeCatch !== null || // the analytic catch already resolved the contact exactly
        (this.vVel <= 0 &&
          this.pos.y <= hit.y + 0.05 &&
          (this.prevPos.y >= hit.y - 0.05 || this.pos.y >= hit.y - landGive)));
    if (!landNow && this.vVel <= 0) {
      // After a forward low-obstacle trip, the obstacle's standable top can
      // remain the first down-ray result even after the body is below it. Pick
      // the highest surface this completed step could actually have crossed,
      // so the ragdoll lands on terrain instead of tunnelling through the map.
      const maximumCrossedY = Math.max(this.pos.y + 0.35, this.prevPos.y + 0.05);
      const reachable = this.queryGround(level, 0, 0, maximumCrossedY);
      if (reachable) {
        hit = reachable;
        this.groundHit = reachable;
        landGive = reachable.halfpipe
          ? Math.max(TUNING.landGive, 4)
          : reachable.normal.y < CONST.steepSnapNormal
            ? TUNING.landGive
            : 0.35;
        landNow =
          this.pos.y <= reachable.y + 0.05 &&
          (this.prevPos.y >= reachable.y - 0.05 || this.pos.y >= reachable.y - landGive);
      }
    }
    if (landNow && hit) {
      if (this.isBailing) {
        // A bail that existed BEFORE this surface contact owns it completely.
        // Consume obsolete eject evidence only after the ragdoll response has
        // been resolved, and never let huge-drop/trampoline logic replace it.
        const rebounded = this.resolveRagdollGroundBounce(hit);
        this.consumeEmergencyEjectLanding();
        if (rebounded) return;
      } else {
        // Emergency eject is judged exactly once on its first contact, ahead
        // of any surface-authored response. A sampled failure rebounds as a
        // bail; a sampled clean scramble may continue through normal landing
        // arbitration (including a genuine huge-drop check).
        const ejectShouldBail = this.consumeEmergencyEjectLanding();
        if (ejectShouldBail === true) {
          this.pos.y = hit.y;
          this.surfaceName = hit.name;
          this.rideNormal.copy(hit.normal);
          this.bail();
          this.startRagdoll('air');
          this.noteRagdollGroundImpact();
          this.vVel = 3.4 + Math.min(2.2, Math.abs(this.speed) * 0.12);
          this.state = 'air';
          this.grounded = false;
          this.airFromSkate = false;
          this.airGrav = 'foot';
          this.airMomentum = true;
          return;
        }

        // Huge-drop damage is a contact outcome, not a clean landing effect.
        // If it starts a bail, feed this same surface into the deterministic
        // ragdoll response before considering any authored bounce pad.
        if (this.beginHugeDropLandingBail(hit, incomingPlanarX, incomingPlanarZ)) {
          if (this.resolveRagdollGroundBounce(hit)) return;
        }
      }
    }

    if (landNow && hit) {
      this.pos.y = hit.y;
      this.state = 'ride';
      this.grounded = true;
      this.boardOllieAir = false;
      this.emergencyEjectCharging = false;
      this.emergencyEjectChargeT = 0;
      this.emergencyEjectUsed = false;
      this.deckTricksThisAir.clear();
      this.surfaceName = hit.name;
      this.crateFloor = hit.crate ?? null;
      this.coyoteTimer = 0;
      this.airMomentum = false; // touchdown: normal ground rules resume
      this.airGrav = 'foot'; // the next air re-declares; a site that forgets gets the platforming arc, not this one's
      this.floatAir = false; // the ballistic tag belongs to the air that just ended
      this.grindExitAir = false; // the rail-hop strafe window closes at the wheels
      this.liftTy = 0; // this landing's ramp memory belongs to this landing
      this.liftTyT = 0;
      this.slideAirLat = 0; // slide-jump arc is done
      this.slideJumpAir = false;
      this.rideNormal.copy(hit.normal); // fresh landing: ride plane snaps, no stale blend
      const wasPipeHang = this.pipeHang; // (cleared next step; needed for drop-in rules below)
      // THPS coping rules: a vert-air landing comes down AT the lip line —
      // give the coping rails a beat of yield so the touchdown can never
      // curb-stop or trip on the very rail it is meant to land beside.
      if (this.vertAir) this.vertLandGraceT = 0.6;
      // REVERT window: touching down out of a vert air opens a beat where R2
      // pivots the landing into a live combo link (see the handler in step).
      // The landing must be ON a transition face — the pipe's FLAT bottom is
      // tagged with the halfpipe too, and without the slope gate a plain hop
      // on the flat opened a riskless hop+R2 combo farm.
      if (
        (wasPipeHang || this.vertAir || hit.halfpipe !== undefined) &&
        hit.normal.y < 0.985
      )
        this.revertT = 0.3;
      const preFx = this.axisF.x; // heading BEFORE the landing projection — a
      const preFz = this.axisF.z; // reversal against it = landed riding fakie
      // Landing out of a lateral hang: keep the sideways momentum so a gap
      // transfer flows on the far side instead of stalling. Seed it as speed
      // along the coping BEFORE the projection below folds in any fall energy.
      if (this.vertLatVel !== 0) {
        const tx = -this.vertNormal.z;
        const tz = this.vertNormal.x;
        const s = Math.sign(this.vertLatVel);
        this.axisF.set(tx * s, 0, tz * s);
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
        this.speed = Math.abs(this.vertLatVel);
        this.vertLatVel = 0;
      }
      // ENERGY-CONSERVING LANDING (board airs only): project the incoming 3D
      // velocity onto the landing surface so a drop DOWN a wall becomes speed
      // down the wall instead of a dead stop — this is what makes hang-time
      // drop-ins flow. On flat ground the vertical is normal to the surface, so
      // it simply falls away and horizontal speed is untouched (a no-op); only
      // steep faces convert. landingFlow scales how much of the fall survives.
      // THUG rules: the rotation happens on EVERY landing, not only true-vert
      // faces — a drop onto the LOW part of a transition (35 degrees) must
      // still become down-the-wall roll, or you park dead mid-face. Near-flat
      // ground makes it a natural no-op, so the only gate is "some slope".
      if (this.airFromSkate && hit.normal.y < 0.97) {
        const n = hit.normal;
        const vvx = this.speed * this.axisF.x;
        const vvz = this.speed * this.axisF.z;
        const vdotn = vvx * n.x + this.vVel * n.y + vvz * n.z;
        const tvx = vvx - vdotn * n.x;
        const tvy = this.vVel - vdotn * n.y;
        const tvz = vvz - vdotn * n.z;
        const tangSpeed = Math.hypot(tvx, tvy, tvz);
        if (tangSpeed > 0.5) {
          // new heading = downhill along the surface (horizontal projection;
          // fall-line from the normal if the projection is degenerate on vert)
          let hx = tvx;
          let hz = tvz;
          if (Math.hypot(hx, hz) < 1e-3) {
            hx = n.x;
            hz = n.z;
          }
          const hl = Math.hypot(hx, hz) || 1;
          this.axisF.set(hx / hl, 0, hz / hl);
          this.axisL.set(this.axisF.z, 0, -this.axisF.x);
          const keep = THREE.MathUtils.lerp(Math.abs(this.speed), tangSpeed, TUNING.landingFlow);
          this.speed = Math.min(keep, TUNING.downhillMax);
        }
      }
      this.vVel = 0;
      // FAKIE DROP-IN (THPS rules): a pipe-hang drop that lands travelling
      // roughly OPPOSITE the way it took off has effectively switched stance —
      // going up forward and coming down IS riding away fakie. Flip the stance
      // and absorb the 180 into the facing yaw so the body pose is continuous:
      // no slow turn-around animation, no phantom "stance switch" beat.
      if (wasPipeHang && this.axisF.x * preFx + this.axisF.z * preFz < -0.2) {
        const oldStance = this.stance;
        this.stance = -this.stance as 1 | -1;
        this.visualYaw = wrapAngle(this.visualYaw + oldStance * Math.PI * this.sidePose);
      }
      // And for a beat, the stick you were still holding to CLIMB (now opposite
      // travel) must not read as a pull-back brake — the drop-in flows.
      if (wasPipeHang) this.pipeLandGraceT = 0.4;
      // A slide taken from your feet lands back ON your feet — clamp the
      // carried burst at the touchdown instant (not next frame) so nothing
      // downstream can read the unclamped speed and flip out the board.
      // The latch also caps NEXT frame's measured planar: the landing step
      // itself moved at air speed, and without it the skate gate reads that
      // measurement and takes over anyway (board out + cruise assist).
      if (this.slideFromWalk && this.slideTimer <= 0) {
        this.speed = THREE.MathUtils.clamp(this.speed, -TUNING.walkSpeed, TUNING.walkSpeed);
        this.lastPlanar = Math.min(this.lastPlanar, TUNING.walkSpeed);
        this.slideFromWalk = false;
        this.slideLandClamp = true;
        // Slide-jump touchdown (a slideFromWalk air always lands on foot): hold
        // the board OFF for a beat so a slope re-accelerating you — or a
        // direction you're holding — can't flip the deck out.
        this.skateBlockT = 0.3;
      }
      // Landing-tick payouts (grab, slam impact) are still air tricks
      // for combo purposes even though the state just flipped to 'ride'.
      this.landingScoring = true;

      // PIPE-END FLY-OFF, judged: you left the vert sideways off the coping.
      // Coming down on another transition face rides out (the projection
      // above already turned the fall into speed); coming down on the FLAT
      // with the board still crossways is the wipeout you had coming.
      if (this.pipeEndFly || this.rollOffT > 0) {
        // A RIDE-OUT that got the wheels down in time lands like any air;
        // still tilted at touchdown (or the full judged fly-off, which holds
        // its tilt on purpose) = the crash you were carrying.
        const stillTilted = this.pipeEndFly || this.landingAlignPose > 0.5;
        this.pipeEndFly = false;
        this.rollOffT = 0;
        const saved =
          hit.halfpipe !== undefined || hit.vert === true || hit.normal.y < TUNING.steepStand;
        if (stillTilted && !saved) {
          if (this.uberTimer > 0) {
            // uber shrugs the whole thing off — ride on
          } else {
            this.landingScoring = false;
            // A mask softens the SAME crash now — the ragdoll still plays and
            // the combo survives it — instead of the old alpha-flash absorb.
            this.bail(this.masks > 0);
            this.startRagdoll('side', Math.sign(this.speed) || 1);
            this.noteRagdollGroundImpact();
            this.vVel = 3.4 + Math.min(2.2, Math.abs(this.speed) * 0.12);
            this.state = 'air';
            this.grounded = false;
            this.airFromSkate = false;
            this.airGrav = 'foot';
            this.airMomentum = true; // the crash speed rides through the rebound
            return;
          }
        }
      }

      // SPINE TRANSFER: this hang crested one pipe and came down on a
      // DIFFERENT one — you carried it over the ridge.
      if (wasPipeHang && hit.halfpipe && this.hangPipe && hit.halfpipe !== this.hangPipe) {
        this.score(CONST.ptsSpine, 'Spine Transfer');
        this.emitSparks(8, 0xa0e8ff, 2);
      }

      // A trampoline owns a clean Slam contact just like an Arrow crate: the
      // plummet is cancelled before it can emit its floor shock/score, then
      // the pad launches immediately. Bail/eject/huge-drop arbitration has
      // already run above and cannot reach this ordinary-landing branch.
      if (this.slamActive && hit.trampolineBounce !== undefined) {
        this.slamActive = false;
        this.slamHangT = 0;
        this.slamFlatT = 0;
        this.slamSquash = 0;
        if (this.launchFromTrampoline(hit, input)) {
          this.landingScoring = false;
          return;
        }
      }

      if (this.slamActive) {
        this.slamImpact(level);
        this.landingScoring = false;
        return;
      }

      // GRAB LANDING RULES:
      //  - Circle still held (or the pose still returning — grabRelease is
      //    how long that takes) = bail. Release early enough to be neutral.
      //  - Spin within spinTolerance of the travel line = clean landing.
      //  - Spin within spinTolerance of the 180 line = clean SWITCH landing:
      //    the stance flips and you ride away facing backward.
      //  - Anything between = you landed funny: bail.
      // Uber shrugs a bail off; a mask absorbs it; otherwise you tumble.
      const TAU = Math.PI * 2;
      const a2 = ((this.grabSpinAngle % TAU) + TAU) % TAU;
      const dev0 = Math.min(a2, TAU - a2);
      const devPi = Math.abs(a2 - Math.PI);
      const tol = THREE.MathUtils.degToRad(TUNING.spinTolerance);
      const spun = Math.abs(this.grabSpinAngle) > 0.02;
      // THPS's three-tier judgment, VERT AIRS INCLUDED now: on-line = clean,
      // inside the sketchy net = kept-but-taxed (wobble, speed scrub, half
      // points), past the net = bail. Off-axis vert landings are THE
      // risk/reward of vert — the old force-complete made every 900 free.
      // (A bare pipe-hang drop-in stays safe on its own: hangs start un-spun
      // and the climb hold never writes rotation, so spun is false unless you
      // actually threw one.)
      const offLine = Math.min(dev0, devPi);
      const sketchNet = Math.max(tol, THREE.MathUtils.degToRad(TUNING.sketchyTolerance));
      // Touching down while the deck is still mid-flip: the trick is eaten and
      // the landing goes sketchy (forgiving where THPS would bail — the crate
      // loop leans on quick spin-attacks, so a late flip stings, not flattens).
      const flipLate = this.flipT > 0;
      const lateSpecialFlip = flipLate && this.specialFlip !== null;
      if (flipLate) {
        this.flipT = 0;
        this.specialFlip = null;
        this.flipDuration = CONST.flipTime;
      }
      const funny = (spun && offLine > sketchNet) || lateSpecialFlip;
      const sketchy = (spun && !funny && offLine > tol) || (flipLate && !funny);
      if (this.grabPhase !== 'none' || funny) {
        if (this.uberTimer > 0) {
          this.grabPhase = 'none';
          this.grabT = 0;
          this.grabGraceTimer = 0;
          this.visualYaw = wrapAngle(this.visualYaw + this.grabSpinAngle); // no unwind
          this.grabSpinAngle = 0;
          this.airGrabShown = null;
          this.clearSpecialMoves();
        } else {
          this.landingScoring = false;
          // A mask no longer buys the alpha-flash ride-on: the SAME crash
          // plays (ragdoll and all) — the mask makes it cheap instead: a
          // shorter knockdown, the deck stays with you, the combo survives.
          this.bail(this.masks > 0);
          this.noteRagdollGroundImpact();
          // A botched landing SLAPS the transition and the body kicks back up
          // off it — that rebound is what puts the ragdoll on show (grounded,
          // the sprawl would eat the whole crash in one frame).
          this.vVel = 3.4 + Math.min(2.2, Math.abs(this.speed) * 0.12);
          this.state = 'air';
          this.grounded = false;
          this.airFromSkate = false;
          this.airGrav = 'foot';
          this.airMomentum = true; // the crash speed rides through the rebound
          return;
        }
      } else {
        // pose is neutral and the spin lines up with 0 or 180: a landed 180 rides
        // away switch. (A pipe hang can't reach here off the climb hold unless you
        // actually held a rotation — the snap-on-release lands sub-90 spins at 0.)
        // A sketchy landing reads its stance off the NEAREST line instead.
        const isSwitch = spun && (sketchy ? devPi < dev0 : devPi <= tol);
        if (isSwitch) this.stance = -this.stance as 1 | -1; // landed backward: swap feet
        if (sketchy) {
          // Kept it — barely. The wobble scrubs speed and shakes the body for
          // a beat; the spin below pays half. Riding away is the reward.
          this.speed *= 0.78;
          this.sketchyT = 0.6;
          sfx.play('crunch', 0.3, 1.35);
          this.emitSparks(5, 0xffc24a, 1.5);
        }
        // A ROTATION IS A TRICK: any landed 180+ scores its own combo entry,
        // grab or no grab — so grab + rotation strings TWO tricks together
        // (a real combo), and a bare hang-time spin still pays on its own.
        // Net rotation, credited in 180s (the snap already pulled it on-axis).
        const halves = Math.round(Math.abs(this.grabSpinAngle) / Math.PI);
        const completedSpecialGrab = this.specialGrabLanding;
        let landedTrick = completedSpecialGrab;
        if (this.grabGraceTimer > 0) {
          // A clean (released in time, on-line) grab pays out a speed burst.
          // The grab itself already scored on START (it's a timed trick that
          // ticks up on the combo plate), so the landing only pays the burst —
          // scoring again here would double-count it.
          this.speed += TUNING.grabBoost * (this.speed >= 0 ? 1 : -1);
          const cap = TUNING.downhillMax;
          this.speed = THREE.MathUtils.clamp(this.speed, -cap, cap);
          landedTrick = true;
        }
        // A 180 out of a PIPE HANG is nearly free — the glue pins you to the
        // wall plane and the drop-in auto-corrects on-axis, so you'd score a
        // trick for holding a direction. THUG refuses it explicitly ("if in
        // vert air, only count the spin if it is at least 360, because getting
        // 180 is too easy"). Street airs still pay from the first 180.
        if (!completedSpecialGrab && halves >= (wasPipeHang ? CONST.vertSpinMin : 1)) {
          const deg = halves * 180;
          const spinBase = Math.round(halves * CONST.ptsSpin * (sketchy ? 0.5 : 1));
          const spinName = `${sketchy ? 'Sketchy ' : ''}${isSwitch ? 'Switch ' : ''}${deg}°`;
          if (this.airGrabShown) {
            // Spin + grab in ONE air is ONE trick (THPS: "360 Judo", not
            // "360" and "Judo"): fold the rotation into the grab's plate
            // entry — its name gains the degrees, its points gain the spin,
            // and no second multiplier is minted. The spin share still pays
            // the repeat-decay rule, though — folding it must not exempt the
            // biggest air trick from the anti-farming curve.
            const uses = this.comboUses.get(spinName) ?? 0;
            this.comboUses.set(spinName, uses + 1);
            const curve = CONST.repeatDecay;
            let fold = Math.round(spinBase * curve[Math.min(uses, curve.length - 1)]);
            if (this.uberTimer > 0) fold *= CONST.uberScoreMult;
            const pfx = this.airGrabShown.startsWith('Tiki ') ? 'Tiki ' : '';
            this.renameLabel(this.airGrabShown, `${pfx}${spinName} ${this.grabTrickName}`);
            this.comboPoints += fold;
            this.comboHudActionRevision++;
            this.special.award(fold);
            this.comboTimer = Math.max(this.comboTimer, CONST.comboWindow);
          } else {
            this.score(spinBase, spinName);
          }
          landedTrick = true;
        }
        if (landedTrick) this.emitSparks(10, 0xfff3d0, 2.2);
        this.grabGraceTimer = 0;
        // Absorb the landed rotation into the facing yaw — zeroing the spin
        // must not unwind the body. On a switch landing the stance flip also
        // inverts the ±90° side term, so fold that in too: a 180 from
        // regular side-on IS the switch side-on pose — the body stays put.
        this.visualYaw = wrapAngle(
          this.visualYaw +
            this.grabSpinAngle +
            (isSwitch ? -this.stance * Math.PI * this.sidePose : 0),
        );
        this.grabSpinAngle = 0;
        this.airGrabShown = null; // this air's grab entry is settled
        this.specialGrabLanding = false;
        // THPS landing pump: wheels down with X already held (a crouched
        // landing) pays a small speed burst — re-crouch through every
        // touchdown and the line stays fast. The clamp never CONFISCATES:
        // a perfect-grind payout lands above downhillMax on purpose, and the
        // pump must not chop it back to the ceiling.
        if (input.jumpHeld && this.airFromSkate && Math.abs(this.speed) > 0.5) {
          const pumpCap = Math.max(TUNING.downhillMax, Math.abs(this.speed));
          this.speed += TUNING.landPumpBoost * (this.speed >= 0 ? 1 : -1);
          this.speed = THREE.MathUtils.clamp(this.speed, -pumpCap, pumpCap);
        }
      }
      // A trampoline is a clean grounded-ride effect, deliberately last in
      // contact arbitration. Existing/new bails, emergency-eject failures,
      // huge drops, slams, and failed trick landings have all returned above.
      if (this.launchFromTrampoline(hit, input)) {
        this.landingScoring = false;
        return;
      }

      // A pipe drop-in doesn't announce itself — the wheels just meet the
      // transition and roll (THPS: the landing IS the flow). Ordinary fast
      // landings keep the transition sound.
      if (!wasPipeHang && Math.abs(this.speed) > TUNING.boardSpeed) sfx.play('skateTransition', 0.5);
      // LAND INTO A MANUAL: the flick finished moments before touchdown — come
      // down balanced on two wheels and the combo string STAYS ALIVE (no bank).
      if (this.manualing !== 0) {
        // a coyote manual carried across the bump — still the live connector
      } else if (this.manualArmT > 0 && this.manualArmed !== 0 && this.canManual()) {
        this.enterManual(this.manualArmed);
      } else {
        // Safe landing: not banked on the spot — leave a beat of grace to
        // flick into a manual (or catch anything else). The plain-rolling
        // combo clock banks it if nothing comes.
        this.comboTimer = Math.max(this.comboTimer, TUNING.manualLandGrace);
      }
      this.landingScoring = false;
      return;
    }
    // No assisted rail snap here on purpose: THPS2 rules — you have to be
    // holding/pressing Triangle to start a grind.
  }

  // Resolve a bail that ALREADY owns this contact. Returning true means the
  // body rebounded and remains airborne; false means the ordinary grounded
  // settle below may finish the contact, but no fresh landing effect may steal
  // priority from the bail.
  private resolveRagdollGroundBounce(hit: GroundHit): boolean {
    if (!this.isBailing || !this.ragActive) return false;
    // An impact is input-eligible even when it is too soft/steep to rebound or
    // the natural three-bounce budget is already spent. The body has hit the
    // floor; a lucky X press during the brief settle may still fish-flop it.
    this.noteRagdollGroundImpact();
    if (this.ragBounces >= 3 || this.vVel >= -3.2 || hit.normal.y <= 0.6)
      return false;

    this.pos.y = hit.y;
    const ragFall = -this.vVel;
    puffs.burst('dustLand', this.pos.x, this.pos.y + 0.04, this.pos.z, {
      dir: PUFF_UP,
      surface: surfaceFromName(hit.name),
      groundY: this.pos.y,
      strength: Math.min(2.2, 0.3 + (ragFall - 3.2) / 9),
    });
    this.vVel = -this.vVel * TUNING.ragBounce;
    this.speed *= 0.72;
    this.ragBounces++;
    this.ragAngVel.multiplyScalar(0.68);
    this.ragAngVel.x += (Math.random() - 0.5) * 7 * TUNING.ragSpin;
    this.ragAngVel.y += (Math.random() - 0.5) * 6 * TUNING.ragSpin;
    this.ragAngVel.z += (Math.random() - 0.5) * 4 * TUNING.ragSpin;
    sfx.play('crunch', 0.45, 1.1 + Math.random() * 0.35);
    this.emitSparks(3, 0xffb545, 1.2);
    return true;
  }

  // Slam touchdown: pancake squash and a small shockwave that breaks crates
  // and enemies. TNT pops safely (you slammed it on purpose); nitro is still
  // nitro — the blast check upstairs will get you.
  private beginHugeDropLandingBail(
    hit: GroundHit,
    incomingPlanarX: number,
    incomingPlanarZ: number,
  ): boolean {
    if (this.slamActive || this.isBailing || this.uberTimer > 0) return false;
    const descent = Math.max(0, this.airPeakY - hit.y);
    if (descent + 1e-4 < TUNING.hugeDropDistance) return false;
    const nl = Math.hypot(hit.normal.x, hit.normal.y, hit.normal.z) || 1;
    const nx = hit.normal.x / nl;
    const ny = hit.normal.y / nl;
    const nz = hit.normal.z / nl;
    const normalImpact = Math.max(
      0,
      -(incomingPlanarX * nx + this.vVel * ny + incomingPlanarZ * nz),
    );
    if (normalImpact + 1e-4 < TUNING.hugeDropImpact) return false;

    // This begins on the contact tick. The caller immediately feeds the same
    // contact into resolveRagdollGroundBounce, so the rider is never left
    // buried beneath the surface for one frame.
    this.pos.y = hit.y;
    this.bail(this.masks > 0);
    return true;
  }

  private slamImpact(level: Level): void {
    this.slamActive = false;
    this.slamSquash = CONST.slamSquashTime;
    this.slamFlatT = CONST.slamFlat; // stay pancaked for a beat
    this.speed = 0;
    this.score(CONST.ptsSlam, 'Body Slam');
    sfx.play('crunch', 0.9);
    this.emitSparks(12, 0xd8e6ff, 2.5);
    for (const c of level.crates) {
      if (!c.alive || c.bouncy || c.metalBounce || c.pending) continue;
      const p = c.mesh.position;
      const dx = p.x - this.pos.x;
      const dz = p.z - this.pos.z;
      if (dx * dx + dz * dz > TUNING.slamRadius * TUNING.slamRadius) continue;
      // The shock travels down through an indestructible metal support stack,
      // but a floor slam is not an attack on crates above the player.
      if (p.y > this.pos.y + 0.6 || p.y < this.pos.y - 3) continue;
      if (c.tnt) level.detonate(c);
      else if (c.nitro) level.detonate(c);
      else if (c.bang) level.triggerBang(c); // shockwave flips the switch
      else this.smashCrate(level, c);
    }
    for (const e of level.enemies) {
      if (e.alive && e.meleeKill && e.group.position.distanceTo(this.pos) < TUNING.slamRadius + 0.6) {
        level.killEnemy(e);
        this.score(CONST.ptsEnemy, 'Flattened');
      }
    }
    // A landed slam is a safe landing too: bank the string.
    this.bankCombo();
  }

  // Leaving a vert lip: ALWAYS hang time now (glue to the wall plane, drop back
  // into the transition). Two feel controls:
  //  - launch: you RELEASED X right at the lip — that flick pops you HIGHER
  //    into the hang (the intuitive "jump into hang time"). Holding X = mellow.
  //  - off-axis: hit the coping head-on (within hangSnapAngle) and it snaps to
  //    a pure vertical hang; steeper angles carry SIDEWAYS momentum along the
  //    coping (hangLateral) so you can drift across a gap / transfer walls.
  // (vVel — the base launch height — is already set by the caller.)
  // THUG-style vert tracking: while hanging over a NON-pipe vert wall,
  // re-find the wall every frame with a horizontal feeler at the remembered
  // lip height, and re-aim the glue plane at whatever it hits. That is what
  // carries a hang around CURVED walls and bowl corners (the lateral drift
  // slides you along the wall; the feeler keeps re-bending the plane to
  // match), and it is why the drop still lands in the transition. The lip
  // memory climbs with a rising coping and steps down to re-catch a dipping
  // one. Losing the wall for a beat — off the end, past a sharp corner —
  // hands the air back to plain gravity. Hangs that never found a wall
  // (authored kicker lips in open air) keep the fixed launch plane.
  private trackVertWall(level: Level, dt: number): void {
    const n = this.vertNormal; // horizontal, pointing off the face into the ramp's air
    let found = false;
    for (const dy of VERT_TRACK_STEPS) {
      VERT_RAY_O.set(this.pos.x + n.x * 2.6, this.vertAnchor.y + dy, this.pos.z + n.z * 2.6);
      VERT_RAY_D.set(-n.x, 0, -n.z);
      this.raycaster.set(VERT_RAY_O, VERT_RAY_D);
      this.raycaster.far = 5.2;
      const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
      const h = hits[0];
      if (!h || !h.face) continue;
      if (h.object.userData.halfpipe) continue; // analytic pipes keep their own hang rules
      const wn = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      // Steep-face filter for TRACKING: looser than THUG's 0.707 transfer
      // trigger — their tracking ran on artist-flagged polys covering the
      // whole transition, and our bowls' rideable band sits right at 0.71,
      // where a strict filter silently rejects the wall mid-hang (no glue).
      // A face the level FLAGGED as vert is tracked whatever its angle — the
      // 0.88 number below is a heuristic whose own comment admits it is fighting
      // our bowls, and an authored flag is exactly the answer to that.
      if (h.object.userData.vert === false) continue; // authored ROAD: never a wall
      if (!h.object.userData.vert && Math.abs(wn.y) >= 0.88) continue;
      const fl = Math.hypot(wn.x, wn.z);
      if (fl < 1e-4) continue;
      // sharp corner: the wall turned away too hard to keep riding it
      if ((wn.x * n.x + wn.z * n.z) / fl < 0.05) break;
      // re-aim the glue plane at the tracked face
      this.vertNormal.set(wn.x / fl, 0, wn.z / fl);
      // lip memory: climb with a rising coping, never slip down a sloped one —
      // but a DOWN-step hit is the recovery case and may lower it
      this.vertAnchor.y = dy < 0 ? h.point.y : Math.max(this.vertAnchor.y, h.point.y);
      // THUG pushes out an INCH, not a body length: the hang rides ON the
      // wall line, so the drop lands high on the face and rolls, instead of
      // hovering a body-width inside and plopping onto the low transition
      this.vertAnchor.x = h.point.x + this.vertNormal.x * 0.15;
      this.vertAnchor.z = h.point.z + this.vertNormal.z * 0.15;
      this.vertTracked = true;
      this.vertLossT = 0;
      found = true;
      break;
    }
    if (!found && this.vertTracked) {
      this.vertLossT += dt;
      if (this.vertLossT > 0.3) {
        // off the end of the wall — nothing left to land on, so stop being
        // vert and let gravity + the normal air pose take it from here.
        // The conserved drift is the ONLY horizontal momentum a ballistic
        // vert air has (speed was zeroed at launch) — convert it into speed
        // along the coping tangent instead of deleting it mid-air.
        const lat = this.vertLatVel;
        if (Math.abs(lat) > 0.5) {
          const tx = -this.vertNormal.z * Math.sign(lat);
          const tz = this.vertNormal.x * Math.sign(lat);
          this.axisF.set(tx, 0, tz);
          this.axisL.set(this.axisF.z, 0, -this.axisF.x);
          this.speed = Math.abs(lat);
          this.airMomentum = true; // the carry flies on through the hand-off
        }
        this.vertAir = false;
        this.vertLatVel = 0;
        this.vertGravT = TUNING.vertGravityBlend; // ease back to street gravity
      }
    }
  }

  private enterVertAir(launch: boolean): void {
    this.vertLaunchT = 0;
    this.jumpBufferT = 0;
    this.vertTracked = false;
    this.vertLossT = 0;
    // Launched off a halfpipe (via ANY crest path — the fast pump can take the
    // general one): suppress the hang-time stick-spin so the climb-hold doesn't
    // spin you into a phantom bail. Deliberate spins use the Square button.
    if (this.pipeRideT > 0) {
      this.pipeHang = true;
      this.grabSpinAngle = 0; // start the hang un-spun; a held direction rotates from here
    }
    if (launch) {
      this.vVel += TUNING.hangLaunch;
      this.charging = false;
      this.chargeTimer = 0;
    }
    const entrySpeed = this.speed;
    this.vertNormal.set(this.rideNormal.x, 0, this.rideNormal.z);
    const nl = this.vertNormal.length();
    if (nl < 1e-4) {
      this.speed = 0;
      this.vertLatVel = 0;
      return; // degenerate lip: plain air
    }
    this.vertNormal.divideScalar(nl);
    // decompose the entry heading into into-wall vs along-the-coping. `along`
    // is the sideways fraction (0 = dead head-on, ±1 = skimming the coping).
    const tx = -this.vertNormal.z; // coping tangent
    const tz = this.vertNormal.x;
    const along = THREE.MathUtils.clamp(this.axisF.x * tx + this.axisF.z * tz, -1, 1);
    const angleOff = Math.abs(Math.asin(along));
    if (angleOff <= THREE.MathUtils.degToRad(TUNING.hangSnapAngle)) {
      this.vertLatVel = 0; // snapped to a pure vertical hang
    } else {
      this.vertLatVel = entrySpeed * along * TUNING.hangLateral;
      // THPS conserves coping drift: a hard angled carve at speed genuinely
      // launches you down the pipe's length — that's how transfers and
      // lip-to-lip gaps get lined up. hangLatMax is only a sanity ceiling
      // now; drifting off the END of the pipe is the hang-end bail.
      this.vertLatVel = THREE.MathUtils.clamp(this.vertLatVel, -CONST.hangLatMax, CONST.hangLatMax);
    }
    // CONSERVE THE LAUNCH MAGNITUDE. The crest paths convert with `lastTy *
    // speed`, so an ANGLED carve up a wall got taxed twice — once for being
    // off-axis (vertLatVel takes a share) and again because a shallower lastTy
    // shrinks the vertical term. Take whatever is left after the lateral share
    // and make sure vVel is at least that: head-on this is a no-op, and the
    // steeper the carve angle the more it hands back.
    // Deliberately conserve into vVel ONLY — the lateral share already lives
    // in vertLatVel and is carried (undamped) through the whole hang.
    const conserved = Math.sqrt(
      Math.max(0, entrySpeed * entrySpeed - this.vertLatVel * this.vertLatVel),
    );
    this.vVel = Math.min(
      Math.max(this.vVel, conserved * TUNING.vertLaunchConserve),
      CONST.maxFallSpeed,
    );
    this.speed = 0; // the energy is in vVel (up) + vertLatVel (across) now
    // Launch reference (NOT a glue plane any more — the flight is ballistic).
    // The anchor's Y feeds the wall-tracking ray ladder; the small inset keeps
    // it just off the face. Non-pipe crests also take a gentle into-the-ramp
    // drift so the arc lands on the transition instead of the deck behind it
    // (the crest detection fires a beat past the lip).
    const inset = this.pipeHang ? 0.25 : 1.2;
    this.vertAnchor.copy(this.pos).addScaledVector(this.vertNormal, inset);
    this.vertInDrift = this.pipeHang ? 0 : 1.8;
    this.pipeEndFly = false; // catching ANOTHER vert saves a pipe-end fly-off
    this.rollOffT = 0; // ...and re-owns a levelling ride-out's pose
    this.vertAir = true;
  }

  // BASELINE CRUISE: while free-skating the board holds cruiseSpeed on its
  // own. Above it (a released charge, spent downhill speed) it settles back
  // down at chargeDecay; below it (a hill scrubbed you) the same rate eases
  // you back up. No assist on ground too steep to stand — pipes stay honest,
  // and the pull-back brake still cuts straight through to the dismount.
  private cruiseEase(dt: number, steep: boolean): void {
    const cruise = Math.min(TUNING.cruiseSpeed, TUNING.maxSpeed);
    // No assist on transitions — and the old friction bleed stays, so a
    // sideways crawl on a wall dies out and the stall-flip can roll you
    // back into the pipe instead of parking you mid-face.
    if (steep) {
      this.frictionBleed(dt, steep);
      return;
    }
    // ABOVE cruise, hold a direction and you used to lose speed at chargeDecay
    // (10/s) — HARDER than letting go of the stick entirely (friction, 7/s). So
    // steering was punished and the only way not to be robbed of a hard-won hill
    // was to hold X forever. Overspeed now bleeds through the same friction
    // model whether you steer or coast; only the pick-up rate stays chargeDecay.
    if (Math.abs(this.speed) > cruise) this.frictionBleed(dt, steep);
    else if (this.grounded) this.speed = Math.min(cruise, this.speed + TUNING.chargeDecay * dt);
  }

  // ROLL-OUT friction, THPS-shaped: a CONSTANT rolling term (so the board stops
  // decisively instead of oozing through the last unit of speed) plus a v^2 wind
  // term that only bites up top. The old curve was exactly backwards — it scaled
  // WITH speed, so hard-won top speed evaporated fastest and the final 1 u/s
  // took forever. friction 0 = frictionless.
  private frictionBleed(dt: number, steep: boolean): void {
    const s = Math.abs(this.speed);
    if (s < 1e-4) return;
    // Steep ground keeps the old linear bleed: it decelerates harder than the
    // constant term, which is what lets the stall-flip (needs speed < 2) fire.
    let bleed = steep
      ? TUNING.friction * dt
      : (TUNING.rollFriction + TUNING.windDrag * s * s) * dt;
    // Slick planks (icy sky-bridge boards): almost no friction, so you keep
    // sliding and can't stop short of the gap — the precision hazard.
    if (this.groundHit && this.groundHit.slippy) bleed *= CONST.slippyFriction;
    this.speed -= Math.sign(this.speed) * Math.min(bleed, s);
  }

  // -------------------------------------------------------------- rope swing --

  /**
   * Hand an attached deck to the existing loose-board simulation without
   * bailing the rider. Rope traversal is an on-foot authority: every board
   * latch, boost, brake and board-air judgment must close before the rope
   * zeros the rider's velocity, while the deck keeps the exact flight it had
   * on the catch tick.
   */
  private detachBoardForTraversal(): boolean {
    const hadBoard = this.freeSkate;
    if (hadBoard) {
      this.throwBoard(true);
      // A mounted-board catch supersedes the ordinary ollie/eject judgment.
      // Keep this inside the attached-board branch: catching on foot must not
      // relaunch or rewrite a deck that was already loose.
      this.emergencyEjectCharging = false;
      this.emergencyEjectChargeT = 0;
      this.emergencyEjectUsed = false;
      this.emergencyEjectLandingPending = false;
      this.emergencyEjectLandingWillBail = false;
      this.skateCharge = 0;
      this.brakeT = 0;
      this.brakeLockT = 0;
      this.brakeRampT = 0;
      this.oBrakeHold = false;
      this.greaseT = 0;
      this.grindBoostT = 0;
      this.speedPadCap = 0;
      this.activeSpeedPadId = 0;
    }

    if (this.manualing !== 0) this.endManual();
    this.manualArmed = 0;
    this.manualArmT = 0;
    this.manualCoyoteT = 0;

    this.freeSkate = false;
    this.skateOn = false;
    this.stepOff = true;

    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.airMomentum = false;
    this.floatAir = false;
    this.grindExitAir = false;
    this.boardOllieAir = false;
    this.ollieDeckTrickBufferT = 0;
    this.deckTricksThisAir.clear();
    this.flipT = 0;
    this.clearSpecialMoves();

    this.vertAir = false;
    this.vertTracked = false;
    this.vertLossT = 0;
    this.vertGravT = 0;
    this.vertLatVel = 0;
    this.vertInDrift = 0;
    this.vertLaunchT = 0;
    this.vertLandGraceT = 0;
    this.pipeHang = false;
    this.hangPipe = null;
    this.pipeRideT = 0;
    this.pipeLandGraceT = 0;
    this.pipeEndFly = false;
    this.rollOffT = 0;

    this.charging = false;
    this.chargePlanted = false;
    this.chargeTimer = 0;
    this.jumpBufferT = 0;
    this.airTapT = 0;
    this.bounceJump = false;
    return hadBoard;
  }

  // Airborne near a swing rope's line: catch it. The grip lands wherever your
  // chest met the rope, so a low pass grabs low — deeper reach, bigger arc.
  private tryRopeGrab(level: Level): boolean {
    if (level.ropeSwings.length === 0) return false;
    const chestY = this.pos.y + 1.0;
    for (const rs of level.ropeSwings) {
      // rope direction (anchor -> knot) at its CURRENT swing angle
      level.ropePointAt(rs, 1, ROPE_DIR).sub(rs.anchor);
      const px = this.pos.x - rs.anchor.x;
      const py = chestY - rs.anchor.y;
      const pz = this.pos.z - rs.anchor.z;
      const d = THREE.MathUtils.clamp(
        px * ROPE_DIR.x + py * ROPE_DIR.y + pz * ROPE_DIR.z,
        1.0,
        rs.len - 0.1,
      );
      level.ropePointAt(rs, d, ROPE_P);
      const dx = ROPE_P.x - this.pos.x;
      const dy = ROPE_P.y - chestY;
      const dz = ROPE_P.z - this.pos.z;
      if (dx * dx + dy * dy + dz * dz > CONST.ropeGrabRadius * CONST.ropeGrabRadius) continue;
      // Capture the mounted deck before attachment zeros speed/vVel. The rider
      // does not bail; the deck simply keeps flying on its own while both hands
      // take the rope. This is the same transaction as Unity's
      // DetachBoardForTraversal boundary.
      this.detachBoardForTraversal();
      this.state = 'rope';
      // ...and the slide-jump arc's launch too. These only cleared on a
      // WHEELS-DOWN landing, so catching a rope mid slide-jump carried the
      // cross-heading drift and the air-steer lockout into the NEXT air.
      this.cancelSlideTraversal();
      this.ropeObj = rs;
      this.ropeD = d;
      this.ropeJumpArm = false; // the held X that jumped you here must come up first
      this.vVel = 0;
      this.speed = 0;
      this.walkVelocity.set(0, 0, 0);
      this.walkTurnaround = false;
      this.walkIntent.set(0, 0, 0);
      this.airJumpUsed = false; // a solid grip re-arms the double jump
      this.doubleJumpAir = false;
      this.wallrideLatched = false;
      this.grabPhase = 'none';
      this.grabT = 0;
      this.grabGraceTimer = 0;
      this.grabSpinAngle = 0;
      this.airGrabShown = null;
      // Grab the rope with a clean hang: kill any in-progress roll-jump flip
      // (stepRope skips the airborne flip decay, so a mid-flip grab would freeze
      // the body upside-down). grabPhase/grabT were just cleared, so the grab
      // tuck releases too — hands are on the rope.
      this.flipTimer = 0;
      this.bailSpin = 0;
      this.spinTimer = 0;
      this.spinAngle = 0;
      // Face the direction you were actually travelling when you grabbed, and
      // hold it for the whole swing. Prefer the real displacement; fall back to
      // the heading when nearly still.
      let fx = this.axisF.x;
      let fz = this.axisF.z;
      const vlen = Math.hypot(this.lastVelX, this.lastVelZ);
      if (vlen > 1) {
        fx = this.lastVelX / vlen;
        fz = this.lastVelZ / vlen;
      }
      this.ropeFaceYaw = Math.atan2(-fx, -fz);
      this.visualYaw = this.ropeFaceYaw; // snap on grab, no turn-in jitter
      sfx.play('ledgeGrab', 0.6, 0.85);
      this.emitDust(2);
      return true;
    }
    return false;
  }

  // Hanging on: follow the swing, climb with up/down, leap with X, spin to
  // smash. The rope is driven — your weight never bends it.
  private stepRope(dt: number, input: Input, level: Level): void {
    this.runTime += dt;
    // essential shared timers (the rope early-outs before the main step body)
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    if (this.ttActive) {
      if (this.ttFreeze > 0) this.ttFreeze = Math.max(0, this.ttFreeze - dt);
      else this.ttTime += dt;
    }
    const rs = this.ropeObj;
    if (!rs) {
      this.state = 'air';
      return;
    }
    // climb: stick/arrows up walks the grip toward the anchor, down toward
    // the knot — while the whole rope keeps swinging
    this.ropeD = THREE.MathUtils.clamp(
      this.ropeD - input.moveY * CONST.ropeClimbSpeed * dt,
      1.0,
      rs.len - 0.1,
    );
    // Hands pinned to the grip; the body hangs straight DOWN below them (world
    // vertical, gravity-true) — NOT further along a swung rope, which would
    // slide the hips off the line and leave the model pivoting off its feet.
    level.ropePointAt(rs, this.ropeD, ROPE_P);
    ROPE_P.y -= 1.85; // rig origin is at the feet; the hands reach ~1.85 overhead
    this.pos.copy(ROPE_P);
    this.grounded = false;
    this.vVel = 0;
    // spinning up here is the point: mid-air crates and enemies in reach
    if (this.spinTimer > 0) this.ropeSpinSmash(level);
    // hold/release X = the normal charged jump, fired with the swing's
    // momentum. Arm only after X has been UP once on the rope, so the press
    // that jumped you INTO it can't fire the leap the moment you catch —
    // and the arm is set at the END of the frame, so the very release that
    // un-holds X can't arm itself.
    if (this.ropeJumpArm && input.jumpReleased) {
      this.ropeLeap(level, rs);
      return;
    }
    if (this.ropeJumpArm && input.jumpHeld) {
      this.charging = true;
      this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
    }
    if (!input.jumpHeld) this.ropeJumpArm = true;
    // the rope never shelters you from the kill floor (long ropes over pits)
    if (this.pos.y < level.killY) this.die();
  }

  private ropeLeap(level: Level, rs: RopeSwing): void {
    const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
    const jumpV = TUNING.jumpMinVelocity + (TUNING.jumpVelocity - TUNING.jumpMinVelocity) * t;
    level.ropeVelAt(rs, this.ropeD, ROPE_V);
    this.state = 'air';
    this.ropeObj = null;
    this.ropeCoolT = CONST.ropeRegrabCool;
    this.charging = false;
    this.chargeTimer = 0;
    // Rope traversal is always on foot. The deck—if there was one—is still in
    // the loose-board simulation, so no mounted momentum or board gravity can
    // reappear when the hands let go.
    this.freeSkate = false;
    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.airMomentum = false;
    this.vVel = jumpV + Math.max(0, ROPE_V.y * 0.9);
    this.airborneT = 0;
    this.launchVy = this.vVel;
    this.airPeakY = this.pos.y;
    this.airRose = false;
    this.airJumpUsed = false;
    this.doubleJumpAir = false;
    this.jumpBufferT = 0;
    this.airTapT = 0;
    this.coyoteTimer = 0;
    this.speed = 0; // ordinary on-foot air drive owns planar release movement
    this.walkVelocity.set(0, 0, 0);
    this.score(CONST.ptsRopeSwing, 'Rope Swing');
    sfx.play('woosh', 0.5, 1.1);
  }

  // One spin = one wrecking pass: crates and enemies within arm's reach of
  // the hanging body get smashed; TNT and nitro answer in their own voice.
  private ropeSpinSmash(level: Level): void {
    const cy = this.pos.y + 0.9;
    const reach = CONST.ropeSpinReach;
    for (const c of level.crates) {
      if (!c.alive || c.pending || c.bouncy || c.metalBounce) continue;
      const p = c.mesh.position;
      const dx = p.x - this.pos.x;
      const dy = p.y - cy;
      const dz = p.z - this.pos.z;
      if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
      if (c.tnt) level.detonate(c);
      else if (c.nitro) level.detonate(c);
      else if (c.bang) level.triggerBang(c);
      else this.smashCrate(level, c);
    }
    for (const e of level.enemies) {
      if (e.alive && e.meleeKill && e.group.position.distanceTo(this.pos) < reach + 0.4) {
        level.killEnemy(e);
        this.score(CONST.ptsEnemy, 'Takedown');
      }
    }
  }

  // ------------------------------------------------------------------ manual --

  // The stick flick landed: pop a manual now (on the ground) or, mid-air, arm
  // a LAND-INTO-manual for a beat.
  private tryManual(type: 1 | -1): void {
    if (this.manualing !== 0 || this.lipStallT > 0 || this.wallriding) return;
    if (this.state === 'air') {
      if (this.airFromSkate) {
        this.manualArmed = type;
        this.manualArmT = CONST.manualArmWindow;
      }
      return;
    }
    if (this.canManual()) this.enterManual(type);
  }

  private canManual(): boolean {
    return (
      !this.isBailing &&
      this.state === 'ride' &&
      this.grounded &&
      this.freeSkate &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      this.lipStallT <= 0 &&
      Math.abs(this.speed) >= TUNING.manualMinSpeed &&
      // banked bends + slope are fair manual ground — only true vert says no
      // (steepStand is the on-foot limit and reads too strict on two wheels)
      (this.groundHit === null || this.groundHit.normal.y >= 0.55)
    );
  }

  // Continuing is more forgiving than starting: no steepness gate at all (if
  // the wheels ride it, the manual rides it — course angles must not end a
  // held manual), and the speed floor softens so a crest's dip doesn't drop
  // you the frame before gravity gives the speed back.
  private canHoldManual(): boolean {
    return (
      this.state === 'ride' &&
      this.freeSkate &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      this.lipStallT <= 0 &&
      Math.abs(this.speed) >= TUNING.manualMinSpeed * 0.7
    );
  }

  private enterManual(type: 1 | -1): void {
    this.manualing = type;
    this.manualTime = 0;
    this.manualTickT = 0;
    this.balance = 0; // the manual needle reuses the grind balance field + visuals
    this.balanceVel = 0;
    this.balanceCritT = 0;
    this.noisePhase = this.simRand() * Math.PI * 2;
    this.manualArmed = 0;
    this.manualArmT = 0;
    this.score(CONST.ptsManualBase, type === 1 ? 'Manual' : 'Nose Manual');
    sfx.play('skateTransition', 0.35);
  }

  // Clean drop back onto four wheels — no bail, and no bank: the combo keeps
  // riding its own window.
  private endManual(): void {
    this.manualing = 0;
    this.manualCoyoteT = 0;
    this.balance = 0;
    this.balanceCritT = 0;
  }

  // The HUD balance meter: grinds get the horizontal bar (left/right needle),
  // manuals the vertical one (up/down needle — balance + = tipping back onto
  // the tail, needle sinks to the bottom; push UP to level out). null = hidden.
  get balanceMeter(): { mode: 'grind' | 'manual'; bal: number; crit: boolean } | null {
    if (this.state === 'grind') return { mode: 'grind', bal: this.balance, crit: this.balanceCritT > 0 };
    if (this.lipStallT > 0)
      // stall: whichever bar reads true on screen ('grind' = the horizontal
      // bar, 'manual' = the vertical one), needle signed to the screen too
      return {
        mode: this.lipMeterH ? 'grind' : 'manual',
        bal: this.balance * this.lipDispSign,
        crit: this.balanceCritT > 0,
      };
    if (this.manualing !== 0) return { mode: 'manual', bal: this.balance, crit: this.balanceCritT > 0 };
    return null;
  }

  // ---- authentic THPS/THUG balance core (shared by grind, manual & lip) ------
  // Neversoft ran ONE CManual per balance trick: a needle POSITION plus a
  // VELOCITY — an inverted pendulum that runs away from center, nudged by taps
  // and a little noise. We fold that onto our single this.balance ([-1,1]) as
  // additive layers, each gated by a slider whose 0 is the classic first-order
  // needle. So neutral (inertia/gravity/noise = 0) is byte-for-byte the old
  // feel, and every dial toward "authentic" is opt-in and live-tunable.
  private stepBalanceCore(
    dt: number,
    runSign: number, // which way the constant drift runs (sign of the needle)
    drift: number, // per-mode instability: balanceDrift*(1+ramp)*speed*style, etc.
    control: number, // already-signed, already safe-gained player fight
    ramp: number, // the capped difficulty ramp (also scales the sketch)
  ): void {
    // constant runaway — kept so the neutral model equals the classic one
    let force = runSign * drift;
    // inverted-pendulum "gravity": zero at center, harder the further off you
    // are (the edge cliff — react too late and no tap saves it)
    force += this.balance * TUNING.balanceGravity * drift;
    // the player's tap/hold fight
    force += control;
    // the "sketch": a smoothed, deterministic wander so the tip is never
    // memorizable; it quiets as corrective speed builds (a committed counter-tap
    // stills it) and rides the same capped ramp as the drift
    this.noisePhase += TUNING.balanceNoiseFreq * dt;
    if (TUNING.balanceNoise > 0) {
      const quiet = Math.max(0, 1 - Math.abs(this.balanceVel) / CONST.balanceNoiseGate);
      if (quiet > 0) {
        const n = Math.sin(this.noisePhase) * 0.6 + Math.sin(this.noisePhase * 2.3 + 1.7) * 0.4;
        force += n * TUNING.balanceNoise * (1 + ramp) * quiet;
      }
    }
    // momentum: the velocity LAGS toward the force. At inertia 0 it snaps to the
    // force every frame (follow = 1) so the needle is exactly first-order; dial
    // up and the needle carries speed, overshoots center, and demands feathered
    // taps — the real Tony Hawk slosh.
    if (TUNING.balanceInertia <= 0) {
      this.balanceVel = force;
    } else {
      const respRate =
        CONST.balanceRespSnap +
        (CONST.balanceRespFloat - CONST.balanceRespSnap) * TUNING.balanceInertia;
      this.balanceVel += (force - this.balanceVel) * Math.min(1, respRate * dt);
    }
    this.balance += this.balanceVel * dt;
  }

  // Neversoft "safe_period": for the first balanceSafePeriod seconds of a trick,
  // INWARD (corrective) input authority ramps up from 0, so an eager first tap
  // can't fling the fresh needle. Outward input keeps full authority. Identity
  // (returns 1) when the slider is 0.
  private safeGain(t: number, control: number, runSign: number): number {
    if (TUNING.balanceSafePeriod <= 0) return 1;
    if (Math.sign(control) === runSign) return 1; // pushing further out: unrestrained
    return Math.min(1, t / TUNING.balanceSafePeriod);
  }

  // --------------------------------------------------------------- lip stall --

  // Was the approach square to the wall? The lip trick wants a (near) 90°
  // hit — within lipAngle of dead-on. Off-axis arrivals grind the coping.
  private lipHeadOn(hp: Halfpipe): boolean {
    const along = hp.axis === 'z' ? this.axisF.z : this.axisF.x;
    return Math.abs(along) <= Math.sin(THREE.MathUtils.degToRad(TUNING.lipAngle));
  }

  // Align the stall's balance with the SCREEN, not the world: project the tip
  // axis (leaning into the pipe) onto the camera. If tipping reads mostly
  // LEFT/RIGHT on screen, the horizontal meter + left/right stick fight it;
  // if it reads mostly TOWARD/AWAY, the vertical meter + up/down. Pipes come
  // in 4 orientations and the camera aims where it likes — this projection is
  // what keeps "push toward the deck" meaning the same thing on all of them.
  // Returns the sign that maps the fighting stick axis onto the needle; also
  // refreshes lipMeterH/lipDispSign (25% hysteresis unless fresh, so a
  // drifting camera can't flicker the meter mid-stall).
  private lipAim(fresh: boolean): number {
    const hp = this.lipPipe!;
    const tipX = hp.axis === 'z' ? -this.lipSide : 0; // world dir of leaning INTO the pipe
    const tipZ = hp.axis === 'z' ? 0 : -this.lipSide;
    const dotR = -tipX * this.camDir.z + tipZ * this.camDir.x; // tip . camera-right
    const dotF = tipX * this.camDir.x + tipZ * this.camDir.z; // tip . camera-forward
    const h = Math.abs(dotR);
    const v = Math.abs(dotF);
    if (fresh) this.lipMeterH = h >= v;
    else if (h > v * 1.25) this.lipMeterH = true;
    else if (v > h * 1.25) this.lipMeterH = false;
    if (this.lipMeterH) {
      const s = dotR >= 0 ? 1 : -1;
      this.lipDispSign = s; // bal + (into pipe) -> needle toward the pipe's screen side
      return s;
    }
    const s = dotF >= 0 ? 1 : -1;
    this.lipDispSign = -s; // vertical bar: bal + -> needle sinks, so flip when the pipe reads "away"
    return s;
  }

  // Park on the coping, BALANCING: the needle (shared with the manual meter)
  // tips between the pipe below and the deck behind. Ride-side entry ONLY —
  // climb square holding Triangle through the crest; airs never catch it.
  private enterLipStall(hp: Halfpipe): void {
    const pr = hp.project(hp.crossCoord(this.pos.x, this.pos.z), this.pos.y);
    this.lipSide = Math.sign(pr ? pr.u : hp.crossCoord(this.pos.x, this.pos.z) - hp.cross) || 1;
    this.lipPipe = hp;
    this.lipStallT = TUNING.lipMaxTime;
    this.lipTickT = 0;
    // pin exactly on the lip point (stay wherever you are ALONG the pipe)
    const lipCross = hp.cross + this.lipSide * hp.lipX;
    if (hp.axis === 'z') this.pos.x = lipCross;
    else this.pos.z = lipCross;
    this.pos.y = hp.lipY;
    this.state = 'ride';
    this.grounded = true;
    this.surfaceName = 'coping';
    this.speed = 0;
    this.vVel = 0;
    this.walkVelocity.set(0, 0, 0);
    this.walkTurnaround = false;
    this.walkIntent.set(0, 0, 0);
    this.vertAir = false;
    this.pipeHang = false;
    this.vertLatVel = 0;
    // an air catch can arrive mid-grab or mid-spin — the stall absorbs both
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.endManual();
    this.balance = 0; // needle: + tips INTO the pipe (forgiving), − out the back (bail)
    this.balanceVel = 0;
    this.balanceCritT = 0;
    this.noisePhase = this.simRand() * Math.PI * 2;
    this.lipAim(true); // pick the meter that reads true on screen for THIS wall
    this.rideNormal.set(0, 1, 0);
    // THPS lip variety: the stick at the catch picks the trick. The climb
    // hold (up) is the neutral case on purpose — Axle Stall is the default,
    // not a trick you have to avoid; sideways leans and a pull-back rock pay
    // more. (Same balance game either way; the name and the payout differ.)
    const rIn = this.rawInput;
    const lipName =
      rIn.moveY < -0.4
        ? 'Rock to Fakie'
        : rIn.moveX < -0.4
          ? 'Nose Stall'
          : rIn.moveX > 0.4
            ? 'Tail Stall'
            : 'Axle Stall';
    const lipMult = lipName === 'Axle Stall' ? 1 : lipName === 'Rock to Fakie' ? 1.15 : 1.25;
    this.score(Math.round(CONST.ptsLip * lipMult), lipName);
    sfx.play('railLand', 0.7);
    this.emitSparks(5, 0xffe08a, 1.2);
  }

  // SPINE TRANSFER — deliberate: R2 during a pipe hang, near or above the
  // coping. If another vert's mouth sits right across the lip line you're
  // hanging over, the hang does a one-way switch onto that pipe: position
  // and glue plane mirror across the coping, the arc (vVel) carries over,
  // and you come down the far transition. No target = the press does
  // nothing. Nothing too crazy.
  private trySpineTransfer(level: Level): boolean {
    if (this.isBailing || !this.vertAir || this.transferCoolT > 0) return false;
    // general vert crest (a ramp lip, not a pipe): R2 still pulls you OUT —
    // eject over the top onto whatever's behind the wall
    if (!this.pipeHang || !this.hangPipe) {
      return this.vertExit(this.vertNormal.clone().negate(), this.pos.y);
    }
    const hp = this.hangPipe;
    if (this.pos.y < hp.lipY - 0.5) return false; // below the coping the ridge is solid
    const anchorCross = hp.crossCoord(this.vertAnchor.x, this.vertAnchor.z);
    const side = Math.sign(anchorCross - hp.cross) || 1;
    const lipCross = hp.cross + side * hp.lipX;
    const along = hp.alongCoord(this.pos.x, this.pos.z);
    // probe a step past the coping on the far side
    const px = hp.axis === 'z' ? lipCross + side * 1.0 : along;
    const pz = hp.axis === 'z' ? along : lipCross + side * 1.0;
    let target: Halfpipe | null = null;
    for (const other of level.halfpipes) {
      if (other === hp || other.axis !== hp.axis) continue;
      const oAlong = other.alongCoord(px, pz);
      if (oAlong < Math.min(other.l0, other.l1) - 0.2) continue;
      if (oAlong > Math.max(other.l0, other.l1) + 0.2) continue;
      if (Math.abs(other.crossCoord(px, pz) - other.cross) <= other.lipX - 0.3) {
        target = other;
        break;
      }
    }
    if (!target) {
      // no pipe across the ridge — R2 pulls you OUT of the vert instead:
      // hop the coping onto the deck/platform behind it and roll away
      const out = new THREE.Vector3(hp.axis === 'z' ? side : 0, 0, hp.axis === 'z' ? 0 : side);
      if (hp.axis === 'z') this.pos.x = lipCross + side * 1.2;
      else this.pos.z = lipCross + side * 1.2;
      return this.vertExit(out, Math.max(this.pos.y, hp.lipY + 0.3));
    }
    // mirror pos + glue plane across the lip line; keep height, arc, lateral
    const myCross = hp.crossCoord(this.pos.x, this.pos.z);
    if (hp.axis === 'z') {
      this.pos.x = 2 * lipCross - myCross;
      this.vertAnchor.x = 2 * lipCross - anchorCross;
    } else {
      this.pos.z = 2 * lipCross - myCross;
      this.vertAnchor.z = 2 * lipCross - anchorCross;
    }
    this.vertNormal.negate(); // the far pipe's wall faces the other way
    // ...and the coping tangent is derived FROM the normal (tx=-n.z, tz=n.x),
    // so the mirror flips it — negate the drift scalar too or the same
    // along-the-ridge momentum reverses world direction on the far side.
    this.vertLatVel = -this.vertLatVel;
    this.hangPipe = target;
    this.transferCoolT = 0.3;
    this.snapRenderInterpolation();
    this.score(CONST.ptsSpine, 'Spine Transfer');
    sfx.play('woosh2', 0.7);
    this.emitSparks(8, 0xa0e8ff, 2);
    return true;
  }

  // R2 pull-out: leave the glued vert cleanly in `out`'s direction — a small
  // outward hop that lands on regular ground (deck, platform, whatever's
  // there). Not a bail: the combo survives, you just roll away.
  private vertExit(out: THREE.Vector3, y: number): boolean {
    if (out.lengthSq() < 1e-6) return false;
    out.setY(0).normalize();
    this.pos.addScaledVector(out, 0.6);
    this.pos.y = y;
    this.vertAir = false;
    this.pipeHang = false;
    this.hangPipe = null;
    this.vertLatVel = 0;
    this.axisF.copy(out);
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.speed = Math.max(5, Math.abs(this.speed) * 0.5); // roll-out push (hang speed sits in vVel)
    this.vVel = Math.max(this.vVel, 2.5);
    this.state = 'air';
    this.grounded = false;
    this.airFromSkate = true;
    this.airGrav = 'board';
    this.pipeLandGraceT = 0.35; // a stale held direction must not brake the exit
    this.transferCoolT = 0.3;
    sfx.play('woosh2', 0.55);
    return true;
  }

  // Is another vert's mouth right behind this coping? (A spine/ridge stall —
  // two pipes sharing the lip line.) Tipping out the "back" there is not a
  // bail: you fall into the OTHER pipe and ride it out.
  private pipeBehindLip(level: Level): Halfpipe | null {
    const hp = this.lipPipe!;
    const px = this.pos.x + (hp.axis === 'z' ? this.lipSide * 0.9 : 0);
    const pz = this.pos.z + (hp.axis === 'z' ? 0 : this.lipSide * 0.9);
    for (const other of level.halfpipes) {
      if (other === hp) continue;
      const along = other.alongCoord(px, pz);
      if (along < Math.min(other.l0, other.l1) - 0.2) continue;
      if (along > Math.max(other.l0, other.l1) + 0.2) continue;
      if (Math.abs(other.crossCoord(px, pz) - other.cross) <= other.lipX - 0.3) return other;
    }
    return null;
  }

  // R2 out of a lip stall: step off the coping onto the DECK side, upright
  // and rolling — the deliberate cousin of lipBail (which is the punishment
  // for losing the needle).
  private lipExit(): void {
    const hp = this.lipPipe!;
    const out = this.lipSide; // away from the pipe centre
    if (hp.axis === 'z') {
      this.pos.x += out * 0.9;
      this.axisF.set(out, 0, 0);
    } else {
      this.pos.z += out * 0.9;
      this.axisF.set(0, 0, out);
    }
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.pos.y = hp.lipY + 0.1;
    this.lipStallT = 0;
    this.lipPipe = null;
    this.lipCoolT = 0.5;
    this.balance = 0;
    this.balanceCritT = 0;
    this.state = 'air';
    this.grounded = false;
    this.airFromSkate = true;
    this.airGrav = 'board';
    this.speed = 4;
    this.vVel = 2.5;
    this.pipeLandGraceT = 0.35;
    sfx.play('skateTransition', 0.5);
  }

  // Tipped out the BACK of the coping: the honest lip bail — ejected onto the
  // deck side, eating it wherever you come down.
  private lipBail(): void {
    const hp = this.lipPipe!;
    const out = this.lipSide; // away from the pipe centre
    if (hp.axis === 'z') {
      this.pos.x += out * 0.7;
      this.axisF.set(out, 0, 0);
    } else {
      this.pos.z += out * 0.7;
      this.axisF.set(0, 0, out);
    }
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.lipStallT = 0;
    this.lipPipe = null;
    this.lipCoolT = 0.5;
    this.balance = 0; // the needle is done — a stuck crit flag flails the arms forever
    this.balanceCritT = 0;
    this.state = 'air';
    this.grounded = false;
    this.bail(); // wipes the combo + flops (also zeroes velocity, so push after)
    this.speed = 2;
    this.vVel = 0.5;
  }

  // Drop off the coping into a pipe — by default the one you stalled on:
  // travel reverses vs the climb, so it's a fakie (flip the stance, absorb
  // the turn into the facing, same rule as the hang drop-in). Passing the
  // NEIGHBOURING pipe instead (a ridge stall tipping out the "back") rides
  // straight on through — same travel direction, so the stance stays.
  private lipDrop(jumped: boolean, hp: Halfpipe = this.lipPipe!): void {
    // toward the target pipe's centre along its cross axis
    const inward = Math.sign(hp.cross - hp.crossCoord(this.pos.x, this.pos.z)) || 1;
    if (hp.axis === 'z') this.pos.x += inward * 0.6;
    else this.pos.z += inward * 0.6;
    const ix = hp.axis === 'z' ? inward : 0;
    const iz = hp.axis === 'z' ? 0 : inward;
    const ridesOn = this.axisF.x * ix + this.axisF.z * iz > 0; // continuing the climb direction
    this.axisF.set(ix, 0, iz);
    this.pos.y = hp.lipY - 0.3;
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    if (!ridesOn) {
      const oldStance = this.stance;
      this.stance = -this.stance as 1 | -1;
      this.visualYaw = wrapAngle(this.visualYaw + oldStance * Math.PI * this.sidePose);
    }
    this.speed = 4;
    this.lipStallT = 0;
    this.lipCoolT = 0.5;
    this.lipPipe = null;
    this.balance = 0; // see lipBail: never leak a pegged needle out of the stall
    this.balanceCritT = 0;
    this.pipeRideT = 0.2; // dropping in: a re-crest is a pipe hang
    this.pipeLandGraceT = 0.35; // a stale held direction must not brake the drop
    if (jumped) {
      this.state = 'air';
      this.grounded = false;
      this.airFromSkate = true;
      this.airGrav = 'board';
      this.vVel = TUNING.grindJumpForce * 0.6;
      sfx.play('ollie', 0.6);
    } else {
      sfx.play('skateTransition', 0.45);
    }
  }

  // THE one combo-loss path. There are four ways to wipe out and two of them
  // (bailFromRail — the ONLY bail a grind can produce — and snapBoardFall) used
  // to drop the combo in total silence, so losing a twelve-trick rail line read
  // exactly like losing a bare hop.
  private loseCombo(): void {
    if (this.comboHasTrick && this.comboMult > 0) {
      // Freeze the exact combo before clearing gameplay state. The HUD may not
      // have rendered the final fixed step yet, so reusing its previous DOM
      // copy could make a same-frame bail show stale or empty text.
      this.onComboBail(
        sourceComboLabelLine(this.comboLabels),
        this.comboPoints,
        this.comboMult,
      );
    }
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
    this.comboUses.clear();
    this.deckTricksThisAir.clear();
    this.deckTricksThisCombo.clear();
    this.airGrabShown = null;
    this.special.wipe();
    this.clearSpecialMoves();
  }

  // Botched a grab landing: no death — you eat the floor, the pending combo
  // is gone, and you shoulder-roll back to motion once the tumble finds stable
  // ground. MASKED (a mask spent on a skating crash): the same wipeout at half
  // severity — the ragdoll still plays (no more alpha-flash absorb), but the
  // knockdown is short, the deck stays with you, and the combo survives the
  // tumble. That's what the mask buys now: continuity, not invisibility.
  /** Capture every planar motion channel before wipeout cancellation clears it. */
  private captureWipeoutVelocity(out: THREE.Vector3): boolean {
    const exactSlide =
      this.slideTimer > 0 &&
      this.slideSpd > 0.01 &&
      this.slideVec.lengthSq() > 0.01;
    const walkingMomentum =
      !this.freeSkate &&
      !this.airFromSkate &&
      !exactSlide &&
      this.walkVelocity.lengthSq() > 0.01;
    if (exactSlide) out.copy(this.slideVec).multiplyScalar(this.slideSpd);
    else if (walkingMomentum) out.copy(this.walkVelocity);
    else out.copy(this.axisF).multiplyScalar(this.speed);

    let vectorOwned = exactSlide || walkingMomentum;
    if (Math.abs(this.slideAirLat) > 0.01) {
      out.addScaledVector(this.axisL, this.slideAirLat);
      vectorOwned = true;
    }
    if (this.vertAir && Math.abs(this.vertLatVel) > 0.01) {
      out.x += -this.vertNormal.z * this.vertLatVel;
      out.z += this.vertNormal.x * this.vertLatVel;
      vectorOwned = true;
    }
    out.y = 0;
    return vectorOwned;
  }

  private cancelWipeoutActions(): void {
    // A wipeout owns every gameplay layer until recovery. Centralising this
    // matters because ordinary bails, snapped boards, rail falls, and PvP all
    // enter through different call sites; none may resume a stale move later.
    this.cancelSlideTraversal();
    if (this.grindRail) this.railLeft();
    this.grindRail = null;
    this.grindRun = null;
    this.grindCrate = null;
    this.railUnder = false;
    this.underK = 0;
    if (this.manualing !== 0) this.endManual();
    this.manualArmed = 0;
    this.manualArmT = 0;
    this.balance = 0;
    this.balanceVel = 0;
    this.balanceCritT = 0;
    this.lipStallT = 0;
    this.lipPipe = null;
    this.lipCoolT = Math.max(this.lipCoolT, 0.5);
    this.wallriding = false;
    this.wallBox = null;
    this.wallPath = null;
    this.wallrideLatched = false;
    this.wallChargeT = 0;
    this.vertAir = false;
    this.pipeHang = false;
    this.hangPipe = null;
    this.vertLatVel = 0;
    this.vertInDrift = 0;
    this.vertLaunchT = 0;
    this.vertLandGraceT = 0;
    this.pipeEndFly = false;
    this.rollOffT = 0;
    this.charging = false;
    this.chargePlanted = false;
    this.chargeTimer = 0;
    this.skateCharge = 0;
    this.jumpBufferT = 0;
    this.airTapT = 0;
    // A live spin used to remain an attacking hitbox underneath the ragdoll;
    // the angle also leaked into the eventual standing pose.
    this.spinTimer = 0;
    this.spinAngle = 0;
    this.airGrabShown = null;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.sketchyT = 0;
    this.flipTimer = 0;
    this.flipT = 0;
    this.boardOllieAir = false;
    this.ollieDeckTrickBufferT = 0;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.emergencyEjectUsed = false;
    this.emergencyEjectLandingPending = false;
    this.emergencyEjectLandingWillBail = false;
    this.deckTricksThisAir.clear();
    this.slamActive = false;
    this.slamHangT = 0;
    this.slamFlatT = 0;
    this.teetering = false;
    this.ropeObj = null;
    this.ledgeT = 0;
    this.ledgeMoverId = undefined;
    this.ledgeClimbQueued = false;
    this.hangClipName = null;
    this.hangExitW = 0;
    this.clearSpecialMoves();
  }

  private armBailRecovery(duration: number): void {
    // On-foot inertia, sideways slide-jumps, exact slides, and vert hang carry
    // live in world-vector channels rather than the course speed projection.
    const vectorOwned = this.captureWipeoutVelocity(BAIL_V);
    const planar = BAIL_V.length();
    if (vectorOwned && planar > 1e-4) {
      this.axisF.copy(BAIL_V).multiplyScalar(1 / planar);
      this.axisL.set(this.axisF.z, 0, -this.axisF.x);
      this.speed = planar;
    }
    this.cancelWipeoutActions();
    this.bailDownT = Math.max(0.05, duration);
    this.bailRecoverDuration = Math.min(BAIL_RECOVER_TIME, this.bailDownT);
    this.bailRecoverT = -1;
    this.bailRecoveryPose = 0;
    this.bailGroundT = 0;
    this.bailMash = 0;
    this.bailRush = 1;
    this.ragImpacts = 0;
    this.ragJumpAttemptImpact = 0;
    this.ragSteerAttemptImpact = 0;
    this.ragSteerInputLatched = false;
    this.ragFishJumps = 0;
    this.ragFlailKickT = 0;
    this.ragPoseAnchor.set(0, 0, 0);
    this.ragPoseAnchorW = 0;
    this.bailVelocity.copy(BAIL_V);
    this.bailExitSpeed = THREE.MathUtils.clamp(
      planar * BAIL_EXIT_CARRY,
      BAIL_EXIT_MIN,
      BAIL_EXIT_MAX,
    );
  }

  /** Split-screen knockdown: same recovery, without damage or a thrown deck. */
  beginPvpKnockdown(pop: number, sideSign: number): boolean {
    if (
      this.isBailing ||
      this.invulnTimer > 0 ||
      this.uberTimer > 0 ||
      this.state === 'dead' ||
      this.state === 'gameover'
    )
      return false;
    const hadBoard = this.freeSkate || this.airFromSkate;
    this.speed *= 0.3;
    if (!hadBoard) this.walkVelocity.multiplyScalar(0.3);
    this.slideSpd *= 0.3;
    this.slideAirLat *= 0.3;
    this.vertLatVel *= 0.3;
    this.vVel = pop;
    this.state = 'air';
    this.grounded = false;
    this.airFromSkate = false;
    this.airGrav = 'board';
    this.airMomentum = true;
    this.armBailRecovery(0.9);
    this.invulnTimer = Math.max(1.1, this.bailDownT + 0.15);
    this.invulnSilent = true;
    this.startRagdoll('side', sideSign);
    return true;
  }

  private bail(masked = false): void {
    // capture BEFORE the flags change hands: a bail out of skating throws the
    // deck; the same crash on foot has no deck to throw
    const hadBoard = this.freeSkate || this.airFromSkate;
    if (masked) {
      this.masks--;
      sfx.play('maskLoss', 0.9);
      this.emitSparks(8, 0xffd27a, 2);
    }
    // The knockdown scales with the crash: a walking-pace flop is the old
    // beat, a full-charge wreck stays down nearly a second longer (mash still
    // shortens it). The invuln grace is pinned to OUTLAST whatever we rolled —
    // its old fixed value only covered the fixed clock, and the last beat of
    // a longer, still-moving knockdown must not slide unprotected into a nitro.
    this.captureWipeoutVelocity(BAIL_V);
    const entryPlanar = BAIL_V.length();
    const bailDuration =
      (CONST.bailDownTime + Math.min(0.9, entryPlanar * 0.035)) *
      (masked ? 0.55 : 1);
    // Keep (a fraction of) the momentum instead of zeroing it: a 23 u/s crash
    // and a walking-pace crash should not be the same event. vVel is left alone
    // so the fall completes naturally rather than freeze-framing in the air.
    this.speed *= TUNING.bailSpeedKeep;
    if (!hadBoard) this.walkVelocity.multiplyScalar(TUNING.bailSpeedKeep);
    this.slideSpd *= TUNING.bailSpeedKeep;
    this.slideAirLat *= TUNING.bailSpeedKeep;
    this.vertLatVel *= TUNING.bailSpeedKeep;
    this.armBailRecovery(bailDuration);
    this.invulnTimer = Math.max(CONST.maskInvuln, this.bailDownT + 0.15);
    this.invulnSilent = true; // the ragdoll IS the indicator — no alpha flash
    if (masked) {
      // the combo lives through the knockdown, with a beat past the get-up
      // to continue the line
      this.comboTimer = Math.max(this.comboTimer, this.bailDownT + 1.0);
    } else {
      this.loseCombo();
    }
    sfx.play('takeDamage', 0.8);
    this.emitSparks(8, 0xffb545, 2);
    // Default tumble: chaotic, no preferred direction. Callers that know WHAT
    // went wrong re-seed right after with the flavor that sells it (a trip is
    // head-over-heels forward, a wall hit is backward, a rail bail rolls).
    this.startRagdoll('air');
    // A MASKED crash keeps the deck with you — the quick get-up rides on.
    if (hadBoard && !masked) {
      this.throwBoard();
      // The deck is over THERE. You get up on your feet and walk (or hold X
      // to call it back under you) — no silent auto-remount after a wreck.
      this.freeSkate = false;
      this.stepOff = true;
      this.slideFromWalk = true; // on-foot touchdown clamp: no skate takeover
    }
  }

  // Seed the tumble. `kind` picks which axis dominates — the crash should
  // visibly happen in the direction of the mistake — and everything gets a
  // random jitter on the other axes so no two wipeouts read the same.
  private startRagdoll(
    kind: 'forward' | 'back' | 'side' | 'air',
    sideSign = 0,
    poseSource: THREE.Object3D = this.bodyGroup,
  ): void {
    this.ragActive = true;
    this.ragBounces = 0;
    this.ragRollAcc = 0;
    this.ragSeedA = Math.random() * Math.PI * 2;
    this.ragSeedB = Math.random() * Math.PI * 2;
    // start the tumble exactly where the pose left the body — no snap
    poseSource.getWorldQuaternion(this.ragQ);
    if (poseSource !== this.bodyGroup && this.bodyGroup.parent) {
      poseSource.updateWorldMatrix(true, false);
      this.bodyGroup.parent.updateWorldMatrix(true, false);
      Player.RAG_AXIS.set(0, this.characterWaistLocal(0.82), 0)
        .applyMatrix4(poseSource.matrixWorld);
      this.ragPoseAnchor.copy(Player.RAG_AXIS);
      this.bodyGroup.parent.worldToLocal(this.ragPoseAnchor);
      this.ragPoseAnchorW = 1;
    } else {
      this.ragPoseAnchorW = 0;
    }
    const s = TUNING.ragSpin;
    // faster crash = faster tumble, saturating so a hyper-speed wreck stays readable
    const spd = 0.55 + Math.min(1.05, Math.abs(this.speed) * 0.045);
    const jit = (k: number): number => (Math.random() - 0.5) * k * s;
    // the pitch rate itself rolls dice — a fixed 9 made every forward trip
    // the same somersault; now some are lazy head-over-heels, some are violent
    // double-flips, and the widened yaw/roll jitter corkscrews a few of them
    if (kind === 'forward') this.ragAngVel.set((6.5 + Math.random() * 5) * spd * s, jit(5), jit(3.5));
    else if (kind === 'back') this.ragAngVel.set(-(5.5 + Math.random() * 4) * spd * s, jit(4), jit(2.5));
    else if (kind === 'side')
      this.ragAngVel.set(jit(2), jit(2.5), 8 * spd * s * (sideSign || (Math.random() < 0.5 ? -1 : 1)));
    else
      this.ragAngVel.set(
        (Math.random() < 0.5 ? -1 : 1) * 7 * spd * s,
        jit(4),
        jit(3),
      );
    const shoulder =
      kind === 'side' && sideSign !== 0
        ? sideSign
        : Math.abs(this.ragAngVel.z) > 0.35
          ? this.ragAngVel.z
          : Math.sin(this.ragSeedA);
    this.bailRecoverSide = (shoulder >= 0 ? 1 : -1) as -1 | 1;
  }

  // The deck leaves her feet and goes bouncing off on its own — the single
  // best "that went wrong" read a skate wipeout has. A lazy world-space clone
  // of the real board (shared geometry + materials); the real one hides behind
  // boardSnapT, exactly like the under-rail snap always did, and comes back in
  // hand when the get-up ends.
  private throwBoard(inheritFlight = false): void {
    if (!this.boardG) return;
    if (!this.flyBoard) {
      this.flyBoard = this.boardG.clone(true);
      this.flyBoard.name = 'flyboard';
      (this.group.parent ?? this.group).add(this.flyBoard);
    }
    const fb = this.flyBoard;
    this.boardG.getWorldPosition(fb.position);
    this.boardG.getWorldQuaternion(fb.quaternion);
    this.boardG.getWorldScale(fb.scale);
    fb.scale.y = fb.scale.x; // uniform: a spinning deck must not squash
    fb.visible = true;
    const dir = Math.sign(this.speed || 1);
    if (inheritFlight) {
      // Emergency eject: the independently simulated deck inherits the exact
      // pre-eject flight. Its angular throw is deterministic too.
      this.flyBoardVel.set(
        this.axisF.x * this.speed,
        this.vVel,
        this.axisF.z * this.speed,
      );
      this.flyBoardAng.set(2.8, dir * 9, -1.8);
    } else {
      // Seeded because loose-board translation is part of deterministic run
      // state even though proximity can no longer remount the rider.
      this.flyBoardVel.set(
        this.axisF.x * this.speed * 0.8 + (this.simRand() - 0.5) * 2,
        Math.max(this.vVel * 0.4, 0) + 4.2 + this.simRand() * 1.6,
        this.axisF.z * this.speed * 0.8 + (this.simRand() - 0.5) * 2,
      );
      // The tumble itself is cosmetic; rotation never feeds translation.
      this.flyBoardAng.set(
        (Math.random() - 0.5) * 18,
        dir * (10 + Math.random() * 8),
        (Math.random() - 0.5) * 18,
      );
    }
    this.flyBoardT = 30; // generous cap: it lies there until deliberate recall
    this.flyBoardRest = false;
    this.boardSnapT = Math.max(this.boardSnapT, this.bailDownT + 0.5); // real deck hides meanwhile
  }

  // Ballistic deck: gravity, a couple of restitution bounces off the same
  // ground query the player uses, then it lies where it fell until the get-up
  // calls it back. Runs even while the player is dead — a board mid-air when
  // the body hits a pit should still finish its arc.
  private updateFlyBoard(dt: number, level: Level): void {
    const fb = this.flyBoard;
    if (!fb || !fb.visible) return;
    this.flyBoardT -= dt;
    // The deck lies where it fell until you're back ON a board — the get-up
    // is on foot now, so remounting (hold X) is what calls it back to your
    // feet. A long cap tidies up a deck abandoned far away.
    if (this.freeSkate || this.state === 'grind' || this.flyBoardT <= 0) {
      fb.visible = false; // the real one is back underfoot
      return;
    }
    if (this.flyBoardRest) return;
    this.flyBoardVel.y -= 24 * dt;
    fb.position.addScaledVector(this.flyBoardVel, dt);
    fb.rotation.x += this.flyBoardAng.x * dt;
    fb.rotation.y += this.flyBoardAng.y * dt;
    fb.rotation.z += this.flyBoardAng.z * dt;
    const g = this.queryGround(level, fb.position.x - this.pos.x, fb.position.z - this.pos.z);
    if (g !== null && this.flyBoardVel.y < 0 && fb.position.y <= g.y + 0.06) {
      fb.position.y = g.y + 0.06;
      if (-this.flyBoardVel.y > 2.2) {
        this.flyBoardVel.y = -this.flyBoardVel.y * 0.45;
        this.flyBoardVel.x *= 0.6;
        this.flyBoardVel.z *= 0.6;
        this.flyBoardAng.multiplyScalar(0.55);
        sfx.play('skateHalt', 0.25, 1.3 + Math.random() * 0.3); // clatter
      } else {
        // Settle onto whichever BROAD face is already nearer the ground. The
        // previous x/z zero forced every throw grip-side-up, erasing the final
        // attitude even though the flight itself was deterministic.
        this.flyBoardRest = true;
        const up = new THREE.Vector3(0, 1, 0);
        const targetUp = up.clone();
        const broadUp = up.clone().applyQuaternion(fb.quaternion);
        if (broadUp.y < 0) targetUp.negate();
        const forward = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(fb.quaternion);
        forward.y = 0;
        if (forward.lengthSq() <= 1e-6) {
          const right = new THREE.Vector3(1, 0, 0)
            .applyQuaternion(fb.quaternion);
          right.y = 0;
          if (right.lengthSq() > 1e-6)
            forward.crossVectors(right.normalize(), targetUp);
          else forward.set(Math.sin(fb.rotation.y), 0, Math.cos(fb.rotation.y));
        }
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(targetUp, forward).normalize();
        const settledUp = new THREE.Vector3().crossVectors(forward, right).normalize();
        fb.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(right, settledUp, forward),
        );
        // Unity's loose-board presentation lifts an artwork-up deck by its
        // actual kicked/concave bounds. Without this, the new continuous deck
        // sinks almost a quarter metre through the floor when it lands upside
        // down because its root is the wheel-contact pivot, not mesh centre.
        fb.position.y =
          g.y + Math.max(0.06, skateboardRestingPivotLift(fb, fb.quaternion));
        this.flyBoardAng.set(0, 0, 0);
        sfx.play('skateHalt', 0.18, 1.5);
      }
    }
  }

  private stepGrind(dt: number, input: Input, level: Level): void {
    const rail = this.grindRail!;
    this.grindTime += dt;
    level.grindRope(rail); // sky-bridge ropes: grinding one makes it sag, wobble, and eventually snap
    this.snapEase = Math.min(1, this.snapEase + dt / CONST.railSnapEase);
    // THPS3+ TRICK SWITCHING: a fresh Triangle press mid-grind re-reads the
    // stick and swaps the trick in place — a new plate entry (repeat decay
    // keeps it honest), a jolt through the needle, and the pose follows.
    if (input.grindPressed && this.grindTime > 0.2 && this.lipStallT <= 0) {
      const prev = this.grindStyle;
      const prevYaw = this.grindYawDir;
      const prevSpecial = this.specialGrind;
      const nextSpecial = this.pendingSpecialGrind;
      if (nextSpecial) {
        this.specialGrind = nextSpecial;
        this.grindStyle = 'board';
        this.grindYawDir = this.rawInput.moveX >= 0 ? 1 : -1;
      } else {
        this.specialGrind = null;
        this.pickGrindStyle(false);
      }
      if (nextSpecial || this.grindStyle !== prev || prevSpecial !== null) {
        if (nextSpecial) {
          this.pendingSpecialGrind = null;
          this.confirmSpecial(nextSpecial);
        }
        this.score(
          nextSpecial?.points ?? Math.round(CONST.ptsGrindBase * GRIND_MULTS[this.grindStyle]),
          this.grindTrickName(),
        );
        this.surfaceName = 'rail (' + this.grindTrickName() + ')';
        this.balanceVel += (this.simRand() < 0.5 ? -1 : 1) * 0.3; // the swap rocks the needle
        this.emitSparks(4, 0xffb545, 1.2);
        sfx.play('railLand', 0.45, 1.25);
      } else {
        this.specialGrind = prevSpecial;
        this.grindStyle = prev;
        this.grindYawDir = prevYaw; // a same-style re-press must not silently flip the crosswise pose
      }
    }
    // A RAIL HOLDS THE SPEED YOU BROUGHT. Flat bar, no cost — only the slope
    // below can take speed off you. (It used to scrub a flat second-by-second
    // whatever you did, which quietly made long rails unridable: the bleed
    // dragged you toward the floor speed, and a slow grind wobbles HARDER
    // (see speedFactor), so a long crossing spiralled into a bail no matter
    // how well it was balanced. The jungle's fallen trunk needed a near-top-
    // speed entry to survive at all.) grindDrag puts that friction back for
    // anyone who wants it — 0 by default, and still weighted per style so a
    // crosswise slide scrubs more than a nose.
    if (TUNING.grindDrag > 0) {
      const drag =
        this.grindStyle === 'nose'
          ? TUNING.grindDrag * 0.4
          : this.grindStyle === 'crook'
            ? TUNING.grindDrag * 0.55
            : TUNING.grindDrag;
      this.grindVel = Math.max(CONST.grindMinSpeed, this.grindVel - drag * dt);
    }
    // SLOPED RAILS: gravity works the grind line — descending segments feed
    // speed, climbs bleed it (the same knobs as ground slopes), capped like
    // any earned downhill. tangent.y IS sin(slope) on a unit tangent.
    const railSlope = rail.tangentAt(this.grindT).y * this.grindDir; // + = climbing
    if (Math.abs(railSlope) > 1e-3) {
      this.grindVel -= railSlope * TUNING.groundGravity * dt;
      this.grindVel = THREE.MathUtils.clamp(this.grindVel, CONST.grindMinSpeed, TUNING.downhillMax);
    }

    // THPS balance: the needle is an unstable equilibrium that runs away from
    // center, ramping up the longer you grind — but only after a settle-in
    // grace, so there's no hidden "max grind length" booting you off long
    // rails. Left/right input fights it; slow grinds are somewhat wobblier.
    // Pegging the meter starts a short CRITICAL beat — slam the stick the
    // other way and you can still save it — before the bail.
    // The third-mask uber locks the needle dead center.
    const rawSpeedFactor = THREE.MathUtils.clamp(
      TUNING.grindSpeed / Math.max(this.grindVel, 1),
      0.6,
      1.5,
    );
    // How much grind speed matters to the needle at all (slider): 0 = not at
    // all, 1 = slow grinds wobble the full amount, higher = exaggerated.
    const speedFactor = 1 + (rawSpeedFactor - 1) * TUNING.balanceSpeedEffect;
    // the crosswise slides look coolest and wobble hardest; the truck-balanced
    // diagonals (Smith/Feeble) sit in between
    const styleWobble =
      this.specialGrind
        ? 1.45
        : this.grindStyle === 'lip'
        ? 1.35
        : this.grindStyle === 'board'
          ? 1.25
          : this.grindStyle === 'smith' || this.grindStyle === 'feeble'
            ? 1.15
            : 1;
    // Difficulty ramps with grind length: flat for balanceGrace seconds,
    // then grows at balanceRamp per second up to the balanceRampMax ceiling —
    // marathon grinds get dicey, never impossible.
    const ramp = Math.min(
      Math.max(0, TUNING.balanceRampMax - 1),
      Math.max(0, this.grindTime - TUNING.balanceGrace) * TUNING.balanceRamp,
    );
    const instability = TUNING.balanceDrift * (1 + ramp) * speedFactor * styleWobble;
    const runSign = Math.sign(this.balance || 1);
    // Left/right fights the needle — everywhere, the classic. Two guards
    // keep a MOMENTUM entry honest (side-scroll rails: you necessarily hold
    // the travel direction to make the hop, and that same direction used to
    // shove the needle at full force the frame you caught the bar):
    //  * the STALE HOLD — the direction already down at the catch — never
    //    pushes OUTWARD: it can steady you back toward center but can't
    //    fling you past it. Let go once (or flip) and it's a live
    //    correction with full authority, like any fresh press.
    //  * the entry calm beat (grindCalmT, bought by speed carried along the
    //    bar) wakes the drift up gradually instead of at full boil.
    const mx = this.rawInput.moveX;
    if (
      this.grindStickStale !== 0 &&
      (Math.abs(mx) < 0.3 || Math.sign(mx) !== this.grindStickStale)
    )
      this.grindStickStale = 0; // released or flipped: the stick is yours again
    const staleOut =
      this.grindStickStale !== 0 && Math.sign(mx) === Math.sign(this.balance || mx);
    const calm =
      this.grindCalmT > 0 ? Math.min(1, this.grindTime / this.grindCalmT) : 1;
    let control = (staleOut ? 0 : mx) * TUNING.balanceControl;
    control *= this.safeGain(this.grindTime, control, runSign);
    this.stepBalanceCore(dt, runSign, instability * calm, control, ramp);
    if (this.uberTimer > 0 || this.balanceBoostT > 0) {
      this.balance = 0;
      this.balanceVel = 0;
    } // perfect balance
    if (Math.abs(this.balance) >= 1) {
      this.balance = Math.sign(this.balance); // pinned at the edge, flailing
      if (Math.sign(this.balanceVel) === this.balance) this.balanceVel = 0; // kill outward momentum: a counter-tap can still save it
      this.balanceCritT += dt;
      if (this.balanceCritT > TUNING.bailGrace) {
        // NO MASK SAVE. A mask is armour against things that hit you; falling
        // off a rail is a skill you did not execute, and letting a mask undo
        // it meant the balance meter had no teeth while you were holding one.
        // The third-mask invincibility (uberTimer) still pins the needle at
        // zero further up, so being genuinely invincible still can't bail.
        if (this.railUnder) {
          // hanging underneath, the grip is all there is: the board SNAPS and
          // you drop straight off — ground below breaks the fall, a pit doesn't
          this.snapBoardFall();
          return;
        } else if (this.railFallSide(level) === 'vert') {
          // The needle threw us INTO the transition — that's not a crash,
          // it's the grind ending: drop in and keep riding the line.
          this.dropOffRail();
          return;
        } else {
          // thrown toward the deck / uphill side: the honest bail — and the
          // tumble goes to the SIDE the needle pegged, not down the rail
          this.bailFromRail(Math.sign(this.balance || 1), level);
          return;
        }
      }
    } else {
      this.balanceCritT = 0;
    }

    // UNDER-RAIL HANG: Circle swings you beneath the rail (board held
    // crosswise in both hands) and back up — a committed swing each way, on a
    // cooldown so it can't be spammed. Going under needs clear air below;
    // while under, rising terrain pops you back on top before it clips.
    if (input.grabPressed && this.underCoolT <= 0) {
      if (this.railUnder) {
        this.railUnder = false;
        this.underCoolT = TUNING.underRailCooldown;
        sfx.play('woosh', 0.5, 1.15);
      } else if (this.underClearance(rail, level)) {
        this.railUnder = true;
        this.grindUsedUnder = true;
        this.underCoolT = TUNING.underRailCooldown;
        this.underProbeT = 0;
        this.score(140, 'Under-Rail');
        sfx.play('woosh2', 0.55, 0.9);
      } else {
        sfx.play('skateHalt', 0.2, 1.5); // no room below: the press just clicks off
      }
    }
    this.underK = THREE.MathUtils.clamp(
      this.underK + (this.railUnder ? 1 : -1) * (dt / UNDER_RAIL_SWING),
      0,
      1,
    );
    if (this.railUnder && this.underK >= 1) {
      this.underProbeT += dt;
      if (this.underProbeT >= 0.15) {
        this.underProbeT = 0;
        if (!this.underClearance(rail, level)) {
          this.railUnder = false; // terrain rose to meet the feet: free auto-return
          sfx.play('woosh', 0.4, 1.2);
        }
      }
    }

    this.grindT += this.grindDir * this.grindVel * dt;

    if (this.grindT <= 0 || this.grindT >= rail.totalLength) {
      // Ran off the end of the rail: small pop, keep carrying grind speed.
      this.grindT = THREE.MathUtils.clamp(this.grindT, 0, rail.totalLength);
      this.placeOnRail(rail);
      // One last look at what is underfoot before the exit: running off the
      // end must still retire the box you rode off AND the one you finish on,
      // or a full-length grind quietly leaves the last of them standing.
      this.tickGrindCrate(level);
      this.completeGrindosaurusRun(rail, level);
      const perfect = this.perfectGrindRun(rail, level);
      this.exitGrind(this.underK > 0.5 ? 0.8 : 2.5, level); // from under, no pop up through the rail
      if (perfect) this.applyPerfectGrind();
      return;
    }

    this.placeOnRail(rail);
    this.tickGrindCrate(level);
    this.speed = this.grindVel;
    this.surfaceName = 'rail (' + this.grindTrickName() + ')';
    // THPS accrual: the longer the grind, the more the combo is worth.
    this.grindTickT += dt;
    while (this.grindTickT >= 0.25) {
      this.grindTickT -= 0.25;
      this.comboPoints += CONST.ptsGrindTick;
      this.special.award(CONST.ptsGrindTick);
      this.comboTimer = CONST.comboWindow;
    }
    this.groundHit = this.queryGround(level); // keeps the blob shadow honest
    // (grind sparks now stream from the puff system's distance trail — see
    // updatePuffs — so nothing is emitted per-frame here)

    if (input.jumpHeld) {
      this.charging = true;
      this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
    }
    if (input.jumpReleased && this.charging) {
      const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
      this.charging = false;
      this.chargeTimer = 0;
      this.lastJumpType = this.underK > 0.5 ? 'Under-Rail Drop' : 'Grind Exit';
      sfx.play('ollie', 0.7);
      const perfect = this.perfectGrindRun(rail, level);
      // from underneath, X lets go — a small drop away, never a pop up
      // through the rail overhead
      this.exitGrind(
        this.underK > 0.5
          ? 1.0
          : THREE.MathUtils.lerp(TUNING.grindJumpForce * 0.72, TUNING.grindJumpForce, t),
        level,
      );
      if (perfect) this.applyPerfectGrind();
      // grind exits are board airs: no somersault
    }
  }

  private stepFinished(dt: number, level: Level): void {
    this.speed = Math.max(0, this.speed - 40 * dt);
    // Coast on through along the course's travel axis — sideways levels (and
    // rotated gates) finish eastbound/westbound, not always -z.
    this.pos.addScaledVector(this.axisF, this.speed * dt);
    // Keep the outro on the deck: no sliding sideways off the edge into a
    // midair hover after the run is already over. Clamp across the gate's
    // WIDE axis (post to post), whichever world axis that is after its yaw.
    const fb = level.finishBox;
    if (fb.max.x - fb.min.x >= fb.max.z - fb.min.z) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, fb.min.x + 1.5, fb.max.x - 1.5);
    } else {
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, fb.min.z + 1.5, fb.max.z - 1.5);
    }
    if (this.pos.z < level.endWallZ + 1) {
      this.pos.z = level.endWallZ + 1;
      this.speed = 0;
    }
    const hit = this.queryGround(level);
    if (hit) {
      this.pos.y = hit.y;
      this.groundHit = hit;
    }
  }

  // ----------------------------------------------------------------- grind --

  // Record the rail we are leaving, and latch the grind button so a Triangle
  // that is still down cannot immediately put us back on it. Called from every
  // exit (clean, drop-off, board snap, bail) before grindRail is cleared.
  private railLeft(): void {
    this.grindRun = null; // the ledge is a solid box again
    this.grindCrate = null;
    this.lastRail = this.grindRail;
    this.grindLatched = true;
    this.specialGrind = null;
  }

  private tryGrind(pressed: boolean, level: Level): boolean {
    // A flopped bail can't grab a rail — the lip bail ejects you right over
    // the coping with Triangle still held, and snapping it would turn the
    // punishment into a free 50-50.
    if (this.regrindCd > 0 || this.isBailing || this.specialGrab !== null || !this.railCand)
      return false;
    if (
      level.isTrickRail(this.railCand.rail) &&
      !this.freeSkate &&
      !this.airFromSkate &&
      !!this.flyBoard?.visible
    )
      return false;
    // A HELD Triangle catches rails on approach — you should not have to time
    // the press — but it must not re-catch the rail you just came OFF. Running
    // off the end of a short rail (the jungle log) leaves you inside that
    // rail's own snap radius with the button still down: it snapped straight
    // back on, ran off the end again, and snapped back, over and over, and you
    // could not fall off it at all. A fresh PRESS still re-grabs immediately;
    // a hold has to let go once. Only the rail you left is blocked, so holding
    // Triangle through a rail-to-rail transfer is untouched.
    if (!pressed && this.grindLatched && this.railCand.rail === this.lastRail) return false;
    // railCand was sampled at the START of this step; re-close on the CURRENT
    // position so a fast step snaps onto the point actually under our feet,
    // not where we were 1-2 units ago.
    const s = this.railCand.rail.closest(this.pos);
    if (s.distance > TUNING.railSnapDistance) return false;
    // Deck-level grabs are the normal case (rails sit ~1u above the deck);
    // only block grabbing from far beneath the rail.
    if (this.pos.y < s.point.y - 2.0) return false;
    // Reviewed production margin: a MOVING approach must have enough velocity
    // along the rail to be meaningfully away from a square/perpendicular hit.
    // `sin(degrees)` is the along-rail alignment at that offset from 90°.
    // Exact zero restores the web/source behavior; stationary catches have no
    // approach angle and remain eligible. Latch a held rejection so solid-rail
    // blocking cannot turn it into a stationary catch on the following tick.
    const approach = Math.hypot(this.lastVelX, this.lastVelZ);
    const railPlanar = Math.hypot(s.tangent.x, s.tangent.z);
    if (approach > 1e-4 && railPlanar > 1e-4) {
      const alignment = Math.abs(
        (this.lastVelX * s.tangent.x + this.lastVelZ * s.tangent.z) /
          (approach * railPlanar),
      );
      const minimumAlignment = Math.sin(
        THREE.MathUtils.degToRad(TUNING.grindApproachMargin),
      );
      if (alignment + 1e-6 < minimumAlignment) {
        this.lastRail = this.railCand.rail;
        this.grindLatched = this.rawInput.grindHeld;
        return false;
      }
    }
    this.enterGrind(this.railCand.rail, s, level);
    return true;
  }

  // The 8-way stick read shared by grind ENTRY and the mid-grind trick
  // switch. overTop only means something at entry (a sideways catch after
  // crossing the line is a Lipslide); a mid-grind sideways switch is always
  // the Boardslide.
  private pickGrindStyle(overTop: boolean): void {
    const rIn = this.rawInput;
    const mxA = Math.abs(rIn.moveX) > 0.4;
    if (rIn.moveY > 0.4) this.grindStyle = mxA ? 'crook' : 'nose';
    else if (rIn.moveY < -0.4)
      this.grindStyle = mxA ? (rIn.moveX < 0 ? 'smith' : 'feeble') : 'five0';
    else if (mxA) this.grindStyle = overTop ? 'lip' : 'board';
    else this.grindStyle = 'normal';
    this.grindYawDir = rIn.moveX >= 0 ? 1 : -1;
  }

  private enterGrind(rail: Rail, sample: RailSample, level?: Level): void {
    this.boardOllieAir = false;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.deckTricksThisAir.clear();
    this.grindRail = rail;
    const run = level ? level.crateRunFor(rail) : null;
    this.grindRun = run ? new Set(run) : null;
    this.grindT = sample.t;
    this.grindEntryT = sample.t;
    // The air that ended on this rail is over: retire its slide-jump launch.
    // These only cleared on a wheels-down landing, so grinding out of a
    // slide-jump carried the cross-heading drift and the air-steer lockout
    // into the air off the END of the rail — which also silently disabled the
    // rail-hop strafe that exitGrind arms.
    this.slideAirLat = 0;
    this.slideJumpAir = false;
    // How much of our actual velocity runs ALONG the rail. Free-heading skate
    // lets you meet a rail at any angle — a perpendicular clip should give a
    // gentle grind, never rocket you down the rail at full cross-speed.
    const worldVx = this.axisF.x * this.speed;
    const worldVz = this.axisF.z * this.speed;
    const alongVel = worldVx * sample.tangent.x + worldVz * sample.tangent.z;
    this.grindDir = alongVel >= 0 ? 1 : -1;
    this.state = 'grind';
    this.grounded = false;
    this.vVel = 0;
    this.coyoteTimer = 0;
    this.crawling = false;
    this.slamActive = false;
    this.slamHangT = 0;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    // A rotation carried INTO the rail is a landed trick, and the rail is
    // ridden the way you arrive: nearest the 180 line = the stance flips
    // (a fakie/switch grind) instead of snapping the body back to regular.
    // Hopping rail-to-rail with a 180 has to LOOK — and score — like a 180;
    // zeroing the spin silently erased the whole move.
    if (Math.abs(this.grabSpinAngle) > 0.02) {
      const TAU = Math.PI * 2;
      const a2 = ((this.grabSpinAngle % TAU) + TAU) % TAU;
      const isSwitch = Math.abs(a2 - Math.PI) < Math.min(a2, TAU - a2);
      if (isSwitch) this.stance = -this.stance as 1 | -1; // caught the rail riding fakie
      const halves = Math.round(Math.abs(this.grabSpinAngle) / Math.PI);
      if (halves >= 1)
        this.score(halves * CONST.ptsSpin, `${isSwitch ? 'Switch ' : ''}${halves * 180}°`);
      // absorb the rotation into the facing yaw — zeroing the spin must not
      // unwind the body (same fold as the ground landing, incl. the stance
      // flip's ±90° side term)
      this.visualYaw = wrapAngle(
        this.visualYaw +
          this.grabSpinAngle +
          (isSwitch ? -this.stance * Math.PI * this.sidePose : 0),
      );
    }
    this.grabSpinAngle = 0;
    this.grindTime = 0;
    // Grind trick from the stick at entry (THPS3+ vocabulary):
    // up = Nosegrind, down = 5-0, up-diagonal = Crooked, down-left = Smith,
    // down-right = Feeble, sideways = Boardslide — or LIPSLIDE when you came
    // over the TOP of the rail (already crossed the line when you caught it),
    // neutral = 50-50.
    const perpX = sample.tangent.z;
    const perpZ = -sample.tangent.x;
    const sideNow = (this.pos.x - sample.point.x) * perpX + (this.pos.z - sample.point.z) * perpZ;
    const crossVel = worldVx * perpX + worldVz * perpZ;
    // still travelling toward the line from your own side = boardslide;
    // caught it moving AWAY from the line = you crossed over it = lipslide
    const overTop = sideNow * crossVel > 0.01;
    this.pickGrindStyle(overTop);
    const entrySpecial = this.pendingSpecialGrind;
    this.specialGrind = entrySpecial;
    if (entrySpecial) {
      this.pendingSpecialGrind = null;
      this.grindStyle = 'board';
      this.grindYawDir = this.rawInput.moveX >= 0 ? 1 : -1;
      this.confirmSpecial(entrySpecial);
    }
    this.grindTickT = 0;
    this.railUnder = false; // every grind starts on top (the switch cooldown carries over)
    this.underK = 0;
    this.grindUsedUnder = false;
    this.underProbeT = 0;
    this.floatAir = false; // the ramp-launch tag dies here — a rail exit re-declares its own air
    this.flipT = 0; // a deck that caught a rail mid-flip is ON the rail — no corkscrew, no late score
    this.specialFlip = null;
    this.flipDuration = CONST.flipTime;
    this.specialGrab = null;
    this.specialGrabT = 0;
    this.specialGrabLanding = false;
    this.pipeEndFly = false; // a rail catch SAVES a pipe-end fly-off
    this.rollOffT = 0;
    this.grindExitAir = false; // (re-set by the next exit — the hop window is per-air)
    // The trick is scored the moment you lock in — the rail then RACKS UP
    // points for as long as you hold it (see stepGrind), THPS-style.
    this.score(
      entrySpecial?.points ?? Math.round(CONST.ptsGrindBase * GRIND_MULTS[this.grindStyle]),
      this.grindTrickName(),
    );
    // Start the needle slightly off-center in a random direction, at rest, with
    // a fresh sketch phase so the wander never repeats across attempts.
    this.balance = (this.simRand() < 0.5 ? -1 : 1) * CONST.balanceStart;
    this.balanceVel = 0;
    this.balanceCritT = 0;
    this.noisePhase = this.simRand() * Math.PI * 2;
    // MOMENTUM STEADIES THE CATCH: speed carried along the bar buys a calm
    // beat where the needle stays quiet, so a committed fast entry starts
    // planted instead of instantly tipping. And the direction you were
    // ALREADY holding on the way in (on a side-scroll stretch you hold
    // toward the rail just to make the hop) never counts as a lean — it
    // goes dead until it comes back to neutral once.
    this.grindCalmT =
      TUNING.grindCalm > 0
        ? Math.max(0.12, Math.min(1, Math.abs(alongVel) / 10) * TUNING.grindCalm)
        : 0;
    this.grindStickStale =
      Math.abs(this.rawInput.moveX) > 0.3 ? Math.sign(this.rawInput.moveX) : 0;
    // landing-on-the-rail burst: one bright spray of the same sparks the
    // grind itself will now stream
    PUFF_DIR.set(-this.axisF.x * Math.sign(this.speed || 1), 0.5, -this.axisF.z * Math.sign(this.speed || 1));
    puffs.burst('spark', this.pos.x, this.pos.y + 0.06, this.pos.z, {
      dir: PUFF_DIR,
      strength: Math.min(1.6, 0.8 + Math.abs(this.speed) / 20),
    });
    sfx.play('railLand', 0.8);
    // THPS SPEED-KEEP: the rail REDIRECTS the speed you brought instead of
    // dispensing its own. A clean aligned hit keeps everything; a hard
    // sideways clip is blended down toward the along component (a boardslide
    // still slides at real pace, it doesn't rocket) — but slow entry = slow
    // grind, and only DOWNHILL rails add speed (slope gravity in stepGrind).
    // railSpeedBoost survives as a 0-default slider for anyone who wants the
    // old gear-change gift back.
    const planarIn = Math.abs(this.speed);
    const alongFrac = planarIn > 0.01 ? Math.min(1, Math.abs(alongVel) / planarIn) : 1;
    this.grindVel = THREE.MathUtils.clamp(
      planarIn * (0.72 + 0.28 * alongFrac) + TUNING.railSpeedBoost,
      CONST.grindMinSpeed,
      TUNING.downhillMax,
    );
    this.speed = this.grindVel;
    // Remember how far off the rail the body was at entry; placeOnRail eases
    // it to zero so the snap reads as a quick glide, not a teleport.
    this.snapOffset.set(
      this.pos.x - sample.point.x,
      this.pos.y - (sample.point.y + CONST.railRideHeight),
      this.pos.z - sample.point.z,
    );
    this.snapEase = 0;
    this.placeOnRail(rail);
  }

  private placeOnRail(rail: Rail): void {
    const p = rail.pointAt(this.grindT);
    this.pos.set(p.x, p.y + CONST.railRideHeight, p.z);
    // Under-rail hang: the body swings to hands-overhead beneath the line
    // (underK eases through the committed switch, so this is the animation).
    if (this.underK > 0) {
      const k = this.underK * this.underK * (3 - 2 * this.underK); // smoothstep swing
      this.pos.y -= k * (UNDER_RAIL_DEPTH + CONST.railRideHeight);
    }
    // Glide onto the rail: the entry offset eases away over railSnapEase
    // seconds instead of yanking the body sideways in a single frame.
    if (this.snapEase < 1) {
      const k = 1 - this.snapEase;
      this.pos.addScaledVector(this.snapOffset, k * k); // ease-out
    }
  }

  // A PERFECT GRIND: on at one end of the rail, off at the other, no bail.
  // Measured as ground covered rather than "did you touch both tips", so a
  // curved or sloped rail counts the same and the snap-on tolerance at entry
  // doesn't rob you of the reward you actually earned.
  private perfectGrindRun(rail: Rail, level: Level): boolean {
    if (rail.totalLength <= 0) return false;
    const coverage = Math.abs(this.grindT - this.grindEntryT) / rail.totalLength;
    if (!level.perfectGrindBoost) return false;
    return coverage >= 0.9;
  }

  private completeGrindosaurusRun(rail: Rail, level: Level): void {
    const value = level.grindosaurusFor(rail);
    if (
      !value?.alive ||
      this.railUnder ||
      this.underK > 1e-4 ||
      this.grindUsedUnder
    )
      return;
    const coverage = Math.abs(this.grindT - this.grindEntryT) / rail.totalLength;
    if (coverage + 1e-6 < value.requiredCoverage) return;
    level.defeatGrindosaurus(value);
    this.score(CONST.ptsEnemy * 2, 'Grindosaurus');
  }

  // Pay it out. Must run AFTER exitGrind, which resets speed to the grind
  // velocity on its way off the rail and would otherwise eat this.
  private applyPerfectGrind(): void {
    this.speed = TUNING.perfectGrindSpeed;
    this.grindBoostT = TUNING.perfectGrindHold;
    this.emitSparks(16, 0x8ce8ff, 3);
    sfx.play('crystalGet', 0.7, 1.5);
  }

  // Which box of the ledge is under us right now — and the moment that
  // changes, the one we just rode off breaks.
  private tickGrindCrate(level: Level): void {
    if (this.grindRun === null) return;
    let best: Crate | null = null;
    let bestD = Infinity;
    for (const c of this.grindRun) {
      if (!c.alive || c.pending) continue;
      const dx = c.mesh.position.x - this.pos.x;
      const dz = c.mesh.position.z - this.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best === this.grindCrate) return;
    if (this.grindCrate) level.smashGrindCrate(this.grindCrate);
    this.grindCrate = best;
  }

  private exitGrind(vVel: number, level?: Level): void {
    this.airFromSkate = true; // leaving a rail is a board air: tricks live
    this.airGrav = 'board';
    // RAIL-HOP window: R2 may add lateral transfer strafe on top of the spin
    // so you can deliberately jump between rails. Without R2 the hop stays
    // ballistic and left/right rotates only, like every other board air.
    this.grindExitAir = true;

    // ...and the last box goes with the manoeuvre. Every earlier one already
    // broke as the rider cleared it (tickGrindCrate); this is the one still
    // underfoot when the grind ends.
    if (level && this.grindCrate) level.smashGrindCrate(this.grindCrate);
    this.grindCrate = null;

    if (this.grindRail) {
      // Exit ALONG the rail: the tangent becomes the free-skate heading, so
      // diagonal and curved rails launch you where they were pointing.
      const t = this.grindRail.tangentAt(this.grindT);
      const hx = t.x * this.grindDir;
      const hz = t.z * this.grindDir;
      const len = Math.hypot(hx, hz);
      // DOWNHILL RAIL HOP: the same float the downhill ollie had. The rail
      // (and the road under it) keeps dropping away beneath a flat pop, so
      // hops off a descending grind bought seconds of hangtime. Fold the
      // descent rate into the pop (same knob, same floor) and keep the
      // snappy gravity — flat and climbing rails are untouched.
      const desc = Math.min(0, t.y * this.grindDir * this.grindVel);
      if (desc < -0.5) {
        vVel = Math.max(vVel * 0.45, vVel + desc * TUNING.ollieDownCouple);
        this.floatAir = false;
      }
      if (len > 0.05) {
        this.axisF.set(hx / len, 0, hz / len);
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
        this.speed = this.grindVel;
        this.freeSkate = true;
      } else {
        // near-vertical tangent (shouldn't happen): keep the old projection
        const along = (t.x * this.axisF.x + t.z * this.axisF.z) * this.grindDir;
        this.speed = along * this.grindVel;
      }
    }
    this.railLeft();
    this.grindRail = null;
    this.state = 'air';
    this.vVel = vVel;
    this.regrindCd = CONST.regrindCooldown;
    this.balance = 0;
    this.balanceCritT = 0;
    // Grind exits fly forward: the rail speed rides through the whole air,
    // even if it's below walking pace (footAir must not zero it).
    this.airMomentum = true;
  }

  // Room to hang beneath the rail here? The body needs UNDER_RAIL_DEPTH of
  // clear air below the line — checked on the switch AND re-probed while
  // hanging, so rising terrain pops you back on top instead of clipping.
  private underClearance(rail: Rail, level: Level): boolean {
    const p = rail.pointAt(this.grindT);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(p.x, p.y - 0.35, p.z),
      LEDGE_DOWN,
      0,
      UNDER_RAIL_DEPTH + 0.45,
    );
    return ray.intersectObjects(level.groundMeshes, false).length === 0;
  }

  // The needle pegged while hanging underneath: the board SNAPS (it was the
  // grip), and you drop straight down on foot. Ground below breaks the fall
  // into a tumble; over a pit there's nothing to break it at all.
  private snapBoardFall(): void {
    this.railLeft();
    this.grindRail = null;
    this.railUnder = false;
    this.state = 'air';
    this.airFromSkate = false;
    this.airGrav = 'foot'; // the board is in pieces: fall like a platformer
    this.freeSkate = false; // the board is in pieces — whatever comes next is on foot
    this.speed = Math.max(1.5, this.grindVel * 0.4);
    this.vVel = -1.5;
    this.airMomentum = false;
    this.armBailRecovery(0.9); // the tumble + procedural roll-up own the recovery
    this.boardSnapT = 1.7; // deck stays gone through the fall and the get-up
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
    this.balanceCritT = 0;
    this.invulnTimer = CONST.maskInvuln; // consistent with every other wipeout
    this.invulnSilent = true; // the tumble is the tell, not the flicker
    this.loseCombo();
    sfx.play('crunch', 0.9, 0.85); // the snap
    sfx.play('takeDamage', 0.7);
    this.emitSparks(10, 0xb08040, 2.2); // splinters off the broken deck
    this.startRagdoll('air'); // no thrown deck — this one snapped to pieces
  }

  // THE ONE PLACE the needle becomes a direction in the world.
  //
  // The HUD draws a positive needle to the RIGHT of the meter (ui.ts:
  // left = 50 + bal * 46), so a positive needle has to mean the rider is
  // going over their right shoulder — and has to put them down on the right.
  // It did not: every site here built its offset out of (tangent.z, -tangent.x),
  // which is the same construction as axisL and therefore the rider's LEFT.
  // Measured, a pegged +1 needle landed her 5.7 units to the LEFT of the line
  // while the meter said right. Hence the minus: (-hz, hx) is screen-right of
  // travel, and everything downstream now agrees with the picture.
  private railSide(out: { x: number; z: number }): number {
    const rail = this.grindRail;
    const side = Math.sign(this.balance || 1);
    if (!rail) {
      out.x = 0;
      out.z = 0;
      return side;
    }
    const t = rail.tangentAt(this.grindT);
    const hx = t.x * this.grindDir;
    const hz = t.z * this.grindDir;
    const hl = Math.hypot(hx, hz) || 1;
    out.x = (-hz / hl) * side;
    out.z = (hx / hl) * side;
    return side;
  }
  private static readonly RAIL_SIDE = { x: 0, z: 0 };

  // Which way is the balance needle throwing us, and what's over there?
  // Steep ground or a real drop on the fall side = the transition ('vert'):
  // falling that way reads as dropping in, not crashing. Flat ground near
  // rail height = the deck/uphill side, where a fall is still a bail.
  private railFallSide(level: Level): 'vert' | 'deck' {
    if (!this.grindRail) return 'deck';
    const s = Player.RAIL_SIDE;
    this.railSide(s);
    if (s.x === 0 && s.z === 0) return 'deck';
    const probe = this.queryGround(level, s.x * 2.2, s.z * 2.2);
    if (!probe) return 'vert'; // open air: riding the drop out beats a face-plant
    if (probe.normal.y < TUNING.steepStand) return 'vert'; // transition face
    return this.pos.y - probe.y > 1.6 ? 'vert' : 'deck';
  }

  // The needle threw us INTO the transition: end the grind cleanly — heading
  // bends off the rail toward the drop, speed and pending combo both live.
  private dropOffRail(): void {
    const rail = this.grindRail!;
    const t = rail.tangentAt(this.grindT);
    const hx = t.x * this.grindDir;
    const hz = t.z * this.grindDir;
    const hl = Math.hypot(hx, hz) || 1;
    const s = Player.RAIL_SIDE;
    this.railSide(s);
    const fx = hx / hl + s.x * 0.9;
    const fz = hz / hl + s.z * 0.9;
    const fl = Math.hypot(fx, fz) || 1;
    this.axisF.set(fx / fl, 0, fz / fl);
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.railLeft();
    this.grindRail = null;
    this.state = 'air';
    this.airFromSkate = true; // still a board air: tricks live
    this.airGrav = 'board';
    this.freeSkate = true;
    this.speed = Math.max(this.grindVel * 0.85, 3);
    this.vVel = 1.2;
    this.airMomentum = true;
    this.regrindCd = CONST.regrindCooldown;
    this.balance = 0;
    this.balanceCritT = 0;
    sfx.play('skateTransition', 0.6);
  }

  // Pegged the balance meter (or hit a crate): stumble off the rail with most
  // speed gone and the pending combo lost. Over a pit that means a drop.
  // sideSign ±1 = the needle pegged that way: the stumble EJECTS toward that
  // side (heading tips hard off the rail), so you fall where you failed.
  private bailFromRail(sideSign = 0, level: Level | null = null): void {
    const rail = this.grindRail;
    if (sideSign !== 0 && rail) {
      const t = rail.tangentAt(this.grindT);
      const hx = t.x * this.grindDir;
      const hz = t.z * this.grindDir;
      const hl = Math.hypot(hx, hz) || 1;
      // screen-right of travel, times the side asked for — the same
      // construction railSide() uses, so a crate hit and a pegged needle
      // throw you the same way
      const fx = hx / hl + (-hz / hl) * sideSign * 1.4;
      const fz = hz / hl + (hx / hl) * sideSign * 1.4;
      const fl = Math.hypot(fx, fz) || 1;
      this.axisF.set(fx / fl, 0, fz / fl);
      this.axisL.set(this.axisF.z, 0, -this.axisF.x);
      this.speed = Math.abs(this.speed); // the new heading carries the fall
    }
    this.railLeft();
    this.grindRail = null;
    this.state = 'air';
    this.vVel = 3;
    this.speed *= CONST.balanceBailSpeedKeep;
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
    this.balanceCritT = 0;
    sfx.play('takeDamage', 0.8);
    this.invulnTimer = CONST.maskInvuln; // consistent with every other wipeout
    this.invulnSilent = true; // the tumble is the tell, not the flicker
    this.loseCombo();
    this.emitSparks(8, 0xffb545, 2);
    // DROPPING INTO A VERT: the needle pegged on a coping/lip line and threw
    // you toward the TRANSITION — that's a drop-in, not a wipeout. Stay on the
    // board, no knockdown, and ride out whatever the fall gives you (the
    // energy-conserving landing turns the drop into speed down the face).
    if (level !== null) {
      const into = this.queryGround(level, this.axisF.x * 1.6, this.axisF.z * 1.6);
      if (
        into !== null &&
        (into.halfpipe !== undefined || into.vert === true || into.normal.y < TUNING.steepStand)
      ) {
        this.airFromSkate = true; // the landing projection needs the board air
        this.airGrav = 'board';
        this.airMomentum = true;
        return;
      }
    }
    // Falling off a rail anywhere ELSE is a WIPEOUT: the body rolls off the
    // side the needle said, the deck goes flying, and the knockdown clock
    // (mashable) runs like every other crash. Board gravity + carried
    // momentum, or the old foot fall-rate (119) put her down before the roll
    // could read and every rail bail looked like the same quick flop.
    this.airFromSkate = false; // a stumble is not a trick window
    this.airGrav = 'board';
    this.airMomentum = true; // the side-throw carries the tumble off the line
    this.vVel = 4.2;
    this.armBailRecovery(
      CONST.bailDownTime + Math.min(0.9, Math.abs(this.speed) * 0.035),
    );
    this.invulnTimer = Math.max(this.invulnTimer, this.bailDownT + 0.1);
    this.startRagdoll('side', sideSign);
    this.throwBoard();
    this.freeSkate = false; // the deck flew — the get-up is on foot
    this.stepOff = true;
    this.slideFromWalk = true;
  }

  // ------------------------------------------------------------------ spin --

  private tryStartDeckTrick(intent: boolean): boolean {
    if (
      !intent ||
      this.state !== 'air' ||
      !this.airFromSkate ||
      this.slamActive ||
      this.wallriding ||
      this.isBailing ||
      this.grabPhase !== 'none' ||
      this.flipT > 0
    )
      return false;

    this.specialFlip = null;
    this.flipDuration = CONST.flipTime;
    this.flipKind = deckTrickFromInput(
      this.rawInput.moveX,
      this.rawInput.moveY,
    );
    this.flipName = deckTrickInfo(this.flipKind).label;
    this.flipT = CONST.flipTime;
    this.deckTrickPreviewSequence++;
    this.deckTricksThisAir.add(this.flipKind);
    this.deckTricksThisCombo.add(this.flipKind);
    return true;
  }

  private tryStartSpecialFlip(): boolean {
    const trick = this.pendingSpecialFlip;
    if (
      !trick ||
      this.state !== 'air' ||
      !this.airFromSkate ||
      this.slamActive ||
      this.wallriding ||
      this.isBailing ||
      this.grabPhase !== 'none' ||
      this.flipT > 0
    )
      return false;
    this.pendingSpecialFlip = null;
    this.specialFlip = trick;
    this.flipDuration = trick.duration;
    this.flipKind = 'kick'; // gate evidence remains ordinary-only; this is visual metadata
    this.flipName = trick.label;
    this.flipT = trick.duration;
    this.deckTrickPreviewSequence++;
    this.ollieDeckTrickBufferT = 0;
    this.confirmSpecial(trick);
    return true;
  }

  private updateSpin(dt: number, input: Input): void {
    // A KNOCKED-DOWN BODY CANNOT ATTACK. Square is one of the buttons the
    // bail mash counts (see the mash accumulator in step()), so without this
    // gate mashing your way out of a wipeout fired real spin attacks —
    // smashing crates, killing enemies and popping TNT straight through the
    // "a tumbling body is scenery" guards the collision code carefully keeps.
    const canSpin =
      !this.isBailing &&
      (this.state === 'ride' || this.state === 'air' || this.state === 'grind' || this.state === 'rope');
    const specialFlipStarted = input.spinPressed && this.tryStartSpecialFlip();
    this.ollieDeckTrickBufferT = Math.max(0, this.ollieDeckTrickBufferT - dt);
    const bufferOllieDeckTrick =
      !specialFlipStarted &&
      input.spinPressed &&
      this.state === 'ride' &&
      this.grounded &&
      this.freeSkate &&
      this.charging;
    if (bufferOllieDeckTrick)
      this.ollieDeckTrickBufferT = OLLIE_DECK_TRICK_CHORD;
    if (
      input.spinPressed &&
      !specialFlipStarted &&
      !this.spinning &&
      this.spinCd <= 0 &&
      canSpin
    ) {
      this.spinTimer = TUNING.spinDuration;
      sfx.play(['spin1', 'spin2', 'spin3'][Math.floor(Math.random() * 3)], 0.5);
      if (this.state === 'air' && this.vVel < 7) {
        // Tiny Crash-style stall. Never boosts an already-rising jump.
        this.vVel = Math.min(this.vVel + TUNING.spinAirCorrection, 7);
      }
      // The same Square edge in a board air throws the deck while the normal
      // Crash spin attack keeps its own hitbox/animation.
      this.tryStartDeckTrick(true);
      // SLIDE-SPIN CANCEL (Crash 4 rules): a spin timed to the slide's END —
      // its last beat, or the unresolved grace/get-up right after — wipes the
      // re-fire blockers, so slide -> spin -> slide chains on timing instead
      // of waiting out the cool-off. Spinning early in the slide cancels
      // nothing, and a slide JUMP's cooldown stays.
      const slideEnding = this.slideTimer > 0 && this.slideTimer <= CONST.slideSpinCancel;
      const slideJustEnded =
        this.slideTimer <= 0 && (this.slideEndPending || this.slideRecoverT > 0);
      if (slideEnding || slideJustEnded) {
        // Keep the on-foot provenance long enough to clamp the authored burst
        // before board arbitration sees it. A late spin used to zero only the
        // timer, leaving the stale 26u/s channel to auto-mount the board.
        if (this.slideFromWalk) {
          this.speed = THREE.MathUtils.clamp(this.speed, -TUNING.walkSpeed, TUNING.walkSpeed);
          this.lastPlanar = Math.min(this.lastPlanar, TUNING.walkSpeed);
          this.walkVelocity.copy(this.axisF).multiplyScalar(this.speed);
        }
        this.slideTimer = 0;
        this.slideDistanceLeft = 0;
        this.slideSpd = 0;
        this.slideGraceHold = false;
        this.slideEndPending = false;
        this.slideRecoverT = 0;
        this.slideCd = 0;
      }
    }
    // A Square edge just before X releases is treated as the player smooshing
    // both buttons at takeoff. The 0.10s edge buffer survives a quick Square
    // tap/release, but an early spin — even if Square stays held — expires and
    // cannot silently become a deck trick seconds later.
    const ollieReleaseChord =
      input.jumpReleased &&
      this.ollieDeckTrickBufferT > 0 &&
      this.state === 'air' &&
      this.boardOllieAir;
    this.tryStartDeckTrick(ollieReleaseChord);
    if (input.jumpReleased || (!this.charging && this.state !== 'air'))
      this.ollieDeckTrickBufferT = 0;
    if (this.spinTimer > 0) {
      this.spinTimer -= dt;
      const progress = 1 - Math.max(this.spinTimer, 0) / TUNING.spinDuration;
      this.spinAngle = progress * Math.PI * 2;
      if (this.spinTimer <= 0) {
        this.spinAngle = 0;
        this.spinCd = CONST.spinCooldown;
      }
    }
    // The deck completes its flip: still airborne = the trick is THROWN and
    // scores now (a later bail wipes the combo, same as a started grab).
    // Any other exit — grind catch, wall, slam — quietly fizzles it.
    if (this.flipT > 0) {
      this.flipT -= dt;
      if (this.flipT <= 0) {
        const completedSpecial = this.specialFlip;
        this.flipT = 0;
        if (
          this.state === 'air' &&
          !this.grounded &&
          !this.isBailing &&
          !this.wallriding &&
          !this.slamActive
        ) {
          this.score(completedSpecial?.points ?? CONST.ptsFlip, this.flipName);
          // The generic spin ends before the slower deck flip. Once the deck
          // really completes, retain only a one-fixed-tick debounce so a fresh
          // Square edge next tick may start another trick in this same air.
          this.spinCd = Math.min(this.spinCd, dt);
        }
        this.specialFlip = null;
        this.flipDuration = CONST.flipTime;
      }
    }
  }

  // ------------------------------------------------------------------ grab --

  // Spin drive for an air: screen left/right, ALWAYS — hangs included, on
  // every wall. (This used to remap to the coping tangent during a pipe
  // hang, which made left/right a dead axis on E/W walls — "spins are
  // broken" — while the axis that did respond doubled as a positional slide
  // down the pipe. One stick meaning everywhere: left/right = rotate.)
  private spinStick(): number {
    const rx = this.rawInput.moveX;
    return Math.abs(rx) > 0.3 ? rx : 0;
  }

  private tryStartSpecialGrab(): boolean {
    const trick = this.pendingSpecialGrab;
    if (
      !trick ||
      this.state !== 'air' ||
      !this.airFromSkate ||
      this.wallriding ||
      this.slamActive ||
      this.isBailing ||
      this.flipT > 0 ||
      this.grabPhase !== 'none'
    )
      return false;
    this.pendingSpecialGrab = null;
    this.specialGrab = trick;
    this.specialGrabT = trick.duration;
    // The recipe's brief RIGHT tap may have begun a tiny ordinary spin. The
    // committed 900 owns the rotation and starts from the nearest landable line.
    this.specialGrabStartAngle = Math.round(this.grabSpinAngle / Math.PI) * Math.PI;
    this.grabSpinAngle = this.specialGrabStartAngle;
    this.specialGrabLanding = false;
    this.grabPhase = 'enter';
    this.grabT = 0;
    this.grabTrickName = trick.label;
    this.grabTickT = 0;
    const scored = this.score(trick.points, trick.label);
    this.airGrabShown = scored.shown ?? null;
    this.grabPaid = scored.pay;
    this.confirmSpecial(trick);
    return true;
  }

  private updateGrab(dt: number, input: Input): void {
    this.grabGraceTimer = Math.max(0, this.grabGraceTimer - dt);
    if (input.grabPressed) this.tryStartSpecialGrab();
    if (this.specialGrab) {
      const trick = this.specialGrab;
      if (
        this.state !== 'air' ||
        !this.airFromSkate ||
        this.wallriding ||
        this.slamActive ||
        this.isBailing
      ) {
        this.specialGrab = null;
        this.specialGrabT = 0;
        this.specialGrabLanding = false;
        this.grabPhase = 'none';
      } else {
        this.specialGrabT = Math.max(0, this.specialGrabT - dt);
        const progress = 1 - this.specialGrabT / Math.max(trick.duration, dt);
        const eased = progress * progress * (3 - 2 * progress);
        this.grabSpinAngle = this.specialGrabStartAngle - eased * Math.PI * 5;
        const releaseWindow = Math.max(0.05, TUNING.grabRelease);
        if (progress < CONST.grabTransition / Math.max(trick.duration, dt))
          this.grabPhase = 'enter';
        else if (this.specialGrabT > releaseWindow) this.grabPhase = 'held';
        else this.grabPhase = 'exit';
        if (this.specialGrabT <= 0) {
          this.grabSpinAngle = this.specialGrabStartAngle - Math.PI * 5;
          this.specialGrab = null;
          this.specialGrabLanding = true;
          this.grabPhase = 'none';
          this.grabT = 0;
        }
        return;
      }
    }
    if (this.state === 'air') {
      // A grab needs a DIRECTION to start (the stick picks the variant): Circle
      // alone in the air does nothing, so braking with Circle off a lip doesn't
      // fire an accidental no-input grab. Once a grab is committed it holds even
      // if you re-center the stick.
      const grabActive = this.grabPhase === 'enter' || this.grabPhase === 'held';
      const grabDir = Math.abs(this.rawInput.moveX) > 0.3 || Math.abs(this.rawInput.moveY) > 0.3;
      // (The old vert AUTO-CORRECT — force-completing any live rotation to the
      // nearest 180 in the final beat of a descent — is gone. No THPS game
      // finishes your spin for you at unbounded angular rate: the assist is
      // the release-snap below plus the landing tolerance, and coming down
      // mid-rotation is now judged clean / sketchy / bail on VERT airs the
      // same as street ones. Big spins are earned again.)
      // STREET GRABS ARE BACK: any board air takes Circle + a direction
      // (up = Nosegrab, left = Melon, right = Indy), or a FRESH mid-air
      // Circle press with no direction for the plain Grab. Two guards keep
      // the chords honest: Circle carried over from the ground brake still
      // needs a direction before it reads as a grab, and Circle + hard DOWN
      // on the board stays the pancake slam — though a grab already
      // committed holds through a down-roll instead of handing its air to
      // the slam.
      const streetGrabAir =
        this.airGrav === 'board' &&
        !this.wallriding &&
        !this.isBailing &&
        (grabActive || this.rawInput.moveY >= -0.5);
      if (
        input.grabHeld &&
        !this.slamActive &&
        this.airFromSkate &&
        (this.vertAir || this.pipeHang || streetGrabAir) &&
        (grabActive || grabDir || input.grabPressed)
      ) {
        // Reach into the pose over grabTransition, then hold it.
        if (this.grabPhase === 'none' || this.grabPhase === 'exit') {
          this.grabPhase = 'enter';
          this.grabT = 0;
          // A grab needs a direction to start, so the VARIANT is usually
          // knowable right here — score under its own name from the first
          // frame (each variant is its own trick with its own decay pool).
          const rIn0 = this.rawInput;
          this.grabTrickName =
            rIn0.moveY > 0.4
              ? 'Nosegrab'
              : rIn0.moveX < -0.4
                ? 'Melon'
                : rIn0.moveX > 0.4
                  ? 'Indy'
                  : 'Grab';
          this.grabTickT = 0;
          // Timed trick: register it NOW so the combo plate shows straight away
          // and ticks up while held (a botched landing bails the whole thing).
          const sr = this.score(CONST.ptsGrab, this.grabTrickName);
          this.airGrabShown = sr.shown ?? null;
          this.grabPaid = sr.pay;
          sfx.play('woosh2', 0.4);
        } else if (this.grabPhase === 'enter') {
          this.grabT += dt;
          if (this.grabT >= CONST.grabTransition) this.grabPhase = 'held';
        }
        // Circle + left/right = grab-spin THAT way (left arrow spins left).
        // The trajectory is locked either way — but land mid-pose or too far
        // off-axis and you bail (a near miss is a sketchy landing now).
        const gsp = this.spinStick();
        if (gsp !== 0) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(gsp) * dt;
        }
        // variant name for the combo readout — and the PLATE follows it: the
        // entry pushed at grab start is renamed in place, so holding a
        // direction turns "Grab" into the trick you're actually doing.
        const vName =
          this.rawInput.moveY > 0.4
            ? 'Nosegrab'
            : this.rawInput.moveX < -0.4
              ? 'Melon'
              : this.rawInput.moveX > 0.4
                ? 'Indy'
                : this.grabTrickName;
        if (vName !== this.grabTrickName) {
          // The trick this air turns out to be is the RESOLVED variant: move
          // the decay count off the old name and reprice the points already
          // paid at the new name's own pool — an Indy after a Melon is a
          // fresh trick, only repeating the SAME grab decays.
          const oc = this.comboUses.get(this.grabTrickName) ?? 0;
          if (oc > 0) this.comboUses.set(this.grabTrickName, oc - 1);
          const nUses = this.comboUses.get(vName) ?? 0;
          this.comboUses.set(vName, nUses + 1);
          const curve = CONST.repeatDecay;
          let newPay = Math.round(CONST.ptsGrab * curve[Math.min(nUses, curve.length - 1)]);
          if (this.uberTimer > 0) newPay *= CONST.uberScoreMult;
          this.comboPoints += newPay - this.grabPaid;
          this.comboHudActionRevision++;
          this.grabPaid = newPay;
          if (this.airGrabShown) {
            const pfx = this.airGrabShown.startsWith('Tiki ') ? 'Tiki ' : '';
            this.renameLabel(this.airGrabShown, pfx + vName);
            this.airGrabShown = pfx + vName;
          }
          this.grabTrickName = vName;
        }
        // THPS accrual: held grabs are worth more
        this.grabTickT += dt;
        while (this.grabTickT >= 0.25) {
          this.grabTickT -= 0.25;
          this.comboPoints += CONST.ptsGrabTick;
          this.special.award(CONST.ptsGrabTick);
          this.comboTimer = CONST.comboWindow;
        }
      } else {
        // Released: reach back OUT of the pose. Only once that motion
        // finishes does the payout window open — land before then = bail.
        if (this.grabPhase === 'enter' || this.grabPhase === 'held') {
          this.grabPhase = 'exit';
          this.grabT = 0;
        } else if (this.grabPhase === 'exit') {
          this.grabT += dt;
          if (this.grabT >= TUNING.grabRelease) {
            this.grabPhase = 'none';
            this.grabGraceTimer = CONST.grabGrace;
          }
        }
        // HANG-TIME SPIN: the stick alone spins you in a vert air — no grab
        // needed. HOLD toward either end of the coping (even the direction you
        // carved up with) to keep rotating; release to snap to the nearest 180
        // and land, or ride it to the wheels and take the judgment.
        // STREET AIRS SPIN TOO (THPS: holding left/right rotates EVERY air
        // from the moment the wheels leave the ground — spinning a gap ollie
        // is the core air verb): any board air takes the same stick-spin, and
        // the landing is then judged clean / sketchy / bail. Release early and
        // the snap eases you onto the nearest 180 line.
        const hsp = this.spinStick();
        const streetSpin =
          this.airFromSkate && this.airGrav === 'board' && !this.wallriding && !this.isBailing;
        if ((this.vertAir || streetSpin) && !this.slamActive && hsp !== 0) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(hsp) * dt;
        } else if (this.grabSpinAngle !== 0) {
          const target = Math.round(this.grabSpinAngle / Math.PI) * Math.PI;
          const d = target - this.grabSpinAngle;
          const step = CONST.grabSnapRate * dt;
          this.grabSpinAngle = Math.abs(d) <= step ? target : this.grabSpinAngle + Math.sign(d) * step;
        }
      }
    } else if (
      this.grabPhase !== 'none' ||
      this.grabSpinAngle !== 0 ||
      this.airGrabShown !== null
    ) {
      // (airGrabShown gets its own disjunct: a grind catch or a slam zeroes
      // the grab fields ITSELF before we run, and a stale label here made a
      // spin landed in a LATER air merge into the settled entry — or, after a
      // slam's bank, pay into an empty combo and vanish.)
      this.grabPhase = 'none';
      this.grabT = 0;
      // leaving the air by any other door (grind entry, slam): keep the
      // facing where the spin left it rather than snapping back
      this.visualYaw = wrapAngle(this.visualYaw + this.grabSpinAngle);
      this.grabSpinAngle = 0;
      this.airGrabShown = null;
      this.specialGrab = null;
      this.specialGrabT = 0;
      this.specialGrabLanding = false;
    }
  }

  // ---------------------------------------------------------------- sparks --

  private emitSparks(count: number, color: number, kick: number): void {
    const back = this.axisF.clone().multiplyScalar(-Math.sign(this.speed || 1));
    for (const s of this.sparks) {
      if (count <= 0) break;
      if (s.life > 0) continue;
      count--;
      s.dust = false;
      s.maxLife = 0.2 + Math.random() * 0.2;
      s.life = s.maxLife;
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      s.mesh.visible = true;
      s.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * 0.3,
        this.pos.y + 0.05,
        this.pos.z + (Math.random() - 0.5) * 0.3,
      );
      s.vel
        .set((Math.random() - 0.5) * 2.4, 0.8 + Math.random() * 2.4, (Math.random() - 0.5) * 2.4)
        .addScaledVector(back, (0.5 + Math.random() * 2) * kick);
    }
  }

  // Ground dust kicked up under the feet: slides, run steps, scrubs. One call
  // into the shared PS1 puff system, which owns what dust actually looks like
  // — this only says WHERE and HOW MUCH. The surface under the board picks the
  // colour and the spread, so the same call reads as sand, grit or nothing
  // much on grass without the caller knowing which it is standing on.
  private emitDust(count: number): void {
    puffs.burst('dustStep', this.pos.x, this.pos.y + 0.05, this.pos.z, {
      count,
      dir: PUFF_UP,
      surface: surfaceFromName(this.surfaceName),
      groundY: this.pos.y,
      parentVel: this.vel3(PUFF_VEL),
      strength: Math.min(1.6, 0.6 + Math.abs(this.speed) / 18),
    });
  }

  /** Planar travel as a vector — what the puffs inherit from a moving skater. */
  private vel3(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.axisF.x * this.speed, 0, this.axisF.z * this.speed);
  }

  // Everything the puff system needs from a step: the landing burst, the
  // rolling trail, and the skid. Called from every path that ticks the sparks,
  // so a rope or a ledge grab cannot silently stop the bookkeeping and leave a
  // stale "was grounded" behind.
  private updatePuffs(): void {
    const surf = surfaceFromName(this.surfaceName);
    const landed = this.grounded && !this.pfWasGrounded;
    if (landed) {
      // Impact strength IS the descent speed. Everything downstream — puff
      // count, size, how far the cloud spreads on the deck — scales off it, so
      // a drop off a kerb and a drop off the tower are the same effect at two
      // strengths rather than two effects.
      const fall = Math.max(0, -this.pfPrevVVel);
      if (fall > 3.5) {
        const str = Math.min(2.2, 0.3 + (fall - 3.5) / 9);
        const heavy = this.pfWasSlamming || fall > 17;
        puffs.burst(
          this.pfWasSlamming ? 'groundPound' : heavy ? 'dustLandHeavy' : 'dustLand',
          this.pos.x,
          this.pos.y + 0.04,
          this.pos.z,
          { dir: PUFF_UP, surface: surf, groundY: this.pos.y, strength: str },
        );
      }
      // A landing restarts the rolling line: without this the trail would draw
      // a stripe from wherever the wheels last touched down.
      puffs.cutTrail('wheel');
      puffs.cutTrail('skid');
    }
    this.pfWasGrounded = this.grounded;
    this.pfPrevVVel = this.vVel;
    this.pfWasSlamming = this.slamActive;

    // GRIND SPARKS: same distance-driven trail as the dust, on the spark
    // preset. They leave the truck aimed backwards along the rail with a
    // little lift, and the preset's cone fans them; speed feeds strength, so
    // a fast grind throws a shower and a crawl barely spits. Not gated on
    // `grounded` — a grind isn't — so it runs before the deck block below.
    const grinding = this.state === 'grind' && Math.abs(this.speed) > 4;
    if (grinding) {
      const sgn = Math.sign(this.speed || 1);
      PUFF_DIR.set(-this.axisF.x * sgn, 0.35, -this.axisF.z * sgn);
      puffs.trail('grind', 'spark', this.pos.x, this.pos.y + 0.06, this.pos.z, {
        emit: true,
        dir: PUFF_DIR,
        parentVel: this.vel3(PUFF_VEL),
        strength: Math.min(1.6, Math.abs(this.speed) / 14),
      });
    } else puffs.cutTrail('grind');

    // Rolling and skidding are DISTANCE-driven, so the line is even at any
    // speed and identical at any frame rate. Both are told where we are EVERY
    // grounded step and only gated on whether to lay a puff down — a trail
    // that is cut and re-seeded each time the speed crosses its gate never
    // accumulates enough distance to spawn anything.
    const onDeck = this.grounded && this.state !== 'dead' && this.state !== 'gameover';
    if (onDeck) {
      const rolling = this.state === 'ride' && !this.sliding && Math.abs(this.speed) > 5;
      puffs.trail('wheel', 'dustWheel', this.pos.x, this.pos.y + 0.05, this.pos.z, {
        emit: rolling,
        dir: PUFF_UP,
        surface: surf,
        groundY: this.pos.y,
        parentVel: this.vel3(PUFF_VEL),
        strength: Math.min(1.5, 0.6 + Math.abs(this.speed) / 20),
      });
      puffs.trail('skid', 'dustSkid', this.pos.x, this.pos.y + 0.05, this.pos.z, {
        emit: this.sliding,
        dir: PUFF_UP,
        surface: surf,
        groundY: this.pos.y,
        parentVel: this.vel3(PUFF_VEL),
        strength: Math.min(1.6, 0.7 + Math.abs(this.speed) / 20),
      });
    } else {
      // Airborne: the next touchdown starts a fresh line rather than drawing
      // one from wherever the wheels last were.
      puffs.cutTrail('wheel');
      puffs.cutTrail('skid');
    }
  }

  private updateSparks(dt: number): void {
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      const k = s.life / s.maxLife;
      if (s.dust) {
        // dust hangs: light gravity, air drag, and it puffs OUT as it fades
        s.vel.y -= 3.5 * dt;
        s.vel.multiplyScalar(1 - Math.min(1, 4 * dt));
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.scale.setScalar(1.4 + (1 - k) * 2.6);
      } else {
        s.vel.y -= 22 * dt;
        s.mesh.position.addScaledVector(s.vel, dt);
        s.mesh.scale.setScalar(Math.max(k, 0.25));
      }
    }
  }

  // ------------------------------------------------------------- collision --

  private collide(level: Level): void {
    if (this.returnPortalCoolT <= 0) {
      const portal = level.returnPortalAt(
        this.prevPos,
        this.pos,
        this.state === 'air' && !this.grounded,
      );
      if (portal) {
        const portalBoard =
          this.freeSkate || this.airFromSkate || this.state === 'grind';
        if (this.state === 'grind' && this.grindRail) this.railLeft();
        this.grindRail = null;
        this.grindRun = null;
        this.grindCrate = null;
        this.railUnder = false;
        this.underK = 0;
        if (this.manualing !== 0) this.endManual();
        this.wallriding = false;
        this.wallBox = null;
        this.wallPath = null;
        this.vertAir = false;
        this.pipeHang = false;
        this.hangPipe = null;
        this.pipeEndFly = false;
        this.rollOffT = 0;
        this.vertGravT = 0;
        this.lipStallT = 0;
        this.lipPipe = null;
        this.boardOllieAir = false;
        this.emergencyEjectCharging = false;
        this.emergencyEjectChargeT = 0;
        this.deckTricksThisAir.clear();
        // A portal is a traversal boundary. Retire the whole authored slide
        // envelope together so it cannot resume or attack at the destination.
        this.cancelSlideTraversal();
        this.pos.copy(portal.destination);
        this.snapRenderInterpolation();
        const h = portal.heading;
        const dir: 'S' | 'E' | 'W' | 'N' =
          Math.abs(h.x) > Math.abs(h.z)
            ? h.x >= 0
              ? 'E'
              : 'W'
            : h.z >= 0
              ? 'N'
              : 'S';
        this.setTravelDir(dir);
        this.axisF.copy(h).setY(0).normalize();
        this.axisL.set(-this.axisF.z, 0, this.axisF.x);
        if (portalBoard) {
          this.freeSkate = true;
          this.speed = Math.abs(this.speed);
        } else {
          this.freeSkate = false;
          const footSpeed = Math.min(
            Math.max(this.walkVelocity.length(), Math.abs(this.speed)),
            TUNING.walkSpeed,
          );
          this.walkVelocity.copy(this.axisF).multiplyScalar(footSpeed);
          this.speed = footSpeed;
        }
        this.prevPos.copy(this.pos);
        level.playerPos.copy(this.pos);
        this.groundHit = null;
        this.grounded = false;
        this.state = 'air';
        this.vVel = Math.max(0, this.vVel);
        this.airborneT = 0;
        this.airPeakY = this.pos.y;
        this.launchVy = this.vVel;
        this.airFromSkate = portalBoard;
        this.airMomentum = portalBoard;
        this.laneCursor.s = -1;
        this.returnPortalCoolT = 0.35;
        this.emitSparks(12, 0x9f72ff, 2);
        sfx.play('woosh2', 0.85, 1.2);
      }
    }
    const half = CONST.playerHalf;
    if (this.state !== 'grind' && !this.wallriding) {
      const coastHit = level.resolveCoastBoundary(
        this.prevPos,
        this.pos,
        half.x,
        half.y,
        half.z,
      );
      if (coastHit) {
        this.pos.x = coastHit.x;
        this.pos.z = coastHit.z;

        // The swept solver already projects the remaining displacement onto
        // the tangent. Only a square hit kills authored drive; a shoreline
        // graze keeps flowing around the spline at the contact point.
        if (coastHit.frontal) {
          // A square hit is still a stop, but never a bail, wallride, ledge
          // grab or axis-aligned rebound from an invisible box.
          if (Math.abs(this.speed) > 18 && this.haltCd <= 0) {
            sfx.play('skateHalt', 0.7);
            this.haltCd = 0.5;
          }
          this.speed = 0;
        }
      }
    }
    const center = new THREE.Vector3(this.pos.x, this.pos.y + half.y, this.pos.z);
    this.playerBox.setFromCenterAndSize(center, new THREE.Vector3(half.x * 2, half.y * 2, half.z * 2));
    this.feetBox.copy(this.playerBox);
    // On a rail the board and trucks hang BELOW the feet — reach down so
    // crates sitting on the rail line still clip a grinder.
    if (this.state === 'grind') this.playerBox.min.y -= 0.35;
    // ONE CRATE LAYER AT A TIME. The spin reaches OUT, never up or down.
    //
    // It used to add 0.2 above and below, making the box 1.32 tall against a
    // 0.96 crate, so a spin at the foot of a stack tore through two rows at
    // once and a wall could never be taken down a row at a time. It also
    // copied playerBox, which by this point carries the grind reach — another
    // 0.35 — so spinning along a ledge cleared 1.27 of stack.
    //
    // It is built from feetBox instead: the body's own 0.92, before either
    // adjustment, which fits inside one 0.96 layer in every state.
    this.spinBox.copy(this.feetBox);
    if (this.spinning) {
      this.spinBox.expandByVector(new THREE.Vector3(CONST.spinReach, 0, CONST.spinReach));
    }

    const trickGateAperture = Math.hypot(
      half.y,
      Math.max(half.x, half.z),
    );
    const trickGate =
      level.trickGates.length > 0
        ? level.resolveTrickGateCrossing(
            this.primitiveFrom.copy(this.prevPos).addScaledVector(CRATE_UP, half.y),
            this.primitiveTo.copy(this.pos).addScaledVector(CRATE_UP, half.y),
            this.primitiveAirTricks,
            trickGateAperture,
            Math.max(half.x, half.z),
          )
        : null;
    if (trickGate?.rejected) {
      const entrySpeed = Math.abs(this.speed);
      // Seat the whole body outside the VISIBLE frame depth, at the exact
      // swept side selected by the gate. `prevPos + 0.08` left up to 0.26u of
      // the rider inside the frame, and a retained skate bail then kept driving
      // forward through it. Exact separation is independent of step size and
      // also recovers old replays that begin already straddling the plane.
      const currentSeparation = this.primitiveTo
        .copy(this.pos)
        .sub(trickGate.gate.center)
        .dot(trickGate.normal);
      this.pos.addScaledVector(
        trickGate.normal,
        Math.max(0, trickGate.separation - currentSeparation),
      );
      const trick = trickGate.gate.trick;
      if (
        trickGate.reason === 'lock' &&
        (this.trickGateHintT <= 0 || this.trickGateHintKind !== trick)
      ) {
        this.trickGateHintT = 1.1;
        this.trickGateHintKind = trick;
        this.onTrickGateBlocked(trick);
      }
      if (this.trickGateImpactT <= 0) {
        this.trickGateImpactT = 0.25;
        sfx.play('skateHalt', 0.8, 0.85);
      }
      if (this.freeSkate && entrySpeed >= TUNING.wallBailSpeed) {
        this.bail();
        this.startRagdoll('back');
        // A gate is a wall with a condition. Rebound away from its actual
        // normal just like wallSmack does; bail() intentionally retains speed,
        // so leaving its sign untouched is what pinned the ragdoll into the
        // lock while forward remained held.
        const alongNormal = this.axisF.dot(trickGate.normal);
        this.speed =
          Math.abs(alongNormal) > 0.05
            ? Math.sign(alongNormal) * entrySpeed * 0.32
            : 0;
        this.vVel = Math.max(this.vVel, 3.6);
        this.state = 'air';
        this.grounded = false;
        this.airFromSkate = false;
        this.airGrav = 'foot';
        this.airMomentum = true;
      } else {
        if (this.slideTimer > 0 || this.slideContactLatch) {
          this.cancelSlideTraversal();
          this.speed = 0;
          this.walkVelocity.set(0, 0, 0);
        } else if (!this.freeSkate && this.walkVelocity.lengthSq() > 1e-6) {
          const into = this.walkVelocity.dot(trickGate.normal);
          if (into < 0)
            this.walkVelocity.addScaledVector(trickGate.normal, -into);
          // Preserve tangent velocity and the live reversal intent. Clearing
          // walkTarget/walkIntent here made the new inertia model feel locked
          // even after the player had already steered out of the impact.
          this.speed = this.walkVelocity.dot(this.axisF);
        } else {
          const alongNormal = this.axisF.dot(trickGate.normal);
          this.speed =
            Math.abs(alongNormal) > 0.05
              ? Math.sign(alongNormal) * Math.min(entrySpeed * 0.25, 3)
              : 0;
        }
      }
      center.set(this.pos.x, this.pos.y + half.y, this.pos.z);
      this.playerBox.setFromCenterAndSize(
        center,
        new THREE.Vector3(half.x * 2, half.y * 2, half.z * 2),
      );
      this.feetBox.copy(this.playerBox);
      this.spinBox.copy(this.feetBox);
      if (this.spinning)
        this.spinBox.expandByVector(
          new THREE.Vector3(CONST.spinReach, 0, CONST.spinReach),
        );
    } else if (trickGate) {
      this.emitSparks(10, 0x54dfff, 1.6);
      sfx.play('crystalGet', 0.65, 1.35);
    }

    // One fixed-step contact episode has one physical entry speed and one
    // travel tax. A seam can overlap several adjacent stack boxes at once;
    // charging 0.92 per array member made the same sweep mutate from Smash to
    // Trip halfway through and turned crate ordering into gameplay.
    const crateContactSpeed = this.speed;
    let crateBoardSmashTax = false;
    const {
      ordered: crateContacts,
      stomps: crateStompContacts,
      bonks: crateBonkContacts,
    } = this.cratesInFaceContactOrder(level);
    for (const c of crateContacts) {
      if (!c.alive || c.pending) continue; // outline ghosts: no collision at all
      // A METAL BOX COMING DOWN ON YOU IS A DEATH. It cannot be smashed and it
      // cannot be stomped aside, so standing under one is not a situation with
      // an out. Same terms as a crusher: uber and invuln wave it off, a mask
      // is spent, otherwise it is fatal.
      if (
        (c.metal || c.metalBounce || c.bang || c.nitroBang) &&
        c.fallVel !== undefined &&
        c.fallVel > 0 &&
        c.box.min.y > this.pos.y + CONST.playerHalf.y &&
        this.playerBox.intersectsBox(c.box) &&
        this.isCenteredFallingMetalContact(c.box)
      ) {
        if (this.uberTimer <= 0 && this.invulnTimer <= 0 && !this.spendMask()) {
          this.die();
          return;
        }
      }
      // A descending ordinary wood-family crate meeting the head from above
      // is a real, nonfatal headbutt: it breaks once. Arrow/explosive crates
      // retain their typed rules, while the metal family above stays fatal or
      // protection-absorbed. Rising and side/lower contacts cannot enter.
      if (
        !c.metal &&
        !c.metalBounce &&
        !c.bang &&
        !c.nitroBang &&
        !c.bouncy &&
        !c.nitro &&
        !c.tnt &&
        c.fallVel !== undefined &&
        c.fallVel > 0 &&
        c.box.min.y > this.pos.y + CONST.playerHalf.y &&
        this.playerBox.intersectsBox(c.box)
      ) {
        this.smashCrate(level, c);
        this.vVel = Math.min(this.vVel, 2);
        continue;
      }
      if (this.grindRun !== null && this.grindRun.has(c)) {
        // The ledge is not an obstacle — EXCEPT where it is a bomb. A nitro or
        // a TNT in a grind line is the hazard on that line: ride onto one and
        // it goes off underneath you, right now, no fuse. The rest of the run
        // stays scenery for the length of the grind.
        if ((c.nitro || c.tnt) && this.playerBox.intersectsBox(c.box))
          level.detonate(c);
        continue;
      }
      if (c.nitro) {
        // Nitro: body contact detonates it — fatally, unless uber or a mask
        // (or the invuln flicker from one) absorbs the hit.
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.uberTimer > 0 || this.invulnTimer > 0) {
            level.detonate(c, true); // plow straight through it
          } else if (this.spendMask()) {
            level.detonate(c, true);
            this.speed *= 0.6;
          } else {
            level.detonate(c);
            this.die();
            return;
          }
        }
        continue;
      }
      if (c.tnt) {
        // TNT is a solid box, Crash rules: spinning (or slamming/sliding
        // through it) pops it instantly. Stomping lights the 3-2-1 fuse and
        // bounces you; a headbutt from below lights it too. Grinding into one
        // unspun knocks you off the rail. Bumping it is just a wall.
        //
        // NONE of those pops is safe any more. A TNT used to spare whoever set
        // it off, which meant you could stand on top of one, spin, and stroll
        // away — the box was scenery with a countdown. The blast is lethal now
        // however it started, so the only question is whether you are clear of
        // it: light the fuse and run, or pop it at speed and outrun the sphere.
        // Uber, a mask, and the flicker after spending one still cover you
        // (the blast test player-side reads those), so nothing that used to
        // protect you stopped protecting you.
        if (this.spinning && this.spinBox.intersectsBox(c.box)) {
          level.detonate(c);
        } else if (this.playerBox.intersectsBox(c.box)) {
          if (this.isBailing) {
            // A TUMBLING BODY is not a stomp. Without this the ragdoll's fall
            // read as isStomping, lit the fuse and crateBounce'd the downed
            // body back into the sky — the same defect the plain-crate,
            // arrow-crate and '!' branches each guard against.
            if (this.grounded) this.pushOutOf(c.box);
          } else if (this.uberTimer > 0 || this.sliding) {
            level.detonate(c);
          } else if (this.state === 'grind') {
            if (this.grindVel >= TUNING.smashSpeed || this.spendMask()) level.detonate(c);
            else this.bailFromRail(0, level);
          } else if (crateStompContacts.has(c)) {
            if (this.slamActive) {
              level.detonate(c);
            } else {
              level.lightFuse(c);
              this.vVel = TUNING.crateBounce;
              this.snapFeetToCrateLid(c); // bounce OFF the lid, no re-intersect
              sfx.play('crateBounce', 0.7);
              this.state = 'air';
              this.grounded = false;
              this.bounceRefresh();
              this.charging = false;
              this.chargeTimer = 0;
            }
          } else if (crateBonkContacts.has(c)) {
            level.lightFuse(c);
            this.vVel = -1;
          } else {
            // Rolling into it ON THE BOARD: a smash-speed hit pops it outright
            // (same bar as smashing a crate), anything slower lights the fuse.
            // ON FOOT it is a wall and nothing else — running into a TNT must
            // not start the countdown, or every corridor with one in it turns
            // into a timer you started by accident. The fuse is lit by JUMPING
            // on it (the stomp above), which is a thing you have to mean.
            if (this.freeSkate) {
              if (Math.abs(this.speed) >= TUNING.smashSpeed) {
                level.detonate(c);
                continue;
              }
              if (Math.abs(this.speed) > 1.5) level.lightFuse(c);
            }
            this.pushOutOf(c.box);
          }
        }
        continue;
      }
      if (c.bouncy || c.metalBounce) {
        // Arrow crates: land on one for a super bounce. WOOD arrows break
        // like any box under a spin or body slam (and count for the gem);
        // METAL arrows are indestructible trampolines.
        // PERFECT BOUNCE: the higher launch is a visible held-input choice at
        // contact, not a hidden recent-press timing window.
        if (c.bouncy && this.spinning && this.spinBox.intersectsBox(c.box)) {
          this.smashCrate(level, c);
          continue;
        }
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.isBailing) {
            // tumbling body: the trampoline is scenery (no mid-ragdoll Boing)
            if (this.grounded) this.pushOutOf(c.box);
          } else if (this.state === 'grind') {
            // rail-line obstacle rules, same as plain crates: WOOD smashes at
            // speed (or a mask pays and breaks it); METAL can't break — a
            // mask lets you pass, otherwise it knocks you off the rail.
            //
            // The metal case MUST read the invuln window first. Metal is never
            // removed, so the overlap persists for as many fixed steps as it
            // takes to grind clear — and an unguarded spendMask() here charged
            // a mask EVERY ONE of those steps, emptying the whole stock and
            // then bailing anyway. One mask now buys the pass-through and its
            // invuln covers the rest of the contact.
            if (c.bouncy) {
              if (this.grindVel >= TUNING.smashSpeed || this.spendMask())
                this.smashCrate(level, c);
              else this.bailFromRail(0, level);
            } else if (this.invulnTimer <= 0 && !this.spendMask()) {
              this.bailFromRail(0, level);
            }
          } else if (crateStompContacts.has(c) && this.slamActive) {
            // Slam on WOOD breaks it. Slam on METAL cancels into a plain
            // bounce — clearing slamActive is load-bearing: without it the
            // slam's down-force re-stomps the trampoline every frame
            // (infinite Boing points with the controls locked).
            if (c.bouncy) {
              this.smashCrate(level, c);
            } else {
              this.slamActive = false;
              this.vVel = TUNING.arrowBounce;
              this.snapFeetToCrateLid(c);
              this.state = 'air';
              this.grounded = false;
              this.bounceRefresh();
              this.score(CONST.ptsBouncy, 'Boing');
              sfx.play('bouncyBounce', 0.9, 0.8);
            }
          } else if (crateStompContacts.has(c)) {
            const perfect = this.rawInput.jumpHeld;
            this.vVel = TUNING.arrowBounce * (perfect ? TUNING.arrowBoostMult : 1);
            // snap to the lid: a deep stomp frame left the feet inside the
            // box, and the next rising frame would sideways-eject (the
            // no-input bounce drift). Bounce OFF the top, cleanly.
            this.snapFeetToCrateLid(c);
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
            this.charging = false;
            this.chargeTimer = 0;
            this.score(CONST.ptsBouncy * (perfect ? 2 : 1), perfect ? 'Perfect Boing' : 'Boing');
            sfx.play('bouncyBounce', 0.9, perfect ? 1.3 : 1);
            if (perfect) this.emitSparks(6, 0xfff3d0, 1.4);
          } else if (crateBonkContacts.has(c)) {
            this.vVel = -1; // head bonk on the underside
          } else if (
            c.bouncy &&
            (this.uberTimer > 0 ||
              (this.freeSkate && Math.abs(crateContactSpeed) >= TUNING.smashSpeed))
          ) {
            // WOOD arrows are still WOOD: fast skating plows straight through
            // them like any plain box. (They only ever got the metal branch's
            // wall treatment below, which made them unsmashable on the board
            // at any speed — a full-tilt line into one was a wall crash.)
            this.smashCrate(level, c);
            crateBoardSmashTax = true;
          } else if (this.isLatchedCrateTopCarry(c.box)) {
            // The short lid claim owns this tiny trailing-edge overlap.
          } else {
            const bx = this.pos.x;
            const bz = this.pos.z;
            const bs = this.speed;
            if (!this.pushOutOf(c.box))
              this.wallSmack(bx, bz, bs, c.box); // typed solid: generic low/high obstacle response
          }
        }
        continue;
      }
      if (c.metal) {
        // BLANK METAL: a slab. It never breaks, and — unlike its arrow-faced
        // cousin and the '!' switch — it does not throw you either. Landing on
        // one is landing on a lid: the drop stops dead and you are stood on
        // top of it, which is the whole point of having a metal box that is
        // not a bounce pad. Everything else it does is what any unbreakable
        // box does: a headbutt from below is a hard stop, and running into the
        // side at speed is a wall crash.
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.isBailing) {
            if (this.grounded) this.pushOutOf(c.box); // a tumbling body: scenery
          } else if (crateStompContacts.has(c)) {
            if (this.slamActive) {
              // Seat first so the shock origin is the lid contact. The metal
              // survives; eligible crates below it still receive the wave.
              this.standOnCrate(c);
              this.slamImpact(level);
            } else {
              this.standOnCrate(c); // NO POP: the difference from every other lid
            }
            sfx.play('crateBounce', 0.45, 0.7); // a dull metal thud, not a boing
          } else if (crateBonkContacts.has(c)) {
            this.vVel = Math.min(this.vVel, -1);
          } else if (this.state === 'grind') {
            // a slab across the rail line knocks you off like any other
            // unbreakable box, unless a mask covers it
            if (this.invulnTimer <= 0 && !this.spendMask()) this.bailFromRail(0, level);
          } else if (this.isLatchedCrateTopCarry(c.box)) {
            // Crate-top carry, not a side impact.
          } else {
            const bx = this.pos.x;
            const bz = this.pos.z;
            const bs = this.speed;
            if (!this.pushOutOf(c.box))
              this.wallSmack(bx, bz, bs, c.box); // typed solid: generic low/high obstacle response
          }
        }
        continue;
      }
      if (c.bang || c.nitroBang) {
        // '!' SWITCH, either colour: any real hit fires it — spin, stomp,
        // headbutt, slide, or a grind-through. It stays solid (bounce off the
        // lid like a box that refuses to break) and never counts toward the
        // tally. The green one is the same box with a different charge: it
        // sets off every nitro instead of materializing outlines.
        if (this.spinning && this.spinBox.intersectsBox(c.box)) {
          level.triggerBang(c);
        } else if (this.playerBox.intersectsBox(c.box)) {
          if (this.isBailing) {
            // tumbling body: the switch is scenery (no mid-ragdoll bounce)
            if (this.grounded) this.pushOutOf(c.box);
          } else if (crateStompContacts.has(c)) {
            level.triggerBang(c);
            this.slamActive = false; // same anti-relock rule as the metal arrow
            this.vVel = TUNING.crateBounce;
            this.snapFeetToCrateLid(c);
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
            this.charging = false;
            this.chargeTimer = 0;
            sfx.play('crateBounce', 0.7);
          } else if (crateBonkContacts.has(c)) {
            level.triggerBang(c);
            this.vVel = -1;
          } else if (this.state === 'grind') {
            level.triggerBang(c); // grind-through flips it — no bail, no shove
          } else if (this.sliding || this.uberTimer > 0) {
            level.triggerBang(c);
            this.pushOutOf(c.box);
          } else if (this.isLatchedCrateTopCarry(c.box)) {
            // Crate-top carry, not a side impact.
          } else {
            const bx = this.pos.x;
            const bz = this.pos.z;
            const bs = this.speed;
            if (!this.pushOutOf(c.box))
              this.wallSmack(bx, bz, bs, c.box); // typed solid: generic low/high obstacle response
          }
        }
        continue;
      }
      if (this.spinning && this.spinBox.intersectsBox(c.box)) {
        this.smashCrate(level, c);
      } else if (this.playerBox.intersectsBox(c.box)) {
        if (this.isBailing) {
          // A TUMBLING BODY neither smashes nor stomps — the box is scenery.
          // (Measured: the trip-over arc used to re-enter here as a STOMP,
          // smash the very crate that tripped it and crateBounce 14 back into
          // the sky.) Airborne it arcs clean over with no shove — a push here
          // pins the arc against the near face; down and sliding it's a wall.
          if (this.grounded) this.pushOutOf(c.box);
        } else if (this.uberTimer > 0 && !crateStompContacts.has(c)) {
          // Uber: boxes shatter on touch (stomps below still bounce).
          this.smashCrate(level, c);
        } else if (this.sliding) {
          // Slides smash boxes without breaking stride.
          this.smashCrate(level, c);
        } else if (this.state === 'grind') {
          // Crates on the rail line are obstacles: spin them, hop them, or
          // hit them FAST enough to shatter straight through — otherwise
          // they knock you off (a mask absorbs it). Mask crates are the
          // exception: grinding through one always pops it (it's a reward,
          // not a trap).
          if (c.mask || this.grindVel >= TUNING.smashSpeed || this.spendMask()) this.smashCrate(level, c);
          else this.bailFromRail(0, level);
        } else if (crateStompContacts.has(c)) {
          // Crash rules: landing on top breaks it and bounces you — high
          // enough to chain crate to crate. The final Unity rule keeps a true
          // stomp authoritative even while the loose board is elsewhere.
          if (
            c.multiHit &&
            !this.ttActive &&
            !this.comboRun &&
            !this.slamActive
          )
            this.hitMultiCrate(level, c);
          else this.smashCrate(level, c);
          if (!this.slamActive) {
            this.snapFeetToCrateLid(c);
            this.vVel = TUNING.crateBounce;
            sfx.play('crateBounce', 0.7);
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
          }
        } else if (crateBonkContacts.has(c)) {
          // A true underside crossing breaks wood regardless of where the
          // separately simulated loose deck landed.
          if (c.multiHit && !this.ttActive && !this.comboRun) {
            this.hitMultiCrate(level, c);
            // Reverse out of the underside. Leaving the body rising inside a
            // crate that survived let one jump consume several fixed-step
            // hits before the capsule escaped.
            this.vVel = -1;
            sfx.play('crateBounce', 0.55, 1.3);
          } else {
            this.smashCrate(level, c);
            this.vVel = Math.min(this.vVel, 2);
          }
        } else if (Math.abs(crateContactSpeed) >= TUNING.smashSpeed) {
          // Fast skating plows straight through plain crates — barely
          // breaking stride. TNT and nitro stay dangerous; this is only
          // the everyday wood.
          this.smashCrate(level, c);
          crateBoardSmashTax = true;
        } else if (this.crateTrip(c.box)) {
          // Too slow to smash, too fast to stop: shins catch the box and the
          // body pitches OVER it, tumbling down the far side (crateTrip did
          // the launch). The crate doesn't care.
        } else if (this.canStandOnCrate(c.box)) {
          this.standOnCrate(c);
        } else if (this.isLatchedCrateTopCarry(c.box)) {
          // A few centimetres of overlap while walking lid-to-lid must not
          // eject the player or fabricate enough measured speed to mount.
        } else {
          // Bumping does nothing to the crate — it's a wall. Full stop.
          this.pushOutOf(c.box);
        }
      }
    }
    if (crateBoardSmashTax && !this.isBailing)
      this.speed *= 0.92;

    // Typed foes publish per-frame flags (see Level.updateEnemies): spinKill /
    // stompKill / meleeKill / touchHurt / spinRecoil. The rules below read them
    // so each kind's "which attack works" is data, not a special case here.
    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (this.spinning && this.spinBox.intersectsBox(e.box)) {
        if (e.spinKill) {
          // Spin PINGS the enemy away — it can smash crates it happens to hit.
          const fling = e.group.position.clone().sub(this.pos).setY(0);
          if (fling.lengthSq() < 0.01) fling.copy(this.axisF).multiplyScalar(Math.sign(this.speed || 1));
          fling.normalize().multiplyScalar(42); // pinball ricochet
          fling.y = 10;
          level.killEnemy(e, fling);
          this.score(CONST.ptsEnemy, 'Takedown');
          continue;
        }
        if (e.spinRecoil) {
          // armored shell: the spin just knocks it back — safe, but no kill
          const key = e.axis === 'z' ? 'z' : 'x';
          const away = Math.sign(e.group.position[key] - this.pos[key]) || 1;
          e.group.position[key] += away * 0.8;
          e.dir = away;
          sfx.play('crateBounce', 0.5, 0.7);
          continue;
        }
        // else: spinning does NOT protect (active blades, a charging bull) —
        // fall through and take the hit below.
      }
      if (this.playerBox.intersectsBox(e.box)) {
        if (e.kind === 'car' && this.pos.y > e.box.max.y - 0.8) {
          // ROOF GRAZE: the top of traffic is safe. A falling touch skips you
          // off the roof with a little pop instead of killing you. The band
          // is 0.8 so the HOOD (1.9 above the deck at 1.69x, box top 2.54)
          // counts as "top" too — only body-height contact kills.
          if (this.vVel < 0 && !this.grounded) {
            this.vVel = Math.max(6, -this.vVel * 0.45);
            this.pos.y = e.box.max.y + 0.02;
            sfx.play('crateBounce', 0.5, 1.15);
          }
          continue;
        }
        if ((this.uberTimer > 0 || this.sliding) && e.meleeKill) {
          // Uber plows through; Crash 3 rules: the slide takes out enemies too.
          level.killEnemy(e);
          this.score(CONST.ptsEnemy, 'Takedown');
        } else if (this.isStomping(e.box) && e.stompKill) {
          // Crash rules: jumping on an enemy squashes it and bounces you
          // (slams punch straight through instead).
          level.killEnemy(e);
          this.score(CONST.ptsEnemy, 'Bonk');
          if (!this.slamActive) {
            this.vVel = TUNING.crateBounce;
            sfx.play('crateBounce', 0.7);
            this.state = 'air';
            this.grounded = false;
            // Was hand-rolling airGrav='foot' and calling itself "the same rule
            // as bounceRefresh" while skipping the rest of it — so an enemy
            // stomp, alone among the six bounce handlers, never re-armed the
            // double jump. Use the real thing.
            this.bounceRefresh();
            this.charging = false;
            this.chargeTimer = 0;
          }
        } else {
          // Not a valid attack for this foe. If it's dangerous right now it
          // hurts (spikes, active blades, a dashing bull, a bad-timed stomp on
          // a leaping frog); if it's in a safe window (retracted blades, a
          // dizzy bull) you just bump it. invuln grace + mask absorb apply.
          if (!e.touchHurt) continue;
          if (this.uberTimer > 0 || this.invulnTimer > 0) continue;
          this.enemyTouch.copy(e.box).expandByScalar(-0.15);
          if (!this.playerBox.intersectsBox(this.enemyTouch)) continue;
          if (this.spendMask()) {
            const away = this.pos.clone().sub(e.group.position).setY(0);
            if (away.lengthSq() < 0.01) away.copy(this.axisF).multiplyScalar(-1);
            away.normalize();
            this.pos.addScaledVector(away, 1.1);
            this.speed *= 0.4;
            continue;
          }
          this.die();
          return;
        }
      }
    }

    for (const value of level.grindosauri) {
      const contact =
        this.playerBox.intersectsBox(value.body) ||
        (this.spinning && this.spinBox.intersectsBox(value.body));
      if (!value.alive || !contact) continue;
      // Its spine has exactly one safe interaction: an upright, top-side
      // grind on that same moving rail. Under-rail catches and every body
      // attack remain lethal; the creature is retired only by riding enough
      // of the spine all the way off an endpoint.
      if (
        this.state === 'grind' &&
        this.grindRail === value.rail &&
        !this.railUnder &&
        this.underK <= 1e-4
      )
        continue;
      this.die();
      return;
    }

    for (const value of level.angryBalls) {
      if (!value.alive) continue;
      const bodyContact = this.playerBox.intersectsBox(value.box);
      const spinContact = this.spinning && this.spinBox.intersectsBox(value.box);
      if (!bodyContact && !spinContact) continue;
      if (spinContact) {
        level.defeatAngryBall(value);
        this.score(CONST.ptsEnemy, 'Angry Ball');
        continue;
      }
      if (this.isStomping(value.box)) {
        level.defeatAngryBall(value);
        this.score(CONST.ptsEnemy, 'Angry Ball');
        if (!this.slamActive) {
          this.pos.y = value.box.max.y + CRATE_STAND_LIFT;
          this.vVel = TUNING.crateBounce;
          this.state = 'air';
          this.grounded = false;
          this.bounceRefresh();
          sfx.play('crateBounce', 0.7);
        }
        continue;
      }
      if (this.uberTimer > 0 || this.sliding) {
        level.defeatAngryBall(value);
        this.score(CONST.ptsEnemy, 'Angry Ball');
        continue;
      }
      if (this.invulnTimer > 0) continue;
      if (this.spendMask()) {
        this.speed *= 0.5;
        continue;
      }
      this.die();
      return;
    }

    // Sentry orbs: contact hurts (uber/invuln/mask absorb it); the orb pops.
    for (let i = level.projectiles.length - 1; i >= 0; i--) {
      const pr = level.projectiles[i];
      if (!this.playerBox.intersectsBox(pr.box)) continue;
      level.popProjectile(i);
      if (this.uberTimer > 0 || this.invulnTimer > 0) continue;
      if (this.spendMask()) { this.speed *= 0.6; continue; }
      this.die();
      return;
    }

    // Rolling stones: flatten you on touch (uber/invuln/mask absorb it).
    for (const st of level.stones) {
      if (this.playerBox.intersectsBox(st.box)) {
        if (this.uberTimer > 0 || this.invulnTimer > 0) continue;
        if (this.spendMask()) {
          this.speed *= 0.5;
          continue;
        }
        this.die();
        return;
      }
    }

    // Swinging blades and other touch-kill hazards: same rules as stones.
    // Death pits use the body box WITHOUT the grind reach-down — grinding a
    // rail strung over lava is a THPS staple, only real feet contact burns.
    for (const hz of level.killBoxes) {
      const box =
        this.state === 'grind' && level.pitBoxes.includes(hz) ? this.feetBox : this.playerBox;
      if (box.intersectsBox(hz)) {
        // drawn (polygon) pits: the box is just the broad phase — only the
        // actual shape burns
        if (level.pitMissesPoly(hz, this.pos.x, this.pos.z)) continue;
        if (this.uberTimer > 0 || this.invulnTimer > 0) continue;
        if (this.spendMask()) {
          this.speed *= 0.5;
          continue;
        }
        this.die();
        return;
      }
    }

    // Tumble zones (the coast bluffs): touching one doesn't kill on the
    // spot — it throws the body into a full ragdoll bail, and the steep-bail
    // slide carries it down the fall line with the dust flying. The water at
    // the bottom is the actual kill. Re-arms after every get-up, so clawing
    // upright halfway down the face just starts the next tumble.
    if (!this.isBailing) {
      for (const tz of level.tumbleBoxes) {
        if (this.playerBox.intersectsBox(tz)) {
          this.bail();
          this.startRagdoll('side', 1); // re-seed: a cliff exit ROLLS off the edge
          break;
        }
      }
    }

    // Crushers: the block is a solid wall while resting or rising, and a
    // press while it slams — get caught under it and you're flattened.
    for (const cr of level.crushers) {
      if (!this.playerBox.intersectsBox(cr.box)) continue;
      if (cr.crushing) {
        if (this.uberTimer > 0 || this.invulnTimer > 0) continue;
        if (this.spendMask()) {
          this.speed *= 0.5;
          continue;
        }
        this.die();
        return;
      }
      if (this.state !== 'grind') this.pushOutOf(cr.box);
    }

    // Solid walls: shove out, full stop, nothing breaks. NEVER while
    // grinding — the rail owns the position, and a wall collider brushing
    // the rail line (berm lips!) must not wrestle you off it.
    if (this.state !== 'grind' && !this.wallriding) {
      const ledgeEnvelope = ledgeCatchEnvelope(
        TUNING.ledgeReach,
        level.ledgeAssist,
        this.ledgeEnvelope,
      );
      for (const w of level.walls) {
        // A tumbling airborne body flung over a LOW solid (the log it just
        // tripped on) must pass over the top, not get pinned at the face.
        if (this.isBailing && !this.grounded && w.max.y < this.pos.y + 0.35) continue;
        if (this.playerBox.intersectsBox(w)) {
          if (this.tryWallride(w, level)) break; // stuck to the wall — ride it
          const wallPath = level.wallPathForBox(w);
          if (wallPath) {
            const contact = level.closestWallPath(
              wallPath,
              this.pos.x,
              this.pos.z,
              level.wallPathSegmentForBox(w),
            );
            const playerRadius =
              wallPath.halfThickness +
              Math.abs(contact.nx) * CONST.playerHalf.x +
              Math.abs(contact.nz) * CONST.playerHalf.z;
            if (
              !contact.cap &&
              contact.distance <= playerRadius + 0.12 &&
              this.tryLedgeGrab(w, level)
            )
              break;
            const bx = this.pos.x;
            const bz = this.pos.z;
            const bs = this.speed;
            const resolved = this.pushOutOfWallPath(w, wallPath, level);
            if (resolved === null) continue;
            if (!resolved) this.wallSmack(bx, bz, bs, w);
            break; // one logical path resolves once, never once per broadphase slice
          }
          if (this.tryLedgeGrab(w, level)) break; // caught its lip — hanging
          const bx = this.pos.x;
          const bz = this.pos.z;
          const bs = this.speed; // pushOutOf full-stops; keep the crash speed
          if (!this.pushOutOf(w))
            this.wallSmack(bx, bz, bs, w); // face-first at speed: that's a wipeout — or a fling over a low one
        } else if (
          // NEAR-MISS CATCH: a wall bonk shoves the body just clear of the
          // face and kills the arc's push (slide jumps steer-lock, so nothing
          // re-presses) — falling a hair off the face must still offer the
          // grab, or those jumps slide down 3cm out of reach forever.
          this.state === 'air' &&
          this.vVel <= ledgeEnvelope.maximumRisingSpeed &&
          HANG_BOX.copy(this.playerBox)
            .expandByScalar(ledgeEnvelope.nearMiss)
            .intersectsBox(w) &&
          this.tryLedgeGrab(w, level)
        )
          break;
      }
      // No wall box caught you — try the MESH edge. The jungle's pit lips,
      // displaced strips and polygon platforms have no wall colliders at
      // their gap faces, so falling past them was ungrabbable by the loop
      // above no matter how clean the reach was.
      if (this.state === 'air') this.tryLedgeGrabMesh(level);
    }

    // Rails are solid on foot: a side-on walk is curbed, a fast skate trips.
    // Only while grounded and riding — grinding owns the position, airs clear
    // it, a slide slips under, and a fresh dismount (regrindCd) or knockdown
    // (bailDownT) is left alone. EXCEPT on a halfpipe: the lip grind-rails sit
    // right at the coping, and pumping UP the wall to them must not read as a
    // side-on street-rail hit and trip you — you pop over (or grind them with
    // the grind button, which is a separate path). So skip the trip on the pipe.
    const onPipeSurface = this.groundHit !== null && this.groundHit.name.startsWith('halfpipe');
    if (
      this.state === 'ride' &&
      this.grounded &&
      !this.sliding &&
      !onPipeSurface &&
      !this.isBailing &&
      this.regrindCd <= 0
    ) {
      this.railBlock(level);
    }

    for (const cp of level.checkpoints) {
      if (level.runMode) break; // run modes have no checkpoints — the start IS the checkpoint
      if (cp.active) continue;
      if (this.spinning && this.spinBox.intersectsBox(cp.box)) {
        this.bankCheckpoint(level, cp);
      } else if (this.playerBox.intersectsBox(cp.box)) {
        if (this.isBailing) {
          // tumbling body: no banking, no bounce — scenery
          if (this.grounded) this.pushOutOf(cp.box);
        } else if (this.sliding) {
          this.bankCheckpoint(level, cp);
        } else if (this.isStomping(cp.box)) {
          this.bankCheckpoint(level, cp);
          this.vVel = TUNING.crateBounce;
          this.snapFeetToCrateLid(cp); // bounce OFF the lid, no re-intersect
          sfx.play('crateBounce', 0.7);
          this.state = 'air';
          this.grounded = false;
          this.bounceRefresh();
        } else if (this.isBonking(cp.box)) {
          this.bankCheckpoint(level, cp);
          this.vVel = Math.min(this.vVel, 2);
        } else if (Math.abs(this.speed) >= TUNING.smashSpeed) {
          // Fast skating banks it on the way through, same as plain crates.
          this.bankCheckpoint(level, cp);
          this.speed *= 0.92;
        } else if (this.crateTrip(cp.box)) {
          // tripped clean over the checkpoint — it does NOT bank; earn it properly
        } else {
          // Slow bump = wall, like a normal box. Spin, slide, or stomp to bank it.
          this.pushOutOf(cp.box);
        }
      }
    }

    // Floating wumpa: touch to collect — but a spin smacks it away.
    for (const p of level.pickups) {
      if (level.runMode) break; // no fruit in a run mode
      if (!p.alive) continue;
      if (this.spinning && this.spinBox.intersectsBox(p.box)) {
        p.alive = false;
        p.mesh.visible = false;
        sfx.play('fruitSpun', 0.7);
      } else if (this.playerBox.intersectsBox(p.box)) {
        p.alive = false;
        p.mesh.visible = false;
        this.flyFruit(p.mesh.position); // tally ticks when it lands on the HUD counter
      }
    }

    // The level crystal: ride/walk/fly through it and it's yours (a death
    // won't take it back; only a hard reset re-seats it).
    const cr = level.crystalPickup;
    if (cr && !cr.collected && !level.runMode && this.playerBox.intersectsBox(cr.box)) {
      this.hasCrystal = true;
      level.collectCrystal();
      sfx.play('crystalGet', 0.9);
      this.score(CONST.ptsCrystal, 'Crystal');
      // no toast: the sound, the burst and the HUD relic lighting up say it
    }

    // The all-boxes gem, once it has materialized. Silent on purpose — same
    // reason as the crystal above.
    const gp = level.gemPickup;
    if (gp && !gp.collected && !level.runMode && this.playerBox.intersectsBox(gp.box)) {
      level.collectGem();
      this.gemEarned = true;
      sfx.play('crystalGet', 0.9);
      this.score(CONST.ptsGem, 'Gem');
    }

    // The trial stopwatch: touch it and the clock starts NOW.
    const ck = level.clockPickup;
    if (level.runModesOn && ck && !ck.collected && !this.ttActive && !this.comboRun && this.playerBox.intersectsBox(ck.box)) {
      level.collectClock();
      level.setTimeTrial(true);
      this.ttActive = true;
      this.ttTime = 0;
      this.ttFreeze = 0;
      sfx.play('crystalGet', 0.9);
      this.onTTStart();
    }

    // The green orb: touch it and the combo run begins — the green gem
    // materializes at the finish gate, yours if you get there in ONE combo.
    const orb = level.comboOrb;
    if (level.runModesOn && orb && !orb.collected && !this.comboRun && !this.ttActive && this.playerBox.intersectsBox(orb.box)) {
      level.collectComboOrb();
      level.setComboRun(true);
      level.spawnComboGem();
      this.comboRun = true;
      this.comboWasLive = false;
      this.comboFailT = 0;
      this.comboGraceT = 2.5; // start comboing NOW — no strolling to the gem
      this.comboGraceWarned = false;
      sfx.play('crystalGet', 0.9, 1.25);
      this.onComboRunStart();
    }

    // The green gem: only a LIVE combo may take it. Success ends the run
    // cleanly — normal play resumes with the gem in your pocket.
    const cg = level.comboGem;
    if (cg && this.comboRun && this.comboFailT <= 0 && this.comboMult > 0 && this.playerBox.intersectsBox(cg.box)) {
      this.comboGemEarned = true;
      this.comboRun = false;
      level.removeComboGem(true);
      level.setComboRun(false);
      this.bankCombo(); // the run's combo cashes in as the prize lands
      this.points += CONST.ptsCrystal;
      sfx.play('crystalGet', 1.0);
      this.onComboRunWin();
    }

    // LAND ON THE PAD. This used to be playerBox vs level.finishBox — a 14-wide,
    // 30-tall slab spanning the whole gate, so anything that broke the plane
    // finished the run: rolling past the pad's shoulder, or sailing over it
    // three storeys up. The pad is the goal now, so the goal is its actual
    // surface — every mesh in it is flagged finishPad, and you have to be
    // standing on one. (finishBox stays: the outro still clamps across it.)
    // Two ways in, and neither is the old plane-crossing. Stand on the pad, or
    // fly through the plasma column — an ollie straight into the glow counts,
    // no touchdown required. The column's box starts above head height for
    // someone on the deck, so rolling past its shoulder still does nothing.
    const onPad = this.grounded && !!this.groundHit?.finishPad;
    if (onPad || this.playerBox.intersectsBox(level.finishGlow)) {
      this.bankCombo(); // whatever is pending counts as you arrive
      sfx.play('lifeGet', 1.0);
      this.state = 'finished';
      // Planted, not coasting — but only when you actually landed on it.
      // Killing the speed of someone who jumped THROUGH the glow would stop
      // them dead in mid-air.
      if (onPad) this.speed = 0;
      // A COMBO RUN ends on the line too. bankCombo() above just closed the
      // chain, so without this the watchdog below sees "comboRun live, combo
      // just ended, gem still out there", calls failComboRun, and 1.2s after
      // COURSE CLEAR kills you and restarts the level you had already beaten.
      // The time trial has always been retired here; this is the same rule.
      if (this.comboRun) {
        this.comboRun = false;
        level.setComboRun(false);
        this.comboFailT = 0;
        this.comboWasLive = false;
        this.comboGraceT = 0;
        this.onComboRunEnd();
      }
      if (this.ttActive) {
        this.ttActive = false; // the clock stops dead on the line
        this.onTTFinish(this.ttTime);
      } else {
        this.onFinish(this.runTime);
      }
    }
  }

  // The combo broke with the gem still out there: the prize evaporates and
  // the despair beat starts (halo dissipates → fade out → back to the start).
  private failComboRun(level: Level): void {
    this.comboFailT = 1.2;
    level.removeComboGem();
    sfx.play('skateHalt', 0.5, 0.8);
    this.onComboRunFail();
  }

  // A crate bounce is a fresh launch: the double jump re-arms, its window
  // clock restarts (next frame records the bounce pop as the window's scale),
  // and even a skate-origin air earns ONE extra tap off the lid.
  private bounceRefresh(): void {
    this.airJumpUsed = false;
    this.doubleJumpAir = false;
    this.airborneT = 0;
    this.airPeakY = this.pos.y;
    this.bounceJump = true;
    // A bounce is a fresh launch, so it re-declares its own gravity — and a
    // crate bounce is Crash vocabulary, not skate vocabulary. crateBounce 14
    // and arrowBounce 16 are documented as tuned for chaining crate to crate
    // under the platforming arc, so pin every bounce to 'foot' whatever the
    // air that landed on the lid was. Otherwise stomping a crate mid-ollie
    // would quietly retime every chain in the game.
    this.airGrav = 'foot';
    // A fresh launch also RETIRES a held jump charge. This used to be copied
    // out at each call site, and two of the seven — the plain crate and the
    // checkpoint crate — never got the copy, so a charge held across those
    // two bounce types survived into collide() inside the coyote window and
    // converted the bounce into a chargedJump (suppressing footAir control),
    // while every other crate type retired it. Centralised here so the next
    // bounce handler cannot forget it either — which is exactly how the enemy
    // stomp lost its double-jump re-arm.
    this.charging = false;
    this.chargeTimer = 0;
  }

  // BANKING A CHECKPOINT is breaking a box. The checkpoint crate counts
  // toward the gem tally the same way a plain box does, so the tally has to go
  // up BEFORE activateCheckpoint snapshots it — otherwise a soft respawn at
  // this very checkpoint would restore a count one short of itself, and the
  // gem would be one box out of reach for the rest of the life.
  private bankCheckpoint(level: Level, cp: Checkpoint): void {
    if (!cp.active) {
      this.cratesBroken++;
      this.score(CONST.ptsCrate, 'Box');
    }
    level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
    this.onCheckpoint();
  }

  // Came down on a box that isn't going to break. Kill the drop, seat the feet
  // on the lid and light identity-bearing support. Unity enters grounded Ride
  // here; web keeps one final air tick so the ordinary landing path can judge
  // grabs/spins and retire every board-air/combo flag. Consuming airRose makes
  // that handoff eligible for its own latch: without it, a RISING metal lid is
  // reclassified as a side overlap next tick and ejects the rider by 0.5m.
  private standOnCrate(c: Crate): void {
    this.slamActive = false;
    this.vVel = 0;
    this.snapFeetToCrateLid(c);
    this.airRose = false;
    this.crateFloorT = CRATE_STAND_GRACE;
    this.crateFloor = c;
    this.groundHit = {
      y: this.pos.y,
      normal: CRATE_UP.clone(),
      name: 'crate',
      vert: false,
      crate: c,
    };
    this.surfaceName = 'crate';
    this.rideNormal.copy(CRATE_UP);
  }

  private snapFeetToCrateLid(c: { box: THREE.Box3 }): void {
    const oldY = this.pos.y;
    this.pos.y = c.box.max.y + CRATE_STAND_LIFT;
    this.translateCollisionBoxes(0, this.pos.y - oldY, 0);
  }

  private canStandOnCrate(box: THREE.Box3): boolean {
    const retainedRide = this.state === 'ride';
    const walkedOffGroundOntoLid =
      this.state === 'air' &&
      this.coyoteTimer > 0 &&
      !this.freeSkate &&
      !this.airFromSkate &&
      !this.airRose &&
      this.vVel <= 0;
    return (
      (retainedRide || walkedOffGroundOntoLid) &&
      this.prevPos.y >= box.max.y - CRATE_STAND_REACH &&
      this.crateLidOverlapsSole(box, this.pos.x, this.pos.z)
    );
  }

  private isLatchedCrateTopCarry(box: THREE.Box3): boolean {
    return (
      this.crateFloorT > 0 &&
      this.grounded &&
      !this.freeSkate &&
      this.pos.y >= box.max.y - 0.05 &&
      this.pos.y <= box.max.y + 1.1
    );
  }

  private crateLidOverlapsSole(
    box: THREE.Box3,
    x: number,
    z: number,
  ): boolean {
    const overlapX =
      Math.min(x + CONST.playerHalf.x, box.max.x) -
      Math.max(x - CONST.playerHalf.x, box.min.x);
    const overlapZ =
      Math.min(z + CONST.playerHalf.z, box.max.z) -
      Math.max(z - CONST.playerHalf.z, box.min.z);
    return (
      overlapX >= CRATE_STAND_MIN_OVERLAP &&
      overlapZ >= CRATE_STAND_MIN_OVERLAP
    );
  }

  private hitMultiCrate(level: Level, c: Crate): void {
    const remaining = level.hitMultiCrate(c);
    if (remaining <= 0) this.smashCrate(level, c, 2);
    else {
      this.spawnFruit(c.box, 2);
      this.emitSparks(3, 0xffc45c, 0.8);
    }
  }

  private smashCrate(level: Level, c: Crate, fruitOverride?: number): void {
    const wasAlive = c.alive;
    PUFF_C.copy(c.box.getCenter(PUFF_C));
    const crateFloor = c.box.min.y;
    level.breakCrate(c);
    // switches and metal never actually broke — no tally, no reward
    if (c.alive) return;
    // green '!' sits outside the gem tally; explosives ARE in it, but they
    // tally when they detonate, so counting one here too would double it
    if (!c.nitroBang && !c.nitro && !c.tnt) this.cratesBroken++;
    // The box going is a DUST event, not a wood-chip event: a burst at the
    // crate's own centre, its flat ring on the deck under it, and the haze it
    // leaves behind — all three are children of the one preset, fired off one
    // seed so the whole cloud replays identically.
    if (wasAlive)
      puffs.burst('crateSmash', PUFF_C.x, PUFF_C.y, PUFF_C.z, {
        surface: 'wood',
        groundY: crateFloor,
        strength: 1,
      });
    this.score(CONST.ptsCrate, 'Box');
    this.crateReward(c, fruitOverride);
  }

  // What falls out of a broken box. Mystery crates roll their contents.
  private crateReward(c: Crate, fruitOverride?: number): void {
    // Explosives now count toward the box tally, but blowing one up is not a
    // reward — no fruit falls out of a nitro.
    if (c.nitro || c.tnt) return;
    // RUN-MODE rules (time trial / combo run): numbered crates freeze the
    // clock, boost crates pay out speed or perfect balance, masks still
    // work — everything else is an empty box. No fruit, no lives.
    if (this.ttActive || this.comboRun || c.timeSecs || c.boost) {
      if (c.timeSecs) {
        this.ttFreeze += c.timeSecs;
        this.emitSparks(8, 0xffd75e, 2);
        sfx.play('crystalGet', 0.55, 1.4);
      } else if (c.boost === 'balance') {
        this.balanceBoostT = Math.min(this.balanceBoostT + 6, 24); // stacks — up to four laps of the ring
        this.emitSparks(10, 0x46e882, 2.2);
        sfx.play('crystalGet', 0.5, 1.2);
      } else if (c.mask) {
        this.gainMask();
      }
      return;
    }
    if (fruitOverride !== undefined) {
      this.spawnFruit(c.box, fruitOverride);
    } else if (c.mask) {
      this.gainMask();
    } else if (c.life) {
      this.gainLife();
    } else if (c.multiHit) {
      // A force-smash (spin/slam/skate/grind/blast) bypasses the five-hit
      // sequence and pays the deliberately smaller one-fruit consolation.
      this.spawnFruit(c.box, 1);
    } else if (c.mystery) {
      const r = this.simRand();
      if (r < 0.55) this.spawnFruit(c.box, 5);
      else if (r < 0.8) this.spawnFruit(c.box, 10);
      else if (r < 0.93) this.gainMask();
      else this.gainLife();
    } else {
      this.spawnFruit(c.box);
    }
  }

  private gainLife(): void {
    // Endless mode has no life economy; explicit/rolled life awards are inert
    // there just like the retired 100-fruit threshold.
    if (this.endlessDeaths) return;
    this.lives++;
    sfx.play('lifeGet', 1.0);
    this.emitSparks(10, 0x9fe07a, 2);
  }

  // Central wumpa collection: 100 fruit converts into a life, Crash rules.
  private collectFruit(): void {
    if (this.endlessDeaths) {
      // No purse and no 100-fruit life threshold: every arrival is a permanent
      // face-value award, outside the pending combo multiplier.
      this.points += CONST.ptsFruit;
      const note = Math.floor(this.points / Math.max(1, CONST.ptsFruit)) % 3;
      sfx.play(['wumpa1', 'wumpa2', 'wumpa3'][note], 0.6);
      return;
    }
    this.fruit++;
    this.score(CONST.ptsFruit);
    if (this.fruit >= 100) {
      this.fruit -= 100;
      this.lives++;
      sfx.play('lifeGet', 1.0);
    } else {
      sfx.play(['wumpa1', 'wumpa2', 'wumpa3'][this.fruit % 3], 0.6);
    }
  }

  // A body to put a wumpa in.
  //
  // The pool GROWS. It was a fixed 24, a number from when fruit was a burst
  // effect that lived about a second — a cap you could never reach because
  // everything cleared itself almost immediately. Fruit hangs around waiting
  // to be picked up now, so 24 became a real ceiling, and a ceiling on how
  // much fruit a level may have on the floor at once is not a rule this game
  // should have. Bodies are a Group over shared geometry and a shared
  // material, and three.js frustum-culls per object, so fruit you have run
  // past costs a matrix update and a sphere test, not a draw call.
  //
  // FRUIT_MAX is a runaway guard, not a design limit — far above any level.
  private freeFruit(): (typeof this.fruits)[number] | null {
    for (const f of this.fruits) if (f.phase === 'off') return f;
    if (this.fruits.length < FRUIT_MAX) return this.addFruitBody();
    // Genuinely out: cash in the longest-idling fruit for its slot rather than
    // drop the new one. Only reachable if something has gone wrong.
    let oldest: (typeof this.fruits)[number] | null = null;
    for (const f of this.fruits)
      if (f.phase === 'idle' && (!oldest || f.t > oldest.t)) oldest = f;
    if (oldest) {
      this.collectFruit();
      return oldest;
    }
    return null;
  }

  /** One more wumpa body, on the world layer, parked and invisible. */
  private addFruitBody(): (typeof this.fruits)[number] {
    // The art is built at ONE unit tall and sized by the holder, so the same
    // body can be a world-scale fruit one frame and a fixed slice of the
    // screen the next without ever fighting the loader, which rescales the
    // art's own group when the model finally arrives.
    const mesh = new THREE.Group();
    mesh.add(wumpaMesh(1));
    mesh.scale.setScalar(WUMPA_SIZE);
    mesh.visible = false;
    this.worldScene.add(mesh);
    const f = {
      mesh,
      vel: new THREE.Vector3(),
      phase: 'off' as const as (typeof this.fruits)[number]['phase'],
      t: 0,
      hop: 0,
      home: new THREE.Vector3(),
      sx: 0,
      sy: 0,
    };
    this.fruits.push(f);
    return f;
  }

  // Smash the box and the fruit is THERE: floating where the crate stood, in a
  // tight cluster, waiting.
  //
  // It used to fire out on a ballistic arc and scatter. That was doing too
  // much — the crate already throws splinters, and fruit tumbling off in five
  // directions turns one clear "you got five wumpa" into a hunt. Crash puts
  // them in a clump exactly where the box was and leaves them hanging; the
  // payload reads at a glance because the cluster is bigger, not because the
  // pieces went further.
  private spawnFruit(box: THREE.Box3, n = CONST.fruitPerCrate): void {
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (let i = 0; i < n; i++) {
      const f = this.freeFruit();
      // Nothing to put it in and nothing to reclaim: the fruit is still owed,
      // so bank it rather than drop it.
      if (!f) {
        this.collectFruit();
        continue;
      }
      // Phyllotaxis: each fruit a golden angle round from the last, radius
      // going as sqrt(index). It fills outward evenly with no seam and no
      // stacked pair, and the coefficient is small enough that neighbours
      // OVERLAP — a clump, which is what a payload should look like, rather
      // than a ring of separate collectables.
      const a = i * 2.39996323;
      const r = 0.3 * Math.sqrt(i);
      f.phase = 'idle';
      f.t = i * 0.7; // stagger the bob so the clump breathes, not pulses
      // A HAIR of stagger across the clump so it pops like a handful rather
      // than one rigid object, but nowhere near enough to read as scatter.
      f.hop = FRUIT_HOP_TIME + i * 0.02;
      f.mesh.visible = true;
      f.mesh.scale.setScalar(WUMPA_SIZE);
      f.mesh.rotation.set(0, a, 0);
      f.mesh.position.set(
        cx + Math.cos(a) * r,
        cy + FRUIT_REST_LIFT + ((i % 3) - 1) * 0.16,
        cz + Math.sin(a) * r,
      );
      f.home.copy(f.mesh.position);
      f.vel.set(0, 0, 0);
    }
  }

  // One already-earned wumpa (a touched pickup, or fruit just walked into)
  // leaves `pos` for the HUD counter on the flat overlay layer.
  private flyFruit(pos: THREE.Vector3): void {
    if (this.endlessDeaths) {
      this.collectFruit();
      return;
    }
    const f = this.freeFruit();
    if (!f) {
      this.collectFruit(); // pool exhausted: count it rather than lose it
      return;
    }
    this.beginFruitFlight(f, pos);
  }

  // Hand a fruit to the overlay: work out where it is ON SCREEN right now, so
  // the flight starts exactly where the world body was and the swap between
  // layers is invisible.
  private beginFruitFlight(f: (typeof this.fruits)[number], pos: THREE.Vector3): void {
    if (this.endlessDeaths) {
      this.collectFruit();
      this.retireFruit(f);
      return;
    }
    f.phase = 'fly';
    f.t = 0;
    f.mesh.visible = true;
    f.vel.set(0, 0, 0);
    f.sx = 0.5;
    f.sy = 0.5;
    if (this.cam) {
      FRUIT_P.copy(pos).project(this.cam);
      // BEHIND THE LENS, project mirrors x and y through the origin — a fruit
      // collected behind the camera would set off from the diagonally opposite
      // corner, which reads as coming from nowhere. Undo the mirror first,
      // then clamp, so it starts from the edge it is actually behind.
      const behind = FRUIT_P.z > 1;
      const px = behind ? -FRUIT_P.x : FRUIT_P.x;
      const py = behind ? -FRUIT_P.y : FRUIT_P.y;
      f.sx = THREE.MathUtils.clamp((px + 1) / 2, 0, 1);
      f.sy = THREE.MathUtils.clamp((1 - py) / 2, 0, 1);
    }
    // No pickup sound here: collectFruit still owns it, and it fires when the
    // counter ticks at the end of the flight. Playing one at both ends would
    // just double it.
    this.fruitLayer?.add(f.mesh);
  }

  /**
   * The player's body box RIGHT NOW, optionally widened by a spin's reach.
   *
   * Not `this.playerBox`: that one is rebuilt inside collide(), which runs
   * AFTER updateFruit and does not run at all while hanging, on a rope, or
   * dead — so fruit was being tested against where the body was one frame ago,
   * or against a box frozen at the moment of death.
   */
  private reach(grow: number): THREE.Box3 {
    const half = CONST.playerHalf;
    FRUIT_REACH.setFromCenterAndSize(
      REACH_C.set(this.pos.x, this.pos.y + half.y, this.pos.z),
      REACH_S.set(half.x * 2, half.y * 2, half.z * 2),
    );
    if (grow > 0) FRUIT_REACH.expandByVector(REACH_S.set(grow, 0.2, grow));
    return FRUIT_REACH;
  }

  /** Retire every wumpa hanging in the level, uncollected. */
  private clearLooseFruit(): void {
    for (const f of this.fruits) if (f.phase === 'idle') this.retireFruit(f);
  }

  private updateFruit(dt: number): void {
    // A run mode pays no fruit — crateReward returns before spawnFruit for
    // every crate once ttActive/comboRun is set. Fruit already hanging from
    // BEFORE the run started is the loophole: left alone it stays collectable
    // through a time trial, still scores, and can still hand out a life. Clear
    // it on the frame the run begins.
    if ((this.ttActive || this.comboRun) !== this.fruitRunMode) {
      this.fruitRunMode = this.ttActive || this.comboRun;
      if (this.fruitRunMode) this.clearLooseFruit();
    }
    // A corpse does not pick fruit up. Bodies still in flight finish their
    // trip — they were earned before the death.
    const dead = this.state === 'dead' || this.state === 'gameover';
    for (const f of this.fruits) {
      if (f.phase === 'off') continue;
      if (dead && f.phase === 'idle') continue;
      f.t += dt;

      if (f.phase === 'flung') {
        // smacked away by a spin: pure ballistic, then gone
        f.vel.y -= 26 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
        if (f.t > 0.9) this.retireFruit(f);
        continue;
      }

      if (f.phase === 'fly') {
        // Screen-space run to the HUD counter at a CONSTANT rate. It used to
        // approach exponentially, which is the standard way to chase a moving
        // point and reads here as the fruit losing its nerve — it covers the
        // first half fast and then creeps into the counter. A collectable
        // going where it belongs should not decelerate.
        const hud = this.hudFruitAt?.() ?? null;
        // No HUD to aim at (a menu, the editor, a hidden counter): the corner
        // it lives in is still the right direction.
        const tx = hud ? hud.x : 0.06;
        const ty = hud ? hud.y : 0.06;
        // Screen fractions are not square — x spans an `aspect`-times-wider
        // slice of the world than y — so measure the gap in the overlay's own
        // units, or the fruit would travel faster sideways than it does down.
        const dx = (tx - f.sx) * this.fruitAspect;
        const dy = ty - f.sy;
        const gap = Math.hypot(dx, dy);
        const step = FRUIT_FLY_SPEED * dt;
        if (gap <= step || f.t > 2) {
          this.collectFruit(); // earned either way — a timeout never eats the fruit
          this.retireFruit(f);
          continue;
        }
        f.sx += (dx / gap) * (step / this.fruitAspect);
        f.sy += (dy / gap) * step;
        f.mesh.rotation.y += dt * 5; // turns on the CLOCK, not per drawn frame
        continue;
      }

      // --- idle: floating in the world, waiting to be picked up ---
      // THE SPAWN HOP first: one canned bounce, straight up and back, no
      // horizontal throw at all. A parabola rather than real gravity, because
      // it has to land exactly back on `home` every time — this is a flourish
      // on a collectable, not a physics object, and it must not drift.
      if (f.hop > 0) {
        f.hop -= dt;
        // Clamped BOTH ends, and both ends bite: the per-fruit stagger starts
        // `hop` above the hop length, so an unclamped u goes negative there
        // and sinks the fruit into the crate before it ever rises; and the
        // last step of the timer overshoots zero by up to a frame, so an
        // unclamped u passes 1 and drives the parabola back down through the
        // floor — a 0.14-unit dip on the very frame it was supposed to land.
        const u = Math.min(1, Math.max(0, 1 - f.hop / FRUIT_HOP_TIME));
        f.mesh.position.y = f.home.y + FRUIT_HOP_RISE * 4 * u * (1 - u);
        f.mesh.rotation.y += dt * 3.2; // spins a little livelier on the way up
        // ...and NOTHING can spin it away mid-hop. The spin that broke the
        // box is still swinging when its fruit appears, so without this the
        // reward from a spun crate is instantly batted through the floor,
        // which is the bug this whole hop is here to fix.
        if (this.reach(0).intersectsBox(
          FRUIT_BOX.setFromCenterAndSize(f.mesh.position, FRUIT_GRAB),
        ))
          this.beginFruitFlight(f, f.mesh.position);
        continue;
      }
      // Then bob and turn on the spot, like a level pickup. It hangs where the
      // crate was — no gravity, nothing to land on, nothing to roll away.
      f.mesh.position.y = f.home.y + Math.sin(f.t * 3) * 0.09;
      f.mesh.rotation.y += dt * 1.8;
      // The grab box matches the one a level's own fruit carries (1.2 x 1.5 x
      // 1.2 in Level.pickup): a collectable you have to stand exactly on top
      // of is a collectable you walk past. A SPIN uses the same box — it used
      // to be a centre-point test, which quietly made spinning fruit away much
      // fussier than walking into it and contradicted this very comment.
      FRUIT_BOX.setFromCenterAndSize(f.mesh.position, FRUIT_GRAB);
      if (this.spinning && this.reach(CONST.spinReach).intersectsBox(FRUIT_BOX)) {
        f.phase = 'flung';
        f.t = 0;
        f.vel.set((Math.random() - 0.5) * 16, 8, (Math.random() - 0.5) * 16);
        sfx.play('fruitSpun', 0.7);
        continue;
      }
      if (this.reach(0).intersectsBox(FRUIT_BOX)) {
        this.beginFruitFlight(f, f.mesh.position);
      }
    }
  }

  /** Back to the pool, off whichever layer it was on. */
  private retireFruit(f: (typeof this.fruits)[number]): void {
    f.phase = 'off';
    f.hop = 0;
    f.mesh.visible = false;
    f.mesh.scale.setScalar(WUMPA_SIZE);
    f.mesh.rotation.set(0, 0, 0);
    if (f.mesh.parent !== this.worldScene) this.worldScene?.add(f.mesh);
  }

  /**
   * Draw the collected fruit. Called from the frame loop after the world and
   * before the HUD icons, with the renderer the game already owns.
   *
   * One pass for every fruit in flight, over the finished frame, with the
   * depth buffer cleared so nothing in the level can occlude it.
   */
  drawFlyingFruit(
    renderer: THREE.WebGLRenderer,
    half?: 'top' | 'bottom',
    targetSize?: { width: number; height: number },
  ): void {
    const layer = this.fruitLayer;
    const cam = this.fruitLayerCam;
    if (!layer || !cam) return;
    let any = false;
    const canvas = renderer.domElement;
    const cw = canvas.clientWidth;
    // In split screen this rider owns half the canvas, and everything below —
    // the aspect the flight is measured in, the frustum, the viewport it draws
    // through — has to be that half. Drawn full-canvas it would launch from
    // the wrong height and sail across the other player's view.
    const ch = (canvas.clientHeight || 0) / (half ? 2 : 1);
    if (!cw || !ch) return;
    const aspect = cw / ch;
    this.fruitAspect = aspect;
    for (const f of this.fruits) {
      if (f.phase !== 'fly') continue;
      any = true;
      // The frustum is 1 unit tall and `aspect` wide, centred on the middle
      // of the screen, so a screen fraction maps straight onto it.
      f.mesh.position.set((f.sx - 0.5) * aspect, 0.5 - f.sy, 0);
      f.mesh.scale.setScalar(FRUIT_SCREEN);
    }
    if (!any) return;
    cam.left = -aspect / 2;
    cam.right = aspect / 2;
    cam.updateProjectionMatrix();
    renderer.autoClear = false;
    // setViewport/setScissor take RENDERER units and multiply by pixelRatio
    // themselves — the same trap ui.drawIcons documents. Convert from CSS px,
    // and put back whatever the caller had set.
    if (half) {
      const size = targetSize
        ? FRUIT_SIZE.set(targetSize.width, targetSize.height)
        : renderer.getSize(FRUIT_SIZE);
      const k = size.y / (canvas.clientHeight || 1);
      renderer.getViewport(FRUIT_PREV);
      renderer.setScissorTest(true);
      const y = half === 'top' ? ch * k : 0;
      renderer.setViewport(0, y, size.x, ch * k);
      renderer.setScissor(0, y, size.x, ch * k);
    }
    renderer.clearDepth();
    renderer.render(layer, cam);
    if (half) {
      renderer.setScissorTest(false);
      renderer.setViewport(FRUIT_PREV);
    }
    renderer.autoClear = true;
  }

  // Falling and our feet are near the target's top face = a stomp. The window
  // is deep enough that a max-speed fall can't step past it in one tick. A
  // height-only test called high side scrapes stomps; the feet must be over
  // the authored lid footprint and must have approached from its top side.
  private isStomping(box: THREE.Box3): boolean {
    return (
      this.state === 'air' &&
      this.vVel < 0 &&
      this.pos.y > box.max.y - 0.75 &&
      this.prevPos.y >= box.max.y - 0.05 &&
      this.pos.x >= box.min.x &&
      this.pos.x <= box.max.x &&
      this.pos.z >= box.min.z &&
      this.pos.z <= box.max.z
    );
  }

  /** Snapshot and order crossed vertical faces before any crate mutates state. */
  private cratesInFaceContactOrder(level: Level): {
    ordered: readonly Crate[];
    stomps: ReadonlySet<Crate>;
    bonks: ReadonlySet<Crate>;
  } {
    if (this.isBailing || this.state !== 'air' || this.vVel === 0)
      return {
        ordered: level.crates,
        stomps: NO_CRATE_CONTACTS,
        bonks: NO_CRATE_CONTACTS,
      };
    const faces: { crate: Crate; index: number; face: number }[] = [];
    for (let index = 0; index < level.crates.length; index++) {
      const c = level.crates[index];
      if (!c.alive || c.pending || !this.playerBox.intersectsBox(c.box)) continue;
      if (this.vVel < 0) {
        if (this.isStomping(c.box))
          faces.push({ crate: c, index, face: c.box.max.y });
      } else {
        if (this.isBonking(c.box))
          faces.push({ crate: c, index, face: c.box.min.y });
      }
    }
    if (faces.length === 0)
      return {
        ordered: level.crates,
        stomps: NO_CRATE_CONTACTS,
        bonks: NO_CRATE_CONTACTS,
      };
    faces.sort((a, b) =>
      this.vVel < 0
        ? b.face - a.face || a.index - b.index
        : a.face - b.face || a.index - b.index,
    );
    const faceSet = new Set(faces.map((entry) => entry.crate));
    return {
      ordered: [
        ...faces.map((entry) => entry.crate),
        ...level.crates.filter((crate) => !faceSet.has(crate)),
      ],
      stomps: this.vVel < 0 ? faceSet : NO_CRATE_CONTACTS,
      bonks: this.vVel > 0 ? faceSet : NO_CRATE_CONTACTS,
    };
  }

  // Rising and our head is at the target's bottom face = a headbutt from below.
  private isBonking(box: THREE.Box3): boolean {
    if (this.isBailing || this.state !== 'air' || this.vVel <= 0) return false;
    const bodyHeight = CONST.playerHalf.y * 2;
    const previousHead = this.prevPos.y + bodyHeight;
    const currentHead = this.pos.y + bodyHeight;
    if (currentHead < box.min.y || previousHead > box.min.y + 0.75)
      return false;
    return (
      this.pos.x >= box.min.x &&
      this.pos.x <= box.max.x &&
      this.pos.z >= box.min.z &&
      this.pos.z <= box.max.z
    );
  }

  private isCenteredFallingMetalContact(box: THREE.Box3): boolean {
    const inset = 0.08;
    return (
      this.pos.x >= box.min.x + inset &&
      this.pos.x <= box.max.x - inset &&
      this.pos.z >= box.min.z + inset &&
      this.pos.z <= box.max.z - inset
    );
  }

  // Robust solid resolution (swept, Minkowski-expanded). Three rules:
  // 1. The step's actual movement segment is SWEPT against the box, so a
  //    fast approach clamps at the face it truly crossed — never the far one.
  // 2. Starting already inside (bad ejection, spawn overlap, moved platform)
  //    exits via the SHALLOWEST face, capped per frame — smooth un-stick,
  //    never a warp across the level.
  // 3. Only a head-on hit kills speed (Crash full stop + skid); scraping
  //    along a wall at an angle slides and keeps your momentum.
  // Skated face-first into something that doesn't give. Called right AFTER a
  // pushOutOf with the pre-push position: the push the resolver applied says
  // how square the hit was — straight back against travel means the face of
  // the wall, and at speed that's a wipeout: bounce off backwards, deck gone,
  // body tumbling. A skim along the face pushes sideways and stays a skim.
  // NOTE the third arg: pushOutOf is a FULL STOP — it zeroes the speed itself
  // (the setter trap pointed straight at it) — so the crash speed has to be
  // captured BEFORE the push and passed in, or this always reads a standstill.
  private lowObstacleTripLaunch(entrySpeed: number): number {
    const randomScale =
      1 + (this.simRand() * 2 - 1) * THREE.MathUtils.clamp(TUNING.tripLiftVariation, 0, 1);
    return Math.min(
      Math.max(TUNING.tripLiftBase, TUNING.tripLiftMax),
      (TUNING.tripLiftBase + Math.abs(entrySpeed) * TUNING.tripLiftPerSpeed) * randomScale,
    );
  }

  private lowObstacleTripCarry(entrySignedSpeed: number): number {
    const lo = Math.min(TUNING.tripCarryMin, TUNING.tripCarryMax);
    const hi = Math.max(TUNING.tripCarryMin, TUNING.tripCarryMax);
    return Math.sign(entrySignedSpeed || 1) * Math.abs(entrySignedSpeed) *
      THREE.MathUtils.lerp(lo, hi, this.simRand());
  }

  private wallSmack(beforeX: number, beforeZ: number, s0: number, box?: THREE.Box3): void {
    if (this.isBailing || this.state === 'dead') return;
    if (!this.freeSkate) return; // on foot you can't reach wall-crash speed
    if (Math.abs(s0) < TUNING.wallBailSpeed) return;
    const pushX = this.pos.x - beforeX;
    const pushZ = this.pos.z - beforeZ;
    const pl = Math.hypot(pushX, pushZ);
    if (pl < 1e-5) return; // nothing was actually resolved
    const dir = Math.sign(s0 || 1);
    const frontal = -(pushX * this.axisF.x * dir + pushZ * this.axisF.z * dir) / pl;
    if (frontal < THREE.MathUtils.clamp(TUNING.wallBailFrontal, 0, 1)) return;
    // A LOW solid — the jungle log's body, a curb, a ledge lip — catches the
    // SHINS: you fly forward OVER it, not backwards off it. (This is the fall
    // the replay was hunting for: the log is a wall collider as well as a
    // rail, so the backward wall-splat was stealing every over-the-handlebars
    // attempt and playing the same fixed bounce each time.) Same speed-scaled
    // randomized launch as the rail trip; the walls loop lets a tumbling
    // airborne body pass over anything below its feet, so the arc carries.
    if (box !== undefined && box.max.y < this.pos.y + Math.max(0, TUNING.tripMaxHeight)) {
      // Wall impacts roll launch before bail(); the thrown board then consumes
      // its own deterministic samples, and carry is selected afterward.
      const launch = this.lowObstacleTripLaunch(s0);
      this.bail();
      this.startRagdoll('forward');
      this.vVel = Math.max(this.vVel, launch);
      this.speed = this.lowObstacleTripCarry(s0);
      this.state = 'air';
      this.grounded = false;
      this.airFromSkate = false;
      this.airGrav = 'board'; // floaty crash arc — the flight gets read
      this.airMomentum = true;
      sfx.play('woosh3', 0.8);
      this.emitSparks(8, 0xffd166, 2);
      return;
    }
    this.bail();
    this.startRagdoll('back');
    this.speed = -dir * Math.abs(s0) * 0.32; // bounce OFF the wall, flat on your back
    this.vVel = Math.max(this.vVel, 3.6);
    this.state = 'air';
    this.grounded = false;
    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.airMomentum = true; // the rebound CARRIES — foot-air must not park it
    sfx.play('crunch', 0.85, 0.7);
    this.emitSparks(10, 0xffd166, 2.4);
    this.emitDust(3);
  }

  // Fell onto a rail without asking for the grind: the body folds over the
  // bar and ragdolls off it — the classic THPS coping-crotch bail. Fires only
  // on a real skate-air DESCENT that crosses the rail line square-on:
  //  - the drop-in test is airRose, NOT a fall-speed floor. (It used to be
  //    vVel < -1.5; that gated on how fast you were falling, which let a
  //    fast drop-in eat a smack and a slow jump escape one.) A body rolling
  //    off a deck across its coping never ROSE this air, so it stays free;
  //    a jump rose first, so ANY descent onto the bar without Triangle eats
  //    it — exactly the THPS rule. The vVel > -0.4 line below is only the
  //    "actually descending" guard.
  //  - on-foot airs are exempt: hopping over the jungle log on foot is basic
  //    platforming and must keep sailing over.
  //  - vert airs, fresh dismounts (regrindCd), the landing grace at a lip,
  //    slams, and bodies already down are all exempt, same as the rail block.
  //  - ropes are exempt: a sagging line is soft, not a bar.
  private railLandSmack(input: Input, level: Level): boolean {
    if (this.vVel > -0.4) return false; // must actually be coming down
    // Drop-in protection, done right: a body rolling off a deck across its
    // coping never ROSE this air and crosses the lip in a shallow fall — that
    // stays free. A JUMP rose first, so ANY descent onto a rail counts (the
    // old flat -1.5 fall-speed gate also exempted every ollie that came down
    // on a deck-height rail near its apex — the exact "jumped on the rail,
    // no grind, nothing happened" case). A jumpless fall from real height
    // still smacks once it's properly plummeting.
    if (!this.airRose && this.vVel > -3) return false;
    if (!this.airFromSkate && !this.freeSkate) return false;
    if (this.isBailing || this.slamActive) return false;
    if (input.grindHeld || input.grindPressed) return false;
    if (this.regrindCd > 0 || this.vertLandGraceT > 0 || this.vertAir || this.pipeHang) return false;
    // Same contact skin the on-foot rail block uses (playerHalf + blockRadius,
    // 0.7): the bar is as wide to FALL onto as it is to skate into. The first
    // cut used a tight 0.45 and a flats replay showed a landing 0.59 off the
    // line sailing through — visually ON the bar (the body itself is 0.5
    // wide), called a miss by the code.
    const smackReach = CONST.playerHalf.x + CONST.railBlockRadius;
    for (const rail of level.rails) {
      if (!rail.grindable) continue;
      const s = rail.closestXZ(this.pos);
      if (s.distXZ > smackReach) continue; // past the skin is a genuine graze
      // the fall must cross the rail line THIS step
      if (!(this.prevPos.y > s.point.y + 0.02 && this.pos.y <= s.point.y + 0.02)) continue;
      let isRope = false;
      for (const r of level.ropes) if (r.rail === rail) isRope = true;
      if (isRope) continue;
      this.pos.y = s.point.y + 0.02; // folded over the bar
      const signedEntrySpeed = this.speed;
      this.bail(); // rail trips throw the board before selecting body lift/carry
      this.vVel = Math.max(this.vVel, this.lowObstacleTripLaunch(signedEntrySpeed));
      this.speed = this.lowObstacleTripCarry(signedEntrySpeed);
      this.airFromSkate = false;
      this.airGrav = 'board'; // the floaty crash arc keeps the fold-over readable
      this.airMomentum = true;
      this.startRagdoll('forward');
      this.regrindCd = Math.max(this.regrindCd, 0.5); // no snap offers while folded
      sfx.play('crunch', 0.9, 0.55); // the deep thunk — skateboarding's worst sound
      this.emitSparks(9, 0xffd166, 2);
      return true;
    }
    return false;
  }

  // Skated into a box too slow to smash but fast enough to catch the shins:
  // the body pitches OVER the top and comes down tumbling on the far side.
  // Returns true if the trip fired (the caller then skips the wall shove).
  private crateTrip(box: THREE.Box3): boolean {
    if (this.isBailing || this.state !== 'ride' || !this.grounded) return false;
    if (!this.freeSkate) return false;
    const s0 = this.speed;
    if (Math.abs(s0) < TUNING.crateTripSpeed) return false;
    // the box has to be AHEAD — a graze along its side is a wall, not a trip
    const dir = Math.sign(s0 || 1);
    const cx = (box.min.x + box.max.x) / 2 - this.pos.x;
    const cz = (box.min.z + box.max.z) / 2 - this.pos.z;
    const cl = Math.hypot(cx, cz) || 1;
    if ((cx * this.axisF.x * dir + cz * this.axisF.z * dir) / cl < 0.55) return false;
    this.bail(); // combo gone, deck thrown, invuln on (keeps ~half the speed)
    this.startRagdoll('forward');
    // measured on the foot-air arc: 7.2 peaked the feet at 0.81, UNDER the
    // 0.96 lid — 8.6 clears it with ~0.2 to spare
    this.vVel = Math.max(this.vVel, 8.6);
    this.state = 'air';
    this.grounded = false;
    this.airFromSkate = false;
    this.airGrav = 'foot';
    this.airMomentum = true; // the arc must CARRY over the box, not park at its face
    sfx.play('woosh3', 0.7);
    this.emitSparks(5, 0xffd166, 1.5);
    return true;
  }

  private translateCollisionBoxes(dx: number, dy: number, dz: number): void {
    if (dx === 0 && dy === 0 && dz === 0) return;
    CRATE_CONTACT_SHIFT.set(dx, dy, dz);
    this.playerBox.translate(CRATE_CONTACT_SHIFT);
    this.feetBox.translate(CRATE_CONTACT_SHIFT);
    this.spinBox.translate(CRATE_CONTACT_SHIFT);
  }

  /** Exact curved-wall push. null = the Box3 broadphase was a false positive. */
  private pushOutOfWallPath(
    box: THREE.Box3,
    path: WallPathRuntime,
    level: Level,
  ): boolean | null {
    const segment = level.wallPathSegmentForBox(box);
    const contact = level.closestWallPath(path, this.pos.x, this.pos.z, segment);
    if (
      this.pos.y > contact.y + path.height ||
      this.pos.y + CONST.playerHalf.y * 2 < contact.y
    )
      return null;
    const insideCapWidth = (sample: ReturnType<Level['closestWallPath']>): boolean => {
      if (!sample.cap) return true;
      const lateralRadius =
        path.halfThickness +
        Math.abs(sample.nz) * CONST.playerHalf.x +
        Math.abs(sample.nx) * CONST.playerHalf.z +
        0.02;
      return sample.crossDistance < lateralRadius;
    };
    if (!insideCapWidth(contact)) return null;
    const radius =
      (contact.cap ? 0 : path.halfThickness) +
      Math.abs(contact.nx) * CONST.playerHalf.x +
      Math.abs(contact.nz) * CONST.playerHalf.z +
      0.02;
    if (contact.distance >= radius) return null;
    const before = level.closestWallPath(
      path,
      this.prevPos.x,
      this.prevPos.z,
      segment,
    );
    const beforeRadius =
      (before.cap ? 0 : path.halfThickness) +
      Math.abs(before.nx) * CONST.playerHalf.x +
      Math.abs(before.nz) * CONST.playerHalf.z +
      0.02;
    const insideBefore = insideCapWidth(before) && before.distance < beforeRadius;
    const fullShift = radius - contact.distance + 0.01;
    const shift = insideBefore ? Math.min(fullShift, 0.5) : fullShift;
    const shiftX = contact.nx * shift;
    const shiftZ = contact.nz * shift;
    this.pos.x += shiftX;
    this.pos.z += shiftZ;
    this.translateCollisionBoxes(shiftX, 0, shiftZ);
    if (insideBefore) {
      this.prevPos.x += shiftX;
      this.prevPos.z += shiftZ;
      return true;
    }
    const head = Math.abs(this.axisF.x * contact.nx + this.axisF.z * contact.nz);
    if (head > 0.6 && Math.abs(this.speed) > 0.1) {
      if (Math.abs(this.speed) > 18 && this.haltCd <= 0) {
        sfx.play('skateHalt', 0.7);
        this.haltCd = 0.5;
      }
      this.speed = 0;
    }
    return false;
  }

  /** Returns true for positional start-inside repair, false for a fresh hit. */
  private pushOutOf(box: THREE.Box3): boolean {
    const hx = CONST.playerHalf.x + 0.02;
    const hz = CONST.playerHalf.z + 0.02;
    const minX = box.min.x - hx;
    const maxX = box.max.x + hx;
    const minZ = box.min.z - hz;
    const maxZ = box.max.z + hz;
    const px = this.prevPos.x;
    const pz = this.prevPos.z;
    const insideBefore = px > minX && px < maxX && pz > minZ && pz < maxZ;

    if (insideBefore) {
      // Un-stick: shallowest way out, at most 0.5u per frame.
      const cand: [number, 'x' | 'z', number][] = [
        [this.pos.x - minX, 'x', -1],
        [maxX - this.pos.x, 'x', 1],
        [this.pos.z - minZ, 'z', -1],
        [maxZ - this.pos.z, 'z', 1],
      ];
      cand.sort((a, b) => a[0] - b[0]);
      const [pen, ax, dir] = cand[0];
      const step = Math.min(pen + 0.01, 0.5) * dir;
      const shiftX = ax === 'x' ? step : 0;
      const shiftZ = ax === 'z' ? step : 0;
      this.pos.x += shiftX;
      this.pos.z += shiftZ;
      // Positional repair is not authored travel. Move the previous sample
      // and all remaining contact volumes by the exact same delta, matching
      // Unity a97fde9 and preventing a 0.5u repair becoming ~30u/s next tick.
      this.prevPos.x += shiftX;
      this.prevPos.z += shiftZ;
      this.translateCollisionBoxes(shiftX, 0, shiftZ);
      return true;
    }

    // Swept slab test: the axis whose face was crossed LAST is the one we
    // actually hit; clamp only that axis so the other keeps sliding.
    const dx = this.pos.x - px;
    const dz = this.pos.z - pz;
    let t1x = -Infinity;
    let t1z = -Infinity;
    if (dx !== 0) t1x = Math.min((minX - px) / dx, (maxX - px) / dx);
    if (dz !== 0) t1z = Math.min((minZ - pz) / dz, (maxZ - pz) / dz);
    let axis: 'x' | 'z';
    if (t1x > t1z) axis = 'x';
    else if (t1z > t1x) axis = 'z';
    else axis = Math.abs(dz) >= Math.abs(dx) ? 'z' : 'x';
    const beforeX = this.pos.x;
    const beforeZ = this.pos.z;
    if (axis === 'x') this.pos.x = dx > 0 ? minX - 0.01 : maxX + 0.01;
    else this.pos.z = dz > 0 ? minZ - 0.01 : maxZ + 0.01;
    this.translateCollisionBoxes(this.pos.x - beforeX, 0, this.pos.z - beforeZ);

    // Head-on (heading mostly into the clamped face) = Crash full stop.
    const head = axis === 'x' ? Math.abs(this.axisF.x) : Math.abs(this.axisF.z);
    if (head > 0.6 && Math.abs(this.speed) > 0.1) {
      if (Math.abs(this.speed) > 18 && this.haltCd <= 0) {
        sfx.play('skateHalt', 0.7);
        this.haltCd = 0.5;
      }
      this.speed = 0;
    }
    return false;
  }

  // THPS WALLRIDE — try to stick to a wall we've bumped into: must be airborne,
  // holding grind, off cooldown, moving fast enough, and within the wall's
  // height. The wall is a thin box; its NORMAL is the thin axis, the ride runs
  // along the long axis carrying your speed. Returns true if it grabbed.
  private tryWallride(w: THREE.Box3, level: Level): boolean {
    if (
      this.state !== 'air' ||
      this.isBailing ||
      this.wallCoolT > 0 ||
      this.wallrideLatched || // already used a wallride this air-time — land or grind to re-arm
      this.vertAir ||
      this.slamActive ||
      this.grabbing ||
      !this.rawInput.grindHeld
    )
      return false;
    const vx = this.axisF.x * this.speed;
    const vz = this.axisF.z * this.speed;
    const hspeed = Math.hypot(vx, vz);
    if (hspeed < TUNING.wallrideMinSpeed) return false;
    const wallPath = level.wallPathForBox(w);
    if (wallPath) {
      const contact = level.closestWallPath(
        wallPath,
        this.pos.x,
        this.pos.z,
        level.wallPathSegmentForBox(w),
      );
      if (contact.cap) return false;
      const contactRadius =
        wallPath.halfThickness +
        Math.abs(contact.nx) * CONST.playerHalf.x +
        Math.abs(contact.nz) * CONST.playerHalf.z +
        0.08;
      if (contact.distance > contactRadius) return false;
      if (
        this.pos.y > contact.y + wallPath.height ||
        this.pos.y + CONST.playerHalf.y * 2 < contact.y
      )
        return false;
      const alongVelocity = vx * contact.tx + vz * contact.tz;
      const along = Math.abs(alongVelocity);
      const into = -(vx * contact.nx + vz * contact.nz);
      const approach =
        (Math.atan2(Math.abs(into), Math.max(0.001, along)) * 180) / Math.PI;
      if (approach > TUNING.wallrideMaxAngle) return false;
      this.wallPath = wallPath;
      this.wallPathS = contact.s;
      this.wallPathDir = Math.abs(alongVelocity) > 0.01 ? Math.sign(alongVelocity) : 1;
      const baseNx = -contact.tz;
      const baseNz = contact.tx;
      this.wallPathSide = contact.nx * baseNx + contact.nz * baseNz >= 0 ? 1 : -1;
      this.wallNormal.set(contact.nx, 0, contact.nz);
      this.axisF.set(
        contact.tx * this.wallPathDir,
        0,
        contact.tz * this.wallPathDir,
      );
      const playerRadius =
        Math.abs(contact.nx) * CONST.playerHalf.x +
        Math.abs(contact.nz) * CONST.playerHalf.z;
      this.pos.x = contact.x + contact.nx * (wallPath.halfThickness + playerRadius + 0.05);
      this.pos.z = contact.z + contact.nz * (wallPath.halfThickness + playerRadius + 0.05);
    } else {
      if (this.pos.y > w.max.y || this.pos.y + CONST.playerHalf.y * 2 < w.min.y)
        return false;
      const extX = w.max.x - w.min.x;
      const extZ = w.max.z - w.min.z;
      const alongZ = extX <= extZ; // thin in X → wall runs along Z (normal ±X); else along X
      // Outward normal: points from the wall face back toward the skater.
      const nx = alongZ ? (this.pos.x >= (w.min.x + w.max.x) / 2 ? 1 : -1) : 0;
      const nz = alongZ ? 0 : this.pos.z >= (w.min.z + w.max.z) / 2 ? 1 : -1;
      const along = alongZ ? Math.abs(vz) : Math.abs(vx);
      const into = alongZ ? -vx * nx : -vz * nz;
      const approach =
        (Math.atan2(Math.abs(into), Math.max(0.001, along)) * 180) / Math.PI;
      if (approach > TUNING.wallrideMaxAngle) return false;
      this.wallPath = null;
      if (alongZ) {
        this.wallNormal.set(nx, 0, 0);
        const tdir = Math.abs(vz) > 0.01 ? Math.sign(vz) : 1;
        this.axisF.set(0, 0, tdir);
        this.pos.x =
          (nx > 0 ? w.max.x : w.min.x) + nx * (CONST.playerHalf.x + 0.05);
      } else {
        this.wallNormal.set(0, 0, nz);
        const tdir = Math.abs(vx) > 0.01 ? Math.sign(vx) : 1;
        this.axisF.set(tdir, 0, 0);
        this.pos.z =
          (nz > 0 ? w.max.z : w.min.z) + nz * (CONST.playerHalf.z + 0.05);
      }
    }
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.wallSpeed = hspeed; // redirect full momentum along the wall
    this.speed = hspeed;
    this.wallBox = w;
    this.wallriding = true;
    this.boardOllieAir = false;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.deckTricksThisAir.clear();
    this.wallrideLatched = true; // no second wallride until you land or grind
    this.wallrideT = TUNING.wallrideMaxTime;
    this.wallTickT = 0;
    this.wallChargeT = 0; // pump loads fresh on each wall
    this.flipT = 0; // the wheels just pressed onto the wall — no mid-flip corkscrew
    this.pipeEndFly = false; // a wall catch SAVES a pipe-end fly-off
    this.rollOffT = 0;
    this.score(CONST.ptsWallride, 'Wallride'); // timed trick: shows the combo plate straight away, then ticks up
    this.vVel = Math.max(this.vVel, 3); // a little upward pop as you catch the wall (ollie OUT with jump — the wallie)
    this.airFromSkate = true;
    this.airGrav = 'board'; // riding a wall puts you on the board, however you arrived
    this.charging = false;
    sfx.play('woosh2', 0.5);
    this.emitSparks(4, 0xffd0a0, 1);
    return true;
  }

  // LEDGE GRAB — catch the lip of a solid you hit head-on (on foot or
  // skating) and hang from it. Three gates make a candidate a real ledge:
  //  1. the lip sits in the hands' band above the feet — not a curb you'd
  //     just step over, not out of reach (grounded grabs also need the feet
  //     to clearly leave the floor, or the "hang" reads as standing);
  //  2. you're genuinely heading INTO the face — a graze keeps sliding, and
  //     holding grind keeps the wall for wallrides/rail snaps;
  //  3. a LANDING probe finds standable ground just behind the face at lip
  //     height. This one check is what rejects berms, logs, arena gates, and
  //     bare barrier walls on every level (their tops aren't walkable), and
  //     it returns the TRUE deck top — platform side colliders tuck their
  //     top 0.25 under the walk surface, so the box lip alone lies.
  // The catch EASES to the hang anchor over a beat (never a teleport);
  // stepHang owns the state from there.
  private probeWalkableLedgeTop(
    level: Level,
    x: number,
    z: number,
    rayTop: number,
    rayBottom: number,
    minY: number,
    maxY: number,
  ): LedgeTop | null {
    this.raycaster.set(LEDGE_RAY_ORIGIN.set(x, rayTop, z), LEDGE_DOWN);
    this.raycaster.near = 0;
    this.raycaster.far = Math.max(0.05, rayTop - rayBottom);
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    for (const hit of hits) {
      const data = hit.object.userData as { halfpipe?: unknown; vert?: boolean };
      if (data.halfpipe || data.vert === true || !hit.face) continue;
      LEDGE_FACE_NORMAL.copy(hit.face.normal)
        .applyNormalMatrix(
          LEDGE_NORMAL_MATRIX.getNormalMatrix(hit.object.matrixWorld),
        )
        .normalize();
      if (LEDGE_FACE_NORMAL.y < 0.72) continue;
      if (hit.point.y < minY || hit.point.y > maxY) continue;
      return {
        y: hit.point.y,
        moverId: hit.object.userData.moverId as number | undefined,
      };
    }
    return null;
  }

  private ledgeBodyBlocked(
    feet: THREE.Vector3,
    supportY: number,
    level: Level,
  ): boolean {
    ledgeBodyBox(LEDGE_BODY, feet, CONST.playerHalf);
    for (const wall of level.walls)
      if (ledgeBlockerIntersects(wall, LEDGE_BODY, supportY)) return true;
    for (const crate of level.crates)
      if (
        crate.alive &&
        !crate.pending &&
        ledgeBlockerIntersects(crate.box, LEDGE_BODY, supportY)
      )
        return true;
    for (const crusher of level.crushers)
      if (ledgeBlockerIntersects(crusher.box, LEDGE_BODY, supportY))
        return true;
    return false;
  }

  /**
   * Resolve one candidate hang column into a real top and standing point.
   * The edge stays open on the hanging side, while a walkable surface must
   * exist inward. No original collider bounds are involved, so a straight
   * ledge can cross seams and mesh catches are valid at any horizontal angle.
   */
  private refitLedgeFrame(
    level: Level,
    anchor: THREE.Vector3,
    basis: LedgeBasis,
    expectedLip: number,
  ): void {
    ledgeEdgePoint(LEDGE_EDGE, anchor, basis);
    const edgeX = LEDGE_EDGE.x;
    const edgeZ = LEDGE_EDGE.z;
    const rayTop = expectedLip + 1.1;
    const rayBottom = expectedLip - 0.9;
    const minY = expectedLip - 0.45;
    const maxY = expectedLip + 0.55;
    const radius = 0.24;
    let outwardX = 0;
    let outwardZ = 0;
    let supported = 0;
    let open = 0;
    for (const [dx, dz] of LEDGE_FRAME_DIRECTIONS) {
      const hit = this.probeWalkableLedgeTop(
        level,
        edgeX + dx * radius,
        edgeZ + dz * radius,
        rayTop,
        rayBottom,
        minY,
        maxY,
      );
      // Supported samples point inward, so their opposite contributes to the
      // outward gradient; open samples already point outward.
      const sign = hit === null ? 1 : -1;
      outwardX += dx * sign;
      outwardZ += dz * sign;
      if (hit === null) open++;
      else supported++;
    }
    if (supported === 0 || open === 0) return;
    const next = ledgeBasis(
      { x: outwardX, z: outwardZ },
      CONST.playerHalf.x,
      CONST.playerHalf.z,
    );
    if (next.nx * basis.nx + next.nz * basis.nz < 0.25) return;

    const supportAt = (distance: number): boolean =>
      this.probeWalkableLedgeTop(
        level,
        edgeX + next.nx * distance,
        edgeZ + next.nz * distance,
        rayTop,
        rayBottom,
        minY,
        maxY,
      ) !== null;
    let inward = -0.32;
    let outward = 0.32;
    if (!supportAt(inward) || supportAt(outward)) {
      inward = -0.65;
      outward = 0.65;
    }
    if (!supportAt(inward) || supportAt(outward)) return;
    for (let iteration = 0; iteration < 7; iteration++) {
      const middle = (inward + outward) * 0.5;
      if (supportAt(middle)) inward = middle;
      else outward = middle;
    }
    const boundary = (inward + outward) * 0.5;
    Object.assign(basis, next);
    anchor.x = edgeX + basis.nx * (boundary + basis.skin);
    anchor.z = edgeZ + basis.nz * (boundary + basis.skin);
  }

  private resolveLedgeSupport(
    level: Level,
    anchor: THREE.Vector3,
    basis: LedgeBasis,
    expectedLip: number,
    landingOut: THREE.Vector3,
  ): LedgeTop | null {
    this.refitLedgeFrame(level, anchor, basis, expectedLip);
    ledgeEdgePoint(LEDGE_EDGE, anchor, basis);
    const rayTop = expectedLip + 1.35;
    const rayBottom = expectedLip - 1.05;
    const minY = expectedLip - 0.55;
    const maxY = expectedLip + 0.65;

    // A top continuing onto the hanging side means this is floor, not an edge.
    const outside = this.probeWalkableLedgeTop(
      level,
      LEDGE_EDGE.x + basis.nx * 0.14,
      LEDGE_EDGE.z + basis.nz * 0.14,
      rayTop,
      rayBottom,
      minY,
      maxY,
    );
    if (outside !== null) return null;

    for (const depth of LEDGE_INWARD_DEPTHS) {
      const x = LEDGE_EDGE.x - basis.nx * depth;
      const z = LEDGE_EDGE.z - basis.nz * depth;
      const lip = this.probeWalkableLedgeTop(
        level,
        x,
        z,
        rayTop,
        rayBottom,
        minY,
        maxY,
      );
      if (lip === null) continue;
      ledgeLandingPoint(landingOut, anchor, basis, depth, lip.y);
      LEDGE_PATH.copy(anchor).setY(lip.y - LEDGE_HANG_DEPTH);
      if (this.ledgeBodyBlocked(LEDGE_PATH, lip.y, level)) return null;
      return lip;
    }
    return null;
  }

  private ledgeClimbPathClear(to: THREE.Vector3, level: Level): boolean {
    const smooth = (value: number): number => value * value * (3 - 2 * value);
    for (const t of [0.2, 0.4, 0.6, 0.8, 1] as const) {
      const yK = smooth(Math.min(1, t / 0.65));
      const hK = smooth(Math.max(0, (t - 0.35) / 0.65));
      LEDGE_PATH.set(
        THREE.MathUtils.lerp(this.pos.x, to.x, hK),
        THREE.MathUtils.lerp(this.pos.y, to.y, yK),
        THREE.MathUtils.lerp(this.pos.z, to.z, hK),
      );
      if (this.ledgeBodyBlocked(LEDGE_PATH, this.ledgeLip, level)) return false;
    }
    return true;
  }

  private tryLedgeGrab(w: THREE.Box3, level: Level): boolean {
    if (
      (this.state !== 'ride' && this.state !== 'air') ||
      this.wallriding ||
      this.vertAir ||
      this.slamActive ||
      this.grabbing ||
      this.sliding ||
      this.crawling ||
      this.isBailing ||
      this.ledgeCoolT > 0 ||
      this.comboRun || // a run lives on its combo — an auto-catch would bank it and fail the run
      this.rawInput.grindHeld // grind/wallride intent owns the wall
    )
      return false;
    const catchEnvelope = ledgeCatchEnvelope(
      TUNING.ledgeReach,
      level.ledgeAssist,
      this.ledgeEnvelope,
    );
    // NOTE: a somersault (double jump) is NOT a blocker — the catch clears the
    // flip and the reach-and-grab clip owns the pose. Gating on it made every
    // double-jump approach silently ungrabbable (the whole point of the double
    // jump is reaching HIGHER ledges).
    const lipRough = w.max.y;
    const rise = lipRough - this.pos.y;
    if (this.state === 'ride') {
      // grounded: a chest-high-or-better step within reach
      if (rise < LEDGE_HANG_DEPTH + 0.2 || rise > catchEnvelope.reach)
        return false;
    } else {
      // Default airs catch only at the crest/downward phase. A level-authored
      // assist can open that hand-contact beat slightly earlier on the rise;
      // Jungle Gate uses it to turn its source's frame-perfect arrow climbs
      // into deliberate recovery grabs without moving either platform.
      if (this.vVel > catchEnvelope.maximumRisingSpeed) return false;
      if (rise < catchEnvelope.minimumAirRise || rise > catchEnvelope.reach)
        return false;
    }
    // Which side face was hit? Platform colliders are full footprints (not
    // thin like wallride walls), so pick by least penetration — the shallow
    // separating axis is the one just crossed — normal pointing back at us.
    const cx = (w.min.x + w.max.x) / 2;
    const cz = (w.min.z + w.max.z) / 2;
    const penX = CONST.playerHalf.x + (w.max.x - w.min.x) / 2 - Math.abs(this.pos.x - cx);
    const penZ = CONST.playerHalf.z + (w.max.z - w.min.z) / 2 - Math.abs(this.pos.z - cz);
    const useX = penX < penZ;
    const nx = useX ? Math.sign(this.pos.x - cx) || 1 : 0;
    const nz = useX ? 0 : Math.sign(this.pos.z - cz) || 1;
    // "heading into the face" reads the MEASURED travel direction (on foot the
    // course frame axisF is not the walk direction — a sideways walk would
    // never register). Pressed flush at the wall there IS no measured travel,
    // so the fallback is the STICK's world direction (mode-aware, same read as
    // the hang shimmy) — that's what makes side and backward approaches grab,
    // not just walks toward stick-up. axisF only if the stick is idle too.
    const pl = Math.hypot(this.lastVelX, this.lastVelZ);
    let hx: number;
    let hz: number;
    if (pl > 1.5) {
      hx = this.lastVelX / pl;
      hz = this.lastVelZ / pl;
    } else {
      const rS = this.freeSkate ? -1 : 1;
      const sx = rS * this.axisL.x * this.rawInput.moveX + this.axisF.x * this.rawInput.moveY;
      const sz = rS * this.axisL.z * this.rawInput.moveX + this.axisF.z * this.rawInput.moveY;
      const sl = Math.hypot(sx, sz);
      hx = sl > 0.3 ? sx / sl : this.axisF.x;
      hz = sl > 0.3 ? sz / sl : this.axisF.z;
    }
    const into = -(hx * nx + hz * nz);
    if (
      into <
      (this.state === 'ride'
        ? catchEnvelope.groundedIntoThreshold
        : catchEnvelope.airIntoThreshold)
    )
      return false;
    // landing probe: standable ground just inside the face, near the lip
    const face = useX ? (nx > 0 ? w.max.x : w.min.x) : nz > 0 ? w.max.z : w.min.z;
    const px = useX
      ? face - nx * 0.45
      : THREE.MathUtils.clamp(this.pos.x, w.min.x + 0.1, w.max.x - 0.1);
    const pz = useX
      ? THREE.MathUtils.clamp(this.pos.z, w.min.z + 0.1, w.max.z - 0.1)
      : face - nz * 0.45;
    const lip = this.probeWalkableLedgeTop(
      level,
      px,
      pz,
      lipRough + 1.6,
      lipRough - 1,
      lipRough - 0.05,
      lipRough + 0.75,
    );
    if (lip === null) return false; // no walkable top at the lip = not a ledge
    // it's a ledge — commit the catch (position settles in stepHang's ease)
    this.ledgeNormal.set(nx, 0, nz);
    this.ledgeLip = lip.y;
    const skin = (useX ? CONST.playerHalf.x : CONST.playerHalf.z) + 0.06;
    this.ledgeAnchor.set(
      useX ? face + nx * skin : THREE.MathUtils.clamp(this.pos.x, w.min.x + 0.3, w.max.x - 0.3),
      lip.y - LEDGE_HANG_DEPTH,
      useX ? THREE.MathUtils.clamp(this.pos.z, w.min.z + 0.3, w.max.z - 0.3) : face + nz * skin,
    );
    const basis = ledgeBasis(
      this.ledgeNormal,
      CONST.playerHalf.x,
      CONST.playerHalf.z,
    );
    const resolvedLip = this.resolveLedgeSupport(
      level,
      this.ledgeAnchor,
      basis,
      lip.y,
      this.ledgeLanding,
    );
    if (resolvedLip === null) return false;
    this.ledgeNormal.set(basis.nx, 0, basis.nz);
    this.ledgeLip = resolvedLip.y;
    this.ledgeMoverId = resolvedLip.moverId;
    this.ledgeAnchor.y = resolvedLip.y - LEDGE_HANG_DEPTH;
    return this.commitLedgeCatch();
  }

  // MESH-EDGE LEDGE GRAB — the systemic net. tryLedgeGrab only ever sees AABB
  // wall colliders, but most of the world's edges are MESH: the jungle strips
  // over the pit hops, displaced ground, polygon platforms, slab lips. This
  // variant needs no collider at all: falling past ANY walkable edge, it
  // probes the ground just ahead of the fall line — standable ground up at
  // hand height with open air at your own column IS a ledge, whatever
  // geometry made it.
  private tryLedgeGrabMesh(level: Level): boolean {
    if (
      this.state !== 'air' ||
      this.wallriding ||
      this.vertAir ||
      this.pipeHang ||
      this.slamActive ||
      this.grabbing ||
      this.sliding ||
      this.crawling ||
      this.isBailing ||
      this.ledgeCoolT > 0 ||
      this.comboRun ||
      this.rawInput.grindHeld // grind/wallride intent owns the wall
    )
      return false;
    const catchEnvelope = ledgeCatchEnvelope(
      TUNING.ledgeReach,
      level.ledgeAssist,
      this.ledgeEnvelope,
    );
    if (this.vVel > catchEnvelope.maximumRisingSpeed) return false;
    // fall line's horizontal direction: measured travel, else the stick's
    // world direction, else facing (same ladder as the AABB variant)
    const pl = Math.hypot(this.lastVelX, this.lastVelZ);
    let hx: number;
    let hz: number;
    if (pl > 1.5) {
      hx = this.lastVelX / pl;
      hz = this.lastVelZ / pl;
    } else {
      const rS = this.freeSkate ? -1 : 1;
      const sx = rS * this.axisL.x * this.rawInput.moveX + this.axisF.x * this.rawInput.moveY;
      const sz = rS * this.axisL.z * this.rawInput.moveX + this.axisF.z * this.rawInput.moveY;
      const sl = Math.hypot(sx, sz);
      hx = sl > 0.3 ? sx / sl : this.axisF.x;
      hz = sl > 0.3 ? sz / sl : this.axisF.z;
    }
    // standable ground at horizontal offset t along the fall line, between
    // grip height and full reach? (verts and pipes are never "ledges")
    const top = this.pos.y + catchEnvelope.reach + 0.9;
    const probe = (t: number): number | null => {
      return this.probeWalkableLedgeTop(
        level,
        this.pos.x + hx * t,
        this.pos.z + hz * t,
        top,
        this.pos.y + 0.55,
        this.pos.y + 0.55,
        this.pos.y + catchEnvelope.reach,
      )?.y ?? null;
    };
    const aheadLip = probe(catchEnvelope.forwardProbe);
    if (aheadLip === null) return false;
    const rise = aheadLip - this.pos.y;
    if (rise < catchEnvelope.minimumAirRise || rise > catchEnvelope.reach)
      return false;
    // an edge needs OPEN AIR on our side: ground at our own column near that
    // same height means we're simply landing on top, not falling past a lip
    const own = probe(0.06);
    if (own !== null && own > aheadLip - 0.45) return false;
    // walk the probe inward to locate the edge (first sample that sees the top)
    let edgeT = catchEnvelope.forwardProbe;
    for (let t = 0.14; t < catchEnvelope.forwardProbe + 0.01; t += 0.12) {
      const y = probe(t);
      if (y !== null && Math.abs(y - aheadLip) <= 0.4) {
        edgeT = t;
        break;
      }
    }
    const fx = this.pos.x + hx * Math.max(0.1, edgeT - 0.06);
    const fz = this.pos.z + hz * Math.max(0.1, edgeT - 0.06);
    this.ledgeNormal.set(-hx, 0, -hz);
    this.ledgeLip = aheadLip;
    const basis = ledgeBasis(
      this.ledgeNormal,
      CONST.playerHalf.x,
      CONST.playerHalf.z,
    );
    this.ledgeAnchor.set(
      fx + basis.nx * basis.skin,
      aheadLip - LEDGE_HANG_DEPTH,
      fz + basis.nz * basis.skin,
    );
    const resolvedLip = this.resolveLedgeSupport(
      level,
      this.ledgeAnchor,
      basis,
      aheadLip,
      this.ledgeLanding,
    );
    if (resolvedLip === null) return false;
    this.ledgeNormal.set(basis.nx, 0, basis.nz);
    this.ledgeLip = resolvedLip.y;
    this.ledgeMoverId = resolvedLip.moverId;
    this.ledgeAnchor.y = resolvedLip.y - LEDGE_HANG_DEPTH;
    return this.commitLedgeCatch();
  }

  // The catch itself, shared by the AABB and mesh variants: the detection has
  // set the anchor/normal/lip/box — this settles the body into the hang.
  private commitLedgeCatch(): boolean {
    this.ledgeFrom.copy(this.pos);
    this.ledgeEaseT = 0;
    this.ledgePhase = 'grip';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.ledgeAwayT = 0;
    this.ledgeShimmy = 0;
    this.ledgeClimbQueued = this.rawInput.jumpPressed || this.rawInput.jumpHeld;
    // axisL uses the skating handedness until the catch completes. Preserve
    // that control frame before traversal hands the mounted deck to the loose-
    // board simulation, otherwise the first shimmy reverses as freeSkate flips.
    this.ledgeControlRightSign = this.freeSkate ? -1 : 1;
    // A two-handed ledge catch cannot leave the deck mounted. Detach before
    // zeroing speed/vVel so the loose board inherits the actual catch flight.
    this.detachBoardForTraversal();
    // NOTE: axisF/axisL are the CONTROL FRAME (stick -> world), owned by the
    // zone/lane system — the hang must never rotate them (that scrambles the
    // controls after you let go). Facing the wall is visualYaw, in stepHang.
    this.state = 'hang';
    this.boardOllieAir = false;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.deckTricksThisAir.clear();
    this.ledgeT = TUNING.ledgeGrabTime;
    this.speed = 0;
    this.vVel = 0;
    this.walkVelocity.set(0, 0, 0);
    this.walkTurnaround = false;
    this.walkIntent.set(0, 0, 0);
    this.grounded = false;
    this.charging = false;
    this.chargeTimer = 0;
    this.airFromSkate = false;
    this.airGrav = 'foot'; // hanging by the hands: every exit off this ledge is on foot
    this.pipeEndFly = false; // catching a ledge settles a pending fly-off — no stale bail later
    this.rollOffT = 0;
    this.spinTimer = 0;
    this.spinAngle = 0;
    this.flipTimer = 0;
    this.teetering = false;
    this.airJumpUsed = false; // a grip is solid contact: the double jump re-arms
    this.doubleJumpAir = false;
    this.wallrideLatched = false;
    this.setHangClip('catch', 0.45); // the reach-and-grab plays over the settle
    if (this.manualing !== 0) this.endManual();
    this.bankCombo(); // a clean catch banks the pending string, like a landing
    sfx.play('ledgeGrab', 0.7, 1);
    this.emitDust(2);
    return true;
  }

  // Hanging off a ledge. The hang owns the whole step (no physics/collide).
  // GRIP phase: X always requests the CLAMBER; holding the stick AWAY without
  // X for a beat lets go (hop down — no button needed); the
  // grip fails when the timer runs out. CLIMB phase: a committed, animated
  // pull-up-and-over — the body eases up the face, then over the lip along
  // a rounded corner, ending stood on the landing. Stick reading: moveY +1
  // is screen-UP (same convention as the movement + manual-flick code).
  private stepHang(dt: number, input: Input, level: Level): void {
    this.runTime += dt;
    if (this.ledgeMoverId !== undefined) {
      const delta = level.moverDelta(this.ledgeMoverId);
      if (delta.lengthSq() > 0) {
        this.pos.add(delta);
        this.ledgeAnchor.add(delta);
        this.ledgeLanding.add(delta);
        this.ledgeFrom.add(delta);
        this.ledgeClimbFrom.add(delta);
        this.ledgeClimbTo.add(delta);
        this.ledgeLip += delta.y;
      }
    }
    // essential shared timers (the hang early-outs before the main step body)
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    this.slamSquash = Math.max(0, this.slamSquash - dt);
    this.slamFlatT = Math.max(0, this.slamFlatT - dt);
    this.hangClipT += dt * this.hangClipRate;
    // the time-trial clock keeps running — hanging is not a pause button
    if (this.ttActive) {
      if (this.ttFreeze > 0) this.ttFreeze = Math.max(0, this.ttFreeze - dt);
      else this.ttTime += dt;
    }
    // and the hang is NOT a damage shelter — lethal overlaps still land
    if (this.hangHazards(level)) return;
    this.speed = 0;
    this.vVel = 0;
    // face the wall (the catch may have come out of a sideways carve)
    const n = this.ledgeNormal;
    const wallYaw = wrapAngle(Math.atan2(-n.x, -n.z) - Math.PI);
    this.visualYaw += wrapAngle(wallYaw - this.visualYaw) * Math.min(1, 12 * dt);
    if (this.ledgePhase === 'climb') {
      // THE CLAMBER — committed (no timeout, no inputs): rise up the face
      // first, the over-the-lip travel overlaps the tail of the rise, so the
      // path rounds the corner instead of snapping between two points.
      this.ledgeClimbT += dt;
      const T = Math.max(0.12, TUNING.ledgeClimbTime);
      const t = Math.min(1, this.ledgeClimbT / T);
      const s = (v: number): number => v * v * (3 - 2 * v); // smoothstep
      const yK = s(Math.min(1, t / 0.65));
      const hK = s(Math.max(0, (t - 0.35) / 0.65));
      this.pos.y = THREE.MathUtils.lerp(this.ledgeClimbFrom.y, this.ledgeClimbTo.y, yK);
      this.pos.x = THREE.MathUtils.lerp(this.ledgeClimbFrom.x, this.ledgeClimbTo.x, hK);
      this.pos.z = THREE.MathUtils.lerp(this.ledgeClimbFrom.z, this.ledgeClimbTo.z, hK);
      this.ledgeClimbK = t;
      if (t >= 1) {
        // topped out: stand it up (a whisper of lift keeps the beat alive)
        this.state = 'air';
        this.grounded = false;
        this.vVel = TUNING.ledgeClimbPop;
        this.speed = 0;
        this.ledgeCoolT = 0.35;
        this.prevPos.copy(this.pos); // fresh sweep origin ON the deck — no back-clip
        sfx.play('footstep2', 0.6, 1.05);
        this.emitDust(3);
      }
    } else {
      // GRIP — settle into the hands over a beat (a catch, not a teleport)
      this.ledgeEaseT = Math.min(LEDGE_EASE, this.ledgeEaseT + dt);
      const k = this.ledgeEaseT / LEDGE_EASE;
      // The stick, read in WALL space (via the course frame, which the hang
      // never rotates): the along-ledge component SHIMMIES you down the lip,
      // the off-wall component held for a beat lets go — so "away" is stick-
      // down for a ledge ahead but stick-left for a wall on your right.
      // axisL's meaning is MODE-DEPENDENT: the course/on-foot frame stores the
      // screen-right stick direction (setTravelDir — see the N zone, where it
      // can't be derived from axisF), but the free-skate carve maintains
      // heading-LEFT (its entry seed + negate keep that mirror). A fixed sign
      // here inverted every on-foot shimmy on the course while the skate tests
      // read fine. A mounted catch drops the deck, so use the frame owner that
      // was latched on contact rather than the now-boardless live state.
      const rSgn = this.ledgeControlRightSign;
      const sx = rSgn * this.axisL.x * this.rawInput.moveX + this.axisF.x * this.rawInput.moveY;
      const sz = rSgn * this.axisL.z * this.rawInput.moveX + this.axisF.z * this.rawInput.moveY;
      const basis = ledgeBasis(n, CONST.playerHalf.x, CONST.playerHalf.z);
      const shim = THREE.MathUtils.clamp(
        sx * basis.tx + sz * basis.tz,
        -1,
        1,
      );
      const away = sx * basis.nx + sz * basis.nz;
      this.ledgeShimmy += ((Math.abs(shim) > 0.25 ? shim : 0) - this.ledgeShimmy) * Math.min(1, 12 * dt);
      // clip selection: the catch hands off to the idle loop; shimmying swaps
      // in the hand-over-hand traverse for that direction
      if (this.hangClipName === 'catch' && this.hangClipT >= HANG_ANIMS.catch.dur) this.setHangClip('idle', 0, true);
      if (this.hangClipName !== 'catch') {
        if (Math.abs(shim) > 0.25) this.setHangClip(shim > 0 ? 'shimmyR' : 'shimmyL', 0, true);
        else this.setHangClip('idle', 0, true);
      }
      let didShimmy = false;
      if (Math.abs(shim) > 0.25 && this.ledgeEaseT >= LEDGE_EASE) {
        // Advance in the true tangent frame and accept the step only while an
        // inward top plus outside air still define a ledge. Original collider
        // bounds are deliberately irrelevant: adjacent slabs and a long mesh
        // edge are one traversable lip.
        ledgeTraversePoint(
          LEDGE_CANDIDATE,
          this.ledgeAnchor,
          basis,
          shim * 2.4 * dt,
        );
        const lip = this.resolveLedgeSupport(
          level,
          LEDGE_CANDIDATE,
          basis,
          this.ledgeLip,
          LEDGE_LANDING,
        );
        if (lip !== null) {
          this.ledgeAnchor.copy(LEDGE_CANDIDATE);
          this.ledgeNormal.set(basis.nx, 0, basis.nz);
          this.ledgeAnchor.y = lip.y - LEDGE_HANG_DEPTH;
          this.ledgeLanding.copy(LEDGE_LANDING);
          this.ledgeLip = lip.y;
          this.ledgeMoverId = lip.moverId;
          didShimmy = true;
        }
      }
      this.pos.lerpVectors(this.ledgeFrom, this.ledgeAnchor, k * k * (3 - 2 * k));
      // actively shimmying holds the grip (you're re-setting your hands) —
      // requested motion that an actual end blocks does not create an infinite
      // hang: only real displacement refreshes the hands.
      if (!didShimmy) this.ledgeT -= dt;
      const pullingAway = away > 0.55;
      if (input.jumpPressed) this.ledgeClimbQueued = true;
      const climbRequested =
        this.ledgeEaseT >= LEDGE_EASE && this.ledgeClimbQueued;
      this.ledgeAwayT =
        pullingAway && !this.ledgeClimbQueued ? this.ledgeAwayT + dt : 0;
      if (climbRequested) {
        this.ledgeClimbQueued = false;
        this.ledgeAwayT = 0;
        this.startLedgeClimb(level);
      } else if (this.ledgeAwayT > 0.1) {
        this.ledgeHopDown(); // held away: let go (the debounce eats stick noise at the catch)
      } else if (this.ledgeT <= 0) {
        this.ledgeLetGo(); // the grip gave out
      }
    }
    // bookkeeping the main step normally does (velocity measure + prevPos)
    this.measurePlanar(dt);
  }

  // Commit the clamber only after re-validating its inward landing and the
  // whole standing-body path. A real overhang leaves us in grip (traversal is
  // still available); ordinary open ledges always receive the same proven
  // landing point that their shimmy uses.
  private startLedgeClimb(level: Level): boolean {
    const basis = ledgeBasis(
      this.ledgeNormal,
      CONST.playerHalf.x,
      CONST.playerHalf.z,
    );
    LEDGE_CANDIDATE.copy(this.ledgeAnchor);
    const lip = this.resolveLedgeSupport(
      level,
      LEDGE_CANDIDATE,
      basis,
      this.ledgeLip,
      LEDGE_LANDING,
    );
    if (lip === null) return false;
    this.ledgeAnchor.copy(LEDGE_CANDIDATE);
    this.ledgeNormal.set(basis.nx, 0, basis.nz);
    this.ledgeLip = lip.y;
    this.ledgeMoverId = lip.moverId;
    this.ledgeAnchor.y = lip.y - LEDGE_HANG_DEPTH;
    this.ledgeLanding.copy(LEDGE_LANDING);
    this.ledgeClimbFrom.copy(this.pos);
    this.ledgeClimbTo.copy(this.ledgeLanding);
    this.ledgeClimbTo.y += 0.06;
    if (!this.ledgeClimbPathClear(this.ledgeClimbTo, level)) return false;
    this.ledgePhase = 'climb';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.setHangClip('climb', Math.max(0.12, TUNING.ledgeClimbTime)); // clip time-fits the clamber
    sfx.play('ollie', 0.4, 1.15);
    this.emitDust(2);
    return true;
  }

  // X + away: kick off the wall and drop back down where you came from.
  // The push-off is a position offset + pop only — the control frame is
  // untouched, so the stick keeps meaning what it meant before the grab.
  private ledgeHopDown(): void {
    const n = this.ledgeNormal;
    this.pos.copy(this.ledgeAnchor);
    this.pos.x += n.x * 0.45;
    this.pos.z += n.z * 0.45;
    this.state = 'air';
    this.grounded = false;
    this.vVel = 3.2;
    this.speed = 0;
    this.visualYaw = wrapAngle(Math.atan2(n.x, n.z) - Math.PI); // face away (visual only)
    this.setHangClip('drop', 0.5);
    this.hangExitW = 1; // the push-off pose bleeds into the first beat of the fall
    this.ledgeCoolT = 0.5;
    this.prevPos.copy(this.pos);
    sfx.play('woosh', 0.4, 1.1);
  }

  // The hang must not be a damage shelter: the boulder, blasts, crushers,
  // foes, and sentry orbs still connect while you dangle (pits/killY cannot
  // reach a hang). Uber/invuln shrug it off; a mask breaks the GRIP instead
  // of you; bare-handed, it's a death like any other. Returns true if the
  // hang ended (dead or knocked off).
  private hangHazards(level: Level): boolean {
    const cx = this.pos.x;
    const cy = this.pos.y + CONST.playerHalf.y;
    const cz = this.pos.z;
    HANG_BOX.min.set(cx - CONST.playerHalf.x, this.pos.y, cz - CONST.playerHalf.z);
    HANG_BOX.max.set(cx + CONST.playerHalf.x, this.pos.y + CONST.playerHalf.y * 2, cz + CONST.playerHalf.z);
    let hit = false;
    for (const st of level.stones) if (st.box.intersectsBox(HANG_BOX)) { hit = true; break; }
    if (!hit) for (const cr of level.crushers) if (cr.crushing && cr.box.intersectsBox(HANG_BOX)) { hit = true; break; }
    if (!hit) for (const e of level.enemies) if (e.alive && e.touchHurt && e.box.intersectsBox(HANG_BOX)) { hit = true; break; }
    if (!hit) for (const pr of level.projectiles) if (pr.box.intersectsBox(HANG_BOX)) { hit = true; break; }
    if (!hit) {
      for (const ex of level.explosions) {
        if (ex.safe || ex.t > CONST.blastGrow + 0.05) continue;
        const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
        const dx = cx - ex.center.x, dy = cy - ex.center.y, dz = cz - ex.center.z;
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < r + 0.5) { hit = true; break; }
      }
    }
    if (!hit) return false;
    if (this.uberTimer > 0 || this.invulnTimer > 0) return false;
    if (this.spendMask()) {
      this.ledgeLetGo(); // the hit knocks you off the wall, not out
      return true;
    }
    this.die();
    return true;
  }

  // Swap the active baked hang clip. `over` > 0 time-fits the whole clip into
  // that many real seconds (the clamber matches ledgeClimbTime); a running
  // loop is left alone when re-selected so it never stutters.
  private setHangClip(name: keyof typeof HANG_ANIMS | null, over = 0, loop = false): void {
    if (name === this.hangClipName && loop) return;
    this.hangClipName = name;
    this.hangClipT = 0;
    this.hangClipLoop = loop;
    this.hangClipRate = name && over > 0 ? HANG_ANIMS[name].dur / Math.max(0.08, over) : 1;
  }

  // Sample the active clip's anatomical channels at the current clock (linear
  // interp). Null when no clip should show; `w` is the blend weight — full
  // ledge pose while hanging, the fading exit overlay just after.
  private hangPoseSample(ledgeW: number): { w: number; armXL: number; armXR: number; armZL: number; armZR: number; elbL: number; elbR: number; legL: number; legR: number; kneeL: number; kneeR: number; spine: number; head: number } | null {
    const name = this.hangClipName;
    if (!name) return null;
    const w = this.state === 'hang' ? ledgeW : this.hangExitW * 0.7;
    if (w < 0.02) return null;
    const clip = HANG_ANIMS[name];
    const t = this.hangClipLoop ? this.hangClipT % clip.dur : Math.min(clip.dur - 1e-4, this.hangClipT);
    const f = Math.max(0, t * clip.fps);
    const i = Math.floor(f);
    const fr = f - i;
    const smp = (a: number[]): number => {
      const b0 = a[Math.min(i, a.length - 1)];
      const b1 = a[Math.min(i + 1, a.length - 1)];
      return b0 + (b1 - b0) * fr;
    };
    const c = clip.ch;
    // The model's limb pivots are named mirror-image: with the character facing
    // -z, armR/legR sit at world -x (the anatomical LEFT side) — measured, not
    // assumed. The baked channels are anatomical, so swap sides here; without
    // this every clip renders mirrored and the shimmies read backwards.
    return {
      w,
      armXL: smp(c.armXR), armXR: smp(c.armXL), armZL: smp(c.armZR), armZR: smp(c.armZL),
      elbL: smp(c.elbR), elbR: smp(c.elbL),
      legL: smp(c.legR), legR: smp(c.legL), kneeL: smp(c.kneeR), kneeR: smp(c.kneeL),
      spine: smp(c.spine), head: smp(c.head),
    };
  }

  // The grip gives out: peel off the wall and drop straight down.
  private ledgeLetGo(): void {
    const n = this.ledgeNormal;
    this.pos.copy(this.ledgeAnchor);
    this.pos.x += n.x * 0.12;
    this.pos.z += n.z * 0.12;
    this.state = 'air';
    this.grounded = false;
    this.vVel = -0.5;
    this.speed = 0;
    this.setHangClip('fall', 0.45);
    this.hangExitW = 1; // the slip pose bleeds into the fall
    this.ledgeCoolT = 0.6;
    this.prevPos.copy(this.pos);
    sfx.play('woosh3', 0.35, 0.7);
  }

  // Ride the wall: gentle gravity, along-wall travel + bleed, glued to the face.
  // PUMP X (hold) to load a spring, RELEASE to leap off — the longer the pump,
  // the bigger the pop. Else drop when it times out / stalls / runs off / you
  // meet the ground.
  private stepWallride(dt: number, input: Input, level: Level): void {
    const w = this.wallBox;
    if (input.jumpHeld) this.wallChargeT = Math.min(TUNING.wallChargeMax, this.wallChargeT + dt);
    if (input.jumpReleased) {
      // charge 0..1 over wallChargeMax; a quick tap barely loads (normal ollie),
      // a full pump adds the whole bonus on top for a big launch.
      const charge = TUNING.wallChargeMax > 0 ? this.wallChargeT / TUNING.wallChargeMax : 0;
      const outVx = this.wallNormal.x * TUNING.wallKickOut + this.axisF.x * this.wallSpeed * 0.7;
      const outVz = this.wallNormal.z * TUNING.wallKickOut + this.axisF.z * this.wallSpeed * 0.7;
      this.speed = Math.hypot(outVx, outVz);
      if (this.speed > 0.01) {
        this.axisF.set(outVx / this.speed, 0, outVz / this.speed);
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
      }
      this.vVel = TUNING.wallKickUp + charge * TUNING.wallPumpBonus;
      this.wallriding = false;
      this.wallPath = null;
      this.wallCoolT = 0.35;
      this.state = 'air';
      this.airFromSkate = true;
      this.airGrav = 'board';
      sfx.play('ollie', 0.6 + 0.4 * charge, 1 - 0.15 * charge); // deeper/louder the more you loaded it
      sfx.play('woosh2', 0.7);
      this.emitSparks(6 + Math.round(charge * 8), 0xffd0a0, 1.2);
      return;
    }

    this.vVel -= TUNING.wallrideGravity * dt;
    if (this.vVel < -CONST.maxFallSpeed) this.vVel = -CONST.maxFallSpeed;
    this.wallSpeed = Math.max(0, this.wallSpeed - TUNING.wallrideFriction * dt);
    this.speed = this.wallSpeed;
    let pathOff = false;
    let pathSample = null as ReturnType<Level['wallPathSample']> | null;
    if (this.wallPath) {
      const nextS = this.wallPathS + this.wallPathDir * this.wallSpeed * dt;
      pathOff =
        !this.wallPath.closed &&
        (nextS < -0.3 || nextS > this.wallPath.length + 0.3);
      pathSample = level.wallPathSample(
        this.wallPath,
        nextS,
        this.wallPathSide,
      );
      this.wallPathS = pathSample.s;
      this.axisF.set(
        pathSample.tx * this.wallPathDir,
        0,
        pathSample.tz * this.wallPathDir,
      );
      this.axisL.set(this.axisF.z, 0, -this.axisF.x);
      this.wallNormal.set(pathSample.nx, 0, pathSample.nz);
      const playerRadius =
        Math.abs(pathSample.nx) * CONST.playerHalf.x +
        Math.abs(pathSample.nz) * CONST.playerHalf.z;
      this.pos.x =
        pathSample.x +
        pathSample.nx * (this.wallPath.halfThickness + playerRadius + 0.05);
      this.pos.z =
        pathSample.z +
        pathSample.nz * (this.wallPath.halfThickness + playerRadius + 0.05);
    } else {
      this.pos.addScaledVector(this.axisF, this.wallSpeed * dt);
    }
    this.pos.y += this.vVel * dt;
    this.airPeakY = Math.max(this.airPeakY, this.pos.y);
    this.wallrideT -= dt;
    // THPS accrual: the longer the wallride, the more the combo is worth.
    this.wallTickT += dt;
    while (this.wallTickT >= 0.25) {
      this.wallTickT -= 0.25;
      this.comboPoints += CONST.ptsWallrideTick;
      this.special.award(CONST.ptsWallrideTick);
      this.comboTimer = CONST.comboWindow;
    }
    this.emitSparks(1, 0xffd0a0, 0.7); // trail of sparks off the trucks

    let off = pathOff;
    if (this.wallPath && pathSample) {
      if (this.pos.y > pathSample.y + this.wallPath.height + 0.25) off = true;
      if (this.pos.y + CONST.playerHalf.y * 2 < pathSample.y - 0.05) off = true;
    } else if (w) {
      if (this.wallNormal.x !== 0) {
        this.pos.x = (this.wallNormal.x > 0 ? w.max.x : w.min.x) + this.wallNormal.x * (CONST.playerHalf.x + 0.05);
        if (this.pos.z < w.min.z - 0.3 || this.pos.z > w.max.z + 0.3) off = true;
      } else {
        this.pos.z = (this.wallNormal.z > 0 ? w.max.z : w.min.z) + this.wallNormal.z * (CONST.playerHalf.z + 0.05);
        if (this.pos.x < w.min.x - 0.3 || this.pos.x > w.max.x + 0.3) off = true;
      }
      if (this.pos.y > w.max.y + 0.25) off = true; // rode over the top
    } else {
      off = true;
    }

    // Meet the ground on the way down → land and roll out.
    const hit = this.queryGround(level);
    this.groundHit = hit;
    if (hit && this.vVel <= 0 && this.pos.y <= hit.y + 0.05) {
      if (
        this.beginHugeDropLandingBail(
          hit,
          this.axisF.x * this.wallSpeed,
          this.axisF.z * this.wallSpeed,
        )
      ) {
        this.wallriding = false;
        this.wallPath = null;
        this.wallCoolT = 0.2;
        this.state = 'air';
        this.grounded = false;
        this.noteRagdollGroundImpact();
        if (this.ragActive && this.vVel < -3.2 && hit.normal.y > 0.6) {
          this.vVel = -this.vVel * TUNING.ragBounce;
          this.speed *= 0.72;
          this.ragBounces++;
        }
        return;
      }
      this.pos.y = hit.y;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.crateFloor = hit.crate ?? null;
      this.rideNormal.copy(hit.normal);
      this.airMomentum = true; // keep the speed on touchdown
      this.wallriding = false;
      this.wallPath = null;
      this.wallCoolT = 0.2;
      return;
    }

    // Ends only when you ollie off (handled above), run out of air-time, stall,
    // or run off the wall — NOT when you let go of grind.
    if (this.wallrideT <= 0 || this.wallSpeed < 1 || off) {
      this.wallriding = false;
      this.wallPath = null;
      this.wallCoolT = 0.35;
      this.state = 'air';
      this.airFromSkate = true;
      this.airGrav = 'board';
    }
  }

  // Grind rails are SOLID to a grounded skater who meets them side-on without
  // jumping or grinding: a walk is stopped like a curb, and a fast skate CATCHES
  // a truck and TRIPS (a non-lethal stumble). Grinding (a held Triangle snaps you
  // on earlier this step) and jumping (you're airborne) are the clean ways past —
  // this only runs on the ground while riding. Blocking is horizontal only: a
  // rail overhead or well underfoot is ignored, so you never snag on one you can
  // walk beneath or that sits below the deck you're on.
  private railBlock(level: Level): void {
    const half = CONST.playerHalf;
    const reach = half.x + CONST.railBlockRadius;
    for (const rail of level.rails) {
      if (!rail.grindable) continue;
      const s = rail.closestXZ(this.pos);
      if (s.distXZ > reach) continue;
      // THPS coping rules: the rail along a lip never fences the transition.
      // Riding the wall beneath it — or landing fresh out of a vert air —
      // passes under/over freely; the rail is a grind target, not a barrier.
      if (this.vertLandGraceT > 0) continue;
      if (this.groundHit && this.groundHit.normal.y < TUNING.steepStand) continue;
      // Vertical overlap: the rail line must sit within the body column (from a
      // shade below the feet up to a shade over the head) to count — a rail well
      // overhead is walk-under, one below the deck you're on is ignored.
      if (s.point.y < this.pos.y - 0.3 || s.point.y > this.pos.y + half.y * 2 + 0.3) continue;
      // Perpendicular to the rail (in XZ). Push back out toward the side we came
      // FROM so a fast clip can't tunnel to the far side.
      const perpX = s.tangent.z;
      const perpZ = -s.tangent.x;
      const sidePrev = (this.prevPos.x - s.point.x) * perpX + (this.prevPos.z - s.point.z) * perpZ;
      const sideNow = (this.pos.x - s.point.x) * perpX + (this.pos.z - s.point.z) * perpZ;
      const side = sidePrev !== 0 ? Math.sign(sidePrev) : sideNow !== 0 ? Math.sign(sideNow) : 1;
      // Skimming ALONG the rail (riding beside it) is not a side-on hit — let it
      // pass so a parallel graze never wrestles you.
      const mx = this.pos.x - this.prevPos.x;
      const mz = this.pos.z - this.prevPos.z;
      const moveMag = Math.hypot(mx, mz);
      if (moveMag > 1e-4 && Math.abs(mx * s.tangent.x + mz * s.tangent.z) / moveMag > 0.85) continue;
      // Eject to the near side, a hair past the skin so we don't re-hit next step.
      this.pos.x = s.point.x + perpX * side * (reach + 0.02);
      this.pos.z = s.point.z + perpZ * side * (reach + 0.02);
      const skating = this.freeSkate || Math.abs(this.speed) > TUNING.walkSpeed + 0.5;
      const signedEntrySpeed = this.speed;
      const travelSign = Math.sign(signedEntrySpeed || 1);
      const intoRail = Math.abs(
        this.axisF.x * travelSign * perpX + this.axisF.z * travelSign * perpZ,
      );
      if (
        skating &&
        Math.abs(signedEntrySpeed) >= TUNING.railTripSpeed &&
        intoRail >= THREE.MathUtils.clamp(TUNING.wallBailFrontal, 0, 1)
      ) {
        const spd = Math.abs(signedEntrySpeed); // entry speed, BEFORE bail() halves it
        this.bail(); // caught a truck: go down (non-lethal)
        // A LOW line (shin/knee height — the jungle ruins log) TRIPS you: the
        // body pitches clean OVER it, head first, and the launch scales with
        // how fast you were going — a full-charge trip flings you well past
        // the far side, and if a pit is what's over there, that's where you
        // land: the trip commits you, the throw is the punishment. A rail up
        // at chest height can't be tumbled over — that one's a clothesline,
        // the old near-side knockdown, whipped backward.
        const low = s.point.y < this.pos.y + Math.max(0, TUNING.tripMaxHeight);
        if (low) {
          this.pos.x = s.point.x - perpX * side * (reach + 0.25);
          this.pos.z = s.point.z - perpZ * side * (reach + 0.25);
          this.state = 'air';
          this.grounded = false;
          // OVER THE HANDLEBARS. A real launch: the pop scales hard with entry
          // speed and rolls a ±15% dice, the carry keeps ~60% of the run (not
          // the generic bail's half-of-half), and the flight falls on BOARD
          // gravity — the foot fall-rate (119) slammed every trip down in a
          // third of a second, which is why they all looked identical. Now a
          // full-charge trip flies well past the log, and no two arcs match.
          const launch = this.lowObstacleTripLaunch(spd);
          this.vVel = Math.max(this.vVel, launch);
          this.speed = this.lowObstacleTripCarry(signedEntrySpeed);
          this.airFromSkate = false;
          this.airGrav = 'board'; // floaty crash arc — the flight gets read
          this.airMomentum = true; // the trip THROWS you — momentum rides the arc
          this.startRagdoll('forward'); // re-seed: head-over-heels along travel
        } else {
          this.startRagdoll('back'); // clotheslined: head snaps back, body drops
        }
        this.emitSparks(6, 0xffd166, 1.6);
      } else if (Math.abs(this.speed) > 0.1) {
        // Curb stop: kill the into-rail component of travel.
        if (Math.abs(this.axisF.x * perpX + this.axisF.z * perpZ) > 0.35) this.speed = 0;
      }
      return; // one rail resolves the step
    }
  }

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    if (this.ttActive) this.ttDied = true; // trials never cost a life — the restart is the price
    else if (this.comboRun) {
      this.comboDied = true; // same deal for combo runs
      this.comboFailT = 0; // dying IS the despair — skip the beat
      this.onComboRunFail(); // the halo dissipates through the death fade
    } else if (this.endlessDeaths) {
      this.totalDeaths++;
      this.points = Math.ceil(this.points / 2);
    } else this.lives--;
    this.respawnTimer = CONST.respawnDelay;
    sfx.play('death', 0.9);
    this.speed = 0;
    this.vVel = 0;
    // the pending combo dies with you; banked points survive
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.comboUses.clear();
    this.special.wipe();
    this.clearSpecialMoves();
    this.deckTricksThisAir.clear();
    this.deckTricksThisCombo.clear();
    this.boardOllieAir = false;
    this.emergencyEjectCharging = false;
    this.emergencyEjectChargeT = 0;
    this.emergencyEjectLandingPending = false;
    this.emergencyEjectLandingWillBail = false;
    this.airGrabShown = null;
    this.onDeath();
  }

  // ------------------------------------------------------------------ misc --

  // ANALYTIC halfpipe wall crossing for this step: did the body pass through
  // the pipe's cross-section curve between prevPos and pos? The down-raycast
  // can't see a near-vertical wall (the ray runs parallel to the face) and a
  // fast step can clear the ribbon's whole projected footprint — this test is
  // exact, so a jump INTO the transition lands ON it instead of tunnelling
  // through into the void. Only fires on an inside→wall crossing: approaching
  // from behind/under the shell (where there's no solid) never teleports you up.
  private pipeCrossHit(level: Level): GroundHit | null {
    for (const hp of level.halfpipes) {
      const along = hp.alongCoord(this.pos.x, this.pos.z);
      const previousAlong = hp.alongCoord(this.prevPos.x, this.prevPos.z);
      const lo = Math.min(hp.l0, hp.l1) - 0.5;
      const hi = Math.max(hp.l0, hp.l1) + 0.5;
      if (
        along < lo ||
        along > hi ||
        previousAlong < lo ||
        previousAlong > hi
      )
        continue; // entering through an open pipe end is not a wall crossing
      const now = hp.rideSideCrossing(
        hp.crossCoord(this.prevPos.x, this.prevPos.z),
        this.prevPos.y,
        hp.crossCoord(this.pos.x, this.pos.z),
        this.pos.y,
      );
      if (!now) continue;
      const normal = hp.normalAt(now.u, new THREE.Vector3());
      return {
        y: now.y,
        normal,
        name: 'halfpipe',
        halfpipe: hp,
        // the exact surface point to land at (cross axis resolved below)
        pipeCross: now.cross,
      };
    }
    return null;
  }

  // The lid of a box we are stood on, if there is one under this probe point.
  // Only live while the crate-stand latch is (see CRATE_STAND_GRACE) — off the
  // latch a crate is not ground at any height, which is what keeps a fall onto
  // a box a stomp instead of a landing.
  private findCrateFloor(
    level: Level,
    x: number,
    z: number,
  ): { crate: Crate; feetY: number } | null {
    let best: Crate | null = null;
    let bestTop = -Infinity;
    for (const c of level.crates) {
      if (!c.alive || c.pending || c.nitro) continue;
      const top = c.box.max.y;
      // above the feet by more than a bouncing box can climb in a frame, or
      // deep enough below them that we have already stepped off it
      if (top > this.pos.y + CRATE_STAND_REACH || top < this.pos.y - 1.1) continue;
      if (!this.crateLidOverlapsSole(c.box, x, z)) continue;
      // Level.crates is stable authoring order, so an exact-height tie keeps
      // the first identity just as Unity's ordinal stable-identity tie-break.
      if (best === null || top > bestTop) {
        best = c;
        bestTop = top;
      }
    }
    return best === null
      ? null
      : { crate: best, feetY: bestTop + CRATE_STAND_LIFT };
  }

  private crateFloorAt(
    level: Level,
    x: number,
    z: number,
  ): { crate: Crate; feetY: number } | null {
    // A deliberate rising air has left support. Its next crate contact must
    // reach stomp/headbutt arbitration rather than spend the old walking latch
    // as ordinary ground. FootGroundLoss keeps airRose=false and may still use
    // the grace to settle onto the next bridge lid.
    if (
      this.crateFloorT <= 0 ||
      this.isBailing ||
      (this.state === 'air' && this.airRose)
    )
      return null;
    return this.findCrateFloor(level, x, z);
  }

  private queryGround(
    level: Level,
    ox = 0,
    oz = 0,
    maximumSurfaceY = Number.POSITIVE_INFINITY,
  ): GroundHit | null {
    const cx = this.pos.x + ox;
    const cz = this.pos.z + oz;
    let crateContact = this.crateFloorAt(level, cx, cz);
    let seedCrateFloor = false;
    // A grounded on-foot seam may seed the short crate-top claim as the feet
    // reach a live lid. Airborne contacts remain collision-owned, preserving
    // deliberate stomp/headbutt precedence instead of making crates ground.
    if (
      crateContact === null &&
      ox === 0 &&
      oz === 0 &&
      this.state === 'ride' &&
      this.grounded &&
      !this.freeSkate &&
      !this.sliding &&
      !this.isBailing &&
      !this.crateSupportLostThisStep
    ) {
      const eligible = this.findCrateFloor(level, cx, cz);
      if (eligible !== null && eligible.feetY <= maximumSurfaceY) {
        crateContact = eligible;
        seedCrateFloor = true;
      }
    }
    if (crateContact !== null && crateContact.feetY > maximumSurfaceY)
      crateContact = null;
    this.raycaster.set(new THREE.Vector3(cx, this.pos.y + 2.5, cz), DOWN);
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    // A box standing on nothing (a level with no floor under it) is still a
    // floor: answer with the lid rather than falling through it.
    if (hits.length === 0) {
      if (crateContact === null) return null;
      if (seedCrateFloor) this.crateFloorT = CRATE_STAND_GRACE;
      return {
        y: crateContact.feetY,
        normal: CRATE_UP.clone(),
        name: 'crate',
        vert: false,
        crate: crateContact.crate,
      };
    }
    // A plank that's already breaking away (fall/gone) is no longer solid — skip
    // it so a grinder/stander drops straight through instead of riding it down.
    let hit = null as (typeof hits)[number] | null;
    for (const h of hits) {
      if (h.point.y > maximumSurfaceY) continue;
      const candidatePipe = h.object.userData.halfpipe as Halfpipe | undefined;
      if (candidatePipe) {
        const currentCross = candidatePipe.crossCoord(cx, cz);
        const previousCross = candidatePipe.crossCoord(
          this.prevPos.x + ox,
          this.prevPos.z + oz,
        );
        // DoubleSide is a rendering requirement, not a second physics face.
        // If both completed-step samples are under/behind the shell, ignore
        // this overhead ribbon and let a genuine lower floor win.
        if (
          !candidatePipe.isRideSide(currentCross, this.pos.y) &&
          !candidatePipe.isRideSide(previousCross, this.prevPos.y)
        )
          continue;
      }
      const cid = h.object.userData.crumbleId as number | undefined;
      if (cid !== undefined) {
        const c = level.crumbles[cid];
        if (c && (c.state === 'fall' || c.state === 'gone')) continue;
      }
      hit = h;
      break;
    }
    if (!hit) {
      if (crateContact === null) return null;
      if (seedCrateFloor) this.crateFloorT = CRATE_STAND_GRACE;
      return {
        y: crateContact.feetY,
        normal: CRATE_UP.clone(),
        name: 'crate',
        vert: false,
        crate: crateContact.crate,
      };
    }
    // The lid wins whenever it is the higher of the two. vert:false is not
    // decoration: an undefined `vert` reads as an AUTHORED transition face, and
    // a crest launch off a crate top would throw you into a vert hang.
    if (crateContact !== null && crateContact.feetY > hit.point.y) {
      if (seedCrateFloor) this.crateFloorT = CRATE_STAND_GRACE;
      return {
        y: crateContact.feetY,
        normal: CRATE_UP.clone(),
        name: 'crate',
        vert: false,
        crate: crateContact.crate,
      };
    }
    const hp = hit.object.userData.halfpipe as Halfpipe | undefined;
    // Halfpipe walls hand back the exact ANALYTIC surface normal (perfectly
    // smooth across the transition and always oriented up/inward) instead of
    // the faceted triangle normal — no seams, no wrong-way winding.
    const normal = hp
      ? hp.normalAt(hp.pointToU(hit.point.x, hit.point.z), new THREE.Vector3())
      : hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
    return {
      y: hit.point.y,
      normal,
      name:
        (hit.object.userData.surfaceName as string | undefined) ??
        hit.object.name,
      moverId: hit.object.userData.moverId as number | undefined,
      crumbleId: hit.object.userData.crumbleId as number | undefined,
      slippy: hit.object.userData.slippy as boolean | undefined,
      vert: hit.object.userData.vert as boolean | undefined,
      finishPad: hit.object.userData.finishPad as boolean | undefined,
      trampolineBounce: hit.object.userData.trampolineBounce as number | undefined,
      trampolineHeldMult: hit.object.userData.trampolineHeldMult as number | undefined,
      speedPadSpeed: hit.object.userData.speedPadSpeed as number | undefined,
      speedPadHold: hit.object.userData.speedPadHold as number | undefined,
      speedPadId: hit.object.userData.speedPadId as number | undefined,
      undersideThickness: hit.object.userData.undersideThickness as
        | number
        | undefined,
      halfpipe: hp,
    };
  }

  /**
   * Measure last step's planar movement — and refuse to believe the impossible.
   *
   * lastPlanar exists because the `speed` scalar is forward-only, so a pure
   * sideways walk reads as 0 and the skate-entry gate would miss it. It is
   * derived from actual displacement, which is the problem: displacement is
   * not always LOCOMOTION. A collision push-out, a step-up snap, a respawn or
   * a moving platform can shift the player metres in one frame, and at 60Hz a
   * 1.7-unit shove reads as 102 u/s.
   *
   * The gate believes it, pops the board out on its own, and the entry seeds
   * `speed` from it — so walking from one surface to another and catching the
   * seam launched the player at the speed cap. Three separate clamps had
   * already been bolted on for three known false sources (a slide landing, a
   * slither down a steep face, a slide taken from the feet); this is the same
   * bug arriving by a fourth road, so fix the measurement instead.
   *
   * Nothing the player can DRIVE ever exceeds their own speed — or a walk,
   * which is exactly the case the forward-only scalar misses. So that is the
   * ceiling. Direction (lastVelX/Z) stays raw: it is still correct, and only
   * the magnitude was ever the lie.
   */
  private measurePlanar(dt: number): void {
    this.lastVelX = (this.pos.x - this.prevPos.x) / Math.max(dt, 1e-4);
    this.lastVelZ = (this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.lastPlanar = Math.min(
      Math.hypot(this.lastVelX, this.lastVelZ),
      Math.max(Math.abs(this.speed), TUNING.walkSpeed),
    );
    this.prevPos.copy(this.pos);
  }

  private syncFloorX(): void {
    // Landing X: persistent live vertical projection, snapped to whatever
    // floor is below the final player position. It grows a touch with height
    // so it reads from the top of a big air.
    const xFade = (height: number): number =>
      THREE.MathUtils.clamp((height - 0.3) / 1.5, 0, 1);
    const show = (height: number, floorY: number): void => {
      const opacity =
        X_ALPHA *
        (this.state === 'air'
          ? Math.max(0.5, xFade(height))
          : xFade(height));
      this.floorXMat.opacity = opacity;
      this.floorX.visible = opacity > 0.02;
      this.floorX.position.set(this.pos.x, floorY + 0.05, this.pos.z);
      this.floorX.scale.setScalar(Math.min(1.6, 0.9 + height * 0.06));
    };
    if (
      this.shadowGroundY !== null &&
      this.state !== 'dead' &&
      this.state !== 'gameover'
    ) {
      show(Math.max(0, this.pos.y - this.shadowGroundY), this.shadowGroundY);
    } else if (this.state === 'air' && this.pos.y >= this.lastGroundY - 0.3) {
      // Over a pit: retain the established current-X/Z fallback at the last
      // real ground plane. This is intentionally not speculative trajectory
      // prediction; live steering/double-jump/slam may still change the air.
      show(Math.max(0, this.pos.y - this.lastGroundY), this.lastGroundY);
    } else {
      this.floorX.visible = false;
    }
  }

  private refreshGroundPresentation(level: Level): void {
    this.shadowGroundY = this.queryShadowGround(level);
    if (this.shadowGroundY !== null) this.lastGroundY = this.shadowGroundY;
    this.syncFloorX();
  }

  // Long-range floor probe under the player — landing indicator only, never
  // gameplay (queryGround stays short so ground-follow is unchanged).
  private queryShadowGround(level: Level): number | null {
    this.raycaster.set(new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z), DOWN);
    this.raycaster.far = 120;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    for (const hit of hits) {
      const pipe = hit.object.userData.halfpipe as Halfpipe | undefined;
      if (
        pipe &&
        !pipe.isRideSide(
          pipe.crossCoord(this.pos.x, this.pos.z),
          this.pos.y,
        )
      )
        continue;
      return hit.point.y;
    }
    return null;
  }

  /**
   * The outline of one foot's SOLE, in its lowest rig joint's local space.
   *
   * Real vertices, not bounding boxes. On the authored rig the sole is its own
   * little slab and a box would do, but a loaded model arrives as one merged
   * shin-and-foot chunk whose box is centred on the whole leg — using it put
   * the reference a whole shoe-width behind the actual sole. So: take every
   * vertex below the knee, keep the bottom band, and box THAT. Everything
   * Imported chunks are rigid below the knee; the procedural foot is rigid
   * below its ankle. Either way the answer only has to be found once per rig.
   */
  private soleFootprint(knee: THREE.Object3D): THREE.Vector3[] {
    const verts: THREE.Vector3[] = [];
    const m = new THREE.Matrix4();
    const chain: THREE.Object3D[] = [];
    const v = new THREE.Vector3();
    knee.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const pos = (mesh.geometry as THREE.BufferGeometry).attributes.position as
        | THREE.BufferAttribute
        | undefined;
      if (!pos) return;
      // compose this mesh's transform back up to the knee (nothing above it)
      chain.length = 0;
      let p: THREE.Object3D | null = mesh;
      while (p && p !== knee) {
        chain.push(p);
        p = p.parent;
      }
      m.identity();
      for (let i = chain.length - 1; i >= 0; i--) {
        chain[i].updateMatrix();
        m.multiply(chain[i].matrix);
      }
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        verts.push(v.clone());
      }
    });
    if (verts.length === 0) return verts;
    let low = Infinity;
    for (const p of verts) low = Math.min(low, p.y);
    // The bottom band IS the sole. Anything higher is shin, and shins are not
    // what stands on a skateboard.
    const band = verts.filter((p) => p.y < low + SOLE_BAND);
    // Reduce it to the outline. A bounding box will NOT do: a carved model's
    // foot sits at whatever angle it was authored at inside the knee's frame,
    // and a box drawn round a diagonal sole is half again too wide — measured
    // on this rig it stretched the two-foot footprint from 0.48 to 0.74 and
    // put the centre a whole shoe off. The hull is the real outline, and it's
    // a dozen points however dense the mesh is.
    const outline = convexHullXZ(band);
    let lowest = band[0];
    for (const p of band) if (p.y < lowest.y) lowest = p;
    if (!outline.includes(lowest)) outline.push(lowest); // the deepest point may sit inside the outline
    return outline;
  }

  /**
   * PLANT: put the soles ON the deck — in every pose, and all the way through
   * the blends between them.
   *
   * The old fix was two constants: shorten the legs by 0.22 to stand on the
   * deck's height, and shove the rider 0.347 across to stand on its width.
   * Neither can hold, because neither is a constant of the problem.
   *
   * The 0.22 is a fraction of leg length, and `legs.scale.y` is a fold-
   * dependent lever — scaling a chain already folded at the knee barely moves
   * the foot. It is also model-dependent: the same 0.22 left the soles 0.124
   * inside the deck on one character and 0.063 on another. The 0.347 was
   * gated on `skatePose`, which collapses the moment she leaves the ground
   * while the hip offset it was cancelling does not — so every ollie, grind
   * and vert air put a shoe 0.30–0.33 past a deck edge 0.236 out.
   *
   * So stop guessing and measure. Every joint that moves a foot has been
   * written by the time this runs, so push the sole outline through the live
   * chain (legs → hip → knee → optional ankle), read it in the DECK's own
   * frame, and solve for the offset that lands it: deepest point onto the grip, the two feet
   * centred across the width. Whatever the pose and the model did to the legs
   * is already in the answer.
   *
   * The board is pinned to the physics point and must stay there — shadow,
   * landing X and collision all live at it — so the RIDER takes the offset.
   * Only local matrices are touched, and the correction is applied to the
   * PARENT of everything measured, so there is no feedback and no jitter.
   */
  private plantOnDeck(underW: number): void {
    const rg = this.riderG;
    if (!rg) return;
    const legs = this.legs;
    const bg = this.boardG;
    const { legR, legL, kneeR, kneeL, ankleR, ankleL } = this;
    // Weight: only while the deck is genuinely flat under her feet. A wallride
    // has it on its edge against the wall, an under-rail hang has it overhead
    // in both hands, a grab has it in one — solving "soles onto the grip" in
    // any of those would drag her off the board. (The wallride was tried and
    // rejected on the picture: with the deck rolled a quarter turn, "out of
    // the deck" is sideways, and it pushed her behind the board instead of
    // onto its face. It gets most of the win anyway — dropping the old fixed
    // stance offset took its worst sole from −0.585 to −0.176.)
    //
    // deckPose is used as a SWITCH, not as a dial: it takes ~0.2s to blend,
    // and scaling the offset by it means that for the first frames of every
    // mount the feet are only partly on a deck that is already fully under
    // them and fully drawn. Ramping to full by the time it is half-blended
    // costs nothing at the ends and cuts the walk→skate worst case by 3×.
    const w =
      THREE.MathUtils.smoothstep(this.deckPose, 0, 0.5) *
      (1 - this.wallridePose) *
      (1 - underW) *
      (1 - this.grabPose) *
      (1 - this.slidePose) *
      (1 - this.ledgePose);
    if (!legs || !bg || !legR || !legL || !kneeR || !kneeL || w <= 0.002) {
      return;
    }
    // Comparison meshes keep conventional virtual ankle/toe bones even when
    // their rigid imported foot polygons still live in the knee chunk. Pick
    // the lowest joint that actually owns renderable geometry rather than
    // deleting those useful distal bones to preserve the old fallback.
    const hasMesh = (root: THREE.Object3D): boolean => {
      let found = false;
      root.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) found = true;
      });
      return found;
    };
    const soleRootR = ankleR && hasMesh(ankleR) ? ankleR : kneeR;
    const soleRootL = ankleL && hasMesh(ankleL) ? ankleL : kneeL;
    if (!this.soleR || !this.soleL) {
      this.soleR = this.soleFootprint(soleRootR);
      this.soleL = this.soleFootprint(soleRootL);
    }
    if (this.soleR.length === 0 || this.soleL.length === 0) {
      return;
    }
    rg.updateMatrix();
    legs.updateMatrix();
    legR.updateMatrix();
    legL.updateMatrix();
    kneeR.updateMatrix();
    kneeL.updateMatrix();
    ankleR?.updateMatrix();
    ankleL?.updateMatrix();
    bg.updateMatrix();
    // sole-root-local → live rider transform → deck-geometry-local, one matrix
    // per foot. Including riderG is what makes Character Lab scale and the
    // recovery roll compatible with the final contact correction.
    const toDeck = _plantInv.copy(bg.matrix).invert();
    const mR = _plantMR
      .multiplyMatrices(rg.matrix, legs.matrix)
      .multiply(legR.matrix)
      .multiply(kneeR.matrix);
    const mL = _plantML
      .multiplyMatrices(rg.matrix, legs.matrix)
      .multiply(legL.matrix)
      .multiply(kneeL.matrix);
    if (ankleR) mR.multiply(ankleR.matrix);
    if (ankleL) mL.multiply(ankleL.matrix);
    mR.premultiply(toDeck);
    mL.premultiply(toDeck);
    const v = _plantV;
    let minY = Infinity;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of this.soleR) {
      v.copy(p).applyMatrix4(mR);
      if (v.y < minY) minY = v.y;
      if (v.x < lo) lo = v.x;
      if (v.x > hi) hi = v.x;
    }
    for (const p of this.soleL) {
      v.copy(p).applyMatrix4(mL);
      if (v.y < minY) minY = v.y;
      if (v.x < lo) lo = v.x;
      if (v.x > hi) hi = v.x;
    }
    // The presentation publishes its authored centreline grip height in the
    // board root's own space. Vertical: lift until the DEEPEST corner rests on
    // the grip, so nothing
    // clips. Lateral: centre the whole two-foot footprint across the width
    // rather than its average, which is what actually minimises the overhang
    // when the two feet sit at different points across the deck.
    const gripTop = Number(bg.userData.gripTop ?? PLANT_DECK_TOP);
    const dy = (Number.isFinite(gripTop) ? gripTop : PLANT_DECK_TOP) - minY;
    const dx = -0.5 * (lo + hi);
    // Back out of the deck frame: rotation and scale only, never its position
    // (that's the board's own animation, not ours to cancel).
    const o = _plantO.set(0, 0, 0).applyMatrix4(bg.matrix);
    const corr = _plantC.set(dx * w, dy * w, 0).applyMatrix4(bg.matrix).sub(o);
    rg.position.add(corr);
  }

  /**
   * Finish a fixed simulation step and then author its visual pose. Keeping
   * the eased surface-alignment state here makes landing judgement independent
   * of any presentation transforms the animation editor may replace.
   */
  private finishVisualStep(input: Input, dt: number): void {
    this.updateSurfaceAlignment(dt);
    this.syncVisual(input, dt);
  }

  private updateSurfaceAlignment(dt: number): void {
    let alignTarget = 0;
    let targetNormal: THREE.Vector3 | null = null;
    const onPipe = this.groundHit !== null && this.groundHit.name.startsWith('halfpipe');
    if (this.vertAir) {
      alignTarget = 1;
      targetNormal = this.vertNormal;
    } else if ((this.pipeEndFly || this.rollOffT > 0) && this.state === 'air') {
      alignTarget = this.pipeEndFly
        ? 1
        : Math.min(1, this.rollOffT / CONST.rollOffLevelTime);
      targetNormal = this.vertNormal;
    } else if (this.grounded && this.state === 'ride' && this.groundHit) {
      const flatY = TUNING.steepStand;
      const vertY = onPipe ? 0.72 : 0.25;
      const t = THREE.MathUtils.clamp(
        (flatY - this.rideNormal.y) / (flatY - vertY),
        0,
        1,
      );
      alignTarget = t * t * (3 - 2 * t);
      targetNormal = this.rideNormal;
    }
    const ease = onPipe || this.pipeHang ? 24 : 12;
    this.landingAlignPose +=
      (alignTarget - this.landingAlignPose) * Math.min(1, ease * dt);
    // Public/debug presentation mirrors the simulation state, but gameplay
    // never reads this editor-visible field.
    this.alignPose = this.landingAlignPose;
    if (targetNormal) {
      this.alignNormal.lerp(targetNormal, Math.min(1, ease * dt));
      if (this.alignNormal.lengthSq() < 1e-6) this.alignNormal.copy(targetNormal);
      this.alignNormal.normalize();
    }
  }

  private syncVisual(input: Input, dt: number): void {
    this.clearCharacterAppearance();
    // A runtime authored overlay wrote after the previous legacy pose. Undo it
    // before any legacy formula reads or accumulates from local transforms.
    this.playerAnimationBridge.prepareLegacyPose();
    // Supported wipeout recovery is authored on the rider-only root late in
    // this method. Clear its previous fixed-step rotation before any joint or
    // tail calculation; plantOnDeck below remains the sole owner of position
    // until the recovery layer adds its waist-pivot correction.
    if (this.riderG) {
      this.riderG.rotation.set(0, 0, 0);
      this.riderG.position.set(0, 0, 0);
    }
    this.group.position.copy(this.pos);
    const characterShape = characterProportionSettings.value;
    this.upperLegLengthR = PROCEDURAL_THIGH_LENGTH * characterShape.thighLength;
    this.upperLegLengthL = PROCEDURAL_THIGH_LENGTH * characterShape.thighLength;
    this.lowerLegLengthR = PROCEDURAL_SHIN_LENGTH * characterShape.shinLength;
    this.lowerLegLengthL = PROCEDURAL_SHIN_LENGTH * characterShape.shinLength;

    // Chunky little carve lean; on a rail, the lean IS the balance needle.
    const targetLean =
      this.isBailing
        ? 0
        : this.state === 'grind'
        ? this.balance * 0.55 // tip toward the needle/d-pad side (balance>0 = right)
        : this.grounded
          ? -input.moveX * 0.28
          : -input.moveX * 0.12;
    this.lean += (targetLean - this.lean) * Math.min(1, 12 * dt);

    // Edge panic: wobble while teetering on a lip, or flailing in the coyote
    // grace right after rolling off — the visual cue that a jump still saves you.
    const edgeGrace =
      this.state === 'air' &&
      this.coyoteTimer > 0 &&
      this.vVel <= 0 &&
      !this.isBailing &&
      !this.grabbing &&
      !this.slamActive;
    let wobble = 0;
    if (this.teetering || edgeGrace) {
      this.teeterPhase += dt;
      wobble = Math.sin(this.teeterPhase * 16) * (edgeGrace ? 0.3 : 0.22);
    } else {
      this.teeterPhase = 0;
    }
    this.teeterPose += ((this.teetering || edgeGrace ? 1 : 0) - this.teeterPose) * Math.min(1, 14 * dt);
    // Full euler reset every frame (y=PI is the model's base facing): the
    // hang-time premultiply below syncs back into rotation.x/y, so writing
    // only .z would compound last frame's tilt forever.
    //
    // THE LEAN IS A ROLL ABOUT THE LINE OF TRAVEL, NOT ABOUT A WORLD AXIS.
    // It used to be written straight into this euler's .z. The root group's
    // yaw is pinned at PI — the rider's actual facing lives one level down, on
    // bodyGroup — so that .z was a roll about world -Z no matter which way she
    // was going. Travelling down -Z, which is most of most levels, world -Z IS
    // the travel axis and it looked right. On a rail running across the world,
    // like the bends at the bottom of the Descent, the same balance needle
    // came out as a forward-and-backward teeter instead of a left-and-right
    // tip. Rolling about the heading itself is right everywhere, and is
    // numerically identical to the old code whenever the heading is -Z.
    this.group.rotation.set(0, Math.PI, 0);
    const roll = this.lean + wobble;
    if (roll * roll > 1e-8) {
      // visualYaw is updated below; a frame of lag on the AXIS is invisible
      // (the yaw is eased at 14/s) and keeps the euler reset above intact.
      LEAN_AXIS.set(-Math.sin(this.visualYaw), 0, -Math.cos(this.visualYaw));
      LEAN_Q.setFromAxisAngle(LEAN_AXIS, roll);
      this.group.quaternion.premultiply(LEAN_Q);
    }

    // UNIFIED SURFACE ALIGNMENT: the wall is the new ground. The whole rig
    // lays onto the surface normal — gently on banks, flat-out (~90°) on vert
    // walls — the SAME quaternion while riding the transition AND while glued
    // in hang time, so lip → hang → drop-in has no snap. Spins (bodyGroup yaw)
    // then run about the rig's own up = the surface normal, THPS-style.
    if (this.alignPose > 0.001) {
      VERT_Q.setFromUnitVectors(VERT_UP, this.alignNormal);
      VERT_Q2.identity().slerp(VERT_Q, this.alignPose);
      this.group.quaternion.premultiply(VERT_Q2);
    }

    // The body ALWAYS faces its actual travel direction — riding, grinding,
    // sidestepping, and mid-air drift all turn the model, Crash-style.
    // Movement itself never leaves the course axes; this is purely visual.
    let targetYaw = this.visualYaw; // stationary: keep facing the last direction
    let runReversal = false;
    const onFootRunReversal =
      this.walkTurnaround &&
      this.state === 'ride' &&
      this.grounded &&
      !this.freeSkate &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      !this.isBailing &&
      this.walkIntent.lengthSq() > 1e-6;
    if (this.state === 'rope') {
      // On the swing rope, face the direction you were travelling when you
      // grabbed (captured in tryRopeGrab) and hold it — the swing never turns
      // you, and climbing up/down never turns you.
      targetYaw = this.ropeFaceYaw;
    } else if (onFootRunReversal) {
      // Input leads a committed run turnaround while the root still slides
      // through old momentum. The body takes a very short visible pivot rather
      // than teleporting through 180 degrees in one rendered frame.
      targetYaw = wrapAngle(Math.atan2(this.walkIntent.x, this.walkIntent.z) - Math.PI);
      runReversal = true;
    } else {
      const vx = this.pos.x - this.prevPos.x;
      const vz = this.pos.z - this.prevPos.z;
      if (vx * vx + vz * vz > (1.5 * dt) * (1.5 * dt)) {
        targetYaw = wrapAngle(Math.atan2(vx, vz) - Math.PI);
      }
    }
    if (runReversal) {
      // Pure lateral reversals are exactly PI apart, where "shortest" has no
      // unique sign. Turn toward screen-right clockwise and screen-left
      // counter-clockwise so side-to-side pivots undo each other naturally.
      const lateralIntent = this.walkIntent.dot(this.axisL);
      const turnSign = Math.abs(lateralIntent) > 0.25
        ? -Math.sign(lateralIntent)
        : -1;
      this.visualYaw = stepFacingYaw(
        this.visualYaw,
        targetYaw,
        RUN_REVERSAL_YAW_RATE * dt,
        turnSign,
      );
    } else {
      this.visualYaw +=
        wrapAngle(targetYaw - this.visualYaw) * Math.min(1, 14 * dt);
    }
    // Stance is a 90° body turn: regular faces one side of the board,
    // switch faces the other (that's the whole difference — the board and
    // travel don't care). sidePose blends it in; the board counter-rotates
    // below so the deck stays along the line of travel.
    const sideYaw = this.stance * (Math.PI / 2) * this.sidePose;
    const specialFlipProgress =
      this.specialFlip && this.flipT > 0
        ? THREE.MathUtils.clamp(1 - this.flipT / Math.max(this.flipDuration, 0.001), 0, 1)
        : 0;
    const specialTwist =
      specialFlipProgress * specialFlipProgress * (3 - 2 * specialFlipProgress) * Math.PI * 2;
    // Only an actual airborne deck trick owns the board's yaw. Merely routing
    // spin VFX away from an attached board must not suppress the rider's native
    // grounded/grind spin animation.
    const boardRoutedSpin =
      this.spinning && this.state === 'air' && this.flipT > 0;
    this.bodyGroup.rotation.y =
      this.visualYaw +
      (boardRoutedSpin ? 0 : this.spinAngle) +
      this.grabSpinAngle +
      this.grindYawPose +
      sideYaw +
      specialTwist;

    // Grab pose, skate-photo style: knees tucked high, one hand pulls the
    // board, the other arm throws up. Direction held picks the variant —
    // up = nosegrab (pitch forward), left = melon (other hand, lean left),
    // right = indy (lean right). Left/right also spin (see updateGrab).
    // Procedural run + idle: on foot and moving, the legs scissor and the
    // arms pump; standing still gets a breathing bob. Skating/air poses win.
    const vxAnim = this.pos.x - this.prevPos.x;
    const vzAnim = this.pos.z - this.prevPos.z;
    const planar = Math.sqrt(vxAnim * vxAnim + vzAnim * vzAnim) / Math.max(dt, 1e-4);
    // A MOVING charge keeps the run cycle alive (the charge crouch layers on
    // top via chargePose) — freezing the legs mid-stride read as sliding
    // along the floor. Only the PLANTED standstill charge pins the feet.
    const onFoot =
      this.grounded &&
      this.state === 'ride' &&
      !(this.charging && this.chargePlanted) &&
      !this.freeSkate &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      (!this.isBailing || this.bailRecoverT >= 0) &&
      Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
    // The gait expresses committed intent through a turnaround even on the
    // instant physical velocity crosses zero. Gameplay/debug speed stays honest;
    // only the run cycle is held at the authored intent pace.
    const gaitPlanar = this.walkTurnaround
      ? Math.max(planar, TUNING.walkSpeed * this.walkRamp)
      : planar;
    const runningAnim = onFoot && gaitPlanar > 1.5;
    this.walkAmp += ((runningAnim ? 1 : 0) - this.walkAmp) * Math.min(1, 10 * dt);
    this.idleAmp += ((onFoot && !runningAnim ? 1 : 0) - this.idleAmp) * Math.min(1, 6 * dt);
    if (runningAnim) this.walkPhase += (4 + gaitPlanar * 1.0) * dt;
    else if (this.crawling && planar > 0.5) this.walkPhase += (2 + planar * 0.8) * dt;
    // Circle-hold splits by motion (the reference does): standing still is a
    // compact upright SQUAT; the all-fours crawl only takes over once she
    // actually moves.
    const crawlMove = this.crawlPose * Math.min(1, planar / 1.2);
    const crouchW = Math.max(0, this.crawlPose - crawlMove);
    // GRIND POSES, ONE PER TRICK NAME.
    //
    // Every style is a pitch (which truck is on the rail), a roll (which side
    // the free end hangs off) and a yaw (how far the deck is kinked across the
    // line). Positive pitch is nose DOWN — the same channel the manual uses,
    // where a wheelie is negative — and positive roll tips to the RIDER'S
    // RIGHT, the same sign the balance needle uses.
    //
    // Smith and Feeble were both authored NOSE UP, which is a 5-0 with a
    // different label: both are back-truck grinds where the nose drops off one
    // side of the rail, so both want the nose DOWN plus opposite roll — the
    // roll is the whole difference between them. And a Crooked grind was a
    // shallower Nosegrind with nothing crooked about it; the kink across the
    // rail is what the trick is named for.
    const GS: Record<string, [number, number, number]> = {
      //          pitch  roll   yaw      (radians)
      normal: [0, 0, 0], //            50-50: both trucks, deck level along the rail
      nose: [0.4, 0, 0], //         Nosegrind: front truck only, tail up
      five0: [-0.45, 0, 0], //              5-0: back truck only, nose up
      crook: [0.34, -0.14, 0.3], //  Crooked: nose truck, deck kinked off the line
      smith: [0.3, -0.34, 0], //       Smith: back truck, nose dropped off the left
      feeble: [0.26, 0.34, 0], //     Feeble: back truck, nose dropped off the right
      board: [0, 0, 0], //        Boardslide: deck square across (yaw is set below)
      lip: [0, 0, 0], //          Lipslide: same, come over the top
    };
    const gs = this.state === 'grind' ? GS[this.grindStyle] : null;
    const gp = gs ? gs[0] : 0;
    this.grindPoseX += (gp - this.grindPoseX) * Math.min(1, 12 * dt);
    this.grindPoseZ += ((gs ? gs[1] : 0) - this.grindPoseZ) * Math.min(1, 12 * dt);
    const crossRail = this.grindStyle === 'board' || this.grindStyle === 'lip';
    const gy =
      this.state === 'grind' && crossRail
        ? this.grindYawDir * (Math.PI / 2) * (this.grindStyle === 'lip' ? -1 : 1)
        : gs
          ? gs[2] * (this.grindYawDir || 1)
          : 0;
    this.grindYawPose += (gy - this.grindYawPose) * Math.min(1, 12 * dt);
    const swing = Math.sin(this.walkPhase) * 0.65 * Math.max(this.walkAmp, crawlMove * 0.6);
    const breathe = Math.sin(this.runTime * 2.3);
    // Somersault phasing, straight from the reference: launch EXTENDED (the
    // arm-throw jump pose), then the whole 360 whips through the middle of
    // the arc — rotation lives in the 15%..80% window — and she's upright
    // again well before touchdown. flipQ is the rotation's own 0..1 clock;
    // the tuck (knees to chest, arms wrapping) peaks halfway through it.
    const flipProg = this.flipTimer > 0 ? 1 - this.flipTimer / CONST.flipDuration : 0;
    const flipQ = flipProg > 0 ? THREE.MathUtils.clamp((flipProg - 0.15) / 0.65, 0, 1) : 0;
    const flipTuck = flipQ > 0 && flipQ < 1 ? Math.sin(flipQ * Math.PI) : 0;
    // Skate stance: while actually rolling on the board, plant the feet on the
    // deck — spread fore-aft (front foot toward the nose, back toward the tail)
    // and angled out — instead of hanging together at the plank's centre.
    // Same rule as the deck's own visibility: the riding STANCE follows the
    // skate state, not the speedometer. If these two ever disagree you get a
    // skate pose with no board under it, or a board under a walk pose.
    const onBoard =
      this.grounded &&
      this.state === 'ride' &&
      this.grabPose < 0.05 &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      this.freeSkate;
    this.skatePose += ((onBoard ? 1 : 0) - this.skatePose) * Math.min(1, 10 * dt);
    const sk = this.skatePose;
    // Standing on-foot charge (jump crouch at a standstill): the running-charge
    // knee fold below swings the shoes forward through the floor and the crouch
    // drops the hips. This weight shallows the intent before the fixed-length
    // solver turns it into a compact, feet-flat squat. The
    // charging RUN (not planted) keeps its deep cycling fold — the feet lift.
    const standCharge = this.chargePlanted ? this.chargePose * (1 - sk) : 0;
    // Standing still on foot: the reference idle is SUBTLE — slow weight-shift
    // sway, breathing, a lazy head wander. Builds on the eased idleAmp and
    // fades the moment any pose takes over.
    const idleW =
      this.idleAmp * (1 - sk) * (1 - this.crawlPose) * (1 - this.slidePose) * (1 - this.chargePose);
    // On-foot jump (the Crash reference): arms THROW straight up through the
    // rise, hold high across the apex, and ease as she falls; legs tuck on
    // the way up. Star jumps, grabs, and slams keep their own poses.
    const onFootAir =
      this.state === 'air' &&
      !this.freeSkate &&
      !this.slamActive &&
      this.starTimer <= 0 &&
      this.grabPose < 0.1;
    this.jumpPose += ((onFootAir ? 1 : 0) - this.jumpPose) * Math.min(1, 14 * dt);
    const jp = this.jumpPose * (1 - this.starPose);
    const riseK = THREE.MathUtils.clamp(this.vVel / 6, -1, 1); // +1 launching, -1 dropping
    // Side-on stance target: whenever the board is genuinely under you —
    // rolling, plain skate airs (grabs square back up; their poses are
    // authored in the forward frame), and grinds except boardslides (the
    // grindYawPose owns that body turn). The yaw itself is applied above.
    const sideOn =
      onBoard ||
      (this.state === 'grind' && this.grindStyle !== 'board' && this.grindStyle !== 'lip') ||
      (this.state === 'air' && this.airFromSkate && !this.grabbing && !this.slamActive && this.grabPose < 0.3);
    this.sidePose += ((sideOn ? 1 : 0) - this.sidePose) * Math.min(1, 8 * dt);
    // Deck-stand: any time the board is glued under the feet — rolling, plain
    // skate airs, every grind (boardslides included) — conventional knee flex
    // and the measured sole solver keep the feet on the grip.
    const deckOn = sideOn || this.state === 'grind';
    this.deckPose += ((deckOn ? 1 : 0) - this.deckPose) * Math.min(1, 10 * dt);
    // Crash star jump: legs split wide, arms thrown up — held for a beat
    // after crouch/slide jumps, fading the moment you land.
    if (this.state !== 'air') this.starTimer = 0;
    else this.starTimer = Math.max(0, this.starTimer - dt);
    this.starPose += ((this.starTimer > 0 ? 1 : 0) - this.starPose) * Math.min(1, 14 * dt);
    const star = this.starPose;
    // Distinct double-jump silhouette: a clear straddle during the energetic
    // second rise, easing back to neutral at the apex without root motion.
    const doubleRise =
      this.state === 'air' && this.doubleJumpAir
        ? THREE.MathUtils.clamp(this.vVel / 6, 0, 1)
        : 0;
    const doubleSplit = doubleRise * doubleRise * (3 - 2 * doubleRise);
    // Ledge hang: the rig hangs off its hands — arms straight up gripping the
    // lip, legs dangling with a slow sway, chest to the wall — and the whole
    // grip TREMBLES harder as the timer runs out (the tell before the drop).
    this.ledgePose += ((this.state === 'hang' ? 1 : 0) - this.ledgePose) * Math.min(1, 14 * dt);
    const ledgeW = this.ledgePose;
    const gripFade =
      this.state === 'hang'
        ? THREE.MathUtils.clamp(1 - this.ledgeT / Math.max(TUNING.ledgeGrabTime, 0.01), 0, 1)
        : 0;
    const ck = this.ledgeClimbK; // clamber progress (0 while gripping)
    const mantle = Math.sin(Math.min(1, ck) * Math.PI) * ledgeW; // heave peaks mid-clamber
    const gripTrem = ledgeW * (1 - ck) * gripFade * gripFade * Math.sin(this.runTime * 26) * 0.12;
    const handOver = Math.sin(this.runTime * 9) * 0.3 * Math.abs(this.ledgeShimmy) * ledgeW * (1 - ck); // shimmy: hand-over-hand
    // Baked Mixamo hang clips drive the limbs when one is playing (catch,
    // idle loop, shimmies, clamber, drop/fall exits); the hand-authored pose
    // below is the fallback. Channels are anatomical — see hangAnims.ts.
    // Under-rail hang weight: underK eases through the committed swing while
    // grinding; any exit (drop, snap, rail end) lets it bleed off in the air.
    if (this.state !== 'grind') this.underK = Math.max(0, this.underK - dt * 4);
    // the rope hang borrows the under-rail body: both arms up gripping a line
    // overhead, legs dangling (the board rides up into the hands too)
    const underW = Math.max(this.underK, this.state === 'rope' ? 1 : 0);
    const HS = this.hangPoseSample(ledgeW);
    const dangle = ledgeW * Math.sin(this.runTime * 1.7) * 0.08; // idle leg sway
    if (this.legL && this.legR) {
      // baseball slide: lead leg kicked out ahead, trailing leg half-bent
      // crawl: hips COUNTER the 0.75 body pitch (negative = knee swings
      // forward) so the thighs stay under the body — knees at the ground,
      // never feet flung up behind the pitched-over torso.
      this.legL.rotation.x = swing + 1.6 * flipTuck + 0.55 * this.slidePose - 0.9 * crawlMove - 1.2 * crouchW + underW * (0.2 + 0.08 * Math.sin(this.runTime * 2.4)) + (HS ? -HS.legL * 0.5 * HS.w : ledgeW * (0.16 + dangle) - 1.15 * mantle); // hang legs: clip or authored
      this.legR.rotation.x = -swing + 1.6 * flipTuck + 1.35 * this.slidePose - 0.9 * crawlMove - 1.2 * crouchW + underW * (0.2 - 0.08 * Math.sin(this.runTime * 2.4)) + (HS ? -HS.legR * 0.5 * HS.w : ledgeW * (0.1 - dangle) - 0.5 * mantle);
      // Crash-reference high knees: the swing-through leg lifts extra hard
      // (thigh toward horizontal), giving the run its cartoon prance.
      const liftL = Math.max(0, -Math.sin(this.walkPhase)) * this.walkAmp;
      const liftR = Math.max(0, Math.sin(this.walkPhase)) * this.walkAmp;
      this.legL.rotation.x -= 0.45 * liftL;
      this.legR.rotation.x -= 0.45 * liftR;
      // jump: thighs tuck up through the rise, back to hanging for the drop
      const jTuck = 0.7 * jp * Math.max(0, riseK);
      this.legL.rotation.x -= jTuck;
      this.legR.rotation.x -= jTuck * 0.8; // slight stagger reads livelier than a sync tuck
      // switch stance mirrors the feet fore-aft (and the ankle angles)
      const stz = this.stance;
      // Side-on frame: the body is turned 90°, so the hip line IS the board
      // line — feet spread apart along local X (one over the nose side, one
      // over the tail), toes pointing where the chest points. The board is
      // under whatever the deck pose is: rolling (sk) or a grind.
      const sp = this.sidePose;
      const fw = 1 - sp; // forward-frame weight
      const deck = Math.max(sk, this.grindArmPose); // feet planted on a deck
      // forward frame keeps the old modest fore-aft split along local Z
      // Keep the hip sockets inside the pelvis. Nose/tail separation comes
      // mostly from a mirrored leg splay, not by sliding both thighs outside
      // the shorts like two disconnected posts.
      this.legR.position.set(this.hipBaseR.x + 0.02 * sk * fw + 0.035 * deck * sp, 0, this.hipBaseR.z + 0.24 * sk * stz * fw);
      this.legL.position.set(this.hipBaseL.x - 0.02 * sk * fw - 0.035 * deck * sp, 0, this.hipBaseL.z - 0.2 * sk * stz * fw);
      this.legR.rotation.y = 0.12 * sk * stz * fw - 0.12 * stz * sp;
      this.legL.rotation.y = -0.09 * sk * stz * fw - 0.12 * stz * sp;
      this.legR.rotation.z = 0.22 * deck * sp - 1.05 * star - 0.72 * doubleSplit;
      this.legL.rotation.z = -0.22 * deck * sp + 1.05 * star + 0.72 * doubleSplit;
    }
    // Preserve the old pose system as an ENDPOINT INTENT, not a deformation:
    // this is the amount it used to squash the entire hierarchy. The
    // procedural legs convert that shortened virtual ankle target into a real
    // fixed-length two-bone bend below. Character Lab publishes its effective
    // segment lengths into the same solve; the pelvis itself never
    // scales, because it now owns the torso and tail as well as the legs.
    const legacyLegScale = Math.max(
      0.15,
      1 -
        0.22 * this.deckPose * (1 - this.wallridePose) -
        0.1 * this.chargePose * this.skatePose -
        0.2 * standCharge -
        0.5 * this.grabPose -
        0.4 * flipTuck -
        0.45 * this.crawlPose -
        0.25 * this.slidePose -
        0.28 * this.wallridePose -
        0.4 * this.wallChargePose,
    );
    this.legs?.scale.set(1, 1, 1);
    // KNEE JOINTS — additive only, layered AFTER the hip channel writes
    // above (which stay untouched). Flex reads off the same pose channels:
    // surf crouch on the board (front knee deeper than back), charge load,
    // grab/flip tuck, crawl fold, rail balance, the back-swing leg through
    // the run cycle — and star jumps lock both legs straight. Hips counter
    // half the standing flex so knees drive forward and feet stay on deck.
    if (this.kneeL && this.kneeR && this.legL && this.legR) {
      const straight = 1 - star;
      // squat: knees fold DEEP and forward (heels under the butt) — never
      // soles-up behind her, which is what a backward hip swing plus this
      // fold used to produce.
      const tuck = 1.35 * this.grabPose + 1.1 * flipTuck + 1.4 * crawlMove + 2.2 * crouchW;
      const backL = 0.9 * Math.max(0, Math.sin(this.walkPhase)) * this.walkAmp;
      const backR = 0.9 * Math.max(0, -Math.sin(this.walkPhase)) * this.walkAmp;
      // the lifted leg folds its shin under the raised thigh (prance step)
      const frontL = 1.1 * Math.max(0, -Math.sin(this.walkPhase)) * this.walkAmp + 0.8 * jp * Math.max(0, riseK);
      const frontR = 1.1 * Math.max(0, Math.sin(this.walkPhase)) * this.walkAmp + 0.65 * jp * Math.max(0, riseK);
      // the deep running-charge knee fold swings the shoes forward THROUGH
      // the deck — on the board it eases down to a shallow athletic bend.
      const chargeBend = 0.85 * this.chargePose * (1 - 0.6 * sk) - 0.62 * standCharge; // planted: shallow the forward fold so shoes don't swing through the floor
      const stanceR = 0.7 * sk + 0.5 * this.grindArmPose + chargeBend; // front leg
      const stanceL = 0.5 * sk + 0.5 * this.grindArmPose + chargeBend; // back leg
      this.kneeR.rotation.x = straight * (stanceR + tuck + backR + frontR + 0.35 * this.slidePose) + 0.38 * underW + (HS ? HS.kneeR * 0.65 * HS.w : ledgeW * (0.5 - dangle) + 0.8 * mantle);
      this.kneeL.rotation.x = straight * (stanceL + tuck + backL + frontL + 1.0 * this.slidePose) + 0.38 * underW + (HS ? HS.kneeL * 0.65 * HS.w : ledgeW * (0.62 + dangle) + 0.95 * mantle); // hang shins: clip or authored
      this.legR.rotation.x -= straight * 0.5 * stanceR;
      this.legL.rotation.x -= straight * 0.5 * stanceL;

      if (this.ankleR && this.ankleL) {
        const articulate = (
          leg: THREE.Object3D,
          knee: THREE.Object3D,
          upperLength: number,
          lowerLength: number,
          out: SagittalLegPose,
        ): void => {
          upperLength = Math.max(1e-4, upperLength);
          lowerLength = Math.max(1e-4, lowerLength);
          const hipIntent = leg.rotation.x;
          const kneeIntent = THREE.MathUtils.clamp(knee.rotation.x, 0, Math.PI - 0.08);
          const lowerIntent = hipIntent + kneeIntent;
          const virtualDown =
            legacyLegScale *
            (upperLength * Math.cos(hipIntent) +
              lowerLength * Math.cos(lowerIntent));
          const virtualForward =
            -upperLength * Math.sin(hipIntent) -
            lowerLength * Math.sin(lowerIntent);
          const solved = solveSagittalLegTarget(
            virtualDown,
            virtualForward,
            0,
            upperLength,
            lowerLength,
            out,
          );
          leg.rotation.x = solved.hipPitch;
          knee.rotation.x = solved.kneeFlex;
        };
        articulate(
          this.legR,
          this.kneeR,
          this.upperLegLengthR,
          this.lowerLegLengthR,
          LEG_SOLVE_R,
        );
        articulate(
          this.legL,
          this.kneeL,
          this.upperLegLengthL,
          this.lowerLegLengthL,
          LEG_SOLVE_L,
        );
      }

      // The hip sockets stay in the pelvis while a small mirrored splay places
      // each knee over its foot in the side-on skate stance.
      const stanceSplay = 0.1 * this.sidePose * Math.max(sk, this.grindArmPose);
      this.kneeR.rotation.z = -stanceSplay;
      this.kneeL.rotation.z = stanceSplay;
    }
    // Counter-rotate planted feet against the complete hip+knee chain. The
    // sole solver can translate a tilted shoe onto the deck, but only an ankle
    // joint can make the whole sole lie flat instead of touching at one corner.
    const deckFootPlant =
      THREE.MathUtils.smoothstep(this.deckPose, 0, 0.5) *
      (1 - this.wallridePose) *
      (1 - underW) *
      (1 - this.grabPose) *
      (1 - this.slidePose) *
      (1 - this.ledgePose);
    const groundFootPlant = this.grounded ? Math.max(crouchW, standCharge) : 0;
    const footPlant = THREE.MathUtils.clamp(
      Math.max(deckFootPlant, groundFootPlant) * (1 - star),
      0,
      1,
    );
    // Legacy pose owns a neutral foot/toe baseline every frame. Authored clips
    // and procedural overlays still run afterward and can articulate either.
    this.ankleR?.rotation.set(0, 0, 0);
    this.ankleL?.rotation.set(0, 0, 0);
    this.toeR?.rotation.set(0, 0, 0);
    this.toeL?.rotation.set(0, 0, 0);
    if (this.ankleR && this.legR && this.kneeR) {
      this.ankleR.rotation.set(
        -(this.legR.rotation.x + this.kneeR.rotation.x) * footPlant,
        0,
        -(this.legR.rotation.z + this.kneeR.rotation.z) * footPlant,
      );
    }
    if (this.ankleL && this.legL && this.kneeL) {
      this.ankleL.rotation.set(
        -(this.legL.rotation.x + this.kneeL.rotation.x) * footPlant,
        0,
        -(this.legL.rotation.z + this.kneeL.rotation.z) * footPlant,
      );
    }

    // Shoulders: open side-on in the skate stance (the board and hips keep
    // pointing along travel), square through a boardslide (the yaw pose has
    // the whole body), and counter-swing the legs on foot — plus the head
    // keeps the eyes on the horizon whatever the body is doing.
    if (this.upperG) {
      // The 90° turn lives in the body yaw now; the shoulders just OPEN a
      // touch back toward travel (skaters lead with the chest down the
      // line). The old fake side-on shoulder twist fades out with sidePose.
      const fwS = 1 - this.sidePose;
      const stance =
        (0.55 * sk * this.stance +
          (this.state === 'grind' && this.grindStyle !== 'board' && this.grindStyle !== 'lip'
            ? 0.45 * this.stance
            : 0)) *
          fwS -
        0.35 * this.stance * this.sidePose;
      const counter = -swing * 0.22 + 0.1 * Math.sin(this.runTime * 0.7) * idleW; // idle: lazy shoulder wander
      this.upperG.rotation.y +=
        (stance + counter - this.upperG.rotation.y) * Math.min(1, 10 * dt);
      // Crash runs chest-out, almost leaning BACK — never hunched forward.
      // Hanging, the chest presses gently toward the wall instead.
      this.upperG.rotation.x = -0.07 * this.walkAmp - 0.12 * underW + (HS ? HS.spine * 0.7 * HS.w : 0.16 * ledgeW + 0.5 * mantle); // hang chest: clip or authored
    }
    // Waist-seated additive spine layer. It is neutral until the full-body
    // keyframe sampler supplies a rest-relative quaternion here; the legacy
    // torso root above keeps all current gameplay poses unchanged.
    this.spineG?.rotation.set(0, 0, 0);
    if (this.headM) {
      const look =
        -0.45 * crawlMove - // crawl: the NECK counters the body pitch (negative = chin up) — eyes forward
        (HS ? -HS.head * 0.5 * HS.w : 0.35 * ledgeW * (1 - ck)) - // hang gaze: clip or authored (chin up = positive here)
        0.05 * crouchW -
        0.5 * this.dropPose -
        0.4 * this.slidePose -
        0.3 * this.chargePose -
        0.45 * this.grabPitch * this.grabPose +
        0.3 * this.hangPose -
        0.55 * this.slopePose +
        0.06 * breathe * idleW + // idle: breath lifts the chin a touch
        0.18 * jp * Math.max(0, riseK); // jump: chin up through the launch
      this.headM.rotation.x +=
        (THREE.MathUtils.clamp(look, -1.0, 0.6) - this.headM.rotation.x) * Math.min(1, 12 * dt);
      // Side-on: the head turns back over the lead shoulder to watch the
      // line of travel (the body faces across the board; the eyes don't).
      // Idling, she glances around the scene slowly instead.
      const headYaw = -0.85 * this.stance * this.sidePose + 0.17 * Math.sin(this.runTime * 0.55) * idleW;
      this.headM.rotation.y += (headYaw - this.headM.rotation.y) * Math.min(1, 12 * dt);
    }
    // A readable hand pose is part of the procedural motion layer. Authored
    // finger tracks run afterward and therefore remain the final authority.
    const gloveOpen = THREE.MathUtils.clamp(Math.max(crawlMove, crouchW * 0.35), 0, 1);
    const gloveGrip = THREE.MathUtils.clamp(
      Math.max(this.grabPose, ledgeW, underW, this.grindArmPose),
      0,
      1,
    );
    const gloveFist = this.spinning ? 1 : 0;
    let glovePose = blendCartoonGlovePose(
      CARTOON_GLOVE_POSES.relaxed,
      CARTOON_GLOVE_POSES.open,
      gloveOpen,
    );
    glovePose = blendCartoonGlovePose(glovePose, CARTOON_GLOVE_POSES.grab, gloveGrip);
    glovePose = blendCartoonGlovePose(glovePose, CARTOON_GLOVE_POSES.fist, gloveFist);
    if (this.gloveLeft) setCartoonGlovePose(this.gloveLeft, glovePose);
    if (this.gloveRight) setCartoonGlovePose(this.gloveRight, glovePose);
    // Tail + legacy ponytail-node follow-through is authored before the final appearance
    // pass so keyframed secondary channels can still layer over the simulation.
    if (this.tail) {
      const lift =
        0.45 * this.hangPose -
        0.3 * ledgeW +
        0.5 * this.grabPose +
        0.3 * this.grindArmPose +
        0.3 * sk -
        0.45 * crawlMove +
        0.15 * crouchW +
        0.25 * this.walkAmp +
        0.35 * jp +
        0.35 * Math.sin(Math.PI * this.bailRecoveryPose);
      this.tail.update(
        dt,
        { lift, wag: 0.16 * breathe + 0.5 * swing, roll: 0.05 * breathe },
        this.tailBodies_(),
      );
    }
    if (this.ponyA && this.ponyB) {
      this.ponyA.rotation.set(1.2 + 0.06 * breathe - 0.3 * this.hangPose, 0.18 * swing, 0);
      this.ponyB.rotation.x = 0.5 + 0.05 * breathe;
    }

    const raw = this.rawInput;
    // Grab variants, skate-photo poses (arms pivot at the SHOULDER: 0 = arm
    // hanging, positive = swinging forward/up, negative = back/up).
    let pitchT = 0.9;
    let rollT = 0;
    let armRT = 1.1; // right hand pulls the board at the tucked knees
    let armLT = -2.2; // left arm thrown high behind
    if (this.grabbing) {
      if (raw.moveY > 0.4) {
        pitchT = 1.25; // nosegrab: pitched hard over the nose
        armRT = 1.5;
        armLT = -2.4;
      } else if (raw.moveX < -0.4) {
        pitchT = 0.6; // melon: leading hand swaps, lean left
        rollT = -0.5;
        armRT = -2.0;
        armLT = 1.2;
      } else if (raw.moveX > 0.4) {
        pitchT = 0.6; // indy: lean right
        rollT = 0.5;
        armRT = 1.2;
        armLT = -1.7;
      }
    }
    const poseBlend = Math.min(1, 12 * dt);
    this.grabPitch += (pitchT - this.grabPitch) * poseBlend;
    this.grabRoll += (rollT - this.grabRoll) * poseBlend;
    this.armRPose += (armRT - this.armRPose) * poseBlend;
    this.armLPose += (armLT - this.armLPose) * poseBlend;
    // Grind: arms come out wide for balance, tipping with the needle.
    // Balance arms come out for grinds, manuals, AND lip stalls (the manual
    // writes the same balance field, so the tipping visual just works).
    this.grindArmPose +=
      ((this.state === 'grind' || this.manualing !== 0 || this.lipStallT > 0 ? 1 : 0) -
        this.grindArmPose) *
      Math.min(1, 10 * dt);

    // Arm channels. ANTI-symmetric: the run swing (arms counter the legs).
    // SYMMETRIC (both arms together): crawl hands to the ground, charge
    // wind-up (arms swept back, loading the spring), flip tuck wrap, teeter
    // windmill, pegged-needle flail, bail flail.
    const windmill = this.teeterPose * Math.sin(this.teeterPhase * 13) * 1.3;
    // Only GRINDS tip the spread arms sideways with the needle — a manual's
    // needle is fought in pitch (see manualPitch), so its arms stay symmetric.
    const railBal = this.state === 'grind' ? this.balance : 0;
    // The flail used to switch on only at the peg, which made the last moment
    // before a bail arrive with no warning at all. It now RAMPS with how far
    // out the needle is, so the arms start working well before the edge, and
    // goes faster and wider once it is actually pegged.
    const offBal = Math.abs(railBal);
    const critFlail =
      (this.balanceCritT > 0 ? Math.sin(this.runTime * 22) * 0.8 : 0) +
      Math.sin(this.runTime * (9 + 9 * offBal)) * 0.42 * offBal * offBal;
    const bailFlail = this.bailing ? Math.sin(this.bailSpin * 2.7) * 1.1 : 0;
    const anti = -swing * 1.35 * (1 - this.grabPose); // reference arm pump: big, from the shoulder
    const sym =
      (breathe * 0.06 * this.idleAmp +
        -1.0 * crawlMove + // hands reach down-FORWARD to the ground (negative = forward swing)
        0.15 * crouchW - // squat: arms hang easy by the knees
        0.95 * this.chargePose +
        1.9 * flipTuck +
        windmill +
        critFlail +
        bailFlail) *
      (1 - this.grabPose);
    // Slide: trailing hand drags behind, lead arm reaches ahead.
    const slideR = -1.1 * this.slidePose;
    const slideL = 0.7 * this.slidePose;
    // the authored model hangs closer to the body (userData.lean); the
    // procedural fallback keeps its old 0.25 A-frame lean
    const leanR = (this.armR?.userData.lean as number | undefined) ?? 0.25;
    const leanL = (this.armL?.userData.lean as number | undefined) ?? 0.25;
    if (this.armR) {
      this.armR.rotation.x =
        this.armRPose * this.grabPose + anti + sym + slideR + 0.4 * this.wallridePose + 0.06 * breathe * idleW + // lead hand reaches down the wall; breath sways the idle hang
        0.18 * underW + (HS ? (HS.armXR + gripTrem) * HS.w : (0.3 + gripTrem + 0.55 * ck) * ledgeW + handOver); // hang arm swing: clip or authored
      this.armR.rotation.z =
        leanR -
        this.grabPose * 0.55 +
        1.15 * this.grindArmPose * (1 + 0.85 * railBal) + // balance arms out wide; on a grind they SWING WITH the roll — see the left arm
        1.25 * this.dropPose + // slam starfish
        2.1 * this.starPose + // star jump: arms thrown up-out
        (2.1 + 0.6 * riseK) * jp + // jump: arms thrown overhead, easing as she drops
        2.45 * underW + (HS ? (HS.armZR - leanR) * HS.w : (2.5 - 2.0 * ck) * ledgeW) + // arm raise: clip is an absolute elevation, so the base lean blends out
        1.05 * this.wallridePose + // wallride: arm flung out for balance
        0.35 * this.skatePose; // loose skate arms
    }
    if (this.armL) {
      this.armL.rotation.x =
        this.armLPose * this.grabPose -
        anti +
        sym +
        slideL -
        0.65 * this.wallridePose +
        0.06 * breathe * idleW + // trailing arm swept back; breath sways the idle hang
        0.18 * underW + (HS ? (HS.armXL - gripTrem) * HS.w : (0.3 - gripTrem + 0.55 * ck) * ledgeW - handOver); // hang arm swing: clip or authored
      this.armL.rotation.z =
        -leanL +
        this.grabPose * 0.45 -
        // The spread goes ASYMMETRIC with the needle, in the same direction as
        // the body roll: going over her right, the right arm sweeps up and over
        // and the left drops. A true counterweight (left arm up) was tried and
        // is worse here — it half-cancels the roll, and the roll is the cue
        // that has to read in a fifth of a second from six metres back.
        1.15 * this.grindArmPose * (1 - 0.85 * railBal) -
        1.25 * this.dropPose -
        2.1 * this.starPose - // star jump: arms thrown up-out
        (2.1 + 0.6 * riseK) * jp - // jump: arms thrown overhead, easing as she drops
        2.45 * underW - // under-rail: this whole chain subtracts, so the minus ahead of this term raises the arm
        (HS ? (HS.armZL - leanL) * HS.w : (2.5 - 2.0 * ck) * ledgeW) - // arm raise: clip is an absolute elevation, so the base lean blends out
        1.05 * this.wallridePose - // wallride: arm flung out for balance
        0.35 * this.skatePose;
    }
    // ELBOWS (authored model): a relaxed base bend, deeper when that arm
    // swings forward through the run, pumping on the board, or on all fours —
    // and snapped straight for star jumps, slams, and board grabs.
    if (this.elbowR || this.elbowL) {
      const straight = 1 - 0.9 * Math.max(this.grabPose, this.dropPose, this.starPose);
      const bendR =
        (0.12 +
          0.02 * breathe * idleW +
          0.65 * Math.max(0, anti) +
          0.35 * this.walkAmp + // running: elbows stay cocked like the reference
          0.3 * jp + // overhead throw keeps a reference-style elbow bend
          0.25 * this.skatePose +
          0.45 * crawlMove +
          0.3 * crouchW +
          0.3 * underW + (HS ? HS.elbR * 0.8 * HS.w : 0.25 * ledgeW) + // grip elbows: clip or authored
          0.3 * this.slidePose) *
        straight;
      const bendL =
        (0.12 +
          0.02 * breathe * idleW +
          0.65 * Math.max(0, -anti) +
          0.35 * this.walkAmp +
          0.3 * jp +
          0.25 * this.skatePose +
          0.45 * crawlMove +
          0.3 * underW + (HS ? HS.elbL * 0.8 * HS.w : 0.25 * ledgeW) + // grip elbows: clip or authored
          0.3 * crouchW) *
        straight;
      if (this.elbowR) this.elbowR.rotation.x = -Math.max(0.05, bendR);
      if (this.elbowL) this.elbowL.rotation.x = -Math.max(0.05, bendL);
    }
    // Same single-write hook for future wrist flex/twist keyframes. Elbow and
    // shoulder animation already carries these neutral hands through every
    // current gameplay pose without accumulated transforms.
    this.wristR?.rotation.set(0, 0, 0);
    this.wristL?.rotation.set(0, 0, 0);
    // ROPE: both hands meet on the line overhead. The under-rail grip spreads
    // the hands to two rail-ends; on a rope they grip the same point, so raise
    // both arms straight up and twist them inward until the hands come together.
    if (this.state === 'rope' && this.armR && this.armL) {
      this.armR.rotation.set(0, -0.5, 2.72);
      this.armL.rotation.set(0, 0.5, -2.72);
      if (this.elbowR) this.elbowR.rotation.x = -0.22;
      if (this.elbowL) this.elbowL.rotation.x = -0.22;
    }
    // The procedural legs are fixed-length bones now. All shortening intent
    // was converted into hip/knee articulation above; no nonuniform scaling is
    // allowed to turn a bent thigh or shin into a voxel-like block.
    if (this.boardG) {
      // The charge crouch drops the whole bodyGroup 0.26 (world) — the board
      // rides that group, so push it back up (0.26 / the 1.18 body scale) to
      // keep the wheels ON the ground instead of clipping through it.
      this.boardG.position.y = 0.5 * this.grabPose + this.chargePose * (0.22 - 0.12 * this.skatePose);
      this.boardG.rotation.x = 0.3 * this.grabPose; // nose tips up in the hand
      // The deck does NOT turn with the side-on body: counter-rotate the
      // stance yaw so the board stays along the line of travel (spins and
      // boardslides still carry it — those live in the body yaw terms).
      this.boardG.rotation.y = -this.stance * (Math.PI / 2) * this.sidePose;
      // THE BOARD IS OUT WHEN YOU ARE SKATING. Nothing else. freeSkate is the
      // skate state — the same flag the movement model uses to decide you are
      // riding rather than walking — so the deck now says exactly what the
      // game already believes about you.
      //
      // It used to ALSO appear on `|speed| > boardSpeed`, and that clause sat
      // outside every state gate: anything that moved you fast while the state
      // said on-foot (a skate-blocked run, a crawl carrying momentum, a slide
      // burst) put a board under you that you were not riding. Speed is a
      // consequence of skating, not the definition of it, and the movement
      // model had already worked that out — "skating is a STATE, not a speed
      // threshold" is written over the freeSkate branch. The visual just never
      // got the message.
      //
      // grind and grabPose stay because both ARE the board: a grind is riding
      // the deck along a rail, and a grab holds it in your hands. The old
      // charge clause is gone as redundant — a charge that is propelling you
      // past walking pace has already set freeSkate through pushingOff.
      this.boardG.visible =
        this.slideTimer <= 0 &&
        this.starPose < 0.4 && // stowed through the star-jump beat
        this.ledgePose < 0.3 && // stowed while hanging off a ledge (hands are busy)
        this.state !== 'rope' && // stowed on the swing rope: both hands grip it
        (this.state === 'grind' || this.freeSkate || this.grabPose > 0.05);
    }
    // WALLRIDE: the deck tips onto its SIDE against the wall (all four wheels to
    // the face) while the RIDER stays upright — head on top — hanging off it,
    // leaning out from the wall. sign from heading × outward-normal.
    this.wallridePose += ((this.wallriding ? 1 : 0) - this.wallridePose) * Math.min(1, 12 * dt);
    // Pumping the wall (holding X to load a launch) sinks the rider into a
    // crouch that deepens with the charge — a visual tell for how loaded it is.
    const wallChargeTarget = this.wallriding
      ? Math.min(1, this.wallChargeT / Math.max(0.001, TUNING.wallChargeMax))
      : 0;
    this.wallChargePose += (wallChargeTarget - this.wallChargePose) * Math.min(1, 14 * dt);
    let wallRoll = 0;
    let wallSide = 0;
    if (this.wallridePose > 0.01) {
      wallSide = Math.sign(this.axisF.z * this.wallNormal.x - this.axisF.x * this.wallNormal.z) || 1;
      wallRoll = this.wallridePose * -wallSide * 0.32; // body hangs slightly OUT, torso upright, head up (~18°)
    }
    // OFF BALANCE. The needle is a number on the HUD; this is the same number
    // on the rider. The whole body tips toward the side the meter is showing —
    // Signs here are MEASURED, not derived: a needle held at +0.85 and one
    // held at -0.85 are rendered and the rider's spine is projected onto her
    // own left axis, so the whole transform chain has its say. That says a
    // positive needle — which the HUD draws to the RIGHT — needs this roll
    // positive. It tips further once the needle is pegged and she is genuinely
    // going over; squared, so the first half of the meter is a lean and the
    // last quarter is a crisis.
    const balRoll =
      railBal *
      Math.abs(railBal) *
      (0.42 + 0.22 * (this.balanceCritT > 0 ? 1 : 0)) *
      this.grindArmPose;
    this.bodyGroup.rotation.z = this.slopeRoll + wallRoll + balRoll + this.grindPoseZ;
    // the head stays up and fights it — the last thing to give
    if (this.headM) this.headM.rotation.z = -balRoll * 0.55;
    if (this.boardG) {
      // the deck edges up under her as she goes over — the board is on the
      // rail, so it rolls about a third as far as the body does
      // the style roll is the DECK's, so the board takes more of it than the
      // body does — the opposite split to the balance needle above
      this.boardG.rotation.z = balRoll * 0.34 + this.grindPoseZ * 0.55;
      // x and z are wallride-only offsets, rebuilt from scratch below when a
      // wallride is live — zero them EVERY frame or the .add() accumulates
      this.boardG.position.x = 0;
      this.boardG.position.z = 0;
      // UNDER-RAIL HANG: the deck leaves the feet and goes CROSSWISE overhead,
      // gripped at both ends — riding just beneath the rail line.
      if (underW > 0.001) {
        this.boardG.rotation.x *= 1 - underW;
        this.boardG.rotation.z *= 1 - underW;
        this.boardG.rotation.y = this.boardG.rotation.y * (1 - underW) + (Math.PI / 2) * underW;
        this.boardG.position.y += underW * 1.05; // up into both hands, just beneath the line
        // the grip IS the board under a RAIL — but on the swing rope the hands
        // hold the rope itself, so no deck.
        this.boardG.visible = this.state !== 'rope';
      }
      // WALLRIDE: the deck's wall pose is authored in WORLD space — griptape
      // out along the wall normal (toward the rider), length down the ride
      // line, wheels pressed into the face — then pulled back through the
      // parent's live world rotation. Every parent-frame attempt at this has
      // been wrong at least once (the roll sign was flipped in a9eb463, the
      // axis re-derived in 254f31a), because the rig above the board keeps
      // its own counsel: a stance yaw here, a 180° flip on the outer group
      // there, and yesterday's correct sign quietly inverts. Stating the
      // answer in world coordinates is stance-proof and rig-refactor-proof:
      // whatever the chain does, the wheels face the wall.
      if (this.wallridePose > 0.001) {
        const t = this.wallridePose;
        Player.WALL_Y.copy(this.wallNormal); // griptape faces the rider
        Player.WALL_Z.set(this.axisF.x, 0, this.axisF.z).normalize(); // deck along the ride
        Player.WALL_X.crossVectors(Player.WALL_Y, Player.WALL_Z);
        Player.WALL_M.makeBasis(Player.WALL_X, Player.WALL_Y, Player.WALL_Z);
        Player.WALL_QT.setFromRotationMatrix(Player.WALL_M);
        this.bodyGroup.getWorldQuaternion(Player.WALL_QP);
        Player.WALL_QT.premultiply(Player.WALL_QP.invert());
        this.boardG.quaternion.slerp(Player.WALL_QT, t);
        // flush to the face (the wall plane sits playerHalf + the glue gap
        // off the physics point) and up to foot height — world-space, pulled
        // into the parent frame the same way
        Player.WALL_OFF.set(
          -this.wallNormal.x * 0.55 * t,
          0.34 * t,
          -this.wallNormal.z * 0.55 * t,
        )
          .applyQuaternion(Player.WALL_QP)
          .divide(this.bodyGroup.scale); // parent units, not world units
        this.boardG.position.add(Player.WALL_OFF);
      }
      // FLIP TRICK: the deck turns underneath the rider — compounded onto the
      // pose set above (which is authored fresh every frame, so a total-angle
      // rotation here is stable). Board-local axes per the wall basis: +Z nose,
      // +Y griptape, +X width.
      if (this.state === 'grind' && this.specialGrind?.id === 'darkslide')
        this.boardG.rotateZ(Math.PI);
      if (this.flipT > 0) {
        const fprog = 1 - this.flipT / Math.max(this.flipDuration, 0.001);
        const fang = fprog * Math.PI * 2;
        if (this.specialFlip) {
          this.boardG.rotateZ(fang);
          this.boardG.rotateY(fang);
        } else if (this.flipKind === 'kick') this.boardG.rotateZ(fang);
        else if (this.flipKind === 'heel') this.boardG.rotateZ(-fang);
        else if (this.flipKind === 'shove') this.boardG.rotateY(fang);
        else if (this.flipKind === 'imposs') this.boardG.rotateX(fang);
        else {
          // varial: roll + shove together
          this.boardG.rotateZ(fang);
          this.boardG.rotateY(fang);
        }
      }
      if (this.boardSnapT > 0) this.boardG.visible = false; // snapped: no deck until the get-up ends
    }
    if (this.upperG) this.upperG.rotation.z = this.grabRoll * this.grabPose;
    // Mask hovers at the shoulder; the whole body flickers during
    // mask-invulnerability grace — but NOT during a wipeout's own grace:
    // the ragdoll already says everything the flash used to.
    this.bodyGroup.visible =
      this.invulnTimer <= 0 ||
        this.invulnSilent ||
        Math.sin(this.runTime * 45) > -0.2 ||
        this.state === 'dead';
    // On foot, an ordinary attack replaces the rider with the Whirlwind Vixen
    // sculpture and character rings. A spin that STARTS while genuinely
    // grounded on the skateboard keeps the native rider/deck rotation and gets
    // its own low ring instance; board air, grinds, grabs and wallrides remain
    // halo-free. Gameplay timing, reach, scoring and audio stay in updateSpin.
    if (this.spinEffects) {
      const active =
        this.spinning && !this.bailing && this.state !== 'dead' && this.state !== 'gameover';
      const bodyVisible = this.bodyGroup.visible;
      const boardAttached = this.boardG?.visible ?? false;
      const groundedSkate = groundedSkateSpinEligible({
        active,
        movementState: this.state,
        grounded: this.grounded,
        freeSkate: this.freeSkate,
        boardVisible: boardAttached,
      });
      this.spinEffects.update({
        step: Math.floor(this.runTime * 60 + 0.000000001),
        active,
        // Do not fold bodyVisible into this authority: invulnerability flicker
        // must never let one attack-start tick route a board spin to the halo.
        boardAttached,
        groundedSkate,
        bodyVisible,
        reset: this.bailing || this.state === 'dead' || this.state === 'gameover',
      });
      if (this.spinEffects.sculptureVisible) this.bodyGroup.visible = false;
    }
    // Perfect-grind bloom: pink, body-enveloping, fading out over the last
    // half second so the boost ENDING is as readable as it starting.
    if (this.boostGlow) {
      const lit = this.grindBoostT > 0 && this.state !== 'dead';
      this.boostGlow.visible = lit;
      if (lit) {
        const fade = Math.min(1, this.grindBoostT / 0.5);
        const flare = 1 + Math.sin(this.runTime * 11) * 0.11;
        this.boostGlow.position.set(this.pos.x, this.pos.y + 1.0, this.pos.z);
        this.boostGlow.scale.setScalar(3.5 * flare);
        (this.boostGlow.material as THREE.SpriteMaterial).opacity = 0.9 * fade;
      }
    }
    if (this.maskMesh) {
      const uber = this.uberTimer > 0; // third mask
      const two = !uber && this.masks >= 2; // second mask held
      const vis = (this.masks > 0 || uber) && this.state !== 'dead';
      this.maskMesh.visible = vis;
      // Front (local -Z) points at the camera at yaw = atan2(camDir.x, camDir.z);
      // it rocks around that instead of spinning through — never the back.
      const faceYaw = Math.atan2(this.camDir.x, this.camDir.z);
      // Anchor to the ACTUAL head (so it tracks every pose — crouch, air, lean),
      // and lay the mask out in CAMERA space: pulled toward the lens and offset
      // by the viewer's screen axes. A fixed WORLD offset used to bury the mask
      // in the face whenever the skater travelled toward +X (the Sideways stretch
      // faces that way the whole time) or turned to face the camera. Camera-space
      // keeps it floating clear IN FRONT of the face no matter the heading.
      if (this.headVisualCenter) this.headVisualCenter.getWorldPosition(this.maskAnchor);
      else if (this.headM) this.headM.getWorldPosition(this.maskAnchor);
      else this.maskAnchor.set(this.pos.x, this.pos.y + 1.42, this.pos.z);
      const hx = this.maskAnchor.x;
      const hy = this.maskAnchor.y;
      const hz = this.maskAnchor.z;
      // horizontal camera-forward (lens -> scene) and the viewer's screen-right
      let cfx = this.camDir.x;
      let cfz = this.camDir.z;
      const clen = Math.hypot(cfx, cfz) || 1;
      cfx /= clen;
      cfz /= clen;
      const rx = -cfz; // screen-right = camera-forward rotated -90 about Y
      const rz = cfx;
      if (uber) {
        // third mask: WORN on the face. It sits in front of the skull and turns
        // WITH the skater's own facing — so it tracks the head in every direction
        // (running away, left or right included), showing its side/back just like
        // a real worn mask when the skater turns from the camera. (The old
        // camera-relative placement only lined up with the face when you ran
        // toward the lens.) Head-anchored and pushed out enough to clear the face.
        let ffx = -Math.sin(this.visualYaw);
        let ffy = 0;
        let ffz = -Math.cos(this.visualYaw);
        if (this.headLookSocket) {
          this.headLookSocket.getWorldDirection(this.headForward).normalize();
          ffx = this.headForward.x;
          ffy = this.headForward.y;
          ffz = this.headForward.z;
        }
        this.maskMesh.position.set(
          hx + ffx * 0.42,
          hy + ffy * 0.42 + 0.03 + Math.sin(this.runTime * 9) * 0.03,
          hz + ffz * 0.42,
        );
        if (this.headLookSocket) {
          this.headLookSocket.getWorldQuaternion(this.headWorldQuaternion);
          this.maskMesh.quaternion.copy(this.headWorldQuaternion);
          this.maskMesh.rotateY(Math.PI + Math.sin(this.runTime * 5) * 0.05);
        } else {
          this.maskMesh.rotation.set(
            0,
            this.visualYaw + Math.PI + Math.sin(this.runTime * 5) * 0.05,
            0,
          );
        }
        this.maskMesh.scale.setScalar(0.82);
      } else {
        // held mask (states 1 & 2): floats up and to the screen-side of the head,
        // pushed out ~1/3 of a skater-width further right so it isn't fighting the
        // skater for space, tipped a touch toward the lens so it reads clear of the
        // face. FIXED size — the 2nd mask doesn't grow, it just glows harder.
        this.maskMesh.position.set(
          hx + rx * 0.95 - cfx * 0.18,
          hy + 0.34 + Math.sin(this.runTime * 3) * 0.09,
          hz + rz * 0.95 - cfz * 0.18,
        );
        this.maskMesh.rotation.y = faceYaw + Math.PI + Math.sin(this.runTime * 2.4) * 0.32;
        this.maskMesh.scale.setScalar(0.85); // states 1 & 2: 15% smaller than before
      }
      // Crossbones ride under the skull only on the 2nd mask (state 2).
      if (this.maskBones) this.maskBones.visible = two;
      // Pink spark comet-tail on the 2nd + 3rd mask: streams off the mask (2nd)
      // or the skater (3rd), trailing opposite to how the skater is moving.
      if ((two || uber) && vis) {
        this.maskSparkT += dt;
        const interval = uber ? 0.022 : 0.032;
        const ex = uber ? this.pos.x : this.maskMesh.position.x;
        const ey = uber ? this.pos.y + 1.1 : this.maskMesh.position.y;
        const ez = uber ? this.pos.z : this.maskMesh.position.z;
        const spread = uber ? 0.7 : 0.4;
        while (this.maskSparkT >= interval) {
          this.maskSparkT -= interval;
          const s = this.maskSparks.find((k) => k.life <= 0);
          if (!s) break;
          s.sprite.position.set(
            ex + (Math.random() - 0.5) * spread,
            ey + (Math.random() - 0.5) * spread,
            ez + (Math.random() - 0.5) * spread,
          );
          s.vel.set(
            -this.lastVelX * 0.35 + (Math.random() - 0.5) * 1.2,
            Math.random() * 0.8 + 0.3,
            -this.lastVelZ * 0.35 + (Math.random() - 0.5) * 1.2,
          );
          s.maxLife = 0.4 + Math.random() * 0.3;
          s.life = s.maxLife;
        }
      }
    }
    // Advance every live pink spark (runs even after the mask is spent so a
    // trailing ember finishes fading instead of snapping off).
    for (const s of this.maskSparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.sprite.visible = false;
        continue;
      }
      s.vel.y -= 1.6 * dt; // gentle sag
      s.sprite.position.x += s.vel.x * dt;
      s.sprite.position.y += s.vel.y * dt;
      s.sprite.position.z += s.vel.z * dt;
      const f = s.life / s.maxLife;
      s.sprite.visible = true;
      (s.sprite.material as THREE.SpriteMaterial).opacity = f;
      s.sprite.scale.setScalar(0.28 * (0.35 + 0.65 * f));
    }

    // Grab tuck + Crash front-flip + slide/crawl crouch + slam poses,
    // blended (they're mutually exclusive in practice). The grab pose ramps
    // over grabTransition — land while it's anywhere but flat and you bail.
    const targetPose = this.grabbing ? 1 : 0;
    // reach IN at the snappy constant; the return-to-neutral matches the
    // grabRelease slider, so what you see IS the bail window
    const grabRate =
      targetPose > this.grabPose ? dt / CONST.grabTransition : dt / Math.max(TUNING.grabRelease, 0.05);
    // Move-toward, STOPPING at the target: stepping past it and bouncing back
    // made the whole pose strobe between two frames once the grab was fully
    // reached — which on screen read as the skater flashing "transparent".
    const grabDelta = targetPose - this.grabPose;
    this.grabPose += Math.sign(grabDelta) * Math.min(Math.abs(grabDelta), grabRate);
    const targetSlide = this.sliding ? 1 : 0;
    this.slidePose += (targetSlide - this.slidePose) * Math.min(1, 18 * dt);
    // Slope pitch + roll: on the ground, the body tilts to lie along the
    // surface — nose down rolling downhill, nose up climbing, and leaning
    // into a cross-slope (bank / halfpipe wall) — so ramps and transitions
    // never shear through a bolt-upright model. Measured in the FACING frame
    // (which tracks real travel), so walking backward down a ramp tilts the
    // right way too.
    let slopeT = 0;
    let slopeRollT = 0;
    if (this.grounded && this.state === 'ride' && this.groundHit) {
      const n = this.rideNormal; // smoothed ride plane: no facet snap in the pose
      const fx = Math.sin(this.visualYaw + Math.PI);
      const fz = Math.cos(this.visualYaw + Math.PI);
      const gf = (n.x * fx + n.z * fz) / Math.max(n.y, 0.2); // drops ahead > 0
      const gl = (n.x * fz - n.z * fx) / Math.max(n.y, 0.2); // drops to the left > 0
      slopeT = THREE.MathUtils.clamp(Math.atan(gf), -1.0, 1.0) * 0.85;
      slopeRollT = THREE.MathUtils.clamp(-Math.atan(gl), -1.0, 1.0) * 0.85;
      // On steep ground the ROOT alignment (above) already lays the rig on the
      // wall; fade these capped body-pitch/roll channels out as it takes over,
      // or the two stack and over-rotate the torso past the surface.
      const fade = 1 - this.alignPose;
      slopeT *= fade;
      slopeRollT *= fade;
    }
    this.slopePose += (slopeT - this.slopePose) * Math.min(1, 10 * dt);
    this.slopeRoll += (slopeRollT - this.slopeRoll) * Math.min(1, 10 * dt);
    // All-fours crawl pose (dog stance): torso pitched over, hands down.
    this.crawlPose += ((this.crawling ? 1 : 0) - this.crawlPose) * Math.min(1, 14 * dt);
    // Slam has three beats: the "uh oh" hang, the pancake drop, then lying
    // flat on the ground for a moment before getting up.
    const hanging = this.slamActive && this.slamHangT > 0;
    const slamDropping =
      (this.slamActive && this.slamHangT <= 0) || this.slamFlatT > 0;
    // A bail begins in the same grounded sprawl. Once supported recovery owns
    // the rider, the feet-root drop is removed in one equivalent handoff and
    // the waist-pivoted forward roll below becomes the sole body root motion.
    const recoveringBail = this.bailRecoverT >= 0 && this.bailRecoveryPose > 0;
    const dropTarget = Math.max(
      slamDropping ? 1 : 0,
      this.bailDownT > 0 && !recoveringBail ? 1 : 0,
    );
    this.hangPose += ((hanging ? 1 : 0) - this.hangPose) * Math.min(1, 16 * dt);
    // The get-up eases at the SAME rush the mash is applying to the clock — the
    // visible speed-up is what sells the mash; without it nothing reads.
    const dropRush = this.bailDownT > 0 ? this.bailRush : 1;
    this.dropPose +=
      (dropTarget - this.dropPose) *
      Math.min(1, 20 * dropRush * dt);
    const bodyDropPose = recoveringBail ? 0 : this.dropPose;
    // smoothstep: the roll accelerates into the tuck and eases out upright
    const flip = flipQ * flipQ * (3 - 2 * flipQ) * Math.PI * 2;
    if (this.state === 'dead' && this.bailing) {
      // Bail tumble: rag-doll head-over-heels until the respawn.
      this.bailSpin += 13 * dt;
      this.bodyGroup.rotation.x = this.bailSpin;
    } else {
      // forward lean builds with real running speed (sprint posture)
      const runLean = 0.14 * this.walkAmp * Math.min(1, planar / Math.max(TUNING.walkSpeed, 1));
      this.bodyGroup.rotation.x =
        flip * (1 - this.grabPose) + specialTwist +
        this.grabPitch * this.grabPose -
        0.6 * this.slidePose + // baseball slide: leaned back on the hip
        (0.75 * crawlMove + 0.16 * crouchW) - // all fours hunch when MOVING; a squat stays upright
        0.55 * this.hangPose + // rear back: "...uh oh"
        1.45 * bodyDropPose - // belly-first pancake; recovery moves this pitch to riderG
        0.28 * this.teeterPose + // arms-back "whoa whoa" lean
        0.18 * this.skatePose + // athletic crouch over the board
        runLean +
        this.slopePose + // lie along the ramp/transition under the board
        this.grindPoseX + // nosegrind / 5-0 lean
        this.manualPitch; // two wheels: nose up (manual) or nose down (nose manual)
    }
    // Manual pitch eases in/out — and the balance needle LIVES in the pitch:
    // tipping backward (balance +) pulls the nose higher, tipping forward dips
    // it, so the wobble you fight reads as up-and-down, not a sideways lean.
    // Lip stall: lean IN-WORLD along the tip axis (into the pipe vs out the
    // back). The stall faces the deck, so that axis is (nearly) the facing —
    // project it and ride the same eased pitch channel the manual uses.
    let stallLean = 0;
    if (this.lipStallT > 0 && this.lipPipe) {
      const tipX = this.lipPipe.axis === 'z' ? -this.lipSide : 0;
      const tipZ = this.lipPipe.axis === 'z' ? 0 : -this.lipSide;
      stallLean = (tipX * this.axisF.x + tipZ * this.axisF.z) * this.balance * 0.65;
    }
    const manualTarget =
      this.manualing !== 0 ? (this.manualing === 1 ? -0.4 : 0.35) - this.balance * 0.4 : stallLean;
    this.manualPitch += (manualTarget - this.manualPitch) * Math.min(1, 14 * dt);
    const targetCharge = this.charging ? 0.35 + 0.65 * Math.min(1, this.chargeTimer / TUNING.jumpChargeTime) : 0;
    this.chargePose += (targetCharge - this.chargePose) * Math.min(1, 16 * dt);
    // Crouch drops. The crawl and slam use SMALL drops: their pitch already
    // lays the torso out at ground level, and the old deep crawl drop was
    // burying the whole body under the floor.
    this.bodyGroup.position.y =
      this.grabPose * -0.5 -
      this.slidePose * 0.38 -
      (crawlMove * 0.2 + crouchW * 0.36) - // crawl: shallow drop — the pitch already lays her out; deeper buries the knees
      this.chargePose * (0.26 - 0.14 * this.skatePose) + // board pump: shallower — a full drop buries the torso through the deck
      standCharge * 0.12 - // planted on-foot: ease the crouch drop (no deck to sink into)
      this.wallChargePose * 0.28 - // sink into the wall pump
      (this.grounded ? 0.1 * bodyDropPose : 0) +
      Math.abs(Math.sin(this.walkPhase)) * 0.075 * this.walkAmp + // reference bounce: each step hops
      breathe * 0.015 * this.idleAmp;
    // The somersault wheels around the WAIST, not the feet (the rig's origin):
    // counter-translate so the hip stays pinned on the jump arc while the
    // body rotates about it. The offset lives in the group frame, so the
    // pitch axis has to account for the body's own yaw.
    if (flip > 0) {
      const waistH = this.characterWaistHeight(0.95);
      const yawB = this.bodyGroup.rotation.y;
      this.bodyGroup.position.y += waistH * (1 - Math.cos(flip));
      this.bodyGroup.position.x = -waistH * Math.sin(flip) * Math.sin(yawB);
      this.bodyGroup.position.z = -waistH * Math.sin(flip) * Math.cos(yawB);
    } else {
      this.bodyGroup.position.x = 0;
      this.bodyGroup.position.z = 0;
    }
    // Impact squash right after a slam lands. Crawl keeps only a whisper of
    // whole-body compression; the articulated hips and knees own its height,
    // so rotated limbs never inherit a Minecraft-like nonuniform squash.
    const squash = this.slamSquash > 0 ? this.slamSquash / CONST.slamSquashTime : 0;
    this.bodyGroup.scale.y = 1.36 * (1 - 0.6 * squash) * (1 - 0.06 * this.crawlPose);

    // SKETCHY landing: a fading side-to-side shimmy — you kept it, barely.
    if (this.sketchyT > 0 && !this.ragActive) {
      const w = this.sketchyT / 0.6;
      this.bodyGroup.rotation.z += Math.sin(this.runTime * 26) * 0.16 * w;
      this.bodyGroup.rotation.x += Math.sin(this.runTime * 19) * 0.07 * w;
    }

    // RAGDOLL TUMBLE — the last word on the body while a wipeout is airborne.
    // The orientation is INTEGRATED, not posed: an angular velocity seeded by
    // whatever went wrong spins the body about the live crash axes (pitch over
    // travel-left, roll along travel, yaw about up — they follow axisF as the
    // crash steers, which is where the chaos comes from), built in WORLD space
    // and pulled back through the parent exactly like the wallride deck, so
    // rig refactors above can't flip it. Grounded and slowing, the blend hands
    // the body directly into the supported shoulder-roll recovery.
    if (this.ragActive || this.ragBlend > 0.001) {
      const slopeTumble =
        this.grounded && this.onTransition && this.isBailing && Math.abs(this.speed) > 3;
      const wantRag =
        this.ragActive && (!this.grounded || slopeTumble || this.ragAngVel.lengthSq() > 6);
      this.ragBlend += ((wantRag ? 1 : 0) - this.ragBlend) * Math.min(1, (wantRag ? 14 : 7) * dt);
      if (this.bailRecoveryPose > 0) {
        const releaseU = THREE.MathUtils.clamp(this.bailRecoveryPose / 0.48, 0, 1);
        const release = releaseU * releaseU * (3 - 2 * releaseU);
        this.ragBlend = Math.min(this.ragBlend, 1 - release);
      }
      if (this.grounded && !slopeTumble) {
        // down and sliding: the spin dies fast, the sprawl takes over
        this.ragAngVel.multiplyScalar(Math.exp(-7 * dt));
      }
      if (slopeTumble) {
        // TUMBLING DOWN A SLOPE: the body log-rolls head-over-heels down the
        // fall line at slide speed, with a dusty thud every half turn.
        this.ragAngVel.x +=
          (Math.abs(this.speed) * 1.15 * TUNING.ragSpin - this.ragAngVel.x) * Math.min(1, 6 * dt);
        this.ragRollAcc += Math.abs(this.ragAngVel.x) * dt;
        if (this.ragRollAcc > Math.PI) {
          this.ragRollAcc -= Math.PI;
          sfx.play('crunch', 0.3, 1.25 + Math.random() * 0.3);
          this.emitDust(2);
        }
      }
      const dirS = Math.sign(this.speed || 1);
      Player.RAG_AXIS.set(this.axisL.x * dirS, 0, this.axisL.z * dirS);
      this.ragQ.premultiply(Player.RAG_DQ.setFromAxisAngle(Player.RAG_AXIS, this.ragAngVel.x * dt));
      Player.RAG_AXIS.set(0, 1, 0);
      this.ragQ.premultiply(Player.RAG_DQ.setFromAxisAngle(Player.RAG_AXIS, this.ragAngVel.y * dt));
      Player.RAG_AXIS.set(this.axisF.x * dirS, 0, this.axisF.z * dirS);
      this.ragQ.premultiply(Player.RAG_DQ.setFromAxisAngle(Player.RAG_AXIS, this.ragAngVel.z * dt));
      if (this.ragBlend > 0.001 && this.bodyGroup.parent) {
        this.bodyGroup.parent.getWorldQuaternion(Player.RAG_QP);
        Player.RAG_QT.copy(Player.RAG_QP.invert()).multiply(this.ragQ);
        this.bodyGroup.quaternion.slerp(Player.RAG_QT, this.ragBlend);
        // The tumble wheels about the WAIST, not the rig origin at the feet —
        // same counter-translate as the somersault, generalized to the full
        // quaternion: keep the waist point pinned while the body turns.
        const waistH = this.characterWaistHeight(0.95);
        Player.RAG_AXIS.set(0, waistH, 0).applyQuaternion(this.bodyGroup.quaternion);
        this.bodyGroup.position.x += (0 - Player.RAG_AXIS.x) * this.ragBlend;
        this.bodyGroup.position.y += (waistH - Player.RAG_AXIS.y) * this.ragBlend;
        this.bodyGroup.position.z += (0 - Player.RAG_AXIS.z) * this.ragBlend;
        if (this.ragPoseAnchorW > 0.001) {
          // A collapsing support can interrupt the forward roll halfway
          // through. Its rider root is offset by more than a metre at some
          // samples, so preserving quaternion alone still teleports the body.
          // Pin the same waist point in parent space on the first rag frame,
          // then quickly release it back to the ordinary ballistic pivot.
          Player.RAG_PIVOT_BASE
            .set(0, this.characterWaistHeight(0.82), 0)
            .multiply(this.bodyGroup.scale)
            .applyQuaternion(this.bodyGroup.quaternion);
          const anchorW = this.ragPoseAnchorW;
          this.bodyGroup.position.x = THREE.MathUtils.lerp(
            this.bodyGroup.position.x,
            this.ragPoseAnchor.x - Player.RAG_PIVOT_BASE.x,
            anchorW,
          );
          this.bodyGroup.position.y = THREE.MathUtils.lerp(
            this.bodyGroup.position.y,
            this.ragPoseAnchor.y - Player.RAG_PIVOT_BASE.y,
            anchorW,
          );
          this.bodyGroup.position.z = THREE.MathUtils.lerp(
            this.bodyGroup.position.z,
            this.ragPoseAnchor.z - Player.RAG_PIVOT_BASE.z,
            anchorW,
          );
          this.ragPoseAnchorW *= Math.exp(-8 * dt);
        }
      }
      // LIMB FLAIL: arms windmill, legs kick, the head whips — sinusoids on
      // per-wipeout random phases, amplitude riding how fast the body is
      // actually spinning, dying off as the sprawl takes over. ADDED after
      // every authored joint write, so it layers on whatever pose is fading.
      if (this.ragBlend > 0.02 && TUNING.ragFlail > 0) {
        const kick = THREE.MathUtils.clamp(this.ragFlailKickT / 0.28, 0, 1);
        const f =
          TUNING.ragFlail * this.ragBlend *
          (0.35 + Math.min(1, this.ragAngVel.length() * 0.12)) *
          (1 + kick * 1.35);
        const t = this.runTime;
        const wA = 11 + 3 * Math.sin(this.ragSeedA);
        const wB = 13 + 4 * Math.sin(this.ragSeedB);
        if (this.armR) {
          this.armR.rotation.x += Math.sin(t * wA + this.ragSeedA) * 1.7 * f;
          this.armR.rotation.z += Math.cos(t * wB + this.ragSeedB) * 0.9 * f;
        }
        if (this.armL) {
          this.armL.rotation.x += Math.sin(t * wB + this.ragSeedB + 2.1) * 1.7 * f;
          this.armL.rotation.z -= Math.cos(t * wA + this.ragSeedA + 1.3) * 0.9 * f;
        }
        if (this.legR) this.legR.rotation.x += Math.sin(t * wA * 0.8 + this.ragSeedB) * 1.1 * f;
        if (this.legL) this.legL.rotation.x += Math.sin(t * wB * 0.8 + this.ragSeedA + 1.7) * 1.1 * f;
        if (this.headM) this.headM.rotation.x += Math.sin(t * wA + 0.6) * 0.35 * f;
        this.bodyGroup.rotation.x += Math.sin(t * 24 + this.ragSeedA) * 0.22 * kick;
      }
    }

    // A failed input must still LOOK like a failed input. Once a slow body has
    // settled, ragBlend can be zero and the airborne flail layer above is no
    // longer visible; give the short attempt clock its own grounded fish-arch
    // so X never appears completely ignored even when it loses the dice roll.
    if (
      this.ragActive &&
      this.bailRecoverT < 0 &&
      this.ragFlailKickT > 0 &&
      this.ragBlend <= 0.02 &&
      TUNING.ragFlail > 0
    ) {
      const kick = THREE.MathUtils.clamp(this.ragFlailKickT / 0.28, 0, 1) *
        Math.min(2, TUNING.ragFlail);
      const wave = Math.sin(this.runTime * 28 + this.ragSeedA);
      this.bodyGroup.rotation.x += wave * 0.28 * kick;
      if (this.armR) this.armR.rotation.x += wave * 0.85 * kick;
      if (this.armL) this.armL.rotation.x -= wave * 0.85 * kick;
      if (this.legR) this.legR.rotation.x -= wave * 0.55 * kick;
      if (this.legL) this.legL.rotation.x += wave * 0.55 * kick;
    }

    // FORWARD ROLL TO RUN. The airborne ragdoll stays on bodyGroup; supported
    // recovery moves to the rider-only root so its pitch can pivot about the
    // waist without dragging the board or hinging the whole character at the
    // feet. The absolute pitch begins at the same 1.45-radian sprawl and ends
    // at exactly 2π, so the final third is already a normal running stride and
    // the next frame's identity transform is visually identical.
    const recover = this.bailRecoveryPose;
    const rider = this.riderG;
    if (recover > 0 && rider) {
      const recovery = sampleBailRecovery(recover);
      const side = this.bailRecoverSide;
      const handoff = 1 - THREE.MathUtils.clamp(this.ragBlend, 0, 1);
      rider.rotation.set(
        recovery.forwardRoll * handoff,
        side * 0.08 * recovery.shoulder * handoff,
        side * 0.12 * recovery.shoulder * handoff,
      );
      // Counter-translate the rotated rider around a waist point. Subtract the
      // starting-sprawl correction while the revolution enters, so p=0 is at
      // the exact old ground pose instead of teleporting a waist-height up;
      // both corrections become zero again at the completed 2π. Position was
      // reset by plantOnDeck, so no fixed-step offset can accumulate.
      const waistH = this.characterWaistHeight(0.82);
      Player.RAG_AXIS.set(0, waistH, 0).applyQuaternion(rider.quaternion);
      Player.RAG_PIVOT_BASE.set(0, waistH, 0).applyQuaternion(
        Player.RAG_QP.setFromAxisAngle(
          BAIL_PITCH_AXIS,
          BAIL_RECOVERY_SPRAWL_PITCH * handoff,
        ),
      );
      const keepStart = 1 - recovery.roll;
      rider.position.x +=
        -Player.RAG_AXIS.x + Player.RAG_PIVOT_BASE.x * keepStart;
      rider.position.y +=
        waistH - Player.RAG_AXIS.y -
        (waistH - Player.RAG_PIVOT_BASE.y) * keepStart -
        0.1 * keepStart * handoff +
        0.06 * recovery.tuck * handoff;
      rider.position.z +=
        -Player.RAG_AXIS.z + Player.RAG_PIVOT_BASE.z * keepStart;
      if (this.legR && this.legL) {
        const plantR = side > 0;
        this.legR.rotation.x +=
          1.05 * recovery.tuck +
          (plantR ? -0.34 : 0.5) * recovery.plant -
          0.36 * recovery.stride;
        this.legL.rotation.x +=
          1.05 * recovery.tuck +
          (plantR ? 0.5 : -0.34) * recovery.plant +
          0.36 * recovery.stride;
        this.legR.rotation.z -= side * 0.12 * recovery.shoulder;
        this.legL.rotation.z -= side * 0.12 * recovery.shoulder;
      }
      if (this.kneeR && this.kneeL) {
        const plantR = side > 0;
        this.kneeR.rotation.x +=
          1.45 * recovery.tuck + (plantR ? 1.3 : 0.68) * recovery.plant;
        this.kneeL.rotation.x +=
          1.45 * recovery.tuck + (plantR ? 0.68 : 1.3) * recovery.plant;
      }
      const plantArm = side > 0 ? this.armR : this.armL;
      const freeArm = side > 0 ? this.armL : this.armR;
      if (plantArm) {
        plantArm.rotation.x -= 1.05 * recovery.plant;
        plantArm.rotation.z += side * 0.42 * recovery.plant;
      }
      if (freeArm) freeArm.rotation.x += 0.72 * recovery.stride;
      const plantElbow = side > 0 ? this.elbowR : this.elbowL;
      if (plantElbow) plantElbow.rotation.x -= 0.78 * recovery.plant;
      const plantWrist = side > 0 ? this.wristR : this.wristL;
      if (plantWrist) plantWrist.rotation.x += 0.38 * recovery.plant;
      if (this.headM)
        this.headM.rotation.x -=
          0.46 * recovery.tuck + 0.24 * recovery.plant;
    }

    // A bail stays visible so the tumble reads; a plain death blinks out.
    this.group.visible = (this.state !== 'dead' && this.state !== 'gameover') || this.bailing;

    // Authored clips are the final pose layer. The bridge snapshots this
    // complete legacy result first and restores it before the next fixed step,
    // so authored writes are absolute and can never accumulate into gameplay.
    this.playerAnimationBridge.applyOverlay(dt);
    this.syncCharacterAppearance();
    // Character Lab proportions and authored animation both move endpoints.
    // Plant only after both layers so feet cannot slide away from the deck.
    this.plantOnDeck(underW);

  }

  private tailBodies_(): TailCollider[] {
    const rider = this.riderG;
    if (!rider) return this.tailBodies;
    if (this.tailBodies.length === 0)
      for (let i = 0; i < 4; i++) this.tailBodies.push({ c: new THREE.Vector3(), r: 0 });
    rider.updateWorldMatrix(true, false);
    const scaleX = TAIL_V.setFromMatrixColumn(rider.matrixWorld, 0).length() || 1;
    const scaleZ = TAIL_V.setFromMatrixColumn(rider.matrixWorld, 2).length() || 1;
    const shape = characterProportionSettings.value;
    const scale = Math.max(scaleX, scaleZ) * Math.max(shape.torsoWidth, shape.torsoDepth);
    const hipsY = this.legs?.position.y ?? 0.7;
    const bellyY = hipsY + 0.25 * shape.torsoLength;
    // These stay MODEST — they only have to cover what can actually get in the
    // tail's way. Which JOINTS each one acts on is worked out by the tail
    // itself from its own rest pose (see firstOutside), so moving the tail
    // cannot silently put a sphere on top of its root and ask the solver for a
    // configuration that does not exist.
    this.tailBodies[0].c.set(0, hipsY, -0.02).applyMatrix4(rider.matrixWorld);
    this.tailBodies[0].r = 0.17 * scale; // hips
    this.tailBodies[1].c.set(0, bellyY, 0).applyMatrix4(rider.matrixWorld);
    this.tailBodies[1].r = 0.2 * scale; // belly
    // thighs: from the real leg groups, so a crouch or a crawl moves them.
    // Sampled well DOWN the thigh, clear of the hip socket the tail leaves from.
    const legs: (THREE.Object3D | null)[] = [this.legR, this.legL];
    for (let i = 0; i < 2; i++) {
      const leg = legs[i];
      const b = this.tailBodies[2 + i];
      if (leg) {
        leg.updateWorldMatrix(true, false);
        b.c.set(0, -0.17, 0).applyMatrix4(leg.matrixWorld);
      } else {
        b.c.set(i === 0 ? 0.115 : -0.115, 0.53, 0).applyMatrix4(rider.matrixWorld);
      }
      b.r = 0.1 * scale;
    }
    return this.tailBodies;
  }


  // ——— Aku mask reward (models/skull.glb) ———————————————————————————————
  // The floating mask you carry after smashing a mask crate is a sculpted
  // spiked skull. Loaded once, its geometry is re-centered on its own bbox
  // center and baked to size, so the maskMesh's frame-driven scale/rotation
  // still work and rotation.y is a true spin-in-place (correct central axis).
  private installSkullMask(): void {
    const src =
      (window as { __SKULL_GLB?: string }).__SKULL_GLB ||
      import.meta.env.BASE_URL + 'models/skull.glb';
    new GLTFLoader().load(
      src,
      (gltf) => {
        if (!this.maskMesh) return;
        let source: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh;
        });
        if (!source) return;
        const src = source as THREE.Mesh;
        // Re-center on the bbox center and bake a fit-scale into the geometry so
        // the tallest dimension spans ~0.9 units (about the old box's reach).
        const geo = (src.geometry as THREE.BufferGeometry).clone();
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        geo.translate(
          -(bb.min.x + bb.max.x) / 2,
          -(bb.min.y + bb.max.y) / 2,
          -(bb.min.z + bb.max.z) / 2,
        );
        const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
        const k = span > 0 ? 0.9 / span : 1;
        geo.scale(k, k, k);
        // Swap the box face + eyes for the skull (keep the crossbones child).
        for (const c of [...this.maskMesh.children]) {
          if (c.userData.maskBones) continue;
          this.maskMesh.remove(c);
        }
        (this.maskMesh.geometry as THREE.BufferGeometry).dispose();
        this.maskMesh.geometry = geo;
        // A floating magical mask should read like the bright, evenly-lit
        // reference render regardless of which way it has spun into the scene
        // light. Plain Lambert goes muddy on its shadowed side, so light it
        // partly from itself: the same texture as an emissive map keeps the
        // cream bone bright and consistent while direct light still adds form.
        const tex = (src.material as THREE.MeshStandardMaterial).map ?? null;
        this.maskMesh.material = new THREE.MeshLambertMaterial({
          map: tex,
          emissive: 0xffffff,
          emissiveMap: tex,
          emissiveIntensity: 0.6,
          side: THREE.DoubleSide,
        });
        // Black stroke around the skull: an inverted-hull outline — the same
        // geometry, a hair larger, rendered back-faces-only in flat black, so a
        // crisp black rim shows around the silhouette (and through the eyes).
        const outline = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }),
        );
        outline.scale.setScalar(1.05);
        outline.raycast = () => {};
        this.maskMesh.add(outline);
      },
      undefined,
      (e) => console.warn('skull mask failed to load (mask stays a box):', e),
    );
  }

  // ——— Crossbones under the 2nd mask (models/crossbones.glb) ————————————————
  // A sculpted bone X that hangs beneath the skull to make the classic
  // skull-and-crossbones — shown ONLY on the 2nd held mask (state 2). It rides
  // the mask as a child, so it shares the mask's stroke+glow treatment: its own
  // inverted-hull black outline, sitting inside the mask's pink aura.
  private installMaskBones(): void {
    const src =
      (window as { __BONES_GLB?: string }).__BONES_GLB ||
      import.meta.env.BASE_URL + 'models/crossbones.glb';
    new GLTFLoader().load(
      src,
      (gltf) => {
        if (!this.maskMesh) return;
        let found: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
        });
        if (!found) return;
        const m = found as THREE.Mesh;
        // Re-center on the bbox and bake a fit-scale (span ~0.9, matching the skull).
        const geo = (m.geometry as THREE.BufferGeometry).clone();
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        geo.translate(
          -(bb.min.x + bb.max.x) / 2,
          -(bb.min.y + bb.max.y) / 2,
          -(bb.min.z + bb.max.z) / 2,
        );
        const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
        const k = span > 0 ? 0.92 / span : 1;
        geo.scale(k, k, k);
        const tex = (m.material as THREE.MeshStandardMaterial).map ?? null;
        const bones = new THREE.Mesh(
          geo,
          new THREE.MeshLambertMaterial({
            map: tex,
            emissive: 0xffffff,
            emissiveMap: tex,
            emissiveIntensity: 0.6,
            side: THREE.DoubleSide,
          }),
        );
        const outline = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide }),
        );
        outline.scale.setScalar(1.05);
        outline.raycast = () => {};
        bones.add(outline);
        bones.raycast = () => {};
        bones.userData.maskBones = true; // installSkullMask preserves this child
        bones.position.set(0, -0.52, -0.02); // hang beneath the skull's jaw
        bones.visible = false; // only the 2nd mask shows it (toggled in syncVisual)
        this.maskBones = bones;
        this.maskMesh.add(bones);
      },
      undefined,
      (e) => console.warn('crossbones failed to load (2nd mask stays skull-only):', e),
    );
  }

  // ——— Unity production spin presentation ———————————————————————————————
  private installSpinEffects(): void {
    if (!this.boardG) return;
    this.spinEffects = new SpinEffectsPresentation({
      parent: this.group,
    });
  }

  private buildVisual(): THREE.Group {
    const g = new THREE.Group();
    g.name = 'player-visual';

    // Production Unity Surf Cruiser, presentation only. Its exact 3,148-vertex
    // seven-material deck, orange-sun art, imported truck and procedural
    // wheels replace the old box/cylinder cosmetic without touching movement.
    const boardG = createSkateboardPresentation(skateboardSettings.value);
    // bodyGroup is deliberately stretched for the rider. Cancel that scale on
    // the skateboard so Unity's authored metre dimensions survive in world.
    boardG.scale.set(1 / 1.18, 1 / 1.36, 1 / 1.18);
    boardG.userData.preserveResourcesOnRebuild = true;
    g.add(boardG);
    this.boardG = boardG;
    skateboardSettings.subscribe((value) => {
      rebuildSkateboardPresentation(boardG, value);
    });

    // The rider rides in her own group (see riderG): the board is pinned to
    // the physics point, and SHE gets to move relative to it.
    const riderG = new THREE.Group();
    riderG.name = 'procedural-rider';
    g.add(riderG);
    this.riderG = riderG;

    // ——— The rider: a Crash-era kangaroo girl on a conventional humanoid rig.
    // Hip pivots sit at ±0.115 under hips@0.71, with pelvis-rooted spine,
    // clavicle/arm chains, neck/head, foot/toe chains, and stable sockets.
    // Flat-shaded solid materials
    // give the PS2 facet look; canvases only where cloth needs a print.
    const flat = (color: number): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({ color, flatShading: true });
    const INK = new THREE.MeshLambertMaterial({ color: 0x17181c }); // glove stitches
    const BONE_CLAY = new THREE.MeshPhysicalMaterial({
      name: 'character-bone-clay',
      color: 0xe8dcc7,
      roughness: 0.7,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.75,
      // The Meshy sources carry face normals. GPU derivative normals follow
      // the shaft-thickness morph without stale highlights.
      flatShading: true,
    });

    // Legs: hip, knee, and ankle pivots. The foot is a rigid child of the
    // ankle, so future clips can plant and roll it without breaking the shin.
    const legs = new THREE.Bone();
    legs.name = 'hips';
    legs.position.y = 0.71; // hip line
    for (const side of [-1, 1]) {
      // Rider-local forward is +Z, so +X is her anatomical left. The outer
      // Player group turns the finished rig toward world -Z at spawn.
      const anatomicalSide = side === 1 ? 'left' : 'right';
      const leg = new THREE.Bone(); // upper-leg bone — syncVisual writes rot + pos
      leg.name = `hip-${anatomicalSide}`;
      leg.userData.anatomicalSide = anatomicalSide;
      leg.position.x = side * 0.115;
      legs.add(leg);
      const upperLegBone = createStretchableBone({
        id: `upper-leg-${anatomicalSide}`,
        length: PROCEDURAL_THIGH_LENGTH,
        knobRadius: 0.057,
        knobTwist: side * 0.06,
        material: BONE_CLAY,
        surface: 'ivory-rattle',
        mirrorX: anatomicalSide === 'right',
      });
      leg.add(upperLegBone.root);
      this.stretchableBones.push(upperLegBone);
      // Knee group pivots where the thigh ends; the lower leg keeps its full
      // length through every pose and swings conventionally from this hinge.
      const knee = new THREE.Bone();
      knee.name = `knee-${anatomicalSide}`;
      knee.userData.anatomicalSide = anatomicalSide;
      knee.position.y = -PROCEDURAL_THIGH_LENGTH;
      leg.add(knee);
      const lowerLegBone = createStretchableBone({
        id: `lower-leg-${anatomicalSide}`,
        length: PROCEDURAL_SHIN_LENGTH,
        knobRadius: 0.052,
        knobTwist: -side * 0.04,
        material: BONE_CLAY,
        surface: 'ivory-rattle',
        mirrorX: anatomicalSide === 'right',
      });
      knee.add(lowerLegBone.root);
      this.stretchableBones.push(lowerLegBone);
      // Ankle at the shoe collar. The contact children retain their original
      // authored coordinates, so replacing the visible footwear cannot move
      // the sole plane or its heel/foot/toe animation targets.
      const ankle = new THREE.Bone();
      ankle.name = `ankle-${anatomicalSide}`;
      ankle.userData.anatomicalSide = anatomicalSide;
      ankle.position.y = -PROCEDURAL_SHIN_LENGTH;
      knee.add(ankle);
      const footSocket = new THREE.Object3D();
      footSocket.name = `socket-foot-${anatomicalSide}`;
      footSocket.position.set(0, -0.05, 0.065); // centre of the sole's contact plane
      footSocket.userData.contactNormal = [0, 1, 0];
      ankle.add(footSocket);
      const heelSocket = new THREE.Object3D();
      heelSocket.name = `socket-heel-${anatomicalSide}`;
      heelSocket.position.set(0, -0.05, -0.07);
      heelSocket.userData.contactNormal = [0, 1, 0];
      ankle.add(heelSocket);
      // A real toe bone finishes the conventional leg chain. The rigid shoe
      // remains on the foot/ankle bone, so adding articulation is silhouette
      // neutral until a clip deliberately rolls the toes.
      const toe = new THREE.Bone();
      toe.name = `toe-${anatomicalSide}`;
      toe.userData.anatomicalSide = anatomicalSide;
      toe.position.set(0, -0.05, 0.16);
      ankle.add(toe);
      const toeSocket = new THREE.Object3D();
      toeSocket.name = `socket-toe-${anatomicalSide}`;
      toeSocket.position.set(0, 0, 0.04);
      toeSocket.userData.contactNormal = [0, 1, 0];
      toe.add(toeSocket);
      if (side === 1) {
        this.legR = leg;
        this.kneeR = knee;
        this.ankleR = ankle;
        this.toeR = toe;
      } else {
        this.legL = leg;
        this.kneeL = knee;
        this.ankleL = ankle;
        this.toeL = toe;
      }
    }
    riderG.add(legs);
    this.legs = legs;
    for (const side of ['left', 'right'] as const) {
      const knee = legs.getObjectByName(`knee-${side}`);
      const ankle = legs.getObjectByName(`ankle-${side}`);
      if (!(knee instanceof THREE.Bone) || !(ankle instanceof THREE.Bone)) {
        throw new Error(`procedural character requires ${side} knee and ankle bones`);
      }
      this.meshyFootwear.push(createMeshyFootwear({
        mount: riderG,
        knee,
        ankle,
        side,
      }));
    }
    const shortsHipLeft = legs.getObjectByName('hip-left');
    const shortsHipRight = legs.getObjectByName('hip-right');
    if (!(shortsHipLeft instanceof THREE.Bone) || !(shortsHipRight instanceof THREE.Bone)) {
      throw new Error('procedural character requires both upper-leg bones');
    }
    this.meshyShorts = createMeshyShorts({
      mount: riderG,
      hips: legs,
      hipLeft: shortsHipLeft,
      hipRight: shortsHipRight,
    });

    // Tail: the kangaroo signature. ONE skinned tube on a simulated chain
    // (src/tail.ts) — it chases the pose the animation asks for, but arrives
    // late, under gravity, and stops short of her own body. Parented to the
    // pelvis bone (NOT either upper leg) so leg articulation never drags it.
    const tail = new Tail();
    tail.root.name = 'tail-root';
    // Attach point placed by hand in the studio. It sits FORWARD of the hip
    // pivot, inside her rather than off her back. With bury at 0 this point is
    // where the tube actually starts, so it has to be under the skin on its
    // own — which it is, and the neck pinch (see restRadius) makes the opening
    // small enough that nothing shows through from any angle.
    // Rebased from rider-local y=0.65 after moving the branch under hips@0.71.
    tail.root.position.set(0, -0.06, 0.075);
    legs.add(tail.root);
    this.tail = tail;

    // The conventional torso starts at the pelvis. Child offsets are rebased
    // from the old rider-space positions, so the neutral rendered silhouette
    // is unchanged while bends now pivot from an anatomical waist.
    const upper = new THREE.Bone();
    upper.name = 'torso-root';
    upper.position.y = 0;
    const spine = new THREE.Bone();
    spine.name = 'spine';
    spine.position.y = PROCEDURAL_SPINE_Y - legs.position.y;
    upper.add(spine);
    const CHEST_Y = 1.06;
    const NECK_Y = 1.325;
    const CLAVICLE_Y = 1.22;
    const chest = new THREE.Bone();
    chest.name = 'chest';
    chest.position.y = CHEST_Y - PROCEDURAL_SPINE_Y;
    spine.add(chest);
    const neck = new THREE.Bone();
    neck.name = 'neck';
    neck.position.y = NECK_Y - CHEST_Y;
    chest.add(neck);

    // The semantic head pivot remains conventional and owns all authored
    // look/impact motion. The imported surface is rebased with its lowest
    // point at this pivot, so the local head offset is a literal air gap.
    const head = new THREE.Bone();
    head.name = 'head';
    head.position.y = MESHY_HEAD_DEFAULT_GAP;
    neck.add(head);
    this.headM = head;
    const lookSocket = new THREE.Object3D();
    lookSocket.name = 'socket-look';
    lookSocket.position.set(0, MESHY_HEAD_EYE_CENTER_Y, 0.19);
    lookSocket.userData.forward = [0, 0, 1];
    head.add(lookSocket);
    this.headLookSocket = lookSocket;
    const visualCenter = new THREE.Object3D();
    visualCenter.name = 'socket-head-visual-center';
    visualCenter.position.y = MESHY_HEAD_VISUAL_CENTER_Y;
    head.add(visualCenter);
    this.headVisualCenter = visualCenter;
    this.meshyHead = createMeshyHead();
    head.add(this.meshyHead.mesh);

    // Retain empty auxiliary nodes so saved clips and procedural driver IDs
    // remain migratable even though the monolithic skull owns the silhouette.
    for (const e of [-1, 1]) {
      const anatomicalSide = e === 1 ? 'left' : 'right';
      const ear = new THREE.Group();
      ear.name = `ear-${anatomicalSide}`;
      ear.position.set(e * 0.095, 0.135, -0.02);
      ear.rotation.set(-0.15, 0, -e * 0.42);
      head.add(ear);
    }
    const ponyA = new THREE.Group();
    ponyA.name = 'ponytail-base';
    ponyA.position.set(0, 0.175, -0.145);
    ponyA.rotation.x = 1.2;
    head.add(ponyA);
    const ponyB = new THREE.Group();
    ponyB.name = 'ponytail-tip';
    ponyB.position.y = -0.21;
    ponyB.rotation.x = 0.5;
    ponyA.add(ponyB);
    this.ponyA = ponyA;
    this.ponyB = ponyB;

    // Arms: clavicle → upper arm → lower arm → hand, with a named grip socket
    // below each hand. The arm geometry still hangs down in the bind pose; a
    // separate canonical T-pose is published below for retargeting.
    const GLOVE_WHITE = flat(0xeee8dc);
    for (const side of [-1, 1]) {
      // Rider-local forward is +Z, so +X is her anatomical left. The outer
      // Player group turns the finished rig toward world -Z at spawn.
      const anatomicalSide = side === 1 ? 'left' : 'right';
      const clavicle = new THREE.Bone();
      clavicle.name = `clavicle-${anatomicalSide}`;
      clavicle.userData.anatomicalSide = anatomicalSide;
      clavicle.position.set(side * 0.1, CLAVICLE_Y - CHEST_Y, 0);
      chest.add(clavicle);
      const arm = new THREE.Bone();
      arm.name = `shoulder-${anatomicalSide}`;
      arm.userData.anatomicalSide = anatomicalSide;
      arm.position.set(side * 0.2, 0, 0); // world rest remains (±0.3, 1.22, 0)
      clavicle.add(arm);
      const elbowJoint = new THREE.Bone();
      elbowJoint.name = `elbow-${anatomicalSide}`;
      elbowJoint.userData.anatomicalSide = anatomicalSide;
      elbowJoint.position.y = -0.22;
      arm.add(elbowJoint);
      const upperArmBone = createStretchableBone({
        id: `upper-arm-${anatomicalSide}`,
        length: 0.22,
        knobRadius: 0.043,
        knobTwist: side * 0.08,
        material: BONE_CLAY,
        surface: 'ivory-bone',
        mirrorX: anatomicalSide === 'right',
      });
      arm.add(upperArmBone.root);
      this.stretchableBones.push(upperArmBone);
      const wrist = new THREE.Bone();
      wrist.name = `wrist-${anatomicalSide}`;
      wrist.userData.anatomicalSide = anatomicalSide;
      wrist.position.y = -0.195;
      elbowJoint.add(wrist);
      const lowerArmBone = createStretchableBone({
        id: `lower-arm-${anatomicalSide}`,
        length: 0.195,
        knobRadius: 0.039,
        knobTwist: -side * 0.06,
        material: BONE_CLAY,
        surface: 'ivory-rattle',
        mirrorX: anatomicalSide === 'right',
      });
      elbowJoint.add(lowerArmBone.root);
      this.stretchableBones.push(lowerArmBone);
      const glove = createCartoonGlove(anatomicalSide, {
        glove: GLOVE_WHITE,
        stitch: INK,
      });
      // Persistent Character Lab wrist orientation lives on a non-bone mount.
      // Authored wrist tracks still own the conventional wrist bone, while
      // this presentation-only layer composes afterward and mirrors yaw/roll.
      const handRestOrientation = new THREE.Group();
      handRestOrientation.name = `hand-rest-orientation-${anatomicalSide}`;
      handRestOrientation.userData.anatomicalSide = anatomicalSide;
      // Palms face medially at rest while both thumbs point rider-forward.
      // Character Lab yaw/roll are offsets composed over this authored base.
      handRestOrientation.rotation.y = -side * Math.PI / 2;
      wrist.add(handRestOrientation);
      handRestOrientation.add(glove.root);
      if (side === 1) {
        this.armR = arm;
        this.elbowR = elbowJoint;
        this.wristR = wrist;
        this.gloveLeft = glove;
      } else {
        this.armL = arm;
        this.elbowL = elbowJoint;
        this.wristL = wrist;
        this.gloveRight = glove;
      }
    }
    const gloveRigs = [this.gloveLeft, this.gloveRight].filter(
      (glove): glove is CartoonGloveRig => glove !== null,
    );
    if (gloveRigs.length !== 2) throw new Error('procedural character requires two glove rigs');
    const gloveJointNames = Object.fromEntries(
      gloveRigs.flatMap((glove) =>
        Object.entries(glove.joints).map(([id, bone]) => [id, bone.name]),
      ),
    ) as Record<string, string>;
    const gloveSocketNames = Object.fromEntries(
      gloveRigs.flatMap((glove) => [
        [`fingerIndexTip${glove.side === 'left' ? 'Left' : 'Right'}`, glove.sockets.indexTip.name],
        [`fingerMiddleTip${glove.side === 'left' ? 'Left' : 'Right'}`, glove.sockets.middleTip.name],
        [`fingerOuterTip${glove.side === 'left' ? 'Left' : 'Right'}`, glove.sockets.outerTip.name],
        [`thumbTip${glove.side === 'left' ? 'Left' : 'Right'}`, glove.sockets.thumbTip.name],
      ]),
    ) as Record<string, string>;
    if (this.stretchableBones.length !== 8) {
      throw new Error(`procedural character requires 8 stretchable limb segments; resolved ${this.stretchableBones.length}`);
    }
    const stretchBoneIds = this.stretchableBones.map((component) => component.id);
    legs.add(upper);
    this.upperG = upper;
    this.spineG = spine;
    const clavicleLeft = chest.getObjectByName('clavicle-left');
    const clavicleRight = chest.getObjectByName('clavicle-right');
    if (!(clavicleLeft instanceof THREE.Bone) || !(clavicleRight instanceof THREE.Bone)) {
      throw new Error('procedural character requires both conventional clavicles');
    }
    this.meshyTorso = createMeshyTorso({
      mount: riderG,
      torsoRoot: upper,
      spine,
      chest,
      neck,
      clavicleLeft,
      clavicleRight,
    });

    // Serializable semantic lookup data: runtime code and future keyframe
    // tooling can resolve stable nodes with getObjectByName without keeping
    // circular Object3D references inside userData.
    const jointNames = {
      root: riderG.name,
      hips: legs.name,
      torsoRoot: upper.name,
      spine: spine.name,
      chest: chest.name,
      neck: neck.name,
      head: head.name,
      clavicleLeft: 'clavicle-left',
      shoulderLeft: 'shoulder-left',
      elbowLeft: 'elbow-left',
      wristLeft: 'wrist-left',
      clavicleRight: 'clavicle-right',
      shoulderRight: 'shoulder-right',
      elbowRight: 'elbow-right',
      wristRight: 'wrist-right',
      hipLeft: 'hip-left',
      kneeLeft: 'knee-left',
      ankleLeft: 'ankle-left',
      toeLeft: 'toe-left',
      hipRight: 'hip-right',
      kneeRight: 'knee-right',
      ankleRight: 'ankle-right',
      toeRight: 'toe-right',
      earLeft: 'ear-left',
      earRight: 'ear-right',
      ponytailBase: ponyA.name,
      ponytailTip: ponyB.name,
      tail: tail.root.name,
      ...gloveJointNames,
    } as const;
    const socketNames = {
      look: 'socket-look',
      headVisualCenter: 'socket-head-visual-center',
      gripLeft: 'socket-grip-left',
      gripRight: 'socket-grip-right',
      footLeft: 'socket-foot-left',
      heelLeft: 'socket-heel-left',
      toeLeft: 'socket-toe-left',
      footRight: 'socket-foot-right',
      heelRight: 'socket-heel-right',
      toeRight: 'socket-toe-right',
      boardLeft: 'socket-board-left',
      boardRight: 'socket-board-right',
      boardNose: 'socket-board-nose',
      boardTail: 'socket-board-tail',
      ...gloveSocketNames,
    } as const;
    const declaredNodeNames = [...Object.values(jointNames), ...Object.values(socketNames)];
    if (new Set(declaredNodeNames).size !== declaredNodeNames.length)
      throw new Error('procedural rig contains duplicate semantic node names');
    for (const name of Object.values(socketNames))
      if (!g.getObjectByName(name)) throw new Error(`procedural rig is missing socket: ${name}`);
    const restPose = Object.fromEntries(
      Object.entries(jointNames).map(([semantic, name]) => {
        const joint = g.getObjectByName(name);
        if (!joint) throw new Error(`procedural rig is missing joint: ${name}`);
        return [
          semantic,
          {
            position: joint.position.toArray(),
            quaternion: joint.quaternion.toArray(),
            scale: joint.scale.toArray(),
            rotationOrder: joint.rotation.order,
          },
        ];
      }),
    );
    type PublishedLocalTransform = {
      position: number[];
      quaternion: number[];
      scale: number[];
    };
    const bindPose: Record<string, PublishedLocalTransform> = Object.fromEntries(
      Object.entries(jointNames).map(([semantic, name]) => {
        const joint = g.getObjectByName(name)!;
        return [semantic, {
          position: joint.position.toArray(),
          quaternion: joint.quaternion.toArray(),
          scale: joint.scale.toArray(),
        }];
      }),
    );
    const retargetPose: Record<string, PublishedLocalTransform> = Object.fromEntries(
      Object.entries(bindPose).map(([semantic, transform]) => [semantic, {
        position: [...transform.position],
        quaternion: [...transform.quaternion],
        scale: [...transform.scale],
      }]),
    );
    // The rendered bind stance stays arms-down. Retargeting gets a canonical
    // T-pose without forcing the authored presentation to change its neutral
    // silhouette: +X is anatomical left in this rig.
    const SQRT_HALF = Math.SQRT1_2;
    retargetPose.shoulderLeft.quaternion = [0, 0, SQRT_HALF, SQRT_HALF];
    retargetPose.shoulderRight.quaternion = [0, 0, -SQRT_HALF, SQRT_HALF];

    const jointRoles: Record<string, string> = {
      root: 'root',
      hips: 'hips',
      torsoRoot: 'torsoRoot',
      spine: 'spine',
      chest: 'chest',
      neck: 'neck',
      head: 'head',
      clavicleLeft: 'clavicleLeft',
      shoulderLeft: 'upperArmLeft',
      elbowLeft: 'lowerArmLeft',
      wristLeft: 'handLeft',
      clavicleRight: 'clavicleRight',
      shoulderRight: 'upperArmRight',
      elbowRight: 'lowerArmRight',
      wristRight: 'handRight',
      hipLeft: 'upperLegLeft',
      kneeLeft: 'lowerLegLeft',
      ankleLeft: 'footLeft',
      toeLeft: 'toesLeft',
      hipRight: 'upperLegRight',
      kneeRight: 'lowerLegRight',
      ankleRight: 'footRight',
      toeRight: 'toesRight',
      earLeft: 'earLeft',
      earRight: 'earRight',
      ponytailBase: 'hairRoot',
      ponytailTip: 'hairTip',
      tail: 'tailRoot',
    };
    for (const id of Object.keys(gloveJointNames)) {
      jointRoles[id] = id;
    }
    const boneJointIds = new Set([
      'hips', 'torsoRoot', 'spine', 'chest', 'neck', 'head',
      'clavicleLeft', 'shoulderLeft', 'elbowLeft', 'wristLeft',
      'clavicleRight', 'shoulderRight', 'elbowRight', 'wristRight',
      'hipLeft', 'kneeLeft', 'ankleLeft', 'toeLeft',
      'hipRight', 'kneeRight', 'ankleRight', 'toeRight',
      ...Object.keys(gloveJointNames),
    ]);
    const jointTypes: Record<string, string> = Object.fromEntries(
      Object.keys(jointNames).map((id) => [
        id,
        id === 'root' ? 'motion-root' : boneJointIds.has(id) ? 'bone' : 'secondary',
      ]),
    );
    const jointAliases: Record<string, string[]> = {
      root: ['motionRoot', 'Root'],
      hips: ['pelvis', 'Hips', 'mixamorigHips'],
      torsoRoot: ['bodyRoot', 'waistControl'],
      spine: ['lowerSpine', 'Spine', 'mixamorigSpine'],
      chest: ['upperChest', 'Chest', 'Spine02', 'mixamorigSpine2'],
      neck: ['Neck', 'mixamorigNeck'],
      head: ['Head', 'mixamorigHead'],
      clavicleLeft: ['leftClavicle', 'LeftShoulder', 'mixamorigLeftShoulder'],
      shoulderLeft: ['upperArmLeft', 'leftUpperArm', 'LeftArm', 'mixamorigLeftArm'],
      elbowLeft: ['lowerArmLeft', 'leftLowerArm', 'LeftForeArm', 'mixamorigLeftForeArm'],
      wristLeft: ['handLeft', 'leftHand', 'LeftHand', 'mixamorigLeftHand'],
      clavicleRight: ['rightClavicle', 'RightShoulder', 'mixamorigRightShoulder'],
      shoulderRight: ['upperArmRight', 'rightUpperArm', 'RightArm', 'mixamorigRightArm'],
      elbowRight: ['lowerArmRight', 'rightLowerArm', 'RightForeArm', 'mixamorigRightForeArm'],
      wristRight: ['handRight', 'rightHand', 'RightHand', 'mixamorigRightHand'],
      hipLeft: ['upperLegLeft', 'leftUpperLeg', 'LeftUpLeg', 'mixamorigLeftUpLeg'],
      kneeLeft: ['lowerLegLeft', 'leftLowerLeg', 'LeftLeg', 'mixamorigLeftLeg'],
      ankleLeft: ['footLeft', 'leftFoot', 'LeftFoot', 'mixamorigLeftFoot'],
      toeLeft: ['toesLeft', 'leftToes', 'LeftToeBase', 'mixamorigLeftToeBase'],
      hipRight: ['upperLegRight', 'rightUpperLeg', 'RightUpLeg', 'mixamorigRightUpLeg'],
      kneeRight: ['lowerLegRight', 'rightLowerLeg', 'RightLeg', 'mixamorigRightLeg'],
      ankleRight: ['footRight', 'rightFoot', 'RightFoot', 'mixamorigRightFoot'],
      toeRight: ['toesRight', 'rightToes', 'RightToeBase', 'mixamorigRightToeBase'],
    };
    for (const id of Object.keys(gloveJointNames)) {
      jointAliases[id] = [gloveJointNames[id]];
    }
    const humanoidMap: Record<string, string> = {
      root: 'root',
      hips: 'hips',
      spine: 'spine',
      chest: 'chest',
      neck: 'neck',
      head: 'head',
      clavicleLeft: 'clavicleLeft',
      upperArmLeft: 'shoulderLeft',
      lowerArmLeft: 'elbowLeft',
      handLeft: 'wristLeft',
      upperLegLeft: 'hipLeft',
      lowerLegLeft: 'kneeLeft',
      footLeft: 'ankleLeft',
      toesLeft: 'toeLeft',
      clavicleRight: 'clavicleRight',
      upperArmRight: 'shoulderRight',
      lowerArmRight: 'elbowRight',
      handRight: 'wristRight',
      upperLegRight: 'hipRight',
      lowerLegRight: 'kneeRight',
      footRight: 'ankleRight',
      toesRight: 'toeRight',
    };
    g.userData.sculptRuntime = {
      schemaVersion: 3,
      kind: 'procedural-character',
      rigId: 'player-procedural-v1',
      rigName: 'Procedural Rider',
      actionRoot: g.name,
      coordinateSystem: {
        handedness: 'right',
        up: 'Y',
        localForward: '+Z',
        spawnWorldForward: '-Z',
        units: 'rig-units',
        worldUnitApproximation: 'metres',
        visualScale: [1.18, 1.36, 1.18],
      },
      sideConvention: 'anatomical left is +X in the rider-local +Z-forward frame',
      jointRoles,
      jointTypes,
      jointAliases,
      bindPose,
      retargetPose,
      humanoidMap,
      humanoid: {
        standard: 'conventional-humanoid',
        semanticMap: humanoidMap,
        roles: jointRoles,
        types: jointTypes,
        aliases: jointAliases,
        bindPose,
        canonicalTPose: retargetPose,
        retargetPose,
        boneIds: [...boneJointIds],
        boneNames: [...boneJointIds].map((id) => jointNames[id as keyof typeof jointNames]),
      },
      legRig: {
        solver: 'fixed-length-two-bone',
        thighLength: PROCEDURAL_THIGH_LENGTH,
        shinLength: PROCEDURAL_SHIN_LENGTH,
        ankleToSole: 0.05,
      },
      joints: jointNames,
      sockets: socketNames,
      mirrorPairs: [
        ['clavicleLeft', 'clavicleRight'],
        ['shoulderLeft', 'shoulderRight'],
        ['elbowLeft', 'elbowRight'],
        ['wristLeft', 'wristRight'],
        ['hipLeft', 'hipRight'],
        ['kneeLeft', 'kneeRight'],
        ['ankleLeft', 'ankleRight'],
        ['toeLeft', 'toeRight'],
        ['earLeft', 'earRight'],
        ['fingerIndexProximalLeft', 'fingerIndexProximalRight'],
        ['fingerIndexMiddleLeft', 'fingerIndexMiddleRight'],
        ['fingerIndexDistalLeft', 'fingerIndexDistalRight'],
        ['fingerMiddleProximalLeft', 'fingerMiddleProximalRight'],
        ['fingerMiddleMiddleLeft', 'fingerMiddleMiddleRight'],
        ['fingerMiddleDistalLeft', 'fingerMiddleDistalRight'],
        ['fingerOuterProximalLeft', 'fingerOuterProximalRight'],
        ['fingerOuterMiddleLeft', 'fingerOuterMiddleRight'],
        ['fingerOuterDistalLeft', 'fingerOuterDistalRight'],
        ['thumbMetacarpalLeft', 'thumbMetacarpalRight'],
        ['thumbProximalLeft', 'thumbProximalRight'],
        ['thumbDistalLeft', 'thumbDistalRight'],
      ],
      handRig: {
        kind: 'rigid-overlap-cartoon-glove',
        spec: 'docs/CARTOON_GLOVE_SCULPT_SPEC.json',
        nonThumbFingerCount: 3,
        boneCountPerHand: 12,
        poses: Object.keys(CARTOON_GLOVE_POSES),
        jointIds: Object.keys(gloveJointNames),
        socketIds: Object.keys(gloveSocketNames),
      },
      torsoSurface: {
        kind: 'meshy-skeleton-tank-top-torso',
        schemaVersion: 1,
        provenance: 'public/characters/meshy-torso/provenance.json',
        sourceSha256: this.meshyTorso.sourceSha256,
        triangles: this.meshyTorso.triangles,
        skinBones: this.meshyTorso.skeleton.bones.map((bone) => bone.name),
        lengthControl: 'deform.torso.length',
        proportions: ['torsoLength', 'torsoWidth', 'torsoDepth'],
        collisionChanged: false,
      },
      headSurface: {
        kind: 'meshy-crowned-inferno-skull-head',
        schemaVersion: 1,
        provenance: 'public/characters/meshy-head/provenance.json',
        sourceSha256: this.meshyHead.sourceSha256,
        triangles: this.meshyHead.triangles,
        attachmentJoint: 'head',
        neckGapControl: 'neckLength',
        collisionChanged: false,
      },
      shortsSurface: {
        kind: 'meshy-midnight-chain-denim-shorts',
        schemaVersion: 1,
        provenance: 'public/characters/meshy-shorts/provenance.json',
        sourceSha256: this.meshyShorts.sourceSha256,
        triangles: this.meshyShorts.triangles,
        skinBones: this.meshyShorts.skeleton.bones.map((bone) => bone.name),
        proportions: ['shortsWidth', 'shortsHeight', 'shortsDepth'],
        legThicknessLinked: false,
        collisionChanged: false,
      },
      footwearSurfaces: {
        kind: 'meshy-shoe-and-sock',
        schemaVersion: 1,
        provenance: 'public/characters/meshy-footwear/provenance.json',
        sourceSha256: this.meshyFootwear[0].sourceSha256,
        instances: this.meshyFootwear.length,
        triangles: this.meshyFootwear.reduce((sum, component) =>
          sum + component.triangles, 0),
        shoeAttachments: this.meshyFootwear.map((component) =>
          `ankle-${component.side}`),
        sockSkinBones: this.meshyFootwear.map((component) =>
          component.skeleton.bones.map((bone) => bone.name)),
        controls: ['footSize', 'legThickness'],
        footSocketsPreserved: true,
        collisionChanged: false,
      },
      limbBoneRig: {
        kind: 'stretchable-cartoon-limb-bone',
        schemaVersion: 2,
        spec: 'docs/STRETCH_BONE_SCULPT_SPEC.json',
        componentCount: this.stretchableBones.length,
        componentIds: stretchBoneIds,
        axis: [0, -1, 0],
        surfaces: {
          upperArms: 'ivory-bone',
          forearms: 'ivory-rattle',
          thighs: 'ivory-rattle',
          shins: 'ivory-rattle',
        },
        fixedParts: ['proximal-rigid-region', 'distal-rigid-region'],
        lengthMode: 'measured-piecewise-shaft',
        thicknessMode: 'boundary-tapered-shaft-morph',
        lengthControls: [
          'deform.arm.upper.left.length',
          'deform.arm.lower.left.length',
          'deform.arm.upper.right.length',
          'deform.arm.lower.right.length',
          'deform.leg.upper.left.length',
          'deform.leg.lower.left.length',
          'deform.leg.upper.right.length',
          'deform.leg.lower.right.length',
        ],
      },
      controls: {
        'deform.torso.length': {
          name: 'Torso Length', defaultValue: 1, min: 0.55, max: 1.5,
        },
        'deform.arm.upper.left.length': {
          name: 'Left Upper Arm Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.arm.lower.left.length': {
          name: 'Left Forearm Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.arm.upper.right.length': {
          name: 'Right Upper Arm Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.arm.lower.right.length': {
          name: 'Right Forearm Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.leg.upper.left.length': {
          name: 'Left Thigh Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.leg.lower.left.length': {
          name: 'Left Shin Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.leg.upper.right.length': {
          name: 'Right Thigh Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
        'deform.leg.lower.right.length': {
          name: 'Right Shin Length', defaultValue: 1, min: 0.55, max: 1.75,
        },
      },
      // Length controls never non-uniformly scale a joint. The bridge scales
      // only direct renderable children around the segment anchor and moves
      // the listed child joint(s) to the new endpoint. That keeps lower limbs,
      // the gameplay root, and the skateboard out of a parent's squash.
      deformations: [
        {
          controlId: 'deform.torso.length',
          jointId: 'spine',
          downstreamJointIds: ['chest'],
          lengthAxis: [0, 1, 0],
          min: 0.55,
          max: 1.5,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.torso.length',
          jointId: 'chest',
          downstreamJointIds: ['neck', 'clavicleLeft', 'clavicleRight'],
          lengthAxis: [0, 1, 0],
          min: 0.55,
          max: 1.5,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.arm.upper.left.length',
          jointId: 'shoulderLeft',
          downstreamJointIds: ['elbowLeft'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.arm.lower.left.length',
          jointId: 'elbowLeft',
          downstreamJointIds: ['wristLeft'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.arm.upper.right.length',
          jointId: 'shoulderRight',
          downstreamJointIds: ['elbowRight'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.arm.lower.right.length',
          jointId: 'elbowRight',
          downstreamJointIds: ['wristRight'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.leg.upper.left.length',
          jointId: 'hipLeft',
          downstreamJointIds: ['kneeLeft'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.leg.lower.left.length',
          jointId: 'kneeLeft',
          downstreamJointIds: ['ankleLeft'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.leg.upper.right.length',
          jointId: 'hipRight',
          downstreamJointIds: ['kneeRight'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
        {
          controlId: 'deform.leg.lower.right.length',
          jointId: 'kneeRight',
          downstreamJointIds: ['ankleRight'],
          lengthAxis: [0, -1, 0],
          min: 0.55,
          max: 1.75,
          volume: 'preserve-cross-section-area',
        },
      ],
      restPose,
    };

    return g;
  }
}
