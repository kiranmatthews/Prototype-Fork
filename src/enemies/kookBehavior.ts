import * as THREE from 'three';
import type {Enemy} from '../level';

export type KookRole='lookout'|'gunner';
export interface KookState {
 role:KookRole;group:number;bearing:number;exposure:number;awake:number;
 target:THREE.Vector3;alarms:number;shots:number;
}
export const KOOK={vision:23,gunRange:36,alarmRange:58,notice:.32,windup:.76,wake:.85,aim:1.18,lock:.82,reload:1.45};
const eye=new THREE.Vector3(),target=new THREE.Vector3();
const transition=(e:Enemy,state:string)=>{e.state=state;e.stateT=0;};
export function createKookState(role:KookRole,group:number,bearing:number):KookState {
 return {role,group,bearing,exposure:0,awake:0,target:new THREE.Vector3(),alarms:0,shots:0};
}
export function resetKook(e:Enemy):void {
 const k=e.kook!;k.exposure=k.awake=k.alarms=k.shots=0;k.target.set(0,0,0);
 transition(e,k.role==='lookout'?'watch':'doze');e.body.rotation.y=k.bearing;
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
 e.body.rotation.y+=delta*Math.min(1,dt*7);
}
/** Lookouts alone raise alarms. Each courtyard has an independent group, so
 * an encounter cannot wake an enemy three roofs away behind the player. */
export function stepKook(e:Enemy,dt:number,ctx:Context):void {
 const k=e.kook!;e.stateT+=dt;k.awake=Math.max(0,k.awake-dt);
 eye.copy(e.group.position).y+=(k.role==='lookout'?1.95:1.85)*e.body.scale.y;
 target.copy(ctx.player).y+=.8;
 const distance=eye.distanceTo(target),dx=target.x-eye.x,dz=target.z-eye.z;
 const forward=(Math.sin(e.body.rotation.y)*dx+Math.cos(e.body.rotation.y)*dz)/Math.max(.001,Math.hypot(dx,dz));
 const visible=distance<(k.role==='lookout'?KOOK.vision:KOOK.gunRange)&&Math.abs(target.y-eye.y)<7
  &&(k.role==='gunner'||forward>Math.cos(Math.PI*.36))&&!ctx.blocked(eye,target);
 if(k.role==='lookout'){
  if(e.state==='watch'){
   k.exposure=Math.max(0,k.exposure+(visible?dt:-dt*2));
   if(k.exposure>=KOOK.notice){transition(e,'windup');ctx.cue(e,'notice');}
  }else if(e.state==='windup'){
   if(visible)face(e,target,dt);
   else {k.exposure=0;transition(e,'watch');return;}
   if(e.stateT>=KOOK.windup){
    transition(e,'shriek');k.alarms++;ctx.cue(e,'screech');
    for(const other of ctx.enemies){
     if(!other.alive||other.kook?.role!=='gunner'||other.kook.group!==k.group||other.group.position.distanceTo(e.group.position)>KOOK.alarmRange)continue;
     other.kook.awake=12;
     if(other.state==='doze'){transition(other,'wake');ctx.cue(other,'wake');}
    }
   }
  }else if(e.state==='shriek'){
   face(e,target,dt);if(e.stateT>=1.35)transition(e,'recover');
  }else if(e.stateT>=3.1){k.exposure=0;transition(e,'watch');}
  return;
 }
 if(e.state==='doze')return;
 if(k.awake===0&&e.state!=='fire'){transition(e,'doze');return;}
 if(e.state==='wake'){
  face(e,target,dt);if(e.stateT>=KOOK.wake)transition(e,'track');
 }else if(e.state==='track'){
  if(visible){face(e,target,dt);k.target.copy(target);transition(e,'aim');}
 }else if(e.state==='aim'){
  if(!visible){transition(e,'track');return;}
  if(e.stateT<KOOK.lock){k.target.copy(target);face(e,target,dt);}
  if(e.stateT>=KOOK.aim){
   if(!ctx.blocked(eye,k.target)){transition(e,'fire');k.shots++;ctx.fire(e,k.target);ctx.cue(e,'shot');}
   else transition(e,'track');
  }
 }else if(e.state==='fire'){
  if(e.stateT>=.18)transition(e,'reload');
 }else if(e.state==='reload'&&e.stateT>=KOOK.reload)transition(e,'track');
}
