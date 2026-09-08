import type { CampaignIslandId } from './campaign';

/** Map-only landscape design. No ocean parameters or gameplay collision. */
export const MAP_LANDSCAPES = {
  'island-1': { minAxes: [88, 60], crater: [-88, -24, 15, 16.5] },
  'island-2': { minAxes: [47, 34], crater: null },
} as const;

const gaussian = (x:number,z:number,cx:number,cz:number,rx:number,rz:number) => Math.exp(-Math.pow((x-cx)/rx,2)-Math.pow((z-cz)/rz,2));
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};

export function mapReliefHeight(x:number,z:number,id:CampaignIslandId):number {
  let height=0;
  if(id==='island-1') {
    const dx=x+88,dz=z+24,angle=Math.atan2(dz,dx);
    const radius=Math.hypot(dx,dz)*(1+Math.sin(angle*9+.6)*.055+Math.sin(angle*15)*.022);
    const cone=34*Math.pow(Math.max(0,1-radius/47),1.2)+16*Math.exp(-Math.pow((radius-15)/7,2));
    const crater=21*Math.exp(-Math.pow(radius/10.7,6));
    height=Math.max(0,cone-crater);
    height=Math.max(height,24*gaussian(x,z,-137,-15,20,17),20*gaussian(x,z,-40,-11,20,20));
    height+=6*gaussian(x,z,-119,9,30,13)+5*gaussian(x,z,-49,11,32,15);
    // A narrow drainage valley cuts the front flank, not the navigable rail.
    const riverX=-84+Math.sin((z+20)*.105)*3;
    height-=Math.min(height*.6,8)*Math.exp(-Math.pow((x-riverX)/3.8,2))*smooth(-20,-5,z)*(1-smooth(13,23,z));
  } else {
    x-=25;
    height=26*gaussian(x,z,54,-10,18,19)+15*gaussian(x,z,32,-6,15,15)+17*gaussian(x,z,76,-7,14,18);
    height+=4*gaussian(x,z,54,13,37,17);
    height-=Math.min(height*.5,7)*Math.exp(-Math.pow((x-59-Math.sin(z*.15)*2)/3,2))*smooth(-14,1,z);
  }
  // Broad eroded ribs and softened terrace breaks remain legible at map scale.
  const ribs=(Math.sin(x*.42+z*.25)+Math.sin(x*.21-z*.38))*.5;
  const terrace=Math.sin(height*.8)*.52;
  return Math.max(0,height+(ribs*1.35+terrace)*smooth(2,10,height));
}

export const MAP_ROCK_PLACEMENTS = [
  {kind:'mapridge',p:[-142,3,-20],s:[29,21,17],yaw:15},
  {kind:'mapcliff',p:[-121,7,-20],s:[14,23,13],yaw:-35},
  {kind:'mapridge',p:[-72,12,-33],s:[31,21,16],yaw:-15},
  {kind:'mapcliff',p:[-57,5,-18],s:[16,21,12],yaw:10},
  {kind:'mapridge',p:[-32,1,-13],s:[26,20,15],yaw:-28},
  {kind:'mapcliff',p:[-156,0,4],s:[12,15,11],yaw:-25},
  {kind:'mapcliff',p:[-17,0,0],s:[13,16,10],yaw:30},
  {kind:'maparch',p:[-164,-1,8],s:[21,16,12],yaw:18},
  {kind:'mapridge',p:[75,7,-15],s:[30,23,16],yaw:10},
  {kind:'mapcliff',p:[56,2,-8],s:[13,20,11],yaw:-25},
  {kind:'mapcliff',p:[98,3,-11],s:[16,23,13],yaw:20},
  {kind:'maparch',p:[123,-1,-9],s:[19,15,11],yaw:28},
] as const;
