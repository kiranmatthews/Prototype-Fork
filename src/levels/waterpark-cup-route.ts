// Recovered non-linear route from 871051744312ccfe8d0bcc9b2c6dda833fed1789.
import type { CustomComponent } from '../level';
type Point = [number,number,number];
export const WATERPARK_SPAWN: Point = [-53,12.15,44];
export const WATERPARK_LOOP = { entry: [138,0,0] as Point, radius: 26, width: 12, offset: 20, yaw: 180, exit: [118,0,0] as Point };
export const WATERPARK_CORE: CustomComponent[] = [];
const C=WATERPARK_CORE;
const AQUA='#8acac4',TEAL='#5b999c',CREAM='#daceaf',RUST='#b87658';
const deck=(x:number,z:number,top:number,w:number,len:number,grp:number,nm:string,color=CREAM)=>C.push({t:'platform',p:[x,top-.6,z],s:[w,1.2,len],tex:'solid',color,edgeGrinding:false,grp,nm});
const ramp=(p:Point,len:number,rise:number,w:number,yaw:number,grp:number,nm:string)=>C.push({t:'ramp',p,len,rise,w,yaw,tex:'solid',color:RUST,edgeGrinding:false,grp,nm});

export const WATERPARK_POOLS = [
 {section:'A',p:[-48,4,12] as Point,radius:8,flatHalf:4,length:24,yaw:90,nearLip:24,farLip:0,lipY:12,dir:[0,0,-1] as Point},
 {section:'A',p:[-48,0,-17] as Point,radius:12,flatHalf:5,length:30,yaw:90,nearLip:0,farLip:-34,lipY:12,dir:[0,0,-1] as Point},
 {section:'A',p:[-48,2,-48] as Point,radius:10,flatHalf:4,length:26,yaw:90,nearLip:-34,farLip:-62,lipY:12,dir:[0,0,-1] as Point},
 {section:'A',p:[-48,-2,-81] as Point,radius:14,flatHalf:5,length:34,yaw:90,nearLip:-62,farLip:-100,lipY:12,dir:[0,0,-1] as Point},
 {section:'B',p:[17,6,-160] as Point,radius:12,flatHalf:5,length:30,yaw:0,nearLip:0,farLip:34,lipY:18,dir:[1,0,0] as Point},
 {section:'B',p:[54,2,-160] as Point,radius:16,flatHalf:4,length:38,yaw:0,nearLip:34,farLip:74,lipY:18,dir:[1,0,0] as Point},
 {section:'B',p:[89,8,-160] as Point,radius:10,flatHalf:5,length:30,yaw:0,nearLip:74,farLip:104,lipY:18,dir:[1,0,0] as Point},
];
export const WATERPARK_JUMPS = [
 {name:'Wavebreaker gap',takeoff:[-48,12,-100] as Point,landing:[-48,12,-118] as Point,dir:[0,0,-1] as Point},
 {name:'Coaster crest gap',takeoff:[104,18,-160] as Point,landing:[118,18,-160] as Point,dir:[1,0,0] as Point},
 {name:'Dry flume splash',takeoff:[138,16,-78] as Point,landing:[138,14,-58] as Point,dir:[0,0,1] as Point},
];
export const WATERPARK_CHECKPOINTS = [
 {p:[-32,12,-142] as Point,name:'Fountain concourse checkpoint'},
 {p:[134,0,-14] as Point,name:'Loop station checkpoint'},
];

deck(-48,36,12,28,24,1,'Upper waterpark entry terrace');
for(const [i,pool] of WATERPARK_POOLS.entries()) C.push({t:'vertramp',p:pool.p,yaw:pool.yaw,len:pool.length,rise:pool.radius,w:pool.flatHalf,vkind:'half',arc:90,deck:0,rails:false,edgeGrinding:false,tex:'solid',color:i%2?AQUA:TEAL,grp:pool.section==='A'?2:4,nm:`${pool.section==='A'?'Wave pools':'Coaster pools'} ${i<4?i+1:i-3} · ${pool.radius} m vert`});
// The ramp begins within the flat, so normal surface contact takes over before
// the giant bowl's far transition curves up underneath it.
C.push({t:'speedpad',p:[-48,-1.975,-78.5],s:[12,.15,5],speed:43,cycle:.7,grp:2,nm:'Wavebreaker launch rollers'});
ramp([-48,-2,-90.5],19,14,18,0,2,'Wavebreaker exit kicker');
deck(-48,-130,12,36,24,3,'Wavebreaker catch terrace',AQUA);
C.push({t:'platform',p:[0,11.4,0],s:[1,1.2,1],pts:[[-66,-118],[-30,-118],[-18,-144],[-18,-170],[-42,-170],[-66,-142]],tex:'solid',color:CREAM,edgeGrinding:false,grp:3,nm:'Fountain concourse turn'});
ramp([-17,12,-160],26,6,20,-90,3,'Concourse ascent into east coaster');
deck(-2,-160,18,4,20,3,'Coaster coping entry apron');
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[0].p,grp:3,nm:WATERPARK_CHECKPOINTS[0].name});
ramp([96.5,8,-160],15,10,20,-90,4,'Coaster crest exit kicker');
deck(136,-160,18,36,36,5,'Coaster crest catch terrace',AQUA);
deck(138,-142,18,28,32,5,'Upper flume turn');
ramp([138,4,-114.5],27,14,18,0,5,'Descending dry flume');
deck(138,-98.5,4,18,5,5,'Flume launch apron');
C.push({t:'speedpad',p:[138,4.025,-98.5],s:[12,.15,5],speed:39,cycle:.6,grp:5,nm:'Dry flume launch rollers'});
ramp([138,4,-87],18,12,18,180,5,'Dry splash kicker');
deck(138,-51,14,26,14,5,'Dry splash catch deck',AQUA);
ramp([138,0,-31],26,14,18,0,5,'Splashdown runout');
deck(138,-9,0,18,18,6,'Loop station approach');
C.push({t:'checkpoint',p:WATERPARK_CHECKPOINTS[1].p,grp:6,nm:WATERPARK_CHECKPOINTS[1].name});
C.push({t:'speedpad',p:[138,.025,-7],s:[12,.15,14],speed:64,cycle:.6,grp:6,nm:'Coaster loop launch motor'});
deck(118,26,0,16,52,7,'Loop return and park exit',AQUA);
C.push({t:'pit',p:[40,-12,-60],s:[280,1,270],invisible:true,grp:7,nm:'Drained waterpark fall basin'});
