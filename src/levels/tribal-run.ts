import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {dressTribalRun} from './tribal-run-art';
import {encloseTribalRun} from './tribal-run-enclosure';
import {tribalDrum} from './tribal-run-drums';
import {tribalPoint as point,tribalTangent as tangent,tribalYaw as yaw,tribalRibbon,tribalMix as mix,tribalSmooth as smooth,type TribalScalar,TRIBAL_RUN_LENGTH} from './tribal-run-route';
export {tribalPoint,tribalTangent,tribalYaw,tribalProgress,TRIBAL_RUN_LENGTH} from './tribal-run-route';

export const TRIBAL_RUN_SECTIONS=[
 {a:0,b:260,name:'Rootstep Rise',verb:'Climb the roots, catch the ferry, grind the ridge'},
 {a:260,b:530,name:'Rainwash Chutes',verb:'Slide the moss, brake on dry stone, jump the river'},
 {a:530,b:830,name:'Crosscurrent Drums',verb:'Jump across the current and back again'},
 {a:830,b:1110,name:'Great Drum Court',verb:'Climb the bank and break through the ambush'},
 {a:1110,b:1390,name:'Canopy Weave',verb:'Rise into the canopy on offset moving decks'},
 {a:1390,b:1660,name:'Sunken Stair',verb:'Slide into the basin, climb the alternating lifts'},
 {a:1660,b:2010,name:'Echo Switchbacks',verb:'Link slopes, rails and side-to-side jumps'},
 {a:2010,b:2334,name:'Last Chorus',verb:'Combine the climbs, slides and final rail transfer'},
].map((s,i)=>({...s,grp:10+i}));
const C:CustomComponent[]=[],group=(s:number)=>TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)?.grp??17;
const groups:CustomGroup[]=TRIBAL_RUN_SECTIONS.map(s=>({id:s.grp,nm:s.name,editorOnly:true}));
groups.push({id:1,nm:'Steady river-axis camera',editorOnly:true},{id:2,nm:'River reset floor',editorOnly:true});
// Metres, not a visual displacement: the collision, artwork and approach
// markers all sample the same profile. Restart platforms have level shoulders.
export const TRIBAL_HEIGHT_PROFILE=[
 [0,0],[18,0],[62,7],[120,7],[155,2],[182,10],[264,10],
 [288,16],[300,16],[340,-2],[378,-2],[410,7],[440,7],[478,-4],[500,-4],[510,1],[530,1],
 [555,1],[590,3],[630,6],[664,9],[690,12],[750,12],[780,4],[836,4],
 [862,12],[902,12],[942,0],[1030,0],[1076,6],[1110,6],
 [1134,10],[1166,10],[1212,17],[1240,17],[1274,22],[1308,22],[1350,12],[1390,12],
 [1412,18],[1452,18],[1482,4],[1518,4],[1540,9],[1592,9],[1630,1],[1660,1],
 [1686,7],[1710,7],[1748,1],[1785,1],[1820,12],[1850,12],[1885,3],[1920,3],[1952,14],[1980,14],[1986,8],[2016,8],
 [2072,18],[2102,18],[2154,5],[2172,5],[2210,12],[2240,12],[2280,6],[2334,6],
];
const offsetProfile=[
 [0,0],[120,0],[148,5],[176,-5],[198,-4],[236,0],[260,0],
 [284,-5],[360,-5],[378,0],[402,0],[440,-4],[478,4],[506,0],[530,0],
 [555,-8],[568,-8],[642,8],[668,-9],[690,-9],[750,9],[780,-4],[798,-4],[824,0],
 [862,0],[902,0],[930,5],[962,0],[1010,0],[1030,-6],[1068,6],[1088,0],
 [1134,0],[1166,0],[1178,-10],[1234,10],[1260,0],[1284,-9],[1340,9],[1380,0],
 [1420,0],[1452,0],[1490,-4],[1498,-4],[1508,0],[1540,6],[1560,0],[1592,0],[1620,-5],[1650,0],
 [1686,-6],[1738,6],[1770,-6],[1808,0],[1840,0],[1885,4],[1910,4],[1944,-8],[1980,8],[1994,0],
 [2048,-6],[2098,6],[2120,-4],[2180,0],[2210,0],[2246,-6],[2280,6],[2300,0],[2334,0],
];
function sample(knots:number[][],s:number):number{
 if(s<=knots[0][0])return knots[0][1];
 for(let i=1;i<knots.length;i++)if(s<=knots[i][0]){const a=knots[i-1],b=knots[i];return mix(a[1],b[1],smooth((s-a[0])/(b[0]-a[0])));}
 return knots[knots.length-1][1];
}
export const tribalHeight=(s:number)=>sample(TRIBAL_HEIGHT_PROFILE,s);
export const tribalOffset=(s:number)=>sample(offsetProfile,s);
export const tribalBraid=(_side:number)=>tribalOffset;
export const tribalLoomHeight=tribalHeight;
export const TRIBAL_RUN_ROADS:{a:number;b:number;top:TribalScalar;width:TribalScalar;offset:TribalScalar;name:string;wet?:boolean}[]=[];
export const TRIBAL_RUN_GAPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_STEPS:{a:number;b:number;top:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_CHECKPOINTS:{s:number;y:number;u:number;name:string}[]=[];
export const TRIBAL_RUN_SLIDES=[[300,340],[440,462],[1452,1472],[1712,1746],[1854,1883],[2108,2154]];
type CrossKind='ferry'|'lifts'|'orbit'|'weave'|'rail'|'jump';
type Crossing={a:number;b:number;kind:CrossKind;name:string;movers:string[];rail?:string;waypoints?:[number,number,number][]};
export const TRIBAL_RUN_CROSSINGS:Crossing[]=[
 [88,120,'ferry','Root ferry'],[198,236,'rail','Root ridge grind'],
 [366,371.5,'jump','Rainwash lip jump'],[402,430,'lifts','Basin lift pair'],[478,498,'orbit','Rainwash turning raft'],
 [568,642,'weave','Crosscurrent stepping drums'],[690,750,'rail','Cross-river vine rail'],[790,795,'jump','Fern-bank gap'],
 [870,902,'ferry','High-bank ferry'],[1030,1068,'rail','Drum-court climbing rail'],
 [1134,1164,'lifts','Canopy entry lifts'],[1178,1234,'weave','Canopy crossing weave'],[1284,1340,'rail','Canopy descent rail'],
 [1420,1452,'ferry','Sunken stair ferry'],[1490,1495,'jump','Basin stone jump'],[1560,1590,'lifts','Sunken stair lifts'],
 [1686,1738,'rail','Echo ridge rail'],[1816,1838,'orbit','Echo turning drum'],[1902,1907,'jump','Echo bank jump'],[1944,1980,'weave','High drum switchback'],
 [2048,2098,'rail','Last chorus ascent'],[2180,2210,'lifts','Final rising drums'],[2246,2280,'rail','Festival finish grind'],
].map(([a,b,kind,name])=>({a:a as number,b:b as number,kind:kind as CrossKind,name:name as string,movers:[]}));
const road=(a:number,b:number)=>{
 const cuts=[a,b,...TRIBAL_RUN_SLIDES.flat().filter(s=>s>a&&s<b)].sort((x,y)=>x-y);
 for(let i=1;i<cuts.length;i++){
  const lo=cuts[i-1],hi=cuts[i],wet=TRIBAL_RUN_SLIDES.some(([a,b])=>(lo+hi)/2>=a&&(lo+hi)/2<=b);
  const width:TribalScalar=s=>{
   const chute=TRIBAL_RUN_SLIDES.reduce((w,[a,b])=>Math.max(w,smooth((s-a+10)/10)*smooth((b+50-s)/24)),0);
   const apron=TRIBAL_RUN_CROSSINGS.filter(c=>c.kind==='rail').reduce((w,c)=>Math.max(w,smooth((s-c.b+8)/8)*smooth((c.b+64-s)/24)),0);
   const road=mix(10.5+1.8*Math.sin(s/38)**2,25,chute);
   return mix(mix(mix(road,26,smooth((s-950)/12)*smooth((1028-s)/12)),18,smooth((s-2280)/12)),26,apron);
  };
  const section=TRIBAL_RUN_SECTIONS.find(q=>lo>=q.a&&lo<q.b)?.name??'Rootstep Rise';
  const name=section+' · '+(wet?'wet moss chute':'rooted climbing path');
  const surfaces=tribalRibbon(lo,hi,tribalHeight,width,tribalOffset,group(lo),name,undefined,4.5);
  for(const c of surfaces)Object.assign(c,{tex:wet?'tribal-wet-moss':'tribal-sunstone',color:wet?'#9cbda2':'#dfdcc3',...(wet?{slip:true,iceGrip:.02,slipGravity:1}:{})});
  C.push(...surfaces);TRIBAL_RUN_ROADS.push({a:lo,b:hi,top:tribalHeight,width,offset:tribalOffset,name,wet});
 }
};
function grind(cross:Crossing){
 const {a,b}=cross,origin=point(a-4,tribalHeight(a)+.75,tribalOffset(a)),pts:[number,number,number,number][]=[];
 for(let s=a-4;s<=b+4+.01;s+=2){const t=(s-a)/(b-a),u=mix(tribalOffset(a),tribalOffset(b),smooth(t)),y=mix(tribalHeight(a),tribalHeight(b),smooth(t))+.75;
  const p=point(s,y,u);pts.push([p[0]-origin[0],p[2]-origin[2],0,p[1]-origin[1]]);}
 cross.rail=cross.name;C.push({t:'rail',p:origin,pts,color:'#d1a45e',grp:group(a),nm:cross.name});
 cross.waypoints=[[a-5,tribalHeight(a),tribalOffset(a)],[b+5,tribalHeight(b),tribalOffset(b)]];
 for(const s of [a-3,b+3]){const u=tribalOffset(s),y=tribalHeight(s);
  C.push({t:'decor',dkind:'stonebase',p:point(s,y-1.8,u),s:[2.5,1.8,2.5],yaw:yaw(s),solid:false,scenerySolid:false,grp:group(s),nm:cross.name+' · carved rail anchor'});}
 for(let s=a+3;s<b;s+=8)C.push({t:'wumpa',p:point(s,mix(tribalHeight(a),tribalHeight(b),smooth((s-a)/(b-a)))+1.8,mix(tribalOffset(a),tribalOffset(b),smooth((s-a)/(b-a)))),grp:group(a),nm:cross.name+' · grind line fruit'});
}
let edge=-18;
for(const [ci,cross]of TRIBAL_RUN_CROSSINGS.entries()){
 road(edge,cross.a);edge=cross.b;
 const {a,b}=cross,centre=(a+b)/2,d=tangent(centre),length=b-a;
 TRIBAL_RUN_GAPS.push({a,b,top:tribalHeight(centre),u:tribalOffset(centre),name:cross.name});
 if(cross.kind==='rail'){grind(cross);continue;}
 if(cross.kind==='jump'){cross.waypoints=[[a-1.5,tribalHeight(a),tribalOffset(a)],[b+2,tribalHeight(b),tribalOffset(b)]];continue;}
 const add=(s:number,y:number,u:number,w:number,depth:number,extra:Partial<CustomComponent>)=>{
  const name=cross.name+' · moving drum '+(cross.movers.length+1);cross.movers.push(name);
  C.push({t:'mover',p:point(s,y,u),s:[w,1.2,depth],yaw:yaw(s),axis:'y',amp:.8,speed:.72,phase:ci*.7,
   tex:'creek-raft',color:'#b78b52',grp:group(s),nm:name,
   ...(['weave','orbit'].includes(cross.kind)?tribalDrum(w,depth):{}),...extra});
 };
 if(cross.kind==='weave'){
  const sites=cross.a===568?[[574,1.5,-8],[584,2.8,2],[594,4.1,-5],[604,5.4,5],[614,6.7,-5],[624,7.5,3],[636,7.2,8]]:
   cross.a===1178?[[1184,11.5,-10],[1195,13,-2],[1206,14.6,7],[1217,16.1,-2],[1228,17,8]]:
   [[1950,13,-8],[1962,14.2,0],[1974,14,8]];
  cross.waypoints=sites as [number,number,number][];
  for(const [i,[s,y,u]]of sites.entries())add(s,y,u,11+(i%2),12,{amp:.65+(i%2)*.25,speed:.82,phase:i*Math.PI*.65});
 }else if(cross.kind==='lifts'){
  if(a===2180){
   for(const [i,s]of [a+5.5,a+15,b-5.5].entries())add(s,mix(tribalHeight(a),tribalHeight(b),i/2)+.3,tribalOffset(s),11,7,{amp:1.2,speed:.7,phase:i*Math.PI*.7});
  }else{
   add(a+7.5,tribalHeight(a)+.6,tribalOffset(a),11,12,{amp:1.25,speed:.85,phase:0});
   add(b-7.5,tribalHeight(b)+.3,tribalOffset(b),10.5,12,{amp:1.25,speed:.85,phase:Math.PI});
  }
 }else if(cross.kind==='orbit'){
  const axis=Math.abs(d[0])>Math.abs(d[2])?'x':'z';
  add(centre,tribalHeight(centre)+.3,tribalOffset(centre),13,16,{amp:.5,speed:.52,phase:0,orbit:axis==='x'?[6,2.4]:[2.4,6]});
 }else{
  const travel=length/2-7,orientation=d[2]<0?-1:1;
  add(centre,tribalHeight(centre),tribalOffset(centre),12,14,{axis:'x',amp:Math.abs(d[0])*travel,travelSign:d[0]*orientation<0?-1:1,phase:orientation*Math.PI/2,orbit:[0,Math.abs(d[2])*travel],speed:.62});
 }
 for(const s of [a-4,b+4])C.push({t:'wumpa',p:point(s,tribalHeight(s)+1.1,tribalOffset(s)),grp:group(s),nm:cross.name+' · approach marker'});
}
road(edge,2334);
for(const s of [250,518,824,1088,1380,1508,1650,1994,2218]){
 const y=tribalHeight(s),u=tribalOffset(s),name=TRIBAL_RUN_SECTIONS.find(q=>s>=q.a&&s<q.b)!.name+' · dry restart';
 C.push({t:'checkpoint',p:point(s,y,u),grp:group(s),nm:name});TRIBAL_RUN_CHECKPOINTS.push({s,y,u,name});
}
const crate=(s:number,u=0,kind:CustomComponent['kind']='wood',name='Island guardian supplies')=>C.push({t:'crate',p:point(s,tribalHeight(s),tribalOffset(s)+u),kind,grp:group(s),nm:name});
for(const s of [30,139,173,274,384,441,515,548,663,770,840,921,974,1008,1107,1255,1364,1403,1527,1610,1668,1769,1871,1928,2010,2121,2232,2299]){
 if(TRIBAL_RUN_SLIDES.some(([a,b])=>s>=a&&s<=b))continue;
 crate(s,-3.6);if(s%3===0)crate(s+3,3.7,'mystery');
}
for(const s of [70,264,538,957,1118,1397,1666,2020,2234])crate(s,3.7,'mask','Mask before the next platforming phrase');
const finishRail=TRIBAL_RUN_CROSSINGS[TRIBAL_RUN_CROSSINGS.length-1],crystalStation=2273,crystalT=smooth((crystalStation-finishRail.a)/(finishRail.b-finishRail.a));
C.push({t:'clock',p:point(9,0,4.5),grp:10,nm:'Optional time trial'},
 {t:'bonusplatform',p:point(986,0,7.5),to:point(1002,.12,7.5),grp:13,nm:'The Resonance Vault entrance'},
 {t:'crystal',p:point(crystalStation,mix(tribalHeight(finishRail.a),tribalHeight(finishRail.b),crystalT)+1.85,mix(tribalOffset(finishRail.a),tribalOffset(finishRail.b),crystalT)),grp:17,nm:'Festival crystal · final grind line'},
 {t:'gate',p:point(2310,6),yaw:yaw(2310),grp:17,nm:'Tribal Run finish'});
// Guardians patrol dry supported shoulders. Never place a patrol directly on
// a launch, a receiver, a wet chute, or a checkpoint's restart footprint.
let enemies=0;
for(const s of [41,61,137,162,181,271,291,385,418,434,514,544,657,676,763,778,844,858,916,939,973,1013,1102,1120,1250,1268,1358,1370,1400,1460,1526,1546,1606,1624,1670,1759,1779,1868,1926,1934,2010,2028,2118,2166,2230,2298]){
 if(TRIBAL_RUN_SLIDES.some(([a,b])=>s>=a&&s<=b+25)||TRIBAL_RUN_CHECKPOINTS.some(cp=>Math.abs(cp.s-s)<8))continue;
 if(TRIBAL_RUN_CROSSINGS.some(c=>c.kind==='rail'&&s>c.b&&s<c.b+20))continue;
 const r=TRIBAL_RUN_ROADS.find(r=>s>r.a+6&&s<r.b-6);if(!r)continue;
 const d=tangent(s),patrolYaw=Math.abs(d[0])>Math.abs(d[2])?90:0;
 C.push({t:'enemy',foe:'grunt',p:point(s,tribalHeight(s),tribalOffset(s)+(enemies%2?2.2:-2.2)),range:2,speed:2.2+(enemies%3)*.3,yaw:patrolYaw,
  tex:'tribal-weave',terrainSupports:true,grp:group(s),nm:'Island guardian patrol '+(++enemies)});
}
export const TRIBAL_RUN_AMBUSHES=[[168,1],[388,-1],[674,1],[931,-1],[1400,1],[1620,-1],[1774,1],[2020,-1]];
for(const [s,side]of TRIBAL_RUN_AMBUSHES){
 const y=tribalHeight(s),p=point(s,y,tribalOffset(s)+side*9.5);
 C.push({t:'platform',p:[p[0],y-1,p[2]],s:[4,2,5],yaw:yaw(s),tex:'tribal-sunstone',color:'#d5c59b',grp:group(s),nm:'Carved fire-head side plinth'},
  {t:'firetiki',p,yaw:yaw(s)-side*90,w:.9,amp:18,range:10,cycle:6.5,phase:s*.07,grp:group(s),nm:'Tribal fire-head ambush'});
}
const all=Array.from({length:117},(_,i)=>point(i*20)),xs=all.map(p=>p[0]),zs=all.map(p=>p[2]);
const minX=Math.min(...xs)-55,maxX=Math.max(...xs)+55,minZ=Math.min(...zs)-55,maxZ=Math.max(...zs)+55;
C.push({t:'pit',p:[(minX+maxX)/2,-11,(minZ+maxZ)/2],s:[maxX-minX,1,maxZ-minZ],invisible:true,grp:2,nm:'River contact reset'});
// The camera follows the river, not each lateral stepping stone. A lower
// jump-follow weight keeps ordinary hops from pumping the whole shot.
for(let s=-18;s<=TRIBAL_RUN_LENGTH+20;s+=8)C.push({t:'camnode',p:point(s,tribalHeight(s)+.8),grp:1,nm:'Ordered steady river camera'});
export const TRIBAL_RUN_LEVEL:CustomLevelData={v:1,crateLayoutRevision:1,name:'Tribal Run',spawn:point(0,.12),startWarpPad:false,killY:-24,fallRecoveryDrop:35,
 sky:'day',cameraAirLift:.12,cameraLookAhead:8,cameraRig:{camDist:10.2,camHeight:6.6,camPitch:21,camFov:52},
 medalTimes:{gold:330,silver:410,bronze:510},groups,components:C};
dressTribalRun(TRIBAL_RUN_LEVEL,{roads:TRIBAL_RUN_ROADS,steps:TRIBAL_RUN_STEPS,checkpoints:TRIBAL_RUN_CHECKPOINTS});
encloseTribalRun(TRIBAL_RUN_LEVEL,TRIBAL_RUN_ROADS,tribalHeight);
