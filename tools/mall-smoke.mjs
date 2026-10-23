import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5276';
await mkdir('/private/tmp/mall-recreation',{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=mall&lite`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.locator('.hud-levelplay[title="Mall · New York"]').click();
 await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded);
 const checkpoints=[];
 for(let i=0;i<5;i++){
  await page.keyboard.press('KeyL');
  await page.waitForFunction(i=>{const g=window.__game,l=g.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i&&g.player.grounded;},i,{timeout:15000});
  checkpoints.push(await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{index:l.checkpoints.indexOf(l.activeCheckpoint),position:g.player.pos.toArray(),distance:g.player.pos.distanceTo(l.activeCheckpoint.spawnPos)};}));
 }
 await page.keyboard.press('KeyK');
 await page.waitForFunction(()=>{const g=window.__game,l=g.getLevel();return l.currentSpawn.distanceTo(l.checkpoints[3].spawnPos)<.01&&g.player.grounded;});
 const start=await page.evaluate(()=>{const g=window.__game,p=g.player;return{deaths:p.totalDeaths,lives:p.lives,stamp:document.querySelector('.hud-build')?.textContent};});
 // Deliberate below-floor fixture; route tests separately prohibit placement
 // changes from spawn to finish. Production death/respawn owns all later steps.
 await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,-13.6,-150);p.grounded=false;p.state='air';p.vVel=-4;});
 await page.waitForFunction(before=>{const p=window.__game.player;return p.totalDeaths>before.deaths||p.lives<before.lives||p.state==='dead';},start,{timeout:20000});
 await page.waitForFunction(()=>{const p=window.__game.player;return p.state==='ride'&&p.grounded;},null,{timeout:20000});
 const recovery=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{state:p.state,deaths:p.totalDeaths,lives:p.lives,savedCheckpoint:l.checkpoints.indexOf(l.activeCheckpoint),spawnIndex:l.checkpoints.findIndex(c=>c.spawnPos.distanceTo(l.currentSpawn)<.01),distance:p.pos.distanceTo(l.currentSpawn)};});
 await page.screenshot({path:'/private/tmp/mall-recreation/menu-checkpoint-return.png'});
 const report={start,checkpoints,recovery,errors};await writeFile('/private/tmp/mall-recreation/smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.equal(recovery.spawnIndex,3);assert.equal((recovery.deaths-start.deaths)+(start.lives-recovery.lives),1);assert.ok(recovery.distance<.25);assert.ok(checkpoints.every(c=>c.distance<.25));assert.match(start.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
}catch(e){console.error(await page.evaluate(()=>{const g=window.__game,p=g?.player,l=g?.getLevel();return{position:p?.pos.toArray(),state:p?.state,deaths:p?.totalDeaths,lives:p?.lives,blocked:g?.gameFlow.blocksGameplay,currentSpawn:l?.currentSpawn.toArray()};}));throw e;}finally{await browser.close();}
