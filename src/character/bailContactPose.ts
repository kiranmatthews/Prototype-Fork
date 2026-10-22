import { Matrix3, Quaternion, Vector3, type Object3D } from 'three';

export interface BailContactPose {
  readonly joints: readonly (Object3D | null)[];
  readonly point: Vector3;
  readonly impulse: Vector3;
}

const inverseParent = new Matrix3();
const lever = new Vector3(), force = new Vector3(), torque = new Vector3(), axis = new Vector3();
const rotation = new Quaternion(), turn = new Quaternion();
const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];

/** Generalized impact torque in the joint's actual Euler coordinates. Read
 * the already-posed matrices; never update the hierarchy or reskin a mesh.
 * Inverse-transform the lever and transpose-transform the force so their
 * virtual work remains correct under scaled, mirrored or sheared parents. */
export function sampleBailJointTorque(node: Object3D, point: Vector3, impulse: Vector3,
  output: Float64Array, offset: number): void {
  const world = node.matrixWorld.elements;
  lever.set(point.x - world[12], point.y - world[13], point.z - world[14]);
  if (node.parent) {
    const parent = node.parent.matrixWorld.elements;
    inverseParent.setFromMatrix4(node.parent.matrixWorld).invert();
    lever.applyMatrix3(inverseParent);
    force.set(parent[0] * impulse.x + parent[1] * impulse.y + parent[2] * impulse.z,
      parent[4] * impulse.x + parent[5] * impulse.y + parent[6] * impulse.z,
      parent[8] * impulse.x + parent[9] * impulse.y + parent[10] * impulse.z);
  } else force.copy(impulse);
  torque.crossVectors(lever, force);
  rotation.identity();
  for (let i = 0; i < 3; i++) {
    const component = node.rotation.order[i] === 'X' ? 0 : node.rotation.order[i] === 'Y' ? 1 : 2;
    axis.copy(axes[component]).applyQuaternion(rotation);
    output[offset + component] = torque.dot(axis);
    const angle = component === 0 ? node.rotation.x : component === 1 ? node.rotation.y : node.rotation.z;
    rotation.multiply(turn.setFromAxisAngle(axes[component], angle));
  }
}
