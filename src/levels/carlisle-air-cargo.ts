import type { CustomComponent } from '../level';
import { CARLISLE_CRATE_SIZE } from './carlisle-cargo';

type P = [number, number, number];
type Point = (s: number, y: number, u?: number) => P;
type Encounter = {
  name: string;
  jump: string;
  // Station, base height above the descending coast, lateral offset.
  path: P[];
  widths: number[];
  nitro?: { at: P; count: number }[];
};

// Mid-flight landing pallets on the descent, rather than parcels at the held-Jump
// apex. Each next lid is 3.8–4.4 m forward and slightly lower: ordinary wood's
// native stomp pop can chain them without a second jump or an arrow boost.
// Seven different lines remain occasional among the 55 spring transfers.
const ENCOUNTERS: Encounter[] = [
  { name: 'Lift parcel cloud', jump: 'Lift and skip · 2',
    path: [[560, 62, 0], [564, 61, .8], [568, 60, 1.6], [572, 59, 2.5]], widths: [3, 2, 2, 3] },
  { name: 'Socket starboard gap', jump: 'Surf sockets · 3',
    path: [[724, 68, 2], [728.2, 67, 1], [732.4, 66, -1], [736.6, 65, -3]], widths: [3, 2, 2, 3],
    nitro: [{ at: [729, 66, -5.5], count: 5 }] },
  { name: 'Beacon hanging steps', jump: 'Beacon chimney · 4',
    path: [[1182, 119, -2], [1186.2, 118.2, -.8], [1190.4, 117.4, .4], [1194.6, 116.6, 1.6], [1198.8, 115.8, 2.8]], widths: [3, 2, 1, 2, 3] },
  { name: 'Dredger split row', jump: 'Dredger discharge · 2',
    path: [[1946, 91, 0], [1950, 90, 0], [1954, 89, 0], [1958, 88, 0]], widths: [3, 2, 2, 3],
    nitro: [{ at: [1951, 89, -5.5], count: 3 }, { at: [1951, 89, 5.5], count: 3 }] },
  { name: 'Counterweight hanging pallet', jump: 'Stack leap · 2',
    path: [[2392, 91, -1], [2396.4, 90, .2], [2400.8, 89, 2], [2405.2, 88, 3.4], [2409.6, 87, 4]], widths: [3, 2, 2, 2, 3] },
  { name: 'Storm crosswind row', jump: 'Storm fingers · 3',
    path: [[2828, 92, 6], [2831.8, 91, 5.2], [2835.6, 90, 3.8], [2839.4, 89, 1.8], [2843.2, 88, -.4]], widths: [3, 2, 2, 2, 3],
    nitro: [{ at: [2832, 90, -.5], count: 5 }] },
  { name: 'Rigging port gap', jump: 'Rigging · moving rebound',
    path: [[3527, 115, -7], [3531.4, 114, -6], [3535.8, 113, -4.5], [3540.2, 112, -2.5], [3544.6, 111, -.5]], widths: [3, 2, 2, 2, 3],
    nitro: [{ at: [3532, 113, 1], count: 6 }] },
];

export function buildCarlisleAirCargo(components: CustomComponent[], point: Point, group: (s: number) => number) {
  const size = CARLISLE_CRATE_SIZE;
  const encounters = ENCOUNTERS.map(encounter => {
    const prefix = `Air cargo · ${encounter.name}`;
    const crate = (name: string, p: P, s: number, kind: CustomComponent['kind']) => {
      const nm = `${prefix} · ${name}`;
      components.push({ t: 'crate', nm, p, kind, grp: group(s) });
      return nm;
    };
    const landings = encounter.path.map(([s, y, u], index) => {
      const center = point(s, y, u), width = encounter.widths[index];
      const names: string[] = [];
      // Two touching rows give a readable landing lid. Nothing hangs above
      // it to headbutt, and each cluster breaks/settles as ordinary crates.
      for (let row = 0; row < 2; row++) for (let col = 0; col < width; col++)
        names.push(crate(`landing ${index + 1} · parcel ${row + 1}.${col + 1}`,
          [center[0] + (col - (width - 1) / 2) * size, center[1], center[2] + (row - .5) * size], s, 'wood'));
      return { center, top: center[1] + size, names, width };
    });
    for (const [row, bar] of (encounter.nitro ?? []).entries()) {
      const origin = point(...bar.at);
      for (let i = 0; i < bar.count; i++)
        crate(`nitro ${row + 1}.${i + 1}`, [origin[0] + (i - (bar.count - 1) / 2) * size, origin[1], origin[2]], bar.at[0], 'nitro');
    }
    const [s, y, u] = encounter.path[0], center = landings[0].center;
    const side = point(s, y, u + 1).map((v, i) => v - center[i]) as P;
    return { ...encounter, at: encounter.path[0], center, reward: center, side, rewardSide: u, prefix, landings };
  });
  // The existing native clear switch retains a safe all-crate finish.
  components.push({ t: 'crate', nm: 'Air cargo · home harbour nitro clear',
    p: point(3986, 12, -5.5), kind: 'nitrobang', grp: group(3986) });
  return encounters;
}
