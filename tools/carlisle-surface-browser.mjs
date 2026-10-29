import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href),b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484',out='docs/carlisle-relay/surface-cleanup',point=api.carlislePoint;
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),report={base,errors:[],views:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const place=async(s,y,u=0)=>{const at=point(s,y,u),heading=point(s+2,0).map((v,i)=>i===1?0:v-point(s,0)[i]);
 await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});await page.waitForTimeout(250);};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 report.source=await page.evaluate(expected=>{const g=window.__game,differences=[];function compare(a,b,path){
  if(differences.length>=8||a===b)return;if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-8)return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],path+'.'+k);}
  else differences.push({path,actual:a,expected:b});
 }compare(g.getCurrentLevel().data,expected,'level');return{differences,build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};},api.CARLISLE_TIDAL_RELAY_LEVEL);
 assert.deepEqual(report.source.differences,[]);assert.deepEqual(report.source.canvas,[1440,900]);
 for(const [name,s,y,u=0] of [['checkpoint-join',195,.15],['scissor-join',222,.15],['scissor-hub',260,1.2],['winch-join',870,4.15,-5],
  ['dial-join',1346,12.15],['pinwheel-join',1542,16.15],['spring-berth',1778,16.15],['terrace-berth',1818,32.15,-13],
  ['dry-connector',2008,24.15],['moving-spring-berth',2017,24.15],['counterweight-gaps',2259,24.15],['harbour-scissors',2600,24.15],['dry-harbour',3967,12.15]]){
  await place(s,y,u);await page.screenshot({path:`${out}/full-${name}.png`});report.views.push({name,s});
 }
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
 for(const [name,s,y] of [['checkpoint-join',195,.15],['spring-berth',1778,16.15],['harbour-scissors',2600,24.15]]){
  await place(s,y);await page.screenshot({path:`${out}/normal-${name}.png`});
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}catch(error){report.failure=error.message;throw error;}
finally{await writeFile(`${out}/surface-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
