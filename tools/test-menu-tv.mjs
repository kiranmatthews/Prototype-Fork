import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.MENU_TEST_URL||'http://127.0.0.1:5178/',out=process.env.MENU_TEST_OUT||'/private/tmp/menu-tv-review';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={errors:[],layouts:[],resolution:[]};
try {
  for (const lite of [true,false]) {
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:2});
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
    await page.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
    await page.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
    await page.evaluate(()=>{window.__game.campaign.newGame(1);window.__game.inputPrompts.setHostFamily('ps5');});
    for (const screen of ['pause','options','level-select','save-load']) {
      await page.evaluate(screen=>{const flow=window.__game.gameFlow;if(screen==='pause')flow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});else flow.showMapSection(screen);},screen);
      await page.waitForFunction(()=>document.querySelector('.game-shell [data-roo-menu][data-ready]'));
      for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[390,844],[844,390]]) {
        await page.setViewportSize({width,height});await page.waitForTimeout(300);
        const result=await page.evaluate(()=>{
          const panel=document.querySelector('.game-shell-panel');
          const visible=e=>e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none';
          const rect=e=>e.getBoundingClientRect().toJSON();
          return {pageWidth:document.documentElement.scrollWidth,hints:[...panel.querySelectorAll('.game-control-hint')].filter(visible).map(e=>e.getAttribute('aria-label')),rows:[...panel.querySelectorAll('.game-menu-list .game-menu-button')].map(e=>e.textContent.trim()),cards:[...panel.querySelectorAll('.game-pause-actions,.game-options-layout > .game-options-card,.game-progress-card')].map(rect),bar:!!panel.querySelector('.game-progress-bar'),buttons:[...panel.querySelectorAll('.game-menu-button')].filter(visible).map(e=>({label:e.getAttribute('aria-label')||e.textContent,rect:rect(e)}))};
        });
        assert.ok(result.pageWidth<=width+1,'whole menu must not scroll horizontally');
        assert.deepEqual(result.hints,['SELECT','BACK']);
        assert.ok(!result.rows.some(s=>/^(BACK|TEXT APPEARANCE|TEXT SHIMMER)$/.test(s)));
        assert.equal(result.bar,false);
        if(screen==='pause'||screen==='options') {
          assert.equal(result.cards.length,2);
          assert.ok(result.cards[0].right<=result.cards[1].left,'options must stay left of collectibles');
        }
        for(const button of result.buttons)assert.ok(button.rect.x>=-1&&button.rect.right<=width+1&&button.rect.y>=-1&&button.rect.bottom<=height+1,`offscreen ${screen} ${width}: ${button.label}`);
        await page.screenshot({path:`${out}/${screen}-${lite?'lite':'full'}-${width}x${height}.png`});
        report.layouts.push({screen,lite,width,height});
      }
      await page.setViewportSize({width:1280,height:720});
    }
    // Clickable Back is outside the action list and returns to the map.
    await page.locator('.game-control-hint[aria-label="BACK"]').click();
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),null);
    // Debug text controls remain usable while menus are open, and M dismisses them.
    await page.evaluate(()=>window.__game.gameFlow.showMapSection('options'));
    await page.keyboard.press('KeyM');
    assert.equal(await page.locator('.secondary-text-tuner').isVisible(),true);
    await page.locator('.secondary-text-tuner summary').click();
    await page.locator('[data-roo-setting="shimmer"]').uncheck();
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('solProtoRooAppearanceV4')).shimmer),false);
    await page.keyboard.press('KeyM');
    assert.equal(await page.locator('.secondary-text-tuner').isVisible(),false);
    // Use the real Select/Back paths with a callback spy: map entry is unchanged,
    // whereas active gameplay must pass the explicit confirmation first.
    await page.evaluate(()=>{const f=window.__game.gameFlow;window.menuOriginalSelect=f.callbacks.onLevelSelect;window.menuSelects=[];f.callbacks.onLevelSelect=id=>window.menuSelects.push(id);f.showMapSection('level-select');});
    assert.equal(await page.locator('.game-shell').getAttribute('aria-label'),'Level stats');
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.menuSelects.length),1);
    await page.evaluate(()=>{window.menuSelects=[];window.__game.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});});
    await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).click();await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'confirm-level-select');
    assert.equal(await page.evaluate(()=>window.menuSelects.length),0);
    assert.equal(await page.locator('.game-menu-button.selected').textContent(),'CANCEL');
    await page.locator('.game-control-hint[aria-label="BACK"]').click();
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'level-select');
    await page.keyboard.press('Enter');await page.getByRole('button',{name:'SWITCH LEVEL',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.menuSelects.length),1);
    await page.evaluate(()=>{window.__game.gameFlow.callbacks.onLevelSelect=window.menuOriginalSelect;});
    // Full-render native DPR mode: no menu-only 1080p downsampling.
    if(!lite){
      await page.evaluate(()=>{window.__game.renderQualitySettings.setEnabled(false);window.__game.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});});
      await page.waitForTimeout(600);
      const resolution=await page.evaluate(()=>({menu:window.__game.getGameFlowSurfaceDiagnostics(),buffer:{width:window.__game.renderer.domElement.width,height:window.__game.renderer.domElement.height}}));
      assert.equal(resolution.menu.width,resolution.buffer.width);assert.equal(resolution.menu.height,resolution.buffer.height);
      assert.ok(resolution.menu.width*resolution.menu.height>2073600);report.resolution.push(resolution);
      await page.screenshot({path:out+'/pause-native-2x.png'});
    }
    // Exercise actual forfeiture: current boxes, score and milk are discarded,
    // while a saved crystal in the campaign survives switching to Jungle.
    await page.evaluate(()=>{const g=window.__game;g.switchLevel('codex-lab');window.menuBaseline={lives:g.player.lives,fruit:g.player.fruit};g.player.fruit+=17;g.player.lives+=2;g.player.points=1234;g.player.cratesBroken=3;g.campaign.active.levels.jungle.crystal=true;g.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});});
    await page.getByRole('button',{name:'LEVEL SELECT',exact:true}).click();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'CANCEL',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__game.player.points),1234);
    await page.keyboard.press('Enter');await page.getByRole('button',{name:'SWITCH LEVEL',exact:true}).click();
    await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
    const run=await page.evaluate(()=>({level:window.__game.getCurrentLevel().id,run:window.__game.player.captureRunState(),baseline:window.menuBaseline,saved:window.__game.campaign.active.levels.jungle.crystal}));
    assert.equal(run.level,'jungle');assert.equal(run.run.fruit,run.baseline.fruit);assert.equal(run.run.lives,run.baseline.lives);assert.equal(run.run.points,0);assert.equal(run.run.cratesBroken,0);assert.equal(run.saved,true);
    await page.close();
  }
  const touch=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  touch.on('pageerror',e=>report.errors.push(e.message));
  await touch.goto(base+'?playtest&level=codex-lab&lite');await touch.waitForFunction(()=>window.__game?.gameFlow,null,{timeout:90000});
  await touch.evaluate(()=>{window.__game.campaign.newGame(1);window.__game.gameFlow.showMapSection('options');});
  assert.equal(await touch.evaluate(()=>document.body.dataset.promptFamily),'touch');
  assert.equal(await touch.locator('.game-control-hint:visible').count(),0);
  assert.equal(await touch.locator('.tc-zone:visible').count(),0);
  await touch.locator('.game-map-close').tap();assert.equal(await touch.evaluate(()=>window.__game.gameFlow.currentScreen),null);
  await touch.evaluate(()=>{const f=window.__game.gameFlow;window.touchSelects=[];f.callbacks.onLevelSelect=id=>window.touchSelects.push(id);f.showMapSection('level-select');});
  await touch.locator('.game-level-row:not(:disabled)').first().tap();assert.equal(await touch.evaluate(()=>window.touchSelects.length),1);
  await touch.screenshot({path:out+'/touch-level-stats.png'});await touch.close();
  assert.deepEqual(report.errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(`Passed ${report.layouts.length} menu layouts, map selection, confirmation/forfeiture, touch, M debug controls and native 2× rendering.`);
}finally{await browser.close();}
