import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runtimeAsset} from './offline-build.mjs';
const server=await createServer({appType:'custom',logLevel:'silent',cacheDir:join(tmpdir(),`enemy-update-test-${process.pid}`),server:{middlewareMode:true}});
try{
 const {newerGameAvailable}=await server.ssrLoadModule('/src/gameUpdate.ts');
 const base='https://example.test/Prototype-Fork/',current=base+'assets/index-old.js';
 for(const [body,expected] of [
  ['{"entry":"assets/index-old.js"}',false],['{"entry":"assets/index-next.js"}',true],
  ['{"entry":"https://evil.invalid/index-new.js"}',false],['{"entry":"../assets/index-new.js"}',false],
  ['{"entry":4}',false],['null',false],['not json',false],[' '.repeat(1025),false],
 ]){
  let requests=0;
  const result=await newerGameAvailable(base,current,async(url,options)=>{
   requests++;assert.equal(String(url),base+'release.json');assert.equal(options.cache,'no-store');assert.ok(options.signal);
   return new Response(body);
  });
  assert.equal(result,expected);assert.equal(requests,1);
 }
 assert.equal(await newerGameAvailable(base,'',()=>{throw Error('must not fetch without running entry');}),false);
 assert.equal(await newerGameAvailable(base,current,async()=>new Response('missing',{status:404})),false);
 assert.equal(await newerGameAvailable(base,current,async()=>{throw Error('offline');}),false);
 let reachable=0;
 await newerGameAvailable(base,current,async()=>{throw Error('offline');},()=>reachable++);
 assert.equal(reachable,0,'offline checks cannot trigger a worker update request');
 await newerGameAvailable(base,current,async()=>new Response('{"entry":"assets/index-old.js"}'),()=>reachable++);
 assert.equal(reachable,1,'a valid unchanged release still permits a lightweight worker check');
 assert.equal(await newerGameAvailable(base,current,async()=>new Response('x',{headers:{'content-length':'99999'}})),false);
 assert.equal(runtimeAsset('release.json',{bonus:10,counter:10}),false,'stale worker must not pin the update descriptor');
 const source=await readFile(new URL('../src/gameUpdate.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage|sessionStorage|\.register\(|location\.(?:reload|replace)|caches\./,'discovery cannot install/download a release, reload or mutate saves');
 console.log('PASS bounded release discovery, unchanged/new entry, malformed/foreign metadata, offline failure and uncached descriptor.');
}finally{await server.close();}
