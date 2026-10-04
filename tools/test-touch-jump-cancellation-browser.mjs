import assert from 'node:assert/strict';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine=process.env.TOUCH_BROWSER==='webkit'?webkit:chromium;
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.TOUCH_OUTPUT || '/private/tmp/touch-jump-cancellation';
const base=process.argv[2] || 'http://127.0.0.1:5194/';await mkdir(output,{recursive:true});
const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})}),report={cases:[],errors:[]};
try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`${base}?touch&playtest&level=codex-lab&lite`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&!document.body.classList.contains('game-startup-loading'),null,{timeout:120000});
 const cdp=engine===chromium?await context.newCDPSession(page):null;
 for(const type of ['normal-lift','touch-cancel','blur','rotation','pause-resume']) {
  await page.evaluate(()=>{const g=window.__game;g.input.touch.releaseAll(true);g.input.armMenuReleaseGuard();g.player.respawn(g.getLevel());});
  await page.waitForFunction(()=>window.__game.player.grounded&&!window.__game.input.menuReleaseGuard);
  const jump=await page.locator('[data-touch-button="x"]').boundingBox();
  await page.evaluate(()=>{
    const p=window.__game.player;window.__interruptionPeak=p.pos.y;window.__interruptionBase=p.pos.y;window.__trackInterruption=true;
    const sample=()=>{if(!window.__trackInterruption)return;window.__interruptionPeak=Math.max(window.__interruptionPeak,p.pos.y);requestAnimationFrame(sample);};sample();
  });
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:jump.x+jump.width/2,y:jump.y+jump.height/2}]});
  else await page.evaluate(r=>document.querySelector('.tc-right').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:777,clientX:r.x+r.width/2,clientY:r.y+r.height/2})),jump);
  await page.waitForFunction(()=>window.__game.player.charging&&window.__game.input.jumpHeld);
  await page.waitForTimeout(120);
  const before=await page.evaluate(()=>({held:window.__touch.jumpHeld,charging:window.__game.player.charging,charge:window.__game.player.chargeTimer}));
  if(type==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  if(type==='rotation')await page.setViewportSize({width:844,height:390});
  if(type==='pause-resume') {
   await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'Codex Geometry Lab',inWarpRoom:false}));
   await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
  }
  if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:type==='touch-cancel'?'touchCancel':'touchEnd',touchPoints:[]});
  else await page.evaluate(type=>window.dispatchEvent(new PointerEvent(type==='touch-cancel'?'pointercancel':'pointerup',{pointerId:777})),type);
  if(type==='pause-resume') {
   await page.getByRole('button',{name:'RESUME',exact:true}).tap();
   await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
  }
  await page.waitForTimeout(900);
  const after=await page.evaluate(()=>{window.__trackInterruption=false;const p=window.__game.player;return {held:window.__touch.jumpHeld,charging:p.charging,charge:p.chargeTimer,height:p.pos.y,base:window.__interruptionBase,peak:window.__interruptionPeak,state:p.state};});
  assert.equal(after.held,false); assert.equal(after.charging,false); assert.equal(after.charge,0);
  if(type==='normal-lift')assert.ok(after.peak-after.base>.25,'ordinary lift no longer jumps');
  else assert.ok(after.peak-after.base<.05,'interruption launches the player');
  report.cases.push({type,before,after});
  if(type==='rotation')await page.setViewportSize({width:390,height:844});
 }
 assert.deepEqual(report.errors,[]);console.log('PASS ordinary lift, native cancellation and blur through real Input/Player: interrupted charges stay grounded');
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
