// Closely spaced contacts must keep their own arrival times. Compare the
// production rig with the sum of two isolated responses while the springs
// are linear, then stress the real bounded springs through a long settle.
import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server }) => {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), normal = new THREE.Vector3(.6, .8, 0);
  const fresh = (linear = false) => {
    const motion = new BailMotion(); motion.begin('air', zero, 414);
    if (linear) {
      motion.angles.fill(0); motion.velocity.fill(0); motion.bias.fill(0);
      motion.stiffness.fill(0); motion.damping.fill(0);
      motion.strain.fill(0); motion.strainVelocity.fill(0);
    }
    return motion;
  };
  const rows = [];
  let instantaneousBrake = 0, angularError = 0, strainError = 0;
  for (const dt of [1 / 60, 1 / 120, 1 / 240])
    for (const gap of [1 / 60, 3 / 60, 5 / 60])
      for (const [firstJoint, secondJoint] of [[7, 13], [13, 7], [4, 10], [0, 1]]) {
        const both = fresh(true), first = fresh(true), second = fresh(true);
        both.impact(1.5, normal, undefined, firstJoint);
        first.impact(1.5, normal, undefined, firstJoint);
        // Isolate the same second impulse, including its cosmetic random draws.
        second.seed = both.seed;
        let maxAngular = 0, maxStrain = 0, brake = 0;
        for (let frame = 0; frame < Math.round(.25 / dt); frame++) {
          if (frame === Math.round(gap / dt)) {
            const carried = [...both.velocity];
            both.impact(1.8, normal, undefined, secondJoint);
            second.impact(1.8, normal, undefined, secondJoint);
            brake = Math.max(...both.velocity.map((value, i) => Math.abs(value - carried[i])));
          }
          for (const motion of [both, first, second]) motion.step(dt, q, zero, false, 0, 0, 1);
          for (let i = 0; i < both.velocity.length; i++)
            maxAngular = Math.max(maxAngular, Math.abs(both.velocity[i] - first.velocity[i] - second.velocity[i]));
          for (let i = 0; i < both.strain.length; i++)
            maxStrain = Math.max(maxStrain, Math.abs(both.strain[i] - first.strain[i] - second.strain[i]));
        }
        instantaneousBrake = Math.max(instantaneousBrake, brake);
        angularError = Math.max(angularError, maxAngular); strainError = Math.max(strainError, maxStrain);
        rows.push({ dt, gap, firstJoint, secondJoint, brake, maxAngular, maxStrain });
      }
  console.log(JSON.stringify({ cases: rows.length, instantaneousBrake, angularError, strainError }));
  assert.equal(instantaneousBrake, 0, 'a new contact instantly braked an already moving limb');
  assert.ok(angularError < 1e-10, 'a new contact erased or rescheduled an earlier angular wave');
  assert.ok(strainError < 1e-10, 'a new contact rescheduled an earlier compression wave');

  // Real stiffness, anatomical limits, arbitrary frame sizes and many ring
  // wraps: contacts stay bounded and expire without per-contact allocations.
  let maxAngle = 0, maxVelocity = 0, minLength = 1, maxLength = 1, maxSettle = 0, retainedBytes = 0;
  for (const dt of [1 / 60, 1 / 120, 1 / 144, 1 / 240, 1 / 15]) {
    const motion = fresh(), buffers = Object.values(motion).filter(value => ArrayBuffer.isView(value));
    const bytes = buffers.reduce((n, value) => n + value.byteLength, 0);
    retainedBytes = Math.max(retainedBytes, bytes);
    for (let frame = 0; frame < Math.ceil(12 / dt); frame++) {
      if (frame * dt < 3) {
        // Two nearby hits per frame intentionally exceed ordinary gameplay.
        motion.impact(40, normal, undefined, frame % 14);
        motion.impact(25, normal, undefined, (frame * 5 + 7) % 14);
      }
      motion.step(dt, q, zero, true, 0, 0, 1);
      maxAngle = Math.max(maxAngle, ...motion.angles.map(Math.abs));
      maxVelocity = Math.max(maxVelocity, ...motion.velocity.map(Math.abs));
      for (const value of Object.values(motion.deformations)) {
        assert.ok(Number.isFinite(value) && value > .65 && value < 1.35);
        minLength = Math.min(minLength, value); maxLength = Math.max(maxLength, value);
      }
    }
    const current = Object.values(motion).filter(value => ArrayBuffer.isView(value));
    assert.deepEqual(current.map(value => value.byteLength), buffers.map(value => value.byteLength));
    assert.ok(current.every((value, i) => value === buffers[i]), 'contact storage grew or replaced a buffer');
    assert.equal(current.reduce((n, value) => n + value.byteLength, 0), bytes);
    const settle = Math.max(...motion.velocity.map(Math.abs), ...motion.strain.map(Math.abs));
    maxSettle = Math.max(maxSettle, settle);
    assert.ok(settle < 1e-6, 'pending impulses did not finish settling');
    motion.impact(30, normal, undefined, 13); motion.reset(); motion.begin('air', zero, 414);
    const control = fresh();
    for (let frame = 0; frame < 60; frame++) {
      for (const m of [motion, control]) m.step(dt, q, zero, false, 0, 0, 1);
      assert.deepEqual(motion.angles, control.angles, 'old contact escaped reset');
      assert.deepEqual(motion.deformations, control.deformations);
    }
  }
  assert.ok(maxAngle <= 1.8 && maxVelocity <= 22, 'repeated impacts escaped joint bounds');
  console.log(JSON.stringify({ passed: true, overlapCases: rows.length, angularError, strainError,
    stress: { rates: [60, 120, 144, 240, 15], maxAngle, maxVelocity, minLength, maxLength, maxSettle,
      retainedTypedArrayBytes: retainedBytes, buffersReused: true } }, null, 2));
});
