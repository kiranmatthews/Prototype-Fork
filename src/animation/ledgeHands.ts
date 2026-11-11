import * as THREE from 'three';

type Hand = 'left' | 'right';

/** One hand reaches at a time. Planted contacts do not rewind when the stick
 * reverses, and a released stick lets the current reach finish and settle.
 *
 * The hands keep time with the ground, not the clock. Each one reaches once
 * for every `stride` of lip he covers, wherever the stick is: the leading
 * hand, the other after it, and a beat hanging from both. A reach lands ahead
 * of where the hand rests by what he will cover while it is planted, so the
 * two are as far in front of his shoulders as behind them over a stride. The
 * controller moves him at `traverseSpeed`, which is that stride twice a
 * second. */
export class LedgeHandMotion {
  readonly left = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly previousCentre = new THREE.Vector3();
  private active: Hand | null = null;
  private elapsed = 0;
  private span = 0;
  private ready = false;
  private next: Hand = 'left';
  private lastDirection = 0;
  private settlePasses = 0;
  private fresh = false;
  /** Seconds a whole reach takes, and the least a short one does. */
  readonly duration = .2;
  readonly shortest = .11;
  /** Metres either hand rests from his middle. */
  readonly spread = .32;
  /** Metres of lip to each hand's reach. */
  readonly stride = .5;
  /** Metres a second along the lip with the stick right over. */
  readonly traverseSpeed = 1;
  /** Metres a reaching hand comes up off the lip. */
  readonly lift = .08;

  get reaching(): boolean { return this.active !== null; }

  reset(): void {
    this.ready = false;
    this.active = null;
    this.lastDirection = 0;
    this.settlePasses = 0;
    this.fresh = false;
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
    const pace = THREE.MathUtils.clamp(speed, -this.traverseSpeed, this.traverseSpeed);
    velocity.copy(side).multiplyScalar(pace);
    // A hand rests on its own side of him, and is planted from `reach` ahead
    // of there to `reach` behind: so it lands ahead by that, and by what he
    // covers while it is on its way.
    const reach = Math.max(.08, (this.stride - Math.abs(pace) * this.duration) / 2);
    const rest = (hand: Hand) => centre.clone().addScaledVector(side, hand === 'left' ? this.spread : -this.spread);
    const desired = (hand: Hand) => {
      const point = rest(hand);
      if (direction) point.addScaledVector(velocity, this.duration).addScaledVector(side, direction * reach);
      project(point);
      return point;
    };
    const start = (hand: Hand, target: THREE.Vector3) => {
      this.active = hand;
      this.from.copy(this[hand]);
      this.to.copy(target);
      this.elapsed = 0;
      // A short reach, to settle or after a turn, does not take a whole one's time.
      this.span = THREE.MathUtils.clamp(this.duration * this.from.distanceTo(target) / this.stride, this.shortest, this.duration);
    };
    if (direction) this.settlePasses = 2;
    if (direction && direction !== this.lastDirection) {
      this.next = direction > 0 ? 'left' : 'right';
      this.fresh = true;
      // Redirect the lifted hand from its current position. Completing a
      // reach into the old direction would overextend it after a reversal.
      if (this.active) start(this.active, desired(this.active));
    }
    if (direction) this.lastDirection = direction;
    if (this.active) {
      this.elapsed = Math.min(this.span, this.elapsed + Math.max(0, dt));
      const phase = this.elapsed / this.span;
      const smooth = phase * phase * (3 - 2 * phase);
      this[this.active].lerpVectors(this.from, this.to, smooth);
      this[this.active].y += Math.sin(phase * Math.PI) * this.lift * Math.min(1, this.from.distanceTo(this.to) / (this.stride * .5));
      if (phase >= 1) {
        this.next = this.active === 'left' ? 'right' : 'left';
        this.active = null;
      }
      return;
    }
    if (!direction && this.settlePasses <= 0) return;
    // On the move a hand goes when it has fallen `reach` behind where it
    // rests, or when a corner has taken him further from it than that any
    // way at all; the leading hand of a new direction goes at once. At rest
    // finish any displaced grip once, rather than oscillating around an
    // endless distance-quantised phase. A stationary support has zero speed.
    const candidate = this.next, other = candidate === 'left' ? 'right' : 'left';
    const due = (hand: Hand): THREE.Vector3 | null => {
      if (direction && !this.fresh) {
        const away = rest(hand).sub(this[hand]);
        if (away.dot(side) * direction < reach - .005 && away.length() <= reach + .08) return null;
      }
      // (A reach that a seam or a corner has cut down to nothing is not made.)
      const target = desired(hand);
      return this[hand].distanceTo(target) > (direction && !this.fresh ? .03 : .075) ? target : null;
    };
    let chosen: Hand = candidate, target = due(candidate);
    if (!target) { chosen = other; target = due(other); }
    if (!target) {
      if (!direction) this.settlePasses = 0;
      return;
    }
    if (!direction) this.settlePasses--;
    this.fresh = false;
    start(chosen, target);
  }
}
