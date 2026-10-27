import type {CustomComponent, CustomGroup, CustomLevelData} from '../level';
import {dressWaterfallClimb} from './waterfall-climb-art';
import {waterfallStone,waterfallRibbon,waterfallLeaf} from './waterfall-climb-geometry';

export type WaterfallPoint = [number,number,number];
type P=WaterfallPoint;
export interface WaterfallLanding {name:string;p:P;size:[number,number];section:number;kind:'stone'|'timber'|'crumble';bridge?:string;}
export interface WaterfallBeat {name:string;from:P;to:P;kind:'gap'|'spin'|'turn';bridge?:string;}
export interface WaterfallAction {
  name:string;kind:'walk'|'jump'|'spin'|'skate'|'ollie'|'grind'|'mover'|'bounce'|'enemy'|'cache'|'checkpoint'|'bonus';
  to:P;from?:P;points?:P[];target?:string;stop?:boolean;top?:number;section:number;
}
const C:CustomComponent[]=[],groups:CustomGroup[]=[];
export const WATERFALL_LANDINGS:WaterfallLanding[]=[];
export const WATERFALL_BEATS:WaterfallBeat[]=[];
export const WATERFALL_ACTIONS:WaterfallAction[]=[];
export const WATERFALL_CHECKPOINTS:P[]=[];
export const WATERFALL_SECTIONS:{name:string;start:P;end:P;mechanic:string}[]=[];
let section=10;
const add=(c:CustomComponent)=>C.push(c);
const act=(kind:WaterfallAction['kind'],name:string,to:P,extra:Partial<WaterfallAction>={})=>WATERFALL_ACTIONS.push({kind,name,to,section,...extra});
function chapter(id:number,name:string,start:P,end:P,mechanic:string){section=id;groups.push({id,nm:name});WATERFALL_SECTIONS.push({name,start,end,mechanic});}
function pad(name:string,p:P,w:number,d:number,kind:WaterfallLanding['kind']='stone'){
 const q:WaterfallLanding={name,p,size:[w,d],section,kind};WATERFALL_LANDINGS.push(q);
 if(kind==='stone'){add(waterfallStone(name,p,w,d,section));return q;}
 add({t:kind==='crumble'?'crumble':'platform',p:kind==='crumble'?[...p]:[p[0],p[1]-.6,p[2]],s:[w,kind==='crumble'?.6:1.2,d],
  ...(kind==='crumble'?{shake:2.25,speed:25}:{}),tex:kind==='timber'?'waterfall-timber':'waterfall-basalt',color:kind==='crumble'?'#d99d69':'#c5c8ac',grp:section,nm:name});return q;
}
function walk(p:P,name='Read the next crossing'){act('walk',name,p);}
function jump(name:string,a:P,b:P,bridge?:string){
 WATERFALL_BEATS.push({name,from:a,to:b,kind:bridge?'spin':'gap',...(bridge?{bridge}:{})});
 act(bridge?'spin':'jump',name,b,{from:a,...bridge?{target:bridge}:{}});
 for(const t of [.2,.55,.85])add({t:'wumpa',p:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t+1+Math.sin(t*Math.PI)*.8,a[2]+(b[2]-a[2])*t],grp:section,nm:name+' fruit arc'});
}
function cache(name:string,p:P,kind:CustomComponent['kind']='wood'){add({t:'crate',p,kind,grp:section,nm:name});act('cache',name,p,{target:name});}
function cp(name:string,p:P){add({t:'checkpoint',p,grp:section,nm:name});WATERFALL_CHECKPOINTS.push(p);act('checkpoint',name,p,{target:name});}
function bridge(name:string,p:P,span:number,yaw=0,hold=5.6,width=4.3){add({t:'spinbridge',p,s:[span,.38,width],yaw,hold,cycle:.32,tex:'waterfall-timber',color:'#e6c592',grp:section,nm:name});}
function path(name:string,points:P[],width:number|number[],skate=true,stop=true){
 const widths=typeof width==='number'?points.map(()=>width):width;
 add(waterfallRibbon(name,points,widths,section));
 if(skate)act('skate',name,points[points.length-1],{points,stop});
}
function rail(name:string,points:P[],from:P,to:P){
 const p=points[0];add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],3,q[1]-p[1]]),curve:'spline',color:'#c8ac71',grp:section,nm:name});
 act('grind',name,to,{from,points,target:name});
}
function mover(name:string,p:P,w:number,d:number,axis:'x'|'y'|'z',amp:number,speed:number,phase:number,from:P,to:P,top?:number){
 add({t:'mover',p,s:[w,.6,d],axis,amp,speed,phase,...name==='Drifting lily'?{...waterfallLeaf(w,d,.6),tex:'solid',color:'#ffffff'}:{tex:'creek-raft',color:'#c9cd91'},grp:section,nm:name});act('mover',name,to,{from,target:name,top});
}
function drum(name:string,p:P,to:P,speed=31){
 add({t:'trampoline',p,s:[4,.8,4],speed,amp:1.15,color:'#dfb55e',tex:'waterfall-timber',grp:section,nm:name});act('bounce',name,to,{from:p,target:name});
}
function foe(name:string,p:P,kind:'hopper'|'turtle'|'spiker'='hopper',range=1.5){
 add({t:'enemy',p,foe:kind,range,speed:1.1,grp:section,nm:name});act('enemy',name,p,{target:name});
}

// Every crossing below is authored in context. Helpers make objects, never a
// repeated chapter or switchback. Long connected stretches belong to skating.
chapter(10,'Reedwater',[0,0,9],[-3,1.2,-91],'offset stones, a thin log and a drifting leaf');
pad('Rooted arrival bank',[0,0,5],14,28);cache('Reedwater mask',[3,0,5],'mask');
pad('First wet stone',[-2,.3,-17],7,9);jump('Leave the river bank',[0,0,-8],[-2,.3,-13.5]);
pad('Narrow fallen branch',[-2,.3,-35],3.6,19,'timber');jump('Land along the branch',[-2,.3,-20.6],[-2,.3,-26.4]);
pad('Dragonfly stone',[1,.9,-51],7,7);jump('Branch to raised stone',[-2,.3,-43.6],[.1,.9,-48.4]);
pad('Reed shelter',[-3,1.2,-73],9,12);
mover('Drifting lily',[1,.9,-61],7,9,'x',2.5,.65,0,[1,.9,-53.5],[-3,1.2,-67.8]);
cache('Reed shelter parcel',[-4,1.2,-75]);
pad('Cedar root bank',[-3,1.2,-91],15,16);jump('Reach the cedar roots',[-3,1.2,-78],[-3,1.2,-84]);
foe('Cedar root hopper',[-2,1.2,-91]);cp('Cedar roots checkpoint',[-6,1.2,-94]);

chapter(11,'The fallen cedar',[-3,1.2,-98],[0,7,-363],'curved timber ride and exposed grind crossing');
walk([-3,1.2,-97],'Line up with the fallen trunk');
path('Ride the fallen cedar',[[-3,1.2,-98],[1,2,-132],[10,4,-176],[7,7,-217],[-8,7,-260],[-8,7,-289]],[7,6,5.6,5.6,6,8]);
pad('Cedar rail mounting crown',[-8,7,-286],10,13,'timber');
pad('Cedar far-bank catch',[-2,7,-361],23,34);
rail('Cedar spine over open river',[[-8,7.65,-280],[-8,8.2,-295],[-3,10,-315],[5,9,-333],[0,7.65,-353]],[-8,7,-282],[0,7,-357]);
cache('Far-bank cedar cache',[4,7,-360],'mystery');cp('Lotus lookout checkpoint',[-4,7,-365]);

chapter(12,'Lotus locks',[0,7,-371],[0,7,-466],'spin leaf, fragile stones and lateral ferry');
pad('Lotus lock sill',[0,7,-375],11,10);jump('Step off the cedar bank',[0,7,-370],[0,7,-371.4]);
bridge('First sluice leaf',[0,7,-379.6],9.8,90,7);
pad('First sluice receiver',[0,7,-396],8,9);jump('Open the first sluice',[0,7,-378.9],[0,7,-392.5],'First sluice leaf');
cache('Sluice keeper parcel',[1.7,7,-396]);
pad('Loose left stone',[-2.8,7.5,-406.1],5.6,7,'crumble');jump('Choose the left footing',[0,7,-399.6],[-2,7.5,-403.4]);
pad('Loose right stone',[.8,7.7,-415],5.6,7,'crumble');jump('Do not linger on loose stone',[-2,7.5,-408.8],[0,7.7,-412.3]);
pad('Ferry boarding island',[4,7,-429],10,14);jump('Land on the ferry bank',[0,7.7,-417.7],[1.5,7,-422.8]);
pad('Ferry far bank',[-10,7,-449],11,16);
mover('Lotus ferry',[-2,7,-441],7,7,'x',7,.52,0,[3.5,7,-435],[-7,7,-442]);
cache('Ferry shore life',[-12,7,-449],'life');
pad('Millrace staging bank',[0,7,-466],26,16);jump('Leave the reedbeds',[-6,7,-456],[-5,7,-459.5]);cp('Millrace checkpoint',[-5,7,-466]);

chapter(13,'The broken millrace',[0,7,-474],[0,9,-777],'banked carving and a momentum gap');
walk([0,7,-472],'Mount at the millrace head');
path('Millrace downhill carve',[[0,7,-474],[-8,5,-505],[-13,2,-542],[7,1,-575],[10,2,-605],[10,2,-612]],[14,13,12,13,13,13],true,false);
path('Millrace receiving channel',[[10,1.5,-624],[9,2,-645],[-10,4,-680],[-5,7,-721],[0,9,-770]],[16,14,13,13,18],false);
WATERFALL_BEATS.push({name:'Ollie the broken millrace',from:[10,2,-610.8],to:[10,1.5,-628],kind:'gap'});
act('ollie','Ollie the broken millrace',[10,1.5,-632],{from:[10,2,-610.8]});
act('skate','Carve uphill into the catch basin',[0,9,-770],{points:[[10,1.5,-632],[9,2,-645],[-10,4,-680],[-5,7,-721],[0,9,-770]],stop:true});
pad('Millrace catch basin',[0,9,-777],24,26);cache('Catch basin supplies',[-5,9,-778],'mystery');cp('Thunder pools checkpoint',[5,9,-781]);

chapter(14,'Thunder pools',[0,9,-790],[0,12,-1080],'rising pool jumps and a root-bank sprint');
pad('Pool one stone',[-4,9.6,-799],7,12);jump('Jump toward the left cascade',[-3,9,-789],[-3,9.6,-793.7]);
pad('Pool two stone',[-1,10.8,-813],8,14);jump('Rise above the whitewater',[-3,9.6,-803],[-2,10.8,-806.8]);
pad('Pool three log',[3,10.8,-830],4.8,16,'timber');jump('Find the narrow dry log',[1,10.8,-819],[2,10.8,-823]);
pad('Upper pool bank',[3,12,-849],14,14);jump('Reach the lock keeper',[3,10.8,-837],[3,12,-843]);
foe('Upper pool hopper',[5,12,-849]);cache('Upper pool cache',[0,12,-849]);
bridge('Thunder pool sluice',[3,12,-855.5],9.9,90,5.4);
pad('Thunder sluice receiver',[3,12,-872],10,10);jump('Spin across the last river lock',[3,12,-854.7],[3,12,-868],'Thunder pool sluice');
pad('Gorge root foot',[0,12,-886],15,12);jump('Waterfall root-bank arrival',[3,12,-876],[0,12,-881]);
path('Root bank toward the thunder',[[0,12,-892],[-8,14,-928],[-12,16,-965],[6,15,-1004],[8,12,-1040],[0,12,-1076]],[15,13,12,14,15,20]);

export const WATERFALL_RIVER_END=-1082;
export const WATERFALL_BASE_Y=12;
export const WATERFALL_FACE_Z=-1114;
const Z=-1112,LZ=Z-8;
chapter(20,'Thunder basin',[0,12,-1080],[-42,12,Z],'waterfall reveal and hidden bonus');
pad('Thunder basin breathing bank',[0,12,-1090],112,34);cp('Foot of the falls checkpoint',[0,12,-1090]);
cache('Thunder basin mask',[5,12,-1091],'mask');
add({t:'bonusplatform',p:[-24,12,-1086],to:[-19,12.12,-1086],grp:20,nm:'Behind the spray bonus entrance'});
act('bonus','Hidden spillway entrance',[-19,12,-1086]);
walk([-41,12,-1104],'Follow the basin toward the gatehouse');
pad('Gatehouse threshold',[-42,12,Z],12,11);jump('Step behind the spray',[-41,12,-1106],[-42,12,Z+4]);

chapter(21,'The lower gatehouse',[-42,12,Z],[4,25.4,Z],'unequal shelves and a jumping spin');
pad('Gatehouse first tooth',[-30,13.5,Z],6.5,7);jump('Climb the first tooth',[-36.8,12,Z],[-32.3,13.5,Z]);
pad('Gatehouse second tooth',[-20,15,Z],6,5.6);jump('Cross the short notch',[-27.5,13.5,Z],[-22,15,Z]);
pad('Gatehouse tall pier',[-10,16.9,Z],10,8);jump('Reach the tall pier',[-17.8,15,Z],[-13.6,16.9,Z]);
bridge('Gatehouse rising hinge',[-4.7,18.6,Z],9.2,0,6.4);
pad('Gatehouse hinge receiver',[8.5,18.6,Z],9,8);jump('Jump and spin the rising hinge',[-5.7,16.9,Z],[4.8,18.6,Z],'Gatehouse rising hinge');
cache('Gatehouse hinge parcel',[10,18.6,Z]);
pad('Carved gatehouse shelf',[19,20.3,Z],6,8);jump('Leave the hinge balcony',[12.2,18.6,Z],[17,20.3,Z]);
pad('Gatehouse upper ledge',[28,22.2,Z],6,6);jump('Climb beside the carved head',[21.3,20.3,Z],[26,22.2,Z]);
pad('Gatehouse turning drum bank',[36,23.8,Z],5,9);jump('Turn at the narrow end',[30.3,22.2,Z],[34.3,23.8,Z]);
pad('Gatehouse upper balcony',[26,25.4,Z-8],26,8);jump('Rise onto the return balcony',[36,23.8,Z-3.6],[35,25.4,Z-4.9]);
walk([22,25.4,Z-8],'Cross the broad upper balcony');cache('Gatehouse upper cache',[19,25.4,Z-8],'mystery');
path('Gatehouse return beam',[[14,25.4,LZ],[4,25.4,LZ],[0,25.4,LZ]],7,false);walk([4,25.4,Z-8]);walk([0,25.4,LZ]);
pad('Waterwheel lower dock',[-1,25.4,LZ],12,10);cp('Waterwheel checkpoint',[-3,25.4,LZ+1.7]);

chapter(22,'Waterwheel shaft',[0,25.4,LZ],[-24,53.4,LZ],'one long lift with a high exit');
pad('Waterwheel upper dock',[-25.5,53.4,LZ],18,12);
mover('Great waterwheel lift',[-12,39.4,LZ],8,7,'y',14,.48,-Math.PI/2,[-6.2,25.4,LZ],[-17,53.4,LZ],53.4);
cache('Waterwheel lookout life',[-27,53.4,LZ],'life');cp('Hanging aqueduct checkpoint',[-29,53.4,LZ+2]);

chapter(23,'The hanging aqueduct',[-24,53.4,LZ],[60,77.4,Z-14],'rising skate curve and a rail transfer');
walk([-28,53.4,LZ+3],'Face the rising aqueduct');
path('Aqueduct rising skate arc',[[-27,53.4,LZ+3],[-7,55.4,Z+5],[14,59.4,Z+6],[37,66.2,Z+4],[45,67.4,Z+2],[55,67.4,Z]],[9,9,10,11,12,14]);
pad('Aqueduct high catch',[55,67.4,Z],20,13,'timber');cache('Aqueduct bank parcel',[59,67.4,Z+2]);
path('Aqueduct uphill return',[[55,67.4,Z-2],[65,68.2,Z-4],[72,69.3,Z-12],[70,71,Z-24],[58,72.4,Z-30],[35,74.4,Z-28],[0,77.4,Z-17],[-10,77.4,Z-14]],[11,10,9,9,10,11,13,13]);
pad('Aqueduct rail approach',[-10,77.4,Z-14],17,10,'timber');
pad('Bell tower landing',[63,77.4,Z-14],36,13);
rail('Aqueduct crown rail',[[-15,78.05,Z-14],[2,80,Z-14],[23,82.4,Z-14],[43,80,Z-14],[55,78.05,Z-14]],[-12,77.4,Z-14],[58,77.4,Z-14]);
cp('Bell tower checkpoint',[61,77.4,Z-11]);

chapter(24,'The bell platforms',[57,77.4,Z-14],[-34,119.4,Z],'three distinct bounce transfers around the falling water');
// Drums are approached from a safe rim. Their offset receivers leave the
// ascent column empty: the player never jumps into the underside of a shelf.
pad('Lower bell receiving shelf',[42,91.4,Z-14],11,9);
drum('Lower bell drum',[52,77.4,Z-10],[46,91.4,Z-12],34);
cache('Lower bell reward',[40,91.4,Z-14],'mystery');
bridge('Bell keeper hinge',[36.5,91.4,Z-14],9.3,180,5.4);
pad('Bell keeper drum bank',[22,91.4,Z-14],12,10);
jump('Activate the bell keeper crossing',[37.4,91.4,Z-14],[27,91.4,Z-14],'Bell keeper hinge');
pad('Middle bell receiving shelf',[8,105.4,Z-10],12,10);
drum('Middle bell drum',[18,91.4,Z-14],[12.5,105.4,Z-10],34);
cache('Middle bell reward',[6,105.4,Z-10]);
pad('Upper bell receiving shelf',[-5,119.4,Z-5],12,12);
drum('Upper bell drum',[3,105.4,Z-10],[-.5,119.4,Z-6],34);
path('Cloud-rest root bridge',[[-7,119.4,Z],[-18,119.4,Z],[-34,119.4,Z]],9,false);walk([-29,119.4,Z]);
pad('Cloud rest balcony',[-34,119.4,Z],18,15);cp('Cloud rest checkpoint',[-36,119.4,Z+2]);cache('Cloud rest mask',[-38,119.4,Z-2],'mask');

chapter(25,'The broken crown',[-34,119.4,Z],[50,155.4,Z],'fragile approaches, short lifts and a final drum');
pad('Broken crown first shelf',[-20,121.1,Z],9,8);jump('Leave cloud rest',[-26,119.4,Z],[-22.5,121.1,Z]);
pad('Hanging rotten beam',[-10,122.4,Z],6,6,'crumble');jump('Land on the rotten beam',[-16.3,121.1,Z],[-12.2,122.4,Z]);
bridge('Rotten beam hinge',[-6.7,123.8,Z],9.1,0,5.4);
pad('Crown hinge refuge',[6.5,123.8,Z],9,9);jump('Spin before the beam gives way',[-7.8,122.4,Z],[3,123.8,Z],'Rotten beam hinge');
cache('Crown refuge supplies',[7,123.8,Z],'mystery');
pad('Counterweight middle dock',[22,132.4,Z],9,9);
mover('Crown counterweight step',[16,128.1,Z],5.5,6,'y',4.3,.85,-Math.PI/2,[10.1,123.8,Z],[18.5,132.4,Z],132.4);
pad('Counterweight upper dock',[35,141.4,Z],13,11);
mover('Crown counterweight return',[29,136.9,Z],5.5,6,'y',4.5,.85,Math.PI/2,[25.3,132.4,Z],[30,141.4,Z],141.4);
cp('Last spray checkpoint',[34,141.4,Z+2]);
pad('Skywater summit ledge',[49,155.4,Z],15,14);
drum('Last spray drum',[39,141.4,Z],[43,155.4,Z],34);

export const WATERFALL_SUMMIT_Y=155.4;
chapter(40,'The river source',[49,155.4,Z],[68,155.4,Z],'quiet summit and finish');
pad('Source pool rim',[62,155.4,Z],25,18);cache('Source pool final cache',[57,155.4,Z-3]);
add({t:'crystal',p:[61,156.6,Z],grp:40,nm:'The skywater crystal'});walk([62,155.4,Z],'Reach the source pool crystal');
add({t:'gate',p:[68,155.4,Z],yaw:90,w:9,grp:40,nm:'Waterfall summit finish'});

// The water never supplies invisible collision across a designed gap.
for(const [a,b,y]of [[24,-100,-4],[-100,-375,-4],[-375,-474,-4],[-474,-790,-4],[-790,-1082,5]])
 {add({t:'pit',p:[0,y,(a+b)/2],s:[80,1,a-b],invisible:true,grp:90,nm:'Reach '+a+' river contact'});
 add({t:'mesh',p:[0,y+.1,(a+b)/2],vertices:[-40,0,(a-b)/2,40,0,(a-b)/2,40,0,-(a-b)/2,-40,0,-(a-b)/2],indices:[0,1,2,0,2,3],solid:false,doubleSided:true,color:'#71a4a0',tex:'solid',grp:90,nm:'Greybox river reach'});}
add({t:'mesh',p:[0,0,Z-24],vertices:[-80,6,0,80,6,0,80,160,0,-80,160,0],indices:[0,1,2,0,2,3],solid:false,doubleSided:true,color:'#bed9d1',tex:'solid',grp:90,nm:'Greybox tall waterfall'});
add({t:'pit',p:[0,6,Z],s:[180,1,90],invisible:true,grp:90,nm:'Waterfall plunge pool'});
add({t:'zone',p:[0,0,-524],s:[90,200,1120],dir:'S',grp:91,nm:'Forward river controls'});
add({t:'zone',p:[0,80,Z-2],s:[190,200,68],dir:'E',grp:91,nm:'Constant waterfall side controls'});
add({t:'camnode',p:[0,80,Z-2],s:[190,220,68],cameraView:true,cameraPresentationOnly:true,radius:4,
 cameraPosition:[0,8,24],cameraTarget:[0,4.5,0],cameraFollowDistance:20,cameraKeepDistance:true,cameraFollowTargetHeight:4.5,cameraFov:54,grp:91,nm:'Waterfall side-view ascent'});
for(const p of [[0,0,18],[0,1,-90],[0,7,-280],[0,7,-375],[0,7,-475],[0,2,-610],[0,9,-780],[0,12,-890],[0,12,-1065],[0,12,-1090]] as P[])add({t:'camnode',p,radius:7,grp:91});
for(const s of WATERFALL_SECTIONS.filter(s=>s.start[2]<-1100))for(const p of [s.start,s.end])add({t:'camnode',p,radius:3,grp:91});
groups.push({id:90,nm:'River contact and plunge pool',editorOnly:true},{id:91,nm:'Camera and travel volumes',editorOnly:true});
add({t:'clock',p:[-3,0,9],grp:10,nm:'Waterfall time trial'});

// The source-owned art pass preserves the measured greybox gameplay fingerprint.
export const WATERFALL_GREYBOX=false;
if(!WATERFALL_GREYBOX)dressWaterfallClimb(C,groups,{landings:WATERFALL_LANDINGS,riverEnd:WATERFALL_RIVER_END,baseY:12,faceZ:WATERFALL_FACE_Z,summitY:WATERFALL_SUMMIT_Y});
export const WATERFALL_CLIMB_LEVEL:CustomLevelData={v:1,name:'Waterfall Climb',spawn:[0,.12,9],killY:-18,fallRecoveryDrop:20,
 startWarpPad:false,sky:'day',cameraAirLift:.5,hugeDropBail:false,medalTimes:{gold:420,silver:510,bronze:630},
 keepPlayFog:true,jungleAtmosphere:true,jungleStyle:'painterly',jungleDepthFade:false,
 atmosphere:{fogEnabled:true,fogNear:85,fogFar:400,fogColor:'#9abcb2',ambientSky:'#e1f2de',ambientGround:'#314d3d',ambientIntensity:1.7,
 sunColor:'#ffe1a8',sunIntensity:1.8,fillColor:'#a2d6c7',fillIntensity:.85,drawDistance:520,shadowStrength:.65},components:C,groups};
