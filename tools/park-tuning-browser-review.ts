// Local-only deterministic skating passes. Does not write saved tuning or progress.
import * as THREE from 'three';
import {TUNING} from '../src/tuning';
import {parkCruiseSpeed,parkChargedSpeed} from '../src/skateParkTuning';
import {JungleCupEvent} from '../src/competition/event';
const g:any=await new Promise(resolve=>{const poll=()=>{const value=(window as any).__game;if(value)resolve(value);else requestAnimationFrame(poll);};poll();});
JungleCupEvent.prototype.stepRun=()=>false;g.competitionAction('retry');g.getCompetition().phase='running';
const p=g.player,initial={...TUNING};let mode='idle',frame=0,freeze=true,peak=0,takeoff=0;
const neutral=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,grabHeld:false,grabPressed:false,spinHeld:false,spinPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
const view=document.createElement('section');view.style.cssText='position:fixed;bottom:5px;left:5px;z-index:999999;background:#102b28ed;color:white;font:12px monospace;padding:8px;width:300px';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='park-tuning-status';view.append(controls,status);document.body.append(view);
function start(next:string){mode=next;frame=0;freeze=false;peak=0;const vert=mode==='vert';p.respawn(g.level,true,true,{position:new THREE.Vector3(0,.1,vert?10:14),heading:new THREE.Vector3(0,0,vert?1:-1)});p.axisF.set(0,0,vert?1:-1);p.axisL.set(p.axisF.z,0,0);p.freeSkate=true;p.speed=vert?16:0;p.groundHit=p.queryGround(g.level);p.rideNormal.copy(p.groundHit.normal);}
const add=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);};
for(const mode of ['cruise','charge','ollie','vert'])add(`Run ${mode}`,()=>start(mode));
add('Freeze',()=>freeze=true);add('Resume',()=>freeze=false);
add('Restore session values',()=>{Object.assign(TUNING,initial);g.ui.syncTuningReadouts();});
const native=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
 if(freeze)return;const command=neutral();command.jumpHeld=mode==='charge'||mode==='vert'||(mode==='ollie'&&frame<Math.ceil(TUNING.parkOllieChargeTime/dt)+1);command.jumpPressed=frame===0&&command.jumpHeld;command.jumpReleased=mode==='ollie'&&frame===Math.ceil(TUNING.parkOllieChargeTime/dt)+1;
 if(command.jumpReleased)takeoff=p.pos.y;native(dt,command,level);frame++;peak=Math.max(peak,p.pos.y-takeoff);
 if((mode==='cruise'||mode==='charge')&&frame>=75)freeze=true;
 if((mode==='ollie'||mode==='vert')&&!p.grounded&&p.vVel<.3&&p.vVel>-.7)freeze=true;
 if(frame>240)freeze=true;
};
function report(){view.inert=false;view.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode,freeze,frame,speed:+p.speed.toFixed(3),cruise:+parkCruiseSpeed().toFixed(3),charge:+parkChargedSpeed().toFixed(3),fov:+g.camera.fov.toFixed(2),eye:g.camera.position.toArray().map((v:number)=>+v.toFixed(2)),pitch:+THREE.MathUtils.radToDeg(Math.asin(-new THREE.Vector3(0,0,-1).applyQuaternion(g.camera.quaternion).y)).toFixed(2),height:+peak.toFixed(3),vert:p.vertAir,bail:p.isBailing,park:g.level.skatepark},null,2);requestAnimationFrame(report);}start('cruise');report();
