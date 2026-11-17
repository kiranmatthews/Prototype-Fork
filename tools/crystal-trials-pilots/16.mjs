import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, until, charge, steer, check, start, finish } = trialControls(r, id);
  yield* start();
  const arrow = h.crateNamed('16 / Airborne bounce crate');
  const nitros = l.crates.filter(c => c.nitro && Math.abs(c.mesh.position.z - offset[2] + 12) < .1 && c.box.min.y === 8);
  check(arrow?.alive && nitros.length === 2, 'The airborne Nitro frame is missing');
  function* launch() {
    yield* walk([0, 0, -3.8], 'Approach the trampoline');
    const before = p.trampolineLaunchId;
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.trampolineLaunchId > before, () => ({ ...steer([0, .12, -8]), jumpHeld: true }),
      { label: 'Hold the trampoline launch', limit: 180 });
  }
  yield* launch();
  yield* until(() => p.state === 'dead', () => steer([2, 8, -12]),
    { label: 'A drift into the visible Nitro frame causes a death', limit: 300, allowDeath: true });
  yield* until(() => p.grounded && p.state === 'ride' && !p.isBailing, {},
    { label: 'Recover at the launcher checkpoint with the Nitro frame restored', limit: 700, allowDeath: true });
  r.report.expectedDeaths = p.totalDeaths;
  check(nitros.every(c => c.alive) && !goal.collected, 'Checkpoint did not restore the precision challenge');
  yield* launch();
  yield* until(() => p.pos.y > 9.4, () => ({ ...steer([4, 9.5, -10]), jumpHeld: true }),
    { label: 'Rise in front of the Nitro frame', limit: 180 });
  yield* until(() => p.vVel < 0, () => ({ ...steer([4, 9.15, -12]), jumpHeld: true }),
    { label: 'Align above the safe spring between the Nitro', limit: 140 });
  yield* until(() => p.vVel > 15 && p.pos.y < 9.5, () => ({ ...steer([4, 9.15, -12]), jumpHeld: true }),
    { label: 'Rebound from the airborne spring without touching Nitro', limit: 180 });
  r.report.evidence.push({ action: 'precision aerial spring contact', position: p.pos.toArray(), nitrosIntact: nitros.every(c => c.alive) });
  yield* until(() => p.pos.y > 12.2, () => ({ ...steer([4, 14.2, -12]), jumpHeld: true }),
    { label: 'Rise beside the narrow landing', limit: 100 });
  yield* until(() => p.grounded, () => ({ ...steer([8.5, 14.2, -12]), jumpHeld: true }),
    { label: 'Land between the four Nitro corners', limit: 180 });
  check(Math.abs(p.pos.y - 14.2) < .15, 'Missed the narrow high receiver');
  yield* walk([8.5, 14.2, -12], 'Collect the Nitro-frame crystal');
  check(goal.collected, 'Nitro-frame crystal missing');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => steer([15, 0, -12]),
    { label: 'Leave through the open side of the Nitro frame', limit: 280 });
  yield* walk([15, 0, 5], 'Walk around the launchers');yield* walk([0, 0, 5], 'Finish the Nitro-frame circuit');
  return finish();
}
