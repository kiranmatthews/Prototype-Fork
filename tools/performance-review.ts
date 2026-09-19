// Local-only diagnostic UI. Uses the real renderer and level switch lifecycle.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();});
const panel=document.createElement('div');panel.style.cssText='position:fixed;left:4px;top:4px;z-index:999999;background:#081b23ee;color:white;padding:8px;font:12px monospace;max-height:90vh;overflow:auto';
const report=document.createElement('pre');report.dataset.testid='performance-report';
const rows:any[]=[];let running=false,drawMs:number[]=[],frameMs:number[]=[],lastFrame=0,recording=false;
const original=g.renderer.render.bind(g.renderer);
// Track actual GPU allocations, including maps hidden in shader uniforms.
const gl=g.renderer.getContext(),live=new Map<any,any>(),bound=new Map<number,any>();let serial=0;
if(new URLSearchParams(location.search).has('trace')){
let allocationContext:any=null,allocationMaterial:any=null;const renderBufferDirect=g.renderer.renderBufferDirect.bind(g.renderer);
g.renderer.renderBufferDirect=(...args:any[])=>{const material=args[3],object=args[4];allocationMaterial=material;allocationContext={object:object.name,material:material.name,type:material.type};try{return renderBufferDirect(...args);}finally{allocationContext=null;allocationMaterial=null;}};
const createTexture=gl.createTexture.bind(gl),deleteTexture=gl.deleteTexture.bind(gl),bindTexture=gl.bindTexture.bind(gl),texImage2D=gl.texImage2D.bind(gl),texStorage2D=gl.texStorage2D.bind(gl);
gl.createTexture=()=>{const texture=createTexture();const uniforms=allocationMaterial?g.renderer.properties.get(allocationMaterial).uniforms:{};live.set(texture,{id:++serial,source:'render target / pending upload',context:allocationContext,uniforms:Object.entries(uniforms??{}).filter(([,v]:any)=>v.value?.isTexture).map(([key,v]:any)=>({key,name:v.value.name,disposed:v.value.userData.disposed,size:[v.value.image?.width,v.value.image?.height]}))});return texture;};
gl.deleteTexture=(texture:any)=>{live.delete(texture);return deleteTexture(texture);};
gl.bindTexture=(target:number,texture:any)=>{bound.set(target,texture);return bindTexture(target,texture);};
gl.texImage2D=(...args:any[])=>{const data=live.get(bound.get(args[0])),source=args[args.length-1];if(data){data.size=args.length===6?[source?.width,source?.height]:[args[3],args[4]];data.source=source?.src??source?.constructor?.name??'render target';}return texImage2D(...args);};
gl.texStorage2D=(...args:any[])=>{const data=live.get(bound.get(args[0]));if(data)data.size=[args[3],args[4]];return texStorage2D(...args);};
}
g.renderer.render=(scene:any,camera:any)=>{const start=performance.now();const result=original(scene,camera);if(recording&&scene===g.scene)drawMs.push(performance.now()-start);return result;};
const tick=(time:number)=>{if(recording&&lastFrame)frameMs.push(time-lastFrame);lastFrame=time;requestAnimationFrame(tick);};requestAnimationFrame(tick);
const waitFrames=(count:number)=>new Promise<void>(resolve=>{const next=()=>--count<=0?resolve():requestAnimationFrame(next);requestAnimationFrame(next);});
const show=(phase:string)=>{report.textContent=JSON.stringify({phase,rows},null,2);};
async function sample(id:string){
  show('Loading '+id);g.gameFlow.hide();g.switchLevel(id);g.gameFlow.hide();
  await g.getLevel().prepareJungleAssets();await waitFrames(90);
  drawMs=[];frameMs=[];recording=true;await waitFrames(120);recording=false;
  const level=g.getLevel(),size=g.renderer.getDrawingBufferSize(new THREE.Vector2());let meshes=0,triangles=0,treehouseMeshes=0;
  g.scene.traverse((o:any)=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);if(String(o.userData.jungleAsset).startsWith('treehouse'))treehouseMeshes++;}});
  const stats=(values:number[])=>{values.sort((a,b)=>a-b);return {median:+values[Math.floor(values.length*.5)]?.toFixed(2),p95:+values[Math.floor(values.length*.95)]?.toFixed(2)};};
  g.scene.traverse((o:any)=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])for(const texture of [...Object.values(m),...Object.values(m.userData??{})] as any[]){if(!texture?.isTexture)continue;const data=live.get(g.renderer.properties.get(texture).__webglTexture);if(data)data.label=`${o.name}|${m.name}|${texture.name}`;}});
  rows.push({id,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs?.length,meshes,triangles,treehouseMeshes,
    liveTextures:[...live.values()],
    jungle:level.jungleAssetDiagnostics,canvas:size.toArray(),resolution:g.getRenderQualitySizes(),settings:g.renderQualitySettings.snapshot(),frame:stats(frameMs),sceneCpu:stats(drawMs)});show('Sampled '+id);
}
function button(label:string,action:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:7px;margin:3px';b.onclick=async()=>{if(running)return;running=true;try{await action();show('Complete');}catch(e){show(String(e));}finally{running=false;}};panel.append(b);}
for(const id of ['sky','treehouse-trail','jungle','warproom','test','dark'])button(id,()=>sample(id));
button('Sky / Treehouse / Sky × 2',async()=>{rows.length=0;for(const id of ['sky','treehouse-trail','sky','treehouse-trail','sky'])await sample(id);});
button('Map / City / Sky',async()=>{for(const id of ['warproom','test','sky'])await sample(id);});
panel.append(report);document.body.append(panel);show('Ready');
