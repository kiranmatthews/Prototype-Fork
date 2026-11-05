import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const travelEase=(x:number)=>{const t=clamp(x);return clamp(t*t*t*(10+t*(-15+6*t)));};
const pulse=(x:number)=>Math.sin(Math.PI*clamp(x))**2;
export const SKATE_TRAVEL=Object.freeze({mount:.64,dismount:.86,cancel:.32});
export const skatePreparation=(progress:number)=>.25*travelEase(progress/.25)+.75*travelEase(progress);

export interface SkateTravelInput {
  enabled:boolean;mounted:boolean;grounded:boolean;eligible:boolean;available:boolean;
  preparing:boolean;holdProgress:number;charging:boolean;charge:number;braking:boolean;
  heading:number;time:number;stance:number;
}
export interface SkateTravelPose {
  phase:'stowed'|'prepare'|'cancel'|'mount'|'dismount'|'cruise'|'charge'|'brake';
  beat:'stowed'|'draw'|'place'|'hop'|'catch'|'step-off'|'pickup'|'stow'|'ride';
  serial:number;age:number;weight:number;charge:number;preparation:number;cancellable:boolean;
  transfer:boolean;exiting:boolean;footForward:number;handForward:number;stanceBlend:number;
  route:number;draw:number;grip:number;lift:number;extension:number;settle:number;
  steer:number;chestPitch:number;chestRoll:number;arms:number;bounce:number;
  deformations:Record<string,number>;
}

/** D-only presentation. A finite hand placement and step-off/catch replace
 * the old spin cover. Walking has no carried board and physics never waits. */
export class SkateTravelMotion {
  private initialized=false;
  private mounted=false;
  private transition:'mount'|'dismount'|null=null;
  private age=0;
  private serial=0;
  private heading=0;
  private steering=0;
  private prepare=0;
  private cancelAge:number=SKATE_TRAVEL.cancel;
  private prepareFrom=0;
  private cancelFrom=0;
  private prepareVelocity=0;
  private cancelVelocity=0;
  private wasPreparing=false;
  private footForward=-1;
  private handForward=-1;
  private last={route:0,draw:0,grip:0,stanceBlend:0,lift:0,preparation:0};
  private from={...this.last};
  reset():void {
    this.initialized=this.mounted=false;this.transition=null;
    this.age=this.heading=this.steering=this.prepare=this.prepareFrom=this.cancelFrom=0;
    this.prepareVelocity=this.cancelVelocity=0;this.cancelAge=SKATE_TRAVEL.cancel;this.wasPreparing=false;
    this.last={route:0,draw:0,grip:0,stanceBlend:0,lift:0,preparation:0};this.from={...this.last};
    this.serial++;
  }
  step(dt:number,p:SkateTravelInput):SkateTravelPose|null {
    if(!p.enabled||!p.available){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(!this.initialized){
      this.initialized=true;this.mounted=p.mounted;this.heading=p.heading;this.footForward=this.handForward=p.stance;
      this.last={route:p.mounted?1:0,draw:p.mounted?1:0,grip:0,stanceBlend:p.mounted?1:0,lift:0,preparation:0};
    }
    if(p.mounted!==this.mounted){
      const reversing=this.transition==='dismount'&&p.mounted;
      if(p.mounted&&!reversing)this.handForward=p.stance;
      this.from={...this.last};this.mounted=p.mounted;this.transition=p.grounded?(p.mounted?'mount':'dismount'):null;
      this.age=0;this.serial++;
      if(p.mounted)this.footForward=p.stance;
    }
    // A real ollie, grind or bail immediately keeps its existing owner.
    if(!p.eligible)this.transition=null;
    this.age+=t;
    if(this.transition&&this.age>=SKATE_TRAVEL[this.transition])this.transition=null;
    const angle=Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading));
    this.heading=p.heading;
    this.steering+=(clamp(angle/Math.max(.001,t)/2.8,-1,1)-this.steering)*(1-Math.exp(-9*t));
    const preparing=!p.mounted&&p.preparing&&p.eligible&&!this.transition;
    const previous=this.prepare;
    if(preparing){
      if(!this.wasPreparing)this.prepareFrom=this.prepare;
      this.prepare=mix(this.prepareFrom,1,skatePreparation(p.holdProgress));this.cancelAge=SKATE_TRAVEL.cancel;
    }else if(!p.mounted&&p.eligible&&!this.transition){
      if(this.wasPreparing){this.cancelFrom=this.prepare;this.cancelVelocity=clamp(this.prepareVelocity,0,4);this.cancelAge=0;}
      this.cancelAge=Math.min(SKATE_TRAVEL.cancel,this.cancelAge+t);
      const u=this.cancelAge/SKATE_TRAVEL.cancel;
      this.prepare=clamp(this.cancelFrom*(1-travelEase(u))+this.cancelVelocity*SKATE_TRAVEL.cancel*u*(1-u)**3);
    }else{this.prepare=this.prepareFrom=this.cancelFrom=this.prepareVelocity=this.cancelVelocity=0;this.cancelAge=SKATE_TRAVEL.cancel;}
    this.prepareVelocity=t>0?(this.prepare-previous)/t:0;this.wasPreparing=preparing;
    const riding=p.mounted&&p.eligible,exiting=this.transition==='dismount',transfer=!!this.transition;
    const charge=clamp(p.charge),weight=riding?1:0;
    let preparation=this.prepare,route=p.mounted?1:0,stanceBlend=p.mounted?1:0;
    let draw=p.mounted?1:travelEase((preparation-.08)/.78),grip=p.mounted?0:travelEase(draw/.30),extension=0,settle=0,lift=0;
    let beat:SkateTravelPose['beat']=p.mounted?'ride':draw>0?'draw':'stowed';
    if(this.transition==='mount'){
      const a=this.age;
      route=mix(this.from.route,1,travelEase(a/.34));
      draw=mix(this.from.draw,1,travelEase(a/.08));
      grip=mix(this.from.grip,1-this.from.route,travelEase(a/.06))*(1-travelEase((a-.04)/.09));
      stanceBlend=mix(this.from.stanceBlend,1,travelEase((a-.08)/.34));
      preparation=this.from.preparation*(1-travelEase(a/.18));
      extension=pulse((a-.06)/.32);settle=pulse((a-.46)/.18);
      lift=mix(this.from.lift,.30*pulse((a-.08)/.39),travelEase(a/.08));
      beat=a<.20?'place':a<.46?'hop':'catch';
    }else if(exiting){
      const a=this.age;
      stanceBlend=mix(this.from.stanceBlend,0,travelEase((a-.03)/.38));
      route=mix(this.from.route,0,travelEase((a-.35)/.27));
      draw=1-travelEase((a-.62)/.20);
      grip=Math.max(this.from.grip*(1-travelEase(a/.12)),travelEase((a-.45)/.15))*travelEase(draw/.30);
      lift=this.from.lift*(1-travelEase(a/.12));
      settle=.40*pulse(a/.30);extension=.25*pulse((a-.30)/.35);
      beat=a<.35?'step-off':a<.62?'pickup':'stow';
    }
    if(!p.eligible){route=p.mounted?1:0;draw=p.mounted?1:0;grip=preparation=0;stanceBlend=p.mounted?1:0;}
    const bounce=Math.sin(p.time*5.2)*.018*weight*(1-.7*charge);
    const deformations:Record<string,number>={};
    const profile=characterElasticityAmplitudes(preparation>0?'skate-mount-load':charge>.1?'skate-charge':'skate-cruise');
    if(weight||preparation)for(const [id,part]of ELASTIC_LENGTH_CONTROLS)if(profile[part])
      deformations[id]=1+profile[part]*(preparation>0?-.70*preparation:-.7*charge+.25*Math.sin(p.time*5.2-part*.3));
    const spring=characterElasticityAmplitudes('skate-mount-spring');
    if(extension||settle)for(const [id,part]of ELASTIC_LENGTH_CONTROLS)if(spring[part])
      deformations[id]=(deformations[id]??1)+spring[part]*(extension-.65*settle);
    const bodyWeight=transfer?stanceBlend:weight;
    const phase=this.transition??(!p.mounted?preparing?'prepare':preparation>.002?'cancel':'stowed'
      :p.braking?'brake':charge>.15?'charge':'cruise');
    this.last={route,draw,grip,stanceBlend,lift,preparation};
    return {phase,beat,serial:this.serial,age:this.age,weight,charge,preparation,cancellable:preparing,
      transfer,exiting,footForward:this.footForward,handForward:this.handForward,stanceBlend,route,draw,grip,lift,extension,settle,
      steer:this.steering*weight,chestPitch:bodyWeight*(.16+.16*charge-.10*extension+.08*settle),
      chestRoll:-this.steering*.16*bodyWeight,arms:weight*(-.10+.10*Math.abs(this.steering)),bounce,deformations};
  }
}
