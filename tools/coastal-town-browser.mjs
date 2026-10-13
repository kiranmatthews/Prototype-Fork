import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
let pw;try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const lite=process.argv.includes('--lite'),base=process.env.COASTAL_BASE??'http://127.0.0.1:5264/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={base,lite,started:new Date().toISOString(),errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function snapshot(){return page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return {
 position:p.pos.toArray(),grounded:p.grounded,state:p.state,lives:p.lives,deaths:p.totalDeaths,
 checkpoint:!!l.activeCheckpoint,currentSpawn:l.currentSpawn.toArray(),hud:l.hudMode,
 assets:l.jungleAssetDiagnostics,memory:{...g.renderer.info.memory},stamp:document.querySelector('.hud-build')?.textContent};});}
async function place(position){await page.evaluate(position=>{const g=window.__game,p=g.player,l=g.getLevel();
 p.respawn(l,true,false,{position:p.pos.clone().set(...position),heading:p.camDir.clone().set(0,0,-1)});p.lives=99;
},position);await page.waitForTimeout(400);}
async function perf(){return page.evaluate(async()=>{const g=window.__game,times=[],calls=[];let last=performance.now();
 for(let i=0;i<45;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-last);last=now;calls.push(g.getRenderFrameStats());}
 times.sort((a,b)=>a-b);return {medianMs:times[22],p95Ms:times[42],calls:Math.max(...calls.map(x=>x.calls)),triangles:Math.max(...calls.map(x=>x.triangles))};});}
try{
 await page.goto(base+'?playtest&level=coastal-street-run&frameprobe'+(lite?'&lite':''),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForTimeout(500);report.spawn=await snapshot();assert.ok(report.spawn.grounded);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 report.performance=await perf();
 if(!process.argv.includes('--visual')){
  await place([-3.15,4.12,-389]);const before=await snapshot();
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.pos.z<-397,null,{timeout:18000});
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.pos.z<-425,null,{timeout:15000});
  report.takeoff=await page.evaluate(()=>{const p=window.__game.player;return {position:p.pos.toArray(),speed:p.speed,skating:p.freeSkate,charge:p.xHoldT};});
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.pos.z<-447&&window.__game.player.grounded,null,{timeout:15000});
  await page.keyboard.up('ArrowUp');report.crossing=await snapshot();assert.equal(report.crossing.lives,before.lives,'First gap clears with real keyboard controls');
  const cp=await page.evaluate(()=>{const c=window.__game.getLevel().checkpoints[0];return [(c.box.min.x+c.box.max.x)/2,c.box.min.y+.1,c.box.max.z+.5];});
  await place(cp);await page.keyboard.down('KeyF');await page.waitForFunction(()=>!!window.__game.getLevel().activeCheckpoint,null,{timeout:6000});await page.keyboard.up('KeyF');
  report.checkpoint=await snapshot();
  await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,4.15,-435.5);p.grounded=false;p.state='air';p.vVel=-2;p.invulnTimer=0;});
  await page.waitForFunction(n=>window.__game.player.lives<n&&window.__game.player.grounded,report.checkpoint.lives,{timeout:20000});
  report.pitRespawn=await snapshot();assert.ok(report.pitRespawn.checkpoint);assert.ok(Math.hypot(...report.pitRespawn.position.map((v,i)=>v-report.checkpoint.currentSpawn[i]))<3);
  await place([0,7.12,-2998]);await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:12000});await page.keyboard.up('ArrowUp');report.finish=await snapshot();
  await page.goto(base+'?playtest&level=coastal-street-run'+(lite?'&lite':''),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(()=>window.__game.campaign.startEphemeral());
  await page.evaluate(()=>window.__game.enterBonusRound());
  await page.waitForFunction(()=>window.__game.getLevel().hudMode==='bonus'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  report.bonusSpawn=await snapshot();assert.ok(report.bonusSpawn.grounded);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(550);await page.keyboard.up('ArrowRight');report.bonusMove=await snapshot();assert.ok(report.bonusMove.position[0]>report.bonusSpawn.position[0]+.5);
  await page.keyboard.down('Space');await page.waitForTimeout(120);await page.keyboard.up('Space');await page.waitForTimeout(120);report.bonusJump=await snapshot();assert.ok(report.bonusJump.position[1]>.3);
  await page.evaluate(()=>window.__game.returnFromBonus(false));
  await page.waitForFunction(()=>window.__game.getLevel().hudMode!=='bonus'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});report.bonusReturn=await snapshot();assert.ok(report.bonusReturn.grounded);
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;report.last=await snapshot().catch(()=>null);throw e;}
finally{
 for(const key of ['ArrowUp','ArrowRight','Space','KeyF'])await page.keyboard.up(key).catch(()=>{});
 report.finished=new Date().toISOString();await mkdir('docs/performance',{recursive:true});
 await writeFile(`docs/performance/coastal-town-${lite?'lite':'full'}.json`,JSON.stringify(report,null,2)+'\n');
 await browser.close();console.log(JSON.stringify(report));
}
