import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.COAST_OUT??'art/carlisle-shipyard/coastal-banks/review',lite=process.argv.includes('--lite');
await mkdir(out,{recursive:true});
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const report={base,lite,errors:[],views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,ground:l.groundMeshes.length,crates:l.crates.length,nitro:l.crates.filter(c=>c.nitro).length,slopes:l.groundMeshes.filter(m=>m.userData.slippy).map(m=>({visible:m.visible,material:m.material.name})),build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.art.coast.status,'ready');assert.equal(report.main.art.coast.banks,32);assert.equal(report.main.art.coast.sourceTriangles,100707);assert.equal(report.main.art.coast.colliders,0);
 assert.equal(report.main.ground,334);assert.equal(report.main.crates,270);assert.equal(report.main.nitro,22);assert.equal(report.main.slopes.length,18);assert.ok(report.main.slopes.every(s=>s.visible&&s.material==='Harbour wet'));
 const shots=[
  {id:'dune-waterline',s:110,camera:point(80,48,-205),center:point(110,4,-355)},
  {id:'marsh-waterline',s:1130,camera:point(1080,65,-230),center:point(1130,6,-380)},
  {id:'act-one',s:260,camera:point(235,130,130),center:point(260,0,-95)},
  {id:'tidal-engine',s:1950,camera:point(1890,170,100),center:point(1980,0,-110)},
  {id:'storm-inlet',s:2830,camera:point(2780,130,100),center:point(2840,0,-130)},
  {id:'homecoming',s:3900,camera:point(3860,140,135),center:point(3920,0,-115)},
 ];
 for(const shot of (lite?shots.slice(0,2):shots)){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},point(shot.s,3));await page.waitForTimeout(300);
  const result=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;c.position.set(...camera);c.fov=53;c.near=.1;c.far=2500;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;const banks=[];g.scene.traverse(n=>{if(n.userData.coastalBank)banks.push({name:n.name,triangles:n.geometry.index.count/3,sourceTriangles:n.userData.coastalBank.sourceTriangles,visualOnly:n.userData.visualOnly});});return{url,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render},banks};},shot);
  assert.deepEqual(result.canvas,lite?[960,540]:[1920,1080]);assert.equal(result.banks.length,32);assert.ok(result.banks.every(b=>b.triangles===b.sourceTriangles&&b.visualOnly));
  await writeFile(`${out}/${shot.id}.png`,Buffer.from(result.url.split(',')[1],'base64'));report.views.push({...shot,...result,url:undefined});console.log('Captured '+shot.id);
 }
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});
  report.bonus=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();let banks=0;g.scene.traverse(n=>{if(n.userData.coastalBank)banks++;});return{art:l.carlisleShipyardDiagnostics,banks,movers:l.movers.length};});assert.equal(report.bonus.banks,0);assert.equal(report.bonus.movers,4);
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.reload=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics.coast);assert.equal(report.reload.banks,32);
  report.frameTiming=await page.evaluate(async()=>{const times=[];let previous=performance.now();for(let i=0;i<130;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  const start=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
  report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths}));assert.ok(report.walk.z<start-2);assert.equal(report.walk.deaths,0);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({...report,views:report.views.map(v=>({id:v.id,canvas:v.canvas,render:v.render}))}));
