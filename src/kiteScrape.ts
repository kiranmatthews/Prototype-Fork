type Point = {x:number;y:number;z:number};
type Box = {min:Point;max:Point};

export const KITE_SCRAPE_SECONDS=.5;
export const KITE_SCRAPE_SKIN=.04;

/** Only an X face is a sideways scrape in the kite's -Z corridor. Swept
 * entry keeps an oblique approach to a planter's front a head-on crash. */
export function kiteBoxSide(prev:Point,pos:Point,half:Point,box:Box,continuingSide=0):number {
  const minX=box.min.x-half.x,maxX=box.max.x+half.x;
  const minZ=box.min.z-half.z,maxZ=box.max.z+half.z;
  // A shallow projecting pier is part of an existing wall scrape. Its little
  // leading face must not shorten the promised window at every masonry joint.
  const sideDepth=continuingSide<0?pos.x-minX:maxX-pos.x;
  if(continuingSide&&sideDepth>=-KITE_SCRAPE_SKIN&&sideDepth<=.3)return continuingSide;
  if(prev.x<=minX&&prev.z>=minZ&&prev.z<=maxZ)return -1;
  if(prev.x>=maxX&&prev.z>=minZ&&prev.z<=maxZ)return 1;
  const dx=pos.x-prev.x,dz=pos.z-prev.z;
  if(prev.x>minX&&prev.x<maxX&&prev.z>minZ&&prev.z<maxZ){
    const left=pos.x-minX,right=maxX-pos.x;
    return Math.min(left,right)<Math.min(pos.z-minZ,maxZ-pos.z)?(left<right?-1:1):0;
  }
  const tx=dx===0?-Infinity:Math.min((minX-prev.x)/dx,(maxX-prev.x)/dx);
  const tz=dz===0?-Infinity:Math.min((minZ-prev.z)/dz,(maxZ-prev.z)/dz);
  return tx>tz?(dx>0?-1:1):0;
}

/** One continuous contact episode, regardless of masonry joints/collider
 * count. A real separation immediately restores the full correction window. */
export class KiteScrape {
  seconds=0;
  side=0;
  get active():boolean{return this.seconds>0;}
  reset():void{this.seconds=0;this.side=0;}
  step(side:number,dt:number):boolean{
    this.side=side;
    this.seconds=side?this.seconds+dt:0;
    return this.seconds>=KITE_SCRAPE_SECONDS-1e-7;
  }
}
