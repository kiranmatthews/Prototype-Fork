import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5201/';
const out=process.env.COMPETITION_CLOCK_OUTPUT||'/private/tmp/competition-clock-mobile';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],checks=[];
try{
 for(const [id,width,height,lite,mobile]of [
  ['jungle-cup',320,568,true,true],['waterpark-cup',390,844,true,true],['jungle-cup',844,390,true,true],
  ['waterpark-cup',844,390,false,true],['jungle-cup',390,844,false,true],['jungle-cup',1280,720,true,false],
 ]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base+'?playtest&level='+id+(lite?'&lite':''));await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__game.getCompetition().phase==='running');
  // Hold presentation samples at regulation, urgent and overtime. Gameplay
  // rules are covered separately; this review exercises the actual DOM/CRT.
  await page.evaluate(()=>{window.__game.getCompetition().stepRun=()=>false;});
  for(const phase of ['normal','urgent','overtime']){
   await page.evaluate(phase=>{const e=window.__game.getCompetition();e.remaining=phase==='normal'?60:phase==='urgent'?8:0;e.overtime=phase==='overtime';e.finalComboActive=e.overtime;},phase);
   await page.waitForTimeout(250);
   const layout=await page.evaluate(()=>{
    const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const clock=document.querySelector('.comp-run-hud'),style=getComputedStyle(clock),time=clock.querySelector('strong');
    return{clock:box(clock),pause:box(document.querySelector('.tc-pause')),face:box(document.querySelector('.hud-life-face-wrap')),text:clock.textContent,
     background:style.backgroundColor,border:style.borderTopWidth,font:parseFloat(getComputedStyle(time).fontSize),composited:document.querySelector('.competition-host').hasAttribute('data-precrt-composited'),surface:window.__game.competitionUI.diagnostics};
   });
   assert.equal(layout.background,'rgba(0, 0, 0, 0)');assert.equal(parseFloat(layout.border),0);assert.ok(lite||layout.composited,JSON.stringify({id,width,height,lite,phase,layout}));
   assert.ok(layout.clock.x>=0&&layout.clock.y>=0&&layout.clock.right<width&&layout.clock.bottom<height*.2);
   assert.ok(layout.clock.width<150&&layout.clock.height<40&&layout.font<=(mobile?24:28));
   assert.ok(layout.clock.x<width*.28,'Clock remained centered');
   if(mobile){assert.ok(layout.clock.x>=layout.pause.right+7,'Clock overlaps Pause');assert.ok(layout.clock.right<layout.face.x,'Clock overlaps portrait');}
   if(phase==='overtime')assert.match(layout.text,/FINAL COMBO/);
   checks.push({id,width,height,lite,phase,...layout});
   if(phase==='normal'||phase==='overtime')await page.screenshot({path:`${out}/${id}-${width}x${height}-${lite?'lite':'full'}-${phase}.png`});
  }
  if(mobile){await page.locator('.tc-pause').tap();await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');}
  await context.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS compact, unboxed corner clocks in both Cups, portrait/landscape, urgency/overtime, native CRT and unobstructed mobile Pause.');
}finally{await writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
