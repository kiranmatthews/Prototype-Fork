import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5198/';
const output=process.env.RENDER_SMOKE_OUTPUT||'/private/tmp/render-pipeline-smoke';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],rows=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.stack||String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.goto(new URL('?lite&playtest&level=codex-lab',base).href);await ready();
 await page.waitForFunction(()=>window.__game.player.grounded);
 const start=await page.evaluate(()=>window.__game.player.pos.toArray());
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');
 const moved=await page.evaluate(()=>window.__game.player.pos.toArray());
 assert.ok(Math.hypot(...start.map((n,i)=>n-moved[i]))>.2,'real input moves supported player');
 assert.equal(await page.evaluate(()=>{const g=window.__game;return g.player.warpCheckpoint(g.getLevel(),1);}),true);
 await page.waitForTimeout(300);
 const deaths=await page.evaluate(()=>{const g=window.__game,p=g.player,n={lives:p.lives,deaths:p.totalDeaths};p.pos.y=g.getLevel().killY-3;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';return n;});
 await page.waitForFunction(n=>{const p=window.__game.player;return (p.lives<n.lives||p.totalDeaths>n.deaths)&&p.grounded;},deaths,{timeout:15000});
 await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();const position=l.finishGlow.getCenter(p.pos.clone());p.respawn(l,true,false,{position,heading:p.camDir.clone()});p.snapRenderInterpolation();});
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:10000});
 rows.push({test:'lite traversal/checkpoint/pit/finish',passed:true});
 for(const id of ['sky','treehouse-trail','warproom','beachfront']){
  console.log('Full render',id);
  await page.goto(new URL(`?playtest&level=${id}`,base).href);await ready();
  await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();});await page.waitForTimeout(2000);
  rows.push(await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,worldMatricesAutomatic:g.scene.matrixWorldAutoUpdate,frame:g.getRenderFrameStats(),water:g.getLevel().water?.stats??null,memory:{...g.renderer.info.memory},contextLost:g.renderer.getContext().isContextLost()};}));
  assert.equal(rows.at(-1).worldMatricesAutomatic,true);assert.equal(rows.at(-1).contextLost,false);
  assert.ok(rows.at(-1).frame.calls>1,'diagnostics cover the complete frame');
  if(id==='warproom'||id==='beachfront')
   assert.ok(rows.at(-1).water.primaryReuseRenders>0,'real ocean levels use the shared opaque surface');
  await page.screenshot({path:`${output}/${id}.png`});
  if(id==='sky'){
   await page.evaluate(()=>window.__game.crtGuestSettings.setEnabled(true));
   await page.waitForFunction(()=>window.__game.getCrtDiagnostics()?.active);
   assert.equal(await page.evaluate(()=>window.__game.getCrtDiagnostics().lastDrawCount),10,'gameplay fuses the final CRT stages');
   const kernel=await page.evaluate(()=>window.__game.getSkinBoundsKernelDiagnostics());
   assert.equal(kernel.status,'ready');assert.ok(kernel.calls>0);assert.ok(kernel.workspaceBytes<=kernel.maxWorkspaceBytes);
   const batch=await page.evaluate(()=>window.__game.player.characterRenderBatchDiagnostics);
   assert.ok(batch.savedDrawsPerPass>=31,'authored character surfaces use fewer draws');
   await page.screenshot({path:`${output}/sky-crt.png`});
   await page.keyboard.press('KeyP');await page.waitForFunction(()=>window.__game.gameFlow.blocksGameplay);
   await page.keyboard.press('KeyP');await ready();
   await page.evaluate(()=>window.__game.crtGuestSettings.setEnabled(false));await page.waitForTimeout(300);
   const hidden=await page.evaluate(async()=>{
    const g=window.__game;let hidden=true;
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});document.dispatchEvent(new Event('visibilitychange'));
    const before=g.frameStats.totalFixedSteps;await new Promise(r=>setTimeout(r,400));
    const after=g.frameStats.totalFixedSteps;hidden=false;document.dispatchEvent(new Event('visibilitychange'));
    delete document.hidden;return {before,after};
   });assert.equal(hidden.before,hidden.after,'hidden time does not advance simulation');
   await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.__game.frameStats.simSteps<=1),'resume has no catch-up burst');
   await page.evaluate(()=>window.__game.set2P(true,true));await page.waitForTimeout(1200);
   assert.equal(await page.evaluate(()=>!!window.__game.getP2()),true);
   await page.screenshot({path:`${output}/split.png`});
   await page.evaluate(()=>window.__game.set2P(false,true));await page.waitForTimeout(500);
   await page.evaluate(()=>window.__game.renderQualitySettings.setEnabled(false));await page.waitForTimeout(500);
   await page.evaluate(()=>window.__game.renderQualitySettings.setEnabled(true));await page.waitForTimeout(500);
  }
 }
 const visits=[];
 for(const id of ['sky','warproom','sky','warproom','sky','warproom']){
  await page.evaluate(async id=>{const g=window.__game;await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('level switch failed');g.gameFlow.hide();});},id);
  await ready();await page.waitForTimeout(1200);
  visits.push(await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,memory:{...g.renderer.info.memory},water:g.getLevel().water?.stats??null};}));
 }
 for(const id of ['sky','warproom']){
  const repeated=visits.filter(v=>v.id===id);
  assert.ok(repeated.at(-1).memory.textures<=repeated.at(-2).memory.textures+1,`${id} texture residency stays bounded`);
  assert.ok(repeated.at(-1).memory.geometries<=repeated.at(-2).memory.geometries+1,`${id} geometry residency stays bounded`);
 }
 rows.push({test:'repeated level transitions',visits});
 // Actual WebGL loss/restoration exercises targets, shadows and timing reset.
 for(let round=1;round<=3;round++){
  const recovery=await page.evaluate(async()=>{
   const g=window.__game,ext=g.renderer.getContext().getExtension('WEBGL_lose_context');
   if(!ext)return {supported:false};
   ext.loseContext();await new Promise(r=>setTimeout(r,250));const held=g.frameStats.totalFixedSteps;
   await new Promise(r=>setTimeout(r,250));const after=g.frameStats.totalFixedSteps;ext.restoreContext();
   return {supported:true,held,after};
  });if(recovery.supported)assert.equal(recovery.held,recovery.after);
  await page.waitForFunction(()=>!window.__game.renderer.getContext().isContextLost(),null,{timeout:30000});await page.waitForTimeout(2000);
  rows.push({test:'graphics recovery',round,...recovery});
 }
 await context.close();
 const touchContext=await browser.newContext({viewport:{width:852,height:393},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const touch=await touchContext.newPage();
 touch.on('pageerror',e=>errors.push(e.stack||String(e)));touch.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await touch.goto(new URL('?touch&playtest&level=sky',base).href);
 await touch.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await touch.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(540);g.crtGuestSettings.setEnabled(true);});
 await touch.waitForFunction(()=>window.__game.getCrtDiagnostics()?.lastDrawCount===10);
 const pause=await touch.locator('.tc-pause').boundingBox();assert.ok(pause);
 await touch.touchscreen.tap(pause.x+pause.width/2,pause.y+pause.height/2);
 await touch.waitForFunction(()=>window.__game.gameFlow.blocksGameplay);
 await touch.screenshot({path:`${output}/touch-pause.png`});
 await touch.keyboard.press('KeyP');
 await touch.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
 await touch.waitForTimeout(500);
 rows.push(await touch.evaluate(()=>{const g=window.__game;return {test:'touch 540p CRT pause/resume',canvas:[g.renderer.domElement.width,g.renderer.domElement.height],crtDraws:g.getCrtDiagnostics().lastDrawCount,kernel:g.getSkinBoundsKernelDiagnostics(),batches:g.player.characterRenderBatchDiagnostics};}));
 assert.equal(rows.at(-1).canvas[1],540);assert.equal(rows.at(-1).crtDraws,10);
 await touch.screenshot({path:`${output}/touch-play.png`});
 assert.deepEqual(errors,[]);
 console.log('PASS full/lite world rendering, traversal, checkpoint, respawn, finish, pause, split, sizing, suspension and graphics recovery');
}finally{
 const page=browser.contexts()[0]?.pages()[0];
 let finalState=null;
 if(page){
  finalState=await page.evaluate(()=>{const g=window.__game;return g?{id:g.getCurrentLevel().id,state:g.player.state,position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,screen:g.gameFlow.currentScreen,loading:g.gameFlow.loadingPhase,frame:g.frameStats}:null;}).catch(()=>null);
  await page.screenshot({path:`${output}/last-state.png`}).catch(()=>{});
 }
 await writeFile(`${output}/report.json`,JSON.stringify({base,rows,errors,finalState},null,2));await browser.close();
}
