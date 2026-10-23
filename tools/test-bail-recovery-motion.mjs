import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { BailRecoveryMotion } = await server.ssrLoadModule('/src/character/bailRecoveryMotion.ts');
  const a = new BailRecoveryMotion(), b = new BailRecoveryMotion();
  const start = new THREE.Quaternion(), spin = new THREE.Vector3(), q = new THREE.Quaternion(), other = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const velocity = new THREE.Vector3(); let derivativeError = 0, hemisphereError = 0, maxNormError = 0;
  for (let i = 0; i < 240; i++) {
    start.setFromEuler(new THREE.Euler(Math.sin(i) * 3.1, Math.cos(i * .7) * 3.1, Math.sin(i * .3) * 3.1));
    spin.set(Math.sin(i * .3) * 12, Math.cos(i * .7) * 5, Math.sin(i * .4) * 8);
    const duration = i % 2 ? .56 : .56 / 3;
    a.begin(start, spin, duration); other.set(-start.x, -start.y, -start.z, -start.w); b.begin(other, spin, duration);
    a.sample(0, q); assert.ok(q.angleTo(start) < 1e-7, 'recovery did not begin in the landed orientation');
    const dt = 1e-7; a.sample(dt / duration, q); delta.copy(q).multiply(other.copy(start).invert());
    if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w);
    velocity.set(delta.x, delta.y, delta.z).multiplyScalar(2 / dt);
    derivativeError = Math.max(derivativeError, velocity.distanceTo(spin));
    for (let frame = 0; frame <= 60; frame++) {
      const phase = frame / 60; a.sample(phase, q); b.sample(phase, other);
      hemisphereError = Math.max(hemisphereError, q.angleTo(other));
      maxNormError = Math.max(maxNormError, Math.abs(1 - q.length()));
      assert.ok(q.toArray().every(Number.isFinite));
    }
    a.sample(1, q); assert.ok(q.angleTo(new THREE.Quaternion()) < 1e-7, 'recovery failed to end upright');
    a.sample(100, other); assert.ok(q.angleTo(other) < 1e-7, 'completed recovery resumed moving');
  }
  assert.ok(derivativeError < .001, `initial momentum discontinuity: ${derivativeError}`);
  assert.ok(hemisphereError < 1e-7 && maxNormError < 1e-12, 'quaternion sign or normalization changed the motion');
  a.begin(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), .3), new THREE.Vector3(), .56);
  a.sample(.3, q); assert.ok(q.angleTo(new THREE.Quaternion()) < .3, 'nearly upright recovery invented another somersault');

  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'recovery-flow', name: 'Recovery flow', data: {
    v: 1, name: 'Recovery flow', spawn: [0, .04, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }],
  } });
  level.ramp('bail-roll-bank', -16, 6, -28, 0, 12, new THREE.MeshLambertMaterial(), 85); level.groundMeshes.at(-1).userData.vert = true;
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const previous = new THREE.Quaternion(), current = new THREE.Quaternion(), waist = new THREE.Vector3(), lastWaist = new THREE.Vector3();
  const incomingSpin = new THREE.Vector3(), predicted = new THREE.Quaternion(), advance = new THREE.Quaternion();
  const random = Math.random, rows = [];
  try {
    for (const initialSeed of [1234, 42, 109, 829, 1229]) for (const cause of ['balance', 'wall', 'trip', 'landing', 'pvp', 'bank']) {
      let seed = initialSeed; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      p.respawn(level, true, true, cause === 'bank' ? { position: new THREE.Vector3(85, 4.04, -20), heading: new THREE.Vector3(0, 0, -1) } : undefined);
      p.invulnTimer = 0; p.step(CONST.fixedStep, input, level); p.speed = cause === 'balance' ? 10 : cause === 'bank' ? 12 : 24; p.freeSkate = true;
      if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
      else {
        p.bail(false, p.speed, cause === 'bank' ? 'balance' : cause, 30);
        if (cause === 'wall' || cause === 'trip') {
          p.startRagdoll(cause === 'wall' ? 'back' : 'forward'); p.vVel = cause === 'wall' ? 3.6 : 7;
          p.state = 'air'; p.grounded = false; p.airFromSkate = false; p.airMomentum = true;
        }
      }
      // The rider inherits nonuniform character proportions. Normalize the
      // decomposed orientation before angleTo, which requires unit inputs.
      p.group.updateMatrixWorld(true); p.riderG.getWorldQuaternion(previous).normalize();
      lastWaist.set(0, .82, 0).applyMatrix4(p.riderG.matrixWorld).sub(p.pos);
      let entryTurn = null, entryShift = null, entryError = null, maxTurn = 0, maxShift = 0, recoveryFrames = 0, frames = 0;
      for (; frames < 240 && p.isBailing; frames++) {
        p.ragdollWorldSpin(incomingSpin); const angularSpeed = incomingSpin.length();
        predicted.copy(previous);
        if (angularSpeed > 1e-8) predicted.premultiply(advance.setFromAxisAngle(incomingSpin.multiplyScalar(1 / angularSpeed), angularSpeed * CONST.fixedStep));
        p.step(CONST.fixedStep, input, level); p.group.updateMatrixWorld(true); p.riderG.getWorldQuaternion(current).normalize();
        waist.set(0, .82, 0).applyMatrix4(p.riderG.matrixWorld).sub(p.pos);
        if (p.bailRecoverT >= 0) {
          const turn = previous.angleTo(current), shift = waist.distanceTo(lastWaist); recoveryFrames++;
          entryTurn ??= turn; entryShift ??= shift; entryError ??= predicted.angleTo(current);
          maxTurn = Math.max(maxTurn, turn); maxShift = Math.max(maxShift, shift);
        }
        previous.copy(current); lastWaist.copy(waist);
      }
      assert.ok(!p.isBailing && p.grounded && recoveryFrames > 0, `${cause}/${initialSeed}: recovery did not finish`);
      assert.ok(entryError < .1 && entryShift < .3, `${cause}/${initialSeed}: entry lost momentum (${entryError} rad error, ${entryShift} m)`);
      assert.ok(maxTurn < .45 && maxShift < .45, `${cause}/${initialSeed}: excessive middle-frame motion (${maxTurn} rad, ${maxShift} m)`);
      rows.push({ cause, seed: initialSeed, frames, recoveryFrames, entryTurn, entryShift, entryError, maxTurn, maxShift });
    }
    const result = { passed: true, orientationCases: 240, derivativeError, hemisphereError, maxNormError, runtimeCases: rows.length, rows };
    const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
    if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { Math.random = random; runtime.dispose(); level.dispose(); }
});
