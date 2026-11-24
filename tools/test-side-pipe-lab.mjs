// Side Pipe Lab: the REAL Player and Level play the course a side-scrolling
// player would — held right, a jump at each gap, a spin at each crab, the
// grind button at the rail — and every claim the level makes about its five
// side-on pipes is measured rather than assumed.
//
//   node tools/test-side-pipe-lab.mjs
//
// What is asserted:
//   · the level data survives the same normaliser an imported level does;
//   · walking off a deck across a coping mounts the board on the wall (every
//     pipe), and the ride never leaves the single play plane;
//   · P1 PUMP: a held direction alone falls short of the 7 m east lip on the
//     first swing, hangs off the WEST lip on the way back, clears the lip on a
//     later swing and transfers over the ridge into the landing ramp; holding
//     X to pump clears it on the first swing;
//   · P2 ENEMY: the crab on the flat is beaten by a spin from the board, and
//     costs a rider who does not spin;
//   · P3 SWITCH: with the `!` unhit there is no way out over the east wall;
//     the west hang heads the `!`, and only then does the air carry out;
//   · P4 RAIL: the hang catches the exit rail and the grind reaches the gate;
//   · a death returns to the last banked checkpoint, in front of its pipe.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { P0, P1, L1, P2, P3, P4, RAIL, RUNOUT, SWITCH_SLAB, FINISH } = lab;
  stock.dispose();

  // ---- the data contract ----------------------------------------------------
  const entry = findLevel('side-pipe-lab');
  assert.ok(entry?.data, 'Side Pipe Lab is a registered, data-built level');
  const normalised = normalizeCustomLevelData(JSON.parse(JSON.stringify(entry.data)));
  assert.ok(normalised, 'the level data passes the import normaliser (side-on pipe fields included)');
  const parts = entry.data.components;
  assert.equal(parts.filter(c => c.t === 'gate').length, 1, 'one finish gate');
  const pipes = parts.filter(c => c.t === 'vertramp');
  assert.equal(pipes.length, 6, 'five pipes and the spine landing ramp');
  assert.ok(pipes.every(c => c.sideOn === true && c.yaw === 0 && c.vkind === 'half'), 'every pipe is a side-on half');
  const zones = parts.filter(c => c.t === 'zone');
  assert.ok(zones.length === 1 && zones[0].dir === 'E' && zones[0].sideOn === true,
    'the whole course is one east travel zone, played on one line');
  const lows = parts.filter(c => c.t === 'platform').map(c => c.p[1] - c.s[1] / 2);
  assert.ok(entry.data.killY < Math.min(...lows), 'killY sits below every floor');
  for (const bad of [
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', pts: [[0, 0], [0, 10]] }, // swept path
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', yaw: 30 }, // not axis-aligned
    { t: 'vertramp', p: [0, 0, 0], vkind: 'half', wallRise: [3, 5] }, // per-wall shape without sideOn
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', wallRise: [0, 0] }, // no wall at all
    { t: 'platform', p: [0, 0, 0], sideOn: true }, // not a pipe
    { t: 'zone', p: [0, 0, 500], s: [10, 1, 10], dir: 'N', sideOn: true }, // a line zone runs east/west
  ]) {
    const data = JSON.parse(JSON.stringify(entry.data));
    data.components.push(bad);
    assert.equal(normalizeCustomLevelData(data), null, `the normaliser rejects ${JSON.stringify(bad)}`);
  }

  const level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  assert.equal(level.halfpipes.length, 6);
  assert.ok(level.halfpipes.every(hp => hp.sideOn), 'all six ride the analytic side-on backing');
  const landing = level.halfpipes.find(hp => Math.abs(hp.cross - L1.cross) < 0.01);
  assert.ok(landing.isOpen(1) && !landing.isOpen(-1), 'the landing ramp has a west wall and an open east side');
  const pump = level.halfpipes.find(hp => Math.abs(hp.cross - P1.cross) < 0.01);
  assert.equal(pump.lipYOf(-1), P1.westLipY);
  assert.equal(pump.lipYOf(1), P1.eastLipY);
  assert.ok(Math.abs(pump.lipYOf(1) - landing.lipYOf(-1)) < 1e-9 &&
    Math.abs((pump.cross + pump.lipXOf(1)) - (landing.cross - landing.lipXOf(-1))) < 1e-9,
    'the pump pipe and its landing ramp share one ridge');

  p.competitionMode = false;
  p.endlessDeaths = true;
  const step = input => { p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); input.consumeEdges(); };
  const gaps = parts.filter(c => c.t === 'pit').map(c => [c.p[0] - c.s[0] / 2, c.p[0] + c.s[0] / 2])
    // the two holes behind bare east walls are crossed in the air, never jumped on foot
    .filter(([a]) => !(a > P3.eastLip && a < SWITCH_SLAB.x1) && !(a > P4.eastLip && a < FINISH.x0));
  const pipeAt = x => [P0, P1, L1, P2, P3, P4].find(q => x > q.westLip - 0.6 && x < q.eastLip + 0.6) ?? null;

  /**
   * One run of the course. `opts.pump` holds X on every transition; `opts.spin`
   * (default true) spins at crabs and checkpoints; `opts.until` ends the run.
   */
  const play = (opts = {}) => {
    const { pump = false, spin = true, grind = true, until = () => false, seconds = 120, from = null, depth = 0, jumpInAt = null } = opts;
    level.reset(true);
    p.respawn(level, true);
    if (from) { p.pos.set(from[0], from[1], 0); p.prevPos.copy(p.pos); }
    const log = { mounts: [], hangs: [], crabsOnBoard: 0, crabsOnFoot: 0, switchAt: null, grindAt: null,
      maxZ: 0, deaths: 0, bails: 0, finished: false, t: 0, wallMax: new Map(), checkpoints: 0, respawns: [],
      transferAt: null, exitSpeed: null, masksSpent: 0, firstEastReach: new Map(), eastmostBeforeSwitch: -Infinity, trouble: [], maxHeadingZ: 0 };
    let jump = 0, stuck = 0, lastX = p.pos.x, spinWas = false, grindWas = false;
    let prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks };
    let foes = level.enemies.filter(e => e.alive).length;
    const swing = new Map(); // pipe -> { side, peak } for the wall currently being climbed
    for (let i = 0; i < seconds / CONST.fixedStep; i++) {
      log.t = i * CONST.fixedStep;
      const x = p.pos.x, onFoot = !p.freeSkate;
      const input = makeInput({ moveX: 1, moveY: depth });
      // (optional) leave the deck in a jump instead of walking over the coping
      if (jumpInAt !== null && onFoot && p.grounded && jump === 0 && x > jumpInAt - 3.2 && x < jumpInAt - 1.4) jump = 1;
      const gap = gaps.find(([a]) => x < a && a - x < 2.4);
      if (gap && onFoot && p.grounded && jump === 0) jump = 1;
      stuck = onFoot && p.grounded && p.state === 'ride' && Math.abs(x - lastX) < 0.002 ? stuck + 1 : 0;
      if (stuck > 15 && jump === 0) jump = 1; // a box or a step in the lane: hop it
      if (jump > 0) { jump++; input.jumpHeld = jump < 15; input.jumpPressed = jump === 2; input.jumpReleased = jump === 15; if (jump > 40) jump = 0; }
      if (pump && p.freeSkate && p.grounded && p.groundHit?.halfpipe) input.jumpHeld = true;
      const foe = spin && level.enemies.find(e => e.alive && Math.abs(e.group.position.x - x) < (p.freeSkate ? 5.5 : 2.6) &&
        Math.abs(e.group.position.y - p.pos.y) < 2.5);
      const post = spin && onFoot && level.checkpoints.find(c => !c.active && Math.abs(c.mesh.position.x - x) < 1.6 &&
        Math.abs(c.mesh.position.y - p.pos.y) < 2);
      // a box standing in the lane of an on-foot floor: spin through it, as a player does
      const box = spin && onFoot && level.crates.find(c => c.alive && !c.pending && !c.bang &&
        c.mesh.position.x > x && c.mesh.position.x - x < 1.7 && Math.abs(c.mesh.position.y - p.pos.y) < 2.4);
      const wantSpin = !!(foe || post || box);
      input.spinHeld = wantSpin; input.spinPressed = wantSpin && !spinWas; spinWas = wantSpin;
      const wantGrind = grind && p.state === 'air' && Math.abs(x - P4.eastLip) < 1 && p.pos.y > RAIL.y0 - 1.9;
      input.grindHeld = wantGrind || p.state === 'grind'; input.grindPressed = wantGrind && !grindWas; grindWas = wantGrind;
      // (right stays held on the rail too: on a side-on line the stick held at the catch is not a lean)
      lastX = x;
      step(input);

      const here = pipeAt(p.pos.x);
      log.maxZ = Math.max(log.maxZ, Math.abs(p.pos.z));
      if (p.freeSkate && p.grounded && p.groundHit?.halfpipe) log.maxHeadingZ = Math.max(log.maxHeadingZ, Math.abs(p.axisF.z));
      if (p.freeSkate && !prev.free && p.groundHit?.halfpipe) log.mounts.push({ pipe: here?.name, x: p.pos.x, y: p.pos.y, speed: p.speed });
      if (p.vertAir && !prev.vert && here)
        log.hangs.push({ pipe: here.name, side: p.pos.x < here.cross ? 'west' : 'east', vV: p.vVel, t: log.t });
      // highest point reached on each wall, per swing (first east reach is the pump claim)
      if (here && p.grounded && p.groundHit?.halfpipe && Math.abs(p.pos.x - here.cross) > here.flatHalf) {
        const side = p.pos.x < here.cross ? 'west' : 'east';
        const s = swing.get(here.name);
        if (!s || s.side !== side) {
          if (s && s.side === 'east' && !log.firstEastReach.has(here.name)) log.firstEastReach.set(here.name, s.peak);
          swing.set(here.name, { side, peak: p.pos.y });
        } else s.peak = Math.max(s.peak, p.pos.y);
      }
      if (log.transferAt === null && p.pos.x > P1.eastLip + 0.05 && p.pos.x < L1.eastLip && p.pos.y > L1.floorY + 0.5) log.transferAt = log.t;
      if (log.exitSpeed === null && p.grounded && p.pos.x > RUNOUT.x0 + 1 && p.pos.x < RUNOUT.x0 + 4) log.exitSpeed = p.speed;
      const alive = level.enemies.filter(e => e.alive).length;
      if (alive < foes) { if (p.freeSkate) log.crabsOnBoard++; else log.crabsOnFoot++; }
      foes = alive;
      if (log.switchAt === null && level.crates.some(c => c.bang && c.bangUsed)) log.switchAt = { t: log.t, x: p.pos.x, y: p.pos.y, vert: p.vertAir || prev.vert };
      if (log.switchAt === null && here === P3) log.eastmostBeforeSwitch = Math.max(log.eastmostBeforeSwitch, p.pos.x);
      if (p.state === 'grind' && prev.state !== 'grind' && log.grindAt === null) log.grindAt = { t: log.t, x: p.pos.x, y: p.pos.y };
      if (prev.state === 'grind' && p.state !== 'grind' && log.grindAt && !log.grindEnd)
        log.grindEnd = { x: p.pos.x, speed: Math.abs(p.speed), bailed: p.isBailing, seconds: log.t - log.grindAt.t };
      if (p.isBailing && !prev.bail) { log.bails++; log.trouble.push(`bailed at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)}`); }
      if (p.masks < prev.masks) log.masksSpent++;
      log.checkpoints = level.checkpoints.filter(c => c.active).length;
      if (p.totalDeaths > prev.deaths) { log.deaths++; log.trouble.push(`died at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)}`); }
      if (prev.state === 'dead' && p.state !== 'dead') log.respawns.push({ x: p.pos.x, y: p.pos.y });
      prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks };
      if (p.state === 'finished') { log.finished = true; break; }
      if (until(log, p)) break;
    }
    return log;
  };

  // ---- 1 · the whole course, the way it is meant to be held ------------------
  const run = play();
  assert.ok(run.finished, `the course finishes on held right (stopped at x ${p.pos.x.toFixed(1)}, t ${run.t.toFixed(1)}; ${run.trouble.join('; ')})`);
  assert.equal(run.deaths + run.bails, 0, `no death or bail on the intended line (${run.trouble.join('; ')})`);
  assert.ok(run.maxZ < 0.4, `the ride never leaves the play plane (max |z| ${run.maxZ.toFixed(2)})`);
  for (const q of [P0, P1, P2, P3, P4]) {
    const mount = run.mounts.find(m => m.pipe === q.name);
    assert.ok(mount, `${q.name}: crossing the west coping on foot mounts the board`);
    assert.ok(Math.abs(mount.x - q.westLip) < 0.2 && mount.y < q.westLipY && mount.y > q.westLipY - 0.6,
      `${q.name}: the drop-in seats the rider on the wall just under the lip (x ${mount.x.toFixed(2)}, y ${mount.y.toFixed(2)})`);
    assert.ok(mount.speed >= 4, `${q.name}: the drop-in keeps rolling speed`);
  }
  // P1: short, back for a west hang, then over.
  const firstReach = run.firstEastReach.get(P1.name);
  assert.ok(firstReach !== undefined && firstReach < P1.eastLipY - 1,
    `P1: the first swing falls well short of the east lip (reached ${firstReach?.toFixed(2)} of ${P1.eastLipY})`);
  const p1Hangs = run.hangs.filter(h => h.pipe === P1.name);
  assert.equal(p1Hangs[0]?.side, 'west', 'P1: the first hang is off the low WEST lip, on the swing back');
  assert.ok(p1Hangs.some(h => h.side === 'east'), 'P1: a later swing reaches the east lip');
  assert.ok(run.transferAt !== null, 'P1: the east hang transfers over the ridge into the landing ramp');
  assert.ok(run.exitSpeed >= 18, `P1: the landing ramp rolls out at smash speed (${run.exitSpeed?.toFixed(1)} m/s)`);
  // P2 / P3 / P4.
  assert.equal(run.crabsOnBoard, 1, 'P2: the crab on the flat is spun from the board');
  assert.ok(run.switchAt?.vert && Math.abs(run.switchAt.x - P3.westLip) < 0.5 && run.switchAt.y > P3.westLipY + 4.5,
    'P3: the ! is headed out of the WEST hang, well above anything a jump off the deck reaches');
  const p3Hangs = run.hangs.filter(h => h.pipe === P3.name);
  assert.ok(p3Hangs[0]?.side === 'east' && p3Hangs[0].t < run.switchAt.t,
    'P3: the rider hangs over the bare east lip BEFORE the switch');
  assert.ok(run.eastmostBeforeSwitch <= P3.eastLip + 0.05,
    `P3: with the ! unhit that hang is not carried out over the hole (eastmost x ${run.eastmostBeforeSwitch.toFixed(2)}, lip ${P3.eastLip})`);
  assert.ok(run.grindAt && Math.abs(run.grindAt.x - P4.eastLip) < 1.5, 'P4: the east hang catches the exit rail');
  assert.ok(run.grindEnd && !run.grindEnd.bailed && run.grindEnd.x > RAIL.x1 - 0.5,
    `P4: with right still held, the grind rides the whole rail (left it at x ${run.grindEnd?.x.toFixed(1)}, rail ends ${RAIL.x1})`);
  assert.ok(run.grindEnd.speed > 15 && run.grindEnd.seconds < 1.1,
    `P4: the rail gathers speed and is over before the needle can run away (${run.grindEnd.seconds.toFixed(2)} s, ${run.grindEnd.speed.toFixed(1)} m/s)`);
  assert.equal(run.checkpoints, level.checkpoints.length, 'every checkpoint is on the on-foot line and gets banked');

  // ---- 2 · pumping is the shortcut -------------------------------------------
  const pumped = play({ pump: true, until: log => log.transferAt !== null, seconds: 30 });
  assert.ok(pumped.transferAt !== null, 'P1 pumped: the transfer happens');
  assert.equal(pumped.hangs.filter(h => h.pipe === P1.name && h.side === 'west').length, 0,
    'P1 pumped: holding X on the walls clears the east lip on the FIRST swing, with no trip back west');

  // ---- 3 · the crab charges for a missed spin ---------------------------------
  const careless = play({ spin: false, from: [P2.westLip - 3, P2.westLipY + 0.15],
    until: log => log.deaths > 0 || log.masksSpent > 0 || log.bails > 0, seconds: 12 });
  assert.ok(careless.deaths + careless.masksSpent + careless.bails > 0,
    'P2: riding the flat without a spin runs into the crab');

  // ---- 4 · on one line, the stick against travel is the brake --------------------
  // Out of P0 the board is still rolling east. Holding left cannot carve a
  // U-turn on a plane: it has to stop the board, step off and walk back — and
  // walking back over the EAST coping drops in again, heading west.
  {
    play({ until: (log, q) => q.grounded && q.freeSkate && q.pos.x > P0.eastLip + 3, seconds: 20 });
    assert.ok(p.grounded && p.freeSkate && p.pos.x > P0.eastLip + 3, 'reference: rolling east on the board past P0');
    const input = makeInput();
    const turnedAt = p.pos.x;
    let eastmost = turnedAt, onFootAt = null, westDropIn = false, home = false;
    for (let k = 0; k < 900 && !home; k++) {
      const wasFree = p.freeSkate;
      input.moveX = -1; step(input);
      eastmost = Math.max(eastmost, p.pos.x);
      if (onFootAt === null && !p.freeSkate && p.grounded) onFootAt = p.pos.x;
      if (!wasFree && p.freeSkate && p.groundHit?.halfpipe && p.axisF.x < 0) westDropIn = true;
      home = p.grounded && p.pos.x < P0.westLip - 2;
    }
    assert.ok(eastmost - turnedAt < 6, `held left stops the board within a few metres (rolled ${(eastmost - turnedAt).toFixed(2)} m on)`);
    assert.ok(onFootAt !== null, 'the brake steps the rider off the board');
    assert.ok(westDropIn, 'walking back over the east coping drops in again, heading west');
    assert.ok(home, 'and the west hang carries out onto the west deck: the pipe works in both directions');
  }

  // ---- 5 · the pipe is ridden on its cross axis, whatever the stick says -------
  // Jump into P0 instead of walking in, with the stick held up-and-right the
  // whole time. Landing on the pipe mounts the board from a diagonal stick;
  // the heading must still be the one line the camera sees.
  const diagonal = play({ depth: 1, jumpInAt: P0.westLip, seconds: 20,
    until: (log, q) => q.grounded && q.pos.x > P0.eastLip + 3 });
  assert.ok(p.grounded && p.pos.x > P0.eastLip + 3, `P0 jumped into with a diagonal stick: still exits east (${diagonal.trouble.join('; ')})`);
  const jumpedIn = diagonal.mounts.find(m => m.pipe === P0.name);
  assert.ok(jumpedIn && jumpedIn.y < P0.westLipY - 1, 'P0 jumped into: the board mounts on landing inside the pipe, not at the lip');
  assert.equal(diagonal.maxHeadingZ, 0, 'a diagonal stick never turns the board off the cross axis');
  assert.ok(diagonal.maxZ < 0.05 && diagonal.bails === 0, `...nor carries the ride out of the play plane (max |z| ${diagonal.maxZ.toFixed(3)})`);

  // ---- 6 · a hang stays on its line when it heads a solid ------------------------
  // The awkward case, in a pipe of its own: a `!` floated over a BARE lip with a
  // drop behind it. The crate's sideways push-out must not walk the rider off
  // the hang line and down the back of the wall.
  {
    const R = 4, F = 3, lip = F + R;
    const fixture = new Level(scene, { id: '__side_pipe_pin', name: 'side pipe pin', data: { v: 1, name: 'side pipe pin',
      spawn: [-lip - 5, R + 0.12, 0], killY: -20, components: [
        { t: 'platform', p: [0, -1.5, 0], s: [90, 1, 6] },
        { t: 'vertramp', vkind: 'half', sideOn: true, p: [0, 0, 0], len: 6, yaw: 0, rise: R, w: F, wallDeck: [8, 0] },
        { t: 'crate', kind: 'bang', p: [lip - 0.1, R + 3, 0] },
        { t: 'zone', p: [0, 0, 0], s: [120, 1, 18], dir: 'E', sideOn: true },
        { t: 'camnode', p: [-50, 0, 0] }, { t: 'camnode', p: [50, 0, 0] },
        { t: 'gate', p: [40, -1, 0], yaw: 90 },
        ...[-0.83, 0.83].map(z => ({ t: 'wall', p: [0, -14, z], s: [120, 60, 0.6], invisible: true })),
      ] } });
    scene.updateMatrixWorld(true);
    p.respawn(fixture, true);
    const input = makeInput();
    let eastmost = -Infinity, headed = false, behind = false;
    for (let i = 0; i < 60 * 9; i++) {
      input.moveX = 1;
      p.step(CONST.fixedStep, input, fixture); fixture.update(CONST.fixedStep); input.consumeEdges();
      eastmost = Math.max(eastmost, p.pos.x);
      headed ||= fixture.crates.some(c => c.bang && c.bangUsed);
      behind ||= p.pos.x > lip + 0.3;
    }
    fixture.dispose();
    assert.ok(headed, 'fixture: the hang heads the ! over the bare east lip');
    assert.ok(!behind, `fixture: the rider is never pushed out behind the wall (eastmost x ${eastmost.toFixed(2)}, lip ${lip})`);
    p.respawn(level, true);
  }

  // ---- 7 · a death goes back to the checkpoint before its pipe ------------------
  const toRail = play({ until: (log, q) => log.checkpoints === level.checkpoints.length && q.pos.x > P4.westLip - 2 });
  assert.equal(toRail.checkpoints, level.checkpoints.length, 'the last checkpoint is banked on the way to the rail pipe');
  // Drop the rider into the hole under the rail, as a missed grind would.
  p.respawn(level, false, false, { position: p.pos.clone().set(P4.eastLip + 6, FINISH.top + 1, 0), heading: p.pos.clone().set(1, 0, 0) });
  let back = null;
  const idle = makeInput();
  for (let i = 0, was = p.state; i < 900 && !back; i++) {
    step(idle);
    if (was === 'dead' && p.state !== 'dead') back = { x: p.pos.x, y: p.pos.y };
    was = p.state;
  }
  assert.ok(back && back.x > P3.eastLip && back.x < P4.westLip,
    `a fall under the rail returns to the checkpoint before the rail pipe (respawned at x ${back?.x.toFixed(1)})`);

  level.dispose();
  console.log(`PASS Side Pipe Lab: finished in ${run.t.toFixed(1)} s on held right; P1 first swing climbed ` +
    `${(firstReach - P1.floorY).toFixed(2)} m of the ${P1.eastRise} m east wall, ` +
    `spine exit ${run.exitSpeed.toFixed(1)} m/s; pumped transfer at ${pumped.transferAt.toFixed(1)} s; ` +
    `${run.mounts.length} drop-ins, ${run.checkpoints} checkpoints banked.`);
});
