// Real input, hit targets, gestures, lifecycle and pre-CRT/native presentation.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TOUCH_BROWSER === 'webkit' ? webkit : chromium;
const base = process.argv[2] || 'http://127.0.0.1:5194/';
const output = process.env.TOUCH_OUTPUT || '/private/tmp/touch-controls-browser';
await mkdir(output, { recursive: true });
const browser = await engine.launch({ headless: true, ...(engine === chromium ? { channel: 'chrome' } : {}) });
const errors = [], checks = [];
const profiles = process.env.TOUCH_PROFILE ? process.env.TOUCH_PROFILE.split(',').map(s => s.split('x').map(Number)) : [[320,568],[568,320],[390,844],[844,390],[768,1024],[1024,768]];
try {
  for (const lite of process.env.TOUCH_RENDER === 'lite' ? [true] : process.env.TOUCH_RENDER === 'full' ? [false] : [true, false]) {
    for (const [width, height] of lite ? profiles : profiles.filter(([w,h]) => Math.min(w,h) === 390)) {
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: engine === chromium ? 2 : 1 });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__touchEvents = [];
        for (const type of ['pointerdown','pointerup','pointercancel','lostpointercapture','blur','resize','touchend']) {
          window.addEventListener(type,e=>{
            window.__touchEvents.push({type,id:e.pointerId,primary:e.isPrimary,x:e.clientX,y:e.clientY,target:e.target?.className,body:document.body?.className});
            if(window.__touchEvents.length>40) window.__touchEvents.shift();
          },true);
        }
      });
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      // Chromium's offscreen window otherwise clamps some emulated sizes.
      const cdp = engine === chromium ? await context.newCDPSession(page) : null;
      if (cdp) {
        const { windowId } = await cdp.send('Browser.getWindowForTarget');
        await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: 1200, height: 1400 } });
      }
      await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && !document.body.classList.contains('game-startup-loading'), null, { timeout: 120000 });
      let idleCache = null;
      if (!lite) {
        await page.waitForTimeout(400);
        const before=await page.evaluate(()=>window.__game.getInterfaceSurfaceDiagnostics().surface);
        await page.waitForFunction(n=>window.__game.getInterfaceSurfaceDiagnostics().surface.compositeDraws>=n+6,before.compositeDraws,{timeout:60000});
        const after=await page.evaluate(()=>window.__game.getInterfaceSurfaceDiagnostics().surface);
        assert.ok(after.compositeDraws>before.compositeDraws,'full-render frame graph did not advance');
        assert.equal(after.textureUploads,before.textureUploads,'idle touch controls upload their texture every frame');
        idleCache={frames:after.compositeDraws-before.compositeDraws,uploads:after.textureUploads-before.textureUploads};
      }
      const layout = await page.evaluate(() => {
        const box = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
        const nodes = [...document.querySelectorAll('.tc-arrow,.tc-btn,.tc-trigger,.tc-pause')];
        const centers = Object.fromEntries([...document.querySelectorAll('[data-touch-button],[data-touch-trigger]')].map(e => {
          const r = e.getBoundingClientRect(); return [e.dataset.touchButton || e.dataset.touchTrigger, {x:r.x+r.width/2,y:r.y+r.height/2}];
        }));
        return { enabled: window.__touch.enabled, pageWidth: document.documentElement.scrollWidth,
          targets: nodes.map(e => ({ ...box(e), label:e.getAttribute('aria-label')||e.textContent, touchAction:getComputedStyle(e).touchAction, backdrop:getComputedStyle(e).backdropFilter })),
          pad: box(document.querySelector('.tc-pad')), cluster: box(document.querySelector('.tc-cluster')), centers };
      });
      assert.equal(layout.enabled, true, 'real touch context is not detected');
      assert.equal(layout.pageWidth, width);
      for (const r of layout.targets) {
        assert.ok(r.width >= 48 && r.height >= 48, 'small touch target: ' + JSON.stringify(r));
        assert.ok(r.x >= 8 && r.y >= 0 && r.right <= width-8 && r.bottom <= height-10, 'unsafe target: ' + JSON.stringify(r));
        assert.equal(r.touchAction, 'none'); assert.equal(r.backdrop, 'none');
      }
      assert.ok(layout.pad.right + 15 <= layout.cluster.x, 'thumb controls overlap');
      await page.screenshot({ path: `${output}/${lite?'lite':'full'}-${width}x${height}-idle.png` });
      const state = () => page.evaluate(() => {
        const t = window.__touch, i = window.__game.input;
        return {move:[t.moveX,t.moveY],look:[t.lookX,t.lookY],held:[t.jumpHeld,t.grabHeld,t.spinHeld,t.grindHeld],
          transfer:t.transferActive(),inventory:t.inventoryActive(),inputMove:[i.moveX,i.moveY],
          owners:t.rightTouches.size+t.triggerTouches.size+(t.padPointer!==null)+(t.lookPointer!==null),
          page:[scrollX,scrollY],zoom:visualViewport?.scale,selection:getSelection()?.toString(),
          highlighted:[...document.querySelectorAll('.tc-btn.on,.tc-arrow.on')].length};
      });
      const neutral = async () => {
        const s = await state(); assert.deepEqual(s.move,[0,0]); assert.deepEqual(s.look,[0,0]);
        assert.deepEqual(s.held,[false,false,false,false]); assert.equal(s.transfer,false); assert.equal(s.owners,0); assert.equal(s.highlighted,0);
      };
      // Edge accumulation runs synchronously before RAF/fixed-step can poll.
      const edges = await page.evaluate(({x,transfer}) => {
        const t=window.__touch,i=window.__game.input;
        const fire=(el,type,id,c)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,clientX:c.x,clientY:c.y,button:0,buttons:type==='pointerup'?0:1}));
        i.consumeEdges();
        fire(document.querySelector('.tc-right'),'pointerdown',901,x); fire(window,'pointerup',901,x);
        i.update(); const tap={press:i.jumpPressed,release:i.jumpReleased,held:i.jumpHeld}; i.consumeEdges(); i.update();
        const consumed=!i.jumpPressed&&!i.jumpReleased;
        fire(document.querySelector('[data-touch-trigger="transfer"]'),'pointerdown',902,transfer); fire(window,'pointerup',902,transfer);
        i.update(); const trigger={press:i.transferPressed,held:i.transferHeld}; i.consumeEdges(); i.update();
        return {tap,consumed,trigger,triggerConsumed:!i.transferPressed,touchMove:[t.moveX,t.moveY]};
      }, {x:layout.centers.x,transfer:layout.centers.transfer});
      assert.deepEqual(edges.tap,{press:true,release:true,held:false}); assert.equal(edges.consumed,true);
      assert.deepEqual(edges.trigger,{press:true,held:false}); assert.equal(edges.triggerConsumed,true);
      // Actual touch input; three independently owned contacts across zones.
      if (cdp) {
        const point = (id,x,y) => ({id,x,y,radiusX:8,radiusY:8,force:1});
        const padX = layout.pad.x+layout.pad.width/2, padY = layout.pad.y+24;
        const p1=point(1,padX,padY),p2=point(2,layout.centers.x.x,layout.centers.x.y),p3=point(3,layout.centers.tri.x,layout.centers.tri.y);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2,p3]});
        let s=await state(); assert.deepEqual(s.move,[0,1]); assert.deepEqual(s.held,[true,false,false,true]);
        await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-held.png`});
        const heldBounds=await page.locator('.tc-btn,.tc-arrow').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
        const stable=layout.targets.filter(r=>r.label!=='Pause game'&&!r.label?.includes('Inventory')&&!r.label?.includes('Transfer')).map(r=>[r.x,r.y,r.width,r.height]);
        assert.deepEqual(heldBounds,stable,'pressed state moves a hit target');
        // Lift only Jump while the movement and grind fingers remain.
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p2]});
        s=await state(); assert.deepEqual(s.move,[0,1]); assert.deepEqual(s.held,[false,false,false,true]);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,padX+layout.pad.width/2,padY+layout.pad.height/2),p3]});
        s=await state(); assert.equal(s.move[0],1);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await neutral();
        // Capture failure and propagation stops: window capture still routes.
        await page.evaluate(()=>{window.__captureOriginal=Element.prototype.setPointerCapture;Element.prototype.setPointerCapture=function(){throw new DOMException('capture unavailable');};});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,width-24,height/2),p2]});
        s=await state(); assert.equal(s.move[0],1); assert.equal(s.held[0],true);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await neutral();
        await page.evaluate(()=>{Element.prototype.setPointerCapture=window.__captureOriginal;});
        // A real upward swipe retains the shoulder pulse, while pinches and
        // repeated taps cannot scroll, select text or zoom the gameplay page.
        const emptyX=width>height?width/2+24:width-26,emptyY=height*(width>height?.60:.40);
        await page.evaluate(()=>{
          window.__swipeObserved=false;
          window.__observeSwipe=()=>{window.__swipeObserved ||= window.__touch.transferActive();};
          window.addEventListener('pointermove',window.__observeSwipe,{capture:true});
        });
        const swipeTime=Date.now()/1000;
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',timestamp:swipeTime,touchPoints:[point(1,emptyX,emptyY)]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',timestamp:swipeTime+.1,touchPoints:[point(1,emptyX,emptyY-90)]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        assert.equal(await page.evaluate(()=>{window.removeEventListener('pointermove',window.__observeSwipe,true);return window.__swipeObserved;}),true,'legacy flick does not reach Transfer');
        await page.waitForTimeout(480); await neutral();
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(1,width*.25,height*.25),point(2,width*.7,height*.25)]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(1,width*.1,height*.1),point(2,width*.9,height*.1)]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const zoom=await state(); assert.deepEqual(zoom.page,[0,0]); assert.equal(zoom.zoom,1); assert.equal(zoom.selection,'');
      }
      // Mode/lifecycle coverage in both engines uses production listeners.
      await page.evaluate(({x})=>{
        const z=document.querySelector('.tc-right');
        for(const type of ['pointercancel','lostpointercapture']) {
          z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:903,clientX:x.x,clientY:x.y}));
          window.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:903}));
          if(window.__touch.jumpHeld) throw Error(type+' retained Jump');
        }
        for(const type of ['blur','pagehide','orientationchange']) {
          z.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',pointerId:904,clientX:x.x,clientY:x.y}));
          window.dispatchEvent(new Event(type));
          if(window.__touch.jumpHeld) throw Error(type+' retained Jump');
        }
      },{x:layout.centers.x});
      await neutral();
      // Actual Pause hit, fixed menu controls, then normal resume.
      await page.locator('.tc-pause').tap();
      await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
      assert.equal(await page.locator('.tc-right').isVisible(),false);
      await page.getByRole('button',{name:'RESUME',exact:true}).tap();
      await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay); await neutral();
      await page.evaluate(()=>{
        window.__inventoryObserved=false;
        window.__observeInventory=()=>{window.__inventoryObserved ||= window.__touch.inventoryActive();};
        window.addEventListener('pointerup',window.__observeInventory);
      });
      await page.locator('[data-touch-trigger="inventory"]').tap();
      assert.equal(await page.evaluate(()=>{window.removeEventListener('pointerup',window.__observeInventory);return window.__inventoryObserved;}),true);
      await page.waitForTimeout(480);
      // Production Bonus HUD fixture: each readout must clear the controls,
      // title and the other readouts at compact and portrait aspect ratios.
      await page.evaluate(()=>{const g=window.__game;g.getLevel().hudMode='bonus';g.ui.setLevel(g.getCurrentLevel().id,'bonus');});
      await page.waitForFunction(()=>document.querySelector('.game-hud-layer').classList.contains('hud-bonus'));
      await page.waitForTimeout(700);
      const bonus=await page.evaluate(()=>{
        const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
        return {rows:[...document.querySelectorAll('.hud-bonus .hud-fruit-row,.hud-bonus .hud-crate-row,.hud-bonus .hud-life-row')].map(box),
          fixed:[...document.querySelectorAll('.tc-pause,.tc-trigger,.hud-bonus-title')].map(box)};
      });
      const overlaps=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
      for(const [i,row] of bonus.rows.entries()) {
        assert.ok(row.x>=0&&row.y>=0&&row.right<=width+1&&row.bottom<=height+1,'offscreen Bonus counter');
        for(const fixed of [...bonus.fixed,...bonus.rows.slice(i+1)]) assert.equal(overlaps(row,fixed),false,'Bonus counter overlaps another readout or a control');
      }
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-bonus.png`});
      // Rotate this same page with a held finger. No stale ownership survives.
      await page.evaluate(x=>document.querySelector('.tc-right').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:905,clientX:x.x,clientY:x.y})),layout.centers.x);
      await page.setViewportSize({width:height,height:width}); await neutral();
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-rotated.png`});
      checks.push({lite,width,height,engine:engine===chromium?'chromium':'webkit',targets:layout.targets.length,edges,idleCache,bonus});
      console.log(`PASS ${lite?'lite':'full'} touch controls ${width}x${height}: targets, multi-contact input, fast edges, gestures, interrupts, Pause/resume and rotation`);
      await context.close();
    }
  }
  assert.deepEqual(errors,[]);
} catch (error) {
  const page=browser.contexts().flatMap(c=>c.pages()).at(-1);
  if(page) {
    console.log('Failure state:',await page.evaluate(()=>({body:document.body.className,screen:window.__game?.gameFlow.currentScreen,events:window.__touchEvents,move:[window.__touch?.moveX,window.__touch?.moveY],held:window.__touch?.jumpHeld,viewport:[innerWidth,innerHeight,visualViewport?.scale],level:window.__game?.getCurrentLevel().id})).catch(()=>null));
    await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  }
  throw error;
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify({checks,errors},null,2));
  await browser.close();
}
