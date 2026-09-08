import type { CampaignIslandId } from './campaign';

/** Map-only landscape design. No ocean parameters or gameplay collision. */
export const MAP_LANDSCAPES = {
  'island-1': { minAxes: [88, 60], crater: [-88, -24, 15, 16.5] },
  'island-2': { minAxes: [47, 34], crater: null },
} as const;

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const smoothMax=(a:number,b:number,k:number)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k*.25};
function polygonRadius(x:number,z:number,sides:number,rotation:number,bevel:number):number {
  let radius=-Infinity;
  for(let i=0;i<sides;i++){const angle=rotation+i*Math.PI*2/sides;radius=smoothMax(radius,x*Math.cos(angle)+z*Math.sin(angle),bevel);}
  return radius;
}
function profile(radius:number,points:readonly (readonly [number,number])[]):number {
  for(let i=1;i<points.length;i++)if(radius<points[i][0]){
    const [a,y0]=points[i-1],[b,y1]=points[i];return y0+(y1-y0)*smooth(a,b,radius);
  }
  return points[points.length-1][1];
}
function butte(x:number,z:number,cx:number,cz:number,rx:number,rz:number,height:number,rotation:number):number {
  const r=polygonRadius((x-cx)/rx,(z-cz)/rz,6,rotation,.05);
  return height*profile(r,[[0,1],[.26,.97],[.34,.91],[.48,.74],[.59,.71],[.68,.43],[.81,.36],[.95,.07],[1.12,0]]);
}

/** Deliberate cliff planes and terraces with radiused breaks, not texture-painted strata. */
export function mapReliefHeight(x:number,z:number,id:CampaignIslandId):number {
  if(id==='island-1'){
    const r=polygonRadius(x+88,(z+24)*1.05,9,.12,1.25);
    const caldera=profile(r,[[0,15],[7,15],[9,17],[11.5,35],[14,37],[17.5,36.5],[19.5,30],[23,28.5],[26,17.5],[30,16],[33,6],[43,0]]);
    return Math.max(caldera,butte(x,z,-137,-15,23,20,25,.25),butte(x,z,-40,-11,23,23,23,.65));
  }
  return Math.max(butte(x,z,79,-10,22,23,30,.15),butte(x,z,57,-6,20,18,19,.6),butte(x,z,101,-7,18,23,22,.3));
}

export const MAP_ROCK_PLACEMENTS = [
  {kind:'mapridge',p:[-142,3,-20],s:[29,21,17],yaw:15},
  {kind:'mapcliff',p:[-108,7,-15],s:[16,25,11],yaw:-20},
  {kind:'mapridge',p:[-72,12,-33],s:[31,21,16],yaw:-15},
  {kind:'mapcliff',p:[-57,5,-18],s:[16,21,12],yaw:10},
  {kind:'mapridge',p:[-32,1,-13],s:[26,20,15],yaw:-28},
  {kind:'mapcliff',p:[-156,0,4],s:[12,15,11],yaw:-25},
  {kind:'mapcliff',p:[-17,0,0],s:[13,16,10],yaw:30},
  {kind:'mapcliff',p:[-164,-1,8],s:[21,16,12],yaw:18},
  {kind:'mapridge',p:[78,7,-3],s:[30,23,10],yaw:10},
  {kind:'mapcliff',p:[56,2,-8],s:[13,20,11],yaw:-25},
  {kind:'mapcliff',p:[98,3,-11],s:[16,23,13],yaw:20},
  {kind:'mapridge',p:[123,-1,-9],s:[19,15,11],yaw:28},
] as const;
