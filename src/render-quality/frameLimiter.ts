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
  private lastTimestampMs: number | null = null;
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
    if (this.lastTimestampMs === null) {
      this.lastTimestampMs = nowMs;
      this.acceptedFrames += 1;
      return true;
    }
    const elapsed = Math.max(0, nowMs - this.lastTimestampMs);
    this.lastTimestampMs = nowMs;
    const interval = 1000 / this.targetFps;
    // A stalled callback has missed presentation deadlines. Start a fresh
    // cadence now instead of spending the missed time on a burst of frames.
    if (elapsed >= interval * 2) {
      this.budgetMs = 0;
      this.acceptedFrames += 1;
      return true;
    }
    this.budgetMs += elapsed;
    // Timestamp quantization and display-clock jitter must not turn a 60 Hz
    // display into alternating held/catch-up frames. Early admission borrows
    // time from the NEXT frame, preserving the long-run cap on faster panels.
    const tolerance = Math.min(2.1, interval / 8);
    if (this.budgetMs < interval - tolerance) {
      this.skippedFrames += 1;
      return false;
    }
    // Preserve phase across normal callbacks, including a negative early-frame
    // balance. Modulo would discard a whole deadline when a slightly slower
    // 59.94 Hz clock accumulates one interval and introduce an avoidable hitch.
    // Retain at most one interval when the display cannot meet the target.
    this.budgetMs = Math.min(this.budgetMs - interval, interval);
    this.acceptedFrames += 1;
    return true;
  }

  reset(): void {
    this.lastTimestampMs = null;
    this.budgetMs = 0;
    this.acceptedFrames = 0;
    this.skippedFrames = 0;
  }

  get stats(): Readonly<PresentationFrameLimiterStats> {
    return Object.freeze({
      acceptedFrames: this.acceptedFrames,
      skippedFrames: this.skippedFrames,
      targetFps: this.targetFps,
      lastTimestampMs: this.lastTimestampMs ?? 0,
      budgetMs: this.budgetMs,
    });
  }
}
