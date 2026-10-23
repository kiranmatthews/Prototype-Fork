import * as THREE from 'three';
import type { ReferenceRailFrame, NativePoint } from './referenceRailCapture';
import { nativeSquareRoot } from './referenceRailCapture';

export interface SourceBoxData {
  id: number;
  /** Native SModel box: maxX,minX,maxY,minY,maxZ,minZ, before object yaw. */
  bounds: [number, number, number, number, number, number];
  angles: NativePoint;
}
export function validSourceBox(value: unknown): value is SourceBoxData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const d=value as SourceBoxData;
  return Object.keys(d).every(k=>['id','bounds','angles'].includes(k)) &&
    Number.isSafeInteger(d.id) && d.id>0 && d.id<1e6 &&
    Array.isArray(d.bounds) && d.bounds.length===6 && d.bounds.every(n=>Number.isInteger(n)&&Math.abs(n)<=32767) &&
    [0,2,4].every(i=>d.bounds[i]>d.bounds[i+1]) &&
    Array.isArray(d.angles) && d.angles.length===3 && d.angles.every(n=>Number.isInteger(n)&&n>=0&&n<4096);
}
type Member={mesh:THREE.Mesh;position:THREE.Vector3;rotation:THREE.Quaternion;visible:boolean};
export type SourceBoxBody={
  data:SourceBoxData; frame:ReferenceRailFrame; members:Member[]; origin:THREE.Vector3;
  bounds:THREE.Box3; hit:boolean; hidden:boolean; bounces:number; deathTimer:number;
  position:NativePoint; velocity:NativePoint; angles:NativePoint; target:NativePoint; seed:number;
  previous:THREE.Vector3; current:THREE.Vector3; previousRotation:THREE.Quaternion; currentRotation:THREE.Quaternion;
  transform:THREE.Matrix4; inverse:THREE.Matrix4;
};
const killSmall=(n:number)=>Math.abs(n)<=0x800?0:n;
export const sourceBoxFlight=(v:NativePoint):NativePoint=>v.map((n,i)=>{
  const accelerated=(n+(i===1?0x8000:0))|0;
  return killSmall(accelerated-(accelerated>>6));
}) as NativePoint;
export const sourceBoxImpulse=(v:NativePoint):NativePoint=>[v[0]+(v[0]>>1),-0x50000,v[2]+(v[2]>>1)];

/** Original nonblocking wooden boxes. Geometry/materials remain level-owned.
 * Source impulses, drag, gravity and bounce count run at 30 Hz; presentation
 * interpolates at the renderer rate. Static contacts use the fork's mesh query. */
export class SourceBouncyProps {
  readonly objects:SourceBoxBody[]=[];
  onHit:(()=>void)|null=null;
  private seconds=0;
  private readonly ray=new THREE.Raycaster();
  private readonly normalMatrix=new THREE.Matrix3();
  private readonly movement=new THREE.Vector3();

  add(mesh:THREE.Mesh,data:SourceBoxData,frame:ReferenceRailFrame):void {
    let body=this.objects.find(b=>b.data.id===data.id);
    if(!body){
      const transform=new THREE.Matrix4().set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1);
      frame.axes.forEach((axis,i)=>{transform.elements[i*4+Math.abs(axis)-1]=Math.sign(axis);});
      body={data,frame,members:[],origin:mesh.position.clone(),bounds:new THREE.Box3(),hit:false,hidden:false,bounces:0,deathTimer:0,
        position:[0,0,0],velocity:[0,0,0],angles:[...data.angles],target:[...data.angles],seed:data.id,
        previous:mesh.position.clone(),current:mesh.position.clone(),previousRotation:mesh.quaternion.clone(),currentRotation:mesh.quaternion.clone(),
        transform,inverse:transform.clone().invert()};
      const low=[data.bounds[1],data.bounds[3],data.bounds[5]] as NativePoint,high=[data.bounds[0],data.bounds[2],data.bounds[4]] as NativePoint;
      body.bounds.setFromPoints([this.world(body,low,1),this.world(body,high,1)]);
      this.objects.push(body);
    }
    body.members.push({mesh,position:mesh.position.clone(),rotation:mesh.quaternion.clone(),visible:mesh.visible});
  }

  /** Source Platform_HandleBounce uses an axis-aligned swept origin box,
   * padded by twenty native units. It deliberately does not rotate model bounds. */
  touch(from:THREE.Vector3,to:THREE.Vector3,velocity:THREE.Vector3):void {
    for(const body of this.objects){
      if(body.hit)continue;
      const radius=20*body.frame.unit;
      if(['x','y','z'].some(axis=>{
        const k=axis as 'x'|'y'|'z';
        return Math.max(from[k],to[k])+radius<body.bounds.min[k] || Math.min(from[k],to[k])-radius>body.bounds.max[k];
      }))continue;
      body.hit=true;
      body.velocity=sourceBoxImpulse(this.native(body,velocity,4096/(30*body.frame.unit)));
      const yaw=this.random(body,4096);
      body.target=[body.angles[0]-1024+(this.random(body,2)<<11),yaw,body.angles[2]-1024+(this.random(body,2)<<11)];
      if(Math.abs(body.target[0])===2048&&body.target[2]===0)body.target[2]=body.angles[2];
      if(body.target[0]===0&&Math.abs(body.target[2])===2048)body.target[0]=body.angles[0];
      this.onHit?.();
    }
  }

  private random(body:SourceBoxBody,n:number):number {
    body.seed=(Math.imul(body.seed,1664525)+1013904223)>>>0;
    return Math.floor(body.seed/4294967296*n);
  }
  private native(body:SourceBoxBody,v:THREE.Vector3,scale:number):NativePoint {
    const a=[v.x,v.y,v.z];return body.frame.axes.map(axis=>Math.round(a[Math.abs(axis)-1]*Math.sign(axis)*scale)) as NativePoint;
  }
  private world(body:SourceBoxBody,p:NativePoint,denominator=4096):THREE.Vector3 {
    const a=[0,0,0];body.frame.axes.forEach((axis,i)=>{a[Math.abs(axis)-1]=p[i]*Math.sign(axis)*body.frame.unit/denominator;});
    return new THREE.Vector3(...a).add(body.origin);
  }
  private rotation(body:SourceBoxBody):THREE.Matrix4 {
    const a=body.angles.map(n=>n*Math.PI*2/4096);
    return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(a[0],a[1],a[2],'YXZ'));
  }
  private cast(from:THREE.Vector3,to:THREE.Vector3,meshes:THREE.Mesh[]):{point:THREE.Vector3;normal:THREE.Vector3}|null {
    this.movement.subVectors(to,from);const length=this.movement.length();if(length<1e-8)return null;
    this.ray.set(from,this.movement.multiplyScalar(1/length));this.ray.near=0;this.ray.far=length;
    const hit=this.ray.intersectObjects(meshes,false)[0];if(!hit?.face)return null;
    const normal=hit.face.normal.clone().applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
    if(normal.dot(this.movement)>0)normal.negate();return {point:hit.point,normal};
  }

  private tick(body:SourceBoxBody,meshes:THREE.Mesh[],killY:number):void {
    if(body.hidden||!body.hit)return;
    if(body.deathTimer){if(!--body.deathTimer)body.hidden=true;return;}
    body.previous.copy(body.current);body.previousRotation.copy(body.currentRotation);
    body.target=body.target.map(n=>n&4095) as NativePoint;
    body.angles=body.angles.map((n,i)=>{
      const difference=body.target[i]-n;let speed=difference>>5;
      if(Math.abs(speed)<=1)speed=0;
      if(Math.abs(speed)<40&&Math.abs(difference)>40)speed=speed<0?-40:40;
      return (n+speed)&4095;
    }) as NativePoint;
    const rotation=this.rotation(body),e=rotation.elements,b=body.data.bounds;
    const extent=Math.floor(((b[0]-b[1])*Math.abs(e[1])+(b[2]-b[3])*Math.abs(e[5])+(b[4]-b[5])*Math.abs(e[9]))*4096/2);
    let velocity=sourceBoxFlight(body.velocity),next=body.position.map((n,i)=>n+velocity[i]) as NativePoint;
    const speed=nativeSquareRoot((velocity[0]>>12)**2+(velocity[2]>>12)**2);
    const from=this.world(body,body.position);
    for(let check=0;check<3;check++){
      const to=this.world(body,next);let hit=this.cast(from,to,meshes);
      if(!hit&&velocity[1]>0){
        const upper=[...next] as NativePoint,lower=[...next] as NativePoint;upper[1]-=extent;lower[1]+=extent;
        hit=this.cast(this.world(body,upper),this.world(body,lower),meshes);
      }
      if(!hit){body.position=next;body.velocity=velocity;break;}
      body.bounces++;
      const normal=this.native(body,hit.normal,4096),dot=Math.floor(velocity.reduce((n,v,i)=>n+v*normal[i],0)/4096);
      velocity=velocity.map((v,i)=>v-2*Math.floor(normal[i]*dot/4096)) as NativePoint;
      const small=Math.abs(velocity[1])<0xc000;
      velocity=velocity.map((v,i)=>killSmall(v-(v>>(small?i===1?0:2:i===1?2:3)))) as NativePoint;
      if(!small){
        body.target[1]=this.random(body,4096);
        if(body.bounces===1){
          body.target[0]+=(this.random(body,2)<<11)-1024;body.target[2]+=(this.random(body,3)-1)<<10;
          if(speed<18){body.target[1]=body.angles[1]+this.random(body,1024)-512;body.target[0]=(body.angles[0]+512)&0xc00;body.target[2]=(body.angles[2]+512)&0xc00;}
        }
      }
      if(body.bounces>=19){body.velocity=[0,0,0];body.angles[0]=body.target[0];body.angles[2]=body.target[2];body.deathTimer=10;break;}
      const at=this.native(body,hit.point.clone().sub(body.origin),4096/body.frame.unit);
      next=at.map((n,i)=>n+Math.floor(normal[i]*extent/4096)) as NativePoint;
    }
    body.current.copy(this.world(body,body.position));
    body.currentRotation.setFromRotationMatrix(body.transform.clone().multiply(this.rotation(body)).multiply(body.inverse));
    // Retire lost scenery below the level's kill plane; never affect the skater.
    if(body.current.y<killY-20)body.hidden=true;
  }

  update(dt:number,meshes:THREE.Mesh[],killY:number):void {
    if(!this.objects.some(b=>b.hit&&!b.hidden))return;
    this.seconds+=Math.max(0,Math.min(.1,dt));
    while(this.seconds+1e-10>=1/30){this.seconds-=1/30;for(const body of this.objects)this.tick(body,meshes,killY);}
    const alpha=Math.max(0,this.seconds*30);
    for(const body of this.objects)if(body.hit)for(const member of body.members){
      member.mesh.visible=member.visible&&!body.hidden;
      member.mesh.position.copy(body.previous).lerp(body.current,alpha);
      member.mesh.quaternion.copy(body.previousRotation).slerp(body.currentRotation,alpha);
      member.mesh.updateMatrixWorld();
    }
  }
  reset(hard:boolean):void {
    this.seconds=0;
    for(const body of this.objects){
      if(!hard&&body.hit){body.hidden=true;for(const member of body.members)member.mesh.visible=false;continue;}
      if(!hard)continue;
      body.hit=body.hidden=false;body.bounces=body.deathTimer=0;body.seed=body.data.id;
      body.position=[0,0,0];body.velocity=[0,0,0];body.angles=[...body.data.angles];body.target=[...body.data.angles];
      body.current.copy(body.origin);body.previous.copy(body.origin);
      for(const member of body.members){member.mesh.position.copy(member.position);member.mesh.quaternion.copy(member.rotation);member.mesh.visible=member.visible;member.mesh.updateMatrixWorld();}
      body.currentRotation.copy(body.members[0].rotation);body.previousRotation.copy(body.currentRotation);
    }
  }
  dispose():void {this.objects.length=0;this.seconds=0;}
}
