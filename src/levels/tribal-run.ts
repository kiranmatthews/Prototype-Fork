import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {dressTribalRun} from './tribal-run-art';
import {encloseTribalRun} from './tribal-run-enclosure';
import {tribalPoint as point,tribalTangent as tangent,tribalYaw as yaw,tribalRibbon,tribalMix as mix,tribalSmooth as smooth,type TribalScalar,TRIBAL_RUN_LENGTH} from './tribal-run-route';
export {tribalPoint,tribalTangent,tribalYaw,tribalProgress,TRIBAL_RUN_LENGTH} from './tribal-run-route';

export const TRIBAL_RUN_SECTIONS=[
 {a:0,b:260,name:'Gathering Ground',verb:'Catch the timber ferry'},
 {a:260,b:530,name:'Offbeat Steps',verb:'Match the rising drum decks'},
 {a:530,b:830,name:'Crescent Basins',verb:'Cross the river bends'},
 {a:830,b:1110,name:'Great Drum Court',verb:'Break through the ambush'},
 {a:1110,b:1390,name:'Canopy Loom',verb:'Ride the woven rafts'},
 {a:1390,b:1660,name:'Sunken Stair',verb:'Time the climbing platforms'},
 {a:1660,b:2010,name:'Echo Bowls',verb:'Keep moving through the bush'},
 {a:2010,b:2330,name:'Last Chorus',verb:'Cross the final river gauntlet'},
].map((s,i)=>({...s,grp:10+i}));
const C:CustomComponent[]=[],group=(s:number)=>TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)?.grp??17;
const groups:CustomGroup[]=TRIBAL_RUN_SECTIONS.map(s=>({id:s.grp,nm:s.name,editorOnly:true}));
groups.push({id:1,nm:'Ordered bush-corridor camera',editorOnly:true},{id:2,nm:'River reset floor',editorOnly:true});
const profile=[[0,0],[480,0],[580,-2.6],[730,-2.6],[820,0],[1100,0],[1190,2.4],[1300,0],[1390,0],[1510,4.8],[1575,4.8],[1650,-1],[2010,-1],[2135,2.3],[2210,0],[2334,0]];
export function tribalHeight(s:number):number{
 for(let i=1;i<profile.length;i++)if(s<=profile[i][0]){const a=profile[i-1],b=profile[i];return mix(a[1],b[1],smooth((s-a[0])/(b[0]-a[0])));}return 0;
}
export const tribalBraid=(_side:number)=>(_s:number)=>0;
export const tribalLoomHeight=tribalHeight;
export const TRIBAL_RUN_ROADS:{a:number;b:number;top:TribalScalar;width:TribalScalar;offset:TribalScalar;name:string}[]=[];
export const TRIBAL_RUN_GAPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_STEPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_CHECKPOINTS:{s:number;y:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_CROSSINGS=[
 [88,120],[202,234],[278,312],[352,386],[432,466],
 [550,584],[622,656],[700,734],[770,802],[858,890],[930,962],
 [1046,1074],[1128,1160],[1194,1226],[1256,1288],[1320,1352],
 [1412,1444],[1464,1496],[1540,1574],[1604,1636],[1690,1724],
 [1754,1788],[1824,1858],[1888,1922],[1950,1982],
 [2030,2064],[2092,2126],[2154,2188],[2238,2272],
].map(([a,b],i)=>({a,b,kind:i%5===2?'lifts':i%5===4?'orbit':'ferry',name:'River crossing '+(i+1),movers:[] as string[]}));
const road=(a:number,b:number)=>{
 const width:TribalScalar=s=>mix(13+2*Math.sin(Math.PI*s/130)**2,28,smooth((s-962)/16)*smooth((1046-s)/16))+(s>2272?3*smooth((s-2272)/12):0);
 const name=TRIBAL_RUN_SECTIONS.find(q=>a>=q.a&&a<q.b)?.name+' · safe bush landing';
 C.push(...tribalRibbon(a,b,tribalHeight,width,0,group(a),name,undefined,5));TRIBAL_RUN_ROADS.push({a,b,top:tribalHeight,width,offset:0,name});
};
let edge=-18;
for(const cross of TRIBAL_RUN_CROSSINGS){road(edge,cross.a);edge=cross.b;
 TRIBAL_RUN_GAPS.push({a:cross.a,b:cross.b,top:tribalHeight((cross.a+cross.b)/2),u:0,name:cross.name});
 const centre=(cross.a+cross.b)/2,d=tangent(centre),axis=Math.abs(d[0])>Math.abs(d[2])?'x':'z',length=cross.b-cross.a;
 const add=(s:number,y:number,index:number,extra:Partial<CustomComponent>)=>{
  const name=cross.name+' · '+cross.kind+' '+index;cross.movers.push(name);
  C.push({t:'mover',p:point(s,y),s:[12,1,12],yaw:yaw(s),axis,amp:length/2-7,speed:.58,phase:Math.PI/2,
   travelSign:(axis==='x'?d[0]:d[2])<0?-1:1,tex:'creek-raft',color:'#bb8750',grp:group(s),nm:name,...extra});
 };
 if(cross.kind==='lifts'){
  add(cross.a+9,tribalHeight(cross.a)+.15,1,{axis:'y',amp:1.15,speed:.9,phase:0,s:[12,1,12]});
  add(cross.b-9,tribalHeight(cross.b)+.15,2,{axis:'y',amp:1.15,speed:.9,phase:Math.PI,s:[12,1,12]});
 }else if(cross.kind==='orbit'){
  add(centre,tribalHeight(centre),1,{axis:'y',amp:0,speed:.52,phase:0,orbit:axis==='x'?[8,3.2]:[3.2,8],s:[13,1,16]});
 }else {
  // The native X-axis sine and orbit's Z sine share a phase. Together they
  // make a straight ferry aligned to this bend, without a new motion system.
  const travel=length/2-7,orientation=d[2]<0?-1:1;
  add(centre,tribalHeight(centre),1,{axis:'x',amp:Math.abs(d[0])*travel,travelSign:d[0]*orientation<0?-1:1,phase:orientation*Math.PI/2,orbit:[0,Math.abs(d[2])*travel]});
 }
 for(const s of [cross.a-4,cross.b+4])C.push({t:'wumpa',p:point(s,tribalHeight(s)+1.15),grp:group(s),nm:cross.name+' · boarding marker'});
}
road(edge,2334);
// Every restart is on a fixed, generous landing; authoring order follows travel.
for(const s of [250,518,824,1088,1380,1508,1650,1994,2218]){
 const y=tribalHeight(s),name=TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)?.name+' · safe restart';
 C.push({t:'checkpoint',p:point(s,y),grp:group(s),nm:name});TRIBAL_RUN_CHECKPOINTS.push({s,y,u:0,name});
}
const crate=(s:number,u=0,kind:CustomComponent['kind']='wood',name='Bush-corridor supplies')=>C.push({t:'crate',p:point(s,tribalHeight(s),u),kind,grp:group(s),nm:name});
for(const r of TRIBAL_RUN_ROADS){
 if(r.b-r.a<17)continue;
 const mid=(r.a+r.b)/2;crate(mid,-3.8);if(r.b-r.a>32)crate(mid+5,3.7,'mystery');
}
for(const s of [48,498,1008,1370,1646,2205])crate(s,4.2,'mask','Mask before the next moving-platform stretch');
C.push({t:'clock',p:point(9,0,4.5),grp:10,nm:'Optional time trial'},
 {t:'bonusplatform',p:point(986,0,7.5),to:point(1002,.12,7.5),grp:13,nm:'The Resonance Vault entrance'},
 {t:'crystal',p:point(2289,1.1),grp:17,nm:'The festival crystal'},
 {t:'gate',p:point(2310,0),yaw:yaw(2310),grp:17,nm:'Tribal Run finish'});
// Uga Isles crab patrols wear wooden war masks. Keep the first eight metres of
// every landing clear, and give checkpoint boxes room for a safe restart.
let enemies=0;
for(const r of TRIBAL_RUN_ROADS){
 const length=r.b-r.a;if(r.a<115||length<20)continue;
 const candidates=length>43?[r.a+13,r.b-13]:[(r.a+r.b)/2];
 for(const s of candidates){
  if(s>2275||TRIBAL_RUN_CHECKPOINTS.some(cp=>Math.abs(cp.s-s)<8)||Math.abs(s-986)<12)continue;
  const d=tangent(s),patrolYaw=Math.abs(d[0])>Math.abs(d[2])?90:0;
  C.push({t:'enemy',foe:'grunt',p:point(s,tribalHeight(s),enemies%2?2.8:-2.8),range:2.6,speed:2.2+(enemies%3)*.35,yaw:patrolYaw,
   tex:'tribal-weave',terrainSupports:true,grp:group(s),nm:'Masked tribal crab patrol '+(++enemies)});
 }
}
// Ranged pressure comes from carved fire heads set well to the side of dry
// ground. Their sweep crosses the approach, never the checkpoint spawn.
export const TRIBAL_RUN_AMBUSHES=[[186,1],[414,-1],[606,1],[907,-1],[1310,1],[1674,-1],[1808,1],[2142,-1]];
for(const [s,side]of TRIBAL_RUN_AMBUSHES){
 const y=tribalHeight(s),p=point(s,y,side*8.3);
 C.push({t:'platform',p:[p[0],y-1,p[2]],s:[5,2,6],yaw:yaw(s),tex:'tribal-sunstone',color:'#d5c59b',grp:group(s),nm:'Carved fire-head side plinth'},
  {t:'firetiki',p,yaw:yaw(s)-side*90,w:.9,amp:24,range:11,cycle:5.8,phase:s*.07,grp:group(s),nm:'Tribal fire-head ambush'});
}
const all=Array.from({length:117},(_,i)=>point(i*20)),xs=all.map(p=>p[0]),zs=all.map(p=>p[2]);
const minX=Math.min(...xs)-45,maxX=Math.max(...xs)+45,minZ=Math.min(...zs)-45,maxZ=Math.max(...zs)+45;
C.push({t:'pit',p:[(minX+maxX)/2,-11,(minZ+maxZ)/2],s:[maxX-minX,1,maxZ-minZ],invisible:true,grp:2,nm:'River contact reset'});
for(let s=-18;s<=TRIBAL_RUN_LENGTH+20;s+=8)C.push({t:'camnode',p:point(s,tribalHeight(s)+.8),grp:1,nm:'Ordered enclosed river camera'});
export const TRIBAL_RUN_LEVEL:CustomLevelData={v:1,crateLayoutRevision:1,name:'Tribal Run',spawn:point(0,.12),startWarpPad:false,killY:-24,fallRecoveryDrop:15,
 sky:'day',cameraAirLift:.65,cameraLookAhead:7,medalTimes:{gold:360,silver:440,bronze:540},groups,components:C};
dressTribalRun(TRIBAL_RUN_LEVEL,{roads:TRIBAL_RUN_ROADS,steps:TRIBAL_RUN_STEPS,checkpoints:TRIBAL_RUN_CHECKPOINTS});
encloseTribalRun(TRIBAL_RUN_LEVEL,TRIBAL_RUN_ROADS,tribalHeight);
