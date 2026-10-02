// Cold startup and actual loading ownership, with deliberately slow assets/GPU
// preparation. PLAYWRIGHT_MODULE may point to a locally installed runtime.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MENU_BROWSER||'chromium';
const base=process.argv[2]||'http://127.0.0.1:5199/';
const output=process.env.MENU_LOADING_OUTPUT||'/private/tmp/menu-loading-review';
await mkdir(output,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
const rows=[],errors=[];
const timeout=Number(process.env.MENU_LOADING_TIMEOUT||120000);
try{
 for(const lite of [true,false]){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await context.addInitScript(()=>{
   window.__menuStartup=[];
   const sample=()=>{
    const g=window.__game;
    if(g&&g.gameFlow.currentScreen==='launch'){
     const root=document.querySelector('.game-shell'),r=root?.getBoundingClientRect(),s=root&&getComputedStyle(root);
     const covered=g.gameFlow.startupLoading||document.body.classList.contains('game-shell-transitioning');
     const visible=!!r?.width&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&!covered;
     if(visible)window.__menuStartup.push({ready:g.getFontDiagnostics().ready,pending:document.querySelectorAll('.game-shell [data-roo-menu]:not([data-ready])').length,loading:g.gameFlow.loadingPhase});
    }
    if(window.__menuStartup.length<120)requestAnimationFrame(sample);
   };
   requestAnimationFrame(sample);
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // Delay the neutral atlas and both real fonts. No fallback title should be
  // exposed while they are arriving, including on the native DOM path.
  await page.route(/\/(fonts\/roo-counter-v[^/]*\.png|[^/]*\.(woff2?|ttf|otf))(\?.*)?$/,async route=>{
   await new Promise(resolve=>setTimeout(resolve,500));await route.continue();
  });
  await page.goto(base+'?'+(lite?'lite':''));
  await page.waitForFunction(lite=>window.__game&&(lite||window.__game.gameFlow.currentScreen==='launch')&&!window.__game.gameFlow.startupLoading&&!window.__game.gameFlow.loadingPhase,lite,{timeout}).catch(async error=>{
   const failed=await page.evaluate(()=>({screen:window.__game?.gameFlow.currentScreen,loading:window.__game?.getLoadingDiagnostics(),font:window.__game?.getFontDiagnostics(),pending:document.querySelectorAll('[data-roo-menu-pending]').length,report:localStorage.getItem('solProtoStabilityV1')}));
   rows.push({failed});console.log(JSON.stringify(failed));throw error;
  });
  if(lite)await page.evaluate(async()=>{window.__game.gameFlow.showLaunch();await window.__game.gameFlow.prepareMenuPresentation();});
  await page.waitForTimeout(300);
  const startup=await page.evaluate(()=>({samples:window.__menuStartup,font:window.__game.getFontDiagnostics(),labels:document.querySelectorAll('.game-shell [data-roo-menu][data-ready]').length,pending:document.querySelectorAll('.game-shell [data-roo-menu]:not([data-ready])').length,loading:window.__game.getLoadingDiagnostics()}));
  assert.ok(startup.samples.length>0,'title never became visible');
  assert.ok(startup.samples.every(s=>s.ready&&s.pending===0&&!s.loading),'title exposed fallback/pending font ink');
  assert.equal(startup.pending,0);assert.ok(startup.labels>=4);assert.deepEqual(startup.loading.pending,[]);
  await page.screenshot({path:`${output}/${engine}-${lite?'lite':'full'}-cold-title.png`});
  // Exercise real destination preparation, prolonging both assets and GPU
  // warmup separately. The animated loading field must own both waits.
  await page.evaluate(()=>{
   const f=window.__game.gameFlow;
   for(const [key,stage]of [['waitForDestinationAssets','assets'],['warmDestinationFrame','warm'],['prepareDestinationFrame','final']]){
    const original=f.callbacks[key];
    if(typeof original!=='function')throw Error('Missing readiness hook '+key);
    f.callbacks[key]=async()=>{window.__delayedStage=stage;await new Promise(resolve=>setTimeout(resolve,1500));await original();};
   }
   window.__menuTransition=f.transition(()=>{const g=window.__game;if(!g.switchLevel('treehouse-trail'))throw Error('Switch failed');f.hide();});
  });
  for(const stage of ['assets','warm','final']){
   await page.waitForFunction(stage=>window.__delayedStage===stage,stage,{timeout:120000});
   await page.waitForTimeout(250);
   const loading=await page.evaluate(async()=>{
    const {sampleInputPrompts}=await import('./src/inputPromptUI.ts');
    const g=window.__game,p=sampleInputPrompts();
    const curtain=document.querySelector('.game-transition-curtain'),held=curtain.querySelector('canvas');
    if(held)window.__heldLoadingFrame=held;
    let coloured=0;
    if(held){const pixels=held.getContext('2d').getImageData(0,0,held.width,held.height).data;for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>45&&pixels[i+3]>200)coloured++;}
    return {phase:g.gameFlow.loadingPhase,context:g.gameFlow.vortexContext,hidden:document.body.classList.contains('game-shell-transitioning'),glyphs:p.glyphs.length,words:p.words.length,curtain:getComputedStyle(curtain).backgroundColor,holding:curtain.classList.contains('holding-loading-frame'),heldPixels:held?held.width*held.height:0,coloured};
   });
   if(stage==='final'){
    assert.equal(loading.phase,'prepare-destination');assert.equal(loading.holding,true);
    assert.ok(loading.heldPixels>0&&loading.coloured/loading.heldPixels>.3,'the retained loader is empty or black');
   }else{
    assert.equal(loading.context,'warp');assert.equal(loading.hidden,true);
    assert.equal(loading.glyphs,0);assert.equal(loading.words,0);
    assert.ok(loading.curtain.includes('0.16'),'loading artwork is hidden behind solid black');
    if(stage==='warm')assert.equal(loading.phase,'warm-destination');
   }
   await page.screenshot({path:`${output}/${engine}-${lite?'lite':'full'}-slow-${stage}.png`});
   rows.push({lite,stage,...loading});
  }
  await page.evaluate(()=>window.__menuTransition);
  const destination=await page.evaluate(()=>({level:window.__game.getCurrentLevel().id,loading:window.__game.getLoadingDiagnostics(),events:JSON.parse(localStorage.getItem('solProtoStabilityV1')).sessions.at(-1).events,blocked:window.__game.gameFlow.blocksGameplay,heldSize:[window.__heldLoadingFrame?.width,window.__heldLoadingFrame?.height]}));
  assert.equal(destination.level,'treehouse-trail');assert.equal(destination.blocked,false);assert.deepEqual(destination.loading.pending,[]);assert.deepEqual(destination.loading.failed,[]);
  assert.deepEqual(destination.heldSize,[1,1],'completed transitions must release their fullscreen loading raster');
  const warm=destination.events.findLast(e=>e.stage==='destination:scene-warmup');
  assert.equal(warm.detail.loading,'warm-destination','expensive GPU work must happen while the loading artwork is visible');
  assert.ok(destination.events.some(e=>e.stage==='destination:ready'));
  await page.screenshot({path:`${output}/${engine}-${lite?'lite':'full'}-destination.png`});
  rows.push({lite,startup,destination});await context.close();
 }
 // An optional shimmer image failure must leave readable PNG lettering. A
 // neutral image remains the visual source, never a half-published font set.
 const context=await browser.newContext({viewport:{width:568,height:320},isMobile:true,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route(/\/fonts\/roo-counter-v[^/]*-light1[^/]*\.png$/,route=>route.abort());
 await page.goto(base);
 await page.waitForFunction(()=>window.__game?.gameFlow.currentScreen==='launch'&&!window.__game.gameFlow.startupLoading,null,{timeout:120000});
 const degraded=await page.evaluate(()=>({font:window.__game.getFontDiagnostics(),pending:document.querySelectorAll('.game-shell [data-roo-menu]:not([data-ready])').length,labels:document.querySelectorAll('.game-shell [data-roo-menu][data-ready]').length}));
 assert.equal(degraded.font.ready,true);assert.equal(degraded.pending,0);assert.ok(degraded.labels>=4);
 await page.screenshot({path:`${output}/${engine}-missing-light.png`});rows.push({degraded});await context.close();
 assert.deepEqual(errors,[]);console.log('PASS cold delayed-font startup, single ready title, visible loader through delayed assets/GPU warmup, no stale hints, destination readiness, lite/full and failed shimmer image.');
}finally{await writeFile(`${output}/${engine}.json`,JSON.stringify({base,rows,errors},null,2));await browser.close();}
