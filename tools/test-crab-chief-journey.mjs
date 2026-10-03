import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { withChiefRuntime } from './crab-chief-harness.mjs';
import { runChiefJourney } from './crab-chief-pilot.mjs';
await withChiefRuntime(async context => {
  const generator = runChiefJourney(context), output = '/private/tmp/crab-chief-review';
  await mkdir(output, { recursive: true });
  try {
    let step = generator.next(), oldStage = '';
    while (!step.done) {
      context.tick(step.value); step = generator.next();
      if (context.stage !== oldStage && context.l.boss.state !== 'slam-tell') {
        console.log(JSON.stringify({ stage: context.stage, frame: context.frame, p: context.p.pos.toArray(), hp: context.l.boss.health, hearts: context.l.boss.playerHealth, charge: context.l.boss.charge }));
        oldStage = context.stage;
      }
    }
    assert.equal(context.p.state, 'finished'); assert.equal(context.l.boss.canFinish, true);
    assert.ok(context.p.pos.z>-35,'victory still required visiting the old warp location');
    assert.equal(context.l.crystalPickup,null);assert.equal(context.p.hasCrystal,false);
    assert.equal(context.l.boss.health, 0); assert.equal(context.p.totalDeaths, 0);
    assert.equal(context.p.isBailing, false); assert.equal(context.l.boss.hits, 9);
    assert.deepEqual(context.l.boss.strikes.map(row => row.phase), [1,1,1,2,2,2,3,3,3]);
    assert.ok(context.l.boss.strikes.filter(row => row.phase > 1).every(row => row.charged));
    assert.ok(context.trace.filter(row => row.state === 'grind').length > 180);
    assert.ok(context.l.activeCheckpoint, 'real checkpoint was never activated');
    await writeFile(`${output}/journey.json`, JSON.stringify({ result: step.value, trace: context.trace, boss: context.l.boss.diagnostics }, null, 2));
    console.log('PASS production Player input-only boss journey', JSON.stringify(step.value));
  } catch (error) {
    await writeFile(`${output}/failed-journey.json`, JSON.stringify({ error: String(error), trace: context.trace, boss: context.l.boss.diagnostics }, null, 2));
    throw error;
  }
});
