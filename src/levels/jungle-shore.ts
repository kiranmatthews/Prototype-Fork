import type { CustomComponent, CustomOceanData } from '../level';

/** The small cove opens behind the original spawn; the jungle route stays -Z. */
export const JUNGLE_COVE = Object.freeze({ near: 13.5, far: 96, halfWidth: 36 });
export function jungleCoveWidth(z: number): number {
  const knots = [[13.5, 7.8], [25, 16], [42, 30], [62, 36], [96, 36]];
  for (let i = 1; i < knots.length; i++) {
    if (z <= knots[i][0]) {
      const [a, aw] = knots[i - 1], [b, bw] = knots[i];
      return aw + (bw - aw) * Math.max(0, (z - a) / (b - a));
    }
  }
  return 36;
}
export function jungleShore(gx: (z: number) => number, gy: (z: number) => number) {
  const x = gx(14), y = gy(14), sea = y - 1.25;
  const vertices: number[] = [], indices: number[] = [], colors: number[] = [];
  const rows = 66, columns = 32;
  for (let row = 0; row <= rows; row++) {
    const z = JUNGLE_COVE.near + (JUNGLE_COVE.far - JUNGLE_COVE.near) * row / rows;
    const u = Math.min(1, Math.max(0, (z - 14) / 34));
    const slope = u * u * (3 - 2 * u);
    for (let col = 0; col <= columns; col++) {
      const side = col / columns * 2 - 1;
      const h = y - 6 * slope + 1.2 * Math.pow(Math.abs(side), 4) * slope;
      vertices.push(side * jungleCoveWidth(z), h - y, z - 14);
      // Warm dry sand fades into the quieter submerged bed.
      const tint = 1 - .13 * slope;
      colors.push(tint, tint, tint);
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const components: CustomComponent[] = [{
    t: 'mesh', p: [x, y, 14], vertices, indices, colors,
    tex: 'sand', materialStyle: 'unity-sand', color: '#fff3d6',
    beachSand: true, edgeGrinding: false, nm: 'Jungle cove beach and seabed', grp: 290,
  }];
  for (const side of [-1, 1]) {
    for (const [z, h, w] of [[29, 10, 12], [48, 15, 16], [71, 17, 16], [91, 12, 13]]) {
      components.push({ t: 'decor', dkind: 'junglecliff',
        p: [x + side * (jungleCoveWidth(z) + 5), sea - 4, z], s: [w, h, 24],
        yaw: side * -14, solid: false, color: '#b9c5b5', nm: 'Cove rock headland', grp: 290 });
    }
    for (const z of [21, 32]) components.push({ t: 'decor', dkind: 'junglepalmtree',
      p: [x + side * (jungleCoveWidth(z) + 1), sea + .4, z], s: [11, 14, 11],
      yaw: side * 45, solid: false, color: '#d4e5b3', nm: 'Shore palm', grp: 290 });
  }
  const ocean: CustomOceanData = {
    geometryVersion: 2, p: [x, sea, 27], yaw: -90, seaward: 1,
    length: 94, width: 145, overlap: 14, longitudinalSegments: 64,
    lateralSegments: 96, sourceCoordinates: 'three', extendTails: true,
    swimBounds: [x - 41, 13.5, x + 41, 100],
  };
  return { components, ocean, group: { id: 290, nm: 'Jungle swimming cove' } };
}
