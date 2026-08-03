// Repack the Meshy apple into something a HUD icon can afford.
//
//   node tools/bake-wumpa.mjs <source.glb>
//     -> public/models/wumpa.glb
//
// The source is 5.6 MB, and essentially none of it is the apple: the mesh is
// 360 verts / 328 triangles, and the other 5.4 MB is four 2048x2048 JPEGs.
// This thing is drawn at ~70px in the HUD and a couple of dozen px as a world
// pickup, so:
//
//  * BASE COLOUR ONLY, at 256px. The atlas is big flat fields of red/orange/
//    green with a fine speckle — low-frequency art that survives an 8x
//    downscale intact. 2048 was resolving detail no screen will ever ask for.
//  * DROP the normal and metallic-roughness maps (2048px each, 3.2 MB
//    together). The game lights everything with MeshLambertMaterial, which
//    reads neither, and at this size a normal map is invisible regardless.
//  * DROP the emissive map. It is 2048x2048 of pure black — it contributes
//    nothing but bytes and an extra sampler.
//  * DROP the TANGENT attribute. Tangents exist to orient a normal map;
//    with no normal map they are 5.7 KB of dead vertex data.
//
// And one geometry fix, because the model is going to SPIN:
//
//  * RECENTRE ON THE SPIN AXIS. A Y-axis idle rotation only looks like a
//    rotation if the X/Z centre of the art sits on the axis; a few
//    hundredths off and the apple orbits instead of turning. Bake the offset
//    into the positions here so every consumer — world pickup, burst fruit,
//    HUD icon — gets it right without knowing to ask. Y is centred too, so
//    the model's own middle is the origin and callers place it by its centre.
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const SRC = process.argv[2];
const OUT = 'public/models/wumpa.glb';
const TEX = 256; // base colour edge, px
const QUALITY = 0.84;

if (!SRC) {
  console.error('usage: node tools/bake-wumpa.mjs <source.glb>');
  process.exit(1);
}

// ---- read the source container ------------------------------------------
const src = readFileSync(SRC);
if (src.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
const jsonLen = src.readUInt32LE(12);
const gltf = JSON.parse(src.subarray(20, 20 + jsonLen).toString('utf8'));
const binStart = 20 + jsonLen + 8;
const view = (i) => {
  const bv = gltf.bufferViews[i];
  const off = binStart + (bv.byteOffset || 0);
  return src.subarray(off, off + bv.byteLength);
};
const accessorBytes = (i) => {
  const a = gltf.accessors[i];
  return view(a.bufferView).subarray(a.byteOffset || 0);
};

const prim = gltf.meshes[0].primitives[0];
const posAcc = gltf.accessors[prim.attributes.POSITION];
const nrmAcc = gltf.accessors[prim.attributes.NORMAL];
const uvAcc = gltf.accessors[prim.attributes.TEXCOORD_0];
const idxAcc = gltf.accessors[prim.indices];
const count = posAcc.count;

const pos = new Float32Array(
  accessorBytes(prim.attributes.POSITION).buffer,
  accessorBytes(prim.attributes.POSITION).byteOffset,
  count * 3,
).slice();
const nrm = new Float32Array(
  accessorBytes(prim.attributes.NORMAL).buffer,
  accessorBytes(prim.attributes.NORMAL).byteOffset,
  count * 3,
).slice();
const uv = new Float32Array(
  accessorBytes(prim.attributes.TEXCOORD_0).buffer,
  accessorBytes(prim.attributes.TEXCOORD_0).byteOffset,
  count * 2,
).slice();
const idxSrc = accessorBytes(prim.indices);
// keep indices as-is if they already fit in 16 bits — 360 verts always will
const indices = new Uint16Array(idxAcc.count);
if (idxAcc.componentType === 5125) {
  const u32 = new Uint32Array(idxSrc.buffer, idxSrc.byteOffset, idxAcc.count);
  for (let i = 0; i < idxAcc.count; i++) indices[i] = u32[i];
} else {
  const u16 = new Uint16Array(idxSrc.buffer, idxSrc.byteOffset, idxAcc.count);
  indices.set(u16);
}

// ---- recentre on the spin axis ------------------------------------------
const lo = [Infinity, Infinity, Infinity];
const hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < count; i++)
  for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], pos[i * 3 + k]);
    hi[k] = Math.max(hi[k], pos[i * 3 + k]);
  }
const centre = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2);
console.log(
  `  bounds  x[${lo[0].toFixed(4)}, ${hi[0].toFixed(4)}]  ` +
    `y[${lo[1].toFixed(4)}, ${hi[1].toFixed(4)}]  z[${lo[2].toFixed(4)}, ${hi[2].toFixed(4)}]`,
);
console.log(`  centre  ${centre.map((v) => v.toFixed(4)).join(', ')} -> shifted to origin`);
for (let i = 0; i < count; i++)
  for (let k = 0; k < 3; k++) pos[i * 3 + k] -= centre[k];

// re-derive the bounds glTF requires on the POSITION accessor
const min = [0, 1, 2].map((k) => lo[k] - centre[k]);
const max = [0, 1, 2].map((k) => hi[k] - centre[k]);
console.log(`  height  ${(max[1] - min[1]).toFixed(4)} (unit the loader normalises against)`);

// ---- downscale the base colour ------------------------------------------
const baseIdx = gltf.materials[0].pbrMetallicRoughness.baseColorTexture.index;
const baseImage = gltf.images[gltf.textures[baseIdx].source];
const baseJpeg = view(baseImage.bufferView);
console.log(`  base colour in  ${(baseJpeg.length / 1024).toFixed(0)} KB`);

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
});
const page = await browser.newPage();
const shrunk = await page.evaluate(
  async ({ b64, size, quality }) => {
    const blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, size, size);
    return c.toDataURL('image/jpeg', quality).split(',')[1];
  },
  { b64: baseJpeg.toString('base64'), size: TEX, quality: QUALITY },
);
await browser.close();
const tex = Buffer.from(shrunk, 'base64');
console.log(`  base colour out ${(tex.length / 1024).toFixed(0)} KB at ${TEX}x${TEX}`);

// ---- rebuild ------------------------------------------------------------
const pad4 = (n) => (n + 3) & ~3;
const chunks = [];
let offset = 0;
const push = (buf) => {
  const byteOffset = offset;
  chunks.push(buf);
  offset += buf.length;
  const pad = pad4(offset) - offset;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  return { byteOffset, byteLength: buf.length };
};
const bvPos = push(Buffer.from(pos.buffer, pos.byteOffset, pos.length * 4));
const bvNrm = push(Buffer.from(nrm.buffer, nrm.byteOffset, nrm.length * 4));
const bvUv = push(Buffer.from(uv.buffer, uv.byteOffset, uv.length * 4));
const bvIdx = push(Buffer.from(indices.buffer, indices.byteOffset, indices.length * 2));
const bvTex = push(tex);

const out = {
  asset: { version: '2.0', generator: 'bake-wumpa.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'wumpa' }],
  meshes: [
    {
      name: 'wumpa',
      primitives: [
        { attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 },
      ],
    },
  ],
  materials: [
    {
      name: 'wumpa',
      // doubleSided stays on: the source is doubleSided and a single-plane
      // leaf would vanish from one side without it.
      doubleSided: true,
      pbrMetallicRoughness: {
        baseColorTexture: { index: 0 },
        metallicFactor: 0,
        roughnessFactor: 1,
      },
    },
  ],
  textures: [{ source: 0, sampler: 0 }],
  images: [{ bufferView: 4, mimeType: 'image/jpeg', name: 'base_color' }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  accessors: [
    { bufferView: 0, componentType: 5126, count, type: 'VEC3', min, max },
    { bufferView: 1, componentType: 5126, count, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count, type: 'VEC2' },
    { bufferView: 3, componentType: 5123, count: indices.length, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, ...bvPos, target: 34962 },
    { buffer: 0, ...bvNrm, target: 34962 },
    { buffer: 0, ...bvUv, target: 34962 },
    { buffer: 0, ...bvIdx, target: 34963 },
    { buffer: 0, ...bvTex },
  ],
  buffers: [{ byteLength: offset }],
};

const bin = Buffer.concat(chunks);
let json = Buffer.from(JSON.stringify(out), 'utf8');
if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(json.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4); // 'BIN'

mkdirSync('public/models', { recursive: true });
const glb = Buffer.concat([header, jsonHead, json, binHead, bin]);
writeFileSync(OUT, glb);
console.log(
  `  ${SRC.split('/').pop()}  ${(src.length / 1024 / 1024).toFixed(2)} MB` +
    `  ->  ${OUT}  ${(glb.length / 1024).toFixed(0)} KB` +
    `  (${(100 - (glb.length / src.length) * 100).toFixed(1)}% smaller)`,
);
