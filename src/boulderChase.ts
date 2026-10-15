import * as THREE from 'three';
import type {Stone} from './level';
import {BoulderCameraRun} from './boulderCameraRun';

type Point=[number,number,number];
export interface BoulderChaseData {
  /** One continuous camera/floor spine; shelters divide its pursuit into runs. */
  path:Point[];
  /** Alternatives share entry/merge points; the camera keeps the main spine. */
  forks?:{paths:Point[][]}[];
  /** Enclosed courses frame the selected bore instead of looking through its divider. */
  cameraMode?:'tunnel';
  /** Camera floor continues beyond the stone’s final drop; excludes rolling dips. */
  cameraPath?:Point[];
  radius:number;
  speed:number;
  paces?:number[];
  openingDrop?:boolean;
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
  if(Object.keys(d).some(k=>!['path','radius','speed','headStart','shelters','paces','openingDrop','forks','cameraMode','cameraPath'].includes(k)))return false;
  if(d.cameraMode!==undefined&&d.cameraMode!=='tunnel')return false;
  if(d.cameraPath!==undefined&&(!Array.isArray(d.cameraPath)||d.cameraPath.length<2||d.cameraPath.length>1024||!d.cameraPath.every(validPoint)||d.cameraPath.some((p,i)=>i>0&&Math.hypot(p[0]-d.cameraPath![i-1][0],p[2]-d.cameraPath![i-1][2])<.01)))return false;
  if(d.openingDrop!==undefined&&typeof d.openingDrop!=='boolean')return false;
  if(!Array.isArray(d.path)||d.path.length<2||d.path.length>1024||!d.path.every(validPoint))return false;
  if(![d.radius,d.speed,d.headStart].every(Number.isFinite)||d.radius<1||d.radius>12||
    d.speed<2||d.speed>35||d.headStart<d.radius*2+4||d.headStart>100)return false;
  let length=0;
  for(let i=1;i<d.path.length;i++){
    const a=d.path[i-1],b=d.path[i],span=Math.hypot(b[0]-a[0],b[2]-a[2]);if(span<.01)return false;length+=span;
  }
  if(length<=2*d.headStart||length>=10000)return false;
  if(d.paces!==undefined&&(!Array.isArray(d.paces)||d.paces.length!==(d.shelters?.length??0)+1||d.paces.some(n=>!Number.isFinite(n)||n<2||n>35)))return false;
  if(d.shelters!==undefined){
    if(!Array.isArray(d.shelters)||d.shelters.length>16)return false;
    let previous=0;
    for(const room of d.shelters){
      if(!room||typeof room!=='object'||Object.keys(room).some(k=>!['entry','exit'].includes(k))||!validPoint(room.entry)||!validPoint(room.exit))return false;
      const entry=projection(d.path,{x:room.entry[0],z:room.entry[2]}),exit=projection(d.path,{x:room.exit[0],z:room.exit[2]});
      if(entry-previous<d.radius*3+30||exit-entry<18||exit-entry>100||exit>length-d.radius*3-20)return false;
      previous=exit;
    }
  }
  if(d.forks!==undefined){
    if(!Array.isArray(d.forks)||d.forks.length>16)return false;
    let previous=0,total=0;
    for(const fork of d.forks){
      if(!fork||typeof fork!=='object'||Object.keys(fork).some(k=>k!=='paths')||!Array.isArray(fork.paths)||fork.paths.length<2||fork.paths.length>4)return false;
      let start=0,end=0;
      for(const [index,path]of fork.paths.entries()){
        if(!Array.isArray(path)||path.length<3||path.length>256||!path.every(validPoint)||(total+=path.length)>4096)return false;
        const projected=path.map(p=>projection(d.path,{x:p[0],z:p[2]}));
        if(projected.some((v,i)=>i>0&&v-projected[i-1]<.01))return false;
        if(index===0){start=projected[0];end=projected[projected.length-1];}
        for(const i of [0,path.length-1]){
          const endpoint=fork.paths[0][i===0?0:fork.paths[0].length-1];
          if(Math.hypot(...path[i].map((v,j)=>v-endpoint[j]))>.01)return false;
          let arc=0,matched=false;
          for(let j=1;j<d.path.length;j++){
            const a=d.path[j-1],b=d.path[j],span=Math.hypot(b[0]-a[0],b[2]-a[2]),at=projected[i];
            if(at>=arc-.001&&at<=arc+span+.001){const t=(at-arc)/span;matched=Math.hypot(...path[i].map((v,k)=>v-a[k]-(b[k]-a[k])*t))<.25;break;}arc+=span;
          }
          if(!matched)return false;
        }
      }
      if(start<previous||end-start<8||end>length+.001)return false;
      for(const room of d.shelters??[]){
        const entry=projection(d.path,{x:room.entry[0],z:room.entry[2]})-d.radius-.75;
        const exit=projection(d.path,{x:room.exit[0],z:room.exit[2]})+d.radius+2;
        if(start<exit&&end>entry)return false;
      }
      previous=end;
    }
  }
  return true;
}
export type BoulderPhase='waiting'|'dropping'|'chasing'|'retiring'|'jammed'|'falling'|'gone'|'camera-run';
export interface ChaseBoulder {
  stone:Stone;index:number;pace:number;start:number;trigger:number;end:number;progress:number;speed:number;
  phase:BoulderPhase;drop:number;verticalSpeed:number;release:number;settle:number;reveal:number;
  jamBox:THREE.Box3;jamRotation:THREE.Quaternion;crushBox:THREE.Box3;previousPosition:THREE.Vector3;
}
export interface ChaseEvent {kind:'release'|'land'|'gate';actor:ChaseBoulder;}
interface ForkPath {points:THREE.Vector3[];progress:number[];lengths:number[];}
interface ChaseFork {start:number;end:number;paths:ForkPath[];choice:number;locked:boolean;}
const segment=(values:number[],s:number)=>{
  let lo=0,hi=values.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(values[mid]>s)hi=mid;else lo=mid;}
  return lo;
};
const mapDistance=(from:number[],to:number[],value:number)=>{
  const i=segment(from,value),t=(value-from[i])/(from[i+1]-from[i]);return THREE.MathUtils.lerp(to[i],to[i+1],t);
};

/** Independent stones share a floor spine, but never teleport between runs.
 * Passing an entrance retires its pursuer; leaving the refuge drops the next. */
export class BoulderChase {
  readonly points:THREE.Vector3[];
  private readonly cameraPoints:THREE.Vector3[];
  private readonly cameraLengths=[0];
  private readonly cameraBaseline=new THREE.Vector3();
  private readonly cameraFloorPoint=new THREE.Vector3();
  readonly lengths=[0];
  readonly length:number;
  readonly shelters:{entry:number;exit:number}[];
  readonly actors:ChaseBoulder[];
  readonly events:ChaseEvent[]=[];
  readonly forks:ChaseFork[];
  cameraRun:BoulderCameraRun|null=null;
  readonly sectionDeaths:number[];
  overtakenSeconds=0;
  private lightningPending=false;
  private lightningSpent=false;
  playerProgress=0;
  stage=0;
  private readonly point=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly axis=new THREE.Vector3();
  private readonly turn=new THREE.Quaternion();
  private readonly boxSize=new THREE.Vector3();
  private readonly previousCrushBox=new THREE.Box3();

  constructor(readonly data:BoulderChaseData,stones:Stone|Stone[],spawn:THREE.Vector3){
    this.points=data.path.map(p=>new THREE.Vector3(...p));
    this.cameraPoints=(data.cameraPath??data.path).map(p=>new THREE.Vector3(...p));
    for(let i=1;i<this.cameraPoints.length;i++)this.cameraLengths.push(this.cameraLengths[i-1]+Math.hypot(this.cameraPoints[i].x-this.cameraPoints[i-1].x,this.cameraPoints[i].z-this.cameraPoints[i-1].z));
    for(let i=1;i<this.points.length;i++)this.lengths.push(this.lengths[i-1]+Math.hypot(this.points[i].x-this.points[i-1].x,this.points[i].z-this.points[i-1].z));
    this.length=this.lengths[this.lengths.length-1];
    this.shelters=(data.shelters??[]).map(room=>({entry:this.project({x:room.entry[0],z:room.entry[2]}),exit:this.project({x:room.exit[0],z:room.exit[2]})}));
    const pool=Array.isArray(stones)?stones:[stones];
    if(pool.length!==this.shelters.length+1)throw Error('A chase needs one independent boulder per run');
    this.actors=pool.map((stone,index)=>{
      stone.chase=true;
      const start=index?this.shelters[index-1].exit+data.radius+2:data.openingDrop?Math.max(0,this.project(spawn)-data.headStart):0;
      return{stone,index,pace:data.paces?.[index]??data.speed,start,trigger:start+6,end:index<this.shelters.length?this.shelters[index].entry-data.radius-.75:this.length,
        progress:start,speed:0,phase:'waiting',drop:index||data.openingDrop?13:0,verticalSpeed:0,release:index?0:.65,settle:0,reveal:0,
        jamBox:new THREE.Box3(),jamRotation:new THREE.Quaternion(),crushBox:new THREE.Box3(),previousPosition:new THREE.Vector3()};
    });
    this.sectionDeaths=this.actors.map(()=>0);
    this.forks=(data.forks??[]).map(fork=>{
      const paths=fork.paths.map(path=>{
        const points=path.map(p=>new THREE.Vector3(...p)),progress=points.map(p=>this.project(p)),lengths=[0];
        this.sample(progress[0],points[0]);this.sample(progress[progress.length-1],points[points.length-1]);
        for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
        return{points,progress,lengths};
      });return{start:paths[0].progress[0],end:paths[0].progress[paths[0].progress.length-1],paths,choice:-1,locked:false};
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
  private sampleFork(path:ForkPath,s:number,out:THREE.Vector3):THREE.Vector3 {
    const i=segment(path.progress,s),t=(s-path.progress[i])/(path.progress[i+1]-path.progress[i]);
    return out.copy(path.points[i]).lerp(path.points[i+1],t);
  }
  /** Physical track only: dust, contacts and rotation follow the same branch. */
  sampleBoulder(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    const fork=this.forks.find(f=>s>=f.start&&s<=f.end);
    return fork?this.sampleFork(fork.paths[Math.max(0,fork.choice)],s,out):this.sample(s,out);
  }
  sampleCamera(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    if(!this.data.cameraPath)return this.sampleBoulder(s,out);
    const i=segment(this.cameraLengths,s),t=(s-this.cameraLengths[i])/(this.cameraLengths[i+1]-this.cameraLengths[i]);
    this.cameraFloorPoint.copy(this.cameraPoints[i]).lerp(this.cameraPoints[i+1],t);
    if(this.forks.some(f=>s>=f.start&&s<=f.end)){
      this.sampleBoulder(s,out);out.y+=this.cameraFloorPoint.y-this.sample(s,this.cameraBaseline).y;return out;
    }
    return out.copy(this.cameraFloorPoint);
  }
  tangentBoulder(s:number,out=new THREE.Vector3()):THREE.Vector3 {
    this.sampleBoulder(s-1,this.point);this.sampleBoulder(s+1,out);return out.sub(this.point).setY(0).normalize();
  }
  private chooseForks(player:{x:number;y:number;z:number}):void {
    for(const f of this.forks){
      if(f.locked||this.playerProgress<f.start+1||this.playerProgress>f.end-1)continue;
      let best=f.choice,score=Infinity;
      for(let i=0;i<f.paths.length;i++){
        this.sampleFork(f.paths[i],this.playerProgress,this.point);
        // Jump height must not turn a low-bank choice into a high-rail choice.
        const distance=Math.hypot(player.x-this.point.x,player.z-this.point.z)+.12*Math.abs(player.y-this.point.y);
        const biased=distance+(i===f.choice?0:.6);
        if(biased<score){score=biased;best=i;}
      }
      f.choice=best;
    }
  }
  private advance(s:number,distance:number):number {
    for(const f of this.forks){
      if(f.end<=s)continue;
      const approach=Math.max(0,f.start-s);if(distance<=approach)return s+distance;
      distance-=approach;s=Math.max(s,f.start);f.locked=true;
      const path=f.paths[Math.max(0,f.choice)];if(f.choice<0)f.choice=0;
      const at=mapDistance(path.progress,path.lengths,s),remaining=path.lengths[path.lengths.length-1]-at;
      if(distance<=remaining)return mapDistance(path.lengths,path.progress,at+distance);
      distance-=remaining;s=f.end;
    }
    return s+distance;
  }
  shelterCameraWeight(s:number):number {
    let weight=0;
    for(const room of this.shelters)weight=Math.max(weight,smooth((s-room.entry+48)/20)*(1-smooth((s-room.exit)/16)));
    return weight;
  }
  get releaseCameraWeight():number {
    const a=this.actors[this.stage];if(!a.index)return this.data.openingDrop&&a.drop>0?1:Math.min(1,a.reveal);
    if(a.phase==='waiting'&&a.drop>0)return smooth((this.playerProgress-this.shelters[a.index-1].exit-2)/12);
    if(a.phase==='dropping')return 1;
    return Math.min(1,a.reveal);
  }
  private place(a:ChaseBoulder):void {
    this.sampleBoulder(a.progress,a.stone.mesh.position).y+=this.data.radius+a.drop;
  }
  private collision(a:ChaseBoulder):void {
    this.point.copy(a.stone.mesh.position);this.point.y-=this.data.radius*.06;
    a.stone.box.setFromCenterAndSize(this.point,this.boxSize.set(this.data.radius*1.55,this.data.radius*1.9,this.data.radius*1.55));
  }
  private crushVolume(a:ChaseBoulder):void {
    this.boxSize.setScalar(this.data.radius*2);
    a.crushBox.setFromCenterAndSize(a.stone.mesh.position,this.boxSize);
    this.previousCrushBox.setFromCenterAndSize(a.previousPosition,this.boxSize);a.crushBox.union(this.previousCrushBox);
  }
  private jam(a:ChaseBoulder,event=true):void {
    a.phase='jammed';a.speed=0;a.drop=0;a.settle=0;this.place(a);a.jamRotation.copy(a.stone.mesh.quaternion);a.stone.box.makeEmpty();
    a.jamBox.setFromCenterAndSize(a.stone.mesh.position,this.boxSize.set(this.data.radius*1.45,this.data.radius*1.9,this.data.radius*1.45));
    if(event)this.events.push({kind:'gate',actor:a});
  }
  beginCameraRun(index:number,eye:THREE.Vector3,view:THREE.Vector3):BoulderCameraRun|null {
    const actor=this.actors[index];
    if(!actor||!['chasing','dropping'].includes(actor.phase)||this.cameraRun)return null;
    this.tangentBoulder(actor.progress,this.direction);
    this.cameraRun=new BoulderCameraRun(index,actor.stone.mesh.position,this.direction,eye,view,this.data.radius,actor.speed||actor.pace);
    actor.phase='camera-run';actor.stone.box.makeEmpty();actor.crushBox.makeEmpty();return this.cameraRun;
  }
  /** Applied only on a retry, never as rubber-banding during the chase. */
  speedScale(section=this.stage):number {return 1-.04*Math.min(5,Math.max(0,this.sectionDeaths[section]-2));}
  recordDeath(respawn:THREE.Vector3):void {
    const section=this.shelters.filter(r=>this.project(respawn)>=r.entry).length;this.sectionDeaths[section]++;
  }
  consumeLightning():boolean {const pending=this.lightningPending;this.lightningPending=false;return pending;}
  reset(spawn:THREE.Vector3,hard=false):void {
    if(hard)this.sectionDeaths.fill(0);
    this.cameraRun=null;
    this.overtakenSeconds=0;this.lightningPending=this.lightningSpent=false;
    this.events.length=0;this.playerProgress=this.project(spawn);this.stage=this.shelters.filter(r=>this.playerProgress>=r.entry).length;
    for(const fork of this.forks){fork.choice=-1;fork.locked=false;}this.chooseForks(spawn);
    for(const a of this.actors){
      a.pace=(this.data.paces?.[a.index]??this.data.speed)*this.speedScale(a.index);
      a.progress=a.start;a.speed=0;a.drop=a.index||this.data.openingDrop?13:0;a.verticalSpeed=0;a.release=a.index?0:.65;a.reveal=0;a.settle=0;
      a.phase='waiting';a.stone.box.makeEmpty();a.crushBox.makeEmpty();a.jamBox.makeEmpty();a.stone.mesh.quaternion.identity();a.stone.speed=0;
      if(a.index<this.stage){a.progress=a.end;this.jam(a,false);}
      else if(a.index===this.stage&&!this.sheltered){
        a.progress=Math.min(a.end,Math.max(a.start,this.playerProgress-this.data.headStart));a.trigger=this.playerProgress+5;a.drop=!a.index&&this.data.openingDrop&&this.playerProgress<=a.start+this.data.headStart+1?13:0;a.release=.65;
        if(this.playerProgress>this.length+1)a.phase='gone';
      }else a.trigger=a.start+6;
      for(const fork of this.forks)if(a.progress>=fork.start&&a.progress<=fork.end)fork.locked=true;
      this.place(a);a.stone.mesh.visible=a.phase!=='gone'&&Math.abs(a.progress-this.playerProgress)<160;
    }
  }
  update(dt:number,player:{x:number;y:number;z:number}):boolean {
    this.events.length=0;if(dt<=0)return false;this.playerProgress=this.project(player);
    while(this.stage<this.shelters.length&&this.playerProgress>=this.shelters[this.stage].entry){
      const old=this.actors[this.stage];if(!['jammed','gone'].includes(old.phase))old.phase='retiring';old.stone.box.makeEmpty();this.stage++;
    }
    this.chooseForks(player);
    let began=false;
    for(const a of this.actors){
      const mesh=a.stone.mesh;a.previousPosition.copy(mesh.position);a.crushBox.makeEmpty();
      a.reveal=Math.max(0,a.reveal-dt);a.stone.box.makeEmpty();
      if(a.phase==='camera-run'&&this.cameraRun){
        mesh.visible=true;this.cameraRun.update(dt,mesh);a.progress=this.project(mesh.position);a.speed=this.cameraRun.hit?0:a.pace;continue;
      }
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
        if(!this.sheltered)this.collision(a);this.crushVolume(a);
        if(a.drop===0){a.phase='chasing';a.speed=a.pace;a.stone.speed=a.speed;a.reveal=1.2;this.events.push({kind:'land',actor:a});}continue;
      }
      if(a.phase==='jammed'){
        a.settle=Math.min(.65,a.settle+dt);this.place(a);
        mesh.quaternion.copy(a.jamRotation);
        if(a.settle<.65){
          this.tangentBoulder(a.progress,this.direction);mesh.position.addScaledVector(this.direction,Math.sin(a.settle*28)*Math.exp(-a.settle*10)*.16);
        }continue;
      }
      if(a.phase==='falling'){
        a.verticalSpeed+=24*dt;mesh.position.y-=a.verticalSpeed*dt;
        this.tangentBoulder(a.progress,this.direction);mesh.position.addScaledVector(this.direction,a.speed*dt*.65);
        this.axis.set(this.direction.z,0,-this.direction.x);mesh.rotateOnWorldAxis(this.axis,a.speed*dt/this.data.radius);
        if(a.verticalSpeed>70){a.phase='gone';mesh.visible=false;}continue;
      }
      // Commit to an authored pace. Proximity to the runner never applies brakes.
      const target=a.phase==='retiring'?Math.max(40,a.pace):a.pace;
      a.speed=Math.min(target,a.speed+12*dt);
      a.progress=Math.min(a.end,this.advance(a.progress,a.speed*dt));a.drop=0;this.place(a);
      this.tangentBoulder(a.progress,this.direction);this.axis.set(this.direction.z,0,-this.direction.x);
      this.turn.setFromAxisAngle(this.axis,mesh.position.distanceTo(a.previousPosition)/this.data.radius);mesh.quaternion.premultiply(this.turn);a.stone.speed=a.speed;
      if(a.phase==='chasing'&&!this.sheltered)this.collision(a);this.crushVolume(a);
      if(a.progress>=a.end){
        a.stone.box.makeEmpty();
        if(a.index<this.shelters.length)this.jam(a);
        else{a.phase='falling';a.verticalSpeed=0;}
      }
    }
    const pursuer=this.actors[this.stage];
    const passed=!this.sheltered&&!['waiting','dropping','retiring','camera-run'].includes(pursuer.phase)&&pursuer.progress>this.playerProgress+this.data.radius+2;
    this.overtakenSeconds=passed?this.overtakenSeconds+dt:0;
    if(this.overtakenSeconds>=3&&!this.lightningSpent){this.lightningSpent=this.lightningPending=true;}
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
    const tunnel=chase.data.cameraMode==='tunnel',s=chase.project(subject);
    const sample=(at:number,out:THREE.Vector3)=>tunnel?chase.sampleCamera(at,out):chase.sample(at,out);
    const floor=sample(s,this.origin).y;
    sample(s+(tunnel?10:18),this.ahead);sample(s-(tunnel?4:8),this.look);
    this.ahead.sub(this.look).setY(0).normalize();
    this.forward.lerp(this.ahead,snap?1:1-Math.exp(-5*dt)).normalize();
    this.control.copy(this.forward).negate();
    const narrow=Math.max(0,1.35-camera.aspect);
    const refuge=chase.shelterCameraWeight(s),release=chase.releaseCameraWeight;
    const distance=THREE.MathUtils.lerp(THREE.MathUtils.lerp((tunnel?18:32)+THREE.MathUtils.clamp((Math.abs(speed)-12)*.28,0,tunnel?3:6)+narrow*(tunnel?5:12),(tunnel?13:18)+narrow*5,refuge),(tunnel?23:44)+narrow*(tunnel?4:8),release);
    const height=THREE.MathUtils.lerp(THREE.MathUtils.lerp((tunnel?6.7:9.5)+narrow*(tunnel?2:5)+THREE.MathUtils.clamp(subject.y-floor,0,tunnel?5:10)*(tunnel?.35:.72),5.7,refuge),(tunnel?9:14)+narrow*2,release);
    const shelter=chase.shelters.find(room=>s>=room.entry-48&&s<=room.exit+16);
    const eyeFloor=shelter?THREE.MathUtils.lerp(floor,chase.sample(shelter.entry,this.look).y,refuge*(1-release)):floor;
    this.eye.copy(this.origin).lerp(subject,.58).addScaledVector(this.forward,distance);
    this.eye.y=eyeFloor+height;
    if(tunnel){sample(s+distance,this.eye);this.eye.y+=height;this.eye.x+=(subject.x-this.origin.x)*.2;this.eye.z+=(subject.z-this.origin.z)*.2;}
    this.aim.copy(this.origin).lerp(subject,Math.min(1,camera.aspect/.95)).addScaledVector(this.forward,3.5);this.aim.y=floor+THREE.MathUtils.lerp(1.6+Math.max(0,subject.y-floor)*.2,tunnel?5.8:7.5,release);
    const k=snap?1:1-Math.exp(-9*dt);
    camera.position.lerp(this.eye,k);
    // Translation and route yaw supply damping without jump-induced pitch lag.
    camera.up.set(0,1,0);camera.lookAt(this.aim);
    camera.fov=(tunnel?54:48)+(tunnel?8:14)*release;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(bounds&&!bounds.isEmpty()){
      let max=0;
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        this.ahead.set(x,y,z).project(camera);max=Math.max(max,Math.abs(this.ahead.x)/.86,Math.abs(this.ahead.y)/.86);
      }
      if(max>1){camera.position.sub(this.aim).multiplyScalar(Math.min(1.6,max)).add(this.aim);camera.lookAt(this.aim);camera.updateMatrixWorld();}
    }
  }
}
