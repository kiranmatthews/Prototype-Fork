import type { LoadingVortexConfig, LoadingVortexRequest, LoadingVortexResponse } from './loadingVortexProtocol';
import type { LoadingTitleDiagnostics } from './loadingTitle';

/** A temporary loading surface. Title, menus and gameplay keep their renderer. */
export class LoadingVortexPresentation {
  private worker: Worker | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private pending: Promise<boolean> | null = null;
  private settle: ((ready: boolean) => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private ready = false;
  private disabled = false;
  private failure: string | null = null;
  private stats = { frames: 0, maxFrameMs: 0, width: 0, height: 0, title: null as LoadingTitleDiagnostics | null };
  private starts = 0;
  private stops = 0;

  constructor(private readonly config: () => LoadingVortexConfig) {}

  get active(): boolean { return this.ready; }
  get diagnostics() {
    return { active: this.active, resident: this.worker !== null, owner: 'loading-worker',
      starts: this.starts, stops: this.stops, failure: this.failure, ...this.stats, title: this.active ? this.stats.title : null };
  }

  prepare(): Promise<boolean> {
    if (this.ready) return Promise.resolve(true);
    if (this.pending) return this.pending;
    if (this.disabled || typeof Worker === 'undefined' ||
      !HTMLCanvasElement.prototype.transferControlToOffscreen) return Promise.resolve(false);
    const canvas = document.createElement('canvas');
    canvas.className = 'game-loading-motion';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    this.canvas = canvas;
    document.body.append(canvas);
    this.pending = new Promise(resolve => { this.settle = resolve; });
    const result = this.pending;
    try {
      const worker = new Worker(new URL('./loadingVortex.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      this.starts++;
      worker.onmessage = ({ data }: MessageEvent<LoadingVortexResponse>) => {
        if (this.worker !== worker) return;
        if (data.type === 'ready') {
          clearTimeout(this.timeout);
          this.ready = true;
          canvas.hidden = false;
          this.resolve(true);
        } else if (data.type === 'stats') {
          this.stats = { frames: data.frames, maxFrameMs: data.maxFrameMs, width: data.width, height: data.height, title: data.title };
        } else if (data.type === 'failed') this.fail(data.reason);
      };
      worker.onerror = event => { event.preventDefault(); this.fail(event.message || 'Loading worker unavailable'); };
      this.timeout = setTimeout(() => this.fail('Loading worker startup timed out'), 8000);
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: 'start', canvas: offscreen, config: this.config() } satisfies LoadingVortexRequest, [offscreen]);
      document.addEventListener('visibilitychange', this.visibility);
    } catch (error) { this.fail(String(error)); }
    return result;
  }

  resize(): void {
    this.worker?.postMessage({ type: 'resize', config: this.config() } satisfies LoadingVortexRequest);
  }

  reveal(): void { this.canvas?.classList.add('revealing'); }

  release(): void {
    clearTimeout(this.timeout);
    document.removeEventListener('visibilitychange', this.visibility);
    this.resolve(false);
    this.ready = false;
    this.canvas?.remove();
    this.canvas = null;
    const worker = this.worker;
    this.worker = null;
    if (!worker) return;
    this.stops++;
    // Let the worker explicitly dispose GPU objects/context. Termination is a
    // bounded fallback for a lost context or a worker that never initialized.
    const timeout = setTimeout(() => worker.terminate(), 1000);
    worker.onerror = () => { clearTimeout(timeout); worker.terminate(); };
    worker.onmessage = ({ data }: MessageEvent<LoadingVortexResponse>) => {
      if (data.type === 'disposed') { clearTimeout(timeout); worker.terminate(); }
    };
    worker.postMessage({ type: 'dispose' } satisfies LoadingVortexRequest);
  }

  private readonly visibility = (): void => {
    this.worker?.postMessage({ type: 'visibility', hidden: document.hidden } satisfies LoadingVortexRequest);
  };

  private resolve(value: boolean): void {
    this.settle?.(value);
    this.settle = null;
    this.pending = null;
  }

  private fail(reason: string): void {
    this.failure = reason;
    this.disabled = true;
    const covering = this.ready ? this.canvas : null;
    this.release();
    if (covering) {
      // A runtime failure must never uncover a half-prepared destination.
      // Keep the last pixels (or opaque backing after context loss) until the
      // same readiness gate fades this surface away. Future loads use fallback.
      this.canvas = covering;
      covering.style.backgroundColor = '#02030a';
      document.body.append(covering);
      this.ready = true;
    }
  }
}
