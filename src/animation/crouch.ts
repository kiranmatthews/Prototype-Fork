/** Stable gameplay routes for the Quaternius low poses. */
export const CROUCH_CLIP_IDS = {
  enter: 'player.crouch-enter',
  idle: 'player.crouch',
  move: 'player.crawl',
  exit: 'player.crouch-exit',
} as const;

export const QUATERNIUS_LOW_POSE_OWNERSHIP = 'quaternius-crouch-source-v1';
export const CROUCH_TRANSITION_DURATION = 5 / 60;
export const QUATERNIUS_CRAWL_PALMS = 'flat-down-after-wrist-rest-v1';
