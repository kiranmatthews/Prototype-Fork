import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(process.env.PLAYWRIGHT_MODULE||import.meta.url),{chromium}=require('playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5310/';
const output=process.env.SUNNY_RETIRE_OUTPUT||'/private/tmp/sunny-retirement';
await mkdir(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{for(const lite of [true,false]){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>{navigator.getGamepads=()=>[]});
 await page.goto(new URL(`?playtest&level=island-hopper${lite?'&lite':''}`,base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForFunction(()=>window.__game.player.grounded);
 const row=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel();
  const ids=g.levelList().map(e=>e.id);g.campaign.startEphemeral();
  for(const v of Object.values(g.campaign.active.levels))v.cleared=true;
  g.gameFlow.showMapSection('level-select');g.gameFlow.levelSelectIsland='island-2';g.gameFlow.levelSelectKey='beachside-run';g.gameFlow.render();
  return {id:g.getCurrentLevel().id,ids,checkpoints:l.checkpoints.length,finishZ:l.finishZ,
    menu:[...document.querySelectorAll('[data-level-key]')].map(e=>e.dataset.levelKey),stamp:document.querySelector('.hud-build')?.textContent};
 });
 assert.equal(row.id,'beachfront');assert.equal(row.checkpoints,8);assert.ok(row.finishZ<-1120);assert.match(row.stamp,/Codex\/sol fork/);
 for(const id of ['island-hopper','bonus-island-hopper'])assert.ok(!row.ids.includes(id));
 assert.ok(!row.menu.includes('island-hopper')&&row.menu.includes('beachside-run')&&row.menu.includes('coastal')&&row.menu.includes('waterpark'));
 await page.screenshot({path:`${output}/${lite?'lite':'full'}-menu.png`});
 await page.evaluate(()=>{const g=window.__game;g.gameFlow.hide();g.campaign.setMapFocus('coastal');g.switchLevel('warproom');});
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='warproom'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(500);
 row.map=await page.evaluate(()=>({nodes:window.__game.getLevel().campaignWorldMap.keys(),position:window.__game.player.pos.toArray()}));
 assert.ok(!row.map.nodes.includes('island-hopper'));
 await page.screenshot({path:`${output}/${lite?'lite':'full'}-map.png`});
 const travel=async(key,x,z)=>{await page.keyboard.press(key,{delay:90});await page.waitForFunction(({x,z})=>{const p=window.__game.player.pos;return Math.abs(p.x-x)<.7&&Math.abs(p.z-z)<.7;},{x,z},{timeout:30000});await page.waitForTimeout(300);return page.evaluate(()=>({focus:window.__game.campaign.active.mapFocus,p:window.__game.player.pos.toArray()}));};
 row.right=await travel('ArrowRight',104,14);assert.equal(row.right.focus,'codex-switchback');
 row.left=await travel('ArrowLeft',67,14);assert.equal(row.left.focus,'coastal');
 row.up=await travel('ArrowUp',67,4);assert.equal(row.up.focus,'waterpark');
 row.down=await travel('ArrowDown',67,14);assert.equal(row.down.focus,'coastal');
 assert.deepEqual(errors,[]);reports.push({lite,...row,errors});console.log(`PASS ${lite?'lite':'full'}: old-link redirect, no retired menus/map/bonus, direct Coastal route and optional Deadwater branch.`);
 await page.close();
}}finally{await writeFile(`${output}/report.json`,JSON.stringify({base,reports},null,2));await browser.close();}
