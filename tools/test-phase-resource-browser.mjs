import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5345/';
const output=process.env.PHASE_RESOURCE_OUTPUT||join(tmpdir(),'phase-resources');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}}),rows=[],recoveries=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let failure=null;
try{
 await page.goto(new URL('?playtest&level=sky',base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 for(const id of Array.from({length:3},()=>['dark','sky','nightworks-after-hours','sky']).flat()){
  const retired=await page.evaluate(async id=>{
   const g=window.__game,old=window.phaseResourceOwners??[];
   await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('level switch failed');g.gameFlow.hide();});
   const result=old.map(record=>({kind:record.kind,calls:record.calls,programsRetired:g.renderer.properties.get(record.material).programs===undefined}));
   window.phaseResourceOwners=[];
   for(const pad of g.getLevel().phasePads)for(const kind of ['litMat','ghostMat']){
    const material=pad[kind],record={kind,material,calls:0};material.addEventListener('dispose',()=>record.calls++);
    window.phaseResourceOwners.push(record);
   }
   for(const record of old)delete record.material;
   return result;
  },id);
  assert.ok(retired.every(m=>m.calls===1&&m.programsRetired),'every retired phase material releases its renderer programs once');
  await page.waitForTimeout(1800);
  const row=await page.evaluate(()=>{const g=window.__game;return{id:g.getCurrentLevel().id,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,programReferences:g.renderer.info.programs.reduce((n,p)=>n+p.usedTimes,0),preparedGhosts:g.getLevel().phasePads.filter(p=>g.renderer.properties.get(p.ghostMat).programs?.size>0).length,phasePads:g.getLevel().phasePads.length,failedAssets:g.getLoadingDiagnostics().failed,stamp:document.querySelector('.hud-build')?.textContent};});
  row.retired=retired;rows.push(row);assert.equal(row.preparedGhosts,row.phasePads);assert.deepEqual(row.failedAssets,[]);
  console.log(JSON.stringify({id:row.id,memory:row.memory,programs:row.programs,references:row.programReferences,retired:retired.length}));
 }
 const returns=rows.filter(r=>r.id==='sky').slice(-3);
 for(const key of ['textures','geometries'])assert.ok(Math.max(...returns.map(r=>r.memory[key]))-Math.min(...returns.map(r=>r.memory[key]))<=1,`${key} residency stays bounded after repeated phase-level returns`);
 assert.ok(Math.max(...returns.map(r=>r.programReferences))-Math.min(...returns.map(r=>r.programReferences))<=1,'shader references must not accumulate with retired alternate materials');
 for(let round=0;round<3;round++){
  const recovery=await page.evaluate(async()=>{
   const g=window.__game,ext=g.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('context-loss extension unavailable');
   ext.loseContext();await new Promise(r=>setTimeout(r,250));const held=g.frameStats.totalFixedSteps;
   await new Promise(r=>setTimeout(r,250));const after=g.frameStats.totalFixedSteps;ext.restoreContext();return{held,after};
  });
  assert.equal(recovery.held,recovery.after,'simulation holds while graphics are unavailable');
  await page.waitForFunction(held=>!window.__game.renderer.getContext().isContextLost()&&window.__game.frameStats.totalFixedSteps>held,recovery.held,{timeout:30000});
  await page.waitForTimeout(500);recovery.glError=await page.evaluate(()=>window.__game.renderer.getContext().getError());assert.equal(recovery.glError,0);recoveries.push(recovery);
 }
 assert.deepEqual(errors,[]);console.log('PASS repeated phase returns, material/program retirement, bounded residency and three real graphics recoveries.');
}catch(error){failure=String(error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify({base,rows,recoveries,errors,failure},null,2));await browser.close();}
