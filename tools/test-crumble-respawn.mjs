import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';

// Run real level construction, clocks and collision queries without rendering.
const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),
  harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();')();
const server = await createServer({ appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true, hmr: false, ws: false } });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const makeLevel = () => {
    const data = { v: 1, name: 'Fallaway return regression', spawn: [0, .1, 6], killY: -30,
      components: [
        { t: 'platform', p: [0, -.5, 6], s: [8, 1, 5] },
        { t: 'crumble', p: [0, 0, 0], s: [4, 1, 3], yaw: 37, shake: .35 },
        { t: 'crumble', p: [8, 2, 0], s: [3, 1, 5], shake: .02, speed: .02 },
        { t: 'gate', p: [0, 0, 6] },
      ] };
    return new Level(new THREE.Scene(), { id: '__crumble_respawn', name: data.name, data });
  };
  const supported = (level, c) => {
    const ray = new THREE.Raycaster(c.base.clone().add(new THREE.Vector3(0, 4, 0)), new THREE.Vector3(0, -1, 0), 0, 8);
    const hits = level.raycastGround ? level.raycastGround(ray) : ray.intersectObjects(level.groundMeshes, false);
    return hits.some(hit => hit.object === c.mesh);
  };
  const restored = (level, c) => {
    assert.equal(c.state, 'idle');
    assert.equal(c.mesh.visible, true);
    assert.deepEqual(c.mesh.position.toArray(), c.base.toArray());
    assert.deepEqual(c.mesh.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(c.mesh.rotation.toArray(), [0, c.yaw, 0, 'XYZ']);
    const warning = c.mesh.children.find(child => child.name.includes('warning bindings'));
    if (warning) assert.equal(warning.material.color.getHex(), 0x815027, 'return retained the collapse warning');
    assert.equal(level.groundMeshes.filter(mesh => mesh === c.mesh).length, 1);
    assert.ok(supported(level, c), 'restored surface must immediately catch a ground ray');
  };
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const level = makeLevel();
    try {
      const original = JSON.stringify(level.captureData());
      for (const c of level.crumbles) {
        const id = c.mesh.userData.crumbleId;
        const material = c.mesh.material;
        // Two full trips ensure old timers, fall rotations and scale do not leak.
        for (let cycle = 0; cycle < 2; cycle++) {
          restored(level, c);
          level.touchCrumble(id);
          level.update(dt);
          const shakeAge = c.t;
          level.touchCrumble(id);
          assert.equal(c.t, shakeAge, 'repeated contact must not postpone the drop');
          for (let n = 0; c.state === 'shake' && n < 120; n++) level.update(dt);
          assert.equal(c.state, 'fall');
          assert.equal(supported(level, c), false);
          let elapsed = 0, animated = 0, hidden = 0, maxScale = 0;
          while (c.state !== 'idle' && elapsed < 11) {
            level.update(dt); elapsed += dt;
            if (c.state === 'idle') break;
            assert.equal(supported(level, c), false, 'return animation became solid early');
            if (c.state === 'gone' && c.mesh.visible) {
              animated++;
              assert.ok(c.mesh.scale.x > 0 && c.mesh.scale.x < 1.06);
              assert.ok(c.mesh.position.y >= c.base.y - .751 && c.mesh.position.y <= c.base.y);
              maxScale = Math.max(maxScale, c.mesh.scale.x);
              near(c.mesh.position.x, c.base.x); near(c.mesh.position.z, c.base.z);
            } else if (!c.mesh.visible) hidden++;
            level.touchCrumble(id);
          }
          assert.ok(elapsed >= 10 - 1e-7 && elapsed <= 10 + dt + 1e-7, `return took ${elapsed}s`);
          assert.ok(animated >= .7 / dt && hidden > 0, 'must wait, then visibly animate back');
          assert.ok(maxScale > 1, 'gentle finite settle was not exercised');
          assert.equal(c.mesh.material, material, 'animation must not replace shared materials');
          restored(level, c);
        }
      }
      assert.equal(JSON.stringify(level.captureData()), original, 'runtime animation changed editor data');
    } finally { level.dispose(); }
  }

  const level = makeLevel();
  try {
    const [first, second] = level.crumbles;
    level.touchCrumble(0); level.update(.4);
    for (let n = 0; n < 180; n++) level.update(1 / 60);
    level.touchCrumble(1); level.update(.03);
    while (first.state !== 'idle') level.update(1 / 60);
    assert.notEqual(second.state, 'idle', 'one return reset a different pad clock');
    for (const hard of [false, true]) for (const age of [.1, 2, 9.6]) {
      level.reset(true);
      level.touchCrumble(0); level.update(.4);
      for (let n = 0; n < Math.round(age * 60); n++) level.update(1 / 60);
      level.reset(hard);
      for (const c of level.crumbles) restored(level, c);
    }
  } finally { level.dispose(); }

  // The built-in Sky Bridge route uses the same return behavior and keeps its delays.
  const bridge = new Level(new THREE.Scene(), { id: 'sky', name: 'Sky Bridge' });
  try {
    assert.ok(bridge.crumbles.length > 0);
    for (const c of bridge.crumbles) bridge.touchCrumble(c.mesh.userData.crumbleId);
    for (let n = 0; n < 12 * 60; n++) bridge.update(1 / 60);
    for (const c of bridge.crumbles) restored(bridge, c);
  } finally { bridge.dispose(); }
  console.log('PASS global fallaway return: 10s timing, repeated cycles, slow falls, animated non-solid return, independent clocks, reset and editor fidelity');
} finally { await server.close(); }
