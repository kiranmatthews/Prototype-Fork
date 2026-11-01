import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const fixture = { v: 1, name: 'Crate dimensions', spawn: [8, .1, 8], killY: -20,
  components: [{ t: 'platform', p: [0, -.5, 0], s: [40, 1, 40] },
    { t: 'gate', p: [0, 0, -18] }] };
await withSkateRuntime(async ({ server, THREE, Level }) => {
  const { CRATE_SIZE, RACE_CRATE_SIZE, enlargedCrateLayout, migrateCrateLayout } =
    await server.ssrLoadModule('/src/crateDimensions.ts');
  const { normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  assert.equal(CRATE_SIZE, .96 * 1.2);
  assert.equal(RACE_CRATE_SIZE, 1.92 * 1.2);
  const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);
  const grid = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++)
    grid.push({ p: [(x - 1.5) * .96, y * .96, (z - 1.5) * .96], size: .96 });
  const enlarged = enlargedCrateLayout(grid);
  const backwards = enlargedCrateLayout([...grid].reverse()).reverse();
  enlarged.forEach((p, i) => p.forEach((v, axis) => {
    near(v, grid[i].p[axis] * 1.2, 'six-high grid alignment');
    near(v, backwards[i][axis], 'order-independent migration');
  }));
  assert.deepEqual(enlargedCrateLayout([{ p: [20, 7, 30], size: .96 }]), [[20, 7, 30]]);
  const buried = enlargedCrateLayout([{ p: [20, -.98, 30], size: .96, concealed: true }])[0];
  near(buried[1] + CRATE_SIZE, -.02, 'buried nitro keeps its top below ground');
  const data = structuredClone(fixture);
  data.components.push(...grid.map(({ p }) => ({ t: 'crate', p, kind: 'wood' })));
  migrateCrateLayout(data);
  const once = structuredClone(data);
  migrateCrateLayout(data);
  assert.deepEqual(data, once, 'migration must be idempotent');
  assert.ok(normalizeCustomLevelData(data), 'new layout revision must survive validation');
  assert.equal(normalizeCustomLevelData({ ...data, crateLayoutRevision: 2 }), null);

  const level = new Level(new THREE.Scene(), { id: '__crate_grid', name: data.name, data });
  try {
    for (const c of level.crates) {
      c.box.getSize(new THREE.Vector3()).toArray().forEach(size => near(size, CRATE_SIZE, 'full collider size'));
      near(c.mesh.geometry.parameters.width, CRATE_SIZE, 'art contact proxy');
      near(c.woodCrate.visual.scale.x, CRATE_SIZE, 'wood asset size');
    }
    assert.ok(level.crateRails.length > 0, 'larger touching rows keep their grind edges');
    const homes = level.crates.map(c => c.mesh.position.clone());
    const column = level.crates.filter(c => Math.abs(c.mesh.position.x - homes[0].x) < .01 && Math.abs(c.mesh.position.z - homes[0].z) < .01);
    level.breakCrate(column[0]);
    for (let frame = 0; frame < 240; frame++) level.update(1 / 60);
    near(column[1].box.min.y, 0, 'unsupported stack settles to its floor');
    for (let i = 2; i < column.length; i++) near(column[i].box.min.y, column[i - 1].box.max.y, 'settled stack stays flush');
    level.reset();
    level.crates.forEach((c, i) => {
      near(c.mesh.position.distanceTo(homes[i]), 0, 'reset restores stack height');
      near(c.box.max.y - c.box.min.y, CRATE_SIZE, 'settling never shrinks a collider');
    });
    const captured = level.captureData();
    const copy = new Level(new THREE.Scene(), { id: '__crate_grid_copy', name: data.name, data: captured });
    try {
      copy.crates.forEach((c, i) => near(c.mesh.position.distanceTo(homes[i]), 0, 'capture/reload preserves placement'));
      assert.deepEqual(copy.captureData(), captured, 'save/reload does not grow the layout again');
    } finally { copy.dispose(); }
  } finally { level.dispose(); }
  const legacyData = structuredClone(fixture);
  legacyData.components.push({ t: 'metal', p: [0, 0, 0] }, { t: 'crate', p: [0, .96, 0] },
    { t: 'checkpoint', p: [8, 0, 0] });
  const legacy = new Level(new THREE.Scene(), { id: '__legacy_crate_types', name: fixture.name, data: legacyData });
  try {
    near(legacy.crates[0].box.min.y, CRATE_SIZE, 'wood sits on the enlarged legacy metal box');
    near(legacy.checkpoints[0].box.max.y - legacy.checkpoints[0].box.min.y, CRATE_SIZE, 'checkpoint size');
    const metal = legacy.groundMeshes.find(m => m.userData.metalCrate);
    near(metal.geometry.parameters.height, CRATE_SIZE, 'legacy metal art and support size');
  } finally { legacy.dispose(); }
  console.log('PASS crate dimensions, six-high grids, order independence, buried hazards, migration, art/collision, grind edges, collapse/reset and save/reload.');
}, { levelEntry: { id: '__crate_dimensions', name: fixture.name, data: fixture } });
