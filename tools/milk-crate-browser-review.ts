// Local art/contact review. Creates one session-only crate; never saves level data.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const ready=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(ready);};ready();});
g.campaign.startEphemeral();g.gameFlow.hide();const level=g.getLevel(),p=g.player;
const spawn=level.spawnPos.clone();level.crate(spawn.x,spawn.y,spawn.z-3,'multihit',{noAuto:true});
const crate=level.crates.at(-1);await crate.milkCrate.ready;
let frozen=true,close=true,angle=0;let sequence:number[]=[9];const input={moveX:0,moveY:0,inventoryHeld:true,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false};
const nativeStep=p.step.bind(p);p.step=(dt:number)=>{if(!frozen)nativeStep(dt,input,level);};
const panel=document.createElement('details');panel.open=true;panel.className='milk-crate-review';panel.style.cssText='position:fixed;z-index:999999;left:12px;bottom:12px;background:#0a202eed;color:#fff;padding:10px;width:350px;font:12px monospace';
const summary=document.createElement('summary');summary.textContent='Milk crate review';const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='milk-crate-status';status.style.whiteSpace='pre-wrap';panel.append(summary,controls,status);document.body.append(panel);
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='margin:2px;padding:7px';b.onclick=fn;controls.append(b);};
const helper=new THREE.Box3Helper(crate.box,0x78fff3);helper.visible=false;g.scene.add(helper);
function reset(){sequence=[9];level.setTimeTrial(false);p.ttActive=false;level.reset(true);p.respawn(level,true,true,{position:crate.mesh.position.clone().add(new THREE.Vector3(0,3,0)),heading:new THREE.Vector3(0,0,-1)});p.speed=0;p.freeSkate=false;p.rawInput=input;frozen=true;}
add('Reset',reset);
add('Bounce once',()=>{if(!crate.alive)return;p.state='air';p.grounded=false;p.spinTimer=0;p.slamActive=false;p.freeSkate=false;p.speed=0;p.rawInput=input;p.prevPos.set(crate.mesh.position.x,crate.box.max.y+.2,crate.mesh.position.z);p.pos.set(crate.mesh.position.x,crate.box.max.y-.06,crate.mesh.position.z);p.vVel=-10;p.collide(level);frozen=true;});
add('Five live bounces',()=>{reset();close=false;frozen=false;});
add('Spin smash',()=>{if(crate.alive)p.smashCrate(level,crate);});
add('Prop close-up',()=>{close=true;frozen=true;});add('Gameplay view',()=>close=false);
for(const [name,value]of[['Front',0],['Side',Math.PI/2],['Back',Math.PI],['Top',-1]] as const)add(name,()=>{close=true;angle=value;});
add('Bounds',()=>helper.visible=!helper.visible);
add('Time trial',()=>{level.setTimeTrial(true);p.ttActive=true;});add('Standard',()=>{level.setTimeTrial(false);p.ttActive=false;});
add('CRT on',()=>g.crtGuestSettings.setEnabled(true));add('CRT off',()=>g.crtGuestSettings.setEnabled(false));
add('Finish review',()=>location.assign('/?playtest&level=jungle'));
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args:any[])=>{
  if(args[1]===g.camera){
    const target=crate.mesh.position.clone();g.camera.up.set(0,1,0);p.group.visible=!close;
    if(close){g.camera.fov=34;if(angle===-1){g.camera.position.copy(target).add(new THREE.Vector3(0,3.8,.01));}else g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle+.5)*2.9,1.55,Math.cos(angle+.5)*2.9));}
    else {g.camera.fov=45;g.camera.position.copy(target).add(new THREE.Vector3(4,4.7,6.5));target.y+=1;}
    g.camera.lookAt(target);g.camera.updateProjectionMatrix();
  }
  render(...args);
};
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');document.body.classList.add('game-debug-hidden');document.body.classList.remove('game-debug-visible');
 crate.milkCrate.visual.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(crate.milkCrate.visual);
 const count=crate.milkCrate.bottles.count;if(sequence.at(-1)!==count)sequence.push(count);
 status.textContent=JSON.stringify({sequence,bottles:crate.milkCrate.bottles.count,hits:crate.hitsRemaining,alive:crate.alive,loaded:crate.milkCrate.assetsLoaded,proxyVisible:crate.mesh.material.visible,modelVisible:crate.milkCrate.visual.visible,collider:crate.box.getSize(new THREE.Vector3()).toArray().map((v:number)=>+v.toFixed(3)),visual:bounds.getSize(new THREE.Vector3()).toArray().map((v:number)=>+v.toFixed(3)),player:p.state,crt:g.crtGuestSettings.enabled},null,2);requestAnimationFrame(report);}
reset();report();
