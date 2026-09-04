import type { CustomComponent, CustomLevelData } from '../level';

// A new, additive benchmark course: nothing in the existing lab or campaign
// pack is replaced. All scenery and gameplay remain ordinary editor components.
type Point = readonly [number, number, number];
const components: CustomComponent[] = [];
const C = { teal: '#318e94', dark: '#234c60', brass: '#daa857', ivory: '#ecdab1', rose: '#b86863' };
const G = { overture: 1, keys: 2, harp: 3, hammers: 4, finale: 5, scenery: 6, camera: 7 };
const round = (n: number) => Math.round(n * 1000) / 1000;
const add = (c: CustomComponent) => components.push(c);
const deck = (name: string, x: number, y: number, z: number, w: number, d: number, grp: number, color = C.teal) => {
  add({ t: 'platform', nm: name, p: [x, y - 0.6, z], s: [w, 1.2, d], color, tex: 'plank', grp });
  // Underside trim is scenery, never a second overlapping collider.
  add({ t: 'decor', dkind: 'block', p: [x, y - 1.45, z], s: [w + 0.3, 0.3, d + 0.3], tex: 'solid', color: C.brass, grp: G.scenery });
};
const block = (x: number, y: number, z: number, w: number, h: number, d: number, color: string, yaw = 0) =>
  add({ t: 'decor', dkind: 'block', p: [x, y + h / 2, z], s: [w, h, d], color, tex: 'solid', yaw, grp: G.scenery });
const box = (x: number, y: number, z: number, kind: NonNullable<CustomComponent['kind']>, grp: number) =>
  add({ t: 'crate', p: [x, y, z], kind, grp });
const fruit = (x: number, y: number, z: number, grp: number) =>
  add({ t: 'wumpa', p: [round(x), round(y), round(z)], grp });
const checkpoint = (x: number, y: number, z: number, grp: number) =>
  add({ t: 'checkpoint', p: [x, y, z], grp });

const overture: Point[] = [
  [0, 48, 1], [0, 48, -14], [8, 44, -44], [16, 39, -80],
  [2, 35, -114], [-12, 31, -146], [-12, 31, -158],
];
const landingTurn: Point[] = [
  [-12, 29, -180], [-8, 28, -195], [6, 26, -215], [18, 26, -231],
];
const crescendo: Point[] = [
  [18, 28, -427], [8, 25, -457], [-10, 20, -492], [-20, 14, -527],
  [-8, 10, -561], [14, 6, -595], [14, 6, -612],
];

function path(name: string, points: Point[], w: number, grp: number, trough = false) {
  const start = points[0];
  add({
    t: trough ? 'vertramp' : 'terrain', nm: name, p: [...start],
    w: trough ? w / 2 : w, amp: 0, curve: 'spline',
    ...(trough ? { vkind: 'half' as const, rise: 3.4, arc: 52, deck: 0, vert: false } : { berms: true }),
    color: C.teal, tex: 'metal', grp,
    pts: points.map(p => [round(p[0] - start[0]), round(p[2] - start[2]), 0, round(p[1] - start[1])]),
  });
  // Fruit follows the same gently curved strip; no reactive/new game system.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const steps = Math.max(1, Math.floor(Math.hypot(b[0] - a[0], b[2] - a[2]) / 7));
    for (let j = 1; j <= steps; j++) {
      const t = j / (steps + 1);
      fruit(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + 1, a[2] + (b[2] - a[2]) * t, grp);
    }
  }
}

function organ(x: number, baseY: number, z: number, scale = 1) {
  // Stepped, open-topped organ pipes: batched, visual-only box geometry.
  for (let i = -3; i <= 3; i++) {
    const height = (20 - Math.abs(i) * 3) * scale;
    const px = x + i * 3.3 * scale;
    block(px, baseY, z, 2.2 * scale, height, 2.2 * scale, C.brass);
    block(px, baseY + height - 0.5 * scale, z, 2.7 * scale, 0.6 * scale, 2.7 * scale, C.ivory);
    block(px, baseY + height + 0.11 * scale, z, 1.6 * scale, 0.08 * scale, 1.6 * scale, C.dark);
    block(px, baseY + 2 * scale, z - 1.14 * scale, 1.15 * scale, 2.3 * scale, 0.1 * scale, C.dark);
  }
  block(x, baseY - 2 * scale, z, 24 * scale, 2 * scale, 6 * scale, C.dark);
}
function arch(x: number, y: number, z: number, w: number, height: number) {
  for (const side of [-1, 1]) {
    block(x + side * w / 2, y - 8, z, 1.7, height + 8, 2.2, C.dark);
    block(x + side * w / 2, y + height - 0.8, z, 2.3, 1.2, 2.8, C.brass);
  }
  block(x, y + height, z, w + 2.5, 1.5, 2.8, C.brass);
}

// I. OVERTURE: a forgiving runway, broad steering arcs, then one clean jump.
deck('Overture / launch balcony', 0, 48, 12, 18, 24, G.overture);
add({ t: 'clock', p: [4, 48, 16], grp: G.overture });
add({ t: 'comboorb', p: [-4, 48, 16], grp: G.overture });
box(-5, 48, 7, 'mask', G.overture);
box(5, 48, 7, 'life', G.overture);
path('Overture / brass downhill', overture, 14, G.overture, true);
for (const [x, y, z] of [[7, 44, -44], [15, 39, -80], [1, 35, -114]] as Point[]) {
  box(x, y, z, 'wood', G.overture);
  box(x + 2, y, z - 2, 'wood', G.overture);
}
add({ t: 'ramp', nm: 'First six-metre leap', p: [-12, 31, -155], len: 6, rise: 1, w: 11, color: C.brass, tex: 'metal', grp: G.overture });
fruit(-12, 33, -159, G.overture);
fruit(-12, 33.3, -162, G.overture);
deck('First leap / catch balcony', -12, 29, -173, 18, 18, G.overture);
checkpoint(-8, 28, -195, G.overture);
path('Breathing room / approach the keys', landingTurn, 16, G.overture, true);

// II. XYLOPHONE: seven readable three-metre hops. The long gold strings are
// an optional E/grind bypass: faster, but no key crates and no safe standing.
deck('Xylophone / take-off', 18, 26, -230, 28, 16, G.keys, C.ivory);
checkpoint(18, 26, -231, G.keys);
const keyPositions: Point[] = [];
for (let i = 0; i < 7; i++) {
  const x = 18 + (i % 2 ? 1.5 : -1.5), y = round(26.3 + i * 0.4), z = -244 - i * 10;
  keyPositions.push([x, y, z]);
  if (i === 3 || i === 5) {
    add({ t: 'crumble', nm: `Loose ivory key ${i + 1}`, p: [x, y, z], s: [9, 0.6, 7], shake: 1.15, speed: 20, color: C.ivory, tex: 'plank', grp: G.keys });
  } else deck(`Xylophone / key ${i + 1}`, x, y, z, 9, 7, G.keys, i % 2 ? C.brass : C.ivory);
  fruit(x, y + 1, z + 1, G.keys);
  box(x + (i % 2 ? 2 : -2), y, z - 1, i === 6 ? 'life' : 'wood', G.keys);
  // Resonator beneath each key, outside the collision route.
  block(x, y - 9 - i * 0.7, z, 3.5, 7 + i * 0.7, 4.5, i % 2 ? C.rose : C.teal);
}
for (const x of [7, 29]) {
  add({ t: 'rail', nm: 'Harp string / expert key bypass', p: [x, 26.8, -235], pts: [[0, 0], [0, -25, 0, 0.8], [0, -55, 0, 2], [0, -80, 0, 2.8]], color: C.brass, grp: G.harp });
  for (let i = 0; i < 10; i++) fruit(x, 28.1 + i * 0.28, -239 - i * 7.7, G.harp);
}
deck('Harp / reunion stage', 18, 29, -322, 30, 26, G.harp, C.rose);
checkpoint(18, 29, -321, G.harp);
add({ t: 'crystal', p: [18, 29, -328], grp: G.harp });
box(8, 29, -324, 'multihit', G.harp);
box(28, 29, -324, 'mask', G.harp);
// A small optional bounce solo, returning to the same safe stage.
add({ t: 'trampoline', nm: 'Solo / hold jump for the high note', p: [28, 29.12, -332], s: [4.5, 0.4, 4.5], speed: 16, amp: 1.25, grp: G.harp });
deck('Solo / elevated reward', 35, 33, -332, 6, 8, G.harp, C.brass);
box(35, 33, -332, 'life', G.harp);
for (let i = 0; i < 4; i++) fruit(28 + i * 2, 30.5 + Math.sin(i / 3 * Math.PI) * 4.5, -332, G.harp);

// III. HAMMER TIME: alternate crusher lanes, then three moving keys.
deck('Hammers / left-right rhythm', 18, 29, -354, 18, 40, G.hammers);
add({ t: 'crusher', nm: 'Bass hammer / left', p: [13.5, 29, -342], s: [5, 3.5, 4], cycle: 4.2, phase: 0, grp: G.hammers });
add({ t: 'crusher', nm: 'Treble hammer / right', p: [22.5, 29, -359], s: [5, 3.5, 4], cycle: 4.2, phase: 0.5, grp: G.hammers });
for (let i = 0; i < 6; i++) fruit(i < 3 ? 21 : 15, 30, -338 - i * 5, G.hammers);
box(10.5, 29, -349, 'nitro', G.hammers);
box(25.5, 29, -365, 'nitro', G.hammers);
box(15, 29, -366, 'wood', G.hammers);
deck('Moving keys / waiting lip', 18, 29, -370, 18, 12, G.hammers, C.ivory);
for (let i = 0; i < 3; i++) {
  add({ t: 'mover', nm: `Sliding key ${i + 1}`, p: [18, 29, -382 - i * 10], s: [10, 0.7, 7], axis: 'x', amp: 2.2, speed: 0.7, phase: i * 1.4, grp: G.hammers });
  fruit(18, 30, -382 - i * 10, G.hammers);
}
deck('Crescendo / last checkpoint', 18, 28, -418, 20, 20, G.finale);
checkpoint(18, 28, -418, G.finale);
box(12, 28, -420, 'mask', G.finale);
box(24, 28, -420, 'wood', G.finale);

// IV. CRESCENDO: the route opens into a banked half-pipe trough. No compulsory
// trick input or blind turn: the last straight gives room to line up the leap.
path('Crescendo / singing slide', crescendo, 12, G.finale, true);
for (const p of [[8, 25, -457], [-10, 20, -492], [-20, 14, -527], [-8, 10, -561]] as Point[]) {
  box(p[0] - 1.4, p[1], p[2], 'wood', G.finale);
  box(p[0] + 1.4, p[1], p[2] - 1, 'wood', G.finale);
}
add({ t: 'speedpad', nm: 'Final note / straight boost', p: [14, 6, -603], s: [7, 0.15, 5], speed: 28, cycle: 1.4, grp: G.finale });
add({ t: 'ramp', nm: 'Final note / launch', p: [14, 6, -610], len: 8, rise: 1.2, w: 12, color: C.brass, tex: 'metal', grp: G.finale });
for (let i = 0; i < 5; i++) fruit(14, 8.5 + Math.sin(i / 4 * Math.PI) * 1.4, -612 - i * 2.6, G.finale);
deck('Final chord / generous catch', 14, 5, -642, 26, 44, G.finale, C.ivory);
// The existing level pipeline seats its Nitro-clear ! six metres before the
// gate; leave that central landing/finish approach free for the derived switch.
box(20, 5, -650, 'life', G.finale);
add({ t: 'gate', nm: 'Final chord', p: [14, 5, -656], yaw: 0, grp: G.finale });

// A skyline made of instruments, not asset downloads. Large silhouettes stay
// beside/beyond the playable line, and all decor batches through the engine.
organ(-28, 19, -50, 1.5);
organ(44, 1, -133, 1.7);
organ(-18, 3, -290, 1.8);
organ(52, 2, -360, 1.5);
organ(-50, -13, -515, 1.6);
organ(14, 3, -674, 1.25);
arch(0, 48, 1, 22, 12);
arch(18, 26, -237, 29, 15);
arch(18, 29, -312, 29, 18);
arch(18, 28, -425, 23, 13);
for (const x of [3.5, 32.5]) {
  for (let i = 0; i < 7; i++) {
    const z = -247 - i * 10;
    block(x, 30 + i * 0.4, z, 0.22, 11 - i * 0.5, 0.22, C.brass);
  }
}
// Long lower rails visually tie the scattered keys into one suspended instrument.
for (const x of [0, 36]) block(x, 17, -276, 1.5, 1.5, 90, C.dark);
for (const [x, y, z] of [...overture.slice(1, -1), ...crescendo.slice(1, -1)]) {
  for (const side of [-1, 1]) {
    block(x + side * 11, y - 18, z, 2.2, 22, 2.2, C.dark);
    block(x + side * 11, y + 4, z, 3, 0.8, 3, C.brass);
  }
}

// Smooth mean-centre camera: deliberately NOT the key-to-key zigzag or the
// optional lateral solo. Deck Y also disambiguates the suspended structures.
const camera: Point[] = [
  [0, 48, 24], ...overture, [-12, 29, -173], [-8, 28, -195],
  [6, 26, -215], [15, 26, -230], [18, 26.3, -245],
  [18, 27.2, -266], [18, 28.4, -296], [18, 29, -322],
  [18, 29, -354], [18, 29, -375], [18, 29, -403], [18, 28, -418],
  ...crescendo, [14, 7.2, -614], [14, 5, -629], [14, 5, -668],
];
camera.forEach((p, i) => {
  if (i === 0) add({ t: 'camnode', p: [...p], grp: G.camera });
  if (i === camera.length - 1) return;
  const b = camera[i + 1];
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - p[0], b[2] - p[2]) / 12));
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    add({ t: 'camnode', p: [round(p[0] + (b[0] - p[0]) * t), round(p[1] + (b[1] - p[1]) * t), round(p[2] + (b[2] - p[2]) * t)], grp: G.camera });
  }
});

export const ASTRA_CHIMEWORKS_LEVEL: CustomLevelData = {
  v: 1, name: 'The Chimeworks — Astra', spawn: [0, 48.2, 17], killY: -24,
  sky: 'day', components,
  groups: [
    { id: G.overture, nm: 'I · Overture / downhill and first leap' },
    { id: G.keys, nm: 'II · Xylophone / seven key hops' },
    { id: G.harp, nm: 'Harp strings / expert bypass and solo' },
    { id: G.hammers, nm: 'III · Hammer time / sliding keys' },
    { id: G.finale, nm: 'IV · Crescendo / singing slide' },
    { id: G.scenery, nm: 'Instrument skyline / visual only', editorOnly: true },
    { id: G.camera, nm: 'Camera / smooth principal route', editorOnly: true },
  ],
};

// Shared with geometry validation, never used to steer the actual player.
export const CHIMEWORKS_ROUTE = { overture, landingTurn, crescendo, keyPositions };
