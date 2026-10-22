import * as THREE from 'three';
import { ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';
import type { PlayerAnimationBridge } from '../animation/bridge';

const JOINTS = 14;
export const BAIL_POSE_CARRY_SECONDS = .2;

/** A lost foothold releases the pose that was actually pushing upright.
 * Keep its joint/segment velocities for a short, finite transition into the
 * live spring rig. The controller and subsequent contacts remain authoritative.
 * History is collected only during recovery; all storage is reused. */
export class BailPoseCarry {
  private readonly pose = new Float64Array(JOINTS * 4);
  private readonly previousPose = new Float64Array(JOINTS * 4);
  private readonly carriedPose = new Float64Array(JOINTS * 4);
  private readonly carriedRate = new Float64Array(JOINTS * 3);
  private readonly baseline = new Float64Array(JOINTS * 4);
  private readonly applied = new Array<THREE.Object3D | null>(JOINTS).fill(null);
  private readonly tracked = new Array<THREE.Object3D | null>(JOINTS).fill(null);
  private readonly carriedNodes = new Array<THREE.Object3D | null>(JOINTS).fill(null);
  private readonly lengths = new Float64Array(ELASTIC_LENGTH_CONTROLS.length);
  private readonly previousLengths = new Float64Array(ELASTIC_LENGTH_CONTROLS.length);
  private readonly carriedLengths = new Float64Array(ELASTIC_LENGTH_CONTROLS.length);
  private readonly carriedLengthRate = new Float64Array(ELASTIC_LENGTH_CONTROLS.length);
  private readonly factors: Record<string, number> = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id]) => [id, 1]));
  private readonly root = new THREE.Quaternion();
  private readonly previousRoot = new THREE.Quaternion();
  private readonly waist = new THREE.Vector3();
  private readonly previousWaist = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly delta = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private samples = 0;
  private sampleSeconds = 1 / 60;
  private age = -1;

  get active(): boolean { return this.age >= 0; }

  reset(): void {
    if (this.samples || this.age >= 0) { this.tracked.fill(null); this.carriedNodes.fill(null); }
    this.samples = 0; this.age = -1;
  }

  /** Undo our writes before the existing pose owners restore their own base. */
  restore(): void {
    for (let i = 0; i < JOINTS; i++) {
      this.applied[i]?.quaternion.fromArray(this.baseline, i * 4);
      this.applied[i] = null;
    }
  }

  private velocity(now: THREE.Quaternion, before: THREE.Quaternion, dt: number, out: THREE.Vector3): void {
    this.delta.copy(before).invert().premultiply(now).normalize();
    if (this.delta.w < 0) this.delta.set(-this.delta.x, -this.delta.y, -this.delta.z, -this.delta.w);
    const s = Math.hypot(this.delta.x, this.delta.y, this.delta.z);
    out.set(this.delta.x, this.delta.y, this.delta.z)
      .multiplyScalar(s > 1e-8 ? 2 * Math.atan2(s, this.delta.w) / (s * dt) : 2 / dt);
  }

  record(joints: readonly (THREE.Object3D | null)[], world: THREE.Matrix4, waist: THREE.Vector3, bridge: PlayerAnimationBridge, dt: number): void {
    if (!(dt > 0)) return;
    for (let i = 0; i < JOINTS; i++) {
      const node = joints[i];
      if (!node) { this.tracked[i] = null; continue; }
      if (this.samples && this.tracked[i] === node)
        for (let c = 0; c < 4; c++) this.previousPose[i * 4 + c] = this.pose[i * 4 + c];
      else node.quaternion.toArray(this.previousPose, i * 4);
      this.tracked[i] = node;
      node.quaternion.toArray(this.pose, i * 4);
    }
    for (let i = 0; i < ELASTIC_LENGTH_CONTROLS.length; i++) {
      const value = bridge.deformationValue(ELASTIC_LENGTH_CONTROLS[i][0]);
      this.previousLengths[i] = this.samples ? this.lengths[i] : value;
      this.lengths[i] = value;
    }
    world.decompose(this.position, this.q, this.scale);
    this.previousRoot.copy(this.samples ? this.root : this.q);
    this.root.copy(this.q);
    this.previousWaist.copy(this.samples ? this.waist : waist);
    this.waist.copy(waist);
    this.sampleSeconds = dt;
    this.samples = Math.min(2, this.samples + 1);
  }

  /** False means there was no measured root velocity yet; keep the old spin. */
  begin(spin: THREE.Vector3, waistVelocity: THREE.Vector3): boolean {
    waistVelocity.set(0, 0, 0);
    if (!this.samples) return false;
    this.carriedPose.set(this.pose);
    // Differentiate only when support actually disappears. Ordinary get-ups
    // only retain two compact samples, with no per-joint trigonometry.
    for (let i = 0; i < JOINTS; i++) {
      this.q.fromArray(this.pose, i * 4); this.delta.fromArray(this.previousPose, i * 4);
      this.velocity(this.q, this.delta, this.sampleSeconds, this.v);
      this.v.toArray(this.carriedRate, i * 3);
    }
    this.carriedLengths.set(this.lengths);
    for (let i = 0; i < this.lengths.length; i++) this.carriedLengthRate[i] = (this.lengths[i] - this.previousLengths[i]) / this.sampleSeconds;
    for (let i = 0; i < JOINTS; i++) this.carriedNodes[i] = this.tracked[i];
    this.age = 0;
    if (this.samples < 2) return false;
    this.velocity(this.root, this.previousRoot, this.sampleSeconds, spin);
    waistVelocity.copy(this.waist).sub(this.previousWaist).multiplyScalar(1 / this.sampleSeconds);
    return true;
  }

  apply(joints: readonly (THREE.Object3D | null)[], bridge: PlayerAnimationBridge, dt: number): void {
    if (this.age < 0) return;
    this.age = Math.min(BAIL_POSE_CARRY_SECONDS, this.age + Math.max(0, dt));
    const u = this.age / BAIL_POSE_CARRY_SECONDS;
    if (u >= 1) { this.age = -1; return; }
    const blend = u * u * (3 - 2 * u);
    // Continue the outgoing local velocity, then ease its extrapolation to
    // rest as the continuously simulated tumble takes the weight.
    const travel = this.age * (1 - u + u * u / 3);
    for (let i = 0; i < JOINTS; i++) {
      const node = joints[i];
      if (!node || node !== this.carriedNodes[i]) continue;
      node.quaternion.toArray(this.baseline, i * 4); this.applied[i] = node;
      this.v.fromArray(this.carriedRate, i * 3);
      const speed = this.v.length(), half = speed * travel * .5;
      const factor = speed > 1e-8 ? Math.sin(half) / speed : travel * .5;
      this.q.set(this.v.x * factor, this.v.y * factor, this.v.z * factor, Math.cos(half));
      this.delta.fromArray(this.carriedPose, i * 4);
      this.q.multiply(this.delta).slerp(node.quaternion, blend);
      node.quaternion.copy(this.q);
    }
    for (let i = 0; i < ELASTIC_LENGTH_CONTROLS.length; i++) {
      const id = ELASTIC_LENGTH_CONTROLS[i][0], target = bridge.deformationValue(id);
      const carried = this.carriedLengths[i] + THREE.MathUtils.clamp(this.carriedLengthRate[i] * travel, -.15, .15);
      this.factors[id] = target > 1e-6 ? THREE.MathUtils.lerp(carried, target, blend) / target : 1;
    }
    bridge.modulateDeformations(this.factors);
  }
}
