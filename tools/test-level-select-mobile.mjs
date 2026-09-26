// Real touch hit targets and scrolling, including the pre-CRT mirror.
// PLAYWRIGHT_MODULE may point to an installed Playwright index.mjs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5173/';
const output=process.env.LEVEL_SELECT_OUTPUT||'/private/tmp/level-select-mobile-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],checks=[];
try{
 for(const lite of [true,false]){
  for(const [width,height]of(lite?[[320,568],[390,844],[568,320],[667,375],[844,390],[768,1024]]:[[390,844],[844,390]])){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  // CDP touch/wheel hit testing also uses Chrome's native content window.
  const windowSession=await context.newCDPSession(page);
  const {windowId}=await windowSession.send('Browser.getWindowForTarget');
  await windowSession.send('Browser.setWindowBounds',{windowId,bounds:{width:Math.max(1200,width+100),height:Math.max(1400,height+200)}});
  await windowSession.detach();
  await page.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.evaluate(()=>{
   const g=window.__game;g.campaign.startEphemeral();
   // Unlock the whole list in memory so every visible row is an active hit target.
   for(const key of ['treehouse-trail','jungle','test-course','sky-bridge','nightworks','codex-switchback','slipstream','jungle-cup','beachside-run','coastal','chimeworks','island-hopper','jungle-gate'])g.campaign.active.levels[key]={cleared:true};
   g.gameFlow.showMapSection('level-select');
  });
   // Use each phone's real screen metrics, not a resized landscape emulation.
   await page.evaluate(()=>{const f=window.__game.gameFlow;f.levelSelectKey='treehouse-trail';f.levelSelectIsland='island-1';f.render();});
   await page.waitForTimeout(400);
   const state=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const list=document.querySelector('.game-level-list'),panel=document.querySelector('.game-shell-panel');
    return {family:document.body.dataset.promptFamily,list:rect(list),scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,panelScroll:[panel.scrollTop,panel.scrollLeft],pageWidth:document.documentElement.scrollWidth,
     rows:[...document.querySelectorAll('.game-level-row')].map(rect),fixed:[...document.querySelectorAll('.game-level-header,.game-level-preview,.game-level-detail,.game-map-close')].map(rect),
     arrows:[...document.querySelectorAll('.game-island-arrow')].map(rect),close:rect(document.querySelector('.game-map-close'))};
   });
   assert.equal(state.family,'touch');assert.ok(state.pageWidth<=width);
   assert.deepEqual(state.panelScroll,[0,0]);
   for(const r of [...state.fixed,state.list])assert.ok(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,`fixed segment outside ${width}x${height}: ${JSON.stringify(r)}`);
   for(const r of [...state.rows,...state.arrows])assert.ok(r.height>=44&&r.width>=44,`small tap target ${width}x${height}: ${JSON.stringify(r)}`);
   for(const r of state.arrows)assert.ok(r.right<=state.close.x||r.x>=state.close.right||r.bottom<=state.close.y||r.y>=state.close.bottom,'island and close targets overlap');
   if(width<height)assert.ok(state.list.width>=width-40,'portrait list must use the screen width');
   if(state.scrollHeight>state.clientHeight+1){
    const cdp=await context.newCDPSession(page),x=state.list.x+state.list.width/2,from=state.list.bottom-20,to=state.list.y+20;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
    for(let i=1;i<=12;i++){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/12}]});await page.waitForTimeout(40);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'level-select','swipe launched a level');
    assert.ok(await page.locator('.game-level-list').evaluate(e=>e.scrollTop)>0,'touch drag did not scroll the list');
   }
   await page.locator('[data-level-key="jungle-cup"]').evaluate(e=>e.scrollIntoView({block:'nearest'}));
   await page.waitForTimeout(150);
   assert.deepEqual(await page.locator('.game-shell-panel').evaluate(e=>[e.scrollTop,e.scrollLeft]),[0,0],'scrolling levels moved the whole menu');
   const mirror=await page.evaluate(()=>{
    const f=window.__game.gameFlow,s=f.gameFlowSurface.readState(),list=document.querySelector('.game-level-list').getBoundingClientRect();
    const rows=s.buttons.filter(b=>b.kind==='level');
    return {composited:!!document.querySelector('.game-shell.precrt-composited'),clipped:rows.every(b=>b.rect.clip&&b.rect.clip.y>=list.top-1&&b.rect.clip.y+b.rect.clip.height<=list.bottom+1),lastVisible:rows.some(b=>b.label.includes('JUNGLE CUP'))};
   });
   assert.deepEqual(mirror,{composited:true,clipped:true,lastVisible:true});
   await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}.png`});
   await page.getByRole('button',{name:'Next island',exact:true}).tap();
   await page.waitForFunction(()=>document.querySelector('.game-level-select-layout')?.dataset.island==='island-2');
   await page.getByRole('button',{name:'Previous island',exact:true}).tap();
   await page.waitForFunction(()=>document.querySelector('.game-level-select-layout')?.dataset.island==='island-1');
   checks.push({lite,width,height,minimumRowHeight:Math.min(...state.rows.map(r=>r.height)),mirror});
  if(width===390||width===844){
  // A real tap follows the normal host callback and enters the chosen course.
  await page.locator('[data-level-key="treehouse-trail"]').tap();
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='treehouse-trail'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'Treehouse Trail',inWarpRoom:false}));
  await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).tap();
  await page.locator('[data-level-key="treehouse-trail"]').tap();
  await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='confirm-level-select');
  await page.getByRole('button',{name:'CANCEL',exact:true}).tap();
  await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='level-select');
  await page.getByRole('button',{name:'Back',exact:true}).filter({visible:true}).tap();
  await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
  }
  await context.close();
  }
  console.log(`PASS ${lite?'lite':'full'} touch layout, swiping, island paging, launch and cancellation.`);
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(output+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
