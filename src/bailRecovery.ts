export interface BailRecoverySample {
  /** Monotonic 0..1 ownership of the forward revolution. */
  roll: number;
  /** Absolute waist-pivoted pitch. Ends at 2π so standing is exact. */
  forwardRoll: number;
  /** Compact knees-and-elbows phase that gets the body over its shoulders. */
  tuck: number;
  /** One-foot/one-hand plant used to push out of the roll. */
  plant: number;
  /** First running stride after the planted foot takes the body's weight. */
  stride: number;
  /** Small asymmetric shoulder bias; the recovery is forward, not a side roll. */
  shoulder: number;
  /** Automatic forward drive that turns the pose into real world movement. */
  drive: number;
}

export const BAIL_RECOVERY_SPRAWL_PITCH = 1.45;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function smoothRange(value: number, from: number, to: number): number {
  const u = clamp01((value - from) / Math.max(1e-6, to - from));
  return u * u * (3 - 2 * u);
}

function bell(value: number, from: number, to: number): number {
  return Math.sin(Math.PI * clamp01((value - from) / Math.max(1e-6, to - from)));
}

/**
 * Shared fixed-step/presentation curve for a wipeout recovery.
 *
 * The forward rotation completes early enough that the last third is already a
 * running stride. Every temporary offset returns to zero at both ends, while
 * the 2π roll itself is exactly upright at completion.
 */
export function sampleBailRecovery(progress: number): BailRecoverySample {
  const p = clamp01(progress);
  const roll = smoothRange(p, 0.02, 0.7);
  return {
    roll,
    forwardRoll:
      BAIL_RECOVERY_SPRAWL_PITCH +
      (Math.PI * 2 - BAIL_RECOVERY_SPRAWL_PITCH) * roll,
    tuck: bell(p, 0, 0.56),
    plant: bell(p, 0.24, 0.92),
    stride: bell(p, 0.56, 1),
    shoulder: bell(p, 0.04, 0.68),
    drive: smoothRange(p, 0.1, 0.84),
  };
}
