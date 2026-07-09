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
  hpWall?: boolean; // halfpipe transition segment
  hpFloor?: boolean; // halfpipe flat — lateral movement is inertial carve here
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
  private slamSquash = 0; // pancake pose timer after a slam lands
  private pipeVel = 0; // halfpipe lateral carve velocity (world x, signed)
  private bailing = false; // death with a tumble animation instead of a blink-out
  private bailSpin = 0;
  private grabSpinAngle = 0; // directional grab-spin; land off-axis = bail
  private spinAngle = 0; // spin-attack rotation (visual only)
  private visualYaw = 0; // Crash-style body facing vs. movement heading
  private flipTimer = 0; // front-flip on jump (visual only)
  private skateCharge = 0; // commit meter: time X has been held WITH a direction
  private lastPlanar = 0; // measured ground speed last step, any direction
  // FREE-HEADING SKATE: while on the board (not walking / pipe / sliding),
  // the travel axes ARE the board's heading and the stick carves them around
  // — no more axis-locked "brake if you turn too far".
  private freeSkate = false;
  skateOn = false; // debug: the charge is currently driving the board
  lastJumpType = '—'; // debug: what the last X release produced
  private jumpBufferT = 0; // X released just before touchdown: jump on landing
  private jumpBufferCharge = 0;
  private grindTime = 0; // how long this grind has lasted (balance ramps up)
  private prevPos = new THREE.Vector3(); // for travel-direction facing
  private grindRail: Rail | null = null;
  private grindT = 0;
  private grindDir = 1;
  private grindVel = 0; // grind speed = your speed at entry, bleeding slowly
  private grindStyle: 'normal' | 'nose' | 'five0' | 'board' = 'normal'; // held dir at entry
  private grindPoseX = 0; // nose-up / nose-down grind lean
  private grindYawPose = 0; // boardslide: body across the rail
  private grindYawDir = 1;
  private grabSpinTotal = 0; // |rotation| racked up this air, for spin scoring
  private grabTrickName = 'Grab'; // variant name for the combo readout
  private grabTickT = 0; // THPS accrual while the grab is held
  private grindTickT = 0; // THPS accrual while grinding
  private regrindCd = 0;
  private respawnTimer = 0;
  private coyoteTimer = 0; // jump grace after running off a ledge
  private vertLock = false; // airborne off the halfpipe lip: x is pinned to the pipe
  private chargeTimer = 0; // X held on the ground: builds jump power + speed
  private charging = false;
  private chargePose = 0;
  private invulnTimer = 0; // grace after a mask absorbs a hit
  private maskMesh: THREE.Mesh | null = null;
  private armR: THREE.Mesh | null = null;
  private armL: THREE.Mesh | null = null;
  private legs: THREE.Group | null = null;
  private legL: THREE.Mesh | null = null;
  private legR: THREE.Mesh | null = null;
  private walkPhase = 0; // procedural run cycle
  private walkAmp = 0;
  private idleAmp = 0;
  private boardG: THREE.Group | null = null; // board + wheels: pulled up during grabs
  private teetering = false; // stopped on a ledge lip, Crash-style wobble
  private teeterPhase = 0;
  private teeterPose = 0;
  private lastGrade = 0; // slope along travel; >0 downhill, <0 uphill
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
    // Slightly chunkier character, Crash-proportioned against the corridor.
    // Visual only — the collision box in tuning.ts is unchanged (reads as
    // slightly forgiving hitboxes, which suits the arcade feel).
    this.bodyGroup.scale.setScalar(1.18);
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

  // On halfpipe surface (always ridden on the board).
  // debug readouts for the jump/skate-commit system
  get xHoldT(): number {
    return this.chargeTimer;
  }
  get skateChargeT(): number {
    return this.skateCharge;
  }

  get inPipe(): boolean {
    return (
      this.grounded &&
      this.groundHit !== null &&
      (this.groundHit.hpWall === true || this.groundHit.hpFloor === true)
    );
  }

  get carveSpeed(): number {
    return Math.abs(this.pipeVel);
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
    if (hard) this.lives = 3;
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
    this.crawling = false;
    this.slamActive = false;
    this.slamHangT = 0;
    this.slamSquash = 0;
    this.pipeVel = 0;
    this.bailing = false;
    this.bailSpin = 0;
    this.bodyGroup.rotation.x = 0;
    for (const f of this.fruits) {
      f.age = -1;
      f.mesh.visible = false;
    }
    this.groundHit = null;
    this.coyoteTimer = 0;
    this.vertLock = false;
    const zn = level.zoneAt(this.pos.x, this.pos.z);
    this.setTravelDir(zn ? zn.dir : 'S');
    this.charging = false;
    this.chargeTimer = 0;
    this.skateCharge = 0;
    this.freeSkate = false;
    this.jumpBufferT = 0;
    this.grabPhase = 'none';
    this.grabT = 0;
    this.grabGraceTimer = 0;
    this.grabSpinAngle = 0;
    this.spinAngle = 0;
    this.visualYaw = 0;
    this.flipTimer = 0;
    this.balance = 0;
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
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    if (this.uberTimer > 0 && Math.random() < 0.5) this.emitSparks(1, 0xffd700, 1.2);
    // Actual planar speed from last step's displacement (any direction) —
    // the skate-entry gate uses this so sideways motion counts, not just the
    // forward-axis `speed` scalar. Computed before prevPos is overwritten.
    this.lastPlanar = Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    this.prevPos.copy(this.pos);
    this.teetering = false; // stepRide re-detects it each tick

    // A slide taken from your feet ends back on your feet — the burst never
    // launches you into skating (jumping out of it mid-slide still does).
    if (this.slideFromWalk && this.slideTimer <= 0 && this.state === 'ride' && this.grounded) {
      this.speed = THREE.MathUtils.clamp(this.speed, -TUNING.walkSpeed, TUNING.walkSpeed);
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
        TUNING.maxSpeed * CONST.maxOverspeed,
      );
      this.slideTimer = TUNING.slideDistance / Math.max(this.slideSpd, 6);
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
    const fromSlide = this.slideTimer > 0;
    // Measured planar speed this step, so the jump reads your ACTUAL movement
    // in any direction — a fast sideways walk stores nothing in `speed` (that
    // scalar is the forward axis), but it still deserves a Forward Flip.
    const planar =
      Math.hypot(this.pos.x - this.prevPos.x, this.pos.z - this.prevPos.z) / Math.max(dt, 1e-4);
    if (fromSlide) {
      const cap = TUNING.maxSpeed * CONST.maxOverspeed;
      this.speed = THREE.MathUtils.clamp(
        this.speed + TUNING.slideJumpBoost * Math.sign(this.speed || 1),
        -cap,
        cap,
      );
      this.slideTimer = 0;
      this.slideCd = CONST.slideCooldown;
      this.slideFromWalk = false; // jumping out of the slide keeps the burst
    }
    this.crawling = false;
    this.vVel = THREE.MathUtils.lerp(TUNING.jumpMinVelocity, TUNING.jumpVelocity, t);
    if (wasCrawling) this.vVel *= CONST.crouchJumpMult; // crouch jump: extra height
    const spd = Math.max(Math.abs(this.speed), planar); // direction-agnostic
    if (fromSlide) {
      this.lastJumpType = 'Slide Launch';
      sfx.play('ollie', 0.7);
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
    if (spd >= CONST.flipMinSpeed) this.flipTimer = CONST.flipDuration;
  }

  private stepRide(dt: number, input: Input, level: Level): void {
    // Flattened after a slam: pancaked on the ground for a beat, no control.
    const slamFlat = this.slamFlatT > 0;

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
    // Was the last step on halfpipe surface? There, lateral movement is an
    // inertial carve (build speed on the flat, carry it up the transition)
    // instead of the usual direct sidestep.
    const pipeMode = this.groundHit !== null && (this.groundHit.hpWall === true || this.groundHit.hpFloor === true);

    // The halfpipe is always ridden ON THE BOARD: force skate mode there, so
    // carving never drops you into the walking state mid-transition.
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
    const skating =
      pushingOff || this.slideTimer > 0 || pipeMode || planarSpeed > TUNING.walkSpeed + 0.5;

    // Enter/leave free-heading mode. Walking, the halfpipe, and canned
    // slides keep the classic course-axis model; the board carves free.
    const free = skating && !pipeMode && this.slideTimer <= 0 && !slamFlat && !this.crawling;
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
      // back onto the course grid: keep the along-course velocity component
      const vx = this.axisF.x * this.speed;
      const vz = this.axisF.z * this.speed;
      const zn = level.zoneAt(this.pos.x, this.pos.z);
      this.setTravelDir(zn ? zn.dir : 'S');
      this.speed = vx * this.axisF.x + vz * this.axisF.z;
    }
    this.freeSkate = free;

    // Digital diagonals: with both axes held, normalize the direct-drive
    // moves so a diagonal walk/crawl isn't sqrt(2) faster than a straight one.
    const diag = input.moveX !== 0 && input.moveY !== 0 ? Math.SQRT1_2 : 1;

    if (slamFlat) {
      this.speed = 0;
      this.lastGrade = 0;
    } else if (this.crawling) {
      // Direct-drive crawl. Speed snaps to the d-pad; no slopes, no friction.
      this.speed = input.moveY * TUNING.crawlSpeed * diag;
      this.lastGrade = 0;
    } else if (!skating) {
      // WALK: direct drive, instant start and stop, no inertia, no slope
      // physics — precise Crash platforming in all eight directions.
      this.speed = input.moveY * TUNING.walkSpeed * diag;
      this.lastGrade = 0;
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
          const maxTurn = THREE.MathUtils.degToRad(TUNING.carveGrip) * dt;
          const turn = THREE.MathUtils.clamp(ang, -maxTurn, maxTurn);
          const c = Math.cos(turn);
          const s = Math.sin(turn);
          const nfx = this.axisF.x * c + this.axisF.z * s;
          const nfz = -this.axisF.x * s + this.axisF.z * c;
          this.axisF.set(nfx, 0, nfz);
          this.axisL.set(this.axisF.z, 0, -this.axisF.x);
          if (this.charging) this.speed = Math.min(this.speed + TUNING.chargeBoost * dt, TUNING.maxSpeed);
          else this.speed = Math.max(0, this.speed - TUNING.friction * 0.35 * dt); // easy coast
        } else if (this.charging && this.speed > 1) {
          this.speed = Math.min(this.speed + TUNING.chargeBoost * dt, TUNING.maxSpeed);
        } else {
          this.speed = Math.max(0, this.speed - TUNING.friction * dt);
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

      // Fake slope response from the ground normal: grade > 0 means the surface
      // drops away down-course. Sign-safe, so stalling on a ramp rolls you back
      // down it.
      let grade = 0;
      if (this.groundHit) {
        const n = this.groundHit.normal;
        grade = (n.x * this.axisF.x + n.z * this.axisF.z) / Math.max(n.y, 0.2);
      }
      if (Math.abs(grade) > 0.02) {
        // X held = attack the ramp (more boost); no X = mellow roll
        const rampFactor = this.charging ? 1.3 : 0.8;
        this.speed += (grade > 0 ? TUNING.slopeBoost : TUNING.uphillSlowdown) * grade * rampFactor * dt;
      }
      this.lastGrade = grade;

      // Downhill may exceed maxSpeed up to a hard cap; on the flat the excess
      // bleeds back off. Same caps in both directions.
      const hardCap = TUNING.maxSpeed * CONST.maxOverspeed;
      this.speed = THREE.MathUtils.clamp(this.speed, -hardCap, hardCap);
      if (Math.abs(this.speed) > TUNING.maxSpeed && Math.abs(grade) <= 0.02) {
        this.speed =
          Math.sign(this.speed) *
          Math.max(TUNING.maxSpeed, Math.abs(this.speed) - CONST.overspeedDecay * dt);
      }
      // A free heading never reverses through zero — stalling on a hill just
      // stops you, and below walking pace your feet take over.
      if (this.freeSkate) this.speed = Math.max(0, this.speed);
    }

    this.pos.addScaledVector(this.axisF, this.speed * dt);

    if (pipeMode) {
      // Halfpipe carve: the stick accelerates an inertial lateral velocity
      // (pump!), the flat bleeds a little, and the transition's steepness
      // fights the climb — whatever survives to the lip becomes air.
      this.pipeVel += input.moveX * TUNING.pipeAccel * dt;
      if (this.groundHit!.hpWall) {
        const outward = Math.sign(this.pos.x) || 1;
        const steep = Math.min(1, Math.abs(this.groundHit!.normal.x));
        this.pipeVel -= outward * CONST.pipeGravity * steep * dt;
      } else if (Math.abs(input.moveX) < 0.05) {
        const drop = CONST.pipeFriction * dt;
        this.pipeVel = Math.abs(this.pipeVel) <= drop ? 0 : this.pipeVel - Math.sign(this.pipeVel) * drop;
      }
      this.pipeVel = THREE.MathUtils.clamp(this.pipeVel, -CONST.pipeMaxVel, CONST.pipeMaxVel);
      this.pos.x += this.pipeVel * dt;
    } else {
      this.pipeVel = 0;
      // Axis-locked sidestep: direct velocity while held, dead stop on
      // release. Left is ALWAYS screen-left, even while backing up. Slides
      // are direction locked: no steering mid-slide.
      if (slamFlat) {
        // pancaked: no steering
      } else if (this.crawling) {
        if (input.moveX !== 0) {
          this.pos.addScaledVector(this.axisL, input.moveX * TUNING.crawlSpeed * diag * dt);
        }
      } else if (this.slideTimer > 0) {
        // the slide's cross-course component
        const lat = this.slideVec.x * this.axisL.x + this.slideVec.z * this.axisL.z;
        this.pos.addScaledVector(this.axisL, this.slideSpd * lat * dt);
      } else if (input.moveX !== 0 && !this.freeSkate) {
        // Walking keeps the direct crisp sidestep (diagonal-normalized).
        // Free-heading skating has NO sidestep — carving IS the steering.
        const latRate = skating
          ? Math.max(TUNING.walkSpeed, Math.abs(this.speed) * 0.5)
          : TUNING.walkSpeed * diag;
        this.pos.addScaledVector(this.axisL, input.moveX * latRate * dt);
      }
    }

    // Follow the ground within a chunky snap window, otherwise we ran off an
    // edge and go airborne. Halfpipe transitions get a taller window (both
    // ways) so steep climbs and descents stick to the surface.
    const hit = this.queryGround(level);
    const upWindow = hit && hit.hpWall ? CONST.hpSnapWindow : 0.8;
    const downWindow = hit && hit.hpWall ? CONST.hpSnapWindow : 1.4;
    if (hit && hit.y >= this.pos.y - downWindow && hit.y <= this.pos.y + upWindow) {
      this.pos.y = hit.y;
      this.groundHit = hit;
      this.grounded = true;
      this.surfaceName = hit.name;

      // Crash teeter: slow/stopped with part of the board hanging over an
      // edge — wobble as a warning; step back (or jump) to save yourself.
      this.teetering = false;
      if (Math.abs(this.speed) < CONST.teeterSpeed && !hit.hpWall) {
        for (const [ox, oz] of [[0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]]) {
          if (!this.queryGround(level, ox, oz)) {
            this.teetering = true;
            break;
          }
        }
      }

      // Carried carve speed all the way over the lip: locked vert air. Height
      // comes from the speed you brought, THPS-style — you go UP, x pinned,
      // and drop back into the pipe.
      if (hit.hpWall) {
        const outward = Math.sign(this.pos.x) || 1;
        if (this.pipeVel * outward > CONST.pipeMinLaunch && this.pos.y > level.halfpipeLipY - 0.5) {
          this.state = 'air';
          this.grounded = false;
          this.vVel = Math.min(Math.abs(this.pipeVel) * TUNING.pipeLift, 36);
          sfx.play('woosh2', 0.7);
          this.vertLock = true;
          this.pipeVel = 0;
          this.charging = false;
          this.chargeTimer = 0;
          this.emitSparks(5, 0xfff3d0, 1.2);
        } else {
          // backstop: never carve past the physical edge of the wall
          const lipX = level.halfpipeLipX - 0.1;
          this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lipX, lipX);
        }
      }
    } else {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      this.crawling = false;
      // Authored kicker launch: leaving an uphill lip converts speed to lift
      // (forward travel only — backing off an edge just drops). X held at the
      // lip = bigger air; rolling off without it is mellower.
      const lipFactor = this.charging ? 1.3 : 0.85;
      this.vVel =
        this.speed > 0 && this.lastGrade < -0.05
          ? Math.min(-this.lastGrade * this.speed * lipFactor, this.charging ? 25 : 18)
          : 0;
      this.coyoteTimer = CONST.coyoteTime;
    }

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
      this.charging = true;
      this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
    }
    if (input.jumpReleased && this.charging && !slamFlat && (this.state === 'ride' || this.coyoteTimer > 0)) {
      this.chargedJump(dt);
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
    if (!this.slamActive && input.grabHeld && this.rawInput.moveY < -0.5) {
      this.slamActive = true;
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
    // laterally. Locked while holding a grab or slamming, and a vert air off
    // the halfpipe lip pins x — you can only ease back toward the middle.
    if (!this.grabbing && !this.slamActive) {
      const footAir =
        !this.charging && !this.vertLock && Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
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
        const cap = TUNING.maxSpeed * CONST.maxOverspeed;
        this.speed = THREE.MathUtils.clamp(this.speed + rate * input.moveY * dt, -cap, cap);
      }
      if (Math.abs(input.moveX) > 0.05) {
        if (this.vertLock) {
          const inward = -Math.sign(this.pos.x) || 1;
          if (input.moveX * inward > 0) {
            this.pos.x += inward * TUNING.walkSpeed * 0.5 * dt;
          }
        } else {
          this.pos.addScaledVector(this.axisL, input.moveX * TUNING.walkSpeed * diag * dt);
        }
      }
    }

    this.pos.addScaledVector(this.axisF, this.speed * dt);
    this.pos.y += this.vVel * dt;

    const hit = this.queryGround(level);
    this.groundHit = hit;

    // Ceiling: rising into the UNDERSIDE of a deck bonks (decks are 1 thick;
    // tall blocks already have wall colliders). Stops the head passing up
    // through elevated platforms.
    if (hit && this.vVel > 0) {
      const underside = hit.y - 1.0;
      const head = this.pos.y + CONST.playerHalf.y * 2;
      if (this.pos.y < underside - 0.05 && head > underside) {
        this.pos.y = underside - CONST.playerHalf.y * 2;
        this.vVel = 0;
      }
    }

    // Land only on surfaces we were actually ABOVE last step (with a small
    // ledge forgiveness) — a surface overhead must never teleport us onto it.
    if (
      hit &&
      this.vVel <= 0 &&
      this.pos.y <= hit.y + 0.05 &&
      (this.prevPos.y >= hit.y - 0.05 || this.pos.y >= hit.y - 0.35)
    ) {
      const impact = -this.vVel;
      const wasVert = this.vertLock;
      this.pos.y = hit.y;
      this.vVel = 0;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.coyoteTimer = 0;
      this.vertLock = false;
      // Falling onto the halfpipe transition converts the drop back into carve
      // speed down the wall — momentum survives the round trip, THPS-style.
      if (hit.hpWall) {
        this.pipeVel =
          -(Math.sign(this.pos.x) || 1) * Math.min(impact * CONST.pipeLandKeep, CONST.pipeMaxVel);
      }
      // Landing-tick payouts (vert, grab, slam impact) are still air tricks
      // for combo purposes even though the state just flipped to 'ride'.
      this.landingScoring = true;
      if (wasVert) this.score(CONST.ptsVert, 'Vert Air');

      if (this.slamActive) {
        this.slamImpact(level);
        this.landingScoring = false;
        return;
      }

      // Grab landing rules: touching down while reaching into, holding, or
      // reaching out of the pose is a bail — release early enough for the
      // whole motion to finish. A completed grab only lands clean if the spin
      // is back on axis. Uber shrugs it off; a mask absorbs it; otherwise
      // you tumble.
      const a = ((this.grabSpinAngle % Math.PI) + Math.PI) % Math.PI;
      const offAxis = Math.min(a, Math.PI - a) > CONST.grabOffAxisTolerance;
      if (this.grabPhase !== 'none' || (this.grabGraceTimer > 0 && offAxis)) {
        if (this.uberTimer > 0 || this.spendMask()) {
          this.grabPhase = 'none';
          this.grabT = 0;
          this.grabGraceTimer = 0;
          this.grabSpinAngle = 0;
          if (this.uberTimer <= 0) this.speed *= 0.6;
        } else {
          this.landingScoring = false;
          this.bail();
          return;
        }
      } else if (this.grabGraceTimer > 0) {
        // A clean (released in time, on-axis) grab pays out a speed burst.
        this.speed += TUNING.grabBoost * (this.speed >= 0 ? 1 : -1);
        const cap = TUNING.maxSpeed * CONST.maxOverspeed;
        this.speed = THREE.MathUtils.clamp(this.speed, -cap, cap);
        this.grabGraceTimer = 0;
        this.grabSpinAngle = 0;
        // rotation pays in 90-degree increments, THPS-style
        const quarters = Math.floor(this.grabSpinTotal / (Math.PI / 2));
        const deg = quarters * 90;
        this.score(
          CONST.ptsGrab + quarters * CONST.ptsGrabQuarter,
          deg > 0 ? `${this.grabTrickName} ${deg}°` : this.grabTrickName,
        );
        this.grabSpinTotal = 0;
        this.emitSparks(10, 0xfff3d0, 2.2);
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
      if (dx * dx + dz * dz > CONST.slamRadius * CONST.slamRadius) continue;
      if (Math.abs(p.y - this.pos.y) > 1.8) continue;
      if (c.tnt) level.detonate(c, true);
      else if (c.nitro) level.detonate(c);
      else this.smashCrate(level, c);
    }
    for (const e of level.enemies) {
      if (e.alive && e.group.position.distanceTo(this.pos) < CONST.slamRadius + 0.6) {
        level.killEnemy(e);
        this.score(CONST.ptsEnemy, 'Flattened');
      }
    }
    // A landed slam is a safe landing too: bank the string.
    this.bankCombo();
  }

  // Botched a grab landing: tumble out and eat the respawn.
  private bail(): void {
    this.bailing = true;
    this.speed *= 0.3;
    this.die();
  }

  private stepGrind(dt: number, input: Input, level: Level): void {
    const rail = this.grindRail!;
    this.grindTime += dt;
    // Grinds ride at the speed you brought and bleed a little on the rail
    // (nosegrinds hold their speed better).
    const bleed = this.grindStyle === 'nose' ? CONST.grindBleed * 0.4 : CONST.grindBleed;
    this.grindVel = Math.max(CONST.grindMinSpeed, this.grindVel - bleed * dt);

    // THPS balance: the needle is an unstable equilibrium that runs away from
    // center, faster the longer you grind; left/right input fights it. Slow
    // grinds are wobblier than fast ones. Pegging the meter bails you off.
    // The third-mask uber locks the needle dead center.
    const speedFactor = THREE.MathUtils.clamp(
      TUNING.grindSpeed / Math.max(this.grindVel, 1),
      0.6,
      2.2,
    );
    // boardslides look coolest and wobble hardest
    const styleWobble = this.grindStyle === 'board' ? 1.25 : 1;
    const instability =
      TUNING.balanceDrift * (1 + this.grindTime * CONST.balanceRamp) * speedFactor * styleWobble;
    this.balance += Math.sign(this.balance || 1) * instability * dt;
    this.balance += this.rawInput.moveX * TUNING.balanceControl * dt;
    if (this.uberTimer > 0) this.balance = 0; // perfect balance
    if (Math.abs(this.balance) >= 1) {
      // A mask absorbs the bail: the needle resets and the grind continues.
      if (this.spendMask()) {
        this.balance = 0;
        this.grindTime = 0;
      } else {
        this.bailFromRail();
        return;
      }
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
      if (Math.abs(this.speed) >= CONST.flipMinSpeed) this.flipTimer = CONST.flipDuration;
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
    this.vertLock = false;
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
    this.emitSparks(6, 0xffb545, 1.6); // landing-on-the-rail burst
    sfx.play('railLand', 0.8);
    // The rail keeps the speed you carried ALONG it — hit it fast and aligned
    // to cross fast; clip it sideways and you just barely creep across.
    this.grindVel = THREE.MathUtils.clamp(
      Math.abs(alongVel),
      CONST.grindMinSpeed,
      TUNING.maxSpeed * CONST.maxOverspeed,
    );
    this.speed = this.grindVel;
    this.placeOnRail(rail);
  }

  private placeOnRail(rail: Rail): void {
    const p = rail.pointAt(this.grindT);
    this.pos.set(p.x, p.y + CONST.railRideHeight, p.z);
  }

  private exitGrind(vVel: number): void {
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
  }

  // Pegged the balance meter (or hit a crate): stumble off the rail with most
  // speed gone and the pending combo lost. Over a pit that means a drop.
  private bailFromRail(): void {
    this.grindRail = null;
    this.state = 'air';
    this.vVel = 3;
    this.speed *= CONST.balanceBailSpeedKeep;
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
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
      if (input.grabHeld && !this.slamActive) {
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
          if (this.grabT >= CONST.grabTransition) {
            this.grabPhase = 'none';
            this.grabGraceTimer = CONST.grabGrace;
          }
        }
        // The rotation eases home to the nearest on-axis facing.
        if (this.grabSpinAngle !== 0) {
          const target = Math.round(this.grabSpinAngle / Math.PI) * Math.PI;
          const d = target - this.grabSpinAngle;
          const step = CONST.grabSnapRate * dt;
          this.grabSpinAngle = Math.abs(d) <= step ? target : this.grabSpinAngle + Math.sign(d) * step;
        }
      }
    } else if (this.grabPhase !== 'none' || this.grabSpinAngle !== 0) {
      this.grabPhase = 'none';
      this.grabT = 0;
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
            if (this.grindVel >= CONST.grindSmashSpeed || this.spendMask()) level.detonate(c, true);
            else this.bailFromRail();
          } else if (this.isStomping(c.box)) {
            if (this.slamActive) {
              level.detonate(c, true);
            } else {
              level.lightFuse(c);
              this.vVel = TUNING.crateBounce;
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
        if (this.playerBox.intersectsBox(c.box)) {
          if (this.isStomping(c.box)) {
            this.vVel = CONST.bounceCrateForce;
            this.state = 'air';
            this.grounded = false;
            this.charging = false;
            this.chargeTimer = 0;
            this.score(CONST.ptsBouncy, 'Boing');
            sfx.play('bouncyBounce', 0.9);
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
          // they knock you off (a mask absorbs it).
          if (this.grindVel >= CONST.grindSmashSpeed || this.spendMask()) this.smashCrate(level, c);
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
      this.pushOutOf(cr.box);
    }

    // Solid walls: shove out, full stop, nothing breaks.
    for (const w of level.walls) {
      if (this.playerBox.intersectsBox(w)) {
        this.pushOutOf(w);
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
          sfx.play('crateBounce', 0.7);
          this.state = 'air';
          this.grounded = false;
        } else if (this.isBonking(cp.box)) {
          level.activateCheckpoint(cp, this.cratesBroken, this.fruit, this.masks, this.points);
          this.onCheckpoint();
          this.vVel = Math.min(this.vVel, 2);
        } else {
          // Bump = wall, like a normal box. Spin, slide, or stomp to bank it.
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

  // Shove the player back out the side they came IN from (based on this
  // step's travel), so a fast approach can't teleport through the far face.
  // Chunky, deliberate, Crash-like full stop.
  private pushOutOf(box: THREE.Box3): void {
    if (Math.abs(this.speed) > 18 && this.haltCd <= 0) {
      sfx.play('skateHalt', 0.7);
      this.haltCd = 0.5;
    }
    const dx = this.pos.x - this.prevPos.x;
    const dz = this.pos.z - this.prevPos.z;
    const hx = CONST.playerHalf.x + 0.02;
    const hz = CONST.playerHalf.z + 0.02;
    if (Math.abs(dz) >= Math.abs(dx) && dz !== 0) {
      this.pos.z = dz < 0 ? box.max.z + hz : box.min.z - hz;
    } else if (dx !== 0) {
      this.pos.x = dx < 0 ? box.max.x + hx : box.min.x - hx;
    } else {
      // Not moving (spawned overlapping?): nearest z face.
      const cz = (box.min.z + box.max.z) / 2;
      this.pos.z = this.pos.z < cz ? box.min.z - hz : box.max.z + hz;
    }
    this.speed = 0;
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
      hpWall: hit.object.userData.hpWall === true,
      hpFloor: hit.object.userData.hpFloor === true,
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
      !this.slamActive &&
      !this.vertLock;
    let wobble = 0;
    if (this.teetering || edgeGrace) {
      this.teeterPhase += dt;
      wobble = Math.sin(this.teeterPhase * 16) * (edgeGrace ? 0.3 : 0.22);
    } else {
      this.teeterPhase = 0;
    }
    this.teeterPose += ((this.teetering || edgeGrace ? 1 : 0) - this.teeterPose) * Math.min(1, 14 * dt);
    this.group.rotation.z = this.lean + wobble;

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
    this.bodyGroup.rotation.y =
      this.visualYaw + this.spinAngle + this.grabSpinAngle + this.grindYawPose;

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
      !this.inPipe &&
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
      (this.inPipe ||
        Math.abs(this.speed) > TUNING.boardSpeed ||
        (this.charging && Math.abs(this.speed) > TUNING.walkSpeed + 0.5));
    this.skatePose += ((onBoard ? 1 : 0) - this.skatePose) * Math.min(1, 10 * dt);
    const sk = this.skatePose;
    if (this.legL && this.legR) {
      this.legL.rotation.x = swing + 1.6 * flipTuck;
      this.legR.rotation.x = -swing + 1.6 * flipTuck;
      this.legR.position.set(0.115 + 0.05 * sk, 0, 0.42 * sk); // front foot, toward nose
      this.legL.position.set(-0.115 - 0.05 * sk, 0, -0.34 * sk); // back foot, toward tail
      this.legR.rotation.y = 0.22 * sk;
      this.legL.rotation.y = -0.16 * sk;
    }

    const raw = this.rawInput;
    let pitchT = 0.9;
    let rollT = 0;
    let armRT = 2.4; // right hand on the board
    let armLT = -1.9; // left arm thrown high
    if (this.grabbing) {
      if (raw.moveY > 0.4) {
        pitchT = 1.25; // nosegrab: pitched hard over the nose
        armRT = 2.7;
        armLT = -2.2;
      } else if (raw.moveX < -0.4) {
        pitchT = 0.6; // melon: leading hand swaps, lean left
        rollT = -0.5;
        armRT = -1.9;
        armLT = 2.4;
      } else if (raw.moveX > 0.4) {
        pitchT = 0.6; // indy: lean right
        rollT = 0.5;
        armRT = 2.6;
        armLT = -1.4;
      }
    }
    const poseBlend = Math.min(1, 12 * dt);
    this.grabPitch += (pitchT - this.grabPitch) * poseBlend;
    this.grabRoll += (rollT - this.grabRoll) * poseBlend;
    this.armRPose += (armRT - this.armRPose) * poseBlend;
    this.armLPose += (armLT - this.armLPose) * poseBlend;
    const armAnim =
      (-swing * 0.8 + breathe * 0.06 * this.idleAmp) * (1 - this.grabPose) +
      2.3 * this.crawlPose * (1 - this.grabPose); // hands to the ground on all fours
    if (this.armR) {
      this.armR.rotation.x = this.armRPose * this.grabPose + armAnim;
      this.armR.rotation.z = 0.25 - this.grabPose * 0.55;
    }
    if (this.armL) {
      this.armL.rotation.x = this.armLPose * this.grabPose - armAnim + swing * 1.6 * this.crawlPose;
      this.armL.rotation.z = -0.25 + this.grabPose * 0.45;
    }
    // Knees up: legs shorten toward the hips while the body crouches deep,
    // and the board comes up with them, into the grabbing hand.
    if (this.legs) {
      // knees pull up to the chest — for the grab tuck and the flip tuck
      this.legs.scale.y = 1 - 0.5 * this.grabPose - 0.4 * flipTuck;
    }
    if (this.boardG) {
      this.boardG.position.y = 0.5 * this.grabPose;
      this.boardG.rotation.x = 0.3 * this.grabPose; // nose tips up in the hand
      // On foot the board is stowed — it only comes out for real skating:
      // grinding, the halfpipe, grabs, speed above the boardSpeed slider, or
      // a charge that's actually propelling past walking pace. A stationary
      // jump crouch or a walk-hop tap never flashes the board.
      this.boardG.visible =
        this.slideTimer <= 0 &&
        (this.state === 'grind' ||
          (this.charging && Math.abs(this.speed) > TUNING.walkSpeed + 0.5) ||
          this.vertLock ||
          this.inPipe ||
          this.grabPose > 0.05 ||
          Math.abs(this.speed) > TUNING.boardSpeed);
    }
    this.bodyGroup.rotation.z = this.grabRoll * this.grabPose;
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
    const grabRate = dt / CONST.grabTransition;
    this.grabPose = THREE.MathUtils.clamp(
      this.grabPose + (targetPose > this.grabPose ? grabRate : -grabRate),
      0,
      1,
    );
    const targetSlide = this.sliding ? 1 : 0;
    this.slidePose += (targetSlide - this.slidePose) * Math.min(1, 18 * dt);
    // All-fours crawl pose (dog stance): torso pitched over, hands down.
    this.crawlPose += ((this.crawling ? 1 : 0) - this.crawlPose) * Math.min(1, 14 * dt);
    // Slam has three beats: the "uh oh" hang, the pancake drop, then lying
    // flat on the ground for a moment before getting up.
    const hanging = this.slamActive && this.slamHangT > 0;
    const dropping = (this.slamActive && this.slamHangT <= 0) || this.slamFlatT > 0;
    this.hangPose += ((hanging ? 1 : 0) - this.hangPose) * Math.min(1, 16 * dt);
    this.dropPose += ((dropping ? 1 : 0) - this.dropPose) * Math.min(1, 20 * dt);
    const flip =
      this.flipTimer > 0 ? (1 - this.flipTimer / CONST.flipDuration) * Math.PI * 2 : 0;
    if (this.state === 'dead' && this.bailing) {
      // Bail tumble: rag-doll head-over-heels until the respawn.
      this.bailSpin += 13 * dt;
      this.bodyGroup.rotation.x = this.bailSpin;
    } else {
      this.bodyGroup.rotation.x =
        flip * (1 - this.grabPose) +
        this.grabPitch * this.grabPose -
        0.35 * this.slidePose +
        1.3 * this.crawlPose - // all fours: torso pitched right over
        0.55 * this.hangPose + // rear back: "...uh oh"
        1.45 * this.dropPose - // belly-first pancake
        0.28 * this.teeterPose + // arms-back "whoa whoa" lean
        0.18 * this.skatePose + // athletic crouch over the board
        this.grindPoseX; // nosegrind / 5-0 lean
    }
    const targetCharge = this.charging ? 0.35 + 0.65 * Math.min(1, this.chargeTimer / TUNING.jumpChargeTime) : 0;
    this.chargePose += (targetCharge - this.chargePose) * Math.min(1, 16 * dt);
    this.bodyGroup.position.y =
      this.grabPose * -0.5 -
      this.slidePose * 0.32 -
      this.crawlPose * 0.55 -
      this.chargePose * 0.26 -
      (this.grounded ? 0.45 * this.dropPose : 0) +
      Math.abs(Math.sin(this.walkPhase)) * 0.05 * this.walkAmp +
      breathe * 0.015 * this.idleAmp;
    // Impact squash right after a slam lands.
    const squash = this.slamSquash > 0 ? this.slamSquash / CONST.slamSquashTime : 0;
    this.bodyGroup.scale.y = 1.18 * (1 - 0.6 * squash);

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

  private buildVisual(): THREE.Group {
    const g = new THREE.Group();

    // Board (visual only), nose toward local +Z. Grouped with its wheels so
    // grabs can pull the whole board up into the hand.
    const boardG = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.09, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x8a4a3a }),
    );
    board.position.y = 0.16;
    boardG.add(board);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
    for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), wheelMat);
      wheel.position.set(x, 0.06, z);
      boardG.add(wheel);
    }
    g.add(boardG);
    this.boardG = boardG;

    // Low-poly rider: two legs pivoting from the hip for the run cycle.
    const legs = new THREE.Group();
    legs.position.y = 0.71; // hip line
    const legGeo = new THREE.BoxGeometry(0.17, 0.5, 0.26);
    legGeo.translate(0, -0.25, 0); // swing from the hip
    const legMat = new THREE.MeshLambertMaterial({ color: 0x35506e });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.x = side * 0.115;
      legs.add(leg);
      if (side === 1) this.legR = leg;
      else this.legL = leg;
    }
    g.add(legs);
    this.legs = legs;
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.55, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x3aa68f }),
    );
    torso.position.y = 0.98;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xe8c39a }),
    );
    head.position.y = 1.42;
    g.add(head);

    // Simple arms; during a grab one reaches down to the board and the other
    // throws high (which one depends on the grab variant).
    const armMat = new THREE.MeshLambertMaterial({ color: 0x3aa68f });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.13), armMat);
      arm.position.set(side * 0.33, 1.05, 0);
      arm.rotation.z = side * 0.25;
      g.add(arm);
      if (side === 1) this.armR = arm;
      else this.armL = arm;
    }

    // Crude face on the travel side (+Z), so backing up shows it to the camera.
    const faceMat = new THREE.MeshBasicMaterial({ color: 0x222428 });
    for (const side of [-0.075, 0.075]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), faceMat);
      eye.position.set(side, 1.47, 0.165);
      g.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), faceMat);
    mouth.position.set(0, 1.36, 0.165);
    g.add(mouth);

    return g;
  }
}
