/** Kite-only Indy: all accumulated twist must return before the wheels land.
 * Angles stay unwrapped, so a complete turn still loads the tether. */
export const KITE_GRAB = Object.freeze({
  enter: .16, minimumHold: .16, spinRate: Math.PI * 2.5,
  returnBase: .48, returnRate: Math.PI * 4, overshoot: .32,
  boost: 3, boostMax: 12, boostHold: 5, boostDecay: 3,
});
const clamp = (x:number) => Math.max(0, Math.min(1, x));
const smooth = (x:number) => {const t=clamp(x);return t*t*(3-2*t);};

export class KiteGrab {
  phase: 'idle'|'held'|'return'|'ready' = 'idle';
  angle=0; pose=0; hang=0; heldTime=0; rotation=0;
  returnAge=0; returnDuration=0;
  private releaseAngle=0;
  private releasePose=0;
  private releaseHang=0;
  get active():boolean {return this.phase==='held'||this.phase==='return';}
  get pending():boolean {return this.phase!=='idle';}
  get diagnostics() {return {phase:this.phase,angle:this.angle,pose:this.pose,hang:this.hang,
    heldTime:this.heldTime,rotation:this.rotation,returnAge:this.returnAge,returnDuration:this.returnDuration};}

  reset():void {
    this.phase='idle';this.angle=this.pose=this.hang=this.heldTime=this.rotation=0;
    this.returnAge=this.returnDuration=this.releaseAngle=this.releasePose=this.releaseHang=0;
  }

  step(dt:number,input:{airborne:boolean;pressed:boolean;held:boolean;steer:number;canStart:boolean}):boolean {
    let started=false;
    if(input.airborne&&input.canStart&&input.pressed&&input.held&&!this.active){
      this.reset();this.phase='held';started=true;
    }
    if(this.phase==='held'){
      if(input.held){
        this.heldTime+=dt;
        this.pose=this.hang=smooth(this.heldTime/KITE_GRAB.enter);
        if(Math.abs(input.steer)>.3)this.angle-=KITE_GRAB.spinRate*input.steer*dt;
        this.rotation=Math.max(this.rotation,Math.abs(this.angle));
      }else{
        this.phase='return';this.returnAge=0;
        this.releaseAngle=this.angle;this.releasePose=this.pose;this.releaseHang=this.hang;
        this.returnDuration=KITE_GRAB.returnBase+Math.abs(this.angle)/KITE_GRAB.returnRate;
      }
    }
    if(this.phase==='return'){
      this.returnAge=Math.min(this.returnDuration,this.returnAge+dt);
      const t=this.returnAge/this.returnDuration;
      const bounce=Math.sign(this.releaseAngle)*Math.min(KITE_GRAB.overshoot,Math.abs(this.releaseAngle)*.16);
      // Immediate reverse drive, a visible overshoot, then a finite settle.
      // Do not take the nearest equivalent orientation or erase whole turns.
      if(t<.66){const u=t/.66;this.angle=-bounce+(this.releaseAngle+bounce)*(1-u)**3;}
      else this.angle=-bounce*(1-smooth((t-.66)/.34));
      this.pose=this.releasePose*(1-smooth(this.returnAge/.20));
      this.hang=this.releaseHang*(1-smooth((t-.64)/.36));
      if(this.returnAge>=this.returnDuration-1e-9){this.phase='ready';this.angle=this.pose=this.hang=0;}
    }
    return started;
  }

  land():{failed:boolean;earned:boolean;rotation:number} {
    const result={failed:this.active,earned:this.phase==='ready'&&this.heldTime>=KITE_GRAB.minimumHold,
      rotation:this.rotation};
    this.reset();return result;
  }
}
