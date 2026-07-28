// PROCEDURAL SURFACE TEXTURES.
//
// The world is tinted greybox geometry: every material takes a near-white
// texture and colours it, so these images carry STRUCTURE, not hue. What they
// have to do is give a flat polygon a material read at a glance — this is
// stone, that is bark — from a corridor camera that never gets closer than a
// couple of metres.
//
// They are painted per PIXEL from noise fields rather than stamped from canvas
// blobs, which buys three things the blob approach could not:
//
//   SEAMLESS BY CONSTRUCTION. Every field is periodic on a lattice that divides
//   the image, so the tile wraps exactly. No edge blending, no visible seam
//   however far a deck stretches.
//
//   DETAIL AT EVERY SCALE. Big tonal drifts, mid-scale features (pebbles,
//   courses, fissures, veins) and a fine grain, layered. A texture with one
//   scale of detail reads as noise up close and as flat colour far away.
//
//   DETERMINISM. Seeded, so a level looks the same every load and a change to
//   one material can be compared against the last one honestly.
//
// The expensive-looking part is DOMAIN WARPING: sampling a noise field at
// coordinates that another noise field has pushed around. It is what turns
// concentric blobs into flowing organic form, and it is the single biggest
// difference between "procedural texture" and something that looks painted.

// ---- noise kit -------------------------------------------------------------

/** Integer hash -> [0,1). Cheap, well-mixed, stable across engines. */
function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) +
    Math.imul(y, 668265263) +
    Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * (3 - 2 * t);
const wrap = (a: number, n: number): number => {
  const r = a % n;
  return r < 0 ? r + n : r;
};
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Smooth 0..1 ramp between two edges. */
const step2 = (a: number, b: number, t: number): number =>
  fade(clamp01((t - a) / (b - a || 1e-6)));

/**
 * Value noise on a PERIODIC lattice. x/y are in cell units; the lattice wraps
 * every `p` cells, so sampling x = u * p over u in 0..1 tiles exactly.
 */
function vnoise(x: number, y: number, p: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const u = fade(x - ix);
  const v = fade(y - iy);
  // this is the innermost loop of every painter, so the neighbour indices are
  // stepped rather than wrapped a second time
  let x0 = ix % p;
  if (x0 < 0) x0 += p;
  let y0 = iy % p;
  if (y0 < 0) y0 += p;
  const x1 = x0 + 1 === p ? 0 : x0 + 1;
  const y1 = y0 + 1 === p ? 0 : y0 + 1;
  return mix(
    mix(hash2(x0, y0, seed), hash2(x1, y0, seed), u),
    mix(hash2(x0, y1, seed), hash2(x1, y1, seed), u),
    v,
  );
}

/**
 * Fractal sum. Each octave doubles the lattice period as well as the
 * frequency, so every octave tiles on the same image and the sum does too.
 */
function fbm(
  u: number,
  v: number,
  p: number,
  oct: number,
  seed: number,
  gain = 0.5,
): number {
  let f = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const q = p << i;
    f += amp * vnoise(u * q, v * q, q, seed + i * 101);
    norm += amp;
    amp *= gain;
  }
  return f / norm;
}

/** Ridged fractal: creased where the noise crosses its midpoint. Fissures. */
function ridged(
  u: number,
  v: number,
  p: number,
  oct: number,
  seed: number,
  gain = 0.5,
): number {
  let f = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const q = p << i;
    const n = vnoise(u * q, v * q, q, seed + i * 71);
    f += amp * (1 - Math.abs(n * 2 - 1));
    norm += amp;
    amp *= gain;
  }
  return f / norm;
}

interface Cell {
  d1: number; // distance to the nearest feature point, in cell units
  d2: number; // ...and to the second nearest: d2-d1 is the cell BORDER
  id: number; // a stable [0,1) value per cell, for per-pebble/per-block tone
  dx: number; // offset from that feature point, so a cell can be SHADED —
  dy: number; // without the direction a pebble is a flat disc, not a stone
}

const cell = (): Cell => ({ d1: 0, d2: 0, id: 0, dx: 0, dy: 0 });
/**
 * Scratch cells. A worley sample used to hand back a fresh object, which at
 * three samples a texel is 200k allocations per image — more expensive than
 * the noise it was carrying. Callers pass the scratch they want written, so a
 * painter holding two samples at once still gets two distinct results.
 */
const CA = cell();
const CB = cell();

/** Periodic Worley/cellular. `n` cells across the image, wraps at the edge. */
function worley(
  u: number,
  v: number,
  n: number,
  seed: number,
  out: Cell,
): Cell {
  const x = u * n;
  const y = v * n;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  let dx = 0;
  let dy = 0;
  for (let oy = -1; oy <= 1; oy++) {
    let cy = (iy + oy) % n;
    if (cy < 0) cy += n;
    for (let ox = -1; ox <= 1; ox++) {
      let cx = (ix + ox) % n;
      if (cx < 0) cx += n;
      const jx = ix + ox + hash2(cx, cy, seed);
      const jy = iy + oy + hash2(cx, cy, seed + 7717);
      const ex = jx - x;
      const ey = jy - y;
      const d = Math.sqrt(ex * ex + ey * ey);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(cx, cy, seed + 313);
        dx = x - jx;
        dy = y - jy;
      } else if (d < d2) d2 = d;
    }
  }
  out.d1 = d1;
  out.d2 = d2;
  out.id = id;
  out.dx = dx;
  out.dy = dy;
  return out;
}

// ---- painting --------------------------------------------------------------

/** A painter answers "what colour is this texel", in 0..1 RGB. */
type Painter = (u: number, v: number, out: [number, number, number]) => void;

/**
 * These are TINTED at use, so the average has to sit high — a texture that
 * averages mid-grey turns every colour muddy. Structure lives as contrast
 * around a bright mean, not as darkness.
 */
const WARM: [number, number, number] = [1.0, 0.955, 0.86];
const COOL: [number, number, number] = [0.95, 0.98, 1.0];
const GREEN: [number, number, number] = [0.86, 1.0, 0.8];

function tone(
  out: [number, number, number],
  lum: number,
  hue: [number, number, number],
): void {
  out[0] = lum * hue[0];
  out[1] = lum * hue[1];
  out[2] = lum * hue[2];
}

/** Scratch hue, so a painter that mixes its own does not allocate per texel. */
const HUE: [number, number, number] = [0, 0, 0];

// ---- the materials ---------------------------------------------------------

// DUSTY GROUND. Dry trodden earth: pale, warm, powdery. Big damp/dry drifts
// carry the eye, pebbles half-buried in it carry the scale, and a fine grain
// keeps it from going plasticky where the camera gets close. The pebbles are
// lit from the top-left so they read as SITTING IN the surface rather than
// printed on it — the one cue that sells a flat polygon as ground.
const PEBBLES = [
  // cells across, radius in cell units, how rare, seed
  [6, 0.34, 0.86, 53],
  [13, 0.26, 0.88, 61],
] as const;
const dusty: Painter = (u, v, out) => {
  const warpX = fbm(u, v, 3, 3, 11) - 0.5;
  const warpY = fbm(u + 0.31, v + 0.17, 3, 3, 23) - 0.5;
  // damp earth against dry dust: the drift has to be BROAD and strong, or the
  // ground reads as one flat colour the moment you are more than a deck away
  const drift = fbm(u + warpX * 0.5, v + warpY * 0.5, 2, 5, 31);
  let lum = 0.98 - 0.26 * drift;
  let damp = drift; // ...and it darkens the hue as well as the value
  // scuffed tracks dragged through the dust
  const scuff = ridged(u * 0.3 + warpX * 0.4, v * 2.4, 4, 3, 47);
  lum -= 0.07 * step2(0.6, 0.98, scuff);
  // dried-mud cracking, very faint, following the damp patches
  const crack = worley(u + warpX * 0.2, v + warpY * 0.2, 9, 49, CA);
  lum -= step2(0.05, 0.0, crack.d2 - crack.d1) * 0.1 * damp;
  // STONES. Sparse — a pebble every few cells, not a sprinkle of hundreds.
  // Each is shaded as a DOME: a surface normal is reconstructed from the
  // offset to the cell centre and lit from the upper left, so one side takes
  // the light and the other holds shadow. Without that a pebble is a flat
  // disc, which is why the first pass read as soap suds.
  const LX = -0.55;
  const LY = -0.62;
  const LZ = 0.56;
  for (let i = 0; i < PEBBLES.length; i++) {
    const [cells, size, rare, sd] = PEBBLES[i];
    // warp the cell field so pebbles are irregular lumps, not circles
    const c = worley(u + warpX * 0.06, v + warpY * 0.06, cells, sd, CB);
    const rw = size * (0.72 + 0.5 * hash2((c.id * 811) | 0, 5, sd));
    if (c.id > rare && c.d1 < rw) {
      const t = c.d1 / rw; // 0 at the middle, 1 at the rim
      const h = Math.sqrt(clamp01(1 - t * t)); // dome height
      const nx = c.dx / rw;
      const ny = c.dy / rw;
      const lit = clamp01(nx * LX + ny * LY + h * LZ);
      const stone = 0.56 + 0.2 * hash2((c.id * 997) | 0, 3, sd);
      const cover = step2(1.0, 0.86, t);
      lum = mix(lum, stone * (0.55 + 0.85 * lit), cover);
      // the shadow the pebble casts into the dust on its lower right
      lum -= step2(0.86, 1.06, t) * 0.16 * clamp01(nx * -LX + ny * -LY);
      damp *= 1 - cover * 0.85; // stone is greyer than the earth around it
    }
  }
  lum += (fbm(u, v, 26, 3, 71) - 0.5) * 0.1; // grit
  lum += (hash2((u * 512) | 0, (v * 512) | 0, 97) - 0.5) * 0.045; // powder
  HUE[0] = mix(1.0, 0.86, damp);
  HUE[1] = mix(0.94, 0.8, damp);
  HUE[2] = mix(0.78, 0.66, damp);
  tone(out, clamp01(lum), HUE);
};

// BERM. The mossy shoulder of a jungle path: clumps of moss grown over packed
// earth, dark in the crevices between clumps and pale where a clump has dried
// out on top. The clump BORDERS do the work — worley's d2-d1 gives a natural
// crack network that no amount of soft blobs will imitate.
const berm: Painter = (u, v, out) => {
  // Warp gently and ISOTROPICALLY. The first pass warped hard along one axis
  // and the whole texture picked up a diagonal grain that tiled visibly.
  const wx = (fbm(u, v, 4, 3, 131) - 0.5) * 0.09;
  const wy = (fbm(u + 0.4, v + 0.7, 4, 3, 137) - 0.5) * 0.09;
  // Cushions of moss at two scales: a big soft one for the mass, a fine one
  // growing over it for the texture. Shaded off the cell centre so each tuft
  // is domed rather than outlined.
  const big = worley(u + wx, v + wy, 11, 149, CA);
  const fine = worley(u + wx * 1.6, v + wy * 1.6, 26, 151, CB);
  const bt = clamp01(big.d1 / 0.62);
  const ft = clamp01(fine.d1 / 0.6);
  const bigDome = Math.sqrt(clamp01(1 - bt * bt));
  const fineDome = Math.sqrt(clamp01(1 - ft * ft));
  let lum = 0.6 + 0.16 * big.id + 0.1 * fine.id;
  lum += bigDome * 0.16 + fineDome * 0.12;
  lum -= step2(0.05, 0.0, big.d2 - big.d1) * 0.12; // damp crevice between
  // bare trodden earth showing through where the moss has worn away
  // ...and where it has, the earth beneath is OLIVE — mixing all the way to
  // the warm hue turned those patches pink against the green
  const bare = step2(0.62, 0.9, fbm(u, v, 5, 4, 157));
  lum = mix(lum, 0.82 - 0.14 * fbm(u, v, 12, 3, 161), bare * 0.7);
  lum += (fbm(u, v, 28, 3, 167) - 0.5) * 0.1; // leaf litter
  lum += (hash2((u * 512) | 0, (v * 512) | 0, 173) - 0.5) * 0.045;
  const b = bare * 0.75;
  HUE[0] = mix(GREEN[0], 0.98, b);
  HUE[1] = mix(GREEN[1], 0.95, b);
  HUE[2] = mix(GREEN[2], 0.74, b);
  tone(out, clamp01(lum), HUE);
};

// GRASS. The trap here is soup: soft green blobs average out to a flat field
// the moment the camera pulls back. Real grass reads as DIRECTION — thousands
// of near-parallel blades — so the base is a noise field squashed hard along
// one axis to make strands, warped so the strands lie in swirling patches, and
// only then tinted with the broad light and shade.
const BLADES = [
  // strips across, segments along, how far it lifts the mat, seed
  [40, 7, 0.34, 223],
  [67, 11, 0.24, 227],
] as const;
const grass: Painter = (u, v, out) => {
  // Two failed passes taught this: grass cannot be made out of a noise field.
  // Stretch noise and you get combed hair; leave it round and you get soup.
  // So the blades are DISCRETE — a strip index across, a segment index along,
  // and a profile within each — and the noise is demoted to the lighting.
  const tilt = (fbm(u, v, 4, 3, 211) - 0.5) * 0.55; // which way the patch lies
  const su = u + v * tilt;
  let lum = 0.62 + 0.2 * fbm(u, v, 7, 3, 233); // the mat of dead stuff below
  for (let b = 0; b < BLADES.length; b++) {
    const [N, along, amp, sd] = BLADES[b];
    const sx = wrap(su, 1) * N;
    const i = Math.floor(sx);
    const f = sx - i;
    const jit = hash2(i, 0, sd);
    // blades of finite length, staggered so the ends do not line up in rows
    const sy = v * along + jit * 3.1;
    const seg = Math.floor(sy);
    const g = sy - seg;
    const bright = hash2(wrap(i, N), seg, sd + 31);
    // across the blade: a rounded profile. Along it: bright at the tip,
    // shaded into the mat at the root, which is what gives a lawn its depth.
    const prof = clamp01(1 - Math.abs(f * 2 - 1) * (1.15 + bright * 0.5));
    const rise = step2(0.0, 0.45, g) * step2(1.0, 0.55, g);
    lum += prof * prof * rise * amp * (0.45 + bright);
  }
  // tufts, then the broad canopy shade with sun patches through it
  lum *= mix(0.9, 1.1, fbm(u, v, 5, 3, 237));
  lum *= mix(0.88, 1.12, fbm(u, v, 2, 4, 241));
  lum += (fbm(u, v, 40, 2, 243) - 0.5) * 0.05;
  const dry = step2(0.88, 1.02, lum);
  HUE[0] = mix(GREEN[0], 1.0, dry);
  HUE[1] = mix(GREEN[1], 0.97, dry);
  HUE[2] = mix(GREEN[2], 0.66, dry);
  tone(out, clamp01(lum), HUE);
};

// TEMPLE ROCK. Cut masonry, weathered. Courses of blocks with the vertical
// joints offset row to row; the joint LINE is displaced by noise so no edge is
// ruler-straight and the wall stops looking like a tiled bitmap. Each block
// gets its own tone, a granular face, a rain streak running down from the
// course above, and moss taking hold in the joints.
const templeRock: Painter = (u, v, out) => {
  const ROWS = 4;
  const COLS = 3;
  // wobble the joints, so blocks are cut stone and not screen pixels
  const ju = u + (fbm(u, v, 12, 3, 307) - 0.5) * 0.022;
  const jv = v + (fbm(u + 0.5, v, 12, 3, 311) - 0.5) * 0.016;
  const row = Math.floor(jv * ROWS);
  const stagger = (wrap(row, 2) * 0.5) / COLS;
  const cu = wrap(ju - stagger, 1) * COLS;
  const col = Math.floor(cu);
  const fu = cu - col;
  const fv = jv * ROWS - row;
  const id = hash2(wrap(col, COLS), wrap(row, ROWS), 313);
  const id2 = hash2(wrap(col, COLS), wrap(row, ROWS), 317);
  // mortar: the gap between blocks, and it is RECESSED, so it is darker and
  // catches a highlight on its upper lip
  const M = 0.055;
  const inU = step2(0, M, fu) * step2(0, M, 1 - fu);
  const inV =
    step2(0, (M * COLS) / ROWS, fv) * step2(0, (M * COLS) / ROWS, 1 - fv);
  const face = inU * inV;
  let lum = 0.72 + 0.2 * id;
  // block face: granular stone, plus a broad bevel so the block reads convex
  lum += (fbm(u, v, 20, 4, 331) - 0.5) * 0.12;
  lum += (fbm(u, v, 64, 2, 337) - 0.5) * 0.05;
  const bevel = Math.min(fu, 1 - fu, fv, 1 - fv);
  lum += step2(0.0, 0.18, bevel) * 0.06 - 0.03;
  // rain streaks running DOWN the face from the joint above
  const streak = ridged(u * 2.4 + id2, v * 0.5, 8, 3, 341);
  lum -= step2(0.62, 1.0, streak) * 0.13 * fv;
  // erosion: chipped corners and a worn top edge
  const chip = step2(0.55, 0.85, fbm(u * 1.4, v * 1.4, 10, 3, 347));
  lum -= chip * step2(0.3, 0.0, bevel) * 0.18;
  // the mortar itself
  lum = mix(0.5 + 0.1 * id2, lum, face);
  // moss creeping out of the joints and up the lower part of each block
  const moss =
    (1 - face) * step2(0.35, 0.75, fbm(u, v, 5, 4, 353)) +
    face * step2(0.72, 1.0, fbm(u, v, 6, 3, 359)) * step2(0.5, 0.0, fv);
  const m = clamp01(moss) * 0.75;
  lum *= mix(1, 0.86, m);
  HUE[0] = mix(COOL[0], GREEN[0], m);
  HUE[1] = mix(COOL[1], GREEN[1], m);
  HUE[2] = mix(COOL[2], GREEN[2], m);
  tone(out, clamp01(lum), HUE);
};

// TREE BARK. Cylinder UVs run V along the trunk, so the fissures have to run
// along V — a bark texture with horizontal grain reads as a stack of tyres.
// Ridged noise stretched hard along the axis gives the fissure network; the
// deep ones get darker and the plates between them catch the light. Knots are
// worley cells with rings turned around them, sparse enough to be an event.
const bark: Painter = (u, v, out) => {
  // Warp ALONG the trunk so the fissures wander and fork instead of running
  // as parallel stripes — straight grain is the tell that says "texture".
  const w = (fbm(u * 2.2, v * 0.3, 5, 4, 409) - 0.5) * 0.3;
  const w2 = (fbm(u * 1.1, v * 0.6, 3, 3, 411) - 0.5) * 0.16;
  const fu = u + w + w2;
  const fissure = ridged(fu * 4.2, v * 0.38, 6, 4, 419, 0.5);
  let lum = 0.5 + 0.42 * fissure;
  // the deep creases go properly dark: that contrast IS the material
  lum -= step2(0.5, 0.05, fissure) * 0.34;
  // plates between them, lit across their crowns
  lum += step2(0.62, 0.95, fissure) * 0.2;
  // coarse fibre running the length, then grain
  lum += (fbm(fu * 5, v * 0.4, 18, 3, 421) - 0.5) * 0.15;
  lum += (fbm(u, v, 44, 2, 431) - 0.5) * 0.06;
  lum += (hash2((u * 512) | 0, (v * 512) | 0, 439) - 0.5) * 0.05;
  // KNOTS: rare, and the grain wraps around them
  const k = worley(u, v, 5, 433, CA);
  if (k.id > 0.9) {
    const r = k.d1 / 0.3;
    if (r < 1) {
      const rings = 0.5 + 0.5 * Math.cos(r * 13 + k.id * 9);
      lum = mix(0.36 + 0.4 * rings, lum, step2(0.4, 1.0, r));
    }
  }
  tone(out, clamp01(lum), WARM);
};

// TROPICAL LEAF. Mapped on blade geometry whose U runs tip-ward and whose V
// runs across the width, so the midrib is a line along V = 0.5 and the side
// veins fan off it toward the tip. Between the veins the lamina is faintly
// celled — that is what stops a big leaf reading as flat plastic — and the
// whole thing darkens toward the margins and pales along the rib, which is
// how a lit leaf actually behaves.
const leaf: Painter = (u, v, out) => {
  const mid = Math.abs(v - 0.5) * 2; // 0 on the rib, 1 at the margin
  let lum = 0.98 - 0.3 * mid * mid; // lit along the rib, deep at the margins
  // MIDRIB: a pale channel with a dark shadow either side of it, tapering to
  // the tip. Weak veins are the reason a procedural leaf looks like paper —
  // at the size these are drawn, the rib IS the silhouette's information.
  lum += step2(0.11, 0.0, mid) * 0.22;
  lum -= step2(0.1, 0.2, mid) * step2(0.3, 0.18, mid) * 0.16;
  // SIDE VEINS fanning off the rib toward the tip, mirrored either side
  // The veins FAN: each leaves the rib at a shallow angle and curves toward
  // the tip, so the spacing opens out along the blade. A constant angle gives
  // the herringbone the first pass had, which reads as printed fabric.
  const sweep =
    u * 1.9 + mid * mid * 1.5 + mid * 0.7 + (fbm(u, v, 4, 2, 511) - 0.5) * 0.4;
  const veins = 0.5 + 0.5 * Math.cos(sweep * Math.PI * 2);
  const vs = step2(0.66, 1.0, veins) * step2(0.08, 0.3, mid) * (1 - u * 0.4);
  lum += vs * 0.14;
  lum -= step2(0.34, 0.0, veins) * step2(0.08, 0.38, mid) * 0.05;
  // lamina puckering between the veins
  const c = worley(u * 2.2, v * 0.9, 7, 521, CA);
  lum -= step2(0.05, 0.0, c.d2 - c.d1) * 0.05;
  lum += (fbm(u * 1.6, v, 8, 3, 523) - 0.5) * 0.14;
  // the margin dries out pale, the base stays deep and shadowed
  lum += step2(0.86, 1.0, mid) * 0.14;
  lum -= step2(0.3, 0.0, u) * 0.12;
  // sun-bleached blotches, the way a real frond weathers
  lum += step2(0.74, 0.95, fbm(u * 1.4, v * 1.4, 5, 3, 541)) * 0.12;
  tone(out, clamp01(lum), GREEN);
};

export const PROCEDURAL: Record<string, Painter> = {
  dirt: dusty,
  jungle: berm,
  grass,
  stone: templeRock,
  wood: bark,
  leaf,
};

// ---- getting them on screen without a hitch --------------------------------
//
// Six of these at 256px is a few hundred milliseconds of arithmetic, and a
// level build that stops to do it is a boot that freezes — on a phone, the
// whole of it, before the first frame ever lands. So each image is painted
// TWICE:
//
//   PREVIEW, on the spot. A quarter-resolution paint blown up to full size:
//   a sixteenth of the work, so all six cost a couple of frames. It has the
//   right colour and the right broad structure, just soft.
//
//   REFINE, afterwards. Full detail, a band of rows per task, repainted into
//   the SAME canvas at the SAME size — three.js allocates immutable texture
//   storage on first upload, so the dimensions must not move; a same-size
//   repaint re-uploads and regenerates mipmaps off `needsUpdate` alone.
//
// And painted ONCE PER SESSION, not once per level: switching levels used to
// pay the whole bill again for images that never change.

/** Preview divisor, and how many texels of refining to do per task. */
const COARSE = 4;
const CHUNK = 4096;

interface Job {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  size: number;
  painter: Painter;
  img: ImageData | null; // the full-detail image, painted band by band
  row: number; // ...and how far down it we have got
  waiting: (() => void)[];
}

const CACHE = new Map<string, Job>();
const QUEUE: Job[] = [];
let pumping = false;

/** Paint rows [y0, y1) of `painter` into `img`. */
function shade(
  img: ImageData,
  size: number,
  painter: Painter,
  y0: number,
  y1: number,
): void {
  const d = img.data;
  const rgb: [number, number, number] = [0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      painter((x + 0.5) / size, (y + 0.5) / size, rgb);
      const i = (y * size + x) * 4;
      d[i] = (rgb[0] * 255) | 0;
      d[i + 1] = (rgb[1] * 255) | 0;
      d[i + 2] = (rgb[2] * 255) | 0;
      d[i + 3] = 255;
    }
  }
}

/** The cheap stand-in: paint small, then let the canvas scale it up. */
function preview(job: Job): void {
  const n = Math.max(8, (job.size / COARSE) | 0);
  const small = document.createElement("canvas");
  small.width = n;
  small.height = n;
  const sctx = small.getContext("2d");
  if (!sctx) return;
  const img = sctx.createImageData(n, n);
  shade(img, n, job.painter, 0, n);
  sctx.putImageData(img, 0, 0);
  job.ctx.imageSmoothingEnabled = true;
  job.ctx.drawImage(small, 0, 0, job.size, job.size);
}

/** One band of full detail. Returns true when the image is finished. */
function step(job: Job): boolean {
  if (!job.img) job.img = job.ctx.createImageData(job.size, job.size);
  const rows = Math.max(1, (CHUNK / job.size) | 0);
  const end = Math.min(job.size, job.row + rows);
  shade(job.img, job.size, job.painter, job.row, end);
  job.row = end;
  if (job.row < job.size) return false;
  job.ctx.putImageData(job.img, 0, 0);
  job.img = null; // the canvas owns the pixels now; drop the copy
  for (const cb of job.waiting) cb();
  job.waiting.length = 0;
  return true;
}

// A macrotask rather than a frame callback: this has to keep draining while
// the game holds the frame loop, and headless runs stub rAF out entirely.
function pump(): void {
  if (pumping || !QUEUE.length) return;
  pumping = true;
  setTimeout(() => {
    pumping = false;
    const job = QUEUE[0];
    if (job && step(job)) QUEUE.shift();
    pump();
  }, 0);
}

/**
 * A canvas for `kind`, usable immediately — soft at first, sharpening within
 * a few frames. Null if nothing paints that kind.
 */
export function paintTexture(
  kind: string,
  size: number,
): HTMLCanvasElement | null {
  const key = `${kind}@${size}`;
  const hit = CACHE.get(key);
  if (hit) return hit.canvas;
  const painter = PROCEDURAL[kind];
  if (!painter) return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const job: Job = {
    canvas,
    ctx,
    size,
    painter,
    img: null,
    row: 0,
    waiting: [],
  };
  CACHE.set(key, job);
  preview(job);
  QUEUE.push(job);
  pump();
  return canvas;
}

/**
 * Call `cb` once `kind` has been repainted at full detail, so whoever is
 * showing it can flag their texture dirty. Nothing to do if it is already
 * sharp — the canvas handed out was final.
 */
export function onRefined(kind: string, size: number, cb: () => void): void {
  const job = CACHE.get(`${kind}@${size}`);
  if (job && job.row < job.size) job.waiting.push(cb);
}

/** Finish every outstanding refine now. For tests and screenshots. */
export function flushTextures(): void {
  for (const job of QUEUE) while (!step(job));
  QUEUE.length = 0;
}
