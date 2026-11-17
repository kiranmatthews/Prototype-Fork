import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();

    const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
    function* first(group) {
      const y = group * 6.2, z = group * -34;
      yield* walk([0, y, z - 3.8], 'Wait on the permanent bank');
      yield* charge();
      yield* tick({ jumpReleased: true });
      yield* until(() => p.grounded, () => straight([0, y + 1.5, z - 9]),
        { label: `Jump onto crumbling flight ${group + 1}`, limit: 180 });
      check(Math.abs(p.pos.y - y - 1.5) < .15, 'First crumbling step missed');
    }
    function* finishFlight(group) {
      const baseY = group * 6.2, baseZ = group * -34;
      for (let i = 0; i < 3; i++) {
        const y = baseY + (i + 1) * 1.5, z = baseZ - 10 - i * 7;
        yield* walk([0, y, z - 1.5], 'Cross the lit step before it crumbles');
        yield* charge();yield* tick({ jumpReleased: true });
        const target = i === 2 ? [0, baseY + 6.2, baseZ - 30.2] : [0, y + 1.5, z - 5.8];
        yield* until(() => p.grounded, () => straight(target), { label: 'Jump to the next crumbling step or permanent island', limit: 180 });
        check(Math.abs(p.pos.y - target[1]) < .15, 'Crumbling transfer missed its receiver');
      }
      r.report.evidence.push({ action: `completed crumbling flight ${group + 1}`, position: p.pos.toArray() });
    }
    yield* first(0);yield* finishFlight(0);
    yield* stepFor(570);
    check(p.grounded && Math.abs(p.pos.y - 6.2) < .15, 'The resting island did not remain safe through a full upper cycle');
    yield* first(1);
    yield* until(() => p.grounded && p.pos.y < -7.8, {},
      { label: 'A late upper transfer falls to the flat recovery floor', limit: 900 });
    check(!goal.collected, 'The missed upper transfer collected the crystal');
    yield* lowerReturn(-43);
    for (let group = 0; group < 2; group++) { yield* first(group);yield* finishFlight(group); }

    yield* walk([-1.65, 12.4, -68], 'Approach the bounce crate after the crumbling flights');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.vVel > 15 && p.pos.y < 13.8, () => ({ ...steer([0, 13.55, -68]), jumpHeld: true }), { label: 'Hold the high arrow rebound', limit: 180 });
    yield* until(() => p.grounded, () => steer([6, 18.6, -72]), { label: 'Land above the crumbling route', limit: 220 });
    yield* walk([6, 18.6, -72], 'Collect the crystal at the center of the receiver');
    check(Math.abs(p.pos.y - 18.6) < .15 && goal.collected, 'The final rebound missed its crystal');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([12, -8, -72]), { label: 'Drop to the flat recovery floor', limit: 340 });
    yield* lowerReturn(-72);
  return finish();
}
