// Exercise actual browser context loss against the locally built release.
// Fixed-pose pixel controls verify complete scenery restoration, not just a
// cleared error flag. No player save, hosted artifact or user tab is touched.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-graphics-recovery';
const lite=process.argv.includes('--lite'),fourK=process.argv.includes('--4k');
const viewport=fourK?{width:3840,height:2160}:{width:1440,height:900};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const report={base,lite,viewport,views:[],errors};
const source=JSON.parse(await readFile(new URL('../../public/levels.json',import.meta.url),'utf8')).levels.find(level=>level.id==='drowned-crown').data;
const expectedComponents=source.components.length+(source.components.some(c=>c.t==='clock')?0:1); // runtime's default time-trial clock

try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Browser page crashed'));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));
  window.recoveryEvents={lost:0,restored:0};
  document.addEventListener('webglcontextlost',()=>window.recoveryEvents.lost++,true);
  document.addEventListener('webglcontextrestored',()=>window.recoveryEvents.restored++,true);
 });
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown'+(lite?'&lite':''),base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 for(const [view,position]of [['harbour',[-72,-5.3,205]],['moonpool',[-48,-5.8,-75]],['hold',[1000,16.1,-165]],['treasury',[1032,20.1,-425]],['harbour-return',[-72,-5.3,205]]]){
  await page.evaluate(async position=>{
   const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});
   await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();
  },position);
  await page.waitForTimeout(2000);
  // The first camera update after a warp can activate cells after the
  // initial preparation call. Wait for those local decodes before freezing.
  await page.waitForFunction(()=>!window.__game.getLoadingDiagnostics().pending.length,null,{timeout:90000});
  await page.evaluate(async()=>{const l=window.__game.getLevel();await l.prepareJungleAssets();await l.prepareSurfaceImages();});
  const before=await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel(),r=g.renderer,gl=r.getContext();
   const extension=gl.getExtension('WEBGL_lose_context');if(!extension)throw Error('WEBGL_lose_context unavailable; recovery was not tested');
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));p.snapRenderInterpolation();
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const capture=()=>{
    for(let i=0;i<2;i++){r.info.reset();l.water?.renderPasses(r,g.scene,g.camera);r.setRenderTarget(null);r.render(g.scene,g.camera);}
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
   };
   const baseline=capture(),control=capture();let controlMax=0;
   for(let i=0;i<baseline.length;i++)controlMax=Math.max(controlMax,Math.abs(baseline[i]-control[i]));
   window.recoveryFixture={capture,baseline,extension,level:l,player:p,pose:p.pos.toArray(),initial:g.getGraphicsRecoveryDiagnostics()};
   return{inventory:{fruit:p.fruit,lives:p.lives},resourceRecovery:g.getContextResourceRecoveryDiagnostics(),glError:gl.getError(),render:{calls:r.info.render.calls,triangles:r.info.render.triangles},position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,components:l.builtFromData.components.length,controlMax,width,height,memory:{...r.info.memory},loading:g.getLoadingDiagnostics(),diagnostics:g.getGraphicsRecoveryDiagnostics(),jpeg:r.domElement.toDataURL('image/jpeg',.86).split(',')[1]};
  });
  assert.equal(before.grounded,true);assert.equal(before.state,'ride');assert.equal(before.deaths,0);assert.equal(before.components,expectedComponents);assert.equal(before.controlMax,0);assert.equal(before.glError,0);
  assert.deepEqual([before.width,before.height],[viewport.width*(lite ? .5 : 1),viewport.height*(lite ? .5 : 1)]);assert.deepEqual(before.loading.failed,[]);assert.deepEqual(before.loading.pending,[]);
  await writeFile(`${out}/${view}-before.jpg`,Buffer.from(before.jpeg,'base64'));delete before.jpeg;
  const held=await page.evaluate(async()=>{
   const g=window.__game,r=g.renderer,f=window.recoveryFixture;
   await new Promise(resolve=>{r.domElement.addEventListener('webglcontextlost',resolve,{once:true});f.extension.loseContext();});
   // Remove the test's visibility pause: the context-loss handler itself must
   // now stop simulation and preserve the scene while the browser is lost.
   delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   const steps=g.frameStats.totalFixedSteps,pose=g.player.pos.toArray(),started=performance.now();
   await new Promise(resolve=>setTimeout(resolve,400));
   return{stepsBefore:steps,stepsAfter:g.frameStats.totalFixedSteps,poseBefore:pose,poseAfter:g.player.pos.toArray(),milliseconds:performance.now()-started,diagnostics:g.getGraphicsRecoveryDiagnostics(),overlay:!!document.querySelector('[data-graphics-recovery]'),lost:r.getContext().isContextLost()};
  });
  assert.equal(held.stepsBefore,held.stepsAfter);assert.deepEqual(held.poseBefore,held.poseAfter);assert.equal(held.lost,true);assert.equal(held.overlay,true);assert.equal(held.diagnostics.losses,before.diagnostics.losses+1);
  const after=await page.evaluate(async()=>{
   const g=window.__game,r=g.renderer,f=window.recoveryFixture;
   await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Context did not restore within 30 seconds')),30000);
    r.domElement.addEventListener('webglcontextrestored',()=>{
     // Freeze the recovered pose before the next animation frame. Gameplay
     // resumes below only after checking the restored pixels and ownership.
     Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));clearTimeout(timeout);resolve();
    },{once:true});f.extension.restoreContext();
   });
   const restored=f.capture(),control=f.capture(),width=r.getContext().drawingBufferWidth,height=r.getContext().drawingBufferHeight;
   let max=0,total=0,different=0,over8=0,controlMax=0;
   for(let i=0;i<restored.length;i+=4){let pixel=0;for(let c=0;c<3;c++){const d=Math.abs(f.baseline[i+c]-restored[i+c]);total+=d;pixel=Math.max(pixel,d);controlMax=Math.max(controlMax,Math.abs(restored[i+c]-control[i+c]));}max=Math.max(max,pixel);if(pixel)different++;if(pixel>8)over8++;}
   return{inventory:{fruit:g.player.fruit,lives:g.player.lives},resourceRecovery:g.getContextResourceRecoveryDiagnostics(),width,height,render:{calls:r.info.render.calls,triangles:r.info.render.triangles},max,meanRgbError:total/(width*height*3),differentPixelPercent:100*different/(width*height),over8PixelPercent:100*over8/(width*height),controlMax,levelRetained:g.getLevel()===f.level,playerRetained:g.player===f.player,pose:g.player.pos.toArray(),memory:{...r.info.memory},glError:r.getContext().getError(),contextLost:r.getContext().isContextLost(),diagnostics:g.getGraphicsRecoveryDiagnostics(),events:window.recoveryEvents,overlay:!!document.querySelector('[data-graphics-recovery]'),jpeg:r.domElement.toDataURL('image/jpeg',.86).split(',')[1]};
  });
  await writeFile(`${out}/${view}-after.jpg`,Buffer.from(after.jpeg,'base64'));delete after.jpeg;
  report.views.push({view,requestedPosition:position,before,held,after});
  await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  assert.deepEqual(after.inventory,before.inventory);assert.deepEqual([after.width,after.height],[before.width,before.height]);assert.equal(after.controlMax,0);assert.equal(after.levelRetained,true);assert.equal(after.playerRetained,true);assert.deepEqual(after.pose,before.position);assert.equal(after.glError,0);assert.equal(after.contextLost,false);assert.equal(after.overlay,false);assert.equal(after.diagnostics.restores,before.diagnostics.restores+1);
  // Exact recovery is expected: same camera, materials, textures and frozen
  // simulation. These fixed-pose controls intentionally bypass the animated HUD.
  assert.equal(after.max,0,'The recovered world must match its frozen original pixels');
  const resumeStart=await page.evaluate(()=>{
   const g=window.__game;window.recoveryResumeSteps=g.frameStats.totalFixedSteps;
   window.recoveryFixture=null;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
   return window.recoveryResumeSteps;
  });
  // Recovery may compile the full presentation before simulation can resume.
  await page.waitForFunction(()=>window.__game.frameStats.totalFixedSteps>window.recoveryResumeSteps,null,{timeout:30000});
  const resume=await page.evaluate(()=>{
   const g=window.__game;
   return{stepsAfter:g.frameStats.totalFixedSteps,position:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,deaths:g.player.totalDeaths,loading:g.getLoadingDiagnostics(),memory:{...g.renderer.info.memory},diagnostics:g.getGraphicsRecoveryDiagnostics(),resources:g.getContextResourceRecoveryDiagnostics(),glError:g.renderer.getContext().getError()};
  });
  resume.stepsBefore=resumeStart;
  report.views.at(-1).resume=resume;
  assert.ok(resume.stepsAfter>resume.stepsBefore,'Gameplay resumes after restoration');assert.equal(resume.glError,0);assert.equal(resume.grounded,true);assert.equal(resume.deaths,0);assert.deepEqual(resume.loading.failed,[]);assert.deepEqual(resume.loading.pending,[]);
  assert.ok(Math.hypot(...resume.position.map((n,i)=>n-before.position[i]))<.1,'Recovery preserves the supported player position');
  if(!lite&&(view==='hold'||view==='treasury')){
   // A lost occlusion query must be replaced, then hidden exterior water
   // must stop rendering its two extra scene passes again.
   await page.waitForFunction(()=>window.__game.getLevel().water.waterOccluded,null,{timeout:10000});
   const hiddenWater=await page.evaluate(async()=>{
    const w=window.__game.getLevel().water,start={...w.stats};
    await new Promise(resolve=>{let frames=0;const tick=()=>{if(++frames===30)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
    return Object.fromEntries(['reflectionRenders','prepassRenders','occludedPassFrames'].map(key=>[key,w.stats[key]-start[key]]));
   });
   report.views.at(-1).hiddenWater=hiddenWater;
   assert.equal(hiddenWater.reflectionRenders,0);assert.equal(hiddenWater.prepassRenders,0);assert.ok(hiddenWater.occludedPassFrames>0);
  }
  console.log(JSON.stringify({view,controlMax:before.controlMax,recoveredMax:after.max,heldSteps:held.stepsAfter-held.stepsBefore,resumedSteps:resume.stepsAfter-resume.stepsBefore,diagnostics:after.diagnostics,resources:resume.resources,memory:resume.memory}));
 }
 // Retiring the recovered world must also clean up old renderer listeners
 // without deleting invalid handles or closing the next world's textures.
 report.transitions=[];
 for(const id of ['sky','drowned-crown']){
  await page.evaluate(async id=>{const g=window.__game;await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('Level switch failed');g.gameFlow.hide();});},id);
  await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  await page.waitForTimeout(1000);
  await page.waitForFunction(()=>!window.__game.getLoadingDiagnostics().pending.length,null,{timeout:90000});
  const state=await page.evaluate(()=>{const g=window.__game;return{id:g.getCurrentLevel().id,glError:g.renderer.getContext().getError(),contextLost:g.renderer.getContext().isContextLost(),grounded:g.player.grounded,loading:g.getLoadingDiagnostics(),resources:g.getContextResourceRecoveryDiagnostics()};});
  report.transitions.push(state);assert.equal(state.glError,0);assert.equal(state.contextLost,false);assert.equal(state.grounded,true);assert.deepEqual(state.loading.failed,[]);assert.deepEqual(state.loading.pending,[]);
 }
 const position=await page.evaluate(()=>window.__game.player.pos.toArray());
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(350);await page.keyboard.up('ArrowUp');
 report.input=await page.evaluate(()=>{const p=window.__game.player;return{position:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths};});
 assert.ok(Math.hypot(...report.input.position.map((n,i)=>n-position[i]))>.2,'Real input still moves the player');assert.equal(report.input.grounded,true);assert.equal(report.input.deaths,0);
 assert.ok(report.transitions.at(-1).resources.skippedDeletes>0,'Exercise disposal of handles from a lost context');
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
