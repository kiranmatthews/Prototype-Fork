import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const noop = () => {};
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const context = new Proxy({
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  getImageData: (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createPattern: () => ({}), measureText: text => ({ width: String(text).length * 8 }),
}, { get: (target, key) => key in target ? target[key] : noop });
const element = () => ({
  style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  addEventListener: noop, removeEventListener: noop, setAttribute: noop,
  append: noop, appendChild: child => child, remove: noop, getContext: () => context,
});
globalThis.document = { body: element(), fonts: null, createElement: element, createElementNS: element };
globalThis.window = { location: { search: '?lite', href: 'http://headless.invalid/?lite' }, addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1 };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
globalThis.Image = class {
  addEventListener(type, callback) { if (type === 'error') queueMicrotask(callback); }
  removeEventListener() {}
  set src(_value) { queueMicrotask(() => this.onerror?.(new Error('headless image'))); }
};
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input, init) { super(typeof input === 'string' && input.startsWith('/') ? `http://headless.invalid${input}` : input, init); }
};
globalThis.fetch = async () => new Response('', { status: 404 });
const originalWarn = console.warn, originalError = console.error;
const assetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!assetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!assetLog(args[0])) originalError(...args); };

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });


try {
 const {Level,findLevel}=await server.ssrLoadModule('/src/level.ts');
 const {CAMPAIGN_LEVELS}=await server.ssrLoadModule('/src/campaign.ts');
 const report=[];
 for(const entry of CAMPAIGN_LEVELS.filter(e=>!e.competition)){
  const definition=findLevel(entry.levelId)??findLevel(entry.fallbackLevelId);if(!definition){report.push({id:entry.levelId,requiresPublishedSnapshot:true});continue;}
  const level=new Level(new THREE.Scene(),definition);
  const platform=level.bonusPlatformDiagnostics;
  report.push({id:entry.levelId,platform});
  if(!platform){level.dispose();continue;}
  assert.ok(Math.abs(platform.topY-platform.y-1.05)<1e-6);
  const back=level.bonusReturnPoint(),ground=level.bonusRouteGroundY(back.x,back.z,back.y);
  assert.ok(ground!==null&&Math.abs(back.y-ground-.1)<.05,entry.levelId+' return has no supported ground');
  level.dispose();
 }
 console.log(JSON.stringify(report));
 assert.deepEqual(report.filter(r=>r.platform===null).map(r=>r.id),[],'Campaigns without a supported side bonus site');
}finally{await server.close();}
