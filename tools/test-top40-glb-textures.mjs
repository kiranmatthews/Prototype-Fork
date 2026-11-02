import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseNativeGlb} from './release-native-geometry.mjs';
import {replaceEmbeddedImages} from './release-top40-textures.mjs';
import {textureDigest as hash,inspectWebp} from './release-textures.mjs';
import {read as readKtx} from 'three/examples/jsm/libs/ktx-parse.module.js';

const manifest=JSON.parse(await readFile('release-textures/top40/manifest.json'));
const selection=JSON.parse(await readFile('tools/top40-glb-textures.json'));
assert.equal(manifest.models.length,30);assert.deepEqual(manifest.models.map(m=>m.file),selection.models.map(m=>m.file));
let imageCount=0,compressedModels=0;
for(const model of manifest.models){
 const original=await readFile('public/'+model.file),before=parseNativeGlb(original),images=new Map();
 assert.equal(hash(original),model.sourceSha256);
 for(const image of model.images){
  const bytes=await readFile('release-textures/top40/'+image.file);assert.equal(hash(bytes),image.sha256);
  const limit=['baseColorTexture','emissiveTexture'].includes(image.role)?1024:256;
  assert.ok(image.width<=limit&&image.height<=limit);
  if(image.mimeType==='image/webp')assert.deepEqual(inspectWebp(bytes),{width:image.width,height:image.height,lossless:true});
  else{const ktx=readKtx(bytes);assert.equal(ktx.pixelWidth,image.width);assert.equal(ktx.pixelHeight,image.height);assert.equal(ktx.levels.length,Math.floor(Math.log2(Math.max(image.width,image.height)))+1);}
  images.set(image.index,{bytes,mimeType:image.mimeType});imageCount++;
 }
 const output=replaceEmbeddedImages(original,images),after=parseNativeGlb(output);
 assert.ok(output.length<original.length);assert.ok(replaceEmbeddedImages(output,images).equals(output),'Idempotent replacement');
 // JSON serialization canonically spells signed zero as zero; binary vertex
 // data below still has to match byte for byte.
 for(const field of ['accessors','meshes','materials','samplers','nodes','scenes','scene','skins','animations','cameras'])assert.equal(JSON.stringify(after.doc[field]),JSON.stringify(before.doc[field]),model.file+' '+field);
 const imageViews=new Set(before.doc.images.map(image=>image.bufferView));
 for(const [index,view] of before.doc.bufferViews.entries()){
  const next=after.doc.bufferViews[index];
  if(!imageViews.has(index)){
   const expected=structuredClone(view),actual=structuredClone(next);
   if(view.buffer===0){
    assert.ok(before.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength).equals(after.binary.subarray(next.byteOffset??0,(next.byteOffset??0)+next.byteLength)));
    delete expected.byteOffset;delete actual.byteOffset;
   }
   if(view.extensions?.EXT_meshopt_compression){
    const ext=view.extensions.EXT_meshopt_compression,n=next.extensions.EXT_meshopt_compression;
    assert.ok(before.binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength).equals(after.binary.subarray(n.byteOffset,n.byteOffset+n.byteLength)));
    delete expected.extensions.EXT_meshopt_compression.byteOffset;delete actual.extensions.EXT_meshopt_compression.byteOffset;
   }
   assert.deepEqual(actual,expected,'Only physical offsets may change; virtual offsets and layouts must remain exact');
  }
 }
 if(before.doc.buffers.length>1){compressedModels++;assert.deepEqual(after.doc.buffers.slice(1),before.doc.buffers.slice(1));}
 for(const [index,image] of before.doc.images.entries()){
  const actual={...after.doc.images[index],mimeType:image.mimeType};assert.deepEqual(actual,image,'Image metadata/index retained');
 }
}
assert.equal(compressedModels,2,'Exercise existing compressed rooftop models');
console.log(`PASS ${manifest.models.length} models / ${imageCount} embedded images: limits, complete mip chains, all geometry/UV/skin/animation bytes retained, compressed offsets and idempotency`);
