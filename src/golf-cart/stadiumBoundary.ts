import { STADIUM,stadiumBoundaryPaths } from '../levels/cart-stadium-layout';
import type { CartBoundary } from './physics';
interface Segment {ax:number;az:number;dx:number;dz:number;lengthSq:number;minY:number;maxY:number}
/** A broadphase grid for the authored stadium rim. Contacts use the same rounded
 * chassis circles and impulse/damage solver as kart-to-kart collisions. */
export function createStadiumBoundary():CartBoundary {
  const cells=new Map<string,Segment[]>(),size=12;
  for(const path of stadiumBoundaryPaths())for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i],segment={ax:a[0],az:a[2],dx:b[0]-a[0],dz:b[2]-a[2],lengthSq:(b[0]-a[0])**2+(b[2]-a[2])**2,minY:Math.min(a[1],b[1])-2,maxY:Math.max(a[1],b[1])+STADIUM.wallTop};
    for(let x=Math.floor((Math.min(a[0],b[0])-3)/size);x<=Math.floor((Math.max(a[0],b[0])+3)/size);x++)for(let z=Math.floor((Math.min(a[2],b[2])-3)/size);z<=Math.floor((Math.max(a[2],b[2])+3)/size);z++){const key=`${x},${z}`,list=cells.get(key)??[];list.push(segment);cells.set(key,list);}
  }
  return (x,y,z,radius)=>{
    const nearby=cells.get(`${Math.floor(x/size)},${Math.floor(z/size)}`);if(!nearby)return null;
    let best=null,deepest=0;
    for(const s of nearby){if(y>s.maxY||y+3<s.minY)continue;const t=Math.max(0,Math.min(1,((x-s.ax)*s.dx+(z-s.az)*s.dz)/s.lengthSq)),px=s.ax+s.dx*t,pz=s.az+s.dz*t,dx=x-px,dz=z-pz,d=Math.hypot(dx,dz),depth=radius+.325-d;
      if(depth>deepest&&d>1e-7){deepest=depth;best={nx:dx/d,nz:dz/d,depth,x:px,z:pz};}
    }
    return best;
  };
}
