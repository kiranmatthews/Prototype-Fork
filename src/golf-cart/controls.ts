import type { Input } from '../input';
import type { CartInput } from './physics';

/** The skating face buttons keep their jobs. Triangle is reserved for vehicles. */
export class RallyControls {
  charge=0;
  private held=false;
  sample(dt:number,input:Input):CartInput {
    if(input.jumpCancelled){this.charge=0;this.held=false;}
    const release=!input.jumpCancelled&&(!!input.jumpReleased||this.held&&!input.jumpHeld);
    const hop=release&&this.charge>0,hopCharge=this.charge;
    if(input.jumpHeld&&!input.jumpCancelled)this.charge=Math.min(1,this.charge+dt*2.5);
    if(release)this.charge=0;
    this.held=!!input.jumpHeld&&!input.jumpCancelled;
    return {throttle:input.moveY??0,steer:-(input.moveX??0),brake:input.grabHeld?1:0,
      handbrake:!!input.transferHeld,hop,hopCharge};
  }
  reset(){this.charge=0;this.held=false;}
}
