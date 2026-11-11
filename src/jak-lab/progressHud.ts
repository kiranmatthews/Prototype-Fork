import {Vector3} from 'three';
import type {ParticleHost} from './particleMotion';
import type {ScreenHudLayer} from './screenHud';
import {initialProgressPlacement,isProgressStats,placeProgress,type ProgressPlacementState} from './progressPlacement';
import type {ProgressHudDefinition,ProgressPage,ScreenHudProfile} from './types';

export interface ProgressIconPose {index:number;seconds:number;frame:number|null;yaw:number;scaleX:number;scaleY:number;z:number}
/** Particle owner for the original menu, sampled at the source's NTSC 60 Hz.
 * Inspection inputs replace game facts/save data, never the source transition
 * arithmetic. The four source rigs are independent of the gallery camera. */
export class ProgressHud {
  profile:ScreenHudProfile;
  phase:'waiting'|'arriving'|'in'|'leaving'|'hidden'='waiting';
  hold=true;
  clock=0;offset=0;transition=0;
  page:ProgressPage='fuel-cell';nextPage:ProgressPage='fuel-cell';
  statTransition=false;levelTransition:0|1|2=0;
  otherHudVisible=false;levelOpen=true;previousAvailable=true;nextAvailable=true;
  taskStates=[1,2,3,2,3,1,2,3];taskIndex=2;option=0;
  filledSlots=[true,false,true,false];cardReady=true;
  placement:ProgressPlacementState;
  readonly joints=Array.from({length:4},()=>new Map<number,Vector3>());
  private carry=0;private waited=false;private lastOptionChange=0;private changingLevel=false;
  private contexts:NonNullable<ParticleHost['progress']>[];
  constructor(readonly definition:ProgressHudDefinition,readonly layers:ScreenHudLayer[],
    readonly sample:(pose:ProgressIconPose,joints:Map<number,Vector3>)=>void) {
    this.profile=definition.profiles.find(profile=>profile.id==='4:3')!;
    if(!this.profile)throw new Error('Missing source progress HUD format');
    this.placement=initialProgressPlacement(definition,this.profile);
    this.contexts=layers.map(({sourceIndex,motion})=>{
      const context:NonNullable<ParticleHost['progress']>={owner:sourceIndex,states:this.placement.states,
        joints:this.joints,leftScale:[0,0],rightScale:[0,0],xScale:1,slotScale:0,option:0,offset:0,transitionInverse:0};
      motion.host.progress=context;motion.issues.delete('Screen-space host layout');return context;
    });
    this.restart();
  }
  get aspect():number{return this.profile.id==='4:3'?4/3:16/9;}
  get inTransition():boolean{return this.transition!==0;}
  get transitionSpeed():number {
    return this.page==='save-game'&&this.phase==='leaving'?this.definition.rates.saveDeparture:
      isProgressStats(this.page)||this.page==='save-game'?this.definition.rates.stats:this.definition.rates.other;
  }
  select(id:string):void {
    const profile=this.definition.profiles.find(profile=>profile.id===id);
    if(!profile)throw new Error(`Unknown progress HUD format ${id}`);
    this.profile=profile;
  }
  selectPage(page:ProgressPage):void {
    if(page===this.nextPage)return;
    this.nextPage=page;
    this.statTransition=isProgressStats(this.page)&&isProgressStats(page);
    if(this.phase==='hidden'||this.phase==='waiting'){this.page=page;this.restart();}
  }
  selectOption(option:number):void {this.option=option;this.lastOptionChange=this.clock;}
  changeLevel(direction:1|2):void {
    if(this.phase!=='in'||this.inTransition||!isProgressStats(this.page))return;
    if(direction===1?!this.nextAvailable:!this.previousAvailable)return;
    this.levelTransition=direction;this.changingLevel=true;
  }
  show():void {this.restart();}
  hide(quick=false):void {
    this.phase=quick||this.phase==='waiting'?'hidden':'leaving';
    this.placement.positions[3].x=this.placement.positions[4].x=-320;
    if(this.phase==='hidden')this.clear();
  }
  private clear():void {this.offset=this.definition.maximumOffset;for(const {motion} of this.layers)motion.reset();}
  restart():void {
    this.clock=this.carry=this.lastOptionChange=0;this.offset=this.definition.maximumOffset;
    this.transition=this.definition.transitionMaximum;this.phase='waiting';this.waited=false;
    this.page=this.nextPage;this.statTransition=false;this.levelTransition=0;this.changingLevel=false;
    this.placement=initialProgressPlacement(this.definition,this.profile);
    for(const joints of this.joints)joints.clear();
    for(const context of this.contexts)context.states=this.placement.states;
    for(const {motion,origin,sourceIndex} of this.layers) {
      const p=this.placement.positions[sourceIndex];origin.set(-256+p.x,Math.fround(.5*(p.y-224)),p.z);
      motion.reset();motion.hostEmission='held';
    }
  }
  update(dt:number):void {this.carry+=dt;while(this.carry>=1/60){this.step();this.carry-=1/60;}}
  private step():void {
    this.clock+=5;
    if(this.phase==='hidden')return;
    if(this.phase==='waiting') {
      if(this.otherHudVisible)return;
      if(!this.waited){this.waited=true;return;}
      this.phase='arriving';
    }
    const d=this.definition;
    if(this.phase==='arriving') {
      this.offset=Math.max(0,this.offset-d.rates.arrival);
      if(this.offset<d.arrivalThreshold)this.transition=Math.max(0,this.transition-this.transitionSpeed);
      if(!this.offset)this.phase='in';
    } else if(this.phase==='leaving') {
      this.transition=Math.min(d.transitionMaximum,this.transition+this.transitionSpeed);
      if(this.transition>d.departureThreshold) {
        this.offset=Math.min(d.maximumOffset,this.offset+d.rates.departure);
        if(this.offset===d.maximumOffset){this.phase='hidden';this.clear();return;}
      }
    } else {
      const switching=this.nextPage!==this.page||this.changingLevel;
      const step=this.transitionSpeed*(this.statTransition||this.levelTransition?2:1);
      this.transition=switching?Math.min(d.transitionMaximum,this.transition+step):Math.max(0,this.transition-step);
      if(switching&&this.transition>=(this.levelTransition||isProgressStats(this.nextPage)?256:d.transitionMaximum)) {
        if(this.page!==this.nextPage){this.page=this.nextPage;this.selectOption(0);}
        if(this.changingLevel){this.changingLevel=false;this.levelTransition=this.levelTransition===1?2:1;this.taskIndex=this.taskStates.findIndex(state=>state!==1);}
      }
      if(!this.transition){this.statTransition=false;this.levelTransition=0;}
      const arrows=isProgressStats(this.page)&&!this.offset&&!this.transition&&this.clock%60<30;
      this.placement.positions[3].x=arrows&&this.previousAvailable?195-this.profile.scales['left-x-offset']:-320;
      this.placement.positions[4].x=arrows&&this.nextAvailable?195-this.profile.scales['left-x-offset']:-320;
    }
    const {origins,scales}=placeProgress(d,this.profile,this.placement,{page:this.page,nextPage:this.nextPage,
      offset:this.offset,transition:this.transition,clock:this.clock,taskStates:this.taskStates,taskIndex:this.taskIndex,
      option:this.option,lastOptionChange:this.lastOptionChange,filledSlots:this.filledSlots,cardReady:this.cardReady,
      levelOpen:this.levelOpen,statTransition:this.statTransition,levelTransition:this.levelTransition});
    for(const icon of d.icons) {
      let yaw=this.placement.yaws[icon.index];yaw=((yaw+32768)%65536+65536)%65536-32768;
      this.placement.yaws[icon.index]=Math.fround(yaw);
      this.sample({index:icon.index,seconds:this.clock/300,frame:icon.held?icon.frame:null,yaw,
        scaleX:icon.scaleX,scaleY:icon.scaleY,z:icon.z},this.joints[icon.index]);
    }
    for(const context of this.contexts)Object.assign(context,{offset:this.offset,option:this.option,
      transitionInverse:Math.fround(1-Math.fround(this.transition/d.transitionMaximum)),
      xScale:scales['sides-x-scale'],slotScale:scales['slot-scale'],
      leftScale:[scales['left-side-x-scale'],scales['left-side-y-scale']],
      rightScale:[scales['right-side-x-scale'],scales['right-side-y-scale']]});
    for(const {motion,origin,sourceIndex} of this.layers) {
      const p=origins[sourceIndex];origin.set(p.x,p.y,p.z);motion.update(1/60);
    }
  }
}
