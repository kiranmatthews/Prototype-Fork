// Local diagnostic: count submitted geometry, canvas uploads and allocations
// across the real gameplay, loading and completion paths.
const canvases:{ref:WeakRef<HTMLCanvasElement>;stack:string}[]=[];
const create=document.createElement.bind(document);
(document as any).createElement=(tag:string,...args:any[])=>{const el=(create as any)(tag,...args);if(tag.toLowerCase()==='canvas')canvases.push({ref:new WeakRef(el),stack:new Error().stack??''});return el;};
const {renderQualitySettings}=await import('../src/render-quality/settings');
const {crtGuestSettings}=await import('../src/crt-guest/settings');
renderQualitySettings.setRegularResolution(540);crtGuestSettings.setEnabled(false);
await import('../src/main');
const g=(window as any).__game,gl=g.renderer.getContext();let recording=false,label='',rows:any[]=[],cpu=0,frames=0,draws:any={},uploads:any={},allocations:any[]=[],gpu:number[]=[];
const longTasks:any[]=[];if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>{if(recording)for(const entry of list.getEntries())longTasks.push({phase:g.gameFlow.loadingPhase??g.gameFlow.currentScreen??'play',ms:entry.duration});}).observe({type:'longtask'});
const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),queries:any[]=[];
let currentDraw='';const direct=g.renderer.renderBufferDirect.bind(g.renderer);
g.renderer.renderBufferDirect=(...args:any[])=>{const [, ,geometry,material,object]=args;currentDraw=material.isMeshDepthMaterial?'shadow':material.name||material.type;if(recording){const d=draws[currentDraw]??={calls:0,triangles:0};d.calls++;d.triangles+=(geometry.index?.count??geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);}try{return direct(...args);}finally{currentDraw='';}};
const sub=gl.texSubImage2D.bind(gl);gl.texSubImage2D=(...args:any[])=>{if(recording){const image=args.at(-1),w=image?.width??args[4],h=image?.height??args[5],key=currentDraw||'upload';const u=uploads[key]??={calls:0,pixels:0};u.calls++;u.pixels+=Number(w)*Number(h);}return sub(...args);};
const storage=gl.texStorage2D.bind(gl);gl.texStorage2D=(...args:any[])=>{if(recording)allocations.push({phase:g.gameFlow.loadingPhase??'play',width:args[3],height:args[4],target:g.renderer.getRenderTarget()?.texture.name,draw:currentDraw});return storage(...args);};
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(scene:any,camera:any)=>{const timed=recording&&scene===g.scene,start=performance.now();let query:any;
 if(timed&&ext&&queries.length<24){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
 try{return render(scene,camera);}finally{if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(query);}if(timed){cpu+=performance.now()-start;frames++;}}
};
const poll=()=>{for(let i=queries.length-1;i>=0;i--){const q=queries[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;if(recording&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);queries.splice(i,1);}requestAnimationFrame(poll);};requestAnimationFrame(poll);
const panel=create('div');panel.style.cssText='position:fixed;right:0;top:0;z-index:999999;background:#071724ec;color:white;padding:8px;font:11px monospace;max-width:48vw;max-height:85vh;overflow:auto';
const report=create('pre');report.dataset.testid='frame-work';panel.append(report);document.body.append(panel);
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function show(phase:string){report.textContent=JSON.stringify({phase,rows},null,2);}
function begin(name:string){label=name;cpu=frames=0;draws={};uploads={};allocations=[];gpu=[];longTasks.length=0;recording=true;show('Profiling '+name);}
function end(){recording=false;const live=canvases.map(({ref,stack})=>{const c=ref.deref();return c?{width:c.width,height:c.height,MiB:c.width*c.height*4/1048576,stack:stack.split('\n').slice(2,5).join('\n')}:null;}).filter(Boolean).sort((a:any,b:any)=>b.MiB-a.MiB);
 rows.push({label,worldFrames:frames,worldCpuMs:cpu/Math.max(1,frames),gpuMs:gpu.length?gpu.reduce((a,b)=>a+b)/gpu.length:null,draws,uploads,allocations,longTasks:[...longTasks],canvases:live.slice(0,12),canvasMiB:live.reduce((a:number,c:any)=>a+c.MiB,0),scenery:g.getLevel().jungleAssetDiagnostics,water:g.getLevel().water?.stats,vortex:g.getGameFlowVortexDiagnostics(),flow:g.getGameFlowSurfaceDiagnostics(),hud:g.getGameHudDiagnostics()});show('Completed '+label);
}
let running=false;
function button(name:string,action:()=>Promise<void>){const b=create('button');b.textContent=name;b.onclick=async()=>{if(running)return;running=true;try{await action();show('Complete');}catch(error){show(String(error));}finally{recording=false;running=false;}};panel.prepend(b);}
button('Profile play, loading and finish',async()=>{
 for(const id of ['treehouse-trail','jungle']){
  begin('transition to '+id);await g.gameFlow.transition(()=>{g.switchLevel(id);g.gameFlow.hide();});end();
  await wait(600);begin(id+' playing');await wait(2000);end();
 }
 await g.gameFlow.transition(()=>{g.switchLevel('treehouse-trail');g.gameFlow.hide();});
 begin('finish Treehouse');g.player.state='finished';g.showCampaignResults();
 while(g.gameFlow.currentScreen!=='results'||g.gameFlow.loadingPhase)await wait(100);end();
 begin('results steady');await wait(2500);end();
});
button('Verify HUD pixels and repeated finishes',async()=>{
 show('Checking HUD pixels and finishes');
 const {GameHudSurface}=await import('../src/gameHudSurface');
 const {getRooAppearance,setRooAppearance}=await import('../src/roo-type/settings');
 const {presentationAssets}=await import('../src/presentationLoading');
 const appearance={...getRooAppearance()};setRooAppearance({shimmer:false});
 try{
  for(const id of ['treehouse-trail','jungle','sky','treehouse-trail']){
   await g.gameFlow.transition(()=>{g.switchLevel(id);g.gameFlow.hide();});
   const live=g.ui.gameHudSurface,reference=new GameHudSurface({elements:live.elements});
   await presentationAssets.waitUntilSettled();
   const state={boost:g.ui.boostFrame,special:g.ui.specialFrame,nowMs:performance.now()},size={width:live.diagnostics.width,height:live.diagnostics.height};
   live.draw(size,state);reference.draw(size,state);
   const full=create('canvas');full.width=size.width;full.height=size.height;
   const ctx=full.getContext('2d')!;ctx.drawImage(live.canvas,live.crop.x,live.crop.y);
   const a=ctx.getImageData(0,0,size.width,size.height).data,b=(reference as any).context.getImageData(0,0,size.width,size.height).data;
   let different=0,max=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);if(d>1)different++;max=Math.max(max,d);}
   rows.push({label:id+' HUD parity',different,max,crop:live.crop});reference.dispose();full.width=full.height=1;
   // Canvas backends can differ by a few antialiasing channel values after
   // integer translation; reject any meaningful clipping or image change.
   if(different>8||max>8)throw new Error('HUD crop changed rendered pixels');
   begin('finish '+id);g.player.state='finished';g.showCampaignResults();
   while(g.gameFlow.currentScreen!=='results'||g.gameFlow.loadingPhase)await wait(100);
   await wait(300);end();
   if(gl.isContextLost())throw new Error('Graphics context lost');
  }
 }finally{setRooAppearance(appearance);}
});
button('Verify streamed checkpoints and graphics recovery',async()=>{
 show('Checking streamed traversal');
 await g.gameFlow.transition(()=>{g.switchLevel('jungle');g.gameFlow.hide();});
 for(let index=0;index<6;index++){
  await g.gameFlow.transition(()=>{g.player.warpCheckpoint(g.getLevel(),1);});
  await wait(100);
  const scenery=g.getLevel().jungleAssetDiagnostics;
  rows.push({label:'streamed checkpoint '+index,position:g.player.pos.toArray(),scenery});show('Checking streamed traversal');
  if(scenery.errors.length)throw Error('Streamed asset failed');
 }
 const lose=gl.getExtension('WEBGL_lose_context');
 if(lose){
  const transition=g.gameFlow.transition(()=>{g.switchLevel('treehouse-trail');g.gameFlow.hide();});
  while(g.gameFlow.loadingPhase!=='prepare-destination')await wait(20);
  lose.loseContext();setTimeout(()=>lose.restoreContext(),500);await transition;
  rows.push({label:'context recovery during warm-up',graphics:g.getGraphicsRecoveryDiagnostics()});
  if(gl.isContextLost())throw Error('Graphics did not recover');
 }
 await g.gameFlow.transition(()=>{g.switchLevel('warproom');g.gameFlow.hide();});
 await wait(300);rows.push({label:'map after traversal',map:g.getMapPresentationDiagnostics(),memory:{...g.renderer.info.memory}});
 await g.gameFlow.transition(()=>{g.switchLevel('sky');g.gameFlow.hide();});
 await wait(300);rows.push({label:'Sky after map',memory:{...g.renderer.info.memory}});
});
show('Ready');
