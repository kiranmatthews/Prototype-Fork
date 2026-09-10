import * as THREE from 'three';

export const SWIMMING = Object.freeze({
  speed: 4.2, fastSpeed: 6.2, acceleration: 5, drag: 4,
  enterDepth: 1.4, exitDepth: 1.04, floatResponse: 7,
  idleImmersion: 1.65, strokeImmersion: 1.53,
});

/** Exact exponential velocity response; diagonal input cannot add speed. */
export function stepSwimVelocity(velocity: THREE.Vector3, forward: Readonly<THREE.Vector3>,
  x: number, y: number, fast: boolean, dt: number): void {
  const length = Math.hypot(x, y), scale = (fast ? SWIMMING.fastSpeed : SWIMMING.speed) / Math.max(1, length);
  const tx = (forward.x * y - forward.z * x) * scale;
  const tz = (forward.z * y + forward.x * x) * scale;
  const k = 1 - Math.exp(-(length > .05 ? SWIMMING.acceleration : SWIMMING.drag) * dt);
  velocity.x += (tx - velocity.x) * k;
  velocity.z += (tz - velocity.z) * k;
  velocity.y = 0;
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
