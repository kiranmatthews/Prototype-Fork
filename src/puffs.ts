// PS1-style procedural smoke and dust.
//
// One system for every soft effect in the game: plumes, steam, landing dust,
// wheel trails, impact clouds, ground-pound rings, coloured vapour, haze. They
// are all the same technique with different presets — there is no second path
// for "smoke" versus "dust".
//
// THE TECHNIQUE. Each puff is a tiny untextured Gouraud-shaded polygon:
//
//              P2────P3
//            ╱    ╲╱    ╲
//          P1──────C──────P4
//            ╲    ╱╲    ╱
//              P6────P5
//
// a dense bright centre C, an irregular ring of 5-8 outer vertices, and a
// triangle fan between them. The centre carries the strong colour, the rim
// carries a dark or transparent one, and the hardware's Gouraud interpolation
// does the soft gradient for free. That is how the PS1 drew smoke, and it is
// why the silhouette has to come from the GEOMETRY: there is no texture to
// hide behind, so the ring is randomised at spawn and then continuously
// deformed, or the thing reads as a spinning cardboard card.
//
// WHY IT IS BUILT THIS WAY. Two constraints drove the architecture:
//
//   * No per-particle Mesh. Every live puff of a given blend style is written
//     into ONE shared dynamic buffer each frame, so a thirty-puff explosion is
//     one draw call, and nothing is allocated or freed while the game runs.
//   * No per-frame randomness. Every puff's shape parameters are drawn ONCE at
//     spawn from its own seeded generator, and the deformation is then a pure
//     function of age. Re-randomising vertices per frame looks like static, not
//     like smoke — this is the single easiest way to get this effect wrong.
import * as THREE from 'three';

// ---------------------------------------------------------------- types ----

/** How a puff's colour reaches the framebuffer. */
export type BlendStyle =
  | 'alpha' // dust, opaque smoke — ordinary source-over
  | 'add' // glowing vapour, sparks of steam
  | 'softAdd' // Crash-style saturated colour: brightens but self-limits
  | 'darken'; // soot, black smoke — subtracts from what is behind

export type Orient =
  | 'billboard' // full camera-facing (the default)
  | 'billboardY' // upright: yaws to camera, never pitches. Plumes, steam
  | 'velocity' // long axis along travel — skid trails, jets
  | 'surface' // lies in the ground plane — impact rings, flat dust
  | 'fixed'; // world axes, no tracking

export type EmitterShape =
  | 'point'
  | 'sphere'
  | 'disc'
  | 'box'
  | 'line'
  | 'cone'
  | 'path'
  | 'surface';

export type EmitMode =
  | 'continuous'
  | 'burst' // one shot
  | 'repeat' // burst on an interval
  | 'distance' // spawn per metre travelled, not per frame
  | 'event' // driven entirely by gameplay calls
  | 'contact'; // driven by surface contact

export type SurfaceKind =
  | 'concrete'
  | 'sand'
  | 'dirt'
  | 'wood'
  | 'grass'
  | 'stone'
  | 'metal'
  | 'snow'
  | 'generic';

export type Quality = 'high' | 'medium' | 'low';

/** A pair of numbers is a range the spawn draws from; a single number is exact. */
export type Range = number | [number, number];

export interface PuffPreset {
  blend?: BlendStyle;
  orient?: Orient;

  // --- shape ---
  ring?: [number, number]; // outer vertex count range (clamped 5..8)
  multiCentre?: number; // 0..1 chance of 2-3 internal centres (lopsided puffs)
  halo?: number; // >0 adds a SECOND ring at this fraction of the radius — see below
  size?: Range; // starting radius
  aspect?: Range; // >1 wide, <1 tall
  grow?: Range; // radius multiplier reached at end of life
  growY?: Range; // separate vertical multiplier; defaults to grow
  growCurve?: number; // <1 front-loaded expansion (smoke), >1 late (rare)
  stretch?: number; // extra length along velocity, per unit speed

  // --- deformation ---
  wobble?: Range; // radial amplitude, as a fraction of radius
  swirl?: Range; // tangential amplitude, in radians
  wobbleRate?: Range; // primary frequency
  neighbour?: number; // 0..1 how much a vertex borrows its neighbours' radius
  centreDrift?: number; // how far the dense centre wanders off true centre
  spin?: Range; // angular velocity in the billboard plane

  // --- motion ---
  speed?: Range; // initial speed along `dir`
  spread?: number; // cone half-angle around `dir`, radians
  up?: Range; // extra initial vertical speed
  inherit?: number; // fraction of the emitter's own velocity carried in
  gravity?: Range; // negative rises
  buoyancy?: Range; // upward accel that FADES with age (hot gas cooling)
  drag?: Range; // per-second velocity damping
  wind?: number; // 0..1 response to the system wind
  turbulence?: Range; // amplitude of the two-sine wander
  turbRate?: Range;

  // --- ground ---
  ground?: boolean; // obey the contact plane at all
  flatten?: number; // 0..1 vertical squash when sitting on the ground
  spreadOnGround?: number; // extra horizontal growth once in contact
  friction?: number; // horizontal damping while in contact
  bounce?: number; // small rebound on first contact

  // --- appearance ---
  centre?: number; // hex; strongest colour, densest point
  inner?: number; // hex; the body of the puff
  outer?: number; // hex; rim — usually dark or simply invisible
  fadeTo?: number; // hex the whole puff drifts toward as it dies
  alpha?: Range; // peak opacity
  fadeIn?: number; // fraction of life spent ramping up
  outerAlpha?: number; // rim opacity as a fraction of the centre's
  haloAlpha?: number; // mid-ring opacity as a fraction of the centre's
  bright?: Range; // multiplies the colours (additive styles mostly)

  // --- lifetime / count ---
  life?: Range;
  count?: Range; // puffs per burst
  rate?: Range; // puffs per second for a continuous emitter
  jitter?: number; // 0..1 irregularity of continuous timing
  spacing?: Range; // metres between spawns for a distance emitter

  // --- composition ---
  children?: string[]; // other presets fired by the same event, same seed
  surfaceTint?: number; // 0..1 how much the surface colour overrides `centre`
}

interface SurfaceProfile {
  colour: number;
  size: number; // size multiplier
  life: number; // lifetime multiplier
  count: number; // burst count multiplier
  spread: number; // horizontal speed multiplier
  gravity: number; // gravity multiplier
  stick: number; // ground adhesion (friction multiplier)
  debris?: boolean; // does this surface throw hard bits as well as dust
}

// --------------------------------------------------------- surface table ----
// What a surface does to dust that is kicked off it. These are multipliers on
// whatever preset is playing, so one landing effect reads differently on sand
// and on metal without either needing its own asset.
const SURFACES: Record<SurfaceKind, SurfaceProfile> = {
  concrete: { colour: 0x9c9a94, size: 0.85, life: 0.8, count: 1.0, spread: 1.0, gravity: 1.0, stick: 1.0 },
  sand: { colour: 0xd8c79a, size: 1.35, life: 1.45, count: 1.3, spread: 1.25, gravity: 0.7, stick: 0.7 },
  dirt: { colour: 0x8a6a49, size: 1.1, life: 1.1, count: 1.15, spread: 1.05, gravity: 1.0, stick: 1.0, debris: true },
  wood: { colour: 0xb08b5c, size: 0.9, life: 0.9, count: 0.9, spread: 0.95, gravity: 1.1, stick: 1.1, debris: true },
  grass: { colour: 0x6f8f52, size: 0.7, life: 0.7, count: 0.5, spread: 0.8, gravity: 1.2, stick: 1.3 },
  stone: { colour: 0x8f8d8a, size: 0.95, life: 0.9, count: 1.0, spread: 1.0, gravity: 1.05, stick: 1.05 },
  metal: { colour: 0xa8adb5, size: 0.5, life: 0.5, count: 0.35, spread: 1.1, gravity: 1.2, stick: 1.2, debris: true },
  snow: { colour: 0xeef3f8, size: 1.25, life: 1.5, count: 1.2, spread: 1.1, gravity: 0.55, stick: 0.6 },
  generic: { colour: 0xb5ada0, size: 1.0, life: 1.0, count: 1.0, spread: 1.0, gravity: 1.0, stick: 1.0 },
};

// --------------------------------------------------------------- presets ----
// Everything the game asks for, expressed as parameter sets over the one
// technique. A new effect is a new entry here, not new code.
export const PUFF_PRESETS: Record<string, PuffPreset> = {
  // ── THE HOUSE STYLE ────────────────────────────────────────────────────
  // Every preset here is written in the language of the one that was tuned
  // BY HAND (torchSmoke, below), because every pass I authored by guesswork
  // came out overwrought. What the hand-tuned one does, everything does:
  //
  //   * ONE ring, NO lobes, NO centre drift, heavy neighbour smoothing,
  //     SLOW wobble — a plain rounded lump, not a jagged shard.
  //   * Sized against the thing that MADE it: a footstep, a wheel, a crate.
  //     Crash 2/3 dust is a handful of small pale pops gone in half a
  //     second; nothing here should be mistakable for weather.
  //   * A wide lifetime band where raggedness is wanted — some puffs die at
  //     the source, some carry — instead of extra geometry.
  //
  // The halo/plateau ring still exists as a capability (the studio exposes
  // it) but no stock preset uses it: the hand-tuned reference didn't.

  // --- smoke -------------------------------------------------------------
  smokeLight: {
    blend: 'alpha', orient: 'billboardY',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.12, 0.3], aspect: [0.7, 0.9],
    grow: [1.8, 2.5], growY: [2.4, 3.4], growCurve: 0.42,
    wobble: [0.18, 0.3], swirl: [0.06, 0.15], wobbleRate: [0.2, 0.4],
    neighbour: 0.95, centreDrift: 0, spin: [-0.6, 0.6],
    speed: [0, 0.2], spread: 0.3, up: [0.7, 1.3], gravity: [-0.12, -0.04],
    buoyancy: [0.6, 1.6], drag: [0.7, 1.4], wind: 0.9,
    turbulence: [0.3, 0.5], turbRate: [0.7, 1.1],
    life: [1.2, 2.6],
    centre: 0xb9b4ab, inner: 0x8c8880, outer: 0x2a2926,
    alpha: [0.28, 0.4], fadeIn: 0.18, outerAlpha: 0,
    count: [1, 2], rate: [4, 7], jitter: 0.6,
  },
  smokeDark: {
    blend: 'alpha', orient: 'billboardY',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.16, 0.36], aspect: [0.7, 0.9],
    grow: [1.9, 2.6], growY: [2.6, 3.6], growCurve: 0.42,
    wobble: [0.18, 0.3], swirl: [0.06, 0.15], wobbleRate: [0.2, 0.4],
    neighbour: 0.95, centreDrift: 0, spin: [-0.5, 0.5],
    speed: [0, 0.25], spread: 0.3, up: [0.8, 1.5], gravity: [-0.15, -0.05],
    buoyancy: [0.8, 1.9], drag: [0.7, 1.3], wind: 0.9,
    turbulence: [0.3, 0.55], turbRate: [0.6, 1.0],
    life: [1.6, 3.0],
    centre: 0x35322e, inner: 0x201e1b, outer: 0x0c0b0a,
    alpha: [0.45, 0.6], fadeIn: 0.15, outerAlpha: 0,
    count: [1, 2], rate: [5, 8], jitter: 0.55,
  },
  // The Crash 3 vortex colour, at prop scale rather than boss-intro scale.
  smokeColour: {
    blend: 'softAdd', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.15, 0.35], aspect: [0.8, 1.0],
    grow: [1.8, 2.5], growY: [2.0, 2.8], growCurve: 0.45,
    wobble: [0.2, 0.32], swirl: [0.08, 0.18], wobbleRate: [0.25, 0.45],
    neighbour: 0.9, centreDrift: 0, spin: [-1.0, 1.0],
    speed: [0.1, 0.4], spread: 0.5, up: [0.6, 1.2], gravity: [-0.2, -0.08],
    buoyancy: [0.7, 1.6], drag: [0.8, 1.5], wind: 0.7,
    turbulence: [0.3, 0.55], turbRate: [0.7, 1.2],
    life: [0.9, 1.8],
    centre: 0xd85fd8, inner: 0x7d3c8c, outer: 0x2a1c46,
    alpha: [0.4, 0.55], fadeIn: 0.12, outerAlpha: 0, bright: [1.0, 1.3],
    count: [1, 2], rate: [8, 13], jitter: 0.6,
  },
  steam: {
    blend: 'alpha', orient: 'billboardY',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.1, 0.2], aspect: [0.75, 0.95],
    grow: [2.2, 3.0], growY: [2.6, 3.6], growCurve: 0.4,
    wobble: [0.16, 0.26], swirl: [0.05, 0.13], wobbleRate: [0.3, 0.55],
    neighbour: 0.95, centreDrift: 0, spin: [-0.7, 0.7],
    speed: [0.2, 0.5], spread: 0.2, up: [1.2, 2.2], gravity: [-0.3, -0.12],
    buoyancy: [1.2, 2.4], drag: [1.3, 2.1], wind: 0.9,
    turbulence: [0.2, 0.4], turbRate: [0.9, 1.4],
    life: [0.6, 1.2],
    centre: 0xf2f6fa, inner: 0xc2cfd9, outer: 0x3a444e,
    alpha: [0.3, 0.42], fadeIn: 0.1, outerAlpha: 0,
    count: [1, 2], rate: [10, 16], jitter: 0.45,
  },
  vapourMagic: {
    blend: 'add', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.1, 0.2], aspect: [0.85, 1.05],
    grow: [1.6, 2.2], growY: [1.8, 2.4], growCurve: 0.5,
    wobble: [0.22, 0.34], swirl: [0.1, 0.2], wobbleRate: [0.35, 0.6],
    neighbour: 0.85, centreDrift: 0, spin: [-1.2, 1.2],
    speed: [0.2, 0.6], spread: 0.8, up: [0.4, 0.9], gravity: [-0.25, -0.1],
    buoyancy: [0.6, 1.3], drag: [0.9, 1.6], wind: 0.5,
    turbulence: [0.35, 0.6], turbRate: [0.9, 1.5],
    life: [0.7, 1.3],
    centre: 0x9cffe8, inner: 0x2ac0a8, outer: 0x062a24,
    alpha: [0.4, 0.55], fadeIn: 0.1, outerAlpha: 0, bright: [1.0, 1.5],
    count: [1, 2], rate: [8, 14], jitter: 0.7,
  },
  // Ambient haze earns its size — it IS a room-scale effect — but at an
  // opacity where it reads as air, not as an object.
  hazeRoom: {
    blend: 'alpha', orient: 'billboard',
    ring: [6, 8], multiCentre: 0, halo: 0,
    size: [0.9, 1.6], aspect: [1.2, 1.6],
    grow: [1.3, 1.7], growCurve: 0.8,
    wobble: [0.1, 0.16], swirl: [0.04, 0.1], wobbleRate: [0.15, 0.3],
    neighbour: 0.95, centreDrift: 0, spin: [-0.1, 0.1],
    speed: [0.05, 0.15], spread: 1.4, up: [0, 0.1], gravity: [-0.02, 0.02],
    buoyancy: [0.05, 0.2], drag: [0.3, 0.5], wind: 1,
    turbulence: [0.08, 0.18], turbRate: [0.15, 0.3],
    life: [4, 7],
    centre: 0x8e93a2, inner: 0x60657a, outer: 0x1a1c26,
    alpha: [0.05, 0.1], fadeIn: 0.3, outerAlpha: 0,
    count: [1, 1], rate: [1, 2], jitter: 0.8,
  },

  // --- dust ----------------------------------------------------------------
  // Crash dust: small, pale, earthy, quick. It pops, spreads a hand's width,
  // and is gone. Alpha blend — dust is MATTER in front of the world, and only
  // fire and magic get to be light.
  dustStep: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.07, 0.13], aspect: [0.9, 1.1],
    grow: [1.6, 2.2], growY: [1.4, 1.9], growCurve: 0.35,
    wobble: [0.15, 0.25], swirl: [0.05, 0.12], wobbleRate: [0.3, 0.6],
    neighbour: 0.9, centreDrift: 0, spin: [-0.8, 0.8],
    speed: [0.4, 0.9], spread: 1.2, up: [0.15, 0.4], gravity: [1.2, 2.0],
    drag: [3.5, 5.0], wind: 0.3, turbulence: [0.08, 0.18], turbRate: [0.8, 1.4],
    ground: true, flatten: 0.5, spreadOnGround: 0.3, friction: 4,
    life: [0.25, 0.45],
    centre: 0xe8dcc4, inner: 0xc9bda6, outer: 0x4a4238,
    alpha: [0.3, 0.42], fadeIn: 0.06, outerAlpha: 0,
    count: [1, 2], surfaceTint: 0.8, spacing: [0.8, 1.2],
  },
  dustWheel: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.09, 0.16], aspect: [0.9, 1.15],
    grow: [1.8, 2.4], growY: [1.5, 2.0], growCurve: 0.4, stretch: 0.02,
    wobble: [0.16, 0.26], swirl: [0.05, 0.13], wobbleRate: [0.3, 0.6],
    neighbour: 0.9, centreDrift: 0, spin: [-0.6, 0.6],
    speed: [0.3, 0.7], spread: 1.0, up: [0.2, 0.5], gravity: [0.9, 1.6],
    inherit: 0.15, drag: [3.0, 4.5], wind: 0.3,
    turbulence: [0.08, 0.18], turbRate: [0.8, 1.4],
    ground: true, flatten: 0.5, spreadOnGround: 0.3, friction: 4,
    life: [0.3, 0.55],
    centre: 0xe4d8c0, inner: 0xbfb39c, outer: 0x453e34,
    alpha: [0.26, 0.38], fadeIn: 0.08, outerAlpha: 0,
    count: [1, 1], surfaceTint: 0.85, spacing: [0.6, 0.95],
  },
  dustSkid: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.13, 0.22], aspect: [1.0, 1.25],
    grow: [1.9, 2.6], growY: [1.5, 2.0], growCurve: 0.38, stretch: 0.03,
    wobble: [0.18, 0.28], swirl: [0.06, 0.14], wobbleRate: [0.3, 0.6],
    neighbour: 0.9, centreDrift: 0, spin: [-0.5, 0.5],
    speed: [0.5, 1.1], spread: 1.1, up: [0.25, 0.6], gravity: [0.8, 1.5],
    inherit: 0.25, drag: [2.8, 4.2], wind: 0.4,
    turbulence: [0.1, 0.22], turbRate: [0.7, 1.2],
    ground: true, flatten: 0.5, spreadOnGround: 0.4, friction: 3.8,
    life: [0.4, 0.7],
    centre: 0xe0d4bc, inner: 0xb8ac95, outer: 0x423b31,
    alpha: [0.34, 0.48], fadeIn: 0.06, outerAlpha: 0,
    count: [1, 2], surfaceTint: 0.85, spacing: [0.4, 0.65],
  },
  dustLand: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.12, 0.22], aspect: [1.0, 1.25],
    grow: [1.9, 2.6], growY: [1.5, 2.0], growCurve: 0.35,
    wobble: [0.18, 0.28], swirl: [0.06, 0.14], wobbleRate: [0.35, 0.65],
    neighbour: 0.9, centreDrift: 0, spin: [-0.8, 0.8],
    speed: [1.2, 2.4], spread: 1.45, up: [0.25, 0.6], gravity: [1.4, 2.2],
    drag: [3.2, 4.6], wind: 0.3, turbulence: [0.08, 0.2], turbRate: [0.9, 1.5],
    ground: true, flatten: 0.6, spreadOnGround: 0.4, friction: 4.2,
    life: [0.35, 0.6],
    centre: 0xe2d6be, inner: 0xb8ae97, outer: 0x453e34,
    alpha: [0.35, 0.5], fadeIn: 0.05, outerAlpha: 0,
    count: [4, 6], surfaceTint: 0.85,
  },
  dustLandHeavy: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.18, 0.32], aspect: [1.05, 1.3],
    grow: [2.2, 3.0], growY: [1.6, 2.1], growCurve: 0.32,
    wobble: [0.2, 0.3], swirl: [0.07, 0.15], wobbleRate: [0.3, 0.6],
    neighbour: 0.9, centreDrift: 0, spin: [-0.7, 0.7],
    speed: [2.0, 3.6], spread: 1.5, up: [0.4, 0.9], gravity: [1.2, 2.0],
    drag: [3.0, 4.4], wind: 0.35, turbulence: [0.1, 0.24], turbRate: [0.8, 1.4],
    ground: true, flatten: 0.65, spreadOnGround: 0.5, friction: 4,
    life: [0.5, 0.85],
    centre: 0xe2d6be, inner: 0xb5ab94, outer: 0x453e34,
    alpha: [0.4, 0.55], fadeIn: 0.04, outerAlpha: 0,
    count: [7, 10], surfaceTint: 0.85,
    children: ['dustRing', 'dustRise'],
  },
  dustRing: {
    blend: 'alpha', orient: 'surface',
    ring: [6, 8], multiCentre: 0, halo: 0,
    size: [0.3, 0.45], aspect: [1.0, 1.0],
    grow: [2.6, 3.4], growCurve: 0.25,
    wobble: [0.14, 0.24], swirl: [0.05, 0.12], wobbleRate: [0.4, 0.7],
    neighbour: 0.95, centreDrift: 0, spin: [-0.3, 0.3],
    speed: [0.15, 0.4], spread: 3.14, up: [0, 0], gravity: [0, 0.1],
    drag: [3.5, 5.0], wind: 0.2, turbulence: [0.04, 0.1], turbRate: [0.6, 1.0],
    ground: true, flatten: 1, friction: 5,
    life: [0.35, 0.55],
    centre: 0xd9cdb4, inner: 0xa89d87, outer: 0x3b352c,
    alpha: [0.28, 0.4], fadeIn: 0.04, outerAlpha: 0,
    count: [1, 1], surfaceTint: 0.9,
  },
  dustRise: {
    blend: 'alpha', orient: 'billboardY',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.12, 0.2], aspect: [0.85, 1.05],
    grow: [1.7, 2.3], growY: [2.0, 2.7], growCurve: 0.45,
    wobble: [0.16, 0.26], swirl: [0.06, 0.13], wobbleRate: [0.3, 0.55],
    neighbour: 0.9, centreDrift: 0, spin: [-0.5, 0.5],
    speed: [0.2, 0.6], spread: 0.9, up: [0.6, 1.2], gravity: [0.1, 0.4],
    buoyancy: [0.3, 0.7], drag: [1.6, 2.6], wind: 0.6,
    turbulence: [0.15, 0.3], turbRate: [0.6, 1.1],
    life: [0.5, 0.9],
    centre: 0xd6cab2, inner: 0xa59b85, outer: 0x3b352c,
    alpha: [0.2, 0.3], fadeIn: 0.12, outerAlpha: 0,
    count: [2, 3], surfaceTint: 0.8,
  },

  // GRIND SPARKS. The one preset that is allowed to be fast and sharp,
  // because a spark IS fast and sharp: a tiny additive dart, stretched along
  // its own velocity, that leaves the truck hot, arcs under heavy gravity and
  // SHRINKS as it cools — grow below 1 — dying white-yellow through orange
  // into ember red in under half a second. Laid down by DISTANCE along the
  // rail like the other trails, so a fast grind throws a denser shower and a
  // crawl barely spits.
  spark: {
    blend: 'add', orient: 'velocity',
    ring: [5, 5], multiCentre: 0, halo: 0,
    size: [0.05, 0.07], aspect: [0.9, 1.1],
    grow: [0.5, 0.8], growCurve: 0.6, stretch: 0.12,
    wobble: [0.06, 0.12], swirl: [0.03, 0.08], wobbleRate: [0.5, 1.0],
    neighbour: 1, centreDrift: 0.18, spin: [0, 1.4],
    speed: [3.8, 4.2], spread: 0, up: [0.3, 1.95], inherit: 0.24,
    gravity: [7, 11], drag: [0.4, 1.0], wind: 0,
    turbulence: [0.38, 0.7], turbRate: [0.1, 0.3],
    life: [0.2, 0.5],
    centre: 0xffeb94, inner: 0xffdd00, outer: 0x31380a, fadeTo: 0x084c8c,
    alpha: [0.85, 1], fadeIn: 0, outerAlpha: 0, bright: [1.7, 2.2],
    count: [17, 20], rate: [35.5, 40], jitter: 0.15, spacing: [0.1, 0.6],
  },

  // --- events --------------------------------------------------------------
  crateSmash: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.12, 0.22], aspect: [1.0, 1.25],
    grow: [2.0, 2.8], growCurve: 0.3,
    wobble: [0.2, 0.3], swirl: [0.08, 0.16], wobbleRate: [0.4, 0.7],
    neighbour: 0.9, centreDrift: 0, spin: [-1.2, 1.2],
    speed: [1.8, 3.4], spread: 3.14, up: [0.4, 1.0], gravity: [1.8, 2.8],
    drag: [3.0, 4.4], wind: 0.3, turbulence: [0.1, 0.24], turbRate: [0.9, 1.5],
    ground: true, flatten: 0.55, spreadOnGround: 0.4, friction: 4,
    life: [0.35, 0.6],
    centre: 0xd9b98a, inner: 0xa98a62, outer: 0x3a2f22,
    alpha: [0.38, 0.52], fadeIn: 0.04, outerAlpha: 0,
    count: [6, 9], surfaceTint: 0.4,
    children: ['dustRing', 'hazeLinger'],
  },
  hazeLinger: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.35, 0.6], aspect: [1.1, 1.4],
    grow: [1.5, 2.0], growCurve: 0.7,
    wobble: [0.1, 0.18], swirl: [0.05, 0.11], wobbleRate: [0.25, 0.45],
    neighbour: 0.95, centreDrift: 0, spin: [-0.15, 0.15],
    speed: [0.1, 0.3], spread: 1.6, up: [0.1, 0.3], gravity: [0.05, 0.25],
    buoyancy: [0.15, 0.4], drag: [1.0, 1.7], wind: 0.9,
    turbulence: [0.08, 0.18], turbRate: [0.25, 0.5],
    life: [0.9, 1.5],
    centre: 0xa89e8c, inner: 0x746c5f, outer: 0x2a271f,
    alpha: [0.1, 0.16], fadeIn: 0.25, outerAlpha: 0,
    count: [1, 2], surfaceTint: 0.6,
  },
  groundPound: {
    blend: 'alpha', orient: 'surface',
    ring: [6, 8], multiCentre: 0, halo: 0,
    size: [0.45, 0.65], aspect: [1.0, 1.0],
    grow: [3.2, 4.2], growCurve: 0.2,
    wobble: [0.12, 0.22], swirl: [0.05, 0.11], wobbleRate: [0.5, 0.8],
    neighbour: 0.95, centreDrift: 0, spin: [-0.25, 0.25],
    speed: [0.2, 0.5], spread: 3.14, up: [0, 0], gravity: [0, 0.1],
    drag: [3.8, 5.2], wind: 0.15, turbulence: [0.03, 0.08], turbRate: [0.6, 1.0],
    ground: true, flatten: 1, friction: 5.5,
    life: [0.4, 0.65],
    centre: 0xe4d9c0, inner: 0xafa48c, outer: 0x3b352c,
    alpha: [0.32, 0.44], fadeIn: 0.03, outerAlpha: 0,
    count: [2, 3], surfaceTint: 0.9,
    children: ['dustLandHeavy'],
  },

  // EXPLOSIONS. One fireball recipe at two temperatures: a bright additive
  // core thrown outward in every direction that cools along the ramp as it
  // dies, with a slower alpha smoke child that hangs and rises after the
  // flash is gone. TNT burns white-yellow through orange into ember red;
  // nitro is the same bang gone radioactive — acid green down to a sickly
  // bottle-glass glow.
  boomTnt: {
    blend: 'add', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0, haloAlpha: 1,
    size: [0.89, 1.26], aspect: [0.95, 1.2],
    grow: [2.4, 3.2], growCurve: 0.25,
    wobble: [0.2, 0.3], swirl: [0.07, 0.28], wobbleRate: [0.4, 0.7],
    neighbour: 0.9, centreDrift: 0.15, spin: [-1.4, 1.4],
    speed: [4.2, 5.5], spread: 3.14, up: [0.4, 1.2], gravity: [0.2, 0.8],
    drag: [3.2, 4.6], wind: 0.2, turbulence: [0.12, 0.26], turbRate: [0.8, 1.3],
    ground: false,
    life: [0.3, 0.55],
    centre: 0xff4000, inner: 0xff4d00, outer: 0xff2a00, fadeTo: 0xff7b00,
    alpha: [1, 1], fadeIn: 0, outerAlpha: 0, bright: [2.2, 2.5],
    count: [15, 20], jitter: 0.1,
    children: ['boomSmoke'],
  },
  // The nitro bang tracks the authored TNT shape exactly — same scale, throw,
  // count and heat — and differs only in the colour ramp, so the two read as
  // one explosion at two chemistries rather than two unrelated effects.
  boomNitro: {
    blend: 'add', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0, haloAlpha: 1,
    size: [0.89, 1.26], aspect: [0.95, 1.2],
    grow: [2.4, 3.2], growCurve: 0.25,
    wobble: [0.2, 0.3], swirl: [0.07, 0.28], wobbleRate: [0.4, 0.7],
    neighbour: 0.9, centreDrift: 0.15, spin: [-1.4, 1.4],
    speed: [4.2, 5.5], spread: 3.14, up: [0.4, 1.2], gravity: [0.2, 0.8],
    drag: [3.2, 4.6], wind: 0.2, turbulence: [0.12, 0.26], turbRate: [0.8, 1.3],
    ground: false,
    life: [0.3, 0.55],
    centre: 0x66ff00, inner: 0x8bff1a, outer: 0x3ce000, fadeTo: 0xb6ff2e,
    alpha: [1, 1], fadeIn: 0, outerAlpha: 0, bright: [2.2, 2.5],
    count: [15, 20], jitter: 0.1,
    children: ['boomSmokeNitro'],
  },
  boomSmoke: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.3, 0.5], aspect: [1.0, 1.3],
    grow: [1.8, 2.4], growY: [2.2, 2.9], growCurve: 0.55,
    wobble: [0.16, 0.26], swirl: [0.06, 0.13], wobbleRate: [0.25, 0.45],
    neighbour: 0.95, centreDrift: 0, spin: [-0.4, 0.4],
    speed: [0.5, 1.2], spread: 2.4, up: [0.5, 1.1], gravity: [0.1, 0.4],
    buoyancy: [0.4, 0.9], drag: [1.4, 2.2], wind: 0.6,
    turbulence: [0.14, 0.28], turbRate: [0.4, 0.7],
    life: [0.7, 1.3],
    centre: 0x6e6258, inner: 0x4a4139, outer: 0x1c1814,
    alpha: [0.24, 0.34], fadeIn: 0.14, outerAlpha: 0,
    count: [4, 6], surfaceTint: 0,
  },
  boomSmokeNitro: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0,
    size: [0.3, 0.5], aspect: [1.0, 1.3],
    grow: [1.8, 2.4], growY: [2.2, 2.9], growCurve: 0.55,
    wobble: [0.16, 0.26], swirl: [0.06, 0.13], wobbleRate: [0.25, 0.45],
    neighbour: 0.95, centreDrift: 0, spin: [-0.4, 0.4],
    speed: [0.5, 1.2], spread: 2.4, up: [0.5, 1.1], gravity: [0.1, 0.4],
    buoyancy: [0.4, 0.9], drag: [1.4, 2.2], wind: 0.6,
    turbulence: [0.14, 0.28], turbRate: [0.4, 0.7],
    life: [0.7, 1.3],
    centre: 0x527a4a, inner: 0x35533a, outer: 0x121c14,
    alpha: [0.24, 0.34], fadeIn: 0.14, outerAlpha: 0,
    count: [4, 6], surfaceTint: 0,
  },

  // A squashed enemy pops in a small cartoon poof — pale, quick, thrown
  // every way at once and gone in half a second, so the bounce reads and the
  // body's disappearance has a where.
  enemyPoof: {
    blend: 'alpha', orient: 'billboard',
    ring: [5, 7], multiCentre: 0, halo: 0,
    size: [0.1, 0.18], aspect: [0.95, 1.2],
    grow: [2.0, 2.8], growCurve: 0.3,
    wobble: [0.18, 0.28], swirl: [0.06, 0.14], wobbleRate: [0.4, 0.7],
    neighbour: 0.9, centreDrift: 0, spin: [-1.0, 1.0],
    speed: [1.4, 2.6], spread: 3.14, up: [0.5, 1.1], gravity: [1.6, 2.6],
    drag: [3.2, 4.6], wind: 0.2, turbulence: [0.08, 0.18], turbRate: [0.8, 1.3],
    life: [0.3, 0.5],
    centre: 0xf4eee2, inner: 0xd8cfbe, outer: 0x5a5348,
    alpha: [0.4, 0.55], fadeIn: 0.03, outerAlpha: 0,
    count: [5, 7], surfaceTint: 0,
  },

  torchSmoke: {
    blend: 'add', orient: 'billboard',
    ring: [5, 8], multiCentre: 0, halo: 0, haloAlpha: 1,
    // size is the authored [0.14, 0.45] times 1.25: the old strength coupling
    // silently drew 1.25x, so this keeps the approved look pixel-identical
    // under the corrected one.
    size: [0.18, 0.56], aspect: [0.6, 0.75],
    grow: [1.65, 2.35], growY: [2.8, 3.8], growCurve: 0.42, stretch: 0.255,
    wobble: [0.2, 0.32], swirl: [0.06, 0.17], wobbleRate: [0.2, 0.35],
    neighbour: 1, centreDrift: 0, spin: [-1.45, 0.3],
    speed: [0, 0.2], spread: 0, up: [1.4, 2.3], inherit: 0,
    gravity: [-0.15, -0.05], buoyancy: [0.75, 3], drag: [0.7, 1.7], wind: 1,
    turbulence: [0.42, 0.65], turbRate: [0.95, 1.25],
    spreadOnGround: 0, friction: 0, bounce: 0, surfaceTint: 0,
    life: [0.35, 3.45],
    centre: 0xff5e1a, inner: 0xa8481f, outer: 0x1e1835, fadeTo: 0x474356,
    alpha: [0.47, 0.57], fadeIn: 0.22, outerAlpha: 0, bright: [0.9, 1.6],
    count: [3, 19], rate: [13.5, 24.5], jitter: 0.3, spacing: [0.1, 0.1],
  },

};

// -------------------------------------------------------------- plumbing ----

const RING_MIN = 5;
const RING_MAX = 8;
const CENTRE_MAX = 3;
// A haloed puff carries a SECOND ring, so the worst case is centres + two
// rings. Plain puffs (dust, debris) never allocate the extra band — they still
// draw 5-11 triangles; only the glow presets pay for it.
const VERTS_MAX = RING_MAX * 2 + CENTRE_MAX; // 19
const TRIS_MAX = RING_MAX + CENTRE_MAX + RING_MAX * 2; // fan + bridges + band
const IDX_MAX = TRIS_MAX * 3; // 81
const MAX_LIVE = 320; // hard ceiling across every style at once
/** Ambient/scenery puffs stop spawning past this much of the pool. */
const AMBIENT_CAP = 0.6;

/** Deterministic per-puff generator. Same seed, same puff, always. */
function makeRng(seed: number): () => number {
  // xorshift32. Cheap, no allocation after this closure, and good enough for
  // shape noise — this is not cryptography, it just must not repeat visibly.
  let s = seed | 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const rr = (rng: () => number, v: Range | undefined, dflt: number): number => {
  if (v === undefined) return dflt;
  if (typeof v === 'number') return v;
  return v[0] + rng() * (v[1] - v[0]);
};

/** sRGB hex -> the renderer's linear working space, done once at preset load. */
const COL_CACHE = new Map<number, THREE.Color>();
function lin(hex: number): THREE.Color {
  let c = COL_CACHE.get(hex);
  if (!c) {
    c = new THREE.Color(hex);
    COL_CACHE.set(hex, c);
  }
  return c;
}

interface Puff {
  live: boolean;
  age: number;
  life: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  seed: number;

  blend: BlendStyle;
  orient: Orient;

  // shape
  n: number; // ring count
  k: number; // centre count
  baseAng: Float32Array; // n
  baseRad: Float32Array; // n
  ampA: Float32Array; // n radial amplitude
  ampB: Float32Array; // n secondary radial amplitude
  frqA: Float32Array; // n
  frqB: Float32Array; // n
  phA: Float32Array; // n
  phB: Float32Array; // n
  tanAmp: Float32Array; // n tangential amplitude
  tanFrq: Float32Array; // n
  tanPh: Float32Array; // n
  cenAng: Float32Array; // k centre polar angle
  cenRad: Float32Array; // k centre polar radius (as a fraction of size)
  cenFrq: Float32Array; // k drift rate
  cenPh: Float32Array; // k
  centreDriftAmt: number; // how far a centre may wander from its base spot
  halo: number; // 0 = single ring; else the mid ring's radius fraction
  neighbour: number;
  size: number;
  aspect: number;
  grow: number;
  growY: number;
  growCurve: number;
  stretch: number;
  rot: number;
  spin: number;

  // motion
  gravity: number;
  buoy: number;
  drag: number;
  wind: number;
  turbAmp: number;
  turbFrq: number;
  turbDir: THREE.Vector3;
  turbDir2: THREE.Vector3;
  turbPh: number;
  turbPh2: number;

  // ground
  ground: boolean;
  groundY: number;
  flatten: number;
  spreadOnGround: number;
  friction: number;
  bounce: number;
  contact: boolean;

  // appearance
  cCentre: THREE.Color;
  cInner: THREE.Color;
  cOuter: THREE.Color;
  cFade: THREE.Color | null;
  alpha: number;
  fadeIn: number;
  outerAlpha: number;
  haloAlpha: number;
  bright: number;
}

function blankPuff(): Puff {
  const f = (n: number) => new Float32Array(n);
  return {
    live: false, age: 0, life: 1,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), seed: 1,
    blend: 'alpha', orient: 'billboard',
    n: 6, k: 1,
    baseAng: f(RING_MAX), baseRad: f(RING_MAX),
    ampA: f(RING_MAX), ampB: f(RING_MAX), frqA: f(RING_MAX), frqB: f(RING_MAX),
    phA: f(RING_MAX), phB: f(RING_MAX),
    tanAmp: f(RING_MAX), tanFrq: f(RING_MAX), tanPh: f(RING_MAX),
    cenAng: f(CENTRE_MAX), cenRad: f(CENTRE_MAX), cenFrq: f(CENTRE_MAX), cenPh: f(CENTRE_MAX),
    centreDriftAmt: 0.2, halo: 0, neighbour: 0.4, size: 0.5, aspect: 1, grow: 2, growY: 2, growCurve: 0.5,
    stretch: 0, rot: 0, spin: 0,
    gravity: 0, buoy: 0, drag: 1, wind: 0, turbAmp: 0, turbFrq: 1,
    turbDir: new THREE.Vector3(), turbDir2: new THREE.Vector3(), turbPh: 0, turbPh2: 0,
    ground: false, groundY: -1e9, flatten: 0, spreadOnGround: 0, friction: 0,
    bounce: 0, contact: false,
    cCentre: new THREE.Color(), cInner: new THREE.Color(), cOuter: new THREE.Color(),
    cFade: null, alpha: 0.5, fadeIn: 0.1, outerAlpha: 0, haloAlpha: 0.55, bright: 1,
  };
}

/** One dynamic buffer + mesh per blend style. Built on first use, never freed. */
class Batch {
  geo = new THREE.BufferGeometry();
  mesh: THREE.Mesh;
  pos: Float32Array;
  col: Float32Array;
  idx: Uint16Array;
  vCount = 0;
  iCount = 0;
  /** Does this style want colours pre-multiplied by alpha? See below. */
  readonly premul: boolean;
  // Fixed range objects, MUTATED each frame rather than replaced. Uploading
  // the whole buffer every frame would push ~170KB of mostly-dead floats at a
  // few hundred puffs; rebuilding the range array instead would allocate three
  // objects per batch per frame, which is the churn this design exists to
  // avoid. So: allocate once, edit the counts.
  private rp = { start: 0, count: 0 };
  private rc = { start: 0, count: 0 };
  private ri = { start: 0, count: 0 };

  constructor(style: BlendStyle, cap: number) {
    this.premul = style === 'softAdd';
    this.pos = new Float32Array(cap * VERTS_MAX * 3);
    this.col = new Float32Array(cap * VERTS_MAX * 4); // rgba — the rim's fade
    this.idx = new Uint16Array(cap * IDX_MAX);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    // itemSize 4 is what turns on per-vertex ALPHA in three's basic material —
    // that is the whole soft rim, with no texture anywhere.
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const ia = new THREE.BufferAttribute(this.idx, 1);
    ia.setUsage(THREE.DynamicDrawUsage);
    this.geo.setIndex(ia);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false, // soft stuff never occludes; PS1 did the same
      side: THREE.DoubleSide, // no culling: a deformed fan can wind either way
      // Additive styles must not take scene fog — fog on an ADD blend adds the
      // fog colour, so distant glow would get BRIGHTER with depth.
      fog: style === 'alpha' || style === 'darken',
    });
    if (style === 'add') mat.blending = THREE.AdditiveBlending;
    else if (style === 'softAdd') {
      // Reduced additive: brightens toward the puff's colour, but self-limits
      // instead of blowing to white, which is what keeps a saturated Crash
      // pink reading as PINK when four puffs overlap.
      //
      //     result = src + dst * (1 - src)
      //
      // That only works on a PRE-MULTIPLIED source. Unpremultiplied, a faint
      // rim still carries a full-brightness colour, so (1 - src) near-zeroes
      // the background and the "glow" comes out as a hole — which is exactly
      // what this shipped as until a pixel diff caught the coloured smoke
      // rendering DARKER than the scene behind it. So `premul` folds alpha
      // into rgb at write time and the source factor is One.
      mat.blending = THREE.CustomBlending;
      mat.blendEquation = THREE.AddEquation;
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneMinusSrcColorFactor;
    } else if (style === 'darken') {
      // Soot: subtract from what is behind rather than paint over it.
      mat.blending = THREE.CustomBlending;
      mat.blendEquation = THREE.ReverseSubtractEquation;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneFactor;
    }
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false; // the buffer moves every frame; a stale bound would pop
    this.mesh.renderOrder = 10; // after the world, before the HUD passes
    this.mesh.matrixAutoUpdate = false; // vertices are already in world space
    this.mesh.userData.shared = true; // Level.dispose() must not free this
    // Point the attributes at the range objects ONCE. From here on `end()`
    // only edits the counts, so a frame costs no allocation at all.
    (this.geo.getAttribute('position') as THREE.BufferAttribute).updateRanges = [this.rp];
    (this.geo.getAttribute('color') as THREE.BufferAttribute).updateRanges = [this.rc];
    (this.geo.getIndex() as THREE.BufferAttribute).updateRanges = [this.ri];
  }

  begin(): void {
    this.vCount = 0;
    this.iCount = 0;
  }

  end(): void {
    this.geo.setDrawRange(0, this.iCount);
    const p = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const c = this.geo.getAttribute('color') as THREE.BufferAttribute;
    const i = this.geo.getIndex() as THREE.BufferAttribute;
    this.rp.count = this.vCount * 3;
    this.rc.count = this.vCount * 4;
    this.ri.count = this.iCount;
    p.needsUpdate = true;
    c.needsUpdate = true;
    i.needsUpdate = true;
    this.mesh.visible = this.iCount > 0;
  }
}

// ------------------------------------------------------------- the system ----

const V_A = new THREE.Vector3();
const V_B = new THREE.Vector3();
const V_R = new THREE.Vector3();
const V_U = new THREE.Vector3();
const V_F = new THREE.Vector3();
const C_TMP = new THREE.Color();
const C_MID = new THREE.Color();
const RAD = new Float32Array(RING_MAX);
const RAD2 = new Float32Array(RING_MAX);
const ANG = new Float32Array(RING_MAX);

export class PuffSystem {
  private pool: Puff[] = [];
  private batches = new Map<BlendStyle, Batch>();
  private root: THREE.Object3D | null = null;
  private seedCounter = 1;

  quality: Quality = 'high';
  wind = new THREE.Vector3(0.4, 0, 0.15);
  /** Where the ground is under (x, z). Return null for "no idea". */
  groundProbe: ((x: number, z: number, yHint: number) => number | null) | null = null;

  private trails = new Map<
    string,
    { x: number; y: number; z: number; carry: number; had: boolean; gap: number; rng: () => number }
  >();

  constructor(private cap = MAX_LIVE) {
    for (let i = 0; i < cap; i++) this.pool.push(blankPuff());
  }

  /** Add the batch meshes to a scene. Safe to call again after a level swap. */
  attach(scene: THREE.Object3D): void {
    this.root = scene;
    for (const b of this.batches.values()) if (b.mesh.parent !== scene) scene.add(b.mesh);
  }

  setQuality(q: Quality): void {
    this.quality = q;
  }

  /** Kill everything instantly — level change, respawn, hard reset. */
  clear(): void {
    for (const p of this.pool) p.live = false;
    this.trails.clear();
    for (const b of this.batches.values()) {
      b.begin();
      b.end();
    }
  }

  private batch(style: BlendStyle): Batch {
    let b = this.batches.get(style);
    if (!b) {
      // Lazily: a level that never uses soot should not pay for a soot buffer.
      b = new Batch(style, this.cap);
      this.batches.set(style, b);
      if (this.root) this.root.add(b.mesh);
    }
    return b;
  }

  private free(): Puff | null {
    for (const p of this.pool) if (!p.live) return p;
    return null; // at the ceiling: drop the spawn rather than stutter
  }

  // -- quality knobs -------------------------------------------------------
  private get countScale(): number {
    return this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.6 : 0.35;
  }
  private get ringCap(): number {
    return this.quality === 'high' ? 8 : this.quality === 'medium' ? 7 : 5;
  }
  private get multiScale(): number {
    return this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.5 : 0;
  }
  private get deformScale(): number {
    return this.quality === 'high' ? 1 : this.quality === 'medium' ? 0.8 : 0.5;
  }
  private get childrenOn(): boolean {
    return this.quality !== 'low';
  }

  // ------------------------------------------------------------ spawning --

  /**
   * One puff. Everything random about it is drawn HERE, from `seed`, and then
   * never redrawn — the shape animates as a function of age, not of luck.
   */
  spawn(
    preset: PuffPreset,
    x: number,
    y: number,
    z: number,
    o: {
      dir?: THREE.Vector3;
      seed?: number;
      surface?: SurfaceKind;
      groundY?: number;
      parentVel?: THREE.Vector3;
      strength?: number; // scales speed, size, count at the call site
      tint?: number; // overrides the surface colour outright
      ambient?: boolean; // scenery, not play — may be refused to protect the pool
    } = {},
  ): Puff | null {
    // SCENERY MUST NOT STARVE PLAY. Nightworks has 94 torches and the authored
    // plume runs at 13-25 puffs a second each, which on its own filled three
    // quarters of the pool — and a landing burst that finds no free puff is
    // simply not drawn. So ambient emitters are refused above a reserve line,
    // leaving the rest for the effects that are actually about what you did.
    const p = o.ambient && this.usedFrac > AMBIENT_CAP ? null : this.free();
    if (!p) return null;
    const seed = o.seed ?? this.seedCounter++;
    const rng = makeRng(seed * 2654435761);
    const sf = SURFACES[o.surface ?? 'generic'];
    const str = o.strength ?? 1;

    p.live = true;
    p.age = 0;
    p.seed = seed;
    p.blend = preset.blend ?? 'alpha';
    p.orient = preset.orient ?? 'billboard';
    p.life = rr(rng, preset.life, 1) * sf.life;
    p.pos.set(x, y, z);

    // --- ring: irregular by construction, never a clean circle -------------
    const nWant = preset.ring ? Math.round(rr(rng, preset.ring, 6)) : 6;
    const n = Math.max(RING_MIN, Math.min(this.ringCap, nWant));
    p.n = n;
    const multi = (preset.multiCentre ?? 0) * this.multiScale;
    p.k = rng() < multi ? (rng() < 0.5 ? 2 : 3) : 1;

    const defK = this.deformScale;
    const step = (Math.PI * 2) / n;
    for (let i = 0; i < n; i++) {
      // Jitter BOTH the angle and the radius. Even spacing with jittered radii
      // still reads as a wheel; jittering the angle is what kills the polygon.
      // Base spacing jitter is capped for the same reason — half a step of
      // jitter can put two vertices on top of each other before the swirl even
      // starts.
      p.baseAng[i] = i * step + (rng() - 0.5) * step * 0.44;
      p.baseRad[i] = 0.72 + rng() * 0.5;
      p.ampA[i] = rr(rng, preset.wobble, 0.2) * (0.6 + rng() * 0.8) * defK;
      p.ampB[i] = p.ampA[i] * (0.35 + rng() * 0.5);
      p.frqA[i] = rr(rng, preset.wobbleRate, 1.2) * (0.75 + rng() * 0.5);
      p.frqB[i] = p.frqA[i] * (1.7 + rng() * 1.1);
      p.phA[i] = rng() * Math.PI * 2;
      p.phB[i] = rng() * Math.PI * 2;
      // The swirl must never be able to push a vertex PAST its neighbour. Let
      // it, and two ring points end up at nearly the same angle with very
      // different radii — which draws as a long narrow spike, and a ring full
      // of them draws as the jagged shards this used to make. A third of the
      // spacing is plenty of wander and cannot reorder anything.
      p.tanAmp[i] = Math.min(rr(rng, preset.swirl, 0.15) * (0.5 + rng()) * defK, step * 0.33);
      p.tanFrq[i] = rr(rng, preset.wobbleRate, 1.2) * (0.5 + rng() * 0.7);
      p.tanPh[i] = rng() * Math.PI * 2;
    }
    for (let j = 0; j < p.k; j++) {
      p.cenAng[j] = p.k === 1 ? 0 : (j / p.k) * Math.PI * 2 + rng() * 0.8;
      p.cenRad[j] = p.k === 1 ? 0 : 0.18 + rng() * 0.24;
      p.cenFrq[j] = 0.5 + rng() * 1.2;
      p.cenPh[j] = rng() * Math.PI * 2;
    }
    p.neighbour = preset.neighbour ?? 0.4;
    p.halo = preset.halo ?? 0;
    p.centreDriftAmt = (preset.centreDrift ?? 0.2) * defK;

    // Strength barely touches SIZE. It used to be 0.75 + 0.5*str, which drew
    // everything 1.25x its authored size at normal strength and 1.85x on a
    // heavy landing — no preset ever rendered at the size its own numbers
    // said, which is half of how "walking dust" became weather. A bigger hit
    // now reads as MORE puffs (burst count still scales), not bigger ones.
    p.size = rr(rng, preset.size, 0.4) * sf.size * (0.85 + 0.15 * Math.min(2.5, str));
    p.aspect = rr(rng, preset.aspect, 1);
    p.grow = rr(rng, preset.grow, 2);
    p.growY = preset.growY !== undefined ? rr(rng, preset.growY, p.grow) : p.grow;
    p.growCurve = preset.growCurve ?? 0.5;
    p.stretch = preset.stretch ?? 0;
    p.rot = rng() * Math.PI * 2;
    p.spin = rr(rng, preset.spin, 0);

    // --- motion ------------------------------------------------------------
    const spd = rr(rng, preset.speed, 0) * sf.spread * str;
    const spread = preset.spread ?? 0;
    if (o.dir && o.dir.lengthSq() > 1e-6) {
      V_A.copy(o.dir).normalize();
      // random rotation inside the cone, built from a stable orthonormal basis
      V_B.set(0, 1, 0);
      if (Math.abs(V_A.y) > 0.9) V_B.set(1, 0, 0);
      V_R.copy(V_B).cross(V_A).normalize();
      V_U.copy(V_A).cross(V_R).normalize();
      const th = rng() * Math.PI * 2;
      const ph = spread * Math.sqrt(rng()); // sqrt keeps the cone evenly filled
      p.vel
        .copy(V_A)
        .multiplyScalar(Math.cos(ph))
        .addScaledVector(V_R, Math.sin(ph) * Math.cos(th))
        .addScaledVector(V_U, Math.sin(ph) * Math.sin(th))
        .multiplyScalar(spd);
    } else {
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(1 - 2 * rng());
      p.vel.set(
        Math.sin(ph) * Math.cos(th) * spd,
        Math.cos(ph) * spd * 0.35,
        Math.sin(ph) * Math.sin(th) * spd,
      );
    }
    p.vel.y += rr(rng, preset.up, 0) * str;
    if (o.parentVel && preset.inherit) p.vel.addScaledVector(o.parentVel, preset.inherit);

    p.gravity = rr(rng, preset.gravity, 0) * sf.gravity;
    p.buoy = rr(rng, preset.buoyancy, 0);
    p.drag = rr(rng, preset.drag, 1);
    p.wind = preset.wind ?? 0;
    p.turbAmp = rr(rng, preset.turbulence, 0) * defK;
    p.turbFrq = rr(rng, preset.turbRate, 1);
    // Two fixed directions per puff, so the wander is a smooth 3D lissajous
    // rather than the jitter you get from re-rolling a direction each frame.
    p.turbDir.set(rng() - 0.5, (rng() - 0.5) * 0.5, rng() - 0.5).normalize();
    p.turbDir2.set(rng() - 0.5, (rng() - 0.5) * 0.5, rng() - 0.5).normalize();
    p.turbPh = rng() * Math.PI * 2;
    p.turbPh2 = rng() * Math.PI * 2;

    // --- ground ------------------------------------------------------------
    p.ground = !!preset.ground;
    p.contact = false;
    if (p.ground) {
      const g = o.groundY ?? (this.groundProbe ? this.groundProbe(x, z, y) : null);
      p.groundY = g === null || g === undefined ? -1e9 : g;
    } else p.groundY = -1e9;
    p.flatten = preset.flatten ?? 0;
    p.spreadOnGround = preset.spreadOnGround ?? 0;
    p.friction = (preset.friction ?? 0) * sf.stick;
    p.bounce = preset.bounce ?? 0;

    // --- colour ------------------------------------------------------------
    const tint = preset.surfaceTint ?? 0;
    p.cCentre.copy(lin(preset.centre ?? 0xb5ada0));
    p.cInner.copy(lin(preset.inner ?? preset.centre ?? 0x8a8378));
    p.cOuter.copy(lin(preset.outer ?? 0x101010));
    if (tint > 0) {
      C_TMP.copy(lin(o.tint ?? sf.colour));
      p.cCentre.lerp(C_TMP, tint);
      p.cInner.lerp(C_TMP, tint * 0.8);
    }
    p.cFade = preset.fadeTo !== undefined ? lin(preset.fadeTo) : null;
    p.alpha = rr(rng, preset.alpha, 0.4);
    p.fadeIn = preset.fadeIn ?? 0.1;
    p.outerAlpha = preset.outerAlpha ?? 0;
    p.haloAlpha = preset.haloAlpha ?? 0.55;
    p.bright = rr(rng, preset.bright, 1);
    return p;
  }

  /** A named preset fired once, with its child layers. */
  burst(
    name: string,
    x: number,
    y: number,
    z: number,
    o: Parameters<PuffSystem['spawn']>[4] & { count?: number } = {},
  ): void {
    const preset = PUFF_PRESETS[name];
    if (!preset) return;
    const seed = o.seed ?? this.seedCounter++;
    const rng = makeRng(seed * 40503);
    const sf = SURFACES[o.surface ?? 'generic'];
    const str = o.strength ?? 1;
    const want =
      (o.count ?? rr(rng, preset.count, 1)) * sf.count * this.countScale * (0.6 + 0.6 * str);
    const n = Math.max(1, Math.round(want));
    for (let i = 0; i < n; i++) this.spawn(preset, x, y, z, { ...o, seed: seed + i * 7919 });
    // Layers share the TRIGGERING seed, so the whole event is one deterministic
    // thing: replay it and you get the same cloud, not a different one.
    if (preset.children && this.childrenOn)
      for (const c of preset.children) {
        if (c === name) continue; // a preset listing itself would recurse forever
        const sub = PUFF_PRESETS[c];
        if (!sub) continue;
        const cn = Math.max(1, Math.round(rr(rng, sub.count, 1) * sf.count * this.countScale * str));
        for (let i = 0; i < cn; i++)
          this.spawn(sub, x, y, z, { ...o, seed: seed + 104729 + i * 7919 });
      }
  }

  /**
   * A collision. Everything about the cloud scales off how hard it was: how
   * many puffs, how big, how fast they leave, how far they spread on the deck.
   */
  impact(
    x: number,
    y: number,
    z: number,
    normal: THREE.Vector3,
    strength: number,
    surface: SurfaceKind = 'generic',
    objVel?: THREE.Vector3,
    preset = 'dustLand',
  ): void {
    const s = Math.max(0, Math.min(3, strength));
    if (s < 0.05) return;
    this.burst(preset, x, y, z, {
      dir: normal,
      surface,
      strength: s,
      groundY: y,
      parentVel: objVel,
    });
  }

  /**
   * A trail laid down by DISTANCE, not by frame. `key` identifies the emitter
   * (one per wheel, per foot, whatever) so several can run at once.
   *
   * Spawns are interpolated along the segment travelled, so a fast pass leaves
   * an even line instead of a dotted one, and the whole thing is frame-rate
   * independent by construction.
   */
  trail(
    key: string,
    name: string,
    x: number,
    y: number,
    z: number,
    o: Parameters<PuffSystem['spawn']>[4] & { emit?: boolean; teleport?: number } = {},
  ): void {
    const preset = PUFF_PRESETS[name];
    if (!preset) return;
    let st = this.trails.get(key);
    if (!st) {
      // The gap is drawn ONCE per spawn and carried on the trail's own state.
      // Re-rolling it on every call — which is every frame — would make the
      // spacing depend on how often the caller happens to tick, which is the
      // exact frame-rate coupling a distance emitter exists to avoid.
      const rng = makeRng((key.length * 2654435761) ^ 0x5bf03635);
      st = { x, y, z, carry: 0, had: false, gap: 0, rng };
      st.gap = Math.max(0.05, rr(rng, preset.spacing, 0.6));
      this.trails.set(key, st);
    }
    const dx = x - st.x, dy = y - st.y, dz = z - st.z;
    const d = Math.hypot(dx, dy, dz);
    const jump = o.teleport ?? 8;
    if (!st.had || d > jump) {
      // A respawn or a warp: start the line again here rather than painting a
      // stripe across the level between the two positions.
      st.x = x; st.y = y; st.z = z; st.carry = 0; st.had = true;
      return;
    }
    st.had = true;
    // `emit: false` means "you are still here, just not laying anything down"
    // — brake below the speed gate, stop, roll on again. CUTTING the trail
    // instead would drop the accumulated distance AND re-seed with had=false,
    // so the first call after every dip spawns nothing; a speed hovering near
    // the gate then produced almost no trail at all. Cutting is for real
    // discontinuities only: a landing, a warp, a respawn.
    if (o.emit === false) {
      st.x = x; st.y = y; st.z = z;
      return;
    }
    st.carry += d;
    let guard = 8; // never more than a handful of spawns in one frame
    while (st.carry >= st.gap && guard-- > 0) {
      // Interpolate BACK along the segment just travelled, so a fast pass
      // leaves an even line instead of one clump per frame.
      const back = st.carry - st.gap;
      const t = d > 1e-5 ? 1 - back / d : 1;
      this.spawn(preset, st.x + dx * t, st.y + dy * t, st.z + dz * t, o);
      st.carry -= st.gap;
      st.gap = Math.max(0.05, rr(st.rng, preset.spacing, 0.6)); // vary the NEXT gap
    }
    if (guard <= 0) st.carry = 0;
    st.x = x; st.y = y; st.z = z;
  }

  /** Forget a trail's history — teleports, respawns, level swaps. */
  cutTrail(key: string): void {
    this.trails.delete(key);
  }

  emitter(name: string, o: EmitterOpts = {}): Emitter {
    return new Emitter(this, name, o);
  }

  // -------------------------------------------------------------- update --

  update(dt: number, camera: THREE.Camera): void {
    if (dt <= 0) dt = 1 / 60;

    // The billboard basis, once per frame rather than once per puff.
    camera.getWorldDirection(V_F);
    V_R.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    V_U.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

    for (const b of this.batches.values()) b.begin();

    for (const p of this.pool) {
      if (!p.live) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.live = false;
        continue;
      }
      this.step(p, dt);
      this.write(p);
    }

    for (const b of this.batches.values()) b.end();
  }

  private step(p: Puff, dt: number): void {
    // buoyancy is HOT gas: it decays as the puff cools, so a plume leaves fast
    // and then hands over to the wind instead of rising forever
    const cool = 1 - p.age / p.life;
    p.vel.y += (p.buoy * cool * cool - p.gravity) * dt;
    if (p.wind > 0) {
      p.vel.x += this.wind.x * p.wind * dt;
      p.vel.y += this.wind.y * p.wind * dt;
      p.vel.z += this.wind.z * p.wind * dt;
    }
    const dmp = Math.max(0, 1 - p.drag * dt);
    p.vel.multiplyScalar(dmp);

    p.pos.addScaledVector(p.vel, dt);

    if (p.turbAmp > 0) {
      // Two sines on two fixed axes: a smooth wander with no repeat you can see.
      const a = Math.sin(p.age * p.turbFrq + p.turbPh) * p.turbAmp * dt;
      const b = Math.sin(p.age * p.turbFrq * 1.7 + p.turbPh2) * p.turbAmp * 0.6 * dt;
      p.pos.addScaledVector(p.turbDir, a);
      p.pos.addScaledVector(p.turbDir2, b);
    }

    if (p.ground && p.groundY > -1e8) {
      const floor = p.groundY + 0.02;
      // CONTACT IS A BAND, not a plane. A puff is ground dust when it is NEAR
      // the deck, not only when its centre has sunk below it — kicked-up dust
      // rises a little, then hangs and dies without ever crossing back, so a
      // strict `y <= floor` test left most of a landing burst behaving like
      // free-floating smoke. The band grows with the puff, because a big cloud
      // is touching the deck from higher up than a small one.
      if (p.pos.y <= floor + 0.15 + p.size) {
        p.contact = true;
        // On the deck the puff stops travelling and starts SPREADING — that is
        // what makes ground dust read as attached to the surface rather than
        // as a ball that happens to be low.
        const f = Math.max(0, 1 - p.friction * dt);
        p.vel.x *= f;
        p.vel.z *= f;
      }
      if (p.pos.y <= floor) {
        if (p.bounce > 0 && p.vel.y < -0.2) p.vel.y = -p.vel.y * p.bounce;
        else p.vel.y = Math.max(0, p.vel.y);
        p.pos.y = floor;
      }
    }

    p.rot += p.spin * dt;
  }

  /** Build this puff's polygon and append it to its blend style's buffer. */
  private write(p: Puff): void {
    const b = this.batch(p.blend);
    const n = p.n;
    const k = p.k;
    const hasHalo = p.halo > 0;
    const tris = (k === 1 ? n : n + k) + (hasHalo ? n * 2 : 0);
    if (b.vCount + n + k > this.cap * VERTS_MAX || b.iCount + tris * 3 > this.cap * IDX_MAX) return;

    const t = p.age / p.life;

    // --- size over life ----------------------------------------------------
    // Front-loaded by default: smoke and dust both open fast and then creep.
    const gt = Math.pow(t, p.growCurve);
    let sx = p.size * (1 + (p.grow - 1) * gt) * p.aspect;
    let sy = p.size * (1 + (p.growY - 1) * gt);
    if (p.contact && p.flatten > 0) {
      // squash vertically, spread horizontally — conserving the read, not volume
      sy *= 1 - p.flatten * 0.75;
      sx *= 1 + p.spreadOnGround;
    }
    if (p.stretch > 0) {
      const spd = p.vel.length();
      sx *= 1 + p.stretch * spd;
    }
    // A LAST BACKSTOP ON PROPORTION. aspect x grow x growY x ground-flatten x
    // velocity-stretch all multiply, and four modest numbers make one absurd
    // one — that is how a puff ends up a long thin slab. Nothing may be more
    // than 1.9 times longer than it is tall, whatever the preset asked for.
    const ratio = sx / (sy || 1e-4);
    if (ratio > 1.9) sx = sy * 1.9;
    else if (ratio < 1 / 1.9) sx = sy / 1.9;

    // --- deformed ring -----------------------------------------------------
    for (let i = 0; i < n; i++) {
      // Clamped to a band. Two sines stacked on a base radius can otherwise
      // put one vertex at three times its neighbour's reach, and the triangle
      // between them is a splinter. The band still allows a very lumpy
      // outline — it only stops a single point running away with the shape.
      const r =
        p.baseRad[i] +
        Math.sin(p.age * p.frqA[i] + p.phA[i]) * p.ampA[i] +
        Math.sin(p.age * p.frqB[i] + p.phB[i]) * p.ampB[i];
      RAD[i] = r < 0.5 ? 0.5 : r > 1.45 ? 1.45 : r;
      ANG[i] = p.baseAng[i] + Math.sin(p.age * p.tanFrq[i] + p.tanPh[i]) * p.tanAmp[i];
    }
    // Neighbour influence: without it every vertex wanders alone and the
    // silhouette is spiky static. With it, whole SIDES bulge and contract,
    // which is what smoke actually does.
    const nb = p.neighbour;
    if (nb > 0) {
      for (let i = 0; i < n; i++) {
        const a = RAD[(i + n - 1) % n];
        const c = RAD[(i + 1) % n];
        RAD2[i] = RAD[i] * (1 - nb) + ((a + c) * 0.5) * nb;
      }
      for (let i = 0; i < n; i++) RAD[i] = RAD2[i];
    }

    // --- orientation basis -------------------------------------------------
    let rx = V_R.x, ry = V_R.y, rz = V_R.z;
    let ux = V_U.x, uy = V_U.y, uz = V_U.z;
    if (p.orient === 'billboardY') {
      // yaw to camera, never pitch: plumes must stay upright
      const l = Math.hypot(V_R.x, V_R.z) || 1;
      rx = V_R.x / l; ry = 0; rz = V_R.z / l;
      ux = 0; uy = 1; uz = 0;
    } else if (p.orient === 'surface') {
      rx = 1; ry = 0; rz = 0;
      ux = 0; uy = 0; uz = 1;
    } else if (p.orient === 'velocity' && p.vel.lengthSq() > 1e-4) {
      V_A.copy(p.vel).normalize();
      // long axis along travel, short axis across it and across the view
      V_B.copy(V_A).cross(V_F);
      if (V_B.lengthSq() < 1e-6) V_B.set(0, 1, 0);
      V_B.normalize();
      rx = V_A.x; ry = V_A.y; rz = V_A.z;
      ux = V_B.x; uy = V_B.y; uz = V_B.z;
    } else if (p.orient === 'fixed') {
      rx = 1; ry = 0; rz = 0;
      ux = 0; uy = 1; uz = 0;
    }

    const cs = Math.cos(p.rot), sn = Math.sin(p.rot);

    // --- colour over life --------------------------------------------------
    // fade in over the opening slice, then a long smooth fall to nothing: a
    // puff that vanishes on a frame boundary reads as a bug, not as smoke
    const fin = p.fadeIn > 0 ? Math.min(1, t / p.fadeIn) : 1;
    const fout = 1 - Math.pow(t, 1.6);
    const a = p.alpha * fin * Math.max(0, fout);
    let cr = p.cCentre.r, cg = p.cCentre.g, cb = p.cCentre.b;
    let ir = p.cInner.r, ig = p.cInner.g, ib = p.cInner.b;
    if (p.cFade) {
      const f = t * t;
      cr += (p.cFade.r - cr) * f; cg += (p.cFade.g - cg) * f; cb += (p.cFade.b - cb) * f;
      ir += (p.cFade.r - ir) * f; ig += (p.cFade.g - ig) * f; ib += (p.cFade.b - ib) * f;
    }
    const br = p.bright;
    cr *= br; cg *= br; cb *= br;
    ir *= br; ig *= br; ib *= br;

    const base = b.vCount;
    let vp = base * 3;
    let vc = base * 4;

    // --- internal centres --------------------------------------------------
    // They drift, so the densest part of the puff is not pinned to the middle.
    for (let j = 0; j < k; j++) {
      const dr = p.cenRad[j] + Math.sin(p.age * p.cenFrq[j] + p.cenPh[j]) * p.centreDriftAmt;
      const da = p.cenAng[j] + Math.sin(p.age * p.cenFrq[j] * 0.7 + p.cenPh[j]) * 0.5;
      const lx0 = Math.cos(da) * dr * sx;
      const ly0 = Math.sin(da) * dr * sy;
      const lx = lx0 * cs - ly0 * sn;
      const ly = lx0 * sn + ly0 * cs;
      b.pos[vp++] = p.pos.x + rx * lx + ux * ly;
      b.pos[vp++] = p.pos.y + ry * lx + uy * ly;
      b.pos[vp++] = p.pos.z + rz * lx + uz * ly;
      const m = b.premul ? a : 1;
      b.col[vc++] = cr * m; b.col[vc++] = cg * m; b.col[vc++] = cb * m; b.col[vc++] = a;
    }

    // --- ring(s) -----------------------------------------------------------
    // THE FALLOFF IS THE WHOLE LOOK. A single ring gives a straight cone from
    // the centre to nothing, which reads as flat haze. Sampled off the Crash 3
    // footage, the real thing is a SMALL HOT CORE, then a broad mid-tone
    // plateau, then a long dark tail: brightness runs 131 -> 81 within about a
    // twelfth of the radius, sits near 80 out to a quarter of it, and only then
    // decays away. Two rings reproduce exactly that — an inner ring carrying
    // the body colour at `haloAlpha`, and an outer ring at the full radius
    // carrying the dark rim. Presets without `halo` keep the cheap single ring.
    const emitRing = (frac: number, col: THREE.Color, alpha: number) => {
      for (let i = 0; i < n; i++) {
        const lx0 = Math.cos(ANG[i]) * RAD[i] * frac * sx;
        const ly0 = Math.sin(ANG[i]) * RAD[i] * frac * sy;
        const lx = lx0 * cs - ly0 * sn;
        const ly = lx0 * sn + ly0 * cs;
        b.pos[vp++] = p.pos.x + rx * lx + ux * ly;
        b.pos[vp++] = p.pos.y + ry * lx + uy * ly;
        b.pos[vp++] = p.pos.z + rz * lx + uz * ly;
        const mm = b.premul ? alpha : 1;
        b.col[vc++] = col.r * mm; b.col[vc++] = col.g * mm; b.col[vc++] = col.b * mm;
        b.col[vc++] = alpha;
      }
    };
    if (hasHalo) {
      // the mid ring keeps the puff's BODY colour, which is what makes the
      // plateau read as coloured light rather than as a fading edge
      C_MID.setRGB(ir, ig, ib);
      emitRing(p.halo, C_MID, a * p.haloAlpha);
    }
    // The rim is the dark/faint colour at a fraction of the centre's alpha —
    // usually zero. Because the fade lives in the VERTICES there is no
    // rectangle anywhere to give the billboard away.
    emitRing(1, p.cOuter, a * p.outerAlpha);

    // --- triangles ---------------------------------------------------------
    let ii = b.iCount;
    const ring0 = base + k; // the ring the centres fan out to
    const ring1 = ring0 + n; // only present when haloed
    if (k === 1) {
      for (let i = 0; i < n; i++) {
        b.idx[ii++] = base;
        b.idx[ii++] = ring0 + i;
        b.idx[ii++] = ring0 + ((i + 1) % n);
      }
    } else {
      // Several centres: give each one a contiguous arc of the ring and bridge
      // between them. That is what makes a big puff read as two or three lobes
      // rather than as one blob with a bright dot in it.
      const per = n / k;
      for (let i = 0; i < n; i++) {
        const own = Math.min(k - 1, Math.floor(i / per));
        const nxt = Math.min(k - 1, Math.floor(((i + 1) % n) / per));
        b.idx[ii++] = base + own;
        b.idx[ii++] = ring0 + i;
        b.idx[ii++] = ring0 + ((i + 1) % n);
        if (own !== nxt) {
          b.idx[ii++] = base + own;
          b.idx[ii++] = base + nxt;
          b.idx[ii++] = ring0 + ((i + 1) % n);
        }
      }
      // close the loop from the last arc's centre back to the first
      b.idx[ii++] = base + (k - 1);
      b.idx[ii++] = base;
      b.idx[ii++] = ring0;
    }
    if (hasHalo) {
      // The band between the two rings: this is the long tail, and it is where
      // the puff stops being a shape and becomes light.
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        b.idx[ii++] = ring0 + i; b.idx[ii++] = ring1 + i; b.idx[ii++] = ring1 + j;
        b.idx[ii++] = ring0 + i; b.idx[ii++] = ring1 + j; b.idx[ii++] = ring0 + j;
      }
    }

    b.vCount += k + n + (hasHalo ? n : 0);
    b.iCount = ii;
  }

  /** How full the pool is, 0..1. */
  get usedFrac(): number {
    return this.liveCount / this.cap;
  }

  /** Live puff count — for the debug readout and the tests. */
  get liveCount(): number {
    let c = 0;
    for (const p of this.pool) if (p.live) c++;
    return c;
  }

  /** Draw calls this system is currently costing. */
  get drawCalls(): number {
    let c = 0;
    for (const b of this.batches.values()) if (b.mesh.visible) c++;
    return c;
  }
}

// ---------------------------------------------------------------- emitter ----

export interface EmitterOpts {
  shape?: EmitterShape;
  mode?: EmitMode;
  size?: THREE.Vector3; // box half-extents / sphere+disc radius in x
  dir?: THREE.Vector3;
  surface?: SurfaceKind;
  groundY?: number;
  rate?: Range;
  jitter?: number;
  interval?: number; // for 'repeat'
  seed?: number;
}

/**
 * A continuous or repeating source. The timing is deliberately IRREGULAR —
 * a fixed interval reads as a machine gun, and real smoke comes in uneven
 * clumps with pauses and the occasional bigger puff.
 */
export class Emitter {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  active = true;
  private acc = 0;
  private next = 0;
  private rng: () => number;
  private repeatT = 0;

  constructor(
    private sys: PuffSystem,
    public name: string,
    public opts: EmitterOpts = {},
  ) {
    this.rng = makeRng((opts.seed ?? 12345) * 2654435761);
    this.next = this.gap();
  }

  private gap(): number {
    const preset = PUFF_PRESETS[this.name] ?? {};
    const rate = Math.max(0.01, rr(this.rng, this.opts.rate ?? preset.rate, 8));
    const j = this.opts.jitter ?? preset.jitter ?? 0.5;
    const base = 1 / rate;
    // Occasionally a real pause, occasionally a double — the two things that
    // stop a plume looking metronomic.
    const roll = this.rng();
    if (roll < 0.08 * j) return base * (2.5 + this.rng() * 2.5); // a beat of nothing
    if (roll > 1 - 0.12 * j) return base * 0.15; // paired emission
    return base * (1 - j * 0.5 + this.rng() * j);
  }

  private offset(out: THREE.Vector3): void {
    const s = this.opts.size ?? V_ONE;
    const r = this.rng;
    switch (this.opts.shape ?? 'point') {
      case 'sphere': {
        const th = r() * Math.PI * 2;
        const ph = Math.acos(1 - 2 * r());
        const rad = s.x * Math.cbrt(r());
        out.set(Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad, Math.sin(ph) * Math.sin(th) * rad);
        break;
      }
      case 'disc': {
        const th = r() * Math.PI * 2;
        const rad = s.x * Math.sqrt(r());
        out.set(Math.cos(th) * rad, 0, Math.sin(th) * rad);
        break;
      }
      case 'box':
        out.set((r() - 0.5) * 2 * s.x, (r() - 0.5) * 2 * s.y, (r() - 0.5) * 2 * s.z);
        break;
      case 'line':
        out.set(0, 0, 0).addScaledVector(s, r() - 0.5);
        break;
      case 'surface':
        out.set((r() - 0.5) * 2 * s.x, 0, (r() - 0.5) * 2 * s.z);
        break;
      default:
        out.set(0, 0, 0);
    }
  }

  update(dt: number): void {
    if (!this.active) return;
    const mode = this.opts.mode ?? 'continuous';
    if (mode === 'repeat') {
      this.repeatT -= dt;
      if (this.repeatT <= 0) {
        this.repeatT = this.opts.interval ?? 1;
        this.fire();
      }
      return;
    }
    if (mode !== 'continuous') return; // burst/event/contact/distance are pushed in
    this.acc += dt;
    let guard = 12;
    while (this.acc >= this.next && guard-- > 0) {
      this.acc -= this.next;
      this.next = this.gap();
      this.emitOne();
    }
  }

  /** One puff now, wherever the emitter currently is. */
  emitOne(): void {
    const preset = PUFF_PRESETS[this.name];
    if (!preset) return;
    this.offset(V_OFF);
    // ...and every so often a noticeably bigger one. Uniform puffs read as a
    // particle system; a plume needs the odd fat one to look like gas.
    const big = this.rng() < 0.12 ? 1.6 : 1;
    this.sys.spawn(preset, this.pos.x + V_OFF.x, this.pos.y + V_OFF.y, this.pos.z + V_OFF.z, {
      dir: this.opts.dir,
      surface: this.opts.surface,
      groundY: this.opts.groundY,
      parentVel: this.vel,
      strength: big,
    });
  }

  /** The whole preset, children and all. */
  fire(strength = 1): void {
    this.offset(V_OFF);
    this.sys.burst(this.name, this.pos.x + V_OFF.x, this.pos.y + V_OFF.y, this.pos.z + V_OFF.z, {
      dir: this.opts.dir,
      surface: this.opts.surface,
      groundY: this.opts.groundY,
      parentVel: this.vel,
      strength,
    });
  }
}

const V_ONE = new THREE.Vector3(1, 1, 1);
const V_OFF = new THREE.Vector3();

/**
 * Map whatever the ground query calls a surface onto a dust profile. The level
 * names surfaces after its TEXTURE kinds (TEX_KINDS in level.ts) plus a few
 * hand-written labels, so match loosely and fall back to `generic` — an
 * unrecognised floor should still kick up neutral dust, never nothing.
 */
export function surfaceFromName(name: string | undefined | null): SurfaceKind {
  if (!name) return 'generic';
  const s = name.toLowerCase();
  if (s.includes('sand')) return 'sand';
  if (s.includes('snow') || s.includes('ice')) return 'snow';
  if (s.includes('grass') || s.includes('moss') || s.includes('jungle')) return 'grass';
  if (s.includes('dirt') || s.includes('mud') || s.includes('earth')) return 'dirt';
  if (s.includes('wood') || s.includes('plank') || s.includes('trunk') || s.includes('crate')) return 'wood';
  if (s.includes('metal') || s.includes('rail') || s.includes('steel')) return 'metal';
  if (s.includes('stone') || s.includes('slab') || s.includes('rock') || s.includes('temple')) return 'stone';
  if (s.includes('pavement') || s.includes('asphalt') || s.includes('concrete') || s.includes('deck'))
    return 'concrete';
  return 'generic';
}

export const puffs = new PuffSystem();
