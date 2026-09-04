import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createServer } from 'vite';

// These recordings reproduce returning to foot movement after a board air.
// Keep the real Player and published courses; stub only browser/asset services.
const noop = () => {};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
const context = new Proxy({
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  createPattern: () => ({}),
  measureText: (text) => ({ width: text.length * 8 }),
  createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
  getImageData: (_x, _y, width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
}, { get: (target, key) => key in target ? target[key] : noop });
function element(tag = 'div') {
  return {
    tagName: tag.toUpperCase(), style: {}, children: [], width: 1, height: 1,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    addEventListener: noop, removeEventListener: noop, setAttribute: noop, remove: noop,
    appendChild(child) { this.children.push(child); return child; },
    append(...children) { this.children.push(...children); },
    getContext() { context.canvas = this; return context; },
  };
}
globalThis.document = { body: element('body'), fonts: null, createElement: element,
  createElementNS: (_ns, tag) => element(tag) };
globalThis.window = { location: { search: '?lite', href: 'http://headless.invalid/?lite' },
  devicePixelRatio: 1, addEventListener: noop, removeEventListener: noop };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [] } });
globalThis.Image = class {
  addEventListener(type, callback) { if (type === 'error') queueMicrotask(callback); }
  removeEventListener() {}
  set src(_value) { queueMicrotask(() => this.onerror?.(new Error('headless image'))); }
};
const NativeRequest = globalThis.Request;
globalThis.Request = class extends NativeRequest {
  constructor(input, init) {
    super(typeof input === 'string' && input.startsWith('/') ? `http://headless.invalid${input}` : input, init);
  }
};
globalThis.fetch = async () => new Response('', { status: 404 });
const originalWarn = console.warn;
const originalError = console.error;
const expectedAssetLog = (value) => /mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value));
console.warn = (...args) => { if (!expectedAssetLog(args[0])) originalWarn(...args); };
console.error = (...args) => { if (!expectedAssetLog(args[0])) originalError(...args); };

const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { Level, findLevel, setUserLevels } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { swirls } = await server.ssrLoadModule('/src/swirls.ts');
  const published = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  setUserLevels(published.levels ?? published);
  for (const name of ['test-course', 'slipstream']) {
    const replay = JSON.parse(await readFile(new URL(`./fixtures/locomotion-${name}-replay.json`, import.meta.url), 'utf8'));
    const entry = findLevel(replay.level);
    const level = new Level(new THREE.Scene(), entry);
    const player = new Player(level.scene);
    // Lock the collision silhouette used to establish these historical hashes.
    player.setCharacterHeadStyle('skull');
    player.setCharacterProportions({ headSize: 1.55, neckLength: 0 });
    player.enterLevel(entry.id);
    player.endlessDeaths = replay.endlessDeaths === true;
    player.respawn(level, true);
    const input = { moveX: 0, moveY: 0, consumeEdges: noop };
    const replayer = new Replayer();
    replayer.begin(replay);
    let recoveredRunFrames = 0;
    let boardAirFrames = 0;
    let slowWalkFrames = 0;
    const movement = createHash('sha256');
    try {
      for (let frame = 0; frame < replay.frames; frame++) {
        assert.ok(replayer.feed(input, player.camDir));
        player.step(CONST.fixedStep, input, level);
        level.update(CONST.fixedStep);
        player.flushLevelCrateRewards(level);
        player.commitRenderStep(level);
        movement.update(JSON.stringify([player.state, player.grounded, player.freeSkate,
          ...player.pos.toArray(), player.speed, player.vVel, ...player.walkVelocity.toArray(),
          player.cratesBroken, player.fruit, player.lives]));
        const intent = player.animationIntent;
        const { normalizedSpeed, inputs } = intent.motion;
        if (intent.clipId === 'player.run' && player.grounded && !player.freeSkate) {
          const expected = Math.min(1, player.walkVelocity.length() / TUNING.walkSpeed);
          assert.ok(Math.abs(normalizedSpeed - expected) < 1e-10,
            `${name} frame ${frame}: on-foot animation uses the wrong speed range`);
          if (player.airFromSkate && expected >= .99) {
            recoveredRunFrames++;
            assert.ok(inputs.locomotionWalkBlend < .02,
              `${name} frame ${frame}: running after board air is stuck in Walk`);
          }
          if (expected > 0 && expected <= 1 / 3) {
            slowWalkFrames++;
            assert.equal(inputs.locomotionWalkBlend, 1, 'slow movement lost the Walk endpoint');
          }
        }
        if (player.state === 'air' && player.airFromSkate &&
            intent.clipId !== 'player.crawl' && intent.clipId !== 'player.crouch') {
          boardAirFrames++;
          const expected = Math.min(1, player.animationPlanarSpeed / TUNING.maxSpeed);
          assert.ok(Math.abs(normalizedSpeed - expected) < 1e-10,
            `${name} frame ${frame}: board air lost its original speed range`);
        }
      }
      assert.ok(recoveredRunFrames > 300, `${name}: replay missed the reported grounded recovery`);
      assert.ok(boardAirFrames > 60, `${name}: replay did not exercise board airs`);
      assert.ok(slowWalkFrames > 0, `${name}: replay did not exercise slow walking`);
      console.log(`${name}: ${recoveredRunFrames} recovered run frames, ${boardAirFrames} board air frames; movement ${movement.digest('hex')}`);
    } finally {
      replayer.end(); level.dispose(); swirls.clear();
    }
  }
} finally {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await server.close();
  console.warn = originalWarn; console.error = originalError;
}
