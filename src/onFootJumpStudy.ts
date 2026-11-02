/** Optional per-player experiment. No global tuning or skateboard values. */
export interface OnFootJumpStudy {
  readonly gravity: number;
  readonly minimumHeight: number;
  readonly maximumHeight: number;
  readonly doubleHeight: number;
  readonly steeringSeconds: number;
  readonly coastSeconds: number;
}

/** Compensate half a fixed step for this controller's semi-implicit integrator. */
export function studyJumpVelocity(height: number, gravity: number, dt: number): number {
  return Math.sqrt(2 * gravity * height) + gravity * dt * .5;
}
