// Render the real authored course into the campaign thumbnail, then exercise
// its actual Level Select entry. Run under the shared full-render host lease.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRIBAL_URL||'http://127.0.0.1:5247';
const out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/art/evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],failed=[];
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ABORTED'))failed.push(r.url());});
const captures=[];let geometry,menu,entry;
try{
 await page.goto(base+'/?playtest&level=tribal-run');
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='tribal-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();await g.player.preparePresentationAssets();g.renderQualitySettings.setRegularResolution(null);});
 geometry=await page.evaluate(async()=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js'),m=await import('/src/levels/tribal-run.ts');
  const {auditTribalGeometry}=await import('/tools/tribal-run-geometry-audit.mjs');
  const {normalizeCustomLevelData}=await import('/src/level.ts');
  if(!normalizeCustomLevelData(m.TRIBAL_RUN_LEVEL))throw Error('Final Tribal Run source does not normalize');
  return auditTribalGeometry({THREE,l:g.getLevel(),source:m.TRIBAL_RUN_LEVEL,sourceModule:m});
 });
 for(const spec of [
  {name:'procession',station:310,camera:[278,19,-22],target:[347,2,0]},
  {name:'court',station:950,camera:[920,16,25],target:[981,5,-12]},
  {name:'woven',station:1190,camera:[1152,20,-23],target:[1212,3,0]},
 ]){
  await page.evaluate(async spec=>{const g=window.__game,m=await import('/src/levels/tribal-run.ts'),p=m.tribalPoint(spec.station,9),d=m.tribalTangent(spec.station);
   g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p),heading:g.player.pos.clone().set(...d)});},spec);
  await page.waitForTimeout(900);
  const capture=await page.evaluate(async spec=>{
   const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js'),m=await import('/src/levels/tribal-run.ts');
   const {prepareWorldFrame,finishWorldFrame}=await import('/src/render-quality/worldFrame.ts');
   const camera=g.camera.clone();camera.position.set(...m.tribalPoint(...spec.camera));camera.lookAt(...m.tribalPoint(...spec.target));camera.fov=55;camera.aspect=16/9;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const context=canvas.getContext('2d'),pixels=context.createImageData(640,360),bytes=new Uint8Array(640*360*4);
   const oldTarget=g.renderer.getRenderTarget(),visible=g.player.group.visible;g.player.group.visible=false;
   const automatic=prepareWorldFrame(g.scene);
   try{g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);g.renderer.readRenderTargetPixels(target,0,0,640,360,bytes);}
   finally{finishWorldFrame(g.scene,automatic);g.renderer.setRenderTarget(oldTarget);g.player.group.visible=visible;target.dispose();}
   for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);
   context.putImageData(pixels,0,0);return{image:canvas.toDataURL('image/jpeg',.92),camera:camera.position.toArray(),target:m.tribalPoint(...spec.target)};
  },spec);
  const image=Buffer.from(capture.image.split(',')[1],'base64'),path=`${out}/preview-${spec.name}.jpg`;
  await writeFile(path,image);if(spec.name==='court')await writeFile('public/level-previews/tribal-run.jpg',image);
  captures.push({name:spec.name,path,camera:capture.camera,target:capture.target,bytes:image.length,sha256:createHash('sha256').update(image).digest('hex')});
 }
 menu=await page.evaluate(async()=>{
  const g=window.__game,{CAMPAIGN_LEVELS}=await import('/src/campaign.ts');g.campaign.startEphemeral();
  for(const progress of Object.values(g.campaign.active.levels))Object.assign(progress,{cleared:true});
  g.gameFlow.showPause({levelName:g.getLevel().name,inWarpRoom:false});g.gameFlow.openLevelSelect();g.gameFlow.updateLevelSelectChoice('tribal-run',true);
  await g.gameFlow.prepareMenuPresentation();await g.gameFlow.levelSelectPreview.decode();
  return{definition:CAMPAIGN_LEVELS.find(c=>c.progressKey==='tribal-run'),row:document.querySelector('[data-level-key="tribal-run"]')?.textContent,
   preview:g.gameFlow.levelSelectPreview.src,previewSize:[g.gameFlow.levelSelectPreview.naturalWidth,g.gameFlow.levelSelectPreview.naturalHeight],canPlay:!g.gameFlow.levelSelectPlay.disabled};
 });
 await page.screenshot({path:`${out}/tribal-run-level-select.png`});
 assert.equal(menu.definition.levelId,'tribal-run');assert.ok(!menu.definition.placeholder);assert.ok(menu.canPlay);assert.match(menu.row,/TRIBAL RUN/);assert.deepEqual(menu.previewSize,[640,360]);
 await page.evaluate(()=>window.__game.gameFlow.levelSelectPlay.click());
 // Switching from a live run intentionally shows the game's confirmation.
 await page.getByRole('button',{name:'SWITCH LEVEL',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='tribal-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForTimeout(750);
 entry=await page.evaluate(()=>({id:window.__game.getCurrentLevel().id,position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded}));
 assert.ok(entry.grounded);assert.ok(Math.abs(entry.position[2])<2);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 const report={checkedAt:new Date().toISOString(),method:'Actual full-geometry world render, 640×360 JPEG; no HUD or character.',geometry,selected:'court',captures,menu,entry,errors,failed};
 await writeFile(`${out}/preview-and-menu.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,...report}));
}catch(error){
 await writeFile(`${out}/preview-failure.json`,JSON.stringify({error:String(error),geometry,captures,menu,entry,errors,failed},null,2)+'\n');
 await page.screenshot({path:`${out}/preview-failure.png`}).catch(()=>{});throw error;
}finally{await browser.close();}
