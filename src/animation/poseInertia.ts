import {Quaternion,Vector3} from 'three';
import type {PoseBuffer,QuaternionTuple,Vec3Tuple} from './types';

/** How one part of the body lets go of the pose it was in: `[omega, zeta]`,
 * the rate in rad/s it settles at and its damping ratio. A lower rate arrives
 * later, which is what overlaps the parts; a ratio under 1 swings past the
 * new pose once and settles. */
export type InertiaSpring=[omega:number,zeta:number];
export type InertiaGroup='root'|'legs'|'spine'|'head'|'arms'|'lengths';
/** `carry` is how much of a jump in the body's own travel, per axis (left, up,
 * forward), the pelvis is left behind by: a burst of speed pulls out from
 * under it, and a dead stop lets it run on. */
export type InertiaShape=Record<InertiaGroup,InertiaSpring>&{carry:[number,number,number];
  /** Set where the legs cannot be let go joint by joint: half way between a
   * crouch and a crawl that takes a shin straight down through the floor.
   * The legs then take the new motion at once, and whoever poses the body
   * carries each foot across to it instead, at this rate (`feet`). */
  feet?:InertiaSpring};

const groupOf=(id:string):InertiaGroup=>id==='root'||id==='hips'||id==='torsoRoot'?'root'
  :/^(hip|knee|ankle|toe)/.test(id)?'legs':id==='spine'||id==='chest'?'spine':id==='neck'||id==='head'?'head':'arms';

type Response={offset:(time:number)=>number;coast:(time:number)=>number;end:number};
/** A third-order settle, so that a part starts to move as gently as it
 * stops: `offset` is what is left of a pose difference and `coast` how far a
 * speed difference of 1 has carried. Both leave at rest; neither starts with
 * a jolt. */
function response([omega,zeta]:InertiaSpring):Response {
  if(zeta>=.999)return {end:14/omega,
    offset:t=>Math.exp(-omega*t)*(1+omega*t+omega*omega*t*t/2),
    coast:t=>Math.exp(-omega*t)*(t+omega*t*t)};
  // One real pole and a swinging pair: e^-pt A + e^-at (B cos wt + C sin wt),
  // with the value, speed and acceleration it starts from fixing A, B and C.
  const p=omega,a=zeta*omega,w=omega*Math.sqrt(1-zeta*zeta);
  const solve=(value:number,speed:number)=>{
    // A+B=value; -pA-aB+wC=speed; p²A+(a²-w²)B-2awC=0
    const k=(a*a-w*w)-2*a*a,m=p*p-2*a*p;       // third row after removing C
    const A=(2*a*speed-k*value)/(m-k),B=value-A,C=(speed+p*A+a*B)/w;
    return (t:number)=>Math.exp(-p*t)*A+Math.exp(-a*t)*(B*Math.cos(w*t)+C*Math.sin(w*t));
  };
  return {end:10/Math.min(p,a),offset:solve(1,0),coast:solve(0,1)};
}

type Part={x:number[];v:number[];c:number[];group:InertiaGroup};
const _a=new Quaternion(),_b=new Quaternion(),_v=new Vector3();

/** `a * inverse(b)` as a rotation vector: the turn that takes `b` to `a`. */
function turn(a:QuaternionTuple|undefined,b:QuaternionTuple|undefined):number[] {
  _a.fromArray(a??[0,0,0,1]).normalize();_b.fromArray(b??[0,0,0,1]).normalize().invert();
  _a.multiply(_b);
  if(_a.w<0)_a.set(-_a.x,-_a.y,-_a.z,-_a.w);
  const length=Math.hypot(_a.x,_a.y,_a.z);
  const scale=length>1e-9?2*Math.atan2(length,_a.w)/length:2;
  return [_a.x*scale,_a.y*scale,_a.z*scale];
}

/** The rate a rotation-vector offset must change at for the joint itself to
 * turn at `spin`: the inverse left Jacobian of the rotation. */
function offsetRate(offset:number[],spin:number[]):number[] {
  const angle=Math.hypot(...offset);
  if(angle<1e-4)return [...spin];
  const safe=Math.min(angle,3),k=1/(safe*safe)-(1+Math.cos(safe))/(2*safe*Math.sin(safe));
  const cross=(p:number[],q:number[])=>[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
  const once=cross(offset,spin),twice=cross(offset,once);
  return spin.map((value,i)=>value-.5*once[i]+k*twice[i]);
}

/** Carries a body through a cut from one motion to another. At the cut it
 * measures how far, and how fast, the pose on screen differs from the new
 * motion; afterwards it adds that difference back, let go part by part.
 * Position and speed are continuous through any cut, the new motion plays
 * exactly once the difference has run out, and nothing is added to a motion
 * that was never cut. */
export class PoseInertia {
  private readonly parts=new Map<string,Part>();
  private responses:Record<InertiaGroup,Response>|null=null;
  private feetResponse:Response|null=null;
  private carry:[number,number,number]=[0,0,0];
  /** The new motion's first frame, kept one frame to learn its own speed. */
  private first:PoseBuffer|null=null;
  private firstDt=0;
  private travel:number[]|null=null;
  private time=0;
  private end=0;
  get active():boolean {return this.parts.size>0;}
  /** How much of the pelvis's offset at the last cut is still in play: 1 on
   * the cut, 0 once it has run out, under 0 while it swings past. */
  get rootLeft():number {return this.parts.size&&this.responses?this.responses.root.offset(this.time):0;}
  /** For a cut that carries the feet: how much of each foot's way to the new
   * motion is left, and how far a speed of 1 at the cut has coasted since. */
  get feet():[left:number,coast:number]|null {
    return this.parts.size&&this.feetResponse?[this.feetResponse.offset(this.time),this.feetResponse.coast(this.time)]:null;
  }
  reset():void {this.parts.clear();this.first=null;this.travel=null;this.feetResponse=null;}

  /** `previous` and `before` are the last two poses shown, `before` the
   * older. `travel` is the body's own velocity over the frame now ending and
   * `travelBefore` over the one before it, in the root's frame and units. */
  cut(target:PoseBuffer,previous:PoseBuffer|null,before:PoseBuffer|null,dt:number,shape:InertiaShape,
    travel:number[]|null=null,travelBefore:number[]|null=null):void {
    this.reset();
    if(!previous)return;
    const rate=before&&dt>1e-5?1/dt:0;
    for(const id of new Set([...Object.keys(target.joints),...Object.keys(previous.joints)])){
      const to=target.joints[id]??{},from=previous.joints[id]??{},old=before?.joints[id]??from,group=groupOf(id);
      if(shape.feet&&group==='legs')continue;
      if(to.quaternion||from.quaternion){
        const x=turn(from.quaternion,to.quaternion);
        this.parts.set(`${id}:q`,{x,v:offsetRate(x,turn(from.quaternion,old.quaternion).map(value=>value*rate)),c:[0,0,0],group});
      }
      if(to.position||from.position){
        const a=from.position??[0,0,0],b=to.position??[0,0,0],c=old.position??a;
        this.parts.set(`${id}:p`,{x:a.map((value,i)=>value-b[i]),v:a.map((value,i)=>(value-c[i])*rate),c:[0,0,0],group});
      }
    }
    for(const id of new Set([...Object.keys(target.scalars),...Object.keys(previous.scalars)])){
      if(!id.startsWith('deform.'))continue;
      const a=previous.scalars[id]??1,b=target.scalars[id]??1,c=before?.scalars[id]??a;
      this.parts.set(`${id}:s`,{x:[a-b],v:[(a-c)*rate],c:[0],group:'lengths'});
    }
    this.responses={root:response(shape.root),legs:response(shape.legs),spine:response(shape.spine),head:response(shape.head),
      arms:response(shape.arms),lengths:response(shape.lengths)};
    this.feetResponse=shape.feet?response(shape.feet):null;
    this.end=Math.max(this.feetResponse?.end??0,...Object.values(this.responses).map(r=>r.end));
    this.carry=shape.carry;
    const pelvis=this.parts.get('root:p');
    if(pelvis&&travel&&travelBefore)for(let i=0;i<3;i++)pelvis.v[i]+=this.carry[i]*bounded(travelBefore[i]-travel[i]);
    this.first=target;this.firstDt=dt;this.travel=travel;this.time=0;
  }

  apply(target:PoseBuffer,dt:number,travel:number[]|null=null):PoseBuffer {
    if(!this.parts.size||!this.responses||dt<=0)return target;
    if(this.first&&this.first!==target&&this.firstDt>1e-5){
      // The new motion is already moving. Each offset gives that speed back,
      // so the body keeps the speed it had and the settle absorbs the rest.
      const rate=1/this.firstDt;
      for(const [id,joint] of Object.entries(target.joints)){
        const was=this.first.joints[id];
        if(!was)continue;
        const q=this.parts.get(`${id}:q`),p=this.parts.get(`${id}:p`);
        if(q&&joint.quaternion&&was.quaternion)q.c=offsetRate(q.x,turn(joint.quaternion,was.quaternion).map(value=>value*rate));
        if(p&&joint.position&&was.position)p.c=joint.position.map((value,i)=>(value-was.position![i])*rate);
      }
      for(const [id,value] of Object.entries(target.scalars)){
        const s=this.parts.get(`${id}:s`),was=this.first.scalars[id];
        if(s&&was!==undefined)s.c=[(value-was)*rate];
      }
      // A stop or a burst can take a second frame to show in the travel.
      const pelvis=this.parts.get('root:p');
      if(pelvis&&travel&&this.travel)for(let i=0;i<3;i++)pelvis.c[i]-=this.carry[i]*bounded(this.travel[i]-travel[i]);
      this.first=null;this.firstDt=this.time;
    }
    this.time+=dt;
    if(this.time>this.end){this.reset();return target;}
    const result:PoseBuffer={joints:{...target.joints},scalars:{...target.scalars}};
    const late=this.first?0:Math.max(0,this.time-this.firstDt);
    for(const [key,part] of this.parts){
      const {offset,coast}=this.responses[part.group];
      const g=offset(this.time),h=coast(this.time),k=late>0?coast(late):0;
      const x=part.x.map((value,i)=>value*g+part.v[i]*h-part.c[i]*k);
      const id=key.slice(0,-2),kind=key.slice(-1);
      if(kind==='s'){result.scalars[id]=(target.scalars[id]??1)+x[0];continue;}
      const joint={...result.joints[id]};
      if(kind==='q'){
        const size=Math.hypot(...x);
        _v.fromArray(x);
        _a.setFromAxisAngle(size>1e-9?_v.multiplyScalar(1/size):_v.set(1,0,0),size);
        joint.quaternion=_a.multiply(_b.fromArray(target.joints[id]?.quaternion??[0,0,0,1])).normalize().toArray() as QuaternionTuple;
      }else{
        const base=target.joints[id]?.position??[0,0,0];
        joint.position=base.map((value,i)=>value+x[i]) as Vec3Tuple;
      }
      result.joints[id]=joint;
    }
    return result;
  }
}

/** A layer's weight outside the pose (the resting arm angle, the flat crawl
 * palms) that a cut would otherwise switch in a single frame. What is left of
 * the change is let go at a part's own rate, without swinging past: a weight
 * has ends. */
export class WeightInertia {
  private offset=0;
  private time=0;
  private omega=1;
  reset():void {this.offset=0;}
  /** `shown` is the weight on screen, `target` the one the new motion asks for. */
  cut(shown:number,target:number,[omega]:InertiaSpring):void {this.offset=shown-target;this.time=0;this.omega=omega;}
  apply(target:number,dt:number):number {
    if(!this.offset)return target;
    this.time+=Math.max(0,dt);
    const u=this.omega*this.time;
    if(u>14){this.offset=0;return target;}
    return target+this.offset*Math.exp(-u)*(1+u+u*u/2);
  }
}

/** A teleport is not a burst of speed. */
function bounded(value:number):number {return Math.max(-30,Math.min(30,Number.isFinite(value)?value:0));}
