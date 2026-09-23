import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

/** Presentation only: a startled catch followed by slow, staggered corrections.
 * The hips, legs and root stay contact-owned. Weight reaches zero on recovery. */
export function sampleTeeterMotion(time: number, weight: number, forward: number, side: number) {
  const w = Math.max(0, Math.min(1, weight));
  const cycle = time * Math.PI * 2 * .9;
  const catchBeat = Math.sin(Math.min(1, time / .6) * Math.PI) * Math.max(0, 1 - time / .6);
  const sway = Math.sin(cycle);
  const correction = .11 + .065 * sway + .18 * catchBeat;
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
    chestPitch: -forward * correction * w,
    chestRoll: side * correction * w,
    headPitch: (forward * correction * .55 + .09) * w,
    headRoll: (-side * correction * .65 + .035 * Math.sin(cycle - .6)) * w,
    arms: [-1, 1].map(sign => {
      const phase = cycle + (sign === 1 ? 1.7 : 0);
      return {
        swing: (-.3 + .48 * Math.sin(phase) - .4 * catchBeat) * w,
        spread: sign * (.85 + .23 * Math.cos(phase) + .35 * catchBeat) * w,
        elbow: -(.25 + .15 * Math.sin(phase - .5)) * w,
        wrist: .18 * Math.sin(phase - .85) * w,
      };
    }),
    deformations,
  };
}

/** Eight radial probes keep the same distance on axis-aligned and diagonal lips. */
export const TEETER_PROBE_DIRECTIONS = Array.from({ length: 8 }, (_, i) =>
  [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)] as const);
