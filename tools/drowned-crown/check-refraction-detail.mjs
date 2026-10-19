// Compare the scoped refraction mesh budget in the actual native-4K release.
// The main scene, repeated controls and recovery after a failed draw stay exact.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-refraction-detail';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,views:[],errors};
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{e.stopImmediatePropagation();e.preventDefault();},true);
  localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));
 });
 page.on('crash',()=>errors.push('Page crashed'));page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{window.__game.campaign.startEphemeral();window.refractionDetailScope=window.__game.getLevel().water.withRefractionScene;if(typeof window.refractionDetailScope!=='function')throw Error('Crown refraction scope missing');});
 report.stamp=await page.locator('.hud-build').textContent();
 for(const [view,position]of [['harbour',[-72,-5.3,205]],['cargo',[-57,-6,140]],['fort',[-43,-5.4,90]],['moonpool',[-48,-5.8,-75]],['boarding',[-35,-5.8,-76]]]){
  await page.evaluate(async position=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});await g.getLevel().prepareJungleAssets();},position);
  await page.waitForTimeout(2200);await page.waitForFunction(()=>window.__game.player.grounded&&!window.__game.getLoadingDiagnostics().pending.length,null,{timeout:90000});
  const result=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),j=l.jungleAssets,w=l.water,r=g.renderer,gl=r.getContext(),scope=window.refractionDetailScope;
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));g.player.snapRenderInterpolation();g.scene.updateMatrixWorld(true);
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const state=()=>JSON.stringify({cells:j.cells.map(c=>[c.mesh?.visible,c.farMesh?.visible]),ranges:[j.lodRange,...j.authoredLodRanges.values()].map(v=>v.toArray()),capture:j.captureLowDetail});
   const initial=state(),pixels=()=>{const b=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,b);return b;};
   const maximum=(a,b)=>{let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;};
   const capture=reduced=>{
    w.withRefractionScene=reduced?scope:undefined;
    for(let n=0;n<2;n++){r.info.reset();w.renderPasses(r,g.scene,g.camera);r.setRenderTarget(null);r.render(g.scene,g.camera);}
    return{pixels:pixels(),render:{...r.info.render},memory:{...r.info.memory},jpeg:r.domElement.toDataURL('image/jpeg',.93).split(',')[1]};
   };
   try{
    const baseline=capture(false),candidate=capture(true),control=capture(false);
    const primary=reduced=>{capture(reduced);const visible=w.group.visible;w.group.visible=false;try{r.render(g.scene,g.camera);return pixels();}finally{w.group.visible=visible;}};
    const primaryMax=maximum(primary(false),primary(true));
    w.withRefractionScene=scope;
    const render=r.render,saved={target:r.getRenderTarget(),xr:r.xr.enabled,autoClear:r.autoClear,shadow:[r.shadowMap.enabled,r.shadowMap.autoUpdate,r.shadowMap.needsUpdate],ocean:w.group.visible,fog:g.scene.fog};
    let caught=false;
    try{r.render=function(...args){if(this.getRenderTarget()===w.prepassTarget)throw Error('synthetic refraction draw failure');return render.apply(this,args);};w.renderPrepass(r,g.scene,g.camera);}
    catch(error){if(error.message!=='synthetic refraction draw failure')throw error;caught=true;}
    finally{r.render=render;}
    if(!caught)throw Error('Refraction failure fixture did not execute');
    const stateRestored=state()===initial&&r.getRenderTarget()===saved.target&&r.xr.enabled===saved.xr&&r.autoClear===saved.autoClear&&JSON.stringify([r.shadowMap.enabled,r.shadowMap.autoUpdate,r.shadowMap.needsUpdate])===JSON.stringify(saved.shadow)&&w.group.visible===saved.ocean&&g.scene.fog===saved.fog&&w.prepassHidden.length===0;
    const recovered=capture(true);let total=0,different=0,over8=0,max=0;const histogram=new Uint32Array(256);
    for(let i=0;i<baseline.pixels.length;i+=4){let pixel=0;for(let c=0;c<3;c++){const d=Math.abs(baseline.pixels[i+c]-candidate.pixels[i+c]);total+=d;pixel=Math.max(pixel,d);}histogram[pixel]++;max=Math.max(max,pixel);if(pixel)different++;if(pixel>8)over8++;}
    return{width,height,controlMax:maximum(baseline.pixels,control.pixels),primaryMax,recoveryMax:maximum(candidate.pixels,recovered.pixels),stateRestored,meanRgbError:total/(width*height*3),differentPixelPercent:100*different/(width*height),over8PixelPercent:100*over8/(width*height),max,histogram:[...histogram],baseline:{render:baseline.render,memory:baseline.memory},candidate:{render:candidate.render,memory:candidate.memory},jpegs:{baseline:baseline.jpeg,candidate:candidate.jpeg},position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,glError:gl.getError(),loading:g.getLoadingDiagnostics(),targets:{reflection:[w.reflectionTarget.width,w.reflectionTarget.height],refraction:[w.prepassTarget.width,w.prepassTarget.height]}};
   }finally{w.withRefractionScene=scope;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}
  });
  const {jpegs,...metrics}=result;for(const [name,data]of Object.entries(jpegs))await writeFile(`${out}/${view}-${name}.jpg`,Buffer.from(data,'base64'));
  const row={view,requestedPosition:position,...metrics,performance:[]};report.views.push(row);await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  assert.deepEqual([metrics.width,metrics.height],[3840,2160]);assert.equal(metrics.controlMax,0);assert.equal(metrics.primaryMax,0);assert.equal(metrics.recoveryMax,0);assert.equal(metrics.stateRestored,true);assert.equal(metrics.glError,0);assert.equal(metrics.grounded,true);assert.equal(metrics.deaths,0);assert.deepEqual(metrics.loading.failed,[]);assert.deepEqual(metrics.loading.pending,[]);
  assert.deepEqual(metrics.targets,{reflection:[1152,648],refraction:[1920,1080]});assert.deepEqual(metrics.candidate.memory,metrics.baseline.memory);
  assert.ok(metrics.meanRgbError<.1&&metrics.over8PixelPercent<.15,'Refraction loss exceeds the reviewed water budget');assert.ok(metrics.candidate.render.triangles<metrics.baseline.render.triangles);assert.deepEqual(errors,[]);
  for(const reduced of [false,true,false,true]){
   await page.evaluate(reduced=>{window.__game.getLevel().water.withRefractionScene=reduced?window.refractionDetailScope:undefined;},reduced);
   await page.waitForTimeout(1000);
   const sample=await page.evaluate(async()=>{
    const g=window.__game,frames=[],times=[];let last=performance.now();
    await new Promise(resolve=>{const tick=now=>{times.push(now-last);last=now;frames.push({...g.getRenderFrameStats()});if(frames.length<90)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
    const percentile=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.floor((a.length-1)*p)];
    return{medianMs:percentile(times,.5),p95Ms:percentile(times,.95),calls:percentile(frames.map(f=>f.calls),.5),triangles:percentile(frames.map(f=>f.triangles),.5),memory:{...g.renderer.info.memory},position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,glError:g.renderer.getContext().getError()};
   });
   assert.equal(sample.grounded,true);assert.equal(sample.deaths,0);assert.equal(sample.glError,0);assert.ok(Math.hypot(sample.position[0]-position[0],sample.position[2]-position[2])<1.5);row.performance.push({reduced,...sample});
  }
  await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({view,meanRgbError:metrics.meanRgbError,over8PixelPercent:metrics.over8PixelPercent,primaryMax:metrics.primaryMax,recoveryMax:metrics.recoveryMax,trianglesSaved:metrics.baseline.render.triangles-metrics.candidate.render.triangles,performance:row.performance}));
 }
 assert.deepEqual(errors,[]);report.pass=true;
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
