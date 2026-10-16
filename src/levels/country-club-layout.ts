import * as THREE from 'three';

// This is a racecourse: author every approach, obstacle and recovery for the
// existing full-speed movement model. The golf layout is independent of the race.
// Keep the sharp corners wide enough to carry speed and the water lines boost-fed.

export type Point=[number,number,number];
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const COUNTRY_CLUB_PREVIOUS_LENGTH=1532.4105133216735;
export const COUNTRY_CLUB_SAND_SPEED=2.4;
export { countryClubLandHeight,COUNTRY_CLUB_HOLES,COUNTRY_CLUB_GOLF_BUNKERS,countryClubGreenDistance,countryClubGreenRadius,countryClubGolfBunkerDistance,countryClubGolfField } from './country-club-estate';
import { countryClubLandHeight,COUNTRY_CLUB_HOLES,countryClubGolfGround,estatePoint } from './country-club-estate';
// A filleted cart-path route: the small radii are deliberate racing corners.
const knots=[
  [-100,80,40],[60,30,70],[245,-60,65],[320,-150,50],[320,-265,20],
  [155,-265,45],[70,-350,50],[20,-430,35],[-130,-430,22],[-130,-200,24],
  [-250,-200,30],[-330,-315,55],[-330,-495,40],[-215,-565,55],[-80,-520,55],
  [95,-530,60],[260,-540,50],[370,-600,24],[370,-690,22],[225,-700,55],
  [70,-725,45],[-50,-825,45],[-180,-850,40],[-320,-835,24],[-350,-975,40],
  [-260,-1090,45],[-100,-1150,50],[70,-1140,45],[210,-1060,45],[290,-945,45],
  [320,-820,22],[405,-820,20],[420,-980,45],[350,-1140,45],[220,-1210,45],[55,-1240,40],
].map(k=>{const p=estatePoint(k[0],k[1]);return {x:p[0],z:p[1],radius:k[2]};});
const raw:THREE.Vector3[]=[new THREE.Vector3(knots[0].x,0,knots[0].z)];
export const COUNTRY_CLUB_CORNERS:{index:number;entry:number;exit:number;angle:number;radius:number}[]=[];
const lineTo=(x:number,z:number)=>{const a=raw[raw.length-1],n=Math.max(1,Math.ceil(Math.hypot(x-a.x,z-a.z)/.8));for(let i=1;i<=n;i++)raw.push(new THREE.Vector3(a.x+(x-a.x)*i/n,0,a.z+(z-a.z)*i/n));};
for(let i=1;i<knots.length-1;i++){
  const a=knots[i-1],p=knots[i],b=knots[i+1],la=Math.hypot(p.x-a.x,p.z-a.z),lb=Math.hypot(b.x-p.x,b.z-p.z);
  const ux=(p.x-a.x)/la,uz=(p.z-a.z)/la,vx=(b.x-p.x)/lb,vz=(b.z-p.z)/lb;
  const angle=Math.acos(clamp(ux*vx+uz*vz,-1,1)),sign=Math.sign(ux*vz-uz*vx)||1;
  if(angle<.015){lineTo(p.x,p.z);continue;}
  const trim=Math.min(p.radius*Math.tan(angle/2),la*.4,lb*.4),radius=trim/Math.tan(angle/2);
  const ex=p.x-ux*trim,ez=p.z-uz*trim,cx=ex-uz*sign*radius,cz=ez+ux*sign*radius,start=Math.atan2(ez-cz,ex-cx);
  lineTo(ex,ez);const entry=raw.length-1,n=Math.max(4,Math.ceil(radius*angle/.8));
  for(let j=1;j<=n;j++){const t=start+sign*angle*j/n;raw.push(new THREE.Vector3(cx+Math.cos(t)*radius,0,cz+Math.sin(t)*radius));}
  if(angle>Math.PI*.4&&radius<30)COUNTRY_CLUB_CORNERS.push({index:i,entry,exit:raw.length-1,angle:angle*180/Math.PI,radius});
}
lineTo(knots[knots.length-1].x,knots[knots.length-1].z);
let length=0;
export const COUNTRY_CLUB_ROUTE=raw.map((p,i)=>{
  const point:Point=[p.x,countryClubLandHeight(p.x,p.z),p.z];
  if(i){const a=raw[i-1];length+=Math.hypot(point[0]-a.x,point[2]-a.z,point[1]-countryClubLandHeight(a.x,a.z));}
  return {s:length,p:point,width:18};
});
for(const c of COUNTRY_CLUB_CORNERS){c.entry=COUNTRY_CLUB_ROUTE[c.entry].s;c.exit=COUNTRY_CLUB_ROUTE[c.exit].s;}
// All mechanics use arc-length stations on the authored racing route.
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
function basePoint(s:number,u=0):Point{const {p,r}=countryClubFrame(s);const x=p[0]+r[0]*u,z=p[2]+r[2]*u;return [x,countryClubGolfGround(x,z)+.08,z];}

const routeScale=length/3064.8210266433434;
export const raceStation=(old:number)=>old*routeScale;
export const COUNTRY_CLUB_SECTIONS=Array.from({length:18},(_,i)=>({name:['Clubhouse drive','East fairways','Pond approach','East elbow','Orchard crossing','Central hairpin','West cart path','Bunker crossing','Mid-course meadows','Twin carry','South dogleg','Willow approach','Back-nine bend','Lake crossing','Southern ridge','Eastern hairpin','Final carry','Finish approach'][i],s:length*i/18}));
export const COUNTRY_CLUB_CHECKPOINTS=COUNTRY_CLUB_SECTIONS.map((h,i)=>h.s+(i?18:42));
export const COUNTRY_CLUB_GREENS=COUNTRY_CLUB_HOLES.map(h=>h.cup);
// Stable crossing IDs belong to the racing tools, not the independent golf holes.
export const COUNTRY_CLUB_GAPS=[
  {hole:3,name:'Creek launch',a:raceStation(424),b:raceStation(424)+12},
  {hole:6,name:'Reed carry',a:raceStation(940),b:raceStation(940)+11},
  {hole:10,name:'Twin islands / first',a:raceStation(1610),b:raceStation(1610)+11},
  {hole:10,name:'Twin islands / second',a:raceStation(1610)+45,b:raceStation(1610)+56},
  {hole:14,name:'Crescent carry',a:raceStation(2330),b:raceStation(2330)+12},
  {hole:17,name:'Long carry',a:raceStation(2838),b:raceStation(2838)+14},
];
export const COUNTRY_CLUB_PONDS=[3,6,10,14,17].map((hole,i)=>{
  const gs=COUNTRY_CLUB_GAPS.filter(g=>g.hole===hole),s=(gs[0].a+gs[gs.length-1].b)/2,q=basePoint(s),frame=countryClubFrame(s);
  return {hole,s,rx:[31,38,33,43,36][i],rz:hole===10?53:30,x:q[0],z:q[2],y:q[1]-1.65,f:frame.f,r:frame.r};
});
export const COUNTRY_CLUB_PADS=[{s:64,speed:30},...COUNTRY_CLUB_GAPS.map((g,i)=>({s:g.a-(i>0&&g.a-COUNTRY_CLUB_GAPS[i-1].b<50?19:34),speed:g.hole===17?34:32})),{s:raceStation(1258),speed:31},{s:length-100,speed:32}];
export const COUNTRY_CLUB_ENCOUNTERS=[
  {s:590,u:7,foe:'grunt'},{s:620,u:-7,foe:'turtle'},
  {s:765,u:6,foe:'hopper'},{s:1130,u:-7,foe:'grunt'},
  {s:1170,u:7,foe:'turtle'},{s:1480,u:7,foe:'hopper'},
  {s:1975,u:7,foe:'grunt'},{s:2010,u:-7,foe:'turtle'},
  {s:2640,u:7,foe:'grunt'},{s:2680,u:-7,foe:'hopper'},
  {s:2990,u:7,foe:'grunt'},{s:2990,u:-7,foe:'turtle'},
].map(e=>({...e,s:raceStation(e.s)})) as {s:number;u:number;foe:'grunt'|'turtle'|'hopper'}[];
// Wide arcs change the racing line over 45–70 m; no stop-and-turn slalom.
export const COUNTRY_CLUB_SLALOM=[
  {s:225,side:-1},{s:285,side:1},{s:730,side:-1},{s:1110,side:1},
  {s:1800,side:-1},{s:1950,side:1},{s:2180,side:1},{s:2490,side:-1},
].map(o=>({...o,s:raceStation(o.s)}));
export const countryClubRacingOffset=(s:number)=>COUNTRY_CLUB_SLALOM.reduce((u,o)=>u-o.side*4.8*Math.exp(-(((s-o.s)/29)**4)),0);
export function countryClubWidth(s:number){
  let w=18;for(const c of COUNTRY_CLUB_CORNERS){const d=Math.max(0,c.entry-s,s-c.exit);w+=8*Math.exp(-((d/25)**2));}return Math.min(28,w);
}
export function countryClubBunkerAt(s:number,u:number){
  return COUNTRY_CLUB_SLALOM.some((o,i)=>{
    const longitudinal=(s-o.s)/(16+(i%3)*3),lateral=(u-o.side*(countryClubWidth(s)*.5+2+Math.sin(longitudinal*1.5)))/8;
    return longitudinal*longitudinal+lateral*lateral<1;
  });
}
// Every mechanical pad and patrol is on a genuinely flat piece of ground.
const flatSpots=[...COUNTRY_CLUB_PADS.map(p=>({s:p.s,inner:5,outer:20})),
  ...COUNTRY_CLUB_ENCOUNTERS.map(e=>({s:e.s,inner:10,outer:24}))];
function waterGrade(s:number){
  let y=basePoint(s)[1];
  for(const p of COUNTRY_CLUB_PONDS)y=THREE.MathUtils.lerp(y,p.y+1.65,1-smooth((Math.abs(s-p.s)-p.rz-12)/35));
  return y;
}
const flatTargets=flatSpots.map(f=>({...f,y:waterGrade(f.s)}));
export function countryClubDeckHeight(s:number,u=0){
  const p=basePoint(s,u);let y=waterGrade(s)+(p[1]-basePoint(s)[1])*.25;

  for(const g of COUNTRY_CLUB_GAPS){if(s>=g.a-18&&s<=g.a)y+=.7*smooth((s-(g.a-18))/18);if(s>=g.b&&s<g.b+16)y+=.15*(1-smooth((s-g.b)/16));}
  for(const f of flatTargets){const d=Math.abs(s-f.s);if(d>=f.outer)continue;const t=1-smooth((d-f.inner)/(f.outer-f.inner));y=THREE.MathUtils.lerp(y,f.y,t);}
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
function sculptedGroundHeight(x:number,z:number){
  const near=countryClubNearestRoad(x,z),w=countryClubWidth(near.s)/2;
  let y=THREE.MathUtils.lerp(countryClubGolfGround(x,z),countryClubDeckHeight(near.s,near.u)-.55,1-smooth((near.distance-w-1)/22));
  for(const p of COUNTRY_CLUB_PONDS){
    const dx=x-p.x,dz=z-p.z,r=Math.hypot((dx*p.r[0]+dz*p.r[2])/p.rx,(dx*p.f[0]+dz*p.f[2])/p.rz);
    const bank=Math.max(y,p.y+.55);
    if(r<1.16)y=THREE.MathUtils.lerp(p.y-3.2,bank,smooth((r-.65)/.51));
    else if(r<1.5)y=THREE.MathUtils.lerp(y,bank,1-smooth((r-1.16)/.34));
  }
  return y;
}
const groundGridCache=new Map<string,number>();
const gridHeight=(x:number,z:number)=>{const key=`${x.toFixed(6)}:${z.toFixed(6)}`;if(!groundGridCache.has(key))groundGridCache.set(key,sculptedGroundHeight(x,z));return groundGridCache.get(key)!;};
// All golf painting, flags, props, water and collision share these same triangles.
export function countryClubGroundHeight(x:number,z:number){
  const b=COUNTRY_CLUB_BOUNDS,tile=96,step=8;
  if(x<b.minX||x>=b.maxX||z<b.minZ||z>=b.maxZ)return sculptedGroundHeight(x,z);
  const bx=b.minX+Math.floor((x-b.minX)/tile)*tile,bz=b.minZ+Math.floor((z-b.minZ)/tile)*tile,wx=Math.min(tile,b.maxX-bx),wz=Math.min(tile,b.maxZ-bz),dx=wx/Math.ceil(wx/step),dz=wz/Math.ceil(wz/step);
  const ix=Math.floor((x-bx)/dx),iz=Math.floor((z-bz)/dz),x0=bx+ix*dx,z0=bz+iz*dz,u=(x-x0)/dx,v=(z-z0)/dz;
  const a=gridHeight(x0,z0),bb=gridHeight(x0+dx,z0),c=gridHeight(x0,z0+dz),d=gridHeight(x0+dx,z0+dz);
  return u+v<=1?a*(1-u-v)+bb*u+c*v:bb*(1-v)+c*(1-u)+d*(u+v-1);
}
export const COUNTRY_CLUB_WATER_RAILS=COUNTRY_CLUB_PONDS.map((p,i)=>{
  const carries=COUNTRY_CLUB_GAPS.filter(g=>g.hole===p.hole);
  return {hole:p.hole,start:carries[0].a-27,end:carries[carries.length-1].b+28,side:i%2?-1:1,offset:11+(i%2)*2};
});
export const COUNTRY_CLUB_RIDGE={start:raceStation(2444),end:raceStation(2538)};
export function countryClubRailPoint(r:{start:number;end:number;side:number;offset:number},s:number):Point{
  const t=clamp((s-r.start)/(r.end-r.start),0,1),blend=Math.sin(Math.PI*t)**2;
  return countryClubPoint(s,r.side*r.offset*blend,.16+.6*blend);
}
export const COUNTRY_CLUB_BOUNDS={minX:-390,maxX:414,minZ:-1068,maxZ:126};
export const COUNTRY_CLUB_TRAVEL_LENGTH=Array.from({length:Math.ceil(length)},(_,i)=>{const a=countryClubPoint(i),b=countryClubPoint(Math.min(length,i+1));return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}).reduce((a,b)=>a+b,0);
