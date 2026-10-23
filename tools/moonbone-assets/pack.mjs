/** Preserve Meshy geometry/UVs; only encode portable atlases for the browser. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = createRequire('/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
}
const names = ['moonbone-skull', 'moonbone-rib-arch', 'moonbone-crypt'];
const ledger = JSON.parse(await readFile(new URL('./tasks.json', import.meta.url), 'utf8'));
const output = new URL('../../public/moonbone-vault/', import.meta.url);
await mkdir(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const assets = [];
for (const name of names) {
  const source = new URL(`../../.img2threejs/moonbone/${name}.glb`, import.meta.url);
  const raw = await readFile(source), length = raw.readUInt32LE(12);
  const doc = JSON.parse(raw.subarray(20, 20 + length)), bin = raw.subarray(28 + length);
  if (doc.materials.length !== 1) throw new Error(`${name}: shared scenery needs one atlas material`);
  const replacements = new Map(), images = [];
  for (const [i, img] of doc.images.entries()) {
    const view = doc.bufferViews[img.bufferView];
    const data = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const albedo = doc.materials.some(m => doc.textures[m.pbrMetallicRoughness?.baseColorTexture?.index]?.source === i);
    const size = albedo ? 2048 : 1024;
    const packed = await sharp(data).resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: albedo ? 94 : 90, chromaSubsampling: '4:4:4' }).toBuffer();
    replacements.set(img.bufferView, packed); img.mimeType = 'image/jpeg';
    const metadata = await sharp(packed).metadata();
    images.push({ index: i, width: metadata.width, height: metadata.height, bytes: packed.length });
  }
  const parts = []; let offset = 0;
  for (const [i, view] of doc.bufferViews.entries()) {
    const pad = (4 - offset % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
    const bytes = replacements.get(i) ?? bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    view.byteOffset = offset; view.byteLength = bytes.length; parts.push(bytes); offset += bytes.length;
  }
  const pad = (4 - offset % 4) % 4; if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
  doc.buffers = [{ byteLength: offset }]; delete doc.extras;
  for (const material of doc.materials) { delete material.extras; material.doubleSided = false; }
  let json = Buffer.from(JSON.stringify(doc)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + offset, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const binaryHeader = Buffer.alloc(8); binaryHeader.writeUInt32LE(offset, 0); binaryHeader.writeUInt32LE(0x004e4942, 4);
  const packed = Buffer.concat([header, json, binaryHeader, ...parts]);
  await writeFile(new URL(`${name}.glb`, output), packed);
  const task = ledger.tasks[name];
  const triangles = doc.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, p) =>
    n + doc.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0), 0);
  assets.push({ name, provider: 'Meshy', taskId: task.id, credits: task.consumedCredits,
    reference: task.reference, referenceSha256: task.referenceSha256,
    sourceSha256: hash(raw), sha256: hash(packed), bytes: packed.length, triangles, images,
    geometry: 'Original generated geometry, normals and UVs preserved; JPEG atlas encoding only.' });
}
const spentCredits = assets.reduce((sum, asset) => sum + asset.credits, 0);
if (!Number.isFinite(spentCredits) || spentCredits > 50) throw new Error('Credit ledger must confirm the user cap');
await writeFile(new URL('manifest.json', output), JSON.stringify({
  budgetCredits: 50, spentCredits, artDirection: 'Crash 4 / 90s skate-punk nighttime ossuary', assets,
}, null, 2) + '\n');
console.log(JSON.stringify({ spentCredits, assets: assets.map(({ name, bytes, triangles }) => ({ name, bytes, triangles })) }));
