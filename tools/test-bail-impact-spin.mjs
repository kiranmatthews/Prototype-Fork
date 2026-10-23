import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';
const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true} });
try {
  const { resolveBailImpactSpin: hit } = await server.ssrLoadModule('/src/character/bailImpactSpin.ts');
  const normal = new THREE.Vector3(0, 1, 0), contact = new THREE.Vector3(0, -.5, 0);
  const travel = new THREE.Vector3(0, -10, -5), impulse = new THREE.Vector3(0, 14.2, 0);
  const pose = new THREE.Quaternion(), spin = new THREE.Vector3(-10, 6, 0), initial = spin.clone();
  hit(spin, travel, impulse, normal, contact, pose, 1);
  assert.ok(spin.distanceTo(initial) < 1e-12, 'a rolling contact with no slip lost unrelated spin');
  const carriedRoll = spin.toArray();
  impulse.z = 1.4; hit(spin, travel, impulse, normal, contact, pose, 1);
  assert.ok(spin.x < -8 && spin.x > -10 && spin.y === 6, 'friction did not target the actual slipping roll');
  const frictionRoll = spin.toArray();
  const arms = [];
  for (const side of [-1, 1]) {
    spin.set(0, 0, 0); contact.set(side * .55, -.4, 0);
    hit(spin, travel.set(0, -10, 0), impulse.set(0, 14.2, 0), normal, contact, pose, 1);
    assert.ok(spin.z * side > 2, 'opposite bracing arms failed to redirect the roll'); arms.push(spin.toArray());
  }
  contact.set(.5, -.5, 0); spin.set(0, 0, 10);
  hit(spin, travel.set(0, -3, 0), impulse.set(0, 4.2, 0), normal, contact, pose, 1);
  assert.deepEqual(spin.toArray(), [0, 0, 10], 'already separating contact received another kick');
  spin.set(3, 6, -2); initial.copy(spin); contact.set(0, 0, 0);
  hit(spin, travel.set(0, -10, -5), impulse.set(0, 14.2, 1.4), normal, contact, pose, 1);
  assert.ok(spin.equals(initial), 'centre hit invented torque or a blanket brake');
  hit(spin, travel, impulse, normal, contact, pose, 0);
  assert.ok(spin.equals(initial), 'zero spin tuning generated a contact turn');

  // Arbitrary world rotations, asymmetric body poses, impact strengths and
  // levers must preserve the response and the combined energy budget.
  const rotated = new THREE.Vector3(), worldTurn = new THREE.Quaternion(), turnedPose = new THREE.Quaternion();
  const turnedV = new THREE.Vector3(), turnedJ = new THREE.Vector3(), turnedN = new THREE.Vector3(), turnedR = new THREE.Vector3();
  const local = new THREE.Vector3(), inverse = new THREE.Quaternion();
  const angularEnergy = (w, q, strength) => {
    local.copy(w).applyQuaternion(inverse.copy(q).invert());
    return (local.x ** 2 / 1.9 + local.y ** 2 / 3.4 + local.z ** 2 / 1.6) / strength;
  };
  let maxRotationError = 0, maxEnergyGain = 0, maxSpin = 0;
  for (let i = 0; i < 2400; i++) {
    const strength = .15 + (i % 19) * .15, restitution = (i % 9) * .1;
    pose.setFromEuler(new THREE.Euler(i * .173, i * .31, i * -.119));
    worldTurn.setFromEuler(new THREE.Euler(i * .29, i * .17, i * .07)); turnedPose.copy(worldTurn).multiply(pose);
    normal.set(Math.sin(i), .2 + Math.abs(Math.cos(i * .7)), Math.cos(i)).normalize();
    contact.set(Math.sin(i * .7) * .6, -.3 - (i % 4) * .1, Math.cos(i * .21) * .4);
    travel.set(Math.sin(i * .3) * 20, Math.cos(i * .4) * 8, Math.cos(i * .13) * 17);
    travel.addScaledVector(normal, -travel.dot(normal) - 1 - (i % 24));
    const into = -travel.dot(normal);
    impulse.copy(travel).addScaledVector(normal, into).multiplyScalar(.72).addScaledVector(normal, into * restitution).sub(travel);
    spin.set(Math.sin(i * .19) * 9, Math.cos(i * .23) * 7, Math.sin(i * .43) * 8); initial.copy(spin);
    rotated.copy(spin).applyQuaternion(worldTurn); turnedV.copy(travel).applyQuaternion(worldTurn);
    turnedJ.copy(impulse).applyQuaternion(worldTurn); turnedN.copy(normal).applyQuaternion(worldTurn); turnedR.copy(contact).applyQuaternion(worldTurn);
    const before = angularEnergy(spin, pose, strength) + travel.lengthSq();
    const saved = [travel.toArray(), impulse.toArray(), normal.toArray(), contact.toArray(), pose.toArray()];
    hit(spin, travel, impulse, normal, contact, pose, strength);
    hit(rotated, turnedV, turnedJ, turnedN, turnedR, turnedPose, strength);
    maxRotationError = Math.max(maxRotationError, rotated.distanceTo(initial.copy(spin).applyQuaternion(worldTurn)));
    maxEnergyGain = Math.max(maxEnergyGain, angularEnergy(spin, pose, strength) + turnedV.copy(travel).add(impulse).lengthSq() - before);
    maxSpin = Math.max(maxSpin, spin.length());
    assert.ok(spin.toArray().every(Number.isFinite) && spin.length() <= 16.000001);
    assert.deepEqual([travel.toArray(), impulse.toArray(), normal.toArray(), contact.toArray(), pose.toArray()], saved,
      'contact response mutated gameplay input or pose');
  }
  assert.ok(maxRotationError < 1e-10, 'response changed with course/world orientation');
  assert.ok(maxEnergyGain < 1e-8, 'impact spent more energy than the rebound released');
  const result = { passed:true, cases:2400, carriedRoll, frictionRoll, oppositeArms:arms, maxRotationError, maxEnergyGain, maxSpin };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally { await server.close(); }
