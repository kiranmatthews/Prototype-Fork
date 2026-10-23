import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Exercise the integration through a real catch, charge and release. In
// particular, a source ollie must carry the signed rail slope velocity.
await withSkateRuntime(async ({ THREE, server, Level, Player, scene, CONST, TUNING }) => {
  const { SCHOOL_SOURCE_SCALE: scale, SCHOOL_SOURCE_LEVEL: school } = await server.ssrLoadModule('/src/levels/school-source.ts');
  const tuningBefore = JSON.stringify(TUNING), results = [];
  const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} != ${expected}`);
  for (const slope of [-.1, 0, .1]) for (const direction of [-1, 1]) {
    const data = { v: 1, name: 'School source rail pop', spawn: [0, .05, 0], killY: -30,
      skatepark: true, skateReference: school.skateReference, components: [
        { t: 'platform', p: [0, -.5, 0], s: [300, 1, 300], edgeGrinding: false },
        { t: 'rail', p: [0, 14, 60], pts: [[0, 0, 0, 0], [0, -120, 0, slope * 120]], curve: 'corner' },
        { t: 'gate', p: [100, 0, -100] },
      ] };
    const level = new Level(scene, { id: 'school-source-physics', name: data.name, data });
    scene.updateMatrixWorld(true);
    const p = new Player(scene), rail = level.rails[0]; p.endlessDeaths = true;
    const tangent = rail.tangentAt(rail.totalLength / 2).multiplyScalar(direction);
    const heading = tangent.clone().setY(0).normalize();
    const position = rail.pointAt(rail.totalLength / 2).add(new THREE.Vector3(0, .25, 0));
    p.rawInput = makeInput(); p.respawn(level, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
    p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true; p.speed = 18; p.vVel = 0;
    const step = sample => { p.step(CONST.fixedStep, makeInput(sample), level); level.update(CONST.fixedStep); assert.ok(!p.isBailing); };
    try {
      step({ grindHeld: true, grindPressed: true });
      assert.equal(p.grindRail, rail, 'Must catch through normal grind input');
      for (let i = 0; i < 30; i++) step({ grindHeld: true, jumpHeld: true, jumpPressed: i === 0 });
      const takeoffSpeed = p.grindVel;
      step({ grindHeld: true, jumpReleased: true });
      assert.equal(p.state, 'air');
      const expectedPop = 31.5 * 30 * scale; // Tony with first STAT UPGRADE charged ollie, units/tick.
      // HandleJump precedes state physics, so release advances one air step.
      const gravity = 13000 / 4096 * 30 * 30 * scale;
      near(p.vVel, expectedPop + tangent.y * takeoffSpeed - gravity * CONST.fixedStep, 'signed source slope velocity after release step');
      near(p.speed, Math.hypot(tangent.x, tangent.z) * takeoffSpeed, 'horizontal rail velocity');
      results.push({ slope, direction, speed: p.speed, vertical: p.vVel, expectedPop });
    } finally { level.dispose(); }
  }
  assert.equal(JSON.stringify(TUNING), tuningBefore);
  const report = { scale, cases: results, tuningUnchanged: true };
  if (process.env.SCHOOL_PHYSICS_REPORT) await writeFile(process.env.SCHOOL_PHYSICS_REPORT, JSON.stringify(report, null, 2));
  console.log(`PASS ${results.length} source rail ollies: flat, rising and falling in both directions; global tuning unchanged.`);
});
