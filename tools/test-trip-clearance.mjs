import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Actual collision -> launch -> airborne travel -> first impact -> recovery.
// Checking only isBailing misses a trip whose speed is erased one tick later.
await withSkateRuntime(async ({ THREE, Player, Level, CONST, player: rotationPlayer }) => {
  const input = makeInput({ inventoryHeld: true }), rows = [];
  async function run({ kind = 'wall', height = .5, speed = 24, seed = 1, angle = 0, blocker = false, cosmetic }) {
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
        { t: 'camnode', p: [-travel.x * 10, 0, -travel.z * 10] },
        { t: 'camnode', p: [travel.x * 40, 0, travel.z * 40] },
      ],
    } });
    if (kind === 'crate') { level.crate(0, 0, 0, undefined, { noAuto: true }); height = level.crates.at(-1).box.max.y; }
    const p = new Player(scene); p.rawInput = input; p.respawn(level, true);
    p.step(CONST.fixedStep, input, level); p.freeSkate = true; p.invulnTimer = 0; p.simSeed = seed;
    p.axisF.copy(travel); p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.speed = speed;
    const name = `${kind} ${height}m @${speed} seed=${seed} angle=${angle} blocker=${blocker}`;
    let age = -1, firstImpact = null, launch = null, minCarry = Infinity, apex = 0, crossed = false;
    let minimumBodyLead = Infinity;
    const previous = p.pos.clone();
    const head = new THREE.Vector3(), feet = new THREE.Vector3(), foot = new THREE.Vector3();
    const random = Math.random;
    let visualSeed = seed ^ 0xa591;
    Math.random = cosmetic === undefined ? () => {
      visualSeed = (Math.imul(visualSeed, 1664525) + 1013904223) >>> 0;
      return visualSeed / 4294967296;
    } : () => cosmetic;
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
        if (!firstImpact && !p.ragdollImpactCount && !p.grounded && age >= 7) {
          p.headM.getWorldPosition(head); p.ankleL.getWorldPosition(feet); p.ankleR.getWorldPosition(foot);
          feet.add(foot).multiplyScalar(.5);
          const lead = head.sub(feet).dot(travel);
          minimumBodyLead = Math.min(minimumBodyLead, lead);
          assert.ok(lead > .1, `${name}: feet led the initial fall at ${age / 60}s (head lead ${lead})`);
        }
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
      rows.push({ kind, height, speed, seed, angle, blocker, impactZ: +firstImpact[2].toFixed(3), apex: +apex.toFixed(3), minimumBodyLead });
    } finally { Math.random = random; level.dispose(); }
  }
  for (const height of [.5, 1.1]) for (const speed of [13, 24]) for (const seed of [1, 71, 9301]) await run({ height, speed, seed });
  for (const angle of [.45, Math.PI]) await run({ height: 1.1, angle });
  for (const height of [.5, 1.1]) for (const speed of [13, 24]) await run({ kind: 'rail', height, speed });
  for (const speed of [6.5, 10]) await run({ kind: 'crate', speed });
  await run({ height: .5, blocker: true });
  for (const cosmetic of [0, .999]) {
    await run({ height: .5, speed: 13, cosmetic });
    await run({ kind: 'rail', height: 1.1, speed: 24, cosmetic });
  }
  // Camera-frame handedness and signed travel must not reverse the fold.
  // Exact air-drag integration must also agree under frame subdivision.
  const rp = rotationPlayer, up = new THREE.Vector3(), spin = new THREE.Vector3(9, 1, -.6);
  rp.state = 'air'; rp.grounded = false; rp.ragForwardTrip = true; rp.ragImpacts = 0; rp.ragTripAirDrag = 4;
  rp.axisF.set(.6, 0, -.8);
  for (const handedness of [-1, 1]) for (const direction of [-1, 1]) {
    rp.axisL.set(.8 * handedness, 0, .6 * handedness); rp.speed = 12 * direction;
    rp.ragQ.identity(); rp.ragAngVel.copy(spin); rp.integrateRagdollRotation(.24);
    const oneStep = rp.ragQ.clone(), oneStepSpin = rp.ragAngVel.clone();
    assert.ok(up.set(0, 1, 0).applyQuaternion(rp.ragQ).dot(rp.axisF) * direction > .5, 'trip rotated away from momentum');
    rp.ragQ.identity(); rp.ragAngVel.copy(spin);
    for (let i = 0; i < 12; i++) rp.integrateRagdollRotation(.02);
    assert.ok(1 - Math.abs(oneStep.dot(rp.ragQ)) < 1e-10, 'trip rotation changed with timestep');
    assert.ok(oneStepSpin.distanceTo(rp.ragAngVel) < 1e-10, 'trip angular damping changed with timestep');
  }
  console.log(JSON.stringify({ passed: rows.length, cases: rows }, null, 2));
});
