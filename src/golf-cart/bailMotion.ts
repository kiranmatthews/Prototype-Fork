import * as THREE from 'three';
import type { GroundSample } from './physics';
import { ROLL_LANDING_DURATION } from '../animation/rollLanding';

export const CART_BAIL={minSpeed:5.5,inherit:.38,sideSpeed:7.2,launch:7,gravity:36,rollEntry:.25,maxDuration:4} as const;
export type CartBailPhase='flight'|'roll'|'done';
/** Only the leap travels ballistically. On contact the existing skateboard
 * abandon animation owns the shoulder roll and rebound into running. */
export class CartBailMotion {
  readonly position:THREE.Vector3;
  readonly velocity:THREE.Vector3;
  phase:CartBailPhase='flight';age=0;phaseAge=0;contacts=0;
  private lostSupport=false;
  private probe=new THREE.Vector3();
  private wall=new THREE.Box3();
  constructor(position:THREE.Vector3,cart:{vx:number;vy:number;vz:number;yaw:number},side:number){
    this.position=position.clone();
    this.velocity=new THREE.Vector3(cart.vx*CART_BAIL.inherit+Math.cos(cart.yaw)*side*CART_BAIL.sideSpeed,
      CART_BAIL.launch+THREE.MathUtils.clamp(cart.vy*.35,-1,2),cart.vz*CART_BAIL.inherit-Math.sin(cart.yaw)*side*CART_BAIL.sideSpeed);
  }
  get grounded(){return this.phase!=='flight'&&!this.lostSupport;}
  get progress(){return this.phase==='flight'?CART_BAIL.rollEntry*THREE.MathUtils.smoothstep(this.age,.035,.28):Math.min(1,CART_BAIL.rollEntry+this.phaseAge/ROLL_LANDING_DURATION);}
  step(dt:number,ground:(x:number,z:number)=>GroundSample,walls:readonly THREE.Box3[]):number {
    if(this.phase==='done')return 0;this.age+=dt;this.phaseAge+=dt;const p=this.position,v=this.velocity;
    const clear=(x:number,z:number)=>{this.probe.set(x,p.y+.8,z);return !walls.some(w=>this.wall.copy(w).expandByScalar(.35).containsPoint(this.probe));};
    const x=p.x+v.x*dt,z=p.z+v.z*dt;
    if(clear(x,p.z))p.x=x;else v.x*=-.12;
    if(clear(p.x,z))p.z=z;else v.z*=-.12;
    const g=ground(p.x,p.z);
    if(this.phase==='roll'){
      if(!g.supported){this.lostSupport=true;this.phase='done';return 0;}
      p.y=g.height;v.x*=Math.exp(-2.5*dt);v.z*=Math.exp(-2.5*dt);
      if(this.progress>=1)this.phase='done';return 0;
    }
    v.y-=dt*CART_BAIL.gravity;p.y+=v.y*dt;
    if(g.supported&&v.y<0&&p.y<=g.height){
      p.y=g.height;v.y=0;v.x*=.62;v.z*=.62;this.contacts++;
      this.phase='roll';this.phaseAge=0;return this.contacts;
    }
    return 0;
  }
}
