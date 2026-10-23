import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { stepBailGroundSpin } = await server.ssrLoadModule('/src/character/bailGroundContact.ts');
  const normal = new THREE.Vector3(0, 1, 0), travel = new THREE.Vector3(0, 0, -10);
  const left = new THREE.Vector3(.5, -.5, .2), right = left.clone().setX(-.5);
  const spin = new THREE.Vector3(), other = new THREE.Vector3();
  stepBailGroundSpin(spin, travel, normal, left, 1 / 60, 14, 1);
  stepBailGroundSpin(other, travel, normal, right, 1 / 60, 14, 1);
  assert.ok(spin.x < -.1 && other.x < -.1, 'contact friction did not turn the skid into a roll');
  assert.ok(spin.y < -.1 && other.y > .1, 'opposite contact levers produced the same yaw');
  const contactSteering = { left: spin.toArray(), right: other.toArray() };
  const beforeTravel = travel.clone(), beforeContact = left.clone();
  // A body already rolling at the contact's speed must carry through smoothly.
  spin.set(-10, 0, 0); const foot = new THREE.Vector3(0, -.5, 0);
  stepBailGroundSpin(spin, new THREE.Vector3(0, 0, -5), normal, foot, 1 / 60, 14, 1);
  assert.ok(spin.x < -9.5 && spin.x > -10, 'a supported roll snapped to a generic target');
  assert.ok(travel.equals(beforeTravel) && left.equals(beforeContact), 'cosmetic spin modified gameplay inputs');
  // Rotating the whole scene (including its support plane) must rotate the
  // response exactly; neither camera heading nor a world-up assumption may leak in.
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(.55, 1.3, -.28));
  spin.set(5, -4, 3); other.copy(spin).applyQuaternion(rotation);
  const rotatedTravel = travel.clone().applyQuaternion(rotation), rotatedNormal = normal.clone().applyQuaternion(rotation);
  const rotatedContact = left.clone().applyQuaternion(rotation);
  let frameError = 0;
  for (let i = 0; i < 120; i++) {
    stepBailGroundSpin(spin, travel, normal, left, 1 / 60, 14, 1);
    stepBailGroundSpin(other, rotatedTravel, rotatedNormal, rotatedContact, 1 / 60, 14, 1);
    frameError = Math.max(frameError, spin.clone().applyQuaternion(rotation).distanceTo(other));
  }
  assert.ok(frameError < 1e-10, 'ground response changed with scene orientation');
  spin.set(5, 8, -4); other.copy(spin);
  for (let i = 0; i < 120; i++) {
    stepBailGroundSpin(spin, travel, normal, left, 1 / 30, 14, 1);
    for (let substep = 0; substep < 4; substep++) stepBailGroundSpin(other, travel, normal, left, 1 / 120, 14, 1);
  }
  const subdivisionError = spin.distanceTo(other);
  assert.ok(subdivisionError < 1e-10, 'ground friction depends on frame subdivision');
  spin.set(5, 8, -4); other.copy(spin);
  stepBailGroundSpin(spin, travel, normal, left, 10, 14, 1);
  stepBailGroundSpin(other, travel, normal, left, 1 / 15, 14, 1);
  assert.ok(spin.equals(other), 'a debugger pause escaped the fixed work budget');
  // A slipping support tips toward its lever rather than holding the torso
  // upright. Gravity loads are covariant too and retain the angular cap.
  spin.set(0, 0, 0); other.set(0, 0, 0);
  for (let i = 0; i < 60; i++) {
    stepBailGroundSpin(spin, new THREE.Vector3(), normal, left, 1 / 60, 0, 1, 9.8);
    stepBailGroundSpin(other, new THREE.Vector3(), rotatedNormal, rotatedContact, 1 / 60, 0, 1, 9.8);
    assert.ok(spin.clone().applyQuaternion(rotation).distanceTo(other) < 1e-10, 'toppling load ignored support orientation');
    assert.ok(spin.length() <= 16.000001, 'toppling load escaped the angular cap');
  }
  assert.ok(spin.dot(left.clone().cross(normal)) > .1, 'support load did not topple the body');
  const zero = new THREE.Vector3(); let maximumRestGain = 0;
  for (let seed = 0; seed < 36; seed++) {
    spin.set(Math.sin(seed * .7) * 15, Math.cos(seed) * 9, Math.sin(seed) * 7);
    const contact = new THREE.Vector3(Math.sin(seed) * .6, -.25 - (seed % 3) * .2, Math.cos(seed) * .3);
    for (let i = 0; i < 600; i++) {
      const energy = spin.lengthSq();
      stepBailGroundSpin(spin, zero, normal, contact, 1 / 60, 14, 1);
      maximumRestGain = Math.max(maximumRestGain, spin.lengthSq() - energy);
      assert.ok(spin.toArray().every(Number.isFinite) && spin.length() <= 16.000001);
    }
    assert.ok(spin.length() < .0001, 'a stationary body spun forever');
  }
  assert.ok(maximumRestGain < 1e-10, 'resting friction injected angular energy');
  spin.set(0, 0, 0); stepBailGroundSpin(spin, travel, normal, left, 1, 14, 0);
  assert.equal(spin.lengthSq(), 0, 'disabled tumble tuning still generated a roll');

  const scene = new THREE.Scene(), level = new Level(scene, { id: 'ground-roll-test', name: 'Ground roll', data: {
    v: 1, name: 'Ground roll', spawn: [0, .04, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [40, 1, 40] }, { t: 'gate', p: [15, 0, -15] }],
  } });
  try {
    const p = new Player(scene), input = makeInput({ inventoryHeld: true });
    p.rawInput = input; p.respawn(level, true); p.step(CONST.fixedStep, input, level);
    p.invulnTimer = 0; p.beginPvpKnockdown(5, 1); p.syncVisual(input, CONST.fixedStep);
    p.state = 'air'; p.grounded = false; p.vVel = -10; p.speed = 8;
    p.simRand = () => { throw new Error('presentation friction consumed gameplay randomness'); };
    const actual = p.bailMotion.impact.bind(p.bailMotion); let impulses = 0;
    p.bailMotion.impact = (...args) => { impulses++; return actual(...args); };
    p.resolveRagdollGroundBounce(p.groundHit); p.syncVisual(input, CONST.fixedStep);
    assert.equal(impulses, 1, 'one real floor hit produced multiple spring impulses');
    p.vVel = -10; p.resolveRagdollGroundBounce(p.groundHit); p.syncVisual(input, CONST.fixedStep);
    assert.equal(impulses, 2, 'a second real contact was suppressed');
    p.vVel = -.3; p.resolveRagdollGroundBounce(p.groundHit); p.syncVisual(input, CONST.fixedStep);
    assert.equal(impulses, 2, 'a nearly settled contact invented a full-body thrash');
    p.ragFlailKickT = .28; p.syncVisual(input, CONST.fixedStep);
    assert.equal(impulses, 3, 'a later player flail was suppressed');
    const position = p.pos.clone(), velocity = [p.speed, p.vVel], axes = [p.axisF.clone(), p.axisL.clone()];
    p.state = 'ride'; p.grounded = true;
    for (let i = 0; i < 24; i++) p.syncVisual(input, CONST.fixedStep);
    assert.ok(position.equals(p.pos) && axes[0].equals(p.axisF) && axes[1].equals(p.axisL));
    assert.deepEqual([p.speed, p.vVel], velocity, 'cosmetic ground contact changed gameplay velocity');
    console.log(JSON.stringify({ passed: true, contactSteering, frameError, subdivisionError, maximumRestGain,
      stationaryCases: 36, actualFloorImpulses: 2, softContactImpulses: 0, playerFlailImpulses: 1, gameplayStateUnchanged: true }, null, 2));
  } finally { level.dispose(); }
});
