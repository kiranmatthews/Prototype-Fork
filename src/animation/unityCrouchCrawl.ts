export const UNITY_CROUCH_CRAWL_CLIP_IDS = {
  crouch: 'player.crouch',
  crawl: 'player.crawl',
} as const;

/** Catalog contract used to disable the older parent-level crawl shaping only
 * when the playable clip actually contains the complete Unity low pose. */
export const UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP =
  'unity-crouch-crawl-source-v1';

export const UNITY_CROUCH_CRAWL_TIMING = Object.freeze({
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
} from './unityCrouchCrawlAnimations.generated';
