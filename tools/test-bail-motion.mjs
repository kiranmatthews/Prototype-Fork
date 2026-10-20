import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const { BoneEnvelopeBounds } = await server.ssrLoadModule('/src/character/boneEnvelopeBounds.ts');
  const orientation = new THREE.Quaternion(), spin = new THREE.Vector3(9, 2, -4);
  const a = new BailMotion(), b = new BailMotion(), c = new BailMotion();
  for (const [motion, seed] of [[a, 10], [b, 10], [c, 11]]) motion.begin('forward', spin, seed);
  let variation = 0, distalMotion = 0;
  for (let i = 0; i < 360; i++) {
    orientation.setFromEuler(new THREE.Euler(i * .13, i * .037, i * -.08));
    if (i === 20 || i === 54) for (const m of [a, b, c]) m.impact(i === 20 ? 18 : 5);
    for (const m of [a, b, c]) m.step(1 / 60, orientation, spin, i > 54, 0, 0, 1);
    assert.deepEqual(a.angles, b.angles, 'cosmetic seed should reproduce the same continuous motion');
    assert.ok([...a.angles, ...a.velocity, ...Object.values(a.deformations)].every(Number.isFinite));
    assert.ok(Math.max(...a.angles.map(Math.abs)) < 2, 'joint limit escaped');
    assert.ok(Object.values(a.deformations).every(v => v > .65 && v < 1.35), 'segment length escaped');
    variation = Math.max(variation, a.angles.reduce((sum, v, j) => sum + Math.abs(v - c.angles[j]), 0));
    distalMotion = Math.max(distalMotion, Math.abs(a.angles[12]), Math.abs(a.angles[27]));
  }
  assert.ok(variation > 3, 'different crashes produced the same pose');
  assert.ok(distalMotion > .25, 'wrist/knee inertia is too small to read');
  // The same continuous forcing is stable under frame subdivision.
  a.begin('back', spin, 25); b.begin('back', spin, 25);
  for (let i = 0; i < 90; i++) {
    a.step(1 / 60, orientation, spin, false, 0, 0, 1);
    b.step(1 / 120, orientation, spin, false, 0, 0, 1);
    b.step(1 / 120, orientation, spin, false, 0, 0, 1);
  }
  assert.ok(a.angles.every((v, i) => Math.abs(v - b.angles[i]) < 1e-9));
  a.impact(30); spin.set(0, 0, 0);
  for (let i = 0; i < 600; i++) a.step(1 / 60, orientation, spin, true, 0, 0, 1);
  assert.ok(Math.max(...a.velocity.map(Math.abs)) < .0001, 'settled body kept cycling');
  assert.ok(Object.values(a.deformations).every(v => Math.abs(v - 1) < .0001), 'elasticity never settled');
  assert.equal(a.step(1 / 60, orientation, spin, true, .4, 0, 1), false, 'spring rig stole planted recovery');
  const joint = new THREE.Object3D(); joint.rotation.set(.2, -.1, .3);
  const original = joint.quaternion.clone();
  for (let i = 0; i < 120; i++) { a.apply(1, joint, 1); a.restore(); }
  assert.ok(original.angleTo(joint.quaternion) < 1e-7, 'legacy motion accumulated in the rig');

  // Independently compare conservative envelopes to every Three.js skinned
  // vertex under changing poses, nonuniform scales, morphs and warm-cache edits.
  const geometry = new THREE.BoxGeometry(.5, 2, .5).toNonIndexed();
  const positions = geometry.getAttribute('position'), indices = [], weights = [];
  for (let i = 0; i < positions.count; i++) { indices.push(0, 1, 0, 0); weights.push(.4, .6, 0, 0); }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.morphAttributes.position = [positions.clone()];
  for (let i = 0; i < positions.count; i++) geometry.morphAttributes.position[0].setXYZ(i, .2 + positions.getX(i) * .7, positions.getY(i) * .9, positions.getZ(i) * 1.4);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const bones = [new THREE.Bone(), new THREE.Bone()]; mesh.add(bones[0]); bones[0].add(bones[1]);
  bones[1].position.y = .5; mesh.bind(new THREE.Skeleton(bones));
  const envelopes = new BoneEnvelopeBounds(), exact = new THREE.Box3();
  for (const relative of [false, true]) for (let i = 0; i < 60; i++) {
    geometry.morphTargetsRelative = relative; mesh.morphTargetInfluences[0] = Math.sin(i) * 1.5;
    mesh.rotation.set(i * .03, i * .05, i * .07); mesh.position.set(4, -2, 8);
    bones[1].rotation.set(i * .1, i * -.04, i * .08); bones[1].scale.set(1.1, .8, .9);
    mesh.updateMatrixWorld(true); mesh.computeBoundingBox(); exact.copy(mesh.boundingBox);
    const envelope = envelopes.measure(mesh);
    assert.ok(envelope && envelope.containsBox(exact), 'bone envelope clipped a skinned/morphed vertex');
  }
  positions.setY(0, 9); positions.needsUpdate = true;
  mesh.computeBoundingBox(); exact.copy(mesh.boundingBox);
  assert.ok(envelopes.measure(mesh).containsBox(exact), 'geometry edit left stale envelopes');
  geometry.getAttribute('skinWeight').setXYZW(0, -.2, 1.2, 0, 0); geometry.getAttribute('skinWeight').needsUpdate = true;
  assert.equal(envelopes.measure(mesh), null, 'negative weights must retain exact fallback');
  geometry.dispose(); mesh.material.dispose();

  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'intact-bail-test', name: 'Intact bail', data: {
    v: 1, name: 'Intact bail', spawn: [0, .04, 0], killY: -40,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 100], edgeGrinding: false }, { t: 'gate', p: [40, 0, -40] }],
  } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const parents = p.animationRig.joints.map(j => j.node.parent), measure = p.interactionMeasure;
  let fullSkinScans = 0, exactSupportScans = 0, maxSupportSamples = 0, supportedShadowQueries = 0;
  const shadowQuery = p.queryShadowGround.bind(p);
  p.queryShadowGround = (...args) => {
    if (p.isBailing && p.grounded && p.groundHit) supportedShadowQueries++;
    return shadowQuery(...args);
  };
  const skin = measure.skinnedBounds.bind(measure), support = measure.minimumPlaneDistance.bind(measure);
  measure.skinnedBounds = mesh => { if (p.isBailing) fullSkinScans++; return skin(mesh); };
  measure.minimumPlaneDistance = (...args) => { if (p.isBailing) exactSupportScans++; return support(...args); };
  const scenarios = [];
  try {
    for (const cause of ['balance', 'wall', 'trip', 'rail', 'landing', 'pvp']) {
      p.respawn(level, true, true); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
      p.speed = cause === 'balance' ? 0 : 24; p.freeSkate = true;
      if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
      else p.bail(false, 24, cause, 30);
      let frames = 0, impact = 0, peak = 0;
      for (; frames < 240 && p.isBailing; frames++) {
        p.step(CONST.fixedStep, input, level); p.refreshGroundPresentation(level);
        assert.equal(p.breakApart, null, `${cause} allocated detached parts`);
        maxSupportSamples = Math.max(maxSupportSamples, measure.supportSamples);
        impact = Math.max(impact, p.ragdollImpactCount);
        peak = Math.max(peak, ...p.bailMotion.angles.map(Math.abs));
        p.animationRig.joints.forEach((j, i) => {
          assert.equal(j.node.parent, parents[i]);
          assert.ok([...j.node.position.toArray(), ...j.node.quaternion.toArray(), ...j.node.scale.toArray()].every(Number.isFinite));
        });
      }
      assert.ok(!p.isBailing && p.grounded && p.state !== 'dead', `${cause} did not recover`);
      assert.ok(frames < 150 && peak > .1, `${cause} stalled or did not articulate`);
      if (cause === 'balance') assert.ok(frames <= 41, `neutral grounded bail took ${frames} frames`);
      scenarios.push({ cause, seconds: frames / 60, impact, peak });
    }
    assert.equal(supportedShadowQueries, 0, 'supported bail repeated its world shadow query');
    assert.equal(fullSkinScans, 0, 'active intact bails still scan the full skin');
    assert.equal(exactSupportScans, 0, 'active intact bails still scan exact support');
    assert.ok(maxSupportSamples < 12000, 'sparse support budget exceeded');
    console.log(JSON.stringify({ variation, distalMotion, fullSkinScans, exactSupportScans, supportedShadowQueries, maxSupportSamples, scenarios }, null, 2));
  } finally { runtime.dispose(); level.dispose(); }
});
