import * as THREE from 'three';
import { GameFlowVortexHost } from './gameFlowVortex';
import { PresentationFrameLimiter } from './render-quality/frameLimiter';
import { CrtGuestPass } from './crt-guest/pass';
import { CrtGuestOutputPass } from './crt-guest/output';
import { CrtGuestSettings } from './crt-guest/settings';
import { loadCrtGuestLuts, disposeCrtGuestLuts, type CrtGuestLuts } from './crt-guest/luts';
import type { LoadingVortexConfig, LoadingVortexRequest, LoadingVortexResponse } from './loadingVortexProtocol';

// Transferred canvas presentation does not require main-thread RAF, bitmap
// messages or GPU readbacks. Only sparse diagnostics return to the page.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<LoadingVortexRequest>) => void) | null;
  postMessage(message: LoadingVortexResponse): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(id: number): void;
  close(): void;
};
let renderer: THREE.WebGLRenderer | null = null;
let vortex: GameFlowVortexHost | null = null;
let source: THREE.WebGLRenderTarget | null = null;
let crt: CrtGuestPass | null = null;
let output: CrtGuestOutputPass | null = null;
let luts: CrtGuestLuts | null = null;
let config: LoadingVortexConfig;
let disposed = false, initialized = false;
let raf = 0, previous = 0, frames = 0, maxFrameMs = 0, reportAt = 0;
const limiter = new PresentationFrameLimiter(60);
const settings = new CrtGuestSettings({ storage: null, persistChanges: false });
const post = (message: LoadingVortexResponse): void => scope.postMessage(message);

async function start(canvas: OffscreenCanvas, initial: LoadingVortexConfig): Promise<void> {
  if (typeof scope.requestAnimationFrame !== 'function') throw new Error('Worker animation frames unavailable');
  config = initial;
  const context = canvas.getContext('webgl2', { alpha: false, antialias: config.antialias, powerPreference: 'low-power' });
  if (!context) throw new Error('Worker WebGL unavailable');
  renderer = new THREE.WebGLRenderer({ canvas, context, antialias: config.antialias });
  canvas.addEventListener('webglcontextlost', () => { if (!disposed) fail('Loading graphics context lost'); });
  // This worker owns reduced motion by stopping its loop, preserving the last
  // field pose when the preference changes instead of rebuilding the artwork.
  vortex = new GameFlowVortexHost(false);
  const titleReady = vortex.prepareLoadingTitle(config.context, config.titleAtlasUrl);
  settings.importJson(config.crt);
  if (config.post) {
    source = new THREE.WebGLRenderTarget(config.inputWidth, config.inputHeight, { type: THREE.HalfFloatType });
    source.texture.name = 'Loading worker pre-CRT field';
    crt = new CrtGuestPass(renderer, settings, { deferOutput: true, deferDeconvergence: true,
      sourceWidth: config.inputWidth, sourceHeight: config.inputHeight,
      outputWidth: config.outputWidth, outputHeight: config.outputHeight });
    if (settings.enabled) {
      const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
      const loaded = await loadCrtGuestLuts(config.lutBaseUrl, {
        loadAsync: async url => new THREE.Texture(await loader.loadAsync(url)),
      });
      if (disposed) { releaseLuts(loaded); return; }
      luts = loaded;
      crt.setLuts(luts);
    }
    output = new CrtGuestOutputPass(() => crt?.deferredOutput ?? null, () => crt?.deferredDeconvergence ?? null);
    output.renderToScreen = true;
  }
  await titleReady;
  if (disposed) return;
  resize(config);
  draw(0, performance.now());
  // A completed GPU fence, followed by a worker frame, establishes the surface
  // before the main thread starts synchronous destination construction.
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  if (fence) {
    try {
      while (!disposed && !gl.isContextLost()) {
        const status = gl.clientWaitSync(fence, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED || status === gl.WAIT_FAILED) break;
        await new Promise(resolve => setTimeout(resolve, 8));
      }
    } finally { gl.deleteSync(fence); }
  }
  if (disposed) return;
  initialized = true;
  post({ type: 'ready' });
  report();
  schedule();
}

function resize(next: LoadingVortexConfig): void {
  const titleChanged = config.titleAtlasUrl !== next.titleAtlasUrl || config.context !== next.context;
  config = next;
  if (!renderer) return;
  renderer.setSize(config.outputWidth, config.outputHeight, false);
  source?.setSize(config.inputWidth, config.inputHeight);
  crt?.setResolution(config.inputWidth, config.inputHeight, config.outputWidth, config.outputHeight);
  settings.importJson(config.crt);
  vortex?.invalidate();
  if (titleChanged) void vortex?.prepareLoadingTitle(config.context, config.titleAtlasUrl).then(() => {
    if (initialized && !disposed) { draw(0, performance.now()); report(); }
  });
  if (initialized) { draw(0, performance.now()); report(); schedule(); }
}

function draw(dt: number, now: number): void {
  if (!renderer || !vortex || disposed) return;
  vortex.render(renderer, dt, now, config.context, source, true);
  if (source && output) {
    if (crt?.active) crt.render(renderer, source, source, dt, false);
    renderer.setRenderTarget(null);
    output.render(renderer, source, source, dt, false);
  }
  frames++;
}

function schedule(): void {
  if (!raf && initialized && !disposed && !config.hidden && !config.reducedMotion) raf = scope.requestAnimationFrame(frame);
}

function frame(now: number): void {
  raf = 0;
  if (disposed || config.hidden || config.reducedMotion) return;
  try {
    if (limiter.allow(now, true)) {
      const elapsed = previous ? now - previous : 0;
      maxFrameMs = Math.max(maxFrameMs, elapsed);
      previous = now;
      draw(Math.min(.1, elapsed / 1000), now);
      if (now - reportAt >= 500) { reportAt = now; report(); }
    }
    schedule();
  } catch (error) { fail(String(error)); }
}

function report(): void {
  post({ type: 'stats', at: performance.timeOrigin + performance.now(), frames, maxFrameMs,
    width: config.outputWidth, height: config.outputHeight, title: vortex?.diagnostics.loadingTitle ?? null });
}

function releaseLuts(value: CrtGuestLuts): void {
  disposeCrtGuestLuts(value);
  for (const texture of Object.values(value)) (texture.image as ImageBitmap)?.close?.();
}

function dispose(): void {
  if (disposed) return;
  disposed = true;
  if (raf) scope.cancelAnimationFrame(raf);
  vortex?.dispose(); source?.dispose(); crt?.dispose(); output?.dispose();
  if (luts) releaseLuts(luts);
  renderer?.dispose(); renderer?.forceContextLoss();
}

function fail(reason: string): void { post({ type: 'failed', reason }); dispose(); }

scope.onmessage = ({ data }) => {
  try {
    if (data.type === 'start') void start(data.canvas, data.config).catch(error => fail(String(error)));
    else if (data.type === 'dispose') { dispose(); post({ type: 'disposed' }); scope.close(); }
    else if (data.type === 'resize') resize(data.config);
    else if (data.type === 'visibility') {
      config.hidden = data.hidden;
      previous = 0; limiter.reset();
      if (raf) scope.cancelAnimationFrame(raf);
      raf = 0; schedule();
    }
  } catch (error) { fail(String(error)); }
};
