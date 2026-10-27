import type {CustomComponent, CustomGroup, CustomLevelData} from '../level';
import {dressWaterfallClimb} from './waterfall-climb-art';

export type WaterfallPoint = [number, number, number];
export interface WaterfallLanding {
  name: string;
  p: WaterfallPoint;
  size: [number, number];
  section: number;
  kind: 'stone' | 'timber' | 'crumble';
  bridge?: string;
}
export interface WaterfallBeat {
  name: string;
  from: WaterfallPoint;
  to: WaterfallPoint;
  kind: 'gap' | 'spin' | 'turn';
  bridge?: string;
}

const C: CustomComponent[] = [];
const groups: CustomGroup[] = [];
export const WATERFALL_LANDINGS: WaterfallLanding[] = [];
export const WATERFALL_BEATS: WaterfallBeat[] = [];
export const WATERFALL_CHECKPOINTS: WaterfallPoint[] = [];
export const WATERFALL_SECTIONS: {name: string; start: WaterfallPoint; end: WaterfallPoint}[] = [];
const stone = '#9fa9ae', timber = '#c2ac7a', crumble = '#bc8c7c';
const add = (c: CustomComponent) => C.push(c);

function pad(name: string, p: WaterfallPoint, width: number, depth: number, section: number,
  kind: WaterfallLanding['kind'] = 'stone'): WaterfallLanding {
  const landing: WaterfallLanding = {name,p,size:[width,depth],section,kind};
  WATERFALL_LANDINGS.push(landing);
  if (kind === 'crumble') add({t:'crumble',p:[...p],s:[width,.6,depth],shake:3,speed:24,
    color:crumble,tex:'solid',grp:section,nm:name});
  else add({t:'platform',p:[p[0],p[1]-.6,p[2]],s:[width,1.2,depth],color:kind==='timber'?timber:stone,
    tex:'solid',grp:section,nm:name});
  return landing;
}
function checkpoint(p: WaterfallPoint, section: number, name: string): void {
  add({t:'checkpoint',p:[...p],grp:section,nm:name}); WATERFALL_CHECKPOINTS.push([...p]);
}
function reward(p:WaterfallPoint,section:number,name:string,kind:CustomComponent['kind']='wood'):void {
  add({t:'crate',p:[...p],kind,grp:section,nm:name});
}
function arc(a:WaterfallPoint,b:WaterfallPoint,section:number):void {
  for (const t of [.15,.5,.85]) add({t:'wumpa',p:[a[0]+(b[0]-a[0])*t,
    a[1]+(b[1]-a[1])*t+.9+Math.sin(t*Math.PI)*.9,a[2]+(b[2]-a[2])*t],grp:section,nm:'Gap landing trail'});
}
function bridge(name:string,p:WaterfallPoint,span:number,width:number,yaw:number,hold:number,section:number):void {
  add({t:'spinbridge',p:[...p],s:[span,.4,width],yaw,cycle:.32,hold,color:timber,tex:'solid',grp:section,nm:name});
}

// Seven river chapters: vary rhythm, bank, width and surface, with a stable
// terrace before every new idea. Greybox dimensions remain the collision source.
const riverChapters = [
  {name:'Pebble Run',lengths:[34,24,19,22,18,25],gaps:[3,3.6,4.2,3.4,4.6],xs:[0,0,-1.2,1.2,0,0],rise:0,spin:[] as number[],crumble:[] as number[]},
  {name:'The River Locks',lengths:[24,19,22,20,18,25],gaps:[4.4,12,4.2,12,4.5],xs:[0,0,0,0,0,0],rise:.3,spin:[1,3],crumble:[]},
  {name:'Broken Causeway',lengths:[24,19,7,7,22,27],gaps:[4.2,3.8,3.2,4,4.6],xs:[0,-1.5,-1.5,0,1.5,0],rise:.2,spin:[],crumble:[2,3]},
  {name:'Braided Rapids',lengths:[29,21,24,18,21,28],gaps:[4.8,4.4,4.6,4.2,5],xs:[0,2,-1,1,-1.5,0],rise:.2,spin:[],crumble:[]},
  {name:'Three Lock Reach',lengths:[24,16,16,16,24,28],gaps:[12,12,12,4.6,4.4],xs:[0,0,0,0,0,0],rise:0,spin:[0,1,2],crumble:[]},
  {name:'The Rising Cascades',lengths:[28,22,24,24,20,28],gaps:[4,4.4,4,4.6,4.4],xs:[0,0,-1,0,1,0],rise:1.1,spin:[],crumble:[]},
  {name:'Thunder Basin',lengths:[30,22,20,22,26,38],gaps:[4.6,12,4.2,4.6,4.2],xs:[0,0,0,-1,0,0],rise:.35,spin:[1],crumble:[]},
];
let far = 18, riverY = 0;
let previous: WaterfallLanding | undefined;
for (const [chapter, spec] of riverChapters.entries()) {
  const section = 10 + chapter; groups.push({id:section,nm:`${chapter+1} · ${spec.name}`});
  const start:WaterfallPoint = [0,riverY,far];
  for (let i=0;i<spec.lengths.length;i++) {
    const length=spec.lengths[i],near=far;
    const x=spec.xs[i],p:WaterfallPoint=[x,riverY,near-length/2];
    const current=pad(`${spec.name} / landing ${i+1}`,p,i===0||i===5?10:7.6,length,section,
      spec.crumble.includes(i)?'crumble':'stone');
    if (previous) {
      // The banks overlap laterally: line up on the receiving bank before
      // takeoff, so the intended jump is axial rather than a diagonal sprint.
      const a:WaterfallPoint=[x,previous.p[1],previous.p[2]-previous.size[1]/2+ .7];
      const b:WaterfallPoint=[x,riverY,near-.85];
      const timed=i>0&&spec.spin.includes(i-1);
      const name=`${spec.name} / lock ${i}`;
      if(timed){
        bridge(name,[previous.p[0],previous.p[1],a[2]-.5],9.6,5.1,90,chapter===1?7:5.7,section);
        current.bridge=name;
      }
      WATERFALL_BEATS.push({name:`${spec.name} / crossing ${i+1}`,from:a,to:b,kind:timed?'spin':'gap',...(timed?{bridge:name}:{})});
      arc(a,b,section);
    }
    if(i===0){
      if(chapter>0)checkpoint([x+2.3,riverY,p[2]+length/2-5],section,`${spec.name} checkpoint`);
      reward([x-2,riverY,p[2]+3],section,`${spec.name} opening cache`,chapter===0?'mask':'wood');
    }
    if(i===1||i===4)reward([x,riverY,p[2]],section,`${spec.name} river cache ${i}`);
    if(i===5)reward([x+1.6,riverY,p[2]],section,`${spec.name} exit cache`,'mystery');
    for(let z=near-7;z>near-length+4;z-=9)add({t:'wumpa',p:[x,riverY+1,z],grp:section});
    far=near-length;
    previous=current;
    if(i<spec.lengths.length-1){far-=spec.spin.includes(i)?spec.gaps[i]:Math.min(spec.gaps[i],spec.rise>1?3.4:4);riverY+=spec.rise;}
  }
  WATERFALL_SECTIONS.push({name:spec.name,start,end:[0,riverY,far]});
  add({t:'pit',p:[0,start[1]-5,(start[2]+far)/2],s:[70,1,start[2]-far+2],invisible:true,grp:section,nm:`${spec.name} river contact`});
  if(chapter<riverChapters.length-1)far-=4;
}

export const WATERFALL_RIVER_END = far;
export const WATERFALL_BASE_Y = riverY;
export const WATERFALL_FACE_Z = far - 34;
const basinZ = far - 15;
pad('Waterfall foot / breathing terrace',[0,riverY,basinZ],116,23,20);
WATERFALL_BEATS.push({name:'The waterfall reveal',from:[0,riverY,far+.7],to:[0,riverY,basinZ+10],kind:'gap'});
groups.push({id:20,nm:'8 · Thunder basin and the secret spillway'});
arc([0,riverY,far+.7],[0,riverY,basinZ+10],20);
// The first climbing ledge is left of the close side-view frame. A continuous
// fruit ribbon makes that turn legible and passes behind the optional bonus.
for(let i=0;i<=10;i++)add({t:'wumpa',p:[-4.5*i,riverY+1,basinZ+7-1.2*i],grp:20,nm:'Follow the basin toward the first foothold'});
add({t:'wumpa',p:[-48,riverY+1,basinZ-8],grp:20,nm:'The first climbing ledge'});

checkpoint([-2.8,riverY,basinZ+3],20,'At the foot of the falls');
reward([3,riverY,basinZ+1],20,'Waterfall foot mask','mask');
// An optional raised bonus pad is beside the first climbing terrace, with
// permanent ground at both its approach and its explicit return point.
add({t:'bonusplatform',p:[-24,riverY,basinZ+3],to:[-19,riverY+.12,basinZ+3],grp:20,nm:'Behind the spray · bonus entrance'});
reward([-33,riverY,basinZ],20,'Hidden basin life','life');

// Nine traverses climb the same sheer waterfall. A constant side-view zone
// keeps screen-left/right stable even when successive terraces run westward.
const rowZ = WATERFALL_FACE_Z + 2;
const startClimb:WaterfallPoint=[-48,riverY,rowZ];
pad('Ascent / first foothold',startClimb,10,9,21);
WATERFALL_BEATS.push({name:'Step onto the waterfall face',from:[-48,riverY,basinZ-10.8],to:[-48,riverY,rowZ+3.6],kind:'gap'});
arc([-48,riverY,basinZ-10.8],[-48,riverY,rowZ+3.6],21);
const rowNames=['First Spray','Hinge Stair','Fern Balcony','Broken Teeth','The Bell Traverse','Cloud Rest','Upper Sluices','Last Locks','Skywater Crown'];
let y=riverY;
let rowStart:WaterfallPoint=[...startClimb];
for(let row=0;row<9;row++){
  const section=21+row,direction=row%2===0?1:-1,name=rowNames[row];
  groups.push({id:section,nm:`${row+9} · ${name}`});
  const start:WaterfallPoint=[...rowStart];
  let prev:WaterfallLanding={name:`${name} entry`,p:[...rowStart],size:[10,6],section,kind:'stone'};
  for(let step=1;step<=8;step++){
    const x=-48*direction+step*12*direction,top=y+step*1.55;
    const timed=(row===1||row===4||row===7)&&(step===2||step===5)
      ||row===8&&step===4;
    const fragile=row===3&&(step===3||step===4)||row===6&&step===6;
    const p:WaterfallPoint=[x,top,rowZ],padName=`${name} / foothold ${step}`;
    let current:WaterfallLanding;
    const a:WaterfallPoint=[prev.p[0]+direction*(prev.size[0]/2-.65),prev.p[1],rowZ];
    const b:WaterfallPoint=[x-direction*3.4,top,rowZ];
    if(timed){
      const hinge:WaterfallPoint=[prev.p[0]+direction*(prev.size[0]/2+.28),top,rowZ];
      bridge(padName,hinge,11.1,5.2,direction>0?0:180,row===1?6.8:5.6,section);
      current={name:padName,p:[hinge[0]+direction*5.55,top,rowZ],size:[11.1,5.2],section,kind:'timber',bridge:padName};
      WATERFALL_LANDINGS.push(current);
    }else current=pad(padName,p,8.6,5.8,section,fragile?'crumble':'stone');
    WATERFALL_BEATS.push({name:`${name} / leap ${step}`,from:a,to:b,kind:timed?'spin':'gap',...(timed?{bridge:padName}:{})});
    arc(a,b,section);
    if(!timed&&!fragile&&(step===1||step===4||step===7))reward([x,top,rowZ],section,`${name} cache ${step}`,step===7?'mystery':'wood');
    prev=current;
  }
  y+=8*1.55;
  const endX=48*direction;
  // Spacious end terrace, then three short, readable rising hops to reverse.
  // The final turn is the summit itself.
  pad(`${name} / rest terrace`,[endX,y,rowZ],10,8.8,section);
  checkpoint([endX-direction*2,y,rowZ-1.4],section,`${name} rest checkpoint`);
  if(row===2||row===5)reward([endX+direction*2.5,y,rowZ+1.7],section,`${name} rest life`,'life');
  WATERFALL_SECTIONS.push({name,start,end:[endX,y,rowZ]});
  if(row<8){
    let a:WaterfallPoint=[endX+direction*4.3,y,rowZ];
    const turnPoints:WaterfallPoint[]=[[endX+direction*8.5,y+1.7,rowZ],[endX+direction*8.5,y+3.4,rowZ-6],[endX,y+5.1,rowZ-6]];
    for(const [i,p]of turnPoints.entries()){
      pad(`${name} / turning step ${i+1}`,p,i===2?10:5.2,i===2?7.6:4.2,section);
      const b:WaterfallPoint=i===0?[p[0]-direction*1.6,p[1],p[2]]:i===1?[p[0],p[1],p[2]+1.2]:[p[0]+direction*3.4,p[1],p[2]];
      WATERFALL_BEATS.push({name:`${name} / turning jump ${i+1}`,from:a,to:b,kind:'turn'});arc(a,b,section);
      a=i===0?[p[0],p[1],p[2]-1.3]:[p[0]-direction*1.6,p[1],p[2]];
    }
    // One connected high landing advances six metres toward the face so a
    // returning row has a visible direction change without a camera flip.
    pad(`${name} / return balcony`,[endX,y+5.1,rowZ-2.8],10,9.6,section);
    rowStart=[endX,y+5.1,rowZ]; y+=5.1;
  }
}
export const WATERFALL_SUMMIT_Y=y;
pad('Summit / source pool rim',[62,y,rowZ],22,16,40);
WATERFALL_BEATS.push({name:'Reach the source of the waterfall',from:[52.3,y,rowZ],to:[54.5,y,rowZ],kind:'gap'});
add({t:'crystal',p:[59,y+1.2,rowZ],grp:40,nm:'The skywater crystal'});
add({t:'gate',p:[67,y,rowZ],yaw:90,w:8,grp:40,nm:'Waterfall summit finish'});
reward([56,y,rowZ-3],40,'Summit cache');
groups.push({id:40,nm:'The source of the river · finish'});

// Greybox environmental read: river and towering fall are visible from the
// start. Neither plane can support the player or silently close a jump gap.
add({t:'mesh',p:[0,-4,0],vertices:[-35,0,24,35,0,24,35,riverY,far-24,-35,riverY,far-24],indices:[0,2,1,0,3,2],
  solid:false,doubleSided:true,tex:'solid',color:'#5f9fac',opacity:.8,edgeGrinding:false,grp:90,nm:'Greybox river water'});
add({t:'mesh',p:[0,0,rowZ-5],vertices:[-30,-4,0,30,-4,0,30,y+7,0,-30,y+7,0],indices:[0,1,2,0,2,3],
  solid:false,doubleSided:true,tex:'solid',color:'#bedce4',opacity:.75,edgeGrinding:false,grp:90,nm:'Greybox waterfall curtain'});
add({t:'pit',p:[0,-5,rowZ],s:[150,1,85],invisible:true,grp:90,nm:'Waterfall plunge pool'});
add({t:'zone',p:[0,0,(24+far)/2],s:[80,1,24-far],dir:'S',grp:91,nm:'River forward controls'});
add({t:'zone',p:[0,y/2,rowZ+8],s:[180,y+40,48],dir:'E',grp:91,nm:'Waterfall side-scrolling controls'});
add({t:'camnode',p:[0,y/2,rowZ+8],s:[190,y+60,48],cameraView:true,cameraPresentationOnly:true,radius:4,
  cameraPosition:[0,7,22],cameraTarget:[0,2,0],cameraFollowDistance:18,cameraKeepDistance:true,
  cameraFollowTargetHeight:2,cameraFov:49,grp:91,nm:'Waterfall side-view ascent'});
// The approach stays forward-facing; the side-scroll zone deliberately takes
// over before the first climbing jump. Heights disambiguate the stacked route.
for(const z of [18,-130,-300,-500,-700,-900,far,basinZ])add({t:'camnode',p:[0,riverY*Math.min(1,-z/Math.max(1,-far)),z],radius:6,grp:91});
for(const section of WATERFALL_SECTIONS.slice(7))for(const p of [section.start,section.end])add({t:'camnode',p:[...p],radius:2,grp:91});
groups.push({id:90,nm:'Greybox river and waterfall',editorOnly:true},{id:91,nm:'Camera and control volumes',editorOnly:true});
add({t:'clock',p:[3,0,7],grp:10,nm:'Waterfall time trial'});

dressWaterfallClimb(C,groups,{landings:WATERFALL_LANDINGS,riverEnd:far,baseY:riverY,faceZ:WATERFALL_FACE_Z,summitY:y});

export const WATERFALL_CLIMB_LEVEL:CustomLevelData={v:1,name:'Waterfall Climb',spawn:[0,.12,9],killY:-16,
  fallRecoveryDrop:10,startWarpPad:false,sky:'day',cameraAirLift:.5,hugeDropBail:false,
  medalTimes:{gold:480,silver:570,bronze:690},keepPlayFog:true,jungleAtmosphere:true,jungleStyle:'painterly',jungleDepthFade:false,
  atmosphere:{fogEnabled:true,fogNear:80,fogFar:460,fogColor:'#9abcb2',ambientSky:'#e1f2de',ambientGround:'#314d3d',
    ambientIntensity:1.7,sunColor:'#ffe1a8',sunIntensity:1.8,fillColor:'#a2d6c7',fillIntensity:.85,drawDistance:560,shadowStrength:.65},
  components:C,groups};
