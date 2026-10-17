import type { CustomComponent, CustomLevelData } from '../level';

// A fictional monsoon-jungle gauntlet. The pressure hazards are native nitro
// contacts buried below the mud; the continuous root trail is actually clear.
export const MINEFIELD_END = 252;
export const minefieldCenter = (s: number) => 5.2 * Math.sin(s / 43) - 1.8 * Math.sin(s / 18);
export const minefieldTrail = (s: number) => minefieldCenter(s) + 2.6 * Math.sin((s - 10) / 16);
export const MINEFIELD_CHECKPOINTS = [64, 126, 190];
export const MINEFIELD_PIT = { from: 148, to: 153 };
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
const section = (s: number) => 10 + Math.min(3, Math.max(0, Math.floor(s / 64)));
const point = (s: number, y = 0, u = 0): [number, number, number] => [minefieldCenter(s) + u, y, -s];
const rnd = (n: number) => { const f = Math.sin(n * 127.1 + 311.7) * 43758.5453; return f - Math.floor(f); };

function ribbon(name: string, from: number, to: number, width: number, y: number,
  center: (s: number) => number, color: string, tex: string, solid = true, grp = 1) {
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const steps = Math.ceil((to - from) / 1.5);
  for (let i = 0; i <= steps; i++) {
    const s = from + (to - from) * i / steps, x = center(s);
    vertices.push(x - width / 2, y, -s, x + width / 2, y, -s);
    uvs.push(0, s / 4, width / 4, s / 4);
    if (i < steps) { const k = i * 2; indices.push(k, k + 1, k + 3, k, k + 3, k + 2); }
  }
  add({ t: 'mesh', nm: name, p: [0, 0, 0], vertices, indices, uvs,
    tex, color, solid, edgeGrinding: false, grp });
}

// Ground is level where the pressure contacts meet it. The banks and root
// relief provide the uneven jungle silhouette without floating hidden mines.
for (const [a, b] of [[-16, 148], [153, 268]]) {
  ribbon('Waterlogged jungle floor', a, b, 14.4, 0, minefieldCenter, '#71664a', 'dirt');
  ribbon('Worn root trail / safe footing', a, b, 2.25, .045, minefieldTrail, '#a19a6a', 'treehouse-loam');
}
add({ t: 'pit', nm: 'Deep monsoon washout', p: point(150.5, -2.4), s: [18, 1, 5], color: '#102421', grp: 12 });
// The bridge is a normal solid surface: falling off it really reaches the pit.
ribbon('Narrow timber over the washout', 145, 156, 2.25, .15, minefieldTrail, '#8e845c', 'treehouse-timber', true, 12);

for (const side of [-1, 1]) {
  const pts = Array.from({ length: 73 }, (_, i) => {
    const s = -18 + i * 4; return [minefieldCenter(s) + side * 9.5, -s, 0] as [number, number, number];
  });
  add({ t: 'wallpath', nm: 'Steep enclosed earth bank', p: [0, -1.4, 0], pts, w: 5.2, rise: 2.6, collisionHeight: 9,
    curve: 'spline', containment: true, color: '#4a4930', tex: 'dirt', edgeGrinding: false, grp: 2 });
  // Dense foreground leaves, an opaque middle layer, and overlapping crowns.
  for (let s = -14, i = 0; s < 270; s += 5.2, i++) {
    const u = side * (7.1 + rnd(i + side * 74) * 1.5);
    add({ t: 'decor', dkind: 'trialsv3thicket', nm: 'Dense trail-side undergrowth', p: point(s, .3, u),
      s: [5.2, 4.4 + rnd(i) * 1.4, 5.6], yaw: side * 90 + rnd(i * 2) * 30, scenerySolid: false, grp: 2 });
    if (i % 2 === 0) add({ t: 'decor', dkind: 'treehousesugarcane', nm: 'Bamboo-like cane wall',
      p: point(s + 1, 1.3, side * 8.4), s: [4, 8 + rnd(i) * 3, 3.2], yaw: i * 47, scenerySolid: false, grp: 2 });
    add({ t: 'decor', dkind: i % 2 ? 'junglefern' : 'jungleleaf', nm: 'Ferns hiding the bank',
      p: point(s - 1, .02, side * (5.9 + rnd(i + 33) * .5)), s: [2.8, 1.8, 3], yaw: i * 67, scenerySolid: false, grp: 2 });
    if (i % 3 === 0) add({ t: 'decor', dkind: 'treehousetree', nm: 'Interlocking forest trunks',
      p: point(s, .2, side * 11.5), s: [18, 20, 16], yaw: i * 71, scenerySolid: false, grp: 2 });
  }
}
for (let s = -10, i = 0; s <= 270; s += 8.5, i++) {
  add({ t: 'decor', dkind: 'trialsv3bough', nm: 'Closed low jungle canopy', p: point(s, 8.2 + rnd(i) * 1.3),
    s: [20, 6.5, 12], yaw: i % 2 ? 180 : 0, scenerySolid: false, grp: 3 });
  for (const side of [-1, 1]) add({ t: 'decor', dkind: 'vines', nm: 'Hanging liana curtain',
    p: point(s + 2, 8.5, side * 5.4), rise: 3.4 + rnd(i + side) * 2.1, n: 3, grp: 3 });
}
// Break the flat mud with shallow puddles, fallen timber and scattered leaves.
for (let s = 23, i = 0; s < 240; s += 9, i++) {
  const side = i % 2 ? 1 : -1;
  if (s > 142 && s < 158) continue;
  ribbon('Still black-water puddle', s, s + 3.1, 2.2, .012,
    v => minefieldCenter(v) + side * 4.9, '#1a302b', 'solid', false, 4);
  if (i % 3 === 0) add({ t: 'decor', dkind: 'carvedlog', nm: 'Rotting bank timber',
    p: point(s + 3, .1, side * 5.4), s: [4.1, .6, .8], yaw: side * 14, solid: false, scenerySolid: false, grp: 4 });
}

// Each field is separated by a genuinely safe checkpoint clearing. A player's
// foot needs ~0.4m beyond the 0.48m plate; the 1.85m exclusion gives real margin.
export const MINEFIELD_MINES: [number, number, number][] = [];
for (let s = 21, row = 0; s < 239; s += 1.32, row++) {
  if (MINEFIELD_CHECKPOINTS.some(cp => Math.abs(cp - s) < 5.4) || (s > 143 && s < 158)) continue;
  for (let col = 0; col < 11; col++) {
    const x = minefieldCenter(s) - 6.15 + col * 1.23 + (rnd(row * 19 + col) - .5) * .14;
    const z = -s + (rnd(row * 23 + col + 5) - .5) * .12;
    if (Math.abs(x - minefieldTrail(-z)) < 1.85) continue;
    const p: [number, number, number] = [x, -.88, z];
    MINEFIELD_MINES.push(p);
    add({ t: 'crate', kind: 'nitro', invisible: true, p, nm: 'Buried pressure mine', grp: section(s) });
  }
}

// Reclaimed supply shelters punctuate the route; warm lamps make retries legible.
for (const s of [6, ...MINEFIELD_CHECKPOINTS, 246]) {
  const x = minefieldTrail(s), g = section(s);
  add({ t: 'platform', nm: 'Root-bound checkpoint clearing', p: [x, -.14, -s], s: [6.6, .3, 7.6],
    tex: 'treehouse-loam', color: '#8d825e', edgeGrinding: false, grp: g });
  for (const side of [-1, 1]) {
    add({ t: 'torch', nm: 'Sheltered trail lantern', p: [x + side * 2.8, .05, -s], rise: 1.55, w: .6, grp: g });
    add({ t: 'wall', nm: 'Abandoned supply shelter post', p: [x + side * 3.1, 0, -s - 1.8],
      s: [.23, 3.1, .23], color: '#57543d', tex: 'wood', edgeGrinding: false, grp: g });
  }
  add({ t: 'mesh', nm: 'Sagging olive canvas shelter', p: [x, 3.2, -s - 1.8],
    vertices: [-3.6, 0, -1.6, 0, .55, -1.6, 3.6, 0, -1.6, -3.6, 0, 1.6, 0, .55, 1.6, 3.6, 0, 1.6],
    indices: [0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2], tex: 'treehouse-canvas', color: '#4e593d',
    doubleSided: true, solid: false, edgeGrinding: false, grp: g });
  if (MINEFIELD_CHECKPOINTS.includes(s)) add({ t: 'checkpoint', nm: 'Jungle refuge', p: [x, .02, -s], grp: g });
}
for (let s = 14; s < 245; s += 8) {
  if (s > 145 && s < 155) continue;
  add({ t: 'wumpa', nm: 'Follow the exposed roots', p: [minefieldTrail(s), 1, -s], grp: section(s) });
}
add({ t: 'clock', nm: 'Optional trial / off the main trail', p: point(10, .03, 5.1), grp: 10 });
add({ t: 'crystal', nm: 'Deep-jungle recovery', p: [minefieldTrail(232), 1.2, -232], grp: 13 });
add({ t: 'gate', nm: 'Extraction clearing', p: [minefieldTrail(252), .02, -252], grp: 13 });
// Ordered camera nodes follow the corridor, never the decorative zigzag.
for (let s = -12; s <= 268; s += 8) add({ t: 'camnode', p: point(s), radius: 16, grp: 5 });

export const JUNGLE_MINEFIELD_LEVEL: CustomLevelData = {
  v: 1, name: 'No-Man’s Grove', spawn: [minefieldTrail(3), .12, -3], startWarpPad: false, killY: -12,
  sky: 'night', jungleAtmosphere: true, jungleDepthFade: false, keepPlayFog: true,
  cameraRig: { camDist: 8.6, camHeight: 4.1, camPitch: 17, camFov: 59 }, cameraLookAhead: 4, cameraAirLift: .45,
  atmosphere: { backdrop: 'fog', fogEnabled: true, fogNear: 9, fogFar: 53, fogColor: '#142923',
    ambientSky: '#8da48c', ambientGround: '#4a4934', ambientIntensity: 1.35,
    sunColor: '#abc8b7', sunIntensity: .55, sunDirection: [-.35, .8, -.3],
    fillColor: '#839e8c', fillIntensity: .4, shadowStrength: .8, drawDistance: 100,
    fallbackStars: false, fallbackRidges: false, fallbackSunColor: null },
  components: C,
  groups: [{ id: 1, nm: 'Mud and safe root trail', editorOnly: true }, { id: 2, nm: 'Impenetrable jungle banks', editorOnly: true },
    { id: 3, nm: 'Canopy and hanging vines', editorOnly: true }, { id: 4, nm: 'Monsoon debris', editorOnly: true },
    { id: 5, nm: 'Ordered jungle camera', editorOnly: true },
    ...['The bamboo mouth', 'Black-water thicket', 'The broken crossing', 'Extraction alley'].map((nm, i) => ({ id: 10 + i, nm, editorOnly: true }))],
};
