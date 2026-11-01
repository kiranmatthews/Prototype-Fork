import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const nodes = new Set(), listeners = new Set(), workers = [];
const timers = new Map(); let timerId = 0;
const originals = Object.fromEntries(['document', 'HTMLCanvasElement', 'Worker', 'setTimeout', 'clearTimeout'].map(k => [k, globalThis[k]]));
class Canvas {
  style = {}; hidden = false; classList = { add() {} };
  setAttribute() {} remove() { nodes.delete(this); }
  transferControlToOffscreen() { return {}; }
}
class Worker {
  sent = []; terminated = false;
  constructor() { workers.push(this); }
  postMessage(message) { this.sent.push(message); }
  terminate() { this.terminated = true; }
  emit(data) { this.onmessage?.({ data }); }
}
try {
  globalThis.document = { hidden: false, createElement: () => new Canvas(), body: { append: node => nodes.add(node) },
    addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) };
  globalThis.HTMLCanvasElement = Canvas; globalThis.Worker = Worker;
  globalThis.setTimeout = callback => { timers.set(++timerId, callback); return timerId; };
  globalThis.clearTimeout = id => timers.delete(id);
  const { LoadingVortexPresentation } = await server.ssrLoadModule('/src/loadingVortex.ts');
  const config = () => ({ inputWidth: 640, inputHeight: 360, outputWidth: 1280, outputHeight: 720 });
  const host = new LoadingVortexPresentation(config);
  const ready = host.prepare(); assert.equal(host.prepare(), ready); assert.equal(workers.length, 1);
  workers[0].emit({ type: 'ready' }); assert.equal(await ready, true); assert.equal(host.active, true);
  assert.equal(timers.size, 0, 'Ready must cancel the startup timeout');
  assert.equal(nodes.size, 1); host.resize(); assert.equal(workers[0].sent.at(-1).type, 'resize');
  host.release(); assert.equal(host.active, false); assert.equal(host.diagnostics.resident, false);
  assert.equal(nodes.size, 0); assert.equal(listeners.size, 0);
  assert.equal(workers[0].sent.at(-1).type, 'dispose');
  workers[0].emit({ type: 'disposed' }); assert.equal(workers[0].terminated, true); assert.equal(timers.size, 0);
  host.release(); assert.equal(host.diagnostics.stops, 1, 'Release must be idempotent');

  const cancelled = host.prepare(), worker = workers.at(-1);
  host.release(); assert.equal(await cancelled, false);
  worker.emit({ type: 'ready' }); assert.equal(host.active, false, 'A late ready message must not resurrect cancelled loading');
  worker.emit({ type: 'disposed' });

  const failed = new LoadingVortexPresentation(config), pending = failed.prepare(), failingWorker = workers.at(-1);
  failingWorker.emit({ type: 'failed', reason: 'WebGL unavailable' });
  assert.equal(await pending, false); assert.equal(await failed.prepare(), false);
  assert.equal(nodes.size, 0); assert.equal(listeners.size, 0); failingWorker.emit({ type: 'disposed' });

  const live = new LoadingVortexPresentation(config), starting = live.prepare(), liveWorker = workers.at(-1);
  liveWorker.emit({ type: 'ready' }); await starting;
  liveWorker.emit({ type: 'failed', reason: 'Context lost during preparation' });
  assert.equal(live.active, true, 'A failure must retain opaque coverage until destination readiness');
  assert.equal(live.diagnostics.resident, false); assert.equal(nodes.size, 1);
  liveWorker.emit({ type: 'disposed' }); live.release(); assert.equal(nodes.size, 0);
  assert.equal(await live.prepare(), false, 'Later loads must use the supported fallback');

  const timeout = new LoadingVortexPresentation(config), waiting = timeout.prepare(), timedWorker = workers.at(-1);
  const [id, expire] = [...timers.entries()][0]; timers.delete(id); expire();
  assert.equal(await waiting, false); assert.equal(timeout.active, false); timedWorker.emit({ type: 'disposed' });
  assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
  console.log('PASS loading worker readiness, reuse, cancellation, timeout, failure coverage and resource release');
} finally {
  for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  await server.close();
}
