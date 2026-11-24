// Side Pipe Lab: the REAL Player and Level play the course a side-scrolling
// player would — right held from the first step to the gate, a jump at each
// gap, step and falling stair, a spin at each enemy, box and checkpoint, Jump
// in each east hang to pop out or transfer, a wait for each lift, ferry,
// timed pad, crusher and Whirler, the grind button at the two rails — and
// every claim the level makes is measured rather than assumed.
//
//   node tools/test-side-pipe-lab.mjs        (npm run check:side-pipe)
//
// What is asserted:
//   · the level data survives the same normaliser an imported level does, and
//     the normaliser refuses the side-on and long-lens fields anywhere they do
//     not belong;
//   · THE LONG LENS: the level's one camera view holds its 52 m distance (the
//     close rig stops at 18 m) through an 18° lens, so the frame is the size
//     it was and the picture is flat;
//   · walking off a deck across a coping mounts the board on the wall (every
//     pipe that is walked into), the ride never leaves the single play plane,
//     and the drop-in is DRAWN as one continuous curve;
//   · popping out takes the spine transfer's input — Jump in the hang with the
//     stick held out over the lip — and lands on foot; the stick alone never
//     leaves a pipe;
//   · P1 PUMP: a held direction alone falls short of the 7 m east lip on the
//     first swing, hangs off the WEST lip on the way back, clears the lip on a
//     later swing and transfers over the ridge; holding X clears it at once;
//   · P2 PLUNGE: the 8.5 m drop-in is seated like any other, and its air,
//     ridden instead of popped, hangs higher than the brink it dropped from
//     and heads the box that an early pop-out leaves alone;
//   · the falling stairs are crossed one jump each, the trampoline clears its
//     wall without touching the perch (and reaches the perch with Jump held),
//     a stomp on the Mossback heads the row over it;
//   · both lifts and the ferry are ridden, the three timed pads are stepped
//     on while lit, both crushers are passed while raised — and a run that
//     does not wait for them dies there;
//   · every enemy kind on the course is beaten the way its floor teaches:
//     crab, Bristleback, Watcher (a jump-spin), Spring Frog and Whirler
//     (between its blades) by a spin, the Mossback jumped;
//   · P3 VALLEY: the drop brings smashing speed to the stack on the riding
//     line and the crab beyond it is spun from the board; unspun, it costs;
//   · P4 SWITCH: with the `!` unhit there is no way out over the east wall;
//     the west hang heads the `!`, and only then does the pop-out land;
//   · P5–P7 CASCADE: two spine transfers in a row, each ridge crossed in the
//     air, and the last pipe popped out of on foot;
//   · P8 RAIL: the hang catches the rail and, on the travel stick alone, the
//     grind rides it into the next pipe; the grind button held too early
//     parks a lip stall instead, which settles back into the pipe;
//   · P10 LONG RAIL: on the travel stick alone the needle runs away and the
//     grind is lost; let go and balanced, it is ridden to the finish floor;
//   · on a rail the stick held at the catch is not a lean (held or let go, the
//     needle ends in the same place), and in the air off a rail's end the
//     stick toward travel never spins the board;
//   · a step lower than the skater's reach is BUMPED, on foot or on the
//     board — never grabbed — and jumped;
//   · a board thrown away in a hang falls, lands in the pipe and comes to rest;
//   · on the one-line zone the stick against travel brakes the board, and the
//     pipe is ridden back westward the same way;
//   · a jump into a pipe on a diagonal stick still rides its cross axis;
//   · a hang that heads a solid over a bare lip stays on its line;
//   · a death returns to the last banked checkpoint, in front of its pipe.
// Each runtime rule among those, removed, fails this file by name.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
import { makeCourseBot } from './side-pipe-lab-bot.mjs';

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { P0, P1, L1, SPINE_LANDING, DEEP, BIG_AIR, CRUMBLE_STAIRS, BASIN, TRAMPOLINE, LEDGE_A, PERCH, LIFT1, LEDGE_B, PHASE_DEBUT, PHASE_PAIR,
    LIFT2, LEDGE_C, FERRY, GALLERY, VALLEY_BRINK, VALLEY, VALLEY_STACK, SWITCH_PIPE, SWITCH_SLAB, C1, C2, C3, RAIL_PIPE, RAIL, RAIL_CATCH,
    LONG_PIPE, LONG_RAIL, FINISH } = lab;
  stock.dispose();

  // ---- the data contract ----------------------------------------------------
  const entry = findLevel('side-pipe-lab');
  assert.ok(entry?.data, 'Side Pipe Lab is a registered, data-built level');
  const normalised = normalizeCustomLevelData(JSON.parse(JSON.stringify(entry.data)));
  assert.ok(normalised, 'the level data passes the import normaliser (side-on pipe and long-lens fields included)');
  const parts = entry.data.components;
  const count = t => parts.filter(c => c.t === t).length;
  assert.equal(count('gate'), 1, 'one finish gate');
  const pipes = parts.filter(c => c.t === 'vertramp');
  assert.equal(pipes.length, 12, 'twelve pipes');
  assert.ok(pipes.every(c => c.sideOn === true && c.yaw === 0 && c.vkind === 'half'), 'every pipe is a side-on half');
  const zones = parts.filter(c => c.t === 'zone');
  assert.ok(zones.length === 1 && zones[0].dir === 'E' && zones[0].sideOn === true,
    'the whole course is one east travel zone, played on one line');
  const blocks = parts.filter(c => c.t === 'platform');
  assert.ok(entry.data.killY < Math.min(...blocks.map(c => c.p[1] - c.s[1] / 2)), 'killY sits below every floor');
  assert.deepEqual([count('crumble'), count('trampoline'), count('mover'), count('phasepad'), count('crusher'), count('rail'), count('checkpoint')],
    [4, 1, 3, 3, 2, 2, 12], 'the hazard vocabulary: 4 falling slabs, a trampoline, 2 lifts and a ferry, 3 timed pads, 2 crushers, 2 rails, 12 checkpoints');
  const foes = parts.filter(c => c.t === 'enemy').map(c => c.foe).sort();
  assert.deepEqual(foes, ['floater', 'floater', 'grunt', 'grunt', 'grunt', 'hopper', 'spiker', 'spiker', 'spinner', 'turtle'],
    'six enemy kinds, ten enemies');
  assert.ok(VALLEY_BRINK.top - BASIN.top >= 16 && SPINE_LANDING.top - BASIN.top >= 11 && LONG_RAIL.y0 - LONG_RAIL.y1 >= 16,
    'the height graph: 11 m down to the basin, 16 m back up to the valley brink, 16 m down the last rail');
  const withPart = extra => { const data = JSON.parse(JSON.stringify(entry.data)); data.components.push(extra); return normalizeCustomLevelData(data); };
  for (const bad of [
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', pts: [[0, 0], [0, 10]] }, // swept path
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', yaw: 30 }, // not axis-aligned
    { t: 'vertramp', p: [0, 0, 0], vkind: 'half', wallRise: [3, 5] }, // per-wall shape without sideOn
    { t: 'vertramp', p: [0, 0, 0], sideOn: true, vkind: 'half', wallRise: [0, 0] }, // no wall at all
    { t: 'platform', p: [0, 0, 0], sideOn: true }, // not a pipe
    { t: 'zone', p: [0, 0, 500], s: [10, 1, 10], dir: 'N', sideOn: true }, // a line zone runs east/west
  ]) assert.equal(withPart(bad), null, `the normaliser rejects ${JSON.stringify(bad)}`);
  // the long lens is a kept distance or it is nothing
  const lens = { t: 'camnode', p: [0, 900, 0], s: [10, 10, 10], cameraView: true, cameraPresentationOnly: true,
    cameraPosition: [0, 905, 40], cameraTarget: [0, 900, 0], cameraFollowDistance: 40, cameraFov: 20, cameraTelephoto: true };
  assert.equal(withPart(lens), null, 'the normaliser rejects a long lens that does not keep its distance');
  assert.ok(withPart({ ...lens, cameraKeepDistance: true }), '...and accepts the same view with cameraKeepDistance');

  const level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  assert.equal(level.halfpipes.length, 12);
  assert.ok(level.halfpipes.every(hp => hp.sideOn), 'all twelve ride the analytic side-on backing');
  const second = level.halfpipes.find(hp => Math.abs(hp.cross - L1.cross) < 0.01);
  const pump = level.halfpipes.find(hp => Math.abs(hp.cross - P1.cross) < 0.01);
  assert.equal(pump.lipYOf(-1), P1.westLipY);
  assert.equal(pump.lipYOf(1), P1.eastLipY);
  assert.ok(Math.abs(pump.lipYOf(1) - second.lipYOf(-1)) < 1e-9 &&
    Math.abs((pump.cross + pump.lipXOf(1)) - (second.cross - second.lipXOf(-1))) < 1e-9,
    'the pump pipe and the pipe behind it share one ridge');
  assert.ok(second.lipYOf(1) < second.lipYOf(-1) && second.deckOf(1) > 0, 'the second pipe has a lower, decked east wall: the next landing');

  // ---- the long lens ----------------------------------------------------------
  // One camera view frames the whole course. Through the rig's own widest side
  // view it stood 18 m away at 49°; the long lens stands 52 m away at 18°, which
  // is the same height of frame on the play plane with a third of the depth cue.
  {
    assert.equal(level.cameraPresentationViews.length, 1, 'one camera view frames the whole course');
    const view = level.cameraPresentationViews[0];
    assert.ok(view.cameraTelephoto && view.cameraKeepDistance && view.cameraFollowDistance === 52 && view.cameraFov === 18,
      'it is the long lens: 52 m, kept, through 18°');
    const shoot = v => {
      const framing = new CameraViewFraming();
      const camera = new THREE.PerspectiveCamera(49, 16 / 9, 0.1, 2000);
      camera.position.set(100, 9, 18); camera.lookAt(100, 4, 0); camera.updateMatrixWorld(true);
      framing.apply(camera, { view: v, weight: 1 }, new THREE.Vector3(100, 4, 0), true);
      return { out: camera.position.z, fov: camera.fov };
    };
    const long = shoot(view), close = shoot({ ...view, cameraTelephoto: false });
    assert.ok(long.out > 50 && long.fov === 18, `the long lens stands ${long.out.toFixed(1)} m out from the play plane`);
    assert.ok(close.out <= 18.01, `without the flag the same view is held to the close rig's 18 m (${close.out.toFixed(1)} m)`);
    const frame = d => 2 * d * Math.tan(THREE.MathUtils.degToRad(long.fov) / 2);
    assert.ok(Math.abs(frame(52) - 2 * 18 * Math.tan(THREE.MathUtils.degToRad(49) / 2)) < 0.2,
      `the frame is the height it was at 18 m through 49° (${frame(52).toFixed(1)} m)`);
    assert.ok((52 + 3) / (52 - 3) < 1.13, 'the 6 m of depth behind the line changes scale by under 13 % (it was 40 %)');
  }

  p.competitionMode = false;
  p.endlessDeaths = true;
  const measured = {};
  const bot = makeCourseBot({ p, level, CONST, lab, makeInput, parts });
  const { play, steps } = bot;
  // The drawn drop-in is advanced where the game advances it: after each step.
  const step = input => { p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); p.stepDropInPresentation(); input.consumeEdges(); };
  assert.ok(steps.length >= 6 && steps.every(s => s.rise <= 1.61), `the on-foot steps are all within a tap jump (${steps.map(s => s.rise.toFixed(2))})`);
  const cratesAt = (x, y) => level.crates.filter(c => Math.abs(c.mesh.position.x - x) < 0.7 && (y === undefined || Math.abs(c.mesh.position.y - y) < 1.5));
  const f1 = v => v.toFixed(1);

  // ---- 1 · the whole course, the way it is meant to be held ------------------
  const run = play();
  assert.ok(run.finished, `the course finishes on held right (stopped at x ${p.pos.x.toFixed(1)}, t ${run.t.toFixed(1)}; ${run.trouble.join('; ')})`);
  assert.equal(run.deaths + run.bails, 0, `no death or bail on the intended line (${run.trouble.join('; ')})`);
  assert.equal(run.grabs, 0, `nothing on the course is climbed by the hands: every step is jumped (${run.trouble.join('; ')})`);
  assert.ok(run.maxZ < 0.4, `the ride never leaves the play plane (max |z| ${run.maxZ.toFixed(2)})`);
  assert.ok(Math.abs(run.minY - BASIN.top) < 0.05 && run.maxY > VALLEY_BRINK.top + 5,
    `the run goes from the basin floor to well over the valley brink (y ${f1(run.minY)} to ${f1(run.maxY)})`);
  for (const q of [P0, P1, DEEP, VALLEY, SWITCH_PIPE, C1, RAIL_PIPE, LONG_PIPE]) {
    const mount = run.mounts.find(m => m.pipe === q.name);
    assert.ok(mount, `${q.name}: crossing the west coping on foot mounts the board`);
    assert.ok(Math.abs(mount.x - q.westLip) < 0.2 && mount.y < q.westLipY && mount.y > q.westLipY - 0.6,
      `${q.name}: the drop-in seats the rider on the wall just under the lip (x ${mount.x.toFixed(2)}, y ${mount.y.toFixed(2)})`);
    assert.ok(mount.speed >= 4, `${q.name}: the drop-in keeps rolling speed`);
  }
  // Popping out: Jump in the east hang, right held. It lands on the deck, on foot.
  for (const q of [P0, L1, DEEP, VALLEY, SWITCH_PIPE, C3, RAIL_CATCH]) {
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
  assert.ok(run.transfers.has(P1.name), 'P1: Jump in the east hang transfers over the ridge into the second pipe');
  assert.ok(run.exits.get(L1.name).t > run.transfers.get(P1.name).t && run.exits.get(L1.name).x < SPINE_LANDING.x1,
    'P1: the second pipe is popped out of onto its far deck, the next landing');
  // P2: the plunge.
  assert.ok(run.topSpeed.get(DEEP.name) > 25, `P2: the 8.5 m drop reaches the flat at ${f1(run.topSpeed.get(DEEP.name))} m/s`);
  assert.ok(cratesAt(BIG_AIR.x, BIG_AIR.y).every(c => c.alive), 'P2: an air popped out at once leaves the big-air box where it hangs');
  // The way down on foot, and the basin.
  assert.equal(run.stairs.size, CRUMBLE_STAIRS.length, `the falling stairs are crossed slab by slab (${[...run.stairs]})`);
  const killed = kind => run.kills.filter(k => k.kind === kind);
  assert.ok(killed('grunt').some(k => !k.onBoard && k.x < BASIN.x1), 'basin: the crab is spun on foot');
  assert.ok(killed('spiker').some(k => k.x < BASIN.x1), 'basin: the Bristleback is spun');
  assert.ok(level.enemies.some(e => e.kind === 'turtle' && e.alive) && run.stomps.length === 0, 'basin: the Mossback is jumped clean over');
  // The climb.
  assert.ok(run.bounces.length === 1 && Math.abs(run.bounces[0].vV - TRAMPOLINE.speed) < 0.6,
    `trampoline: one bounce at its plain launch speed (${run.bounces.map(b => f1(b.vV))})`);
  assert.ok(killed('floater').length === 2, 'climb: both Watchers fall to a jump-spin');
  const rides = [LIFT1, LIFT2, FERRY].map(m => run.rides.find(r => r.x > m.x0 - 0.5 && r.x < m.x1 + 0.5));
  assert.ok(rides.every(Boolean), `climb: both lifts and the ferry are ridden (${run.rides.map(r => f1(r.x))})`);
  assert.ok(rides[1].y < LIFT2.low + 0.15 && rides[1].y > LIFT2.low - LIFT2.dip - 0.05,
    `climb: the lift over the drop is boarded as its deck passes the bank (deck at ${rides[1].y.toFixed(2)}, bank ${LIFT2.low})`);
  assert.equal(run.pads.size, 3, `climb: all three timed pads are stepped on while lit (${[...run.pads]})`);
  assert.ok(killed('hopper').length === 1 && killed('spiker').some(k => k.x > FERRY.x1 - 4) && killed('grunt').some(k => !k.onBoard && k.x > GALLERY.x0),
    'climb: the frog, the Bristleback at the ferry landing and the crab behind the crushers are all spun');
  // P3: the valley.
  assert.ok(run.topSpeed.get(VALLEY.name) > 12.5 && cratesAt(VALLEY_STACK.x).every(c => !c.alive),
    `P3: the drop brings smashing speed to the stack on the line (${f1(run.topSpeed.get(VALLEY.name))} m/s)`);
  assert.equal(killed('grunt').filter(k => k.onBoard).length, 1, 'P3: the crab on the flat is spun from the board');
  // P4: the switch.
  assert.ok(run.switchAt?.vert && Math.abs(run.switchAt.x - SWITCH_PIPE.westLip) < 0.5 && run.switchAt.y > SWITCH_PIPE.westLipY + 4.5,
    'P4: the ! is headed out of the WEST hang, well above anything a jump off the deck reaches');
  const switchHangs = run.hangs.filter(h => h.pipe === SWITCH_PIPE.name);
  assert.ok(switchHangs[0]?.side === 'east' && switchHangs[0].t < run.switchAt.t,
    'P4: the rider hangs over the bare east lip BEFORE the switch');
  assert.ok(run.eastmostBeforeSwitch <= SWITCH_PIPE.eastLip + 0.05,
    `P4: with the ! unhit that hang's pop-out has nowhere to land and is not taken (eastmost x ${run.eastmostBeforeSwitch.toFixed(2)}, lip ${SWITCH_PIPE.eastLip})`);
  assert.ok(run.exits.get(SWITCH_PIPE.name).t > run.switchAt.t && run.exits.get(SWITCH_PIPE.name).x < SWITCH_SLAB.x1,
    'P4: only after the switch does the pop-out land, on the slab it made solid');
  assert.equal(killed('spinner').length, 1, 'the Whirler is spun between its blades');
  // P5–P7: the cascade.
  for (const [a, b] of [[C1, C2], [C2, C3]]) {
    const over = run.transfers.get(a.name);
    assert.ok(over && over.into === b.name && over.y > a.eastLipY, `${a.name}: the ridge is crossed in the air into ${b.name}`);
  }
  assert.ok(run.transfers.get(C2.name).t - run.transfers.get(C1.name).t < 3, 'cascade: the two transfers are one run, under three seconds apart');
  assert.ok(run.peak.get(C2.name) > C2.eastLipY + 5, `cascade: the second ridge is crossed ${f1(run.peak.get(C2.name) - C2.eastLipY)} m above it`);
  // P8 and P10: the rails.
  const [short, long] = run.grinds;
  assert.ok(short && Math.abs(short.x - RAIL_PIPE.eastLip) < 1.5, 'P8: the east hang catches the exit rail');
  assert.ok(!short.bailed && short.endX > RAIL.x1 - 0.5 && short.speed > 15 && short.seconds < 1.1,
    `P8: the rail gathers speed and is over before the needle can run away (${short.seconds?.toFixed(2)} s, ${f1(short.speed ?? 0)} m/s)`);
  assert.ok(long && Math.abs(long.x - LONG_PIPE.eastLip) < 1.5 && !long.bailed && long.endX > LONG_RAIL.x1 - 0.5,
    `P10: balanced, the long rail is ridden to its end (left it at x ${long?.endX?.toFixed(1)}, rail ends ${LONG_RAIL.x1})`);
  assert.ok(long.seconds > 2 && long.lean < 0.5 && long.speed > 25,
    `P10: ${long.seconds.toFixed(2)} s on the needle, never past ${long.lean.toFixed(2)}, leaving at ${f1(long.speed)} m/s`);
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
  const pumped = play({ pump: true, until: log => log.transfers.has(P1.name), seconds: 30 });
  assert.ok(pumped.transfers.has(P1.name), 'P1 pumped: the transfer happens');
  assert.equal(pumped.hangs.filter(h => h.pipe === P1.name && h.side === 'west').length, 0,
    'P1 pumped: holding X on the walls clears the east lip on the FIRST swing, with no trip back west');

  // ---- 4 · the crab charges for a missed spin ---------------------------------
  const careless = play({ spin: false, from: [VALLEY.westLip - 3, VALLEY.westLipY + 0.15],
    until: log => log.deaths > 0 || log.masksSpent > 0 || log.bails > 0, seconds: 12 });
  assert.ok(careless.deaths + careless.masksSpent + careless.bails > 0,
    'P3: riding the valley without a spin runs into the crab');

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
  const toRail = play({ until: (log, q) => log.checkpoints === level.checkpoints.length && q.pos.x > LONG_PIPE.westLip - 2 });
  assert.equal(toRail.checkpoints, level.checkpoints.length, 'the last checkpoint is banked on the way to the long rail');
  // Drop the rider into the hole under the rail, as a lost grind would.
  p.respawn(level, false, false, { position: p.pos.clone().set(LONG_PIPE.eastLip + 12, FINISH.top + 4, 0), heading: p.pos.clone().set(1, 0, 0) });
  let back = null;
  const idle = makeInput();
  for (let i = 0, was = p.state; i < 900 && !back; i++) {
    step(idle);
    if (was === 'dead' && p.state !== 'dead') back = { x: p.pos.x, y: p.pos.y };
    was = p.state;
  }
  assert.ok(back && back.x > RAIL_CATCH.eastLip && back.x < LONG_PIPE.westLip,
    `a fall under the long rail returns to the checkpoint before its pipe (respawned at x ${back?.x.toFixed(1)})`);

  // ---- 12 · the grind button held too early is a lip stall, not a trap -----------
  // A player who wants the rail holds the grind button all the way up P8's east
  // wall. That is the game's lip stall: parked on the coping, 3 m under the
  // rail. Right is still held, and on that bare wall right points out the back,
  // over the hole. The stall must settle back INTO the pipe; with the button
  // let go, the next swing east still catches the rail.
  const early = play({ grind: 'early', from: [RAIL_PIPE.westLip - 3, RAIL_PIPE.westLipY + 0.15], seconds: 40,
    until: log => log.exits.get(RAIL_CATCH.name)?.onFoot === true });
  const stall = early.stalls[0];
  assert.ok(stall && stall.pipe === RAIL_PIPE.name && stall.side === 'east',
    'P8: the grind button held up the wall parks a lip stall on the east coping');
  assert.equal(early.bails + early.deaths, 0,
    `P8: with right still held that stall never throws the rider off behind the wall (${early.trouble.join('; ')})`);
  assert.ok(stall.backInPipe, 'P8: the stall settles back into the pipe');
  assert.ok(early.grinds[0] && early.grinds[0].t > stall.t && early.exits.get(RAIL_CATCH.name)?.onFoot,
    `P8: and the next swing still catches the rail and rides it into the next pipe (${early.trouble.join('; ')})`);

  // ---- 13 · the plunge's air, ridden instead of popped ---------------------------
  // Jump is never pressed. The first east hang of the deep pipe climbs past the
  // brink the rider dropped from and heads the box that hangs inside the lip.
  {
    const air = play({ pop: false, from: [DEEP.westLip - 3, DEEP.westLipY + 0.15], seconds: 9,
      until: () => cratesAt(BIG_AIR.x, BIG_AIR.y).every(c => !c.alive) });
    const apex = air.peak.get(DEEP.name);
    assert.ok(apex > DEEP.westLipY + 4 && apex > DEEP.eastLipY + 9,
      `P2: the unpopped air tops out at y ${f1(apex)} — ${f1(apex - DEEP.eastLipY)} m over the east lip, ${f1(apex - DEEP.westLipY)} m over the brink`);
    assert.ok(cratesAt(BIG_AIR.x, BIG_AIR.y).every(c => !c.alive) && air.hangs.filter(h => h.pipe === DEEP.name).length === 1,
      'P2: that first hang heads the big-air box');
    assert.equal(air.bails + air.deaths, 0, 'P2: and the box does not knock the rider off the hang line');
    measured.plungeApex = f1(apex - DEEP.eastLipY);
  }

  // ---- 14 · the trampoline's two bounces, and the Mossback's ---------------------
  {
    const high = play({ heldBounce: true, from: [BASIN.x0 + 1, BASIN.top + 0.12], seconds: 14,
      until: (log, q) => log.bounces.length > 0 && q.grounded });
    assert.ok(high.bounces.length === 1 && Math.abs(high.bounces[0].vV - TRAMPOLINE.speed * TRAMPOLINE.held) < 0.8,
      `trampoline: Jump held at the landing launches at ${f1(high.bounces[0]?.vV ?? 0)} m/s (${TRAMPOLINE.held} times the plain bounce)`);
    measured.heldBounce = f1(high.bounces[0].vV);
    assert.ok(Math.abs(p.pos.y - PERCH.top) < 0.05 && p.pos.x > PERCH.x0 && p.pos.x < PERCH.x1 && high.grabs === 0,
      `trampoline: that bounce lands on the perch, ${f1(PERCH.top - LEDGE_A.top)} m over the ledge (x ${f1(p.pos.x)}, y ${p.pos.y.toFixed(2)})`);
    const rowAt = BASIN.top + 5.7;
    const row = () => level.crates.filter(c => Math.abs(c.mesh.position.y - rowAt) < 0.8 && c.mesh.position.x > BASIN.x0 + 38 && c.mesh.position.x < BASIN.x0 + 44);
    const stomp = play({ stompTurtle: true, from: [BASIN.x0 + 1, BASIN.top + 0.12], seconds: 14,
      until: (log, q) => log.stomps.length > 0 && q.grounded });
    assert.equal(row().length, 3, 'reference: the row over the Mossback is three boxes');
    assert.ok(stomp.stomps[0]?.kind === 'turtle', `Mossback: the jump lands on its back (${stomp.trouble.join('; ')})`);
    assert.ok(row().some(c => !c.alive) && stomp.deaths + stomp.bails + stomp.masksSpent === 0,
      `Mossback: the bounce off its shell heads the row ${rowAt - BASIN.top} m over the floor (rose to y ${f1(stomp.maxY)})`);
  }

  // ---- 15 · the timed stretch is not walked through blind ------------------------
  // The same run from the top of the first lift, with every wait taken out.
  {
    const blind = play({ patient: false, from: [LEDGE_B.x0 + 1, LEDGE_B.top + 0.12], seconds: 40,
      until: (log, q) => log.deaths > 0 || q.pos.x > VALLEY_BRINK.x0 });
    assert.ok(blind.deaths > 0 && p.pos.x < VALLEY_BRINK.x0,
      `a run that waits for nothing dies between the timed pads and the crushers (${blind.trouble.join('; ')})`);
    assert.ok([...run.waits.values()].reduce((a, b) => a + b, 0) > 3,
      `...where the intended line stood and waited ${f1([...run.waits.values()].reduce((a, b) => a + b, 0))} s in all (${[...run.waits].map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')})`);
  }

  // ---- 16 · the rails on the travel stick alone ----------------------------------
  // Right is held from the catch to the end and nothing else is touched. The
  // short rail is over before the needle has gone anywhere; the long one is
  // not, and the grind is lost over the drop.
  {
    const start = [RAIL_PIPE.westLip - 3, RAIL_PIPE.westLipY + 0.15];
    const held = play({ balance: false, from: start, seconds: 40, until: log => log.deaths > 0 || log.bails > 0 || log.finished });
    const [first, last] = held.grinds;
    assert.ok(first && !first.bailed && first.endX > RAIL.x1 - 0.5 && first.lean < 0.7,
      `P8 on the travel stick: the short rail is ridden whole, the needle at ${first?.lean.toFixed(2)} of 1`);
    assert.ok(held.exits.get(RAIL_CATCH.name)?.onFoot, 'P9: and the pipe it drops into is popped out of on foot');
    measured.longRailLost = last?.seconds?.toFixed(2);
    assert.ok(last && last.bailed && last.endX < LONG_RAIL.x1 - 5 && last.seconds > 0.9,
      `P10 on the travel stick: the needle runs away and the grind is lost ${last?.seconds?.toFixed(2)} s in, at x ${f1(last?.endX ?? 0)} of ${LONG_RAIL.x1}`);
    // The stick held at the catch is the TRAVEL stick: it tips nothing. With the
    // stick let go for the whole rail instead, the needle ends exactly where it did.
    const loose = play({ balance: 'neutral', from: start, seconds: 20, until: log => log.exits.get(RAIL_CATCH.name)?.onFoot === true });
    const free = loose.grinds[0];
    assert.ok(free && Math.abs(first.needle) > 0.2 && Math.abs(free.needle - first.needle) < 0.02,
      `a rail caught with right held: the needle ends at ${first.needle.toFixed(3)} with the stick held and ${free?.needle.toFixed(3)} with it let go — the held stick is not a lean`);
    // ...and pressed again in the air off the rail's end, right is still travel:
    // it carries the rider on and does not spin the board into the landing.
    assert.ok(free.exitSpin < 0.05 && loose.bails === 0 && loose.exits.get(RAIL_CATCH.name)?.onFoot,
      `after a rail ridden with the stick let go, right pressed in the air off its end turns the board ${(free.exitSpin * 180 / Math.PI).toFixed(0)}° (${loose.trouble.join('; ')})`);
  }
  // The same on the intended line, where the rail is balanced with left and right.
  {
    const landing = play({ from: [RAIL_PIPE.westLip - 3, RAIL_PIPE.westLipY + 0.15], seconds: 20, until: log => log.exits.has(RAIL_CATCH.name) });
    assert.ok(landing.grinds[0] && !landing.grinds[0].bailed && landing.bails === 0 && landing.grinds[0].exitSpin < 0.05,
      `after a balanced grind, right held in the air off the rail lands the board straight in the next pipe (${landing.trouble.join('; ')})`);
    assert.ok(landing.topSpeed.get(RAIL_CATCH.name) > 12, `...still rolling at ${f1(landing.topSpeed.get(RAIL_CATCH.name) ?? 0)} m/s on its flat`);
  }

  level.dispose();
  const waited = [...run.waits.values()].reduce((a, b) => a + b, 0);
  // The numbers docs/SIDE_ON_PIPES.md quotes, printed by every run.
  const carry = q => f1(run.exits.get(q.name).x - q.eastLip);
  console.log(`MEASURED flat speeds ${[DEEP, VALLEY, C1, C2, C3, RAIL_CATCH].map(q => `${q.name.slice(0, 3).trim()} ${f1(run.topSpeed.get(q.name))}`).join(', ')} m/s; ` +
    `pop-outs carry ${[P0, L1, DEEP, VALLEY, C3, RAIL_CATCH].map(q => `${q.name.slice(0, 3).trim()} ${carry(q)}`).join(', ')} m past the lip; ` +
    `plunge air ${measured.plungeApex} m over the east lip unpopped; second ridge crossed ${f1(run.peak.get(C2.name) - C2.eastLipY)} m up, ` +
    `${f1(run.transfers.get(C2.name).t - run.transfers.get(C1.name).t)} s after the first; short rail ${short.seconds.toFixed(2)} s to ${f1(short.speed)} m/s; ` +
    `long rail ${long.seconds.toFixed(2)} s to ${f1(long.speed)} m/s, lost after ${measured.longRailLost} s on the travel stick; ` +
    `held bounce ${measured.heldBounce} m/s.`);
  console.log(`PASS Side Pipe Lab: ${(FINISH.x0 + 38 + 15).toFixed(0)} m finished in ${run.t.toFixed(1)} s (${waited.toFixed(1)} s of it waiting) on held right; ` +
    `y ${f1(run.minY)} to ${f1(run.maxY)}; P1 first swing climbed ${(firstReach - P1.floorY).toFixed(2)} m of the ${P1.eastRise} m east wall; ` +
    `${run.mounts.length} drop-ins, ${run.exits.size} pop-outs on foot, ${run.transfers.size} spine transfers, ${run.kills.length} enemies beaten, ` +
    `${run.checkpoints} checkpoints banked, no ledge grabs.`);
});
