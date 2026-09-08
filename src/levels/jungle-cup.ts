import type { CustomComponent, CustomLevelData } from '../level';
// A compact loop park: drop-in -> temple street -> hip transfer -> long vert
// wall -> return rail. The central spine and side bowl create optional lines.
const components: CustomComponent[] = [];
const add = (c: CustomComponent) => components.push(c);
const stone = '#b6a17b', moss = '#788968';
const platform = (nm: string, p: [number,number,number], s: [number,number,number], color=stone) => add({t:'platform',nm,p,s,color,tex:'jungle'});
const ramp = (nm:string,x:number,z:number,len:number,rise:number,w:number,yaw=0,y=0) => add({t:'ramp',nm,p:[x,y,z],len,rise,w,yaw,color:stone,tex:'jungle'});
const rail = (nm:string,x:number,y:number,z:number,len:number,yaw=0) => add({t:'rail',nm,p:[x,y,z],len,yaw,color:'#d2b768'});
platform('Jungle Cup arena foundation',[0,-1,-35],[82,2,110],moss);
platform('Starting terrace',[0,2,8],[20,4,6]);
ramp('Starting terrace return bank',0,15,8,4,20,0);
ramp('Wide drop-in',0,-1,12,4,20,180);
// Street lines have wide landing aprons rather than isolated death platforms.
ramp('Temple funbox south',0,-25,8,1.6,12);
platform('Temple funbox deck',[0,.8,-31],[12,1.6,4]);
ramp('Temple funbox north',0,-37,8,1.6,12,180);
rail('Funbox crown',0,2,-31,14);
platform('East manual pad',[20,.35,-25],[8,.7,15]);
rail('East ledge grind',16,1,-25,15);
rail('Street flat bar',-12,.85,-18,16);
// Opposing transitions make an uninterrupted out-and-back vert line.
add({t:'vertramp',nm:'North temple vert wall',p:[0,0,-77],len:58,rise:4.8,w:0.8,arc:90,deck:4,yaw:90,color:stone,tex:'jungle'});
add({t:'vertramp',nm:'South return quarter',p:[-24,0,10],len:24,rise:3.6,w:.8,arc:85,deck:3,yaw:270,color:stone,tex:'jungle'});
// Side halfpipe. Its long axis follows Z, clear of the central street line.
add({t:'vertramp',vkind:'half',nm:'West jade halfpipe',p:[-26,0,-45],len:34,rise:3.6,w:4,arc:90,deck:2.5,yaw:0,color:'#9bac8b',tex:'moss'});
// A double-sided hip and a bank-to-rail transfer give a second scoring circuit.
ramp('Temple spine west bank',20,-60,8,2.8,22,-90);
ramp('Temple spine east bank',28,-60,8,2.8,22,90);
rail('High spine transfer rail',24,3.15,-60,22);
platform('Low stone manual strip',[-2,.2,-54],[5,.4,16]);
rail('Return line',12,.95,-57,23);
// Supported finish marker is a ceremony exit; competition runtime owns winning.
platform('Awards dais',[25,1.1,9],[15,2.2,8]);
ramp('Awards dais south bank',25,16,6,2.2,15,0);
ramp('Awards dais approach',25,0,10,2.2,15,180);
add({t:'gate',nm:'Cup ceremony exit',p:[25,2.2,12]});
add({t:'decor',dkind:'junglecup',nm:'Jungle Cup ceremony trophy',p:[25,2.2,10],s:[2,2,2]});
add({t:'checkpoint',nm:'Park return point',p:[-7,4,8]});
add({t:'wallpath',nm:'Arena containment',p:[0,-12,0],pts:[[-41,19],[41,19],[41,-90],[-41,-90]],closed:true,w:2,rise:48,containment:true,invisible:true});
// One stable course/camera axis; all crossings share it, without lane handoffs.
add({t:'camnode',nm:'Park camera south',p:[0,0,25]});
add({t:'camnode',nm:'Park camera north',p:[0,0,-100]});
// Existing modular Jungle Ruins kit: warm masonry, moss and broad clean leaves.
for (const [x,z,yaw] of [[-51,12,90],[51,-45,-90],[20,-103,180]] as const)
  add({t:'decor',dkind:'roofedtemple',nm:'Spectator temple',p:[x,0,z],s:[15,13,10],yaw});
for (const z of [-18,-48,-76]) for (const x of [-38,38]) {
  add({t:'decor',dkind:'templewall',p:[x,0,z],s:[4,7,12],yaw:0});
  add({t:'wall',nm:'Masonry boundary collider',p:[x,0,z],s:[4,7,12],invisible:true});
  add({t:'torch',p:[x+(x<0?2:-2),0,z],rise:3,w:.8});
}
for (let i=0;i<15;i++) for (const side of [-1,1]) {
  const x=side*(43+(i%3)*1.5),z=18-i*7.5;
  add({t:'decor',dkind:'junglecanopy',p:[x,0,z],s:[14,19+(i%3)*2,14],yaw:i*47});
  add({t:'decor',dkind:'jungleleaf',p:[side*39,0,z-2],s:[5,3,5],yaw:i*63});
}
for (const x of [-28,-12,6,24,38]) {
  add({t:'decor',dkind:'junglepalmtree',p:[x,0,-91],s:[10,16,10],yaw:x*12});
  add({t:'decor',dkind:'junglecliff',p:[x,-8,-102],s:[22,28,14],yaw:5});
}
add({t:'decor',dkind:'hangingarch',nm:'Temple street arch',p:[0,0,-43],s:[19,12,3]});
export const JUNGLE_CUP_LEVEL: CustomLevelData = {
  v:1,name:'Jungle Cup',spawn:[0,4.1,8],killY:-16,sky:'day',jungleAtmosphere:true,keepPlayFog:true,
  atmosphere:{ fogNear:50, fogFar:160, drawDistance:230 },
  components,
};
