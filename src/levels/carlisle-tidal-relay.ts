import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { CONST, TUNING } from '../tuning';
import { buildCarlisleCrossings, type CarlisleRoad } from './carlisle-slippery-crossings';
import { fitCarlisleDeckBerths } from './carlisle-deck-surfaces';
import { buildCarlisleCargo, CARLISLE_CARGO_GAPS } from './carlisle-cargo';
type P=[number,number,number];
type Station=[number,number,number?];
const C:CustomComponent[]=[],groups:CustomGroup[]=[];
const roads:CarlisleRoad[]=[];
const GREY='#aeb5b9',PALE='#d2d4d1',DARK='#56626a',SPRING='#cbaa72',MACHINE='#829da5';
// One 4,000m surveyed coastline, shared by decks, cliffs, cameras and controls.
const raw=Array.from({length:801},(_,i)=>{const z=i*5;return [110*Math.sin(z/330)+28*Math.sin(z/115),-z] as [number,number];});
const measure=[0];for(let i=1;i<raw.length;i++)measure.push(measure[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][1]-raw[i-1][1]));
const factor=4000/measure[measure.length-1];
const survey=raw.map((p,i)=>({s:measure[i]*factor,x:p[0]*factor,z:p[1]*factor}));
function frame(s:number){let lo=0,hi=survey.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(survey[m].s<s)lo=m;else hi=m;}
 const a=survey[lo],b=survey[hi],t=(s-a.s)/(b.s-a.s),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
 return{x:a.x+dx*t,z:a.z+dz*t,tx:dx/len,tz:dz/len,yaw:Math.atan2(-dx,-dz)*180/Math.PI};}
let elevation=(_s:number)=>0;
export function carlislePoint(s:number,y:number,u=0):P{const f=frame(s);return[f.x-f.tz*u,y+elevation(s),f.z+f.tx*u];}
const point=(v:Station)=>carlislePoint(...v);
export const CARLISLE_RELAY_LENGTH=4000;
export const CARLISLE_RELAY_ACTS=[
 {name:'I · THE BREAKWATER',from:0,to:1280,idea:'Learn the springs, weave through the groynes, climb the lighthouse.'},
 {name:'II · THE TIDAL ENGINE',from:1280,to:2700,idea:'Orbiting docks, opposing rotors and an open spring-terrace climb.'},
 {name:'III · THE STORM CROWN',from:2700,to:4000,idea:'Exposed headlands give way to spring-to-rail catches, charged grind exits and the homeward cable dive.'},
];
export const CARLISLE_RELAY_SECTIONS=[
 ['Foam steps',0,180],['Scissor groyne',180,390],['Lift and skip',390,605],['Surf sockets',605,825],
 ['Twin winches',825,1040],['Beacon chimney',1040,1280],['Tide dial',1280,1510],['Pinwheel handoffs',1510,1745],
 ['Dredger terraces',1745,1980],['Cross-thread springs',1980,2220],['Counterweight stacks',2220,2460],['Harbour scissors',2460,2700],
 ['Storm fingers',2700,2910],['Helical turbine',2910,3130],['Pendulum pier',3130,3350],['Rigging slingshot',3350,3570],
 ['Broken crown',3570,3790],['Homecoming cable',3790,4000],
] as const;
for(const [i,[nm]] of CARLISLE_RELAY_SECTIONS.entries())groups.push({id:i+1,nm:`${String(i+1).padStart(2,'0')} · ${nm}`,editorOnly:true});
groups.push({id:90,nm:'Coastline massing and camera',editorOnly:true});
const group=(s:number)=>{const i=CARLISLE_RELAY_SECTIONS.findIndex(q=>s<q[2]);return i<0?18:i+1;};
export const CARLISLE_RELAY_JUMPS:{name:string;from:Station;to:Station;up:number;moving:boolean;rail?:string}[]=[];
export type CarlisleGrindBeat={name:string;start:Station;launches:string[];rails:{name:string;knots:Station[];popTo?:Station}[];finish:Station;gate?:boolean};
export const CARLISLE_RELAY_GRINDS:CarlisleGrindBeat[]=[];
export const CARLISLE_RELAY_STOPS:{name:string;s:number;y:number;p:P}[]=[];
export const CARLISLE_RELAY_WALK:{name:string;s:number;y:number;u:number;p:P}[]=[];
const add=(c:CustomComponent)=>{C.push(c);return c;};
function box(nm:string,s:number,top:number,w:number,d:number,u=0,h=2,color=GREY){return add({t:'platform',nm,p:carlislePoint(s,top-h/2,u),s:[w,h,d],yaw:frame(s).yaw,tex:'solid',color,grp:group(s)});}
type Value=number|((s:number)=>number);
const val=(v:Value,s:number)=>typeof v==='number'?v:v(s);
function strip(nm:string,a:number,b:number,top:Value,w:Value=14,offset:Value=0,thickness=3,color=GREY,solid=true){
 const count=Math.max(1,Math.ceil((b-a)/7)),origin=carlislePoint(a,val(top,a)),vertices:number[]=[],indices:number[]=[];
 for(let i=0;i<=count;i++){const s=a+(b-a)*i/count,y=val(top,s),u=val(offset,s),half=val(w,s)/2;
  for(const [dy,side] of [[0,-1],[0,1],[-thickness,-1],[-thickness,1]]){const p=carlislePoint(s,y+dy,u+side*half);vertices.push(p[0]-origin[0],p[1]-origin[1],p[2]-origin[2]);}}
 for(let i=0;i<count;i++){const k=i*4;indices.push(k,k+1,k+5,k,k+5,k+4);}const topTriangles=indices.length/3;
 for(let i=0;i<count;i++){const k=i*4;indices.push(k+2,k+6,k+7,k+2,k+7,k+3,k,k+4,k+6,k,k+6,k+2,k+1,k+3,k+7,k+1,k+7,k+5);}
 indices.push(0,2,3,0,3,1,count*4,count*4+1,count*4+3,count*4,count*4+3,count*4+2);
 return add({t:'mesh',nm,p:origin,vertices,indices,grindTopTriangles:topTriangles,solid,...(solid?{solidSides:true}:{}),tex:'solid',color,grp:solid?group(a):90});}
function arrow(s:number,y:number,u=0){const p=carlislePoint(s,y+.025,u),l=carlislePoint(s-1.8,y+.025,u-1),r=carlislePoint(s-1.8,y+.025,u+1),tip=carlislePoint(s+1.4,y+.025,u);
 add({t:'mesh',nm:'Route chevron',p,vertices:[...l.map((v,i)=>v-p[i]),...r.map((v,i)=>v-p[i]),...tip.map((v,i)=>v-p[i])],indices:[0,1,2],tex:'solid',color:PALE,solid:false,doubleSided:true,grp:90});}
function road(nm:string,a:number,b:number,top:Value,w:Value=14,offset:Value=0){const first=C.length;strip(nm,a,b,top,w,offset);strip(`${nm} · cliff`,a,b,s=>val(top,s)-3,s=>val(w,s)+5,offset,24,DARK,false);for(let s=a+10;s<b-4;s+=24)arrow(s,val(top,s),val(offset,s));roads.push({name:nm,a,b,y:top,width:w,offset,components:C.slice(first)});}
function rest(name:string,s:number,y:number,width=22){road(name,s-13,s+19,y,width);CARLISLE_RELAY_STOPS.push({name,s,y,p:carlislePoint(s,y+.12)});if(s>0)add({t:'checkpoint',nm:name,p:carlislePoint(s+7,y),grp:group(s)});}
function walk(name:string,s:number,y:number,u=0){CARLISLE_RELAY_WALK.push({name,s,y,u,p:carlislePoint(s,y,u)});}
function moving(nm:string,s:number,y:number,w:number,d:number,o:Partial<CustomComponent>={},u=0){const a=w/2,b=d/2,h=1.4;
 return add({t:'mover',nm,p:carlislePoint(s,y,u),s:[w,h,d],yaw:frame(s).yaw,axis:'x',amp:0,speed:.45,tex:'solid',color:MACHINE,
 vertices:[-a,-h/2,b,a,-h/2,b,a,h/2,b,-a,h/2,b,-a,-h/2,-b,a,-h/2,-b,a,h/2,-b,-a,h/2,-b],
 indices:[3,2,6,3,6,7,0,4,5,0,5,1,0,1,2,0,2,3,4,7,6,4,6,5,0,3,7,0,7,4,1,5,6,1,6,2],grp:group(s),...o});}
// Authoring measurement only. Emitted pads use native speed/held-Jump values.
// No target, homing, horizontal impulse or custom player physics is shipped.
function flight(up:number,dy:number){let y=0,v=up;for(let n=1;n<1200;n++){const before=y;v=Math.max(-CONST.maxFallSpeed,v-(v>0?TUNING.riseGravity:TUNING.fallGravity)/60);y+=v/60;if(v<0&&y<=dy)return(n-1+(before-dy)/(before-y))/60;}return 20;}
function spring(name:string,from:Station,to:Station,motion?:Partial<CustomComponent>,motionMargin=0){
 const a=point(from),b=point(to),distance=Math.hypot(b[0]-a[0],b[2]-a[2]),dy=b[1]-a[1];let low=Math.sqrt(Math.max(0,2*TUNING.riseGravity*(dy+2))),high=150;
 // Landings can immediately rebound from the back edge. Reserve one pad's
 // half-depth of air-steering time so a linked chain never assumes a
 // perfectly centred takeoff.
 for(let i=0;i<28;i++){const mid=(low+high)/2;if(flight(mid,dy)*TUNING.walkSpeed<distance+7.5+motionMargin)low=mid;else high=mid;}
 const up=Math.round(high/1.25*10)/10;CARLISLE_RELAY_JUMPS.push({name,from,to,up,moving:!!motion});
 // A 2 cm top offset wins coplanar support ties without creating a curb
 // that trips a rolling board. Both trampoline and mover primitives place
 // their top at p.y; the mover builder already subtracts its half-height.
 if(motion)moving(name,from[0],from[1]+.02,15,16,{bounce:up,color:SPRING,...motion},from[2]??0);
 else{add({t:'trampoline',nm:name,p:[a[0],a[1]+.02,a[2]],s:[13,.6,14],yaw:frame(from[0]).yaw,speed:up,amp:1.25,tex:'solid',color:SPRING,grp:group(from[0])});
  for(const u of [-5.6,5.6])for(const ds of [-5.7,5.7])box(`${name} · spring foot`,from[0]+ds,from[1]-.6,1.1,1.1,(from[2]??0)+u,3,DARK);}
 const time=flight(up*1.25,dy);let y=a[1],vy=up*1.25;
 for(let n=1;n<=Math.ceil(time*60);n++){vy=Math.max(-CONST.maxFallSpeed,vy-(vy>0?TUNING.riseGravity:TUNING.fallGravity)/60);y+=vy/60;
  if(n%Math.max(1,Math.floor(time*60/4))===0&&n<time*60-3){const t=n/60/time;add({t:'wumpa',nm:`${name} · arc`,p:[a[0]+(b[0]-a[0])*t,y+1,a[2]+(b[2]-a[2])*t],grp:group(from[0])});}}}
function chain(name:string,marks:Station[],motion?:Record<number,Partial<CustomComponent>>){
 const excursion=(m:Partial<CustomComponent>|undefined)=>m?(Math.abs(m.amp??0)+Math.hypot(...(m.orbit??[0,0]))):0;
 for(let i=0;i<marks.length-1;i++)spring(`${name} · ${i+1}`,marks[i],marks[i+1],motion?.[i],excursion(motion?.[i])+excursion(motion?.[i+1]));}
function rail(nm:string,a:number,b:number,y:number,u:number){const p=carlislePoint(a,y,u),n=Math.ceil((b-a)/6);add({t:'rail',nm,p,pts:Array.from({length:n+1},(_,i)=>{const q=carlislePoint(a+(b-a)*i/n,y,u);return[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]];}),grp:group(a)});}
function grindLine(nm:string,knots:Station[],popTo?:Station){
 const p=point(knots[0]);add({t:'rail',nm,p,pts:knots.map(k=>{const q=point(k);return[q[0]-p[0],q[2]-p[2],9,q[1]-p[1]];}),grp:group(knots[0][0])});
 // Sparse fruit on the entry and departure makes the thin native rail legible
 // from the bounce camera without adding a walkable bridge below it.
 for(const k of knots)add({t:'wumpa',nm:`${nm} · grind line`,p:point([k[0],k[1]+1,k[2]]),grp:group(k[0])});
 return{name:nm,knots,popTo};
}
function springToRail(name:string,from:Station,to:Station,railName:string){spring(name,from,to);CARLISLE_RELAY_JUMPS[CARLISLE_RELAY_JUMPS.length-1].rail=railName;}

function authorCourse(){
C.length=0;roads.length=0;
CARLISLE_RELAY_JUMPS.length=0;CARLISLE_RELAY_GRINDS.length=0;CARLISLE_RELAY_STOPS.length=0;CARLISLE_RELAY_WALK.length=0;
// I — surf-side springs, a scissor pier, changing tides and a lighthouse climb.
rest('Foam steps · start',0,0);road('Shore approach',12,61,0,16);
chain('Foam steps',[[65,0],[82,4],[103,10],[126,4],[151,0]]);road('Foam catch',143,180,0,20);
rest('Scissor groyne',195,0);road('Scissor approach',180,232,0,12);
moving('Scissor · long blade',260,.35,22,66,{spin:9});moving('Scissor · cross blade',260,.7,22,66,{spin:9,yaw:frame(260).yaw+90});box('Scissor waiting hub',260,1.05,14,14);walk('Scissor axle',260,1.05);walk('Scissor far dock',294,0);
road('Scissor abutment',288,333,0,14);chain('Groyne rebound',[[337,0],[360,8],[382,0]]);road('Groyne catch',375,408,0,17);
rest('Lift and skip',415,0);road('Lift approach',408,440,0,14);
for(const [i,s] of [451,466,481,496].entries()){moving(`Tide steps · ${i+1}`,s,i,17,21,{axis:'y',amp:1,speed:.55,phase:i*.7});walk(`Tide step ${i+1}`,s,i);}
add({t:'trampoline',nm:'Spring-tide reservoir · side recovery',p:carlislePoint(475,-7,21),s:[17,.7,78],yaw:frame(475).yaw,speed:25,amp:1.25,color:SPRING,grp:3});
road('Lift exit',505,519,3,16);chain('Lift and skip',[[522,3],[548,17,-4],[577,10,3],[601,4]]);road('Lift catch',594,629,4,18);
rest('Surf sockets',635,4);road('Socket approach',620,651,4,13);
chain('Surf sockets',[[655,4],[682,16,-6],[710,5,7],[742,21,-6],[775,10,5],[809,4]]);road('Socket catch',802,839,4,18);
rest('Twin winches',845,4);road('Port pier',830,874,4,12,-5);
moving('Port winch',891,4.35,24,36,{axis:'x',amp:7,speed:.45},-5);moving('Starboard winch',920,4.7,24,36,{axis:'x',amp:7,speed:.45,phase:Math.PI},5);
box('Winch transfer bollard',905,4.95,12,12);walk('Port winch',890,4,-5);walk('Winch transfer',905,4.95);walk('Starboard winch',920,4,5);road('Winch exit',932,976,4,20,5);
chain('Winch throw',[[980,4,5],[1012,17],[1035,4]]);road('Winch catch',1028,1068,4,18);
rest('Beacon chimney',1068,4);chain('Beacon chimney',[[1090,4],[1113,20,-4],[1140,39,4],[1170,63,-3],[1204,78,3],[1244,22],[1272,12]]);road('Beacon catch',1264,1302,12,23);
for(const u of [-15,15])strip('Beacon tower buttress',1128,1195,45,7,u,66,DARK,false);

// II — genuinely different ways to board, ride and leave harbour machinery.
rest('Tide dial',1308,12);road('Dial boarding quay',1290,1355,12,18);
for(let i=0;i<2;i++)moving(`Tide dial · orbit ${i+1}`,1390,12.35,26,34,{axis:'y',orbit:[20,38],speed:.22,phase:Math.PI/2+i*Math.PI});
walk('Dial entry',1360,12);walk('Dial exit',1435,12);road('Dial receiving quay',1426,1490,12,20);
spring('Dial exit spring',[1492,12],[1516,16]);road('Dial catch',1508,1544,16,18);rest('Pinwheel handoffs',1530,16);
for(const [i,s] of [1566,1605,1644].entries()){moving(`Pinwheel ${i+1}`,s,16+.35*(i+1),16,58,{spin:i===1?-13:11,yaw:frame(s).yaw+i*25});walk('Pinwheel centre',s,16);}
road('Pinwheel dock',1672,1693,16,17);chain('Pinwheel release',[[1696,16],[1721,27],[1740,16]]);road('Pinwheel catch',1733,1776,16,20);
// Open, separated catches replace the wheel whose rising baskets crossed
// underneath the upper floor. No moving deck or stacked floor crosses this
// approach: the amber pads and fruit arcs show both transfers from the quay.
rest('Dredger terraces',1770,16,26);road('Dredger launch quay',1760,1796,16,24);
road('Dredger middle terrace',1817,1839,32,26,-6);
road('Dredger upper terrace',1853,1904,48,28,s=>6*(1-Math.max(0,Math.min(1,(s-1864)/28))));
chain('Dredger terraces',[[1792,16],[1828,32,-6],[1864,48,6]]);
walk('Dredger upper terrace exit',1895,48);
chain('Dredger discharge',[[1908,48],[1935,58,3],[1964,35],[1983,24]]);road('Discharge catch',1976,2022,24,20);rest('Cross-thread springs',2008,24);
chain('Cross-thread',[[2031,24],[2060,34,-3],[2092,24,3],[2124,40,-3],[2157,24]],{0:{axis:'x',amp:3,speed:.55},1:{axis:'z',amp:3,speed:.5},2:{axis:'x',amp:3,speed:.7,phase:Math.PI},3:{spin:18}});
road('Crane gantry',2150,2236,24,14);rail('Crane outrigger shortcut',2160,2230,25.1,6);
rest('Counterweight stacks',2240,24);road('Counterweight boarding',2220,2262,24,18);
for(const [i,s] of [2273,2290,2307,2324].entries()){moving(`Counterweight ${i+1}`,s,24+i*2,19,15,{axis:'y',amp:2.5,speed:.5,phase:i*Math.PI});walk(`Counterweight ${i+1}`,s,24+i*2);}
road('Counterweight exit',2334,2350,30,18);chain('Stack leap',[[2354,30],[2382,50,-4],[2415,29,4],[2447,24]]);road('Stack catch',2440,2495,24,22);rest('Harbour scissors',2478,24);
chain('Scissor approach springs',[[2500,24],[2532,41,5],[2566,24,-5],[2595,24]]);box('Scissor inner dock',2595,24,22,23);
moving('Harbour scissors · outer arm',2626,24.35,16,70,{spin:-10});moving('Harbour scissors · inner arm',2626,24.7,16,70,{spin:10,yaw:frame(2626).yaw+70});walk('Harbour scissors axle',2626,24);
road('Harbour departure',2657,2715,24,16);

// III — exposed fingers, rising orbits, stacked spirals and a homeward dive.
rest('Storm fingers',2720,24);road('Headland throat',2700,2743,24,13);
chain('Storm fingers',[[2747,24],[2780,43,-7],[2814,27,8],[2848,55,-6],[2884,28,5],[2910,24]]);road('Headland catch',2903,2943,24,18);rest('Helical turbine',2930,24);
chain('Helical turbine',[[2950,24],[2981,38,-4],[3014,53,4],[3048,66,-4],[3084,35],[3115,24]],{1:{axis:'z',orbit:[3,3],speed:.35,spin:-16},2:{axis:'x',orbit:[3,3],speed:.35,spin:16},3:{axis:'y',orbit:[3,3],speed:.35,spin:-16}});
road('Turbine catch',3108,3163,24,19);rest('Pendulum pier',3145,24);road('Pendulum boarding quay',3150,3190,24,18);
moving('Pendulum pier · translating and turning',3240,24.35,32,100,{axis:'z',amp:19,speed:.23,spin:3});walk('Pendulum centre',3240,24);walk('Pendulum disembark',3290,24);
road('Pendulum receiving quay',3288,3360,24,18);rest('Rigging slingshot',3360,24);
const rigging=grindLine('Rigging · sweeping cable',[[3390,38,-6],[3408,38,-6],[3434,36,-27],[3462,34,-27],[3478,34,-12],[3490,34,-12]],[3506,35.2,-12]);
springToRail('Rigging · rail catch',[3380,24],[3398,38,-6],rigging.name);
spring('Rigging · moving rebound',[3506,35.2,-12],[3551,24],{axis:'y',amp:.5,speed:.5,spin:8},.5);
CARLISLE_RELAY_GRINDS.push({name:'Rigging slingshot',start:[3370,24],launches:['Rigging · rail catch','Rigging · moving rebound'],rails:[rigging],finish:[3551,24]});
road('Rigging catch',3544,3602,24,20);rest('Broken crown',3585,24);
const crownA=grindLine('Crown · outer cable',[[3613,34,4],[3630,34,4],[3654,32,20],[3672,30,16],[3684,30,16]],[3700,31.2,16]);
const crownB=grindLine('Crown · return cable',[[3719,49,-6],[3735,49,-6],[3750,40,-23],[3767,29,-12],[3780,25,0]]);
springToRail('Crown · first catch',[3608,24],[3620,34,4],crownA.name);
springToRail('Crown · crosswind rebound',[3700,31.2,16],[3727,49,-6],crownB.name);
CARLISLE_RELAY_GRINDS.push({name:'Broken crown',start:[3594,24],launches:['Crown · first catch','Crown · crosswind rebound'],rails:[crownA,crownB],finish:[3788,24]});
road('Eye catch',3781,3828,24,21);rest('Homecoming cable',3810,24);
const home=grindLine('Homecoming · diving cable',[[3841,54,4],[3860,54,4],[3892,45,-18],[3917,29,-24],[3940,16,0],[3954,13,0]]);
springToRail('Homecoming · final catch',[3835,24],[3847,54,4],home.name);
CARLISLE_RELAY_GRINDS.push({name:'Homecoming cable',start:[3820,24],launches:['Homecoming · final catch'],rails:[home],finish:[3958,12],gate:true});
road('Home harbour',3950,4020,12,s=>s<3985?18:30);add({t:'gate',nm:'Carlisle Coast · 4 km',p:carlislePoint(4000,12),yaw:frame(4000).yaw,grp:18});
add({t:'crystal',p:carlislePoint(3990,13),grp:18});add({t:'clock',p:carlislePoint(14,0,-5),grp:1});
for(let s=0;s<=4000;s+=18){const before=CARLISLE_RELAY_STOPS.filter(q=>q.s<=s);add({t:'camnode',nm:`Coast camera · ${s} m`,p:carlislePoint(s,before.length?before[before.length-1].y:0),radius:0,grp:90});}
for(const [i,s] of [0,1280,2700].entries())for(let fin=0;fin<=i;fin++)strip(`Act ${i+1} · sea stack ${fin+1}`,s+20+fin*12,s+29+fin*12,26+i*9,7,-29-fin*7,65,DARK,false);
for(const [i,[,a,b]] of CARLISLE_RELAY_SECTIONS.entries()){const y=i<6?-8:i<12?4:8,side=i%3===0?1:-1;
 strip('Coastal strata',a+10,b-12,y,32,side*(38+(i%4)*4),38,i%2?DARK:'#768087',false);if(i%3===1)strip('Outer sea stack',a+42,a+75,y+22,15,-side*50,58,DARK,false);}
add({t:'mesh',nm:'Grey sea',p:[0,-25,-2000],vertices:[-1400,0,-2200,1400,0,-2200,1400,0,2200,-1400,0,2200],indices:[0,2,1,0,3,2],tex:'solid',color:'#677d89',solid:false,grp:90});
// Native pit boxes follow the descending coast so an early miss still resets
// promptly, even though the finishing harbour is hundreds of metres lower.
for(let s=-100;s<4100;s+=50){const a=frame(s),b=frame(s+50);add({t:'pit',nm:'Sea reset',p:[0,elevation(s+50)-23,(a.z+b.z)/2],s:[2800,1,Math.abs(b.z-a.z)+.02],invisible:true,grp:90});}
return buildCarlisleCrossings(C,roads,carlislePoint,s=>frame(s).yaw,group,CARLISLE_RELAY_STOPS,CARLISLE_RELAY_JUMPS,CARLISLE_RELAY_GRINDS.map(g=>({s:g.finish[0],y:g.finish[1]})),CARLISLE_CARGO_GAPS);
}
// First locate the dry machinery/launch islands. Then lower the whole route
// through each slippery span, retaining the drop downstream instead of
// putting an uphill ramp at the end. The final harbour keeps its authored Y.
const downhill=authorCourse().flatMap(r=>r.slopes);
elevation=s=>downhill.reduce((sum,r)=>sum+Math.max(0,Math.min(r.to-r.from,r.to-s))*r.grade,0);
export const CARLISLE_RELAY_CROSSINGS=authorCourse();
fitCarlisleDeckBerths(C);
export const CARLISLE_RELAY_CARGO = buildCarlisleCargo(C,carlislePoint,group);
export const CARLISLE_TIDAL_RELAY_LEVEL:CustomLevelData={v:1,name:'Carlisle Coast',spawn:carlislePoint(0,.12),killY:-45,startWarpPad:false,
 sky:'day',hugeDropBail:false,keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:125,fogFar:480,fogColor:'#b4c2c9',drawDistance:680,ambientSky:'#e5e8e8',ambientGround:'#69737a',ambientIntensity:1.3,
 sunColor:'#fff1d6',sunIntensity:1.6,fillColor:'#bbd0dc',fillIntensity:.4,shadowStrength:.65,backdrop:'fog',fallbackTop:'#9bafbd',fallbackBottom:'#c4cdd0'},
 medalTimes:{gold:500,silver:620,bronze:780},groups,components:C};
