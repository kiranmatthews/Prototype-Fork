// SWIRLS — the Crash wormhole, rebuilt on the RIGHT primitive.
//
// Seven rounds of tuning proved the old approach wrong at the root: it drew
// every visible ring from one continuous radial sine (phase = r*twist + ...),
// which forces all bands to share one spacing system, one profile and one
// deformation field — a music visualizer, structurally, no matter the knobs.
//
// The footage is not a spiral, not a tunnel, not a repeating field. It is:
//   1. one opaque cloudy circular backing, fading to near-black at the rim,
//   2. THREE INDEPENDENT luminous closed rings, each its own misshapen
//      contour — big slow bulges shared between neighbours, small
//      irregularities their own,
//   3. one broad hot central disc (8-12% of the portal, not a pinprick),
//   4. one loose pale outer halo,
//   5. the whole palette breathing warm<->cool together, backing included.
//
// Construction, PS1 rules: every luminous ring is its own annular Gouraud
// strip of five radial rows — black edge / glow / white-hot line / glow /
// black edge — drawn additively, so the black rows contribute nothing and
// the hardware's vertex interpolation IS the soft falloff. No textures, no
// shaders, no per-fragment anything. Ring base radii are stable (a breath of
// a percent or two at most): contours RESHAPE, they do not rotate like
// wheels or pour into the centre.
import * as THREE from 'three';

/** Flat preset: three rings (r1/r2/r3), core, halo, backing, two palettes. */
export interface SwirlPreset {
  radius?: number; // world radius of the whole portal
  segs?: number; // angular segments (the reference budget is 24)
  billboard?: boolean;

  // --- shared deformation: the big slow bulges every ring rides together ---
  sharedLow?: number; // 2-lobe amplitude, fraction of portal radius
  sharedLowRate?: number;
  sharedMid?: number; // 3-lobe amplitude
  sharedMidRate?: number;
  breathe?: number; // whole-ring radius breathing, capped at 2% — rings hold station
  breatheRate?: number;

  // --- the luminous rings: ONE set of controls, a variable count, and a
  // seeded spread so every ring comes out different without per-ring sliders.
  // Rings live evenly spaced in the lane [ringInner, ringOuter]; `vary`
  // scatters their widths, brightness, spacing and wave character from
  // `seed` — reroll the seed, get a new family.
  ringCount?: number; // 1..8
  ringInner?: number; // centre of the innermost ring's lane slot
  ringOuter?: number; // centre of the outermost
  ringLine?: number; // base line half-width (fraction of portal radius)
  ringGlow?: number; // base glow half-width
  ringBright?: number;
  vary?: number; // 0..1 seeded per-ring differences
  seed?: number; // reroll the family
  // shape waves, applied per-ring with seeded variation:
  wavyAmp?: number; // low-frequency waviness (3-6 lobes)
  wavyFreq?: number;
  wavyRate?: number;
  jagAmp?: number; // high-frequency jaggedness (7-14 lobes), runs backwards
  jagFreq?: number;
  jagRate?: number;
  depth?: number; // tunnel foreshortening: ring lane radius -> r^depth, so
  // the gaps bunch toward the centre and swallowed rings decelerate into it

  // --- the hot centre: nested Gouraud discs, white -> pale -> nothing ---
  coreRadius?: number; // the clearly-hot region, ~0.08-0.12
  coreSoft?: number; // where its glow dies to nothing
  coreBright?: number;

  // --- the loose pale outer halo ---
  haloRadius?: number;
  haloWidth?: number;
  haloAlpha?: number; // 0 = no halo

  // --- the cloudy backing (its own opaque polar mesh, NOT the ring geometry) ---
  backingAlpha?: number; // 1 = solid, occludes the room behind
  backingRim?: number; // where the fade-to-black begins, fraction of radius
  backingFade?: number; // 1 = the rim also fades to TRANSPARENT (floats nicely
  // in open scenes); 0 = solid near-black to the edge, the reference's own
  // behaviour, for when foreground geometry covers the rim
  cloudAmp?: number; // how strongly the two slow fields mottle it
  cloudRate?: number;

  // --- reintroduced motion (all default 0 — the reference portal is static) ---
  spin?: number; // rad/s whole-portal rotation of geometry + contours
  spinDiff?: number; // extra rad/s at the centre, fading to zero at the rim
  swallow?: number; // radius-fractions/sec the ring BASES travel inward (+):
  // a ring that reaches the core fades out and is reborn at the rim, cross-
  // fading through a short envelope so there is no pop
  swallowTo?: number; // how DEEP the conveyor runs: rings travel to this
  // radius before dying — default 0.04, inside the hot core, so a ring is
  // visibly swallowed all the way to the middle
  swallowFrom?: number; // where newborn rings fade in — default 0.9, well
  // OUTSIDE the outer lane slot, so they arrive early and travel in
  current?: number; // 0..1 brightness wave pouring radially through the bands
  currentRate?: number; // rad/s; + pours toward the core
  pulse?: number; // whole-portal brightness breathing 0..1
  pulseRate?: number;

  // --- palette: the WHOLE set lerps warm<->cool together, backing included ---
  warmCore?: number; warmLine?: number; warmGlow?: number;
  warmHalo?: number; warmGround?: number; warmRim?: number;
  coolCore?: number; coolLine?: number; coolGlow?: number;
  coolHalo?: number; coolGround?: number; coolRim?: number;
  cycleRate?: number; // rad/s; warm->cool->warm period = 2pi/rate

  alpha?: number; // master opacity
}

export const SWIRL_PRESETS: Record<string, SwirlPreset> = {
  // The Crash 2 wormhole per the reference: three independent irregular
  // rings, broad hot centre, cloudy backing, fast warm/cool palette breath.
  // The hand-tuned Crash 2 wormhole (uploaded), on the extended swallow
  // corridor: rings are born out at 0.9, cross every lane slot, and die at
  // 0.04 — inside the hot core — so the loop reads as an endless swallow.
  warpPortal: {
    radius: 4.4, segs: 48, billboard: true,
    sharedLow: 0.008, sharedLowRate: 4, sharedMid: 0.008, sharedMidRate: 0.991,
    breathe: 0.015, breatheRate: 1.1,
    ringCount: 5, ringInner: 0.15, ringOuter: 0.56,
    ringLine: 0.021, ringGlow: 0.064, ringBright: 1,
    vary: 0.014, seed: 62,
    wavyAmp: 0.012, wavyFreq: 5, wavyRate: 3.57,
    jagAmp: 0.019, jagFreq: 16, jagRate: 8,
    depth: 1.26, swallowTo: 0.04, swallowFrom: 0.989,
    coreRadius: 0.035, coreSoft: 0.235, coreBright: 2.5,
    haloRadius: 0.586, haloWidth: 0.303, haloAlpha: 0.265,
    backingAlpha: 1, backingRim: 0.2, backingFade: 1, cloudAmp: 0.5, cloudRate: 0.5,
    warmCore: 0xffffff, warmLine: 0xfff1da, warmGlow: 0xff6260,
    warmHalo: 0xc06c67, warmGround: 0x35152c, warmRim: 0x080716,
    coolCore: 0xffffff, coolLine: 0xd8f4ff, coolGlow: 0x668dff,
    coolHalo: 0x83a6ad, coolGround: 0x09184c, coolRim: 0x050817,
    cycleRate: 3.7, alpha: 1,
    swallow: 0.207, spin: -0.561, spinDiff: 0,
    current: 0, currentRate: -8, pulse: 0, pulseRate: 0,
  },
  // The invincibility-mask backdrop: one broad soft ring over deep blue,
  // near-static palette.
  akuHalo: {
    radius: 4, segs: 24, billboard: true,
    sharedLow: 0.012, sharedLowRate: 0.4, sharedMid: 0.008, sharedMidRate: 0.25,
    breathe: 0.015, breatheRate: 0.7,
    ringCount: 1, ringInner: 0.42, ringOuter: 0.42,
    ringLine: 0.05, ringGlow: 0.2, ringBright: 0.7,
    vary: 0, seed: 1,
    wavyAmp: 0.012, wavyFreq: 4, wavyRate: 0.6,
    jagAmp: 0.005, jagFreq: 7, jagRate: 1.0,
    depth: 1, swallowTo: 0.04, swallowFrom: 0.9,
    coreRadius: 0.2, coreSoft: 0.42, coreBright: 0.8,
    haloRadius: 0.75, haloWidth: 0.16, haloAlpha: 0.35,
    backingAlpha: 0.9, backingRim: 0.5, cloudAmp: 0.7, cloudRate: 0.35,
    warmCore: 0xdff2ff, warmLine: 0xbfe2ff, warmGlow: 0x4a6fd8,
    warmHalo: 0x3a5aa8, warmGround: 0x101a48, warmRim: 0x040714,
    coolCore: 0xeaf8ff, coolLine: 0x9fc8ff, coolGlow: 0x3a5fd0,
    coolHalo: 0x315097, coolGround: 0x0c1540, coolRim: 0x030610,
    cycleRate: 0.4,
    alpha: 0.9,
  },
  // A quiet green scenery eddy for pits and vents: two thin rings, no halo.
  voidEddy: {
    radius: 2, segs: 24, billboard: false,
    sharedLow: 0.01, sharedLowRate: 0.5, sharedMid: 0.006, sharedMidRate: 0.3,
    breathe: 0.01, breatheRate: 0.9,
    ringCount: 2, ringInner: 0.28, ringOuter: 0.55,
    ringLine: 0.015, ringGlow: 0.065, ringBright: 0.75,
    vary: 0.4, seed: 3,
    wavyAmp: 0.01, wavyFreq: 5, wavyRate: 0.8,
    jagAmp: 0.007, jagFreq: 8, jagRate: 1.2,
    depth: 1, swallowTo: 0.04, swallowFrom: 0.9,
    coreRadius: 0.09, coreSoft: 0.16, coreBright: 0.7,
    haloRadius: 0.8, haloWidth: 0.1, haloAlpha: 0,
    backingAlpha: 0.55, backingRim: 0.5, cloudAmp: 0.6, cloudRate: 0.4,
    warmCore: 0xeaffe8, warmLine: 0xc8f0c0, warmGlow: 0x3f8a52,
    warmHalo: 0x2e6b40, warmGround: 0x0e2416, warmRim: 0x030a05,
    coolCore: 0xf0fff0, coolLine: 0x9fe8a0, coolGlow: 0x2f7a45,
    coolHalo: 0x255c36, coolGround: 0x0a1c11, coolRim: 0x020703,
    cycleRate: 0.5,
    alpha: 0.8,
  },
};

// ------------------------------------------------------------------ maths ---

const TAU = Math.PI * 2;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// Palette slots, warm/cool pairs lerped together every frame.
const PAL_KEYS = ['Core', 'Line', 'Glow', 'Halo', 'Ground', 'Rim'] as const;
const PAL_DEF_WARM = [0xffffff, 0xfff1da, 0xff6260, 0xc06c67, 0x35152c, 0x080716];
const PAL_DEF_COOL = [0xffffff, 0xd8f4ff, 0x668dff, 0x83a6ad, 0x09184c, 0x050817];
const PAL = Array.from({ length: 6 }, () => new THREE.Color());
const C = new THREE.Color();
const SHARED: number[] = new Array(48).fill(0);
// hot-loop scratch — the inner vertex loops must not allocate
const RING_OFFR = [0, 0, 0, 0, 0];
const HALO_OFFR = [0, 0, 0];
const CORE_RR = [0, 0, 0];

function setVert(
  pa: Float32Array, ca: Float32Array, k: number, x: number, y: number,
  cr: number, cg: number, cb: number, a: number,
): void {
  pa[k * 3] = x; pa[k * 3 + 1] = y; pa[k * 3 + 2] = 0;
  ca[k * 4] = cr; ca[k * 4 + 1] = cg; ca[k * 4 + 2] = cb; ca[k * 4 + 3] = a;
}

// Deterministic per-ring variation: a tiny hash of (seed, ring, channel)
// gives each ring stable private numbers — same seed, same family, every
// run, which is what reference matching and a seamless loop both need.
function ringHash(seed: number, i: number, k: number): number {
  let h = (seed * 374761393 + i * 668265263 + k * 2246822519) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177) >>> 0;
  h ^= h >>> 16;
  return h / 4294967296;
}
const MAX_RINGCOUNT = 8;

export interface SwirlOpts {
  seed?: number; // kept for API compatibility; only offsets the start time
  scale?: number;
}

// Additive-mesh layout (all row counts x segs):
//   core:  1 centre + 3 rows  (white edge, pale mid, dark edge)
//   rings: 3 strips x 5 rows  (black, glow, LINE, glow, black)
//   halo:  3 rows             (black, halo colour, black)
const CORE_ROWS = 3;
const RING_ROWS = 5;
const HALO_ROWS = 3;
const BACK_ROWS = 6;
const BACK_R = [0.18, 0.36, 0.54, 0.7, 0.85, 1.0];

export class Swirl {
  group = new THREE.Group();
  /** True freeze: time stops and buffers hold, but billboarding stays live
   * and preset edits still repaint once (dirty) — a frozen frame you can
   * keep tuning against the reference overlay. */
  paused = false;
  private dirty = true;
  private preset: SwirlPreset = {};
  private t: number;
  private segs = 0;
  private nRings = 0;
  private backGeo: THREE.BufferGeometry;
  private backMat: THREE.MeshBasicMaterial;
  private backMesh: THREE.Mesh;
  private addGeo: THREE.BufferGeometry;
  private addMat: THREE.MeshBasicMaterial;
  private addMesh: THREE.Mesh;
  private warm: THREE.Color[] = Array.from({ length: 6 }, () => new THREE.Color());
  private cool: THREE.Color[] = Array.from({ length: 6 }, () => new THREE.Color());

  constructor(preset: SwirlPreset, opts: SwirlOpts = {}) {
    this.t = ((opts.seed ?? 1) % 97) * 0.37; // spread instances along the cycle
    const mk = (blending: THREE.Blending): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending,
      });
      // r166: a 4-component colour attribute = per-vertex alpha (as in puffs)
      (m as unknown as { vertexAlphas: boolean }).vertexAlphas = true;
      return m;
    };
    this.backGeo = new THREE.BufferGeometry();
    this.addGeo = new THREE.BufferGeometry();
    this.backMat = mk(THREE.NormalBlending);
    this.addMat = mk(THREE.AdditiveBlending);
    this.backMesh = new THREE.Mesh(this.backGeo, this.backMat);
    this.addMesh = new THREE.Mesh(this.addGeo, this.addMat);
    this.backMesh.frustumCulled = false;
    this.addMesh.frustumCulled = false;
    this.backMesh.renderOrder = 2;
    this.addMesh.renderOrder = 3;
    this.backMesh.position.z = -0.02; // the glow always sits on the cloud
    this.group.add(this.backMesh, this.addMesh);
    if (opts.scale) this.group.scale.setScalar(opts.scale);
    this.setPreset(preset);
  }

  setPreset(p: SwirlPreset): void {
    const segs = Math.max(8, Math.min(48, Math.round(p.segs ?? 24)));
    const nRings = Math.max(1, Math.min(MAX_RINGCOUNT, Math.round(p.ringCount ?? 3)));
    if (segs !== this.segs || nRings !== this.nRings) this.build(segs, nRings);
    this.preset = p;
    this.dirty = true; // repaint once even while frozen — edits must show
    for (let i = 0; i < 6; i++) {
      this.warm[i].setHex((p[`warm${PAL_KEYS[i]}` as keyof SwirlPreset] as number) ?? PAL_DEF_WARM[i]);
      this.cool[i].setHex((p[`cool${PAL_KEYS[i]}` as keyof SwirlPreset] as number) ?? PAL_DEF_COOL[i]);
    }
  }

  private build(segs: number, nRings: number): void {
    this.segs = segs;
    this.nRings = nRings;
    // --- backing: centre + rows ---
    const nBack = 1 + BACK_ROWS * segs;
    this.backGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nBack * 3), 3));
    this.backGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nBack * 4), 4));
    const bIdx: number[] = [];
    for (let j = 0; j < segs; j++) bIdx.push(0, 1 + j, 1 + ((j + 1) % segs));
    for (let r = 0; r < BACK_ROWS - 1; r++)
      for (let j = 0; j < segs; j++) {
        const a = 1 + r * segs + j;
        const b = 1 + r * segs + ((j + 1) % segs);
        bIdx.push(a, a + segs, b, b, a + segs, b + segs);
      }
    this.backGeo.setIndex(bIdx);

    // --- additive: core + ring strips + halo ---
    const nAdd = 1 + (CORE_ROWS + nRings * RING_ROWS + HALO_ROWS) * segs;
    this.addGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nAdd * 3), 3));
    this.addGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nAdd * 4), 4));
    const aIdx: number[] = [];
    for (let j = 0; j < segs; j++) aIdx.push(0, 1 + j, 1 + ((j + 1) % segs));
    const band = (base: number, rows: number): void => {
      for (let r = 0; r < rows - 1; r++)
        for (let j = 0; j < segs; j++) {
          const a = base + r * segs + j;
          const b = base + r * segs + ((j + 1) % segs);
          aIdx.push(a, a + segs, b, b, a + segs, b + segs);
        }
    };
    band(1, CORE_ROWS);
    for (let s = 0; s < nRings; s++) band(1 + CORE_ROWS * segs + s * RING_ROWS * segs, RING_ROWS);
    band(1 + CORE_ROWS * segs + nRings * RING_ROWS * segs, HALO_ROWS);
    this.addGeo.setIndex(aIdx);
  }

  update(dt: number, camera: THREE.Camera): void {
    const p = this.preset;
    // Billboarding lives OUTSIDE the freeze: the studio keeps repositioning
    // the preview, and a frozen portal must keep facing the lens.
    if (p.billboard ?? true) this.group.quaternion.copy(camera.quaternion);
    if (this.paused && !this.dirty) return; // frozen and clean: hold the frame
    if (!this.paused) this.t += dt;
    this.dirty = false;
    const t = this.t;

    // --- the whole palette breathes warm<->cool together, in plain RGB ---
    const mix = 0.5 + 0.5 * Math.sin((p.cycleRate ?? 3.7) * t);
    for (let i = 0; i < 6; i++) PAL[i].copy(this.warm[i]).lerp(this.cool[i], mix);
    const pCore = PAL[0], pLine = PAL[1], pGlow = PAL[2];
    const pHalo = PAL[3], pGround = PAL[4], pRim = PAL[5];

    const R = p.radius ?? 4.4;
    const S = this.segs;
    const alpha = p.alpha ?? 1;
    const sLo = p.sharedLow ?? 0.007;
    const sLoR = p.sharedLowRate ?? 0.8;
    const sMi = p.sharedMid ?? 0.005;
    const sMiR = p.sharedMidRate ?? 0.45;
    const brA = Math.min(0.02, p.breathe ?? 0.012); // capped: rings hold station
    const breath = 1 + brA * Math.sin(t * (p.breatheRate ?? 1.1));
    const spin = p.spin ?? 0;
    const spinDiff = p.spinDiff ?? 0;
    const swallow = p.swallow ?? 0;
    const curAmp = p.current ?? 0;
    const curRate = p.currentRate ?? 2;
    const pulseB = 1 + (p.pulse ?? 0) * 0.4 * Math.sin(t * (p.pulseRate ?? 2));
    // brightness wave pouring through the bands; + rate runs toward the core
    const cur = (rf: number): number =>
      curAmp === 0 ? 1 : Math.max(0, 1 + curAmp * Math.sin(rf * TAU * 2 + t * curRate));
    const bandAngle = (rf: number): number => t * (spin + spinDiff * (1 - rf));

    // the shared bulges, once per segment, reused by every band
    for (let j = 0; j < S; j++) {
      const th = (j / S) * TAU;
      SHARED[j] = sLo * Math.sin(th * 2 + t * sLoR) + sMi * Math.sin(th * 3 - t * sMiR);
    }

    // ---------------------------------------------------------- backing ---
    {
      const pos = this.backGeo.getAttribute('position') as THREE.BufferAttribute;
      const col = this.backGeo.getAttribute('color') as THREE.BufferAttribute;
      const pa = pos.array as Float32Array;
      const ca = col.array as Float32Array;
      const bAlpha = p.backingAlpha ?? 1;
      const bRim = Math.min(0.95, p.backingRim ?? 0.6);
      const bFade = p.backingFade ?? 1;
      const cAmp = p.cloudAmp ?? 0.5;
      const cRate = p.cloudRate ?? 0.5;
      pa[0] = 0; pa[1] = 0; pa[2] = 0;
      C.copy(pGround).multiplyScalar(1.15);
      ca[0] = C.r; ca[1] = C.g; ca[2] = C.b; ca[3] = clamp01(bAlpha * alpha);
      for (let r = 0; r < BACK_ROWS; r++) {
        const rf = BACK_R[r];
        const spinTh = bandAngle(rf);
        for (let j = 0; j < S; j++) {
          const k = 1 + r * S + j;
          const th = (j / S) * TAU + spinTh;
          const rr = (rf + SHARED[j] * rf) * R;
          pa[k * 3] = Math.cos(th) * rr;
          pa[k * 3 + 1] = Math.sin(th) * rr;
          pa[k * 3 + 2] = 0;
          // two slow low-frequency fields evolve the cloud
          const g =
            0.5 +
            0.5 *
              Math.sin(th * 2 + t * cRate + rf * 3.1) *
              Math.sin(th * 3 - t * cRate * 0.63 + rf * 5.7);
          C.copy(pGround).multiplyScalar(0.75 + cAmp * 0.7 * g);
          const rimK = rf <= bRim ? 0 : (rf - bRim) / (1 - bRim);
          C.lerp(pRim, rimK);
          ca[k * 4] = C.r;
          ca[k * 4 + 1] = C.g;
          ca[k * 4 + 2] = C.b;
          ca[k * 4 + 3] = clamp01(bAlpha * alpha * (1 - rimK * rimK * bFade));
        }
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }

    // --------------------------------------------------------- additive ---
    const pos = this.addGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.addGeo.getAttribute('color') as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;

    // core: white centre + white edge + pale mid + additive-zero edge —
    // clearly visible, roughly a tenth of the portal, per the footage
    const coreR = Math.max(0.02, p.coreRadius ?? 0.1);
    const coreSoft = Math.max(coreR + 0.02, p.coreSoft ?? 0.17);
    const coreB = (p.coreBright ?? 1.2) * pulseB;
    setVert(pa, ca, 0, 0, 0, pCore.r * coreB, pCore.g * coreB, pCore.b * coreB, alpha);
    CORE_RR[0] = coreR * 0.55; CORE_RR[1] = coreR; CORE_RR[2] = coreSoft;
    for (let r = 0; r < CORE_ROWS; r++) {
      const spinTh = bandAngle(CORE_RR[r]);
      for (let j = 0; j < S; j++) {
        const k = 1 + r * S + j;
        const th = (j / S) * TAU + spinTh;
        const rr = (CORE_RR[r] + SHARED[j] * 0.5) * R * breath;
        const x = Math.cos(th) * rr;
        const y = Math.sin(th) * rr;
        if (r === 0) setVert(pa, ca, k, x, y, pCore.r * coreB, pCore.g * coreB, pCore.b * coreB, alpha);
        else if (r === 1) {
          C.copy(pLine).lerp(pGlow, 0.35).multiplyScalar(coreB * 0.8);
          setVert(pa, ca, k, x, y, C.r, C.g, C.b, alpha * 0.9);
        } else setVert(pa, ca, k, x, y, 0, 0, 0, 0);
      }
    }

    // the three rings: black / glow / LINE / glow / black. ONE displacement
    // per (ring, segment), shared by all five rows, so the band's thickness
    // stays coherent while its contour misshapes.
    // -- THE RING LANE, a seamless conveyor -------------------------------
    // Rings sit evenly spaced in [ringInner, ringOuter]; swallow slides them
    // all down the lane together and wraps — a ring fading out at the inner
    // edge is the SAME ring fading in at the outer edge, and because spacing
    // is uniform the supply never bunches or gaps: the loop has no seam and
    // no start. `vary` scatters spacing/width/brightness/waves per ring from
    // the seed, and each ring KEEPS its character through the wrap.
    const nR = this.nRings;
    const lane0 = Math.max(0.03, p.ringInner ?? 0.1);
    const lane1 = Math.max(lane0, p.ringOuter ?? 0.56);
    const laneSpan = Math.max(0.02, lane1 - lane0);
    const step = laneSpan / nR;
    const lineW0 = p.ringLine ?? 0.022;
    const glowW0 = p.ringGlow ?? 0.082;
    const bright0 = p.ringBright ?? 1;
    const vary = p.vary ?? 0.5;
    const seed = Math.round(p.seed ?? 1);
    const wavyA = p.wavyAmp ?? 0.01;
    const wavyF = p.wavyFreq ?? 5;
    const wavyR = p.wavyRate ?? 1.3;
    const jagA = p.jagAmp ?? 0.009;
    const jagF = p.jagFreq ?? 9;
    const jagR = p.jagRate ?? 2.4;
    const depth = Math.max(0.2, p.depth ?? 1);
    for (let s = 0; s < nR; s++) {
      const base = 1 + CORE_ROWS * S + s * RING_ROWS * S;
      // seeded per-ring character (cheap: eight hashes per ring per frame)
      const v = (k: number): number => (ringHash(seed, s, k) - 0.5) * 2 * vary;
      const slot = nR === 1 ? (lane0 + lane1) / 2 : lane0 + (s + 0.5) * step + v(12) * 0.25 * step;
      const freqA = Math.max(1, Math.round(wavyF * (1 + 0.4 * v(1))));
      const freqB = Math.max(2, Math.round(jagF * (1 + 0.35 * v(2))));
      const phA = ringHash(seed, s, 3) * TAU;
      const phB = ringHash(seed, s, 4) * TAU;
      const ampA = wavyA * (1 + 0.7 * v(5));
      const ampB = jagA * (1 + 0.7 * v(6));
      const rateA = wavyR * (0.75 + 0.5 * ringHash(seed, s, 7));
      const rateB = jagR * (0.75 + 0.5 * ringHash(seed, s, 8));
      const lineW = lineW0 * (1 + 0.5 * v(9));
      const glowW = glowW0 * (1 + 0.5 * v(10));
      // THE CONVEYOR. When the swallow runs, the travel corridor is WIDER
      // than the resting lane: it starts outside the outermost slot
      // (swallowFrom) and runs deep into the hot core (swallowTo), so a ring
      // is born early out by the rim, crosses every lane position, and is
      // visibly swallowed all the way to the middle — dying inside the core
      // glow, which masks its fade. Uniform spacing over the whole corridor
      // keeps the supply endless: one is always being born as one dies.
      let laneR = slot;
      let env = 1;
      if (swallow !== 0) {
        const swTo = Math.max(0.01, p.swallowTo ?? 0.04);
        const swFrom = Math.max(lane1 + 0.1, Math.min(1.1, p.swallowFrom ?? 0.9));
        const tSpan = swFrom - swTo;
        const tStep = tSpan / nR;
        const slotT = swTo + (s + 0.5) * tStep + v(12) * 0.25 * tStep;
        let w = (slotT - swTo - t * swallow) % tSpan;
        if (w < 0) w += tSpan;
        laneR = swTo + w;
        // asymmetric fades: birth out past the rim, death deep in the core
        const birth = clamp01((tSpan - w) / (tStep * 0.35));
        const death = clamp01(w / (tStep * 0.4));
        env = Math.min(birth, death);
      }
      // tunnel depth: the DISPLAYED radius is laneR^depth, and widths scale
      // by the curve's local derivative so inner rings thin out as they
      // crowd — swallowed rings visibly decelerate into the hole
      const dispR = depth === 1 ? laneR : Math.pow(laneR, depth);
      const wScale = depth === 1 ? 1 : Math.min(1.8, Math.max(0.25, depth * Math.pow(laneR, depth - 1)));
      const bright = bright0 * (1 + 0.4 * v(11)) * env * cur(dispR) * pulseB;
      const spinTh = bandAngle(dispR);
      RING_OFFR[0] = -glowW * wScale * R;
      RING_OFFR[1] = -lineW * wScale * R;
      RING_OFFR[2] = 0;
      RING_OFFR[3] = lineW * wScale * R;
      RING_OFFR[4] = glowW * wScale * R;
      for (let j = 0; j < S; j++) {
        const th = (j / S) * TAU + spinTh;
        const local =
          ampA * Math.sin(th * freqA + phA + t * rateA) +
          ampB * Math.sin(th * freqB + phB - t * rateB);
        const mid = (dispR * breath + SHARED[j] + local) * R;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        for (let r = 0; r < RING_ROWS; r++) {
          const k = base + r * S + j;
          const rr = Math.max(0.01, mid + RING_OFFR[r]);
          if (r === 2)
            setVert(pa, ca, k, cs * rr, sn * rr,
              pLine.r * bright, pLine.g * bright, pLine.b * bright, alpha);
          else if (r === 1 || r === 3) {
            C.copy(pGlow).multiplyScalar(bright * 0.85);
            setVert(pa, ca, k, cs * rr, sn * rr, C.r, C.g, C.b, alpha * 0.85);
          } else setVert(pa, ca, k, cs * rr, sn * rr, 0, 0, 0, 0);
        }
      }
    }

    // halo: loose, pale, slow — black / halo colour / black
    {
      const base = 1 + CORE_ROWS * S + this.nRings * RING_ROWS * S;
      const hR = p.haloRadius ?? 0.69;
      const hW = p.haloWidth ?? 0.1;
      const hA = (p.haloAlpha ?? 0.5) * alpha * cur(hR);
      const hB = pulseB;
      const spinTh = bandAngle(hR);
      HALO_OFFR[0] = -hW * R; HALO_OFFR[1] = 0; HALO_OFFR[2] = hW * R;
      for (let j = 0; j < S; j++) {
        const th = (j / S) * TAU + spinTh;
        const wob = 0.02 * Math.sin(th * 4 + t * 0.5) + SHARED[j];
        const mid = (hR + wob) * R * breath;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        for (let r = 0; r < HALO_ROWS; r++) {
          const k = base + r * S + j;
          const rr = Math.max(0.01, mid + HALO_OFFR[r]);
          if (r === 1) setVert(pa, ca, k, cs * rr, sn * rr, pHalo.r * hB, pHalo.g * hB, pHalo.b * hB, hA);
          else setVert(pa, ca, k, cs * rr, sn * rr, 0, 0, 0, 0);
        }
      }
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  dispose(): void {
    this.backGeo.dispose();
    this.addGeo.dispose();
    this.backMat.dispose();
    this.addMat.dispose();
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
