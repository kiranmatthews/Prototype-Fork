import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {build} from 'esbuild';
const out='art/carlisle-shipyard/integration',base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483';
const source=JSON.parse(await readFile('docs/carlisle-relay/shipyard-polish/captures.json','utf8'));
const quick=process.argv.includes('--quick');
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const shots=quick?source.captures.filter((_,i)=>[0,1,5,6,15,18,19].includes(i)):source.captures;
await mkdir(out+'/review',{recursive:true});
const report={errors:[],captures:[],quick};
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
try{
 await page.goto(base+'/?playtest&level=carlisle-coast'+(process.argv.includes('--lite')?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);return{art:g.getLevel().carlisleShipyardDiagnostics,cones:g.getLevel().carlisleConeDiagnostics,grounds:g.getLevel().groundMeshes.length}});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.art.sections,18);assert.equal(report.main.art.models,12);
 await page.waitForFunction(()=>window.__game.player.grounded);
 await page.screenshot({path:out+'/review/player-native.png'});
 if(process.argv.includes('--play')){
  const point=api.carlislePoint;
  report.spawn=await page.evaluate(()=>{const g=window.__game;return{at:g.player.pos.toArray(),fov:g.camera.fov,grounded:g.player.grounded}});
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);await page.keyboard.up('ArrowUp');
  report.walk=await page.evaluate(()=>({at:window.__game.player.pos.toArray(),deaths:window.__game.player.totalDeaths}));
  assert.ok(report.walk.at[2]<report.spawn.at[2]-3);assert.equal(report.walk.deaths,0);
  await page.evaluate(({at,heading})=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...at),heading:g.player.pos.clone().set(...heading)})},{at:point(57,.2),heading:point(65,0).map((v,i)=>i===1?0:v-point(57,0)[i])});
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
  await page.waitForFunction(()=>{const p=window.__game.player;return p.trampolineAir&&p.bounceJump&&p.boardRolling},null,{timeout:15000});
  await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');
  const before=await page.evaluate(()=>{const p=window.__game.player,cf=p.courseInputDirection(window.__game.getLevel())??p.camDir;return{at:p.pos.toArray(),side:[-cf.z,0,cf.x],time:p.runTime}});
  await page.keyboard.down('ArrowRight');await page.waitForFunction(t=>window.__game.player.runTime-t>=.3,before.time);await page.keyboard.up('ArrowRight');
  report.sideways=await page.evaluate(a=>window.__game.player.pos.toArray().reduce((sum,v,i)=>sum+(v-a.at[i])*a.side[i],0),before);assert.ok(report.sideways>3.5);
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.emergencyEjectCharging);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.emergencyEjectLandingPending);
  report.abandon=await page.evaluate(()=>{const p=window.__game.player;return{move:p.lastJumpType,board:p.boardRolling,looseBoard:!!p.looseBoard}});
  assert.equal(report.abandon.move,'Emergency Eject');assert.equal(report.abandon.board,false);assert.equal(report.abandon.looseBoard,true);
  await page.screenshot({path:out+'/review/bounce-abandon-native.png'});
  await page.evaluate(()=>{const g=window.__game;g.player.respawn(g.getLevel(),true)});
  report.frameTimes=await page.evaluate(async()=>{let last=performance.now(),times=[];for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-last);last=now;}times.sort((a,b)=>a-b);return{medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)]};});
 }
 for(const shot of shots){
  await page.evaluate(async shot=>{const g=window.__game;if(g.getCurrentLevel().id!==shot.level){g.switchLevel(shot.level);await g.getLevel().prepareJungleAssets();}g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...shot.placement)});},shot);
  await page.waitForTimeout(150);
  const result=await page.evaluate(shot=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;
   g.player.group.visible=false;c.position.set(...shot.camera);c.fov=50;c.near=.1;c.far=5000;c.lookAt(...shot.center);c.updateProjectionMatrix();c.updateMatrixWorld(true);
   g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;
   return{url,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:g.renderer.info.render,art:g.getLevel().carlisleShipyardDiagnostics};},shot);
  assert.equal(result.art.status,'ready');assert.deepEqual(result.canvas,[1920,1080]);
  await writeFile(`${out}/review/${shot.id}.png`,Buffer.from(result.url.split(',')[1],'base64'));
  const {url,...metrics}=result;report.captures.push({id:shot.id,...metrics});console.log('Captured '+shot.id+' '+result.render.calls+' calls');
  if(shot.id==='01-foam-steps'){
   const center=api.carlislePoint(103,8),camera=api.carlislePoint(28,27,18);
   const hero=await page.evaluate(({center,camera})=>{const g=window.__game,c=g.camera.clone();c.position.set(...camera);c.fov=55;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);return g.renderer.domElement.toDataURL('image/png')},{center,camera});
   await writeFile(out+'/review/arrival-quay-close.png',Buffer.from(hero.split(',')[1],'base64'));
  }
 }
 report.bonus=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);
 await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true)});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/review/player-normal.png'});
 report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);
 assert.equal(report.returned.status,'ready');assert.deepEqual(report.errors,[]);
 await page.goto(base+'/docs/carlisle-relay/shipyard-polish/index.html#all',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.__shipyardGallery?.concepts===20);
 await page.locator('[data-game="0"]').click();
 await page.waitForFunction(()=>document.querySelector('#big-image').complete&&document.querySelector('#big-image').naturalWidth>0);
 assert.match(await page.locator('#big-image').getAttribute('src'),/integration\/review\/01-foam-steps.png$/);
 report.gallery={concepts:20,inGameComparison:true};
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+(quick?'/quick-review.json':'/browser-review.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
