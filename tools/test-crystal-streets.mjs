import { runStreet } from './crystal-street-pilot.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { withBlockworksRuntime, normalizeGameInput } from './blockworks-runner.mjs';

const ids = (process.argv[2] ?? Array.from({ length: 25 }, (_, i) => i + 1).join(',')).split(',').map(Number);
const modes = (process.argv[3] ?? 'walk,skate').split(',');
const waitFrames = Math.round(Number(process.argv[4] ?? 0) * 60);
assert.ok(Number.isFinite(waitFrames) && waitFrames >= 0, 'Start delay must be a nonnegative number of seconds');
const out = process.env.CRYSTAL_STREET_OUT;
if (out) await mkdir(out, { recursive: true });
let failures = 0;
await withBlockworksRuntime(
  async (base) => {
    const m = base.sourceModule;
    const { JAK_DIRECT_PHYSICS } = await base.server.ssrLoadModule('/src/animation/jakDirectMotion.ts');
    const { lanePoint } = await base.server.ssrLoadModule('/src/levels/crystal-trials/street-line.ts');
    const { normalizeCustomLevelData } = await base.server.ssrLoadModule('/src/level.ts');
    for (const course of [m.CRYSTAL_TRIALS_LEVEL, m.CRYSTAL_REJECTS_LEVEL])
      assert.ok(normalizeCustomLevelData(course), `Invalid ${course.name}`);
    for (const id of ids) {
      const trial = m.CRYSTAL_TRIALS[id - 1],
        data = m.trialLevel(trial);
      assert.ok(normalizeCustomLevelData(data));
      for (const mode of modes) {
        const scene = new base.THREE.Scene(),
          l = new base.Level(scene, { id: `street-${id}`, name: data.name, data });
        const p = new base.Player(scene);
        p.onFootJumpStudy = { ...JAK_DIRECT_PHYSICS, flip: true };
        p.enterLevel(`street-${id}`);
        p.respawn(l, true);
        p.endlessDeaths = true;
        let previous = {},
          frame = 0,
          boardFrames = 0;
        const report = { id, mode, waitFrames, passed: false },
          trace = [];
        try {
          assert.equal(l.alwaysSkate, false);
          assert.equal(l.skatepark, false);
          assert.equal(p.freeSkate, false);
          for (const sample of runStreet(
            {
              p,
              l,
              trial,
              lanePoint,
              waitFrames,
              report,
              get frame() {
                return frame;
              },
            },
            mode,
          )) {
            const input = normalizeGameInput(sample, previous);
            previous = { ...input };
            p.step(1 / 60, input, l);
            l.update(1 / 60);
            p.flushLevelCrateRewards(l);
            p.commitRenderStep(l);
            frame++;
            assert.ok(frame < 8000 && !p.isBailing && !p.totalDeaths, `Interrupted during ${report.stage}`);
            if (boardFrames) assert.ok(p.freeSkate, 'Upper line dismounted the rider');
            if (p.freeSkate) boardFrames++;
            if (out && frame % 4 === 0)
              trace.push({
                frame,
                position: p.pos.toArray(),
                heading: p.axisF.toArray(),
                ground: p.groundHit?.name,
                board: p.freeSkate,
              });
          }
          assert.equal(l.skateCollectathon.collected, 1, 'Missing crystal');
          assert.equal(p.state, 'finished');
          assert.ok(p.grounded && p.groundHit?.finishPad, 'Finish requires the supported exit pad');
          assert.equal(l.activeCheckpoint, l.checkpoints[0], 'Missed the starting checkpoint');
          if (mode === 'walk') assert.equal(boardFrames, 0, 'Walking input mounted the board');
          else {
            assert.ok(p.freeSkate && boardFrames > 0, 'Skating line lost the board');
            assert.ok(
              l.trickGates.every((g) => g.unlocked),
              'Missed a kickflip aperture',
            );
            for (const beat of report.beats) {
              const contacts = beat.railContacts.filter((i) => i >= 0);
              if (beat.kind === 'relay') assert.ok(contacts.length >= 2, 'Transfer missed its second handrail');
              if (['rail', 'cable'].includes(beat.kind))
                assert.ok(contacts.length >= 1, 'Missed the authored grind');
            }
            const expectedSprings = trial.line.spans.reduce(
              (n, [kind]) => n + (kind === 'doubleCatch' ? 2 : Number(kind === 'catch' || kind === 'rebound')),
              0,
            );
            assert.equal(p.trampolineLaunchId, expectedSprings, 'Missed a spring landing');
          }
          report.passed = true;
        } catch (error) {
          report.failure = String(error);
          failures++;
        }
        Object.assign(report, {
          frame,
          position: p.pos.toArray(),
          boardFrames,
          deaths: p.totalDeaths,
          crystals: l.skateCollectathon.collected,
          checkpoints: l.checkpoints.filter((cp) => cp.active).length,
          unlockedTricks: l.trickGates.filter((g) => g.unlocked).length,
        });
        console.log(JSON.stringify(report));
        if (out)
          await writeFile(
            `${out}/${String(id).padStart(2, '0')}-${mode}.json`,
            JSON.stringify({ ...report, trace }),
          );
        l.dispose();
        p.group.removeFromParent();
      }
    }
  },
  {
    modulePath: '/src/levels/crystal-trials.ts',
    source: (m) => m.trialLevel(m.CRYSTAL_TRIALS[0]),
    controlFrame: () => ({ x: 0, z: -1 }),
  },
);
// Ordinary input through two deliberately different misses: the lower street
// is safe, and entering the marked pit returns a walker to their saved crate.
for (const id of [7, 8].filter((id) => ids.includes(id))) {
  await withBlockworksRuntime(
    async (r) => {
      const { p, l } = r;
      const { JAK_DIRECT_PHYSICS } = await r.server.ssrLoadModule('/src/animation/jakDirectMotion.ts');
      p.onFootJumpStudy = { ...JAK_DIRECT_PHYSICS, flip: true };
      const cp = l.checkpoints[0];
      r.until(
        () => cp.active,
        () => ({ ...r.steerToward(cp.mesh.position), spinHeld: r.distanceTo(cp.mesh.position) < 2.6 }),
        { label: 'Bank the forecourt checkpoint' },
      );
      if (id === 8) {
        const trigger = l.crates.find((c) => c.bang),
          ghosts = l.crates.filter((c) => c.pending);
        assert.ok(ghosts.length > 5);
        r.until(
          () => trigger.bangUsed,
          () => ({ ...r.steerToward(trigger.mesh.position), spinHeld: r.distanceTo(trigger.mesh.position) < 2.6 }),
          { label: 'Spin the inside switch' },
        );
        assert.ok(
          ghosts.every((c) => !c.pending),
          'Switch failed to reveal the grind shortcut',
        );
        console.log(JSON.stringify({ id, switchOpened: ghosts.length }));
      } else {
        const pit = l.pitBoxes[0],
          centre = pit.getCenter(p.pos.clone());
        const trial = r.sourceModule.CRYSTAL_TRIALS[id - 1];
        const to = (target) =>
          r.until(
            () => r.distanceTo(target) < 0.5,
            () => r.steerToward(target),
            { label: 'Walk along the lower street' },
          );
        for (const [x, d, y] of trial.line.walk.slice(0, 4)) to([x, y, -d]);
        to([35, -8, centre.z]);
        assert.ok(p.grounded && Math.abs(p.pos.y + 8) < 0.2 && p.totalDeaths === 0, 'Recovery floor missing');
        r.until(
          () => p.totalDeaths > 0,
          () => r.steerToward(centre),
          { allowDeath: true, label: 'Walk into the marked pit' },
        );
        r.until(
          () => p.state === 'ride' && p.grounded && r.distanceTo(cp.spawnPos) < 2,
          {},
          { allowDeath: true, label: 'Respawn on the saved approach' },
        );
        assert.equal(p.totalDeaths, 1);
        assert.equal(l.activeCheckpoint, cp);
        console.log(JSON.stringify({ id, flatFloor: true, pitRespawn: true }));
      }
    },
    {
      modulePath: '/src/levels/crystal-trials.ts',
      source: (m) => m.trialLevel(m.CRYSTAL_TRIALS[id - 1]),
      levelId: `street-recovery-${id}`,
      endlessDeaths: true,
      controlFrame: () => ({ x: 0, z: -1 }),
    },
  );
}
if (failures) process.exitCode = 1;
