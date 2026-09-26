// Run against an isolated baseline and candidate with the same browser/GPU.
// CPU submission and browser rAF timings are reported separately; neither is
// a physical-phone FPS claim. No saved user context is opened or modified.
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2];
if(!base)throw Error('Usage: node tools/profile-render-pipeline.mjs <base-url>');
const output=process.env.RENDER_PROFILE_OUTPUT||'/private/tmp/render-pipeline-profile';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const rows=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await context.addInitScript(()=>{
  localStorage.removeItem('solProtoRenderQuality.v1');
  localStorage.removeItem('solProtoCrtGuestPreset.v1');
 });
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 const throttle=Number(process.env.RENDER_PROFILE_CPU_THROTTLE||1);
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const id of (process.env.RENDER_PROFILE_LEVELS||'sky,treehouse-trail,test,warproom').split(',')){
  await page.goto(new URL(`?playtest&level=${id}`,base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(4000);
  await page.evaluate(enableGpu=>{
   const g=window.__game,l=g.getLevel(),p=window.__renderProfile={record:false,stats:{},raf:[],draws:0,triangles:0,last:0,matrixVisits:0};
   const wrap=(o,k,n=k)=>{if(typeof o?.[k]!=='function')return;const f=o[k];o[k]=function(...a){if(!p.record)return f.apply(this,a);const t=performance.now();try{return f.apply(this,a);}finally{const s=p.stats[n]??={ms:0,calls:0};s.ms+=performance.now()-t;s.calls++;}};};
   ['step','applyRenderInterpolation','restoreRenderPose'].forEach(k=>wrap(g.player,k));
   ['update','updateSceneryView','updateCityVisibility'].forEach(k=>wrap(l,k,'level.'+k));
   wrap(g.renderer,'render','renderCPU');wrap(g.renderer.shadowMap,'render','shadowCPU');
   wrap(g.scene,'updateMatrixWorld','sceneMatrices');
   ['renderPasses','renderReflection','renderPrepass'].forEach(k=>wrap(l.water,k,'water.'+k));
   for(const k of ['setHUD','drawGameHud','drawIcons'])wrap(g.ui,k,'ui.'+k);
   const gl=g.renderer.getContext(),timer=enableGpu?gl.getExtension('EXT_disjoint_timer_query_webgl2'):null;
   p.gpuFrames={};p.gpuEpoch=0;p.gpuSupported=!!timer;
   const pending=[];let cycle=0,active=false;
   const render=g.renderer.render;
   g.renderer.render=function(...args){
    // Bracket submitted render work, never the idle interval between rAFs.
    if(!p.record||!timer||active||pending.length>512)return render.apply(this,args);
    const query=gl.createQuery(),epoch=p.gpuEpoch,key=`${epoch}:${cycle}`;
    const frame=p.gpuFrames[key]??={started:0,finished:0,ms:0};frame.started++;
    active=true;gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
    try{return render.apply(this,args);}
    finally{gl.endQuery(timer.TIME_ELAPSED_EXT);active=false;pending.push({query,key,epoch});}
   };
   for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const f=gl[key];gl[key]=function(...a){if(p.record){p.draws++;p.triangles+=(key.startsWith('drawElements')?a[1]:a[2])/3*(key.endsWith('Instanced')?a.at(-1):1);}return f.apply(this,a);};}
   function tick(t){
    cycle++;
    if(timer){
     const disjoint=gl.getParameter(timer.GPU_DISJOINT_EXT);
     while(pending.length&&(disjoint||gl.getQueryParameter(pending[0].query,gl.QUERY_RESULT_AVAILABLE))){
      const {query,key,epoch}=pending.shift(),frame=p.gpuFrames[key];
      if(!disjoint&&frame&&epoch===p.gpuEpoch){frame.ms+=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;frame.finished++;}
      gl.deleteQuery(query);
     }
     if(disjoint)p.gpuFrames={};
    }
    if(p.record&&p.last)p.raf.push(t-p.last);p.last=t;requestAnimationFrame(tick);
   }requestAnimationFrame(tick);
  },process.env.RENDER_PROFILE_GPU==='1');
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  for(const mode of (process.env.RENDER_PROFILE_MODES||'default,crt-on').split(',')){
   await page.evaluate(mode=>{const g=window.__game;if(mode==='crt-off')g.crtGuestSettings.setEnabled(false);if(mode==='crt-on')g.crtGuestSettings.setEnabled(true);if(mode==='native'){g.renderQualitySettings.setEnabled(false);g.crtGuestSettings.setEnabled(false);} },mode);
   await page.waitForTimeout(2000);
   await page.evaluate(()=>{const p=window.__renderProfile;p.stats={};p.draws=0;p.triangles=0;p.raf=[];p.gpuFrames={};p.gpuEpoch++;p.last=0;p.firstFrame=window.__game.frameStats.frame;p.startTime=performance.now();p.record=true;});
   await page.waitForTimeout(Number(process.env.RENDER_PROFILE_MS||3500));
   const row=await page.evaluate(()=>{
    const g=window.__game,p=window.__renderProfile;p.record=false;const frames=p.raf.length,presentedFrames=g.frameStats.frame-p.firstFrame,denominator=Math.max(1,presentedFrames),presentedFps=1000*presentedFrames/(performance.now()-p.startTime),sorted=[...p.raf].sort((a,b)=>a-b);
    const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');let objects=0;g.scene.traverse(()=>objects++);
    const gpuTimes=Object.values(p.gpuFrames).filter(f=>f.started===f.finished).map(f=>f.ms).sort((a,b)=>a-b);
    return {level:g.getCurrentLevel().id,rafFps:1000/(p.raf.reduce((a,b)=>a+b,0)/frames),frames,presentedFrames,presentedFps,frameMedian:sorted[Math.floor(frames*.5)],frameP95:sorted[Math.floor(frames*.95)],gpuTiming:{supported:p.gpuSupported,samples:gpuTimes.length,medianMs:gpuTimes[Math.floor(gpuTimes.length*.5)],p95Ms:gpuTimes[Math.floor(gpuTimes.length*.95)]},cpu:Object.fromEntries(Object.entries(p.stats).map(([k,s])=>[k,{ms:s.ms/denominator,calls:s.calls/denominator}])),draws:p.draws/denominator,triangles:p.triangles/denominator,objects,characterBatches:g.player.characterRenderBatchDiagnostics??null,skinBounds:g.getSkinBoundsKernelDiagnostics?.()??null,interface:g.getInterfaceSurfaceDiagnostics?.()??null,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,quality:g.renderQualitySettings.snapshot(),crt:g.getCrtDiagnostics(),contextLost:gl.isContextLost()};
   });
   rows.push({mode,throttle,...row});console.log(JSON.stringify(rows.at(-1)));
   await writeFile(`${output}/profile.json`,JSON.stringify({base,rows,errors},null,2));
  }
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  await page.screenshot({path:`${output}/${id}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));
}finally{await writeFile(`${output}/profile.json`,JSON.stringify({base,rows,errors},null,2));await browser.close();}
