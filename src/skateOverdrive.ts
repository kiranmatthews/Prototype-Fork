/** Extra speed is earned, not a change to the normal push/drag tuning. */
export const SKATE_OVERDRIVE = Object.freeze({ extraSpeed: 10, interval: 0.25, fraction: 0.01 });
let legacyReplay = false;
export function setLegacySkateOverdriveReplay(value: boolean): void { legacyReplay = value; }

export class SkateOverdrive {
  private extra = 0;
  private held = 0;

  reset(): void { this.extra = this.held = 0; }
  interrupt(): void { this.held = 0; }
  ceiling(base: number): number { return !legacyReplay && this.extra > 0 ? base + this.extra : 0; }

  /** A real boost can enter the band immediately, retaining its original impulse. */
  boost(speed: number, base: number): void {
    if (!legacyReplay) this.extra = Math.max(this.extra, Math.min(SKATE_OVERDRIVE.extraSpeed, Math.max(0, speed - base)));
  }

  /** Lost momentum cannot be banked and recovered at the ordinary push rate. */
  retain(speed: number, base: number): void {
    const remaining = legacyReplay ? 0 : Math.min(this.extra, Math.max(0, speed - base));
    if (remaining < this.extra - 1e-7) this.interrupt();
    this.extra = remaining;
  }

  step(dt: number, speed: number, base: number, clearRun: boolean): number {
    this.retain(speed, base);
    if (legacyReplay || !clearRun || speed < base - 1e-7 || speed > base + this.extra + 1e-7) {
      this.interrupt();
      return speed;
    }
    this.held += Math.max(0, dt);
    // Four cheap multiply-adds a second: +0.1 initially, then 1% of the
    // remaining headroom each beat. No exponentials or frame allocations.
    while (this.held + 1e-9 >= SKATE_OVERDRIVE.interval) {
      this.held = Math.max(0, this.held - SKATE_OVERDRIVE.interval);
      speed += Math.max(0, base + SKATE_OVERDRIVE.extraSpeed - speed) * SKATE_OVERDRIVE.fraction;
      this.boost(speed, base);
    }
    return speed;
  }

  maintains(speed: number, base: number, clearRun: boolean): boolean {
    return !legacyReplay && clearRun && this.extra > 0 && speed >= base && speed <= base + this.extra + 1e-7;
  }
}
