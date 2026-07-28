// BAKE THE EXTERNAL PROP LIBRARY INTO SOURCE.
//
// The scenery models come from Kenney's CC0 kits (nature-kit 2.1 and
// graveyard-kit 5.0, kenney.nl). They are ideal for this game: 80-400
// triangles, no textures at all — just named materials like 'woodBark' and
// 'leafsGreen' — so every surface can be remapped onto the procedural
// textures in textures.ts and tinted freely.
//
// They are baked into a source module rather than shipped as .glb because the
// level build is SYNCHRONOUS: decor registers a transform and gets merged into
// one mesh per shape at build time. A model that arrives over the network
// after the level is standing would need a rebuild to appear. Quantised into
// the bundle it is simply there, first frame, offline, no request.
//
// Run:  node tools/bake-props.mjs <kit-dir>... > src/prop-data.ts
//
// Positions are quantised to 16 bits across each model's own bounding box
// (sub-millimetre at this scale), normals to 8 bits, and UVs are NOT stored —
// they are generated at decode time by box projection, which costs nothing and
// saves a quarter of the payload.

import fs from "fs";
import path from "path";

// ---- glTF reading ----------------------------------------------------------

function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off);
    const type = b.readUInt32LE(off + 4);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) json = JSON.parse(data.toString("utf8"));
    else if (type === 0x004e4942) bin = data;
    off += 8 + len;
    off += (4 - (off % 4)) % 4;
  }
  return { g: json, bin };
}

const COMP = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
};
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function accessor(g, bin, i) {
  const a = g.accessors[i];
  const n = NUM[a.type];
  const Ctor = COMP[a.componentType];
  const out = new Float32Array(a.count * n);
  if (a.bufferView === undefined) return out; // sparse/zero-filled
  const bv = g.bufferViews[a.bufferView];
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride || n * Ctor.BYTES_PER_ELEMENT;
  for (let e = 0; e < a.count; e++) {
    const at = base + e * stride;
    const view = new Ctor(bin.buffer, bin.byteOffset + at, n);
    for (let c = 0; c < n; c++) out[e * n + c] = view[c];
  }
  return out;
}

// ---- matrix helpers (column-major, glTF order) ------------------------------

const ident = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

function fromTRS(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const x2 = qx + qx,
    y2 = qy + qy,
    z2 = qz + qz;
  const xx = qx * x2,
    xy = qx * y2,
    xz = qx * z2;
  const yy = qy * y2,
    yz = qy * z2,
    zz = qz * z2;
  const wx = qw * x2,
    wy = qw * y2,
    wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

const applyPos = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];
// Kenney models are uniformly scaled with no shear, so the rotation block
// doubles as the normal matrix once renormalised.
const applyNrm = (m, x, y, z) => {
  const v = [
    m[0] * x + m[4] * y + m[8] * z,
    m[1] * x + m[5] * y + m[9] * z,
    m[2] * x + m[6] * y + m[10] * z,
  ];
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

// ---- material role mapping -------------------------------------------------
//
// Kenney's material names are semantic, which is what makes this work at all:
// each one maps onto a surface the game already paints procedurally.

// The graveyard kit is the exception: every piece wears one material called
// 'colormap' pointing at a shared swatch atlas. There is nothing to split, but
// those pieces are all masonry, so the family fallback is exactly right.
const ROLE = {
  woodBark: "bark",
  wood: "bark",
  woodInner: "sawn",
  woodDark: "bark",
  leafsGreen: "leaf",
  leafs: "leaf",
  leafsDark: "leaf",
  leafsFall: "leaf",
  grass: "leaf",
  stone: "stone",
  stoneDark: "stone",
  stoneLight: "stone",
  rock: "stone",
  dirt: "dirt",
  sand: "dirt",
  // Quaternius' modular ruins kit names its masonry Main/Main2/Highlights and
  // keeps the greenery growing over it on its own materials, so an overgrown
  // wall still splits cleanly into stone and leaf.
  Main: "stone",
  Main2: "stone",
  Highlights: "stone",
  Grey: "stone",
  Green: "leaf",
  Leaf_Texture: "leaf",
  Texture_Leaves: "leaf",
  Bark: "bark",
  DarkWood: "bark",
  // Everything below points at a swatch atlas we are not using; the family
  // fallback is right for all of them.
  _defaultMat: null,
  default: null,
  colormap: null,
  Atlas: null,
  tiny_treats_1: null,
  HalloweenBits: null,
};

// ---- extraction ------------------------------------------------------------

/**
 * All triangles of one model, in world space, grouped by surface role.
 * `only` names a single node to pull out — a modular kit ships as one file
 * with ninety-odd pieces in it, and we want six of them.
 */
function extract(file, fallbackRole, only) {
  const { g, bin } = readGLB(file);
  const byRole = new Map();
  const scene = g.scenes[g.scene || 0];
  const walk = (idx, parent) => {
    const n = g.nodes[idx];
    const m = mul(parent, fromTRS(n));
    if (n.mesh !== undefined) {
      for (const pr of g.meshes[n.mesh].primitives) {
        if (pr.mode !== undefined && pr.mode !== 4) continue; // triangles only
        const name =
          pr.material !== undefined ? g.materials[pr.material].name : "default";
        const role =
          (ROLE[name] === undefined ? fallbackRole : ROLE[name]) ||
          fallbackRole;
        if (!role) continue;
        const P = accessor(g, bin, pr.attributes.POSITION);
        const N =
          pr.attributes.NORMAL !== undefined
            ? accessor(g, bin, pr.attributes.NORMAL)
            : null;
        const I =
          pr.indices !== undefined ? accessor(g, bin, pr.indices) : null;
        const count = I ? I.length : P.length / 3;
        let bucket = byRole.get(role);
        if (!bucket) byRole.set(role, (bucket = { pos: [], nrm: [] }));
        for (let k = 0; k < count; k++) {
          const v = I ? I[k] : k;
          bucket.pos.push(...applyPos(m, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
          bucket.nrm.push(
            ...(N
              ? applyNrm(m, N[v * 3], N[v * 3 + 1], N[v * 3 + 2])
              : [0, 1, 0]),
          );
        }
      }
    }
    for (const c of n.children || []) walk(c, m);
  };
  if (only) {
    const i = g.nodes.findIndex((n) => n.name === only);
    if (i < 0) throw new Error(`${file}: no node named ${only}`);
    walk(i, ident());
  } else for (const r of scene.nodes) walk(r, ident());
  return byRole;
}

/**
 * Sit the model on the floor and centre it on its own footprint, so a placed
 * prop's position means "where its base touches the ground" for every model
 * alike — the authors' origins are all over the place.
 */
function normalise(byRole) {
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const b of byRole.values())
    for (let i = 0; i < b.pos.length; i += 3)
      for (let c = 0; c < 3; c++) {
        if (b.pos[i + c] < lo[c]) lo[c] = b.pos[i + c];
        if (b.pos[i + c] > hi[c]) hi[c] = b.pos[i + c];
      }
  const off = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  for (const b of byRole.values())
    for (let i = 0; i < b.pos.length; i += 3)
      for (let c = 0; c < 3; c++) b.pos[i + c] -= off[c];
  return {
    height: hi[1] - lo[1],
    radius: Math.max(hi[0] - lo[0], hi[2] - lo[2]) / 2,
    lo: [lo[0] - off[0], 0, lo[2] - off[2]],
    hi: [hi[0] - off[0], hi[1] - lo[1], hi[2] - off[2]],
  };
}

// ---- quantised encoding ----------------------------------------------------

function encode(byRole, box) {
  // one shared quantisation box per model, so roles stay registered to each other
  const span = [
    box.hi[0] - box.lo[0],
    box.hi[1] - box.lo[1],
    box.hi[2] - box.lo[2],
  ].map((v) => v || 1e-4);
  const roles = [];
  for (const [role, b] of byRole) {
    const n = b.pos.length / 3;
    const pos = Buffer.alloc(n * 6);
    const nrm = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) {
        const t = (b.pos[i * 3 + c] - box.lo[c]) / span[c];
        pos.writeUInt16LE(
          Math.max(0, Math.min(65535, Math.round(t * 65535))),
          (i * 3 + c) * 2,
        );
        nrm.writeInt8(
          Math.max(-127, Math.min(127, Math.round(b.nrm[i * 3 + c] * 127))),
          i * 3 + c,
        );
      }
    }
    roles.push({
      role,
      tris: n / 3,
      pos: pos.toString("base64"),
      nrm: nrm.toString("base64"),
    });
  }
  return roles;
}

// ---- the roster ------------------------------------------------------------
//
// Six families, matching how the scenery reads in play rather than how the
// kits are organised. Every entry is [file, display name].

const ROSTER = {
  tree: {
    fallback: "leaf",
    items: [
      // (the 'short' palm is the tall one squashed — the height field gives
      // that for free, so it is not worth a second copy of the mesh)
      ["tree_palmDetailedTall", "feather palm"],
      ["tree_palmBend", "bent palm"],
      ["tree_palmTall", "coconut palm"],
      ["tree_detailed", "broad canopy"],
      ["tree_fat", "fat canopy"],
      ["tree_plateau", "flat-top canopy"],
      ["tree_thin", "slender tree"],
      ["tree_tall", "tall canopy"],
      ["tree_oak", "spreading fig"],
    ],
  },
  plants: {
    fallback: "leaf",
    items: [
      ["plant_bushDetailed", "leafy bush"],
      ["plant_bushLargeTriangle", "big frond bush"],
      ["plant_bushSmall", "small bush"],
      ["plant_bushLarge", "large bush"],
      ["plant_flatTall", "tall fan plant"],
      ["plant_flatShort", "low fan plant"],
      ["grass_leafsLarge", "big leaf clump"],
      ["grass_large", "tall grass"],
      ["crops_bambooStageA", "bamboo"],
      ["hanging_moss", "hanging moss"],
      // The one tropical shape Kenney's temperate kit has no answer for.
      // Authored six units tall, so it needs bringing down to Kenney's scale.
      ["bigleaf", "elephant ear", 0.09], // reyshapes, CC0
    ],
  },
  boulder: {
    fallback: "stone",
    items: [
      ["rock_largeA", "round boulder"],
      ["rock_largeC", "split boulder"],
      ["rock_largeE", "wide boulder"],
      ["rock_tallC", "standing stone"],
      ["rock_tallH", "leaning stone"],
      ["rock_tallJ", "spire stone"],
      ["stone_largeB", "grey boulder"],
      ["stone_tallD", "grey monolith"],
    ],
  },
  rocks: {
    fallback: "stone",
    items: [
      ["rock_smallA", "loose rock"],
      ["rock_smallD", "chipped rock"],
      ["rock_smallG", "round pebble"],
      ["rock_smallFlatB", "flat slabbed rock"],
      ["rock_smallTopA", "capped rock"],
      ["rock_smallTopB", "mossy stub"],
      ["stone_smallC", "grey rubble"],
      ["stone_smallFlatA", "flagstone chip"],
    ],
  },
  trunk: {
    fallback: "bark",
    items: [
      ["log", "fallen log"],
      ["log_large", "big fallen trunk"],
      ["log_stack", "stacked logs"],
      ["stump_old", "old stump"],
      ["stump_oldTall", "tall broken stump"],
      ["stump_roundDetailed", "cut stump"],
      ["stump_squareDetailedWide", "wide cut stump"],
      ["trunk-long", "long dead trunk"],
    ],
  },
  slab: {
    fallback: "stone",
    items: [
      ["statue_block", "carved block"],
      ["statue_column", "temple column"],
      ["statue_columnDamaged", "broken column"],
      ["statue_obelisk", "stele"],
      ["statue_ring", "ring stone"],
      ["statue_head", "idol head"],
      ["path_stoneCircle", "flagstone disc"],
      ["platform_stone", "stone plinth"],
      // the graveyard kit's masonry reads as temple ruin far better than
      // anything in the nature kit — cut, weathered, and broken on purpose
      ["pillar-square", "square pillar"],
      ["pillar-obelisk", "obelisk"],
      ["altar-stone", "carved altar"],
      ["stone-wall-damaged", "broken wall"],
      ["debris", "rubble pile"],
      // Quaternius' modular ruins kit (CC0): masonry that is broken on
      // purpose, which is a note nothing else here hits. Pulled piece by piece
      // out of one 95-node file, and built on a four-unit grid, so every one
      // needs scaling down into Kenney's register. Four pieces only — the rest
      // of the kit is either redundant with the statues above or too heavy to
      // scatter (an overgrown wall is fourteen hundred triangles on its own).
      ["ruins#Wall_Broken", "collapsed wall", 0.4],
      ["ruins#Column_Round_Short", "stub column", 0.4],
      ["ruins#Bricks", "loose bricks", 0.4],
      ["ruins#Floor_Diamond", "inlaid floor", 0.45],
      ["cobble", "cobbled path", 0.45], // Kay Lousberg, CC0
    ],
  },
};

// ---- main ------------------------------------------------------------------

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error("usage: node tools/bake-props.mjs <dir-with-glbs>...");
  process.exit(1);
}
const found = new Map();
for (const d of dirs)
  for (const f of fs.readdirSync(d))
    if (f.endsWith(".glb") && !found.has(f)) found.set(f, path.join(d, f));

const out = {};
const report = [];
let bytes = 0;
for (const [family, spec] of Object.entries(ROSTER)) {
  out[family] = [];
  for (const [file, label, k] of spec.items) {
    // "kit#Piece" pulls one node out of a modular kit file
    const [stem, node] = file.split("#");
    const p = found.get(`${stem}.glb`);
    if (!p) {
      report.push(`  MISSING  ${family}/${file}`);
      continue;
    }
    const byRole = extract(p, spec.fallback, node);
    if (!byRole.size) {
      report.push(`  EMPTY    ${family}/${file}`);
      continue;
    }
    // Different authors work at different scales. Bring the outliers into the
    // family's register HERE rather than at runtime, so the recorded height
    // and footprint are the truth about the prop as it will stand.
    if (k && k !== 1)
      for (const b of byRole.values())
        for (let i = 0; i < b.pos.length; i++) b.pos[i] *= k;
    const box = normalise(byRole);
    const roles = encode(byRole, box);
    const size = roles.reduce((n, r) => n + r.pos.length + r.nrm.length, 0);
    bytes += size;
    out[family].push({
      id: file,
      label,
      h: +box.height.toFixed(4),
      r: +box.radius.toFixed(4),
      lo: box.lo.map((v) => +v.toFixed(4)),
      hi: box.hi.map((v) => +v.toFixed(4)),
      roles,
    });
    report.push(
      `  ${family.padEnd(8)} ${file.padEnd(26)} ${String(roles.reduce((n, r) => n + r.tris, 0)).padStart(4)}tri` +
        `  h=${box.height.toFixed(2)} r=${box.radius.toFixed(2)}  ` +
        roles.map((r) => `${r.role}:${r.tris}`).join(" ") +
        `  ${(size / 1024).toFixed(1)}KB`,
    );
  }
}
console.error(report.join("\n"));
console.error(
  `\nTOTAL ${(bytes / 1024).toFixed(0)}KB of base64 across ` +
    `${Object.values(out).flat().length} props`,
);

const stamp = new Date().toISOString().slice(0, 10);
process.stdout
  .write(`// GENERATED by tools/bake-props.mjs on ${stamp} — do not edit by hand.
//
// Scenery meshes from Kenney's Nature Kit 2.1 and Graveyard Kit 5.0
// (kenney.nl), released under CC0 1.0 Universal. Quantised: positions are
// 16-bit across each model's own bounding box, normals 8-bit, triangles
// non-indexed. UVs are generated at decode time by box projection.

/** One surface of a prop: which game material it wears, and its triangles. */
export interface PropRole {
  role: "bark" | "sawn" | "leaf" | "stone" | "dirt";
  tris: number;
  pos: string; // base64 uint16 x3, normalised across [lo, hi]
  nrm: string; // base64 int8 x3
}

/** One model: sitting on y=0, centred on its own footprint. */
export interface PropModel {
  id: string;
  label: string;
  h: number; // natural height, world units
  r: number; // natural footprint radius
  lo: [number, number, number];
  hi: [number, number, number];
  roles: PropRole[];
}

// prettier-ignore
export const PROP_MODELS: Record<string, PropModel[]> = {
${Object.entries(out)
  .map(
    ([fam, models]) =>
      `"${fam}": [\n` +
      models.map((m) => "  " + JSON.stringify(m)).join(",\n") +
      `\n],`,
  )
  .join("\n")}
} as unknown as Record<string, PropModel[]>;
`);
