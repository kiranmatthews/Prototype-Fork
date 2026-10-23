import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, Level, Player, scene, THREE, CONST }) => {
  const { buildBendyWallGeometry, parseCustomLevelJson } = await server.ssrLoadModule('/src/level.ts');
  const wall = { t: 'wallpath', p: [0, 0, 0], pts: [[0, 0, 0, 0], [12, 0, 0, 2]], curve: 'corner', rise: 6, w: .2, wallHeights: [2, 6], invisible: true, edgeGrinding: false };
  const data = { v: 1, name: 'Wall profile test', spawn: [3, .1, -3], killY: -15, skatepark: true, components: [wall] };
  assert.ok(parseCustomLevelJson(JSON.stringify(data)));
  for (const patch of [{ wallHeights: [-1, 3] }, { wallHeights: [1] }, { wallHeights: [1, Infinity] }, { curve: 'spline' }, { closed: true }, { collisionHeight: 2 }, { wallHeights: [0, 100000] }])
    assert.equal(parseCustomLevelJson(JSON.stringify({ ...data, components: [{ ...wall, ...patch }] })), null);
  const built = buildBendyWallGeometry(wall);
  assert.deepEqual(built.heights, [2, 6]);
  assert.equal(built.geometry.boundingBox.max.y, 8);
  assert.equal(built.geometry.boundingBox.min.y, 0);
  assert.ok(built.collision.some(b => Math.abs(b.max.y - 7.8) < 1e-6), 'Preserve the native 0.2 m top-contact inset');
  built.geometry.dispose();
  const level = new Level(scene, { id: 'wall-profile-test', name: data.name, data });
  const path = level.wallPathForBox(level.walls[0]);
  for (const [x, base, height] of [[0, 0, 2], [3, .5, 3], [6, 1, 4], [9, 1.5, 5], [12, 2, 6]]) {
    const contact = level.closestWallPath(path, x, .1);
    assert.ok(Math.abs(contact.y - base) < 1e-8); assert.ok(Math.abs(contact.height - height) < 1e-8);
    assert.ok(Math.abs(level.wallPathSample(path, x).height - height) < 1e-8);
  }
  level.dispose();
  const legacy = { ...wall }; delete legacy.wallHeights;
  const old = buildBendyWallGeometry(legacy); assert.equal(old.heights, undefined); assert.equal(old.geometry.boundingBox.max.y, 8); old.geometry.dispose();

  for (const test of [
    { name: 'above low end', x: 3, floor: 2.5, base: 0, heights: [0, 4], pass: true },
    { name: 'tall end blocks', x: 9, floor: 2.5, base: 0, heights: [0, 4], pass: false },
    { name: 'open under lintel', x: 6, floor: 0, base: 4, heights: [2, 5], pass: true },
    { name: 'ordinary wall unchanged', x: 3, floor: 0, base: 0, pass: false },
  ]) {
    const w = { ...wall, p: [0, test.base, 0], pts: [[0, 0], [12, 0]], ...(test.heights ? { wallHeights: test.heights } : {}) };
    if (!test.heights) delete w.wallHeights;
    const d = { ...data, components: [{ t: 'platform', p: [6, test.floor - .5, 0], s: [30, 1, 24], edgeGrinding: false }, w] };
    const l = new Level(scene, { id: 'wall-profile-native', name: test.name, data: d }); scene.updateMatrixWorld(true);
    const p = new Player(scene); p.endlessDeaths = true; p.rawInput = makeInput();
    p.respawn(l, true, true, { position: new THREE.Vector3(test.x, test.floor + .1, -3), heading: new THREE.Vector3(0, 0, 1) });
    p.axisF.set(0, 0, 1); p.axisL.set(1, 0, 0); p.freeSkate = true; p.speed = 6;
    p.groundHit = p.queryGround(l); assert.ok(p.groundHit); p.pos.y = p.groundHit.y; p.grounded = true; p.prevPos.copy(p.pos);
    let furthest = p.pos.z;
    for (let i = 0; i < 120; i++) { p.step(CONST.fixedStep, makeInput(), l); l.update(CONST.fixedStep); assert.ok(!p.isBailing); furthest = Math.max(furthest, p.pos.z); }
    assert.ok(test.pass ? p.pos.z > 1 : p.pos.z < -.45 && furthest > -.8, `${test.name}: ${p.pos.toArray()}`);
    console.log(`PASS wall profile: ${test.name} (${p.pos.z.toFixed(3)})`); l.dispose();
  }
  console.log('PASS wall profile schema, exact geometry, interpolated contacts and 4 native approaches');
});
