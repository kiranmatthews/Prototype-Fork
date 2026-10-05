import type { CustomComponent, CustomLevelData } from '../level';

type Point = [number,number,number];
export interface AfterHoursStage {
  id:string; name:string; grp:number;
  kind:'aim'|'moving-landings'|'carve'|'phase'|'rail-transfer'|'weave'|'uphill'|'finale';
  start:Point; end:Point; checkpoint?:Point;
}
// The route is a sequence of jobs, not a road with optional obstacles beside it.
// Supported docks give each new idea a readable approach; the void makes the
// intended actions necessary. No trick locks or changes to player movement.
export const AFTER_HOURS_STAGES:AfterHoursStage[] = [
 {id:'freight',name:'Freight switchyard',grp:1,kind:'aim',start:[0,10,10],end:[-8,12,-88]},
 {id:'ferries',name:'Scissor delivery decks',grp:2,kind:'moving-landings',start:[-8,12,-88],end:[-8,12,-178],checkpoint:[-8,12,-89]},
 {id:'cutbacks',name:'Quarry cutbacks',grp:3,kind:'carve',start:[-8,12,-180],end:[20,14,-278],checkpoint:[-8,12,-176]},
 {id:'shift-lights',name:'Amber and blue shift',grp:4,kind:'phase',start:[20,14,-278],end:[20,14,-377],checkpoint:[20,14,-279]},
 {id:'rail-ferry',name:'Counterweight ridge handoff',grp:5,kind:'rail-transfer',start:[20,14,-377],end:[114,14,-379],checkpoint:[20,14,-375]},
 {id:'workbay',name:'Pendulum workbay',grp:6,kind:'weave',start:[114,14,-379],end:[114,14,-479],checkpoint:[114,14,-381]},
 {id:'crown',name:'Crown launchbacks',grp:7,kind:'uphill',start:[114,14,-479],end:[120,34,-590],checkpoint:[114,14,-477]},
 {id:'last-shift',name:'Last shift exam',grp:8,kind:'finale',start:[120,34,-590],end:[132,36,-684],checkpoint:[120,34,-589]},
];
export const AFTER_HOURS_CHECKPOINTS = AFTER_HOURS_STAGES.flatMap(s=>s.checkpoint?[s.checkpoint]:[]);
export const AFTER_HOURS_FINISH:Point=[132,36,-684];
export const AFTER_HOURS_CUTBACKS:Point[]=[[-8,12,-182],[-8,12,-205],[50,13,-205],[50,13,-245],[20,14,-245],[20,14,-274]];
export const AFTER_HOURS_FERRIES=[
 {p:[-8,12,-116] as Point,s:[10,5.5,16] as Point,axis:'x' as const,amp:5,speed:.55,phase:.3},
 {p:[-8,12.5,-137] as Point,s:[10,5.5,16] as Point,axis:'x' as const,amp:5,speed:.55,phase:Math.PI+.3},
 {p:[-8,12,-157] as Point,s:[11,6,18] as Point,axis:'y' as const,amp:1.2,speed:.65,phase:Math.PI/2},
];
export const AFTER_HOURS_PHASES=[-308,-325,-342,-359].flatMap((z,i)=>[
 {p:[15,14,z] as Point,cycle:5.2,phase:i%2===0?0:.5,amp:.58},
 {p:[25,14,z] as Point,cycle:5.2,phase:i%2===0?.5:0,amp:.58},
]);
export const AFTER_HOURS_RAILS=[
 {p:[46,16.1,-375] as Point,len:34,yaw:90,axis:'z' as const,amp:2.2,speed:.6,phase:0},
 {p:[84,16.1,-379] as Point,len:34,yaw:90,axis:'z' as const,amp:2.2,speed:.6,phase:Math.PI},
 {p:[126,35.15,-647] as Point,len:38,yaw:0,axis:'x' as const,amp:3.5,speed:.55,phase:.4},
];
export const AFTER_HOURS_GAPS=[
 {name:'Freight east catch',takeoff:[0,10.8,-23] as Point,landing:[9,10,-45] as Point,grp:1},
 {name:'Freight west catch',takeoff:[5,11.8,-59] as Point,landing:[-8,12,-84] as Point,grp:1},
 {name:'West crown catch',takeoff:[102,22,-519] as Point,landing:[95,24,-536] as Point,grp:7},
 {name:'East crown catch',takeoff:[113,32,-572] as Point,landing:[120,34,-588] as Point,grp:7},
];
// These are genuine empty seams, including their lateral footprints. Moving
// islands are tested over their whole sweep separately, not labelled as void.
export const AFTER_HOURS_VOID_CUTS=[
 {grp:1,p:[5,7,-31] as Point,axis:'x' as const,halfWidth:18},
 {grp:1,p:[-1,7,-70] as Point,axis:'x' as const,halfWidth:22},
 {grp:2,p:[-8,7,-104] as Point,axis:'x' as const,halfWidth:20},
 {grp:4,p:[20,9,-299] as Point,axis:'x' as const,halfWidth:24},
 {grp:5,p:[65,10,-377] as Point,axis:'z' as const,halfWidth:22},
 {grp:7,p:[98,18,-523] as Point,axis:'x' as const,halfWidth:22},
 {grp:8,p:[126,28,-624] as Point,axis:'x' as const,halfWidth:24},
];

export function createNightworksAfterHours():CustomLevelData {
 const C:CustomComponent[]=[],groups=AFTER_HOURS_STAGES.map(s=>({id:s.grp,nm:`${s.grp} · ${s.name}`,editorOnly:true}));
 let grp=1;
 const add=(c:CustomComponent):void=>{C.push({...c,grp:c.grp??grp});};
 const stone={color:'#a8a39a',tex:'stone',emissive:'#17233a'};
 const torch=(x:number,y:number,z:number,h=2.5):void=>add({t:'torch',p:[x,y,z],rise:h,w:.9});
 const island=(name:string,p:Point,w:number,d:number,h=8):void=>{
  add({t:'platform',nm:name,dkind:d/w>1.35?'nightlongisland':'nightplateau',p:[p[0],p[1]-h/2,p[2]],s:[w,h,d],edgeGrinding:false});
  for(const side of [-1,1])for(const end of [-1,1])torch(p[0]+side*w*.35,p[1],p[2]+end*d*.32);
 };
 const ramp=(name:string,a:Point,b:Point,w:number):void=>{
  const len=Math.hypot(b[0]-a[0],b[2]-a[2]),yaw=Math.atan2(-(b[0]-a[0]),-(b[2]-a[2]))*180/Math.PI;
  add({t:'ramp',nm:name,p:[(a[0]+b[0])/2,Math.min(a[1],b[1]),(a[2]+b[2])/2],len,rise:Math.abs(b[1]-a[1]),w,yaw:b[1]>=a[1]?yaw:yaw+180,edgeGrinding:false,depthBias:-1,...stone});
  const n=Math.max(1,Math.ceil(len/16));for(let i=0;i<n;i++){
   const t=(i+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
   add({t:'decor',dkind:'nightlongisland',p:[x,y-9,z],s:[len/n+2,7.8,w+1],yaw:yaw+90,amp:Math.atan2(b[1]-a[1],len)*180/Math.PI});
  }
 };
 const milk=(p:Point):void=>add({t:'wumpa',p:[p[0],p[1]+1.05,p[2]]});
 const goblin=(p:Point,range=2.5,foe:CustomComponent['foe']='grunt'):void=>add({t:'enemy',nm:'Nightworks Snot Goblin',p,range,speed:1.7,foe});
 const view=(name:string,x0:number,x1:number,z0:number,z1:number,y:number,yaw=0):void=>{
  const side=Math.abs(yaw)===90;
  add({t:'camnode',nm:name,cameraView:true,p:[(x0+x1)/2,y,(z0+z1)/2],s:[side?z1-z0:x1-x0,65,side?x1-x0:z1-z0],yaw,radius:2,cameraFov:60,cameraAspect:16/9});
 };

 // 1. Aim before letting go: street airs carry their committed heading.
 island('Freight loading dock',[0,10,0],20,42,11);
 add({t:'clock',nm:'Optional time trial side bay',p:[-6.5,10,5]});
 ramp('East freight launch',[0,10,-12],[0,10.8,-23],12);
 island('East catch and realignment',[9,10,-46],14,24,9);
 ramp('West freight launch',[9,10,-48],[5,11.8,-59],10);
 island('Scissor reading dock',[-8,12,-88],24,30,12);
 // A stack closes the tempting central freight line; the side opening is
 // visible on the receiving dock, and has enough ground to set the next aim.
 add({t:'platform',nm:'Freight stack',dkind:'nightsteppingrock',p:[13,11.8,-46],s:[5,3.6,5],edgeGrinding:false});
 for(const p of [[0,10,8],[0,10,-9],[2,11,-27],[7,11,-37],[7,10,-48],[-2,13,-69],[-8,12,-83]] as Point[])milk(p);
 goblin([14,10,-52],.7);
 view('Freight: stable takeoff view',-25,25,-102,22,12);

 // 2. Two opposing deliveries, then a small rising/falling catch. None has
 // a fixed road beneath it. The braziers travel with their rock decks.
 grp=2;
 for(const [i,m]of AFTER_HOURS_FERRIES.entries())add({t:'mover',nm:`Delivery ${i+1}`,dkind:'nightsteppingrock',...m,lit:true});
 island('Cutback reading dock',[-8,12,-180],22,24,10);
 // The travelling braziers mark the real decks; fixed pickups would lie
 // outside a moving island at the ends of its sweep.
 view('Delivery decks: show the full moving footprint',-28,14,-191,-99,16);

 // 3. Four actual turns, with empty inside corners. Keep the camera facing
 // north so a held forward input does not steer this road for the rider.
 grp=3;
 add({t:'vertramp',nm:'Four quarry cutbacks',p:[-8,12,-182],vkind:'half',
  pts:AFTER_HOURS_CUTBACKS.map(([x,y,z],i)=>[x+8,z+182,i===0||i===AFTER_HOURS_CUTBACKS.length-1?0:12,y-12]),
  curve:'corner',w:3.1,rise:2.7,arc:58,deck:.5,vert:false,rails:false,bank:0,arcSteps:12,depthBias:-1,...stone});
 for(let i=0;i<AFTER_HOURS_CUTBACKS.length-1;i++){
  const a=AFTER_HOURS_CUTBACKS[i],b=AFTER_HOURS_CUTBACKS[i+1],len=Math.hypot(b[0]-a[0],b[2]-a[2]),n=Math.ceil(len/17);
  for(let j=0;j<n;j++){
   const t=(j+.5)/n,p:Point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
   add({t:'decor',dkind:'nightlongisland',p:[p[0],p[1]-10,p[2]],s:[12,8,20],yaw:-Math.atan2(b[0]-a[0],-(b[2]-a[2]))*180/Math.PI});milk(p);
  }
 }
 island('Shift-light reading dock',[20,14,-278],26,30,11);
 ramp('Shift lane release bank',[20,14,-282],[20,15.1,-294],18);
 view('Cutbacks: rider chooses each turn',-20,63,-290,-186,16);

 // 4. Complementary teams give a readable choice, rather than a blind wait.
 // Alternating the teams per station prevents a permanent safe central lane.
 grp=4;
 for(const [i,pad]of AFTER_HOURS_PHASES.entries())add({t:'phasepad',nm:`Shift station ${Math.floor(i/2)+1} ${i%2?'blue':'amber'}`,dkind:'nightphaserock',p:pad.p,s:[8,5.5,i<4?14:11],cycle:pad.cycle,phase:pad.phase,amp:pad.amp});
 island('Counterweight launch dock',[20,14,-386],40,40,12);
 for(const pad of AFTER_HOURS_PHASES)milk(pad.p);
 view('Shift lights: both lanes stay in view',1,38,-371,-288,18);

 // 5. The ridge ferry IS the crossing. Two counter-moving lines need a
 // deliberate pop and lateral recatch; a normal street ollie cannot span it.
 grp=5;
 for(const [i,rail]of AFTER_HOURS_RAILS.slice(0,2).entries())add({t:'rail',nm:`Counterweight ridge ${i+1}`,dkind:'nightrockridge',color:'#fff0cf',...rail});
 island('Pendulum receiving dock',[114,14,-379],26,28,12);
 // The illuminated moving crests are the targets, with no fixed trail
 // in the void suggesting a different line.
 view('Counterweight handoff: east from the dock',8,107,-390,-370,18,-90);

 // 6. Alternating quarry stacks and pendulums use the full narrow road.
 // Weaving, a well-timed ollie or a controlled approach are all honest choices.
 grp=6;
 ramp('Workbay north road',[114,14,-389],[114,14,-468],8);
 for(const [x,z]of [[112.2,-412],[115.8,-435]]){
  add({t:'platform',nm:'Workbay quarry obstruction',dkind:'nightsteppingrock',p:[x,16.1,z],s:[5.4,4.2,4],edgeGrinding:false});
  torch(x,18.2,z,2);
 }
 for(const [z,phase]of [[-421,0],[-448,Math.PI/2]])add({t:'pendulum',nm:'Quarry counterweight',p:[114,22,z],len:7.2,amp:.85,speed:1.1,phase});
 goblin([114,14,-455],2.4,'hopper');
 island('Crown run-up dock',[114,14,-478],24,28,12);
 for(const p of [[114,14,-397],[116.5,14,-412],[114,14,-422],[111.5,14,-435],[114,14,-448],[114,14,-471]] as Point[])milk(p);
 view('Workbay: read the opening and swinging bob',101,128,-491,-365,18);

 // 7. Climb, launch to a higher west shelf, then realign for the east shelf.
 // The opposing launchbacks test aiming and speed, not an invisible jump lock.
 grp=7;
 ramp('West crown ascent',[114,14,-490],[102,22,-519],10);
 island('West crown realignment',[95,24,-537],24,28,14);
 ramp('East crown ascent',[95,24,-545],[113,32,-572],10);
 island('Last-shift reading dock',[120,34,-590],24,28,15);
 for(const p of [[111,16,-496],[105,21,-513],[98,25,-528],[95,24,-541],[103,28,-557],[112,32,-570],[118,35,-582]] as Point[])milk(p);
 goblin([86,24,-534],2);
 view('Crown launchbacks: stable north view',80,142,-608,-487,30);

 // 8. One taught phase approach, one moving grind catch, one higher landing.
 // The gate sits beyond that landing, not past another empty runway.
 grp=8;
 add({t:'phasepad',nm:'Last-shift phase approach',dkind:'nightphaserock',p:[120,34,-613],s:[12,7,12],cycle:5.2,phase:.25,amp:.64});
 add({t:'rail',nm:'Last-shift moving ridge',dkind:'nightrockridge',color:'#fff0cf',...AFTER_HOURS_RAILS[2]});
 island('Summit finish dock',[132,36,-683],24,25,16);
 // The east roof is a skateable reward line, not required finish terrain.
 add({t:'vertramp',nm:'Summit crystal quarter',p:[143,36,-679],len:15,vkind:'quarter',w:1,rise:4,arc:65,deck:3,yaw:0,rails:true,...stone});
 add({t:'crystal',p:[148,39.8,-679]});
 for(const p of [[139,36,-676],[141.5,36,-677]] as Point[])milk(p);
 goblin([126,36,-682],1.7,'hopper');
 add({t:'gate',p:AFTER_HOURS_FINISH});
 for(const p of [[120,34,-600],[120,34,-613],[130,37,-675]] as Point[])milk(p);
 view('Last shift: phase and moving ridge',103,150,-705,-603,38);
 // A side bonus dock is deliberate: automatic midpoint placement must never
 // occupy the required cutback road as it did in the first implementation.
 add({t:'bonusplatform',nm:'Summit bonus dock',p:[139,36,-692],to:[136,36.1,-692]});
 for(const stage of AFTER_HOURS_STAGES)if(stage.checkpoint)add({t:'checkpoint',p:stage.checkpoint,grp:stage.grp,nm:`${stage.name} checkpoint`});

 // Route order and heights disambiguate the crossed/lateral sections. Fixed
 // views above provide controls on each action; lane nodes still frame resets.
 const lane:Point[]=[[0,10,20],[0,10,-22],[9,10,-46],[-8,12,-88],[-8,12,-180],
  ...AFTER_HOURS_CUTBACKS.slice(1),[20,14,-377],[114,14,-379],[114,14,-478],
  [102,22,-519],[95,24,-537],[113,32,-572],[120,34,-590],[126,35,-647],[132,36,-696]];
 for(const p of lane)add({t:'camnode',p,radius:5,grp:1});
 for(const [x,y,z,yaw]of [[-42,-6,-45,20],[32,-7,-128,-15],[-35,-5,-213,10],[76,-9,-245,-20],[-17,-4,-332,15],
  [67,-5,-418,20],[155,1,-458,-18],[63,10,-550,14],[166,17,-651,-16]])add({t:'decor',dkind:'nightdistantarch',p:[x,y,z],s:[28,36,12],yaw,color:'#7588ac',grp:1});
 return {v:1,name:'Nightworks: After Hours',spawn:[0,10.1,10],killY:-35,sky:'night',keepPlayFog:true,
  cameraAirLift:.5,medalTimes:{gold:75,silver:105,bronze:150},components:C,groups};
}
export const NIGHTWORKS_AFTER_HOURS_LEVEL=createNightworksAfterHours();
