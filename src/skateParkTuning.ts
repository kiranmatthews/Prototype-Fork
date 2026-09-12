import { SKATE_PARK } from './skateParkPhysics';
import { TUNING } from './tuning';

// Callers gate this profile on level.skatepark, never on the competition ID
// or the optional chase-camera toggle used by platforming levels.
export function parkCruiseSpeed(): number {
  return SKATE_PARK.standingSpeed * TUNING.parkCruiseSpeedScale;
}
export function parkChargedSpeed(): number {
  return Math.max(parkCruiseSpeed(), SKATE_PARK.crouchingSpeed * TUNING.parkChargeSpeedScale);
}
export function parkSpeedLimitScale(): number {
  return Math.max(1, TUNING.parkCruiseSpeedScale, TUNING.parkChargeSpeedScale);
}

/** H = v²/2g and T = 2v/g: scale height and duration independently.
 * Snapshot both at takeoff so live edits never kink an airborne arc. */
export function parkOllieLaunch(verticalSpeed: number): { velocity: number; gravity: number } {
  const height = TUNING.parkOllieHeight, time = TUNING.parkOllieHangtime;
  return {
    velocity: verticalSpeed * height / time,
    gravity: SKATE_PARK.airGravity * height / (time * time),
  };
}
