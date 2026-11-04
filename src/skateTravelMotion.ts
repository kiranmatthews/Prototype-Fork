import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const travelEase=(x:number)=>{const t=clamp(x);return clamp(t*t*t*(10+t*(-15+6*t)));};
export const SKATE_TRAVEL=Object.freeze({mount:.44,dismount:.22,cover:.20,push:.72,cancel:.18});

export interface SkateTravelInput {
  enabled:boolean;mounted:boolean;grounded:boolean;eligible:boolean;available:boolean;
  preparing:boolean;holdProgress:number;charging:boolean;charge:number;braking:boolean;
  speed:number;topSpeed:number;heading:number;time:number;
}
export interface SkateTravelPose {
  phase:'stowed'|'prepare'|'cancel'|'mount'|'dismount'|'cruise'|'push'|'charge'|'brake';
  age:number;smear:boolean;weight:number;charge:number;push:number;pushPhase:number;
  steer:number;chestPitch:number;chestRoll:number;arms:number;bounce:number;
  deformations:Record<string,number>;
}

/** D presentation only. The ordinary controller keeps board visibility,
 * charge, jump timing and the mounting hop. A short existing spin smear covers
 * the committed inventory handoff; preparation never fetches or grabs a deck. */
export class SkateTravelMotion {
  private initialized=false;
  private mounted=false;
  private transition:'mount'|'dismount'|null=null;
  private age=0;
  private heading=0;
  private steering=0;
  private prepare=0;
  private rideAge=0;
  private initialPush=false;
  private pushAge=-1;
  private pushWeight=0;
  reset():void {
    this.initialized=this.mounted=false;this.transition=null;
    this.age=this.heading=this.steering=this.prepare=this.rideAge=this.pushWeight=0;
    this.initialPush=false;this.pushAge=-1;
  }
  step(dt:number,p:SkateTravelInput):SkateTravelPose|null {
    if(!p.enabled||!p.available){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(!this.initialized){this.initialized=true;this.mounted=p.mounted;this.heading=p.heading;}
    if(p.mounted!==this.mounted){
      this.mounted=p.mounted;this.transition=p.grounded?(p.mounted?'mount':'dismount'):null;
      this.age=this.rideAge=0;this.initialPush=p.mounted;this.pushAge=-1;this.pushWeight=0;
    }
    this.age+=t;
    if(this.transition&&this.age>=SKATE_TRAVEL[this.transition])this.transition=null;
    const smear=!!this.transition&&this.age<SKATE_TRAVEL.cover&&p.grounded;
    const angle=Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading));
    this.heading=p.heading;
    this.steering+=(clamp(angle/Math.max(.001,t)/2.8,-1,1)-this.steering)*(1-Math.exp(-9*t));
    const preparing=!p.mounted&&p.preparing&&p.eligible;
    this.prepare+=((preparing?travelEase(p.holdProgress):0)-this.prepare)*(1-Math.exp(-18*t));
    const riding=p.mounted&&p.eligible;
    this.rideAge=riding&&!this.transition?this.rideAge+t:0;
    const charge=clamp(p.charge);
    // A loaded jump has both feet on the deck. Do not replace its crouch
    // with a continuous one-legged kick; pushes belong to low-speed travel.
    const canPush=riding&&!p.braking&&!this.transition&&this.rideAge>.08&&Math.abs(p.speed)>1;
    const wantsPush=canPush&&Math.abs(p.speed)<Math.min(14,p.topSpeed*.75)&&
      (this.initialPush||p.charging&&charge<.55);
    if(this.pushAge<0&&wantsPush){this.pushAge=0;this.initialPush=false;}
    if(this.rideAge>1.1)this.initialPush=false;
    if(this.pushAge>=0){
      this.pushAge+=t;
      if(this.pushAge>=SKATE_TRAVEL.push)this.pushAge=-1;
    }
    if(!riding){this.pushAge=-1;this.initialPush=false;}
    this.pushWeight+=((canPush&&this.pushAge>=0?1:0)-this.pushWeight)*(1-Math.exp(-24*t));
    const pushPhase=this.pushAge<0?1:clamp(this.pushAge/SKATE_TRAVEL.push);
    const push=this.pushWeight*travelEase(pushPhase/.18)*(1-travelEase((pushPhase-.78)/.22));
    const weight=riding?1:0;
    const bounce=Math.sin(p.time*5.2)*.018*weight*(1-.7*charge);
    const deformations:Record<string,number>={};
    const profile=characterElasticityAmplitudes(push>.01?'skate-push':charge>.1?'skate-charge':'skate-cruise');
    if(weight)for(const [id,part]of ELASTIC_LENGTH_CONTROLS){
      if(profile[part])deformations[id]=1+profile[part]*(-.7*charge+.25*Math.sin(p.time*5.2-part*.3));
    }
    const phase=this.transition??(!p.mounted?preparing?'prepare':this.prepare>.002?'cancel':'stowed'
      :push>.03?'push':p.braking?'brake':charge>.15?'charge':'cruise');
    return {phase,age:this.age,smear,weight,charge,push,pushPhase,steer:this.steering*weight,
      chestPitch:weight*(.16+.16*charge+.07*push),
      chestRoll:-this.steering*.16*weight,arms:weight*(-.10+.10*Math.abs(this.steering)),
      bounce,deformations};
  }
}
