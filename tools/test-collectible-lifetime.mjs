import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const noop = () => {};
globalThis.localStorage = { getItem: () => null, setItem: noop };
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

function resources(group) {
  const owned = new Set(), borrowed = new Set();
  group.traverse(object => {
    if (object.isMesh) owned.add(object.geometry);
    if (object.isSprite) borrowed.add(object.geometry);
    for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
      owned.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) borrowed.add(value);
    }
  });
  return { owned, borrowed };
}
function watch(group) {
  const { owned, borrowed } = resources(group), counts = new Map();
  for (const resource of [...owned, ...borrowed]) {
    counts.set(resource, 0);
    resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  }
  return {
    retained() { for (const count of counts.values()) assert.equal(count, 0, 'live pickup resources were released'); },
    retired(detached = true) {
      for (const resource of owned) assert.equal(counts.get(resource), 1, 'pickup must release each owned resource exactly once');
      for (const resource of borrowed) assert.equal(counts.get(resource), 0, 'shared halo texture or Sprite quad was released');
      if (detached) assert.equal(group.parent, null);
    },
  };
}

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const scene = new THREE.Scene();
  const makeLevel = () => new Level(scene, { id: 'collectible-lifetime', name: 'Collectible lifetime', data: {
    v: 1, name: 'Collectible lifetime', spawn: [0, 0.02, 0], killY: -20, groups: [], components: [
      { t: 'platform', p: [0, -0.5, -15], s: [40, 1, 60] },
      { t: 'gate', p: [0, 0, -24] },
    ],
  } });
  // A results/HUD crystal can remain alive when a level or another pickup retires.
  const survivor = Level.crystalMesh(), survivorWatch = watch(survivor);
  scene.add(survivor);
  const survivorPositions = survivor.children[0].geometry.attributes.position.array.slice();
  const survivorColor = survivor.children[0].material.color.clone();
  const level = makeLevel(), retired = [];
  for (let iteration = 0; iteration < 32; iteration++) {
    level.spawnComboGem();
    const combo = level.comboGem.group, comboWatch = watch(combo);
    assert.equal(resources(combo).owned.size, 3, 'fixture must cover a shell and both materials');
    level.removeComboGem(iteration % 2 === 0);
    level.removeComboGem();
    comboWatch.retired();retired.push(comboWatch);

    level.awardGem(new THREE.Vector3());
    const gem = level.gemPickup.group, gemWatch = watch(gem);
    level.collectGem();
    level.reset(false);
    assert.equal(level.gemPickup.group, gem, 'soft reset must retain the earned gem');
    gemWatch.retained();
    level.reset(true);
    level.reset(true);
    assert.equal(level.gemPickup, null);
    gemWatch.retired();retired.push(gemWatch);
    survivorWatch.retained();
  }
  // An attached prize still belongs to the generic Level disposal path.
  level.spawnComboGem();const attached = watch(level.comboGem.group);
  const successor = makeLevel();successor.root.add(Level.gemMesh());
  const successorWatch = watch(successor.root.children.at(-1));
  level.dispose(successor);
  successorWatch.retained();survivorWatch.retained();
  // dispose() removes the level root, not its individual attached children.
  assert.equal(level.root.parent, null);attached.retired(false);
  successor.dispose();survivorWatch.retained();
  for (const item of retired) item.retired();
  assert.deepEqual(survivor.children[0].geometry.attributes.position.array, survivorPositions);
  assert.ok(survivor.children[0].material.color.equals(survivorColor));
  console.log('Collectible lifetime: 64 retired prizes, soft/hard reset, duplicate removal, level retirement and shared halo/Sprite ownership passed.');
} finally { await server.close(); }
