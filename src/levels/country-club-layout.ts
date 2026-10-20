import * as THREE from 'three';

// This is a racecourse: author every approach, obstacle and recovery for the
// existing full-speed movement model. The golf layout is independent of the race.
// Keep the sharp corners wide enough to carry speed and the water lines boost-fed.

export type Point=[number,number,number];
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const COUNTRY_CLUB_PREVIOUS_LENGTH=1532.4105133216735;
export const COUNTRY_CLUB_SAND_SPEED=2.4;
export { countryClubLandHeight,COUNTRY_CLUB_HOLES,COUNTRY_CLUB_GOLF_BUNKERS,countryClubGreenDistance,countryClubGreenRadius,countryClubGolfBunkerDistance,countryClubGolfField,COUNTRY_CLUB_TILT_DEGREES,countryClubBaseLandHeight,countryClubSandPitProfile } from './country-club-estate';
import { countryClubLandHeight,COUNTRY_CLUB_HOLES,countryClubGolfGround,countryClubGolfPitOffset,countryClubSandPitProfile,estatePoint } from './country-club-estate';
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
  {hole:3,name:'Creek launch',a:raceStation(424),b:raceStation(424)+24},
  {hole:6,name:'Reed carry',a:raceStation(940),b:raceStation(940)+22},
  {hole:10,name:'Twin islands / first',a:raceStation(1610),b:raceStation(1610)+22},
  {hole:10,name:'Twin islands / second',a:raceStation(1610)+78,b:raceStation(1610)+100},
  {hole:14,name:'Crescent carry',a:raceStation(2330),b:raceStation(2330)+24},
  {hole:17,name:'Long carry',a:raceStation(2838),b:raceStation(2838)+28},
];
// Shared banks follow the rail/jump merge, so either line can bank at speed.
for(let i=0;i<COUNTRY_CLUB_CHECKPOINTS.length;i++)for(const id of [3,6,10,14,17]){
  const g=COUNTRY_CLUB_GAPS.filter(g=>g.hole===id),start=g[0].a-27,end=g[g.length-1].b+28;
  if(COUNTRY_CLUB_CHECKPOINTS[i]>start-12&&COUNTRY_CLUB_CHECKPOINTS[i]<end+50)COUNTRY_CLUB_CHECKPOINTS[i]=end+60;
}
export const COUNTRY_CLUB_PONDS=[3,6,10,14,17].map((hole,i)=>{
  const gs=COUNTRY_CLUB_GAPS.filter(g=>g.hole===hole),s=(gs[0].a+gs[gs.length-1].b)/2,q=basePoint(s),frame=countryClubFrame(s);
  return {hole,s,rx:[31,38,33,43,36][i],rz:hole===10?82:40,x:q[0],z:q[2],y:q[1]-1.65,f:frame.f,r:frame.r};
});
// Entry, jump approach and exit pads feed the next readable piece of track.
const padSeeds=[{s:64,speed:58},...COUNTRY_CLUB_GAPS.map((g,i)=>({s:g.a-(i>0&&g.a-COUNTRY_CLUB_GAPS[i-1].b<70?28:44),speed:g.hole===17?64:58})),...COUNTRY_CLUB_CORNERS.map(c=>({s:c.exit+25,speed:56})),{s:length-115,speed:64}];
for(let s=170;s<length-180;s+=165){
  if(COUNTRY_CLUB_GAPS.some(g=>s>g.a-75&&s<g.b+55)||COUNTRY_CLUB_CORNERS.some(c=>s>c.entry-100&&s<c.exit+20)||padSeeds.some(p=>Math.abs(p.s-s)<65))continue;
  padSeeds.push({s,speed:60});
}
export const COUNTRY_CLUB_PADS=padSeeds.filter(p=>!COUNTRY_CLUB_CORNERS.some(c=>p.s>c.entry-85&&p.s<c.exit+4)).sort((a,b)=>a.s-b.s).filter((p,i,a)=>!i||p.s-a[i-1].s>16).map(p=>({...p,hold:4.5}));
export const COUNTRY_CLUB_ENCOUNTERS=[
  {s:590,u:7,foe:'grunt'},{s:620,u:-7,foe:'turtle'},
  {s:765,u:6,foe:'hopper'},{s:1130,u:-7,foe:'grunt'},
  {s:1195,u:7,foe:'turtle'},{s:1480,u:7,foe:'hopper'},
  {s:1975,u:7,foe:'grunt'},{s:2060,u:-7,foe:'turtle'},
  {s:2640,u:7,foe:'grunt'},{s:2750,u:-7,foe:'hopper'},
  {s:2935,u:7,foe:'grunt'},{s:2935,u:-7,foe:'turtle'},
].map(e=>({...e,s:raceStation(e.s)})) as {s:number;u:number;foe:'grunt'|'turtle'|'hopper'}[];
// Large staggered pot bunkers demand a readable line, not a last-moment dodge.
const pitStations:number[]=[];
for(let desired=175;desired<length-130;desired+=175){
  const s=[0,25,-25,50,-50].map(d=>desired+d).find(s=>
    !COUNTRY_CLUB_CORNERS.some(c=>s>c.entry-40&&s<c.exit+40)&&
    !COUNTRY_CLUB_GAPS.some(g=>s>g.a-65&&s<g.b+65)&&
    !COUNTRY_CLUB_PADS.some(p=>Math.abs(p.s-s)<34)&&
    !COUNTRY_CLUB_CHECKPOINTS.some(p=>Math.abs(p-s)<18)&&
    !COUNTRY_CLUB_ENCOUNTERS.some(e=>Math.abs(e.s-s)<36)&&
    !pitStations.some(p=>Math.abs(p-s)<110));
  if(s!==undefined)pitStations.push(s);
}
export const COUNTRY_CLUB_SLALOM=pitStations.map((s,i)=>({s,side:i%2?-1:1,depth:3.8+(i%3)*.3,halfLength:18+(i%2)*3,halfWidth:7.2,edgeOffset:-.7,slalom:true}));
export const COUNTRY_CLUB_TRACK_PITS=[...COUNTRY_CLUB_SLALOM];
for(let s=100;s<length-130&&COUNTRY_CLUB_TRACK_PITS.length<18;s+=65){
  if(COUNTRY_CLUB_PADS.some(p=>Math.abs(p.s-s)<32)||COUNTRY_CLUB_TRACK_PITS.some(p=>Math.abs(p.s-s)<65)||COUNTRY_CLUB_GAPS.some(g=>s>g.a-70&&s<g.b+65)||COUNTRY_CLUB_CORNERS.some(c=>s>c.entry-30&&s<c.exit+30)||COUNTRY_CLUB_ENCOUNTERS.some(e=>Math.abs(e.s-s)<36))continue;
  const side=COUNTRY_CLUB_TRACK_PITS.length%2?1:-1,frame=countryClubFrame(s),u=side*(countryClubWidth(s)/2+6),x=frame.p[0]+frame.r[0]*u,z=frame.p[2]+frame.r[2]*u;
  if(COUNTRY_CLUB_HOLES.some(h=>Math.hypot(((h.cup[0]-x)*frame.f[0]+(h.cup[1]-z)*frame.f[2])/16,((h.cup[0]-x)*frame.r[0]+(h.cup[1]-z)*frame.r[2])/8.5)<1.6))continue;
  COUNTRY_CLUB_TRACK_PITS.push({s,side,depth:4.2,halfLength:16,halfWidth:8.5,edgeOffset:6,slalom:false});
}
export const countryClubRacingOffset=(s:number)=>COUNTRY_CLUB_SLALOM.reduce((u,o)=>u-o.side*5.1*Math.exp(-(((s-o.s)/39)**4)),0);
export function countryClubWidth(s:number){
  let w=18;for(const c of COUNTRY_CLUB_CORNERS){const d=Math.max(0,c.entry-s,s-c.exit);w+=8*Math.exp(-((d/25)**2));}for(const g of COUNTRY_CLUB_GAPS){const d=Math.max(0,g.a-18-s,s-g.b-32);w=Math.max(w,18+12*Math.exp(-((d/24)**2)));}return Math.min(30,w);
}
export function countryClubTrackPitDistance(p:typeof COUNTRY_CLUB_TRACK_PITS[number],s:number,u:number){
  return Math.hypot((s-p.s)/p.halfLength,(u-p.side*(countryClubWidth(p.s)/2+p.edgeOffset))/p.halfWidth);
}
export function countryClubTrackPitOffset(s:number,u:number){
  let y=0,inside=false;for(const p of COUNTRY_CLUB_TRACK_PITS){if(Math.abs(s-p.s)>p.halfLength*1.3)continue;const r=countryClubTrackPitDistance(p,s,u);if(r>=1.3)continue;const next=countryClubSandPitProfile(r,p.depth);y=inside?Math.min(y,next):next;inside=true;}return y;
}
export const countryClubBunkerAt=(s:number,u:number)=>COUNTRY_CLUB_TRACK_PITS.some(p=>countryClubTrackPitDistance(p,s,u)<1.18);
// Every mechanical pad and patrol is on a genuinely flat piece of ground.
const flatSpots=[...COUNTRY_CLUB_PADS.map(p=>({s:p.s,inner:6,outer:32})),
  ...COUNTRY_CLUB_ENCOUNTERS.map(e=>({s:e.s,inner:10,outer:24}))];
function waterGrade(s:number){
  let y=basePoint(s)[1];
  for(const p of COUNTRY_CLUB_PONDS)y=THREE.MathUtils.lerp(y,p.y+1.65,1-smooth((Math.abs(s-p.s)-p.rz-12)/35));
  return y;
}
const flatTargets=flatSpots.map(f=>({...f,y:waterGrade(f.s)}));
export function countryClubDeckHeight(s:number,u=0){
  const p=basePoint(s,u);let y=waterGrade(s)+(p[1]-basePoint(s)[1])*.25;

  for(const g of COUNTRY_CLUB_GAPS){if(s>=g.a-18&&s<=g.a)y+=.7*smooth((s-(g.a-18))/18);if(s>=g.b&&s<g.b+28)y+=1.05*(1-smooth((s-g.b)/28));}
  // Inner pad/patrol footprints stay exactly flat even when their approach
  // blends overlap. Inverse blend weights meet each plateau continuously.
  let weight=1,weighted=y;
  for(const f of flatTargets){
    const d=Math.abs(s-f.s);if(d>=f.outer)continue;
    if(d<=f.inner)return f.y+countryClubTrackPitOffset(s,u);
    const t=1-smooth((d-f.inner)/(f.outer-f.inner)),w=t/Math.max(1e-8,1-t);weight+=w;weighted+=f.y*w;
  }
  return weighted/weight+countryClubTrackPitOffset(s,u);
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
  let y=THREE.MathUtils.lerp(countryClubGolfGround(x,z),countryClubDeckHeight(near.s,near.u)-countryClubTrackPitOffset(near.s,near.u)-.85,1-smooth((near.distance-w-1)/22));
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
export function countryClubUncutGroundHeight(x:number,z:number){
  const b=COUNTRY_CLUB_BOUNDS,tile=96,step=12;
  if(x<b.minX||x>=b.maxX||z<b.minZ||z>=b.maxZ)return sculptedGroundHeight(x,z);
  const bx=b.minX+Math.floor((x-b.minX)/tile)*tile,bz=b.minZ+Math.floor((z-b.minZ)/tile)*tile,wx=Math.min(tile,b.maxX-bx),wz=Math.min(tile,b.maxZ-bz),dx=wx/Math.ceil(wx/step),dz=wz/Math.ceil(wz/step);
  const ix=Math.floor((x-bx)/dx),iz=Math.floor((z-bz)/dz),x0=bx+ix*dx,z0=bz+iz*dz,u=(x-x0)/dx,v=(z-z0)/dz;
  const a=gridHeight(x0,z0),bb=gridHeight(x0+dx,z0),c=gridHeight(x0,z0+dz),d=gridHeight(x0+dx,z0+dz);
  return u+v<=1?a*(1-u-v)+bb*u+c*v:bb*(1-v)+c*(1-u)+d*(u+v-1);
}
const worldPits=COUNTRY_CLUB_TRACK_PITS.map(p=>{const frame=countryClubFrame(p.s),u=p.side*(countryClubWidth(p.s)/2+p.edgeOffset);return {...p,frame,x:frame.p[0]+frame.r[0]*u,z:frame.p[2]+frame.r[2]*u};});
export function countryClubWorldPitOffset(x:number,z:number){
  let offset=countryClubGolfPitOffset(x,z);
  for(const p of worldPits){
    const dx=x-p.x,dz=z-p.z;if(Math.abs(dx)>35||Math.abs(dz)>35)continue;
    const r=Math.hypot((dx*p.frame.f[0]+dz*p.frame.f[2])/p.halfLength,(dx*p.frame.r[0]+dz*p.frame.r[2])/p.halfWidth);
    if(r<1.3){const next=countryClubSandPitProfile(r,p.depth);offset=offset===0?next:Math.min(offset,next);}
  }return offset;
}
const pitHeightCache=new Map<string,number>();
const pitHeight=(x:number,z:number)=>{const key=`${x.toFixed(6)}:${z.toFixed(6)}`;if(!pitHeightCache.has(key))pitHeightCache.set(key,countryClubUncutGroundHeight(x,z)+countryClubWorldPitOffset(x,z));return pitHeightCache.get(key)!;};
export function countryClubGroundHeight(x:number,z:number){
  const b=COUNTRY_CLUB_BOUNDS;
  if(x<b.minX||x>=b.maxX||z<b.minZ||z>=b.maxZ)return pitHeight(x,z);
  const bx=b.minX+Math.floor((x-b.minX)/96)*96,bz=b.minZ+Math.floor((z-b.minZ)/96)*96,wx=Math.min(96,b.maxX-bx),wz=Math.min(96,b.maxZ-bz),dx=wx/Math.ceil(wx/12)/4,dz=wz/Math.ceil(wz/12)/4;
  const x0=bx+Math.floor((x-bx)/dx)*dx,z0=bz+Math.floor((z-bz)/dz)*dz,u=(x-x0)/dx,v=(z-z0)/dz;
  if(u<1e-8&&v<1e-8)return pitHeight(x0,z0);
  const a=pitHeight(x0,z0),bb=pitHeight(x0+dx,z0),c=pitHeight(x0,z0+dz),d=pitHeight(x0+dx,z0+dz);
  return u+v<=1?a*(1-u-v)+bb*u+c*v:bb*(1-v)+c*(1-u)+d*(u+v-1);
}
export function countryClubPitField(x:number,z:number){
  for(const p of worldPits){const dx=x-p.x,dz=z-p.z;if(Math.abs(dx)>35||Math.abs(dz)>35)continue;const r=Math.hypot((dx*p.frame.f[0]+dz*p.frame.f[2])/p.halfLength,(dx*p.frame.r[0]+dz*p.frame.r[2])/p.halfWidth);if(r<1.4)return {r,depth:p.depth};}return null;
}
export const COUNTRY_CLUB_WATER_RAILS=COUNTRY_CLUB_PONDS.map((p,i)=>{
  const carries=COUNTRY_CLUB_GAPS.filter(g=>g.hole===p.hole);
  return {hole:p.hole,start:carries[0].a-27,end:carries[carries.length-1].b+28,side:i%2?-1:1,offset:14,exitOffset:12};
});
export const COUNTRY_CLUB_KILL_Y=-140;
export const COUNTRY_CLUB_RIDGE={start:raceStation(2444),end:raceStation(2538)};
export function countryClubRailPoint(r:{start:number;end:number;side:number;offset:number;exitOffset?:number},s:number):Point{
  const t=clamp((s-r.start)/(r.end-r.start),0,1),blend=Math.sin(Math.PI*t)**2;
  const lateral=r.exitOffset===undefined?r.offset*blend:t<.5?r.offset*smooth(t*2):r.offset+(r.exitOffset-r.offset)*smooth((t-.5)*2);
  const u=r.side*lateral,p=countryClubPoint(s,u,.16+.6*blend);p[1]-=countryClubTrackPitOffset(s,u);return p;
}
export function countryClubRailExitOffset(r:{end:number;side:number;exitOffset?:number},s:number){return r.side*(r.exitOffset??0)*(1-smooth((s-r.end)/40));}
export const COUNTRY_CLUB_BOUNDS={minX:-390,maxX:414,minZ:-1068,maxZ:126};
export const COUNTRY_CLUB_TRAVEL_LENGTH=Array.from({length:Math.ceil(length)},(_,i)=>{const a=countryClubPoint(i),b=countryClubPoint(Math.min(length,i+1));return Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);}).reduce((a,b)=>a+b,0);
