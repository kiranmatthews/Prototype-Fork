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

  // --- the three luminous rings (radius 0 = ring off) ---
  // Each: base radius, line half-width, glow half-width (all fractions of
  // portal radius), brightness, and two private deformation waves.
  r1Radius?: number; r1Line?: number; r1Glow?: number; r1Bright?: number;
  r1AmpA?: number; r1FreqA?: number; r1RateA?: number;
  r1AmpB?: number; r1FreqB?: number; r1RateB?: number;
  r2Radius?: number; r2Line?: number; r2Glow?: number; r2Bright?: number;
  r2AmpA?: number; r2FreqA?: number; r2RateA?: number;
  r2AmpB?: number; r2FreqB?: number; r2RateB?: number;
  r3Radius?: number; r3Line?: number; r3Glow?: number; r3Bright?: number;
  r3AmpA?: number; r3FreqA?: number; r3RateA?: number;
  r3AmpB?: number; r3FreqB?: number; r3RateB?: number;

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
  cloudAmp?: number; // how strongly the two slow fields mottle it
  cloudRate?: number;

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
  warpPortal: {
    radius: 4.4, segs: 24, billboard: true,
    sharedLow: 0.007, sharedLowRate: 0.8, sharedMid: 0.005, sharedMidRate: 0.45,
    breathe: 0.008, breatheRate: 1.1,
    r1Radius: 0.16, r1Line: 0.018, r1Glow: 0.07, r1Bright: 1,
    r1AmpA: 0.007, r1FreqA: 5, r1RateA: 1.6, r1AmpB: 0.005, r1FreqB: 9, r1RateB: 2.4,
    r2Radius: 0.31, r2Line: 0.022, r2Glow: 0.08, r2Bright: 1,
    r2AmpA: 0.011, r2FreqA: 6, r2RateA: 1.3, r2AmpB: 0.008, r2FreqB: 8, r2RateB: 2.8,
    r3Radius: 0.49, r3Line: 0.026, r3Glow: 0.095, r3Bright: 1,
    r3AmpA: 0.015, r3FreqA: 7, r3RateA: 1.1, r3AmpB: 0.012, r3FreqB: 10, r3RateB: 2.2,
    coreRadius: 0.1, coreSoft: 0.17, coreBright: 1.2,
    haloRadius: 0.69, haloWidth: 0.1, haloAlpha: 0.5,
    backingAlpha: 1, backingRim: 0.6, cloudAmp: 0.5, cloudRate: 0.5,
    warmCore: 0xffffff, warmLine: 0xfff1da, warmGlow: 0xff6260,
    warmHalo: 0xc06c67, warmGround: 0x35152c, warmRim: 0x080716,
    coolCore: 0xffffff, coolLine: 0xd8f4ff, coolGlow: 0x668dff,
    coolHalo: 0x83a6ad, coolGround: 0x09184c, coolRim: 0x050817,
    cycleRate: 3.7,
    alpha: 1,
  },
  // The invincibility-mask backdrop: one broad soft ring over deep blue,
  // near-static palette.
  akuHalo: {
    radius: 4, segs: 24, billboard: true,
    sharedLow: 0.012, sharedLowRate: 0.4, sharedMid: 0.008, sharedMidRate: 0.25,
    breathe: 0.015, breatheRate: 0.7,
    r1Radius: 0.42, r1Line: 0.05, r1Glow: 0.2, r1Bright: 0.7,
    r1AmpA: 0.012, r1FreqA: 4, r1RateA: 0.6, r1AmpB: 0.008, r1FreqB: 7, r1RateB: 1.0,
    r2Radius: 0, r3Radius: 0,
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
    r1Radius: 0.28, r1Line: 0.014, r1Glow: 0.06, r1Bright: 0.8,
    r1AmpA: 0.008, r1FreqA: 5, r1RateA: 0.9, r1AmpB: 0.006, r1FreqB: 8, r1RateB: 1.4,
    r2Radius: 0.55, r2Line: 0.016, r2Glow: 0.07, r2Bright: 0.7,
    r2AmpA: 0.012, r2FreqA: 6, r2RateA: 0.7, r2AmpB: 0.008, r2FreqB: 9, r2RateB: 1.1,
    r3Radius: 0,
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

// Fixed deterministic per-ring phases — decorrelated small irregularities,
// stable across runs (reference matching needs repeatability).
const RING_PHASE_A = [0.7, 2.8, 5.1];
const RING_PHASE_B = [3.9, 1.2, 5.9];

interface RingSpec {
  radius: number;
  line: number;
  glow: number;
  bright: number;
  ampA: number; freqA: number; rateA: number;
  ampB: number; freqB: number; rateB: number;
}

function ringOf(p: SwirlPreset, i: 1 | 2 | 3): RingSpec {
  const g = (k: string): number | undefined => p[`r${i}${k}` as keyof SwirlPreset] as number;
  return {
    radius: g('Radius') ?? 0,
    line: g('Line') ?? 0.02,
    glow: g('Glow') ?? 0.08,
    bright: g('Bright') ?? 1,
    ampA: g('AmpA') ?? 0.01, freqA: Math.round(g('FreqA') ?? 6), rateA: g('RateA') ?? 1.2,
    ampB: g('AmpB') ?? 0.007, freqB: Math.round(g('FreqB') ?? 9), rateB: g('RateB') ?? 2,
  };
}

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
  /** True freeze: update() returns immediately, the buffers hold the frame. */
  paused = false;
  private preset: SwirlPreset = {};
  private t: number;
  private segs = 0;
  private backGeo: THREE.BufferGeometry;
  private backMat: THREE.MeshBasicMaterial;
  private backMesh: THREE.Mesh;
  private addGeo: THREE.BufferGeometry;
  private addMat: THREE.MeshBasicMaterial;
  private addMesh: THREE.Mesh;
  private warm: THREE.Color[] = Array.from({ length: 6 }, () => new THREE.Color());
  private cool: THREE.Color[] = Array.from({ length: 6 }, () => new THREE.Color());
  private rings: RingSpec[] = [];

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
    if (segs !== this.segs) this.build(segs);
    this.preset = p;
    this.rings = [ringOf(p, 1), ringOf(p, 2), ringOf(p, 3)];
    for (let i = 0; i < 6; i++) {
      this.warm[i].setHex((p[`warm${PAL_KEYS[i]}` as keyof SwirlPreset] as number) ?? PAL_DEF_WARM[i]);
      this.cool[i].setHex((p[`cool${PAL_KEYS[i]}` as keyof SwirlPreset] as number) ?? PAL_DEF_COOL[i]);
    }
  }

  private build(segs: number): void {
    this.segs = segs;
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

    // --- additive: core + 3 ring strips + halo ---
    const nAdd = 1 + (CORE_ROWS + 3 * RING_ROWS + HALO_ROWS) * segs;
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
    for (let s = 0; s < 3; s++) band(1 + CORE_ROWS * segs + s * RING_ROWS * segs, RING_ROWS);
    band(1 + CORE_ROWS * segs + 3 * RING_ROWS * segs, HALO_ROWS);
    this.addGeo.setIndex(aIdx);
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.paused) return; // a real freeze — the frame stays exactly put
    const p = this.preset;
    this.t += dt;
    const t = this.t;
    if (p.billboard ?? true) this.group.quaternion.copy(camera.quaternion);

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
      const cAmp = p.cloudAmp ?? 0.5;
      const cRate = p.cloudRate ?? 0.5;
      pa[0] = 0; pa[1] = 0; pa[2] = 0;
      C.copy(pGround).multiplyScalar(1.15);
      ca[0] = C.r; ca[1] = C.g; ca[2] = C.b; ca[3] = clamp01(bAlpha * alpha);
      for (let r = 0; r < BACK_ROWS; r++) {
        const rf = BACK_R[r];
        for (let j = 0; j < S; j++) {
          const k = 1 + r * S + j;
          const th = (j / S) * TAU;
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
          ca[k * 4 + 3] = clamp01(bAlpha * alpha * (1 - rimK * rimK));
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
    const setV = (
      k: number, x: number, y: number,
      cr: number, cg: number, cb: number, a: number,
    ): void => {
      pa[k * 3] = x; pa[k * 3 + 1] = y; pa[k * 3 + 2] = 0;
      ca[k * 4] = cr; ca[k * 4 + 1] = cg; ca[k * 4 + 2] = cb; ca[k * 4 + 3] = a;
    };

    // core: white centre + white edge + pale mid + additive-zero edge —
    // clearly visible, roughly a tenth of the portal, per the footage
    const coreR = Math.max(0.02, p.coreRadius ?? 0.1);
    const coreSoft = Math.max(coreR + 0.02, p.coreSoft ?? 0.17);
    const coreB = p.coreBright ?? 1.2;
    setV(0, 0, 0, pCore.r * coreB, pCore.g * coreB, pCore.b * coreB, alpha);
    const CORE_R = [coreR * 0.55, coreR, coreSoft];
    for (let r = 0; r < CORE_ROWS; r++)
      for (let j = 0; j < S; j++) {
        const k = 1 + r * S + j;
        const th = (j / S) * TAU;
        const rr = (CORE_R[r] + SHARED[j] * 0.5) * R * breath;
        const x = Math.cos(th) * rr;
        const y = Math.sin(th) * rr;
        if (r === 0) setV(k, x, y, pCore.r * coreB, pCore.g * coreB, pCore.b * coreB, alpha);
        else if (r === 1) {
          C.copy(pLine).lerp(pGlow, 0.35).multiplyScalar(coreB * 0.8);
          setV(k, x, y, C.r, C.g, C.b, alpha * 0.9);
        } else setV(k, x, y, 0, 0, 0, 0);
      }

    // the three rings: black / glow / LINE / glow / black. ONE displacement
    // per (ring, segment), shared by all five rows, so the band's thickness
    // stays coherent while its contour misshapes.
    for (let s = 0; s < 3; s++) {
      const ring = this.rings[s];
      const base = 1 + CORE_ROWS * S + s * RING_ROWS * S;
      const on = ring.radius > 0.01;
      for (let j = 0; j < S; j++) {
        const th = (j / S) * TAU;
        const local = on
          ? ring.ampA * Math.sin(th * ring.freqA + RING_PHASE_A[s] + t * ring.rateA) +
            ring.ampB * Math.sin(th * ring.freqB + RING_PHASE_B[s] - t * ring.rateB)
          : 0;
        const mid = (ring.radius * breath + SHARED[j] + local) * R;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        for (let r = 0; r < RING_ROWS; r++) {
          const k = base + r * S + j;
          if (!on) {
            setV(k, cs * 0.01, sn * 0.01, 0, 0, 0, 0);
            continue;
          }
          // rows at -glow, -line, 0, +line, +glow (in portal-radius units)
          const offR = [-ring.glow, -ring.line, 0, ring.line, ring.glow][r] * R;
          const rr = Math.max(0.01, mid + offR);
          if (r === 2)
            setV(k, cs * rr, sn * rr,
              pLine.r * ring.bright, pLine.g * ring.bright, pLine.b * ring.bright, alpha);
          else if (r === 1 || r === 3) {
            C.copy(pGlow).multiplyScalar(ring.bright * 0.85);
            setV(k, cs * rr, sn * rr, C.r, C.g, C.b, alpha * 0.85);
          } else setV(k, cs * rr, sn * rr, 0, 0, 0, 0);
        }
      }
    }

    // halo: loose, pale, slow — black / halo colour / black
    {
      const base = 1 + CORE_ROWS * S + 3 * RING_ROWS * S;
      const hR = p.haloRadius ?? 0.69;
      const hW = p.haloWidth ?? 0.1;
      const hA = (p.haloAlpha ?? 0.5) * alpha;
      for (let j = 0; j < S; j++) {
        const th = (j / S) * TAU;
        const wob = 0.02 * Math.sin(th * 4 + t * 0.5) + SHARED[j];
        const mid = (hR + wob) * R * breath;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        for (let r = 0; r < HALO_ROWS; r++) {
          const k = base + r * S + j;
          const rr = Math.max(0.01, mid + [-hW, 0, hW][r] * R);
          if (r === 1) setV(k, cs * rr, sn * rr, pHalo.r, pHalo.g, pHalo.b, hA);
          else setV(k, cs * rr, sn * rr, 0, 0, 0, 0);
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
