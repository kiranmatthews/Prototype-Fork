// Independently preserved at the user's request on 27 October 2026.
// This geometry must not follow later race-layout revisions.
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { roundCorners } from '../pathNodes';
import type { RaceKnot, RacePoint, SkateRaceData } from '../race/types';
import { splitSpaghettiRun } from './spaghetti-rail-transfers';
import { spaghettiJumpCues } from './spaghetti-rail-cues';

export type SpaghettiPoint=RacePoint;
type P=SpaghettiPoint;
export interface SpaghettiRun {name:string;stage:number;nodes:P[];radius:number;lanes:number[];dock?:number;jumpEntry?:boolean;braidHeight?:number;choice?:number;gap?:number;}
export interface SpaghettiDock {name:string;p:P;width:number;depth:number;yaw:number;launchLead?:number;retryLead?:number;}
const r=(n:number)=>Math.round(n*1000)/1000;
const distance=(a:P,b:P)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const mix=(a:P,b:P,t:number):P=>a.map((v,i)=>r(v+(b[i]-v)*t)) as P;
const forward=(yaw:number):P=>[-Math.sin(yaw*Math.PI/180),0,-Math.cos(yaw*Math.PI/180)];
const move=(p:P,f:P,d:number):P=>p.map((v,i)=>r(v+f[i]*d)) as P;
function along(points:P[],s:number):P {
 for(let i=1;i<points.length;i++){const d=distance(points[i-1],points[i]);if(d>=s)return mix(points[i-1],points[i],s/d);s-=d;}
 return [...points[points.length-1]];
}
export const SPAGHETTI_STAGES=['The Snarl','Widow’s Knot','Hangman’s Pretzel','Cauldron Braid','The Needle’s Eye','Last Tangle'];
export const SPAGHETTI_DOCKS:SpaghettiDock[]=[
 {name:'01 / The Snarl · choose a thread',p:[0,164,80],width:58,depth:76,yaw:0},
 {name:'02 / Widow’s Knot · junction',p:[0,140,-150],width:58,depth:76,yaw:0},
 {name:'03 / Hangman’s Pretzel · junction',p:[-150,116,-320],width:58,depth:76,yaw:90},
 {name:'04 / Cauldron Braid · junction',p:[-275,92,-120],width:58,depth:76,yaw:180},
 {name:'05 / The Needle’s Eye · junction',p:[-90,68,80],width:58,depth:76,yaw:270},
 {name:'06 / Last Tangle · junction',p:[135,44,-100],width:58,depth:76,yaw:0},
 {name:'07 / Finish receiving platform',p:[15,20,-400],width:58,depth:104,yaw:0},
];

// These are genuinely different paths, not offsets of a common centreline.
// The course folds back through the same cavern at six different storeys.
// Left branches wrap the outside of a knot, middle branches thread its eye,
// and right branches cut underneath. Every branch rejoins a wide platform.
const SKETCHES:[string,[number,number][]][][]=[
 [
  ['Serpent’s eye',[[-70,55],[-135,10],[-125,-75],[-50,-110],[15,-60],[-38,-2],[-105,-38],[-100,-135],[-50,-165]]],
  ['Double-cross',[ [60,8],[68,-50],[-5,-85],[-70,-30],[-65,22],[0,2],[65,-75],[35,-123] ]],
  ['Low needle',[[85,30],[125,-15],[95,-65],[40,-60],[25,-5],[75,20],[115,-40],[70,-100]]],
 ],
 [
  ['Widow’s overhand',[[-65,-210],[-125,-165],[-190,-210],[-180,-285],[-95,-300],[-55,-235],[-100,-205],[-200,-290],[-175,-355]]],
  ['Figure-eight noose',[[20,-245],[85,-290],[50,-370],[-35,-390],[-105,-330],[-50,-270],[10,-310],[-28,-360]]],
  ['Under the eye',[[95,-205],[160,-265],[130,-340],[60,-390],[-10,-350],[-55,-320]]],
 ],
 [
  ['Hangman’s outer knot',[[-200,-415],[-310,-445],[-395,-360],[-390,-240],[-315,-175],[-240,-210],[-250,-280],[-330,-240],[-330,-155]]],
  ['Pretzel heart',[[-250,-370],[-340,-315],[-350,-220],[-270,-190],[-205,-245],[-230,-310],[-315,-290],[-345,-195],[-310,-160]]],
  ['The undercut',[[-200,-280],[-145,-270],[-125,-215],[-175,-165],[-230,-205],[-210,-255],[-150,-240],[-160,-180],[-230,-150]]],
 ],
 [
  ['Cauldron crown',[[-360,-45],[-405,50],[-340,130],[-235,155],[-150,100],[-175,40],[-265,75],[-210,145],[-140,125]]],
  ['Witch’s clover',[[-320,-20],[-270,55],[-175,75],[-145,10],[-205,-30],[-260,10],[-230,95],[-155,125]]],
  ['Blackwater skim',[[-235,-35],[-170,-35],[-135,20],[-185,55],[-235,15],[-215,-20],[-150,5],[-130,55]]],
 ],
 [
  ['The strangler',[[-20,175],[85,195],[170,130],[180,30],[110,-20],[40,10],[75,85],[175,100],[215,10],[185,-45]]],
  ['Needle-eye orbit',[[25,130],[100,105],[125,20],[45,-5],[0,50],[55,80],[140,45],[170,-25]]],
  ['Cut the thread',[[-5,25],[35,-35],[95,-35],[120,25],[65,50],[30,5],[75,-45],[115,-60]]],
 ],
 [
  ['The last noose',[[245,-125],[300,-230],[270,-350],[170,-410],[85,-365],[95,-305],[175,-330],[150,-425],[55,-450],[-25,-410],[-20,-350]]],
  ['Unravelling spiral',[[205,-190],[220,-270],[145,-315],[70,-270],[85,-205],[155,-225],[165,-320],[80,-355]]],
  ['Hanging escape',[[105,-185],[50,-220],[-15,-215],[-50,-275],[-10,-320],[45,-285],[20,-235],[-35,-260],[-40,-330]]],
 ],
];

// Local over/under beats keep the visible knots genuinely three dimensional.
// They modify native node heights, including the little supported transfer
// decks; no collision proxy or camera trick supplies the separation.
const OVERPASSES:{stage:number;choice:number;part?:number;x:number;z:number;lift:number;radius:number}[]=[
 {stage:0,choice:2,x:52,z:-60,lift:-7,radius:45},
 {stage:1,choice:0,x:-66,z:-282,lift:7,radius:48},
 {stage:2,choice:0,x:-306,z:-209,lift:7,radius:40},
 {stage:3,choice:0,x:-233,z:63,lift:7,radius:50},
 {stage:4,choice:0,x:104,z:89,lift:7,radius:45},
 {stage:5,choice:0,x:135,z:-317,lift:3,radius:50},
 {stage:5,choice:2,part:3,x:-14,z:-315,lift:-6.2,radius:38},
];

export interface SpaghettiPath {name:string;stage:number;choice:number;runs:SpaghettiRun[];}
export const SPAGHETTI_PATHS:SpaghettiPath[]=SKETCHES.flatMap((stage,section)=>stage.map(([name,shape],choice)=>{
 const a=SPAGHETTI_DOCKS[section],b=SPAGHETTI_DOCKS[section+1],fa=forward(a.yaw),fb=forward(b.yaw);
 const slot=(end:boolean)=>stage.map((entry,i)=>{const point=end?entry[1][entry[1].length-1]:entry[1][0],d=end?b:a,f=end?fb:fa;return {i,lateral:(point[0]-d.p[0])*-f[2]+(point[1]-d.p[2])*f[0]};}).sort((x,y)=>x.lateral-y.lateral).findIndex(entry=>entry.i===choice);
 const start=move(move(a.p,fa,16),[-fa[2],0,fa[0]],(slot(false)-1)*14),end=move(move(b.p,fb,-24),[-fb[2],0,fb[0]],(slot(true)-1)*14);
 start[1]+=.9;end[1]+=.9;
 const interior=shape.map(([x,z]):P=>[x,0,z]);
 while(interior.length>4&&Math.hypot(interior[interior.length-1][0]-b.p[0],interior[interior.length-1][2]-b.p[2])<95)interior.pop();
 const departure=move(move(a.p,fa,76),[-fa[2],0,fa[0]],(slot(false)-1)*36);
 const approach=move(move(b.p,fb,-100),[-fb[2],0,fb[0]],(slot(true)-1)*36);
 const raw:P[]=[start,move(start,fa,26),departure,...interior,approach,move(end,fb,-26),end];
 const arc=[0];for(let i=1;i<raw.length;i++)arc.push(arc[i-1]+Math.hypot(raw[i][0]-raw[i-1][0],raw[i][2]-raw[i-1][2]));
 const total=arc[arc.length-1],lift=choice===0?12:choice===2?-8:0;
 const nodes=raw.map((p,i):P=>{
  // Flat rail ends on supported decks; the middle keeps the full authored
  // height changes. A net twenty-four-metre descent powers each tangled knot.
  const t=Math.max(0,Math.min(1,(arc[i]-26)/(total-52)));
  return [r(p[0]),r(start[1]+(end[1]-start[1])*t+lift*Math.sin(Math.PI*t)),r(p[2])];
 });
 const run:SpaghettiRun={name:`${section+1}.${choice+1} / ${name}`,stage:section,choice,lanes:[0],radius:23,gap:choice===0?8:choice===2?17:10,nodes};
 const cuts=choice===0?[.52]:choice===2?[.25,.5,.75]:[.34,.68];
 const runs=splitSpaghettiRun(run,cuts).map((part,index)=>{const nodes=part.nodes.map((point):P=>{
  const taper=Math.min(1,Math.max(0,(Math.hypot(point[0]-start[0],point[2]-start[2])-26)/40),Math.max(0,(Math.hypot(point[0]-end[0],point[2]-end[2])-26)/40));
  const lift=OVERPASSES.filter(beat=>beat.stage===section&&beat.choice===choice&&(beat.part===undefined||beat.part===index)).reduce((sum,beat)=>sum+beat.lift*Math.exp(-((point[0]-beat.x)**2+(point[2]-beat.z)**2)/(2*beat.radius**2)),0)*taper;
  return [point[0],r(point[1]+lift),point[2]];
 });
  // Preserve flat supported launch/landing tails after the local height beats.
  if(index>0)nodes[1][1]=nodes[0][1];
  if(index<cuts.length)nodes[nodes.length-2][1]=nodes[nodes.length-1][1];
  return {...part,nodes};
 });
 return {name,stage:section,choice,runs};
}));
export const SPAGHETTI_RUNS=SPAGHETTI_PATHS.flatMap(path=>path.runs);

export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
 const nodes=run.nodes.map((p,i):P=>{
  const a=run.nodes[Math.max(0,i-1)],b=run.nodes[Math.min(run.nodes.length-1,i+1)],n=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  return [r(p[0]-(b[2]-a[2])/n*offset),p[1],r(p[2]+(b[0]-a[0])/n*offset)];
 });
 const p=nodes[0];
 return {t:'rail',p:[...p],pts:nodes.map(q=>[r(q[0]-p[0]),r(q[2]-p[2]),run.radius,r(q[1]-p[1])]),curve:'corner',grp:10+run.stage,nm:run.name};
}
export function spaghettiSamples(component:CustomComponent):P[]{
 return roundCorners(component.pts!,false).map(q=>[r(component.p[0]+q.x),r(component.p[1]+q.y),r(component.p[2]+q.z)]);
}
export const SPAGHETTI_TRANSFERS=SPAGHETTI_PATHS.flatMap(path=>path.runs.slice(1).map((run,i)=>{
 const previous=spaghettiSamples(spaghettiRail(path.runs[i])),samples=spaghettiSamples(spaghettiRail(run));
 const length=previous.slice(1).reduce((sum,p,j)=>sum+distance(p,previous[j]),0),last=previous[previous.length-1],before=previous[previous.length-2];
 return {from:path.runs[i].name,to:run.name,stage:path.stage,choice:path.choice,takeoff:along(previous,length-4),landing:mix(samples[0],samples[1],.6),receiver:samples[0],direction:last.map((v,k)=>v-before[k]) as P};
}));

export function createSpaghettiRailsGreybox():CustomLevelData {
 const C:CustomComponent[]=[],groups:CustomGroup[]=SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm:`${i+1} · ${nm} / three different routes`,editorOnly:true}));
 const line:RaceKnot[]=[[0,164,108,34]],grinds:NonNullable<SkateRaceData['grinds']>=[],jumps:SkateRaceData['jumps']=[],railChoices:NonNullable<SkateRaceData['railChoices']>=[];
 const append=(p:P,width=12)=>{const old=line[line.length-1];if(distance(p,old.slice(0,3) as P)>.02)line.push([...p,width]);};
 for(const [i,d]of SPAGHETTI_DOCKS.entries()){
  const f=forward(d.yaw);
  C.push({t:'platform',p:[d.p[0],d.p[1]-1.25,d.p[2]],s:[d.width,2.5,d.depth],yaw:d.yaw,tex:'checker',color:'#92979d',grp:2,nm:d.name});
  if(i>0&&i<SPAGHETTI_DOCKS.length-1)C.push({t:'checkpoint',p:move(d.p,f,-4),yaw:d.yaw,grp:2,nm:`Retry / ${d.name}`});
  if(i<SPAGHETTI_DOCKS.length-1){
   C.push({t:'speedpad',p:move([d.p[0],d.p[1]+.04,d.p[2]],f,0),s:[44,.1,5],yaw:d.yaw,speed:42,cycle:.9,edgeGrinding:false,grp:2,nm:`Junction launch / ${d.name}`});
   for(const offset of [-14,0,14])C.push({t:'crate',kind:'mystery',p:move(move(d.p,f,-5),[-f[2],0,f[0]],offset),grp:3,nm:`Choose a thread / ${d.name}`});
  }
 }
 const terminal=(point:P,tangent:P,receiving:boolean,name:string,width:number)=>{
  const n=Math.hypot(tangent[0],tangent[2]),f:P=[tangent[0]/n,0,tangent[2]/n],centre=move(point,f,receiving?8:-6);
  C.push({t:'platform',p:[centre[0],point[1]-.9-1,centre[2]],s:[width,2,18],yaw:Math.atan2(-f[0],-f[2])*180/Math.PI,tex:'checker',color:receiving?'#a9adb1':'#7f858c',grp:2,nm:`${receiving?'Start':'End'} platform / ${name}`});
  if(receiving){
   const retry=move([point[0],point[1]-.9,point[2]],f,1),yaw=Math.atan2(-f[0],-f[2])*180/Math.PI;
   C.push({t:'checkpoint',p:retry,yaw,grp:2,nm:`Retry on this branch / ${name}`},
    {t:'speedpad',p:[retry[0],retry[1]+.04,retry[2]],s:[width-1,.1,5],yaw,speed:42,cycle:.9,edgeGrinding:false,grp:2,nm:`Supported branch relaunch / ${name}`});
  }
 };
 for(let stage=0;stage<SPAGHETTI_STAGES.length;stage++){
  const paths=SPAGHETTI_PATHS.filter(path=>path.stage===stage),from=SPAGHETTI_DOCKS[stage].p,to=SPAGHETTI_DOCKS[stage+1].p;
  append(from,34);railChoices.push({from:[...from],to:[...to],paths:paths.map(path=>path.runs.map(run=>run.name))});
  for(const path of paths)for(const [i,run]of path.runs.entries()){
   const rail=spaghettiRail(run),samples=spaghettiSamples(rail),end=samples[samples.length-1];C.push(rail);
   grinds.push({start:samples[0],end,lanes:[0]});
   if(i>0){
    const cue=SPAGHETTI_TRANSFERS.findIndex(gap=>gap.to===run.name),gap=SPAGHETTI_TRANSFERS[cue];
    if(path.choice===1)jumps.push({takeoff:gap.takeoff,landing:gap.landing});
    C.push(...spaghettiJumpCues(gap.takeoff,gap.receiver,gap.direction,cue));
    terminal(samples[0],samples[1].map((v,k)=>v-samples[0][k]) as P,true,run.name,path.choice===0?14:path.choice===2?7:10);
   }
   if(i<path.runs.length-1)terminal(end,end.map((v,k)=>v-samples[samples.length-2][k]) as P,false,run.name,path.choice===0?14:path.choice===2?7:10);
   if(path.choice===0){const at=along(samples,samples.slice(1).reduce((sum,p,j)=>sum+distance(p,samples[j]),0)*.55);C.push({t:'crate',kind:'mystery',p:[at[0],at[1]-.9,at[2]],grp:3,nm:`Outer knot item / ${run.name}`});}
   if(path.choice===1)for(const point of samples)append(point);
  }
  append(to,34);
 }
 const finish:P=[15,20,-420];append(finish,32);
 for(const p of line)C.push({t:'camnode',p:p.slice(0,3) as P,grp:1});
 C.push({t:'camnode',p:[15,20,-437],grp:1},{t:'gate',p:finish,yaw:0,grp:2,nm:'Spaghetti Rails / finish'},
  {t:'pit',p:[-50,-25,-145],s:[1100,1,1100],invisible:true,grp:2,nm:'Cauldron abyss / native race recovery'});
 groups.push({id:1,nm:'Canonical progress guide / native branches own camera',editorOnly:true},{id:2,nm:'Every rail starts and ends on a platform',editorOnly:true},{id:3,nm:'Route choice pickups',editorOnly:true},{id:4,nm:'Platform-to-platform jump cues',editorOnly:true});
 const length=line.slice(1).reduce((sum,p,i)=>sum+distance(p.slice(0,3) as P,line[i].slice(0,3) as P),0);
 return {v:1,name:'Spaghetti Rails',spawn:[0,164.08,108],startWarpPad:false,killY:-40,fallRecoveryDrop:28,sky:'day',
  cameraAirLift:.85,cameraLookAhead:9,cameraRig:{camDist:12,camHeight:8,camPitch:16,camFov:68},
  perfectGrindBoost:true,allBalanceCrates:false,hugeDropBail:false,medalTimes:{gold:115,silver:145,bronze:180},components:C,groups,
  skateRace:{v:1,racers:8,seed:270327,gemReward:'win',stages:SPAGHETTI_STAGES,line,jumps,grinds,railChoices,finishWidth:32,originalLength:length}};
}
function createPlatformingVersion():CustomLevelData {
 const data=createSpaghettiRailsGreybox(),race=data.skateRace!;
 data.name='Spaghetti Rails — Platforming';
 data.railNavigation={line:race.line,railChoices:race.railChoices};
 delete data.skateRace;
 data.alwaysSkate=true;
 data.components=data.components.map(c=>{
  if(c.t==='crate'&&c.kind==='mystery')return {t:'wumpa',p:[c.p[0],c.p[1]+1.2,c.p[2]],grp:c.grp,nm:`Rail fruit / ${c.nm}`} as CustomComponent;
  // Platforming checkpoints use ordinary blue crates; keep their bodies off
  // the rail and retain a supported respawn beside it on the same landing.
  if(c.t==='checkpoint'){const f=forward(c.yaw??0);c.p=move(c.p,[-f[2],0,f[0]],2.2);}
  return c;
 });
 data.components.push({t:'crystal',p:[15,20,-406],grp:2,nm:'Platforming crystal / final landing'});
 return data;
}
export const SPAGHETTI_RAILS_PLATFORMING_LEVEL=createPlatformingVersion();
