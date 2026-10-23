import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallFountainRoutes, createMallFountainPilot} from './mall-fountain-route-pilot.mjs';
await withBlockworksRuntime(async r => {
  const {p, l, THREE, sourceModule: m} = r, fixtures = [], tuning = JSON.stringify(r.TUNING);
  for (const f of mallFountainRoutes) {
    const q = m.mallPoint(...f.start); q[1] = m.mallSupport(q[0], q[2], q[1] + 1) + .1;
    const heading = new THREE.Vector3(0, 0, -1);
    p.respawn(l, true, false, {position: new THREE.Vector3(...q), heading});
    p.axisF.copy(heading); p.axisL.set(1, 0, 0);
    const pilot = createMallFountainPilot(f);
    while (!pilot.e.done) {
      r.tick(pilot.sample(p, m.mallSourcePoint(...p.pos.toArray())));
      pilot.observe(p, m.mallSourcePoint(...p.pos.toArray()));
    }
    fixtures.push(pilot.e); console.log(JSON.stringify({...pilot.e, trace: undefined}));
  }
  const report = {fixtures, tuningUnchanged: tuning === JSON.stringify(r.TUNING)};
  await writeFile('/private/tmp/mall-recreation/measured/fountain-route.json', JSON.stringify(report, null, 2));
  assert.ok(report.tuningUnchanged);
  assert.ok(fixtures.every(f => f.reached && !f.bail && f.jumps.length === 4 &&
    f.jumps.every(j => j.state === 'ride') && f.fountainFrames > 40 && f.end[0] > -6450 && Math.abs(f.end[1] - 314.7586) < 1));
}, {modulePath: '/src/levels/mall-measured.ts', source: m => m.MALL_LEVEL,
  levelId: 'mall', endlessDeaths: true, maxFrames: 6000, controlFrame: r => r.p.axisF});
