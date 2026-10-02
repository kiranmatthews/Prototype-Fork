import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

// Local contact proof begins on the main afterdeck. It is not a complete
// cave-to-finish journey; those remain covered by the pirate level pilot.
const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
const source = pack.levels.find(entry => entry.id === 'drowned-crown').data;
let entries = 0;
await withBlockworksRuntime(async r => {
  const { p, l } = r;
  r.stepFor(30);
  assert.ok(p.grounded);
  const before = p.captureRunState(), start = p.pos.toArray();
  const stone = l.bonusPlatformDiagnostics;
  assert.deepEqual([stone.x, stone.y, stone.z], [-6, 8, -121]);
  r.walkTo([-3.6, 8, -121], { pace: .16, label: 'walk across the broad afterdeck to the bonus' });
  assert.equal(entries, 0);
  const approach = p.pos.toArray();
  r.jumpTo([-6, 9.05, -121], { pace: .4, chargeFrames: 18, arrivalTolerance: 1.2,
    heightTolerance: .15, label: 'deliberate jump onto the afterdeck bonus stone' });
  r.stepFor(10);
  assert.equal(entries, 1); assert.equal(l.bonusPlatformAt(p.pos), true);
  assert.notEqual(p.state, 'hang', 'bonus approach caught an unrelated ship ledge');
  const landing = p.pos.toArray();
  p.resumeSuspendedLevel(l, l.bonusReturnPoint(), before);
  r.stepFor(30);
  assert.ok(p.grounded && !p.isBailing && p.state !== 'finished');
  assert.ok(p.pos.distanceTo(new r.THREE.Vector3(-3.5, 8, -124)) < .15);
  const report = { start, approach, landing, entries, returned: p.pos.toArray(), frames: r.frame };
  await writeFile(join(tmpdir(), 'pirate-bonus-entrance-evidence.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  console.log('PASS published pirate afterdeck walk, deliberate centered bonus entry and supported return');
}, {
  source: () => source, levelId: 'drowned-crown', start: [0, 8.12, -121],
  controlFrame: r => r.l.laneDirAt(r.p.pos.x, r.p.pos.y, r.p.pos.z) ?? { x: 0, z: -1 },
  onTick: (row, r) => {
    if (r.l.consumeBonusLanding(r.p.pos, { enabled: true, grounded: r.p.grounded,
      jump: row.input.jumpPressed || row.input.jumpReleased, rising: r.p.vVel > .2 })) entries++;
  },
});
