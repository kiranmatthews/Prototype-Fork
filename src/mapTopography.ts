import { CAMPAIGN_ISLANDS, type CampaignIslandId } from './campaign';

/** Map-only landscape design. No ocean parameters or gameplay collision. */
export const MAP_LANDSCAPES = {
  'island-1': { minAxes: [70,68], crater: [2,-3,7,9.3], sand:0xffe5ad, grass:0x6eaf62, rock:0x7e9882, foliage:0xb8d9a7, palms:100, trees:170 },
  'island-2': { minAxes: [69,68], crater:null, sand:0xedc18a, grass:0x66874c, rock:0x9a7961, foliage:0xc3c891, palms:85, trees:150 },
  'island-3': { minAxes: [70,68], crater:null, sand:0xa8afba, grass:0x645e79, rock:0x6b637f, foliage:0x8a83aa, palms:0, trees:65 },
  'island-4': { minAxes: [69,65], crater:null, sand:0xf6e1b5, grass:0x8caa79, rock:0xa4b1a5, foliage:0xc5d6ae, palms:24, trees:70 },
  'island-5': { minAxes: [70,68], crater:null, sand:0x84706b, grass:0x514c55, rock:0x514451, foliage:0x8e6575, palms:0, trees:30 },
  'hidden-shores': { minAxes: [80,74], crater:null, sand:0xc1b6dd, grass:0x578e92, rock:0x677da5, foliage:0xb2dce1, palms:0, trees:80 },
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
  const centre = CAMPAIGN_ISLANDS.find(island=>island.id===id)!.centre;
  x -= centre[0]; z -= centre[2];
  if(id==='island-1'){
    const r=polygonRadius(x-2,(z+3)*1.05,9,.12,1.25);
    const caldera=profile(r,[[0,8],[5,8],[7,10],[9,19],[11,21],[14,20],[17,14],[21,8],[25,3],[31,0]]);
    return caldera;
  }
  const cx = 0;
  if (id === 'island-4') return Math.max(butte(x,z,cx-12,0,18,18,7,.3),butte(x,z,cx+14,2,16,14,5,.6));
  if (id === 'island-5') return Math.max(butte(x,z,cx,-2,22,24,25,.2),butte(x,z,cx-12,0,14,15,12,.6),butte(x,z,cx+14,2,14,14,15,.1));
  return Math.max(butte(x,z,cx-8,-2,18,18,id==='island-3'?17:19,.15),butte(x,z,cx+10,1,17,18,id==='hidden-shores'?20:15,.6));
}

export const MAP_ROCK_PLACEMENTS = CAMPAIGN_ISLANDS.flatMap(island => {
  const [cx,,cz]=island.centre, height=island.id==='island-4'?6:island.id==='island-5'?17:12;
  return [-9,11].map((offset,index) => ({kind:'mapridge' as const,
    p:[cx+offset,2,cz-3] as const,s:[16,height,13] as const,yaw:index?25:-20}));
});
