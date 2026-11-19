import poses from './cargoRiderExpressions.json';
import score from './cargoRiderTakes.json';

export type CargoPerformance = keyof typeof poses;
export type CargoExpression = 'live' | 'wink' | 'smile' | 'surprise' | CargoPerformance;
export const cargoPerformances = Object.keys(poses) as CargoPerformance[];
export function performanceControls(name: CargoExpression): Readonly<Record<string, number>> | undefined {
  return Object.prototype.hasOwnProperty.call(poses, name) ? poses[name as CargoPerformance] : undefined;
}

export type CargoTake = keyof typeof score.takes;
type Curve = readonly (readonly number[])[];
type Take = {
  frames: number;
  apex: number;
  tracks: Record<string, Curve>;
  head?: Record<'yaw' | 'pitch' | 'roll', Curve>;
};
export const cargoTakes: Record<CargoTake, Take> = score.takes;
export const cargoFps = score.fps;

export function cargoCurveValue(keys: Curve, frame: number): number {
  if (frame <= keys[0][0]) return keys[0][1];
  const last = keys.length - 1;
  if (frame >= keys[last][0]) return keys[last][1];
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (keys[mid][0] <= frame) lo = mid;
    else hi = mid;
  }
  const t = (frame - keys[lo][0]) / (keys[hi][0] - keys[lo][0]);
  return keys[lo][1] + (keys[hi][1] - keys[lo][1]) * t * t * (3 - 2 * t);
}

export function sampleCargoTake(name: CargoTake, frame: number, sink: Map<string, number>): void {
  for (const [channel, curve] of Object.entries(cargoTakes[name].tracks)) {
    sink.set(channel, cargoCurveValue(curve, frame));
  }
}
