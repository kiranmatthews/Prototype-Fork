import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';

// Authoring utility: fingerprint a published revision, or verify that its
// pristine cache follows source while even tiny edits stay caller-owned.
const h=await readFile(new URL('../validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(h.slice(h.indexOf('function installHeadlessDom()'),h.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {normalizeUserLevelEntries}=await server.ssrLoadModule('/src/level.ts');
 const revision=process.argv[2]??'3b0c637';
 const pack=JSON.parse(execFileSync('git',['show',`${revision}:public/levels.json`],{encoding:'utf8',maxBuffer:10000000}));
 const entry=normalizeUserLevelEntries(pack.levels).find(e=>e.id==='test'),json=JSON.stringify(entry.data);
 let a=2166136261,b=2246822519;
 for(let i=0;i<json.length;i++){a=Math.imul(a^json.charCodeAt(i),16777619);b=Math.imul(b^json.charCodeAt(i),3266489917);}
 console.log({revision,length:json.length,a:'0x'+(a>>>0).toString(16),b:'0x'+(b>>>0).toString(16)});
 if(process.argv.includes('--check')){
  const {isOriginalTestCourse}=await server.ssrLoadModule('/src/levels/carlisleLegacy.ts');
  assert.ok(isOriginalTestCourse(entry),'pristine published cache follows builtin');
  const moved=structuredClone(entry);moved.data.components[0].p[0]+=.01;
  assert.ok(!isOriginalTestCourse(moved),'one-centimetre edit stays local');
  const named=structuredClone(entry);named.name=named.data.name='My Carlisle';
  assert.ok(!isOriginalTestCourse(named),'renamed copy stays local');
  const mutable=structuredClone(entry);assert.ok(isOriginalTestCourse(mutable));mutable.data.components[0].p[0]+=.01;
  assert.ok(!isOriginalTestCourse(mutable),'in-place edits cannot reuse stale cache recognition');
  console.log('PASS published cache migration and edited-copy preservation.');
 }
}finally{await server.close();}
