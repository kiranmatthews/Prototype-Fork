import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import {roundCorners} from '../pathNodes';
import type {RaceKnot,RacePoint,SkateRaceData} from '../race/types';
import {spaghettiJumpCues} from './spaghetti-rail-cues';
import {SPAGHETTI_HEIGHT_BEATS} from './spaghetti-rails-height-beats';

export type SpaghettiPoint=RacePoint;
type P=SpaghettiPoint;
export interface SpaghettiRun {name:string;stage:number;choice?:number;nodes:P[];radii?:number[];radius:number;lanes:number[];dock?:number;jumpEntry?:boolean;braidHeight?:number;gap?:number;}
export interface SpaghettiDock {name:string;p:P;width:number;depth:number;yaw:number;launchLead?:number;retryLead?:number;}
export interface SpaghettiPath {name:string;stage:number;choice:number;runs:SpaghettiRun[];}
const r=(n:number)=>Math.round(n*1000)/1000;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const distance=(a:P,b:P)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export const SPAGHETTI_STAGES=['The Snarl','Widow’s Knot','Hangman’s Pretzel','Cauldron Braid','The Needle’s Eye','Last Tangle'];
export const SPAGHETTI_DOCKS:SpaghettiDock[]=[0,55,-45,75,-65,25,0].map((x,i)=>({
 name:`${String(i+1).padStart(2,'0')} / ${SPAGHETTI_STAGES[i]??'Finish'} decision island`,
 p:[x,420-i*70,80-i*400],width:168,depth:112,yaw:0,
}));

// Coordinates are metres across the chasm and fraction of its forward span.
// Each uninterrupted native rail begins and ends on a huge common island.
// The loops occupy the void between islands, leaving 288 m of genuine gap.
const SKETCHES:[string,[number,number][]][]=[
 ['Serpent’s crown',[[-105,.16],[-160,.27],[-145,.48],[-75,.55],[-35,.39],[-100,.25],[-175,.43],[-140,.67],[-75,.76]]],
 ['Widow’s overhand',[[80,.16],[155,.29],[145,.53],[60,.60],[25,.40],[95,.30],[160,.51],[115,.71],[60,.78]]],
 ['Lace into the eye',[[-65,.18],[-45,.26],[-25,.35],[-25,.55],[-95,.68],[-155,.51],[-125,.30],[-70,.39],[-90,.68],[-45,.78]]],
 ['Pretzel heart',[[85,.16],[125,.31],[65,.42],[25,.25],[65,.13],[105,.28],[-21.5,.35],[-21.5,.55],[-21.5,.72],[-80,.78],[-120,.61],[-75,.45],[-42,.66]]],
 ['The fourfold braid',[[35,.17],[-65,.29],[-100,.47],[-30,.59],[70,.44],[45,.28],[-45,.42],[-35,.65],[65,.76]]],
 ['Needle-thread escape',[[75,.16],[155,.29],[175,.49],[105,.53],[55,.35],[105,.21],[145,.40],[-18,.52],[-18,.72],[-18,.82]]],
 ['Low broken eight',[[-45,.16],[-115,.30],[-85,.48],[10,.53],[75,.37],[30,.22],[-45,.38],[-20,.59],[80,.73]]],
 ['Hangman’s undercut',[[110,.18],[180,.37],[155,.65],[60,.74],[-35,.60],[-20,.42],[65,.47],[95,.65],[40,.78]]],
];
const TIERS=[32,24,16,8,0,-8,-16,-24];
const MIRROR=[1,-1,1,1,-1,-1],SCALE=[1,1.12,.94,1.06,1.17,1.02];
function world(stage:number,x:number,t:number,y:number):P {
 const a=SPAGHETTI_DOCKS[stage].p,b=SPAGHETTI_DOCKS[stage+1].p;
 return [r(mix(a[0],b[0],t)+x*MIRROR[stage]*SCALE[stage]),r(y),r(mix(a[2]-35,b[2]+35,t))];
}

export const SPAGHETTI_PATHS:SpaghettiPath[]=SPAGHETTI_STAGES.flatMap((_,stage)=>SKETCHES.map(([name,sketch],choice)=>{
 const a=SPAGHETTI_DOCKS[stage].p,b=SPAGHETTI_DOCKS[stage+1].p;
 const rank=(end:boolean)=>SKETCHES.map((s,i)=>({i,x:end?s[1][s[1].length-1][0]:s[1][0][0]})).sort((a,b)=>a.x-b.x).findIndex(s=>s.i===choice);
 const start=(rank(false)-3.5)*18/SCALE[stage],end=(rank(true)-3.5)*18/SCALE[stage];
 const shape:[number,number][]=[[start,0],[start,.079],[sketch[0][0]*.8,.13],...sketch,[end*1.45,.87],[end,.921],[end,1]];
 const flat=shape.map(([x,t])=>world(stage,x,t,0)),arc=[0];
 for(let i=1;i<flat.length;i++)arc.push(arc[i-1]+distance(flat[i-1],flat[i]));
 const total=arc[arc.length-1];
 const beats=choice===2?[[5,a[1]-21],[6,a[1]-25]]:choice===3?[[9,a[1]-25],[10,a[1]-29],[11,a[1]-32.4]]:choice===5?[[10,a[1]-32],[11,a[1]-36],[12,a[1]-38]]:[];
 const anchors=[[1,a[1]+.9],...beats,[shape.length-2,b[1]+.9]];
 const nodes=shape.map(([x,t],i):P=>{
  const travel=clamp((arc[i]-26)/(total-52));
  let y=mix(a[1],b[1],travel)+.9+TIERS[choice]*Math.sin(Math.PI*travel);
  if(beats.length)for(let j=1;j<anchors.length;j++)if(i>=anchors[j-1][0]&&i<=anchors[j][0]){
   const [before,by]=anchors[j-1],[after,ay]=anchors[j];y=mix(by,ay,(arc[i]-arc[before])/(arc[after]-arc[before]));break;
  }
  if(i<2)y=a[1]+.9;if(i>shape.length-3)y=b[1]+.9;
  // Two deliberate parallel transfer windows create the fast 3 → 4 → 6
  // combo. Each intact rail has a loop before or after its useful window,
  // so chaining these beats bypasses real distance instead of random hops.
  if(choice===2&&x===-25&&t>=.35&&t<=.55)y=a[1]-21-(t-.35)*20;
  if(choice===3&&x===-21.5&&t>=.35&&t<=.72)y=a[1]-25-(t-.35)*20;
  if(choice===5&&x===-18&&t>=.52&&t<=.82)y=a[1]-32-(t-.52)*20;
  y+=SPAGHETTI_HEIGHT_BEATS[choice]?.[i]??0;
  return world(stage,x,t,y);
 });
 const radii=nodes.map((_,i)=>i===0||i===nodes.length-1?0:choice===2||choice===3||choice===5?10:14+(i+stage)%3*3);
 const run:SpaghettiRun={name:`${stage+1}.${choice+1} / ${name} / thread 1`,stage,choice,nodes,radii,radius:16,lanes:[0]};
 return {name,stage,choice,runs:[run]};
}));
export const SPAGHETTI_RUNS=SPAGHETTI_PATHS.flatMap(path=>path.runs);
export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
 const nodes=run.nodes.map((p,i):P=>{
  const a=run.nodes[Math.max(0,i-1)],b=run.nodes[Math.min(run.nodes.length-1,i+1)],n=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
  return [r(p[0]-(b[2]-a[2])/n*offset),p[1],r(p[2]+(b[0]-a[0])/n*offset)];
 });
 const p=nodes[0];return {t:'rail',p:[...p],pts:nodes.map((q,i)=>[r(q[0]-p[0]),r(q[2]-p[2]),run.radii?.[i]??run.radius,r(q[1]-p[1])]),curve:'corner',grp:10+run.stage,nm:run.name};
}
export function spaghettiSamples(c:CustomComponent):P[]{return roundCorners(c.pts!,false).map(q=>[r(c.p[0]+q.x),r(c.p[1]+q.y),r(c.p[2]+q.z)]);}
function nearest(points:P[],desired:P):{point:P;along:number;direction:P}{
 let best=Infinity,along=0,result={point:points[0],along:0,direction:[0,0,-1] as P};
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],t=clamp(((desired[0]-a[0])*dx+(desired[2]-a[2])*dz)/(dx*dx+dz*dz||1));
  const p=a.map((v,k)=>mix(v,b[k],t)) as P,d=Math.hypot(p[0]-desired[0],p[2]-desired[2]),len=distance(a,b);
  if(d<best){best=d;result={point:p.map(r) as P,along:along+t*len,direction:b.map((v,k)=>v-a[k]) as P};}along+=len;
 }
 return result;
}
export const SPAGHETTI_TRANSFERS=SPAGHETTI_STAGES.flatMap((_,stage)=>[
 {from:2,to:3,x:-25,t:.40,rx:-21.5,rt:.50},{from:3,to:5,x:-21.5,t:.62,rx:-18,rt:.72},
].map(beat=>{
 const from=SPAGHETTI_PATHS[stage*8+beat.from].runs[0],to=SPAGHETTI_PATHS[stage*8+beat.to].runs[0];
 const takeoff=nearest(spaghettiSamples(spaghettiRail(from)),world(stage,beat.x,beat.t,0)),landing=nearest(spaghettiSamples(spaghettiRail(to)),world(stage,beat.rx,beat.rt,0));
 return {from:from.name,to:to.name,stage,choice:beat.from,optional:true,takeoff:takeoff.point,landing:landing.point,receiver:landing.point,direction:takeoff.direction,takeoffT:takeoff.along,landingT:landing.along};
}));

export function createSpaghettiRailsGreybox():CustomLevelData {
 const C:CustomComponent[]=[],groups:CustomGroup[]=SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm:`${i+1} · ${nm} / eight tangled island links`,editorOnly:true}));
 const line:RaceKnot[]=[[0,420,112,80]],grinds:NonNullable<SkateRaceData['grinds']>=[],railChoices:NonNullable<SkateRaceData['railChoices']>=[];
 const append=(p:P,width=16)=>{if(distance(p,line[line.length-1].slice(0,3) as P)>.02)line.push([...p,width]);};
 for(const [i,d]of SPAGHETTI_DOCKS.entries()){
  C.push({t:'platform',p:[d.p[0],d.p[1]-3,d.p[2]],s:[d.width,6,d.depth],tex:'checker',color:'#949ba4',grp:2,nm:d.name});
  // A decision deck has no chosen branch yet. Keep the view and controls
  // facing the mouths; the actual rail resumes ownership beyond the rim.
  // Only supported rail ends enter these XZ-only travel volumes.
  C.push({t:'zone',p:[...d.p],s:[d.width,1,d.depth],dir:'S',grp:1,nm:`Steady choice camera / ${d.name}`});
  if(i>0&&i<6)C.push({t:'checkpoint',p:[d.p[0],d.p[1],d.p[2]+15],grp:2,nm:`Retry / ${d.name}`});
  if(i<6){
   C.push({t:'speedpad',p:[d.p[0],d.p[1]+.04,d.p[2]-15],s:[148,.1,7],speed:42,cycle:.9,edgeGrinding:false,grp:2,nm:`Island launch strip / ${d.name}`});
   for(const x of [-54,-18,18,54])C.push({t:'crate',kind:'mystery',p:[d.p[0]+x,d.p[1],d.p[2]+4],grp:3,nm:`Choose a line / ${d.name}`});
  }
 }
 for(let stage=0;stage<6;stage++){
  const paths=SPAGHETTI_PATHS.filter(p=>p.stage===stage),from=SPAGHETTI_DOCKS[stage].p,to=SPAGHETTI_DOCKS[stage+1].p;append(from,80);
  railChoices.push({from:[...from],to:[...to],paths:paths.map(path=>path.runs.map(run=>run.name))});
  for(const path of paths)for(const run of path.runs){const c=spaghettiRail(run),points=spaghettiSamples(c);C.push(c);grinds.push({start:points[0],end:points[points.length-1],lanes:[0]});if(path.choice===3)points.forEach(p=>append(p));}
  append(to,80);
 }
 for(const [i,gap]of SPAGHETTI_TRANSFERS.entries())C.push(...spaghettiJumpCues(gap.takeoff,gap.receiver,gap.direction,i));
 const finish:P=[0,0,-2348];append(finish,80);
 line.forEach(p=>C.push({t:'camnode',p:p.slice(0,3) as P,grp:1}));
 C.push({t:'camnode',p:[0,0,-2362],grp:1},{t:'gate',p:finish,grp:2,nm:'Spaghetti Rails / finish island'},
  {t:'pit',p:[0,-42,-1120],s:[1100,1,3000],invisible:true,grp:2,nm:'Quagmire abyss / huge island gaps'});
 groups.push({id:1,nm:'Forward progression / actual rails own camera',editorOnly:true},{id:2,nm:'Seven huge decision islands',editorOnly:true},{id:3,nm:'Island pickups',editorOnly:true},{id:4,nm:'Deliberate 3 → 4 → 6 combo windows',editorOnly:true});
 const length=line.slice(1).reduce((sum,p,i)=>sum+distance(p.slice(0,3) as P,line[i].slice(0,3) as P),0);
 return {v:1,name:'Spaghetti Rails',spawn:[0,420.08,112],startWarpPad:false,killY:-70,fallRecoveryDrop:28,sky:'day',
  cameraAirLift:.85,cameraLookAhead:9,cameraRig:{camDist:12,camHeight:8,camPitch:16,camFov:68},
  perfectGrindBoost:true,allBalanceCrates:false,hugeDropBail:false,medalTimes:{gold:115,silver:155,bronze:205},components:C,groups,
  skateRace:{v:1,racers:8,seed:270327,gemReward:'win',stages:SPAGHETTI_STAGES,line,jumps:SPAGHETTI_TRANSFERS.map(g=>({takeoff:g.takeoff,landing:g.landing})),grinds,railChoices,finishWidth:96,originalLength:length}};
}
export const SPAGHETTI_RAILS_LEVEL=createSpaghettiRailsGreybox();
