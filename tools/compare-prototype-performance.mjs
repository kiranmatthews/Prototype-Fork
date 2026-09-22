// Diagnostic only. Start the original and fork Vite checkouts independently.
// Clean browser contexts preserve the user's saved settings. This samples an
// idle Sky view; RAF saturation is not a physical-phone FPS prediction.
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [originalBase,forkBase]=process.argv.slice(2);
if(!originalBase||!forkBase)throw Error('Usage: node tools/compare-prototype-performance.mjs <original-url> <fork-url>');
const output=process.env.COMPARE_OUTPUT||'/private/tmp/board-compare';
await mkdir(output,{recursive:true});
const throttle=Number(process.env.COMPARE_CPU_THROTTLE||1);
const browser=await chromium.launch({headless:true,channel:'chrome'});
const rows=[];
try {
for(const version of ['original','fork']) {
 const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
 await context.addInitScript(()=>{localStorage.setItem('protoLevelId','sky');localStorage.setItem('protoLevelsAdopted','1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('?playtest&level=sky',version==='original'?originalBase:forkBase).href);
 await page.waitForFunction(()=>window.__game?.renderer,{timeout:120000});
 await page.waitForTimeout(12000);
 if(throttle>1){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});}
 await page.evaluate(()=>{
  const g=window.__game,p=window.__profile={record:false,stats:{},draws:0,triangles:0,raf:[],last:0};
  const wrap=(o,k,n=k)=>{if(typeof o?.[k]!=='function')return;const f=o[k];o[k]=function(...a){if(!p.record)return f.apply(this,a);const t=performance.now();try{return f.apply(this,a);}finally{const s=p.stats[n]??={ms:0,calls:0};s.ms+=performance.now()-t;s.calls++;}};};
  ['step','applyRenderInterpolation','restoreRenderPose','syncVisual','refreshCharacterBounds'].forEach(k=>wrap(g.player,k));
  wrap(g.player.interactionMeasure,'measure','interactionBounds');wrap(g.ui,'setHUD');wrap(g.ui,'drawGameHud');
  wrap(g.renderer,'render','renderCPU');wrap(g.renderer.shadowMap,'render','shadowCPU');
  const gl=g.renderer.getContext();for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const f=gl[key];gl[key]=function(...a){if(p.record){p.draws++;p.triangles+=(key.startsWith('drawElements')?a[1]:a[2])/3*(key.endsWith('Instanced')?a.at(-1):1);}return f.apply(this,a);};}
  function tick(t){if(p.record&&p.last)p.raf.push(t-p.last);p.last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);
 });
 for(const mode of version==='original'?['default']:['default','720p-1x','540p-crt-off','native-crt-off','crt-on']) {
  await page.evaluate(mode=>{const g=window.__game;if(mode==='720p-1x')g.renderQualitySettings.setRegularResolution(720);if(mode==='540p-crt-off')g.renderQualitySettings.setRegularResolution(540);if(mode==='native-crt-off'){g.renderQualitySettings.setEnabled(false);g.crtGuestSettings.setEnabled(false);}if(mode==='crt-on'){g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);} },mode);
  await page.waitForTimeout(3000);
  await page.evaluate(()=>{const p=window.__profile;p.stats={};p.draws=0;p.triangles=0;p.raf=[];p.last=0;p.record=true;});
  await page.waitForTimeout(4000);
  const row=await page.evaluate(()=>{
   const g=window.__game,p=window.__profile;p.record=false;const frames=p.raf.length,sorted=[...p.raf].sort((a,b)=>a-b);let meshes=0,triangles=0,vertices=0,skinned=0;g.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position?.count??0)/3*(o.isInstancedMesh?o.count:1);vertices+=o.geometry.attributes.position?.count??0;if(o.isSkinnedMesh)skinned++;}});
   const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
   return {rafFps:1000/(p.raf.reduce((a,b)=>a+b,0)/frames),frames,frameMedian:sorted[Math.floor(frames*.5)],frameP95:sorted[Math.floor(frames*.95)],cpu:Object.fromEntries(Object.entries(p.stats).map(([k,s])=>[k,{ms:s.ms/frames,calls:s.calls/frames}])),draws:p.draws/frames,drawnTriangles:p.triangles/frames,scene:{meshes,triangles,vertices,skinned},memory:g.renderer.info.memory,programs:g.renderer.info.programs.length,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,crt:g.getCrtDiagnostics?.(),quality:g.renderQualitySettings?.snapshot(),look:g.getLookDiagnostics?.(),level:g.getCurrentLevel().id};
  });
  rows.push({version,mode,throttle,...row,errors:[...errors]});console.log(JSON.stringify(rows.at(-1)));await writeFile(`${output}/profile.json`,JSON.stringify(rows,null,2));
 }
 await page.screenshot({path:`${output}/${version}.png`});await context.close();
}
}finally{await browser.close();}
