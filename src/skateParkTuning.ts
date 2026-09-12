import { TUNING, PARK_MOVEMENT_KEYS } from './tuning';

/** A read-only view, not a global override. Each alias reads the current park
 * value, while unrelated settings inherit live from TUNING. No allocation in
 * the simulation loop and no cross-talk between two players/level profiles. */
export const PARK_MOVEMENT_TUNING: Readonly<typeof TUNING> = Object.create(TUNING,
  Object.fromEntries(Object.entries(PARK_MOVEMENT_KEYS).map(([base,park]) =>
    [base, {get: () => TUNING[park]}])));

export function parkCruiseSpeed(): number {
  return Math.min(TUNING.parkCruiseSpeed, TUNING.parkMaxSpeed);
}
export function parkChargedSpeed(): number {
  return TUNING.parkMaxSpeed;
}
