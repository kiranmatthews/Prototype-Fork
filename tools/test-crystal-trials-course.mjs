import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { runCrystalTrial } from './crystal-trials-pilot.mjs';
import { puzzleControls } from './puzzle-controls.mjs';

const expected = Number(process.argv[2] ?? 25);
const out = '/workspace/crystal-trials/course';
await mkdir(out, { recursive: true });
await withBlockworksRuntime(async r => {
  const { p, l, sourceModule: m } = r;
  const report = { expected, passed: false, trials: [], navigation: { actions: [], evidence: [] } };
  const tuning = JSON.stringify(r.TUNING);
  assert.equal(m.CRYSTAL_TRIALS.length, expected);
  assert.equal(l.skateCollectathon.tokens.length, expected);
  assert.equal(l.captureData().components.filter(c => c.t === 'crystal').length, expected);
  assert.equal(l.crystalPickup, null);
  assert.equal(new Set(r.source.groups.map(g => g.id)).size, r.source.groups.length);
  assert.equal(r.source.components.filter(c => c.t === 'gate').length, 1);
  console.log(`Starting the connected ${expected}-station controller run.`);
  const navigation = puzzleControls({ ...r, report: report.navigation, get frame() { return r.frame; } });
  const nav = { ...navigation, walk: (q, label, options = {}) => navigation.walk(q, label, { limit: 12_000, ...options }) };
  const run = generator => { for (const sample of generator) r.tick(sample); };
  try {
    const finish = r.source.components.find(c => c.t === 'gate').p;
    // Isolated pre-run fixture checks the distant locked gate with real input.
    p.respawn(l, true, false, { position: new r.THREE.Vector3(finish[0], finish[1] + .15, finish[2] + 4), heading: new r.THREE.Vector3(0,0,-1) });
    run(nav.stepFor(12));
    run(nav.walk(finish, 'Try the final exit before retrieving any crystals'));
    assert.notEqual(p.state, 'finished');
    assert.equal(l.skateCollectathon.exitReady, false);
    p.respawn(l, true);run(nav.stepFor(12));
    let corridorZ = 80;
    for (let index = 0; index < m.CRYSTAL_TRIALS.length; index++) {
      const trial = m.CRYSTAL_TRIALS[index], offset = m.trialOrigin(index);
      if (index > 0) {
        run(nav.walk([34, -8, corridorZ], 'Join the flat corridor beside the station'));
        run(nav.walk([34, -8, offset[2] + 68], `Walk through the clear gap to challenge ${trial.id}`));
        run(nav.walk([0, -8, offset[2] + 68], 'Line up with the next approach ramp'));
      }
      run(nav.walk([0, -8, offset[2] + 66], `Approach challenge ${trial.id} from the flat floor`));
      run(nav.walk([0, 0, offset[2] + 11], `Climb the approach to challenge ${trial.id}`));
      run(nav.walk(trial.spawn.map((v, i) => i === 1 ? 0 : v + offset[i]), `Enter challenge ${trial.id} on foot`));
      const local = { id: trial.id, actions: [], evidence: [], expectedDeaths: p.totalDeaths };
      report.trials.push(local);
      const route = trial.id > 10 ? (await import(`./crystal-trials-pilots/${trial.id}.mjs`)).runCrystalTrial : runCrystalTrial;
      run(route({ ...r, offset, report: local, get frame() { return r.frame; } }, trial.id));
      assert.equal(l.skateCollectathon.collected, index + 1);
      assert.equal(l.skateCollectathon.exitReady, index + 1 === expected);
      assert.equal(p.hasCrystal, false, 'practice goals must not grant campaign rewards');
      local.end = r.snapshot();
      run(nav.walk([offset[0], 0, offset[2] + 9], `Leave challenge ${trial.id} through its return`));
      run(nav.walk([0, 0, offset[2] + 11], 'Rejoin the approach landing'));
      run(nav.walk([0, -8, offset[2] + 66], 'Descend to the continuous flat floor'));
      corridorZ = offset[2] + 66;
      await writeFile(`${out}/progress.json`, JSON.stringify({ completed: index + 1, frame: r.frame, trial: trial.id }) + '\n');
      console.log(`Completed challenge ${trial.id}/${expected} and its corridor return at frame ${r.frame}.`);
    }
    run(nav.walk([34, -8, corridorZ], 'Join the corridor after the final challenge'));
    run(nav.walk([34, -8, finish[2]], 'Continue to the final exit'));
    run(nav.until(() => p.state === 'finished', () => nav.steer(finish),
      { label: 'Finish through the real gate after challenge 25', limit: 800 }));
    assert.equal(l.skateCollectathon.collected, expected);
    assert.equal(JSON.stringify(r.TUNING), tuning);
    report.finish = r.snapshot();
    l.reset(false); assert.equal(l.skateCollectathon.collected, expected);
    l.reset(true); assert.equal(l.skateCollectathon.collected, 0);
    report.passed = true;
  } finally {
    await writeFile(`${out}/native.json`, JSON.stringify(report, null, 2) + '\n');
    await writeFile(`${out}/trace.json`, JSON.stringify(r.trace) + '\n');
  }
  console.log(`PASS connected Crystal Trials: all ${expected} goals, ordinary navigation, real gate, checkpoints, recovery and fresh-run reset.`);
}, { modulePath: '/src/levels/crystal-trials.ts', source: m => m.CRYSTAL_TRIALS_LEVEL,
  levelId: 'crystal-trials', endlessDeaths: true, maxFrames: 600_000,
  controlFrame: () => ({ x: 0, z: -1 }) });

await withBlockworksRuntime(r => {
  const report = { actions: [], evidence: [] }, h = puzzleControls({ ...r, report, get frame() { return r.frame; } });
  assert.equal(r.l.skateCollectathon.exitReady, true);
  const finish = r.source.components.find(c => c.t === 'gate').p;
  r.p.respawn(r.l, true, false, { position: new r.THREE.Vector3(finish[0], finish[1] + .15, finish[2] + 4), heading: new r.THREE.Vector3(0,0,-1) });
  for (const sample of h.until(() => r.p.state === 'finished', () => h.steer(finish),
    { label: 'Leave the rejects archive without solving its experiments', limit: 300 })) r.tick(sample);
  assert.equal(r.l.skateCollectathon.collected, 0);
  console.log('PASS rejects archive: original attempts retained and its gate is immediately usable.');
}, { modulePath: '/src/levels/crystal-trials.ts', source: m => m.CRYSTAL_REJECTS_LEVEL,
  levelId: 'crystal-trials-rejects', controlFrame: () => ({ x: 0, z: -1 }) });
