import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createServer} from 'vite';
import {zipSync,unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
import {prepareLevelAtlasArchive} from './release-assets.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=await mkdtemp(path.join(tmpdir(),'atlas-export-'));
try{
 const outDir=path.join(root,'dist'),source=path.join(root,'public'),relative='provenance/level-atlas';
 const members={'index.html':new TextEncoder().encode('<html><body>Original atlas</body></html>'),'map.json':new TextEncoder().encode('{"original":"coordinates and labels"}'),'map.source.json.gz':new Uint8Array(gzipSync('{"source":"exact original data"}')),'art/Map image.bin':new Uint8Array([23,44,11,0,255])};
 for(const directory of [source,outDir]){
  await mkdir(path.join(directory,relative,'art'),{recursive:true});
  for(const [name,data] of Object.entries(members))await writeFile(path.join(directory,relative,name),data);
  await writeFile(path.join(directory,relative,'level-atlas.zip'),zipSync(members));
 }
 await mkdir(path.join(outDir,'assets'));await writeFile(path.join(outDir,'assets/atlas-123.js'),'download client');
 const args={root,outDir,clientFile:'assets/atlas-123.js'},prepared=await prepareLevelAtlasArchive(args);
 assert.equal(prepared.members,4);
 assert.equal(prepared.rawSnapshotBytes,members['map.source.json.gz'].length);
 const html=await readFile(path.join(outDir,relative,'index.html'),'utf8');
 assert.ok(html.includes('src="../../assets/atlas-123.js"'));
 assert.equal(await readFile(path.join(source,relative,'index.html'),'utf8'),new TextDecoder().decode(members['index.html']));
 await assert.rejects(readFile(path.join(outDir,relative,'level-atlas.zip')),/ENOENT/);
 const original=await readFile(path.join(source,relative,'level-atlas.zip'));assert.deepEqual(unzipSync(original),members);
 assert.deepEqual(await prepareLevelAtlasArchive(args),prepared,'watch/repeated builds read original ZIP and HTML');
 assert.equal(await readFile(path.join(outDir,relative,'index.html'),'utf8'),html,'the injected client is not duplicated');
 await assert.rejects(prepareLevelAtlasArchive({...args,outDir:source}),/overlaps source/);
 await assert.rejects(prepareLevelAtlasArchive({...args,clientFile:'../outside.js'}),/Invalid atlas download client/);
 await writeFile(path.join(outDir,relative,'map.json'),'changed');await assert.rejects(prepareLevelAtlasArchive(args),/differs from published member/);
 await writeFile(path.join(outDir,relative,'map.json'),members['map.json']);
 const linked=path.join(root,'linked');await mkdir(linked);await symlink(path.join(source,'provenance'),path.join(linked,'provenance'),'dir');
 await assert.rejects(prepareLevelAtlasArchive({...args,outDir:linked}),/real output directory/);
 const manifest=JSON.parse(await readFile(path.join(outDir,relative,'level-atlas.manifest.json'),'utf8'));
 assert.equal(manifest.entries.find(e=>e.name==='index.html').file,undefined);
 assert.equal(manifest.entries.find(e=>e.name==='art/Map image.bin').file,'art/Map image.bin');
 const snapshot=manifest.entries.find(e=>e.name==='map.source.json.gz');assert.match(snapshot.file,/^export-[0-9a-f]{64}\.bin$/);
 assert.deepEqual(await readFile(path.join(outDir,relative,snapshot.file)),Buffer.from(members[snapshot.name]));
 assert.deepEqual(await readFile(path.join(outDir,relative,snapshot.name)),Buffer.from(members[snapshot.name]),'the original compressed URL remains available');
 const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
 try{
  const {buildLevelAtlasArchive}=await server.ssrLoadModule('/src/level-atlas/archive.ts');
  let active=0,peak=0,broken=false;const requests=[],progress=[],fetchOptions=[];
  const fetcher=async (url,options)=>{
   fetchOptions.push({url:String(url),options});
   const name=decodeURIComponent(new URL(url).pathname.split('/atlas/')[1]);requests.push(name);active++;peak=Math.max(peak,active);
   await new Promise(resolve=>setTimeout(resolve,0));active--;
   if(name==='level-atlas.manifest.json')return new Response(JSON.stringify(manifest));
   const originalName=manifest.entries.find(e=>e.file===name)?.name??name;
   return new Response(broken?new Uint8Array(members[originalName].length):members[originalName]);
  };
  const blob=await buildLevelAtlasArchive(new URL('https://example.test/repo/atlas/'),fetcher,(a,b)=>progress.push([a,b]));
  assert.deepEqual(unzipSync(new Uint8Array(await blob.arrayBuffer())),members);
  assert.equal(peak,1);assert.equal(requests.length,4,'source HTML is inline');
  assert.equal(fetchOptions[0].options.cache,'no-store','each export discovers the current manifest');
  for(const request of fetchOptions.slice(1))assert.match(new URL(request.url).searchParams.get('revision'),/^[0-9a-f]{64}$/,'member cache identity follows its exact content');
  assert.equal(progress[0][0],0);assert.equal(progress.at(-1)[0],progress.at(-1)[1]);
  broken=true;await assert.rejects(buildLevelAtlasArchive(new URL('https://example.test/repo/atlas/'),fetcher),/member changed/);broken=false;
  const fail=async entry=>{const bad={...manifest,entries:[entry]};await assert.rejects(buildLevelAtlasArchive(new URL('https://example.test/atlas/'),async()=>new Response(JSON.stringify(bad))),/Invalid atlas|memory budget/);};
  for(const name of ['../outside','art/../../outside','/absolute','https://bad.test/image','art\\outside','art//missing','%2e%2e/file'])await fail({...manifest.entries[1],name,file:name});
  await fail({...manifest.entries[1],bytes:64*1048576+1});
  await fail({...manifest.entries[1],inlineBase64:'also supplied'});
  const oversized={v:1,entries:Array.from({length:4},(_,i)=>({name:`large${i}.bin`,file:`large${i}.bin`,bytes:64*1048576,sha256:'a'.repeat(64)}))};
  await assert.rejects(buildLevelAtlasArchive(new URL('https://example.test/atlas/'),async()=>new Response(JSON.stringify(oversized))),/memory budget/);
  await assert.rejects(buildLevelAtlasArchive(new URL('https://example.test/atlas/'),async()=>new Response('',{status:503})),/manifest unavailable/i);
 }finally{await server.close();}
 // Every current real archive member has a matching hosted original, including
 // the editable Sketch document. The production HTML alone is injected later.
 const project=path.resolve('public/provenance/level-atlas'),actual=unzipSync(await readFile(path.join(project,'level-atlas.zip')));
 for(const [name,bytes] of Object.entries(actual))assert.equal(hash(await readFile(path.join(project,name))),hash(bytes),name);
 console.log(`PASS atlas export: ${Object.keys(actual).length} original members, streaming order, progress, safe paths, integrity, retryable failures and source retention`);
}finally{await rm(root,{recursive:true,force:true});}
