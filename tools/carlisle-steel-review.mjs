import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484',out=process.env.STEEL_OUT??`art/carlisle-shipyard/steel-decks/${baseline?'before':lite?'lite':'review'}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,baseline,lite,errors:[],views:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,grounds:l.groundMeshes.length,crates:l.crates.length,movers:l.movers.length,wet:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.grounds,334);assert.equal(report.main.crates,270);assert.equal(report.main.movers,28);assert.equal(report.main.wet,18);
 if(!baseline)assert.equal(report.main.art.steelDecks.decks,20);
 for(const [id,name,offset]of(lite?[
  ['tide-step','Tide steps · 2',[20,14,20]],['scissor','Scissor · long blade',[37,47,48]],
 ]:[
  ['tide-step','Tide steps · 2',[20,14,20]],['tide-step-edge','Tide steps · 2',[14,2,15]],
  ['scissor','Scissor · long blade',[37,47,48]],['winch','Port winch',[29,25,34]],
  ['pinwheel','Pinwheel 2',[28,30,42]],['counterweight','Counterweight 3',[23,16,21]],
  ['harbour-scissors','Harbour scissors · outer arm',[32,45,53]],['pendulum','Pendulum pier · translating and turning',[54,65,72]],
 ])){
  await page.evaluate(name=>{const g=window.__game,m=g.getLevel().movers.find(m=>m.mesh.name===name).mesh;m.geometry.computeBoundingBox();g.player.respawn(g.getLevel(),true,false,{position:m.localToWorld(m.position.clone().set(0,m.geometry.boundingBox.max.y+.15,m.geometry.boundingBox.max.z*.5))});},name);
  await page.waitForTimeout(250);
  const view=await page.evaluate(({name,offset})=>{const g=window.__game,m=g.getLevel().movers.find(m=>m.mesh.name===name).mesh,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;m.updateWorldMatrix(true,true);c.position.copy(m.localToWorld(m.position.clone().set(...offset)));c.lookAt(m.getWorldPosition(m.position.clone()));c.fov=50;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const r={url:g.renderer.domElement.toDataURL('image/png'),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],matrix:m.matrixWorld.toArray(),render:{...g.renderer.info.render}};g.player.group.visible=visible;return r;},{name,offset});
  await writeFile(out+'/'+id+'.png',Buffer.from(view.url.split(',')[1],'base64'));delete view.url;report.views.push({id,name,...view});if(!lite)assert.deepEqual(view.canvas,[1920,1080]);
 }
 if(!baseline){
  report.shells=await page.evaluate(()=>{
   const g=window.__game;return g.getLevel().movers.filter(m=>m.mesh.getObjectByName('Plated marine steel deck')).map(({mesh})=>{
    const shell=mesh.getObjectByName('Plated marine steel deck'),record={name:mesh.name,...shell.userData.steelDeck,parts:[]};
    shell.traverse(n=>{if(!n.isMesh)return;n.geometry.computeBoundingBox();const b=n.geometry.boundingBox.clone().applyMatrix4(n.matrix),p=n.geometry.attributes.position;let finite=true;for(const v of p.array)if(!Number.isFinite(v))finite=false;record.parts.push({name:n.name,min:b.min.toArray(),max:b.max.toArray(),finite,triangles:n.geometry.index?n.geometry.index.count/3:p.count/3});});return record;
   });
  });
  assert.equal(report.shells.length,20);
  for(const s of report.shells)for(const p of s.parts){assert.ok(p.finite);for(let axis=0;axis<3;axis++)assert.ok(p.min[axis]>=-s.size[axis]/2-.00001&&p.max[axis]<=s.size[axis]/2+.00001,`${s.name}: steel art exceeds contact box on ${axis}`);}
 }
 if(!lite){
  // A native rider must be carried by both translating and spinning platforms.
  report.carry=[];
  for(const name of ['Tide steps · 2','Scissor · long blade']){
   await page.evaluate(name=>{const g=window.__game,m=g.getLevel().movers.find(m=>m.mesh.name===name).mesh;g.player.respawn(g.getLevel(),true,false,{position:m.localToWorld(m.position.clone().set(0,.85,12*(name.startsWith('Scissor')?1:.4)))});},name);
   await page.waitForFunction(()=>window.__game.player.grounded);
   const row=await page.evaluate(async name=>{const g=window.__game,m=g.getLevel().movers.find(m=>m.mesh.name===name).mesh,p=g.player,start=m.worldToLocal(p.pos.clone()).toArray(),from=m.position.toArray(),rotation=m.rotation.y;for(let i=0;i<32;i++)await new Promise(requestAnimationFrame);return{name,start,end:m.worldToLocal(p.pos.clone()).toArray(),grounded:p.grounded,surface:p.surfaceName,deaths:p.totalDeaths,translation:m.position.toArray().map((v,i)=>v-from[i]),rotation:m.rotation.y-rotation};},name);
   report.carry.push(row);assert.ok(row.grounded);assert.equal(row.deaths,0);assert.ok(Math.hypot(row.end[0]-row.start[0],row.end[2]-row.start[2])<.15,'native platform carry changed');
  }
  await page.screenshot({path:out+'/rider-native.png'});
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(150);await page.screenshot({path:out+'/rider-normal.png'});
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForFunction(()=>window.__game.player.grounded);
  report.bonus=await page.evaluate(()=>{const l=window.__game.getLevel();return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length};});assert.equal(report.bonus.movers,4);assert.equal(report.bonus.art.status,'ready');
  if(!baseline)assert.equal(report.bonus.art.steelDecks.decks,0);
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();});report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.returned.status,'ready');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,main:report.main,views:report.views.length,carry:report.carry,errors:report.errors}));
