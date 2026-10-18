import * as THREE from 'three';

/** Repair unusable imported normals without resmoothing authored surfaces.
 * Opposing faces can cancel at shared vertices, so retain the largest incident
 * face as a fallback for a zero area-weighted sum. Positions and UVs stay intact. */
export function repairSceneryNormals(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal');
  if (!positions || !normals) return 0;
  const invalid = new Map<number, { sum: THREE.Vector3; face: THREE.Vector3; area: number }>();
  for (let i = 0; i < normals.count; i++) {
    const length = normals.getX(i) ** 2 + normals.getY(i) ** 2 + normals.getZ(i) ** 2;
    if (!Number.isFinite(length) || length < 1e-12)
      invalid.set(i, { sum: new THREE.Vector3(), face: new THREE.Vector3(0, 1, 0), area: 0 });
  }
  if (!invalid.size) return 0;
  const index = geometry.index, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
    if (!invalid.has(ia) && !invalid.has(ib) && !invalid.has(ic)) continue;
    a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
    b.sub(a); c.sub(a); b.cross(c);
    const area = b.lengthSq();
    if (!Number.isFinite(area) || area === 0) continue;
    for (const vertex of [ia, ib, ic]) {
      const entry = invalid.get(vertex);
      if (!entry) continue;
      entry.sum.add(b);
      if (area > entry.area) { entry.area = area; entry.face.copy(b); }
    }
  }
  for (const [vertex, entry] of invalid) {
    const length = entry.sum.lengthSq();
    const normal = Number.isFinite(length) && length > entry.area * 1e-12 ? entry.sum : entry.face;
    normal.normalize(); normals.setXYZ(vertex, normal.x, normal.y, normal.z);
  }
  normals.needsUpdate = true;
  return invalid.size;
}
