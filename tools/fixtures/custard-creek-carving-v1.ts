// Independent historical source fixture: 04557f6aa0bc49eb03d4ef22030d7ea5efcc0791.
// Retain the old authoring generator instead of duplicating its 3 MB snapshot.
import type {CustomComponent, CustomGroup, CustomLevelData} from '../../src/level';

// A sister course to Carlisle: metre-scale, long downhill journey, breathing
// room between encounters. The road, boxes and camera share one smooth spine.
// Native mesh/rail/woodpath data keeps the entire course editable/exportable.
type Point = [number, number, number];
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [];
const round = (v:number) => Math.round(v * 4096) / 4096;
const clamp = (v:number) => Math.max(0, Math.min(1, v));
const smooth = (v:number) => {const t=clamp(v); return t*t*(3-2*t);};
export const CUSTARD_CREEK_END = 2240;
const Y: [number,number][] = [[-20,0],[38,0],[105,-5],[228,-5],[295,-13],
  [670,-13],[790,-16],[875,-22],[1060,-22],[1225,-16],[1320,-13],
  [1450,-13],[1560,-19],[1715,-19],[1840,-26],[2280,-26]];
export function custardHeight(s:number):number {
  for(let i=1;i<Y.length;i++) if(s<=Y[i][0]) {
    const a=Y[i-1],b=Y[i]; return a[1]+(b[1]-a[1])*smooth((s-a[0])/(b[0]-a[0]));
  }
  return Y[Y.length-1][1];
}
export const custardX = (s:number) => 29*Math.sin(s*2*Math.PI/280)+11*Math.sin(s*2*Math.PI/620);
const derivative = (s:number) => 29*2*Math.PI/280*Math.cos(s*2*Math.PI/280)+11*2*Math.PI/620*Math.cos(s*2*Math.PI/620);
export function custardTangent(s:number):Point {const d=derivative(s),n=Math.hypot(d,1);return [d/n,0,-1/n];}
// Up to six degrees of crossfall: the outside of each turn rises gently.
export const custardBank = (s:number) => .095*Math.sin(s*2*Math.PI/280)+.012*Math.sin(s*2*Math.PI/620);
export function custardPoint(s:number,u=0,lift=0):Point {
  const [x,,z]=custardTangent(s);
  return [custardX(s)-z*u,custardHeight(s)+custardBank(s)*u+lift,-s+x*u].map(round) as Point;
}
export const custardYaw = (s:number) => -Math.atan2(derivative(s),1)*180/Math.PI;
export function custardProgress(p:Point|{x:number;z:number}):number {
  const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z;
  let s=-z;
  for(let i=0;i<5;i++) {
    const d=derivative(s),dd=(derivative(s+.05)-derivative(s-.05))/.1;
    s-=Math.max(-5,Math.min(5,((custardX(s)-x)*d+s+z)/Math.max(.3,1+d*d+(custardX(s)-x)*dd)));
  }
  return s;
}
export const CUSTARD_CREEK_REACHES = [
  {name:'Custard Headwaters',a:-16,b:280}, {name:'Willow Weave',a:280,b:560},
  {name:'Golden Meanders',a:560,b:840}, {name:'Low Creek',a:840,b:1120},
  {name:'Sunlit Rise',a:1120,b:1400}, {name:'Orchard Roll',a:1400,b:1680},
  {name:'Creekside Switches',a:1680,b:1960}, {name:'The Home Carve',a:1960,b:2260},
].map((r,i)=>({...r,grp:20+i}));
for(const r of CUSTARD_CREEK_REACHES) groups.push({id:r.grp,nm:r.name,editorOnly:true});
const reach=(s:number)=>CUSTARD_CREEK_REACHES.find(r=>s>=r.a&&s<r.b)??CUSTARD_CREEK_REACHES[7];
const add=(c:CustomComponent)=>C.push(c);
const width=(s:number)=>13+2*smooth((s-2170)/55)+2*Math.exp(-(((s-1045)/65)**2));
export const CUSTARD_CREEK_GAPS = [
  {a:430,b:435,name:'Willow brook hop'}, {a:1124,b:1130,name:'Sunlit creek hop'},
  {a:1714,b:1720,name:'Orchard creek hop'},
];

// One-metre samples, shared seam vertices and no collider plank seams. Four
// cross-road cells include the centreline, so banked box support is exact.
function strip(a:number,b:number,us:number[],height:(s:number,u:number,j:number)=>number,
    color:string,tex:string,name:string,solid=true) {
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  const rows=Math.ceil(b-a),origin=custardPoint(a);
  for(let i=0;i<=rows;i++) {
    const s=a+(b-a)*i/rows;
    for(const [j,ratio] of us.entries()) {
      const u=ratio*width(s)/2,p=custardPoint(s,u);
      vertices.push(round(p[0]-origin[0]),round(height(s,u,j)-origin[1]),round(p[2]-origin[2]));
      uvs.push(u/4,s/4);
    }
    if(i) for(let j=0;j<us.length-1;j++) {
      const q=(i-1)*us.length+j,n=q+us.length;
      indices.push(q,q+1,n,n,q+1,n+1);
    }
  }
  add({t:'mesh',p:origin,vertices,indices,uvs,color,tex,solid,edgeGrinding:false,...(!solid?{doubleSided:true}:{}),
    grp:reach((a+b)/2).grp,nm:name});
}
const cuts=[-16,280,430,435,560,840,1120,1124,1130,1400,1680,1714,1720,1960,2260];
for(let i=1;i<cuts.length;i++) {
  const a=cuts[i-1],b=cuts[i];
  if(CUSTARD_CREEK_GAPS.some(g=>a>=g.a&&b<=g.b))continue;
  strip(a,b,[-1,-.5,0,.5,1],(s,u)=>custardHeight(s)+custardBank(s)*u,
    '#e2c484','sand',`${reach(a).name} · smooth banked road`);
  // A low grass verge leaves room to recover a wide carve before the bank.
  for(const side of [-1,1]) {
    strip(a,b,[side,side*1.45,side*2.1].sort((x,y)=>x-y),(s,u)=>custardHeight(s)+custardBank(s)*u-.12-Math.max(0,Math.abs(u)-width(s)/2)*.16,
      side<0?'#7eaa66':'#91b86b','grass',`${reach(a).name} · forgiving grass verge`);
    strip(a,b,[side*2.1,side*2.1],(s,u,j)=>j?custardHeight(s)-6:custardHeight(s)+custardBank(s)*u-.12-(Math.abs(u)-width(s)/2)*.16,
      '#b59b71','stone',`${reach(a).name} · creek bank`,false);
  }
}

// Visible blue-green creek below the right bank. It follows every meander;
// it never overlays the road or disguises a supported surface as a death pit.
for(let a=-16;a<2260;a+=200) {
  const b=Math.min(2260,a+200);
  strip(a,b,[2.15,3.05],s=>custardHeight(s)-4,'#68a8a1','solid','Custard Creek water ribbon',false);
}
for(const gap of CUSTARD_CREEK_GAPS) {
  const a=gap.a-16,b=gap.b+16,p=custardPoint(a,3.9),pts:NonNullable<CustomComponent['pts']>=[];
  for(let s=a;s<=b;s+=1) {
    const q=custardPoint(s,3.9);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1],-Math.atan(custardBank(s))*180/Math.PI]);
  }
  add({t:'woodpath',p,pts,w:3.4,curve:'corner',scaffold:true,supports:true,rails:false,
    supportDepth:4.5,terrainSupports:false,spacing:1.2,baySpacing:8,s:[1,.32,1],
    color:'#c5a36f',tex:'wood',edgeGrinding:false,grp:reach(a).grp,
    nm:`${gap.name} · continuous outer boardwalk`});
}

export const CUSTARD_CREEK_BOX_LINES = [
  [24,120],[170,266],[302,386],[468,564],[620,716],[770,866],[920,1016],
  [1050,1098],[1174,1258],[1286,1366],[1410,1494],[1540,1624],[1644,1692],
  [1760,1856],[1898,1982],[2020,2104],[2144,2216],
].map(([a,b],i)=>({a,b,name:`${reach(a).name} · carving string ${i+1}`,grp:100+i,
  boxes:[] as {s:number;u:number;component:CustomComponent}[]}));
// Normal breakable crates only on the rolling line. Its lateral drift is
// slower than the road turns; strings remain readable at coast cruising speed.
export const custardBoxOffset=(s:number)=>2*Math.sin(s*2*Math.PI/180);
for(const [i,line] of CUSTARD_CREEK_BOX_LINES.entries()) {
  groups.push({id:line.grp,nm:line.name,editorOnly:true});
  const count=Math.floor((line.b-line.a)/9)+1;
  for(let j=0;j<count;j++) {
    const s=line.a+(line.b-line.a)*j/Math.max(1,count-1),u=custardBoxOffset(s);
    const kind:CustomComponent['kind']=j===count-1&&i%4===1?'mask':j===count-1&&i%4===3?'life':'wood';
    const component:CustomComponent={t:'crate',p:custardPoint(s,u),kind,grp:line.grp,nm:`${line.name} · box ${j+1}`};
    line.boxes.push({s,u,component});add(component);
  }
}
// A few deliberate side rewards, reached without blocking the main string.
for(const s of [204,676,1000,1312,1596,1918,2172]) {
  const u=-4.8;
  add({t:'crate',p:custardPoint(s,u),kind:'wood',grp:reach(s).grp,nm:'Creekside reward stack · base'});
  add({t:'crate',p:custardPoint(s,u,.96),kind:'mystery',grp:reach(s).grp,nm:'Creekside reward stack · prize'});
}

export const CUSTARD_CREEK_CHECKPOINTS = [154,294,458,606,752,906,1034,1160,1272,1394,1524,1634,1748,1880,2006,2128]
  .map((s,i)=>({s,p:custardPoint(s,0),name:`${reach(s).name} · checkpoint ${i+1}`}));
for(const cp of CUSTARD_CREEK_CHECKPOINTS)add({t:'checkpoint',p:cp.p,grp:reach(cp.s).grp,nm:cp.name});
for(let s=-16;s<=2260;s+=8)add({t:'camnode',p:custardPoint(s,0,.8),radius:0,nm:'Ordered creek camera spine'});
// Extend the last camera node and support beyond the finish plane.
add({t:'camnode',p:custardPoint(2260,0,.8),nm:'Creek camera end'});
for(let s=18;s<2230;s+=24)add({t:'wumpa',p:custardPoint(s,custardBoxOffset(s),1.25),grp:reach(s).grp,nm:'Carving trail fruit'});
add({t:'crystal',p:custardPoint(1360,0,1.35),grp:reach(1360).grp,nm:'Sunlit rise crystal'});
add({t:'clock',p:custardPoint(9,-3.8),nm:'Creek time trial'});


export const CUSTARD_CREEK_RAILS = [
  {a:340,b:406,u:-4.6},{a:646,b:728,u:4.6},{a:942,b:1024,u:-4.6},
  {a:1196,b:1264,u:4.6},{a:1550,b:1624,u:-4.6},{a:2036,b:2112,u:4.6},
];
for(const r of CUSTARD_CREEK_RAILS) {
  const p=custardPoint(r.a,r.u,.65),pts:NonNullable<CustomComponent['pts']>=[];
  const steps=Math.ceil((r.b-r.a)/4);
  for(let i=0;i<=steps;i++) {
    const q=custardPoint(r.a+(r.b-r.a)*i/steps,r.u,.65);
    pts.push([q[0]-p[0],q[2]-p[2],2,q[1]-p[1]]);
  }
  add({t:'rail',p,pts,color:'#c8a675',grp:reach(r.a).grp,nm:'Meander rail · optional flowing grind'});
}

// Reuse the coast's scenery vocabulary. All solids remain off the recovery
// verge; gaps in the trees let the player read the next opposing curve.
for(let s=30,i=0;s<2230;s+=28,i++) for(const side of [-1,1]) {
  const u=side*(16+(i%3)*2.5),p=custardPoint(s,u,-2.5);
  add({t:'decor',dkind:i%4===0?'palm':'pine',p,w:1.5+(i%3)*.2,rise:6.5+(i%4),yaw:i*47,
    grp:reach(s).grp,nm:'Creek bank trees'});
  if(i%3===0)add({t:'decor',dkind:'flowers',p:custardPoint(s+6,side*10,-.65),w:1.4,rise:1.1,grp:reach(s).grp,nm:'Custard wildflowers'});
  if(i%4===0)add({t:'rock',p:custardPoint(s+8,side*12,-1.7),s:[2.8,2.8,3.6],color:'#c7b68b',seed:i+14,grp:reach(s).grp,nm:'Creek bank boulder'});
}
add({t:'gate',p:custardPoint(CUSTARD_CREEK_END),yaw:custardYaw(CUSTARD_CREEK_END),nm:'Custard Creek finish'});

export const CUSTARD_CREEK_LEVEL:CustomLevelData={
  v:1,name:'Custard Creek',spawn:custardPoint(0,0,.12),killY:-48,sky:'coast',
  medalTimes:{gold:180,silver:210,bronze:255},groups,components:C,
};
