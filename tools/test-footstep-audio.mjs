import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
new Function('noop', harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held')) + '\ninstallHeadlessDom();')(() => {});
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...args) => { if (!/failed|GLB|procedural skateboard/i.test(String(args[0]))) warn(...args); };
console.error = (...args) => { if (!/failed|GLB|procedural skateboard/i.test(String(args[0]))) error(...args); };
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { FootstepContacts, FootstepAudio, FOOTSTEP_BANKS, footstepSound, footstepSurface } = await server.ssrLoadModule('/src/footstepAudio.ts');
  const { sfx } = await server.ssrLoadModule('/src/audio.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const originalTuning = JSON.stringify(TUNING);

  const contacts = new FootstepContacts();
  assert.deepEqual(contacts.sample([.006, .006]), [], 'standing must not produce a step');
  for (const height of [.08, .2, .1, .04]) assert.deepEqual(contacts.sample([height, .006]), []);
  assert.deepEqual(contacts.sample([.006, .006]), ['left']);
  for (let i = 0; i < 100; i++) assert.deepEqual(contacts.sample([.006 + (i % 2) * .001, .006]), [], 'planted jitter repeated a step');
  contacts.sample([.006, .25]); contacts.sample([.1, .15]); contacts.sample([.25, .08]);
  assert.deepEqual(contacts.sample([.3, .09]), ['right'], 'floating authored jog must fire at its downstroke minimum');
  contacts.reset();
  assert.deepEqual(contacts.sample([.006, .006]), [], 'teleport replayed a pending foot');
  assert.deepEqual(contacts.sample([NaN, .006]), []);
  assert.equal(footstepSurface('snow', 'frost ice'), 'ice');
  assert.equal(footstepSurface('snow', 'snow powder'), 'snow');
  assert.equal(footstepSurface('generic', 'bridge-timber'), 'wood');
  assert.equal(footstepSurface('generic', 'boardwalk'), 'wood');
  assert.equal(footstepSurface('generic', 'nightworks-basalt'), 'stone');
  for (const surface of ['wood', 'stone', 'grass', 'ice', 'metal', 'generic'])
    assert.equal(footstepSound(surface, 'run', 0), 'footstep1', 'unprovided foley needs an audible fallback');
  FOOTSTEP_BANKS.grass = { walk: ['grass-walk-a', 'grass-walk-b'], run: ['grass-run'] };
  assert.equal(footstepSound('grass', 'walk', 3), 'grass-walk-b');
  assert.equal(footstepSound('grass', 'run', 9), 'grass-run');
  FOOTSTEP_BANKS.wood = { walk: [] };
  assert.equal(footstepSound('wood', 'walk', 0), 'footstep1');
  const sounds = [];
  sfx.play = (...args) => sounds.push({ args, channel: sfx.emitterChannel });
  const first = new FootstepAudio(), second = new FootstepAudio();
  first.play('left', 'grass', .2); first.play('right', 'grass', 1); second.play('left', 'grass', .2);
  assert.deepEqual(sounds.map(s => s.args[0]), ['grass-walk-a', 'grass-run', 'grass-walk-a']);
  assert.ok(sounds.every(s => s.args[2] === 1), 'cadence must never pitch-stretch the foley');
  assert.equal(new Set(sounds.map(s => s.channel)).size, 3, 'feet/players share a debounce channel');
  delete FOOTSTEP_BANKS.grass; delete FOOTSTEP_BANKS.wood;

  const level = new Level(new THREE.Scene(), { id: 'footstep-test', name: 'Footsteps', data: {
    v: 1, name: 'Footsteps', spawn: [0, .02, 0], killY: -30,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [1000, 1, 1000], tex: 'grass' }, { t: 'gate', p: [450, 0, -450] }],
  } });
  const p = new Player(level.scene);
  p.enterLevel('footstep-test'); p.respawn(level, true);
  await p.preparePresentationAssets();
  const binding = a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const runtime = createCharacterAnimationRuntime(p, suite);
  const v = new THREE.Vector3();
  const heights = () => p.proceduralFootwear.map(({ sole }) => {
    sole.updateWorldMatrix(true, false);
    const points = sole.geometry.getAttribute('position'); let height = Infinity;
    for (let i = 0; i < points.count; i++) height = Math.min(height, v.fromBufferAttribute(points, i).applyMatrix4(sole.matrixWorld).sub(p.renderPosition).dot(p.groundHit.normal) / p.groundHit.normal.y);
    return height;
  });
  let frame = 0, events = [], rendered = [];
  const play = p.footstepAudio.play.bind(p.footstepAudio);
  p.footstepAudio.play = (side, surface, speed) => {
    events.push({ frame, side, surface, speed, heights: heights() }); play(side, surface, speed);
  };
  const physics = () => [p.pos.toArray(), p.walkVelocity.toArray(), p.speed, p.vVel, p.state, p.grounded];
  const render = () => {
    const before = physics();
    p.applyRenderInterpolation(1);
    const h = heights(); rendered.push({ frame, heights: h });
    p.updateFootstepAudio(); p.restoreRenderPose();
    assert.deepEqual(physics(), before, 'footstep sampling mutated movement');
  };
  const tick = input => { p.step(1 / 60, input, level); level.update(1 / 60); p.commitRenderStep(level); frame++; };
  const reset = () => { p.respawn(level, true); runtime.restart(); frame = 0; events = []; rendered = []; };
  const results = [];
  for (const [name, x, y, amount, renderEvery] of [
    ['slow forward', 0, 1, .2, 1], ['walk backward', 0, -1, .333, 1],
    ['walk left', -1, 0, .333, 1], ['run left', -1, 0, 1, 1], ['run right', 1, 0, 1, 1],
    ['run forward', 0, 1, 1, 1], ['run backward', 0, -1, 1, 1],
    ['diagonal blend', Math.SQRT1_2, Math.SQRT1_2, .65, 1],
    ['walk 30fps', 1, 0, .333, 2], ['run 30fps', 1, 0, 1, 2],
  ]) {
    reset();
    for (let i = 0; i < 360; i++) { tick({ moveX: x * amount, moveY: y * amount }); if (i % renderEvery === 0) render(); }
    const steady = events.filter(e => e.frame > 120 && e.frame < 350);
    const expectedSteps = (230 / 60) * 2 / (amount <= 1 / 3 ? 1.3333334 : amount === 1 ? .9333333 / 1.6 : 1 / (1 / 1.3333334 + (1.6 / .9333333 - 1 / 1.3333334) * ((amount - 1 / 3) / (2 / 3))));
    assert.ok(Math.abs(steady.length - expectedSteps) < 2, `${name}: ${steady.length} attacks, expected approximately ${expectedSteps}`);
    assert.ok(steady.some(e => e.side === 'left') && steady.some(e => e.side === 'right'), `${name}: silent foot`);
    assert.ok(steady.every(e => e.surface === 'grass'), `${name}: wrong support material`);
    assert.ok(steady.every((e, i) => !i || e.side !== steady[i - 1].side), `${name}: repeated planted foot`);
    for (const event of steady) {
      const index = event.side === 'left' ? 0 : 1, i = rendered.findIndex(r => r.frame === event.frame);
      const previous = rendered[i - 1].heights[index], before = rendered[i - 2].heights[index], now = event.heights[index];
      assert.ok(now <= .012 || previous <= before + .0003 && previous <= now + .0003, `${name}: attack away from sole landing`);
      assert.ok(now <= event.heights[1 - index] + .006, `${name}: airborne swing foot sounded`);
    }
    results.push({ name, steps: steady.length, meanInterval: (steady.at(-1).frame - steady[0].frame) / (60 * (steady.length - 1)) });
  }
  for (const multiplier of [.5, 2]) {
    reset(); runtime.setPlaybackSpeedMultiplier(multiplier);
    for (let i = 0; i < 360; i++) { tick({ moveX: 1, moveY: 0 }); render(); }
    const steady = events.filter(e => e.frame > 120);
    assert.ok(Math.abs(steady.length - 4 * 2 * multiplier / (.9333333 / 1.6)) < 2, 'edited animation speed lost step cadence');
    results.push({ name: `animation speed ${multiplier}`, steps: steady.length });
  }
  runtime.setPlaybackSpeedMultiplier(0);
  for (let i = 0; i < 180; i++) { tick({ moveX: 1, moveY: 0 }); render(); }
  assert.equal(events.filter(e => e.frame > 420).length, 0, 'frozen feet made timer-driven sounds');
  runtime.setPlaybackSpeedMultiplier(1);
  const floor = level.groundMeshes.find(mesh => mesh.material?.userData.texKind === 'grass');
  assert.ok(floor);
  for (const [material, expected] of [['bridge-timber', 'wood'], ['rock', 'stone'], ['ice', 'ice']]) {
    floor.material.userData.texKind = material;
    floor.userData.slippy = expected === 'ice'; floor.userData.iceGrip = expected === 'ice' ? .08 : undefined;
    reset();
    for (let i = 0; i < 360; i++) { tick({ moveX: 1, moveY: 0 }); render(); }
    const steady = events.filter(e => e.frame > 120);
    assert.ok(steady.length >= 2 && steady.every(e => e.surface === expected), `${material}: material-aware contacts missing`);
    results.push({ name: material, steps: steady.length });
  }
  floor.material.userData.texKind = 'grass'; floor.userData.slippy = false; delete floor.userData.iceGrip;
  reset();
  for (let i = 0; i < 180; i++) { tick({ moveX: 1, moveY: 0 }); render(); }
  for (let i = 0; i < 180; i++) { tick({ moveX: 0, moveY: 0 }); render(); }
  assert.equal(events.filter(e => e.frame > 240).length, 0, 'idle or stop coast manufactured footsteps');
  const saved = events.length;
  p.snapRenderInterpolation(); render(); assert.equal(events.length, saved, 'snap emitted a step');
  for (const setup of [() => { p.grounded = false; p.state = 'air'; }, () => { p.freeSkate = true; }, () => { p.slideTimer = .5; }, () => { p.state = 'dead'; }]) {
    p.respawn(level, true); setup();
    p.footstepAudio.contacts.sample([.2, .006]);
    p.updateFootstepAudio();
    assert.equal(p.footstepAudio.contacts.feet, null, 'ineligible state retained a queued contact');
  }
  assert.equal(JSON.stringify(TUNING), originalTuning);
  console.log(JSON.stringify({ result: 'PASS', cases: results, tuningAndPhysicsUnchanged: true }, null, 2));
  runtime.dispose(); level.dispose();
} finally { await server.close(); console.warn = warn; console.error = error; }
