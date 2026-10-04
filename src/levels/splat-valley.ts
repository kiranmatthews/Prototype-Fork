import type { CustomComponent, CustomLevelData } from '../level';

const components: CustomComponent[] = [];
function deck(z: number, y: number, length: number, width = 10) {
  components.push({ t: 'platform', p: [0, y - .6, z], s: [width, 1.2, length],
    tex: 'plank', color: '#aeaa8d', edgeGrinding: false });
  for (const x of [-width / 2 + .2, width / 2 - .2]) {
    components.push({ t: 'decor', dkind: 'block', p: [x, y + .05, z], s: [.35, .15, length], tex: 'wood', color: '#dcc58c' });
    for (const end of [-length / 2 + 1, length / 2 - 1])
      components.push({ t: 'decor', dkind: 'block', p: [x, y - 6, z + end], s: [.7, 12, .7], tex: 'stone', color: '#807864' });
  }
}
deck(0, 0, 18, 12);
components.push({ t: 'ramp', p: [0, 0, -16], len: 14, rise: 3, w: 8, tex: 'plank', color: '#aeaa8d', edgeGrinding: false });
deck(-30, 3, 14);
deck(-50, 3, 20);
components.push({ t: 'checkpoint', p: [0, 3, -48] });
components.push({ t: 'ramp', p: [0, 3, -68], len: 16, rise: 3, w: 8, tex: 'plank', color: '#aeaa8d', edgeGrinding: false });
deck(-84, 6, 16);
deck(-103.5, 6, 17);
components.push({ t: 'checkpoint', p: [0, 6, -105] });
components.push({ t: 'ramp', p: [0, 3, -118], len: 12, rise: 3, w: 8, yaw: 180, tex: 'plank', color: '#aeaa8d', edgeGrinding: false });
deck(-133, 3, 18, 12);
components.push({ t: 'rail', p: [-3.6, 7, -96], len: 18, yaw: 0 });
components.push({ t: 'wall', p: [5.85, 0, 0], s: [.3, 1.3, 16], tex: 'wood', color: '#bca57e' });
components.push({ t: 'wall', p: [-5.85, 0, 0], s: [.3, 1.3, 16], tex: 'wood', color: '#bca57e' });
for (const [z, y] of [[-27, 3], [-44, 3], [-54, 3], [-80, 6], [-99, 6], [-109, 6], [-132, 3]])
  for (const x of [-2, 2]) components.push({ t: 'crate', p: [x, y, z], kind: 'wood' });
// Explicit ordered camera lane preserves forward input across both climbs.
for (const [z, y] of [[8, 0], [-9, 0], [-23, 3], [-60, 3], [-76, 6], [-112, 6], [-124, 3], [-147, 3]])
  components.push({ t: 'camnode', p: [0, y, z] });
components.push({ t: 'pit', p: [0, -10, -70], s: [300, 1, 280], invisible: true });
components.push({ t: 'gate', p: [0, 3, -138] });

/** The splat is scenery; all supported traversal uses normal authored solids. */
export const SPLAT_VALLEY_LEVEL: CustomLevelData = {
  v: 1, name: 'Splat Valley', spawn: [0, .1, 4], killY: -24,
  sky: 'day', cameraAirLift: .55,
  splatScenery: { asset: 'valley', p: [0, 10, -50], scale: 18 },
  atmosphere: { fogEnabled: false, drawDistance: 650, ambientIntensity: 1.2, sunIntensity: 1.6, fillIntensity: .7,
    fallbackTop: '#bfd9e4', fallbackBottom: '#dce7cd', fallbackStars: false },
  medalTimes: { gold: 22, silver: 32, bronze: 48 },
  groups: [], components,
};
