import { Quaternion, Vector3 } from 'three';

const inverse = new Quaternion();
const rotation = new Vector3(), lever = new Vector3(), normalLocal = new Vector3();
const velocity = new Vector3(), change = new Vector3(), cross = new Vector3(), tangent = new Vector3();

/** One intact-body impact. Translation remains owned by the movement
 * controller; its lost kinetic energy bounds the angular response. Resolve
 * normal and friction impulses at the posed contact instead of braking every
 * spin axis alike. Inputs/outputs are world-space, with a unit orientation and
 * normal. Scratch storage is shared; there are no per-contact allocations. */
export function resolveBailImpactSpin(spin: Vector3, travel: Vector3, impulse: Vector3,
  normal: Vector3, contact: Vector3, orientation: Quaternion, strength: number): void {
  const amount = Math.max(0, Math.min(3, strength));
  if (amount === 0) return;
  inverse.copy(orientation).invert();
  rotation.copy(spin).applyQuaternion(inverse);
  lever.copy(contact).applyQuaternion(inverse);
  normalLocal.copy(normal).applyQuaternion(inverse);
  velocity.copy(travel).applyQuaternion(inverse);
  change.copy(impulse).applyQuaternion(inverse);
  // A long body turns more freely around its length than end over end.
  // The tensor follows the tumble, not the course's input/camera axes.
  const ix = 1.9 * amount, iy = 3.4 * amount, iz = 1.6 * amount;
  const wx = rotation.x, wy = rotation.y, wz = rotation.z;
  const into = -velocity.dot(normalLocal);
  const normalChange = Math.max(0, change.dot(normalLocal));
  if (into <= 0 || normalChange === 0) return;
  const restitution = Math.max(0, Math.min(.8, normalChange / into - 1));
  cross.crossVectors(lever, normalLocal);
  const contactInto = into - rotation.dot(cross);
  // A foot that is already swinging away does not receive another kick just
  // because the controller's centre crossed its support plane this tick.
  if (contactInto <= 0) return;
  const mass = 1 + ix * cross.x * cross.x + iy * cross.y * cross.y + iz * cross.z * cross.z;
  const normalImpulse = (1 + restitution) * contactInto / mass;
  rotation.x += ix * cross.x * normalImpulse;
  rotation.y += iy * cross.y * normalImpulse;
  rotation.z += iz * cross.z * normalImpulse;

  const beforeLinear = velocity.lengthSq();
  velocity.add(change);
  const releasedEnergy = Math.max(0, beforeLinear - velocity.lengthSq());
  tangent.crossVectors(rotation, lever).add(velocity);
  tangent.addScaledVector(normalLocal, -tangent.dot(normalLocal));
  const slip = tangent.length();
  if (slip > 1e-8) {
    tangent.multiplyScalar(1 / slip);
    cross.crossVectors(lever, tangent);
    const tangentMass = 1 + ix * cross.x * cross.x + iy * cross.y * cross.y + iz * cross.z * cross.z;
    const frictionImpulse = Math.min(normalImpulse * .45, slip / tangentMass);
    rotation.x -= ix * cross.x * frictionImpulse;
    rotation.y -= iy * cross.y * frictionImpulse;
    rotation.z -= iz * cross.z * frictionImpulse;
  }

  // Keep the controller/secondary-body split honest: rotational gain cannot
  // spend more energy than the authored rebound actually removed from travel.
  // Scale the impulse (not the existing spin) when that budget is exhausted.
  const beforeAngular = wx * wx / ix + wy * wy / iy + wz * wz / iz;
  const afterAngular = rotation.x * rotation.x / ix + rotation.y * rotation.y / iy + rotation.z * rotation.z / iz;
  const budget = releasedEnergy * .85;
  if (afterAngular > beforeAngular + budget) {
    const dx = rotation.x - wx, dy = rotation.y - wy, dz = rotation.z - wz;
    const a = dx * dx / ix + dy * dy / iy + dz * dz / iz;
    const b = wx * dx / ix + wy * dy / iy + wz * dz / iz;
    const fraction = a > 1e-12 ? Math.max(0, Math.min(1, (Math.sqrt(b * b + a * budget) - b) / a)) : 0;
    rotation.set(wx + dx * fraction, wy + dy * fraction, wz + dz * fraction);
  }
  spin.copy(rotation).applyQuaternion(orientation).clampLength(0, 16);
}
