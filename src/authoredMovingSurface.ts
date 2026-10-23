import * as THREE from 'three';
import type { CustomComponent } from './level';

/** Moving solids use the same metre-space mesh data as static surfaces. The
 * origin remains the native slab centre, so motion, respawn and rider deltas
 * keep their existing semantics. Render and ground queries share this mesh. */
export function authoredMovingGeometry(c: CustomComponent): THREE.BufferGeometry | undefined {
  if (!c.vertices) return undefined;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(c.vertices, 3));
  if (c.indices) g.setIndex(c.indices);
  if (c.normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(c.normals, 3));
  else g.computeVertexNormals();
  if (c.uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(c.uvs, 2));
  if (c.colors) g.setAttribute('color', new THREE.Float32BufferAttribute(c.colors, 3));
  if (c.grindTopTriangles !== undefined) g.userData.grindIndices = Array.from(
    { length: c.grindTopTriangles * 3 }, (_, i) => g.index ? g.index.getX(i) : i);
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
