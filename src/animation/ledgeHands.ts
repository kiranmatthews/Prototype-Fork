import * as THREE from 'three';

type Hand = 'left' | 'right';

/** One hand reaches at a time. Planted contacts do not rewind when the stick
 * reverses, and a released stick lets the current reach finish and settle. */
export class LedgeHandMotion {
  readonly left = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly previousCentre = new THREE.Vector3();
  private active: Hand | null = null;
  private elapsed = 0;
  private ready = false;
  private next: Hand = 'left';
  private lastDirection = 0;
  private settlePasses = 0;
  readonly duration = .12;
  readonly spread = .30;

  get reaching(): boolean { return this.active !== null; }

  reset(): void {
    this.ready = false;
    this.active = null;
    this.lastDirection = 0;
    this.settlePasses = 0;
  }

  carry(delta: THREE.Vector3): void {
    for (const point of [this.left, this.right, this.from, this.to, this.previousCentre]) point.add(delta);
  }

  update(dt: number, centre: THREE.Vector3, side: THREE.Vector3, moving: boolean,
    project: (point: THREE.Vector3) => void): void {
    if (!this.ready) {
      this.left.copy(centre).addScaledVector(side, this.spread);
      this.right.copy(centre).addScaledVector(side, -this.spread);
      project(this.left);
      project(this.right);
      this.previousCentre.copy(centre);
      this.ready = true;
      return;
    }
    const velocity = centre.clone().sub(this.previousCentre).multiplyScalar(1 / Math.max(dt, 1e-6));
    this.previousCentre.copy(centre);
    const speed = velocity.dot(side);
    const direction = moving && Math.abs(speed) > .05 ? Math.sign(speed) : 0;
    // Refitting a corner changes the capsule's clearance in a single frame.
    // Predict only traversal along the lip, never that outward correction.
    velocity.copy(side).multiplyScalar(THREE.MathUtils.clamp(speed, -2.4, 2.4));
    if (direction) this.settlePasses = 2;
    if (direction && direction !== this.lastDirection) {
      this.next = direction > 0 ? 'left' : 'right';
      if (this.active) {
        // Redirect the lifted hand from its current position. Completing a
        // reach into the old direction would overextend it after a reversal.
        this.from.copy(this[this.active]);
        this.to.copy(centre).addScaledVector(side, this.active === 'left' ? this.spread : -this.spread)
          .addScaledVector(velocity, this.duration);
        project(this.to);
        this.elapsed = 0;
      }
    }
    if (direction) this.lastDirection = direction;
    if (this.active) {
      this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
      const phase = this.elapsed / this.duration;
      const smooth = phase * phase * (3 - 2 * phase);
      this[this.active].lerpVectors(this.from, this.to, smooth);
      this[this.active].y += Math.sin(phase * Math.PI) * .07;
      if (phase >= 1) {
        this.next = this.active === 'left' ? 'right' : 'left';
        this.active = null;
      }
      return;
    }
    if (!direction && this.settlePasses <= 0) return;
    const desired = (hand: Hand) => {
      const point = centre.clone().addScaledVector(side, hand === 'left' ? this.spread : -this.spread);
      if (direction) point.addScaledVector(velocity, this.duration);
      project(point);
      return point;
    };
    const candidate = this.next;
    const target = desired(candidate);
    // At rest finish any displaced grip once, rather than oscillating around
    // an endless distance-quantised phase. A stationary support has zero speed.
    const other = candidate === 'left' ? 'right' : 'left';
    const chosen = this[candidate].distanceTo(target) > .075 ? candidate
      : this[other].distanceTo(desired(other)) > .075 ? other : null;
    if (!chosen) {
      this.settlePasses = 0;
      return;
    }
    if (!direction) this.settlePasses--;
    this.active = chosen;
    this.from.copy(this[chosen]);
    this.to.copy(chosen === candidate ? target : desired(chosen));
    this.elapsed = 0;
  }
}
