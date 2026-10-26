import * as THREE from 'three';
import type {Enemy} from '../level';

export type KookRole='lookout'|'gunner';
export interface KookState {
 role:KookRole;group:number;bearing:number;exposure:number;awake:number;
 target:THREE.Vector3;alarms:number;shots:number;
}
export const KOOK={vision:24,gunRange:36,notice:.24,windup:.9,squawkLock:.6,
 squawk:.85,squawkRange:18,squawkRadius:1.65,recover:2.15,aim:1.12,lock:.76,reload:1.65};
const eye=new THREE.Vector3(),target=new THREE.Vector3(),ahead=new THREE.Vector3();
const transition=(e:Enemy,state:string)=>{e.state=state;e.stateT=0;};
export function createKookState(role:KookRole,group:number,bearing:number):KookState {
 return {role,group,bearing,exposure:0,awake:0,target:new THREE.Vector3(),alarms:0,shots:0};
}
export function resetKook(e:Enemy):void {
 const k=e.kook!;k.exposure=k.awake=k.alarms=k.shots=0;k.target.set(0,0,0);
 transition(e,'patrol');e.body.rotation.y=k.bearing;
}
interface Context {
 player:THREE.Vector3;enemies:readonly Enemy[];
 blocked:(from:THREE.Vector3,to:THREE.Vector3)=>boolean;
 fire:(enemy:Enemy,target:THREE.Vector3)=>void;
 cue:(enemy:Enemy,name:'notice'|'screech'|'wake'|'shot')=>void;
}
function face(e:Enemy,point:THREE.Vector3,dt:number):void {
 const wanted=Math.atan2(point.x-e.group.position.x,point.z-e.group.position.z);
 const delta=THREE.MathUtils.euclideanModulo(wanted-e.body.rotation.y+Math.PI,Math.PI*2)-Math.PI;
 e.body.rotation.y+=delta*Math.min(1,dt*8);
}
/** Patrol follows the roof bearing. Level measures support and turns at gaps. */
function stroll(e:Enemy,dt:number):void {
 const k=e.kook!,span=(e.x1-e.x0)/2;
 if(span<=0||e.speed<=0)return;
 const origin=e.homePosition;
 const hx=origin?.x??(e.axis==='z'?e.cross:(e.x0+e.x1)/2);
 const hz=origin?.z??(e.axis==='z'?(e.x0+e.x1)/2:e.cross);
 const dx=Math.sin(k.bearing),dz=Math.cos(k.bearing);
 let offset=(e.group.position.x-hx)*dx+(e.group.position.z-hz)*dz+e.dir*e.speed*dt;
 if(offset>span){offset=span;e.dir=-1;}else if(offset< -span){offset=-span;e.dir=1;}
 e.group.position.x=hx+dx*offset;e.group.position.z=hz+dz*offset;
 ahead.copy(e.group.position).addScaledVector(target.set(dx,0,dz),e.dir);
 face(e,ahead,dt);
}
/** Each animal owns its encounter; gunners never depend on an alarm. */
export function stepKook(e:Enemy,dt:number,ctx:Context):void {
 const k=e.kook!;e.stateT+=dt;
 eye.copy(e.group.position).y+=(k.role==='lookout'?1.97:1.85)*e.body.scale.y;
 target.copy(ctx.player).y+=.8;
 const distance=eye.distanceTo(target);
 const visible=distance<(k.role==='lookout'?KOOK.vision:KOOK.gunRange)&&Math.abs(target.y-eye.y)<8
  &&!ctx.blocked(eye,target);
 if(e.state==='patrol'){
  if(visible){
   k.exposure+=dt;face(e,target,dt);
   if(k.exposure>=KOOK.notice){k.target.copy(target);transition(e,k.role==='lookout'?'windup':'aim');ctx.cue(e,k.role==='lookout'?'notice':'wake');}
  }else{k.exposure=0;stroll(e,dt);}
  return;
 }
 if(k.role==='lookout'){
  if(e.state==='windup'){
   if(!visible){k.exposure=0;transition(e,'patrol');return;}
   if(e.stateT<KOOK.squawkLock){k.target.copy(target);face(e,k.target,dt);}
   if(e.stateT>=KOOK.windup){transition(e,'shriek');k.alarms++;ctx.cue(e,'screech');}
  }else if(e.state==='shriek'){
   if(e.stateT>=KOOK.squawk)transition(e,'recover');
  }else if(e.stateT>=KOOK.recover){k.exposure=0;transition(e,'patrol');}
  return;
 }
 if(e.state==='aim'){
  if(!visible){k.exposure=0;transition(e,'patrol');return;}
  if(e.stateT<KOOK.lock){k.target.copy(target);face(e,k.target,dt);}
  if(e.stateT>=KOOK.aim){
   if(!ctx.blocked(eye,k.target)){transition(e,'fire');k.shots++;ctx.fire(e,k.target);ctx.cue(e,'shot');}
   else transition(e,'patrol');
  }
 }else if(e.state==='fire'){
  if(e.stateT>=.18)transition(e,'reload');
 }else if(e.state==='reload'&&e.stateT>=KOOK.reload){k.exposure=0;transition(e,'patrol');}
}
