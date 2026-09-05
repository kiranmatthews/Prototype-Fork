/** Cosmetic time only: never contributes to movement or consumes gameplay RNG. */
export const ROO_BLINK_TIMING = Object.freeze({
  intervalMin: 2,
  intervalMax: 6,
  durationMin: 0.2,
  durationMax: 0.4,
  closeFraction: 0.34,
  holdFraction: 0.12,
});

const smooth = (x: number): number => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

export function rooBlinkAmount(time: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(time)) return 0;
  const phase = time / duration;
  if (phase < 0 || phase >= 1) return 0;
  const close = ROO_BLINK_TIMING.closeFraction;
  const reopen = close + ROO_BLINK_TIMING.holdFraction;
  if (phase < close) return smooth(phase / close);
  if (phase < reopen) return 1;
  return 1 - smooth((phase - reopen) / (1 - reopen));
}

let fallbackSeed = 0;
export function createRooBlinkRandom(): () => number {
  const seed = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(seed);
  else seed[0] = (Date.now() ^ ++fallbackSeed * 0x9e3779b9) >>> 0;
  let state = seed[0] || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

export class RooBlinkClock {
  private remaining: number;
  private elapsed = 0;
  private enabled = true;
  private blinking = false;
  duration = 0;
  amount = 0;
  started = 0;
  completed = 0;
  interval: number;

  constructor(private readonly random = createRooBlinkRandom()) {
    this.interval = this.sample(ROO_BLINK_TIMING.intervalMin, ROO_BLINK_TIMING.intervalMax);
    this.remaining = this.interval;
  }

  private sample(min: number, max: number): number {
    const value = this.random();
    return min + (max - min) * (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5);
  }

  private wait(): void {
    this.blinking = false;
    this.elapsed = this.amount = 0;
    this.interval = this.sample(ROO_BLINK_TIMING.intervalMin, ROO_BLINK_TIMING.intervalMax);
    this.remaining = this.interval;
  }

  reset(): void { this.wait(); }

  step(dt: number, active = true): number {
    if (!active) {
      if (this.enabled) this.wait();
      this.enabled = false;
      return this.amount;
    }
    this.enabled = true;
    if (!Number.isFinite(dt) || dt <= 0) return this.amount;
    // A suspended tab never fast-forwards a backlog of blinks on return.
    if (dt > 0.5) { this.wait(); return 0; }
    let left = dt;
    while (left > 1e-10) {
      if (!this.blinking) {
        const consumed = Math.min(left, this.remaining);
        this.remaining -= consumed;
        left -= consumed;
        if (this.remaining > 1e-10) break;
        this.blinking = true;
        this.elapsed = 0;
        this.duration = this.sample(ROO_BLINK_TIMING.durationMin, ROO_BLINK_TIMING.durationMax);
        this.started++;
      } else {
        const consumed = Math.min(left, this.duration - this.elapsed);
        this.elapsed += consumed;
        left -= consumed;
        if (this.elapsed >= this.duration - 1e-10) {
          this.completed++;
          this.wait();
        }
      }
    }
    this.amount = this.blinking ? rooBlinkAmount(this.elapsed, this.duration) : 0;
    return this.amount;
  }

  get diagnostics() {
    return { amount: this.amount, phase: this.blinking ? 'blink' : 'waiting',
      nextBlinkIn: this.blinking ? 0 : this.remaining, interval: this.interval,
      duration: this.duration, started: this.started, completed: this.completed };
  }
}
