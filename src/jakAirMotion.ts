import {Quaternion,Vector3} from 'three';
import type {PoseBuffer,Vec3Tuple,QuaternionTuple} from './animation';

/** D's airborne follow-through. Each joint/segment follows its authored target;
 * collision, the whole-rider scale and planted contacts never enter the spring. */
export class JakAirPoseSpring {
  private pose:PoseBuffer|null=null;
  private readonly velocity=new Map<string,number[]>();
  reset():void {this.pose=null;this.velocity.clear();}

  private step(id:string,error:number[],dt:number,omega:number):number[] {
    const velocity=this.velocity.get(id)??error.map(()=>0),decay=Math.exp(-omega*dt);
    const next=error.map((value,i)=>{
      const c=velocity[i]+omega*value;
      velocity[i]=(velocity[i]-omega*c*dt)*decay;
      return (value+c*dt)*decay;
    });
    this.velocity.set(id,velocity);return next;
  }

  sample(target:PoseBuffer,dt:number,seed:PoseBuffer|null):PoseBuffer {
    const previous=this.pose??seed??target;
    if(dt<=0)return this.pose??target;
    const result:PoseBuffer={joints:{},scalars:{...target.scalars}};
    for(const [id,joint] of Object.entries(target.joints)) {
      const old=previous.joints[id]??joint,next={...joint};
      const omega=id==='hips'?80:/shoulder|elbow|wrist|hip|knee|ankle/.test(id)?45:70;
      if(joint.quaternion&&old.quaternion) {
        const to=new Quaternion().fromArray(joint.quaternion).normalize();
        const error=new Quaternion().fromArray(old.quaternion).multiply(to.clone().invert()).normalize();
        if(error.w<0)error.set(-error.x,-error.y,-error.z,-error.w);
        const axis=new Vector3(error.x,error.y,error.z),length=axis.length();
        axis.multiplyScalar(length>1e-8?2*Math.atan2(length,error.w)/length:2);
        const residual=new Vector3().fromArray(this.step(id,axis.toArray(),dt,omega));
        const angle=residual.length();
        const offset=angle>1e-8?new Quaternion().setFromAxisAngle(residual.multiplyScalar(1/angle),angle):new Quaternion();
        next.quaternion=offset.multiply(to).normalize().toArray() as QuaternionTuple;
      }
      if(joint.position&&old.position) {
        const error=joint.position.map((v,i)=>old.position![i]-v);
        const residual=this.step(`${id}:p`,error,dt,80);
        next.position=joint.position.map((v,i)=>v+residual[i]) as Vec3Tuple;
      }
      result.joints[id]=next;
    }
    for(const [id,value] of Object.entries(target.scalars))if(id.startsWith('deform.')&&id.endsWith('.length')) {
      const error=(previous.scalars[id]??value)-value;
      const omega=id.includes('lower')?55:75;
      result.scalars[id]=value+this.step(id,[error],dt,omega)[0];
    }
    this.pose=result;return result;
  }
}
