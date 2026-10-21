import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const entry = park => ({ id: 'halfpipe-steering-test', name: 'Halfpipe steering', data: {
  v: 1, name: 'Halfpipe steering', spawn: [0, .1, 0], killY: -40, skatepark: park,
  components: [
    { t: 'vertramp', p: [0, 0, 0], vkind: 'half', w: 30, rise: 12, len: 120, rails: false },
    { t: 'vertramp', p: [140, 0, 0], vkind: 'half', w: 30, rise: 12, len: 120, rails: false, yaw: 27 },
    { t: 'vertramp', p: [280, 0, 0], vkind: 'half', w: 30, rise: 12, len: 120, rails: false, vert: false },
    { t: 'vertramp', p: [420, 0, 0], vkind: 'half', w: 30, rise: 12, len: 120, rails: false, yaw: 27, vert: false },
    { t: 'platform', p: [560, -1, 0], s: [100, 2, 120], edgeGrinding: false },
    { t: 'gate', p: [560, 0, -52] },
  ],
} });
const reports = [];
await withSkateRuntime(async ({ THREE, server, Level, Player, TUNING, CONST }) => {
  const original = { ...TUNING };
  const { Recorder, Replayer } = await server.ssrLoadModule('/src/replay.ts');
  try {
    for (const park of [false, true]) {
      const level = new Level(new THREE.Scene(), entry(park));
      level.update(0); level.scene.updateMatrixWorld(true);
      const p = new Player(level.scene);
      p.enterLevel('halfpipe-steering-test'); p.endlessDeaths = true;
      const hp = level.halfpipes[0];
      const run = ({ x = 0, speed = 23, rate = 104, frames = 1, wall = false,
        airborne = false, walking = false, input = { moveX: 1, jumpHeld: true }, dt = CONST.fixedStep } = {}) => {
        TUNING.pipeTurnRate = rate;
        const position = wall ? hp.worldPos(hp.flatHalf + hp.radius * .65, 0, new THREE.Vector3())
          : new THREE.Vector3(x, 0, 0);
        p.respawn(level, true, true, { position, heading: new THREE.Vector3(0, 0, -1) });
        p.pos.copy(position); p.prevPos.copy(position); p.axisF.set(0, 0, -1); p.axisL.set(-1, 0, 0);
        p.freeSkate = !walking; p.speed = walking ? 0 : speed;
        p.grounded = true; p.groundHit = p.queryGround(level);
        assert.ok(p.groundHit, 'fixture has no real surface contact');
        p.rideNormal.copy(p.groundHit.normal); p.camDir.set(0, 0, -1);
        if (airborne) {
          p.pos.y += 8; p.prevPos.copy(p.pos); p.grounded = false; p.airFromSkate = true; p.vVel = 8;
        }
        for (let i = 0; i < frames; i++) {
          p.step(dt, makeInput(input), level); level.update(dt);
          assert.ok(!p.isBailing, 'steering caused a bail');
          assert.ok(p.pos.toArray().every(Number.isFinite));
        }
        return { angle: Math.atan2(p.axisF.x, -p.axisF.z) * 180 / Math.PI,
          position: p.pos.toArray(), speed: p.speed, grounded: p.grounded };
      };
      try {
        for (const speed of [23, 32, 48]) for (const wall of [false, true]) {
          const before = run({ speed, wall, rate: 0 }), after = run({ speed, wall });
          assert.ok(after.angle > before.angle * (park ? 1 : 1.6), 'fast halfpipe lost turning authority');
          assert.ok(Math.abs(after.angle - 104 * CONST.fixedStep) < 1e-3, JSON.stringify({park,speed,wall,before,after}));
          reports.push({ park, speed, wall, before: before.angle, after: after.angle });
        }
        // Swept/rotated halves use the same boost as their analytic siblings.
        const swept = run({ x: 140 });
        assert.ok(Math.abs(swept.angle - run().angle) < 1e-7);
        // Full trajectories prove the exception cannot leak onto a road or
        // ordinary floor, into the air, onto feet, or into deliberate braking.
        for (const options of [
          { x: 280 }, { x: 420 }, { x: 560 }, { airborne: true },
          ...(!park ? [{ walking: true, input: { moveX: 1 } }] : []),
          { input: { moveX: .5, grabHeld: true } },
          { input: { moveY: -1 } },
        ]) assert.deepEqual(run({ ...options, frames: 12, rate: 104 }),
          run({ ...options, frames: 12, rate: 0 }), `exception leaked: ${JSON.stringify({ park, ...options })}`);
        // Steering is not a speed boost. The floor carve retains momentum
        // under exactly the original motor, and remains stable by timestep.
        for (const hz of [60, 120, 240]) {
          const after = run({ speed: 23, frames: hz / 4, dt: 1 / hz });
          assert.ok(after.angle > 25.5 && after.angle < 26.5, `quarter-second carve failed at ${hz} Hz`);
          const before = run({ speed: 23, frames: hz / 4, dt: 1 / hz, rate: 0 });
          assert.ok(after.grounded && Math.abs(after.speed - before.speed) < 1e-7, JSON.stringify({park,hz,after,before}));
        }
        const stopped = run({ speed: 0, input: { moveX: 1 } });
        assert.deepEqual(stopped, run({ speed: 0, rate: 0, input: { moveX: 1 } }), 'stationary turn changed');
      } finally { level.dispose(); }
    }
    Object.assign(TUNING, original);
    const recorder = new Recorder(); recorder.start('test'); const take = recorder.export();
    assert.equal(take.tuning.pipeTurnRate, 104, 'new recordings omitted halfpipe turn rate');
    const replayer = new Replayer();
    replayer.begin(take); assert.equal(TUNING.pipeTurnRate, 104); replayer.end();
    delete take.tuning.pipeTurnRate;
    replayer.begin(take); assert.equal(TUNING.pipeTurnRate, 0, 'old recordings changed trajectories');
    replayer.end(); assert.equal(TUNING.pipeTurnRate, 104, 'replay failed to restore live halfpipe steering');
    console.log(JSON.stringify(reports));
    console.log('PASS halfpipe steering: course/park, analytic/swept, trough/wall, overspeed, frame subdivision, road/air/foot/brake isolation, replay compatibility');
  } finally { Object.assign(TUNING, original); }
}, { levelEntry: entry(false) });
