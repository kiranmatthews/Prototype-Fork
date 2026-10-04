import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(a=>/^http/.test(a))||'http://127.0.0.1:5198/';
const full=process.argv.includes('--full'),out='/private/tmp/ghost-train-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}?playtest&level=ghost-train${full?'':'&lite'}`);
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='ghost-train'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const l=window.__game.getLevel();await l.prepareGhostTrainAssets?.();});
  await page.waitForTimeout(500);
  const spawn=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;return {grounded:p.grounded,position:p.pos.toArray(),diagnostics:l.ghostTrainDiagnostics,movers:l.movers.length,enemies:l.enemies.length,axes:l.pendulums.length};});
  assert.ok(spawn.grounded,'browser spawn is supported');
  await page.screenshot({path:`${out}/station-${full?'full':'lite'}.png`});
  const rooms=[];
  // Invoke the same production checkpoint-warp action as the visible K/L
  // developer controls; direct playtest starts with that chrome hidden.
  const checkpoints=await page.evaluate(()=>window.__game.getLevel().checkpoints.length);
  let lastZ=spawn.position[2];
  for(let i=0;i<checkpoints;i++){
    assert.ok(await page.evaluate(()=>{const g=window.__game;return g.player.warpCheckpoint(g.getLevel(),1);}), 'checkpoint warp exists');
    await page.waitForTimeout(180);
    const state=await page.evaluate(()=>{const g=window.__game,p=g.player;return {position:p.pos.toArray(),grounded:p.grounded,state:p.state};});
    assert.ok(state.position[2]<lastZ-5,'checkpoint review advances through the course');lastZ=state.position[2];
    rooms.push(state);await page.screenshot({path:`${out}/checkpoint-${String(i+1).padStart(2,'0')}-${full?'full':'lite'}.png`});
  }
  assert.deepEqual(errors,[],'no browser console errors');
  assert.ok(await page.evaluate(()=>window.__game.getLevel().checkpoints.every(c=>c.active)),'all checkpoint warps bank their runtime checkpoint');
  const diagnostics=await page.evaluate(()=>window.__game.getLevel().ghostTrainDiagnostics);
  await writeFile(`${out}/report-${full?'full':'lite'}.json`,JSON.stringify({spawn,rooms,diagnostics,errors},null,2));
  assert.ok(Object.values(diagnostics.scenery.assets).every(a=>a.status==='ready'),'all actual Meshy models loaded');
  assert.ok(diagnostics.enemies.every(e=>e.status==='ready'),'every animatronic loaded');
  console.log(JSON.stringify({full,spawn:spawn.position,movers:spawn.movers,axes:spawn.axes,enemies:spawn.enemies,assets:diagnostics.scenery.assets,rooms:rooms.length,errors}));
}finally{await browser.close();}
