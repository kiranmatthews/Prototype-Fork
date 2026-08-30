export interface PresentationFrameLimiterStats {
  acceptedFrames: number;
  skippedFrames: number;
  targetFps: number;
  lastTimestampMs: number;
  budgetMs: number;
}

/**
 * requestAnimationFrame remains the clock source; this gate caps presentation
 * work without changing the deterministic simulation's fixed 60 Hz steps.
 */
export class PresentationFrameLimiter {
  private lastTimestampMs = 0;
  private budgetMs = 0;
  private acceptedFrames = 0;
  private skippedFrames = 0;

  constructor(readonly targetFps = 60) {
    if (!Number.isFinite(targetFps) || targetFps <= 0)
      throw new Error("Presentation FPS must be positive");
  }

  allow(nowMs: number, enabled: boolean): boolean {
    if (!enabled) {
      this.lastTimestampMs = nowMs;
      this.budgetMs = 0;
      this.acceptedFrames += 1;
      return true;
    }
    if (this.lastTimestampMs === 0) {
      this.lastTimestampMs = nowMs;
      this.acceptedFrames += 1;
      return true;
    }
    const elapsed = Math.min(250, Math.max(0, nowMs - this.lastTimestampMs));
    this.lastTimestampMs = nowMs;
    this.budgetMs += elapsed;
    const interval = 1000 / this.targetFps;
    // Avoid reducing nominal 59.94/60 Hz rAF to 30 because of sub-ms jitter.
    if (this.budgetMs < interval - 0.35) {
      this.skippedFrames += 1;
      return false;
    }
    // The tolerance can admit a timestamp fractionally below one interval;
    // modulo would leave that near-full budget intact and then admit every
    // subsequent high-refresh rAF. Consume it as a complete presentation.
    this.budgetMs =
      this.budgetMs >= interval ? this.budgetMs % interval : 0;
    this.acceptedFrames += 1;
    return true;
  }

  reset(): void {
    this.lastTimestampMs = 0;
    this.budgetMs = 0;
    this.acceptedFrames = 0;
    this.skippedFrames = 0;
  }

  get stats(): Readonly<PresentationFrameLimiterStats> {
    return Object.freeze({
      acceptedFrames: this.acceptedFrames,
      skippedFrames: this.skippedFrames,
      targetFps: this.targetFps,
      lastTimestampMs: this.lastTimestampMs,
      budgetMs: this.budgetMs,
    });
  }
}
