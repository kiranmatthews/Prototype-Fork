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
  const level = new Level(new THREE.Scene(), { id: 'quaternius-low-test', name: 'Low pose', data: {
    v: 1, name: 'Low pose', spawn: [0, .02, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [50, 1, 50] }, { t: 'gate', p: [0, 0, -20] }],
  } });
  const player = new Player(level.scene);
  player.enterLevel('quaternius-low-test'); player.respawn(level, true);
  const binding = a.RigBinding.fromSculptRuntime(player.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const expected = {
    'player.crouch-enter': 'Crouch_Enter', 'player.crouch': 'Crouch_Idle_Loop',
    'player.crouch-exit': 'Crouch_Exit', 'player.crawl': 'Crawl_Fwd_Loop',
  };
  const lowClips = suite.clips.filter(clip => expected[clip.id]);
  assert.equal(lowClips.length, 4);
  const assertPalmsDown = () => {
    player.group.updateWorldMatrix(true, true);
    for (const side of ['left', 'right']) {
      const socket = player.bodyGroup.getObjectByName(`socket-grip-${side}`);
      const palm = new THREE.Vector3(0, 0, -1)
        .applyMatrix3(new THREE.Matrix3().getNormalMatrix(socket.matrixWorld)).normalize();
      assert.ok(palm.y < -.99999, `${side} palm is not flat down: ${palm.toArray()}`);
    }
  };
  player.enterAnimationPreview();
  const metrics = {};
  for (const clip of lowClips) {
    assert.equal(clip.metadata.sourceAnimation.sourceClip, expected[clip.id]);
    assert.equal(clip.metadata.sourceAnimation.edition, 'Source');
    assert.equal(clip.metadata.contactAdaptation, undefined, 'Unity hand correction leaked into new source');
    assert.equal(clip.proceduralDrivers.length, 0);
    assert.equal(clip.tracks.some(track => track.kind === 'scalar'), false);
    const isLoop = clip.id === 'player.crouch' || clip.id === 'player.crawl';
    assert.equal(clip.loop.mode, isLoop ? 'loop' : 'once');
    if (!isLoop) assert.equal(clip.duration, 5 / 60, 'transition no longer matches prior five-frame timing');
    if (isLoop) for (const track of clip.tracks) assert.deepEqual(track.keys[0].value, track.keys.at(-1).value);
    let minKneeGap = Infinity, minAnkleY = Infinity, minWristY = Infinity;
    for (let frame = 0; frame <= 120; frame++) {
      player.resetAnimationPreview();
      binding.applyPose(a.sampleComposedClip(clip, frame / 120 * clip.duration), { resetUnspecified: true, strict: false });
      player.applyAnimationDeformations({});
      player.syncCharacterAppearance({ crawlPalmWeight: clip.id === 'player.crawl' ? 1 : 0 });
      if (clip.id === 'player.crawl') assertPalmsDown();
      player.group.updateMatrixWorld(true);
      const local = id => player.group.worldToLocal(binding.getJoint(id).getWorldPosition(new THREE.Vector3()));
      const left = local('kneeLeft'), right = local('kneeRight');
      assert.ok([...left.toArray(), ...right.toArray()].every(Number.isFinite));
      minKneeGap = Math.min(minKneeGap, left.x - right.x);
      minAnkleY = Math.min(minAnkleY, local('ankleLeft').y, local('ankleRight').y);
      minWristY = Math.min(minWristY, local('wristLeft').y, local('wristRight').y);
    }
    metrics[clip.id] = { minKneeGap, minAnkleY, minWristY };
    assert.ok(minKneeGap > .25, `${clip.id} crossed the live character's knees`);
    assert.ok(minAnkleY > .05, `${clip.id} drove the ankles below the support plane`);
  }
  console.log(metrics);
  // Repeated paused Studio frames and edited wrist rests must stay flat
  // without accumulating the orientation correction or touching arm poses.
  const crawl = lowClips.find(clip => clip.id === 'player.crawl');
  player.resetAnimationPreview();
  binding.applyPose(a.sampleComposedClip(crawl, .7), { resetUnspecified: true, strict: false });
  player.applyAnimationDeformations({});
  player.syncCharacterAppearance({ crawlPalmWeight: 1 });
  const mounts = ['left', 'right'].map(side => player.bodyGroup.getObjectByName(`hand-rest-orientation-${side}`));
  const before = mounts.map(mount => mount.quaternion.clone());
  for (let repeat = 0; repeat < 20; repeat++) player.syncCharacterAppearance({ crawlPalmWeight: 1 });
  assertPalmsDown();
  mounts.forEach((mount, index) => assert.ok(1 - Math.abs(mount.quaternion.dot(before[index])) < 1e-10));
  player.syncCharacterAppearance({ crawlPalmWeight: 0 });
  const ordinary = mounts.map(mount => mount.quaternion.clone());
  player.syncCharacterAppearance({ crawlPalmWeight: 1 });
  player.syncCharacterAppearance({ crawlPalmWeight: 0 });
  mounts.forEach((mount, index) => assert.ok(1 - Math.abs(mount.quaternion.dot(ordinary[index])) < 1e-10,
    'leaving crawl failed to restore the normal wrist rest'));
  const { characterProportionSettings } = await server.ssrLoadModule('/src/character/settings.ts');
  const originalSettings = { ...characterProportionSettings.value };
  for (const yaw of [-180, -60, 0, 100]) {
    characterProportionSettings.patch({ wristRestYaw: yaw, wristRestPitch: 35, wristRestRoll: -25,
      bodyWidth: 1.2, bodyDepth: .8, height: 1.1 });
    player.syncCharacterAppearance({ crawlPalmWeight: 1 });
    assertPalmsDown();
  }
  characterProportionSettings.patch(originalSettings);
  player.exitAnimationPreview();
  const prior = structuredClone(suite);
  prior.metadata.playerStarterCatalogVersion = 23;
  for (const clip of prior.clips) {
    if (clip.id === 'player.crawl') delete clip.metadata.palmOrientation;
    if (clip.id !== 'player.crouch-enter' && clip.id !== 'player.crouch-exit') continue;
    delete clip.metadata.crouchTimingRevision;
    clip.duration *= 10; clip.range.end *= 10;
    for (const track of clip.tracks) for (const key of track.keys) key.time *= 10;
    clip.playbackSpeed = .9;
  }
  const fast = a.reconcilePlayerStarterAnimationSuite(prior, binding.definition);
  for (const id of ['player.crouch-enter', 'player.crouch-exit']) {
    const clip = fast.clips.find(clip => clip.id === id);
    assert.equal(clip.duration, 5 / 60);
    assert.equal(clip.playbackSpeed, .9);
    assert.deepEqual(clip.tracks.map(track => track.keys.map(key => key.value)),
      prior.clips.find(clip => clip.id === id).tracks.map(track => track.keys.map(key => key.value)));
  }
  assert.equal(fast.clips.find(clip => clip.id === 'player.crawl').metadata.palmOrientation, a.QUATERNIUS_CRAWL_PALMS);
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(fast, binding.definition), fast);
  const old = a.createLegacyUnityLowPoseClips(binding.definition);
  old[0].playbackSpeed = .73;
  old[0].tracks[0].keys[0].value[1] += .01;
  const saved = a.parseAnimationSuite({ ...suite,
    metadata: { ...suite.metadata, playerStarterCatalogVersion: 22 },
    clips: suite.clips.filter(clip => !expected[clip.id]).concat(old) });
  const updated = a.reconcilePlayerStarterAnimationSuite(saved, binding.definition);
  assert.equal(updated.clips.find(clip => clip.id === 'player.crouch').metadata.sourceAnimation.author, 'Quaternius');
  assert.equal(updated.clips.find(clip => clip.id === 'player.crouch').playbackSpeed, .73);
  assert.deepEqual(updated.clips.find(clip => clip.id === 'player.crouch.pre-quaternius').tracks,
    saved.clips.find(clip => clip.id === 'player.crouch').tracks, 'browser edits lost from backup');
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(updated, binding.definition), updated);
  assert.equal(a.validateAnimationSuite(updated).valid, true, 'backup IDs produced an invalid suite');
  const deleted = { ...saved, clips: saved.clips.filter(clip => clip.id !== 'player.crawl') };
  assert.ok(!a.reconcilePlayerStarterAnimationSuite(deleted, binding.definition).clips.some(clip => clip.id === 'player.crawl'));
  const runtime = createCharacterAnimationRuntime(player, suite);
  const input = { moveX: 0, moveY: 0, grabHeld: false };
  const tick = (count = 1) => { for (let i = 0; i < count; i++) { player.step(1 / 60, input, level); level.update(1 / 60); } };
  tick(12); input.grabHeld = true; tick();
  assert.equal(runtime.activeClipId, 'player.crouch-enter');
  tick(6); assert.equal(runtime.activeClipId, 'player.crouch');
  input.moveX = 1; tick(12); assert.equal(runtime.activeClipId, 'player.crawl');
  assert.equal(player.authoredCrawlContactPhase, null, 'legacy hand IK is active');
  assertPalmsDown();
  input.moveX = 0; tick(12); assert.equal(runtime.activeClipId, 'player.crouch');
  input.grabHeld = false; tick(); assert.equal(runtime.activeClipId, 'player.crouch-exit');
  tick(6); assert.equal(runtime.activeClipId, 'player.idle');
  input.grabHeld = true; tick(8); input.moveX = 1; tick(3);
  assert.equal(runtime.activeClipId, 'player.crawl', 'entry delayed directional input');
  input.moveX = 0; tick(10); input.grabHeld = false; tick(); input.moveX = 1; tick(12);
  assert.equal(runtime.activeClipId, 'player.run', 'exit delayed run input');
  runtime.dispose(); level.dispose();
  console.log('PASS Quaternius low source clips, real-player transitions, interruption, pose sampling and saved draft backups');
} finally { await server.close(); console.warn = warn; console.error = error; }
