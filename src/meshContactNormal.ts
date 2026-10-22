import type { Intersection } from 'three';
import { Vector3 } from 'three';

/** Authored smooth ride normals are opt-in; architectural faces stay sharp.
 * Keep the original face orientation even when a DoubleSide ray flips the
 * interpolated normal, so a back face cannot become a rideable front. */
export function meshContactNormal(hit: Intersection): Vector3 {
  const face = hit.face!.normal;
  const normal = hit.object.userData.smoothCollision && hit.normal
    ? hit.normal.clone() : face.clone();
  if (normal.dot(face) < 0) normal.negate();
  return normal.transformDirection(hit.object.matrixWorld);
}
