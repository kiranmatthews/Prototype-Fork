// The vert air and the spine transfer are drawn alive, and only drawn.
//
//   node tools/test-vert-air-motion.mjs        (npm run check:vert-air)
//
// What is asserted, first on the samplers and then on the real Player in real
// pipes (Side Pipe Lab), with the same route bot the course test uses:
//   · SPINE TRANSFER: the drawn turn winds up against itself, is driven late
//     and harder than an even turn, runs past the far wall and comes back to
//     it; the chest goes over ahead of the deck and is held back at the end;
//     the two arms are never level over the top; every part is at rest when
//     the turn ends; no two transfers in a row are the same; and the gather,
//     reach and rebound the knees and the elasticity read are untouched;
//   · VERT AIR: with nothing asked of him the rider's head, chest and arms hang
//     back down the wall on the way up and trail up it on the way down, his
//     knees tuck at the top and reach coming down, no quarter second of the
//     air is a held pose, nothing jumps between two steps, it does not depend
//     on the frame rate, a transfer stands it down, one air is not the next,
//     and it has settled to nothing soon after it ends;
//   · ON THE RIG: in a real hang the head really is below the hips' line going
//     up and above it coming down, a wrist really does swing through more
//     than half a metre, both soles stay on the deck to within a centimetre,
//     and drawing the same instant twice gives the same pose (nothing
//     accumulates on a joint);
//   · IN A REAL TRANSFER the drawn body is behind the even turn, then ahead of
//     it, then past the far wall, and exactly on it at the end — while the
//     normal the simulation eases (and a skate camera reads) turns as evenly
//     as it always did, and the soles stay on the deck: within 3 mm at every
//     frame and at seven instants between each two, with neither sole turning
//     against the deck from one instant to the next;
//   · THE WAY THE GAME DRAWS THEM, through its authored animation runtime, the
//     same two transfers keep both soles within 3 mm on every frame (the frame
//     that was 13.1 mm off, at 0.72 of the first turn, is this one).
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
import { makeCourseBot } from './side-pipe-lab-bot.mjs';

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST, THREE }) => {
  const { sampleSpineTransfer, spineTransferTurnOffset, VertAirMotion, VERT_AIR } = await server.ssrLoadModule('/src/vertSkateMotion.ts');
  const smooth = v => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
  const f2 = v => v.toFixed(2);

  // ---- the spine transfer, as a curve ------------------------------------------
  for (const variant of [0, 1, 2, 3, 7]) {
    const N = 600, at = k => sampleSpineTransfer(k / N, 1, variant);
    const samples = Array.from({ length: N + 1 }, (_, k) => at(k));
    const first = samples[0], last = samples[N];
    assert.ok(Math.abs(first.turn) < 1e-9 && Math.abs(last.turn - 1) < 1e-9, 'the drawn turn starts on one wall and ends on the other');
    const early = samples.filter(s => s.progress < 0.2), late = samples.filter(s => s.progress > 0.68);
    assert.ok(Math.min(...early.map(s => s.turn)) < -0.02, `transfer ${variant}: it winds up against the turn first (${f2(Math.min(...early.map(s => s.turn)))})`);
    assert.ok(Math.max(...late.map(s => s.turn)) > 1.03, `transfer ${variant}: it runs past the far wall (${f2(Math.max(...late.map(s => s.turn)))})`);
    let hardest = 0;
    for (let k = 1; k <= N; k++) hardest = Math.max(hardest, (samples[k].turn - samples[k - 1].turn) * N);
    assert.ok(hardest > 1.9 && hardest < 2.5, `transfer ${variant}: it is driven harder than an even turn (1.5 at its fastest), but is not a snap (${f2(hardest)})`);
    assert.ok(Math.max(...samples.filter(s => s.progress < 0.5).map(s => s.lead)) > 0.3, `transfer ${variant}: the chest goes over ahead of the deck`);
    assert.ok(Math.min(...samples.filter(s => s.progress > 0.6).map(s => s.lead)) < -0.1, `transfer ${variant}: and is held back at the end, to stop it`);
    const top = samples.reduce((best, s) => Math.abs(s.turn - 0.5) < Math.abs(best.turn - 0.5) ? s : best);
    assert.ok(top.arms[0] - top.arms[1] > 0.5 && top.fore[0] > 0.2 && top.fore[1] < -0.3,
      `transfer ${variant}: over the top the arms are not level (${f2(top.arms[0])} against ${f2(top.arms[1])}) and one is forward, one back`);
    for (const key of ['lead', 'head', 'boardLag', 'wobble', 'twist', 'busy', 'hold', 'tuck', 'reach', 'rebound'])
      assert.ok(Math.abs(last[key]) < 1e-6 && Math.abs(first[key]) < 1e-6, `transfer ${variant}: ${key} is nothing before the turn and nothing after it`);
    assert.ok(last.arms.concat(last.fore).every(v => Math.abs(v) < 1e-6), `transfer ${variant}: the arms are back when the turn ends`);
    assert.ok(Math.abs(spineTransferTurnOffset(first)) < 1e-9 && Math.abs(spineTransferTurnOffset(last)) < 1e-9, 'the drawn turn meets the even one at both ends');
    // what the knees and the elasticity read has not moved
    for (const [x, tuck, reach] of [[0.3, 1, 1], [0.18, 1, smooth(0.6)], [0.86, 0, 0.5]]) {
      const s = sampleSpineTransfer(x, 1, variant);
      assert.ok(Math.abs(s.tuck - tuck) < 1e-9 && Math.abs(s.reach - reach) < 1e-9, `the gather and the reach are where they were at ${x}`);
    }
    assert.ok(Math.abs(sampleSpineTransfer(0.86, 1, variant).rebound - 1) < 1e-9, 'and so is the rebound');
  }
  {
    const one = sampleSpineTransfer(0.35, 1, 1), next = sampleSpineTransfer(0.35, 1, 2);
    assert.ok(Math.abs(one.lead - next.lead) + Math.abs(one.arms[0] - next.arms[0]) + Math.abs(one.wobble - next.wobble) > 0.03,
      'two transfers in a row are not the same transfer');
    assert.ok(one.tuck === next.tuck && one.reach === next.reach && one.progress === next.progress, '...in their bodies; the gather is the same');
  }

  // ---- the vert air, as a motion ---------------------------------------------------
  // One hang: 18 m/s off the lip, 33 m/s² up and down, then back on the wall.
  const LAUNCH = 18, G = 33, AIR = 2 * LAUNCH / G;
  const hang = (rate, variant = 1, busy = () => 0) => {
    const motion = new VertAirMotion(), poses = [];
    let vV = LAUNCH;
    for (let k = 0; k < Math.round((AIR + 2.5) * rate); k++) {
      const t = k / rate, active = t < AIR;
      if (active) vV = LAUNCH - G * t;
      const pose = motion.step(1 / rate, { active, verticalVelocity: vV, launchVelocity: LAUNCH, busy: busy(t), variant, time: 10 + t });
      poses.push({ t, active, vV, pose });
    }
    return poses;
  };
  const air = hang(60);
  const flying = air.filter(s => s.active && s.pose), up = flying.filter(s => s.vV > 6 && s.t > 0.12), down = flying.filter(s => s.vV < -6);
  assert.ok(up.every(s => s.pose.lean < -0.05) && Math.min(...up.map(s => s.pose.lean)) < -0.15,
    `going up, the body hangs back down the wall (lean to ${f2(Math.min(...up.map(s => s.pose.lean)))})`);
  assert.ok(down.every(s => s.pose.lean > 0.03) && Math.max(...down.map(s => s.pose.lean)) > 0.12,
    `coming down, it trails up the wall (lean to ${f2(Math.max(...down.map(s => s.pose.lean)))})`);
  assert.ok(up.every(s => s.pose.head > 0) && down.every(s => s.pose.head < 0), 'the head goes the other way: it looks where he is going, up and then down at the lip');
  assert.ok(Math.max(...up.map(s => s.pose.arms[0].trail)) > 0.5 && Math.min(...down.map(s => s.pose.arms[1].trail)) < -0.4,
    'the arms hang back from the motion too: down the wall going up, up it coming down');
  const topOf = flying.reduce((best, s) => Math.abs(s.vV) < Math.abs(best.vV) ? s : best);
  assert.ok(topOf.pose.knee > 0.25 && topOf.pose.arms[0].spread > 0.4, `at the top he tucks (${f2(topOf.pose.knee)} rad more knee) and his arms stand off him`);
  assert.ok(Math.min(...down.map(s => s.pose.knee)) < -0.03, 'coming down his legs reach for the wall');
  const flat = pose => [pose.lean, pose.bow, pose.twist, pose.crouch, pose.head, pose.look, pose.knee, pose.hipAlong * 4, pose.hipAcross * 4,
    pose.boardPitch, pose.boardRoll, pose.boardYaw, ...pose.arms.flatMap(a => [a.trail, a.spread, a.swing, a.elbow])];
  const apart = (a, b) => Math.hypot(...flat(a).map((v, i) => v - flat(b)[i]));
  let stillest = Infinity, jump = 0;
  for (let k = 0; k < flying.length; k++) {
    if (k + 15 < flying.length && flying[k].t > 0.1) stillest = Math.min(stillest, apart(flying[k].pose, flying[k + 15].pose));
    if (k) jump = Math.max(jump, ...flat(flying[k].pose).map((v, i) => Math.abs(v - flat(flying[k - 1].pose)[i])));
  }
  assert.ok(stillest > 0.08, `no quarter second of the air is a held pose (the stillest moves ${f2(stillest)} rad across its joints)`);
  assert.ok(jump < 0.12, `and nothing jumps between two steps (${f2(jump)} rad at most)`);
  assert.ok(flying.every(s => flat(s.pose).every(v => Math.abs(v) < 2) && s.pose.fling >= 0 && s.pose.fling <= 1 &&
    Math.abs(s.pose.hipAlong) < 0.12 && Math.abs(s.pose.hipAcross) < 0.08), 'every part stays inside what a body can do');
  const ended = air.findIndex(s => !s.active), gone = air.findIndex((s, k) => k > ended && s.pose === null);
  assert.ok(gone > ended && air[gone].t - AIR < 1.2, `it has settled to nothing ${f2(air[gone]?.t - AIR)} s after the air ends`);
  assert.ok(air.slice(gone).every(s => s.pose === null), 'and it stays nothing until the next air');
  {
    const coarse = hang(30), fine = hang(120);
    const a = coarse.find(s => Math.abs(s.t - 0.5) < 1e-6).pose, b = fine.find(s => Math.abs(s.t - 0.5) < 1e-6).pose;
    // (the springs are stepped exactly; what is left is each rate's own sampling of a target that moves)
    assert.ok(apart(a, b) < 0.15, `it is the same motion at 30 and at 120 steps a second (${f2(apart(a, b))} rad apart, over every joint)`);
    const other = hang(60, 2).filter(s => s.active && s.pose).reduce((best, s) => Math.abs(s.vV) < Math.abs(best.vV) ? s : best);
    assert.ok(apart(other.pose, topOf.pose) > 0.05, `one air is not the next (${f2(apart(other.pose, topOf.pose))} rad apart at the top)`);
    const stood = hang(60, 1, () => 1).filter(s => s.active && s.pose && s.t > 0.4);
    assert.ok(stood.every(s => flat(s.pose).every(v => Math.abs(v) < 0.03)), 'a spine transfer stands the idle down');
    // Rebound, measured on its own: going up at the lip's speed, then all at once coming down at it.
    // Each part swings past where it is going and comes back to it; the arms go further past than the trunk.
    const motion = new VertAirMotion(), turned = [];
    for (let k = 0; k < 4 * 60; k++) {
      const t = k / 60, pose = motion.step(1 / 60, { active: true, verticalVelocity: t < 0.6 ? LAUNCH : -LAUNCH, launchVelocity: LAUNCH, busy: 0, variant: 1, time: 10 + t });
      if (t >= 0.6) turned.push({ t, lean: pose.lean, trail: pose.arms[0].trail });
    }
    // (at the lip's own speed he is braced for the wall: half the trail in his trunk, a tenth of it in his arms)
    const leanRest = VERT_AIR.lean[1] * (1 - VERT_AIR.brace[4]), trailRest = -VERT_AIR.trail[0][1] * 0.1, settled = turned.filter(s => s.t > 3);
    assert.ok(settled.every(s => Math.abs(s.lean - leanRest) < 0.02), `reference: the trunk comes to rest ${f2(leanRest)} rad up the wall`);
    const leanPast = Math.max(...turned.map(s => s.lean)) - leanRest, trailPast = trailRest - Math.min(...turned.map(s => s.trail));
    assert.ok(leanPast > 0.05 && leanPast < 0.2, `the trunk swings ${f2(leanPast)} rad past where it is going, and comes back`);
    assert.ok(trailPast > 0.18 && trailPast > 2 * leanPast, `an arm swings ${f2(trailPast)} rad past: it is looser than the trunk`);
    assert.ok(settled.every(s => Math.abs(s.trail - trailRest) < 0.3), 'and the arm comes back too, to where it keeps working for balance');
  }

  // ---- on the rig, in real pipes ------------------------------------------------------
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  stock.dispose();
  const entry = findLevel('side-pipe-lab');
  const level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  p.competitionMode = false; p.endlessDeaths = true;
  const bot = makeCourseBot({ p, level, CONST, lab, makeInput, parts: entry.data.components });
  const { P0, C1, C2 } = lab;
  const node = name => p.riderG.getObjectByName(name);
  const where = name => node(name).getWorldPosition(new THREE.Vector3());
  const UP = new THREE.Vector3(0, 1, 0);
  /** Step the real simulation as the game does: decide, step (the step draws the pose itself, once), observe. */
  const drive = (opts, seconds, each) => {
    const run = bot.start(opts);
    for (let k = 0; k < seconds * 60; k++) {
      const pad = run.decide(), input = Object.assign(makeInput({ moveX: pad.moveX, moveY: pad.moveY }), pad);
      p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); p.stepDropInPresentation();
      p.group.updateMatrixWorld(true);
      const over = run.observe();
      if (each(k, input) === false || over) break;
    }
    return run.log;
  };
  // What is drawn is read off the bones' own axes in the world. (Not off a world
  // quaternion: under the rider's cartoon proportions a bone's world matrix is
  // sheared, and has no one rotation to give — least of all in a side-on hang.)
  const upper = ['spine', 'chest', 'neck', 'head', 'shoulder-left', 'shoulder-right', 'elbow-left', 'elbow-right', 'wrist-left', 'wrist-right'];
  const axes = name => { const e = node(name).matrixWorld.elements;
    return [new THREE.Vector3(e[0], e[1], e[2]).normalize(), new THREE.Vector3(e[4], e[5], e[6]).normalize(), new THREE.Vector3(e[8], e[9], e[10]).normalize()]; };
  const local = () => upper.map(name => node(name).quaternion.clone());
  /** The same instant drawn four more times: the most any upper joint has moved for it. */
  const redrawn = input => {
    const before = local();
    for (let again = 0; again < 4; again++) { p.syncVisual(input, 0); p.group.updateMatrixWorld(true); }
    return Math.max(...local().map((q, i) => q.angleTo(before[i])));
  };
  /** How much each part's pace changes from one frame to the next: a pop is a step unlike the one before it. */
  const pace = () => {
    let last = null, lastStep = null; const worst = { trunk: 0, head: 0, arms: 0 };
    const part = name => name === 'head' ? 'head' : /shoulder|elbow|wrist/.test(name) ? 'arms' : 'trunk';
    return { worst,
      skip() { last = lastStep = null; },
      frame(count) {
        const now = upper.map(axes);
        if (last) {
          const step = now.map((a, i) => Math.max(...a.map((v, j) => v.angleTo(last[i][j]))));
          if (lastStep && count) upper.forEach((name, i) => { worst[part(name)] = Math.max(worst[part(name)], Math.abs(step[i] - lastStep[i])); });
          lastStep = step;
        }
        last = now;
      } };
  };

  // A hang off P0's east lip, with Jump never pressed.
  {
    const rows = [], popped = pace(); let worstSole = 0, repeat = 0, drawn = 0, wasVert = false, done = false, frames = 0;
    drive({ pop: false, from: [P0.westLip - 3, P0.westLipY + 0.15] }, 9, (k, input) => {
      const east = p.vertAir && !p.grounded && p.pos.x > P0.cross;
      if (wasVert && !east) done = true;
      wasVert ||= east;
      if (!east) { popped.skip(); frames = 0; return !done; }
      // (the first frames off the lip are the old pose's own throw of the arms: not this test's)
      popped.frame(++frames > 10);
      const motion = p.boardG.userData.vertMotion, contact = p.boardG.userData.skateContact;
      if (motion?.air) drawn++;
      worstSole = Math.max(worstSole, contact.footError);
      const arm = side => where(`wrist-${side}`).sub(where(`shoulder-${side}`)).normalize();
      rows.push({ vV: p.vVel, head: where('head').y - where('hips').y, arms: [arm('left'), arm('right')] });
      if (rows.length === 20 || rows.length === 45) { repeat = Math.max(repeat, redrawn(input)); popped.skip(); frames = 0; }
      return true;
    });
    const rising = rows.filter(r => r.vV > 6).slice(6), falling = rows.filter(r => r.vV < -6);
    const mean = (list, pick) => list.reduce((sum, r) => sum + pick(r), 0) / list.length;
    // the arm on the up-the-wall side, then the other
    const order = mean(rows, r => r.arms[0].y) > mean(rows, r => r.arms[1].y) ? [0, 1] : [1, 0];
    const armUp = order.map(i => mean(rising, r => r.arms[i].y)), armDown = order.map(i => mean(falling, r => r.arms[i].y));
    const armTurn = order.map(i => falling[0].arms[i].angleTo(falling.at(-1).arms[i]));
    if (process.env.VERT_AIR_TRACE) console.log('TRACE hang', JSON.stringify({ steps: rows.length, drawn, worstSole, repeat, pops: popped.worst,
      headUp: [Math.min(...rising.map(r => r.head)), Math.max(...rising.map(r => r.head))],
      headDown: [Math.min(...falling.map(r => r.head)), Math.max(...falling.map(r => r.head))], armUp, armDown, armTurn }));
    assert.ok(rows.length > 40 && drawn >= rows.length - 2, `reference: a real hang of ${rows.length} steps, with the idle drawn on ${drawn} of them`);
    assert.ok(Math.min(...rising.map(r => r.head)) < -0.15, `on the rig, going up: the head is ${f2(-Math.min(...rising.map(r => r.head)))} m under the hips' line (the old pose: 0.05)`);
    assert.ok(Math.max(...falling.map(r => r.head)) > 0.08, `on the rig, coming down: it is ${f2(Math.max(...falling.map(r => r.head)))} m over it (the old pose: 0.01)`);
    assert.ok(armDown[0] - armUp[0] > 0.08, `on the rig: the arm up the wall hangs lower on it going up than coming down ` +
      `(${f2(armUp[0])} of its length against ${f2(armDown[0])}; the old pose had it the other way about, 0.82 against 0.48)`);
    assert.ok(armTurn.every(turn => turn > 0.25), `on the rig, coming down: neither arm is held where it was — they turn through ${armTurn.map(f2)} rad ` +
      `between the first falling frame and the last (the old pose: 0.15 and 0.15)`);
    // the longest run of frames in which neither arm turns by a hundredth of a radian
    let held = 0, still = 0;
    for (let k = 1; k < rows.length; k++) {
      still = [0, 1].every(i => rows[k].arms[i].angleTo(rows[k - 1].arms[i]) < 0.01) ? still + 1 : 0;
      held = Math.max(held, still);
    }
    assert.ok(held < 4, `on the rig: the arms are never held — the longest they are both still is ${held} frames (the old pose: its last 14)`);
    assert.ok(worstSole < 0.01, `both soles stay on the deck through all of it (worst ${(worstSole * 1000).toFixed(1)} mm)`);
    assert.ok(repeat < 1e-4, `drawing one instant five times gives one pose: nothing accumulates on a joint (${repeat.toExponential(1)} rad)`);
    assert.ok(popped.worst.trunk < 0.03 && popped.worst.head < 0.04 && popped.worst.arms < 0.08,
      `nothing pops in the hang: from one frame to the next no part's pace changes by more than ${f2(popped.worst.trunk)} (trunk), ` +
      `${f2(popped.worst.head)} (head), ${f2(popped.worst.arms)} (arms) rad`);
  }

  // The cascade's two transfers.
  {
    // (each turn's pace is kept apart: how hard a turn is driven from one frame to the next depends on how long it has)
    const offsets = [], popped = [pace(), pace()]; let worstSole = 0, evenStep = 0, wasNormal = null, repeat = 0, turns = 0, wasTurning = false, past = 0;
    drive({ from: [C1.westLip - 3, C1.westLipY + 0.15] }, 12, (k, input) => {
      const turning = p.spinePoseDuration > 0 && p.spinePoseElapsed < p.spinePoseDuration && p.vertAir;
      if (turning && !wasTurning) turns++;
      if (!turning && wasTurning && turns === 2) return false;
      wasTurning = turning;
      if (!turning) { wasNormal = null; popped.forEach(turn => turn.skip()); return true; }
      popped[turns - 1].frame(true);
      const drawnUp = UP.clone().applyQuaternion(p.group.getWorldQuaternion(new THREE.Quaternion()));
      // radians the drawn body is ahead of the even turn, about the turn's own axis
      const ahead = Math.atan2(p.alignNormal.clone().cross(drawnUp).dot(p.spinePoseAxis), p.alignNormal.dot(drawnUp));
      const progress = p.spinePoseElapsed / p.spinePoseDuration;
      offsets.push({ turn: turns, progress, ahead });
      // (late in the turn: at its start "past the far wall" and "not yet off the near one" are the same half turn)
      if (progress > 0.6) past = Math.max(past, Math.atan2(p.vertNormal.clone().cross(drawnUp).dot(p.spinePoseAxis), p.vertNormal.dot(drawnUp)));
      if (wasNormal) evenStep = Math.max(evenStep, p.alignNormal.angleTo(wasNormal));
      wasNormal = p.alignNormal.clone();
      worstSole = Math.max(worstSole, p.boardG.userData.skateContact.footError);
      if (offsets.length === 12) { repeat = Math.max(repeat, redrawn(input)); popped[turns - 1].skip(); }
      return true;
    });
    if (process.env.VERT_AIR_TRACE) console.log('TRACE transfers', JSON.stringify({ turns, worstSole, repeat, evenStep, past, pops: popped.map(turn => turn.worst),
      each: [1, 2].map(turn => { const mine = offsets.filter(o => o.turn === turn); return { n: mine.length,
        early: Math.min(...mine.filter(o => o.progress < 0.35).map(o => o.ahead)), late: Math.max(...mine.filter(o => o.progress > 0.4).map(o => o.ahead)),
        end: mine.at(-1)?.ahead, endP: mine.at(-1)?.progress }; }) }));
    assert.equal(turns, 2, 'reference: the cascade makes its two transfers');
    assert.ok(evenStep < 0.2, `the simulation's own normal still turns evenly (${f2(evenStep)} rad at most in a step)`);
    for (const turn of [1, 2]) {
      const mine = offsets.filter(o => o.turn === turn);
      assert.ok(Math.min(...mine.filter(o => o.progress < 0.35).map(o => o.ahead)) < -0.08,
        `transfer ${turn}, drawn: the body starts behind the even turn (${f2(Math.min(...mine.map(o => o.ahead)))} rad)`);
      assert.ok(Math.max(...mine.filter(o => o.progress > 0.4).map(o => o.ahead)) > 0.25,
        `transfer ${turn}, drawn: then it is driven ahead of it (${f2(Math.max(...mine.map(o => o.ahead)))} rad)`);
      assert.ok(Math.abs(mine.at(-1).ahead) < 0.06, `transfer ${turn}, drawn: and it ends on the far wall (${f2(mine.at(-1).ahead)} rad off)`);
    }
    assert.ok(past > 0.08, `the drawn body runs ${f2(past)} rad past the far wall before it is caught`);
    assert.ok(worstSole < 0.003, `both soles stay on the deck through both transfers (worst ${(worstSole * 1000).toFixed(1)} mm)`);
    assert.ok(repeat < 1e-4, `and drawing one instant of a transfer five times gives one pose (${repeat.toExponential(1)} rad)`);
    // A turn is given three quarters of the flight it has (0.3 s at the least), so the same curve is flown
    // harder in a short one: a part's pace changes from frame to frame as the square of how much shorter. The
    // limits are those of a turn of half a second; a longer turn is held to the same ones, a quicker one to
    // what its own length gives them. (From a wait at C1's lip the cascade's first turn has 25 frames.)
    for (const turn of [1, 2]) {
      const frames = offsets.filter(o => o.turn === turn).length, worst = popped[turn - 1].worst, quick = Math.max(1, (30 / frames) ** 2);
      assert.ok(frames >= 18 && frames <= 63, `transfer ${turn}: a turn of ${frames} frames (0.3 s to 1.05 s)`);
      assert.ok(worst.trunk < 0.06 * quick && worst.head < 0.07 * quick && worst.arms < 0.15 * quick,
        `nothing pops in transfer ${turn} either (${frames} frames): ${f2(worst.trunk)} (trunk), ${f2(worst.head)} (head), ${f2(worst.arms)} (arms) rad a frame, each frame; ` +
        `the limits are ${f2(0.06 * quick)}, ${f2(0.07 * quick)}, ${f2(0.15 * quick)}`);
    }
  }

  // The cascade's transfers once more, for the soles alone, and between the frames too: each frame of a
  // turn is also drawn at seven instants on the way to the next (the transfer's own clock moved on by an
  // eighth of a step, and nothing else). The feet are planted, so against the deck a sole does not turn,
  // and it stays on it. Under his proportions a knee's world matrix is sheared: an ankle set against a
  // rotation read back out of one sat on either of two attitudes some ten degrees apart, chosen by a
  // branch of the conversion and changing from one instant to the next, and where neither would hold the
  // leg did not settle and the sole was left a centimetre off the deck for a frame.
  {
    const SUB = 8; let turns = 0, wasTurning = false, worstSole = 0, worstTurn = 0, instants = 0, last = null;
    /** Each sole's own axes in the deck's frame, read off the matrices. */
    const soles = () => ['left', 'right'].map(side => {
      const e = new THREE.Matrix4().copy(p.boardG.matrixWorld).invert().multiply(node(`ankle-${side}`).matrixWorld).elements;
      return [0, 4, 8].map(i => new THREE.Vector3(e[i], e[i + 1], e[i + 2]).normalize()); });
    const drawAt = (elapsed, input) => { p.spinePoseElapsed = elapsed; p.updateSurfaceAlignment(0); p.syncVisual(input, 0); p.group.updateMatrixWorld(true); };
    drive({ from: [C1.westLip - 3, C1.westLipY + 0.15] }, 12, (k, input) => {
      const turning = p.spinePoseDuration > 0 && p.spinePoseElapsed < p.spinePoseDuration && p.vertAir;
      if (turning && !wasTurning) turns++;
      if (!turning && wasTurning && turns === 2) return false;
      wasTurning = turning;
      if (!turning) { last = null; return true; }
      const elapsed = p.spinePoseElapsed, duration = p.spinePoseDuration;
      for (let part = 0; part < SUB; part++) {
        if (part) drawAt(Math.min(elapsed + CONST.fixedStep * part / SUB, duration * (1 - 1e-9)), input);
        const now = soles(); instants++;
        worstSole = Math.max(worstSole, p.boardG.userData.skateContact.footError);
        if (last) worstTurn = Math.max(worstTurn, ...now.flatMap((sole, i) => sole.map((axis, j) => axis.angleTo(last[i][j]))));
        last = now;
      }
      drawAt(elapsed, input); // the frame's own instant, before the simulation steps on
      return true;
    });
    if (process.env.VERT_AIR_TRACE) console.log('TRACE soles', JSON.stringify({ turns, instants, worstSole, worstTurn }));
    assert.ok(turns === 2 && instants > 500, `reference: both transfers again, drawn at ${instants} instants`);
    assert.ok(worstSole < 0.003, `at every one of them both soles are on the deck (worst ${(worstSole * 1000).toFixed(1)} mm)`);
    assert.ok(worstTurn < 0.02, `and against the deck neither sole jumps: the most one turns between two instants is ${worstTurn.toFixed(4)} rad ` +
      `(read back out of a sheared knee it flipped by 0.11)`);
  }

  level.dispose();
  console.log('PASS vert air and spine transfer: the hang trails, floats and reaches on springs of its own; the transfer winds up, is driven late, ' +
    'runs past and is caught; soles stay on the deck and do not turn on it, between frames too; nothing accumulates; the simulation\'s even turn is untouched.');
});

// ---- the same transfers, drawn the way the game draws them ---------------------------------------
// Everything above poses the rider with the native controller alone. The game also runs its authored
// animation runtime, which stands his legs a little differently, and it was there that this was seen: in
// the cascade's first transfer, as the first transfer of a session with Jump on the third step of the hang,
// one sole was 13.1 mm off the deck for a single frame, at 0.72 of the turn, with a millimetre either side.
// The knee's sheared world matrix sat on a branch of the matrix-to-quaternion conversion there; the ankle,
// set against whichever rotation came back out of it, took one of two attitudes on each refinement step,
// and the leg never settled.
await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
  stock.dispose();
  const entry = findLevel('side-pipe-lab'), level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  p.competitionMode = false; p.endlessDeaths = true;
  const bot = makeCourseBot({ p, level, CONST, lab, makeInput, parts: entry.data.components });
  const run = bot.start({ from: [lab.C1.westLip - 3, lab.C1.westLipY + 0.15] });
  const frames = []; let turns = 0, wasTurning = false;
  for (let k = 0; k < 12 * 60; k++) {
    const pad = run.decide(), input = Object.assign(makeInput({ moveX: pad.moveX, moveY: pad.moveY }), pad);
    p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); p.stepDropInPresentation();
    const over = run.observe();
    const turning = p.spinePoseDuration > 0 && p.spinePoseElapsed < p.spinePoseDuration && p.vertAir;
    if (turning && !wasTurning) turns++;
    if (!turning && wasTurning && turns === 2) break;
    wasTurning = turning;
    if (turning) frames.push({ turn: turns, variant: p.spinePoseVariant, progress: p.spinePoseElapsed / p.spinePoseDuration, sole: p.boardG.userData.skateContact.footError });
    if (over) break;
  }
  const worst = frames.reduce((a, b) => (b.sole > a.sole ? b : a), { sole: 0 });
  const first = frames.filter(f => f.turn === 1);
  if (process.env.VERT_AIR_TRACE) console.log('TRACE authored', JSON.stringify({ turns, frames: [1, 2].map(t => frames.filter(f => f.turn === t).length), worst,
    firstTransfer: first.map(f => +(f.sole * 1000).toFixed(2)) }));
  assert.ok(turns === 2 && first.length > 20 && first[0].variant === 1, `reference: the cascade's two transfers through the game's own animation runtime, ` +
    `the first of them (${first.length} frames) the first transfer of the session`);
  assert.ok(worst.sole < 0.003, `drawn the way the game draws them, both soles are within 3 mm of the deck on every frame of both transfers ` +
    `(worst ${(worst.sole * 1000).toFixed(2)} mm, on frame ${frames.filter(f => f.turn === worst.turn).indexOf(worst) + 1} of transfer ${worst.turn} at ${(worst.progress ?? 0).toFixed(2)} of the turn; ` +
    `set against a rotation read back out of the sheared knee: 13.13 mm on frame 22 of the first, at 0.72)`);
  level.dispose();
  console.log(`PASS the same transfers through the game's own animation runtime: ${frames.length} frames, soles within ${(worst.sole * 1000).toFixed(2)} mm.`);
}, { animationScheme: 'D' });
