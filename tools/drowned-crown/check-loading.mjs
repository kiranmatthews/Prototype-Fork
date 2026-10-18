// Local Chrome loading/lifetime regression. Uses the real covered transition;
// instrumentation observes resource ownership without forcing garbage collection.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'drowned-loading');
// Keep a cold launch and two identical returns: cold-only character/UI caches
// may grow once, but retired level resources must not accumulate each cycle.
const lite=process.argv.includes('--lite');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,lite,viewport:[1440,900],steps:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('crash',()=>errors.push('Page crashed'));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));
  performance.setResourceTimingBufferSize(5000);
  const a=window.__lifecycle={stages:[],calls:[],samples:[],longTasks:[],gl:{},bitmaps:{created:0,closed:0,live:0},contextLosses:0};
  const liveImages=new WeakSet();
  const bitmap=window.createImageBitmap;window.createImageBitmap=async function(...args){const b=await bitmap.apply(this,args);a.bitmaps.created++;a.bitmaps.live++;liveImages.add(b);return b;};
  const close=ImageBitmap.prototype.close;ImageBitmap.prototype.close=function(...args){if(liveImages.delete(this)){a.bitmaps.closed++;a.bitmaps.live--;}return close.apply(this,args);};
  for(const name of ['Texture','Buffer']){
   const p=WebGL2RenderingContext.prototype,c=p['create'+name],d=p['delete'+name],live=new WeakSet();a.gl[name]={created:0,deleted:0,live:0};
   p['create'+name]=function(...args){const object=c.apply(this,args);if(object){live.add(object);a.gl[name].created++;a.gl[name].live++;}return object;};
   p['delete'+name]=function(object){if(object&&live.delete(object)){a.gl[name].deleted++;a.gl[name].live--;}return d.call(this,object);};
  }
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='solProtoStabilityV1'){try{const e=JSON.parse(value).sessions.at(-1).events.at(-1);a.stages.push({...e,ms:performance.now()});}catch{}}return set.call(this,key,value);};
  document.addEventListener('webglcontextlost',()=>a.contextLosses++,true);
  new PerformanceObserver(list=>{for(const e of list.getEntries())a.longTasks.push({at:e.startTime,ms:e.duration});}).observe({entryTypes:['longtask']});
  let wrapped=false,last=0;
  const sample=now=>{
   const g=window.__game;
   if(g&&!wrapped){
    wrapped=true;
    for(const key of ['waitForDestinationAssets','warmDestinationFrame','prepareDestinationFrame','prepareLoadingVortex']){
     const fn=g.gameFlow.callbacks[key];
     if(fn)g.gameFlow.callbacks[key]=async function(...args){const start=performance.now();try{return await fn.apply(this,args);}finally{a.calls.push({key,start,ms:performance.now()-start});}};
    }
    const prototype=Object.getPrototypeOf(g.getLevel()),buildEdges=prototype.buildSystemicSurfaceEdgeRails;
    prototype.buildSystemicSurfaceEdgeRails=function(...args){
     const start=performance.now();try{return buildEdges.apply(this,args);}finally{this.__edgeBuildMs=performance.now()-start;}
    };
   }
   if(g&&now-last>500){last=now;a.samples.push({at:now,level:g.getCurrentLevel().id,phase:g.gameFlow.loadingPhase,memory:{...g.renderer.info.memory},gl:JSON.parse(JSON.stringify(a.gl)),bitmaps:{...a.bitmaps},pending:g.getLoadingDiagnostics().pending.length});}
   requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 const start=Date.now();
 await page.goto(`${base.replace(/\/$/,'')}/?playtest&renderdiag&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const snapshot=async(name,loadMs,buildMs=0)=>{
  await page.waitForTimeout(2000);
  const row=await page.evaluate(async()=>{
   const g=window.__game,a=window.__lifecycle,l=g.getLevel(),water=l.water,field=water?.shoreField;
   let shore=null;
   if(field){
    const image=field.texture.image,digest=await crypto.subtle.digest('SHA-256',image.data);
    shore={width:image.width,height:image.height,segments:field.segments,hasBed:field.hasBed,bounds:field.bounds.toArray(),
     sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),buildMs:water.stats.shoreFieldBuildMs};
   }
   let grindGeometry=null;
   if(g.getCurrentLevel().id==='drowned-crown'){
    const describe=rail=>({points:rail.points.map(p=>p.toArray()),length:rail.totalLength,coping:rail.coping,grindable:rail.grindable,
     owner:l.surfaceEdgeOwners.get(rail)?.userData.editorIdx??null});
    const serialized=JSON.stringify({authored:l.rails.map(describe),surface:l.surfaceEdgeRails.map(describe)});
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized));
    grindGeometry={authored:l.rails.length,surface:l.surfaceEdgeRails.length,
     sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')};
   }
   return{shore,grindGeometry,edgeBuildMs:l.__edgeBuildMs??null,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,gl:a.gl,bitmaps:a.bitmaps,
    loading:g.getLoadingDiagnostics(),position:g.player.pos.toArray(),grounded:g.player.grounded,contextLosses:a.contextLosses,
    scenery:g.getLevel().jungleAssets?.diagnostics,decoders:g.getSceneryDecoderDiagnostics(),heap:performance.memory?.usedJSHeapSize};
  });
  report.steps.push({name,loadMs,buildMs,...row});console.log(JSON.stringify({name,loadMs:Math.round(loadMs),buildMs:Math.round(buildMs),memory:row.memory,liveTextures:row.gl.Texture.live,liveBuffers:row.gl.Buffer.live,liveBitmaps:row.bitmaps.live,sceneryMiB:row.scenery.textureMiB,shoreBuildMs:row.shore?.buildMs,edgeBuildMs:row.edgeBuildMs}));assert.equal(row.grounded,true);assert.equal(row.contextLosses,0);assert.deepEqual(row.loading.failed,[]);assert.deepEqual(row.loading.pending,[]);
  await writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2));
 };
 await snapshot('cold',Date.now()-start);
 report.coldResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:new URL(e.name).pathname,at:e.startTime,ms:e.duration,bytes:e.decodedBodySize,transfer:e.transferSize})).sort((a,b)=>b.bytes-a.bytes));
 for(let cycle=1;cycle<=2;cycle++)for(const id of ['sky','drowned-crown']){
  const timing=await page.evaluate(async id=>{const g=window.__game,start=performance.now();let buildMs=0;await g.gameFlow.transition(()=>{const build=performance.now();if(!g.switchLevel(id))throw Error('Cannot load '+id);buildMs=performance.now()-build;g.gameFlow.hide();});return{loadMs:performance.now()-start,buildMs};},id);
  await snapshot(`${id}-${cycle}`,timing.loadMs,timing.buildMs);
 }
 for(const id of ['sky','drowned-crown']){
  const [first,second]=report.steps.filter(step=>step.name.startsWith(id+'-'));
  assert.deepEqual(second.grindGeometry,first.grindGeometry,`${id}: repeated static grind geometry must match exactly`);
  assert.equal(second.shore?.sha256,first.shore?.sha256,`${id}: repeated water fields must match byte for byte`);
  assert.deepEqual(second.memory,first.memory,`${id}: renderer memory must plateau after the first visit`);
  assert.equal(second.programs,first.programs,`${id}: shader programs must not accumulate`);
  for(const kind of ['Texture','Buffer'])assert.equal(second.gl[kind].live,first.gl[kind].live,`${id}: live GL ${kind}s must not accumulate`);
  assert.equal(second.bitmaps.live,first.bitmaps.live,`${id}: decoded bitmaps must not accumulate`);
 }
 report.instrumentation=await page.evaluate(()=>window.__lifecycle);
 assert.deepEqual(errors,[]);
}catch(error){report.failure=String(error);throw error;}finally{report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
