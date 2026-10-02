import type { CustomComponent, CustomLevelData } from '../level';

// All playable surfaces use the ordinary editor component pipeline. The
// encounter owns only the chief, attacks and presentation, never rider tuning.
export const REEF = { chiefZ: -28, pearl: [0, 1.4, -19] as [number, number, number],
  spawn: [0, .12, 17] as [number, number, number], centreZ: -14, railY: .68 };
const components: CustomComponent[] = [];
const add = (c: CustomComponent) => components.push(c);
const outline: [number, number, number][] = [
  [-16, 22, 3], [-22, 16, 4], [-22, -19, 4], [-15, -27, 4],
  [15, -27, 4], [22, -19, 4], [22, 16, 4], [16, 22, 3],
];
add({ t: 'platform', p: [0, -1.15, -14], s: [1, 2.3, 1], pts: outline,
  color: '#d7b685', tex: 'solid', edgeGrinding: false, nm: 'Coralstone arena · supported top at zero' });
add({ t: 'woodpath', p: [0, 0, 23], pts: [[0, 0, 0, 0], [0, -17, 0, 0]], widths: [6, 6],
  w: 6, supportDepth: 3, baySpacing: 3, structureStyle: 'island',
  edgeGrinding: false, nm: 'Arrival canoe pier' });
// The optional tribute room is reached before the arena's z<6 trigger. A
// side dock joins the pier at x=3 and keeps its raised stone off the main line.
add({ t: 'platform', p: [6.5, -.5, 15], s: [7, 1, 8], color: '#b59b71', tex: 'plank',
  edgeGrinding: false, nm: 'Supported pearl tribute side dock' });
add({ t: 'bonusplatform', p: [6, 0, 15], to: [0, .1, 15], nm: 'Pearl tribute before the chief' });
add({ t: 'platform', p: [0, -.55, -43], s: [14, 1.1, 15], color: '#628d84', tex: 'solid',
  edgeGrinding: false, nm: 'Victory causeway' });
add({ t: 'gate', p: [0, 0, -49], nm: 'Reef crown exit · sealed until chief yields' });
add({ t: 'wall', p: [0, 0, -28], s: [8.5, 6, 5], invisible: true, nm: 'Chief carapace collision' });
add({ t: 'checkpoint', p: [0, 0, 5.5], nm: 'Arena arrival · phase progress survives a retry' });
add({ t: 'pit', p: [0, -2.8, -15], s: [130, 1, 130], invisible: true, nm: 'Deep lagoon respawn' });
// Broad ramps offer a skating line back from both elevated reef terraces.
for (const side of [-1, 1]) {
  add({ t: 'platform', p: [side * 18, .45, -13], s: [5.5, .9, 23], color: '#4c9c98',
    tex: 'solid', edgeGrinding: false, nm: `${side < 0 ? 'West' : 'East'} pearl terrace` });
  add({ t: 'ramp', p: [side * 18, 0, 2], len: 8, rise: .9, w: 5.5,
    tex: 'solid', color: '#68b2a6', edgeGrinding: false, nm: 'Pearl terrace roll-in' });
  add({ t: 'ramp', p: [side * 18, 0, -28], len: 8, rise: .9, w: 5.5, yaw: 180,
    tex: 'solid', color: '#68b2a6', edgeGrinding: false, nm: 'Pearl terrace return' });
  // A low, immediately catchable entry runs from the front court and curves
  // back toward the exposed pearl. Both paths use real grind/balance physics.
  const points: [number, number, number, number][] = [
    [side * 11, 1, 2, 0], [side * 14, -6, 3, .25], [side * 14, -14, 3, .25],
    [side * 11, -21, 3, .25], [side * 6, -21, 2, .15],
  ];
  add({ t: 'rail', p: [0, REEF.railY, 0], pts: points, nm: `${side < 0 ? 'West' : 'East'} pearl-charge rail` });
  for (const z of [3, -7, -19, -31])
    add({ t: 'torch', p: [side * 23.5, 0, z], rise: 2.8, w: .65, nm: 'Reef fire basket' });
  for (const z of [0, -25]) add({ t: 'crate', p: [side * 18, .9, z], kind: 'mask', nm: 'Optional storm protection' });
}
// A printed spiral and shell-inlay rings make the arena read as a deliberate
// ceremonial place without hiding the attack circles under busy floor detail.
for (const radius of [5.5, 11.5, 18.5]) {
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, b = a + Math.PI / 16 * .83, inner = radius - .16;
    add({ t: 'mesh', p: [0, .018, REEF.centreZ], vertices: [
      Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * radius, 0, Math.sin(a) * radius,
      Math.cos(b) * radius, 0, Math.sin(b) * radius, Math.cos(b) * inner, 0, Math.sin(b) * inner,
    ], indices: [0, 2, 1, 0, 3, 2], color: radius === 11.5 ? '#74948d' : '#a48058',
    tex: 'solid', solid: false, doubleSided: true, edgeGrinding: false, nm: 'Shell mosaic inlay' });
  }
}
for (const z of [20, 2, -20, -45]) add({ t: 'camnode', p: [0, 0, z], radius: 0, nm: 'Stable north-facing arena controls' });
// An authored arena shot keeps the whole chief, the attack floor and rider in
// view. Translation-only following preserves that composition at the edges.
add({ t: 'camnode', p: [0, 4, -16], s: [64, 30, 86], yaw: 0, radius: 3, cameraView: true,
  cameraPosition: [0, 30, 39], cameraTarget: [0, 2, -14], cameraFov: 55, cameraAspect: 1.6,
  cameraFollowDistance: 38, cameraIntroDistance: 15, nm: 'Chief establishing shot and arena follow' });

export const CRAB_CHIEF_LEVEL: CustomLevelData = {
  v: 1, name: 'Tidebreak · Crab Chief', encounter: 'crab-chief',
  spawn: REEF.spawn, killY: -7, sky: 'sunset', cameraAirLift: .45,
  keepPlayFog: true,
  atmosphere: { backdrop: 'fog', fogColor: '#bd827b', fogNear: 80, fogFar: 225,
    ambientSky: '#a7d3dc', ambientGround: '#765143', ambientIntensity: 1.7,
    sunColor: '#ffe3af', sunIntensity: 2.15 },
  components,
};
