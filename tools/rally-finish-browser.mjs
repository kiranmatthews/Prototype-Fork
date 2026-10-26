import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.RALLY_FINISH_OUTPUT??'/private/tmp/rally-finish-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`);await page.waitForFunction(()=>window.__game?.getSkateRace().carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=10;r.step=()=>{};});await page.waitForTimeout(300);
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),render=g.renderer.render.bind(g.renderer),patch=g.scene.getObjectByName('Soft dirt chicane'),lamp=g.scene.getObjectByName('Floodlight warm lenses');
  const center=o=>{o.geometry.computeBoundingBox();return o.geometry.boundingBox.getCenter(g.player.pos.clone()).applyMatrix4(o.matrixWorld);};
  const halos=[];g.scene.traverse(o=>{if(o.name==='Floodlight lens glow')halos.push(o);});
  window.finishReview={stage:'patch',halos,patch:center(patch),lamp:center(lamp),snapshot:null};
  g.renderer.render=(scene,camera)=>{if(scene===g.scene){const q=window.finishReview;g.getLevel().standingWaterClock.value=10;r.carts.crowd.update(10);
   if(q.stage==='patch'){camera.position.copy(q.patch).add({x:-8,y:16,z:18});camera.lookAt(q.patch);}
   else if(q.stage==='front'||q.stage==='back'){const s=q.stage==='front'?1:-1;camera.position.copy(q.lamp).add({x:12*s,y:-4*s,z:9*s});camera.lookAt(q.lamp);}
   camera.updateMatrixWorld();g.getLevel().updateSceneryView(camera);
   const a=g.renderer.info.render.calls;const result=render(scene,camera);q.snapshot={calls:g.renderer.info.render.calls-a,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};return result;
  }return render(scene,camera);};
 });await page.waitForTimeout(300);await page.screenshot({path:out+'/mud-patch-native.png'});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await page.screenshot({path:out+'/mud-patch-normal.png'});
 const patch=await page.evaluate(()=>{const g=window.__game,all=[];g.scene.traverse(o=>{if(o.name==='Soft dirt chicane')all.push({vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count??0)/3,color:o.material.color.getHexString()});});return {patches:all,view:{patch:window.finishReview.patch,lamp:window.finishReview.lamp,camera:g.camera?.position},render:g.getRenderFrameStats(),gl:g.renderer.getContext().getError()};});
 const lamps=[];
 if(!process.env.RALLY_FINISH_PATCH_ONLY){
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  for(const stage of ['front','back','grid'])for(const single of [false,true]){
   await page.evaluate(({stage,single})=>{const q=window.finishReview;q.stage=stage;for(const h of q.halos)h.material.forceSinglePass=single;},{stage,single});await page.waitForTimeout(250);
   await page.screenshot({path:`${out}/lamp-${stage}-${single?'single':'double'}.png`});lamps.push(await page.evaluate(({stage,single})=>({stage,single,...window.finishReview.snapshot}),{stage,single}));
  }
  for(const stage of ['front','back','grid']){const pair=lamps.filter(x=>x.stage===stage);assert.ok(pair[0].calls>pair[1].calls,'Single pass avoids redundant halo draws');assert.equal(pair[0].geometries,pair[1].geometries);assert.equal(pair[0].textures,pair[1].textures);}
 }
 assert.equal(patch.gl,0);assert.equal(patch.patches.length,8);assert.deepEqual(errors,[]);
 const report={passed:true,patch,lamps,errors,review:'Production materials and complete geometry. Fixed crowd/cloth clock; camera-only views. Lamp comparison changes only forceSinglePass.'};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
