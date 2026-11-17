import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();

    const ropes = [18, 37].map(z => l.ropeSwings.find(s => Math.abs(s.anchor.z - offset[2] + z) < .1));
    check(ropes.every(Boolean), 'One of the climbing ropes is missing');
    const point = p.pos.clone();
    function* catchRope(index) {
      const rope = ropes[index], y = index * 9.2, z = index ? -37 : -18;
      yield* walk([0, y, z], `Wait below climbing rope ${index + 1}`);
      yield* charge();
      yield* until(() => Math.abs(rope.theta) < .12, { jumpHeld: true },
        { label: `Read rope ${index + 1} crossing its low point`, limit: 600 });
      yield* tick({ jumpReleased: true });
      yield* until(() => p.state === 'rope', () => {
        l.ropePointAt(rope, 10.8, point);return steer([point.x - offset[0], point.y, point.z - offset[2]]);
      }, { label: `Catch climbing rope ${index + 1}`, limit: 180 });
      yield* stepFor(2);
    }
    yield* catchRope(0);yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([-6, 0, -22]),
      { label: 'An early low release returns to the flat courtyard', limit: 220 });
    check(!goal.collected && p.pos.y < .2, 'Low release bypassed the rope climbs');
    for (let index = 0; index < 2; index++) {
      yield* catchRope(index);
      yield* until(() => p.ropeD < 3.8, { moveY: 1, skateRelative: true },
        { label: `Climb rope ${index + 1} above its receiving platform`, limit: 360 });
      yield* charge();
      yield* until(() => ropes[index].theta > .4 && ropes[index].theta < .47 && ropes[index].thetaV > 0, { jumpHeld: true },
        { label: `Wait for rope ${index + 1} to swing toward the landing`, limit: 600 });
      yield* tick({ jumpReleased: true });
      const landing = index ? [0, 18.4, -46] : [0, 9.2, -27];
      yield* until(() => p.grounded, () => steer([p.pos.x - offset[0], landing[1], landing[2]]),
        { label: `Release onto receiving platform ${index + 1}`, limit: 220 });
      check(Math.abs(p.pos.y - landing[1]) < .15, 'Climbing release missed its receiver');
      r.report.evidence.push({ action: `rope ${index + 1} high landing`, position: p.pos.toArray() });
    }

    const pad = l.phasePads.find(q => Math.abs(q.mesh.position.z - offset[2] + 56) < .1);
    yield* walk([0, 18.4, -49.8], 'Read the upper timed flight from the permanent rest');
    yield* charge();yield* until(() => pad.on && (l.time / pad.cycle + pad.phase) % 1 < .05, { jumpHeld: true }, { label: 'Wait for the upper timed flight to begin', limit: 700 });
    yield* tick({ jumpReleased: true });
    const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
    yield* until(() => p.grounded, () => straight([0, 19.9, -55]), { label: 'Jump onto the first upper timed step', limit: 180 });
    check(Math.abs(p.pos.y - 19.9) < .15, 'Missed the upper timed flight');
    for (let i = 0; i < 3; i++) {
      const y = 19.9 + i * 1.5, z = -56 - i * 7;
      yield* walk([0, y, z - 1.5], 'Cross the lit upper step');
      yield* charge();yield* tick({ jumpReleased: true });
      const target = i === 2 ? [0, 24.6, -76.2] : [0, y + 1.5, z - 5.8];
      yield* until(() => p.grounded, () => straight(target), { label: 'Transfer across the upper timed flight', limit: 180 });
      check(Math.abs(p.pos.y - target[1]) < .15, 'Upper timed transfer missed its receiver');
    }
    yield* walk([-1.65, 24.6, -80], 'Approach the final bounce crate');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.vVel > 15 && p.pos.y < 26, () => ({ ...steer([0, 25.75, -80]), jumpHeld: true }), { label: 'Hold the final arrow rebound', limit: 180 });
    yield* until(() => p.grounded, () => steer([6, 30.8, -84]), { label: 'Land on the final high receiver', limit: 220 });
    yield* walk([6, 30.8, -84], 'Collect the crystal at the center of the receiver');
    check(goal.collected && Math.abs(p.pos.y - 30.8) < .15, 'The combined route missed its crystal');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([13, 0, -84]), { label: 'Drop to the recovery courtyard', limit: 400 });
    yield* walk([13, 0, 5], 'Walk outside the raised route');yield* walk([0, 0, 5], 'Complete the combined circuit');
  return finish();
}
