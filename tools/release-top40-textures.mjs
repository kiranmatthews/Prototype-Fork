// Apply the user's pinned top-40 texture budget after the earlier reviewed
// texture batch and before sharing/geometry packing. No runtime image codecs.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {read as readKtx} from 'three/examples/jsm/libs/ktx-parse.module.js';
import {parseNativeGlb} from './release-native-geometry.mjs';
import {inspectWebp,textureDigest as hash} from './release-textures.mjs';

const safeFile=file=>typeof file==='string'&&file.split('/').every(part=>/^[a-zA-Z0-9_.-]+$/.test(part)&&part!=='.'&&part!=='..');
async function regular(root,file){
 assert.ok(safeFile(file),'Invalid image/model path');
 const target=path.join(root,file),stat=await lstat(target);
 assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&(await realpath(target)).startsWith(root+path.sep),'Expected contained regular file');
 return readFile(target);
}

/** Replace embedded image ranges only, retaining every other physical byte.
 * Relocate both ordinary views and meshopt's compressed source offsets. Its
 * virtual decoded/fallback buffer offsets must never be moved. */
export function replaceEmbeddedImages(original,replacements){
 const source=parseNativeGlb(original),doc=structuredClone(source.doc);
 assert.ok(doc.buffers[0]&&!doc.buffers[0].uri);
 assert.ok(source.binary.length>=doc.buffers[0].byteLength&&source.binary.length-doc.buffers[0].byteLength<=3);
 const byView=new Map(),webp=new Set();
 const referenced=new Set(doc.textures.flatMap(texture=>[texture.source,...Object.values(texture.extensions??{}).map(ext=>ext.source)]));
 for(const [index,replacement] of replacements){
  const image=doc.images[index];assert.ok(image&&referenced.has(index)&&image.uri===undefined&&Number.isInteger(image.bufferView),'Expected referenced embedded image');
  const view=doc.bufferViews[image.bufferView];assert.equal(view.buffer,0);assert.ok(!view.extensions?.EXT_meshopt_compression);
  assert.ok(['image/webp','image/ktx2'].includes(replacement.mimeType));
  assert.equal(image.mimeType==='image/ktx2',replacement.mimeType==='image/ktx2','Preserve GPU and portable texture alternatives');
  if(replacement.mimeType==='image/ktx2')readKtx(replacement.bytes);else{inspectWebp(replacement.bytes);webp.add(index);}
  const previous=byView.get(image.bufferView);
  if(previous)assert.ok(previous.bytes.equals(replacement.bytes),'Conflicting shared image view');
  byView.set(image.bufferView,{...replacement,start:view.byteOffset??0,end:(view.byteOffset??0)+view.byteLength});
  image.mimeType=replacement.mimeType;
 }
 for(const [view] of byView){
  assert.ok(!doc.images.some((image,index)=>image.bufferView===view&&!replacements.has(index)),'Partially replaced shared image view');
  const references=value=>{
   if(!value||typeof value!=='object')return;
   for(const [key,child] of Object.entries(value)){assert.ok(!(key==='bufferView'&&child===view),'Image shared with non-image data');references(child);}
  };
  const {images,...nonImages}=doc;references(nonImages);
 }
 const ranges=[...byView.values()].sort((a,b)=>a.start-b.start),chunks=[];
 let cursor=0,delta=0;
 for(const range of ranges){
  assert.ok(range.start>=cursor&&range.end<=doc.buffers[0].byteLength,'Overlapping or out-of-bounds image range');
  chunks.push(source.binary.subarray(cursor,range.start),range.bytes);
  const padding=(range.end-range.start-range.bytes.length)&3;
  chunks.push(Buffer.alloc(padding));
  range.delta=range.bytes.length+padding-(range.end-range.start);delta+=range.delta;cursor=range.end;
 }
 chunks.push(source.binary.subarray(cursor,doc.buffers[0].byteLength));
 const relocate=offset=>{
  let shift=0;
  for(const range of ranges){
   assert.ok(offset<=range.start||offset>=range.end,'Non-image offset inside image payload');
   if(offset>=range.end)shift+=range.delta;
  }
  return offset+shift;
 };
 const outsideImages=(offset,length)=>assert.ok(ranges.every(r=>offset+length<=r.start||offset>=r.end),'Non-image payload overlaps image');
 for(const [index,view] of doc.bufferViews.entries()){
  if(view.buffer===0){
   const replacement=byView.get(index),offset=view.byteOffset??0;
   if(!replacement)outsideImages(offset,view.byteLength);
   view.byteOffset=relocate(offset);
   if(replacement)view.byteLength=replacement.bytes.length;
  }
  const compressed=view.extensions?.EXT_meshopt_compression;
  if(compressed?.buffer===0){outsideImages(compressed.byteOffset,compressed.byteLength);compressed.byteOffset=relocate(compressed.byteOffset);}
 }
 for(const texture of doc.textures){
  if(webp.has(texture.source)){
   texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};
   delete texture.source;
  }
 }
 if(webp.size)for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=[...new Set([...(doc[key]??[]),'EXT_texture_webp'])];
 doc.buffers[0].byteLength+=delta;
 const binary=Buffer.concat(chunks);assert.equal(binary.length,doc.buffers[0].byteLength);
 const json=Buffer.from(JSON.stringify(doc)),paddedJson=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]),paddedBin=Buffer.concat([binary,Buffer.alloc((-binary.length)&3)]);
 const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+paddedJson.length+paddedBin.length,8);header.writeUInt32LE(paddedJson.length,12);header.writeUInt32LE(0x4e4f534a,16);
 binHeader.writeUInt32LE(paddedBin.length);binHeader.writeUInt32LE(0x004e4942,4);
 const output=Buffer.concat([header,paddedJson,binHeader,paddedBin]);
 // Check actual bytes at their relocated positions, including compressed
 // vertex/index buffers. Geometry is neither decoded nor re-encoded here.
 const after=parseNativeGlb(output);
 for(const [index,view] of source.doc.bufferViews.entries()){
  const next=after.doc.bufferViews[index];
  if(view.buffer===0&&!byView.has(index))assert.ok(source.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength).equals(after.binary.subarray(next.byteOffset??0,(next.byteOffset??0)+next.byteLength)),'Non-image view changed');
  const compressed=view.extensions?.EXT_meshopt_compression,nextCompressed=next.extensions?.EXT_meshopt_compression;
  if(compressed?.buffer===0)assert.ok(source.binary.subarray(compressed.byteOffset,compressed.byteOffset+compressed.byteLength).equals(after.binary.subarray(nextCompressed.byteOffset,nextCompressed.byteOffset+nextCompressed.byteLength)),'Compressed geometry changed');
 }
 return output;
}

export async function prepareTop40Textures({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir),review=await realpath(path.join(root,'release-textures/top40'));
 assert.ok(source!==output&&!output.startsWith(source+path.sep)&&!source.startsWith(output+path.sep),'Output overlaps authoring models');
 const manifest=JSON.parse(await regular(review,'manifest.json')),selection=JSON.parse(await readFile(path.join(root,'tools/top40-glb-textures.json')));
 assert.equal(manifest.v,1);assert.equal(manifest.catalogueCommit,selection.catalogueCommit);assert.deepEqual(manifest.limits,selection.limits);
 assert.deepEqual(manifest.models.map(m=>m.file),selection.models.map(m=>m.file),'Pinned model selection changed');
 const models=[];
 for(const model of manifest.models){
  const original=await regular(source,model.file);assert.equal(hash(original),model.sourceSha256,'Authoring model changed: '+model.file);
  const before=await regular(output,model.file),glb=parseNativeGlb(before),replacements=new Map();
  assert.equal(model.images.length,glb.doc.images.length,'Every embedded image must satisfy the new limits');
  for(const image of model.images){
   assert.ok(!replacements.has(image.index),'Repeated image index');
   const bytes=await regular(review,image.file);assert.equal(hash(bytes),image.sha256);assert.equal(bytes.length,image.bytes);
   const limit=['baseColorTexture','emissiveTexture'].includes(image.role)?manifest.limits.colour:manifest.limits.other;
   assert.ok(image.width<=limit&&image.height<=limit);
   if(image.mimeType==='image/webp')assert.deepEqual(inspectWebp(bytes),{width:image.width,height:image.height,lossless:true});
   else{const ktx=readKtx(bytes);assert.equal(ktx.pixelWidth,image.width);assert.equal(ktx.pixelHeight,image.height);assert.equal(ktx.levels.length,image.mipLevels);}
   replacements.set(image.index,{bytes,mimeType:image.mimeType});
  }
  const packed=replaceEmbeddedImages(before,replacements);assert.ok(packed.length<original.length,'Optimized model must be smaller');
  await writeFile(path.join(output,model.file),packed);
  models.push({file:model.file,sourceBytes:before.length,bytes:packed.length,sha256:hash(packed),images:replacements.size});
 }
 const evidence=Buffer.from(JSON.stringify({v:1,catalogueCommit:manifest.catalogueCommit,limits:manifest.limits,resampling:manifest.resampling,optimizer:manifest.optimizer,models})+'\n');
 await writeFile(path.join(output,'provenance/top40-textures.json'),evidence);
 return{models:models.length,images:models.reduce((n,m)=>n+m.images,0),savedBytes:models.reduce((n,m)=>n+m.sourceBytes-m.bytes,0)-evidence.length};
}
