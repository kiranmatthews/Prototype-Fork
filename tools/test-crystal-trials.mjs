import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const id = Number(process.argv[2] ?? 1);
const historicalPilot = (await import(process.env.CRYSTAL_TRIAL_PILOT ?? (id > 10 ? `./crystal-trials-pilots/${id}.mjs` : './crystal-trials-pilot.mjs'))).runCrystalTrial;
const { runSkateTrial } = await import('./crystal-skate-pilot.mjs');
const phaseDelay = Number(process.argv[3] ?? 0);
const out = process.env.CRYSTAL_TRIAL_OUT ?? `/workspace/crystal-trials/${String(id).padStart(2, '0')}`;
await mkdir(out, { recursive: true });
const previous = `${out}/attempt-${Date.now()}`;
await mkdir(previous, { recursive: true });
for (const file of ['native.json', 'trace.json', 'layout.json'])
  await copyFile(`${out}/${file}`, `${previous}/${file}`).catch(error => { if (error.code !== 'ENOENT') throw error; });
await withBlockworksRuntime(async r => {
  const report = { id, phaseDelay, actions: [], evidence: [], passed: false };
  const tuning = JSON.stringify(r.TUNING);
  const { normalizeCustomLevelData, migrateCustomLevel } = await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(r.source), 'trial survives source/editor validation');
  const captured = normalizeCustomLevelData(r.l.captureData());
  assert.equal(captured?.crystalTrials, 'challenge', 'capture lost the practice mode');
  assert.equal(captured.components.filter(c => c.t === 'crystal').length, 1, 'capture lost the trial crystal');
  for (const source of [r.sourceModule.CRYSTAL_TRIALS_LEVEL, r.sourceModule.CRYSTAL_REJECTS_LEVEL])
    assert.ok(normalizeCustomLevelData(source), `${source.name} survives editor validation`);
  const ordinary = { ...structuredClone(r.source), crystalTrials: undefined,
    components: [...r.source.components, { t: 'crystal', p: [1, 0, 0] }] };
  assert.equal(migrateCustomLevel(ordinary).components.filter(c => c.t === 'crystal').length, 1,
    'ordinary courses keep exactly one crystal');
  try {
    const trial = r.sourceModule.CRYSTAL_TRIALS.find(t => t.id === id);
    const pilot = trial.skateLine && !process.env.CRYSTAL_TRIAL_PILOT ? runSkateTrial : historicalPilot;
    for (const sample of pilot({ ...r, trial, report, phaseWait: Math.round(phaseDelay / r.dt), get frame() { return r.frame; } }, id)) r.tick(sample);
    assert.equal(r.l.skateCollectathon.collected, 1);
    assert.equal(r.l.crystalPickup, null, 'practice rewards cannot write the campaign crystal');
    assert.equal(r.p.hasCrystal, false);
    assert.equal(r.p.totalDeaths, report.expectedDeaths ?? 0);
    assert.equal(JSON.stringify(r.TUNING), tuning, 'movement baseline changed');
    report.result = r.snapshot();
    r.l.reset(false);
    assert.equal(r.l.skateCollectathon.collected, 1, 'soft recovery lost earned crystal');
    r.l.reset(true);
    assert.equal(r.l.skateCollectathon.collected, 0, 'new run retained old crystal');
    report.passed = true;
  } finally {
    await writeFile(`${out}/layout.json`, JSON.stringify(r.sourceModule.CRYSTAL_TRIALS.find(t => t.id === id), null, 2) + '\n');
    await writeFile(`${out}/native.json`, JSON.stringify(report, null, 2) + '\n');
    await writeFile(`${out}/trace.json`, JSON.stringify(r.trace) + '\n');
  }
  console.log(`PASS crystal trial ${id}: real inputs, pickup, safe landing, checkpoint, resets, editor data and unchanged movement.`);
}, { modulePath: process.env.CRYSTAL_TRIAL_MODULE ?? '/src/levels/crystal-trials.ts',
  source: m => m.trialLevel(m.CRYSTAL_TRIALS.find(t => t.id === id)),
  levelId: `__crystal-trial-${id}`, controlFrame: () => ({ x: 0, z: -1 }) });
