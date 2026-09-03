export const UNITY_CROUCH_CRAWL_CLIP_IDS = {
  walk: 'player.walk',
  crouch: 'player.crouch',
  crawl: 'player.crawl',
} as const;

export const UNITY_WALK_BLEND_INPUT = 'locomotionWalkBlend';

/** Unity's locomotion tree is Idle@0, Walk@3, Run@9. */
export function unityWalkBlendWeight(normalizedSpeed: number): number {
  const speed = Number.isFinite(normalizedSpeed)
    ? Math.max(0, Math.min(1, normalizedSpeed))
    : 0;
  const walkThreshold = 1 / 3;
  return 1 - Math.max(
    0,
    Math.min(1, (speed - walkThreshold) / (1 - walkThreshold)),
  );
}

/** Catalog contract used to disable the older parent-level crawl shaping only
 * when the playable clip actually contains the complete Unity low pose. */
export const UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP =
  'unity-crouch-crawl-source-v1';

export const UNITY_CROUCH_CRAWL_TIMING = Object.freeze({
  walkDuration: UNITY_WALK_DURATION,
  crouchDuration: UNITY_CROUCH_IDLE_DURATION,
  crawlDuration: UNITY_CRAWL_DURATION,
  rapidBlend: 5 / 60,
  floorLift:
    UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.unityFloorCorrection.stanceRootLiftMetres,
  sourceModelScale: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.unityModelPresentationScale,
});
import {
  UNITY_CRAWL_DURATION,
  UNITY_CROUCH_CRAWL_ANIMATION_SOURCE,
  UNITY_CROUCH_IDLE_DURATION,
  UNITY_WALK_DURATION,
} from './unityCrouchCrawlAnimations.generated';
