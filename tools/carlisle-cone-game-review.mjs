import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out=process.env.CONE_OUT??'art/carlisle-cone/review',errors=[];await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const report={errors};
try{
 await page.goto('http://127.0.0.1:5483/?playtest&level=carlisle-coast&lite',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 report.lite=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();return g.getLevel().carlisleConeDiagnostics});assert.equal(report.lite.status,'ready');assert.equal(report.lite.actors,78);
 await page.goto('http://127.0.0.1:5483/?playtest&level=carlisle-coast',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 report.full=await page.evaluate(async()=>{
  const g=window.__game;g.campaign.startEphemeral();const l=g.getLevel();await l.prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const c=g.getCurrentLevel().data.components, hazard=c.find(v=>v.t==='mesh'&&v.nm?.includes('red teeth'));
  g.player.respawn(l,true,false,{position:g.player.pos.clone().set(hazard.p[0]-6,hazard.p[1]+2,hazard.p[2]+5)});
  return {...l.carlisleConeDiagnostics,hazard:hazard.p,components:c.length,groundMeshes:l.groundMeshes.length,pits:c.filter(v=>v.t==='pit').length,coneGroups:l.root.children.filter(o=>o.name==='Angry cone').length};
 });assert.equal(report.full.actors,78);
 await page.waitForTimeout(700);
 await page.screenshot({path:out+'/game-native.png'});
 const capture=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),c=g.getCurrentLevel().data.components.find(c=>c.t==='mesh'&&c.nm?.includes('red teeth')),camera=g.camera.clone();
  const centre=g.player.pos.clone().set(...c.p);const actor=l.root.children.find(o=>o.name==='Angry cone');const forward=centre.clone().set(0,0,1).applyQuaternion(actor.quaternion),right=centre.clone().set(1,0,0).applyQuaternion(actor.quaternion);
  camera.position.copy(centre).addScaledVector(forward,10).addScaledVector(right,4);camera.position.y+=5;camera.lookAt(centre.x,centre.y+1,centre.z);camera.fov=42;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);g.renderer.render(g.scene,camera);return g.renderer.domElement.toDataURL('image/png');
 });await writeFile(out+'/game-close.png',Buffer.from(capture.split(',')[1],'base64'));
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true)});await page.waitForTimeout(400);await page.screenshot({path:out+'/game-normal.png'});
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),c=g.getCurrentLevel().data.components.find(c=>c.t==='mesh'&&c.nm?.includes('red teeth'));g.player.respawn(l,true,false,{position:g.player.pos.clone().set(c.p[0],c.p[1]+.12,c.p[2])});g.player.masks=0;g.player.invulnTimer=0;g.player.uberTimer=0;});
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:4000});report.hazardDeath=true;
 report.lifecycle=await page.evaluate(async()=>{const g=window.__game;const old=g.getLevel();g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();const afterDispose=old.root.children.filter(o=>o.name==='Angry cone').length;const bonus=g.getLevel().carlisleConeDiagnostics;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();return{afterDispose,bonus,returned:g.getLevel().carlisleConeDiagnostics}});
 assert.equal(report.lifecycle.afterDispose,0);assert.equal(report.lifecycle.bonus,null);assert.equal(report.lifecycle.returned.actors,78);
 assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/game-validation.json',JSON.stringify(report,null,2)+'\n');await browser.close()}
