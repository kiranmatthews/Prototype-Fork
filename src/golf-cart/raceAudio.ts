import {sfx} from '../audio';
import type {Vector3} from 'three';
import type {CartImpact,CartLanding,CartState,GolfCartPhysics} from './physics';

/** A bounded local mix through the game's SFX bus; pause/navigation own its loops. */
export class CartRaceAudio {
  private crashAt:number[]=[];
  private engines=new Map<number,{gain:number;rate:number}>();
  private clock=0;
  private thrustWas=false;
  private stops=new Map<string,()=>void>();
  private gain(c:{x:number;y:number;z:number},listener:Vector3){return Math.max(0,1-Math.max(0,Math.hypot(c.x-listener.x,c.y-listener.y,c.z-listener.z)-3)/67)**2;}
  impact(hit:CartImpact,listener:Vector3){
    if(hit.landing||hit.strength<1.2||this.clock-(this.crashAt[hit.cart]??-10)<.18)return;
    this.crashAt[hit.cart]=this.clock;
    const gain=this.gain(hit,listener)*Math.min(.7,.12+hit.strength*.045);
    this.shot(`impact-${hit.cart}`,'kartCrash',gain,.8+Math.min(.35,hit.strength*.025));
  }
  landing(hit:CartLanding,listener:Vector3,humanCart:number){
    const force=Math.min(1,Math.max(0,(hit.strength-2.8)/19));
    const gain=this.gain(hit,listener)*(.30+force*.58)*(hit.cart===humanCart?1:.5);
    const variation=((hit.cart*37+Math.floor(this.clock*17))%11)/100;
    this.shot(`landing-${hit.cart}`,'kartLanding',gain,1.04-force*.18+variation);
  }
  explosion(c:CartState,listener:Vector3){this.shot('explosion','kartExplosion',this.gain(c,listener)*.75,.94);}
  thrust(c:CartState,index:number,listener:Vector3){this.shot(`thrust-${index}`,'kartThrusterStart',this.gain(c,listener)*.55,1);}
  private shot(id:string,name:string,gain:number,rate:number){
    if(gain<.01)return;
    const stop=sfx.playManaged(`rally-${id}`,name,gain,rate);if(stop)this.stops.set(id,stop);
  }
  update(dt:number,world:GolfCartPhysics,owners:readonly number[],humanCart:number,burning:readonly boolean[],burnAge:readonly number[],thrust:readonly number[],listener:Vector3){
    this.clock+=dt;
    // Stable channels follow each physical kart, including after a theft. At
    // most the eight occupied carts run engines; empty loaners stay silent.
    const blend=1-Math.exp(-dt/0.12);
    for(let i=0;i<world.carts.length;i++){
      const c=world.carts[i],distanceGain=this.gain(c,listener),own=i===humanCart;
      if(owners[i]<0||burning[i]||distanceGain<=.001){
        if(this.engines.delete(i))sfx.setLoop(`rally-engine-${i}`,'kartEngine',false,0);
        continue;
      }
      const speed=Math.min(1,Math.abs(c.speed)/38),gas=Math.abs(world.inputs[i]?.throttle??0);
      const gain=(own?.38+gas*.18+speed*.03:.10+gas*.06+speed*.015)*distanceGain;
      // A real four-second engine recording retains piston rattle and intake
      // harmonics in the laptop-speaker band. The unloaded motor revs in air.
      const rate=.95+speed*.85+gas*.18+(c.grounded?0:.28+gas*.12)+(i%7-3)*.009;
      const voice=this.engines.get(i)??{gain,rate};
      voice.gain+=(gain-voice.gain)*blend;voice.rate+=(rate-voice.rate)*blend;
      this.engines.set(i,voice);
      sfx.setLoop(`rally-engine-${i}`,'kartEngine',true,voice.gain,voice.rate);
    }
    let skid=0,fire=0,jet=0,skidRate=1;
    for(let i=0;i<world.carts.length;i++){
      const c=world.carts[i],g=this.gain(c,listener),input=world.inputs[i],owner=owners[i];if(g<=0)continue;
      const lateral=Math.abs(c.vx*Math.cos(c.yaw)-c.vz*Math.sin(c.yaw));
      const slide=c.grounded&&!burning[i]&&Math.abs(c.speed)>4?Math.max(input.handbrake?.8:0,input.brake*.65,Math.min(1,Math.max(0,lateral-1.5)/4)):0;
      const volume=slide*g*(i===humanCart?.30:.12);if(volume>skid){skid=volume;skidRate=.85+Math.min(1,Math.abs(c.speed)/38)*.3;}
      if(burning[i]&&burnAge[i]<12)fire=Math.max(fire,g*.78*Math.min(1,(12-burnAge[i])/3));
      if(owner>=0&&thrust[owner]>0)jet=Math.max(jet,g*(i===humanCart?.4:.14));
    }
    sfx.setLoop('rally-skid','kartSkid',skid>.005,skid,skidRate);
    sfx.setLoop('rally-fire','kartFire',fire>.005,fire,1);
    sfx.setLoop('rally-thruster','kartThrusterLoop',jet>.005,jet,1);
    if(this.thrustWas&&jet<=.005)this.shot('thrust-end','kartThrusterEnd',.25,1);
    this.thrustWas=jet>.005;
  }
  dispose(){for(const i of this.engines.keys())sfx.setLoop(`rally-engine-${i}`,'kartEngine',false,0);this.engines.clear();for(const id of ['skid','fire','thruster'])sfx.setLoop(`rally-${id}`,'kartEngine',false,0);for(const stop of this.stops.values())stop();this.stops.clear();}
}
