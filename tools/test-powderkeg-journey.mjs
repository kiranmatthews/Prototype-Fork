// Powderkeg Peak · input-only journey test. POWDERKEG_START=crest|tarn|hoist|east|summit begins at that checkpoint.
import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runPowderkegJourney, POWDERKEG_STARTS} from './powderkeg-journey.mjs';
const from = process.env.POWDERKEG_START ?? null, start = from ? POWDERKEG_STARTS[from] : null;
if (from && !start) throw new Error(`Unknown POWDERKEG_START ${from}`);
await withBlockworksRuntime(async r => {
  const lines = [];
  try { await runPowderkegJourney(r, { from, collect: process.env.POWDERKEG_COLLECT === '1', log: line => { lines.push(line); console.log('JOURNEY', line); } }); }
  catch (error) { console.log('JOURNEY FAILED', String(error.message).slice(0, 600)); console.log('JOURNEY state', JSON.stringify({ masks: r.p.masks, uber: +r.p.uberTimer.toFixed(1), cratesBroken: r.p.cratesBroken, time: +r.l.time.toFixed(1) })); for (const t of r.trace.slice(-Number(process.env.POWDERKEG_TRACE ?? 0))) if (t.frame % 6 === 0) console.log('JOURNEY trace', t.frame, t.position.map(v => +v.toFixed(2)).join(' '), t.state, t.grounded ? 'G' : 'air', 'v', (+t.speed).toFixed(1), t.ground?.name ?? '-', JSON.stringify(t.requested)); process.exitCode = 1; return; }
  const seconds = +(r.frame * r.CONST.fixedStep).toFixed(1);
  const left = r.l.crates.filter(c => c.alive && !c.pending && !c.metal && !c.metalBounce && !c.bang && !c.nitroBang);
  console.log('JOURNEY', JSON.stringify({ state: r.p.state, seconds, deaths: r.p.totalDeaths, cratesBroken: r.p.cratesBroken, crates: r.l.crates.length, left: left.length }));
  if (process.env.POWDERKEG_COLLECT === '1') for (const c of left) console.log('JOURNEY left', c.mesh.position.toArray().map(v => +v.toFixed(1)).join(' '), c.tnt ? 'tnt' : c.nitro ? 'nitro' : c.mesh.userData.sourceName ?? '');
  if (from === null) { assert.equal(r.p.state, 'finished'); assert.equal(r.p.totalDeaths, 0); }
}, { modulePath: '/src/levels/powderkeg-peak.ts', levelId: 'powderkeg-peak', source: m => m.POWDERKEG_PEAK_LEVEL, endlessDeaths: true, maxFrames: 60000,
  ...(start ? { start: start.position, heading: start.heading } : {}),
  controlFrame: r => { const lane = r.p.courseInputDirection(r.l); if (lane) return lane; const zone = r.l.zoneAt(r.p.pos.x, r.p.pos.z)?.dir; return zone === 'E' || zone === 'W' ? { x: 0, z: -1 } : { x: r.p.camDir.x, z: r.p.camDir.z }; } });
