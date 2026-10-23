import { SKATE_PARK } from './skateParkPhysics';
import type {ReferenceRailFrame} from './referenceRailCapture';

/** Parameters tied to measured source geometry; absent on existing levels. */
export interface SkateReferenceData {
  kind: 'thps1';
  railCapture?: Omit<ReferenceRailFrame,'unit'>;
  metresPerUnit: number;
  stats: { ollie: number; speed: number; air: number; balance?: number };
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
  balanceStat?: number;
  railCapture?: ReferenceRailFrame;
}

export function validSkateReference(value: unknown): value is SkateReferenceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as SkateReferenceData;
  if (Object.keys(data).some(k => !['kind', 'metresPerUnit', 'stats', 'railCapture'].includes(k)) ||
      data.kind !== 'thps1' || !Number.isFinite(data.metresPerUnit) ||
      data.metresPerUnit < 0.001 || data.metresPerUnit > 1 ||
      !data.stats || typeof data.stats !== 'object' || Array.isArray(data.stats)) return false;
  const frame=data.railCapture;
  if(frame!==undefined&&(!frame||typeof frame!=='object'||Array.isArray(frame)||
    Object.keys(frame).some(k=>!['origin','axes'].includes(k))||
    !Array.isArray(frame.origin)||frame.origin.length!==3||!frame.origin.every(n=>Number.isFinite(n)&&Math.abs(n)<1e6)||
    !Array.isArray(frame.axes)||frame.axes.length!==3||!frame.axes.every(n=>Number.isInteger(n)&&Math.abs(n)>=1&&Math.abs(n)<=3)||new Set(frame.axes.map(Math.abs)).size!==3))return false;
  return Object.keys(data.stats).every(k => ['ollie', 'speed', 'air', 'balance'].includes(k)) &&
    [data.stats.ollie, data.stats.speed, data.stats.air].every(n => Number.isInteger(n) && n >= 0 && n <= 10) &&
    (data.stats.balance === undefined || Number.isInteger(data.stats.balance) && data.stats.balance >= 0 && data.stats.balance <= 10);
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
    balanceStat: data.stats.balance,
    railCapture: data.railCapture?{origin:[...data.railCapture.origin],axes:[...data.railCapture.axes],unit}:undefined,
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

/** Source integer balance state. The exposed needle is position/4000; velocity
 * here is the original per-tick quantity, not a smoothed force. The caller
 * supplies its random stream and native state sequence, so fixtures can compare
 * every source recurrence independently of presentation or global randomness. */
export class ReferenceRailBalance {
  position = 0;
  velocity = 0;
  railTicks = 0;
  armed = false;
  private seconds = 0;

  reset(): void {
    this.position = this.velocity = this.railTicks = this.seconds = 0;
    this.armed = false;
  }

  catchRail(sameRail: boolean, stat: number): void {
    this.armed = false;
    if (sameRail) this.railTicks += 40;
    else { this.railTicks = Math.max(0, this.railTicks - 30); this.velocity = 0; }
    this.velocity = Math.trunc(Math.trunc(this.velocity * (100 - stat * 15) / 100) * (this.railTicks + 60) / 80) || 0;
  }

  advance(dt: number, mode: 'ground' | 'air' | 'grind', axis: number, stat: number, random: () => number): boolean {
    const previous = Math.floor(this.seconds * 30 + 1e-7);
    this.seconds += dt;
    const ticks = Math.floor(this.seconds * 30 + 1e-7) - previous;
    for (let tick = 0; tick < ticks; tick++) {
      this.railTicks++;
      if (mode === 'ground') {
        this.position = this.velocity = this.railTicks = 0;
      } else if (mode === 'grind') {
        const time = this.railTicks + 60;
        this.position += Math.trunc(Math.trunc(this.position / (stat * 3 + 28)) * time / 80);
        this.position += Math.trunc(this.velocity * time / 80);
        // Native analog mAX ranges approximately -128..127; digital buttons
        // map to the ends. Holding the catch direction never arms steering.
        const direction = axis < -40 / 128 ? -1 : axis > 40 / 128 ? 1 : 0;
        if (direction === 0) this.armed = true;
        if (direction && this.armed) this.velocity += direction * 20;
        else if (Math.abs(this.velocity) < 20 - stat) {
          const range = 80 - stat * 3;
          this.velocity = Math.floor(random() * range) - Math.trunc(range / 2);
        }
        if (Math.abs(this.position) > 4000) return true;
      }
    }
    return false;
  }
}
