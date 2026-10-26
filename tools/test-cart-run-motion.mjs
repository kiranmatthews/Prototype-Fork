import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

await withBlockworksRuntime(async e => {
  const a = await e.server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await e.server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { CartInteractionActor } = await e.server.ssrLoadModule('/src/golf-cart/interactionMotion.ts');
  const { SkateRace } = await e.server.ssrLoadModule('/src/race/runtime.ts');
  const race = new SkateRace(e.scene, e.p, false, () => true);
  race.attach(e.l, 'coconut-cart-rally'); race.start('race', 0); race.phase = 'running';
  const c = race.carts; c.drive = () => ({ moveX: 0, moveY: 0 }); c.present(1); c.exit(0, false);
  const body = e.p.vehicleVisualRoot, parent = body.parent, scale = body.scale.clone();
  const binding = a.RigBinding.fromSculptRuntime(e.p.animationRig.root);
  const suite = a.createPlayerStarterAnimationSuite(binding.definition);
  const runtime = createCharacterAnimationRuntime(e.p, suite), before = runtime.diagnostics;
  const run = suite.clips.find(clip => clip.id === 'player.run');
  assert.equal(run.metadata.sourceAnimation.sourceClip, 'Jog_Fwd_Loop');
  const actor = new CartInteractionActor(e.p, e.scene), foot = c.exitPoint(0, -1);
  const from = foot.clone().add(new e.THREE.Vector3(0, 0, 3));
  const motion = a.createProceduralMotionContext({ normalizedSpeed: 1, grounded: true, inputs: { locomotionWalkBlend: 0 } });
  let maxAngle = 0, phaseIndependent = 0;
  // Compare all imported rotation channels through two complete cycles. The
  // former IK walk would fail this on every leg and arm, as well as cadence.
  const sampleRun = (clip, seconds, fraction) => {
    actor.present('run', fraction, c.fleet.models[0], foot, -1, from, undefined, seconds);
    const actual = binding.capturePose(), expected = a.sampleComposedClip(clip, a.clipTimeAt(clip, seconds), motion);
    for (const [id, delta] of Object.entries(expected.joints)) {
      if (delta.quaternion) {
        const error = new e.THREE.Quaternion().fromArray(actual.joints[id].quaternion)
          .angleTo(new e.THREE.Quaternion().fromArray(delta.quaternion));
        maxAngle = Math.max(maxAngle, error);
        assert.ok(error < 1e-6, `${id} replaced the authored run at ${seconds}: ${error}`);
      }
      if (id === 'root' && delta.position)
        assert.ok(new e.THREE.Vector3().fromArray(actual.joints[id].position)
          .distanceTo(new e.THREE.Vector3().fromArray(delta.position)) < 1e-6, 'lost the authored root bounce');
    }
    assert.ok(body.scale.distanceTo(scale) < 1e-10, 'interaction resized Bone Man');
    return actual;
  };
  for (let frame = 0; frame < 80; frame++) {
    const seconds = frame / 60;
    const first = sampleRun(run, seconds, .1), second = sampleRun(run, seconds, .8);
    assert.deepEqual(first, second, 'path completion changed run cadence'); phaseIndependent++;
  }
  assert.deepEqual(runtime.diagnostics, before, 'borrowed run changed the gameplay animation clock');
  // Edits in Animation Studio must also reach an already-created interaction.
  const edited = structuredClone(suite), editedRun = edited.clips.find(clip => clip.id === 'player.run');
  editedRun.playbackSpeed *= .7;
  const headTrack = editedRun.tracks.find(track => track.kind === 'quaternion' && track.target === 'head');
  for (const key of headTrack.keys) key.value = new e.THREE.Quaternion().setFromAxisAngle(new e.THREE.Vector3(0, 1, 0), .23).toArray();
  runtime.setDocument(edited); sampleRun(editedRun, .27, .4);
  assert.equal(e.p.authoredClip('player.run'), editedRun);
  runtime.dispose(); assert.equal(e.p.authoredClip('player.run'), null);
  sampleRun(run, .27, .4); // AI/no-runtime fallback remains the identical clip.
  for (const mode of ['exit', 'enter']) {
    let blendedFrames = 0;
    for (let frame = 0; frame <= 60; frame++) {
      actor.present(mode, frame / 60, c.fleet.models[0], foot, -1, from);
      blendedFrames += actor.locomotion.weight > 0;
      for (const joint of e.p.animationRig.joints)
        assert.ok([...joint.node.position, ...joint.node.quaternion, ...joint.node.scale].every(Number.isFinite), `${mode} produced an invalid joint`);
      assert.ok(body.scale.distanceTo(scale) < 1e-10);
    }
    assert.ok(blendedFrames > 20, `${mode} never blended to the run`);
  }
  actor.dispose(); assert.equal(body.parent, parent); assert.ok(body.scale.distanceTo(scale) < 1e-10);
  race.attach({ skateRace: null }, 'flats');
  const report = { passed: true, source: run.metadata.sourceAnimation.sourceClip, samples: phaseIndependent, maxJointErrorRadians: maxAngle, liveEdits: true, fallback: true, fixedCadence: true, gameplayClockUnchanged: true, fullSize: true };
  await writeFile(process.env.CART_RUN_REPORT ?? '/private/tmp/cart-run-motion.json', JSON.stringify(report, null, 2) + '\n');
  console.log('PASS', JSON.stringify(report));
}, { modulePath: '/src/levels/coconut-cart-rally.ts', source: m => m.COCONUT_CART_RALLY_LEVEL, levelId: 'coconut-cart-rally' });
