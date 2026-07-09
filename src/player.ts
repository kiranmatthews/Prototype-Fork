// Authored fake-physics board movement. No rigidbody, no forces: just a
// heading, a scalar speed, a vertical velocity, and hand-tuned numbers from
// tuning.ts. Ground following is a single downward raycast; slopes only exist
// as fake boost/slowdown numbers derived from the surface normal.

import * as THREE from 'three';
import { TUNING, CONST } from './tuning';
import { Input } from './input';
import { Crate, Level } from './level';
import { Rail, RailSample, nearestRail } from './rails';

export type MoveState = 'ride' | 'air' | 'grind' | 'dead' | 'finished';

interface GroundHit {
  y: number;
  normal: THREE.Vector3;
  name: string;
  hpWall?: boolean; // halfpipe transition segment
  hpFloor?: boolean; // halfpipe flat — lateral movement is inertial carve here
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
  points = 0; // banked score
  comboPoints = 0; // pending combo: sum of base values...
  comboMult = 0; // ...times the number of actions strung together
  private comboTimer = 0; // plain-rolling time left before the combo banks

  // debug readouts
  railCandidateDist = Infinity;
  balance = 0; // THPS grind balance needle, -1..1

  // wired up by main.ts
  onDeath: () => void = () => {};
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
  private landingScoring = false; // landing-tick payouts still count as air tricks
  private crawling = false; // Circle held while stopped: low slow crawl
  private slamActive = false; // Circle+down in the air: pancake body slam
  private slamHangT = 0; // cartoon hang before the drop
  private hangPose = 0;
  private dropPose = 0;
  private slamSquash = 0; // pancake pose timer after a slam lands
  private pipeVel = 0; // halfpipe lateral carve velocity (world x, signed)
  private bailing = false; // death with a tumble animation instead of a blink-out
  private bailSpin = 0;
  private grabSpinAngle = 0; // directional grab-spin; land off-axis = bail
  private spinAngle = 0; // spin-attack rotation (visual only)
  private visualYaw = 0; // Crash-style body facing vs. movement heading
  private flipTimer = 0; // front-flip on jump (visual only)
  private grindTime = 0; // how long this grind has lasted (balance ramps up)
  private prevPos = new THREE.Vector3(); // for travel-direction facing
  private grindRail: Rail | null = null;
  private grindT = 0;
  private grindDir = 1;
  private grindVel = 0; // grind speed = your speed at entry, bleeding slowly
  private grabSpinTotal = 0; // |rotation| racked up this air, for spin scoring
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
  private legs: THREE.Mesh | null = null;
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
  private mapSide = false; // control mapping, latched across camera-zone flips
  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private spinBox = new THREE.Box3();
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];
  private fruits: { mesh: THREE.Mesh; vel: THREE.Vector3; age: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.bodyGroup = this.buildVisual();
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

  // Soft respawn (death) returns to the last checkpoint; hard (R / new run)
  // returns to the start and relights checkpoints.
  respawn(level: Level, hard = false): void {
    level.reset(hard);
    this.pos.copy(hard ? level.spawnPos : level.currentSpawn);
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
    this.mapSide = level.isSide(this.pos.z);
    this.charging = false;
    this.chargeTimer = 0;
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
    // Side-scroll levels: the camera sits off to the +X side, so screen right
    // = down-course. Remap the stick — left/right drives speed, and up/down
    // is the depth sidestep (up = away from the camera), the exact same
    // direct-velocity move as left/right in corridor levels. The raw stick
    // stays available (rawInput) for the slam, grab-spin direction, and
    // grind balance.
    this.rawInput = input;
    // Crossing a camera-zone boundary while HOLDING a direction keeps the old
    // mapping (your trajectory continues); the new mapping latches in the
    // moment the stick passes through neutral. No surprise right-angle turns.
    const zoneSide = level.isSide(this.pos.z);
    if (zoneSide !== this.mapSide && Math.abs(input.moveX) < 0.3 && Math.abs(input.moveY) < 0.3) {
      this.mapSide = zoneSide;
    }
    const ctl = this.mapSide
      ? ({ ...input, moveY: input.moveX, moveX: -input.moveY } as unknown as Input)
      : input;
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
    this.slamSquash = Math.max(0, this.slamSquash - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.uberTimer = Math.max(0, this.uberTimer - dt);
    if (this.uberTimer > 0 && Math.random() < 0.5) this.emitSparks(1, 0xffd700, 1.2);
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
    if (
      input.grabPressed &&
      this.state === 'ride' &&
      this.grounded &&
      !this.crawling &&
      this.slideTimer <= 0 &&
      this.slideCd <= 0 &&
      Math.abs(this.speed) >= TUNING.slideMinSpeed
    ) {
      // A slide off your feet is Crash's slide: canned burst, then back to
      // walking. A slide at skate speed keeps its momentum.
      this.slideFromWalk = !this.charging && Math.abs(this.speed) <= TUNING.walkSpeed + 0.5;
      this.slideTimer = TUNING.slideDuration;
      const cap = TUNING.maxSpeed * CONST.maxOverspeed;
      this.speed = THREE.MathUtils.clamp(
        Math.sign(this.speed || 1) * Math.max(Math.abs(this.speed), TUNING.slideSpeed),
        -cap,
        cap,
      );
      this.score(CONST.ptsSlide);
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
        if (this.respawnTimer <= 0) this.respawn(level);
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
        this.score(CONST.ptsCrate);
        if (c.mask) this.gainMask();
        else this.spawnFruit(c.box);
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
  private score(base: number): void {
    const inTrick =
      this.landingScoring || this.state === 'air' || this.state === 'grind' || this.sliding;
    if (inTrick) {
      this.comboPoints += base;
      this.comboMult += 1;
      this.comboTimer = CONST.comboWindow;
    } else {
      this.points += base;
    }
  }

  private bankCombo(): void {
    if (this.comboMult > 0) this.points += this.comboPoints * this.comboMult;
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
  }

  // Crash mask rules: masks come from mask crates only. The first two are
  // held; the THIRD triggers temporary invincibility (uber) — auto-smash on
  // touch, perfect rail balance, immune to everything except the pit.
  private gainMask(): void {
    if (this.masks >= 2 || this.uberTimer > 0) {
      this.uberTimer = CONST.uberTime;
      this.emitSparks(14, 0xffd700, 2.5);
    } else {
      this.masks++;
    }
  }

  // Spend a mask to survive something. Returns true if one was available.
  private spendMask(): boolean {
    if (this.masks <= 0) return false;
    this.masks--;
    this.invulnTimer = CONST.maskInvuln;
    this.emitSparks(8, 0xffd27a, 2);
    return true;
  }

  // Release-triggered charged jump: tap = jumpMinVelocity, full hold =
  // jumpVelocity. Slide chains still convert into distance.
  private chargedJump(): void {
    const t = Math.min(1, this.chargeTimer / TUNING.jumpChargeTime);
    if (this.slideTimer > 0) {
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
    this.state = 'air';
    this.grounded = false;
    this.coyoteTimer = 0;
    this.crawling = false;
    this.charging = false;
    this.chargeTimer = 0;
    if (Math.abs(this.speed) >= CONST.flipMinSpeed) this.flipTimer = CONST.flipDuration;
  }

  private stepRide(dt: number, input: Input, level: Level): void {
    // Crash crouch-crawl: holding Circle while (nearly) stopped drops you into
    // a low, slow, precise crawl — direct velocity, no inertia, until release.
    if (input.grabHeld && (this.crawling || (Math.abs(this.speed) < TUNING.slideMinSpeed && this.slideTimer <= 0))) {
      this.crawling = true;
    } else {
      this.crawling = false;
    }

    // Walk vs skate: on foot by default (Crash direct drive); holding X puts
    // the board down and builds speed, and any carried momentum — downhill,
    // rail exits, slides, boosts — keeps you skating until it bleeds back to
    // walking pace.
    const skating =
      this.charging || this.slideTimer > 0 || Math.abs(this.speed) > TUNING.walkSpeed + 0.5;

    // Was the last step on halfpipe surface? There, lateral movement is an
    // inertial carve (build speed on the flat, carry it up the transition)
    // instead of the usual direct sidestep.
    const pipeMode = this.groundHit !== null && (this.groundHit.hpWall === true || this.groundHit.hpFloor === true);

    if (this.crawling) {
      // Direct-drive crawl. Speed snaps to the stick; no slopes, no friction.
      this.speed = input.moveY * TUNING.crawlSpeed;
      this.lastGrade = 0;
    } else if (!skating) {
      // WALK: direct drive, instant start and stop, no inertia, no slope
      // physics — precise Crash platforming in all four directions.
      this.speed = input.moveY * TUNING.walkSpeed;
      this.lastGrade = 0;
    } else {
      // SKATE: authored momentum. X (charge) is the only accelerator; input
      // against travel brakes hard (turnaround); input with travel coasts
      // easy; no input bleeds friction back toward walking pace. A slide is
      // canned: it ignores the stick entirely and keeps its momentum.
      if (this.slideTimer > 0) {
        // direction locked — no input, no friction
      } else if (this.charging) {
        // build toward maxSpeed in the stick's direction (forward if idle)
        const dir = Math.abs(input.moveY) > 0.05 ? Math.sign(input.moveY) : Math.sign(this.speed || 1);
        const rate = dir * this.speed < -0.01 ? TUNING.turnaround : TUNING.chargeBoost;
        this.speed = THREE.MathUtils.clamp(
          this.speed + rate * dir * dt,
          -TUNING.maxSpeed,
          TUNING.maxSpeed,
        );
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
        grade = -n.z / Math.max(n.y, 0.2);
      }
      if (Math.abs(grade) > 0.02) {
        this.speed += (grade > 0 ? TUNING.slopeBoost : TUNING.uphillSlowdown) * grade * dt;
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
    }

    this.pos.addScaledVector(FORWARD, this.speed * dt);

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
      if (this.crawling) {
        if (Math.abs(input.moveX) > 0.05) this.pos.x += input.moveX * TUNING.crawlSpeed * dt;
      } else if (this.slideTimer <= 0 && Math.abs(input.moveX) > 0.05) {
        this.pos.x += input.moveX * (skating ? TUNING.walkSpeed : TUNING.walkSpeed) * dt;
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
      // (forward travel only — backing off an edge just drops).
      this.vVel =
        this.speed > 0 && this.lastGrade < -0.05 ? Math.min(-this.lastGrade * this.speed, 20) : 0;
      this.coyoteTimer = CONST.coyoteTime;
    }

    // Charge jump: holding X drops the board, crouches, builds jump power,
    // and skates (the speed build lives in the skate branch above); releasing
    // fires the jump (coyote grace applies at ledges). A quick tap still
    // gives a serviceable hop.
    if (this.state === 'ride' && input.jumpHeld) {
      this.charging = true;
      this.chargeTimer = Math.min(this.chargeTimer + dt, TUNING.jumpChargeTime);
    }
    if (input.jumpReleased && this.charging && (this.state === 'ride' || this.coyoteTimer > 0)) {
      this.chargedJump();
    }
  }

  private stepAir(dt: number, input: Input, level: Level): void {
    // Coyote release: letting go of a charge just after rolling off a ledge
    // still jumps. A press-then-release fully in the air (tap) works too.
    if (this.coyoteTimer > 0) {
      if (input.jumpHeld && !this.charging) this.charging = true; // tap started mid-air
      if (input.jumpReleased && this.charging) {
        this.chargedJump();
      }
    } else if (this.charging) {
      // grace expired: the charge fizzles
      this.charging = false;
      this.chargeTimer = 0;
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
    }

    // Crash-style directional air control: up/down stretches or shortens the
    // jump (down brakes extra hard for precision), left/right sidesteps
    // laterally. Locked while holding a grab or slamming, and a vert air off
    // the halfpipe lip pins x — you can only ease back toward the middle.
    if (!this.grabbing && !this.slamActive) {
      if (Math.abs(input.moveY) > 0.05) {
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
          this.pos.x += input.moveX * TUNING.walkSpeed * dt;
        }
      }
    }

    this.pos.addScaledVector(FORWARD, this.speed * dt);
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
      if (wasVert) this.score(CONST.ptsVert);

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
        this.score(CONST.ptsGrab + (this.grabSpinTotal > 2.5 ? CONST.ptsGrabSpin : 0));
        this.grabSpinTotal = 0;
        this.emitSparks(10, 0xfff3d0, 2.2);
      }
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
    this.score(CONST.ptsSlam);
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
        this.score(CONST.ptsEnemy);
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
    // Grinds ride at the speed you brought and bleed a little on the rail.
    this.grindVel = Math.max(CONST.grindMinSpeed, this.grindVel - CONST.grindBleed * dt);

    // THPS balance: the needle is an unstable equilibrium that runs away from
    // center, faster the longer you grind; left/right input fights it. Slow
    // grinds are wobblier than fast ones. Pegging the meter bails you off.
    // The third-mask uber locks the needle dead center.
    const speedFactor = THREE.MathUtils.clamp(
      TUNING.grindSpeed / Math.max(this.grindVel, 1),
      0.6,
      2.2,
    );
    const instability =
      TUNING.balanceDrift * (1 + this.grindTime * CONST.balanceRamp) * speedFactor;
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
    this.surfaceName = 'rail';
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
      this.exitGrind(THREE.MathUtils.lerp(TUNING.grindJumpForce * 0.72, TUNING.grindJumpForce, t));
      if (Math.abs(this.speed) >= CONST.flipMinSpeed) this.flipTimer = CONST.flipDuration;
    }
  }

  private stepFinished(dt: number, level: Level): void {
    this.speed = Math.max(0, this.speed - 40 * dt);
    this.pos.addScaledVector(FORWARD, this.speed * dt);
    // Keep the outro on the deck: no sliding sideways off the edge into a
    // midair hover after the run is already over.
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -5.2, 5.2);
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
    const s = this.railCand.sample;
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
    // Ride the rail in whichever direction matches our along-course travel.
    const travelZ = this.speed >= 0 ? -1 : 1;
    this.grindDir = sample.tangent.z * travelZ >= 0 ? 1 : -1;
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
    // Start the needle slightly off-center in a random direction.
    this.balance = (Math.random() < 0.5 ? -1 : 1) * CONST.balanceStart;
    this.emitSparks(6, 0xffb545, 1.6); // landing-on-the-rail burst
    // The rail keeps the speed you arrived with (within reason) — hit it
    // fast to cross fast; crawl onto it and you'll wobble across.
    this.grindVel = THREE.MathUtils.clamp(
      Math.abs(this.speed),
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
    // A survived grind scores: base + time held on the rail.
    this.score(CONST.ptsGrindBase + Math.round(this.grindTime * CONST.ptsGrindPerSec));
    if (this.grindRail) {
      // Project the rail velocity onto the course axis — exits snap straight,
      // matching the axis-locked movement.
      const tz = this.grindRail.tangentAt(this.grindT).z * this.grindDir;
      this.speed = -tz * this.grindVel;
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
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
    this.emitSparks(8, 0xffb545, 2);
  }

  // ------------------------------------------------------------------ spin --

  private updateSpin(dt: number, input: Input): void {
    const canSpin = this.state === 'ride' || this.state === 'air' || this.state === 'grind';
    if (input.spinPressed && !this.spinning && this.spinCd <= 0 && canSpin) {
      this.spinTimer = TUNING.spinDuration;
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
    const back = FORWARD.clone().multiplyScalar(-Math.sign(this.speed || 1));
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
            if (this.spendMask()) level.detonate(c, true);
            else this.bailFromRail();
          } else if (this.isStomping(c.box)) {
            if (this.slamActive) {
              level.detonate(c, true);
            } else {
              level.lightFuse(c);
              this.vVel = TUNING.crateBounce;
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
            this.score(CONST.ptsBouncy);
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
          // Crates on the rail line are obstacles: spin them, hop and bounce
          // them, or they knock you straight off (a mask absorbs it).
          if (this.spendMask()) this.smashCrate(level, c);
          else this.bailFromRail();
        } else if (this.isStomping(c.box)) {
          // Crash rules: landing on top breaks it and bounces you — high
          // enough to chain crate to crate. A slam punches straight through.
          this.smashCrate(level, c);
          if (!this.slamActive) {
            this.vVel = TUNING.crateBounce;
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
        level.killEnemy(e);
        this.score(CONST.ptsEnemy);
      } else if (this.playerBox.intersectsBox(e.box)) {
        if (this.uberTimer > 0 || this.sliding) {
          // Uber plows through; Crash 3 rules: the slide takes out enemies too.
          level.killEnemy(e);
          this.score(CONST.ptsEnemy);
        } else if (this.isStomping(e.box)) {
          // Crash rules: jumping on an enemy squashes it and bounces you
          // (slams punch straight through instead).
          level.killEnemy(e);
          this.score(CONST.ptsEnemy);
          if (!this.slamActive) {
            this.vVel = TUNING.crateBounce;
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

    // Floating wumpa: touch to collect.
    for (const p of level.pickups) {
      if (!p.alive) continue;
      if (this.playerBox.intersectsBox(p.box)) {
        p.alive = false;
        p.mesh.visible = false;
        this.fruit++;
        this.score(CONST.ptsFruit);
      }
    }

    if (this.playerBox.intersectsBox(level.finishBox)) {
      this.bankCombo(); // whatever is pending counts at the line
      this.state = 'finished';
      this.onFinish(this.runTime);
    }
  }

  private smashCrate(level: Level, c: Crate): void {
    level.breakCrate(c);
    this.cratesBroken++;
    this.score(CONST.ptsCrate);
    if (c.mask) this.gainMask();
    else this.spawnFruit(c.box);
  }

  // Wumpa burst: fruit pops out of the box, arcs, then homes to the player.
  private spawnFruit(box: THREE.Box3): void {
    let count = CONST.fruitPerCrate;
    const cx = (box.min.x + box.max.x) / 2;
    const cy = (box.min.y + box.max.y) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    for (const f of this.fruits) {
      if (count <= 0) break;
      if (f.age >= 0) continue;
      count--;
      f.age = 0;
      f.mesh.visible = true;
      f.mesh.position.set(cx, cy + 0.3, cz);
      f.vel.set((Math.random() - 0.5) * 5, 6 + Math.random() * 4, (Math.random() - 0.5) * 5);
    }
  }

  private updateFruit(dt: number): void {
    for (const f of this.fruits) {
      if (f.age < 0) continue;
      f.age += dt;
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
          if (dist < 1.0) {
            this.fruit++;
            this.score(CONST.ptsFruit);
          }
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
    this.respawnTimer = CONST.respawnDelay;
    this.speed = 0;
    this.vVel = 0;
    // the pending combo dies with you; banked points survive
    this.comboPoints = 0;
    this.comboMult = 0;
    this.comboTimer = 0;
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
    this.bodyGroup.rotation.y = this.visualYaw + this.spinAngle + this.grabSpinAngle;

    // Grab pose, skate-photo style: knees tucked high, one hand pulls the
    // board, the other arm throws up. Direction held picks the variant —
    // up = nosegrab (pitch forward), left = melon (other hand, lean left),
    // right = indy (lean right). Left/right also spin (see updateGrab).
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
    if (this.armR) {
      this.armR.rotation.x = this.armRPose * this.grabPose;
      this.armR.rotation.z = 0.25 - this.grabPose * 0.55;
    }
    if (this.armL) {
      this.armL.rotation.x = this.armLPose * this.grabPose;
      this.armL.rotation.z = -0.25 + this.grabPose * 0.45;
    }
    // Knees up: legs shorten toward the hips while the body crouches deep,
    // and the board comes up with them, into the grabbing hand.
    if (this.legs) {
      const tuck = 1 - 0.5 * this.grabPose;
      this.legs.scale.y = tuck;
      this.legs.position.y = 0.71 - 0.25 * tuck;
    }
    if (this.boardG) {
      this.boardG.position.y = 0.5 * this.grabPose;
      this.boardG.rotation.x = 0.3 * this.grabPose; // nose tips up in the hand
      // On foot the board is stowed — it reappears the moment you're skating
      // (charging, sliding, grinding, carrying speed) or holding a grab.
      this.boardG.visible =
        this.state === 'grind' ||
        this.charging ||
        this.slideTimer > 0 ||
        this.vertLock ||
        this.grabPose > 0.05 ||
        Math.abs(this.speed) > TUNING.walkSpeed + 0.5;
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
    const targetSlide = this.sliding || this.crawling ? 1 : 0;
    this.slidePose += (targetSlide - this.slidePose) * Math.min(1, 18 * dt);
    // Slam has two beats: the "uh oh" hang (rear back), then the pancake drop.
    const hanging = this.slamActive && this.slamHangT > 0;
    const dropping = this.slamActive && this.slamHangT <= 0;
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
        0.35 * this.slidePose -
        0.55 * this.hangPose + // rear back: "...uh oh"
        1.45 * this.dropPose - // belly-first pancake
        0.28 * this.teeterPose; // arms-back "whoa whoa" lean
    }
    const targetCharge = this.charging ? 0.35 + 0.65 * Math.min(1, this.chargeTimer / TUNING.jumpChargeTime) : 0;
    this.chargePose += (targetCharge - this.chargePose) * Math.min(1, 16 * dt);
    this.bodyGroup.position.y =
      this.grabPose * -0.5 - this.slidePose * 0.32 - this.chargePose * 0.26;
    // Impact squash right after a slam lands.
    const squash = this.slamSquash > 0 ? this.slamSquash / CONST.slamSquashTime : 0;
    this.bodyGroup.scale.y = 1.18 * (1 - 0.6 * squash);

    // A bail stays visible so the tumble reads; a plain death blinks out.
    this.group.visible = this.state !== 'dead' || this.bailing;

    // Blob shadow: persistent landing indicator, snapped to whatever floor is
    // below no matter how high the air. Shrinks with height but never fades.
    if (this.shadowGroundY !== null && this.state !== 'dead') {
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

    // Low-poly rider.
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x35506e }),
    );
    legs.position.y = 0.46;
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
