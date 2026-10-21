import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, Player, Level, CONST, player }) => {
  const input = makeInput({ inventoryHeld: true }), rows = [];
  // Real missed jumps into a platform face, followed through every bounce
  // and the supported get-up. No forced collision calls or catch suppression.
  const cases = [0, .48, -.48].flatMap(angle => [false, true].map(alreadyBailing => ({angle, alreadyBailing, catchExpected:false})));
  cases.push({ angle: 0, alreadyBailing: false, catchExpected: true });
  for (const {angle, alreadyBailing, catchExpected} of cases) {
    const scene = new THREE.Scene(), level = new Level(scene, { id: 'edge-impact', name: 'Edge impact', data: {
      v: 1, name: 'Edge impact', spawn: [0, -2, 0], killY: -20,
      components: [
        { t: 'platform', p: [0, -4.5, 0], s: [50, 1, 50], edgeGrinding: false },
        { t: 'platform', p: [0, -2, -8], s: [12, 4, 8], edgeGrinding: false },
        { t: 'gate', p: [20, -4, -20] },
        { t: 'camnode', p: [0, 0, 12] },
        { t: 'camnode', p: [0, 0, -30] },
      ],
    } });
    const p = new Player(scene); p.rawInput = input; p.respawn(level, true);
    p.axisF.set(Math.sin(angle), 0, -Math.cos(angle)); p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.pos.set(0, catchExpected ? -1.15 : -2, 0); p.prevPos.copy(p.pos);
    p.invulnTimer = 0; p.speed = 24; p.state = 'air'; p.grounded = false; p.vVel = -4;
    p.freeSkate = p.airFromSkate = p.airMomentum = true; p.airGrav = 'board';
    if (alreadyBailing) { p.bail(false, 24, 'landing', 20); p.speed = 24; }
    let bounced = false, recovered = false, floorContacts = 0, last = 0, first = null;
    const before = new THREE.Vector3(), spin = new THREE.Vector3();
    try {
      for (let frame = 0; frame < 300; frame++) {
        before.copy(p.pos); p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
        if (catchExpected && p.state === 'hang') break;
        assert.ok([...p.pos.toArray(), p.speed, p.vVel, ...p.ragQ.toArray()].every(Number.isFinite));
        assert.ok(!p.breakApartDiagnostics?.active, 'edge impact detached the body');
        assert.notEqual(p.state, 'dead', 'safe catch deck lost the rider');
        if (Math.abs(p.pos.x) < 6 && p.pos.y < -.2)
          assert.ok(p.pos.z >= -4 - .01,
            `tunnelled through pit face: ${JSON.stringify({angle, alreadyBailing, frame, at:p.pos.toArray(), first})}`);
        p.ragdollWorldSpin(spin);
        if (p.ragdollWallImpactCount > last) {
          assert.ok(p.isBailing && !p.grounded, 'edge did not own the airborne bail');
          assert.ok(p.axisF.z * p.speed > 1, 'edge contact stopped instead of rebounding out');
          assert.ok(p.vVel < 0, 'missed jump received an artificial upward launch');
          assert.ok(spin.length() <= 16.001, 'contact torque escaped its bound');
          first ??= { frame, at: p.pos.toArray(), out: [p.axisF.x * p.speed, p.vVel, p.axisF.z * p.speed] };
          bounced = true; last = p.ragdollWallImpactCount;
        }
        floorContacts = Math.max(floorContacts, p.ragdollImpactCount);
        if (bounced && !p.isBailing) { recovered = true; assert.ok(p.grounded, 'recovered without support'); }
        if (frame > 220 && recovered) break;
      }
      if (catchExpected) {
        assert.equal(p.state, 'hang', 'valid ledge catch was replaced by a bail');
        assert.equal(p.ragdollWallImpactCount, 0);
        rows.push({angle, catchExpected, state:p.state}); continue;
      }
      assert.ok(bounced, `missed skate jump never rebounded: ${JSON.stringify({angle, alreadyBailing, at:p.pos.toArray(), state:p.state, bailing:p.isBailing, floorContacts})}`);
      assert.ok(recovered && floorContacts > 0, 'edge bounce did not finish through floor contact/recovery');
      assert.ok(last <= 2, 'one edge machine-gunned repeat contacts');
      rows.push({ angle, alreadyBailing, wallContacts: last, floorContacts, first });
    } finally { level.dispose(); }
  }
  // Response invariants across head-on/glancing normals and signed travel.
  // The cosmetic torque must not affect linear energy or consume replay RNG.
  const p = player; p.rawInput = input; p.invulnTimer = 0;
  p.beginPvpKnockdown(0, 1);
  p.simRand = () => { throw new Error('contact consumed gameplay RNG'); };
  p.interactionMeasure.sampledPlaneDistance = () => { throw new Error('impact performed a mesh support scan'); };
  p.group.updateMatrixWorld = () => { throw new Error('impact recomputed the whole hierarchy'); };
  for (const sign of [-1, 1]) for (const a of [0, .4, 1.05]) {
    p.state = 'air'; p.grounded = false;
    const v = new THREE.Vector3(20 * Math.sin(a), -9, -20 * Math.cos(a)), n = new THREE.Vector3(0, 0, 1);
    p.axisF.copy(v).setY(0).normalize().multiplyScalar(sign); p.axisL.set(p.axisF.z, 0, -p.axisF.x);
    p.speed = 20 * sign; p.vVel = v.y;
    assert.equal(p.resolveBailWallImpact(0, 1), true);
    const out = p.axisF.clone().multiplyScalar(p.speed).setY(p.vVel), into = -v.dot(n);
    assert.ok(out.lengthSq() < v.lengthSq(), 'wall added translational energy');
    assert.ok(Math.abs(out.dot(n) - into * .34) < 1e-8, 'normal did not rebound');
    assert.ok(Math.abs(out.x - v.x * .86) < 1e-8, 'glancing tangent was erased');
    const contacts = p.ragdollWallImpactCount;
    p.resolveBailWallImpact(0, 1);
    assert.equal(p.ragdollWallImpactCount, contacts, 'separating contact repeated its impulse');
  }
  // Redirecting travel alone must preserve world angular momentum even when
  // the input axes have opposite handedness or speed is represented signed.
  for (const handedness of [-1, 1]) for (const sign of [-1, 1]) for (const forwardTrip of [false, true]) {
    p.ragForwardTrip = forwardTrip; p.speed = 8 * sign;
    p.axisF.set(0, 0, -1); p.axisL.set(handedness, 0, 0); p.ragAngVel.set(4, 2, 1);
    const original = p.ragdollWorldSpin(new THREE.Vector3()).clone();
    p.redirectBailVelocity(new THREE.Vector3(4, -3, 6));
    assert.ok(p.ragdollWorldSpin(new THREE.Vector3()).distanceTo(original) < 1e-9, 'rebound reversed angular momentum');
  }
  console.log(JSON.stringify({ passed: true, cases: rows }, null, 2));
});
