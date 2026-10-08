import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
const replay = JSON.parse(await readFile(new URL('./fixtures/slipstream-camera/replay.json', import.meta.url), 'utf8'));
await withBlockworksRuntime(async r => {
  const { Replayer } = await r.server.ssrLoadModule('/src/replay.ts');
  const { CameraFallHold } = await r.server.ssrLoadModule('/src/cameraRig.ts');
  const replayer = new Replayer(), oldHold = new CameraFallHold(), fixedHold = new CameraFallHold(), input = {};
  const windows = [[2590, 2609], [3018, 3035], [3436, 3453]], recovered = windows.map(() => ({ old: 0, fixed: 0, landed: false }));
  const fatalStarts = [3782, 4769, 6291, 6786], fatal = fatalStarts.map(() => ({ frames: 0, missed: 0 }));
  const trajectory = createHash('sha256');
  replayer.begin(replay);
  try {
    for (let f = 0; f < replay.frames; f++) {
      replayer.feed(input, r.p.camDir); r.tick(input);
      const old = oldHold.shouldHold(r.p, r.l.killY);
      const state = JSON.stringify([r.p.pos.toArray(), r.p.speed, r.p.vVel, r.p.state, r.p.grounded]);
      const fixed = fixedHold.shouldHold(r.p, r.l.killY, () => r.p.cameraLandingAhead(r.l));
      assert.equal(JSON.stringify([r.p.pos.toArray(), r.p.speed, r.p.vVel, r.p.state, r.p.grounded]), state, 'camera query changed movement');
      trajectory.update(state);
      for (let i = 0; i < windows.length; i++) if (f >= windows[i][0] && f <= windows[i][1]) {
        recovered[i].old += +old; recovered[i].fixed += +fixed; recovered[i].landed ||= r.p.grounded;
      }
      for (let i = 0; i < fatalStarts.length; i++) if (f >= fatalStarts[i] && f < fatalStarts[i] + 40) {
        fatal[i].frames++; fatal[i].missed += +!fixed;
      }
    }
  } finally { replayer.end(); }
  assert.deepEqual(recovered.map(x => x.old), [6, 8, 8], 'original false freezes no longer reproduce');
  assert.ok(recovered.every(x => x.fixed === 0 && x.landed), 'successful lower catches must stay live');
  assert.ok(fatal.every(x => x.frames === 40 && x.missed === 0), 'real fatal falls lost their hold');
  assert.equal(r.p.totalDeaths, 4);
  const report = { frames: replay.frames, recovered, fatal, deaths: r.p.totalDeaths, trajectory: trajectory.digest('hex') };
  await writeFile(`${tmpdir()}/slipstream-fall-replay.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}, { modulePath: '/tools/fixtures/slipstream-camera/original-course.ts', source: m => m.SLIPSTREAM_2_LEVEL,
  levelId: 'slipstream-2', endlessDeaths: true, maxFrames: 9000 });
