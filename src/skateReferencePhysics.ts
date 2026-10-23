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
