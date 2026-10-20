// Player-camera storyboard capture. Six overlapping views cover the full bonus.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let module;try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
const {chromium}=await import(module);
const base=process.env.CARLISLE_URL||'http://127.0.0.1:5240';
const stage=process.argv.includes('--after')?'after':'before';
const out=`docs/carlisle-bonus/${stage}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const scenes=[['01-arrival',-5],['02-fuse-court',9],['03-switch-approach',25],['04-chasm',35],['05-receiver',54],['06-return-sanctuary',68]];
try{
 await page.goto(`${base}/?playtest&level=bonus-test-course${process.argv.includes('--lite')?'&lite':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.restoreBuiltin('bonus-test-course');await g.switchLevel('bonus-test-course');await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(process.argv.includes('--clean')){
  await page.addStyleTag({content:'.game-hud-layer,.hud-build,#render-diagnostics,#frame-probe {display:none!important}'});
  await page.evaluate(()=>{const g=window.__game;g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};g.player.drawFlyingFruit=()=>{};});
 }
 const report={stage,base,errors,scenes:[]};
 for(const [name,x] of scenes){
  await page.evaluate(x=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(x,.15,0),heading:p.camDir.clone().set(1,0,0)});p.lives=30;p.invulnTimer=100;p.invulnSilent=true;},x);
  await page.waitForTimeout(2000);
  await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(600);
  await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const snapshot=await page.evaluate(()=>{const g=window.__game,p=g.player;return {position:p.pos.toArray(),grounded:p.grounded,camera:g.camera.position.toArray(),level:g.getCurrentLevel().id,assets:g.getLevel().jungleAssetDiagnostics,stamp:document.querySelector('.hud-build')?.textContent};});
  assert.ok(Math.abs(snapshot.position[0]-x)<.2,`${name}: no reload or death during the capture`);
  assert.equal(snapshot.grounded,true,`${name}: supported player view`);
  await page.screenshot({path:`${out}/${name}.png`});report.scenes.push({name,...snapshot});
  console.log(JSON.stringify({name,grounded:snapshot.grounded,position:snapshot.position,camera:snapshot.camera}));
 }
 await writeFile(`${out}/capture.json`,JSON.stringify(report,null,2)+'\n');
 if(errors.length)throw Error(JSON.stringify(errors));
}finally{await browser.close();}
