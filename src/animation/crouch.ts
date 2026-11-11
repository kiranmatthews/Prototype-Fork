/** Stable gameplay routes for the Quaternius low poses. */
export const CROUCH_CLIP_IDS = {
  enter: 'player.crouch-enter',
  idle: 'player.crouch',
  move: 'player.crawl',
  exit: 'player.crouch-exit',
} as const;

export const QUATERNIUS_LOW_POSE_OWNERSHIP = 'quaternius-crouch-source-v1';
export const CROUCH_TRANSITION_DURATION = 5 / 60;
/** Metres the body travels in one full crawl cycle. The clip is an arm pull:
 * each hand is on the floor for 0.6 of a cycle and, measured through that
 * time, moves back under him at 0.9 m a cycle (0.6 to 1.2 as the pull
 * surges). The knees and toes are dragged, so the hands set this: at 0.9 m a
 * planted hand stays where it came down to within a few centimetres. The
 * crawl's clock runs on distance, so this is the one number that ties how
 * fast it plays to how fast it moves, at any `crawlSpeed`. */
export const CRAWL_STRIDE_METRES = .9;
export const QUATERNIUS_CRAWL_PALMS = 'flat-down-after-wrist-rest-v1';
