import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {cargoPilot} from './carlisle-cargo-pilot.mjs';
const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href),b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const lite=process.argv.includes('--lite'),mode=lite?'lite':'full',base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out='docs/carlisle-relay/cargo';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),report={mode,base,errors:[],bridges:[],views:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const observe=()=>page.evaluate(()=>{const g=window.__game,p=g.player;return{at:p.pos.toArray(),time:p.runTime,state:p.state,grounded:p.grounded,side:p.axisL.toArray(),balance:p.balance,balanceVel:p.balanceVel,
 crateRail:!!p.grindRail&&g.getLevel().isCrateRail(p.grindRail),bail:p.isBailing,deaths:p.totalDeaths,broken:g.getLevel().crates.filter(c=>!c.alive).length};});
const place=async(at,heading=[0,0,-1])=>{
 await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});
 await page.waitForTimeout(80);
};
const keys=new Set(),press=async input=>{
 const wanted=new Set();if(input.moveX)wanted.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.moveY)wanted.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.jumpHeld)wanted.add('Space');if(input.grindHeld)wanted.add('KeyE');
 for(const k of [...keys])if(!wanted.has(k)){await page.keyboard.up(k);keys.delete(k);}for(const k of wanted)if(!keys.has(k)){await page.keyboard.down(k);keys.add(k);}
};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 report.source=await page.evaluate(expected=>{const g=window.__game,actual=g.getCurrentLevel().data,differences=[];function compare(a,b,path){
  if(differences.length>=8||a===b)return;if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-8)return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],path+'.'+k);}else differences.push(path);
 }compare(actual,expected,'level');return{differences,crates:g.getLevel().crates.length,build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};},api.CARLISLE_TIDAL_RELAY_LEVEL);
 assert.deepEqual(report.source.differences,[]);if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 for(const [i,bridge] of api.CARLISLE_RELAY_CARGO.entries()){
  await place([bridge.woodX,bridge.baseY+.12,bridge.firstZ+3.2]);
  await page.screenshot({path:`${out}/${mode}-bridge-${i+1}-entry.png`});
  const pilot=cargoPilot(bridge),samples=[];let done=false,grinds=0,shot=false;
  for(let poll=0;poll<500;poll++){
   const p=await observe();samples.push(p);assert.ok(!p.bail&&!p.deaths&&!['dead','gameover'].includes(p.state),JSON.stringify(p));
   const control=pilot(p);if(control.done){done=true;break;}if(p.state==='grind')grinds++;
   await press(control.input);
   if(p.state==='grind'&&!shot){shot=true;await page.screenshot({path:`${out}/${mode}-bridge-${i+1}-grind.png`});}
   await page.waitForTimeout(16);
  }
  await press({});const row={name:bridge.name,done,grinds,end:await observe(),samples};report.bridges.push(row);
  assert.ok(done&&grinds>2&&row.end.broken>=4,JSON.stringify({...row,samples:undefined}));
 }
 for(const [name,s,y,u] of [['starter',2,.12,0],['scissor-stack',257,1.17,0],['winch-bundle',902,5.07,-2.5],
  ['counterweight-stairs',2239,24.12,3],['rigging-parcels',3356,24.12,2.6],['harbour-fan',3972,12.12,0]]){
  await place(api.carlislePoint(s,y,u));await page.screenshot({path:`${out}/${mode}-${name}.png`});report.views.push(name);
 }
 if(!lite){
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  for(const [name,s,y,u] of [['starter',2,.12,0],['counterweight-stairs',2239,24.12,3],['cargo-trestle',1986,24.12,0]]){
   await place(api.carlislePoint(s,y,u));await page.screenshot({path:`${out}/normal-${name}.png`});
  }
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({...report,bridges:report.bridges.map(({samples,...r})=>r)}));
}catch(error){report.failure={message:error.message,player:await observe()};throw error;}
finally{await press({}).catch(()=>{});await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
