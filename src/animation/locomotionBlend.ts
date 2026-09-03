export const PLAYER_WALK_CLIP_ID = 'player.walk';
export const LOCOMOTION_WALK_BLEND_INPUT = 'locomotionWalkBlend';

/** Quaternius locomotion ladder: Idle at 0, Walk through 3, Run at 9. */
export function locomotionWalkBlendWeight(normalizedSpeed: number): number {
  const speed = Number.isFinite(normalizedSpeed)
    ? Math.max(0, Math.min(1, normalizedSpeed))
    : 0;
  const walkThreshold = 1 / 3;
  return 1 - Math.max(
    0,
    Math.min(1, (speed - walkThreshold) / (1 - walkThreshold)),
  );
}
