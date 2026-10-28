import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.RALLY_MOTION_OUTPUT??'/private/tmp/rally-motion-pass3';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`);await page.waitForFunction(()=>window.__game?.getSkateRace().carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=10;r.step=()=>{};});await page.waitForTimeout(300);
 const grid=await page.evaluate(()=>({look:window.__game.getLookDiagnostics(),render:window.__game.getRenderFrameStats()}));await page.screenshot({path:out+'/grid-native.png'});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),mat=r.carts.crowd.sections[0].instanceMatrix,m= g.player.group.matrix.clone();r.carts.crowd.sections[0].getMatrixAt(200,m);const at=g.player.pos.clone().setFromMatrixPosition(m);
  window.festivalReview={stage:'crowd',render:g.renderer.render.bind(g.renderer),at,clock:0};
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene){
    const review=window.festivalReview;
    if(review.stage==='crowd'){camera.position.copy(review.at).add({x:6,y:2.4,z:3});camera.lookAt(review.at.x,review.at.y+1,review.at.z);}
    else {const flag=g.scene.getObjectByName('Faded festival bunting');flag.geometry.computeBoundingBox();const center=flag.geometry.boundingBox.getCenter(g.player.pos.clone()).applyMatrix4(flag.matrixWorld);camera.position.copy(center).add({x:0,y:-.1,z:11});camera.lookAt(center);}
    camera.updateMatrixWorld();g.getLevel().standingWaterClock.value=review.clock;r.carts.crowd.update(review.clock);
   }
   return window.festivalReview.render(scene,camera);
  };
 });
 await page.waitForTimeout(200);await page.screenshot({path:out+'/crowd-native.png'});
 await page.evaluate(()=>{window.festivalReview.clock=1.1;});await page.waitForTimeout(150);await page.screenshot({path:out+'/crowd-cheer-native.png'});
 await page.evaluate(()=>{window.festivalReview.stage='cloth';window.festivalReview.clock=0;});await page.waitForTimeout(150);await page.screenshot({path:out+'/bunting-native-a.png'});
 await page.evaluate(()=>{window.festivalReview.clock=.9;});await page.waitForTimeout(150);await page.screenshot({path:out+'/bunting-native-b.png'});
 const detail=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts.crowd,flags=[];g.scene.traverse(o=>{if(o.name==='Faded festival bunting')flags.push({count:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3,material:o.material.name,shader:o.material.customProgramCacheKey()});});return {crowd:{count:c.count,vertices:c.sections[0].geometry.attributes.position.count,triangles:(c.sections[0].geometry.index?.count??c.sections[0].geometry.attributes.position.count)/3,sections:c.sections.length},flags,render:g.getRenderFrameStats(),memory:g.renderer.info.memory,gl:g.renderer.getContext().getError()};});
 await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(720);});await page.waitForTimeout(150);await page.screenshot({path:out+'/bunting-normal.png'});
 await page.evaluate(()=>{window.festivalReview.stage='crowd';});await page.waitForTimeout(150);await page.screenshot({path:out+'/crowd-normal.png'});
 assert.equal(detail.crowd.count,65160);assert.equal(detail.flags.length,25);assert.ok(detail.flags.every(f=>f.triangles===1736&&f.shader==='rally-pinned-canvas-v1'));assert.equal(detail.gl,0);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,grid,detail,errors,review:'Staged camera and clock phases only; production geometry/materials, native then 720p.'},null,2));console.log('PASS festival motion',JSON.stringify({grid,detail,errors}));
}finally{await browser.close();}
