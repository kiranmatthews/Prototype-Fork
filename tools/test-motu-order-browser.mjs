import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5377/';
const full = process.argv.includes('--full');
const out = process.env.MOTU_ORDER_OUTPUT || '/private/tmp/motu-order-browser';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const report = {base,full,errors:[],travel:[],entries:[]};
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => {if(message.type()==='error') report.errors.push(message.text());});
const ready = id => page.waitForFunction(id => window.__game?.getCurrentLevel().id===id && !window.__game.gameFlow.blocksGameplay, id, {timeout:180000});
try {
  await page.addInitScript(() => localStorage.setItem('solProtoRenderQuality.v1', JSON.stringify({version:1,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true})));
  await page.goto(new URL('?playtest&level=warproom'+(full?'':'&lite'),base).href,{waitUntil:'domcontentloaded',timeout:180000});
  await ready('warproom');
  await page.evaluate(() => {const g=window.__game;g.campaign.setDebugUnlockAll(true);g.campaign.setMapFocus('beachside-run');g.switchLevel('warproom');});
  await page.waitForFunction(() => window.__game.getWorldMapDiagnostics().selected==='beachside-run');
  for(const [key,direction] of [['rumblewater-run','ArrowRight'],['jungle','ArrowRight'],['coastal','ArrowRight'],['jungle','ArrowLeft'],['rumblewater-run','ArrowLeft']]) {
    await page.keyboard.press(direction);
    await page.waitForFunction(key => {const d=window.__game.getWorldMapDiagnostics();return d.selected===key&&!d.moving;},key,{timeout:20000});
    report.travel.push({key,direction});
    if(full && direction==='ArrowRight' && ['rumblewater-run','jungle'].includes(key)) await page.screenshot({path:join(out,key+'-map.png')});
  }
  await page.evaluate(() => {const g=window.__game;g.gameFlow.showMapSection('level-select');g.gameFlow.levelSelectIsland='island-1';g.gameFlow.levelSelectKey='rumblewater-run';g.gameFlow.render();});
  report.menu = await page.locator('.game-level-row').evaluateAll(rows => rows.map(row=>({key:row.dataset.levelKey,text:row.textContent})));
  assert.deepEqual(report.menu.map(row=>row.key),['treehouse-trail','beachside-run','rumblewater-run','jungle','coastal','jungle-cup']);
  assert.match(report.menu[2].text,/Ripcord River/i);assert.match(report.menu[3].text,/Jungle Ruins/i);
  const catalogue = await page.locator('.hud-levelplay').allTextContents();
  assert.ok(catalogue.includes('3· Ripcord River'));assert.ok(catalogue.includes('4· Jungle Ruins'));
  assert.ok(catalogue.indexOf('3· Ripcord River')<catalogue.indexOf('4· Jungle Ruins'));
  report.catalogue = catalogue.filter(text=>/Ripcord River|Jungle Ruins/.test(text));
  await page.screenshot({path:join(out,'motu-level-select.png')});
  if(!full) for(const [key,id,name] of [['rumblewater-run','rumblewater-run','Ripcord River'],['jungle','jungle','Jungle Ruins']]) {
    await page.evaluate(key => {const g=window.__game;g.campaign.setMapFocus(key);if(g.getCurrentLevel().id!=='warproom')g.switchLevel('warproom');g.gameFlow.showMapSection('level-select');g.gameFlow.levelSelectIsland='island-1';g.gameFlow.levelSelectKey=key;g.gameFlow.render();},key);
    await page.locator(`[data-level-key="${key}"]`).dblclick();await ready(id);
    await page.waitForFunction(() => window.__game.player.grounded,null,{timeout:20000});
    const entry=await page.evaluate(() => ({id:window.__game.getCurrentLevel().id,name:window.__game.getLevel().name,grounded:window.__game.player.grounded}));
    assert.equal(entry.name,name);report.entries.push(entry);
  }
  report.stamp=await page.locator('.hud-build').textContent();assert.match(report.stamp,/Codex\/sol fork/);
  report.canvas=await page.evaluate(()=>[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]);
  if(full)assert.deepEqual(report.canvas,[1920,1080]);
  assert.deepEqual(report.errors,[]);report.pass=true;
  console.log(JSON.stringify({pass:true,full,stamp:report.stamp,travel:report.travel,entries:report.entries,catalogue:report.catalogue}));
} finally {await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
