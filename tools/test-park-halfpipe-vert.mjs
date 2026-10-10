import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST }) => {
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const { SKATE_PARK } = await server.ssrLoadModule('/src/skateParkPhysics.ts');
  const take = JSON.parse(await readFile(new URL('./fixtures/deadwater-vert-replay.json', import.meta.url), 'utf8'));
  // Keep the maintained input recording's validated terrain and edge policy.
  // The live park now offers additional ordinary platform grinds.
  const recorded=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/deadwater-vert-level.json.gz',import.meta.url))));
  assert.equal(recorded.id,take.level);
  const cup = new Level(new THREE.Scene(), recorded);
  cup.update(0); cup.scene.updateMatrixWorld(true);
  const rider = new Player(cup.scene), replay = new Replayer(), input = makeInput();
  rider.enterLevel(take.level); rider.competitionMode = true; rider.endlessDeaths = true;
  rider.respawn(cup, true); replay.begin(take);
  try {
    // Original inputs: first coping at 8.48s swapped pool 2 for pool 3 and
    // inverted its wall. At 20.98s, a released transition ollie became street air.
    for (let frame = 0; frame <= 1259; frame++) {
      assert.ok(replay.feed(input, rider.camDir));
      rider.step(CONST.fixedStep, input, cup); cup.update(CONST.fixedStep);
      if (frame === 508) {
        assert.ok(rider.groundHit?.halfpipe === cup.halfpipes[2], JSON.stringify({frame,state:rider.state,position:rider.pos.toArray(),halfpipe:cup.halfpipes.indexOf(rider.groundHit?.halfpipe)}));
        assert.equal(rider.groundHit.vert, true, 'analytic attachment lost the vert tag');
      }
      if (frame === 509) {
        assert.equal(rider.vertAir, true);
        assert.ok(rider.hangPipe === cup.halfpipes[2], 'shared coping adopted the neighbouring pool');
        assert.ok(rider.vertNormal.z > .99, 'launch inverted the wall normal');
        assert.ok(rider.pos.z > -62, 'launch crossed the spine without a transfer input');
      }
      if (frame === 1259) {
        assert.equal(rider.vertAir, true, 'transition release incorrectly became a street ollie');
        assert.ok(rider.hangPipe === cup.halfpipes[4], 'recorded transition owns its original pool');
        assert.equal(rider.speed, 0, 'vert release retained outward street velocity');
      }
      input.consumeEdges();
    }
  } finally { replay.end(); cup.dispose(); }

  // Unobstructed production halfpipes isolate both normal windings and both
  // axes. Each adjacent pair shares a coping exactly, as in Deadwater Cup.
  const components = [];
  for (const yaw of [0, 90]) for (const offset of [0, 28]) components.push({
    t: 'vertramp', p: yaw === 0 ? [offset, 0, 0] : [100, 0, offset],
    vkind: 'half', len: 80, w: 4, rise: 10, arc: 90, yaw,
    skateCamera: true, gravityTrack: true,
  });
  components.push({ t: 'gate', p: [200, 0, 0] });
  const level = new Level(new THREE.Scene(), { id: 'park-halfpipe-vert', name: 'Park halfpipe vert', data: {
    v: 1, name: 'Park halfpipe vert', spawn: [0, .01, 0], killY: -30, skatepark: true, components,
  } });
  level.scene.updateMatrixWorld(true);
  const p = new Player(level.scene);
  p.competitionMode = true; p.endlessDeaths = true;
  const tick = sample => { p.step(CONST.fixedStep, makeInput(sample), level); level.update(CONST.fixedStep); };
  const place = (hp, side, angle = 0) => {
    const u = side * (hp.flatHalf + hp.radius * Math.PI / 3);
    const position = hp.worldPos(u, 0, new THREE.Vector3());
    if (hp.axis === 'x') position.x = 100;
    const heading = new THREE.Vector3(hp.axis === 'z' ? side : angle, 0, hp.axis === 'x' ? side : angle).normalize();
    p.respawn(level, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
    p.speed = 23; p.freeSkate = true; p.groundHit = p.queryGround(level);
    assert.ok(p.groundHit?.halfpipe === hp, 'fixture lacks real halfpipe support');
    p.rideNormal.copy(p.groundHit.normal); p.camDir.set(0, 0, -1);
  };
  let cases = 0, airFrames = 0;
  try {
    for (const hp of level.halfpipes) for (const side of [-1, 1])
      for (const angle of [0, .2]) for (const releaseAt of [null, .35, .16]) {
        place(hp, side, angle);
        let released = false, launch = null, landed = false;
        for (let frame = 0; frame < 240; frame++) {
          const release = !released && releaseAt !== null && p.grounded && p.rideNormal.y < releaseAt;
          released ||= release;
          const wasAir = p.vertAir, oldVy = p.vVel, oldY = p.pos.y;
          tick({ jumpHeld: !released, jumpPressed: frame === 0, jumpReleased: release });
          assert.equal(p.isBailing, false, 'ordinary halfpipe air caused a bail');
          assert.ok(p.pos.toArray().every(Number.isFinite));
          if (!launch && p.vertAir) {
            launch = { y: p.pos.y, normal: p.vertNormal.clone() };
            assert.ok(p.hangPipe === hp, 'launch must retain its source halfpipe');
            assert.ok((hp.axis === 'z' ? p.vertNormal.x : p.vertNormal.z) * side < -.99);
            if (releaseAt === null) assert.ok(p.pos.y >= hp.lipY - .021, 'natural air launched below the lip');
          }
          if (launch && wasAir && !p.grounded) {
            assert.ok(p.hangPipe === hp, 'air lost ownership of its launch pool');
            assert.equal(p.vertTracked, true, 'one mesh winding lost wall tracking');
            assert.ok(p.vertNormal.dot(launch.normal) > .9999, 'shared spine reversed the air');
            assert.ok(Math.abs(p.vVel - oldVy + SKATE_PARK.vertGravity * CONST.fixedStep) < 1e-8);
            assert.ok(Math.abs(p.pos.y - oldY - oldVy * CONST.fixedStep + .5 * SKATE_PARK.vertGravity * CONST.fixedStep ** 2) < 1e-8);
            airFrames++;
          }
          if (launch && p.grounded) {
            assert.ok(p.groundHit.halfpipe === hp, 'neutral air landed in the neighbouring pool');
            assert.equal(p.groundHit.vert, true);
            assert.equal(p.groundHit.gravityTrack, true);
            assert.equal(p.groundHit.skateCamera, true);
            assert.ok(p.speed > 8, 'drop-in lost its momentum');
            landed = true; break;
          }
          if (p.grounded) assert.equal(p.groundHit.vert, true);
        }
        assert.ok(launch && landed, 'halfpipe never completed its air and return');
        cases++;
      }
    // A deliberate second press/release still transfers across the spine;
    // ownership changes only with that input, then follows the receiving wall.
    for (const index of [0, 2]) {
      const source = level.halfpipes[index], target = level.halfpipes[index + 1];
      place(source, 1);
      for (let frame = 0; frame < 90 && !p.vertAir; frame++) tick({ jumpHeld: true });
      assert.equal(p.vertAir, true);
      tick({});
      const toward = source.axis === 'z' ? { moveX: 1 } : { moveY: -1 };
      tick({ ...toward, jumpPressed: true, jumpHeld: true });
      tick({ ...toward, jumpReleased: true });
      assert.equal(p.hangPipe, target, 'deliberate spine transfer failed');
      for (let frame = 0; frame < 180 && !p.grounded; frame++) tick({});
      assert.equal(p.isBailing, false);
      assert.equal(p.groundHit?.halfpipe, target);
      cases++;
    }
    // An explicit non-vert authoring tag must survive analytic contact too.
    const road = level.halfpipes[0];
    for (const mesh of road.walls) mesh.userData.vert = false;
    place(road, -1);
    tick({ jumpHeld: true }); assert.equal(p.groundHit.vert, false);
    tick({ jumpReleased: true }); assert.equal(p.vertAir, false);
    cases++;
  } finally { level.dispose(); }
  console.log(`PASS Deadwater replay frames 0–1259; ${cases} halfpipe cases and ${airFrames} ballistic air frames: both axes/windings, angled approaches, held/released launches, shared spines, return momentum and authored non-vert metadata.`);
});
