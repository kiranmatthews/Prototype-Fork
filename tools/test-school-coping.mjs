import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ Level, Player, scene, THREE, CONST }) => {
  for (const test of [
    { name: 'coping below board', coping: true, railY: 1.9, pass: true },
    { name: 'flush coping', coping: true, railY: 2.15, pass: true },
    { name: 'raised coping still blocks', coping: true, railY: 3, pass: false },
    { name: 'ordinary rail unchanged', coping: false, railY: 1.9, pass: false },
  ]) {
    const data = { v: 1, name: test.name, spawn: [0, 2.25, -3], killY: -10, skatepark: true, components: [
      { t: 'platform', p: [0, 1.65, 0], s: [20, 1, 30], edgeGrinding: false },
      { t: 'rail', p: [0, test.railY, 0], len: 12, yaw: 90, coping: test.coping },
    ] };
    const level = new Level(scene, { id: 'coping-contact-test', name: data.name, data }); scene.updateMatrixWorld(true);
    const p = new Player(scene); p.endlessDeaths = true; p.rawInput = makeInput();
    p.respawn(level, true, true, { position: new THREE.Vector3(0, 2.25, -3), heading: new THREE.Vector3(0, 0, 1) });
    p.axisF.set(0, 0, 1); p.axisL.set(1, 0, 0); p.speed = 12; p.freeSkate = true;
    p.groundHit = p.queryGround(level); assert.ok(p.groundHit); p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true;
    let bailed = false, furthest = p.pos.z;
    for (let n = 0; n < 55; n++) {
      p.step(CONST.fixedStep, makeInput(), level); level.update(CONST.fixedStep);
      furthest = Math.max(furthest, p.pos.z);
      if (p.isBailing) { bailed = true; break; }
    }
    assert.ok(test.pass ? !bailed && p.pos.z > 4 : furthest < -.5 && p.pos.z < 0, `${test.name}: ${p.pos.toArray()}`);
    console.log(`PASS ${test.name}`); level.dispose();
  }
});
