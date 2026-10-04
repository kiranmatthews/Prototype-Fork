/** Best-effort screen wake lock after a gameplay gesture, never at page load.
 * Availability/lifecycle changes release it; denied requests do not poll/retry
 * every frame. A later gesture or foreground transition may try again. */
export class TouchScreenAwake {
  private activated = false;
  private wanted = false;
  private epoch = 0;
  private pending = false;
  private sentinel: WakeLockSentinel | null = null;

  constructor(private getApi: () => WakeLock | undefined = () =>
    typeof navigator !== 'undefined' ? navigator.wakeLock : undefined) {}

  activate(available: boolean): void {
    this.activated = true;
    this.sync(available, true);
  }

  sync(available: boolean, retry = false): void {
    const wanted = this.activated && available;
    if (wanted !== this.wanted) {
      this.wanted = wanted; this.epoch++;
      if (!wanted) {
        const previous = this.sentinel; this.sentinel = null;
        if (previous) void previous.release().catch(() => {});
      } else this.request();
    } else if (retry && wanted && !this.sentinel) this.request();
  }

  get diagnostics() {
    return { activated: this.activated, wanted: this.wanted, pending: this.pending,
      held: this.sentinel !== null && !this.sentinel.released, supported: this.getApi() !== undefined };
  }

  private request(): void {
    const api = this.getApi();
    if (!api || this.pending || !this.wanted || this.sentinel) return;
    const epoch = this.epoch;
    this.pending = true;
    // A nonconforming implementation may throw synchronously. It must never
    // break pointer routing or require a permission/error overlay in the game.
    let request: Promise<WakeLockSentinel>;
    try { request = api.request('screen'); }
    catch { this.pending = false; return; }
    void request.then(sentinel => {
      if (epoch !== this.epoch || !this.wanted) {
        return sentinel.release().catch(() => {});
      }
      if (sentinel.released) return;
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      }, { once: true });
    }).catch(() => {
      // Battery/policy/unsupported contexts may deny the request. Try only
      // after another gesture or a genuine availability transition.
    }).finally(() => {
      this.pending = false;
      if (epoch !== this.epoch && this.wanted) this.request();
    });
  }
}
