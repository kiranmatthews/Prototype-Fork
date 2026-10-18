import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5348').replace(/\/$/,'');
const lite=process.env.RACE_LIFETIME_LITE==='1';
const output=process.env.RACE_LIFETIME_OUTPUT||'/private/tmp/slipstream-race-lifetime';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'}),cdp=await page.context().newCDPSession(page),errors=[],rows=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await cdp.send('Performance.enable');
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&!window.__game.gameFlow.loadingPhase,null,{timeout:120000});
async function record(label){
 await page.waitForTimeout(1800);
 await cdp.send('HeapProfiler.collectGarbage');
 const row=await page.evaluate(label=>{
  const g=window.__game,r=g.getSkateRace();let nodes=0;g.scene.traverse(()=>nodes++);
  return {
   label,level:g.getCurrentLevel().id,stamp:document.querySelector('.hud-build')?.textContent,
   memory:{...g.renderer.info.memory},programs:g.renderer.info.programs?.length,
   draw:g.getRenderFrameStats(),contextLost:g.renderer.getContext().isContextLost(),
   loading:g.getLoadingDiagnostics(),nodes,
   race:{
    active:r.active,phase:r.phase,mode:r.mode,riders:r.riders.length,
    rootChildren:r.root.children.length,projectiles:r.projectiles.length,effects:r.effects.effects.length,
    homes:r.homes.size,returns:r.returns.size,boxes:r.riders.map(a=>a.boxes.size),
    rivalRetiredLevels:r.riders.slice(1).filter(a=>a.player.runLevel&&a.player.runLevel!==g.getLevel()).length,
    retiredLevelsAlive:(window.auditRefs??[]).filter(ref=>ref.deref()).length,
   },
   assets:g.getLevel().jungleAssets?.diagnostics,
  };
 },label);
 const {metrics}=await cdp.send('Performance.getMetrics');
 row.heapUsage=await cdp.send('Runtime.getHeapUsage');
 row.heapBytes=metrics.find(m=>m.name==='JSHeapUsedSize').value;
 rows.push(row);
 await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,errors},null,2));
 console.log(JSON.stringify({label:row.label,level:row.level,memory:row.memory,heapMiB:Math.round(row.heapBytes/1048576),nodes:row.nodes,race:row.race}));
 assert.equal(row.contextLost,false);
 assert.equal(row.race.projectiles,0);assert.equal(row.race.effects,0);assert.equal(row.race.rootChildren,40);
 assert.equal(row.race.rivalRetiredLevels,0,'inactive rivals release the previous level');
 assert.equal(row.race.retiredLevelsAlive,0,'departed Slipstream levels are collectible');
 if(!row.race.active){assert.equal(row.race.homes,0);assert.equal(row.race.returns,0);assert.ok(row.race.boxes.every(count=>count===0));}
 assert.deepEqual(row.assets?.errors??[],[]);assert.deepEqual(row.loading.failed,[]);
}

try{
 await page.goto(`${base}/?playtest&level=slipstream-race${lite?'&lite':''}`,{timeout:180000});await ready();
 await record('initial');
 for(let i=0;i<8;i++){
  await page.getByRole('button',{name:i%2?'TIME TRIAL':'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
  if(i%2===0)await page.evaluate(()=>{const r=window.__game.getSkateRace();for(const kind of ['green-shell','water-bomb','horn','shock-shell']){r.riders[0].item=kind;r.useItem();}});
  await page.waitForTimeout(400);await page.keyboard.press('Escape');await page.getByRole('button',{name:'RESTART',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='grid');
  if(i%2===1)await page.evaluate(()=>window.__game.getSkateRace().reset('race'));
  await record('restart-'+i);
 }
 for(let i=0;i<6;i++){
  for(const id of ['flats','slipstream-race']){
   await page.evaluate(id=>{const g=window.__game;if(g.getSkateRace().active)(window.auditRefs??=[]).push(new WeakRef(g.getLevel()));g.ui.onLevelSelect(id);},id);
   await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay&&!window.__game.gameFlow.loadingPhase,id,{timeout:120000});
   await record('visit-'+i+'-'+id);
  }
 }
 for(const level of ['flats','slipstream-race']){
  const settled=rows.filter(r=>r.label.startsWith('visit-')&&r.level===level).slice(2);
  assert.equal(new Set(settled.map(r=>r.memory.geometries)).size,1,'settled geometry residency must stay constant');
  assert.ok(Math.max(...settled.map(r=>r.memory.textures))-Math.min(...settled.map(r=>r.memory.textures))<=1,'allow at most one late shared font atlas');
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:output+'/final.png'});
}catch(error){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}finally{await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,errors},null,2));await browser.close();}
