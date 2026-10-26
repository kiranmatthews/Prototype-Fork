import {sfx} from '../audio';
import type {Vector3} from 'three';
import type {CartImpact,CartState,GolfCartPhysics} from './physics';

/** A bounded local mix through the game's SFX bus; pause/navigation own its loops. */
export class CartRaceAudio {
  private crashAt:number[]=[];
  private clock=0;
  private thrustWas=false;
  private stops=new Map<string,()=>void>();
  private gain(c:{x:number;y:number;z:number},listener:Vector3){return Math.max(0,1-Math.hypot(c.x-listener.x,c.y-listener.y,c.z-listener.z)/55);}
  impact(hit:CartImpact,listener:Vector3){
    if(hit.strength<1.2||this.clock-(this.crashAt[hit.cart]??-10)<.18)return;
    this.crashAt[hit.cart]=this.clock;
    const gain=this.gain(hit,listener)*Math.min(.7,.12+hit.strength*.045);
    this.shot(`impact-${hit.cart}`,'kartCrash',gain,.8+Math.min(.35,hit.strength*.025));
  }
  explosion(c:CartState,listener:Vector3){this.shot('explosion','kartExplosion',this.gain(c,listener)*.75,.94);}
  thrust(c:CartState,index:number,listener:Vector3){this.shot(`thrust-${index}`,'kartThrusterStart',this.gain(c,listener)*.55,1);}
  private shot(id:string,name:string,gain:number,rate:number){
    if(gain<.01)return;
    const stop=sfx.playManaged(`rally-${id}`,name,gain,rate);if(stop)this.stops.set(id,stop);
  }
  update(dt:number,world:GolfCartPhysics,owners:readonly number[],humanCart:number,burning:readonly boolean[],burnAge:readonly number[],thrust:readonly number[],listener:Vector3){
    this.clock+=dt;
    const candidates=world.carts.map((c,i)=>({c,i,gain:this.gain(c,listener)})).filter(v=>owners[v.i]>=0&&!burning[v.i]&&v.gain>0).sort((a,b)=>(a.i===humanCart?-1:b.i===humanCart?1:b.gain-a.gain)).slice(0,4);
    for(let slot=0;slot<4;slot++){
      const v=candidates[slot],own=v?.i===humanCart,input=v?world.inputs[v.i]:null;
      const speed=v?Math.min(1,Math.abs(v.c.speed)/38):0,gas=Math.abs(input?.throttle??0);
      sfx.setLoop(`rally-engine-${slot}`,'kartEngine',!!v,(own?.25:.075)*(v?.gain??0)*(.55+gas*.45),.72+speed*.82+gas*.10);
    }
    let skid=0,fire=0,jet=0,skidRate=1;
    for(let i=0;i<world.carts.length;i++){
      const c=world.carts[i],g=this.gain(c,listener),input=world.inputs[i],owner=owners[i];if(g<=0)continue;
      const lateral=Math.abs(c.vx*Math.cos(c.yaw)-c.vz*Math.sin(c.yaw));
      const slide=c.grounded&&!burning[i]&&Math.abs(c.speed)>4?Math.max(input.handbrake?.8:0,input.brake*.65,Math.min(1,Math.max(0,lateral-1.5)/4)):0;
      const volume=slide*g*(i===humanCart?.30:.12);if(volume>skid){skid=volume;skidRate=.85+Math.min(1,Math.abs(c.speed)/38)*.3;}
      if(burning[i]&&burnAge[i]<12)fire=Math.max(fire,g*.32*Math.min(1,(12-burnAge[i])/3));
      if(owner>=0&&thrust[owner]>0)jet=Math.max(jet,g*(i===humanCart?.4:.14));
    }
    sfx.setLoop('rally-skid','kartSkid',skid>.005,skid,skidRate);
    sfx.setLoop('rally-fire','kartFire',fire>.005,fire,.9);
    sfx.setLoop('rally-thruster','kartThrusterLoop',jet>.005,jet,1);
    if(this.thrustWas&&jet<=.005)this.shot('thrust-end','kartThrusterEnd',.25,1);
    this.thrustWas=jet>.005;
  }
  dispose(){for(let i=0;i<4;i++)sfx.setLoop(`rally-engine-${i}`,'kartEngine',false,0);for(const id of ['skid','fire','thruster'])sfx.setLoop(`rally-${id}`,'kartEngine',false,0);for(const stop of this.stops.values())stop();this.stops.clear();}
}
