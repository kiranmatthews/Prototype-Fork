import type { CustomComponent, CustomLevelData } from '../level';
import { moonbonePlatform } from './moonbone-platforms';
import { moonboneBonusScenery } from './moonbone-scenery';

const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };
let deckSeed = 0;
const deck = (a: number, b: number, y: number, nm: string): void => {
  add(moonbonePlatform({ t: 'platform', nm, p: [(a + b) / 2, y - .65, 0],
    s: [b - a, 1.3, 6.4], grp: 1 }, deckSeed++));
};
const crate = (x: number, y: number, kind: CustomComponent['kind'], nm: string): void =>
  add({ t: 'crate', p: [x, y, 0], kind, nm, grp: 2 });

// A vertical ascent, a continuous timed crossing and a descending exit make
// this a different route from Ripcord's stairs and switch-revealed islands.
export const MOONBONE_DECKS = [[-12, 8, 0], [16, 32, 6], [48, 63, 6], [74, 94, 0]] as const;
for (const [a, b, y] of MOONBONE_DECKS) deck(a, b, y, y ? 'Moonbone upper gallery' : 'Moonbone crypt landing');
add(moonbonePlatform({ t: 'mover', nm: 'Rising sarcophagus', p: [12, 3, 0], s: [5.8, 1.4, 6.4],
  axis: 'y', amp: 3, speed: .65, phase: -Math.PI / 2, tex: 'stone', color: '#bcc6ce', grp: 3 }, 3));
for (const x of [34, 37.7, 41.4, 45.1]) add(moonbonePlatform({ t: 'crumble', nm: 'Breakaway vertebra ' + x,
  p: [x, 6, 0], s: [3.3, .9, 6.4], shake: .95, speed: 14, tex: 'stone', color: '#c5d0ce', grp: 3 }, Math.round(x)));
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

components.push(...moonboneBonusScenery());

add({ t: 'mesh', nm: 'Moonbone blackwater reflecting the night sky', p: [40, -6, -10],
  vertices: [-200, 0, -160, 200, 0, -160, 200, 0, 90, -200, 0, 90], indices: [0, 2, 1, 0, 3, 2], uvs: [0, 0, 24, 0, 24, 12, 0, 12],
  solid: false, scenerySolid: false, doubleSided: true, tex: 'custard-water', materialStyle: 'jungle-stream',
  color: '#36476b', opacity: .85, lethal: true, castShadow: false, grp: 90 });
add({ t: 'pit', nm: 'Moonbone blackwater contact', p: [40, -6.3, 0], s: [136, 1, 18], invisible: true, grp: 3 });
for (const z of [-.83, .83]) add({ t: 'wall', nm: 'Bonus depth boundary', p: [40, -16, z], s: [136, 56, .6], invisible: true, grp: 4 });
add({ t: 'camnode', p: [-16, 0, 0], grp: 4 }); add({ t: 'camnode', p: [100, 0, 0], grp: 4 });
add({ t: 'camnode', nm: 'Moonbone side view', p: [40, 8, 0], s: [142, 54, 18], cameraView: true, radius: 1,
  cameraPosition: [2, 10, 26], cameraTarget: [2, 5.3, 0], cameraFollowDistance: 26, cameraFollowTargetHeight: 5.3,
  cameraIntroDistance: 0, cameraFov: 49, cameraAspect: 1.3, grp: 4 });

export const ROLLING_BONES_BONUS_LEVEL: CustomLevelData = {
  v: 1, name: 'Bonus: Moonbone Vault', spawn: [-7, .12, 0], killY: -13, hudMode: 'bonus', sky: 'night',
  startWarpPad: false, keepPlayFog: true, cameraAirLift: .85,
  atmosphere: { backdrop: 'fog', fogEnabled: true, fogColor: '#111c34', fogNear: 48, fogFar: 185,
    ambientSky: '#93b4e2', ambientGround: '#293655', ambientIntensity: 1.25,
    sunColor: '#c2dcff', sunIntensity: 1.6, sunDirection: [-.45, .75, .4],
    fillColor: '#6a8bce', fillIntensity: .55, drawDistance: 320, shadowStrength: .64 },
  components,
  groups: [{ id: 1, nm: 'Moonbone crypt and upper galleries' }, { id: 2, nm: 'Sixteen moonbone offerings' },
    { id: 3, nm: 'Rising sarcophagus and breakaway spine' }, { id: 4, nm: 'Side-view framing', editorOnly: true },
    { id: 90, nm: 'Moonlit ossuary and blackwater', editorOnly: true }],
};
