// Native 4K, fixed-pose reflection comparison using the real authored scene scope.
// Changes are confined to this isolated browser. Baseline and failure controls must be exact.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-reflections';
const boardwalkOnly=process.argv.includes('--boardwalk-only');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Page crashed'));page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(boardwalkOnly=>{
  const w=window.__game.getLevel().water;if(typeof w.withReflectionScene!=='function')throw Error('Drowned Crown reflection scope missing');
  window.drownedReflectionScope=w.withReflectionScene;
  // Keep the existing low-detail capture for every other asset when
  // comparing only the newly added boardwalk copy. It has no distance fade.
  window.drownedReflectionBaseline=boardwalkOnly?draw=>{
   const cells=window.__game.getLevel().jungleAssets.cells.filter(c=>c.kind==='crowncrashboardwalk');
   const previous=cells.map(c=>[c,c.mesh?.visible,c.farMesh?.visible]);
   window.drownedReflectionScope(()=>{
    for(const [c,near,far] of previous){if(c.mesh)c.mesh.visible=near;if(c.farMesh)c.farMesh.visible=far;}
    draw();
   });
  }:undefined;
 },boardwalkOnly);
 for(const [view,position] of [['moonpool',[-48,-5.8,-75]],['harbour',[-72,-5.3,205]],['boarding',[-35,-5.8,-76]]]){
  await page.evaluate(async position=>{
   const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});
   await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();
  },position);await page.waitForTimeout(2200);
  const data=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),w=l.water,j=l.jungleAssets,r=g.renderer,gl=r.getContext(),scope=window.drownedReflectionScope,baselineScope=window.drownedReflectionBaseline;
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const pixels=()=>{const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
   const maximum=(a,b)=>{let max=0;for(let i=0;i<a.length;i++)max=Math.max(max,Math.abs(a[i]-b[i]));return max;};
   const state=()=>({visible:j.cells.map(c=>[c.mesh?.visible,c.farMesh?.visible]),ranges:[j.lodRange,...j.authoredLodRanges.values()].map(v=>v.toArray()),active:j.captureLowDetail});
   const capture=lowDetail=>{
    w.withReflectionScene=lowDetail?scope:baselineScope;
    for(let i=0;i<2;i++){w.renderPasses(r,g.scene,g.camera);r.setRenderTarget(null);r.render(g.scene,g.camera);}
    return{pixels:pixels(),jpeg:r.domElement.toDataURL('image/jpeg',.8).split(',')[1]};
   };
   const primary=lowDetail=>{
    w.withReflectionScene=lowDetail?scope:baselineScope;w.renderReflection(r,g.scene,g.camera);
    const visible=w.group.visible;w.group.visible=false;
    try{r.setRenderTarget(null);r.render(g.scene,g.camera);return pixels();}finally{w.group.visible=visible;}
   };
   const initialState=JSON.stringify(state()),baseline=capture(false),candidate=capture(true),control=capture(false);
   const primaryMax=maximum(primary(false),primary(true));
   w.withReflectionScene=scope;
   const saved={target:r.getRenderTarget(),fog:g.scene.fog,visible:w.group.visible,xr:r.xr.enabled,autoClear:r.autoClear,shadow:[r.shadowMap.enabled,r.shadowMap.autoUpdate,r.shadowMap.needsUpdate]};
   const render=r.render;let caught=false;
   try{r.render=()=>{throw Error('synthetic reflected draw failure');};w.renderReflection(r,g.scene,g.camera);}
   catch(error){if(error.message!=='synthetic reflected draw failure')throw error;caught=true;}
   finally{r.render=render;}
   if(!caught)throw Error('Reflection failure fixture did not execute');
   const restored=JSON.stringify(state())===initialState&&r.getRenderTarget()===saved.target&&g.scene.fog===saved.fog&&w.group.visible===saved.visible&&r.xr.enabled===saved.xr&&r.autoClear===saved.autoClear&&JSON.stringify([r.shadowMap.enabled,r.shadowMap.autoUpdate,r.shadowMap.needsUpdate])===JSON.stringify(saved.shadow);
   const recovered=capture(true),recoveryMax=maximum(candidate.pixels,recovered.pixels),controlMax=maximum(baseline.pixels,control.pixels);
   let total=0,differing=0,over8=0;const histogram=new Uint32Array(256);
   for(let i=0;i<baseline.pixels.length;i+=4){let max=0;for(let c=0;c<3;c++){const d=Math.abs(baseline.pixels[i+c]-candidate.pixels[i+c]);total+=d;max=Math.max(max,d);}histogram[max]++;if(max)differing++;if(max>8)over8++;}
   return{width,height,controlMax,primaryMax,recoveryMax,stateRestored:restored,glError:gl.getError(),contextLost:gl.isContextLost(),targets:{reflection:[w.reflectionRenderTarget.width,w.reflectionRenderTarget.height],refraction:[w.prepassRenderTarget.width,w.prepassRenderTarget.height]},
    meanRgbError:total/(width*height*3),differentPixelPercent:100*differing/(width*height),over8PixelPercent:100*over8/(width*height),histogram:[...histogram],jpegs:{baseline:baseline.jpeg,candidate:candidate.jpeg}};
  });
  const {jpegs,...metrics}=data;
  assert.equal(metrics.controlMax,0,'Unchanged fixed-pose control must be exact');
  assert.equal(metrics.primaryMax,0,'Primary scenery without water must be exact');
  assert.equal(metrics.recoveryMax,0,'Reflected pixels must recover exactly after a draw failure');
  assert.equal(metrics.stateRestored,true);assert.equal(metrics.glError,0);assert.equal(metrics.contextLost,false);
  assert.deepEqual([metrics.width,metrics.height],[3840,2160]);
  assert.deepEqual(metrics.targets,{reflection:[1152,648],refraction:[1920,1080]});
  for(const [name,jpeg] of Object.entries(jpegs))await writeFile(`${out}/${view}-${name}.jpg`,Buffer.from(jpeg,'base64'));
  const performanceSamples=[];
  for(const lowDetail of [false,true,false,true]){
   await page.evaluate(lowDetail=>{window.__game.getLevel().water.withReflectionScene=lowDetail?window.drownedReflectionScope:window.drownedReflectionBaseline;},lowDetail);
   await page.waitForTimeout(2000);
   const sample=await page.evaluate(async()=>{
    const g=window.__game,times=[],frames=[];let last=performance.now();
    await new Promise(resolve=>{const tick=now=>{times.push(now-last);last=now;frames.push({...g.getRenderFrameStats()});if(times.length<90)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
    const percentile=(a,p)=>a.slice().sort((a,b)=>a-b)[Math.floor((a.length-1)*p)];
    return{medianMs:percentile(times,.5),p95Ms:percentile(times,.95),calls:percentile(frames.map(v=>v.calls),.5),triangles:percentile(frames.map(v=>v.triangles),.5),memory:{...g.renderer.info.memory},position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths};
   });
   assert.equal(sample.grounded,true);assert.equal(sample.deaths,0);
   assert.ok(Math.hypot(sample.position[0]-position[0],sample.position[2]-position[2])<1.5,'The player moved away from the requested view');
   performanceSamples.push({lowDetail,...sample});
  }
  rows.push({view,requestedPosition:position,...metrics,performanceSamples});
  console.log(JSON.stringify({view,...metrics,histogram:undefined,performanceSamples}));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({boardwalkOnly,rows,errors},null,2)+'\n');}
