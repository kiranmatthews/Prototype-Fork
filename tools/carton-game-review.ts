// Attach a temporary carton formation to the real game's Geometry Lab spawn.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,level=g.getLevel(),spawn=p.pos.clone();
const center=spawn.clone();center.z-=3;
const floor=level.floorY(center.x,center.z,spawn.y);
const crates:any[]=[];
for(let y=0;y<3;y++)for(let x=0;x<3;x++){
  level.crate(center.x+(x-1)*.96,floor+y*.96,center.z);
  crates.push(level.crates[level.crates.length-1]);
}
level.refreshCartonTops(true);
const panel=document.createElement('nav');panel.style.cssText='position:fixed;z-index:999999;top:12px;left:12px;display:flex;gap:6px';document.body.append(panel);
const button=(text:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=text;b.style.cssText='padding:10px;font:14px system-ui';b.onclick=fn;panel.append(b);};
let fixed=true,freeze=false,once=false,stop=false;
const nativeStep=p.step.bind(p),nativeUpdate=level.update.bind(level);
const interpolatePlayer=p.applyRenderInterpolation.bind(p),interpolateCartons=level.applyCartonRenderInterpolation.bind(level);
p.applyRenderInterpolation=(alpha:number)=>interpolatePlayer(freeze?1:alpha);
level.applyCartonRenderInterpolation=(alpha:number)=>interpolateCartons(freeze?1:alpha);
p.step=(...args:any[])=>{if(!freeze||once)nativeStep(...args);};
level.update=(...args:any[])=>{
  if(!freeze||once){nativeUpdate(...args);once=false;
    if(stop&&crates.some(c=>c.alive&&c.carton.expansion<.99&&!c.carton.covered)){freeze=true;stop=false;}}
};
button('Land on stack',()=>{
  level.reset(true);p.respawn(level,true);p.prepareStartPresentation(level);p.setCharacterHeadStyle('skull');
  p.pos.set(center.x,floor+4.8,center.z);p.prevPos.copy(p.pos);p.group.position.copy(p.pos);
  p.state='air';p.grounded=false;p.freeSkate=false;p.airFromSkate=false;p.airGrav='foot';p.airRose=true;p.airPeakY=p.pos.y;p.speed=0;p.vVel=0;
  p.collapseRenderInterpolation();freeze=false;stop=true;
});
button('Next frame',()=>{freeze=true;once=true;});button('Resume',()=>{freeze=false;stop=false;});
button('Remove top',()=>{const c=crates.filter(c=>c.alive&&Math.abs(c.mesh.position.x-center.x)<.01).sort((a,b)=>b.mesh.position.y-a.mesh.position.y)[0];if(c)level.breakCrate(c);freeze=false;});
button('Normal camera',()=>fixed=false);
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{if(fixed&&args[1]===g.camera){
  const target=center.clone();target.y=floor+1.8;g.camera.position.copy(target).add(new THREE.Vector3(-5,2,8));g.camera.lookAt(target);
}return render(...args);};
const output=document.createElement('output');output.setAttribute('aria-label','Full render carton diagnostics');output.style.cssText='position:fixed;z-index:999999;bottom:12px;left:12px;background:#fffddcdd;color:#102b28;padding:8px;font:12px monospace';document.body.append(output);
function report(){output.textContent=JSON.stringify({paused:freeze,feet:p.pos.y,broken:p.cratesBroken,cartons:crates.filter(c=>c.alive).map(c=>({y:c.mesh.position.y,fold:c.carton.expansion,covered:c.carton.covered}))});requestAnimationFrame(report);}report();
