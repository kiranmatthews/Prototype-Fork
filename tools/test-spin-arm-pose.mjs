import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ player, THREE, server }) => {
  const { withSpinArmPose, SPIN_ELBOW_BEND_DEGREES } = await server.ssrLoadModule('/src/spin-effects/armPose.ts');
  const { disposeSpinModel } = await server.ssrLoadModule('/src/spin-effects/smear.ts');
  const joints = [];
  player.group.traverse(object => { if (object.isBone) joints.push(object); });
  const snapshot = () => joints.map(joint => ({
    position: joint.position.toArray(), quaternion: joint.quaternion.toArray(), scale: joint.scale.toArray(),
  }));
  for (const proportions of [{}, { shoulderWidth: 1.3, upperArmLength: 1.25, forearmLength: .8, upperArmRestAngle: 40 }]) {
    player.setCharacterProportions(proportions);
    player.bodyGroup.rotation.set(.15, .6, -.12);
    const chest = player.riderG.getObjectByName('chest');
    chest.rotation.set(.15, -.2, .1);
    for (const side of ['left', 'right']) {
      player.riderG.getObjectByName(`shoulder-${side}`).rotation.set(.8, -.1, -.6);
      player.riderG.getObjectByName(`elbow-${side}`).rotation.set(1.2, .2, .1);
    }
    const before = snapshot();
    const source = player.captureSpinSmearSource();
    assert.deepEqual(snapshot(), before, 'capturing the spin pose changed the live animation or proportions');
    assert.equal(source.userData.spinPoseRevision, 2);
    const landmarks = source.userData.spinArmPose.landmarks;
    for (const [side, sign] of [['left', 1], ['right', -1]]) {
      const shoulder = new THREE.Vector3(...landmarks[`shoulder-${side}`]);
      const elbow = new THREE.Vector3(...landmarks[`elbow-${side}`]);
      const wrist = new THREE.Vector3(...landmarks[`wrist-${side}`]);
      const upper = elbow.clone().sub(shoulder).normalize(), lower = wrist.clone().sub(elbow).normalize();
      assert.ok(Math.abs(upper.y) < 1e-5 && upper.x * sign > .9999, `${side} upper arm is not in a horizontal T-pose`);
      const bend = THREE.MathUtils.radToDeg(upper.angleTo(lower));
      assert.ok(Math.abs(bend - SPIN_ELBOW_BEND_DEGREES) < .5, `${side} elbow bend was ${bend} degrees`);
    }
    disposeSpinModel(source);
    const raw = player.captureSpinSmearSource(false);
    assert.equal(raw.userData.spinPoseRevision, undefined, 'the current-character preview was forced into the spin pose');
    disposeSpinModel(raw);
    assert.throws(() => withSpinArmPose(player.riderG, player.bodyGroup, () => { throw Error('capture interrupted'); }), /capture interrupted/);
    assert.deepEqual(snapshot(), before, 'an interrupted bake failed to restore the live rig');
  }
  console.log('PASS real character T-pose, 12-degree elbows, custom proportions/tilted chest, unchanged live joint transforms and interrupted-capture restoration');
});
