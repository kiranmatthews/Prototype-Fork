import * as THREE from 'three';

// This is a racecourse: author every approach, obstacle and recovery for the
// existing full-speed movement model. Numbered golf holes are flowing sections,
// never stop-and-putt rooms. Keep a broad racing line and boost-fed alternatives.

export type Point=[number,number,number];
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const COUNTRY_CLUB_PREVIOUS_LENGTH=1532.4105133216735;
export const COUNTRY_CLUB_SAND_SPEED=2.4;
export const countryClubLandHeight=(x:number,z:number)=>8+7*Math.sin(-z/180)+3.4*Math.sin(-z/63)+2.2*Math.sin(x/80+z/230);
const knots=[
  [0,50,24],[0,0,24],[-45,-90,23],[-115,-155,22],[-125,-225,18],[-80,-300,22],
  [25,-380,25],[120,-440,22],[140,-515,16],[70,-590,22],[-35,-680,25],[-120,-755,22],
  [-130,-835,17],[-50,-925,24],[60,-1005,25],[130,-1075,22],[100,-1160,16],[0,-1240,24],
  [-125,-1325,25],[-145,-1410,20],[-50,-1500,24],[70,-1570,25],[145,-1665,22],
  [105,-1750,20],[0,-1840,26],[0,-1900,30],
];
const curve=new THREE.CatmullRomCurve3(knots.map(k=>new THREE.Vector3(k[0],0,k[1])),false,'centripetal');
const raw=curve.getPoints(3600),measure=(scale:number)=>raw.reduce((sum,p,i)=>{
  if(!i)return sum;const a=raw[i-1];return sum+Math.hypot((p.x-a.x)*scale,(p.z-a.z)*scale,
    countryClubLandHeight(p.x*scale,p.z*scale)-countryClubLandHeight(a.x*scale,a.z*scale));
},0);
let scale=1;
for(let i=0;i<5;i++)scale*=COUNTRY_CLUB_PREVIOUS_LENGTH*2/measure(scale);
let length=0;
export const COUNTRY_CLUB_ROUTE=raw.map((p,i)=>{
  const point:Point=[p.x*scale,countryClubLandHeight(p.x*scale,p.z*scale),p.z*scale];
  if(i){const a=raw[i-1];length+=Math.hypot(point[0]-a.x*scale,point[2]-a.z*scale,point[1]-countryClubLandHeight(a.x*scale,a.z*scale));}
  const k=i/(raw.length-1)*(knots.length-1),a=Math.floor(k),b=Math.min(knots.length-1,a+1);
  return {s:length,p:point,width:THREE.MathUtils.lerp(knots[a][2],knots[b][2],k-a)};
});
// Stationing stays fixed so cached checkpoints and tools have a stable reference.
export const COUNTRY_CLUB_LENGTH=length;
function row(s:number){
  s=clamp(s,0,length);let a=0,b=COUNTRY_CLUB_ROUTE.length-1;
  while(b-a>1){const m=(a+b)>>1;if(COUNTRY_CLUB_ROUTE[m].s<s)a=m;else b=m;}
  const lo=COUNTRY_CLUB_ROUTE[a],hi=COUNTRY_CLUB_ROUTE[b],t=(s-lo.s)/(hi.s-lo.s||1);
  return {p:lo.p.map((v,i)=>v+(hi.p[i]-v)*t) as Point,width:lo.width+(hi.width-lo.width)*t};
}
export function countryClubFrame(s:number){
  const p=row(s).p,a=row(s-.5).p,b=row(s+.5).p,n=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  const f:Point=[(b[0]-a[0])/n,0,(b[2]-a[2])/n],r:Point=[-f[2],0,f[0]];
  return {p,f,r,yaw:-Math.atan2(f[0],-f[2])*180/Math.PI};
}
function basePoint(s:number,u=0):Point{const {p,r}=countryClubFrame(s);const x=p[0]+r[0]*u,z=p[2]+r[2]*u;return [x,countryClubLandHeight(x,z)+.08,z];}

export const COUNTRY_CLUB_HOLES=[
  {n:1,name:'Arrival sweep',a:0,b:160,shape:'oval',side:1,greenLength:24,greenWidth:36},
  {n:2,name:'Bunker S',a:160,b:330,shape:'kidney',side:-1,greenLength:28,greenWidth:38},
  {n:3,name:'Creek launch',a:330,b:510,shape:'fan',side:1,greenLength:25,greenWidth:44},
  {n:4,name:'Gatehouse',a:510,b:680,shape:'diamond',side:-1,greenLength:20,greenWidth:36},
  {n:5,name:'Horseshoe',a:680,b:870,shape:'crescent',side:1,greenLength:31,greenWidth:40},
  {n:6,name:'Reed rail',a:870,b:1040,shape:'island',side:-1,greenLength:21,greenWidth:42},
  {n:7,name:'Orchard weave',a:1040,b:1210,shape:'pear',side:1,greenLength:27,greenWidth:36},
  {n:8,name:'Uphill drive',a:1210,b:1375,shape:'terrace',side:-1,greenLength:23,greenWidth:42},
  {n:9,name:'Low rollers',a:1375,b:1545,shape:'ribbon',side:1,greenLength:33,greenWidth:34},
  {n:10,name:'Twin islands',a:1545,b:1730,shape:'double',side:-1,greenLength:29,greenWidth:46},
  {n:11,name:'High bank',a:1730,b:1900,shape:'comma',side:1,greenLength:26,greenWidth:40},
  {n:12,name:'Switchback',a:1900,b:2065,shape:'hourglass',side:-1,greenLength:27,greenWidth:38},
  {n:13,name:'Split green',a:2065,b:2240,shape:'split',side:1,greenLength:30,greenWidth:46},
  {n:14,name:'Crescent lake',a:2240,b:2410,shape:'crescent',side:-1,greenLength:32,greenWidth:42},
  {n:15,name:'Ridge grind',a:2410,b:2580,shape:'spindle',side:1,greenLength:32,greenWidth:34},
  {n:16,name:'Cart yard',a:2580,b:2750,shape:'square',side:-1,greenLength:22,greenWidth:42},
  {n:17,name:'Long carry',a:2750,b:2910,shape:'fan',side:1,greenLength:23,greenWidth:46},
  {n:18,name:'Home stretch',a:2910,b:length,shape:'crown',side:-1,greenLength:34,greenWidth:48},
].map(h=>({...h,green:h.b-32,tee:h.a+(h.n===1?42:18)}));
export const COUNTRY_CLUB_SECTIONS=COUNTRY_CLUB_HOLES.map(h=>({name:`${String(h.n).padStart(2,'0')} ${h.name}`,s:h.a}));
export const COUNTRY_CLUB_CHECKPOINTS=COUNTRY_CLUB_HOLES.map(h=>h.tee);
export const COUNTRY_CLUB_GREENS=COUNTRY_CLUB_HOLES.map(h=>h.green);
export const COUNTRY_CLUB_GAPS=[
  {hole:3,name:'Creek launch',a:424,b:436},
  {hole:6,name:'Reed carry',a:940,b:951},
  {hole:10,name:'Twin islands / first',a:1610,b:1621},
  {hole:10,name:'Twin islands / second',a:1655,b:1666},
  {hole:14,name:'Crescent carry',a:2330,b:2342},
  {hole:17,name:'Long carry',a:2838,b:2852},
];
export const COUNTRY_CLUB_PONDS=[
  {hole:3,s:430,rx:31,rz:27}, {hole:6,s:946,rx:38,rz:30},
  {hole:10,s:1638,rx:33,rz:53}, {hole:14,s:2336,rx:43,rz:35},
  {hole:17,s:2845,rx:36,rz:34},
].map(p=>{const q=basePoint(p.s),frame=countryClubFrame(p.s);return {...p,x:q[0],z:q[2],y:q[1]-1.65,f:frame.f,r:frame.r};});
export const COUNTRY_CLUB_PADS=[
  {s:64,speed:30},{s:390,speed:32},{s:908,speed:32},{s:1258,speed:31},
  {s:1578,speed:32},{s:1636,speed:32},{s:2298,speed:32},{s:2806,speed:34},{s:2958,speed:32},
];
export const COUNTRY_CLUB_ENCOUNTERS=[
  {s:590,u:7,foe:'grunt'},{s:620,u:-7,foe:'turtle'},
  {s:765,u:6,foe:'hopper'},{s:1130,u:-7,foe:'grunt'},
  {s:1170,u:7,foe:'turtle'},{s:1480,u:7,foe:'hopper'},
  {s:1975,u:7,foe:'grunt'},{s:2010,u:-7,foe:'turtle'},
  {s:2640,u:7,foe:'grunt'},{s:2680,u:-7,foe:'hopper'},
  {s:2990,u:7,foe:'grunt'},{s:2990,u:-7,foe:'turtle'},
] as const;
// Wide arcs change the racing line over 45–70 m; no stop-and-turn slalom.
export const COUNTRY_CLUB_SLALOM=[
  {s:225,side:-1},{s:285,side:1},{s:730,side:-1},{s:1110,side:1},
  {s:1800,side:-1},{s:1950,side:1},{s:2180,side:1},{s:2490,side:-1},
];
export const countryClubRacingOffset=(s:number)=>COUNTRY_CLUB_SLALOM.reduce((u,o)=>u-o.side*4.8*Math.exp(-(((s-o.s)/29)**4)),0);
export function countryClubWidth(s:number){
  let w=Math.max(24,row(s).width);
  for(const h of COUNTRY_CLUB_HOLES){const t=(s-h.green)/h.greenLength;w+=(h.greenWidth-24)*Math.exp(-(t*t)*1.35);}
  return w;
}
export function countryClubBunkerAt(s:number,u:number){
  return COUNTRY_CLUB_SLALOM.some((o,i)=>{
    const longitudinal=(s-o.s)/(16+(i%3)*3),lateral=(u-o.side*(countryClubWidth(s)*.42+1.8*Math.sin(longitudinal*1.5)))/10;
    return longitudinal*longitudinal+lateral*lateral<1;
  });
}
// Every mechanical pad and patrol is on a genuinely flat piece of ground.
const flatSpots=[...COUNTRY_CLUB_PADS.map(p=>({s:p.s,inner:5,outer:20})),
  ...COUNTRY_CLUB_ENCOUNTERS.map(e=>({s:e.s,inner:10,outer:24})),
  {s:558,inner:8,outer:20},{s:1320,inner:8,outer:20},{s:2120,inner:10,outer:25},
  {s:2605,inner:11,outer:25},{s:2705,inner:10,outer:24}];
function waterGrade(s:number){
  let y=basePoint(s)[1];
  for(const p of COUNTRY_CLUB_PONDS)y=THREE.MathUtils.lerp(y,p.y+1.65,1-smooth((Math.abs(s-p.s)-p.rz-12)/35));
  return y;
}
const flatTargets=flatSpots.map(f=>({...f,y:waterGrade(f.s)}));
export function countryClubDeckHeight(s:number,u=0){
  const p=basePoint(s,u);let y=waterGrade(s)+(p[1]-basePoint(s)[1])*.25;
  // Broad crests and a banked outside bend are traversable while holding speed.
  y+=1.3*Math.exp(-(((s-1290)/28)**2));
  y+=.65*Math.exp(-(((s-1420)/13)**2))+.65*Math.exp(-(((s-1450)/13)**2));
  y+=Math.max(0,-u-3)*.11*Math.exp(-(((s-1810)/38)**2));
  for(const f of flatTargets){const d=Math.abs(s-f.s);if(d>=f.outer)continue;const t=1-smooth((d-f.inner)/(f.outer-f.inner));y=THREE.MathUtils.lerp(y,f.y,t);}
  for(const g of COUNTRY_CLUB_GAPS){if(s>=g.a-18&&s<=g.a)y+=.7*smooth((s-(g.a-18))/18);if(s>=g.b&&s<g.b+16)y+=.15*(1-smooth((s-g.b)/16));}
  return y;
}
export function countryClubPoint(s:number,u=0,lift=0):Point{const p=basePoint(s,u);p[1]=countryClubDeckHeight(s,u)+lift;return p;}
export function countryClubProgress(p:{x:number;y:number;z:number},previous=0){
  let best=Infinity,s=previous;
  for(const q of COUNTRY_CLUB_ROUTE){if(q.s<previous-20||q.s>previous+85)continue;const d=(q.p[0]-p.x)**2+(q.p[2]-p.z)**2;if(d<best){best=d;s=q.s;}}
  return s;
}
const nav=COUNTRY_CLUB_ROUTE.filter((_,i)=>i%8===0);
export function countryClubNearestRoad(x:number,z:number){
  let best=Infinity,s=0,u=0;
  for(let i=1;i<nav.length;i++){
    const a=nav[i-1],b=nav[i],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2],n=Math.hypot(dx,dz);
    const t=clamp(((x-a.p[0])*dx+(z-a.p[2])*dz)/(n*n),0,1),px=x-a.p[0]-t*dx,pz=z-a.p[2]-t*dz,d=Math.hypot(px,pz);
    if(d<best){best=d;s=a.s+(b.s-a.s)*t;u=(-dz*px+dx*pz)/n;}
  }
  return {distance:best,s,u};
}
export function countryClubGroundHeight(x:number,z:number){
  const near=countryClubNearestRoad(x,z),w=countryClubWidth(near.s)/2;
  let y=THREE.MathUtils.lerp(countryClubLandHeight(x,z),countryClubDeckHeight(near.s,near.u)-.55,1-smooth((near.distance-w-1)/22));
  for(const p of COUNTRY_CLUB_PONDS){
    const dx=x-p.x,dz=z-p.z,r=Math.hypot((dx*p.r[0]+dz*p.r[2])/p.rx,(dx*p.f[0]+dz*p.f[2])/p.rz);
    const bank=Math.max(y,p.y+.55);
    if(r<1.16)y=THREE.MathUtils.lerp(p.y-3.2,bank,smooth((r-.65)/.51));
    else if(r<1.5)y=THREE.MathUtils.lerp(y,bank,1-smooth((r-1.16)/.34));
  }
  return y;
}
export const COUNTRY_CLUB_WATER_RAILS=COUNTRY_CLUB_PONDS.map((p,i)=>{
  const carries=COUNTRY_CLUB_GAPS.filter(g=>g.hole===p.hole);
  return {hole:p.hole,start:carries[0].a-27,end:carries[carries.length-1].b+28,side:i%2?-1:1,offset:11+(i%2)*2};
});
export const COUNTRY_CLUB_RIDGE={start:2444,end:2538};
export function countryClubRailPoint(r:{start:number;end:number;side:number;offset:number},s:number):Point{
  const t=clamp((s-r.start)/(r.end-r.start),0,1),blend=Math.sin(Math.PI*t)**2;
  return countryClubPoint(s,r.side*r.offset*blend,.16+.6*blend);
}
const endPoint=basePoint(length);
export const COUNTRY_CLUB_BOUNDS={minX:Math.floor((-145*scale-90)/6)*6,maxX:Math.ceil((145*scale+90)/6)*6,minZ:Math.floor((endPoint[2]-90)/6)*6,maxZ:Math.ceil((50*scale+70)/6)*6};
export const COUNTRY_CLUB_TRAVEL_LENGTH=Array.from({length:Math.ceil(length)},(_,i)=>{const a=countryClubPoint(i),b=countryClubPoint(Math.min(length,i+1));return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}).reduce((a,b)=>a+b,0);
