import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Exercise the geometry with the ordinary controller too: no source jump or
// acceleration profile, and no per-frame position/velocity corrections.
await withSkateRuntime(async ({ server, Level, Player, scene, THREE, CONST, TUNING }) => {
  const m = await server.ssrLoadModule('/src/levels/school-source.ts');
  const { Input } = await server.ssrLoadModule('/src/input.ts');
  const { schoolSourceGamepad } = await server.ssrLoadModule('/tools/school-source-lines.ts');
  const data = structuredClone(m.SCHOOL_SOURCE_LEVEL);
  delete data.skateReference;
  const level = new Level(scene, { id: 'school-default-entry-check', name: data.name, data });
  scene.updateMatrixWorld(true);
  const p = new Player(scene), device = new Input(true), before = JSON.stringify(TUNING);
  p.endlessDeaths = true;
  const cases = [];
  try {
    for (const [bank, toe, side] of [['west', -17279, 1], ['east', -13065, -1]]) {
      for (const sourceZ of [9500, 11000, 14000]) for (const direction of [1, -1]) {
        const toeX = m.schoolSourcePoint(toe, 1599, sourceZ)[0];
        const lower = toeX - side * (m.SCHOOL_GYM_ENTRY.runUnits + 100) * m.SCHOOL_SOURCE_SCALE;
        const upper = toeX + side * 2.5;
        const startX = direction === 1 ? lower : upper, endX = direction === 1 ? upper : lower;
        const heading = new THREE.Vector3(side * direction, 0, 0);
        const z = m.schoolSourcePoint(toe, 1599, sourceZ)[2];
        const y = m.schoolMeasuredSupport(startX, z, 6);
        assert.ok(Number.isFinite(y), 'Entry support');
        p.rawInput = makeInput();
        p.respawn(level, true, true, { position: new THREE.Vector3(startX, y + .12, z), heading });
        p.axisF.copy(heading); p.axisL.set(0, 0, -heading.x); p.freeSkate = true; p.speed = 18;
        p.groundHit = p.queryGround(level); assert.ok(p.groundHit);
        p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true; p.rideNormal.copy(p.groundHit.normal);
        // Hold charge throughout; never release it, so there is no ollie.
        device.pollGamepad = () => schoolSourceGamepad({ jumpHeld: true });
        let steps = 0;
        while ((endX - p.pos.x) * heading.x > 0 && steps < 240) {
          device.update(); p.step(CONST.fixedStep, device, level); level.update(CONST.fixedStep); device.consumeEdges(); steps++;
          assert.ok(!p.isBailing && p.grounded && p.state !== 'air', `${bank} ${sourceZ} ${direction}: entry must remain supported`);
          assert.ok(p.pos.toArray().every(Number.isFinite));
        }
        assert.ok(steps < 240, 'Entry traversal timeout');
        cases.push({ bank, sourceZ, direction: direction === 1 ? 'up' : 'down', steps, end: p.pos.toArray() });
      }
    }
    assert.equal(JSON.stringify(TUNING), before);
    const report = { controller: 'default, no skateReference', tuningUnchanged: true, cases };
    if (process.env.SCHOOL_GYM_REPORT) await writeFile(process.env.SCHOOL_GYM_REPORT, JSON.stringify(report, null, 2));
    console.log(`PASS ${cases.length} default-controller gym entries; movement unchanged`);
  } finally { level.dispose(); }
});
