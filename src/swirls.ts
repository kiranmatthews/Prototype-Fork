// SWIRLS — the Crash warp-hole / mystic-background effect, done the way the
// PS1 (and every early music visualizer) did it: a coarse POLAR GRID of
// Gouraud-shaded triangles whose vertex colours are a cheap field of sines in
// (radius, angle, time). No texture, no shader tricks — the smoothing IS the
// hardware interpolating between a couple of hundred coloured vertices.
//
// What the Crash 1 footage actually shows (frames pulled and squinted at):
//  - ONE wispy bright filament spiralling 2-3 turns out from a hot core —
//    white-hot line, coloured glow bleeding around it,
//  - over a mottled cloudy backing in a darker cousin of the same colour,
//    fading to near-black at the rim of the disc,
//  - the WHOLE PALETTE cycling round the hue wheel over a few seconds
//    (pink -> blue -> orange -> deep blue in six sampled frames),
//  - a handful of little yellow sparkle dots drifting in front,
//  - constant slow churn: the spiral pours toward (or out of) the centre and
//    the filament wobbles so it never reads as clean maths.
//
// The Aku Aku invincibility background is the same machine with the filament
// turned off: soft concentric bands, low contrast, slow.
import * as THREE from 'three';

export interface SwirlPreset {
  blend?: 'alpha' | 'add'; // the BODY pass: ground + mottle + rim
  blendBright?: 'add' | 'alpha'; // the BRIGHT pass: filament + glow + core
  radius?: number; // world units
  rings?: number; // polar grid rings (3..14)
  segs?: number; // segments around (8..48)
  depth?: number; // ring-gap curve: displayed radius = r^depth. 1 = even
  // spacing; 2-3 bunches the rings toward the centre like a tunnel receding
  // to its vanishing point — and makes travelling rings decelerate as they
  // near the core, which is what depth looks like.
  billboard?: boolean; // face the camera every frame

  // --- the spiral field ---
  arms?: number; // integer! spiral arm count; 0 = concentric rings only
  twist?: number; // how many full turns an arm makes centre -> rim (sign = handedness)
  flow?: number; // TRUE radial travel, in radius-fractions per second:
  // +0.25 swallows the rings into the core in ~4s, negative emits them out.
  // This one MOVES THE MESH RINGS — the pattern is carried by geometry, so
  // the motion is continuous. (A colour field alone, sampled at a dozen
  // fixed rings, just pulses in place: that effect still exists as
  // `current` below, because it was found by accident and liked.)
  current?: number; // the pulse-through-the-rings effect: scrolls the COLOUR
  // field without moving geometry. + runs toward the core.
  sharp?: number; // filament sharpness (power curve). 1 = broad band, 10 = hairline
  filament?: number; // filament strength 0..2 (0 = no bright line at all)
  glowWidth?: number; // how far the coloured glow bleeds around the filament 0..1

  // --- churn (what stops it reading as clean maths) ---
  wobble?: number; // radians of phase wobble bent into the spiral
  wobbleScale?: number; // spatial frequency of that wobble along the radius
  wobbleRate?: number; // temporal speed of the churn
  edgeCrinkle?: number; // radial jitter of the outer rings, fraction of radius

  // --- plasma (the electric quality of the reference filaments) ---
  // The wobble above can only bend the line in 2-3 broad lobes — cloud, not
  // lightning. Jag bends the filament PHASE with high angular harmonics
  // (rounded to integers so the circle still closes), scaled up toward the
  // rim so the core stays tight while the outer rings fray. Streak dims and
  // brightens the line ALONG its arc with a travelling wave — the knots of
  // energy coursing through the rings in the footage.
  jag?: number; // radians of high-frequency phase bend. 0 = off
  jagScale?: number; // angular harmonic of the jag (5-9 = electric)
  jagRate?: number; // how fast the jag pattern seethes
  streak?: number; // 0..1 brightness modulation along the filament
  streakScale?: number; // knots per circumference (integer harmonic)
  streakRate?: number; // rad/s the knots course along the rings

  // --- core + backing ---
  core?: number; // hot core blob size, fraction of radius
  coreGlow?: number; // core brightness 0..3
  mottle?: number; // cloudiness of the backing 0..1
  mottleScale?: number; // spatial frequency of the mottle
  mottleRate?: number; // how fast the clouds churn

  // --- colour: palette A (the six stops) ---
  colCore?: number; // white-hot centre of the filament / core blob
  colFil?: number; // the filament line
  colGlow?: number; // the bleed around it
  colGround?: number; // the disc backing
  colGround2?: number; // what the mottle patches lift toward (default: brighter ground)
  colRim?: number; // what the outer band tints toward before dying (default: darker ground)

  // --- colour: palette B + the cycle between them ---
  // Any B colour set pairs with its A slot; the palette then breathes A->B->A
  // at cycleRate. The blend runs in HSL along the SHORTEST hue arc, so pink to
  // blue passes through purple — never the long way round the rainbow.
  colCoreB?: number;
  colFilB?: number;
  colGlowB?: number;
  colGroundB?: number;
  colGround2B?: number;
  colRimB?: number;
  cycleRate?: number; // rad/s of the A<->B breath (0 = off)

  hueCycle?: number; // rad/s the whole palette walks round the hue wheel (Crash 1 style)
  alpha?: number; // overall opacity
  body?: number; // opacity of the BODY pass interior — how solid the cloudy backing is.
  // The Crash portal occludes the room behind it: alpha blend + high body.
  rim?: number; // where the rim fade begins, fraction of radius (0.5 = halfway)

  // --- presentation ---
  spin?: number; // rad/s whole-disc rotation on top of the flow
  pulse?: number; // brightness breathing amplitude 0..1
  pulseRate?: number; // breaths per second-ish (rad/s)

}

export const SWIRL_PRESETS: Record<string, SwirlPreset> = {
  // The hand-tuned Crash 2 portal base (electric rings), now with the three
  // things it was missing: rings visibly swallowed into the core (flow),
  // the bright pass additive over a solid body pass, and the palette
  // breathing pink<->blue down the short hue arc.
  // The hand-tuned Crash 2 portal (uploaded), plus the plasma band that the
  // footage's electric filaments needed: high-harmonic jag fraying the rings
  // and streak knots coursing along them.
  warpPortal: {
    blend: 'alpha', blendBright: 'add',
    radius: 4.35, rings: 14, segs: 48, depth: 1.8, billboard: true,
    arms: 0, twist: 6, flow: 0.232, current: 0.015,
    sharp: 1, filament: 0.961, glowWidth: 1,
    wobble: 0, wobbleScale: 0, wobbleRate: 0, edgeCrinkle: 0,
    jag: 0.9, jagScale: 7, jagRate: 2.2,
    streak: 0.55, streakScale: 4, streakRate: 2,
    core: 0.155, coreGlow: 4,
    mottle: 0, mottleScale: 0, mottleRate: 0,
    colCore: 0xffffff, colFil: 0x0062ff, colGlow: 0xff0000, colGround: 0x560094,
    colGround2: 0x4dff00, colRim: 0xff0000,
    colCoreB: 0xeafcff, colFilB: 0x2fb4ff, colGlowB: 0x2a50e0,
    cycleRate: 0.003,
    hueCycle: 0, alpha: 1, body: 1, rim: 0.609,
    spin: -3, pulse: 0, pulseRate: 0,
  },
  // The invincibility-mask backdrop: no filament, big soft blue bands.
  akuHalo: {
    blend: 'alpha', blendBright: 'add',
    radius: 4, rings: 8, segs: 24, billboard: true,
    arms: 0, twist: 1.4, flow: 0.05, sharp: 1.6, filament: 0.55, glowWidth: 0.85,
    wobble: 1.1, wobbleScale: 1.6, wobbleRate: 0.45, edgeCrinkle: 0.05,
    core: 0.3, coreGlow: 0.9,
    mottle: 0.65, mottleScale: 1.8, mottleRate: 0.35,
    colCore: 0xdff2ff, colFil: 0x9fc8ff, colGlow: 0x4a6fd8, colGround: 0x141e52,
    hueCycle: 0.06, alpha: 0.85, body: 0.9, rim: 0.45,
    spin: 0.1, pulse: 0.08, pulseRate: 0.9,
  },
  // A quiet green scenery eddy — fog circling a drain, for pits and vents.
  voidEddy: {
    blend: 'add', blendBright: 'add',
    radius: 2, rings: 7, segs: 22, billboard: false,
    arms: 2, twist: 1.8, flow: 0.08, sharp: 2.6, filament: 0.7, glowWidth: 0.7,
    wobble: 0.8, wobbleScale: 2.0, wobbleRate: 0.6, edgeCrinkle: 0.09,
    core: 0.14, coreGlow: 0.7,
    mottle: 0.5, mottleScale: 2.2, mottleRate: 0.4,
    colCore: 0xeaffe8, colFil: 0x9fe8a0, colGlow: 0x3f8a52, colGround: 0x12291c,
    hueCycle: 0, alpha: 0.7, body: 0.4, rim: 0.5,
    spin: -0.25, pulse: 0.1, pulseRate: 1.1,
  },
};

// ------------------------------------------------------------------ maths ---

function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const TAU = Math.PI * 2;
const MAX_RINGS = 14;
const MAX_SEGS = 48;

// Scratch palette, rebuilt once per swirl per frame — hue cycling and the
// A<->B breath happen HERE, on six colours, never per vertex.
const PAL = Array.from({ length: 6 }, () => new THREE.Color());
const HA = { h: 0, s: 0, l: 0 };
const HB = { h: 0, s: 0, l: 0 };
const C = new THREE.Color();

// The A<->B blend, in HSL down the SHORT hue arc: pink to blue goes through
// purple, never the long way round the rainbow.
function hslMix(out: THREE.Color, a: THREE.Color, b: THREE.Color, k: number): void {
  a.getHSL(HA);
  b.getHSL(HB);
  let dh = HB.h - HA.h;
  if (dh > 0.5) dh -= 1;
  else if (dh < -0.5) dh += 1;
  out.setHSL(
    (HA.h + dh * k + 1) % 1,
    HA.s + (HB.s - HA.s) * k,
    HA.l + (HB.l - HA.l) * k,
  );
}

// Palette slot order used throughout: core, fil, glow, ground, ground2, rim.
const SLOT_A = ['colCore', 'colFil', 'colGlow', 'colGround', 'colGround2', 'colRim'] as const;
const SLOT_DEF = [0xffffff, 0xffc0e8, 0xa050d0, 0x301848, -1, -1]; // -1 = derive from ground

export interface SwirlOpts {
  seed?: number;
  scale?: number;
}

export class Swirl {
  group = new THREE.Group();
  // TWO passes over the same grid: the BODY (ground + mottle + rim, usually
  // alpha so it occludes like the Crash portal) and the BRIGHT pass
  // (filament + glow + core, usually additive so it burns). Each has its own
  // blend mode; they share the position buffer so the disc is deformed once.
  private bodyMesh: THREE.Mesh;
  private bodyGeo: THREE.BufferGeometry;
  private bodyMat: THREE.MeshBasicMaterial;
  private brightMesh: THREE.Mesh;
  private brightGeo: THREE.BufferGeometry;
  private brightMat: THREE.MeshBasicMaterial;
  private preset: SwirlPreset = {};
  private t: number;
  private rings = 0;
  private segs = 0;
  // per-vertex statics
  private vr!: Float32Array; // radius fraction 0..1
  private va!: Float32Array; // angle
  private rng: () => number;
  private balA: THREE.Color[] = Array.from({ length: 6 }, () => new THREE.Color());
  private balB: (THREE.Color | null)[] = [null, null, null, null, null, null];

  constructor(preset: SwirlPreset, opts: SwirlOpts = {}) {
    this.rng = makeRng((opts.seed ?? 1) * 2654435761);
    this.t = this.rng() * 100; // each swirl starts somewhere else in the cycle
    const mkMat = (): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      // r166: a 4-component colour attribute gives per-vertex ALPHA, same
      // trick as the puffs.
      (m as unknown as { vertexAlphas: boolean }).vertexAlphas = true;
      return m;
    };
    this.bodyGeo = new THREE.BufferGeometry();
    this.brightGeo = new THREE.BufferGeometry();
    this.bodyMat = mkMat();
    this.brightMat = mkMat();
    this.bodyMesh = new THREE.Mesh(this.bodyGeo, this.bodyMat);
    this.brightMesh = new THREE.Mesh(this.brightGeo, this.brightMat);
    this.bodyMesh.frustumCulled = false;
    this.brightMesh.frustumCulled = false;
    this.bodyMesh.renderOrder = 2;
    this.brightMesh.renderOrder = 3; // the burn always sits on the body
    this.group.add(this.bodyMesh, this.brightMesh);
    if (opts.scale) this.group.scale.setScalar(opts.scale);
    this.setPreset(preset);
  }

  /** Swap or edit the recipe. Rebuilds the grid only when its size changed. */
  setPreset(p: SwirlPreset): void {
    const rings = Math.max(3, Math.min(MAX_RINGS, Math.round(p.rings ?? 8)));
    const segs = Math.max(8, Math.min(MAX_SEGS, Math.round(p.segs ?? 24)));
    if (rings !== this.rings || segs !== this.segs) this.buildGrid(rings, segs);
    this.preset = p;
    for (let i = 0; i < 6; i++) {
      const a = p[SLOT_A[i]];
      if (a !== undefined) this.balA[i].setHex(a);
      else if (SLOT_DEF[i] >= 0) this.balA[i].setHex(SLOT_DEF[i]);
      else {
        // derived defaults: ground2 = brighter ground, rim = darker ground
        const ground = p.colGround ?? 0x301848;
        this.balA[i].setHex(ground).multiplyScalar(i === 4 ? 1.45 : 0.4);
      }
      const b = p[(SLOT_A[i] + 'B') as keyof SwirlPreset] as number | undefined;
      if (b !== undefined) (this.balB[i] ??= new THREE.Color()).setHex(b);
      else this.balB[i] = null;
    }
    this.bodyMat.blending =
      (p.blend ?? 'alpha') === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.brightMat.blending =
      (p.blendBright ?? 'add') === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  private buildGrid(rings: number, segs: number): void {
    this.rings = rings;
    this.segs = segs;
    // rings + 1 SLIDING rings: they all drift radially with `flow` by up to
    // one cell before snapping back (see update), so the outermost lives
    // slightly PAST the rim — the disc edge never breathes as they slide.
    const nRings = rings + 1;
    const nVerts = 1 + nRings * segs;
    this.vr = new Float32Array(nVerts);
    this.va = new Float32Array(nVerts);
    // centre vertex is index 0; ring i vertex j is 1 + i*segs + j
    for (let i = 0; i < nRings; i++) {
      const rf = (i + 1) / rings;
      for (let j = 0; j < segs; j++) {
        const k = 1 + i * segs + j;
        this.vr[k] = rf;
        this.va[k] = (j / segs) * TAU;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segs));
    for (let i = 0; i < nRings - 1; i++)
      for (let j = 0; j < segs; j++) {
        const a = 1 + i * segs + j;
        const b = 1 + i * segs + ((j + 1) % segs);
        const c = a + segs;
        const d = b + segs;
        idx.push(a, c, b, b, c, d);
      }
    // ONE shared position buffer — the disc is deformed once, both passes
    // ride it. Colour buffers are per pass.
    const posAttr = new THREE.BufferAttribute(new Float32Array(nVerts * 3), 3);
    this.bodyGeo.setAttribute('position', posAttr);
    this.brightGeo.setAttribute('position', posAttr);
    this.bodyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nVerts * 4), 4));
    this.brightGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nVerts * 4), 4));
    this.bodyGeo.setIndex(idx);
    this.brightGeo.setIndex(idx);
  }

  update(dt: number, camera: THREE.Camera): void {
    const p = this.preset;
    this.t += dt;
    const t = this.t;
    // Spin is baked into the field's theta below, so billboarding and spinning
    // never fight over the same rotation.
    if (p.billboard ?? true) this.group.quaternion.copy(camera.quaternion);

    // Palette this frame: six colours, A breathed toward B down the short hue
    // arc, then (optionally) the whole set walked round the wheel.
    const mix = p.cycleRate ? 0.5 + 0.5 * Math.sin((p.cycleRate ?? 0) * t) : 0;
    const hue = (((p.hueCycle ?? 0) * t) / TAU) % 1;
    for (let i = 0; i < 6; i++) {
      const b = this.balB[i];
      if (b && mix > 0) hslMix(PAL[i], this.balA[i], b, mix);
      else PAL[i].copy(this.balA[i]);
      if (hue !== 0) PAL[i].offsetHSL(hue, 0, 0);
    }
    const P_CORE = PAL[0], P_FIL = PAL[1], P_GLOW = PAL[2];
    const P_GROUND = PAL[3], P_GROUND2 = PAL[4], P_RIM = PAL[5];
    // derived slots track the (possibly cycled) ground unless authored
    if (this.preset.colGround2 === undefined && !this.balB[4])
      P_GROUND2.copy(P_GROUND).multiplyScalar(1.45);
    if (this.preset.colRim === undefined && !this.balB[5])
      P_RIM.copy(P_GROUND).multiplyScalar(0.4);

    const R = p.radius ?? 3;
    const arms = Math.round(p.arms ?? 1);
    const twist = (p.twist ?? 2.5) * TAU;
    const flow = p.flow ?? 0;
    const current = p.current ?? 0;
    const sharp = p.sharp ?? 5;
    const filS = p.filament ?? 1.2;
    const glowW = Math.max(0.05, p.glowWidth ?? 0.5);
    const wob = p.wobble ?? 0.9;
    const wobS = (p.wobbleScale ?? 2) * TAU;
    const wobR = p.wobbleRate ?? 0.9;
    const coreSz = Math.max(0.02, p.core ?? 0.2);
    const coreG = p.coreGlow ?? 1.5;
    const mot = p.mottle ?? 0.5;
    const motS = p.mottleScale ?? 2.4;
    const motR = p.mottleRate ?? 0.5;
    const alpha = p.alpha ?? 0.9;
    const body = p.body ?? 0.35;
    const rim = p.rim ?? 0.55;
    const crin = p.edgeCrinkle ?? 0.06;
    const jag = p.jag ?? 0;
    const jagS = Math.max(1, Math.round(p.jagScale ?? 7));
    const jagS2 = Math.max(1, Math.round(jagS * 1.6) + 1);
    const jagR = p.jagRate ?? 2;
    const streak = clamp01(p.streak ?? 0);
    const strS = Math.max(1, Math.round(p.streakScale ?? 5));
    const strR = p.streakRate ?? 1.5;
    const depth = Math.max(0.2, p.depth ?? 1);
    const spin = (p.spin ?? 0) * t;
    const breathe = 1 + (p.pulse ?? 0) * Math.sin((p.pulseRate ?? 1.5) * t);

    const pos = this.bodyGeo.getAttribute('position') as THREE.BufferAttribute;
    const bodyCol = this.bodyGeo.getAttribute('color') as THREE.BufferAttribute;
    const brightCol = this.brightGeo.getAttribute('color') as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const oa = bodyCol.array as Float32Array;
    const ba = brightCol.array as Float32Array;
    const nV = 1 + (this.rings + 1) * this.segs;

    // THE SWALLOW. Every mesh ring slides inward together (f, the fraction
    // of a cell travelled so far); when they have covered exactly one cell
    // they snap back and the colour pattern's radial index (u) steps one ring
    // inward at the same instant. The two cancel exactly — ring i lands on
    // ring i+1's old radius carrying ring i+1's old colour — so the eye sees
    // rings travelling continuously into the core. Negative flow runs the
    // same machine outward. `current` scrolls only the colour field, the
    // pulse-without-motion effect kept from v2.
    const cell = 1 / this.rings;
    const scroll = t * flow;
    const flr = Math.floor(scroll / cell);
    const f = scroll - flr * cell; // [0, cell)
    const uShift = flr * cell;

    for (let k = 0; k < nV; k++) {
      const rl = k === 0 ? 0 : this.vr[k] - f; // linear radius, slid inward
      const u = (k === 0 ? 0 : this.vr[k]) + uShift; // pattern-space radius
      // DISPLAY radius: the depth curve bunches the ring gaps toward the
      // centre (tunnel foreshortening). Everything the eye reads — position,
      // ramps, fades — uses r; the travelling wave stays in linear space, so
      // the swallow's snap continuity is untouched.
      const r = depth === 1 ? rl : Math.pow(rl, depth);
      const th = this.va[k] + spin;
      // vertex position: flat disc, outer rings crinkled so the rim churns.
      // The crinkle phase lives in PATTERN space (u), so it rides the rings
      // through the snap instead of popping to a new shape.
      const crinkle =
        k === 0 ? 0 : crin * r * r * Math.sin(th * 3 + t * (wobR * 1.3) + u * 31);
      const rr = (r + crinkle) * R;
      pa[k * 3] = Math.cos(th) * rr;
      pa[k * 3 + 1] = Math.sin(th) * rr;
      pa[k * 3 + 2] = 0;

      // -- the field --
      // Two-sine wobble bends the spiral phase so the filament goes wispy.
      const bend =
        wob *
        (Math.sin(r * wobS + t * wobR + th * 2) * 0.6 +
          Math.sin(th * 3 - t * wobR * 1.7 + r * wobS * 1.6) * 0.4);
      // PLASMA: high-harmonic phase bend, light at the core and heavy at the
      // rim, seething on its own clock. Lives in pattern space (u) so the
      // kinks ride the rings through the swallow's snap.
      const jagBend = jag
        ? jag * (0.4 + 0.6 * r) *
          (Math.sin(th * jagS + t * jagR + u * 53) * 0.6 +
            Math.sin(th * jagS2 - t * jagR * 1.6 + u * 91) * 0.4)
        : 0;
      // The spiral phase reads the PATTERN-space radius (u): between snaps
      // each ring keeps its colour and physically carries it inward.
      // `current` pours extra phase through on top — the ghost pulse.
      const phase = th * arms + (u + t * current) * twist + bend + jagBend;
      const wave = 0.5 + 0.5 * Math.sin(phase);
      let filament = Math.pow(wave, sharp) * filS;
      let glow = Math.pow(wave, Math.max(1, sharp * glowW * 0.5));
      if (streak) {
        // knots of energy coursing along the line — never fully dark
        const m = 0.5 + 0.5 * Math.sin(th * strS + u * 23 - t * strR);
        filament *= 1 - streak * m;
        glow *= 1 - streak * 0.6 * m;
      }
      // Mottled backing: one slow sine field in (r, theta, t).
      const g =
        0.5 +
        0.5 * Math.sin(r * motS * TAU * 0.5 + th * 2 - t * motR) * Math.sin(th * 3 + t * motR * 0.7 + r * 5);
      // Hot core blob.
      const coreI = coreG * Math.pow(Math.max(0, 1 - r / coreSz), 1.5);

      const bright = breathe * (1 + coreI * 0.3);
      // Rim fade: intensity walks to zero from `rim` out to the edge.
      const fade = r < rim ? 1 : clamp01(1 - (r - rim) / (1 - rim));

      // -- BODY pass: ground mottled toward ground2, tinted to rim colour
      // at the edge. `body` is its opacity — 1 + alpha blend = the solid
      // cloudy disc that occludes the room behind the Crash portal.
      C.copy(P_GROUND).lerp(P_GROUND2, clamp01(mot * g));
      const rimK = rim < 1 ? clamp01((r - rim * 0.55) / (1 - rim * 0.55)) : 0;
      C.lerp(P_RIM, rimK * 0.85);
      oa[k * 4] = C.r * breathe;
      oa[k * 4 + 1] = C.g * breathe;
      oa[k * 4 + 2] = C.b * breathe;
      oa[k * 4 + 3] = clamp01(alpha * body * fade * fade);

      // -- BRIGHT pass: glow -> filament -> core-white, black where quiet
      // (black is invisible under additive; under alpha its own alpha dies).
      const fil01 = clamp01(filament);
      C.setRGB(0, 0, 0);
      C.lerp(P_GLOW, clamp01(glow * 0.8));
      C.lerp(P_FIL, fil01);
      C.lerp(P_CORE, clamp01(filament * filament * 0.6 + coreI));
      ba[k * 4] = C.r * bright;
      ba[k * 4 + 1] = C.g * bright;
      ba[k * 4 + 2] = C.b * bright;
      ba[k * 4 + 3] = clamp01(alpha * fade * fade * clamp01(glow * 0.5 + filament + coreI));
    }
    pos.needsUpdate = true;
    bodyCol.needsUpdate = true;
    brightCol.needsUpdate = true;
  }

  dispose(): void {
    this.bodyGeo.dispose();
    this.brightGeo.dispose();
    this.bodyMat.dispose();
    this.brightMat.dispose();
  }
}

// ----------------------------------------------------------------- system ---

class SwirlSystem {
  private scene: THREE.Scene | null = null;
  private live: Swirl[] = [];
  private seedCounter = 1;

  attach(scene: THREE.Scene): void {
    this.scene = scene;
    for (const s of this.live) scene.add(s.group);
  }

  spawn(preset: SwirlPreset | string, x: number, y: number, z: number, opts: SwirlOpts = {}): Swirl {
    const p = typeof preset === 'string' ? SWIRL_PRESETS[preset] : preset;
    const s = new Swirl(p ?? SWIRL_PRESETS.warpPortal, {
      seed: opts.seed ?? this.seedCounter++,
      ...opts,
    });
    s.group.position.set(x, y, z);
    this.live.push(s);
    this.scene?.add(s.group);
    return s;
  }

  remove(s: Swirl): void {
    const i = this.live.indexOf(s);
    if (i >= 0) this.live.splice(i, 1);
    this.scene?.remove(s.group);
    s.dispose();
  }

  clear(): void {
    for (const s of this.live) {
      this.scene?.remove(s.group);
      s.dispose();
    }
    this.live.length = 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    for (const s of this.live) s.update(dt, camera);
  }

  get count(): number {
    return this.live.length;
  }
}

export const swirls = new SwirlSystem();
