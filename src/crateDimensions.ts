import type { CustomLevelData } from './level';

/** Metres. Art, collision, editor placement and derived ledges share this size. */
export const LEGACY_CRATE_SIZE = .96;
export const CRATE_SCALE = 1.2;
export const CRATE_SIZE = LEGACY_CRATE_SIZE * CRATE_SCALE;
export const RACE_CRATE_SIZE = CRATE_SIZE * 2;
export const RACE_CRATE_HOVER = .9;

export interface CratePlacement {
  p: [number, number, number]; // bottom centre, before enlargement
  size: number;
  concealed?: boolean;
}

/** Expand only neighbouring formations about their own centre. Floor heights
 * remain authored; only a crate resting on another crate inherits its rise.
 * Work from an immutable snapshot so component order cannot change a stack. */
export function enlargedCrateLayout(boxes: readonly CratePlacement[]): [number, number, number][] {
  const parents = boxes.map((_, i) => i);
  const root = (i: number): number => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  const supports = boxes.map(() => -1);
  const clearances: { a: number; scale: number }[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    if (a.concealed) continue;
    for (let j = 0; j < i; j++) {
      const b = boxes[j];
      if (b.concealed) continue;
      const dx = Math.abs(a.p[0] - b.p[0]), dz = Math.abs(a.p[2] - b.p[2]);
      const reach = (a.size + b.size) / 2;
      const low = a.p[1] < b.p[1] ? i : j, high = low === i ? j : i;
      const lower = boxes[low], upper = boxes[high];
      const gap = upper.p[1] - lower.p[1] - lower.size;
      const stacked = dx < reach * .625 && dz < reach * .625 &&
        upper.p[1] - lower.p[1] > lower.size * .5 && gap < lower.size * (CRATE_SCALE - 1) + .08;
      if (stacked && (supports[high] < 0 || boxes[supports[high]].p[1] < lower.p[1])) supports[high] = low;
      // Nearby rows need extra space as well, including a small authored gap.
      const neighbours = dx < reach * CRATE_SCALE + .01 && dz < reach * CRATE_SCALE + .01 &&
        upper.p[1] < lower.p[1] + lower.size * CRATE_SCALE + .01;
      if (stacked || neighbours) parents[root(i)] = root(j);
      // Authored diagonal rows still contain world-aligned cubes. Their
      // projected pitch must clear the larger faces, not just their centres.
      if (neighbours && !stacked && gap < -.08 && Math.max(dx, dz) > reach * .5)
        clearances.push({ a: i, scale: reach * CRATE_SCALE / Math.max(dx, dz) });
    }
  }
  const bounds = new Map<number, [number, number, number, number]>();
  boxes.forEach(({ p }, i) => {
    const key = root(i), b = bounds.get(key) ?? [p[0], p[0], p[2], p[2]];
    b[0] = Math.min(b[0], p[0]); b[1] = Math.max(b[1], p[0]);
    b[2] = Math.min(b[2], p[2]); b[3] = Math.max(b[3], p[2]); bounds.set(key, b);
  });
  const scales = new Map<number, number>();
  for (const { a, scale } of clearances) scales.set(root(a), Math.max(scales.get(root(a)) ?? CRATE_SCALE, scale));
  const result = boxes.map(({ p, size, concealed }, i): [number, number, number] => {
    if (concealed) return [p[0], p[1] - size * (CRATE_SCALE - 1), p[2]]; // retain burial depth
    const [x0, x1, z0, z1] = bounds.get(root(i))!, x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    const scale = scales.get(root(i)) ?? CRATE_SCALE;
    return [x + (p[0] - x) * scale, p[1], z + (p[2] - z) * scale];
  });
  for (const i of boxes.map((_, i) => i).sort((a, b) => boxes[a].p[1] - boxes[b].p[1])) {
    const below = supports[i];
    if (below >= 0) result[i][1] = result[below][1] + boxes[below].size * CRATE_SCALE +
      Math.max(0, boxes[i].p[1] - boxes[below].p[1] - boxes[below].size);
  }
  return result;
}

/** Saved/captured layouts carry the revision, preventing repeated expansion. */
export function migrateCrateLayout(data: CustomLevelData): void {
  if (data.crateLayoutRevision === 1) return;
  const components = data.components.filter(c => ['crate', 'metal', 'outline', 'checkpoint'].includes(c.t));
  const positions = enlargedCrateLayout(components.map(c => ({
    p: c.p,
    size: data.skateRace && c.t === 'crate' && ['mystery', 'tnt', 'nitro'].includes(c.kind ?? '')
      ? LEGACY_CRATE_SIZE * 2 : LEGACY_CRATE_SIZE,
    concealed: c.kind === 'nitro' && c.invisible,
  })));
  components.forEach((c, i) => { c.p = positions[i]; });
  // Legacy one-line bonus containment was only 1.06 m wide. Keep its
  // centreline while giving the larger boxes their original 5 cm clearance.
  if (data.hudMode === 'bonus') for (const c of data.components) {
    if (c.t === 'wall' && c.invisible && !c.pts && !c.yaw && c.s &&
      c.s[0] > 20 && Math.abs(c.s[2] - .6) < .001 && Math.abs(Math.abs(c.p[2]) - .83) < .001)
      c.p[2] += Math.sign(c.p[2]) * (CRATE_SIZE - LEGACY_CRATE_SIZE) / 2;
  }
  data.crateLayoutRevision = 1;
}
