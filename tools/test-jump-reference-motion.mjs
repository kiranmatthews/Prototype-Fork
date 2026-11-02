import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// These are Prototype Fork's shipped catalog-v37 curves, generated from its
// own createPlayerStarterClips() at 1a191907. No Jak game data is in this fixture.
const previous = JSON.parse(await readFile(new URL('./fixtures/pre-reference-jump-clips.json', import.meta.url), 'utf8'));
await withSkateRuntime(async ({ server, THREE, Player, Level }) => {
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const level = new Level(new THREE.Scene(), {id: 'jump-reference-test', name: 'Jump reference', data: {
    v: 1, name: 'Jump reference', spawn: [0, .02, 0], killY: -30,
    components: [{t: 'platform', p: [0, -.5, 0], s: [1000, 1, 1000]}, {t: 'gate', p: [0, 0, -450]}],
  }});
  const player = new Player(level.scene), control = new Player(level.scene);
  const rig = a.RigBinding.fromSculptRuntime(player.animationRig.root).definition;
  const suite = a.createPlayerStarterAnimationSuite(rig);
  const old = {...suite, metadata: {...suite.metadata, playerStarterCatalogVersion: 37},
    clips: suite.clips.map(clip => previous.find(p => p.id === clip.id) ?? clip)};
  for (const document of [old, a.parseAnimationSuite(old)]) {
    const upgraded = a.reconcilePlayerStarterAnimationSuite(document, rig);
    for (const clip of previous) assert.equal(upgraded.clips.find(c => c.id === clip.id).metadata.jumpReferenceRevision, 1,
      `${clip.id}: untouched saved starter was not upgraded`);
    assert.deepEqual(a.reconcilePlayerStarterAnimationSuite(upgraded, rig), upgraded);
  }
  for (const mutation of [
    clip => clip.playbackSpeed = .73,
    clip => clip.tracks[0].keys[0].value[0] += .015,
    clip => clip.tracks[0].enabled = false,
    clip => clip.name = 'My edited jump',
  ]) {
    const edited = structuredClone(old); mutation(edited.clips.find(c => c.id === 'player.jump'));
    const upgraded = a.reconcilePlayerStarterAnimationSuite(edited, rig);
    assert.deepEqual(upgraded.clips.find(c => c.id === 'player.jump'), edited.clips.find(c => c.id === 'player.jump'));
  }
  const deleted = {...old, clips: old.clips.filter(c => c.id !== 'player.jump')};
  assert.ok(!a.reconcilePlayerStarterAnimationSuite(deleted, rig).clips.some(c => c.id === 'player.jump'));
  const jump = suite.clips.find(c => c.id === 'player.jump'), double = suite.clips.find(c => c.id === 'player.double-jump');
  const euler = (pose, name) => new THREE.Euler().setFromQuaternion(new THREE.Quaternion().fromArray(pose.joints[name].quaternion));
  assert.ok(euler(a.sampleClip(jump, .72), 'kneeLeft').x > 1.6, 'knees must gather before the apex');
  const tuck = a.sampleClip(double, .5), reach = a.sampleClip(double, .12), catchPose = a.sampleClip(double, 1);
  assert.ok(euler(tuck, 'kneeLeft').x > 1.9 && euler(tuck, 'hipLeft').x < -1.1, 'second apex needs a compact tuck');
  assert.ok(euler(catchPose, 'kneeLeft').x < .6, 'double jump must unfold before touchdown');
  for (const key of Object.keys(tuck.scalars)) {
    assert.ok(tuck.scalars[key] < .9 && reach.scalars[key] > 1.2, `lost independent reach/tuck: ${key}`);
    assert.equal(catchPose.scalars[key], 1, `descent never settled: ${key}`);
  }
  const runtime = createCharacterAnimationRuntime(player, suite);
  const baseline = createCharacterAnimationRuntime(control, old);
  let frames = 0, maxDelta = 0, minimumSole = Infinity, maximumSole = -Infinity;
  try {
    for (const [name, hold, move, second] of [
      ['standing tap', 3, 0, null], ['standing full', 35, 0, null],
      ['running tap', 3, 1, null], ['full jump into run', 35, 1, null],
      ['early double', 35, 0, 7], ['apex double', 35, 0, 0], ['late double', 18, 1, -5],
    ]) {
      for (const p of [player, control]) {p.enterLevel('jump-reference-test');p.respawn(level, true);p.freeSkate = false;}
      runtime.restart(); baseline.restart();
      let hadAir = false, didDouble = false, landed = false, doubleFrame = -1;
      const visited = new Set();
      for (let frame = 0; frame < 260; frame++) {
        // Holding jump while already running intentionally mounts the board.
        // Fully charge at rest, then steer on release to test on-foot recovery.
        const input = makeInput({moveY: name === 'full jump into run' && frame < 45 + hold ? 0 : move, jumpPressed: frame === 45,
          jumpHeld: frame >= 45 && frame < 45 + hold, jumpReleased: frame === 45 + hold});
        if (second !== null && hadAir && !didDouble && !player.grounded && player.vVel < second) {
          input.jumpPressed = input.jumpHeld = true; didDouble = true; doubleFrame = frame;
        }
        if (doubleFrame >= 0 && frame === doubleFrame + 1) input.jumpReleased = true;
        player.step(1 / 60, input, level); control.step(1 / 60, input, level); level.update(1 / 60);
        frames++; visited.add(runtime.activeClipId);
        maxDelta = Math.max(maxDelta, player.pos.distanceTo(control.pos));
        assert.deepEqual(player.pos.toArray(), control.pos.toArray(), `${name}: changed position at frame ${frame}`);
        for (const field of ['vVel', 'speed', 'grounded', 'state', 'launchVy', 'airJumpUsed', 'lives'])
          assert.equal(player[field], control[field], `${name}: changed ${field}`);
        assert.deepEqual(player.walkVelocity.toArray(), control.walkVelocity.toArray(), `${name}: changed steering`);
        for (const v of Object.values(runtime.lastSampledPose?.scalars ?? {})) assert.ok(Number.isFinite(v));
        assert.equal(player.riderG.scale.x, control.riderG.scale.x, 'whole-rig scale changed');
        assert.equal(player.riderG.scale.y, control.riderG.scale.y, 'whole-rig scale changed');
        assert.equal(player.riderG.scale.z, control.riderG.scale.z, 'whole-rig scale changed');
        if (!player.grounded) hadAir = true; else if (hadAir) landed = true;
        if (move === 0 && runtime.activeClipId === 'player.land' && hadAir) {
          player.group.updateWorldMatrix(true, true);
          for (const {sole} of player.proceduralFootwear) {
            let low = Infinity;
            const vertices = sole.geometry.getAttribute('position');
            for (let i = 0; i < vertices.count; i++) low = Math.min(low,
              new THREE.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(sole.matrixWorld).y);
            minimumSole = Math.min(minimumSole, low); maximumSole = Math.max(maximumSole, low);
          }
        }
      }
      assert.ok(hadAir && landed && (visited.has('player.land') || visited.has('player.roll-land')),
        `${name}: incomplete launch/landing ${JSON.stringify([...visited])}`);
      if (second !== null) assert.ok(didDouble && visited.has('player.double-jump'), `${name}: missed second impulse`);
      assert.equal(runtime.activeClipId, move ? 'player.run' : 'player.idle', `${name}: failed finite recovery`);
    }
  } finally {runtime.dispose(); baseline.dispose(); level.dispose();}
  assert.ok(minimumSole >= -.002 && maximumSole < .04,
    `landing soles lost support: ${minimumSole}–${maximumSole}m`);
  console.log(`PASS original reach/tuck/gather, raw and normalized v37 migration, preserved edits/deletions, ${frames} real-input frames with exact before/after physics parity (${maxDelta}m delta) and finite landing recovery. Sole height: ${minimumSole}–${maximumSole}m.`);
}, {levelEntry: {id: 'empty-test', name: 'Empty test', data: {v: 1, name: 'Empty test', spawn: [0, .02, 0], killY: -30,
  components: [{t: 'platform', p: [0, -.5, 0], s: [20, 1, 20]}, {t: 'gate', p: [0, 0, -8]}]}}});
