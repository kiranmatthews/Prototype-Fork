import { characterElasticityAmplitudes, ELASTIC_LENGTH_CONTROLS } from './animation/elasticity';

const clamp = (x:number, a=0, b=1) => Math.max(a,Math.min(b,x));
export const travelEase = (x:number) => {const t=clamp(x);return t*t*t*(10+t*(-15+6*t));};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const pulse=(t:number)=>Math.sin(Math.PI*clamp(t))**2;
export const SKATE_TRAVEL = Object.freeze({mount:.78,dismount:1.05,push:1.02,cancel:.24});

export interface SkateTravelInput {
  enabled:boolean; mounted:boolean; grounded:boolean; eligible:boolean; available:boolean;
  preparing:boolean; holdProgress:number; charging:boolean; braking:boolean;
  speed:number; topSpeed:number; heading:number; time:number;
  stance?:number;
}
export interface SkateTravelPose {
  phase:'carry'|'prepare'|'cancel'|'place'|'hop'|'catch'|'push'|'cruise'|'brake'|'step-off'|'pickup'|'stow';
  age:number; route:number; stance:number; grip:number; lift:number; load:number;
  footForward:number;
  transfer:boolean; exiting:boolean; push:number; pushPhase:number; brake:number;
  steer:number; chestPitch:number; chestRoll:number; arms:number; bounce:number;
  deformations:Record<string,number>;
}

/** Presentation state only. The controller owns the exact hold threshold,
 * skating state, acceleration and release-to-ollie gesture. Reversals start
 * from the currently displayed board/stance, never from a canned first pose. */
export class SkateTravelMotion {
  private initialized=false;
  private mounted=false;
  private stage:'carry'|'mount'|'ride'|'dismount'='carry';
  private age=0;
  private route=0;
  private stance=0;
  private fromRoute=0;
  private fromStance=0;
  private grip=0;
  private lift=0;
  private load=0;
  private fromGrip=0;
  private fromLift=0;
  private fromLoad=0;
  private prepare=0;
  private cancelFrom=0;
  private cancelAge=-1;
  private steering=0;
  private braking=0;
  private heading=0;
  private pushAge=-1;
  private pushWeight=0;
  private pushes=0;
  private rideAge=0;
  private airWeight=0;
  private footForward=-1;
  reset():void {
    this.initialized=this.mounted=false;this.stage='carry';
    this.age=this.route=this.stance=this.fromRoute=this.fromStance=this.prepare=0;
    this.cancelFrom=0;this.cancelAge=-1;
    this.steering=this.braking=this.heading=this.pushWeight=this.pushes=this.rideAge=0;this.pushAge=-1;
    this.airWeight=0;
    this.grip=this.lift=this.load=this.fromGrip=this.fromLift=this.fromLoad=0;
    this.footForward=-1;
  }
  step(dt:number,p:SkateTravelInput):SkateTravelPose|null {
    if(!p.enabled||!p.available){this.reset();return null;}
    const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
    if(!this.initialized){
      this.initialized=true;this.mounted=p.mounted;this.heading=p.heading;
      this.stage=p.mounted?'ride':'carry';this.route=p.mounted?2:0;this.stance=p.mounted?1:0;
    }
    if(p.mounted!==this.mounted){
      this.fromRoute=this.route;this.fromStance=this.stance;this.age=0;
      this.fromGrip=this.grip;this.fromLift=this.lift;this.fromLoad=this.load;
      this.stage=p.mounted?'mount':'dismount';this.mounted=p.mounted;
      this.prepare=0;
      this.cancelAge=-1;
      this.pushAge=-1;this.pushWeight=0;this.pushes=p.mounted?2:0;this.rideAge=0;
    }
    this.age+=t;
    if(p.mounted||this.stage==='carry')this.footForward=p.stance??-1;
    this.airWeight+=((p.grounded?0:1)-this.airWeight)*(1-Math.exp(-16*t));
    // Real airs/tricks retain their contact owner. A jump during placement
    // completes the board's path briskly; it never delays the actual ollie.
    if(p.mounted&&!p.eligible){
      this.age+=this.stage==='mount'?t*this.airWeight:0;this.pushAge=-1;this.rideAge=0;
    }
    let phase:SkateTravelPose['phase']='carry',lift=0,load=0,grip=0;
    let transfer=this.stage==='mount'||this.stage==='dismount';
    const exiting=this.stage==='dismount';
    if(this.stage==='mount'){
      const u=clamp(this.age/SKATE_TRAVEL.mount);
      // The board reaches the floor before either shoe lands on it.
      this.route=mix(this.fromRoute,2,travelEase(u/.42));
      this.stance=mix(this.fromStance,1,travelEase((u-.12)/.73));
      lift=.32*pulse((u-.10)/.68)*(p.grounded?1:0);
      load=.8*pulse((u-.72)/.28)-.35*pulse((u-.2)/.45);
      grip=mix(this.fromGrip,1,travelEase(u/.12))*(1-travelEase((u-.24)/.16));
      lift=mix(this.fromLift,lift,travelEase(u/.16));
      load=mix(this.fromLoad,load,travelEase(u/.20));
      phase=u<.32?'place':u<.77?'hop':'catch';
      if(u>=1){this.stage='ride';this.rideAge=0;this.age=0;transfer=false;}
    }else if(this.stage==='dismount'){
      const u=clamp(this.age/SKATE_TRAVEL.dismount);
      this.stance=mix(this.fromStance,0,travelEase(u/.48));
      // Step clear, tap the tail up, catch the edge, then carry it behind.
      this.route=u<.54?mix(this.fromRoute,1,travelEase((u-.23)/.31))
        :mix(1,0,travelEase((u-.54)/.46));
      lift=.10*pulse(u/.42)*(p.grounded?1:0);
      grip=Math.max(this.fromGrip*(1-travelEase(u/.18)),travelEase((u-.22)/.18))*(1-travelEase((u-.88)/.12));
      load=.5*pulse(u/.46);
      lift=mix(this.fromLift,lift,travelEase(u/.16));
      load=mix(this.fromLoad,load,travelEase(u/.20));
      phase=u<.28?'step-off':u<.64?'pickup':'stow';
      if(u>=1){this.stage='carry';this.age=0;transfer=false;}
    }else if(this.stage==='carry'){
      const target=p.preparing&&p.grounded&&p.eligible?travelEase((p.holdProgress-.10)/.90):0;
      if(target>0){
        this.cancelAge=-1;
        this.prepare+=clamp(target-this.prepare,-t/.18,t/.12);
      }else if(this.prepare>0){
        if(this.cancelAge<0){this.cancelFrom=this.prepare;this.cancelAge=0;}
        this.cancelAge+=t;
        this.prepare=this.cancelFrom*(1-travelEase(this.cancelAge/SKATE_TRAVEL.cancel));
      }
      this.route=this.prepare;this.stance=0;
      grip=travelEase(this.prepare/.28);
      phase=target>0?'prepare':this.prepare>.001?'cancel':'carry';
      load=.3*this.prepare;
    }else{
      this.route=2;this.stance=1;this.rideAge+=t;
      phase=p.braking?'brake':'cruise';
    }
    const angle=Math.atan2(Math.sin(p.heading-this.heading),Math.cos(p.heading-this.heading));
    this.heading=p.heading;
    this.steering+=(clamp(angle/Math.max(.001,t)/2.8,-1,1)-this.steering)*(1-Math.exp(-9*t));
    this.braking+=((p.braking&&p.eligible?1:0)-this.braking)*(1-Math.exp(-12*t));
    const canPush=p.mounted&&p.grounded&&p.eligible&&!p.braking&&this.stage==='ride'&&this.rideAge>.30&&Math.abs(p.speed)>1;
    const wantsPush=canPush&&(this.pushes>0 || p.charging&&Math.abs(p.speed)<Math.max(5,p.topSpeed*.86));
    if(this.pushAge<0&&wantsPush){this.pushAge=0;if(this.pushes>0)this.pushes--;}
    if(this.pushAge>=0){
      this.pushAge+=t;
      if(this.pushAge>=SKATE_TRAVEL.push){this.pushAge=wantsPush?this.pushAge-SKATE_TRAVEL.push:-1;if(wantsPush&&this.pushes>0)this.pushes--;}
    }
    this.pushWeight+=((canPush&&this.pushAge>=0?1:0)-this.pushWeight)*(1-Math.exp(-20*t));
    const pushPhase=this.pushAge<0?0:clamp(this.pushAge/SKATE_TRAVEL.push);
    const push=this.pushWeight*pulse(pushPhase);
    if(push>.02)phase='push';
    const riding=p.eligible?(transfer?this.stance:p.mounted?1:0):0;
    const preparation=this.stage==='carry'?this.prepare:this.stage==='mount'?(1-this.stance)*Math.min(1,this.fromRoute):0;
    const bounce=(.04*Math.sin(p.time*5.1)+.025*Math.sin(p.time*8.3-.5))*riding;
    load+=riding*((p.charging?.30:0)+.22*push+.18*this.braking)+bounce;
    const deformations:Record<string,number>={};
    const profile=characterElasticityAmplitudes(transfer?exiting?'skate-dismount':'skate-mount':push>.01?'skate-push':'skate-cruise');
    if(transfer||riding>0||this.prepare>0)for(const [id,part]of ELASTIC_LENGTH_CONTROLS){
      if(!profile[part])continue;
      const lag=part===2?.5:part===1?.2:0;
      const wave=transfer?-load: riding?-.45*load+.35*Math.sin(p.time*5.1-lag):-.25*this.prepare;
      deformations[id]=1+profile[part]*wave;
    }
    grip*=1-this.airWeight;
    this.grip=grip;this.lift=lift;this.load=load;
    const reachProfile=characterElasticityAmplitudes('skate-carry-reach');
    const handSide=(p.stance??-1)>0?'right':'left';
    if(grip>0)for(const [id,part]of ELASTIC_LENGTH_CONTROLS)
      if(id.includes(`.${handSide}.`)&&(part===1||part===2))deformations[id]=(deformations[id]??1)+reachProfile[part]*grip;
    return {phase,age:this.age,route:this.route,stance:this.stance,footForward:this.footForward,grip,lift,load,transfer,exiting,
      push,pushPhase,brake:this.braking,steer:this.steering*riding,
      chestPitch:riding*(.10+(p.charging?.16:0)+.12*push-.10*this.braking)+.12*preparation,
      chestRoll:-this.steering*.20*riding,arms:(.12+.12*Math.abs(this.steering))*riding+.25*push,
      bounce,deformations};
  }
}
