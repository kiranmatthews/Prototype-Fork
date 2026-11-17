import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();

    function* catchRail() {
      yield* walk([0, 0, 2], 'Line up with the first rail');
      yield* charge(26, { moveY: 1 });
      yield* tick({ moveY: 1, jumpReleased: true, grindHeld: true });
      yield* until(() => p.state === 'grind', { moveY: 1, grindHeld: true }, { label: 'Catch the first transfer rail', limit: 160 });
      check(Math.abs(p.grindRail.totalLength - 25) < .1, 'Caught the wrong rail');
    }
    yield* catchRail();
    yield* until(() => p.state === 'dead', balance,
      { label: 'Riding straight misses the offset rail and falls into the pit', limit: 900, allowDeath: true });
    yield* until(() => p.grounded && p.state === 'ride' && !p.isBailing, {},
      { label: 'Recover at the transfer checkpoint', limit: 700, allowDeath: true });
    r.report.expectedDeaths = p.totalDeaths;
    check(!goal.collected, 'The missed transfer bypassed the route');
    yield* catchRail();
    for (const [z, side, name] of [[-16, 1, 'right'], [-42, -1, 'left']]) {
      yield* until(() => p.pos.z < offset[2] + z, balance, { label: `Balance to the ${name} transfer`, limit: 900 });
      const from = p.grindRail;
      yield* stepFor(26, () => ({ ...balance(), jumpHeld: true }));
      yield* tick({ moveX: side, jumpHeld: true, grindHeld: true, skateRelative: true });
      yield* tick({ moveX: side, jumpReleased: true, skateRelative: true });
      yield* tick({});
      yield* until(() => p.state === 'grind', { grindHeld: true }, { label: `Catch the ${name} offset rail`, limit: 180 });
      check(p.grindRail !== from, 'Transfer caught its departure rail again');
      r.report.evidence.push({ action: `${name} rail transfer`, position: p.pos.toArray(), railLength: p.grindRail.totalLength });
    }
    yield* until(() => p.pos.z < offset[2] - 73, balance, { label: 'Balance to the final receiver', limit: 900 });
    yield* stepFor(26, () => ({ ...balance(), jumpHeld: true }));
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, 3.1, -85]), { label: 'Pop onto the raised receiver', limit: 180 });
    check(Math.abs(p.pos.y - 3.1) < .15, 'Final rail pop missed the raised receiver');
    yield* until(() => !p.freeSkate, { moveY: -1 }, { label: 'Brake on the receiver', limit: 180 });
    yield* walk([0, 3.1, -86], 'Collect the transfer crystal');
    check(goal.collected, 'Transfer crystal missing');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([10, -8, -86]), { label: 'Drop outside the pit onto the flat return', limit: 240 });
    yield* lowerReturn(-86);

  return finish();
}
