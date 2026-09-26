import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop=()=>{};' + harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
const assetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!assetLog(args[0])) warn(...args); };
console.error = (...args) => { if (!assetLog(args[0])) error(...args); };
const levels = [];
try {
  const { Level, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const data = (patch = {}) => ({
    v: 1, name: 'Authored ice', spawn: [0, .02, 0], killY: -20,
    components: [
      { t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], ...patch },
      { t: 'gate', p: [0, 0, -95] },
    ],
  });
  const createLevel = value => {
    const level = new Level(new THREE.Scene(), { id: 'ice-test', name: value.name, data: value });
    level.root.updateMatrixWorld(true); levels.push(level); return level;
  };
  const fixture = patch => {
    const level = createLevel(data(patch)), player = new Player(level.scene);
    player.enterLevel('ice-test'); player.respawn(level, true);
    player.step(CONST.fixedStep, { moveX: 0, moveY: 0 }, level);
    assert.equal(player.grounded, true);
    return { level, player };
  };
  const tick = ({ level, player }, input, count = 60) => {
    for (let frame = 0; frame < count; frame++) {
      player.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
    }
    assert.equal(player.state, 'ride'); assert.equal(player.grounded, true);
  };
  const ice = { slip: true, iceGrip: .08 }, legacy = { slip: true };
  // Both box and polygon capture paths must survive build/capture/build.
  for (const shape of [{}, { pts: [[-100, -100], [100, -100], [100, 100], [-100, 100]] }]) {
    const authored = normalizeCustomLevelData(data({ ...ice, ...shape }));
    assert.ok(authored);
    const built = createLevel(authored), capture = built.captureData();
    const normalized = normalizeCustomLevelData(capture);
    assert.ok(normalized, 'ice capture invalid');
    const capturedIce = normalized.components.filter(c => c.slip);
    assert.ok(capturedIce.length > 0);
    assert.ok(capturedIce.every(c => c.iceGrip === .08));
    const rebuilt = createLevel(normalized);
    assert.ok(rebuilt.groundMeshes.some(m => m.userData.slippy && m.userData.iceGrip === .08));
  }
  for (const iceGrip of [0, .019, 1.001, NaN, Infinity, '0.08'])
    assert.equal(normalizeCustomLevelData(data({ slip: true, iceGrip })), null);
  for (const iceGrip of [.02, .08, 1]) assert.ok(normalizeCustomLevelData(data({ slip: true, iceGrip })));
  assert.equal(normalizeCustomLevelData(data({ iceGrip: .08 })), null, 'dry materials cannot silently become ice');
  assert.equal(normalizeCustomLevelData(data({ t: 'ramp', slip: true, iceGrip: .08 })), null);

  const momentum = [];
  for (const patch of [legacy, ice]) {
    const f = fixture(patch);
    // Enter from a dry diagonal run, release all input on the patch.
    f.player.walkVelocity.set(4, 0, -6); f.player.speed = 6;
    tick(f, { moveX: 0, moveY: 0 });
    momentum.push(f.player.walkVelocity.clone());
  }
  assert.ok(momentum[0].length() < .3, 'legacy release changed');
  assert.ok(momentum[1].x > 2.9 && -momentum[1].z > 4.4, 'authored ice did not carry both velocity axes');

  const steer = [];
  for (const patch of [legacy, ice]) {
    const f = fixture(patch);
    f.player.walkVelocity.set(0, 0, -6); f.player.speed = 6;
    tick(f, { moveX: 1, moveY: 0 }, 30);
    steer.push(f.player.walkVelocity.clone());
  }
  assert.ok(steer[1].x > 0 && steer[1].x < steer[0].x * .25, 'ice steering does not allow small anticipation corrections');
  assert.ok(-steer[1].z > -steer[0].z * 3, 'sideways input erased the incoming vector');

  const board = (patch, input, count = 60) => {
    const f = fixture(patch);
    f.player.freeSkate = true; f.player.speed = 20; f.player.lastPlanar = 20;
    f.player.axisF.set(0, 0, -1); f.player.axisL.set(-1, 0, 0);
    tick(f, input, count);
    return { speed: f.player.speed, turn: Math.abs(Math.atan2(f.player.axisF.x, -f.player.axisF.z)) };
  };
  const coastOld = board(legacy, { moveX: 0, moveY: 0 });
  const coastNew = board(ice, { moveX: 0, moveY: 0 });
  assert.ok(20 - coastNew.speed < (20 - coastOld.speed) * .1, 'authored rollout lost legacy-sized momentum');
  const brakeOld = board(legacy, { moveX: 0, moveY: 0, grabHeld: true });
  const brakeNew = board(ice, { moveX: 0, moveY: 0, grabHeld: true });
  assert.ok(brakeNew.speed > brakeOld.speed + 6, 'circle brake bypassed ice inertia');
  const pullbackOld = board(legacy, { moveX: 0, moveY: -1 });
  const pullbackNew = board(ice, { moveX: 0, moveY: -1 });
  assert.ok(pullbackNew.speed > pullbackOld.speed + 3, 'pullback brake bypassed authored grip');
  const turnOld = board(legacy, { moveX: 1, moveY: 0 });
  const turnNew = board(ice, { moveX: 1, moveY: 0 });
  assert.ok(turnNew.turn > 0 && turnNew.turn < turnOld.turn * .4, 'board steering did not respect authored grip');
  console.log('PASS authored vector ice inertia, counter-steer, skate coast/brake/steer, legacy behavior and box/mesh capture');
  console.log(JSON.stringify({ runAfter1s: momentum.map(v => v.toArray()), steerAfterHalfSecond: steer.map(v => v.toArray()), coastOld, coastNew, brakeOld, brakeNew, pullbackOld, pullbackNew, turnOld, turnNew }));
} finally {
  for (const level of levels) level.dispose();
  await server.close(); console.warn = warn; console.error = error;
}
