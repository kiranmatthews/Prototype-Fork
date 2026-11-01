import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5187/';
const out=process.env.MAP_CLOUD_OUTPUT||'/private/tmp/map-sky-clouds';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,cases:[]};
try{
 for(const mode of (process.env.MAP_CLOUD_CASES||'lite,native').split(',')){
  const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[],requests=[];
  page.setDefaultTimeout(180000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(r.url().includes('cloud-bank.png'))requests.push(r.url());});
  const result={mode,errors,matteRequests:requests,views:[]};report.cases.push(result);
  try{
   await page.goto(new URL('?playtest&level=warproom'+(mode==='lite'?'&lite':''),base).href,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
   result.stamp=await page.locator('.hud-build').textContent();assert.match(result.stamp,/Codex\/sol fork/);
   const focus=async key=>{
    await page.evaluate(async key=>{const g=window.__game;
     for(const p of Object.values(g.campaign.active.levels))Object.assign(p,{cleared:true,crystal:true,boxGem:true,timeMedal:'gold',cup:true,raceWon:true});
     g.campaign.setMapFocus(key);g.switchLevel('warproom');await g.getLevel().prepareJungleAssets();
     g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
    },key);
    await page.waitForFunction(key=>window.__game.getWorldMapDiagnostics().selected===key&&window.__game.cloudPathPass.diagnostics.clouds===18,key);
   };
   const snapshot=()=>page.evaluate(()=>{const g=window.__game,clouds=[];g.scene.traverse(o=>{if(o.userData.mapCloudVolume)clouds.push(o);});
    return {selected:g.getWorldMapDiagnostics().selected,clouds:clouds.length,textures:new Set(clouds.map(o=>o.material.uniforms.uVolume.value)).size,
     pass:g.cloudPathPass.diagnostics,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],water:g.getLevel().water?{...g.getLevel().water.stats}:null,
     graphics:g.renderer.domElement.dataset.graphicsState};});
   await focus('quagmire-boss');const before=await snapshot();
   await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>window.__game.getWorldMapDiagnostics().moving);
   await page.waitForTimeout(650);if(mode==='native')await page.screenshot({path:out+'/island-pan-native.png'});
   await page.waitForFunction(()=>window.__game.getWorldMapDiagnostics().selected==='secret-1'&&!window.__game.getWorldMapDiagnostics().moving);
   result.pan={before,after:await snapshot()};
   for(const key of ['secret-1','secret-4','secret-5','secret-8']){
    if(key!=='secret-1')await focus(key);
    await page.waitForTimeout(700);const state=await snapshot();result.views.push(state);
    assert.equal(state.clouds,18);assert.equal(state.textures,3);assert.equal(state.pass.height,360);
    assert.deepEqual(state.canvas,mode==='lite'?[800,500]:[1600,1000]);
    await page.screenshot({path:`${out}/${key}-${mode}.png`});
   }
   if(mode==='native'){
    await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
    await page.waitForTimeout(650);result.normal=await snapshot();assert.equal(result.normal.pass.height,360);
    await page.screenshot({path:out+'/secret-8-normal.png'});
    await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(650);
    result.portrait=await snapshot();assert.equal(result.portrait.pass.height,360);await page.screenshot({path:out+'/secret-portrait.png'});
    await page.setViewportSize({width:1600,height:1000});
   }
   // Compare actual rendered-frame pacing at the same native scene setting.
   if(process.argv.includes('--timing')&&mode==='native'){
    result.pacing=[];
    for(const low of [true,false,false,true]){
     await page.evaluate(low=>window.__game.cloudPathPass.enabled=low,low);await page.waitForTimeout(600);
     const sample=await page.evaluate(async low=>{const g=window.__game,start=performance.now(),frame=g.frameStats.frame;await new Promise(r=>setTimeout(r,3000));const ms=performance.now()-start;return {low,frames:g.frameStats.frame-frame,ms,fps:(g.frameStats.frame-frame)*1000/ms};},low);
     result.pacing.push(sample);
    }
    await page.evaluate(()=>window.__game.cloudPathPass.enabled=true);
   }
   await page.evaluate(()=>{const g=window.__game,clouds=[];g.scene.traverse(o=>{if(o.userData.mapCloudVolume)clouds.push(o);});const textures=new Set(clouds.map(o=>o.material.uniforms.uVolume.value));window.__mapCloudDisposed=0;for(const t of textures)t.addEventListener('dispose',()=>window.__mapCloudDisposed++);g.switchLevel('codex-lab');});
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&window.__game.cloudPathPass.diagnostics.targetBytes===0);
   result.exit=await snapshot();result.disposed=await page.evaluate(()=>window.__mapCloudDisposed);assert.equal(result.disposed,3);assert.equal(result.exit.clouds,0);
   assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
   console.log(JSON.stringify(result));
  }finally{await page.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
 }
}finally{await browser.close();}
