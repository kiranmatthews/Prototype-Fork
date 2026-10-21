import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Continue the landed orientation into a finite, momentum-carrying get-up.
 * A twist owns the remaining forward roll; the orthogonal swing unwinds
 * continuously. No per-frame choice of quaternion hemisphere can flip it. */
export class BailRecoveryMotion {
  private pitch = 0;
  private destination = 0;
  private pitchLinear = 0;
  private pitchQuadratic = 0;
  private pitchCubic = 0;
  private readonly swing = new THREE.Vector3();
  private readonly swingRate = new THREE.Vector3();
  private readonly swingQuadratic = new THREE.Vector3();
  private readonly swingCubic = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly offset = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly cross = new THREE.Vector3();

  begin(orientation: THREE.Quaternion, spin: THREE.Vector3, duration: number): void {
    duration = Math.max(.05, duration);
    const norm = Math.hypot(orientation.x, orientation.w);
    this.pitch = norm > 1e-8 ? ((2 * Math.atan2(orientation.x, orientation.w)) % TAU + TAU) % TAU : Math.PI;
    // An almost upright rider can step out; other landings finish only the
    // remaining revolution instead of replaying a full fixed somersault.
    this.destination = this.pitch < .55 ? 0 : TAU;
    const pitchRate = THREE.MathUtils.clamp(spin.x, -16, 16);
    const travel = this.destination - this.pitch;
    this.pitchLinear = pitchRate * duration * .72;
    this.pitchQuadratic = 3 * travel - 2 * this.pitchLinear;
    this.pitchCubic = this.pitchLinear - 2 * travel;
    this.rotation.setFromAxisAngle(this.axis.set(1, 0, 0), -this.pitch);
    this.offset.copy(this.rotation).multiply(orientation).normalize();
    if (this.offset.w < 0) this.offset.set(-this.offset.x, -this.offset.y, -this.offset.z, -this.offset.w);
    const sinHalf = Math.hypot(this.offset.x, this.offset.y, this.offset.z);
    const angle = 2 * Math.atan2(sinHalf, this.offset.w);
    this.swing.set(this.offset.x, this.offset.y, this.offset.z).multiplyScalar(sinHalf > 1e-8 ? angle / sinHalf : 2);
    // Initial angular velocity in the swing frame, then the inverse SO(3)
    // left Jacobian converts it into a rotation-vector derivative.
    this.swingRate.copy(spin).addScaledVector(this.axis, -pitchRate).applyQuaternion(this.rotation);
    this.cross.crossVectors(this.swing, this.swingRate);
    this.axis.crossVectors(this.swing, this.cross);
    const coefficient = angle > 1e-5 ? (1 - angle * .5 * this.offset.w / sinHalf) / (angle * angle) : 1 / 12;
    this.swingRate.addScaledVector(this.cross, -.5).addScaledVector(this.axis, coefficient);
    this.swingRate.multiplyScalar(duration * .6);
    this.swingQuadratic.copy(this.swing).multiplyScalar(-3).addScaledVector(this.swingRate, -2);
    this.swingCubic.copy(this.swing).multiplyScalar(2).add(this.swingRate);
  }

  sample(phase: number, out: THREE.Quaternion): void {
    if (phase >= .72) { out.set(0, 0, 0, this.destination ? -1 : 1); return; }
    const roll = clamp01(phase / .72), swing = clamp01(phase / .6);
    // Cache the Hermite coefficients once per incident. Horner evaluation and
    // a direct quaternion product avoid temporary transforms on every frame.
    const halfPitch = (this.pitch + roll * (this.pitchLinear + roll * (this.pitchQuadratic + roll * this.pitchCubic))) * .5;
    const sp = Math.sin(halfPitch), cp = Math.cos(halfPitch);
    if (phase >= .6) { out.set(sp, 0, 0, cp); return; }
    const x = this.swing.x + swing * (this.swingRate.x + swing * (this.swingQuadratic.x + swing * this.swingCubic.x));
    const y = this.swing.y + swing * (this.swingRate.y + swing * (this.swingQuadratic.y + swing * this.swingCubic.y));
    const z = this.swing.z + swing * (this.swingRate.z + swing * (this.swingQuadratic.z + swing * this.swingCubic.z));
    const length = Math.sqrt(x*x + y*y + z*z), scale = length > 1e-8 ? Math.sin(length * .5) / length : .5;
    const c = Math.cos(length * .5);
    out.set(sp*c + cp*x*scale, (cp*y - sp*z)*scale, (cp*z + sp*y)*scale, cp*c - sp*x*scale).normalize();
  }
}
