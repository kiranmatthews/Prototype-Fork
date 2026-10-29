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
const cameraSample=()=>page.evaluate(()=>{const g=window.__game,d=g.player.pos.clone();g.camera.getWorldDirection(d);return{fov:g.camera.fov,pitch:Math.asin(-d.y)*180/Math.PI,spring:g.player.trampolineCameraTarget};});
const place=async(position,heading=[0,0,-1])=>{await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(...position),heading:p.pos.clone().set(...heading)});}, {position,heading});await page.waitForTimeout(450);};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 await page.waitForFunction(()=>window.__game.player.grounded);report.spawn=await snap();assert.match(report.spawn.build,/Codex\/sol fork/);
 report.groundCamera=await cameraSample();assert.ok(Math.abs(report.groundCamera.fov-49)<.01);assert.ok(Math.abs(report.groundCamera.pitch-25.35)<.1);assert.equal(report.groundCamera.spring,0);
 report.sourceDifferences=await page.evaluate(expected=>{const differences=[];function compare(a,b,path){if(differences.length>=12||a===b)return;if(typeof a==='number'&&typeof b==='number'&&Math.abs(a-b)<1e-8)return;
  if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const key of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[key],b[key],`${path}.${key}`);}
  else differences.push({path,actual:a,expected:b});}compare(window.__game.getCurrentLevel().data,expected,'level');return differences;},data);
 report.sourceMatches=report.sourceDifferences.length===0;assert.ok(report.sourceMatches,JSON.stringify(report.sourceDifferences));
 await page.screenshot({path:`${out}/${mode}-start-native.png`});
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(1500);await page.keyboard.up('ArrowUp');report.walk=await snap();assert.equal(report.walk.deaths,0);assert.ok(report.walk.position[2]<report.spawn.position[2]-5);
 // A real native neutral bounce, observed without movement input.
 await place(point(65,.35));await page.waitForFunction(()=>window.__game.player.pos.y>8);report.bounce=await snap();
 assert.ok(Math.hypot(report.bounce.position[0]-point(65,0)[0],report.bounce.position[2]-point(65,0)[2])<.2);
 await page.screenshot({path:`${out}/${mode}-native-bounce.png`});
 // Follow a giant held bounce through its apex with real movement input.
 await page.keyboard.down('Space');await place(point(3835,24.35));await page.keyboard.down('ArrowUp');
 await page.waitForFunction(()=>window.__game.player.pos.y>90&&window.__game.player.vVel<2,null,{timeout:15000});
 report.apex=await page.evaluate(target=>{const g=window.__game,v=g.player.pos.clone().set(...target).project(g.camera);return{height:g.player.pos.y,targetNdc:v.toArray(),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],preset:g.renderQualitySettings.regularResolution};},point(3875,52,-4));
 await page.screenshot({path:`${out}/${mode}-giant-bounce-apex.png`});await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');
 report.airCamera=await cameraSample();assert.ok(report.airCamera.fov>70);assert.ok(report.airCamera.pitch>78&&report.airCamera.pitch<82);assert.ok(report.airCamera.spring>.99);
 assert.ok(Math.abs(report.apex.targetNdc[0])<1&&Math.abs(report.apex.targetNdc[1])<1,'next landing left the camera at the apex');
 if(!lite){assert.equal(report.apex.preset,'max');assert.deepEqual(report.apex.canvas,[1440,900]);}
 // Mount through ordinary input, ride onto the spring, sidestep, then use the
 // existing fresh press/release to abandon the board during the bounce.
 await place(point(45,.2),point(65,0).map((v,i)=>i===1?0:v-point(45,0)[i]));
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
 report.boardApproach=await page.evaluate(async()=>{const rows=[];for(let i=0;i<600;i++){await new Promise(requestAnimationFrame);const p=window.__game.player;
  if(i%12===0||p.trampolineAir&&p.bounceJump)rows.push({position:p.pos.toArray(),state:p.state,board:p.boardRolling,spring:p.trampolineAir,bounce:p.bounceJump,speed:p.speed,charge:p.skateChargeT,charging:p.charging,held:p.rawInput.jumpHeld,blocked:p.boardMountBlocked});
  if(p.trampolineAir&&p.bounceJump)return rows;}return rows;});
 assert.equal(report.boardApproach.at(-1).board,true,JSON.stringify(report.boardApproach));
 await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');
 const mounted=await page.evaluate(()=>{const p=window.__game.player,cf=p.courseInputDirection(window.__game.getLevel())??p.camDir;return{at:p.pos.toArray(),side:[-cf.z,0,cf.x],time:p.runTime,speed:p.speed,ejected:p.emergencyEjectLandingPending};});assert.equal(mounted.ejected,false);
 await page.keyboard.down('ArrowRight');await page.waitForFunction(t=>window.__game.player.runTime-t>=.3,mounted.time);await page.keyboard.up('ArrowRight');
 const sideways=await page.evaluate(a=>{const p=window.__game.player;return p.pos.toArray().reduce((sum,v,i)=>sum+(v-a.at[i])*a.side[i],0);},mounted);
 report.sidestep={...mounted,sideways,...await snap()};assert.ok(sideways>3.5,JSON.stringify(report.sidestep));
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.emergencyEjectCharging);await page.keyboard.up('Space');
 await page.waitForFunction(()=>window.__game.player.emergencyEjectLandingPending);
 report.abandon=await page.evaluate(sideways=>{const g=window.__game,p=g.player;return{sideways,move:p.lastJumpType,board:p.boardRolling,looseBoard:!!p.looseBoard,double:p.doubleJumpAir,speed:p.speed,screenFeet:p.renderPosition.clone().project(g.camera).toArray(),screenHead:p.renderPosition.clone().add({x:0,y:2.2,z:0}).project(g.camera).toArray()};},sideways);
 assert.equal(report.abandon.move,'Emergency Eject');assert.equal(report.abandon.board,false);assert.equal(report.abandon.looseBoard,true);assert.equal(report.abandon.double,false);
 assert.ok([report.abandon.screenFeet,report.abandon.screenHead].every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1),'camera lost the rider during the fast ascent/abandon');
 await page.screenshot({path:`${out}/${mode}-abandon.png`});
 // Walk and bounce continuously through the replacement for the replay's
 // broken wheel. Only device keys change after this initial checkpoint start.
 await place(point(1770,16.2),point(1775,0).map((v,i)=>i===1?0:v-point(1770,0)[i]));
 const terraceTargets=[point(1792,16),point(1828,32,-6),point(1864,48,6),point(1895,48)];
 let terraceNext=0,terraceDone=false,terraceApex=false;const terraceKeys=new Set(),terraceSamples=[];
 const applyTerraceKeys=async wanted=>{for(const key of [...terraceKeys])if(!wanted.has(key)){await page.keyboard.up(key);terraceKeys.delete(key);}for(const key of wanted)if(!terraceKeys.has(key)){await page.keyboard.down(key);terraceKeys.add(key);}};
 for(let poll=0;poll<700;poll++){
  const s=await page.evaluate(()=>{const p=window.__game.player;return{at:p.pos.toArray(),state:p.state,grounded:p.grounded,vy:p.vVel,surface:p.surfaceName,bail:p.isBailing,dir:p.camDir.toArray(),time:p.runTime};});
  assert.ok(!s.bail&&!['dead','gameover'].includes(s.state),JSON.stringify(s));
  if(s.state==='air'&&s.vy>10){if(s.surface==='Dredger terraces · 1')terraceNext=Math.max(terraceNext,1);if(s.surface==='Dredger terraces · 2')terraceNext=Math.max(terraceNext,2);}
  if(terraceNext===2&&s.grounded&&Math.abs(s.at[1]-48)<.1)terraceNext=3;
  const target=terraceTargets[terraceNext],dx=target[0]-s.at[0],dz=target[2]-s.at[2],distance=Math.hypot(dx,dz);
  if(poll%5===0)terraceSamples.push({...s,next:terraceNext});
  if(terraceNext===3&&distance<2&&s.grounded){terraceDone=true;break;}
  const forward=dx*s.dir[0]+dz*s.dir[2],side=dx*-s.dir[2]+dz*s.dir[0],wanted=new Set();
  if(Math.abs(forward)>1.2)wanted.add(forward>0?'ArrowUp':'ArrowDown');
  if(Math.abs(side)>1.2)wanted.add(side>0?'ArrowRight':'ArrowLeft');
  if(terraceNext===1||terraceNext===0&&distance<8.5)wanted.add('Space');
  await applyTerraceKeys(wanted);
  if(!terraceApex&&terraceNext===1&&s.vy<2&&s.at[1]>50){await page.screenshot({path:`${out}/${mode}-terraces-apex.png`});terraceApex=true;}
  await page.waitForTimeout(80);
 }
 await applyTerraceKeys(new Set());report.terraces={done:terraceDone,apexCaptured:terraceApex,samples:terraceSamples,...await snap()};
 assert.ok(terraceDone,JSON.stringify(report.terraces));
 await page.screenshot({path:`${out}/${mode}-terraces-exit.png`});
 // Checkpoint contact, then real death/respawn at the earned island.
 const cp=await page.evaluate(()=>{const c=window.__game.getLevel().checkpoints[0];return[c.box.min.x+.5,c.box.min.y+.12,c.box.max.z+1];});
 await place(cp);await page.keyboard.press('KeyF',{delay:180});
 await page.waitForFunction(()=>window.__game.getLevel().checkpoints[0].active,null,{timeout:12000});report.checkpoint=await snap();
 report.returnCamera=await cameraSample();assert.ok(Math.abs(report.returnCamera.fov-49)<.01);assert.ok(Math.abs(report.returnCamera.pitch-25.35)<.1);
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
 if(!lite){await place(point(1770,16.2));await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(300);await page.screenshot({path:`${out}/full-normal.png`});await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});}
 await place(point(3984,12.2),point(4000,0).map((v,i)=>i===1?0:v-point(3984,0)[i]));
 await page.screenshot({path:`${out}/${mode}-finish-native.png`});
 await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:12000});await page.keyboard.up('ArrowUp');report.finish=await snap();
 assert.equal(report.errors.length,0,report.errors.join('\n'));console.log(JSON.stringify({mode,spawn:true,walk:true,nativeBounce:true,checkpoint:true,respawn:true,finish:true,machines:report.machines,errors:report.errors}));
}catch(error){report.failure={message:error.message,...await snap(),controls:await page.evaluate(()=>{const p=window.__game.player;return{mounted:p.freeSkate,bounce:p.bounceJump,spring:p.trampolineAir,type:p.lastJumpType,speed:p.speed,bail:p.isBailing};})};throw error;
}finally{await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
