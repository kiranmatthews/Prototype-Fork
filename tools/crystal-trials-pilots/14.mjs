import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();

    const pads = [10, 17, 24, 44, 51, 58].map(z => l.phasePads.find(q => Math.abs(q.mesh.position.z - offset[2] + z) < .1));
    check(pads.every(Boolean), 'Timed platform missing');
    const phase = q => (l.time / q.cycle + q.phase) % 1;
    const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
    function* first(group) {
      const y = group * 6.2, z = group * -34, pad = pads[group * 3];
      yield* walk([0, y, z - 3.8], 'Wait on the permanent bank');
      yield* charge();yield* until(() => pad.on && phase(pad) < .05, { jumpHeld: true },
        { label: `Read the start of timed flight ${group + 1}`, limit: 700 });
      yield* tick({ jumpReleased: true });
      yield* until(() => p.grounded, () => straight([0, y + 1.5, z - 9]),
        { label: `Jump onto timed flight ${group + 1}`, limit: 180 });
      check(Math.abs(p.pos.y - y - 1.5) < .15, 'First timed step missed');
    }
    function* finishFlight(group) {
      const baseY = group * 6.2, baseZ = group * -34;
      for (let i = 0; i < 3; i++) {
        const y = baseY + (i + 1) * 1.5, z = baseZ - 10 - i * 7;
        yield* walk([0, y, z - 1.5], 'Cross the lit step before it withdraws');
        yield* charge();yield* tick({ jumpReleased: true });
        const target = i === 2 ? [0, baseY + 6.2, baseZ - 30.2] : [0, y + 1.5, z - 5.8];
        yield* until(() => p.grounded, () => straight(target), { label: 'Jump to the next timed step or permanent island', limit: 180 });
        check(Math.abs(p.pos.y - target[1]) < .15, 'Timed transfer missed its receiver');
      }
      r.report.evidence.push({ action: `completed timed flight ${group + 1}`, position: p.pos.toArray() });
    }
    yield* first(0);yield* finishFlight(0);
    yield* stepFor(570);
    check(p.grounded && Math.abs(p.pos.y - 6.2) < .15, 'The resting island did not remain safe through a full upper cycle');
    yield* first(1);
    yield* until(() => p.grounded && p.pos.y < -7.8, {},
      { label: 'A late upper transfer falls to the flat recovery floor', limit: 700 });
    check(!goal.collected, 'The missed upper transfer collected the crystal');
    yield* lowerReturn(-43);
    for (let group = 0; group < 2; group++) { yield* first(group);yield* finishFlight(group); }
    yield* walk([0, 12.4, -68], 'Collect the crystal after both timed flights');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([11, -8, -68]), { label: 'Drop to the recovery floor beside the steps', limit: 300 });
    yield* lowerReturn(-68);

  return finish();
}
