import type { CustomComponent, CustomLevelData } from '../level';
import type { BonusCourse } from './bonus-course-kit';
import { bonusCourseArt, bonusArtAtmosphere } from './bonus-course-art';
import { TEMPLE_NIGHT_ATMOSPHERE } from './temple-night-atmosphere';

type Kind = NonNullable<CustomComponent['kind']>;
const STONE = '#c8bc94', JADE = '#79a996';
const CUBE = {
  vertices: [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5, -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices: [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5],
};

/** Five rooms, one each for the temple's own vocabulary, in the order the
 * main course taught them: the mask before fire, a flame sentinel sweeping
 * the lane, an arrow that must be kept until a high switch creates the jade
 * bridge, the cap-before-fuse vault, and the nitro corridor whose green
 * switch counts every volatile offering. Movement, crates, fire and the
 * side-view camera are the shared runtime's; only the arrangement is new. */
export const EMBER_RELIQUARY_TIKI_X = 31;
export const EMBER_RELIQUARY_NITRO_X = [120, 127, 134] as const;
export const EMBER_RELIQUARY_BRIDGE: readonly [number, number] = [62, 74];

export function createEmberReliquaryBonus(): BonusCourse {
  const components: CustomComponent[] = [];
  const add = (c: CustomComponent): void => { components.push(c); };
  const deck = (a: number, b: number, y: number, nm: string, outline = false, grp = 1): void =>
    add({ t: 'mesh', p: [(a + b) / 2, y - .45, 0], s: [b - a, .9, 6.4], ...CUBE, tex: 'jungle',
      color: outline ? JADE : STONE, grp, nm, ...(outline ? { outline: true } : {}) });
  const crate = (nm: string, x: number, y: number, kind: Kind = 'wood', grp = 2, outline = false): void =>
    add({ t: 'crate', nm, p: [x, y, 0], kind, grp, ...(outline ? { outline: true } : {}) });
  const fruitArc = (a: number, b: number, y: number, rise = 1.4): void => {
    for (let n = 0; n < 5; n++) add({ t: 'wumpa', p: [a + (b - a) * n / 4, y + 1 + Math.sin(n / 4 * Math.PI) * rise, 0], grp: 2 });
  };
  const lamp = (x: number, nm: string): void => add({ t: 'torch', p: [x, 0, -2.6], rise: 1.7, w: .95, grp: 90, nm });

  // Room 1 · Offering vestibule: the count, the spin, and the mask that makes
  // the next room forgiving. Every crate is visible from the arrival deck.
  deck(-10, 0, 0, 'Reliquary arrival and observation');
  deck(0, 20, 0, 'Offering vestibule');
  crate('Vestibule offering', 3, 0);
  crate('Vestibule offering pair', 6, 0);
  crate('Ember mask: protection before the first flame', 10, 0, 'mask');
  crate('Vestibule mystery', 14, 0, 'mystery');
  fruitArc(0, 10, 0, .4);
  lamp(1, 'Vestibule lamp'); lamp(17, 'Vestibule lamp');

  // Room 2 · Ember gate. A flame sentinel stands behind the lane and breathes
  // across it toward the viewer; the sweep covers about six metres of floor.
  // Two offerings stand inside that sweep: read the amber windup, cross or
  // spin while it cools. Lamps mark the safe floor on both sides.
  deck(20, 42, 0, 'Ember gate');
  add({ t: 'platform', p: [EMBER_RELIQUARY_TIKI_X, -.25, -4.6], s: [3.8, .5, 3.8], tex: 'stone', color: '#a1a68c', grp: 1, nm: 'Sentinel footing behind the lane' });
  add({ t: 'wall', p: [EMBER_RELIQUARY_TIKI_X, 0, -4.6], s: [2.65, 2.9, 2.65], invisible: true, edgeGrinding: false, grp: 1, nm: 'Sentinel head collision core' });
  add({ t: 'firetiki', p: [EMBER_RELIQUARY_TIKI_X, 0, -4.6], yaw: 0, range: 7.1, cycle: 7.8, phase: 0, amp: 28, w: 1, grp: 1,
    nm: 'Ember gate sentinel: amber windup, fire across the lane, then safe cooling' });
  crate('Ember gate offering', 30, 0);
  crate('Ember gate offering pair', 32, 0);
  for (let x = 24; x <= 38; x += 2) add({ t: 'wumpa', p: [x, 1, 0], grp: 2, nm: 'Floor fruit through the sweep' });
  lamp(23, 'Safe floor lamp before the sweep'); lamp(39, 'Safe floor lamp after the sweep');

  // Room 3 · Jade bridge chain. The visible switch is high: keep the arrow,
  // bounce to the shelf, strike the switch so the outlined bridge becomes
  // real, drop back to the deck, clear the arrow last, then cross.
  deck(42, EMBER_RELIQUARY_BRIDGE[0], 0, 'Switch court below the shelf');
  deck(EMBER_RELIQUARY_BRIDGE[0], EMBER_RELIQUARY_BRIDGE[1], 0, 'Visible jade bridge created by the high switch', true, 21);
  deck(EMBER_RELIQUARY_BRIDGE[1], 88, 0, 'Bridge receiver court');
  add({ t: 'pit', p: [(EMBER_RELIQUARY_BRIDGE[0] + EMBER_RELIQUARY_BRIDGE[1]) / 2, -7, 0], s: [EMBER_RELIQUARY_BRIDGE[1] - EMBER_RELIQUARY_BRIDGE[0], 1, 6.4], grp: 1, nm: 'Visible chasm below the required crossing' });
  crate('Reliquary arrow: preserve it until the high switch is struck', 45, 0, 'bouncy');
  deck(47.5, 56.5, 7.8, 'High switch shelf');
  crate('High jade switch: strike it from the shelf', 51, 7.8, 'bang', 21);
  crate('Shelf mystery', 55, 7.8, 'mystery');
  crate('Receiver offering', 77, 0);
  crate('Receiver mystery', 80, 0, 'mystery');
  fruitArc(45, 49, 3, 3);
  fruitArc(EMBER_RELIQUARY_BRIDGE[0], EMBER_RELIQUARY_BRIDGE[1], 0, .35);
  lamp(43.5, 'Switch court lamp'); lamp(86, 'Receiver court lamp');

  // Room 4 · Fuse vault: stomp the wooden cap for the overhead life first,
  // return to prime the TNT, and wait in the marked refuge behind it.
  deck(88, 114, 0, 'Fuse vault');
  crate('Vault timed support', 96, 0, 'tnt');
  crate('Vault wooden takeoff cap', 96, .96);
  crate('Vault life before the fuse', 96, 9, 'life');
  crate('Vault refuge mystery', 103, 0, 'mystery');
  fruitArc(96, 91.5, 0);
  lamp(90, 'Vault refuge lamp'); lamp(112, 'Vault exit lamp');

  // Room 5 · Nitro corridor. Three volatile offerings stand on the floor,
  // seven metres apart, with fruit arcs drawing each jump. The green switch
  // waits well beyond the last one; it counts all three at once.
  deck(114, 158, 0, 'Nitro corridor and reliquary return');
  for (const x of EMBER_RELIQUARY_NITRO_X) {
    crate('Volatile offering: jump it, count it from the green switch', x, 0, 'nitro');
    fruitArc(x - 2.6, x + 2.6, 0, 2.3);
  }
  crate('Green switch: detonate every volatile offering for the complete count', 141, 0, 'nitrobang');
  lamp(116, 'Corridor lamp'); lamp(138, 'Green switch lamp'); lamp(152, 'Return lamp');
  const gateX = 150, end = gateX + 8;
  add({ t: 'gate', p: [gateX, 0, 0], yaw: 90, grp: 1, nm: 'Reliquary return after the earned gem approach' });
  for (const z of [-.83, .83]) add({ t: 'wall', p: [end / 2 - 10, -14, z], s: [end + 60, 46, .6], invisible: true, grp: 3, nm: 'Single-plane side-scrolling boundary' });
  add({ t: 'camnode', p: [-14, 0, 0], radius: 0, grp: 3 });
  add({ t: 'camnode', p: [end + 13, 0, 0], radius: 0, grp: 3 });
  add({ t: 'camnode', p: [end / 2, 8, 0], s: [end + 54, 48, 18], cameraView: true, radius: 1,
    cameraPosition: [2, 8.2, 22], cameraTarget: [2, 5.6, 0], cameraFollowDistance: 26, cameraFollowTargetHeight: 5.3, cameraIntroDistance: 0,
    cameraFov: 49, cameraAspect: 1.3, grp: 3, nm: 'Uniform bonus view with stable landings and tall-bounce framing' });

  // Temple night dressing: the terraces backdrop, moonlit fog, and warm lamps
  // that stay clear of the sentinel so its fire is the only light there.
  const art = bonusCourseArt('terraces', end);
  for (let x = 4; x < end; x += 18) if (Math.abs(x - EMBER_RELIQUARY_TIKI_X) > 8)
    art.push({ t: 'torch', p: [x, 0, -4.6], rise: 2, w: 1.1, grp: 90, nm: 'Reliquary torch' });
  components.push(...art);
  const data: CustomLevelData = { v: 1, name: 'Bonus: Ember Reliquary', spawn: [-6, .12, 0], killY: -12, hudMode: 'bonus',
    sky: 'night', jungleAtmosphere: true, cameraAirLift: .85, components,
    groups: [
      { id: 1, nm: 'Supported courts, sentinel footing and the return gate', editorOnly: true },
      { id: 2, nm: 'Ordered crate decisions', editorOnly: true },
      { id: 3, nm: 'Side-view camera and depth containment', editorOnly: true },
      { id: 21, nm: 'High switch · jade bridge circuit' },
      { id: 90, nm: 'Reliquary night scenery', editorOnly: true },
    ] };
  Object.assign(data, bonusArtAtmosphere('terraces'));
  data.atmosphere = { ...TEMPLE_NIGHT_ATMOSPHERE };
  data.jungleDepthFade = false; data.jungleStyle = 'painterly';
  return { data, rooms: [], actions: [] };
}

/** One shared instance: the campaign registry, the editor entry and the
 * standalone tests must all see the same authored object. */
export const EMBER_RELIQUARY_BONUS_COURSE = createEmberReliquaryBonus();
export const EMBER_RELIQUARY_BONUS_LEVEL = EMBER_RELIQUARY_BONUS_COURSE.data;
