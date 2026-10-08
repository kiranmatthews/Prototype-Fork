import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import { fallAwayPlatform, icePlatform } from '../surfaceBehavior';
import { SUSPENSION_BEARER_X, SUSPENSION_BEARER_Y, SUSPENSION_BEARER_RADIUS, FROZEN_BOARD_GLAZE } from '../carlisleTimber';

type P = [number,number,number];
export const SKY_BRIDGE_ISLANDS = [
  {z:3,d:12,w:13.2,name:'Cloudhead temple',group:1,arch:true},
  {z:-40,d:8,w:8.2,name:'Keeper’s landing',group:1,arch:false},
  {z:-69,d:12,w:12.8,name:'First anchor sanctuary',group:2,arch:false},
  {z:-81,d:7,w:8.2,name:'Watcher’s rock',group:2,arch:false},
  {z:-109,d:6,w:8.2,name:'Frost shrine',group:3,arch:false},
  {z:-138,d:12,w:13.2,name:'Cloudtop sanctuary',group:3,arch:true},
  {z:-175,d:8,w:8.8,name:'Bristleback’s lookout',group:4,arch:false},
  {z:-204,d:11,w:12.8,name:'Last anchor sanctuary',group:5,arch:false},
  {z:-236,d:12,w:13.2,name:'Cloud observatory',group:5,arch:true},
] as const;
export const SKY_BRIDGE_SPANS = SKY_BRIDGE_ISLANDS.slice(1).map((island,i)=>({
  near:SKY_BRIDGE_ISLANDS[i].z-SKY_BRIDGE_ISLANDS[i].d/2+.65,
  far:island.z+island.d/2-.65,
}));
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
const timber = (z:number,d:number,w=4.2,name='Lashed transverse boards',group=1) =>
  add({t:'platform',p:[0,-.09,z],s:[w,.18,d],tex:'bridge-timber',color:'#ffffff',
    edgeGrinding:false,nm:name,grp:group});
const ice = (z:number,d:number,group:number) => {
  const c=icePlatform([0,FROZEN_BOARD_GLAZE,z],[4.6,.28,d],
    {tex:'bridge-ice',nm:'Frozen water over lashed boards',grp:group});
  delete c.pts;add(c);
};
const falling = (z:number,d:number,group:number,delay=.95) => add(fallAwayPlatform([0,0,z],[4.2,.18,d],
  {shake:delay,nm:'Rotten split boards · leave before the lashings fail',grp:group}));
const floor=(z:number)=>[-27,-122,-189].some((v,i)=>Math.abs(v-z)<[7,8,7.5][i])?FROZEN_BOARD_GLAZE:0;
const fruit = (z:number,x=0) => add({t:'wumpa',p:[x,floor(z)+1.1,z]});
const crate = (z:number,x=0,kind:CustomComponent['kind']='wood',name?:string) =>
  add({t:'crate',p:[x,floor(z),z],kind,nm:name});

// Every refuge is a masonry cap on a continuous rock shaft. Narrow boards
// cross the two lower load-bearing ropes; the separate upper ropes can grind.
for(const island of SKY_BRIDGE_ISLANDS){
  const x=island.w/2,z=island.d/2,k=.35;
  add({t:'platform',p:[0,-.65,island.z],s:[island.w,1.3,island.d],
    pts:[[-x+k,z],[x-k,z],[x,z-k],[x,-z+k],[x-k,-z],[-x+k,-z],[-x,-z+k],[-x,z-k]],
    color:'#d6cfb8',tex:'coast-stone',edgeGrinding:false,nm:island.name,grp:island.group});
}
timber(-7.5,5);timber(-15,5);
ice(-27,14,1);falling(-49.5,6,1,1.1);falling(-58,6,1,1.1);
add({t:'checkpoint',p:[0,0,-67],grp:2});
falling(-90.5,7,2,1.05);falling(-100,7,2,1.05);
ice(-122,16,3);add({t:'checkpoint',p:[0,0,-136],grp:3});
timber(-149,5,4.2,'High-span boards one',4);timber(-157,5,4.2,'High-span boards two',4);
falling(-165.5,6,4);ice(-189,15,4);add({t:'checkpoint',p:[0,0,-202],grp:5});
falling(-215,7,5,1.05);falling(-224.5,7,5,1.05);
add({t:'crystal',p:[0,.65,-234],grp:5});add({t:'gate',p:[0,0,-239],grp:5});
add({t:'clock',p:[-2.7,0,5]});
// The bonus remains outside both the ground route and the loaded grind rope.
add({t:'platform',p:[5.1,-.65,-139],s:[4.2,1.3,6],tex:'coast-stone',color:'#d6cfb8',
  edgeGrinding:false,nm:'Cloudtop Lockers side landing',grp:3});
add({t:'bonusplatform',p:[5.2,0,-138],to:[1.9,.05,-134],grp:3});

// Readable encounters alternate with recovery space. Explosives sit away
// from checkpoint respawns; the fruit line teaches the safe ice approach.
add({t:'enemy',p:[-.65,0,-41.5],range:.75,speed:1.8,foe:'grunt',axis:'x',grp:1,nm:'Crab at the first refuge'});
add({t:'enemy',p:[0,0,-81],range:1.3,speed:2.6,foe:'floater',axis:'x',grp:2,nm:'Watcher over the anchor rock'});
add({t:'enemy',p:[.5,0,-175.5],range:1.35,speed:2.1,foe:'spiker',axis:'x',grp:4,nm:'Bristleback lookout patrol'});
add({t:'enemy',p:[2.2,0,-232.3],range:.65,speed:1.4,foe:'turtle',axis:'x',grp:5,nm:'Mossback guarding the observatory cache'});
for(const z of [-7,-15,-39,-49,-58,-90,-100,-149,-157,-166,-215,-224])fruit(z);
for(const z of [-23,-28,-32])fruit(z,-.95);
for(const z of [-117,-122,-127])fruit(z,.95);
for(const z of [-184,-189,-193])fruit(z,-.95);
for(const z of [-70,-140,-204,-237]){crate(z,-2.1);crate(z,2.1);}
crate(5.2,-4.2);crate(5.2,4.2);crate(7,5,'mystery');crate(-69,3.6,'bouncy');crate(-139,-3.6,'life');
crate(-110.5,2.6,'multihit');crate(-37.8,-2.9,'mask');crate(-230.9,4.9,'mystery');
crate(-27,1.15,'nitro','Keep left across the first frozen span');
crate(-123,-1.15,'nitro','Anticipate right before the second frozen span');
crate(-188,1.15,'nitro','Keep left while carrying ice momentum');
crate(-37.4,2.6,'tnt','TNT at the outer edge of the first refuge');
crate(-109,-1.85,'tnt','TNT beside the frost shrine');
crate(-173,-2.9,'tnt','Jump or leave room around the lookout TNT');
crate(-206,3.1,'tnt','Final sanctuary TNT');crate(-207,-3.1,'nitro','Final sanctuary Nitro');

const round=(n:number)=>Math.round(n*10000)/10000;
function visual(geometry:THREE.BufferGeometry,p:P,color:string,name:string,tex='solid',group=7) {
  const pos=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal');
  if(tex==='coast-stone'&&uv&&normal)for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(Math.abs(normal.getY(i))>.5)uv.setXY(i,x/4,z/4);
    else if(Math.abs(normal.getX(i))>.5)uv.setXY(i,z/4,y/4);
    else uv.setXY(i,x/4,y/4);
  }
  add({t:'mesh',p,vertices:Array.from(pos.array).map(round),indices:geometry.index?Array.from(geometry.index.array):undefined,
    normals:normal?Array.from(normal.array).map(round):undefined,uvs:uv?Array.from(uv.array).map(round):undefined,
    color,tex,solid:false,edgeGrinding:false,grp:group,nm:name});
  geometry.dispose();
}

// Static lower bearers reuse the same filtered braided-rope model as the
// handrails. Their 24 cm envelope touches the 18 cm board undersides exactly.
for(const [i,span] of SKY_BRIDGE_SPANS.entries()) {
  for(const side of [-1,1]) {
    add({t:'rope',p:[side*2.65,1.35,(span.near+span.far)/2],len:span.near-span.far,
      shake:3,amp:.65,nm:'Upper hand rope · three-second grind limit',grp:6});
    add({t:'decor',dkind:'braidedrope',p:[side*SUSPENSION_BEARER_X,SUSPENSION_BEARER_Y,(span.near+span.far)/2],
      s:[SUSPENSION_BEARER_RADIUS*2,SUSPENSION_BEARER_RADIUS*2,span.near-span.far],solid:false,
      nm:`Lower bearer rope ${i} ${side}`,grp:6});
    // Exposed collars mark where each lower rope enters its stone anchor;
    // the actual rope ends continue 65 cm into the landing behind them.
    for(const z of [span.near-.665,span.far+.665])
      visual(new THREE.TorusGeometry(.19,.043,4,10),[side*SUSPENSION_BEARER_X,-.3,z],
        '#75644a','Lower rope eye fixed into masonry','solid',6);
  }
}

for(const c of C.filter(c=>c.tex==='bridge-ice'))for(const side of [-1,1])for(let j=0;j<9;j++){
  const height=.18+((j*13+3)%7)*.035;
  visual(new THREE.CylinderGeometry(.045,0,height,5),[side*2.25,-.14-height/2,c.p[2]+(j/8-.5)*(c.s![2]-1)],
    '#bfdfeb','Ice dripping below visible timber ends');
}

for(const [i,island] of SKY_BRIDGE_ISLANDS.entries()) {
  const {z,w,d}=island;
  // The near cliff cap retains natural proportions. Overlapping roots then
  // continue to -100 m, well below the death plane and every gameplay camera.
  add({t:'decor',dkind:'coastv2ledge',p:[0,-13.0,z],s:[w+1.2,12.7,d+1.4],yaw:0,
    color:'#d8dfd9',solid:false,nm:'Anchor cliff cap',grp:7});
  for(const [depth,height,width] of [[-35,27,w+1.8],[-65,39,w+3],[-110,52,w+5]] as const)
    add({t:'decor',dkind:'coastv2buttress',p:[0,depth,z],s:[width,height,d+3],yaw:180*(i%2),
      color:'#c8d4d5',solid:false,nm:`Continuous anchor shaft to ${depth} m`,grp:7});
  if(island.arch){
    // A single fitted gate replaces pillars pierced by diagonal timber. Its
    // opening is over 7 m wide; its feet sit on the masonry, outside the ropes.
    // Cloudtop's portal sits behind the bonus, clear of its approach sightline.
    const at=z+(z===3?-2.1:z===-138?-4:1.7);
    add({t:'decor',dkind:'coastarch',p:[0,0,at],s:[12.4,8.6,3.5],color:'#e4d8bd',solid:false,
      nm:'Intact temple portal on masonry',grp:7});
    for(const side of [-1,1])add({t:'wall',p:[side*5.11,0,at+(side<0?.49:-.05)],s:[2.18,8.0,side<0?2.55:3.4],invisible:true,
      nm:'Temple portal leg collision',grp:7});
  }else{
    const tall=island.d>=10,px=w/2-.78;
    for(const side of [-1,1]){
      const at=z+(side<0?-.8:.9),height=tall?5.4:3.35;
      add({t:'decor',dkind:'coastpillar',p:[side*px,0,at],s:[1.3,height,1.2],yaw:side<0?14:-14,
        color:'#ddd3bb',solid:false,nm:'Carved shrine pillar on masonry',grp:7});
      add({t:'wall',p:[side*px,0,at],s:[1.25,height,1.25],invisible:true,nm:'Shrine pillar collision',grp:7});
    }
  }
  // Low edge copings stay on the outer landings and leave the bridge mouths,
  // checkpoint recovery area, and bonus approach open.
  for(const side of [-1,1]){
    if(z===-138&&side>0)continue;
    const near=z+(d-1.15)/2,far=z-(d-1.15)/2,pillar=z+(side<0?-.8:.9);
    const intervals=island.arch?[[far,near]]:[[far,pillar-1.05],[pillar+1.05,near]];
    for(const [a,b] of intervals)if(b-a>.15){
      const geometry=new THREE.BoxGeometry(.32,.38,b-a);
      visual(geometry,[side*(w/2-.22),.19,(a+b)/2],'#bfb69c','Weathered temple coping','coast-stone');
    }
  }
}
for(const [x,z] of [[-25,-42],[29,-91],[-30,-155],[27,-215]] as const){
  add({t:'decor',dkind:'coastspire',p:[x,-42,z],s:[13,46,11],yaw:z,color:'#dbe6eb',solid:false,grp:7,nm:'Cloud spire upper cliff'});
  add({t:'decor',dkind:'coastv2buttress',p:[x,-105,z],s:[18,76,16],yaw:z,color:'#d0dfe4',solid:false,grp:7,nm:'Cloud spire continuing below view'});
}

export const SKY_BRIDGE_LEVEL: CustomLevelData = {
  v:1,name:'Sky Bridge',spawn:[0,.1,5],killY:-24,sky:'clouds',keepPlayFog:true,
  cameraAirLift:.35,cameraLookAhead:5,
  atmosphere:{fogEnabled:true,fogNear:12,fogFar:64,fogColor:'#eef4f6',backdrop:'sky',
    ambientSky:'#e3f4ff',ambientGround:'#99a7b2',ambientIntensity:1.18,
    sunColor:'#fff3dc',sunIntensity:1.6,fillColor:'#c5e5f4',fillIntensity:.42,
    shadowStrength:.55,drawDistance:160,fallbackTop:'#d4e7f1',fallbackBottom:'#f4f6f5',
    fallbackFog:'#eef4f6',fallbackRidges:false,fallbackSunColor:null},
  groups:[{id:1,nm:'I · learn the clouds'},{id:2,nm:'II · rotten span'},
    {id:3,nm:'III · frozen boards'},{id:4,nm:'IV · high span'},{id:5,nm:'V · last anchors'},
    {id:6,nm:'Load-bearing ropes and grind handrails'},{id:7,nm:'Temple landings and continuous rock shafts',editorOnly:true}],
  components:C,
};
