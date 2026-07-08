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

export class Player {
  pos = new THREE.Vector3(); // feet position
  heading = Math.PI; // yaw; forward = (sin, 0, cos)
  speed = 0;
  vVel = 0;
  state: MoveState = 'ride';
  grounded = false;
  surfaceName = '-';
  runTime = 0;
  cratesBroken = 0;

  // debug readouts
  railCandidateDist = Infinity;

  // wired up by main.ts
  onDeath: () => void = () => {};
  onFinish: (time: number) => void = () => {};

  readonly group: THREE.Group;
  private bodyGroup: THREE.Group; // rotates for the spin/trick
  private shadow: THREE.Mesh;

  private spinTimer = 0;
  private spinCd = 0;
  private grindRail: Rail | null = null;
  private grindT = 0;
  private grindDir = 1;
  private regrindCd = 0;
  private respawnTimer = 0;
  private lastGrade = 0; // slope along travel; >0 downhill, <0 uphill
  private groundHit: GroundHit | null = null;
  private railCand: { rail: Rail; sample: RailSample } | null = null;
  private lean = 0;

  private raycaster = new THREE.Raycaster();
  private playerBox = new THREE.Box3();
  private spinBox = new THREE.Box3();

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.bodyGroup = this.buildVisual();
    this.group.add(this.bodyGroup);
    scene.add(this.group);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  get spinning(): boolean {
    return this.spinTimer > 0;
  }

  respawn(level: Level): void {
    level.reset();
    this.pos.copy(level.spawnPos);
    this.heading = level.spawnHeading;
    this.speed = 0;
    this.vVel = 0;
    this.state = 'ride';
    this.grounded = true;
    this.spinTimer = 0;
    this.spinCd = 0;
    this.bodyGroup.rotation.y = 0;
    this.grindRail = null;
    this.regrindCd = 0;
    this.runTime = 0;
    this.cratesBroken = 0;
    this.groundHit = null;
  }

  // One deterministic fixed step.
  step(dt: number, input: Input, level: Level): void {
    this.regrindCd = Math.max(0, this.regrindCd - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);

    // Rail candidate is computed once per step: used for grind entry, the
    // assisted landing snap, and the debug panel.
    this.railCand = nearestRail(level.rails, this.pos);
    this.railCandidateDist = this.railCand ? this.railCand.sample.distance : Infinity;

    if (input.restartPressed) {
      this.respawn(level);
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

    if (this.state === 'ride' || this.state === 'air' || this.state === 'grind') {
      this.collide(level);
      if (this.pos.y < CONST.killY) this.die();
    }

    this.syncVisual(input, dt);
  }

  // ---------------------------------------------------------------- states --

  private stepRide(dt: number, input: Input, level: Level): void {
    this.heading -= input.moveX * TUNING.turnRate * dt;

    // Authored accel / brake / friction.
    if (input.moveY > 0.05) {
      if (this.speed < TUNING.maxSpeed) {
        this.speed = Math.min(this.speed + TUNING.acceleration * input.moveY * dt, TUNING.maxSpeed);
      }
    } else if (input.moveY < -0.05) {
      this.speed = Math.max(0, this.speed + CONST.brakePower * input.moveY * dt);
    } else {
      this.speed = Math.max(0, this.speed - TUNING.friction * dt);
    }

    // Fake slope response from the ground normal: grade > 0 means the surface
    // drops away along our heading.
    const f = this.forward();
    let grade = 0;
    if (this.groundHit) {
      const n = this.groundHit.normal;
      grade = (n.x * f.x + n.z * f.z) / Math.max(n.y, 0.2);
    }
    if (grade > 0.02) {
      this.speed += TUNING.slopeBoost * grade * dt;
    } else if (grade < -0.02) {
      this.speed = Math.max(0, this.speed + TUNING.uphillSlowdown * grade * dt);
    }
    this.lastGrade = grade;

    // Downhill may exceed maxSpeed up to a hard cap; on the flat the excess
    // bleeds back off.
    const hardCap = TUNING.maxSpeed * CONST.maxOverspeed;
    if (this.speed > hardCap) this.speed = hardCap;
    if (this.speed > TUNING.maxSpeed && grade <= 0.02) {
      this.speed = Math.max(TUNING.maxSpeed, this.speed - CONST.overspeedDecay * dt);
    }

    this.pos.addScaledVector(f, this.speed * dt);

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
      // Authored kicker launch: leaving an uphill lip converts speed to lift.
      this.vVel = this.lastGrade < -0.05 ? Math.min(-this.lastGrade * this.speed, 20) : 0;
    }

    if (this.state === 'ride' && input.jumpPressed) {
      this.vVel = TUNING.jumpVelocity;
      this.state = 'air';
      this.grounded = false;
    }
  }

  private stepAir(dt: number, input: Input, level: Level): void {
    this.heading -= input.moveX * TUNING.turnRate * CONST.airTurnFactor * dt;

    // Asymmetric fake gravity: heavier on the way down for a snappy arc.
    const g = this.vVel > 0 ? TUNING.riseGravity : TUNING.fallGravity;
    this.vVel -= g * dt;

    this.pos.addScaledVector(this.forward(), this.speed * dt);
    this.pos.y += this.vVel * dt;

    const hit = this.queryGround(level);
    this.groundHit = hit;
    if (hit && this.vVel <= 0 && this.pos.y <= hit.y + 0.05) {
      this.pos.y = hit.y;
      this.vVel = 0;
      this.state = 'ride';
      this.grounded = true;
      this.surfaceName = hit.name;
      return;
    }

    // Assisted snap: falling in close to a rail hops on without pressing
    // Triangle, so landings on the rail are forgiving.
    if (this.vVel < 0 && this.regrindCd <= 0 && this.railCand) {
      const s = this.railCand.sample;
      if (s.distance < TUNING.railSnapDistance * CONST.assistSnapFactor && this.pos.y > s.point.y - 0.6) {
        this.enterGrind(this.railCand.rail, s);
      }
    }
  }

  private stepGrind(dt: number, input: Input, level: Level): void {
    const rail = this.grindRail!;
    this.grindT += this.grindDir * TUNING.grindSpeed * dt;

    if (this.grindT <= 0 || this.grindT >= rail.totalLength) {
      // Ran off the end of the rail: small pop, keep carrying grind speed.
      this.grindT = THREE.MathUtils.clamp(this.grindT, 0, rail.totalLength);
      this.placeOnRail(rail);
      this.exitGrind(2.5);
      return;
    }

    this.placeOnRail(rail);
    const tan = rail.tangentAt(this.grindT).multiplyScalar(this.grindDir);
    this.heading = Math.atan2(tan.x, tan.z);
    this.speed = TUNING.grindSpeed;
    this.surfaceName = 'rail';
    this.groundHit = this.queryGround(level); // keeps the blob shadow honest

    if (input.jumpPressed) {
      this.exitGrind(TUNING.grindJumpForce);
    }
  }

  private stepFinished(dt: number, level: Level): void {
    this.speed = Math.max(0, this.speed - 40 * dt);
    this.pos.addScaledVector(this.forward(), this.speed * dt);
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
    this.grindDir = sample.tangent.dot(this.forward()) >= 0 ? 1 : -1;
    this.state = 'grind';
    this.grounded = false;
    this.vVel = 0;
    this.speed = TUNING.grindSpeed;
    const tan = sample.tangent.clone().multiplyScalar(this.grindDir);
    this.heading = Math.atan2(tan.x, tan.z);
    this.placeOnRail(rail);
  }

  private placeOnRail(rail: Rail): void {
    const p = rail.pointAt(this.grindT);
    this.pos.set(p.x, p.y + CONST.railRideHeight, p.z);
  }

  private exitGrind(vVel: number): void {
    this.grindRail = null;
    this.state = 'air';
    this.vVel = vVel;
    this.regrindCd = CONST.regrindCooldown;
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
      this.bodyGroup.rotation.y = progress * Math.PI * 2;
      if (this.spinTimer <= 0) {
        this.bodyGroup.rotation.y = 0;
        this.spinCd = CONST.spinCooldown;
      }
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
        // Plowing into a crate without spinning breaks it but kills your flow.
        level.breakCrate(c);
        this.cratesBroken++;
        this.speed *= 0.35;
      }
    }

    for (const e of level.enemies) {
      if (!e.alive) continue;
      if (this.spinning && this.spinBox.intersectsBox(e.box)) {
        level.killEnemy(e);
      } else if (this.playerBox.intersectsBox(e.box)) {
        this.die();
        return;
      }
    }

    if (this.playerBox.intersectsBox(level.finishBox)) {
      this.state = 'finished';
      this.onFinish(this.runTime);
    }
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

  private forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

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
    this.group.rotation.y = this.heading;

    // Chunky little carve lean.
    const targetLean = this.grounded || this.state === 'grind' ? -input.moveX * 0.28 : -input.moveX * 0.12;
    this.lean += (targetLean - this.lean) * Math.min(1, 12 * dt);
    this.group.rotation.z = this.lean;

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

    return g;
  }
}
