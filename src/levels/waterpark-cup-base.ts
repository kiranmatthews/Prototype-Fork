// Recovered park layout from 871051744312ccfe8d0bcc9b2c6dda833fed1789.
// Competition adaptation lives in waterpark-cup.ts; the linear course is independent.
import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { createLoopMeshData, sampleLoop } from '../loopRide';
import { WATERPARK_CORE, WATERPARK_SPAWN, WATERPARK_POOLS, WATERPARK_LOOP } from './waterpark-cup-route';
import { buildWaterparkArt, WATERPARK_ART_GROUPS, WATERPARK_ART_SOURCE_ANCHORS, type WaterparkArtLayout, artSign, artBeam } from './waterpark-art';
export { WATERPARK_POOLS, WATERPARK_JUMPS, WATERPARK_CHECKPOINTS, WATERPARK_LOOP, WATERPARK_SPAWN } from './waterpark-cup-route';

// A compact terraced park, not a row of disconnected stunt platforms. The
// perimeter rides wrap a drained river/courtyard; the loop returns to the gate.
// Reference analysis and the route's spatial contract: docs/DEADWATER_DESIGN.md.
const C: CustomComponent[] = WATERPARK_CORE.map(c => ({ ...c,
  ...(c.t === 'vertramp' ? { color: c.grp === 4 ? '#df9662' : '#84bab8', tex: 'pavement' } : {}),
  ...(c.t === 'ramp' && c.grp === 5 ? { color:'#6da7b6',tex:'pavement' } : {}),
  ...(c.t === 'platform' && c.grp !== 6 && c.grp !== 7 ? { tex: 'pavement', color: '#cbbd9e' } : {}),
}));
const groups: CustomGroup[] = [
  {id:1,nm:'01 · Closed admission court',editorOnly:true}, {id:2,nm:'02 · Wavebreaker spine pools',editorOnly:true},
  {id:3,nm:'03 · Fountain concourse',editorOnly:true}, {id:4,nm:'04 · Dual Boomerang',editorOnly:true},
  {id:5,nm:'05 · Dry splash flume',editorOnly:true}, {id:6,nm:'06 · Deathloop station',editorOnly:true},
  {id:7,nm:'07 · Return to the park gates',editorOnly:true}, {id:90,nm:'Ground, retaining walls and pool edging',editorOnly:true},
  {id:91,nm:'Drained lazy river and courtyard',editorOnly:true}, {id:92,nm:'Course camera',editorOnly:true},
  {id:100,nm:'Abandoned park architecture',editorOnly:true},
  ...WATERPARK_ART_GROUPS,
];
type P=[number,number,number];
const add=(c:CustomComponent)=>C.push(c);
function box(p:P,s:P,color:string,nm:string,solid=true,grp=90,tex='pavement') {
  if(solid)add({t:'platform',p,s,color,tex,grp,nm});
  else mesh(p,new THREE.BoxGeometry(...s),color,nm,false,grp);
}
function mesh(p:P,g:THREE.BufferGeometry,color:string,nm:string,solid=false,grp=90) {
  const component:CustomComponent={t:'mesh',p,vertices:Array.from(g.getAttribute('position').array),
    ...(g.index?{indices:Array.from(g.index.array)}:{}),normals:Array.from(g.getAttribute('normal').array),
    color,tex:'solid',solid,doubleSided:true,grp,nm};
  if(g.getAttribute('uv'))component.uvs=Array.from(g.getAttribute('uv').array);
  add(component);g.dispose();
}
function foundation(x:number,z:number,w:number,d:number,top:number,nm:string,color='#cbbd9e') {
  box([x,(top-6)/2,z],[w,top+6,d],color,nm);
}
function arrow(p:P,yaw:number,nm='Painted ride route') {
  add({t:'mesh',p:[p[0],p[1]+.035,p[2]],yaw,vertices:[-1.05,0,1.15,1.05,0,1.15,0,0,-1.6],indices:[0,1,2],
    solid:false,doubleSided:true,tex:'solid',color:'#efd070',edgeGrinding:false,grp:90,nm});
}
function edging(a:P,b:P,width=.35,color='#e6ded0',nm='Ceramic pool coping') {
  const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va),g=new THREE.BoxGeometry(width,width,d.length());
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize()));
  const p=va.add(vb).multiplyScalar(.5).toArray() as P;mesh(p,g,color,nm);
}
function drain(p:P,yaw=0) {
  add({t:'mesh',p,yaw,vertices:[-1,0,-.65,1,0,-.65,1,0,.65,-1,0,.65],indices:[0,2,1,0,3,2],
    solid:false,doubleSided:true,tex:'metal',color:'#384747',edgeGrinding:false,grp:90,nm:'Dry pool drain'});
  for(let n=-3;n<=3;n++)box([p[0]+n*.25,p[1]+.015,p[2]],[.05,.025,1.3],'#a8a99a','Drain grate',false);
}

// Real earth and connected paved terraces give every attraction a foundation.
// Only three localized maintenance wells are lethal; ordinary dry river floors
// remain usable for recovery and exploration.
box([36,-9,-63],[1200,6,1200],'#b4a081','Desert park ground',true,90,'sand');
for(const [x,z,w,d,h] of [[-122,20,30,60,9],[-116,-115,25,70,12],[-64,-207,60,24,10],[40,-216,65,28,13],[153,-210,52,31,11],[191,-107,25,70,8],[187,20,20,44,7]]) {
  add({t:'rock',p:[x,-6+h*.35,z],s:[w,h,d],seed:Math.abs(x+z),color:'#ae9474',tex:'sand',edgeGrinding:false,grp:90,nm:'Desert boundary rock outcrop'});
}
foundation(-48,44,58,40,11.98,'Admission terrace foundation');
foundation(-84,-34,24,192,12,'West pool promenade');
foundation(-48,-142,38,48,11.98,'Concourse retaining terrace');
foundation(-23,-173,48,10,12,'Concourse queue shoulder');
// A body's route remains in the open trough; exterior mass sits beyond the
// analytic riding width, with different widths rather than copy-pasted bays.
for(const [i,pool] of WATERPARK_POOLS.entries()) {
  const span=2*(pool.radius+pool.flatHalf),floor=pool.p[1],top=pool.lipY;
  if(pool.section==='A') {
    const left=pool.p[0]-pool.length/2,right=pool.p[0]+pool.length/2;
    foundation((-96+left)/2,pool.p[2],left+96,span,top,`Wave pool ${i+1} west retaining court`);
    foundation((right-26)/2,pool.p[2],-26-right,span,top,`Wave pool ${i+1} river median`);
    for(const x of [left-.15,right+.15])edging([x,top+.11,pool.nearLip],[x,top+.11,pool.farLip],.45);
    edging([left,top+.11,pool.nearLip],[right,top+.11,pool.nearLip],.4);
    drain([pool.p[0]+pool.length*.3,floor+.035,pool.p[2]]);
    // Tall retaining faces get a recognizable blue tile course and depth ticks.
    for(const x of [left-.02,right+.02]) {
      box([x,top-.6,pool.p[2]],[.04,.85,span-.8],'#245c68','Faded blue waterline tile',false);
      for(let z=pool.farLip+2;z<pool.nearLip-1;z+=4)box([x,top-.6,z],[.06,.85,.06],'#bdcfcb','Tile grout joint',false);
    }
  } else {
    // A thin curved fiberglass shell on open steel piers distinguishes the
    // elevated boomerangs from the concrete sunken pools. No rectangular bins.
    const profile:[number,number][]=[];
    for(let n=18;n>=0;n--){const a=n/18*Math.PI/2;profile.push([pool.p[0]-pool.flatHalf-pool.radius*Math.sin(a),floor+pool.radius*(1-Math.cos(a))]);}
    for(let n=0;n<=18;n++){const a=n/18*Math.PI/2;profile.push([pool.p[0]+pool.flatHalf+pool.radius*Math.sin(a),floor+pool.radius*(1-Math.cos(a))]);}
    for(const z of [pool.p[2]-pool.length/2,pool.p[2]+pool.length/2]) {
      const vertices:number[]=[],indices:number[]=[];
      for(let n=0;n<profile.length-1;n++){
        const [x,y]=profile[n],[nx,ny]=profile[n+1],k=vertices.length/3;
        vertices.push(x,y,z,nx,ny,z,nx,ny-1.3,z,x,y-1.3,z);indices.push(k,k+1,k+2,k,k+2,k+3);
        edging([x,y+.12,z],[nx,ny+.12,z],.42,'#f0dab6','Curved fiberglass slide rim');
      }
      const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));shell.setIndex(indices);shell.computeVertexNormals();
      mesh([0,0,0],shell,'#ba7851','Curved boomerang shell fascia');
      for(let n=0;n<profile.length;n+=6){
        const [x,y]=profile[n],oz=z+(z<pool.p[2]?-1:1);
        box([x,-5.7,oz],[1.8,.6,1.8],'#a4977b','Slide pier footing');
        edging([x,-5.4,oz],[x,y-1,oz],.5,'#50757b','Exposed boomerang steel column');
        if(n>=6){const [px,py]=profile[n-6];edging([px,-5.3,oz],[x,y-1.1,oz],.22,'#a87450','Boomerang diagonal support');edging([x,-5.3,oz],[px,py-1.1,oz],.22,'#a87450','Boomerang cross brace');}
      }
    }
    edging([pool.nearLip,top+.12,pool.p[2]-pool.length/2],[pool.nearLip,top+.12,pool.p[2]+pool.length/2],.4,'#f0dab6');
    drain([pool.p[0],floor+.035,pool.p[2]+pool.length*.3]);
  }
}
// Low retaining courts support the big receiver/turn. Columns and diagonal
// flume frames are supplied by the architectural layer rather than floating boxes.
foundation(137,-160,30,40,5,'Boomerang receiver pump building','#9d9b84');
foundation(138,-10,22,24,-.02,'Deathloop loading foundation','#bdb096');
foundation(118,27,20,54,-.02,'Exit promenade foundation','#bdb096');

// The dry lazy river is a complete, skateable circulation loop around a real
// raised island. Its shallow transitions are distinct from the giant rides.
const river:P[]=[[-12,7,16],[-21,7,-28],[-12,7,-81],[16,7,-108],[61,7,-99],[91,7,-58],[89,7,-10],[65,7,26],[23,7,33]];
add({t:'vertramp',p:[0,0,0],pts:river.map(p=>[p[0],p[2],13,p[1]]),closed:true,curve:'spline',
  vkind:'half',rise:5,w:4,arc:90,arcSteps:20,deck:1.3,rails:true,tex:'pavement',color:'#a4d0c8',edgeGrinding:false,grp:91,nm:'Drained lazy river around fountain island'});
add({t:'platform',p:[0,3,0],s:[1,18,1],pts:[[3,9],[-2,-25],[6,-72],[24,-85],[54,-79],[70,-53],[70,-14],[54,11],[24,17]],
  color:'#d2c5a6',tex:'pavement',grp:91,nm:'Fountain courtyard island'});
// Both crossing bridges meet the island. Their walkways/rails are visible from
// the high rides and give the player a consistent landmark throughout the U.
box([-11,15,-44],[28,1,10],'#d5c8a7','West lazy river bridge deck',true,91);
add({t:'ramp',p:[-29.5,12,-44],len:9,rise:3.5,w:10,yaw:270,color:'#d5c8a7',tex:'pavement',grp:91,nm:'West bridge promenade approach'});
add({t:'ramp',p:[7.5,12,-44],len:9,rise:3.5,w:10,yaw:90,color:'#d5c8a7',tex:'pavement',grp:91,nm:'West bridge island approach'});
foundation(36,-137,130,14,12,'North courtyard promenade');
box([36,15,-102],[12,1,38],'#d5c8a7','North lazy river bridge deck',true,91);
add({t:'ramp',p:[36,12,-126.5],len:11,rise:3.5,w:12,yaw:180,color:'#d5c8a7',tex:'pavement',grp:91,nm:'North bridge promenade approach'});
add({t:'ramp',p:[36,12,-78],len:10,rise:3.5,w:12,yaw:0,color:'#d5c8a7',tex:'pavement',grp:91,nm:'North bridge island approach'});
for(const z of [-49,-39])add({t:'rail',p:[-34,12.9,z],pts:[[0,0],[9,0,0,3.5],[37,0,0,3.5],[46,0]],grp:91,nm:'Arched footbridge handrail'});
for(const x of [30,42])add({t:'rail',p:[x,12.9,-132],pts:[[0,0],[0,11,0,3.5],[0,49,0,3.5],[0,59]],grp:91,nm:'North bridge handrail'});
// An empty fountain bowl, a raised central pedestal, and four skateable banks.
mesh([31,12.23,-45],new THREE.CylinderGeometry(12,12,.46,40),'#e2d8bd','Empty fountain stone rim',true,91);
mesh([31,12.48,-45],new THREE.CylinderGeometry(10.8,10.8,.06,40),'#88bdbb','Stained fountain basin',false,91);
mesh([31,13.25,-45],new THREE.CylinderGeometry(2.2,3,1.6,16),'#c7b895','Fountain central plinth',true,91);
mesh([31,15,-45],new THREE.CylinderGeometry(.4,.7,2.1,12),'#538788','Dry fountain column',false,91);
mesh([31,16.3,-45],new THREE.CylinderGeometry(3.1,1.1,.65,24),'#e0c789','Dry fountain crown',false,91);
for(const yaw of [0,90,180,270]) {
  const a=yaw*Math.PI/180;add({t:'ramp',p:[31+Math.sin(a)*15,12,-45+Math.cos(a)*15],yaw,len:6,rise:.46,w:8,
    color:'#c3b597',tex:'pavement',grp:91,nm:'Fountain skating bank'});
}
// Small planters and cracked forecourts make the shared ground legible at
// player height; planted props belong to actual supported surfaces.
for(const [x,z] of [[5,-15],[6,-68],[57,-70],[59,1],[-80,21],[-80,-55],[-24,-136],[115,-122],[161,-48]]) {
  const y=x>105? -6:12;
  mesh([x,y+.5,z],new THREE.CylinderGeometry(3.2,3.5,1,12),'#bbac8d','Concrete planter',true,91);
  add({t:'decor',dkind:'palm',p:[x,y+.9,z],w:.85,rise:11,grp:100,nm:'Palm growing from abandoned planter'});
  add({t:'decor',dkind:'plants',p:[x+1.2,y+.95,z-1],w:.8,vr:2,grp:100,nm:'Overgrown planter'});
}
// Waterlogged service wells explain jump failures; the rest of the park is
// drained and grounded, with no level-wide black death carpet.
for(const [x,z,w,d] of [[-48,-109,34,17],[113,-160,17,31],[138,-68,18,19]]) {
  add({t:'pit',p:[x,-4.2,z],s:[w,1,d],invisible:true,grp:90,nm:'Flooded maintenance well'});
  const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);mesh([x,-4.05,z],g,'#476c63','Standing water in closed service well');C[C.length-1].materialStyle='water';
}

// Clear painted ride directions; supplies sit off the fast line.
for(const p of [[-48,12,35],[-48,4,12],[-48,0,-17],[-48,2,-48],[-48,-2,-81],[-48,12,-125]] as P[])arrow(p,0);
for(const p of [[-23,13.4,-160],[17,6,-160],[54,2,-160],[89,8,-160]] as P[])arrow(p,270);
for(const p of [[138,18,-138],[138,4,-98],[138,14,-49],[138,0,-15],[118,0,31]] as P[])arrow(p,180);
for(let n=1;n<=4;n++){
  const a=Math.PI+n/4*Math.PI/2,x=-23+25*Math.cos(a),z=-135+25*Math.sin(a);
  arrow([x,12+Math.max(0,x+30)/26*6,z],-Math.atan2(-Math.sin(a),-Math.cos(a))*180/Math.PI,'Concourse turn paint');
}
for(let n=1;n<=3;n++){
  const a=-Math.PI/2+n/3*Math.PI/2;arrow([114+24*Math.cos(a),18,-136+24*Math.sin(a)],Math.atan2(Math.sin(a),-Math.cos(a))*180/Math.PI,'Dry flume turn paint');
}
add({t:'clock',p:[-57,12,43],grp:1});
for(const [x,y,z] of [[-59,12,-130],[-29,12,-137],[128,18,-164],[148,18,-164],[148,14,-51],[109,0,31]] as P[])add({t:'crate',p:[x,y,z],kind:'wood',grp:90,nm:'Park maintenance supplies'});
add({t:'bonusplatform',p:[-60,12,-151],to:[-55,12.1,-151],grp:3,nm:'Abandoned arcade side entrance'});
for(const pool of WATERPARK_POOLS)for(const offset of [-3,0,3])add({t:'wumpa',p:pool.section==='A'?[pool.p[0],pool.p[1]+1,pool.p[2]+offset]:[pool.p[0]+offset,pool.p[1]+1,pool.p[2]],grp:pool.section==='A'?2:4});

add({t:'mesh',p:WATERPARK_LOOP.entry,yaw:WATERPARK_LOOP.yaw,...createLoopMeshData(WATERPARK_LOOP.radius,WATERPARK_LOOP.width,WATERPARK_LOOP.offset),w:WATERPARK_LOOP.width,
  loopRadius:WATERPARK_LOOP.radius,loopOffset:WATERPARK_LOOP.offset,loopRequired:true,color:'#3f7380',emissive:'#102d32',tex:'metal',doubleSided:true,edgeGrinding:false,grp:6,nm:'Deathloop coaster riding ribbon'});
add({t:'crystal',p:[118,1.2,41],grp:7,nm:'Coaster survivor crystal'});
add({t:'gate',p:[118,0,48],yaw:180,grp:7,nm:'Deadwater park exit'});

// Ordered lane: exact straight launch headings, a broad concourse turn, then
// the real 3D loop path. No overview camera volumes or distant scripted shots.
const lane:P[]=[[-61,12,62],[-48,12,34],[-48,12,24]];
for(const pool of WATERPARK_POOLS.filter(p=>p.section==='A'))lane.push(pool.p,[-48,12,pool.farLip]);
lane.push([-48,12,-118],[-48,12,-135]);
for(let i=1;i<=8;i++){const a=Math.PI+i/8*Math.PI/2;lane.push([-23+25*Math.cos(a),12,-135+25*Math.sin(a)]);}
lane.push([-4,18,-160],[0,18,-160]);
for(const pool of WATERPARK_POOLS.filter(p=>p.section==='B'))lane.push(pool.p,[pool.farLip,18,-160]);
lane.push([122,18,-160],[130,18,-160],[138,18,-153],[138,18,-138],[138,18,-128],[138,4,-96],[138,16,-78],[138,14,-58],[138,14,-44],[138,0,-18]);
for(let i=0;i<=32;i++){const p=sampleLoop(WATERPARK_LOOP,i/32*Math.PI*2).point;lane.push([138-p[0],p[1],-p[2]]);}
lane.push([118,0,18],[118,0,58]);
export const WATERPARK_CAMERA_LANE=lane;
for(const p of lane)add({t:'camnode',p,grp:92});
C.push(...buildWaterparkArt({scenicRides:false,boomerangPromenadeDetails:false,frames:Object.fromEntries(Object.entries(WATERPARK_ART_SOURCE_ANCHORS).map(([name,p])=>[name,{p}])) as WaterparkArtLayout['frames'],flumePaths:[[[138,18,-128],[138,4,-101],[138,4,-96],[138,16,-78]],[[138,14,-58],[138,14,-44],[138,0,-18]]]}));
C.push(...artSign('ARCADE',[-61,15,-156],9,'#f1d8aa','#356d72'));
C.push(...artSign('DRY FLUME',[138,21,-128],15,'#f7e7bc','#377eae',180));
C.push(...artSign('KEEP SPEED',[144,2.7,-2],7,'#f5e7b7','#a2553c',180));
for(const x of [-64.8,-57.2])C.push(artBeam([x,12,-156],[x,15.5,-156],.2,'#426974','Arcade notice posts'));
for(const x of [130.5,145.5])C.push(artBeam([x,18,-128],[x,21.5,-128],.2,'#426974','Dry flume entry posts'));
C.push(artBeam([144,0,-2],[144,3,-2],.18,'#426974','Loop speed notice post'));
// Flat-colour scenery needs no UVs; normals are regenerated from its existing
// indexed geometry. Keep the full park comfortably inside editor JSON limits.
for(const c of C)if(c.t==='mesh'&&c.solid===false&&c.tex==='solid'){delete c.normals;delete c.uvs;}

export const RECOVERED_WATERPARK_LEVEL:CustomLevelData={
  v:1,name:'Deadwater Park',spawn:WATERPARK_SPAWN,killY:-18,sky:'day',cameraAirLift:1,keepPlayFog:true,
  atmosphere:{fogEnabled:true,fogNear:260,fogFar:700,fogColor:'#c9d3ce',backdrop:'sky',ambientSky:'#d5e6e4',ambientGround:'#8d7c60',ambientIntensity:.95,
    sunColor:'#fff0cf',sunIntensity:1.65,fillColor:'#a8c9d0',fillIntensity:.4,drawDistance:800,shadowStrength:.8},
  medalTimes:{gold:100,silver:135,bronze:180},components:C,groups,
};
