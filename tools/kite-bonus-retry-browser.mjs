import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);let module;
try{module=require.resolve('playwright');}catch{module=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(module).href);
const base=process.env.BEACH_BASE??'http://127.0.0.1:5288',out=process.env.BEACH_OUTPUT??'docs/beach-street/bonus-retry';
const lite=process.argv.includes('--lite');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const report={started:new Date().toISOString(),base,lite,errors:[],failed:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
const key=(code,down)=>page.evaluate(({code,down})=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true})),{code,down});
const neutral=async()=>{await page.evaluate(()=>clearInterval(window.kiteRetrySteer));for(const code of ['Space','KeyF','ArrowLeft','ArrowRight'])await key(code,false);};
const steer=async x=>page.evaluate(x=>{
 clearInterval(window.kiteRetrySteer);
 for(const code of ['ArrowLeft','ArrowRight'])document.body.dispatchEvent(new KeyboardEvent('keyup',{code,key:code,bubbles:true}));
 const keys=new Set();
 window.kiteRetrySteer=setInterval(()=>{const p=window.__game.player,error=x-p.pos.x-(p.kiteMotion?.lateral??0)*.15;
  for(const [code,on] of [['ArrowLeft',error<-.08],['ArrowRight',error>.08]]){
   if(keys.has(code)===on)continue;if(on)keys.add(code);else keys.delete(code);
   document.body.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code,key:code,bubbles:true}));
  }
 },16);
},x);
const snap=()=>page.evaluate(()=>{const g=window.__game,p=g.player;return {level:g.getCurrentLevel().id,position:p.pos.toArray(),state:p.state,speed:p.speed,grounded:p.grounded,started:p.kiteDiagnostics.started,docked:p.kiteBonusDocked,lives:p.lives,crates:p.cratesBroken,stamp:document.querySelector('.hud-build')?.textContent};});
const ready=()=>page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&!window.__game.getBonusDeparture(),null,{timeout:120000});
const returned=async()=>{await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='coastal-street-run',null,{timeout:120000});await ready();await page.waitForTimeout(150);};
const enter=async x=>{await steer(x);await key('KeyF',true);await page.waitForFunction(()=>window.__game.player.kiteDiagnostics.started);await key('KeyF',false);
 await page.waitForFunction(()=>window.__game.player.kiteBonusDocked,null,{timeout:15000});const parent=await snap();await neutral();
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id.startsWith('bonus:'),null,{timeout:120000});await ready();return parent;};
const fail=async()=>{
 await neutral();
 // Cross the real bonus kill plane. The normal death timer and onBonusDeath
 // callback must perform the return; this does not call returnFromBonus.
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-5;p.grounded=false;p.state='air';});
 await returned();
};
try{
 await page.goto(`${base}/?playtest&level=coastal-street-run${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:150000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='coastal-street-run',null,{timeout:150000});await ready();
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();await g.player.preparePresentationAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});await ready();
 report.pad=await page.evaluate(()=>window.__game.getLevel().bonusPlatformDiagnostics);
 report.successPoint=await page.evaluate(()=>window.__game.getLevel().bonusReturnPoint().toArray());
 const pad=report.pad;assert.ok(pad);
 // Initial fixture placement only. Every return and re-entry below uses the
 // production transition and ordinary keyboard steering against live wind.
 await page.evaluate(pad=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(pad.x,pad.y-1.8+.1,pad.z+16),heading:p.pos.clone().set(0,0,-1)});},pad);
 report.before=await snap();report.beforeBonus=await enter(pad.x);report.firstEntry=await snap();
 await fail();report.firstReturn=await snap();
 assert.equal(report.firstReturn.started,false);assert.ok(report.firstReturn.grounded);assert.equal(report.firstReturn.speed,0);
 assert.ok(Math.abs(report.firstReturn.position[2]-pad.z-16)<.02);assert.ok(Math.abs(report.firstReturn.position[0]-pad.x)<.02);
 assert.equal(report.firstReturn.lives,report.beforeBonus.lives);assert.equal(report.firstReturn.crates,report.beforeBonus.crates);
 await page.waitForTimeout(700);report.waiting=await snap();assert.deepEqual(report.waiting.position,report.firstReturn.position);assert.equal(report.waiting.started,false);
 await page.screenshot({path:`${out}/${lite?'lite':'full'}-retry-ready.png`});
 await enter(pad.x);report.secondEntry=await snap();assert.ok(report.secondEntry.level.startsWith('bonus:'));
 await fail();report.secondReturn=await snap();assert.deepEqual(report.secondReturn.position,report.firstReturn.position);
 // The extra approach also permits declining the retry and taking the safe
 // side of the pad before the following planter.
 await steer(pad.x-2.1);await key('Space',true);
 await page.waitForFunction(z=>window.__game.player.pos.z<z-1||window.__game.player.state==='dead',pad.z,{timeout:15000});
 assert.equal(await page.evaluate(()=>window.__game.player.kiteBonusDocked),false);await steer(3.8);
 await page.waitForFunction(z=>window.__game.player.pos.z<z-17||window.__game.player.state==='dead',pad.z,{timeout:15000});
 report.bypass=await snap();assert.notEqual(report.bypass.state,'dead');assert.equal(report.bypass.level,'coastal-street-run');
 await neutral();
 // Explicitly exercise the completed-return branch in a separate fixture;
 // this is transition coverage, not a claim to have completed all bonus boxes.
 await page.evaluate(async pad=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(pad.x,pad.y-1.8+.1,pad.z+16),heading:p.pos.clone().set(0,0,-1)});},pad);
 await enter(pad.x);await page.evaluate(()=>window.__game.returnFromBonus(true));await returned();report.completedReturn=await snap();
 assert.ok(Math.abs(report.completedReturn.position[0]-report.successPoint[0])<.02);assert.ok(Math.abs(report.completedReturn.position[2]-report.successPoint[2])<.02);
 assert.ok(report.completedReturn.position[2]<pad.z);assert.equal(report.completedReturn.started,false);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;report.failureState=await snap().catch(()=>null);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/browser-${lite?'lite':'full'}.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,error:report.error,errors:report.errors,firstReturn:report.firstReturn,secondEntry:report.secondEntry?.level}));}
