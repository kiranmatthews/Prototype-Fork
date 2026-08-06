// PS1-STYLE COAST WATER, v2 — FIXED WORLD-SPACE ARCHITECTURE.
//
// The non-negotiable rule: the water, wave field, coastline and skybox
// orientation are FIXED in level space. The camera only determines
// visibility (frustum culling + LOD selection) and the physically correct
// viewing direction used to sample the sky reflection.
//
//   fixed world-space ocean chunks
//   -> absolute-coordinate directional waves
//   -> authored world-space coastline
//   -> coastline-relative shoaling waves (integrated phase, no sliding)
//   -> terrain-clipped moving shoreline
//   -> analytical procedural normals
//   -> reflected camera-to-water direction
//   -> fixed-orientation ACTUAL level skybox sample (quantized proxy)
//   -> Gouraud-style vertex modulation
//   -> separate breaker ribbons, terrain-following swash, wet-sand ribbon
//
// Five independent renderable layers, each toggleable via `debug`:
// FarOcean (chunks), Nearshore (ribbon), BreakerFoam, Swash, WetSand.
import * as THREE from "three";

const TAU = Math.PI * 2;
// fixed sine table, PS1 style: every wave in the system reads this
const SINE = new Float32Array(256);
for (let i = 0; i < 256; i++) SINE[i] = Math.sin((i / 256) * TAU);
const tsin = (p: number): number =>
  SINE[Math.floor((((p / TAU) % 1) + 1) * 256) & 255];
const tcos = (p: number): number => tsin(p + Math.PI / 2);

// ---- tunables (the water studio drives this object live) -------------------
export interface WaterParams {
  // offshore wave set: one broad swell, a crossing swell, a medium wave and
  // a small ripple. Directions are fixed offsets from the authored shore
  // direction so the set stays coherent when a level rotates its coast.
  amp1: number; len1: number; spd1: number;
  amp2: number; len2: number; spd2: number;
  amp3: number; len3: number; spd3: number;
  amp4: number; len4: number; spd4: number;
  // shore wave (coastline-relative)
  shoreAmp: number;
  shoreSpeed: number;
  shoreLenMin: number; // wavelength at the beach...
  shoreLenMax: number; // ...and out at the deep end of the shoaling table
  shoalLift: number; // crest rise entering the shallows
  shape2: number; // 2nd-harmonic weight: the slightly steeper PS1 crest
  alongA: number; // alongshore phase variation amplitudes — the beach must
  alongB: number; // never break all at once
  // colour
  quant: number; // posterize levels for the reflected sky sample
  brightness: number;
  troughDark: number; // navy pull in the troughs
  grazeCyan: number; // cyan lift at grazing angles
  shallowMix: number; // sand-tinted lift over shallow terrain
  // foam / swash / wet sand
  foamWidth: number;
  foamDrift: number;
  foamStrength: number;
  swashPeriod: number;
  swashRunup: number;
  wetDecay: number; // seconds for wet sand to dry
  // structure
  lod0Radius: number; // camera distance that earns the dense chunk mesh
}

export const WATER_DEFAULTS: WaterParams = {
  amp1: 0.38, len1: 15, spd1: 1.7,
  amp2: 0.2, len2: 8.5, spd2: 1.25,
  amp3: 0.09, len3: 4.5, spd3: 2.2,
  amp4: 0.035, len4: 2.2, spd4: 2.8,
  shoreAmp: 0.34,
  shoreSpeed: 1.05,
  shoreLenMin: 4,
  shoreLenMax: 11,
  shoalLift: 1.35,
  shape2: 0.2,
  alongA: 0.25,
  alongB: 0.18,
  quant: 15,
  brightness: 1,
  troughDark: 0.22,
  grazeCyan: 0.4,
  shallowMix: 0.55,
  foamWidth: 0.7,
  foamDrift: 0.12,
  foamStrength: 1,
  swashPeriod: 7,
  swashRunup: 4.6,
  wetDecay: 9,
  lod0Radius: 170,
};

export interface ShoreSample {
  x: number; // waterline point (world, on the still-water edge)
  z: number;
  sx: number; // seaward unit normal — must point consistently out to sea
  sz: number;
  beachSlope: number; // beach rise per metre inland of the waterline
  bedSlope: number; // seabed drop per metre seaward
}

export interface CoastWaterOpts {
  shore: ShoreSample[];
  seaLevel: number;
  shoreDirX: number; // unit direction the swell travels (sea toward beach)
  shoreDirZ: number;
  course: { x: number; z: number }[]; // the level's spine, for chunk authoring
  terrainHeight: (x: number, z: number) => number; // beach/bed height query
}

// ---- structure constants ---------------------------------------------------
const CHUNK = 150; // metres per fixed world chunk
const LOD0_V = 24; // verts per side near the player (6.5m cells)
const LOD1_V = 12; // far chunks (13.6m cells)
const SEA_MARGIN = 720; // how far the chunk field extends past the course
const INLAND_KEEP = 60; // chunks up to this far inland survive (tuck under cliffs)
const SHORE_ROWS = [0, 0.4, 0.9, 1.7, 3, 5, 8, 13, 21, 30]; // cross-shore (m)
const RIBBON_MASK = 29.5; // far-chunk triangles inside this die (one surface per region)
const BLEND_LO = 18; // nearshore -> offshore blend band...
const BLEND_HI = 28; // ...per the spec

// The game's sky dome mapping (mirrors main.ts): the painted panorama wraps
// the dome twice horizontally and is scaled vertically so the painting's own
// horizon row sits on the world horizon. The proxy sampler must agree with
// these numbers or the reflection shows the wrong slice of sky.
const SKY_WRAP = 2;
const SKY_K = 2.15;
const SKY_HORIZON_V = 1 - 600 / 887;

interface Wave {
  a: number;
  kx: number;
  kz: number;
  spd: number;
  ph: number;
}

// ---- the reflection source: a quantized proxy of the ACTUAL level sky -----
// Built once when the level's painted skybox arrives: downsample the
// above-horizon slice into a small strip, posterize hard, sample by
// direction only. Fixed level orientation — the camera never rotates this.
class SkyProxy {
  ready = false;
  url = "";
  private w = 96;
  private h = 40;
  private data: Uint8ClampedArray | null = null;
  fogR = 208; // below the horizon the painting melts into fog — reflections
  fogG = 138; // of that region are just the haze colour
  fogB = 126;

  load(url: string, fogHex: number): void {
    this.url = url;
    this.fogR = (fogHex >> 16) & 255;
    this.fogG = (fogHex >> 8) & 255;
    this.fogB = fogHex & 255;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.url !== url) return; // a later sky superseded this load
      const c = document.createElement("canvas");
      c.width = this.w;
      c.height = this.h;
      const g = c.getContext("2d")!;
      // rows cover texture-V from the horizon row up to the zenith slice the
      // dome actually shows; row 0 = horizon, row h-1 = highest visible sky
      const vTop = Math.min(1, SKY_HORIZON_V + 0.5 * SKY_K * (1 - SKY_HORIZON_V));
      for (let r = 0; r < this.h; r++) {
        const v = SKY_HORIZON_V + (r / (this.h - 1)) * (vTop - SKY_HORIZON_V);
        // texture V=0 is the image BOTTOM: image row = (1-v) * height
        const sy = Math.max(0, Math.min(img.height - 1, (1 - v) * img.height));
        g.drawImage(img, 0, sy, img.width, 1, 0, this.h - 1 - r, this.w, 1);
      }
      const px = g.getImageData(0, 0, this.w, this.h);
      // heavy palette quantization: 4-bit per channel, PS1 style
      for (let i = 0; i < px.data.length; i++)
        px.data[i] = Math.round((Math.round((px.data[i] / 255) * 15) / 15) * 255);
      this.data = px.data;
      this.ready = true;
    };
    img.onerror = () => {
      // keep the previous proxy (or the built-in fallback palette)
    };
    img.src = url;
  }

  // reflection direction (world, level-fixed orientation) -> rgb 0..255
  sample(rx: number, ry: number, rz: number, out: number[]): void {
    if (!this.ready || this.data === null || ry < 0.015) {
      // below the horizon (or no art yet): the haze the sky melts into
      out[0] = this.fogR;
      out[1] = this.fogG;
      out[2] = this.fogB;
      return;
    }
    // dome azimuth: the sphere's UV runs u = phi/2pi with x=-cos(phi),
    // z=sin(phi), wrapped SKY_WRAP times around
    const phi = Math.atan2(rz, -rx);
    const u = ((phi / TAU) * SKY_WRAP) % 1;
    const ui = Math.floor(((u + 1) % 1) * this.w) % this.w;
    const e = Math.asin(Math.min(1, ry)); // elevation above horizon
    const vTop = Math.min(1, SKY_HORIZON_V + 0.5 * SKY_K * (1 - SKY_HORIZON_V));
    const v = SKY_HORIZON_V + (e / (Math.PI / 2)) * (vTop - SKY_HORIZON_V) * 1.9;
    const r01 = Math.max(0, Math.min(1, (v - SKY_HORIZON_V) / (vTop - SKY_HORIZON_V)));
    const vi = this.h - 1 - Math.min(this.h - 1, Math.floor(r01 * (this.h - 1)));
    const k = (vi * this.w + ui) * 4;
    out[0] = this.data[k];
    out[1] = this.data[k + 1];
    out[2] = this.data[k + 2];
  }
}

interface Chunk {
  bounds: THREE.Box3;
  cx: number; // world origin (min corner)
  cz: number;
  lod0: THREE.Mesh;
  lod1: THREE.Mesh;
  distToShore: number; // rough, for choosing shading effort
  stagger: number; // spreads far-chunk update frames
}

const V3 = new THREE.Vector3();
const SKY_RGB = [0, 0, 0];
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
    reflection: true, // off = flat modulation colour (waves must still read)
    modulation: true, // off = raw reflected sky
    coast: false, // draw the coastline spline + sea normals + rows
  };
  stats = { chunksVisible: 0, chunksTotal: 0, nearTris: 0, clippedTris: 0 };

  private time = 0;
  private frameN = 0;
  private shore: ShoreSample[];
  private seaLevel: number;
  private dirX: number;
  private dirZ: number;
  private terrain: (x: number, z: number) => number;
  private sky = new SkyProxy();

  private chunks: Chunk[] = [];
  private waterMat: THREE.MeshBasicMaterial;

  private near: THREE.Mesh; // dynamic soup: terrain-clipped every frame
  private nearMax = 0;
  private foam: THREE.Mesh;
  private swash: THREE.Mesh;
  private wet: THREE.Mesh;
  private coastDebug: THREE.LineSegments | null = null;

  // per shore sample: alongshore arc length; per row: static world pos,
  // terrain height and still depth (the coastline never moves)
  private arc: number[] = [];
  private rowPos: Float32Array; // [sample][row] xz
  private rowTerrain: Float32Array;
  private rowDepth: Float32Array;
  private wetness: number[];
  // shoaling: integrated cross-shore phase per row (rebuilt when params move)
  private phaseAt: number[] = [];
  private phaseLenMin = -1;
  private phaseLenMax = -1;
  // scratch: per-grid-vertex samples for the soup emit (continuity: computed
  // once per vertex, shared by every triangle that touches it)
  private gh: Float32Array;
  private gc: Float32Array;

  constructor(opts: CoastWaterOpts) {
    this.shore = opts.shore;
    this.seaLevel = opts.seaLevel;
    this.dirX = opts.shoreDirX;
    this.dirZ = opts.shoreDirZ;
    this.terrain = opts.terrainHeight;

    const NS = this.shore.length;
    this.wetness = new Array(NS).fill(0);
    let acc = 0;
    for (let i = 0; i < NS; i++) {
      if (i > 0)
        acc += Math.hypot(
          this.shore[i].x - this.shore[i - 1].x,
          this.shore[i].z - this.shore[i - 1].z,
        );
      this.arc.push(acc);
    }
    const NR = SHORE_ROWS.length;
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

    this.waterMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    this.buildChunks(opts.course);

    // nearshore soup: preallocate the TRUE worst case — every cell's two
    // triangles clipping into quads doubles the count (4 tris per cell)
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
    const sheetMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.swash = gridMesh(NS, 3, sheetMat, "swash", 4);
    this.wet = gridMesh(NS, 2, sheetMat.clone(), "wet sand", 4);
    (this.wet.material as THREE.MeshBasicMaterial).blending =
      THREE.MultiplyBlending;

    this.group.add(this.near, this.foam, this.swash, this.wet);
  }

  // ---- fixed world chunks (positions never change after this) -------------
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
    // seaward test: right of the course tangent is out to sea on this coast
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
      // right2D of the tangent = seaward
      return ((x - course[bi].x) * -tz + (z - course[bi].z) * tx) / tl;
    };
    const shoreDist = (x: number, z: number): number => {
      let best = Infinity;
      for (const s of this.shore)
        best = Math.min(best, Math.hypot(x - s.x, z - s.z));
      return best;
    };
    let n = 0;
    for (let gx = minX; gx < maxX; gx += CHUNK)
      for (let gz = minZ; gz < maxZ; gz += CHUNK) {
        const ccx = gx + CHUNK / 2;
        const ccz = gz + CHUNK / 2;
        if (side(ccx, ccz) < -INLAND_KEEP) continue; // solidly inland: no sea here
        const bounds = new THREE.Box3(
          new THREE.Vector3(gx, this.seaLevel - 2, gz),
          new THREE.Vector3(gx + CHUNK, this.seaLevel + 2, gz + CHUNK),
        );
        const near = shoreDist(ccx, ccz);
        const lod0 = this.chunkMesh(gx, gz, LOD0_V, near < CHUNK * 1.6);
        const lod1 = this.chunkMesh(gx, gz, LOD1_V, near < CHUNK * 1.6);
        lod0.visible = false;
        lod1.visible = false;
        this.group.add(lod0, lod1);
        this.chunks.push({
          bounds,
          cx: gx,
          cz: gz,
          lod0,
          lod1,
          distToShore: near,
          stagger: n++ % 4,
        });
      }
    this.stats.chunksTotal = this.chunks.length;
  }

  // one fixed chunk mesh: static world xz, dynamic y + colour. Triangles
  // inside the nearshore ribbon band are dropped at BUILD time so exactly
  // one surface owns each world region (no coplanar fighting, no seam).
  private chunkMesh(gx: number, gz: number, nv: number, nearShore: boolean): THREE.Mesh {
    const g = new THREE.BufferGeometry();
    const n = nv * nv;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const masked: boolean[] = new Array(n).fill(false);
    for (let r = 0; r < nv; r++)
      for (let c = 0; c < nv; c++) {
        const i = r * nv + c;
        const x = gx + (c / (nv - 1)) * CHUNK;
        const z = gz + (r / (nv - 1)) * CHUNK;
        pos[i * 3] = x;
        pos[i * 3 + 1] = this.seaLevel;
        pos[i * 3 + 2] = z;
        if (nearShore) {
          for (const s of this.shore) {
            const dx = x - s.x;
            const dz = z - s.z;
            if (dx * dx + dz * dz < RIBBON_MASK * RIBBON_MASK) {
              // inland of the waterline, or inside the ribbon band: masked
              if (dx * s.sx + dz * s.sz < RIBBON_MASK) {
                masked[i] = true;
                break;
              }
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
    g.setIndex(idx);
    const m = new THREE.Mesh(g, this.waterMat);
    m.name = "ocean chunk";
    m.frustumCulled = false; // we cull whole chunks ourselves, by bounds
    return m;
  }

  // ---- the ONE wave function (rendering, collision, floating objects) -----
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
    this.phaseLenMin = -1; // shoaling table depends on params too
  }

  // world-space offshore sample: height + analytic slope. `nWaves` is the
  // LOD of EVALUATION (far chunks skip the two smallest waves their cells
  // cannot resolve) — every LOD shares the same underlying functions.
  private sampleWaves(
    x: number,
    z: number,
    t: number,
    nWaves: number,
    out: { h: number; dx: number; dz: number },
  ): void {
    let h = 0;
    let dx = 0;
    let dz = 0;
    for (let i = 0; i < nWaves; i++) {
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

  heightAt(x: number, z: number, t = this.time): number {
    if (this.wavesDirty) {
      this.waves = this.waveSet();
      this.wavesDirty = false;
    }
    const o = { h: 0, dx: 0, dz: 0 };
    this.sampleWaves(x, z, t, 4, o);
    return this.seaLevel + o.h;
  }

  // ---- shoaling: continuously compressed shore phase ----------------------
  private rebuildPhaseTable(): void {
    const p = this.params;
    this.phaseAt = [0];
    let acc = 0;
    for (let j = 1; j < SHORE_ROWS.length; j++) {
      const mid = (SHORE_ROWS[j] + SHORE_ROWS[j - 1]) / 2;
      // representative still depth at this offshore distance (bed slope of
      // the first shore sample stands in for the whole beach — it is one
      // authored beach)
      const depth = Math.max(
        0.12,
        mid * (this.shore[0]?.bedSlope ?? 0.13) + 0.1,
      );
      const lam = THREE.MathUtils.lerp(
        p.shoreLenMin,
        p.shoreLenMax,
        THREE.MathUtils.smoothstep(depth, 0.5, 5),
      );
      acc += (TAU / lam) * (SHORE_ROWS[j] - SHORE_ROWS[j - 1]);
      this.phaseAt.push(acc);
    }
    this.phaseLenMin = p.shoreLenMin;
    this.phaseLenMax = p.shoreLenMax;
  }

  private shorePhase(si: number, j: number, t: number): number {
    const p = this.params;
    return (
      -this.phaseAt[j] +
      this.alongshore(this.arc[si], t) -
      t * p.shoreSpeed
    );
  }

  private alongshore(s: number, t: number): number {
    const p = this.params;
    return (
      tsin(s * 0.11 + t * 0.3) * p.alongA + tsin(s * 0.037 - t * 0.16) * p.alongB
    );
  }

  // slightly asymmetric crest: sin + a phase-locked 2nd harmonic
  private shoreShape(ph: number): number {
    return tsin(ph) + tsin(ph * 2 + 0.55) * this.params.shape2;
  }

  private shoreAmp(depth: number): number {
    const p = this.params;
    const shoaling = 1 - THREE.MathUtils.smoothstep(depth, 1.2, 5);
    const collapse = THREE.MathUtils.smoothstep(depth, 0.15, 0.9);
    return (
      p.shoreAmp * THREE.MathUtils.lerp(0.75, p.shoalLift, shoaling) * collapse
    );
  }

  // ---- shading: reflect off the ACTUAL level sky, quantize, modulate ------
  setSkyUrl(url: string, fogHex: number): void {
    if (this.sky.url === url) return;
    this.sky.load(url, fogHex);
  }
  get skyUrl(): string {
    return this.sky.url;
  }
  get skyReady(): boolean {
    return this.sky.ready;
  }

  private shadeVertex(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    h: number,
    depth: number, // still-water depth under the vertex (big = deep)
    cam: THREE.Vector3,
    out: Float32Array,
    oi: number,
  ): void {
    const p = this.params;
    // incident = water-to-... spec: view = normalize(cam - P); incident = -view
    let ix = px - cam.x;
    let iy = py - cam.y;
    let iz = pz - cam.z;
    const il = Math.hypot(ix, iy, iz) || 1;
    ix /= il;
    iy /= il;
    iz /= il;
    const nd = (ix * nx + iy * ny + iz * nz) * 2;
    const rx = ix - nd * nx;
    const ry = iy - nd * ny;
    const rz = iz - nd * nz;
    let sr = 190;
    let sg = 190;
    let sb = 200;
    if (this.debug.reflection) {
      this.sky.sample(rx, ry, rz, SKY_RGB);
      sr = SKY_RGB[0];
      sg = SKY_RGB[1];
      sb = SKY_RGB[2];
      // low-res quantization AFTER sampling: the PS1 posterize
      const q = Math.max(2, p.quant);
      sr = (Math.round((sr / 255) * q) / q) * 255;
      sg = (Math.round((sg / 255) * q) / q) * 255;
      sb = (Math.round((sb / 255) * q) / q) * 255;
    }
    let mr = 105 / 255;
    let mg = 135 / 255;
    let mb = 185 / 255;
    if (this.debug.modulation) {
      // shallow water lightens and warms toward the sand — never solid cyan
      const shal =
        (1 - THREE.MathUtils.smoothstep(depth, 0.25, 3.5)) * p.shallowMix;
      mr = THREE.MathUtils.lerp(105, 150, shal) / 255;
      mg = THREE.MathUtils.lerp(135, 185, shal) / 255;
      mb = THREE.MathUtils.lerp(185, 192, shal) / 255;
      // troughs pull toward navy, crests brighten a touch
      const k = THREE.MathUtils.clamp(h / (p.amp1 + 0.2), -1, 1);
      const dark = 1 + k * p.troughDark;
      mr *= dark;
      mg *= dark;
      mb *= dark * 1.02;
      // grazing angles pick up cyan
      const g = (1 - Math.abs(ix * nx + iy * ny + iz * nz)) ** 2 * p.grazeCyan;
      mr = mr * (1 - g) + g * 0.55;
      mg = mg * (1 - g) + g * 0.85;
      mb = mb * (1 - g) + g * 0.85;
    } else {
      mr = mg = mb = 1;
    }
    const B = p.brightness;
    out[oi] = (sr / 255) * mr * B;
    out[oi + 1] = (sg / 255) * mg * B;
    out[oi + 2] = (sb / 255) * mb * B;
  }

  // ---- per-frame -----------------------------------------------------------
  update(dt: number, camera: THREE.Camera): void {
    if (!this.debug.freeze) this.time += dt;
    this.frameN++;
    if (this.wavesDirty) {
      this.waves = this.waveSet();
      this.wavesDirty = false;
    }
    if (
      this.phaseLenMin !== this.params.shoreLenMin ||
      this.phaseLenMax !== this.params.shoreLenMax
    )
      this.rebuildPhaseTable();
    const cam = camera.getWorldPosition(V3);
    this.waterMat.wireframe = this.debug.wireframe;

    this.updateChunks(cam, camera);
    this.near.visible = this.debug.near;
    if (this.debug.near) this.updateNearshore(cam);
    this.foam.visible = this.debug.foam;
    this.swash.visible = this.debug.swash;
    this.wet.visible = this.debug.wet;
    this.updateShoreline(dt);
    this.updateCoastDebug();
  }

  private updateChunks(cam: THREE.Vector3, camera: THREE.Camera): void {
    PROJ.multiplyMatrices(
      (camera as THREE.PerspectiveCamera).projectionMatrix,
      (camera as THREE.PerspectiveCamera).matrixWorldInverse,
    );
    FRUSTUM.setFromProjectionMatrix(PROJ);
    const o = { h: 0, dx: 0, dz: 0 };
    let visible = 0;
    for (const ch of this.chunks) {
      const inView = this.debug.far && FRUSTUM.intersectsBox(ch.bounds);
      if (!inView) {
        ch.lod0.visible = false;
        ch.lod1.visible = false;
        continue;
      }
      visible++;
      const dx = cam.x - (ch.cx + CHUNK / 2);
      const dz = cam.z - (ch.cz + CHUNK / 2);
      const dist = Math.hypot(dx, dz) - CHUNK * 0.7;
      const lod0 = dist < this.params.lod0Radius;
      ch.lod0.visible = lod0;
      ch.lod1.visible = !lod0;
      // far chunks refresh on a stagger — they are fog-dimmed and coarse,
      // and this is visibility work, not a change to the wave field
      if (dist > 320 && (this.frameN & 3) !== ch.stagger) continue;
      const mesh = lod0 ? ch.lod0 : ch.lod1;
      const nWaves = lod0 ? 4 : 2; // small ripples die below cell resolution
      const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const col = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
      const pa = pos.array as Float32Array;
      const ca = col.array as Float32Array;
      const n = pos.count;
      const cheap = dist > 300; // fully fogged: skip the reflection math
      for (let i = 0; i < n; i++) {
        const x = pa[i * 3];
        const z = pa[i * 3 + 2];
        this.sampleWaves(x, z, this.time, nWaves, o);
        const y = this.seaLevel + o.h;
        pa[i * 3 + 1] = y;
        if (cheap) {
          ca[i * 3] = 0.62;
          ca[i * 3 + 1] = 0.62;
          ca[i * 3 + 2] = 0.66;
          continue;
        }
        const nl = Math.hypot(o.dx, 1, o.dz);
        this.shadeVertex(
          x, y, z,
          -o.dx / nl, 1 / nl, -o.dz / nl,
          o.h, 30, cam, ca, i * 3,
        );
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
    }
    this.stats.chunksVisible = visible;
  }

  // nearshore: evaluate the grid once (shared samples -> continuity), then
  // emit terrain-clipped triangles — the actual moving shoreline
  private updateNearshore(cam: THREE.Vector3): void {
    const NS = this.shore.length;
    const NR = SHORE_ROWS.length;
    const t = this.time;
    const o = { h: 0, dx: 0, dz: 0 };
    // pass 1: per-grid-vertex height
    for (let i = 0; i < NS; i++) {
      for (let r = 0; r < NR; r++) {
        const k = i * NR + r;
        const x = this.rowPos[k * 2];
        const z = this.rowPos[k * 2 + 1];
        const depth = this.rowDepth[k];
        const crossK = THREE.MathUtils.smoothstep(depth, 1.5, 5);
        const smallK = THREE.MathUtils.smoothstep(depth, 0.8, 3);
        this.sampleWaves(x, z, t, 4, o);
        const w = this.waves;
        // suppress the crossing + small waves in the shallows (subtract the
        // suppressed share of each wave's contribution)
        let h = o.h;
        for (let wi = 1; wi < 4; wi++) {
          const sup = wi === 1 ? crossK : smallK;
          const ph = w[wi].kx * x + w[wi].kz * z - w[wi].spd * t + w[wi].ph;
          h -= w[wi].a * tsin(ph) * (1 - sup);
        }
        const shoreW =
          this.shoreShape(this.shorePhase(i, r, t)) * this.shoreAmp(depth);
        const blend = THREE.MathUtils.smoothstep(SHORE_ROWS[r], BLEND_LO, BLEND_HI);
        this.gh[k] = THREE.MathUtils.lerp(
          h * THREE.MathUtils.lerp(0.55, 1, crossK) + shoreW,
          o.h,
          blend,
        );
      }
    }
    // pass 2: per-grid-vertex colour (finite-difference normals off gh)
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
        // build the normal from the two surface tangents (approx axes)
        const nx = -sAlong;
        const nz = -sCross;
        const nl = Math.hypot(nx, 1, nz);
        this.shadeVertex(
          x, y, z, nx / nl, 1 / nl, nz / nl,
          this.gh[k], this.rowDepth[k], cam, this.gc, k * 3,
        );
      }
    }
    // pass 3: clip + emit. clearance = waterY - terrainY per corner.
    const pos = this.near.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.near.geometry.getAttribute("color") as THREE.BufferAttribute;
    const pa = pos.array as Float32Array;
    const ca = col.array as Float32Array;
    let vtx = 0;
    let clipped = 0;
    const emit = (
      ax: number, ay: number, az: number, ac: number[],
      bx: number, by: number, bz: number, bc: number[],
      cx2: number, cy2: number, cz2: number, cc: number[],
    ): void => {
      if (vtx + 3 > this.nearMax) return;
      pa[vtx * 3] = ax; pa[vtx * 3 + 1] = ay; pa[vtx * 3 + 2] = az;
      ca[vtx * 3] = ac[0]; ca[vtx * 3 + 1] = ac[1]; ca[vtx * 3 + 2] = ac[2];
      vtx++;
      pa[vtx * 3] = bx; pa[vtx * 3 + 1] = by; pa[vtx * 3 + 2] = bz;
      ca[vtx * 3] = bc[0]; ca[vtx * 3 + 1] = bc[1]; ca[vtx * 3 + 2] = bc[2];
      vtx++;
      pa[vtx * 3] = cx2; pa[vtx * 3 + 1] = cy2; pa[vtx * 3 + 2] = cz2;
      ca[vtx * 3] = cc[0]; ca[vtx * 3 + 1] = cc[1]; ca[vtx * 3 + 2] = cc[2];
      vtx++;
    };
    // corner scratch
    const P: number[][] = [[], [], [], []];
    const C: number[][] = [[], [], [], []];
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
      CL[slot] = y - this.rowTerrain[k];
    };
    const lerpV = (a: number, b: number, f: number): number => a + (b - a) * f;
    const clipTri = (ia: number, ib: number, ic: number): void => {
      const wet = [CL[ia] > 0, CL[ib] > 0, CL[ic] > 0];
      const nWet = (wet[0] ? 1 : 0) + (wet[1] ? 1 : 0) + (wet[2] ? 1 : 0);
      if (nWet === 0) return;
      if (nWet === 3) {
        emit(
          P[ia][0], P[ia][1], P[ia][2], C[ia],
          P[ib][0], P[ib][1], P[ib][2], C[ib],
          P[ic][0], P[ic][1], P[ic][2], C[ic],
        );
        return;
      }
      clipped++;
      // order so the wet verts come first
      const order = [ia, ib, ic].sort(
        (a, b) => (CL[b] > 0 ? 1 : 0) - (CL[a] > 0 ? 1 : 0),
      );
      const cut = (w: number, d: number): { p: number[]; c: number[] } => {
        const f = CL[w] / (CL[w] - CL[d]);
        return {
          p: [
            lerpV(P[w][0], P[d][0], f),
            lerpV(P[w][1], P[d][1], f),
            lerpV(P[w][2], P[d][2], f),
          ],
          c: [
            lerpV(C[w][0], C[d][0], f),
            lerpV(C[w][1], C[d][1], f),
            lerpV(C[w][2], C[d][2], f),
          ],
        };
      };
      if (nWet === 1) {
        const w = order[0];
        const e1 = cut(w, order[1]);
        const e2 = cut(w, order[2]);
        emit(
          P[w][0], P[w][1], P[w][2], C[w],
          e1.p[0], e1.p[1], e1.p[2], e1.c,
          e2.p[0], e2.p[1], e2.p[2], e2.c,
        );
      } else {
        const w0 = order[0];
        const w1 = order[1];
        const d = order[2];
        const e0 = cut(w0, d);
        const e1 = cut(w1, d);
        emit(
          P[w0][0], P[w0][1], P[w0][2], C[w0],
          P[w1][0], P[w1][1], P[w1][2], C[w1],
          e0.p[0], e0.p[1], e0.p[2], e0.c,
        );
        emit(
          P[w1][0], P[w1][1], P[w1][2], C[w1],
          e1.p[0], e1.p[1], e1.p[2], e1.c,
          e0.p[0], e0.p[1], e0.p[2], e0.c,
        );
      }
    };
    for (let i = 0; i < NS - 1; i++)
      for (let r = 0; r < NR - 1; r++) {
        corner(0, i, r);
        corner(1, i + 1, r);
        corner(2, i, r + 1);
        corner(3, i + 1, r + 1);
        clipTri(0, 2, 1); // winding matches the chunk grids
        clipTri(1, 2, 3);
      }
    this.near.geometry.setDrawRange(0, vtx);
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.stats.nearTris = Math.floor(vtx / 3);
    this.stats.clippedTris = clipped;
  }

  // foam + swash + wet sand — the shoreline theatre
  private updateShoreline(dt: number): void {
    const t = this.time;
    const NS = this.shore.length;
    const p = this.params;

    // BREAKER FOAM: invert the integrated phase table for the moving crest
    const fGeo = this.foam.geometry;
    const fPos = fGeo.getAttribute("position") as THREE.BufferAttribute;
    const fUv = fGeo.getAttribute("uv") as THREE.BufferAttribute;
    const fCol = fGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const base = this.alongshore(this.arc[si], t) - t * p.shoreSpeed;
      let crossX = -1;
      let strength = 0;
      for (let j = 6; j >= 1; j--) {
        const a0 = -this.phaseAt[j] + base;
        const a1 = -this.phaseAt[j - 1] + base;
        const lo = Math.min(a0, a1);
        const hi = Math.max(a0, a1);
        const n0 = Math.ceil((lo - Math.PI / 2) / TAU);
        const crest = Math.PI / 2 + n0 * TAU;
        if (crest <= hi) {
          const f = (crest - a0) / (a1 - a0 || 1);
          crossX = THREE.MathUtils.lerp(SHORE_ROWS[j], SHORE_ROWS[j - 1], f);
          const depth = Math.max(
            0.1,
            crossX * (S.bedSlope ?? 0.13) + 0.1,
          );
          const zone =
            THREE.MathUtils.smoothstep(depth, 0.8, 1.6) === 1
              ? 0
              : (1 - THREE.MathUtils.smoothstep(depth, 0.8, 1.6)) *
                THREE.MathUtils.smoothstep(depth, 0.15, 0.45);
          strength = zone * p.foamStrength;
          break;
        }
      }
      const active = crossX > 0 && strength > 0.02;
      const cx = active ? crossX : 5;
      for (let r = 0; r < 2; r++) {
        const d = cx + (r === 0 ? p.foamWidth : -p.foamWidth);
        const px = S.x + S.sx * d;
        const pz = S.z + S.sz * d;
        const py = active
          ? this.heightAt(px, pz, t) + 0.05
          : this.seaLevel;
        const vi = r * NS + si;
        fPos.setXYZ(vi, px, py, pz);
        fUv.setXY(vi, this.arc[si] * 0.14 + t * p.foamDrift, r);
        fCol.setXYZW(vi, 1, 1, 1, active ? strength * (r === 0 ? 0.75 : 0.4) : 0);
      }
    }
    fPos.needsUpdate = true;
    fUv.needsUpdate = true;
    fCol.needsUpdate = true;

    // SWASH: fast advance (25% of the cycle), slow retreat (75%)
    const sGeo = this.swash.geometry;
    const sPos = sGeo.getAttribute("position") as THREE.BufferAttribute;
    const sCol = sGeo.getAttribute("color") as THREE.BufferAttribute;
    const easeOutCubic = (u: number): number => 1 - Math.pow(1 - u, 3);
    const easeInOutQuad = (u: number): number =>
      u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const cyc =
        (((t / p.swashPeriod + this.arc[si] * 0.015 + si * 0.02) % 1) + 1) % 1;
      const travel =
        cyc < 0.25
          ? easeOutCubic(cyc / 0.25)
          : 1 - easeInOutQuad((cyc - 0.25) / 0.75);
      const local = 0.7 + 0.3 * tsin(this.arc[si] * 0.21 + t * 0.4);
      const runup = p.swashRunup * travel * local;
      this.wetness[si] = Math.max(
        this.wetness[si] * Math.exp(-dt / Math.max(0.5, p.wetDecay)),
        travel * local,
      );
      const rows: [number, number, number, number, number][] = [
        [runup, 1, 1, 1, 0.8], // narrow bright leading edge
        [runup - 2.2, 0.6, 0.71, 0.78, 0.28], // dim blue-grey film
        [-0.7, 0.55, 0.7, 0.75, 0.45], // back into the sea
      ];
      for (let r = 0; r < 3; r++) {
        const [dIn, cr, cg, cb, cal] = rows[r];
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        sPos.setXYZ(r * NS + si, px, this.terrain(px, pz) + 0.04, pz);
        sCol.setXYZW(r * NS + si, cr, cg, cb, cal * (0.3 + 0.7 * travel));
      }
    }
    sPos.needsUpdate = true;
    sCol.needsUpdate = true;

    // WET SAND: exponential drying behind the maximum recent run-up
    const wGeo = this.wet.geometry;
    const wPos = wGeo.getAttribute("position") as THREE.BufferAttribute;
    const wCol = wGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
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
    wPos.needsUpdate = true;
    wCol.needsUpdate = true;
  }

  // debug: coastline points, tangents, sea normals + cross-shore rows
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
          pts.push(S.x, y, S.z, T.x, y, T.z); // the spline itself
        }
        pts.push(S.x, y, S.z, S.x + S.sx * 4, y, S.z + S.sz * 4); // sea normal
        for (const d of SHORE_ROWS)
          pts.push(
            S.x + S.sx * d, y - 0.3, S.z + S.sz * d,
            S.x + S.sx * d, y + 0.3, S.z + S.sz * d,
          );
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

// ---- shared small builders -------------------------------------------------
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

// 64x32 breaker foam: broken white and pale-cyan streaks on nothing
function makeFoamTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 32;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 64, 32);
  for (let i = 0; i < 26; i++) {
    g.fillStyle =
      i % 3 === 2 ? "rgba(190,240,240,0.85)" : "rgba(255,255,255,0.9)";
    const w = 4 + ((i * 29) % 14);
    g.fillRect((i * 19) % 62, (i * 11) % 30, w, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
