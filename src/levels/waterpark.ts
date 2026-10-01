import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { createLoopMeshData, sampleLoop } from '../loopRide';
import { WATERPARK_CORE, WATERPARK_SPAWN, WATERPARK_POOLS, WATERPARK_LOOPS, WATERPARK_COASTER_RAMPS, WATERPARK_CHECKPOINTS, WATERPARK_DOWNHILL, WATERPARK_GRADE, WATERPARK_JUMPS, WATERPARK_FINISH, waterparkSpillwayY } from './waterpark-route';
import { buildWaterparkArt, WATERPARK_ART_GROUPS, WATERPARK_ART_LINEAR_LAYOUT, artSign, artBeam } from './waterpark-art';
export { WATERPARK_POOLS, WATERPARK_JUMPS, WATERPARK_CHECKPOINTS, WATERPARK_LOOP, WATERPARK_LOOPS, WATERPARK_COASTER_RAMPS, WATERPARK_SPAWN, WATERPARK_DOWNHILL, WATERPARK_GRADE, WATERPARK_FINISH } from './waterpark-route';

type P=[number,number,number];
// One forward route down a hillside. The retained waterpark architecture is
// arranged along successive terraces, never around a hub or a return circuit.
const C:CustomComponent[]=WATERPARK_CORE.map(c=>({...c,
  ...(c.t==='vertramp'?{color:c.grp===4?'#df9662':'#84bab8',tex:'pavement'}:{}),
  ...(c.t==='ramp'&&(c.grp===1||c.grp===3||c.grp===5)?{color:'#6da7b6',tex:'pavement'}:{}),
  ...(c.t==='platform'?{color:'#cbbd9e',tex:'pavement'}:{}),
}));
const groups:CustomGroup[]=[
  {id:1,nm:'01 · High admission tower',editorOnly:true},{id:2,nm:'02 · Descending Wavebreaker pools',editorOnly:true},
  {id:3,nm:'03 · Mid-slope terrace',editorOnly:true},{id:4,nm:'04 · Downhill Boomerang',editorOnly:true},
  {id:5,nm:'05 · Lower dry flume',editorOnly:true},{id:6,nm:'06 · Triple gravity loop',editorOnly:true},
  {id:7,nm:'07 · Finish beyond the loop',editorOnly:true},{id:90,nm:'Hillside, retaining walls and pool edging',editorOnly:true},
  {id:91,nm:'Pocket terraces and drainage',editorOnly:true},{id:92,nm:'Forward course camera',editorOnly:true},...WATERPARK_ART_GROUPS,
];
const add=(c:CustomComponent)=>C.push(c);
export function waterparkGradeAt(z:number):number {
  if(z>=WATERPARK_GRADE[0][2])return WATERPARK_GRADE[0][1];
  for(let i=1;i<WATERPARK_GRADE.length;i++){const a=WATERPARK_GRADE[i-1],b=WATERPARK_GRADE[i];if(z>=b[2]){const t=(a[2]-z)/(a[2]-b[2]);return a[1]+(b[1]-a[1])*t;}}
  return WATERPARK_GRADE[WATERPARK_GRADE.length-1][1];
}
const earthAt=(z:number)=>z<=-578?waterparkGradeAt(z)-22:Math.max(-6,waterparkGradeAt(z)-22);
function mesh(p:P,g:THREE.BufferGeometry,color:string,nm:string,solid=false,grp=90,tex='solid') {
  const c:CustomComponent={t:'mesh',p,vertices:Array.from(g.getAttribute('position').array),...(g.index?{indices:Array.from(g.index.array)}:{}),color,tex,solid,doubleSided:true,edgeGrinding:false,grp,nm};
  if(solid&&g.getAttribute('normal'))c.normals=Array.from(g.getAttribute('normal').array);
  add(c);g.dispose();
}
function box(p:P,s:P,color:string,nm:string,solid=true,grp=90,tex='pavement') {
  if(solid)add({t:'platform',p,s,color,tex,edgeGrinding:false,grp,nm});else mesh(p,new THREE.BoxGeometry(...s),color,nm,false,grp);
}
function foundation(x:number,z:number,w:number,d:number,top:number,nm:string,color='#cbbd9e') {
  const bottom=Math.min(earthAt(z-d/2),earthAt(z+d/2))-1;
  box([x,(top+bottom)/2,z],[w,top-bottom,d],color,nm);
}
function arrow(p:P,yaw=0,nm='Painted downhill ride route') {
  add({t:'mesh',p:[p[0],p[1]+.04,p[2]],yaw,vertices:[-1.05,0,1.15,1.05,0,1.15,0,0,-1.6],indices:[0,1,2],solid:false,doubleSided:true,tex:'solid',color:'#efd070',edgeGrinding:false,grp:90,nm});
}
function edge(a:P,b:P,color='#e6ded0',w=.35,nm='Pool coping') {C.push(artBeam(a,b,w,color,nm));}
function drain(p:P) {
  box([p[0],p[1]+.025,p[2]],[2,.05,1.2],'#34494b','Dry pool drain',false);
  for(let n=-3;n<=3;n++)box([p[0]+n*.25,p[1]+.06,p[2]],[.05,.04,1.2],'#a8a99a','Drain grate bar',false);
}

// The earth itself descends. A depressed central bed leaves the authored
// pools/flumes open, while broad shoulders give the park real hillside mass.
const stations=[112,...Array.from({length:119},(_,i)=>72-i*10),-1150];
const cross=[-500,-160,-110,-100,-75,-26,-20,20,26,75,100,110,160,500],vertices:number[]=[],indices:number[]=[];
for(const z of stations)for(const x of cross){const shoulder=Math.min(1,Math.max(0,(Math.abs(x)-(z<=-578?100:26))/(z<=-578?60:49)));vertices.push(x,earthAt(z)+(waterparkGradeAt(z)-earthAt(z))*shoulder,z);}
for(let i=0;i<stations.length-1;i++)for(let j=0;j<cross.length-1;j++){const a=i*cross.length+j,b=a+1,c=a+cross.length,d=c+1;indices.push(a,b,c,b,d,c);}
const terrain=new THREE.BufferGeometry();terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.setIndex(indices);terrain.computeVertexNormals();
mesh([0,0,0],terrain,'#b4a081','Continuous downhill desert hillside',true,90,'sand');
foundation(0,60,70,32,79.98,'High admission terrace foundation');
for(const x of [-26,26])foundation(x,30,20,36,80,'Raised entry balcony');
foundation(14,24,5,4,80,'Old Rapids stair landing support');
// The admission sign cantilevers from the balcony over the descending slide.
// Keep its structure above the rider instead of filling the chute with a slab.
for(const [x,z]of [[4.33,32.02],[11.67,33.98]]){
  edge([18,79.65,z],[x,79.65,z],'#426974',.6,'Wave Pools sign cantilever');
  edge([18,78.1,z],[x,79.65,z],'#426974',.22,'Wave Pools sign bracket');
}
foundation(-26,-369,2.4,2.4,10,'Lower Boomerang marquee pedestal');

for(const [i,pool]of WATERPARK_POOLS.entries()){
  const span=pool.nearLip-pool.farLip,half=pool.length/2,top=pool.lipY,floor=pool.p[1];
  if(pool.section==='A'){
    for(const side of [-1,1]){
      foundation(side*(half+16),pool.p[2],32,span,top,`Wave pool ${i+1} hillside retaining court`);
      edge([side*half,top+.1,pool.nearLip],[side*half,top+.1,pool.farLip],'#e6ded0',.45,'Ceramic wave-pool edging');
      box([side*(half+.025),top-.6,pool.p[2]],[.05,.8,span-.4],'#245c68','Faded waterline tiles',false);
      for(let z=pool.farLip+2;z<pool.nearLip;z+=4)box([side*(half+.06),top-.6,z],[.04,.8,.06],'#b8ccc6','Pool tile grout',false);
    }
    edge([-half,top+.1,pool.nearLip],[half,top+.1,pool.nearLip]);
  }else{
    const profile:[number,number][]=[];
    for(let n=18;n>=0;n--){const a=n/18*Math.PI/2;profile.push([pool.p[2]+pool.flatHalf+pool.radius*Math.sin(a),floor+pool.radius*(1-Math.cos(a))]);}
    for(let n=0;n<=18;n++){
      if(pool.spillway){const z=pool.p[2]+pool.flatHalf-(pool.p[2]+pool.flatHalf-pool.farLip)*n/18;profile.push([z,waterparkSpillwayY(pool,z)]);}
      else{const a=n/18*Math.PI/2;profile.push([pool.p[2]-pool.flatHalf-pool.radius*Math.sin(a),floor+pool.radius*(1-Math.cos(a))]);}
    }
    for(const side of [-1,1]){
      const x=side*half,v:number[]=[],ind:number[]=[];
      for(let n=0;n<profile.length-1;n++){const [z,y]=profile[n],[nz,ny]=profile[n+1],k=v.length/3;v.push(x,y,z,x,ny,nz,x,ny-1.3,nz,x,y-1.3,z);ind.push(k,k+1,k+2,k,k+2,k+3);edge([x,y+.1,z],[x,ny+.1,nz],'#f0dab6',.42,'Curved Boomerang fiberglass rim');}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ind);g.computeVertexNormals();mesh([0,0,0],g,'#ba7851','Curved Boomerang shell fascia');
      for(let n=0;n<profile.length;n+=6){const [z,y]=profile[n],base=earthAt(z),sx=side*(half+1);
        box([sx,base+.3,z],[1.8,.6,1.8],'#aa9b7e','Boomerang concrete pier');edge([sx,base+.6,z],[sx,y-1,z],'#50757b',.5,'Boomerang steel column');
        if(n>=6){const [pz,py]=profile[n-6];edge([sx,earthAt(pz)+.6,pz],[sx,y-1,z],'#a87450',.2,'Boomerang diagonal brace');edge([sx,base+.6,z],[sx,py-1,pz],'#a87450',.2,'Boomerang cross brace');}
      }
    }
    edge([-half,top+.1,pool.nearLip],[half,top+.1,pool.nearLip],'#f0dab6',.4);
  }
  const surfaceY=(z:number)=>pool.spillway?waterparkSpillwayY(pool,z):floor;
  if(!pool.spillway)drain([half*.65,floor+.03,pool.p[2]]);
  arrow([0,surfaceY(pool.p[2]),pool.p[2]]);
  for(const dz of [-3,0,3])add({t:'wumpa',p:[0,surfaceY(pool.p[2]+dz)+1,pool.p[2]+dz],grp:pool.section==='A'?2:4});
}

// Long downhill connectors are recognizable open slides, not empty turns.
function shoulders(a:P,b:P,width:number){
  const steps=8,r=1.3;
  for(const side of [-1,1]){
    const v:number[]=[],ind:number[]=[];
    for(let along=0;along<=1;along++)for(let n=0;n<=steps;n++){const t=n/steps*Math.PI/2;v.push(side*(width/2+r*Math.sin(t)),a[1]+(b[1]-a[1])*along+r*(1-Math.cos(t)),a[2]+(b[2]-a[2])*along);}
    for(let n=0;n<steps;n++){const j=n+steps+1;ind.push(n,n+1,j,n+1,j+1,j);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ind);g.computeVertexNormals();mesh([0,0,0],g,'#639eae','Downhill slide shoulder');
    edge([side*(width/2+r),a[1]+r,a[2]],[side*(width/2+r),b[1]+r,b[2]],'#e8dfbf',.2,'Downhill slide rolled rim');
    for(let z=a[2]-5;z>b[2];z-=16){const t=(a[2]-z)/(a[2]-b[2]),y=a[1]+(b[1]-a[1])*t,sx=side*(width/2+2),base=earthAt(z);
      box([sx,base+.25,z],[2,.5,2],'#b5aa8e','Downhill slide pier footing');edge([sx,base+.5,z],[side*(width/2+1),y+.8,z],'#426974',.35,'Downhill slide pier');}
  }
}
for(const slope of WATERPARK_DOWNHILL.slice(0,3)){shoulders(slope.from,slope.to,20);for(let z=slope.from[2]-12;z>slope.to[2];z-=25){const t=(slope.from[2]-z)/(slope.from[2]-slope.to[2]);arrow([0,slope.from[1]+(slope.to[1]-slope.from[1])*t,z]);}}

const cp1=WATERPARK_CHECKPOINTS[0].p;
foundation(-42,cp1[2]-2,48,64,cp1[1],'CYCLONE pocket terrace');
foundation(-19,cp1[2],10,18,cp1[1],'Mid-slope terrace connection');
foundation(44,-248,66,50,34,'RIPTIDE lower terrace');
// Fountain is a compact rest-stop landmark beside the forward run, not a hub.
mesh([-29,cp1[1]+.23,cp1[2]-8],new THREE.CylinderGeometry(6.5,6.5,.46,28),'#ddcfaa','Dry rest-stop fountain rim',true,91);
mesh([-29,cp1[1]+.49,cp1[2]-8],new THREE.CylinderGeometry(5.8,5.8,.04,28),'#8cbbb8','Dry fountain basin',false,91);
mesh([-29,cp1[1]+1.5,cp1[2]-8],new THREE.CylinderGeometry(.8,1.7,2,14),'#c5b48f','Dry fountain pedestal',true,91);
mesh([-29,cp1[1]+2.8,cp1[2]-8],new THREE.CylinderGeometry(2.2,.7,.6,20),'#dfc584','Dry fountain crown',false,91);
add({t:'bonusplatform',p:[-26,cp1[1],cp1[2]+6],to:[-22,cp1[1]+.1,cp1[2]+6],grp:3,nm:'Closed arcade side entrance'});
C.push(...artSign('ARCADE',[-29,cp1[1]+3,cp1[2]+1],9,'#f1d8aa','#356d72'));
for(const x of [-32.8,-25.2])C.push(artBeam([x,cp1[1],cp1[2]+1],[x,cp1[1]+3.5,cp1[2]+1],.2,'#426974','Arcade notice posts'));

for(const [i,gap]of WATERPARK_JUMPS.slice(0,3).entries()){
  const edge=i<2?WATERPARK_POOLS[i===0?3:6].farLip:gap.takeoff[2],z=(edge+gap.landing[2])/2,d=edge-gap.landing[2];
  const waterY=earthAt(z)+.6;add({t:'pit',p:[0,waterY,z],s:[34,1,d],invisible:true,grp:90,nm:'Flooded downhill maintenance well'});
  const g=new THREE.PlaneGeometry(32,Math.max(1,d-.4));g.rotateX(-Math.PI/2);mesh([0,waterY+.12,z],g,'#476c63','Standing service-well water');
}
for(const [x,z]of [[-66,6],[66,-114],[-84,-228],[82,-355],[-66,-468],[72,-555]])add({t:'rock',p:[x,waterparkGradeAt(z)+1,z],s:[24,7,35],seed:Math.abs(x+z),color:'#af9777',tex:'sand',edgeGrinding:false,grp:90,nm:'Hillside rock outcrop'});
for(const [x,z,top]of [[-10,60,80],[10,60,80],[-11,cp1[2]-8,cp1[1]],[11,-414,30],[9,-546,12]])add({t:'crate',p:[x,top,z],kind:'wood',grp:90,nm:'Closed park maintenance supplies'});
add({t:'clock',p:[-10,80,68],grp:1});add({t:'comboorb',p:[10,80,68],grp:1});
for(const p of [[0,80,51],[0,60,-20],[0,cp1[1],cp1[2]+3],[0,34,-274],[0,30,-417],[0,12,-548],[0,12,-574],[60,-165,-1040]] as P[])arrow(p);

for(const [index,loop]of WATERPARK_LOOPS.entries()){
  add({t:'mesh',p:loop.entry,...createLoopMeshData(loop.radius,loop.width,loop.offset),w:loop.width,
    loopRadius:loop.radius,loopOffset:loop.offset,loopRequired:true,color:index===1?'#669997':'#3f7380',emissive:'#102d32',tex:'metal',doubleSided:true,edgeGrinding:false,grp:6,nm:`Deathloop ${index+1} of 3`});
  const point=(angle:number,lateral:number):P=>{const p=sampleLoop(loop,angle,lateral).point;return [p[0]+loop.entry[0],p[1]+loop.entry[1],p[2]+loop.entry[2]];};
  for(const side of [-1,1]){
    for(const off of [7.7,9.5]){
      const points=Array.from({length:65},(_,i)=>new THREE.Vector3(...point(i/64*Math.PI*2,side*off)));
      mesh([0,0,0],new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),72,.18,4,false),off===7.7?'#e7d8b2':'#426974','Loop outboard lattice chord',false,6);
    }
    for(let i=0;i<16;i++)edge(point(i/16*Math.PI*2,side*7.7),point((i+1)/16*Math.PI*2,side*9.5),'#a87450',.17,'Loop lattice diagonal');
    for(const angle of [Math.PI/3,Math.PI*4/3]){
      const high=point(angle,side*9.5),x=high[0]+side*9,z=high[2],base=earthAt(z);
      foundation(x,z,4,4,base+.6,'Coaster concrete anchor','#aa9b7e');
      edge([x,base+.6,z],high,'#426974',.8,'Coaster splayed steel support');
      edge([x+side*4,earthAt(z+4)+.6,z+4],high,'#a87450',.35,'Coaster support brace');
    }
  }
  C.push(...artSign(['I','II','III'][index],[loop.entry[0]-11,loop.entry[1]+5,loop.entry[2]+2],3,'#f5e7b7','#a2553c'));
  edge([loop.entry[0]-11,earthAt(loop.entry[2]+2),loop.entry[2]+2],[loop.entry[0]-11,loop.entry[1]+6,loop.entry[2]+2],'#426974',.3,'Loop number mast');
}
// Rolled rims make the steep, bidirectional roads read as one coaster ride.
for(const run of WATERPARK_COASTER_RAMPS){
  for(let i=0;i<16;i++){
    const a=i/16,b=(i+1)/16,at=(t:number):P=>[run.from[0],run.from[1]+(run.to[1]-run.from[1])*(1-Math.cos(Math.PI*t))/2,run.from[2]+(run.to[2]-run.from[2])*t];
    for(const side of [-1,1]){const p=at(a),q=at(b);p[0]+=side*9;q[0]+=side*9;p[1]+=.2;q[1]+=.2;edge(p,q,'#e6d8b9',.3,'Gravity ramp rolled edge');}
    if(i%4===2){const p=at(a);arrow(p);for(const side of [-1,1])edge([p[0]+side*10,earthAt(p[2]),p[2]],[p[0]+side*9,p[1],p[2]],'#426974',.5,'Gravity ramp support');}
  }
}
for(const [a,b,width]of [
 [[40,-96,-778],[40,-94,-798],18],[[40,-100,-830],[40,-100,-920],18],
 [[12,-96,-778],[12,-110,-830],14],
 ] as [P,P,number][]){
  for(const side of [-1,1]){
    edge([a[0]+side*width/2,a[1]+.2,a[2]],[b[0]+side*width/2,b[1]+.2,b[2]],'#e6d8b9',.3,'Coaster deck rolled edge');
    const steps=Math.ceil((a[2]-b[2])/20);
    for(let i=0;i<=steps;i++){
      const t=i/steps,z=a[2]+(b[2]-a[2])*t,x=a[0]+side*(width/2+.5),top=a[1]+(b[1]-a[1])*t,base=earthAt(z);
      box([x,base+.25,z],[2,.5,2],'#b5aa8e','Coaster deck pier footing',false,6);
      edge([x,base+.5,z],[x,top,z],'#426974',.5,'Coaster deck support pier');
    }
  }
}
for(const z of [-846,-874,-904])arrow([40,-100,z]);
add({t:'crystal',p:[60,-163.8,-1053],grp:7,nm:'Triple loop survivor crystal'});
add({t:'gate',p:WATERPARK_FINISH,yaw:0,grp:7,nm:'Finish beyond the downhill loop'});
foundation(0,-565,28,26,11.98,'Triple loop summit foundation');foundation(60,-1038,24,66,-165.02,'Finish promenade foundation');
C.push(...artSign('TRIPLE DEATH LOOP',[-15,17,-572],16,'#f5e7b7','#a2553c'));
edge([-15,earthAt(-572),-572],[-15,18,-572],'#426974',.35,'Triple loop sign mast');
C.push(...artSign('RETURN',[12,-91,-783],6,'#f5e7b7','#356d72'));

// Straight centreline all the way down; the mandatory vertical loop is the
// only local reversal, followed by a separate forward finish lane.
const lane:P[]=[[0,80,88],[0,80,44],[0,60,-16],[0,60,-24]];
for(const p of WATERPARK_POOLS.filter(p=>p.section==='A'))lane.push(p.p,[0,p.lipY,p.farLip]);
lane.push(WATERPARK_JUMPS[0].landing,[0,cp1[1],-190],[0,34,-270],[0,34,-278]);
for(const p of WATERPARK_POOLS.filter(p=>p.section==='B'))lane.push(p.p,[0,p.lipY,p.farLip]);
lane.push(WATERPARK_JUMPS[1].landing,[0,30,-424],[0,18,-466],[0,4,-502],[0,4,-510],WATERPARK_JUMPS[2].takeoff,WATERPARK_JUMPS[2].landing,[0,12,-554],[0,12,-578]);
const dropLane=(index:number)=>{const run=WATERPARK_COASTER_RAMPS[index];for(let i=0;i<=12;i++){const t=i/12;lane.push([run.from[0],run.from[1]+(run.to[1]-run.from[1])*(1-Math.cos(Math.PI*t))/2,run.from[2]+(run.to[2]-run.from[2])*t]);}};
for(const [index,loop]of WATERPARK_LOOPS.entries()){
  if(index<2)dropLane(index);else{dropLane(2);lane.push(WATERPARK_JUMPS[3].takeoff,WATERPARK_JUMPS[3].landing,[40,-100,-920]);dropLane(3);}
  for(let i=0;i<=32;i++){const q=sampleLoop(loop,i/32*Math.PI*2).point;lane.push([q[0]+loop.entry[0],q[1]+loop.entry[1],q[2]+loop.entry[2]]);}
}
lane.push([60,-165,-1035],[60,-165,-1075]);
export const WATERPARK_CAMERA_LANE=lane;for(const p of lane)add({t:'camnode',p,grp:92});
const artLayout={...WATERPARK_ART_LINEAR_LAYOUT,flumePaths:[WATERPARK_ART_LINEAR_LAYOUT.flumePaths[0],[[0,12,-538],[0,12,-554]] as P[]],frames:{...WATERPARK_ART_LINEAR_LAYOUT.frames,cyclone:{p:[-42,cp1[1],cp1[2]] as P}}};
C.push(...buildWaterparkArt(artLayout).filter(c=>c.grp!==85));
for(const c of C)if(c.t==='mesh'&&c.solid===false&&c.tex==='solid'){delete c.normals;delete c.uvs;}
export const WATERPARK_LEVEL:CustomLevelData={
 v:1,name:'Deadwater Park',spawn:WATERPARK_SPAWN,killY:-230,sky:'day',cameraAirLift:1,keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:290,fogFar:950,fogColor:'#c9d3ce',backdrop:'sky',ambientSky:'#d5e6e4',ambientGround:'#8d7c60',ambientIntensity:.95,sunColor:'#fff0cf',sunIntensity:1.65,fillColor:'#a8c9d0',fillIntensity:.4,drawDistance:1100,shadowStrength:.8},
 medalTimes:{gold:105,silver:140,bronze:180},components:C,groups,
};
