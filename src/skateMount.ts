export const SKATE_MOUNT_TIMING = Object.freeze({
  airTime: 0.3,
  settleTime: 0.14,
  height: 0.28,
});

export interface SkateMountPose {
  /** Presentation-only vertical lift in world metres. */
  lift: number;
  tuck: number;
  settle: number;
}

const REST: Readonly<SkateMountPose> = Object.freeze({ lift: 0, tuck: 0, settle: 0 });
export const SKATE_MOUNT_DURATION = SKATE_MOUNT_TIMING.airTime + SKATE_MOUNT_TIMING.settleTime;

/** A committed mount rises briskly from the loaded crouch, folds slightly in
 * the air, then absorbs the landing. No root motion enters the simulation. */
export function sampleSkateMount(seconds: number): Readonly<SkateMountPose> {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= SKATE_MOUNT_DURATION) return REST;
  if (seconds < SKATE_MOUNT_TIMING.airTime) {
    const u = seconds / SKATE_MOUNT_TIMING.airTime;
    return {
      lift: SKATE_MOUNT_TIMING.height * 4 * u * (1 - u),
      tuck: Math.sin(Math.PI * u) ** 2,
      settle: 0,
    };
  }
  const u = (seconds - SKATE_MOUNT_TIMING.airTime) / SKATE_MOUNT_TIMING.settleTime;
  return { lift: 0, tuck: 0, settle: Math.sin(Math.PI * u) ** 2 };
}
