import * as THREE from 'three';
import type { Level, Crate } from '../level';
import type { Input } from '../input';
import type { Player } from '../player';
import { RaceCourse } from '../race/course';
import { RACE_ROSTER } from '../race/types';
import { GolfCartFleet, type FleetPose } from './fleet';
import { NO_CART_INPUT, type GroundSample, type CartInput } from './physics';
import { RallyControls } from './controls';
import { CartMayhemEffects } from './mayhemEffects';
import { puffs } from '../puffs';
import { sfx } from '../audio';
import { RallyDriver } from './rallyDriver';
import { CartInteractionActor, CART_INTERACTION_TIMING } from './interactionMotion';
import { CartBailMotion,CART_BAIL } from './bailMotion';
import { CartRaceAudio } from './raceAudio';
import { StadiumCrowd } from './stadiumCrowd';
import { CartMud } from './cartMud';
import { createStadiumBoundary } from './stadiumBoundary';
import { CART_FLAMES,initialFlameRecharge,sideFlameContact,type FlameBody } from './flameTactics';

interface Racer {
  id:number;player:Player;progress:number;anchor:THREE.Vector3;anchorProgress:number;
  finish:number|null;falls:number;recovery:number;boost:number;knockGrace:number;star:number;velocity:THREE.Vector3;boxes:Set<Crate>;
}
interface CartInteraction {kind:'exit'|'enter'|'steal';id:number;cart:number;victim:number;age:number;duration:number;side:number;actor:CartInteractionActor;passenger:CartInteractionActor|null;foot:THREE.Vector3;from:THREE.Vector3;victimFoot:THREE.Vector3;released:boolean;approach:number;path:THREE.Vector3[];pathLength:number;bail?:CartBailMotion}
const clamp=THREE.MathUtils.clamp;

/** The cart solver owns vehicle movement; ejected racers use the normal foot motor.
 * Ownership changes preserve the vehicle, damage, momentum and race progress. */
export class GolfCartRace {
  readonly fleet:GolfCartFleet;
  readonly crowd:StadiumCrowd|null;
  readonly mud:CartMud|null;
  readonly cartForRacer:number[]=[];
  readonly driverForCart:number[]=[];
  readonly burning:boolean[]=[];
  readonly stats={steals:0,ejections:0,wrecks:0,thrusters:0,exits:0,entries:0};
  private interactions:CartInteraction[]=[];
  private audio=new CartRaceAudio();
  private nativeDrivers:(RallyDriver|null)[]=[];
  private controls:RallyControls[]=[];
  private actionCooldown:number[]=[];
  private thrustCooldown:number[]=[];
  private thrustTime:number[]=[];
  private thrustHits:Set<number>[]=[];
  private locked:number[]=[];
  private spareTime:number[]=[];
  private loanWait:number[]=[];
  private footStill:number[]=[];private footLast:THREE.Vector3[]=[];private footJump:boolean[]=[];
  private homes:{x:number;z:number;yaw:number}[]=[];
  private effects:CartMayhemEffects;
  private jumpRanges:{a:number;b:number}[]=[];
  private notice='';private noticeTime=0;
  private previous:FleetPose[]=[];
  private renderPoses:FleetPose[]=[];
  private navigation:{x:number;y:number;z:number;s:number;height:number}[]=[];
  private takeRay=new THREE.Ray();private takeEnd=new THREE.Vector3();private takeHit=new THREE.Vector3();
  private footObstacles:{lo:number;hi:number;left:number;right:number}[]=[];
  private footWall=new THREE.Box3();
  private humanTarget=-1;private targetMarker=-1;private sampledInputs:Input[]=[];
  private respawns:number[]=[];
  private stun:number[]=[];
  private cache=new Map<string,GroundSample>();
  private cells=new Map<string,THREE.Object3D[]>();
  private emptyGround:THREE.Object3D[]=[];
  private ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,10000);
  private high=100;
  private point=new THREE.Vector3();
  constructor(private level:Level,private course:RaceCourse,private racers:readonly Racer[],private count:number,private attack:(id:number,origin:THREE.Vector3,power:number)=>void,seed=1){
    for(const mesh of level.groundMeshes)mesh.updateWorldMatrix(true,false);
    for(const mesh of level.groundMeshes){
      const box=new THREE.Box3().setFromObject(mesh);this.high=Math.max(this.high,box.max.y+20);
      for(let x=Math.floor(box.min.x/16);x<=Math.floor(box.max.x/16);x++)for(let z=Math.floor(box.min.z/16);z<=Math.floor(box.max.z/16);z++){
        const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(mesh);this.cells.set(key,cell);
      }
    }
    const spawns=racers.slice(0,count).map(r=>({x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)}));
    this.jumpRanges=level.skateRace!.jumps.map(j=>({a:course.project(new THREE.Vector3(...j.takeoff)).s,b:course.project(new THREE.Vector3(...j.landing)).s}));
    // A parked loaner before each dirt double keeps a wrecked field recoverable.
    // These are real colliding carts. Only abandoned loaners return to their bay.
    for(const jump of level.skateRace!.jumps){
      const at=course.project(new THREE.Vector3(...jump.takeoff)).s-62;
      const pos=[10,-10,6,-6].map(offset=>course.sample(at,offset)).find(p=>this.bayOutsideWalls(p.x,p.y,p.z))??course.sample(at,10),f=course.tangent(at);
      spawns.push({x:pos.x,z:pos.z,yaw:Math.atan2(-f.x,-f.z)});
    }
    this.homes=spawns.map(s=>({...s}));
    const obstacles=level.walls.filter(b=>b.max.y-b.min.y>1&&b.max.x-b.min.x<9&&b.max.z-b.min.z<9)
      .map((b,i)=>({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,radius:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2,height:b.max.y-b.min.y,id:`rally-barrier-${i}`}));
    this.footObstacles=obstacles.map(o=>{const at=course.project(new THREE.Vector3(o.x,0,o.z)),radius=o.radius*Math.SQRT2;return {lo:at.s-radius,hi:at.s+radius,left:at.offset-radius,right:at.offset+radius};});
    const stadium=level.groundMeshes.some(m=>m.name==='Packed stadium dirt');
    const sponsor=level.pickRoot.getObjectByName('Stadium sponsor hoarding') as THREE.Mesh|undefined;
    this.fleet=new GolfCartFleet({damageVisuals:true,sponsorTexture:(sponsor?.material as THREE.MeshStandardMaterial|undefined)?.map??undefined,ground:(x,z)=>this.ground(x,z),spawns,obstacles,
      onImpact:hit=>this.audio.impact(hit,this.racers[0].player.pos),onLanding:hit=>this.audio.landing(hit,this.racers[0].player.pos,this.cartForRacer[0]),
      physics:{boundary:stadium?createStadiumBoundary():undefined,scale:1.25,topSpeed:38,engine:23,speedLimit:44,maxLaunchVelocity:9,airRecoveryDelay:6,damageCapacity:16*.7,gravity:24,stableLandings:true}});
    this.mud=stadium?new CartMud(this.fleet.mudAmounts):null;if(this.mud)this.fleet.root.add(this.mud.root);
    this.crowd=stadium?new StadiumCrowd():null;if(this.crowd)this.fleet.root.add(this.crowd.root);
    this.fleet.models.forEach((m,i)=>{
      m.setPalette({paint:i<count?RACE_ROSTER[i].color:'#95ee65',cream:i===0?'#ef8058':'#f5e8ca'});
      this.driverForCart[i]=i<count?i:-1;this.burning[i]=false;this.locked[i]=0;this.spareTime[i]=0;
      this.fleet.setDriver(i,null);
    });
    this.thrustCooldown=initialFlameRecharge(count,seed);
    for(let i=0;i<count;i++){this.cartForRacer[i]=i;this.controls[i]=new RallyControls();this.actionCooldown[i]=0;this.thrustTime[i]=0;this.thrustHits[i]=new Set();this.loanWait[i]=0;this.footStill[i]=0;this.footLast[i]=racers[i].player.pos.clone();this.footJump[i]=false;}
    for(let i=0;i<count;i++)this.seatDriver(i,i);
    this.effects=new CartMayhemEffects(this.fleet);
    this.previous=this.fleet.physics.carts.map(c=>({x:c.x,y:c.y,z:c.z,yaw:c.yaw}));this.renderPoses=this.previous.map(p=>({...p}));this.respawns=spawns.map(()=>0);this.stun=spawns.map(()=>0);
    this.sync();
  }
  private seatDriver(id:number,index:number){
    const model=this.fleet.models[index],driver=new RallyDriver(this.racers[id].player,model,this.fleet.physics.scale);
    model.setDriver(driver)?.dispose();this.nativeDrivers[id]=driver;
  }
  groundCandidates(x:number,z:number):THREE.Object3D[]{return this.cells.get(`${Math.floor(x/16)},${Math.floor(z/16)}`)??this.emptyGround;}
  private probe(x:number,z:number):GroundSample {
    const key=`${x},${z}`,cached=this.cache.get(key);if(cached)return cached;
    this.ray.ray.origin.set(x,this.high,z);
    const hit=this.ray.intersectObjects(this.groundCandidates(x,z),false)
      .find(h=>h.face&&h.face.normal.y>.04&&!h.object.userData.lethal&&!h.object.userData.outOfBounds);
    const sand=hit?.object.name==='Sand trap'||!!hit?.object.userData.groundSpeedLimit;
    const sample={height:hit?.point.y??this.level.killY-10,grip:sand?.58:1,drag:sand?14:.08,safe:!!hit,supported:!!hit};
    if(this.cache.size>=100000)this.cache.clear();this.cache.set(key,sample);return sample;
  }
  ground(x:number,z:number):GroundSample {
    const a=Math.floor(x*2)/2,b=Math.floor(z*2)/2,tx=(x-a)*2,tz=(z-b)*2;
    const q=[this.probe(a,b),this.probe(a+.5,b),this.probe(a,b+.5),this.probe(a+.5,b+.5)];
    // Never interpolate a ramp lip down into the void.
    if(q.some(p=>!p.supported))return this.probe(x,z);
    return {...q[0],height:THREE.MathUtils.lerp(THREE.MathUtils.lerp(q[0].height,q[1].height,tx),THREE.MathUtils.lerp(q[2].height,q[3].height,tx),tz)};
  }
  isDriving(id:number){return (this.cartForRacer[id]??-1)>=0;}
  isAnimating(id:number){return this.interactions.some(a=>a.id===id||!a.released&&a.victim===id);}
  private reserved(index:number){return this.interactions.some(a=>a.cart===index);}
  private cartProgress(index:number){
    const c=this.fleet.physics.carts[index],saved=this.navigation[index];
    if(saved&&saved.x===c.x&&saved.y===c.y&&saved.z===c.z)return saved;
    const s=this.course.project(this.point.set(c.x,c.y,c.z)).s,height=this.course.sample(s,0,this.point).y;
    return this.navigation[index]={x:c.x,y:c.y,z:c.z,s,height};
  }
  private canTake(id:number,index:number,navigate=false){
    const c=this.fleet.physics.carts[index],p=this.racers[id].player,owner=this.driverForCart[index];
    if(this.isDriving(id)||this.isAnimating(id)||this.reserved(index)||c.health<=0||Math.abs(c.speed)>9||index===this.cartForRacer[id]||this.burning[index]||c.tumbling||this.locked[index]>0||owner>=0&&this.racers[owner].finish!==null)return false;
    // A nearby kart is useless if a rock seals the driver's doorway. Skip it
    // for both the target ring and AI navigation before committing an approach.
    const doorway=this.exitPoint(index,-1);this.point.copy(doorway).y+=.8;
    if(!this.ground(doorway.x,doorway.z).supported||this.level.walls.some(w=>w.containsPoint(this.point)))return false;
    if(navigate){
      const nav=this.cartProgress(index),progress=nav.s;
      const next=this.jumpRanges.find(j=>j.b>this.racers[id].progress+2);
      let previous:typeof next;for(const jump of this.jumpRanges){if(jump.b>this.racers[id].progress+2)break;previous=jump;}
      return (!next||progress<next.a-3)&&(!previous||progress>previous.b+3)&&Math.abs(c.y-nav.height)<5;
    }
    if(Math.abs(p.pos.y-c.y)>3)return false;
    const from=this.takeRay.origin.copy(p.pos);from.y+=.9;this.takeEnd.set(c.x,c.y+.9,c.z);const distance=from.distanceTo(this.takeEnd);
    this.takeRay.direction.copy(this.takeEnd).sub(from).normalize();
    return !this.level.walls.some(w=>this.takeRay.intersectBox(w,this.takeHit)&&this.takeHit.distanceToSquared(from)<distance*distance);
  }
  nearest(id:number,range=4.8){
    if(this.isDriving(id)||this.isAnimating(id))return -1;
    let found=-1,best=range*range;const p=this.racers[id].player;
    for(const [i,c]of this.fleet.physics.carts.entries()){
      const d=(c.x-p.pos.x)**2+(c.z-p.pos.z)**2;
      if(d<best&&this.canTake(id,i,range>5)){found=i;best=d;}
    }
    // A small preference band keeps the ring and Triangle prompt on one target in a crowd.
    if(id===0&&range===4.8){
      const old=this.humanTarget,c=this.fleet.physics.carts[old];
      if(old!==found&&c&&this.canTake(id,old)){const distance=Math.hypot(c.x-p.pos.x,c.z-p.pos.z);if(distance<range&&distance<Math.sqrt(best)+.75)found=old;}
      this.humanTarget=found;
    }
    return found;
  }
  private announce(message:string){this.notice=message;this.noticeTime=3.5;}
  /** Driving Triangle always exits. A separate on-foot press can take a seat. */
  interact(id:number):boolean {
    const r=this.racers[id];
    if(!r||r.finish!==null||r.recovery||r.player.skateCameraBailing||this.actionCooldown[id]>0||this.isAnimating(id))return false;
    if(this.isDriving(id))return this.beginInteraction(id,this.cartForRacer[id],'exit');
    if(!r.player.grounded)return false;
    const target=this.nearest(id);
    if(target<0){if(!id)this.announce('GET CLOSER TO A GREEN RING');return false;}
    return this.beginInteraction(id,target,this.driverForCart[target]>=0?'steal':'enter');
  }
  private exitPoint(index:number,side:number,back=.8){
    const c=this.fleet.physics.carts[index],at=new THREE.Vector3(c.x+Math.cos(c.yaw)*1.85*side+Math.sin(c.yaw)*back,c.y,c.z-Math.sin(c.yaw)*1.85*side+Math.cos(c.yaw)*back),g=this.ground(at.x,at.z);
    this.point.set(at.x,g.height+.8,at.z);
    if(g.supported&&Math.abs(g.height-c.y)<2&&!this.level.walls.some(w=>w.containsPoint(this.point)))at.y=g.height;
    return at;
  }
  private detachDriver(id:number,index:number){this.fleet.setDriver(index,null);this.nativeDrivers[id]=null;this.thrustTime[id]=0;this.controls[id].reset();}
  private beginInteraction(id:number,index:number,kind:CartInteraction['kind']){
    this.present(1);this.fleet.presentCart(index);
    const c=this.fleet.physics.carts[index],p=this.racers[id].player,victim=kind==='steal'?this.driverForCart[index]:-1;
    const choices=[-1,1].map(side=>({side,at:this.exitPoint(index,side)}));
    const safe=choices.filter(q=>this.ground(q.at.x,q.at.z).supported&&!this.level.walls.some(w=>w.containsPoint(q.at.clone().add(new THREE.Vector3(0,.8,0)))));
    const choice=kind==='exit'?(safe.length?safe:choices)[0]:safe.find(q=>q.side===-1);
    if(!choice){if(!id)this.announce('DRIVER SIDE IS BLOCKED');return false;}
    const path=[p.pos.clone()];
    if(kind!=='exit'){
      const dx=p.pos.x-c.x,dz=p.pos.z-c.z,localX=dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),localZ=dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw);
      if(localX>-.9){const back=localZ<-.6?-2.35:2.35;path.push(this.exitPoint(index,localX>0?1:-1,back),this.exitPoint(index,-1,back));}
      path.push(choice.at.clone());
    }
    let pathLength=0;for(let i=1;i<path.length;i++)pathLength+=path[i].distanceTo(path[i-1]);
    const approach=kind==='exit'||pathLength<.75?0:pathLength/4.2;
    if(kind==='exit')this.detachDriver(id,index);
    if(victim>=0)this.detachDriver(victim,index);
    const actor=new CartInteractionActor(p,this.fleet.root),passenger=victim>=0?new CartInteractionActor(this.racers[victim].player,this.fleet.root):null;
    const movingExit=kind==='exit'&&(Math.hypot(c.vx,c.vz)>=CART_BAIL.minSpeed||!c.grounded);
    const duration=movingExit?CART_BAIL.maxDuration:CART_INTERACTION_TIMING[kind]+approach;
    const action:CartInteraction={kind,id,cart:index,victim,age:0,duration,side:choice.side,actor,passenger,foot:choice.at,from:p.pos.clone(),victimFoot:this.exitPoint(index,choice.side,1.8),released:false,approach,path,pathLength};
    if(movingExit){
      actor.present('exit',0,this.fleet.models[index],choice.at,choice.side);actor.beginBail();
      action.bail=new CartBailMotion(actor.groundPosition,c,choice.side);
      // Release the seat at launch; a later wreck cannot pull the airborne racer back.
      this.cartForRacer[id]=-1;this.driverForCart[index]=-1;
    }
    this.interactions.push(action);
    this.locked[index]=duration+1.5;this.actionCooldown[id]=duration+.25;this.racers[id].knockGrace=duration+.5;
    if(victim>=0){this.actionCooldown[victim]=duration+.8;this.racers[victim].knockGrace=duration+.5;}
    this.presentInteractions(true);return true;
  }
  private putOnFoot(id:number,index:number,at:THREE.Vector3,thrown:boolean){
    const c=this.fleet.physics.carts[index],r=this.racers[id],p=r.player;
    this.cartForRacer[id]=-1;if(this.driverForCart[index]===id)this.driverForCart[index]=-1;
    const forward=new THREE.Vector3(-Math.sin(c.yaw),0,-Math.cos(c.yaw));
    p.resetRacePosition(this.level,at,forward,true);p.group.visible=true;p.applyRaceImpulse(forward,Math.min(10,Math.max(0,c.speed)));
    r.knockGrace=2.5;r.boost=0;this.actionCooldown[id]=.3;
    if(thrown){p.beginRaceStun(2.5,id%2?1:-1,true);this.stats.ejections++;this.actionCooldown[id]=1.1;}
    p.snapRenderInterpolation();
  }
  private cancelInteraction(a:CartInteraction){
    this.interactions=this.interactions.filter(other=>other!==a);a.actor.dispose();a.passenger?.dispose();
    for(const id of [a.id,...(a.victim>=0&&!a.released?[a.victim]:[])]){
      const index=this.cartForRacer[id];
      if(index>=0)this.seatDriver(id,index);
      else{const p=this.racers[id].player;p.resetRacePosition(this.level,p.pos.clone(),p.raceHeading,true);p.group.visible=true;}
      this.actionCooldown[id]=.3;
    }
  }
  private advanceInteractions(dt:number){
    if(!this.interactions.length)return;
    // Only active interactions need a fixed-step pose; ordinary driving remains render-interpolated.
    this.fleet.present(0);
    for(const a of [...this.interactions]){
      const c=this.fleet.physics.carts[a.cart];this.fleet.presentCart(a.cart);
      if(a.bail){
        const b=a.bail;a.age+=dt;const hit=b.step(dt,(x,z)=>this.ground(x,z),this.level.walls);
        if(hit){const gain=a.id===0?1:.3*Math.max(0,1-b.position.distanceTo(this.racers[0].player.pos)/55)**2;
          sfx.withGain(gain,()=>sfx.play('kartLanding',hit===1?.32:.16,hit===1?1.65:1.95),a.id?'race-rivals':'');
          puffs.burst('dust',b.position.x,b.position.y+.1,b.position.z,{count:hit===1?7:3,strength:hit===1?.65:.3});
        }
        this.presentInteraction(a,true);
        if(b.phase!=='done'&&a.age<a.duration&&b.position.y>this.level.killY)continue;
        a.actor.dispose();this.interactions=this.interactions.filter(other=>other!==a);this.putOnFoot(a.id,a.cart,b.position,false);
        const p=this.racers[a.id].player,speed=Math.hypot(b.velocity.x,b.velocity.z);
        if(speed>.01)p.applyRaceImpulse(this.point.copy(b.velocity).setY(0),Math.min(9,speed));
        if(!b.grounded){p.pos.copy(b.position);p.grounded=false;p.state='air';p.vVel=b.velocity.y;}
        p.snapRenderInterpolation();this.locked[a.cart]=Math.min(this.locked[a.cart],1.5);this.stats.exits++;continue;
      }
      if(this.burning[a.cart]||c.health<=0||c.tumbling){this.cancelInteraction(a);if(a.kind==='exit'&&c.tumbling&&c.health>0)this.exit(a.id,true);continue;}
      a.age=Math.min(a.duration,a.age+dt);const delta=this.exitPoint(a.cart,a.side).sub(a.foot);a.foot.add(delta);
      if(a.approach){for(let i=1;i<a.path.length;i++)a.path[i].add(delta);a.pathLength=0;for(let i=1;i<a.path.length;i++)a.pathLength+=a.path[i].distanceTo(a.path[i-1]);}
      a.victimFoot.copy(this.exitPoint(a.cart,a.side,1.8));
      this.presentInteraction(a,true);
      if(a.kind==='steal'&&!a.released&&a.age>=a.approach+CART_INTERACTION_TIMING.pull){
        a.passenger!.dispose();a.passenger=null;a.released=true;this.putOnFoot(a.victim,a.cart,a.victimFoot,true);
        sfx.withGain(a.id===0||a.victim===0?1:.15,()=>sfx.play('kartCrash',.28,1.15));
      }
      if(a.age<a.duration)continue;
      a.actor.dispose();this.interactions=this.interactions.filter(other=>other!==a);
      if(a.kind==='exit'){this.putOnFoot(a.id,a.cart,a.foot,false);this.stats.exits++;continue;}
      this.cartForRacer[a.id]=a.cart;this.driverForCart[a.cart]=a.id;this.locked[a.cart]=1.5;this.actionCooldown[a.id]=.35;
      const r=this.racers[a.id];r.player.resetRacePosition(this.level,new THREE.Vector3(c.x,c.y,c.z),new THREE.Vector3(-Math.sin(c.yaw),0,-Math.cos(c.yaw)));this.seatDriver(a.id,a.cart);this.stats.entries++;
      if(a.kind==='steal'){this.stats.steals++;if(!a.id)this.announce(`${RACE_ROSTER[a.victim].name}'S KART. YOUR PROBLEM NOW.`);else if(!a.victim)this.announce(`${RACE_ROSTER[a.id].name} STOLE YOUR KART!`);}
      else if(!a.id)this.announce(c.health<.5?'PRE-OWNED. MOSTLY FUNCTIONAL.':'COMPLIMENTARY GRAND THEFT GOLF');
    }
  }
  private presentInteraction(a:CartInteraction,updatePosition=false){
    if(a.bail){
      a.actor.presentBail(a.bail);
      if(updatePosition){const p=this.racers[a.id].player;p.pos.copy(a.bail.position);p.grounded=a.bail.grounded;p.state=p.grounded?'ride':'air';p.vVel=a.bail.velocity.y;}
      return;
    }
    const model=this.fleet.models[a.cart],age=Math.max(0,a.age-a.approach);
    if(a.age<a.approach){
      let distance=a.age/a.approach*a.pathLength;const at=a.path[0].clone();let from=a.path[0];
      for(let i=1;i<a.path.length;i++){const length=a.path[i].distanceTo(a.path[i-1]);from=a.path[i-1];if(distance<=length){at.lerpVectors(from,a.path[i],length?distance/length:1);break;}distance-=length;at.copy(a.path[i]);}
      if(at.distanceToSquared(from)<1e-8)from=at.clone().sub(a.path[1].clone().sub(at));
      const support=this.ground(at.x,at.z);if(support.supported)at.y=support.height;
      a.actor.present('run',a.age/a.approach,model,at,a.side,from,undefined,a.age);a.passenger?.present('yanked',0,model,a.victimFoot,a.side);
    }else if(a.kind==='steal'&&age<CART_INTERACTION_TIMING.pull){
      const t=age/CART_INTERACTION_TIMING.pull;a.passenger?.present('yanked',t,model,a.victimFoot,a.side);
      a.actor.present('pull',t,model,a.foot,a.side,a.approach?a.foot:a.from,a.passenger??undefined);
    }else{
      const t=a.kind==='steal'?(age-CART_INTERACTION_TIMING.pull)/(a.duration-a.approach-CART_INTERACTION_TIMING.pull):age/(a.duration-a.approach);
      // A nearby foot position approaches the step before climbing an empty kart.
      const at=a.kind==='enter'&&!a.approach?a.from.clone().lerp(a.foot,clamp(t*4,0,1)):a.foot;
      a.actor.present(a.kind==='exit'?'exit':'enter',t,model,at,a.side);
    }
    if(updatePosition){this.racers[a.id].player.pos.copy(a.actor.groundPosition);if(a.passenger)this.racers[a.victim].player.pos.copy(a.passenger.groundPosition);}
  }
  private presentInteractions(updatePosition=false){for(const a of this.interactions)this.presentInteraction(a,updatePosition);}
  private exit(id:number,thrown:boolean){
    const index=this.cartForRacer[id];if(index<0)return;
    const c=this.fleet.physics.carts[index],r=this.racers[id],p=r.player;
    if((Math.hypot(c.vx,c.vz)>=CART_BAIL.minSpeed||!c.grounded)&&this.beginInteraction(id,index,'exit')){if(thrown)this.stats.ejections++;return;}
    this.cartForRacer[id]=-1;this.driverForCart[index]=-1;this.fleet.setDriver(index,null);this.nativeDrivers[id]=null;this.thrustTime[id]=0;this.controls[id].reset();this.actionCooldown[id]=1.1;
    const forward=new THREE.Vector3(-Math.sin(c.yaw),0,-Math.cos(c.yaw));
    let at=new THREE.Vector3(c.x,c.y+.25,c.z);
    // Choose the supported side of the car; at a jump, preserve the real fall.
    for(const side of [1,-1]){
      const q=new THREE.Vector3(c.x+Math.cos(c.yaw)*3.0*side,c.y,c.z-Math.sin(c.yaw)*3.0*side),g=this.ground(q.x,q.z);
      if(g.supported&&Math.abs(g.height-c.y)<2&&!this.level.walls.some(w=>w.containsPoint(q.clone().setY(g.height+.8)))){at=q.setY(g.height+.15);break;}
    }
    p.resetRacePosition(this.level,at,forward,true);p.group.visible=true;
    p.applyRaceImpulse(forward,Math.min(10,Math.max(0,c.speed)));r.knockGrace=2.5;r.boost=0;
    if(thrown){p.beginRaceStun(5,id%2?1:-1,true);this.stats.ejections++;}
    p.snapRenderInterpolation();
  }
  private wreck(index:number){
    if(this.burning[index])return;
    const c=this.fleet.physics.carts[index],owner=this.driverForCart[index];
    for(const a of [...this.interactions])if(a.cart===index&&!a.bail)this.cancelInteraction(a);
    this.burning[index]=true;c.health=0;this.stats.wrecks++;
    this.fleet.models[index].setScorched(true);
    if(owner>=0){this.exit(owner,true);if(!owner)this.announce('KART TOAST! RUN. STEAL. REPEAT.');}
    puffs.burst('boomTnt',c.x,c.y+1,c.z,{strength:1.5,count:12});
    this.audio.explosion(c,this.racers[0].player.pos);
  }
  private flameBody(id:number):FlameBody {
    const c=this.fleet.physics.carts[this.cartForRacer[id]];
    if(c)return c;
    const r=this.racers[id],p=r.player.pos,v=r.velocity;
    return {x:p.x,y:p.y,z:p.z,vx:v.x,vy:v.y,vz:v.z};
  }
  private canFireFlames(id:number):boolean {
    const index=this.cartForRacer[id],c=this.fleet.physics.carts[index],r=this.racers[id];
    return !!c&&c.health>0&&!c.tumbling&&!this.burning[index]&&this.stun[index]===0&&
      this.thrustCooldown[id]===0&&!this.isAnimating(id)&&r.finish===null&&!r.recovery&&!r.player.skateCameraBailing;
  }
  private shouldFireFlames(id:number):boolean {
    if(!this.canFireFlames(id))return false;
    const source=this.fleet.physics.carts[this.cartForRacer[id]];
    for(const target of this.racers.slice(0,this.count)){
      if(target.id===id||target.finish!==null||target.recovery||target.star>0||this.isAnimating(target.id))continue;
      const contact=sideFlameContact(source,this.flameBody(target.id),CART_FLAMES.prediction);
      // Save the burst during post-hit protection. Shields can still be stripped.
      if(contact!==null&&target.knockGrace<=contact)return true;
    }
    return false;
  }
  private flameLane(id:number,normal:number):number {
    const r=this.racers[id],c=this.fleet.physics.carts[this.cartForRacer[id]];
    if(id===0||!c||!c.grounded||c.tumbling||Math.abs(c.speed)<5||this.thrustCooldown[id]>1.2||
      this.jumpRanges.some(j=>r.progress>j.a-24&&r.progress<j.b+14))return normal;
    let target:Racer|null=null,best=Infinity;
    for(const other of this.racers.slice(0,this.count)){
      const kart=this.fleet.physics.carts[this.cartForRacer[other.id]],gap=other.progress-r.progress;
      if(other.id===id||!kart||other.finish!==null||other.recovery||other.star>0||this.isAnimating(other.id)||
        Math.abs(kart.y-c.y)>2.5||gap<-8||gap>14||Math.hypot(kart.x-c.x,kart.z-c.z)>18)continue;
      const score=Math.abs(gap)+(gap<0?2:0);if(score<best){best=score;target=other;}
    }
    if(!target)return normal;
    const mine=this.course.project(r.player.pos,r.progress,40).offset;
    const theirs=this.course.project(target.player.pos,target.progress,40).offset;
    const side=Math.abs(mine-theirs)>.7?Math.sign(mine-theirs):(id<target.id?-1:1);
    // Draw alongside without ramming or abandoning the supported racing lane.
    return clamp(theirs+side*3.8,Math.max(-8.5,normal-2.5),Math.min(8.5,normal+2.5));
  }
  /** Walk around solid masses when the direct route to a replacement cart is
   * blocked. Back out to the entry corner before crossing to the open side. */
  private footDetour(from:THREE.Vector3,to:THREE.Vector3,progress:number){
    this.takeRay.origin.copy(from).y+=.8;this.takeEnd.copy(to).y+=.8;
    const distance=this.takeRay.origin.distanceTo(this.takeEnd);if(distance<.1)return;
    this.takeRay.direction.copy(this.takeEnd).sub(this.takeRay.origin).normalize();
    if(!this.level.walls.some(w=>this.takeRay.intersectBox(this.footWall.copy(w).expandByScalar(.6),this.takeHit)&&this.takeHit.distanceToSquared(this.takeRay.origin)<distance*distance))return;
    const target=this.course.project(to,progress,400),here=this.course.project(from,progress,40),dir=target.s>=progress?1:-1;
    const blocks=this.footObstacles.filter(b=>b.hi>=Math.min(progress,target.s)-1&&b.lo<=Math.max(progress,target.s)+1);if(!blocks.length)return;
    const left=Math.min(...blocks.map(b=>b.left))-1.2,right=Math.max(...blocks.map(b=>b.right))+1.2;
    const choices=[left,right].filter(offset=>Math.abs(offset)<15);if(!choices.length)return;
    choices.sort((a,b)=>(Math.abs(a-here.offset)+Math.abs(a-target.offset))-(Math.abs(b-here.offset)+Math.abs(b-target.offset)));
    const offset=choices[0],entry=dir>0?Math.min(...blocks.map(b=>b.lo)):Math.max(...blocks.map(b=>b.hi));
    const at=Math.abs(here.offset-offset)<.7?target.s:dir>0?Math.min(progress+2,entry-2):Math.max(progress-2,entry+2);
    this.course.sample(at,offset,to);
  }
  drive(id:number):Input {
    if(this.isAnimating(id))return {moveX:0,moveY:0} as Input;
    const r=this.racers[id],index=this.cartForRacer[id];
    if(index<0){
      const p=r.player,target=this.nearest(id,350),ahead=target>=0?new THREE.Vector3(this.fleet.physics.carts[target].x,p.pos.y,this.fleet.physics.carts[target].z):this.course.sample(r.progress+8);
      if(target<0){const gap=this.jumpRanges.find(j=>j.b>r.progress);if(gap)this.course.sample(Math.min(r.progress+8,gap.a-12),0,ahead);}
      if(target>=0&&p.pos.distanceTo(ahead)>20){
        const targetProgress=this.cartProgress(target).s;
        this.course.sample(r.progress+Math.sign(targetProgress-r.progress)*9,0,ahead);
      }
      if(r.progress>this.course.length-20)ahead.addScaledVector(this.course.tangent(this.course.length),25);
      this.footDetour(p.pos,ahead,r.progress);
      const dx=ahead.x-p.pos.x,dz=ahead.z-p.pos.z,n=Math.hypot(dx,dz)||1,basis=p.raceInputBasis(this.level),bn=Math.hypot(basis.x,basis.z)||1;
      const stuck=this.footStill[id]>1.1,jumpHeld=stuck&&this.fleet.physics.time%1.2<.55,jumpPressed=jumpHeld&&!this.footJump[id],jumpReleased=this.footJump[id]&&!jumpHeld;this.footJump[id]=jumpHeld;
      return {moveX:clamp((-basis.z*dx+basis.x*dz)/bn/n,-1,1),moveY:clamp((basis.x*dx+basis.z*dz)/bn/n,-1,1),grindPressed:this.nearest(id)>=0,
        jumpHeld,jumpPressed,jumpReleased,spinPressed:stuck&&p.grounded,itemPressed:false} as Input;
    }
    const c=this.fleet.physics.carts[index],look=clamp(Math.abs(c.speed)*.55,9,22);
    let offset=id===0?0:(id%2?1:-1)*(2.2+Math.floor(id/2)*1.1);
    offset=this.flameLane(id,offset);
    const ahead=this.course.sample(r.progress+look,offset);
    for(const obstacle of this.fleet.physics.obstacles)if(Math.hypot(ahead.x-obstacle.x,ahead.z-obstacle.z)<obstacle.radius+5){
      const side=this.course.project(new THREE.Vector3(obstacle.x,ahead.y,obstacle.z),r.progress,60).offset;
      offset=side>0?-3:3;this.course.sample(r.progress+look,offset,ahead);break;
    }
    if(r.progress>this.course.length-25)ahead.addScaledVector(this.course.tangent(this.course.length),40);
    const bearing=Math.atan2(-(ahead.x-c.x),-(ahead.z-c.z)),angle=Math.atan2(Math.sin(bearing-c.yaw),Math.cos(bearing-c.yaw));
    const desired=(id===0?34:31.5+(id%3)*.65)/(1+Math.abs(angle)*.65);
    const dx=ahead.x-c.x,dz=ahead.z-c.z,n=Math.hypot(dx,dz)||1,basis=r.player.raceInputBasis(this.level),bn=Math.hypot(basis.x,basis.z)||1;
    return {moveX:clamp((-basis.z*dx+basis.x*dz)/bn/n,-1,1),moveY:clamp((basis.x*dx+basis.z*dz)/bn/n,-1,1),grabHeld:c.speed>desired+2,
      grindPressed:false,spinPressed:this.shouldFireFlames(id),
      jumpHeld:true,jumpPressed:false,itemPressed:false} as Input;
  }
  inputFor(id:number):Input{return this.sampledInputs[id]??this.drive(id);}
  step(dt:number,input:Input){
    const world=this.fleet.physics;this.noticeTime=Math.max(0,this.noticeTime-dt);
    const samples=this.sampledInputs=this.racers.slice(0,this.count).map((_,i)=>i===0?input:this.drive(i));
    for(let i=0;i<this.count;i++){
      const rider=this.racers[i],foot=rider.player;
      if(this.isDriving(i)||this.isAnimating(i)||foot.pos.distanceToSquared(this.footLast[i])>1){this.footStill[i]=0;this.footLast[i].copy(foot.pos);}else this.footStill[i]+=dt;
      this.loanWait[i]=!this.isDriving(i)&&!this.isAnimating(i)&&(this.nearest(i,350)<0||i>0&&this.footStill[i]>4)?this.loanWait[i]+dt:0;
      if(this.loanWait[i]>2.5&&rider.finish===null){
        const reserve=world.carts.findIndex((c,index)=>index>=this.count&&this.driverForCart[index]<0&&!this.reserved(index)&&this.racers.slice(0,this.count).every(r=>(r.player.pos.x-c.x)**2+(r.player.pos.z-c.z)**2>900));
        const delivery=reserve>=0?this.loanerBay(rider.progress,reserve,this.footStill[i]>4):null;
        if(delivery){
          const {bay,heading}=delivery;
          const home={x:bay.x,z:bay.z,yaw:Math.atan2(-heading.x,-heading.z)};this.homes[reserve]=home;Object.assign(world.spawns[reserve],home);world.reset(reserve);this.fleet.mudAmounts[reserve]=0;this.burning[reserve]=false;this.fleet.models[reserve].setScorched(false);this.fleet.models[reserve].setPalette({paint:'#95ee65',cream:'#f5e8ca',cargo:'#f16a45'});this.previous[reserve]={...world.carts[reserve]};this.respawns[reserve]=0;this.loanWait[i]=0;
          if(i===0)this.announce('THE CLUB HAS SENT ANOTHER LOANER');
        }
      }
      if(!this.isDriving(i)&&!this.isAnimating(i)&&rider.finish===null&&foot.grounded&&foot.pos.y<this.course.sample(rider.progress).y-9){
        rider.falls++;rider.progress=rider.anchorProgress;foot.resetRacePosition(this.level,rider.anchor,this.course.tangent(rider.anchorProgress),true);rider.knockGrace=2;
      }
      this.actionCooldown[i]=Math.max(0,this.actionCooldown[i]-dt);this.thrustCooldown[i]=Math.max(0,this.thrustCooldown[i]-dt);this.thrustTime[i]=Math.max(0,this.thrustTime[i]-dt);
      if(samples[i].grindPressed)this.interact(i);
      const index=this.cartForRacer[i],r=this.racers[i];
      if(samples[i].spinPressed&&this.canFireFlames(i)){
        this.thrustCooldown[i]=CART_FLAMES.recharge;this.thrustTime[i]=CART_FLAMES.burst;this.stats.thrusters++;
        this.thrustHits[i].clear();this.audio.thrust(world.carts[index],index,this.racers[0].player.pos);
      }else if(i===0&&index>=0&&!this.isAnimating(i)&&samples[i].spinPressed&&this.thrustCooldown[i]>0){
        this.announce('FLAMES RECHARGING');this.noticeTime=Math.min(1.2,this.thrustCooldown[i]);
      }
      if(index>=0&&this.thrustTime[i]>0&&!this.burning[index]){
        const c=world.carts[index];
        // Side-facing flamethrowers damage neighbours. They exert no driving impulse.
        for(const victim of this.racers.slice(0,this.count))if(victim.id!==i&&!this.thrustHits[i].has(victim.id)){
          if(sideFlameContact(c,this.flameBody(victim.id))!==null){this.thrustHits[i].add(victim.id);this.attack(victim.id,r.player.pos,.14);}
        }
      }
    }
    const controls=samples.map((s,i)=>{const c=world.carts[this.cartForRacer[i]];return this.controls[i].sample(dt,s,c?{yaw:c.yaw,speed:c.speed,forward:this.racers[i].player.raceInputBasis(this.level)}:undefined);});
    for(const [index,c]of world.carts.entries()){
      Object.assign(this.previous[index],{x:c.x,y:c.y,z:c.z,yaw:c.yaw});this.locked[index]=Math.max(0,this.locked[index]-dt);this.stun[index]=Math.max(0,this.stun[index]-dt);
      const owner=this.driverForCart[index],r=owner>=0?this.racers[owner]:null;
      if(r&&!this.isAnimating(owner)&&r.player.pos.distanceToSquared(this.point.set(c.x,c.y,c.z))>36){
        Object.assign(world.spawns[index],{x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)});world.reset(index,false);
        r.progress=this.course.project(r.player.pos).s;r.anchor.copy(r.player.pos);r.anchorProgress=r.progress;this.respawns[index]=c.respawns;this.previous[index]={...c};
      }
    }
    this.fleet.update(dt,physics=>{
      for(const [index,c]of physics.carts.entries()){
        const owner=this.driverForCart[index],r=owner>=0?this.racers[owner]:null;
        let control:CartInput=owner>=0?controls[owner]:{...NO_CART_INPUT,brake:1};
        if(!r||this.reserved(index)||r.finish!==null||this.stun[index]>0||this.burning[index])control={...NO_CART_INPUT,brake:1};
        if(!this.burning[index]&&this.interactions.some(a=>a.cart===index&&a.bail))control={...NO_CART_INPUT};
        physics.inputs[index]=control;
        if(r&&!this.reserved(index)&&r.boost>0&&c.grounded&&r.finish===null&&!this.burning[index]){const gain=20/120;c.vx-=Math.sin(c.yaw)*gain;c.vz-=Math.cos(c.yaw)*gain;}
      }
    },false);
    for(const [index,c]of world.carts.entries()){
      if(c.health<=0)this.wreck(index);
      const owner=this.driverForCart[index],r=owner>=0?this.racers[owner]:null;
      if(c.y<this.level.killY||r&&c.y<r.anchor.y-30)world.reset(index,false);
      if(c.respawns!==this.respawns[index]){
        this.respawns[index]=c.respawns;this.previous[index]={...c};
        if(r){
          r.falls++;
          // A stopped, dented kart needs a proper run-up after missing a leap.
          const jump=this.jumpRanges.find(j=>r.anchorProgress>j.a-70&&r.anchorProgress<j.b+6);
          if(jump){
            r.anchorProgress=jump.a-70;this.course.sample(r.anchorProgress,0,r.anchor);r.anchor.y=this.ground(r.anchor.x,r.anchor.z).height;
            const heading=this.course.tangent(r.anchorProgress);Object.assign(world.spawns[index],{x:r.anchor.x,z:r.anchor.z,yaw:Math.atan2(-heading.x,-heading.z)});world.reset(index,false);this.respawns[index]=c.respawns;this.previous[index]={...c};
          }
          r.progress=r.anchorProgress;r.knockGrace=2;r.boost=0;this.stun[index]=.6;
        }
      }
      if(!r){
        // Loaners are replenished at their marked bay, never under a driver.
        const home=this.homes[index];
        this.spareTime[index]=index>=this.count&&(this.burning[index]||Math.hypot(c.x-home.x,c.z-home.z)>45)?this.spareTime[index]+dt:0;
        if(!this.reserved(index)&&this.spareTime[index]>18&&this.racers.slice(0,this.count).every(r=>(r.player.pos.x-c.x)**2+(r.player.pos.z-c.z)**2>324)&&this.clearBay(home.x,home.z,index)){
          Object.assign(world.spawns[index],home);world.reset(index);this.fleet.mudAmounts[index]=0;this.burning[index]=false;this.fleet.models[index].setScorched(false);this.fleet.models[index].setPalette({paint:'#95ee65',cream:'#f5e8ca',cargo:'#f16a45'});this.spareTime[index]=0;this.previous[index]={...c};this.respawns[index]=0;
        }
        continue;
      }
      if(c.grounded&&r.finish===null){
        const projected=this.course.project(this.point.set(c.x,c.y,c.z),r.progress,80);
        const nearJump=this.level.skateRace!.jumps.some(j=>Math.hypot(c.x-j.takeoff[0],c.z-j.takeoff[2])<38);
        if(!nearJump&&Math.abs(projected.offset)<10){r.anchor.set(c.x,c.y,c.z);r.anchorProgress=projected.s;Object.assign(world.spawns[index],{x:c.x,z:c.z,yaw:Math.atan2(-this.course.tangent(projected.s).x,-this.course.tangent(projected.s).z)});}
      }
      this.level.raceActorId=owner;
      if(r.finish===null)for(const box of this.level.crates)if(box.alive&&(!box.mystery||r.player.raceHooks?.canCollectItem?.()!==false)&&Math.abs(box.mesh.position.y-c.y)<2.8&&Math.hypot(box.mesh.position.x-c.x,box.mesh.position.z-c.z)<2.15)this.level.breakCrate(box,true);
    }
    this.advanceInteractions(dt);this.sync();this.targetMarker=this.nearest(0);this.effects.update(dt,this.burning);
    this.mud?.update(dt,world.carts,this.driverForCart,this.cartForRacer[0],this.racers[0].player.pos);
    this.updateAudio(dt);
  }
  /** Also runs on the grid/countdown, without advancing physics or recharge. */
  updateAudio(dt:number){this.audio.update(dt,this.fleet.physics,this.driverForCart,this.cartForRacer[0],this.burning,this.effects.burnAges,this.thrustTime,this.racers[0].player.pos);}
  private loanerBay(progress:number,reserve:number,near=false){
    const next=this.jumpRanges.find(j=>j.a>progress),at=next?Math.min(next.a-62,near?progress+16:Infinity):Math.min(this.course.length-12,progress+20);
    let minimum=4;for(const jump of this.jumpRanges){if(jump.b>progress)break;minimum=jump.b+8;}
    // A burning pile can block the usual parking bay. Search supported spaces
    // on this road segment, keeping the jump's acceleration runway intact.
    for(const back of [0,8,16,24,32])for(const offset of [10,-10,6,-6]){
      const s=at-back;if(s<minimum)continue;
      const bay=this.course.sample(s,offset),ground=this.ground(bay.x,bay.z);
      if(!ground.supported||!ground.safe||Math.abs(ground.height-bay.y)>5||!this.clearBay(bay.x,bay.z,reserve))continue;
      return {bay,heading:this.course.tangent(s)};
    }
    return null;
  }
  private bayOutsideWalls(x:number,y:number,z:number){
    return this.level.walls.every(w=>w.distanceToPoint(this.point.set(x,y+1,z))>2.8);
  }
  private clearBay(x:number,z:number,except:number){
    return this.bayOutsideWalls(x,this.ground(x,z).height,z)&&this.racers.slice(0,this.count).every(r=>(r.player.pos.x-x)**2+(r.player.pos.z-z)**2>64)&&
      this.fleet.physics.carts.every((c,i)=>i===except||(c.x-x)**2+(c.z-z)**2>16);
  }
  private sync(){
    for(let i=0;i<this.count;i++){
      const index=this.cartForRacer[i],p=this.racers[i].player;p.group.visible=index<0&&!this.isAnimating(i);if(index<0||this.isAnimating(i))continue;
      const c=this.fleet.physics.carts[index];p.pos.set(c.x,c.y,c.z);p.grounded=c.grounded;p.state=c.grounded?'ride':'air';p.vVel=c.vy;
      p.applyRaceImpulse(this.point.set(-Math.sin(c.yaw),0,-Math.cos(c.yaw)),c.speed);
    }
  }
  hit(id:number,origin?:THREE.Vector3,power=.24){
    const index=this.cartForRacer[id],c=this.fleet.physics.carts[index];if(!c||this.burning[index])return;
    this.stun[index]=.55;const dx=c.x-(origin?.x??c.x-1),dz=c.z-(origin?.z??c.z),n=Math.hypot(dx,dz)||1;
    this.fleet.physics.kick(index,dx/n*9,dz/n*9,12);c.health=Math.max(0,c.health-power*(.5/.7));c.vy=Math.max(c.vy,4.5+power*8);c.grounded=false;
    if(c.health<=0)this.wreck(index);
  }
  hud(){
    const index=this.cartForRacer[0],target=this.nearest(0),near=target>=0?target:index<0?this.nearest(0,250):-1;
    const owner=near>=0?this.driverForCart[near]:-1,c=near>=0?this.fleet.physics.carts[near]:null;
    const action=this.interactions.find(a=>a.id===0||!a.released&&a.victim===0);
    return {onFoot:index<0,actionReady:!action&&this.actionCooldown[0]===0,
      bearing:c?Math.atan2(-(c.x-this.racers[0].player.pos.x),-(c.z-this.racers[0].player.pos.z))-Math.atan2(-this.racers[0].player.raceHeading.x,-this.racers[0].player.raceHeading.z):null,
      target:action?(action.id!==0?'YANKED OUT!':action.kind==='exit'?'GETTING OUT':action.age<action.approach?'GOING TO DRIVER SIDE':action.kind==='steal'&&!action.released?'PULLING DRIVER OUT':'GETTING IN'):target>=0?(owner>=0?`STEAL ${RACE_ROSTER[owner].name}'S KART`:'TAKE KART'):index>=0?'BAIL OUT':near>=0?(owner>=0?`${RACE_ROSTER[owner].name}'S KART`:'GREEN LOANER'):'LOANER ON THE WAY',
      distance:c?Math.round(Math.hypot(c.x-this.racers[0].player.pos.x,c.z-this.racers[0].player.pos.z)):null,notice:this.noticeTime>0?this.notice:''};
  }
  updateView(camera:THREE.Camera){this.fleet.updateView(camera);this.effects.present(this.burning,this.targetMarker,this.driverForCart,this.thrustTime);}
  present(alpha=1){
    this.crowd?.update(this.fleet.physics.time);
    const carts=this.fleet.physics.carts;alpha=clamp(alpha,0,1);
    for(let i=0;i<carts.length;i++){
      const owner=this.driverForCart[i];
      this.fleet.models[i].setFlameReady(owner>=0&&!this.burning[i]&&this.thrustCooldown[owner]===0);
      const p=this.previous[i],q=carts[i],pose=this.renderPoses[i];
      pose.x=THREE.MathUtils.lerp(p.x,q.x,alpha);pose.y=THREE.MathUtils.lerp(p.y,q.y,alpha);pose.z=THREE.MathUtils.lerp(p.z,q.z,alpha);
      pose.yaw=p.yaw+Math.atan2(Math.sin(q.yaw-p.yaw),Math.cos(q.yaw-p.yaw))*alpha;
    }
    this.fleet.present(0,this.renderPoses);this.effects.present(this.burning,this.targetMarker,this.driverForCart,this.thrustTime);
    this.presentInteractions();
    for(let i=0;i<this.count;i++)this.racers[i].player.group.visible=!this.isDriving(i)&&!this.isAnimating(i);
  }
  dispose(){for(const a of this.interactions){a.actor.dispose();a.passenger?.dispose();}this.interactions.length=0;this.crowd?.dispose();this.mud?.dispose();this.audio.dispose();this.effects.dispose();this.fleet.dispose();this.cache.clear();this.cells.clear();this.racers.forEach(r=>r.player.group.visible=true);}
}
