import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import {prepareReleaseImages} from './release-images.mjs';

const manifest=JSON.parse(await readFile('release-images/manifest.json','utf8'));
const root=await mkdtemp(path.join(tmpdir(),'lossless-release-images-'));
try{
 const outDir=path.join(root,'dist');await mkdir(outDir);
 await mkdir(path.join(root,'release-images/encoded'),{recursive:true});
 await writeFile(path.join(root,'release-images/manifest.json'),JSON.stringify(manifest));
 for(const row of manifest.files){
  for(const base of ['public','dist']){
   const dest=path.join(root,base,row.file);await mkdir(path.dirname(dest),{recursive:true});await copyFile('public/'+row.file,dest);
  }
  await copyFile('release-images/encoded/'+row.sha256+'.webp',path.join(root,'release-images/encoded',row.sha256+'.webp'));
 }
 const result=await prepareReleaseImages({root,outDir});
 assert.equal(result.images,manifest.files.length);assert.ok(result.savedBytes>0);
 assert.deepEqual(await prepareReleaseImages({root,outDir}),result);
 for(const row of manifest.files){
  assert.deepEqual(await readFile(path.join(root,'public',row.file)),await readFile('public/'+row.file));
  await assert.rejects(readFile(path.join(outDir,row.file)),/ENOENT/);
 }
 await assert.rejects(prepareReleaseImages({root,outDir:path.join(root,'public')}),/overlaps source/);
 const first=manifest.files[0],destination=path.join(outDir,first.file.replace(/\.png$/,'.webp'));
 await rm(destination);await symlink(path.join(root,'public',first.file),destination);
 await assert.rejects(prepareReleaseImages({root,outDir}),/regular release image/);
 await rm(destination);await copyFile('release-images/encoded/'+first.sha256+'.webp',destination);
 await writeFile(path.join(root,'release-images/encoded',first.sha256+'.webp'),'changed');
 await assert.rejects(prepareReleaseImages({root,outDir}),/Expected values|Reviewed image changed/);
 const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
 try{
  const {releaseImageUrl}=await server.ssrLoadModule('/src/releaseImageUrls.ts');
  const {RELEASE_IMAGE_FILES}=await server.ssrLoadModule('/src/releaseImageFiles.ts');
  assert.deepEqual([...RELEASE_IMAGE_FILES].sort(),manifest.files.map(row=>row.file).sort());
  for(const {file} of manifest.files)for(const base of ['', './','/Prototype-Fork/','https://example.test/Prototype-Fork/']){
   assert.equal(releaseImageUrl(base+file,false),base+file,'development keeps source PNGs');
   assert.equal(releaseImageUrl(base+file+'?v=1#preview',true),base+file.slice(0,-4)+'.webp?v=1#preview');
  }
  for(const file of ['fonts/roo-bonus-v10.png','custom-upload.png','blob:https://example.test/custom','data:image/png;base64,aaa'])assert.equal(releaseImageUrl(file,true),file,'exports/uploads remain unchanged');
 }finally{await server.close();}
 console.log(`PASS ${result.images} lossless release images, exact source/hash retention, repeated builds, safe output, development/production URLs and unchanged export files; ${result.savedBytes} bytes saved.`);
}finally{await rm(root,{recursive:true,force:true});}
