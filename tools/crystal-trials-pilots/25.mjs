import { trialControls } from './common.mjs';
export function* runCrystalTrial(r, id) {
  const { p, l, offset, h, goal, walk, tick, stepFor, until, charge, steer, check, start, finish } = trialControls(r, id);
  yield* start();
  const tnt = h.crateNamed('25 / TNT trigger'), bang = h.crateNamed('25 / Enclosed switch'), arrow = h.crateNamed('25 / Revealed bounce crate');
  check(tnt && bang && arrow?.pending, 'TNT reveal wiring is missing');
  const unrelated = l.crates.filter(c => c.pending && c !== arrow);
  yield* walk([4.5, 0, -8], 'Approach the enclosed switch from its side');
  yield* walk([3.7, 0, -13.1], 'Read the switch behind the transparent panel');
  yield* tick({ spinHeld: true });yield* stepFor(40);
  check(!bang.bangUsed && arrow.pending, 'A direct side spin reached the enclosed switch');
  r.report.evidence.push({ action: 'direct spin cannot reach the enclosed switch' });
  yield* walk([4.5, 0, -8], 'Leave the enclosed switch');
  yield* walk([-2, 0, -7.5], 'Walk around the front of the TNT');
  yield* walk([-2, 0, -10], 'Set up a falling stomp onto TNT');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => tnt.fuse !== undefined, () => steer([0, 1, -10]), { label: 'Stomp TNT to start its visible fuse', limit: 180 });
  check(tnt.alive && !bang.bangUsed, 'The timed setup did not preserve a live fuse');
  yield* until(() => p.grounded, () => steer([-5, 0, -10]), { label: 'Retreat outside the blast radius', limit: 180 });
  yield* until(() => bang.bangUsed && !arrow.pending, {}, { label: 'The timed blast operates the remote switch', limit: 260 });
  check(!tnt.alive && unrelated.every(c => c.pending), 'The blast changed an unrelated outline group');
  r.report.evidence.push({ action: 'TNT activates the enclosed switch', position: p.pos.toArray(), switchUsed: bang.bangUsed, arrowRevealed: !arrow.pending });
  const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
  yield* walk([-7, 0, -16], 'Approach the revealed steps');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => straight([-7, 2.2, -20.2]), { label: 'Jump onto the first revealed step', limit: 180 });
  check(Math.abs(p.pos.y - 2.2) < .15, 'Missed the first revealed step');
  yield* walk([-7, 2.2, -22.5], 'Cross the first step');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => straight([-7, 4.4, -27.2]), { label: 'Jump onto the revealed spring terrace', limit: 180 });
  check(Math.abs(p.pos.y - 4.4) < .15, 'Missed the spring terrace');
  yield* walk([-8.65, 4.4, -29], 'Approach the revealed bounce crate');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.vVel > 15 && p.pos.y < 5.8, () => ({ ...steer([-7, 5.55, -29]), jumpHeld: true }), { label: 'Hold the revealed arrow rebound', limit: 180 });
  yield* until(() => p.grounded, () => steer([-1, 10.2, -33]), { label: 'Land on the high receiver', limit: 200 });
  check(Math.abs(p.pos.y - 10.2) < .15, 'Missed the high receiver');

  const upper = h.crateNamed('25 / Upper bounce crate');
  check(upper?.pending, 'First switch revealed the second group prematurely');
  yield* walk([-.4, 10.2, -34], 'Approach the second switch');
  yield* h.hit(h.crateNamed('25 / Second switch'), 'Activate only the upper group');
  check(!upper.pending && arrow.alive && !arrow.pending, 'Second switch broke the first group');
  r.report.evidence.push({ action: 'independent second switch reveals upper route' });
  yield* walk([-1, 10.2, -36], 'Read the upper outlined flight');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => straight([-1, 12.4, -40.5]), { label: 'Jump onto the upper revealed step', limit: 180 });
  check(Math.abs(p.pos.y - 12.4) < .15, 'Missed the upper revealed step');
  yield* walk([-1, 12.4, -43.5], 'Cross the upper step');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => straight([-1, 14.6, -48]), { label: 'Land on the upper spring terrace', limit: 180 });
  check(Math.abs(p.pos.y - 14.6) < .15, 'Missed the upper terrace');
  yield* walk([-2.65, 14.6, -50], 'Set up the second held rebound');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.vVel > 15 && p.pos.y < 16, () => ({ ...steer([-1, 15.75, -50]), jumpHeld: true }), { label: 'Hold the second arrow rebound', limit: 180 });
  yield* until(() => p.grounded, () => steer([5, 20.8, -54]), { label: 'Land on the final high receiver', limit: 220 });

  const rope = l.ropeSwings.find(q => Math.abs(q.anchor.z - offset[2] + 62) < .1), point = p.pos.clone();
  yield* walk([5, 20.8, -62], 'Read the upper climbing rope from its terrace');
  yield* charge();yield* until(() => Math.abs(rope.theta) < .12, { jumpHeld: true }, { label: 'Wait for the upper rope crossing', limit: 600 });
  yield* tick({ jumpReleased: true });
  yield* until(() => p.state === 'rope', () => { l.ropePointAt(rope, 10.8, point);return steer([point.x - offset[0], point.y, point.z - offset[2]]); }, { label: 'Catch the upper rope', limit: 180 });
  yield* stepFor(2);yield* until(() => p.ropeD < 3.8, { moveY: 1, skateRelative: true }, { label: 'Climb above the upper receiving platform', limit: 360 });
  yield* charge();yield* until(() => rope.theta > .4 && rope.theta < .47 && rope.thetaV > 0, { jumpHeld: true }, { label: 'Read the upper release window', limit: 600 });
  yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => steer([p.pos.x - offset[0], 30, -71]), { label: 'Release onto the upper receiving platform', limit: 220 });
  check(Math.abs(p.pos.y - 30) < .15, 'The upper rope missed its receiver');
  r.report.evidence.push({ action: 'upper rope after the preceding combinations', position: p.pos.toArray() });


  const straightFinish = q => steer([p.pos.x - offset[0], q[1], q[2]]);
  for (let group = 0; group < 2; group++) {
    const y = 30 + group * 6.2, z = -71 - group * 34;
    const pad = l.phasePads.find(q => Math.abs(q.mesh.position.z - offset[2] - (z - 10)) < .1);
    if (group) {
      yield* stepFor(570);
      check(p.grounded && Math.abs(p.pos.y - 36.2) < .15, 'The rest was unsafe through a complete upper cycle');
    }
    yield* walk([5, y, z - 3.8], 'Read the next timed flight from a permanent bank');
    yield* charge();yield* until(() => pad.on && (l.time / pad.cycle + pad.phase) % 1 < .05, { jumpHeld: true }, { label: 'Wait for the timed flight to begin', limit: 700 });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => straightFinish([5, y + 1.5, z - 9]), { label: 'Jump onto the first timed step', limit: 180 });
    check(Math.abs(p.pos.y - y - 1.5) < .15, 'Missed the first timed step');
    for (let i = 0; i < 3; i++) {
      const stepY = y + (i + 1) * 1.5, stepZ = z - 10 - i * 7;
      yield* walk([5, stepY, stepZ - 1.5], 'Cross the lit step before it withdraws');yield* charge();yield* tick({ jumpReleased: true });
      const target = i === 2 ? [5, y + 6.2, z - 30.2] : [5, stepY + 1.5, stepZ - 5.8];
      yield* until(() => p.grounded, () => straightFinish(target), { label: 'Transfer across the final timed flights', limit: 180 });
      check(Math.abs(p.pos.y - target[1]) < .15, 'Final timed transfer missed');
    }
    r.report.evidence.push({ action: `completed final timed flight ${group + 1}`, position: p.pos.toArray() });
  }
  yield* walk([5, 42.4, -137.3], 'Approach the Nitro-framed spring through its front opening');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.vVel > 15 && p.pos.y < 43.8, () => ({ ...steer([5, 43.55, -139]), jumpHeld: true }), { label: 'Hold the final rebound between the Nitro crates', limit: 180 });
  yield* until(() => p.pos.y > 44.2, () => steer([5, 45, -139]), { label: 'Clear the Nitro before drifting sideways', limit: 90 });
  yield* until(() => p.grounded, () => steer([11, 48.6, -143]), { label: 'Land inside the final receiver', limit: 240 });
  check(Math.abs(p.pos.y - 48.6) < .15, 'The final rebound missed its receiver');
  yield* walk([11, 48.6, -143], 'Collect the final crystal');
  check(l.crates.filter(c => c.nitro && c.box.min.y > 42).every(c => c.alive), 'The precision route removed its Nitro obstacles');
  yield* charge();yield* tick({ jumpReleased: true });
  yield* until(() => p.grounded, () => steer([17, 0, -143]), { label: 'Drop through the open side onto the recovery floor', limit: 480 });
  yield* walk([17, 0, -7], 'Walk outside the entire combined route');yield* walk([0, 0, 5], 'Complete the final circuit');
  return finish();
}
