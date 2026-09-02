export const FORWARD_ROLL_TUCK_INPUT = 'forwardRollTuck';
export const FORWARD_ROLL_ROTATION_START = 0.15;
export const FORWARD_ROLL_ROTATION_SPAN = 0.65;
/** Multiplier before each rig control applies its hard 0.55 minimum. */
export const FORWARD_ROLL_SQUASH_MULTIPLIER = 0.3;

export interface ForwardRollPresentation {
  readonly progress: number;
  readonly rotationPhase: number;
  readonly tuck: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * One deterministic clock for the legacy waist rotation and authored
 * deformation layer. The body is fully inverted and maximally tucked at
 * progress 0.475: halfway through the active 15%..80% rotation window.
 */
export function sampleForwardRollPresentation(
  timeRemaining: number,
  duration: number,
  active = true,
): ForwardRollPresentation {
  if (!active || !(timeRemaining > 0) || !(duration > 0)) {
    return { progress: 0, rotationPhase: 0, tuck: 0 };
  }
  const progress = clamp01(1 - timeRemaining / duration);
  const rotationPhase = clamp01(
    (progress - FORWARD_ROLL_ROTATION_START) / FORWARD_ROLL_ROTATION_SPAN,
  );
  const tuck = rotationPhase > 0 && rotationPhase < 1
    ? Math.sin(rotationPhase * Math.PI)
    : 0;
  return { progress, rotationPhase, tuck };
}
