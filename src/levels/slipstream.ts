import { buildSlipstreamRace } from './slipstream-race';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { SLIPSTREAM_1_LEVEL } from './slipstream-1';
import { SLIPSTREAM_2_LEVEL, slipstream2Point } from './slipstream-2';
import { ASTRA_CHIMEWORKS_LEVEL } from './astra-chimeworks';

type Point = [number, number, number];
export const SLIPSTREAM_OFFSETS = {
  ribbon: [0, 126, 0], reservoir: [16, 60, -898], chimeworks: [-2, 12, -1914],
} satisfies Record<string, Point>;
export const translateSlipstreamPoint = (p: readonly number[], offset: Point): Point =>
  [p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]];
const components: CustomComponent[] = [];
const groups: CustomGroup[] = [
  { id: 100, nm: 'I · Slipstream / sky ribbon', editorOnly: true },
  { id: 190, nm: 'Reservoir causeway', editorOnly: true },
  ...(SLIPSTREAM_2_LEVEL.groups ?? []).filter(g => g.id !== 1).map(g => ({ ...g, id: 200 + g.id })),
  { id: 290, nm: 'Brass promenade', editorOnly: true },
  ...(ASTRA_CHIMEWORKS_LEVEL.groups ?? []).map(g => ({ ...g, id: 300 + g.id })),
];
function translated(c: CustomComponent, offset: Point, group: number): CustomComponent {
  const copy = JSON.parse(JSON.stringify(c)) as CustomComponent;
  copy.p = translateSlipstreamPoint(c.p, offset);
  copy.grp = group;
  for (const key of ['to', 'cameraPosition', 'cameraTarget'] as const)
    if (c[key]) copy[key] = translateSlipstreamPoint(c[key]!, offset);
  return copy;
}
// A single broad, triangulated surface owns each join. Flat centre lanes and
// feathered banks meet both adjacent decks without caps, stairs or hidden gaps.
export const SLIPSTREAM_CONNECTIONS = [
  { name: 'Reservoir causeway', a: [0, 126.2, -874] as Point, b: [0, 125.2, -930] as Point,
    widthA: 22, widthB: 28, bankA: 0, bankB: 3.2, grp: 190, color: '#69b7bd' },
  { name: 'Brass promenade', a: [-2, 60, -1830] as Point, b: [-2, 60, -1890] as Point,
    widthA: 32, widthB: 18, bankA: .2, bankB: 0, grp: 290, color: '#a8bda3' },
];
function connection(c: typeof SLIPSTREAM_CONNECTIONS[number]) {
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const rows = 40, cross = [-1, -.8, -.55, 0, .55, .8, 1];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows, ease = t * t * (3 - 2 * t);
    const width = c.widthA + (c.widthB - c.widthA) * ease;
    for (const u of cross) {
      const bank = (c.bankA + (c.bankB - c.bankA) * ease) * Math.max(0, (Math.abs(u) - .55) / .45) ** 2;
      vertices.push((c.b[0] - c.a[0]) * t + u * width / 2,
        (c.b[1] - c.a[1]) * ease + bank, (c.b[2] - c.a[2]) * t);
      uvs.push(u * width / 8, t * 15);
    }
    if (i) for (let j = 0; j < cross.length - 1; j++) {
      const a = (i - 1) * cross.length + j, b = a + cross.length;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  components.push({ t: 'mesh', p: c.a, vertices, indices, uvs, solid: true,
    gravityTrack: true, tex: 'stone', color: c.color, grp: c.grp, nm: c.name });
  // Ordered cameras are interleaved with the acts, including each connection.
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const p: Point = [c.a[0] + (c.b[0] - c.a[0]) * t,
      c.a[1] + (c.b[1] - c.a[1]) * t, c.a[2] + (c.b[2] - c.a[2]) * t];
    components.push({ t: 'camnode', p, grp: c.grp });
    if (i % 2 === 0) components.push({ t: 'wumpa', p: [p[0], p[1] + 1, p[2]], grp: c.grp });
  }
  for (const side of [-1, 1]) for (const t of [.25, .75]) {
    const x = c.a[0] + side * (c.widthA + (c.widthB - c.widthA) * t) / 2;
    const z = c.a[2] + (c.b[2] - c.a[2]) * t;
    components.push({ t: 'decor', dkind: 'block', p: [x, c.b[1] - 9, z], s: [1.5, 8, 2],
      tex: 'stone', color: c.grp === 290 ? '#daa857' : '#cbb993', grp: c.grp });
  }
}
for (const c of SLIPSTREAM_1_LEVEL.components) {
  if (c.t === 'gate') continue;
  const copy = translated(c, SLIPSTREAM_OFFSETS.ribbon, 100);
  if (c.t === 'platform' && c.p[2] === -842) copy.nm = 'finish run'; // Original apron under the landing ribbon.
  // One optional crystal for the whole journey: the reservoir's high route.
  if (copy.t === 'crystal') copy.t = 'wumpa';
  components.push(copy);
}
components.push({ t: 'checkpoint', p: [0, 126.2, -846], grp: 190, nm: 'Reservoir approach' });
connection(SLIPSTREAM_CONNECTIONS[0]);
for (const c of SLIPSTREAM_2_LEVEL.components) {
  if (c.grp === 1 || c.t === 'gate' || c.t === 'clock' || (c.t === 'camnode' && c.p[2] > -32)) continue;
  components.push(translated(c, SLIPSTREAM_OFFSETS.reservoir, 200 + (c.grp ?? 2)));
}
components.push({ t: 'checkpoint', p: [-2, 60.36, -1818], grp: 290, nm: 'Chimeworks approach' });
connection(SLIPSTREAM_CONNECTIONS[1]);
components.push({ t: 'checkpoint', p: [-2, 60, -1902], grp: 301, nm: 'Overture balcony' });
for (const c of ASTRA_CHIMEWORKS_LEVEL.components) {
  if (c.t === 'clock') continue;
  const copy = translated(c, SLIPSTREAM_OFFSETS.chimeworks, 300 + (c.grp ?? 6));
  // After the long descent, allow time to land, line up and charge the next hop.
  if (copy.t === 'crumble') copy.shake = 2;
  // Bank the platforming refuge after riders have finished braking/alignment.
  if (copy.t === 'checkpoint' && c.p[2] === -231) copy.p[2] -= 3;
  if (copy.t === 'crystal') { copy.t = 'crate'; copy.kind = 'life'; copy.nm = 'Harp reunion reward'; }
  components.push(copy);
}
// Catch void falls under their own act; a high-altitude miss should not fall
// through the full 260-metre descent before returning to its checkpoint.
for (const [p, s] of [
  [[-20, 104, -425], [320, 1, 950]], [[10, 40, -1380], [220, 1, 920]],
  [[0, -4, -2240], [220, 1, 690]],
] as [Point, Point][]) components.push({ t: 'pit', p, s, invisible: true, grp: 100, nm: 'Section fall recovery' });

export const SLIPSTREAM_ADVENTURE_LEVEL: CustomLevelData = {
  v: 1, name: 'The Slipstream', spawn: [0, 276.1, 18], killY: -24,
  sky: 'day', cameraLookAhead: 15, cameraAirLift: .6,
  allBalanceCrates: true, perfectGrindBoost: true,
  medalTimes: { gold: 160, silver: 210, bronze: 285 },
  atmosphere: { ...SLIPSTREAM_2_LEVEL.atmosphere },
  components, groups,
};
export const SLIPSTREAM_RESERVOIR_ENTRY = translateSlipstreamPoint(slipstream2Point(0), SLIPSTREAM_OFFSETS.reservoir);

const race = buildSlipstreamRace(SLIPSTREAM_ADVENTURE_LEVEL);
export const SLIPSTREAM_LEVEL = race.data;
export const SLIPSTREAM_RACE_STATS = race.stats;
