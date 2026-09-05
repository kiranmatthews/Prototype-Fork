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
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { ResultsPresentation } = await server.ssrLoadModule('/src/resultsPresentation.ts');
  const { RigBinding, createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'results-check', name: 'Results check', data: {
    v: 1, name: 'Results check', spawn: [0, 0.02, 0], killY: -20, groups: [], components: [
      { t: 'platform', p: [0, -0.5, -15], s: [40, 1, 60] },
      { t: 'crate', p: [5, 0, -4], kind: 'nitro' },
      { t: 'gate', p: [0, 0, -24] },
    ],
  } });
  const player = new Player(scene);
  const runtime = createCharacterAnimationRuntime(player, createPlayerStarterAnimationSuite(
    RigBinding.fromSculptRuntime(player.animationRig.root, { strict: false }).definition));
  const normal = { kind: 'normal', levelName: 'Results check', boxes: 0, totalBoxes: 1, firstClear: false, crystal: false, boxGem: false, comboGem: false };
  const trial = { kind: 'time-trial', levelName: 'Results check', actualTime: 60, relicTarget: 60, boxes: 0, totalBoxes: 1, bestTimes: [60] };
  const variants = [normal, { ...normal, crystal: true }, { ...normal, boxGem: true },
    { ...normal, crystal: true, boxGem: true }, { ...normal, boxGem: true, comboGem: true },
    { ...normal, crystal: true, boxGem: true, comboGem: true }, trial, { ...trial, actualTime: 60.01 }];
  const counts = [0, 1, 1, 2, 2, 3, 1, 0];
  const switchCrate = level.crates.find(crate => crate.systemicEndNitroBang);
  assert.ok(switchCrate);
  for (const [index, result] of variants.entries()) {
    const shot = new ResultsPresentation(scene, player, level, result);
    assert.equal(shot.rewards.children.length, counts[index]);
    assert.equal(player.resultsPose, counts[index] ? 'celebrate' : 'rest');
    assert.equal(player.pos.y, 0, 'presentation must use the floor, not the hidden pad top');
    assert.equal(switchCrate.mesh.visible, false);
    assert.equal(switchCrate.alive, true, 'presentation must not break the finish switch');
    assert.ok(level.warpPads.every(pad => !pad.group.visible));
    const invariant = () => JSON.stringify([player.pos.toArray(), player.runTime, player.lives, player.fruit, player.cratesBroken]);
    const before = invariant(), chest = player.upperG.rotation.x;
    const rewardY = shot.rewards.children.map(reward => reward.position.y);
    for (let frame = 0; frame < 180; frame++) shot.update(1 / 60);
    assert.equal(invariant(), before, 'results changed simulation state');
    assert.notEqual(player.upperG.rotation.x, chest, 'breathing/celebration must loop');
    shot.rewards.children.forEach((reward, i) => assert.ok(Math.abs(reward.position.y - rewardY[i]) <= 0.0751, 'reward bob drifted'));
    for (const size of [
      [1440, 900, { x: 18, y: 18, width: 760, height: 864 }],
      [390, 844, { x: 18, y: 12, width: 354, height: 365 }],
      [844, 390, { x: 18, y: 18, width: 400, height: 354 }],
    ]) {
      const camera = new THREE.PerspectiveCamera();
      shot.frameCamera(camera, ...size);
      assert.ok(camera.position.y > player.pos.y, 'portrait framing moved the lens below the floor');
      const [width, height, viewport] = size;
      for (const x of [shot.bounds.min.x, shot.bounds.max.x])
        for (const y of [shot.bounds.min.y, shot.bounds.max.y])
          for (const z of [shot.bounds.min.z, shot.bounds.max.z]) {
            const point = new THREE.Vector3(x, y, z).project(camera);
            const sx = (point.x + 1) * width / 2, sy = (1 - point.y) * height / 2;
            assert.ok(sx >= viewport.x - 1 && sx <= viewport.x + viewport.width + 1 && sy >= viewport.y - 1 && sy <= viewport.y + viewport.height + 1, `variant ${index} clips the clear scene viewport: ${sx}, ${sy}`);
          }
    }
    const owned = new Set(), borrowed = new Set();
    shot.rewards.traverse(object => {
      if (object instanceof THREE.Mesh) owned.add(object.geometry);
      if (object instanceof THREE.Sprite) borrowed.add(object.geometry);
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { owned.add(material); if (material.map) borrowed.add(material.map); if (material.matcap) borrowed.add(material.matcap); });
      }
    });
    let released = 0, damaged = 0;
    owned.forEach(resource => resource.addEventListener('dispose', () => { released++; }));
    borrowed.forEach(resource => resource.addEventListener('dispose', () => { damaged++; }));
    shot.dispose();
    assert.equal(released, owned.size, 'results leaked owned geometry/materials');
    assert.equal(damaged, 0, 'results disposed shared game textures or sprite geometry');
    assert.equal(player.resultsPose, null);
    assert.equal(switchCrate.mesh.visible, true);
    assert.ok(level.warpPads.every(pad => pad.group.visible));
    assert.equal(scene.getObjectByName('results-rewards'), undefined);
  }
  runtime.dispose();
  level.dispose();
  const { CAMPAIGN_LEVELS } = await server.ssrLoadModule('/src/campaign.ts');
  for (const definition of CAMPAIGN_LEVELS) {
    const entry = findLevel(definition.levelId) ?? findLevel(definition.fallbackLevelId);
    assert.ok(entry, `missing ${definition.levelId}`);
    const course = new Level(new THREE.Scene(), entry);
    const stage = course.prepareResultsBackdrop(course.spawnPos);
    const ray = new THREE.Raycaster(stage.position.clone().add(new THREE.Vector3(0, 0.1, 0)), new THREE.Vector3(0, -1, 0), 0, 0.2);
    const support = ray.intersectObjects(course.groundMeshes.filter(mesh => !mesh.userData.finishPad), false)[0];
    assert.ok(support, `${definition.levelId}: results skater lacks real floor support`);
    assert.ok(stage.forward.lengthSq() > 0.99);
    stage.restore();
    course.dispose();
  }
  console.log('PASS live results: 8 reward combinations, independent looping poses, frozen run state, supported staging, responsive framing, reversible prop hiding and shared-safe disposal');
} finally {
  await server.close();
  console.warn = originalWarn; console.error = originalError;
}
