import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2]??'http://127.0.0.1:5498',out=process.env.RALLY_RESOURCE_OUTPUT??'/private/tmp/rally-style-resources';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`);await page.waitForFunction(()=>window.__game?.getSkateRace().carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(720);r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=10;r.step=()=>{};});
 const restarts=[];
 for(let i=0;i<5;i++){
  const row=await page.evaluate((seed)=>{
   const g=window.__game,r=g.getSkateRace(),old=r.carts.mud,oldRoot=old.root,tracks=old.tracks;let disposed=0;tracks.root.children.forEach(o=>o.geometry.addEventListener('dispose',()=>disposed++));
   const cart={...r.carts.fleet.physics.carts[0],grounded:true,speed:25,tumbling:false};
   let time=0;for(let s=40;s<130;s+=1.2){const p=r.course.sample(s),t=r.course.tangent(s);Object.assign(cart,{x:p.x,y:r.carts.ground(p.x,p.z).height,z:p.z,yaw:Math.atan2(-t.x,-t.z),travel:s});tracks.update(time+=1/30,[cart],[0]);}
   const marks=tracks.diagnostics;r.start('time-trial',seed);r.phase='running';r.elapsed=10;
   return {marks,disposed,oldRootDetached:oldRoot.parent===null,newTracks:r.carts.mud.tracks.diagnostics};
  },i+1);
  await page.waitForTimeout(300);
  row.gpu=await page.evaluate(()=>({memory:window.__game.renderer.info.memory,gl:window.__game.renderer.getContext().getError()}));
  assert.ok(row.marks.segments>80);assert.equal(row.disposed,24);assert.equal(row.oldRootDetached,true);assert.equal(row.newTracks.segments,0);assert.equal(row.gpu.gl,0);restarts.push(row);
 }
 assert.ok(Math.max(...restarts.slice(1).map(r=>r.gpu.memory.geometries))-Math.min(...restarts.slice(1).map(r=>r.gpu.memory.geometries))<=3,'Repeated rally restarts leak geometry');
 assert.equal(new Set(restarts.slice(1).map(r=>r.gpu.memory.textures)).size,1,'Repeated rally restarts leak textures');
 assert.deepEqual(errors,[]);const report={passed:true,restarts,errors};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log('PASS rally resource lifecycle',JSON.stringify(report));
}finally{await browser.close();}
