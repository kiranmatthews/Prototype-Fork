import * as THREE from 'three';
import type {Stone} from './level';

type Point=[number,number,number];
export interface BoulderChaseData {
  /** One continuous camera/floor spine; shelters divide its pursuit into runs. */
  path:Point[];
  radius:number;
  speed:number;
  headStart:number;
  shelters?:{entry:Point;exit:Point}[];
}
const smooth=(value:number)=>{const t=THREE.MathUtils.clamp(value,0,1);return t*t*(3-2*t);};
const validPoint=(p:unknown):p is Point=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000);
function projection(path:Point[],p:{x:number;z:number}):number {
  let best=Infinity,result=0,arc=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz);
    const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[2])*dz)/(length*length),i===1?-100:0,i===path.length-1?100:1);
    const distance=(p.x-a[0]-dx*t)**2+(p.z-a[2]-dz*t)**2;
    if(distance<best){best=distance;result=arc+length*t;}arc+=length;
  }return result;
}
export function validBoulderChase(value:unknown):value is BoulderChaseData {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const d=value as BoulderChaseData;
  if(Object.keys(d).some(k=>!['path','radius','speed','headStart','shelters'].includes(k)))return false;
  if(!Array.isArray(d.path)||d.path.length<2||d.path.length>1024||!d.path.every(validPoint))return false;
  if(![d.radius,d.speed,d.headStart].every(Number.isFinite)||d.radius<1||d.radius>12||
    d.speed<2||d.speed>35||d.headStart<d.radius*2+4||d.headStart>100)return false;
  let length=0;
  for(let i=1;i<d.path.length;i++){
    const a=d.path[i-1],b=d.path[i],span=Math.hypot(b[0]-a[0],b[2]-a[2]);if(span<.01)return false;length+=span;
  }
  if(length<=2*d.headStart||length>=10000)return false;
  if(d.shelters!==undefined){
    if(!Array.isArray(d.shelters)||d.shelters.length>16)return false;
    let previous=0;
    for(const room of d.shelters){
      if(!room||typeof room!=='object'||Object.keys(room).some(k=>!['entry','exit'].includes(k))||!validPoint(room.entry)||!validPoint(room.exit))return false;
      const entry=projection(d.path,{x:room.entry[0],z:room.entry[2]}),exit=projection(d.path,{x:room.exit[0],z:room.exit[2]});
      if(entry-previous<d.radius*3+30||exit-entry<18||exit-entry>100||exit>length-d.radius*3-20)return false;
      previous=exit;
    }
  }return true;
}
export type BoulderPhase='waiting'|'dropping'|'chasing'|'retiring'|'jammed'|'falling'|'gone';
export interface ChaseBoulder {
  stone:Stone;index:number;start:number;trigger:number;end:number;progress:number;speed:number;
  phase:BoulderPhase;drop:number;verticalSpeed:number;release:number;settle:number;reveal:number;
  jamBox:THREE.Box3;jamRotation:THREE.Quaternion;
}
export interface ChaseEvent {kind:'release'|'land'|'gate';actor:ChaseBoulder;}

/** Independent stones share a floor spine, but never teleport between runs.
 * Passing an entrance retires its pursuer; leaving the refuge drops the next. */
export class BoulderChase {
  readonly points:THREE.Vector3[];
  readonly lengths=[0];
  readonly length:number;
  readonly shelters:{entry:number;exit:number}[];
  readonly actors:ChaseBoulder[];
  readonly events:ChaseEvent[]=[];
  playerProgress=0;
  stage=0;
  private readonly point=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly axis=new THREE.Vector3();
  private readonly turn=new THREE.Quaternion();
  private readonly boxSize=new THREE.Vector3();

  constructor(readonly data:BoulderChaseData,stones:Stone|Stone[],spawn:THREE.Vector3){
    this.points=data.path.map(p=>new THREE.Vector3(...p));
    for(let i=1;i<this.points.length;i++)this.lengths.push(this.lengths[i-1]+Math.hypot(this.points[i].x-this.points[i-1].x,this.points[i].z-this.points[i-1].z));
    this.length=this.lengths[this.lengths.length-1];
    this.shelters=(data.shelters??[]).map(room=>({entry:this.project({x:room.entry[0],z:room.entry[2]}),exit:this.project({x:room.exit[0],z:room.exit[2]})}));
    const pool=Array.isArray(stones)?stones:[stones];
    if(pool.length!==this.shelters.length+1)throw Error('A chase needs one independent boulder per run');
    this.actors=pool.map((stone,index)=>{
      stone.chase=true;
      const start=index?this.shelters[index-1].exit+data.radius+2:0;
      return{stone,index,start,trigger:start+6,end:index<this.shelters.length?this.shelters[index].entry-data.radius-.75:this.length,
        progress:start,speed:0,phase:'waiting',drop:index?13:0,verticalSpeed:0,release:index?0:.65,settle:0,reveal:0,
        jamBox:new THREE.Box3(),jamRotation:new THREE.Quaternion()};
    });
    this.reset(spawn);
  }
  get stone():Stone{return this.actors[this.stage].stone;}
  get progress():number{return this.actors[this.stage].progress;}
  get speed():number{return this.actors[this.stage].speed;}
  get active():boolean{return this.actors[this.stage].phase==='chasing';}
  get falling():boolean{return this.actors[this.stage].phase==='falling';}
  get finished():boolean{return this.stage===this.actors.length-1&&this.actors[this.stage].phase==='gone';}
  get sheltered():boolean{return this.shelters.some(r=>this.playerProgress>=r.entry&&this.playerProgress<=r.exit);}
  project(p:{x:number;z:number}):number{return projection(this.data.path,p);}
  sample(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    let lo=0,hi=this.points.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(this.lengths[mid]>s)hi=mid;else lo=mid;}
    return out.copy(this.points[lo]).lerp(this.points[hi],(s-this.lengths[lo])/(this.lengths[hi]-this.lengths[lo]));
  }
  tangent(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    this.sample(s-2,this.point);this.sample(s+2,out);return out.sub(this.point).setY(0).normalize();
  }
  shelterCameraWeight(s:number):number {
    let weight=0;
    for(const room of this.shelters)weight=Math.max(weight,smooth((s-room.entry+48)/20)*(1-smooth((s-room.exit)/16)));
    return weight;
  }
  get releaseCameraWeight():number {
    const a=this.actors[this.stage];if(!a.index)return 0;
    if(a.phase==='waiting'&&a.drop>0)return smooth((this.playerProgress-this.shelters[a.index-1].exit-2)/12);
    if(a.phase==='dropping')return 1;
    return Math.min(1,a.reveal);
  }
  private place(a:ChaseBoulder):void {
    this.sample(a.progress,a.stone.mesh.position).y+=this.data.radius+a.drop;
  }
  private collision(a:ChaseBoulder):void {
    this.point.copy(a.stone.mesh.position);this.point.y-=this.data.radius*.06;
    a.stone.box.setFromCenterAndSize(this.point,this.boxSize.set(this.data.radius*1.55,this.data.radius*1.9,this.data.radius*1.55));
  }
  private jam(a:ChaseBoulder,event=true):void {
    a.phase='jammed';a.speed=0;a.drop=0;a.settle=0;this.place(a);a.jamRotation.copy(a.stone.mesh.quaternion);a.stone.box.makeEmpty();
    a.jamBox.setFromCenterAndSize(a.stone.mesh.position,this.boxSize.set(this.data.radius*1.45,this.data.radius*1.9,this.data.radius*1.45));
    if(event)this.events.push({kind:'gate',actor:a});
  }
  reset(spawn:THREE.Vector3):void {
    this.events.length=0;this.playerProgress=this.project(spawn);this.stage=this.shelters.filter(r=>this.playerProgress>=r.entry).length;
    for(const a of this.actors){
      a.progress=a.start;a.speed=0;a.drop=a.index?13:0;a.verticalSpeed=0;a.release=a.index?0:.65;a.reveal=0;a.settle=0;
      a.phase='waiting';a.stone.box.makeEmpty();a.jamBox.makeEmpty();a.stone.mesh.quaternion.identity();a.stone.speed=0;
      if(a.index<this.stage){a.progress=a.end;this.jam(a,false);}
      else if(a.index===this.stage&&!this.sheltered){
        a.progress=Math.min(a.end,Math.max(a.start,this.playerProgress-this.data.headStart));a.trigger=this.playerProgress+5;a.drop=0;a.release=.65;
        if(this.playerProgress>this.length+1)a.phase='gone';
      }else a.trigger=a.start+6;
      this.place(a);a.stone.mesh.visible=a.phase!=='gone'&&Math.abs(a.progress-this.playerProgress)<160;
    }
  }
  update(dt:number,player:{x:number;y:number;z:number}):boolean {
    this.events.length=0;if(dt<=0)return false;this.playerProgress=this.project(player);
    while(this.stage<this.shelters.length&&this.playerProgress>=this.shelters[this.stage].entry){
      const old=this.actors[this.stage];if(!['jammed','gone'].includes(old.phase))old.phase='retiring';old.stone.box.makeEmpty();this.stage++;
    }
    let began=false;
    for(const a of this.actors){
      const mesh=a.stone.mesh;
      a.reveal=Math.max(0,a.reveal-dt);a.stone.box.makeEmpty();
      if(a.phase==='gone'){mesh.visible=false;continue;}
      mesh.visible=Math.abs(a.progress-this.playerProgress)<160;
      if(a.phase==='waiting'){
        this.place(a);
        if(a.index===this.stage&&this.playerProgress>a.trigger){
          a.release-=dt;
          if(a.release<=0){a.phase=a.drop>0?'dropping':'chasing';a.verticalSpeed=0;began=true;if(a.drop>0)this.events.push({kind:'release',actor:a});else this.collision(a);}
        }continue;
      }
      if(a.phase==='dropping'){
        a.verticalSpeed+=36*dt;a.drop=Math.max(0,a.drop-a.verticalSpeed*dt);this.place(a);
        if(!this.sheltered)this.collision(a);
        if(a.drop===0){a.phase='chasing';a.speed=this.data.speed;a.stone.speed=a.speed;a.reveal=1.2;this.events.push({kind:'land',actor:a});}continue;
      }
      if(a.phase==='jammed'){
        a.settle=Math.min(.65,a.settle+dt);this.place(a);
        mesh.quaternion.copy(a.jamRotation);
        if(a.settle<.65){
          this.tangent(a.progress,this.direction);mesh.position.addScaledVector(this.direction,Math.sin(a.settle*28)*Math.exp(-a.settle*10)*.16);
        }continue;
      }
      if(a.phase==='falling'){
        a.verticalSpeed+=24*dt;mesh.position.y-=a.verticalSpeed*dt;
        this.tangent(a.progress,this.direction);mesh.position.addScaledVector(this.direction,a.speed*dt*.65);
        this.axis.set(this.direction.z,0,-this.direction.x);mesh.rotateOnWorldAxis(this.axis,a.speed*dt/this.data.radius);
        if(a.verticalSpeed>70){a.phase='gone';mesh.visible=false;}continue;
      }
      const target=a.phase==='retiring'?40:THREE.MathUtils.clamp(this.data.speed+(this.playerProgress-a.progress-this.data.headStart)*1.4,6.4,40);
      a.speed+=THREE.MathUtils.clamp(target-a.speed,-10*dt,12*dt);
      const before=a.progress;a.progress=Math.min(a.end,a.progress+a.speed*dt);a.drop=0;this.place(a);
      this.tangent(a.progress,this.direction);this.axis.set(this.direction.z,0,-this.direction.x);
      this.turn.setFromAxisAngle(this.axis,(a.progress-before)/this.data.radius);mesh.quaternion.premultiply(this.turn);a.stone.speed=a.speed;
      if(a.phase==='chasing'&&!this.sheltered)this.collision(a);
      if(a.progress>=a.end){
        a.stone.box.makeEmpty();
        if(a.index<this.shelters.length)this.jam(a);
        else{a.phase='falling';a.verticalSpeed=0;}
      }
    }return began;
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
    const refuge=chase.shelterCameraWeight(s),release=chase.releaseCameraWeight;
    const distance=THREE.MathUtils.lerp(THREE.MathUtils.lerp(32+THREE.MathUtils.clamp((Math.abs(speed)-12)*.28,0,6)+narrow*12,18+narrow*5,refuge),44+narrow*8,release);
    const height=THREE.MathUtils.lerp(THREE.MathUtils.lerp(9.5+narrow*5+THREE.MathUtils.clamp(subject.y-floor,0,10)*.72,5.7,refuge),14+narrow*2,release);
    this.eye.copy(this.origin).lerp(subject,.58).addScaledVector(this.forward,distance);
    this.eye.y=floor+height;
    this.aim.copy(this.origin).lerp(subject,Math.min(1,camera.aspect/.95)).addScaledVector(this.forward,3.5);this.aim.y=floor+THREE.MathUtils.lerp(1.6+Math.max(0,subject.y-floor)*.2,7.5,release);
    const k=snap?1:1-Math.exp(-9*dt);
    camera.position.lerp(this.eye,k);
    // Translation and route yaw supply damping without jump-induced pitch lag.
    camera.up.set(0,1,0);camera.lookAt(this.aim);
    camera.fov=48+14*release;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(bounds&&!bounds.isEmpty()){
      let max=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        this.ahead.set(x,y,z).project(camera);max=Math.max(max,Math.abs(this.ahead.x)/.86,Math.abs(this.ahead.y)/.86);
      }
      if(max>1){camera.position.sub(this.aim).multiplyScalar(Math.min(1.6,max)).add(this.aim);camera.lookAt(this.aim);camera.updateMatrixWorld();}
    }
  }
}
