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
const hip = (nm: string, x: number, z: number, w: number, d: number, h: number, bank: number, color = stone) => {
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
    vert: false, color, tex: 'jungle', edgeGrinding: false });
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
// Transition toes, channel beds and stair landings join this floor at y=0.
// The foundation is the visual underlay at those shared planes, without
// lifting any ride surface or adding a lip to its collision geometry.
components[components.length - 1].depthBias = 2;
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

// The original perimeter and five street lines remain the fast continuous
// loop. The interior adds distinct sessions, connected by clear flat lanes.
// See docs/JUNGLE_CUP_LAYOUT.md for the competition-layout references.
const surface = (nm: string, p: [number, number, number], vertices: number[], indices: number[], color: string) => {
  // Vertical stair risers collapse one edge of the side apron. Omit those
  // zero-area triangles, retaining the actual risers and all ride surfaces.
  const triangles: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
    const ux = vertices[b] - vertices[a], uy = vertices[b + 1] - vertices[a + 1], uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a], vy = vertices[c + 1] - vertices[a + 1], vz = vertices[c + 2] - vertices[a + 2];
    if (Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) > 1e-7)
      triangles.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  add({ t: 'mesh', nm, p, vertices, indices: triangles, vert: false,
    color, tex: 'pavement', edgeGrinding: false });
};
const pathRail = (nm: string, p: [number, number, number], pts: NonNullable<CustomComponent['pts']>) =>
  add({ t: 'rail', nm, p, pts, color: gold });
const pocketRing: [number, number][] = [];
for (const [x, z, start] of [[-2, 7, .5], [-2, -7, 1], [2, -7, 1.5], [2, 7, 0]])
  for (let i = 0; i <= 8; i++) {
    const a = (start + i / 16) * Math.PI;
    pocketRing.push([x + Math.cos(a) * 3, z + Math.sin(a) * 3]);
  }
// A small raised bowl is approachable from all sides. Its gentle outside
// apron is part of the same surface, rather than a hidden vertical back.
add({ t: 'vertramp', nm: 'Jade pocket bowl', p: [-27, 0, -88.5], pts: pocketRing,
  closed: true, vkind: 'quarter', w: .4, rise: 3.6, arc: 65,
  deck: 1, outerBank: 5, color: '#79a9a2', tex: 'pavement' });
hip('Pocket bowl transfer spine', -27, -88.5, 4, 1, .9, 2, '#d0ba8e');
rail('Pocket spine coping', -27, 1.02, -88.5, 4, 90);

// A small stair set with wide rollable sides and a bank at its back. The
// street session can be entered uphill, crossed sideways or taken downhill.
{
  const profile = [[7, 0], [3, 0], [2.5, 0], [2.5, .25], [1.65, .25],
    [1.65, .5], [.8, .5], [.8, .75], [0, .75], [0, 1], [-4, 1], [-8, 0]];
  const vertices: number[] = [], indices: number[] = [];
  for (const [z, y] of profile) vertices.push(-7.5, 0, z, -4, y, z, 4, y, z, 7.5, 0, z);
  for (let j = 0; j < profile.length - 1; j++) for (let i = 0; i < 3; i++) {
    const a = j * 4 + i, b = a + 4;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
  surface('Four-step temple plaza', [-6, 0, -14], vertices, indices, '#caba9c');
  pathRail('Temple stair handrail', [-6, .65, -14], [[0, 4], [0, 2.6, 0, 0], [0, -.4, 0, 1], [0, -3.4, 0, 1]]);
}
hip('Sun terrace manual pad', 14, -2, 10, 6, .5, 2.5, '#c78b62');
pathRail('Sun terrace curved ledge', [14, .64, -2], [[-4, 1.5], [3, 1.5, 1], [4, .5, 1], [4, -2.5]]);

// A round, gently eased hip offers diagonals between the temple box and the
// east rhythm lane. A crescent of coping makes the top another combo choice.
{
  const vertices = [0, 1.4, 0], indices: number[] = [];
  const segments = 48, rings = 12;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, r = 2.4 + 4.6 * t, y = 1.4 * (1 + Math.cos(Math.PI * t)) / 2;
    for (let i = 0; i < segments; i++) {
      const a = i / segments * Math.PI * 2;
      vertices.push(Math.cos(a) * r, y, Math.sin(a) * r);
    }
  }
  for (let i = 0; i < segments; i++) indices.push(0, 1 + (i + 1) % segments, 1 + i);
  for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
    const a = 1 + j * segments + i, b = 1 + j * segments + (i + 1) % segments;
    const c = a + segments, d = b + segments;
    indices.push(a, b, d, a, d, c);
  }
  surface('Sun wheel hip', [13, 0, -40], vertices, indices, '#bc805d');
  pathRail('Sun wheel crescent', [13, 1.54, -40], Array.from({ length: 25 }, (_, i) => {
    const a = i / 24 * Math.PI * 1.5;
    return [Math.cos(a) * 2.2, Math.sin(a) * 2.2] as [number, number];
  }));
}
// Rounded rollers blend to the floor and to their sides. They can be pumped
// in sequence, ollied across, or crossed from the manual island without an
// exposed end face catching the board.
for (const [z, height, length] of [[-25, .7, 11], [-47, 1.15, 11], [-68, .9, 13]]) {
  const vertices: number[] = [], indices: number[] = [];
  const nx = 20, nz = 24;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx * 2 - 1, v = 1 - j / nz * 2;
    const y = height * (1 + Math.cos(Math.PI * u)) * (1 + Math.cos(Math.PI * v)) / 4;
    vertices.push(u * 5, y, v * length / 2);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + nx + 1;
    indices.push(a, a + 1, b + 1, a, b + 1, b);
  }
  surface(`East rhythm roller ${height}`, [37, 0, z], vertices, indices, '#92aab1');
}
pathRail('Rhythm S rail', [37, .85, -23], [[-3, 0], [-3, -4, 1.5, .3], [3, -9, 2, .05], [3, -15]]);
pathRail('Rhythm to manual rail', [34, .75, -59], [[3, 1], [3, -3, 2], [0, -6, 2], [0, -13]]);

// Low banked channels make the manual/grind routes read as continuous
// lines. Their wide flat beds and gentle bends remain open to cross traffic.
add({ t: 'vertramp', nm: 'Sun channel', p: [14, 0, -10],
  pts: [[0, 0], [0, -6, 8], [-2, -13, 8], [-2, -21]], vkind: 'half',
  w: 3.2, rise: 2, arc: 40, outerBank: 2, vert: false, color: '#b8ad8d', tex: 'pavement' });
add({ t: 'vertramp', nm: 'Temple to bowl channel', p: [-24, 0, -57.5],
  pts: [[0, 0], [-1, -5], [-2, -10.5]], vkind: 'half',
  w: 3, rise: 2.4, arc: 35, outerBank: 2, vert: false, color: '#87a69a', tex: 'pavement' });

// Restrained floor inlays give the different sessions a readable identity.
// They are ordinary supported surfaces, only 1.5 cm above the foundation.
for (const [x, z, r, color] of [[0, 9, 2.8, '#d1b577'], [13, -40, 7.5, '#d2b483']] as const) {
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    vertices.push(Math.cos(a) * (r - .12), .015, Math.sin(a) * (r - .12),
      Math.cos(a) * (r + .12), .015, Math.sin(a) * (r + .12));
  }
  for (let i = 0; i < 48; i++) {
    const a = i * 2, b = (i + 1) % 48 * 2;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  surface('Sun inlay', [x, 0, z], vertices, indices, color);
}

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
  atmosphere: { backdrop: 'sky', fogNear: 115, fogFar: 310, fogColor: '#b8d2ca',
    drawDistance: 520, shadowStrength: .8 },
  components,
};
