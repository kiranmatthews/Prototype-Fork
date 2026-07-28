// THE PROP LIBRARY.
//
// Fifty-six scenery meshes from Kenney's CC0 kits (nature-kit 2.1 and
// graveyard-kit 5.0, kenney.nl), baked into src/prop-data.ts by
// tools/bake-props.mjs. They were chosen because they suit this game
// unusually well: eighty to four hundred triangles, and NO TEXTURES —
// each surface is just a named material like 'woodBark' or 'leafsGreen'.
// That means every one of them can wear the procedural textures from
// textures.ts and take any colour we like, instead of dragging somebody
// else's art direction into the level.
//
// What this module adds on top of the raw meshes is the VARIETY. A model on
// its own is one silhouette; the same model with a family scale, a size
// multiplier, a yaw, a lean in two axes and a tint drawn from a palette is a
// different plant every time you place it. Six families, fifty-six models,
// five or six tints each — the corridor never has to repeat itself.

import * as THREE from "three";
import { PROP_MODELS, PropModel } from "./prop-data";

/** The six families, in the order they appear in the editor palette. */
export const PROP_FAMILIES = [
  "tree",
  "plants",
  "boulder",
  "rocks",
  "trunk",
  "slab",
] as const;
export type PropFamily = (typeof PROP_FAMILIES)[number];

export const PROP_FAMILY_LABELS: Record<PropFamily, string> = {
  tree: "jungle tree",
  plants: "tropical plant",
  boulder: "boulder",
  rocks: "rocks",
  trunk: "fallen trunk",
  slab: "temple slab",
};

/**
 * World units per model unit. NOT a target height — the models inside a
 * family have wildly different natural proportions (a temple column stands a
 * whole unit tall, a flagstone disc is five hundredths), and normalising them
 * all to one height would turn the flagstone into a pillar. Scaling the family
 * as a whole keeps the artists' relative sizes intact.
 */
export const PROP_SCALE: Record<PropFamily, number> = {
  tree: 8,
  plants: 4,
  boulder: 5,
  rocks: 5,
  trunk: 5,
  slab: 5,
};

/** Which game surface each baked role wears, and how big its texels are. */
export type PropRoleName = "bark" | "sawn" | "leaf" | "stone" | "dirt";
/** World units across one texture tile, per role. */
const TILE: Record<PropRoleName, number> = {
  bark: 2.2,
  sawn: 1.8,
  leaf: 2.6,
  stone: 2.4,
  dirt: 2.0,
};

// ---- tints -----------------------------------------------------------------
//
// A tint is a set of colours, one per role, not a single colour: a tree is
// bark AND leaves, and shifting only one of them looks like a bug. Every tint
// is multiplied into the mesh as a VERTEX COLOUR rather than set on a
// material, which is what makes the variety free — a hundred plants in six
// colours still merge into one draw call per surface.

export interface PropTint {
  name: string;
  roles: Partial<Record<PropRoleName, number>>;
}

const T = (
  name: string,
  roles: Partial<Record<PropRoleName, number>>,
): PropTint => ({ name, roles });

export const PROP_TINTS: Record<PropFamily, PropTint[]> = {
  tree: [
    T("jungle green", { leaf: 0x5aa83c, bark: 0x8a6b47 }),
    T("deep canopy", { leaf: 0x2f6f31, bark: 0x6d5238 }),
    T("olive", { leaf: 0x7d9a3c, bark: 0x9b7a52 }),
    T("emerald", { leaf: 0x2fa05c, bark: 0x7a5f40 }),
    T("sun-bleached", { leaf: 0xa8c46a, bark: 0xc0a077 }),
    T("dark rot", { leaf: 0x35502c, bark: 0x4f4030 }),
  ],
  plants: [
    T("fresh green", { leaf: 0x62b845 }),
    T("deep frond", { leaf: 0x35803a }),
    T("lime", { leaf: 0x93cc4a }),
    T("blue-green", { leaf: 0x36a37c }),
    T("dry", { leaf: 0xb4b04e }),
    T("shade", { leaf: 0x2c6640 }),
  ],
  boulder: [
    T("mossy granite", { stone: 0x9aa39c, dirt: 0x8a8175, leaf: 0x548b3e }),
    T("wet slate", { stone: 0x7c8791, dirt: 0x6f7178, leaf: 0x3f7a45 }),
    T("sandstone", { stone: 0xc0ab86, dirt: 0xb09873, leaf: 0x7fa04a }),
    T("volcanic", { stone: 0x6b6560, dirt: 0x5c554f, leaf: 0x486b39 }),
    T("pale limestone", { stone: 0xd2cdbc, dirt: 0xbdb49c, leaf: 0x6f9c4d }),
  ],
  rocks: [
    T("mossy granite", { stone: 0x9aa39c, dirt: 0x8a8175, leaf: 0x548b3e }),
    T("wet slate", { stone: 0x7c8791, dirt: 0x6f7178, leaf: 0x3f7a45 }),
    T("sandstone", { stone: 0xc0ab86, dirt: 0xb09873, leaf: 0x7fa04a }),
    T("river stone", { stone: 0xa8a49b, dirt: 0x94897c, leaf: 0x5f8f57 }),
    T("volcanic", { stone: 0x6b6560, dirt: 0x5c554f, leaf: 0x486b39 }),
  ],
  trunk: [
    T("damp bark", { bark: 0x7a5c3c, sawn: 0xc7a074 }),
    T("pale deadwood", { bark: 0xb09a78, sawn: 0xd8c19b }),
    T("rotted", { bark: 0x5d4a34, sawn: 0x8a7350 }),
    T("mossed over", { bark: 0x6e7a4a, sawn: 0xa8a06e }),
    T("red cedar", { bark: 0x8e563a, sawn: 0xd0a279 }),
  ],
  slab: [
    T("weathered stone", { stone: 0xbdb9a8 }),
    T("mossy masonry", { stone: 0x94a189 }),
    T("sun-warmed", { stone: 0xd2c4a0 }),
    T("dark basalt", { stone: 0x7e7a74 }),
    T("ochre", { stone: 0xc09a63 }),
    T("bone pale", { stone: 0xe0dbcb }),
  ],
};

// ---- lookups ---------------------------------------------------------------

export const propModels = (family: string): PropModel[] =>
  PROP_MODELS[family] ?? [];

/** Wrap an index into a family, so a stale variant never blanks a prop. */
export function propModel(family: string, variant: number): PropModel | null {
  const list = propModels(family);
  if (!list.length) return null;
  const i = Math.floor(variant);
  return list[((i % list.length) + list.length) % list.length];
}

export function propTint(family: string, tint: number): PropTint | null {
  const list = PROP_TINTS[family as PropFamily];
  if (!list || !list.length) return null;
  const i = Math.floor(tint);
  return list[((i % list.length) + list.length) % list.length];
}

// ---- decoding --------------------------------------------------------------

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface PropSurface {
  role: PropRoleName;
  geo: THREE.BufferGeometry;
}

// Decoded once per model per session and shared by every copy in the world —
// the batcher copies vertices out of these, it never mutates them.
const GEO = new Map<string, PropSurface[]>();

/**
 * BOX PROJECTION. The kits ship UVs pointing into a swatch atlas we are not
 * using, so they are regenerated: each vertex is projected down whichever axis
 * its normal leans hardest along. On a hundred-triangle model under a noisy
 * procedural texture the seams that costs are invisible, and it means one
 * texture tiles correctly over a boulder, a column and a palm trunk alike.
 */
function project(
  pos: Float32Array,
  nrm: Float32Array,
  scale: number,
): Float32Array {
  const uv = new Float32Array((pos.length / 3) * 2);
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const ax = Math.abs(nrm[i]);
    const ay = Math.abs(nrm[i + 1]);
    const az = Math.abs(nrm[i + 2]);
    if (ay >= ax && ay >= az) {
      uv[j] = pos[i] * scale;
      uv[j + 1] = pos[i + 2] * scale;
    } else if (ax >= az) {
      uv[j] = pos[i + 2] * scale;
      uv[j + 1] = pos[i + 1] * scale;
    } else {
      uv[j] = pos[i] * scale;
      uv[j + 1] = pos[i + 1] * scale;
    }
  }
  return uv;
}

/** The surfaces of one model, in model units, sitting on y = 0. */
export function propSurfaces(family: string, variant: number): PropSurface[] {
  const m = propModel(family, variant);
  if (!m) return [];
  const key = `${family}/${m.id}`;
  const hit = GEO.get(key);
  if (hit) return hit;
  const famScale = PROP_SCALE[family as PropFamily] ?? 1;
  const out: PropSurface[] = [];
  for (const r of m.roles) {
    const pb = unb64(r.pos);
    const nb = unb64(r.nrm);
    const n = r.tris * 3;
    const pos = new Float32Array(n * 3);
    const nrm = new Float32Array(n * 3);
    const span = [m.hi[0] - m.lo[0], m.hi[1] - m.lo[1], m.hi[2] - m.lo[2]];
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const q = pb[(i * 3 + c) * 2] | (pb[(i * 3 + c) * 2 + 1] << 8);
        pos[i * 3 + c] = m.lo[c] + (q / 65535) * span[c];
        const s = nb[i * 3 + c];
        nrm[i * 3 + c] = (s > 127 ? s - 256 : s) / 127;
      }
      const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1;
      nrm[i * 3] /= l;
      nrm[i * 3 + 1] /= l;
      nrm[i * 3 + 2] /= l;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute(
      "uv",
      new THREE.BufferAttribute(
        project(pos, nrm, famScale / (TILE[r.role] ?? 2)),
        2,
      ),
    );
    out.push({ role: r.role, geo });
  }
  GEO.set(key, out);
  return out;
}

/** Natural size of a placed prop, after the family scale and a size knob. */
export function propSize(
  family: string,
  variant: number,
  w: number,
): { height: number; radius: number } {
  const m = propModel(family, variant);
  const s = (PROP_SCALE[family as PropFamily] ?? 1) * w;
  return { height: (m?.h ?? 1) * s, radius: (m?.r ?? 0.5) * s };
}

/**
 * Everything about a prop that is not its position, derived from one integer.
 * Scattering wants a different plant every time without a builder having to
 * choose; this turns a seed into a variant, a tint, a size, a spin and a lean
 * that all look deliberate. Deterministic, so a level looks the same on every
 * load and a capture round-trips exactly.
 */
export function propRoll(
  family: string,
  seed: number,
): { variant: number; tint: number; w: number; yaw: number; tilt: number } {
  let h = Math.imul(seed ^ 0x9e3779b9, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  const a = (h >>> 0) / 4294967296;
  const b = ((Math.imul(h, 668265263) >>> 0) % 65536) / 65536;
  const c = ((Math.imul(h ^ 0x5bf03635, 374761393) >>> 0) % 65536) / 65536;
  const nModels = propModels(family).length || 1;
  const nTints = (PROP_TINTS[family as PropFamily] ?? []).length || 1;
  return {
    variant: Math.floor(a * nModels),
    tint: Math.floor(b * nTints),
    // a fifth either way: enough to break the silhouette, not enough to make
    // a plant read as a different species
    w: 0.78 + c * 0.5,
    yaw: a * 360,
    tilt: (b - 0.5) * 9,
  };
}
