import * as THREE from 'three';
import {sampleEnemyElasticity,enemyElasticPulse,type EnemyElasticityProfile} from './elasticity';
import type {EnemyAnimationFrame,EnemyKind} from './types';
import type {KookRole} from './kookBehavior';
import {KOOK} from './kookBehavior';

export const KOOK_ELASTICITY:EnemyElasticityProfile={idle:1.1,walk:1.7,anticipation:2.8,rebound:2.4,landing:1.6,defeat:1.8};
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t);};
/** Local anatomical controls, separate childless surface bones, and exact
 * endpoint IK. No animation scales the actor or the complete skeleton. */
export class KookArticulation {
 readonly bones=new Map<string,THREE.Bone>();
 readonly rest=new Map<string,{p:THREE.Vector3;q:THREE.Quaternion}>();
 phase=0;footErrors:number[]=[];handErrors:number[]=[];torsoRatio=1;neckRatio=1;
 planted={hindLeft:true,hindRight:true};private movement=0;private defeatTime=0;
 private contacts=new Map<string,{world:THREE.Vector3;wasPlanted:boolean;swingStart:THREE.Vector3}>();
 constructor(readonly model:THREE.Group,readonly role:KookRole,readonly height:number){
  model.traverse(n=>{if((n as THREE.Bone).isBone){this.bones.set(n.name,n as THREE.Bone);this.rest.set(n.name,{p:n.position.clone(),q:n.quaternion.clone()});}});
 }
 private bone(name:string):THREE.Bone{return this.bones.get(name)!;}
 private length(name:string,end:string,ratio:number):void {
  this.bone(end).position.copy(this.rest.get(end)!.p).multiplyScalar(ratio);
  this.bone(name+'-surface').scale.set(1/Math.sqrt(ratio),ratio,1/Math.sqrt(ratio));
 }
 private orient(node:THREE.Bone,restAxis:THREE.Vector3,worldTarget:THREE.Vector3):void {
  node.updateWorldMatrix(true,false);
  const origin=node.getWorldPosition(new THREE.Vector3());
  const direction=worldTarget.clone().sub(origin).normalize().applyQuaternion(node.parent!.getWorldQuaternion(new THREE.Quaternion()).invert());
  node.quaternion.setFromUnitVectors(restAxis.clone().normalize(),direction);
  node.updateWorldMatrix(false,true);
 }
 solve(aName:string,bName:string,cName:string,worldTarget:THREE.Vector3,pole:THREE.Vector3,preserveContact=false):number {
  const a=this.bone(aName),b=this.bone(bName),c=this.bone(cName);a.updateWorldMatrix(true,true);
  const origin=a.getWorldPosition(new THREE.Vector3()),middle=b.getWorldPosition(new THREE.Vector3()),tip=c.getWorldPosition(new THREE.Vector3());
  let l1=origin.distanceTo(middle),l2=middle.distanceTo(tip);const axis=worldTarget.clone().sub(origin);
  // Elastic compression must never pull a planted sole off its contact.
  // Correct only these two shafts and their endpoint offsets, not the skeleton.
  if(preserveContact&&axis.length()>l1+l2-.002){
   const ratio=(axis.length()+.002)/(l1+l2);
   this.length(aName,bName,b.position.length()/this.rest.get(bName)!.p.length()*ratio);
   this.length(bName,cName,c.position.length()/this.rest.get(cName)!.p.length()*ratio);
   l1*=ratio;l2*=ratio;a.updateWorldMatrix(true,true);
  }
  const distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+1e-5,l1+l2-1e-5);axis.normalize();
  const bend=pole.clone().sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),h=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbow=origin.clone().addScaledVector(axis,along).addScaledVector(bend,h);
  this.orient(a,b.position,elbow);this.orient(b,c.position,worldTarget);
  return c.getWorldPosition(new THREE.Vector3()).distanceTo(worldTarget);
 }
 pose(dt:number,frame:EnemyAnimationFrame,kind:EnemyKind,worldScale:number):void {
  for(const [name,b]of this.bones){const rest=this.rest.get(name)!;b.position.copy(rest.p);b.quaternion.copy(rest.q);b.scale.setScalar(1);}
  const moving=frame.speed>.03&&frame.alive;
  this.movement=THREE.MathUtils.damp(this.movement,moving?1:0,12,dt);
  this.phase=(this.phase+dt*frame.speed/Math.max(.001,worldScale)/(this.role==='lookout'?.52:.48))%1;
  this.defeatTime=frame.alive?0:this.defeatTime+dt;
  const elastic=sampleEnemyElasticity(kind,frame,this.phase,{},this.defeatTime,KOOK_ELASTICITY);
  const inhale=frame.state==='windup'?smooth(frame.stateTime/KOOK.windup):0;
  const release=frame.state==='shriek'?Math.sin(Math.PI*Math.min(1,frame.stateTime/.24))*Math.exp(-frame.stateTime*2):0;
  const settle=frame.state==='recover'?enemyElasticPulse(frame.stateTime,.75):0;
  this.torsoRatio=THREE.MathUtils.clamp(elastic.torso-inhale*.14+release*.18+settle*.09,.78,1.26);
  this.neckRatio=1-inhale*.20+release*.26+settle*.13;
  this.length('spine','chest',this.torsoRatio);this.length('chest','neck',1+(this.torsoRatio-1)*.5);this.length('neck','head',this.neckRatio);
  const cycle=this.phase*Math.PI*2,sway=Math.sin(cycle)*this.movement;
  this.bone('hips').position.y+=(-.045+Math.cos(cycle*2)*.014)*this.movement;
  this.bone('hips').rotation.z=sway*(this.role==='lookout'?.045:.065);
  this.bone('chest').rotation.y=-sway*.07;this.bone('chest').rotation.x=inhale*-.16+release*.17;
  this.bone('head').rotation.x=inhale*-.23+release*.22+Math.sin(frame.time*2.3)*.018;
  this.bone('head').rotation.z=-sway*.055+settle*.06;
  // The Meshy pig's lower lip/chin closes during anticipation and trembles
  // during the recorded squeal; the snout and upper face stay on the head.
  if(this.role==='lookout')this.bone('jaw').rotation.x=frame.state==='shriek'?.16+Math.sin(frame.stateTime*48)*.045:-.30-inhale*.05;
  for(const [side,sign]of [['left',1],['right',-1]] as const){
   const leg=side==='left'?elastic.legs.hindLeft:elastic.legs.hindRight;
   this.length('hip-'+side,'knee-'+side,leg.upper);this.length('knee-'+side,'ankle-'+side,leg.lower);
   this.length('shoulder-'+side,'elbow-'+side,this.role==='gunner'?1.28:1+inhale*.04+release*.1);
   this.length('elbow-'+side,'wrist-'+side,this.role==='gunner'?1.28:1+release*.12);
   if(this.role==='lookout'){
    this.bone('shoulder-'+side).rotation.set(Math.sin(cycle+(sign<0?Math.PI:0))*.30*this.movement-inhale*.36+release*.4,0,-sign*(.55-inhale*.2-release*.35));
    this.bone('elbow-'+side).rotation.y=sign*(.12+inhale*.45);this.bone('wrist-'+side).rotation.z=sign*(inhale*.25-release*.2);
   }
  }
  this.model.updateWorldMatrix(true,true);this.footErrors=[];
  const modelQuaternion=this.model.getWorldQuaternion(new THREE.Quaternion());
  for(const [side,offset]of [['left',0],['right',.5]] as const){
   const ankle=this.bone('ankle-'+side),restPosition=this.originalWorldInModel('ankle-'+side);
   const localPhase=(this.phase+offset)%1,stance=!moving||localPhase<.6;
   const nominal=this.model.localToWorld(restPosition.clone());
   let c=this.contacts.get(side);if(!c){c={world:nominal.clone(),wasPlanted:stance,swingStart:nominal.clone()};this.contacts.set(side,c);}
   const front=this.model.localToWorld(restPosition.clone().add(new THREE.Vector3(0,0,.145)));
   if(!moving){c.world.lerp(nominal,dt>0?1-Math.exp(-dt*18):1);}
   else if(stance){if(!c.wasPlanted)c.world.copy(front);c.world.y=nominal.y;
    if(frame.inPlace)c.world.copy(this.model.localToWorld(restPosition.clone().add(new THREE.Vector3(0,0,.145-.29*localPhase/.6))));}
   else{if(c.wasPlanted)c.swingStart.copy(c.world);const u=(localPhase-.6)/.4;
    if(frame.inPlace)c.swingStart.copy(this.model.localToWorld(restPosition.clone().add(new THREE.Vector3(0,0,-.145))));
    c.world.lerpVectors(c.swingStart,front,smooth(u));c.world.y=nominal.y+Math.sin(u*Math.PI)*.085*worldScale;}
   c.wasPlanted=stance;
   const pole=this.model.localToWorld(restPosition.clone().setY(.35).add(new THREE.Vector3(0,0,1)));
   this.footErrors.push(this.solve('hip-'+side,'knee-'+side,'ankle-'+side,c.world,pole,true));
   ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(modelQuaternion));
   this.planted[side==='left'?'hindLeft':'hindRight']=stance;
  }
  this.model.updateWorldMatrix(true,true);
 }
 originalWorldInModel(name:string):THREE.Vector3 {
  const out=new THREE.Vector3();let node:THREE.Object3D|null=this.bone(name);
  while(node&&node!==this.model){const r=this.rest.get(node.name);if(r)out.add(r.p);node=node.parent;}return out;
 }
 grip(side:'left'|'right',target:THREE.Vector3,orientation:THREE.Quaternion):number {
  const pole=this.model.localToWorld(new THREE.Vector3(side==='left'?1.5:-1.5,.8,.1));
  const error=this.solve('shoulder-'+side,'elbow-'+side,'wrist-'+side,target,pole,true),hand=this.bone('wrist-'+side);
  hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));return error;
 }
 mouth(target:THREE.Vector3):void {
  const head=this.bone('head');target.set(0,this.role==='lookout'?.113:.10,this.role==='lookout'?.341:.46);head.localToWorld(target);
 }
 reset():void {this.phase=this.movement=this.defeatTime=0;this.contacts.clear();}
}
