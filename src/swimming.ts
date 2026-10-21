import * as THREE from 'three';

export const SWIMMING = Object.freeze({
  speed: 4.2, fastSpeed: 6.2, acceleration: 5, digitalAcceleration: 1.8, drag: 4,
  enterDepth: 1.4, exitDepth: 1.04, floatResponse: 7,
  idleImmersion: 1.65, strokeImmersion: 1.53,
});

// Old recordings keep their original X-to-swim-faster controls.
let legacyReplay = false;
export function setLegacySwimmingReplay(value: boolean): void { legacyReplay = value; }
export function legacySwimmingReplay(): boolean { return legacyReplay; }

/** Stick magnitude sets pace; digital input reaches full pace more gradually.
 * Exact exponential response makes held-direction ramp-up independent of FPS. */
export function stepSwimVelocity(velocity: THREE.Vector3, forward: Readonly<THREE.Vector3>,
  x: number, y: number, analog: boolean, dt: number, legacyFast = false): void {
  const length = Math.hypot(x, y);
  const topSpeed = legacyReplay && !legacyFast ? SWIMMING.speed : SWIMMING.fastSpeed;
  const scale = topSpeed / Math.max(1, length);
  const tx = (forward.x * y - forward.z * x) * scale;
  const tz = (forward.z * y + forward.x * x) * scale;
  const previousSpeed = Math.hypot(velocity.x, velocity.z);
  const k = 1 - Math.exp(-(length > .05 ? SWIMMING.acceleration : SWIMMING.drag) * dt);
  velocity.x += (tx - velocity.x) * k;
  velocity.z += (tz - velocity.z) * k;
  velocity.y = 0;
  // Slow only the digital build-up, keeping the existing response when
  // steering or stopping. Releasing/reversing cannot inherit a held boost.
  const targetSpeed = Math.hypot(tx, tz);
  if (!analog && !legacyReplay && targetSpeed > previousSpeed) {
    const cap = previousSpeed + (targetSpeed - previousSpeed) *
      (1 - Math.exp(-SWIMMING.digitalAcceleration * dt));
    velocity.clampLength(0, cap);
  }
}

/** Critically damped surface buoyancy, stable through an airborne water entry. */
export function stepSwimBuoyancy(y: number, velocity: number, surface: number,
  immersion: number, dt: number): { y: number; velocity: number } {
  const target = surface - immersion, offset = y - target;
  const omega = SWIMMING.floatResponse, decay = Math.exp(-omega * dt);
  const impulse = velocity + omega * offset;
  return { y: target + (offset + impulse * dt) * decay,
    velocity: (velocity - omega * impulse * dt) * decay };
}
