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
  const { EASY_BONUS_LEVEL: data, DEFAULT_BONUS_CRATE_COUNT: count } = await server.ssrLoadModule('/src/levels/bonus-easy.ts');
  const { BONUS_LEVEL: original } = await server.ssrLoadModule('/src/levels/bonus-level.ts');
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { BonusPayout } = await server.ssrLoadModule('/src/bonusPayout.ts');
  const { mergeCompletedBonusInventory } = await server.ssrLoadModule('/src/campaign.ts');
  assert.equal(count, 18);
  assert.equal(original.components.filter(c => c.t === 'crate').length, 34, 'original challenge was overwritten');
  assert.equal(findLevel('bonus-easy').data, data);
  assert.equal(data.hudMode, 'bonus');
  assert.equal(data.components.filter(c => c.t === 'gate').length, 1);
  assert.ok(data.components.some(c => c.t === 'zone' && c.dir === 'E'));
  assert.ok(data.components.every(c => !['mover', 'rail', 'crusher', 'enemy', 'crumble'].includes(c.t)));
  assert.ok(data.components.every(c => !['nitro', 'tnt'].includes(c.kind)));
  const level = new Level(new THREE.Scene(), { id: 'bonus-easy', name: data.name, data });
  assert.equal(level.totalCrates, count);
  const supports = level.groundMeshes.filter(mesh => !mesh.userData.finishPad);
  for (const crate of data.components.filter(c => c.t === 'crate')) {
    const ray = new THREE.Raycaster(new THREE.Vector3(crate.p[0], crate.p[1] + 0.1, 0), new THREE.Vector3(0, -1, 0), 0, 4);
    assert.ok(ray.intersectObjects(supports, false).length, 'a reward depends on a destructible bridge');
  }
  const player = new Player(level.scene);
  player.respawn(level, true);
  for (const hard of [false, true]) {
    assert.ok(level.discardedBoards.spawn(player.boardG));
    assert.equal(level.discardedBoards.diagnostics.active, 1);
    player.respawn(level, hard, true);
    assert.equal(level.discardedBoards.diagnostics.active, 0, 'respawn retained an awake discard');
    assert.equal(level.discardedBoards.root.children.length, 0, 'respawn retained board art');
  }
  player.shadowGroundY = 900;
  const spawnBefore = player.pos.toArray();
  player.prepareStartPresentation(level);
  assert.equal(player.groundBelowY, 0, 'bonus first-frame camera retained the parent floor');
  assert.deepEqual(player.pos.toArray(), spawnBefore, 'camera preparation changed physics');
  player.masks = 2; player.uberTimer = 4;
  const state = player.captureRunState();
  assert.equal(state.uberTimer, 4);
  player.resumeSuspendedLevel(level, level.spawnPos, { ...state, masks: 1, uberTimer: 2 });
  assert.equal(player.masks, 1); assert.equal(player.uberTimer, 2, 'settling erased carried protection');
  const input = patch => Object.assign({ moveX: 0, moveY: 0, lookX: 0, lookY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false, spinHeld: false, spinPressed: false, grindHeld: false, grindPressed: false, grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false, restartPressed: false, consumeEdges: noop }, patch);
  for (const [x, y, landingX] of [[0.25, 0.04, 4.6], [18.7, 0.39, 22.6]]) {
    player.respawn(level, true);
    for (const crate of level.crates) { crate.alive = false; crate.mesh.visible = false; }
    player.pos.set(x, y, 0); player.settle(level);
    let airborne = false, landed = false;
    for (let frame = 0; frame < 180; frame++) {
      player.step(1 / 60, input({ moveX: 1, jumpPressed: frame === 0, jumpHeld: frame < 7, jumpReleased: frame === 7 }), level);
      level.update(1 / 60);
      airborne ||= !player.grounded;
      if (airborne && player.grounded && player.pos.x >= landingX) { landed = true; break; }
      if (player.state === 'dead') break;
    }
    assert.ok(landed, `ordinary short jump cannot cross easy gap from ${x}: ${player.pos.toArray()}, ${player.state}`);
  }
  level.dispose();
  const parent = { lives: 4, fruit: 90 }, bonus = { lives: 1, fruit: 25 };
  const actual = mergeCompletedBonusInventory(parent, bonus);
  assert.deepEqual(actual, { lives: 6, fruit: 15 });
  const payout = new BonusPayout(bonus.lives, bonus.fruit);
  assert.deepEqual(payout.update(actual, 0), parent, 'revealed totals did not begin at parent inventory');
  const middle = payout.update(actual, 1);
  assert.ok(middle.fruit !== 90 && middle.fruit !== 15);
  assert.equal(middle.lives, 5, '100-fruit rollover is not visible during payout');
  assert.deepEqual(payout.update(actual, 10), actual);
  assert.equal(payout.complete, true);
  const concurrent = new BonusPayout(1, 25);
  assert.deepEqual(concurrent.update({ lives: 5, fruit: 17 }, 0), { lives: 3, fruit: 92 }, 'live pickup/life loss was overwritten by payout');
  const { readFile } = await import('node:fs/promises');
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  for (const [name, next] of [['presentCampaignResults', 'showCampaignResults'], ['enterBonusRound', 'returnFromBonus'], ['returnFromBonus', 'checkCampaignEntrances']]) {
    const functionBody = main.slice(main.indexOf('function ' + name + '('), main.indexOf('function ' + next + '('));
    assert.match(functionBody, /vortex: false/, name + ' still has a loading vortex');
  }
  assert.match(main, /masks: player.masks/);
  assert.match(main, /player.masks = parentState.masks/);
  assert.match(main, /startBonusPayout\(bonusLives, bonusFruit\)/);
  console.log('PASS easier default bonus: permanent reward support, 2 real-Player short jumps, preserved original course, mask/uber carry, visible rollover-safe payout and black-only routing');
} finally {
  await server.close();
  console.warn = originalWarn; console.error = originalError;
}
