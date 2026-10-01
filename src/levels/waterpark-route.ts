import type { CustomComponent } from '../level';
type Point = [number,number,number];
export const WATERPARK_SPAWN: Point = [0,80.15,58];
export const WATERPARK_LOOPS = [
 {entry:[0,-58,-668] as Point,radius:26,width:12,offset:20,yaw:0,exit:[20,-58,-668] as Point},
 {entry:[20,-80,-738] as Point,radius:26,width:12,offset:20,yaw:0,exit:[40,-80,-738] as Point},
 {entry:[40,-165,-1006] as Point,radius:26,width:12,offset:20,yaw:0,exit:[60,-165,-1006] as Point},
];
export const WATERPARK_LOOP=WATERPARK_LOOPS[0];
export const WATERPARK_FINISH: Point = [60,-165,-1060];
export const WATERPARK_COASTER_RAMPS = [
 {name:'First loop gravity drop',from:[0,12,-578] as Point,to:[0,-58,-658] as Point},
 {name:'Second loop gravity drop',from:[20,-58,-672] as Point,to:[20,-80,-726] as Point},
 {name:'Gap approach descent',from:[40,-80,-742] as Point,to:[40,-96,-776] as Point},
 {name:'Third loop gravity drop',from:[40,-100,-920] as Point,to:[40,-165,-992] as Point},
];
export const WATERPARK_CORE: CustomComponent[] = [];
const C=WATERPARK_CORE;
const AQUA='#8acac4',TEAL='#5b999c',CREAM='#daceaf',RUST='#b87658';
const deck=(x:number,z:number,top:number,w:number,len:number,grp:number,nm:string,color=CREAM)=>C.push({t:'platform',p:[x,top-.6,z],s:[w,1.2,len],tex:'solid',color,edgeGrinding:false,grp,nm});
const lipApron=(z:number,y:number,w:number,len:number,grp:number,nm:string)=>C.push({t:'mesh',p:[0,y,z],vertices:[-w/2,0,len/2,w/2,0,len/2,w/2,0,-len/2,-w/2,0,-len/2],indices:[0,1,2,0,2,3],vert:false,edgeGrinding:false,tex:'solid',color:CREAM,grp,nm});
const ramp=(p:Point,len:number,rise:number,w:number,yaw:number,grp:number,nm:string)=>C.push({t:'ramp',p,len,rise,w,yaw,tex:'solid',color:RUST,edgeGrinding:false,grp,nm});

// The whole main route runs downhill toward -Z. Shared XZ coping lines keep
// the existing deliberate spine transfer, while each receiving rim is 2 m
// lower. Width, radius and floor elevation change between the attractions.
export const WATERPARK_POOLS = [
 {section:'A',p:[0,52,-36] as Point,radius:8,flatHalf:4,length:24,yaw:90,nearLip:-24,farLip:-48,lipY:60,dir:[0,0,-1] as Point},
 {section:'A',p:[0,46,-65] as Point,radius:12,flatHalf:5,length:30,yaw:90,nearLip:-48,farLip:-82,lipY:58,dir:[0,0,-1] as Point},
 {section:'A',p:[0,46,-96] as Point,radius:10,flatHalf:4,length:26,yaw:90,nearLip:-82,farLip:-110,lipY:56,dir:[0,0,-1] as Point},
 {section:'A',p:[0,43,-129] as Point,radius:11,flatHalf:8,length:34,yaw:90,nearLip:-110,farLip:-148,lipY:54,dir:[0,0,-1] as Point,spillway:true},
 {section:'B',p:[0,22,-295] as Point,radius:12,flatHalf:5,length:30,yaw:90,nearLip:-278,farLip:-312,lipY:34,dir:[0,0,-1] as Point},
 {section:'B',p:[0,20,-332] as Point,radius:12,flatHalf:8,length:38,yaw:90,nearLip:-312,farLip:-352,lipY:32,dir:[0,0,-1] as Point},
 {section:'B',p:[0,22,-367] as Point,radius:8,flatHalf:7,length:30,yaw:90,nearLip:-352,farLip:-382,lipY:30,dir:[0,0,-1] as Point,spillway:true},
];
export function waterparkSpillwayY(pool:typeof WATERPARK_POOLS[number],z:number):number {
  const start=pool.p[2]+pool.flatHalf,t=Math.max(0,Math.min(1,(start-z)/(start-pool.farLip)));
  return pool.p[1]+.06+pool.radius*t*t;
}
export const WATERPARK_JUMPS = [
 {name:'Wavebreaker downhill vault',takeoff:[0,54.06,-148] as Point,landing:[0,48,-160] as Point,dir:[0,0,-1] as Point},
 {name:'Boomerang downhill vault',takeoff:[0,30.06,-382] as Point,landing:[0,30,-400] as Point,dir:[0,0,-1] as Point},
 {name:'Dry flume splash',takeoff:[0,12,-520] as Point,landing:[0,12,-538] as Point,dir:[0,0,-1] as Point},
 {name:'Final loop ravine jump',takeoff:[40,-94,-798] as Point,landing:[40,-100,-830] as Point,dir:[0,0,-1] as Point},
];
export const WATERPARK_CHECKPOINTS = [
 {p:[-4,48,-178] as Point,name:'Lower Wavebreaker checkpoint'},
 {p:[-4,12,-566] as Point,name:'Triple loop summit checkpoint'},
];
export const WATERPARK_DOWNHILL = [
 {from:[0,80,44] as Point,to:[0,60,-16] as Point,name:'High tower drop'},
 {from:[0,48,-190] as Point,to:[0,34,-270] as Point,name:'Downhill park connector'},
 {from:[0,30,-424] as Point,to:[0,18,-466] as Point,name:'Upper flume approach'},
 {from:[0,18,-466] as Point,to:[0,4,-502] as Point,name:'Dry flume descent'},
];

// Outer terrace/hillside grade for the architectural layer. Pool bowls remain
// excavated below this envelope; never fill their playable interiors with it.
export const WATERPARK_GRADE: Point[] = [
 [0,80,72],[0,80,44],[0,60,-16],[0,60,-24],[0,58,-65],[0,56,-96],[0,54,-148],
 [0,48,-160],[0,48,-190],[0,34,-270],[0,34,-278],[0,32,-332],[0,30,-382],[0,30,-424],
 [0,18,-466],[0,12,-538],[0,12,-578],[0,-58,-658],[0,-58,-672],
 [0,-80,-726],[0,-80,-742],[0,-96,-776],[0,-100,-830],[0,-100,-920],
 [0,-165,-992],[0,-165,-1080],
];

deck(0,58,80,28,28,1,'High admission tower deck');
ramp([0,60,14],60,20,20,180,1,'High tower downhill ramp');
lipApron(-20,60,24,8,1,'First pool drop-in apron');
ramp([0,60-Math.sqrt(28),-25],2,Math.sqrt(28),20,180,1,'First pool roll-in bevel');
for(const [i,pool] of WATERPARK_POOLS.entries()) C.push({t:'vertramp',p:pool.p,yaw:pool.yaw,len:pool.length,rise:pool.radius,w:pool.flatHalf,vkind:'half',arc:90,deck:0,rails:false,edgeGrinding:false,tex:'solid',color:i%2?AQUA:TEAL,grp:pool.section==='A'?2:4,nm:`${pool.section==='A'?'Wave pools':'Boomerang pools'} ${i<4?i+1:i-3} · ${pool.radius} m downhill vert`});
// The last bowl's exit IS the jump: a tangent-continuous curved spillway rises
// out of the trough to its rim. No detached wedge blocks the middle of a pipe.
function spillway(pool:typeof WATERPARK_POOLS[number],grp:number){
  const start=pool.p[2]+pool.flatHalf,len=start-pool.farLip,segments=32;
  const vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=segments;i++){const t=i/segments;for(const x of [-pool.length/2,pool.length/2])vertices.push(x,waterparkSpillwayY(pool,start-len*t)-pool.p[1],-len*t);}
  for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  C.push({t:'mesh',p:[0,pool.p[1],start],vertices,indices,vert:false,edgeGrinding:false,doubleSided:true,
    tex:'pavement',color:grp===2?'#84bab8':'#df9662',grp,nm:'Integrated curved pool exit'});
}
spillway(WATERPARK_POOLS[3],2);
deck(0,-175,48,32,30,3,'Wavebreaker catch terrace',AQUA);
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[0].p,grp:3,nm:WATERPARK_CHECKPOINTS[0].name});
ramp([0,34,-230],80,14,20,180,3,'Downhill park connector');
lipApron(-274,34,24,8,3,'Boomerang drop-in apron');
ramp([0,34-Math.sqrt(44),-279],2,Math.sqrt(44),20,180,3,'Boomerang roll-in bevel');
spillway(WATERPARK_POOLS[6],4);
deck(0,-412,30,32,24,5,'Boomerang catch terrace',AQUA);
ramp([0,18,-445],42,12,20,180,5,'Upper flume downhill approach');
ramp([0,4,-484],36,14,18,180,5,'Descending dry flume');
deck(0,-506,4,18,8,5,'Dry flume runout');
ramp([0,4,-515],10,8,18,0,5,'Gravity splash kicker');
deck(0,-546,12,26,16,5,'Dry splash catch deck',AQUA);
deck(0,-566,12,24,24,6,'Triple loop summit station');
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[1].p,grp:6,nm:WATERPARK_CHECKPOINTS[1].name});

/** A smooth road ribbon with zero slope at both ends. Gravity supplies its
 * energy; the tag only prevents the ordinary road cap deleting that energy. */
export function coasterRoad(from:Point,to:Point,width:number,name:string,curve=true):CustomComponent {
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],steps=curve?48:1;
  for(let i=0;i<=steps;i++){
    const t=i/steps,k=curve?(1-Math.cos(Math.PI*t))/2:t;
    for(const side of [-1,1]){vertices.push(side*width/2,(to[1]-from[1])*k,(to[2]-from[2])*t);uvs.push(side<0?0:width/4,t*Math.hypot(to[1]-from[1],to[2]-from[2])/4);}
    if(i<steps){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  return {t:'mesh',p:from,vertices,indices,uvs,vert:false,gravityTrack:true,edgeGrinding:false,doubleSided:true,tex:'pavement',color:'#6da7b6',grp:6,nm:name};
}
for(const run of WATERPARK_COASTER_RAMPS)C.push(coasterRoad(run.from,run.to,18,run.name));
for(const [a,b]of [
 [[0,-58,-658],[0,-58,-670]],[[20,-58,-668],[20,-58,-672]],[[20,-80,-726],[20,-80,-740]],
 [[40,-80,-738],[40,-80,-742]],[[40,-96,-776],[40,-96,-778]],
 [[40,-96,-778],[40,-94,-798]],[[40,-100,-830],[40,-100,-920]],
 [[40,-165,-992],[40,-165,-1008]],[[60,-165,-1006],[60,-165,-1070]],
 ] as [Point,Point][])C.push(coasterRoad(a,b,18,a[2]===-778?'Ravine jump kicker':'Coaster runout',false));
for(const loop of WATERPARK_LOOPS)C.push(coasterRoad(
  [loop.entry[0]+10,loop.entry[1],loop.entry[2]+8],
  [loop.entry[0]+10,loop.entry[1],loop.entry[2]],42,'Loop base recovery crossing',false));
// A missed jump lands on a service court. Its side bank returns to the launch
// instead of forcing a death/checkpoint reset or a one-way climb.
deck(40,-814,-110,58,32,6,'Ravine recovery court');
C.push(coasterRoad([12,-96,-778],[12,-110,-830],14,'Ravine return bank',false));
C.push(coasterRoad([26,-96,-772],[26,-96,-778],42,'Ravine return crossing',false));
C.push({t:'pit',p:[20,-210,-500],s:[240,1,1200],invisible:true,grp:7,nm:'Deep park fall basin'});
