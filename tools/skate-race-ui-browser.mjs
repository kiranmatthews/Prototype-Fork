import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5228';
const output=process.env.RACE_UI_OUTPUT||'/private/tmp/skate-race-shared-ui';await mkdir(output,{recursive:true});
const source=await readFile(new URL('../src/race/hud.ts',import.meta.url),'utf8');
assert.ok(!/fillText|strokeText|RooAtlasPainter|font-size:|ctx\.font/.test(source),'race UI must reuse the shared text renderer');
const browser=await chromium.launch({headless:true,channel:'chrome'});const errors=[],reports=[];
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:1280,height:720},hasTouch:touch,isMobile:touch,serviceWorkers:'block'}),page=await context.newPage();
  await page.addInitScript(()=>{
   window.raceItemDraws=[];const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    const src=image.currentSrc||image.src||'';
    if(src.includes('/race-items/')&&args.length===4){window.raceItemDraws.push({src,natural:[image.naturalWidth,image.naturalHeight],draw:[args[2],args[3]]});if(window.raceItemDraws.length>120)window.raceItemDraws.shift();}
    return original.call(this,image,...args);
   };
  });
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}/?${process.env.RACE_UI_FULL?'':'lite&'}playtest&level=slipstream-race`,{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  for(const [w,h] of touch?[[390,844],[844,390]]:[[1920,1080],[1280,720],[1024,768],[390,844],[844,390]]){
   await page.setViewportSize({width:w,height:h});
   for(const screen of ['grid','result','trial','running','empty']){
    await page.evaluate(screen=>{const g=window.__game,r=g.getSkateRace();r.reset(screen==='trial'?'time-trial':'race');
     if(screen==='running'||screen==='empty'){r.phase='running';r.riders[0].item=screen==='running'?'red-shell':null;}
     else if(screen!=='grid'){r.phase='finished';r.riders.slice(0,r.count).forEach((a,i)=>{a.finish=160+i*2;a.progress=r.course.length;});if(screen==='result')r.level.crates.filter(c=>!c.mystery).forEach(c=>r.riders[0].boxes.add(c));}
    },screen);
    await page.waitForTimeout(350);
    await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&!document.querySelector('.race-interface').hidden,null,{timeout:180000});
    const report=await page.evaluate(()=>{const root=document.querySelector('.race-interface'),content=root.querySelector('.comp-content'),rect=content?.getBoundingClientRect();return {
      footers:root.querySelectorAll('.game-menu-hints').length,shared:root.classList.contains('competition-host'),roo:root.querySelectorAll('[data-roo-menu]').length,hints:root.querySelectorAll('.game-control-hint .input-glyph').length,
      overflow:content?content.scrollHeight-content.clientHeight:0,contentBottom:rect?.bottom,tableBottom:root.querySelector('.comp-table-wrap')?.getBoundingClientRect().bottom,
      rows:[...root.querySelectorAll('tbody tr')].map(r=>({bottom:r.getBoundingClientRect().bottom,top:r.getBoundingClientRect().top})),
      buttons:[...root.querySelectorAll('.comp-actions button,[data-race-action="item"]')].filter(b=>b.getClientRects().length>0).map(b=>({name:b.textContent,box:{x:b.getBoundingClientRect().x,y:b.getBoundingClientRect().y,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}})),
      rewards:[...root.querySelectorAll('.game-reward-slot')].map(e=>({kind:e.dataset.reward,earned:e.dataset.earned,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),
      native:window.__game.ui?.raceHud?.diagnostics??null};});
    await page.screenshot({path:`${output}/${touch?'touch':'desktop'}-${w}x${h}-${screen}.png`});
    assert.equal(report.shared,true);assert.ok(report.roo>0);assert.equal(report.hints,screen==='running'?1:0);assert.equal(report.footers,0);
    assert.ok(report.overflow<=3,`${touch?'touch':'desktop'} ${w}x${h} ${screen}: content overflow ${report.overflow}`);
    for(const row of report.rows)assert.ok(row.bottom<=Math.min(report.contentBottom,report.tableBottom)+2,'standings row clipped');
    for(const b of report.buttons){assert.ok(b.box.x>=0&&b.box.y>=0&&b.box.x+b.box.w<=w+1&&b.box.y+b.box.h<=h+1);if(touch)assert.ok(b.box.h>=47.5);}
    for(const slot of report.rewards)assert.ok(slot.w>15&&slot.h>15,'shared reward model has no usable slot');
    reports.push({touch,w,h,screen,...report});
   }
  }
  await page.setViewportSize(touch?{width:390,height:844}:{width:1280,height:720});
  for(const kind of ['banana','green-shell','red-shell','blue-shell','shock-shell','mushroom','shield','horn','water-bomb','boomerang','star','tidal-wave']){
   await page.evaluate(kind=>{const r=window.__game.getSkateRace();r.reset('race');r.phase='running';r.riders[0].item=kind;window.raceItemDraws=[];},kind);
   await page.waitForTimeout(350);
   const drawings=await page.evaluate(()=>window.raceItemDraws);
   assert.ok(drawings.some(d=>d.src.endsWith('/'+kind+'.webp')),'The actual shared painter must draw the item picture');
   assert.ok(drawings.every(d=>Math.abs(d.draw[0]/d.draw[1]-d.natural[0]/d.natural[1])<.001),'Item pictures must retain their proportions on the canvas path');
   const button=page.locator('[data-race-action="item"]');assert.equal(await button.isVisible(),true);assert.equal(await button.isEnabled(),true);
   const text=await button.innerText();assert.ok(!/banana|shell|mushroom|shield|bolt|turbo/i.test(text),'Item names must not replace their pictures');
   const box=await button.boundingBox();assert.ok(box&&box.width>=48&&box.height>=48);
   await page.screenshot({path:`${output}/${touch?'touch':'desktop'}-item-${kind}.png`,clip:{x:box.x,y:box.y,width:box.width,height:box.height}});
   await button.click();await page.waitForFunction(()=>!window.__game.getSkateRace().riders[0].item);
   await button.waitFor({state:'hidden'});assert.equal(await page.locator('.race-interface .input-glyph').count(),0);
   reports.push({touch,screen:'item',kind,pictureOnly:true,usable:true});
  }
  await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>window.__game.getSkateRace().reset('race'));await page.waitForTimeout(200);
  await page.getByRole('button',{name:'TIME TRIAL',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().mode==='time-trial');
  await page.evaluate(()=>window.__game.switchLevel('flats'));await page.waitForFunction(()=>!window.__game.getSkateRace().active);
  assert.equal(await page.locator('.race-interface').isVisible(),false);
  await page.evaluate(()=>window.__game.switchLevel('slipstream-race'));await page.waitForFunction(()=>window.__game.getSkateRace().active);
  assert.equal(await page.evaluate(()=>window.__game.getSkateRace().riders.length),8);
  await context.close();
 }
 await writeFile(output+'/report.json',JSON.stringify({reports,errors},null,2));assert.deepEqual(errors,[]);console.log(`PASS ${reports.length} shared-UI viewport states, real trial activation and race/ordinary-level switching`);
}finally{await browser.close();}
