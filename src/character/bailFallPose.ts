import { Quaternion, Vector3, MathUtils, type Object3D } from 'three';
import { QUATERNIUS_DEATH_DURATION, QUATERNIUS_DEATH_ROTATION_KEYS } from '../animation/quaterniusDeath.generated';

// Match the existing impact-joint order, followed by the articulated chest
// and neck. Root translation and pelvis rotation remain physics-owned.
const channels = ['spine', 'head', 'shoulderRight', 'elbowRight', 'wristRight',
  'shoulderLeft', 'elbowLeft', 'wristLeft', 'hipRight', 'kneeRight', 'ankleRight',
  'hipLeft', 'kneeLeft', 'ankleLeft', 'chest', 'neck'] as const;
const reflected = [0, 1, 5, 6, 7, 2, 3, 4, 11, 12, 13, 8, 9, 10, 14, 15];
const tracks = channels.map(id => QUATERNIUS_DEATH_ROTATION_KEYS[id]);
const collapseAngles = Float64Array.from(QUATERNIUS_DEATH_ROTATION_KEYS.hips, ([, q]) =>
  Math.max(0, -Math.atan2(2 * (q[1] * q[2] + q[3] * q[0]), 1 - 2 * (q[0] * q[0] + q[2] * q[2])) - .1));
const smooth = (t: number) => { const u = MathUtils.clamp(t, 0, 1); return u * u * u * (10 + u * (-15 + 6 * u)); };

/** Contact death supplies a coordinated collapse, not independent flailing.
 * Reuse its actual CC0 joint samples: folded knees, curved spine, reaching
 * arms and delayed head. The live ragdoll still owns direction and travel.
 * Mirroring and a small clock variation retain different silhouettes. */
export class BailFallPose {
  weight = 0;
  time = 0;
  private rate = 2.4;
  private mirror = false;
  private readonly q = new Quaternion();
  private readonly next = new Quaternion();
  private readonly entry = new Quaternion();
  private readonly target = new Quaternion();
  private readonly axis = new Vector3();
  private readonly direction = new Vector3();
  private readonly up = new Vector3();
  private collapse = false;
  private remaining = 0;
  private readonly applied = new Array<Object3D | null>(channels.length).fill(null);
  private readonly baseline = new Float64Array(channels.length * 4);

  begin(seed: number, side: number, orientation?: Quaternion, spin?: Vector3, normal?: Vector3): void {
    this.time = this.weight = 0;
    this.rate = 2.4 + .2 * Math.sin(seed);
    this.mirror = side < 0;
    this.collapse = !!(orientation && spin && normal);
    if (orientation && spin && normal) {
      this.entry.copy(orientation);
      this.axis.copy(spin).projectOnPlane(normal).normalize();
      this.direction.crossVectors(this.axis, normal);
      this.up.set(0, 1, 0).applyQuaternion(orientation);
      const initial = Math.atan2(this.up.dot(this.direction), this.up.dot(normal));
      this.remaining = MathUtils.clamp(Math.PI / 2 - initial, .3, 2.2);
    }
  }

  readyForRecovery(age: number): boolean { return age * this.rate >= 1.7; }

  /** A lost balance first gives at the knees, then tips. Guide that supported
   * fall with the source pelvis timing while retaining the actual fall axis,
   * contact spin and travel. Flight and later rolls have no authored torque. */
  steerSupported(spin: Vector3, orientation: Quaternion, age: number, dt: number): void {
    if (!this.collapse) return;
    const time = age * this.rate, weight = smooth(age / .08) * (1 - smooth((time - 1.2) / .5));
    if (weight <= 0) return;
    const frame = Math.min(71.999, time / QUATERNIUS_DEATH_DURATION * 72), a = Math.floor(frame), mix = frame - a;
    const scale = this.remaining / collapseAngles[72];
    const angle = (collapseAngles[a] + (collapseAngles[a + 1] - collapseAngles[a]) * mix) * scale;
    const rate = (collapseAngles[a + 1] - collapseAngles[a]) * 72 / QUATERNIUS_DEATH_DURATION * this.rate * scale;
    this.target.setFromAxisAngle(this.axis, angle).multiply(this.entry);
    this.next.copy(orientation).invert(); this.target.multiply(this.next).normalize();
    if (this.target.w < 0) this.target.set(-this.target.x, -this.target.y, -this.target.z, -this.target.w);
    const sine = Math.hypot(this.target.x, this.target.y, this.target.z);
    const error = (this.target.x * this.axis.x + this.target.y * this.axis.y + this.target.z * this.axis.z) *
      (sine > 1e-8 ? 2 * Math.atan2(sine, this.target.w) / sine : 2);
    spin.addScaledVector(this.axis, (100 * error + 18 * (rate - spin.dot(this.axis))) * dt * weight);
  }

  restore(): void {
    for (let i = 0; i < channels.length; i++) {
      this.applied[i]?.quaternion.fromArray(this.baseline, i * 4);
      this.applied[i] = null;
    }
  }

  apply(joints: readonly (Object3D | null)[], age: number, recoveryPhase: number): void {
    // Continue the outgoing authored velocity while the get-up takes over;
    // freezing this clock at entry would abruptly stop the head/shoulders.
    this.time = Math.min(QUATERNIUS_DEATH_DURATION, age * this.rate);
    this.weight = smooth(age / .12) * (1 - smooth(Math.max(0, recoveryPhase) / .6));
    // Native source keys share one 30-Hz clock; one index serves every joint.
    const frame = this.time / QUATERNIUS_DEATH_DURATION * 72;
    const a = Math.min(71, Math.floor(frame)), mix = frame - a;
    for (let i = 0; i < channels.length; i++) {
      const node = joints[i];
      if (!node) continue;
      this.applied[i] = node; node.quaternion.toArray(this.baseline, i * 4);
      // The get-up adds chest/neck curl after this layer, even after source
      // weight reaches zero. Keep restoring their base until the bail ends.
      if (this.weight <= 0) continue;
      const keys = tracks[this.mirror ? reflected[i] : i];
      this.q.fromArray(keys[a][1]); this.next.fromArray(keys[a + 1][1]);
      this.q.slerp(this.next, mix).normalize();
      if (this.mirror) { this.q.y = -this.q.y; this.q.z = -this.q.z; }
      node.quaternion.slerp(this.q, this.weight);
    }
  }
}
