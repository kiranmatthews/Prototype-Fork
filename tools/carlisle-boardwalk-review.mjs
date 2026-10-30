import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',lite=process.argv.includes('--lite');
const out=process.env.BOARDWALK_OUT??'art/carlisle-shipyard/deck-replacement/validation';await mkdir(out,{recursive:true});
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const point=api.carlislePoint,report={base,lite,errors:[],views:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);return{art:g.getLevel().carlisleShipyardDiagnostics,grounds:g.getLevel().groundMeshes.length};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.grounds,334);
 assert.equal(report.main.art.timber.sourceTriangles,23974);
 report.slopes=await page.evaluate(()=>{const l=window.__game.getLevel();return l.groundMeshes.filter(m=>m.userData.slippy).map(m=>({name:m.name,visible:m.visible,materials:(Array.isArray(m.material)?m.material:[m.material]).map(a=>({name:a.name,visible:a.visible})),iceGrip:m.userData.iceGrip,slipGravity:m.userData.slipGravity}));});
 assert.equal(report.slopes.length,18,'all authored slippery slopes must remain');
 for(const slope of report.slopes){assert.ok(slope.visible);assert.ok(slope.materials.every(m=>m.visible&&m.name==='Harbour wet'),'slippery slopes must retain wet material');}
 await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+(lite?'/player-lite.png':'/player-native.png')});
 const before=await page.evaluate(()=>window.__game.player.pos.toArray());
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(800);await page.keyboard.up('ArrowUp');
 report.walk=await page.evaluate(()=>({at:window.__game.player.pos.toArray(),deaths:window.__game.player.totalDeaths,grounded:window.__game.player.grounded}));
 assert.ok(report.walk.at[2]<before[2]-2);assert.equal(report.walk.deaths,0);
 const shots=lite?[{id:'arrival-lite',s:8,y:0,cs:-4,cy:7,cu:8}]:[
  {id:'arrival-close',s:8,y:0,cs:-2,cy:8,cu:10},
  {id:'downhill-wet',s:30,y:0,cs:19,cy:9,cu:9},
  {id:'net-berth',s:60,y:0,cs:50,cy:10,cu:15},
  {id:'dredger-landing',s:1858,y:48,cs:1846,cy:61,cu:22},
  {id:'tail-gap',s:3558,y:24,cs:3546,cy:37,cu:18},
 ];
 for(const shot of shots){
  const placement=point(shot.s,shot.y+.12),center=point(shot.s,shot.y),camera=point(shot.cs,shot.cy,shot.cu);
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},placement);
  await page.waitForTimeout(100);
  const result=await page.evaluate(({center,camera})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;
   c.position.set(...camera);c.fov=53;c.near=.1;c.far=2500;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);
   const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;return{url,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:g.renderer.info.render};},{center,camera});
  await writeFile(out+'/'+shot.id+'.png',Buffer.from(result.url.split(',')[1],'base64'));report.views.push({id:shot.id,canvas:result.canvas,render:result.render});
 }
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});
  await page.waitForFunction(()=>window.__game.player.grounded);
  await page.screenshot({path:out+'/bonus-native.png'});
  report.bonus=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.bonus.status,'ready');
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/player-normal.png'});
  report.normalFrameTiming=await page.evaluate(async()=>{const times=[];let previous=performance.now();for(let i=0;i<120;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.returned.status,'ready');
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+(lite?'/browser-lite.json':'/browser.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({lite,main:report.main,views:report.views,errors:report.errors},null,2));
