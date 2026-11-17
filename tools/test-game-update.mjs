import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
 assert.equal(await newerGameAvailable(base,current,async()=>new Response('x',{headers:{'content-length':'99999'}})),false);
 const source=await readFile(new URL('../src/gameUpdate.ts',import.meta.url),'utf8');
 const discovery=source.slice(source.indexOf('export async function newerGameAvailable'),source.indexOf('export const GAME_UPDATE_EVENT'));
 assert.ok(discovery.length>200);
 assert.doesNotMatch(discovery,/localStorage|sessionStorage|\.register\(|location\.(?:reload|replace)|caches\./,'discovery cannot install/download a release, reload or mutate saves');
 // Offline mode is retired: the start-up cleanup may only remove this
 // project's own offline caches and worker, and never touches saves.
 const cleanup=source.slice(source.indexOf('async function removeRetiredOfflineCopy'),source.indexOf('export function startGameUpdateChecks'));
 assert.match(cleanup,/solProtoOffline:\$\{new URL\(scope\)\.pathname\}:/);assert.match(cleanup,/registration\.scope === scope/);
 assert.doesNotMatch(cleanup,/localStorage|sessionStorage|indexedDB|\.register\(/);
 assert.doesNotMatch(source,/\.register\(/,'the game never installs a service worker');
 console.log('PASS bounded release discovery, unchanged/new entry, malformed/foreign metadata, offline failure, uncached descriptor and scoped retirement of old offline copies.');
}finally{await server.close();}
