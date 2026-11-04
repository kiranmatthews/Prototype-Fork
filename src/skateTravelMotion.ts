import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const travelEase=(x:number)=>{const t=clamp(x);return clamp(t*t*t*(10+t*(-15+6*t)));};
export const SKATE_TRAVEL=Object.freeze({mount:.52,mountAir:.36,mountHeight:.40,dismount:.22,cover:.20,mountCover:.10,cancel:.32});

/** Load early enough to read during the hold, then continue sinking until commit. */
export const skatePreparation=(progress:number)=>.25*travelEase(progress/.25)+.75*travelEase(progress);

/** D-only spring: fast visible extension, a higher hop and a finite soft catch.
 * All translation is visual; the board and controller remain on their path. */
export function sampleSkateTravelMount(seconds:number){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>=SKATE_TRAVEL.mount)
    return {lift:0,tuck:0,settle:0,extension:0};
  if(seconds<SKATE_TRAVEL.mountAir){
    const u=seconds/SKATE_TRAVEL.mountAir;
    return {lift:SKATE_TRAVEL.mountHeight*4*u*(1-u),
      tuck:.55*Math.sin(Math.PI*u)**2,settle:0,
      extension:Math.sin(Math.PI*clamp(seconds/.28))**2};
  }
  const u=(seconds-SKATE_TRAVEL.mountAir)/(SKATE_TRAVEL.mount-SKATE_TRAVEL.mountAir);
  return {lift:0,tuck:0,settle:Math.sin(Math.PI*u)**2,extension:0};
}

export interface SkateTravelInput {
  enabled:boolean;mounted:boolean;grounded:boolean;eligible:boolean;available:boolean;
  preparing:boolean;holdProgress:number;charging:boolean;charge:number;braking:boolean;
  heading:number;time:number;
}
export interface SkateTravelPose {
  phase:'stowed'|'prepare'|'cancel'|'mount'|'dismount'|'cruise'|'charge'|'brake';
  age:number;smear:boolean;weight:number;charge:number;preparation:number;cancellable:boolean;
  extension:number;settle:number;
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
  private prepareVelocity=0;
  private cancelVelocity=0;
  private wasPreparing=false;
  reset():void {
    this.initialized=this.mounted=false;this.transition=null;
    this.age=this.heading=this.steering=this.prepare=this.prepareFrom=this.cancelFrom=this.prepareVelocity=this.cancelVelocity=0;
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
    const smear=!!this.transition&&this.age<(this.transition==='mount'?SKATE_TRAVEL.mountCover:SKATE_TRAVEL.cover)&&p.grounded;
    const angle=Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading));
    this.heading=p.heading;
    this.steering+=(clamp(angle/Math.max(.001,t)/2.8,-1,1)-this.steering)*(1-Math.exp(-9*t));
    const preparing=!p.mounted&&p.preparing&&p.eligible;
    // Read the actual hold meter, not a one-shot timer: releasing direction
    // reverses the visible load; releasing jump leaves it to the jump owner.
    const previousPreparation=this.prepare;
    if(preparing){
      if(!this.wasPreparing)this.prepareFrom=this.prepare;
      this.prepare=this.prepareFrom+(1-this.prepareFrom)*skatePreparation(p.holdProgress);this.cancelAge=SKATE_TRAVEL.cancel;
    }else if(!p.mounted&&p.eligible){
      if(this.wasPreparing){this.cancelFrom=this.prepare;this.cancelVelocity=clamp(this.prepareVelocity,0,4);this.cancelAge=0;}
      this.cancelAge=Math.min(SKATE_TRAVEL.cancel,this.cancelAge+t);
      const u=this.cancelAge/SKATE_TRAVEL.cancel;
      // Carry the incoming compression velocity into the unwind. It can finish
      // a tiny squeeze before releasing, rather than abruptly changing speed.
      this.prepare=clamp(this.cancelFrom*(1-travelEase(u))+
        this.cancelVelocity*SKATE_TRAVEL.cancel*u*(1-u)**3);
    }else {this.prepare=this.prepareFrom=this.cancelFrom=this.prepareVelocity=this.cancelVelocity=0;this.cancelAge=SKATE_TRAVEL.cancel;}
    this.prepareVelocity=t>0?(this.prepare-previousPreparation)/t:0;
    this.wasPreparing=preparing;
    const riding=p.mounted&&p.eligible;
    const charge=clamp(p.charge);
    const weight=riding?1:0;
    const mount=this.transition==='mount'&&riding?sampleSkateTravelMount(this.age):sampleSkateTravelMount(-1);
    const {extension,settle}=mount;
    const bounce=Math.sin(p.time*5.2)*.018*weight*(1-.7*charge);
    const deformations:Record<string,number>={};
    const profile=characterElasticityAmplitudes(this.prepare>0?'skate-mount-load':charge>.1?'skate-charge':'skate-cruise');
    if(weight||this.prepare)for(const [id,part]of ELASTIC_LENGTH_CONTROLS){
      if(profile[part])deformations[id]=1+profile[part]*(this.prepare>0?-.85*this.prepare:-.7*charge+.25*Math.sin(p.time*5.2-part*.3));
    }
    if(extension||settle){
      const spring=characterElasticityAmplitudes('skate-mount-spring');
      for(const [id,part]of ELASTIC_LENGTH_CONTROLS)if(spring[part])
        deformations[id]=(deformations[id]??1)+spring[part]*(extension-.65*settle);
    }
    const phase=this.transition??(!p.mounted?preparing?'prepare':this.prepare>.002?'cancel':'stowed'
      :p.braking?'brake':charge>.15?'charge':'cruise');
    return {phase,age:this.age,smear,weight,charge,preparation:this.prepare,cancellable:preparing,extension,settle,steer:this.steering*weight,
      chestPitch:weight*(.16+.16*charge-.14*extension+.10*settle),
      chestRoll:-this.steering*.16*weight,arms:weight*(-.10+.10*Math.abs(this.steering)),
      bounce,deformations};
  }
}
