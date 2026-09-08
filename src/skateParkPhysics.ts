import * as THREE from 'three';

// Calibration from THUG's original skater_physics and stat-5 parameters,
// converted from inches to metres. This is our own integration of the rules,
// not an imported game implementation. See docs/THUG_SKATING_REFERENCE.md.
const INCH = 0.0254;
export const SKATE_PARK = Object.freeze({
  groundGravity: 1000 * INCH,
  airGravity: 1350 * INCH,
  vertGravity: 1350 * INCH / 1.1,
  standingSpeed: 445 * INCH,
  crouchingSpeed: 603.5 * INCH,
  standingAcceleration: 664.5 * INCH,
  crouchingAcceleration: 1128.5 * INCH,
  softSpeedLimit: 828.5 * INCH,
  hardSpeedLimit: 1028.5 * INCH,
  standingDrag: 0.00001 / INCH,
  crouchingDrag: 0.000002 / INCH,
  heavyDrag: 0.0001 / INCH,
  brake: 900 * INCH,
  turnRate: 1.8,
  sharpTurnRate: 3.6,
  slowSlopeSpeed: 300 * INCH,
  slowSlopeTurnRate: 3,
  ollieMin: 350 * INCH,
  ollieMax: 432 * INCH,
  vertPopMin: 100 * INCH,
  vertPopMax: 275 * INCH,
  chargeSeconds: 0.2,
  vertClearance: 3 * INCH,
  trackReach: 30 * INCH,
  trackUp: 6 * INCH,
  trackDownStep: 3 * INCH,
  autoTurnRate: 3,
  autoTurnMinimum: 5 * Math.PI / 180,
  spinRate: 7.3,
  spinDelay: 0.1,
  autoTurnCancelTime: 0.3,
  breakWindow: 0.2,
  breakProbeLength: 24 * INCH,
  breakOutScale: 0.75,
  breakUpScale: 0.75,
});

/** Rotate a flat board frame onto its support plane, without foreshortening
 * the approach angle as the wall steepens. In particular, a 90-degree wall
 * still has a well-defined uphill tangent. */
export function skateSurfaceDirection(out: THREE.Vector3, heading: Readonly<THREE.Vector3>, normal: Readonly<THREE.Vector3>): THREE.Vector3 {
  const slope = Math.hypot(normal.x, normal.z);
  if (slope < 1e-7) return out.set(heading.x, 0, heading.z).normalize();
  const nx = normal.x / slope, nz = normal.z / slope;
  const down = heading.x * nx + heading.z * nz;
  return out.set(heading.x + nx * (normal.y - 1) * down,
    -slope * down, heading.z + nz * (normal.y - 1) * down).normalize();
}

/** The inverse frame transform, used after a new surface contact or landing. */
export function skateSurfaceHeading(out: THREE.Vector3, velocity: Readonly<THREE.Vector3>, normal: Readonly<THREE.Vector3>): THREE.Vector3 {
  const slope = Math.hypot(normal.x, normal.z);
  if (slope < 1e-7) return out.set(velocity.x, 0, velocity.z).normalize();
  const nx = normal.x / slope, nz = normal.z / slope;
  const along = velocity.x * nx + velocity.z * nz;
  const shift = (normal.y - 1) * along - slope * velocity.y;
  return out.set(velocity.x + nx * shift, 0, velocity.z + nz * shift).normalize();
}

/** Redirect a moving vector onto a new plane while preserving its speed.
 * Landing uses ordinary projection instead, so impact energy is not minted. */
export function redirectSkateVelocity(velocity: THREE.Vector3, normal: Readonly<THREE.Vector3>, fallback: Readonly<THREE.Vector3>): THREE.Vector3 {
  const speed = velocity.length();
  velocity.addScaledVector(normal, -velocity.dot(normal));
  if (velocity.lengthSq() < 1e-10) velocity.copy(fallback).addScaledVector(normal, -fallback.dot(normal));
  return velocity.lengthSq() < 1e-10 ? velocity.set(0, 0, 0) : velocity.normalize().multiplyScalar(speed);
}

export function frameBlend(perSixtieth: number, dt: number): number {
  return 1 - Math.pow(1 - perSixtieth, Math.max(0, dt) * 60);
}
