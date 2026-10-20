import type { CustomComponent, CustomLevelData } from '../level';

// Nightworks II: the quarry's delivery line after the platforms stop working.
// Every required action is a carve, ramp climb or board ollie. The high ridges
// are optional grind shortcuts; there are no waits, ropes or on-foot stairs.
export const AFTER_HOURS_GAPS = [
  { name: 'First freight gap', takeoff: [0,14,-122], landing: [0,12,-131] },
  { name: 'Moon bridge gap', takeoff: [0,14,-388], landing: [0,11,-398] },
  { name: 'Last shift gap', takeoff: [0,26,-563], landing: [0,24,-573] },
] as const;
export const AFTER_HOURS_CHECKPOINTS = [[0,12,-151],[0,12,-338],[0,24,-543]] as const;
export const AFTER_HOURS_SNAKE = [
  [0,12,-169],[0,12,-191],[22,12,-217],[26,12,-257],
  [4,12,-287],[0,12,-321],
] as const;
export const AFTER_HOURS_FINISH = [0,24,-611] as const;

export function createNightworksAfterHours(): CustomLevelData {
  const components: CustomComponent[] = [];
  const add = (c: CustomComponent): void => { components.push(c); };
  const stone = {color:'#acaaa6',tex:'stone',emissive:'#182139'};
  const torch = (x:number,y:number,z:number):void => add({t:'torch',p:[x,y,z],rise:2.5,w:.9});
  const island = (x:number,y:number,z:number,w:number,d:number,h=9):void => {
    add({t:'platform',dkind:d/w>1.35?'nightlongisland':'nightplateau',
      p:[x,y-h/2,z],s:[w,h,d]});
    for(const sign of [-1,1]) {
      torch(x+sign*w*.36,y,z+d*.27);
      torch(x+sign*w*.36,y,z-d*.27);
    }
  };
  const ramp = (name:string,x:number,z0:number,y0:number,z1:number,y1:number,w=12):void => {
    add({t:'ramp',nm:name,p:[x,Math.min(y0,y1),(z0+z1)/2],
      len:z0-z1,rise:Math.abs(y1-y0),w,yaw:y1>y0?0:180,edgeGrinding:false,...stone});
    // Jagged hanging quarry rock beneath each ramp, outside the wheel surface.
    for(let z=z0-10;z>z1;z-=20) {
      const y=y0+(y1-y0)*(z0-z)/(z0-z1);
      add({t:'decor',dkind:'nightlongisland',p:[x,y-10,z],s:[w+2,8,23]});
      for(const side of [-1,1])torch(x+side*(w/2-.9),y,z);
    }
  };
  const ridge = (x:number,y:number,z:number,len:number):void =>
    add({t:'rail',nm:'Suspended quarry grind ridge',dkind:'nightrockridge',p:[x,y,z],len});
  const goblin = (x:number,y:number,z:number,range=3,foe:CustomComponent['foe']='grunt'):void =>
    add({t:'enemy',nm:foe==='hopper'?'Snot Goblin: spring miner':'Snot Goblin: night watch',
      p:[x,y,z],range,speed:foe==='hopper'?2.1:1.9,foe});

  island(0,24,0,28,42,13);
  ramp('Torch dock downhill',0,-18,24,-66,12,14);
  island(0,12,-89,30,54);
  ramp('Freight gap kicker',0,-106,12,-122,14,12);
  island(0,12,-153,28,50);
  ridge(-8,14.2,-129,52); // An ollie onto this ridge skips the freight gap.
  goblin(7,12,-92,3);
  goblin(7,12,-158,3,'hopper');

  // A broad flat centre and shallow banked shoulders let the rider choose
  // their line through the S bend. This is explicitly a road, not a vert wall.
  add({t:'vertramp',nm:'Serpent quarry causeway',p:[0,12,-169],vkind:'half',
    pts:AFTER_HOURS_SNAKE.map(([x,y,z])=>[x,z+169,0,y-12]),curve:'spline',
    w:4.8,rise:3.2,arc:55,deck:.8,vert:false,rails:false,bank:1.6,arcSteps:12,...stone});
  for(let i=0;i<AFTER_HOURS_SNAKE.length-1;i++) {
    const a=AFTER_HOURS_SNAKE[i],b=AFTER_HOURS_SNAKE[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/16);
    for(let j=0;j<n;j++) {
      const t=(j+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
      const yaw=-Math.atan2(b[0]-a[0],-(b[2]-a[2]))*180/Math.PI;
      add({t:'decor',dkind:'nightlongisland',p:[x,2.2,z],s:[15,8.5,22],yaw});
      if(j%2===0)for(const side of [-1,1])torch(x+side*6.2,12.5,z);
    }
  }
  // The outside line climbs and falls over the void; the banked road stays
  // available beneath the centre. A grind here is a deliberate optional line.
  add({t:'rail',nm:'Serpent outer grind',p:[0,14,-180],color:'#b9bcc8',
    pts:[[7,0],[7,-17],[30,-42,8,2],[33,-73,8,2],[13,-110,8],[7,-131]]});
  island(0,12,-336,34,46);
  island(0,12,-371,13,38,8);
  ramp('Moon bridge kicker',0,-377,12,-388,14,10);
  island(0,11,-420,34,48);
  ridge(-8,14.2,-376,72);
  goblin(8,12,-335,3);
  goblin(8,11,-419,3,'hopper'); // leave the grind's receiving lane readable and clear

  // A roomy island session between crossings: halfpipe on the west, low
  // ledges on the east, and a clear direct line in the middle.
  island(0,11,-456,58,50,14);
  add({t:'vertramp',nm:'Night shift halfpipe',p:[-16,11,-455],vkind:'half',
    len:34,w:3,rise:4,arc:90,deck:0,rails:true,skateCamera:true,...stone});
  add({t:'platform',nm:'Quarry manual ledge',p:[17,11.38,-453],s:[4,.76,25],edgeGrinding:false,...stone});
  ramp('Manual ledge roll-on',17,-438,11,-442,11.76,4);
  ridge(17,12,-452,25);
  goblin(7,11,-456,2.5);
  add({t:'bonusplatform',nm:'Night shift bonus dock',p:[23,11,-466],to:[19,11.1,-466]});
  ramp('Summit switchback climb',0,-475,11,-519,24,14);
  add({t:'platform',nm:'Summit ramp crest',p:[0,23.6,-528],s:[14,.8,18],edgeGrinding:false,...stone});
  island(0,24,-544,28,36,12);
  ramp('Last shift kicker',0,-551,24,-563,26,12);
  island(0,24,-598,34,56,16);
  ridge(9,26.2,-577,67);
  goblin(-8,24,-595,3,'hopper');
  add({t:'crystal',p:[9,26.8,-594]});
  add({t:'gate',p:[...AFTER_HOURS_FINISH]});
  for(const p of AFTER_HOURS_CHECKPOINTS)add({t:'checkpoint',p:[...p]});

  // Milk trails read the outgoing wheel line, particularly at takeoffs.
  for(const z of [2,-26,-46,-72,-86,-103,-114,-137,-167,-182,-194,-319,-330,-352,-372,-383,-407,-438,-474,-491,-510,-532,-553,-582,-603]) {
    const y=z>=-18?24:z>=-66?24+(12-24)*(-18-z)/48:z>=-388?12:z>=-475?11:z>=-529?11+13*(-475-z)/54:24;
    add({t:'wumpa',p:[0,y+1.05,z]});
  }
  for(const [x,,z] of AFTER_HOURS_SNAKE.slice(1,-1))add({t:'wumpa',p:[x,13.05,z]});
  // Ordered lane knots include the elevations, so the camera cannot select a
  // nearby grind or a different floor when the rider is high above a landing.
  const lane = [[0,24,22],[0,24,-18],[0,12,-66],[0,12,-145],
    ...AFTER_HOURS_SNAKE,[0,12,-356],[0,11,-420],[0,11,-475],
    [0,24,-529],[0,24,-627]];
  for(const [x,y,z] of lane)add({t:'camnode',p:[x,y,z],radius:12});
  for(const [x,y,z,yaw] of [[-40,3,-25,15],[49,-4,-90,-20],[-42,-6,-163,20],
    [66,-8,-229,-12],[-47,1,-293,24],[43,-7,-379,-15],[-54,-2,-464,12],[52,3,-578,-20]])
    add({t:'decor',dkind:'nightdistantarch',p:[x,y,z],s:[26,35,12],yaw,color:'#7588ac'});
  return {v:1,name:'Nightworks: After Hours',spawn:[0,24.1,11],killY:-32,
    sky:'night',keepPlayFog:true,medalTimes:{gold:35,silver:50,bronze:75},components};
}
export const NIGHTWORKS_AFTER_HOURS_LEVEL = createNightworksAfterHours();
