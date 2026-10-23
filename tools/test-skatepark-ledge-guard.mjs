import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, Level, Player, scene }) => {
  const results = [];
  for (const mode of ['platformer', 'skatepark', 'source']) {
    const data = { v: 1, name: 'Mesh ledge catch fixture', spawn: [0, .5, .4], killY: -30,
      skatepark: mode !== 'platformer',
      ...(mode === 'source' ? { skateReference: { kind: 'thps1', metresPerUnit: 2.9 / 208.1875, stats: { ollie: 4, speed: 8, air: 8 } } } : {}),
      components: [
        { t: 'platform', p: [0, -.5, 0], s: [60, 1, 60], edgeGrinding: false },
        { t: 'mesh', p: [0, 0, 0], vertices: [-5, 2, 0, 5, 2, 0, 5, 2, -10, -5, 2, -10],
          indices: [0, 1, 2, 0, 2, 3], solid: true, edgeGrinding: false },
        { t: 'gate', p: [20, 0, -20] },
      ] };
    const level = new Level(scene, { id: 'mesh-ledge-guard', name: data.name, data });
    scene.updateMatrixWorld(true);
    const p = new Player(scene); p.rawInput = makeInput({ moveY: 1 });
    const position = new THREE.Vector3(0, .5, .4), heading = new THREE.Vector3(0, 0, -1);
    p.respawn(level, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(-1, 0, 0);
    p.state = 'air'; p.grounded = false; p.vVel = -1; p.lastVelX = 0; p.lastVelZ = -5;
    p.freeSkate = p.airFromSkate = mode !== 'platformer';
    try {
      const caught = p.tryLedgeGrabMesh(level);
      assert.equal(caught, mode === 'platformer', `${mode}: mesh grab policy`);
      assert.equal(p.state === 'hang', mode === 'platformer', `${mode}: on-foot hang state`);
      results.push({ mode, caught, state: p.state });
    } finally { level.dispose(); }
  }
  if (process.env.SCHOOL_LEDGE_REPORT) await writeFile(process.env.SCHOOL_LEDGE_REPORT, JSON.stringify(results, null, 2));
  console.log('PASS platformer mesh catch preserved; default and source skate parks stay mounted.');
});
