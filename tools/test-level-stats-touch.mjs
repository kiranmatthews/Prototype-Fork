// Real map entry and hybrid touch/controller regression; no persisted saves.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.TOUCH_BROWSER === 'webkit' ? webkit : chromium;
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const output = process.env.LEVEL_STATS_OUTPUT || '/private/tmp/level-stats-touch-review';
await mkdir(output, {recursive:true});
const browser = await engine.launch({headless:true, ...(engine === chromium ? {channel:'chrome'} : {})});
const errors = [], checks = [];
try {
  for (const lite of [true, false]) {
    for (const [width,height] of (lite ? [[320,568],[390,844],[568,320],[844,390]] : [[390,844],[844,390]])) {
      const context = await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
      if(engine === chromium) {
        const cdp = await context.newCDPSession(page);
        const {windowId} = await cdp.send('Browser.getWindowForTarget');
        await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width:1200,height:1400}});
        await cdp.detach();
      }
      await page.goto(`${base}?playtest&level=warproom${lite ? '&lite' : ''}`);
      await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, {timeout:120000});
      await page.evaluate(() => {
        const g = window.__game; g.campaign.startEphemeral();
        for(const progress of Object.values(g.campaign.active.levels)) progress.cleared = true;
      });
      const stats = page.locator('.world-map-action').filter({hasText:'LEVEL STATS'});
      assert.equal(await stats.count(), 1);
      // The hit target has to work from the real map, not an injected modal.
      await stats.tap();
      await page.waitForFunction(() => window.__game.gameFlow.currentScreen === 'level-select');
      assert.equal(await page.locator('.game-shell').getAttribute('aria-label'), 'Level stats');
      await page.evaluate(() => {
        const f = window.__game.gameFlow;
        window.__statsSelects = []; window.__statsSelect = f.callbacks.onLevelSelect;
        f.callbacks.onLevelSelect = id => window.__statsSelects.push(id);
      });
      for(const family of [null, 'keyboard', 'ps5']) {
        await page.locator('.game-map-close').tap();
        await page.evaluate(family => {
          const g=window.__game;
          g.input.touch.enabled=family!=='keyboard';
          g.inputPrompts.setHostFamily(family==='keyboard'?null:family);
          g.inputPrompts.update(null,family!=='keyboard');
        }, family);
        await page.waitForTimeout(250);
        const mapTargets=await page.locator('.world-map-action').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return {label:button.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
        for(const r of mapTargets) assert.ok(r.x>=0 && r.y>=0 && r.right<=width+1 && r.bottom<=height+1 && r.width>=48 && r.height>=48, `offscreen map action ${width}×${height}, ${family ?? 'touch'}: ${JSON.stringify(r)}`);
        await stats.tap();
        await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='level-select');
        const state = await page.evaluate(() => {
          const box = e => { const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
          const list = document.querySelector('.game-level-list');
          return {family:document.body.dataset.promptFamily, list:box(list),scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,
            rows:[...list.querySelectorAll('button')].map(box),pageWidth:document.documentElement.scrollWidth,
            fixed:[...document.querySelectorAll('.game-level-header,.game-level-preview,.game-level-detail,.game-map-close')].map(box),
            hints:[...document.querySelectorAll('.game-control-hint')].filter(e=>e.getBoundingClientRect().width>0).length};
        });
        assert.equal(state.family, family ?? 'touch');
        assert.equal(state.hints, 0, 'touch layout retains a controller footer');
        assert.ok(state.pageWidth <= width, 'touch page overflows');
        for(const r of [...state.fixed,state.list]) assert.ok(r.x>=0 && r.y>=0 && r.right<=width+1 && r.bottom<=height+1, `offscreen segment ${width}×${height}: ${JSON.stringify(r)}`);
        for(const r of state.rows) assert.ok(r.width >= 48 && r.height >= 48, 'level row lacks a 48px hit target');
        if(engine === chromium && state.scrollHeight > state.clientHeight+1) {
          const cdp = await context.newCDPSession(page), x=state.list.x+state.list.width/2, from=state.list.bottom-20, to=state.list.y+20;
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
          for(let i=1;i<=10;i++) { await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/10}]});await page.waitForTimeout(35); }
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
          await page.waitForTimeout(200);
          assert.deepEqual(await page.evaluate(()=>window.__statsSelects), [], 'swipe launches a level');
          assert.ok(await page.locator('.game-level-list').evaluate(e=>e.scrollTop)>0,'list did not swipe');
          assert.equal(await page.locator('.game-cartoon-cursor').evaluate(e=>e.classList.contains('visible')),false,'touch swipe paints a mouse cursor');
        }
        const row = page.locator('[data-level-key="treehouse-trail"]');
        await row.evaluate(e=>e.scrollIntoView({block:'nearest'}));
        await row.tap();
        assert.deepEqual(await page.evaluate(()=>window.__statsSelects.splice(0)), ['treehouse-trail'], 'one tap must enter with controller or touch prompts');
        assert.deepEqual(await page.locator('.game-shell-panel').evaluate(e=>[e.scrollTop,e.scrollLeft]), [0,0]);
        await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-${family ?? 'touch'}.png`});
        checks.push({lite,width,height,family:state.family,minimumRowHeight:Math.min(...state.rows.map(r=>r.height))});
      }
      // Restore the normal callback and actually enter from the map with touch.
      await page.evaluate(()=>{const g=window.__game;g.gameFlow.callbacks.onLevelSelect=window.__statsSelect;g.input.touch.enabled=true;g.inputPrompts.setHostFamily(null);});
      await page.locator('[data-level-key="treehouse-trail"]').tap();
      await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='treehouse-trail'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
      await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'Treehouse Trail',inWarpRoom:false}));
      await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).tap();
      await page.locator('[data-level-key="treehouse-trail"]').tap();
      await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='confirm-level-select');
      await page.getByRole('button',{name:'CANCEL',exact:true}).tap();
      assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'level-select');
      assert.equal(await page.evaluate(()=>window.__game.gameFlow.levelSelectKey),'treehouse-trail');
      await page.locator('.game-map-close').tap();
      assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'pause');
      console.log(`PASS ${lite?'lite':'full'} map Level Stats ${width}×${height}, touch/keyboard/PS5, actual entry and cancel.`);
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${checks.length} real map Level Stats touch/controller layouts, swipes, actual course entry and cancellation.`);
} catch(error) {
  const page=browser.contexts().flatMap(context=>context.pages()).at(-1);
  if(page) {
    console.log('Failure state:',await page.evaluate(()=>({level:window.__game?.getCurrentLevel().id,screen:window.__game?.gameFlow.currentScreen,loading:window.__game?.getLoadingDiagnostics(),family:document.body.dataset.promptFamily,selected:window.__game?.gameFlow.levelSelectKey,callbackRestored:!!window.__statsSelect})).catch(()=>null));
    await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  }
  throw error;
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify({checks,errors},null,2));
  await browser.close();
}
