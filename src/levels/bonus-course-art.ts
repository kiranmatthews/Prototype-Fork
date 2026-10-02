import type { CustomAtmosphereData, CustomComponent, DecorKind } from '../level';

export type BonusArtTheme = 'treehouse' | 'jungle' | 'coast' | 'cloud' | 'slipstream' | 'nightworks' | 'beach' | 'street' | 'islands' | 'gate' | 'blockworks' | 'chimeworks' | 'waterpark' | 'afterhours' | 'terraces' | 'skyline' | 'junglecup' | 'waterparkcup' | 'primer' | 'switchyard' | 'gauntlet' | 'pirate' | 'boneyard' | 'reefchief';
type P = [number, number, number];

// Each bonus is a little place in its parent's world. All architecture belongs
// behind the side-on play plane; no decoration can become a secret crate step.
export function bonusCourseArt(theme: BonusArtTheme, end: number): CustomComponent[] {
  const out: CustomComponent[] = [];
  const put = (c: CustomComponent) => out.push({ ...c, solid: false, edgeGrinding: false, grp: 90 });
  const block = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string, tex = 'solid') =>
    put({ t: 'decor', dkind: 'block', nm: name, p: [x, y + h / 2, z], s: [w, h, d], color, tex });
  const asset = (name: string, dkind: DecorKind, p: P, s: P, color = '#ffffff', yaw = 0) =>
    put({ t: 'decor', nm: name, dkind, p, s, color, yaw });
  const mesh = (name: string, p: P, vertices: number[], indices: number[], color: string, emissive?: string) =>
    put({ t: 'mesh', nm: name, p, vertices, indices, color, tex: 'solid', doubleSided: true, ...(emissive ? { emissive } : {}) });
  function beam(name: string, a: P, b: P, w: number, color: string, emissive?: string) {
    const u = b.map((v, i) => v - a[i]) as P, l = Math.hypot(...u);
    const n: P = Math.abs(u[1]) / l > .9 ? [w / 2, 0, 0] : [-u[2], 0, u[0]];
    const nl = Math.hypot(...n); for (let i = 0; i < 3; i++) n[i] *= w / (2 * nl);
    const v: P = [(u[1] * n[2] - u[2] * n[1]) / l, (u[2] * n[0] - u[0] * n[2]) / l, (u[0] * n[1] - u[1] * n[0]) / l];
    const vertices: number[] = [];
    for (const p of [a, b]) for (const [ns, vs] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      vertices.push(...p.map((x, i) => x + ns * n[i] + vs * v[i]));
    const center = a.map((x, i) => (x + b[i]) / 2) as P;
    for (let i = 0; i < vertices.length; i++) vertices[i] -= center[i % 3];
    mesh(name, center, vertices, [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7], color, emissive);
  }
  function ring(name: string, x: number, y: number, z: number, radius: number, width: number, color: string, teeth = false) {
    const v: number[] = [], ids: number[] = [], steps = teeth ? 48 : 24;
    for (let i = 0; i <= steps; i++) {
      const a = i / steps * Math.PI * 2, r = radius + (teeth && i % 4 < 2 ? width * .45 : 0);
      v.push(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(a) * (radius - width), Math.sin(a) * (radius - width), 0);
      if (i < steps) { const k = i * 2; ids.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    mesh(name, [x, y, z], v, ids, color);
  }
  function cone(name: string, x: number, y: number, z: number, bottom: number, top: number, h: number, color: string) {
    const v: number[] = [], ids: number[] = [], n = 12;
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2;
      v.push(Math.cos(a) * bottom, 0, Math.sin(a) * bottom, Math.cos(a) * top, h, Math.sin(a) * top);
      if (i < n) { const k = i * 2; ids.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    mesh(name, [x, y, z], v, ids, color);
  }
  // Legacy library boulders only support scalar w; native meshes retain the
  // authored wide/low silhouettes and tint of clouds and lagoon foundations.
  function oval(name: string, p: P, size: P, color: string) {
    const v: number[] = [], ids: number[] = [], segments = 12, bands = 6;
    for (let band = 0; band <= bands; band++) {
      const pitch = band / bands * Math.PI;
      for (let segment = 0; segment <= segments; segment++) {
        const yaw = segment / segments * Math.PI * 2;
        v.push(Math.sin(pitch) * Math.cos(yaw) * size[0] / 2,
          (Math.cos(pitch) + 1) * size[1] / 2, Math.sin(pitch) * Math.sin(yaw) * size[2] / 2);
        if (band < bands && segment < segments) {
          const a = band * (segments + 1) + segment, b = a + segments + 1;
          ids.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    mesh(name, p, v, ids, color);
  }
  function roof(name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    mesh(name, [x, y, z], [-w / 2, 0, -d / 2, w / 2, 0, -d / 2, 0, h, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2, 0, h, d / 2],
      [0, 2, 1, 3, 4, 5, 0, 3, 5, 0, 5, 2, 2, 5, 4, 2, 4, 1, 0, 1, 4, 0, 4, 3], color);
  }
  const stations = [5, end * .27, end * .54, end * .81, end + 5];
  const sand = '#c5b786', brass = '#bf9657';
  const land = (color: string, tex = 'stone') => block('Scenic bank below the rear buildings', end / 2, -7, -21, end + 36, 5, 26, color, tex);
  const palm = (x: number, z = -19, height = 16) => asset('Distant palm', 'junglepalmtree', [x, -2, z], [height * .8, height, height * .7], '#bbc59a', x * 13);
  const fern = (x: number, z = -10) => asset('Fern on the rear bank', 'junglefern', [x, -2, z], [5, 2.1, 4], '#b3cca0', x * 9);
  function temple(x: number, height: number, color: string, golden = false) {
    const z = golden ? -32 : -23;
    for (let tier = 0; tier < 3; tier++) block('Stepped temple plinth', x, -2 + tier * 1.2, z, 18 - tier * 3.1, 1.2, 12 - tier * 1.4, color, 'stone');
    for (const side of [-1, 1]) {
      const px = x + side * 5.2;
      asset('Carved column base', 'stonebase', [px, 1.6, z], [2.5, .7, 2.5], color);
      asset('Tall sanctuary pier', 'stoneshaft', [px, 2.3, z], [1.9, height - 4, 1.9], color);
      asset('Broad temple capital', 'stonecapital', [px, height - 1.7, z], [3, 1, 3], color);
    }
    block('Temple cornice', x, height - .7, z, 15, .7, 8, golden ? brass : color, 'stone');
    roof('Temple steep stone roof', x, height, z, 16, golden ? 5 : 2.4, 9, golden ? '#c5a462' : '#507567');
    asset('Temple relief panel', 'stonefrieze', [x, 2.4, z + 3], [4, 2.8, .5], golden ? '#dac080' : '#b7bea0');
    fern(x + 8, z + 5);
  }

  switch (theme) {
    case 'treehouse':
      land('#60573e', 'dirt');
      stations.forEach((x, i) => {
        const z = -22 - i % 2 * 6;
        asset('Treehouse supporting trunk', 'treehousehost', [x, -3, z], [14, 15, 10], '#d0bd94');
        asset('High wooden canopy cabin', 'treehousebody', [x, 6.5, z], [8, 6, 6], '#ebd1a5');
        asset('Cabin crown', 'treehousecanopy', [x, 12, z], [27, 9, 20], '#9cad75');
        asset('Cabin balcony', 'treehousebalcony', [x, 6.2, z + 3], [11, 1.6, 3], '#d7bd85');
        for (const side of [-1, 1]) beam('Bamboo balcony brace', [x + side * 4, 6, z + 3], [x + side, 1, z], .4, '#846b42');
        asset('Low canopy planting', 'treehousebush', [x + 7, -2, -11], [7, 4, 5], '#a7c17b');
        fern(x - 7);
        for (let j = 0; j < 3; j++) block('Bamboo grove pole', x - 8 + j * .65, -2, -15, .25, 8 + j, .25, '#7b9860', 'plank');
        if (i < stations.length - 1) {
          const next = stations[i + 1];
          beam('Suspended timber canopy walk', [x + 5, 6.3, z + 3], [next - 5, 6.3, -19 - (i + 1) % 2 * 6], .6, '#aa8957');
          beam('Canopy rope hand line', [x + 5, 7.8, z + 3], [next - 5, 7.8, -19 - (i + 1) % 2 * 6], .13, '#cab986');
        }
      });
      break;
    case 'jungle':
      land('#566749', 'dirt');
      stations.forEach((x, i) => {
        temple(x, 8 + i % 2 * 3, '#a4ae8a');
        asset('Ancient canopy beyond the ruin', 'junglecanopy', [x - 7, -3, -40], [27, 25, 23], '#7b9a78', i * 21);
        asset('Ruined lintel fallen in the planting', 'stonelintel', [x + 9, -1.9, -14], [6, 1.8, 2], '#88987c', 14);
        fern(x - 7); fern(x + 4, -12);
      });
      break;
    case 'coast':
      land('#919482');
      stations.forEach((x, i) => {
        block('Quay warehouse', x, -2, -24, 15, 8 + i % 2 * 3, 10, i % 2 ? '#a8aaa0' : '#a2aaa7', 'pavement');
        roof('Harbour warehouse roof', x, 6 + i % 2 * 3, -24, 17, 2.8, 12, '#5e727b');
        block('Warehouse loading door', x, -1.9, -18.95, 5, 5.5, .1, '#566e71', 'plank');
        for (const side of [-1, 1]) {
          block('Harbour window', x + side * 4.9, 2.8, -18.9, 2.2, 1.8, .15, '#c3d2c2');
          block('Quayside timber bollard', x + side * 6, -3, -9, .75, 3.1, .8, '#795f44', 'plank');
        }
        block('Harbour crane upright', x + 9, -2, -27, .7, 18, .7, '#8a7960', 'metal');
        beam('Harbour crane jib', [x + 9, 16, -27], [x - 3, 15, -27], .6, '#8a7960');
        beam('Crane cable', [x - 3, 15, -27], [x - 3, 10, -27], .1, '#5c6770');
        block('Warehouse sill', x, -.8, -17.8, 17, .5, 2, '#c7c6b3', 'stone');
      });
      block('Still sheltered harbour', end / 2, -5.5, -47, end + 40, .3, 25, '#6296a2');
      break;
    case 'cloud':
      stations.forEach((x, i) => {
        const top = 10 + i % 3 * 3;
        for (const side of [-1, 1]) {
          block('White sky pylon', x + side * 6, -15, -24, 2.5, top + 15, 3, '#d8e4de', 'stone');
          block('Sky pylon gold collar', x + side * 6, top - 1, -24, 3.2, .6, 3.7, '#c9b58e');
          block('Sky pylon foot', x + side * 6, -12, -24, 5, 1.5, 6, '#b8c9cb');
        }
        block('High suspended skybridge', x, top, -24, 18, 1, 7, '#e1e7dc', 'stone');
        roof('Skybridge needle cap', x, top + 1, -24, 5, 3.8, 5, '#b4ced2');
        for (let j = 0; j < 3; j++) oval('Cloud sea lobe', [x - 8 + j * 7, -7 - j % 2, -22 - j * 4], [15, 5, 11], '#e6ecdf');
        ring('Sky pylon halo', x, top + 4, -25, 2.5, .35, '#d3bd81');
      });
      break;
    case 'slipstream':
      stations.forEach((x, i) => {
        block('Cold-air works foundation', x, -7, -22, 20, 5, 13, '#699898', 'metal');
        for (const side of [-1, 1]) {
          block('Ice duct support', x + side * 5.5, -2, -25, 1.1, 16, 2, '#96bec0', 'metal');
          beam('Icy diagonal brace', [x + side * 5.5, -2, -25], [x, 12, -25], .4, '#7bafb6');
        }
        block('Cyan air duct housing', x, 9, -25, 13, 7, 6, '#77b0b5', 'metal');
        ring('Circular turbine casing', x, 12.5, -21.9, 3.2, .65, '#d1e3d9');
        for (let blade = 0; blade < 4; blade++) { const a = blade * Math.PI / 2 + i * .2;
          beam('Turbine impeller blade', [x, 12.5, -21.8], [x + Math.cos(a) * 2.4, 12.5 + Math.sin(a) * 2.4, -21.8], .45, '#4b7684');
        }
        for (let j = 0; j < 3; j++) roof('Frozen blue ice tooth', x - 6 + j * 6, -2, -13, 4, 3 + j, 4, '#a7d0d0');
      });
      break;
    case 'nightworks':
      stations.forEach((x, i) => {
        asset('Floating quarry rear island', 'nightlongisland', [x, -10 - i % 2 * 3, -24], [25, 13, 13], '#adb7bd');
        asset('Distant quarry arch', 'nightdistantarch', [x + 3, -5, -42], [17, 26 + i % 2 * 7, 8], '#728098');
        for (const side of [-1, 1]) {
          block('Quarry lantern footing', x + side * 6, -2, -21, 2.4, 1.4, 2.4, '#697d87', 'stone');
          beam('Quarry lantern post', [x + side * 6, -.6, -21], [x + side * 6, 4, -21], .3, '#8c806b');
          cone('Warm lantern housing', x + side * 6, 3.3, -21, .8, .55, 1.2, '#b8a471');
          beam('Lantern glowing core', [x + side * 6, 3.5, -20.3], [x + side * 6, 4.3, -20.3], .26, '#f7c575', '#d58d30');
        }
        asset('Suspended mineral outcrop', 'nightsteppingrock', [x + 9, -5, -14], [5, 7, 5], '#9aa2b3');
        beam('Quiet quarry neon seam', [x - 6, -.6, -17.3], [x + 6, -.6, -17.3], .13, '#77acac', '#28677d');
      });
      break;
    case 'beach':
      land(sand, 'sand');
      stations.forEach((x, i) => {
        block('Old beach pier decking', x, -.8, -17, 20, .6, 7, '#b69a64', 'plank');
        for (const side of [-1, 1]) {
          block('Pier pile', x + side * 7, -7, -17, .8, 7.5, .8, '#8d7954', 'plank');
          beam('Pier crossed brace', [x + side * 7, -5, -16], [x - side * 7, -1, -16], .35, '#8d7954');
          block('Pier railing post', x + side * 7, -.2, -20, .25, 2, .25, '#d1bf90');
        }
        block('Pier handrail', x, 1.7, -20, 15, .22, .24, '#d1bf90');
        block('Lifeguard hut', x, -.2, -23, 6, 4.5, 5, i % 2 ? '#a6b8a5' : '#c4b892', 'plank');
        roof('Lifeguard hut sun roof', x, 4.3, -23, 8, 1.9, 6.5, '#8faaa7');
        palm(x + 10, -30, 15 + i % 2 * 4);
        fern(x - 7, -10);
      });
      block('Lagoon beyond the pier', end / 2, -4, -45, end + 40, .3, 26, '#73a9ab');
      break;
    case 'street':
      land('#918f84', 'pavement');
      stations.forEach((x, i) => {
        const h = 8 + i % 3 * 2, color = ['#c6a7a0', '#b8b998', '#9faebb'][i % 3];
        block('Pastel seaside townhouse', x, -2, -24, 17, h, 10, color, 'pavement');
        roof('Terracotta coastal roof', x, h - 2, -24, 18.5, 3, 12, '#a17b65');
        for (const xx of [-5, 0, 5]) {
          block('Townhouse window surround', x + xx, 1, -18.8, 2.6, 3, .25, '#e0d5b3');
          block('Blue shuttered window', x + xx, 1.25, -18.6, 2.1, 2.4, .2, '#567f88');
        }
        block('Townhouse stoop', x, -1.8, -17.5, 7, .65, 3, '#c4bea5', 'stone');
        asset('Coastal street lamp', 'citylamp', [x + 9, -1.4, -11], [1, 7, .7], '#bebd9a');
        palm(x - 10, -32, 16);
      });
      break;
    case 'islands':
      block('Quiet lagoon water', end / 2, -5, -31, end + 46, .3, 48, '#74afa8');
      stations.forEach((x, i) => {
        oval('Low lagoon island rock', [x, -9, -25 - i % 2 * 4], [23, 7, 16], '#ae9e74');
        block('Sandy islet shelf', x, -2.7, -25 - i % 2 * 4, 19, .8, 12, '#cfc197', 'sand');
        palm(x - 4, -25 - i % 2 * 4, 12 + i % 3 * 2); palm(x + 5, -31, 11);
        for (let j = 0; j < 3; j++) asset('Island broadleaf cluster', 'jungleleaf', [x - 6 + j * 6, -1.9, -22], [4.7, 3, 4], '#a5bd82', j * 33);
        block('Island timber landing', x, -2, -14, 10, .5, 6, '#b99a61', 'plank');
        for (const side of [-1, 1]) block('Lagoon jetty pile', x + side * 3.5, -6, -13, .6, 5, .6, '#8c7855', 'plank');
        beam('Islet landing mooring rope', [x - 3.5, -1, -12.6], [x + 3.5, -1, -12.6], .13, '#d8c79a');
      });
      break;
    case 'gate':
      land('#63764e', 'dirt');
      stations.forEach((x, i) => {
        for (let j = 0; j < 7; j++) {
          const px = x - 9 + j * 3, h = 5 + j % 2;
          block('Pointed jungle palisade stake', px, -2, -25, .9, h, 1.1, '#65764d', 'plank');
          roof('Palisade sharpened tip', px, h - 2, -25, .9, 1.4, 1.1, '#879569');
        }
        for (const side of [-1, 1]) block('Jungle gate heavy post', x + side * 6, -2, -21, 2.1, 12 + i % 2 * 3, 2.1, '#7d8862', 'plank');
        block('Jungle gate crossbeam', x, 9 + i % 2 * 3, -21, 17, 1.3, 2.4, '#8e9e70', 'plank');
        asset('Gate hanging vine', 'junglevine', [x, 7.8 + i % 2 * 3, -19.6], [12, 3.1, 1], '#a8be7e');
        fern(x - 8); palm(x + 9, -39, 20);
      });
      break;
    case 'blockworks':
      land('#777e7d', 'pavement');
      stations.forEach((x, i) => {
        const h = 13 + i % 2 * 4;
        for (const side of [-1, 1]) block('Concrete grid column', x + side * 7, -2, -27, 2.2, h, 3, '#a1aaa5', 'pavement');
        for (let floor = 0; floor < 3; floor++) {
          block('Stacked industrial floor slab', x, -1 + floor * 5, -27, 19, 1.1, 9, '#b6b8a7', 'pavement');
          block('Muted foundry orange inset', x + (floor % 2 ? -5 : 5), floor * 5, -22.4, 4, 2.5, .2, '#ad8d62');
        }
        block('Upper industrial grid cap', x, h - 2, -27, 18, 1, 9, '#94a8a5', 'pavement');
        beam('Concrete grid brace', [x - 7, -1, -27], [x + 7, 12, -27], .6, '#6c898c');
        asset('Works barrier', 'citybarrier', [x, -2, -11], [7, 1.7, 1], '#c6b991');
        asset('Scaffold at the grid seam', 'cityscaffold', [x + 11, -2, -31], [4, 12, 4], '#b6b09c');
      });
      break;
    case 'chimeworks':
      land('#556f70', 'metal');
      stations.forEach((x, i) => {
        for (const side of [-1, 1]) block('Brass bell tower pier', x + side * 5, -2, -25, 1.1, 17, 1.6, '#bfa16a', 'metal');
        block('Bell tower crosshead', x, 14.6, -25, 13, .8, 3, '#c7ac78', 'metal');
        cone('Hanging brass bell', x, 8, -25, 3.2, 1.3, 4.5, '#bea161');
        cone('Bell rolled lip', x, 7.75, -25, 3.25, 3.25, .3, '#dac493');
        beam('Bell suspension', [x, 12.5, -25], [x, 14.6, -25], .35, '#cbb477');
        block('Bell clapper', x, 7.2, -25, .6, 2.5, .6, '#9b794c', 'metal');
        ring('Great toothed chime gear', x + 7, 4.5, -24, 3.6, .9, '#a68a55', true);
        for (let j = 0; j < 4; j++) cone('Tuned organ pipe', x - 9 + j * 1.1, -2, -22, .38, .38, 5 + j * 1.3, '#b49e6c');
        block('Organ pipe chest', x - 7.3, -2, -22, 5.4, 1, 3, '#47797b', 'plank');
        roof('Bell tower crown', x, 15.4, -25, 14, 2.8 + i % 2, 5, '#779692');
      });
      break;
    case 'waterpark':
      land('#b4a184', 'sand');
      stations.forEach((x, i) => {
        block('Empty pool rear basin', x, -2, -24, 20, 1, 11, '#aac0b1', 'pavement');
        block('Faded tiled pool wall', x, -1, -28, 20, 5, 1, '#76a3a2', 'pavement');
        block('Cream pool coping', x, 4, -28, 20.6, .5, 1.7, '#d7c8a2');
        for (let j = 0; j < 6; j++) block('Pool waterline grout', x - 9 + j * 3.6, 1.5, -27.45, .06, .8, .06, '#c4ccba');
        ring('Round dry flume outlet', x, 5, -22.5, 4, .6, i % 2 ? '#ba926c' : '#84aaa7');
        for (const side of [-1, 1]) beam('Dry flume pipe support', [x + side * 3, -2, -24], [x + side * 3, 4, -24], .5, '#567b7c');
        block('Waterpark maintenance kiosk', x + 9, -2, -36, 5, 7, 5, '#c5b99b', 'pavement');
        roof('Maintenance kiosk faded canopy', x + 9, 5, -36, 7, 1.5, 7, '#88a8a1');
      });
      break;
    case 'afterhours':
      stations.forEach((x, i) => {
        asset('After-hours workshop foundation', 'nightlongisland', [x, -11, -23], [25, 10, 16], '#8b97a3');
        block('Night maintenance workshop', x, -1, -26, 18, 10 + i % 2 * 2, 11, '#607989', 'metal');
        block('Workshop roll-up door', x - 3, -.9, -20.4, 7, 6, .1, '#425d6b', 'metal');
        block('Skate shop display window', x + 5, 2, -20.3, 4, 3, .2, '#bba586');
        beam('Shop cyan neon roof line', [x - 9, 9, -20.3], [x + 9, 9, -20.3], .15, '#8bc3c3', '#44869a');
        for (let j = 0; j < 3; j++) {
          block('Board in the shop window', x + 3.8 + j * 1.2, 2.3, -20.1, .4, 2.3, .12, ['#c69271', '#aaba90', '#b8a8b6'][j]);
          block('Roll-up shutter seam', x - 3, .5 + j * 1.5, -20.25, 7, .06, .08, '#80949b');
        }
        asset('Workshop maintenance fence', 'cityfence', [x + 9, -1, -15], [4.5, 3, .18], '#9eada6');
        asset('Night street lamp', 'citylamp', [x - 10, -1, -12], [1, 7.5, .7], '#b8b79d');
      });
      break;
    case 'junglecup':
      land('#6d816a', 'stone');
      stations.forEach((x, i) => {
        for (let tier = 0; tier < 3; tier++) block('Jade skate arena spectator terrace', x, -2 + tier * 2, -29 - tier * 3, 22, 2, 9, '#93a88a', 'stone');
        for (const side of [-1, 1]) {
          asset('Arena service gateway column', 'stoneshaft', [x + side * 7, -2, -23], [2, 12, 2], '#aab293');
          asset('Arena carved capital', 'stonecapital', [x + side * 7, 10, -23], [3.3, 1, 3], '#c1bf9b');
        }
        block('Arena stone canopy', x, 11, -23, 19, 1, 5, '#7f9d87', 'stone');
        beam('Terrace jade coping silhouette', [x - 10, 4.3, -31], [x + 10, 4.3, -31], .3, '#b7c4ae');
        ring('Stored arena pipe section', x + 7, 2, -18, 2.5, .65, '#9fb39d');
        asset('Skate arena trophy relief', 'stonefrieze', [x, 8.5, -20.4], [4, 2.5, .4], '#cbbb86');
        asset('Arena rear canopy tree', 'junglecanopy', [x + 9, -2, -47], [24, 22 + i % 2 * 4, 20], '#91a580');
        fern(x - 8);
      });
      break;
    case 'waterparkcup':
      land('#b2ad8e', 'pavement');
      stations.forEach((x, i) => {
        block('Drained competition pool floor', x, -2, -22, 21, .6, 12, '#91afaa', 'pavement');
        block('Competition pool rear wall', x, -1.4, -27, 21, 4, 1, '#6e979c', 'pavement');
        block('Competition pool cream coping', x, 2.6, -27, 22, .5, 2, '#d3c7a2');
        for (const side of [-1, 1]) block('Competition platform tower pier', x + side * 3, -2, -35, .7, 16, .8, '#6e8d8d', 'metal');
        block('Judging tower deck', x, 12.5, -35, 10, .6, 7, '#c8c4aa');
        block('Judging booth', x, 13.1, -35, 7, 3.4, 5, '#aab6a1', 'pavement');
        block('Judging booth glass', x, 14, -32.4, 5.8, 1.8, .1, '#77979a');
        block('Competition scoreboard frame', x + 8, 4, -23, 5, 4.2, .4, '#a6a998', 'metal');
        block('Blank competition scoreboard', x + 8, 4.5, -22.75, 4.2, 3.2, .15, '#496d78');
        for (let j = 0; j < 3; j++) block('Scoreboard status dash', x + 8, 5 + j * .85, -22.6, 2.6 - j * .4, .15, .05, '#c5c597');
        beam('Meet banner mast', [x - 7, -2, -20], [x - 7, 7, -20], .18, '#a3a894');
        mesh('Faded meet pennant', [x - 7, 6.8, -20], [0, 0, 0, 3, -.5, 0, 0, -1.8, 0], [0, 1, 2], i % 2 ? '#b7966f' : '#88aeaa');
      });
      break;
    case 'primer':
      land('#837558', 'plank');
      stations.forEach((x, i) => {
        block('Open timber workshop back wall', x, -2, -27, 20, 10, 1, '#b49a72', 'plank');
        for (const side of [-1, 1]) block('Workshop frame post', x + side * 9, -2, -21, .8, 11, .8, '#7e6b4c', 'plank');
        roof('Woodshop pitched shed roof', x, 9, -24, 23, 3, 9, '#879a81');
        block('Carpenter workbench top', x, .6, -19, 12, .45, 3, '#c9b085', 'plank');
        for (const side of [-1, 1]) block('Workbench leg', x + side * 4.8, -2, -19, .6, 2.6, .8, '#8e7651', 'plank');
        for (let j = 0; j < 3; j++) block('Rack of long timber planks', x - 6, 3 + j * 1.2, -25.7, 6, .35, .45, '#d0bc95', 'plank');
        ring('Woodshop circular blade on the wall', x + 5, 5.2, -26.35, 2, .65, '#b6b9ab', true);
        beam('Workbench hand tool', [x + 2, 1.05, -18.6], [x + 4, 1.05, -18.6], .2, '#6b817b');
        block('Open workshop window', x + 2, 3.5, -26.4, 2.1, 3, .14, i % 2 ? '#99ae98' : '#abc0a6');
      });
      break;
    case 'switchyard':
      land('#74837f', 'stone');
      stations.forEach((x, i) => {
        block('Brass signal cabin raised plinth', x, -2, -29, 12, 4, 8, '#a39a76', 'stone');
        block('Signal cabin timber body', x, 2, -29, 10, 5.5, 7, '#979d7b', 'plank');
        roof('Signal cabin hipped silhouette', x, 7.5, -29, 13, 2.7, 10, '#617e78');
        for (const side of [-1, 1]) {
          block('Signal cabin brass window frame', x + side * 2.6, 3, -25.4, 3.1, 2.6, .3, '#c7af74');
          block('Signal cabin glass', x + side * 2.6, 3.3, -25.2, 2.4, 2, .15, '#778f8a');
        }
        beam('Yard signal mast', [x + 8, -2, -19], [x + 8, 10.5, -19], .6, '#a49261');
        block('Tall signal lamp housing', x + 8, 6.5, -19, 1.8, 4.2, 1.2, '#456664', 'metal');
        ring('Upper brass signal ring', x + 8, 9.3, -18.35, .58, .22, '#d2bb7b');
        ring('Lower brass signal ring', x + 8, 7.6, -18.35, .58, .22, '#b0b991');
        beam('Fixed semaphore arm', [x + 8, 11, -19], [x + 4, 11 + i % 2 * 1.3, -19], .45, '#c9ac70');
        for (const z of [-14, -16]) beam('Unused switchyard track', [x - 11, -1.6, z], [x + 11, -1.6, z], .22, '#889997');
      });
      break;
    case 'gauntlet':
      land('#6d6c64', 'metal');
      stations.forEach((x, i) => {
        block('Red iron furnace foundation', x, -2, -29, 19, 3, 12, '#817565', 'stone');
        block('Riveted furnace body', x, 1, -29, 13, 11 + i % 2 * 3, 9, '#987766', 'metal');
        block('Furnace black throat', x, 2, -24.4, 6.5, 6, .18, '#514e4d');
        for (const side of [-1, 1]) block('Furnace red iron jamb', x + side * 3.5, 1.7, -24.1, .65, 6.7, .5, '#b49a77', 'metal');
        block('Furnace iron lintel', x, 8, -24.1, 8, .7, .5, '#b49a77', 'metal');
        beam('Banked furnace ember line', [x - 2.7, 2.5, -24.12], [x + 2.7, 2.5, -24.12], .28, '#da9c65', '#8c492a');
        cone('Tall furnace smokestack', x + 4, 12 + i % 2 * 3, -29, 1.2, .9, 9, '#74796e');
        cone('Smokestack iron collar', x + 4, 19 + i % 2 * 3, -29, 1.5, 1.5, .7, '#a19479');
        ring('Furnace control wheel', x - 7, 3.8, -23, 1.6, .35, '#b59d76');
        beam('Furnace service pipe', [x - 7, -1, -25], [x - 7, 11, -25], .6, '#a08a68');
        beam('Furnace overhead pipe', [x - 7, 11, -25], [x - 1, 11, -25], .6, '#a08a68');
        block('Factory roof ledge', x, 12 + i % 2 * 3, -29, 15, .6, 11, '#a99b83', 'metal');
      });
      break;
    case 'pirate':
      block('Still moonpool behind the wrecks', end / 2, -6.3, -34, end + 42, .35, 42, '#376a75');
      stations.forEach((x, i) => {
        const z = -25;
        mesh('Broken galleon hull silhouette', [x, -2, z],
          [-12, 4, 0, -7, -3, 0, 7, -3, 0, 12, 4, 0, -12, 4, -6, -7, -3, -6, 7, -3, -6, 12, 4, -6],
          [0, 1, 2, 0, 2, 3, 4, 7, 6, 4, 6, 5, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3], '#795840');
        block('Weathered hull gunwale', x, 1.9, z, 24, .5, .55, '#b08a5c', 'plank');
        for (const rib of [-8, -3, 3, 8]) beam('Exposed curved ship rib', [x + rib * .65, -3.5, z + .25], [x + rib, 5.5, z + .25], .4, '#b48b5b');
        beam('Leaning broken galleon mast', [x, -2, z - 2], [x + 2, 18 + i % 2 * 3, z - 2], .75, '#96734c');
        beam('Splintered sail yard', [x - 8, 15 + i % 2 * 3, z - 2], [x + 10, 15 + i % 2 * 3, z - 2], .4, '#b18a5a');
        mesh('Ragged pale galleon sail', [x, 15 + i % 2 * 3, z - 1.7],
          [-8, 0, 0, -7.2, -6, .4, -3.8, -5, .7, -3, 0, .3, -1.5, -7, .8, 2, -5, .7, 2.5, 0, .4, 6, -6.5, .3, 10, 0, 0],
          [0, 1, 2, 0, 2, 3, 3, 4, 5, 3, 5, 6, 6, 7, 8], '#c4b58e');
        for (const side of [-1, 1]) beam('Thin standing ship rigging', [x + side * 10, 2.5, z - 1], [x + 2, 18 + i % 2 * 3, z - 2], .1, '#ad9c79');
        block('Salvagers lantern bracket', x - 8, 2.5, z + .6, .22, 4, .22, '#ac8a58');
        cone('Salvagers brass lantern', x - 8, 5.7, z + .6, .6, .4, 1, '#c3a474');
        beam('Salvagers glowing lantern glass', [x - 8, 5.9, z + 1.18], [x - 8, 6.5, z + 1.18], .24, '#f6ce85', '#c98c42');
        oval('Drowned hoard of gold', [x + 6, -1.8, -16], [7, 1.4, 4], '#bea667');
        cone('Turquoise hoard relic', x + 7, -.5, -16, .65, .1, 1.8, '#69a2a0');
        asset('Deep moonpool cavern opening', 'nightdistantarch', [x + 2, -7, -48], [25, 32, 9], '#67828a');
      });
      break;
    case 'boneyard':
      land('#718482', 'stone');
      stations.forEach((x, i) => {
        oval('Pale quarry foundation', [x, -9, -29], [25, 7, 15], '#8b9d92');
        for (const side of [-1, 1]) {
          const rib: P[] = [[x + side * 8, -2, -27], [x + side * 8.6, 5, -27], [x + side * 5.3, 10.5 + i % 2, -27], [x, 13.5 + i % 2, -27]];
          for (let segment = 0; segment < 3; segment++) beam('Enormous weathered ivory rib', rib[segment], rib[segment + 1], .7, '#c5c5a6');
          oval('Rounded fossil rib joint', [x + side * 8.6, 4.5, -27], [1.1, 1.1, 1.1], '#d3d0af');
        }
        beam('Fossil spine beneath the arch', [x - 8, -1.2, -29], [x + 8, -1.2, -29], .9, '#babda1');
        oval('Quarry skull relic', [x + 7, -.8, -17], [4.5, 4.8, 3.2], '#c6c9ad');
        for (const side of [-1, 1]) oval('Dark fossil eye socket', [x + 7 + side * .9, 1.35, -15.37], [.85, 1.25, .12], '#5f746f');
        for (const side of [-1, 1]) block('Mint crash-bay frame post', x + side * 4.5, -2, -20, .5, 6, .7, '#91aaa4', 'metal');
        beam('Amber crash-bay crossbar', [x - 4.5, 3.6, -20], [x + 4.5, 3.6, -20], .45, '#c8ad6e');
        block('Coral impact-bay cushion', x - 3, -1.9, -22, 2.5, 2.7, 1, '#bc9380');
        block('Amber low impact-bay cushion', x + 1.5, -1.9, -22, 3, .8, 1, '#c5af79');
      });
      break;
    case 'reefchief':
      block('Warm lagoon beyond the treasury', end / 2, -6, -33, end + 40, .35, 40, '#6b9c95');
      stations.forEach(x => {
        for (let tier = 0; tier < 2; tier++) block('Coralstone treasury terrace', x, -3 + tier * 1.2, -25, 23 - tier * 3, 1.2, 14 - tier * 2, '#c4ad86', 'stone');
        for (const side of [-1, 1]) {
          block('Pearl treasury coralstone pier', x + side * 6, -.6, -26, 1.8, 10.5, 2.4, '#cbb898', 'stone');
          block('Sea-green pier capital', x + side * 6, 9.9, -26, 3.1, .7, 3.3, '#79a195', 'stone');
        }
        const v: number[] = [0, 0, .3], ids: number[] = [], panels = 12;
        for (let n = 0; n <= panels; n++) {
          const a = n / panels * Math.PI;
          v.push(Math.cos(a) * 8, Math.sin(a) * 8, n % 2 ? -.25 : .25);
          if (n < panels) ids.push(0, n + 1, n + 2);
        }
        mesh('Great Pacific shell treasury fan', [x, 8, -26], v, ids, '#d4b29d');
        for (let n = 1; n < 6; n++) {
          const a = n / 6 * Math.PI;
          beam('Shell fan carved rib', [x, 8, -25.45], [x + Math.cos(a) * 8, 8 + Math.sin(a) * 8, -25.45], .14, '#e1cab0');
        }
        block('Ceremonial pearl altar', x, -.6, -21, 5, 2.2, 4, '#769c90', 'stone');
        oval('Chiefs treasury pearl', [x, 1.6, -21], [3.1, 3.1, 3.1], '#dfd9bf');
        for (const side of [-1, 1]) mesh('Carved coral claw crest', [x + side * 8.5, -.5, -20],
          [-.6, 0, 0, .6, 0, 0, -2.1, 2.5, 0, -2.6, 5, 0, -.35, 3.1, 0, .35, 3.1, 0, 2.6, 5, 0, 2.1, 2.5, 0],
          [0, 2, 4, 0, 4, 1, 2, 3, 4, 1, 5, 7, 1, 0, 5, 5, 6, 7], '#bd8b74');
        beam('Coral branch trunk', [x - 9, -1.8, -16], [x - 10, 2.3, -16], .35, '#aa8d7b');
        beam('Forked coral branch', [x - 9.6, .4, -16], [x - 7.8, 2, -16], .28, '#c2a38a');
      });
      break;
    case 'terraces':
      land('#658372', 'stone');
      stations.forEach((x, i) => {
        temple(x, 13 + i % 2 * 4, '#94ab8c');
        for (let j = 0; j < 3; j++) block('Long jade terrace step', x, -2 + j * 1.4, -38, 24 - j * 4, 1.4, 17 - j * 3, '#779983', 'stone');
        asset('Terrace fern crown', 'junglefern', [x - 6, 2.2, -38], [7, 3.5, 6], '#aec69b');
        asset('Terrace hanging vine', 'junglevine', [x, 11.4 + i % 2 * 4, -18.6], [10, 3, 1], '#acc086');
      });
      break;
    case 'skyline':
      land('#858b71', 'stone');
      stations.forEach((x, i) => {
        temple(x, 20 + i % 3 * 4, '#b4b49b', true);
        ring('Golden sun shrine disc', x, 14 + i % 3 * 3, -35, 4.2, .8, '#cfb36e');
        for (const side of [-1, 1]) {
          block('Sun sanctuary obelisk', x + side * 10, -2, -40, 1.8, 17 + i % 2 * 6, 2.5, '#a4a78d', 'stone');
          roof('Golden obelisk cap', x + side * 10, 15 + i % 2 * 6, -40, 2.4, 2.8, 3, '#cdb57d');
        }
        asset('High sun shrine palm', 'junglepalmtree', [x + 9, -2, -17], [8, 12, 8], '#bdc191', i * 20);
      });
      break;
  }
  return out;
}

export function bonusArtAtmosphere(theme: BonusArtTheme): { atmosphere: CustomAtmosphereData; keepPlayFog: true } {
  const haze: Record<BonusArtTheme, string> = {
    treehouse: '#9eae90', jungle: '#92a68e', coast: '#b2c5c2', cloud: '#d6e4df',
    slipstream: '#b9d7d6', nightworks: '#233c54', beach: '#c2d3c4', street: '#c4d2c7',
    islands: '#b4d4c7', gate: '#a5b08e', blockworks: '#b9c7c2', chimeworks: '#b7c6b4',
    waterpark: '#ccc9ab', afterhours: '#2d4157', terraces: '#b0c4a2', skyline: '#d3cfad',
    junglecup: '#b6c6a6', waterparkcup: '#c9d0b8', primer: '#bfcaad', switchyard: '#b4c3ae', gauntlet: '#b3ac91',
    pirate: '#294b58', boneyard: '#859b93', reefchief: '#cfb39c',
  };
  const night = theme === 'nightworks' || theme === 'afterhours' || theme === 'pirate';
  return { keepPlayFog: true, atmosphere: {
    // The fog backdrop explicitly bypasses the legacy panoramic painting.
    backdrop: 'fog', fogEnabled: true, fogColor: haze[theme], fogNear: 74, fogFar: 205,
    drawDistance: 230, ambientSky: night ? '#a3bbd1' : '#e9eee0',
    ambientGround: night ? '#64758a' : '#a9ad93', ambientIntensity: night ? 1.05 : 1.3,
    sunColor: night ? '#bbccde' : '#fff0cb', sunIntensity: night ? 1.05 : 1.65,
    fillColor: night ? '#7a9db7' : '#c2e1dc', fillIntensity: .42, shadowStrength: .56,
  } };
}
