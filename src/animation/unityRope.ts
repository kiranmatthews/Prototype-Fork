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
  /** The hang eases into the leap (the clip's part of it: the body itself is carried over by the rope layer), and
   * the leap into the fall after it. */
  releaseBlend: 8 / 60,
  leaveBlend: 9 / 60,
});

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * A LEAP OFF A ROPE IS A PLAIN ONE OR A BACKFLIP, NEVER PART OF EACH. The two are different turns of the whole
 * body. Blended by how long Jump was held (as they were), a half-held leap was a body half way between upright
 * and upside down that crossed from one to the other in a single frame: every hip, shoulder and the head turned
 * 176 degrees in a sixtieth of a second, a third of a second into the air. And a tap is not a tap in the hand:
 * 80 to 150 ms on the button is a fifth to a third of a full charge, so nearly every leap was one of those.
 *
 * Held less than this share of a full charge, a leap is the plain one: an ordinary jump from the frame the hands
 * open, in the same airborne clips as any other jump, landing as they land. Held longer, it is the backflip.
 */
export const UNITY_ROPE_BACKFLIP_CHARGE = 0.6;
export function unityRopeLeapFlips(charge: number): boolean {
  return clamp01(charge) >= UNITY_ROPE_BACKFLIP_CHARGE;
}

/** Where in the charged leap's clip the backflip has come round and the body is opening for the ground. */
export const UNITY_ROPE_BACKFLIP_TURNED = 0.62;
/**
 * ...and where it is played to. Past this the source lands: a deep crouch, drawn with no drop of the hips (the
 * clip carries none), so in the air it was a body folded up with its soles three quarters of a metre off the
 * ground it had just touched. The flip is played to here, open and feet down, and the fall and the landing
 * after it are the game's own.
 */
export const UNITY_ROPE_BACKFLIP_OPEN = 0.64;
/** The flip is round and open with this much of the leap's air still to come... */
export const UNITY_ROPE_BACKFLIP_SPARE = 0.14;
/** ...and never later than this long before the ground, however the ground has come up to meet it. */
export const UNITY_ROPE_BACKFLIP_CLEAR = 0.1;

/** Seconds a leap launched upward at `launchSpeed` takes to come back to the height it left from. */
export function unityRopeLeapAirSeconds(launchSpeed: number, riseGravity: number, fallGravity: number): number {
  const speed = Math.max(0, launchSpeed), rise = Math.max(1e-6, riseGravity), fall = Math.max(1e-6, fallGravity);
  return speed / rise + speed / Math.sqrt(rise * fall);
}

/**
 * Seconds the leap's own clip plays for: none for a plain leap (it has no clip of its own), and for a backflip
 * the time it has to come round and open (clip time 0 to UNITY_ROPE_BACKFLIP_OPEN). With no `airSeconds` that is
 * the source clip's own pace. Given the leap's time in the air it is fitted to it: the source flip takes a second
 * to come round, twice what any leap off a rope has, so at its own pace it was always cut off upside down by the
 * ground. Fitted, it is open with a seventh of the air still to come.
 */
export function unityRopeReleaseDuration(charge: number, airSeconds?: number): number {
  if (!unityRopeLeapFlips(charge)) return 0;
  const source = UNITY_ROPE_TIMING.backflipReleaseDuration * UNITY_ROPE_BACKFLIP_OPEN;
  if (airSeconds === undefined || !(airSeconds > 0)) return source;
  return Math.min(source, Math.max(0.42, airSeconds * (1 - UNITY_ROPE_BACKFLIP_SPARE)));
}
import {
  UNITY_ROPE_CLIMB_DURATION,
  UNITY_ROPE_HANG_DURATION,
  UNITY_ROPE_RELEASE_BACKFLIP_DURATION,
  UNITY_ROPE_RELEASE_SWING_DURATION,
} from './unityRopeAnimations.generated';
