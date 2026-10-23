import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, Level, Player, scene, THREE, CONST, TUNING }) => {
  const m = await server.ssrLoadModule('/src/levels/school-source.ts');
  const { parseCustomLevelJson } = await server.ssrLoadModule('/src/level.ts');
  const data = m.SCHOOL_SOURCE_LEVEL, before = JSON.stringify(TUNING);
  assert.ok(parseCustomLevelJson(JSON.stringify(data)), 'Measured level must survive editor validation');
  assert.equal(m.SCHOOL_SOURCE_STATS.railEdges, 270);
  const source = JSON.parse(await readFile(new URL('../docs/school/source-geometry.json', import.meta.url), 'utf8'));
  const edgeKey = (a, b) => [Math.min(a, b), Math.max(a, b)].join(':');
  const originalEdges = new Set(source.railActivation.paths.flatMap(ids => ids.slice(1).map((b, i) => edgeKey(ids[i], b))));
  const builtEdges = [];
  for (const rail of m.SCHOOL_SOURCE_RAILS) for (let i = 0; i < rail.ids.length - (rail.closed ? 0 : 1); i++) builtEdges.push(edgeKey(rail.ids[i], rail.ids[(i + 1) % rail.ids.length]));
  assert.equal(builtEdges.length, 331, 'Original activated chains retain their 61 overlapping sections');
  assert.deepEqual(m.SCHOOL_SOURCE_RAILS.map(r => r.ids), source.railActivation.paths, 'Preserve source-directed chain boundaries');
  assert.deepEqual(new Set(builtEdges), originalEdges, 'Preserve every normally activated link and gap');
  assert.ok(!builtEdges.includes('189:190'), 'Exclude the alternate-mode-only rail');
  assert.ok(m.SCHOOL_SOURCE_RAILS.filter(r => r.ids.includes(258) || r.ids.includes(260)).every(r => r.coping), 'Raised gym toes are flush bank coping');
  const level = new Level(scene, { id: 'school-source', name: data.name, data }); scene.updateMatrixWorld(true);
  const p = new Player(scene); p.endlessDeaths = true;
  const report = { scale: m.SCHOOL_SOURCE_SCALE, components: data.components.length, stats: m.SCHOOL_SOURCE_STATS, supports: [], trials: [], failures: [] };
  const place = (original, heading, speed = 0) => {
    const position = new THREE.Vector3(...m.schoolSourcePoint(...original));
    p.rawInput = makeInput(); p.respawn(level, true, true, { position, heading: new THREE.Vector3(...heading) });
    p.axisF.set(...heading).normalize(); p.axisL.set(p.axisF.z, 0, -p.axisF.x); p.freeSkate = true; p.speed = speed;
    p.groundHit = p.queryGround(level); assert.ok(p.groundHit, `Missing support at ${original}`);
    p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true; p.rideNormal.copy(p.groundHit.normal);
  };
  const run = (name, init, sample, observe, limit = 480) => {
    let done = false, frame = 0, error = null, air = 0, verts = 0, grinds = 0, maxStep = 0, peak = -Infinity;
    try {
      init(); const previous = p.pos.clone();
      for (; frame < limit; frame++) {
        const input = makeInput(sample(frame)); p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); input.consumeEdges();
        assert.ok(!p.isBailing, 'bail'); assert.ok(p.pos.toArray().every(Number.isFinite));
        air += p.state === 'air' ? 1 : 0; verts += p.vertAir ? 1 : 0; grinds += p.state === 'grind' ? 1 : 0;
        peak = Math.max(peak, p.pos.y); maxStep = Math.max(maxStep, p.pos.distanceTo(previous)); previous.copy(p.pos);
        if (observe({ frame, air, verts, grinds, peak })) { done = true; frame++; break; }
      }
      assert.ok(done, 'timeout');
    } catch (e) { error = String(e); report.failures.push({ name, error }); }
    report.trials.push({ name, passed: done && !error, frames: frame, air, verts, grinds, peak, maxStep, end: p.pos.toArray(), sourceEnd: m.schoolOriginalPoint(...p.pos.toArray()), error });
    console.log(`${error ? 'FAIL' : 'PASS'} ${name}: ${error || frame + ' steps'}`);
  };
  try {
    const ray = new THREE.Raycaster();
    for (const q of m.SCHOOL_SOURCE_PLACES) {
      const position = m.schoolSourcePlacement(q); ray.set(new THREE.Vector3(...position).add(new THREE.Vector3(0, .5, 0)), new THREE.Vector3(0, -1, 0)); ray.far = 2;
      const hit = ray.intersectObjects(level.groundMeshes, false)[0]; assert.ok(hit, q.name); assert.ok(Math.abs(hit.point.y - position[1] + .12) < .002, q.name); report.supports.push({ name: q.name, expected: position[1] - .12, actual: hit.point.y });
    }
    const { schoolSourceTrials } = await server.ssrLoadModule('/tools/school-source-lines.ts');
    for (const c of schoolSourceTrials(p, level, place)) run(c.name, c.init, c.sample, ({ frame }) => c.observe(frame + 1), c.limit);
    assert.equal(JSON.stringify(TUNING), before); report.tuningUnchanged = true;
  } finally { await writeFile(process.env.SCHOOL_SOURCE_REPORT || '/private/tmp/school-miami-review/source-native.json', JSON.stringify(report, null, 2)); level.dispose(); }
  assert.equal(report.failures.length, 0, JSON.stringify(report.failures));
});
