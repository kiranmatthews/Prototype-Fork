import {Vector3} from 'three';
import type {ParticleMotion} from './particleMotion';
import type {Catalogue,EffectDefinition,ScreenHudDefinition,ScreenHudProfile} from './types';

export interface ScreenHudLayer {motion:ParticleMotion;origin:Vector3;sourceIndex:number}
export function screenHudDefinitions(catalogue:Catalogue):EffectDefinition[] {
  return (catalogue.screenHud?.entries??[]).filter(entry=>entry.profiles[0].layers.length>1).map((entry,index)=>({
    id:31001+index,name:`${entry.name} · source HUD assembly`,source:entry.source,screenHud:entry.id,items:[],
  }));
}
export function screenHudDefinition(effect:EffectDefinition,catalogue:Catalogue):ScreenHudDefinition|undefined {
  return catalogue.screenHud?.entries.find(entry=>effect.screenHud===entry.id||
    entry.profiles[0].layers.some(layer=>layer.group===effect.name));
}

/** Original NTSC host placement, timing and live game values, with explicit
 * inspection inputs. Numeric tally text and sounds are outside this effect. */
export class ScreenHud {
  profile:ScreenHudProfile;
  phase:'in'|'arriving'|'leaving'|'hidden'='in';
  hold=true;
  offset=0;
  clock=0;
  health:number|null=3;
  ecoType:'blue'|'yellow'|'red'|'green'='blue';
  drain=false;
  charge=1;
  remaining:number;
  private carry=0;
  private entered=0;
  private leaveStep=5;
  private lastHealth=3;
  private lastRemaining:number;
  constructor(readonly definition:ScreenHudDefinition,readonly ecoFullTicks:number,readonly layers:ScreenHudLayer[]) {
    this.profile=definition.profiles.find(profile=>profile.id==='4:3')!;
    if(!this.profile)throw new Error('Missing source NTSC HUD profile');
    this.remaining=this.lastRemaining=ecoFullTicks;
    for(const {motion} of layers) {
      motion.host.hud={health:3,frame:0,healthScale:0,buzzerScale:0,
        ecoFraction:1,ecoType:'blue',ecoScale:0,ecoBackingScale:0,ecoTimerScale:0};
      motion.issues.delete('Screen-space host layout');
    }
  }
  get aspect():number{return this.profile.id==='4:3'?4/3:16/9;}
  get fraction():number{return Math.fround(Math.fround(this.remaining)/Math.fround(this.ecoFullTicks));}
  setCharge(value:number):void {this.charge=value;this.remaining=Math.round(value*this.ecoFullTicks);}
  select(id:string):void {
    const profile=this.definition.profiles.find(profile=>profile.id===id);
    if(!profile)throw new Error(`Unknown source HUD format ${id}`);
    this.profile=profile;
  }
  show():void {this.phase='arriving';this.entered=this.clock;}
  hide(quick=false):void {
    // Stop the inspection drain so a new timer value cannot immediately show
    // the HUD again through the source tally-value condition.
    this.drain=false;this.hold=false;this.lastRemaining=this.remaining;
    if(this.health!==null)this.lastHealth=Math.trunc(this.health);
    this.leaveStep=10;this.phase=quick?'hidden':'leaving';if(quick)this.offset=128;
  }
  restart():void {
    for(const {motion} of this.layers)motion.reset();
    this.clock=this.carry=this.entered=0;this.offset=128;this.phase='arriving';
    this.remaining=this.lastRemaining=Math.round(this.charge*this.ecoFullTicks);
    this.lastHealth=this.health===null?3:Math.trunc(this.health);
  }
  update(dt:number):void {
    this.carry+=dt;
    while(this.carry>=1/60) {this.step();this.carry-=1/60;}
  }
  private step():void {
    this.clock+=5;
    if(this.drain&&this.definition.id==='power')this.remaining=Math.max(0,this.remaining-5);
    const healthValue=this.health===null?this.lastHealth:Math.trunc(this.health);
    if(this.definition.id==='health'&&this.health!==null&&healthValue!==this.lastHealth||
       this.definition.id==='power'&&this.remaining!==this.lastRemaining)this.show();
    this.lastHealth=healthValue;this.lastRemaining=this.remaining;
    if(this.phase==='arriving') {
      this.offset=Math.max(0,this.offset-15);
      if(this.offset===0){this.phase='in';this.entered=this.clock;}
    } else if(this.phase==='in') {
      if(this.hold)this.entered=this.clock;
      else if(this.clock-this.entered>=600){this.phase='leaving';this.leaveStep=5;}
    } else if(this.phase==='leaving') {
      this.offset=Math.min(128,this.offset+this.leaveStep);if(this.offset===128)this.phase='hidden';
    }
    const scales=this.profile.scales;
    for(const {motion,origin,sourceIndex} of this.layers) {
      const position=this.profile.layers[sourceIndex].position;
      origin.set(-256+this.definition.xSign*this.offset+position[0],
        Math.fround(.5*(position[1]+this.definition.ySign*this.offset-224)),position[2]);
      Object.assign(motion.host.hud!,{health:this.health,frame:this.clock/5,
        healthScale:scales.scale??0,buzzerScale:scales.scale??0,
        ecoFraction:this.fraction,ecoType:this.ecoType,ecoScale:scales['scale-blue']??0,
        ecoBackingScale:scales['scale-backing']??0,ecoTimerScale:scales['scale-timer']??0});
      motion.hostEmission=this.phase==='hidden'?'off':'held';motion.update(1/60);
    }
  }
}
