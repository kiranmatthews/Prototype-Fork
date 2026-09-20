// Local-only causal profile. Runtime settings and artwork are restored after each diagnostic.
import {renderQualitySettings} from '../src/render-quality/settings';
import {crtGuestSettings} from '../src/crt-guest/settings';
import {GameInterfaceSurface} from '../src/gameInterfaceSurface';
import {SkateChaseCamera} from '../src/skateChaseCamera';
import {FrozenScenePass} from '../src/frozenScenePass';
renderQualitySettings.setRegularResolution(540);crtGuestSettings.setEnabled(new URLSearchParams(location.search).has('crt'));
await import('../src/main');
const g=(window as any).__game,gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
let recording=false,worldFrames=0,presentedFrames=0,stats:any={},draws:any={},uploads=0,gpu:any={},queries:any[]=[],skipUI=false;
const rows:any[]=[],wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
let checkSnapshot=false,snapshotChecked=false;
const frozenRender=FrozenScenePass.prototype.render;
FrozenScenePass.prototype.render=function(...args:any[]){
 frozenRender.apply(this,args as any);
 const snapshot=(this as any).snapshot;
 if(checkSnapshot&&snapshot){
  checkSnapshot=false;const read=args[2],width=Math.min(64,read.width),height=Math.min(64,read.height);
  const a=new Uint16Array(width*height*4),b=new Uint16Array(a.length);
  g.renderer.readRenderTargetPixels(snapshot,0,0,width,height,a);g.renderer.readRenderTargetPixels(read,0,0,width,height,b);
  let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;
  rows.push({label:'frozen HDR pixel parity',different,nonempty:a.some(v=>v!==0)});snapshotChecked=true;
 }
};
function wrap(object:any,key:string,name=key){const original=object[key];object[key]=function(...args:any[]){const start=performance.now();try{return original.apply(this,args);}finally{if(recording){const s=stats[name]??={ms:0,calls:0};s.ms+=performance.now()-start;s.calls++;}}};}
for(const key of ['step','queryGround','finishVisualStep','refreshCharacterBounds','commitRenderStep'])wrap(g.player,key);
wrap(g.competitionUI,'render','competitionDOM');wrap(g.ui,'setHUD');wrap(g.ui,'drawGameHud');
wrap(SkateChaseCamera.prototype,'update','camera');wrap(g.renderer.shadowMap,'render','shadows');
const ui=GameInterfaceSurface.prototype.draw;GameInterfaceSurface.prototype.draw=function(...args:any[]){if(skipUI)return;const start=performance.now();try{return ui.apply(this,args as any);}finally{if(recording){const s=stats.interface??={ms:0,calls:0};s.ms+=performance.now()-start;s.calls++;}}};
let drawKey='unknown';const direct=g.renderer.renderBufferDirect.bind(g.renderer);
g.renderer.renderBufferDirect=(...args:any[])=>{const material=args[3],object=args[4];drawKey=material.isMeshDepthMaterial?'shadow':material.name||object.name||material.type;try{return direct(...args);}finally{drawKey='unknown';}};
for(const [name,instanced]of [['drawElements',false],['drawArrays',false],['drawElementsInstanced',true],['drawArraysInstanced',true]] as const){
 const original=gl[name].bind(gl);gl[name]=(...args:any[])=>{
  if(recording){const count=name.includes('Elements')?args[1]:args[2],instances=instanced?args.at(-1):1;
   if(drawKey==='OutputShader')presentedFrames++;
   const d=draws[drawKey]??={calls:0,triangles:0};d.calls++;d.triangles+=(args[0]===gl.TRIANGLES?count/3:args[0]===gl.TRIANGLE_STRIP?Math.max(0,count-2):0)*instances;}
  return original(...args);
 };
}
const sub=gl.texSubImage2D.bind(gl);gl.texSubImage2D=(...args:any[])=>{if(recording){const image=args.at(-1);uploads+=(image?.width??args[4])*(image?.height??args[5]);}return sub(...args);};
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene:any,camera:any)=>{
 const key=scene===g.scene?'world':`${(scene.material??scene.children[0]?.material)?.name??'post/UI'} ${g.renderer.getRenderTarget()?.width??gl.drawingBufferWidth}x${g.renderer.getRenderTarget()?.height??gl.drawingBufferHeight}`,start=performance.now();let query:any;
 if(recording&&ext&&queries.length<96){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
 try{return render(scene,camera);}finally{
  if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push({query,key});}
  if(recording){if(scene===g.scene)worldFrames++;const s=stats[key]??={ms:0,calls:0};s.ms+=performance.now()-start;s.calls++;}
 }
};
const poll=()=>{for(let i=queries.length-1;i>=0;i--){const {query,key}=queries[i];if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))continue;
 if(recording&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu[key]=(gpu[key]??0)+gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;
 gl.deleteQuery(query);queries.splice(i,1);}requestAnimationFrame(poll);};requestAnimationFrame(poll);
const panel=document.createElement('div');panel.style.cssText='position:fixed;z-index:999999;top:0;left:0;background:#10251eee;color:white;padding:8px;font:11px monospace;max-width:44vw;max-height:90vh;overflow:auto';
const output=document.createElement('pre');output.dataset.testid='cup-profile';panel.append(output);document.body.append(panel);
function show(phase:string){output.textContent=JSON.stringify({phase,rows},null,2);}
async function sample(label:string){show('Profiling '+label);await wait(700);stats={};draws={};uploads=worldFrames=presentedFrames=0;gpu={};const start=performance.now();recording=true;await wait(2400);recording=false;
 const frames=presentedFrames||worldFrames;
 rows.push({label,frames,worldFrames,fps:frames*1000/(performance.now()-start),cpu:Object.fromEntries(Object.entries(stats).map(([k,s]:any)=>[k,s.ms/frames])),gpu:Object.fromEntries(Object.entries(gpu).map(([k,v]:any)=>[k,v/frames])),draws:Object.entries(draws).map(([name,d]:any)=>({name,calls:d.calls/frames,triangles:d.triangles/frames})).sort((a,b)=>b.triangles-a.triangles),uploadsPerFrame:uploads/frames,scenery:g.getLevel().jungleAssetDiagnostics,interface:g.getInterfaceSurfaceDiagnostics(),geometry:{...g.renderer.info.memory},position:g.player.pos.toArray()});show('Complete');
}
let running=false;function button(name:string,action:()=>Promise<void>){const b=document.createElement('button');b.textContent=name;b.onclick=async()=>{if(running)return;running=true;try{await action();}catch(error){show(String(error));}finally{recording=false;running=false;}};panel.prepend(b);}
button('Profile Jungle Cup',async()=>{
 await g.gameFlow.transition(()=>{g.switchLevel('jungle-cup');g.gameFlow.hide();});
 await sample('intro');g.competitionAction('start');while(g.getCompetition().phase!=='running')await wait(100);
 await sample('running');
 const root=g.getLevel().jungleAssets.root,scenery=root.children.filter((o:any)=>typeof o.userData.jungleAsset==='string'&&/stone|joint|earth/.test(o.userData.jungleAsset));
 try{
  g.renderer.shadowMap.enabled=false;await sample('diagnostic: no shadows');g.renderer.shadowMap.enabled=true;
  const lights:any[]=[];g.scene.traverse((o:any)=>{if(o.isPointLight&&o.visible){lights.push(o);o.visible=false;}});
  try{await sample('diagnostic: no point lights');}finally{lights.forEach(o=>o.visible=true);}
  scenery.forEach((o:any)=>o.visible=false);await sample('diagnostic: no temple blocks');scenery.forEach((o:any)=>o.visible=true);
  skipUI=true;await sample('diagnostic: no interface');
 }finally{g.renderer.shadowMap.enabled=true;scenery.forEach((o:any)=>o.visible=true);skipUI=false;}
});
button('Profile normal run',()=>sample('running normal'));
button('Verify timer pixels and three heats',async()=>{
 show('Checking Cup presentation');
 const {getRooAppearance,setRooAppearance}=await import('../src/roo-type/settings');
 const previous={...getRooAppearance()};setRooAppearance({shimmer:false});
 try{
  await g.gameFlow.transition(()=>{g.switchLevel('jungle-cup');g.gameFlow.hide();});
  checkSnapshot=true;while(!snapshotChecked)await wait(50);
  for(let heat=1;heat<=3;heat++){
   g.competitionAction('start');while(g.getCompetition().phase!=='running')await wait(50);await wait(300);
   const painter=g.competitionUI.surface,surface=painter.surface,full=document.createElement('canvas');
   const size={width:surface.diagnostics.width,height:surface.diagnostics.height};full.width=size.width;full.height=size.height;
   const ctx=full.getContext('2d')!;ctx.scale(size.width/window.innerWidth,size.height/window.innerHeight);painter.paintElement(ctx,g.competitionUI.element);
   const reference=ctx.getImageData(0,0,size.width,size.height).data;
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,size.width,size.height);ctx.drawImage(surface.canvas,surface.crop.x,surface.crop.y);
   const actual=ctx.getImageData(0,0,size.width,size.height).data;let different=0,max=0;
   for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-reference[i]);if(d>1)different++;max=Math.max(max,d);}
   rows.push({label:'heat '+heat+' timer parity',different,max,size:[surface.canvas.width,surface.canvas.height]});full.width=full.height=1;
   if(different>8||max>8)throw Error('Timer pixels changed');
   g.getCompetition().remaining=.05;const deadline=performance.now()+15000;
   while(g.getCompetition().phase!=='judges'||g.getCompetition().revealedJudges!==3){if(performance.now()>deadline)throw Error('Heat did not finish');await wait(50);}
   g.competitionAction('standings');rows.push({label:'heat '+heat+' complete',phase:g.getCompetition().phase,remaining:g.getCompetition().remaining});show('Checking Cup presentation');
  }
  if(rows.some(r=>r.label==='frozen HDR pixel parity'&&(r.different||!r.nonempty)))throw Error('Snapshot pixels changed');
  show('Complete');
 }finally{setRooAppearance(previous);}
});
show('Ready');
