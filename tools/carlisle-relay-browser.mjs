import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let pw;try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point,CARLISLE_RELAY_STOPS:stops,CARLISLE_TIDAL_RELAY_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const base=(process.env.CARLISLE_BASE??'http://127.0.0.1:5483').replace(/\/$/,''),lite=process.argv.includes('--lite'),mode=lite?'lite':'full',out=process.env.CARLISLE_OUT??'docs/carlisle-relay';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),report={base,mode,errors:[],captures:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const snap=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,checkpoint:l.checkpoints.findIndex(c=>c.active),build:document.querySelector('.hud-build')?.textContent,render:g.getRenderFrameStats()};});
const place=async(position,heading=[0,0,-1])=>{await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(...position),heading:p.pos.clone().set(...heading)});}, {position,heading});await page.waitForTimeout(450);};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 await page.waitForFunction(()=>window.__game.player.grounded);report.spawn=await snap();assert.match(report.spawn.build,/Codex\/sol fork/);
 report.sourceMatches=await page.evaluate(expected=>JSON.stringify(window.__game.getCurrentLevel().data)===JSON.stringify(expected),data);assert.ok(report.sourceMatches,'browser did not load the current authored level');
 await page.screenshot({path:`${out}/${mode}-start-native.png`});
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(1500);await page.keyboard.up('ArrowUp');report.walk=await snap();assert.equal(report.walk.deaths,0);assert.ok(report.walk.position[2]<report.spawn.position[2]-5);
 // A real native neutral bounce, observed without movement input.
 await place(point(65,.15));await page.waitForFunction(()=>window.__game.player.pos.y>8);report.bounce=await snap();
 assert.ok(Math.hypot(report.bounce.position[0]-point(65,0)[0],report.bounce.position[2]-point(65,0)[2])<.2);
 await page.screenshot({path:`${out}/${mode}-native-bounce.png`});
 // Follow a giant held bounce through its apex with real movement input.
 await page.keyboard.down('Space');await place(point(3835,24.15));await page.keyboard.down('ArrowUp');
 await page.waitForFunction(()=>window.__game.player.pos.y>90&&window.__game.player.vVel<2,null,{timeout:15000});
 report.apex=await page.evaluate(target=>{const g=window.__game,v=g.player.pos.clone().set(...target).project(g.camera);return{height:g.player.pos.y,targetNdc:v.toArray(),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],preset:g.renderQualitySettings.regularResolution};},point(3875,52,-4));
 await page.screenshot({path:`${out}/${mode}-giant-bounce-apex.png`});await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');
 assert.ok(Math.abs(report.apex.targetNdc[0])<1&&Math.abs(report.apex.targetNdc[1])<1,'next landing left the camera at the apex');
 if(!lite){assert.equal(report.apex.preset,'max');assert.deepEqual(report.apex.canvas,[1440,900]);}
 // Checkpoint contact, then real death/respawn at the earned island.
 const cp=await page.evaluate(()=>{const c=window.__game.getLevel().checkpoints[0];return[c.box.min.x+.5,c.box.min.y+.12,c.box.max.z+1];});
 await place(cp);await page.keyboard.press('KeyF',{delay:180});
 await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active,null,{timeout:12000});report.checkpoint=await snap();
 const respawn=await page.evaluate(()=>window.__game.getLevel().currentSpawn.toArray()),snapVersion=await page.evaluate(()=>window.__game.player.renderSnapVersion);
 await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-10;p.grounded=false;p.state='air';p.vVel=-10;});
 await page.waitForFunction(version=>window.__game.player.renderSnapVersion>version&&window.__game.player.grounded,snapVersion,{timeout:30000});report.respawn=await snap();
 assert.ok(Math.hypot(...report.respawn.position.map((v,i)=>v-respawn[i]))<2);
 for(const index of [1,5,6,8,11,13,15,16,17]){
  const stop=stops[index],position=point(stop.s,stop.y+.2);await place(position);await page.screenshot({path:`${out}/${mode}-section-${String(index+1).padStart(2,'0')}.png`});report.captures.push({name:stop.name,...await snap()});
 }
 // Inspect moving-deck silhouettes, collision transforms and native resolution.
 report.machines=await page.evaluate(async()=>{const g=window.__game,l=g.getLevel(),before=l.movers.map(m=>m.mesh.matrixWorld.elements.slice());await new Promise(r=>setTimeout(r,500));
  return{count:l.movers.length,changed:l.movers.filter((m,i)=>m.mesh.matrixWorld.elements.some((v,j)=>Math.abs(v-before[i][j])>.00001)).length,preset:g.renderQualitySettings.regularResolution,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],resolution:g.getRenderQualitySizes()};});
 if(!lite){await place(point(2930,24.2));await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(300);await page.screenshot({path:`${out}/full-normal.png`});await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});}
 await place(point(3984,12.2),point(4000,0).map((v,i)=>i===1?0:v-point(3984,0)[i]));
 await page.screenshot({path:`${out}/${mode}-finish-native.png`});
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:12000});await page.keyboard.up('ArrowUp');report.finish=await snap();
 assert.equal(report.errors.length,0,report.errors.join('\n'));console.log(JSON.stringify({mode,spawn:true,walk:true,nativeBounce:true,checkpoint:true,respawn:true,finish:true,machines:report.machines,errors:report.errors}));
}finally{await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
