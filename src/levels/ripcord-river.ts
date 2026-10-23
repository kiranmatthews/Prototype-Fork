import { dressRollingBones } from './moonbone-scenery';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import type {CustomComponent,CustomLevelData} from '../level';
import {RUMBLEWATER_RUN_LEVEL,RUMBLEWATER_END,RUMBLEWATER_REFUGES,rumblePoint,rumbleHeight,rumbleProgress,rumbleTangent,rumbleYaw} from './rumblewater-run';
import {buildCreekBank,buildCreekCollision,type CreekBank} from './custard-terrain';
import {buildBoulderCradle,dressPipeFoundation} from './rumblewater-foundations';
import {rumblewaterArt,RUMBLEWATER_ART_GROUPS} from './rumblewater-art';

type Point=[number,number,number];
type Scalar=number|((s:number)=>number);
const round=(n:number)=>Math.round(n*10000)/10000;
const val=(n:Scalar,s:number)=>typeof n==='function'?n(s):n;
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const RIPCORD_WIDTH_SCALE=1.3;
export const RIPCORD_SPEED_SCALE=.85;
export const RIPCORD_REFUGES=RUMBLEWATER_REFUGES.slice(0,4).map((r,i)=>{
 const delta=[360,760,1160,1560][i]-r.checkpoint;
 return {...r,entry:r.entry+delta,checkpoint:r.checkpoint+delta,exit:r.exit+delta,
  name:['Terrace vault','Twinwater gatehouse','Willow culvert','Thunder watch'][i]};
});
const rawX=(s:number)=>29*Math.sin(s/181)-17*Math.sin(s/307);
const rawHeight=(s:number)=>22-.033*s-2.8*smooth((s-820)/240)+2*smooth((s-1190)/120)*(1-smooth((s-1400)/120));
const roomWeight=(s:number,r:typeof RIPCORD_REFUGES[number])=>s<r.entry?smooth((s-r.entry+12)/12):1-smooth((s-r.exit)/12);
export function ripcordX(s:number):number {
 const x=rawX(s),r=RIPCORD_REFUGES.find(r=>s>=r.entry-12&&s<=r.exit+12);
 if(!r)return x;
 const line=rawX(r.entry)+(rawX(r.exit)-rawX(r.entry))*(s-r.entry)/(r.exit-r.entry);
 return x+(line-x)*roomWeight(s,r);
}
export function ripcordHeight(s:number):number {
 const h=rawHeight(s),r=RIPCORD_REFUGES.find(r=>s>=r.entry-12&&s<=r.exit+12);
 return r?h+(rawHeight(r.checkpoint)-h)*roomWeight(s,r):h;
}
export function ripcordTangent(s:number):Point {
 const x=(ripcordX(s+.1)-ripcordX(s-.1))/.2,d=Math.hypot(x,1);return[x/d,0,-1/d];
}
export function ripcordPoint(s:number,y=ripcordHeight(s),u=0):Point {
 const d=ripcordTangent(s);return[ripcordX(s)-d[2]*u,y,-s+d[0]*u].map(round) as Point;
}
export const ripcordYaw=(s:number)=>Math.atan2(-ripcordTangent(s)[0],-ripcordTangent(s)[2])*180/Math.PI;
export function ripcordProgress(p:{x:number;z:number}|Point):number {
 const x=Array.isArray(p)?p[0]:p.x,z=Array.isArray(p)?p[2]:p.z;let s=-z;
 for(let i=0;i<5;i++){const d=(ripcordX(s+.1)-ripcordX(s-.1))/.2;s-=((ripcordX(s)-x)*d+s+z)/(1+d*d);}return s;
}
export function riverLength(end:number,point:(s:number)=>Point=rumblePoint):number {
 let total=0,previous=point(0);
 for(let s=.25;s<end+.25;s+=.25){const p=point(Math.min(s,end));total+=Math.hypot(p[0]-previous[0],p[2]-previous[2]);previous=p;}return total;
}
export const ROLLING_BONES_LENGTH=riverLength(RUMBLEWATER_END);
let lo=0,hi=RUMBLEWATER_END;
for(let i=0;i<32;i++){const mid=(lo+hi)/2;if(riverLength(mid,ripcordPoint)<ROLLING_BONES_LENGTH*.7)lo=mid;else hi=mid;}
export const RIPCORD_END=(lo+hi)/2;
export const RIPCORD_LENGTH=riverLength(RIPCORD_END,ripcordPoint);
export const RIPCORD_BOULDER_END=RIPCORD_END-30;
export const RIPCORD_SECTIONS=[
 {a:0,b:376,name:'Broken terraces'},
 {a:376,b:777,name:'Twin spillways'},
 {a:777,b:1172,name:'Sluice switchbacks'},
 {a:1172,b:1574,name:'Canopy causeway'},
 {a:1574,b:RIPCORD_END+20,name:'Thunder bowls'},
].map((s,i)=>({...s,grp:140+i}));
const group=(s:number)=>RIPCORD_SECTIONS.find(r=>s<r.b)?.grp??144;
const sampler={point:ripcordPoint,height:ripcordHeight},C:CustomComponent[]=[];
export const RIPCORD_BANKS:CreekBank[]=[];
export const RIPCORD_GAPS:{a:number;b:number;u:number;name:string;route?:'left'|'right'}[]=[];
export const RIPCORD_PIPES:{a:number;b:number;u:number;baseHalf:number;rise:number;arc:number;w:number;deck:number;name:string}[]=[];
const outside=(a:number,b:number)=>RIPCORD_REFUGES.reduce((spans,r)=>spans.flatMap(([a,b])=>b<=r.entry||a>=r.exit?[[a,b]]: [...(a<r.entry?[[a,r.entry]]:[]),...(b>r.exit?[[r.exit,b]]:[])]),[[a,b]]);
function bank(a:number,b:number,width=18,offset:Scalar=0,name='Ripcord worn terrace'){
 for(const [a0,b0]of outside(a,b)){
  const spec:CreekBank={a:a0,b:b0,width:width*1.3,offset,name,group:group(a0),top:ripcordHeight,minHalf:width*1.3/2-.15};
  RIPCORD_BANKS.push(spec);C.push(...buildCreekBank(sampler,spec),...buildCreekCollision(sampler,spec));
 }
}
function fruit(a:number,b:number,u:Scalar=0,lift:Scalar=1,step=8){
 for(let s=a;s<=b;s+=step)C.push({t:'wumpa',p:ripcordPoint(s,ripcordHeight(s)+val(lift,s),val(u,s)),grp:group(s),nm:'Ripcord route fruit'});
}
function box(s:number,u=0,kind:CustomComponent['kind']='wood'){
 C.push({t:'crate',p:ripcordPoint(s,ripcordHeight(s),u),kind,grp:group(s),nm:'Ripcord supplies'});
}
function gap(a:number,b:number,u:number,name:string,route?:'left'|'right'){
 RIPCORD_GAPS.push({a,b,u,name,route});
 for(const side of [-1,1])C.push({t:'decor',dkind:'coastpillar',p:ripcordPoint(a-5,ripcordHeight(a-5)-.2,u+side*5.8),s:[.62,1.95,.52],yaw:ripcordYaw(a-5),scenerySolid:false,grp:group(a),nm:name+' takeoff markers'});
 fruit(a-18,a-2,u,1,4);fruit(a+4,a+4,u,2.5);
}
function pipe(a:number,b:number,u=0,baseHalf=4.5,rise=3.5,name='Ripcord thunder bowl'){
 const arc=86,deck=1.1*1.3,w=baseHalf*1.3+.3*rise*Math.sin(arc*Math.PI/180),p=ripcordPoint(a,ripcordHeight(a),u);
 const pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/4);
 for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=ripcordPoint(s,ripcordHeight(s),u);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
 dressPipeFoundation(C,sampler,{a,b,w,rise,offset:u,arc,group:group(a),name});
 C.push({t:'vertramp',p,pts,w,rise,vkind:'half',arc,arcSteps:18,curve:'corner',deck,bank:0,rails:true,hangLock:true,
  tex:'custard-sandstone',color:'#eedfc2',artProxy:true,grp:group(a),nm:name});
 C.push({t:'decor',dkind:'bw-aqueduct-v3',p,pts,s:[2*(w+rise+deck),rise+.65,16],w,rise,arc,deck,solid:false,scenerySolid:false,grp:group(a),nm:name+' carved aqueduct'});
 RIPCORD_PIPES.push({a,b,u,baseHalf,rise,arc,w,deck,name});
}
export const terraceLane=(s:number)=>-4.8*smooth((s-72)/35)+9.6*smooth((s-168)/45)-4.8*smooth((s-285)/42);
export const twinLane=(s:number,side:number)=>side*10.5*smooth((s-410)/42)*(1-smooth((s-690)/40));
export const sluiceLane=(s:number)=>3.6*Math.sin((s-785)/55)*smooth((s-777)/35)*(1-smooth((s-1080)/55));
export const canopyLane=(s:number)=>-3.4*smooth((s-1308)/24)+6.8*smooth((s-1370)/40)-3.4*smooth((s-1480)/45);
export const canopyRailLane=(s:number)=>5.8-11.6*smooth((s-1212)/64);
function rail(a:number,b:number,u:Scalar,name:string){
 const p=ripcordPoint(a,ripcordHeight(a)+.8,val(u,a)),pts:NonNullable<CustomComponent['pts']>=[],n=Math.ceil((b-a)/3);
 for(let i=0;i<=n;i++){const s=a+(b-a)*i/n,q=ripcordPoint(s,ripcordHeight(s)+.8,val(u,s));pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
 C.push({t:'rail',p,pts,dkind:'bw-grind-rail',grp:group(a),nm:name});fruit(a+8,b-8,u,1.7);
}

// A new, independently authored course. The roof-like offset terraces now
// introduce jumping; parallel spillways come next and the bowls close the run.
buildBoulderCradle(C,sampler,ripcordYaw,-25,140,'Ripcord opening release');
bank(-62,72,18,0,'Ripcord arrival court');bank(72,144,12,terraceLane,'Left broken terrace');
gap(144,153,-4.8,'Terrace first leap');bank(153,236,12,terraceLane,'Crossing terrace');
gap(236,247,4.8,'Terrace second leap');bank(247,330,12,terraceLane,'Right returning terrace');bank(330,410,18,0,'Terrace vault court');
fruit(16,130,terraceLane);fruit(163,222,terraceLane);fruit(257,337,terraceLane);box(35,4,'mask');box(116,-1);box(210,6);box(304,-4,'mystery');
C.push({t:'clock',p:ripcordPoint(2,ripcordHeight(2),5),nm:'Ripcord time trial'});

bank(410,458,27,0,'Twinwater fan-out');
for(const side of [-1,1]){
 const a=side<0?548:626,b=side<0?557:636,u=side*10.5;
 pipe(458,a,u,2.6,2.4,side<0?'Left spillway head':'Right spillway sweep');gap(a,b,u,side<0?'Left spillway jump':'Right spillway jump',side<0?'left':'right');
 pipe(b,690,u,2.6,2.4,side<0?'Left spillway return':'Right spillway return');
 bank(690,730,12,s=>twinLane(s,side),side<0?'Left spillway apron':'Right spillway apron');
 fruit(424,a-22,s=>twinLane(s,side));fruit(b+8,728,s=>twinLane(s,side));box(side<0?600:520,u,side<0?'wood':'life');
}
bank(730,798,20,0,'Twinwater merge and gatehouse');

bank(798,904,18,sluiceLane,'Sluice sweeping left bank');gap(904,914,sluiceLane(904),'Sluice lock leap');
bank(914,1010,18,sluiceLane,'Sluice crossing bank');gap(1010,1018,sluiceLane(1010),'Sluice outlet jump');
bank(1018,1194,18,sluiceLane,'Sluice willow approach');
for(const [s,side]of [[840,-1],[880,1],[955,-1],[987,1],[1060,-1],[1103,1]]){
 const u=sluiceLane(s)+side*6.8;box(s,u,'metal');box(s+2.3,u,'metal');
 C.push({t:'decor',dkind:'coastpillar',p:ripcordPoint(s,ripcordHeight(s),u+side*3),s:[1.3,4.8,1.2],yaw:ripcordYaw(s),scenerySolid:true,grp:142,nm:'Sluice gate side pier'});
}
fruit(805,884,sluiceLane);fruit(925,990,sluiceLane);fruit(1030,1138,sluiceLane);box(1128,-4.5,'mask');

bank(1194,1340,20,canopyLane,'Canopy rail plaza');rail(1204,1284,canopyRailLane,'Canopy diagonal over supported plaza');
gap(1340,1350,canopyLane(1340),'Canopy west-island leap');bank(1350,1454,14,canopyLane,'Canopy crossing island');
gap(1454,1463,canopyLane(1454),'Canopy east-island leap');bank(1463,1600,20,canopyLane,'Thunder watch approach');
fruit(1198,1320,0);fruit(1360,1436,canopyLane);fruit(1474,1537,canopyLane);box(1390,-6);box(1493,6,'life');

pipe(1600,1706,0,4.5,3.5,'Thunder first bowl');gap(1706,1716,0,'Thunder bowl leap');bank(1716,1760,18,0,'Thunder landing island');
pipe(1760,1800,0,4.5,3.5,'Thunder short bowl');gap(1800,1808,0,'Thunder stepping leap');
pipe(1808,RIPCORD_BOULDER_END,0,4.5,3.5,'Thunder last sweep');gap(RIPCORD_BOULDER_END,RIPCORD_BOULDER_END+12,0,'Ripcord final boulder drop');
bank(RIPCORD_BOULDER_END+12,RIPCORD_END+20,24,0,'Ripcord sanctuary island');
fruit(1612,1686);fruit(1726,1748);fruit(1770,1784);fruit(1820,RIPCORD_BOULDER_END-22);fruit(RIPCORD_BOULDER_END+18,RIPCORD_END-4,0,1,5);
C.push({t:'crystal',p:ripcordPoint(RIPCORD_END-10,ripcordHeight(RIPCORD_END-10)+1.2),grp:144,nm:'Ripcord sanctuary crystal'},
 {t:'crate',kind:'nitrobang',p:ripcordPoint(RIPCORD_END-6,ripcordHeight(RIPCORD_END-6),8),grp:144,nm:'Ripcord nitro clear'},
 {t:'gate',p:ripcordPoint(RIPCORD_END),yaw:ripcordYaw(RIPCORD_END),grp:144,nm:'Ripcord sanctuary'});

// Reuse the four architectural shelter kits, relocated into the new river.
// Their collision, visual shells, checkpoints and release cradles move together.
function relocateShelter(source:CustomComponent,index:number):CustomComponent {
 const from=RUMBLEWATER_REFUGES[index],to=RIPCORD_REFUGES[index],delta=to.checkpoint-from.checkpoint;
 const transform=(q:Point):Point=>{
  const s=rumbleProgress(q),c=rumblePoint(s),d=rumbleTangent(s),u=(q[0]-c[0])*-d[2]+(q[2]-c[2])*d[0];
  return ripcordPoint(s+delta,ripcordHeight(s+delta)+q[1]-rumbleHeight(s),u*1.3);
 };
 const c=structuredClone(source),p=transform(c.p),oldYaw=(c.yaw??0)*Math.PI/180;
 const yaw=(c.yaw??0)-rumbleYaw(rumbleProgress(c.p))+ripcordYaw(ripcordProgress(p)),angle=yaw*Math.PI/180;
 const world=(x:number,y:number,z:number):Point=>[c.p[0]+x*Math.cos(oldYaw)+z*Math.sin(oldYaw),c.p[1]+y,c.p[2]-x*Math.sin(oldYaw)+z*Math.cos(oldYaw)];
 const local=(q:Point):Point=>{const x=q[0]-p[0],z=q[2]-p[2];return [round(x*Math.cos(angle)-z*Math.sin(angle)),round(q[1]-p[1]),round(x*Math.sin(angle)+z*Math.cos(angle))];};
 if(c.vertices){
  const scale=c.s??[1,1,1],vertices:number[]=[];
  for(let i=0;i<c.vertices.length;i+=3)vertices.push(...local(transform(world(c.vertices[i]*scale[0],c.vertices[i+1]*scale[1],c.vertices[i+2]*scale[2]))));
  c.vertices=vertices;delete c.s;
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));if(c.indices)g.setIndex(c.indices);g.computeVertexNormals();c.normals=Array.from(g.getAttribute('normal').array).map(round);g.dispose();
 }else if(c.s){const d=oldYaw-rumbleYaw(rumbleProgress(c.p))*Math.PI/180;
  c.s=[round(c.s[0]*Math.hypot(1.3*Math.cos(d),Math.sin(d))),c.s[1],round(c.s[2]*Math.hypot(1.3*Math.sin(d),Math.cos(d)))];}
 if(c.pts)c.pts=c.pts.map(q=>{const v=local(transform(world(q[0],q[3]??0,q[1])));return[v[0],v[2],q[2]??0,v[1]];});
 if(c.to)c.to=transform(c.to);c.p=p;c.yaw=yaw;c.nm=c.nm?.replace(from.name,to.name);return c;
}
for(let i=0;i<4;i++)C.push(...RUMBLEWATER_RUN_LEVEL.components.filter(c=>c.grp===110+i).map(c=>relocateShelter(c,i)));

// Retain the river's established art vocabulary around the new centreline.
const artSampler={point:(s:number,y=ripcordHeight(s),u=0)=>ripcordPoint(s,y,u*1.3),height:ripcordHeight};
const artBanks=RIPCORD_BANKS.map(b=>({...b,width:(s:number)=>val(b.width,s)/1.3,offset:(s:number)=>val(b.offset,s)/1.3}));
const retired=new Set(['Grounded aqueduct pier','Aqueduct bearing collar','Flooded district threshold','Submerged downstream aqueduct remnant']);
C.push(...rumblewaterArt(artSampler,artBanks,ripcordYaw,RIPCORD_END,RIPCORD_REFUGES.map(r=>r.checkpoint))
 .filter(c=>ripcordProgress(c.p)<=RIPCORD_END+44&&!retired.has(c.nm??''))
 .map(c=>c.t==='pit'&&c.s?{...c,s:[c.s[0]*1.3,c.s[1],c.s[2]] as Point}:c));
for(let s=RIPCORD_END+44;s>=-64;s-=8)C.push({t:'camnode',p:ripcordPoint(s),grp:1,nm:'Camera-facing river escape'});
C.push({t:'pit',p:[0,-85,-RIPCORD_END/2],s:[468,1,RIPCORD_END+180],invisible:true,nm:'Ripcord gorge reset'});
const oldChase=RUMBLEWATER_RUN_LEVEL.boulderChase!;
const forkPaths=[-1,1].map(side=>Array.from({length:161},(_,i)=>{const s=410+320*i/160;return ripcordPoint(s,ripcordHeight(s),twinLane(s,side));}));
export const RIPCORD_RIVER_LEVEL:CustomLevelData={...structuredClone(RUMBLEWATER_RUN_LEVEL),name:'Ripcord River',spawn:ripcordPoint(0,ripcordHeight(0)+.12),components:C,
 groups:[{id:1,nm:'River camera',editorOnly:true},...RIPCORD_SECTIONS.map(s=>({id:s.grp,nm:s.name,editorOnly:true})),
  ...RIPCORD_REFUGES.map(r=>({id:r.grp,nm:r.name,editorOnly:true})),...RUMBLEWATER_ART_GROUPS],
 medalTimes:{gold:96,silver:118,bronze:146},
 boulderChase:{...structuredClone(oldChase),speed:oldChase.speed*.85,paces:oldChase.paces!.slice(0,5).map(n=>n*.85),
  path:Array.from({length:501},(_,i)=>ripcordPoint(-58+(RIPCORD_BOULDER_END+58)*i/500)),forks:[{paths:forkPaths}],
  shelters:RIPCORD_REFUGES.map(r=>({entry:ripcordPoint(r.entry),exit:ripcordPoint(r.exit)}))},
};

// Preserve the entire previous course and its timing under a separate identity.
// Atmosphere overrides are explicit because the original warm lighting would
// otherwise override the night preset even with a night sky selected.
export const ROLLING_BONES_LEVEL:CustomLevelData={...structuredClone(RUMBLEWATER_RUN_LEVEL),name:'Rolling Bones',sky:'night',
  atmosphere:{...RUMBLEWATER_RUN_LEVEL.atmosphere,fogColor:'#172640',fogNear:65,fogFar:190,
    ambientSky:'#819dc7',ambientGround:'#28344b',ambientIntensity:1.05,
    sunColor:'#adcaff',sunIntensity:1.15,fillColor:'#557db6',fillIntensity:.42,drawDistance:250,shadowStrength:.6},
};

dressRollingBones(ROLLING_BONES_LEVEL);
