// Production controls/Input in native DOM, without a WebGL startup dependency.
// Especially useful for WebKit event/gesture validation and physical devices.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine=process.env.TOUCH_BROWSER==='webkit'?webkit:chromium;
const base=process.argv[2] || 'http://127.0.0.1:5194/';
const output=process.env.TOUCH_OUTPUT || '/private/tmp/touch-native-browser';
await mkdir(output,{recursive:true});
const browser=await engine.launch({headless:true,...(engine===chromium?{channel:'chrome'}:{})});
const errors=[],checks=[];
try {
  for(const [width,height] of [[320,568],[568,320],[390,844],[844,390],[768,1024],[1024,768]]) {
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${base}touch-controls-review.html`,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForFunction(()=>window.__touchReview?.frames>2,null,{timeout:60000});
    const layout=await page.locator('.tc-btn,.tc-trigger,.tc-arrow,.tc-pause').evaluateAll(els=>els.map(e=>{
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,action:s.touchAction};
    }));
    assert.equal(layout.length,11);
    for(const r of layout) {assert.ok(r.w>=48&&r.h>=48);assert.ok(r.x>=8&&r.y>=0&&r.right<=width-8&&r.bottom<=height-10);assert.equal(r.action,'none');}
    await page.screenshot({path:`${output}/${width}x${height}-native.png`});
    await page.evaluate(()=>window.__touchReview.clear());
    await page.getByRole('button',{name:'Jump',exact:true}).tap();
    await page.waitForFunction(()=>window.__touchReview.samples.some(s=>s.jumpReleased));
    let samples=await page.evaluate(()=>window.__touchReview.samples);
    assert.ok(samples.some(s=>s.jumpPressed)); assert.ok(samples.some(s=>s.jumpReleased));
    assert.equal(await page.getByRole('button',{name:'Jump',exact:true}).getAttribute('aria-pressed'),'false');
    // Actual compositor CSS hides DOM ink while retaining its hit targets.
    await page.evaluate(()=>{window.__touchReview.clear();window.__touchReview.setComposited(true);});
    await page.getByRole('button',{name:'Jump',exact:true}).tap();
    await page.waitForFunction(()=>window.__touchReview.samples.some(s=>s.jumpReleased));
    assert.ok(await page.evaluate(()=>window.__touchReview.samples.some(s=>s.jumpPressed)));
    await page.evaluate(()=>window.__touchReview.setComposited(false));
    await page.evaluate(()=>window.__touchReview.clear());
    await page.getByRole('button',{name:'Transfer',exact:true}).tap();
    await page.waitForFunction(()=>window.__touchReview.samples.some(s=>s.transferPressed));
    await page.getByRole('button',{name:'Inventory',exact:true}).tap();
    await page.waitForFunction(()=>window.__touchReview.samples.some(s=>s.inventoryHeld));
    // Per-contact ownership and release routing use real browser propagation.
    const sequence=await page.evaluate(()=>{
      const t=window.__touch,z=document.querySelector('.tc-right'),l=document.querySelector('.tc-left'),r=document.querySelector('.tc-pad').getBoundingClientRect();
      const fire=(el,type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1}));
      const b=key=>{const r=document.querySelector(`[data-touch-button="${key}"]`).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];};
      fire(l,'pointerdown',401,r.x+r.width/2,r.y+20);fire(z,'pointerdown',402,...b('x'));fire(z,'pointerdown',403,...b('tri'));
      const held=[t.moveY,t.jumpHeld,t.grindHeld];fire(window,'pointerup',402,...b('x'));
      const partial=[t.moveY,t.jumpHeld,t.grindHeld];fire(window,'pointercancel',403,...b('tri'));fire(window,'pointerup',401,r.x,r.y);
      const neutral=[t.moveX,t.moveY,t.jumpHeld,t.grindHeld];
      const blocked=()=>[t.moveX,t.moveY,t.jumpHeld,t.grindHeld,t.transferActive(),t.inventoryActive()];
      fire(z,'pointerdown',404,...b('x'));document.body.classList.add('game-shell-modal');t.beginFrame();
      const menu=blocked();document.body.classList.remove('game-shell-modal');
      fire(window,'pointermove',404,...b('tri'));const stale=blocked();
      const gesture=new Event('gesturestart',{bubbles:true,cancelable:true});z.dispatchEvent(gesture);
      const context=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});z.dispatchEvent(context);
      fire(z,'pointerdown',405,...b('x'));window.dispatchEvent(new Event('blur'));const blur=blocked();
      return {held,partial,neutral,menu,stale,blur,gesturePrevented:gesture.defaultPrevented,contextPrevented:context.defaultPrevented};
    });
    assert.deepEqual(sequence.held,[1,true,true]);assert.deepEqual(sequence.partial,[1,false,true]);assert.deepEqual(sequence.neutral,[0,0,false,false]);
    for(const key of ['menu','stale','blur'])assert.deepEqual(sequence[key],[0,0,false,false,false,false]);
    assert.equal(sequence.gesturePrevented,true);assert.equal(sequence.contextPrevented,true);
    await page.setViewportSize({width:height,height:width});
    await page.waitForFunction(()=>window.__touchReview.frames>5);
    assert.deepEqual(await page.evaluate(()=>[window.__touch.moveX,window.__touch.moveY,window.__touch.jumpHeld,scrollX,scrollY,visualViewport.scale]),[0,0,false,0,0,1]);
    checks.push({width,height,engine:engine===webkit?'webkit':'chromium',targets:layout.length,sequence});
    console.log(`PASS native ${engine===webkit?'WebKit':'Chrome'} ${width}x${height}: touch taps, edge preservation, three contacts, gestures, modal/blur and rotation`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
} finally {await writeFile(`${output}/report.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
