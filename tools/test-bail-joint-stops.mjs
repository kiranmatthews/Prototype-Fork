import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true} });
try {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0);
  const make = seed => { const motion = new BailMotion(); motion.begin('air', zero, seed); return motion; };
  const joints = [3, 6, 9, 12], node = new THREE.Object3D();
  let poses = 0, frames = 0, maxHiddenAngle = 0, maxVelocity = 0;
  for (const joint of joints) for (let pose = 0; pose < 60; pose++) {
    const motion = make(143 + pose), elbow = joint === 3 || joint === 6;
    const authored = elbow ? -.08 - (pose % 17) * .12 : .06 + (pose % 17) * .12;
    const weight = .08 + (pose % 20) * .1, min = elbow ? -2.35 : .03, max = elbow ? -.05 : 2.45;
    for (let frame = 0; frame < 180; frame++) {
      const base = Math.max(min + .01, Math.min(max - .01, authored + Math.sin(frame * .09) * .045));
      const blend = weight * (.8 + .2 * Math.cos(frame * .07));
      node.rotation.set(base, .1, -.2);
      motion.prepareHinge(joint, node, blend);
      if (frame < 80 && frame % 13 === 0) motion.impact(18, normal, undefined, joint);
      motion.step(1 / 60, q, zero, frame > 80, 0, 0, weight);
      const intended = base + motion.angles[joint * 3] * blend;
      motion.apply(joint, node, blend);
      maxHiddenAngle = Math.max(maxHiddenAngle, Math.abs(intended - node.rotation.x));
      maxVelocity = Math.max(maxVelocity, Math.abs(motion.velocity[joint * 3]));
      assert.ok(node.rotation.x >= min - 1e-12 && node.rotation.x <= max + 1e-12, 'anatomical stop escaped');
      assert.ok(Math.abs(intended - node.rotation.x) < 1e-10, 'spring kept bending invisibly behind a displayed stop');
      assert.ok([...motion.angles, ...motion.velocity, ...Object.values(motion.deformations)].every(Number.isFinite));
      motion.restore(); assert.ok(Math.abs(node.rotation.x - base) < 1e-12, 'constraint replaced the authored base pose');
      frames++;
    }
    poses++;
  }
  // The knee was pushed straight by a hit and is now moving back inward.
  // Correct spring space releases on this frame, rather than waiting for an
  // impossible hidden backwards bend to unwind behind the visual clamp.
  const constrained = make(8), hidden = make(8); let release = null, hiddenRelease = null;
  for (const motion of [constrained, hidden]) {
    motion.angles.fill(0); motion.velocity.fill(0); motion.bias.fill(0);
    motion.angles[27] = -.7; motion.velocity[27] = 2; motion.bias[27] = .6;
  }
  for (let frame = 0; frame < 60; frame++) for (const [motion, useStop] of [[constrained, true], [hidden, false]]) {
    node.rotation.set(.03, 0, 0);
    if (useStop) motion.prepareHinge(9, node, 1);
    motion.step(1 / 60, q, zero, false, 0, 0, 1); motion.apply(9, node, 1);
    if (node.rotation.x > .04) {
      if (useStop && release === null) release = (frame + 1) / 60;
      if (!useStop && hiddenRelease === null) hiddenRelease = (frame + 1) / 60;
    }
    motion.restore();
  }
  assert.ok(release <= 1 / 60 && hiddenRelease > release + .05, 'inward motion remained trapped behind the stop');
  const a = make(19), b = make(19);
  let subdivisionError = 0;
  for (let frame = 0; frame < 240; frame++) {
    if (frame % 17 === 0 && frame < 100) for (const motion of [a, b]) motion.impact(15, normal, undefined, 9);
    node.rotation.set(.08, 0, 0);
    a.prepareHinge(9, node, .7); b.prepareHinge(9, node, .7);
    a.step(1 / 60, q, zero, false, 0, 0, 1);
    b.step(1 / 120, q, zero, false, 0, 0, 1); b.step(1 / 120, q, zero, false, 0, 0, 1);
    subdivisionError = Math.max(subdivisionError, ...a.angles.map((v, i) => Math.abs(v - b.angles[i])));
  }
  assert.ok(subdivisionError < 1e-9, 'hinge response changed with frame subdivision');
  a.reset(); a.begin('air', zero, 19); const fresh = make(19);
  for (const motion of [a, fresh]) motion.step(1 / 60, q, zero, false, 0, 0, 1);
  assert.deepEqual(a.angles, fresh.angles, 'old anatomical interval leaked into a fresh bail');
  // An invalid edited base or a disabled modifier must not create reversed
  // bounds, infinities or huge spring displacements.
  for (const base of [-6, 6]) for (const weight of [0, 1e-8, 1]) {
    node.rotation.set(base, 0, 0); a.prepareHinge(9, node, weight);
    a.step(1 / 60, q, zero, false, 0, 0, 1); a.apply(9, node, weight);
    assert.ok([...a.angles, ...a.velocity, ...node.quaternion.toArray()].every(Number.isFinite)); a.restore();
  }
  const result = { passed:true, poses, frames, maxHiddenAngle, maxVelocity, releaseSeconds:release,
    unpreparedReleaseSeconds:hiddenRelease, subdivisionError, changingBaseAndBlend:true, resetAndEditedBase:true };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
