import * as THREE from 'three';

export const SPIN_ELBOW_BEND_DEGREES = 12;

/** Pose only the arm chains for surface capture, then restore the live rig.
 * Segment lengths, proportions and every non-arm joint remain authored. */
export function withSpinArmPose<T>(
  rider: THREE.Object3D,
  reference: THREE.Object3D,
  capture: () => T,
  refreshHands: () => void = () => {},
): T {
  const states: Array<{ joint: THREE.Object3D; quaternion: THREE.Quaternion }> = [];
  reference.updateWorldMatrix(true, true);
  try {
    for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
      const shoulder = rider.getObjectByName(`shoulder-${side}`);
      const elbow = rider.getObjectByName(`elbow-${side}`);
      const wrist = rider.getObjectByName(`wrist-${side}`);
      if (!shoulder?.parent || !elbow || !wrist) throw new Error(`Missing ${side} spin arm chain.`);
      for (const joint of [shoulder, elbow, wrist]) states.push({ joint, quaternion: joint.quaternion.clone() });
      // Solve lateral extension in the body frame even when its chest or
      // clavicle is tilted. The authored elbow offset defines the arm axis.
      const lateral = new THREE.Vector3(sign, 0, 0).transformDirection(reference.matrixWorld)
        .transformDirection(shoulder.parent.matrixWorld.clone().invert());
      const axis = elbow.position.clone().multiply(shoulder.scale).normalize();
      shoulder.quaternion.setFromUnitVectors(axis, lateral);
      elbow.rotation.set(-THREE.MathUtils.degToRad(SPIN_ELBOW_BEND_DEGREES), 0, 0);
      wrist.quaternion.identity();
    }
    reference.updateWorldMatrix(true, true);
    refreshHands();
    reference.updateMatrixWorld(true); // refresh attached skins' bind inverses
    return capture();
  } finally {
    for (const { joint, quaternion } of states) joint.quaternion.copy(quaternion);
    reference.updateWorldMatrix(true, true);
    refreshHands();
    reference.updateMatrixWorld(true);
    rider.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.update(); });
  }
}
