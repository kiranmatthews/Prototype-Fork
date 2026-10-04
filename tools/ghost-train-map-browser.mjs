// Scoped Ghost Train map UI smoke test and an actual-scene thumbnail capture.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>/^https?:/.test(v))||'http://127.0.0.1:5221/').replace(/\/$/,'');
const output='/private/tmp/ghost-train-map-browser';await mkdir(output,{recursive:true});
const capture=process.argv.includes('--capture-preview'),captureOnly=process.argv.includes('--capture-only');
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,fullRender:true,checks:[],errors};
const page=await browser.newPage({viewport:{width:1280,height:720}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
const meshReady=()=>page.waitForFunction(()=>{const d=window.__game.getLevel().ghostTrainDiagnostics;return d&&Object.keys(d.scenery.assets).length>=17&&Object.values(d.scenery.assets).every(a=>a.status==='ready')&&d.enemies.every(a=>a.status==='ready')&&['stone','floor','timber','bath'].every(k=>d.textures[k]==='ready');},null,{timeout:120000});
try{
 if(capture){
  await page.goto(`${base}/?playtest&level=ghost-train`);await ready();
  await page.evaluate(async()=>await window.__game.getLevel().prepareGhostTrainAssets());await meshReady();
  await page.evaluate(async()=>{const source=await import('/src/levels/ghost-train.ts'),f=source.GHOST_TRAIN_PREVIEW_POINTS.find(f=>f.id==='banquet'),g=window.__game,p=g.player;const point=f.previewPoint??source.ghostRoutePoint(f.s,f.y,f.u??0);p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(point),heading:p.pos.clone().fromArray(f.heading??source.ghostRouteTangent(f.s))});});
  await page.waitForTimeout(1300);
  const image=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js'),g=window.__game,l=g.getLevel();
   g.gameFlow.showPause({levelName:'Ghost Train',inWarpRoom:false});
   const renderer=g.renderer,camera=g.camera.clone();camera.aspect=16/9;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);g.scene.updateMatrixWorld(true);
   const target=new THREE.WebGLRenderTarget(640,360);target.texture.colorSpace=THREE.SRGBColorSpace;
   const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),playerVisible=g.player.group.visible;
   const bytes=new Uint8Array(640*360*4),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(640,360);
   try{
    // Render the real level with its settled gameplay camera. Menu/HUD ink is
    // outside this scene pass; hide only the rider for a geometry thumbnail.
    g.player.group.visible=false;renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();renderer.render(g.scene,camera);renderer.readRenderTargetPixels(target,0,0,640,360,bytes);
    for(let y=0;y<360;y++)pixels.data.set(bytes.subarray((359-y)*640*4,(360-y)*640*4),y*640*4);ctx.putImageData(pixels,0,0);
    return{jpeg:canvas.toDataURL('image/jpeg',.92).split(',')[1],evidence:{scene:'banquet',size:[640,360],capture:'Actual level scene, existing renderer and settled gameplay camera; no HUD or rider',camera:camera.position.toArray(),player:g.player.pos.toArray(),readyAssets:Object.keys(l.ghostTrainDiagnostics.scenery.assets).length,textures:l.ghostTrainDiagnostics.textures}};
   }finally{g.player.group.visible=playerVisible;renderer.setRenderTarget(previous,face,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();}
  });
  await writeFile(new URL('../public/level-previews/ghost-train.jpg',import.meta.url),Buffer.from(image.jpeg,'base64'));report.preview=image.evidence;report.checks.push('Actual banquet geometry thumbnail captured');
 }
 if(!captureOnly){
  await page.goto(`${base}/?playtest&level=codex-lab`);await ready();
  // One initial map fixture. All subsequent hub travel and entry below use
  // real keyboard/button input through the game's ordinary event handlers.
  await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.setMapFocus('bone-yard');g.switchLevel('warproom');});
  const selected=(key)=>page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:45000});
  await selected('bone-yard');
  await page.evaluate(()=>{window.__ghostMapTrace=[];window.__ghostMapRecord=true;function sample(){if(!window.__ghostMapRecord)return;const g=window.__game;window.__ghostMapTrace.push({position:g.player.pos.toArray(),key:document.querySelector('.world-map-ui')?.dataset.selectedKey});requestAnimationFrame(sample);}requestAnimationFrame(sample);});
  await page.keyboard.press('ArrowDown',{delay:80});await selected('ghost-train');
  await page.waitForFunction(()=>window.__game.getMapPresentationDiagnostics()?.shownKey==='ghost-train'&&!window.__game.getMapPresentationDiagnostics().flipping);
  const card=await page.evaluate(()=>({name:document.querySelector('.world-map-level-name')?.textContent,selected:document.querySelector('.world-map-ui').dataset.selectedKey,position:window.__game.player.pos.toArray(),presentation:window.__game.getMapPresentationDiagnostics(),unlocked:window.__game.campaign.levelUnlocked('ghost-train')}));
  assert.equal(card.name,'GHOST TRAIN');assert.equal(card.selected,'ghost-train');assert.equal(card.unlocked,true);assert.ok(card.presentation.draws>0);assert.ok(Math.hypot(card.position[0]-322,card.position[1]-6,card.position[2]-34)<.02);
  await page.screenshot({path:output+'/map-ghost-train-full.png'});report.card=card;report.checks.push('Bone Yard Down reaches the Ghost Train hub and live card');
  await page.keyboard.press('ArrowUp',{delay:80});await selected('bone-yard');report.checks.push('Ghost Train Up returns to Bone Yard');
  await page.keyboard.press('ArrowDown',{delay:80});await selected('ghost-train');
  const trace=await page.evaluate(()=>{window.__ghostMapRecord=false;return window.__ghostMapTrace;});let largestStep=0;for(let i=1;i<trace.length;i++)largestStep=Math.max(largestStep,Math.hypot(...trace[i].position.map((v,j)=>v-trace[i-1].position[j])));assert.ok(trace.length>20&&largestStep<3,'map route must use continuous ordinary travel');report.travel={samples:trace.length,largestStep,intermediateTrailSample:trace.some(t=>t.position[2]>22&&t.position[2]<27&&t.position[0]>324)};
  await page.keyboard.press('Tab');await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='level-select');
  await page.waitForFunction(()=>{const e=document.querySelector('.game-level-preview');return e?.complete&&e.naturalWidth===640&&e.naturalHeight===360&&e.src.endsWith('/level-previews/ghost-train.jpg');});
  const listing=await page.evaluate(()=>({island:document.querySelector('.game-level-select-layout').dataset.island,rows:[...document.querySelectorAll('.game-level-row')].map(e=>({key:e.dataset.levelKey,label:e.textContent,disabled:e.disabled})),preview:{src:document.querySelector('.game-level-preview').src,alt:document.querySelector('.game-level-preview').alt,width:document.querySelector('.game-level-preview').naturalWidth,height:document.querySelector('.game-level-preview').naturalHeight},surface:window.__game.getGameFlowSurfaceDiagnostics()}));
  assert.equal(listing.island,'hidden-shores');assert.deepEqual(listing.rows.map(r=>r.key),['drowned-crown','bone-yard','ghost-train','crab-chief']);assert.equal(listing.rows.find(r=>r.key==='ghost-train').disabled,false);assert.equal(listing.preview.alt,'Ghost Train');await page.screenshot({path:output+'/level-select-ghost-train-full.png'});report.listing=listing;report.checks.push('Hidden Shores lists Ghost Train with the real 640x360 preview');
  await page.getByRole('button',{name:'SELECT',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='ghost-train'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>await window.__game.getLevel().prepareGhostTrainAssets());await meshReady();await page.waitForTimeout(350);
  const entry=await page.evaluate(()=>({level:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,deaths:window.__game.player.totalDeaths,assets:window.__game.getLevel().ghostTrainDiagnostics.scenery.assets,stamp:document.querySelector('.hud-build')?.textContent}));assert.equal(entry.grounded,true);assert.equal(entry.deaths,0);assert.match(entry.stamp,/Codex\/sol fork/);report.entry=entry;report.checks.push('Normal Level Select button enters the actual Ghost Train');await page.screenshot({path:output+'/ghost-train-entry-full.png'});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const touch=await context.newPage();touch.on('pageerror',e=>errors.push(e.message));touch.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const cdp=await context.newCDPSession(touch),{windowId}=await cdp.send('Browser.getWindowForTarget');await cdp.send('Browser.setWindowBounds',{windowId,bounds:{width:1200,height:1400}});await cdp.detach();
  await touch.goto(`${base}/?playtest&level=codex-lab`);await touch.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await touch.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.setMapFocus('ghost-train');g.switchLevel('warproom');g.gameFlow.showMapSection('level-select');});
  await touch.waitForFunction(()=>{const e=document.querySelector('.game-level-preview');return e?.complete&&e.naturalWidth===640&&e.src.endsWith('/ghost-train.jpg');});
  const mobile=await touch.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return{viewport:[innerWidth,innerHeight],island:document.querySelector('.game-level-select-layout').dataset.island,rows:[...document.querySelectorAll('.game-level-row')].map(e=>({key:e.dataset.levelKey,disabled:e.disabled,rect:rect(e)})),preview:rect(document.querySelector('.game-level-preview')),panelScroll:[document.querySelector('.game-shell-panel').scrollTop,document.querySelector('.game-shell-panel').scrollLeft],pageWidth:document.documentElement.scrollWidth};});
  assert.deepEqual(mobile.viewport,[390,844]);assert.equal(mobile.island,'hidden-shores');assert.deepEqual(mobile.rows.map(r=>r.key),['drowned-crown','bone-yard','ghost-train','crab-chief']);assert.equal(mobile.rows[2].disabled,false);assert.ok(mobile.pageWidth<=390);assert.deepEqual(mobile.panelScroll,[0,0]);
  for(const r of [...mobile.rows.map(r=>r.rect),mobile.preview])assert.ok(r.x>=0&&r.y>=0&&r.right<=391&&r.bottom<=845,'mobile row or preview leaves its viewport');for(const r of mobile.rows)assert.ok(r.rect.height>=47.99,'mobile row lacks the 48px touch target');
  await touch.screenshot({path:output+'/level-select-ghost-train-390x844.png'});await touch.locator('[data-level-key="ghost-train"]').tap();
  await touch.waitForFunction(()=>window.__game.getCurrentLevel().id==='ghost-train'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});await touch.evaluate(async()=>await window.__game.getLevel().prepareGhostTrainAssets());
  mobile.entry=await touch.evaluate(()=>({level:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,deaths:window.__game.player.totalDeaths,readyAssets:Object.values(window.__game.getLevel().ghostTrainDiagnostics.scenery.assets).filter(a=>a.status==='ready').length}));assert.equal(mobile.entry.level,'ghost-train');assert.equal(mobile.entry.grounded,true);assert.equal(mobile.entry.deaths,0);assert.ok(mobile.entry.readyAssets>=17);await touch.screenshot({path:output+'/ghost-train-entry-390x844.png'});report.mobile=mobile;report.checks.push('390x844 touch list keeps all four rows/preview in view and tap enters Ghost Train');await context.close();
 }
 assert.deepEqual(errors,[],'Ghost Train preview and map UI console must stay clean');console.log(JSON.stringify({checks:report.checks,preview:report.preview,travel:report.travel,entry:report.entry?.level,errors,output}));
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
