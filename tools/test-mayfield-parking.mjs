import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const out = process.env.MAYFIELD_OUTPUT || '/tmp/mayfield-parking-validation';
await mkdir(out, {recursive: true});
await withBlockworksRuntime(async r => {
  const {p, l, THREE, server, sourceModule: m} = r;
  const mall = await server.ssrLoadModule('/src/levels/mall.ts');
  const {transformPoint} = await server.ssrLoadModule('/src/levels/mayfield-source.ts');
  const garage = m.MAYFIELD_SOURCE_PROVENANCE.find(a => a.assembly === 'Mall parking garage');
  assert.ok(garage.triangles > 10000 && garage.solid > 50);
  const at = (x, s, ceiling) => transformPoint([x, mall.mallSupport(x, -s, ceiling), -s], garage.transform);
  const tuning = JSON.stringify(r.TUNING), quarters = [], walls = [];
  const drive = (x, z) => {
    const f = p.courseInputDirection(l) ?? p.camDir;
    return {moveX: x * -f.z + z * f.x, moveY: x * f.x + z * f.z, jumpHeld: true};
  };
  for (const f of [
    {name: 'Upper parking quarter', start: at(0, 30, 156), z: -1},
    {name: 'Lower parking quarter', start: at(-17, -30, 138), z: 1},
  ]) {
    p.respawn(l, true, false, {position: new THREE.Vector3(...f.start).add(new THREE.Vector3(0, .08, 0)), heading: new THREE.Vector3(0, 0, f.z)});
    r.stepFor(5);
    const e = {name: f.name, vert: 0, air: 0, returned: false, maxStep: 0, peak: f.start[1], bail: false, trace: []};
    for (let i = 0; i < 900; i++) {
      const before = p.pos.clone();
      r.tick(p.grounded ? drive(0, e.air ? Math.sign(f.start[2] - p.pos.z) : f.z) : {jumpHeld: true});
      e.maxStep = Math.max(e.maxStep, p.pos.distanceTo(before));
      e.peak = Math.max(e.peak, p.pos.y);
      if (p.groundHit?.vert && p.rideNormal.y < .97) e.vert++;
      if (e.vert && !p.grounded) e.air++;
      e.bail ||= p.isBailing;
      if (i % 5 === 0) e.trace.push({i, p: p.pos.toArray(), state: p.state, normal: p.rideNormal.toArray()});
      if (e.air && p.grounded && p.pos.y <= f.start[1] + .3) {e.returned = true; break;}
      if (e.bail || p.state === 'dead') break;
    }
    e.height = e.peak - f.start[1]; quarters.push(e);
  }
  // Cross the exact seam that previously let a rider leave the garage through
  // its visible side wall. These are real controller samples after placement.
  for (const side of [-1, 1]) {
    const edge = side < 0 ? -21.946701 : 7.360911;
    const start = at(edge - side * 2, 47, 165);
    const boundary = transformPoint([edge, 0, 0], garage.transform)[0];
    p.respawn(l, true, false, {position: new THREE.Vector3(...start).add(new THREE.Vector3(0, .08, 0)), heading: new THREE.Vector3(side, 0, 0)});
    r.stepFor(5);
    let escape = -Infinity;
    for (let i = 0; i < 120; i++) {
      r.tick(drive(side, 0)); escape = Math.max(escape, (p.pos.x - boundary) * side);
      if (p.isBailing) break;
    }
    walls.push({side, escape, position: p.pos.toArray(), state: p.state});
  }
  const report = {quarters, walls, tuningUnchanged: tuning === JSON.stringify(r.TUNING)};
  await writeFile(`${out}/parking-contact.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({...report, quarters: quarters.map(({trace, ...e}) => e)}, null, 2));
  assert.ok(quarters.every(e => e.vert > 0 && e.air > 0 && e.returned && !e.bail && e.maxStep < 1));
  assert.ok(walls.every(e => e.escape < .1), 'Quarter side walls must contain the board at the curved floor seam');
  assert.ok(report.tuningUnchanged);
}, {modulePath: '/src/levels/mayfield-mall.ts', source: m => m.MAYFIELD_MALL_LEVEL, levelId: 'mayfield-mall', maxFrames: 2400});
