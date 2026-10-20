import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5186/';
const output = process.env.CRT_GAME_REVIEW || '/private/tmp/crt-game-review';
await mkdir(output,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const report=[];
try {
  for(const lite of [true,false]) {
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(`${base}?playtest&level=codex-lab${lite?'&lite':''}`);
    await page.waitForFunction(()=>window.__game && !window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
    await page.evaluate(()=>{const g=window.__game;g.crtGuestSettings.applyStartupPreset();g.crtGuestSettings.setEnabled(true);});
    await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:30000});
    if(!lite)await page.waitForFunction(()=>window.__game.getCrtDiagnostics()?.active,null,{timeout:30000});
    const initial=await page.evaluate(()=>{const g=window.__game;return {pos:g.player.pos.toArray(),state:g.player.state,grounded:g.player.grounded,crt:g.getCrtDiagnostics()};});
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(900);await page.keyboard.up('ArrowUp');
    const moved=await page.evaluate(()=>window.__game.player.pos.toArray());
    assert.ok(Math.hypot(...moved.map((v,i)=>v-initial.pos[i]))>.2,'Movement input must traverse supported geometry');
    const checkpoint=await page.evaluate(()=>{const g=window.__game;const warped=g.player.warpCheckpoint(g.getLevel(),1);return {warped,pos:g.player.pos.toArray(),spawn:g.getLevel().currentSpawn.toArray()};});
    assert.equal(checkpoint.warped,true);
    await page.evaluate(()=>{const g=window.__game;g.player.pos.y=g.getLevel().killY-10;});
    await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:15000});
    await page.waitForFunction(()=>window.__game.player.state!=='dead'&&window.__game.player.grounded,null,{timeout:30000});
    await page.waitForTimeout(1500);
    const respawn=await page.evaluate(()=>window.__game.player.pos.toArray());
    assert.ok(Math.hypot(...respawn.map((v,i)=>v-checkpoint.spawn[i]))<8,'Death returns to the active checkpoint');
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-game.png`});
    // Exercise the actual CRT panel and live graph transitions without replacing
    // the authored gameplay/menu rendering pipeline.
    await page.keyboard.press('KeyM');
    const controls=await page.evaluate(()=>{
      const g=window.__game,s=g.crtGuestSettings;g.crtGuestPanel.open();
      const host=g.crtGuestPanel.element,root=host.shadowRoot;
      const visible=id=>{const row=root.querySelector(`[data-parameter="${id}"]`);return !!row&&!row.hidden;};
      const before={glow:visible('glow'),sigma:visible('SIGMA_H'),esrc:visible('esrc'),lutSize:visible('LS'),scanGamma:visible('scangamma')};
      s.setValue('glow',.3);const after={sigma:visible('SIGMA_H'),magic:visible('m_glow_cutoff')};
      s.setValue('m_glow',2);after.magicEnabled=visible('m_glow_cutoff');
      s.setValue('AS',0);after.persistenceHidden=!visible('PR');
      s.setValue('SIGMA_H',1.2);s.setValue('SIZEH',50);
      const radiusRow=root.querySelector('[data-parameter="SIZEH"]');
      const radius={maximum:Number(radiusRow.querySelector('.range').max),shown:Number(radiusRow.querySelector('.numeric').value),stored:s.getValue('SIZEH')};
      s.setValue('SIGMA_H',3);radius.widerMaximum=Number(radiusRow.querySelector('.range').max);
      const count=[...root.querySelectorAll('.parameter')].filter(row=>!row.hidden).length;
      return {before,after,count,radius};
    });
    assert.deepEqual(controls.before,{glow:true,sigma:false,esrc:false,lutSize:false,scanGamma:true});
    assert.deepEqual(controls.after,{sigma:true,magic:false,magicEnabled:true,persistenceHidden:true});
    assert.deepEqual({maximum:controls.radius.maximum,shown:controls.radius.shown,stored:controls.radius.stored},{maximum:8,shown:8,stored:50});
    assert.ok(controls.radius.widerMaximum>=17&&controls.radius.widerMaximum<=18,'Radius range follows the wider kernel, including legacy float step rounding');
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-controls.png`});
    await page.evaluate(()=>{const g=window.__game;g.crtGuestPanel.close();g.crtGuestSettings.applyStartupPreset();g.crtGuestSettings.setEnabled(true);});
    await page.keyboard.press('KeyM');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(750);
    const menu=await page.evaluate(()=>({blocked:window.__game.gameFlow.blocksGameplay,crt:window.__game.getCrtDiagnostics(),surface:window.__game.getGameFlowSurfaceDiagnostics()}));
    assert.equal(menu.blocked,true,'Pause menu opens');
    await page.screenshot({path:`${output}/${lite?'lite':'full'}-pause.png`});
    for(const viewport of [{width:390,height:844},{width:1920,height:1080}]) {
      await page.setViewportSize(viewport);await page.waitForTimeout(600);
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-pause-${viewport.width}.png`});
    }
    if(!lite) {
      const final=await page.evaluate(()=>window.__game.getCrtDiagnostics());
      assert.equal(final.active,true);assert.equal(final.runtimeFailure,null);
      assert.equal(final.graph.bloom,false);assert.equal(final.graph.glow,false);
      assert.ok(final.lastDrawCount<=5);
      await page.evaluate(()=>{const s=window.__game.renderQualitySettings;s.setEnabled(true);s.setBaseHeight(720);s.setOutputMultiplier(2);});
      await page.waitForFunction(()=>{const d=window.__game.getCrtDiagnostics();return d?.active&&d.outputWidth===d.sourceWidth*2;});
      menu.upscaled=await page.evaluate(()=>window.__game.getCrtDiagnostics());
      assert.equal(menu.upscaled.graph.reconstruction,true);
      await page.screenshot({path:`${output}/full-pause-upscaled.png`});
      await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
      await page.waitForFunction(()=>{const d=window.__game.getCrtDiagnostics();return d?.active&&d.sourceWidth===1920&&d.sourceHeight===1080&&d.outputWidth===1920;});
      menu.native=await page.evaluate(()=>window.__game.getCrtDiagnostics());
      assert.equal(menu.native.graph.reconstruction,false);assert.equal(menu.native.lastDrawCount,4);
      await page.screenshot({path:`${output}/full-pause-native-1080.png`});
      await page.evaluate(()=>{const s=window.__game.crtGuestSettings;s.setValue('AS',0);s.setValue('BP',25);});
      await page.waitForFunction(()=>{const d=window.__game.getCrtDiagnostics();return d?.active&&!d.graph.afterglow&&d.lastDrawCount===2;});
      menu.threshold=await page.evaluate(()=>window.__game.getCrtDiagnostics());
      assert.equal(menu.threshold.targets['afterglow-read'],undefined);assert.equal(menu.threshold.targets.stock,undefined);
      await page.evaluate(()=>{const s=window.__game.crtGuestSettings;s.applyStartupPreset();s.setEnabled(true);});
    }
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      const g=window.__game,p=g.player,level=g.getLevel();
      level.finishGlow.getCenter(p.pos);p.speed=0;
    });
    await page.waitForFunction(()=>window.__game.player.state==='finished'||window.__game.gameFlow.blocksGameplay,null,{timeout:15000});
    assert.deepEqual(errors,[]);
    report.push({lite,stamp,initial,moved,checkpoint,respawn,controls,menu,errors});
    await page.close();
  }
  console.log('PASS spawn, traversal, checkpoint/pit recovery, finish pad, live CRT controls, full-render pause, native 1080p/upscaled/portrait; no console errors.');
} finally {await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));await browser.close();}
