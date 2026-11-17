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
    yield* tick({ spinHeld: true, spinPressed: true, skateRelative: true });
    yield* until(() => p.grounded, () => steer([0, 3.1, -85]), { label: 'Pop onto the raised receiver', limit: 180 });
    check(Math.abs(p.pos.y - 3.1) < .15, 'Final rail pop missed the raised receiver');
    yield* until(() => !p.freeSkate, { moveY: -1 }, { label: 'Brake on the receiver', limit: 180 });

    const gate = l.trickGates.find(g => Math.abs(g.center.z - offset[2] + 80.5) < .1);
    check(gate?.unlocked, 'The rail exit did not unlock the kickflip gate');
    r.report.evidence.push({ action: 'kickflip from the rail unlocks the aperture' });
    const enemy = l.enemies.find(e => e.kind === 'spinner' && Math.abs(e.group.position.z - offset[2] + 94) < 1);
    check(enemy?.alive, 'Retracting enemy missing');
    yield* walk([0, 3.1, -91.8], 'Read the blade cycle from the safe terrace');
    yield* until(() => enemy.state === 'out' && enemy.stateT < .1, {}, { label: 'Observe an extended blade cycle', limit: 300 });
    yield* stepFor(90);
    check(enemy.alive && !goal.collected, 'The safe observation skipped the enemy');
    yield* until(() => enemy.state === 'in' && enemy.stateT < .1, {}, { label: 'Wait for the blades to retract', limit: 300 });
    yield* walk([0, 3.1, -92.65], 'Approach inside the retracted window', { settle: 0 });
    yield* tick({ spinHeld: true });yield* stepFor(20);
    yield* walk([0, 3.1, -94], 'Pass the defeated enemy');
    check(!enemy.alive, 'The timed spin did not defeat the enemy');
    r.report.evidence.push({ action: 'defeated retracted enemy after reading its full dangerous cycle' });
    yield* walk([-1.65, 3.1, -100], 'Approach the terrace bounce crate');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.vVel > 15 && p.pos.y < 4.5, () => ({ ...steer([0, 4.25, -100]), jumpHeld: true }), { label: 'Hold the terrace rebound', limit: 180 });
    yield* until(() => p.grounded, () => steer([6, 9.3, -100]), { label: 'Land above the enemy terrace', limit: 220 });
    check(Math.abs(p.pos.y - 9.3) < .15, 'The spring missed the upper rope terrace');

  const rope = l.ropeSwings.find(q => Math.abs(q.anchor.z - offset[2] + 109) < .1), point = p.pos.clone();
  yield* walk([6, 9.3, -109], 'Read the upper climbing rope from its terrace');
  yield* charge();yield* until(() => Math.abs(rope.theta) < .12, { jumpHeld: true }, { label: 'Wait for the upper rope crossing', limit: 600 });
  yield* tick({ jumpReleased: true });
  yield* until(() => p.state === 'rope', () => { l.ropePointAt(rope, 10.8, point);return steer([point.x - offset[0], point.y, point.z - offset[2]]); }, { label: 'Catch the upper rope', limit: 180 });
  yield* stepFor(2);yield* until(() => p.ropeD < 3.8, { moveY: 1, skateRelative: true }, { label: 'Climb above the upper receiving platform', limit: 360 });
  yield* charge();yield* until(() => rope.theta > .4 && rope.theta < .47 && rope.thetaV > 0, { jumpHeld: true }, { label: 'Read the upper release window', limit: 600 });
  yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => steer([p.pos.x - offset[0], 18.5, -118]), { label: 'Release onto the upper receiving platform', limit: 220 });
  check(Math.abs(p.pos.y - 18.5) < .15, 'The upper rope missed its receiver');
  r.report.evidence.push({ action: 'upper rope after the preceding combinations', position: p.pos.toArray() });

  const pad = l.phasePads.find(q => Math.abs(q.mesh.position.z - offset[2] + 128) < .1);
  yield* walk([6, 18.5, -121.8], 'Read the final timed flight');
  yield* charge();yield* until(() => pad.on && (l.time / pad.cycle + pad.phase) % 1 < .05, { jumpHeld: true }, { label: 'Wait for the final timed cycle', limit: 700 });
  yield* tick({ jumpReleased: true });
  const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
  yield* until(() => p.grounded, () => straight([6, 20, -127]), { label: 'Jump onto the final timed flight', limit: 180 });
  check(Math.abs(p.pos.y - 20) < .15, 'Missed the final timed flight');
  for (let i = 0; i < 3; i++) {
    const y = 20 + i * 1.5, z = -128 - i * 7;
    yield* walk([6, y, z - 1.5], 'Cross the final lit step');yield* charge();yield* tick({ jumpReleased: true });
    const target = i === 2 ? [6, 24.7, -148.2] : [6, y + 1.5, z - 5.8];
    yield* until(() => p.grounded, () => straight(target), { label: 'Transfer across the final timed steps', limit: 180 });
    check(Math.abs(p.pos.y - target[1]) < .15, 'Final timed transfer missed');
  }
  yield* walk([6, 24.7, -152], 'Collect the crystal after the final timed steps');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => steer([15, -8, -151]), { label: 'Drop to the flat return', limit: 420 });
  yield* lowerReturn(-151);
  return finish();
}
