/** Optional per-player experiment. No global tuning or skateboard values. */
export interface OnFootJumpStudy {
  readonly gravity: number;
  readonly minimumHeight: number;
  readonly maximumHeight: number;
  readonly doubleHeight: number;
  readonly steeringSeconds: number;
  readonly coastSeconds: number;
  readonly direct?: boolean;
  readonly runSpeed?: number;
}

/** Compensate half a fixed step for this controller's semi-implicit integrator. */
export function studyJumpVelocity(height: number, gravity: number, dt: number): number {
  return Math.sqrt(2 * gravity * height) + gravity * dt * .5;
}

/** Jak 1 stone-surface + walk/jump modifiers, in metres. The native collision
 * and special-surface solvers retain ownership; this is the flat foot thrust. */
export function jakFootThrust(speed: number, targetSpeed: number, forwardIntent: number, airborne: boolean): number {
  if (speed >= targetSpeed) return 37.5 * (airborne ? .2 : 1) * Math.max(1, speed / 1.25);
  return (37.5 + 25 * Math.max(0, -forwardIntent)) * (airborne ? .3 : 1);
}
