// Fixed-pose native 4K comparison of the scoped refraction budget.
// The unchanged control must be exact; only this isolated browser temporarily disables the cap.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-refraction-review';
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';await mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Page crashed'));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 for(const [view,position] of [['moonpool',[-48,-5.8,-75]],['harbour',[-72,-5.3,205]],['boarding',[-35,-5.8,-76]]]){
  await page.evaluate(async position=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});await g.getLevel().prepareJungleAssets();},position);await page.waitForTimeout(2200);
  const data=await page.evaluate(()=>{
   const g=window.__game,w=g.getLevel().water,r=g.renderer,gl=r.getContext(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   if(w.prepassMaxHeight!==1080)throw Error('Drowned Crown must opt into its refraction budget');
   const originalLimit=w.prepassMaxHeight;
   const capture=limit=>{w.prepassMaxHeight=limit;for(let i=0;i<2;i++){w.renderPasses(r,g.scene,g.camera);r.setRenderTarget(null);r.render(g.scene,g.camera);}const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return{pixels,target:[w.prepassTarget.width,w.prepassTarget.height],jpeg:r.domElement.toDataURL('image/jpeg',.8).split(',')[1]};};
   const original=capture(undefined),candidate=capture(1080),control=capture(undefined);w.prepassMaxHeight=originalLimit;const hist=new Uint32Array(256);let total=0,differing=0,over8=0,controlMax=0;
   for(let i=0;i<original.pixels.length;i+=4){let max=0;for(let c=0;c<3;c++){const d=Math.abs(original.pixels[i+c]-candidate.pixels[i+c]);total+=d;max=Math.max(max,d);controlMax=Math.max(controlMax,Math.abs(original.pixels[i+c]-control.pixels[i+c]));}hist[max]++;if(max)differing++;if(max>8)over8++;}
   return{width,height,targets:{original:original.target,candidate:candidate.target},glError:gl.getError(),contextLost:gl.isContextLost(),meanRgbError:total/(width*height*3),differentPixelPercent:100*differing/(width*height),over8PixelPercent:100*over8/(width*height),histogram:[...hist],controlMax,jpegs:{baseline:original.jpeg,candidate:candidate.jpeg}};
  });const {jpegs,...metrics}=data;assert.equal(metrics.controlMax,0,'Unchanged fixed-pose control must be exact');assert.deepEqual(metrics.targets,{original:[3840,2160],candidate:[1920,1080]});assert.equal(metrics.glError,0);assert.equal(metrics.contextLost,false);for(const [label,jpeg] of Object.entries(jpegs))await writeFile(`${out}/${view}-${label}.jpg`,Buffer.from(jpeg,'base64'));const performanceSamples=[];
  for(const capped of [false,true,false,true]){
   await page.evaluate(capped=>{window.__game.getLevel().water.prepassMaxHeight=capped?1080:undefined;},capped);
   await page.waitForTimeout(2000);
   const sample=await page.evaluate(async()=>{
    const g=window.__game,times=[],frames=[];let last=performance.now();
    await new Promise(resolve=>{const tick=now=>{times.push(now-last);last=now;frames.push({...g.getRenderFrameStats()});if(times.length<90)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
    const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*p)],w=g.getLevel().water;
    return{medianMs:percentile(times,.5),p95Ms:percentile(times,.95),calls:percentile(frames.map(v=>v.calls),.5),triangles:percentile(frames.map(v=>v.triangles),.5),target:[w.prepassTarget.width,w.prepassTarget.height],position:g.player.pos.toArray(),camera:g.camera.position.toArray(),grounded:g.player.grounded};
   });assert.equal(sample.grounded,true);performanceSamples.push({capped,...sample});
  }
  rows.push({view,...metrics,performanceSamples});console.log(JSON.stringify({view,...metrics,histogram:undefined,performanceSamples}));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({rows,errors},null,2)+'\n');}
