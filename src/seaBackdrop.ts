import * as THREE from 'three';

export const SEA_BACKDROP_RADIUS = 4096;
export const SEA_BACKDROP_SEGMENTS = 96;
const ring = new Float32Array((SEA_BACKDROP_SEGMENTS + 1) * 3);
for (let i = 0; i <= SEA_BACKDROP_SEGMENTS; i++) {
  const phi = i / SEA_BACKDROP_SEGMENTS * Math.PI * 2;
  ring[i * 3] = -Math.cos(phi); ring[i * 3 + 2] = Math.sin(phi);
}
export const SEA_SKY_ART = {
  clouds: 'sky-sea/day.png', day: 'sky-sea/day.png', coast: 'sky-sea/day.png',
  sunset: 'sky-sea/sunset.png', night: 'sky-sea/night.png',
} as const;
// Generated source art has an unused footer. The actual texture ends on the
// last island row, before the footer; no painted water/padding reaches the GPU.
export const SEA_SKY_CONTENT_FRACTION = 866 / 887;

/** Keep inspection cameras inside the dome too. Primary and mirrored cameras
 * choose exactly the same radius because their sea-relative heights match. */
export function seaBackdropRadius(cameraY: number, seaLevel: number, camera?: THREE.Camera): number {
  const ortho = camera as THREE.OrthographicCamera | undefined;
  const extent = ortho?.isOrthographicCamera ? Math.max(Math.abs(ortho.left), Math.abs(ortho.right),
    Math.abs(ortho.top), Math.abs(ortho.bottom)) / ortho.zoom : 0;
  return Math.max(SEA_BACKDROP_RADIUS, Math.abs(cameraY - seaLevel) * 2 + extent * 2);
}

/** A real upper hemisphere. Its entire cut edge is exactly local Y=0.
 * Global spherical UVs retain the original non-ocean texture convention. */
export function createSeaSkyGeometry(): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, SEA_BACKDROP_SEGMENTS, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i)) < 1e-6) {
      const j = (i % (SEA_BACKDROP_SEGMENTS + 1)) * 3;
      position.setXYZ(i, ring[j], 0, ring[j + 2]);
    }
    uv.setY(i, 0.5 + uv.getY(i) * 0.5);
  }
  geometry.computeBoundingSphere();
  return geometry;
}

/** Copy the exact Float32 edge used by the sky. Both draws use the identical
 * model/view/projection transform, so the rasterizer shares their cut edge. */
export function createSeaDiskGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ring.length + 3); positions.set(ring, 3);
  const indices: number[] = [];
  for (let i = 0; i < SEA_BACKDROP_SEGMENTS; i++) indices.push(0, i + 1, i + 2);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}
