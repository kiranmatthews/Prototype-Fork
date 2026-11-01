import type { Vector3 } from 'three';
import type { Rail } from './rails';

type Point = Pick<Vector3, 'x' | 'y' | 'z'>;

/** First downward sole crossing of a finite rail segment in this movement.
 * Work on the authored polyline, including slopes and curves, without a
 * nearest-point query (or allocations) for every prediction sample. */
export function railLandingFraction(
  rail: Rail, from: Point, to: Point, rideHeight: number, radius: number,
): number | null {
  if (!rail.grindable) return null;
  let first = Infinity;
  for (let i = 0; i + 1 < rail.points.length; i++) {
    const a = rail.points[i], b = rail.points[i + 1];
    if (Math.max(from.x, to.x) + radius < Math.min(a.x, b.x) ||
        Math.min(from.x, to.x) - radius > Math.max(a.x, b.x) ||
        Math.max(from.z, to.z) + radius < Math.min(a.z, b.z) ||
        Math.min(from.z, to.z) - radius > Math.max(a.z, b.z)) continue;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const planarLength2 = dx * dx + dz * dz;
    if (planarLength2 < 1e-10) continue; // a vertical bar has no landing top
    const u0 = ((from.x - a.x) * dx + (from.z - a.z) * dz) / planarLength2;
    const u1 = ((to.x - a.x) * dx + (to.z - a.z) * dz) / planarLength2;
    const h0 = from.y - (a.y + dy * u0 + rideHeight);
    const h1 = to.y - (a.y + dy * u1 + rideHeight);
    if (h0 < -1e-7 || h1 > 0 || h1 >= h0) continue;
    const fraction = Math.max(0, h0 / (h0 - h1));
    const u = u0 + (u1 - u0) * fraction;
    if (u < 0 || u > 1 || fraction >= first) continue;
    const x = from.x + (to.x - from.x) * fraction - (a.x + dx * u);
    const z = from.z + (to.z - from.z) * fraction - (a.z + dz * u);
    if (x * x + z * z <= radius * radius) first = fraction;
  }
  return Number.isFinite(first) ? first : null;
}

/** Only predicts contact; it never moves or accelerates the skater. Recheck
 * every fixed step so steering and live rail motion can change the answer. */
export function naturalRailLandingTime(
  rail: Rail, position: Point, velocity: Point,
  gravityAt: (verticalSpeed: number, elapsed: number) => number,
  rideHeight: number, radius: number, dt: number, maxFallSpeed: number,
  exactGravityStep = false,
): number | null {
  if (!(dt > 0) || !Number.isFinite(dt)) return null;
  const from = { x: position.x, y: position.y, z: position.z }, to = { x: 0, y: 0, z: 0 };
  let vy = velocity.y;
  // Include a full high ollie / floaty kite arc, still with a hard budget.
  for (let step = 0; step < Math.min(180, Math.ceil(3 / dt)); step++) {
    const elapsed = step * dt;
    const gravity = gravityAt(vy, elapsed);
    vy = Math.max(-maxFallSpeed, vy - gravity * dt);
    to.x = from.x + velocity.x * dt;
    to.y = from.y + vy * dt + (exactGravityStep ? .5 * gravity * dt * dt : 0);
    to.z = from.z + velocity.z * dt;
    const fraction = railLandingFraction(rail, from, to, rideHeight, radius);
    if (fraction !== null) return elapsed + fraction * dt;
    from.x = to.x; from.y = to.y; from.z = to.z;
  }
  return null;
}
