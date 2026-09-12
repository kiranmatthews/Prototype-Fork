import { TUNING } from './tuning';

export function parkCruiseSpeed(): number {
  return Math.min(TUNING.parkCruiseSpeed, TUNING.parkChargeSpeed);
}
export function parkChargedSpeed(): number {
  return TUNING.parkChargeSpeed;
}
