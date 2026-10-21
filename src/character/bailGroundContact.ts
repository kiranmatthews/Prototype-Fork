import type { Vector3 } from 'three';

/** Presentation-only rolling contact. The authored controller owns travel and
 * its friction; cosmetic tumble randomness must never feed gameplay velocity.
 * Friction opposes v + omega x r at the actual posed contact, so a hand, hip or
 * shoulder can redirect an existing roll instead of snapping to a roll clip.
 * All inputs are world-space; normal is unit length and contact is waist-relative. */
export function stepBailGroundSpin(spin: Vector3, travel: Vector3,
  normal: Vector3, contact: Vector3, dt: number, friction: number, strength: number): void {
  const elapsed = Math.min(Math.max(0, dt), 1 / 15);
  if (elapsed === 0) return;
  const steps = Math.ceil(elapsed * 120), h = elapsed / steps;
  const inverseInertia = 2.4 * Math.max(0, Math.min(3, strength));
  const maxImpulse = Math.max(0, friction) * h;
  const drag = Math.exp(-1.8 * h), twistFade = 1 - Math.exp(-2.4 * h);
  const nx = normal.x, ny = normal.y, nz = normal.z;
  const rx = contact.x, ry = contact.y, rz = contact.z;
  const vx = travel.x, vy = travel.y, vz = travel.z;
  let wx = spin.x, wy = spin.y, wz = spin.z;
  // Keep substeps in scalars and publish once. This is the same contact
  // impulse calculation without temporary vectors or repeated normalizations.
  for (let step = 0; step < steps; step++) {
    let sx = wy * rz - wz * ry + vx, sy = wz * rx - wx * rz + vy, sz = wx * ry - wy * rx + vz;
    const normalSpeed = sx * nx + sy * ny + sz * nz;
    sx -= nx * normalSpeed; sy -= ny * normalSpeed; sz -= nz * normalSpeed;
    const speedSq = sx * sx + sy * sy + sz * sz;
    if (speedSq > 1e-12) {
      const tx = ry * sz - rz * sy, ty = rz * sx - rx * sz, tz = rx * sy - ry * sx;
      const effectiveMass = speedSq + inverseInertia * (tx * tx + ty * ty + tz * tz);
      const impulse = Math.min(maxImpulse / Math.sqrt(speedSq), speedSq / effectiveMass) * inverseInertia;
      wx -= tx * impulse; wy -= ty * impulse; wz -= tz * impulse;
    }
    wx *= drag; wy *= drag; wz *= drag;
    // Twist around the floor normal has no rolling support. Let it unwind
    // faster than the useful roll, then hand off to the planted recovery.
    const twist = (wx * nx + wy * ny + wz * nz) * twistFade;
    wx -= nx * twist; wy -= ny * twist; wz -= nz * twist;
    const speedSqLimit = wx * wx + wy * wy + wz * wz;
    if (speedSqLimit > 256) {
      const scale = 16 / Math.sqrt(speedSqLimit);
      wx *= scale; wy *= scale; wz *= scale;
    }
  }
  spin.set(wx, wy, wz);
}
