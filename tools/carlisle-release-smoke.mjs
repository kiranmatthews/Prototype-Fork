import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base=(process.env.CARLISLE_BASE||'http://127.0.0.1:5484').replace(/\/$/,'');
const out=process.env.CARLISLE_SMOKE_OUT||'docs/carlisle-relay/regression-repair/release-smoke';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,errors:[]};
let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(720);});
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.spawn=await page.evaluate(()=>{const g=window.__game,p=g.player;return{level:g.getCurrentLevel().id,position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths,grounded:p.grounded,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.spawn.level,'carlisle-coast');assert.equal(report.spawn.deaths,0);assert.match(report.spawn.build,/Codex\/sol fork/);
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('m');
 await page.waitForFunction(()=>window.__game.gameFlow.developerChromeVisible);
 const origin=await page.evaluate(()=>window.__game.getLevel().currentSpawn.toArray());
 await page.keyboard.press('l');
 await page.waitForFunction(origin=>window.__game.getLevel().currentSpawn.toArray().some((v,i)=>Math.abs(v-origin[i])>1),origin);
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.checkpoint=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{active:l.checkpoints.filter(c=>c.active).length,spawn:l.currentSpawn.toArray(),position:g.player.pos.toArray()};});
 assert.ok(report.checkpoint.active>0);
 await page.keyboard.press('k');await page.waitForFunction(()=>window.__game.player.grounded);
 await page.keyboard.press('l');await page.waitForFunction(()=>window.__game.player.grounded);
 const beforeFall=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),before={deaths:p.totalDeaths,lives:p.lives,endless:p.endlessDeaths};p.pos.set(l.currentSpawn.x+2000,l.killY-5,l.currentSpawn.z);p.vVel=-10;p.grounded=false;p.state='air';p.collapseRenderInterpolation();return before;});
 await page.waitForFunction(before=>{const g=window.__game,p=g.player,penalty=before.endless?p.totalDeaths===before.deaths+1:p.lives===before.lives-1;return penalty&&p.grounded&&!g.gameFlow.blocksGameplay&&p.pos.distanceTo(g.getLevel().currentSpawn)<3;},beforeFall,{timeout:30000});
 report.respawn=await page.evaluate(before=>{const g=window.__game;return{before,deaths:g.player.totalDeaths,lives:g.player.lives,position:g.player.pos.toArray(),spawn:g.getLevel().currentSpawn.toArray(),grounded:g.player.grounded};},beforeFall);
 // Respawn starts a 280 ms hold followed by the authored death-curtain fade.
 // A grounded player is not proof that the checkpoint is visible yet.
 await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.hud-fade')).opacity)<.001);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:out+'/checkpoint-normal.png'});
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),gate=g.getCurrentLevel().data.components.find(c=>c.t==='gate');g.player.respawn(l,true,false,{position:g.player.pos.clone().set(gate.p[0],gate.p[1]+3,gate.p[2])});});
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:20000});
 report.finish=await page.evaluate(()=>({state:window.__game.player.state,position:window.__game.player.pos.toArray()}));
 await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='results'&&window.__game.gameFlow.loadingPhase===null&&document.querySelector('.game-transition-curtain').hidden,null,{timeout:60000});
 report.finish.resultsVisible=true;
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:out+'/finish-normal.png'});
 const catalogue=await page.request.get(base+'/animations/skate-review/catalog.bin');assert.ok(catalogue.ok());
 assert.deepEqual(gunzipSync(await catalogue.body()),await readFile('public/animations/skate-review/catalog.json'));
 report.catalogue='Hosted catalogue decompresses to every original byte';
 report.release=await (await page.request.get(base+'/release.json?verify='+Date.now())).json();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 if(page)report.last=await page.evaluate(()=>{const g=window.__game;if(!g)return null;const p=g.player,l=g.getLevel();return{state:p.state,grounded:p.grounded,position:p.pos.toArray(),spawn:l.currentSpawn.toArray(),killY:l.killY,deaths:p.totalDeaths,lives:p.lives,blocked:g.gameFlow.blocksGameplay};}).catch(()=>null);
 await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();
}
console.log(JSON.stringify(report));
