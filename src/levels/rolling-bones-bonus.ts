import type { CustomComponent, CustomLevelData } from '../level';

type P = [number, number, number];
const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };
const prop = (dkind: CustomComponent['dkind'], nm: string, p: P, s: P, color = '#9aa4b8', yaw = 0): void =>
  add({ t: 'decor', dkind, nm, p, s, color, yaw, solid: false, scenerySolid: false, grp: 90 });
const mesh = (nm: string, p: P, vertices: number[], indices: number[], color: string, emissive?: string): void =>
  add({ t: 'mesh', nm, p, vertices, indices, color, emissive, tex: 'solid', doubleSided: true,
    solid: false, scenerySolid: false, grp: 90 });

function oval(nm: string, p: P, s: P, color: string, emissive?: string): void {
  const vertices: number[] = [], indices: number[] = [], segments = 16, bands = 8;
  for (let j = 0; j <= bands; j++) for (let i = 0; i <= segments; i++) {
    const a = j / bands * Math.PI, b = i / segments * Math.PI * 2;
    vertices.push(Math.sin(a) * Math.cos(b) * s[0] / 2, (Math.cos(a) + 1) * s[1] / 2, Math.sin(a) * Math.sin(b) * s[2] / 2);
    if (j < bands && i < segments) {
      const k = j * (segments + 1) + i;
      indices.push(k, k + segments + 1, k + 1, k + 1, k + segments + 1, k + segments + 2);
    }
  }
  mesh(nm, p, vertices, indices, color, emissive);
}

function bone(nm: string, a: P, b: P, width: number): void {
  const d = b.map((n, i) => n - a[i]), length = Math.hypot(...d);
  const n: P = [-d[1] / length * width / 2, d[0] / length * width / 2, 0];
  const vertices: number[] = [];
  for (const p of [a, b]) for (const [side, depth] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
    vertices.push(p[0] + n[0] * side, p[1] + n[1] * side, p[2] + width / 2 * depth);
  mesh(nm, [0, 0, 0], vertices,
    [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7], '#bdc9cc');
  oval(nm + ' rounded joint', [a[0], a[1] - width * .65, a[2]], [width * 1.45, width * 1.3, width * 1.45], '#c7ced0');
}

const deck = (a: number, b: number, y: number, nm: string): void => {
  add({ t: 'platform', nm, p: [(a + b) / 2, y - .65, 0], s: [b - a, 1.3, 6.4],
    tex: 'stone', color: '#929bb0', grp: 1 });
  for (let x = a + 2; x < b; x += 6) {
    prop('stoneshaft', nm + ' submerged pier', [x, -10, 0], [2.2, y + 9, 3], '#616d89');
    prop('stonecapital', nm + ' cornice', [x, y - 1.55, 0], [4, .9, 5.8]);
  }
};
const crate = (x: number, y: number, kind: CustomComponent['kind'], nm: string): void =>
  add({ t: 'crate', p: [x, y, 0], kind, nm, grp: 2 });

// A vertical ascent, a continuous timed crossing and a descending exit make
// this a different route from Ripcord's stairs and switch-revealed islands.
export const MOONBONE_DECKS = [[-12, 8, 0], [16, 32, 6], [48, 63, 6], [74, 94, 0]] as const;
for (const [a, b, y] of MOONBONE_DECKS) deck(a, b, y, y ? 'Moonbone upper gallery' : 'Moonbone crypt landing');
add({ t: 'mover', nm: 'Rising sarcophagus', p: [12, 3, 0], s: [5.8, 1.4, 6.4],
  axis: 'y', amp: 3, speed: .65, phase: -Math.PI / 2, tex: 'stone', color: '#bcc6ce', grp: 3 });
for (const x of [34, 37.7, 41.4, 45.1]) add({ t: 'crumble', nm: 'Breakaway vertebra ' + x,
  p: [x, 6, 0], s: [3.3, .9, 6.4], shake: .95, speed: 14, tex: 'stone', color: '#c5d0ce', grp: 3 });
deck(65, 68.5, 4.2, 'Descending jawbone perch');
deck(70.5, 73, 2.1, 'Lower jawbone perch');

crate(-1, 0, 'wood', 'Crypt offering'); crate(-1, .96, 'wood', 'Crypt offering cap');
crate(4, 0, 'mystery', 'Sarcophagus waiting cache');
crate(19, 6, 'wood', 'Upper gallery cache'); crate(19, 6.96, 'wood', 'Upper gallery cap');
crate(24, 6, 'mystery', 'Ivory arch cache'); crate(28, 6, 'wood', 'Last cache before the bones');
crate(52, 6, 'wood', 'Far crypt cache'); crate(52, 6.96, 'wood', 'Far crypt cap');
crate(56, 6, 'mystery', 'Moon-eye offering');
crate(60, 6, 'bouncy', 'Moon-eye arrow'); crate(60, 13.2, 'life', 'Moon-eye high life');
crate(77, 0, 'wood', 'Vault cache'); crate(77, .96, 'wood', 'Vault cache cap');
crate(81, 0, 'mystery', 'Last moonbone mystery'); crate(85, 0, 'life', 'Vault life');
add({ t: 'gate', nm: 'Moonbone return to Rolling Bones', p: [90, 0, 0], yaw: 90, grp: 1 });
for (const [x, y] of [[12, 2], [12, 4], [12, 6], [33, 7.7], [36, 8.1], [39, 8.3], [42, 8.1], [45, 7.7], [65, 7], [68, 5.6], [71, 4.6], [74, 2.8]])
  add({ t: 'wumpa', p: [x, y, 0], grp: 2 });

// Open-front ossuary: pale curved ribs, sculpted skulls and dark niches all
// remain behind the play plane, so the scenery cannot mask a missing landing.
for (const x of [4, 40, 80]) {
  for (let i = 0; i < 10; i++) {
    const point = (n: number): P => [x + Math.cos(n / 10 * Math.PI) * 13, -5 + Math.sin(n / 10 * Math.PI) * 21, -17];
    bone('Giant moonlit rib arch', point(i), point(i + 1), .85);
  }
  prop('templewall', 'Ossuary rear foundation', [x, -10, -20], [33, 9, 5], '#4b5875');
  prop('coastv2buttress', 'Deep crypt foundations', [x, -18, -20], [25, 13, 16], '#5d6885');
}
for (const [x, y] of [[-4, 0], [25, 6], [56, 6], [83, 0]]) {
  prop('templewall', 'Carved tomb behind the walkway', [x, y - 1.5, -9], [12, 6.8, 2.5], '#68728b');
  for (const side of [-1, 1]) {
    prop('stoneshaft', 'Crypt door pier', [x + side * 3.4, y - 1, -7.4], [1.2, 5.7, 1.2], '#b4becb');
    prop('stonecapital', 'Crypt door capital', [x + side * 3.4, y + 4.7, -7.4], [1.9, .6, 1.8]);
  }
  prop('stonelintel', 'Moonstone crypt lintel', [x, y + 5.25, -7.4], [9, 1, 2], '#aebbd0');
  // A dark recess and a small cold-glowing relic give every crypt a readable face.
  mesh('Shadow inside the crypt', [x, y + 1.5, -7.6], [-2.7, -2.5, 0, 2.7, -2.5, 0, 2.7, 2.5, 0, -2.7, 2.5, 0], [0, 1, 2, 0, 2, 3], '#11182c');
  oval('Cold moonstone in the tomb', [x, y + 2.4, -7.25], [.55, .8, .4], '#aacfff', '#476aaf');
  add({ t: 'torch', nm: 'Small crypt vigil flame', p: [x - 4.4, y - .1, -4.8], rise: 1.3, w: .42, grp: 90 });
}
for (const x of [11, 59, 89]) {
  const y = x === 59 ? 7.6 : 1;
  oval('Ancient skull crown', [x, y, -15], [7.5, 7, 4.5], '#b8c5ce');
  oval('Ancient skull jaw', [x, y - 1.1, -13.8], [4.5, 2, 2.7], '#a9bac9');
  for (const side of [-1, 1]) {
    oval('Deep skull eye socket', [x + side * 1.65, y + 2.5, -12.9], [2, 2.3, .25], '#101a31');
    oval('Blue ember in the skull eye', [x + side * 1.65, y + 3.1, -12.72], [.45, .6, .12], '#9acbff', '#456ba5');
  }
  mesh('Skull nose hollow', [x, y + 1.65, -12.55], [-.55, 0, 0, .55, 0, 0, 0, 1.3, 0], [0, 1, 2], '#152139');
  for (let i = -2; i <= 2; i++) prop('block', 'Individual ivory tooth', [x + i * .62, y + .1, -12.5], [.48, .9, .65], '#d3d9d9');
}
// Source-owned crescent, in the distant sky; no extra environment download.
const moonVertices: number[] = [], moonIndices: number[] = [];
for (let i = 0; i <= 40; i++) {
  const a = -Math.PI / 2 + i / 40 * Math.PI;
  moonVertices.push(Math.cos(a) * 9, Math.sin(a) * 9, 0, Math.cos(a) * 4, Math.sin(a) * 9, 0);
  if (i < 40) { const k = i * 2; moonIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
}
mesh('Crescent moon over the ossuary', [30, 26, -55], moonVertices, moonIndices, '#b4c6eb', '#52678e');

add({ t: 'mesh', nm: 'Moonbone blackwater reflecting the night sky', p: [40, -6, -10],
  vertices: [-80, 0, -45, 80, 0, -45, 80, 0, 30, -80, 0, 30], indices: [0, 2, 1, 0, 3, 2], uvs: [0, 0, 24, 0, 24, 12, 0, 12],
  solid: false, scenerySolid: false, doubleSided: true, tex: 'custard-water', materialStyle: 'jungle-stream',
  color: '#455e85', opacity: .9, lethal: true, castShadow: false, grp: 90 });
add({ t: 'pit', nm: 'Moonbone blackwater contact', p: [40, -6.3, 0], s: [136, 1, 18], invisible: true, grp: 3 });
for (const z of [-.83, .83]) add({ t: 'wall', nm: 'Bonus depth boundary', p: [40, -16, z], s: [136, 56, .6], invisible: true, grp: 4 });
add({ t: 'camnode', p: [-16, 0, 0], grp: 4 }); add({ t: 'camnode', p: [100, 0, 0], grp: 4 });
add({ t: 'camnode', nm: 'Moonbone side view', p: [40, 8, 0], s: [142, 54, 18], cameraView: true, radius: 1,
  cameraPosition: [2, 10, 26], cameraTarget: [2, 5.3, 0], cameraFollowDistance: 26, cameraFollowTargetHeight: 5.3,
  cameraIntroDistance: 0, cameraFov: 49, cameraAspect: 1.3, grp: 4 });

export const ROLLING_BONES_BONUS_LEVEL: CustomLevelData = {
  v: 1, name: 'Bonus: Moonbone Vault', spawn: [-7, .12, 0], killY: -13, hudMode: 'bonus', sky: 'night',
  startWarpPad: false, keepPlayFog: true, cameraAirLift: .85,
  atmosphere: { fogEnabled: true, fogColor: '#14213a', fogNear: 65, fogFar: 195,
    ambientSky: '#93b4e2', ambientGround: '#293655', ambientIntensity: 1.25,
    sunColor: '#c2dcff', sunIntensity: 1.6, sunDirection: [-.45, .75, .4],
    fillColor: '#6a8bce', fillIntensity: .55, drawDistance: 240, shadowStrength: .64 },
  components,
  groups: [{ id: 1, nm: 'Moonbone crypt and upper galleries' }, { id: 2, nm: 'Sixteen moonbone offerings' },
    { id: 3, nm: 'Rising sarcophagus and breakaway spine' }, { id: 4, nm: 'Side-view framing', editorOnly: true },
    { id: 90, nm: 'Moonlit ossuary and blackwater', editorOnly: true }],
};
