// Actual main-course geometry and menu evidence for the Haunted Hassle rename.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187',out='docs/blockworks-art/bonus';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
const open=async()=>{const page=await browser.newPage({viewport:{width:1600,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(base+'/?playtest&level=codex-lab');await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});return page;};
try{
 const page=await open();
 const preview=await page.evaluate(async()=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');
  const {prepareWorldFrame,finishWorldFrame}=await import('/src/render-quality/worldFrame.ts');
  g.player.step=()=>{};await g.getLevel().prepareJungleAssets();for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);
  const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
  const camera=g.camera.clone();camera.aspect=16/9;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const context=canvas.getContext('2d'),pixels=context.createImageData(640,360),bytes=new Uint8Array(640*360*4);
  const oldTarget=g.renderer.getRenderTarget(),visible=g.player.group.visible;g.player.group.visible=false;
  const automatic=prepareWorldFrame(g.scene);
  try{g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);g.renderer.readRenderTargetPixels(target,0,0,640,360,bytes);}
  finally{finishWorldFrame(g.scene,automatic);g.renderer.setRenderTarget(oldTarget);g.player.group.visible=visible;target.dispose();}
  for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);
  context.putImageData(pixels,0,0);return{image:canvas.toDataURL('image/jpeg',.92),name:g.getLevel().name,camera:camera.position.toArray()};
 });
 await page.close();
 const image=Buffer.from(preview.image.split(',')[1],'base64');await writeFile('public/level-previews/codex-switchback.jpg',image);
 const menu=await open();
 const naming=await menu.evaluate(async()=>{
  const g=window.__game,{CAMPAIGN_LEVELS}=await import('/src/campaign.ts');
  g.campaign.startEphemeral();for(const def of CAMPAIGN_LEVELS)g.campaign.active.levels[def.progressKey].cleared=true;
  g.gameFlow.showPause({levelName:g.getLevel().name,inWarpRoom:false});g.gameFlow.openLevelSelect();g.gameFlow.updateLevelSelectChoice('codex-switchback',true);
  await g.gameFlow.prepareMenuPresentation();for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);
  return{main:g.getLevel().name,entry:g.findLevel('codex-lab').name,bonus:g.findLevel('bonus-codex-switchback').name,
   row:[...document.querySelectorAll('[data-level-key]')].find(e=>e.dataset.levelKey==='codex-switchback')?.textContent,
   campaign:CAMPAIGN_LEVELS.find(c=>c.levelId==='codex-lab'),preview:g.gameFlow.levelSelectPreview.src};
 });
 await menu.screenshot({path:out+'/level-select.png'});
 assert.equal(naming.main,'Haunted Hassle');assert.equal(naming.entry,'Haunted Hassle');assert.equal(naming.bonus,'Bonus: Haunted Hassle');assert.match(naming.row,/HAUNTED HASSLE/);assert.equal(naming.campaign.progressKey,'codex-switchback');assert.deepEqual(errors,[]);
 const report={checkedAt:new Date().toISOString(),...naming,previewCapture:{name:preview.name,camera:preview.camera,path:'public/level-previews/codex-switchback.jpg',sha256:createHash('sha256').update(image).digest('hex'),method:'Actual world render at the production player camera; no HUD or character in the level thumbnail.'},errors};
 await writeFile(out+'/name-and-preview.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
