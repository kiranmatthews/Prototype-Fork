import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite'),workyard=process.argv.includes('--workyard');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484',out=process.env.BUILDINGS_OUT??`art/carlisle-shipyard/harbour-buildings/${baseline?'before':lite?'lite':workyard?'workyard-final':'review'}`;
await mkdir(out,{recursive:true});
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point,CARLISLE_RELAY_STOPS:stops,CARLISLE_RELAY_SECTIONS:sections}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,baseline,lite,workyard,errors:[],views:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,grounds:l.groundMeshes.length,crates:l.crates.length,movers:l.movers.length,wet:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.grounds,334);assert.equal(report.main.crates,270);assert.equal(report.main.movers,28);assert.equal(report.main.wet,18);
 assert.equal(report.main.art.timber.decks,131);assert.equal(report.main.art.timber.fittedTriangles,27724901);
 const capture=async(id,station,center,camera)=>{
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},point(station,3));await page.waitForTimeout(150);
  const data=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;c.position.set(...camera);c.fov=52;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const result={url:g.renderer.domElement.toDataURL('image/png'),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render}};g.player.group.visible=visible;return result;},{camera,center});
  await writeFile(out+'/'+id+'.png',Buffer.from(data.url.split(',')[1],'base64'));report.views.push({id,station,camera,center,canvas:data.canvas,render:data.render});
 };
 const near=(p,offset)=>p.map((n,i)=>n+offset[i]);
 const first=point(54,stops[0].y-3,76),receiving=point(18,stops[0].y-4,-134),repair=point(110,stops[0].y-4,-134);
 const end=point(sections[17][1]+(sections[17][2]-sections[17][1])*.75,stops[17].y-3,84);
 for(const [id,s,p,look,offset]of(workyard?[
  ['open-workyard',156,point(156,stops[0].y-4,-134),[-5,4,0],[30,23,32]],
  ['repair-front',110,repair,[-5,8,-5],[36,23,35]],
 ]:lite?[
  ['market-front',54,first,[0,8,0],[40,24,42]],['repair-front',110,repair,[0,8,-5],[36,23,35]],
 ]:[
  ['market-front',54,first,[0,8,0],[40,24,42]],
  ['market-back',54,first,[0,8,0],[-35,26,-35]],
  ['receiving-market',18,receiving,[-5,7,-5],[38,20,29]],
  ['repair-front',110,repair,[-5,8,-5],[36,23,35]],
  ['repair-back',110,repair,[-5,8,-5],[-38,26,-35]],
  ['open-workyard',156,point(156,stops[0].y-4,-134),[-5,4,0],[30,23,32]],
  ['first-bounce',170,point(170,3),[0,4,-20],[35,130,55]],
  ['lift-yard',500,point(500,3),[15,4,-50],[-50,70,85]],
  ['industrial-yard',1900,point(1900,3),[0,0,-55],[-90,55,75]],
  ['homecoming-market',3930,end,[0,8,0],[40,24,42]],
 ]))await capture(id,s,near(p,look),near(p,offset));
 if(!baseline){
  report.buildings=await page.evaluate(()=>{
   const g=window.__game,records=[];g.scene.updateMatrixWorld(true);g.scene.traverse(n=>{if(!n.isInstancedMesh||!n.userData.harbourBuildings)return;
    n.geometry.computeBoundingBox();for(let i=0;i<n.count;i++){
     const m=n.matrix.clone().fromArray(n.instanceMatrix.array,i*16),p=n.userData.harbourBuildings[i],box=n.geometry.boundingBox.clone().applyMatrix4(m),scale=[Math.hypot(m.elements[0],m.elements[1],m.elements[2]),Math.hypot(m.elements[4],m.elements[5],m.elements[6]),Math.hypot(m.elements[8],m.elements[9],m.elements[10])];
     records.push({kind:n.name,...p,scale,worldBounds:{min:box.min.toArray(),max:box.max.toArray()},triangles:n.geometry.index.count/3});
    }
   });return records;
  });
  assert.ok(report.buildings.length>0);
  for(const b of report.buildings){
   assert.ok(Math.max(...b.scale)-Math.min(...b.scale)<1e-4,'building axis stretched');
   assert.ok(Math.abs(b.worldBounds.min[1]-b.at[1])<.002,'building footing lifted or buried');
   const [w,h,d]=b.envelope,c=Math.abs(Math.cos(b.yaw)),s=Math.abs(Math.sin(b.yaw)),half=[(w*c+d*s)/2,h,(w*s+d*c)/2];
   assert.ok(b.worldBounds.max[1]<=b.at[1]+h+.002,'roof exceeds old building envelope');
   for(const axis of [0,2])assert.ok(b.worldBounds.min[axis]>=b.at[axis]-half[axis]-.002&&b.worldBounds.max[axis]<=b.at[axis]+half[axis]+.002,'building exceeds old footprint');
  }
 }
 if(!lite&&!workyard){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForFunction(()=>window.__game.player.grounded);
  report.bonus=await page.evaluate(()=>{const l=window.__game.getLevel();return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length};});assert.equal(report.bonus.art.status,'ready');assert.equal(report.bonus.movers,4);await page.screenshot({path:out+'/bonus-native.png'});
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.returned.status,'ready');
  const z=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths}));assert.ok(report.walk.z<z-2);assert.equal(report.walk.deaths,0);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,main:report.main,views:report.views.length,buildings:report.buildings?.length,errors:report.errors}));
