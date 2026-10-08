import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import { fallAwayPlatform, icePlatform } from '../surfaceBehavior';

type P = [number,number,number];
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
const timber = (z:number,d:number,w=4.2,name='Suspended timber deck',group=1) =>
  add({t:'platform',p:[0,-.25,z],s:[w,.5,d],tex:'bridge-timber',color:'#ffffff',
    edgeGrinding:false,nm:name,grp:group});
const ice = (z:number,d:number,group:number) => add(icePlatform([0,0,z],[4.6,.8,d],
  {nm:'Glacial glass · carry momentum and counter-steer',grp:group}));
const falling = (z:number,d:number,group:number,delay=.95) => add(fallAwayPlatform([0,0,z],[4.2,.5,d],
  {shake:delay,nm:'Split timber · warning then fall',grp:group}));
const fruit = (z:number,x=0) => add({t:'wumpa',p:[x,1.1,z]});
const crate = (z:number,x=0,kind:CustomComponent['kind']='wood') => add({t:'crate',p:[x,0,z],kind});

// The route is intentionally straight. A long slippery deck teaches momentum
// before the first failing support; dry refuges precede every mixed challenge.
timber(3,12,9,'Cloudhead departure',1);
timber(-7.5,5,4.2,'First hop',1); timber(-15,5,4.2,'Second hop',1);
ice(-27,14,1); timber(-40,8,5.4,'Dry braking refuge',1);
falling(-49.5,6,1,1.1); falling(-58,6,1,1.1);
timber(-69,12,9,'First anchor island',2);
add({t:'checkpoint',p:[0,0,-67],grp:2});

timber(-81,7,6.8,'Cloud sentinel arena',2);
add({t:'enemy',p:[0,0,-81],range:2.1,speed:2.6,foe:'floater',axis:'x',grp:2});
falling(-90.5,7,2,1.05); falling(-100,7,2,1.05);
timber(-109,6,4.8,'Frost approach',3);
ice(-122,16,3); timber(-138,12,9,'Second anchor island',3);
add({t:'checkpoint',p:[0,0,-136],grp:3});

timber(-149,5,4.2,'High-span hop one',4);
timber(-157,5,4.2,'High-span hop two',4);
falling(-165.5,6,4); timber(-175,8,5.6,'High-span refuge',4);
ice(-189,15,4); timber(-204,11,9,'Final anchor island',5);
add({t:'checkpoint',p:[0,0,-202],grp:5});

falling(-215,7,5,1.05); falling(-224.5,7,5,1.05);
timber(-236,12,9,'Cloud observatory arrival',5);
add({t:'crystal',p:[0,.65,-234],grp:5});
add({t:'gate',p:[0,0,-239],grp:5});
add({t:'clock',p:[-2.5,0,3]});
add({t:'platform',p:[5,-.25,-139],s:[4.2,.5,6],tex:'bridge-timber',color:'#ffffff',
  edgeGrinding:false,nm:'Cloudtop Lockers side landing',grp:3});
add({t:'bonusplatform',p:[5.2,0,-139],to:[1.9,.05,-134],grp:3});
for(const z of [-7,-15,-24,-29,-39,-49,-58,-90,-100,-119,-125,-149,-157,-166,-186,-191,-215,-224])fruit(z);
for(const z of [2,-70,-140,-204,-237]){crate(z,-2);crate(z,2);}
crate(-40,1.6,'mask'); crate(-109,-1.5,'multihit');

// Separate, snap-capable ropes keep the original risk/reward grind route.
// Native rope components own the visuals and collision through every state.
for(let near=-3;near>-230;near-=22)for(const x of [-2.65,2.65]) {
  const far=Math.max(-231,near-22);
  add({t:'rope',p:[x,1.35,(near+far)/2],len:near-far,shake:3,amp:.65,
    nm:'Braided side rope · three-second load limit',grp:6});
}

const round=(n:number)=>Math.round(n*10000)/10000;
function visual(geometry:THREE.BufferGeometry,p:P,color:string,name:string,tex='solid') {
  const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
  add({t:'mesh',p,vertices:Array.from(pos.array).map(round),indices:geometry.index?Array.from(geometry.index.array):undefined,
    normals:normal?Array.from(normal.array).map(round):undefined,uvs:uv?Array.from(uv.array).map(round):undefined,
    color,tex,solid:false,edgeGrinding:false,grp:7,nm:name});
  geometry.dispose();
}
function beam(a:P,b:P,r:number,color:string,name:string,tex='wood') {
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
  const geometry=new THREE.CylinderGeometry(r*.9,r,delta.length(),6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()));
  visual(geometry,from.add(to).multiplyScalar(.5).toArray() as P,color,name,tex);
}

for(const c of C.filter(c=>c.slip))for(const side of [-1,1])for(let j=0;j<7;j++){
  const height=.32+((j*13+3)%7)*.065;
  visual(new THREE.CylinderGeometry(.075,0,height,5),
    [side*(c.s![0]/2-.09),-.78-height/2,c.p[2]+(j/6-.5)*(c.s![2]-1)],
    '#bfdfeb','Ice fringe · frozen underside');
}

// Reuse the measured Carlisle rocks and rustic Meshy timber. The stone tops
// are deliberately buried below the real wooden supports; scenery never
// catches a missed jump. Four massive anchors and deep mist give this short
// course its own silhouette without hiding the next landing.
const anchors=[3,-69,-138,-204,-236];
for(const [i,z] of anchors.entries()) {
  add({t:'decor',dkind:'coastv2ledge',p:[0,-13.4,z],s:[10.8,12.8,10.5],yaw:i*73,
    color:'#d8e2e4',solid:false,nm:'Cloud-worn anchor rock',grp:7});
  for(const side of [-1,1]){
    const x=side*4.45;
    add({t:'decor',dkind:'coastpillar',p:[x,-1.1,z],s:[1.55,6.1,1.45],yaw:side*12,
      color:'#dce5e7',solid:false,nm:'Weathered suspension pylon',grp:7});
    beam([x,-1,z+2],[x,5.7,z],.24,'#a49c87','Hewn anchor brace');
    beam([x,-1,z-2],[x,5.7,z],.24,'#a49c87','Hewn anchor brace');
    // Cloth pennants hang outside the travelling lane.
    const flag=new THREE.BufferGeometry();
    flag.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,side*1.6,-.35,.05,side*.85,-1.65,.12,0,-1.2,0],3));
    flag.setIndex([0,1,2,0,2,3]);flag.computeVertexNormals();
    visual(flag,[x,4.5,z],i===anchors.length-1?'#e6b659':'#bb7954','Faded expedition pennant');
    C[C.length-1].doubleSided=true;
  }
}
for(let i=1;i<anchors.length;i++)for(const side of [-1,1]){
  const near=anchors[i-1],far=anchors[i],length=near-far;
  const points:P[]=Array.from({length:21},(_,j)=>{
    const t=j/20;return [side*4.45,5.4-3.2*Math.sin(t*Math.PI),near-length*t];
  });
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  visual(new THREE.TubeGeometry(curve,40,.085,5,false),[0,0,0],'#8d8070','Main suspension catenary','wood');
  for(let j=1;j<10;j++) {
    const t=j/10,z=near-length*t,y=5.4-3.2*Math.sin(t*Math.PI);
    // Hangers only meet actual landings; none suggests an invisible floor.
    const support=C.find(c=>c.t==='platform'&&c.s&&Math.abs(c.p[2]-z)<c.s[2]/2-.3);
    if(support)beam([side*4.45,y,z],[side*Math.min(4.2,support.s![0]/2),-.35,z],.045,'#9e9581','Suspension hanger');
  }
}
// Broken distant spires emerge below the cloud layer, clear of all jumps.
for(const [x,z,h] of [[-25,-42,25],[29,-91,30],[-30,-155,28],[27,-215,24]] as const)
  add({t:'decor',dkind:'coastspire',p:[x,-h+2,z],s:[12,h,10],yaw:z,color:'#dbe6eb',solid:false,grp:7,nm:'Distant cloud spire'});

export const SKY_BRIDGE_LEVEL: CustomLevelData = {
  v:1,name:'Sky Bridge',spawn:[0,.1,5],killY:-24,sky:'clouds',keepPlayFog:true,
  cameraAirLift:.35,cameraLookAhead:5,
  atmosphere:{fogEnabled:true,fogNear:12,fogFar:64,fogColor:'#eef4f6',backdrop:'sky',
    ambientSky:'#e3f4ff',ambientGround:'#99a7b2',ambientIntensity:1.18,
    sunColor:'#fff3dc',sunIntensity:1.6,fillColor:'#c5e5f4',fillIntensity:.42,
    shadowStrength:.55,drawDistance:160,fallbackTop:'#d4e7f1',fallbackBottom:'#f4f6f5',
    fallbackFog:'#eef4f6',fallbackRidges:false,fallbackSunColor:null},
  groups:[{id:1,nm:'I · learn the clouds'},{id:2,nm:'II · split timber'},
    {id:3,nm:'III · glacial crossing'},{id:4,nm:'IV · high span'},{id:5,nm:'V · last anchors'},
    {id:6,nm:'Snap ropes'},{id:7,nm:'Suspension architecture and cloud spires',editorOnly:true}],
  components:C,
};
