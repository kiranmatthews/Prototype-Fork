import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, balance, lowerReturn, start, finish } = trialControls(r, id);
  yield* start();
  if (r.phaseWait) yield* stepFor(r.phaseWait);

    const ropes = [18, 37].map(z => l.ropeSwings.find(s => Math.abs(s.anchor.z - offset[2] + z) < .1));
    check(ropes.every(Boolean), 'One of the climbing ropes is missing');
    const point = p.pos.clone();
    const rest = l.movers.find(m => Math.abs(m.base.z - offset[2] + 31) < .1);
    check(rest, 'Moving rest is missing');
    function* catchRope(index) {
      const rope = ropes[index], y = index * 9.2, z = index ? -37 : -18;
      yield* walk([0, y, z], `Wait below climbing rope ${index + 1}`, { settle: 0 });
      yield* charge();
      yield* until(() => Math.abs(rope.theta) < .12 && (!index || Math.abs(p.pos.x - offset[0]) < .35), { jumpHeld: true },
        { label: `Read rope ${index + 1} crossing its low point`, limit: 2400 });
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
        { label: `Wait for rope ${index + 1} to swing toward the landing`, limit: 2400 });
      yield* tick({ jumpReleased: true });
      const landing = index ? [0, 18.4, -46] : [0, 9.2, -27];
      yield* until(() => p.grounded, () => steer([p.pos.x - offset[0], landing[1], landing[2]]),
        { label: `Release onto receiving platform ${index + 1}`, limit: 220 });
      check(Math.abs(p.pos.y - landing[1]) < .15, 'Climbing release missed its receiver');
      r.report.evidence.push({ action: `rope ${index + 1} high landing`, position: p.pos.toArray() });
      if (!index) {
        check(p.groundHit?.moverId === l.movers.indexOf(rest), 'The first rope missed the moving rest');
        const x = p.pos.x;yield* stepFor(100);
        check(Math.abs(p.pos.x - x) > .3 && p.grounded, 'The moving rest did not carry the player');
        r.report.evidence.push({ action: 'moving rest carries the player before the second climb', distance: Math.abs(p.pos.x - x) });
      }
    }
    yield* walk([0, 18.4, -47], 'Collect the crystal above both climbs');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([10, 0, -47]),
      { label: 'Drop beside both raised platforms into the courtyard', limit: 300 });
    check(p.pos.y < .2, 'Return did not reach the flat floor');
    yield* walk([10, 0, 5], 'Walk around both climbing ropes');yield* walk([0, 0, 5], 'Finish the two-rope circuit');

  return finish();
}
