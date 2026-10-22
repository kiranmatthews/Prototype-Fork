import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Measure the visible head, not just the rider root: an animation-clip switch
// can move the head by 30 cm while leaving the root quaternion unchanged.
await withSkateRuntime(async ({ THREE, server, Player, Level, CONST, TUNING }) => {
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { BailRiseMotion, BAIL_RISE_SETTLE_SECONDS } = await server.ssrLoadModule('/src/character/bailRiseMotion.ts');
  const { sampleBailRecovery } = await server.ssrLoadModule('/src/bailRecovery.ts');
  for (const [key, from, to] of [['tuck', 0, .56], ['plant', .24, .92], ['stride', .56, 1], ['shoulder', .04, .68]]) {
    const dt = 1e-6;
    for (const edge of [from, to]) {
      const velocity = (sampleBailRecovery(edge + dt)[key] - sampleBailRecovery(edge - dt)[key]) / (2 * dt);
      assert.ok(Math.abs(velocity) < .001, `${key} snapped at its contact-window edge`);
    }
  }
  const rise = new BailRiseMotion(); let shortest = 1, longest = 1;
  for (let frame = 0; frame < 240; frame++) {
    rise.sample(frame / 240 * BAIL_RISE_SETTLE_SECONDS, 1, 1);
    const strain = rise.deformations['deform.torso.length']; shortest = Math.min(shortest, strain); longest = Math.max(longest, strain);
    assert.ok(Object.values(rise.deformations).every(n => Number.isFinite(n) && n > .8 && n < 1.2));
  }
  assert.ok(shortest < .93 && longest > 1.03, 'the push lacked readable compression and extension');
  rise.sample(BAIL_RISE_SETTLE_SECONDS, 1, 1);
  assert.equal(rise.pitch + rise.roll + rise.head + rise.arm + rise.knee, 0);
  assert.ok(Object.values(rise.deformations).every(n => n === 1), 'rebound did not finitely settle');

  const scene = new THREE.Scene(), level = new Level(scene, { id: 'recovery-continuity', name: 'Recovery continuity', data: {
    v: 1, name: 'Recovery continuity', spawn: [0, .04, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }],
  } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const random = Math.random, head = new THREE.Vector3(), previous = new THREE.Vector3(), delta = new THREE.Vector3(), lastDelta = new THREE.Vector3(), rows = [];
  try {
    for (const initialSeed of [42, 829, 1229]) for (const heading of [0, Math.PI / 2])
      for (const cause of ['balance', 'manual', 'nose-manual', 'wall', 'trip', 'landing', 'pvp']) {
        let seed = initialSeed; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        p.respawn(level, true, true, { position: new THREE.Vector3(0, .04, 0), heading: new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading)) });
        level.discardedBoards.clear(); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
        p.speed = cause === 'balance' ? 10 : 24; p.freeSkate = true;
        if (cause === 'manual' || cause === 'nose-manual') {
          const sign = cause === 'manual' ? 1 : -1; p.speed = 12; p.enterManual(sign);
          for (let i = 0; i < 12; i++) { p.balance = sign * .8; p.step(CONST.fixedStep, input, level); }
          p.balance = sign; p.balanceVel = sign * 5; p.balanceCritT = TUNING.bailGrace + .05; p.step(CONST.fixedStep, input, level);
        } else if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
        else {
          p.bail(false, p.speed, cause, 30);
          if (cause === 'wall' || cause === 'trip') {
            p.startRagdoll(cause === 'wall' ? 'back' : 'forward'); p.vVel = cause === 'wall' ? 3.6 : 7;
            p.state = 'air'; p.grounded = false; p.airFromSkate = false; p.airMomentum = true;
          }
        }
        let handoff = null, reboundFrames = 0, maxReboundDelta = 0, maxRecoveryDelta = 0;
        previous.set(0, 0, 0); lastDelta.set(0, 0, 0);
        for (let frame = 0; frame < 170; frame++) {
          const wasBailing = p.isBailing;
          p.step(CONST.fixedStep, input, level); p.group.updateMatrixWorld(true);
          p.headM.localToWorld(head.set(0, .3, 0)).sub(p.pos); delta.copy(head).sub(previous);
          const shift = delta.length(), velocityChange = delta.clone().sub(lastDelta).length();
          assert.ok(head.toArray().every(Number.isFinite), 'head became non-finite');
          if (wasBailing && !p.isBailing) handoff = { frame, shift, velocityChange };
          if (p.bailRecoverT > 0) maxRecoveryDelta = Math.max(maxRecoveryDelta, velocityChange);
          if (!p.isBailing && p.bailRiseAge >= 0) { reboundFrames++; maxReboundDelta = Math.max(maxReboundDelta, velocityChange); }
          previous.copy(head); lastDelta.copy(delta);
        }
        const label = `${cause}/${initialSeed}/${heading}`;
        assert.ok(handoff && handoff.frame < 150 && reboundFrames > 20, `${label}: no complete recovery/rebound`);
        assert.ok(handoff.shift < .11 && handoff.velocityChange < .07, `${label}: head snapped when controls returned: ${JSON.stringify(handoff)}`);
        assert.ok(maxReboundDelta < .14, `${label}: head jerked during the post-control settle: ${maxReboundDelta}`);
        assert.equal(p.bailRiseAge, -1, 'rebound remained active');
        assert.equal(p.breakApartDiagnostics?.active ?? false, false, 'nonfatal body detached');
        rows.push({ cause, seed: initialSeed, heading, handoff, reboundFrames, maxReboundDelta, maxRecoveryDelta });
      }
    const result = { passed: true, cases: rows.length, torsoLengthRange: [shortest, longest], rows };
    const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
    if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { Math.random = random; runtime.dispose(); level.dispose(); }
});
