import type { Input } from '../input';
import type { CartInput } from './physics';
import { solveSkateSteering } from '../skateSteering';
import { CONST, TUNING } from '../tuning';

interface RallyControlFrame {yaw:number;speed:number;forward:{x:number;z:number}}
/** Same input intent as skating: X powers/charges, release hops, stick aims,
 * pull-back and Circle brake. Only the vehicle solver supplies the handling. */
export class RallyControls {
  charge=0;
  private held=false;
  sample(dt:number,input:Input,frame:RallyControlFrame={yaw:0,speed:0,forward:{x:0,z:-1}}):CartInput {
    const held=!!input.jumpHeld&&!input.jumpCancelled;
    if(input.jumpCancelled){this.charge=0;this.held=false;}
    const release=!input.jumpCancelled&&(!!input.jumpReleased||this.held&&!held);
    const hop=release&&this.charge>0,hopCharge=this.charge;
    if(held)this.charge=Math.min(1,this.charge+dt/Math.max(.01,TUNING.jumpChargeTime));
    if(release)this.charge=0;this.held=held;
    const fx=-Math.sin(frame.yaw),fz=-Math.cos(frame.yaw),x=input.moveX??0,y=input.moveY??0;
    const intent=solveSkateSteering(fx,fz,frame.forward.x,frame.forward.z,x,y,CONST.carveBrakeAngle);
    const pullback=intent.intent==='pullback-brake';
    // Pull back to stop; X plus back from rest can reverse the physical car.
    const reverse=pullback&&frame.speed<.6&&held;
    const steering=reverse?solveSkateSteering(-fx,-fz,frame.forward.x,frame.forward.z,x,y,CONST.carveBrakeAngle):intent;
    const brake=!!input.grabHeld||pullback&&!reverse;
    return {throttle:held&&!brake?(reverse?-1:1):0,
      steer:brake?0:Math.max(-1,Math.min(1,steering.angle*(reverse?-1:1)*1.9)),
      brake:brake?1:0,handbrake:!!input.transferHeld,hop,hopCharge};
  }
  reset(){this.charge=0;this.held=false;}
}
