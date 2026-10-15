import { CONST, TUNING } from '../tuning';
import { medalForTime } from '../campaign';
import * as THREE from 'three';
import { Player } from '../player';
import { sfx } from '../audio';
import { createRaceItemModel, disposeRaceItemModel } from './items';
import type { Input } from '../input';
import type { Crate, Level } from '../level';
import type { WipeoutCause } from '../character/wipeoutPolicy';
import { RaceCourse } from './course';
import { RACE_ROSTER, type RaceHudState, type RaceItem, type RaceMode, type RacePhase } from './types';

export interface RaceResult { mode:RaceMode; rank:number; time:number; won:boolean; boxes:number; totalBoxes:number; boxGem:boolean }
interface Rider {
  id:number; player:Player; scene:THREE.Scene|null; progress:number; previousProgress:number;
  finish:number|null; item:RaceItem|null; shield:number; boost:number; itemCooldown:number;
  boxes:Set<Crate>; anchor:THREE.Vector3; anchorProgress:number; recovery:number; falls:number;
  braking:boolean; oldJump:boolean; jumped:number; knockGrace:number; marker:THREE.Mesh; bubble:THREE.Object3D;
  think:number; aim:THREE.Vector3; attackCooldown:number; wasSwimming:boolean;
}
interface Projectile {
  type:Exclude<RaceItem,'shield'|'mushroom'>; owner:number; target:number;
  direction:THREE.Vector3; mesh:THREE.Group; previous:THREE.Vector3;
  progress:number; offset:number; velocityY:number; bounces:number; time:number; hit:Set<number>;
}
const vec = () => new THREE.Vector3();
const blankInput = ():Input => ({moveX:0,moveY:0,jumpHeld:false,grindHeld:false,spinHeld:false,grabHeld:false,transferHeld:false,
  jumpPressed:false,jumpReleased:false,jumpCancelled:false,grindPressed:false,spinPressed:false,grabPressed:false,transferPressed:false,
  itemPressed:false,restartPressed:false,consumeEdges(){}} as unknown as Input);
const RIVAL_SPEED=[30,24,22,23,21,24.5,22.5,23.5];

/** All eight riders share the production movement/collision step and one race clock.
 * Only falling recovery can reposition a rider; bots steer via device samples. */
export class SkateRace {
  level:Level|null=null; course:RaceCourse|null=null;
  private attachedLevel:Level|null=null;
  phase:RacePhase='grid'; mode:RaceMode='race'; countdown=3; elapsed=0;
  readonly riders:Rider[]=[];
  onFinish:(result:RaceResult)=>void=()=>{};
  private root=new THREE.Group();
  private projectiles:Projectile[]=[];
  private homes=new Map<Crate,THREE.Vector3>();
  private returns=new Map<Crate,number>();
  private jumps:{s:number;end:number}[]=[];
  private sections:string[]=[];
  private seed=1;private levelId='skate-race';
  private reported=false;
  private a=vec();private b=vec();
  private viewForward=vec();private viewOrigin=vec();
  constructor(private scene:THREE.Scene,private human:Player,private readonly fullRivals=false){scene.add(this.root);}
  get active():boolean{return !!this.level;}
  get count():number{return this.mode==='race'?8:1;}
  async preparePresentationAssets():Promise<void> {
    if(this.active)await Promise.all(this.riders.slice(1,this.count).map(r=>r.player.preparePresentationAssets()));
  }
  private allocate():void {
    if(this.riders.length)return;
    for(let id=0;id<8;id++){
      const actorScene=id?new THREE.Scene():null;
      if(actorScene)this.scene.add(actorScene);
      const player=id?new Player(actorScene!,this.fullRivals?null:RACE_ROSTER[id].color):this.human;
      const marker=new THREE.Mesh(new THREE.ConeGeometry(.18,.34,4),new THREE.MeshBasicMaterial({color:RACE_ROSTER[id].color}));
      marker.rotation.z=Math.PI;this.root.add(marker);
      const bubble=createRaceItemModel('shield');bubble.scale.setScalar(1.55);
      bubble.traverse(object=>{if(object instanceof THREE.Mesh){const m=object.material as THREE.Material;if(m.transparent)m.opacity=.22;}});
      bubble.visible=false;this.root.add(bubble);
      this.riders.push({id,player,scene:actorScene,progress:0,previousProgress:0,finish:null,item:null,shield:0,boost:0,itemCooldown:0,
        boxes:new Set(),anchor:vec(),anchorProgress:0,recovery:0,falls:0,braking:false,oldJump:false,jumped:-1,knockGrace:0,marker,bubble,think:0,aim:vec(),attackCooldown:0,wasSwimming:false});
    }
  }
  attach(level:Level,id='skate-race'):void {
    if(this.attachedLevel===level)return;
    this.attachedLevel=level;
    if(this.level)this.level.onRaceCrateBreak=null;
    for(const r of this.riders){r.player.raceHooks=null;if(r.scene){r.scene.visible=false;r.scene.removeFromParent();}r.marker.visible=false;}
    this.clearItems();this.level=level.skateRace?level:null;this.root.visible=!!this.level;
    if(!this.level){this.course=null;return;}
    this.sections=level.skateRace!.stages??[level.name];
    this.levelId=id;this.allocate();this.course=new RaceCourse(level.skateRace!.line);
    this.jumps=level.skateRace!.jumps.map(j=>({s:this.course!.project(vec().fromArray(j.takeoff)).s,end:this.course!.project(vec().fromArray(j.landing)).s}));
    this.homes=new Map(level.crates.map(c=>[c,c.mesh.position.clone()]));
    level.onRaceCrateBreak=(crate,id)=>this.crateBroken(crate,id);
    this.reset('race',false);
  }
  reset(mode:RaceMode='race',resetWorld=true):void {
    if(!this.level||!this.course)return;
    const level=this.level;this.mode=mode;this.phase='grid';this.countdown=3;this.elapsed=0;this.reported=false;
    this.seed=level.skateRace!.seed;this.returns.clear();this.clearItems();
    if(resetWorld)level.reset(true);
    level.setTimeTrial(mode==='time-trial');
    for(const r of this.riders){
      const start=level.spawnPos.clone();start.x+=(r.id%2?1:-1)*2.2;start.z+=Math.floor(r.id/2)*3.5;
      if(mode==='time-trial')start.copy(level.spawnPos);
      r.player.enterLevel(this.levelId);r.player.raceHooks={hazard:(cause,origin)=>this.hazard(r,cause,origin),unrecoverableFall:()=>this.unrecoverableFall(r),fallStarted:()=>{r.falls++;r.recovery=1;r.boost=0;},respawn:()=>this.recover(r)};
      r.player.racePresentationInterval=r.id===0?0:1/15;
      r.player.resetRacePosition(level,start,this.course.tangent(0));
      r.player.hasCrystal=false;r.player.gemEarned=false;r.player.cratesBroken=0;r.player.bonusCrates=0;
      r.player.ttActive=mode==='time-trial';r.player.ttTime=0;r.player.ttFreeze=0;
      r.progress=r.previousProgress=0;r.finish=null;r.item=null;r.shield=r.boost=r.recovery=r.falls=r.knockGrace=0;
      r.itemCooldown=3+r.id*.3;r.boxes.clear();r.anchor.copy(level.spawnPos);r.anchorProgress=0;r.braking=false;r.oldJump=false;r.jumped=-1;r.think=0;r.attackCooldown=.8+r.id*.17;r.aim.copy(start);r.wasSwimming=false;
      if(r.scene){r.scene.visible=r.id<this.count;if(r.id<this.count&&r.scene.parent!==this.scene)this.scene.add(r.scene);else if(r.id>=this.count)r.scene.removeFromParent();}
      r.marker.visible=r.id<this.count;r.player.prepareStartPresentation(level);this.placeMarker(r);
    }
  }
  start(mode:RaceMode=this.mode):void {this.reset(mode);this.phase='countdown';sfx.countdownBeep();}
  private random():number {let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/4294967296;}
  private crateBroken(c:Crate,id:number):void {
    const r=this.riders[id];if(!r||id>=this.count||this.phase!=='running'&&this.phase!=='finished')return;
    if(!c.mystery)r.boxes.add(c);r.player.cratesBroken=r.boxes.size;
    if(c.mystery&&!r.item){
      const rank=this.rank(r.id),pool:RaceItem[]=this.mode==='time-trial'?['mushroom']:rank<=2?['banana','green-shell','shield']:rank>=6?['mushroom','red-shell','blue-shell','shock-shell','shield']:['banana','green-shell','red-shell','mushroom','shield'];
      r.item=pool[Math.floor(this.random()*pool.length)];
    }
    this.returns.set(c,c.mystery?4:7);
  }
  private soundGain(r:Rider):number {
    return r.id===0?1:.3*Math.max(0,1-r.player.pos.distanceTo(this.human.pos)/55)**2;
  }
  private hazard(r:Rider,cause:WipeoutCause,origin?:THREE.Vector3):void {
    if(this.phase!=='running'&&this.phase!=='finished'||r.recovery>0||r.finish!==null)return;
    if(cause==='pit'||cause==='water')return; // native fall presentation owns these
    this.hit(r,origin);
  }
  private hit(r:Rider,origin?:THREE.Vector3):boolean {
    if(r.recovery>0||r.finish!==null||r.knockGrace>0)return false;
    if(r.shield>0){r.shield=0;r.knockGrace=.8;return false;}
    const direction=origin?this.a.copy(r.player.pos).sub(origin).setY(0).normalize():this.a.copy(r.player.raceHeading);
    const sign=direction.x*r.player.raceHeading.z-direction.z*r.player.raceHeading.x>=0?1:-1;
    if(!sfx.withGain(this.soundGain(r),()=>r.player.beginRaceStun(4.5,sign),r.id?'race-rivals':''))return false;
    if(origin){r.player.applyRaceImpulse(direction,7);}
    r.knockGrace=1.5;r.boost=0;return true;
  }
  private unrecoverableFall(r:Rider):boolean {
    const p=r.player;
    if(p.state!=='air'||p.grounded||p.vVel>=0||p.pos.y>=r.anchor.y-30)return false;
    // The global kill plane sits far below this tall course. Keep every lower
    // road the rider could still reach, then let Player own the normal pit death.
    const gravity=Math.max(1,Math.min(TUNING.fallGravity,TUNING.boardFallGravity,TUNING.rampFallGravity,TUNING.pipeAirGravity));
    const travel=Math.max(42,Math.abs(p.speed),TUNING.maxSpeed,TUNING.downhillMax,TUNING.vertMax);
    return !this.course!.hasReachableLanding(this.level!,p.pos,p.vVel,travel,gravity,CONST.maxFallSpeed);
  }
  private recover(r:Rider):void {
    r.recovery=0;r.boost=0;r.jumped=-1;r.oldJump=false;r.think=0;r.braking=false;
    r.progress=r.previousProgress=r.anchorProgress;
    r.player.resetRacePosition(this.level!,r.anchor,this.course!.tangent(r.anchorProgress));
    r.knockGrace=1.5;
  }
  /** UI and replay both feed this one semantic item edge. */
  useItem(id=0):boolean {
    const r=this.riders[id];
    if(!r?.item||(this.phase!=='running'&&(this.phase!=='finished'||id===0))||r.recovery>0||r.finish!==null||r.player.skateCameraBailing)return false;
    const item=r.item;r.item=null;sfx.withGain(this.soundGain(r),()=>sfx.play('woosh2',.55),r.id?'race-rivals':'');
    if(item==='shield'){r.shield=8;return true;}
    if(item==='mushroom'){r.boost=2.5;return true;}
    const order=this.order().filter(a=>a.finish===null),index=order.indexOf(r);
    const target=item==='blue-shell'?order.find(a=>a!==r):index>0?order[index-1]:null;
    const mesh=createRaceItemModel(item);mesh.scale.setScalar(item==='banana'?.72:.6);
    mesh.position.copy(r.player.pos).y+=item==='banana'?.05:.7;
    const direction=r.player.raceHeading;
    if(item==='banana')mesh.position.addScaledVector(direction,-2.2);
    this.root.add(mesh);
    const projected=this.course!.project(mesh.position,r.progress,40);
    this.projectiles.push({type:item,owner:id,target:target?.id??-1,direction,mesh,previous:mesh.position.clone(),
      progress:projected.s,offset:projected.offset,velocityY:0,bounces:0,time:0,hit:new Set()});
    return true;
  }
  private clearItems():void {for(const p of this.projectiles)disposeRaceItemModel(p.mesh);this.projectiles=[];}
  order():Rider[] {return this.riders.slice(0,this.count).sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.progress-a.progress||a.id-b.id);}
  rank(id=0):number {return this.order().findIndex(r=>r.id===id)+1;}
  /** Rivals use normal device inputs, with reaction time and imperfect pace. */
  drive(id:number):Input {
    const r=this.riders[id],p=r.player,c=this.course!,input=blankInput();
    if(r.finish!==null||r.recovery>0||p.state==='dead'||p.skateCameraBailing)return input;
    const look=THREE.MathUtils.clamp(Math.abs(p.speed)*.5,7,21);
    const upcoming=this.jumps.find(j=>j.end>r.progress);
    const approach=!!upcoming&&r.progress>=upcoming.s-35&&r.progress<upcoming.end;
    const opponent=id===0?null:this.riders.slice(0,this.count).filter(v=>v!==r&&v.finish===null&&!v.recovery&&!v.player.skateCameraBailing&&
      Math.abs(v.progress-r.progress)<9&&Math.abs(v.player.pos.y-p.pos.y)<3&&v.player.pos.distanceToSquared(p.pos)<64)
      .sort((a,b)=>a.player.pos.distanceToSquared(p.pos)-b.player.pos.distanceToSquared(p.pos))[0];
    if(id===0||r.think<=0){
      let lateral=id===0?0:((id%4)-1.5)*1.7+Math.sin(this.elapsed*.65+id*1.7)*.5;
      if(approach)lateral=id===0?0:(id%2?1:-1)*1.5;
      else if(opponent)lateral=c.project(opponent.player.pos,opponent.progress,20).offset+(id%2?-.65:.65);
      lateral=THREE.MathUtils.clamp(lateral,-Math.min(5,c.width(r.progress)*.3),Math.min(5,c.width(r.progress)*.3));
      c.sample(r.progress+look,lateral,r.aim);
      // Read hazards at the same delayed reaction sample as the road.
      if(id===0||this.random()>.12)for(const box of this.level!.crates)if(box.alive&&(box.tnt||box.nitro)&&box.mesh.position.distanceTo(r.aim)<3.2){
        c.sample(r.progress+look,lateral+(lateral<0?2.5:-2.5),r.aim);break;
      }
      if(r.progress>c.length-25)r.aim.addScaledVector(c.tangent(c.length),30);
      r.think=id===0?0:.1+id*.012+this.random()*.1;
    }
    if(p.swimming){const pool=this.jumps.find(j=>r.progress>j.s-15&&r.progress<j.end+5);if(pool)c.sample(pool.end+6,0,r.aim);}
    const dx=r.aim.x-p.pos.x,dz=r.aim.z-p.pos.z,n=Math.hypot(dx,dz)||1,basis=p.raceInputBasis(this.level!);
    const bn=Math.hypot(basis.x,basis.z)||1,fx=basis.x/bn,fz=basis.z/bn;
    input.moveX=THREE.MathUtils.clamp((dx*-fz+dz*fx)/n,-1,1);input.moveY=THREE.MathUtils.clamp((dx*fx+dz*fz)/n,-1,1);
    input.jumpHeld=true; // pace comes from honest braking; keep charge for uphill momentum
    for(let i=0;i<this.jumps.length;i++){
      const jump=this.jumps[i];
      if(r.progress>=jump.s&&r.progress<jump.end&&r.jumped!==i&&p.grounded){
        input.jumpHeld=!r.oldJump;if(r.oldJump)r.jumped=i;break;
      }
      if(r.jumped===i&&r.progress<jump.end&&!p.grounded)input.jumpHeld=false;
    }
    if(r.progress>(this.jumps[this.jumps.length-1]?.end??0)+1)input.jumpHeld=!p.boardRolling;
    if(p.swimming)r.wasSwimming=true;
    else if(r.wasSwimming){input.jumpHeld=false;r.wasSwimming=false;}
    const pace=RIVAL_SPEED[id]+Math.sin(this.elapsed*.25+id)*1.2;
    const local=c.tangent(r.progress,this.a),ahead=c.tangent(r.progress+18,this.b);
    const bend=Math.abs(Math.atan2(local.x*ahead.z-local.z*ahead.x,local.x*ahead.x+local.z*ahead.z));
    // Braking locks the normal board's heading. Coast through a bend and brake on its straights.
    r.braking=id>0&&!approach&&bend<.2&&p.grounded&&(r.braking?Math.abs(p.speed)>pace-1.5:Math.abs(p.speed)>pace+3);
    input.grabHeld=r.braking;
    input.jumpPressed=input.jumpHeld&&!r.oldJump;input.jumpReleased=!input.jumpHeld&&r.oldJump;r.oldJump=input.jumpHeld;
    if(p.state==='grind'){input.moveX=THREE.MathUtils.clamp(-p.balance*3-p.balanceVel*.45,-1,1);input.grindHeld=true;}
    const victim=opponent??(id===0?this.riders.find(v=>v!==r&&v.id<this.count&&v.player.pos.distanceTo(p.pos)<2.5):null);
    if(victim&&r.attackCooldown<=0&&victim.player.pos.distanceTo(p.pos)<2.65){
      input.spinPressed=input.spinHeld=true;r.attackCooldown=1.1+this.random()*1.8;
    }
    if(r.itemCooldown<=0&&r.item){input.itemPressed=true;r.itemCooldown=2.8+this.random()*2.2;}
    return input;
  }
  /** Called instead of the ordinary player step while a race level is loaded. */
  step(dt:number,input:Input):void {
    const level=this.level,c=this.course;if(!level||!c)return;
    if(input.raceStartPressed||input.raceTrialStartPressed)this.start(input.raceTrialStartPressed?'time-trial':'race');
    if(this.phase==='grid'||this.phase==='countdown'){
      if(this.phase==='grid'&&input.jumpPressed)this.start(this.mode);
      else if(this.phase==='countdown'){const before=Math.ceil(this.countdown);this.countdown=Math.max(0,this.countdown-dt);if(this.countdown>0&&Math.ceil(this.countdown)<before)sfx.countdownBeep();if(this.countdown===0){this.phase='running';sfx.play('skateTransition',.7,1.1);}}
      for(const r of this.riders.slice(0,this.count)){r.player.prepareStartPresentation(level,dt);this.placeMarker(r);}return;
    }
    if(this.phase==='finished'&&this.riders.slice(0,this.count).every(r=>r.finish!==null)){this.clearItems();for(const r of this.riders.slice(0,this.count))r.player.updateResultsPose(dt);return;}
    this.elapsed+=dt;
    for(const r of this.riders.slice(0,this.count)){
      const p=r.player;r.previousProgress=r.progress;r.shield=Math.max(0,r.shield-dt);r.knockGrace=Math.max(0,r.knockGrace-dt);r.itemCooldown-=dt;r.attackCooldown-=dt;r.think-=dt;
      if(r.finish!==null){p.updateResultsPose(dt);continue;}
      level.raceActorId=r.id;const device=r.id===0?input:this.drive(r.id);
      if(device.itemPressed)this.useItem(r.id);
      if(r.boost>0){r.boost=Math.max(0,r.boost-dt);if(p.boardRolling&&p.speed<42)p.speed=Math.min(42,Math.max(0,p.speed)+dt*20);}
      p.racePresentationInterval=r.id===0?0:p.pos.distanceToSquared(this.human.pos)<1600?1/30:1/10;
      sfx.withGain(this.soundGain(r),()=>p.step(dt,device,level),r.id?'race-rivals':'');
      r.recovery=p.state==='dead'?1:0;
      if(r.recovery){this.placeMarker(r);continue;}
      let projected=c.project(p.pos,r.progress,80);
      if(p.grounded||p.state==='grind'){
        const landed=c.project(p.pos);
        if(landed.distance<c.width(landed.s)/2+3&&Math.abs(landed.s-projected.s)>40){
          projected=landed;p.laneCursor.s=-1;p.snapRenderInterpolation();
        }
      }
      r.progress=projected.s;
      const centre=c.sample(r.progress,0,this.a);
      if(p.grounded||p.state==='grind'){
        // A gap lip needs a small supported run-up after a normal stopped return.
        const lip=this.jumps.find(j=>r.progress>j.s-12&&r.progress<j.end);
        const at=lip?lip.s-30:r.progress,support=c.support(level,at,this.b);
        if(support&&Math.abs(p.pos.y-centre.y)<8){r.anchor.copy(support);r.anchorProgress=at;}
      }
      const finish=c.knots[c.knots.length-1],heading=c.tangent(c.length,this.b);
      const crossed=(p.pos.x-finish[0])*heading.x+(p.pos.z-finish[2])*heading.z>=0;
      if(r.recovery===0&&crossed&&r.progress>c.length-8&&Math.abs(projected.offset)<level.skateRace!.finishWidth/2&&Math.abs(p.pos.y-centre.y)<7){
        r.finish=this.elapsed;p.ttActive=false;p.ttTime=this.elapsed;
        p.prepareResultsPose(level,p.pos.clone(),c.tangent(c.length),this.rank(r.id)===1);
      }
      this.placeMarker(r);
    }
    level.raceActorId=0;level.playerPos.copy(this.human.pos);level.update(dt);this.contact();this.updateItems(dt);
    for(const [box,seconds] of this.returns){if(seconds<=dt){level.reviveRaceCrate(box,this.homes.get(box)!);this.returns.delete(box);}else this.returns.set(box,seconds-dt);}
    // Only human-owned unique boxes count. NPC blast rewards never leak through
    // the single-player queue, and repeated item-box laps cannot farm the gem.
    level.consumeBlastBroken();this.human.cratesBroken=this.riders[0].boxes.size;
    if(this.mode==='time-trial'){this.human.ttTime=this.elapsed;this.human.ttFreeze=0;}
    const human=this.riders[0];
    if(human.finish!==null&&!this.reported){
      this.reported=true;this.phase='finished';const rank=this.rank(),won=this.mode==='race'&&rank===1,boxGem=human.boxes.size===level.totalCrates&&level.totalCrates>0;
      this.human.hasCrystal=won;this.human.gemEarned=boxGem;
      this.onFinish({mode:this.mode,rank,time:human.finish,won,boxes:human.boxes.size,totalBoxes:level.totalCrates,boxGem});
    }

  }
  private contact():void {
    for(const a of this.riders.slice(0,this.count))for(const b of this.riders.slice(a.id+1,this.count)){
      if(a.recovery||b.recovery||a.finish!==null||b.finish!==null)continue;
      const dx=b.player.pos.x-a.player.pos.x,dz=b.player.pos.z-a.player.pos.z,d=Math.hypot(dx,dz),dy=b.player.pos.y-a.player.pos.y;
      if(d>2.1||Math.abs(dy)>3)continue;
      const attack=(att:Rider,victim:Rider)=>{
        if(att.player.skateCameraBailing)return;
        const atop=att.player.pos.y-victim.player.pos.y;
        if(d<1.1&&atop>1&&atop<2.8&&att.player.vVel<-2){if(this.hit(victim,att.player.pos))att.player.vVel=8;}
        else if(d<1.85&&Math.abs(atop)<2&&att.player.spinning)this.hit(victim,att.player.pos);
      };attack(a,b);attack(b,a);
      if(d<.85&&Math.abs(dy)<.8&&a.player.grounded&&b.player.grounded){const n=Math.max(.01,d),push=(.85-d)*.5;this.a.set(d?dx/n:1,0,d?dz/n:0);a.player.pos.addScaledVector(this.a,-push);b.player.pos.addScaledVector(this.a,push);}
    }
  }
  private updateItems(dt:number):void {
    const c=this.course!,level=this.level!;
    for(const p of this.projectiles){
      p.time+=dt;p.previous.copy(p.mesh.position);
      if(p.type==='shock-shell'){
        p.mesh.rotation.y+=dt*6;p.mesh.position.copy(this.riders[p.owner].player.pos).y+=2.7;
        if(p.time>.45){for(const r of this.riders.slice(0,this.count))if(r.id!==p.owner&&r.finish===null&&!r.recovery&&!p.hit.has(r.id)){
          this.hit(r);p.hit.add(r.id);
        }p.time=99;}
        continue;
      }
      if(p.type==='red-shell'||p.type==='blue-shell'){
        const target=this.riders[p.target];
        if(target&&target.finish===null&&!target.recovery){
          const speed=p.type==='blue-shell'?76:51;
          p.progress=Math.min(target.progress+2,p.progress+dt*speed);
          const offset=c.project(target.player.pos,target.progress,25).offset;
          p.offset+=(offset-p.offset)*Math.min(1,dt*5);
          c.sample(p.progress,THREE.MathUtils.clamp(p.offset,-c.width(p.progress)*.35,c.width(p.progress)*.35),this.a);
          this.a.y+=p.type==='blue-shell'?2.8:.7;
          if(Math.abs(target.progress-p.progress)<9)this.a.copy(target.player.pos).y+=.9;
          this.b.copy(this.a).sub(p.mesh.position);p.mesh.position.addScaledVector(this.b,Math.min(1,dt*speed/Math.max(.01,this.b.length())));
        }else p.mesh.position.addScaledVector(p.direction,dt*45);
        p.mesh.rotation.y+=dt*9;
      }else if(p.type==='green-shell'){
        p.mesh.position.addScaledVector(p.direction,dt*43);
        const q=c.project(p.mesh.position,p.progress,55);p.progress=q.s;p.offset=q.offset;
        const limit=c.width(q.s)/2-.8;
        if(Math.abs(q.offset)>limit&&q.distance<limit+5){
          const tangent=c.tangent(q.s,this.a);this.b.set(-tangent.z,0,tangent.x).normalize();
          const out=p.direction.dot(this.b)*Math.sign(q.offset);
          if(out>0){p.direction.addScaledVector(this.b,-2*p.direction.dot(this.b)).normalize();p.bounces++;}
          const y=p.mesh.position.y;c.sample(q.s,Math.sign(q.offset)*limit,p.mesh.position);p.mesh.position.y=y;
        }
        const ground=c.supportAt(level,p.mesh.position,this.b,4,12);
        if(ground){p.mesh.position.y=ground.y+.6;p.velocityY=0;}else{p.velocityY-=32*dt;p.mesh.position.y+=p.velocityY*dt;}
        p.mesh.rotation.y+=dt*11;
      }else{
        const ground=c.supportAt(level,p.mesh.position,this.a,3,8);if(ground)p.mesh.position.y=ground.y+.025;
      }
      for(const r of this.riders.slice(0,this.count)){
        if(r.id===p.owner||p.hit.has(r.id)||r.recovery||r.finish!==null||p.type==='blue-shell'&&r.id!==p.target)continue;
        this.a.copy(r.player.pos).y+=p.type==='banana'?.2:1;
        this.b.copy(p.mesh.position).sub(p.previous);
        const span=this.b.lengthSq(),t=span?THREE.MathUtils.clamp(((this.a.x-p.previous.x)*this.b.x+(this.a.y-p.previous.y)*this.b.y+(this.a.z-p.previous.z)*this.b.z)/span,0,1):0;
        this.b.multiplyScalar(t).add(p.previous);
        if(this.b.distanceToSquared(this.a)>2.25)continue;
        if(p.type==='blue-shell'){
          for(const other of this.riders.slice(0,this.count))if(other.id!==p.owner&&other.player.pos.distanceTo(r.player.pos)<5.5)this.hit(other,p.mesh.position);
        }else this.hit(r,p.mesh.position);
        p.hit.add(r.id);p.time=99;break;
      }
    }
    this.projectiles=this.projectiles.filter(p=>{
      const life=p.type==='banana'?22:p.type==='blue-shell'?75:12;
      if(p.time<life&&p.mesh.position.y>level.killY&&p.bounces<7)return true;
      disposeRaceItemModel(p.mesh);return false;
    });
  }
  private placeMarker(r:Rider,position=r.player.pos):void {r.marker.visible=r.id>0&&r.id<this.count&&!r.recovery&&r.finish===null;r.marker.position.copy(position).y+=3.4;r.bubble.position.copy(position).y+=1.2;r.bubble.visible=r.shield>0&&r.recovery===0&&r.id<this.count&&r.finish===null;}
  /** The shared frame loop captures the hero; race owns only its extra riders. */
  commitRenderStep():void {if(this.level)for(const r of this.riders.slice(1,this.count))r.player.commitRenderStep(this.level);}
  applyRenderInterpolation(alpha:number):void {for(const r of this.riders.slice(0,this.count)){if(r.id)r.player.applyRenderInterpolation(alpha);this.placeMarker(r,r.player.renderPosition);}}
  restoreRenderPose():void {for(const r of this.riders.slice(1,this.count))r.player.restoreRenderPose();}
  /** Skin meshes cannot use static bounds. Cull the actor conservatively in X/Z,
   * retaining vertical reflection coverage and all simulation/interaction work. */
  updateView(camera:THREE.Camera):void {
    if(!this.active)return;
    camera.updateMatrixWorld(true);camera.getWorldPosition(this.viewOrigin);camera.getWorldDirection(this.viewForward).setY(0).normalize();
    const spread=1/Math.max(.01,Math.abs(camera.projectionMatrix.elements[0])),margin=10;
    const far=(camera instanceof THREE.PerspectiveCamera?camera.far:400)+margin;
    for(const r of this.riders)if(r.scene){
      const dx=r.player.renderPosition.x-this.viewOrigin.x,dz=r.player.renderPosition.z-this.viewOrigin.z;
      const depth=dx*this.viewForward.x+dz*this.viewForward.z,side=Math.abs(-dx*this.viewForward.z+dz*this.viewForward.x);
      r.scene.visible=this.root.visible&&r.id<this.count&&depth>-margin&&depth<far&&side<Math.max(0,depth)*spread+margin;
    }
  }
  setVisible(visible:boolean):void {this.root.visible=visible&&this.active;for(const r of this.riders)if(r.scene){r.scene.visible=visible&&this.active&&r.id<this.count;if(r.scene.visible&&r.scene.parent!==this.scene)this.scene.add(r.scene);else if(!r.scene.visible)r.scene.removeFromParent();}}
  hud():RaceHudState|undefined {
    if(!this.level||!this.course)return;
    const h=this.riders[0];return {title:this.level.name,sections:this.sections,medalTimes:this.level.medalTimes,medal:this.mode==='time-trial'&&h.finish!==null?medalForTime(h.finish,this.level.medalTimes):null,phase:this.phase,mode:this.mode,countdown:this.countdown,elapsed:h.finish??this.elapsed,rank:this.rank(),item:h.item,shield:h.shield,
      recovering:h.recovery,boxes:h.boxes.size,totalBoxes:this.level.totalCrates,won:h.finish!==null&&this.rank()===1&&this.mode==='race',
      racers:this.order().map(r=>({id:r.id,...RACE_ROSTER[r.id],x:r.player.pos.x,y:r.player.pos.y,z:r.player.pos.z,progress:r.progress/this.course!.length,finish:r.finish})),line:this.level.skateRace!.line,visible:true};
  }
}
