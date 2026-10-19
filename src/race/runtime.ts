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
import { prepareRaceItemPictures } from './itemPictures';
import { RaceItemDeck, freshRaceSeed } from './itemOdds';
import { RaceItemEffects, raceTargetRing } from './effects';
import { RACE_ITEMS, RACE_ROSTER, type RaceHudState, type RaceItem, type RaceMode, type RacePhase, type RaceThreat } from './types';

export interface RaceResult { mode:RaceMode; rank:number; time:number; won:boolean; boxes:number; totalBoxes:number; boxGem:boolean }
interface Rider {
  id:number; player:Player; scene:THREE.Scene|null; progress:number; previousProgress:number;
  finish:number|null; rollout:{time:number; speed:number; duration:number; heading:THREE.Vector3}|null; item:RaceItem|null; shield:number; star:number; ultraUsed:boolean; starModel:THREE.Group; boost:number; itemCooldown:number;
  boxes:Set<Crate>; anchor:THREE.Vector3; anchorProgress:number; recovery:number; falls:number;
  braking:boolean; oldJump:boolean; jumped:number; knockGrace:number; marker:THREE.Mesh; bubble:THREE.Object3D;
  deck:RaceItemDeck; itemProgress:number; parry:number; dodge:number; velocity:THREE.Vector3; threats:RaceThreat[];
  targetRing:ReturnType<typeof raceTargetRing>; storm:THREE.Group;
  think:number; aim:THREE.Vector3; attackCooldown:number; wasSwimming:boolean;
}
interface Projectile {
  type:Exclude<RaceItem,'shield'|'mushroom'|'horn'|'star'>; owner:number; target:number;
  direction:THREE.Vector3; mesh:THREE.Group; previous:THREE.Vector3;
  phase:'travel'|'windup'|'strike'; phaseTime:number; locked:THREE.Vector3;
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
  phase:RacePhase='grid'; mode:RaceMode='race'; countdown=3; elapsed=0; runSeed=1;
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
  private heavyAt=20; private warningBeep=0;
  private effects=new RaceItemEffects(this.root);
  private ray=new THREE.Ray(); private wallHit=vec();
  private a=vec();private b=vec();
  private viewForward=vec();private viewOrigin=vec();
  constructor(private scene:THREE.Scene,private human:Player,private readonly fullRivals=false){scene.add(this.root);}
  get active():boolean{return !!this.level;}
  get count():number{return this.mode==='race'?8:1;}
  async preparePresentationAssets():Promise<void> {
    if(this.active)await Promise.all([prepareRaceItemPictures(),...this.riders.slice(1,this.count).map(r=>r.player.preparePresentationAssets())]);
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
      const targetRing=raceTargetRing(0xe95447);targetRing.visible=false;this.root.add(targetRing);
      const storm=createRaceItemModel('shock-shell');storm.visible=false;storm.scale.setScalar(.8);this.root.add(storm);
      const starModel=createRaceItemModel('star');starModel.scale.setScalar(.6);starModel.visible=false;this.root.add(starModel);
      this.riders.push({id,player,scene:actorScene,progress:0,previousProgress:0,finish:null,rollout:null,item:null,shield:0,star:0,ultraUsed:false,starModel,boost:0,itemCooldown:0,
        boxes:new Set(),anchor:vec(),anchorProgress:0,recovery:0,falls:0,braking:false,oldJump:false,jumped:-1,knockGrace:0,marker,bubble,think:0,aim:vec(),attackCooldown:0,wasSwimming:false,deck:new RaceItemDeck(),itemProgress:-Infinity,parry:0,dodge:0,velocity:vec(),threats:[],targetRing,storm});
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
  reset(mode:RaceMode='race',resetWorld=true,runSeed=this.level?.skateRace?.seed??1):void {
    if(!this.level||!this.course)return;
    const level=this.level;this.mode=mode;this.phase='grid';this.countdown=3;this.elapsed=0;this.reported=false;
    this.runSeed=runSeed>>>0;this.seed=this.runSeed;this.returns.clear();this.clearItems();this.heavyAt=20;this.warningBeep=0;
    if(resetWorld)level.reset(true);
    level.setTimeTrial(mode==='time-trial');
    for(const r of this.riders){
      const forward=this.course.tangent(0).setY(0).normalize(),right=vec().set(-forward.z,0,forward.x);
      const start=level.spawnPos.clone().addScaledVector(right,(r.id%2?1:-1)*2.2)
        .addScaledVector(forward,-Math.floor(r.id/2)*3.5);
      if(mode==='time-trial')start.copy(level.spawnPos);
      r.player.enterLevel(this.levelId);r.player.raceHooks={canCollectItem:()=>!r.item&&r.finish===null&&!r.recovery,hazard:(cause,origin)=>this.hazard(r,cause,origin),unrecoverableFall:()=>this.unrecoverableFall(r),fallStarted:()=>{r.falls++;r.recovery=1;r.boost=0;},respawn:()=>this.recover(r)};
      r.player.racePresentationInterval=r.id===0?0:1/15;
      r.player.resetRacePosition(level,start,this.course.tangent(0));
      r.player.hasCrystal=false;r.player.gemEarned=false;r.player.cratesBroken=0;r.player.bonusCrates=0;
      r.player.ttActive=mode==='time-trial';r.player.ttTime=0;r.player.ttFreeze=0;
      r.star=0;r.ultraUsed=false;r.starModel.visible=false;r.progress=r.previousProgress=0;r.finish=null;r.rollout=null;r.item=null;r.shield=r.boost=r.recovery=r.falls=r.knockGrace=0;
      r.itemCooldown=3+r.id*.3;r.boxes.clear();r.anchor.copy(level.spawnPos);r.anchorProgress=0;r.braking=false;r.oldJump=false;r.jumped=-1;r.think=0;r.attackCooldown=.8+r.id*.17;r.aim.copy(start);r.wasSwimming=false;r.deck.reset((this.seed^Math.imul(r.id+1,0x9e3779b9))>>>0);r.itemProgress=-Infinity;r.parry=r.dodge=0;r.velocity.set(0,0,0);r.threats=[];r.targetRing.visible=r.storm.visible=false;
      if(r.scene){r.scene.visible=r.id<this.count;if(r.id<this.count&&r.scene.parent!==this.scene)this.scene.add(r.scene);else if(r.id>=this.count)r.scene.removeFromParent();}
      r.marker.visible=r.id<this.count;r.player.prepareStartPresentation(level);this.placeMarker(r);
    }
  }
  start(mode:RaceMode=this.mode,seed?:number):void {this.reset(mode,true,seed===0?this.level!.skateRace!.seed:seed??freshRaceSeed());this.phase='countdown';sfx.countdownBeep();}
  private random():number {let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/4294967296;}
  private crateBroken(c:Crate,id:number):void {
    const r=this.riders[id];if(!r||id>=this.count||r.finish!==null||this.phase!=='running'&&this.phase!=='finished')return;
    if(!c.mystery)r.boxes.add(c);r.player.cratesBroken=r.boxes.size;
    if(c.mystery&&!r.item){
      const lead=this.order()[0],fresh=r.progress>r.itemProgress+12;
      const heavy=fresh&&this.elapsed>=this.heavyAt&&!this.riders.some(a=>a.item==='blue-shell'||a.item==='shock-shell'||a.item==='tidal-wave')&&
        !this.projectiles.some(p=>p.type==='blue-shell'||p.type==='shock-shell'||p.type==='tidal-wave');
      r.item=this.mode==='time-trial'?'mushroom':r.deck.draw(this.rank(r.id),Math.max(0,lead.progress-r.progress),heavy,this.elapsed>=30&&!r.ultraUsed);
      r.itemProgress=Math.max(r.itemProgress,r.progress);
      if(r.item==='star'||r.item==='tidal-wave')r.ultraUsed=true;
      if(r.item==='blue-shell'||r.item==='shock-shell'||r.item==='tidal-wave')this.heavyAt=this.elapsed+(r.item==='tidal-wave'?45:25);
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
    if(r.star>0){this.effects.pulse(r.player.pos,0xffdc5b,2);return false;}
    if(r.shield>0){r.shield=0;r.knockGrace=1;this.effects.pulse(r.player.pos,0x77daef,3);sfx.withGain(this.soundGain(r),()=>sfx.play('maskLoss',.55),r.id?'race-rivals':'');return false;}
    const direction=origin?this.a.copy(r.player.pos).sub(origin).setY(0).normalize():this.a.copy(r.player.raceHeading);
    const sign=direction.x*r.player.raceHeading.z-direction.z*r.player.raceHeading.x>=0?1:-1;
    if(!sfx.withGain(this.soundGain(r),()=>r.player.beginRaceStun(4.5,sign),r.id?'race-rivals':''))return false;
    if(origin){r.player.applyRaceImpulse(direction,7);}
    r.knockGrace=2.4;r.boost=0;return true;
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
  useItem(id=0,backwards=false):boolean {
    const r=this.riders[id];
    if(!r?.item||(this.phase!=='running'&&(this.phase!=='finished'||id===0))||r.recovery>0||r.finish!==null||r.player.skateCameraBailing)return false;
    const item=r.item;r.item=null;sfx.withGain(this.soundGain(r),()=>sfx.play('woosh2',.55),r.id?'race-rivals':'');
    if(item==='star'){r.star=6;r.boost=6;this.effects.pulse(r.player.pos,0xffdc5b,4);sfx.withGain(this.soundGain(r),()=>sfx.play('maskGet',.65),r.id?'race-rivals':'');return true;}
    if(item==='shield'){r.shield=8;return true;}
    if(item==='mushroom'){r.boost=2.5;r.dodge=.55;return true;}
    if(item==='horn'){
      this.effects.pulse(r.player.pos,0xf6b34b,8);
      sfx.withGain(this.soundGain(r),()=>sfx.play('bouncyBounce',.8,.6),r.id?'race-rivals':'');
      for(const p of this.projectiles)if(p.type!=='shock-shell'&&p.mesh.position.distanceTo(r.player.pos)<8)p.time=99;
      for(const other of this.riders.slice(0,this.count))if(other!==r&&other.player.pos.distanceTo(r.player.pos)<6)this.hit(other,r.player.pos);
      return true;
    }
    if(item==='shock-shell'){this.heavyAt=Math.max(this.heavyAt,this.elapsed+25);sfx.withGain(this.soundGain(r),()=>sfx.play('enemySentryCharge',.55),r.id?'race-rivals':'');}
    if(item==='tidal-wave')this.heavyAt=Math.max(this.heavyAt,this.elapsed+45);
    if(item==='blue-shell')this.heavyAt=Math.max(this.heavyAt,this.elapsed+25);
    const order=this.order().filter(a=>a.finish===null),index=order.indexOf(r);
    const target=item==='blue-shell'?order.find(a=>a!==r):index>0?order[index-1]:null;
    const mesh=createRaceItemModel(item);mesh.scale.setScalar(item==='banana'?.72:.6);
    mesh.position.copy(r.player.pos).y+=item==='banana'?.05:.7;
    const direction=r.player.raceHeading;if((item==='green-shell'||item==='water-bomb'||item==='boomerang')&&backwards)direction.negate();
    if(item==='banana')mesh.position.addScaledVector(direction,-2.2);
    if(item==='water-bomb')mesh.position.y+=.6;
    if(item==='boomerang'){const grade=this.course!.tangent(r.progress);direction.y=direction.dot(grade.clone().setY(0).normalize())*grade.y/Math.max(.1,Math.hypot(grade.x,grade.z));direction.normalize();}
    if(item==='tidal-wave'){mesh.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.rotateY(-Math.PI/2);});mesh.scale.set(this.course!.width(r.progress)/.6,1.35,1.4);mesh.rotation.y=Math.atan2(direction.x,direction.z);}
    this.root.add(mesh);
    const projected=this.course!.project(mesh.position,r.progress,40);
    this.projectiles.push({phase:'travel',phaseTime:0,locked:vec(),type:item,owner:id,target:target?.id??-1,direction,mesh,previous:mesh.position.clone(),
      progress:projected.s,offset:projected.offset,velocityY:item==='water-bomb'?10:0,bounces:0,time:0,hit:new Set()});
    return true;
  }
  private clearItems():void {for(const p of this.projectiles)disposeRaceItemModel(p.mesh);this.projectiles=[];this.effects.clear();for(const r of this.riders){r.targetRing.visible=r.storm.visible=r.starModel.visible=false;r.threats=[];}}
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
    if(!p.grounded&&r.jumped>=0&&!p.swimming)input.jumpHeld=false;
    if(r.progress>(this.jumps[this.jumps.length-1]?.end??0)+1)input.jumpHeld=!p.boardRolling;
    if(p.swimming)r.wasSwimming=true;
    else if(r.wasSwimming){input.jumpHeld=false;r.wasSwimming=false;}
    const pace=RIVAL_SPEED[id]+Math.sin(this.elapsed*.25+id)*1.2;
    const local=c.tangent(r.progress,this.a),ahead=c.tangent(r.progress+18,this.b);
    const bend=Math.abs(Math.atan2(local.x*ahead.z-local.z*ahead.x,local.x*ahead.x+local.z*ahead.z));
    // Braking locks the normal board's heading. Coast through a bend and brake on its straights.
    r.braking=id>0&&!approach&&bend<.2&&p.grounded&&(r.braking?Math.abs(p.speed)>pace-1.5:Math.abs(p.speed)>pace+3);
    input.grabHeld=r.braking;
    const threat=r.threats[0];
    if(threat?.item==='shock-shell'&&threat.seconds<.5&&p.grounded)input.jumpHeld=false;
    if(threat&&threat.item!=='shock-shell'&&threat.seconds<.3&&r.attackCooldown<=0&&this.random()>.25){input.spinPressed=input.spinHeld=true;r.attackCooldown=1.4;}
    input.jumpPressed=input.jumpHeld&&!r.oldJump;input.jumpReleased=!input.jumpHeld&&r.oldJump;r.oldJump=input.jumpHeld;
    if(p.state==='grind'){input.moveX=THREE.MathUtils.clamp(-p.balance*3-p.balanceVel*.45,-1,1);input.grindHeld=true;}
    const victim=opponent??(id===0?this.riders.find(v=>v!==r&&v.id<this.count&&v.player.pos.distanceTo(p.pos)<2.5):null);
    if(victim&&r.attackCooldown<=0&&victim.player.pos.distanceTo(p.pos)<2.65){
      input.spinPressed=input.spinHeld=true;r.attackCooldown=1.1+this.random()*1.8;
    }
    if(r.item){
      const defensive=r.item==='shield'||r.item==='horn'||r.item==='banana';
      const defend=!!threat&&threat.seconds<(r.item==='horn'?.65:1.25)&&!(r.item==='horn'&&threat.item==='shock-shell');
      if(defend||r.itemCooldown<=0&&(!defensive||!threat&&this.rank(id)>2)){input.itemPressed=true;r.itemCooldown=2.8+this.random()*2.2;}
    }
    return input;
  }
  /** Called instead of the ordinary player step while a race level is loaded. */
  step(dt:number,input:Input):void {
    const level=this.level,c=this.course;if(!level||!c)return;
    if(input.raceStartPressed||input.raceTrialStartPressed){this.start(input.raceTrialStartPressed?'time-trial':'race',input.raceSeed);input.raceSeed=this.runSeed;}
    if(this.phase==='grid'||this.phase==='countdown'){
      if(this.phase==='grid'&&input.jumpPressed){this.start(this.mode,input.raceSeed);input.raceSeed=this.runSeed;}
      else if(this.phase==='countdown'){const before=Math.ceil(this.countdown);this.countdown=Math.max(0,this.countdown-dt);if(this.countdown>0&&Math.ceil(this.countdown)<before)sfx.countdownBeep();if(this.countdown===0){this.phase='running';sfx.play('skateTransition',.7,1.1);}}
      for(const r of this.riders.slice(0,this.count)){r.player.prepareStartPresentation(level,dt);this.placeMarker(r);}return;
    }
    const allFinished=this.riders.slice(0,this.count).every(r=>r.finish!==null);
    if(!allFinished)this.elapsed+=dt;
    for(const r of this.riders.slice(0,this.count)){
      const p=r.player;r.previousProgress=r.progress;r.shield=Math.max(0,r.shield-dt);r.star=Math.max(0,r.star-dt);r.knockGrace=Math.max(0,r.knockGrace-dt);r.itemCooldown-=dt;r.attackCooldown-=dt;r.think-=dt;r.parry=Math.max(0,r.parry-dt);r.dodge=Math.max(0,r.dodge-dt);
      if(r.finish!==null){this.finishRollout(r,dt);this.placeMarker(r);continue;}
      level.raceActorId=r.id;const device=r.id===0?input:this.drive(r.id);
      if(device.itemPressed)this.useItem(r.id,device.moveY<-.5);
      const previousPosition=p.pos.clone();
      if(r.boost>0){r.boost=Math.max(0,r.boost-dt);if(p.boardRolling&&p.speed<42)p.speed=Math.min(42,Math.max(0,p.speed)+dt*20);}
      p.racePresentationInterval=r.id===0?0:p.pos.distanceToSquared(this.human.pos)<1600?1/30:1/10;
      sfx.withGain(this.soundGain(r),()=>p.step(dt,device,level),r.id?'race-rivals':'');
      r.velocity.copy(p.pos).sub(previousPosition).divideScalar(Math.max(.001,dt));if(r.velocity.length()>80)r.velocity.setLength(80);
      if(device.spinPressed&&p.spinning)r.parry=.28;
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
        // The timing plane records the result immediately; the actor keeps
        // rolling on the real run-out while the rest of the field races on.
        const heading=c.tangent(c.length).setY(0).normalize(),speed=Math.max(0,Math.min(48,p.speed));
        let distance=0;
        const runout=12-(this.rank(r.id)-1)*.85; // stagger finishers along the run-out
        for(let d=.5;d<=runout;d+=.5){
          const at=p.pos.clone().addScaledVector(heading,d);
          if(!c.supportAt(level,at,this.a,2,10))break;
          distance=d;
        }
        r.rollout={time:0,speed,duration:Math.min(1.2,2*Math.max(0,distance-1)/Math.max(1,speed)),heading};
        r.item=null;r.shield=r.star=r.boost=0;r.bubble.visible=r.starModel.visible=false;
      }
      this.placeMarker(r);
    }
    level.raceActorId=0;level.playerPos.copy(this.human.pos);level.update(dt);this.contact();if(allFinished)this.clearItems();else{this.updateItems(dt);this.updateThreats(dt);}this.effects.update(dt);
    for(const [box,seconds] of this.returns){if(seconds<=dt){level.reviveRaceCrate(box,this.homes.get(box)!);this.returns.delete(box);}else this.returns.set(box,seconds-dt);}
    // Only human-owned unique boxes count. NPC blast rewards never leak through
    // the single-player queue, and repeated item-box laps cannot farm the gem.
    level.consumeBlastBroken();this.human.cratesBroken=this.riders[0].boxes.size;
    if(this.mode==='time-trial'){this.human.ttTime=this.riders[0].finish??this.elapsed;this.human.ttFreeze=0;}
    const human=this.riders[0];
    if(human.finish!==null&&!this.reported){
      this.reported=true;this.phase='finished';const rank=this.rank(),won=this.mode==='race'&&rank===1,boxGem=human.boxes.size===level.totalCrates&&level.totalCrates>0;
      this.human.hasCrystal=won;this.human.gemEarned=boxGem;
      this.onFinish({mode:this.mode,rank,time:human.finish,won,boxes:human.boxes.size,totalBoxes:level.totalCrates,boxGem});
    }

  }
  private finishRollout(r:Rider,dt:number):void {
    const p=r.player,roll=r.rollout,level=this.level!;
    if(!roll){p.updateResultsPose(dt);return;}
    roll.time+=dt;
    const speed=roll.speed*Math.max(0,1-roll.time/Math.max(.001,roll.duration));
    // Native ground/air movement and board animation finish the crossing.
    // Finished riders are excluded from race contact, item and cart targets.
    if(roll.time<roll.duration||!p.grounded&&roll.time<2){
      const next=p.pos.clone().addScaledVector(roll.heading,speed*dt+.4);
      if(this.course!.supportAt(level,next,this.a,2,10)){
        p.applyRaceImpulse(roll.heading,speed);
        level.raceActorId=r.id;
        sfx.withGain(this.soundGain(r),()=>p.step(dt,blankInput(),level),r.id?'race-rivals':'');
        p.ttTime=r.finish!;
        return;
      }
    }
    p.prepareResultsPose(level,p.pos.clone(),roll.heading,this.rank(r.id)===1);
    r.rollout=null;
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
      };if(a.star>0&&b.star<=0)this.hit(b,a.player.pos);if(b.star>0&&a.star<=0)this.hit(a,b.player.pos);attack(a,b);attack(b,a);
      if(d<.85&&Math.abs(dy)<.8&&a.player.grounded&&b.player.grounded){const n=Math.max(.01,d),push=(.85-d)*.5;this.a.set(d?dx/n:1,0,d?dz/n:0);a.player.pos.addScaledVector(this.a,-push);b.player.pos.addScaledVector(this.a,push);}
    }
  }
  private nearSegment(point:THREE.Vector3,from:THREE.Vector3,to:THREE.Vector3,radius:number):boolean {
    const delta=this.b.copy(to).sub(from),length=delta.lengthSq();
    const t=length?THREE.MathUtils.clamp(this.a.copy(point).sub(from).dot(delta)/length,0,1):0;
    return this.a.copy(from).addScaledVector(delta,t).distanceToSquared(point)<=radius*radius;
  }
  private blocked(from:THREE.Vector3,to:THREE.Vector3):boolean {
    const length=from.distanceTo(to);if(length<.001)return false;
    this.ray.set(from,this.a.copy(to).sub(from).normalize());
    return this.level!.walls.some(box=>this.ray.intersectBox(box,this.wallHit)!==null&&this.wallHit.distanceTo(from)<=length);
  }
  private updateItems(dt:number):void {
    const c=this.course!,level=this.level!;
    for(const p of this.projectiles){
      if(p.time>=90)continue;
      p.time+=dt;p.phaseTime+=dt;p.previous.copy(p.mesh.position);
      if(p.type==='shock-shell'){
        p.mesh.rotation.y+=dt*2;p.mesh.position.copy(this.riders[p.owner].player.pos).y+=4;
        if(p.time>=1.6){
          for(const r of this.riders.slice(0,this.count))if(r.id!==p.owner&&r.finish===null&&!r.recovery){
            const ground=c.supportAt(level,r.player.pos,vec(),1,35)??r.player.pos.clone().add(new THREE.Vector3(0,-3,0));
            this.effects.lightning(ground);
            // A timed normal hop avoids the ground strike. Never knock a rider
            // out of a gap jump, ledge traversal or an existing knockdown.
            if(r.shield>0||r.player.grounded||r.player.state==='grind'||r.player.swimming)this.hit(r);
            p.hit.add(r.id);
          }
          if(this.riders[0].finish===null){sfx.play('tntBoom',.45,.65);sfx.play('enemySentryFire',.35,1.15);}
          p.time=99;
        }
        continue;
      }
      if(p.type==='water-bomb'){
        if(p.phase==='travel'){
          p.velocityY-=24*dt;p.mesh.position.addScaledVector(p.direction,dt*38);p.mesh.position.y+=p.velocityY*dt;
          const ground=c.supportAt(level,p.mesh.position,vec(),2,15);
          if((ground&&p.velocityY<0&&p.mesh.position.y<=ground.y+.7)||this.blocked(p.previous,p.mesh.position)){
            if(ground)p.mesh.position.y=ground.y+.7;p.locked.copy(p.mesh.position);p.phase='windup';p.phaseTime=0;this.effects.pulse(p.locked,0x39c9ed,4.5);
          }
        }else if(p.phaseTime>=.7){
          for(const other of this.riders.slice(0,this.count))if(other.id!==p.owner&&Math.hypot(other.player.pos.x-p.locked.x,other.player.pos.z-p.locked.z)<4.5&&Math.abs(other.player.pos.y-(p.locked.y-.7))<1.6)this.hit(other,p.locked);
          this.effects.pulse(p.locked,0x8df3ff,5);sfx.withGain(this.soundGain(this.riders[p.owner]),()=>sfx.waterPlop(),p.owner?'race-rivals':'');p.time=99;
        }
        continue;
      }
      if(p.type==='tidal-wave'){
        if(p.time<1){p.progress=this.riders[p.owner].progress;p.mesh.position.copy(this.riders[p.owner].player.pos).y+=.7;p.mesh.scale.y=Math.max(.2,p.time*1.35);continue;}p.mesh.scale.y=1.35;
        p.progress+=dt*68;c.sample(p.progress,0,p.mesh.position).y+=.7;
        const forward=c.tangent(p.progress);p.direction.copy(forward);p.mesh.rotation.y=Math.atan2(forward.x,forward.z);p.mesh.scale.x=c.width(p.progress)/.6;
        for(const other of this.riders.slice(0,this.count))if(other.id!==p.owner&&!p.hit.has(other.id)&&other.finish===null&&!other.recovery&&Math.abs(other.progress-p.progress)<3){
          const centre=c.sample(other.progress);const horizontal=Math.hypot(other.player.pos.x-centre.x,other.player.pos.z-centre.z);
          if(horizontal<c.width(p.progress)/2&&Math.abs(other.player.pos.y-centre.y)<1.5){this.hit(other,p.mesh.position);p.hit.add(other.id);}
        }
        if(p.progress>=c.length)p.time=99;continue;
      }
      if(p.type==='boomerang'){
        const owner=this.riders[p.owner];
        if(p.time>1){
          if(p.phase!=='strike'){p.phase='strike';p.hit.clear();}
          p.direction.copy(owner.player.pos).add(new THREE.Vector3(0,1,0)).sub(p.mesh.position).normalize();
          if(owner.recovery||p.mesh.position.distanceTo(owner.player.pos)<2){p.time=99;continue;}
        }
        p.mesh.position.addScaledVector(p.direction,dt*40);p.mesh.rotation.y+=dt*18;
        if(this.blocked(p.previous,p.mesh.position)){p.time=99;continue;}
      }else if(p.type==='red-shell'||p.type==='blue-shell'){
        const target=this.riders[p.target],blue=p.type==='blue-shell';
        if(!target||target.finish!==null||target.recovery){p.time=99;continue;}
        const point=target.player.pos;
        if(p.phase==='travel'){
          const speed=blue?76:51;
          p.progress=Math.min(target.progress,p.progress+dt*speed);
          const offset=c.project(point,target.progress,25).offset;
          p.offset+=(offset-p.offset)*Math.min(1,dt*5);
          c.sample(p.progress,THREE.MathUtils.clamp(p.offset,-c.width(p.progress)*.35,c.width(p.progress)*.35),this.a);this.a.y+=blue?2.8:.7;
          this.b.copy(this.a).sub(p.mesh.position);p.mesh.position.addScaledVector(this.b,Math.min(1,dt*speed/Math.max(.01,this.b.length())));
          if(p.time>=.6&&Math.abs(target.progress-p.progress)<(blue?18:12)&&p.mesh.position.distanceTo(point)<(blue?22:16)){p.phase='windup';p.phaseTime=0;}
        }else if(p.phase==='windup'){
          const lead=blue?1.1:.65;
          const aim=point.clone().addScaledVector(target.player.raceHeading,blue?0:-5);aim.y+=blue?3.5:.75;
          if(blue){aim.x+=Math.cos(p.phaseTime*9)*2;aim.z+=Math.sin(p.phaseTime*9)*2;}
          this.b.copy(aim).sub(p.mesh.position);p.mesh.position.addScaledVector(this.b,Math.min(1,dt*70/Math.max(.01,this.b.length())));
          if(p.phaseTime>=lead){
            p.phase='strike';p.phaseTime=0;p.locked.copy(point).addScaledVector(target.velocity,blue?.8:.25);p.locked.y+=.8;
            p.direction.copy(p.locked).sub(p.mesh.position).normalize();
          }
        }else if(blue){
          p.mesh.position.lerp(p.locked,Math.min(1,dt/Math.max(dt,.8-p.phaseTime+dt)));
          if(p.phaseTime>=.8){
            this.effects.pulse(p.locked,0x418cde,3.2);
            for(const other of this.riders.slice(0,this.count))if(other.id!==p.owner&&other.dodge<=0&&other.player.pos.clone().add(new THREE.Vector3(0,.8,0)).distanceTo(p.locked)<3.2)this.hit(other,p.locked);
            p.time=99;continue;
          }
        }else{
          p.mesh.position.addScaledVector(p.direction,dt*58);
          if(p.phaseTime>1.1){p.time=99;continue;}
        }
        p.mesh.rotation.y+=dt*9;
        if(!blue&&this.blocked(p.previous,p.mesh.position)){this.effects.pulse(p.mesh.position,0xe95447,2);p.time=99;continue;}
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
        if(this.blocked(p.previous,p.mesh.position)){this.effects.pulse(p.mesh.position,0x48b457,2);p.time=99;continue;}
        p.mesh.rotation.y+=dt*11;
      }else{
        const ground=c.supportAt(level,p.mesh.position,this.a,3,8);if(ground)p.mesh.position.y=ground.y+.025;
      }
      if(p.type==='red-shell'||p.type==='green-shell'||p.type==='boomerang'){
        for(const trap of this.projectiles)if(trap!==p&&trap.time<90&&(trap.type==='banana'||trap.type==='green-shell'||trap.type==='boomerang'||p.type==='green-shell'&&trap.type==='red-shell')&&this.nearSegment(trap.mesh.position,p.previous,p.mesh.position,1.6)){
          p.time=trap.time=99;this.effects.pulse(trap.mesh.position,0xffda39,2);break;
        }
        if(p.time>=90)continue;
      }
      // Homing shots announce, then commit. They cannot cause contact damage
      // during their warning or secretly retarget after a successful dodge.
      if(p.type==='blue-shell'||p.type==='red-shell'&&p.phase!=='strike')continue;
      for(const r of this.riders.slice(0,this.count)){
        if(r.id===p.owner||p.hit.has(r.id)||r.recovery||r.finish!==null)continue;
        const centre=r.player.pos.clone();centre.y+=p.type==='banana'?.2:1;
        if(!this.nearSegment(centre,p.previous,p.mesh.position,r.parry>0?2.6:1.5))continue;
        if(r.parry>0&&p.type!=='banana'){
          this.effects.pulse(r.player.pos,0xfff4c7,3);sfx.withGain(this.soundGain(r),()=>sfx.play('railLand',.7,1.3),r.id?'race-rivals':'');
        }else this.hit(r,p.mesh.position);
        p.hit.add(r.id);if(p.type!=='boomerang'||r.parry>0)p.time=99;break;
      }
    }
    this.projectiles=this.projectiles.filter(p=>{
      const life=p.type==='banana'?22:p.type==='blue-shell'||p.type==='tidal-wave'?75:p.type==='boomerang'?4:12;
      if(p.time<life&&p.mesh.position.y>level.killY&&p.bounces<7)return true;
      disposeRaceItemModel(p.mesh);return false;
    });
  }
  private approachingTime(p:Projectile,r:Rider,speed:number,limit:number):number {
    const velocity=p.direction.clone().multiplyScalar(speed).sub(r.velocity),delta=p.mesh.position.clone().sub(r.player.pos);delta.y-=.8;
    const length=velocity.lengthSq(),closest=length?-delta.dot(velocity)/length:-1;
    return closest>=0&&closest<=limit&&delta.addScaledVector(velocity,closest).length()<=3.2?closest:Infinity;
  }
  private updateThreats(dt:number):void {
    for(const r of this.riders.slice(0,this.count)){
      r.threats=[];r.targetRing.visible=r.storm.visible=false;
      if(r.finish!==null||r.recovery)continue;
      const forward=this.viewForward.lengthSq()>.1?this.viewForward:r.player.raceHeading;
      for(const p of this.projectiles){
        if(p.owner===r.id||p.type==='banana')continue;
        let seconds=Infinity;
        if(p.type==='shock-shell')seconds=1.6-p.time;
        else if(p.type==='water-bomb'){
          if(p.phase!=='windup'||p.locked.distanceTo(r.player.pos)>9)continue;seconds=.7-p.phaseTime;
        }else if(p.type==='tidal-wave'){
          if(p.hit.has(r.id)||r.progress<p.progress-3)continue;
          seconds=Math.max(0,1-p.time)+(r.progress-p.progress)/Math.max(12,68-Math.abs(r.player.speed));if(seconds>4)continue;
        }
        else if(p.type==='blue-shell'||p.type==='red-shell'){
          if(p.target!==r.id)continue;
          seconds=p.phase==='strike'?(p.type==='blue-shell'?.8-p.phaseTime:this.approachingTime(p,r,58,1.1)):
            p.phase==='windup'?(p.type==='blue-shell'?1.9:.9)-p.phaseTime:
              Math.max(0,r.progress-p.progress)/Math.max(12,(p.type==='blue-shell'?76:51)-Math.abs(r.player.speed))+(p.type==='blue-shell'?1.9:.9);
          if(seconds>4)continue;
        }else{
          seconds=this.approachingTime(p,r,p.type==='boomerang'?40:43,2.5);if(!Number.isFinite(seconds))continue;
        }
        const dx=p.mesh.position.x-r.player.pos.x,dz=p.mesh.position.z-r.player.pos.z;
        r.threats.push({item:p.type,seconds:Math.max(0,seconds),bearing:Math.atan2(-dx*forward.z+dz*forward.x,dx*forward.x+dz*forward.z),urgent:seconds<.8});
      }
      r.threats.sort((a,b)=>a.seconds-b.seconds);r.threats.length=Math.min(2,r.threats.length);
      const threat=r.threats[0];if(!threat)continue;
      r.targetRing.visible=true;r.targetRing.material.color.set(RACE_ITEMS[threat.item].color);
      r.targetRing.position.copy(r.player.pos).y+=.12;r.targetRing.scale.setScalar(threat.urgent?1.5:2.3);
      const dive=this.projectiles.find(p=>p.type==='blue-shell'&&p.target===r.id&&p.phase==='strike'||p.type==='water-bomb'&&p.phase==='windup'&&p.locked.distanceTo(r.player.pos)<9);
      if(dive){r.targetRing.position.copy(dive.locked);r.targetRing.position.y-=.65;r.targetRing.scale.setScalar(dive.type==='water-bomb'?4.5:3.2);}
      if(r.threats.some(t=>t.item==='shock-shell')){r.storm.visible=true;r.storm.position.copy(r.player.pos).y+=4;r.storm.rotation.y=this.elapsed*2;}
    }
    this.warningBeep-=dt;
    const threat=this.riders[0].threats[0];
    if(threat&&this.warningBeep<=0){sfx.play('tntCount2',.35,threat.item==='shock-shell'?.7:threat.urgent?1.6:1.2);this.warningBeep=threat.urgent?.23:.55;}
    if(!threat)this.warningBeep=0;
  }
  private placeMarker(r:Rider,position=r.player.pos):void {r.starModel.visible=r.star>0&&r.finish===null&&!r.recovery;r.starModel.position.copy(position).add(new THREE.Vector3(Math.sin(this.elapsed*5)*1.8,2.2,Math.cos(this.elapsed*5)*1.8));r.starModel.rotation.y=this.elapsed*6;r.marker.visible=this.phase==='running'&&position.distanceTo(this.viewOrigin)>7&&r.id>0&&r.id<this.count&&!r.recovery&&r.finish===null;r.marker.position.copy(position).y+=3.4;r.bubble.position.copy(position).y+=1.2;r.bubble.visible=r.shield>0&&r.recovery===0&&r.id<this.count&&r.finish===null;}
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
    const h=this.riders[0];return {title:this.level.name,sections:this.sections,medalTimes:this.level.medalTimes,medal:this.mode==='time-trial'&&h.finish!==null?medalForTime(h.finish,this.level.medalTimes):null,phase:this.phase,mode:this.mode,countdown:this.countdown,elapsed:h.finish??this.elapsed,rank:this.rank(),item:h.item,shield:h.shield,star:h.star,
      recovering:h.recovery,threats:h.threats,boxes:h.boxes.size,totalBoxes:this.level.totalCrates,won:h.finish!==null&&this.rank()===1&&this.mode==='race',
      racers:this.order().map(r=>({id:r.id,...RACE_ROSTER[r.id],x:r.player.pos.x,y:r.player.pos.y,z:r.player.pos.z,progress:r.progress/this.course!.length,finish:r.finish})),line:this.level.skateRace!.line,visible:true};
  }
}
