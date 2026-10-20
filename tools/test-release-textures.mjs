import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTextureGlb,repackTextureGlb,inspectWebp,prepareReleaseTextures,trimKtxMipChain,textureDigest as hash} from './release-textures.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const review=path.resolve(process.argv.find(a=>a.startsWith('--review='))?.slice(9)??path.join(root,'release-textures'));
const manifest=JSON.parse(await readFile(path.join(review,'manifest.json')));
let imageCount=0,sourceBytes=0,releaseBytes=0;
for(const model of manifest.models){
 const source=await readFile(path.join(root,'public',model.file)),a=parseTextureGlb(source),replacements=new Map();
 assert.equal(hash(source),model.sourceSha256);
 for(const row of model.images)replacements.set(row.index,await readFile(path.join(review,'encoded',row.sha256+'.webp')));
 for(const mip of model.mips??[]){const r=trimKtxMipChain(a.view(a.doc.images[mip.index].bufferView),mip.maxSize);assert.equal(hash(r.data),mip.sha256);replacements.set(mip.index,r.data);}
 const packed=repackTextureGlb(source,replacements),b=parseTextureGlb(packed),changedViews=new Set([...replacements.keys()].map(i=>a.doc.images[i].bufferView));
 // Independent comparison: restore only the permitted metadata fields. Every
 // other scene/material/skin/animation/accessor property must be unchanged.
 const normalized=structuredClone(b.doc);
 normalized.buffers=a.doc.buffers;normalized.bufferViews=a.doc.bufferViews;
 for(const row of model.images)normalized.images[row.index]=a.doc.images[row.index];
 for(let i=0;i<a.doc.textures.length;i++){
  const old=a.doc.textures[i];
  if(replacements.has(old.source)){
   assert.equal(b.doc.textures[i].source,undefined);
   assert.equal(b.doc.textures[i].extensions.EXT_texture_webp.source,old.source);
   normalized.textures[i]=old;
  }
 }
 for(const key of ['extensionsUsed','extensionsRequired']){
  if(model.images.length)assert.ok(b.doc[key].includes('EXT_texture_webp'));
  if(a.doc[key])normalized[key]=a.doc[key];else delete normalized[key];
 }
 // JSON serialization canonicalizes signed zero in accessor bounds.
 assert.deepEqual(JSON.parse(JSON.stringify(normalized)),JSON.parse(JSON.stringify(a.doc)),model.file);
 for(let i=0;i<a.doc.bufferViews.length;i++)if(!changedViews.has(i))assert.deepEqual(b.view(i),a.view(i),model.file+' view '+i);
 for(const row of model.images){const data=replacements.get(row.index);assert.deepEqual(b.view(b.doc.images[row.index].bufferView),data);assert.equal(b.doc.images[row.index].mimeType,'image/webp');}
 assert.ok(packed.length<source.length);imageCount+=replacements.size;sourceBytes+=source.length;releaseBytes+=packed.length;
}
const scratch=await mkdtemp(path.join(tmpdir(),'release-texture-test-'));
try{
 const model=manifest.models.find(m=>m.images.some(i=>manifest.textures.find(t=>t.sha256===i.sha256).lossless===false));
 const doc={v:1,models:[model],textures:manifest.textures.filter(t=>model.images.some(i=>i.sha256===t.sha256))};
 const publicDir=path.join(scratch,'public'),outDir=path.join(scratch,'dist'),reviewDir=path.join(scratch,'release-textures');
 for(const directory of [publicDir,outDir]){await mkdir(path.dirname(path.join(directory,model.file)),{recursive:true});await copyFile(path.join(root,'public',model.file),path.join(directory,model.file));}
 await mkdir(path.join(reviewDir,'encoded'),{recursive:true});
 for(const row of doc.textures)await copyFile(path.join(review,'encoded',row.sha256+'.webp'),path.join(reviewDir,'encoded',row.sha256+'.webp'));
 const save=async data=>writeFile(path.join(reviewDir,'manifest.json'),JSON.stringify(data));await save(doc);
 const before=await readFile(path.join(publicDir,model.file)),result=await prepareReleaseTextures({root:scratch,outDir});assert.equal(result.models,1);assert.ok(result.savedBytes>0);
 assert.deepEqual(await readFile(path.join(publicDir,model.file)),before);
 assert.deepEqual(await prepareReleaseTextures({root:scratch,outDir}),result,'repeat builds are deterministic');
 await assert.rejects(prepareReleaseTextures({root:scratch,outDir:publicDir}),/overlaps authoring/);
 const edited=structuredClone(doc);edited.models[0].sourceSha256='0'.repeat(64);await save(edited);await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/Reviewed source changed/);
 const wrongPair=structuredClone(doc);wrongPair.textures[0].sourceSha256='0'.repeat(64);await save(wrongPair);await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/Reviewed image changed/);
 const lowQuality=structuredClone(doc);const lossy=lowQuality.textures.find(t=>!t.lossless);lossy.psnr=39;await save(lowQuality);await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/error limits/);
 const badDimension=structuredClone(doc);badDimension.textures[0].width++;await save(badDimension);await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/dimensions\/encoding/);
 const traversed=structuredClone(doc);traversed.models[0].file='../outside.glb';await save(traversed);await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/model path/);
 await save(doc);
 const encodedPath=path.join(reviewDir,'encoded',doc.textures[0].sha256+'.webp');const data=await readFile(encodedPath);await writeFile(encodedPath,Buffer.alloc(data.length));await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/WebP changed/);await writeFile(encodedPath,data);
 const linked=path.join(scratch,'linked');await mkdir(path.dirname(path.join(linked,model.file)),{recursive:true});await symlink(path.join(publicDir,model.file),path.join(linked,model.file));await assert.rejects(prepareReleaseTextures({root:scratch,outDir:linked}),/regular contained/);
 await rm(path.join(outDir,'provenance'),{recursive:true});await symlink(publicDir,path.join(outDir,'provenance'));await assert.rejects(prepareReleaseTextures({root:scratch,outDir}),/real output provenance/);
 assert.deepEqual(await readFile(path.join(publicDir,model.file)),before,'all failures preserve authoring data');
 const invalid=Buffer.from(data);invalid.writeUInt32LE(1,4);assert.throws(()=>inspectWebp(invalid),/Invalid reviewed WebP/);
 assert.throws(()=>parseTextureGlb(Buffer.alloc(32)),/Invalid GLB/);
}finally{await rm(scratch,{recursive:true,force:true});}
console.log(JSON.stringify({pass:true,models:manifest.models.length,images:imageCount,sourceBytes,releaseBytes,savedBytes:sourceBytes-releaseBytes,checks:'all non-image bytes and metadata; source retention; repeat builds; corrupt/stale blobs; error limits; dimensions; unsafe paths'}));
