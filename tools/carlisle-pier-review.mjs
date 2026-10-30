import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.PIER_OUT??'art/carlisle-shipyard/pier-structure/review';
await mkdir(out,{recursive:true});
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const report={base,baseline,lite,errors:[],views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,ground:l.groundMeshes.length,crates:l.crates.length,wetSlopes:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.ground,334);assert.equal(report.main.crates,270);assert.equal(report.main.wetSlopes,18);
 if(!baseline){assert.equal(report.main.art.piers.status,'ready');assert.ok(report.main.art.piers.braces>0);}
 const capture=async(id,camera,center)=>{
  const data=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),was=g.player.group.visible;g.player.group.visible=false;c.position.set(...camera);c.fov=52;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=was;return{url,far:c.far,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render}};},{camera,center});
  await writeFile(`${out}/${id}.png`,Buffer.from(data.url.split(',')[1],'base64'));report.views.push({id,camera,center,...data,url:undefined});
 };
 for(const [id,s,camera,center]of (lite?[
  ['arrival-post-detail',60,[130,216,10],[120.9,218,-5.15]],
  ['crane-underpier',2100,[-187,103,-2010],[-130,110,-2058]],
 ]:[
  ['arrival-underpier',60,[161,216,54],[117,221,-5]],
  ['arrival-post-detail',60,[130,216,10],[120.9,218,-5.15]],
  ['crane-underpier',2100,[-187,103,-2010],[-130,110,-2058]],
  ['homecoming-underpier',3760,[-191,-2,-3709],[-140,0,-3748]],
 ])){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},carlislePoint(s,3));await page.waitForTimeout(250);
  await capture(id,camera,center);
 }
 if(!baseline){report.structure=await page.evaluate(()=>{
  const g=window.__game,nodes=[],boats=[];g.scene.updateMatrixWorld(true);g.scene.traverse(n=>{if(n.userData.pierTimber)nodes.push(n);if(n.userData.fishingVessel)boats.push(n);});
  const geometry=nodes.map(n=>({role:n.userData.pierTimber[0].role,instances:n.count,triangles:n.geometry.index.count/3,finite:[...n.geometry.attributes.position.array,...n.geometry.attributes.normal.array].every(Number.isFinite)}));
  const clearance=boats.map(boat=>{const source=boat.children.find(n=>n.isMesh),box=source.geometry.boundingBox.clone().applyMatrix4(source.matrix),inverse=boat.matrixWorld.clone().invert();let closest=Infinity,nearest=null;
   for(const n of nodes){n.geometry.computeBoundingBox();for(let i=0;i<n.count;i++){
    const matrix=n.matrixWorld.clone().fromArray(n.instanceMatrix.array,i*16).premultiply(n.matrixWorld).premultiply(inverse),bounds=n.geometry.boundingBox.clone().applyMatrix4(matrix);
    const distance=Math.hypot(...['x','y','z'].map(k=>Math.max(bounds.min[k]-box.max[k],box.min[k]-bounds.max[k],0)));
    if(distance<closest){closest=distance;nearest=n.userData.pierTimber[i];}
   }}return{at:boat.userData.fishingVessel.at,closest,nearest};});
  const timber=nodes.find(n=>n.material.name==='Salt-weathered structural timber')?.material;
  return{geometry,clearance,texture:timber?{width:timber.map.image.width,height:timber.map.image.height,bump:!!timber.bumpMap}:null};
 });assert.ok(report.structure.geometry.every(g=>g.finite));assert.ok(report.structure.clearance.every(c=>c.closest>1),'new structure intersects a fishing vessel');assert.ok(report.structure.texture.bump);}
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForTimeout(250);
  report.bonus=await page.evaluate(()=>{const l=window.__game.getLevel();return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length,crates:l.crates.length};});assert.equal(report.bonus.movers,4);
  await capture('bonus-pier',[32,10,26],[63,2,-13]);if(!baseline)assert.equal(report.bonus.art.piers.status,'ready');
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.normal=await page.evaluate(async()=>{const g=window.__game,times=[];let previous=performance.now();for(let i=0;i<130;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{far:g.camera.far,art:g.getLevel().carlisleShipyardDiagnostics.status,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  const z=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths}));assert.ok(report.walk.z<z-2);assert.equal(report.walk.deaths,0);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,main:report.main,bonus:report.bonus,normal:report.normal,errors:report.errors}));
