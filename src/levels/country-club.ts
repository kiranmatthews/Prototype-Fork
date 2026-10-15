import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';

type Point=[number,number,number];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const rounded=(v:number)=>Math.round(v*1000)/1000;
export const COUNTRY_CLUB_PREVIOUS_LENGTH=1532.4105133216735;
export const COUNTRY_CLUB_SAND_SPEED=2.4;
export const countryClubLandHeight=(x:number,z:number)=>8+7*Math.sin(-z/180)+3.4*Math.sin(-z/63)+2.2*Math.sin(x/80+z/230);
// X, Z, fairway width. A long nine-hole landscape, with no folded sky-road.
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
export const COUNTRY_CLUB_LENGTH=length;
const atKnot=(i:number)=>COUNTRY_CLUB_ROUTE[Math.round(i/(knots.length-1)*(raw.length-1))].s;
function row(s:number){
  s=clamp(s,0,length);let a=0,b=COUNTRY_CLUB_ROUTE.length-1;
  while(b-a>1){const m=(a+b)>>1;if(COUNTRY_CLUB_ROUTE[m].s<s)a=m;else b=m;}
  const lo=COUNTRY_CLUB_ROUTE[a],hi=COUNTRY_CLUB_ROUTE[b],t=(s-lo.s)/(hi.s-lo.s||1);
  return {p:lo.p.map((v,i)=>v+(hi.p[i]-v)*t) as Point,width:lo.width+(hi.width-lo.width)*t};
}
export function countryClubPoint(s:number,u=0,lift=0):Point{
  const p=row(s).p,a=row(s-.5).p,b=row(s+.5).p,dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;
  const x=p[0]-dz/n*u,z=p[2]+dx/n*u;
  return [x,countryClubLandHeight(x,z)+.08+lift,z];
}
export function countryClubProgress(p:{x:number;y:number;z:number},previous=0){
  let best=Infinity,s=previous;
  for(const q of COUNTRY_CLUB_ROUTE){
    if(q.s<previous-20||q.s>previous+85)continue;
    const d=(q.p[0]-p.x)**2+(q.p[2]-p.z)**2;
    if(d<best){best=d;s=q.s;}
  }
  return s;
}
const yaw=(s:number)=>{const a=countryClubPoint(s-.5),b=countryClubPoint(s+.5);return -Math.atan2(b[0]-a[0],a[2]-b[2])*180/Math.PI;};
export const COUNTRY_CLUB_SECTIONS=[
  {name:'First tee',s:0},{name:'Bunker doglegs',s:atKnot(3)},
  {name:'Waterside fairway',s:atKnot(6)},{name:'Ridge greens',s:atKnot(10)},
  {name:'Crosswind carry',s:atKnot(13)},{name:'Rolling back nine',s:atKnot(16)},
  {name:'Willow water',s:atKnot(19)},{name:'Last bunkers',s:atKnot(22)},
  {name:'Ninth green',s:atKnot(24)},
];
export const COUNTRY_CLUB_CHECKPOINTS=[80,atKnot(5)-15,atKnot(7)-40,atKnot(10)+45,atKnot(13)-18,atKnot(16)-18,atKnot(19)-18,atKnot(22)-18,length-90];
export const COUNTRY_CLUB_GREENS=[2,5,10,13,16,19,22,24].map(i=>atKnot(i)).concat(length-25);
const width=(s:number)=>row(s).width+COUNTRY_CLUB_GREENS.reduce((w,g)=>w+12*Math.exp(-(((s-g)/25)**2)),0);
export const COUNTRY_CLUB_SLALOM=[{s:atKnot(3)+12,side:-1},{s:atKnot(4)+10,side:1},{s:atKnot(11)+15,side:-1},{s:atKnot(18)+15,side:1},{s:atKnot(21)+28,side:-1}];
export const COUNTRY_CLUB_GAPS=[
  {name:'First irrigation carry',a:atKnot(6)+35,b:atKnot(6)+40},
  {name:'Crosswind creek',a:atKnot(14)+28,b:atKnot(14)+34},
  {name:'Willow carry',a:atKnot(20)+30,b:atKnot(20)+37},
];
const bunkerAt=(s:number,u:number)=>COUNTRY_CLUB_SLALOM.find(o=>Math.abs(o.s-s)<10&&u*o.side>-width(s)*.12);
export const COUNTRY_CLUB_PONDS=COUNTRY_CLUB_GAPS.map((g,i)=>{
  const p=countryClubPoint((g.a+g.b)/2);return {x:p[0],z:p[2],rx:29+i*3,rz:25+i*2,y:p[1]-1.25};
});
// An additional broad pond turns the outside of hole three into a real hazard.
const extra=countryClubPoint(atKnot(8)+20,-25);
COUNTRY_CLUB_PONDS.push({x:extra[0],z:extra[2],rx:30,rz:43,y:extra[1]-1.4});
const nav=COUNTRY_CLUB_ROUTE.filter((_,i)=>i%8===0);
function nearestRoad(x:number,z:number){
  let best=Infinity,s=0;
  for(let i=1;i<nav.length;i++){
    const a=nav[i-1],b=nav[i],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2];
    const t=clamp(((x-a.p[0])*dx+(z-a.p[2])*dz)/(dx*dx+dz*dz),0,1);
    const d=Math.hypot(x-a.p[0]-t*dx,z-a.p[2]-t*dz);
    if(d<best){best=d;s=a.s+(b.s-a.s)*t;}
  }
  return {distance:best,s};
}
export function countryClubGroundHeight(x:number,z:number){
  let y=countryClubLandHeight(x,z);
  for(const p of COUNTRY_CLUB_PONDS){
    const r=Math.hypot((x-p.x)/p.rx,(z-p.z)/p.rz);
    y=THREE.MathUtils.lerp(y,Math.min(y,p.y-3.2),1-smooth((r-.72)/.5));
  }
  const near=nearestRoad(x,z);
  // The road is at grade. A shallow bed prevents coarse terrain triangles
  // protruding through its finer surface, with a gentle recoverable shoulder.
  y-=.48*(1-smooth((near.distance-width(near.s)/2-1)/5));
  return y;
}
const endPoint=countryClubPoint(length);
export const COUNTRY_CLUB_BOUNDS={minX:Math.floor((-145*scale-90)/6)*6,maxX:Math.ceil((145*scale+90)/6)*6,minZ:Math.floor((endPoint[2]-90)/6)*6,maxZ:Math.ceil((50*scale+70)/6)*6};
const C:CustomComponent[]=[],pal={fairway:'#929f95',green:'#a8b6a2',sand:'#b8b2a0',bunker:'#cec5af',edge:'#e5e6dc',water:'#647f82',dark:'#4d5952'};
function mesh(name:string,v:number[],indices:number[],color:string,solid=true,grp=1,extra:Partial<CustomComponent>={}){
  if(!indices.length)return;
  C.push({t:'mesh',p:[0,0,0],vertices:v.map(rounded),indices,tex:'solid',color,solid,vert:false,grp,nm:name,
    ...(solid?{}:{edgeGrinding:false}),...extra});
}
function box(name:string,p:Point,s:Point,color:string,rotation=0,grp=9){C.push({t:'platform',p,s,tex:'solid',color,yaw:rotation,grp,nm:name});}
// One unbroken, rolling landscape. All land outside authored fast surfaces is
// deep sand: no invisible walls or teleport penalty, and no grindable tile seams.
const step=6,tile=96,b=COUNTRY_CLUB_BOUNDS;
const heights=new Map<string,number>();
const ground=(x:number,z:number)=>{const k=`${x}:${z}`;let y=heights.get(k);if(y===undefined){y=countryClubGroundHeight(x,z);heights.set(k,y);}return y;};
for(let x=b.minX;x<b.maxX;x+=tile)for(let z=b.minZ;z<b.maxZ;z+=tile){
  const nx=Math.round((Math.min(b.maxX,x+tile)-x)/step),nz=Math.round((Math.min(b.maxZ,z+tile)-z)/step),v:number[]=[],ind:number[]=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++)v.push(x+i*step,ground(x+i*step,z+j*step),z+j*step);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,c=a+nx+1;ind.push(a,c,a+1,a+1,c,c+1);}
  mesh('Rolling landscape / claggy sand',v,ind,pal.sand,true,10,{groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false});
}
function road(a:number,b:number,point:(s:number,u:number,h?:number)=>Point,getWidth:(s:number)=>number,name:string,grp:number,bunkers=false){
  const columns=[-1,-.66,-.33,0,.33,.66,1];
  for(let from=a;from<b-.001;from+=60){
    const to=Math.min(b,from+60),count=Math.ceil((to-from)/2),v:number[]=[],fast:number[]=[],sand:number[]=[],green:number[]=[];
    for(let i=0;i<=count;i++){
      const s=from+(to-from)*i/count;
      for(const u of columns)v.push(...point(s,u*getWidth(s)/2));
      if(i)for(let j=0;j<columns.length-1;j++){
        const n=(i-1)*columns.length+j,k=n+columns.length,mid=from+(to-from)*(i-.5)/count;
        const u=(columns[j]+columns[j+1])*getWidth(mid)/4;
        const dest=bunkers&&bunkerAt(mid,u)?sand:COUNTRY_CLUB_GREENS.some(g=>Math.abs(g-mid)<20)?green:fast;
        dest.push(n,n+1,k,k,n+1,k+1);
      }
    }
    mesh(name,v,fast,pal.fairway,true,grp);
    mesh('Putting green / fast rolling surface',v,green,pal.green,true,grp);
    mesh('Bunker / claggy sand intrusion',v,sand,pal.bunker,true,2,{groundSpeedLimit:COUNTRY_CLUB_SAND_SPEED,edgeGrinding:false});
  }
}
const spans=[0,...COUNTRY_CLUB_GAPS.flatMap(g=>[g.a,g.b]),length];
for(let i=0;i<spans.length-1;i+=2)road(spans[i],spans[i+1],countryClubPoint,width,'Fairway / at-grade route',1,true);
// Narrow diagonal over the rough saves a full dogleg; misses land in slow sand.
const shortStart=atKnot(7)-20,shortEnd=atKnot(10)+20,sa=countryClubPoint(shortStart),sb=countryClubPoint(shortEnd);
const sd=Math.hypot(sb[0]-sa[0],sb[2]-sa[2]),sx=(sb[0]-sa[0])/sd,sz=(sb[2]-sa[2])/sd;
const shortcutPoint=(s:number,u=0,h=0):Point=>{
  const t=clamp(s/sd,0,1),x=sa[0]+sx*s-sz*u,z=sa[2]+sz*s+sx*u;
  return [x,countryClubLandHeight(x,z)+.08+1.3*Math.sin(Math.PI*t)**2+h,z];
};
export const COUNTRY_CLUB_SHORTCUT={start:shortStart,end:shortEnd,length:sd,a:sd*.52,b:sd*.52+4.5,point:shortcutPoint};
road(0,sd*.52,shortcutPoint,()=>5.2,'Cart-path shortcut / narrow raised bank',3);
road(sd*.52+4.5,sd,shortcutPoint,()=>5.2,'Cart-path shortcut / landing',3);
// Shallow-edged swimmable ponds use the existing authored-water toolkit.
for(const [i,p] of COUNTRY_CLUB_PONDS.entries()){
  const v:number[]=[p.x,p.y,p.z],ind:number[]=[];
  for(let k=0;k<=48;k++){const a=k/48*Math.PI*2;v.push(p.x+Math.cos(a)*p.rx,p.y,p.z+Math.sin(a)*p.rz);if(k)ind.push(0,k+1,k);}
  mesh(`Water hazard ${i+1}`,v,ind,pal.water,false,4,{materialStyle:'water',swimDepth:7,opacity:.88});
}
const railStart=atKnot(12)-25,railEnd=atKnot(13)-20;
export const COUNTRY_CLUB_RIDGE={start:railStart,end:railEnd};
const railPoints=Array.from({length:50},(_,i)=>{
  const s=railStart+(railEnd-railStart)*i/49,blend=smooth((railEnd-s)/28);
  return countryClubPoint(s,-5*blend,.12+.4*blend);
});
C.push({t:'rail',p:railPoints[0],pts:railPoints.map(p=>[p[0]-railPoints[0][0],p[2]-railPoints[0][2],0,p[1]-railPoints[0][1]]),grp:5,nm:'Ridge / optional inside grind'});
C.push({t:'crystal',p:countryClubPoint((railStart+railEnd)/2,-5,1.2),grp:5,nm:'Ridge / optional crystal'});
// Tee flags sit on the actual greens; their position makes the outside line
// readable over a crest. The small dark hole is paint, not a collision trap.
for(const [i,s] of COUNTRY_CLUB_GREENS.entries()){
  const p=countryClubPoint(s,width(s)*.3);
  box(`Green ${i+1} / flag pole`,[p[0],p[1]+2,p[2]],[.16,4,.16],pal.edge);
  const q=countryClubPoint(s,width(s)*.3+1.1,3.4);
  box(`Green ${i+1} / flag`,q,[2.2,1.1,.1],pal.edge,yaw(s));
  const v:number[]=[p[0],p[1]+.03,p[2]],ind:number[]=[];
  for(let k=0;k<=16;k++){const a=k/16*Math.PI*2;v.push(p[0]+Math.cos(a)*.45,p[1]+.03,p[2]+Math.sin(a)*.45);if(k)ind.push(0,k+1,k);}
  mesh(`Green ${i+1} / hole`,v,ind,pal.dark,false,9);
}
// Low boundary pegs and takeoff stripes are visual cues, never new obstacles.
for(let s=15;s<length-18;s+=24){
  if(COUNTRY_CLUB_GAPS.some(g=>s>g.a-5&&s<g.b+5))continue;
  const o=COUNTRY_CLUB_SLALOM.find(o=>Math.abs(s-o.s)<20),u=o?-o.side*5.2:0;
  mesh('Fairway / direction marker',[countryClubPoint(s+1.6,u,.04),countryClubPoint(s-1.2,u-1,.04),countryClubPoint(s-1.2,u+1,.04)].flat(),[0,1,2],pal.edge,false,9);
}
for(const g of COUNTRY_CLUB_GAPS)for(let d=1;d<=3;d++){
  const s=g.a-d*1.5,w=width(s)/2-.5;
  mesh('Water carry / takeoff paint',[countryClubPoint(s-.12,-w,.03),countryClubPoint(s-.12,w,.03),countryClubPoint(s+.12,-w,.03),countryClubPoint(s+.12,w,.03)].flat(),[0,1,2,2,1,3],pal.edge,false,9);
}
const house=countryClubPoint(18,42);
box('Clubhouse / greybox mass',[house[0],house[1]+5,house[2]],[28,10,18],pal.fairway);
box('Clubhouse / roof',[house[0],house[1]+10.4,house[2]],[32,.8,22],pal.edge);
for(let i=0;i<4;i++){const p=countryClubPoint(30+i*5,28);box('Cart parking / scale block',[p[0],p[1]+1,p[2]],[2.2,2,3.4],pal.dark);}
for(const [i,s] of COUNTRY_CLUB_CHECKPOINTS.entries())C.push({t:'checkpoint',p:countryClubPoint(s),grp:9,nm:`Checkpoint ${i+1} / fairway`});
for(const s of COUNTRY_CLUB_GREENS.slice(0,-1))for(const u of [-3,3])C.push({t:'crate',kind:'wood',p:countryClubPoint(s+12,u),grp:9,nm:'Green / optional box'});
for(let s=18;s<length-20;s+=14){
  if(COUNTRY_CLUB_GAPS.some(g=>s>g.a-2&&s<g.b+2))continue;
  const o=COUNTRY_CLUB_SLALOM.find(o=>Math.abs(s-o.s)<22);
  C.push({t:'wumpa',p:countryClubPoint(s,o?-o.side*5.2:0,1.1),grp:9,nm:'Fairway / route fruit'});
}
for(let s=0;s<length;s+=8)C.push({t:'camnode',p:countryClubPoint(s),radius:0,grp:9});
C.push({t:'camnode',p:countryClubPoint(length),radius:0,grp:9});
C.push({t:'clock',p:countryClubPoint(12,2),grp:9,nm:'First tee / normal time-trial clock'});
C.push({t:'gate',p:countryClubPoint(length-14),yaw:yaw(length-14),grp:9,nm:'Ninth green / normal finish'});
export const COUNTRY_CLUB_LEVEL:CustomLevelData={
  v:1,name:'Country Club Circuit',spawn:countryClubPoint(7,0,.1),startWarpPad:false,killY:-42,
  sky:'day',cameraLookAhead:9,cameraAirLift:.6,cameraRig:{camDist:9,camHeight:5.6,camPitch:18,camFov:58},
  atmosphere:{fogEnabled:true,fogNear:130,fogFar:480,fogColor:'#b9c2bc',ambientSky:'#d9dfd8',ambientGround:'#757b70',backdrop:'fog',drawDistance:520},
  components:C,groups:[
    {id:1,nm:'01 / rolling fairways and greens',editorOnly:true},{id:2,nm:'02 / claggy bunkers',editorOnly:true},
    {id:3,nm:'03 / narrow dogleg shortcut',editorOnly:true},{id:4,nm:'04 / water hazards',editorOnly:true},
    {id:5,nm:'05 / ridge grind and crystal',editorOnly:true},{id:9,nm:'09 / flags and normal level flow',editorOnly:true},
    {id:10,nm:'10 / continuous soft-sand landscape',editorOnly:true},
  ],
};
