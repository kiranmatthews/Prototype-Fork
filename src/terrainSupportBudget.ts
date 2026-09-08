import type { CustomComponent, CustomLevelData } from "./level";
import { CAMPAIGN_LEVELS } from "./campaign";
import { UNITY_ISLAND_SHELF_PROFILE } from "./islandShelf";
import {
  UNITY_BEACH_BOARDWALK_PROFILE,
  UNITY_ISLAND_BOARDWALK_PROFILE,
  UNITY_LIGHT_BOARDWALK_PROFILE,
  woodPathBentIntervals,
} from "./woodPathKit";

/** Worst-case triangle visits, even when a BVH cannot separate coincident faces. */
export const MAX_TERRAIN_SUPPORT_TRIANGLE_TESTS = 2_000_000;
// Broad, spatially separated native terrain can contain many more triangles
// than a ray visits (Beachside: 14.8m raw candidates, before spline allowance).
// Keep a second independent ceiling even when spatial filtering is excellent.
export const MAX_TERRAIN_SUPPORT_RAW_TRIANGLES = 32_000_000;

/** Imports and editor commits use a disposable build before retaining these. */
export function requiresTerrainSupportBuildCheck(data: CustomLevelData): boolean {
  return data.components.some(c => c.t === "woodpath" && c.terrainSupports &&
    !!((c.supports ?? c.scaffold) || (c.rails ?? c.scaffold)));
}

/**
 * Conservative per-ray triangle overlap for a native mesh. A fixed grid counts
 * every triangle whose projected bounds touches a cell, including long thin or
 * duplicate faces. This is bounded to 64 increments per input triangle, never
 * a probe × triangle scan, and requires no geometry/BVH construction at import.
 */
export function terrainSupportMeshOverlap(c: CustomComponent): number {
  if (c.solid === false) return 0;
  const vertices = c.vertices!;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]); maxX = Math.max(maxX, vertices[i]);
    minZ = Math.min(minZ, vertices[i + 2]); maxZ = Math.max(maxZ, vertices[i + 2]);
  }
  const cell = (value: number, min: number, max: number) => max > min
    ? Math.max(0, Math.min(7, Math.floor(8 * (value - min) / (max - min)))) : 0;
  const bins = new Uint32Array(64);
  const indexCount = c.indices?.length ?? vertices.length / 3;
  let peak = 0;
  for (let i = 0; i < indexCount; i += 3) {
    const a = (c.indices?.[i] ?? i) * 3;
    const b = (c.indices?.[i + 1] ?? i + 1) * 3;
    const d = (c.indices?.[i + 2] ?? i + 2) * 3;
    const x0 = cell(Math.min(vertices[a], vertices[b], vertices[d]), minX, maxX);
    const x1 = cell(Math.max(vertices[a], vertices[b], vertices[d]), minX, maxX);
    const z0 = cell(Math.min(vertices[a + 2], vertices[b + 2], vertices[d + 2]), minZ, maxZ);
    const z1 = cell(Math.max(vertices[a + 2], vertices[b + 2], vertices[d + 2]), minZ, maxZ);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
      peak = Math.max(peak, ++bins[z * 8 + x]);
  }
  // Mesh authoring only permits yaw and positive axis scale, so vertical rays
  // remain vertical in this local projection regardless of its world pose.
  return peak;
}

export function woodPathProfileForComponent(c: CustomComponent) {
  return c.structureStyle === "island" ? UNITY_ISLAND_BOARDWALK_PROFILE
    : c.structureStyle === "beach" ? UNITY_BEACH_BOARDWALK_PROFILE
    : UNITY_LIGHT_BOARDWALK_PROFILE;
}

export function terrainSupportProbeCount(c: CustomComponent, length: number): number {
  // The kit resolves bent bottoms for handrails as well as support posts.
  if (!c.terrainSupports || length <= 0 ||
      !((c.supports ?? c.scaffold) || (c.rails ?? c.scaffold))) return 0;
  return 2 * (woodPathBentIntervals(length,
    c.baySpacing ?? woodPathProfileForComponent(c).bentSpacing) + 1);
}

/**
 * Triangle upper bounds for the ordinary geometry pass before timber is built.
 * These are triangle counts, not the validator's mixed geometry/layout units.
 * Paths use the same twofold spline-length allowance as the generation budget;
 * the runtime independently counts the actual completed buffers before probing.
 */
export function terrainSupportGroundTriangles(
  c: CustomComponent, pathLength: number, denseNodes: number,
): number {
  switch (c.t) {
    case "mesh": return c.solid === false ? 0 : (c.indices?.length ?? (c.vertices?.length ?? 0) / 3) / 3;
    case "platform":
      if (!c.pts) return 12;
      if (c.shoreProfile) {
        const p = UNITY_ISLAND_SHELF_PROFILE;
        return p.angularSegments * (1 + 2 * (p.radiusScales.length - 1));
      }
      return Math.max(0, 4 * denseNodes - 4);
    case "wall": return c.pts && !c.invisible ? Math.max(0, 4 * denseNodes - 4) : 0;
    case "terrain": {
      const zs = c.pts?.map(point => point[1]) ?? [0, -40];
      const depth = Math.max(...zs) - Math.min(...zs);
      return depth < 1 ? 0 : 8 * Math.max(8, Math.round(depth / (c.curve === "spline" ? 1.5 : 3)));
    }
    case "pipe":
    case "vertramp": {
      const half = c.t === "pipe" || c.vkind === "half";
      if (!c.pts && half && (c.arc ?? 90) === 90 && (c.deck ?? 0) === 0 &&
          (c.yaw ?? 0) % 90 === 0) return 88; // Halfpipe: two 22-quad ribbons.
      const halfProfile = 9 + ((c.deck ?? 0) > 0 ? 3 : 0);
      const profileVertices = half ? 2 * halfProfile : halfProfile + 1;
      const segments = c.curve === "spline"
        ? Math.max(8, Math.ceil(pathLength * 2 / 1.6))
        : Math.max(1, denseNodes - (c.closed && (c.pts?.length ?? 0) > 2 ? 0 : 1));
      return 2 * segments * (profileVertices - 1);
    }
    case "rock": return 36; // DodecahedronGeometry(detail=0).
    case "bonusplatform": return 48; // Closed 12-segment cylinder.
    case "gate": return 168; // Warp plinth body, rim and pad: three closed 14-segment cylinders.
    case "worldmap": return (c.pts?.length ?? CAMPAIGN_LEVELS.length) * 128;
    case "ramp":
    case "metal":
    case "mover":
    case "crumble":
    case "trampoline":
    case "speedpad": return 12;
    // Wood decks are deliberately excluded from other woodpaths' supports.
    // Other components either have no ground mesh or are built after timber.
    default: return 0;
  }
}
