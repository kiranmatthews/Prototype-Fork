import * as THREE from "three";
import {
  CENTER,
  MeshBVH,
  acceleratedRaycast,
  disposeBoundsTree,
  estimateMemoryInBytes,
} from "three-mesh-bvh";

/** Tiny primitives are faster through Three's stock raycast than a BVH. */
export const GROUND_BVH_MIN_TRIANGLES = 128;

export interface GroundAccelerationStats {
  candidateMeshes: number;
  acceleratedMeshes: number;
  uniqueGeometries: number;
  triangles: number;
  bytes: number;
  buildMs: number;
}
export interface GroundAcceleration {
  ownedGeometries: Set<THREE.BufferGeometry>;
  stats: GroundAccelerationStats;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const index = geometry.getIndex();
  const position = geometry.getAttribute("position");
  return Math.floor((index?.count ?? position?.count ?? 0) / 3);
}

function now(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

/**
 * Adds a local-space triangle BVH to every dense standable mesh.
 *
 * `indirect` is deliberate: the default MeshBVH builder may reorder or add a
 * geometry index. Ground queries do not need that mutation, and keeping the
 * buffers byte-identical protects rendering, editor capture and equal-distance
 * face behavior. The adapter returns the same world-space Intersection shape
 * as THREE.Mesh.raycast and falls back to Three for an unsupported geometry.
 */
export function accelerateGroundMeshes(
  meshes: readonly THREE.Mesh[],
  minimumTriangles = GROUND_BVH_MIN_TRIANGLES,
): GroundAcceleration {
  const started = now();
  const visited = new Set<THREE.BufferGeometry>();
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const stats: GroundAccelerationStats = {
    candidateMeshes: meshes.length,
    acceleratedMeshes: 0,
    uniqueGeometries: 0,
    triangles: 0,
    bytes: 0,
    buildMs: 0,
  };

  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    if (!geometry?.isBufferGeometry || !geometry.getAttribute("position"))
      continue;
    const triangles = triangleCount(geometry);
    if (triangles < minimumTriangles) continue;

    if (!visited.has(geometry)) {
      visited.add(geometry);
      try {
        if (!geometry.boundsTree) {
          geometry.boundsTree = new MeshBVH(geometry, {
            strategy: CENTER,
            indirect: true,
            verbose: false,
          });
          ownedGeometries.add(geometry);
        }
        stats.uniqueGeometries++;
        stats.triangles += triangles;
        if (geometry.boundsTree)
          stats.bytes += estimateMemoryInBytes(geometry.boundsTree);
      } catch (error) {
        // Correctness wins over acceleration. The mesh retains Three's stock
        // raycast, and the validator/build makes dense fallback a visible
        // failure in development without breaking a player's level at runtime.
        console.warn("Ground BVH build failed; using Three raycast", error);
      }
    }

    if (geometry.boundsTree) {
      mesh.raycast = acceleratedRaycast;
      stats.acceleratedMeshes++;
    }
  }

  stats.buildMs = now() - started;
  return { ownedGeometries, stats };
}

/** Releases only trees built by this Level and not shared with its successor. */
export function disposeGroundAcceleration(
  ownedGeometries: ReadonlySet<THREE.BufferGeometry>,
  preservedGeometries: ReadonlySet<THREE.BufferGeometry>,
): void {
  for (const geometry of ownedGeometries) {
    if (
      preservedGeometries.has(geometry) ||
      geometry.userData.shared ||
      !geometry.boundsTree
    )
      continue;
    disposeBoundsTree.call(geometry);
  }
}
