import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const names=['body-v2','host','balcony-deck','canopy','stairs','landing','tree','bush'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const name of names){
 const raw=await readFile(new URL(`../public/treehouse-trail/${name}.glb`,import.meta.url));
 const size=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+size)),bin=raw.subarray(28+size);
 const manifest=JSON.parse(await readFile(new URL(`../public/treehouse-trail/${name}-manifest.json`,import.meta.url),'utf8'));
 assert.equal(raw.readUInt32LE(8),raw.length);assert.equal(hash(raw),manifest.sha256);assert.equal(raw.length,manifest.bytes);
 assert.ok(doc.extensionsUsed.includes('KHR_texture_basisu'));assert.ok(!doc.extensionsRequired?.includes('KHR_texture_basisu'),'JPEG fallback is available');
 const imageBytes=image=>{const view=doc.bufferViews[image.bufferView];return bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);};
 for(const [i,texture] of doc.textures.entries()){
  const textureReport=manifest.gpuTextures.textures[i],fallback=imageBytes(doc.images[texture.source]),compressed=imageBytes(doc.images[texture.extensions.KHR_texture_basisu.source]);
  assert.equal(hash(fallback),textureReport.fallbackSha256);assert.equal(hash(compressed),textureReport.ktxSha256);
  assert.equal(compressed.readUInt32LE(20),i===0?2048:1024);assert.equal(compressed.readUInt32LE(24),i===0?2048:1024);
  assert.equal(compressed.readUInt32LE(40),i===0?12:11,'complete mip chain');
  assert.ok(textureReport.astc4x4Bytes<textureReport.width*textureReport.height*4*.34,'GPU storage substantially smaller without resizing');
 }
 assert.ok(manifest.triangles<=15000);
}
console.log('PASS eight full-resolution GPU texture pairs: complete mips, original fallback hashes, budget, manifest hashes and polygon limits.');
