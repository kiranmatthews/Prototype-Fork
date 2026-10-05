// Real preset buttons and WebGL targets across DPR, rotation, CRT and water.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.RESOLUTION_BROWSER === 'webkit' ? webkit : chromium;
const base = process.argv[2] || 'http://127.0.0.1:5192/';
const output = process.env.RESOLUTION_OUTPUT || '/private/tmp/render-resolution-browser';
await mkdir(output, {recursive:true});
const browser = await engine.launch({headless:true, ...(engine === chromium ? {channel:'chrome'} : {})});
const report = {engine:engine===chromium?'chromium':'webkit', base, checks:[], errors:[]};
const ready = page => page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay,
  null, {timeout:120000});
const watch = page => {
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
};
async function instrument(page) {
  await page.evaluate(() => {
    const r=window.__game.renderer, original=r.setRenderTarget;
    window.__resolutionTargets = new Map();
    r.setRenderTarget=function(target,...args) {
      const result=original.call(this,target,...args);
      const name=target?.texture.name;
      if (name) window.__resolutionTargets.set(name, {
        name,width:target.width,height:target.height,
        // Read the real bound GPU viewport after Three has bound the target.
        viewport:[...r.getContext().getParameter(r.getContext().VIEWPORT)],
      });
      return result;
    };
  });
}
async function capture(page, preset, {crt=false, split=false}={}) {
  await page.evaluate(({crt}) => {
    window.__resolutionTargets.clear();
    window.__game.crtGuestSettings.setEnabled(crt);
    window.__game.gameFlow.requestGameplayFrame();
  }, {crt});
  await page.waitForFunction(({preset,crt,split}) => {
    const g=window.__game, r=g.renderer;
    if (r.getContext().isContextLost()) throw Error('graphics context lost');
    const s=g.getRenderQualitySizes();
    return Math.min(r.domElement.width,r.domElement.height)===preset &&
      (split || window.__resolutionTargets.get('EffectComposer.rt1')?.width===s.inputWidth) &&
      (!crt || g.getCrtDiagnostics()?.active && g.getCrtDiagnostics().sourceWidth===s.inputWidth);
  }, {preset,crt,split}, {timeout:60000});
  const state=await page.evaluate(() => {
    const g=window.__game,r=g.renderer,c=r.domElement,rect=c.getBoundingClientRect();
    return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
      rendererDpr:r.getPixelRatio(),canvas:[c.width,c.height],css:[rect.width,rect.height],
      size:g.getRenderQualitySizes(),regular:g.renderQualitySettings.regularResolution,
      targets:[...window.__resolutionTargets.values()],crt:g.getCrtDiagnostics(),
      water:g.getLevel().water?.stats ?? null,contextLost:r.getContext().isContextLost()};
  });
  assert.equal(state.rendererDpr,1);
  assert.deepEqual(state.canvas,[state.size.inputWidth,state.size.inputHeight],
    'regular presets must retain 1x input/output density');
  assert.equal(state.regular,preset);
  assert.equal(Math.min(...state.canvas),preset);
  assert.deepEqual(state.canvas,[state.size.outputWidth,state.size.outputHeight]);
  assert.deepEqual(state.css,state.viewport);
  const wanted=[state.size.inputWidth,state.size.inputHeight];
  if (!split) {
    for (const name of ['EffectComposer.rt1','EffectComposer.rt2','UnitySMAA.StopNaN','UnitySMAA.EdgesRGBA8','UnitySMAA.WeightsRGBA8']) {
      const target=state.targets.find(t=>t.name===name);
      assert.ok(target,`missing actual ${name} render`);
      assert.deepEqual([target.width,target.height],wanted,`${name} ignores the preset`);
      assert.deepEqual(target.viewport.slice(2),wanted,`${name} GPU viewport ignores the preset`);
    }
  }
  if (crt) {
    assert.equal(state.crt.failureCount,0);
    assert.deepEqual([state.crt.outputWidth,state.crt.outputHeight],wanted);
    for (const name of ['encoded','stock','pre','linear','main']) {
      const target=state.crt.targets[name];
      if (target) assert.deepEqual([target.width,target.height],wanted,`CRT ${name} ignores the preset`);
    }
    assert.ok(state.crt.estimatedTargetBytes>0);
  }
  return state;
}
try {
  console.log('Lite gameplay smoke');
  // Lite gameplay smoke stays on its explicit software-rendering fast path.
  const smokeContext=await browser.newContext({viewport:{width:1280,height:720}});
  const smoke=await smokeContext.newPage();watch(smoke);
  await smoke.goto(new URL('?lite&playtest&level=codex-lab',base).href);await ready(smoke);
  await smoke.waitForFunction(()=>window.__game.player.grounded);
  const start=await smoke.evaluate(()=>window.__game.player.pos.toArray());
  await smoke.keyboard.down('ArrowUp');await smoke.waitForTimeout(450);await smoke.keyboard.up('ArrowUp');
  const end=await smoke.evaluate(()=>window.__game.player.pos.toArray());
  assert.ok(Math.hypot(...start.map((n,i)=>n-end[i]))>.2);
  assert.equal(await smoke.evaluate(()=>{const g=window.__game;return g.player.warpCheckpoint(g.getLevel(),1);}),true);
  await smoke.waitForFunction(()=>window.__game.player.grounded);
  const deaths=await smoke.evaluate(()=>{const p=window.__game.player;const before={deaths:p.totalDeaths,lives:p.lives};p.pos.y=window.__game.getLevel().killY-3;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;return before;});
  await smoke.waitForFunction(n=>{const p=window.__game.player;return (p.totalDeaths>n.deaths||p.lives<n.lives)&&p.grounded;},deaths,{timeout:20000});
  await smoke.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:l.finishGlow.getCenter(p.pos.clone()),heading:p.camDir.clone()});p.snapRenderInterpolation();});
  await smoke.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});
  report.checks.push({test:'lite movement, checkpoint, pit respawn and finish',passed:true});
  await smokeContext.close();

  const dprs=(process.env.RESOLUTION_DPRS || '1,2,3').split(',').map(Number);
  for (const dpr of dprs) {
    console.log(`Phone Options/rotation DPR ${dpr}`);
    // iPhone 14 Pro CSS screen, including actual same-tab rotations.
    const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
    const page=await context.newPage();watch(page);
    if (engine===chromium) {
      const cdp=await context.newCDPSession(page),{windowId}=await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width:1200,height:1400}});
      await cdp.detach();
    }
    await page.addInitScript(() => {
      if (!localStorage.getItem('solProtoRenderQuality.v1')) localStorage.setItem('solProtoRenderQuality.v1',
        JSON.stringify({version:2,enabled:true,baseHeight:540,outputMultiplier:2,fixed60:true}));
    });
    await page.goto(new URL('?playtest&level=codex-lab&renderdiag',base).href);await ready(page);await instrument(page);
    await page.keyboard.press('KeyP');
    await page.getByRole('button',{name:'OPTIONS',exact:true}).click();
    assert.equal(await page.locator('.game-resolution strong').textContent(),'480P');
    await capture(page,480);
    report.checks.push({test:'saved 540p 2x migrates to 480p 1x',dpr,passed:true});
    for (const preset of [1080,480,720]) {
      const button=page.locator('.game-resolution');
      for (let i=0;await page.locator('.game-resolution strong').textContent()!==`${preset}P`;i++) {
        assert.ok(i<4);
        const b=await button.boundingBox();
        await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
      }
      const portrait=await capture(page,preset);
      await page.setViewportSize({width:852,height:393});
      const landscape=await capture(page,preset);
      assert.deepEqual(landscape.canvas,[...portrait.canvas].reverse());
      report.checks.push({test:'real Options preset and rotation',preset,dpr,portrait,landscape});
      await page.screenshot({path:`${output}/dpr${dpr}-${preset}-landscape-options.png`});
      await page.setViewportSize({width:393,height:852});
    }
    // Authoring scales are explicit CUSTOM and no longer silently overridden.
    await page.evaluate(()=>window.__game.renderQualitySettings.setOutputMultiplier(2));
    assert.equal(await page.locator('.game-resolution strong').textContent(),'CUSTOM');
    await page.locator('.game-resolution').click();
    assert.equal(await page.locator('.game-resolution strong').textContent(),'480P');
    await capture(page,480);
    const densityLock=await page.evaluate(() => {
      const settings=window.__game.renderQualitySettings;
      settings.setOutputMultiplier(2);settings.setOutputMultiplier(3);
      const buttons=[...window.__game.renderQualityPanel.element.shadowRoot.querySelectorAll('button')];
      return {multiplier:settings.outputMultiplier,
        blocked:buttons.filter(b=>['2×','3×'].includes(b.textContent)).map(b=>b.disabled)};
    });
    assert.equal(densityLock.multiplier,1);assert.deepEqual(densityLock.blocked,[true,true]);
    assert.equal(await page.locator('.game-resolution strong').textContent(),'480P');
    report.checks.push({test:'480p rejects 2x/3x density overrides',dpr,densityLock});
    await page.keyboard.press('KeyP');
    await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');
    await page.keyboard.press('KeyP');await ready(page);
    report.checks.push({test:'phone portrait gameplay with CRT',dpr,state:await capture(page,480,{crt:true})});
    await page.screenshot({path:`${output}/dpr${dpr}-480-portrait-play.png`});
    await page.setViewportSize({width:852,height:393});
    report.checks.push({test:'phone landscape gameplay with CRT',dpr,state:await capture(page,480,{crt:true})});
    await page.screenshot({path:`${output}/dpr${dpr}-480-landscape-play.png`});
    await page.reload();await ready(page);await instrument(page);
    await capture(page,480);
    report.checks.push({test:'preset persists across reload',dpr,passed:true});
    await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
    await page.waitForFunction(() => {
      const r=window.__game.renderer;
      return r.domElement.width===Math.round(innerWidth*Math.min(devicePixelRatio,2)) &&
        r.domElement.height===Math.round(innerHeight*Math.min(devicePixelRatio,2));
    });
    const native=await page.evaluate(()=>({resolution:window.__game.renderQualitySettings.regularResolution,
      dpr:window.__game.renderer.getPixelRatio(),canvas:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]}));
    assert.equal(native.resolution,'max');assert.equal(native.dpr,Math.min(dpr,2));
    report.checks.push({test:'MAX retains native sizing',dpr,native});
    await context.close();
  }
  // Desktop and phone select the same physical buffer; CRT and real coastal
  // reflection/prepass storage must shrink, not just upscale a smaller image.
  const context=await browser.newContext({viewport:{width:852,height:393},deviceScaleFactor:3});
  const page=await context.newPage();watch(page);
  await page.goto(new URL('?playtest&level=beachfront&renderdiag',base).href);await ready(page);await instrument(page);
  const resources=[];
  console.log('Full-render coast resources');
  for (const preset of [1080,720,480]) {
    await page.evaluate(p=>window.__game.renderQualitySettings.setRegularResolution(p),preset);
    const state=await capture(page,preset,{crt:true});
    await page.waitForFunction(s=>window.__game.getLevel().water?.stats.sceneWidth===s.inputWidth,state.size);
    state.water=await page.evaluate(()=>window.__game.getLevel().water.stats);
    assert.deepEqual([state.water.sceneWidth,state.water.sceneHeight],state.canvas);
    assert.deepEqual([state.water.prepassWidth,state.water.prepassHeight],state.canvas);
    resources.push({preset,...state});
    await page.screenshot({path:`${output}/coast-${preset}-crt.png`});
  }
  const [high,mid,low]=resources;
  report.checks.push({test:'actual CRT and ocean resource reduction',resources});
  // CRT retains the upstream fixed 800x600 blur kernels. Those fixed and
  // one-axis passes prevent its total memory from scaling purely by area.
  assert.ok(low.crt.estimatedTargetBytes<high.crt.estimatedTargetBytes*.40);
  assert.ok(mid.crt.estimatedTargetBytes<high.crt.estimatedTargetBytes*.60);
  assert.ok(low.water.reflectionWidth*low.water.reflectionHeight<high.water.reflectionWidth*high.water.reflectionHeight*.26);
  await page.evaluate(()=>window.__game.set2P(true,true));
  await page.waitForFunction(()=>!!window.__game.getP2());
  const split=await capture(page,480,{split:true});
  report.checks.push({test:'split-screen canvas retains preset',split});
  await context.close();
  assert.deepEqual(report.errors,[]);
  console.log('PASS physical-pixel presets, DPR independence, rotation, actual world/SMAA/CRT/ocean buffers, lower resource use and gameplay smoke');
} finally {
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  await browser.close();
}
