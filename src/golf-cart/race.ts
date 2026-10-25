import * as THREE from 'three';
import type { Level, Crate, Checkpoint } from '../level';
import type { Input } from '../input';
import type { Player } from '../player';
import { RaceCourse } from '../race/course';
import { RACE_ROSTER } from '../race/types';
import { GolfCartFleet } from './fleet';
import { NO_CART_INPUT, type GroundSample, type CartInput } from './physics';
import { RallyControls } from './controls';
import { CartMayhemEffects } from './mayhemEffects';
import { puffs } from '../puffs';
import { sfx } from '../audio';

interface Racer {
  id:number;player:Player;progress:number;anchor:THREE.Vector3;anchorProgress:number;
  finish:number|null;falls:number;recovery:number;boost:number;knockGrace:number;boxes:Set<Crate|Checkpoint>;
}
const clamp=THREE.MathUtils.clamp;

/** The existing cart solver owns all eight vehicles. Players are camera/HUD
 * adapters only; neither AI nor the race clock moves a vehicle along a spline. */
export class GolfCartRace {
  readonly fleet:GolfCartFleet;
  readonly cartForRacer:number[]=[];
  readonly driverForCart:number[]=[];
  readonly burning:boolean[]=[];
  readonly stats={steals:0,ejections:0,wrecks:0,spins:0};
  private racerStyles:GolfCartFleet['driverStyles']=[];
  private controls:RallyControls[]=[];
  private actionCooldown:number[]=[];
  private spinCooldown:number[]=[];
  private spinTime:number[]=[];
  private locked:number[]=[];
  private spareTime:number[]=[];
  private loanWait:number[]=[];
  private homes:{x:number;z:number;yaw:number}[]=[];
  private effects:CartMayhemEffects;
  private jumpRanges:{a:number;b:number}[]=[];
  private notice='';private noticeTime=0;
  private previous:{x:number;y:number;z:number;yaw:number}[]=[];
  private respawns:number[]=[];
  private stun:number[]=[];
  private cache=new Map<string,GroundSample>();
  private cells=new Map<string,THREE.Object3D[]>();
  private ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,10000);
  private high=100;
  private point=new THREE.Vector3();
  constructor(private level:Level,private course:RaceCourse,private racers:readonly Racer[],private count:number,private attack:(id:number,origin:THREE.Vector3,power:number)=>void){
    for(const mesh of level.groundMeshes)mesh.updateWorldMatrix(true,false);
    for(const mesh of level.groundMeshes){
      const box=new THREE.Box3().setFromObject(mesh);this.high=Math.max(this.high,box.max.y+20);
      for(let x=Math.floor(box.min.x/16);x<=Math.floor(box.max.x/16);x++)for(let z=Math.floor(box.min.z/16);z<=Math.floor(box.max.z/16);z++){
        const key=`${x},${z}`,cell=this.cells.get(key)??[];cell.push(mesh);this.cells.set(key,cell);
      }
    }
    const spawns=racers.slice(0,count).map(r=>({x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)}));
    this.jumpRanges=level.skateRace!.jumps.map(j=>({a:course.project(new THREE.Vector3(...j.takeoff)).s,b:course.project(new THREE.Vector3(...j.landing)).s}));
    // A parked loaner before each sea jump keeps a wrecked field recoverable.
    // These are real colliding carts. Only abandoned loaners return to their bay.
    for(const jump of level.skateRace!.jumps){
      const at=course.project(new THREE.Vector3(...jump.takeoff)).s-62;
      const pos=course.sample(at,10),f=course.tangent(at);
      spawns.push({x:pos.x,z:pos.z,yaw:Math.atan2(-f.x,-f.z)});
    }
    this.homes=spawns.map(s=>({...s}));
    const obstacles=level.walls.filter(b=>b.max.y-b.min.y>1&&b.max.x-b.min.x<9&&b.max.z-b.min.z<9)
      .map((b,i)=>({x:(b.min.x+b.max.x)/2,z:(b.min.z+b.max.z)/2,radius:Math.max(b.max.x-b.min.x,b.max.z-b.min.z)/2,height:b.max.y-b.min.y,id:`rally-barrier-${i}`}));
    this.fleet=new GolfCartFleet({ground:(x,z)=>this.ground(x,z),spawns,obstacles,
      physics:{topSpeed:38,engine:23,speedLimit:44,maxLaunchVelocity:17,airRecoveryDelay:6,damageCapacity:8}});
    this.racerStyles=[...this.fleet.driverStyles];
    this.fleet.models.forEach((m,i)=>{
      m.setPalette({paint:i<count?RACE_ROSTER[i].color:'#95ee65',cream:i===0?'#ef8058':'#f5e8ca'});
      this.driverForCart[i]=i<count?i:-1;this.burning[i]=false;this.locked[i]=0;this.spareTime[i]=0;
      if(i>=count)this.fleet.setDriver(i,null);
    });
    for(let i=0;i<count;i++){this.cartForRacer[i]=i;this.controls[i]=new RallyControls();this.actionCooldown[i]=0;this.spinCooldown[i]=0;this.spinTime[i]=0;this.loanWait[i]=0;}
    this.effects=new CartMayhemEffects(this.fleet);
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
  isDriving(id:number){return (this.cartForRacer[id]??-1)>=0;}
  private canTake(id:number,index:number,navigate=false){
    const c=this.fleet.physics.carts[index],p=this.racers[id].player,owner=this.driverForCart[index];
    if(index===this.cartForRacer[id]||this.burning[index]||c.tumbling||this.locked[index]>0||owner>=0&&this.racers[owner].finish!==null)return false;
    if(navigate){
      const progress=this.course.project(new THREE.Vector3(c.x,c.y,c.z)).s;
      const next=this.jumpRanges.find(j=>j.b>this.racers[id].progress+2);
      const previous=this.jumpRanges.filter(j=>j.b<=this.racers[id].progress+2).slice(-1)[0];
      return (!next||progress<next.a-3)&&(!previous||progress>previous.b+3)&&Math.abs(c.y-this.course.sample(progress).y)<5;
    }
    if(Math.abs(p.pos.y-c.y)>3)return false;
    const from=p.pos.clone().setY(p.pos.y+.9),to=new THREE.Vector3(c.x,c.y+.9,c.z),distance=from.distanceTo(to);
    const ray=new THREE.Ray(from,to.sub(from).normalize()),hit=new THREE.Vector3();
    return !this.level.walls.some(w=>ray.intersectBox(w,hit)&&hit.distanceTo(from)<distance);
  }
  nearest(id:number,range=4.8){
    let found=-1,best=range*range;const p=this.racers[id].player;
    for(const [i,c]of this.fleet.physics.carts.entries()){
      const d=(c.x-p.pos.x)**2+(c.z-p.pos.z)**2;
      if(d<best&&this.canTake(id,i,range>5)){found=i;best=d;}
    }
    return found;
  }
  private announce(message:string){this.notice=message;this.noticeTime=3.5;}
  /** One owner per cart; theft carries that cart's damage and momentum with it. */
  interact(id:number):boolean {
    const r=this.racers[id];
    if(!r||r.finish!==null||r.recovery||r.player.skateCameraBailing||this.actionCooldown[id]>0)return false;
    const target=this.nearest(id);
    if(target<0){if(this.isDriving(id)){this.exit(id,false);if(!id)this.announce('BAILED OUT!');return true;}if(!id)this.announce('GET CLOSER TO A GREEN RING');return false;}
    const previous=this.driverForCart[target];
    if(this.isDriving(id))this.exit(id,false);
    if(previous>=0)this.exit(previous,true);
    this.cartForRacer[id]=target;this.driverForCart[target]=id;this.locked[target]=3;this.actionCooldown[id]=1.2;this.controls[id].reset();
    this.fleet.setDriver(target,this.racerStyles[id]);
    r.knockGrace=1.4;r.player.group.visible=false;
    const c=this.fleet.physics.carts[target];
    r.player.resetRacePosition(this.level,new THREE.Vector3(c.x,c.y,c.z),new THREE.Vector3(-Math.sin(c.yaw),0,-Math.cos(c.yaw)));
    this.sync();
    if(previous>=0){this.stats.steals++;if(!id)this.announce(`${RACE_ROSTER[previous].name}'S KART. YOUR PROBLEM NOW.`);else if(!previous)this.announce(`${RACE_ROSTER[id].name} STOLE YOUR KART!`);}
    else if(!id)this.announce(c.health<.5?'PRE-OWNED. MOSTLY FUNCTIONAL.':'COMPLIMENTARY GRAND THEFT GOLF');
    sfx.withGain(id===0||previous===0?1:.15,()=>sfx.play('railLand',.6,1.3));return true;
  }
  private exit(id:number,thrown:boolean){
    const index=this.cartForRacer[id];if(index<0)return;
    const c=this.fleet.physics.carts[index],r=this.racers[id],p=r.player;
    this.cartForRacer[id]=-1;this.driverForCart[index]=-1;this.fleet.setDriver(index,null);this.controls[id].reset();this.actionCooldown[id]=1.1;
    const forward=new THREE.Vector3(-Math.sin(c.yaw),0,-Math.cos(c.yaw));
    let at=new THREE.Vector3(c.x,c.y+.25,c.z);
    // Choose the supported side of the car; at a jump, preserve the real fall.
    for(const side of [1,-1]){
      const q=new THREE.Vector3(c.x+Math.cos(c.yaw)*2.4*side,c.y,c.z-Math.sin(c.yaw)*2.4*side),g=this.ground(q.x,q.z);
      if(g.supported&&Math.abs(g.height-c.y)<2&&!this.level.walls.some(w=>w.containsPoint(q.clone().setY(g.height+.8)))){at=q.setY(g.height+.15);break;}
    }
    p.resetRacePosition(this.level,at,forward,true);p.group.visible=true;
    p.applyRaceImpulse(forward,Math.min(10,Math.max(0,c.speed)));r.knockGrace=2.5;r.boost=0;
    if(thrown){p.beginRaceStun(5,id%2?1:-1);this.stats.ejections++;}
    p.snapRenderInterpolation();
  }
  private wreck(index:number){
    if(this.burning[index])return;
    const c=this.fleet.physics.carts[index],owner=this.driverForCart[index];
    this.burning[index]=true;c.health=0;this.stats.wrecks++;
    this.fleet.models[index].setPalette({paint:'#493a32',cream:'#736657',cargo:'#5e4939'});
    if(owner>=0){this.exit(owner,true);if(!owner)this.announce('KART TOAST! RUN. STEAL. REPEAT.');}
    puffs.burst('boomTnt',c.x,c.y+1,c.z,{strength:1.5,count:12});
    sfx.withGain(Math.max(.05,1-this.racers[0].player.pos.distanceTo(new THREE.Vector3(c.x,c.y,c.z))/65),()=>sfx.play('tntBoom',.7,.7));
  }
  drive(id:number):Input {
    const r=this.racers[id],index=this.cartForRacer[id];
    if(index<0){
      const p=r.player,target=this.nearest(id,350),ahead=target>=0?new THREE.Vector3(this.fleet.physics.carts[target].x,p.pos.y,this.fleet.physics.carts[target].z):this.course.sample(r.progress+8);
      if(target<0){const gap=this.jumpRanges.find(j=>j.b>r.progress);if(gap)this.course.sample(Math.min(r.progress+8,gap.a-12),0,ahead);}
      if(target>=0&&p.pos.distanceTo(ahead)>20){
        const targetProgress=this.course.project(ahead).s;
        this.course.sample(r.progress+Math.sign(targetProgress-r.progress)*9,0,ahead);
      }
      if(r.progress>this.course.length-20)ahead.addScaledVector(this.course.tangent(this.course.length),25);
      const dx=ahead.x-p.pos.x,dz=ahead.z-p.pos.z,n=Math.hypot(dx,dz)||1,basis=p.raceInputBasis(this.level),bn=Math.hypot(basis.x,basis.z)||1;
      return {moveX:clamp((-basis.z*dx+basis.x*dz)/bn/n,-1,1),moveY:clamp((basis.x*dx+basis.z*dz)/bn/n,-1,1),grindPressed:this.nearest(id)>=0,
        jumpHeld:false,jumpPressed:false,spinPressed:false,itemPressed:false} as Input;
    }
    const c=this.fleet.physics.carts[index],look=clamp(Math.abs(c.speed)*.55,9,22);
    let offset=id===0?0:(id%2?1:-1)*(2.2+Math.floor(id/2)*1.1);
    const ahead=this.course.sample(r.progress+look,offset);
    for(const obstacle of this.fleet.physics.obstacles)if(Math.hypot(ahead.x-obstacle.x,ahead.z-obstacle.z)<obstacle.radius+5){
      const side=this.course.project(new THREE.Vector3(obstacle.x,ahead.y,obstacle.z),r.progress,60).offset;
      offset=side>0?-3:3;this.course.sample(r.progress+look,offset,ahead);break;
    }
    if(r.progress>this.course.length-25)ahead.addScaledVector(this.course.tangent(this.course.length),40);
    const bearing=Math.atan2(-(ahead.x-c.x),-(ahead.z-c.z)),angle=Math.atan2(Math.sin(bearing-c.yaw),Math.cos(bearing-c.yaw));
    const desired=(id===0?34:31.5+(id%3)*.65)/(1+Math.abs(angle)*.65),target=this.nearest(id);
    return {moveX:-clamp(angle*1.9,-1,1),moveY:clamp((desired-c.speed)*.24+.2,0,1),grabHeld:c.speed>desired+2,
      grindPressed:c.health<.35&&target>=0&&this.fleet.physics.carts[target].health>c.health+.2,
      jumpHeld:false,jumpPressed:false,itemPressed:false} as Input;
  }
  step(dt:number,input:Input){
    const world=this.fleet.physics;this.noticeTime=Math.max(0,this.noticeTime-dt);
    const samples=this.racers.slice(0,this.count).map((_,i)=>i===0?input:this.drive(i));
    for(let i=0;i<this.count;i++){
      const rider=this.racers[i],foot=rider.player;
      this.loanWait[i]=!this.isDriving(i)&&this.nearest(i,350)<0?this.loanWait[i]+dt:0;
      if(this.loanWait[i]>2.5&&rider.finish===null){
        const next=this.jumpRanges.find(j=>j.a>rider.progress),at=next?next.a-62:rider.progress+12;
        const bay=this.course.sample(at,10),heading=this.course.tangent(at);
        const reserve=world.carts.findIndex((c,index)=>index>=this.count&&this.driverForCart[index]<0&&this.racers.slice(0,this.count).every(r=>r.player.pos.distanceTo(new THREE.Vector3(c.x,c.y,c.z))>30));
        if(reserve>=0&&this.ground(bay.x,bay.z).supported){
          const home={x:bay.x,z:bay.z,yaw:Math.atan2(-heading.x,-heading.z)};this.homes[reserve]=home;Object.assign(world.spawns[reserve],home);world.reset(reserve);this.burning[reserve]=false;this.fleet.models[reserve].setPalette({paint:'#95ee65',cream:'#f5e8ca',cargo:'#f16a45'});this.previous[reserve]={...world.carts[reserve]};this.respawns[reserve]=0;this.loanWait[i]=0;
          if(i===0)this.announce('THE CLUB HAS SENT ANOTHER LOANER');
        }
      }
      if(!this.isDriving(i)&&rider.finish===null&&foot.grounded&&foot.pos.y<this.course.sample(rider.progress).y-9){
        rider.falls++;rider.progress=rider.anchorProgress;foot.resetRacePosition(this.level,rider.anchor,this.course.tangent(rider.anchorProgress),true);rider.knockGrace=2;
      }
      this.actionCooldown[i]=Math.max(0,this.actionCooldown[i]-dt);this.spinCooldown[i]=Math.max(0,this.spinCooldown[i]-dt);this.spinTime[i]=Math.max(0,this.spinTime[i]-dt);
      if(samples[i].grindPressed)this.interact(i);
      const index=this.cartForRacer[i],r=this.racers[i];
      if(index>=0&&samples[i].spinPressed&&this.spinCooldown[i]===0&&r.finish===null){
        this.spinCooldown[i]=1.8;this.spinTime[i]=.5;this.stats.spins++;
        puffs.burst('dustLandHeavy',r.player.pos.x,r.player.pos.y+.2,r.player.pos.z,{strength:2,count:8});
        for(const victim of this.racers.slice(0,this.count))if(victim.id!==i&&victim.player.pos.distanceTo(r.player.pos)<5.5)this.attack(victim.id,r.player.pos,.14);
        sfx.withGain(i===0?1:.12,()=>sfx.play('woosh2',.6,.6));
      }
    }
    const controls=samples.map((s,i)=>this.controls[i].sample(dt,s));
    for(const [index,c]of world.carts.entries()){
      this.previous[index]={x:c.x,y:c.y,z:c.z,yaw:c.yaw};this.locked[index]=Math.max(0,this.locked[index]-dt);this.stun[index]=Math.max(0,this.stun[index]-dt);
      const owner=this.driverForCart[index],r=owner>=0?this.racers[owner]:null;
      if(r&&r.player.pos.distanceToSquared(this.point.set(c.x,c.y,c.z))>36){
        Object.assign(world.spawns[index],{x:r.player.pos.x,z:r.player.pos.z,yaw:Math.atan2(-r.player.raceHeading.x,-r.player.raceHeading.z)});world.reset(index,false);
        r.progress=this.course.project(r.player.pos).s;r.anchor.copy(r.player.pos);r.anchorProgress=r.progress;this.respawns[index]=c.respawns;this.previous[index]={...c};
      }
    }
    this.fleet.update(dt,physics=>{
      for(const [index,c]of physics.carts.entries()){
        const owner=this.driverForCart[index],r=owner>=0?this.racers[owner]:null;
        let control:CartInput=owner>=0?controls[owner]:{...NO_CART_INPUT,brake:1};
        if(!r||r.finish!==null||this.stun[index]>0||this.burning[index])control={...NO_CART_INPUT,brake:1};
        physics.inputs[index]=control;
        if(r&&r.boost>0&&c.grounded&&r.finish===null&&!this.burning[index]){const gain=20/120;c.vx-=Math.sin(c.yaw)*gain;c.vz-=Math.cos(c.yaw)*gain;}
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
        if(this.spareTime[index]>18&&this.racers.slice(0,this.count).every(r=>r.player.pos.distanceTo(new THREE.Vector3(c.x,c.y,c.z))>18&&Math.hypot(r.player.pos.x-home.x,r.player.pos.z-home.z)>8)){
          Object.assign(world.spawns[index],home);world.reset(index);this.burning[index]=false;this.fleet.models[index].setPalette({paint:'#95ee65',cream:'#f5e8ca',cargo:'#f16a45'});this.spareTime[index]=0;this.previous[index]={...c};this.respawns[index]=0;
        }
        continue;
      }
      if(c.grounded&&r.finish===null){
        const projected=this.course.project(this.point.set(c.x,c.y,c.z),r.progress,80);
        const nearJump=this.level.skateRace!.jumps.some(j=>Math.hypot(c.x-j.takeoff[0],c.z-j.takeoff[2])<38);
        if(!nearJump&&Math.abs(projected.offset)<10){r.anchor.set(c.x,c.y,c.z);r.anchorProgress=projected.s;Object.assign(world.spawns[index],{x:c.x,z:c.z,yaw:Math.atan2(-this.course.tangent(projected.s).x,-this.course.tangent(projected.s).z)});}
      }
      this.level.raceActorId=owner;
      if(r.finish===null)for(const box of this.level.crates)if(box.alive&&Math.abs(box.mesh.position.y-c.y)<2.8&&Math.hypot(box.mesh.position.x-c.x,box.mesh.position.z-c.z)<2.15)this.level.breakCrate(box,true);
      if(owner===0&&r.finish===null&&!this.level.runMode)for(const cp of this.level.checkpoints)if(Math.abs(cp.spawnPos.y-c.y)<3&&Math.hypot(cp.spawnPos.x-c.x,cp.spawnPos.z-c.z)<10){r.boxes.add(cp);r.player.cratesBroken=r.boxes.size;if(!cp.active)this.level.activateCheckpoint(cp,r.player.cratesBroken);}
    }
    this.sync();this.effects.update(dt,this.burning,this.nearest(0));
  }
  private sync(){
    for(let i=0;i<this.count;i++){
      const index=this.cartForRacer[i],p=this.racers[i].player;p.group.visible=index<0;if(index<0)continue;
      const c=this.fleet.physics.carts[index];p.pos.set(c.x,c.y,c.z);p.grounded=c.grounded;p.state=c.grounded?'ride':'air';p.vVel=c.vy;
      p.applyRaceImpulse(this.point.set(-Math.sin(c.yaw),0,-Math.cos(c.yaw)),c.speed);
    }
  }
  hit(id:number,origin?:THREE.Vector3,power=.24){
    const index=this.cartForRacer[id],c=this.fleet.physics.carts[index];if(!c||this.burning[index])return;
    this.stun[index]=.55;const dx=c.x-(origin?.x??c.x-1),dz=c.z-(origin?.z??c.z),n=Math.hypot(dx,dz)||1;
    this.fleet.physics.kick(index,dx/n*9,dz/n*9,12);c.health=Math.max(0,c.health-power);c.vy=Math.max(c.vy,4.5+power*8);c.grounded=false;
    if(c.health<=0)this.wreck(index);
  }
  hud(){
    const index=this.cartForRacer[0],target=this.nearest(0),near=target>=0?target:index<0?this.nearest(0,250):-1;
    const owner=near>=0?this.driverForCart[near]:-1,c=near>=0?this.fleet.physics.carts[near]:null;
    return {health:index>=0?this.fleet.physics.carts[index].health:null,onFoot:index<0,charge:this.controls[0].charge,spinReady:this.spinCooldown[0]===0,
      target:target>=0?(owner>=0?`STEAL ${RACE_ROSTER[owner].name}'S KART`:'TAKE KART'):index>=0?'BAIL OUT':near>=0?'LOANER / RIVAL KART':'FIND A KART',
      distance:c?Math.round(Math.hypot(c.x-this.racers[0].player.pos.x,c.z-this.racers[0].player.pos.z)):null,notice:this.noticeTime>0?this.notice:''};
  }
  present(alpha=1){
    const carts=this.fleet.physics.carts,poses=carts.map(c=>({x:c.x,y:c.y,z:c.z,yaw:c.yaw}));
    carts.forEach((c,i)=>{const p=this.previous[i],q=poses[i],owner=this.driverForCart[i];c.x=THREE.MathUtils.lerp(p.x,q.x,alpha);c.y=THREE.MathUtils.lerp(p.y,q.y,alpha);c.z=THREE.MathUtils.lerp(p.z,q.z,alpha);c.yaw=p.yaw+Math.atan2(Math.sin(q.yaw-p.yaw),Math.cos(q.yaw-p.yaw))*alpha+(owner>=0&&this.spinTime[owner]>0?Math.PI*2*(1-this.spinTime[owner]/.5):0);});
    this.fleet.present(0);carts.forEach((c,i)=>Object.assign(c,poses[i]));
    for(let i=0;i<this.count;i++)this.racers[i].player.group.visible=!this.isDriving(i);
  }
  dispose(){this.effects.dispose();this.fleet.dispose();this.cache.clear();this.cells.clear();this.racers.forEach(r=>r.player.group.visible=true);}
}
