import type { CustomComponent } from '../level';
type Point = [number,number,number];
export const WATERPARK_SPAWN: Point = [0,80.15,58];
export const WATERPARK_FINISH: Point = [20,0,-660];
export const WATERPARK_LOOP = { entry: [0,0,-612] as Point, radius: 26, width: 12, offset: 20, yaw: 0, exit: [20,0,-612] as Point };
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
 {section:'A',p:[0,40,-129] as Point,radius:14,flatHalf:5,length:34,yaw:90,nearLip:-110,farLip:-148,lipY:54,dir:[0,0,-1] as Point},
 {section:'B',p:[0,22,-295] as Point,radius:12,flatHalf:5,length:30,yaw:90,nearLip:-278,farLip:-312,lipY:34,dir:[0,0,-1] as Point},
 {section:'B',p:[0,16,-332] as Point,radius:16,flatHalf:4,length:38,yaw:90,nearLip:-312,farLip:-352,lipY:32,dir:[0,0,-1] as Point},
 {section:'B',p:[0,20,-367] as Point,radius:10,flatHalf:5,length:30,yaw:90,nearLip:-352,farLip:-382,lipY:30,dir:[0,0,-1] as Point},
];
export const WATERPARK_JUMPS = [
 {name:'Wavebreaker downhill vault',takeoff:[0,48.2,-130] as Point,landing:[0,48,-160] as Point,dir:[0,0,-1] as Point},
 {name:'Boomerang downhill vault',takeoff:[0,26,-373] as Point,landing:[0,30,-400] as Point,dir:[0,0,-1] as Point},
 {name:'Dry flume splash',takeoff:[0,12,-520] as Point,landing:[0,12,-538] as Point,dir:[0,0,-1] as Point},
];
export const WATERPARK_CHECKPOINTS = [
 {p:[-4,48,-178] as Point,name:'Lower Wavebreaker checkpoint'},
 {p:[-4,0,-598] as Point,name:'Loop station checkpoint'},
];
export const WATERPARK_DOWNHILL = [
 {from:[0,80,44] as Point,to:[0,60,-16] as Point,name:'High tower drop'},
 {from:[0,48,-190] as Point,to:[0,34,-270] as Point,name:'Downhill park connector'},
 {from:[0,30,-424] as Point,to:[0,18,-466] as Point,name:'Upper flume approach'},
 {from:[0,18,-466] as Point,to:[0,4,-502] as Point,name:'Dry flume descent'},
 {from:[0,12,-554] as Point,to:[0,0,-590] as Point,name:'Splashdown runout'},
];

// Outer terrace/hillside grade for the architectural layer. Pool bowls remain
// excavated below this envelope; never fill their playable interiors with it.
export const WATERPARK_GRADE: Point[] = [
 [0,80,72],[0,80,44],[0,60,-16],[0,60,-24],[0,58,-65],[0,56,-96],[0,54,-148],
 [0,48,-160],[0,48,-190],[0,34,-270],[0,34,-278],[0,32,-332],[0,30,-382],[0,30,-424],
 [0,18,-466],[0,12,-538],[0,12,-554],[0,0,-590],[0,0,-682],
];

deck(0,58,80,28,28,1,'High admission tower deck');
ramp([0,60,14],60,20,20,180,1,'High tower downhill ramp');
lipApron(-20,60,24,8,1,'First pool drop-in apron');
ramp([0,60-Math.sqrt(28),-25],2,Math.sqrt(28),20,180,1,'First pool roll-in bevel');
for(const [i,pool] of WATERPARK_POOLS.entries()) C.push({t:'vertramp',p:pool.p,yaw:pool.yaw,len:pool.length,rise:pool.radius,w:pool.flatHalf,vkind:'half',arc:90,deck:0,rails:false,edgeGrinding:false,tex:'solid',color:i%2?AQUA:TEAL,grp:pool.section==='A'?2:4,nm:`${pool.section==='A'?'Wave pools':'Boomerang pools'} ${i<4?i+1:i-3} · ${pool.radius} m downhill vert`});
// Early kickers turn the last drop-in into a vault above the remaining bowl
// wall. Their short climb keeps gravity-earned speed without launch motors.
ramp([0,40.2,-126],8,8,18,0,2,'Wavebreaker gravity vault kicker');
deck(0,-175,48,32,30,3,'Wavebreaker catch terrace',AQUA);
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[0].p,grp:3,nm:WATERPARK_CHECKPOINTS[0].name});
ramp([0,34,-230],80,14,20,180,3,'Downhill park connector');
lipApron(-274,34,24,8,3,'Boomerang drop-in apron');
ramp([0,34-Math.sqrt(44),-279],2,Math.sqrt(44),20,180,3,'Boomerang roll-in bevel');
ramp([0,20,-370],6,6,20,0,4,'Boomerang gravity vault kicker');
deck(0,-412,30,32,24,5,'Boomerang catch terrace',AQUA);
ramp([0,18,-445],42,12,20,180,5,'Upper flume downhill approach');
ramp([0,4,-484],36,14,18,180,5,'Descending dry flume');
deck(0,-506,4,18,8,5,'Dry flume runout');
ramp([0,4,-515],10,8,18,0,5,'Gravity splash kicker');
deck(0,-546,12,26,16,5,'Dry splash catch deck',AQUA);
ramp([0,0,-572],36,12,18,180,5,'Splashdown runout');
deck(0,-601,0,18,22,6,'Loop station approach');
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[1].p,grp:6,nm:WATERPARK_CHECKPOINTS[1].name});
// One coaster launch motor remains: this finale still requires the player to
// maintain charge/real inward wheel pressure throughout the giant inversion.
C.push({t:'speedpad',p:[0,.025,-605],s:[12,.15,14],speed:64,cycle:.6,grp:6,nm:'Coaster loop launch motor'});
deck(20,-639,0,16,54,7,'Downhill loop exit promenade',AQUA);
C.push({t:'pit',p:[0,-16,-286],s:[160,1,780],invisible:true,grp:7,nm:'Drained downhill park fall basin'});
