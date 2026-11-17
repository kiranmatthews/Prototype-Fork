import { puzzleControls } from './puzzle-controls.mjs';

/** Shared normal-controller samples for native physics and the live browser. */
export function* runCrystalTrial(r, id) {
  const base = puzzleControls(r), { p, l } = r, offset = r.offset ?? [0, 0, 0];
  const at = q => typeof q === 'function' ? () => at(q()) : q.map((v, i) => v + offset[i]);
  const h = { ...base,
    walk: (q, ...args) => base.walk(at(q), ...args),
    steer: (q, ...args) => base.steer(at(q), ...args) };
  const { stepFor, walk, charge, tick, until, steer, check } = h;
  const goal = l.skateCollectathon.tokens.find(t => Number(t.name.split('/')[0]) === id);
  check(goal, 'The trial crystal is missing');
  yield* stepFor(12);
  if (id === 1) {
    yield* walk([-2.8, 0, 5], 'Approach the first checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    check(l.checkpoints.some(c => c.active && Math.abs(c.spawnPos.x - (offset[0] - 4)) < 2), 'First checkpoint did not bank');
    yield* walk([-1.65, 0, -5], 'Read the arrow and overhead crystal');
    // A released rebound is deliberately too short. Land beside the intact
    // spring and retry locally; no reset or changed velocity assists the route.
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.vVel > 15 && p.pos.y < 1.4,
      () => steer([0, 1.15, -5]), { label: 'Try an unboosted arrow rebound', limit: 140 });
    yield* until(() => p.vVel < 0, () => steer([0, 5, -5]),
      { label: 'See that the short rebound misses the crystal', limit: 120 });
    check(!goal.collected && p.pos.y < 5.2, 'The opening crystal does not require the taught held bounce');
    r.report.evidence.push({ action: 'short rebound misses fairly', apex: p.pos.y, collected: goal.collected });
    yield* until(() => p.grounded, () => steer([-1.65, 0, -5]),
      { label: 'Recover beside the spring for a local retry', limit: 160 });
    yield* walk([-1.65, 0, -5], 'Set up the held rebound');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.vVel > 15 && p.pos.y < 1.4,
      () => ({ ...steer([0, 1.15, -5]), jumpHeld: true }),
      { label: 'Land on the arrow for a held rebound', limit: 140 });
    r.report.evidence.push({ action: 'arrow rebound', position: p.pos.toArray(), verticalSpeed: p.vVel });
    yield* until(() => goal.collected,
      () => ({ ...steer([0, 6.1, -5]), jumpHeld: true }),
      { label: 'Retrieve the airborne crystal', limit: 140 });
    r.report.evidence.push({ action: 'crystal', position: p.pos.toArray(), frame: r.frame });
    yield* until(() => p.grounded, () => steer([3.5, 0, -5]),
      { label: 'Steer off the arrow onto the safe retry floor', limit: 200 });
    check(p.pos.y < .1 && !p.isBailing, 'Rebound did not return to the garden');
  } else if (id === 2) {
    yield* walk([-2.8, 0, 5], 'Bank the bell courtyard checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    check(l.checkpoints.some(c => c.active && Math.abs(c.spawnPos.x - (offset[0] - 4)) < 2), 'Bell checkpoint did not bank');
    yield* walk([0, 0, -3.8], 'Observe the spring and its high receiver');
    const missStart = p.trampolineLaunchId;
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.trampolineLaunchId > missStart,
      () => ({ ...steer([0, .12, -8]), jumpHeld: true }),
      { label: 'Try the spring before choosing the balcony line', limit: 150 });
    yield* until(() => p.grounded, () => steer([-5, 0, -10]),
      { label: 'A wrong-side drift returns to the courtyard', limit: 200 });
    check(!goal.collected && p.pos.y < .2, 'The missed balcony attempt has no safe local recovery');
    r.report.evidence.push({ action: 'missed drift recovers safely', position: p.pos.toArray() });
    yield* walk([0, 0, -3.8], 'Retry from the same spring approach');
    const before = p.trampolineLaunchId;
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.trampolineLaunchId > before,
      () => ({ ...steer([0, .12, -8]), jumpHeld: true }),
      { label: 'Jump onto the bell spring', limit: 150 });
    r.report.evidence.push({ action: 'spring launch', position: p.pos.toArray(), verticalSpeed: p.vVel });
    yield* until(() => p.pos.y > 4.8, () => ({ ...steer([0, 10, -8]), jumpHeld: true }),
      { label: 'Gain height before drifting toward the balcony', limit: 120 });
    yield* until(() => p.grounded, () => steer([6, 8.4, -13]),
      { label: 'Drift onto the high bell balcony', limit: 180 });
    check(Math.abs(p.pos.y - 8.4) < .15, 'Spring missed the high crystal receiver');
    yield* walk([6, 8.4, -13], 'Claim the crystal inside the bell arch');
    check(goal.collected, 'The bell balcony crystal was not collected');
    r.report.evidence.push({ action: 'balcony landing', position: p.pos.toArray(), collected: goal.collected });
    yield* walk([6, 8.4, -11.2], 'Read the open return edge');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([6, 0, -5]),
      { label: 'Drop from the bell balcony into the courtyard', limit: 220 });
    check(p.pos.y < .2, 'Bell return did not reach the courtyard');
  } else if (id === 3) {
    yield* walk([-2.8, 0, 5], 'Bank the viaduct checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    function* catchRail() {
      yield* walk([0, 0, 2], 'Set up on the safe rail approach');
      yield* charge(26, { moveY: 1 });
      yield* tick({ moveY: 1, jumpReleased: true, grindHeld: true });
      yield* until(() => p.state === 'grind', { moveY: 1, grindHeld: true },
        { label: 'Catch the long viaduct rail', limit: 160 });
      check(p.grindRail.totalLength > 65, 'Caught an incidental platform edge instead of the viaduct');
    }
    yield* catchRail();
    yield* until(() => p.isBailing, { moveX: 1, grindHeld: true },
      { label: 'Oversteer while the rail still has a floor beneath it', limit: 120, allowDeath: true });
    yield* until(() => p.grounded && !p.isBailing, {},
      { label: 'Recover from the balance mistake on the approach deck', limit: 500, allowDeath: true });
    check(p.totalDeaths === 0 && !goal.collected, 'The balance lesson did not recover safely');
    r.report.evidence.push({ action: 'balance miss recovers on safe deck', position: p.pos.toArray() });
    yield* catchRail();
    const crossingStart = r.frame;
    yield* until(() => p.pos.z < offset[2] - 70,
      () => ({ moveY: 1, grindHeld: true, moveX: Math.max(-1, Math.min(1, -p.balance * 5 - p.balanceVel * .7)) }),
      { label: 'Balance across the open pit', limit: 2400 });
    check(p.state === 'grind', 'The crossing did not stay on the rail');
    r.report.evidence.push({ action: 'long rail crossing', seconds: (r.frame - crossingStart) / 60,
      position: p.pos.toArray(), balance: p.balance, speed: p.speed });
    yield* stepFor(26, () => ({ moveY: 1, grindHeld: true, jumpHeld: true,
      moveX: Math.max(-1, Math.min(1, -p.balance * 5 - p.balanceVel * .7)) }));
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, 3.1, -82]),
      { label: 'Pop from the needle onto its raised receiver', limit: 180 });
    check(Math.abs(p.pos.y - 3.1) < .15, 'The grind pop missed the raised receiver');
    yield* until(() => !p.freeSkate, { moveY: -1 },
      { label: 'Brake on the crystal receiver', limit: 180 });
    yield* walk([0, 3.1, -84], 'Collect the viaduct crystal');
    check(goal.collected, 'The viaduct crystal was not collected');
    r.report.evidence.push({ action: 'receiver crystal', position: p.pos.toArray() });
    yield* walk([2.8, 3.1, -84], 'Read the lower return landing');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([10, -8, -84]),
      { label: 'Drop onto the one-way return landing', limit: 180 });
    check(Math.abs(p.pos.y + 8) < .15, 'Missed the lower return deck');
    yield* walk([15, -8, -84], 'Join the return below the crystal deck');
    yield* walk([15, -8, -21], 'Follow the lower return outside the pit');
    yield* walk([15, 0, 5], 'Climb back to the observation promenade');
    yield* walk([15, 0, 9], 'Turn onto the upper return junction');
    yield* walk([0, 0, 9], 'Finish the local circuit at the approach');
    check(p.totalDeaths === 0, 'The successful rail circuit used a respawn');
    const livesBefore = p.lives;
    yield* until(() => p.state === 'dead', { moveY: 1 },
      { label: 'Test a missed crossing by running into the visible pit', limit: 700, allowDeath: true });
    r.report.pitDeathObserved = true;
    yield* until(() => p.grounded && !p.isBailing && p.state === 'ride', {},
      { label: 'Respawn at the banked viaduct checkpoint', limit: 700, allowDeath: true });
    check(goal.collected, 'The pit recovery lost the earned crystal');
    check(Math.hypot(p.pos.x - (offset[0] - 4), p.pos.z - (offset[2] + 5)) < 2,
      'The pit respawn did not return to the trial checkpoint');
    // Modern mode counts deaths; Classic spends a reserve life instead.
    r.report.expectedDeaths = p.totalDeaths;
    r.report.evidence.push({ action: 'pit recovery preserves crystal', position: p.pos.toArray(),
      deaths: p.totalDeaths, livesBefore, livesAfter: p.lives });
  } else if (id === 4) {
    const ferry = l.movers.find(m => Math.abs(m.base.x - offset[0]) < .1 && Math.abs(m.base.z - offset[2] + 15) < .1);
    const lift = l.movers.find(m => Math.abs(m.base.x - offset[0]) < .1 && Math.abs(m.base.z - offset[2] + 40) < .1);
    check(ferry && lift, 'The ferry or lift is missing');
    const top = m => m.mesh.position.y + m.mesh.geometry.parameters.height / 2;
    const ferryZ = () => ferry.mesh.position.z - offset[2];
    const moverId = m => l.movers.indexOf(m);
    yield* walk([-2.8, 0, 5], 'Bank the machine-bank checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    yield* walk([0, 0, -3.8], 'Inspect the full ferry cycle from the safe bank');
    yield* stepFor(540);
    check(p.grounded && !goal.collected, 'The ferry waiting bank is unsafe');
    yield* charge();
    yield* until(() => ferryZ() < -20.3 && ferry.lastDelta.z < 0, { jumpHeld: true },
      { label: 'Deliberately choose the ferry away from the bank', limit: 600 });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.state === 'dead', () => steer([0, 0, -12]),
      { label: 'A mistimed ferry jump falls into the visible water', limit: 400, allowDeath: true });
    yield* until(() => p.grounded && !p.isBailing && p.state === 'ride', {},
      { label: 'Recover at the bank checkpoint after the mistimed jump', limit: 700, allowDeath: true });
    check(Math.hypot(p.pos.x - (offset[0] - 4), p.pos.z - (offset[2] + 5)) < 2,
      'Mistimed ferry jump did not recover at the local checkpoint');
    r.report.expectedDeaths = p.totalDeaths;
    r.report.evidence.push({ action: 'mistimed ferry jump recovers locally', position: p.pos.toArray() });
    yield* walk([0, 0, -3.8], 'Return to the ferry observation edge');
    yield* stepFor(r.phaseWait ?? 0);
    yield* charge();
    yield* until(() => ferryZ() > -10.7 && ferry.lastDelta.z > 0, { jumpHeld: true },
      { label: 'Wait for the returning ferry', limit: 600 });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, top(ferry), ferryZ()]),
      { label: 'Board the ferry with a normal jump', limit: 150 });
    check(p.groundHit?.moverId === moverId(ferry), 'The ferry jump landed on the wrong surface');
    yield* walk(() => [0, top(ferry), ferryZ() - 1.6], 'Move to the ferry departure end');
    yield* charge();
    yield* until(() => ferryZ() < -20.3 && ferry.lastDelta.z < 0, { jumpHeld: true },
      { label: 'Ride the ferry to the resting island', limit: 600 });
    r.report.evidence.push({ action: 'ferry carries rider', position: p.pos.toArray(), ferry: ferry.mesh.position.toArray() });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, 0, -27]),
      { label: 'Jump from the ferry onto the fixed island', limit: 180 });
    check(p.groundHit?.moverId === undefined && Math.abs(p.pos.y) < .15, 'Missed the fixed island');
    yield* walk([0, 0, -32.5], 'Read the lift from a fixed resting ledge');
    yield* charge();
    yield* until(() => top(lift) < .7 && lift.lastDelta.y < 0, { jumpHeld: true },
      { label: 'Wait for the low descending lift', limit: 600 });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, top(lift), -38.5]),
      { label: 'Board the gallery lift', limit: 180 });
    check(p.groundHit?.moverId === moverId(lift), 'The lift jump landed on the wrong surface');
    yield* walk(() => [0, top(lift), -41.5], 'Cross to the lift departure edge');
    yield* charge();
    yield* until(() => top(lift) > 7.35 && lift.lastDelta.y > 0, { jumpHeld: true },
      { label: 'Ride upward to the gallery window', limit: 600 });
    r.report.evidence.push({ action: 'lift carries rider', position: p.pos.toArray(), top: top(lift) });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, 8.4, -46.5]),
      { label: 'Jump from the rising lift into the gallery', limit: 180 });
    check(Math.abs(p.pos.y - 8.4) < .15, 'The lift exit missed the gallery');
    yield* walk([0, 8.4, -50], 'Collect the gallery crystal');
    check(goal.collected, 'The gallery crystal was not collected');
    yield* walk([3, 8.4, -50], 'Read the lower return from the gallery edge');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([12, -8, -50]),
      { label: 'Drop into the broad return landing', limit: 220 });
    check(Math.abs(p.pos.y + 8) < .15, 'Missed the gallery return landing');
    yield* walk([15, -8, -50], 'Join the lower machine return');
    yield* walk([15, -8, -21], 'Follow the return outside the water');
    yield* walk([15, 0, 9], 'Climb the return and reach its upper junction');
    yield* walk([0, 0, 9], 'Finish the machine circuit on the entrance bank');
  } else if (id === 5) {
    yield* walk([-2.8, 0, 5], 'Bank the halfpipe checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    yield* walk([0, 0, -33], 'Enter through the open end of the halfpipe');
    yield* until(() => p.freeSkate, { moveX: 1, jumpHeld: true },
      { label: 'Push from rest onto the board', limit: 120 });
    const airs = []; let current = null, released = false;
    r.report.stage = 'Pump successive halfpipe airs';
    for (let frame = 0; frame < 2400 && (!goal.collected || current); frame++) {
      check(!p.isBailing && p.state !== 'dead', 'The halfpipe pump lost its safe return');
      const release = !current && !released && p.pos.y > 2 && p.groundHit?.normal.y < .45;
      const along = Math.max(-.18, Math.min(.18, (offset[2] - 33 - p.pos.z) * .08));
      const desired = Math.atan2(Math.sign(p.axisF.x), along);
      const error = Math.atan2(Math.sin(desired - Math.atan2(p.axisF.x, p.axisF.z)), Math.cos(desired - Math.atan2(p.axisF.x, p.axisF.z)));
      const turn = p.grounded && p.pos.y < 2 ? Math.max(-1, Math.min(1, -error * 4)) : 0;
      yield* tick({ skateRelative: true, moveX: turn, jumpHeld: current ? p.vVel < 0 : !release && !released, jumpReleased: release });
      if (release) released = true;
      if (!current && !p.grounded && (p.vertAir || p.pipeHang))
        current = { side: Math.sign(p.pos.x - offset[0]), peak: p.pos.y, frames: 0, start: p.pos.toArray() };
      if (current) {
        current.frames++; current.peak = Math.max(current.peak, p.pos.y);
        if (p.grounded) {
          airs.push(current); r.report.evidence.push({ action: 'halfpipe air', ...current, landing: p.pos.toArray(), collected: goal.collected });
          current = null; released = false;
        }
      }
    }
    check(goal.collected, 'The pumped halfpipe airs did not reach the crystal');
    check(airs.length > 1 && airs[0].peak < 9.7, 'The high crystal did not require building height');
    yield* until(() => p.grounded && Math.abs(p.pos.x - offset[0]) < 4, { skateRelative: true },
      { label: 'Roll down the transition into the flat', limit: 300 });
    yield* until(() => !p.freeSkate || p.speed < .1, { skateRelative: true, grabHeld: true },
      { label: 'Bleed the accumulated speed on the opposite transition', limit: 300 });
    if (p.freeSkate) {
      yield* until(() => Math.abs(p.pos.x - offset[0]) < 4, { skateRelative: true },
        { label: 'Coast back into the flat after braking', limit: 300 });
      yield* until(() => !p.freeSkate, { skateRelative: true, grabHeld: true },
        { label: 'Dismount at walking speed on the flat', limit: 300 });
    }
    yield* walk([0, 0, -33], 'Rejoin the open center of the pipe');
    yield* walk([0, 0, 5], 'Return through the open end to the checkpoint');
  } else if (id === 6) {
    if (r.phaseWait) yield* stepFor(r.phaseWait);
    const rope = l.ropeSwings.find(s => Math.abs(s.anchor.x - offset[0]) < .1 && Math.abs(s.anchor.z - offset[2] + 18) < .1);
    check(rope, 'The climbing rope is missing');
    const point = p.pos.clone();
    yield* walk([-2.8, 0, 5], 'Bank the rope courtyard checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    function* catchVine() {
      yield* walk([0, 0, -18], 'Wait below the climbing vine');
      yield* charge();
      yield* until(() => Math.abs(rope.theta) < .12, { jumpHeld: true },
        { label: 'Read the rope as it crosses the courtyard center', limit: 600 });
      yield* tick({ jumpReleased: true });
      yield* until(() => p.state === 'rope', () => {
        l.ropePointAt(rope, 10.8, point);
        return steer([point.x - offset[0], point.y, point.z - offset[2]]);
      }, { label: 'Catch the moving lower rope with a normal jump', limit: 180 });
      yield* stepFor(2);
      r.report.evidence.push({ action: 'low rope catch', position: p.pos.toArray(), gripDistance: p.ropeD });
    }
    yield* catchVine();
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([-6, 0, -22]),
      { label: 'A low release misses the window and lands in the courtyard', limit: 220 });
    check(!goal.collected && p.pos.y < .2, 'The unclimbed release bypassed the window challenge');
    yield* catchVine();
    yield* until(() => p.ropeD < 3.8, { moveY: 1, skateRelative: true },
      { label: 'Climb the swinging rope above the window sill', limit: 360 });
    check(p.state === 'rope', 'The climb lost its grip');
    yield* charge();
    yield* until(() => rope.theta > .4 && rope.thetaV > 0, { jumpHeld: true },
      { label: 'Wait for the high swing toward the window', limit: 600 });
    r.report.evidence.push({ action: 'climbed release', position: p.pos.toArray(), gripDistance: p.ropeD });
    yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([0, 9.2, -27]),
      { label: 'Release through the framed window onto its sill', limit: 200 });
    check(Math.abs(p.pos.y - 9.2) < .15, 'The climbing release missed the gallery');
    yield* walk([0, 9.2, -28], 'Collect the window crystal');
    check(goal.collected, 'The window crystal was not collected');
    yield* walk([2, 9.2, -28], 'Read the courtyard return beside the window');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([7, 0, -28]),
      { label: 'Drop into the broad courtyard beside the gallery', limit: 220 });
    yield* walk([7, 0, -18], 'Pass outside the climbing rope');
    yield* walk([0, 0, 5], 'Return to the rope courtyard entrance');
  } else if (id === 7) {
    if (r.phaseWait) yield* stepFor(r.phaseWait);
    const pads = [10, 17, 24].map(z => l.phasePads.find(q => Math.abs(q.mesh.position.x - offset[0]) < .1 && Math.abs(q.mesh.position.z - offset[2] + z) < .1));
    check(pads.every(Boolean), 'The rising phase stairs are missing');
    const phase = q => (l.time / q.cycle + q.phase) % 1;
    // These are straight up-button jumps. A tiny lateral correction would
    // select the game's diagonal foot speed instead of its forward speed.
    const alongStairs = q => steer([p.pos.x - offset[0], q[1], q[2]]);
    yield* walk([-2.8, 0, 5], 'Bank the timed staircase checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    function* firstStep() {
      yield* walk([0, 0, -3.8], 'Observe the full staircase from its waiting bank');
      yield* charge();
      yield* until(() => pads[0].on && phase(pads[0]) < .05, { jumpHeld: true },
        { label: 'Start as the first stair lights', limit: 600 });
      yield* tick({ jumpReleased: true });
      yield* until(() => p.grounded, () => alongStairs([0, 1.5, -9]),
        { label: 'Jump onto the first rising stair', limit: 160 });
      check(Math.abs(p.pos.y - 1.5) < .15, 'The first stair was missed');
    }
    function* returnFromBelow() {
      yield* walk([0, -8, -21], 'Walk below the stairs toward the retry route');
      yield* walk([15, -8, -21], 'Join the lower retry ramp');
      yield* walk([15, 0, 9], 'Climb to the fixed waiting bank');
      yield* walk([0, 0, 9], 'Rejoin the staircase entrance');
    }
    yield* firstStep();
    yield* until(() => p.grounded && p.pos.y < -7.9, {},
      { label: 'Let the warned stair disappear and recover below', limit: 600 });
    check(!goal.collected, 'Waiting on the first stair collected the goal');
    r.report.evidence.push({ action: 'late step recovers without death', position: p.pos.toArray() });
    yield* returnFromBelow();
    yield* firstStep();
    for (let i = 0; i < 3; i++) {
      const y = (i + 1) * 1.5, z = -10 - i * 7;
      yield* walk([0, y, z - 1.5], `Cross stair ${i + 1} before its warning ends`);
      yield* charge(); yield* tick({ jumpReleased: true });
      const target = i === 2 ? [0, 6.2, -30.2] : [0, y + 1.5, z - 5.8];
      yield* until(() => p.grounded, () => alongStairs(target),
        { label: i === 2 ? 'Jump to the permanent crystal balcony' : `Jump onto lit stair ${i + 2}`, limit: 160 });
      check(Math.abs(p.pos.y - target[1]) < .15, 'A phase stair transfer missed its receiver');
      r.report.evidence.push({ action: 'rising transfer', stair: i + 1, position: p.pos.toArray(), phases: pads.map(phase) });
    }
    yield* walk([0, 6.2, -34], 'Collect the crystal after the rising rhythm');
    check(goal.collected, 'The staircase crystal was not collected');
    yield* walk([3, 6.2, -34], 'Read the lower return beside the balcony');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([11, -8, -34]),
      { label: 'Drop from the balcony into the recovery courtyard', limit: 240 });
    check(Math.abs(p.pos.y + 8) < .15, 'The staircase return missed the courtyard');
    yield* returnFromBelow();
  } else if (id === 8) {
    const switchBox = h.crateNamed('08 / Reveal switch'), arrow = h.crateNamed('08 / Revealed reusable arrow');
    check(switchBox && arrow?.pending, 'The orchard reveal wiring is missing');
    const otherPending = l.crates.filter(c => c.pending && c !== arrow);
    const straight = q => steer([p.pos.x - offset[0], q[1], q[2]]);
    yield* walk([-2.8, 0, 5], 'Bank the outline orchard checkpoint');
    yield* tick({ spinHeld: true }); yield* stepFor(25);
    yield* walk([0, 0, -9], 'Read the ghost steps before operating the switch');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => straight([0, 2.2, -13.2]),
      { label: 'An unrevealed step lets the jump fall safely into the courtyard', limit: 180 });
    check(p.pos.y < .2 && arrow.pending && !goal.collected, 'The ghost route was solid before activation');
    yield* h.hit(switchBox, 'Reveal the orchard steps and their arrow');
    check(!arrow.pending && otherPending.every(c => c.pending), 'The switch did not stay within its own trial');
    yield* walk([0, 0, -9], 'Approach the now-solid first step');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => straight([0, 2.2, -13.2]),
      { label: 'Jump onto the first revealed step', limit: 180 });
    check(Math.abs(p.pos.y - 2.2) < .15, 'The first revealed step was missed');
    yield* walk([0, 2.2, -15.5], 'Set up the jump to the spring terrace');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => straight([0, 4.4, -20.2]),
      { label: 'Jump onto the revealed spring terrace', limit: 180 });
    check(Math.abs(p.pos.y - 4.4) < .15, 'The spring terrace was missed');
    function* arrowContact(boost) {
      yield* walk([-1.65, 4.4, -22], 'Approach the intact steel arrow');
      yield* charge(); yield* tick({ jumpReleased: true });
      yield* until(() => p.vVel > 15 && p.pos.y < 5.8,
        () => ({ ...steer([0, 5.55, -22]), jumpHeld: boost }),
        { label: boost ? 'Hold the high arrow rebound' : 'Try the short arrow rebound', limit: 150 });
    }
    yield* arrowContact(false);
    yield* until(() => p.vVel < 0, () => steer([0, 10, -22]),
      { label: 'Read the height still missing from the short rebound', limit: 120 });
    check(!goal.collected && p.pos.y < 10, 'A short rebound bypassed the held-bounce requirement');
    r.report.evidence.push({ action: 'short rebound misses high gallery', apex: p.pos.y });
    yield* until(() => p.grounded, () => steer([-1.65, 4.4, -22]),
      { label: 'Land beside the arrow for a local retry', limit: 180 });
    yield* arrowContact(true);
    r.report.evidence.push({ action: 'held arrow launch', position: p.pos.toArray(), verticalSpeed: p.vVel });
    yield* until(() => p.grounded, () => steer([6, 10.2, -26]),
      { label: 'Drift from the arrow into the high orchard gallery', limit: 200 });
    check(Math.abs(p.pos.y - 10.2) < .15, 'The held arrow missed the high gallery');
    yield* walk([6, 10.2, -26], 'Collect the orchard crystal');
    check(goal.collected && arrow.alive, 'The orchard crystal or reusable return state is missing');
    yield* walk([7.8, 10.2, -26], 'Read the clear courtyard return edge');
    yield* charge(); yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([11, 0, -26]),
      { label: 'Drop into the orchard courtyard', limit: 220 });
    check(p.pos.y < .2, 'The orchard return did not reach the courtyard');
    yield* walk([11, 0, -7], 'Pass outside the raised outline route');
    yield* walk([0, 0, 5], 'Return to the orchard entrance');
  } else if (id === 9) {
    const turtle = l.enemies.find(e => e.kind === 'turtle' && Math.abs(e.group.position.z - offset[2] + 14) < .1);
    check(turtle, 'The turtle spring is missing');
    yield* walk([-2.8, 0, 5], 'Bank the turtle checkpoint');
    yield* tick({ spinHeld: true });yield* stepFor(25);
    yield* walk([-1.25, 0, -14], 'Approach the turtle from the side');
    yield* tick({ spinHeld: true });
    yield* until(() => !turtle.alive, { spinHeld: true }, { label: 'A first spin leaves a shell', limit: 80 });
    yield* stepFor(65);
    check(turtle.shell, 'First spin did not preserve the shell');
    yield* tick({ spinHeld: true });
    yield* until(() => !turtle.shell, { spinHeld: true }, { label: 'A fresh second spin removes the spring', limit: 80 });
    r.report.evidence.push({ action: 'second attack removes the required tool' });
    yield* walk([-9, 0, -14], 'Leave the removed shell');
    yield* walk([-9, 0, -36], 'Approach the designated reset pit');
    yield* until(() => p.state === 'dead', () => steer([-9, -8, -42]),
      { label: 'Reset the destroyed tool through the marked pit', limit: 300, allowDeath: true });
    yield* until(() => p.grounded && p.state === 'ride' && !p.isBailing, {},
      { label: 'Recover at the turtle checkpoint', limit: 700, allowDeath: true });
    check(turtle.alive, 'Recovery did not restore the turtle');
    r.report.expectedDeaths = p.totalDeaths;
    yield* walk([-2, 0, -14], 'Set up a falling stomp');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => !turtle.alive, () => steer([0, 1.4, -14]),
      { label: 'Stomp the turtle into a reusable shell', limit: 160 });
    check(turtle.shell && p.vVel > 0, 'Stomp did not create the shell rebound');
    yield* until(() => p.grounded, () => steer([-2, 0, -14]),
      { label: 'Recover beside the new shell', limit: 180 });
    function* spring() {
      yield* walk([-2, 0, -14], 'Approach the shell spring');
      yield* charge();yield* tick({ jumpReleased: true });
      yield* until(() => p.vVel > 15 && p.pos.y < 1.7,
        () => ({ ...steer([0, 1.4, -14]), jumpHeld: true }),
        { label: 'Hold the shell rebound', limit: 180 });
    }
    yield* spring();
    yield* until(() => p.vVel < 0, () => steer([0, 8.2, -14]),
      { label: 'Measure the held rebound without a double jump', limit: 140 });
    check(!goal.collected && p.pos.y < 8.2, 'The shell alone bypassed the double jump');
    r.report.evidence.push({ action: 'held shell alone misses', apex: p.pos.y });
    yield* until(() => p.grounded, () => steer([-2, 0, -14]),
      { label: 'Land beside the shell for a local retry', limit: 180 });
    yield* spring();
    yield* stepFor(3, () => steer([2.5, 8.2, -16]));
    yield* until(() => p.vVel < .65, () => steer([2.5, 8.2, -16]),
      { label: 'Rise outside the high platform', limit: 120 });
    yield* tick({ ...steer([2.5, 8.2, -16]), jumpHeld: true });
    yield* tick({ ...steer([2.5, 8.2, -16]), jumpReleased: true });
    yield* until(() => p.pos.y > 8.3, () => steer([2.5, 8.2, -16]),
      { label: 'Double jump above the platform edge', limit: 70 });
    yield* until(() => p.grounded, () => steer([6, 8.2, -18]),
      { label: 'Drift onto the high receiver', limit: 180 });
    check(Math.abs(p.pos.y - 8.2) < .15, 'Missed the turtle receiver');
    yield* walk([6, 8.2, -18], 'Collect the turtle crystal');
    check(goal.collected, 'The turtle crystal was not collected');
    r.report.evidence.push({ action: 'shell and double jump reach receiver', position: p.pos.toArray() });
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([11, 0, -18]),
      { label: 'Return to the flat courtyard', limit: 240 });
    yield* walk([11, 0, 5], 'Walk around the shell and platform');
    yield* walk([0, 0, 5], 'Complete the turtle circuit');
  } else if (id === 10) {
    const bridge = l.spinBridges.find(b => Math.abs(b.component.p[2] - offset[2] + 8) < .1);
    check(bridge, 'Timed bridge is missing');
    yield* walk([-2.8, 0, 5], 'Bank the bridge checkpoint');
    yield* tick({ spinHeld: true });yield* stepFor(25);
    function* open() {
      yield* walk([0, 0, -6.9], 'Approach the upright bridge');
      yield* tick({ spinHeld: true });
      yield* until(() => bridge.deployed, {}, { label: 'Wait for the bridge to settle', limit: 120 });
    }
    function* returnBelow() {
      yield* walk([15, -8, p.pos.z - offset[2]], 'Join the lower return');
      yield* walk([15, -8, -21], 'Walk to the return ramp');
      yield* walk([15, 0, 5], 'Climb the return ramp');
      yield* walk([15, 0, 9], 'Turn onto the approach');
      yield* walk([0, 0, 9], 'Return to the bridge entrance');
    }
    yield* open();yield* walk([0, 0, -14], 'Wait on the deployed bridge');
    yield* until(() => p.grounded && p.pos.y < -7.8, {},
      { label: 'A late crossing folds away and drops to the flat floor', limit: 600 });
    check(!goal.collected, 'The failed crossing collected the reward');
    r.report.evidence.push({ action: 'bridge timeout returns to flat floor', position: p.pos.toArray() });
    yield* returnBelow();yield* open();
    yield* walk([0, 0, -20.7], 'Cross before the bridge folds');
    check(bridge.remaining > .6, 'The approach leaves no time to jump');
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([p.pos.x - offset[0], 2.2, -26.4]),
      { label: 'Jump from the bridge onto the small raised receiver', limit: 180 });
    check(Math.abs(p.pos.y - 2.2) < .15, 'Missed the small bridge receiver');
    yield* walk([0, 2.2, -27], 'Collect the bridge crystal');
    check(goal.collected, 'Bridge crystal missing');
    r.report.evidence.push({ action: 'timed bridge and precision landing', position: p.pos.toArray() });
    yield* charge();yield* tick({ jumpReleased: true });
    yield* until(() => p.grounded, () => steer([8, -8, -27]),
      { label: 'Drop beside the folded bridge into the recovery floor', limit: 240 });
    yield* returnBelow();
  } else throw Error(`No verified pilot for trial ${id}`);
  check(l.checkpoints.some(c => c.active && Math.hypot(c.spawnPos.x - (offset[0] - 4), c.spawnPos.z - (offset[2] + 5)) < 2),
    'The trial checkpoint was not banked');
  check(p.totalDeaths === (r.report.expectedDeaths ?? 0), 'Unexpected death outside the deliberate recovery test');
  return { id, collected: l.skateCollectathon.collected, position: p.pos.toArray(), frames: r.frame };
}
