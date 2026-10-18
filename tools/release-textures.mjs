import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {read as readKtx,write as writeKtx} from 'three/examples/jsm/libs/ktx-parse.module.js';

export const textureDigest=bytes=>createHash('sha256').update(bytes).digest('hex');
const integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min;
const webpExtension='EXT_texture_webp';
export function parseTextureGlb(bytes){
 if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB header');
 const length=bytes.readUInt32LE(12),end=20+length;
 if(length%4||end+8>bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a||bytes.readUInt32LE(end+4)!==0x004e4942||bytes.readUInt32LE(end)!==bytes.length-end-8)throw Error('Expected one JSON and one BIN chunk');
 const doc=JSON.parse(bytes.subarray(20,end).toString('utf8')),binary=bytes.subarray(end+8);
 if(doc.buffers?.length!==1||doc.buffers[0].uri||!integer(doc.buffers[0].byteLength)||doc.buffers[0].byteLength>binary.length||binary.length-doc.buffers[0].byteLength>3)throw Error('Expected one embedded buffer');
 if(!Array.isArray(doc.bufferViews)||!Array.isArray(doc.images)||!Array.isArray(doc.textures))throw Error('Missing model texture tables');
 for(const view of doc.bufferViews){
  if(view.buffer!==0||!integer(view.byteOffset??0)||!integer(view.byteLength,1)||(view.byteOffset??0)+view.byteLength>doc.buffers[0].byteLength)throw Error('Invalid buffer view');
  if(view.extensions?.EXT_meshopt_compression)throw Error('Review compressed buffer offsets before repacking');
 }
 return{doc,binary,view:index=>{const v=doc.bufferViews[index];if(!v)throw Error('Missing buffer view');return binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);}};
}

/** Read dimensions without adding an image codec or network dependency to CI. */
export function inspectWebp(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw Error('Invalid reviewed WebP');
 let width,height,pixels=false;
 const types=[];
 for(let at=12;at<bytes.length;){
  if(at+8>bytes.length)throw Error('Truncated WebP chunk');
  const type=bytes.toString('ascii',at,at+4),size=bytes.readUInt32LE(at+4),start=at+8,end=start+size;
  if(end>bytes.length)throw Error('Truncated WebP data');
  if(['ICCP','EXIF','ANIM','ANMF'].includes(type))throw Error('Unsupported WebP metadata/animation');
  types.push(type);
  if(type==='VP8X'){
   if(types.length!==1||size!==10||bytes[start]&0x2a)throw Error('Unsupported extended WebP');
   width=1+bytes.readUIntLE(start+4,3);height=1+bytes.readUIntLE(start+7,3);
  }else if(type==='VP8 '){
   if(pixels||size<10||bytes.readUIntLE(start+3,3)!==0x2a019d)throw Error('Invalid WebP frame');
   const w=bytes.readUInt16LE(start+6)&0x3fff,h=bytes.readUInt16LE(start+8)&0x3fff;
   if(width!==undefined&&(width!==w||height!==h))throw Error('WebP canvas/frame mismatch');
   width=w;height=h;pixels=true;
  }else if(type==='VP8L'){
   if(pixels||size<5||bytes[start]!==0x2f)throw Error('Invalid lossless WebP frame');
   const bits=bytes.readUInt32LE(start+1),w=1+(bits&0x3fff),h=1+((bits>>>14)&0x3fff);
   if(width!==undefined&&(width!==w||height!==h))throw Error('WebP canvas/frame mismatch');
   width=w;height=h;pixels=true;
  }
  at=end+(size%2);if(at>bytes.length)throw Error('Missing WebP padding');
 }
 if(!pixels||!integer(width,1)||!integer(height,1))throw Error('Missing WebP pixels');
 return{width,height,lossless:types.includes('VP8L')};
}

/** Retain the encoder's existing Lanczos-4 mip levels verbatim. UASTC/Zstd
 * levels are independently compressed, so no recompression is needed. */
export function trimKtxMipChain(bytes,maxSize){
 if(!integer(maxSize,1)||(maxSize&(maxSize-1)))throw Error('Expected power-of-two texture limit');
 const source=readKtx(bytes),w=source.pixelWidth,h=source.pixelHeight;
 if(source.supercompressionScheme!==2||source.dataFormatDescriptor[0]?.colorModel!==166||source.globalData||source.layerCount||source.pixelDepth||source.faceCount!==1||!integer(w,1)||!integer(h,1)||(w&(w-1))||(h&(h-1))||source.levels.length!==Math.log2(Math.max(w,h))+1)throw Error('Expected complete 2D UASTC/Zstd mip chain');
 const removedLevels=Math.max(0,Math.log2(Math.max(w,h)/maxSize));
 if(!removedLevels)return{data:bytes,width:w,height:h,levels:source.levels.length,removedLevels};
 const selected={...source,pixelWidth:Math.max(1,w>>removedLevels),pixelHeight:Math.max(1,h>>removedLevels),levels:source.levels.slice(removedLevels)};
 // The bundled KTX-Parse writer emits payloads in index order. KTX2
 // requires smallest-to-largest physical order; Zstd payloads need no padding.
 const written=Buffer.from(writeKtx(selected,{keepWriter:true}));
 const start=Math.min(...selected.levels.map((_,i)=>Number(written.readBigUInt64LE(80+i*24))));
 const prefix=Buffer.from(written.subarray(0,start)),parts=[prefix];let offset=start;
 for(let i=selected.levels.length-1;i>=0;i--){
  prefix.writeBigUInt64LE(BigInt(offset),80+i*24);
  parts.push(Buffer.from(selected.levels[i].levelData));offset+=selected.levels[i].levelData.length;
 }
 const data=Buffer.concat(parts),check=readKtx(data);
 assert.deepEqual(check.dataFormatDescriptor,source.dataFormatDescriptor);
 assert.deepEqual(check.keyValue,source.keyValue);
 assert.equal(check.pixelWidth,selected.pixelWidth);assert.equal(check.pixelHeight,selected.pixelHeight);
 for(let i=0;i<check.levels.length;i++){
  assert.deepEqual(check.levels[i].levelData,source.levels[i+removedLevels].levelData);
  assert.equal(check.levels[i].uncompressedByteLength,source.levels[i+removedLevels].uncompressedByteLength);
 }
 return{data,width:check.pixelWidth,height:check.pixelHeight,levels:check.levels.length,removedLevels};
}

/** Only image payloads change. View indices and all geometry/UV/skin/animation
 * bytes remain stable. Original authoring GLBs never enter a write path. */
export function repackTextureGlb(bytes,replacements){
 const source=parseTextureGlb(bytes),doc=structuredClone(source.doc),byView=new Map(),webpImages=new Set();
 const referenced=new Set(doc.textures.flatMap(t=>[t.source,t.extensions?.KHR_texture_basisu?.source].filter(i=>integer(i))));
 for(const [index,value]of replacements){
  const image=doc.images[index];
  if(!image||!referenced.has(index)||!['image/jpeg','image/png','image/ktx2'].includes(image.mimeType)||!integer(image.bufferView)||image.uri)throw Error('Expected a referenced embedded PNG/JPEG');
  const view=image.bufferView,existing=byView.get(view);
  if(image.mimeType==='image/ktx2')readKtx(value);else{inspectWebp(value);webpImages.add(index);}
  if(existing&&!existing.equals(value))throw Error('Conflicting shared image view');
  byView.set(view,value);if(webpImages.has(index))image.mimeType='image/webp';
 }
 for(const [view]of byView){
  if(doc.images.some((image,index)=>image.bufferView===view&&!replacements.has(index)))throw Error('Partially replaced shared image view');
  if(doc.accessors?.some(a=>a.bufferView===view||a.sparse?.indices?.bufferView===view||a.sparse?.values?.bufferView===view))throw Error('Image view is shared with geometry');
 }
 for(const texture of doc.textures)if(webpImages.has(texture.source)){
  if(texture.extensions?.[webpExtension])throw Error('WebP extension already present on replaced source');
  texture.extensions={...texture.extensions,[webpExtension]:{source:texture.source}};delete texture.source;
 }
 if(webpImages.size){
  doc.extensionsUsed=[...new Set([...(doc.extensionsUsed??[]),webpExtension])];
  doc.extensionsRequired=[...new Set([...(doc.extensionsRequired??[]),webpExtension])];
 }
 const chunks=[];let size=0;
 for(let i=0;i<doc.bufferViews.length;i++){
  const data=byView.get(i)??source.view(i),padding=(-size)&3;
  if(padding){chunks.push(Buffer.alloc(padding));size+=padding;}
  doc.bufferViews[i]={...doc.bufferViews[i],byteOffset:size,byteLength:data.length};chunks.push(data);size+=data.length;
 }
 doc.buffers[0].byteLength=size;
 const json=Buffer.from(JSON.stringify(doc)),j=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]),b=Buffer.concat([...chunks,Buffer.alloc((-size)&3)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(b.length);binHeader.writeUInt32LE(0x004e4942,4);
 const output=Buffer.concat([header,j,binHeader,b]),packed=parseTextureGlb(output);
 for(let i=0;i<doc.bufferViews.length;i++)assert.ok(packed.view(i).equals(byView.get(i)??source.view(i)),`Buffer view ${i} changed unexpectedly`);
 return output;
}

export function imageRoles(doc,index){
 const sources=new Set(doc.textures.flatMap((texture,i)=>(texture.source===index||texture.extensions?.KHR_texture_basisu?.source===index)?[i]:[])),roles=new Set();
 const walk=value=>{
  if(Array.isArray(value)){value.forEach(walk);return;}
  if(!value||typeof value!=='object')return;
  for(const[key,child]of Object.entries(value)){
   if(key.endsWith('Texture')&&sources.has(child?.index))roles.add(key);
   walk(child);
  }
 };
 walk(doc.materials);return roles;
}
const safeFile=file=>typeof file==='string'&&file.split('/').every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..');
async function regularFile(file,ancestor){
 const info=await lstat(file),resolved=await realpath(file);
 if(!info.isFile()||info.isSymbolicLink()||!resolved.startsWith(ancestor+path.sep))throw Error('Expected a regular contained file: '+file);
 return readFile(file);
}

export async function prepareReleaseTextures({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir),review=await realpath(path.join(root,'release-textures'));
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep)||review===output||review.startsWith(output+path.sep)||output.startsWith(review+path.sep))throw Error('Texture output overlaps authoring source');
 const manifest=JSON.parse(await regularFile(path.join(review,'manifest.json'),review));
 if(manifest.v!==1||!Array.isArray(manifest.models)||!Array.isArray(manifest.textures))throw Error('Invalid reviewed texture manifest');
 if(manifest.policy)assert.deepEqual(manifest.policy,JSON.parse(await readFile(path.join(root,'tools/release-texture-policy.json'))),'Regenerate reviewed textures after changing their policy');
 const textures=new Map(),files=new Set(),result=[];
 for(const row of manifest.textures){
  if(!/^[a-f0-9]{64}$/.test(row.sha256)||!/^[a-f0-9]{64}$/.test(row.sourceSha256)||textures.has(row.sha256)||!integer(row.width,1)||!integer(row.height,1)||!integer(row.bytes,1))throw Error('Invalid reviewed image identity');
  const exact=row.psnr===null&&row.p99===0&&row.max===0&&row.meanAbs===0;
  if(typeof row.lossless!=='boolean'||row.lossless!==true&&!exact&&!(Number.isFinite(row.psnr)&&row.psnr>=40&&row.p99>=0&&row.p99<=8&&row.max>=0&&row.max<=64))throw Error('Image does not meet reviewed error limits');
  textures.set(row.sha256,row);
 }
 for(const model of manifest.models){
  if(!safeFile(model.file)||!model.file.endsWith('.glb')||files.has(model.file)||!Array.isArray(model.images)||(!model.images.length&&!model.mips?.length))throw Error('Invalid reviewed model path');files.add(model.file);
  const original=await regularFile(path.join(source,model.file),source);
  if(textureDigest(original)!==model.sourceSha256)throw Error('Reviewed source changed: '+model.file);
  const glb=parseTextureGlb(original),replacements=new Map();
  for(const image of model.images){
   const old=glb.doc.images[image.index],row=textures.get(image.sha256);
   if(!integer(image.index)||!old||replacements.has(image.index)||!row||image.sourceSha256!==row.sourceSha256||textureDigest(glb.view(old.bufferView))!==image.sourceSha256)throw Error('Reviewed image changed: '+model.file);
   if(!row.lossless&&(old.mimeType!=='image/jpeg'||[...imageRoles(glb.doc,image.index)].join(',')!=='baseColorTexture'))throw Error('Lossy conversion is limited to JPEG base colours');
   const data=await regularFile(path.join(review,'encoded',row.sha256+'.webp'),review);
   if(data.length!==row.bytes||textureDigest(data)!==row.sha256)throw Error('Reviewed WebP changed: '+row.sha256);
   assert.deepEqual(inspectWebp(data),{width:row.width,height:row.height,lossless:row.lossless},'Reviewed WebP dimensions/encoding changed');
   replacements.set(image.index,data);
  }
  for(const mip of model.mips??[]){
   const old=glb.doc.images[mip.index];
   if(!integer(mip.index)||!old||old.mimeType!=='image/ktx2'||replacements.has(mip.index))throw Error('Invalid reviewed mip selection');
   const data=glb.view(old.bufferView);
   if(textureDigest(data)!==mip.sourceSha256)throw Error('Reviewed mip source changed: '+model.file);
   const trimmed=trimKtxMipChain(data,mip.maxSize);
   if(!trimmed.removedLevels||textureDigest(trimmed.data)!==mip.sha256||trimmed.width!==mip.width||trimmed.height!==mip.height||trimmed.levels!==mip.levels)throw Error('Reviewed mip selection changed: '+model.file);
   replacements.set(mip.index,trimmed.data);
  }
  const packed=repackTextureGlb(original,replacements);
  if(packed.length>=original.length)throw Error('Reviewed model is not smaller: '+model.file);
  const target=path.join(output,model.file),existing=await regularFile(target,output);
  if(!existing.equals(original)&&!existing.equals(packed))throw Error('Generated model differs from reviewed input: '+model.file);
  await writeFile(target,packed);
  result.push({file:model.file,sourceBytes:original.length,bytes:packed.length,sourceSha256:model.sourceSha256,sha256:textureDigest(packed),images:replacements.size});
 }
 const evidence={v:1,encoding:[webpExtension,'reviewed UASTC mip selection'],dimensions:'reviewed per image in release-textures/manifest.json',source:'Original authoring models and provenance remain in public/. These hashes describe the release encoding.',models:result};
 const provenance=path.join(output,'provenance');await mkdir(provenance,{recursive:true});
 if(!(await lstat(provenance)).isDirectory()||await realpath(provenance)!==provenance)throw Error('Expected real output provenance directory');
 try{if((await lstat(path.join(provenance,'release-textures.json'))).isSymbolicLink())throw Error('Unexpected provenance symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
 const evidenceBytes=Buffer.from(JSON.stringify(evidence)+'\n');await writeFile(path.join(output,'provenance/release-textures.json'),evidenceBytes);
 return{models:result.length,images:result.reduce((n,r)=>n+r.images,0),savedBytes:result.reduce((n,r)=>n+r.sourceBytes-r.bytes,0)-evidenceBytes.length,manifestBytes:evidenceBytes.length};
}
