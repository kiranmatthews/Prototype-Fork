import * as THREE from 'three';
import type { Level, Crate, Checkpoint } from '../level';
import type { Input } from '../input';
import type { Player } from '../player';
import { RaceCourse } from '../race/course';
import { RACE_ROSTER } from '../race/types';
import { GolfCartFleet } from './fleet';
import type { GroundSample, CartInput } from './physics';

interface Racer {
  id:number;player:Player;progress:number;anchor:THREE.Vector3;anchorProgress:number;
  finish:number|null;falls:number;recovery:number;boost:number;knockGrace:number;boxes:Set<Crate|Checkpoint>;
}
const clamp=THREE.MathUtils.clamp;

/** The existing cart solver owns all eight vehicles. Players are camera/HUD
 * adapters only; neither AI nor the race clock moves a vehicle along a spline. */
export class GolfCartRace {
  readonly fleet:GolfCartFleet;
  private previous:{x:number;y:number;z:number;yaw:number}[]=[];
  private respawns:number[]=[];
  private stun:number[]=[];
  private cache=new Map<string,GroundSample>();
  private cells=new Map<string,THREE.Object3D[]>();
  private ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,10000);
  private high=100;
  private point=new THREE.Vector3();
  constructor(private level:Level,private course:RaceCourse,private racers:readonly Racer[],count:number){
    for(const mesh of level.groundMeshes)mesh.updateWorldMatrix(true,false);
    for(const mesh of level.groundMeshes){
      const box=new THREE.Box3().setFromObject(mesh);this.high=Math.max(this.high,box.max.y+20);
      for(let x=Math.floor(box.min.x/16);x<=Math.floor(box.max.x/16);x++)for(let z=Math.floor(box.min.z/16);z<=Math.floor(box.max.z/16);z++){
        const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(mesh);this.cells.set(key,cell);
      }
    }
    const spawns=racers.slice(0,count).map(r=>({x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)}));
    const obstacles=level.walls.filter(b=>b.max.y-b.min.y>1&&b.max.x-b.min.x<9&&b.max.z-b.min.z<9)
      .map((b,i)=>({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,radius:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2,height:b.max.y-b.min.y,id:`rally-barrier-${i}`}));
    this.fleet=new GolfCartFleet({ground:(x,z)=>this.ground(x,z),spawns,obstacles,
      physics:{topSpeed:38,engine:23,speedLimit:44,maxLaunchVelocity:17,airRecoveryDelay:6}});
    this.fleet.models.forEach((m,i)=>m.setPalette({paint:RACE_ROSTER[i].color,cream:i===0?'#ef8058':'#f5e8ca'}));
    this.previous=this.fleet.physics.carts.map(c=>({...c}));this.respawns=spawns.map(()=>0);this.stun=spawns.map(()=>0);
    this.sync();
  }
  private probe(x:number,z:number):GroundSample {
    const key=`${x},${z}`,cached=this.cache.get(key);if(cached)return cached;
    this.ray.ray.origin.set(x,this.high,z);
    const hit=this.ray.intersectObjects(this.cells.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)??[],false)
      .find(h=>h.face&&h.face.normal.y>.04&&!h.object.userData.lethal&&!h.object.userData.outOfBounds);
    const sand=hit?.object.name==='Sand trap';
    const sample={height:hit?.point.y??this.level.killY-10,grip:sand?.58:1,drag:sand?5:.08,safe:!!hit,supported:!!hit};
    if(this.cache.size>=100000)this.cache.clear();this.cache.set(key,sample);return sample;
  }
  ground(x:number,z:number):GroundSample {
    const a=Math.floor(x*2)/2,b=Math.floor(z*2)/2,tx=(x-a)*2,tz=(z-b)*2;
    const q=[this.probe(a,b),this.probe(a+.5,b),this.probe(a,b+.5),this.probe(a+.5,b+.5)];
    // Never interpolate a ramp lip down into the void.
    if(q.some(p=>!p.supported))return this.probe(x,z);
    return {...q[0],height:THREE.MathUtils.lerp(THREE.MathUtils.lerp(q[0].height,q[1].height,tx),THREE.MathUtils.lerp(q[2].height,q[3].height,tx),tz)};
  }
  drive(id:number):Input {
    const c=this.fleet.physics.carts[id],r=this.racers[id],look=clamp(Math.abs(c.speed)*.55,9,22);
    let offset=id===0?0:(id%2?1:-1)*(2.2+Math.floor(id/2)*1.1);
    const ahead=this.course.sample(r.progress+look,offset);
    // Commit early to passing the marked barrier, never dodge at its bumper.
    for(const obstacle of this.fleet.physics.obstacles)if(Math.hypot(ahead.x-obstacle.x,ahead.z-obstacle.z)<obstacle.radius+5){
      const side=this.course.project(new THREE.Vector3(obstacle.x,ahead.y,obstacle.z),r.progress,60).offset;
      offset=side>0?-3:3;this.course.sample(r.progress+look,offset,ahead);break;
    }
    if(r.progress>this.course.length-25)ahead.addScaledVector(this.course.tangent(this.course.length),40);
    const bearing=Math.atan2(-(ahead.x-c.x),-(ahead.z-c.z)),angle=Math.atan2(Math.sin(bearing-c.yaw),Math.cos(bearing-c.yaw));
    const desired=(id===0?34:31.5+(id%3)*.65)/(1+Math.abs(angle)*.65);
    return {moveX:-clamp(angle*1.9,-1,1),moveY:clamp((desired-c.speed)*.24+.2,0,1),grabHeld:c.speed>desired+2,
      jumpHeld:false,jumpPressed:false,itemPressed:false} as Input;
  }
  step(dt:number,input:Input){
    const world=this.fleet.physics;
    for(const [i,c]of world.carts.entries()){
      const r=this.racers[i];this.previous[i]={x:c.x,y:c.y,z:c.z,yaw:c.yaw};
      // Editor checkpoint warps are explicit placements; adopt their heading.
      if(r.player.pos.distanceToSquared(this.point.set(c.x,c.y,c.z))>36){
        Object.assign(world.spawns[i],{x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)});world.reset(i,false);
        r.progress=this.course.project(r.player.pos).s;r.anchor.copy(r.player.pos);r.anchorProgress=r.progress;this.respawns[i]=c.respawns;
      }
      this.stun[i]=Math.max(0,this.stun[i]-dt);
    }
    this.fleet.update(dt,physics=>{
      for(const [i,c]of physics.carts.entries()){
        const r=this.racers[i],device=i===0?input:this.drive(i);
        let control:CartInput={throttle:device.moveY??0,steer:-(device.moveX??0),brake:device.grabHeld?1:0,handbrake:!!device.grindHeld,hop:!!device.jumpPressed};
        if(r.finish!==null||this.stun[i]>0)control={throttle:0,steer:0,brake:1,handbrake:false};
        physics.inputs[i]=control;
        if(r.boost>0&&c.grounded&&r.finish===null){const gain=20/120;c.vx-=Math.sin(c.yaw)*gain;c.vz-=Math.cos(c.yaw)*gain;}
      }
    },false);
    for(const [i,c]of world.carts.entries()){
      const r=this.racers[i];
      if(c.y<this.level.killY||c.y<r.anchor.y-30){world.reset(i,false);}
      if(c.respawns!==this.respawns[i]){
        this.respawns[i]=c.respawns;r.falls++;r.progress=r.anchorProgress;r.knockGrace=2;r.boost=0;this.stun[i]=.6;
      }
      if(c.grounded&&r.finish===null){
        const projected=this.course.project(this.point.set(c.x,c.y,c.z),r.progress,80);
        const nearJump=this.level.skateRace!.jumps.some(j=>Math.hypot(c.x-j.takeoff[0],c.z-j.takeoff[2])<38);
        if(!nearJump&&Math.abs(projected.offset)<10){
          r.anchor.set(c.x,c.y,c.z);r.anchorProgress=projected.s;Object.assign(world.spawns[i],{x:c.x,z:c.z,yaw:Math.atan2(-this.course.tangent(projected.s).x,-this.course.tangent(projected.s).z)});
        }
      }
      this.level.raceActorId=i;
      if(r.finish===null)for(const box of this.level.crates)if(box.alive&&Math.abs(box.mesh.position.y-c.y)<2.8&&Math.hypot(box.mesh.position.x-c.x,box.mesh.position.z-c.z)<2.15)this.level.breakCrate(box,true);
      if(i===0&&r.finish===null&&!this.level.runMode)for(const cp of this.level.checkpoints)if(Math.abs(cp.spawnPos.y-c.y)<3&&Math.hypot(cp.spawnPos.x-c.x,cp.spawnPos.z-c.z)<10){r.boxes.add(cp);r.player.cratesBroken=r.boxes.size;if(!cp.active)this.level.activateCheckpoint(cp,r.player.cratesBroken);}
    }
    this.sync();
  }
  private sync(){
    for(const [i,c]of this.fleet.physics.carts.entries()){
      const p=this.racers[i].player;p.pos.set(c.x,c.y,c.z);p.grounded=c.grounded;p.state=c.grounded?'ride':'air';p.vVel=c.vy;
      p.applyRaceImpulse(this.point.set(-Math.sin(c.yaw),0,-Math.cos(c.yaw)),c.speed);p.group.visible=false;
    }
  }
  hit(id:number,origin?:THREE.Vector3){
    const c=this.fleet.physics.carts[id];if(!c)return;
    this.stun[id]=.8;const dx=c.x-(origin?.x??c.x-1),dz=c.z-(origin?.z??c.z),n=Math.hypot(dx,dz)||1;
    this.fleet.physics.kick(id,dx/n*5,dz/n*5,6);
  }
  present(alpha=1){
    const carts=this.fleet.physics.carts,poses=carts.map(c=>({x:c.x,y:c.y,z:c.z,yaw:c.yaw}));
    carts.forEach((c,i)=>{const p=this.previous[i],q=poses[i];c.x=THREE.MathUtils.lerp(p.x,q.x,alpha);c.y=THREE.MathUtils.lerp(p.y,q.y,alpha);c.z=THREE.MathUtils.lerp(p.z,q.z,alpha);c.yaw=p.yaw+Math.atan2(Math.sin(q.yaw-p.yaw),Math.cos(q.yaw-p.yaw))*alpha;});
    this.fleet.present(0);carts.forEach((c,i)=>Object.assign(c,poses[i]));
    this.racers.forEach(r=>r.player.group.visible=false);
  }
  dispose(){this.fleet.dispose();this.cache.clear();this.cells.clear();this.racers.forEach(r=>r.player.group.visible=true);}
}
