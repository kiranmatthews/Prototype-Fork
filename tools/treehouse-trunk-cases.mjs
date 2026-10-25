export const trunkPrefix = 'Fitted tree trunk · ';
export function trunkContactCases(source) {
  const bases = source.components.filter(c => c.nm?.startsWith(trunkPrefix) && c.nm.includes('/0 ·'));
  return [
    { name: 'opening foreground', near: [24.7, 9.8], offset: [0, -7] },
    { name: 'later beach and huts', near: [60.1, -279.4], offset: [-7, 0] },
    { name: 'shaded hut approach', near: [45.9, -316.1], offset: [-7, 0] },
  ].flatMap(site => {
    const wall = bases.reduce((best, c) => Math.hypot(c.p[0] - site.near[0], c.p[2] - site.near[1]) < Math.hypot(best.p[0] - site.near[0], best.p[2] - site.near[1]) ? c : best);
    return ['walk', 'skate', 'jump'].map(mode => ({
      name: `${site.name} ${mode}`, mode, frames: 150,
      start: [wall.p[0] + site.offset[0], wall.p[1] + .65, wall.p[2] + site.offset[1]],
      target: [wall.p[0], wall.p[1] + .65, wall.p[2]],
      bands: source.components.filter(c => c.nm?.startsWith(wall.nm.split('/')[0] + '/')),
    }));
  });
}
export const trunkRouteCases = [
  { name: 'opening clearing', start: [-3, .08, 10], target: [7, .08, 9], frames: 210 },
  { name: 'clearing to pipe entrance', start: [7, .08, 9], target: [14, .15, 6.5], frames: 190 },
  { name: 'later beach straight', start: [53, -13.92, -246], target: [53, -13.92, -272], frames: 440 },
  { name: 'hut bend', start: [53, -13.92, -273], target: [44, -13.92, -287], frames: 300 },
  { name: 'hut bend exit', start: [44, -13.92, -287], target: [35, -13.92, -301], frames: 300 },
  { name: 'shaded huts', start: [35, -13.92, -301], target: [35, -13.92, -328], frames: 460 },
];
export function insideTrunk(position, band) {
  if (position[1] + 1.2 < band.p[1] || position[1] > band.p[1] + band.s[1] - .04) return false;
  const x = position[0] - band.p[0], z = position[2] - band.p[2];
  let inside = false;
  for (let i = 0, j = band.pts.length - 1; i < band.pts.length; j = i++) {
    const a = band.pts[i], b = band.pts[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
