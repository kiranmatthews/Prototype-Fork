import { medalForTime } from '../campaign';
import * as THREE from 'three';
import { Player } from '../player';
import type { Input } from '../input';
import type { Crate, Level } from '../level';
import type { WipeoutCause } from '../character/wipeoutPolicy';
import { RaceCourse } from './course';
import { RACE_ROSTER, type RaceHudState, type RaceItem, type RaceMode, type RacePhase } from './types';

export interface RaceResult { mode:RaceMode; rank:number; time:number; won:boolean; boxes:number; totalBoxes:number; boxGem:boolean }
interface Rider {
  id:number; player:Player; scene:THREE.Scene|null; progress:number; previousProgress:number;
  finish:number|null; item:RaceItem|null; shield:number; boost:number; itemCooldown:number;
  boxes:Set<Crate>; anchor:THREE.Vector3; anchorProgress:number; anchorSpeed:number; recovery:number; falls:number;
  pendingFall:boolean; braking:boolean; oldJump:boolean; jumped:number; knockGrace:number; marker:THREE.Mesh; bubble:THREE.Mesh;
}
interface Projectile { type:'rocket'|'trap'|'pulse'; owner:number; target:number; direction:THREE.Vector3; mesh:THREE.Mesh; time:number; hit:Set<number> }
const vec = () => new THREE.Vector3();
const blankInput = ():Input => ({moveX:0,moveY:0,jumpHeld:false,grindHeld:false,spinHeld:false,grabHeld:false,transferHeld:false,
  jumpPressed:false,jumpReleased:false,jumpCancelled:false,grindPressed:false,spinPressed:false,grabPressed:false,transferPressed:false,
  itemPressed:false,restartPressed:false,consumeEdges(){}} as unknown as Input);
const TIME_TO_RETURN=1.8;

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
  constructor(private scene:THREE.Scene,private human:Player){scene.add(this.root);}
  get active():boolean{return !!this.level;}
  get count():number{return this.mode==='race'?8:1;}
  private allocate():void {
    if(this.riders.length)return;
    for(let id=0;id<8;id++){
      const actorScene=id?new THREE.Scene():null;
      if(actorScene)this.scene.add(actorScene);
      const player=id?new Player(actorScene!):this.human;
      const marker=new THREE.Mesh(new THREE.ConeGeometry(.26,.5,4),new THREE.MeshBasicMaterial({color:RACE_ROSTER[id].color}));
      marker.rotation.z=Math.PI;this.root.add(marker);
      const bubble=new THREE.Mesh(new THREE.IcosahedronGeometry(1.35,1),new THREE.MeshBasicMaterial({color:0x87e9c3,transparent:true,opacity:.22,depthWrite:false,wireframe:true}));
      bubble.visible=false;this.root.add(bubble);
      this.riders.push({id,player,scene:actorScene,progress:0,previousProgress:0,finish:null,item:null,shield:0,boost:0,itemCooldown:0,
        boxes:new Set(),anchor:vec(),anchorProgress:0,anchorSpeed:0,recovery:0,falls:0,pendingFall:false,braking:false,oldJump:false,jumped:-1,knockGrace:0,marker,bubble});
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
      r.player.enterLevel(this.levelId);r.player.raceHooks={hazard:(cause,origin)=>this.hazard(r,cause,origin)};
      r.player.racePresentationInterval=r.id===0?0:1/15;
      r.player.resetRacePosition(level,start,this.course.tangent(0));
      r.player.hasCrystal=false;r.player.gemEarned=false;r.player.cratesBroken=0;r.player.bonusCrates=0;
      r.player.ttActive=mode==='time-trial';r.player.ttTime=0;r.player.ttFreeze=0;
      r.progress=r.previousProgress=0;r.finish=null;r.item=null;r.shield=r.boost=r.recovery=r.falls=r.knockGrace=0;
      r.itemCooldown=3+r.id*.3;r.boxes.clear();r.anchor.copy(level.spawnPos);r.anchorProgress=0;r.anchorSpeed=0;r.pendingFall=false;r.braking=false;r.oldJump=false;r.jumped=-1;
      if(r.scene){r.scene.visible=r.id<this.count;if(r.id<this.count&&r.scene.parent!==this.scene)this.scene.add(r.scene);else if(r.id>=this.count)r.scene.removeFromParent();}
      r.marker.visible=r.id<this.count;r.player.prepareStartPresentation(level);this.placeMarker(r);
    }
  }
  start(mode:RaceMode=this.mode):void {this.reset(mode);this.phase='countdown';}
  private random():number {let x=this.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x;return (x>>>0)/4294967296;}
  private crateBroken(c:Crate,id:number):void {
    const r=this.riders[id];if(!r||id>=this.count||this.phase!=='running'&&this.phase!=='finished')return;
    r.boxes.add(c);r.player.cratesBroken=r.boxes.size;
    if(c.mystery&&!r.item){
      const rank=this.rank(r.id),pool:RaceItem[]=rank<=2?['shield','trap','pulse']:rank>=6?['boost','rocket','shield']:['rocket','pulse','shield','trap','boost'];
      r.item=pool[Math.floor(this.random()*pool.length)];
    }
    this.returns.set(c,c.mystery?4:7);
  }
  private hazard(r:Rider,cause:WipeoutCause,origin?:THREE.Vector3):void {
    if(this.phase!=='running'&&this.phase!=='finished'||r.recovery>0||r.finish!==null)return;
    if(cause==='pit'||cause==='water'){r.pendingFall=true;return;}
    this.hit(r,origin);
  }
  private hit(r:Rider,origin?:THREE.Vector3):boolean {
    if(r.recovery>0||r.finish!==null||r.knockGrace>0)return false;
    if(r.shield>0){r.shield=0;r.knockGrace=.8;return false;}
    const direction=origin?this.a.copy(r.player.pos).sub(origin).setY(0).normalize():this.a.copy(r.player.raceHeading);
    const sign=direction.x*r.player.raceHeading.z-direction.z*r.player.raceHeading.x>=0?1:-1;
    if(!r.player.beginRaceStun(4.5,sign))return false;
    if(origin){r.player.applyRaceImpulse(direction,7);}
    r.knockGrace=1.5;r.boost=0;return true;
  }
  private recover(r:Rider):void {
    r.falls++;r.pendingFall=false;r.recovery=TIME_TO_RETURN;r.boost=0;r.jumped=-1;r.oldJump=this.jumps.some(j=>r.anchorProgress>=j.s-5&&r.anchorProgress<j.end);
    r.progress=r.anchorProgress;
    r.player.resetRacePosition(this.level!,r.anchor,this.course!.tangent(r.anchorProgress));
  }
  /** UI and replay both feed this one semantic item edge. */
  useItem(id=0):boolean {
    const r=this.riders[id];if(!r?.item||(this.phase!=='running'&&(this.phase!=='finished'||id===0))||r.recovery>0||r.finish!==null||r.player.skateCameraBailing)return false;
    const item=r.item;r.item=null;
    if(item==='shield'){r.shield=8;return true;}
    if(item==='boost'){r.boost=2.5;return true;}
    const order=this.order(),index=order.indexOf(r),target=index>0?order[index-1]:null;
    const geo=item==='trap'?new THREE.TorusGeometry(.6,.18,6,12):item==='pulse'?new THREE.TorusGeometry(1,.09,6,24):new THREE.ConeGeometry(.3,1,6);
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:item==='trap'?0xd4a3fa:item==='pulse'?0x70d9f4:0xf18c61}));
    mesh.position.copy(r.player.pos);mesh.position.y+=item==='trap'?.2:1;
    if(item==='trap'){mesh.rotation.x=Math.PI/2;mesh.position.addScaledVector(r.player.raceHeading,-2);}
    if(item==='rocket')mesh.geometry.rotateX(Math.PI/2);
    this.root.add(mesh);this.projectiles.push({type:item,owner:id,target:target?.id??-1,direction:r.player.raceHeading,mesh,time:0,hit:new Set()});return true;
  }
  private clearItems():void {for(const p of this.projectiles){p.mesh.removeFromParent();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();}this.projectiles=[];}
  order():Rider[] {return this.riders.slice(0,this.count).sort((a,b)=>a.finish!==null&&b.finish!==null?a.finish-b.finish:a.finish!==null?-1:b.finish!==null?1:b.progress-a.progress||a.id-b.id);}
  rank(id=0):number {return this.order().findIndex(r=>r.id===id)+1;}
  /** Production input pilot, also useful for deterministic end-to-end QA. */
  drive(id:number):Input {
    const r=this.riders[id],p=r.player,c=this.course!,input=blankInput();
    if(r.finish!==null)return input;
    if(r.recovery>0){input.jumpHeld=r.oldJump;return input;}
    const look=THREE.MathUtils.clamp(Math.abs(p.speed)*.48,5,24);
    let lateral=this.mode==='time-trial'?0:((id%4)-1.5)*1.45;
    // All riders can reach the same item row; avoid live explosive crates.
    c.sample(r.progress+look,lateral,this.a);
    for(const box of this.level!.crates)if(box.alive&&(box.tnt||box.nitro)&&Math.abs(box.mesh.position.y-this.a.y)<3&&box.mesh.position.distanceTo(this.a)<4){lateral=lateral<0?3.4:-3.4;break;}
    c.sample(r.progress+look,lateral,this.a);
    if(r.progress>c.length-25)this.a.addScaledVector(c.tangent(c.length),30);
    const dx=this.a.x-p.pos.x,dz=this.a.z-p.pos.z,n=Math.hypot(dx,dz)||1,basis=p.raceInputBasis(this.level!);
    const bn=Math.hypot(basis.x,basis.z)||1,fx=basis.x/bn,fz=basis.z/bn;
    input.moveX=THREE.MathUtils.clamp((dx*-fz+dz*fx)/n,-1,1);input.moveY=THREE.MathUtils.clamp((dx*fx+dz*fz)/n,-1,1);
    input.jumpHeld=true;
    for(let i=0;i<this.jumps.length;i++){
      const jump=this.jumps[i];
      if(r.progress>=jump.s&&r.progress<jump.end&&r.jumped!==i&&p.grounded){
        // A returned rider needs a held sample before the real release edge.
        input.jumpHeld=!r.oldJump;if(r.oldJump)r.jumped=i;break;
      }
      if(r.jumped===i&&r.progress<jump.end&&!p.grounded)input.jumpHeld=false;
    }
    if(r.progress>(this.jumps[this.jumps.length-1]?.end??0)+1){
      input.jumpHeld=false;
      r.braking=p.grounded&&(r.braking?Math.abs(p.speed)>25:Math.abs(p.speed)>35);
      input.grabHeld=r.braking;
    }
    input.jumpPressed=input.jumpHeld&&!r.oldJump;input.jumpReleased=!input.jumpHeld&&r.oldJump;r.oldJump=input.jumpHeld;
    if(p.state==='grind'){input.moveX=THREE.MathUtils.clamp(-p.balance*5-p.balanceVel*.7,-1,1);input.grindHeld=true;}
    const nearby=this.riders.some(v=>v!==r&&v.id<this.count&&v.recovery===0&&v.player.pos.distanceTo(p.pos)<2);
    input.spinPressed=nearby&&Math.floor((this.elapsed+id*.3)*2)%5===0;input.spinHeld=input.spinPressed;
    if(r.itemCooldown<=0&&r.item){input.itemPressed=true;r.itemCooldown=3.2+id*.17;}
    return input;
  }
  /** Called instead of the ordinary player step while a race level is loaded. */
  step(dt:number,input:Input):void {
    const level=this.level,c=this.course;if(!level||!c)return;
    if(input.raceStartPressed||input.raceTrialStartPressed)this.start(input.raceTrialStartPressed?'time-trial':'race');
    if(this.phase==='grid'||this.phase==='countdown'){
      if(this.phase==='grid'&&input.jumpPressed)this.start(this.mode);
      else if(this.phase==='countdown'){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.phase='running';}
      for(const r of this.riders.slice(0,this.count)){r.player.prepareStartPresentation(level,dt);this.placeMarker(r);}return;
    }
    if(this.phase==='finished'&&this.riders.slice(0,this.count).every(r=>r.finish!==null)){for(const r of this.riders.slice(0,this.count))r.player.updateResultsPose(dt);return;}
    this.elapsed+=dt;
    for(const r of this.riders.slice(0,this.count)){
      const p=r.player;r.previousProgress=r.progress;r.shield=Math.max(0,r.shield-dt);r.knockGrace=Math.max(0,r.knockGrace-dt);r.itemCooldown-=dt;
      if(r.finish!==null){p.updateResultsPose(dt);continue;}
      if(r.recovery>0){
        r.recovery=Math.max(0,r.recovery-dt);const t=1-r.recovery/TIME_TO_RETURN;
        p.pos.copy(r.anchor);p.pos.y+=Math.pow(1-t,2)*5;
        p.prepareBonusAlignmentPresentation(level,dt,{needed:true,phase:t,progress:t,offsetY:p.pos.y-r.anchor.y,airborne:t<.92,verticalVelocity:-10*(1-t)/TIME_TO_RETURN,airborneSeconds:t*TIME_TO_RETURN,launchVelocity:4});
        if(r.recovery===0){p.resetRacePosition(level,r.anchor,c.tangent(r.anchorProgress));r.knockGrace=1;p.resumeRaceMomentum(r.anchorSpeed);}
        this.placeMarker(r);continue;
      }
      level.raceActorId=r.id;const device=r.id===0?input:this.drive(r.id);
      if(device.itemPressed)this.useItem(r.id);
      if(r.boost>0){r.boost=Math.max(0,r.boost-dt);p.speed=Math.min(36,Math.max(0,p.speed)+dt*18);}
      p.racePresentationInterval=r.id===0?0:p.pos.distanceToSquared(this.human.pos)<1600?1/30:1/10;
      p.step(dt,device,level);
      const projected=c.project(p.pos,r.progress,80);r.progress=projected.s;
      const centre=c.sample(r.progress,0,this.a);
      if(r.pendingFall||p.pos.y<centre.y-9||projected.distance>c.width(r.progress)/2+8&&p.pos.y<centre.y-2){this.recover(r);}
      else if(p.grounded||p.state==='grind'){
        const support=c.support(level,r.progress,this.b);
        if(support&&p.pos.distanceTo(support)<c.width(r.progress)/2+4){r.anchor.copy(support);r.anchorProgress=r.progress;r.anchorSpeed=Math.max(0,p.speed);}
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
    for(const r of this.riders.slice(0,this.count))r.player.commitRenderStep(level);
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
    for(const p of this.projectiles){
      p.time+=dt;
      if(p.type==='rocket'){
        const target=this.riders[p.target];
        if(target){this.a.copy(target.player.pos).add(new THREE.Vector3(0,1,0)).sub(p.mesh.position);if(this.a.length()>1)p.mesh.position.addScaledVector(this.a.normalize(),dt*44);p.mesh.lookAt(target.player.pos);}
        else {p.mesh.position.addScaledVector(p.direction,dt*44);p.mesh.lookAt(this.a.copy(p.mesh.position).add(p.direction));}
      }else if(p.type==='pulse'){
        p.mesh.position.copy(this.riders[p.owner].player.pos).add(new THREE.Vector3(0,1,0));p.mesh.scale.setScalar(1+p.time*9);p.mesh.rotation.x=Math.PI/2;
      }
      const radius=p.type==='pulse'?1+p.time*9:1.2;
      for(const r of this.riders.slice(0,this.count))if(r.id!==p.owner&&!p.hit.has(r.id)&&r.recovery===0&&r.player.pos.distanceTo(p.mesh.position)<radius+1){
        this.hit(r,p.mesh.position);p.hit.add(r.id);if(p.type!=='pulse')p.time=99;
      }
    }
    this.projectiles=this.projectiles.filter(p=>{if(p.time<(p.type==='pulse'?.65:p.type==='rocket'?5:12))return true;p.mesh.removeFromParent();p.mesh.geometry.dispose();(p.mesh.material as THREE.Material).dispose();return false;});
  }
  private placeMarker(r:Rider):void {r.marker.position.copy(r.player.pos).y+=3.5;r.bubble.position.copy(r.player.pos).y+=1.2;r.bubble.visible=r.shield>0&&r.recovery===0&&r.id<this.count;}
  applyRenderInterpolation(alpha:number):void {for(const r of this.riders.slice(1,this.count)){r.player.applyRenderInterpolation(alpha);this.placeMarker(r);}}
  restoreRenderPose():void {for(const r of this.riders.slice(1,this.count))r.player.restoreRenderPose();}
  setVisible(visible:boolean):void {this.root.visible=visible&&this.active;for(const r of this.riders)if(r.scene){r.scene.visible=visible&&this.active&&r.id<this.count;if(r.scene.visible&&r.scene.parent!==this.scene)this.scene.add(r.scene);else if(!r.scene.visible)r.scene.removeFromParent();}}
  hud():RaceHudState|undefined {
    if(!this.level||!this.course)return;
    const h=this.riders[0];return {title:this.level.name,sections:this.sections,medalTimes:this.level.medalTimes,medal:this.mode==='time-trial'&&h.finish!==null?medalForTime(h.finish,this.level.medalTimes):null,phase:this.phase,mode:this.mode,countdown:this.countdown,elapsed:h.finish??this.elapsed,rank:this.rank(),item:h.item,shield:h.shield,
      recovering:h.recovery,boxes:h.boxes.size,totalBoxes:this.level.totalCrates,won:h.finish!==null&&this.rank()===1&&this.mode==='race',
      racers:this.order().map(r=>({id:r.id,...RACE_ROSTER[r.id],x:r.player.pos.x,y:r.player.pos.y,z:r.player.pos.z,progress:r.progress/this.course!.length,finish:r.finish})),line:this.level.skateRace!.line,visible:true};
  }
}
