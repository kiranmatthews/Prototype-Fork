import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
const f=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',f.slice(f.indexOf('function installHeadlessDom()'),f.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const s=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const api=await s.ssrLoadModule('/src/level.ts'),m=await s.ssrLoadModule('/src/levels/country-club.ts');
 for(const revision of ['ce3f4c1f','4e8c41fd','73dbe1d1','71c7a622','5743bf80']){
  const old=JSON.parse(execFileSync('git',['show',`${revision}:public/levels.json`],{maxBuffer:40*1024*1024})).levels.find(e=>e.id==='country-club');
  assert.equal(api.setUserLevels([old]),true);
  const stored=JSON.stringify(api.getUserLevels());
  assert.equal(api.findLevel('country-club').data.components.length,m.COUNTRY_CLUB_LEVEL.components.length);
  assert.equal(api.isOverridden('country-club'),false);
  assert.equal(JSON.stringify(api.getUserLevels()),stored,'stock migration rewrote browser saves');
  for(const edit of [d=>d.components[0].color='#abcdef',d=>d.spawn[0]+=.1,d=>d.edgeGrindingRevision=1]){
   const e=structuredClone(old);edit(e.data);assert.equal(api.setUserLevels([e]),true);
   assert.equal(api.findLevel('country-club').data.components.length,api.normalizeCustomLevelData(e.data).components.length);
   assert.equal(api.isOverridden('country-club'),true);
  }
 }
 assert.equal(api.setUserLevels([{id:'country-club',name:m.COUNTRY_CLUB_LEVEL.name,data:m.COUNTRY_CLUB_LEVEL}]),true,'new course rejected by bounded level importer');
 console.log('PASS all untouched previous stock courses adopt 18 holes; edited saves remain intact; new course imports.');
}finally{await s.close();}
