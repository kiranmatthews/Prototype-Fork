/** Kite forces are local to this mode. Jump charge/power comes from live tuning. */
export const KITE_TOW = Object.freeze({
  riseGravity: 16, fallGravity: 24,
  steeringSpeed: 9, steeringResponse: 16,
  coyoteSeconds: .10, bufferSeconds: .14,
  brakeFloor: 4.5, brakeDeceleration: 20, returnAcceleration: 26,
  windDrift: 2.6, windResponse: 1.8,
  releaseDistance: 20,
});
export type KiteTuning = {cruiseSpeed:number;maxSpeed:number;chargeBoost:number;chargeDecay:number;jumpChargeTime:number};
export type KiteInput = {moveX:number;moveY?:number;jumpHeld:boolean;jumpPressed:boolean;jumpReleased?:boolean;jumpCancelled?:boolean;
  spinPressed?:boolean;grindPressed?:boolean;grabPressed?:boolean};

export function kiteCruiseSpeed(distance:number,base=12):number {
  return base+(distance<920?0:distance<1830?1.5:3);
}

export class KiteTowMotion {
  age=0; started=false; speed=0; lateral=0;
  charge=0; charging=false; coyote=0; jumpBuffer=0;
  reserve=0; braking=false;
  wind=0; windTarget=0; windAge=0;
  private windTime=0; private seed=1; private bufferedCharge=0;
  constructor(seed?:number){this.reset(seed);}
  reset(seed=Math.floor(Math.random()*0x100000000)):void {
    this.age=this.speed=this.lateral=this.charge=this.coyote=this.jumpBuffer=this.reserve=0;
    this.started=this.charging=this.braking=false;
    this.wind=this.windAge=this.windTime=0;this.seed=seed>>>0;this.windTarget=this.random()*2-1;
  }
  private random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/0x100000000;}
  step(dt:number,distance:number,grounded:boolean,input:KiteInput,tuning:KiteTuning){
    this.age+=dt;this.windAge+=dt;this.windTime-=dt;
    if(this.windTime<=0){this.windTarget=(this.random()<.5?-1:1)*(.65+this.random()*.35);this.windTime=1.4+this.random()*2.6;}
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
    this.braking=(input.moveY??0)<-.25;
    if(this.braking){
      const next=Math.max(KITE_TOW.brakeFloor,this.speed-KITE_TOW.brakeDeceleration*dt);
      if(next<this.speed)this.reserve+=(this.speed*this.speed-next*next)*.5;
      this.speed=this.speed<KITE_TOW.brakeFloor
        ? Math.min(KITE_TOW.brakeFloor,this.speed+tuning.chargeDecay*dt) : next;
    }else if(this.reserve>0){
      // Repay removed energy before resuming normal drive. Adding both each
      // frame would create unlimited speed from repeated brake/release cycles.
      const next=Math.min(Math.sqrt(this.speed*this.speed+2*this.reserve),this.speed+KITE_TOW.returnAcceleration*dt);
      this.reserve=Math.max(0,this.reserve-(next*next-this.speed*this.speed)*.5);this.speed=next;
      if(this.reserve<1e-8)this.reserve=0;
    }else{
      const target=this.charging&&grounded?tuning.maxSpeed:kiteCruiseSpeed(distance,tuning.cruiseSpeed)+this.wind*1.25;
      const accel=this.charging&&grounded?tuning.chargeBoost:tuning.chargeDecay;
      if(this.speed<target)this.speed=Math.min(target,this.speed+accel*dt);
      else if(!this.charging)this.speed=Math.max(target,this.speed-.65*dt);
    }
    const targetLateral=input.moveX*KITE_TOW.steeringSpeed+this.wind*KITE_TOW.windDrift;
    this.lateral+=(targetLateral-this.lateral)*(1-Math.exp(-KITE_TOW.steeringResponse*dt));
    return {jumpCharge,dx:this.lateral*dt,dz:-this.speed*dt};
  }
  gravity(rising:boolean):number{return rising?KITE_TOW.riseGravity:KITE_TOW.fallGravity;}
}
