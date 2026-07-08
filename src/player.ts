// Authored fake-physics board movement. No rigidbody, no forces: just a
// heading, a scalar speed, a vertical velocity, and hand-tuned numbers from
// tuning.ts. Ground following is a single downward raycast; slopes only exist
// as fake boost/slowdown numbers derived from the surface normal.

import * as THREE from 'three';
import { TUNING, CONST } from './tuning';
import { Input } from './input';
import { Level } from './level';
import { Rail, RailSample, nearestRail } from './rails';

export type MoveState = 'ride' | 'air' | 'grind' | 'dead' | 'finished';

interface GroundHit {
  y: number;
  normal: THREE.Vector3;
  name: string;
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

  // debug readouts
  railCandidateDist = Infinity;
  balance = 0; // THPS grind balance needle, -1..1 (bail at the ends)

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
  private grabActive = false;
  private grabGraceTimer = 0;
  private grabPose = 0;
  private grabSpinAngle = 0; // trick spin while holding the grab (visual only)
  private spinAngle = 0; // spin-attack rotation (visual only)
  private visualYaw = 0; // Crash-style body facing vs. movement heading
  private flipTimer = 0; // front-flip on jump (visual only)
  private grindTime = 0; // how long this grind has lasted (balance ramps up)
  private prevPos = new THREE.Vector3(); // for travel-direction facing
  private grindRail: Rail | null = null;
  private grindT = 0;
  private grindDir = 1;
  private regrindCd = 0;
  private respawnTimer = 0;
  private coyoteTimer = 0; // jump grace after running off a ledge
  private lastGrade = 0; // slope along travel; >0 downhill, <0 uphill
  private groundHit: GroundHit | null = null;
  private railCand: { rail: Rail; sample: RailSample } | null = null;
  private lean = 0;

  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private spinBox = new THREE.Box3();
  private sparks: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[] = [];

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

    // Chunky PS1 spark pool for grinds and grab-boost landings.
    const sparkGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 40; i++) {
      const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffb545 }));
      mesh.visible = false;
      scene.add(mesh);
      this.sparks.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 });
    }
  }

  get spinning(): boolean {
    return this.spinTimer > 0;
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
    this.cratesBroken = 0;
    this.groundHit = null;
    this.coyoteTimer = 0;
    this.grabActive = false;
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
    this.regrindCd = Math.max(0, this.regrindCd - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.flipTimer = Math.max(0, this.flipTimer - dt);
    this.prevPos.copy(this.pos);

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

    if (this.state === 'ride' || this.state === 'air' || this.state === 'grind') {
      this.collide(level);
      if (this.pos.y < CONST.killY) this.die();
    }

    this.syncVisual(input, dt);
  }

  // ---------------------------------------------------------------- states --

  private stepRide(dt: number, input: Input, level: Level): void {
    // Authored accel / brake / reverse / friction. Holding down brakes through
    // zero into a capped backward roll, like backing up in Crash.
    if (input.moveY > 0.05) {
      if (this.speed < TUNING.maxSpeed) {
        this.speed = Math.min(this.speed + TUNING.acceleration * input.moveY * dt, TUNING.maxSpeed);
      }
    } else if (input.moveY < -0.05) {
      this.speed = Math.max(-TUNING.reverseSpeed, this.speed + CONST.brakePower * input.moveY * dt);
    } else {
      const drop = TUNING.friction * dt;
      this.speed = Math.abs(this.speed) <= drop ? 0 : this.speed - Math.sign(this.speed) * drop;
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
    // bleeds back off. Reverse is capped separately.
    const hardCap = TUNING.maxSpeed * CONST.maxOverspeed;
    if (this.speed > hardCap) this.speed = hardCap;
    if (this.speed > TUNING.maxSpeed && grade <= 0.02) {
      this.speed = Math.max(TUNING.maxSpeed, this.speed - CONST.overspeedDecay * dt);
    }
    this.speed = Math.max(this.speed, -TUNING.reverseSpeed);

    this.pos.addScaledVector(FORWARD, this.speed * dt);

    // Axis-locked sidestep: direct velocity while held, dead stop on release.
    // Left is ALWAYS screen-left, even while backing up.
    if (Math.abs(input.moveX) > 0.05) {
      this.pos.x += input.moveX * TUNING.lateralSpeed * dt;
    }

    // Follow the ground within a chunky snap window, otherwise we ran off an
    // edge and go airborne.
    const hit = this.queryGround(level);
    if (hit && hit.y >= this.pos.y - 1.4 && hit.y <= this.pos.y + 0.8) {
      this.pos.y = hit.y;
      this.groundHit = hit;
      this.grounded = true;
      this.surfaceName = hit.name;
    } else {
      this.state = 'air';
      this.grounded = false;
      this.groundHit = hit;
      // Authored kicker launch: leaving an uphill lip converts speed to lift
      // (forward travel only — backing off an edge just drops).
      this.vVel =
        this.speed > 0 && this.lastGrade < -0.05 ? Math.min(-this.lastGrade * this.speed, 20) : 0;
      this.coyoteTimer = CONST.coyoteTime;
    }

    // Coyote grace: a jump pressed on the exact tick we ran off the lip (or
    // just after) still counts, so late gap jumps aren't eaten.
    if (input.jumpPressed && (this.state === 'ride' || this.coyoteTimer > 0)) {
      this.vVel = TUNING.jumpVelocity;
      this.state = 'air';
      this.grounded = false;
      this.coyoteTimer = 0;
      this.flipTimer = CONST.flipDuration; // Crash front-flip
    }
  }

  private stepAir(dt: number, input: Input, level: Level): void {
    if (input.jumpPressed && this.coyoteTimer > 0) {
      this.vVel = TUNING.jumpVelocity;
      this.coyoteTimer = 0;
      this.flipTimer = CONST.flipDuration;
    }

    // Asymmetric fake gravity: heavier on the way down for a snappy arc.
    const g = this.vVel > 0 ? TUNING.riseGravity : TUNING.fallGravity;
    this.vVel -= g * dt;

    // Crash-style directional air control: up/down stretches or shortens the
    // jump, left/right sidesteps laterally — same axes as on the ground.
    // Locked while holding a grab: the trick freezes your trajectory.
    if (!this.grabActive) {
      if (Math.abs(input.moveY) > 0.05) {
        const cap = TUNING.maxSpeed * CONST.maxOverspeed;
        this.speed = THREE.MathUtils.clamp(
          this.speed + TUNING.airControl * input.moveY * dt,
          -TUNING.reverseSpeed,
          cap,
        );
      }
      if (Math.abs(input.moveX) > 0.05) {
        this.pos.x += input.moveX * TUNING.lateralSpeed * dt;
      }
    }

    this.pos.addScaledVector(FORWARD, this.speed * dt);
    this.pos.y += this.vVel * dt;

    const hit = this.queryGround(level);
    this.groundHit = hit;
    if (hit && this.vVel <= 0 && this.pos.y <= hit.y + 0.05) {
      this.pos.y = hit.y;
      this.vVel = 0;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      this.coyoteTimer = 0;
      // Landing a held (or just-released) grab pays out a short speed burst.
      if (this.grabActive || this.grabGraceTimer > 0) {
        this.speed += TUNING.grabBoost * (this.speed >= 0 ? 1 : -1);
        const cap = TUNING.maxSpeed * CONST.maxOverspeed;
        this.speed = THREE.MathUtils.clamp(this.speed, -cap, cap);
        this.grabActive = false;
        this.grabGraceTimer = 0;
        this.emitSparks(10, 0xfff3d0, 2.2);
      }
      return;
    }
    // No assisted rail snap here on purpose: THPS2 rules — you have to be
    // holding/pressing Triangle to start a grind.
  }

  private stepGrind(dt: number, input: Input, level: Level): void {
    const rail = this.grindRail!;
    this.grindTime += dt;

    // THPS balance: the needle is an unstable equilibrium that runs away from
    // center, faster the longer you grind; left/right input fights it. Pegging
    // the meter bails you off the rail.
    const instability = TUNING.balanceDrift * (1 + this.grindTime * CONST.balanceRamp);
    this.balance += Math.sign(this.balance || 1) * instability * dt;
    this.balance += input.moveX * TUNING.balanceControl * dt;
    if (Math.abs(this.balance) >= 1) {
      this.bailFromRail();
      return;
    }

    this.grindT += this.grindDir * TUNING.grindSpeed * dt;

    if (this.grindT <= 0 || this.grindT >= rail.totalLength) {
      // Ran off the end of the rail: small pop, keep carrying grind speed.
      this.grindT = THREE.MathUtils.clamp(this.grindT, 0, rail.totalLength);
      this.placeOnRail(rail);
      this.exitGrind(2.5);
      return;
    }

    this.placeOnRail(rail);
    this.speed = TUNING.grindSpeed;
    this.surfaceName = 'rail';
    this.groundHit = this.queryGround(level); // keeps the blob shadow honest
    this.emitSparks(1, 0xffb545, 1); // grind sparks off the truck

    if (input.jumpPressed) {
      this.exitGrind(TUNING.grindJumpForce);
      this.flipTimer = CONST.flipDuration;
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
    this.grabActive = false;
    this.grabGraceTimer = 0;
    this.grindTime = 0;
    // Start the needle slightly off-center in a random direction.
    this.balance = (Math.random() < 0.5 ? -1 : 1) * CONST.balanceStart;
    this.emitSparks(6, 0xffb545, 1.6); // landing-on-the-rail burst
    this.speed = TUNING.grindSpeed;
    this.placeOnRail(rail);
  }

  private placeOnRail(rail: Rail): void {
    const p = rail.pointAt(this.grindT);
    this.pos.set(p.x, p.y + CONST.railRideHeight, p.z);
  }

  private exitGrind(vVel: number): void {
    if (this.grindRail) {
      // Project the rail velocity onto the course axis — exits snap straight,
      // matching the axis-locked movement.
      const tz = this.grindRail.tangentAt(this.grindT).z * this.grindDir;
      this.speed = -tz * TUNING.grindSpeed;
    }
    this.grindRail = null;
    this.state = 'air';
    this.vVel = vVel;
    this.regrindCd = CONST.regrindCooldown;
    this.balance = 0;
  }

  // Pegged the balance meter: stumble off the rail with most speed gone.
  // Over a pit that usually means a drop into it.
  private bailFromRail(): void {
    this.grindRail = null;
    this.state = 'air';
    this.vVel = 3;
    this.speed *= CONST.balanceBailSpeedKeep;
    this.regrindCd = CONST.regrindCooldown * 2;
    this.balance = 0;
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
      if (input.grabHeld) {
        this.grabActive = true;
        // Trick spin while the grab is held — pure visual, the trajectory is
        // already locked by the air-control gate.
        this.grabSpinAngle += CONST.grabSpinRate * dt;
      } else if (this.grabActive) {
        // Released mid-air: a short grace window still pays out on landing.
        this.grabActive = false;
        this.grabGraceTimer = CONST.grabGrace;
        this.grabSpinAngle = 0;
      }
    } else if (this.grabActive || this.grabSpinAngle !== 0) {
      this.grabActive = false;
      this.grabSpinAngle = 0;
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
      if (this.spinning && this.spinBox.intersectsBox(c.box)) {
        level.breakCrate(c);
        this.cratesBroken++;
      } else if (this.playerBox.intersectsBox(c.box)) {
        if (this.isStomping(c.box)) {
          // Crash rules: landing on top breaks it and bounces you.
          level.breakCrate(c);
          this.cratesBroken++;
          this.vVel = CONST.crateBounce;
          this.state = 'air';
          this.grounded = false;
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
      } else if (this.playerBox.intersectsBox(e.box)) {
        if (this.isStomping(e.box)) {
          // Crash rules: jumping on an enemy squashes it and bounces you.
          level.killEnemy(e);
          this.vVel = CONST.crateBounce;
          this.state = 'air';
          this.grounded = false;
        } else {
          this.die();
          return;
        }
      }
    }

    for (const cp of level.checkpoints) {
      if (!cp.active && this.playerBox.intersectsBox(cp.box)) {
        level.activateCheckpoint(cp);
        this.onCheckpoint();
      }
    }

    if (this.playerBox.intersectsBox(level.finishBox)) {
      this.state = 'finished';
      this.onFinish(this.runTime);
    }
  }

  // Falling and our feet are near the target's top face = a stomp. The window
  // is deep enough that a max-speed fall can't step past it in one tick.
  private isStomping(box: THREE.Box3): boolean {
    return this.state === 'air' && this.vVel < 0 && this.pos.y > box.max.y - 0.75;
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
    this.onDeath();
  }

  // ------------------------------------------------------------------ misc --

  private queryGround(level: Level): GroundHit | null {
    this.raycaster.set(new THREE.Vector3(this.pos.x, this.pos.y + 2.5, this.pos.z), DOWN);
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObjects(level.groundMeshes, false);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const normal = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld);
    return { y: hit.point.y, normal, name: hit.object.name };
  }

  private syncVisual(input: Input, dt: number): void {
    this.group.position.copy(this.pos);

    // Chunky little carve lean; while grinding, the lean IS the balance needle.
    const targetLean =
      this.state === 'grind'
        ? this.balance * 0.55 // tip toward the needle/d-pad side (balance>0 = right)
        : this.grounded
          ? -input.moveX * 0.28
          : -input.moveX * 0.12;
    this.lean += (targetLean - this.lean) * Math.min(1, 12 * dt);
    this.group.rotation.z = this.lean;

    // Crash walk facing: at low speed on the ground the body snaps to face the
    // actual travel direction — sidesteps face sideways, backing up faces the
    // camera. On rails it faces along the rail. Movement itself never leaves
    // the course axes; this is purely the model turning.
    let targetYaw = 0;
    const facingApplies =
      (this.grounded && (this.speed < -0.5 || Math.abs(this.speed) < CONST.walkFaceSpeed)) ||
      this.state === 'grind';
    if (facingApplies) {
      const vx = this.pos.x - this.prevPos.x;
      const vz = this.pos.z - this.prevPos.z;
      if (vx * vx + vz * vz > (1.5 * dt) * (1.5 * dt)) {
        targetYaw = wrapAngle(Math.atan2(vx, vz) - Math.PI);
      } else {
        targetYaw = this.visualYaw; // idle: keep facing where we last walked
      }
    }
    this.visualYaw += wrapAngle(targetYaw - this.visualYaw) * Math.min(1, 20 * dt);
    this.bodyGroup.rotation.y = this.visualYaw + this.spinAngle + this.grabSpinAngle;

    // Grab tuck + Crash front-flip, blended so a grab overrides the flip.
    const targetPose = this.grabActive ? 1 : 0;
    this.grabPose += (targetPose - this.grabPose) * Math.min(1, 16 * dt);
    const flip =
      this.flipTimer > 0 ? (1 - this.flipTimer / CONST.flipDuration) * Math.PI * 2 : 0;
    this.bodyGroup.rotation.x = flip * (1 - this.grabPose) + 0.45 * this.grabPose;
    this.bodyGroup.position.y = this.grabPose * -0.12;

    this.group.visible = this.state !== 'dead';

    // Blob shadow: critical for judging gap landings.
    if (this.groundHit && this.state !== 'dead') {
      const h = Math.max(0, this.pos.y - this.groundHit.y);
      this.shadow.visible = true;
      this.shadow.position.set(this.pos.x, this.groundHit.y + 0.03, this.pos.z);
      this.shadow.scale.setScalar(THREE.MathUtils.clamp(1.3 - h * 0.06, 0.45, 1.3));
    } else {
      this.shadow.visible = false; // no shadow = you are over the pit
    }
  }

  private buildVisual(): THREE.Group {
    const g = new THREE.Group();

    // Board (visual only), nose toward local +Z.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.09, 1.7),
      new THREE.MeshLambertMaterial({ color: 0x8a4a3a }),
    );
    board.position.y = 0.16;
    g.add(board);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
    for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) {
      const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), wheelMat);
      wheel.position.set(x, 0.06, z);
      g.add(wheel);
    }

    // Low-poly rider.
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x35506e }),
    );
    legs.position.y = 0.46;
    g.add(legs);
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
