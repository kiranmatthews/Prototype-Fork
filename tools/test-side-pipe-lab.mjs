// Side Pipe Lab: the REAL Player and Level play the course a side-scrolling
// player would — right held from the first step to the gate, a jump at each
// gap and step, a spin at each crab, box and checkpoint, Jump in each east
// hang to pop out, the grind button at the rail — and every claim the level
// makes about its side-on pipes is measured rather than assumed.
//
//   node tools/test-side-pipe-lab.mjs        (npm run check:side-pipe)
//
// What is asserted:
//   · the level data survives the same normaliser an imported level does, and
//     the normaliser refuses the side-on fields anywhere they do not belong;
//   · walking off a deck across a coping mounts the board on the wall (every
//     pipe), the ride never leaves the single play plane, and the drop-in is
//     DRAWN as one continuous curve from the deck onto the wall;
//   · popping out takes the spine transfer's input — Jump in the hang with the
//     stick held out over the lip — and lands on foot; the stick alone never
//     leaves a pipe;
//   · P1 PUMP: a held direction alone falls short of the 7 m east lip on the
//     first swing, hangs off the WEST lip on the way back, clears the lip on a
//     later swing and transfers over the ridge into the second pipe, whose
//     far deck is popped out onto; holding X to pump clears it on the first
//     swing;
//   · P2 ENEMY: the crab on the flat is beaten by a spin from the board, and
//     costs a rider who does not spin;
//   · P3 SWITCH: with the `!` unhit there is no way out over the east wall;
//     the west hang heads the `!`, and only then does the pop-out land;
//   · P4 RAIL: the hang catches the exit rail and, with right still held, the
//     grind rides it to the end; the grind button held too early parks a lip
//     stall on the bare coping instead, which settles back into the pipe;
//   · a step lower than the skater's reach is BUMPED, on foot or on the
//     board — never grabbed — and jumped;
//   · a board thrown away in a hang falls, lands in the pipe and comes to
//     rest, on a plane narrower than the board is long;
//   · on the one-line zone the stick against travel brakes the board, and the
//     pipe is ridden back westward the same way;
//   · a jump into a pipe on a diagonal stick still rides its cross axis;
//   · a hang that heads a solid over a bare lip stays on its line;
//   · a death returns to the last banked checkpoint, in front of its pipe.
// Each of those rules, removed from the runtime, fails this file by name.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { P0, P1, L1, P2, P3, P4, RAIL, SPINE_LANDING, SWITCH_SLAB, FINISH } = lab;
  stock.dispose();

  // ---- the data contract ----------------------------------------------------
  const entry = findLevel('side-pipe-lab');
  assert.ok(entry?.data, 'Side Pipe Lab is a registered, data-built level');
  const normalised = normalizeCustomLevelData(JSON.parse(JSON.stringify(entry.data)));
  assert.ok(normalised, 'the level data passes the import normaliser (side-on pipe fields included)');
  const parts = entry.data.components;
  assert.equal(parts.filter(c => c.t === 'gate').length, 1, 'one finish gate');
  const pipes = parts.filter(c => c.t === 'vertramp');
  assert.equal(pipes.length, 6, 'five pipes and the second pipe behind the spine');
  assert.ok(pipes.every(c => c.sideOn === true && c.yaw === 0 && c.vkind === 'half'), 'every pipe is a side-on half');
  const zones = parts.filter(c => c.t === 'zone');
  assert.ok(zones.length === 1 && zones[0].dir === 'E' && zones[0].sideOn === true,
    'the whole course is one east travel zone, played on one line');
  const blocks = parts.filter(c => c.t === 'platform');
  assert.ok(entry.data.killY < Math.min(...blocks.map(c => c.p[1] - c.s[1] / 2)), 'killY sits below every floor');
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
  const second = level.halfpipes.find(hp => Math.abs(hp.cross - L1.cross) < 0.01);
  const pump = level.halfpipes.find(hp => Math.abs(hp.cross - P1.cross) < 0.01);
  assert.equal(pump.lipYOf(-1), P1.westLipY);
  assert.equal(pump.lipYOf(1), P1.eastLipY);
  assert.ok(Math.abs(pump.lipYOf(1) - second.lipYOf(-1)) < 1e-9 &&
    Math.abs((pump.cross + pump.lipXOf(1)) - (second.cross - second.lipXOf(-1))) < 1e-9,
    'the pump pipe and the pipe behind it share one ridge');
  assert.ok(second.lipYOf(1) < second.lipYOf(-1) && second.deckOf(1) > 0, 'the second pipe has a lower, decked east wall: the next landing');

  p.competitionMode = false;
  p.endlessDeaths = true;
  // The drawn drop-in is advanced where the game advances it: after each step.
  const step = input => { p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); p.stepDropInPresentation(); input.consumeEdges(); };
  const gaps = parts.filter(c => c.t === 'pit').map(c => [c.p[0] - c.s[0] / 2, c.p[0] + c.s[0] / 2])
    // the two holes behind bare east walls are crossed in the air, never jumped on foot
    .filter(([a]) => !(a > P3.eastLip && a < SWITCH_SLAB.x1) && !(a > P4.eastLip && a < FINISH.x0));
  // steps up on the on-foot floors: where one block's top meets a taller one's west face
  const floors = blocks.filter(c => !/footing/.test(c.nm ?? '')).map(c => ({ x0: c.p[0] - c.s[0] / 2, x1: c.p[0] + c.s[0] / 2, top: c.p[1] + c.s[1] / 2 }));
  const steps = floors.flatMap(b => floors.filter(a => Math.abs(a.x1 - b.x0) < 0.01 && b.top - a.top > 0.4 && b.top - a.top < 3)
    .map(a => ({ x: b.x0, rise: b.top - a.top, below: a.top })));
  assert.ok(steps.length >= 4 && steps.every(s => s.rise <= 1.61), `the on-foot steps are all within a tap jump (${steps.map(s => s.rise.toFixed(2))})`);
  const pipeAt = x => [P0, P1, L1, P2, P3, P4].find(q => x > q.westLip - 0.6 && x < q.eastLip + 0.6) ?? null;

  /**
   * One run of the course from the spawn (or `from`), right held throughout.
   * `pump` holds X on every transition; `spin` (default on) spins at crabs,
   * boxes and checkpoints; `pop` (default on) presses Jump once in each east
   * hang; `grind` (default on) asks for the rail out of P4's east hang, and
   * `grind: 'early'` also holds the button up P4's wall until it has parked
   * one lip stall; `depth` adds a toward/away stick; `jumpInAt` leaves the
   * deck before that lip in a jump; `until` ends the run early.
   */
  const play = (opts = {}) => {
    const { pump = false, spin = true, pop = true, grind = true, until = () => false, seconds = 120, from = null, depth = 0, jumpInAt = null } = opts;
    level.reset(true);
    p.respawn(level, true);
    if (from) { p.pos.set(from[0], from[1], 0); p.prevPos.copy(p.pos); }
    const log = { mounts: [], hangs: [], stalls: [], exits: new Map(), crabsOnBoard: 0, crabsOnFoot: 0, switchAt: null, grindAt: null, grindEnd: null,
      maxZ: 0, deaths: 0, bails: 0, grabs: 0, finished: false, t: 0, checkpoints: 0, respawns: [],
      transferAt: null, masksSpent: 0, firstEastReach: new Map(), eastmostBeforeSwitch: -Infinity, trouble: [], maxHeadingZ: 0 };
    let jump = 0, stuck = 0, lastX = p.pos.x, spinWas = false, grindWas = false, hang = 0, heldWas = false;
    let prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks, stall: false };
    let foes = level.enemies.filter(e => e.alive).length;
    const swing = new Map(); // pipe -> { side, peak } for the wall currently being climbed
    for (let i = 0; i < seconds / CONST.fixedStep; i++) {
      log.t = i * CONST.fixedStep;
      const x = p.pos.x, onFoot = !p.freeSkate, at = pipeAt(x);
      const input = makeInput({ moveX: 1, moveY: depth });
      // (optional) leave the deck in a jump instead of walking over the coping
      if (jumpInAt !== null && onFoot && p.grounded && jump === 0 && x > jumpInAt - 3.2 && x < jumpInAt - 1.4) jump = 1;
      const gap = gaps.find(([a]) => x < a && a - x < 2.4);
      const stepUp = steps.find(s => x < s.x && s.x - x < 2.2 && Math.abs(p.pos.y - s.below) < 0.3);
      if ((gap || stepUp) && onFoot && p.grounded && jump === 0) jump = 1;
      stuck = onFoot && p.grounded && p.state === 'ride' && Math.abs(x - lastX) < 0.002 ? stuck + 1 : 0;
      if (stuck > 15 && jump === 0) jump = 1; // a box in the lane: hop it
      let held = false;
      if (jump > 0) { jump++; held = jump < 15; if (jump > 40) jump = 0; }
      if (pump && p.freeSkate && p.grounded && p.groundHit?.halfpipe) held = true;
      // POP OUT: one Jump in each east hang, right still held — the spine transfer's input
      hang = pop && p.vertAir && at && x > at.cross ? hang + 1 : 0;
      if (hang >= 3 && hang < 7) held = true;
      input.jumpHeld = held; input.jumpPressed = held && !heldWas; input.jumpReleased = !held && heldWas; heldWas = held;
      const foe = spin && level.enemies.find(e => e.alive && Math.abs(e.group.position.x - x) < (p.freeSkate ? 5.5 : 2.6) &&
        Math.abs(e.group.position.y - p.pos.y) < 2.5);
      const post = spin && onFoot && level.checkpoints.find(c => !c.active && Math.abs(c.mesh.position.x - x) < 1.6 &&
        Math.abs(c.mesh.position.y - p.pos.y) < 2);
      // a box standing in the lane of an on-foot floor: spin through it, as a player does
      const box = spin && onFoot && level.crates.find(c => c.alive && !c.pending && !c.bang &&
        c.mesh.position.x > x && c.mesh.position.x - x < 1.7 && Math.abs(c.mesh.position.y - p.pos.y) < 2.4);
      const wantSpin = !!(foe || post || box);
      input.spinHeld = wantSpin; input.spinPressed = wantSpin && !spinWas; spinWas = wantSpin;
      const wantGrind = (grind && p.state === 'air' && Math.abs(x - P4.eastLip) < 1 && p.pos.y > RAIL.y0 - 1.9) ||
        (grind === 'early' && log.stalls.length === 0 && p.freeSkate && at === P4);
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
      const stalled = p.lipStallT > 0;
      if (stalled && !prev.stall && here) log.stalls.push({ pipe: here.name, side: p.pos.x < here.cross ? 'west' : 'east', t: log.t });
      if (!stalled && prev.stall && log.stalls.length) Object.assign(log.stalls.at(-1), { seconds: log.t - log.stalls.at(-1).t,
        backInPipe: !p.isBailing && here !== null && p.pos.x > here.westLip && p.pos.x < here.eastLip });
      // the first touchdown past each pipe's east lip: is the rider on foot?
      for (const q of [P0, L1, P2, P3]) if (!log.exits.has(q.name) && p.grounded && p.state === 'ride' && !p.groundHit?.halfpipe &&
        p.pos.x > q.eastLip + 0.05 && p.pos.x < q.eastLip + 9 && Math.abs(p.pos.y - q.eastLipY) < 0.5)
        log.exits.set(q.name, { onFoot: false, x: p.pos.x, t: log.t });
      // (the step-off is the stride after the wheels touch)
      for (const out of log.exits.values()) if (log.t - out.t < 0.25 && p.grounded && !p.freeSkate) out.onFoot = true;
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
      const alive = level.enemies.filter(e => e.alive).length;
      if (alive < foes) { if (p.freeSkate) log.crabsOnBoard++; else log.crabsOnFoot++; }
      foes = alive;
      if (log.switchAt === null && level.crates.some(c => c.bang && c.bangUsed)) log.switchAt = { t: log.t, x: p.pos.x, y: p.pos.y, vert: p.vertAir || prev.vert };
      if (log.switchAt === null && here === P3) log.eastmostBeforeSwitch = Math.max(log.eastmostBeforeSwitch, p.pos.x);
      if (p.state === 'grind' && prev.state !== 'grind' && log.grindAt === null) log.grindAt = { t: log.t, x: p.pos.x, y: p.pos.y };
      if (prev.state === 'grind' && p.state !== 'grind' && log.grindAt && !log.grindEnd)
        log.grindEnd = { x: p.pos.x, speed: Math.abs(p.speed), bailed: p.isBailing, seconds: log.t - log.grindAt.t };
      if (p.state === 'hang' && prev.state !== 'hang') { log.grabs++; log.trouble.push(`ledge grab at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)}`); }
      if (p.isBailing && !prev.bail) { log.bails++; log.trouble.push(`bailed at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)}`); }
      if (p.masks < prev.masks) log.masksSpent++;
      log.checkpoints = level.checkpoints.filter(c => c.active).length;
      if (p.totalDeaths > prev.deaths) { log.deaths++; log.trouble.push(`died at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)}`); }
      if (prev.state === 'dead' && p.state !== 'dead') log.respawns.push({ x: p.pos.x, y: p.pos.y });
      prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks, stall: stalled };
      if (p.state === 'finished') { log.finished = true; break; }
      if (until(log, p)) break;
    }
    return log;
  };

  // ---- 1 · the whole course, the way it is meant to be held ------------------
  const run = play();
  assert.ok(run.finished, `the course finishes on held right (stopped at x ${p.pos.x.toFixed(1)}, t ${run.t.toFixed(1)}; ${run.trouble.join('; ')})`);
  assert.equal(run.deaths + run.bails, 0, `no death or bail on the intended line (${run.trouble.join('; ')})`);
  assert.equal(run.grabs, 0, `nothing on the course is climbed by the hands: every step is jumped (${run.trouble.join('; ')})`);
  assert.ok(run.maxZ < 0.4, `the ride never leaves the play plane (max |z| ${run.maxZ.toFixed(2)})`);
  for (const q of [P0, P1, P2, P3, P4]) {
    const mount = run.mounts.find(m => m.pipe === q.name);
    assert.ok(mount, `${q.name}: crossing the west coping on foot mounts the board`);
    assert.ok(Math.abs(mount.x - q.westLip) < 0.2 && mount.y < q.westLipY && mount.y > q.westLipY - 0.6,
      `${q.name}: the drop-in seats the rider on the wall just under the lip (x ${mount.x.toFixed(2)}, y ${mount.y.toFixed(2)})`);
    assert.ok(mount.speed >= 4, `${q.name}: the drop-in keeps rolling speed`);
  }
  // Popping out: Jump in the east hang, right held. It lands on the deck, on foot.
  for (const q of [P0, L1, P2, P3]) {
    const out = run.exits.get(q.name);
    assert.ok(out, `${q.name}: Jump in the east hang with right held pops out past the east lip`);
    assert.ok(out.onFoot, `${q.name}: the pop-out lands on foot (touched down at x ${out.x.toFixed(1)})`);
  }
  // P1: short, back for a west hang, then over the ridge into the second pipe.
  const firstReach = run.firstEastReach.get(P1.name);
  assert.ok(firstReach !== undefined && firstReach < P1.eastLipY - 1,
    `P1: the first swing falls well short of the east lip (reached ${firstReach?.toFixed(2)} of ${P1.eastLipY})`);
  const p1Hangs = run.hangs.filter(h => h.pipe === P1.name);
  assert.equal(p1Hangs[0]?.side, 'west', 'P1: the first hang is off the low WEST lip, on the swing back');
  assert.ok(p1Hangs.some(h => h.side === 'east'), 'P1: a later swing reaches the east lip');
  assert.ok(run.transferAt !== null, 'P1: Jump in the east hang transfers over the ridge into the second pipe');
  assert.ok(run.exits.get(L1.name).t > run.transferAt && run.exits.get(L1.name).x < SPINE_LANDING.x1,
    'P1: the second pipe is popped out of onto its far deck, the next landing');
  // P2 / P3 / P4.
  assert.equal(run.crabsOnBoard, 1, 'P2: the crab on the flat is spun from the board');
  assert.ok(run.switchAt?.vert && Math.abs(run.switchAt.x - P3.westLip) < 0.5 && run.switchAt.y > P3.westLipY + 4.5,
    'P3: the ! is headed out of the WEST hang, well above anything a jump off the deck reaches');
  const p3Hangs = run.hangs.filter(h => h.pipe === P3.name);
  assert.ok(p3Hangs[0]?.side === 'east' && p3Hangs[0].t < run.switchAt.t,
    'P3: the rider hangs over the bare east lip BEFORE the switch');
  assert.ok(run.eastmostBeforeSwitch <= P3.eastLip + 0.05,
    `P3: with the ! unhit that hang's pop-out has nowhere to land and is not taken (eastmost x ${run.eastmostBeforeSwitch.toFixed(2)}, lip ${P3.eastLip})`);
  assert.ok(run.exits.get(P3.name).t > run.switchAt.t, 'P3: only after the switch does the pop-out land, on the slab it made solid');
  assert.ok(run.grindAt && Math.abs(run.grindAt.x - P4.eastLip) < 1.5, 'P4: the east hang catches the exit rail');
  assert.ok(run.grindEnd && !run.grindEnd.bailed && run.grindEnd.x > RAIL.x1 - 0.5,
    `P4: with right still held, the grind rides the whole rail (left it at x ${run.grindEnd?.x.toFixed(1)}, rail ends ${RAIL.x1})`);
  assert.ok(run.grindEnd.speed > 15 && run.grindEnd.seconds < 1.1,
    `P4: the rail gathers speed and is over before the needle can run away (${run.grindEnd.seconds.toFixed(2)} s, ${run.grindEnd.speed.toFixed(1)} m/s)`);
  assert.equal(run.checkpoints, level.checkpoints.length, 'every checkpoint is on the on-foot line and gets banked');

  // ---- 2 · the stick alone never leaves a pipe ---------------------------------
  // Right is held for a quarter of a minute and Jump never touched: the rider
  // swings wall to wall in the first pipe and is still in it.
  {
    const held = play({ pop: false, seconds: 15 });
    const eastHangs = held.hangs.filter(h => h.pipe === P0.name && h.side === 'east').length;
    assert.ok(eastHangs >= 2, `P0 with no Jump: the rider keeps hanging off the east lip (${eastHangs} times)`);
    assert.ok(!held.exits.has(P0.name) && p.pos.x < P0.eastLip + 0.3 && p.pos.x > P0.westLip - 0.3,
      `P0 with no Jump: direction alone never pops out (ended at x ${p.pos.x.toFixed(2)})`);
    assert.equal(held.bails + held.deaths, 0, 'P0 with no Jump: and it costs nothing');
  }

  // ---- 3 · pumping is the shortcut -------------------------------------------
  const pumped = play({ pump: true, until: log => log.transferAt !== null, seconds: 30 });
  assert.ok(pumped.transferAt !== null, 'P1 pumped: the transfer happens');
  assert.equal(pumped.hangs.filter(h => h.pipe === P1.name && h.side === 'west').length, 0,
    'P1 pumped: holding X on the walls clears the east lip on the FIRST swing, with no trip back west');

  // ---- 4 · the crab charges for a missed spin ---------------------------------
  const careless = play({ spin: false, from: [P2.westLip - 3, P2.westLipY + 0.15],
    until: log => log.deaths > 0 || log.masksSpent > 0 || log.bails > 0, seconds: 12 });
  assert.ok(careless.deaths + careless.masksSpent + careless.bails > 0,
    'P2: riding the flat without a spin runs into the crab');

  // ---- 5 · a wall lower than the skater's reach is a bump, not a ledge ----------
  // The first step of the course is 1.6 m; the skater stands 2.8 m and reaches
  // 2.55 m. Walking into it, and then rolling into it on the board, must do
  // nothing but stop: no hang, no climb, no spill. A jump takes it.
  {
    const wall = steps[0];
    const walkInto = (mounted) => {
      level.reset(true); p.respawn(level, true);
      p.pos.set(wall.x - (mounted ? 17 : 6), wall.below + 0.12, 0); p.prevPos.copy(p.pos);
      const input = makeInput();
      let hung = false, bailed = false, eastmost = -Infinity, hitSpeed = 0;
      for (let k = 0; k < 60 * 6; k++) {
        input.moveX = 1;
        // X + a direction for a moment is the ordinary push-off onto the board
        // (letting go of X pops a small ollie, which lands well short of the step)
        const push = mounted && k < 40;
        input.jumpPressed = push && k === 0; input.jumpReleased = mounted && k === 40; input.jumpHeld = push;
        step(input);
        hung ||= p.state === 'hang'; bailed ||= p.isBailing;
        if (p.freeSkate && p.grounded && p.pos.x > wall.x - 4 && p.pos.x < wall.x - 1) hitSpeed = Math.max(hitSpeed, Math.abs(p.speed));
        eastmost = Math.max(eastmost, p.pos.x);
      }
      return { hung, bailed, eastmost, hitSpeed };
    };
    const onFoot = walkInto(false);
    assert.ok(!onFoot.hung, 'on foot: walking into a 1.6 m step is not a ledge grab');
    assert.ok(onFoot.eastmost < wall.x && p.pos.y < wall.below + 0.3, `on foot: the step simply stops the walker (x ${onFoot.eastmost.toFixed(2)}, step at ${wall.x})`);
    const onBoard = walkInto(true);
    assert.ok(onBoard.hitSpeed > 8 && onBoard.hitSpeed < 12.5, `reference: the second approach rolls into it on the board, under wipe-out speed (${onBoard.hitSpeed.toFixed(1)} m/s)`);
    assert.ok(!onBoard.hung, 'on the board: rolling into the step is not a ledge grab either');
    assert.ok(!onBoard.bailed && onBoard.eastmost < wall.x, 'on the board: under wipe-out speed it is a bump, not a spill');
  }
  // The rule itself, on the wall the owner met: 2.1 m, tall enough that the
  // game used to hang him from it and shorter than he is. And its other side:
  // where a level's ledgeAssist lets the hands reach a lip ABOVE his standing
  // reach, walking into that wall is still a catch.
  {
    const bump = (height, ledgeAssist, mounted) => {
      const fixture = new Level(scene, { id: '__side_pipe_wall', name: 'side pipe wall', data: { v: 1, name: 'side pipe wall',
        spawn: [-12, 0.12, 0], killY: -20, ...(ledgeAssist ? { ledgeAssist } : {}), components: [
          { t: 'platform', p: [-5, -0.5, 0], s: [50, 1, 6] },
          { t: 'platform', p: [15, height / 2, 0], s: [20, height, 6] },
          { t: 'zone', p: [0, 0, 0], s: [80, 1, 18], dir: 'E', sideOn: true },
          { t: 'camnode', p: [-40, 0, 0] }, { t: 'camnode', p: [40, 0, 0] },
          { t: 'gate', p: [20, height, 0], yaw: 90 },
          ...[-0.83, 0.83].map(z => ({ t: 'wall', p: [0, -14, z], s: [80, 60, 0.6], invisible: true })),
        ] } });
      scene.updateMatrixWorld(true);
      p.respawn(fixture, true);
      const input = makeInput();
      let hung = false, bailed = false, rolled = 0;
      for (let k = 0; k < 60 * 5; k++) {
        input.moveX = 1;
        const push = mounted && k < 40;
        input.jumpPressed = push && k === 0; input.jumpReleased = mounted && k === 40; input.jumpHeld = push;
        p.step(CONST.fixedStep, input, fixture); fixture.update(CONST.fixedStep); input.consumeEdges();
        hung ||= p.state === 'hang'; bailed ||= p.isBailing;
        if (p.freeSkate && p.grounded && p.pos.x > 1 && p.pos.x < 4) rolled = Math.max(rolled, Math.abs(p.speed));
      }
      const end = { hung, bailed, rolled, x: p.pos.x, y: p.pos.y };
      fixture.dispose();
      return end;
    };
    const low = bump(2.1, 0, false);
    assert.ok(!low.hung && low.y < 0.3 && low.x < 5, `a 2.1 m wall walked into is a bump: no hang, no climb (ended at x ${low.x.toFixed(2)}, y ${low.y.toFixed(2)})`);
    const rolledIn = bump(2.1, 0, true);
    assert.ok(rolledIn.rolled > 8 && !rolledIn.hung && !rolledIn.bailed, `...and rolled into on the board it is a bump too (${rolledIn.rolled.toFixed(1)} m/s)`);
    const tall = bump(3.0, 1, false);
    assert.ok(tall.hung, 'a 3 m wall, above his reach, is still caught from the ground where a level\'s ledgeAssist lets the hands get there');
    p.respawn(level, true);
  }

  // ---- 6 · a board thrown away in a hang lands and lies still --------------------
  // Jump twice in a hang with the stick neutral: the second release throws the
  // board. It is two metres long on a plane one metre wide. It must fall, meet
  // the pipe and come to rest: never hang in the air, never gather speed there.
  {
    level.reset(true); p.respawn(level, true);
    p.pos.set(P0.westLip - 3, P0.westLipY + 0.15, 0); p.prevPos.copy(p.pos);
    const input = makeInput();
    let taps = 0, phase = 0, board = null, longestHover = 0, topSpeed = 0, restAt = null, thrownAt = null;
    const trail = [];
    for (let k = 0; k < 60 * 12 && restAt === null; k++) {
      const hanging = p.vertAir;
      input.moveX = hanging || board ? 0 : 1;
      let held = false;
      if (hanging && taps < 2) { phase++; held = phase % 10 < 5; if (phase % 10 === 5) taps++; } else phase = 0;
      input.jumpPressed = held && !input.jumpHeld; input.jumpReleased = !held && input.jumpHeld; input.jumpHeld = held;
      step(input);
      board ??= p.looseBoard ?? null;
      if (!board) continue;
      thrownAt ??= k;
      const at = board.root.position;
      topSpeed = Math.max(topSpeed, board.velocity.length());
      // in the air, yet within 5 cm of where it was half a second ago: held up by something
      trail.push(board.supported || board.rest ? null : at.clone());
      const then = trail.at(-31);
      if (trail.length > 30 && trail.slice(-31).every(Boolean) && at.distanceTo(then) < 0.05) longestHover++;
      if (board.rest) restAt = { x: at.x, y: at.y, seconds: (k - thrownAt) * CONST.fixedStep };
    }
    assert.ok(board, 'reference: two Jump releases in a hang throw the board away');
    assert.equal(longestHover, 0, `the thrown board never hangs in the air (held in place for ${longestHover} steps beyond half a second)`);
    assert.ok(topSpeed < 40, `...nor gathers speed while it is held there (peaked at ${topSpeed.toFixed(1)} m/s)`);
    assert.ok(restAt && restAt.seconds < 8, 'it comes to rest');
    const p0 = level.halfpipes.find(hp => Math.abs(hp.cross - P0.cross) < 0.01);
    const surface = p0.surfaceY(p0.crossToU(restAt.x));
    assert.ok(restAt.x > P0.westLip && restAt.x < P0.eastLip && Math.abs(restAt.y - surface) < 0.5,
      `...inside the pipe it was thrown in, ON its surface, not under it (x ${restAt.x.toFixed(1)}, y ${restAt.y.toFixed(2)}, the pipe there is at ${surface.toFixed(2)})`);
  }

  // ---- 7 · the drop-in is drawn as one curve --------------------------------------
  // The simulation seats the rider on the wall in a single step. What is drawn
  // (the body plus its drop-in lead) must not: it leaves the deck the way the
  // walker was going, bends over the coping, and has joined the rider on the
  // transition a quarter of a second later, with no step longer than the
  // motion on either side of it and no corner in the path.
  {
    level.reset(true); p.respawn(level, true);
    p.pos.set(P0.westLip - 3, P0.westLipY + 0.15, 0); p.prevPos.copy(p.pos);
    const input = makeInput();
    const drawn = [];
    let seated = -1, settled = -1;
    for (let k = 0; k < 90; k++) {
      input.moveX = 1; step(input);
      if (seated < 0 && p.freeSkate && p.groundHit?.halfpipe) seated = k;
      drawn.push({ x: p.pos.x + p.dropInOffset.x, y: p.pos.y + p.dropInOffset.y, lead: p.dropInOffset.length(), sx: p.pos.x, sy: p.pos.y });
      if (seated >= 0 && settled < 0 && k > seated && p.dropInOffset.lengthSq() === 0) settled = k;
    }
    assert.ok(seated > 2, 'reference: the walker reaches the coping and is seated on the wall');
    const snap = Math.hypot(drawn[seated].sx - drawn[seated - 1].sx, drawn[seated].sy - drawn[seated - 1].sy);
    assert.ok(snap > 0.3, `reference: the simulated body is moved onto the wall in that one step (${snap.toFixed(2)} m)`);
    assert.ok(settled > seated && (settled - seated) * CONST.fixedStep <= 0.3, `the drawn body has joined the rider within 0.3 s (${((settled - seated) * CONST.fixedStep).toFixed(2)} s)`);
    let longest = 0, sharpest = 0;
    for (let k = seated - 2; k <= settled + 2; k++) {
      const a = drawn[k - 1], b = drawn[k], c = drawn[k + 1];
      const d1 = Math.hypot(b.x - a.x, b.y - a.y), d2 = Math.hypot(c.x - b.x, c.y - b.y);
      longest = Math.max(longest, d1 / Math.max(0.05, Math.min(d1, d2)));
      sharpest = Math.max(sharpest, Math.acos(Math.max(-1, Math.min(1, ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) / (d1 * d2)))) * 180 / Math.PI);
    }
    const first = Math.hypot(drawn[seated].x - drawn[seated - 1].x, drawn[seated].y - drawn[seated - 1].y);
    assert.ok(first < 0.2, `the drawn body does not jump when the rider is seated (it moved ${first.toFixed(3)} m that step; the walk covers 0.15)`);
    assert.ok(Math.abs(drawn[seated].y - drawn[seated - 1].y) < 0.02, 'it is still at deck height on that step');
    assert.ok(longest < 2.2, `no drawn step is more than about twice its neighbour (ratio ${longest.toFixed(2)})`);
    assert.ok(sharpest < 30, `the drawn path has no corner: it turns at most ${sharpest.toFixed(1)}° in one step`);
  }

  // ---- 8 · on one line, the stick against travel is the brake --------------------
  // Out of P0 the rider is on foot. Push off onto the board (X + right), then
  // hold left: on a plane there is no U-turn to carve, so it has to stop the
  // board and step off. Walking back over the EAST coping drops in again,
  // heading west, and Jump + left in the west hang pops out onto the west deck.
  {
    play({ until: (log, q) => log.exits.get(P0.name)?.onFoot === true && q.grounded && q.pos.x > P0.eastLip + 1.5, seconds: 20 });
    assert.ok(p.grounded && !p.freeSkate, 'reference: on foot on the deck past P0');
    const input = makeInput();
    for (let k = 0; k < 70 && !p.freeSkate; k++) { input.moveX = 1; input.jumpPressed = k === 0; input.jumpHeld = true; step(input); }
    // letting go of X pops a small ollie; wait for the wheels to come back down
    input.jumpHeld = false; input.jumpReleased = true;
    for (let k = 0; k < 90 && (k < 2 || !p.grounded); k++) { input.moveX = 1; step(input); }
    assert.ok(p.freeSkate && p.grounded && p.speed > 5, 'reference: X + right pushes off onto the board');
    const turnedAt = p.pos.x;
    let eastmost = turnedAt, onFootAt = null, westDropIn = false, home = false, hangW = 0, heldWas = false;
    for (let k = 0; k < 1100 && !home; k++) {
      const wasFree = p.freeSkate;
      input.moveX = -1;
      hangW = p.vertAir && p.pos.x < P0.cross ? hangW + 1 : 0;
      const held = hangW >= 3 && hangW < 7;
      input.jumpHeld = held; input.jumpPressed = held && !heldWas; input.jumpReleased = !held && heldWas; heldWas = held;
      step(input);
      eastmost = Math.max(eastmost, p.pos.x);
      if (onFootAt === null && !p.freeSkate && p.grounded) onFootAt = p.pos.x;
      if (!wasFree && p.freeSkate && p.groundHit?.halfpipe && p.axisF.x < 0) westDropIn = true;
      home = p.grounded && !p.freeSkate && p.pos.x < P0.westLip - 1;
    }
    assert.ok(eastmost - turnedAt < 6, `held left stops the board within a few metres (rolled ${(eastmost - turnedAt).toFixed(2)} m on)`);
    assert.ok(onFootAt !== null, 'the brake steps the rider off the board');
    assert.ok(westDropIn, 'walking back over the east coping drops in again, heading west');
    assert.ok(home, 'and Jump + left in the west hang pops out onto the west deck: the pipe works in both directions');
  }

  // ---- 9 · the pipe is ridden on its cross axis, whatever the stick says -------
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

  // ---- 10 · a hang stays on its line when it heads a solid -----------------------
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

  // ---- 11 · a death goes back to the checkpoint before its pipe ------------------
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

  // ---- 12 · the grind button held too early is a lip stall, not a trap -----------
  // A player who wants the rail holds the grind button all the way up P4's east
  // wall. That is the game's lip stall: parked on the coping, 3 m under the
  // rail. Right is still held, and on that bare wall right points out the back,
  // over the hole. The stall must settle back INTO the pipe; with the button
  // let go, the next swing east still catches the rail.
  const early = play({ grind: 'early', from: [P4.westLip - 3, P4.westLipY + 0.15], seconds: 40 });
  const stall = early.stalls[0];
  assert.ok(stall && stall.pipe === P4.name && stall.side === 'east',
    'P4: the grind button held up the wall parks a lip stall on the east coping');
  assert.equal(early.bails + early.deaths, 0,
    `P4: with right still held that stall never throws the rider off behind the wall (${early.trouble.join('; ')})`);
  assert.ok(stall.backInPipe, 'P4: the stall settles back into the pipe');
  assert.ok(early.grindAt && early.grindAt.t > stall.t && early.finished,
    `P4: and the next swing still catches the rail and finishes (${early.trouble.join('; ')})`);

  level.dispose();
  console.log(`PASS Side Pipe Lab: finished in ${run.t.toFixed(1)} s on held right with Jump in each east hang; P1 first swing climbed ` +
    `${(firstReach - P1.floorY).toFixed(2)} m of the ${P1.eastRise} m east wall; pumped transfer at ${pumped.transferAt.toFixed(1)} s; ` +
    `${run.mounts.length} drop-ins, ${run.exits.size} pop-outs on foot, ${run.checkpoints} checkpoints banked, no ledge grabs.`);
});
