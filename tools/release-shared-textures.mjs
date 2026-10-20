import assert from 'node:assert/strict';
import {lstat,mkdir,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {parseTextureGlb,textureDigest as hash} from './release-textures.mjs';

const directory='__shared_textures',evidenceFile='provenance/shared-textures.json';
const extensions=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp'],['image/ktx2','ktx2']]);
const safeFile=file=>typeof file==='string'&&file.split('/').every(p=>/^[a-zA-Z0-9_.-]+$/.test(p)&&p!=='.'&&p!=='..');
async function regular(file,root){
 const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||!(await realpath(file)).startsWith(root+path.sep))throw Error('Expected a regular contained release file');
 return readFile(file);
}
async function filesIn(root,prefix=''){
 const files=[];
 for(const entry of await readdir(path.join(root,prefix),{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Release texture sharing cannot follow symlinks');
  const file=prefix+entry.name;
  if(entry.isDirectory())files.push(...await filesIn(root,file+'/'));
  else if(entry.isFile()&&file.endsWith('.glb'))files.push(file);
 }
 return files.sort();
}
function encode(doc,chunks,size){
 doc.buffers[0].byteLength=size;
 const json=Buffer.from(JSON.stringify(doc)),j=Buffer.concat([json,Buffer.alloc((-json.length)&3,32)]),b=Buffer.concat([...chunks,Buffer.alloc((-size)&3)]),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+j.length+b.length,8);header.writeUInt32LE(j.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(b.length);binHeader.writeUInt32LE(0x004e4942,4);
 return Buffer.concat([header,j,binHeader,b]);
}

/** Move only exact image payloads into same-origin content-addressed files.
 * Keep view indices stable for every geometry/skin/animation/extension owner.
 * Former image views become tiny unreferenced placeholders, never renumbered. */
export function shareGlbImages(bytes,images){
 const original=parseTextureGlb(bytes),doc=structuredClone(original.doc),removed=new Set();
 for(const [index,{uri,bytes:expected}]of images){
  const image=doc.images[index];
  if(!image||image.uri||!Number.isSafeInteger(image.bufferView)||!extensions.has(image.mimeType)||! /^(?:\.\.\/)*__shared_textures\/[a-f0-9]{64}\.(?:webp|png|jpg|ktx2)$/.test(uri))throw Error('Expected an embedded image and contained shared URI');
  assert.ok(original.view(image.bufferView).equals(expected),'Shared texture must be byte-identical');
  removed.add(image.bufferView);image.uri=uri;delete image.bufferView;
 }
 // A buffer view can be shared by images, but cannot be removed while any
 // image, accessor, sparse value, animation or extension still references it.
 const referenced=value=>{
  if(!value||typeof value!=='object')return;
  for(const [key,child]of Object.entries(value)){
   if(key==='bufferView'&&removed.has(child))throw Error('Image view is still referenced by model data');
   referenced(child);
  }
 };
 referenced(doc);
 const chunks=[];let size=0;
 for(let i=0;i<doc.bufferViews.length;i++){
  const data=removed.has(i)?Buffer.alloc(4):original.view(i),padding=(-size)&3;
  if(padding){chunks.push(Buffer.alloc(padding));size+=padding;}
  doc.bufferViews[i]={...doc.bufferViews[i],byteOffset:size,byteLength:data.length};chunks.push(data);size+=data.length;
 }
 const output=encode(doc,chunks,size),packed=parseTextureGlb(output);
 for(let i=0;i<doc.bufferViews.length;i++)if(!removed.has(i))assert.ok(packed.view(i).equals(original.view(i)),'Non-image buffer changed');
 const restored=structuredClone(packed.doc);restored.buffers=original.doc.buffers;restored.bufferViews=original.doc.bufferViews;restored.images=original.doc.images;
 assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(JSON.stringify(original.doc)),'Only image locations and buffer layout may change');
 return output;
}

/** Generated release only: public/ authoring GLBs remain self-contained. */
export async function prepareSharedReleaseTextures({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Shared-texture output overlaps authoring source');
 const reportPath=path.join(output,evidenceFile);
 try{
  const previous=JSON.parse(await regular(reportPath,output));
  if(previous.v!==1||!Array.isArray(previous.assets)||!Array.isArray(previous.models))throw Error('Invalid shared-texture evidence');
  for(const entry of [...previous.assets,...previous.models]){
   if(!safeFile(entry.file)||hash(await regular(path.join(output,entry.file),output))!==entry.sha256)throw Error('Shared-texture output changed; rebuild in a fresh directory');
  }
  return previous.summary;
 }catch(error){if(error.code!=='ENOENT')throw error;}
 const sharedPath=path.join(output,directory);
 try{await lstat(sharedPath);throw Error('Unexpected shared-texture directory without evidence');}catch(error){if(error.code!=='ENOENT')throw error;}
 const groups=new Map(),models=new Map(),unchangedUnsupported=[];
 for(const file of await filesIn(output)){
  const bytes=await regular(path.join(output,file),output);
  if(bytes.length<28)throw Error('Truncated release GLB');
  const document=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  if(!document.images?.length)continue;
  // Virtual fallback buffers and compressed geometry views have a different
  // offset contract. Keep those GLBs intact rather than rewriting that data.
  if(document.buffers?.length!==1||document.buffers[0].uri||document.bufferViews?.some(v=>v.extensions?.EXT_meshopt_compression)){unchangedUnsupported.push(file);continue;}
  const glb=parseTextureGlb(bytes);models.set(file,{sha256:hash(bytes),bytes:bytes.length});
  for(const [imageIndex,image]of glb.doc.images.entries()){
   if(!extensions.has(image.mimeType)||image.uri||!Number.isSafeInteger(image.bufferView))continue;
   const data=glb.view(image.bufferView);if(data.length<4096)continue;
   const digest=hash(data),key=image.mimeType+':'+digest;
   const group=groups.get(key)??{sha256:digest,mimeType:image.mimeType,bytes:data.length,uses:[]};
   group.uses.push({file,image:imageIndex,view:image.bufferView});groups.set(key,group);
  }
 }
 const selected=[...groups.values()].filter(g=>new Set(g.uses.map(u=>u.file+':'+u.view)).size>1).sort((a,b)=>a.sha256.localeCompare(b.sha256));
 const changes=new Map(),assets=[];
 for(const group of selected){
  const first=group.uses[0],sourceBytes=await regular(path.join(output,first.file),output);assert.equal(hash(sourceBytes),models.get(first.file).sha256);
  const data=parseTextureGlb(sourceBytes).view(first.view),file=directory+'/'+group.sha256+'.'+extensions.get(group.mimeType);
  assets.push({...group,file});
  for(const use of group.uses){
   const entries=changes.get(use.file)??new Map();
   entries.set(use.image,{uri:path.posix.relative(path.posix.dirname(use.file),file),bytes:data});changes.set(use.file,entries);
  }
 }
 // Validate all rewritten models before replacing anything in the build.
 const prepared=[];
 for(const [file,images]of changes){
  const bytes=await regular(path.join(output,file),output);assert.equal(hash(bytes),models.get(file).sha256);
  const packed=shareGlbImages(bytes,images);prepared.push({file,packed,sourceBytes:bytes.length,sourceSha256:hash(bytes),bytes:packed.length,sha256:hash(packed),images:[...images.keys()]});
 }
 const modelEvidence=prepared.map(({packed,...entry})=>entry);
 const evidence={v:1,scope:'Exact repeated image bytes stored once; all authoring GLBs and non-image runtime data unchanged.',assets,models:modelEvidence,unchangedUnsupported};
 const removed=prepared.reduce((n,p)=>n+p.sourceBytes-p.bytes,0),added=assets.reduce((n,a)=>n+a.bytes,0);
 evidence.summary={models:prepared.length,images:selected.length,removedBytes:removed,imageBytes:added,savedBytes:removed-added};
 // Include the evidence's own bytes in the final net saving.
 let encoded=Buffer.from(JSON.stringify(evidence)+'\n');
 evidence.summary.savedBytes=removed-added-encoded.length;encoded=Buffer.from(JSON.stringify(evidence)+'\n');
 evidence.summary.savedBytes=removed-added-encoded.length;encoded=Buffer.from(JSON.stringify(evidence)+'\n');
 await mkdir(sharedPath);await mkdir(path.dirname(reportPath),{recursive:true});
 if(await realpath(path.dirname(reportPath))!==path.dirname(reportPath))throw Error('Expected real output provenance directory');
 for(const asset of assets){const first=asset.uses[0],data=changes.get(first.file).get(first.image).bytes;await writeFile(path.join(output,asset.file),data,{flag:'wx'});}
 for(const entry of prepared)await writeFile(path.join(output,entry.file),entry.packed);
 await writeFile(reportPath,encoded,{flag:'wx'});
 return evidence.summary;
}
