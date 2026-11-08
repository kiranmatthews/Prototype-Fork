import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { makeTempleWorld, templePoint, templeLocal, templeFrame, templeSourceHeight, type TempleLayout } from './jungle-temple-space';
import { TEMPLE_NIGHT_ATMOSPHERE } from './temple-night-atmosphere';

/**
 * TEMPLE OF EMBERS · the Ember Procession.
 *
 * A night temple cut into a cliff. The processional road climbs it as an
 * axis-aligned switchback: four galleries running east and west, one storey
 * above the other, joined by courts at the ends. Every chapter owns one set
 * piece that fuses a Crash hazard with a skating answer: breathing ember
 * stones and a gold rail, burning grind ropes over a bellows floor, an ash
 * floor and a board boost, a side-view censer hall, a brazier lift, a serpent
 * whose spine is a grind, a kickflip-sealed shrine, a piston vault, one jade
 * reservoir, a three-flame gauntlet and a nitro sanctuary.
 *
 * The course is authored in station space (s along the road, side across,
 * y up) through a small DSL that registers everything it places. `verify()`
 * then refuses to build a course in which a rail passes through a crate, a
 * crate stands inside a flame sweep or a swing without being meant to, a
 * crate sits on a moving or breaking pad, a checkpoint respawns next to a
 * hazard, or a rigid set piece lands in a bend. Collision-free by construction.
 */
type P = [number, number, number];
type Kind = NonNullable<CustomComponent['kind']>;
type Foe = NonNullable<CustomComponent['foe']>;
export interface TemplePipe { name: string; a: number; b: number; lipY: number; radius: number; arc: number; baseY: number; }
export interface TempleGap { a: number; b: number; y: number; switchX?: number; group?: number; }
export interface TempleRoom { name: string; x: number; y: number; launchX: number; capY: number; switchX?: number; group?: number; }
export interface TempleClimb { a: number; b: number; base: number; top: number; steps: number; side: number; }
export interface TempleVoid { a: number; b: number; floorY: number; name: string; }
export interface TempleChapter { name: string; a: number; b: number; mode: 'skate' | 'platform' | 'rest'; lesson: string; }
export interface TempleSetPieces {
  phasePads: { s: number; a: number; b: number; phase: number; cycle: number; duty: number }[];
  ropes: { a: number; b: number; side: number; y: number; shake: number }[];
  trampolines: { s: number; side: number; y: number }[];
  crumbles: { s: number; side: number; a: number; b: number }[];
  censers: { s: number; pivotY: number; len: number; amp: number; speed: number; phase: number }[];
  lift: { a: number; b: number; low: number; high: number; speed: number; phase: number } | null;
  serpent: { s: number; range: number; speed: number } | null;
  shrine: { a: number; b: number; gateS: number; gateSide: number; gateY: number; trick: string } | null;
  crushers: { s: number; phase: number; cycle: number }[];
  speedPads: { s: number; speed: number }[];
  zone: { a: number; b: number } | null;
}
export interface TempleRoute {
  id: string; data: CustomLevelData; sourceComponents: CustomComponent[];
  toWorld: (s: number, y: number, side?: number) => P; toLocal: (p: readonly number[]) => P;
  frameAt: (s: number) => ReturnType<typeof templeFrame>; groundAt: (s: number) => number;
  profile: readonly (readonly [number, number])[]; pipes: TemplePipe[]; gaps: TempleGap[]; rooms: TempleRoom[]; climbs: TempleClimb[];
  voids: TempleVoid[]; chapters: TempleChapter[]; setPieces: TempleSetPieces; tikiTrials: { s: number; side: number }[];
  peak: number; end: number; countedCrates: number; checks: string[];
}

export const TEMPLE_WIDTH = 8;
const WIDTH = TEMPLE_WIDTH, STONE = '#c8bc94', JADE = '#79a996', GOLD = '#cfb36c', ASH = '#8d7466';
const CRATE = 1.152; // runtime cube edge; authored stacks step 0.96 and are enlarged by the loader
const FLAME_REACH = 3.6; // metres along the lane a sentinel's sweep covers each way
const FLAME_SPILL = 1.6; // the hot tongue reaches this far past the lane centre on the far side
const round = (n: number) => Math.round(n * 10000) / 10000;

/** World knots [station, x, z]. Every leg is axis aligned, so world-axis
 * primitives (patrols, lifts, pads, crushers) keep their authored meaning. */
const KNOTS = [[-20,0,0],[115,0,-135],[355,240,-135],[455,240,-235],[695,0,-235],[795,0,-335],[1035,240,-335],[1135,240,-435],[1375,0,-435],[1490,0,-550]] as const;
const END = 1490, FILLET = 12.5;

interface Floor { a: number; b: number; ya: number; yb: number; side: number; depth: number; level: 'main' | 'lower' | 'stair' | 'bay' | 'pipe'; nm: string; }
interface PlacedCrate { s: number; side: number; y: number; kind: Kind; nm: string; flags: Set<string>; }
interface PlacedRail { a: number; b: number; ya: number; yb: number; side: number; nm: string; }
interface Patrol { s: number; side: number; along: boolean; range: number; foe: Foe | 'grindosaurus'; nm: string; }
interface Pad { a: number; b: number; sideA: number; sideB: number; kind: string; nm: string; }

export function buildTempleOfEmbers(): TempleRoute {
  const components: CustomComponent[] = [];
  const groups: CustomGroup[] = [
    {id:1,nm:'Temple masonry and continuous skating lines',editorOnly:true},
    {id:2,nm:'Jade transition and set-piece machinery',editorOnly:true},
    {id:3,nm:'Gold grind lines',editorOnly:true},
    {id:4,nm:'Crate decisions and rewards',editorOnly:true},
    {id:5,nm:'Checkpoints, bonus and course finish',editorOnly:true},
    {id:6,nm:'Winding temple camera spine',editorOnly:true},
    {id:7,nm:'Solid temple storeys and sanctuary halls',editorOnly:true},
    {id:8,nm:'Temple patrols on supported ground',editorOnly:true},
    {id:90,nm:'Jungle temple scenery',editorOnly:true},
    {id:91,nm:'Planted earth banks and canopy',editorOnly:true},
    {id:92,nm:'Weathered paving and reservoir gateways',editorOnly:true},
    {id:93,nm:'Roofed courts and sanctuaries',editorOnly:true},
    {id:94,nm:'Enclosing jungle ravine',editorOnly:true},
    {id:201,nm:'Continuous temple shoulders and parapets',editorOnly:true},
    {id:205,nm:'Merged course recovery and bonus',editorOnly:true},
    {id:207,nm:'Pooled warm torch lighting',editorOnly:true},
    {id:208,nm:'Turning fire tiki sentinels',editorOnly:true},
    {id:209,nm:'Treehouse forest canopy',editorOnly:true},
    {id:215,nm:'Lantern courts and fitted stonework',editorOnly:true},
  ];
  // ---- registries -------------------------------------------------------
  const floors: Floor[] = [], crates: PlacedCrate[] = [], rails: PlacedRail[] = [], flames: { s: number; side: number; nm: string }[] = [];
  const patrols: Patrol[] = [], pads: Pad[] = [], pits: { a: number; b: number }[] = [], voids: TempleVoid[] = [];
  const pendulums: { s: number; side: number; nm: string }[] = [], checkpoints: { s: number; nm: string }[] = [], rigid: { s: number; nm: string }[] = [];
  const torches: { s: number; side: number; nm: string }[] = [], lampFree: { a: number; b: number }[] = [];
  const parapetFree: { a: number; b: number; side: number }[] = [], shoulderFree: { a: number; b: number }[] = [];
  const pipes: TemplePipe[] = [], gaps: TempleGap[] = [], climbs: TempleClimb[] = [], chapters: TempleChapter[] = [];
  const stairArt: [number, number][] = [], bays: [number, number, number][] = [], paved: [number, number][] = [];
  const gateways: [number, string][] = [], halls: [number, number, string][] = [], scorched: [number, number][] = [];
  const setPieces: TempleSetPieces = { phasePads: [], ropes: [], trampolines: [], crumbles: [], censers: [], lift: null, serpent: null, shrine: null, crushers: [], speedPads: [], zone: null };
  const add = (c: CustomComponent) => components.push(c);
  const rigidAt = (s: number, nm: string) => rigid.push({ s, nm });

  // ---- floors -----------------------------------------------------------
  const slab = (a: number, b: number, y: number, nm: string, side = 0, depth = WIDTH, level: Floor['level'] = 'main', color = STONE) => {
    add({ t: 'platform', p: [(a + b) / 2, y - .65, side], s: [b - a, 1.3, depth], tex: 'jungle', color, grp: 1, nm });
    floors.push({ a, b, ya: y, yb: y, side, depth, level, nm });
  };
  const slope = (a: number, b: number, ya: number, yb: number, nm: string) => {
    add({ t: 'ramp', p: [(a + b) / 2, Math.min(ya, yb), 0], len: b - a, rise: Math.abs(yb - ya), w: WIDTH, yaw: yb >= ya ? -90 : 90, tex: 'jungle', color: STONE, grp: 1, nm });
    floors.push({ a, b, ya, yb, side: 0, depth: WIDTH, level: 'main', nm });
  };
  const paveRange = (a: number, b: number) => paved.push([a, b]);
  const chapter = (name: string, a: number, b: number, mode: TempleChapter['mode'], lesson: string) => chapters.push({ name, a, b, mode, lesson });
  const gateway = (s: number, name: string) => gateways.push([s, name]);
  const hall = (s: number, depth: number, name: string) => halls.push([s, depth, name]);

  // ---- rewards and lines ----------------------------------------------
  const crate = (s: number, side: number, y: number, kind: Kind, nm: string, ...flags: string[]) => {
    add({ t: 'crate', p: [s, y, side], kind, nm, grp: 4 });
    crates.push({ s, side, y, kind, nm, flags: new Set(flags) });
  };
  const stack = (s: number, side: number, y: number, bottom: Kind, cap: Kind, nm: string, ...flags: string[]) => {
    crate(s, side, y, bottom, nm, ...flags); crate(s, side, y + .96, cap, `${nm}: cap`, 'cap', ...flags);
  };
  const fruit = (s: number, y: number, side = 1.25, nm = 'Readable skating line') => add({ t: 'wumpa', p: [s, y + 1, side], grp: 4, nm });
  const line = (a: number, b: number, ya: number, yb = ya, side = 1.25) => { for (let s = a; s <= b + .01; s += 4) fruit(s, ya + (yb - ya) * (s - a) / (b - a || 1), side); };
  const arc = (a: number, b: number, y: number, side: number, rise = 1.6, nm = 'Fruit arc over the crossing') => {
    for (let n = 0; n < 5; n++) add({ t: 'wumpa', p: [a + (b - a) * n / 4, y + 1 + Math.sin(n / 4 * Math.PI) * rise, side], grp: 4, nm });
  };
  const rail = (a: number, b: number, ya: number, yb: number, side: number, nm: string) => {
    add({ t: 'rail', p: [a, ya, side], pts: [[0, 0], [b - a, 0, 0, yb - ya]], color: GOLD, grp: 3, nm });
    rails.push({ a, b, ya, yb, side, nm });
    for (let s = a + 4; s <= b - 4; s += 6) add({ t: 'wumpa', p: [s, ya + (yb - ya) * (s - a) / (b - a) + 1.15, side], grp: 3, nm: 'Gold grind line fruit' });
  };
  const checkpoint = (s: number, nm: string) => { add({ t: 'checkpoint', p: [s, groundHere(s), 1.1], grp: 5, nm }); checkpoints.push({ s, nm }); };
  const torch = (s: number, side: number, y: number, nm: string, rise = 1.7, w = 1) => { add({ t: 'torch', p: [s, y, side], rise, w, grp: 207, nm }); torches.push({ s, side, nm }); };

  // ---- hazards -----------------------------------------------------------
  const flame = (s: number, side: number, phase: number, nm: string) => { flames.push({ s, side, nm }); rigidAt(s, nm); void phase; flamePhases.push(phase); };
  const flamePhases: number[] = [];
  const patrol = (s: number, side: number, foe: Foe, range: number, speed: number, along: boolean, nm: string) => {
    add({ t: 'enemy', foe, p: [s, groundHere(s), side], yaw: along ? 0 : 90, range, speed, terrainSupports: true, grp: 8, nm: `Temple ${foe}: ${nm}` });
    patrols.push({ s, side, along, range, foe, nm }); rigidAt(s, nm);
  };
  const pit = (a: number, b: number, y: number, nm: string) => {
    add({ t: 'pit', p: [(a + b) / 2, y - 7, 0], s: [b - a, 1, WIDTH + 3.2], grp: 1, nm });
    pits.push({ a, b }); gaps.push({ a, b, y }); lampFree.push({ a: a - 3, b: b + 3 }); shoulderFree.push({ a, b });
    for (const side of [-1, 1]) parapetFree.push({ a, b, side });
  };
  const pad = (a: number, b: number, sideA: number, sideB: number, kind: string, nm: string) => { pads.push({ a, b, sideA, sideB, kind, nm }); rigidAt((a + b) / 2, nm); };

  // ---- height queries during authoring ------------------------------------
  const groundHere = (s: number): number => {
    const f = floors.find(q => q.level === 'main' && s >= q.a - 1e-6 && s <= q.b + 1e-6);
    if (f) return round(f.ya + (f.yb - f.ya) * (s - f.a) / (f.b - f.a || 1));
    // Pads bridge a chasm at the height of the floor the chasm interrupts.
    const g = gaps.find(q => s >= q.a && s <= q.b);
    if (!g) throw new Error(`No main floor at station ${s}`);
    return g.y;
  };
  const mainFloorAt = (s: number, side = 0): number | undefined => {
    const f = floors.find(q => (q.level === 'main' || q.level === 'bay' || q.level === 'stair') && s >= q.a - 1e-6 && s <= q.b + 1e-6 && Math.abs(side - q.side) <= q.depth / 2 + 1e-6);
    return f ? round(f.ya + (f.yb - f.ya) * (s - f.a) / (f.b - f.a || 1)) : undefined;
  };

  // ---- set pieces ----------------------------------------------------------
  const climb = (a: number, b: number, steps: number, nm: string) => {
    // Stairs on the left shoulder of a bank. The first step is reached from
    // the bank where their heights meet; the last step meets the terrace.
    const side = -7.5, span = (b - a) / steps, base = groundHere(a), top = groundHere(b);
    climbs.push({ a, b, base, top, steps, side }); stairArt.push([a, b]);
    for (let i = 0; i < steps; i++) {
      const y = round(base + (top - base) * (i + 1) / steps);
      slab(a + i * span, a + (i + 1) * span, y, `Jungle temple climbing step ${i + 1}`, side, 5, 'stair');
      add({ t: 'wumpa', p: [a + (i + .55) * span, y + 1, side], grp: 4, nm: 'Stepped ascent fruit trail' });
      if (i % 2 === 1) crate(a + (i + .62) * span, side - 1.3, y, i + 2 >= steps ? 'life' : 'mystery', `${nm}: pilgrim stair offering ${i + 1}`, 'stair');
    }
    parapetFree.push({ a: a - 2, b: b + 2, side: -1 });
  };
  const pipe = (a: number, b: number, lipY: number, radius: number, nm: string) => {
    const arcDeg = 60, deck = 2, angle = arcDeg * Math.PI / 180;
    const baseY = round(lipY - radius * (1 - Math.cos(angle))), flat = round((b - a) / 2 - radius * Math.sin(angle) - deck);
    add({ t: 'vertramp', p: [(a + b) / 2, baseY, 0], len: WIDTH * 2, w: flat, rise: radius, arc: arcDeg, deck, arcSteps: 24, vkind: 'half', yaw: 0, rails: false, tex: 'jungle', color: JADE, grp: 2, nm });
    pipes.push({ name: nm, a, b, lipY, radius, arc: arcDeg, baseY }); rigidAt((a + b) / 2, nm);
    floors.push({ a, b, ya: lipY, yb: lipY, side: 0, depth: WIDTH * 2, level: 'pipe', nm });
    for (const side of [-1, 1]) add({ t: 'wall', p: [(a + b) / 2, baseY - .1, side * (WIDTH + .35)], s: [b - a + 4, lipY - baseY + 1.2, .6], tex: 'stone', color: '#b5b69c', grp: 2, nm: `${nm} solid side retaining wall` });
    for (const s of [a + 2, (a + b) / 2, b - 2]) fruit(s, s === (a + b) / 2 ? baseY : lipY);
    shoulderFree.push({ a, b }); for (const side of [-1, 1]) parapetFree.push({ a, b, side });
  };
  const phasePad = (s: number, phase: number, nm: string, cycle = 10, duty = .65, along = 6, across = 5.6) => {
    const y = groundHere(s);
    add({ t: 'phasepad', p: [s, y, 0], s: [along, .65, across], cycle, phase, amp: duty, grp: 2, nm });
    setPieces.phasePads.push({ s, a: s - along / 2, b: s + along / 2, phase, cycle, duty }); pad(s - along / 2, s + along / 2, -across / 2, across / 2, 'phasepad', nm);
  };
  const rope = (a: number, b: number, side: number, shake: number, nm: string) => {
    const y = groundHere(a) + .9;
    add({ t: 'rope', p: [(a + b) / 2, y, side], len: b - a, yaw: 90, amp: .9, shake, grp: 3, nm });
    setPieces.ropes.push({ a, b, side, y, shake }); rails.push({ a, b, ya: y, yb: y, side, nm }); rigidAt((a + b) / 2, nm);
  };
  const trampoline = (s: number, side: number, y: number, nm: string) => {
    add({ t: 'trampoline', p: [s, y + .12, side], s: [4.5, .4, 4.5], speed: 19, amp: 1.25, grp: 2, nm });
    setPieces.trampolines.push({ s, side, y }); pad(s - 2.25, s + 2.25, side - 2.25, side + 2.25, 'trampoline', nm);
  };
  const crumble = (s: number, side: number, nm: string, along = 4.6, across = 5.2) => {
    const y = groundHere(s) + .035; // level with the ribbon floor it continues
    add({ t: 'crumble', p: [s, y, side], s: [along, .65, across], shake: .72, speed: 30, color: ASH, tex: 'stone', grp: 2, nm });
    setPieces.crumbles.push({ s, side, a: s - along / 2, b: s + along / 2 }); pad(s - along / 2, s + along / 2, side - across / 2, side + across / 2, 'crumble', nm);
  };
  const speedPad = (s: number, nm: string, speed = 30) => {
    const y = groundHere(s);
    add({ t: 'speedpad', p: [s, y + .04, 0], s: [6, .15, 5], speed, cycle: 3.9, grp: 2, nm });
    setPieces.speedPads.push({ s, speed }); pad(s - 3, s + 3, -2.5, 2.5, 'speedpad', nm);
  };
  const censer = (s: number, phase: number, nm: string, len = 6, amp = .95, speed = 1.3) => {
    const pivotY = groundHere(s) + 7;
    add({ t: 'pendulum', p: [s, pivotY, 0], len, amp, speed, phase, yaw: 0, grp: 2, nm }); // yaw 0 swings along the lane; 90 would sweep across it
    setPieces.censers.push({ s, pivotY, len, amp, speed, phase }); pendulums.push({ s, side: 0, nm }); rigidAt(s, nm);
  };
  const crusher = (s: number, phase: number, nm: string, cycle = 3.8) => {
    const y = groundHere(s);
    add({ t: 'crusher', p: [s, y, 0], s: [3.2, 3.6, WIDTH + 3.2], cycle, phase, color: '#6f6b60', grp: 2, nm });
    setPieces.crushers.push({ s, phase, cycle }); pad(s - 1.6, s + 1.6, -5.6, 5.6, 'crusher', nm);
    for (const side of [-1, 1]) parapetFree.push({ a: s - 1.9, b: s + 1.9, side });
  };

  // =========================================================================
  // CH 0 · RAVINE RIM AND ASH COURT (−24 → 127). Speed first: a drop-in bank
  // with the first rail beside it, then a weaving crate line, the mask, the
  // first checkpoint, the first flame read from the right lane, the first crab.
  // =========================================================================
  chapter('Ravine rim and ash court', -24, 127, 'skate', 'drop in, carve the weaving line, read the first flame from the right-hand lane');
  slab(-24, -10, 7, 'Ravine rim: the drop-in ledge'); paveRange(-24, -10);
  slope(-10, 30, 7, 0, 'Drop-in bank into the ash court');
  slab(30, 160, 0, 'Ash court and the approach to the gallery of stones'); paveRange(30, 100);
  rail(-4, 26, 6.75, 1.5, 3.4, 'Rim rail: the first grind beside the drop-in');
  line(-6, 26, 7.7, 1.7, -1.25);
  for (const [s, side] of [[36, 1.25], [40, -1.25], [44, 1.25]] as const) crate(s, side, 0, 'wood', 'Weaving arrival line: carve from box to box');
  crate(50, 0, 0, 'mask', 'Ash court mask: protection before the first flame');
  checkpoint(58, 'Ash court checkpoint');
  flame(84, -1, 0, 'first flame, read from the right-hand lane');
  stack(84, -1.5, 0, 'wood', 'wood', 'Offering inside the first flame\'s sweep: take it while the sentinel cools', 'sweep');
  patrol(96, 0, 'grunt', 1.45, 1.35, false, 'first crab crossing the open court: spin or stomp, escape on either side');
  stack(101, -2, 0, 'wood', 'wood', 'First offering beyond the crab');
  gateway(-6, 'Ravine rim gateway');

  // =========================================================================
  // CH 1 · GALLERY OF STONES (127 → 250). Ember stepping stones breathe amber
  // and blue over two chasms; a gold rail on the right crosses regardless.
  // =========================================================================
  chapter('Gallery of stones', 127, 250, 'platform', 'wait for the lit stone or grind the rail that ignores the rhythm');
  gateway(132, 'Gallery of Stones gateway'); paveRange(136, 160);
  checkpoint(140, 'Gallery of stones checkpoint');
  for (const [s, side] of [[148, 1.25], [152, -1.25]] as const) crate(s, side, 0, 'wood', 'Stone gallery approach rhythm');
  pit(160, 180, 0, 'First ember chasm');
  phasePad(165.5, 0, 'Ember stone 1 (amber)'); phasePad(174.5, .5, 'Ember stone 2 (blue)');
  rail(156, 184, .85, .85, 3.6, 'Stone gallery gold rail: a grind ignores the breathing stones');
  arc(160, 180, 0, -1.25, 1.2);
  slab(180, 200, 0, 'Stone island'); paveRange(180, 200);
  crate(190, -1.25, 0, 'mystery', 'Stone island mystery');
  pit(200, 231, 0, 'Second ember chasm');
  phasePad(206.5, 0, 'Ember stone 3 (amber)'); phasePad(215.5, .5, 'Ember stone 4 (blue)'); phasePad(224.5, 0, 'Ember stone 5 (amber)');
  rail(196, 235, .85, .85, 3.6, 'Second chasm gold rail');
  arc(200, 231, 0, -1.25, 1.2);
  slab(231, 262, 0, 'Stone gallery landing'); paveRange(231, 262);
  crate(240, 1.25, 0, 'wood', 'Stone gallery landing offering'); crate(244, -1.25, 0, 'wood', 'Stone gallery landing offering pair');

  // =========================================================================
  // CH 2 · BURNING ROPES (250 → 343). Two grind ropes over a sunken ash floor.
  // The fibre parts after a few seconds of weight, so commit. Falling is not
  // death: the floor below holds the consolation boxes and two ember bellows
  // that bounce a rider back to the course.
  // =========================================================================
  chapter('Burning ropes', 250, 343, 'skate', 'commit to the grind before the rope parts; the bellows floor forgives');
  gateway(256, 'Burning Ropes gateway');
  checkpoint(252, 'Burning ropes checkpoint');
  slab(262, 300, -5, 'Sunken ash floor beneath the ropes', 0, 11, 'lower', ASH);
  voids.push({ a: 262, b: 276, floorY: -5, name: 'first rope span' }, { a: 281, b: 300, floorY: -5, name: 'second rope span' });
  for (const v of voids) { shoulderFree.push(v); lampFree.push({ a: v.a - 2, b: v.b + 2 }); for (const side of [-1, 1]) parapetFree.push({ a: v.a, b: v.b, side }); }
  for (const side of [-1, 1]) add({ t: 'wall', p: [281, -5.1, side * 5.3], s: [38, 1, .5], tex: 'stone', color: '#9ca894', edgeGrinding: false, grp: 201, nm: 'Sunken floor kerb' });
  slab(276, 281, 0, 'Rope island'); 
  rope(261.5, 276.5, -1.6, 3, 'First burning rope: a grind that parts after three seconds');
  rope(280.5, 300.5, -1.6, 2.4, 'Second burning rope: longer, and it parts sooner');
  arc(262, 276, 1.2, -1.6, 1.4, 'Fruit above the burning rope'); arc(281, 300, 1.2, -1.6, 1.6, 'Fruit above the burning rope');
  trampoline(274, 0, -5, 'Ember bellows beneath the rope island'); trampoline(298, 0, -5, 'Ember bellows beneath the landing');
  crate(266, -2.2, -5, 'wood', 'Consolation on the ash floor', 'sunken'); crate(286, 2.2, -5, 'wood', 'Consolation on the ash floor', 'sunken'); crate(293, -2.2, -5, 'mystery', 'Ash floor mystery', 'sunken');
  slab(300, 367, 0, 'Rope landing and the turn to the pilgrim bank'); paveRange(300, 343);
  crate(306, -1.25, 0, 'wood', 'Rope landing rhythm'); crate(310, 1.25, 0, 'wood', 'Rope landing rhythm pair');
  patrol(318, -2, 'turtle', .75, 1.35, false, 'mossback on the landing: the stomp lesson, its shell left in the offering lane');
  stack(326, 2.4, 0, 'wood', 'wood', 'Offering across from the mossback shell');

  // =========================================================================
  // COURT 1 · PILGRIM BANK (355 → 455, 0 → 12). Three ways up: the bank,
  // the pilgrim stair on the left with its offerings, the gold rail on the right.
  // =========================================================================
  chapter('Pilgrim bank', 343, 467, 'skate', 'bank, stair or rail: three routes to the second storey');
  slope(367, 443, 0, 12, 'Pilgrim bank to the second storey');
  climb(377, 443, 6, 'Pilgrim stair');
  rail(377, 433, groundHere(377) + .8, groundHere(433) + .8, 3.6, 'Pilgrim bank gold grind');
  line(371, 439, groundHere(371), groundHere(439), 1.25);

  // =========================================================================
  // CH 3 · ASH GALLERY (443 → 590). A floor of ash pads that break under a
  // standing rider. The board boost before it crosses the whole field in one
  // run; on foot it is a hop rhythm with a mystery on the island.
  // =========================================================================
  chapter('Ash gallery', 443, 590, 'platform', 'keep moving on the ash, or boost across in one run');
  slab(443, 500, 12, 'Second storey terrace'); paveRange(443, 500); gateway(470, 'Ash Gallery gateway');
  checkpoint(474, 'Ash gallery checkpoint');
  crate(482, 1.25, 12, 'wood', 'Terrace rhythm'); crate(486, -1.25, 12, 'wood', 'Terrace rhythm pair');
  speedPad(494, 'Ember bellows boost: a board crosses the whole ash floor in one run');
  // The first pad of each run is flush with the floor it leaves, so a walking
  // rider steps onto ash; the 1.4 m gaps between pads are the hop rhythm.
  pit(500, 545.6, 12, 'Ash floor chasm');
  crumble(502.3, 0, 'Ash pad 1'); crumble(508.3, 0, 'Ash pad 2'); crumble(514.3, 0, 'Ash pad 3');
  slab(516.6, 523, 12, 'Ash island'); crate(520, -1.25, 12, 'mystery', 'Ash island mystery');
  crumble(525.3, -1.2, 'Ash pad 4'); crumble(531.3, 1.2, 'Ash pad 5'); crumble(537.3, -1.2, 'Ash pad 6'); crumble(543.3, 1.2, 'Ash pad 7');
  arc(500, 516.6, 12, 1.25, 1.4, 'Fruit over the ash field'); arc(523, 545.6, 12, -1.25, 1.4, 'Fruit over the ash field');
  slab(545.6, 598, 12, 'Ash floor landing'); paveRange(548, 598);
  stack(556, 2, 12, 'wood', 'mystery', 'Offering after the ash floor');
  flame(566, -1, 1.3, 'ash landing flame over the striped offering');
  crate(566, -1.6, 12, 'multihit', 'Striped offering inside the sweep: five hits timed to the sentinel\'s cooling', 'sweep');
  patrol(580, 0, 'hopper', 1.45, 1.15, false, 'spring frog on the landing: spin only while it is grounded');
  stack(586, -2.25, 12, 'wood', 'wood', 'Offering beyond the frog');

  // =========================================================================
  // CH 4 · CENSER HALL (590 → 683). The camera turns to the side. Three
  // censers swing along the hall; fruit runs through the swings, offerings
  // sit at the edge of each swing, and a gold rail on the right passes it all.
  // =========================================================================
  chapter('Censer hall', 590, 683, 'platform', 'time the swings in side view, or grind the right-hand rail past them');
  slab(598, 742, 12, 'Censer hall and the lift court'); gateway(596, 'Censer Hall gateway');
  checkpoint(592, 'Censer hall checkpoint');
  setPieces.zone = { a: 598, b: 680 };
  hall(616, 26, 'Censer hall west'); hall(656, 26, 'Censer hall east');
  censer(612, 0, 'First censer'); censer(636, 1.6, 'Second censer'); censer(660, 3.2, 'Third censer');
  for (const s of [612, 636, 660]) for (const d of [-4.8, 4.8]) crate(s + d, 0, 12, 'wood', 'Offering at the edge of the censer\'s swing');
  for (let s = 602; s <= 670; s += 3) add({ t: 'wumpa', p: [s, 13.2, 0], grp: 4, nm: 'Fruit line through the censer swings' });
  rail(604, 668, 12.85, 12.85, 3.6, 'Censer hall gold rail: grind past every swing');
  patrol(648, -1.2, 'floater', 1.45, 1.15, false, 'violet watcher between the censers: jump-spin it');
  stack(652, -2.4, 12, 'wood', 'wood', 'Offering beneath the watcher, on the lane away from the rail');

  // =========================================================================
  // COURT 2 · LIFT COURT (683 → 807, 12 → 24). A rest: the Ember Reliquary
  // bonus in a side court on the right, then a brazier lift to the third
  // storey, then the fuse court: cap first, prime, retreat to the refuge.
  // =========================================================================
  chapter('Lift court', 683, 807, 'rest', 'the bonus door, a burning lift, the cap-before-fuse lesson');
  gateway(709, 'Lift Court gateway'); paveRange(683, 742);
  slab(712, 732, 12, 'Reliquary landing: protected side court', 9, 7, 'bay'); bays.push([712, 732, 1]); parapetFree.push({ a: 712, b: 732, side: 1 });
  crate(736, -1.25, 12, 'wood', 'Lift court rhythm'); crate(740, 1.25, 12, 'wood', 'Lift court rhythm pair');
  pit(742, 752, 12, 'Counterweight shaft');
  gaps.pop(); // the shaft is a lift well with its own floor, not a mainline jump
  slab(742, 752, 7, 'Counterweight shaft floor', 0, 11, 'lower', ASH);
  voids.push({ a: 742, b: 752, floorY: 7, name: 'lift shaft' });
  // A fall into the well is caught by an ember draft: a one-way portal back to
  // the court floor before the lift (the trampoline would bounce a rider into
  // the descending deck).
  add({ t: 'returnportal', p: [747, 7.2, 0], s: [9.6, 4.2, 9.6], to: [737, 12.12, 0], exitYaw: 0, grp: 2, nm: 'Ember draft: a fall into the well returns to the lift court' });
  add({ t: 'mover', p: [747, 18, 0], s: [10.4, .85, 10.4], axis: 'y', amp: 6, speed: .5, phase: -Math.PI / 2, lit: true, tex: 'stone', color: '#a9a58c', grp: 2, nm: 'Brazier lift to the third storey' });
  setPieces.lift = { a: 742, b: 752, low: 12, high: 24, speed: .5, phase: -Math.PI / 2 }; pad(742, 752, -5.2, 5.2, 'mover', 'Brazier lift');
  slab(752, 1047, 24, 'Third storey: the lift landing, the fuse court and the serpent gallery'); paveRange(752, 807);
  checkpoint(756, 'Third storey checkpoint');
  stack(766, -2.3, 24, 'tnt', 'wood', 'Fuse court: collect the cap, prime the fuse, retreat to the refuge', 'fuse');
  crate(772, -2.3, 24, 'mystery', 'Fuse court: safe refuge reward beyond the blast');

  // =========================================================================
  // CH 5 · SERPENT GALLERY (807 → 920). A lethal patrolling body with a
  // grindable spine; ride most of it to defeat it, or take the side lanes.
  // A flame on the right, then the russet bull owns the centre of the gallery.
  // =========================================================================
  chapter('Serpent gallery', 807, 920, 'skate', 'grind the serpent\'s spine, read the flame, dodge the bull on the left lane');
  gateway(812, 'Serpent Gallery gateway');
  checkpoint(814, 'Serpent gallery checkpoint');
  crate(824, 1.25, 24, 'wood', 'Serpent approach rhythm'); crate(828, -1.25, 24, 'wood', 'Serpent approach rhythm pair');
  add({ t: 'grindosaurus', p: [846, 24, 0], yaw: 0, range: 12, speed: 1.6, coverage: .6, grp: 8, nm: 'Temple serpent: a lethal body whose spine is a grind; ride most of it to defeat it' });
  setPieces.serpent = { s: 846, range: 12, speed: 1.6 }; patrols.push({ s: 846, side: 0, along: true, range: 12, foe: 'grindosaurus', nm: 'temple serpent' }); rigidAt(846, 'temple serpent');
  for (let s = 836; s <= 856; s += 4) add({ t: 'wumpa', p: [s, 27.3, 0], grp: 4, nm: 'Spine fruit marks the serpent grind' });
  stack(866, 0, 24, 'wood', 'mystery', 'The serpent\'s hoard beyond its patrol');
  flame(884, 1, 2.6, 'serpent gallery flame on the right: the left lane is safe');
  crate(884, 1.5, 24, 'wood', 'Offering inside the sweep: take it while the sentinel cools', 'sweep');
  patrol(906, 0, 'charger', 9, 2.4, true, 'russet bull owns the centre of the gallery: read the windup, keep left, strike while it is dizzy');
  stack(922, -3, 24, 'wood', 'mystery', 'Bull refuge offering past the end of its lane');

  // =========================================================================
  // CH 6 · SEALED SHRINE (920 → 1023). A side chamber on the left sealed by a
  // kickflip gate: a flip through the ring opens it for good. Then the ember
  // sentry covers the approach to the flame climb.
  // =========================================================================
  chapter('Sealed shrine', 920, 1023, 'platform', 'a kickflip through the seal opens the shrine; jump the sentry\'s orb');
  gateway(934, 'Sealed Shrine gateway'); paveRange(920, 1023);
  checkpoint(930, 'Sealed shrine checkpoint');
  slab(950, 970, 24, 'Sealed shrine floor', -9, 7, 'bay'); bays.push([950, 970, -1]); parapetFree.push({ a: 950, b: 970, side: -1 });
  add({ t: 'trickgate', p: [960, 27, -5.25], yaw: 0, radius: 2.2, s: [5.2, 6.4, .6], trick: 'kick', grp: 2, nm: 'Kickflip seal: flip through the ring to open the shrine' });
  setPieces.shrine = { a: 950, b: 970, gateS: 960, gateSide: -5.25, gateY: 27, trick: 'kick' }; rigidAt(960, 'kickflip seal');
  for (const [s, len] of [[953.7, 7.4], [966.3, 7.4]] as const) add({ t: 'wall', p: [s, 24, -5.25], s: [len, 3.2, .5], tex: 'stone', color: '#9ca894', edgeGrinding: false, grp: 215, nm: 'Shrine threshold wall beside the seal' });
  add({ t: 'wall', p: [960, 24, -12.6], s: [20, 3.2, .5], tex: 'stone', color: '#9ca894', edgeGrinding: false, grp: 215, nm: 'Shrine back wall' });
  for (const s of [950, 970]) add({ t: 'wall', p: [s, 24, -9], s: [.5, 3.2, 7.2], tex: 'stone', color: '#9ca894', edgeGrinding: false, grp: 215, nm: 'Shrine side wall' });
  crate(955, -9.5, 24, 'life', 'Sealed shrine life', 'bay'); crate(965, -9.5, 24, 'mystery', 'Sealed shrine mystery', 'bay'); crate(960, -10.8, 24, 'wood', 'Sealed shrine offering', 'bay');
  torch(952, -11.5, 24, 'Shrine lamp'); torch(968, -11.5, 24, 'Shrine lamp');
  patrol(996, 2.6, 'sentry', 0, 1, false, 'ember sentry covers the climb approach: jump its slow orb, then spin the body');
  crate(1004, -2.25, 24, 'wood', 'Offering beyond the sentry');
  crate(1010, 1.25, 24, 'wood', 'Climb approach rhythm'); crate(1014, -1.25, 24, 'wood', 'Climb approach rhythm pair');

  // =========================================================================
  // COURT 3 · FLAME CLIMB (1035 → 1135, 24 → 36). The pilgrim bank again, now
  // with a sentinel on the right: the stair and the rail on the left are safe.
  // =========================================================================
  chapter('Flame climb', 1023, 1147, 'skate', 'the bank\'s right half burns; the stair and the left rail are the safe routes');
  slope(1047, 1123, 24, 36, 'Flame climb bank to the fourth storey');
  climb(1057, 1123, 6, 'Flame climb stair');
  rail(1057, 1113, groundHere(1057) + .8, groundHere(1113) + .8, -3.6, 'Flame climb gold grind on the safe side');
  flame(1090, 1, 3.9, 'climb flame on the right: the stair and the rail are the slow and fast safe routes');
  line(1051, 1119, groundHere(1051), groundHere(1119), 1.25);

  // =========================================================================
  // CH 7 · JADE RESERVOIR (1123 → 1240). The one bowl: exit offerings on both
  // carving lines, a cap above the exit lip met by drop-in air, a life above
  // the entry lip that needs a pumped return. Then nitro appears beside the lane.
  // =========================================================================
  chapter('Jade reservoir', 1123, 1240, 'skate', 'pump the bowl for its caps; look at the nitro, never touch it');
  slab(1123, 1158, 36, 'Fourth storey terrace'); paveRange(1123, 1158); gateway(1152, 'Jade Reservoir gateway');
  checkpoint(1150, 'Jade reservoir checkpoint');
  pipe(1158, 1198, 36, 7, 'Jade reservoir halfpipe');
  for (const side of [-1.3, 1.3]) crate(1201, side, 36, 'wood', 'Reservoir exit offerings on both carving lines');
  crate(1195.4, 0, 38.6, 'wood', 'Cap suspended above the exit lip: met by drop-in air', 'suspended');
  crate(1160.6, 0, 38.6, 'life', 'Life above the entry lip: a pumped return', 'suspended');
  slab(1198, 1395, 36, 'Reservoir exit terrace, the piston vault, the leap and the gauntlet approach'); paveRange(1198, 1240);
  crate(1212, 3.4, 36, 'nitro', 'Volatile offering: the first nitro glows beside the lane. Never touch it; the sanctuary\'s green switch counts it', 'nitro');
  crate(1215, 3.4, 36, 'nitro', 'Second volatile offering beside the lane', 'nitro');
  crate(1222, -1.25, 36, 'wood', 'Terrace rhythm'); crate(1226, -1.25, 36, 'wood', 'Terrace rhythm pair');

  // =========================================================================
  // CH 8 · PISTON VAULT (1240 → 1363). Three hammers fall in sequence down a
  // roofed vault. The board boost before it carries a rider through all three
  // in one window; on foot each hammer is its own timing. Then the mask, the
  // seven-metre leap with its gold rail, and the landing mysteries.
  // =========================================================================
  chapter('Piston vault', 1240, 1363, 'platform', 'boost through the hammers in one window, or time each; then the leap');
  gateway(1242, 'Piston Vault gateway');
  checkpoint(1238, 'Piston vault checkpoint');
  speedPad(1248, 'Ember bellows boost: carry speed through the whole vault');
  hall(1270, 26, 'Piston vault west'); hall(1298, 26, 'Piston vault east');
  // The three hammers breathe together: a rider who takes the boost as they
  // lift passes all three in one breath; on foot each hammer is its own beat.
  crusher(1266, 0, 'First piston'); crusher(1280, 0, 'Second piston'); crusher(1294, 0, 'Third piston');
  for (let s = 1258; s <= 1302; s += 4) add({ t: 'wumpa', p: [s, 37.1, 0], grp: 4, nm: 'Fruit line through the vault' });
  stack(1310, -2, 36, 'wood', 'wood', 'Offering after the vault'); stack(1310, 2, 36, 'wood', 'mystery', 'Offering after the vault, right');
  crate(1318, 0, 36, 'mask', 'Mask before the Ember Gauntlet');
  pit(1330, 1337, 36, 'Seven-metre sanctuary leap');
  rail(1325, 1342, 36.8, 36.8, 3.6, 'Leap gold grind');
  arc(1330, 1337, 36, -1.25, 1.8, 'Fruit over the leap');
  paveRange(1337, 1395);
  crate(1346, -1.25, 36, 'mystery', 'Landing mystery set behind the clear touchdown'); crate(1349, -1.25, 36, 'mystery', 'Second landing mystery');

  // =========================================================================
  // SPUR · EMBER GAUNTLET AND SANCTUARY (1363 → 1480, 36 → 46). Three
  // sentinels in a staggered wave up the last bank with offerings inside each
  // sweep; then the sanctuary: a bristleback at the door, the crystal, the
  // nitro gate, and the green switch that counts every volatile offering.
  // =========================================================================
  chapter('Ember Gauntlet and sanctuary', 1363, END, 'skate', 'weave the three-flame wave; the green switch counts every nitro');
  gateway(1390, 'Ember Gauntlet gateway');
  checkpoint(1392, 'Ember Gauntlet checkpoint');
  slope(1395, 1445, 36, 46, 'Ember Gauntlet bank');
  flame(1402, 1, 0, 'Ember Gauntlet first wave'); flame(1420, -1, 2.6, 'Ember Gauntlet second wave'); flame(1438, 1, 5.2, 'Ember Gauntlet third wave');
  for (const [s, side] of [[1402, 1.3], [1420, -1.3], [1438, 1.3]] as const) crate(s, side, groundHere(s), 'wood', 'Ember Gauntlet offering inside the sweep: take it while the sentinel cools', 'sweep');
  scorched.push([1397, 1445]);
  slab(1445, END, 46, 'Sanctuary of embers'); paveRange(1445, END); gateway(1448, 'Sanctuary gateway');
  patrol(1452, 0, 'spiker', 1.6, 1.35, false, 'bristleback at the sanctuary door: the stomp habit is punished, spin only');
  crate(1457, 0, 46, 'wood', 'Sanctuary procession offering'); crate(1460, 0, 46, 'wood', 'Sanctuary procession offering pair');
  add({ t: 'crystal', p: [1465, 46, 0], grp: 5, nm: 'Temple summit crystal' });
  for (const [s, side] of [[1470, -3.5], [1470, 3.5], [1473, -3.5]] as const) crate(s, side, 46, 'nitro', 'Volatile offering of the sanctuary gate: counted from the green switch', 'nitro');
  crate(1478, -2.3, 46, 'nitrobang', 'Green switch beyond the last nitro and the crystal: detonate every volatile offering for the complete count');
  add({ t: 'gate', p: [1484, 46, 0], yaw: 90, grp: 5, nm: 'Temple sanctuary finish' });
  add({ t: 'clock', p: [-16, 7, -2.5], grp: 5 });

  // ---- verification: the course refuses to build with a collision ---------
  const checks: string[] = [], problems: string[] = [];
  const check = (label: string, body: () => void) => { checks.push(label); body(); };
  const railYAt = (r: PlacedRail, s: number) => r.ya + (r.yb - r.ya) * (s - r.a) / (r.b - r.a || 1);
  check('rigid set pieces stay out of the bends', () => {
    for (const q of rigid) for (const [ks] of KNOTS.slice(1, -1)) if (Math.abs(q.s - ks) < FILLET) problems.push(`${q.nm} at ${q.s} lies in the bend at ${ks}`);
  });
  check('no rail or rope passes within a crate', () => {
    for (const r of rails) for (const c of crates) {
      if (c.s < r.a - .6 || c.s > r.b + .6 || Math.abs(c.side - r.side) >= 1.3) continue;
      const ry = railYAt(r, Math.max(r.a, Math.min(r.b, c.s)));
      if (c.y + CRATE > ry - 1.6 && c.y < ry + 2.6) problems.push(`${r.nm} passes through ${c.nm} at ${c.s}`);
    }
  });
  check('no rail starts or ends over a chasm or void', () => {
    for (const r of rails.filter(r => !setPieces.ropes.some(q => q.a === r.a))) for (const s of [r.a, r.b]) if (mainFloorAt(s, r.side) === undefined) problems.push(`${r.nm} ends over nothing at ${s}`);
  });
  check('crates stand inside a flame sweep only on purpose', () => {
    for (const f of flames) for (const c of crates) {
      const hot = Math.abs(c.s - f.s) <= FLAME_REACH && c.side * f.side >= -FLAME_SPILL;
      if (hot && !c.flags.has('sweep')) problems.push(`${c.nm} at ${c.s} stands inside ${f.nm}`);
      if (!hot && c.flags.has('sweep') && Math.abs(c.s - f.s) <= FLAME_REACH) problems.push(`${c.nm} is marked as a sweep offering but ${f.nm} cannot reach it`);
    }
    for (const f of flames) for (const t of torches) if (Math.abs(t.s - f.s) < 14) problems.push(`${t.nm} at ${t.s} stands in ${f.nm}'s dark`);
  });
  check('no crate inside a censer swing', () => {
    for (const q of pendulums) for (const c of crates) if (Math.abs(c.s - q.s) < 4.6 && Math.abs(c.side - q.side) < 1.9) problems.push(`${c.nm} at ${c.s} is clipped by ${q.nm}`);
  });
  check('no crate on a breaking, phasing, moving or boosting pad', () => {
    for (const q of pads) for (const c of crates) if (c.s > q.a - .6 && c.s < q.b + .6 && c.side > q.sideA - .6 && c.side < q.sideB + .6 && Math.abs(c.y - groundHereSafe(c.s)) < 3) problems.push(`${c.nm} at ${c.s} sits on ${q.nm}`);
  });
  check('no rail through a piston', () => {
    for (const q of pads.filter(p => p.kind === 'crusher')) for (const r of rails) if (r.a < q.b && r.b > q.a) problems.push(`${r.nm} runs through ${q.nm}`);
  });
  check('every crate stands on authored floor', () => {
    for (const c of crates) {
      if (c.flags.has('suspended') || c.flags.has('cap')) continue;
      const lower = voids.find(v => c.s >= v.a && c.s <= v.b);
      const floorY = c.flags.has('sunken') ? lower?.floorY : mainFloorAt(c.s, c.side);
      if (floorY === undefined || Math.abs(floorY - c.y) > .05) problems.push(`${c.nm} at ${c.s}/${c.side} floats (floor ${floorY}, crate ${c.y})`);
      if (!c.flags.has('sunken') && pits.some(p => c.s > p.a && c.s < p.b) && mainFloorAt(c.s, c.side) === undefined) problems.push(`${c.nm} hangs over a chasm`);
    }
  });
  check('no crate inside a patrol', () => {
    for (const q of patrols) for (const c of crates) {
      const inside = q.along ? Math.abs(c.s - q.s) < q.range + 1.4 && Math.abs(c.side - q.side) < 1.8 : Math.abs(c.s - q.s) < 1.4 && Math.abs(c.side - q.side) < q.range + 1.2;
      if (inside) problems.push(`${c.nm} at ${c.s} stands inside the ${q.foe} patrol at ${q.s}`);
    }
  });
  check('checkpoints respawn ten metres clear of every hazard', () => {
    for (const cp of checkpoints) {
      const near = (s: number) => Math.abs(s - cp.s) < 10;
      for (const f of flames) if (near(f.s)) problems.push(`${cp.nm} is ${Math.abs(f.s - cp.s)} m from ${f.nm}`);
      for (const q of patrols) if (Math.abs(q.s - cp.s) < 10 + (q.along ? q.range : 0)) problems.push(`${cp.nm} is next to the ${q.foe} at ${q.s}`);
      for (const c of crates) if ((c.kind === 'nitro' || c.kind === 'tnt') && near(c.s)) problems.push(`${cp.nm} is next to ${c.nm}`);
      for (const q of pendulums) if (near(q.s)) problems.push(`${cp.nm} is under ${q.nm}`);
      for (const q of pads) if (q.kind === 'crusher' && near((q.a + q.b) / 2)) problems.push(`${cp.nm} is under ${q.nm}`);
    }
  });
  check('volatile crates keep their blast away from other boxes', () => {
    for (const c of crates) {
      if (c.kind !== 'nitro' && c.kind !== 'tnt') continue;
      for (const o of crates) {
        if (o === c || (o.kind === 'nitro' && c.kind === 'nitro')) continue;
        if (c.kind === 'tnt' && o.flags.has('cap') && o.s === c.s) continue;
        if (Math.hypot(o.s - c.s, o.side - c.side) < 2.75 + .6) problems.push(`${o.nm} stands inside the blast of ${c.nm}`);
      }
    }
  });
  check('set-piece frames stay out of the eight-metre lane', () => {
    if (setPieces.shrine && Math.abs(setPieces.shrine.gateSide) - .3 < WIDTH / 2) problems.push('the kickflip seal intrudes into the lane');
    for (const f of flames) if (Math.abs(f.side) * 6.4 - 1.9 < WIDTH / 2) problems.push(`${f.nm} head intrudes into the lane`);
  });
  function groundHereSafe(s: number) { try { return groundHere(s); } catch { return -Infinity; } }
  if (problems.length) throw new Error(`Temple of Embers cannot be built:\n${problems.join('\n')}`);

  // ---- world --------------------------------------------------------------
  const profile: [number, number][] = [];
  for (const f of floors.filter(f => f.level === 'main').sort((x, y) => x.a - y.a)) {
    if (!profile.length || profile[profile.length - 1][0] < f.a - 1e-6 || profile[profile.length - 1][1] !== f.ya) profile.push([f.a, f.ya]);
    profile.push([f.b, f.yb]);
  }
  const layout: TempleLayout = {
    knots: KNOTS, courtyards: false,
    // Storey blocks [xA, xB, zNear, zFar, terrace]. Each storey is one block
    // deep enough to reach the previous gallery's cornice, so the temple reads
    // as a stepped pyramid; blocks stop short of the courts, the sunken rope
    // floor, the ash chasm, the reservoir bowl and the sanctuary leap.
    cores: [
      [-14, 14, -121, -50, 0], [20, 140, -149, -121, 0], [192, 220, -149, -121, 0],
      [20, 145, -249, -149, 12], [197, 220, -249, -149, 12],
      [20, 220, -349, -249, 24],
      [20, 34, -449, -349, 36], [49, 175, -449, -349, 36],
      [-14, 14, -554, -505, 46],
    ],
    art: { stairs: stairArt, bays, paved, gateways, halls, enclosure: { center: [113, -265], radius: 190, radii: [190, 335], count: 44 }, terminals: [-36, END + 14] },
  };
  const sourceComponents = components;
  const world = makeTempleWorld(sourceComponents, profile, layout);
  const toWorld = (s: number, y: number, side = 0): P => templePoint(s, y, side, layout);
  const frameAt = (s: number) => templeFrame(s, layout);
  const groundAt = (s: number) => templeSourceHeight(sourceComponents, profile, s);
  const toLocal = (p: readonly number[]): P => templeLocal(p, layout, sourceComponents, profile);
  const point = (s: number, side = 0, up = 0): P => toWorld(s, groundAt(s) + up, side);
  const out = (c: CustomComponent) => world.push(c);
  const sideCourtFree = (s: number, side: number) => parapetFree.some(q => q.side === side && s > q.a - 1e-6 && s < q.b + 1e-6);

  // The art's patchy bank barriers are replaced by the continuous parapets below.
  for (let i = world.length - 1; i >= 0; i--) if (world[i].nm === 'Planted bank boundary') world.splice(i, 1);
  // Shoulders: the eight-metre floor gets a real supported strip on each side,
  // with exactly the same chasms as the central route.
  const breaks = [...new Set([-24, END, ...floors.filter(f => f.level === 'main').flatMap(f => [f.a, f.b]), ...pits.flatMap(p => [p.a, p.b]), ...voids.flatMap(v => [v.a, v.b]), ...pipes.flatMap(p => [p.a, p.b])])].sort((a, b) => a - b);
  for (let k = 1; k < breaks.length; k++) {
    const a = breaks[k - 1], b = breaks[k], mid = (a + b) / 2;
    if (shoulderFree.some(q => mid > q.a && mid < q.b) || pits.some(q => mid > q.a && mid < q.b)) continue;
    for (let start = a; start < b; start += 16) for (const side of [-1, 1]) {
      const end = Math.min(b, start + 16), count = Math.ceil(end - start), vertices: number[] = [], indices: number[] = [];
      for (let i = 0; i <= count; i++) {
        const s = start + (end - start) * i / count, y = groundAt(s) + .035;
        for (const [u, h] of [[3.96, 0], [5.55, 0], [3.96, -.85], [5.55, -.85]]) vertices.push(...toWorld(s, y + h, side * u));
      }
      for (let i = 0; i < count; i++) { const n = i * 4; indices.push(...(side > 0 ? [n, n + 1, n + 5, n, n + 5, n + 4] : [n, n + 5, n + 1, n, n + 4, n + 5])); }
      const topTriangles = indices.length / 3;
      for (let i = 0; i < count; i++) { const n = i * 4; indices.push(n + 1, n + 3, n + 7, n + 1, n + 7, n + 5, n, n + 4, n + 6, n, n + 6, n + 2); }
      out({ t: 'mesh', p: [0, 0, 0], vertices, indices, doubleSided: true, solidSides: true, grindTopTriangles: topTriangles, depthBias: 2, tex: 'stone', color: '#aaa991', grp: 201, nm: 'Supported temple shoulder' });
    }
  }
  // Parapets: low carved walls whose collision rises above the coping, so
  // ordinary slips stay on the course. Side courts, stairs, chasms, the lift
  // well, the bowl and the pistons' footprints leave the line open.
  const boundary = (a: number, b: number, side: number, offset = 5.25, heightAt: (s: number) => number = groundAt) => {
    const origin = toWorld(a, heightAt(a) - .12, side * offset), pts: NonNullable<CustomComponent['pts']>[number][] = [], count = Math.ceil((b - a) / 1.5);
    for (let i = 0; i <= count; i++) { const s = a + (b - a) * i / count, p = toWorld(s, heightAt(s) - .12, side * offset); pts.push([p[0] - origin[0], p[2] - origin[2], 0, p[1] - origin[1]]); }
    out({ t: 'wallpath', p: origin, pts, w: .55, rise: 1.05, collisionHeight: 4.8, containment: true, tex: 'stone', color: '#9ca894', grp: 201, nm: 'Continuous carved temple parapet' });
  };
  const edgeBreaks = [...new Set([...breaks, ...parapetFree.flatMap(q => [q.a, q.b])])].sort((a, b) => a - b);
  for (let k = 1; k < edgeBreaks.length; k++) {
    const a = edgeBreaks[k - 1], b = edgeBreaks[k], mid = (a + b) / 2;
    if (b - a < .3 || pits.some(q => mid > q.a && mid < q.b) || voids.some(q => mid > q.a && mid < q.b) || pipes.some(q => mid > q.a && mid < q.b)) continue;
    for (const side of [-1, 1]) { if (sideCourtFree(mid, side)) continue; for (let s = a; s < b; s += 24) boundary(s, Math.min(b, s + 24), side); }
  }
  for (const c of climbs) {
    const { a, b, base, top, steps } = c, span = (b - a) / steps;
    for (let i = 0; i < steps; i++) boundary(a + i * span, a + (i + 1) * span, -1, 9.8, () => base + (top - base) * (i + 1) / steps);
  }
  for (const [a, b, sign] of bays) {
    const outer = sign > 0 ? 12.95 : 12.95; boundary(a, b, sign, outer);
    for (const s of [a, b]) { const p = point(s, sign * 5.25, -.12), q = point(s, sign * outer, -.12); out({ t: 'wallpath', p, pts: [[0, 0], [q[0] - p[0], q[2] - p[2]]], w: .55, rise: 1.05, collisionHeight: 4.8, containment: true, tex: 'stone', color: '#9ca894', grp: 201, nm: 'Side court end parapet' }); }
  }
  for (const s of [-24, END]) { const p = point(s, -5.25, -.12), q = point(s, 5.25, -.12); out({ t: 'wallpath', p, pts: [[0, 0], [q[0] - p[0], q[2] - p[2]]], w: .55, rise: 1.05, collisionHeight: 4.8, containment: true, tex: 'stone', color: '#9ca894', grp: 201, nm: 'Temple terminal parapet' }); }
  for (const c of world) if (c.t === 'mesh' && c.grp === 1 && c.solid !== false) c.solidSides = true;
  for (const c of world) if (c.nm?.startsWith('Playable temple storey')) { c.tex = 'stone'; c.color = '#b7ba9f'; }

  // Return portals keep their authored exit heading along the lane in world space.
  for (const c of world) if (c.t === 'returnportal') { const [s0] = toLocal(c.p), f = frameAt(s0); c.exitYaw = Math.atan2(f.fx, -f.fz) * 180 / Math.PI; }
  // The bonus door, in its protected side court beside the lift.
  out({ t: 'bonusplatform', p: toWorld(722, 12, 9), to: toWorld(726, 12.12, 1.25), grp: 205, nm: 'Ember Reliquary: the single temple bonus and safe return' });
  for (const s of [714, 730]) { out({ t: 'torch', p: toWorld(s, 12.55, 11.8), rise: 1.7, w: .9, grp: 207, nm: 'Reliquary court lantern' }); out({ t: 'decor', dkind: 'stonebase', p: toWorld(s, 12.04, 11.8), s: [1.6, .55, 1.6], solid: false, grp: 215, nm: 'Court corner planter base' }); }
  for (let s = 714; s <= 730; s += 2.7) for (const side of [6.2, 8.8, 11.4]) out({ t: 'decor', dkind: 'stonepaver', p: toWorld(s, 11.85, side), s: [2.55, .23, 2.55], yaw: 90 + frameAt(s).yaw, solid: false, grp: 215, nm: 'Reliquary court fitted paving' });
  // The shrine floor and the rope island read as built: piers and paving.
  for (const [s, side] of [[277, -3], [277, 3], [280, -3], [280, 3]] as const) out({ t: 'decor', dkind: 'stoneshaft', p: toWorld(s, -5, side), s: [.9, 4.6, .9], solid: false, grp: 215, nm: 'Rope island pier' });
  for (let s = 951.5; s < 970; s += 2.6) for (const side of [-7.2, -9.6, -12]) out({ t: 'decor', dkind: 'stonepaver', p: toWorld(s, 23.85, side), s: [2.4, .23, 2.4], yaw: 90 + frameAt(s).yaw, solid: false, grp: 215, nm: 'Shrine fitted paving' });

  // The censer hall is seen from the side: a travel zone over its stretch.
  if (setPieces.zone) {
    const { a, b } = setPieces.zone, pa = toWorld(a, 0), pb = toWorld(b, 0), f = frameAt((a + b) / 2);
    out({ t: 'zone', p: [(pa[0] + pb[0]) / 2, groundAt(a), (pa[2] + pb[2]) / 2], s: [Math.max(24, Math.abs(pb[0] - pa[0])), 1, Math.max(24, Math.abs(pb[2] - pa[2]))], dir: f.fx < 0 ? 'W' : 'E', grp: 6, nm: 'Censer hall side view' });
  }

  // Lamps: warm guidance every 26 m on alternating shoulders, never inside a
  // sentinel's dark, over a chasm, a void, the lift well or a piston.
  for (let s = -8, i = 0; s < END - 6; s += 26, i++) {
    if (lampFree.some(q => s > q.a && s < q.b) || flames.some(f => Math.abs(f.s - s) < 14) || pads.some(q => q.kind === 'crusher' && s > q.a - 2 && s < q.b + 2)) continue;
    const inPipe = pipes.find(p => s > p.a - 1 && s < p.b + 1), side = (i % 2 ? -1 : 1) * (inPipe ? 8.9 : 4.65), y = inPipe ? inPipe.lipY : groundAt(s);
    out({ t: 'torch', p: toWorld(s, y, side), rise: 1.7, w: 1.1, grp: 207, nm: 'Warm temple trail torch' });
  }
  // Sentinels: footing clear of the lane, a head collision core, the turning flame.
  for (const [i, f] of flames.entries()) {
    const fr = frameAt(f.s), p = point(f.s, f.side * 6.4), yaw = Math.atan2(f.side * fr.fz, -f.side * fr.fx) * 180 / Math.PI;
    out({ t: 'platform', p: [p[0], p[1] - .25, p[2]], s: [3.8, .5, 3.8], color: '#a1a68c', tex: 'stone', grp: 208, nm: 'Tiki brazier footing clear of the traversable lane' });
    out({ t: 'wall', p: [p[0], p[1], p[2]], s: [2.65, 2.9, 2.65], invisible: true, edgeGrinding: false, grp: 208, nm: 'Tiki head collision core outside the path' });
    out({ t: 'firetiki', p, yaw, range: 7.1, cycle: 7.8, phase: flamePhases[i], amp: 28, w: 1, grp: 208, nm: `Turning flame tiki ${i + 1}: ${f.nm}` });
  }
  for (const [a, b] of scorched) for (let s = a; s < b; s += 3.8) for (const side of [-2.35, 0, 2.35])
    out({ t: 'decor', dkind: 'stonepaver', p: point(s, side, -.12), s: [2.8, .23, 2.2], yaw: frameAt(s).yaw, amp: Math.atan2(groundAt(s + .2) - groundAt(s - .2), .4) * 180 / Math.PI, solid: false, color: ASH, grp: 215, nm: 'Scorched paving beneath the sentinels' });
  for (const [s, side] of [[766, -1.1], [766, 1.1]] as const) out({ t: 'decor', dkind: 'stonepaver', p: point(s + 5.5, -2.3 + side, -.14), s: [2.5, .2, 2.5], yaw: frameAt(s).yaw, solid: false, color: '#c7d3b6', grp: 215, nm: 'Pale safe-refuge paving' });

  // Treehouse canopy replaces the coarse jungle foliage, rooted clear of every road.
  const samples = Array.from({ length: Math.ceil(END + 25) }, (_, i) => { const s = i - 24; return { s, p: toWorld(s, groundAt(s)) }; });
  const treeRatios: Record<string, P> = { trialsv2treea: [26, 17.766, 25.911], trialsv2treeb: [26, 16.741, 17.709], trialsv2crowna: [26, 11.292, 23.015], trialsv2crownb: [26, 9.405, 26], trialsv2ferna: [3, 1.601, 2.798], trialsv2fernb: [3, 1.838, 2.957], trialsv2groundcovera: [5, 1.043, 2.581], trialsv2groundcoverb: [5, 1.826, 4.516] };
  let plantIndex = 0;
  for (let i = world.length - 1; i >= 0; i--) {
    const c = world[i]; if (c.t !== 'decor' || !c.dkind || !['junglecanopy', 'junglebackdrop', 'junglepalmtree', 'jungleleaf', 'junglefern'].includes(c.dkind)) continue;
    const index = plantIndex++, tree = ['junglecanopy', 'junglebackdrop', 'junglepalmtree'].includes(c.dkind);
    const kind = tree ? (index % 2 ? 'trialsv2treea' : 'trialsv2treeb') : c.dkind === 'junglefern' ? (index % 2 ? 'trialsv2ferna' : 'trialsv2fernb') : (index % 2 ? 'trialsv2groundcovera' : 'trialsv2groundcoverb');
    const ratio = treeRatios[kind], width = tree ? Math.min(24, c.s![0] * .85) : Math.min(6, c.s![0]);
    c.dkind = kind as CustomComponent['dkind']; c.s = ratio.map(n => n * width / ratio[0]) as P; c.color = '#ffffff'; c.solid = false; c.cameraCutaway = true;
    if (samples.some(q => q.p[1] + 4 > c.p[1] && q.p[1] < c.p[1] + c.s![1] && Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]) < (tree ? width * .36 : width * .44) + 4.6)) { world.splice(i, 1); continue; }
    c.nm = tree ? 'Treehouse ancient jungle tree, rooted outside every route' : 'Treehouse fern and groundcover planting';
  }
  for (let s = -12, i = 0; s < END; s += 34, i++) for (const side of [-1, 1]) {
    const p = point(s, side * 21, -5), width = 22 + (i % 3) * 2, kind = i % 2 ? 'trialsv2crowna' : 'trialsv2crownb';
    if (samples.some(q => q.p[1] + 5 > p[1] && q.p[1] < p[1] + 22 && Math.hypot(q.p[0] - p[0], q.p[2] - p[2]) < width * .5 + 7)) continue;
    out({ t: 'decor', dkind: i % 2 ? 'trialsv2treea' : 'trialsv2treeb', p, s: [width, width * .68, width * .85], yaw: (i * 137) % 360, solid: false, cameraCutaway: true, grp: 209, nm: 'Treehouse layered outer jungle tree' });
    out({ t: 'decor', dkind: kind, p: [p[0], p[1] + 12, p[2]], s: [width, width * .41, width * .93], yaw: i * 73 % 360, solid: false, cameraCutaway: true, grp: 209, nm: 'Separate Treehouse overlapping leaf crown' });
  }
  // Paired lamps mark every checkpoint, then checkpoints follow travel order.
  for (const cp of world.filter(c => c.t === 'checkpoint')) { const [s] = toLocal(cp.p); for (const side of [-1, 1]) out({ t: 'torch', p: point(s - 1.2, side * 4.75, .45), rise: 1.45, w: .85, grp: 207, nm: 'Paired checkpoint lamps: banked safety reads as warmth' }); }
  const orderedCheckpoints = world.filter(c => c.t === 'checkpoint').sort((x, y) => toLocal(x.p)[0] - toLocal(y.p)[0]);
  for (let i = world.length - 1; i >= 0; i--) if (world[i].t === 'checkpoint') world.splice(i, 1);
  world.push(...orderedCheckpoints);

  const countedCrates = crates.filter(c => !['bang', 'nitrobang', 'metal', 'metalbounce'].includes(c.kind)).length;
  const data: CustomLevelData = {
    v: 1, name: 'Temple of Embers', spawn: toWorld(-14, 7.12, 1.25), killY: -16, sky: 'night', jungleAtmosphere: true, keepPlayFog: true,
    jungleDepthFade: false, jungleStyle: 'painterly', cameraAirLift: .8, atmosphere: TEMPLE_NIGHT_ATMOSPHERE,
    relicTime: 220, medalTimes: { gold: 220, silver: 300, bronze: 420 }, groups, components: world,
  };
  return { id: 'jungle-terraces', data, sourceComponents, toWorld, toLocal, frameAt, groundAt, profile, pipes, gaps, rooms: [], climbs, voids, chapters, setPieces,
    tikiTrials: flames.map(f => ({ s: f.s, side: f.side })), peak: 46, end: END, countedCrates, checks };
}

export const TEMPLE_OF_EMBERS_ROUTE = buildTempleOfEmbers();
export const TEMPLE_OF_EMBERS_LEVEL = TEMPLE_OF_EMBERS_ROUTE.data;
