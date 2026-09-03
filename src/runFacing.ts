const TAU = Math.PI * 2;

export const RUN_REVERSAL_DURATION = 0.4;
export const RUN_REVERSAL_YAW_RATE = Math.PI / RUN_REVERSAL_DURATION;

export function wrapFacingAngle(angle: number): number {
  return angle - TAU * Math.round(angle / TAU);
}

/**
 * Move through a yaw turn by a fixed angular step. At exactly 180 degrees the
 * shortest path is ambiguous, so `oppositeSign` chooses the visible spin
 * direction instead of letting floating-point noise flip it frame to frame.
 */
export function stepFacingYaw(
  current: number,
  target: number,
  maxStep: number,
  oppositeSign = -1,
): number {
  let delta = wrapFacingAngle(target - current);
  if (Math.abs(Math.abs(delta) - Math.PI) < 1e-6 && oppositeSign !== 0)
    delta = Math.sign(oppositeSign) * Math.PI;
  const step = Math.max(0, maxStep);
  if (Math.abs(delta) <= step) return wrapFacingAngle(target);
  return wrapFacingAngle(current + Math.sign(delta) * step);
}
