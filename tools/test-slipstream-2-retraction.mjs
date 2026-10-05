import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
const sourceSha256 = createHash('sha256').update(await readFile(new URL('../src/levels/slipstream-2.ts', import.meta.url))).digest('hex');
const playerSha256 = createHash('sha256').update(await readFile(new URL('../src/player.ts', import.meta.url))).digest('hex');
const tuningSha256 = createHash('sha256').update(await readFile(new URL('../src/tuning.ts', import.meta.url))).digest('hex');

await withBlockworksRuntime(async r => {
  const m = r.sourceModule, p = r.p, l = r.l, sourceMovers = r.source.components.filter(c => c.t === 'mover');
  assert.equal(sourceMovers.length, 6);
  assert.ok(sourceMovers.every(c => c.axis === 'z' && c.amp === 3 && c.s[2] === 3.8));
  const facade = r.source.components.filter(c => c.nm === 'Temple facade · solid retracting-ledge boundary');
  assert.equal(facade.length, 3); assert.ok(facade.every(c => c.invisible && c.collisionHeight === 19.8));
  const mover = l.movers[0], rowZ = mover.base.z + 2;
  while (mover.mesh.position.z < rowZ + .8 || mover.lastDelta.z < 0) r.tick({});
  const start = [mover.mesh.position.x, mover.base.y + mover.mesh.geometry.parameters.height / 2 + .05, mover.mesh.position.z];
  p.respawn(l, true, false, { position: new r.THREE.Vector3(...start) });
  let supported = false, lostSupport = false, forbiddenInterior = false, mostRetracted = Infinity;
  for (let i = 0; i < 1200 && !['dead', 'gameover'].includes(p.state); i++) {
    r.tick({});
    supported ||= p.grounded && p.groundHit?.moverId === 0;
    lostSupport ||= supported && !p.grounded;
    mostRetracted = Math.min(mostRetracted, mover.mesh.position.z);
    if (p.pos.y > 142.6 && p.pos.y < 162.4 && p.pos.z < rowZ - 3.01) forbiddenInterior = true;
  }
  const report = { sourceSha256, playerSha256, tuningSha256, start, supported, lostSupport, forbiddenInterior, mostRetracted,
    state: p.state, deaths: p.totalDeaths, final: p.pos.toArray() };
  await writeFile(`${tmpdir()}/slipstream-2-retraction.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  assert.ok(supported && lostSupport, 'An idle rider must lose its extending shelf when it retracts');
  assert.equal(forbiddenInterior, false, 'The rider cannot be carried into the sandstone wall');
  assert.ok(mostRetracted <= rowZ - 4.99, 'The full deck must retract behind the facade');
  assert.equal(p.state, 'dead'); assert.equal(p.totalDeaths, 1);
}, { modulePath: '/src/levels/slipstream-2.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 1500,
  controlFrame: r => r.p.courseInputDirection(r.l) ?? { x: r.p.camDir.x, z: r.p.camDir.z } });
