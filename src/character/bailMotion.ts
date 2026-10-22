import * as THREE from 'three';
import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';

export type BailTumbleKind = 'forward' | 'back' | 'side' | 'air';

// Three spring coordinates per semantic joint. Distal joints lag their parent;
// joint limits stop rubber limbs folding through themselves. No scene bodies,
// constraints, mesh clones, per-frame random draws or world queries are needed.
const JOINTS = 14;
const PARENTS = [-1, 0, 0, 2, 3, 0, 5, 6, -1, 8, 9, -1, 11, 12];
const LIMITS = [
  .48, .35, .4, .55, .5, .42,
  1.8, .7, 1.05, 1.05, .22, .25, .7, .4, .55,
  1.8, .7, 1.05, 1.05, .22, .25, .7, .4, .55,
  1.2, .4, .6, .95, .12, .12, .55, .2, .3,
  1.2, .4, .6, .95, .12, .12, .55, .2, .3,
];
const clamp = (v: number, bound: number) => Math.max(-bound, Math.min(bound, v));
// Player's legacy armR/legR are the anatomical LEFT (+X). Elastic controls
// use anatomical names, so their spring ownership must follow the actual rig.
const ELASTIC_CHANNELS = ELASTIC_LENGTH_CONTROLS.map(([id, part]) => ({ id, part,
  joint: part === 0 ? 0 : part <= 2 ? (id.includes('left') ? 5 : 2) + part - 1 :
    (id.includes('left') ? 11 : 8) + part - 3 }));
const SEGMENTS = ELASTIC_CHANNELS.length;
// A short, fixed delay line keeps overlapping contact waves independent.
// The longest anatomical path takes <.18s; 32 bins cover .267s at the spring
// rate. Empty bins cost one bit check, and contacts never allocate records.
const WAVE_HZ = 120, WAVE_SLOTS = 32, WAVE_STRIDE = JOINTS * 3 + SEGMENTS;
const STRAIN_STIFFNESS = [260, 230, 310, 220, 300];
const STRAIN_DAMPING = [12, 10, 8.5, 11, 9.5];
// The virtual pelvis connects both hips to the spine. Distances are tiny,
// fixed rig data; no scene traversal or geometry work is needed at contact.
const CONTACT_PARENTS = [14, 0, 0, 2, 3, 0, 5, 6, 14, 8, 9, 14, 11, 12, -1];
function jointDistance(a: number, b: number): number {
  for (let ancestor = a, da = 0; ancestor >= 0; ancestor = CONTACT_PARENTS[ancestor], da++)
    for (let other = b, db = 0; other >= 0; other = CONTACT_PARENTS[other], db++)
      if (ancestor === other) return da + db;
  return 0;
}
const CONTACT_DISTANCE = Uint8Array.from({ length: JOINTS * JOINTS }, (_, i) =>
  jointDistance(Math.floor(i / JOINTS), i % JOINTS));
const SEGMENT_DISTANCE = Uint8Array.from({ length: JOINTS * SEGMENTS }, (_, i) => {
  const origin = Math.floor(i / SEGMENTS) * JOINTS, {joint} = ELASTIC_CHANNELS[i % SEGMENTS];
  return Math.min(CONTACT_DISTANCE[origin + joint], CONTACT_DISTANCE[origin + joint + 1]);
});

/** Inertial secondary motion for an INTACT bail. The existing controller owns
 * translation/contact/recovery. This tiny spring rig responds to those events,
 * instead of playing a windmill loop unrelated to the crash. */
export class BailMotion {
  readonly angles = new Float64Array(JOINTS * 3);
  private readonly velocity = new Float64Array(JOINTS * 3);
  private readonly bias = new Float64Array(JOINTS * 3);
  private readonly stiffness = new Float64Array(JOINTS);
  private readonly damping = new Float64Array(JOINTS);
  private readonly lower = Float64Array.from({length:JOINTS}, (_, joint) => -LIMITS[joint * 3]);
  private readonly upper = Float64Array.from({length:JOINTS}, (_, joint) => LIMITS[joint * 3]);
  private readonly gravity = new THREE.Vector3();
  private readonly inverse = new THREE.Quaternion();
  private readonly previousSpin = new THREE.Vector3();
  private readonly localSpin = new THREE.Vector3();
  private readonly previousTravel = new THREE.Vector3();
  private readonly linearAcceleration = new THREE.Vector3();
  private hasTravel = false;
  private readonly frameTarget = new Float64Array(3);
  private readonly torsoForce = new Float64Array(3);
  private readonly limbForce = new Float64Array(3);
  private readonly frameDamping = new Float64Array(JOINTS);
  private readonly acceleration = new THREE.Vector3();
  private readonly contactWaves = new Float64Array(WAVE_SLOTS * WAVE_STRIDE);
  private waveMask = 0;
  private waveTime = 0;
  private waveTick = 0;
  private loosen = 0;
  private readonly elasticity = characterElasticityAmplitudes('bail');
  private readonly applied = new Array<THREE.Object3D | null>(JOINTS).fill(null);
  private readonly baseline = Array.from({ length: JOINTS }, () => new THREE.Quaternion());
  readonly deformations: Record<string, number> = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id]) => [id, 1]));
  private readonly strain = new Float64Array(SEGMENTS);
  private readonly strainVelocity = new Float64Array(SEGMENTS);
  private seed = 1;
  private kick = 0;
  private live = false;

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  reset(): void {
    this.live = false;
    this.angles.fill(0); this.velocity.fill(0);
    for (let joint = 0; joint < JOINTS; joint++) {
      this.lower[joint] = -LIMITS[joint * 3]; this.upper[joint] = LIMITS[joint * 3];
    }
    this.contactWaves.fill(0); this.waveMask = 0; this.waveTime = this.waveTick = 0; this.loosen = 0;
    this.strain.fill(0); this.strainVelocity.fill(0);
    this.kick = 0;
    this.previousSpin.set(0, 0, 0);
    this.previousTravel.set(0, 0, 0); this.linearAcceleration.set(0, 0, 0); this.hasTravel = false;
  }

  /** Also supports the legacy rig when the editable animation bridge is off. */
  restore(): void {
    for (let i = 0; i < JOINTS; i++) {
      this.applied[i]?.quaternion.copy(this.baseline[i]);
      this.applied[i] = null;
    }
  }

  begin(kind: BailTumbleKind, spin: THREE.Vector3, seed: number, carryPose = false, travel?: THREE.Vector3): void {
    if (!carryPose) this.reset();
    this.live = true;
    this.seed = seed >>> 0 || 1;
    this.previousSpin.copy(spin);
    this.hasTravel = !!travel;
    if (travel) this.previousTravel.copy(travel);
    this.linearAcceleration.set(0, 0, 0);
    // A different loose/tucked side on each incident, with independently soft
    // wrists, elbows and knees. The random stream is cosmetic and isolated.
    const curl = this.random() * 1.8 - .5;
    const side = this.random() < .5 ? -1 : 1;
    const pitch = kind === 'back' ? -1 : kind === 'forward' ? 1 : side;
    for (let joint = 0; joint < JOINTS; joint++) {
      const distal = joint === 4 || joint === 7 || joint === 10 || joint === 13;
      this.stiffness[joint] = (distal ? 32 : 48) + this.random() * 40;
      this.damping[joint] = 2.6 + this.random() * 2.4;
      for (let axis = 0; axis < 3; axis++) {
        const i = joint * 3 + axis, limit = LIMITS[i];
        this.bias[i] = (this.random() - .5) * limit * .65;
        this.velocity[i] += (this.random() - .5) * limit * 8 +
          (axis === 0 ? pitch * (joint >= 8 ? -2 : 2) : axis === 2 ? side * 1.5 : 0);
      }
    }
    this.bias[6] += curl * .5; this.bias[15] -= curl * .35;
    this.bias[24] -= curl * .3; this.bias[33] += curl * .4;
    // Let one knee fold while the other leg trails. A symmetric initial
    // kick left both legs locked straight through the most visible air beat.
    this.bias[9] = -.3 - this.random() * .55;
    this.bias[18] = -.25 - this.random() * .65;
    this.bias[27] = .25 + this.random() * .6;
    this.bias[36] = .15 + this.random() * .7;
    this.velocity[27] = side > 0 ? 6 : 1.5;
    this.velocity[36] = side > 0 ? 1.5 : 6;
    for (let segment = 0; segment < SEGMENTS; segment++) this.strainVelocity[segment] -= 3;
  }

  impact(speed: number, normal?: THREE.Vector3, contact?: THREE.Vector3, contactJoint?: number): void {
    if (!this.live) return;
    const strength = Math.min(1.7, Math.max(.12, speed / 12));
    const origin = contactJoint ?? (contact ? (contact.y > .35 ? 1 : contact.y < -.2 ?
      (contact.x < 0 ? 9 : 12) : Math.abs(contact.x) > .12 ? (contact.x < 0 ? 2 : 5) : 0) : 0);
    for (let segment = 0; segment < SEGMENTS; segment++) {
      // A segment can be loaded from either end: a hand strike starts at
      // the forearm, whereas a shoulder strike reaches it a beat later.
      const distance = SEGMENT_DISTANCE[origin * SEGMENTS + segment];
      const delay = distance * .022;
      const wave = this.contactWaveOffset(delay) + JOINTS * 3 + segment;
      this.contactWaves[wave] = Math.max(-20, this.contactWaves[wave] - strength * 12 / (1 + distance * .55));
    }
    this.loosen = Math.max(this.loosen, strength);
    for (let joint = 0; joint < JOINTS; joint++) {
      const leg = joint >= 8, distal = joint === 4 || joint === 7 || joint === 10 || joint === 13;
      const left = joint >= 2 && joint <= 4 || joint >= 8 && joint <= 10;
      const struckSide = !contact || Math.abs(contact.x) < .12 || (contact.x < 0) === left;
      // The contacted joint reacts first, even for a hand/foot strike.
      // Successive impacts keep their own arrival times. A wrist hit must
      // not erase an approaching ankle reaction or pull it forward in time.
      const distance = CONTACT_DISTANCE[origin * JOINTS + joint];
      const delay = contactJoint !== undefined ? distance * .018 :
        (distal ? .065 : joint === 3 || joint === 6 || joint === 9 || joint === 12 ? .035 : 0) + (struckSide ? 0 : .018);
      const wave = this.contactWaveOffset(delay) + joint * 3;
      const transfer = contactJoint !== undefined ? 1 / (1 + distance * .22) : 1;
      for (let axis = 0; axis < 3; axis++) {
        const i = joint * 3 + axis, limit = LIMITS[i];
        const directed = normal ? (axis === 0 ? normal.z * (leg ? -1 : 1) : axis === 2 ? -normal.x : 0) : 0;
        const impulse = ((this.random() * 2 - 1) * .65 + directed * 1.1) * limit * strength * 7 * transfer;
        // Carry existing spring momentum through the hit. Joint damping and
        // compliant stops dissipate it locally as each new impulse arrives.
        this.contactWaves[wave + axis] = clamp(this.contactWaves[wave + axis] + impulse, 18);
        // Each collision finds a new asymmetric fold, which slowly releases.
        this.bias[i] = clamp(this.bias[i] * .55 + impulse * .035, limit * .8);
      }
    }
    // Folding joints retain their anatomical direction: one knee gathers
    // under the body while the other trails, then the delayed ankle catches
    // up. Independent draws avoid a repeated symmetric starfish on landing.
    this.bias[9] = -.2 - this.random() * .6;
    this.bias[18] = -.2 - this.random() * .6;
    const tuck = this.random();
    this.bias[27] = .15 + tuck * .65;
    this.bias[36] = .15 + (1 - tuck) * .65;
  }

  private contactWaveOffset(delay: number): number {
    const tick = Math.max(this.waveTick, Math.ceil((this.waveTime + delay) * WAVE_HZ - 1e-8));
    const slot = tick & (WAVE_SLOTS - 1);
    this.waveMask |= 1 << slot;
    return slot * WAVE_STRIDE;
  }

  private advanceContactWaves(dt: number): void {
    this.waveTime += dt;
    const through = Math.floor(this.waveTime * WAVE_HZ + 1e-8);
    for (let tick = this.waveTick; this.waveMask !== 0 && tick <= through; tick++) {
      const slot = tick & (WAVE_SLOTS - 1), bit = 1 << slot;
      if (!(this.waveMask & bit)) continue;
      const offset = slot * WAVE_STRIDE;
      for (let i = 0; i < JOINTS * 3; i++) this.velocity[i] += this.contactWaves[offset + i];
      for (let i = 0; i < SEGMENTS; i++)
        this.strainVelocity[i] = clamp(this.strainVelocity[i] + this.contactWaves[offset + JOINTS * 3 + i], 20);
      this.contactWaves.fill(0, offset, offset + WAVE_STRIDE);
      this.waveMask &= ~bit;
    }
    this.waveTick = through + 1;
  }

  /** The editable/base pose is already composed. Put its anatomical stops
   * into spring space before integration: a visually straight knee must not
   * keep simulating an invisible backwards bend and take ages to release. */
  prepareHinge(joint: number, node: THREE.Object3D | null, weight: number): void {
    const limit = LIMITS[joint * 3];
    this.lower[joint] = -limit; this.upper[joint] = limit;
    if (!node || weight <= 1e-5) return;
    const elbow = joint === 3 || joint === 6;
    if (!elbow && joint !== 9 && joint !== 12) return;
    const lo = Math.max(-limit, ((elbow ? -2.35 : .03) - node.rotation.x) / weight);
    const hi = Math.min(limit, ((elbow ? -.05 : 2.45) - node.rotation.x) / weight);
    // An edited base entirely outside the reachable interval retains the
    // existing final safety clamp. Never create an inverted spring interval.
    if (lo <= hi) { this.lower[joint] = lo; this.upper[joint] = hi; }
  }

  step(dt: number, orientation: THREE.Quaternion, spin: THREE.Vector3,
    grounded: boolean, recovery: number, kick: number, weight: number, travel?: THREE.Vector3): boolean {
    if (!this.live || dt <= 0) return false;
    // The planted recovery has fully taken over. Stop integrating invisible
    // springs; a later lost-support event calls begin() with its captured pose.
    if (recovery >= .32) { this.reset(); return false; }
    // Bounded work even after a debugger pause. Gameplay advances at 60 Hz;
    // two cheap spring substeps prevent stiff wrist/knee limits from jittering.
    const elapsed = Math.min(dt, 1 / 15), steps = Math.ceil(elapsed * 120), h = elapsed / steps;
    if (kick > this.kick + .04) this.impact(4 + kick * 5);
    this.kick = kick;
    this.inverse.copy(orientation).invert();
    this.gravity.set(0, -1, 0).applyQuaternion(this.inverse);
    // Both velocity streams arrive in world space. Different travel/control
    // bases must not change the response of the same posed body. Differentiate
    // there first, then bring forces and spin into the body's local frame.
    const inverseDt = 1 / Math.max(dt, 1 / 240);
    this.acceleration.copy(spin).sub(this.previousSpin).multiplyScalar(inverseDt).applyQuaternion(this.inverse);
    this.previousSpin.copy(spin);
    this.localSpin.copy(spin).applyQuaternion(this.inverse);
    this.linearAcceleration.set(0, 0, 0);
    if (travel) {
      if (this.hasTravel) this.linearAcceleration.copy(travel).sub(this.previousTravel)
        .multiplyScalar(inverseDt).clampLength(0, 55).applyQuaternion(this.inverse);
      this.previousTravel.copy(travel); this.hasTravel = true;
    } else this.hasTravel = false;
    const outward = Math.min(.35, this.localSpin.lengthSq() * .0018);
    const settle = grounded ? 1.8 : 1;
    const recover = 1 - THREE.MathUtils.smoothstep(recovery, 0, .32);
    const amount = Math.max(0, Math.min(2, weight)) * recover;
    const looseDecay = Math.exp(-7 * h);
    // Resolve body-frame forcing once, rather than branching/clamping the
    // same vectors for all 42 spring coordinates on every substep.
    for (let axis = 0; axis < 3; axis++) {
      const gravity = axis === 0 ? this.gravity.z : axis === 2 ? -this.gravity.x : 0;
      const angular = this.localSpin.getComponent(axis);
      const accel = clamp(this.acceleration.getComponent(axis), 60);
      const linear = axis === 0 ? this.linearAcceleration.z : axis === 2 ? -this.linearAcceleration.x : 0;
      this.frameTarget[axis] = gravity * .42 - angular * .025;
      this.torsoForce[axis] = -accel * .1 - linear * .24;
      this.limbForce[axis] = -accel * .1 + linear * .38;
    }
    for (let joint = 0; joint < JOINTS; joint++) this.frameDamping[joint] = 1 / (1 + this.damping[joint] * settle * h);
    for (let step = 0; step < steps; step++) {
      this.advanceContactWaves(h);
      this.loosen *= looseDecay;
      const softness = 1 / (1 + this.loosen * .8);
      for (let joint = 0; joint < JOINTS; joint++) {
        const parent = PARENTS[joint];
        const stiffness = this.stiffness[joint] * softness;
        const damping = this.frameDamping[joint];
        const inertia = joint <= 1 ? this.torsoForce : this.limbForce;
        for (let axis = 0; axis < 3; axis++) {
          const i = joint * 3 + axis, limit = LIMITS[i];
          const lo = axis === 0 ? this.lower[joint] : -limit;
          const hi = axis === 0 ? this.upper[joint] : limit;
          const hinge = axis === 0 && (joint === 3 || joint === 6 || joint === 9 || joint === 12);
          let angle = this.angles[i], velocity = this.velocity[i];
          const chain = parent >= 0 ? this.velocity[parent * 3 + axis] * .7 : 0;
          const target = Math.max(lo, Math.min(hi, clamp(this.bias[i] + this.frameTarget[axis] * limit, limit) * recover));
          // Hanging limbs carry through a braking torso; upward spine/head
          // respond oppositely. No clip clock or pose needs to restart.
          const force = stiffness * (target - angle) + chain + inertia[axis] * limit;
          velocity = clamp((velocity + force * h) * damping, 22);
          if (hinge) {
            // A small compliant stop slows only motion into the boundary.
            // Inward motion is free immediately; there is no dead interval
            // hidden behind a rendering clamp after a later bounce.
            const margin = Math.min(.18, (hi - lo) * .2);
            const gap = velocity < 0 ? angle - lo : hi - angle;
            const load = margin > 0 ? Math.max(0, 1 - Math.max(0, gap) / margin) : 1;
            velocity /= 1 + load * load * 24 * h;
          }
          angle += velocity * h;
          if (angle < lo || angle > hi) {
            const outward = angle < lo ? velocity < 0 : velocity > 0;
            angle = Math.max(lo, Math.min(hi, angle));
            if (outward) velocity *= hinge ? -.08 : -.18;
          }
          this.angles[i] = angle; this.velocity[i] = velocity;
        }
      }
      for (let segment = 0; segment < SEGMENTS; segment++) {
        const {part} = ELASTIC_CHANNELS[segment];
        const velocity = (this.strainVelocity[segment] - this.strain[segment] * STRAIN_STIFFNESS[part] * h) /
          (1 + STRAIN_DAMPING[part] * h);
        const strain = this.strain[segment] + velocity * h;
        this.strain[segment] = clamp(strain, 1.8);
        this.strainVelocity[segment] = Math.abs(strain) > 1.8 ? velocity * -.15 : velocity;
      }
    }
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const {id, part, joint} = ELASTIC_CHANNELS[segment];
      // Independent lengths multiply editable authored deformation. Distal
      // inertia adds small delayed stretch; impact compression rebounds finitely.
      const lag = clamp((Math.abs(this.velocity[joint * 3]) + Math.abs(this.velocity[joint * 3 + 2]) * .6) * .035, .45);
      this.deformations[id] = 1 + this.elasticity[part] * (this.strain[segment] * 1.7 + lag + outward * (part === 0 ? .2 : 1)) * amount;
    }
    return amount > .001;
  }

  apply(joint: number, node: THREE.Object3D | null, weight: number): void {
    if (!node) return;
    this.applied[joint] = node;
    this.baseline[joint].copy(node.quaternion);
    const i = joint * 3;
    node.rotation.x += this.angles[i] * weight;
    node.rotation.y += this.angles[i + 1] * weight;
    node.rotation.z += this.angles[i + 2] * weight;
    // Knees/elbows bend in their anatomical direction, even when an edited
    // base clip already bends them. Other coordinates remain soft and loose.
    if (joint === 3 || joint === 6) node.rotation.x = Math.min(-.05, Math.max(-2.35, node.rotation.x));
    if (joint === 9 || joint === 12) node.rotation.x = Math.max(.03, Math.min(2.45, node.rotation.x));
  }
}
