import {installCarlisleRenderComparison} from './carlisle-render-comparison-scene.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
assert.ok(process.argv.includes('--candidate'),'Experimental comparison only: see art/carlisle-shipyard/render-cost/README.md before applying the rejected candidate in an isolated checkout.');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484',out=process.env.CARLISLE_COMPARE_OUT??'art/carlisle-shipyard/render-cost/comparison';
await mkdir(out,{recursive:true});
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point,CARLISLE_RELAY_STOPS:stops}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={errors:[],pairs:[],timings:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.setup=await page.evaluate(installCarlisleRenderComparison);
 for(const [id,index,center,offset]of [
  ['arrival',0,point(25,2),[20,16,30]],['arrival-wide',0,point(80,8),[-75,95,105]],
  ['beacon-apex',5,point(1170,42),[70,145,100]],['dredger',8,point(1830,28),[-45,60,80]],
  ['rigging',15,point(3460,30),[30,80,70]],['homecoming',17,point(3900,16),[-80,70,40]],
 ]){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},stops[index].p);await page.waitForFunction(()=>window.__game.player.grounded);
  const pairs=await page.evaluate(({center,offset})=>{
   const g=window.__game,a=window.__renderComparison,c=g.camera.clone(),gl=g.renderer.getContext(),w=g.renderer.domElement.width,h=g.renderer.domElement.height,playerVisible=g.player.group.visible;
   c.position.set(...center.map((v,i)=>v+offset[i]));c.lookAt(...center);c.fov=52;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.player.group.visible=false;
   const render=state=>{a.state(state);g.renderer.info.reset();g.renderer.render(g.scene,c);const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels,url:g.renderer.domElement.toDataURL('image/png'),render:{...g.renderer.info.render}};};
   const pairs=[];
   try{
    for(const age of [2,.1,.5,1.9]){
     for(const entry of g.getLevel().carlisleShipyard.nets){entry.net.impact(.2,-.3,55);entry.net.update(age);}
     render('prior');render('current');const prior=render('prior'),current=render('current');let changed=0,max=0,total=0;
     for(let i=0;i<prior.pixels.length;i+=4){let pixel=false;for(let k=0;k<3;k++){const d=Math.abs(prior.pixels[i+k]-current.pixels[i+k]);if(d)pixel=true;max=Math.max(max,d);total+=d;}if(pixel)changed++;}
     const isolate={};for(const state of ['current','priorBatches','priorNets']){const next=render(state);let changed=0,max=0;for(let i=0;i<next.pixels.length;i+=4){let pixel=false;for(let k=0;k<3;k++){const d=Math.abs(next.pixels[i+k]-current.pixels[i+k]);if(d)pixel=true;max=Math.max(max,d);}if(pixel)changed++;}isolate[state]={changed,max};}
     pairs.push({age,width:w,height:h,changedPixels:changed,maxChannelDifference:max,totalDifference:total,isolate,prior:{url:prior.url,render:prior.render},current:{url:current.url,render:current.render}});
    }
   }finally{a.state('current');g.player.group.visible=playerVisible;}
   return pairs;
  },{center,offset});
  for(const pair of pairs){
   if(pair.age===2)for(const state of ['prior','current'])await writeFile(`${out}/${id}-${state}.png`,Buffer.from(pair[state].url.split(',')[1],'base64'));
   delete pair.prior.url;delete pair.current.url;report.pairs.push({id,...pair});
   assert.equal(pair.isolate.current.changed,0,`${id}: repeated control render changed`);
   assert.equal(pair.isolate.priorBatches.changed,0,`${id}: batch visibility changed the rendered result`);
  }
  console.log(JSON.stringify({id,comparedPairs:pairs.length,prior:pairs[0].prior.render,current:pairs[0].current.render}));
 }
 // Alternate in the same process after compilation; report limits instead of
 // implying that fewer submitted triangles guarantee a measured FPS gain.
 await page.evaluate(p=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},stops[0].p);
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.timings=await page.evaluate(async()=>{const g=window.__game,a=window.__renderComparison,rows=[];
  try{for(const state of ['prior','current','prior','current']){a.state(state);for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);const times=[];let previous=performance.now(),accepted=g.getRenderFrameLimiterStats().acceptedFrames;
   for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now(),next=g.getRenderFrameLimiterStats().acceptedFrames;if(next!==accepted){times.push(now-previous);previous=now;accepted=next;}}
   times.sort((a,b)=>a-b);rows.push({state,samples:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],render:{...g.renderer.info.render}});
  }}finally{a.state('current');}return rows;
 });
 report.shaderChecks=await page.evaluate(()=>window.__renderComparison.shaderChecks());assert.ok(report.shaderChecks>0);
 await page.screenshot({path:out+'/normal-game.png'});
 await page.evaluate(()=>{const a=window.__renderComparison;a.state('current');for(const m of a.old){m.removeFromParent();if(m.geometry.attributes.pierSeaEnds)m.geometry.dispose();m.dispose();}a.netMaterials.forEach(e=>e.prior.dispose());delete window.__renderComparison;});
 report.impacts=[];
 for(const moving of [false,true]){
  await page.keyboard.down('Space');
  const before=await page.evaluate(moving=>{const g=window.__game,l=g.getLevel(),m=l.groundMeshes.find(m=>m.userData.marineNet&&(m.userData.moverId!==undefined)===moving);m.geometry.computeBoundingBox();g.player.respawn(l,true,false,{position:m.localToWorld(m.position.clone().set(1.8,m.geometry.boundingBox.max.y+.5,-1.1))});return{index:m.userData.editorIdx,impacts:m.userData.marineNet.impacts};},moving);
  await page.waitForFunction(({index,impacts})=>window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index).userData.marineNet.impacts>impacts,before,{timeout:15000});
  const hit=await page.evaluate(({index})=>{const g=window.__game,m=g.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index);return{...m.userData.marineNet,up:g.player.vVel,state:g.player.state};},before);
  await page.screenshot({path:`${out}/${moving?'moving':'fixed'}-bounce-normal.png`});await page.keyboard.up('Space');
  assert.equal(hit.impacts,before.impacts+1);assert.equal(hit.state,'air');assert.ok(hit.up>20);assert.ok(hit.age<.3);
  await page.waitForFunction(({index})=>window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index).userData.marineNet.age===2,before,{timeout:15000});
  report.impacts.push({moving,before,hit,settled:true});
 }
 report.bonus=await page.evaluate(async()=>{const g=window.__game,old=g.getLevel();g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();return{art:g.getLevel().carlisleShipyardDiagnostics,movers:g.getLevel().movers.length,oldNets:old.root.getObjectsByProperty('name','Laced elastic marine net').length};});
 assert.equal(report.bonus.movers,4);assert.equal(report.bonus.art.nets,5);assert.equal(report.bonus.oldNets,0);assert.equal(report.bonus.art.status,'ready');
 report.returned=await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();return g.getLevel().carlisleShipyardDiagnostics;});
 assert.equal(report.returned.status,'ready');assert.equal(report.returned.nets,56);assert.equal(report.returned.piers.piles,4146);assert.equal(report.returned.props,1890);
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/comparison.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,shaderChecks:report.shaderChecks,timings:report.timings,errors:report.errors}));
