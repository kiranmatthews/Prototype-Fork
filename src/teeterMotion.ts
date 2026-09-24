import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

/** Presentation only: a startled catch followed by slow, staggered corrections.
 * Toe contacts own the lower body; the shoulders fight the forward fall. */
export function sampleTeeterMotion(time: number, weight: number, forward: number, side: number) {
  const w = Math.max(0, Math.min(1, weight));
  const cycle = time * Math.PI * 2 * .9;
  const catchBeat = Math.sin(Math.min(1, time / .6) * Math.PI) * Math.max(0, 1 - time / .6);
  const sway = Math.sin(cycle);
  const correction = .34 + .10 * sway + .16 * catchBeat;
  const amplitudes = characterElasticityAmplitudes('teeter');
  const deformations: Record<string, number> = {};
  for (const [target, part] of ELASTIC_LENGTH_CONTROLS) {
    if (!amplitudes[part]) continue; // legs stay planted
    const lag = part === 2 ? .7 : part === 1 ? .3 : 0;
    const opposite = target.includes('.right.') ? 1.7 : 0;
    deformations[target] = 1 + amplitudes[part] * w *
      (.55 * Math.sin(cycle - lag + opposite) - 1.2 * catchBeat);
  }
  return {
    chestPitch: forward * correction * w,
    chestRoll: -side * correction * w,
    headPitch: (.44 - forward * correction * .25) * w,
    headRoll: (side * correction * .35 + .035 * Math.sin(cycle - .6)) * w,
    arms: [-1, 1].map(sign => {
      const phase = cycle + (sign === 1 ? 1.7 : 0);
      return {
        swing: (.2 + .95 * Math.sin(phase) - .5 * catchBeat) * w,
        spread: sign * (.62 + .42 * Math.cos(phase) + .3 * catchBeat) * w,
        elbow: -(.38 + .28 * Math.sin(phase - .5)) * w,
        wrist: .30 * Math.sin(phase - .85) * w,
      };
    }),
    deformations,
  };
}

/** Eight radial probes keep the same distance on axis-aligned and diagonal lips. */
export const TEETER_PROBE_DIRECTIONS = Array.from({ length: 8 }, (_, i) =>
  [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)] as const);

/** Recover the lip normal from the supported arc of the probe circle. Refining
 * its two boundaries avoids snapping arbitrary rotated faces to 45° sectors.
 * The callback uses real ground queries, including joined pieces and movers. */
export function probeTeeterEdge(distance: number, hasSupport: (x: number, z: number) => boolean) {
  const missing = TEETER_PROBE_DIRECTIONS.map(([x, z]) => !hasSupport(x * distance, z * distance));
  if (!missing.some(Boolean)) return null;
  let x = 0, z = 0;
  for (let i = 0; i < missing.length; i++) {
    if (missing[i] === missing[(i + 1) % missing.length]) continue;
    let low = i * Math.PI / 4, high = (i + 1) * Math.PI / 4;
    for (let j = 0; j < 5; j++) {
      const mid = (low + high) / 2;
      if (!hasSupport(Math.cos(mid) * distance, Math.sin(mid) * distance) === missing[i]) low = mid;
      else high = mid;
    }
    const angle = (low + high) / 2, sign = missing[i] ? 1 : -1;
    x += sign * Math.sin(angle);
    z -= sign * Math.cos(angle);
  }
  return { x, z };
}
