// PS1-STYLE COAST WATER, v3 — THE TEXTURED-REFLECTION ARCHITECTURE.
//
//   fixed world-space tessellation (density bands by distance from COAST)
//   -> coherent procedural wave geometry (same set, every chunk, every frame)
//   -> per-vertex reflection UVs (stable world-space nominal view direction)
//   -> the ACTUAL skybox, palette-quantized, as a real texture sampled by the
//      GPU ACROSS each polygon (the streaks live inside triangles, not at
//      their corners)
//   -> Gouraud vertex-colour modulation (troughs, shallows, grazing cyan)
//   -> breaker foam + swash + wet sand as stages of ONE shore-wave event
//
// The camera may frustum-cull fixed chunks and take the level's fog.
// It must never change mesh resolution, wave count, update frequency,
// reflection method or surface colour. The dominant reflection field is
// anchored in WORLD space (camera influence defaults to zero) so walking
// the beach never drags the pattern.
//
// One deliberate deviation from the correction spec: reflection UVs come
// from a LINEAR map of the reflected direction (u ~ R x skyRight, v ~ R.y)
// instead of atan2/asin cylindrical coordinates. Near-vertical reflections
// sit at the cylindrical map's pole, where azimuth (and so u) is unstable
// and every triangle straddles the wrap seam the spec then has to patch by
// duplicating vertices. The linear map is continuous everywhere — no seam,
// no pole — and still samples the same actual-skybox texture across the
// polygons with world-fixed offsets.
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
  amp1: number; len1: number; spd1: number;
  amp2: number; len2: number; spd2: number;
  amp3: number; len3: number; spd3: number;
  amp4: number; len4: number; spd4: number;
  shoreAmp: number;
  shoreSpeed: number;
  shoreLenMin: number;
  shoreLenMax: number;
  shoalLift: number;
  shape2: number;
  alongA: number;
  alongB: number;
  // reflection field
  stableElev: number; // y of the fixed nominal view direction
  stableBias: number; // how much the nominal view leans off the shore axis
  camInfluence: number; // 0..0.15 — how much the REAL camera bends the field
  uScale: number; // reflection-to-UV gains: the streak size
  vScale: number;
  distort: number; // extra normal exaggeration into the reflection
  worldU: number; // fixed world-position UV drift (not time, not camera)
  worldV: number;
  palette: number; // global palette size of the sky proxy (PS1 indexed look)
  // colour modulation
  brightness: number;
  troughDark: number;
  grazeCyan: number;
  shallowMix: number;
  // shoreline event (one cycle drives foam + swash + wet sand)
  foamWidth: number;
  foamStrength: number;
  foamPhase: number; // cycle position where foam is born
  swashPhase: number; // cycle position where the swash starts advancing
  swashRetreat: number; // fraction of the cycle the retreat takes
  swashRunup: number;
  wetDecay: number;
  alongDensity: number; // nearshore samples per metre (applied on level load)
}

// Baked from the playtester's Water Studio session (Copy JSON, 2026-08-06):
// long slow rollers, near-still medium chop, hot brightness with deep navy
// troughs and full cyan graze, quick swash with a long retreat.
export const WATER_DEFAULTS: WaterParams = {
  amp1: 0.925, len1: 80, spd1: 0.32,
  amp2: 0.157, len2: 28.9, spd2: 0.298,
  amp3: 0.25, len3: 9.84, spd3: 0.009,
  amp4: 0.043, len4: 8.02, spd4: 4.61,
  shoreAmp: 0.072,
  shoreSpeed: 0.779,
  shoreLenMin: 12,
  shoreLenMax: 13.6,
  shoalLift: 2.2,
  shape2: 0.265,
  alongA: 0.9,
  alongB: 0.349,
  stableElev: 0.502,
  stableBias: 0.027,
  camInfluence: 0,
  uScale: 0.16,
  vScale: 0.533,
  distort: 1.16,
  worldU: 0.002,
  worldV: 0.00025,
  palette: 19,
  brightness: 1.7,
  troughDark: 0.604,
  grazeCyan: 1,
  shallowMix: 1,
  foamWidth: 0.256,
  foamStrength: 0.542,
  foamPhase: 0.119,
  swashPhase: 0.016,
  swashRetreat: 0.9,
  swashRunup: 5.88,
  wetDecay: 1.84,
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
  course: { x: number; z: number }[];
  terrainHeight: (x: number, z: number) => number;
}

// ---- fixed world-space density bands (distance from the COASTLINE) --------
// Authored once at level build; never changed while playing.
const BANDS = [
  { max: 82, chunk: 48, verts: 21 }, // 0-80m offshore: 2.4m cells
  { max: 205, chunk: 96, verts: 21 }, // 80-200m: 4.8m cells
  { max: Infinity, chunk: 160, verts: 17 }, // beyond: 10m cells
];
const SEA_MARGIN = 720;
const INLAND_KEEP = 60;
const SHORE_ROWS = [
  0, 0.25, 0.55, 0.9, 1.35, 1.9, 2.6, 3.5, 4.7, 6.1, 7.9, 10.2, 13, 16.5, 21,
  27, 34, 42,
];
const RIBBON_MASK = 41.5; // chunk triangles inside this die: one surface per region
const BLEND_LO = 26;
const BLEND_HI = 40;

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

// ---- the reflection source: the ACTUAL level skybox as a small indexed
// texture. Downsampled once per sky, quantized to one shared global palette
// (not per-channel), nearest-filtered — a PS1 indexed texture the GPU
// samples across the water polygons.
class SkyTexture {
  ready = false;
  url = "";
  texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private raw: ImageData | null = null; // pre-quantization, for re-paletting
  private paletteSize = -1;
  private labelled = false;
  fogHex = 0xd08a7e;

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
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  horizonV = 1 - 600 / 887; // the painting's horizon row (per-preset, see main)

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
      const g = this.canvas.getContext("2d")!;
      const HORIZON_V = this.horizonV;
      const K = 2.15;
      const vTop = Math.min(1, HORIZON_V + 0.5 * K * (1 - HORIZON_V));
      for (let r = 0; r < h; r++) {
        // canvas row h-1 = horizon (texture v=0 with flipY), row 0 = zenith
        const v = HORIZON_V + (r / (h - 1)) * (vTop - HORIZON_V);
        const sy = Math.max(0, Math.min(img.height - 1, (1 - v) * img.height));
        g.drawImage(img, 0, sy, img.width, 1, 0, h - 1 - r, w, 1);
      }
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

interface Chunk {
  bounds: THREE.Box3;
  mesh: THREE.Mesh;
}

const V3 = new THREE.Vector3();
const FRUSTUM = new THREE.Frustum();
const PROJ = new THREE.Matrix4();

export class CoastWater {
  group = new THREE.Group();
  params: WaterParams = { ...WATER_DEFAULTS };
  debug = {
    far: true,
    near: true,
    foam: true,
    swash: true,
    wet: true,
    freeze: false,
    wireframe: false,
    texture: true, // off = GEOMETRY ONLY (swells read by modulation alone)
    modulation: true, // off = RAW SKY TEXTURE
    lockCam: false, // force camInfluence to 0 regardless of the slider
    testAtlas: false, // labelled sky source
    coast: false,
  };
  stats = { chunksVisible: 0, chunksTotal: 0, nearTris: 0, clippedTris: 0 };

  private time = 0;
  private shore: ShoreSample[] = []; // RESAMPLED, with true local normals
  private arc: number[] = [];
  private seaLevel: number;
  private dirX: number;
  private dirZ: number;
  private skyRightX: number; // level-fixed axes for world UV drift
  private skyRightZ: number;
  private terrain: (x: number, z: number) => number;
  private sky = new SkyTexture();

  private chunks: Chunk[] = [];
  private waterMat: THREE.MeshBasicMaterial;
  private near: THREE.Mesh;
  private nearMax = 0;
  private foam: THREE.Mesh;
  private swash: THREE.Mesh;
  private wet: THREE.Mesh;
  private coastDebug: THREE.LineSegments | null = null;

  private rowPos: Float32Array;
  private rowTerrain: Float32Array;
  private rowDepth: Float32Array;
  private wetness: number[];
  private phaseAt: number[] = [];
  private phaseLenMin = -1;
  private phaseLenMax = -1;
  private gh: Float32Array; // per-grid-vertex height
  private gc: Float32Array; // colour
  private guv: Float32Array; // reflection UV

  constructor(opts: CoastWaterOpts) {
    this.seaLevel = opts.seaLevel;
    this.dirX = opts.shoreDirX;
    this.dirZ = opts.shoreDirZ;
    this.skyRightX = -this.dirZ; // perpendicular of the shore axis, level-fixed
    this.skyRightZ = this.dirX;
    this.terrain = opts.terrainHeight;
    this.resampleShore(opts.shore);

    const NS = this.shore.length;
    const NR = SHORE_ROWS.length;
    this.wetness = new Array(NS).fill(0);
    this.rowPos = new Float32Array(NS * NR * 2);
    this.rowTerrain = new Float32Array(NS * NR);
    this.rowDepth = new Float32Array(NS * NR);
    for (let i = 0; i < NS; i++) {
      const S = this.shore[i];
      for (let r = 0; r < NR; r++) {
        const x = S.x + S.sx * SHORE_ROWS[r];
        const z = S.z + S.sz * SHORE_ROWS[r];
        const k = (i * NR + r) * 2;
        this.rowPos[k] = x;
        this.rowPos[k + 1] = z;
        const ty = this.terrain(x, z);
        this.rowTerrain[i * NR + r] = ty;
        this.rowDepth[i * NR + r] = Math.max(0, this.seaLevel - ty);
      }
    }
    this.gh = new Float32Array(NS * NR);
    this.gc = new Float32Array(NS * NR * 3);
    this.guv = new Float32Array(NS * NR * 2);

    this.waterMat = new THREE.MeshBasicMaterial({
      map: this.sky.texture,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    this.buildChunks(opts.course);

    this.nearMax = (NS - 1) * (NR - 1) * 4 * 3;
    const ng = new THREE.BufferGeometry();
    ng.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.nearMax * 3), 3),
    );
    ng.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(this.nearMax * 3), 3),
    );
    ng.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array(this.nearMax * 2), 2),
    );
    this.near = new THREE.Mesh(ng, this.waterMat);
    this.near.name = "nearshore water";
    this.near.frustumCulled = false;

    const foamMat = new THREE.MeshBasicMaterial({
      map: makeFoamTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.foam = gridMesh(NS, 2, foamMat, "breaker foam", 4);
    const swashMat = new THREE.MeshBasicMaterial({
      map: makeSwashTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.swash = gridMesh(NS, 3, swashMat, "swash", 4);
    const wetMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      side: THREE.DoubleSide,
    });
    this.wet = gridMesh(NS, 2, wetMat, "wet sand", 4);
    this.group.add(this.near, this.foam, this.swash, this.wet);
  }

  // §5+§6: densify the authored spline (~1.7m alongshore) and compute REAL
  // local sea normals from neighbour tangents — the crescent's rows, foam,
  // swash and wet sand all follow the actual curve, not one shared Rv.
  private resampleShore(coarse: ShoreSample[]): void {
    let len = 0;
    for (let i = 1; i < coarse.length; i++)
      len += Math.hypot(
        coarse[i].x - coarse[i - 1].x,
        coarse[i].z - coarse[i - 1].z,
      );
    const NS = Math.max(
      16,
      Math.round(len * clamp(this.params.alongDensity, 0.2, 2)),
    );
    const pts: { x: number; z: number }[] = [];
    for (let i = 0; i < NS; i++) {
      const f = (i / (NS - 1)) * (coarse.length - 1);
      const j = Math.min(coarse.length - 2, Math.floor(f));
      const u = f - j;
      pts.push({
        x: lerp(coarse[j].x, coarse[j + 1].x, u),
        z: lerp(coarse[j].z, coarse[j + 1].z, u),
      });
    }
    // offshore reference: well out to sea of the spline's centroid — used to
    // orient every local normal consistently seaward
    let cx = 0;
    let cz = 0;
    for (const p of pts) {
      cx += p.x / NS;
      cz += p.z / NS;
    }
    const refX = cx + this.dirX * -300;
    const refZ = cz + this.dirZ * -300;
    const norms: { x: number; z: number }[] = [];
    for (let i = 0; i < NS; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(NS - 1, i + 1)];
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
      norms.push({ x: nx, z: nz });
    }
    // smooth the normals over three samples, then renormalize
    const sm: { x: number; z: number }[] = [];
    for (let i = 0; i < NS; i++) {
      const a = norms[Math.max(0, i - 1)];
      const b = norms[i];
      const c = norms[Math.min(NS - 1, i + 1)];
      let nx = a.x + 2 * b.x + c.x;
      let nz = a.z + 2 * b.z + c.z;
      const l = Math.hypot(nx, nz) || 1;
      sm.push({ x: nx / l, z: nz / l });
    }
    const slope = coarse[0];
    this.shore = pts.map((p, i) => ({
      x: p.x,
      z: p.z,
      sx: sm[i].x,
      sz: sm[i].z,
      beachSlope: slope.beachSlope,
      bedSlope: slope.bedSlope,
    }));
    this.arc = [];
    let acc = 0;
    for (let i = 0; i < NS; i++) {
      if (i > 0)
        acc += Math.hypot(
          this.shore[i].x - this.shore[i - 1].x,
          this.shore[i].z - this.shore[i - 1].z,
        );
      this.arc.push(acc);
    }
  }

  // §1: fixed chunk field in authored density bands (distance from the
  // coastline, never the camera). Every chunk keeps ONE mesh forever.
  private buildChunks(course: { x: number; z: number }[]): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of course) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    minX -= SEA_MARGIN;
    maxX += SEA_MARGIN;
    minZ -= SEA_MARGIN;
    maxZ += SEA_MARGIN;
    const side = (x: number, z: number): number => {
      let best = Infinity;
      let bi = 0;
      for (let i = 0; i < course.length; i += 2) {
        const d = (x - course[i].x) ** 2 + (z - course[i].z) ** 2;
        if (d < best) {
          best = d;
          bi = i;
        }
      }
      const a = course[Math.max(0, bi - 2)];
      const b = course[Math.min(course.length - 1, bi + 2)];
      const tx = b.x - a.x;
      const tz = b.z - a.z;
      const tl = Math.hypot(tx, tz) || 1;
      return ((x - course[bi].x) * -tz + (z - course[bi].z) * tx) / tl;
    };
    const shoreDist = (x: number, z: number): number => {
      let best = Infinity;
      for (let i = 0; i < this.shore.length; i += 3) {
        const s = this.shore[i];
        best = Math.min(best, Math.hypot(x - s.x, z - s.z));
      }
      return best;
    };
    for (let b = 0; b < BANDS.length; b++) {
      const band = BANDS[b];
      const lo = b === 0 ? -Infinity : BANDS[b - 1].max;
      for (let gx = minX; gx < maxX; gx += band.chunk)
        for (let gz = minZ; gz < maxZ; gz += band.chunk) {
          const ccx = gx + band.chunk / 2;
          const ccz = gz + band.chunk / 2;
          const d = shoreDist(ccx, ccz);
          // the band owns the chunk if its CENTRE falls in the band's ring
          if (d >= band.max || d < lo) continue;
          if (side(ccx, ccz) < -INLAND_KEEP && d > 90) continue;
          const mesh = this.chunkMesh(gx, gz, band.chunk, band.verts, d < 120);
          mesh.visible = false;
          this.group.add(mesh);
          this.chunks.push({
            bounds: new THREE.Box3(
              new THREE.Vector3(gx, this.seaLevel - 2, gz),
              new THREE.Vector3(gx + band.chunk, this.seaLevel + 2, gz + band.chunk),
            ),
            mesh,
          });
        }
    }
    this.stats.chunksTotal = this.chunks.length;
  }

  private chunkMesh(
    gx: number,
    gz: number,
    size: number,
    nv: number,
    nearShore: boolean,
  ): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    const n = nv * nv;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const masked: boolean[] = new Array(n).fill(false);
    for (let r = 0; r < nv; r++)
      for (let c = 0; c < nv; c++) {
        const i = r * nv + c;
        const x = gx + (c / (nv - 1)) * size;
        const z = gz + (r / (nv - 1)) * size;
        pos[i * 3] = x;
        pos[i * 3 + 1] = this.seaLevel;
        pos[i * 3 + 2] = z;
        if (nearShore) {
          for (let si = 0; si < this.shore.length; si += 2) {
            const s = this.shore[si];
            const dx = x - s.x;
            const dz = z - s.z;
            if (dx * dx + dz * dz < RIBBON_MASK * RIBBON_MASK) {
              masked[i] = true;
              break;
            }
          }
        }
      }
    const idx: number[] = [];
    for (let r = 0; r < nv - 1; r++)
      for (let c = 0; c < nv - 1; c++) {
        const k = r * nv + c;
        if (masked[k] || masked[k + 1] || masked[k + nv] || masked[k + nv + 1])
          continue;
        idx.push(k, k + nv, k + 1, k + 1, k + nv, k + nv + 1);
      }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, this.waterMat);
    m.name = "ocean chunk";
    m.frustumCulled = false;
    return m;
  }

  // ---- waves ---------------------------------------------------------------
  private waveSet(): Wave[] {
    const p = this.params;
    const base = Math.atan2(this.dirZ, this.dirX);
    const defs: [number, number, number, number][] = [
      [p.amp1, p.len1, p.spd1, 0.16],
      [p.amp2, p.len2, p.spd2, -0.85],
      [p.amp3, p.len3, p.spd3, 0.55],
      [p.amp4, p.len4, p.spd4, 2.1],
    ];
    return defs.map(([a, len, spd, off], i) => {
      const k = TAU / Math.max(0.5, len);
      return {
        a,
        kx: Math.cos(base + off) * k,
        kz: Math.sin(base + off) * k,
        spd,
        ph: i * 1.7,
      };
    });
  }

  private waves: Wave[] = [];
  private wavesDirty = true;
  markWavesDirty(): void {
    this.wavesDirty = true;
    this.phaseLenMin = -1;
  }

  // EVERY surface evaluates all four waves — no camera-dependent wave count
  private sampleWaves(
    x: number,
    z: number,
    t: number,
    out: { h: number; dx: number; dz: number },
  ): void {
    let h = 0;
    let dx = 0;
    let dz = 0;
    for (let i = 0; i < 4; i++) {
      const w = this.waves[i];
      const ph = w.kx * x + w.kz * z - w.spd * t + w.ph;
      h += w.a * tsin(ph);
      const c = w.a * tcos(ph);
      dx += c * w.kx;
      dz += c * w.kz;
    }
    out.h = h;
    out.dx = dx;
    out.dz = dz;
  }

  // ---- §7: the ONE unified surface sampler --------------------------------
  // rendering, foam, swash, floating objects and collision all come here
  private scratch = { h: 0, dx: 0, dz: 0 };
  sampleWaterSurface(x: number, z: number, t = this.time): SurfaceSample {
    if (this.wavesDirty) {
      this.waves = this.waveSet();
      this.wavesDirty = false;
    }
    // nearest coastline sample -> (s, d) coordinates
    let bi = 0;
    let best = Infinity;
    for (let i = 0; i < this.shore.length; i++) {
      const s = this.shore[i];
      const dd = (x - s.x) ** 2 + (z - s.z) ** 2;
      if (dd < best) {
        best = dd;
        bi = i;
      }
    }
    const S = this.shore[bi];
    const d = (x - S.x) * S.sx + (z - S.z) * S.sz; // offshore distance
    return this.sampleAt(x, z, bi, d, t);
  }

  private sampleAt(
    x: number,
    z: number,
    si: number,
    d: number,
    t: number,
  ): SurfaceSample {
    const o = this.scratch;
    this.sampleWaves(x, z, t, o);
    const ty = this.terrain(x, z);
    const depth = Math.max(0, this.seaLevel - ty);
    const crossK = sstep(depth, 1.5, 5);
    const smallK = sstep(depth, 0.8, 3);
    // shallow suppression of crossing + small waves
    let h = o.h;
    for (let wi = 1; wi < 4; wi++) {
      const sup = wi === 1 ? crossK : smallK;
      const w = this.waves[wi];
      const ph = w.kx * x + w.kz * z - w.spd * t + w.ph;
      h -= w.a * tsin(ph) * (1 - sup);
    }
    const shorePhase = this.shorePhaseAtD(si, Math.max(0, d), t);
    const shoreW = this.shoreShape(shorePhase) * this.shoreAmpAt(depth);
    const blend = sstep(d, BLEND_LO, BLEND_HI);
    const height =
      this.seaLevel +
      lerp(h * lerp(0.55, 1, crossK) + shoreW, o.h, blend);
    const inf = 1 - blend;
    // analytic offshore slope + a shore-wave slope estimate along the normal
    const eps = 0.6;
    const sp2 = this.shorePhaseAtD(si, Math.max(0, d + eps), t);
    const shoreSlope =
      ((this.shoreShape(sp2) - this.shoreShape(shorePhase)) *
        this.shoreAmpAt(depth)) /
      eps;
    const nx = -(o.dx + shoreSlope * this.shore[si].sx * inf);
    const nz = -(o.dz + shoreSlope * this.shore[si].sz * inf);
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
    for (let j = 1; j < SHORE_ROWS.length; j++) {
      const mid = (SHORE_ROWS[j] + SHORE_ROWS[j - 1]) / 2;
      const depth = Math.max(
        0.12,
        mid * (this.shore[0]?.bedSlope ?? 0.13) + 0.1,
      );
      const lam = lerp(p.shoreLenMin, p.shoreLenMax, sstep(depth, 0.5, 5));
      acc += (TAU / lam) * (SHORE_ROWS[j] - SHORE_ROWS[j - 1]);
      this.phaseAt.push(acc);
    }
    this.phaseLenMin = p.shoreLenMin;
    this.phaseLenMax = p.shoreLenMax;
  }

  private phaseOfD(d: number): number {
    let j = 1;
    while (j < SHORE_ROWS.length - 1 && SHORE_ROWS[j] < d) j++;
    const f = clamp(
      (d - SHORE_ROWS[j - 1]) / (SHORE_ROWS[j] - SHORE_ROWS[j - 1] || 1),
      0,
      1,
    );
    return lerp(this.phaseAt[j - 1], this.phaseAt[j], f);
  }

  private shorePhaseAtD(si: number, d: number, t: number): number {
    return (
      -this.phaseOfD(Math.min(d, SHORE_ROWS[SHORE_ROWS.length - 1])) +
      this.alongshore(this.arc[si], t) -
      t * this.params.shoreSpeed
    );
  }

  private alongshore(s: number, t: number): number {
    const p = this.params;
    return (
      tsin(s * 0.11 + t * 0.3) * p.alongA + tsin(s * 0.037 - t * 0.16) * p.alongB
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
  // are stages of this same number (§8) — no independent timers
  private cycleAt(si: number, t: number): number {
    const ph0 = this.alongshore(this.arc[si], t) - t * this.params.shoreSpeed;
    const c = -ph0 / TAU;
    return ((c % 1) + 1) % 1;
  }

  // ---- reflection UVs (§2-§4) ---------------------------------------------
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

  private camX = 0;
  private camY = 0;
  private camZ = 0;

  // per-vertex: stable world-space reflection -> UV into the sky texture,
  // plus Gouraud modulation colour. The GPU paints the actual sky texture
  // ACROSS the polygon between these UVs — that is the whole trick.
  // per-frame invariants hoisted out of the vertex loops (pure speed — the
  // values themselves stay camera-independent unless camInfluence is dialed)
  private fvx = 0;
  private fvy = 1;
  private fvz = 0;
  private fInf = 0;
  private fMod = true;
  private prepFrame(): void {
    const p = this.params;
    let vx = -this.dirX * p.stableBias;
    let vy = p.stableElev;
    let vz = -this.dirZ * p.stableBias;
    const vl = Math.hypot(vx, vy, vz) || 1;
    this.fvx = vx / vl;
    this.fvy = vy / vl;
    this.fvz = vz / vl;
    this.fInf = this.debug.lockCam ? 0 : clamp(p.camInfluence, 0, 0.15);
    this.fMod = this.debug.modulation;
  }

  private shadeVertex(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    h: number,
    depth: number,
    col: Float32Array,
    ci: number,
    uvA: Float32Array,
    ui: number,
  ): void {
    const p = this.params;
    // exaggerate the normal's tilt into the reflection (studio: distort)
    const g = p.distort;
    let mx = nx * g;
    let mz = nz * g;
    let my = ny;
    const ml = Math.hypot(mx, my, mz) || 1;
    mx /= ml;
    my /= ml;
    mz /= ml;
    // fixed nominal view direction (level space, NOT the camera)
    let vx = this.fvx;
    let vy = this.fvy;
    let vz = this.fvz;
    // optional restrained camera influence (default 0; LOCK forces 0)
    const inf = this.fInf;
    if (inf > 0) {
      let ax = this.camX - px;
      let ay = this.camY - py;
      let az = this.camZ - pz;
      const al = Math.hypot(ax, ay, az) || 1;
      vx = vx * (1 - inf) + (ax / al) * inf;
      vy = vy * (1 - inf) + (ay / al) * inf;
      vz = vz * (1 - inf) + (az / al) * inf;
    }
    // R = reflect(-V, N)
    const dvn = (vx * mx + vy * my + vz * mz) * 2;
    const rx = dvn * mx - vx;
    const ry = dvn * my - vy;
    const rz = dvn * mz - vz;
    // linear reflection->UV (see header): continuous, seam-free
    const along = px * this.skyRightX + pz * this.skyRightZ;
    const outward = px * this.dirX + pz * this.dirZ;
    const u =
      0.5 +
      (rx * this.skyRightX + rz * this.skyRightZ) * p.uScale +
      along * p.worldU +
      outward * 0.0003;
    const v = clamp(
      0.63 + (ry - vy) * 2.1 * p.vScale + outward * p.worldV,
      0.02,
      0.98,
    );
    uvA[ui] = u;
    uvA[ui + 1] = v;
    // Gouraud modulation only shapes the water — the texture is the pattern
    let mr = 1;
    let mg = 1;
    let mb = 1;
    if (this.fMod) {
      const shal = (1 - sstep(depth, 0.25, 3.5)) * p.shallowMix;
      mr = lerp(105, 128, shal) / 160;
      mg = lerp(135, 205, shal) / 160;
      mb = lerp(185, 200, shal) / 160;
      const k = clamp(h / (p.amp1 + 0.2), -1, 1);
      const dark = 1 + k * p.troughDark;
      mr *= dark;
      mg *= dark;
      mb *= dark * 1.02;
      const graze = (1 - Math.abs(ny)) * 2.4 * p.grazeCyan;
      mr = mr * (1 - graze) + graze * 0.62;
      mg = mg * (1 - graze) + graze * 1.05;
      mb = mb * (1 - graze) + graze * 1.05;
    }
    const B = p.brightness;
    col[ci] = mr * B;
    col[ci + 1] = mg * B;
    col[ci + 2] = mb * B;
  }

  // ---- per-frame -----------------------------------------------------------
  update(dt: number, camera: THREE.Camera): void {
    if (!this.debug.freeze) this.time += dt;
    if (this.wavesDirty) {
      this.waves = this.waveSet();
      this.wavesDirty = false;
    }
    if (
      this.phaseLenMin !== this.params.shoreLenMin ||
      this.phaseLenMax !== this.params.shoreLenMax
    )
      this.rebuildPhaseTable();
    if (this.debug.testAtlas) this.sky.applyTestAtlas();
    else this.sky.applyPalette(Math.round(this.params.palette));
    const cam = camera.getWorldPosition(V3);
    this.camX = cam.x;
    this.camY = cam.y;
    this.camZ = cam.z;
    this.waterMat.wireframe = this.debug.wireframe;
    this.prepFrame();
    const wantMap = this.debug.texture ? this.sky.texture : null;
    if (this.waterMat.map !== wantMap) {
      this.waterMat.map = wantMap;
      this.waterMat.needsUpdate = true;
    }

    this.updateChunks(camera);
    this.near.visible = this.debug.near;
    if (this.debug.near) this.updateNearshore();
    this.foam.visible = this.debug.foam;
    this.swash.visible = this.debug.swash;
    this.wet.visible = this.debug.wet;
    this.updateShoreline(dt);
    this.updateCoastDebug();
  }

  // §1: every visible chunk updates from the same wave function on every
  // rendered frame — the camera only culls
  private updateChunks(camera: THREE.Camera): void {
    PROJ.multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix,
      (camera as THREE.PerspectiveCamera).matrixWorldInverse,
    );
    FRUSTUM.setFromProjectionMatrix(PROJ);
    const o = this.scratch;
    let visible = 0;
    for (const ch of this.chunks) {
      const inView = this.debug.far && FRUSTUM.intersectsBox(ch.bounds);
      ch.mesh.visible = inView;
      if (!inView) continue;
      visible++;
      const pos = ch.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = ch.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
      const uv = ch.mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
      const pa = pos.array as Float32Array;
      const ca = col.array as Float32Array;
      const ua = uv.array as Float32Array;
      const n = pos.count;
      for (let i = 0; i < n; i++) {
        const x = pa[i * 3];
        const z = pa[i * 3 + 2];
        this.sampleWaves(x, z, this.time, o);
        const y = this.seaLevel + o.h;
        pa[i * 3 + 1] = y;
        const nl = Math.hypot(o.dx, 1, o.dz);
        this.shadeVertex(
          x, y, z,
          -o.dx / nl, 1 / nl, -o.dz / nl,
          o.h, 30, ca, i * 3, ua, i * 2,
        );
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      uv.needsUpdate = true;
    }
    this.stats.chunksVisible = visible;
  }

  private updateNearshore(): void {
    const NS = this.shore.length;
    const NR = SHORE_ROWS.length;
    const t = this.time;
    // pass 1: heights via the unified sampler math (fast path: si/d known)
    for (let i = 0; i < NS; i++) {
      for (let r = 0; r < NR; r++) {
        const k = i * NR + r;
        const x = this.rowPos[k * 2];
        const z = this.rowPos[k * 2 + 1];
        const depth = this.rowDepth[k];
        const o = this.scratch;
        this.sampleWaves(x, z, t, o);
        const crossK = sstep(depth, 1.5, 5);
        const smallK = sstep(depth, 0.8, 3);
        let h = o.h;
        for (let wi = 1; wi < 4; wi++) {
          const sup = wi === 1 ? crossK : smallK;
          const w = this.waves[wi];
          const ph = w.kx * x + w.kz * z - w.spd * t + w.ph;
          h -= w.a * tsin(ph) * (1 - sup);
        }
        const shoreW =
          this.shoreShape(this.shorePhaseAtD(i, SHORE_ROWS[r], t)) *
          this.shoreAmpAt(depth);
        const blend = sstep(SHORE_ROWS[r], BLEND_LO, BLEND_HI);
        this.gh[k] = lerp(h * lerp(0.55, 1, crossK) + shoreW, o.h, blend);
      }
    }
    // pass 2: shared per-grid-vertex colour + UV (continuity across cells)
    for (let i = 0; i < NS; i++) {
      for (let r = 0; r < NR; r++) {
        const k = i * NR + r;
        const x = this.rowPos[k * 2];
        const z = this.rowPos[k * 2 + 1];
        const y = this.seaLevel + this.gh[k];
        const iN = Math.min(NS - 1, i + 1);
        const rN = Math.min(NR - 1, r + 1);
        const dxs =
          Math.hypot(
            this.rowPos[(iN * NR + r) * 2] - x,
            this.rowPos[(iN * NR + r) * 2 + 1] - z,
          ) || 1;
        const dzs = SHORE_ROWS[rN] - SHORE_ROWS[r] || 1;
        const sAlong = (this.gh[iN * NR + r] - this.gh[k]) / dxs;
        const sCross = (this.gh[i * NR + rN] - this.gh[k]) / dzs;
        const nx = -sAlong;
        const nz = -sCross;
        const nl = Math.hypot(nx, 1, nz);
        this.shadeVertex(
          x, y, z, nx / nl, 1 / nl, nz / nl,
          this.gh[k], this.rowDepth[k],
          this.gc, k * 3, this.guv, k * 2,
        );
      }
    }
    // pass 3: terrain clip + emit (position, colour AND uv interpolate)
    const pos = this.near.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.near.geometry.getAttribute("color") as THREE.BufferAttribute;
    const uv = this.near.geometry.getAttribute("uv") as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;
    const ua = uv.array as Float32Array;
    let vtx = 0;
    let clipped = 0;
    const P: number[][] = [[], [], [], []];
    const C: number[][] = [[], [], [], []];
    const U: number[][] = [[], [], [], []];
    const CL: number[] = [0, 0, 0, 0];
    const corner = (slot: number, i: number, r: number): void => {
      const k = i * NR + r;
      const y = this.seaLevel + this.gh[k];
      P[slot][0] = this.rowPos[k * 2];
      P[slot][1] = y;
      P[slot][2] = this.rowPos[k * 2 + 1];
      C[slot][0] = this.gc[k * 3];
      C[slot][1] = this.gc[k * 3 + 1];
      C[slot][2] = this.gc[k * 3 + 2];
      U[slot][0] = this.guv[k * 2];
      U[slot][1] = this.guv[k * 2 + 1];
      CL[slot] = y - this.rowTerrain[k];
    };
    const emit1 = (p: number[], c: number[], u: number[]): void => {
      pa[vtx * 3] = p[0];
      pa[vtx * 3 + 1] = p[1];
      pa[vtx * 3 + 2] = p[2];
      ca[vtx * 3] = c[0];
      ca[vtx * 3 + 1] = c[1];
      ca[vtx * 3 + 2] = c[2];
      ua[vtx * 2] = u[0];
      ua[vtx * 2 + 1] = u[1];
      vtx++;
    };
    const cutP: number[] = [0, 0, 0];
    const cutC: number[] = [0, 0, 0];
    const cutU: number[] = [0, 0];
    const cut = (w: number, d: number): void => {
      const f = CL[w] / (CL[w] - CL[d]);
      for (let q = 0; q < 3; q++) {
        cutP[q] = P[w][q] + (P[d][q] - P[w][q]) * f;
        cutC[q] = C[w][q] + (C[d][q] - C[w][q]) * f;
      }
      cutU[0] = U[w][0] + (U[d][0] - U[w][0]) * f;
      cutU[1] = U[w][1] + (U[d][1] - U[w][1]) * f;
    };
    const clipTri = (ia: number, ib: number, ic: number): void => {
      if (vtx + 12 > this.nearMax) return;
      const wet = [CL[ia] > 0, CL[ib] > 0, CL[ic] > 0];
      const nWet = (wet[0] ? 1 : 0) + (wet[1] ? 1 : 0) + (wet[2] ? 1 : 0);
      if (nWet === 0) return;
      if (nWet === 3) {
        emit1(P[ia], C[ia], U[ia]);
        emit1(P[ib], C[ib], U[ib]);
        emit1(P[ic], C[ic], U[ic]);
        return;
      }
      clipped++;
      const order = [ia, ib, ic].sort(
        (a, b) => (CL[b] > 0 ? 1 : 0) - (CL[a] > 0 ? 1 : 0),
      );
      if (nWet === 1) {
        const w = order[0];
        emit1(P[w], C[w], U[w]);
        cut(w, order[1]);
        emit1([...cutP], [...cutC], [...cutU]);
        cut(w, order[2]);
        emit1([...cutP], [...cutC], [...cutU]);
      } else {
        const w0 = order[0];
        const w1 = order[1];
        const d = order[2];
        cut(w0, d);
        const e0p = [...cutP];
        const e0c = [...cutC];
        const e0u = [...cutU];
        cut(w1, d);
        emit1(P[w0], C[w0], U[w0]);
        emit1(P[w1], C[w1], U[w1]);
        emit1(e0p, e0c, e0u);
        emit1(P[w1], C[w1], U[w1]);
        emit1([...cutP], [...cutC], [...cutU]);
        emit1(e0p, e0c, e0u);
      }
    };
    for (let i = 0; i < NS - 1; i++)
      for (let r = 0; r < NR - 1; r++) {
        corner(0, i, r);
        corner(1, i + 1, r);
        corner(2, i, r + 1);
        corner(3, i + 1, r + 1);
        clipTri(0, 2, 1);
        clipTri(1, 2, 3);
      }
    this.near.geometry.setDrawRange(0, vtx);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    uv.needsUpdate = true;
    this.stats.nearTris = Math.floor(vtx / 3);
    this.stats.clippedTris = clipped;
  }

  // §8: foam, swash and wet sand as stages of the SAME shore-wave cycle
  private updateShoreline(dt: number): void {
    const t = this.time;
    const NS = this.shore.length;
    const p = this.params;

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

    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const cycle = this.cycleAt(si, t);

      // BREAKER: locate the physical crest via the integrated phase table
      const base = this.alongshore(this.arc[si], t) - t * p.shoreSpeed;
      let crossX = -1;
      let zone = 0;
      for (let j = SHORE_ROWS.length - 5; j >= 1; j--) {
        const a0 = -this.phaseAt[j] + base;
        const a1 = -this.phaseAt[j - 1] + base;
        const lo = Math.min(a0, a1);
        const hi = Math.max(a0, a1);
        const n0 = Math.ceil((lo - Math.PI / 2) / TAU);
        const crest = Math.PI / 2 + n0 * TAU;
        if (crest <= hi) {
          const f = (crest - a0) / (a1 - a0 || 1);
          crossX = lerp(SHORE_ROWS[j], SHORE_ROWS[j - 1], f);
          const depth = Math.max(0.1, crossX * S.bedSlope + 0.1);
          zone =
            (1 - sstep(depth, 0.8, 1.6)) * sstep(depth, 0.15, 0.45);
          break;
        }
      }
      // the foam window rides the same cycle the swash uses
      const fWin = winEnv(cycle, p.foamPhase, 0.4);
      const strength = zone * p.foamStrength * (0.35 + 0.65 * fWin);
      const active = crossX > 0 && strength > 0.02;
      const cx = active ? crossX : 5;
      for (let r = 0; r < 2; r++) {
        const d = cx + (r === 0 ? p.foamWidth : -p.foamWidth);
        const px = S.x + S.sx * d;
        const pz = S.z + S.sz * d;
        // §7: the foam sits on the UNIFIED surface — shore wave included
        const py = active
          ? this.sampleAt(px, pz, si, d, t).height + 0.05
          : this.seaLevel;
        const vi = r * NS + si;
        fPos.setXYZ(vi, px, py, pz);
        fUv.setXY(vi, this.arc[si] * 0.14, r);
        fCol.setXYZW(vi, 1, 1, 1, active ? strength * (r === 0 ? 0.75 : 0.4) : 0);
      }

      // SWASH: phase windows of the SAME cycle (advance fast, retreat slow)
      const advLen = Math.max(0.06, 0.17);
      const retLen = clamp(p.swashRetreat, 0.1, 0.9);
      let travel = 0;
      const cRel = ((cycle - p.swashPhase) % 1 + 1) % 1;
      if (cRel < advLen) travel = easeOutCubic(cRel / advLen);
      else if (cRel < advLen + retLen)
        travel = 1 - easeInOutQuad((cRel - advLen) / retLen);
      const local = 0.7 + 0.3 * tsin(this.arc[si] * 0.21 + t * 0.4);
      const runup = p.swashRunup * travel * local;
      this.wetness[si] = Math.max(
        this.wetness[si] * Math.exp(-dt / Math.max(0.5, p.wetDecay)),
        travel * local,
      );
      const rows: [number, number, number, number, number, number][] = [
        [runup, 1, 1, 1, 0.85, 0], // leading edge at texture v=0
        [runup - 2.2, 0.75, 0.85, 0.9, 0.4, 0.55],
        [-0.7, 0.6, 0.75, 0.8, 0.5, 1],
      ];
      for (let r = 0; r < 3; r++) {
        const [dIn, cr, cg, cb, cal, tv] = rows[r];
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        sPos.setXYZ(r * NS + si, px, this.terrain(px, pz) + 0.04, pz);
        sUv.setXY(r * NS + si, this.arc[si] * 0.2, tv);
        sCol.setXYZW(r * NS + si, cr, cg, cb, cal * (0.25 + 0.75 * travel));
      }

      // WET SAND: remains after the connected swash event retreats
      const w = this.wetness[si];
      for (let r = 0; r < 2; r++) {
        const dIn = r === 0 ? p.swashRunup * w : -0.4;
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        wPos.setXYZ(r * NS + si, px, this.terrain(px, pz) + 0.025, pz);
        const dark = r === 0 ? 1 : 1 - w * 0.32;
        wCol.setXYZW(r * NS + si, dark, dark, Math.min(1, dark * 1.04), 1);
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
      const NS = this.shore.length;
      for (let i = 0; i < NS; i++) {
        const S = this.shore[i];
        const y = this.seaLevel + 0.6;
        if (i < NS - 1) {
          const T = this.shore[i + 1];
          pts.push(S.x, y, S.z, T.x, y, T.z);
        }
        if (i % 4 === 0)
          pts.push(S.x, y, S.z, S.x + S.sx * 4, y, S.z + S.sz * 4);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
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
  const c = ((cycle - start) % 1 + 1) % 1;
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
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
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

// §9: connected cellular foam streaks — long irregular body, branching thin
// fingers, big transparent holes, one dense side, dithered fade, cyan under
// white. Drawn once, indexed-look, nearest filtered.
function makeFoamTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 32);
  // cyan underlayer: a broad broken band hugging the dense side
  g.fillStyle = "rgba(150,225,230,0.55)";
  for (let x = 0; x < 128; x += 3) {
    const wob = Math.sin(x * 0.22) * 3 + Math.sin(x * 0.07) * 4;
    if (Math.sin(x * 0.4) > -0.6) g.fillRect(x, 10 + wob, 3, 12);
  }
  // main white body: connected wandering streak
  g.fillStyle = "rgba(255,255,255,0.95)";
  let y = 14;
  for (let x = 0; x < 128; x += 2) {
    y += Math.round(Math.sin(x * 0.3) + Math.sin(x * 0.11) * 1.4);
    y = Math.max(4, Math.min(24, y));
    const th = 2 + (Math.sin(x * 0.17) > 0.2 ? 2 : 0);
    if (Math.sin(x * 0.09) > -0.75) g.fillRect(x, y, 2, th);
    // branching fingers toward the sparse side
    if (Math.sin(x * 0.53) > 0.82) g.fillRect(x, y - 5, 1, 5);
  }
  // dithered fade specks
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

// §9: the swash sheet's own texture — narrow broken leading line (v=0),
// patchy pale-cyan film, big gaps, faint retreat streaks toward v=1
function makeSwashTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 128, 32);
  // leading line: broken white dashes at the top edge
  g.fillStyle = "rgba(255,255,255,0.95)";
  for (let x = 0; x < 128; x += 2)
    if (Math.sin(x * 0.31) > -0.5) g.fillRect(x, 0, 2, 2 + (x % 3 === 0 ? 1 : 0));
  // patchy film
  g.fillStyle = "rgba(190,230,235,0.4)";
  for (let i = 0; i < 60; i++) {
    const x = (i * 29) % 126;
    const yy = 4 + ((i * 17) % 18);
    g.fillRect(x, yy, 4 + ((i * 7) % 8), 2);
  }
  // faint retreat streaks running down-texture
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
