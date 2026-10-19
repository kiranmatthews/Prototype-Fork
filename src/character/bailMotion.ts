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

/** Inertial secondary motion for an INTACT bail. The existing controller owns
 * translation/contact/recovery. This tiny spring rig responds to those events,
 * instead of playing a windmill loop unrelated to the crash. */
export class BailMotion {
  readonly angles = new Float64Array(JOINTS * 3);
  private readonly velocity = new Float64Array(JOINTS * 3);
  private readonly bias = new Float64Array(JOINTS * 3);
  private readonly stiffness = new Float64Array(JOINTS);
  private readonly damping = new Float64Array(JOINTS);
  private readonly gravity = new THREE.Vector3();
  private readonly inverse = new THREE.Quaternion();
  private readonly previousSpin = new THREE.Vector3();
  private readonly acceleration = new THREE.Vector3();
  private readonly elasticity = characterElasticityAmplitudes('bail');
  private readonly applied = new Array<THREE.Object3D | null>(JOINTS).fill(null);
  private readonly baseline = Array.from({ length: JOINTS }, () => new THREE.Quaternion());
  readonly deformations: Record<string, number> = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id]) => [id, 1]));
  private strain = 0;
  private strainVelocity = 0;
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
    this.strain = this.strainVelocity = this.kick = 0;
    this.previousSpin.set(0, 0, 0);
  }

  /** Also supports the legacy rig when the editable animation bridge is off. */
  restore(): void {
    for (let i = 0; i < JOINTS; i++) {
      this.applied[i]?.quaternion.copy(this.baseline[i]);
      this.applied[i] = null;
    }
  }

  begin(kind: BailTumbleKind, spin: THREE.Vector3, seed: number, carryPose = false): void {
    if (!carryPose) this.reset();
    this.live = true;
    this.seed = seed >>> 0 || 1;
    this.previousSpin.copy(spin);
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
    this.strainVelocity -= 3;
  }

  impact(speed: number): void {
    if (!this.live) return;
    const strength = Math.min(1.7, Math.max(.12, speed / 12));
    this.strainVelocity = Math.max(-20, this.strainVelocity - strength * 12);
    for (let i = 0; i < this.velocity.length; i++) {
      // Every impact redirects momentum instead of restarting a pose/clock.
      this.velocity[i] = clamp(this.velocity[i] * .6 +
        (this.random() * 2 - 1) * LIMITS[i] * strength * 9, 24);
    }
  }

  step(dt: number, orientation: THREE.Quaternion, spin: THREE.Vector3,
    grounded: boolean, recovery: number, kick: number, weight: number): boolean {
    if (!this.live || dt <= 0) return false;
    // Bounded work even after a debugger pause. Gameplay advances at 60 Hz;
    // two cheap spring substeps prevent stiff wrist/knee limits from jittering.
    const elapsed = Math.min(dt, 1 / 15), steps = Math.ceil(elapsed * 120), h = elapsed / steps;
    if (kick > this.kick + .04) this.impact(4 + kick * 5);
    this.kick = kick;
    this.inverse.copy(orientation).invert();
    this.gravity.set(0, -1, 0).applyQuaternion(this.inverse);
    this.acceleration.copy(spin).sub(this.previousSpin).multiplyScalar(1 / Math.max(dt, 1 / 240));
    this.previousSpin.copy(spin);
    const settle = grounded ? 1.8 : 1;
    const recover = 1 - THREE.MathUtils.smoothstep(recovery, 0, .32);
    const amount = Math.max(0, Math.min(2, weight)) * recover;
    for (let step = 0; step < steps; step++) {
      for (let joint = 0; joint < JOINTS; joint++) {
        const parent = PARENTS[joint];
        for (let axis = 0; axis < 3; axis++) {
          const i = joint * 3 + axis, limit = LIMITS[i];
          const gravity = axis === 0 ? this.gravity.z : axis === 2 ? -this.gravity.x : 0;
          const angular = axis === 0 ? spin.x : axis === 1 ? spin.y : spin.z;
          const accel = axis === 0 ? this.acceleration.x : axis === 1 ? this.acceleration.y : this.acceleration.z;
          const chain = parent >= 0 ? this.velocity[parent * 3 + axis] * .7 : 0;
          const target = clamp(this.bias[i] + gravity * limit * .42 - angular * limit * .025, limit);
          const force = this.stiffness[joint] * (target * recover - this.angles[i]) +
            chain - clamp(accel, 60) * limit * .1;
          this.velocity[i] = clamp((this.velocity[i] + force * h) /
            (1 + this.damping[joint] * settle * h), 22);
          this.angles[i] += this.velocity[i] * h;
          if (Math.abs(this.angles[i]) > limit) {
            this.angles[i] = clamp(this.angles[i], limit);
            this.velocity[i] *= -.18;
          }
        }
      }
      this.strainVelocity = (this.strainVelocity - this.strain * 240 * h) / (1 + 10 * h);
      this.strain = clamp(this.strain + this.strainVelocity * h, 1.8);
    }
    for (const [id, part] of ELASTIC_LENGTH_CONTROLS) {
      // Independent lengths multiply editable authored deformation. Distal
      // inertia adds small delayed stretch; impact compression rebounds finitely.
      const joint = part === 0 ? 0 : part <= 2 ? (id.includes('left') ? 2 : 5) + part - 1 :
        (id.includes('left') ? 8 : 11) + part - 3;
      const lag = clamp(Math.abs(this.velocity[joint * 3]) * .035, .45);
      this.deformations[id] = 1 + this.elasticity[part] * (this.strain * 1.7 + lag) * amount;
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
