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
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const player = new Player(new THREE.Scene());
  const binding = a.RigBinding.fromSculptRuntime(player.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const metrics = {};
  player.enterAnimationPreview();
  for (const id of ['player.jump', 'player.fall', 'player.land']) {
    const clip = suite.clips.find(clip => clip.id === id);
    let minElbowClearance = Infinity, minWristClearance = Infinity;
    for (let frame = 0; frame <= 120; frame++) {
      player.resetAnimationPreview();
      const pose = a.sampleComposedClip(clip, frame / 120 * clip.duration, a.createProceduralMotionContext());
      binding.applyPose(pose, { resetUnspecified: true, strict: false });
      player.applyAnimationDeformations(pose.scalars);
      player.syncCharacterAppearance({ upperArmRestAngleWeight: 0 });
      player.group.updateMatrixWorld(true);
      const chest = binding.getJoint('chest');
      const local = name => chest.worldToLocal(binding.getJoint(name).getWorldPosition(new THREE.Vector3()));
      for (const [side, sign] of [['Left', 1], ['Right', -1]]) {
        const shoulder = local('shoulder' + side);
        minElbowClearance = Math.min(minElbowClearance, sign * (local('elbow' + side).x - shoulder.x));
        minWristClearance = Math.min(minWristClearance, sign * (local('wrist' + side).x - shoulder.x));
      }
    }
    metrics[id] = { minElbowClearance, minWristClearance };
    assert.ok(minElbowClearance > .045, `${id} upper arm swept inside the torso line`);
    assert.ok(minWristClearance > .10, `${id} forearm swept inside the torso line`);
  }
  console.log(metrics);
  player.exitAnimationPreview();
  const old = structuredClone(suite);
  old.metadata.playerStarterCatalogVersion = 24;
  const oldJump = old.clips.find(clip => clip.id === 'player.jump');
  delete oldJump.metadata.jumpArmRevision;
  oldJump.playbackSpeed = .7;
  oldJump.tracks.find(track => track.target === 'root').keys[0].value[1] += .03;
  oldJump.tracks.find(track => track.target === 'shoulderLeft').keys[0].value = [0, 0, -.2, .98];
  const upgraded = a.reconcilePlayerStarterAnimationSuite(old, binding.definition);
  const revisedJump = upgraded.clips.find(clip => clip.id === 'player.jump');
  const isArm = track => track.kind === 'quaternion' && /^(shoulder|elbow|wrist)(Left|Right)$/.test(track.target);
  assert.deepEqual(revisedJump.tracks.filter(track => !isArm(track)), oldJump.tracks.filter(track => !isArm(track)),
    'arm migration changed another pose channel');
  assert.equal(revisedJump.playbackSpeed, .7);
  assert.deepEqual(upgraded.clips.find(clip => clip.id === 'player.jump.pre-arm-clearance').tracks, oldJump.tracks);
  assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(upgraded, binding.definition), upgraded);

  const level = new Level(new THREE.Scene(), { id: 'jump-arm-test', name: 'Jump arms', data: {
    v: 1, name: 'Jump arms', spawn: [0, .02, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [50, 1, 50] }, { t: 'gate', p: [0, 0, -20] }],
  } });
  const live = new Player(level.scene); live.enterLevel('jump-arm-test'); live.respawn(level, true);
  const rig = a.RigBinding.fromSculptRuntime(live.animationRig.root);
  const runtime = createCharacterAnimationRuntime(live, a.createPlayerStarterAnimationSuite(rig.definition));
  const input = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false };
  const tick = () => { live.step(1 / 60, input, level); level.update(1 / 60); input.jumpPressed = input.jumpReleased = false; };
  for (let i = 0; i < 12; i++) tick();
  input.jumpHeld = input.jumpPressed = true;
  for (let i = 0; i < 18; i++) tick();
  input.jumpHeld = false; input.jumpReleased = true; tick();
  assert.equal(live.state, 'air');
  const visited = new Set([runtime.activeClipId]);
  let previous = null, maxDescentArmStep = 0;
  for (let frame = 0; frame < 130; frame++) {
    tick(); visited.add(runtime.activeClipId);
    const q = rig.getJoint('shoulderLeft').quaternion.clone();
    if (previous && (runtime.activeClipId === 'player.fall' || runtime.activeClipId === 'player.land'))
      maxDescentArmStep = Math.max(maxDescentArmStep, previous.angleTo(q));
    previous = q;
  }
  assert.ok(visited.has('player.jump') && visited.has('player.fall') && visited.has('player.land') && visited.has('player.idle'));
  assert.ok(maxDescentArmStep < .3, `descent/landing arm snap: ${THREE.MathUtils.radToDeg(maxDescentArmStep)} degrees/frame`);
  console.log('PASS jump/fall/landing arm clearance, continuous descent, real jump handoffs and saved arm-only upgrade',
    { maxDescentArmStepDegrees: THREE.MathUtils.radToDeg(maxDescentArmStep) });
  runtime.dispose(); level.dispose();
} finally { await server.close(); console.warn = warn; console.error = error; }
