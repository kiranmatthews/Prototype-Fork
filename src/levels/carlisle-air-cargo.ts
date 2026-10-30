import type { CustomComponent } from '../level';

type P = [number, number, number];
type Point = (s: number, y: number, u?: number) => P;
type Encounter = {
  name: string;
  jump: string;
  at: P;
  rewardSide: number;
  rewardForward?: number;
  heights: number[][];
  nitro?: { side: number; count: number }[];
};

// Seven deliberately spaced encounters among 55 transfers. The anchors were
// measured 0.2 seconds before the apex of native held-Jump flights, starting
// from the actual spring. These are ordinary floating crates, not a new force,
// launch target, moving floor or alteration to the trampoline controller.
const ENCOUNTERS: Encounter[] = [
  { name: 'Lift parcel cloud', jump: 'Lift and skip · 2', at: [564.762, 98.201, 1.409],
    rewardSide: 1.4, heights: [[1, 2, 1], [1, 1, 1]] },
  { name: 'Socket starboard gap', jump: 'Surf sockets · 3', at: [728.551, 116.32, -4.364],
    rewardSide: 3.6, heights: [[2, 2]], nitro: [{ side: -2, count: 5 }] },
  { name: 'Beacon hanging steps', jump: 'Beacon chimney · 4', at: [1190.264, 173.42, 1.729],
    rewardSide: -1.8, heights: [[1, 2, 3], [1, 1, 1]] },
  { name: 'Dredger split row', jump: 'Dredger discharge · 2', at: [1951.366, 127.071, 2.109],
    rewardSide: 0, heights: [[2, 2]], nitro: [{ side: -4.4, count: 3 }, { side: 4.4, count: 3 }] },
  { name: 'Counterweight hanging pallet', jump: 'Stack leap · 2', at: [2399.255, 136.54, 1.662],
    rewardSide: -2, heights: [[1, 1, 1], [1, 1, 1]] },
  { name: 'Storm crosswind row', jump: 'Storm fingers · 3', at: [2833.964, 153.539, -4.07],
    rewardSide: 4.4, rewardForward: 3, heights: [[2, 2]], nitro: [{ side: 0, count: 5 }] },
  { name: 'Rigging port gap', jump: 'Rigging · moving rebound', at: [3527.357, 177.807, -.027],
    rewardSide: -3.8, heights: [[1, 1], [2, 2]], nitro: [{ side: 2.2, count: 6 }] },
];

export function buildCarlisleAirCargo(components: CustomComponent[], point: Point, group: (s: number) => number) {
  const size = .96;
  const encounters = ENCOUNTERS.map(encounter => {
    const [s, y, u] = encounter.at, center = point(s, y, u);
    const side = point(s, y, u + 1).map((v, i) => v - center[i]) as P;
    const shifted = (offset: number): P => center.map((v, i) => v + side[i] * offset) as P;
    const prefix = `Air cargo · ${encounter.name}`;
    const crate = (name: string, p: P, kind: CustomComponent['kind']) =>
      components.push({ t: 'crate', nm: `${prefix} · ${name}`, p, kind, grp: group(s) });
    const reward = shifted(encounter.rewardSide), depth = encounter.heights.length;
    // Put this reward beyond the crosswind bar, so turning back toward the
    // landing after the spin does not cut across an explosive end crate.
    reward[0] += side[2] * (encounter.rewardForward ?? 0);
    reward[2] -= side[0] * (encounter.rewardForward ?? 0);
    // World-aligned native boxes touch in real columns and settle normally
    // when the lower parcel is broken. No decorative or unbreakable stand-ins.
    for (let tier = 0; tier < 3; tier++) for (let row = 0; row < depth; row++) {
      const heights = encounter.heights[row];
      for (let col = 0; col < heights.length; col++) if (tier < heights[col])
        crate(`parcel ${row + 1}.${col + 1}.${tier + 1}`,
          [reward[0] + (col - (heights.length - 1) / 2) * size, reward[1] + .25 + tier * size,
            reward[2] + (row - (depth - 1) / 2) * size], 'wood');
    }
    for (const [row, bar] of (encounter.nitro ?? []).entries()) {
      const origin = shifted(bar.side);
      for (let i = 0; i < bar.count; i++)
        crate(`nitro ${row + 1}.${i + 1}`, [origin[0] + (i - (bar.count - 1) / 2) * size, origin[1] + .1, origin[2]], 'nitro');
    }
    return { ...encounter, center, reward, side, prefix };
  });
  // A reachable native clear switch lets an all-crate run finish without
  // demanding contact with the airborne explosives themselves.
  components.push({ t: 'crate', nm: 'Air cargo · home harbour nitro clear',
    p: point(3986, 12, -5.5), kind: 'nitrobang', grp: group(3986) });
  return encounters;
}
