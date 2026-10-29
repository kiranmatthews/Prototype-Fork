import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {crossingPilot} from './carlisle-crossing-pilot.mjs';
const require=createRequire(import.meta.url);let pw;try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href),built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const point=api.carlislePoint,runs=api.CARLISLE_RELAY_CROSSINGS,lite=process.argv.includes('--lite'),mode=lite?'lite':'full';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.CARLISLE_OUT??'docs/carlisle-relay/slippery';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),report={mode,base,errors:[],crossings:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const observe=()=>page.evaluate(()=>{const p=window.__game.player;return{at:p.pos.toArray(),velocity:p.walkVelocity.toArray(),side:p.axisL.toArray(),grounded:p.grounded,spring:p.trampolineAir,vy:p.vVel,state:p.state,bail:p.isBailing,deaths:p.totalDeaths,time:p.runTime,wet:!!p.groundHit?.slipGravity};});
const place=async(s,y,u=0)=>{const at=point(s,y,u),heading=point(s+2,0).map((v,i)=>v-point(s,0)[i]);await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});await page.waitForTimeout(80);};
const keys=new Set();
const press=async wanted=>{for(const key of [...keys])if(!wanted.has(key)){await page.keyboard.up(key);keys.delete(key);}for(const key of wanted)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 report.source=await page.evaluate(()=>{const g=window.__game,d=g.getCurrentLevel().data;return{components:d.components.length,slippery:d.components.filter(c=>c.slipGravity===1).length,build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};});
 assert.equal(report.source.components,api.CARLISLE_TIDAL_RELAY_LEVEL.components.length);assert.equal(report.source.slippery,api.CARLISLE_TIDAL_RELAY_LEVEL.components.filter(c=>c.slipGravity===1).length);
 if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 // The same input-only driver used in native simulation, with real device
 // keys and feedback from the browser's actual fixed simulation clock.
 for(const index of [0,14,18]){
  const run=runs[index],s=Math.max(run.a+1,0),u=run.bounds(s).reduce((a,b)=>a+b)/2;
  await place(s,run.height(s,u)+.15,u);const pilot=crossingPilot(run,point);let previous=null,done=false,frames=0,wet=0,apex=false;const samples=[];
  await page.screenshot({path:`${out}/${mode}-crossing-${index+1}-entry.png`});
  for(;frames<1000;frames++){
   const p=await observe();assert.ok(!p.bail&&!['dead','gameover'].includes(p.state),JSON.stringify({index,p}));
   const control=pilot(p,previous===null?1/60:Math.max(1/120,Math.min(.1,p.time-previous)));previous=p.time;
   if(p.wet)wet++;if(frames%6===0)samples.push({...p,s:control.s,u:control.u});
   if(control.done){done=true;break;}
   const input=control.input,wanted=new Set(['ArrowUp']);
   if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.jumpHeld)wanted.add('Space');
   await press(wanted);
   if(!apex&&p.wet&&control.s>run.a+16){await page.screenshot({path:`${out}/${mode}-crossing-${index+1}-slide.png`});apex=true;}
   await page.waitForTimeout(32);
  }
  await press(new Set());const row={name:run.name,done,wet,samples,end:await observe()};report.crossings.push(row);assert.ok(done&&wet>0,JSON.stringify(row));
 }
 // Observe gravity with neutral input: no authored velocity or forces are
 // injected into the player after this initial placement.
 const run=runs[0],s=24;await place(s,run.height(s,0)+.15);
 const before=await observe();await page.waitForTimeout(700);const after=await observe();
 report.neutralDrift={before,after,distance:Math.hypot(after.at[0]-before.at[0],after.at[2]-before.at[2])};
 assert.ok(report.neutralDrift.distance>1&&after.wet,JSON.stringify(report.neutralDrift));
 await page.screenshot({path:`${out}/${mode}-neutral-slide.png`});
 // Inspect the sharpest banks from normal gameplay framing at native size.
 for(const index of [2,12,16,19]){const run=runs[index];let s=run.a+4;for(let x=run.a+4;x<run.b-4;x++)if(Math.abs(run.bank(x))>Math.abs(run.bank(s)))s=x;
  await place(s-6,run.height(s-6,0)+.15);await page.screenshot({path:`${out}/${mode}-bank-${index+1}.png`});}
 if(!lite){await place(18,.15);await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(200);await page.screenshot({path:`${out}/full-normal.png`});await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});}
 const hazard=runs[0].hazards[0];await place(hazard.s,hazard.y+.12,hazard.u);
 await page.evaluate(()=>{const p=window.__game.player;p.masks=0;p.invulnTimer=0;p.uberTimer=0;});
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:4000});report.hazardDeath=true;
 // Checkpoint activation and a real fall restore the small dry restart island.
 await place(202,.15);await page.keyboard.press('KeyF',{delay:180});
 await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active,null,{timeout:10000});
 const version=await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-10;p.grounded=false;p.state='air';p.vVel=-10;return p.renderSnapVersion;});
 await page.waitForFunction(v=>{const p=window.__game.player;return p.renderSnapVersion>v&&p.grounded;},version,{timeout:30000});
 report.restart=await observe();assert.equal(report.restart.wet,false);
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({mode,source:report.source,crossings:report.crossings.map(({samples,...r})=>r),neutralDrift:report.neutralDrift.distance,hazardDeath:true,restart:report.restart,errors:report.errors}));
}catch(error){report.failure={message:error.message,player:await observe()};throw error;}
finally{await press(new Set()).catch(()=>{});await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
