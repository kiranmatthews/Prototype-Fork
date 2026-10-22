import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
export const BAIL_RISE_SETTLE_SECONDS = .95;

/** A finite rebound through the last push and the first free running steps.
 * Segment strain uses the same editable bail elasticity profile as impacts.
 * No controller velocity, whole-skeleton scale or per-frame allocation. */
export class BailRiseMotion {
  pitch = 0;
  roll = 0;
  knee = 0;
  arm = 0;
  head = 0;
  private readonly elasticity = characterElasticityAmplitudes('bail');
  readonly deformations: Record<string, number> = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id]) => [id, 1]));

  sample(age: number, energy: number, side: number): void {
    const t = Math.max(0, age);
    const envelope = age < 0 ? 0 : smooth(t / .09) * (1 - smooth((t - .65) / .3)) * Math.exp(-3.6 * t);
    if (envelope === 0) {
      this.pitch = this.roll = this.knee = this.arm = this.head = 0;
      for (const [id] of ELASTIC_LENGTH_CONTROLS) this.deformations[id] = 1;
      return;
    }
    const gain = .7 + .3 * Math.max(0, Math.min(1, energy));
    const rebound = Math.sin(t * 13) * envelope * gain;
    const lag = Math.sin(t * 10) * envelope * gain;
    this.pitch = -.18 * rebound;
    this.roll = side * .095 * lag;
    this.knee = .24 * rebound;
    this.arm = .24 * lag;
    this.head = .12 * lag;
    for (const [id, part] of ELASTIC_LENGTH_CONTROLS)
      this.deformations[id] = 1 - this.elasticity[part] * rebound * (part === 0 ? 1 : .7);
  }
}
