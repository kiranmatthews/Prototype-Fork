// Authored fake-physics board movement. No rigidbody, no forces: just a
// heading, a scalar speed, a vertical velocity, and hand-tuned numbers from
// tuning.ts. Ground following is a single downward raycast; slopes only exist
// as fake boost/slowdown numbers derived from the surface normal.

import * as THREE from 'three';
import { TUNING, CONST } from './tuning';
import { HANG_ANIMS } from './hangAnims';
import { Input } from './input';
import { Crate, Level, RopeSwing } from './level';
import { sfx } from './audio';
import { Rail, RailSample, nearestRail } from './rails';
import { Halfpipe } from './halfpipe';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type MoveState = 'ride' | 'air' | 'grind' | 'hang' | 'rope' | 'dead' | 'gameover' | 'finished';

// Ledge grab geometry: how far below the TRUE lip the body hangs (hands at the
// lip, head just under it), and how long the catch takes to settle (a caught
// grip eases in — never a teleport).
const LEDGE_HANG_DEPTH = 1.25;
const LEDGE_EASE = 0.12;
const LEDGE_DOWN = new THREE.Vector3(0, -1, 0);
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

interface GroundHit {
  y: number;
  normal: THREE.Vector3;
  name: string;
  moverId?: number; // standing on a moving platform: ride along with it
  crumbleId?: number; // standing on a crumble pad: it starts breaking
  slippy?: boolean; // an icy/slick plank: friction cut so you skate on and can't stop short
  halfpipe?: Halfpipe; // the transition wall we're on (drives the pendulum + coping launch)
  pipeCross?: number; // analytic pipe hit: exact cross-axis coordinate of the surface point
}

const DOWN = new THREE.Vector3(0, -1, 0);

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
}

// scratch objects for the hang-time body tilt (no per-frame allocation)
const VERT_UP = new THREE.Vector3(0, 1, 0);
const VERT_Q = new THREE.Quaternion();
const VERT_Q2 = new THREE.Quaternion();

export class Player {
  pos = new THREE.Vector3(); // feet position
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
  points = 0; // banked score
  comboPoints = 0; // pending combo: sum of base values...
  comboMult = 0; // ...times the number of actions strung together
  comboLabels: string[] = []; // THPS-style trick names for the combo readout
  comboHasTrick = false; // a REAL trick (grab/grind/wallride/slide) is in the combo — gates the HUD plate; bare spins/bounces/enemy pops don't show it
  private comboTimer = 0; // plain-rolling time left before the combo banks
  onComboBank: (amount: number) => void = () => {}; // combo landed clean → cash-in ticker
  onComboBail: () => void = () => {}; // combo lost on a bail → red shake + drop

  // debug readouts
  railCandidateDist = Infinity;
  balance = 0; // THPS grind balance needle, -1..1

  // wired up by main.ts
  onDeath: () => void = () => {};
  onGameOver: () => void = () => {};
  onFinish: (time: number) => void = () => {};
  onRespawn: () => void = () => {};
  onCheckpoint: () => void = () => {};
  onRelic: (title: string, sub: string) => void = () => {};
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
  gemEarned = false; // ...and the all-boxes gem

  readonly group: THREE.Group;
  private bodyGroup: THREE.Group; // rotates for the spin/trick
  private shadow: THREE.Mesh;

  private spinTimer = 0;
  private spinCd = 0;
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
  private slideTimer = 0;
  private slideCd = 0;
  private slidePose = 0;
  private slideFromWalk = false; // slid off your feet: don't launch into skating
  private slideLandClamp = false; // walk-slide touchdown: cap the next measured planar too
  private slideVec = new THREE.Vector3(); // world-space slide direction (8-axis)
  private slideSpd = 0;
  private slideEndPending = false; // a slide is running; its end (scrub+recharge) not yet resolved
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
  private deckPose = 0; // 0..1: the deck is under the feet (rolling, skate airs, grinds) — legs shorten to stand ON it
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
  // Knocked down after a mask-less bail: flat on the ground, input dead,
  // back up in place when it runs out. Non-lethal — pits stay the killers.
  private bailDownT = 0;
  // Whether the current airtime started from SKATING (ollie, slide/grind
  // jump, vert launch, skate edge-fall). Grabs are board tricks: a standing
  // Crash hop never offers them (the slam stays available from any air).
  private airFromSkate = false;
  private grabSpinAngle = 0; // directional grab-spin; land off-axis = bail
  private spinAngle = 0; // spin-attack rotation (visual only)
  private visualYaw = 0; // Crash-style body facing vs. movement heading
  private flipTimer = 0; // front-flip on jump (visual only)
  private dirHoldT = 0; // seconds a direction has been held (roll-jump trigger)
  private airJumpUsed = false; // double jump: one extra pop per air
  private airTapT = 0; // double jump tap timer: armed on press, dies if held (that's a charge)
  private airborneT = 0; // seconds since leaving the ground — gates how LATE a double can fire
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
  // Momentum exits (grind jumps, slide jumps) keep their speed in the air:
  // footAir's direct-drive zeroing never applies until the next touchdown.
  private airMomentum = false;
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
  // --- LEDGE GRAB: hang off a lip you hit head-on; stepHang owns the state ---
  private ledgeT = 0; // grip time left before the hands give out
  private ledgeCoolT = 0; // re-grab lockout after a climb / hop / slip
  private ledgeEaseT = 0; // catch ease clock: pos glides from ledgeFrom to ledgeAnchor
  private readonly ledgeNormal = new THREE.Vector3(); // outward from the grabbed face
  private readonly ledgeAnchor = new THREE.Vector3(); // hang position (hands at the lip)
  private readonly ledgeFrom = new THREE.Vector3(); // where the catch started (ease origin)
  private ledgeLip = 0; // TRUE landing height (probed walk surface, not the collider top)
  private ledgeBox: THREE.Box3 | null = null; // the grabbed solid (climb clamps into its footprint)
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
  readonly alignNormal = new THREE.Vector3(0, 1, 0); // eased surface normal the rig lies on
  skateOn = false; // debug: the charge is currently driving the board
  lastJumpType = '—'; // debug: what the last X release produced
  private jumpBufferT = 0; // X released just before touchdown: jump on landing
  private jumpBufferCharge = 0;
  private jumpPressT = 0; // time left since the last fresh X press (perfect-bounce timing)
  private slideGraceT = 0; // window after a slide ends where a jump still slide-boosts
  private grindTime = 0; // how long this grind has lasted (balance ramps up)
  private balanceCritT = 0; // time spent pegged at the meter edge (bail grace)
  private snapOffset = new THREE.Vector3(); // entry offset, eased away on the rail
  private snapEase = 1; // 0 -> 1 over railSnapEase seconds after a grind starts
  private prevPos = new THREE.Vector3(); // for travel-direction facing
  private grindRail: Rail | null = null;
  private grindT = 0;
  private grindDir = 1;
  private grindVel = 0; // grind speed = your speed at entry, bleeding slowly
  private grindStyle: 'normal' | 'nose' | 'five0' | 'board' = 'normal'; // held dir at entry
  private grindPoseX = 0; // nose-up / nose-down grind lean
  private grindYawPose = 0; // boardslide: body across the rail
  private grindArmPose = 0; // arms out wide for balance on the rail
  private railUnder = false; // hanging BENEATH the rail (board crosswise in the hands)
  private underK = 0; // 0 = on top, 1 = hanging under; eases through the committed swing
  private underCoolT = 0; // switch cooldown: no rapid top/under spam
  private underProbeT = 0; // periodic clearance re-check while hanging (terrain rises -> pop back up)
  private boardSnapT = 0; // board snapped by an under-hang bail: hidden until this runs out
  private grindYawDir = 1;
  private grabSpinTotal = 0; // |rotation| racked up this air, for spin scoring
  private grabTrickName = 'Grab'; // variant name for the combo readout
  private grabTickT = 0; // THPS accrual while the grab is held
  private grindTickT = 0; // THPS accrual while grinding
  private regrindCd = 0;
  private respawnTimer = 0;
  private coyoteTimer = 0; // jump grace after running off a ledge
  private chargeTimer = 0; // X held on the ground: builds jump power + speed
  private charging = false;
  private chargePlanted = false; // charge began at a standstill: feet pinned
  private chargePose = 0;
  private invulnTimer = 0; // grace after a mask absorbs a hit
  private maskMesh: THREE.Mesh | null = null;
  private smearG: THREE.Group | null = null; // whirlwind stand-in shown while spinning
  private floorX!: THREE.Group; // landing X pinned to the floor under the skater
  private armR: THREE.Group | null = null; // shoulder pivots (fur arm + fishnet + glove inside)
  private armL: THREE.Group | null = null;
  private elbowR: THREE.Group | null = null; // forearm pivots inside each arm (authored model only)
  private elbowL: THREE.Group | null = null;
  private upperG: THREE.Group | null = null; // torso+head+arms: shoulder yaw
  private headM: THREE.Group | null = null; // head pivot: skull, muzzle, ears, hair, eyes
  private legs: THREE.Group | null = null;
  private legL: THREE.Group | null = null; // hip pivots (thigh + knee joint inside)
  private legR: THREE.Group | null = null;
  private kneeL: THREE.Group | null = null; // knee pivots (shin + shoe inside)
  private kneeR: THREE.Group | null = null;
  // Kangaroo appendages — jointed for follow-through animation.
  private tailRoot: THREE.Group | null = null;
  private tailChain: THREE.Group[] = []; // all tail joints root→tip (3 procedural, 5 authored)
  private ponyA: THREE.Group | null = null; // ponytail: scrunchie+puff, then the tip
  private ponyB: THREE.Group | null = null;
  private walkPhase = 0; // procedural run cycle
  private walkAmp = 0;
  private idleAmp = 0;
  private boardG: THREE.Group | null = null; // board + wheels: pulled up during grabs
  private teetering = false; // stopped on a ledge lip, Crash-style wobble
  private teeterPhase = 0;
  private teeterPose = 0;
  // Sine of the slope along travel (from the SMOOTHED ride plane):
  // > 0 climbing, < 0 descending. Bounded ±1 by construction, so vert walls
  // pull hard but never explode the way the old tan-based grade did.
  private lastTy = 0;
  // The ride plane: ground normal eased over time, so segmented transitions
  // read as one continuous curve instead of a stack of facets.
  private rideNormal = new THREE.Vector3(0, 1, 0);
  private shadowGroundY: number | null = null; // long-range floor probe for the blob shadow
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
  private walkRamp = 0; // regular-walk ease-in fraction (0->1 over walkRampTime while a direction is held; resets on stop / on the board)
  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private feetBox = new THREE.Box3(); // body box WITHOUT the grind reach-down (pit checks)
  private spinBox = new THREE.Box3();
  private enemyTouch = new THREE.Box3(); // scratch: shrunken enemy touch box
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; dust?: boolean }[] = [];
  private runStepSign = 1; // footfall edge detector for the run dust trail
  private jumpPose = 0; // on-foot jump: overhead arm throw + leg tuck (Crash reference)
  private fruits: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; flung?: boolean }[] = [];
  cam: THREE.PerspectiveCamera | null = null; // set by main: wumpa fly to the HUD counter, which lives on the lens

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.bodyGroup = this.buildVisual();
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
    this.installRoo(); // swap the placeholder body for the authored model when it lands
    this.installSmear(); // whirlwind smear model shown during the spin attack

    // Crash-reference shadow: a TIGHT dark ellipse under the feet (~0.75 of
    // a crate wide), not a faint pancake — it anchors the character hard.
    const shadowGeo = new THREE.CircleGeometry(0.42, 12);
    shadowGeo.scale(1, 0.85, 1); // slightly wider than deep once laid flat
    this.shadow = new THREE.Mesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    // Landing X: a small cross pinned to the floor under the skater — the
    // precise "you land HERE" mark the soft shadow blob can't give. Rides
    // the same floor probe as the shadow, growing a touch with height so it
    // stays readable from big airs.
    const xMat = new THREE.MeshBasicMaterial({
      color: 0xffe36e,
      transparent: true,
      opacity: 0.85,
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
    scene.add(xGroup);
    this.floorX = xGroup;

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

    // Chunky PS1 spark pool for grinds and grab-boost landings.
    const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffb545 }));
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }

    // Wumpa pool: fruit bursts out of broken boxes, then homes to the player.
    const fruitGeo = new THREE.SphereGeometry(0.17, 6, 5);
    const fruitMat = new THREE.MeshLambertMaterial({ color: 0xff9028, emissive: 0x3a1c05 });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(fruitGeo, fruitMat);
      mesh.visible = false;
      scene.add(mesh);
      this.fruits.push({ mesh, vel: new THREE.Vector3(), age: -1 });
    }
  }

  get spinning(): boolean {
    return this.spinTimer > 0;
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
    return this.slideTimer > 0 && this.state === 'ride' && this.grounded;
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

  // Momentum-skate mode is live (board down, heading model driving) — used by
  // the audio loop so slow carves on a transition still sound like rolling.
  get boardRolling(): boolean {
    return this.freeSkate;
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
    this.ttDied = false;
    this.comboFailT = 0;
    this.comboGraceT = 0;
    this.comboGraceWarned = false;
    this.comboDied = false;
    this.comboWasLive = false;
    this.balanceBoostT = 0;
    if (hard) {
      this.lives = 3;
      this.hasCrystal = false;
      this.gemEarned = false;
      this.comboGemEarned = false;
    }
    level.reset(hard);
    this.pos.copy(hard ? level.spawnPos : level.currentSpawn);
    level.playerPos.copy(this.pos); // keep the boulder trigger honest across respawns
    this.speed = 0;
    this.vVel = 0;
    this.state = 'ride';
    this.grounded = true;
    this.spinTimer = 0;
    this.spinCd = 0;
    this.bodyGroup.rotation.y = 0;
    this.grindRail = null;
    this.regrindCd = 0;
    if (hard) this.runTime = 0;
    // Respawning at a checkpoint restores the counters it banked; a hard
    // reset (reset() cleared activeCheckpoint) starts from zero.
    this.cratesBroken = level.activeCheckpoint ? level.activeCheckpoint.savedCratesBroken : 0;
    this.fruit = level.activeCheckpoint ? level.activeCheckpoint.savedFruit : 0;
    this.masks = level.activeCheckpoint ? level.activeCheckpoint.savedMasks : 0;
    this.points = level.activeCheckpoint ? level.activeCheckpoint.savedPoints : 0;
    this.uberTimer = 0;
    this.slideFromWalk = false;
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
    this.comboTimer = 0;
    this.invulnTimer = 0;
    this.slideTimer = 0;
    this.slideCd = 0;
    this.slideGraceT = 0;
    this.slideEndPending = false;
    this.slideAirLat = 0;
    this.slideJumpAir = false;
    this.slideRecoverT = 0;
    this.skateBlockT = 0;
    this.slideCrawlChain = false;
    this.railUnder = false;
    this.underK = 0;
    this.underCoolT = 0;
    this.boardSnapT = 0;
    this.brakeT = 0;
    this.brakeLockT = 0;
    this.brakeRampT = 0;
    this.oBrakeHold = false;
    this.walkRamp = 0;
    this.crawling = false;
    this.slamActive = false;
    this.slamHangT = 0;
    this.bailDownT = 0;
    this.airFromSkate = false;
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
    for (const f of this.fruits) {
      f.age = -1;
      f.mesh.visible = false;
    }
    this.groundHit = null;
    this.coyoteTimer = 0;
    this.wallriding = false;
    this.wallCoolT = 0;
    this.wallrideLatched = false;
    this.wallChargeT = 0;
    this.ledgeT = 0;
    this.ledgeCoolT = 0;
    this.ledgeEaseT = 0;
    this.ledgeBox = null;
    this.ledgePose = 0;
    this.ledgePhase = 'grip';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.ledgeAwayT = 0;
    this.ledgeShimmy = 0;
    this.hangClipName = null;
    this.hangExitW = 0;
    this.wallridePose = 0;
    this.deckPose = 0;
    this.wallChargePose = 0;
    this.slopePose = 0;
    this.slopeRoll = 0;
    this.alignPose = 0;
    this.alignNormal.set(0, 1, 0);
    this.slipping = false;
    this.slipClamp = false;
    const zn = level.zoneAt(this.pos.x, this.pos.z);
    this.setTravelDir(zn ? zn.dir : 'S');
    // a camera lane owns the course frame: spawn facing straight down it
    const lf0 = level.laneDirAt(this.pos.x, this.pos.z);
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
    this.jumpBufferT = 0;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.spinAngle = 0;
    this.visualYaw = 0;
    this.flipTimer = 0;
    this.balance = 0;
    this.balanceCritT = 0;
    this.lastTy = 0;
    this.rideNormal.set(0, 1, 0);
    this.prevPos.copy(this.pos);
    for (const s of this.sparks) {
      s.life = 0;
      s.mesh.visible = false;
    }
    this.onRespawn();
  }

  // One deterministic fixed step.
  step(dt: number, input: Input, level: Level): void {
    // Moving ground: ride along with the platform you're standing on (the
    // platform advanced once in level.update since our last step — apply that
    // delta before this step's movement so we stay glued). Crumble pads get
    // told they've been stepped on.
    if (this.grounded && this.groundHit) {
      if (this.groundHit.moverId !== undefined) this.pos.add(level.moverDelta(this.groundHit.moverId));
      if (this.groundHit.crumbleId !== undefined) level.touchCrumble(this.groundHit.crumbleId);
    }
    level.playerPos.copy(this.pos); // the boulder chase reads this
    level.setRelics(this.hasCrystal, this.gemEarned); // gate icons mirror the haul
    // Fresh X presses feed the perfect-bounce timing window.
    if (input.jumpPressed) this.jumpPressT = TUNING.arrowBoostWindow;
    else this.jumpPressT = Math.max(0, this.jumpPressT - dt);
    // While sliding, keep the slide-jump grace topped up; after the slide it
    // runs down, and a release inside it still counts as a slide jump.
    if (this.slideTimer > 0) {
      this.slideGraceT = TUNING.slideJumpGrace;
      this.slideEndPending = true; // a slide is running; its end isn't resolved yet
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
    // LEDGE HANG owns the whole step: no movement, physics, or collision runs
    // while gripped — climb up, hop off, or the grip gives out. stepHang ticks
    // the essential shared timers itself.
    if (this.state === 'rope') {
      if (input.restartPressed) {
        this.respawn(level, true);
        this.syncVisual(input, dt);
        return;
      }
      this.stepRope(dt, input, level);
      this.updateSpin(dt, input); // Square spins on the rope: mid-air smash
      this.updateSparks(dt);
      this.updateFruit(dt);
      this.syncVisual(input, dt);
      return;
    }
    if (this.state === 'hang') {
      if (input.restartPressed) {
        this.respawn(level, true);
        this.syncVisual(input, dt);
        return;
      }
      this.stepHang(dt, input, level);
      this.updateSparks(dt);
      this.updateFruit(dt);
      this.syncVisual(input, dt);
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
        ? (level.laneDirAt(this.pos.x, this.pos.z) ??
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
    if (!laneDir && !(level.laneActive && !zone) && !chaseMode && wantDir !== this.travelDir && this.state !== 'grind' && !this.freeSkate) {
      const oldSpeed = this.speed;
      this.setTravelDir(wantDir);
      const alongNew =
        wantDir === 'S' || wantDir === 'N' ? input.moveY : wantDir === 'E' ? input.moveX : -input.moveX;
      this.speed =
        Math.abs(alongNew) > 0.3 ? Math.sign(alongNew) * Math.abs(oldSpeed) * 0.7 : 0;
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
          level.laneDirAt(this.pos.x, this.pos.z) ??
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

    // The blob shadow is a landing indicator: probe far down for the floor
    // every step, independent of the short gameplay ground-follow ray.
    this.shadowGroundY = this.queryShadowGround(level);

    this.regrindCd = Math.max(0, this.regrindCd - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    // touching down mid-somersault cuts it — Crash lands upright, no carry-over tumble
    this.flipTimer = this.grounded ? 0 : Math.max(0, this.flipTimer - dt);
    if (this.grounded || this.state === 'grind') {
      this.airJumpUsed = false; // double jump re-arms on any contact
      this.airborneT = 0; // the double-jump window clock starts at takeoff
      this.bounceJump = false;
    } else {
      // first airborne frame records the pop that launched this air, so the
      // double-jump window can scale with the jump's actual size
      if (this.airborneT === 0) this.launchVy = Math.max(0, this.vVel);
      this.airborneT += dt;
    }
    // The roll-jump gate: how long a direction has been HELD going into a
    // jump. Steering only after takeoff never rolls — this is read AT launch.
    this.dirHoldT = Math.hypot(input.moveX, input.moveY) > 0.5 ? this.dirHoldT + dt : 0;
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.underCoolT = Math.max(0, this.underCoolT - dt);
    this.boardSnapT = Math.max(0, this.boardSnapT - dt);
    this.slideTimer = Math.max(0, this.slideTimer - dt);
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
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    const bailWas = this.bailDownT;
    this.bailDownT = Math.max(0, this.bailDownT - dt);
    // A bail's tumble steers axisF/axisL down the fall line (free-skate
    // convention). If the get-up ends ON FOOT, restore the course control
    // frame — otherwise you walk away with rotated/inverted controls until
    // something else happens to reset them (the halfpipe-bail hijack).
    if (bailWas > 0 && this.bailDownT === 0 && !this.freeSkate && (this.state === 'ride' || this.state === 'air')) {
      const zn = level.zoneAt(this.pos.x, this.pos.z);
      this.setTravelDir(zn ? zn.dir : 'S');
    }
    if (this.state !== 'air') {
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
    }
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    if (this.uberTimer > 0 && Math.random() < 0.5) this.emitSparks(1, 0xffd700, 1.2);
    // Actual planar speed from last step's displacement (any direction) —
    // the skate-entry gate uses this so sideways motion counts, not just the
    // forward-axis `speed` scalar. Computed before prevPos is overwritten.
    this.lastVelX = (this.pos.x - this.prevPos.x) / Math.max(dt, 1e-4);
    this.lastVelZ = (this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.lastPlanar = Math.hypot(this.lastVelX, this.lastVelZ);
    this.prevPos.copy(this.pos);
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
      } else {
        this.slideVec.copy(this.axisF).multiplyScalar(Math.sign(this.speed || 1));
      }
      this.slideSpd = Math.min(
        Math.max(Math.abs(this.speed), TUNING.slideSpeed),
        TUNING.downhillMax,
      );
      this.slideTimer = TUNING.slideDistance / Math.max(this.slideSpd, 6);
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
    this.railCand = nearestRail(level.rails, this.pos);
    this.railCandidateDist = this.railCand ? this.railCand.sample.distance : Infinity;

    if (input.restartPressed) {
      this.respawn(level, true);
      this.syncVisual(input, dt);
      return;
    }

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
          this.tryGrind()
        ) {
          // snapped straight onto the rail this tick
        } else {
          this.stepRide(dt, input, level);
        }
        break;
      }
      case 'air':
        this.runTime += dt;
        // SPINE TRANSFER: R2 mid-hang pops the hang over the coping onto the
        // adjacent vert (when there is one). Deliberate, edge-triggered.
        if (input.transferPressed) this.trySpineTransfer(level);
        // NOTE: there is deliberately NO lip-stall catch from the air. The
        // stall is committed ON the wall (climb square holding Triangle,
        // through the crest) — once you're in hangtime, coming down onto the
        // lip drops you back in (or snaps a coping grind like any rail if
        // Triangle is held). Getting parked on the coping out of a big hang
        // killed the flow.
        if (
          this.ropeCoolT <= 0 &&
          !this.wallriding &&
          !this.slamActive &&
          this.bailDownT <= 0 &&
          this.tryRopeGrab(level)
        ) {
          // hands on the swing rope
        } else if (!this.wallriding && (input.grindPressed || input.grindHeld) && this.tryGrind()) {
          // grabbed the rail
        } else {
          this.stepAir(dt, input, level);
        }
        break;
      case 'grind':
        this.runTime += dt;
        this.stepGrind(dt, input, level);
        break;
    }

    this.updateSpin(dt, input);
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
    this.updateFruit(dt);

    if (this.state === 'ride' || this.state === 'air' || this.state === 'grind') {
      this.collide(level);
      // All boxes broken -> the gem materializes on the spot, Crash rules.
      if (
        !this.gemEarned &&
        level.totalCrates > 0 &&
        this.cratesBroken >= level.totalCrates &&
        (this.state as MoveState) !== 'dead'
      ) {
        this.gemEarned = true;
        level.awardGem(this.pos);
        sfx.play('lifeGet', 0.9);
        this.score(CONST.ptsGem, 'Gem');
        this.onRelic('ALL BOXES!', 'gem earned');
      }
      // Blast aftermath: tally crates the explosions broke, and die if we're
      // inside an expanding blast sphere.
      for (const c of level.consumeBlastBroken()) {
        this.cratesBroken++;
        this.score(CONST.ptsCrate, 'Box');
        this.crateReward(c);
      }
      // collide() above may have killed us; TS can't see that mutation.
      // Uber and masks (and the flicker after spending one) block blasts.
      if ((this.state as MoveState) !== 'dead' && this.invulnTimer <= 0 && this.uberTimer <= 0) {
        const center = new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z);
        for (const ex of level.explosions) {
          if (ex.safe || ex.t > CONST.blastGrow + 0.05) continue;
          const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
          if (center.distanceTo(ex.center) < r + 0.5) {
            if (!this.spendMask()) this.die();
            break;
          }
        }
      }
      if (this.pos.y < level.killY) this.die();
    }

    // Re-arm the wallride once you've touched the ground or caught a rail grind
    // (you get one wallride per air-time — no wall-to-wall chaining).
    if (this.grounded || this.state === 'grind') this.wallrideLatched = false;

    this.syncVisual(input, dt);
  }

  // ---------------------------------------------------------------- states --

  // Score an action. Combos live in the AIR and on rails/slides only: those
  // actions stack base + multiplier, THPS-style, and bank on a clean landing.
  // Plain ground actions (spinning a box while standing there) just pay flat
  // points — they never start or feed a combo. Bail or die = the combo dies.
  private score(base: number, label?: string): void {
    const inTrick =
      this.landingScoring ||
      this.state === 'air' ||
      this.state === 'grind' ||
      this.state === 'rope' || // hanging on the swing: airborne in spirit
      this.sliding ||
      this.manualing !== 0 || // balanced on two wheels: the combo connector
      this.lipStallT > 0; // parked on the coping: same deal
    if (inTrick) {
      this.comboPoints += base;
      this.comboMult += 1;
      // never SHORTEN the remaining window — a spin bonus scored right after
      // touchdown must not eat the post-landing manual grace
      this.comboTimer = Math.max(this.comboTimer, CONST.comboWindow);
      if (label) {
        this.pushLabel(label);
        // Real tricks (grabs, grinds, wallride, slide, body slam) light up the
        // combo plate; bare platforming — spins (…°), crate bounces (Boing),
        // enemy pops (Flattened/Takedown/Bonk), box smashes — do not on their own.
        if (!/°$|Boing|Flattened|Takedown|Bonk|^Box$|Slam Smash|Crystal|Gem/.test(label))
          this.comboHasTrick = true;
      }
    } else {
      this.points += base;
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
    if (this.comboMult > 0) {
      const amount = this.comboPoints * this.comboMult;
      this.points += amount;
      // Cash-in ticker only when the plate was actually up (a real trick chained);
      // platforming-only points just land on the score.
      if (this.comboHasTrick) this.onComboBank(amount);
    }
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
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
  private spendMask(): boolean {
    if (this.masks <= 0) return false;
    this.masks--;
    this.invulnTimer = CONST.maskInvuln;
    sfx.play('maskLoss', 0.9);
    this.emitSparks(8, 0xffd27a, 2);
    return true;
  }

  // Release-triggered charged jump: tap = jumpMinVelocity, full hold =
  // jumpVelocity. The jump's IDENTITY is decided here, at release, from the
  // state and speed you're carrying — not from how X was pressed.
  private chargedJump(dt: number): void {
    const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
    const wasCrawling = this.crawling;
    // Ollieing out of a manual is the CLEAN exit — back to four wheels in the
    // air, combo string still alive (the air refreshes it with the next trick).
    if (this.manualing !== 0) this.endManual();
    // The slide boost applies during the slide AND for slideJumpGrace seconds
    // after it ends — the old exact-window timing was nearly unhittable.
    const fromSlide = this.slideTimer > 0 || this.slideGraceT > 0;
    // Grabs are board tricks: only airs that START from skating offer them.
    this.airFromSkate =
      this.freeSkate || fromSlide || Math.abs(this.speed) > TUNING.walkSpeed + 0.5;
    this.slideGraceT = 0;
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
      (this.groundHit.halfpipe !== undefined || this.groundHit.normal.y < TUNING.steepStand)
    ) {
      const pop = THREE.MathUtils.lerp(TUNING.jumpMinVelocity, TUNING.jumpVelocity, t);
      const climb = Math.max(0, this.speed * Math.max(this.lastTy, 0));
      this.vVel = Math.min(pop + climb, CONST.maxFallSpeed);
      if (this.groundHit.halfpipe) {
        this.hangPipe = this.groundHit.halfpipe;
        this.pipeRideT = Math.max(this.pipeRideT, 0.05); // enterVertAir: pipe-hang rules
      }
      this.lastJumpType = 'Board Ollie';
      this.state = 'air';
      this.grounded = false;
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
      this.slideEndPending = false; // consumed by a slide JUMP: no plain-slide scrub
      this.slideCrawlChain = false; // a jump out of the slide, not a crawl chain
      this.slideCd = CONST.slideCooldown;
      this.airMomentum = true;
      this.lastJumpType = 'Slide Jump';
      sfx.play('woosh2', 0.6);
    } else if (spd > TUNING.walkSpeed + 0.5) {
      // leaving actual skating: THPS board ollie. The ollie charges on its
      // OWN min..max scale, decoupled from the on-foot jump — X doubles as
      // the skate accelerator, so riding the charge scale up to jumpVelocity
      // made every accelerating jump a moon jump. Cruising on direction keys
      // and tapping X gives the small pop; a held charge earns the big one.
      this.vVel = THREE.MathUtils.lerp(TUNING.ollieMinVelocity, TUNING.ollieVelocity, t);
      this.lastJumpType = 'Board Ollie';
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
      this.runTime += dt;
      this.speed = 0;
      this.vVel = 0;
      // needle: + = tipping into the pipe (drifts there naturally), − = deck.
      // Difficulty ramps the longer you hold the stall.
      const stallAge = TUNING.lipMaxTime - this.lipStallT;
      const lipRamp = Math.min(
        Math.max(0, TUNING.balanceRampMax - 1),
        stallAge * TUNING.balanceRamp * 2,
      );
      this.balance += Math.sign(this.balance || 1) * TUNING.lipDrift * (1 + lipRamp) * dt;
      // fight along the SCREEN axis the tip reads on (see lipAim)
      const lipSgn = this.lipAim(false);
      const fightStick = this.lipMeterH ? this.rawInput.moveX : this.rawInput.moveY;
      this.balance += fightStick * lipSgn * TUNING.lipControl * dt;
      if (this.uberTimer > 0 || this.balanceBoostT > 0) this.balance = 0;
      if (Math.abs(this.balance) >= 1) {
        this.balance = Math.sign(this.balance);
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

    // Flattened after a slam OR knocked down by a bail: pancaked on the
    // ground for a beat, no control.
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
    // face (which is exactly what the asymmetric slopeBoost/uphillSlowdown did).
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
    // On steep ground the board only pops out when it's a RIDER (charge/
    // momentum/rollout) — a walker (footPlant OR footSlip) stays on foot and
    // obeys footGrip. Standing still on a bank no longer flashes the board.
    const skating =
      pushingOff ||
      this.slideTimer > 0 ||
      (steepGround && !footPlant && !footSlip) ||
      planarSpeed > TUNING.walkSpeed + 0.5 ||
      rollingOut;

    // Enter/leave free-heading mode. Walking and canned slides keep the
    // classic course-axis model; the board carves free — everywhere,
    // transitions included.
    const free = skating && this.slideTimer <= 0 && !slamFlat && !this.crawling && this.skateBlockT <= 0;
    if (free && !this.freeSkate) {
      // Seed the skate velocity from the direction you're actually going, so
      // a sideways walk hands its momentum straight into the skate (the
      // forward-only `speed` scalar was 0 for pure sideways).
      const rx = this.rawInput.moveX;
      const ry = this.rawInput.moveY;
      if (rx !== 0 || ry !== 0) {
        const inv = 1 / Math.hypot(rx, ry);
        this.axisF.set(rx * inv, 0, -ry * inv);
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
    } else if (!free && this.freeSkate) {
      this.stance = 1; // feet down: the next push starts regular
      // back onto the course grid: keep the along-course velocity component
      const vx = this.axisF.x * this.speed;
      const vz = this.axisF.z * this.speed;
      const zn = level.zoneAt(this.pos.x, this.pos.z);
      this.setTravelDir(zn ? zn.dir : 'S');
      this.speed = vx * this.axisF.x + vz * this.axisF.z;
    }
    this.freeSkate = free;

    // Regular-walk EASE-IN: while walking with a direction held, the walk
    // fraction ramps 0->1 over walkRampTime (a soft start instead of the instant
    // snap); it resets the moment you stop or hop on the board. runScale folds in
    // the post-brake run lock too (whichever is more restrictive wins), so a
    // walk after a brake still respects the lock + brakeLockRamp ease-back.
    const walkDir = input.moveX !== 0 || input.moveY !== 0;
    if (this.freeSkate || this.crawling || slamFlat || !walkDir) this.walkRamp = 0;
    else if (TUNING.walkRampTime > 0)
      this.walkRamp = Math.min(1, this.walkRamp + dt / TUNING.walkRampTime);
    else this.walkRamp = 1;
    const runScale = Math.min(moveScale, this.walkRamp);

    if (slamFlat) {
      // Pancaked/bailed: normally parked dead — but a bail ON A TRANSITION
      // TUMBLES down the face instead of sticking to a near-vertical wall:
      // the body swings down the fall line and slides into the flat (the
      // lying-flat pose riding downhill with dust IS the tumble).
      const steepBail =
        this.bailDownT > 0 &&
        this.grounded &&
        this.groundHit !== null &&
        this.groundHit.normal.y < TUNING.steepStand;
      if (steepBail) {
        const n = this.groundHit!.normal;
        const l = Math.hypot(n.x, n.z) || 1;
        this.axisF.set(n.x / l, 0, n.z / l); // the fall line (normal leans toward the flat)
        this.axisL.set(this.axisF.z, 0, -this.axisF.x);
        this.speed = Math.min(this.speed + TUNING.slopeBoost * 0.6 * dt, 12);
        this.emitDust(1);
      } else {
        this.speed = 0;
      }
      this.lastTy = 0;
    } else if (this.crawling) {
      // Direct-drive crawl. Speed snaps to the stick; no slopes, no friction, no
      // ramp — the crawl is instant (its own lock-til-release owns the delay).
      this.speed = input.moveY * TUNING.crawlSpeed;
      this.lastTy = 0;
    } else if (!skating) {
      // WALK: near-direct drive. A planted charge (X from a standstill) pins the
      // feet the WHOLE time — no slide, no sidestep — whether or not a direction
      // is held. Releasing X jumps (aimed by the held direction); holding it past
      // skateHoldTime pops STRAIGHT onto the board (plantedPush, seeded above), so
      // the skater snaps onto the board in place instead of sliding up to speed.
      // Otherwise the walk eases in over walkRampTime (runScale) and holds at 0
      // through a post-brake run lock, so a brake never rolls into a reverse run.
      const walkTarget =
        this.charging && this.chargePlanted ? 0 : input.moveY * TUNING.walkSpeed * runScale;
      if (this.groundHit && this.groundHit.slippy && !(this.charging && this.chargePlanted)) {
        // ICE WALK on a slick plank: momentum, not instant stop — you accelerate
        // toward the target and COAST when you let go, so you can't stop on a dime
        // before the gap. (A planted charge still pins the feet, above.)
        this.speed += (walkTarget - this.speed) * Math.min(1, CONST.slipAccel * dt);
      } else {
        this.speed = walkTarget;
      }
      this.lastTy = 0;
    } else {
      // SKATE: authored momentum. X (charge) is the only accelerator; input
      // against travel brakes hard (turnaround); input with travel coasts
      // easy; no input bleeds friction back toward walking pace. A slide is
      // canned: it ignores the stick entirely and keeps its momentum.
      let braking = false; // set by either brake, so the downhill boost yields to it
      if (this.slideTimer > 0) {
        // canned 8-axis slide: the along-course component lives in `speed`,
        // the cross component is applied in the lateral block below
        this.speed =
          this.slideSpd * (this.slideVec.x * this.axisF.x + this.slideVec.z * this.axisF.z);
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
            level.laneDirAt(this.pos.x, this.pos.z) ??
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
          if (Math.abs(ang) > CONST.carveBrakeAngle && this.pipeLandGraceT > 0) {
            // Fresh off a pipe drop-in: the stick is still held the way you were
            // CLIMBING, which is now behind you. That's stale intent, not a
            // brake — ignore it and let the transition carry the swing.
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
            this.speed = Math.max(0, this.speed - TUNING.turnaround * ease * dt);
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
            const maxTurn = THREE.MathUtils.degToRad(grip) * dt;
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
      if (onPipe) {
        // HALFPIPE: one SYMMETRIC gravity both ways (climb decelerates,
        // descent accelerates at the same rate) = a clean, energy-conserving
        // pendulum that whips you wall-to-wall instead of the asymmetric ramp
        // physics that bled you to a dead stop on the face.
        if (Math.abs(ty) > 0.02) this.speed += -TUNING.pipeGravity * ty * dt;
      } else if (Math.abs(ty) > 0.02 && !(braking && ty < 0)) {
        // While actively braking, the DOWNHILL boost yields — otherwise a low
        // turnaround rate can never out-decelerate gravity and you can't come to
        // a full stop on a slope. Uphill slowdown still applies (it only helps
        // you stop). Not braking: normal slope physics.
        // X held = attack the ramp: MORE boost downhill, LESS bleed uphill.
        const attack = ty < 0 ? (this.charging ? 1.3 : 0.8) : this.charging ? 0.55 : 0.8;
        this.speed += (ty < 0 ? TUNING.slopeBoost : TUNING.uphillSlowdown) * -ty * attack * dt;
      }
      // HALFPIPE CARVE: just HOLDING a direction on the transition works the wall
      // for momentum — no X needed. This is the "carving pumps you" feel: hold
      // toward the wall and you drive up it and build speed. Scaled by steepness,
      // so the flat bottom gives no free speed and the wall carves hardest.
      if (
        onPipe &&
        this.groundHit &&
        (input.moveX !== 0 || input.moveY !== 0) &&
        this.groundHit.normal.y < TUNING.steepStand
      ) {
        this.speed += TUNING.pipeCarve * (1 - this.groundHit.normal.y) * dt;
      }
      // PUMP: hold X to work the transition for EXTRA speed — the hard pump on
      // top of the carve, the honest way to build vert height. On the halfpipe
      // this is the strong pipePumpGain (it has to out-build gravity+friction over
      // successive swings to clear the coping); on general steep banks it's the
      // gentler crouch pipePump. Both scale with steepness (hardest below the coping).
      if (this.charging && this.groundHit && this.groundHit.normal.y < TUNING.steepStand) {
        const gain = onPipe ? TUNING.pipePumpGain : TUNING.pipePump;
        this.speed += gain * (1 - this.groundHit.normal.y) * dt;
      }
      // HALFPIPE near-frictionless: the general idle friction (7) bleeds a swing
      // dead in a couple of seconds; on the pipe a tiny bleed lets momentum
      // carry wall-to-wall. Applied here so it hits every frame, not just idle.
      if (onPipe && Math.abs(this.speed) > 0) {
        const fr = Math.min(TUNING.pipeFriction * dt, Math.abs(this.speed));
        this.speed -= Math.sign(this.speed) * fr;
      }
      this.lastTy = ty;

      // Downhill may exceed maxSpeed up to a hard cap; on the flat the excess
      // bleeds back off. Same caps in both directions.
      const hardCap = TUNING.downhillMax;
      this.speed = THREE.MathUtils.clamp(this.speed, -hardCap, hardCap);
      if (Math.abs(this.speed) > TUNING.maxSpeed && Math.abs(ty) <= 0.02) {
        this.speed =
          Math.sign(this.speed) *
          Math.max(TUNING.maxSpeed, Math.abs(this.speed) - CONST.overspeedDecay * dt);
      }
      // A free heading never reverses through zero — stalling on a hill just
      // stops you. On ground too steep to stand, you can't hover: whenever the
      // board is SLOW and pointed roughly along the coping (|ty| small — not
      // already committed up or down the wall), swing it down the fall line and
      // roll back into the transition. The |ty| gate lets a fast descent/climb
      // pass untouched, and beating the pipePump lift (which fires just above)
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
          }
        } else if (steepGround && this.speed < 2 && Math.abs(this.lastTy) < 0.15) {
          const n = this.groundHit!.normal;
          const len = Math.hypot(n.x, n.z);
          if (len > 1e-4) {
            this.axisF.set(n.x / len, 0, n.z / len);
            this.axisL.set(this.axisF.z, 0, -this.axisF.x);
            this.speed = Math.max(this.speed, 1.5);
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
        this.balance +=
          Math.sign(this.balance || this.manualing) * TUNING.manualDrift * (1 + ramp) * dt;
        this.balance -= this.rawInput.moveY * TUNING.manualControl * dt;
        if (this.uberTimer > 0 || this.balanceBoostT > 0) this.balance = 0;
        if (Math.abs(this.balance) >= 1) {
          this.balance = Math.sign(this.balance);
          this.balanceCritT += dt;
          if (this.balanceCritT > TUNING.bailGrace) {
            this.endManual();
            this.bail();
            return;
          }
        } else {
          this.balanceCritT = 0;
        }
        this.manualTickT += dt;
        while (this.manualTickT >= 0.25) {
          this.manualTickT -= 0.25;
          this.comboPoints += CONST.ptsManualTick;
          this.comboTimer = CONST.comboWindow;
        }
      }
    }

    // Ride the SURFACE, not the map. On a slope the heading projects onto the
    // ride plane, splitting speed honestly between planar travel and climb —
    // a vert wall climbs at speed*sin(slope) instead of the old full-speed
    // horizontal advance with a hidden vertical teleport from the snap. Walks
    // and flat ground keep the crisp planar step (identical math at n.y≈1).
    if (this.freeSkate && this.grounded && this.groundHit && this.rideNormal.y < 0.995) {
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

    // Axis-locked sidestep: direct velocity while held, dead stop on
    // release. Left is ALWAYS screen-left, even while backing up. Slides
    // are direction locked: no steering mid-slide.
    if (slamFlat) {
      // pancaked: no steering
    } else if (this.crawling) {
      if (input.moveX !== 0) {
        this.pos.addScaledVector(this.axisL, input.moveX * TUNING.crawlSpeed * dt);
      }
    } else if (this.slideTimer > 0) {
      // the slide's cross-course component
      const lat = this.slideVec.x * this.axisL.x + this.slideVec.z * this.axisL.z;
      this.pos.addScaledVector(this.axisL, this.slideSpd * lat * dt);
    } else if (input.moveX !== 0 && !this.freeSkate && !(this.charging && this.chargePlanted)) {
      // Walking keeps the direct crisp sidestep (the unit-clamped input
      // vector already normalizes diagonals).
      // Free-heading skating has NO sidestep — carving IS the steering.
      // A planted charge never sidesteps: the feet stay pinned the whole charge,
      // then a sideways hold pops straight onto the board (no slide).
      // runScale carries the walk ease-in AND the post-brake run lock into the
      // sidestep (0 = dead), so a fresh sidestep starts soft and a brake from a
      // SIDEWAYS skate stays put in every direction until it eases back.
      const latRate = skating
        ? Math.max(TUNING.walkSpeed, Math.abs(this.speed) * 0.5)
        : TUNING.walkSpeed;
      this.pos.addScaledVector(this.axisL, input.moveX * latRate * dt * runScale);
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
      const lo = Math.min(ridingPipe.l0, ridingPipe.l1) - 0.3;
      const hi = Math.max(ridingPipe.l0, ridingPipe.l1) + 0.3;
      if (along >= lo && along <= hi) {
        const pr = ridingPipe.project(
          ridingPipe.crossCoord(this.pos.x, this.pos.z),
          this.pos.y,
        );
        // |pen| window ≈ the old wallStick: near or into the surface = attached
        if (pr && Math.abs(pr.u) < ridingPipe.uLip - 0.02 && pr.pen > -TUNING.wallStick) {
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
    // HALFPIPE COPING LAUNCH: climbing a transition and reaching the near-vert
    // top (rideNormal.y <= 0.25, up near the lip height) pops you over into the
    // EXISTING vert hang-time — a big air if you rocketed up with speed, a small
    // pop if you just pumped to the lip. Either way you HANG and drop back into
    // the pipe (reusing the mature glue) instead of freezing on the face or
    // flinging off to your death. This is what the old dedicated launch lacked.
    const hpNow = this.freeSkate && hit ? hit.halfpipe : undefined;
    if (
      hpNow &&
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
      sfx.play('woosh2', 0.6);
      this.emitSparks(5, 0xfff3d0, 1.2);
      this.coyoteTimer = 0;
    } else if (
      hit &&
      this.speed > 0.5 &&
      (this.lastTy > TUNING.vertLip || this.rideNormal.y < vertWallY) &&
      hit.normal.y >= CONST.steepSnapNormal
    ) {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.airFromSkate = true; // vert launches only happen from riding
      this.hangPipe = ridingPipe ?? hit.halfpipe ?? null; // spine-transfer bookkeeping
      this.vVel = Math.min(this.lastTy * this.speed, CONST.maxFallSpeed);
      // ALWAYS hang time. Releasing X (or a fresh tap) at the lip LAUNCHES you
      // higher into the hang (the intuitive pop); holding X = a mellow hang.
      // Approach angle decides straight-in vs a sideways gap (see enterVertAir).
      this.enterVertAir(
        input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0 || this.vertLaunchT > 0,
      );
      sfx.play('woosh2', 0.6);
      this.emitSparks(5, 0xfff3d0, 1.2);
      this.coyoteTimer = 0;
    } else if (hit && hit.y >= this.pos.y - downWindow && hit.y <= this.pos.y + upWindow) {
      this.pos.y = hit.y;
      this.groundHit = hit;
      this.grounded = true;
      this.surfaceName = hit.name;
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
      // Authored kicker launch: leaving an uphill lip converts the climb to
      // lift (forward travel only — backing off an edge just drops).
      this.vVel =
        this.speed > 0 && this.lastTy > 0.05
          ? Math.min(this.lastTy * this.speed, CONST.maxFallSpeed)
          : 0;
      // A near-vertical lip (halfpipe coping) is hang time; releasing X launches.
      // Same head-on-OR-vert-wall test as the grounded crest (angled entries too).
      if (this.vVel > 0.5 && (this.lastTy > TUNING.vertLip || this.rideNormal.y < vertWallY)) {
        this.enterVertAir(
          input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0 || this.vertLaunchT > 0,
        );
        sfx.play('woosh2', 0.6);
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
        const climbingVert =
          steepGround && this.speed > 0.5 && this.lastTy > TUNING.vertLip * 0.5;
        if (climbingVert) this.vertLaunchT = 0.25;
        else this.chargedJump(dt);
      }
    }
  }

  private stepAir(dt: number, input: Input, level: Level): void {
    if (this.wallriding) {
      this.stepWallride(dt, input, level);
      return;
    }
    // Coyote release: letting go of a charge just after rolling off a ledge
    // still jumps. A press-then-release fully in the air (tap) works too.
    if (this.coyoteTimer > 0) {
      if (input.jumpHeld && !this.charging) this.charging = true; // tap started mid-air
      if (input.jumpReleased && this.charging) {
        this.chargedJump(dt);
      }
    } else {
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
        this.vVel = TUNING.jumpMinVelocity;
        // the second pop IS a somersault — restart the tumble fresh so the
        // double reads (replaces the old spread-eagle flash)
        this.flipTimer = CONST.frontFlip ? CONST.flipDuration : 0;
        this.starTimer = 0; // the flip owns the pose — no star overlap
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
      // A halfpipe hang locks HARD to the launch axis (near 100%) so you rise
      // and fall on the same vertical line and drop back onto your take-off spot
      // — no drift into the pipe. General vert crests keep the softer vertGlue.
      const g = this.pipeHang ? 1 : Math.min(1, TUNING.vertGlue * dt);
      const dx = this.pos.x - this.vertAnchor.x;
      const dz = this.pos.z - this.vertAnchor.z;
      const d = dx * this.vertNormal.x + dz * this.vertNormal.z;
      this.pos.x -= this.vertNormal.x * d * g;
      this.pos.z -= this.vertNormal.z * d * g;
      const tx = -this.vertNormal.z; // wall tangent (along the coping)
      const tz = this.vertNormal.x;
      // carried lateral momentum from an off-axis entry: this is what flies you
      // across a gap / transfers you to the far wall (glue only pins the normal)
      if (this.vertLatVel !== 0) {
        this.pos.x += tx * this.vertLatVel * dt;
        this.pos.z += tz * this.vertLatVel * dt;
        // ...but it bleeds off through the hang: drift down the pipe early,
        // come down LOCKED over one spot (the THPS contract — pipes, ramp
        // crests, all of it).
        this.vertLatVel *= Math.exp(-CONST.hangLatDamp * dt);
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
      // THPS LOCK-IN, the hard guarantee: a hang over a pipe can never float
      // past the END of the pipe — past the end there is no wall to catch
      // you, and drifting there dumped you out of the hang onto the flat.
      // Clamp to the trough span; hitting the clamp kills the carry.
      if (this.hangPipe) {
        const hp = this.hangPipe;
        const lo = Math.min(hp.l0, hp.l1) + 0.4;
        const hi = Math.max(hp.l0, hp.l1) - 0.4;
        const along = hp.alongCoord(this.pos.x, this.pos.z);
        const clamped = THREE.MathUtils.clamp(along, lo, hi);
        if (clamped !== along) {
          if (hp.axis === 'z') this.pos.z = clamped;
          else this.pos.x = clamped;
          this.vertLatVel = 0;
        }
      }
    }

    // Pancake slam is an ON-FOOT move (Circle+down from a walking jump). A
    // board/skate air does NOT slam — there Circle+down is a grab instead.
    if (!this.slamActive && !this.airFromSkate && input.grabHeld && this.rawInput.moveY < -0.5) {
      this.slamActive = true;
      this.vertAir = false; // the slam plummets straight down, no wall glue
      this.vertLatVel = 0;
      this.slamHangT = CONST.slamHang;
      this.grabPhase = 'none';
      this.grabT = 0;
      this.grabGraceTimer = 0;
      this.grabSpinAngle = 0;
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
      const g = this.vertAir || this.pipeHang
        ? TUNING.pipeAirGravity
        : this.vVel > 0
          ? TUNING.riseGravity
          : TUNING.fallGravity;
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
    if (!this.grabbing && !this.slamActive && !this.vertAir && !this.slideJumpAir) {
      const footAir =
        !this.charging &&
        !this.airMomentum && // grind/slide exits keep flying, even when slow
        Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
      // Digital diagonals in the air get the same normalization as the walk.
      const diag = footAir && input.moveX !== 0 && input.moveY !== 0 ? Math.SQRT1_2 : 1;
      if (footAir) {
        // On-foot air control is DIRECT DRIVE like the walk: zero inertia, so
        // precision hops (bouncy crates!) never drift.
        this.speed = input.moveY * TUNING.walkSpeed * diag;
      } else if (Math.abs(input.moveY) > 0.05) {
        // Braking (input against travel) bites harder than stretching, in
        // either direction.
        const opposing = input.moveY * this.speed < 0;
        const rate = opposing ? TUNING.airControl * CONST.airBrakeFactor : TUNING.airControl;
        const cap = TUNING.downhillMax;
        this.speed = THREE.MathUtils.clamp(this.speed + rate * input.moveY * dt, -cap, cap);
      }
      if (Math.abs(input.moveX) > 0.05) {
        this.pos.addScaledVector(this.axisL, input.moveX * TUNING.walkSpeed * diag * dt);
      }
    }

    this.pos.addScaledVector(this.axisF, this.speed * dt);
    if (this.slideAirLat !== 0) this.pos.addScaledVector(this.axisL, this.slideAirLat * dt); // slide-jump cross-heading launch
    this.pos.y += this.vVel * dt;

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
      const underside = hit.y - 1.0;
      const head = this.pos.y + CONST.playerHalf.y * 2;
      if (this.pos.y < underside - 0.05 && head > underside) {
        this.pos.y = underside - CONST.playerHalf.y * 2;
        this.vVel = 0;
      }
    }

    // Land only on surfaces we were actually ABOVE last step (with a small
    // ledge forgiveness) — a surface overhead must never teleport us onto it.
    // Steep transitions get a much deeper forgiveness: falling with sideways
    // drift can cross a rising bank face by more than a deck's worth in one
    // step, and that's a landing, not a clip-through. A HALFPIPE wall always
    // gets a deep window no matter how low the slider is set — its transition
    // is near-vertical near the coping, so a fast, drifting descent must LAND
    // on the pipe, never punch through it into the pit below.
    const landGive =
      hit && hit.halfpipe
        ? Math.max(TUNING.landGive, 4)
        : hit && hit.normal.y < CONST.steepSnapNormal
          ? TUNING.landGive
          : 0.35;
    if (
      hit &&
      (pipeCatch !== null || // the analytic catch already resolved the contact exactly
        (this.vVel <= 0 &&
          this.pos.y <= hit.y + 0.05 &&
          (this.prevPos.y >= hit.y - 0.05 || this.pos.y >= hit.y - landGive)))
    ) {
      this.pos.y = hit.y;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.coyoteTimer = 0;
      this.airMomentum = false; // touchdown: normal ground rules resume
      this.slideAirLat = 0; // slide-jump arc is done
      this.slideJumpAir = false;
      this.rideNormal.copy(hit.normal); // fresh landing: ride plane snaps, no stale blend
      const wasPipeHang = this.pipeHang; // (cleared next step; needed for drop-in rules below)
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
      if (this.airFromSkate && hit.normal.y < TUNING.steepStand) {
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

      // SPINE TRANSFER: this hang crested one pipe and came down on a
      // DIFFERENT one — you carried it over the ridge.
      if (wasPipeHang && hit.halfpipe && this.hangPipe && hit.halfpipe !== this.hangPipe) {
        this.score(CONST.ptsSpine, 'Spine Transfer');
        this.emitSparks(8, 0xa0e8ff, 2);
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
      // A halfpipe hang never bails or switches you on any residual rotation —
      // you were CLIMBING (holding a direction), not doing a trick spin, so the
      // drop-back-in is always a clean neutral landing.
      const funny = spun && dev0 > tol && devPi > tol && !this.pipeHang;
      if (this.grabPhase !== 'none' || funny) {
        if (this.uberTimer > 0 || this.spendMask()) {
          this.grabPhase = 'none';
          this.grabT = 0;
          this.grabGraceTimer = 0;
          this.visualYaw = wrapAngle(this.visualYaw + this.grabSpinAngle); // no unwind
          this.grabSpinAngle = 0;
          if (this.uberTimer <= 0) this.speed *= 0.6;
        } else {
          this.landingScoring = false;
          this.bail();
          return;
        }
      } else {
        // pose is neutral and the spin lines up with 0 or 180: a landed 180 rides
        // away switch. (A pipe hang can't reach here off the climb hold unless you
        // actually held a rotation — the snap-on-release lands sub-90 spins at 0.)
        const isSwitch = spun && devPi <= tol;
        if (isSwitch) this.stance = -this.stance as 1 | -1; // landed backward: swap feet
        // A ROTATION IS A TRICK: any landed 180+ scores its own combo entry,
        // grab or no grab — so grab + rotation strings TWO tricks together
        // (a real combo), and a bare hang-time spin still pays on its own.
        // Net rotation, credited in 180s (the snap already pulled it on-axis).
        const halves = Math.round(Math.abs(this.grabSpinAngle) / Math.PI);
        let landedTrick = false;
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
        if (halves > 0) {
          const deg = halves * 180;
          this.score(halves * CONST.ptsSpin, isSwitch ? `Switch ${deg}°` : `${deg}°`);
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
        this.grabSpinTotal = 0;
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

  // Slam touchdown: pancake squash and a small shockwave that breaks crates
  // and enemies. TNT pops safely (you slammed it on purpose); nitro is still
  // nitro — the blast check upstairs will get you.
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
      if (Math.abs(p.y - this.pos.y) > 1.8) continue;
      if (c.tnt) level.detonate(c, true);
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
      if (Math.abs(wn.y) >= 0.71) continue; // not a vert face (THUG's transfer filter)
      const fl = Math.hypot(wn.x, wn.z);
      if (fl < 1e-4) continue;
      // sharp corner: the wall turned away too hard to keep riding it
      if ((wn.x * n.x + wn.z * n.z) / fl < 0.05) break;
      // re-aim the glue plane at the tracked face
      this.vertNormal.set(wn.x / fl, 0, wn.z / fl);
      // lip memory: climb with a rising coping, never slip down a sloped one —
      // but a DOWN-step hit is the recovery case and may lower it
      this.vertAnchor.y = dy < 0 ? h.point.y : Math.max(this.vertAnchor.y, h.point.y);
      this.vertAnchor.x = h.point.x + this.vertNormal.x * 1.2;
      this.vertAnchor.z = h.point.z + this.vertNormal.z * 1.2;
      this.vertTracked = true;
      this.vertLossT = 0;
      found = true;
      break;
    }
    if (!found && this.vertTracked) {
      this.vertLossT += dt;
      if (this.vertLossT > 0.3) {
        // off the end of the wall — nothing left to land on, so stop being
        // vert and let gravity + the normal air pose take it from here
        this.vertAir = false;
        this.vertLatVel = 0;
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
      // Locked-in THPS vert, EVERY vert air (pipes and ramp crests): an
      // angled entry drifts you down the coping a few feet, never launches
      // you down its length (a hard carve at top speed used to out-run the
      // pipe — or fly clean off the side of a ramp).
      this.vertLatVel = THREE.MathUtils.clamp(this.vertLatVel, -CONST.hangLatMax, CONST.hangLatMax);
    }
    this.speed = 0; // the energy is in vVel (up) + vertLatVel (across) now
    // Glue plane. A general vert crest sits it a hair INSIDE (1.2) so the drop
    // lands on the transition face. A HALFPIPE hang glues right on the launch
    // line (tiny inset) so you go straight up the vert axis and drop back onto
    // the SAME spot — no inward drift into the pipe, no funny landing.
    const inset = this.pipeHang ? 0.25 : 1.2;
    this.vertAnchor.copy(this.pos).addScaledVector(this.vertNormal, inset);
    this.vertAir = true;
  }

  // BASELINE CRUISE: while free-skating the board holds cruiseSpeed on its
  // own. Above it (a released charge, spent downhill speed) it settles back
  // down at chargeDecay; below it (a hill scrubbed you) the same rate eases
  // you back up. No assist on ground too steep to stand — pipes stay honest,
  // and the pull-back brake still cuts straight through to the dismount.
  private cruiseEase(dt: number, steep: boolean): void {
    const cruise = Math.min(TUNING.cruiseSpeed, TUNING.maxSpeed);
    if (this.speed > cruise) {
      this.speed = Math.max(cruise, this.speed - TUNING.chargeDecay * dt);
    } else if (!steep && this.grounded) {
      this.speed = Math.min(cruise, this.speed + TUNING.chargeDecay * dt);
    } else if (steep) {
      // No assist on transitions — and the old friction bleed stays, so a
      // sideways crawl on a wall dies out and the stall-flip can roll you
      // back into the pipe instead of parking you mid-face.
      this.frictionBleed(dt, steep);
    }
  }

  // FRICTION to a full stop, ease-out curve. Fires only when there is NO
  // input at all — the board coasts, then rolls to rest below cruise. The
  // bleed scales with current speed (fast up top, gentle as you settle) plus
  // a small floor so it actually reaches zero. friction 0 = frictionless.
  private frictionBleed(dt: number, steep: boolean): void {
    const s = Math.abs(this.speed);
    if (s < 1e-4) return;
    // steep ground keeps the flat linear bleed so the stall-flip fires cleanly
    let bleed = steep
      ? TUNING.friction * dt
      : TUNING.friction * dt * (0.35 + 0.65 * Math.min(1, s / Math.max(TUNING.maxSpeed, 1)));
    // Slick planks (icy sky-bridge boards): almost no friction, so you keep
    // sliding and can't stop short of the gap — the precision hazard.
    if (this.groundHit && this.groundHit.slippy) bleed *= CONST.slippyFriction;
    this.speed -= Math.sign(this.speed) * Math.min(bleed, s);
  }

  // -------------------------------------------------------------- rope swing --

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
      this.state = 'rope';
      this.ropeObj = rs;
      this.ropeD = d;
      this.ropeJumpArm = false; // the held X that jumped you here must come up first
      this.vVel = 0;
      this.speed = 0;
      this.charging = false;
      this.chargeTimer = 0;
      this.airJumpUsed = false; // a solid grip re-arms the double jump
      this.wallrideLatched = false;
      if (this.manualing !== 0) this.endManual();
      this.grabPhase = 'none';
      this.grabT = 0;
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
    // hands at the grip; the body dangles on the same line below them
    level.ropePointAt(rs, this.ropeD + 1.85, ROPE_P);
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
    this.airFromSkate = this.freeSkate; // the landing can flow into a manual
    this.vVel = jumpV + Math.max(0, ROPE_V.y * 0.9);
    // skating: the swing's planar momentum carries into the flight. On-foot
    // air is direct-drive, and the course frame is not ours to overwrite.
    const planar = Math.hypot(ROPE_V.x, ROPE_V.z);
    if (this.freeSkate && planar > 1.5) {
      this.axisF.set(ROPE_V.x / planar, 0, ROPE_V.z / planar);
      this.speed = Math.min(planar * 1.15, TUNING.downhillMax);
    }
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
      if (c.tnt) level.detonate(c, true);
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
    this.balanceCritT = 0;
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
    this.vertAir = false;
    this.pipeHang = false;
    this.vertLatVel = 0;
    // an air catch can arrive mid-grab or mid-spin — the stall absorbs both
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.grabSpinTotal = 0;
    this.endManual();
    this.balance = 0; // needle: + tips INTO the pipe (forgiving), − out the back (bail)
    this.balanceCritT = 0;
    this.lipAim(true); // pick the meter that reads true on screen for THIS wall
    this.rideNormal.set(0, 1, 0);
    this.score(CONST.ptsLip, 'Axle Stall');
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
    if (!this.vertAir || this.transferCoolT > 0) return false;
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
    this.hangPipe = target;
    this.transferCoolT = 0.3;
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
      this.vVel = TUNING.grindJumpForce * 0.6;
      sfx.play('ollie', 0.6);
    } else {
      sfx.play('skateTransition', 0.45);
    }
  }

  // Botched a grab landing: no death — you eat the floor, the pending combo
  // is gone, and you lie flat for a beat before getting up right where you
  // fell. (A mask upstream absorbs the bail entirely, same as before.)
  private bail(): void {
    this.bailDownT = CONST.bailDownTime;
    this.speed = 0;
    this.vVel = 0;
    this.invulnTimer = CONST.maskInvuln; // nothing chews you while you're down
    if (this.comboHasTrick && this.comboMult > 0) this.onComboBail(); // red shake + drop
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.comboHasTrick = false;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.grabSpinTotal = 0;
    sfx.play('takeDamage', 0.8);
    this.emitSparks(8, 0xffb545, 2);
  }

  private stepGrind(dt: number, input: Input, level: Level): void {
    const rail = this.grindRail!;
    this.grindTime += dt;
    level.grindRope(rail); // sky-bridge ropes: grinding one makes it sag, wobble, and eventually snap
    this.snapEase = Math.min(1, this.snapEase + dt / CONST.railSnapEase);
    // Grinds ride at the speed you brought and bleed a little on the rail
    // (nosegrinds hold their speed better).
    const bleed = this.grindStyle === 'nose' ? CONST.grindBleed * 0.4 : CONST.grindBleed;
    this.grindVel = Math.max(CONST.grindMinSpeed, this.grindVel - bleed * dt);
    // SLOPED RAILS: gravity works the grind line — descending segments feed
    // speed, climbs bleed it (the same knobs as ground slopes), capped like
    // any earned downhill. tangent.y IS sin(slope) on a unit tangent.
    const railSlope = rail.tangentAt(this.grindT).y * this.grindDir; // + = climbing
    if (Math.abs(railSlope) > 1e-3) {
      this.grindVel -= railSlope * (railSlope < 0 ? TUNING.slopeBoost : TUNING.uphillSlowdown) * dt;
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
    // boardslides look coolest and wobble hardest
    const styleWobble = this.grindStyle === 'board' ? 1.25 : 1;
    // Difficulty ramps with grind length: flat for balanceGrace seconds,
    // then grows at balanceRamp per second up to the balanceRampMax ceiling —
    // marathon grinds get dicey, never impossible.
    const ramp = Math.min(
      Math.max(0, TUNING.balanceRampMax - 1),
      Math.max(0, this.grindTime - TUNING.balanceGrace) * TUNING.balanceRamp,
    );
    const instability = TUNING.balanceDrift * (1 + ramp) * speedFactor * styleWobble;
    this.balance += Math.sign(this.balance || 1) * instability * dt;
    this.balance += this.rawInput.moveX * TUNING.balanceControl * dt;
    if (this.uberTimer > 0 || this.balanceBoostT > 0) this.balance = 0; // perfect balance
    if (Math.abs(this.balance) >= 1) {
      this.balance = Math.sign(this.balance); // pinned at the edge, flailing
      this.balanceCritT += dt;
      if (this.balanceCritT > TUNING.bailGrace) {
        // A mask absorbs the bail: the needle resets and the grind continues.
        if (this.spendMask()) {
          this.balance = 0;
          this.grindTime = 0;
          this.balanceCritT = 0;
        } else if (this.railUnder) {
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
          this.bailFromRail(Math.sign(this.balance || 1));
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
      this.exitGrind(this.underK > 0.5 ? 0.8 : 2.5); // from under, no pop up through the rail
      return;
    }

    this.placeOnRail(rail);
    this.speed = this.grindVel;
    this.surfaceName = this.grindStyle === 'normal' ? 'rail (50-50)' : 'rail (' + this.grindStyle + ')';
    // THPS accrual: the longer the grind, the more the combo is worth.
    this.grindTickT += dt;
    while (this.grindTickT >= 0.25) {
      this.grindTickT -= 0.25;
      this.comboPoints += CONST.ptsGrindTick;
      this.comboTimer = CONST.comboWindow;
    }
    this.groundHit = this.queryGround(level); // keeps the blob shadow honest
    if (this.underK < 0.5) this.emitSparks(1, 0xffb545, 1); // grind sparks off the truck (hands make no sparks)

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
      // from underneath, X lets go — a small drop away, never a pop up
      // through the rail overhead
      this.exitGrind(
        this.underK > 0.5
          ? 1.0
          : THREE.MathUtils.lerp(TUNING.grindJumpForce * 0.72, TUNING.grindJumpForce, t),
      );
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

  private tryGrind(): boolean {
    // A flopped bail can't grab a rail — the lip bail ejects you right over
    // the coping with Triangle still held, and snapping it would turn the
    // punishment into a free 50-50.
    if (this.regrindCd > 0 || this.bailDownT > 0 || !this.railCand) return false;
    // railCand was sampled at the START of this step; re-close on the CURRENT
    // position so a fast step snaps onto the point actually under our feet,
    // not where we were 1-2 units ago.
    const s = this.railCand.rail.closest(this.pos);
    if (s.distance > TUNING.railSnapDistance) return false;
    // Deck-level grabs are the normal case (rails sit ~1u above the deck);
    // only block grabbing from far beneath the rail.
    if (this.pos.y < s.point.y - 2.0) return false;
    this.enterGrind(this.railCand.rail, s);
    return true;
  }

  private enterGrind(rail: Rail, sample: RailSample): void {
    this.grindRail = rail;
    this.grindT = sample.t;
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
    this.grabSpinAngle = 0;
    this.grindTime = 0;
    // Grind style from the direction held at entry (THPS flavor):
    // up = nosegrind, down = 5-0, left/right = boardslide, none = 50-50.
    const rIn = this.rawInput;
    this.grindStyle =
      rIn.moveY > 0.4 ? 'nose' : rIn.moveY < -0.4 ? 'five0' : Math.abs(rIn.moveX) > 0.4 ? 'board' : 'normal';
    this.grindYawDir = rIn.moveX >= 0 ? 1 : -1;
    this.grindTickT = 0;
    this.railUnder = false; // every grind starts on top (the switch cooldown carries over)
    this.underK = 0;
    this.underProbeT = 0;
    // The trick is scored the moment you lock in — the rail then RACKS UP
    // points for as long as you hold it (see stepGrind), THPS-style.
    const styleMult =
      this.grindStyle === 'normal' ? 1 : this.grindStyle === 'board' ? 1.5 : 1.25;
    const styleName =
      this.grindStyle === 'normal'
        ? '50-50'
        : this.grindStyle === 'nose'
          ? 'Nosegrind'
          : this.grindStyle === 'five0'
            ? '5-0'
            : 'Boardslide';
    this.score(Math.round(CONST.ptsGrindBase * styleMult), styleName);
    // Start the needle slightly off-center in a random direction.
    this.balance = (Math.random() < 0.5 ? -1 : 1) * CONST.balanceStart;
    this.balanceCritT = 0;
    this.emitSparks(6, 0xffb545, 1.6); // landing-on-the-rail burst
    sfx.play('railLand', 0.8);
    // The rail keeps the speed you carried ALONG it — hit it fast and aligned
    // to cross fast; clip it sideways and you just barely creep across.
    this.grindVel = THREE.MathUtils.clamp(
      Math.abs(alongVel),
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

  private exitGrind(vVel: number): void {
    this.airFromSkate = true; // leaving a rail is a board air: tricks live

    if (this.grindRail) {
      // Exit ALONG the rail: the tangent becomes the free-skate heading, so
      // diagonal and curved rails launch you where they were pointing.
      const t = this.grindRail.tangentAt(this.grindT);
      const hx = t.x * this.grindDir;
      const hz = t.z * this.grindDir;
      const len = Math.hypot(hx, hz);
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
    this.grindRail = null;
    this.railUnder = false;
    this.state = 'air';
    this.airFromSkate = false;
    this.freeSkate = false; // the board is in pieces — whatever comes next is on foot
    this.speed = Math.max(1.5, this.grindVel * 0.4);
    this.vVel = -1.5;
    this.airMomentum = false;
    this.bailDownT = 0.9; // the tumble pose owns the fall + the landing lock
    this.boardSnapT = 1.7; // deck stays gone through the fall and the get-up
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
    this.balanceCritT = 0;
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    sfx.play('crunch', 0.9, 0.85); // the snap
    sfx.play('takeDamage', 0.7);
    this.emitSparks(10, 0xb08040, 2.2); // splinters off the broken deck
  }

  // Which way is the balance needle throwing us, and what's over there?
  // Steep ground or a real drop on the fall side = the transition ('vert'):
  // falling that way reads as dropping in, not crashing. Flat ground near
  // rail height = the deck/uphill side, where a fall is still a bail.
  private railFallSide(level: Level): 'vert' | 'deck' {
    const rail = this.grindRail;
    if (!rail) return 'deck';
    const t = rail.tangentAt(this.grindT);
    const hx = t.x * this.grindDir;
    const hz = t.z * this.grindDir;
    const hl = Math.hypot(hx, hz);
    if (hl < 1e-4) return 'deck';
    // screen-right of travel (same construction as axisL from axisF), flipped
    // to whichever side the needle pegged toward
    const side = Math.sign(this.balance || 1);
    const ox = (hz / hl) * side * 2.2;
    const oz = (-hx / hl) * side * 2.2;
    const probe = this.queryGround(level, ox, oz);
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
    const side = Math.sign(this.balance || 1);
    const fx = hx / hl + (hz / hl) * side * 0.9;
    const fz = hz / hl + (-hx / hl) * side * 0.9;
    const fl = Math.hypot(fx, fz) || 1;
    this.axisF.set(fx / fl, 0, fz / fl);
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.grindRail = null;
    this.state = 'air';
    this.airFromSkate = true; // still a board air: tricks live
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
  private bailFromRail(sideSign = 0): void {
    const rail = this.grindRail;
    if (sideSign !== 0 && rail) {
      const t = rail.tangentAt(this.grindT);
      const hx = t.x * this.grindDir;
      const hz = t.z * this.grindDir;
      const hl = Math.hypot(hx, hz) || 1;
      const fx = hx / hl + (hz / hl) * sideSign * 1.4;
      const fz = hz / hl + (-hx / hl) * sideSign * 1.4;
      const fl = Math.hypot(fx, fz) || 1;
      this.axisF.set(fx / fl, 0, fz / fl);
      this.axisL.set(this.axisF.z, 0, -this.axisF.x);
      this.speed = Math.abs(this.speed); // the new heading carries the fall
    }
    this.grindRail = null;
    this.state = 'air';
    this.airFromSkate = false; // a stumble is not a trick window
    this.vVel = 3;
    this.airMomentum = false; // a bail is a stumble, not a launch
    this.speed *= CONST.balanceBailSpeedKeep;
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
    this.balanceCritT = 0;
    sfx.play('takeDamage', 0.8);
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
    this.emitSparks(8, 0xffb545, 2);
  }

  // ------------------------------------------------------------------ spin --

  private updateSpin(dt: number, input: Input): void {
    const canSpin =
      this.state === 'ride' || this.state === 'air' || this.state === 'grind' || this.state === 'rope';
    if (input.spinPressed && !this.spinning && this.spinCd <= 0 && canSpin) {
      this.spinTimer = TUNING.spinDuration;
      sfx.play(['spin1', 'spin2', 'spin3'][Math.floor(Math.random() * 3)], 0.5);
      if (this.state === 'air' && this.vVel < 7) {
        // Tiny Crash-style stall. Never boosts an already-rising jump.
        this.vVel = Math.min(this.vVel + TUNING.spinAirCorrection, 7);
      }
      // SLIDE-SPIN CANCEL (Crash 4 rules): a spin timed to the slide's END —
      // its last beat, or the unresolved grace/get-up right after — wipes the
      // re-fire blockers, so slide -> spin -> slide chains on timing instead
      // of waiting out the cool-off. Spinning early in the slide cancels
      // nothing, and a slide JUMP's cooldown stays.
      const slideEnding = this.slideTimer > 0 && this.slideTimer <= CONST.slideSpinCancel;
      const slideJustEnded =
        this.slideTimer <= 0 && (this.slideEndPending || this.slideRecoverT > 0);
      if (slideEnding || slideJustEnded) {
        this.slideTimer = 0;
        this.slideEndPending = false;
        this.slideRecoverT = 0;
        this.slideCd = 0;
      }
    }
    if (this.spinTimer > 0) {
      this.spinTimer -= dt;
      const progress = 1 - Math.max(this.spinTimer, 0) / TUNING.spinDuration;
      this.spinAngle = progress * Math.PI * 2;
      if (this.spinTimer <= 0) {
        this.spinAngle = 0;
        this.spinCd = CONST.spinCooldown;
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

  private updateGrab(dt: number, input: Input): void {
    this.grabGraceTimer = Math.max(0, this.grabGraceTimer - dt);
    if (this.state === 'air') {
      // A grab needs a DIRECTION to start (the stick picks the variant): Circle
      // alone in the air does nothing, so braking with Circle off a lip doesn't
      // fire an accidental no-input grab. Once a grab is committed it holds even
      // if you re-center the stick.
      const grabActive = this.grabPhase === 'enter' || this.grabPhase === 'held';
      const grabDir = Math.abs(this.rawInput.moveX) > 0.3 || Math.abs(this.rawInput.moveY) > 0.3;
      // THPS AUTO-CORRECT: in the FINAL beat of a pipe-hang descent any live
      // rotation COMMITS — it completes to the nearest 180 before the wheels
      // touch, at whatever rate the time left demands (grabbing or not, stick
      // held or not). Where you visibly rotate to IS where you land.
      const committing =
        this.pipeHang &&
        this.vVel < 0 &&
        this.grabSpinAngle !== 0 &&
        (this.pos.y - this.vertAnchor.y) / Math.max(1, -this.vVel) < 0.25;
      const commitSpin = (dtc: number): void => {
        const target = Math.round(this.grabSpinAngle / Math.PI) * Math.PI;
        const d = target - this.grabSpinAngle;
        const tLeft = Math.max(0.06, (this.pos.y - this.vertAnchor.y) / Math.max(1, -this.vVel));
        const rate = Math.max(CONST.grabSnapRate, Math.abs(d) / (tLeft * 0.7));
        const step = rate * dtc;
        this.grabSpinAngle = Math.abs(d) <= step ? target : this.grabSpinAngle + Math.sign(d) * step;
      };
      if (input.grabHeld && !this.slamActive && this.airFromSkate && (grabActive || grabDir)) {
        // Reach into the pose over grabTransition, then hold it.
        if (this.grabPhase === 'none' || this.grabPhase === 'exit') {
          this.grabPhase = 'enter';
          this.grabT = 0;
          this.grabTrickName = 'Grab';
          this.grabTickT = 0;
          // Timed trick: register it NOW so the combo plate shows straight away
          // and ticks up while held (a botched landing bails the whole thing).
          this.score(CONST.ptsGrab, this.grabTrickName);
          sfx.play('woosh2', 0.4);
        } else if (this.grabPhase === 'enter') {
          this.grabT += dt;
          if (this.grabT >= CONST.grabTransition) this.grabPhase = 'held';
        }
        // Circle + left/right = grab-spin THAT way (left arrow spins left).
        // The trajectory is locked either way — but land mid-pose or off-axis
        // and you bail. In a pipe hang the final descent auto-corrects the
        // rotation so the grab lands on-axis.
        const gsp = this.spinStick();
        if (committing) {
          commitSpin(dt);
        } else if (gsp !== 0) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(gsp) * dt;
          this.grabSpinTotal += TUNING.grabSpinRate * dt;
        }
        // variant name for the combo readout
        this.grabTrickName =
          this.rawInput.moveY > 0.4
            ? 'Nosegrab'
            : this.rawInput.moveX < -0.4
              ? 'Melon'
              : this.rawInput.moveX > 0.4
                ? 'Indy'
                : this.grabTrickName;
        // THPS accrual: held grabs are worth more
        this.grabTickT += dt;
        while (this.grabTickT >= 0.25) {
          this.grabTickT -= 0.25;
          this.comboPoints += CONST.ptsGrabTick;
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
        // HANG-TIME SPIN: glued to the wall, the stick alone spins you — no grab
        // needed. HOLD toward either end of the coping (even the direction you
        // carved up with) to keep rotating; release to snap to the nearest 180
        // and land. A pipe hang never bails on this, and the final descent
        // auto-corrects (committing) so where you rotate to is where you land.
        const hsp = this.spinStick();
        if (committing) {
          commitSpin(dt);
        } else if (this.vertAir && !this.slamActive && hsp !== 0) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(hsp) * dt;
          this.grabSpinTotal += TUNING.grabSpinRate * dt;
        } else if (this.grabSpinAngle !== 0) {
          const target = Math.round(this.grabSpinAngle / Math.PI) * Math.PI;
          const d = target - this.grabSpinAngle;
          const step = CONST.grabSnapRate * dt;
          this.grabSpinAngle = Math.abs(d) <= step ? target : this.grabSpinAngle + Math.sign(d) * step;
        }
      }
    } else if (this.grabPhase !== 'none' || this.grabSpinAngle !== 0) {
      this.grabPhase = 'none';
      this.grabT = 0;
      // leaving the air by any other door (grind entry, slam): keep the
      // facing where the spin left it rather than snapping back
      this.visualYaw = wrapAngle(this.visualYaw + this.grabSpinAngle);
      this.grabSpinAngle = 0;
      this.grabSpinTotal = 0;
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

  // Ground dust/smoke kicked up by the baseball slide: pale, low, drifting out
  // behind the plant — floats and drags instead of arcing like a spark.
  private emitDust(count: number): void {
    const back = this.axisF.clone().multiplyScalar(-Math.sign(this.speed || 1));
    for (const s of this.sparks) {
      if (count <= 0) break;
      if (s.life > 0) continue;
      count--;
      s.dust = true;
      s.maxLife = 0.4 + Math.random() * 0.35;
      s.life = s.maxLife;
      (s.mesh.material as THREE.MeshBasicMaterial).color.setHex(0xd8cdb6); // pale dust
      s.mesh.visible = true;
      s.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * 0.7,
        this.pos.y + 0.06,
        this.pos.z + (Math.random() - 0.5) * 0.7,
      );
      s.vel
        .set((Math.random() - 0.5) * 1.4, 0.5 + Math.random() * 0.9, (Math.random() - 0.5) * 1.4)
        .addScaledVector(back, 0.8 + Math.random() * 1.6);
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
    const half = CONST.playerHalf;
    const center = new THREE.Vector3(this.pos.x, this.pos.y + half.y, this.pos.z);
    this.playerBox.setFromCenterAndSize(center, new THREE.Vector3(half.x * 2, half.y * 2, half.z * 2));
    this.feetBox.copy(this.playerBox);
    // On a rail the board and trucks hang BELOW the feet — reach down so
    // crates sitting on the rail line still clip a grinder.
    if (this.state === 'grind') this.playerBox.min.y -= 0.35;
    this.spinBox.copy(this.playerBox);
    if (this.spinning) {
      this.spinBox.expandByVector(new THREE.Vector3(CONST.spinReach, 0.2, CONST.spinReach));
    }

    for (const c of level.crates) {
      if (!c.alive || c.pending) continue; // outline ghosts: no collision at all
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
        // through it) pops it instantly — safely, it was on purpose. Stomping
        // lights the 3-2-1 fuse and bounces you; a headbutt from below lights
        // it too. Grinding into one unspun knocks you off the rail. Bumping
        // it is just a wall.
        if (this.spinning && this.spinBox.intersectsBox(c.box)) {
          level.detonate(c, true);
        } else if (this.playerBox.intersectsBox(c.box)) {
          if (this.uberTimer > 0 || this.sliding) {
            level.detonate(c, true);
          } else if (this.state === 'grind') {
            if (this.grindVel >= TUNING.smashSpeed || this.spendMask()) level.detonate(c, true);
            else this.bailFromRail();
          } else if (this.isStomping(c.box)) {
            if (this.slamActive) {
              level.detonate(c, true);
            } else {
              level.lightFuse(c);
              this.vVel = TUNING.crateBounce;
              this.pos.y = c.box.max.y + 0.02; // bounce OFF the lid, no re-intersect
              sfx.play('crateBounce', 0.7);
              this.state = 'air';
              this.grounded = false;
              this.bounceRefresh();
              this.charging = false;
              this.chargeTimer = 0;
            }
          } else if (this.isBonking(c.box)) {
            level.lightFuse(c);
            this.vVel = -1;
          } else {
            // Rolling into it on the board: a hard smash-speed hit pops it
            // outright (deliberate, safe — same bar as smashing crates); a
            // slower nudge just lights the 3-2-1 fuse and bumps like a wall.
            if (this.freeSkate && Math.abs(this.speed) >= TUNING.smashSpeed) {
              level.detonate(c, true);
              continue;
            }
            if (this.freeSkate && Math.abs(this.speed) > 1.5) level.lightFuse(c);
            this.pushOutOf(c.box);
          }
        }
        continue;
      }
      if (c.bouncy || c.metalBounce) {
        // Arrow crates: land on one for a super bounce. WOOD arrows break
        // like any box under a spin or body slam (and count for the gem);
        // METAL arrows are indestructible trampolines.
        // PERFECT BOUNCE: pressing X within arrowBoostWindow of the impact
        // (the classic "jump right at the bottom" timing) adds a little
        // extra launch — the press is consumed so it can't carry to chains.
        if (c.bouncy && this.spinning && this.spinBox.intersectsBox(c.box)) {
          this.smashCrate(level, c);
          continue;
        }
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.isStomping(c.box) && this.slamActive) {
            // Slam on WOOD breaks it. Slam on METAL cancels into a plain
            // bounce — clearing slamActive is load-bearing: without it the
            // slam's down-force re-stomps the trampoline every frame
            // (infinite Boing points with the controls locked).
            if (c.bouncy) {
              this.smashCrate(level, c);
            } else {
              this.slamActive = false;
              this.vVel = TUNING.arrowBounce;
              this.pos.y = c.box.max.y + 0.02;
              this.state = 'air';
              this.grounded = false;
              this.bounceRefresh();
              this.score(CONST.ptsBouncy, 'Boing');
              sfx.play('bouncyBounce', 0.9, 0.8);
            }
          } else if (this.isStomping(c.box)) {
            const perfect = this.jumpPressT > 0;
            this.jumpPressT = 0;
            this.vVel = TUNING.arrowBounce * (perfect ? TUNING.arrowBoostMult : 1);
            // snap to the lid: a deep stomp frame left the feet inside the
            // box, and the next rising frame would sideways-eject (the
            // no-input bounce drift). Bounce OFF the top, cleanly.
            this.pos.y = c.box.max.y + 0.02;
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
            this.charging = false;
            this.chargeTimer = 0;
            this.score(CONST.ptsBouncy * (perfect ? 2 : 1), perfect ? 'Perfect Boing' : 'Boing');
            sfx.play('bouncyBounce', 0.9, perfect ? 1.3 : 1);
            if (perfect) this.emitSparks(6, 0xfff3d0, 1.4);
          } else if (this.isBonking(c.box)) {
            this.vVel = -1; // head bonk on the underside
          } else {
            this.pushOutOf(c.box);
          }
        }
        continue;
      }
      if (c.bang) {
        // Metal '!' SWITCH: any real hit fires it — spin, stomp, headbutt,
        // slide, or a grind-through. It stays solid (bounce off the lid like
        // a box that refuses to break) and never counts toward the tally.
        if (this.spinning && this.spinBox.intersectsBox(c.box)) {
          level.triggerBang(c);
        } else if (this.playerBox.intersectsBox(c.box)) {
          if (this.isStomping(c.box)) {
            level.triggerBang(c);
            this.slamActive = false; // same anti-relock rule as the metal arrow
            this.vVel = TUNING.crateBounce;
            this.pos.y = c.box.max.y + 0.02;
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
            this.charging = false;
            this.chargeTimer = 0;
            sfx.play('crateBounce', 0.7);
          } else if (this.isBonking(c.box)) {
            level.triggerBang(c);
            this.vVel = -1;
          } else if (this.state === 'grind') {
            level.triggerBang(c); // grind-through flips it — no bail, no shove
          } else if (this.sliding || this.uberTimer > 0) {
            level.triggerBang(c);
            this.pushOutOf(c.box);
          } else {
            this.pushOutOf(c.box);
          }
        }
        continue;
      }
      if (this.spinning && this.spinBox.intersectsBox(c.box)) {
        this.smashCrate(level, c);
      } else if (this.playerBox.intersectsBox(c.box)) {
        if (this.uberTimer > 0 && !this.isStomping(c.box)) {
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
          else this.bailFromRail();
        } else if (this.isStomping(c.box)) {
          // Crash rules: landing on top breaks it and bounces you — high
          // enough to chain crate to crate. A slam punches straight through.
          this.smashCrate(level, c);
          if (!this.slamActive) {
            this.vVel = TUNING.crateBounce;
          sfx.play('crateBounce', 0.7);
            this.state = 'air';
            this.grounded = false;
            this.bounceRefresh();
          }
        } else if (this.isBonking(c.box)) {
          // Crash headbutt: jumping into a box from below breaks it.
          this.smashCrate(level, c);
          this.vVel = Math.min(this.vVel, 2);
        } else if (Math.abs(this.speed) >= TUNING.smashSpeed) {
          // Fast skating plows straight through plain crates — barely
          // breaking stride. TNT and nitro stay dangerous; this is only
          // the everyday wood.
          this.smashCrate(level, c);
          this.speed *= 0.92;
        } else {
          // Bumping does nothing to the crate — it's a wall. Full stop.
          this.pushOutOf(c.box);
        }
      }
    }

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
      for (const w of level.walls) {
        if (this.playerBox.intersectsBox(w)) {
          if (this.tryWallride(w)) break; // stuck to the wall — ride it
          if (this.tryLedgeGrab(w, level)) break; // caught its lip — hanging
          this.pushOutOf(w);
        } else if (
          // NEAR-MISS CATCH: a wall bonk shoves the body just clear of the
          // face and kills the arc's push (slide jumps steer-lock, so nothing
          // re-presses) — falling a hair off the face must still offer the
          // grab, or those jumps slide down 3cm out of reach forever.
          this.state === 'air' &&
          this.vVel <= 1.5 &&
          HANG_BOX.copy(this.playerBox).expandByScalar(0.14).intersectsBox(w) &&
          this.tryLedgeGrab(w, level)
        )
          break;
      }
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
      this.bailDownT <= 0 &&
      this.regrindCd <= 0
    ) {
      this.railBlock(level);
    }

    for (const cp of level.checkpoints) {
      if (level.runMode) break; // run modes have no checkpoints — the start IS the checkpoint
      if (cp.active) continue;
      if (this.spinning && this.spinBox.intersectsBox(cp.box)) {
        level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
        this.onCheckpoint();
      } else if (this.playerBox.intersectsBox(cp.box)) {
        if (this.sliding) {
          level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
          this.onCheckpoint();
        } else if (this.isStomping(cp.box)) {
          level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
          this.onCheckpoint();
          this.vVel = TUNING.crateBounce;
          this.pos.y = cp.box.max.y + 0.02; // bounce OFF the lid, no re-intersect
          sfx.play('crateBounce', 0.7);
          this.state = 'air';
          this.grounded = false;
          this.bounceRefresh();
        } else if (this.isBonking(cp.box)) {
          level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
          this.onCheckpoint();
          this.vVel = Math.min(this.vVel, 2);
        } else if (Math.abs(this.speed) >= TUNING.smashSpeed) {
          // Fast skating banks it on the way through, same as plain crates.
          level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
          this.onCheckpoint();
          this.speed *= 0.92;
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
      this.onRelic('CRYSTAL GET!', '');
    }

    // The trial stopwatch: touch it and the clock starts NOW.
    const ck = level.clockPickup;
    if (ck && !ck.collected && !this.ttActive && !this.comboRun && this.playerBox.intersectsBox(ck.box)) {
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
    if (orb && !orb.collected && !this.comboRun && !this.ttActive && this.playerBox.intersectsBox(orb.box)) {
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

    if (this.playerBox.intersectsBox(level.finishBox)) {
      this.bankCombo(); // whatever is pending counts at the line
      sfx.play('lifeGet', 1.0);
      this.state = 'finished';
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
    this.airborneT = 0;
    this.bounceJump = true;
  }

  private smashCrate(level: Level, c: Crate): void {
    level.breakCrate(c);
    // switches and metal never actually broke — no tally, no reward
    if (c.alive) return;
    if (!c.nitroBang) this.cratesBroken++; // green '!' sits outside the gem tally
    this.score(CONST.ptsCrate, 'Box');
    this.crateReward(c);
  }

  // What falls out of a broken box. Mystery crates roll their contents.
  private crateReward(c: Crate): void {
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
    if (c.mask) {
      this.gainMask();
    } else if (c.mystery) {
      const r = Math.random();
      if (r < 0.55) this.spawnFruit(c.box, 5);
      else if (r < 0.8) this.spawnFruit(c.box, 10);
      else if (r < 0.93) this.gainMask();
      else {
        this.lives++;
        sfx.play('lifeGet', 1.0);
        this.emitSparks(10, 0x9fe07a, 2);
      }
    } else {
      this.spawnFruit(c.box);
    }
  }

  // Central wumpa collection: 100 fruit converts into a life, Crash rules.
  private collectFruit(): void {
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

  // Wumpa burst: fruit pops out of the box, arcs, then homes to the player.
  private spawnFruit(box: THREE.Box3, n = CONST.fruitPerCrate): void {
    let count = n;
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const f of this.fruits) {
      if (count <= 0) break;
      if (f.age >= 0) continue;
      count--;
      f.age = 0;
      f.flung = false;
      f.mesh.visible = true;
      f.mesh.scale.setScalar(1);
      f.mesh.position.set(cx, cy + 0.3, cz);
      f.vel.set((Math.random() - 0.5) * 5, 6 + Math.random() * 4, (Math.random() - 0.5) * 5);
    }
  }

  // One already-earned wumpa (a touched ground pickup) launches from `pos`
  // and flies straight to the HUD counter — no crate-burst arc first.
  private flyFruit(pos: THREE.Vector3): void {
    for (const f of this.fruits) {
      if (f.age >= 0) continue;
      f.age = 0.36; // skip the arc, go straight to homing
      f.flung = false;
      f.mesh.visible = true;
      f.mesh.scale.setScalar(1);
      f.mesh.position.copy(pos);
      f.vel.set(0, 0, 0);
      return;
    }
    this.collectFruit(); // pool exhausted: count it instantly rather than lose it
  }

  private updateFruit(dt: number): void {
    for (const f of this.fruits) {
      if (f.age < 0) continue;
      f.age += dt;
      if (f.flung) {
        // smacked away by a spin: pure ballistic, then gone
        f.vel.y -= 26 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
        if (f.age > 0.9) {
          f.age = -1;
          f.mesh.visible = false;
        }
        continue;
      }
      if (f.age < 0.35) {
        // free arc out of the box
        f.vel.y -= 26 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
      } else {
        // home to the WUMPA COUNTER: the HUD icon sits top-left, so chase the
        // point that projects there — a few units out from the lens. The
        // fruit swells as it flies at the camera, shrinks into the counter,
        // and the tally ticks on ARRIVAL. (No camera = old skater homing.)
        const target = new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z);
        if (this.cam) {
          target
            .set(-0.85, 0.68, 0.5)
            .unproject(this.cam)
            .sub(this.cam.position)
            .normalize()
            .multiplyScalar(3.5)
            .add(this.cam.position);
        }
        // a spin still smacks fruit out of the air if it swings past the body
        if (this.spinning && this.spinBox.containsPoint(f.mesh.position)) {
          f.flung = true;
          f.age = 0;
          f.mesh.scale.setScalar(1);
          f.vel.set((Math.random() - 0.5) * 16, 8, (Math.random() - 0.5) * 16);
          sfx.play('fruitSpun', 0.7);
          continue;
        }
        const d = target.sub(f.mesh.position);
        const dist = d.length();
        if (dist < 0.55 || f.age > 2.5) {
          this.collectFruit(); // earned either way — a timeout never eats the fruit
          f.age = -1;
          f.mesh.visible = false;
          f.mesh.scale.setScalar(1);
          continue;
        }
        // shrink into the counter over the last stretch
        f.mesh.scale.setScalar(Math.min(1, dist / 1.4));
        // Home faster than the camera can flee (it rides the skater) — the
        // skater's own speed plus a margin, or a hard pull from far behind.
        const chase = Math.max(dist * 6, Math.abs(this.speed) + 14);
        f.mesh.position.addScaledVector(d.normalize(), chase * dt);
      }
    }
  }

  // Falling and our feet are near the target's top face = a stomp. The window
  // is deep enough that a max-speed fall can't step past it in one tick.
  private isStomping(box: THREE.Box3): boolean {
    return this.state === 'air' && this.vVel < 0 && this.pos.y > box.max.y - 0.75;
  }

  // Rising and our head is at the target's bottom face = a headbutt from below.
  private isBonking(box: THREE.Box3): boolean {
    return (
      this.state === 'air' &&
      this.vVel > 0 &&
      this.pos.y + CONST.playerHalf.y * 2 < box.min.y + 0.6
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
  private pushOutOf(box: THREE.Box3): void {
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
      if (ax === 'x') this.pos.x += step;
      else this.pos.z += step;
      return;
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
    if (axis === 'x') this.pos.x = dx > 0 ? minX - 0.01 : maxX + 0.01;
    else this.pos.z = dz > 0 ? minZ - 0.01 : maxZ + 0.01;

    // Head-on (heading mostly into the clamped face) = Crash full stop.
    const head = axis === 'x' ? Math.abs(this.axisF.x) : Math.abs(this.axisF.z);
    if (head > 0.6 && Math.abs(this.speed) > 0.1) {
      if (Math.abs(this.speed) > 18 && this.haltCd <= 0) {
        sfx.play('skateHalt', 0.7);
        this.haltCd = 0.5;
      }
      this.speed = 0;
    }
  }

  // THPS WALLRIDE — try to stick to a wall we've bumped into: must be airborne,
  // holding grind, off cooldown, moving fast enough, and within the wall's
  // height. The wall is a thin box; its NORMAL is the thin axis, the ride runs
  // along the long axis carrying your speed. Returns true if it grabbed.
  private tryWallride(w: THREE.Box3): boolean {
    if (
      this.state !== 'air' ||
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
    if (this.pos.y > w.max.y || this.pos.y + CONST.playerHalf.y * 2 < w.min.y) return false;

    const extX = w.max.x - w.min.x;
    const extZ = w.max.z - w.min.z;
    const alongZ = extX <= extZ; // thin in X → wall runs along Z (normal ±X); else along X
    // Outward normal: points from the wall face back toward the skater.
    const nx = alongZ ? (this.pos.x >= (w.min.x + w.max.x) / 2 ? 1 : -1) : 0;
    const nz = alongZ ? 0 : this.pos.z >= (w.min.z + w.max.z) / 2 ? 1 : -1;
    // APPROACH ANGLE: your flight has to run close to PARALLEL with the face —
    // the along-wall run vs the into-wall dive. Come in too head-on and you bonk
    // off it instead of sticking. The off-parallel limit is a slider.
    const along = alongZ ? Math.abs(vz) : Math.abs(vx);
    const into = alongZ ? -vx * nx : -vz * nz; // + = flying toward the face
    const approach = (Math.atan2(Math.abs(into), Math.max(0.001, along)) * 180) / Math.PI;
    if (approach > TUNING.wallrideMaxAngle) return false;

    if (alongZ) {
      this.wallNormal.set(nx, 0, 0);
      const tdir = Math.abs(vz) > 0.01 ? Math.sign(vz) : 1;
      this.axisF.set(0, 0, tdir);
      this.pos.x = (nx > 0 ? w.max.x : w.min.x) + nx * (CONST.playerHalf.x + 0.05);
    } else {
      this.wallNormal.set(0, 0, nz);
      const tdir = Math.abs(vx) > 0.01 ? Math.sign(vx) : 1;
      this.axisF.set(tdir, 0, 0);
      this.pos.z = (nz > 0 ? w.max.z : w.min.z) + nz * (CONST.playerHalf.z + 0.05);
    }
    this.axisL.set(this.axisF.z, 0, -this.axisF.x);
    this.wallSpeed = hspeed; // redirect full momentum along the wall
    this.speed = hspeed;
    this.wallBox = w;
    this.wallriding = true;
    this.wallrideLatched = true; // no second wallride until you land or grind
    this.wallrideT = TUNING.wallrideMaxTime;
    this.wallTickT = 0;
    this.wallChargeT = 0; // pump loads fresh on each wall
    this.score(CONST.ptsWallride, 'Wallride'); // timed trick: shows the combo plate straight away, then ticks up
    this.vVel = Math.max(this.vVel, 3); // a little upward pop as you catch the wall (ollie OUT with jump — the wallie)
    this.airFromSkate = true;
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
  private tryLedgeGrab(w: THREE.Box3, level: Level): boolean {
    if (
      (this.state !== 'ride' && this.state !== 'air') ||
      this.wallriding ||
      this.vertAir ||
      this.slamActive ||
      this.grabbing ||
      this.sliding ||
      this.crawling ||
      this.bailDownT > 0 ||
      this.ledgeCoolT > 0 ||
      this.comboRun || // a run lives on its combo — an auto-catch would bank it and fail the run
      this.rawInput.grindHeld // grind/wallride intent owns the wall
    )
      return false;
    // NOTE: a somersault (double jump) is NOT a blocker — the catch clears the
    // flip and the reach-and-grab clip owns the pose. Gating on it made every
    // double-jump approach silently ungrabbable (the whole point of the double
    // jump is reaching HIGHER ledges).
    const lipRough = w.max.y;
    const rise = lipRough - this.pos.y;
    if (this.state === 'ride') {
      // grounded: a chest-high-or-better step within reach
      if (rise < LEDGE_HANG_DEPTH + 0.2 || rise > TUNING.ledgeReach) return false;
    } else {
      // air: catches on DOWNWARD momentum only — the jump's rise always plays
      // out (no snag on the way up); once falling (or cresting), PROXIMITY of
      // the hands to the lip decides: anywhere from just-above-the-hands down
      // to full reach. The somersault is no blocker — the fall out of a double
      // jump is exactly when the higher ledges get caught.
      if (this.vVel > 1.5) return false; // still rising: let the jump finish
      if (rise < 0.7 || rise > TUNING.ledgeReach) return false;
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
    if (into < (this.state === 'ride' ? 0.65 : 0.2)) return false;
    // landing probe: standable ground just inside the face, near the lip
    const face = useX ? (nx > 0 ? w.max.x : w.min.x) : nz > 0 ? w.max.z : w.min.z;
    const px = useX
      ? face - nx * 0.45
      : THREE.MathUtils.clamp(this.pos.x, w.min.x + 0.1, w.max.x - 0.1);
    const pz = useX
      ? THREE.MathUtils.clamp(this.pos.z, w.min.z + 0.1, w.max.z - 0.1)
      : face - nz * 0.45;
    const ray = new THREE.Raycaster(new THREE.Vector3(px, lipRough + 1.6, pz), LEDGE_DOWN, 0, 2.6);
    const hits = ray.intersectObjects(level.groundMeshes, false);
    if (hits.length === 0) return false;
    const lip = hits[0].point.y;
    if (lip < lipRough - 0.05 || lip > lipRough + 0.75) return false; // no walkable top at the lip = not a ledge
    // it's a ledge — commit the catch (position settles in stepHang's ease)
    this.ledgeNormal.set(nx, 0, nz);
    this.ledgeLip = lip;
    this.ledgeBox = w;
    const skin = (useX ? CONST.playerHalf.x : CONST.playerHalf.z) + 0.06;
    this.ledgeAnchor.set(
      useX ? face + nx * skin : THREE.MathUtils.clamp(this.pos.x, w.min.x + 0.3, w.max.x - 0.3),
      lip - LEDGE_HANG_DEPTH,
      useX ? THREE.MathUtils.clamp(this.pos.z, w.min.z + 0.3, w.max.z - 0.3) : face + nz * skin,
    );
    // SEAM GUARD: on multi-box structures, a face can sit flush against a
    // neighboring solid — never ease the body into the neighbor's interior
    for (const other of level.walls) {
      if (other !== w && other.containsPoint(this.ledgeAnchor)) return false;
    }
    this.ledgeFrom.copy(this.pos);
    this.ledgeEaseT = 0;
    this.ledgePhase = 'grip';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.ledgeAwayT = 0;
    this.ledgeShimmy = 0;
    // NOTE: axisF/axisL are the CONTROL FRAME (stick -> world), owned by the
    // zone/lane system — the hang must never rotate them (that scrambles the
    // controls after you let go). Facing the wall is visualYaw, in stepHang.
    this.state = 'hang';
    this.ledgeT = TUNING.ledgeGrabTime;
    this.speed = 0;
    this.vVel = 0;
    this.grounded = false;
    this.charging = false;
    this.chargeTimer = 0;
    this.airFromSkate = false;
    this.spinTimer = 0;
    this.spinAngle = 0;
    this.flipTimer = 0;
    this.teetering = false;
    this.airJumpUsed = false; // a grip is solid contact: the double jump re-arms
    this.wallrideLatched = false;
    this.setHangClip('catch', 0.45); // the reach-and-grab plays over the settle
    if (this.manualing !== 0) this.endManual();
    this.bankCombo(); // a clean catch banks the pending string, like a landing
    sfx.play('ledgeGrab', 0.7, 1);
    this.emitDust(2);
    return true;
  }

  // Hanging off a ledge. The hang owns the whole step (no physics/collide).
  // GRIP phase: X (or up + X) starts the CLAMBER; holding the stick AWAY
  // from the ledge for a beat lets go (hop down — no button needed); the
  // grip fails when the timer runs out. CLIMB phase: a committed, animated
  // pull-up-and-over — the body eases up the face, then over the lip along
  // a rounded corner, ending stood on the landing. Stick reading: moveY +1
  // is screen-UP (same convention as the movement + manual-flick code).
  private stepHang(dt: number, input: Input, level: Level): void {
    this.runTime += dt;
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
      // read fine — so pick stick-right by the frame's current owner.
      const rSgn = this.freeSkate ? -1 : 1;
      const sx = rSgn * this.axisL.x * this.rawInput.moveX + this.axisF.x * this.rawInput.moveY;
      const sz = rSgn * this.axisL.z * this.rawInput.moveX + this.axisF.z * this.rawInput.moveY;
      const tx = n.z; // ledge tangent (horizontal, perpendicular to the normal)
      const tz = -n.x;
      const shim = THREE.MathUtils.clamp(sx * tx + sz * tz, -1, 1);
      const away = sx * n.x + sz * n.z;
      this.ledgeShimmy += ((Math.abs(shim) > 0.25 ? shim : 0) - this.ledgeShimmy) * Math.min(1, 12 * dt);
      // clip selection: the catch hands off to the idle loop; shimmying swaps
      // in the hand-over-hand traverse for that direction
      if (this.hangClipName === 'catch' && this.hangClipT >= HANG_ANIMS.catch.dur) this.setHangClip('idle', 0, true);
      if (this.hangClipName !== 'catch') {
        if (Math.abs(shim) > 0.25) this.setHangClip(shim > 0 ? 'shimmyR' : 'shimmyL', 0, true);
        else this.setHangClip('idle', 0, true);
      }
      if (Math.abs(shim) > 0.25 && this.ledgeEaseT >= LEDGE_EASE) {
        // sidle along the lip — never past the corners, and only where the
        // landing probe still finds a standable lip (re-probed as you move)
        const w = this.ledgeBox;
        const step = shim * 2.4 * dt;
        let ax = this.ledgeAnchor.x + tx * step;
        let az = this.ledgeAnchor.z + tz * step;
        if (w) {
          if (tx !== 0) ax = THREE.MathUtils.clamp(ax, w.min.x + 0.3, w.max.x - 0.3);
          else az = THREE.MathUtils.clamp(az, w.min.z + 0.3, w.max.z - 0.3);
          const ppx = n.x !== 0 ? (n.x > 0 ? w.max.x : w.min.x) - n.x * 0.45 : ax;
          const ppz = n.x !== 0 ? az : (n.z > 0 ? w.max.z : w.min.z) - n.z * 0.45;
          const ray = new THREE.Raycaster(new THREE.Vector3(ppx, w.max.y + 1.6, ppz), LEDGE_DOWN, 0, 2.6);
          const hits = ray.intersectObjects(level.groundMeshes, false);
          const lip = hits.length > 0 ? hits[0].point.y : NaN;
          if (lip >= w.max.y - 0.05 && lip <= w.max.y + 0.75) {
            this.ledgeAnchor.x = ax;
            this.ledgeAnchor.z = az;
            this.ledgeLip = lip;
            this.ledgeAnchor.y = lip - LEDGE_HANG_DEPTH; // hands track the surface
          }
        }
      }
      this.pos.lerpVectors(this.ledgeFrom, this.ledgeAnchor, k * k * (3 - 2 * k));
      // actively shimmying holds the grip (you're re-setting your hands) —
      // only an idle hang runs the timer out
      if (Math.abs(shim) <= 0.25) this.ledgeT -= dt;
      const pullingAway = away > 0.55;
      this.ledgeAwayT = pullingAway ? this.ledgeAwayT + dt : 0;
      if (input.jumpPressed) {
        if (pullingAway) this.ledgeHopDown();
        else this.startLedgeClimb(); // plain X, or toward/up + X
      } else if (this.ledgeAwayT > 0.1) {
        this.ledgeHopDown(); // held away: let go (the debounce eats stick noise at the catch)
      } else if (this.ledgeT <= 0) {
        this.ledgeLetGo(); // the grip gave out
      }
    }
    // bookkeeping the main step normally does (velocity measure + prevPos)
    this.lastVelX = (this.pos.x - this.prevPos.x) / Math.max(dt, 1e-4);
    this.lastVelZ = (this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.lastPlanar = Math.hypot(this.lastVelX, this.lastVelZ);
    this.prevPos.copy(this.pos);
  }

  // Commit the clamber: aim the path at the landing spot — inward past the
  // lip, clamped into the solid's footprint so even a thin wall's top works.
  private startLedgeClimb(): void {
    const n = this.ledgeNormal;
    const w = this.ledgeBox;
    const alongX = n.x !== 0;
    const face = w ? (alongX ? (n.x > 0 ? w.max.x : w.min.x) : n.z > 0 ? w.max.z : w.min.z) : alongX ? this.pos.x : this.pos.z;
    const depth = w ? (alongX ? w.max.x - w.min.x : w.max.z - w.min.z) : 2;
    const inward = Math.min(0.4, Math.max(0.1, depth * 0.5 - 0.05)); // never past the far side
    this.ledgeClimbFrom.copy(this.pos);
    this.ledgeClimbTo.set(
      alongX ? face - n.x * inward : this.pos.x,
      this.ledgeLip + 0.06,
      alongX ? this.pos.z : face - n.z * inward,
    );
    this.ledgePhase = 'climb';
    this.ledgeClimbT = 0;
    this.ledgeClimbK = 0;
    this.setHangClip('climb', Math.max(0.12, TUNING.ledgeClimbTime)); // clip time-fits the clamber
    sfx.play('ollie', 0.4, 1.15);
    this.emitDust(2);
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
      this.wallCoolT = 0.35;
      this.state = 'air';
      this.airFromSkate = true;
      sfx.play('ollie', 0.6 + 0.4 * charge, 1 - 0.15 * charge); // deeper/louder the more you loaded it
      sfx.play('woosh2', 0.7);
      this.emitSparks(6 + Math.round(charge * 8), 0xffd0a0, 1.2);
      return;
    }

    this.vVel -= TUNING.wallrideGravity * dt;
    if (this.vVel < -CONST.maxFallSpeed) this.vVel = -CONST.maxFallSpeed;
    this.wallSpeed = Math.max(0, this.wallSpeed - TUNING.wallrideFriction * dt);
    this.speed = this.wallSpeed;
    this.pos.addScaledVector(this.axisF, this.wallSpeed * dt);
    this.pos.y += this.vVel * dt;
    this.wallrideT -= dt;
    // THPS accrual: the longer the wallride, the more the combo is worth.
    this.wallTickT += dt;
    while (this.wallTickT >= 0.25) {
      this.wallTickT -= 0.25;
      this.comboPoints += CONST.ptsWallrideTick;
      this.comboTimer = CONST.comboWindow;
    }
    this.emitSparks(1, 0xffd0a0, 0.7); // trail of sparks off the trucks

    let off = false;
    if (w) {
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
      this.pos.y = hit.y;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.rideNormal.copy(hit.normal);
      this.airMomentum = true; // keep the speed on touchdown
      this.wallriding = false;
      this.wallCoolT = 0.2;
      return;
    }

    // Ends only when you ollie off (handled above), run out of air-time, stall,
    // or run off the wall — NOT when you let go of grind.
    if (this.wallrideT <= 0 || this.wallSpeed < 1 || off) {
      this.wallriding = false;
      this.wallCoolT = 0.35;
      this.state = 'air';
      this.airFromSkate = true;
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
      const s = rail.closestXZ(this.pos);
      if (s.distXZ > reach) continue;
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
      if (skating && Math.abs(this.speed) >= TUNING.railTripSpeed) {
        this.bail(); // caught a truck: go down (non-lethal), speed killed, knocked flat
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
      const lo = Math.min(hp.l0, hp.l1) - 0.5;
      const hi = Math.max(hp.l0, hp.l1) + 0.5;
      if (along < lo || along > hi) continue;
      const now = hp.project(hp.crossCoord(this.pos.x, this.pos.z), this.pos.y);
      if (!now || now.pen <= 0) continue; // in open air above the curve
      if (now.pen > hp.radius * 0.8) continue; // buried deep: not a this-step crossing
      const prev = hp.project(hp.crossCoord(this.prevPos.x, this.prevPos.z), this.prevPos.y);
      if (prev && prev.pen > 0.08) continue; // was already inside the material: came from behind
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

  private queryGround(level: Level, ox = 0, oz = 0): GroundHit | null {
    this.raycaster.set(new THREE.Vector3(this.pos.x + ox, this.pos.y + 2.5, this.pos.z + oz), DOWN);
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    if (hits.length === 0) return null;
    // A plank that's already breaking away (fall/gone) is no longer solid — skip
    // it so a grinder/stander drops straight through instead of riding it down.
    let hit = null as (typeof hits)[number] | null;
    for (const h of hits) {
      const cid = h.object.userData.crumbleId as number | undefined;
      if (cid !== undefined) {
        const c = level.crumbles[cid];
        if (c && (c.state === 'fall' || c.state === 'gone')) continue;
      }
      hit = h;
      break;
    }
    if (!hit) return null;
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
      name: hit.object.name,
      moverId: hit.object.userData.moverId as number | undefined,
      crumbleId: hit.object.userData.crumbleId as number | undefined,
      slippy: hit.object.userData.slippy as boolean | undefined,
      halfpipe: hp,
    };
  }

  // Long-range floor probe under the player — shadow/landing indicator only,
  // never gameplay (queryGround stays short so ground-follow is unchanged).
  private queryShadowGround(level: Level): number | null {
    this.raycaster.set(new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z), DOWN);
    this.raycaster.far = 120;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    return hits.length > 0 ? hits[0].point.y : null;
  }

  private syncVisual(input: Input, dt: number): void {
    this.group.position.copy(this.pos);

    // Chunky little carve lean; on a rail, the lean IS the balance needle.
    const targetLean =
      this.state === 'grind'
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
    this.group.rotation.set(0, Math.PI, this.lean + wobble);

    // UNIFIED SURFACE ALIGNMENT: the wall is the new ground. The whole rig
    // lays onto the surface normal — gently on banks, flat-out (~90°) on vert
    // walls — the SAME quaternion while riding the transition AND while glued
    // in hang time, so lip → hang → drop-in has no snap. Spins (bodyGroup yaw)
    // then run about the rig's own up = the surface normal, THPS-style.
    let alignT = 0;
    let targetN: THREE.Vector3 | null = null;
    const onPipeVis = this.groundHit !== null && this.groundHit.name.startsWith('halfpipe');
    if (this.vertAir) {
      alignT = 1; // hang time: fully on the wall plane
      targetN = this.vertNormal;
    } else if (this.grounded && this.state === 'ride' && this.groundHit) {
      // steepness-weighted: upright at/above steepStand, fully lying by ~vert.
      // On the HALFPIPE the board lays FLUSH on the transition much sooner (and
      // stays flush all the way up) so it hugs the full curve of the vert as you
      // climb instead of standing too upright and clipping the wall. rideNormal
      // is the exact analytic normal, so the fit is seamless.
      const flatY = TUNING.steepStand;
      const vertY = onPipeVis ? 0.72 : 0.25; // pipe: reach flush by a ~45° wall
      const t = THREE.MathUtils.clamp((flatY - this.rideNormal.y) / (flatY - vertY), 0, 1);
      alignT = t * t * (3 - 2 * t); // smoothstep
      targetN = this.rideNormal;
    }
    // Track the changing wall angle FAST on the pipe so the board hugs the curve
    // as you climb (the slow general ease lagged behind and let the board clip).
    const alignEase = onPipeVis || this.pipeHang ? 24 : 12;
    this.alignPose += (alignT - this.alignPose) * Math.min(1, alignEase * dt);
    if (targetN) {
      this.alignNormal.lerp(targetN, Math.min(1, alignEase * dt));
      if (this.alignNormal.lengthSq() < 1e-6) this.alignNormal.copy(targetN);
      this.alignNormal.normalize();
    }
    if (this.alignPose > 0.001) {
      VERT_Q.setFromUnitVectors(VERT_UP, this.alignNormal);
      VERT_Q2.identity().slerp(VERT_Q, this.alignPose);
      this.group.quaternion.premultiply(VERT_Q2);
    }

    // The body ALWAYS faces its actual travel direction — riding, grinding,
    // sidestepping, and mid-air drift all turn the model, Crash-style.
    // Movement itself never leaves the course axes; this is purely visual.
    let targetYaw = this.visualYaw; // stationary: keep facing the last direction
    const vx = this.pos.x - this.prevPos.x;
    const vz = this.pos.z - this.prevPos.z;
    if (vx * vx + vz * vz > (1.5 * dt) * (1.5 * dt)) {
      targetYaw = wrapAngle(Math.atan2(vx, vz) - Math.PI);
    }
    this.visualYaw += wrapAngle(targetYaw - this.visualYaw) * Math.min(1, 14 * dt);
    // Stance is a 90° body turn: regular faces one side of the board,
    // switch faces the other (that's the whole difference — the board and
    // travel don't care). sidePose blends it in; the board counter-rotates
    // below so the deck stays along the line of travel.
    const sideYaw = this.stance * (Math.PI / 2) * this.sidePose;
    this.bodyGroup.rotation.y =
      this.visualYaw + this.spinAngle + this.grabSpinAngle + this.grindYawPose + sideYaw;

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
      Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
    const runningAnim = onFoot && planar > 1.5;
    this.walkAmp += ((runningAnim ? 1 : 0) - this.walkAmp) * Math.min(1, 10 * dt);
    this.idleAmp += ((onFoot && !runningAnim ? 1 : 0) - this.idleAmp) * Math.min(1, 6 * dt);
    if (runningAnim) this.walkPhase += (4 + planar * 1.0) * dt;
    else if (this.crawling && planar > 0.5) this.walkPhase += (2 + planar * 0.8) * dt;
    // Circle-hold splits by motion (the reference does): standing still is a
    // compact upright SQUAT; the all-fours crawl only takes over once she
    // actually moves.
    const crawlMove = this.crawlPose * Math.min(1, planar / 1.2);
    const crouchW = Math.max(0, this.crawlPose - crawlMove);
    // Grind style lean: nose down, tail down, or body across the rail.
    const gp =
      this.state === 'grind' ? (this.grindStyle === 'nose' ? 0.4 : this.grindStyle === 'five0' ? -0.45 : 0) : 0;
    this.grindPoseX += (gp - this.grindPoseX) * Math.min(1, 12 * dt);
    const gy = this.state === 'grind' && this.grindStyle === 'board' ? this.grindYawDir * (Math.PI / 2) : 0;
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
    const onBoard =
      this.grounded &&
      this.state === 'ride' &&
      this.grabPose < 0.05 &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      (this.freeSkate ||
        Math.abs(this.speed) > TUNING.boardSpeed ||
        (this.charging && Math.abs(this.speed) > TUNING.walkSpeed + 0.5));
    this.skatePose += ((onBoard ? 1 : 0) - this.skatePose) * Math.min(1, 10 * dt);
    const sk = this.skatePose;
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
      (this.state === 'grind' && this.grindStyle !== 'board') ||
      (this.state === 'air' && this.airFromSkate && !this.grabbing && !this.slamActive && this.grabPose < 0.3);
    this.sidePose += ((sideOn ? 1 : 0) - this.sidePose) * Math.min(1, 8 * dt);
    // Deck-stand: any time the board is glued under the feet — rolling, plain
    // skate airs, every grind (boardslides included) — the legs shorten by the
    // deck's height so the soles ride ON the grip instead of through it.
    const deckOn = sideOn || this.state === 'grind';
    this.deckPose += ((deckOn ? 1 : 0) - this.deckPose) * Math.min(1, 10 * dt);
    // Crash star jump: legs split wide, arms thrown up — held for a beat
    // after crouch/slide jumps, fading the moment you land.
    if (this.state !== 'air') this.starTimer = 0;
    else this.starTimer = Math.max(0, this.starTimer - dt);
    this.starPose += ((this.starTimer > 0 ? 1 : 0) - this.starPose) * Math.min(1, 14 * dt);
    const star = this.starPose;
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
      this.legR.position.set(0.115 + 0.02 * sk * fw + 0.16 * deck * sp, 0, 0.24 * sk * stz * fw);
      this.legL.position.set(-0.115 - 0.02 * sk * fw - 0.16 * deck * sp, 0, -0.2 * sk * stz * fw);
      this.legR.rotation.y = 0.12 * sk * stz * fw - 0.12 * stz * sp;
      this.legL.rotation.y = -0.09 * sk * stz * fw - 0.12 * stz * sp;
      this.legR.rotation.z = -1.05 * star; // straddle split
      this.legL.rotation.z = 1.05 * star;
    }
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
      // the deck — on the board it eases down to a shallow athletic bend
      // (the matching legs.scale term keeps the soles pinned to the grip)
      const chargeBend = 0.85 * this.chargePose * (1 - 0.6 * sk);
      const stanceR = 0.7 * sk + 0.5 * this.grindArmPose + chargeBend; // front leg
      const stanceL = 0.5 * sk + 0.5 * this.grindArmPose + chargeBend; // back leg
      this.kneeR.rotation.x = straight * (stanceR + tuck + backR + frontR + 0.35 * this.slidePose) + 0.38 * underW + (HS ? HS.kneeR * 0.65 * HS.w : ledgeW * (0.5 - dangle) + 0.8 * mantle);
      this.kneeL.rotation.x = straight * (stanceL + tuck + backL + frontL + 1.0 * this.slidePose) + 0.38 * underW + (HS ? HS.kneeL * 0.65 * HS.w : ledgeW * (0.62 + dangle) + 0.95 * mantle); // hang shins: clip or authored
      this.legR.rotation.x -= straight * 0.5 * stanceR;
      this.legL.rotation.x -= straight * 0.5 * stanceL;
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
          (this.state === 'grind' && this.grindStyle !== 'board' ? 0.45 * this.stance : 0)) *
          fwS -
        0.35 * this.stance * this.sidePose;
      const counter = -swing * 0.22 + 0.1 * Math.sin(this.runTime * 0.7) * idleW; // idle: lazy shoulder wander
      this.upperG.rotation.y +=
        (stance + counter - this.upperG.rotation.y) * Math.min(1, 10 * dt);
      // Crash runs chest-out, almost leaning BACK — never hunched forward.
      // Hanging, the chest presses gently toward the wall instead.
      this.upperG.rotation.x = -0.07 * this.walkAmp - 0.12 * underW + (HS ? HS.spine * 0.7 * HS.w : 0.16 * ledgeW + 0.5 * mantle); // hang chest: clip or authored
    }
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
    // Tail + ponytail follow-through: the kangaroo signature. The tail
    // counter-swings the run, flares up through airs and grabs for balance,
    // and tucks low on all fours; the ponytail bobs against the same beat.
    if (this.tailChain.length > 0) {
      const lift =
        0.45 * this.hangPose -
        0.3 * ledgeW + // dangling: the tail hangs, no counterweight to hold
        0.5 * this.grabPose +
        0.3 * this.grindArmPose +
        0.3 * sk + // rolling: swing clear of the deck
        -0.45 * crawlMove - // crawling: counter the body pitch so the tail trails LEVEL behind
        0.15 * crouchW +
        0.25 * this.walkAmp + // running: the tail streams out behind, counterweight up
        0.35 * jp; // jumping: the tail flares as the counterweight
      const wag = 0.16 * breathe + 0.5 * swing;
      // Each joint carries its rest angle in userData (authored chunks bake
      // the curve, so theirs is 0) plus a share of the flex — decaying lift
      // toward the tip, and a wag that travels down the chain slightly
      // delayed, so sways whip instead of rotating rigidly.
      const liftW = [0.5, 0.3, 0.2, 0.14, 0.1];
      const wagW = [0.35, 0.3, 0.25, 0.2, 0.16];
      const lag = Math.sin(this.walkPhase - 0.9) * 0.65 * Math.max(this.walkAmp, crawlMove * 0.6);
      const wagLag = 0.16 * breathe + 0.5 * lag;
      this.tailChain.forEach((j, i) => {
        const rest = (j.userData.rest as number | undefined) ?? 0;
        const w = i < 2 ? wag : wagLag; // tip half follows a beat behind
        j.rotation.set(rest + lift * (liftW[i] ?? 0.1), w * (wagW[i] ?? 0.15), i === 0 ? 0.05 * breathe : 0);
      });
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
    const critFlail = this.balanceCritT > 0 ? Math.sin(this.runTime * 22) * 0.8 : 0;
    // Only GRINDS tip the spread arms sideways with the needle — a manual's
    // needle is fought in pitch (see manualPitch), so its arms stay symmetric.
    const railBal = this.state === 'grind' ? this.balance : 0;
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
        1.15 * this.grindArmPose * (1 + 0.6 * railBal) + // balance arms out wide (grinds tip them sideways; manual balance lives in the PITCH instead)
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
        1.15 * this.grindArmPose * (1 - 0.6 * railBal) -
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
    // Knees up: legs shorten toward the hips while the body crouches deep,
    // and the board comes up with them, into the grabbing hand.
    if (this.legs) {
      // knees pull up to the chest — for the grab tuck and the flip tuck —
      // fold deeper through a rolling charge crouch so the feet stay planted
      // on the deck, tuck under the hips on all fours, and bend through the
      // slide — never poking through the floor.
      this.legs.scale.y = Math.max(
        0.15,
        1 -
          0.22 * this.deckPose * (1 - this.wallridePose) - // stand ON the deck top, not through it (wallride keeps its own tuck)
          0.1 * this.chargePose * this.skatePose - // absorbs the pump's shallow knee bend so the feet stay planted
          0.5 * this.grabPose -
          0.4 * flipTuck -
          0.45 * this.crawlPose -
          0.25 * this.slidePose -
          0.28 * this.wallridePose - // knees bent tucking the board onto the wall
          0.4 * this.wallChargePose, // sink deeper the more you pump the launch
      );
    }
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
      // On foot the board is stowed — it only comes out for real skating:
      // grinding, momentum-skate mode, grabs, speed above the boardSpeed
      // slider, or a charge that's actually propelling past walking pace. A
      // stationary jump crouch or a walk-hop tap never flashes the board.
      // A walk-slide air (slideFromWalk) NEVER shows the board: it lands
      // back on feet, and the slide-jump burst can carry past boardSpeed for
      // seconds on a long drop — the board popping out mid-fall reads as
      // "my slide turned into skating".
      this.boardG.visible =
        this.slideTimer <= 0 &&
        this.starPose < 0.4 && // stowed through the star-jump beat
        this.ledgePose < 0.3 && // stowed while hanging off a ledge (hands are busy)
        (this.state === 'grind' ||
          (this.charging && Math.abs(this.speed) > TUNING.walkSpeed + 0.5) ||
          this.freeSkate ||
          this.grabPose > 0.05 ||
          (Math.abs(this.speed) > TUNING.boardSpeed && !this.slideFromWalk));
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
    this.bodyGroup.rotation.z = this.slopeRoll + wallRoll;
    if (this.boardG) {
      // Roll the deck a quarter-turn onto its edge so the WHEELS meet the wall
      // (deck faces out), and press it against the face up at the rider's feet.
      this.boardG.rotation.z = this.wallridePose * -wallSide * (Math.PI / 2);
      this.boardG.position.x = this.wallridePose * wallSide * 0.62; // flush to the wall
      this.boardG.position.y += this.wallridePose * 0.34; // up to foot height
      // UNDER-RAIL HANG: the deck leaves the feet and goes CROSSWISE overhead,
      // gripped at both ends — riding just beneath the rail line.
      if (underW > 0.001) {
        this.boardG.rotation.x *= 1 - underW;
        this.boardG.rotation.z *= 1 - underW;
        this.boardG.rotation.y = this.boardG.rotation.y * (1 - underW) + (Math.PI / 2) * underW;
        this.boardG.position.x *= 1 - underW;
        this.boardG.position.y += underW * 1.05; // up into both hands, just beneath the line
        this.boardG.visible = true; // the grip IS the board — always shown while under
      }
      if (this.boardSnapT > 0) this.boardG.visible = false; // snapped: no deck until the get-up ends
    }
    if (this.upperG) this.upperG.rotation.z = this.grabRoll * this.grabPose;
    // Mask hovers at the shoulder; the whole body flickers during
    // mask-invulnerability grace.
    this.bodyGroup.visible =
      this.invulnTimer <= 0 || Math.sin(this.runTime * 45) > -0.2 || this.state === 'dead';
    // Spin smear: swap the skater for the whirlwind while the attack runs.
    // Held poses, not a smooth turn: a new angle every 2 frames (30Hz), each
    // step ~137° so consecutive holds never look alike — reads as a strobing
    // cartoon blur, exactly like Crash's tornado frames.
    if (this.smearG) {
      const smearOn =
        this.spinning && !this.bailing && this.state !== 'dead' && this.state !== 'gameover';
      this.smearG.visible = smearOn && this.bodyGroup.visible; // inherit the invuln flicker
      if (smearOn) {
        this.bodyGroup.visible = false;
        const step = Math.floor(this.runTime * 30);
        this.smearG.rotation.y = step * 2.399; // golden angle
        const pulse = 1 + 0.09 * Math.sin(step * 1.7);
        this.smearG.scale.set(1.84 * pulse, 1.52 * (2 - pulse), 1.84 * pulse); // opposing squash
      }
    }
    if (this.maskMesh) {
      this.maskMesh.visible = (this.masks > 0 || this.uberTimer > 0) && this.state !== 'dead';
      this.maskMesh.position.set(
        this.pos.x + 1.0,
        this.pos.y + 1.7 + Math.sin(this.runTime * (this.uberTimer > 0 ? 9 : 3)) * 0.09,
        this.pos.z + 0.2,
      );
      if (this.uberTimer > 0) {
        // third-mask frenzy: the mask spins and pulses for the whole ride
        this.maskMesh.rotation.y += 8 * dt;
        this.maskMesh.scale.setScalar(1.35 + Math.sin(this.runTime * 10) * 0.15);
      } else {
        this.maskMesh.rotation.y = 0;
        this.maskMesh.scale.setScalar(this.masks >= 2 ? 1.25 : 1);
      }
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
    const dropping =
      (this.slamActive && this.slamHangT <= 0) || this.slamFlatT > 0 || this.bailDownT > 0;
    this.hangPose += ((hanging ? 1 : 0) - this.hangPose) * Math.min(1, 16 * dt);
    this.dropPose += ((dropping ? 1 : 0) - this.dropPose) * Math.min(1, 20 * dt);
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
        flip * (1 - this.grabPose) +
        this.grabPitch * this.grabPose -
        0.6 * this.slidePose + // baseball slide: leaned back on the hip
        (0.75 * crawlMove + 0.16 * crouchW) - // all fours hunch when MOVING; a squat stays upright
        0.55 * this.hangPose + // rear back: "...uh oh"
        1.45 * this.dropPose - // belly-first pancake
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
      this.chargePose * (0.26 - 0.14 * this.skatePose) - // board pump: shallower — a full drop telescopes the torso through the deck
      this.wallChargePose * 0.28 - // sink into the wall pump
      (this.grounded ? 0.1 * this.dropPose : 0) +
      Math.abs(Math.sin(this.walkPhase)) * 0.075 * this.walkAmp + // reference bounce: each step hops
      breathe * 0.015 * this.idleAmp;
    // The somersault wheels around the WAIST, not the feet (the rig's origin):
    // counter-translate so the hip stays pinned on the jump arc while the
    // body rotates about it. The offset lives in the group frame, so the
    // pitch axis has to account for the body's own yaw.
    if (flip > 0) {
      const waistH = 0.95;
      const yawB = this.bodyGroup.rotation.y;
      this.bodyGroup.position.y += waistH * (1 - Math.cos(flip));
      this.bodyGroup.position.x = -waistH * Math.sin(flip) * Math.sin(yawB);
      this.bodyGroup.position.z = -waistH * Math.sin(flip) * Math.cos(yawB);
    } else {
      this.bodyGroup.position.x = 0;
      this.bodyGroup.position.z = 0;
    }
    // Impact squash right after a slam lands; crawl also compresses the rig so
    // the whole body sits low and compact instead of floating pitched-over.
    const squash = this.slamSquash > 0 ? this.slamSquash / CONST.slamSquashTime : 0;
    this.bodyGroup.scale.y = 1.36 * (1 - 0.6 * squash) * (1 - 0.22 * this.crawlPose);

    // A bail stays visible so the tumble reads; a plain death blinks out.
    this.group.visible = (this.state !== 'dead' && this.state !== 'gameover') || this.bailing;

    // Blob shadow: persistent landing indicator, snapped to whatever floor is
    // below no matter how high the air. Shrinks with height but never fades.
    if (this.shadowGroundY !== null && this.state !== 'dead' && this.state !== 'gameover') {
      const h = Math.max(0, this.pos.y - this.shadowGroundY);
      this.shadow.visible = true;
      this.shadow.position.set(this.pos.x, this.shadowGroundY + 0.03, this.pos.z);
      this.shadow.scale.setScalar(THREE.MathUtils.clamp(0.9 - h * 0.04, 0.35, 0.9));
      // the landing X rides the same probe, growing a touch with height so
      // it reads from the top of a big air
      this.floorX.visible = true;
      this.floorX.position.set(this.pos.x, this.shadowGroundY + 0.05, this.pos.z);
      this.floorX.scale.setScalar(Math.min(1.6, 0.9 + h * 0.06));
    } else {
      this.shadow.visible = false; // no shadow = you are over the pit
      this.floorX.visible = false;
    }

  }

  // Character/board skins: painted canvases, up to 128px. Organic surfaces
  // keep the default LinearFilter so gradients shade smooth — the PS2 read;
  // `crisp` opts back into NearestFilter only where hard texels still sell
  // (grip grit). minFilter stays default like every CanvasTexture in the game.
  private paintTex(
    size: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
    crisp = false,
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    draw(canvas.getContext('2d')!);
    const tex = new THREE.CanvasTexture(canvas);
    if (crisp) tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  // 1px noise pass — grip-tape grit only now; fabric and skin get airbrush.
  private speckle(ctx: CanvasRenderingContext2D, size: number, color: string, n: number): void {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      ctx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 1, 1);
    }
  }

  // Low-alpha radial blobs — the painterly shading pass for fabric and skin,
  // where 1px speckle would read as pixel grit instead of soft wear.
  private airbrush(
    ctx: CanvasRenderingContext2D,
    size: number,
    rgb: string,
    a: number,
    n: number,
    rMin: number,
    rMax: number,
  ): void {
    for (let i = 0; i < n; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const x = Math.random() * size;
      const y = Math.random() * size;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${rgb},${a})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  // 5-point star path — chest logo and the grip-tape spray stencil share it.
  private starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rOut: number, rIn: number): void {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? rOut : rIn;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  // ——— The authored kangaroo girl (models/roo.glb, made in Meshy) ————————
  // A single static T-pose mesh with one texture — no skeleton. We carve it
  // into PS1-style rigid body segments at the joint planes and bolt each one
  // onto the existing pose rig, exactly like a PSX character: no skinning,
  // seams live inside overlapping geometry. The procedural body stays up
  // until the model lands (and remains the fallback if it never does).
  private installRoo(): void {
    const src =
      (window as { __ROO_GLB?: string }).__ROO_GLB || import.meta.env.BASE_URL + 'models/roo.glb';
    new GLTFLoader().load(
      src,
      (gltf) => {
        let source: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh;
        });
        if (!source) return;
        try {
          this.segmentRoo(source);
        } catch (e) {
          console.warn('roo segmentation failed (procedural body stays):', e);
        }
      },
      undefined,
      (e) => console.warn('roo model failed to load (procedural body stays):', e),
    );
  }

  // ——— Spin smear (models/smear.glb) ————————————————————————————————————
  // A cartoon motion-blur sculpted in 3D, Crash-style: while the spin attack
  // runs, the whole skater (board included) is swapped for this whirlwind,
  // re-posed at a new angle every couple of frames so it strobes instead of
  // turning smoothly. If it never loads, spins just stay un-smeared.
  private installSmear(): void {
    const src =
      (window as { __SMEAR_GLB?: string }).__SMEAR_GLB ||
      import.meta.env.BASE_URL + 'models/smear.glb';
    new GLTFLoader().load(
      src,
      (gltf) => {
        let source: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!source && (o as THREE.Mesh).isMesh) source = o as THREE.Mesh;
        });
        if (!source) return;
        const src = source as THREE.Mesh;
        const mesh = new THREE.Mesh(
          src.geometry,
          new THREE.MeshLambertMaterial({
            map: (src.material as THREE.MeshStandardMaterial).map ?? null,
            side: THREE.DoubleSide,
          }),
        );
        const g = new THREE.Group();
        g.add(mesh);
        // model is a unit cube centered at 0 — size it to the spin's reach:
        // wider than the body, a head shorter than standing
        g.scale.set(1.84, 1.52, 1.84);
        g.position.y = 0.76;
        g.visible = false;
        this.group.add(g);
        this.smearG = g;
      },
      undefined,
      (e) => console.warn('smear model failed to load (spins stay un-smeared):', e),
    );
  }

  private segmentRoo(source: THREE.Mesh): void {
    const geo = (source.geometry as THREE.BufferGeometry).toNonIndexed();
    const P = geo.getAttribute('position');
    const N = geo.getAttribute('normal');
    const UV = geo.getAttribute('uv');
    const mat = new THREE.MeshLambertMaterial({
      map: (source.material as THREE.MeshStandardMaterial).map ?? null,
      side: THREE.DoubleSide, // chunk interiors show at joint gaps — paint them
    });
    // Model space: normalized T-pose, feet y=-0.5 → crown +0.5, facing +Z.
    // Rig space: feet at 0. bodyGroup scales (1.18, 1.36, 1.18), so x/z pick
    // up the extra 1.36/1.18 here — the world result is uniform. HEIGHT is
    // the one knob: world units from sole to crown (crates are 0.96).
    const HEIGHT = 2.0;
    const SY = HEIGHT / 1.36;
    const SXZ = SY * (1.36 / 1.18);
    // skeleton heights derived from the same mapping, so the leg pivots sit
    // on the anatomy at ANY height
    const HIP = (-0.062 + 0.5) * SY;
    const KNEE = (-0.222 + 0.5) * SY;
    const NECK = (0.195 + 0.5) * SY + 0.02;
    // Joint planes measured off the mesh (model space): neck 0.195 (the side
    // ponytail bottoms out at 0.227, so it rides with the head), arm tubes at
    // |x|>0.155 spanning y 0.06..0.24 angled slightly forward, crotch -0.155,
    // knees -0.222, tail = everything behind z<-0.105 below the waistline.
    const isTail = (_x: number, y: number, z: number): boolean => z < -0.105 && y < -0.02;
    // Whole arm from the armpit out — nothing of the T-pose tube may stay on
    // the torso or it juts sideways forever. Outboard of 0.135 a simple band
    // suffices; at the root (0.105..0.135) only triangles hugging the arm's
    // axis come along, so the tank's side wall stays with the torso.
    const isArm = (x: number, y: number, z: number): boolean => {
      const ax = Math.abs(x);
      if (ax <= 0.105 || z <= -0.03) return false;
      if (ax > 0.135) return y > 0.09 && y < 0.21;
      const dy = y - 0.155;
      const dz = z - 0.076;
      return dy * dy + dz * dz < 0.0036; // within 0.06 of the arm axis
    };
    // Tail joints come from the mesh itself: 5 bands along the tail's curve,
    // joints at the midpoints between neighbouring band centroids — so the
    // chain sits ON the authored S-curve wherever Meshy put it.
    const yB = [-0.14, -0.22, -0.3, -0.36];
    const bandOf = (y: number): number => {
      for (let k = 0; k < yB.length; k++) if (y > yB[k]) return k;
      return yB.length;
    };
    const cents = Array.from({ length: 5 }, () => new THREE.Vector3());
    const counts = new Array(5).fill(0) as number[];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      if (!isTail(x, y, z)) continue;
      const b = bandOf(y);
      cents[b].x += x;
      cents[b].y += y;
      cents[b].z += z;
      counts[b]++;
    }
    for (let b = 0; b < 5; b++) if (counts[b] > 0) cents[b].multiplyScalar(1 / counts[b]);
    const mapV = (v: THREE.Vector3): THREE.Vector3 =>
      new THREE.Vector3(v.x * SXZ, (v.y + 0.5) * SY, v.z * SXZ);
    const TJ: THREE.Vector3[] = [new THREE.Vector3(0, (-0.055 + 0.5) * SY, -0.105 * SXZ)]; // attach at the seat
    for (let k = 1; k < 5; k++) {
      const a = counts[k - 1] > 0 ? cents[k - 1] : null;
      const b = counts[k] > 0 ? cents[k] : null;
      const m =
        a && b
          ? a.clone().add(b).multiplyScalar(0.5)
          : (b ?? a ?? new THREE.Vector3(0.1 * k, yB[Math.min(k - 1, 3)], -0.15));
      TJ[k] = mapV(m);
    }
    // Arm joints come from the mesh too: centroid "stations" along each
    // T-pose arm give the true shoulder→elbow→wrist axis (Meshy's arms droop
    // and sweep forward), and each chunk rotates its OWN axis exactly onto
    // straight-down — so the hang is vertical no matter how the T-pose leans.
    const DOWN = new THREE.Vector3(0, -1, 0);
    const station = (side: 1 | -1, x0: number, x1: number, fallback: number): THREE.Vector3 => {
      const c = new THREE.Vector3();
      let n = 0;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i);
        const y = P.getY(i);
        const z = P.getZ(i);
        if (side * x > x0 && side * x < x1 && isArm(x, y, z)) {
          c.x += x;
          c.y += y;
          c.z += z;
          n++;
        }
      }
      return n > 0 ? c.multiplyScalar(1 / n) : new THREE.Vector3(side * fallback, 0.145, 0.076);
    };
    const armJ: Record<string, { sh: THREE.Vector3; el: THREE.Vector3; qUp: THREE.Quaternion; qFo: THREE.Quaternion; elLen: number }> = {};
    for (const side of [-1, 1] as const) {
      const shM = station(side, 0.105, 0.16, 0.13);
      shM.x = side * 0.112; // pivot AT the armpit crease: the whole arm hangs below its hinge
      const sh = mapV(shM);
      const el = mapV(station(side, 0.26, 0.31, 0.285));
      const wr = mapV(station(side, 0.36, 0.42, 0.39));
      armJ[side === 1 ? 'R' : 'L'] = {
        sh,
        el,
        qUp: new THREE.Quaternion().setFromUnitVectors(el.clone().sub(sh).normalize(), DOWN),
        qFo: new THREE.Quaternion().setFromUnitVectors(wr.clone().sub(el).normalize(), DOWN),
        elLen: el.distanceTo(sh),
      };
    }
    interface Part {
      test: (x: number, y: number, z: number) => boolean;
      pivot: [number, number, number]; // rig space
      q?: THREE.Quaternion; // arm chunks: rotate the T-pose axis onto -Y
      verts: number[];
    }
    const parts: Record<string, Part> = {
      head: { test: (_x, y) => y > 0.195, pivot: [0, NECK, 0], verts: [] }, // pivot AT the neck seam
      foreArmR: { test: (x, y, z) => isArm(x, y, z) && x > 0.285, pivot: [armJ.R.el.x, armJ.R.el.y, armJ.R.el.z], q: armJ.R.qFo, verts: [] },
      foreArmL: { test: (x, y, z) => isArm(x, y, z) && x < -0.285, pivot: [armJ.L.el.x, armJ.L.el.y, armJ.L.el.z], q: armJ.L.qFo, verts: [] },
      upperArmR: { test: (x, y, z) => isArm(x, y, z) && x > 0, pivot: [armJ.R.sh.x, armJ.R.sh.y, armJ.R.sh.z], q: armJ.R.qUp, verts: [] },
      upperArmL: { test: (x, y, z) => isArm(x, y, z) && x < 0, pivot: [armJ.L.sh.x, armJ.L.sh.y, armJ.L.sh.z], q: armJ.L.qUp, verts: [] },
      tail0: { test: (x, y, z) => isTail(x, y, z) && bandOf(y) === 0, pivot: [TJ[0].x, TJ[0].y, TJ[0].z], verts: [] },
      tail1: { test: (x, y, z) => isTail(x, y, z) && bandOf(y) === 1, pivot: [TJ[1].x, TJ[1].y, TJ[1].z], verts: [] },
      tail2: { test: (x, y, z) => isTail(x, y, z) && bandOf(y) === 2, pivot: [TJ[2].x, TJ[2].y, TJ[2].z], verts: [] },
      tail3: { test: (x, y, z) => isTail(x, y, z) && bandOf(y) === 3, pivot: [TJ[3].x, TJ[3].y, TJ[3].z], verts: [] },
      tail4: { test: (x, y, z) => isTail(x, y, z) && bandOf(y) === 4, pivot: [TJ[4].x, TJ[4].y, TJ[4].z], verts: [] },
      // cut BELOW the baggy cuff + knee pad (leg pinches at -0.28): the sock
      // and shoe fold from inside the cuff, pads ride the thigh chunk
      shinR: { test: (x, y) => y <= -0.27 && x >= 0, pivot: [0.115, KNEE, 0], verts: [] },
      shinL: { test: (x, y) => y <= -0.27 && x < 0, pivot: [-0.115, KNEE, 0], verts: [] },
      // the front cargo pouches hang y -0.08..-0.26 across the crotch line:
      // they belong to the leg wholesale or they tear in half mid-stride
      thighR: {
        test: (x, y, z) => (y <= -0.155 || (z > 0.1 && y <= -0.06)) && x >= 0,
        pivot: [0.115, HIP, 0],
        verts: [],
      },
      thighL: {
        test: (x, y, z) => (y <= -0.155 || (z > 0.1 && y <= -0.06)) && x < 0,
        pivot: [-0.115, HIP, 0],
        verts: [],
      },
      pelvis: { test: (_x, y) => y <= -0.062, pivot: [0, HIP, 0], verts: [] },
      torso: { test: () => true, pivot: [0, 0, 0], verts: [] },
    };
    // One owner per triangle (duplicating seam tris z-fights at rest); the
    // double-sided material paints chunk interiors, so joint gaps read as
    // shadowed creases — the honest PS1 look.
    const order = Object.values(parts);
    for (let t = 0; t < P.count; t += 3) {
      const cx = (P.getX(t) + P.getX(t + 1) + P.getX(t + 2)) / 3;
      const cy = (P.getY(t) + P.getY(t + 1) + P.getY(t + 2)) / 3;
      const cz = (P.getZ(t) + P.getZ(t + 1) + P.getZ(t + 2)) / 3;
      for (const part of order) {
        if (!part.test(cx, cy, cz)) continue;
        part.verts.push(t, t + 1, t + 2);
        break;
      }
    }
    const build = (part: Part): THREE.Mesh => {
      const p: number[] = [];
      const nn: number[] = [];
      const uu: number[] = [];
      const v = new THREE.Vector3();
      const nv = new THREE.Vector3();
      for (const vi of part.verts) {
        v.set(
          P.getX(vi) * SXZ - part.pivot[0],
          (P.getY(vi) + 0.5) * SY - part.pivot[1],
          P.getZ(vi) * SXZ - part.pivot[2],
        );
        // normals: undo the anisotropic stretch, then match the chunk rotation
        nv.set(N.getX(vi) / SXZ, N.getY(vi) / SY, N.getZ(vi) / SXZ);
        if (part.q) {
          v.applyQuaternion(part.q);
          nv.applyQuaternion(part.q);
          v.y = Math.min(v.y, 0.015); // no slivers above the hinge: flatten to the shoulder line
        }
        nv.normalize();
        p.push(v.x, v.y, v.z);
        nn.push(nv.x, nv.y, nv.z);
        uu.push(UV.getX(vi), UV.getY(vi));
      }
      const cg = new THREE.BufferGeometry();
      cg.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      cg.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
      cg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2));
      return new THREE.Mesh(cg, mat);
    };
    // strip the procedural flesh, keep the joint groups
    const stripMeshes = (grp: THREE.Object3D | null): void => {
      if (!grp) return;
      for (const child of [...grp.children]) {
        if ((child as THREE.Mesh).isMesh) grp.remove(child);
      }
    };
    if (!this.headM || !this.armR || !this.armL || !this.legs) return;
    // head: everything goes (ears/hair/pony groups included) — the chunk has
    // it all, and the pivot drops to the NECK so look-at pitches and crouches
    // hinge at the seam instead of arcing the head off the body
    for (const child of [...this.headM.children]) this.headM.remove(child);
    this.ponyA = null; // the authored pony is part of the head chunk now
    this.ponyB = null;
    this.headM.position.y = parts.head.pivot[1];
    this.headM.add(build(parts.head));
    // arms: shoulder pivot at the arm root, elbow joint mid-tube, and a
    // relaxed hang (userData.lean) instead of the placeholder's A-frame
    for (const child of [...this.armR.children]) this.armR.remove(child);
    for (const child of [...this.armL.children]) this.armL.remove(child);
    this.armR.position.copy(armJ.R.sh);
    this.armL.position.copy(armJ.L.sh);
    this.armR.userData.lean = 0.1;
    this.armL.userData.lean = 0.1;
    this.armR.add(build(parts.upperArmR));
    this.armL.add(build(parts.upperArmL));
    this.elbowR = new THREE.Group();
    this.elbowL = new THREE.Group();
    // the upper arm's axis was rotated exactly onto -Y, so the elbow sits
    // straight below the shoulder at the measured arm length
    this.elbowR.position.set(0, -armJ.R.elLen, 0);
    this.elbowL.position.set(0, -armJ.L.elLen, 0);
    this.armR.add(this.elbowR);
    this.armL.add(this.elbowL);
    this.elbowR.add(build(parts.foreArmR));
    this.elbowL.add(build(parts.foreArmL));
    stripMeshes(this.upperG); // tank/waist/neck/necklace (arm + head groups stay)
    this.upperG!.add(build(parts.torso));
    stripMeshes(this.legs); // pelvis/belt/chain (leg groups stay)
    this.legs.position.y = HIP; // re-seat the leg skeleton on the scaled anatomy
    this.legs.add(build(parts.pelvis));
    stripMeshes(this.legR);
    stripMeshes(this.legL);
    this.legR!.add(build(parts.thighR));
    this.legL!.add(build(parts.thighL));
    stripMeshes(this.kneeR);
    stripMeshes(this.kneeL);
    this.kneeR!.position.y = KNEE - HIP;
    this.kneeL!.position.y = KNEE - HIP;
    this.kneeR!.add(build(parts.shinR));
    this.kneeL!.add(build(parts.shinL));
    // tail: rebuild the joint chain — FIVE joints seated on the authored
    // curve. The chunks carry the shape, so every joint's rest is 0 and the
    // sway driver only flexes deltas down the chain.
    if (this.tailRoot) {
      for (const child of [...this.tailRoot.children]) this.tailRoot.remove(child);
      this.tailRoot.position.copy(TJ[0]);
      this.tailChain = [];
      let parent: THREE.Object3D = this.tailRoot;
      for (let k = 0; k < 5; k++) {
        const joint = new THREE.Group();
        if (k === 0) joint.position.set(0, 0, 0);
        else joint.position.copy(TJ[k]).sub(TJ[k - 1]);
        joint.userData.rest = 0;
        parent.add(joint);
        joint.add(build(parts['tail' + k]));
        this.tailChain.push(joint);
        parent = joint;
      }
    }
  }

  private buildVisual(): THREE.Group {
    const g = new THREE.Group();
    const lam = (tex: THREE.CanvasTexture) => new THREE.MeshLambertMaterial({ map: tex });

    // Board (visual only), nose toward local +Z. Grouped with its wheels so
    // grabs can pull the whole board up into the hand. Multi-material box:
    // grip speckle on top, deck art on the BOTTOM — the underside is what the
    // camera actually sees through grabs and flips, so the flames go there.
    // Grip stays crisp — texel grit IS grip tape; the art shades smooth.
    const boardG = new THREE.Group();
    const gripM = lam(this.paintTex(64, (ctx) => {
      ctx.fillStyle = '#17181c';
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 130; i++) {
        const v = 44 + Math.floor(Math.random() * 46);
        ctx.fillStyle = `rgb(${v},${v},${v + 6})`;
        ctx.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), 1, 1);
      }
      this.speckle(ctx, 64, 'rgba(0,0,0,0.5)', 40);
      // spray-stencil star, half scuffed away by foot drag
      ctx.fillStyle = 'rgba(255,122,31,0.85)';
      this.starPath(ctx, 32, 32, 11, 4.5);
      ctx.fill();
      ctx.fillStyle = 'rgba(23,24,28,0.6)';
      for (let i = 0; i < 30; i++) ctx.fillRect(20 + Math.random() * 22, 20 + Math.random() * 22, 2, 1);
    }, true));
    const artM = lam(this.paintTex(128, (ctx) => {
      // underside art: magenta dusk gradient, curling flames off the tail,
      // star sparkles — airbrushed, no hard bands
      const dusk = ctx.createLinearGradient(0, 0, 0, 128);
      dusk.addColorStop(0, '#241047');
      dusk.addColorStop(0.45, '#631d7e');
      dusk.addColorStop(1, '#a1289a');
      ctx.fillStyle = dusk;
      ctx.fillRect(0, 0, 128, 128);
      const flame = (color: string, h: number) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 128);
        for (let x = 0; x <= 128; x += 16) {
          const peak = 128 - h - Math.sin(x * 0.3) * 9 - Math.random() * 12;
          ctx.quadraticCurveTo(x + 4, peak + 16, x + 8, peak);
          ctx.quadraticCurveTo(x + 12, peak + 16, x + 16, 128 - h * 0.3);
        }
        ctx.lineTo(128, 128);
        ctx.closePath();
        ctx.fill();
      };
      flame('#ff7a1f', 52);
      flame('#ffd23f', 30);
      flame('#fff3c4', 12);
      ctx.fillStyle = '#f4f1e6';
      for (const [x, y] of [[24, 20], [100, 14], [66, 32]]) {
        ctx.beginPath(); // soft 4-point sparkle
        ctx.moveTo(x, y - 7);
        ctx.quadraticCurveTo(x + 1.5, y - 1.5, x + 7, y);
        ctx.quadraticCurveTo(x + 1.5, y + 1.5, x, y + 7);
        ctx.quadraticCurveTo(x - 1.5, y + 1.5, x - 7, y);
        ctx.quadraticCurveTo(x - 1.5, y - 1.5, x, y - 7);
        ctx.fill();
      }
    }));
    const edgeM = new THREE.MeshLambertMaterial({ color: 0xd89b52 }); // ply edge
    const deckMats = [edgeM, edgeM, gripM, artM, edgeM, edgeM]; // +x -x top bottom +z -z
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.09, 1.4), deckMats);
    deck.position.y = 0.16;
    boardG.add(deck);
    // Rounded kicked nose/tail: squashed cylinder caps — grip up, art down,
    // ply on the rim — so the plank silhouette curves instead of boxing off.
    const kickGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10);
    const kickMats = [edgeM, gripM, artM]; // side, top cap, bottom cap
    for (const side of [-1, 1]) {
      const kick = new THREE.Mesh(kickGeo, kickMats);
      kick.scale.z = 1.35; // stretched into an oval nose
      kick.position.set(0, 0.175, side * 0.72);
      kick.rotation.x = -side * 0.3;
      boardG.add(kick);
    }
    const truckM = new THREE.MeshLambertMaterial({ color: 0xb9bfc9 });
    const truckGeo = new THREE.BoxGeometry(0.32, 0.07, 0.1);
    const wheelM = new THREE.MeshLambertMaterial({ color: 0xe0568a }); // pink urethane
    const wheelGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.1, 10);
    for (const z of [0.55, -0.55]) {
      const truck = new THREE.Mesh(truckGeo, truckM);
      truck.position.set(0, 0.1, z);
      boardG.add(truck);
      for (const x of [-0.21, 0.21]) {
        const wheel = new THREE.Mesh(wheelGeo, wheelM);
        wheel.rotation.z = Math.PI / 2; // axle along x
        wheel.position.set(x, 0.068, z);
        boardG.add(wheel);
      }
    }
    // The deck reads ~25% oversized against the body — scale the whole board
    // group down (grab lift/tip animate position/rotation, unaffected).
    boardG.scale.setScalar(0.8);
    g.add(boardG);
    this.boardG = boardG;

    // ——— The rider: a Crash-era kangaroo girl. Same skeleton as ever —
    // hip pivots at ±0.115 under legs@0.71, knees at −0.26, shoulders at
    // (±0.33, 1.22), hands at −0.48, head pivot at 1.42 — syncVisual owns
    // every joint, so only the flesh changed. Flat-shaded solid materials
    // give the PS2 facet look; canvases only where cloth needs a print.
    const flat = (color: number): THREE.MeshLambertMaterial =>
      new THREE.MeshLambertMaterial({ color, flatShading: true });
    const FUR = flat(0xf39133); // kangaroo orange
    const FUR_DK = flat(0xdd7621); // tail tip / shading pieces
    const EAR = flat(0xe86a8a); // inner ear pink
    const HAIR = flat(0xf5c952); // blonde
    const HAIR_DK = flat(0xe3ab38); // ponytail tip / side sweep
    const PINK = flat(0xe8447a); // trim pink (scrunchie, cuffs, stitching)
    const SHOE_PINK = flat(0xe0357a);
    const BLACK = flat(0x232529); // cargo shorts / gloves
    const PAD = flat(0x2c2f36); // knee + elbow pads
    const WHITE = flat(0xf2efe8); // socks / straps
    const CREAM = flat(0xefe6d6); // platform soles
    const SILVER = flat(0xb9bfc9); // buckle, chain, studs
    // eyes + face read cleaner smooth-shaded
    const EYE_WHITE = new THREE.MeshLambertMaterial({ color: 0xfbfbf6 });
    const EYE_GREEN = new THREE.MeshLambertMaterial({ color: 0x53b04b });
    const INK = new THREE.MeshLambertMaterial({ color: 0x17181c }); // nose, pupils, lashes, smile

    // Legs: hip-pivot groups with a REAL knee joint each. Cargo-short thigh
    // down to a knee group carrying the shorts cuff, knee pad, bare shin,
    // sock, and chunky platform sneaker.
    const legs = new THREE.Group();
    legs.position.y = 0.71; // hip line
    // Pelvis: the shorts' seat, riding the legs root (top of the leg squash,
    // so it stays put through crouches while the legs fold under it).
    const hipProfile = [
      new THREE.Vector2(0.115, -0.12),
      new THREE.Vector2(0.16, -0.06),
      new THREE.Vector2(0.175, 0.02),
      new THREE.Vector2(0.16, 0.08),
      new THREE.Vector2(0.145, 0.115),
    ];
    const pelvis = new THREE.Mesh(new THREE.LatheGeometry(hipProfile, 10), BLACK);
    pelvis.scale.z = 0.85;
    legs.add(pelvis);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.024, 6, 12), PAD);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.115;
    belt.scale.set(1, 0.85, 1); // hips are an oval (scale acts pre-rotation: z is world depth)
    legs.add(belt);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.025), SILVER);
    buckle.position.set(0, 0.115, 0.14);
    legs.add(buckle);
    // wallet chain swinging off the right hip
    const linkGeo = new THREE.TorusGeometry(0.021, 0.007, 5, 8);
    const chainPts: [number, number, number, number][] = [
      [0.14, 0.07, 0.075, 0.3],
      [0.16, 0.025, 0.04, 1.2],
      [0.165, -0.015, 0.0, 0.5],
    ];
    for (const [cx, cy, cz, rot] of chainPts) {
      const link = new THREE.Mesh(linkGeo, SILVER);
      link.position.set(cx, cy, cz);
      link.rotation.set(rot, 0.6, 0);
      legs.add(link);
    }
    const thighGeo = new THREE.CylinderGeometry(0.088, 0.082, 0.24, 9);
    thighGeo.translate(0, -0.13, 0); // hip → knee, baggy cargo leg
    const pocketGeo = new THREE.BoxGeometry(0.035, 0.095, 0.075);
    const flapGeo = new THREE.BoxGeometry(0.037, 0.014, 0.077);
    const cuffGeo = new THREE.CylinderGeometry(0.086, 0.09, 0.06, 9);
    const cuffTrimGeo = new THREE.CylinderGeometry(0.091, 0.091, 0.013, 9);
    const kneePadGeo = new THREE.SphereGeometry(0.072, 8, 6);
    const shinGeo = new THREE.CylinderGeometry(0.048, 0.042, 0.1, 8);
    shinGeo.translate(0, -0.115, 0); // bare fur between cuff and sock
    const sockGeo = new THREE.CylinderGeometry(0.054, 0.058, 0.055, 8);
    const sockStripeGeo = new THREE.CylinderGeometry(0.059, 0.059, 0.013, 8);
    const shoeGeo = new THREE.SphereGeometry(0.1, 9, 7);
    const strapGeo = new THREE.BoxGeometry(0.115, 0.018, 0.055);
    const soleGeo = new THREE.BoxGeometry(0.145, 0.05, 0.34);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); // hip pivot — syncVisual writes rot + pos
      leg.position.x = side * 0.115;
      legs.add(leg);
      leg.add(new THREE.Mesh(thighGeo, BLACK));
      const pocket = new THREE.Mesh(pocketGeo, BLACK); // cargo pocket on the outseam
      pocket.position.set(side * 0.082, -0.14, 0.01);
      leg.add(pocket);
      const flap = new THREE.Mesh(flapGeo, PINK); // pink-stitched flap
      flap.position.set(side * 0.082, -0.095, 0.01);
      leg.add(flap);
      // Knee group pivots where the thigh ends; everything below swings with
      // it and squashes with legs.scale.y, same as the rest of the rig.
      const knee = new THREE.Group();
      knee.position.y = -0.26;
      leg.add(knee);
      const cuff = new THREE.Mesh(cuffGeo, BLACK); // capri cuff just past the knee
      cuff.position.y = -0.015;
      knee.add(cuff);
      const cuffTrim = new THREE.Mesh(cuffTrimGeo, PINK);
      cuffTrim.position.y = -0.052;
      knee.add(cuffTrim);
      const pad = new THREE.Mesh(kneePadGeo, PAD); // strapped knee pad dome
      pad.scale.set(1, 0.8, 0.65);
      pad.position.set(0, -0.005, 0.075);
      knee.add(pad);
      const padTrim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 5, 10), PINK);
      padTrim.position.set(0, -0.005, 0.09);
      padTrim.scale.set(1, 0.85, 1);
      knee.add(padTrim);
      knee.add(new THREE.Mesh(shinGeo, FUR));
      const sock = new THREE.Mesh(sockGeo, WHITE);
      sock.position.y = -0.15;
      knee.add(sock);
      const stripe = new THREE.Mesh(sockStripeGeo, PINK);
      stripe.position.y = -0.128;
      knee.add(stripe);
      const shoe = new THREE.Mesh(shoeGeo, SHOE_PINK); // chunky pink hi-top
      shoe.scale.set(1, 0.6, 1.5);
      shoe.position.set(0, -0.205, 0.055);
      knee.add(shoe);
      const strapA = new THREE.Mesh(strapGeo, WHITE);
      strapA.position.set(0, -0.175, 0.115);
      strapA.rotation.x = 0.35;
      knee.add(strapA);
      const strapB = new THREE.Mesh(strapGeo, WHITE);
      strapB.position.set(0, -0.19, 0.045);
      strapB.rotation.x = 0.15;
      knee.add(strapB);
      const sole = new THREE.Mesh(soleGeo, CREAM); // platform slab (same floor reach as before)
      sole.position.set(0, -0.255, 0.05);
      knee.add(sole);
      if (side === 1) {
        this.legR = leg;
        this.kneeR = knee;
      } else {
        this.legL = leg;
        this.kneeL = knee;
      }
    }
    g.add(legs);
    this.legs = legs;

    // Tail: the kangaroo signature — three chained joints drooping off the
    // hips then curling back up. Parented to the body root (NOT the legs
    // group) so leg squashes don't pancake it; syncVisual drives the sway.
    const tailRoot = new THREE.Group();
    tailRoot.position.set(0, 0.68, -0.14);
    g.add(tailRoot);
    const tailBase = new THREE.Group();
    tailRoot.add(tailBase);
    const tailBaseGeo = new THREE.CapsuleGeometry(0.082, 0.2, 3, 8);
    tailBaseGeo.translate(0, -0.14, 0);
    tailBase.add(new THREE.Mesh(tailBaseGeo, FUR));
    const tailMid = new THREE.Group();
    tailMid.position.y = -0.3;
    tailBase.add(tailMid);
    const tailMidGeo = new THREE.CapsuleGeometry(0.06, 0.18, 3, 8);
    tailMidGeo.translate(0, -0.12, 0);
    tailMid.add(new THREE.Mesh(tailMidGeo, FUR));
    const tailTip = new THREE.Group();
    tailTip.position.y = -0.26;
    tailMid.add(tailTip);
    const tailTipGeo = new THREE.ConeGeometry(0.048, 0.2, 7);
    tailTipGeo.rotateX(Math.PI); // point away from the body
    tailTipGeo.translate(0, -0.1, 0);
    tailTip.add(new THREE.Mesh(tailTipGeo, FUR_DK));
    tailBase.rotation.x = 1.15; // rest curve (+x swings the -Y chain back); the driver overwrites each frame
    tailMid.rotation.x = 0.55;
    tailTip.rotation.x = 0.4;
    tailBase.userData.rest = 1.15; // procedural chunks are straight: rest pose lives in the joints
    tailMid.userData.rest = 0.55;
    tailTip.userData.rest = 0.4;
    this.tailRoot = tailRoot;
    this.tailChain = [tailBase, tailMid, tailTip];

    // Crop tank: ONE wrapped canvas on a lathe — phiStart 1.5π puts u=0.25
    // (canvas x=32) at local +Z, so the chest heart paints at x=32 square on
    // the front. Hem stops high: the midriff below is bare fur.
    const tankM = lam(this.paintTex(128, (ctx) => {
      ctx.fillStyle = '#f4f1ec';
      ctx.fillRect(0, 0, 128, 128);
      this.airbrush(ctx, 128, '215,205,195', 0.08, 10, 8, 20);
      ctx.fillStyle = '#e8447a';
      ctx.fillRect(0, 0, 128, 9); // collar trim
      ctx.fillRect(0, 117, 128, 11); // hem trim
      // little heart print on the chest
      const hx = 32;
      const hy = 56;
      const s = 9;
      ctx.beginPath();
      ctx.moveTo(hx, hy + s);
      ctx.bezierCurveTo(hx - s * 1.4, hy, hx - s * 0.7, hy - s, hx, hy - s * 0.35);
      ctx.bezierCurveTo(hx + s * 0.7, hy - s, hx + s * 1.4, hy, hx, hy + s);
      ctx.fill();
    }));
    const tankProfile = [
      new THREE.Vector2(0.105, -0.13), // tucked under the hem — hem rides HIGH: bare midriff below
      new THREE.Vector2(0.155, -0.1), // hem flare over the waist
      new THREE.Vector2(0.165, -0.04),
      new THREE.Vector2(0.18, 0.03), // chest
      new THREE.Vector2(0.215, 0.12), // shoulder, broad enough to meet the arms
      new THREE.Vector2(0.19, 0.185),
      new THREE.Vector2(0.09, 0.235), // roll off to the collar
    ];
    const tank = new THREE.Mesh(new THREE.LatheGeometry(tankProfile, 12, Math.PI * 1.5, Math.PI * 2), tankM);
    tank.scale.z = 0.72; // chest oval, not a tube
    // Upper body rides in its own group so the shoulders can open side-on
    // (skate stance) and counter-swing against the run without dragging the
    // hips, legs, or board around with them.
    const upper = new THREE.Group();
    tank.position.y = 1.06;
    upper.add(tank);
    // bare midriff: slim fur waist between shorts and hem
    const waistProfile = [
      new THREE.Vector2(0.128, -0.05),
      new THREE.Vector2(0.112, 0.03),
      new THREE.Vector2(0.115, 0.1),
      new THREE.Vector2(0.128, 0.17), // reaches up under the higher hem
    ];
    const waist = new THREE.Mesh(new THREE.LatheGeometry(waistProfile, 10), FUR);
    waist.scale.z = 0.8;
    waist.position.y = 0.85;
    upper.add(waist);
    // neck + thin necklace with a little pendant
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8), FUR);
    neck.position.y = 1.325;
    upper.add(neck);
    const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.007, 5, 12), SILVER);
    necklace.rotation.x = 1.45; // lies nearly flat, dipping toward the chest
    necklace.position.y = 1.3;
    upper.add(necklace);
    const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 5), SILVER);
    pendant.position.set(0, 1.272, 0.068);
    upper.add(pendant);

    // Head: a GROUP pivot at 1.42 (syncVisual pitches/yaws it for the
    // horizon look-at) carrying the whole kangaroo face — skull, muzzle,
    // geometric eyes, tall ears, blonde bangs, and the jointed ponytail.
    const head = new THREE.Group();
    head.position.y = 1.42;
    upper.add(head);
    this.headM = head;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 9), FUR);
    skull.scale.set(0.95, 1.0, 0.9);
    head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), FUR); // cheek/jaw mass
    jaw.scale.set(1.2, 0.75, 1.05);
    jaw.position.set(0, -0.075, 0.05);
    head.add(jaw);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), FUR);
    muzzle.scale.set(0.82, 0.58, 1.05);
    muzzle.position.set(0, -0.045, 0.125);
    head.add(muzzle);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), INK);
    nose.scale.set(1.2, 0.75, 0.7);
    nose.position.set(0, 0.005, 0.225); // sits on TOP of the muzzle, Crash-style
    head.add(nose);
    // smile: a thin torus arc lying on the muzzle's underside
    const smileArc = Math.PI * 0.7;
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.008, 5, 12, smileArc), INK);
    smile.rotation.set(0.35, 0, -Math.PI / 2 - smileArc / 2); // arc centered on the bottom
    smile.position.set(0, -0.055, 0.185);
    head.add(smile);
    // eyes: big almond whites hugging the face curve, green iris, dark pupil,
    // and a lash arc over the top lid
    const lashArc = Math.PI * 0.6;
    for (const e of [-1, 1]) {
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.05, 9, 8), EYE_WHITE);
      white.scale.set(0.72, 1.05, 0.42);
      white.position.set(e * 0.066, 0.03, 0.135);
      white.rotation.y = e * 0.3;
      head.add(white);
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), EYE_GREEN);
      iris.scale.set(1, 1.15, 0.45);
      iris.position.set(e * 0.069, 0.025, 0.168);
      head.add(iris);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), INK);
      pupil.scale.set(1, 1, 0.5);
      pupil.position.set(e * 0.07, 0.025, 0.185);
      head.add(pupil);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 4, 10, lashArc), INK);
      lash.rotation.set(-0.15, e * 0.3, Math.PI / 2 - lashArc / 2); // arc centered on top
      lash.position.set(e * 0.066, 0.035, 0.148);
      head.add(lash);
    }
    // ears: the silhouette — tall flattened cones, pink inside
    const earOuterGeo = new THREE.ConeGeometry(0.058, 0.26, 7);
    earOuterGeo.translate(0, 0.13, 0); // pivot at the base
    const earInnerGeo = new THREE.ConeGeometry(0.032, 0.13, 6);
    earInnerGeo.translate(0, 0.065, 0);
    for (const e of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(e * 0.095, 0.135, -0.02);
      ear.rotation.set(-0.15, 0, -e * 0.42); // splayed up-and-out, tipped back
      head.add(ear);
      const outer = new THREE.Mesh(earOuterGeo, FUR);
      outer.scale.z = 0.55;
      ear.add(outer);
      const inner = new THREE.Mesh(earInnerGeo, EAR); // pink lining, kept inside the rim
      inner.scale.z = 0.3;
      inner.position.z = 0.026;
      ear.add(inner);
    }
    // hair: blonde crown + swept bangs + high ponytail (two joints so it can
    // swing with the tail driver)
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.185, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.42),
      HAIR,
    );
    crown.position.y = 0.015;
    crown.rotation.x = -0.06;
    crown.scale.set(0.97, 1.05, 0.95);
    head.add(crown);
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), HAIR);
    backHair.scale.set(1.05, 1.1, 0.66); // slim: the ponytail needs to clear it
    backHair.position.set(0, 0.01, -0.075);
    head.add(backHair);
    const bang = (bx: number, by: number, bz: number, r: number, sx: number, rz: number, m = HAIR): void => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
      b.scale.set(sx, 0.7, 0.6);
      b.position.set(bx, by, bz);
      b.rotation.z = rz;
      head.add(b);
    };
    bang(-0.075, 0.09, 0.115, 0.055, 1.0, 0.25);
    bang(0.0, 0.105, 0.13, 0.06, 1.05, 0);
    bang(0.08, 0.085, 0.115, 0.05, 0.95, -0.25);
    // long side sweep drifting across the right brow
    const sweep = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), HAIR_DK);
    sweep.scale.set(0.66, 1.5, 0.5);
    sweep.position.set(0.115, 0.03, 0.09);
    sweep.rotation.z = -0.35;
    head.add(sweep);
    const ponyA = new THREE.Group(); // scrunchie + puff
    ponyA.position.set(0, 0.175, -0.145); // clears the back-hair mass
    ponyA.rotation.x = 1.2; // swung well out off the crown
    head.add(ponyA);
    const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.022, 6, 10), PINK);
    scrunchie.rotation.x = Math.PI / 2;
    scrunchie.position.y = 0.012; // proud of the crown so the pink ring reads
    ponyA.add(scrunchie);
    const puffGeo = new THREE.CapsuleGeometry(0.082, 0.1, 3, 8);
    puffGeo.translate(0, -0.1, 0);
    const puff = new THREE.Mesh(puffGeo, HAIR);
    puff.scale.set(0.95, 1, 0.85);
    ponyA.add(puff);
    const ponyB = new THREE.Group(); // tapering tip
    ponyB.position.y = -0.21;
    ponyB.rotation.x = 0.5;
    ponyA.add(ponyB);
    const ponyTipGeo = new THREE.ConeGeometry(0.052, 0.2, 7);
    ponyTipGeo.rotateX(Math.PI);
    ponyTipGeo.translate(0, -0.08, 0);
    ponyB.add(new THREE.Mesh(ponyTipGeo, HAIR_DK));
    this.ponyA = ponyA;
    this.ponyB = ponyB;

    // Arms: shoulder-pivot GROUPS (origin at the shoulder, geometry hangs
    // down) so swings, grabs, and windmills pivot where a shoulder is.
    // Bare fur upper arm, fishnet sleeve forearm, elbow pad, fingerless
    // glove with pink cuff (left) / studded band (right).
    const netM = lam(this.paintTex(64, (ctx) => {
      ctx.fillStyle = '#f08a2a'; // fur shows through the net
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = 'rgba(24,24,30,0.9)';
      ctx.lineWidth = 1.6;
      for (let i = -64; i < 128; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 64, 64);
        ctx.moveTo(i + 64, 0);
        ctx.lineTo(i, 64);
        ctx.stroke();
      }
    }));
    const shoulderGeo = new THREE.SphereGeometry(0.062, 8, 6);
    const upperArmGeo = new THREE.CapsuleGeometry(0.047, 0.13, 3, 8);
    upperArmGeo.translate(0, -0.105, 0);
    const foreArmGeo = new THREE.CylinderGeometry(0.044, 0.038, 0.17, 8);
    foreArmGeo.translate(0, -0.315, 0);
    const elbowGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const handGeo = new THREE.SphereGeometry(0.072, 8, 6);
    const fingerGeo = new THREE.SphereGeometry(0.042, 7, 5);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.3, 1.22, 0); // snug to the tank's shoulder line
      upper.add(arm);
      const shoulder = new THREE.Mesh(shoulderGeo, FUR);
      shoulder.position.set(-side * 0.015, -0.005, 0);
      arm.add(shoulder);
      arm.add(new THREE.Mesh(upperArmGeo, FUR));
      const elbow = new THREE.Mesh(elbowGeo, PAD); // little elbow pad
      elbow.scale.set(0.85, 1, 0.85);
      elbow.position.y = -0.22;
      arm.add(elbow);
      arm.add(new THREE.Mesh(foreArmGeo, netM)); // fishnet sleeve
      const hand = new THREE.Mesh(handGeo, BLACK); // fingerless glove
      hand.scale.set(1, 0.92, 1.02);
      hand.position.y = -0.48;
      arm.add(hand);
      const fingers = new THREE.Mesh(fingerGeo, FUR); // bare fingertips poking out
      fingers.scale.set(1, 0.7, 1);
      fingers.position.set(0, -0.53, 0.015);
      arm.add(fingers);
      if (side === 1) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.015, 5, 10), BLACK);
        band.rotation.x = Math.PI / 2;
        band.position.y = -0.415;
        arm.add(band);
        for (let s = 0; s < 4; s++) {
          const a = (s / 4) * Math.PI * 2 + 0.4;
          const stud = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.014), SILVER);
          stud.position.set(Math.cos(a) * 0.058, -0.415, Math.sin(a) * 0.058);
          arm.add(stud);
        }
        this.armR = arm;
      } else {
        const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.013, 5, 10), PINK);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -0.415;
        arm.add(cuff);
        this.armL = arm;
      }
    }
    g.add(upper);
    this.upperG = upper;

    return g;
  }
}
