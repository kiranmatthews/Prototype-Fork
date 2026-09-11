import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/',out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v8-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={errors:[],menus:[]};
try{
 for(const lite of [true,false]){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const game=await context.newPage();game.on('pageerror',e=>report.errors.push(e.message));game.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await game.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));await game.waitForFunction(()=>window.__game?.gameFlow,null,{timeout:90000});
  await game.evaluate(()=>window.__game.gameFlow.showLaunch());await game.waitForFunction(()=>document.querySelectorAll('.game-shell [data-roo-menu][data-ready]').length>=3);
  await game.waitForTimeout(300);await game.screenshot({path:out+`/launch-${lite?'lite':'full'}.png`});
  for(const screen of ['pause','options','level-select','progress','save-load']){
   await game.evaluate(screen=>{const flow=window.__game.gameFlow;if(screen==='pause')flow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});else flow.showMapSection(screen);},screen);
   await game.waitForTimeout(450);
   assert.ok(await game.locator('.game-shell [data-roo-menu][data-ready]').count()>2,screen);
   for(const [width,height]of [[1280,720],[1920,1080],[1024,768],[390,844],[844,390]]){
    await game.setViewportSize({width,height});await game.waitForTimeout(180);
    const state=await game.evaluate(()=>({root:document.querySelector('.game-shell-panel').getBoundingClientRect().toJSON(),pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,labels:[...document.querySelectorAll('.game-shell [data-roo-menu][data-ready]')].map(e=>({text:e.querySelector('.roo-menu-source').textContent,rect:e.getBoundingClientRect().toJSON()}))}));
    assert.ok(state.pageWidth<=state.viewport+1,`${screen} makes the page scroll horizontally`);
    await game.screenshot({path:out+`/menu-${screen}-${lite?'lite':'full'}-${width}x${height}.png`});
    report.menus.push({screen,lite,width,height,labels:state.labels.length});
   }
   await game.setViewportSize({width:1280,height:720});
  }
  await game.evaluate(()=>window.__game.gameFlow.showLaunch());await game.waitForTimeout(250);
  const title=game.locator('.game-logo .roo-text-svg');const before=await title.getAttribute('viewBox');
  const lab=await context.newPage();await lab.goto(base+'roo-type-lab.html');await lab.waitForFunction(()=>window.rooTypeLab?.ready);
  await lab.locator('#tracking-number').fill('-.1');await lab.locator('#tracking-number').dispatchEvent('change');
  await game.waitForTimeout(200);assert.notEqual(await title.getAttribute('viewBox'),before,'spacing did not update the other game tab');
  await lab.reload();await lab.waitForFunction(()=>window.rooTypeLab?.ready);assert.equal(await lab.locator('#tracking-number').inputValue(),'-0.1');
  await lab.locator('#reset-spacing').click();await lab.close();
  await game.bringToFront();await game.emulateMedia({reducedMotion:'reduce'});
  await game.waitForFunction(()=>[...document.querySelectorAll('.game-logo .roo-text-svg>g>g')].map(e=>e.getAttribute('opacity')).join(',')==='1,0,0',null,{timeout:5000});
  const weights=await title.locator(':scope >g>g').evaluateAll(es=>es.map(e=>e.getAttribute('opacity')));assert.deepEqual(weights,['1','0','0']);
  await game.emulateMedia({reducedMotion:'no-preference'});await game.waitForTimeout(1000);
  const moving=await title.locator(':scope >g>g').evaluateAll(es=>es.map(e=>Number(e.getAttribute('opacity'))));assert.ok(moving.some((w,i)=>i>0&&w>0));assert.ok(Math.abs(moving.reduce((a,b)=>a+b,0)-1)<1e-8);
  for(const level of ['jungle-cup','warproom']){
   const screen=await context.newPage();screen.on('pageerror',e=>report.errors.push(e.message));
   await screen.goto(base+'?playtest&level='+level+(lite?'&lite':''));await screen.waitForFunction(()=>window.__game?.ui?.gameHudDiagnostics?.rooAtlasReady,null,{timeout:90000});
   if(level==='jungle-cup')await screen.waitForFunction(()=>document.querySelector('.competition-host [data-roo-menu][data-ready]'));
   await screen.waitForTimeout(1000);await screen.screenshot({path:out+`/menu-${level}-${lite?'lite':'full'}.png`});await screen.close();
  }
  await context.close();console.log('Menu layouts, shared spacing, saved controls and reduced motion passed for '+(lite?'lite':'full')+'.');
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(out+'/menus-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors:report.errors,menuChecks:report.menus.length}));
}finally{await browser.close();}
