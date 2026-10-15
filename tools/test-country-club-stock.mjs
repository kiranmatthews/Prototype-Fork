import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
const f=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',f.slice(f.indexOf('function installHeadlessDom()'),f.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const old=JSON.parse(execFileSync('git',['show','ce3f4c1f:public/levels.json'],{maxBuffer:32*1024*1024})).levels.find(e=>e.id==='country-club');
const s=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const api=await s.ssrLoadModule('/src/level.ts');
 assert.equal(api.setUserLevels([old]),true);
 const stored=JSON.stringify(api.getUserLevels());
 assert.equal(api.findLevel('country-club').data.components.length,1034);
 assert.equal(api.isOverridden('country-club'),false);
 assert.equal(JSON.stringify(api.getUserLevels()),stored,'reading stock migration rewrote browser saves');
 for(const edit of [d=>d.components[0].color='#abcdef',d=>d.spawn[0]+=.1,d=>d.edgeGrindingRevision=1]){
  const e=structuredClone(old);edit(e.data);assert.equal(api.setUserLevels([e]),true);
  assert.equal(api.findLevel('country-club').data.components.length,732);
  assert.equal(api.isOverridden('country-club'),true);
 }
 console.log('PASS exact previous stock adopts the doubled landscape; colour, spawn and explicit saved overrides remain intact.');
}finally{await s.close();}
