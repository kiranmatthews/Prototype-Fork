import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};' + harness.slice(
  harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nconst held'),
) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
const assetLog = value => /GLB|mask failed|crossbones failed|skateboard trucks|spin model failed/.test(String(value ?? ''));
console.warn = (...args) => { if (!assetLog(args[0])) warn(...args); };
console.error = (...args) => { if (!assetLog(args[0])) error(...args); };
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const level = new Level(new THREE.Scene(), { id: 'idle-transition-test', name: 'Idle transition', data: {
    v: 1, name: 'Idle transition', spawn: [0, .02, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, -20], s: [100, 1, 160] }, { t: 'gate', p: [0, 0, -90] }],
  } });
  const player = new Player(level.scene), control = new Player(level.scene);
  for (const p of [player, control]) { p.enterLevel('idle-transition-test'); p.respawn(level, true); }
  player.setCharacterProportions({ upperArmRestAngle: 20 });
  const binding = a.RigBinding.fromSculptRuntime(player.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const idle = suite.clips.find(clip => clip.id === 'player.idle');
  const run = suite.clips.find(clip => clip.id === 'player.run');
  assert.equal(idle.metadata.sourceAnimation.sourceClip, 'Idle_Loop');
  assert.ok(Math.abs(idle.duration / idle.playbackSpeed - run.duration / run.playbackSpeed) < 1e-8);
  assert.equal(idle.tracks.filter(track => track.kind === 'quaternion').length, 22);
  assert.equal(idle.proceduralDrivers.length, 0);
  for (const track of idle.tracks) assert.deepEqual(track.keys[0].value, track.keys.at(-1).value);
  const saved = structuredClone(suite);
  saved.metadata.playerStarterCatalogVersion = 25;
  const old = saved.clips.find(clip => clip.id === 'player.idle');
  old.name = 'My previous idle'; delete old.metadata.locomotionTransition;
  old.tracks[0].keys[0].value[1] += .02;
  saved.clips.find(clip => clip.id === 'player.run').playbackSpeed = 2;
  const upgraded = a.reconcilePlayerStarterAnimationSuite(saved, binding.definition);
  assert.deepEqual(upgraded.clips.find(clip => clip.id === 'player.idle.pre-quaternius').tracks, old.tracks);
  assert.ok(Math.abs(upgraded.clips.find(clip => clip.id === 'player.idle').playbackSpeed - idle.duration / run.duration * 2) < 1e-8);
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(upgraded, binding.definition), upgraded);
  const withoutIdle = { ...saved, clips: saved.clips.filter(clip => clip.id !== 'player.idle') };
  assert.ok(!a.reconcilePlayerStarterAnimationSuite(withoutIdle, binding.definition).clips.some(clip => clip.id === 'player.idle'));

  const runtime = createCharacterAnimationRuntime(player, suite);
  const bodyIds = idle.tracks.filter(track => track.kind === 'quaternion').map(track => track.target);
  let previous = null, switchCount = 0, maxSwitchAngle = 0, maxBlendStep = 0, maxRootStep = 0;
  const visited = new Set();
  const step = amount => {
    const input = { moveX: 0, moveY: amount };
    player.step(1 / 60, input, level); control.step(1 / 60, input, level); level.update(1 / 60);
    assert.ok(player.pos.distanceTo(control.pos) < 1e-9, 'idle blending changed movement');
    const diagnostics = runtime.diagnostics;
    const pose = binding.capturePose(bodyIds.concat('root'));
    visited.add(diagnostics.activeClipId);
    if (previous) {
      const switched = previous.id !== diagnostics.activeClipId;
      if (switched) switchCount++;
      let angle = 0;
      for (const id of bodyIds) angle = Math.max(angle,
        new THREE.Quaternion().fromArray(pose.joints[id].quaternion).angleTo(
          new THREE.Quaternion().fromArray(previous.pose.joints[id].quaternion)));
      if (switched) maxSwitchAngle = Math.max(maxSwitchAngle, angle);
      if (diagnostics.transitionBlendWeight !== null) {
        maxBlendStep = Math.max(maxBlendStep, angle);
        maxRootStep = Math.max(maxRootStep, new THREE.Vector3().fromArray(pose.joints.root.position)
          .distanceTo(new THREE.Vector3().fromArray(previous.pose.joints.root.position)));
      }
    }
    previous = { id: diagnostics.activeClipId, pose };
  };
  // Fast run and gentle analogue walk both flow through the real controller.
  // Repeated brief taps also reverse transitions before they can finish.
  for (const [amount, frames] of [[0, 30], [1, 140], [0, 90], [.18, 100], [0, 80]])
    for (let i = 0; i < frames; i++) step(amount);
  for (let tap = 0; tap < 6; tap++) {
    for (let i = 0; i < 6; i++) step(.18);
    for (let i = 0; i < 8; i++) step(0);
  }
  for (let i = 0; i < 30; i++) step(0);
  console.log({ switchCount, maxSwitchDegrees: THREE.MathUtils.radToDeg(maxSwitchAngle),
    maxBlendStepDegrees: THREE.MathUtils.radToDeg(maxBlendStep), maxRootStep });
  assert.ok(visited.has('player.run') && visited.has('player.idle') && switchCount >= 10);
  assert.ok(maxSwitchAngle < .01, 'a state change snapped a body joint');
  assert.ok(maxBlendStep < .35, 'a crossfade jerked a body joint');
  assert.ok(maxRootStep < .07, 'a crossfade snapped the whole body position');
  assert.equal(runtime.activeClipId, 'player.idle');
  player.freeSkate = true; player.syncVisual({ moveX: 0, moveY: 0 }, 1 / 60);
  assert.notEqual(runtime.activeClipId, 'player.idle', 'board-mounted stance acquired boardless idle');
  runtime.dispose(); level.dispose();
  console.log('PASS Quaternius idle rhythm, whole-body walk/run transitions, quick reversals, movement parity and saved migration');
} finally { await server.close(); console.warn = warn; console.error = error; }
