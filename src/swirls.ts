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
  blend?: 'alpha' | 'add';
  radius?: number; // world units
  rings?: number; // polar grid rings (3..14)
  segs?: number; // segments around (8..48)
  billboard?: boolean; // face the camera every frame

  // --- the spiral field ---
  arms?: number; // integer! spiral arm count; 0 = concentric rings only
  twist?: number; // how many full turns an arm makes centre -> rim (sign = handedness)
  flow?: number; // phase speed; + pours INTO the centre, - pours out
  sharp?: number; // filament sharpness (power curve). 1 = broad band, 10 = hairline
  filament?: number; // filament strength 0..2 (0 = no bright line at all)
  glowWidth?: number; // how far the coloured glow bleeds around the filament 0..1

  // --- churn (what stops it reading as clean maths) ---
  wobble?: number; // radians of phase wobble bent into the spiral
  wobbleScale?: number; // spatial frequency of that wobble along the radius
  wobbleRate?: number; // temporal speed of the churn
  edgeCrinkle?: number; // radial jitter of the outer rings, fraction of radius

  // --- core + backing ---
  core?: number; // hot core blob size, fraction of radius
  coreGlow?: number; // core brightness 0..3
  mottle?: number; // cloudiness of the backing 0..1
  mottleScale?: number; // spatial frequency of the mottle
  mottleRate?: number; // how fast the clouds churn

  // --- colour ---
  colCore?: number; // white-hot centre of the filament / core blob
  colFil?: number; // the filament line
  colGlow?: number; // the bleed around it
  colGround?: number; // the disc backing
  hueCycle?: number; // rad/s the whole palette walks round the hue wheel
  alpha?: number; // overall opacity
  body?: number; // interior opacity floor — how SOLID the disc's backing is.
  // The Crash portal occludes the room behind it with its dark cloudy ground;
  // that needs alpha blend and a high body. Additive discs use it as a haze floor.
  rim?: number; // where the rim fade begins, fraction of radius (0.5 = halfway)

  // --- presentation ---
  spin?: number; // rad/s whole-disc rotation on top of the flow
  pulse?: number; // brightness breathing amplitude 0..1
  pulseRate?: number; // breaths per second-ish (rad/s)

  // --- sparkle dots ---
  sparkCount?: number;
  sparkColour?: number;
  sparkSize?: number;
  sparkOrbit?: number; // rad/s drift around the disc
}

export const SWIRL_PRESETS: Record<string, SwirlPreset> = {
  // The Crash 1 warp hole: one wispy arm, hot core, hue walking the wheel.
  warpPortal: {
    blend: 'alpha', radius: 3, rings: 9, segs: 30, billboard: true,
    arms: 1, twist: 2.6, flow: 1.1, sharp: 5, filament: 1.25, glowWidth: 0.55,
    wobble: 0.9, wobbleScale: 2.2, wobbleRate: 0.9, edgeCrinkle: 0.07,
    core: 0.2, coreGlow: 1.8,
    mottle: 0.55, mottleScale: 2.4, mottleRate: 0.5,
    colCore: 0xfff6ff, colFil: 0xffb9e8, colGlow: 0xb45fd8, colGround: 0x381a4e,
    hueCycle: 0.45, alpha: 0.95, body: 0.85, rim: 0.55,
    spin: 0.18, pulse: 0.12, pulseRate: 1.6,
    sparkCount: 8, sparkColour: 0xffd24a, sparkSize: 0.045, sparkOrbit: 0.25,
  },
  // The invincibility-mask backdrop: no filament, big soft blue bands.
  akuHalo: {
    blend: 'alpha', radius: 4, rings: 8, segs: 24, billboard: true,
    arms: 0, twist: 1.4, flow: 0.35, sharp: 1.6, filament: 0.55, glowWidth: 0.85,
    wobble: 1.1, wobbleScale: 1.6, wobbleRate: 0.45, edgeCrinkle: 0.05,
    core: 0.3, coreGlow: 0.9,
    mottle: 0.65, mottleScale: 1.8, mottleRate: 0.35,
    colCore: 0xdff2ff, colFil: 0x9fc8ff, colGlow: 0x4a6fd8, colGround: 0x141e52,
    hueCycle: 0.06, alpha: 0.85, body: 0.9, rim: 0.45,
    spin: 0.1, pulse: 0.08, pulseRate: 0.9,
    sparkCount: 0, sparkColour: 0xffd24a, sparkSize: 0.04, sparkOrbit: 0.2,
  },
  // A quiet green scenery eddy — fog circling a drain, for pits and vents.
  voidEddy: {
    blend: 'add', radius: 2, rings: 7, segs: 22, billboard: false,
    arms: 2, twist: 1.8, flow: 0.6, sharp: 2.6, filament: 0.7, glowWidth: 0.7,
    wobble: 0.8, wobbleScale: 2.0, wobbleRate: 0.6, edgeCrinkle: 0.09,
    core: 0.14, coreGlow: 0.7,
    mottle: 0.5, mottleScale: 2.2, mottleRate: 0.4,
    colCore: 0xeaffe8, colFil: 0x9fe8a0, colGlow: 0x3f8a52, colGround: 0x12291c,
    hueCycle: 0, alpha: 0.7, body: 0.4, rim: 0.5,
    spin: -0.25, pulse: 0.1, pulseRate: 1.1,
    sparkCount: 0, sparkColour: 0xffd24a, sparkSize: 0.04, sparkOrbit: 0.2,
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
const MAX_SPARKS = 24;

// Scratch palette, rebuilt once per swirl per frame — the hue cycling happens
// HERE, on four colours, not per vertex.
const P_CORE = new THREE.Color();
const P_FIL = new THREE.Color();
const P_GLOW = new THREE.Color();
const P_GROUND = new THREE.Color();
const C = new THREE.Color();

export interface SwirlOpts {
  seed?: number;
  scale?: number;
}

export class Swirl {
  group = new THREE.Group();
  private mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshBasicMaterial;
  private sparkMesh: THREE.Mesh | null = null;
  private sparkGeo: THREE.BufferGeometry | null = null;
  private preset: SwirlPreset = {};
  private t: number;
  private rings = 0;
  private segs = 0;
  // per-vertex statics
  private vr!: Float32Array; // radius fraction 0..1
  private va!: Float32Array; // angle
  private crinklePh!: Float32Array;
  // spark statics
  private sparkR!: Float32Array;
  private sparkA!: Float32Array;
  private sparkPh!: Float32Array;
  private rng: () => number;
  private baseCore = new THREE.Color();
  private baseFil = new THREE.Color();
  private baseGlow = new THREE.Color();
  private baseGround = new THREE.Color();
  private baseSpark = new THREE.Color();

  constructor(preset: SwirlPreset, opts: SwirlOpts = {}) {
    this.rng = makeRng((opts.seed ?? 1) * 2654435761);
    this.t = this.rng() * 100; // each swirl starts somewhere else in the cycle
    this.geo = new THREE.BufferGeometry();
    this.mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    // r166: a 4-component colour attribute gives per-vertex ALPHA, same trick
    // as the puffs.
    (this.mat as unknown as { vertexAlphas: boolean }).vertexAlphas = true;
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.group.add(this.mesh);
    if (opts.scale) this.group.scale.setScalar(opts.scale);
    this.setPreset(preset);
  }

  /** Swap or edit the recipe. Rebuilds the grid only when its size changed. */
  setPreset(p: SwirlPreset): void {
    const rings = Math.max(3, Math.min(MAX_RINGS, Math.round(p.rings ?? 8)));
    const segs = Math.max(8, Math.min(MAX_SEGS, Math.round(p.segs ?? 24)));
    const sparks = Math.max(0, Math.min(MAX_SPARKS, Math.round(p.sparkCount ?? 0)));
    if (rings !== this.rings || segs !== this.segs) this.buildGrid(rings, segs);
    this.buildSparks(sparks);
    this.preset = p;
    this.baseCore.setHex(p.colCore ?? 0xffffff);
    this.baseFil.setHex(p.colFil ?? 0xffc0e8);
    this.baseGlow.setHex(p.colGlow ?? 0xa050d0);
    this.baseGround.setHex(p.colGround ?? 0x301848);
    this.baseSpark.setHex(p.sparkColour ?? 0xffd24a);
    this.mat.blending =
      (p.blend ?? 'add') === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

  private buildGrid(rings: number, segs: number): void {
    this.rings = rings;
    this.segs = segs;
    const nVerts = 1 + rings * segs;
    const pos = new Float32Array(nVerts * 3);
    const col = new Float32Array(nVerts * 4);
    this.vr = new Float32Array(nVerts);
    this.va = new Float32Array(nVerts);
    this.crinklePh = new Float32Array(nVerts);
    // centre vertex is index 0; ring i vertex j is 1 + i*segs + j
    for (let i = 0; i < rings; i++) {
      const rf = (i + 1) / rings;
      for (let j = 0; j < segs; j++) {
        const k = 1 + i * segs + j;
        this.vr[k] = rf;
        this.va[k] = (j / segs) * TAU;
        this.crinklePh[k] = this.rng() * TAU;
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segs));
    for (let i = 0; i < rings - 1; i++)
      for (let j = 0; j < segs; j++) {
        const a = 1 + i * segs + j;
        const b = 1 + i * segs + ((j + 1) % segs);
        const c = a + segs;
        const d = b + segs;
        idx.push(a, c, b, b, c, d);
      }
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    this.geo.setIndex(idx);
  }

  private buildSparks(n: number): void {
    if (this.sparkMesh && (this.sparkGeo?.getAttribute('position')?.count ?? 0) === n * 4) return;
    if (this.sparkMesh) {
      this.group.remove(this.sparkMesh);
      this.sparkGeo?.dispose();
      (this.sparkMesh.material as THREE.Material).dispose();
      this.sparkMesh = null;
      this.sparkGeo = null;
    }
    if (n === 0) return;
    this.sparkR = new Float32Array(n);
    this.sparkA = new Float32Array(n);
    this.sparkPh = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.sparkR[i] = 0.25 + this.rng() * 0.8;
      this.sparkA[i] = this.rng() * TAU;
      this.sparkPh[i] = this.rng() * TAU;
    }
    this.sparkGeo = new THREE.BufferGeometry();
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
    this.sparkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 16), 4));
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    this.sparkGeo.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    (m as unknown as { vertexAlphas: boolean }).vertexAlphas = true;
    this.sparkMesh = new THREE.Mesh(this.sparkGeo, m);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.renderOrder = 3;
    this.group.add(this.sparkMesh);
  }

  update(dt: number, camera: THREE.Camera): void {
    const p = this.preset;
    this.t += dt;
    const t = this.t;
    // Spin is baked into the field's theta below, so billboarding and spinning
    // never fight over the same rotation.
    if (p.billboard ?? true) this.group.quaternion.copy(camera.quaternion);

    // Palette this frame: four colours pushed round the hue wheel together.
    const hue = ((p.hueCycle ?? 0) * t) / TAU;
    P_CORE.copy(this.baseCore).offsetHSL(hue % 1, 0, 0);
    P_FIL.copy(this.baseFil).offsetHSL(hue % 1, 0, 0);
    P_GLOW.copy(this.baseGlow).offsetHSL(hue % 1, 0, 0);
    P_GROUND.copy(this.baseGround).offsetHSL(hue % 1, 0, 0);

    const R = p.radius ?? 3;
    const arms = Math.round(p.arms ?? 1);
    const twist = (p.twist ?? 2.5) * TAU;
    const flow = p.flow ?? 1;
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
    const spin = (p.spin ?? 0) * t;
    const breathe = 1 + (p.pulse ?? 0) * Math.sin((p.pulseRate ?? 1.5) * t);

    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const col = this.geo.getAttribute('color') as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;
    const nV = 1 + this.rings * this.segs;

    for (let k = 0; k < nV; k++) {
      const r = this.vr[k]; // 0 at centre
      const th = this.va[k] + spin;
      // vertex position: flat disc, outer rings crinkled so the rim churns
      const crinkle =
        k === 0 ? 0 : crin * r * r * Math.sin(th * 3 + t * (wobR * 1.3) + this.crinklePh[k]);
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
      // The spiral itself: angle*arms + radius*twist pouring with time.
      const phase = th * arms + r * twist - t * flow * TAU * 0.2 + bend;
      const wave = 0.5 + 0.5 * Math.sin(phase);
      const filament = Math.pow(wave, sharp) * filS;
      const glow = Math.pow(wave, Math.max(1, sharp * glowW * 0.5));
      // Mottled backing: one slow sine field in (r, theta, t).
      const g =
        0.5 +
        0.5 * Math.sin(r * motS * TAU * 0.5 + th * 2 - t * motR) * Math.sin(th * 3 + t * motR * 0.7 + r * 5);
      // Hot core blob.
      const coreI = coreG * Math.pow(Math.max(0, 1 - r / coreSz), 1.5);

      // -- the ramp: ground -> glow -> filament -> core-white --
      C.copy(P_GROUND).multiplyScalar(0.55 + mot * 0.6 * g);
      C.lerp(P_GLOW, clamp01(glow * 0.8));
      C.lerp(P_FIL, clamp01(filament));
      C.lerp(P_CORE, clamp01(filament * filament * 0.6 + coreI));
      const bright = breathe * (1 + coreI * 0.3);
      // Rim fade: intensity walks to zero from `rim` out to the edge. `body`
      // is the interior floor — high body + alpha blend is the Crash portal's
      // solid cloudy ground occluding the room behind it.
      const fade = r < rim ? 1 : clamp01(1 - (r - rim) / (1 - rim));
      const a = alpha * fade * fade * clamp01(body + (1 - body) * clamp01(filament + coreI * 0.5));
      ca[k * 4] = C.r * bright;
      ca[k * 4 + 1] = C.g * bright;
      ca[k * 4 + 2] = C.b * bright;
      ca[k * 4 + 3] = clamp01(a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // -- sparkle dots: little additive diamonds drifting round the disc --
    if (this.sparkMesh && this.sparkGeo) {
      const sp = this.sparkGeo.getAttribute('position') as THREE.BufferAttribute;
      const sc = this.sparkGeo.getAttribute('color') as THREE.BufferAttribute;
      const spa = sp.array as Float32Array;
      const sca = sc.array as Float32Array;
      const n = this.sparkR.length;
      const sz = (p.sparkSize ?? 0.045) * R;
      const orbit = p.sparkOrbit ?? 0.25;
      for (let i = 0; i < n; i++) {
        const a0 = this.sparkA[i] + t * orbit;
        const rr = this.sparkR[i] * R;
        const x = Math.cos(a0) * rr;
        const y = Math.sin(a0) * rr;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.3 + this.sparkPh[i]));
        const s = sz * (0.6 + 0.4 * tw);
        // a diamond: four verts around the point, slightly proud of the disc
        const o = i * 12;
        spa[o] = x; spa[o + 1] = y + s; spa[o + 2] = 0.02;
        spa[o + 3] = x + s; spa[o + 4] = y; spa[o + 5] = 0.02;
        spa[o + 6] = x; spa[o + 7] = y - s; spa[o + 8] = 0.02;
        spa[o + 9] = x - s; spa[o + 10] = y; spa[o + 11] = 0.02;
        for (let v = 0; v < 4; v++) {
          const oc = i * 16 + v * 4;
          sca[oc] = this.baseSpark.r * tw * 1.6;
          sca[oc + 1] = this.baseSpark.g * tw * 1.6;
          sca[oc + 2] = this.baseSpark.b * tw * 1.6;
          sca[oc + 3] = tw;
        }
      }
      sp.needsUpdate = true;
      sc.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    if (this.sparkMesh) {
      this.sparkGeo?.dispose();
      (this.sparkMesh.material as THREE.Material).dispose();
    }
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
