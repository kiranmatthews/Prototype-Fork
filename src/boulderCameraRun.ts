import * as THREE from 'three';

/** The same fatal sphere finishes its run into a fixed lens. No gameplay
 * contacts are produced during this short, death-only presentation. */
export class BoulderCameraRun {
 readonly curve:THREE.QuadraticBezierCurve3;
 readonly duration:number;
 readonly cameraPosition:THREE.Vector3;
 readonly cameraDirection:THREE.Vector3;
 readonly contact:THREE.Vector3;
 readonly radius:number;
 elapsed=0;
 hit=false;
 private readonly previous=new THREE.Vector3();
 private readonly delta=new THREE.Vector3();
 private readonly axis=new THREE.Vector3();
 constructor(readonly actorIndex:number,from:THREE.Vector3,forward:THREE.Vector3,
  eye:THREE.Vector3,view:THREE.Vector3,radius:number,speed:number){
  this.radius=radius;this.cameraPosition=eye.clone();this.cameraDirection=view.clone().normalize();
  this.contact=eye.clone().addScaledVector(this.cameraDirection,radius+.2);
  const span=from.distanceTo(this.contact),control=from.clone().addScaledVector(forward,span*.48);
  control.y=THREE.MathUtils.lerp(from.y,this.contact.y,.45);
  this.curve=new THREE.QuadraticBezierCurve3(from.clone(),control,this.contact.clone());this.curve.arcLengthDivisions=64;
  this.duration=THREE.MathUtils.clamp(this.curve.getLength()/Math.max(12,speed),.65,.95);
 }
 get hitAge():number {return Math.max(0,this.elapsed-this.duration);}
 get watchSeconds():number {return this.duration+2.55;}
 update(dt:number,mesh:THREE.Object3D):void {
  if(dt<=0)return;this.previous.copy(mesh.position);this.elapsed+=dt;
  if(this.elapsed<this.duration)this.curve.getPointAt(this.elapsed/this.duration,mesh.position);
  else{
   this.hit=true;
   // A little heavy recoil reveals the world through the cracked glass.
   mesh.position.copy(this.contact).addScaledVector(this.cameraDirection,2.6*(1-Math.exp(-this.hitAge*7)));
  }
  this.delta.copy(mesh.position).sub(this.previous);const distance=this.delta.length();
  this.axis.set(this.delta.z,0,-this.delta.x);
  if(this.axis.lengthSq()>1e-10)mesh.rotateOnWorldAxis(this.axis.normalize(),distance/this.radius);
 }
}
