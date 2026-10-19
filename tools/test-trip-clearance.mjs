import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Actual collision -> launch -> airborne travel -> first impact -> recovery.
// Checking only isBailing misses a trip whose speed is erased one tick later.
await withSkateRuntime(async ({ THREE, Player, Level, CONST }) => {
  const input = makeInput({ inventoryHeld: true }), rows = [];
  async function run({ kind = 'wall', height = .5, speed = 24, seed = 1, angle = 0, blocker = false }) {
    const travel = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const scene = new THREE.Scene();
    const obstacle = kind === 'rail'
      ? { t: 'rail', p: [0, height, 0], len: 8, yaw: 90 }
      : { t: 'wall', p: [0, 0, 0], s: [8, height, .8] };
    const level = new Level(scene, { id: 'trip-clearance', name: 'Trip clearance', data: {
      v: 1, name: 'Trip clearance', spawn: [-travel.x * 4, .04, -travel.z * 4], killY: -20,
      components: [
        { t: 'platform', p: [0, -.5, 0], s: [60, 1, 80], edgeGrinding: false },
        ...(kind === 'crate' ? [] : [obstacle]),
        ...(blocker ? [{ t: 'wall', p: [0, 0, -3], s: [8, 3.2, .8] }] : []),
        { t: 'gate', p: [25, 0, -35] },
      ],
    } });
    if (kind === 'crate') { level.crate(0, 0, 0, undefined, { noAuto: true }); height = level.crates.at(-1).box.max.y; }
    const p = new Player(scene); p.rawInput = input; p.respawn(level, true);
    p.step(CONST.fixedStep, input, level); p.freeSkate = true; p.invulnTimer = 0; p.simSeed = seed;
    p.axisF.copy(travel); p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.speed = speed;
    const name = `${kind} ${height}m @${speed} seed=${seed} angle=${angle} blocker=${blocker}`;
    let age = -1, firstImpact = null, launch = null, minCarry = Infinity, apex = 0, crossed = false;
    const previous = p.pos.clone();
    try {
      for (let i = 0; i < 360; i++) {
        previous.copy(p.pos); const beforeSpeed = Math.abs(p.speed);
        p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
        if (age < 0 && p.isBailing) {
          age = 0; launch = { speed: Math.abs(p.speed), position: p.pos.toArray() };
          assert.ok(p.pos.dot(travel) < 0, `${name}: teleported to far side at launch`);
        }
        if (age < 0) continue;
        age++;
        assert.ok([...p.pos.toArray(), p.speed, p.vVel].every(Number.isFinite), `${name}: invalid trajectory`);
        assert.ok(!p.breakApartDiagnostics?.active, `${name}: detached body`);
        if (age > 1) assert.ok(Math.hypot(p.pos.x - previous.x, p.pos.z - previous.z) <= beforeSpeed * CONST.fixedStep + .2,
          `${name}: discontinuous horizontal travel`);
        apex = Math.max(apex, p.pos.y);
        if (!crossed) minCarry = Math.min(minCarry, Math.abs(p.speed));
        crossed ||= p.pos.z * Math.sign(travel.z) > .4 + CONST.playerHalf.z;
        if (!firstImpact && (p.ragdollImpactCount > 0 || p.grounded)) firstImpact = p.pos.toArray();
        if (!p.isBailing) break;
      }
      assert.ok(launch, `${name}: no trip`);
      assert.ok(crossed, `${name}: never cleared obstacle ${JSON.stringify({ launch, finish: p.pos.toArray(), firstImpact, speed: p.speed, age })}`);
      assert.ok(apex > height, `${name}: arc did not crest obstacle`);
      assert.ok(minCarry > launch.speed * .5, `${name}: obstacle cancelled carry`);
      assert.ok(firstImpact && firstImpact[2] * Math.sign(travel.z) > .4 + CONST.playerHalf.z,
        `${name}: landed behind obstacle: ${JSON.stringify(firstImpact)}`);
      assert.ok(!p.isBailing && p.grounded && p.state !== 'dead', `${name}: no supported recovery`);
      if (blocker) assert.ok(p.pos.z > -2.6, `${name}: passed through unrelated wall`);
      if (kind === 'crate') assert.ok(level.crates.at(-1).alive, `${name}: ragdoll destroyed trip obstacle`);
      // The release must not survive a new run or turn into general noclip.
      p.respawn(level, true, true);
      assert.equal(p.tripObstacle, null, `${name}: contact release survived respawn`);
      rows.push({ kind, height, speed, seed, angle, blocker, impactZ: +firstImpact[2].toFixed(3), apex: +apex.toFixed(3) });
    } finally { level.dispose(); }
  }
  for (const height of [.5, 1.1]) for (const speed of [13, 24]) for (const seed of [1, 71, 9301]) await run({ height, speed, seed });
  for (const angle of [.45, Math.PI]) await run({ height: 1.1, angle });
  for (const height of [.5, 1.1]) for (const speed of [13, 24]) await run({ kind: 'rail', height, speed });
  for (const speed of [6.5, 10]) await run({ kind: 'crate', speed });
  await run({ height: .5, blocker: true });
  console.log(JSON.stringify({ passed: rows.length, cases: rows }, null, 2));
});
