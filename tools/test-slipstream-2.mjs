import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { createSlipstream2Pilot } from './slipstream-2-pilot.mjs';
import { slipstreamPlayableLength } from './slipstream-course-length.mjs';
import { createHash } from 'node:crypto';
import { verifySlipstream2GapReduction } from './slipstream-2-gap-baseline.mjs';

const sourceSha256 = createHash('sha256').update(await readFile(new URL('../src/levels/slipstream-2.ts', import.meta.url))).digest('hex');
const playerSha256 = createHash('sha256').update(await readFile(new URL('../src/player.ts', import.meta.url))).digest('hex');
const tuningSha256 = createHash('sha256').update(await readFile(new URL('../src/tuning.ts', import.meta.url))).digest('hex');

await withBlockworksRuntime(async r => {
  const m = r.sourceModule, p = r.p, l = r.l, before = JSON.stringify(r.TUNING);
  const pilot = createSlipstream2Pilot(m, { nodeCamera: true });
  const gapReduction = await verifySlipstream2GapReduction(m);
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  const original = pack.levels.find(e => e.id === 'slip').data;
  assert.deepEqual(pack.levels.find(e => e.id === 'slipstream-2').data, JSON.parse(JSON.stringify(r.source)), 'Published snapshot must equal source data');
  const laneLength = slipstreamPlayableLength(r.source).playable, originalLength = slipstreamPlayableLength(original).playable;
  assert.ok(Math.abs(originalLength - 1222.7357393865784) < .000001);
  const lengthRatio = laneLength / originalLength;
  assert.ok(lengthRatio >= 2 && lengthRatio <= 2.1, `Sequel playable length ratio ${lengthRatio} is outside 2.0–2.1`);
  assert.equal(m.SLIPSTREAM_2_GAPS.length, 12);
  assert.ok(m.SLIPSTREAM_2_GAPS.every(g => g.width >= 25.2 - 1e-9));
  const errors = [];
  try {
    while (p.state !== 'finished') {
      r.tick(pilot.sample(p, l)); pilot.observe(p, l);
      if (process.argv.includes('--temple') && pilot.evidence.temple.length >= pilot.templeCount) break;
    }
  } catch (error) { errors.push(String(error)); }
  const report = { sourceSha256, playerSha256, tuningSha256, authoredHugeDropDistance: r.TUNING.hugeDropDistance,
    authoredHugeDropImpact: r.TUNING.hugeDropImpact, gapReduction, publishedMatchesSource: true, laneLength, originalLength, lengthRatio, frames: r.frame, seconds: r.frame * r.dt,
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
    assert.equal(pilot.evidence.jumps.length, 12);
    assert.ok(pilot.evidence.jumps.every(j => j.airSeen && j.takeoff.speed > 18));
    assert.equal(pilot.evidence.temple.filter(t => t.moving).length, 6);
    assert.equal(l.checkpoints.length, 16);
    assert.deepEqual(pilot.evidence.checkpoints, Array.from({ length: 16 }, (_, i) => i));
  }
}, { modulePath: '/src/levels/slipstream-2.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 17000,
  controlFrame: r => r.p.courseInputDirection(r.l) ?? { x: r.p.camDir.x, z: r.p.camDir.z } });
