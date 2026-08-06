// PS1-STYLE COAST WATER (the Crash 3 school). The look comes from GEOMETRY:
// low-poly surfaces deformed by world-space sine waves, analytic normals
// turned into reflected-sky UVs over a small banded texture, and Gouraud
// vertex colour — no scrolling shader anywhere.
//
// Two connected systems share one primary swell so no seam shows:
//  - FAR OCEAN: a camera-centred fan of quads, dense near the player and
//    exponentially coarser toward the horizon. The fan FOLLOWS the camera
//    but every wave is evaluated at absolute world coordinates, so the
//    water itself never moves with you.
//  - NEARSHORE: a world-anchored ribbon along an authored shoreline. The
//    swell shoals as the bed rises — wavelength compressed through an
//    integrated cross-shore phase table (no sliding, no snapping), crest
//    lifted, crossing waves suppressed — and collapses in the breaker zone.
//    (The whole beach here is ~200m, so the ribbon is built once rather
//    than streamed in a moving window.)
// On top: a breaker-foam ribbon tracking the moving crest, a swash sheet
// running up the sand (fast in, slow out), and a persistent wet-sand band
// that darkens behind the retreating water and dries slowly.
import * as THREE from "three";

const TAU = Math.PI * 2;
// fixed sine table, PS1 style: every wave in the system reads this
const SINE = new Float32Array(256);
for (let i = 0; i < 256; i++) SINE[i] = Math.sin((i / 256) * TAU);
const tsin = (p: number): number =>
  SINE[Math.floor((((p / TAU) % 1) + 1) * 256) & 255];
const tcos = (p: number): number => tsin(p + Math.PI / 2);

interface Wave {
  a: number; // amplitude (m)
  kx: number; // wave vector (rad/m)
  kz: number;
  w: number; // angular speed (rad/s)
  ph: number; // fixed phase offset
}

export interface ShoreSample {
  x: number; // waterline point (world, at beach height = seaLevel + 0.15)
  z: number;
  sx: number; // seaward unit direction
  sz: number;
  beachSlope: number; // beach rise per metre inland of the waterline
  bedSlope: number; // seabed drop per metre seaward
}

export interface CoastWaterOpts {
  shore: ShoreSample[];
  seaLevel: number;
  shoreDirX: number; // unit direction the swell travels (sea toward beach)
  shoreDirZ: number;
}

const FAR_COLS = 24;
const FAR_ROWS = 17; // depth stations, exponential: 12m out to ~800m
const FAN_HALF = 1.5; // radians of azimuth each side of the camera
const CROSS = [0, 0.5, 1, 2, 4, 7, 11, 17, 25]; // cross-shore stations (m)
const SWELL_LAMBDA = 46;
const SWELL_AMP = 0.5;

const mkWave = (a: number, lambda: number, dir: number, spd = 1): Wave => {
  const k = TAU / lambda;
  return {
    a,
    kx: Math.cos(dir) * k,
    kz: Math.sin(dir) * k,
    w: Math.sqrt(9.8 * k) * spd,
    ph: dir * 7.3, // deterministic, spreads the waves' zero crossings
  };
};

// 64x64 banded sky-reflection map: broad navy/blue/cyan bands with a warm
// cloud belt at the horizon edge. Bands run along V; the changing surface
// normals stretch and reorganise them across the water.
function makeSkyTex(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  const bands: [number, string][] = [
    [0.16, "#f0d8b8"], // horizon cloud (sunset warmth)
    [0.3, "#a8dce0"], // pale cyan
    [0.52, "#4899c2"], // mid blue
    [0.74, "#2565a0"], // blue
    [1.01, "#1a416e"], // deep navy zenith
  ];
  let y0 = 0;
  for (const [f, col] of bands) {
    const y1 = Math.round(f * 64);
    g.fillStyle = col;
    g.fillRect(0, y0, 64, y1 - y0);
    y0 = y1;
  }
  // broken cloud streaks in the low bands — the horizontal variation
  g.fillStyle = "#f6ecd8";
  for (let i = 0; i < 9; i++) {
    const w = 6 + ((i * 37) % 12);
    g.fillRect((i * 23) % 60, 2 + ((i * 13) % 14), w, 2);
  }
  g.fillStyle = "#cfeef0";
  for (let i = 0; i < 6; i++)
    g.fillRect((i * 31) % 58, 20 + ((i * 17) % 10), 8, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

export class CoastWater {
  group = new THREE.Group();
  private time = 0;
  private waves: Wave[]; // offshore set: [primary swell, cross, medium, ripple]
  private shore: ShoreSample[];
  private seaLevel: number;

  private far: THREE.Mesh;
  private near: THREE.Mesh;
  private foam: THREE.Mesh;
  private swash: THREE.Mesh;
  private wet: THREE.Mesh;

  // integrated cross-shore phase table (per CROSS station): wavelength
  // shortens as depth falls, so phase advances FASTER toward the beach —
  // integrating keeps the compression continuous instead of sliding
  private phaseAt: number[] = [];
  private depthAt: number[] = [];
  private wetness: number[]; // per shore sample, decays slowly

  constructor(opts: CoastWaterOpts) {
    this.shore = opts.shore;
    this.seaLevel = opts.seaLevel;
    const dir = Math.atan2(opts.shoreDirZ, opts.shoreDirX);
    this.waves = [
      mkWave(SWELL_AMP, SWELL_LAMBDA, dir, 0.7), // broad primary swell
      mkWave(0.26, 27, dir + 0.72, 0.7), // crossing swell
      mkWave(0.13, 11, dir - 0.45, 0.8), // medium
      mkWave(0.05, 4.4, dir + 1.9, 1), // small near-camera ripple
    ];
    const bed = opts.shore[0]?.bedSlope ?? 0.13;
    let acc = 0;
    for (let j = 0; j < CROSS.length; j++) {
      const depth = Math.max(0.12, CROSS[j] * bed + 0.1);
      this.depthAt.push(depth);
      if (j > 0) {
        const dm = (this.depthAt[j] + this.depthAt[j - 1]) / 2;
        const lam =
          SWELL_LAMBDA * THREE.MathUtils.clamp(Math.sqrt(dm / 3.2), 0.4, 1);
        acc += (TAU / lam) * (CROSS[j] - CROSS[j - 1]);
      }
      this.phaseAt.push(acc);
    }
    this.wetness = new Array(opts.shore.length).fill(0);

    const skyTex = makeSkyTex();
    const waterMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      vertexColors: true,
      side: THREE.DoubleSide,
    });

    this.far = this.gridMesh(FAR_COLS, FAR_ROWS, waterMat, "far ocean");
    this.near = this.gridMesh(
      this.shore.length,
      CROSS.length,
      waterMat.clone(),
      "nearshore",
    );
    (this.near.material as THREE.MeshBasicMaterial).polygonOffset = true;
    (this.near.material as THREE.MeshBasicMaterial).polygonOffsetFactor = -1;

    const foamMat = new THREE.MeshBasicMaterial({
      map: makeFoamTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.foam = this.gridMesh(this.shore.length, 2, foamMat, "breaker foam", 4);
    const sheetMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.swash = this.gridMesh(this.shore.length, 3, sheetMat, "swash", 4);
    this.wet = this.gridMesh(
      this.shore.length,
      2,
      sheetMat.clone(),
      "wet sand",
      4,
    );
    (this.wet.material as THREE.MeshBasicMaterial).blending =
      THREE.MultiplyBlending;

    this.group.add(this.far, this.near, this.foam, this.swash, this.wet);
  }

  // cols x rows vertex grid with static indices; positions/uv/colour live
  private gridMesh(
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
    m.frustumCulled = false; // rebuilt around the camera / small anyway
    return m;
  }

  // offshore surface height at a world point — the ONE height function,
  // shared by rendering and anything that wants to float on it
  heightAt(x: number, z: number, t = this.time): number {
    let h = 0;
    for (const wv of this.waves)
      h += wv.a * tsin(wv.kx * x + wv.kz * z - wv.w * t + wv.ph);
    return this.seaLevel + h;
  }

  private normalAt(x: number, z: number, t: number, out: THREE.Vector3): void {
    let dx = 0;
    let dz = 0;
    for (const wv of this.waves) {
      const c = wv.a * tcos(wv.kx * x + wv.kz * z - wv.w * t + wv.ph);
      dx += c * wv.kx;
      dz += c * wv.kz;
    }
    out.set(-dx, 1, -dz).normalize();
  }

  private V = new THREE.Vector3();
  private N = new THREE.Vector3();

  // reflected-sky UV + Gouraud colour for one vertex, written in place
  private shade(
    px: number,
    py: number,
    pz: number,
    cam: THREE.Vector3,
    uvArr: Float32Array,
    uvI: number,
    colArr: Float32Array,
    colI: number,
    h: number,
  ): void {
    const V = this.V.set(px - cam.x, py - cam.y, pz - cam.z).normalize();
    const N = this.N;
    const d2 = V.dot(N) * 2;
    const rx = V.x - d2 * N.x;
    const ry = V.y - d2 * N.y;
    const rz = V.z - d2 * N.z;
    uvArr[uvI] = 0.5 + rx * 0.32 + rz * 0.18;
    uvArr[uvI + 1] = 0.06 + THREE.MathUtils.clamp(ry, 0, 1) * 0.88;
    // troughs deepen, crests brighten; grazing angles pick up cyan
    const k = THREE.MathUtils.clamp(h / (SWELL_AMP + 0.3), -1, 1);
    const g = (1 - Math.abs(V.dot(N))) ** 2;
    const br = 0.84 + k * 0.2;
    colArr[colI] = br * (1 - g * 0.35) + g * 0.5;
    colArr[colI + 1] = br * (1 - g * 0.1) + g * 0.72;
    colArr[colI + 2] = br + g * 0.66;
  }

  update(dt: number, camera: THREE.Camera): void {
    this.time += dt;
    const cam = camera.getWorldPosition(new THREE.Vector3());
    this.updateFar(cam, camera);
    this.updateNear(cam);
    this.updateShoreline(dt);
  }

  private fwd = new THREE.Vector3();

  private updateFar(cam: THREE.Vector3, camera: THREE.Camera): void {
    const t = this.time;
    const geo = this.far.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    camera.getWorldDirection(this.fwd);
    const yaw = Math.atan2(this.fwd.x, this.fwd.z);
    const pArr = pos.array as Float32Array;
    const uvArr = uv.array as Float32Array;
    const cArr = col.array as Float32Array;
    const sw = this.waves[0];
    let vi = 0;
    for (let r = 0; r < FAR_ROWS; r++) {
      const dist = 12 * Math.pow(1.3, r);
      for (let c = 0; c < FAR_COLS; c++, vi++) {
        const az = yaw + (c / (FAR_COLS - 1) - 0.5) * 2 * FAN_HALF;
        let px = cam.x + Math.sin(az) * dist;
        let pz = cam.z + Math.cos(az) * dist;
        const h = this.heightAt(px, pz, t) - this.seaLevel;
        this.normalAt(px, pz, t, this.N);
        // small Gerstner-style horizontal pull on the primary swell only —
        // broad and rounded, never curling
        const gp =
          tcos(sw.kx * px + sw.kz * pz - sw.w * t + sw.ph) * 0.32 * sw.a;
        const klen = Math.hypot(sw.kx, sw.kz) || 1;
        px += gp * (sw.kx / klen);
        pz += gp * (sw.kz / klen);
        const py = this.seaLevel + h - 0.12; // sits a hair under the nearshore
        pArr[vi * 3] = px;
        pArr[vi * 3 + 1] = py;
        pArr[vi * 3 + 2] = pz;
        this.shade(px, py, pz, cam, uvArr, vi * 2, cArr, vi * 3, h);
      }
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  // shore wave: the primary swell continued through the shoaling table
  private shoreWave(si: number, j: number, t: number): number {
    const along =
      this.shore[si].x * this.waves[0].kx + this.shore[si].z * this.waves[0].kz;
    const depth = this.depthAt[j];
    const lift = THREE.MathUtils.clamp(Math.pow(3.2 / depth, 0.25), 1, 1.5);
    const collapse = THREE.MathUtils.smoothstep(depth, 0.16, 0.85);
    return (
      SWELL_AMP *
      lift *
      collapse *
      tsin(this.phaseAt[j] * -1 + along * 0.35 - this.waves[0].w * 0.9 * t)
    );
  }

  private updateNear(cam: THREE.Vector3): void {
    const t = this.time;
    const geo = this.near.geometry;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const col = geo.getAttribute("color") as THREE.BufferAttribute;
    const pArr = pos.array as Float32Array;
    const uvArr = uv.array as Float32Array;
    const cArr = col.array as Float32Array;
    const NS = this.shore.length;
    for (let j = 0; j < CROSS.length; j++) {
      const depth = this.depthAt[j];
      const sup = THREE.MathUtils.smoothstep(depth, 0.9, 3.4); // small waves die shallow
      const blend = THREE.MathUtils.smoothstep(j, 3, CROSS.length - 1); // outer rows -> offshore set
      for (let si = 0; si < NS; si++) {
        const S = this.shore[si];
        let px = S.x + S.sx * CROSS[j];
        let pz = S.z + S.sz * CROSS[j];
        const hOff = this.heightAt(px, pz, t) - this.seaLevel;
        const hShore = this.shoreWave(si, j, t);
        let h = THREE.MathUtils.lerp(hShore, hOff * (0.35 + 0.65 * sup), blend);
        let py = this.seaLevel + h;
        if (j === 0) {
          // the MOVING SHORELINE: intersect the wave with the beach plane and
          // put the innermost row right at the wet/dry line — the water's
          // edge physically advances up the sand and retreats with the swell
          const dIn =
            h > 0
              ? Math.min(h / S.beachSlope, 6)
              : Math.max(h / S.bedSlope, -4) * 0.4;
          px = S.x - S.sx * dIn;
          pz = S.z - S.sz * dIn;
          py =
            this.seaLevel +
            0.15 +
            dIn * (dIn > 0 ? S.beachSlope : S.bedSlope) +
            0.02;
        }
        const vi = j * NS + si;
        pArr[vi * 3] = px;
        pArr[vi * 3 + 1] = py;
        pArr[vi * 3 + 2] = pz;
        this.normalAt(px, pz, t, this.N);
        this.shade(px, py, pz, cam, uvArr, vi * 2, cArr, vi * 3, h);
        // shallow rows go turquoise over the sand, Crash style
        const shal = 1 - THREE.MathUtils.smoothstep(depth, 0.2, 2.6);
        cArr[vi * 3] = cArr[vi * 3] * (1 - shal * 0.25) + shal * 0.34;
        cArr[vi * 3 + 1] = cArr[vi * 3 + 1] * (1 - shal * 0.12) + shal * 0.68;
        cArr[vi * 3 + 2] = cArr[vi * 3 + 2] * (1 - shal * 0.2) + shal * 0.62;
      }
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
    col.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  // foam + swash + wet sand — the shoreline theatre
  private updateShoreline(dt: number): void {
    const t = this.time;
    const NS = this.shore.length;
    const w0 = this.waves[0];

    // BREAKER FOAM: find the moving positive crest of the shore wave. The
    // integrated phase is monotonic toward the beach, so scan the station
    // pairs for where total phase crosses a crest value.
    const fGeo = this.foam.geometry;
    const fPos = fGeo.getAttribute("position") as THREE.BufferAttribute;
    const fUv = fGeo.getAttribute("uv") as THREE.BufferAttribute;
    const fCol = fGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const along = S.x * w0.kx + S.z * w0.kz;
      const base = along * 0.35 - w0.w * 0.9 * t;
      let crossX = -1;
      let fade = 0;
      // crest where sin arg = pi/2 (mod tau); breaker band = stations 1..6
      for (let j = 6; j >= 1; j--) {
        const a0 = -this.phaseAt[j] + base;
        const a1 = -this.phaseAt[j - 1] + base;
        const lo = Math.min(a0, a1);
        const hi = Math.max(a0, a1);
        const n0 = Math.ceil((lo - Math.PI / 2) / TAU);
        const crest = Math.PI / 2 + n0 * TAU;
        if (crest <= hi) {
          const f = (crest - a0) / (a1 - a0 || 1);
          crossX = THREE.MathUtils.lerp(CROSS[j], CROSS[j - 1], f);
          const depth = THREE.MathUtils.lerp(
            this.depthAt[j],
            this.depthAt[j - 1],
            f,
          );
          fade =
            (1 - THREE.MathUtils.smoothstep(depth, 0.4, 2.4)) *
            THREE.MathUtils.smoothstep(depth, 0.14, 0.5);
          break;
        }
      }
      const active = crossX > 0 && fade > 0.02;
      const cx = active ? crossX : 6;
      for (let r = 0; r < 2; r++) {
        const d = cx + (r === 0 ? 1.2 : -1.2);
        const px = S.x + S.sx * d;
        const pz = S.z + S.sz * d;
        const py =
          this.seaLevel + (active ? this.shoreWaveAtX(si, cx, t) : 0) + 0.12;
        const vi = r * NS + si;
        fPos.setXYZ(vi, px, py, pz);
        fUv.setXY(vi, si * 0.35, r);
        const a = active ? fade * (r === 0 ? 0.9 : 0.45) : 0;
        fCol.setXYZW(vi, 1, 1, 1, a);
      }
    }
    fPos.needsUpdate = true;
    fUv.needsUpdate = true;
    fCol.needsUpdate = true;
    fGeo.computeBoundingSphere();

    // SWASH: runs up the sand fast, drains back slow. Leading edge bright
    // and narrow; the film behind is a dim reflective grey-blue.
    const CYCLE = 7;
    const sGeo = this.swash.geometry;
    const sPos = sGeo.getAttribute("position") as THREE.BufferAttribute;
    const sCol = sGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const u = (((t / CYCLE + si * 0.045) % 1) + 1) % 1;
      const e =
        u < 0.32
          ? THREE.MathUtils.smoothstep(u / 0.32, 0, 1)
          : 1 - THREE.MathUtils.smoothstep((u - 0.32) / 0.68, 0, 1);
      const reach = 5.2 * e; // metres inland of the waterline
      this.wetness[si] = Math.max(this.wetness[si] - dt / 14, e);
      const hAt = (dIn: number): number =>
        this.seaLevel + 0.15 + dIn * S.beachSlope;
      const rows: [number, number, number, number, number][] = [
        // dIn, r, g, b, alpha
        [reach, 1, 1, 1, 0.85], // the bright leading edge
        [reach - 2.4, 0.62, 0.72, 0.78, 0.3], // dim water film
        [-0.6, 0.55, 0.7, 0.74, 0.5], // back into the sea
      ];
      for (let r = 0; r < 3; r++) {
        const [dIn, cr, cg, cb, ca] = rows[r];
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        sPos.setXYZ(r * NS + si, px, hAt(Math.max(dIn, -0.6)) + 0.045, pz);
        sCol.setXYZW(r * NS + si, cr, cg, cb, ca * (0.35 + 0.65 * e));
      }
    }
    sPos.needsUpdate = true;
    sCol.needsUpdate = true;
    sGeo.computeBoundingSphere();

    // WET SAND: a darker band from the waterline to the day's high-water
    // mark, fading as it dries (multiply blending darkens the sand under it)
    const wGeo = this.wet.geometry;
    const wPos = wGeo.getAttribute("position") as THREE.BufferAttribute;
    const wCol = wGeo.getAttribute("color") as THREE.BufferAttribute;
    for (let si = 0; si < NS; si++) {
      const S = this.shore[si];
      const w = this.wetness[si];
      const dTop = 5.4 * w;
      for (let r = 0; r < 2; r++) {
        const dIn = r === 0 ? dTop : -0.4;
        const px = S.x - S.sx * dIn;
        const pz = S.z - S.sz * dIn;
        wPos.setXYZ(
          r * NS + si,
          px,
          this.seaLevel + 0.15 + dIn * S.beachSlope + 0.03,
          pz,
        );
        const dark = r === 0 ? 1 : 1 - w * 0.35; // multiply: 1 = untouched
        wCol.setXYZW(r * NS + si, dark, dark, dark * 1.02, 1);
      }
    }
    wPos.needsUpdate = true;
    wCol.needsUpdate = true;
    wGeo.computeBoundingSphere();
  }

  // shore-wave height at an arbitrary cross-shore distance (foam placement)
  private shoreWaveAtX(si: number, x: number, t: number): number {
    let j = 1;
    while (j < CROSS.length - 1 && CROSS[j] < x) j++;
    const f = (x - CROSS[j - 1]) / (CROSS[j] - CROSS[j - 1] || 1);
    const ph = THREE.MathUtils.lerp(this.phaseAt[j - 1], this.phaseAt[j], f);
    const depth = THREE.MathUtils.lerp(this.depthAt[j - 1], this.depthAt[j], f);
    const S = this.shore[si];
    const along = S.x * this.waves[0].kx + S.z * this.waves[0].kz;
    const lift = THREE.MathUtils.clamp(Math.pow(3.2 / depth, 0.25), 1, 1.5);
    const collapse = THREE.MathUtils.smoothstep(depth, 0.16, 0.85);
    return (
      SWELL_AMP *
      lift *
      collapse *
      tsin(-ph + along * 0.35 - this.waves[0].w * 0.9 * t)
    );
  }
}
