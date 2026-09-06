export const SOFT_SKATE_IMPACT_SECONDS = 0.42;

/** A damped, energy-losing rebound. Glances retain their along-wall motion. */
export function softSkateRebound(
  vx: number, vz: number, nx: number, nz: number, sidePreference = 1,
): { x: number; z: number; nx: number; nz: number } | null {
  const speed = Math.hypot(vx, vz), length = Math.hypot(nx, nz);
  if (!Number.isFinite(speed + length) || speed <= 0.1 || length < 1e-6) return null;
  nx /= length;
  nz /= length;
  const into = vx * nx + vz * nz;
  if (into >= -0.01) return null;
  const tx = -nz, tz = nx;
  let along = (vx * tx + vz * tz) * 0.97;
  // A square hit needs a small sideways escape rather than repeated hammering.
  if (Math.abs(along) < speed * 0.16) along = Math.sign(along || sidePreference || 1) * speed * 0.26;
  let x = tx * along - nx * into * 0.24, z = tz * along - nz * into * 0.24;
  const magnitude = Math.hypot(x, z);
  const retained = Math.min(speed * 0.97, Math.max(speed * 0.45, magnitude));
  x *= retained / magnitude;
  z *= retained / magnitude;
  return { x, z, nx, nz };
}

export function sampleSoftSkateImpact(remaining: number): { brace: number; wobble: number } {
  if (!Number.isFinite(remaining)) return { brace: 0, wobble: 0 };
  const progress = Math.min(1, Math.max(0, 1 - remaining / SOFT_SKATE_IMPACT_SECONDS));
  if (progress <= 0 || progress >= 1) return { brace: 0, wobble: 0 };
  return {
    brace: Math.sin(Math.PI * Math.pow(progress, 0.55)),
    wobble: Math.sin(progress * Math.PI * 4) * (1 - progress),
  };
}
