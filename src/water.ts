// PS1-STYLE COAST WATER, v5 — THE SMOOTH GLOSSY ARCHITECTURE.
//
//   fixed world-space water geometry (ONE continuous indexed lattice)
//   -> coherent procedural wave heightfield (4 harmonics + shoaling shore wave)
//   -> fixed-topology shoreline intersection (binary-search solved edge row)
//   -> smooth analytical/finite-difference geometry normals (curved-shore basis)
//   -> smoother reflection normals (broad waves only — ripples never shatter it)
//   -> the ACTUAL level skybox, low-passed + quantized, sampled PER PIXEL
//   -> broad glossy shading with restrained Fresnel
//   -> stylized colour compression (trough navy, graze cyan, shallow lift)
//   -> separate breaker foam + terrain-following swash + persistent wet sand
//
// The camera may frustum-cull, fog, and contribute the small optional
// view-dependent part of the reflection. It must never affect geometry
// origin, wave coordinates or phase, mesh density, triangle topology,
// shoreline coordinates, skybox orientation or update frequency.
//
// Deliberate deviations from the v5 spec, for the record:
//  1. The lattice is COASTLINE-PARAMETERIZED (alongshore samples x cross-shore
//     rows marching seaward), not a rectangular world-XZ grid. It is still one
//     continuous shared-vertex indexed surface with fixed authored density and
//     constant topology — but the nearshore ribbon and the open ocean become
//     THE SAME mesh, so the ribbon<->grid stitch the spec legislates for
//     simply does not exist. Row directions blend to the mean sea direction
//     offshore so rows can never cross on the curved bay.
//  2. Reflection->UV keeps the LINEAR map of the reflected direction
//     (u ~ R x skyRight, v ~ R.y), now evaluated per pixel. Cylindrical
//     atan2/asin mapping has a pole + wrap seam exactly where our near-vertical
//     stable reflection lives; the linear map is continuous everywhere.
//  3. Wave GEOMETRY fades fully flat beyond ~320m offshore (past the spec's
//     reflection flatten and inside fog saturation at 340) so the horizon is
//     a smooth line without megavertex row counts.
import * as THREE from "three";

const TAU = Math.PI * 2;
const SINE = new Float32Array(256);
for (let i = 0; i < 256; i++) SINE[i] = Math.sin((i / 256) * TAU);
const tsin = (p: number): number =>
  SINE[Math.floor((((p / TAU) % 1) + 1) * 256) & 255];
const tcos = (p: number): number => tsin(p + Math.PI / 2);
const clamp = THREE.MathUtils.clamp;
const sstep = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

// ---- tunables (the water studio drives this object live) -------------------
export interface WaterParams {
  amp1: number;
  len1: number;
  spd1: number;
  amp2: number;
  len2: number;
  spd2: number;
  amp3: number;
  len3: number;
  spd3: number;
  amp4: number;
  len4: number;
  spd4: number;
  shoreAmp: number;
  shoreSpeed: number;
  shoreLenMin: number;
  shoreLenMax: number;
  shoalLift: number;
  shape2: number;
  alongA: number;
  alongB: number;
  // reflection field
  stableElev: number; // y of the fixed nominal view direction (spec: 0.94)
  stableBias: number; // xz lean of the nominal view off the sea axis (0.30)
  camInfluence: number; // 0..0.15 — restrained live-camera gloss (spec: 0.05)
  uScale: number; // reflection-to-UV gains: the streak size
  vScale: number;
  distort: number; // reflectionDistortion — normal tilt into the reflection
  worldU: number; // fixed world-position UV drift (not time, not camera)
  worldV: number;
  palette: number; // colours in the sky proxy's shared palette (24-64)
  // colour modulation
  brightness: number;
  troughDark: number;
  grazeCyan: number;
  shallowMix: number;
  // shoreline event (one cycle drives foam + swash + wet sand)
  foamWidth: number;
  foamStrength: number;
  foamPhase: number;
  swashPhase: number;
  swashRetreat: number;
  swashRunup: number;
  wetDecay: number;
  alongDensity: number; // nearshore samples per metre (applied on level load)
}

// v5 spec starting tuning (§3 wave table, §14 shading) — the studio tunes live.
export const WATER_DEFAULTS: WaterParams = {
  amp1: 0.42,
  len1: 32,
  spd1: 0.55,
  amp2: 0.16,
  len2: 14,
  spd2: 0.75,
  amp3: 0.06,
  len3: 6.5,
  spd3: 1.25,
  amp4: 0.018,
  len4: 3,
  spd4: 1.8,
  shoreAmp: 0.3,
  shoreSpeed: 0.9,
  shoreLenMin: 4,
  shoreLenMax: 11,
  shoalLift: 1.35,
  shape2: 0.2,
  alongA: 0.25,
  alongB: 0.18,
  stableElev: 0.94,
  stableBias: 0.3,
  camInfluence: 0.05,
  uScale: 0.24,
  vScale: 0.6,
  distort: 1, // spec starts at 0.5 but our proxy needs more tilt for streaks
  worldU: 0.0015,
  worldV: 0.00025,
  palette: 32,
  brightness: 1.05,
  troughDark: 0.3,
  grazeCyan: 0.22,
  shallowMix: 0.55,
  foamWidth: 0.5,
  foamStrength: 1,
  foamPhase: 0.2,
  swashPhase: 0.38,
  swashRetreat: 0.45,
  swashRunup: 4.6,
  wetDecay: 9,
  alongDensity: 0.6, // ~1.7m between coastline samples
};

export interface ShoreSample {
  x: number;
  z: number;
  sx: number; // seaward unit normal (recomputed locally after resampling)
  sz: number;
  beachSlope: number;
  bedSlope: number;
}

export interface CoastWaterOpts {
  shore: ShoreSample[]; // coarse authored spline; resampled + re-normalled here
  seaLevel: number;
  shoreDirX: number;
  shoreDirZ: number;
  course: { x: number; z: number }[]; // kept for API compatibility (unused)
  terrainHeight: (x: number, z: number) => number;
}

// ---- the fixed authored cross-shore rows (world metres offshore) -----------
// Row 0 of the mesh is the SOLVED SHORELINE EDGE (moving position, constant
// topology). Everything else is fixed world geometry. Density is authored by
// offshore distance, never by camera: fine where the shore wave lives, ~8m
// through the swell field, coarser only where geometry has faded flat.
const ROW_D: number[] = (() => {
  const rows = [1, 2, 3.5, 6, 10, 16, 24, 36, 50];
  for (let d = 58; d <= 202; d += 8) rows.push(d);
  for (let d = 216; d <= 314; d += 14) rows.push(d);
  rows.push(340, 370, 400);
  return rows;
})();
// fine table for shoaling phase integration only (not mesh rows)
const PHASE_D = [
  0, 0.25, 0.55, 0.9, 1.35, 1.9, 2.6, 3.5, 4.7, 6.1, 7.9, 10.2, 13, 16.5, 21,
  27, 34, 42, 50,
];
const BLEND_LO = 26; // shore-wave influence fades out across this band
const BLEND_HI = 40;
const REFL_W = [1, 0.45, 0.1, 0]; // §10: reflection normal wave weights
// alongshore extension steps past each end of the authored beach (capped at
// 28m spacing so swell crests stay coherent off to the sides)
const EXT_STEPS: number[] = (() => {
  const out: number[] = [];
  let d = 0;
  let step = 2.5;
  while (d < 360) {
    d += step;
    out.push(d);
    step = Math.min(28, step * 1.32);
  }
  return out;
})();

interface Wave {
  a: number;
  kx: number;
  kz: number;
  spd: number;
  ph: number;
}

export interface SurfaceSample {
  height: number; // world y
  nx: number;
  ny: number;
  nz: number;
  depth: number;
  shorePhase: number;
  shoreInfluence: number;
}

// ---- the reflection source: the ACTUAL level skybox as a small texture -----
// Sliced from the panorama's above-horizon band, low-pass filtered (drawn 2x
// then box-downsampled), contrast eased, quantized to ONE shared palette.
// Default filtering is bilinear + mipmaps (§9) so reflection bands stretch
// smoothly; a NEAREST "PS1 filter" studio toggle brings the crunch back.
class SkyTexture {
  ready = false;
  url = "";
  texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private raw: ImageData | null = null; // pre-quantization, for re-paletting
  private paletteSize = -1;
  private labelled = false;
  fogHex = 0xd08a7e;
  horizonV = 1 - 600 / 887; // the painting's horizon row (per-preset, see main)

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 128;
    this.canvas.height = 48;
    const g = this.canvas.getContext("2d")!;
    g.fillStyle = "#7f8fa8"; // placeholder until the real sky arrives
    g.fillRect(0, 0, 128, 48);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.setNearest(false);
  }

  setNearest(on: boolean): void {
    this.texture.magFilter = on ? THREE.NearestFilter : THREE.LinearFilter;
    this.texture.minFilter = on
      ? THREE.NearestFilter
      : THREE.LinearMipmapLinearFilter;
    this.texture.generateMipmaps = !on;
    this.texture.needsUpdate = true;
  }

  // mirror of main.ts's dome mapping: the painting's own horizon row sits on
  // the world horizon and the panorama wraps the dome twice
  load(url: string, fogHex: number, horizonV: number): void {
    this.url = url;
    this.fogHex = fogHex;
    this.horizonV = horizonV;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.url !== url) return;
      const w = this.canvas.width;
      const h = this.canvas.height;
      // §9 low-pass: slice at double resolution, then smooth-downsample
      const big = document.createElement("canvas");
      big.width = w * 2;
      big.height = h * 2;
      const bg = big.getContext("2d")!;
      const HORIZON_V = this.horizonV;
      const K = 2.15;
      const vTop = Math.min(1, HORIZON_V + 0.5 * K * (1 - HORIZON_V));
      for (let r = 0; r < big.height; r++) {
        // bottom row = horizon, top row = as far up the dome as the map goes
        const v = HORIZON_V + (r / (big.height - 1)) * (vTop - HORIZON_V);
        const sy = Math.max(0, Math.min(img.height - 1, (1 - v) * img.height));
        bg.drawImage(
          img,
          0,
          sy,
          img.width,
          1,
          0,
          big.height - 1 - r,
          big.width,
          1,
        );
      }
      const g = this.canvas.getContext("2d")!;
      g.imageSmoothingEnabled = true;
      g.drawImage(big, 0, 0, big.width, big.height, 0, 0, w, h);
      // §9: reduce contrast slightly so the water never carries harsher
      // banding than the sky itself
      const id = g.getImageData(0, 0, w, h);
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = 128 + (id.data[i] - 128) * 0.92;
        id.data[i + 1] = 128 + (id.data[i + 1] - 128) * 0.92;
        id.data[i + 2] = 128 + (id.data[i + 2] - 128) * 0.92;
      }
      g.putImageData(id, 0, 0);
      this.raw = g.getImageData(0, 0, w, h);
      this.paletteSize = -1; // force re-palette
      this.ready = true;
    };
    img.src = url;
  }

  // quantize the whole proxy to ONE shared palette of n colours: build a
  // histogram of coarsely-bucketed colours, keep the n most common, and
  // nearest-map every pixel onto that palette
  applyPalette(n: number): void {
    if (!this.raw || (this.paletteSize === n && !this.labelled)) return;
    this.labelled = false;
    this.paletteSize = n;
    const src = this.raw.data;
    const hist = new Map<number, number>();
    for (let i = 0; i < src.length; i += 4) {
      const key =
        ((src[i] >> 3) << 10) | ((src[i + 1] >> 3) << 5) | (src[i + 2] >> 3);
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
    const pal = [...hist.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(4, n))
      .map(([k]) => [
        ((k >> 10) & 31) << 3,
        ((k >> 5) & 31) << 3,
        (k & 31) << 3,
      ]);
    const g = this.canvas.getContext("2d")!;
    const out = g.createImageData(this.canvas.width, this.canvas.height);
    for (let i = 0; i < src.length; i += 4) {
      let bi = 0;
      let bd = Infinity;
      for (let p = 0; p < pal.length; p++) {
        const d =
          (src[i] - pal[p][0]) ** 2 +
          (src[i + 1] - pal[p][1]) ** 2 +
          (src[i + 2] - pal[p][2]) ** 2;
        if (d < bd) {
          bd = d;
          bi = p;
        }
      }
      out.data[i] = pal[bi][0];
      out.data[i + 1] = pal[bi][1];
      out.data[i + 2] = pal[bi][2];
      out.data[i + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    this.texture.needsUpdate = true;
  }

  // debug: a labelled test atlas so mis-mapping is unmistakable
  applyTestAtlas(): void {
    this.labelled = true;
    this.paletteSize = -2;
    const g = this.canvas.getContext("2d")!;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cols = ["#d33", "#3d3", "#33d", "#dd3", "#d3d", "#3dd"];
    for (let c = 0; c < 6; c++) {
      g.fillStyle = cols[c];
      g.fillRect((c * w) / 6, 0, w / 6, h);
    }
    g.fillStyle = "#000";
    g.font = "10px monospace";
    const names = ["+X", "-X", "+Y", "-Y", "+Z", "-Z"];
    for (let c = 0; c < 6; c++) g.fillText(names[c], (c * w) / 6 + 4, h / 2);
    this.texture.needsUpdate = true;
  }
}

// ---- the water shader ------------------------------------------------------
// Per-pixel §12: interpolated world position + reflection normal sample the
// sky proxy ACROSS every polygon; geometry normal drives graze/Fresnel; the
// per-vertex data channel carries (depth, wave height, offshore distance).
const WATER_VERT = /* glsl */ `
attribute vec3 aRefl;
attribute vec3 aData;
varying vec3 vWorld;
varying vec3 vGeomN;
varying vec3 vRefl;
varying vec3 vData;
#include <fog_pars_vertex>
void main() {
  vWorld = position;
  vGeomN = normal;
  vRefl = aRefl;
  vData = aData;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FRAG = /* glsl */ `
uniform sampler2D uSky;
uniform vec3 uStableView;
uniform float uCamInf;
uniform vec2 uSkyRight;
uniform vec2 uSeaDir;
uniform float uUScale;
uniform float uVScale;
uniform float uWorldU;
uniform float uWorldV;
uniform float uBright;
uniform float uTroughDark;
uniform float uGraze;
uniform float uShallowMix;
uniform float uAmpRef;
uniform float uTexOn;
uniform float uModOn;
varying vec3 vWorld;
varying vec3 vGeomN;
varying vec3 vRefl;
varying vec3 vData;
#include <fog_pars_fragment>
void main() {
  vec3 N = normalize(vRefl);
  vec3 GN = normalize(vGeomN);
  vec3 V = normalize(cameraPosition - vWorld);
  // §11-§12: stable art-directed reflection with restrained camera influence
  vec3 R = reflect(-uStableView, N);
  if (uCamInf > 0.001) {
    vec3 actualR = reflect(-V, N);
    R = normalize(mix(R, actualR, uCamInf));
  }
  // linear reflection->UV (continuous, seam-free — see file header)
  float along = dot(vWorld.xz, uSkyRight);
  float outward = dot(vWorld.xz, uSeaDir);
  float u = 0.5 + dot(R.xz, uSkyRight) * uUScale + along * uWorldU
    + outward * 0.0003;
  float v = clamp(
    0.63 + (R.y - uStableView.y) * 2.1 * uVScale + outward * uWorldV,
    0.02, 0.98);
  vec3 sky = texture2D(uSky, vec2(u, v)).rgb;
  if (uTexOn < 0.5) sky = vec3(0.40, 0.55, 0.70); // GEOMETRY ONLY mode
  // §14: broad stylized modulation — the sky is the image, colour shapes it
  vec3 m = vec3(1.0);
  if (uModOn > 0.5) {
    float shal = (1.0 - smoothstep(0.25, 3.5, vData.x)) * uShallowMix;
    m = mix(vec3(0.656, 0.844, 1.156), vec3(0.800, 1.281, 1.250), shal);
    float k = clamp(vData.y / uAmpRef, -1.0, 1.0);
    m *= (1.0 + k * uTroughDark) * vec3(1.0, 1.0, 1.02);
    float graze = clamp((1.0 - abs(GN.y)) * 2.4 * uGraze, 0.0, 1.0);
    m = mix(m, vec3(0.62, 1.05, 1.05), graze);
  }
  // §13: glossy, not mirror — Fresnel only strengthens the sky modestly
  float fre = pow(1.0 - max(dot(GN, V), 0.0), 3.0);
  fre = mix(0.15, 0.65, fre);
  vec3 col = clamp(sky * m * uBright * (0.78 + 0.62 * fre), 0.0, 1.0);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}
`;

interface LatticeSample {
  x: number;
  z: number;
  sx: number; // local seaward normal
  sz: number;
  tx: number; // local alongshore tangent
  tz: number;
  arc: number;
  beach: boolean; // true = the real authored beach (solved edge + swash live here)
}

export class CoastWater {
  group = new THREE.Group();
  params: WaterParams = { ...WATER_DEFAULTS };
  debug = {
    water: true,
    foam: true,
    swash: true,
    wet: true,
    freeze: false,
    wireframe: false,
    texture: true, // off = GEOMETRY ONLY
    modulation: true, // off = RAW SKY TEXTURE
    lockCam: false, // force camInfluence to 0 regardless of the slider
    testAtlas: false, // labelled sky source
    nearest: false, // optional crunchy PS1 filter (§9)
    coast: false,
  };
  stats = { verts: 0, tris: 0, edgeMin: 0, edgeMax: 0 };

  private time = 0;
  private samples: LatticeSample[] = []; // extensions + BEACH + extensions
  private beachLo = 0; // index range of the real beach inside samples[]
  private beachHi = 0;
  private seaLevel: number;
  private dirX: number;
  private dirZ: number;
  private skyRightX: number;
  private skyRightZ: number;
  private avgNx = 0; // mean seaward direction (row marching + stable view)
  private avgNz = 0;
  private terrain: (x: number, z: number) => number;
  private bedSlope = 0.13; // authored seabed slope (from the shore spline)
  private sky = new SkyTexture();

  private mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private foam: THREE.Mesh;
  private swash: THREE.Mesh;
  private wet: THREE.Mesh;
  private coastDebug: THREE.LineSegments | null = null;

  // static lattice data (built once; row 0 = solved edge, moves each frame)
  private NR = ROW_D.length + 1;
  private vXZ: Float32Array; // per-vertex world xz (edge row rewritten per frame)
  private vDepth: Float32Array;
  private vCrossX: Float32Array; // per-vertex blended row direction
  private vCrossZ: Float32Array;
  private vAlongDist: Float32Array; // central-difference alongshore spans
  private rowBlend: Float32Array; // shore-wave -> open-sea blend per row
  private rowPhase: Float32Array; // integrated shoaling phase per row
  private rowF1: Float32Array; // §15 world-space amplitude fades per row
  private rowF2: Float32Array;
  private rowF34: Float32Array;
  private rowReflFlat: Float32Array;
  private gh: Float32Array; // per-vertex height offset this frame
  private edgeD: Float32Array; // solved shoreline distance per beach sample
  private wetness: number[] = [];
  private phaseAt: number[] = [];
  private phaseLenMin = -1;
  private phaseLenMax = -1;

  constructor(opts: CoastWaterOpts) {
    void opts.course;
    this.seaLevel = opts.seaLevel;
    this.dirX = opts.shoreDirX;
    this.dirZ = opts.shoreDirZ;
    this.skyRightX = -this.dirZ;
    this.skyRightZ = this.dirX;
    this.terrain = opts.terrainHeight;
    this.buildSamples(opts.shore);

    const NS = this.samples.length;
    const NR = this.NR;
    const NB = this.beachHi - this.beachLo + 1;
    this.wetness = new Array(NB).fill(0);
    this.edgeD = new Float32Array(NB);
    this.vXZ = new Float32Array(NS * NR * 2);
    this.vDepth = new Float32Array(NS * NR);
    this.vCrossX = new Float32Array(NS * NR);
    this.vCrossZ = new Float32Array(NS * NR);
    this.vAlongDist = new Float32Array(NS * NR);
    this.gh = new Float32Array(NS * NR);
    this.rowBlend = new Float32Array(NR);
    this.rowPhase = new Float32Array(NR);
    this.rowF1 = new Float32Array(NR);
    this.rowF2 = new Float32Array(NR);
    this.rowF34 = new Float32Array(NR);
    this.rowReflFlat = new Float32Array(NR);
    this.bakeLattice();

    this.mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      fog: true,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uSky: { value: null },
          uStableView: { value: new THREE.Vector3(0, 1, 0) },
          uCamInf: { value: 0.05 },
          uSkyRight: {
            value: new THREE.Vector2(this.skyRightX, this.skyRightZ),
          },
          uSeaDir: { value: new THREE.Vector2(this.dirX, this.dirZ) },
          uUScale: { value: 0.24 },
          uVScale: { value: 0.6 },
          uWorldU: { value: 0.0015 },
          uWorldV: { value: 0.00025 },
          uBright: { value: 1.05 },
          uTroughDark: { value: 0.3 },
          uGraze: { value: 0.22 },
          uShallowMix: { value: 0.55 },
          uAmpRef: { value: 0.62 },
          uTexOn: { value: 1 },
          uModOn: { value: 1 },
        },
      ]),
    });
    this.mat.uniforms.uSky.value = this.sky.texture;

    const geo = new THREE.BufferGeometry();
    const n = NS * NR;
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    geo.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    geo.setAttribute(
      "aRefl",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    geo.setAttribute(
      "aData",
      new THREE.BufferAttribute(new Float32Array(n * 3), 3),
    );
    const idx: number[] = [];
    for (let i = 0; i < NS - 1; i++)
      for (let r = 0; r < NR - 1; r++) {
        const k = i * NR + r;
        idx.push(k, k + NR, k + 1, k + 1, k + NR, k + NR + 1);
      }
    geo.setIndex(idx);
    // static xz into the position buffer once; y animates
    const pa = (geo.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    for (let k = 0; k < n; k++) {
      pa[k * 3] = this.vXZ[k * 2];
      pa[k * 3 + 1] = this.seaLevel;
      pa[k * 3 + 2] = this.vXZ[k * 2 + 1];
    }
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.name = "coast water";
    this.mesh.frustumCulled = false; // one surface, always in play near the bay
    this.stats.verts = n;
    this.stats.tris = idx.length / 3;

    const foamMat = new THREE.MeshBasicMaterial({
      map: makeFoamTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.foam = gridMesh(NB, 2, foamMat, "breaker foam", 4);
    const swashMat = new THREE.MeshBasicMaterial({
      map: makeSwashTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.swash = gridMesh(NB, 3, swashMat, "swash", 4);
    const wetMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      side: THREE.DoubleSide,
    });
    this.wet = gridMesh(NB, 2, wetMat, "wet sand", 4);
    this.group.add(this.mesh, this.foam, this.swash, this.wet);
  }

  // Densify the authored beach spline (~1.7m alongshore), derive REAL local
  // sea normals from neighbour tangents, then extend straight past both ends
  // so the open bay is part of the same lattice.
  private buildSamples(coarse: ShoreSample[]): void {
    this.bedSlope = coarse[0]?.bedSlope ?? 0.13;
    let len = 0;
    for (let i = 1; i < coarse.length; i++)
      len += Math.hypot(
        coarse[i].x - coarse[i - 1].x,
        coarse[i].z - coarse[i - 1].z,
      );
    const NSb = Math.max(
      16,
      Math.round(len * clamp(this.params.alongDensity, 0.2, 2)),
    );
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < NSb; i++) {
      const f = (i / (NSb - 1)) * (coarse.length - 1);
      const j = Math.min(coarse.length - 2, Math.floor(f));
      const u = f - j;
      pts.push({
        x: lerp(coarse[j].x, coarse[j + 1].x, u),
        z: lerp(coarse[j].z, coarse[j + 1].z, u),
      });
    }
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p.x / NSb;
      cz += p.z / NSb;
    }
    const refX = cx + this.dirX * -300;
    const refZ = cz + this.dirZ * -300;
    const norms: { x: number; z: number }[] = [];
    const tans: { x: number; z: number }[] = [];
    for (let i = 0; i < NSb; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(NSb - 1, i + 1)];
      let tx = b.x - a.x;
      let tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      tx /= tl;
      tz /= tl;
      let nx = tz;
      let nz = -tx;
      if ((refX - pts[i].x) * nx + (refZ - pts[i].z) * nz < 0) {
        nx = -nx;
        nz = -nz;
      }
      tans.push({ x: tx, z: tz });
      norms.push({ x: nx, z: nz });
    }
    // smooth the normals over three samples, then renormalize
    const sm: { x: number; z: number }[] = [];
    for (let i = 0; i < NSb; i++) {
      const a = norms[Math.max(0, i - 1)];
      const b = norms[i];
      const c = norms[Math.min(NSb - 1, i + 1)];
      const nx = a.x + 2 * b.x + c.x;
      const nz = a.z + 2 * b.z + c.z;
      const l = Math.hypot(nx, nz) || 1;
      sm.push({ x: nx / l, z: nz / l });
    }
    let ax = 0;
    let az = 0;
    for (const nrm of sm) {
      ax += nrm.x;
      az += nrm.z;
    }
    const al = Math.hypot(ax, az) || 1;
    this.avgNx = ax / al;
    this.avgNz = az / al;

    const beach: LatticeSample[] = [];
    let acc = 0;
    for (let i = 0; i < NSb; i++) {
      if (i > 0)
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      beach.push({
        x: pts[i].x,
        z: pts[i].z,
        sx: sm[i].x,
        sz: sm[i].z,
        tx: tans[i].x,
        tz: tans[i].z,
        arc: acc,
        beach: true,
      });
    }
    const extend = (end: LatticeSample, sign: number): LatticeSample[] => {
      const out: LatticeSample[] = [];
      for (const e of EXT_STEPS)
        out.push({
          x: end.x + end.tx * e * sign,
          z: end.z + end.tz * e * sign,
          sx: end.sx,
          sz: end.sz,
          tx: end.tx,
          tz: end.tz,
          arc: end.arc + e * sign,
          beach: false,
        });
      return out;
    };
    const pre = extend(beach[0], -1).reverse();
    const post = extend(beach[beach.length - 1], 1);
    this.samples = [...pre, ...beach, ...post];
    this.beachLo = pre.length;
    this.beachHi = pre.length + beach.length - 1;
  }

  // Fixed lattice positions + all static per-vertex/per-row factors. Row
  // directions blend from the LOCAL sea normal to the MEAN sea direction as
  // rows march offshore, so rows of the curved bay can never cross.
  private bakeLattice(): void {
    const NS = this.samples.length;
    const NR = this.NR;
    for (let r = 1; r < NR; r++) {
      const d = ROW_D[r - 1];
      const far = sstep(d, 120, 420);
      this.rowF1[r] = 1 - sstep(d, 200, 320);
      this.rowF2[r] = lerp(1, 0.35, far) * this.rowF1[r];
      this.rowF34[r] = (1 - far) * this.rowF1[r];
      this.rowReflFlat[r] = 1 - sstep(d, 80, 280) * 0.8;
      this.rowBlend[r] = sstep(d, BLEND_LO, BLEND_HI);
    }
    this.rowF1[0] = 1;
    this.rowF2[0] = 1;
    this.rowF34[0] = 1;
    this.rowReflFlat[0] = 1;
    this.rowBlend[0] = 0;
    for (let i = 0; i < NS; i++) {
      const S = this.samples[i];
      for (let r = 0; r < NR; r++) {
        const d = r === 0 ? 0 : ROW_D[r - 1];
        const f = sstep(d, 12, 90);
        let dxs = lerp(S.sx, this.avgNx, f);
        let dzs = lerp(S.sz, this.avgNz, f);
        const dl = Math.hypot(dxs, dzs) || 1;
        dxs /= dl;
        dzs /= dl;
        const k = i * NR + r;
        this.vXZ[k * 2] = S.x + dxs * d;
        this.vXZ[k * 2 + 1] = S.z + dzs * d;
        this.vCrossX[k] = dxs;
        this.vCrossZ[k] = dzs;
        // depth only matters where the shore wave and shallow tint live —
        // probing the analytic beach far offshore would be meaningless anyway
        this.vDepth[k] =
          d < 60 && S.beach
            ? Math.max(
                0,
                this.seaLevel -
                  this.terrain(this.vXZ[k * 2], this.vXZ[k * 2 + 1]),
              )
            : 30;
      }
    }
    for (let i = 0; i < NS; i++)
      for (let r = 0; r < NR; r++) {
        const k = i * NR + r;
        const iP = Math.max(0, i - 1) * NR + r;
        const iN = Math.min(NS - 1, i + 1) * NR + r;
        this.vAlongDist[k] =
          Math.hypot(
            this.vXZ[iN * 2] - this.vXZ[iP * 2],
            this.vXZ[iN * 2 + 1] - this.vXZ[iP * 2 + 1],
          ) || 1;
      }
  }

  // ---- waves ---------------------------------------------------------------
  private waveSet(): Wave[] {
    const p = this.params;
    const base = Math.atan2(this.dirZ, this.dirX);
    // §3 direction spread (relative angles from the spec's example table)
    const defs: [number, number, number, number, number][] = [
      [p.amp1, p.len1, p.spd1, 0.16, 0],
      [p.amp2, p.len2, p.spd2, 0.16 + 1.72, 1.8],
      [p.amp3, p.len3, p.spd3, 0.16 + 0.63, 3.1],
      [p.amp4, p.len4, p.spd4, 0.16 - 2.83, 4.4],
    ];
    return defs.map(([a, len, spd, off, ph]) => {
      const k = TAU / Math.max(0.5, len);
      return {
        a,
        kx: Math.cos(base + off) * k,
        kz: Math.sin(base + off) * k,
        spd,
        ph,
      };
    });
  }

  private waves: Wave[] = [];
  private wavesDirty = true;
  markWavesDirty(): void {
    this.wavesDirty = true;
    this.phaseLenMin = -1;
  }

  private ensureWaves(): void {
    if (this.wavesDirty) {
      this.waves = this.waveSet();
      this.wavesDirty = false;
    }
    if (
      this.phaseLenMin !== this.params.shoreLenMin ||
      this.phaseLenMax !== this.params.shoreLenMax
    )
      this.rebuildPhaseTable();
  }

  // ---- the ONE unified surface sampler ------------------------------------
  // rendering, the shoreline solve, foam, swash and floating objects all
  // come through this same math
  sampleWaterSurface(x: number, z: number, t = this.time): SurfaceSample {
    this.ensureWaves();
    let bi = 0;
    let best = Infinity;
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const dd = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (dd < best) {
        best = dd;
        bi = i;
      }
    }
    const S = this.samples[bi];
    const d = (x - S.x) * S.sx + (z - S.z) * S.sz;
    return this.sampleAt(x, z, bi, d, t);
  }

  private sampleAt(
    x: number,
    z: number,
    si: number,
    d: number,
    t: number,
  ): SurfaceSample {
    const S = this.samples[si];
    const depth = S.beach
      ? Math.max(0, this.seaLevel - this.terrain(x, z))
      : 30;
    const crossK = sstep(depth, 1.5, 5);
    const smallK = sstep(depth, 0.8, 3);
    const shoreward = lerp(0.55, 1, crossK);
    let hSup = 0;
    let hPure = 0;
    let dx = 0;
    let dz = 0;
    for (let wi = 0; wi < 4; wi++) {
      const w = this.waves[wi];
      const ph = w.kx * x + w.kz * z - w.spd * t + w.ph;
      const s = w.a * tsin(ph);
      const c = w.a * tcos(ph);
      const sup = wi === 0 ? 1 : wi === 1 ? crossK : smallK;
      hPure += s;
      hSup += s * sup;
      dx += c * w.kx * sup;
      dz += c * w.kz * sup;
    }
    const shorePhase = this.shorePhaseAtD(si, Math.max(0, d), t);
    const amp = this.shoreAmpAt(depth);
    const shoreW = this.shoreShape(shorePhase) * amp;
    const blend = sstep(d, BLEND_LO, BLEND_HI);
    const height =
      this.seaLevel + lerp(hSup * shoreward + shoreW, hPure, blend);
    const inf = 1 - blend;
    const eps = 0.6;
    const sp2 = this.shorePhaseAtD(si, Math.max(0, d + eps), t);
    const shoreSlope =
      ((this.shoreShape(sp2) - this.shoreShape(shorePhase)) * amp) / eps;
    const nx = -(dx + shoreSlope * S.sx * inf);
    const nz = -(dz + shoreSlope * S.sz * inf);
    const nl = Math.hypot(nx, 1, nz);
    return {
      height,
      nx: nx / nl,
      ny: 1 / nl,
      nz: nz / nl,
      depth,
      shorePhase,
      shoreInfluence: inf,
    };
  }

  heightAt(x: number, z: number, t = this.time): number {
    return this.sampleWaterSurface(x, z, t).height;
  }

  // ---- shoaling ------------------------------------------------------------
  private rebuildPhaseTable(): void {
    const p = this.params;
    this.phaseAt = [0];
    let acc = 0;
    for (let j = 1; j < PHASE_D.length; j++) {
      const mid = (PHASE_D[j] + PHASE_D[j - 1]) / 2;
      const depth = Math.max(0.12, mid * this.bedSlope + 0.1);
      const lam = lerp(p.shoreLenMin, p.shoreLenMax, sstep(depth, 0.5, 5));
      acc += (TAU / lam) * (PHASE_D[j] - PHASE_D[j - 1]);
      this.phaseAt.push(acc);
    }
    this.phaseLenMin = p.shoreLenMin;
    this.phaseLenMax = p.shoreLenMax;
    for (let r = 0; r < this.NR; r++)
      this.rowPhase[r] = this.phaseOfD(r === 0 ? 0 : ROW_D[r - 1]);
  }

  private phaseOfD(d: number): number {
    const dm = Math.min(d, PHASE_D[PHASE_D.length - 1]);
    let j = 1;
    while (j < PHASE_D.length - 1 && PHASE_D[j] < dm) j++;
    const f = clamp(
      (dm - PHASE_D[j - 1]) / (PHASE_D[j] - PHASE_D[j - 1] || 1),
      0,
      1,
    );
    return lerp(this.phaseAt[j - 1], this.phaseAt[j], f);
  }

  private shorePhaseAtD(si: number, d: number, t: number): number {
    return (
      -this.phaseOfD(d) +
      this.alongshore(this.samples[si].arc, t) -
      t * this.params.shoreSpeed
    );
  }

  private alongshore(s: number, t: number): number {
    const p = this.params;
    return (
      tsin(s * 0.11 + t * 0.3) * p.alongA +
      tsin(s * 0.037 - t * 0.16) * p.alongB
    );
  }

  private shoreShape(ph: number): number {
    return tsin(ph) + tsin(ph * 2 + 0.55) * this.params.shape2;
  }

  private shoreAmpAt(depth: number): number {
    const p = this.params;
    const shoaling = 1 - sstep(depth, 1.2, 5);
    const collapse = sstep(depth, 0.15, 0.9);
    return p.shoreAmp * lerp(0.75, p.shoalLift, shoaling) * collapse;
  }

  // the one shore-wave CYCLE at a coastline sample: foam, swash and wet sand
  // are stages of this same number — no independent timers
  private cycleAt(si: number, t: number): number {
    const ph0 =
      this.alongshore(this.samples[si].arc, t) - t * this.params.shoreSpeed;
    const c = -ph0 / TAU;
    return ((c % 1) + 1) % 1;
  }

  // ---- sky -----------------------------------------------------------------
  setSkyUrl(url: string, fogHex: number, horizonV = 1 - 600 / 887): void {
    if (this.sky.url === url) return;
    this.sky.load(url, fogHex, horizonV);
  }
  get skyUrl(): string {
    return this.sky.url;
  }
  get skyReady(): boolean {
    return this.sky.ready;
  }

  // ---- §5-§7: the solved fixed-topology shoreline edge ---------------------
  // water height along a beach sample's normal, shore wave included
  private nearHeightAt(
    si: number,
    d: number,
    x: number,
    z: number,
    t: number,
  ): number {
    const depth = this.samples[si].beach
      ? Math.max(0, this.seaLevel - this.terrain(x, z))
      : 30;
    const crossK = sstep(depth, 1.5, 5);
    const smallK = sstep(depth, 0.8, 3);
    let h = 0;
    for (let wi = 0; wi < 4; wi++) {
      const w = this.waves[wi];
      const ph = w.kx * x + w.kz * z - w.spd * t + w.ph;
      const sup = wi === 0 ? 1 : wi === 1 ? crossK : smallK;
      h += w.a * tsin(ph) * sup;
    }
    const shoreW =
      this.shoreShape(this.shorePhaseAtD(si, Math.max(0, d), t)) *
      this.shoreAmpAt(depth);
    return this.seaLevel + h * lerp(0.55, 1, crossK) + shoreW;
  }

  private clearanceAt(si: number, d: number, t: number): number {
    const S = this.samples[si];
    const x = S.x + S.sx * d;
    const z = S.z + S.sz * d;
    return this.nearHeightAt(si, d, x, z, t) - this.terrain(x, z);
  }

  private solveWetEdge(si: number, t: number): number {
    let dryD = -0.5;
    let wetD = 3.0;
    if (this.clearanceAt(si, dryD, t) > 0) return dryD; // flooded past the probe
    if (this.clearanceAt(si, wetD, t) <= 0) return wetD; // dry all the way out
    for (let it = 0; it < 7; it++) {
      const mid = (dryD + wetD) * 0.5;
      if (this.clearanceAt(si, mid, t) > 0) wetD = mid;
      else dryD = mid;
    }
    return (dryD + wetD) * 0.5;
  }

  private edgeRaw: number[] = [];
  private updateEdge(dt: number): void {
    const NB = this.beachHi - this.beachLo + 1;
    const t = this.time;
    if (this.edgeRaw.length !== NB) this.edgeRaw = new Array(NB).fill(1);
    let mn = Infinity;
    let mx = -Infinity;
    for (let b = 0; b < NB; b++)
      this.edgeRaw[b] = this.solveWetEdge(this.beachLo + b, t);
    // §7: one spatial smoothing pass (endpoints preserved) ...
    for (let b = 1; b < NB - 1; b++) {
      const sm =
        this.edgeRaw[b - 1] * 0.25 +
        this.edgeRaw[b] * 0.5 +
        this.edgeRaw[b + 1] * 0.25;
      // ... then a frame-rate-limited approach so single frames never snap
      const cap = 7.2 * dt;
      this.edgeD[b] = clamp(sm, this.edgeD[b] - cap, this.edgeD[b] + cap);
      mn = Math.min(mn, this.edgeD[b]);
      mx = Math.max(mx, this.edgeD[b]);
    }
    this.edgeD[0] = this.edgeRaw[0];
    this.edgeD[NB - 1] = this.edgeRaw[NB - 1];
    this.stats.edgeMin = Math.round(mn * 100) / 100;
    this.stats.edgeMax = Math.round(mx * 100) / 100;
  }

  // ---- per-frame -----------------------------------------------------------
  private camPos = new THREE.Vector3();
  update(dt: number, camera: THREE.Camera): void {
    if (!this.debug.freeze) this.time += dt;
    this.ensureWaves();
    if (this.debug.testAtlas) this.sky.applyTestAtlas();
    else this.sky.applyPalette(Math.round(this.params.palette));
    camera.getWorldPosition(this.camPos);

    const p = this.params;
    const U = this.mat.uniforms;
    let vx = -this.dirX * p.stableBias;
    const vy = p.stableElev;
    let vz = -this.dirZ * p.stableBias;
    const vl = Math.hypot(vx, vy, vz) || 1;
    (U.uStableView.value as THREE.Vector3).set(vx / vl, vy / vl, vz / vl);
    U.uCamInf.value = this.debug.lockCam ? 0 : clamp(p.camInfluence, 0, 0.15);
    U.uUScale.value = p.uScale;
    U.uVScale.value = p.vScale;
    U.uWorldU.value = p.worldU;
    U.uWorldV.value = p.worldV;
    U.uBright.value = p.brightness;
    U.uTroughDark.value = p.troughDark;
    U.uGraze.value = p.grazeCyan;
    U.uShallowMix.value = p.shallowMix;
    U.uAmpRef.value = p.amp1 + 0.2;
    U.uTexOn.value = this.debug.texture ? 1 : 0;
    U.uModOn.value = this.debug.modulation ? 1 : 0;
    this.mat.wireframe = this.debug.wireframe;
    const wantNearest = this.debug.nearest || this.debug.testAtlas;
    if ((this.sky.texture.magFilter === THREE.NearestFilter) !== wantNearest)
      this.sky.setNearest(wantNearest);

    this.mesh.visible = this.debug.water;
    if (this.debug.water) {
      this.updateEdge(dt);
      this.updateLattice();
    }
    this.foam.visible = this.debug.foam;
    this.swash.visible = this.debug.swash;
    this.wet.visible = this.debug.wet;
    this.updateShoreline(dt);
    this.updateCoastDebug();
  }

  // The whole surface, every rendered frame, same wave function everywhere.
  // PASS 1 walks every vertex once: heights + analytic weighted reflection
  // normal. PASS 2 turns finite differences of the height field into the
  // geometry normal through each vertex's LOCAL (tangent, row-direction)
  // basis — correct on the curved beach (§8).
  private updateLattice(): void {
    const NS = this.samples.length;
    const NR = this.NR;
    const t = this.time;
    const p = this.params;
    const geo = this.mesh.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
    const rfl = geo.getAttribute("aRefl") as THREE.BufferAttribute;
    const dat = geo.getAttribute("aData") as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const na = nrm.array as Float32Array;
    const ra = rfl.array as Float32Array;
    const da = dat.array as Float32Array;
    const w0 = this.waves[0];
    const w1 = this.waves[1];
    const w2 = this.waves[2];
    const w3 = this.waves[3];
    const distort = p.distort;

    // the solved edge row: position + height pinned to the beach
    for (let i = 0; i < NS; i++) {
      const S = this.samples[i];
      const k = i * NR;
      let d = 0;
      if (S.beach) d = this.edgeD[i - this.beachLo];
      const x = S.x + S.sx * d;
      const z = S.z + S.sz * d;
      this.vXZ[k * 2] = x;
      this.vXZ[k * 2 + 1] = z;
      let y: number;
      if (S.beach) {
        y = this.terrain(x, z) + 0.015;
      } else {
        y = this.nearHeightAt(i, 0, x, z, t);
      }
      this.gh[k] = y - this.seaLevel;
      pa[k * 3] = x;
      pa[k * 3 + 1] = y;
      pa[k * 3 + 2] = z;
      da[k * 3] = 0.05;
      da[k * 3 + 1] = this.gh[k];
      da[k * 3 + 2] = 0;
    }

    // PASS 1: heights + reflection normals for the fixed rows
    for (let i = 0; i < NS; i++) {
      const S = this.samples[i];
      const alongPh = this.alongshore(S.arc, t);
      const baseSh = alongPh - t * p.shoreSpeed;
      for (let r = 1; r < NR; r++) {
        const k = i * NR + r;
        const x = this.vXZ[k * 2];
        const z = this.vXZ[k * 2 + 1];
        const d = ROW_D[r - 1];
        const depth = this.vDepth[k];
        const crossK = sstep(depth, 1.5, 5);
        const smallK = sstep(depth, 0.8, 3);
        const shoreward = lerp(0.55, 1, crossK);
        // effective per-wave amplitudes: authored row fades (§15) x depth
        const a0 = w0.a * this.rowF1[r];
        const a1 = w1.a * this.rowF2[r];
        const a2 = w2.a * this.rowF34[r];
        const a3 = w3.a * this.rowF34[r];
        const ph0 = w0.kx * x + w0.kz * z - w0.spd * t + w0.ph;
        const ph1 = w1.kx * x + w1.kz * z - w1.spd * t + w1.ph;
        const ph2 = w2.kx * x + w2.kz * z - w2.spd * t + w2.ph;
        const ph3 = w3.kx * x + w3.kz * z - w3.spd * t + w3.ph;
        const s0 = tsin(ph0);
        const s1 = tsin(ph1);
        const s2 = tsin(ph2);
        const s3 = tsin(ph3);
        const c0 = tcos(ph0);
        const c1 = tcos(ph1);
        const c2 = tcos(ph2); // wave 4 has no cos term: it never reaches the reflection
        const hPure = a0 * s0 + a1 * s1 + a2 * s2 + a3 * s3;
        const hSup =
          (a0 * s0 + a1 * s1 * crossK + (a2 * s2 + a3 * s3) * smallK) *
          shoreward;
        const blend = this.rowBlend[r];
        let shoreW = 0;
        let shoreSlope = 0;
        if (d < 45) {
          const amp = this.shoreAmpAt(depth);
          const ph = baseSh - this.rowPhase[r];
          shoreW = this.shoreShape(ph) * amp;
          const ph2b = baseSh - this.phaseOfD(d + 0.6);
          shoreSlope =
            ((this.shoreShape(ph2b) - this.shoreShape(ph)) * amp) / 0.6;
        }
        this.gh[k] = lerp(hSup + shoreW, hPure, blend);
        pa[k * 3 + 1] = this.seaLevel + this.gh[k];
        // §10: the reflection normal hears only the broad waves
        const flat = this.rowReflFlat[r] * distort;
        const rdx =
          (a0 * c0 * w0.kx * REFL_W[0] +
            a1 * c1 * w1.kx * crossK * REFL_W[1] +
            a2 * c2 * w2.kx * smallK * REFL_W[2] +
            shoreSlope * S.sx * 0.4 * (1 - blend)) *
          flat;
        const rdz =
          (a0 * c0 * w0.kz * REFL_W[0] +
            a1 * c1 * w1.kz * crossK * REFL_W[1] +
            a2 * c2 * w2.kz * smallK * REFL_W[2] +
            shoreSlope * S.sz * 0.4 * (1 - blend)) *
          flat;
        const rl = Math.hypot(rdx, 1, rdz);
        ra[k * 3] = -rdx / rl;
        ra[k * 3 + 1] = 1 / rl;
        ra[k * 3 + 2] = -rdz / rl;
        da[k * 3] = depth;
        da[k * 3 + 1] = this.gh[k];
        da[k * 3 + 2] = d;
      }
      // the edge row inherits its neighbour's reflection normal (visually
      // identical at 1m spacing, and the edge itself is terrain-pinned)
      const ke = i * NR;
      ra[ke * 3] = ra[(ke + 1) * 3];
      ra[ke * 3 + 1] = ra[(ke + 1) * 3 + 1];
      ra[ke * 3 + 2] = ra[(ke + 1) * 3 + 2];
    }

    // PASS 2: geometry normals by finite differences in the LOCAL basis
    for (let i = 0; i < NS; i++) {
      const S = this.samples[i];
      const iP = Math.max(0, i - 1);
      const iN = Math.min(NS - 1, i + 1);
      for (let r = 0; r < NR; r++) {
        const k = i * NR + r;
        const rP = Math.max(0, r - 1);
        const rN = Math.min(NR - 1, r + 1);
        const dP = rP === 0 ? 0 : ROW_D[rP - 1];
        const dN = rN === 0 ? 0 : ROW_D[rN - 1];
        const sAlong =
          (this.gh[iN * NR + r] - this.gh[iP * NR + r]) / this.vAlongDist[k];
        const sCross =
          (this.gh[i * NR + rN] - this.gh[i * NR + rP]) / (dN - dP || 1);
        // §8: transform (alongshore, cross-shore) slopes through the local
        // coastline basis instead of pretending they are world x/z
        const gx = sAlong * S.tx + sCross * this.vCrossX[k];
        const gz = sAlong * S.tz + sCross * this.vCrossZ[k];
        const gl = Math.hypot(gx, 1, gz);
        na[k * 3] = -gx / gl;
        na[k * 3 + 1] = 1 / gl;
        na[k * 3 + 2] = -gz / gl;
      }
    }
    pos.needsUpdate = true;
    nrm.needsUpdate = true;
    rfl.needsUpdate = true;
    dat.needsUpdate = true;
  }

  // foam, swash and wet sand as stages of the SAME shore-wave cycle
  private updateShoreline(dt: number): void {
    const t = this.time;
    const p = this.params;
    const NB = this.beachHi - this.beachLo + 1;

    const fGeo = this.foam.geometry;
    const fPos = fGeo.getAttribute("position") as THREE.BufferAttribute;
    const fUv = fGeo.getAttribute("uv") as THREE.BufferAttribute;
    const fCol = fGeo.getAttribute("color") as THREE.BufferAttribute;
    const sGeo = this.swash.geometry;
    const sPos = sGeo.getAttribute("position") as THREE.BufferAttribute;
    const sUv = sGeo.getAttribute("uv") as THREE.BufferAttribute;
    const sCol = sGeo.getAttribute("color") as THREE.BufferAttribute;
    const wGeo = this.wet.geometry;
    const wPos = wGeo.getAttribute("position") as THREE.BufferAttribute;
    const wCol = wGeo.getAttribute("color") as THREE.BufferAttribute;
    const easeOutCubic = (u: number): number => 1 - Math.pow(1 - u, 3);
    const easeInOutQuad = (u: number): number =>
      u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

    for (let b = 0; b < NB; b++) {
      const si = this.beachLo + b;
      const S = this.samples[si];
      const cycle = this.cycleAt(si, t);

      // BREAKER: locate the physical crest via the integrated phase table
      const base = this.alongshore(S.arc, t) - t * p.shoreSpeed;
      let crossX = -1;
      let zone = 0;
      for (let j = PHASE_D.length - 5; j >= 1; j--) {
        const a0 = -this.phaseAt[j] + base;
        const a1 = -this.phaseAt[j - 1] + base;
        const lo = Math.min(a0, a1);
        const hi = Math.max(a0, a1);
        const n0 = Math.ceil((lo - Math.PI / 2) / TAU);
        const crest = Math.PI / 2 + n0 * TAU;
        if (crest <= hi) {
          const f = (crest - a0) / (a1 - a0 || 1);
          crossX = lerp(PHASE_D[j], PHASE_D[j - 1], f);
          const depth = Math.max(0.1, crossX * this.bedSlope + 0.1);
          zone = (1 - sstep(depth, 0.8, 1.6)) * sstep(depth, 0.15, 0.45);
          break;
        }
      }
      const fWin = winEnv(cycle, p.foamPhase, 0.4);
      const strength = zone * p.foamStrength * (0.35 + 0.65 * fWin);
      const active = crossX > 0 && strength > 0.02;
      const cx = active ? crossX : 5;
      for (let r = 0; r < 2; r++) {
        const d = cx + (r === 0 ? p.foamWidth : -p.foamWidth);
        const px = S.x + S.sx * d;
        const pz = S.z + S.sz * d;
        // §16: foam rides the UNIFIED surface — shore wave included
        const py = active
          ? this.sampleAt(px, pz, si, d, t).height + 0.02
          : this.seaLevel;
        const vi = r * NB + b;
        fPos.setXYZ(vi, px, py, pz);
        fUv.setXY(vi, S.arc * 0.14, r);
        fCol.setXYZW(
          vi,
          1,
          1,
          1,
          active ? strength * (r === 0 ? 0.75 : 0.4) : 0,
        );
      }

      // SWASH: phase windows of the SAME cycle (advance fast, retreat slow)
      const advLen = 0.17;
      const retLen = clamp(p.swashRetreat, 0.1, 0.9);
      let travel = 0;
      const cRel = (((cycle - p.swashPhase) % 1) + 1) % 1;
      if (cRel < advLen) travel = easeOutCubic(cRel / advLen);
      else if (cRel < advLen + retLen)
        travel = 1 - easeInOutQuad((cRel - advLen) / retLen);
      const local = 0.7 + 0.3 * tsin(S.arc * 0.21 + t * 0.4);
      const runup = p.swashRunup * travel * local;
      this.wetness[b] = Math.max(
        this.wetness[b] * Math.exp(-dt / Math.max(0.5, p.wetDecay)),
        travel * local,
      );
      const rows: [number, number, number, number, number, number][] = [
        [runup, 1, 1, 1, 0.85, 0],
        [runup - 2.2, 0.75, 0.85, 0.9, 0.4, 0.55],
        [-0.7, 0.6, 0.75, 0.8, 0.5, 1],
      ];
      for (let r = 0; r < 3; r++) {
        const [dIn, cr, cg, cb, cal, tv] = rows[r];
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        sPos.setXYZ(r * NB + b, px, this.terrain(px, pz) + 0.02, pz);
        sUv.setXY(r * NB + b, S.arc * 0.2, tv);
        sCol.setXYZW(r * NB + b, cr, cg, cb, cal * (0.25 + 0.75 * travel));
      }

      // WET SAND: remains after the connected swash event retreats
      const w = this.wetness[b];
      for (let r = 0; r < 2; r++) {
        const dIn = r === 0 ? p.swashRunup * w : -0.4;
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        wPos.setXYZ(r * NB + b, px, this.terrain(px, pz) + 0.012, pz);
        const dark = r === 0 ? 1 : 1 - w * 0.32;
        wCol.setXYZW(r * NB + b, dark, dark, Math.min(1, dark * 1.04), 1);
      }
    }
    fPos.needsUpdate = true;
    fUv.needsUpdate = true;
    fCol.needsUpdate = true;
    sPos.needsUpdate = true;
    sUv.needsUpdate = true;
    sCol.needsUpdate = true;
    wPos.needsUpdate = true;
    wCol.needsUpdate = true;
  }

  private updateCoastDebug(): void {
    if (!this.debug.coast) {
      if (this.coastDebug) this.coastDebug.visible = false;
      return;
    }
    if (!this.coastDebug) {
      const pts: number[] = [];
      const NS = this.samples.length;
      for (let i = 0; i < NS; i++) {
        const S = this.samples[i];
        const y = this.seaLevel + 0.6;
        if (i < NS - 1) {
          const T = this.samples[i + 1];
          pts.push(S.x, y, S.z, T.x, y, T.z);
        }
        if (i % 4 === 0)
          pts.push(S.x, y, S.z, S.x + S.sx * 4, y, S.z + S.sz * 4);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(pts), 3),
      );
      this.coastDebug = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: 0xff4488 }),
      );
      this.coastDebug.frustumCulled = false;
      this.group.add(this.coastDebug);
    }
    this.coastDebug.visible = true;
  }
}

// smooth 0..1 envelope over a cyclic window starting at `start`, `len` wide
function winEnv(cycle: number, start: number, len: number): number {
  const c = (((cycle - start) % 1) + 1) % 1;
  if (c >= len) return 0;
  const u = c / len;
  return u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7;
}

function gridMesh(
  cols: number,
  rows: number,
  mat: THREE.Material,
  name: string,
  colorSize = 3,
): THREE.Mesh {
  const n = cols * rows;
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(n * 3), 3),
  );
  g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(n * colorSize), colorSize),
  );
  const idx: number[] = [];
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const k = r * cols + c;
      idx.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1);
    }
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  m.frustumCulled = false;
  return m;
}

// §16: connected cellular foam streaks — long irregular body, branching thin
// fingers, big transparent holes, one dense side, dithered fade, cyan under
// white. Drawn once, indexed-look, nearest filtered.
function makeFoamTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 32);
  g.fillStyle = "rgba(150,225,230,0.55)";
  for (let x = 0; x < 128; x += 3) {
    const wob = Math.sin(x * 0.22) * 3 + Math.sin(x * 0.07) * 4;
    if (Math.sin(x * 0.4) > -0.6) g.fillRect(x, 10 + wob, 3, 12);
  }
  g.fillStyle = "rgba(255,255,255,0.95)";
  let y = 14;
  for (let x = 0; x < 128; x += 2) {
    y += Math.round(Math.sin(x * 0.3) + Math.sin(x * 0.11) * 1.4);
    y = Math.max(4, Math.min(24, y));
    const th = 2 + (Math.sin(x * 0.17) > 0.2 ? 2 : 0);
    if (Math.sin(x * 0.09) > -0.75) g.fillRect(x, y, 2, th);
    if (Math.sin(x * 0.53) > 0.82) g.fillRect(x, y - 5, 1, 5);
  }
  g.fillStyle = "rgba(255,255,255,0.5)";
  for (let i = 0; i < 90; i++) {
    const x = (i * 37) % 128;
    const yy = 4 + ((i * 13) % 24);
    if ((x + yy) % 2 === 0) g.fillRect(x, yy, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// §17: the swash sheet's own texture — narrow broken leading line (v=0),
// patchy pale-cyan film, big gaps, faint retreat streaks toward v=1
function makeSwashTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 32);
  g.fillStyle = "rgba(255,255,255,0.95)";
  for (let x = 0; x < 128; x += 2)
    if (Math.sin(x * 0.31) > -0.5)
      g.fillRect(x, 0, 2, 2 + (x % 3 === 0 ? 1 : 0));
  g.fillStyle = "rgba(190,230,235,0.4)";
  for (let i = 0; i < 60; i++) {
    const x = (i * 29) % 126;
    const yy = 4 + ((i * 17) % 18);
    g.fillRect(x, yy, 4 + ((i * 7) % 8), 2);
  }
  g.fillStyle = "rgba(220,240,244,0.3)";
  for (let i = 0; i < 14; i++) {
    const x = (i * 43) % 128;
    g.fillRect(x, 8 + ((i * 11) % 8), 1, 14);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
