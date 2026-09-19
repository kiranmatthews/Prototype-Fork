import {renderQualitySettings} from '../src/render-quality/settings';
import {crtGuestSettings} from '../src/crt-guest/settings';
import {GameHudSurface} from '../src/gameHudSurface';
import {GameInterfaceSurface} from '../src/gameInterfaceSurface';
renderQualitySettings.setRegularResolution(540);crtGuestSettings.setEnabled(false);
await import('../src/main');
const g=(window as any).__game;
let recording=false,skipInterface=false,skipHud=false,stats:Record<string,{ms:number;calls:number}>={},draws:Record<string,{calls:number;triangles:number}>={};
function measure(name:string,fn:()=>any){const start=performance.now();try{return fn();}finally{if(recording){const s=stats[name]??={ms:0,calls:0};s.ms+=performance.now()-start;s.calls++;}}}
function wrap(object:any,key:string,name=key){const original=object[key];object[key]=function(...args:any[]){return measure(name,()=>original.apply(this,args));};}
const interfaceDraw=GameInterfaceSurface.prototype.draw;
GameInterfaceSurface.prototype.draw=function(...args:any[]){if(skipInterface)return;return measure('interface',()=>interfaceDraw.apply(this,args as any));};
const hudDraw=GameHudSurface.prototype.draw;
GameHudSurface.prototype.draw=function(...args:any[]){if(skipHud)return false;return measure('canvasPaint',()=>hudDraw.apply(this,args as any));};
for(const key of ['step','applyRenderInterpolation','restoreRenderPose'])wrap(g.player,key);
for(const key of ['finishVisualStep','syncVisual','refreshCharacterBounds','queryGround','updateFruit','seatOnFoot','syncReusablePrimitives','applyCharacterProportions','clearCharacterAppearance'])if(typeof g.player[key]==='function')wrap(g.player,key);
wrap(g.player.interactionMeasure,'measure','interactionBounds');
const localBounds=g.player.interactionMeasure.localBounds;
g.player.interactionMeasure.localBounds=function(mesh:any){return measure(`bounds:${mesh.name}`,()=>localBounds.call(this,mesh));};
for(const key of ['setHUD','drawIcons','drawGameHud'])wrap(g.ui,key);
wrap(g.gameFlow,'update','menuUpdate');wrap(g.renderer.shadowMap,'render','shadowCPU');
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene:any,camera:any)=>measure(scene===g.scene?'worldCPU':'otherRenderCPU',()=>render(scene,camera));
const direct=g.renderer.renderBufferDirect.bind(g.renderer);
g.renderer.renderBufferDirect=(...args:any[])=>{if(recording){const [, ,geometry,material,object]=args;const key=material.isMeshDepthMaterial?'shadow':material.name||material.type;const d=draws[key]??={calls:0,triangles:0};d.calls++;d.triangles+=(geometry.index?.count??geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);}return direct(...args);};
const panel=document.createElement('div');panel.style.cssText='position:fixed;left:0;top:0;z-index:999999;background:#06131de8;color:white;padding:6px;font:11px monospace;max-height:85vh;overflow:auto';
const report=document.createElement('pre');report.dataset.testid='mobile-profile';let running=false;const rows:any[]=[];
function show(phase:string){report.textContent=JSON.stringify({phase,rows},null,2);}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function sample(id:string,mode:string){show(`Loading ${id} ${mode}`);g.switchLevel(id);g.gameFlow.hide();await g.getLevel().prepareJungleAssets();
 skipInterface=mode==='without interface';skipHud=mode==='without canvas';g.renderer.shadowMap.enabled=mode!=='without shadows';crtGuestSettings.setEnabled(mode==='CRT');
 await wait(2000);stats={};draws={};const start=performance.now(),frame=g.frameStats.frame;recording=true;await wait(3000);recording=false;
 const frames=g.frameStats.frame-frame,elapsed=performance.now()-start;
 rows.push({id,mode,fps:frames*1000/elapsed,frames,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],cpuMsPerFrame:Object.fromEntries(Object.entries(stats).map(([name,s])=>[name,+(s.ms/frames).toFixed(3)])),drawsPerFrame:Object.fromEntries(Object.entries(draws).map(([name,s])=>[name,{calls:+(s.calls/frames).toFixed(1),triangles:Math.round(s.triangles/frames)}])),hud:g.getGameHudDiagnostics(),interface:g.getInterfaceSurfaceDiagnostics(),crt:g.getCrtDiagnostics()});show('Complete');
}
function button(label:string,action:()=>Promise<void>){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{if(running)return;running=true;try{await action();}finally{recording=false;skipInterface=skipHud=false;g.renderer.shadowMap.enabled=true;crtGuestSettings.setEnabled(false);running=false;}};panel.append(b);}
for(const id of ['sky','treehouse-trail'])button(`${id} comparison`,async()=>{for(const mode of ['normal','without shadows','without interface','without canvas','CRT'])await sample(id,mode);});
button('Character CPU',()=>sample('sky','normal'));
button('Treehouse CPU',()=>sample('treehouse-trail','normal'));
panel.append(report);document.body.append(panel);show('Ready');
