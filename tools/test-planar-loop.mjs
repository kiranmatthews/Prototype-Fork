// A PLANAR LOOP: an upright loop with no offset, stood on one line of a course that is read from the side.
// What it is checked for here, with the real player on a one-line fixture:
//   · it asks for the speeds the ride itself agrees with (`planarLoopEntry`), and takes on only a rider
//     that what he is doing will carry round: nobody is taken on to be dropped;
//   · it is no floor and no wall: a walker, a rider at the cruise and a rider going the other way all go
//     along the floor under it, and a ray from over its lower quadrant finds the floor;
//   · a rider with the accelerator held is carried round once and comes off its foot on his line, and is
//     not taken on again there; a pad that gives the coasting speed does it with nothing held;
//   · the stick does nothing on it (on a course seen from the side, left and right are the way along);
//   · letting the accelerator go at its foot, or braking on it, is a fall inside the ring that he gets up from;
//   · the view of a course's own is offered a place to rest on the ring while he is on it, and while he
//     falls inside it, and not after.
// The loops that are not planar are the business of test-loop-ride.mjs, and are not changed by any of this.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const started = Date.now();
await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST, THREE }) => {
  const { Level, parseCustomLevelJson } = await server.ssrLoadModule('/src/level.ts');
  const { createLoopMeshData, isPlanarLoop, planarLoopEntry, stepLoopMotion } = await server.ssrLoadModule('/src/loopRide.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  stock.dispose();
  const DT = CONST.fixedStep;
  const forces = { gravity: TUNING.groundGravity, pump: TUNING.pipePumpGain + TUNING.chargeBoost, friction: TUNING.pipeFriction,
    drag: TUNING.windDrag, braking: TUNING.turnaround };

  // ---- what a planar loop is, and what it asks for ----------------------------------------------
  assert.equal(isPlanarLoop({ offset: 0 }), true);
  assert.equal(isPlanarLoop({ offset: 0, kind: 'vertical' }), true);
  assert.equal(isPlanarLoop({ offset: 9 }), false, 'a loop that comes off beside where it was entered is not planar');
  assert.equal(isPlanarLoop({ offset: 0, kind: 'wall' }), false, 'a wall loop lies down: it is not this');
  const rides = (radius, speed, charge) => {
    let motion = { angle: 0, speed };
    for (let i = 0; i < 3600; i++) {
      const next = stepLoopMotion({ radius, width: 3, offset: 0 }, motion, DT, charge, false, forces);
      if (!next.attached) return false;
      if (next.complete) return true;
      motion = next;
    }
    return false;
  };
  const asked = {};
  for (const radius of [4, 6, 10]) {
    const entry = planarLoopEntry(radius, forces), root = Math.sqrt(radius);
    asked[radius] = entry;
    assert.ok(entry.pumped < entry.coasting, `r ${radius}: the pump asks for less than coasting does`);
    assert.ok(entry.coasting / root > 14.9 && entry.coasting / root < 15.6, `r ${radius}: coasting is about 15.2 root r (${(entry.coasting / root).toFixed(2)})`);
    assert.ok(entry.pumped / root > 9.6 && entry.pumped / root < 10.2, `r ${radius}: pumped is about 9.8 root r (${(entry.pumped / root).toFixed(2)})`);
    assert.ok(rides(radius, entry.coasting + 0.3, 0) && !rides(radius, entry.coasting - 0.3, 0), `r ${radius}: the coasting speed is the one the ride agrees with`);
    assert.ok(rides(radius, entry.pumped + 0.3, 1) && !rides(radius, entry.pumped - 0.3, 1), `r ${radius}: so is the pumped one`);
  }
  assert.ok(asked[4].pumped < TUNING.maxSpeed, `a 4 m ring is within reach of the accelerator alone (${asked[4].pumped.toFixed(1)} against ${TUNING.maxSpeed} m/s)`);

  // ---- the fixture: one line read from the side, a floor, a ring ------------------------------------
  const RADIUS = 4, WIDTH = 3, FOOT = 0;
  const fixture = ({ pad = null, radius = RADIUS, offset = 0 } = {}) => ({ v: 1, name: 'Planar loop fixture', spawn: [-60, 0.12, 0], killY: -30, components: [
    { t: 'platform', p: [15, -2, 0], s: [200, 4, 6], tex: 'stone', nm: 'Fixture floor' },
    { t: 'mesh', p: [FOOT, 0.02, 0], yaw: -90, ...createLoopMeshData(radius, WIDTH, offset, 96), loopRadius: radius, loopOffset: offset, w: WIDTH,
      tex: 'metal', doubleSided: true, edgeGrinding: false, nm: 'The ring' },
    ...(pad ? [{ t: 'speedpad', p: [FOOT - 8, 0.06, 0], s: [5, 0.12, 4], yaw: -90, speed: pad, cycle: 0.6, nm: 'Pad' }] : []),
    { t: 'checkpoint', p: [-80, 0, 0] }, { t: 'gate', p: [112, 0, 0], yaw: 90 }, { t: 'clock', p: [-82, 0, 2.2] },
    { t: 'zone', p: [0, 0, 0], s: [400, 1, 30], dir: 'E', sideOn: true },
    { t: 'wall', p: [0, 0, -0.83], s: [400, 160, 0.6], invisible: true }, { t: 'wall', p: [0, 0, 0.83], s: [400, 160, 0.6], invisible: true },
  ] });
  let level = null;
  const build = options => {
    level?.dispose();
    const data = fixture(options);
    level = new Level(scene, { id: 'planar-loop-fixture', name: data.name, data });
    level.update(0); scene.updateMatrixWorld(true);
    p.competitionMode = false; p.endlessDeaths = true;
    return level;
  };
  const tick = input => { p.step(DT, input, level); level.update(DT); p.flushLevelCrateRewards(level); p.commitRenderStep(level); input.consumeEdges(); };
  /** Play from `from` for `seconds`, the controller saying each step what is held: { moveX, jump, grab }. */
  const play = (controller, { from = -55, heading = 1, seconds = 12, until = null } = {}) => {
    p.respawn(level, true, false, { position: new THREE.Vector3(from, 0.15, 0), heading: new THREE.Vector3(heading, 0, 0) });
    for (let i = 0; i < 20; i++) tick(makeInput());
    const log = { taken: null, off: null, again: 0, top: 0, bails: 0, maxZ: 0, fellAt: null, held: 0, heldFalling: 0, viewAfter: null, latchFreeAt: null };
    let jumped = false, active = false, bailing = false;
    for (let k = 0; k < seconds * 60 && p.state !== 'dead'; k++) {
      const want = controller(p, k), input = makeInput({ moveX: want.moveX ?? 0 });
      input.jumpHeld = !!want.jump; input.jumpPressed = !!want.jump && !jumped; input.jumpReleased = !want.jump && jumped; jumped = !!want.jump;
      input.grabHeld = !!want.grab;
      const before = p.loopStatus;
      tick(input);
      const now = p.loopStatus, view = p.planarLoopSubject;
      if (now.active && !active) { if (log.taken) log.again++; else log.taken = { x: p.pos.x, speed: p.speed }; }
      if (!now.active && active) { log.off = { x: p.pos.x, y: p.pos.y, speed: p.speed, round: now.completed > 0 }; if (!now.completed) log.fellAt = before.progress * 360; }
      if (now.active) { log.top = Math.max(log.top, p.pos.y); log.maxZ = Math.max(log.maxZ, Math.abs(p.pos.z));
        assert.ok(view && Math.abs(view.x - FOOT) < 0.9, 'on the ring, a view of the course is offered the ring to rest on');
        log.viewOff = Math.abs(view.x - FOOT); log.held++; }
      else if (view && p.loopFailure && !p.grounded) log.heldFalling++;
      if (log.off && log.off.round && log.viewAfter === null && !view) log.viewAfter = (k * DT);
      if (log.off && log.latchFreeAt === null && p.loopLeft === null) log.latchFreeAt = p.pos.x;
      if (p.isBailing && !bailing) log.bails++;
      active = now.active; bailing = p.isBailing;
      if (until?.(p, log, k)) break;
    }
    return log;
  };
  const mounted = q => !q.freeSkate && q.grounded; // (Jump held with a direction puts him on the board)
  const told = log => JSON.stringify({ ...log, taken: log.taken && { x: +log.taken.x.toFixed(2), speed: +log.taken.speed.toFixed(1) }, off: log.off && { ...log.off, x: +log.off.x.toFixed(2), y: +log.off.y.toFixed(2), speed: +log.off.speed.toFixed(1) } });

  // ---- built: ridden by its centreline, and nothing else to anything ---------------------------------
  build();
  const ringMesh = level.loopMeshes[0];
  assert.ok(level.loopMeshes.length === 1 && ringMesh.userData.planarLoop === true, 'the ring is a loop the level knows of, and a planar one');
  assert.ok(!level.groundMeshes.includes(ringMesh), 'its ribbon is not a floor');
  const body = ringMesh.children.find(child => child.name.startsWith('Planar loop'));
  assert.ok(body, 'it is given a body to be seen by');
  let triangles = 0;
  body.traverse(object => { if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3; });
  assert.ok(triangles > 400 && triangles < 4000, `...a cheap one (${triangles} triangles)`);
  const down = new THREE.Raycaster(new THREE.Vector3(FOOT - 2, 3, 0), new THREE.Vector3(0, -1, 0), 0, 8);
  const under = down.intersectObjects(level.groundMeshes, false)[0];
  assert.ok(under && Math.abs(under.point.y) < 0.01, 'a ray from over its lower quadrant finds the floor');
  const saved = parseCustomLevelJson(JSON.stringify(fixture()));
  assert.ok(saved && saved.components.some(c => c.loopRadius === RADIUS && c.loopOffset === 0), 'a planar loop is saved and read back as one');

  const past = q => q.pos.x > FOOT + RADIUS + 6, pastWest = q => q.pos.x < FOOT - RADIUS - 6;
  const walker = play(() => ({ moveX: 1 }), { from: -20, seconds: 9, until: past });
  assert.ok(!walker.taken && walker.bails === 0 && past(p) && Math.abs(p.pos.y) < 0.02 && !p.freeSkate, `a walker walks under it (${told(walker)}, x ${p.pos.x.toFixed(1)})`);
  const cruiser = play(q => ({ moveX: 1, jump: mounted(q) }), { from: -30, seconds: 9, until: past });
  assert.ok(!cruiser.taken && cruiser.bails === 0 && past(p) && p.freeSkate && Math.abs(p.speed - TUNING.cruiseSpeed) < 1, `a rider at the cruise rolls under it (${told(cruiser)}, x ${p.pos.x.toFixed(1)})`);
  const west = play(() => ({ moveX: -1, jump: true }), { from: 60, heading: -1, seconds: 9, until: pastWest });
  assert.ok(!west.taken && west.bails === 0 && pastWest(p) && p.speed > asked[RADIUS].pumped, `a rider going the other way is not taken on, fast as he is (${told(west)}, x ${p.pos.x.toFixed(1)}, ${p.speed.toFixed(1)} m/s)`);

  // ---- the accelerator held: round once, off its foot on his line, and not taken again ---------------
  const held = play(() => ({ moveX: 1, jump: true }), { seconds: 7 });
  assert.ok(held.taken && held.taken.speed >= asked[RADIUS].pumped && Math.abs(held.taken.x - FOOT) < 0.9, `he is taken on at its foot, going fast enough (${told(held)})`);
  assert.ok(held.off?.round && p.loopStatus.completed === 1 && held.again === 0, `...carried round once and not taken on again (${told(held)})`);
  assert.ok(Math.abs(held.top - RADIUS * 2) < 0.06 && held.maxZ < 0.01, `...over the top (${held.top.toFixed(2)} m) and in its plane (|z| ${held.maxZ.toFixed(3)})`);
  assert.ok(Math.abs(held.off.x - FOOT) < 0.3 && Math.abs(held.off.y) < 0.05 && held.off.speed > held.taken.speed, `...off its foot, on the floor, and the faster for the pump (${told(held)})`);
  assert.ok(held.bails === 0 && p.pos.x > 40 && Math.abs(p.pos.z) < 0.05, `...and on down the line (x ${p.pos.x.toFixed(1)})`);
  assert.ok(held.latchFreeAt !== null && held.latchFreeAt > FOOT + 0.5 && held.latchFreeAt < FOOT + 4, `it would take him again once he has gone on from its foot (free at x ${held.latchFreeAt?.toFixed(1)})`);
  assert.ok(held.viewOff < 0.01 && held.viewAfter !== null, `the view comes to rest on the ring's foot (${held.viewOff.toFixed(4)} m off it by the end), and is given back once he is off it`);

  // ---- what he holds on it ---------------------------------------------------------------------------
  let onIt = false;
  const letGo = play(q => { onIt ||= q.loopStatus.active; return { moveX: 1, jump: !onIt }; }, { seconds: 9 });
  assert.ok(letGo.taken && !letGo.off.round && letGo.fellAt > 90 && letGo.fellAt < 180 && letGo.bails === 1,
    `the accelerator let go as it takes him on: he comes off it past the upright, and falls (${told(letGo)})`);
  assert.ok(p.state !== 'dead' && p.grounded && !p.isBailing && Math.abs(p.pos.z) < 0.05 && p.loopStatus.completed === 0, `...inside the ring, and gets up (x ${p.pos.x.toFixed(1)}, ${p.state})`);
  assert.ok(letGo.heldFalling > 10, 'the view stays on the ring while he falls inside it');
  const lateLetGo = play(q => ({ moveX: 1, jump: !(q.loopStatus.active && q.loopStatus.progress > 0.5) }), { seconds: 6 });
  assert.ok(lateLetGo.off?.round && lateLetGo.bails === 0, `let go over the top, he still comes round: the pump is only for the way up (${told(lateLetGo)})`);

  // ---- a pad that gives the coasting speed: nothing held, and nothing the stick can do ----------------
  const pad = Math.ceil(asked[RADIUS].coasting + 5);
  build({ pad });
  for (const [what, stick] of [['nothing held', 1], ['the stick let go', 0], ['the stick held back', -1]]) {
    const log = play(q => ({ moveX: q.loopStatus.active ? stick : 1, jump: mounted(q) }), { from: -40, seconds: 5 });
    assert.ok(log.taken && log.taken.speed >= asked[RADIUS].coasting && log.off?.round && log.bails === 0 && log.maxZ < 0.01,
      `a pad of ${pad} m/s 8 m before its foot, ${what} on the ring: round (${told(log)})`);
  }
  const braked = play(q => ({ moveX: 1, jump: mounted(q), grab: q.loopStatus.active }), { from: -40, seconds: 8 });
  assert.ok(braked.taken && !braked.off.round && braked.bails === 1 && p.state !== 'dead', `the brake held on the ring is a fall (${told(braked)})`);

  // ---- between the two speeds, it is what he is holding as he comes to its foot that decides -------------
  const between = Math.round((asked[RADIUS].pumped + asked[RADIUS].coasting) / 2);
  build({ pad: between });
  const unheld = play(q => ({ moveX: 1, jump: mounted(q) }), { from: -40, seconds: 9, until: past });
  assert.ok(!unheld.taken && unheld.bails === 0 && past(p) && p.speed > asked[RADIUS].pumped,
    `a pad of ${between} m/s and nothing held: too slow to coast it, so he is not taken on to be dropped, and rolls under (${told(unheld)}, ${p.speed.toFixed(1)} m/s)`);
  const pumped = play(() => ({ moveX: 1, jump: true }), { from: -40, seconds: 6 });
  assert.ok(pumped.taken && pumped.off?.round && pumped.bails === 0, `the same pad with the accelerator held: taken on, and round (${told(pumped)})`);

  // ---- a loop that is not planar is what it was -----------------------------------------------------
  build({ offset: 9 });
  assert.ok(level.groundMeshes.includes(level.loopMeshes[0]) && !level.loopMeshes[0].userData.planarLoop && !level.loopMeshes[0].children.length,
    'a loop with an offset is a floor as it always was, and is not dressed');
  level.dispose();
  console.log(`PASS planar loop: asks ${asked[4].pumped.toFixed(1)} m/s pumped and ${asked[4].coasting.toFixed(1)} coasting at 4 m of radius (${asked[6].pumped.toFixed(1)} and ${asked[6].coasting.toFixed(1)} at 6 m); ` +
    `a walker, a cruising rider and a rider going west go under it; the accelerator carries a rider round once (in at ${held.taken.speed.toFixed(1)}, off its foot at ${held.off.speed.toFixed(1)} m/s) and he is not taken again; ` +
    `let go at the foot he falls at ${letGo.fellAt.toFixed(0)} degrees and gets up; a pad of ${pad} m/s does it with nothing held; the stick does nothing on it; checked in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}, { animationScheme: 'D' });
