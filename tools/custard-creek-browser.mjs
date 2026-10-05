// Current challenge-course review. Section starts are independent fixtures;
// normal-input traversal evidence lives in the dedicated gameplay pilots.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5191').replace(/\/$/,'');
const output=process.env.CUSTARD_REVIEW_OUTPUT||'/private/tmp/custard-gameplay-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,sections:[],map:null,errors};
const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
async function place(point){await page.evaluate(point=>{const g=window.__game,p=g.player,l=g.getLevel(),q=window.__creek.custardWarp(point),f=l.laneDirAt(...q);p.respawn(l,true,false,{position:p.pos.clone().fromArray(q),heading:p.pos.clone().set(f?.x??0,0,f?.z??-1)});p.commitRenderStep(l);},point);}
try{
 for(const lite of [true,false]){
  await page.goto(`${base}/?playtest&level=custard-creek${lite?'&lite':''}`);await ready();
  await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();window.__creek=await import('./src/levels/custard-creek.ts');});
  const spawn=await page.evaluate(()=>({id:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,inventory:window.__creek.CUSTARD_CREEK_GAMEPLAY}));
  assert.equal(spawn.id,'custard-creek');assert.equal(spawn.grounded,true);assert.equal(spawn.inventory.enemy,28);assert.equal(spawn.inventory.crumble,14);
  for(const [name,point] of [['spawn',[0,.1,0]],['rope',[0,-4.5,-146]],['rail-entry',[-3,-12.4,-330]],['halfpipe',[0,-13.4,-746]],['crumble',[0,-12.4,-1488]],['moving',[68,-15.9,-1720]],['crusher',[152,-25.4,-1805]],['pendulum',[152,-25.4,-2194]]]){
   await place(point);await page.waitForTimeout(800);
   const state=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,state:window.__game.player.state}));
   assert.notEqual(state.state,'dead',`${name} fixture must begin on safe ground`);assert.ok(state.grounded,`${name} fixture supported`);
   await page.screenshot({path:`${output}/${lite?'lite':'full'}-${name}.png`});report.sections.push({lite,name,...state});
  }
 }
 if(process.argv.includes('--capture-preview')){
  await place([0,-4.5,-95]);await page.waitForTimeout(800);
  const jpeg=await page.evaluate(async()=>{
   const T=await import('./node_modules/three/build/three.module.js'),g=window.__game;
   g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});
   const camera=new T.PerspectiveCamera(58,16/9,.1,650),m=window.__creek;
   camera.position.fromArray(m.custardWarp([7,3,-93]));camera.lookAt(...m.custardWarp([0,-3,-150]));camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
   const r=g.renderer,old=r.getRenderTarget(),viewport=r.getViewport(new T.Vector4()),scissor=r.getScissor(new T.Vector4()),test=r.getScissorTest(),visible=g.player.group.visible;
   const rt=new T.WebGLRenderTarget(640,360);rt.texture.colorSpace=T.SRGBColorSpace;const bytes=new Uint8Array(640*360*4),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(640,360);
   try{g.player.group.visible=false;r.setRenderTarget(rt);r.setScissorTest(false);r.clear();r.render(g.scene,camera);r.readRenderTargetPixels(rt,0,0,640,360,bytes);for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);ctx.putImageData(pixels,0,0);return canvas.toDataURL('image/jpeg',.92).split(',')[1];}
   finally{g.player.group.visible=visible;r.setRenderTarget(old);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(test);rt.dispose();}
  });
  await writeFile(new URL('../public/level-previews/custard-creek.jpg',import.meta.url),Buffer.from(jpeg,'base64'));
 }
 await page.goto(`${base}/?playtest&level=custard-creek&lite`);await ready();
 await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.commitClear('test',{});g.campaign.setMapFocus('test-course');g.switchLevel('warproom');});
 const selected=key=>page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:120000});
 await selected('test-course');await page.keyboard.press('ArrowDown',{delay:80});await selected('custard-creek');
 await page.waitForFunction(()=>window.__game.getMapPresentationDiagnostics()?.shownKey==='custard-creek'&&!window.__game.getMapPresentationDiagnostics().flipping);
 assert.equal(await page.locator('.world-map-level-name').textContent(),'CUSTARD CREEK');await page.screenshot({path:output+'/map.png'});
 await page.keyboard.press('ArrowUp',{delay:80});await selected('test-course');await page.keyboard.press('ArrowDown',{delay:80});await selected('custard-creek');
 await page.keyboard.press('Enter',{delay:80});await ready();assert.equal(await page.evaluate(()=>window.__game.getCurrentLevel().id),'custard-creek');
 report.map={nativeBothDirections:true,entry:true};assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
}finally{await writeFile(output+'/review.json',JSON.stringify(report,null,2));await browser.close();}
