import * as THREE from 'three';

/** Hard knocks get a short supported, laid-out beat. Mild falls keep their
 * quick roll-through. This is bounded angular settling, not a frozen pose;
 * airborne bounces and travel remain under the ordinary contact controller. */
export class BailKnockdown {
  strength = 0;
  supportTime = 0;
  restTime = 0;
  private face = 0;
  private readonly facing = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();

  reset(): void { this.strength = this.supportTime = this.restTime = this.face = 0; }

  impact(speed: number, wall: boolean): void {
    const strength = THREE.MathUtils.smoothstep(speed, wall ? 30 : 32, wall ? 42 : 50);
    if (strength <= 0) return;
    this.strength = Math.max(this.strength, strength);
    this.supportTime = this.restTime = this.face = 0;
  }

  get ready(): boolean {
    return this.strength === 0 || this.restTime >= .28 + .2 * this.strength || this.supportTime >= 1.6;
  }

  get restingFace(): number { return this.face; }

  poseWeight(recoveryPhase: number): number {
    return THREE.MathUtils.smoothstep(this.supportTime, .08, .38) *
      (1 - THREE.MathUtils.smoothstep(recoveryPhase, 0, .4));
  }

  step(dt: number, supported: boolean, orientation: THREE.Quaternion, spin: THREE.Vector3, normal: THREE.Vector3): void {
    if (this.strength === 0) return;
    if (!supported) { this.supportTime = this.restTime = this.face = 0; return; }
    this.supportTime += dt;
    this.facing.set(0, 0, 1).applyQuaternion(orientation);
    // Settle onto the nearby broad surface. A backward slam can rest on its
    // back; a belly-first impact need not turn over against its momentum.
    if (!this.face) this.face = this.facing.dot(normal) < -.2 ? -1 : 1;
    const flat = this.facing.dot(normal) * this.face > .96;
    this.restTime = flat && spin.lengthSq() < 1.4 ? this.restTime + dt : 0;
  }

  settleSpin(spin: THREE.Vector3, orientation: THREE.Quaternion, normal: THREE.Vector3, dt: number): void {
    if (!this.strength || !this.face || this.supportTime <= 0) return;
    this.facing.set(0, 0, this.face).applyQuaternion(orientation);
    // The oversized head rests a little above the hips/heels. A perfectly
    // horizontal root balances the entire stiff body on the back of its head.
    this.axis.set(0, 1, 0).applyQuaternion(orientation).projectOnPlane(normal).normalize()
      .multiplyScalar(-Math.sin(.22)).addScaledVector(normal, Math.cos(.22));
    const cosine = THREE.MathUtils.clamp(this.facing.dot(this.axis), -1, 1);
    this.axis.crossVectors(this.facing, this.axis);
    const sine = this.axis.length();
    if (sine > 1e-8) this.axis.multiplyScalar(Math.atan2(sine, cosine) / sine);
    // Dampen the final supported rock. Keep the physical spin and
    // its direction on entry; no quaternion snap or new random impulse.
    spin.addScaledVector(this.axis, 128 * dt).multiplyScalar(Math.exp(-18 * dt));
  }
}
