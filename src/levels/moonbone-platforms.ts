import type { CustomComponent } from '../level';
import { buildCarlisleRockTerrain } from './carlisle-rock-terrain';

/** Chipped slate and fossil limestone, with exact supported centre joins.
 * The inherited Carlisle geometry has a real scalloped outline, rounded
 * shoulders, fractured strata and a tapered underside instead of a box. */
export function moonbonePlatform(c: CustomComponent, seed: number): CustomComponent {
  const moving = c.t === 'mover' || c.t === 'crumble';
  const source: CustomComponent = { ...c, t: 'platform',
    p: [c.p[0], c.p[1] - (moving ? c.s![1] / 2 : 0), c.p[2]] };
  const mesh = buildCarlisleRockTerrain(source, 49 + seed % 7, [], { near: true, far: true }).surfaces[0];
  const top = c.s![1] / 2;
  mesh.colors = mesh.vertices!.map((_, i) => {
    const v = i - i % 3, y = mesh.vertices![v + 1], cap = Math.max(0, Math.min(1, 1 - (top - y) / 1.6));
    const variation = .94 + .06 * Math.sin(mesh.vertices![v] * 2.3 + mesh.vertices![v + 2] * 3.7);
    return ([.30, .35, .45][i % 3] * (1 - cap) + [.83, .84, .76][i % 3] * cap) * variation;
  });
  return { ...c, ...mesh, t: c.t === 'platform' ? 'mesh' : c.t, p: c.p,
    s: moving ? c.s : [1, 1, 1], nm: c.nm, tex: 'coast-bedrock', color: '#ffffff', grp: c.grp };
}
