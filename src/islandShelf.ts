import * as THREE from "three";

export const UNITY_ISLAND_SHELF_PROFILE = Object.freeze({
  angularSegments: 48,
  centerHeight: 0.72,
  radiusScales: Object.freeze([0.46, 0.78, 1, 1.2] as const),
  innerHeights: Object.freeze([0.68, 0.48] as const),
  waterlineLift: 0.08,
  outerHeight: -1.12,
  broadOutlineAmount: 0.055,
  fineOutlineAmount: 0.032,
  broadHeightAmount: 0.055,
  fineHeightAmount: 0.025,
});

export interface IslandShelfOptions {
  centerY: number;
  seaLevel: number;
  phase: number;
}

/**
 * Build Unity Island Hopper's center + four radial sand rings from a ring-one
 * outline. Collision and artwork share this one sloping surface, while the
 * independent foam batch owns the animated waterline accent.
 */
export function buildIslandShelfGeometry(
  ringOneOutline: readonly (readonly [x: number, z: number])[],
  options: IslandShelfOptions,
): THREE.BufferGeometry {
  const profile = UNITY_ISLAND_SHELF_PROFILE;
  if (ringOneOutline.length < 3)
    throw new RangeError("Island shelf needs at least three outline points.");
  if (
    !Number.isFinite(options.centerY) ||
    !Number.isFinite(options.seaLevel) ||
    !Number.isFinite(options.phase)
  )
    throw new RangeError("Island shelf options must be finite.");
  for (const point of ringOneOutline)
    if (
      point.length !== 2 ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1])
    )
      throw new RangeError("Island shelf outline points must be finite X/Z pairs.");

  const outline: [number, number][] =
    ringOneOutline.length === profile.angularSegments
      ? ringOneOutline.map(([x, z]) => [x, z])
      : (() => {
          const cumulative = [0];
          for (let index = 0; index < ringOneOutline.length; index++) {
            const a = ringOneOutline[index];
            const b = ringOneOutline[(index + 1) % ringOneOutline.length];
            cumulative.push(
              cumulative[index] + Math.hypot(b[0] - a[0], b[1] - a[1]),
            );
          }
          const total = cumulative[cumulative.length - 1];
          if (total < 0.1)
            throw new RangeError("Island shelf outline perimeter is degenerate.");
          let edge = 0;
          return Array.from({ length: profile.angularSegments }, (_, index) => {
            const distance = (index / profile.angularSegments) * total;
            while (
              edge < ringOneOutline.length - 1 &&
              cumulative[edge + 1] < distance
            )
              edge++;
            const a = ringOneOutline[edge];
            const b = ringOneOutline[(edge + 1) % ringOneOutline.length];
            const span = cumulative[edge + 1] - cumulative[edge] || 1;
            const t = (distance - cumulative[edge]) / span;
            return [
              THREE.MathUtils.lerp(a[0], b[0], t),
              THREE.MathUtils.lerp(a[1], b[1], t),
            ];
          });
        })();

  const segments = profile.angularSegments;
  const ringCount = profile.radiusScales.length;
  const vertexCount = 1 + segments * ringCount;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices: number[] = [];
  positions[1] = profile.centerHeight - options.centerY;
  uvs[0] = 0.5;
  uvs[1] = 0.5;

  const ringHeights = [
    profile.innerHeights[0],
    profile.innerHeights[1],
    options.seaLevel + profile.waterlineLift,
    profile.outerHeight,
  ];
  let maxRadius = 1;
  for (const [x, z] of outline) maxRadius = Math.max(maxRadius, Math.hypot(x, z));
  for (let ring = 0; ring < ringCount; ring++) {
    const scale = profile.radiusScales[ring];
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const variation =
        1 +
        profile.broadOutlineAmount * Math.sin(angle * 3 + options.phase) +
        profile.fineOutlineAmount * Math.sin(angle * 7 - options.phase * 0.6);
      const source = outline[index];
      const vertex = 1 + ring * segments + index;
      positions[vertex * 3] = source[0] * scale * variation;
      let height = ringHeights[ring];
      if (ring < ringCount - 1)
        height +=
          profile.broadHeightAmount * Math.sin(angle * 5 + options.phase) +
          profile.fineHeightAmount * Math.cos(angle * 9 - options.phase);
      positions[vertex * 3 + 1] = height - options.centerY;
      positions[vertex * 3 + 2] = source[1] * scale * variation;
      uvs[vertex * 2] = 0.5 + positions[vertex * 3] / (maxRadius * 2.5);
      uvs[vertex * 2 + 1] = 0.5 + positions[vertex * 3 + 2] / (maxRadius * 2.5);
    }
  }

  for (let index = 0; index < segments; index++) {
    const next = (index + 1) % segments;
    indices.push(0, 1 + index, 1 + next);
  }
  for (let ring = 0; ring < ringCount - 1; ring++) {
    const inner = 1 + ring * segments;
    const outer = inner + segments;
    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      indices.push(
        inner + index,
        outer + index,
        inner + next,
        inner + next,
        outer + index,
        outer + next,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = "Unity radial island shelf";
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
