import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483';
const out=process.env.WATER_OUT??'art/carlisle-shipyard/water-review';
const lite=process.argv.includes('--lite'),baseline=process.argv.includes('--baseline');
await mkdir(out,{recursive:true});
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const report={base,lite,baseline,errors:[],views:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,ground:l.groundMeshes.length,crates:l.crates.length,nitro:l.crates.filter(c=>c.nitro).length,slopes:l.groundMeshes.filter(m=>m.userData.slippy).map(m=>({visible:m.visible,material:m.material.name})),build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.ground,334);assert.equal(report.main.crates,270);assert.equal(report.main.nitro,22);
 assert.equal(report.main.slopes.length,18);assert.ok(report.main.slopes.every(s=>s.visible&&s.material==='Harbour wet'));
 const shots=[
  {id:'arrival',s:8,y:0,cs:-12,cy:9,cu:0},
  {id:'low-water',s:75,y:-7,cs:50,cy:-4,cu:22},
  {id:'socket-air',s:722,y:10,cs:687,cy:150,cu:12},
  {id:'storm-water',s:2820,y:-8,cs:2785,cy:15,cu:28},
 ];
 const capture=async(id,camera,center)=>{
  const result=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;
   c.position.set(...camera);c.fov=53;c.near=.1;c.far=2500;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);
   // Identical water phases allow a direct art comparison without pausing native movers.
   g.scene.traverse(n=>{if(n.name==='Blue-hour tidal water'||n.name==='Tidal contact wash')n.material.uniforms.time.value=12;});
   g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;
   return{url,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render}};
  },{camera,center});
  await writeFile(`${out}/${id}.png`,Buffer.from(result.url.split(',')[1],'base64'));report.views.push({id,camera,center,canvas:result.canvas,render:result.render});
 };
 for(const shot of (lite?shots.slice(0,2):shots)){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},point(shot.s,shot.y+1));
  await page.waitForTimeout(300);await capture(shot.id,point(shot.cs,shot.cy,shot.cu),point(shot.s,shot.y));
 }
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(300);await capture('bonus-water',[32,8,22],[42,-.05,-9]);
  report.bonus=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),water=g.scene.getObjectByName('Blue-hour tidal water'),wash=[];g.scene.traverse(n=>{if(n.name==='Moving hull wash')wash.push({position:n.getWorldPosition(n.position.clone()).toArray(),parent:n.parent.name,quaternion:n.quaternion.toArray()});});return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length,water:water?.geometry.attributes.position.array.slice(0,6),wash};});
  assert.equal(report.bonus.art.status,'ready');assert.equal(report.bonus.movers,4);
  if(!baseline){assert.equal(report.bonus.wash.length,4);for(const wash of report.bonus.wash)assert.ok(Math.abs(wash.position[1]+.01)<.002,'hull wash left the waterline');}
  await page.waitForTimeout(1200);
  report.bonusMotion=await page.evaluate(()=>{const g=window.__game,wash=[];g.scene.traverse(n=>{if(n.name==='Moving hull wash')wash.push(n.getWorldPosition(n.position.clone()).toArray());});return wash;});
  if(!baseline)assert.ok(report.bonusMotion.some((p,i)=>Math.abs(p[0]-report.bonus.wash[i].position[0])>.05),'hull wash did not follow the moving boats');
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.frameTiming=await page.evaluate(async()=>{const times=[];let previous=performance.now();for(let i=0;i<130;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  const start=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');
  report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths,art:window.__game.getLevel().carlisleShipyardDiagnostics.status}));
  assert.ok(report.walk.z<start-2);assert.equal(report.walk.deaths,0);assert.equal(report.walk.art,'ready');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
