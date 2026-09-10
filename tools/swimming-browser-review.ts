// Source-owned local swimming controls. Normal gameplay and storage stay intact.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player, panel=document.createElement('section');
panel.style.cssText='position:fixed;left:8px;bottom:8px;z-index:999999;background:#102b28ed;color:white;padding:10px;font:12px monospace;width:295px';
const buttons=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='swim-status';panel.append(buttons,status);document.body.append(panel);
const nativeOnDeath=p.onDeath;
let mode='normal',fast=false,side=false;
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:7px;margin:2px';b.onclick=fn;buttons.append(b);};
function place(deep=false){panel.style.left='8px';panel.style.right='auto';p.onDeath=nativeOnDeath;p.respawn(g.level,true,true);if(deep){p.pos.set(g.level.spawnPos.x,g.level.water.seaLevel-1.6,52);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=0;}p.snapRenderInterpolation();}
add('Walk into water',()=>{place();mode='out';fast=false;});
add('Tread water',()=>{place(true);mode='idle';fast=false;});
add('Stroke loop',()=>{place(true);mode='circle';fast=false;});
add('Swim',()=>{mode='out';fast=false;});add('Fast stroke',()=>{if(mode!=='circle')mode='out';fast=true;});
add('Return to shore',()=>{mode='back';fast=false;});add('Idle',()=>mode='idle');
add('Side view',()=>side=!side);add('Normal controls',()=>{if(p.state==='dead')place();p.onDeath=nativeOnDeath;mode='normal';side=false;});
add('Death on shore',()=>{place();mode='dead';side=true;panel.style.left='auto';panel.style.right='8px';const lives=p.lives;p.onDeath=()=>{};p.die();p.lives=lives;p.respawnTimer=60;g.camera.lookAt(p.renderPosition);});
add('Airborne death',()=>{place();p.pos.y+=5;p.prevPos.copy(p.pos);p.grounded=false;p.vVel=-2;mode='dead';side=true;panel.style.left='auto';panel.style.right='8px';const lives=p.lives;p.onDeath=()=>{};p.die();p.lives=lives;p.respawnTimer=60;g.camera.lookAt(p.renderPosition);});
add('Hide tools',()=>{panel.style.display='none';});
add('Reset',()=>{place();mode='normal';});
const native=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
  if(mode!=='normal'){
    input.moveX=mode==='circle'?Math.sin(p.runTime*.65):0;input.moveY=mode==='circle'?Math.cos(p.runTime*.65):mode==='out'?-1:mode==='back'?1:0;
    input.jumpHeld=fast;input.jumpPressed=input.jumpReleased=input.grindHeld=input.grindPressed=input.spinHeld=input.spinPressed=input.grabHeld=input.grabPressed=false;
    if(mode==='out'&&p.pos.z>66)mode='idle';
    if(mode==='back'&&p.pos.z<10)mode='idle';
  }
  native(dt,input,level);
};
// Optional side angle is confined to this review, after the game writes its camera.
const look=g.camera.lookAt.bind(g.camera);
g.camera.lookAt=(...args:any[])=>{
  if(side){g.camera.position.copy(p.renderPosition).add(new THREE.Vector3(8,3,1));look(p.renderPosition.clone().add(new THREE.Vector3(0,p.state==='dead'?.7:1.4,p.state==='dead'?1.2:0)));}
  else look(...args);
};
const head=new THREE.Vector3();
function report(){
  p.animationRig.jointsById.get('head')?.node?.getWorldPosition(head);
  status.textContent=JSON.stringify({mode,state:p.state,clip:p.animationClipHint,board:p.freeSkate,
    position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),speed:+p.swimVelocity.length().toFixed(2),
    water:+(g.level.swimmingSurfaceAt(p.pos.x,p.pos.z)??0).toFixed(2),headY:+head.y.toFixed(2),
    lives:p.lives,death:p.deathPresentationDiagnostics,boundsMinY:+p.interactionBoundsDiagnostics.min[1].toFixed(3)},null,2);requestAnimationFrame(report);
}
report();
