import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5188/';
const output=process.env.STABILITY_OUTPUT||'/private/tmp/prototype-stability-qa';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:852,height:393},isMobile:true,hasTouch:true,deviceScaleFactor:3});
 await context.addInitScript(()=>{performance.setResourceTimingBufferSize(5000);const Original=Worker;window.__workers={live:0,peak:0};window.Worker=class extends Original{constructor(...args){super(...args);window.__workers.peak=Math.max(window.__workers.peak,++window.__workers.live);}terminate(){window.__workers.live--;super.terminate();}};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?lite&playtest&level=codex-lab');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 assert.equal(await page.evaluate(async()=>!!await navigator.serviceWorker.getRegistration()),false);
 const start=await page.evaluate(()=>window.__game.player.pos.toArray());await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
 const end=await page.evaluate(()=>window.__game.player.pos.toArray());assert.ok(Math.hypot(...start.map((n,i)=>n-end[i]))>.2);
 assert.equal(await page.evaluate(()=>{const g=window.__game;return g.player.warpCheckpoint(g.getLevel(),1);}),true);
 await page.goto(base+'?playtest&level=treehouse-trail');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 assert.equal(await page.evaluate(()=>window.__game.getFontDiagnostics().cap),128);
 assert.equal(await page.evaluate(()=>window.__game.getFontDiagnostics().decodedBytes),12435456);
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/fonts\/roo-.*\.png/.test(e.name)&&!e.name.includes('-cap128')).length),0,'phone never downloads full-size font masters');
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.enable');
 for(const id of ['treehouse-trail','jungle','jungle-cup','sky','test','warproom','treehouse-trail','sky','treehouse-trail','sky','treehouse-trail','sky']){
  await page.evaluate(async id=>{const g=window.__game;await g.gameFlow.transition(()=>{assertSwitch(g.switchLevel(id));g.gameFlow.hide();});function assertSwitch(ok){if(!ok)throw Error('switch failed');}},id);
  await page.waitForTimeout(6000);await cdp.send('HeapProfiler.collectGarbage');
  const sample=await page.evaluate(async()=>{
   const g=window.__game,l=g.getLevel();let levelMs=0,ticks=0;const old=l.update;
   l.update=function(...args){const t=performance.now();try{return old.apply(this,args);}finally{levelMs+=performance.now()-t;ticks++;}};
   await new Promise(resolve=>setTimeout(resolve,1500));l.update=old;
   return {id:g.getCurrentLevel().id,levelMsPerTick:levelMs/Math.max(1,ticks),ticks,font:g.getFontDiagnostics(),decoder:g.getSceneryDecoderDiagnostics(),workers:window.__workers,memory:{...g.renderer.info.memory},loading:g.getLoadingDiagnostics(),contextLost:g.renderer.getContext().isContextLost()};
  });
  sample.heap=await cdp.send('Runtime.getHeapUsage');rows.push(sample);assert.equal(sample.contextLost,false);assert.equal(sample.decoder.workers,0,'idle decoder heaps are retired');assert.equal(sample.workers.peak,1,'scenery uses one shared worker');assert.deepEqual(sample.loading.failed,[]);console.log(id,JSON.stringify(sample));
  if(id==='treehouse-trail'){
   await page.screenshot({path:output+'/phone-treehouse.png'});
   await page.evaluate(()=>{const g=window.__game;g.player.state='finished';g.showCampaignResults();});
   await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='results'&&!window.__game.gameFlow.loadingPhase,null,{timeout:120000});
  }
 }
 const sky=rows.filter(r=>r.id==='sky');assert.ok(sky.at(-1).memory.textures<=sky.at(-2).memory.textures+1,'return visits have bounded texture residency');
 // Artwork selection follows physical screen size; graphics options are untouched.
 await page.setViewportSize({width:1024,height:1366});
 await page.waitForFunction(()=>window.__game.getFontDiagnostics().cap===512,null,{timeout:60000});
 await page.setViewportSize({width:852,height:393});
 await page.waitForFunction(()=>window.__game.getFontDiagnostics().cap===128,null,{timeout:60000});
 await context.close();
 for(const profile of [{name:'ipad',viewport:{width:1024,height:1366},deviceScaleFactor:2,cap:256},{name:'tv4k',viewport:{width:3840,height:2160},deviceScaleFactor:1,cap:512}]){
  const p=await browser.newPage({viewport:profile.viewport,deviceScaleFactor:profile.deviceScaleFactor});p.on('pageerror',e=>errors.push(String(e)));
  await p.goto(base+'?lite&playtest&level=sky');await p.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await p.waitForFunction(()=>window.__game.getFontDiagnostics().decodedBytes>0);
  const font=await p.evaluate(()=>window.__game.getFontDiagnostics());assert.equal(font.cap,profile.cap);assert.equal(font.decodedBytes,profile.cap===256?49717248:198868992);rows.push({display:profile.name,font});
  await p.evaluate(()=>window.__game.gameFlow.showLaunch());await p.waitForTimeout(600);await p.screenshot({path:output+'/'+profile.name+'-home.png'});
  const clips=await p.locator('.game-menu-button').evaluateAll(buttons=>buttons.filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&(r.top<0||r.bottom>innerHeight||r.left<0||r.right>innerWidth);}).map(b=>b.textContent));assert.deepEqual(clips,[]);
  await p.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS touch traversal, repeated real transitions/results, one retired decoder, bounded memory, phone/iPad/4K font selection, full render and clean console.');
}finally{await writeFile(output+'/report.json',JSON.stringify({base,rows,errors},null,2));await browser.close();}
