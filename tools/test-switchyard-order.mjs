import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { withPuzzleRuntime, runInputPilot } from './test-puzzle-trilogy.mjs';
import { puzzleControls } from './puzzle-trilogy-pilot.mjs';

/** Deliberately wrong ordinary input sequences; no crate or player mutations. */
export function* probeSwitchyardOrder(r, kind) {
  const c = puzzleControls(r), { p, l } = r;
  const lower = c.crateSpecAt(5, 0), upper = c.crateSpecAt(5, .96);
  const life = c.crateNamed('Upper-first target: lost if both striped supports are cleared early');
  yield* c.stepFor(20);
  const before = { lower: lower.alive, upper: upper.alive, reward: life.alive, rewardBase: life.box.min.y };
  let maximumFeet = p.pos.y, maximumSilhouette = p.characterBounds.max.y;
  const track = () => {
    maximumFeet = Math.max(maximumFeet, p.pos.y);
    maximumSilhouette = Math.max(maximumSilhouette, p.characterBounds.max.y);
  };
  if (kind === 'floor-double') {
    yield* c.walk([7.1, 0, 0], 'floor-only takeoff clear of the support stack');
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel < .65, () => { track(); return {}; },
      { label: 'ordinary floor jump apex', limit: 100 });
    yield* c.tick({ jumpHeld: true }); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel < .1,
      () => { track(); return c.steer([5, life.box.min.y, 0]); },
      { label: 'ordinary floor double approaches the high reward', limit: 100 });
    yield* c.until(() => p.grounded,
      () => { track(); return c.steer([7.1, 0, 0]); },
      { label: 'floor-only attempt lands without a support bounce', limit: 180 });
  } else if (kind === 'single-support') {
    yield* c.walk([3.3, 0, 0], 'upper-only early removal takeoff');
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.pos.y > 1.8, {}, { label: 'rise clear of the lower support', limit: 60 });
    yield* c.until(() => !upper.alive,
      () => c.steer([5, 1.8, 0]),
      { label: 'exhaust upper support with ordinary bounces before taking the cap', limit: 1200 });
    c.check(lower.alive && !upper.alive,
      `single-support probe must conserve the lower striped box (lower=${lower.alive}, upper=${upper.alive})`);
    yield* c.until(() => p.grounded, () => c.steer([3.3, 0, 0]),
      { label: 'land with exactly one finite support remaining', limit: 180 });
    yield* c.stepFor(35);
    const hits = lower.hitsRemaining;
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => lower.hitsRemaining < hits,
      () => { track(); return c.steer([5, lower.box.max.y, 0]); },
      { label: 'remaining single striped support rebound', limit: 160 });
    yield* c.until(() => p.vVel < .65,
      () => { track(); return c.steer([5, life.box.min.y, 0]); },
      { label: 'single-support rebound apex', limit: 100 });
    yield* c.tick({ jumpHeld: true }); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel < .1,
      () => { track(); return c.steer([5, life.box.min.y, 0]); },
      { label: 'single-support double-jump high reward attempt', limit: 100 });
    yield* c.until(() => p.grounded,
      () => { track(); return c.steer([7.1, 0, 0]); },
      { label: 'wrong-order attempt leaves the finite support intact', limit: 180 });
  } else if (kind === 'spent-switch-support') {
    const key = c.crateNamed('Independent workshop circuit local ! switch');
    const launcher = c.crateNamed('Return-loop launch: save it until after the far !');
    const row = l.crates.filter(crate => crate.pending && crate.mesh.position.x >= 138 && crate.mesh.position.x <= 145);
    c.check(row.length === 3, 'spent-switch probe must start with three genuine outline rewards');
    yield* c.hit(key, 'materialize the genuine upper return row');
    yield* c.hit(launcher, 'wrong order: destroy return launcher before claiming the upper row');
    c.check(!launcher.alive && row.every(crate => !crate.pending), 'wrong-order setup failed');
    yield* c.walk([145.3, 2.8, 0], 'permanent switch rebound takeoff');
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel > 13 && p.pos.y > key.box.max.y &&
      p.pos.y < key.box.max.y + .1 && p.prevPos.y > key.box.max.y - .05,
      () => c.steer([147, key.box.max.y, 0]),
      { label: 'real stomp rebound from the permanent spent switch', limit: 180 });
    maximumFeet = p.pos.y; maximumSilhouette = p.characterBounds.max.y;
    yield* c.until(() => p.vVel < .65,
      () => { track(); return c.steer([144, 12.4, 0]); },
      { label: 'spent switch rebound apex', limit: 100 });
    yield* c.tick({ ...c.steer([144, 12.4, 0]), jumpHeld: true });
    yield* c.tick({ ...c.steer([144, 12.4, 0]), jumpReleased: true });
    yield* c.until(() => p.vVel < .1,
      () => { track(); return c.steer([144, 12.4, 0]); },
      { label: 'spent switch double attempts the upper return reward', limit: 100 });
    yield* c.until(() => p.grounded,
      () => { track(); return c.steer([145.3, 2.8, 0]); },
      { label: 'spent switch bypass attempt returns to ordinary floor', limit: 180 });
    const result = { id: r.id, kind, maximumFeet, maximumSilhouette,
      before: { outlinedRewards: 3, switchActivated: true, launcherDestroyed: true },
      after: { reward: row.every(crate => crate.alive), remainingRewards: row.filter(crate => crate.alive).length,
        rewardBases: row.map(crate => crate.box.min.y), launcherAlive: launcher.alive },
      state: p.state, deaths: p.totalDeaths };
    r.report.evidence.push(result);
    c.check(result.after.reward, 'permanent spent switch bypassed the conserved-arrow upper row');
    return result;
  } else throw Error(`Unknown negative order probe ${kind}`);
  const result = { id: r.id, kind, before, maximumFeet, maximumSilhouette,
    after: { lower: lower.alive, upper: upper.alive, reward: life.alive, rewardBase: life.box.min.y },
    state: p.state, deaths: p.totalDeaths };
  r.report.evidence.push(result);
  c.check(life.alive, `${kind} bypassed the authored upper-first dependency`);
  return result;
}

export async function runSwitchyardOrderChecks() {
  const reports = [];
  for (const kind of ['floor-double', 'single-support', 'spent-switch-support']) {
    await withPuzzleRuntime('switchyard', async r => {
      try {
        const report = runInputPilot(r, r => probeSwitchyardOrder(r, kind));
        assert.equal(report.after.reward, true);
        assert.equal(report.deaths, 0);
        reports.push(report);
      } catch (error) {
        await writeFile('/private/tmp/switchyard-order-failure.json',
          JSON.stringify({ kind, error: error.message, report: r.report }, null, 2));
        throw error;
      }
    }, { start: kind === 'spent-switch-support' ? [145.3, 2.92, 0]
      : [kind === 'floor-double' ? 7.1 : 3.8, .12, 0], maxFrames: 2500 });
  }
  await writeFile('/private/tmp/switchyard-negative-order.json', JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports.map(({ kind, maximumFeet, maximumSilhouette, after }) =>
    ({ kind, maximumFeet, maximumSilhouette, after })), null, 2));
  console.log('PASS Switchyard floor, single-support and permanent-switch all-box failures use actual animated contacts');
  return reports;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await runSwitchyardOrderChecks();
