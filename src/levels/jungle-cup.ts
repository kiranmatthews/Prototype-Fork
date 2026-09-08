import type { CustomComponent, CustomLevelData } from '../level';

// An open competition park inside ONE continuous transition. The toe, curved
// corners, coping and outside deck belong to the same mesh: no overlapping
// quarter-pipe ends, boundary pillars in the ride line, or holes below ramps.
const components: CustomComponent[] = [];
const add = (c: CustomComponent) => components.push(c);
const stone = '#c1b08f', jade = '#89a58f', gold = '#d2b768';
const platform = (nm: string, p: [number, number, number], s: [number, number, number], color = stone) =>
  add({ t: 'platform', nm, p, s, color, tex: 'jungle', edgeGrinding: false });
const rail = (nm: string, x: number, y: number, z: number, len: number, yaw = 0) =>
  add({ t: 'rail', nm, p: [x, y, z], len, yaw, color: gold });
// A flat top and a continuous bank on ALL four sides, including the hips.
// A single roof avoids the vertical end faces and overlapping ramp snaps
// produced by assembling an island from four independent wedges.
const hip = (nm: string, x: number, z: number, w: number, d: number, h: number, bank: number) => {
  const vertices: number[] = [];
  for (const [width, depth, y] of [[w, d, h], [w + bank * 2, d + bank * 2, 0]])
    for (const [sx, sz] of [[-1, 1], [1, 1], [1, -1], [-1, -1]])
      vertices.push(sx * width / 2, y, sz * depth / 2);
  const indices = [0, 1, 2, 0, 2, 3];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    indices.push(i, i + 4, j + 4, i, j + 4, j);
  }
  add({ t: 'mesh', nm, p: [x, 0, z], vertices, indices,
    vert: false, color: stone, tex: 'jungle', edgeGrinding: false });
};
const roundedRing = (radius: number): [number, number][] => {
  const points: [number, number][] = [];
  for (const [x, z, start] of [[-33, 58, 0.5], [-33, -58, 1], [33, -58, 1.5], [33, 58, 0]])
    for (let i = 0; i <= 16; i++) {
      const angle = (start + i / 32) * Math.PI;
      points.push([x + Math.cos(angle) * radius, z + Math.sin(angle) * radius]);
    }
  return points;
};

platform('Continuous park foundation', [0, -2, -46], [120, 4, 172], '#8d9a7a');
add({
  t: 'vertramp', nm: 'Jade perimeter bowl', p: [0, 0, -46],
  pts: roundedRing(12),
  closed: true, vkind: 'quarter', w: 0.5, rise: 3.6, arc: 90, lipRise: 0.8, deck: 7.4,
  color: jade, tex: 'jungle',
});
// The barrier is OUTSIDE the deck, with the full foundation beneath it.
// Rounded corners match the bowl so a deck rider cannot enter a blind pocket.
add({
  t: 'wallpath', nm: 'Outer deck parapet', p: [0, -6, -46],
  pts: roundedRing(24.5),
  closed: true, w: 1.5, rise: 11.6, collisionHeight: 44,
  containment: true, color: '#72866d', tex: 'moss',
});
// Wide, four-way funbox: every main approach has a bank and a landing apron.
hip('Temple funbox', -14, -44, 14, 10, 2.4, 8);
rail('Funbox crown', -14, 2.65, -44, 10);
// Low manual line, reachable at either end without needing an ollie.
hip('East manual island', 22, -68, 9, 20, 0.6, 3);
rail('Manual island ledge', 17.5, 0.75, -68, 20);
rail('South flat bar', -22, 0.65, -6, 18);
rail('East diagonal line', 22, 0.7, -24, 17, 28);
// A low broad spine gives an easy transfer line through the north plaza.
hip('North transfer island', 0, -91, 4, 16, 1.8, 7);
rail('North spine rail', 0, 2.05, -91, 18);

// Spectator architecture and vegetation stay beyond the riding/deck envelope.
for (const [x, z, yaw] of [[-72, -38, 90], [72, -46, -90], [0, -147, 180]] as const)
  add({ t: 'decor', dkind: 'roofedtemple', nm: 'Spectator temple', p: [x, 0, z], s: [22, 18, 14], yaw });
for (let i = 0; i < 15; i++) for (const side of [-1, 1]) {
  const z = 40 - i * 12;
  add({ t: 'decor', dkind: 'junglecanopy', p: [side * (65 + i % 3 * 3), 0, z], s: [18, 23 + i % 3 * 2, 18], yaw: i * 47 });
  add({ t: 'decor', dkind: 'jungleleaf', p: [side * 61, 0, z - 3], s: [6, 5, 6], yaw: i * 63 });
}
for (const z of [46, -138]) for (const x of [-44, -22, 0, 22, 44]) {
  add({ t: 'decor', dkind: 'junglepalmtree', p: [x, 0, z], s: [12, 19, 12], yaw: x * 12 });
  add({ t: 'decor', dkind: 'junglecliff', p: [x, -7, z + (z > 0 ? 10 : -10)], s: [25, 28, 16], yaw: 5 });
}
for (const x of [-56, 56]) for (const z of [-16, -76])
  add({ t: 'torch', nm: 'Deck brazier', p: [x, 4.4, z], rise: 2.3, w: 0.7 });

export const JUNGLE_CUP_LEVEL: CustomLevelData = {
  v: 1, name: 'Jungle Cup', spawn: [0, 0.1, 14], killY: -18,
  skatepark: true, sky: 'day', jungleAtmosphere: true, keepPlayFog: true,
  atmosphere: { fogNear: 85, fogFar: 220, drawDistance: 290 },
  components,
};
