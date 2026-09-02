export interface CarveGripEndpoints {
  readonly low: number;
  readonly high: number;
}

interface LegacyCarveGripCurve {
  readonly base: number;
  readonly ratio: number;
  readonly cruise: number;
}

let legacyReplayCurve: LegacyCarveGripCurve | null = null;

const finiteNonNegative = (value: number, fallback = 0): number =>
  Number.isFinite(value) ? Math.max(0, value) : fallback;

/**
 * Direct endpoint steering curve. Zero speed receives the low-speed turn rate,
 * `highSpeed` receives the high-speed rate, and overspeed holds that endpoint.
 * Low may freely exceed high; there is no hidden ratio or multiplier clamp.
 */
export function carveGripAtSpeed(
  speed: number,
  highSpeed: number,
  lowGrip: number,
  highGrip: number,
): number {
  const velocity = finiteNonNegative(Math.abs(speed));
  const highVelocity = finiteNonNegative(highSpeed);
  const from = finiteNonNegative(lowGrip);
  const to = finiteNonNegative(highGrip);
  const blend = highVelocity > 1e-6
    ? Math.min(1, velocity / highVelocity)
    : velocity > 0 ? 1 : 0;
  return from + (to - from) * blend;
}

export function legacyCarveGripAtSpeed(
  speed: number,
  carveGrip: number,
  carveGripRatio: number,
  cruiseSpeed: number,
): number {
  const base = finiteNonNegative(carveGrip);
  const ratio = Number.isFinite(carveGripRatio) ? carveGripRatio : 0;
  const cruise = Math.max(finiteNonNegative(cruiseSpeed, 1), 1e-6);
  return base * Math.min(
    2,
    Math.max(0.5, 1 + (finiteNonNegative(Math.abs(speed)) / cruise - 1) * ratio),
  );
}

/** Replay-only compatibility; ordinary live tuning always leaves this null. */
export function setLegacyCarveGripReplayCurve(
  values: Readonly<Record<string, number>> | null,
): void {
  legacyReplayCurve = values &&
    Number.isFinite(values.carveGrip) &&
    Number.isFinite(values.carveGripRatio)
    ? {
      base: values.carveGrip,
      ratio: values.carveGripRatio,
      cruise: values.cruiseSpeed,
    }
    : null;
}

export function liveCarveGripAtSpeed(
  speed: number,
  highSpeed: number,
  lowGrip: number,
  highGrip: number,
): number {
  return legacyReplayCurve
    ? legacyCarveGripAtSpeed(
      speed,
      legacyReplayCurve.base,
      legacyReplayCurve.ratio,
      legacyReplayCurve.cruise,
    )
    : carveGripAtSpeed(speed, highSpeed, lowGrip, highGrip);
}

/** Reconstruct the old ratio curve only at the two new editable endpoints. */
export function legacyCarveGripEndpoints(
  carveGrip: number,
  carveGripRatio: number,
  cruiseSpeed: number,
  highSpeed: number,
): CarveGripEndpoints {
  const sample = (speed: number): number =>
    legacyCarveGripAtSpeed(
      speed,
      carveGrip,
      carveGripRatio,
      cruiseSpeed,
    );
  return { low: sample(0), high: sample(highSpeed) };
}

export function legacyCarveGripEndpointsFromRecord(
  values: Readonly<Record<string, number>>,
): CarveGripEndpoints | null {
  if (
    !Number.isFinite(values.carveGrip) ||
    !Number.isFinite(values.carveGripRatio)
  ) return null;
  return legacyCarveGripEndpoints(
    values.carveGrip,
    values.carveGripRatio,
    values.cruiseSpeed,
    values.maxSpeed,
  );
}

export function migrateLegacySavedCarveGrip(
  tuning: Readonly<Record<string, number>>,
  defaults: Readonly<Record<string, number>>,
  currentCruiseSpeed: number,
  currentMaxSpeed: number,
): CarveGripEndpoints | null {
  if (
    Number.isFinite(tuning.carveGripLow) ||
    Number.isFinite(tuning.carveGripHigh)
  ) return null;
  const edited =
    (Number.isFinite(tuning.carveGrip) &&
      tuning.carveGrip !== defaults.carveGrip) ||
    (Number.isFinite(tuning.carveGripRatio) &&
      tuning.carveGripRatio !== defaults.carveGripRatio) ||
    (Number.isFinite(tuning.cruiseSpeed) &&
      tuning.cruiseSpeed !== defaults.cruiseSpeed) ||
    (Number.isFinite(tuning.maxSpeed) &&
      tuning.maxSpeed !== defaults.maxSpeed);
  if (!edited) return null;
  return legacyCarveGripEndpointsFromRecord({
    ...tuning,
    cruiseSpeed: currentCruiseSpeed,
    maxSpeed: currentMaxSpeed,
  });
}
