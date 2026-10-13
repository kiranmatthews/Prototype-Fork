import * as THREE from 'three';
import type {Stone} from './level';

export interface BoulderChaseData {
  /** Ordered floor positions, including the run-up behind the spawn. */
  path:[number,number,number][];
  radius:number;
  speed:number;
  headStart:number;
}

export function validBoulderChase(value:unknown):value is BoulderChaseData {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const d=value as BoulderChaseData;
  if(Object.keys(d).some(k=>!['path','radius','speed','headStart'].includes(k)))return false;
  if(!Array.isArray(d.path)||d.path.length<2||d.path.length>1024||d.path.some(p=>
    !Array.isArray(p)||p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>10000)))return false;
  if(![d.radius,d.speed,d.headStart].every(Number.isFinite)||d.radius<1||d.radius>12||
    d.speed<2||d.speed>35||d.headStart<d.radius*2+4||d.headStart>100)return false;
  let length=0;
  for(let i=1;i<d.path.length;i++){
    const a=d.path[i-1],b=d.path[i],span=Math.hypot(b[0]-a[0],b[2]-a[2]);
    if(span<.01)return false;length+=span;
  }
  return length>2*d.headStart&&length<10000;
}

/** A bounded pursuit along the authored creek, with continuous physical travel.
 * Speed changes are acceleration-limited; waiting still gets the player caught.
 * Respawns give a new head start and movement-triggered release at that checkpoint. */
export class BoulderChase {
  readonly points:THREE.Vector3[];
  readonly lengths=[0];
  readonly length:number;
  progress=0;
  playerProgress=0;
  active=false;
  falling=false;
  finished=false;
  speed=0;
  private trigger=0;
  private release=0;
  private fallV=0;
  private readonly point=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly axis=new THREE.Vector3();
  private readonly turn=new THREE.Quaternion();
  private readonly boxSize=new THREE.Vector3();

  constructor(readonly data:BoulderChaseData,readonly stone:Stone,spawn:THREE.Vector3){
    this.points=data.path.map(p=>new THREE.Vector3(...p));
    for(let i=1;i<this.points.length;i++)this.lengths.push(this.lengths[i-1]+
      Math.hypot(this.points[i].x-this.points[i-1].x,this.points[i].z-this.points[i-1].z));
    this.length=this.lengths[this.lengths.length-1];
    stone.chase=true;this.reset(spawn);
  }

  project(p:{x:number;z:number}):number {
    let best=Infinity,progress=0;
    for(let i=1;i<this.points.length;i++){
      const a=this.points[i-1],b=this.points[i],dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
      const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/l,i===1?-100:0,i===this.points.length-1?100:1);
      const d=(p.x-a.x-dx*t)**2+(p.z-a.z-dz*t)**2;
      if(d<best){best=d;progress=this.lengths[i-1]+Math.sqrt(l)*t;}
    }
    return progress;
  }

  sample(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    let lo=0,hi=this.points.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(this.lengths[mid]>s)hi=mid;else lo=mid;}
    const t=(s-this.lengths[lo])/(this.lengths[hi]-this.lengths[lo]);
    return out.copy(this.points[lo]).lerp(this.points[hi],t);
  }

  tangent(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    this.sample(s-2,this.point);this.sample(s+2,out);return out.sub(this.point).setY(0).normalize();
  }

  reset(spawn:THREE.Vector3):void {
    this.playerProgress=this.project(spawn);this.progress=Math.max(0,this.playerProgress-this.data.headStart);
    this.trigger=this.playerProgress+5;this.release=.65;this.speed=0;
    this.active=this.falling=this.finished=false;this.fallV=0;
    this.sample(this.progress,this.stone.mesh.position).y+=this.data.radius*.94;
    this.stone.mesh.quaternion.identity();this.stone.mesh.visible=true;this.stone.box.makeEmpty();
  }

  update(dt:number,player:{x:number;y:number;z:number}):boolean {
    this.playerProgress=this.project(player);
    if(this.finished)return false;
    if(this.falling){
      this.fallV+=24*dt;this.stone.mesh.position.y-=this.fallV*dt;
      this.stone.mesh.position.addScaledVector(this.direction,this.speed*dt*.65);
      this.stone.mesh.rotateOnWorldAxis(this.axis,this.speed*dt/this.data.radius);
      if(this.fallV>70){this.finished=true;this.stone.mesh.visible=false;}
      return false;
    }
    let began=false;
    if(!this.active&&this.playerProgress>this.trigger){this.release-=dt;if(this.release<=0){this.active=true;began=true;}}
    if(!this.active)return began;
    const gap=this.playerProgress-this.progress;
    const target=THREE.MathUtils.clamp(this.data.speed+(gap-this.data.headStart)*1.4,6.4,40);
    this.speed+=THREE.MathUtils.clamp(target-this.speed,-10*dt,12*dt);
    const distance=this.speed*dt;this.progress=Math.min(this.length,this.progress+distance);
    this.sample(this.progress,this.stone.mesh.position).y+=this.data.radius*.94;
    this.tangent(this.progress,this.direction);this.axis.set(this.direction.z,0,-this.direction.x);
    this.turn.setFromAxisAngle(this.axis,distance/this.data.radius);this.stone.mesh.quaternion.premultiply(this.turn);
    // Narrower than the visible diameter: the irregular rim is generous.
    this.stone.box.setFromCenterAndSize(this.stone.mesh.position,this.boxSize.set(this.data.radius*1.55,this.data.radius*1.9,this.data.radius*1.55));
    this.stone.speed=this.speed;
    if(this.progress>=this.length){this.active=false;this.falling=true;this.stone.box.makeEmpty();}
    return began;
  }
}

/** Ahead-of-runner camera. Its horizontal frame comes from the route, so
 * lateral route selection never flips the shot or changes the input basis. */
export class BoulderChaseCamera {
  private readonly forward=new THREE.Vector3(0,0,-1);
  private readonly origin=new THREE.Vector3();
  private readonly ahead=new THREE.Vector3();
  private readonly eye=new THREE.Vector3();
  private readonly aim=new THREE.Vector3();
  private readonly look=new THREE.Vector3();
  readonly control=new THREE.Vector3();

  update(camera:THREE.PerspectiveCamera,chase:BoulderChase,subject:THREE.Vector3,speed:number,
    dt:number,snap:boolean,bounds?:THREE.Box3|null):void {
    const s=chase.project(subject),floor=chase.sample(s,this.origin).y;
    chase.sample(s+18,this.ahead);chase.sample(s-8,this.look);
    this.ahead.sub(this.look).setY(0).normalize();
    this.forward.lerp(this.ahead,snap?1:1-Math.exp(-5*dt)).normalize();
    this.control.copy(this.forward).negate();
    const narrow=Math.max(0,1.35-camera.aspect);
    const distance=32+THREE.MathUtils.clamp((Math.abs(speed)-12)*.28,0,6)+narrow*12;
    const height=9.5+narrow*5+THREE.MathUtils.clamp(subject.y-floor,0,10)*.72;
    this.eye.copy(this.origin).lerp(subject,.58).addScaledVector(this.forward,distance);
    this.eye.y=floor+height;
    this.aim.copy(this.origin).lerp(subject,Math.min(1,camera.aspect/.95)).addScaledVector(this.forward,3.5);this.aim.y=floor+1.6+Math.max(0,subject.y-floor)*.2;
    const k=snap?1:1-Math.exp(-9*dt);
    camera.position.lerp(this.eye,k);
    // Translation and route yaw supply damping without jump-induced pitch lag.
    camera.up.set(0,1,0);camera.lookAt(this.aim);
    camera.fov=48;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(bounds&&!bounds.isEmpty()){
      let max=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        this.ahead.set(x,y,z).project(camera);max=Math.max(max,Math.abs(this.ahead.x)/.86,Math.abs(this.ahead.y)/.86);
      }
      if(max>1){camera.position.sub(this.aim).multiplyScalar(Math.min(1.6,max)).add(this.aim);camera.lookAt(this.aim);camera.updateMatrixWorld();}
    }
  }
}
