/** A readable landing, then an accelerating upward warp. Presentation only. */
export const BONUS_LANDING_HOLD = 0.65;
export const BONUS_WARP_RISE = 0.5;

export function bonusDeparturePose(elapsed: number, reducedMotion = false) {
  const rise = Math.max(0, Math.min(1, (elapsed - BONUS_LANDING_HOLD) / BONUS_WARP_RISE));
  return {
    phase: elapsed < BONUS_LANDING_HOLD ? 'landing' : 'rising',
    offsetY: reducedMotion ? 0 : 7 * rise * rise * rise,
    complete: elapsed >= BONUS_LANDING_HOLD + (reducedMotion ? 0 : BONUS_WARP_RISE),
  };
}
