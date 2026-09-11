import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{pathToFileURL}from'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.MENU_TEST_URL||'http://127.0.0.1:5178/',out=process.env.MENU_TEST_OUT||'/private/tmp/menu-focus-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={errors:[],modes:[]};
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{
   localStorage.setItem('solProtoRooAppearanceV4',JSON.stringify({tracking:-.065,shimmer:false,lightStrength:1}));
   window.menuPad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:1,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
   Object.defineProperty(navigator,'getGamepads',{value:()=>[window.menuPad]});
  });
  await page.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));await page.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.evaluate(()=>window.__game.gameFlow.showLaunch());await page.waitForFunction(()=>document.querySelector('.game-menu-button.selected [data-roo-menu][data-ready]'));await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
  async function capture(white,name){
   await page.waitForFunction(white=>document.body.classList.contains('menu-focus-white')===white && performance.now()%900 >= (white?450:0) && performance.now()%900 < (white?540:90),white);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const state=await page.evaluate(()=>{
    const f=window.__game.gameFlow,c=f.gameFlowSurface.resources.canvas,ctx=c.getContext('2d'),panel=document.querySelector('.game-shell'),root=panel.getBoundingClientRect();
    return {phase:document.body.classList.contains('menu-focus-white'),buttons:[...panel.querySelectorAll('.game-menu-list .game-menu-button')].map(button=>{
     const r=button.getBoundingClientRect(),sx=c.width/root.width,sy=c.height/root.height,pixels=ctx.getImageData(Math.round(r.x*sx),Math.round(r.y*sy),Math.round(r.width*sx),Math.round(r.height*sy)).data;
     let hash=0,solid=0;const mean=[0,0,0];for(const v of pixels)hash=Math.imul(hash,31)+v|0;for(let p=0;p<pixels.length;p+=4)if(pixels[p+3]>240){solid++;for(let c=0;c<3;c++)mean[c]+=pixels[p+c];}for(let c=0;c<3;c++)mean[c]/=Math.max(1,solid);
     return {text:button.textContent,hash,mean,solid,color:getComputedStyle(button).color,marker:getComputedStyle(button,'::before').display,shadow:getComputedStyle(button).boxShadow,outline:getComputedStyle(button).outlineStyle};
    })};
   });
   assert.equal(state.phase,white);
   await page.screenshot({path:`${out}/${name}-${lite?'lite':'full'}.png`});
   return state;
  }
  const orange=await capture(false,'launch-orange'),white=await capture(true,'launch-white');
  assert.notEqual(orange.buttons[0].hash,white.buttons[0].hash,'Focused text did not flash with glimmer paused');
  // Opaque letter pixels exclude the backdrop and GPU/CPU gradient readback rounding.
  for(let c=0;c<3;c++)assert.ok(Math.abs(orange.buttons[1].mean[c]-white.buttons[1].mean[c])<1,'Unselected ink changed with focus flash');
  assert.ok(white.buttons[0].mean[2]>orange.buttons[0].mean[2]+60,'White flash is not visibly different from orange');
  for(const b of white.buttons){assert.equal(b.marker,'none');assert.equal(b.shadow,'none');assert.equal(b.outline,'none');}
  await page.evaluate(()=>{window.menuPad.buttons[13]={pressed:true,touched:true,value:1};window.menuPad.timestamp++;});
  await page.waitForFunction(()=>document.querySelector('.game-menu-button.selected')?.textContent==='LOAD GAME');
  await page.evaluate(()=>{window.menuPad.buttons[13]={pressed:false,touched:false,value:0};window.menuPad.timestamp++;});
  assert.equal(await page.locator('.game-menu-button.selected').textContent(),'LOAD GAME');
  await page.screenshot({path:`${out}/controller-moved-${lite?'lite':'full'}.png`});
  const pixels=await page.evaluate(()=>{
   const p=window.__game.gameFlow.gameFlowSurface.rooAtlas,c=document.createElement('canvas');c.width=700;c.height=160;const ctx=c.getContext('2d',{willReadFrequently:true});
   const draw=ink=>{ctx.clearRect(0,0,c.width,c.height);p.draw(ctx,'NEW GAME',350,80,{size:90,palette:'counter',lightPosition:0,ink,align:'center'});return ctx.getImageData(0,0,c.width,c.height).data;};
   const original=draw(),tan=draw('tan'),white=draw('white'),restored=draw();let alphaError=0,sourceErrors=0,tanChanged=0,whiteChanged=0;
   for(let i=0;i<original.length;i++){if(i%4===3)alphaError=Math.max(alphaError,Math.abs(original[i]-tan[i]),Math.abs(original[i]-white[i]));else{tanChanged+=Number(original[i]!==tan[i]);whiteChanged+=Number(original[i]!==white[i]);}sourceErrors+=Number(original[i]!==restored[i]);}
   return{alphaError,sourceErrors,tanChanged,whiteChanged};
  });
  assert.equal(pixels.alphaError,0);assert.equal(pixels.sourceErrors,0);assert.ok(pixels.tanChanged>1000&&pixels.whiteChanged>1000);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(550);assert.equal(await page.evaluate(()=>document.body.classList.contains('menu-focus-white')),false);
  const fixed=await page.locator('.game-menu-button.selected').evaluate(e=>getComputedStyle(e).color);await page.waitForTimeout(600);assert.equal(await page.locator('.game-menu-button.selected').evaluate(e=>getComputedStyle(e).color),fixed);
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const screen of ['pause','options','level-select','save-load']){
   await page.evaluate(screen=>{window.__game.campaign.newGame(1);const f=window.__game.gameFlow;if(screen==='pause')f.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});else f.showMapSection(screen);},screen);
   await page.waitForTimeout(250);await page.screenshot({path:`${out}/${screen}-${lite?'lite':'full'}.png`});
   const marker=await page.locator('.game-menu-button.selected').evaluate(e=>({arrow:getComputedStyle(e,'::before').display,shadow:getComputedStyle(e).boxShadow,outline:getComputedStyle(e).outlineStyle}));
   assert.equal(marker.arrow,'none');assert.equal(marker.shadow,'none');assert.equal(marker.outline,'none');
  }
  // The rollback switch lives solely in M-dismissible authoring chrome.
  await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false}));await page.keyboard.press('KeyM');await page.locator('.secondary-text-tuner summary').click();
  await page.locator('[data-menu-text-focus]').uncheck();assert.equal(await page.evaluate(()=>document.body.classList.contains('menu-text-focus-enabled')),false);
  await page.waitForFunction(()=>document.querySelector('.game-pause-actions .game-menu-button .roo-text-svg image')?.getAttribute('href')?.includes('roo-bonus-v9'));
  await page.locator('[data-menu-text-focus]').check();await page.waitForFunction(()=>document.querySelector('.game-pause-actions .game-menu-button .roo-text-svg image')?.getAttribute('href')?.includes('roo-counter-v9'));
  await page.keyboard.press('KeyM');assert.equal(await page.locator('.secondary-text-tuner').isVisible(),false);
  await page.evaluate(()=>window.__game.gameFlow.hide());await page.waitForTimeout(100);
  const idlePhase=await page.evaluate(()=>document.body.classList.contains('menu-focus-white'));await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>document.body.classList.contains('menu-focus-white')),idlePhase,'Focus clock continued after menus closed');
  report.modes.push({lite,pixels,orange,white});await page.close();
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log('Passed controller focus, orange/white pixels, static tan siblings, zero-alpha/source changes, reduced motion, rollback and stopped idle clock in lite/full rendering.');
}finally{await browser.close();}
