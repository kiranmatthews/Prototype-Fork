import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSharedReleaseTextures,shareGlbImages} from './release-shared-textures.mjs';
import {parseTextureGlb,textureDigest as hash} from './release-textures.mjs';
import {runtimeAsset} from './offline-build.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),scratch=await mkdtemp(path.join(tmpdir(),'release-shared-textures-'));
const paths=['drowned-crown/excellence/crash-cavern-rock.glb','drowned-crown/excellence/crash-cavern-canopy.glb','drowned-crown/excellence/crash-mine-shell.glb','treehouse-trail/tree.glb','treehouse-trail/canopy.glb','custard-creek/willow-grove.glb','custard-creek/willow-forest.glb'];
try{
 const source=path.join(scratch,'public'),out=path.join(scratch,'dist');await mkdir(source);await mkdir(out);const originals=new Map();
 for(const file of paths){const bytes=await readFile(path.join(root,'public',file));originals.set(file,bytes);await mkdir(path.dirname(path.join(out,file)),{recursive:true});await writeFile(path.join(out,file),bytes);}
 const sentinel=path.join(source,'retained.glb');await copyFile(path.join(root,'public',paths[0]),sentinel);const sourceBytes=await readFile(sentinel);
 const virtual=await readFile(path.join(root,'public/carlisle-kit/city.glb'));await mkdir(path.join(out,'carlisle-kit'));await writeFile(path.join(out,'carlisle-kit/city.glb'),virtual);
 const result=await prepareSharedReleaseTextures({root:scratch,outDir:out});assert.ok(result.images>=6&&result.models===paths.length&&result.savedBytes>0);
 const proof=JSON.parse(await readFile(path.join(out,'provenance/shared-textures.json')));let packedBytes=0;
 assert.deepEqual(proof.unchangedUnsupported,['carlisle-kit/city.glb']);assert.deepEqual(await readFile(path.join(out,'carlisle-kit/city.glb')),virtual,'compressed virtual-buffer model remains exact');
 for(const asset of proof.assets){assert.equal(hash(await readFile(path.join(out,asset.file))),asset.sha256);assert.ok(runtimeAsset(asset.file,{bonus:1,counter:1}),'exact shared image belongs in the offline manifest');}
 for(const model of proof.models){
  const before=parseTextureGlb(originals.get(model.file)),bytes=await readFile(path.join(out,model.file)),after=parseTextureGlb(bytes);packedBytes+=bytes.length;
  assert.equal(hash(bytes),model.sha256);const movedViews=new Set();
  for(const index of model.images){const image=before.doc.images[index],next=after.doc.images[index];movedViews.add(image.bufferView);assert.equal(next.bufferView,undefined);assert.equal(next.mimeType,image.mimeType);
   const uri=new URL(next.uri,'https://example.test/Prototype-Fork/'+model.file);assert.ok(uri.pathname.startsWith('/Prototype-Fork/__shared_textures/'));
   const referenced=await readFile(path.resolve(out,path.dirname(model.file),next.uri));assert.deepEqual(referenced,before.view(image.bufferView),'shared encoded pixels remain exact');
  }
  for(let i=0;i<before.doc.bufferViews.length;i++)if(!movedViews.has(i))assert.deepEqual(after.view(i),before.view(i),'geometry, normals, UVs, skin and animation buffers remain exact');
  const restored=structuredClone(after.doc);restored.buffers=before.doc.buffers;restored.bufferViews=before.doc.bufferViews;restored.images=before.doc.images;
  assert.deepEqual(JSON.parse(JSON.stringify(restored)),JSON.parse(JSON.stringify(before.doc)));
 }
 const total=packedBytes+proof.assets.reduce((n,a)=>n+a.bytes,0)+(await readFile(path.join(out,'provenance/shared-textures.json'))).length;
 assert.equal(result.savedBytes,[...originals.values()].reduce((n,b)=>n+b.length,0)-total,'reported saving includes the new shared files and evidence');
 assert.deepEqual(await prepareSharedReleaseTextures({root:scratch,outDir:out}),result,'unchanged repeated preparation is stable');
 await assert.rejects(prepareSharedReleaseTextures({root:scratch,outDir:source}),/overlaps authoring/);
 const example=proof.models[0],original=originals.get(example.file),doc=parseTextureGlb(original),index=example.images[0],data=doc.view(doc.doc.images[index].bufferView);
 assert.throws(()=>shareGlbImages(original,new Map([[index,{uri:'https://foreign.test/image.webp',bytes:data}]])),/contained shared URI/);
 assert.throws(()=>shareGlbImages(original,new Map([[index,{uri:'../__shared_textures/'+'0'.repeat(64)+'.webp',bytes:Buffer.from('different')}]])),/byte-identical/);
 const shared=path.join(out,proof.assets[0].file),saved=await readFile(shared);await writeFile(shared,Buffer.alloc(saved.length));
 await assert.rejects(prepareSharedReleaseTextures({root:scratch,outDir:out}),/output changed/);await writeFile(shared,saved);
 const linked=path.join(scratch,'linked');await mkdir(linked);await symlink(sentinel,path.join(linked,'model.glb'));await assert.rejects(prepareSharedReleaseTextures({root:scratch,outDir:linked}),/symlinks/);
 assert.deepEqual(await readFile(sentinel),sourceBytes,'authoring data is never rewritten');
 console.log(JSON.stringify({pass:true,...result,checks:'encoded image identity; all non-image data; nested base URLs; offline membership; source retention; repeat builds; corrupt output; URI containment; symlinks'}));
}finally{await rm(scratch,{recursive:true,force:true});}
