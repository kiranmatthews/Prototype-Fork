import type { CustomComponent } from '../level';

type P = [number, number, number];
type Point = (s: number, y: number, u?: number) => P;
export const CARLISLE_CRATE_SIZE = .96;
// These openings are inside existing dry islands. They do not divide a slide
// or change the course's elevation profile, spring flights or machinery.
export const CARLISLE_CARGO_GAPS = [
  { name: 'Dial cargo bridge', from: 1520, to: 1528, y: 16, lead: 1516.5, end: 1532, tier: 0 },
  { name: 'Discharge cargo trestle', from: 1993, to: 2003, y: 24, lead: 1988.5, end: 2007, tier: 1 },
  { name: 'Crown cargo causeway', from: 3795, to: 3805, y: 24, lead: 3790.5, end: 3809, tier: 0 },
] as const;
export const CARLISLE_CARGO_PILES = [
  { name: 'Shore starter parcel', s: 5, y: 0, u: 1.8, heights: [[1, 2, 1], [1, 1, 1]], mask: true },
  { name: 'Scissor hub stair', s: 260, y: 1.05, u: 3.5, heights: [[1, 2, 3], [1, 2, 3]] },
  { name: 'Winch transfer bundle', s: 905, y: 4.95, u: -2.5, heights: [[2, 2], [2, 2]] },
  { name: 'Counterweight cargo steps', s: 2244, y: 24, u: 3, heights: [[3, 3, 3], [2, 2, 2], [1, 1, 1]] },
  { name: 'Rigging launch parcels', s: 3360, y: 24, u: 2.6, heights: [[2, 1, 2], [2, 1, 2]] },
  { name: 'Home harbour cargo fan', s: 3976, y: 12, u: 2.8, heights: [[1, 1, 1, 1], [1, 2, 2, 1], [1, 1, 1, 1]] },
] as const;

/** Native, world-aligned .96 m boxes: touching tops derive their own grind
 * paths, and stacked boxes retain the game's normal break/settle behavior. */
export function buildCarlisleCargo(components: CustomComponent[], point: Point, group: (s: number) => number) {
  const size = CARLISLE_CRATE_SIZE;
  const crate = (name: string, p: P, s: number, kind: CustomComponent['kind'] = 'wood') =>
    components.push({ t: 'crate', nm: name, p, kind, grp: group(s) });
  for (const pile of CARLISLE_CARGO_PILES) {
    const centre = point(pile.s, pile.y, pile.u), width = pile.heights[0].length, depth = pile.heights.length;
    for (let tier = 0; tier < 3; tier++) for (let row = 0; row < depth; row++) for (let col = 0; col < width; col++) {
      if (tier >= pile.heights[row][col]) continue;
      crate(`${pile.name} · ${row + 1}.${col + 1}.${tier + 1}`,
        [centre[0] + (col - (width - 1) / 2) * size, centre[1] + tier * size, centre[2] + (row - (depth - 1) / 2) * size],
        pile.s, 'mask' in pile && pile.mask && tier === 1 ? 'mask' : 'wood');
    }
  }
  return CARLISLE_CARGO_GAPS.map(gap => {
    const centre = point((gap.from + gap.to) / 2, gap.y), near = point(gap.lead, gap.y), far = point(gap.end, gap.y);
    const count = Math.ceil((near[2] - far[2]) / size) + 1;
    // A durable adjacent metal row leaves a return route after the wooden
    // grind breaks behind the rider. No invisible floor or authored rail.
    const woodX = centre[0] - size / 2, metalX = centre[0] + size / 2;
    for (let i = 0; i < count; i++) {
      const z = near[2] - i * size;
      crate(`${gap.name} · durable spine ${i + 1}`, [metalX, centre[1], z], gap.from, 'metal');
      if (gap.tier) crate(`${gap.name} · trestle base ${i + 1}`, [woodX, centre[1], z], gap.from, 'metal');
      crate(`${gap.name} · grind parcel ${i + 1}`, [woodX, centre[1] + gap.tier * size, z], gap.from);
    }
    // The raised trestle has a full crate tread before/after its wooden row.
    if (gap.tier) for (const z of [near[2] + size, near[2] - count * size])
      crate(`${gap.name} · boarding tread`, [woodX, centre[1], z], gap.from, 'metal');
    return { ...gap, count, woodX, metalX, baseY: centre[1], firstZ: near[2], lastZ: near[2] - (count - 1) * size };
  });
}
