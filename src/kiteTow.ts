/** Kite forces are local to this mode. Jump power still comes from live tuning. */
export const KITE_TOW = Object.freeze({
  riseGravity: 16, fallGravity: 24,
  steeringSpeed: 9, steeringResponse: 16, airLateralScale: .5,
  coyoteSeconds: .10, bufferSeconds: .14,
  speedScale: 1.35, accelerationScale: 1.4,
  brakeFloor: 7.5, brakeDeceleration: 30, brakeLimit: 1,
  unwindRate: 2, burstSeconds: .16, tensionPower: 80, burstSpeedScale: 1.2,
  windDrift: 4.2, windResponse: 1.8, windHoldMin: 3.5, windHoldRange: 3,
  releaseDistance: 20,
});
export type KiteTuning = {cruiseSpeed:number;maxSpeed:number;chargeBoost:number;chargeDecay:number;jumpChargeTime:number};
export type KiteInput = {moveX:number;moveY?:number;jumpHeld:boolean;jumpPressed:boolean;jumpReleased?:boolean;jumpCancelled?:boolean;
  spinPressed?:boolean;grindPressed?:boolean;grabPressed?:boolean};

export function kiteCruiseSpeed(distance:number,base=12):number {
  return (base+(distance<920?0:distance<1830?1.5:3))*KITE_TOW.speedScale;
}
export const kiteChargedSpeed = (base:number):number => base*KITE_TOW.speedScale;

export class KiteTowMotion {
  age=0; started=false; speed=0; lateral=0;
  charge=0; charging=false; coyote=0; jumpBuffer=0;
  reserve=0; braking=false; brakeSeconds=0; bursting=false; autoReleases=0;
  private brakeLatched=false;
  wind=0; windTarget=0; windAge=0;
  private windTime=0; private seed=1; private bufferedCharge=0; private lateralScale=1;
  constructor(seed?:number){this.reset(seed);}
  reset(seed=Math.floor(Math.random()*0x100000000)):void {
    this.age=this.speed=this.lateral=this.charge=this.coyote=this.jumpBuffer=this.reserve=this.brakeSeconds=this.autoReleases=0;
    this.started=this.charging=this.braking=this.bursting=this.brakeLatched=false;
    this.wind=this.windAge=this.windTime=0;this.seed=seed>>>0;this.windTarget=this.random()*2-1;
    this.lateralScale=1;
  }
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/0x100000000;}
  step(dt:number,distance:number,grounded:boolean,input:KiteInput,tuning:KiteTuning){
    this.age+=dt;this.windAge+=dt;this.windTime-=dt;
    if(this.windTime<=0){
      const sign=(Math.sign(this.windTarget)||1)*(this.random()<.8?-1:1);
      this.windTarget=sign*(.75+this.random()*.25);this.windTime=KITE_TOW.windHoldMin+this.random()*KITE_TOW.windHoldRange;
    }
    this.wind+=(this.windTarget-this.wind)*(1-Math.exp(-KITE_TOW.windResponse*dt));
    // Held controls carried through death are not a new launch command.
    if(input.jumpPressed||input.spinPressed||input.grindPressed||input.grabPressed)this.started=true;
    if(!this.started)return {jumpCharge:null as number|null,dx:0,dz:0};
    this.coyote=grounded?KITE_TOW.coyoteSeconds:Math.max(0,this.coyote-dt);
    this.jumpBuffer=Math.max(0,this.jumpBuffer-dt);
    if(input.jumpHeld){this.charging=true;this.charge=Math.min(tuning.jumpChargeTime,this.charge+dt);}
    if(input.jumpCancelled){this.charging=false;this.charge=this.jumpBuffer=0;}
    if(input.jumpReleased&&this.charging){
      this.bufferedCharge=this.charge;this.jumpBuffer=KITE_TOW.bufferSeconds;
      this.charging=false;this.charge=0;
    }
    const jumpCharge=this.jumpBuffer>0&&this.coyote>0?this.bufferedCharge:null;
    if(jumpCharge!==null){this.jumpBuffer=this.coyote=0;}
    const held=(input.moveY??0)<-.25;
    if(!held)this.brakeLatched=false;
    this.braking=held&&!this.brakeLatched&&!this.bursting;
    if(this.braking){
      this.brakeSeconds=Math.min(KITE_TOW.brakeLimit,this.brakeSeconds+dt);
      const next=Math.max(KITE_TOW.brakeFloor,this.speed-KITE_TOW.brakeDeceleration*dt);
      if(next<this.speed)this.reserve+=(this.speed*this.speed-next*next)*.5;
      this.speed=this.speed<KITE_TOW.brakeFloor
        ? Math.min(KITE_TOW.brakeFloor,this.speed+tuning.chargeDecay*KITE_TOW.accelerationScale*dt) : next;
      // The held kite keeps loading the spring even at the crawl floor.
      // Cap the complete kinetic budget so repeated pulls cannot run away.
      const cap=kiteChargedSpeed(tuning.maxSpeed)*KITE_TOW.burstSpeedScale;
      this.reserve=Math.min(Math.max(0,(cap*cap-this.speed*this.speed)*.5),this.reserve+KITE_TOW.tensionPower*dt);
      if(this.brakeSeconds>=KITE_TOW.brakeLimit-1e-7){
        this.brakeSeconds=KITE_TOW.brakeLimit;this.braking=false;
        this.bursting=this.brakeLatched=true;this.autoReleases++;
      }
    }
    if(!this.braking&&this.brakeSeconds>0){
      // Counter and energy unwind together. A short release spends only part
      // of each; the next pull resumes from that remaining load.
      const before=this.brakeSeconds;
      this.brakeSeconds=Math.max(0,before-dt*(this.bursting?KITE_TOW.brakeLimit/KITE_TOW.burstSeconds:KITE_TOW.unwindRate));
      const spent=this.reserve*(1-this.brakeSeconds/before);
      this.reserve=Math.max(0,this.reserve-spent);this.speed=Math.sqrt(this.speed*this.speed+2*spent);
      if(this.brakeSeconds<1e-7){this.brakeSeconds=this.reserve=0;this.bursting=false;}
    }else if(!this.braking){
      const target=this.charging&&grounded?kiteChargedSpeed(tuning.maxSpeed):kiteCruiseSpeed(distance,tuning.cruiseSpeed)+this.wind*1.6;
      const accel=(this.charging&&grounded?tuning.chargeBoost:tuning.chargeDecay)*KITE_TOW.accelerationScale;
      if(this.speed<target)this.speed=Math.min(target,this.speed+accel*dt);
      else if(!this.charging)this.speed=Math.max(target,this.speed-.65*dt);
    }
    // Halve all sideways travel in flight, including wind drift. Rescale the
    // carried velocity once at takeoff/landing so the response stays identical.
    const lateralScale=grounded&&jumpCharge===null?1:KITE_TOW.airLateralScale;
    this.lateral*=lateralScale/this.lateralScale;this.lateralScale=lateralScale;
    const targetLateral=(input.moveX*KITE_TOW.steeringSpeed+this.wind*KITE_TOW.windDrift)*lateralScale;
    this.lateral+=(targetLateral-this.lateral)*(1-Math.exp(-KITE_TOW.steeringResponse*dt));
    return {jumpCharge,dx:this.lateral*dt,dz:-this.speed*dt};
  }
  gravity(rising:boolean):number{return rising?KITE_TOW.riseGravity:KITE_TOW.fallGravity;}
}
