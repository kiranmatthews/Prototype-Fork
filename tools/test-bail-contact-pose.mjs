// Contacts should bend the posed limb along the actual force, including a
// vertical floor impact. Check virtual work independently with finite
// differences, then exercise propagation, repeated hits and Player wiring.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { sampleBailJointTorque } = await server.ssrLoadModule('/src/character/bailContactPose.ts');
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const output = new Float64Array(5), epsilon = 1e-6;
  let samples = 0, derivativeError = 0, covarianceError = 0;
  for (const order of ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX']) for (let sample = 0; sample < 24; sample++) {
    const root = new THREE.Group(), parent = new THREE.Group(), joint = new THREE.Group();
    root.add(parent); parent.add(joint);
    root.position.set(2, -3, 1); root.rotation.set(.13 * sample, -.37, .41);
    root.scale.set(sample % 2 ? -1.4 : 1.4, .7, 1.9);
    parent.rotation.set(.21, .41, -.17 * sample); parent.scale.set(.8, 1.6, .9);
    joint.position.set(.2, -.4, .3); joint.rotation.set(.17 * sample - 1, .41, -.71, order);
    joint.scale.set(1.1, .85, 1.2); root.updateMatrixWorld(true);
    const localPoint = new THREE.Vector3(.4, -.3, .5), point = localPoint.clone().applyMatrix4(joint.matrixWorld);
    const impulse = new THREE.Vector3(1.3, 2.1, -.6), beforePoint = point.clone(), beforeImpulse = impulse.clone();
    const beforeMatrix = joint.matrixWorld.clone(), beforeEuler = joint.rotation.toArray();
    output.fill(123); sampleBailJointTorque(joint, point, impulse, output, 1);
    assert.equal(output[0], 123); assert.equal(output[4], 123);
    assert.deepEqual(point, beforePoint); assert.deepEqual(impulse, beforeImpulse);
    assert.deepEqual(joint.matrixWorld, beforeMatrix); assert.deepEqual(joint.rotation.toArray(), beforeEuler);
    const actual = output.slice(1, 4);
    for (const [axis, coordinate] of ['x', 'y', 'z'].entries()) {
      joint.rotation[coordinate] += epsilon; root.updateMatrixWorld(true);
      const plus = localPoint.clone().applyMatrix4(joint.matrixWorld);
      joint.rotation[coordinate] -= 2 * epsilon; root.updateMatrixWorld(true);
      const minus = localPoint.clone().applyMatrix4(joint.matrixWorld);
      joint.rotation[coordinate] += epsilon; root.updateMatrixWorld(true);
      const expected = plus.sub(minus).multiplyScalar(.5 / epsilon).dot(impulse);
      derivativeError = Math.max(derivativeError, Math.abs(actual[axis] - expected)); samples++;
    }
    // Rotate/translate the complete scene and force together. Generalized
    // torque in the joint's local Euler coordinates must stay the same.
    const container = new THREE.Group(), turn = new THREE.Quaternion().setFromEuler(new THREE.Euler(.5, -.9, .3));
    container.quaternion.copy(turn); container.position.set(-11, 7, 3); container.add(root); container.updateMatrixWorld(true);
    point.applyQuaternion(turn).add(container.position); impulse.applyQuaternion(turn);
    sampleBailJointTorque(joint, point, impulse, output, 1);
    for (let axis = 0; axis < 3; axis++) covarianceError = Math.max(covarianceError, Math.abs(output[1 + axis] - actual[axis]));
  }
  assert.ok(derivativeError < 1e-7, `posed contact torque disagrees with virtual work: ${derivativeError}`);
  assert.ok(covarianceError < 1e-10, 'rotating the scene changed the contact reaction');

  const parents = [14, 0, 0, 2, 3, 0, 5, 6, 14, 8, 9, 14, 11, 12];
  const root = new THREE.Group(), joints = Array.from({ length: 14 }, () => new THREE.Group());
  joints.forEach((node, i) => {
    (parents[i] === 14 ? root : joints[parents[i]]).add(node);
    node.position.set(i >= 5 && i <= 7 || i >= 11 ? .12 : -.12, i === 0 ? .7 : -.22, .13);
    node.rotation.set(.2 + i * .07, -.11, .05);
  });
  root.updateMatrixWorld(true);
  const point = new THREE.Vector3().setFromMatrixPosition(joints[7].matrixWorld).add(new THREE.Vector3(0, -.1, .04));
  const pose = { joints, point, impulse: new THREE.Vector3(0, 2, 0) };
  const fresh = () => { const motion = new BailMotion(); motion.begin('air', zero, 414); return motion; };
  const hit = fresh(), opposite = fresh(), noForce = fresh(), legacy = fresh();
  const originalBias = hit.bias.slice(), originalVelocity = hit.velocity.slice(), originalAngles = hit.angles.slice();
  hit.impact(6, up, undefined, 7, pose);
  opposite.impact(6, up, undefined, 7, { ...pose, impulse: pose.impulse.clone().negate() });
  noForce.impact(6, up, undefined, 7, { ...pose, impulse: zero });
  legacy.impact(6, up, undefined, 7);
  assert.equal(hit.seed, legacy.seed, 'contact changed cosmetic random stream consumption');
  assert.deepEqual(hit.bias, originalBias, 'contact instantly retargeted the entire pose');
  assert.deepEqual(hit.velocity, originalVelocity, 'contact instantly braked or kicked moving limbs');
  assert.deepEqual(hit.angles, originalAngles, 'contact teleported a limb');
  const chain = new Set([7, 6, 5, 0]); let loadedAxes = 0, distantChange = 0, forceReversalError = 0;
  for (const motion of [hit, opposite, noForce]) motion.advanceContactWaves(.2);
  for (let i = 0; i < hit.velocity.length; i++) {
    const change = hit.velocity[i] - noForce.velocity[i];
    forceReversalError = Math.max(forceReversalError, Math.abs(change + opposite.velocity[i] - noForce.velocity[i]));
    if (chain.has(Math.floor(i / 3))) { if (Math.abs(change) > 1e-4) loadedAxes++; }
    else distantChange = Math.max(distantChange, Math.abs(change));
  }
  assert.ok(loadedAxes >= 6, 'upward floor contact did not load its posed arm/spine');
  assert.ok(forceReversalError < 1e-12, 'contact did not follow the applied force');
  assert.equal(distantChange, 0, 'contact geometrically loaded an unrelated limb');
  const beforeBend = hit.contactTorque.slice(); joints[6].rotation.x += .8; root.updateMatrixWorld(true);
  const folded = fresh(); folded.impact(6, up, undefined, 7, pose);
  assert.ok(Math.abs(folded.contactTorque[19] - beforeBend[19]) > .005 ||
    Math.abs(folded.contactTorque[20] - beforeBend[20]) > .005, 'elbow pose did not affect its response');

  let maxAngle = 0, maxVelocity = 0, minLength = 1, maxLength = 1, maxSettle = 0, bytes = 0;
  for (const dt of [1 / 60, 1 / 120, 1 / 144, 1 / 240, 1 / 15]) {
    const motion = fresh(), buffers = Object.values(motion).filter(ArrayBuffer.isView);
    bytes = Math.max(bytes, buffers.reduce((total, value) => total + value.byteLength, 0));
    for (let frame = 0; frame < Math.ceil(12 / dt); frame++) {
      if (frame * dt < 3) {
        const joint = frame % 14;
        pose.point.setFromMatrixPosition(joints[joint].matrixWorld).add(new THREE.Vector3(.2, -.13, .1));
        pose.impulse.set(Math.sin(frame) * 40, 60, Math.cos(frame) * 40);
        motion.impact(40, up, undefined, joint, pose);
        motion.impact(25, up, undefined, (joint + 6) % 14, pose);
      }
      motion.step(dt, q, zero, true, 0, 0, 1);
      maxAngle = Math.max(maxAngle, ...motion.angles.map(Math.abs));
      maxVelocity = Math.max(maxVelocity, ...motion.velocity.map(Math.abs));
      for (const value of Object.values(motion.deformations)) {
        assert.ok(Number.isFinite(value) && value > .65 && value < 1.35);
        minLength = Math.min(minLength, value); maxLength = Math.max(maxLength, value);
      }
    }
    assert.ok(Object.values(motion).filter(ArrayBuffer.isView).every((value, i) => value === buffers[i]));
    maxSettle = Math.max(maxSettle, ...motion.velocity.map(Math.abs), ...motion.strain.map(Math.abs));
    motion.impact(30, up, undefined, 13, pose); motion.reset(); motion.begin('air', zero, 414);
    const control = fresh();
    for (let frame = 0; frame < 60; frame++) {
      for (const m of [motion, control]) m.step(dt, q, zero, false, 0, 0, 1);
      assert.deepEqual(motion.angles, control.angles); assert.deepEqual(motion.deformations, control.deformations);
    }
  }
  assert.ok(maxAngle <= 1.8 && maxVelocity <= 22, 'posed impacts escaped joint bounds');
  assert.ok(maxSettle < 1e-6, 'posed contacts never settled');
  assert.ok(bytes < 10 * 1024, 'contact numeric storage grew beyond the fixed rig budget');

  const scene = new THREE.Scene(), level = new Level(scene, { id: 'contact-pose-test', name: 'Contact pose', data: {
    v: 1, name: 'Contact pose', spawn: [0, .04, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [40, 1, 40] }, { t: 'gate', p: [15, 0, -15] }],
  } });
  try {
    const p = new Player(scene), input = makeInput({ inventoryHeld: true });
    p.rawInput = input; p.respawn(level, true); p.step(CONST.fixedStep, input, level);
    p.invulnTimer = 0; p.beginPvpKnockdown(5, 1); p.syncVisual(input, CONST.fixedStep);
    const wrist = p.wristR, desired = new THREE.Vector3(1, -5, 2);
    wrist.position.copy(wrist.parent.worldToLocal(desired.clone())); p.group.updateMatrixWorld(true);
    const expectedPoint = new THREE.Vector3().setFromMatrixPosition(wrist.matrixWorld).addScaledVector(up, -.1);
    const force = new THREE.Vector3(-2, 16, 3), unchangedForce = force.clone(), captured = [];
    const actual = p.bailMotion.impact.bind(p.bailMotion);
    p.bailMotion.impact = (...args) => { captured.push(args); return actual(...args); };
    p.simRand = () => { throw new Error('contact used gameplay RNG'); };
    p.interactionMeasure.sampledPlaneDistance = () => { throw new Error('contact reskinned support meshes'); };
    p.group.traverse(node => { node.updateMatrixWorld = () => { throw new Error('contact updated the hierarchy'); }; });
    const travelBefore = [p.speed, p.vVel, ...p.axisF.toArray(), ...p.pos.toArray()];
    p.kickRagdollContact(up, force, 12); p.kickRagdollContact(up, force, 12);
    assert.deepEqual([p.speed, p.vVel, ...p.axisF.toArray(), ...p.pos.toArray()], travelBefore);
    assert.deepEqual(force, unchangedForce);
    assert.equal(captured[0][3], 7); assert.equal(captured[0][4], captured[1][4], 'contact allocated a fresh pose record');
    assert.ok(captured[0][4].point.distanceTo(expectedPoint) < 1e-10, 'contact used the bounded waist lever as a limb point');
    assert.deepEqual(captured[0][4].impulse, force); assert.equal(captured[0][4].joints[7], wrist);
    assert.equal(captured[0][4].joints[6], p.elbowR); assert.equal(captured[0][4].joints[5], p.armR);
    console.log(JSON.stringify({ passed: true, virtualWork: { samples, derivativeError, covarianceError },
      response: { loadedAxes, forceReversalError, distantChange, preservedPoseAndRandomStream: true },
      stress: { rates: [60, 120, 144, 240, 15], maxAngle, maxVelocity, minLength, maxLength, maxSettle,
        retainedTypedArrayBytes: bytes, buffersReused: true },
      wiring: { struckJoint: 7, actualSurfacePoint: true, reusedPose: true, hierarchyUpdates: 0, skinScans: 0,
        unchangedTranslation: true, gameplayRandomDraws: 0 } }, null, 2));
  } finally { level.dispose(); }
});
