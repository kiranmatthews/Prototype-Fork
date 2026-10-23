import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from '../animation/elasticity';

const smooth = (x: number, a: number, b: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * t * (10 + t * (-15 + 6 * t));
};
const beat = (x: number, a: number, b: number, c: number, d: number) =>
  smooth(x, a, b) * (1 - smooth(x, c, d));

/** Round the gait's half-wave corner while the knees take the get-up load.
 * This leaves a little flex through the passing step instead of locking both
 * knees and immediately bending them again. Ordinary gait is unchanged. */
export function recoveryStrideMagnitude(wave: number, weight: number): number {
  const magnitude = Math.abs(wave), width = .24;
  return magnitude >= width ? magnitude : magnitude +
    (width / 2 + wave * wave / (2 * width) - magnitude) * weight;
}

/** Articulate around the waist while the root carries the landed roll.
 * Gather knees toward the chest, turn onto one shoulder, then bring one
 * foot underneath a bent torso. The chest unfolds last, with a small nod.
 * All offsets have finite, zero-slope ends and reuse the editable elasticity. */
export class BailGetUpPose {
  curl = 0; sideBend = 0; twist = 0; head = 0;
  gather = 0; press = 0; stride = 0;
  leadHip = 0; trailHip = 0; leadKnee = 0; trailKnee = 0;
  readonly deformations: Record<string, number> = Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id]) => [id, 1]));
  private readonly elasticity = characterElasticityAmplitudes('bail');

  sample(phase: number, side: number, rollSide: number): void {
    this.gather = beat(phase, .08, .45, .47, .82);
    this.press = beat(phase, .27, .54, .7, 1);
    this.stride = beat(phase, .62, .82, .82, 1);
    this.curl = .70 * this.gather + .42 * this.press;
    this.sideBend = .34 * rollSide * this.gather + .12 * side * this.press;
    this.twist = .26 * side * this.gather * (1 - smooth(phase, .42, .75));
    this.head = .18 * this.gather - .30 * this.press;
    // Positive knee flex folds the heel backward; NEGATIVE hip pitch lifts
    // that knee toward the chest instead of curling both legs behind us.
    this.leadHip = -1.0 * this.gather - .65 * this.press - .2 * this.stride;
    this.trailHip = -.76 * this.gather + .22 * this.press + .25 * this.stride;
    this.leadKnee = 1.4 * this.gather + .85 * this.press;
    this.trailKnee = 1.15 * this.gather + .65 * this.press;
    for (const [id, part] of ELASTIC_LENGTH_CONTROLS) {
      // Coiling compresses the torso; pushing lengthens it before the rise
      // layer rebounds. Loaded hands/feet retain their segment lengths.
      const strain = part === 0 ? -1.8 * this.gather + 1.1 * this.press :
        part >= 3 ? -.55 * this.gather * (1 - this.press) : -.3 * this.gather * (1 - this.press);
      this.deformations[id] = 1 + this.elasticity[part] * strain;
    }
  }
}
