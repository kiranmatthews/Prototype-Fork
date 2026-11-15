export const UNITY_ROPE_CLIP_IDS = {
  hang: 'player.rope',
  climb: 'player.rope-climb',
  release: 'player.rope-release',
  chargedRelease: 'player.rope-release-charged',
} as const;

export const UNITY_ROPE_INPUTS = {
  climbDirection: 'ropeClimbDirection',
  releaseCharge: 'ropeReleaseCharge',
} as const;

export const UNITY_ROPE_TIMING = Object.freeze({
  hangDuration: UNITY_ROPE_HANG_DURATION,
  climbSourceDuration: 2.6,
  climbLoopBlend: 4 / 60,
  climbCycleDuration: UNITY_ROPE_CLIMB_DURATION,
  swingReleaseSourceDuration: 4.3666667,
  swingReleaseLeadIn: 34 / 60,
  swingReleaseDuration: UNITY_ROPE_RELEASE_SWING_DURATION,
  backflipReleaseSourceDuration: 1.9,
  backflipReleaseLeadIn: 17 / 60,
  backflipReleaseDuration: UNITY_ROPE_RELEASE_BACKFLIP_DURATION,
  /** Hang and climb hand over to each other over this long. The hands and feet stay on the rope throughout (they
   * are placed there, not played), so this only has to carry the spine and the head: long enough to be unseen. */
  attachedBlend: 9 / 60,
  /** Whatever the flight was doing (a flip, a fall, a run off a ledge) eases into the hang over this long. */
  catchBlend: 9 / 60,
  /** The hang eases into the leap, and the leap into the fall after it. */
  releaseBlend: 6 / 60,
  leaveBlend: 9 / 60,
});

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/** Where in the charged leap's clip the backflip has come round and the body is opening for the ground. */
export const UNITY_ROPE_BACKFLIP_TURNED = 0.62;

/** Seconds a leap launched upward at `launchSpeed` takes to come back to the height it left from. */
export function unityRopeLeapAirSeconds(launchSpeed: number, riseGravity: number, fallGravity: number): number {
  const speed = Math.max(0, launchSpeed), rise = Math.max(1e-6, riseGravity), fall = Math.max(1e-6, fallGravity);
  return speed / rise + speed / Math.sqrt(rise * fall);
}

/**
 * How long the leap's clip plays for. With no `airSeconds` these are the source clips' own lengths. Given the leap's
 * own time in the air, the charged backflip is fitted to it: the source flip takes a second to come round, twice
 * what any leap off a rope has, so played at its own pace it was always cut off upside down by the ground. Fitted,
 * it has come round nine tenths of the way through the leap, whatever the leap's height, and is opening for the
 * landing as it comes down. Any real charge takes the fitted pace, since any real charge has some flip in it.
 */
export function unityRopeReleaseDuration(charge: number, airSeconds?: number): number {
  const weight = clamp01(charge);
  if (airSeconds === undefined || !(airSeconds > 0)) {
    return UNITY_ROPE_TIMING.swingReleaseDuration * (1 - weight) +
      UNITY_ROPE_TIMING.backflipReleaseDuration * weight;
  }
  const fitted = Math.min(UNITY_ROPE_TIMING.backflipReleaseDuration,
    Math.max(0.6, airSeconds * 0.9 / UNITY_ROPE_BACKFLIP_TURNED));
  const u = clamp01(weight / 0.35), pace = u * u * (3 - 2 * u);
  return UNITY_ROPE_TIMING.swingReleaseDuration * (1 - pace) + fitted * pace;
}
import {
  UNITY_ROPE_CLIMB_DURATION,
  UNITY_ROPE_HANG_DURATION,
  UNITY_ROPE_RELEASE_BACKFLIP_DURATION,
  UNITY_ROPE_RELEASE_SWING_DURATION,
} from './unityRopeAnimations.generated';
