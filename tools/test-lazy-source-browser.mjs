// Force source definitions over editor snapshots to exercise genuine first use.
// All changes live only in an isolated browser context.
import assert from 'node:assert/strict';import{createRequire}from'node:module';import{mkdir,writeFile}from'node:fs/promises';
import{fileURLToPath}from'node:url';import{tmpdir}from'node:os';import{join}from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),{build}=require('esbuild');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=await build({stdin:{contents:"export {COUNTRY_CLUB_LEVEL} from './src/levels/country-club';export {HOLLOWWAKE_LEVEL} from './src/levels/hollowwake-descent';",resolveDir:root},bundle:true,format:'esm',write:false});
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'source-entry');await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={steps:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('crash',()=>errors.push('Page crashed'));
 await page.addInitScript(()=>{window.contextLosses=0;document.addEventListener('webglcontextlost',()=>window.contextLosses++,true);});
 await page.route('**/source-entry-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
 await page.goto(new URL('?playtest&level=drowned-crown&lite',base).href,{timeout:120000});await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{window.sourceEntry=await import('/source-entry-fixture.js');});
 for(const [id,key]of [['country-club','COUNTRY_CLUB_LEVEL'],['hollowwake-descent','HOLLOWWAKE_LEVEL'],['drowned-crown',null]]){
  const result=await page.evaluate(async({id,key})=>{const g=window.__game,data=key&&window.sourceEntry[key],target=id==='country-club'?data:data?.boulderChase,property=id==='country-club'?'components':'path';
   const deferred=target?typeof Object.getOwnPropertyDescriptor(target,property).get==='function':null;
   await g.gameFlow.transition(()=>{if(data)g.findLevel(id).data=data;if(!g.switchLevel(id))throw Error('Cannot enter '+id);g.gameFlow.hide();});
   await new Promise(r=>setTimeout(r,1800));return{id,deferred,materialized:target?Object.getOwnPropertyDescriptor(target,property).writable===true:null,grounded:g.player.grounded,position:g.player.pos.toArray(),loading:g.getLoadingDiagnostics(),contextLosses:window.contextLosses,components:g.getCurrentLevel().data.components.length,hasBoulder:!!g.getLevel().boulder?.course};
  },{id,key});
  assert.equal(result.grounded,true);assert.deepEqual(result.loading.pending,[]);assert.deepEqual(result.loading.failed,[]);assert.equal(result.contextLosses,0);if(key){assert.equal(result.deferred,true);assert.equal(result.materialized,true);}if(id==='hollowwake-descent')assert.equal(result.hasBoulder,true);
  report.steps.push(result);console.log(JSON.stringify(result));await writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2));
 }
 assert.deepEqual(errors,[]);
}finally{report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
