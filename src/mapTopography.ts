import type { CampaignIslandId } from './campaign';

/** Map-only landscape design. No ocean parameters or gameplay collision. */
export const MAP_LANDSCAPES = {
  'island-1': { minAxes: [88,60], crater: [-88,-24,15,16.5], centre:-95, sand:0xffe5ad, grass:0x6eaf62, rock:0x7e9882, foliage:0xb8d9a7, palms:100, trees:170 },
  'island-2': { minAxes: [88,52], crater:null, centre:150, sand:0xedc18a, grass:0x66874c, rock:0x9a7961, foliage:0xc3c891, palms:85, trees:150 },
  'island-3': { minAxes: [88,48], crater:null, centre:395, sand:0xa8afba, grass:0x645e79, rock:0x6b637f, foliage:0x8a83aa, palms:0, trees:65 },
  'island-4': { minAxes: [88,46], crater:null, centre:640, sand:0xf6e1b5, grass:0x8caa79, rock:0xa4b1a5, foliage:0xc5d6ae, palms:24, trees:70 },
  'island-5': { minAxes: [88,54], crater:null, centre:885, sand:0x84706b, grass:0x514c55, rock:0x514451, foliage:0x8e6575, palms:0, trees:30 },
  'hidden-shores': { minAxes: [118,56], crater:null, centre:1155, sand:0xc1b6dd, grass:0x578e92, rock:0x677da5, foliage:0xb2dce1, palms:0, trees:80 },
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
  const cx = MAP_LANDSCAPES[id].centre;
  if (id === 'island-4') return Math.max(butte(x,z,cx-30,-12,26,20,8,.3),butte(x,z,cx+32,-8,28,17,6,.6));
  if (id === 'island-5') return Math.max(butte(x,z,cx,-20,35,27,36,.2),butte(x,z,cx-45,-10,19,22,23,.6),butte(x,z,cx+43,-8,23,24,25,.1));
  return Math.max(butte(x,z,cx-24,-13,25,23,id==='island-3'?21:28,.15),butte(x,z,cx+30,-10,24,22,id==='hidden-shores'?31:23,.6));
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
  ...(['island-2','island-3','island-4','island-5','hidden-shores'] as const).flatMap((id) => {
    const cx=MAP_LANDSCAPES[id].centre, height=id==='island-4'?8:id==='island-5'?30:20;
    return [-32,30].map((offset,index) => ({kind:'mapridge' as const,p:[cx+offset,2,-15] as const,s:[27,height,16] as const,yaw:index?25:-20}));
  }),
] as const;
