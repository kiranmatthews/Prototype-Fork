import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();

    const arrow = h.crateNamed('12 / Airborne bounce crate');
    check(arrow?.alive, 'Airborne bounce crate missing');
    function* launch() {
      yield* walk([0, 0, -3.8], 'Approach the trampoline');
      const before = p.trampolineLaunchId;
      yield* charge();yield* tick({ jumpReleased: true });
      yield* until(() => p.trampolineLaunchId > before,
        () => ({ ...steer([0, .12, -8]), jumpHeld: true }),
        { label: 'Hold the trampoline launch', limit: 160 });
    }
    yield* launch();
    yield* until(() => p.vVel < 0, () => steer([-5, 14.2, -8]),
      { label: 'The trampoline alone cannot reach the high receiver', limit: 160 });
    check(!goal.collected && p.pos.y < 14.2, 'The trampoline bypassed the airborne spring');
    r.report.evidence.push({ action: 'trampoline alone misses', apex: p.pos.y });
    yield* until(() => p.grounded, () => steer([-5, 0, -8]),
      { label: 'Land in the flat courtyard for a local retry', limit: 220 });
    yield* launch();
    yield* until(() => p.pos.y > 9.4,
      () => ({ ...steer([2.3, 9.5, -12]), jumpHeld: true }),
      { label: 'Rise beside the airborne crate without hitting its underside', limit: 140 });
    yield* until(() => p.vVel < 0,
      () => ({ ...steer([4, 9.15, -12]), jumpHeld: true }),
      { label: 'Align above the airborne spring at the trampoline apex', limit: 120 });
    yield* until(() => p.vVel > 15 && p.pos.y < 9.5,
      () => ({ ...steer([4, 9.15, -12]), jumpHeld: true }),
      { label: 'Land on the airborne crate for a held second rebound', limit: 150 });
    r.report.evidence.push({ action: 'airborne arrow contact', position: p.pos.toArray(), verticalSpeed: p.vVel });
    yield* until(() => p.pos.y > 12.2, () => ({ ...steer([4, 14.2, -12]), jumpHeld: true }),
      { label: 'Gain height beside the receiver', limit: 100 });
    yield* until(() => p.grounded,
      () => ({ ...steer([8.5, 14.2, -12]), jumpHeld: true }),
      { label: 'Drift onto the high receiver after both launchers', limit: 180 });
    check(Math.abs(p.pos.y - 14.2) < .15, 'The aerial rebound missed the receiver');
    yield* walk([8.5, 14.2, -12], 'Collect the two-launcher crystal');
    check(goal.collected && arrow.alive, 'Crystal or reusable aerial spring missing');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([15, 0, -12]),
      { label: 'Return to the flat courtyard beside both launchers', limit: 280 });
    yield* walk([15, 0, 5], 'Pass around the launchers');yield* walk([0, 0, 5], 'Finish the two-launcher circuit');

  return finish();
}
