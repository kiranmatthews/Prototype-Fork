import type { CustomComponent } from '../level';

type Point = [number, number];
// Normalized to the same LOD0 bounds as jungleAssets.ts (XZ centred, Y rooted).
// These are the central wood sections measured in the three shipped GLBs, not
// their canopy bounds. The second tree's trunk is well left of its asset pivot.
// Low buttresses remain outside the core so gaps between roots stay usable.
// [bottom, top, centre X, centre Z, radius X, radius Z]
type Band = readonly [number, number, number, number, number, number];
const trunks: Partial<Record<NonNullable<CustomComponent['dkind']>, {
  size: [number, number, number]; bands: readonly Band[];
}>> = {
  treehousehost: { size: [15.5, 15, 10], bands: [
    [0, .15, .055, -.075, .16, .22],
    [.15, .30, .075, -.07, .145, .195],
    [.30, .43, .065, -.09, .12, .17],
  ] },
  trialsv2treea: { size: [26, 24, 20], bands: [
    [0, .15, -.025, .025, .13, .145],
    [.15, .30, -.025, .025, .115, .12],
    [.30, .43, -.075, .005, .09, .085],
  ] },
  trialsv2treeb: { size: [26, 24, 20], bands: [
    [0, .15, -.185, .015, .13, .20],
    [.15, .30, -.17, .015, .11, .15],
    [.30, .43, -.14, -.035, .08, .10],
  ] },
};
export const TREEHOUSE_TRUNK_COLLISION_PREFIX = 'Fitted tree trunk · ';
const round = (n: number) => +n.toFixed(5);
function inside([x, z]: Point, polygon: Point[]): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function distanceToEdge(p: Point, a: Point, b: Point): number {
  const x = b[0] - a[0], z = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * z) / (x * x + z * z || 1)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * z);
}

/** Add native, filled blockers after all final tree placement transforms.
 * Background trunks wholly outside the existing course boundary need no extra
 * collision. The one-metre margin retains near-boundary contact candidates.
 * Original art, mesh collision, stairs and course surfaces are left intact. */
export function collideTreehouseTrunks(source: readonly CustomComponent[]): CustomComponent[] {
  const boundary = source.find(c => c.nm === 'Treehouse fitted course-edge safety perimeter');
  const perimeter: Point[] = boundary?.pts?.map(p => [boundary.p[0] + p[0], boundary.p[2] + p[1]]) ?? [];
  const result = [...source];
  source.forEach((tree, index) => {
    const profile = tree.t === 'decor' && tree.dkind ? trunks[tree.dkind] : undefined;
    if (!profile) return;
    const scale = (tree.s ?? profile.size).map(n => n * (tree.w ?? 1));
    const yaw = (tree.yaw ?? 0) * Math.PI / 180, cos = Math.cos(yaw), sin = Math.sin(yaw);
    const transform = (x: number, z: number): Point => [x * scale[0] * cos + z * scale[2] * sin, -x * scale[0] * sin + z * scale[2] * cos];
    const bands = profile.bands.map(([bottom, top, x, z, rx, rz], band): CustomComponent => {
      const [cx, cz] = transform(x, z);
      const pts: Point[] = Array.from({ length: 12 }, (_, i) => {
        const a = i * Math.PI / 6, q = transform(Math.cos(a) * rx, Math.sin(a) * rz);
        return [round(q[0]), round(q[1])];
      });
      const base = tree.p[1] + bottom * scale[1] - (band === 0 ? .5 : .04);
      const height = tree.p[1] + top * scale[1] + .04 - base;
      return { t: 'wall', p: [round(tree.p[0] + cx), round(base), round(tree.p[2] + cz)],
        s: [round(rx * scale[0] * 2), round(height), round(rz * scale[2] * 2)], pts,
        invisible: true, edgeGrinding: false, grp: tree.grp,
        nm: `${TREEHOUSE_TRUNK_COLLISION_PREFIX}${index}/${band} · ${tree.nm ?? tree.dkind}` };
    });
    const reachable = !perimeter.length || bands.some(band => {
      const p: Point = [band.p[0], band.p[2]], radius = Math.max(...band.pts!.map(q => Math.hypot(q[0], q[1]))) + 1;
      return inside(p, perimeter) || perimeter.some((a, i) => distanceToEdge(p, a, perimeter[(i + 1) % perimeter.length]) <= radius);
    });
    if (reachable) result.push(...bands);
  });
  return result;
}
