import * as THREE from 'three';
import type { Level } from '../level';
import type { RaceKnot } from './types';

/** Three-dimensional ordered projection keeps stacked loops on their own leg. */
export class RaceCourse {
  readonly arc: number[] = [0];
  readonly length: number;
  private ray = new THREE.Raycaster();
  private origin = new THREE.Vector3();
  private down = new THREE.Vector3(0,-1,0);
  private landing = new THREE.Vector3();
  constructor(readonly knots: readonly RaceKnot[]) {
    for(let i=1;i<knots.length;i++)this.arc.push(this.arc[i-1]+Math.hypot(knots[i][0]-knots[i-1][0],knots[i][1]-knots[i-1][1],knots[i][2]-knots[i-1][2]));
    this.length=this.arc[this.arc.length-1];
  }
  segment(s:number):number {
    let lo=0,hi=this.arc.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(this.arc[mid]<=s)lo=mid;else hi=mid;}
    return Math.min(lo,this.knots.length-2);
  }
  sample(s:number,offset=0,target=new THREE.Vector3()):THREE.Vector3 {
    s=THREE.MathUtils.clamp(s,0,this.length);const i=this.segment(s),a=this.knots[i],b=this.knots[i+1];
    const t=(s-this.arc[i])/(this.arc[i+1]-this.arc[i]||1),dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;
    return target.set(a[0]+dx*t-dz/n*offset,a[1]+(b[1]-a[1])*t,a[2]+dz*t+dx/n*offset);
  }
  tangent(s:number,target=new THREE.Vector3()):THREE.Vector3 {
    const i=this.segment(s),a=this.knots[i],b=this.knots[i+1];return target.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]).normalize();
  }
  width(s:number):number {const i=this.segment(s);return Math.min(this.knots[i][3],this.knots[i+1][3]);}
  project(p:THREE.Vector3,previous?:number,window=70):{s:number;distance:number;offset:number} {
    let best=Infinity,s=previous??0,offset=0,first=0,last=this.knots.length-1;
    if(previous!==undefined){
      // Keep both segments at exact window boundaries, including repeated
      // knots. The first equal-distance segment must still win at crossings.
      const lower=previous-window,upper=previous+window;
      let lo=1,hi=this.knots.length;
      while(lo<hi){const mid=(lo+hi)>>1;if(this.arc[mid]<lower)lo=mid+1;else hi=mid;}
      first=lo-1;
      lo=0;hi=this.knots.length-1;
      while(lo<hi){const mid=(lo+hi)>>1;if(this.arc[mid]<=upper)lo=mid+1;else hi=mid;}
      last=lo;
    }
    for(let i=first;i<last;i++){
      const a=this.knots[i],b=this.knots[i+1],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2];
      const span=this.arc[i+1]-this.arc[i]||1;
      const lo=previous===undefined?0:Math.max(0,(previous-window-this.arc[i])/span),hi=previous===undefined?1:Math.min(1,(previous+window-this.arc[i])/span);
      const t=THREE.MathUtils.clamp(((p.x-a[0])*x+(p.y-a[1])*y+(p.z-a[2])*z)/(x*x+y*y+z*z||1),lo,hi);
      const dx=p.x-a[0]-x*t,dy=p.y-a[1]-y*t,dz=p.z-a[2]-z*t,d=dx*dx+dy*dy+dz*dz;
      if(d<best){best=d;s=this.arc[i]+(this.arc[i+1]-this.arc[i])*t;offset=(dx*-z+dz*x)/(Math.hypot(x,z)||1);}
    }
    return {s,distance:Math.sqrt(best),offset};
  }
  /** Conservative landing reach below the rider, including other stacked legs.
   * The line proposes candidates; actual live floor collision confirms them. */
  hasReachableLanding(level:Level,position:THREE.Vector3,verticalSpeed:number,travelSpeed:number,gravity:number,terminal:number):boolean {
    const down=Math.min(terminal,Math.max(0,-verticalSpeed)),accelerate=(terminal-down)/gravity;
    const acceleratedDrop=(down+terminal)*.5*accelerate;
    for(let i=0;i<this.knots.length-1;i++){
      const a=this.knots[i],b=this.knots[i+1],dx=b[0]-a[0],dz=b[2]-a[2];
      const nearest=THREE.MathUtils.clamp(((position.x-a[0])*dx+(position.z-a[2])*dz)/(dx*dx+dz*dz||1),0,1);
      for(const t of [nearest,0,1]){
        const x=a[0]+dx*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+dz*t;
        if(y>position.y+1||y<=level.killY)continue;
        const drop=Math.max(0,position.y-y);
        const seconds=drop<=acceleratedDrop?(Math.sqrt(down*down+2*gravity*drop)-down)/gravity:accelerate+(drop-acceleratedDrop)/terminal;
        const reach=travelSpeed*(seconds+.2)+Math.max(a[3],b[3])*.5+3;
        if(Math.hypot(position.x-x,position.z-z)>reach)continue;
        this.origin.set(x,y,z);
        if(this.supportAt(level,this.origin,this.landing,12,12)&&this.landing.y<=position.y+1)return true;
      }
    }
    return false;
  }
  /** Only a real, nearby safe floor can become a recovery anchor. */
  support(level:Level,s:number,target=new THREE.Vector3()):THREE.Vector3|null {
    this.sample(s,0,this.origin);
    return this.supportAt(level,this.origin,target);
  }
  supportAt(level:Level,point:THREE.Vector3,target=new THREE.Vector3(),above=3,below=4):THREE.Vector3|null {
    this.origin.copy(point);this.origin.y+=above;
    this.ray.set(this.origin,this.down);this.ray.near=0;this.ray.far=above+below;
    const hit=this.ray.intersectObjects(level.groundMeshes,false).find(h=>!h.object.userData.lethal&&!h.object.userData.outOfBounds&&h.face&&h.face.normal.y>0.1);
    if(!hit)return null;
    target.copy(hit.point);target.y+=.06;
    if(level.pitBoxes.some(b=>b.containsPoint(target)))return null;
    return target;
  }
}
