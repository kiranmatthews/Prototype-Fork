/** D presentation timing; movement tuning still owns the base mantle time. */
export const JAK_LEDGE_MOTION = {
  catchTimeScale: 1.25,
  climbTimeScale: 1.55,
  climbRecoverySeconds: .34,
} as const;

/** One compression, rebound and settle, with zero value/velocity at both ends. */
export function ledgeRebound(phase: number): number {
  if (phase <= 0 || phase >= 1) return 0;
  return -2 * Math.sin(phase * Math.PI * 2) * Math.sin(phase * Math.PI) ** 2 * (1 - phase);
}
