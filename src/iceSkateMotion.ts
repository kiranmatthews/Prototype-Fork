import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const ICE_SKATE_CYCLE_SECONDS = 1.6;

export interface IceSkateInput {
  eligible: boolean;
  onIce: boolean;
  speed: number;
  grip: number;
  steering: number;
  braking: boolean;
}

/** Cosmetic corrections over the existing skate stance. The board and the
 * planted feet keep their contact solver; no velocity or heading is written. */
export function sampleIceSkateMotion(time: number, weight: number, steering: number, brace: number) {
  const w = clamp(weight, 0, 1), turn = clamp(steering, -1, 1), brake = clamp(brace, 0, 1);
  const phase = time * Math.PI * 2 / ICE_SKATE_CYCLE_SECONDS;
  // Unequal catches prevent a mechanical, symmetric waving cycle.
  const sway = .7 * Math.sin(phase) + .3 * Math.sin(phase * 2 + .5);
  const catchBeat = Math.pow(.5 + .5 * Math.sin(phase - .6), 4);
  const correction = sway * .10 - turn * .15;
  const amplitudes = characterElasticityAmplitudes('ice-skate');
  const deformations: Record<string, number> = {};
  for (const [target, part] of ELASTIC_LENGTH_CONTROLS) {
    if (!amplitudes[part]) continue; // planted legs never change length
    const lag = part === 2 ? .8 : part === 1 ? .35 : 0;
    const sidePhase = target.includes('.right.') ? 1.1 : 0;
    deformations[target] = 1 + amplitudes[part] * w *
      (.7 * Math.sin(phase - lag + sidePhase) - .6 * catchBeat);
  }
  return {
    weight: w,
    steering: turn,
    brace: brake,
    knee: (.16 + .14 * catchBeat + .20 * brake) * w,
    chestPitch: (.045 + .065 * catchBeat + .08 * brake) * w,
    chestRoll: correction * w,
    headPitch: -(.03 + .04 * brake) * w,
    headRoll: -correction * .75 * w,
    arms: [-1, 1].map(sign => {
      const p = phase + (sign > 0 ? 1.1 : 0);
      return {
        swing: (-.12 + .36 * Math.sin(p - .18) - .24 * brake - sign * turn * .18) * w,
        spread: sign * (.52 + .22 * Math.sin(p) + .18 * catchBeat + .16 * brake) * w,
        elbow: -(.12 + .12 * Math.sin(p - .42)) * w,
        wrist: (.20 * Math.sin(p - .85) + sign * turn * .12) * w,
      };
    }),
    deformations,
  };
}

/** Finite entry/exit blend. Actions hand back ownership immediately; leaving
 * ice while still skating settles within .24 s instead of snapping the arms. */
export class IceSkateMotion {
  private weight = 0;
  private time = 0;
  private steering = 0;
  private brace = 0;
  reset(): void { this.weight = this.time = this.steering = this.brace = 0; }
  step(dt: number, p: IceSkateInput): ReturnType<typeof sampleIceSkateMotion> | null {
    if (!p.eligible) { this.reset(); return null; }
    const t = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const speed = clamp(Math.abs(p.speed) / 18, 0, 1);
    const target = p.onIce ? (.35 + .65 * speed) * (.65 + .35 * (1 - clamp(p.grip, 0, 1))) : 0;
    const delta = target - this.weight;
    this.weight += clamp(delta, -t / .24, t / .18);
    if (this.weight < 1e-6) { this.reset(); return null; }
    this.time += t * (.7 + .35 * speed);
    this.steering += (clamp(p.steering, -1, 1) - this.steering) * (1 - Math.exp(-9 * t));
    this.brace += ((p.braking ? 1 : 0) - this.brace) * (1 - Math.exp(-10 * t));
    return sampleIceSkateMotion(this.time, this.weight, this.steering, this.brace);
  }
}
