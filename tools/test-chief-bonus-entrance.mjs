import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

let entries = 0;
await withBlockworksRuntime(async r => {
  const { p, l } = r;
  r.stepFor(30);
  const spawn = p.pos.toArray(), boss = l.boss, parentState = p.captureRunState();
  assert.ok(p.grounded && boss && boss.state === 'waiting');
  assert.deepEqual(l.bonusReturnPoint().toArray(), [0, .1, 15]);
  r.walkTo([0, 0, 15], { pace: .16, label: 'walk up the existing arrival pier' });
  r.walkTo([3.6, 0, 15], { pace: .16, label: 'walk from pier onto the supported side dock' });
  assert.equal(entries, 0, 'walking beside the raised stone triggered a bonus');
  const approach = p.pos.toArray();
  r.jumpTo([6, 1.05, 15], { pace: .25, chargeFrames: 18, arrivalTolerance: 1.45,
    heightTolerance: .15, label: 'deliberate jump onto the tribute stone' });
  r.stepFor(10);
  assert.equal(entries, 1, 'the actual jump landing must enter exactly once');
  assert.equal(l.bonusPlatformAt(p.pos), true);
  assert.equal(boss.state, 'waiting', 'the bonus approach started the fight');
  assert.equal(boss.health, 9); assert.equal(boss.playerHealth, 3);
  const landing = p.pos.toArray();
  p.resumeSuspendedLevel(l, l.bonusReturnPoint(), parentState);
  r.stepFor(30);
  assert.ok(p.grounded && !p.isBailing && p.state !== 'finished');
  assert.equal(l.boss, boss); assert.equal(boss.state, 'waiting');
  assert.ok(p.pos.distanceTo(new r.THREE.Vector3(0, 0, 15)) < .15);
  const report = { spawn, approach, landing, entries, returned: p.pos.toArray(),
    chiefState: boss.state, chiefHealth: boss.health, frames: r.frame };
  await writeFile(join(tmpdir(), 'chief-bonus-entrance-evidence.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('PASS source-spawn walk across the dock, deliberate raised-pad entry and supported pre-fight return');
}, {
  modulePath: '/src/levels/crab-chief.ts', source: m => m.CRAB_CHIEF_LEVEL, levelId: 'crab-chief',
  controlFrame: () => ({ x: 0, z: -1 }),
  onTick: (row, r) => {
    if (r.l.consumeBonusLanding(r.p.pos, { enabled: true, grounded: r.p.grounded,
      jump: row.input.jumpPressed || row.input.jumpReleased, rising: r.p.vVel > .2 })) entries++;
  },
});
