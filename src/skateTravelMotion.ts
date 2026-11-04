import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const travelEase=(x:number)=>{const t=clamp(x);return clamp(t*t*t*(10+t*(-15+6*t)));};
export const SKATE_TRAVEL=Object.freeze({mount:.44,dismount:.22,cover:.20,cancel:.18});

export interface SkateTravelInput {
  enabled:boolean;mounted:boolean;grounded:boolean;eligible:boolean;available:boolean;
  preparing:boolean;holdProgress:number;charging:boolean;charge:number;braking:boolean;
  heading:number;time:number;
}
export interface SkateTravelPose {
  phase:'stowed'|'prepare'|'cancel'|'mount'|'dismount'|'cruise'|'charge'|'brake';
  age:number;smear:boolean;weight:number;charge:number;preparation:number;cancellable:boolean;
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
  private cancelAge:number=SKATE_TRAVEL.cancel;
  private prepareFrom=0;
  private cancelFrom=0;
  private wasPreparing=false;
  reset():void {
    this.initialized=this.mounted=false;this.transition=null;
    this.age=this.heading=this.steering=this.prepare=this.prepareFrom=this.cancelFrom=0;
    this.cancelAge=SKATE_TRAVEL.cancel;this.wasPreparing=false;
  }
  step(dt:number,p:SkateTravelInput):SkateTravelPose|null {
    if(!p.enabled||!p.available){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(!this.initialized){this.initialized=true;this.mounted=p.mounted;this.heading=p.heading;}
    if(p.mounted!==this.mounted){
      this.mounted=p.mounted;this.transition=p.grounded?(p.mounted?'mount':'dismount'):null;
      this.age=0;
    }
    this.age+=t;
    if(this.transition&&this.age>=SKATE_TRAVEL[this.transition])this.transition=null;
    const smear=!!this.transition&&this.age<SKATE_TRAVEL.cover&&p.grounded;
    const angle=Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading));
    this.heading=p.heading;
    this.steering+=(clamp(angle/Math.max(.001,t)/2.8,-1,1)-this.steering)*(1-Math.exp(-9*t));
    const preparing=!p.mounted&&p.preparing&&p.eligible;
    // Read the actual hold meter, not a one-shot timer: releasing direction
    // reverses the visible load; releasing jump leaves it to the jump owner.
    if(preparing){
      if(!this.wasPreparing)this.prepareFrom=this.prepare;
      this.prepare=this.prepareFrom+(1-this.prepareFrom)*travelEase(p.holdProgress);this.cancelAge=SKATE_TRAVEL.cancel;
    }else if(!p.mounted&&p.eligible){
      if(this.wasPreparing){this.cancelFrom=this.prepare;this.cancelAge=0;}
      this.cancelAge=Math.min(SKATE_TRAVEL.cancel,this.cancelAge+t);
      this.prepare=this.cancelFrom*(1-travelEase(this.cancelAge/SKATE_TRAVEL.cancel));
    }else {this.prepare=this.prepareFrom=this.cancelFrom=0;this.cancelAge=SKATE_TRAVEL.cancel;}
    this.wasPreparing=preparing;
    const riding=p.mounted&&p.eligible;
    const charge=clamp(p.charge);
    const weight=riding?1:0;
    const bounce=Math.sin(p.time*5.2)*.018*weight*(1-.7*charge);
    const deformations:Record<string,number>={};
    const profile=characterElasticityAmplitudes(this.prepare>0?'skate-mount-load':charge>.1?'skate-charge':'skate-cruise');
    if(weight||this.prepare)for(const [id,part]of ELASTIC_LENGTH_CONTROLS){
      if(profile[part])deformations[id]=1+profile[part]*(this.prepare>0?-.75*this.prepare:-.7*charge+.25*Math.sin(p.time*5.2-part*.3));
    }
    const phase=this.transition??(!p.mounted?preparing?'prepare':this.prepare>.002?'cancel':'stowed'
      :p.braking?'brake':charge>.15?'charge':'cruise');
    return {phase,age:this.age,smear,weight,charge,preparation:this.prepare,cancellable:preparing,steer:this.steering*weight,
      chestPitch:weight*(.16+.16*charge),
      chestRoll:-this.steering*.16*weight,arms:weight*(-.10+.10*Math.abs(this.steering)),
      bounce,deformations};
  }
}
