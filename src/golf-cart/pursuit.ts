import * as THREE from 'three';
import { RaceCourse } from '../race/course';
import { CART_PHYSICS, type CartSpawn, type GolfCartPhysics } from './physics';

export const COUNTRY_CLUB_CART_COUNT=10;
export const COUNTRY_CLUB_CART_SCALE=2;
export interface CartChaseTarget {id:number;position:THREE.Vector3;progress:number;speed:number}
export interface CartJump {start:number;end:number}

/** Physical pursuit along the same safe racing line as the skaters. No position
 * animation or rubber-band teleports: throttle, steering and hops do the work. */
export class CartRacePursuit {
  readonly progress:number[]=[];
  readonly targetIds:number[]=Array(COUNTRY_CLUB_CART_COUNT).fill(-1);
  readonly initial:CartSpawn[];
  private aim=new THREE.Vector3();private position=new THREE.Vector3();private forward=new THREE.Vector3();
  private stuck=Array(COUNTRY_CLUB_CART_COUNT).fill(0);
  private anchorAt=Array(COUNTRY_CLUB_CART_COUNT).fill(-Infinity);
  constructor(readonly course:RaceCourse,readonly jumps:readonly CartJump[]){
    const stations=[40,88,...[.10,.20,.29,.40,.50,.63,.75,.87].map(t=>t*course.length)];
    this.initial=stations.map((station,i)=>{
      for(const gap of jumps)if(station>gap.start-55&&station<gap.end+45)station=gap.end+55;
      this.progress[i]=station;
      const point=course.sample(station,(i%2?1:-1)*this.laneRoom(station));
      const tangent=course.tangent(station);
      return {x:point.x,z:point.z,yaw:Math.atan2(-tangent.x,-tangent.z)};
    });
  }
  private laneRoom(s:number){return Math.max(0,Math.min(4.4,this.course.width(s)/2-2.7));}
  protectedJump(s:number){return this.jumps.some(g=>s>g.start-35&&s<g.end+22);}
  reset(world:GolfCartPhysics){
    for(let i=0;i<world.carts.length;i++){
      Object.assign(world.spawns[i],this.initial[i]);world.reset(i);
      this.position.set(world.carts[i].x,world.carts[i].y,world.carts[i].z);
      this.progress[i]=this.course.project(this.position).s;this.targetIds[i]=-1;this.stuck[i]=0;this.anchorAt[i]=-Infinity;
    }
    world.time=0;
  }
  drive(world:GolfCartPhysics,targets:readonly CartChaseTarget[]){
    const dt=CART_PHYSICS.step,course=this.course;
    for(const [i,c] of world.carts.entries()){
      this.position.set(c.x,c.y,c.z);
      const projected=course.project(this.position,this.progress[i],100),s=projected.s;
      this.progress[i]=s;
      // Two carts pursue the human; the others select nearby members of the pack.
      // A staggered preference spreads traffic rather than forming one roadblock.
      let target=targets.find(t=>t.id===0&&(i===0||i===5));
      if(!target)target=targets.reduce<CartChaseTarget|undefined>((best,t)=>{
        const cost=(r:CartChaseTarget)=>Math.abs(r.progress-s)+(r.id===i%8?0:18);
        return !best||cost(t)<cost(best)?t:best;
      },undefined);
      this.targetIds[i]=target?.id??-1;
      const delta=target?target.progress-s:-Infinity;
      const engaged=!!target&&delta> -150;
      const gap=this.jumps.find(g=>s>g.start-40&&s<g.end+20);
      const room=this.laneRoom(s);
      let lane=engaged?0:(i%2?1:-1)*room;
      let desired=engaged?THREE.MathUtils.clamp(Math.abs(target!.speed)+(delta+12+(i%3)*5)*.6,9,74):0;
      if(engaged&&Math.abs(delta)<75){
        const riderLane=course.project(target!.position,target!.progress,12).offset;
        // A visible, gradual sweep crosses the rider's line about every 3 seconds.
        lane=THREE.MathUtils.clamp(riderLane+Math.sin(world.time*1.05+i*1.9)*4.4,-room,room);
      }
      if(gap){lane=0;if(engaged)desired=Math.max(50,desired);}
      const look=THREE.MathUtils.clamp(Math.abs(c.speed)*.5,10,30),ahead=Math.min(course.length,s+look);
      lane=THREE.MathUtils.clamp(lane,-this.laneRoom(ahead),this.laneRoom(ahead));
      course.sample(ahead,lane,this.aim);
      const dx=this.aim.x-c.x,dz=this.aim.z-c.z,d2=Math.max(4,dx*dx+dz*dz);
      const localX=dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw),curvature=-2*localX/d2;
      const steer=THREE.MathUtils.clamp(Math.atan(curvature*CART_PHYSICS.wheelbase*world.scale)*(1+Math.abs(c.speed)*.035)/.54,-1,1);
      // Carry speed on straights, then use the cart's own brakes for the bends.
      if(!gap)desired=Math.min(desired,Math.sqrt(42/Math.max(.003,Math.abs(curvature))));
      if(s>course.length-40)desired=Math.min(desired,Math.max(0,(course.length-12-s)*.7));
      const error=desired-c.speed;
      world.inputs[i]={throttle:desired>0?THREE.MathUtils.clamp(error*.24+.14,0,1):0,steer,
        brake:THREE.MathUtils.clamp(-error*.14,0,1),handbrake:false,
        hop:!!gap&&engaged&&s>gap.start-5&&s<gap.start+3&&c.speed>32};
      // Store supported local recovery positions as the convoy advances. Falls
      // and a genuinely stuck vehicle reuse the normal finite cart reset.
      if(c.grounded&&!c.tumbling&&!this.protectedJump(s)&&projected.distance<room+2&&s>this.anchorAt[i]+15){
        const at=Math.max(0,s-10);course.sample(at,0,this.aim);course.tangent(at,this.forward);
        Object.assign(world.spawns[i],{x:this.aim.x,z:this.aim.z,yaw:Math.atan2(-this.forward.x,-this.forward.z)});this.anchorAt[i]=s;
      }
      this.stuck[i]=engaged&&desired>8&&Math.abs(c.speed)<2&&!c.tumbling?this.stuck[i]+dt:0;
      if(this.stuck[i]>4){world.reset(i,false);this.stuck[i]=0;}
    }
  }
}
