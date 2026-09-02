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
  attachedBlend: 6 / 60,
  releaseBlend: 5 / 60,
});

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function unityRopeReleaseDuration(charge: number): number {
  const weight = clamp01(charge);
  return UNITY_ROPE_TIMING.swingReleaseDuration * (1 - weight) +
    UNITY_ROPE_TIMING.backflipReleaseDuration * weight;
}
import {
  UNITY_ROPE_CLIMB_DURATION,
  UNITY_ROPE_HANG_DURATION,
  UNITY_ROPE_RELEASE_BACKFLIP_DURATION,
  UNITY_ROPE_RELEASE_SWING_DURATION,
} from './unityRopeAnimations.generated';
