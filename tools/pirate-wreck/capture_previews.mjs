import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv[2]||'http://127.0.0.1:5178/';
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const [id,eye,look] of [['drowned-crown',[-42,26,-82],[0,15,-176]],['bone-yard',[20,19,9],[0,0,-45]],['crab-chief',[27,24,20],[0,3,-13]]]){
  await page.goto(`${base}?playtest&level=${id}`);await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:90000});
  const image=await page.evaluate(async({eye,look})=>{
   const THREE=await import('/node_modules/three/build/three.module.js'),g=window.__game;g.gameFlow.showPause({levelName:g.getLevel().name,inWarpRoom:false});
   const camera=new THREE.PerspectiveCamera(58,16/9,.1,700);camera.position.set(...eye);camera.lookAt(...look);camera.updateMatrixWorld(true);
   const target=new THREE.WebGLRenderTarget(960,540);target.texture.colorSpace=THREE.SRGBColorSpace;const prev=g.renderer.getRenderTarget(),bytes=new Uint8Array(960*540*4),canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;
   g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);g.renderer.readRenderTargetPixels(target,0,0,960,540,bytes);g.renderer.setRenderTarget(prev);target.dispose();
   const ctx=canvas.getContext('2d'),img=ctx.createImageData(960,540);for(let y=0;y<540;y++)img.data.set(bytes.subarray((539-y)*960*4,(540-y)*960*4),y*960*4);ctx.putImageData(img,0,0);return canvas.toDataURL('image/jpeg',.92).split(',')[1];
  },{eye,look});
  await writeFile(new URL(`../../public/level-previews/${id}.jpg`,import.meta.url),Buffer.from(image,'base64'));console.log(`Captured ${id}`);
 }
 await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.gameFlow.openLevelSelect();g.gameFlow.levelSelectIsland='hidden-shores';g.gameFlow.levelSelectKey='drowned-crown';g.gameFlow.render();});
 await page.waitForFunction(()=>[...document.querySelectorAll('.game-level-preview')].every(img=>img.complete&&img.naturalWidth>0));
 await mkdir('/private/tmp/pirate-browser',{recursive:true});await page.screenshot({path:'/private/tmp/pirate-browser/map-menu-desktop.png'});
 const cards=await page.locator('[data-level-key]').evaluateAll(elements=>elements.map(e=>({id:e.dataset.levelKey,disabled:e.disabled})));
 assert.deepEqual(cards.map(c=>c.id),['drowned-crown','bone-yard','crab-chief']);assert.ok(cards.every(c=>!c.disabled));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/pirate-browser/map-menu-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Level Select overflows mobile viewport');
 console.log(JSON.stringify({cards,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
