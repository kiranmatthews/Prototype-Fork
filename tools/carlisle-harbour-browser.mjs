import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {harbourPilot} from './carlisle-harbour-pilot.mjs';
const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const load=async entry=>{const b=await build({entryPoints:[entry],bundle:true,format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));};
const api=await load('src/levels/carlisle-harbour-bonus.ts'),coast=await load('src/levels/carlisle-tidal-relay.ts');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out='docs/carlisle-relay/harbour-bonus',lite=process.argv.includes('--lite'),mode=lite?'lite':'full';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
const report={mode,base,errors:[],shots:[],trace:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const observe=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),data=g.getCurrentLevel().data;return{
 id:g.getCurrentLevel().id,at:p.pos.toArray(),time:p.runTime,levelTime:l.time,grounded:p.grounded,state:p.state,vy:p.vVel,spring:p.trampolineAir,
 surface:p.surfaceName,bail:p.isBailing,deaths:p.totalDeaths,cratesBroken:p.cratesBroken,bonusCrates:p.bonusCrates,lives:p.lives,fruit:p.fruit,
 boats:l.movers.map(m=>({name:data.components[m.mesh.userData.editorIdx]?.nm,x:m.mesh.position.x,right:m.mesh.position.x+(m.mesh.geometry.boundingBox?.max.x??0)})),
 crates:l.crates.map(c=>({name:data.components[c.mesh.userData.editorIdx]?.nm??'',at:c.mesh.position.toArray(),alive:c.alive}))};});
const keys=new Set(),press=async input=>{
 const wanted=new Set();if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.moveY)wanted.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.jumpHeld)wanted.add('Space');if(input.spinHeld)wanted.add('KeyF');
 for(const k of [...keys])if(!wanted.has(k)){await page.keyboard.up(k);keys.delete(k);}for(const k of wanted)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}
};
const shot=async name=>{await page.screenshot({path:`${out}/${mode}-${name}.png`});report.shots.push(name);};
const ready=async id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
const parent=async()=>{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});await ready('carlisle-coast');
 await page.evaluate(async native=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(native?null:480);g.crtGuestSettings.setEnabled(!native);},true);
 const at=coast.carlislePoint(2007.3,24.12,-5),f=coast.carlislePoint(2011,0),a=coast.carlislePoint(2010,0);
 await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading:[f[0]-a[0],0,f[2]-a[2]]});
 await page.waitForTimeout(200);return observe();
};
const enter=async()=>{
 const pad=await page.evaluate(()=>window.__game.getLevel().bonusPlatformDiagnostics);assert.ok(pad?.modelReady,'authored parent bonus entrance missing');
 await press({jumpHeld:true});await page.waitForTimeout(430);await press({moveY:1});
 for(let poll=0;poll<150;poll++){
  const p=await observe();if(p.id==='bonus:carlisle-coast')break;
  const distance=Math.hypot(p.at[0]-pad.x,p.at[2]-pad.z);if(distance<.55)await press({});
  await page.waitForTimeout(16);
 }
 await press({});await ready('bonus:carlisle-coast');
 await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:10000});
 return observe();
};
try{
 report.parentBefore=await parent();await shot('entrance');report.entered=await enter();
 report.source=await page.evaluate(expected=>{const g=window.__game,d=g.getCurrentLevel().data,diffs=[];function compare(a,b,p){
  if(a===b||diffs.length>5)return;if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-8)return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],p+'.'+k);}else diffs.push(p);
 }compare(d,expected,'bonus');return{diffs,build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};},api.CARLISLE_HARBOUR_BONUS);
 assert.deepEqual(report.source.diffs,[]);if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 const pilot=harbourPilot(api.CARLISLE_HARBOUR_BOATS),captured=new Set();let cleared=false;
 await shot('arrival');
 for(let poll=0;poll<6000;poll++){
  const p=await observe();if(p.id==='carlisle-coast'){cleared=true;break;}
  assert.ok(!p.bail&&!['dead','gameover'].includes(p.state),JSON.stringify(p));
  const control=pilot.sample(p);if(poll%4===0)report.trace.push({...p,crates:undefined,stage:control.stage});
  if(control.done){report.bonusEnd=p;await press({});await ready('carlisle-coast');cleared=true;break;}
  await press(control.input);
  const name=p.grounded&&p.boats.some(b=>b.name===p.surface)?p.surface.replaceAll(' ','-').toLowerCase():p.spring&&Math.abs(p.vy)<4?p.surface.replaceAll(' ','-').toLowerCase()+'-apex':null;
  if(name&&!captured.has(name)){captured.add(name);await shot(name);}
  await page.waitForTimeout(16);
 }
 await press({});assert.ok(cleared,'bonus did not complete');await ready('carlisle-coast');await page.waitForTimeout(300);
 report.history=pilot.history;report.parentAfter=await observe();
 assert.equal(report.parentAfter.bonusCrates,21);assert.equal(report.parentAfter.deaths,report.parentBefore.deaths);
 assert.ok(Math.hypot(...report.parentAfter.at.map((v,i)=>v-coast.carlislePoint(2013,24.12)[i]))<1);
 report.completedLocked=await page.evaluate(()=>window.__game.getLevel().bonusRoundCompleted);assert.equal(report.completedLocked,true);await shot('banked-return');
 // A fresh optional visit tests real water failure and restoration of the
 // suspended parent purse. The only new placement is its initial approach.
 report.failureBefore=await parent();await enter();await press({moveY:0,moveX:1});
 // Walking left off the first quay reaches the water without using a launcher.
 await press({moveX:-1});await ready('carlisle-coast');await press({});await page.waitForTimeout(250);
 report.failureReturn=await observe();assert.equal(report.failureReturn.lives,report.failureBefore.lives);
 assert.equal(report.failureReturn.bonusCrates,0);assert.equal(report.failureReturn.deaths,report.failureBefore.deaths);
 report.failureUnlocked=await page.evaluate(()=>!window.__game.getLevel().bonusRoundCompleted);assert.equal(report.failureUnlocked,true);
 if(!lite){
  await page.goto(`${base}/?playtest&level=bonus-carlisle-coast`,{waitUntil:'domcontentloaded',timeout:180000});await ready('bonus-carlisle-coast');
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await shot('normal-arrival');
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(64,1.32,0),heading:p.pos.clone().set(1,0,0)});});
  await page.waitForTimeout(250);await shot('normal-linked-skiffs');
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({mode,source:report.source,banked:report.parentAfter.bonusCrates,returned:true,waterFailureRestored:true,errors:report.errors}));
}catch(error){report.failure={message:error.message,player:await observe()};throw error;}
finally{await press({}).catch(()=>{});await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
