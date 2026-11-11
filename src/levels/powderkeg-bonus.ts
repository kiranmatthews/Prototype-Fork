import type { CustomComponent, CustomLevelData } from '../level';

type Kind = NonNullable<CustomComponent['kind']>;
const SNOW = '#f2f6fc', ICE = '#a9dcf2', ROCK = '#6f7688', TIMBER = '#b98f5e';

/** Cold Storage · the Powderkeg Peak bonus round. A frozen store room laid
 * out as one side-scrolling lane toward +X, with five ledges that recombine
 * the mountain's vocabulary: a calm pile on snow, a brake row on ice under a
 * stamper, an arrow kept as the only tool to a high shelf, a capped TNT and a
 * Nitro-framed life, and a `!` switch whose steel bridge carries the last two
 * boxes to the green switch and the gate. 17 counted boxes; a fall only
 * returns the player to the mountain. */
export const POWDERKEG_BONUS_LEDGES = {
  arrival: [-10, 12, 0],
  ice: [15, 36, -1.2],
  crumble: [39, 42, -1.2],
  arrow: [45, 59, 0],
  vault: [62.5, 85, .8],
  switch: [88.5, 95, .8],
  bridge: [95, 101.912, .8],
  finish: [101.912, 115, .8],
} as const;
export const POWDERKEG_BONUS_STAMPER_X = 20;
export const POWDERKEG_BONUS_ARROW_X = 52;
/** Underside of the arrow-gated pair above the high shelf floor (y 0). */
export const POWDERKEG_BONUS_HIGH_Y = 8.3;
export const POWDERKEG_BONUS_TNT_X = 68;
export const POWDERKEG_BONUS_REFUGE_X = 64;
export const POWDERKEG_BONUS_LIFE_X = 78;
export const POWDERKEG_BONUS_SWITCH_X = 93;
export const POWDERKEG_BONUS_GREEN_X = 105;
export const POWDERKEG_BONUS_GATE_X = 109;

const BRIDGE_GROUP = 21;
const L = POWDERKEG_BONUS_LEDGES;

function createPowderkegBonus(): CustomLevelData {
  const components: CustomComponent[] = [];
  const add = (c: CustomComponent): void => { components.push(c); };
  const deck = (a: number, b: number, y: number, nm: string, look: Partial<CustomComponent>): void => {
    const h = y + 9;
    add({ t: 'platform', p: [(a + b) / 2, y - h / 2, 0], s: [b - a, h, 6.4], grp: 1, nm, ...look });
  };
  const chasm = (a: number, b: number, nm: string): void =>
    add({ t: 'pit', p: [(a + b) / 2, -7, 0], s: [b - a, 1, 6.4], color: '#1b2233', grp: 1, nm });
  const crate = (nm: string, x: number, y: number, kind: Kind = 'wood', grp = 2): void =>
    add({ t: 'crate', nm, p: [x, y, 0], kind, grp });
  const lamp = (x: number, y: number, nm: string): void =>
    add({ t: 'torch', p: [x, y, -2.6], rise: 1.7, w: .95, grp: 90, nm });
  const snow = { tex: 'snow', color: SNOW };
  const ice = { tex: 'ice', color: ICE, slip: true };

  // Beat 1 · Loading bay (snow). A calm three-box pile: spin the base pair and
  // the upper box drops into reach. Teaches the count before anything bites.
  deck(L.arrival[0], L.arrival[1], L.arrival[2], 'Loading bay: arrival and the opening pile', snow);
  crate('Loading pile (teach): base', 4, 0);
  crate('Loading pile (teach): upper box drops when the base goes', 4, .96);
  crate('Loading pile (teach): mystery beside the stack', 4.96, 0, 'mystery');
  lamp(-8, 0, 'Arrival lamp'); lamp(9, 0, 'Loading bay lamp');
  chasm(L.arrival[1], L.ice[0], 'First drop: a plain gap down onto the ice');

  // Beat 2 · Ice locker. Time the stamper from the snow, leap down onto the
  // ice and slide under the block: on ice you cannot stop beneath it. The
  // three-box row just beyond is the brake that stops the slide; break it
  // once you have stopped, then use the long ice behind it as a run-up.
  deck(L.ice[0], L.ice[1], L.ice[2], 'Ice locker: slick floor under the stamper', ice);
  add({ t: 'crusher', p: [POWDERKEG_BONUS_STAMPER_X, L.ice[2], 0], s: [2.4, 3, 2.2], cycle: 3.6, phase: 0, color: '#bfe2f4', grp: 1,
    nm: 'Ice stamper: hangs, slams, rests, rises; the shadow marks the floor' });
  crate('Brake row (test): stops the slide past the stamper', 24.3, L.ice[2]);
  crate('Brake row (test): mystery in the middle', 25.26, L.ice[2], 'mystery');
  crate('Brake row (test): last box before the run-up', 26.22, L.ice[2]);
  lamp(31, L.ice[2], 'Ice locker lamp at the run-up');
  chasm(L.ice[1], L.crumble[0], 'Gap to the crumbling shelf');
  add({ t: 'crumble', p: [(L.crumble[0] + L.crumble[1]) / 2, L.crumble[2], 0], s: [L.crumble[1] - L.crumble[0], .5, 3.2],
    tex: 'bridge-ice', color: ICE, grp: 1, nm: 'Crumbling ice shelf: land and go' });
  chasm(L.crumble[1], L.arrow[0], 'Gap up to the arrow shelf');

  // Beat 3 · High shelf (snow). The arrow is the only tool: its bounce plus a
  // double jump bonks the two floating boxes. Measured in this engine against
  // the character's crate-contact silhouette (not the older Part XV figures):
  // floor jump + double jump tops out at 7.5 m, arrow + double jump at 9.6 m,
  // so the pair floats with its underside at 8.3 m. The nearest plain box is
  // more than 20 m away, so no stomp substitutes for the arrow. Break the
  // arrow last.
  deck(L.arrow[0], L.arrow[1], L.arrow[2], 'High shelf: the arrow gate', snow);
  crate('Arrow gate (tool): keep it until both high boxes are down', POWDERKEG_BONUS_ARROW_X, 0, 'bouncy');
  crate('Arrow gate (reward): life on the high shelf, arrow + double jump only', POWDERKEG_BONUS_ARROW_X - .48, POWDERKEG_BONUS_HIGH_Y, 'life');
  crate('Arrow gate (reward): mystery on the high shelf, arrow + double jump only', POWDERKEG_BONUS_ARROW_X + .48, POWDERKEG_BONUS_HIGH_Y, 'mystery');
  lamp(47, 0, 'High shelf lamp'); lamp(57, 0, 'High shelf lamp');
  chasm(L.arrow[1], L.vault[0], 'Gap up to the powder vault');

  // Beat 4 · Powder vault (stone). A wooden cap sits on a TNT: stomp the cap,
  // drop onto the TNT to light it, and retreat to the lamp-lit refuge 4 m back
  // while the blast pays out the mystery beside it. Further on, a life is
  // framed by two Nitro and can only be taken from above.
  deck(L.vault[0], L.vault[1], L.vault[2], 'Powder vault: fuse refuge, TNT and the Nitro frame', { tex: 'stone', color: ROCK });
  const v = L.vault[2], tnt = POWDERKEG_BONUS_TNT_X, life = POWDERKEG_BONUS_LIFE_X;
  crate('Fuse order (trap): TNT under the cap; light it by stomp, never spin it', tnt, v, 'tnt');
  crate('Fuse order (trap): wooden cap, stomp it first', tnt, v + .96);
  crate('Fuse order (reward): mystery inside the blast, the explosion pays it out', tnt + 2, v, 'mystery');
  lamp(POWDERKEG_BONUS_REFUGE_X - 1, v, 'Fuse refuge lamp: wait here, 4 m from the TNT');
  crate('Nitro frame (risk): near Nitro, jump it', life - 1.92, v, 'nitro');
  crate('Nitro frame (risk): life taken from above only', life, v, 'life');
  crate('Nitro frame (risk): far Nitro, bounce clear of it', life + 1.92, v, 'nitro');
  lamp(83.5, v, 'Vault exit lamp');
  chasm(L.vault[1], L.switch[0], 'Gap to the switch landing');

  // Beat 5 · Switch landing (timber) and the steel bridge. The `!` makes six
  // steel boxes real across the last chasm; two wooden boxes ride on them and
  // are spun on the way over. The green `!` stands last before the gate and
  // credits both Nitro.
  deck(L.switch[0], L.switch[1], L.switch[2], 'Switch landing above the last chasm', { tex: 'plank', color: TIMBER });
  crate('Bridge switch (gate): makes the steel bridge real', POWDERKEG_BONUS_SWITCH_X, L.switch[2], 'bang', BRIDGE_GROUP);
  const bx0 = 96.056, by = L.bridge[2] - 1.152;
  for (let i = 0; i < 6; i++)
    add({ t: 'crate', kind: 'metal', p: [bx0 + i * .96, by, 0], grp: BRIDGE_GROUP, nm: `Steel bridge ${i + 1}` });
  crate('Bridge cargo (reward): wooden box on the steel bridge', bx0 + .96, by + .96, 'wood', BRIDGE_GROUP);
  crate('Bridge cargo (reward): second wooden box on the steel bridge', bx0 + 3.84, by + .96, 'wood', BRIDGE_GROUP);
  add({ t: 'pit', p: [(L.bridge[0] + L.bridge[1]) / 2, -7, 0], s: [L.bridge[1] - L.bridge[0], 1, 6.4], color: '#1b2233', grp: 1,
    nm: 'Last chasm under the switch-built bridge' });
  lamp(90, L.switch[2], 'Switch landing lamp');

  deck(L.finish[0], L.finish[1], L.finish[2], 'Cold Storage exit', snow);
  crate('Green switch: credits both vault Nitro, last object before the gate', POWDERKEG_BONUS_GREEN_X, L.finish[2], 'nitrobang');
  lamp(103.5, L.finish[2], 'Exit lamp'); lamp(112, L.finish[2], 'Gate lamp');
  const end = L.finish[1];
  add({ t: 'gate', p: [POWDERKEG_BONUS_GATE_X, L.finish[2], 0], yaw: 90, grp: 1, nm: 'Cold Storage return gate' });

  // Store-room backdrop: one rock wall behind the lane, and timber beams.
  add({ t: 'wall', p: [end / 2 - 6, -10, -4.2], s: [end + 36, 24, .8], tex: 'stone', color: ROCK, edgeGrinding: false, grp: 90, nm: 'Store-room back wall' });
  for (const x of [6, 30, 55, 79, 99])
    add({ t: 'platform', p: [x, 6.5, -3.6], s: [.5, 16, .5], tex: 'plank', color: TIMBER, edgeGrinding: false, grp: 90, nm: 'Store-room post' });

  for (const z of [-.83, .83]) add({ t: 'wall', p: [end / 2 - 10, -14, z], s: [end + 60, 46, .6], invisible: true, grp: 3, nm: 'Single-plane side-scrolling boundary' });
  add({ t: 'camnode', p: [-14, 0, 0], radius: 0, grp: 3 });
  add({ t: 'camnode', p: [end + 13, 0, 0], radius: 0, grp: 3 });
  add({ t: 'camnode', p: [end / 2, 8, 0], s: [end + 54, 48, 18], cameraView: true, radius: 1,
    cameraPosition: [2, 8.2, 22], cameraTarget: [2, 5.6, 0], cameraFollowDistance: 26, cameraFollowTargetHeight: 5.3, cameraIntroDistance: 0,
    cameraFov: 49, cameraAspect: 1.3, grp: 3, nm: 'Uniform bonus view with stable landings and tall-bounce framing' });

  return { v: 1, name: 'Bonus: Cold Storage', spawn: [-6, .12, 0], killY: -12, hudMode: 'bonus', sky: 'night', cameraAirLift: .85, components,
    groups: [
      { id: 1, nm: 'Supported ledges, hazards and the return gate', editorOnly: true },
      { id: 2, nm: 'Ordered crate decisions', editorOnly: true },
      { id: 3, nm: 'Side-view camera and depth containment', editorOnly: true },
      { id: BRIDGE_GROUP, nm: 'Bridge switch · steel bridge circuit' },
      { id: 90, nm: 'Store-room lamps and backdrop', editorOnly: true },
    ] };
}

export const POWDERKEG_BONUS_LEVEL: CustomLevelData = createPowderkegBonus();
