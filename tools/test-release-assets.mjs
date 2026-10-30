import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {retiredFontAsset,pruneRetiredFontAssets,prepareFontArchives,prepareReviewCatalog,LOCAL_REVIEW_DIRECTORIES,LOCAL_REVIEW_FILES,localReviewAsset,pruneLocalReviewAssets} from './release-assets.mjs';
import {gunzipSync} from 'node:zlib';
import {zipSync,unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
import {createServer} from 'vite';
import {measureRelease,releaseWithinBudget,RELEASE_BYTE_LIMIT} from './check-release-size.mjs';
const versions={bonus:10,counter:10};
for(const file of ['fonts/roo-bonus-v9.png','fonts/roo-counter-v3-light2.png','fonts/roo-bonus-v8.json','fonts/roo-image-font-v7.zip'])assert.equal(retiredFontAsset(file,versions),true,file);
for(const file of ['fonts/roo-bonus-v10.png','fonts/roo-counter-v10-light2-cap128.png','fonts/roo-bonus-v10-light1-cap256.png','fonts/roo-counter-v10.json','fonts/roo-image-font-v10.zip','fonts/RooRegular.ttf','fonts/roo-font-v1-provenance.json','fonts/roo-bevel-source-v1.json','fonts/SECONDARY-FONT-NOTICE.md','other/roo-counter-v9.png'])assert.equal(retiredFontAsset(file,versions),false,file);
assert.equal(retiredFontAsset('fonts/roo-counter-v10.png',{bonus:11,counter:10}),false);
assert.equal(retiredFontAsset('fonts/roo-bonus-v10.png',{bonus:11,counter:10}),false,'active exports retain both palettes in each selected version');
assert.equal(retiredFontAsset('fonts/roo-image-font-v10.zip',{bonus:11,counter:10}),false);
assert.equal(retiredFontAsset('fonts/roo-image-font-v11.zip',{bonus:11,counter:10}),false);
assert.throws(()=>retiredFontAsset('fonts/roo-bonus-v9.png',{bonus:undefined,counter:10}),/Invalid active font/);
const root=await mkdtemp(path.join(tmpdir(),'release-assets-'));
try{
 const source=path.join(root,'public'),outDir=path.join(root,'dist');
 const catalogPath='animations/skate-review/catalog';
 const catalogBytes=Buffer.from(JSON.stringify({revision:31,clips:[{id:'study',tracks:[{keys:[{time:0,value:[0,.123456789123456,1]}]}]}]}));
 for(const base of [source,outDir]){
  await mkdir(path.join(base,'animations/skate-review'),{recursive:true});
  await writeFile(path.join(base,catalogPath+'.json'),catalogBytes);
 }
 const catalogResult=await prepareReviewCatalog({root,outDir});
 const packedCatalog=await readFile(path.join(outDir,catalogPath+'.bin'));
 assert.deepEqual(gunzipSync(packedCatalog),catalogBytes,'every catalogue byte and numeric keyframe is preserved');
 assert.deepEqual(await readFile(path.join(source,catalogPath+'.json')),catalogBytes,'source catalogue stays editable');
 await assert.rejects(readFile(path.join(outDir,catalogPath+'.json')),/ENOENT/);
 assert.deepEqual(await prepareReviewCatalog({root,outDir}),catalogResult,'catalogue packing is idempotent');
 await assert.rejects(prepareReviewCatalog({root,outDir:source}),/overlaps source/);
 await rm(path.join(outDir,catalogPath+'.bin'));
 await symlink(path.join(source,catalogPath+'.json'),path.join(outDir,catalogPath+'.bin'));
 await assert.rejects(prepareReviewCatalog({root,outDir}),/regular file/);
 assert.deepEqual(await readFile(path.join(source,catalogPath+'.json')),catalogBytes);
 await rm(path.join(outDir,catalogPath+'.bin'));
 await prepareReviewCatalog({root,outDir});
 const catalogLink=path.join(root,'catalog-link');
 await mkdir(path.join(catalogLink,'animations'),{recursive:true});
 await symlink(path.join(source,'animations/skate-review'),path.join(catalogLink,'animations/skate-review'),'dir');
 await assert.rejects(prepareReviewCatalog({root,outDir:catalogLink}),/symlinks/);
 await mkdir(path.join(source,'fonts'),{recursive:true});await mkdir(path.join(outDir,'fonts'),{recursive:true});
 for(const name of ['roo-bonus-v9.png','roo-bonus-v10.png','roo-image-font-v10.zip','SECONDARY-FONT-NOTICE.md'])for(const directory of [source,outDir])await writeFile(path.join(directory,'fonts',name),'original '+name);
 const result=await pruneRetiredFontAssets({root,outDir,fontVersions:versions});
 assert.deepEqual(result.files.map(file=>file.url),['fonts/roo-bonus-v9.png']);assert.ok(result.bytes>0);
 await assert.rejects(readFile(path.join(outDir,'fonts/roo-bonus-v9.png')),/ENOENT/);
 assert.equal(await readFile(path.join(source,'fonts/roo-bonus-v9.png'),'utf8'),'original roo-bonus-v9.png','historical source artwork remains local');
 for(const name of ['roo-bonus-v10.png','roo-image-font-v10.zip','SECONDARY-FONT-NOTICE.md'])assert.deepEqual(await readFile(path.join(outDir,'fonts',name)),await readFile(path.join(source,'fonts',name)));
 assert.deepEqual(await pruneRetiredFontAssets({root,outDir,fontVersions:versions}),{files:[],bytes:0},'repeat build pruning is idempotent');
 await assert.rejects(pruneRetiredFontAssets({root,outDir:source,fontVersions:versions}),/overlaps source/);
 const linked=path.join(root,'linked');await mkdir(linked);await symlink(path.join(source,'fonts'),path.join(linked,'fonts'),'dir');
 await assert.rejects(pruneRetiredFontAssets({root,outDir:linked,fontVersions:versions}),/real output directory/);
 assert.equal(await readFile(path.join(source,'fonts/roo-bonus-v9.png'),'utf8'),'original roo-bonus-v9.png');
 const members={'roo-bonus-v10.png':new Uint8Array(await readFile(path.join(source,'fonts/roo-bonus-v10.png'))),'README.txt':new TextEncoder().encode('Original font usage and attribution')};
 const original=Buffer.from(zipSync(members));
 for(const directory of [source,outDir])await writeFile(path.join(directory,'fonts/roo-image-font-v10.zip'),original);
 const exported=await prepareFontArchives({root,outDir,fontVersions:versions});
 assert.equal(exported.length,1);assert.equal(exported[0].members,2);
 assert.deepEqual(await prepareFontArchives({root,outDir,fontVersions:versions}),exported,'repeated/watch builds use the retained source archive');
 assert.deepEqual(await readFile(path.join(source,'fonts/roo-image-font-v10.zip')),original,'the complete original source ZIP remains local');
 await assert.rejects(readFile(path.join(outDir,'fonts/roo-image-font-v10.zip')),/ENOENT/);
 const manifest=JSON.parse(await readFile(path.join(outDir,'fonts/roo-image-font-v10.manifest.json'),'utf8'));
 assert.equal(manifest.entries.find(e=>e.name==='roo-bonus-v10.png').file,'roo-bonus-v10.png');
 assert.equal(Buffer.from(manifest.entries.find(e=>e.name==='README.txt').inlineBase64,'base64').toString(),'Original font usage and attribution');
 await assert.rejects(prepareFontArchives({root,outDir:source,fontVersions:versions}),/overlaps source/);
 await assert.rejects(pruneRetiredFontAssets({root,outDir:path.join(source,'fonts'),fontVersions:versions}),/overlaps source/);
 for(const directory of LOCAL_REVIEW_DIRECTORIES){
  for(const base of [source,outDir]){
   await mkdir(path.join(base,directory),{recursive:true});
   await writeFile(path.join(base,directory,'index.html'),'original local review');
  }
  assert.equal(localReviewAsset(directory+'/index.html'),true);
  assert.equal(localReviewAsset(directory+'-game/model.glb'),false);
 }
 assert.equal(localReviewAsset('drowned-crown/excellence/treasure-mound-hero.glb'),false);
 for(const file of LOCAL_REVIEW_FILES){
  for(const base of [source,outDir]){
   await mkdir(path.dirname(path.join(base,file)),{recursive:true});
   await writeFile(path.join(base,file),'original local authoring asset');
  }
  assert.equal(localReviewAsset(file),true);
  assert.equal(localReviewAsset(file+'.backup'),false);
 }
 const currentArtwork=[
  'treehouse-trials/forest-depth-alpha.ktx2','treehouse-trials/forest-depth-alpha.webp',
  'treehouse-trials/coast-depth-alpha.ktx2','treehouse-trials/coast-depth-alpha.webp',
  'blockworks-art/sky-v2.png','custard-creek/waterfall-pool-v4.webp',
  'custard-creek/waterfall-cliffs-v2.webp','custard-creek/waterfall-mist-alpha.webp',
 ];
 for(const file of currentArtwork){
  assert.equal(localReviewAsset(file),false,'current and legacy registered artwork remains published');
  for(const base of [source,outDir])await writeFile(path.join(base,file),'current runtime artwork');
 }
 const reviews=await pruneLocalReviewAssets({root,outDir});
 assert.equal(reviews.files.length,LOCAL_REVIEW_DIRECTORIES.length+LOCAL_REVIEW_FILES.length);
 for(const file of LOCAL_REVIEW_FILES){
  assert.equal(await readFile(path.join(source,file),'utf8'),'original local authoring asset');
  await assert.rejects(readFile(path.join(outDir,file)),/ENOENT/);
 }
 for(const file of currentArtwork)for(const base of [source,outDir])
  assert.equal(await readFile(path.join(base,file),'utf8'),'current runtime artwork');
 for(const directory of LOCAL_REVIEW_DIRECTORIES){
  assert.equal(await readFile(path.join(source,directory,'index.html'),'utf8'),'original local review');
  await assert.rejects(readFile(path.join(outDir,directory,'index.html')),/ENOENT/);
 }
 assert.deepEqual(await pruneLocalReviewAssets({root,outDir}),{files:[],bytes:0});
 await assert.rejects(pruneLocalReviewAssets({root,outDir:source}),/overlaps source/);
 const reviewLink=path.join(root,'review-link');await mkdir(reviewLink);
 await symlink(path.join(source,'drowned-crown'),path.join(reviewLink,'drowned-crown'),'dir');
 await assert.rejects(pruneLocalReviewAssets({root,outDir:reviewLink}),/real directory/);
 const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
 try{
  const {decodeSkateReviewCatalog}=await server.ssrLoadModule('/src/animation/skateCatalog.ts');
  assert.deepEqual(decodeSkateReviewCatalog(packedCatalog),JSON.parse(catalogBytes));
  assert.deepEqual(decodeSkateReviewCatalog(catalogBytes),JSON.parse(catalogBytes),'already decompressed responses remain supported');
  assert.throws(()=>decodeSkateReviewCatalog(new Uint8Array([0x1f,0x8b,0])));
  const {buildRooFontArchive}=await server.ssrLoadModule('/src/roo-type/archive.ts');
  let requests=[],active=0,peak=0,broken=false;
  const fetcher=async url=>{
   requests.push(String(url));active++;peak=Math.max(peak,active);
   await new Promise(resolve=>setTimeout(resolve,0));active--;
   if(String(url).endsWith('.manifest.json'))return new Response(JSON.stringify(manifest));
   return new Response(broken?new Uint8Array(members['roo-bonus-v10.png'].length):members['roo-bonus-v10.png']);
  };
  const blob=await buildRooFontArchive(new URL('https://example.test/game/fonts/'),10,fetcher);
  assert.equal(blob.type,'application/zip');assert.equal(peak,1,'export fetches one member at a time');
  assert.equal(requests.length,2,'inline attribution has no extra network request');
  assert.deepEqual(unzipSync(new Uint8Array(await blob.arrayBuffer())),members,'exported file contents are byte-identical to the authoring ZIP');
  broken=true;await assert.rejects(buildRooFontArchive(new URL('https://example.test/game/fonts/'),10,fetcher),/member changed/);broken=false;
  await assert.rejects(buildRooFontArchive(new URL('https://example.test/game/fonts/'),11,fetcher),/Invalid font archive manifest/);
  await assert.rejects(buildRooFontArchive(new URL('https://example.test/game/fonts/'),10,async()=>new Response('',{status:503})),/manifest unavailable/);
  const bad={...manifest,entries:[{...manifest.entries[0],name:'../escape.png'}]};
  await assert.rejects(buildRooFontArchive(new URL('https://example.test/game/fonts/'),10,async()=>new Response(JSON.stringify(bad))),/Invalid font archive member/);
 }finally{await server.close();}
 const auditDir=path.join(root,'audit');await mkdir(path.join(auditDir,'assets'),{recursive:true});
 await writeFile(path.join(auditDir,'index.html'),'hello');await writeFile(path.join(auditDir,'assets','scene.glb'),new Uint8Array(17));
 assert.deepEqual(await measureRelease(auditDir),{files:2,bytes:22,groups:[{name:'assets',bytes:17},{name:'index.html',bytes:5}]});
 assert.equal(releaseWithinBudget({bytes:RELEASE_BYTE_LIMIT}),true);
 assert.equal(releaseWithinBudget({bytes:RELEASE_BYTE_LIMIT+1}),false);
 assert.equal(releaseWithinBudget({bytes:22},21),false);
 assert.throws(()=>releaseWithinBudget({bytes:1},NaN),/Invalid release byte limit/);
 await symlink(path.join(source,'fonts'),path.join(auditDir,'source-link'),'dir');
 await assert.rejects(measureRelease(auditDir),/symbolic link/);
 await assert.rejects(measureRelease(path.join(root,'missing')),/ENOENT/);
 const empty=path.join(root,'empty');await mkdir(empty);await assert.rejects(measureRelease(empty),/empty/);
 console.log('PASS release size budget, fonts, original source retention, current export member identity, attribution, bounded fetching, failure handling and output-only deletion');
}finally{await rm(root,{recursive:true,force:true});}
