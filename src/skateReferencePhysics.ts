import { SKATE_PARK } from './skateParkPhysics';

/** Parameters tied to measured source geometry; absent on existing levels. */
export interface SkateReferenceData {
  kind: 'thps1';
  metresPerUnit: number;
  stats: { ollie: number; speed: number; air: number };
}

export type SkateParkParameters = Readonly<{ [K in keyof typeof SKATE_PARK]: number }>;
export interface SkateReferencePhysics {
  park: SkateParkParameters;
  kickAcceleration: number;
  lowDrag: number;
  highDrag: number;
  dragThreshold: number;
  finalSpeedLimit: number;
  railEntryBoost: number;
  railSlowThreshold: number;
  railZeroSpeed: number;
  railSlopeBoost: number;
  railTransferAngle: number;
  railCornerAngle: number;
}

export function validSkateReference(value: unknown): value is SkateReferenceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as SkateReferenceData;
  if (Object.keys(data).some(k => !['kind', 'metresPerUnit', 'stats'].includes(k)) ||
      data.kind !== 'thps1' || !Number.isFinite(data.metresPerUnit) ||
      data.metresPerUnit < 0.001 || data.metresPerUnit > 1 ||
      !data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) return false;
  return Object.keys(data.stats).every(k => ['ollie', 'speed', 'air'].includes(k)) &&
    [data.stats.ollie, data.stats.speed, data.stats.air].every(n => Number.isInteger(n) && n >= 0 && n <= 10);
}

/** Our 60 Hz integration of measured 30 Hz/Q12 parameters. This covers
 * ordinary auto-kick, gravity and pop, not source animation/special/terrain
 * state machines. Provenance and remaining differences: docs/MALL_RECREATION.md. */
export function createSkateReference(data: SkateReferenceData): SkateReferencePhysics {
  const unit = data.metresPerUnit, hz = 30, q = 4096;
  const speed = (offset: number) => Math.trunc((data.stats.speed + offset) * q * 45 / 28) / q * hz * unit;
  const pop = (stat: number, charged: boolean) => {
    const minimum = 32 - Math.trunc((10 - stat) / 2);
    const range = minimum + Math.trunc((10 - stat) / 3) - 18;
    return 0.75 * (minimum + (charged ? range : 0)) * hz * unit;
  };
  const gravity = 13000 / q * hz * hz * unit;
  return {
    park: Object.freeze({
      ...SKATE_PARK,
      groundGravity: 6500 / q * hz * hz * unit,
      airGravity: gravity,
      vertGravity: gravity,
      standingSpeed: speed(17),
      crouchingSpeed: speed(22),
      ollieMin: pop(data.stats.ollie, false),
      ollieMax: pop(data.stats.ollie, true),
      vertPopMin: pop(data.stats.air, false),
      vertPopMax: pop(data.stats.air, true),
      chargeSeconds: (15 - Math.trunc((data.stats.ollie + data.stats.air) / 2)) / hz,
    }),
    kickAcceleration: 4 * hz * hz * unit,
    lowDrag: 8 / q * hz,
    highDrag: 82 / q * hz,
    dragThreshold: speed(39),
    finalSpeedLimit: speed(50),
    railEntryBoost: (data.stats.speed + 5) * hz * unit,
    railSlowThreshold: 60000 / q * hz * unit,
    railZeroSpeed: 1000 / q * hz * unit,
    railSlopeBoost: 2000 / q * hz * unit,
    railTransferAngle: 200 / q * Math.PI * 2,
    railCornerAngle: Math.acos(2633 / q),
  };
}

/** Five active push ticks in each twenty-tick ground cycle. Integrating the
 * overlap keeps the impulse stable at 30, 60 and 120 Hz. Air freezes the clock. */
export function referenceKickDuration(groundSeconds: number, dt: number): number {
  const accumulated = (seconds: number) => {
    const ticks = Math.max(0, seconds) * 30;
    return (Math.floor(ticks / 20) * 5 + Math.min(5, Math.max(0, ticks % 20 - 5))) / 30;
  };
  return accumulated(groundSeconds + dt) - accumulated(groundSeconds);
}

/** Native low-speed rail assistance runs once per 30 Hz tick. Between those
 * decisions, integrate the projected gravity continuously, including its
 * half-acceleration displacement. `speed` and `distance` are signed along the
 * authored rail tangent, so a stalled uphill grind can reverse downhill. */
export function referenceRailMotion(
  profile: SkateReferencePhysics, speed: number, tangentY: number, seconds: number, dt: number,
): { speed: number; distance: number; seconds: number } {
  let distance = 0;
  const end = seconds + dt;
  while (seconds < end - 1e-10) {
    const tick = Math.floor(seconds * 30 + 1e-7);
    if (Math.abs(seconds * 30 - tick) < 1e-7) {
      if (speed === 0) speed = profile.railZeroSpeed;
      if (Math.abs(speed) < profile.railSlowThreshold) {
        if (tangentY > 0) speed -= profile.railSlopeBoost;
        else if (tangentY < 0) speed += profile.railSlopeBoost;
        else speed *= 1.25;
      }
    }
    const h = Math.min(end - seconds, (tick + 1) / 30 - seconds);
    const acceleration = -tangentY * profile.park.airGravity;
    distance += speed * h + acceleration * h * h / 2;
    speed += acceleration * h;
    seconds += h;
  }
  return { speed, distance, seconds: end };
}
