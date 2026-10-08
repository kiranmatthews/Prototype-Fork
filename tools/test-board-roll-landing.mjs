import assert from 'node:assert/strict';
import { withBlockworksRuntime, normalizeGameInput } from './blockworks-runner.mjs';

const source = { v: 1, name: 'Board roll landing', spawn: [0, .05, 60], killY: -80,
  components: [{ t: 'platform', p: [0, -.5, 0], s: [240, 1, 400], edgeGrinding: false },
    { t: 'gate', p: [100, 0, -180] }] };
await withBlockworksRuntime(async r => {
  const { createPlayerStarterAnimationSuite } = await r.server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await r.server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { RigBinding } = await r.server.ssrLoadModule('/src/animation/rigBinding.ts');
  const p = r.p, l = r.l ?? r.level;
  const rig = RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(rig));
  let previous = {}, samples = [];
  let lowestRollClearance = Infinity;
  const tick = (sample = {}) => {
    const input = normalizeGameInput(sample, previous); previous = { ...input };
    p.step(1 / 60, input, l); l.update(1 / 60); p.commitRenderStep(l);
    if (p.animationClipHint === 'player.roll-land') {
      p.group.updateMatrixWorld(true);
      const gap = p.interactionMeasure.sampledPlaneDistance(p.riderG, p.pos.clone().set(0, 1, 0), p.pos);
      lowestRollClearance = Math.min(lowestRollClearance, gap);
      assert.ok(gap >= -.015, `roll penetrated floor by ${-gap}m`);
      assert.deepEqual(p.riderG.scale.toArray(), [1, 1, 1], 'roll scaled the whole skeleton');
    }
    const row = { speed: Math.abs(p.speed), state: p.state, bail: p.isBailing, roll: p.rollLandingT,
      clip: p.animationClipHint, pos: p.pos.toArray(), velocity: p.walkVelocity.toArray() };
    samples.push(row); return row;
  };
  const setup = (speed, yaw = 0) => {
    p.respawn(l, true, true); previous = {}; samples = [];
    p.axisF.set(Math.sin(yaw), 0, -Math.cos(yaw)); p.axisL.set(-p.axisF.z, 0, p.axisF.x);
    p.freeSkate = true; p.speed = speed; p.lastPlanar = speed;
    p.grounded = true; p.state = 'ride'; p.groundHit = p.queryGround(l);
  };
  let cases = 0;
  try {
    for (const speed of [8, 18, 27]) for (const yaw of [0, Math.PI / 2, Math.PI]) {
      setup(speed, yaw);
      for (let i = 0; i < 12; i++) tick({ jumpHeld: true });
      tick(); assert.equal(p.state, 'air'); assert.equal(p.boardOllieAir, true);
      for (let i = 0; i < 4; i++) tick();
      const before = Math.abs(p.speed);
      tick({ jumpHeld: true }); tick({ jumpHeld: true }); tick();
      assert.equal(p.emergencyEjectLandingPending, true);
      assert.ok(Math.abs(p.speed - before) < 1e-8, 'dismount taxed speed');
      assert.ok(Math.abs(p.flyBoardVel.dot(p.axisF) - before) < 1e-8, 'deck lost its forward carry');
      assert.ok(Math.abs(p.flyBoardVel.dot(p.axisL)) > 1, 'loose deck did not clear the rolling rider');
      for (let i = 0; i < 240 && !p.grounded; i++) tick();
      assert.equal(p.isBailing, false); assert.equal(p.animationClipHint, 'player.roll-land');
      assert.ok(Math.abs(p.walkVelocity.length() - before) < 1e-7, 'touchdown lost velocity');
      assert.equal(p.freeSkate, false);
      const contact = samples.length - 1;
      for (let i = 0; i < 60 && p.rollLandingT >= 0; i++) tick();
      assert.ok(samples.slice(contact, -1).every(s => Math.abs(Math.hypot(...s.velocity) - before) < 1e-6), 'roll scrubbed world momentum');
      assert.equal(p.isBailing, false); assert.equal(p.animationClipHint, 'player.run');
      assert.ok(p.animationRig.joints.every(j => [...j.node.position.toArray(), ...j.node.scale.toArray()].every(Number.isFinite)));
      // Releasing the run should still stop; no permanent auto-run or phantom board recall.
      for (let i = 0; i < 180; i++) tick();
      assert.ok(p.walkVelocity.length() < .01); assert.equal(p.freeSkate, false);
      cases++;
    }
    setup(20);
    p.performBoardAbandon(.3, 'Emergency Eject', false);
    p.pos.y = 2; p.state = 'air'; p.grounded = false;
    for (let i = 0; i < 240 && !p.grounded; i++) tick({ moveY: 1 });
    const carried = p.walkVelocity.length();
    for (let i = 0; i < 120; i++) tick({ moveY: 1 });
    assert.ok(Math.abs(p.walkVelocity.length() - carried) < 1e-6, 'held run lost carried momentum');
    assert.equal(p.freeSkate, false);
    tick({ jumpHeld: true }); tick();
    assert.equal(p.state, 'air', 'roll/run blocked a new jump');
    assert.notEqual(p.animationClipHint, 'player.roll-land');
    p.respawn(l, true, true);
    assert.equal(p.boardRunCarry, false); assert.equal(p.rollLandingT, -1);
    // A real excessive drop and an already active wipeout still own contact.
    for (const existingBail of [false, true]) {
      setup(18); p.performBoardAbandon(.3, 'Emergency Eject', false);
      p.pos.y = 35; p.airPeakY = 35; p.state = 'air'; p.grounded = false; p.vVel = -25;
      if (existingBail) p.bail();
      for (let i = 0; i < 100 && p.pos.y > 1; i++) tick();
      for (let i = 0; i < 8; i++) tick();
      assert.equal(p.isBailing, true, 'roll suppressed a genuine impact');
      assert.notEqual(p.animationClipHint, 'player.roll-land');
    }
    console.log(`PASS ${cases} native double-jump/dismount landings: full carry, roll/run, finite rig, neutral stop; held run, jump/reset, real impacts. Lowest roll clearance ${lowestRollClearance.toFixed(4)}m.`);
  } finally { runtime.dispose(); }
}, { source: () => source, levelId: 'board-roll-landing' });
