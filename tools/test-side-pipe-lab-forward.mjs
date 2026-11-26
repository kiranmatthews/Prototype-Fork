// SIDE PIPE LAB (FORWARD): the same course, met head-on.
//
// The forward copy is the side-scrolling lab's own component list without its
// camera group: no travel zone, no single-plane walls, no long lens. A lane
// owns the frame instead, so the camera follows from behind and FORWARD on the
// stick is down the course. This test holds it to that:
//
//   - the data: the same parts (one stopwatch moved aside), every vert marked
//     as crossed (`sideOn`), a lane, a view that turns the yard round, and
//     walls at the edges of the full width;
//   - the build: all sixteen verts ride the analytic side-on profile with no
//     side-on zone round them, and the frame points east on the course and
//     west in the yard;
//   - the course: the route bot of the side-scrolling lab plays it to the gate
//     through an adapter that holds its decisions the way a forward player
//     holds the pad (forward for east, the camera's own heading each step, as
//     the game reads it). On his board at each lip he walks up to, in with
//     Jump, out of each hang with Jump and the stick held forward, over each
//     ridge, down both rails;
//   - the yard: run back from the start, the view comes round, and the four
//     walls answer a runner as they do in the side view;
//   - the width: a walker can leave the centre line and is stopped at the edge.
//
// Run with: node tools/test-side-pipe-lab-forward.mjs (part of npm run check:side-pipe)
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
import { makeCourseBot } from './side-pipe-lab-bot.mjs';

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { P0, P1, L1, DEEP, VALLEY, SWITCH_PIPE, C1, C2, C3, RAIL_PIPE, RAIL_CATCH, LONG_PIPE, FINISH, BASIN, VALLEY_BRINK,
    YARD_VAULT, YARD_CLIMB, YARD_GRAB, YARD_MISS, FORWARD_YARD_VIEW } = lab;
  stock.dispose();
  const dt = CONST.fixedStep, f1 = v => v.toFixed(1);

  // ---- the data contract ----------------------------------------------------
  const sideEntry = findLevel('side-pipe-lab'), entry = findLevel('side-pipe-lab-forward');
  assert.ok(entry?.data && sideEntry?.data, 'both labs are registered, data-built levels');
  assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(entry.data))), 'the forward level passes the import normaliser');
  const parts = entry.data.components, sideParts = sideEntry.data.components;
  const CAMERA = 5; // the lab's camera group
  const strip = list => list.filter(c => c.grp !== CAMERA).map(c => c.t === 'clock' ? { ...c, p: [c.p[0], c.p[1], 0] } : c);
  assert.deepEqual(strip(parts), strip(sideParts), 'outside the camera group the two levels are the same parts, in the same order');
  assert.equal(parts.filter(c => c.t === 'clock').length, 1);
  assert.ok(Math.abs(parts.find(c => c.t === 'clock').p[2]) > 1.5, 'the stopwatch stands beside the lane back to the yard, not in it');
  assert.deepEqual(entry.data.spawn, sideEntry.data.spawn, 'the same spawn');
  assert.equal(parts.filter(c => c.t === 'gate').length, 1, 'one finish gate');
  assert.equal(parts.filter(c => c.t === 'zone').length, 0, 'no travel zone: the lane owns the frame');
  assert.ok(sideParts.some(c => c.t === 'zone' && c.sideOn === true), '(the side-scrolling lab keeps its side-on zone)');
  const verts = parts.filter(c => c.t === 'vertramp');
  assert.ok(verts.length === 16 && verts.every(c => c.sideOn === true), 'all sixteen verts say the course crosses them');
  const lane = parts.filter(c => c.t === 'camnode' && !c.cameraView);
  assert.ok(lane.length === 2 && lane[0].p[0] < entry.data.spawn[0] && lane[1].p[0] > FINISH.x1 && lane[0].p[2] === 0 && lane[1].p[2] === 0,
    'a two-node lane from west of the yard to east of the finish');
  const views = parts.filter(c => c.t === 'camnode' && c.cameraView);
  assert.ok(views.length === 1 && views[0].yaw === 90 && !views[0].cameraPresentationOnly && !views[0].cameraPosition,
    'one heading-only view, facing west, over the yard');
  const edges = parts.filter(c => c.t === 'wall' && c.invisible && c.s[0] > 100);
  assert.ok(edges.length === 2 && edges.every(c => Math.abs(Math.abs(c.p[2]) - c.s[2] / 2 - 3) < 1e-9 && c.p[1] + c.s[1] / 2 > YARD_MISS.lipY + 10),
    'two edge walls whose inner faces stand at the edges of the 6 m floors, taller than the yard');
  assert.ok(entry.data.cameraRig && entry.data.cameraAirLift === 1, 'its own follow rig, which rises with a hang');
  assert.ok(entry.data.killY < Math.min(...parts.filter(c => c.t === 'platform').map(c => c.p[1] - c.s[1] / 2)), 'killY sits below every floor');
  // `sideOn` on a vert outside a side-on zone: one wall or a straight face is crossed east-west only.
  const withPart = extra => { const data = JSON.parse(JSON.stringify(entry.data)); data.components.push(extra); return normalizeCustomLevelData(data); };
  for (const good of [
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'quarter', yaw: 180, rise: 2.5, lipRise: 2, deck: 3 },
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'quarter', yaw: 0, rise: 2.5 },
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'half', yaw: 0, rise: 3, lipRise: 1 },
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'half', yaw: 90, rise: 3 },
  ]) assert.ok(withPart(good), `the normaliser accepts ${JSON.stringify(good)}`);
  for (const bad of [
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'quarter', yaw: 90, rise: 2.5 }, // one wall, along the course
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'half', yaw: 90, rise: 3, lipRise: 1 }, // a straight face, along the course
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'quarter', yaw: 180, rise: 2.5, arc: 60 }, // not a vertical lip
    { t: 'vertramp', p: [0, 900, 0], sideOn: true, vkind: 'quarter', yaw: 180, rise: 2.5, outerBank: 3 }, // a bank behind it
  ]) assert.equal(withPart(bad), null, `the normaliser rejects ${JSON.stringify(bad)}`);

  // ---- the build ------------------------------------------------------------
  const level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  assert.equal(level.halfpipes.length, 16);
  assert.ok(level.halfpipes.every(hp => hp.sideOn), 'all sixteen ride the analytic side-on backing, with no side-on zone round them');
  for (const wall of [YARD_VAULT, YARD_CLIMB, YARD_GRAB, YARD_MISS]) {
    const hp = level.halfpipes.find(candidate => Math.abs(candidate.cross - wall.baseX) < 0.01);
    assert.ok(hp && hp.isOpen(1) && !hp.isOpen(-1) && Math.abs(hp.lipYOf(-1) - wall.lipY) < 1e-9 && hp.deckOf(-1) === wall.deck,
      `${wall.name}: the same one wall, straight face and deck as in the side-scrolling lab`);
  }
  assert.equal(level.zoneAt(entry.data.spawn[0], entry.data.spawn[2]), null);
  assert.ok(level.laneActive, 'the lane is live');
  const dirAt = x => level.cameraDirAt(x, 4, 0);
  for (const x of [entry.data.spawn[0], P0.cross, BASIN.x0 + 10, VALLEY.cross, FINISH.x0 + 5]) {
    const d = dirAt(x);
    assert.ok(d && d.x > 0.999 && Math.abs(d.z) < 0.01, `the frame points east down the course at x ${f1(x)}`);
  }
  for (const x of [FORWARD_YARD_VIEW.x1 - FORWARD_YARD_VIEW.turn - 0.1, YARD_VAULT.baseX, YARD_GRAB.lipX, YARD_MISS.lipX - 2]) {
    const d = dirAt(x);
    assert.ok(d && d.x < -0.999 && Math.abs(d.z) < 0.02, `...and west in the wall yard at x ${f1(x)}`);
  }
  {
    const mid = dirAt(FORWARD_YARD_VIEW.x1 - FORWARD_YARD_VIEW.turn / 2);
    assert.ok(Math.abs(mid.x) < 0.05 && mid.z < -0.99, 'the turn between them passes through the side view (looking north)');
  }

  // ---- the frame, as the game supplies it -------------------------------------
  // main.ts eases the authored camera's heading toward the lane's and hands it to the player before each step.
  const cam = { x: 1, z: 0 };
  const resetCamera = () => { const d = level.cameraDirAt(p.pos.x, p.pos.y, p.pos.z) ?? { x: 0, z: -1 }; cam.x = d.x; cam.z = d.z; p.camDir.set(cam.x, 0, cam.z); };
  const aim = () => {
    const want = level.cameraDirAt(p.pos.x, p.pos.y, p.pos.z) ?? { x: 0, z: -1 }, k = Math.min(1, 3.5 * dt);
    cam.x += (want.x - cam.x) * k; cam.z += (want.z - cam.z) * k;
    const length = Math.hypot(cam.x, cam.z);
    if (length < 0.01) { cam.x = want.x; cam.z = want.z; } else { cam.x /= length; cam.z /= length; }
    p.camDir.set(cam.x, 0, cam.z);
  };
  /** A world direction (east, south) held on the stick of a player looking along `cam`. */
  const held = (east, south) => ({ moveX: east * -cam.z + south * cam.x, moveY: east * cam.x + south * cam.z });
  const step = input => { aim(); p.step(dt, input, level); level.update(dt); p.stepDropInPresentation(); input.consumeEdges(); };
  p.competitionMode = false;
  p.endlessDeaths = true;

  // ---- 1 · the whole course, on a stick held forward --------------------------
  const bot = makeCourseBot({ p, level, CONST, lab, makeInput, parts });
  /** The bot decides in the course's terms (east or west, a lean on a rail). This holds that as a forward player does. */
  const forwardPad = pad => p.state === 'grind'
    ? { ...pad, moveY: 0 } // on a rail left and right are the lean, whichever way the camera looks
    : { ...pad, ...held(pad.moveX, -pad.moveY) };
  const play = (opts = {}) => {
    const run = bot.start(opts);
    resetCamera();
    let sideways = 0, forward = 0;
    for (let i = 0; i < run.steps; i++) {
      const pad = forwardPad(run.decide());
      if (p.state !== 'grind') { sideways = Math.max(sideways, Math.abs(pad.moveX)); forward = Math.max(forward, pad.moveY); }
      step(Object.assign(makeInput({ moveX: pad.moveX, moveY: pad.moveY }), pad));
      if (run.observe()) break;
    }
    return Object.assign(run.log, { sideways, forward });
  };
  const run = play();
  assert.ok(run.finished, `the course finishes on a stick held forward (stopped at x ${f1(p.pos.x)}, t ${f1(run.t)}; ${run.trouble.join('; ')})`);
  assert.ok(run.forward > 0.99 && run.sideways < 0.01, 'off the rails the pad was forward and back only: left and right were never needed');
  assert.equal(run.deaths + run.bails, 0, `no death or bail on the intended line (${run.trouble.join('; ')})`);
  assert.ok(run.maxZ < 0.4, `held straight, the run stays on the centre line with no walls holding it there (max |z| ${run.maxZ.toFixed(2)})`);
  assert.ok(Math.abs(run.minY - BASIN.top) < 0.05 && run.maxY > VALLEY_BRINK.top + 5, `basin floor to over the valley brink (y ${f1(run.minY)} to ${f1(run.maxY)})`);
  assert.equal(run.checkpoints, 12, 'all twelve checkpoints');
  for (const q of [P0, P1, DEEP, VALLEY, SWITCH_PIPE, C1, RAIL_PIPE, LONG_PIPE]) {
    const perch = run.perches.find(m => m.pipe === q.name);
    assert.ok(perch && perch.fromFoot && Math.abs(perch.x - q.westLip) < 1e-6 && perch.arrived < 2.2,
      `${q.name}: walking forward to the near coping puts him on his board at it, waiting (arrived at ${perch ? perch.arrived.toFixed(2) : '?'} m/s)`);
    const mount = run.mounts.find(m => m.pipe === q.name);
    assert.ok(mount && mount.fromPerch && Math.abs(mount.x - q.westLip) < 0.2 && mount.y < q.westLipY && mount.y > q.westLipY - 0.6 && Math.abs(mount.speed - 4) < 0.01,
      `${q.name}: and Jump drops him in, on the wall just under the lip`);
  }
  for (const q of [P0, L1, DEEP, VALLEY, SWITCH_PIPE, C3, RAIL_CATCH]) {
    const out = run.exits.get(q.name);
    assert.ok(out && out.onBoard, `${q.name}: Jump in the far hang with the stick held forward pops out over the far lip, onto the board`);
    assert.ok(out.onFoot && out.offAfter < 1.5, `${q.name}: and the brake has him off it (${out.onFoot ? out.offAfter.toFixed(2) + ' s' : 'never'})`);
  }
  for (const q of [P1, C1, C2]) assert.ok(run.transfers.has(q.name), `${q.name}: the same input over a shared ridge is the spine transfer`);
  assert.equal(run.grinds.length, 2, 'both rails are caught out of their hangs and ridden');
  assert.ok(run.switchAt !== null, 'the ! over the switch pipe is headed out of the near hang');
  assert.ok(run.maxHeadingZ < 1e-6, 'in a pipe the board stays on the line across it');
  const sideways = run.maxZ;

  // ---- 2 · a hang has no travel stick to the side -----------------------------
  // Seen from the side, left and right are the way in and out of a pipe, so the direction held up a wall
  // spins nothing until it is let go. From behind they are neither: a direction to the side is a fresh one.
  {
    const hp = level.halfpipes.find(candidate => Math.abs(candidate.cross - P0.cross) < 0.01);
    p.rawInput = makeInput({ moveX: 1, moveY: 0 });
    p.camDir.set(1, 0, 0);
    assert.equal(p.sideOnTravelStick(hp), 0, 'camera behind: right on the stick is not the travel stick');
    p.camDir.set(0, 0, -1);
    assert.equal(p.sideOnTravelStick(hp), 1, 'camera to the side: right on the stick is');
    p.rawInput = makeInput({ moveX: -1, moveY: 0 });
    assert.equal(p.sideOnTravelStick(hp), -1);
    p.rawInput = makeInput({ moveX: 0.2, moveY: 1 });
    assert.equal(p.sideOnTravelStick(hp), 0, 'a stick at rest to the side is nothing in either view');
  }

  // ---- 3 · the wall yard, from behind -----------------------------------------
  // Back from the spawn on the stick (toward the camera); the view comes round over the next few metres; then
  // forward is at the walls. Each answers a runner as it does in the side view: out over the first two, a
  // catch and a pull-up on the third, and the fourth is too high.
  {
    level.reset(true); p.respawn(level, true); resetCamera();
    assert.ok(cam.x > 0.999, 'at the spawn the camera looks down the course');
    let turnedAt = null, hung = false, top = -Infinity, west = Infinity, fresh = 0;
    const decks = new Set();
    for (let i = 0; i < 1500; i++) {
      // back until the view has turned; let go for a moment (a held direction keeps its meaning through a
      // camera turn); then forward, which is now west
      let pad = { moveX: 0, moveY: 0 };
      if (turnedAt === null) { pad = { moveX: 0, moveY: -1 }; if (cam.x < -0.995) turnedAt = i; }
      else if (++fresh > 6) pad = { moveX: 0, moveY: 1 };
      step(makeInput(pad));
      if (p.state === 'hang') hung = true;
      if (p.grounded && p.state === 'ride') {
        for (const wall of [YARD_VAULT, YARD_CLIMB, YARD_GRAB, YARD_MISS]) if (Math.abs(p.pos.y - wall.lipY) < 0.05 && p.pos.x < wall.lipX - 0.3) decks.add(wall.name);
      }
      top = Math.max(top, p.pos.y); west = Math.min(west, p.pos.x);
    }
    assert.ok(turnedAt !== null && turnedAt < 120, `the view has come round within ${turnedAt} steps of leaving the spawn`);
    assert.ok(decks.has(YARD_VAULT.name) && decks.has(YARD_CLIMB.name) && decks.has(YARD_GRAB.name), `forward at the walls takes the first three (${[...decks].join(', ')})`);
    assert.ok(hung, 'the third is caught by the lip and pulled up over with the stick held forward');
    assert.ok(!decks.has(YARD_MISS.name) && top < YARD_MISS.lipY - 0.5 && west > YARD_MISS.lipX - 0.2, `the fourth is too high (reached y ${f1(top)} of ${YARD_MISS.lipY})`);
    assert.equal(p.totalDeaths, 0);
  }

  // ---- 4 · the whole width is play --------------------------------------------
  {
    level.reset(true); p.respawn(level, true); resetCamera();
    for (let i = 0; i < 150; i++) step(makeInput({ moveX: 1, moveY: 0 })); // right of a camera looking east: south
    assert.ok(p.pos.z > 2.2 && p.pos.z < 3, `a walker leaves the centre line and is stopped at the edge of the floor (z ${p.pos.z.toFixed(2)})`);
    assert.ok(p.grounded && Math.abs(p.pos.y - entry.data.spawn[1]) < 0.2, 'still on the floor');
    for (let i = 0; i < 300; i++) step(makeInput({ moveX: -1, moveY: 0 }));
    assert.ok(p.pos.z < -2.2 && p.pos.z > -3, `...and at the other (z ${p.pos.z.toFixed(2)})`);
    // down the course along that edge: to P0's lip a long way off the centre line, and it is the same lip there
    for (let i = 0; i < 400 && !p.dropInPerch; i++) step(makeInput({ moveX: 0, moveY: 1 }));
    assert.ok(p.dropInPerch && p.freeSkate && Math.abs(p.pos.x - P0.westLip) < 1e-6 && Math.abs(p.pos.z) > 2,
      `he is on his board at P0's coping wherever along it he comes to it (z ${p.pos.z.toFixed(2)})`);
    // ...forward still held: he waits. Let go and pressed forward again: he drops in.
    for (let i = 0; i < 60; i++) step(makeInput({ moveX: 0, moveY: 1 }));
    assert.ok(p.dropInPerch, 'forward held all the way leaves him waiting there');
    for (let i = 0; i < 8; i++) step(makeInput());
    for (let i = 0; i < 60 && !(p.freeSkate && p.groundHit?.halfpipe); i++) step(makeInput({ moveX: 0, moveY: 1 }));
    assert.ok(p.freeSkate && p.groundHit?.halfpipe && Math.abs(p.pos.z) > 2, `and forward pressed afresh drops him in there (z ${p.pos.z.toFixed(2)})`);
  }

  level.dispose();
  console.log(`PASS Side Pipe Lab (Forward): the same ${parts.filter(c => c.grp !== CAMERA).length} parts met head-on; finished in ${f1(run.t)} s on a stick held forward ` +
    `(max |z| ${sideways.toFixed(2)} with no plane walls), ${run.exits.size} pop-outs, ${run.transfers.size} spine transfers, ${run.grinds.length} rails; ` +
    'the yard turns round and its four walls answer a runner from behind.');
});
