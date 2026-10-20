import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { createSlipstream2Pilot } from './slipstream-2-pilot.mjs';
import { slipstreamPlayableLength } from './slipstream-course-length.mjs';
import { createHash } from 'node:crypto';


const sourceSha256 = createHash('sha256').update(await readFile(new URL('../src/levels/slipstream-2.ts', import.meta.url))).digest('hex');
const playerSha256 = createHash('sha256').update(await readFile(new URL('../src/player.ts', import.meta.url))).digest('hex');
const tuningSha256 = createHash('sha256').update(await readFile(new URL('../src/tuning.ts', import.meta.url))).digest('hex');

await withBlockworksRuntime(async r => {
  const m = r.sourceModule, p = r.p, l = r.l, before = JSON.stringify(r.TUNING);
  const highRoute = process.argv.includes('--high-route');
  const pilot = createSlipstream2Pilot(m, { nodeCamera: true, highRoute });

  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const original = pack.levels.find(e => e.id === 'slip').data;
  assert.deepEqual(pack.levels.find(e => e.id === 'slipstream-2').data, JSON.parse(JSON.stringify(r.source)), 'Published snapshot must equal source data');
  const laneLength = slipstreamPlayableLength(r.source).playable, originalLength = slipstreamPlayableLength(original).playable;
  assert.ok(Math.abs(originalLength - 1222.7357393865784) < .000001);
  const lengthRatio = laneLength / originalLength;
  assert.ok(laneLength > 850 && laneLength < 1300, `Redesigned course must stay compact: ${laneLength}`);
  assert.equal(m.SLIPSTREAM_2_GAPS.length, 3);
  assert.ok(m.SLIPSTREAM_2_GAPS.every(g => g.width >= 18 && g.width <= 29));
  const errors = [];
  try {
    while (p.state !== 'finished') {
      r.tick(pilot.sample(p, l)); pilot.observe(p, l);
      if (process.argv.includes('--temple') && pilot.evidence.temple.length >= pilot.templeCount) break;
    }
  } catch (error) { errors.push(String(error)); }
  const report = { sourceSha256, playerSha256, tuningSha256, authoredHugeDropDistance: r.TUNING.hugeDropDistance,
    authoredHugeDropImpact: r.TUNING.hugeDropImpact, publishedMatchesSource: true, laneLength, originalLength, lengthRatio, frames: r.frame, seconds: r.frame * r.dt,
    state: p.state, phase: pilot.phase, position: p.pos.toArray(), deaths: p.totalDeaths,
    evidence: pilot.evidence, errors, traceTail: r.trace.slice(-100) };
  await writeFile(`${tmpdir()}/slipstream-2-journey.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ sourceSha256, laneLength, originalLength, lengthRatio, frames: r.frame,
    seconds: r.frame * r.dt, state: p.state, deaths: p.totalDeaths, templeLandings: pilot.evidence.temple.length,
    movingLandings: pilot.evidence.temple.filter(t => t.moving).length, jumps: pilot.evidence.jumps.length,
    checkpoints: pilot.evidence.checkpoints.length, maxSpeed: pilot.evidence.maxSpeed, errors }, null, 2));
  assert.deepEqual(errors, []);
  assert.equal(JSON.stringify(r.TUNING), before, 'Journey must preserve authored movement tuning');
  assert.equal(p.totalDeaths, 0);
  if (!process.argv.includes('--temple')) {
    assert.equal(p.state, 'finished');
    assert.equal(pilot.evidence.temple.length, pilot.templeCount);
    assert.equal(pilot.evidence.jumps.length, 3);
    assert.ok(pilot.evidence.jumps.every(j => j.airSeen && j.takeoff.speed > 18));
    assert.equal(pilot.evidence.temple.filter(t => t.moving).length, 1);
    assert.equal(l.checkpoints.length, 7);
    assert.deepEqual(pilot.evidence.checkpoints, Array.from({ length: 7 }, (_, i) => i));
    if (highRoute) {
      assert.ok(pilot.evidence.highRailFrames > 60, 'high route must ride the real rail');
      assert.equal(pilot.evidence.crystal, true, 'high route must earn the crystal');
    } else assert.equal(pilot.evidence.crystal, false, 'low road must leave the optional crystal');
  }
}, { modulePath: '/src/levels/slipstream-2.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 17000,
  controlFrame: r => r.p.courseInputDirection(r.l) ?? { x: r.p.camDir.x, z: r.p.camDir.z } });
