import * as THREE from "three";

/** Exact static-mesh triangle test used while resolving authored colliders. */
export function boxIntersectsMeshTriangles(
  box: Readonly<THREE.Box3>,
  mesh: THREE.Mesh,
): boolean {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | undefined;
  if (!positions || positions.count < 3) return false;

  mesh.updateWorldMatrix(true, false);
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  if (
    geometry.boundingBox &&
    !geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).intersectsBox(box)
  )
    return false;

  const index = geometry.getIndex();
  const triangle = new THREE.Triangle(
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  );
  const count = index?.count ?? positions.count;
  for (let offset = 0; offset + 2 < count; offset += 3) {
    const ia = index ? index.getX(offset) : offset;
    const ib = index ? index.getX(offset + 1) : offset + 1;
    const ic = index ? index.getX(offset + 2) : offset + 2;
    triangle.a.fromBufferAttribute(positions, ia).applyMatrix4(mesh.matrixWorld);
    triangle.b.fromBufferAttribute(positions, ib).applyMatrix4(mesh.matrixWorld);
    triangle.c.fromBufferAttribute(positions, ic).applyMatrix4(mesh.matrixWorld);
    if (box.intersectsTriangle(triangle)) return true;
  }
  return false;
}
