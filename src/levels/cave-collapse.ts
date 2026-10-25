import type {CustomComponent,CustomLevelData} from '../level';
import type {CaveCollapseData} from '../caveCollapse';

const components:CustomComponent[]=[];
const add=(c:CustomComponent)=>components.push(c);
const stone='#a3977f',dark='#747873',teal='#76c9b5';
function floor(nm:string,x:number,z:number,w:number,d:number,top=0){
  add({t:'platform',nm,p:[x,top-1.6,z],s:[w,3.2,d],tex:'custard-sandstone',color:stone});
}
function rock(nm:string,p:[number,number,number],s:[number,number,number],seed:number){add({t:'rock',nm,p,s,seed,color:dark,tex:'custard-sandstone'});}
function arrow(x:number,z:number,yaw=0){
  add({t:'mesh',nm:'Ochre escape route marking',p:[x,.027,z],vertices:[-.6,0,-.55,.6,0,-.55,0,0,.7],indices:[0,2,1],yaw,color:'#e0ba6a',tex:'solid',solid:false,doubleSided:true});
}
function torch(x:number,z:number){add({t:'torch',nm:'Old miner’s route lamp',p:[x,.1,z],rise:2.6,w:.65});}
function fruit(x:number,z:number,y=1){add({t:'wumpa',p:[x,y,z]});}

// The laboratory file already owns the published Haunted Hassle. Keep that
// course intact and expose this new source-owned brief through its own entry.
// 1. Readable side-on approach: daylight shelf -> low, dark cave -> skylight.
floor('Cave mouth approach',-60,0,28,9);
floor('Side-on cavern shelf',-28.5,0,29,9);
floor('Clearing · room to stop and read the exit',0,2,30,28);
// A short fissure teaches the jumping language before the pursuit begins.
add({t:'pit',nm:'Entrance fissure',p:[-44.5,-7,0],s:[3,1,13],color:'#181f22'});
add({t:'camnode',cameraView:true,nm:'Stable screen controls · right into cave, down to escape',p:[-20,6,125],s:[150,60,310],yaw:0,radius:2});
for(const x of [-72,-48,-16,0])add({t:'camnode',nm:'Entry route',p:[x,0,0]});
for(const z of [12,40,80,120,160,200,240,260])add({t:'camnode',nm:'Escape route',p:[0,0,z]});
add({t:'camnode',cameraView:true,cameraPresentationOnly:true,nm:'Run toward the lens · keep the collapse visible',
  p:[0,4,137],s:[46,42,258],radius:9,cameraPosition:[0,11,163],cameraTarget:[0,3,137],cameraFollowDistance:27,cameraFollowTargetHeight:2,cameraFov:55,cameraAspect:1.4});
// Camera heading and input stay stable through the clearing: right enters
// the cave, down runs toward the lens. The presentation never flips the stick.
for(let i=0;i<12;i++){
  const x=-70+i*5;
  rock('Stratified cave backdrop',[x,4,-7],[8,17,6],i+40);
  if(x>-62&&x<-14){rock('Open-front cave roof',[x,12,-1],[7,5,14],i+150);}
  if(i%3===0){rock('Near bank rubble',[x,-.5,6],[5,3,4],i+270);torch(x,-3.2);}
}
for(const x of [-68,-58,-50,-38,-30,-22,-13])fruit(x,0);
fruit(-44,0,2.4);
arrow(-22,0,-90);arrow(-12,0,-90);
// A collapsed skylight makes the trigger clearing a distinct, open composition.
for(const [i,x,z]of [[0,-13,-9],[1,10,-9],[2,14,4],[3,-13,10]])rock('Clearing buttress',[x,6,z],[7,17,7],800+i);
for(const z of [-7,4]){torch(10,z);torch(-10,z);}
add({t:'checkpoint',nm:'Skylight clearing · chase retry',p:[0,0,5]});
arrow(0,10);arrow(0,17);

// 2. The escape is intentionally runnable on foot: three three-metre breaks,
// generous landings and alternating stones with a clear middle line.
export const CAVE_GAPS:[[number,number],[number,number],[number,number]]=[[76,79],[136,139],[184,187]];
let start=16;
for(const [a,b]of [...CAVE_GAPS,[242,242]]){
  floor('Continuous cave causeway',0,(start+a)/2,13,a-start);
  if(a!==b){add({t:'pit',nm:'Broken causeway',p:[0,-7,(a+b)/2],s:[21,1,b-a],color:'#172128'});arrow(0,a-4);fruit(0,(a+b)/2,2.6);}
  start=b;
}
floor('Daylight escape terrace',0,251,28,30);
for(const [z,x]of [[51,-3.8],[108,3.8],[162,-3.8],[213,3.8]])rock('Fallen rock · choose the open lane',[x,1.1,z],[3.2,2.2,4.2],z);
for(let z=24;z<232;z+=16){
  torch(z%32===24?-5.6:5.6,z);
  if(!CAVE_GAPS.some(([a,b])=>z>a-4&&z<b+3))fruit(0,z);
}
// Collision stays authored and simple. The procedural arch supplies the visual
// enclosure; these exterior shoulders prevent bypassing its crumbling interior.
for(const side of [-1,1]){
  add({t:'wall',nm:'Cavern side boundary',p:[side*8,0,125],s:[2,18,226],invisible:true});
  for(let z=26;z<238;z+=24){
    add({t:'mesh',nm:'Turquoise mineral seam',p:[side*6.9,3.2,z],s:[.12,2.8,4],vertices:[-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1,-1,-1,1,1,-1,1,1,1,1,-1,1,1],indices:[0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,3,2,6,3,6,7],solid:false,color:teal,emissive:'#235749',tex:'solid'});
  }
  rock('Daylight mouth buttress',[side*12,6,244],[11,17,12],1900+side);
}
add({t:'gate',nm:'Out of the mountain',p:[0,0,258],yaw:180});
add({t:'pit',nm:'Off the shelves',p:[-17,-12,106],s:[150,1,340],invisible:true});

export const CAVE_COLLAPSE_PROFILE:CaveCollapseData={
  path:[[0,0,16],[0,0,236]],seed:73419,width:13,height:11,spacing:4.6,
  speed:7.8,trigger:3,headStart:16,warning:1.05,
};
export const CAVE_COLLAPSE_LEVEL:CustomLevelData={
  v:1,name:'Crumblewake Cave',spawn:[-69,.15,0],killY:-16,startWarpPad:false,
  sky:'haunted',keepPlayFog:true,cameraAirLift:.3,
  cameraRig:{camDist:15,camHeight:7,camPitch:18,camFov:55},
  atmosphere:{fogEnabled:true,fogNear:35,fogFar:115,fogColor:'#293337',ambientSky:'#beced0',ambientGround:'#54483c',ambientIntensity:1.35,
    sunColor:'#ffe0ae',sunIntensity:1.7,fillColor:'#79b5c7',fillIntensity:.8,shadowStrength:.65,drawDistance:200,backdrop:'fog'},
  caveCollapse:CAVE_COLLAPSE_PROFILE,medalTimes:{gold:37,silver:46,bronze:62},components,
};
