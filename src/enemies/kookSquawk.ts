import * as THREE from 'three';
import type {Enemy} from '../level';
import {KOOK} from './kookBehavior';

const Z=new THREE.Vector3(0,0,1),center=new THREE.Vector3(),onAxis=new THREE.Vector3(),contact=new THREE.Vector3();
/** Sound has a finite, locked cone, not a room-sized damage AABB. */
export class KookSquawk extends THREE.Group {
 readonly origin=new THREE.Vector3();readonly direction=new THREE.Vector3(0,0,1);
 active=false;length=0;private age=0;
 private material=new THREE.MeshBasicMaterial({color:0xffdb9b,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
 private shell=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,48,1,true).rotateX(Math.PI/2).translate(0,0,.5),this.material);
 private shellSource=Float32Array.from(this.shell.geometry.attributes.position.array);
 private rings:THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial>[]=[];
 constructor(){
  super();this.name='Goose squawk · locked sound cone';this.add(this.shell);this.visible=false;
  const geometry=new THREE.TorusGeometry(1,.045,8,48);
  for(let i=0;i<9;i++){const m=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:i%2?0xffb6ea:0xfff1b3,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));this.rings.push(m);this.add(m);}
 }
 pose(origin:THREE.Vector3,target:THREE.Vector3,state:string,time:number,alive:boolean):void {
  this.origin.copy(origin);this.direction.copy(target).sub(origin).normalize();this.age=time;
  this.active=alive&&state==='shriek'&&time>=.045&&time<KOOK.squawk;
  this.visible=alive&&(state==='windup'||this.active);
  this.length=this.active?KOOK.squawkRange*Math.min(1,Math.max(0,(time-.025)/.18)):0;
  if(!this.visible)return;
  this.position.copy(origin);this.parent?.worldToLocal(this.position);
  this.quaternion.setFromUnitVectors(Z,this.direction);
  if(this.parent)this.quaternion.premultiply(this.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  this.refresh();
 }
 /** Keep the rendered beam and collision clipped by the same roof/cover. */
 clip(blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean):void {
  if(!this.active)return;
  if(blocked(this.origin,onAxis.copy(this.origin).addScaledVector(this.direction,this.length))){
   let lo=0,hi=this.length;
   for(let i=0;i<8;i++){const mid=(lo+hi)/2;if(blocked(this.origin,onAxis.copy(this.origin).addScaledVector(this.direction,mid)))hi=mid;else lo=mid;}
   this.length=lo;
  }
  this.refresh();
 }
 private refresh():void {
  this.shell.visible=this.active;
  const position=this.shell.geometry.attributes.position;
  for(let i=0;i<position.count;i++){
   const z=this.shellSource[i*3+2]*this.length,radius=.25+z/KOOK.squawkRange*KOOK.squawkRadius;
   position.setXYZ(i,this.shellSource[i*3]*radius,this.shellSource[i*3+1]*radius,z);
  }
  position.needsUpdate=true;this.shell.geometry.computeBoundingSphere();
  const fade=this.active?Math.min(1,(KOOK.squawk-this.age)/.13):1;
  this.material.opacity=.13*fade;
  for(let i=0;i<this.rings.length;i++){
   const ring=this.rings[i];ring.visible=this.active||i===0;
   const u=this.active?(i/this.rings.length+this.age*1.8)%1:0;
   const distance=u*this.length,radius=this.active?.25+distance/KOOK.squawkRange*KOOK.squawkRadius:.12+.04*Math.sin(this.age*18)**2;
   ring.position.z=distance;ring.scale.setScalar(radius);ring.material.opacity=(this.active?.85*(1-u*.45)*fade:.7);
  }
 }
 intersects(box:THREE.Box3):boolean {
  if(!this.active||!this.visible||this.length<=0)return false;
  box.getCenter(center);const t=center.sub(this.origin).dot(this.direction);
  // Test the nearest point on the actual body box against the cone section.
  const d=THREE.MathUtils.clamp(t,0,this.length);
  onAxis.copy(this.origin).addScaledVector(this.direction,d);box.clampPoint(onAxis,contact);
  const along=contact.clone().sub(this.origin).dot(this.direction);
  return along>=0&&along<=this.length&&contact.distanceTo(onAxis)<=.25+d/KOOK.squawkRange*KOOK.squawkRadius;
 }
 dispose():void {this.removeFromParent();this.shell.geometry.dispose();this.material.dispose();this.rings[0].geometry.dispose();for(const ring of this.rings)ring.material.dispose();}
}
export function kookSquawkHits(e:Enemy,box:THREE.Box3,blocked:(a:THREE.Vector3,b:THREE.Vector3)=>boolean):boolean {
 const beam=e.group.userData.kookSquawk as KookSquawk|undefined;
 return !!(e.alive&&e.state==='shriek'&&beam?.intersects(box)&&!blocked(beam.origin,box.getCenter(center)));
}
