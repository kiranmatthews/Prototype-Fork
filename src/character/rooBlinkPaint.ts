export const ROO_BLINK_TEXTURE_SIZE = 256;
export const ROO_BLINK_PAINT_STEPS = 24;
const STRIDE = 7;
const LID = [211, 108, 19] as const;
const LASH = [24, 20, 26] as const;
const STROKE = 0.005;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Precompute only paintable UV texels; the shared original mesh never changes. */
export function prepareRooLidPaint(coordinates: Uint8ClampedArray): Float32Array {
  const expected = ROO_BLINK_TEXTURE_SIZE ** 2 * 4;
  if (coordinates.length !== expected) throw new Error('Roo blink coordinate map must be 256² RGBA');
  const samples: number[] = [];
  for (let i = 0; i < coordinates.length; i += 4) {
    if (!coordinates[i + 3]) continue;
    const x = 0.02 + coordinates[i] / 255 * 0.16;
    const y = 0.23 + coordinates[i + 1] / 255 * 0.12;
    const q = (x - 0.089) / 0.070;
    if (Math.abs(q) > 1.03) continue;
    const arch = Math.sqrt(Math.max(0, 1 - q * q));
    const middle = 0.282 + 0.27 * (x - 0.089);
    const top = middle + 0.036 * arch + 0.007;
    const bottom = middle - 0.030 * arch - 0.004;
    const edge = (1 - smooth(top - 0.002, top + 0.004, y)) * (1 - smooth(0.965, 1.02, Math.abs(q)));
    if (!edge) continue;
    const light = 0.94 + 0.10 * smooth(bottom, top, y);
    const crease = (1 - smooth(0.001, 0.0025, Math.abs(y - (top - 0.012)))) * 0.08;
    samples.push(i, y, top, bottom + 0.008, edge, light, crease);
  }
  return new Float32Array(samples);
}

export function paintRooLids(amount: number, output: Uint8ClampedArray, samples: Float32Array): void {
  output.fill(0);
  if (!(amount > 0)) return;
  amount = Math.min(1, amount);
  for (let s = 0; s < samples.length; s += STRIDE) {
    const index = samples[s], y = samples[s + 1], top = samples[s + 2];
    const line = top + (samples[s + 3] - top) * amount;
    const coverage = samples[s + 4] * smooth(line - STROKE * 1.35, line - STROKE * 0.6, y);
    if (!coverage) continue;
    const lash = (1 - smooth(STROKE * 0.55, STROKE * 1.25, Math.abs(y - line))) * smooth(0.06, 0.2, amount);
    const shade = samples[s + 5] * (1 - samples[s + 6] * amount);
    for (let c = 0; c < 3; c++) output[index + c] = Math.round(LID[c] * shade * (1 - lash) + LASH[c] * lash);
    output[index + 3] = Math.round(coverage * 255);
  }
}
