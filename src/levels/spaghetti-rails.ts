import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { roundCorners } from '../pathNodes';
import type { RaceKnot, RacePoint, SkateRaceData } from '../race/types';
import { splitSpaghettiRun } from './spaghetti-rail-transfers';
import { spaghettiJumpCues } from './spaghetti-rail-cues';

export type SpaghettiPoint = RacePoint;
type P = SpaghettiPoint;
export interface SpaghettiRun { name:string; stage:number; nodes:P[]; radius:number; lanes:number[]; dock?:number; jumpEntry?:boolean; braidHeight?:number; }
export interface SpaghettiDock { name:string; p:P; width:number; depth:number; yaw:number; launchLead?:number; }
const r=(v:number)=>Math.round(v*1000)/1000;
const distance=(a:P,b:P)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const mix=(a:P,b:P,t:number):P=>a.map((v,i)=>r(v+(b[i]-v)*t)) as P;
function beforeEnd(points:P[],metres:number):P {
 for(let i=points.length-1;i>0;i--){const span=distance(points[i],points[i-1]);if(span>=metres)return mix(points[i],points[i-1],metres/span);metres-=span;}
 return [...points[0]];
}
const LANES=[-3.6,0,3.6];

export const SPAGHETTI_STAGES=['The Switchyard','Witches’ Spiral','The Overhand Knot','Scissor Loom','Blackwater Corkscrew','Last Thread'];
export const SPAGHETTI_DOCKS:SpaghettiDock[]=[
 {name:'Starting gantry',p:[0,32,14],width:24,depth:80,yaw:0},
 {name:'Spiral entry / retry',p:[0,36,-188],width:23,depth:48,yaw:0},
 {name:'Spiral crown / retry',p:[-72,47,-205],width:24,depth:48,yaw:180},
 {name:'Knot entry / retry',p:[-116,52,-366],width:24,depth:48,yaw:0},
 {name:'Overhand catch / retry',p:[-146,56.5,-577],width:21,depth:26,yaw:0,launchLead:0},
 {name:'Loom entry / retry',p:[-116,62,-675],width:25,depth:48,yaw:0},
 {name:'Corkscrew entry / retry',p:[-116,59,-965],width:24,depth:48,yaw:0},
 {name:'Final braid / retry',p:[-192,30,-1022],width:25,depth:48,yaw:180},
 {name:'Finish receiving gantry',p:[-278,21,-1299],width:28,depth:78,yaw:0},
];
function helix(cx:number,cz:number,radius:number,y0:number,y1:number,turns:number,phase=0):P[]{
 const n=Math.round(Math.abs(turns)*24);
 return Array.from({length:n+1},(_,i)=>{const a=phase-turns*2*Math.PI*i/n;return[r(cx+radius*Math.cos(a)),r(y0+(y1-y0)*i/n),r(cz+radius*Math.sin(a))];});
}

// Every visible racing strand is a native editor rail. The third node value
// is an editable fillet radius, the fourth its height relative to the origin.
// Short straight lead-ins and exits leave time to aim each required transfer.
const CONTINUOUS_SKETCH:SpaghettiRun[]=[
 {name:'01 / Three-needle weave',stage:0,radius:18,lanes:LANES,nodes:[[0,32.9,-16],[0,32.9,-42],[19,35,-68],[19,38,-90],[-20,39,-120],[-20,38,-144],[0,36.9,-168],[0,36.9,-184]]},
 {name:'02 / Rising triple spiral',stage:1,radius:9,lanes:LANES,nodes:[[0,36.9,-202],[0,36.9,-222],...helix(-36,-254,36,37,48,1.5),[-72,47.9,-226],[-72,47.9,-210]]},
 {name:'03 / Crown switchback',stage:1,radius:18,lanes:LANES,nodes:[[-72,47.9,-191],[-72,47.9,-170],[-103,50,-147],[-146,52,-172],[-156,54.5,-221],[-155,54.2,-291],[-116,52.9,-336],[-116,52.9,-363]]},
 {name:'04 / Overhand, lower loop',stage:2,radius:19,lanes:LANES,nodes:[[-116,52.9,-381],[-116,52.9,-405],[-73,53,-435],[-54,53.5,-470],[-82,54,-496],[-123,54.5,-474],[-153,55,-438],[-185,55.5,-452],[-198,56,-486],[-171,56.3,-517],[-146,56.3,-534],[-146,56.3,-551]]},
 {name:'05 / Overhand, suspended return',stage:2,radius:18,lanes:LANES,nodes:[[-146,57.4,-559],[-146,57.4,-604],[-107,60,-638],[-67,62,-616],[-58,64,-557],[-91,66,-520],[-128,68,-491],[-161,68,-458],[-187,67,-475],[-193,65,-546],[-165,63,-598],[-116,62.9,-644],[-116,62.9,-671]]},
 {name:'06 / Loom, first sweep',stage:3,radius:16,lanes:LANES,braidHeight:9.25,nodes:[[-116,62.9,-690],[-116,62.9,-713],[-91,64,-740],[-91,64,-762],[-124,63,-790],[-124,63,-810]]},
 {name:'07 / Loom, second sweep',stage:3,radius:17,lanes:LANES,braidHeight:-9.25,nodes:[[-124,60.5,-822],[-124,60.5,-862],[-155,60,-882],[-155,60,-902],[-116,59.9,-943],[-116,59.9,-957]]},
 {name:'08 / Falling blackwater coil',stage:4,radius:9,lanes:LANES,nodes:[[-116,59.9,-981],[-116,59.9,-1005],...helix(-154,-1053,38,59.9,30.9,1.5),[-192,30.9,-1034],[-192,30.9,-1027]]},
 {name:'09 / Last thread, outward braid',stage:5,radius:17,lanes:LANES,nodes:[[-192,30.9,-1007],[-192,30.9,-986],[-225,31,-962],[-265,29,-991],[-294,27,-1045],[-294,25,-1095],[-260,24,-1127],[-260,24,-1149]]},
 {name:'10 / Last thread, hanging needle',stage:5,radius:16,lanes:LANES,nodes:[[-260,22,-1162],[-260,22,-1202],[-232,23,-1230],[-242,24,-1250],[-278,22,-1280],[-278,21.9,-1299]]},
];

const DOCK_BEFORE=new Map([[1,1],[2,2],[3,3],[5,5],[7,6],[8,7]]);
const TRANSFER_BEFORE=new Set([4,6,9]);
const SPLITS:Record<number,number[]>={0:[.5],1:[.33,.66],2:[.48],3:[.5],4:[.22,.48,.73],7:[.34,.69],8:[.6]};
export const SPAGHETTI_RUNS:SpaghettiRun[]=CONTINUOUS_SKETCH.flatMap((run,i)=>
 splitSpaghettiRun({...run,dock:DOCK_BEFORE.get(i),jumpEntry:TRANSFER_BEFORE.has(i)},SPLITS[i]??[]));

export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
 let source=run.nodes;
 if(run.braidHeight&&offset){
  // The loom is a genuine three-storey weave, still authored entirely as
  // editable rail nodes. Keep twenty metres at each end flat and aligned.
  const base=spaghettiSamples(spaghettiRail({...run,braidHeight:undefined},0)),arc=[0];
  for(let i=1;i<base.length;i++)arc.push(arc[i-1]+distance(base[i],base[i-1]));
  const total=arc[arc.length-1],positions=[0,20];
  for(let s=30;s<total-24;s+=10)positions.push(s);
  positions.push(total-20,total);
  source=positions.map(s=>{let i=1;while(i<arc.length-1&&arc[i]<s)i++;return mix(base[i-1],base[i],(s-arc[i-1])/(arc[i]-arc[i-1]));});
  const first=base[0],second=base[1],last=base[base.length-1],before=base[base.length-2];
  source[1]=first.map((v,k)=>r(v+(second[k]-v)*20/distance(first,second))) as P;
  source[source.length-2]=last.map((v,k)=>r(v+(before[k]-v)*20/distance(last,before))) as P;
 }
 const arc=[0];for(let i=1;i<source.length;i++)arc.push(arc[i-1]+distance(source[i],source[i-1]));
 const total=arc[arc.length-1];
 const nodes=source.map((p,i)=>{
  const a=source[Math.max(0,i-1)],b=source[Math.min(source.length-1,i+1)];
  const dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz)||1;
  const t=Math.max(0,Math.min(1,(arc[i]-20)/(total-40))),weaving=!!run.braidHeight&&offset!==0;
  const lane=weaving?offset*Math.cos(t*Math.PI*2):offset;
  const lift=weaving?Math.sign(offset)*run.braidHeight!*Math.sin(t*Math.PI):0;
  return[r(p[0]-dz/n*lane),r(p[1]+lift),r(p[2]+dx/n*lane)] as P;
 });
 const p=nodes[0];
 return {t:'rail',p:[...p],pts:nodes.map(q=>[r(q[0]-p[0]),r(q[2]-p[2]),run.radius,r(q[1]-p[1])]),
  curve:'corner',grp:10+run.stage,nm:`${run.name} / ${offset<0?'left':offset>0?'right':'centre'} strand`};
}
export function spaghettiSamples(component:CustomComponent):P[]{
 return roundCorners(component.pts!,false).map(q=>[r(component.p[0]+q.x),r(component.p[1]+q.y),r(component.p[2]+q.z)]);
}

export function createSpaghettiRailsGreybox():CustomLevelData {
 const C:CustomComponent[]=[],groups:CustomGroup[]=SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm:`${i+1} · ${nm}`,editorOnly:true}));
 const line:RaceKnot[]=[[0,32,32,24]],grinds:NonNullable<SkateRaceData['grinds']>=[],jumps:SkateRaceData['jumps']=[];
 const append=(p:P,width=10.8)=>{const old=line[line.length-1];if(Math.hypot(old[0]-p[0],old[1]-p[1],old[2]-p[2])>.02)line.push([...p,width]);};
 for(const [i,d]of SPAGHETTI_DOCKS.entries()){
  C.push({t:'platform',p:[d.p[0],d.p[1]-1.25,d.p[2]],s:[d.width,2.5,d.depth],yaw:d.yaw,tex:'checker',color:'#91969c',grp:2,nm:d.name});
  if(i>0&&i<SPAGHETTI_DOCKS.length-1)C.push({t:'checkpoint',p:[...d.p],yaw:d.yaw,grp:2,nm:`Retry · ${d.name}`});
  if(i<SPAGHETTI_DOCKS.length-1){
   const rad=d.yaw*Math.PI/180,forward=[-Math.sin(rad),-Math.cos(rad)];
   // These thin boost markings deliberately have no grind rim. The actual
   // gantry boundaries retain their ordinary edge-grinding behaviour.
   const lead=d.launchLead??(i===0?19:3);
   C.push({t:'speedpad',p:[d.p[0]+forward[0]*lead,d.p[1]+.04,d.p[2]+forward[1]*lead],s:[16,.1,5],yaw:d.yaw,speed:42,cycle:.9,edgeGrinding:false,grp:2,nm:`Launch speed · ${d.name}`});
   for(const offset of LANES)C.push({t:'crate',kind:'mystery',p:[d.p[0]+Math.cos(rad)*offset,d.p[1],d.p[2]-Math.sin(rad)*offset],grp:3,nm:`Items · ${d.name}`});
  }
 }
 for(const [i,run]of SPAGHETTI_RUNS.entries()){
  if(run.dock!==undefined)append(SPAGHETTI_DOCKS[run.dock].p,22);
  const central=spaghettiRail(run),samples=spaghettiSamples(central);
  if(run.jumpEntry){
   const previous=spaghettiSamples(spaghettiRail(SPAGHETTI_RUNS[i-1]));
   // Release four metres before the rail ends; the receiver remains straight
   // for the full catch window at both ordinary and boosted entry speeds.
   const takeoff=beforeEnd(previous,4);
   const landing=mix(samples[0],samples[1],.6);
   jumps.push({takeoff,landing});
   const end=previous[previous.length-1],before=previous[previous.length-2];
   C.push(...spaghettiJumpCues(takeoff,samples[0],end.map((v,k)=>v-before[k]) as P,jumps.length-1));
  }
  grinds.push({start:samples[0],end:samples[samples.length-1],lanes:[...run.lanes]});
  for(const offset of run.lanes)C.push(spaghettiRail(run,offset));
  for(const p of samples)append(p);
 }
 const finish:P=[-278,21,-1314];append(finish,26);
 for(const p of line)C.push({t:'camnode',p:p.slice(0,3) as P,grp:1});
 C.push({t:'camnode',p:[-278,21,-1338],grp:1});
 C.push({t:'gate',p:finish,yaw:0,grp:2,nm:'Spaghetti Rails / finish timing line'});
 C.push({t:'pit',p:[-145,-20,-630],s:[660,1,1600],invisible:true,grp:2,nm:'Cavern abyss / race recovery'});
 groups.push({id:1,nm:'Ordered race and camera guide',editorOnly:true},{id:2,nm:'Supported recovery gantries',editorOnly:true},{id:3,nm:'Race items',editorOnly:true},{id:4,nm:'Jump timing cues',editorOnly:true});
 const length=line.slice(1).reduce((n,p,i)=>n+distance(p.slice(0,3) as P,line[i].slice(0,3) as P),0);
 return {v:1,name:'Spaghetti Rails',spawn:[0,32.08,32],startWarpPad:false,killY:-32,fallRecoveryDrop:28,
  sky:'day',cameraAirLift:.75,cameraLookAhead:7,cameraRig:{camDist:10,camHeight:7,camPitch:16,camFov:65},
  perfectGrindBoost:true,allBalanceCrates:false,hugeDropBail:false,medalTimes:{gold:115,silver:135,bronze:165},components:C,groups,
  skateRace:{v:1,racers:8,seed:270327,gemReward:'win',stages:SPAGHETTI_STAGES,line,jumps,grinds,finishWidth:26,originalLength:length}};
}
export const SPAGHETTI_RAILS_LEVEL=createSpaghettiRailsGreybox();
