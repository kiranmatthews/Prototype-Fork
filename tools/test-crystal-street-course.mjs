import assert from 'node:assert/strict';
import { withBlockworksRuntime, normalizeGameInput } from './blockworks-runner.mjs';
import { runStreet } from './crystal-street-pilot.mjs';

await withBlockworksRuntime(
  async ({ p, l, server, sourceModule: m }) => {
    const { JAK_DIRECT_PHYSICS } = await server.ssrLoadModule('/src/animation/jakDirectMotion.ts');
    const { lanePoint } = await server.ssrLoadModule('/src/levels/crystal-trials/street-line.ts');
    p.onFootJumpStudy = { ...JAK_DIRECT_PHYSICS, flip: true };
    let frame = 0,
      previous = {};
    const walk = (sample) => {
      const input = normalizeGameInput(sample, previous);
      previous = { ...input };
      p.step(1 / 60, input, l);
      l.update(1 / 60);
      p.flushLevelCrateRewards(l);
      p.commitRenderStep(l);
      frame++;
      assert.ok(!p.freeSkate && !p.isBailing && !p.totalDeaths, 'Interrupted foot travel in the whole course');
    };
    assert.equal(l.skateCollectathon.tokens.length, 25);
    assert.equal(l.checkpoints.length, 25);
    assert.equal(l.skateCollectathon.exitReady, false);
    for (const [index, trial] of m.CRYSTAL_TRIALS.entries()) {
      const report = {},
        offset = m.trialOrigin(index);
      for (const input of runStreet(
        {
          p,
          l,
          lanePoint,
          offset,
          trial,
          report,
          get frame() {
            return frame;
          },
        },
        'walk',
      ))
        walk(input);
      assert.equal(l.skateCollectathon.collected, index + 1, `Missing crystal ${trial.id}`);
      assert.equal(l.activeCheckpoint, l.checkpoints[index], `Missed checkpoint ${trial.id}`);
      console.log(JSON.stringify({ crystal: trial.id, frame, position: p.pos.toArray() }));
    }
    for (let i = 0; p.state !== 'finished' && i < 600; i++) walk({ moveY: 1 });
    assert.equal(p.state, 'finished');
    assert.ok(p.grounded && p.groundHit?.finishPad);
    console.log(JSON.stringify({ passed: true, crystals: 25, checkpoints: 25, deaths: p.totalDeaths, frame }));
  },
  {
    modulePath: '/src/levels/crystal-trials.ts',
    source: (m) => m.CRYSTAL_TRIALS_LEVEL,
    levelId: 'crystal-trials',
    endlessDeaths: true,
  },
);
