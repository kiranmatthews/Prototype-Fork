import type { Input } from '../input';
import type { CartInput } from './physics';
import { solveSkateSteering } from '../skateSteering';
import { CONST } from '../tuning';

interface RallyControlFrame {yaw:number;speed:number;forward:{x:number;z:number}}
/** Skating's accelerator/steering/brake intent, with no vehicle jump action. */
export class RallyControls {
  sample(_dt:number,input:Input,frame:RallyControlFrame={yaw:0,speed:0,forward:{x:0,z:-1}}):CartInput {
    const held=!!input.jumpHeld&&!input.jumpCancelled;
    const fx=-Math.sin(frame.yaw),fz=-Math.cos(frame.yaw),x=input.moveX??0,y=input.moveY??0;
    const intent=solveSkateSteering(fx,fz,frame.forward.x,frame.forward.z,x,y,CONST.carveBrakeAngle);
    const pullback=intent.intent==='pullback-brake';
    // Pull back to stop; X plus back from rest can reverse the physical car.
    const reverse=pullback&&frame.speed<.6&&held;
    const steering=reverse?solveSkateSteering(-fx,-fz,frame.forward.x,frame.forward.z,x,y,CONST.carveBrakeAngle):intent;
    const brake=!!input.grabHeld||pullback&&!reverse;
    return {throttle:held&&!brake?(reverse?-1:1):0,
      steer:brake?0:Math.max(-1,Math.min(1,steering.angle*(reverse?-1:1)*1.9)),
      brake:brake?1:0,handbrake:!!input.transferHeld,hop:false};
  }
  reset(){}
}
