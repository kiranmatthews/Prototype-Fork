// Authored fake-physics board movement. No rigidbody, no forces: just a
// heading, a scalar speed, a vertical velocity, and hand-tuned numbers from
// tuning.ts. Ground following is a single downward raycast; slopes only exist
// as fake boost/slowdown numbers derived from the surface normal.

import * as THREE from 'three';
import { TUNING, CONST } from './tuning';
import { Input } from './input';
import { Crate, Level } from './level';
import { sfx } from './audio';
import { Rail, RailSample, nearestRail } from './rails';

export type MoveState = 'ride' | 'air' | 'grind' | 'dead' | 'gameover' | 'finished';

interface GroundHit {
  y: number;
  normal: THREE.Vector3;
  name: string;
  moverId?: number; // standing on a moving platform: ride along with it
  crumbleId?: number; // standing on a crumble pad: it starts breaking
}

const DOWN = new THREE.Vector3(0, -1, 0);
// The course axis. All movement is locked to it, Crash-style: `speed` runs
// along -Z (positive = down the course), left/right is pure lateral X.
const FORWARD = new THREE.Vector3(0, 0, -1);

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
  private comboTimer = 0; // plain-rolling time left before the combo banks

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
  private landingScoring = false; // landing-tick payouts still count as air tricks
  private crawling = false; // Circle held while stopped: all-fours crawl
  private crawlPose = 0;
  private slamActive = false; // Circle+down in the air: pancake body slam
  private slamHangT = 0; // cartoon hang before the drop
  private slamFlatT = 0; // lie pancaked on the ground for a beat after impact
  private hangPose = 0;
  private dropPose = 0;
  private skatePose = 0; // feet-on-the-board stance while rolling
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
  private armR: THREE.Mesh | null = null;
  private armL: THREE.Mesh | null = null;
  private upperG: THREE.Group | null = null; // torso+head+arms: shoulder yaw
  private headM: THREE.Mesh | null = null;
  private legs: THREE.Group | null = null;
  private legL: THREE.Group | null = null; // hip pivots (thigh + knee joint inside)
  private legR: THREE.Group | null = null;
  private kneeL: THREE.Group | null = null; // knee pivots (shin + shoe inside)
  private kneeR: THREE.Group | null = null;
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
  private travelDir: 'S' | 'E' | 'W' = 'S';
  private axisF = new THREE.Vector3(0, 0, -1); // along-course
  private axisL = new THREE.Vector3(1, 0, 0); // stick-right sidestep
  private haltCd = 0; // screech-sound cooldown for wall stops
  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private spinBox = new THREE.Box3();
  private enemyTouch = new THREE.Box3(); // scratch: shrunken enemy touch box
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private fruits: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number; flung?: boolean }[] = [];

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

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

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

  private setTravelDir(dir: 'S' | 'E' | 'W'): void {
    this.travelDir = dir;
    if (dir === 'S') {
      this.axisF.set(0, 0, -1);
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
    if (hard) {
      this.lives = 3;
      this.hasCrystal = false;
      this.gemEarned = false;
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
    this.comboTimer = 0;
    this.invulnTimer = 0;
    this.slideTimer = 0;
    this.slideCd = 0;
    this.slideGraceT = 0;
    this.crawling = false;
    this.slamActive = false;
    this.slamHangT = 0;
    this.bailDownT = 0;
    this.airFromSkate = false;
    this.stepOff = false;
    this.stance = 1;
    this.vertAir = false;
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
    this.slopePose = 0;
    this.slopeRoll = 0;
    this.alignPose = 0;
    this.alignNormal.set(0, 1, 0);
    this.slipping = false;
    this.slipClamp = false;
    const zn = level.zoneAt(this.pos.x, this.pos.z);
    this.setTravelDir(zn ? zn.dir : 'S');
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
    if (this.slideTimer > 0) this.slideGraceT = TUNING.slideJumpGrace;
    else this.slideGraceT = Math.max(0, this.slideGraceT - dt);
    this.jumpBufferT = Math.max(0, this.jumpBufferT - dt);
    // Side-scroll levels: the camera sits off to the +X side, so screen right
    // = down-course. Remap the stick — left/right drives speed, and up/down
    // is the depth sidestep (up = away from the camera), the exact same
    // direct-velocity move as left/right in corridor levels. The raw stick
    // stays available (rawInput) for the slam, grab-spin direction, and
    // grind balance.
    this.rawInput = input;
    // The path can right-angle into an X-running stretch (the camera never
    // turns — the turned path IS the side-scroll view). Because the camera is
    // fixed, every mapping agrees in WORLD space (right is always screen
    // right), so axes flip the instant you cross a corner — no lock, no
    // latch. Held skate speed transfers into the new direction if the stick
    // is pushing along it.
    const zone = level.zoneAt(this.pos.x, this.pos.z);
    const wantDir = zone ? zone.dir : 'S';
    // Corner flips are a WALKING concept — free-heading skating just carves
    // through corners, so the axes are left alone while on the board.
    if (wantDir !== this.travelDir && this.state !== 'grind' && !this.freeSkate) {
      const oldSpeed = this.speed;
      this.setTravelDir(wantDir);
      const alongNew =
        wantDir === 'S' ? input.moveY : wantDir === 'E' ? input.moveX : -input.moveX;
      this.speed =
        Math.abs(alongNew) > 0.3 ? Math.sign(alongNew) * Math.abs(oldSpeed) * 0.7 : 0;
    }
    let ctl =
      this.travelDir === 'S'
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
        const inv = 1 / Math.hypot(rx, ry);
        const wx = rx * inv;
        const wz = -ry * inv; // stick up = world -Z (the camera never turns)
        ctl = {
          ...input,
          moveY: wx * this.axisF.x + wz * this.axisF.z,
          moveX: wx * this.axisL.x + wz * this.axisL.z,
        } as unknown as Input;
      }
    }
    input = ctl;

    // The blob shadow is a landing indicator: probe far down for the floor
    // every step, independent of the short gameplay ground-follow ray.
    this.shadowGroundY = this.queryShadowGround(level);

    this.regrindCd = Math.max(0, this.regrindCd - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.flipTimer = Math.max(0, this.flipTimer - dt);
    this.slideCd = Math.max(0, this.slideCd - dt);
    this.slideTimer = Math.max(0, this.slideTimer - dt);
    this.haltCd = Math.max(0, this.haltCd - dt);
    this.slamSquash = Math.max(0, this.slamSquash - dt);
    this.slamFlatT = Math.max(0, this.slamFlatT - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.bailDownT = Math.max(0, this.bailDownT - dt);
    if (this.state !== 'air') this.vertAir = false;
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
    if (this.comboTimer > 0 && this.state === 'ride' && this.grounded && !this.sliding) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.bankCombo();
    }

    // Circle/Q on the ground while moving fires a brief canned slide:
    // direction locked, bursts to slideSpeed, smashes crates. All three feel
    // numbers (trigger threshold, duration, speed) are sliders. (Stopped,
    // holding it crawls instead — see stepRide. In the air it's a grab.)
    const stickMag = Math.abs(input.moveX) + Math.abs(input.moveY);
    if (
      input.grabPressed &&
      this.state === 'ride' &&
      this.grounded &&
      !this.crawling &&
      this.slideTimer <= 0 &&
      this.slideCd <= 0 &&
      (Math.abs(this.speed) >= TUNING.slideMinSpeed || stickMag > 0.4)
    ) {
      // 8-axis slide: it fires along the stick (diagonals included), or along
      // current travel if the stick is idle. A slide off your feet is Crash's
      // slide: canned burst, then back to walking; at skate speed it keeps
      // its momentum.
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
          if (this.lives < 0) {
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
      case 'ride':
        this.runTime += dt;
        if ((input.grindPressed || input.grindHeld) && this.tryGrind()) {
          // snapped straight onto the rail this tick
        } else {
          this.stepRide(dt, input, level);
        }
        break;
      case 'air':
        this.runTime += dt;
        if ((input.grindPressed || input.grindHeld) && this.tryGrind()) {
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

    this.syncVisual(input, dt);
  }

  // ---------------------------------------------------------------- states --

  // Score an action. Combos live in the AIR and on rails/slides only: those
  // actions stack base + multiplier, THPS-style, and bank on a clean landing.
  // Plain ground actions (spinning a box while standing there) just pay flat
  // points — they never start or feed a combo. Bail or die = the combo dies.
  private score(base: number, label?: string): void {
    const inTrick =
      this.landingScoring || this.state === 'air' || this.state === 'grind' || this.sliding;
    if (inTrick) {
      this.comboPoints += base;
      this.comboMult += 1;
      this.comboTimer = CONST.comboWindow;
      if (label) this.pushLabel(label);
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
    if (this.comboMult > 0) this.points += this.comboPoints * this.comboMult;
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
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
    // The slide boost applies during the slide AND for slideJumpGrace seconds
    // after it ends — the old exact-window timing was nearly unhittable.
    const fromSlide = this.slideTimer > 0 || this.slideGraceT > 0;
    // Grabs are board tricks: only airs that START from skating offer them.
    this.airFromSkate =
      this.freeSkate || fromSlide || Math.abs(this.speed) > TUNING.walkSpeed + 0.5;
    this.slideGraceT = 0;
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
      // Crash slide-jump: a HIGH leap out of the slide. The burst's momentum
      // carries through the air; a walk-slide still lands back on your feet
      // (slideFromWalk stays set, so touchdown clamps to walking pace).
      // slideJumpHeight owns the pop; slideJumpTravel scales the horizontal
      // launch so you can keep the height without flying across the map.
      this.speed *= TUNING.slideJumpTravel;
      this.slideTimer = 0;
      this.slideCd = CONST.slideCooldown;
      this.airMomentum = true;
      this.lastJumpType = 'Slide Jump';
      sfx.play('woosh2', 0.6);
    } else if (spd > TUNING.walkSpeed + 0.5) {
      // leaving actual skating: THPS board ollie
      this.lastJumpType = 'Board Ollie';
      sfx.play('ollie', 0.7);
    } else if (spd > TUNING.walkSpeed * 0.45) {
      // on foot with real run speed: Crash forward somersault
      this.lastJumpType = 'Forward Flip';
      this.flipTimer = CONST.flipDuration;
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
    // fast jumps flip — EXCEPT star jumps (crouch/slide), which hold the
    // classic spread-eagle instead of tumbling through it
    // the somersault is a RUNNING trick: board jumps (ollies) never flip
    if (spd >= CONST.flipMinSpeed && this.starTimer <= 0 && !this.freeSkate)
      this.flipTimer = CONST.flipDuration;
  }

  private stepRide(dt: number, input: Input, level: Level): void {
    // Flattened after a slam OR knocked down by a bail: pancaked on the
    // ground for a beat, no control.
    const slamFlat = this.slamFlatT > 0 || this.bailDownT > 0;

    // Crash crouch-crawl: holding Circle while (nearly) stopped drops you into
    // a low, slow, all-fours crawl — direct velocity, no inertia, until release.
    if (!slamFlat && input.grabHeld && (this.crawling || (Math.abs(this.speed) < TUNING.slideMinSpeed && this.slideTimer <= 0))) {
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
    const pushingOff =
      this.charging &&
      stickHeld &&
      this.skateCharge >= TUNING.skateHoldTime &&
      planarSpeed >= TUNING.skateEntrySpeed;
    this.skateOn = pushingOff;
    // Ground too steep to RIDE (halfpipe transitions, steep banks): with real
    // momentum the board pops out here. Steepness reads the SMOOTHED ride plane,
    // not the raw facet: seams between transition boxes can return a side-face
    // normal for one frame, and a single spike must not snap the board out.
    const steepGround = this.groundHit !== null && this.rideNormal.y < TUNING.steepStand;
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
    const free = skating && this.slideTimer <= 0 && !slamFlat && !this.crawling;
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

    if (slamFlat) {
      this.speed = 0;
      this.lastTy = 0;
    } else if (this.crawling) {
      // Direct-drive crawl. Speed snaps to the stick; no slopes, no friction.
      // (The input vector is unit-clamped, so diagonals need no re-scaling.)
      this.speed = input.moveY * TUNING.crawlSpeed;
      this.lastTy = 0;
    } else if (!skating) {
      // WALK: direct drive, instant start and stop, no inertia, no slope
      // physics — precise Crash platforming in all eight directions. A
      // planted charge (X held from a standstill) pins the feet instead.
      this.speed = this.charging && this.chargePlanted ? 0 : input.moveY * TUNING.walkSpeed;
      this.lastTy = 0;
    } else {
      // SKATE: authored momentum. X (charge) is the only accelerator; input
      // against travel brakes hard (turnaround); input with travel coasts
      // easy; no input bleeds friction back toward walking pace. A slide is
      // canned: it ignores the stick entirely and keeps its momentum.
      if (this.slideTimer > 0) {
        // canned 8-axis slide: the along-course component lives in `speed`,
        // the cross component is applied in the lateral block below
        this.speed =
          this.slideSpd * (this.slideVec.x * this.axisF.x + this.slideVec.z * this.axisF.z);
      } else if (this.freeSkate) {
        // OMNIDIRECTIONAL SKATE: whichever way you push, the heading turns to
        // follow it — carrying your speed with it (a carve, not a brake), so
        // forward, sideways, and back are all first-class. X accelerates along
        // the heading; release everything and you coast down to your feet.
        const rx = this.rawInput.moveX;
        const ry = this.rawInput.moveY;
        if (rx !== 0 || ry !== 0) {
          const inv = 1 / Math.hypot(rx, ry);
          const dx = rx * inv;
          const dz = -ry * inv; // stick up = world -Z
          // signed angle from heading toward the stick, then turn (capped by
          // carveGrip) while KEEPING the speed — momentum survives the carve.
          const fwd = dx * this.axisF.x + dz * this.axisF.z;
          const side = dx * this.axisF.z - dz * this.axisF.x;
          const ang = Math.atan2(side, fwd);
          if (Math.abs(ang) > CONST.carveBrakeAngle) {
            // Pulling (nearly) opposite your travel = the brake, and THE
            // dismount: speed bleeds hard, and dropping under walking pace
            // hands you back to your feet with the stick in charge.
            // Diagonals still carve — only a true pull-back skids.
            if (this.speed > 12 && this.haltCd <= 0) {
              sfx.play('skateHalt', 0.6);
              this.haltCd = 0.6;
            }
            this.speed = Math.max(0, this.speed - TUNING.turnaround * dt);
            // classic dismount: braking through walking pace = step off, feet
            // take the stick next frame (rollout persistence must not fight it)
            if (this.speed <= TUNING.walkSpeed + 0.5) this.stepOff = true;
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
            else if (!this.charging) this.cruiseEase(dt, steepGround);
          }
        } else if (this.charging && this.speed > 1) {
          if (this.speed < TUNING.maxSpeed)
            this.speed = Math.min(this.speed + TUNING.chargeBoost * dt, TUNING.maxSpeed);
        } else {
          // TRULY idle (no stick, no X): friction bleeds you all the way to a
          // stop, below cruise. Coasting WITH a direction held (above) settles
          // to cruise and holds; letting go completely rolls you out.
          this.frictionBleed(dt, steepGround);
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
      if (Math.abs(ty) > 0.02) {
        // X held = attack the ramp: MORE boost downhill, LESS bleed uphill.
        const attack = ty < 0 ? (this.charging ? 1.3 : 0.8) : this.charging ? 0.55 : 0.8;
        this.speed += (ty < 0 ? TUNING.slopeBoost : TUNING.uphillSlowdown) * -ty * attack * dt;
      }
      // CROUCH-PUMP: X held on ground too steep to stand = working the
      // transition for speed, the honest way to build vert height. Scales
      // with steepness so the stretch below the coping pumps hardest.
      if (this.charging && this.groundHit && this.groundHit.normal.y < TUNING.steepStand) {
        this.speed += TUNING.pipePump * (1 - this.groundHit.normal.y) * dt;
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
        if (steepGround && this.speed < 2 && Math.abs(this.lastTy) < 0.15) {
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
      // A planted charge never sidesteps: the feet are pinned until release.
      const latRate = skating
        ? Math.max(TUNING.walkSpeed, Math.abs(this.speed) * 0.5)
        : TUNING.walkSpeed;
      this.pos.addScaledVector(this.axisL, input.moveX * latRate * dt);
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
    const hit = this.queryGround(level);
    const steepHit = hit !== null && hit.normal.y < CONST.steepSnapNormal;
    const upWindow = steepHit ? TUNING.wallStick : 0.8;
    const downWindow = steepHit ? TUNING.wallStick : 1.4;
    // Cresting a vert lip: the board was climbing a near-vertical face; now the
    // surface ahead has gone flat (the coping's backside). Convert the climb
    // straight into UP-air — the vertical launch IS the climb rate you earned
    // (speed up a near-vertical wall is almost all upward). No fudge cap: pump
    // harder, fly higher. The drop-in landing re-mints that energy as speed.
    if (
      hit &&
      this.speed > 0.5 &&
      this.lastTy > TUNING.vertLip &&
      hit.normal.y >= CONST.steepSnapNormal
    ) {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.airFromSkate = true; // vert launches only happen from riding
      this.vVel = Math.min(this.lastTy * this.speed, CONST.maxFallSpeed);
      // HANG is the default. Releasing X (or a fresh tap) at the lip OLLIES OUT
      // over the coping keeping your speed; holding X keeps you in the pipe.
      this.enterVertAir(
        input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0,
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
      // A near-vertical lip (halfpipe coping) is hang time unless you ollie out.
      if (this.vVel > 0.5 && this.lastTy > TUNING.vertLip) {
        this.enterVertAir(
          input.jumpReleased || input.jumpPressed || this.jumpBufferT > 0,
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
        this.chargedJump(dt);
      }
    }
  }

  private stepAir(dt: number, input: Input, level: Level): void {
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

    // Circle + down: pancake body slam, Wile E. Coyote rules — engage, FREEZE
    // in the air for a beat (momentum screeches to nothing), then plummet.
    // The impact breaks everything around you (TNT pops safely, nitro does NOT).
    // VERT HANG TIME: glued to the wall. The planar position eases back to
    // the launch plane (gravity brings you down INTO the transition), while
    // the stick drifts you along the coping — never away from the wall.
    if (this.vertAir) {
      const g = Math.min(1, TUNING.vertGlue * dt);
      const dx = this.pos.x - this.vertAnchor.x;
      const dz = this.pos.z - this.vertAnchor.z;
      const d = dx * this.vertNormal.x + dz * this.vertNormal.z;
      this.pos.x -= this.vertNormal.x * d * g;
      this.pos.z -= this.vertNormal.z * d * g;
      const rx = this.rawInput.moveX;
      const ry = this.rawInput.moveY;
      if (rx !== 0 || ry !== 0) {
        const tx = -this.vertNormal.z; // wall tangent (along the coping)
        const tz = this.vertNormal.x;
        const inv = 1 / Math.hypot(rx, ry);
        const along = rx * inv * tx + -ry * inv * tz;
        this.pos.x += tx * along * TUNING.vertDrift * dt;
        this.pos.z += tz * along * TUNING.vertDrift * dt;
      }
    }

    if (!this.slamActive && input.grabHeld && this.rawInput.moveY < -0.5) {
      this.slamActive = true;
      this.vertAir = false; // the slam plummets straight down, no wall glue
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
      const g = this.vVel > 0 ? TUNING.riseGravity : TUNING.fallGravity;
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
    if (!this.grabbing && !this.slamActive && !this.vertAir) {
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
    this.pos.y += this.vVel * dt;

    const hit = this.queryGround(level);
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
    // step, and that's a landing, not a clip-through.
    const landGive = hit && hit.normal.y < CONST.steepSnapNormal ? TUNING.landGive : 0.35;
    if (
      hit &&
      this.vVel <= 0 &&
      this.pos.y <= hit.y + 0.05 &&
      (this.prevPos.y >= hit.y - 0.05 || this.pos.y >= hit.y - landGive)
    ) {
      this.pos.y = hit.y;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.coyoteTimer = 0;
      this.airMomentum = false; // touchdown: normal ground rules resume
      this.rideNormal.copy(hit.normal); // fresh landing: ride plane snaps, no stale blend
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
      }
      // Landing-tick payouts (grab, slam impact) are still air tricks
      // for combo purposes even though the state just flipped to 'ride'.
      this.landingScoring = true;

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
      const funny = spun && dev0 > tol && devPi > tol;
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
        // pose is neutral and the spin lines up with 0 or 180
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
          this.speed += TUNING.grabBoost * (this.speed >= 0 ? 1 : -1);
          const cap = TUNING.downhillMax;
          this.speed = THREE.MathUtils.clamp(this.speed, -cap, cap);
          this.score(CONST.ptsGrab, this.grabTrickName);
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
      if (Math.abs(this.speed) > TUNING.boardSpeed) sfx.play('skateTransition', 0.5);
      // Safe landing = the combo is over: bank it on the spot.
      this.bankCombo();
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
      if (!c.alive || c.bouncy) continue;
      const p = c.mesh.position;
      const dx = p.x - this.pos.x;
      const dz = p.z - this.pos.z;
      if (dx * dx + dz * dz > TUNING.slamRadius * TUNING.slamRadius) continue;
      if (Math.abs(p.y - this.pos.y) > 1.8) continue;
      if (c.tnt) level.detonate(c, true);
      else if (c.nitro) level.detonate(c);
      else this.smashCrate(level, c);
    }
    for (const e of level.enemies) {
      if (e.alive && e.group.position.distanceTo(this.pos) < TUNING.slamRadius + 0.6) {
        level.killEnemy(e);
        this.score(CONST.ptsEnemy, 'Flattened');
      }
    }
    // A landed slam is a safe landing too: bank the string.
    this.bankCombo();
  }

  // Leaving a vert lip. HANG is the default (glue to the wall plane, drop back
  // into the same transition). airOut = the player released/tapped X at the lip
  // to OLLIE OUT over the coping: keep all your speed, no glue, a plain board
  // air. (vVel — the launch height — is already set by the caller.)
  private enterVertAir(airOut: boolean): void {
    if (airOut) {
      this.vVel += TUNING.grindJumpForce * 0.4; // a deliberate pop over the lip
      this.charging = false;
      this.chargeTimer = 0;
      return;
    }
    // HANG: park planar speed — the energy is in vVel now, and the drop-in
    // landing converts it back into speed DOWN the wall (see the touchdown
    // block). No reverse-and-delete: momentum is conserved through the cycle.
    this.speed = 0;
    this.vertNormal.set(this.rideNormal.x, 0, this.rideNormal.z);
    const nl = this.vertNormal.length();
    if (nl < 1e-4) return; // degenerate lip: plain air
    this.vertNormal.divideScalar(nl);
    // glue plane sits a hair INSIDE the pipe, so the drop lands on the
    // transition face proper rather than balancing on the coping line
    this.vertAnchor.copy(this.pos).addScaledVector(this.vertNormal, 1.2);
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
    const bleed = steep
      ? TUNING.friction * dt
      : TUNING.friction * dt * (0.35 + 0.65 * Math.min(1, s / Math.max(TUNING.maxSpeed, 1)));
    this.speed -= Math.sign(this.speed) * Math.min(bleed, s);
  }

  // Botched a grab landing: no death — you eat the floor, the pending combo
  // is gone, and you lie flat for a beat before getting up right where you
  // fell. (A mask upstream absorbs the bail entirely, same as before.)
  private bail(): void {
    this.bailDownT = CONST.bailDownTime;
    this.speed = 0;
    this.vVel = 0;
    this.invulnTimer = CONST.maskInvuln; // nothing chews you while you're down
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.comboLabels = [];
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
    this.snapEase = Math.min(1, this.snapEase + dt / CONST.railSnapEase);
    // Grinds ride at the speed you brought and bleed a little on the rail
    // (nosegrinds hold their speed better).
    const bleed = this.grindStyle === 'nose' ? CONST.grindBleed * 0.4 : CONST.grindBleed;
    this.grindVel = Math.max(CONST.grindMinSpeed, this.grindVel - bleed * dt);

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
    if (this.uberTimer > 0) this.balance = 0; // perfect balance
    if (Math.abs(this.balance) >= 1) {
      this.balance = Math.sign(this.balance); // pinned at the edge, flailing
      this.balanceCritT += dt;
      if (this.balanceCritT > TUNING.bailGrace) {
        // A mask absorbs the bail: the needle resets and the grind continues.
        if (this.spendMask()) {
          this.balance = 0;
          this.grindTime = 0;
          this.balanceCritT = 0;
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

    this.grindT += this.grindDir * this.grindVel * dt;

    if (this.grindT <= 0 || this.grindT >= rail.totalLength) {
      // Ran off the end of the rail: small pop, keep carrying grind speed.
      this.grindT = THREE.MathUtils.clamp(this.grindT, 0, rail.totalLength);
      this.placeOnRail(rail);
      this.exitGrind(2.5);
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
    this.emitSparks(1, 0xffb545, 1); // grind sparks off the truck

    if (input.jumpHeld) {
      this.charging = true;
      this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
    }
    if (input.jumpReleased && this.charging) {
      const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
      this.charging = false;
      this.chargeTimer = 0;
      this.lastJumpType = 'Grind Exit';
      sfx.play('ollie', 0.7);
      this.exitGrind(THREE.MathUtils.lerp(TUNING.grindJumpForce * 0.72, TUNING.grindJumpForce, t));
      // grind exits are board airs: no somersault
    }
  }

  private stepFinished(dt: number, level: Level): void {
    this.speed = Math.max(0, this.speed - 40 * dt);
    this.pos.addScaledVector(FORWARD, this.speed * dt);
    // Keep the outro on the deck: no sliding sideways off the edge into a
    // midair hover after the run is already over.
    this.pos.x = THREE.MathUtils.clamp(
      this.pos.x,
      level.finishBox.min.x + 1.5,
      level.finishBox.max.x - 1.5,
    );
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
    if (this.regrindCd > 0 || !this.railCand) return false;
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
    const canSpin = this.state === 'ride' || this.state === 'air' || this.state === 'grind';
    if (input.spinPressed && !this.spinning && this.spinCd <= 0 && canSpin) {
      this.spinTimer = TUNING.spinDuration;
      sfx.play(['spin1', 'spin2', 'spin3'][Math.floor(Math.random() * 3)], 0.5);
      if (this.state === 'air' && this.vVel < 7) {
        // Tiny Crash-style stall. Never boosts an already-rising jump.
        this.vVel = Math.min(this.vVel + TUNING.spinAirCorrection, 7);
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

  private updateGrab(dt: number, input: Input): void {
    this.grabGraceTimer = Math.max(0, this.grabGraceTimer - dt);
    if (this.state === 'air') {
      if (input.grabHeld && !this.slamActive && this.airFromSkate) {
        // Reach into the pose over grabTransition, then hold it.
        if (this.grabPhase === 'none' || this.grabPhase === 'exit') {
          this.grabPhase = 'enter';
          this.grabT = 0;
          this.grabTrickName = 'Grab';
          this.grabTickT = 0;
          sfx.play('woosh2', 0.4);
        } else if (this.grabPhase === 'enter') {
          this.grabT += dt;
          if (this.grabT >= CONST.grabTransition) this.grabPhase = 'held';
        }
        // Circle + left/right = grab-spin THAT way (left arrow spins left).
        // The trajectory is locked either way — but land mid-pose or off-axis
        // and you bail.
        if (Math.abs(this.rawInput.moveX) > 0.3) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(this.rawInput.moveX) * dt;
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
        // HANG-TIME SPIN: glued to the wall, the stick alone spins you —
        // no grab needed. Same spin fields, so landing rules and switch
        // stance judge it exactly like a grab-spin.
        if (this.vertAir && !this.slamActive && Math.abs(this.rawInput.moveX) > 0.3) {
          this.grabSpinAngle -= TUNING.grabSpinRate * Math.sign(this.rawInput.moveX) * dt;
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

  private updateSparks(dt: number): void {
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.visible = false;
        continue;
      }
      s.vel.y -= 22 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.setScalar(Math.max(s.life / s.maxLife, 0.25));
    }
  }

  // ------------------------------------------------------------- collision --

  private collide(level: Level): void {
    const half = CONST.playerHalf;
    const center = new THREE.Vector3(this.pos.x, this.pos.y + half.y, this.pos.z);
    this.playerBox.setFromCenterAndSize(center, new THREE.Vector3(half.x * 2, half.y * 2, half.z * 2));
    // On a rail the board and trucks hang BELOW the feet — reach down so
    // crates sitting on the rail line still clip a grinder.
    if (this.state === 'grind') this.playerBox.min.y -= 0.35;
    this.spinBox.copy(this.playerBox);
    if (this.spinning) {
      this.spinBox.expandByVector(new THREE.Vector3(CONST.spinReach, 0.2, CONST.spinReach));
    }

    for (const c of level.crates) {
      if (!c.alive) continue;
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
              this.charging = false;
              this.chargeTimer = 0;
            }
          } else if (this.isBonking(c.box)) {
            level.lightFuse(c);
            this.vVel = -1;
          } else {
            this.pushOutOf(c.box);
          }
        }
        continue;
      }
      if (c.bouncy) {
        // Arrow crate: land on it for a super bounce; it never breaks.
        // PERFECT BOUNCE: pressing X within arrowBoostWindow of the impact
        // (the classic "jump right at the bottom" timing) adds a little
        // extra launch — the press is consumed so it can't carry to chains.
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.isStomping(c.box) && this.slamActive) {
            // Crash rules: the body slam is the ONE move that breaks an arrow
            // crate. Also load-bearing: without it the slam's down-force
            // re-stomps the trampoline every frame — infinite Boing points
            // with the controls locked. Broken by hand (not smashCrate)
            // because bouncy crates sit outside the all-boxes gem tally.
            level.breakCrate(c);
            this.score(CONST.ptsCrate, 'Slam Smash');
            this.spawnFruit(c.box);
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

    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (this.spinning && this.spinBox.intersectsBox(e.box)) {
        // Spin PINGS the enemy away — it can smash crates it happens to hit.
        const fling = e.group.position.clone().sub(this.pos).setY(0);
        if (fling.lengthSq() < 0.01) fling.copy(this.axisF).multiplyScalar(Math.sign(this.speed || 1));
        fling.normalize().multiplyScalar(42); // pinball ricochet
        fling.y = 10;
        level.killEnemy(e, fling);
        this.score(CONST.ptsEnemy, 'Takedown');
      } else if (this.playerBox.intersectsBox(e.box)) {
        if (this.uberTimer > 0 || this.sliding) {
          // Uber plows through; Crash 3 rules: the slide takes out enemies too.
          level.killEnemy(e);
          this.score(CONST.ptsEnemy, 'Takedown');
        } else if (this.isStomping(e.box)) {
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
          // Plain touch: invuln grace applies, and a mask absorbs it with a
          // knockback away from the enemy (Crash rules — the video showed a
          // death WITH a mask in hand, which was flatly wrong). The touch
          // box is slightly forgiving; stomps/spins keep the full box.
          if (this.invulnTimer > 0) continue;
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
    for (const hz of level.killBoxes) {
      if (this.playerBox.intersectsBox(hz)) {
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
    if (this.state !== 'grind') {
      for (const w of level.walls) {
        if (this.playerBox.intersectsBox(w)) {
          this.pushOutOf(w);
        }
      }
    }

    for (const cp of level.checkpoints) {
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
      if (!p.alive) continue;
      if (this.spinning && this.spinBox.intersectsBox(p.box)) {
        p.alive = false;
        p.mesh.visible = false;
        sfx.play('fruitSpun', 0.7);
      } else if (this.playerBox.intersectsBox(p.box)) {
        p.alive = false;
        p.mesh.visible = false;
        this.collectFruit();
      }
    }

    // The level crystal: ride/walk/fly through it and it's yours (a death
    // won't take it back; only a hard reset re-seats it).
    const cr = level.crystalPickup;
    if (cr && !cr.collected && this.playerBox.intersectsBox(cr.box)) {
      this.hasCrystal = true;
      level.collectCrystal();
      sfx.play('crystalGet', 0.9);
      this.score(CONST.ptsCrystal, 'Crystal');
      this.onRelic('CRYSTAL GET!', '');
    }

    if (this.playerBox.intersectsBox(level.finishBox)) {
      this.bankCombo(); // whatever is pending counts at the line
      sfx.play('lifeGet', 1.0);
      this.state = 'finished';
      this.onFinish(this.runTime);
    }
  }

  private smashCrate(level: Level, c: Crate): void {
    level.breakCrate(c);
    this.cratesBroken++;
    this.score(CONST.ptsCrate, 'Box');
    this.crateReward(c);
  }

  // What falls out of a broken box. Mystery crates roll their contents.
  private crateReward(c: Crate): void {
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
      f.mesh.position.set(cx, cy + 0.3, cz);
      f.vel.set((Math.random() - 0.5) * 5, 6 + Math.random() * 4, (Math.random() - 0.5) * 5);
    }
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
        // home to the player and collect
        const target = new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z);
        const d = target.sub(f.mesh.position);
        const dist = d.length();
        if (dist < 1.0 || f.age > 2.5) {
          if (dist < 1.0 && this.spinning) {
            // spinning smacks the wumpa away instead of collecting it
            f.flung = true;
            f.age = 0;
            f.vel.set((Math.random() - 0.5) * 16, 8, (Math.random() - 0.5) * 16);
            sfx.play('fruitSpun', 0.7);
            continue;
          }
          if (dist < 1.0) this.collectFruit();
          f.age = -1;
          f.mesh.visible = false;
          continue;
        }
        f.mesh.position.addScaledVector(d.normalize(), Math.max(18, dist * 6) * dt);
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

  private die(): void {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.lives--;
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

  private queryGround(level: Level, ox = 0, oz = 0): GroundHit | null {
    this.raycaster.set(new THREE.Vector3(this.pos.x + ox, this.pos.y + 2.5, this.pos.z + oz), DOWN);
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
    return {
      y: hit.point.y,
      normal,
      name: hit.object.name,
      moverId: hit.object.userData.moverId as number | undefined,
      crumbleId: hit.object.userData.crumbleId as number | undefined,
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
    if (this.vertAir) {
      alignT = 1; // hang time: fully on the wall plane
      targetN = this.vertNormal;
    } else if (this.grounded && this.state === 'ride' && this.groundHit) {
      // steepness-weighted: upright at/above steepStand, fully lying by ~vert
      const flatY = TUNING.steepStand;
      const vertY = 0.25;
      const t = THREE.MathUtils.clamp((flatY - this.rideNormal.y) / (flatY - vertY), 0, 1);
      alignT = t * t * (3 - 2 * t); // smoothstep
      targetN = this.rideNormal;
    }
    this.alignPose += (alignT - this.alignPose) * Math.min(1, 12 * dt);
    if (targetN) {
      this.alignNormal.lerp(targetN, Math.min(1, 12 * dt));
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
    const onFoot =
      this.grounded &&
      this.state === 'ride' &&
      !this.charging &&
      !this.freeSkate &&
      this.slideTimer <= 0 &&
      !this.crawling &&
      Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
    const runningAnim = onFoot && planar > 1.5;
    this.walkAmp += ((runningAnim ? 1 : 0) - this.walkAmp) * Math.min(1, 10 * dt);
    this.idleAmp += ((onFoot && !runningAnim ? 1 : 0) - this.idleAmp) * Math.min(1, 6 * dt);
    if (runningAnim) this.walkPhase += (4 + planar * 1.0) * dt;
    else if (this.crawling && planar > 0.5) this.walkPhase += (2 + planar * 0.8) * dt;
    // Grind style lean: nose down, tail down, or body across the rail.
    const gp =
      this.state === 'grind' ? (this.grindStyle === 'nose' ? 0.4 : this.grindStyle === 'five0' ? -0.45 : 0) : 0;
    this.grindPoseX += (gp - this.grindPoseX) * Math.min(1, 12 * dt);
    const gy = this.state === 'grind' && this.grindStyle === 'board' ? this.grindYawDir * (Math.PI / 2) : 0;
    this.grindYawPose += (gy - this.grindYawPose) * Math.min(1, 12 * dt);
    const swing = Math.sin(this.walkPhase) * 0.65 * Math.max(this.walkAmp, this.crawlPose * 0.6);
    const breathe = Math.sin(this.runTime * 2.3);
    // Flip tuck: knees snap to the chest through the somersault (peaks mid-air).
    const flipProg = this.flipTimer > 0 ? 1 - this.flipTimer / CONST.flipDuration : 0;
    const flipTuck = flipProg > 0 ? Math.sin(flipProg * Math.PI) : 0;
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
    // Side-on stance target: whenever the board is genuinely under you —
    // rolling, plain skate airs (grabs square back up; their poses are
    // authored in the forward frame), and grinds except boardslides (the
    // grindYawPose owns that body turn). The yaw itself is applied above.
    const sideOn =
      onBoard ||
      (this.state === 'grind' && this.grindStyle !== 'board') ||
      (this.state === 'air' && this.airFromSkate && !this.grabbing && !this.slamActive && this.grabPose < 0.3);
    this.sidePose += ((sideOn ? 1 : 0) - this.sidePose) * Math.min(1, 8 * dt);
    // Crash star jump: legs split wide, arms thrown up — held for a beat
    // after crouch/slide jumps, fading the moment you land.
    if (this.state !== 'air') this.starTimer = 0;
    else this.starTimer = Math.max(0, this.starTimer - dt);
    this.starPose += ((this.starTimer > 0 ? 1 : 0) - this.starPose) * Math.min(1, 14 * dt);
    const star = this.starPose;
    if (this.legL && this.legR) {
      // baseball slide: lead leg kicked out ahead, trailing leg half-bent
      this.legL.rotation.x = swing + 1.6 * flipTuck + 0.55 * this.slidePose;
      this.legR.rotation.x = -swing + 1.6 * flipTuck + 1.35 * this.slidePose;
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
      const tuck = 1.35 * this.grabPose + 1.1 * flipTuck + 1.2 * this.crawlPose;
      const backL = 0.9 * Math.max(0, Math.sin(this.walkPhase)) * this.walkAmp;
      const backR = 0.9 * Math.max(0, -Math.sin(this.walkPhase)) * this.walkAmp;
      const stanceR = 0.7 * sk + 0.5 * this.grindArmPose + 0.85 * this.chargePose; // front leg
      const stanceL = 0.5 * sk + 0.5 * this.grindArmPose + 0.85 * this.chargePose; // back leg
      this.kneeR.rotation.x = straight * (stanceR + tuck + backR + 0.35 * this.slidePose);
      this.kneeL.rotation.x = straight * (stanceL + tuck + backL + 1.0 * this.slidePose);
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
      const counter = -swing * 0.22;
      this.upperG.rotation.y +=
        (stance + counter - this.upperG.rotation.y) * Math.min(1, 10 * dt);
    }
    if (this.headM) {
      const look =
        -0.6 * this.crawlPose -
        0.5 * this.dropPose -
        0.4 * this.slidePose -
        0.3 * this.chargePose -
        0.45 * this.grabPitch * this.grabPose +
        0.3 * this.hangPose -
        0.55 * this.slopePose;
      this.headM.rotation.x +=
        (THREE.MathUtils.clamp(look, -1.0, 0.6) - this.headM.rotation.x) * Math.min(1, 12 * dt);
      // Side-on: the head turns back over the lead shoulder to watch the
      // line of travel (the body faces across the board; the eyes don't).
      const headYaw = -0.85 * this.stance * this.sidePose;
      this.headM.rotation.y += (headYaw - this.headM.rotation.y) * Math.min(1, 12 * dt);
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
    this.grindArmPose += ((this.state === 'grind' ? 1 : 0) - this.grindArmPose) * Math.min(1, 10 * dt);

    // Arm channels. ANTI-symmetric: the run swing (arms counter the legs).
    // SYMMETRIC (both arms together): crawl hands to the ground, charge
    // wind-up (arms swept back, loading the spring), flip tuck wrap, teeter
    // windmill, pegged-needle flail, bail flail.
    const windmill = this.teeterPose * Math.sin(this.teeterPhase * 13) * 1.3;
    const critFlail = this.balanceCritT > 0 ? Math.sin(this.runTime * 22) * 0.8 : 0;
    const bailFlail = this.bailing ? Math.sin(this.bailSpin * 2.7) * 1.1 : 0;
    const anti = -swing * 0.9 * (1 - this.grabPose);
    const sym =
      (breathe * 0.06 * this.idleAmp +
        0.8 * this.crawlPose - // hands down-forward to the ground
        0.95 * this.chargePose +
        1.9 * flipTuck +
        windmill +
        critFlail +
        bailFlail) *
      (1 - this.grabPose);
    // Slide: trailing hand drags behind, lead arm reaches ahead.
    const slideR = -1.1 * this.slidePose;
    const slideL = 0.7 * this.slidePose;
    if (this.armR) {
      this.armR.rotation.x = this.armRPose * this.grabPose + anti + sym + slideR;
      this.armR.rotation.z =
        0.25 -
        this.grabPose * 0.55 +
        1.15 * this.grindArmPose * (1 + 0.6 * this.balance) + // balance arms out wide
        1.25 * this.dropPose + // slam starfish
        2.1 * this.starPose + // star jump: arms thrown up-out
        0.35 * this.skatePose; // loose skate arms
    }
    if (this.armL) {
      this.armL.rotation.x =
        this.armLPose * this.grabPose - anti + sym + slideL + swing * 1.6 * this.crawlPose;
      this.armL.rotation.z =
        -0.25 +
        this.grabPose * 0.45 -
        1.15 * this.grindArmPose * (1 - 0.6 * this.balance) -
        1.25 * this.dropPose -
        2.1 * this.starPose - // star jump: arms thrown up-out
        0.35 * this.skatePose;
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
          0.5 * this.grabPose -
          0.4 * flipTuck -
          0.43 * this.chargePose * this.skatePose -
          0.45 * this.crawlPose -
          0.25 * this.slidePose,
      );
    }
    if (this.boardG) {
      // The charge crouch drops the whole bodyGroup 0.26 (world) — the board
      // rides that group, so push it back up (0.26 / the 1.18 body scale) to
      // keep the wheels ON the ground instead of clipping through it.
      this.boardG.position.y = 0.5 * this.grabPose + 0.22 * this.chargePose;
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
        (this.state === 'grind' ||
          (this.charging && Math.abs(this.speed) > TUNING.walkSpeed + 0.5) ||
          this.freeSkate ||
          this.grabPose > 0.05 ||
          (Math.abs(this.speed) > TUNING.boardSpeed && !this.slideFromWalk));
    }
    this.bodyGroup.rotation.z = this.slopeRoll;
    if (this.upperG) this.upperG.rotation.z = this.grabRoll * this.grabPose;
    // Mask hovers at the shoulder; the whole body flickers during
    // mask-invulnerability grace.
    this.bodyGroup.visible =
      this.invulnTimer <= 0 || Math.sin(this.runTime * 45) > -0.2 || this.state === 'dead';
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
    const flip =
      this.flipTimer > 0 ? (1 - this.flipTimer / CONST.flipDuration) * Math.PI * 2 : 0;
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
        1.25 * this.crawlPose - // all fours: torso pitched right over
        0.55 * this.hangPose + // rear back: "...uh oh"
        1.45 * this.dropPose - // belly-first pancake
        0.28 * this.teeterPose + // arms-back "whoa whoa" lean
        0.18 * this.skatePose + // athletic crouch over the board
        runLean +
        this.slopePose + // lie along the ramp/transition under the board
        this.grindPoseX; // nosegrind / 5-0 lean
    }
    const targetCharge = this.charging ? 0.35 + 0.65 * Math.min(1, this.chargeTimer / TUNING.jumpChargeTime) : 0;
    this.chargePose += (targetCharge - this.chargePose) * Math.min(1, 16 * dt);
    // Crouch drops. The crawl and slam use SMALL drops: their pitch already
    // lays the torso out at ground level, and the old deep crawl drop was
    // burying the whole body under the floor.
    this.bodyGroup.position.y =
      this.grabPose * -0.5 -
      this.slidePose * 0.38 -
      this.crawlPose * 0.12 -
      this.chargePose * 0.26 -
      (this.grounded ? 0.1 * this.dropPose : 0) +
      Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.walkAmp +
      breathe * 0.015 * this.idleAmp;
    // Impact squash right after a slam lands.
    const squash = this.slamSquash > 0 ? this.slamSquash / CONST.slamSquashTime : 0;
    this.bodyGroup.scale.y = 1.36 * (1 - 0.6 * squash);

    // A bail stays visible so the tumble reads; a plain death blinks out.
    this.group.visible = (this.state !== 'dead' && this.state !== 'gameover') || this.bailing;

    // Blob shadow: persistent landing indicator, snapped to whatever floor is
    // below no matter how high the air. Shrinks with height but never fades.
    if (this.shadowGroundY !== null && this.state !== 'dead' && this.state !== 'gameover') {
      const h = Math.max(0, this.pos.y - this.shadowGroundY);
      this.shadow.visible = true;
      this.shadow.position.set(this.pos.x, this.shadowGroundY + 0.03, this.pos.z);
      this.shadow.scale.setScalar(THREE.MathUtils.clamp(1.3 - h * 0.045, 0.4, 1.3));
    } else {
      this.shadow.visible = false; // no shadow = you are over the pit
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
    const wheelM = new THREE.MeshLambertMaterial({ color: 0xffd23f }); // urethane
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

    // Rider legs: hip-pivot groups with a REAL knee joint each — thigh
    // capsule down to a knee group carrying shin + shoe + pad — so crouches
    // read as bent-knee posture, not stretched planks. syncVisual owns every
    // joint angle; total reach matches the old one-piece leg (~0.5 hip→sole).
    const legs = new THREE.Group();
    legs.position.y = 0.71; // hip line
    const denimM = lam(this.paintTex(128, (ctx) => {
      // worn denim: soft indigo wash, broad knee fade, rolled hem, one
      // drifting outseam stitch
      const wash = ctx.createLinearGradient(0, 0, 0, 128);
      wash.addColorStop(0, '#3c5a7c');
      wash.addColorStop(0.5, '#35506e');
      wash.addColorStop(1, '#2c4460');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, 128, 128);
      this.airbrush(ctx, 128, '190,210,235', 0.1, 14, 10, 26);
      this.airbrush(ctx, 128, '18,32,52', 0.12, 10, 12, 30);
      const wear = ctx.createRadialGradient(64, 72, 4, 64, 72, 34);
      wear.addColorStop(0, 'rgba(170,200,225,0.35)');
      wear.addColorStop(1, 'rgba(170,200,225,0)');
      ctx.fillStyle = wear;
      ctx.fillRect(28, 36, 72, 72);
      ctx.fillStyle = '#26374a';
      ctx.fillRect(0, 118, 128, 10); // rolled hem (ankle on the shin, knee shadow on the thigh)
      ctx.strokeStyle = 'rgba(232,163,61,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.quadraticCurveTo(3, 64, 8, 118);
      ctx.stroke();
    }));
    const shoeM = lam(this.paintTex(64, (ctx) => {
      // chunky skate shoe on a squashed sphere: pale upper, lace crosses up
      // top, gum sole wrapping the underside
      const upper = ctx.createLinearGradient(0, 0, 0, 64);
      upper.addColorStop(0, '#f4f1e8');
      upper.addColorStop(0.7, '#e6e1d4');
      upper.addColorStop(1, '#d8d2c2');
      ctx.fillStyle = upper;
      ctx.fillRect(0, 0, 64, 64);
      this.airbrush(ctx, 64, '120,120,130', 0.14, 8, 5, 12);
      ctx.fillStyle = '#b98a52';
      ctx.fillRect(0, 50, 64, 14); // gum sole
      ctx.fillStyle = '#2b2e35';
      ctx.fillRect(0, 47, 64, 3); // foxing stripe
      ctx.strokeStyle = '#8d94a3';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(22 + i * 7, 8);
        ctx.lineTo(28 + i * 7, 18);
        ctx.moveTo(28 + i * 7, 8);
        ctx.lineTo(22 + i * 7, 18);
        ctx.stroke();
      }
    }));
    const padM = new THREE.MeshLambertMaterial({ color: 0x2b2e35 });
    const thighGeo = new THREE.CapsuleGeometry(0.085, 0.14, 3, 10);
    thighGeo.translate(0, -0.15, 0); // hip → knee
    const shinGeo = new THREE.CapsuleGeometry(0.068, 0.12, 3, 10);
    shinGeo.translate(0, -0.11, 0); // knee → ankle
    const shoeGeo = new THREE.SphereGeometry(0.105, 10, 8);
    const padGeo = new THREE.SphereGeometry(0.08, 8, 6);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); // hip pivot — syncVisual writes rot + pos
      leg.position.x = side * 0.115;
      legs.add(leg);
      leg.add(new THREE.Mesh(thighGeo, denimM));
      // Knee group pivots where the thigh ends; shin/shoe/pad swing with it
      // and squash with legs.scale.y, same as everything else on the rig.
      const knee = new THREE.Group();
      knee.position.y = -0.26;
      leg.add(knee);
      knee.add(new THREE.Mesh(shinGeo, denimM));
      const shoe = new THREE.Mesh(shoeGeo, shoeM);
      shoe.scale.set(1, 0.55, 1.6);
      shoe.position.set(0, -0.21, 0.05);
      knee.add(shoe);
      const pad = new THREE.Mesh(padGeo, padM); // kneepad dome over the joint
      pad.scale.set(1, 0.85, 0.7);
      pad.position.set(0, -0.01, 0.075);
      knee.add(pad);
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

    // Tee: ONE wrapped canvas on a lathe torso — phiStart 1.5π puts u=0.25
    // (canvas x=32) at local +Z, so the chest sunburst paints at x=32 and the
    // race number at x=96 lands square on the back, no mirroring. Broad
    // shoulders easing into the waist come from the profile, not a box.
    const teeM = lam(this.paintTex(128, (ctx) => {
      const fabric = ctx.createLinearGradient(0, 0, 0, 128);
      fabric.addColorStop(0, '#37b191');
      fabric.addColorStop(0.6, '#2fa88d');
      fabric.addColorStop(1, '#27957c');
      ctx.fillStyle = fabric;
      ctx.fillRect(0, 0, 128, 128);
      this.airbrush(ctx, 128, '255,255,255', 0.07, 12, 10, 26);
      this.airbrush(ctx, 128, '0,70,58', 0.1, 10, 12, 30);
      ctx.fillStyle = '#1d6e5d';
      ctx.fillRect(0, 0, 128, 7); // collar band
      ctx.fillRect(0, 120, 128, 8); // hem right at the hip line
      ctx.fillStyle = '#ff7a1f'; // chest sunburst, warm core
      this.starPath(ctx, 32, 52, 17, 7);
      ctx.fill();
      const core = ctx.createRadialGradient(32, 52, 1, 32, 52, 8);
      core.addColorStop(0, '#fff3c4');
      core.addColorStop(1, '#ffd23f');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(32, 52, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4f1e6';
      ctx.font = 'bold 34px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('98', 96, 64); // race number
    }));
    const torsoProfile = [
      new THREE.Vector2(0.06, -0.3), // tucked under the hem
      new THREE.Vector2(0.17, -0.27),
      new THREE.Vector2(0.2, -0.16),
      new THREE.Vector2(0.215, -0.04),
      new THREE.Vector2(0.235, 0.08),
      new THREE.Vector2(0.26, 0.2), // shoulder
      new THREE.Vector2(0.24, 0.27),
      new THREE.Vector2(0.1, 0.31), // roll off to the collar
    ];
    const torso = new THREE.Mesh(
      new THREE.LatheGeometry(torsoProfile, 12, Math.PI * 1.5, Math.PI * 2),
      teeM,
    );
    torso.scale.z = 0.7; // chest oval, not a tube
    // Upper body rides in its own group so the shoulders can open side-on
    // (skate stance) and counter-swing against the run without dragging the
    // hips, legs, or board around with them.
    const upper = new THREE.Group();
    torso.position.y = 0.98;
    upper.add(torso);

    // Head: one sphere, everything painted into the wrap — three's sphere
    // puts local +Z at u=0.25, so the face (whites, irises, cocked brows,
    // grin) sits around canvas x=32, hair crowns the top rows and pools at
    // the back (x=96), ears ride the u=0/u=0.5 seams. headM still pitches in
    // syncVisual for the horizon look-at.
    const skin = '#e8c39a';
    const hair = '#4a2e1a';
    const headTexM = lam(this.paintTex(128, (ctx) => {
      ctx.fillStyle = skin;
      ctx.fillRect(0, 0, 128, 128);
      this.airbrush(ctx, 128, '200,120,60', 0.08, 12, 8, 22);
      ctx.fillStyle = hair;
      ctx.fillRect(0, 0, 128, 22); // crown band under the cap
      for (let x = 4; x <= 124; x += 12) {
        ctx.beginPath(); // soft fringe scallops
        ctx.arc(x, 22, 6, 0, Math.PI);
        ctx.fill();
      }
      ctx.beginPath(); // back of the skull
      ctx.ellipse(96, 40, 30, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d4a97e';
      for (const ex of [0, 128, 64]) {
        ctx.beginPath(); // ears — drawn at both seam edges so they join
        ctx.ellipse(ex, 58, 6, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#3a2413'; // brows, one cocked higher — mid-trick face
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(18, 47);
      ctx.quadraticCurveTo(24, 43, 30, 46);
      ctx.moveTo(34, 44);
      ctx.quadraticCurveTo(40, 40, 46, 44);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const ex of [25, 39]) {
        ctx.beginPath();
        ctx.ellipse(ex, 56, 6, 7.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const ex of [26.5, 37.5]) {
        ctx.fillStyle = '#2e7f6a'; // irises pulled toward the nose: focus
        ctx.beginPath();
        ctx.arc(ex, 57, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#20232b';
        ctx.beginPath();
        ctx.arc(ex, 57, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#d4a97e';
      ctx.beginPath(); // nose
      ctx.ellipse(32, 64, 3.5, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5e2413'; // big Crash grin, corners turned up
      ctx.beginPath();
      ctx.moveTo(18, 71);
      ctx.quadraticCurveTo(32, 87, 46, 71);
      ctx.quadraticCurveTo(32, 77, 18, 71);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); // tooth row along the top lip
      ctx.moveTo(20, 71.5);
      ctx.quadraticCurveTo(32, 76, 44, 71.5);
      ctx.quadraticCurveTo(32, 80, 20, 71.5);
      ctx.fill();
      for (const bx of [16, 48]) {
        const blush = ctx.createRadialGradient(bx, 63, 1, bx, 63, 8);
        blush.addColorStop(0, 'rgba(235,130,90,0.35)');
        blush.addColorStop(1, 'rgba(235,130,90,0)');
        ctx.fillStyle = blush;
        ctx.fillRect(bx - 8, 55, 16, 16);
      }
      ctx.fillStyle = 'rgba(150,80,40,0.5)';
      for (const [x, y] of [[16, 68], [20, 70], [44, 69], [48, 67]]) {
        ctx.beginPath(); // freckles
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10), headTexM);
    head.scale.set(1, 1.05, 0.95);
    head.position.y = 1.42;
    upper.add(head);
    this.headM = head;
    // Backwards cap: sphere-slice crown + curved half-cylinder rear brim as
    // head children, so every nod and look-at pitch carries them for free.
    const capM = new THREE.MeshLambertMaterial({ color: 0xf04e23 });
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.38),
      capM,
    );
    crown.position.y = 0.02;
    crown.rotation.x = -0.12; // front rim lifted off the brows
    head.add(crown);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.19, 0.03, 9, 1, false, Math.PI / 2, Math.PI),
      capM,
    );
    brim.position.set(0, 0.075, -0.06);
    brim.rotation.x = -0.25; // rear brim dips off the crown
    head.add(brim);

    // Arms hang from the SHOULDER (geometry translated like the legs), so
    // swings, grabs, and windmills pivot where a shoulder actually is.
    // Sleeved capsules with mitt-sphere hands; capsule top = canvas top.
    const armMat = lam(this.paintTex(64, (ctx) => {
      ctx.fillStyle = skin;
      ctx.fillRect(0, 0, 64, 64);
      this.airbrush(ctx, 64, '200,120,60', 0.1, 8, 5, 12);
      ctx.fillStyle = '#2fa88d';
      ctx.fillRect(0, 0, 64, 18); // tee sleeve at the shoulder
      ctx.fillStyle = '#1d6e5d';
      ctx.fillRect(0, 18, 64, 4); // sleeve hem
    }));
    const handM = new THREE.MeshLambertMaterial({ color: 0xdcb289 });
    const armGeo = new THREE.CapsuleGeometry(0.062, 0.33, 3, 9);
    armGeo.translate(0, -0.245, 0);
    const handGeo = new THREE.SphereGeometry(0.058, 8, 6);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.set(side * 0.33, 1.22, 0);
      arm.rotation.z = side * 0.25;
      upper.add(arm);
      const hand = new THREE.Mesh(handGeo, handM);
      hand.position.y = -0.48;
      arm.add(hand);
      if (side === 1) this.armR = arm;
      else {
        this.armL = arm;
        // one sweatband on one wrist — cheap asymmetry for the silhouette
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.026, 6, 10), capM);
        band.rotation.x = Math.PI / 2; // ring around the wrist
        band.position.y = -0.41;
        arm.add(band);
      }
    }
    g.add(upper);
    this.upperG = upper;

    return g;
  }
}
