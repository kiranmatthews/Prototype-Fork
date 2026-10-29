import type { CustomComponent, CustomLevelData } from '../level';

const C: CustomComponent[] = [];
const DECK = 1.2, SPRING = 25.6;
export const CARLISLE_HARBOUR_DOCKS = [
  [-14, 3.3], [27, 37.3], [61, 68.3], [92, 98.3], [124, 145],
] as const;
export const CARLISLE_HARBOUR_SPRINGS = [5, 39, 70, 100] as const;
export const CARLISLE_HARBOUR_BOATS = [
  {name:'First skiff',x:18,length:9,width:4.8,amp:3,speed:.38,phase:0},
  {name:'Cargo lighter',x:52,length:9,width:5.4,amp:3,speed:.32,phase:1.1},
  {name:'Spring skiff',x:82,length:4.8,width:3.8,amp:2,speed:.42,phase:2.2,bounce:SPRING},
  {name:'Homeward ferry',x:113,length:12,width:5.8,amp:3,speed:.28,phase:.8},
] as const;

for (const [i,[a,b]] of CARLISLE_HARBOUR_DOCKS.entries()) {
  C.push({t:'platform',nm:`Harbour dock ${i+1}`,p:[(a+b)/2,DECK-.6,0],s:[b-a,1.2,7],tex:'solid',color:'#aeb5b9',grp:1});
  for (const x of [a+.8,b-.8]) for (const z of [-2.9,2.9])
    C.push({t:'platform',nm:'Quay piling',p:[x,-1.8,z],s:[.55,4,.55],tex:'solid',color:'#56626a',grp:90});
}
for (const x of CARLISLE_HARBOUR_SPRINGS) {
  C.push({t:'trampoline',nm:`Mooring spring ${x}`,p:[x,DECK+.02,0],s:[3.4,.6,4],speed:SPRING,amp:1.25,tex:'solid',color:'#cbaa72',grp:2});
  // The buoy ends at the spring underside, never at its contact surface.
  C.push({t:'platform',nm:'Moored spring buoy',p:[x,-.08,0],s:[2.8,1.4,3.4],tex:'solid',color:'#56626a',grp:2});
}

// One native mover owns each complete hull. Its broad, flat top is the deck;
// tapered ends and a darker keel make a readable boat without attached props
// drifting out of sync or a second collision floor above the deck.
for (const boat of CARLISLE_HARBOUR_BOATS) {
  const {length:l,width:w}=boat,h=1.4;
  const outline=[[-l/2,0],[-l/2+1.15,-w/2],[l/2-1.15,-w/2],[l/2,0],[l/2-1.15,w/2],[-l/2+1.15,w/2]];
  const spring='bounce' in boat;
  const vertices=[0,h/2,0],colors=spring?[.8,.67,.45]:[.72,.76,.76],indices:number[]=[];
  for(const [x,z] of outline){vertices.push(x,h/2,z);colors.push(...(spring?[.8,.67,.45]:[.72,.76,.76]));}
  for(let i=0;i<6;i++)indices.push(0,(i+1)%6+1,i+1);
  for(const [x,z] of outline){vertices.push(x*.79,-h/2,z*.72);colors.push(.27,.34,.38);}
  for(let i=0;i<6;i++){
    const a=i+1,b=(i+1)%6+1;indices.push(a,b,b+6,a,b+6,a+6);
  }
  for(let i=1;i<5;i++)indices.push(7,7+i,8+i);
  C.push({t:'mover',nm:boat.name,p:[boat.x,DECK,0],s:[l,h,w],vertices,indices,colors,grindTopTriangles:6,
    axis:'x',amp:boat.amp,speed:boat.speed,phase:boat.phase,...(spring?{bounce:boat.bounce}:{}),tex:'solid',color:'#ffffff',grp:3});
}

// Rewards stay on fixed quays: collecting a stack never removes a boat or
// launcher, and every crate can be collected with normal movement and spins.
for(const [x,count,tiers] of [[-5,3,1],[31,3,2],[64,2,2],[94,2,1],[129,3,2]])
  for(let tier=0;tier<tiers;tier++)for(let i=0;i<count;i++)C.push({t:'crate',nm:`Harbour cargo ${x} · ${tier+1}.${i+1}`,
    p:[x+i*.96,DECK+tier*.96,0],kind:x===129&&tier===1&&i===2?'life':'wood',grp:4});
for(const [x,y] of [[8,5],[12,8],[16,5],[24,3],[42,5],[46,8],[51,5],[58,3],
  [73,5],[77,8],[81,5],[86,7],[90,6],[94,3],[103,5],[107,8],[112,5],[121,3],[135,2.4]])
  C.push({t:'wumpa',nm:'Harbour bounce trail',p:[x,y,0],grp:4});

C.push({t:'mesh',nm:'Springtide harbour water',p:[65,0,0],
  vertices:[-125,0,-100,125,0,-100,125,0,85,-125,0,85],indices:[0,2,1,0,3,2],uvs:[0,0,24,0,24,18,0,18],
  materialStyle:'water',solid:false,tex:'solid',color:'#668d98',opacity:.88,lethal:true,castShadow:false,grp:90});
C.push({t:'pit',nm:'Harbour water contact',p:[65,-.35,0],s:[190,1,24],invisible:true,grp:5});
// Distant breakwaters establish the waterline without supplying a bypass.
for(const [x,l,z] of [[14,46,-15],[78,52,-19],[132,34,-14]])
  C.push({t:'platform',nm:'Outer harbour breakwater',p:[x,-.5,z],s:[l,3.2,4],tex:'solid',color:'#687780',solid:false,grp:90});
for(const z of [-.83,.83])C.push({t:'wall',nm:'Native bonus play plane',p:[65,-10,z],s:[190,42,.6],invisible:true,grp:5});
C.push({t:'zone',p:[65,2,0],s:[190,1,20],dir:'E',grp:5},
  {t:'camnode',p:[-18,DECK,0],grp:5},{t:'camnode',p:[150,DECK,0],grp:5},
  {t:'gate',nm:'Return from Springtide Skippers',p:[139,DECK,0],yaw:90,grp:5});

export const CARLISLE_HARBOUR_BONUS:CustomLevelData={
  v:1,name:'Bonus: Springtide Skippers',spawn:[-10,DECK+.12,0],killY:-5,hudMode:'bonus',startWarpPad:false,
  sky:'night',keepPlayFog:true,jungleDepthFade:false,hugeDropBail:false,
  atmosphere:{backdrop:'fog',fogEnabled:true,fogNear:100,fogFar:330,fogColor:'#152c50',drawDistance:450,
    ambientSky:'#8ba9d8',ambientGround:'#253b58',ambientIntensity:1.8,sunColor:'#b1cbef',sunIntensity:1.35,
    fillColor:'#f07942',fillIntensity:.6,shadowStrength:.7},
  components:C,groups:[{id:1,nm:'Five safe cargo quays'},{id:2,nm:'Four small moored springs'},
    {id:3,nm:'Moving skiffs, lighter and ferry'},{id:4,nm:'Harbour rewards'},
    {id:5,nm:'Bonus route and return',editorOnly:true},{id:90,nm:'Water and breakwaters',editorOnly:true}],
};
