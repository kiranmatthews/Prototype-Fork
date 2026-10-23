import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Continue the landed orientation into a finite, momentum-carrying get-up.
 * A twist around the incoming ground-plane tumble owns the remaining roll;
 * sideways and diagonal spills can roll through a shoulder. The residual swing unwinds
 * continuously. No per-frame choice of quaternion hemisphere can flip it. */
export class BailRecoveryMotion {
  private pitch = 0;
  private destination = 0;
  private pitchLinear = 0;
  private pitchQuadratic = 0;
  private pitchCubic = 0;
  private rollWindow = .9;
  private pushAngle = 0;
  private pushTravel = 0;
  private axisX = 1;
  private axisZ = 0;
  private readonly swing = new THREE.Vector3();
  private readonly swingRate = new THREE.Vector3();
  private readonly swingQuadratic = new THREE.Vector3();
  private readonly swingCubic = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly offset = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly cross = new THREE.Vector3();

  get sideRoll(): number { return this.axisZ; }

  begin(orientation: THREE.Quaternion, spin: THREE.Vector3, duration: number, momentum?: THREE.Vector3): void {
    duration = Math.max(.05, duration);
    const tumbleRate = Math.hypot(spin.x, spin.z);
    const rememberedRate = momentum ? Math.hypot(momentum.x, momentum.z) : 0;
    const remember = tumbleRate < .8 && rememberedRate >= .8;
    const direction = remember ? momentum! : spin;
    const directionRate = remember ? rememberedRate : tumbleRate;
    const leanAxis = Math.hypot(orientation.x, orientation.z);
    // Yaw is a facing correction, not a ground roll. Without a clear recent
    // tumble, the laid-out pose supplies the shortest supported get-up axis.
    this.axisX = directionRate > .15 ? direction.x / directionRate : leanAxis > 1e-8 ? orientation.x / leanAxis : 1;
    this.axisZ = directionRate > .15 ? direction.z / directionRate : leanAxis > 1e-8 ? orientation.z / leanAxis : 0;
    const projection = orientation.x * this.axisX + orientation.z * this.axisZ;
    const norm = Math.hypot(projection, orientation.w);
    this.pitch = norm > 1e-8 ? ((2 * Math.atan2(projection, orientation.w)) % TAU + TAU) % TAU : Math.PI;
    const pitchRate = THREE.MathUtils.clamp(spin.x * this.axisX + spin.z * this.axisZ, -16, 16);
    this.pitchLinear = pitchRate * duration * .9;
    // A supported, already-fallen body can push through the remaining roll
    // even after friction has slowed it. Choosing only the closest upright
    // winding made shoulder/forward rolls brake, then play the fall backwards.
    // Near-upright or genuinely still landings retain their short get-up.
    this.destination = Math.round((this.pitch + this.pitchLinear * .5) / TAU) * TAU;
    const laidOver = 2 * (orientation.x * orientation.x + orientation.z * orientation.z) > .35 * orientation.lengthSq();
    if ((remember || pitchRate > .15) && laidOver && TAU - this.pitch < 5.2)
      this.destination = Math.max(TAU, this.destination);
    const travel = this.destination - this.pitch;
    // Long rolls gather over the shoulder, then push off into upright. Ease
    // through the change from upper-body contact to feet instead of driving
    // the fastest part of one cubic straight through that contact switch.
    this.pushTravel = travel > Math.PI ? 1.6 : 0;
    this.rollWindow = this.pushTravel ? .55 : .9;
    this.pushAngle = this.destination - this.pushTravel;
    this.pitchLinear = pitchRate * duration * this.rollWindow;
    const rollTravel = travel - this.pushTravel;
    this.pitchQuadratic = 3 * rollTravel - 2 * this.pitchLinear;
    this.pitchCubic = this.pitchLinear - 2 * rollTravel;
    this.rotation.setFromAxisAngle(this.axis.set(this.axisX, 0, this.axisZ), -this.pitch);
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
    this.swingRate.multiplyScalar(duration * .82);
    this.swingQuadratic.copy(this.swing).multiplyScalar(-3).addScaledVector(this.swingRate, -2);
    this.swingCubic.copy(this.swing).multiplyScalar(2).add(this.swingRate);
  }

  sample(phase: number, out: THREE.Quaternion): void {
    if (phase >= .9) { out.set(0, 0, 0, Math.cos(this.destination * .5)); return; }
    const roll = clamp01(phase / this.rollWindow), swing = clamp01(phase / .82);
    // Cache the Hermite coefficients once per incident. Horner evaluation and
    // a direct quaternion product avoid temporary transforms on every frame.
    const push = this.pushTravel ? clamp01((phase - this.rollWindow) / (.9 - this.rollWindow)) : 0;
    const halfPitch = (phase >= this.rollWindow ? this.pushAngle + this.pushTravel * push * push * (3 - 2 * push)
      : this.pitch + roll * (this.pitchLinear + roll * (this.pitchQuadratic + roll * this.pitchCubic))) * .5;
    const sp = Math.sin(halfPitch), cp = Math.cos(halfPitch);
    if (phase >= .82) { out.set(this.axisX * sp, 0, this.axisZ * sp, cp); return; }
    const x = this.swing.x + swing * (this.swingRate.x + swing * (this.swingQuadratic.x + swing * this.swingCubic.x));
    const y = this.swing.y + swing * (this.swingRate.y + swing * (this.swingQuadratic.y + swing * this.swingCubic.y));
    const z = this.swing.z + swing * (this.swingRate.z + swing * (this.swingQuadratic.z + swing * this.swingCubic.z));
    const length = Math.sqrt(x*x + y*y + z*z), scale = length > 1e-8 ? Math.sin(length * .5) / length : .5;
    const c = Math.cos(length * .5);
    const ax = this.axisX * sp, az = this.axisZ * sp;
    out.set(ax*c + (cp*x - az*y)*scale, (cp*y + az*x - ax*z)*scale,
      az*c + (cp*z + ax*y)*scale, cp*c - (ax*x + az*z)*scale).normalize();
  }
}
