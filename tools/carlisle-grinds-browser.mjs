import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {grindPilot} from './carlisle-grind-pilot.mjs';
const require=createRequire(import.meta.url);let pw;try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href),built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const point=api.carlislePoint,lite=process.argv.includes('--lite'),finale=process.argv.includes('--finale'),presentation=process.argv.includes('--presentation'),mode=lite?'lite':'full',base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out='docs/carlisle-relay/grinds';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),report={base,mode,errors:[],rows:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const observe=()=>page.evaluate(()=>{const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;return{at:p.pos.toArray(),state:p.state,grounded:p.grounded,forward:[f.x,0,f.z],side:[-f.z,0,f.x],speed:p.speed,vy:p.vVel,surface:p.surfaceName,spring:p.trampolineAir,mounted:p.freeSkate||p.airFromSkate,rail:p.grindRail?.object.userData.sourceName,railT:p.grindT,railTime:p.grindTime,railLength:p.grindRail?.totalLength,balance:p.balance,balanceVel:p.balanceVel,bail:p.isBailing,deaths:p.totalDeaths,time:p.runTime,screenFeet:p.renderPosition.clone().project(g.camera).toArray(),screenHead:p.renderPosition.clone().add({x:0,y:2.2,z:0}).project(g.camera).toArray()};});
const keys=new Set(),press=async input=>{
 const wanted=new Set();if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.moveY)wanted.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.jumpHeld)wanted.add('Space');if(input.grindHeld)wanted.add('KeyE');
 for(const key of [...keys])if(!wanted.has(key)){await page.keyboard.up(key);keys.delete(key);}for(const key of wanted)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
};
const place=async station=>{const at=point(station[0],station[1]+.15,station[2]??0),heading=point(station[0]+3,0).map((v,i)=>v-point(station[0],0)[i]);await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 report.source=await page.evaluate(()=>{const g=window.__game;return{components:g.getCurrentLevel().data.components.length,rails:g.getCurrentLevel().data.components.filter(c=>c.t==='rail').map(c=>c.nm),build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};});
 assert.equal(report.source.components,api.CARLISLE_TIDAL_RELAY_LEVEL.components.length);if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 for(const [i,beat] of api.CARLISLE_RELAY_GRINDS.entries()){
  if(presentation)continue;
  if(finale&&i<2)continue;
  await place(beat.start);await page.waitForTimeout(80);const pilot=grindPilot(beat,api.CARLISLE_RELAY_JUMPS,point),samples=[],captured=new Set();let completed=false;
  const row={name:beat.name,completed:false,catches:pilot.catches,launches:pilot.launches,pops:pilot.pops,samples};report.rows.push(row);
  await page.screenshot({path:`${out}/${mode}-${i+1}-approach.png`});
  for(let poll=0;poll<1800;poll++){
   const p=await observe();assert.ok(!p.bail&&!p.deaths&&!['dead','gameover'].includes(p.state),JSON.stringify({beat:beat.name,p}));
   if(p.state==='grind'&&p.railTime>.7)assert.ok([p.screenFeet,p.screenHead].every(q=>Math.abs(q[0])<1&&Math.abs(q[1])<1),'camera lost the grinder: '+JSON.stringify(p));
   const control=pilot.sample(p);if(poll%4===0)samples.push({...p,input:control.input});
   if(control.done){completed=true;break;}await press(control.input);
   const shot=p.state==='grind'?`rail-${beat.rails.findIndex(r=>r.name===p.rail)+1}${p.railTime>1.2?'-settled':''}`:p.spring&&Math.abs(p.vy)<4?'apex':null;
   if(shot&&!captured.has(shot)){captured.add(shot);await page.screenshot({path:`${out}/${mode}-${i+1}-${shot}.png`});}
   await page.waitForTimeout(16);
  }
  await press({});Object.assign(row,{completed,end:await observe()});
  assert.ok(completed,JSON.stringify(row));assert.deepEqual(pilot.catches,beat.rails.map(r=>r.name));assert.deepEqual(pilot.launches,beat.launches);
  await page.screenshot({path:`${out}/${mode}-${i+1}-exit.png`});
 }
 // Resolution changes compile shaders and interrupt external keyboard
 // feedback. Inspect the normal presentation after the continuous routes.
 if(!lite){
  // Finishing locks the victory camera; respawn alone does not clear that flow.
  await page.reload({waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await place(api.CARLISLE_RELAY_GRINDS[0].start);await page.waitForTimeout(500);
  await page.screenshot({path:`${out}/full-normal.png`});report.normalPresentation=await observe();
  assert.ok(report.normalPresentation.grounded&&report.normalPresentation.state==='ride');
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({mode,source:report.source,rows:report.rows.map(({samples,...row})=>row),errors:report.errors}));
}catch(error){report.failure={message:error.message,player:await observe()};throw error;}
finally{await press({}).catch(()=>{});await writeFile(`${out}/${mode}${presentation?'-presentation':finale?'-finale':''}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
