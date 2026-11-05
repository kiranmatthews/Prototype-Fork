import * as THREE from 'three';
import {SimplexNoise} from '../../vendor/rock-generator/noise.js';
import type {CustomComponent,CustomLevelData,DecorKind} from '../level';
import {lazySourceField} from './lazy-source';

type Point=[number,number,number];
const noise=new SimplexNoise(20261105);
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const round=(n:number)=>Math.round(n*10000)/10000;

/** Reference: LPkhWoYYkCA, 1:00–2:55. The first minute is the race's
 * sandstone descent; the second shows its wooded valley and free-ride apron.
 * World-space depth is inferred from the moving camera, never claimed as a rip. */
const canyonKnots:Point[]=[
  [0,210,16],[0,210,-16],[3,211,-43],[20,187,-92],
  [27,169,-139],[3,151,-185],[-21,139,-228],[9,126,-268],
  [47,113,-293],[76,104,-325],[56,93,-362],[3,82,-396],
  [-35,73,-427],[-53,63,-463],[-15,52,-496],[27,44,-519],
  [60,36,-551],[45,27,-589],[12,18,-626],[-4,12,-667],
  [-34,6,-710],[-34,1,-756],[11,-8,-808],[43,-20,-851],
  [28,-29,-901],[-13,-36,-948],[-26,-41,-997],[1,-45,-1050],
  [7,-45,-1080],
];
const upperKnots:Point[]=[
  [0,290,660],[0,289,625],[0,289,607],[0,291,592],[0,281,582],[0,279,564],
  [8,277,531],[26,272,488],[63,263,447],[79,253,393],[49,245,350],
  [-6,239,310],[-61,232,264],[-72,226,208],[-43,219,158],[-11,213,104],
  [0,210,60],[0,210,16],
];
const valleyKnots:Point[]=[
  [7,-45,-1080],[13,-45,-1110],[50,-48,-1160],[104,-53,-1220],
  [126,-58,-1290],[96,-64,-1350],[36,-69,-1395],[-34,-74,-1440],
  [-85,-80,-1500],[-104,-86,-1570],[-74,-91,-1635],[-9,-97,-1680],
  [65,-103,-1730],[107,-109,-1790],[85,-115,-1845],[20,-121,-1895],
  [-56,-127,-1940],[-92,-133,-2010],[-57,-138,-2075],[8,-143,-2125],
  [61,-146,-2180],[49,-148,-2230],[0,-149,-2270],[0,-149,-2320],
];
const curves=[upperKnots,canyonKnots,valleyKnots].map(knots=>{
  const curve=new THREE.CatmullRomCurve3(knots.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  curve.arcLengthDivisions=2400;return curve;
});
const lengths=curves.map(curve=>curve.getLength());
export const DESERT_CANYON_START=lengths[0],DESERT_CANYON_END=lengths[0]+lengths[1];
export const DESERT_LENGTH=lengths.reduce((sum,n)=>sum+n,0);
const core=(s:number)=>DESERT_CANYON_START+s;
const valley=(s:number)=>DESERT_CANYON_END+s;
export const DESERT_GAPS=[{from:68,to:80,chargeFrom:43,releaseAt:66.5,name:'Boardwalk launch'},{from:core(67),to:core(73),chargeFrom:core(47),releaseAt:core(63),name:'Canyon rim jump'}];
export const DESERT_CHECKPOINTS=[14,155,380,610,core(38),core(315),core(730),core(1100),valley(120),valley(400),valley(720),valley(1040),DESERT_LENGTH-70];
export const DESERT_CHECKPOINT_NAMES=['Boardwalk start','Upper landing','Rim traverse','Overlook approach','Canyon rim','Sunlit narrows','Hoodoo garden','Pine valley','Lower capstones','Woodland switchbacks','Dry-wash bridge','Pine slalom','Valley finish'];
function routeAt(s:number){
  const at=clamp(s,0,DESERT_LENGTH),index=at<DESERT_CANYON_START?0:at<DESERT_CANYON_END?1:2;
  return {curve:curves[index],t:clamp((at-(index===0?0:index===1?DESERT_CANYON_START:DESERT_CANYON_END))/lengths[index])};
}
export function desertPoint(s:number,offset=0):Point{
  const {curve,t}=routeAt(s),p=curve.getPointAt(t),d=curve.getTangentAt(t);
  const norm=Math.hypot(d.x,d.z);
  return [p.x-d.z/norm*offset,p.y,p.z+d.x/norm*offset];
}
export function desertYaw(s:number):number{const {curve,t}=routeAt(s),d=curve.getTangentAt(t);return Math.atan2(-d.x,-d.z)*180/Math.PI;}
// Explicit samples also serve terrain carving and independent clearance probes.
const count=Math.ceil(DESERT_LENGTH/3);
const samples=Array.from({length:count+1},(_,i)=>({s:i/count*DESERT_LENGTH,p:desertPoint(i/count*DESERT_LENGTH)}));
type SegmentNode={minX:number;maxX:number;minZ:number;maxZ:number;indices?:number[];children?:SegmentNode[]};
function segmentTree(indices:number[]):SegmentNode{
  const node:SegmentNode={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const i of indices)for(const p of [samples[i].p,samples[i+1].p]){
    node.minX=Math.min(node.minX,p[0]);node.maxX=Math.max(node.maxX,p[0]);node.minZ=Math.min(node.minZ,p[2]);node.maxZ=Math.max(node.maxZ,p[2]);
  }
  if(indices.length<=12)node.indices=indices;
  else {const axis=node.maxX-node.minX>node.maxZ-node.minZ?0:2;indices.sort((a,b)=>samples[a].p[axis]-samples[b].p[axis]);const middle=Math.floor(indices.length/2);node.children=[segmentTree(indices.slice(0,middle)),segmentTree(indices.slice(middle))];}
  return node;
}
const sampleTree=segmentTree(Array.from({length:count},(_,i)=>i));
function elevationAtZ(z:number){
  let lo=0,hi=samples.length-1;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(samples[mid].p[2]>z)lo=mid;else hi=mid;}
  const a=samples[lo],b=samples[hi],t=clamp((a.p[2]-z)/(a.p[2]-b.p[2]));
  return {x:mix(a.p[0],b.p[0],t),y:mix(a.p[1],b.p[1],t),s:mix(a.s,b.s,t)};
}
function nearest(x:number,z:number){
  let distance=Infinity,s=0,y=samples[0].p[1],px=0,pz=16;
  const bound=(node:SegmentNode)=>Math.max(node.minX-x,0,x-node.maxX)**2+Math.max(node.minZ-z,0,z-node.maxZ)**2;
  const visit=(node:SegmentNode)=>{
    if(bound(node)>distance)return;
    if(node.children){const [a,b]=node.children;if(bound(a)<bound(b)){visit(a);visit(b);}else{visit(b);visit(a);}return;}
    for(const i of node.indices!){
    const a=samples[i],b=samples[i+1],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2];
    const t=clamp(((x-a.p[0])*dx+(z-a.p[2])*dz)/(dx*dx+dz*dz));
    const qx=a.p[0]+dx*t,qz=a.p[2]+dz*t,d=(qx-x)**2+(qz-z)**2;
    if(d<distance){distance=d;s=mix(a.s,b.s,t);y=mix(a.p[1],b.p[1],t);px=qx;pz=qz;}
    }
  };visit(sampleTree);
  return {s,y,distance:Math.sqrt(distance),x:px,z:pz};
}
export function desertWidth(s:number):number{
  if(s<DESERT_CANYON_START)return 9+5*smooth(105,155,s)-smooth(DESERT_CANYON_START-60,DESERT_CANYON_START,s);
  if(s>DESERT_CANYON_END)return 14-3*smooth(150,400,s-DESERT_CANYON_END)+4*smooth(DESERT_LENGTH-180,DESERT_LENGTH,s);
  const at=s-DESERT_CANYON_START;return 13-5*smooth(80,140,at)+3*smooth(350,520,at)+3*smooth(850,1050,at);
}
export function desertGround(x:number,z:number):number{
  const near=nearest(x,z),d=near.distance;
  // Blend distant hills onto a continuous longitudinal profile. Nearest-bend
  // Voronoi boundaries must not become vertical cliffs between switchbacks.
  const longitudinal=elevationAtZ(z),far=smooth(18,70,d),baseY=mix(near.y,longitudinal.y,far);
  const terrainS=mix(near.s,longitudinal.s,far);
  const terrainNoise=noise.fbm(x*.012,3.7,z*.012,4,2,.5);
  const canyon=smooth(75,125,terrainS-DESERT_CANYON_START)*(1-smooth(740,940,terrainS-DESERT_CANYON_START));
  const hills=(14+26*canyon+22*canyon*smooth(-20,20,x-longitudinal.x))*smooth(9,58,d);
  const terraces=(Math.sin(z*.024+x*.035)*3+terrainNoise*17)*smooth(10,45,d);
  const ridge=22*Math.sin(z*.005+1.3)**2*smooth(85,210,d);
  const gap=DESERT_GAPS.some(g=>near.s>g.from&&near.s<g.to)&&d<14?20:0;
  const boardwalk=18*(1-smooth(105,145,near.s))*(1-smooth(13,30,d));
  const wash=9*(smooth(valley(680),valley(698),near.s)-smooth(valley(742),valley(760),near.s))*(1-smooth(18,45,d));
  return baseY-.24+hills+terraces+ridge-Math.max(gap,boardwalk,wash);
}

function buildComponents():CustomComponent[]{
let seed=71115;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const C:CustomComponent[]=[];
const add=(c:CustomComponent)=>{C.push(c);return c;};
const decorate=(kind:DecorKind,p:Point,size:Point,yaw:number,nm:string,grp=30,solid=false)=>add({t:'decor',dkind:kind,p:p.map(round) as Point,s:size,yaw,scenerySolid:solid,grp,nm});
function groundedRock(kind:DecorKind,p:Point,size:Point,yaw:number,nm:string,grp:number){
  // A broad, flat rock base must reach the downhill side of its footprint.
  // Sampling only its centre leaves the lower edge suspended over sloped soil.
  const angle=yaw*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  let floor=desertGround(p[0],p[2]);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a)*size[0]*.46,z=Math.sin(a)*size[2]*.46;
    floor=Math.min(floor,desertGround(p[0]+x*c+z*s,p[2]-x*s+z*c));
  }
  decorate(kind,[p[0],floor-.8,p[2]],size,yaw,nm,grp);
}
function boardwalk(from:number,to:number,name:string,rails:boolean,depth:number){
  const origin=desertPoint(from),n=Math.ceil((to-from)/2);
  const pts=Array.from({length:n+1},(_,i)=>{const p=desertPoint(mix(from,to,i/n));return [round(p[0]-origin[0]),round(p[2]-origin[2]),0,round(p[1]-origin[1])] as [number,number,number,number];});
  add({t:'woodpath',p:origin,pts,w:desertWidth(from),widths:pts.map((_,i)=>desertWidth(mix(from,to,i/n))),
    s:[9,.32,1],curve:'corner',structureStyle:'beach',scaffold:true,supports:true,rails,
    terrainSupports:false,supportDepth:depth,baySpacing:7,spacing:.66,tex:'plank',color:'#b99565',
    plankPalette:'sunny-oak',polePalette:'rustic-timber-rope',seed:71115,grp:1,nm:name});
}
boardwalk(0,68,'Opening boardwalk · raised timber takeoff',true,18);
boardwalk(80,136,'Opening boardwalk · downhill landing trestle',false,16);
boardwalk(valley(700),valley(745),'Lower valley · dry-wash timber bridge',true,10);

// A continuous, metre-sampled riding surface. The visual trail and its
// collision share vertices and smooth normals, including all banked bends.
function trailHeight(s:number,u:number){
  const center=desertPoint(s),w=desertWidth(s)/2;
  const crown=-.12*(u/w)**2;
  const ripples=(noise.noise3D(s*.09,u*.14,5)*.035+Math.sin(s*.31)*.025)*smooth(25,45,s);
  return center[1]+crown+ripples;
}
function trailNormal(s:number,u:number):number[]{
  const sample=(at:number,side:number)=>{const p=desertPoint(at,side);p[1]=trailHeight(at,side);return new THREE.Vector3(...p);};
  const across=sample(s,u+.1).sub(sample(s,u-.1));
  const along=sample(s+.1,u).sub(sample(s-.1,u));
  return across.cross(along).normalize().toArray().map(round);
}
const trailRows=Math.ceil(DESERT_LENGTH/1.6),step=DESERT_LENGTH/trailRows,cols=12;
for(let first=0;first<trailRows;first+=32){
  const last=Math.min(first+32,trailRows),origin=desertPoint(first*step),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normals:number[]=[];
  for(let i=first;i<=last;i++)for(let j=0;j<=cols;j++){
    const s=i*step,u=(j/cols*2-1)*desertWidth(s)/2,p=desertPoint(s,u);
    vertices.push(round(p[0]-origin[0]),round(trailHeight(s,u)-origin[1]),round(p[2]-origin[2]));
    uvs.push(round(u),round(s));
    normals.push(...trailNormal(s,u));
    const shade=round(.94+.035*noise.noise3D(s*.08,u*.17,1));colors.push(shade,shade,shade);
    const onTimber=s<132||(s>valley(702)&&s<valley(742));
    if(i<last&&j<cols&&!onTimber&&!DESERT_GAPS.some(g=>s+step>g.from&&s<g.to)){
      const k=(i-first)*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
    }
  }
  if(indices.length)add({t:'mesh',p:origin,vertices,indices,uvs,colors,normals,tex:'desert-trail',smoothCollision:true,gravityTrack:true,grp:1,nm:`Packed sandstone trail ${first}`});
}

// The valley is an actual landform with a carved trail, not floating road
// strips against a skybox. Fixed meshes retain detail in native/MAX rendering.
const x0=-300,x1=300,z0=740,z1=-2400,grid=4;
for(let x=x0;x<x1;x+=64)for(let z=z0;z>z1;z-=64){
  const nx=Math.round((Math.min(x+64,x1)-x)/grid),nz=Math.round((z-Math.max(z-64,z1))/grid);
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[],normals:number[]=[];
  const origin:Point=[x,0,z];
  for(let k=0;k<=nz;k++)for(let j=0;j<=nx;j++){
    const wx=x+j*grid,wz=z-k*grid,y=desertGround(wx,wz),near=nearest(wx,wz);
    vertices.push(j*grid,round(y),-k*grid);uvs.push(round(near.distance),round(near.s));
    const dx=(desertGround(wx+.5,wz)-desertGround(wx-.5,wz)),dz=(desertGround(wx,wz+.5)-desertGround(wx,wz-.5));
    normals.push(...new THREE.Vector3(-dx,1,-dz).normalize().toArray().map(round));
    const value=.83+noise.fbm(wx*.03,5,wz*.03,3,2,.5)*.14;
    const rockiness=smooth(15,36,near.distance);
    colors.push(round(value),round(value*(1-.12*rockiness)),round(value*(1-.20*rockiness)));
    if(j<nx&&k<nz){const a=k*(nx+1)+j;indices.push(a,a+1,a+nx+1,a+1,a+nx+2,a+nx+1);}
  }
  // These buried tile borders are tessellation seams inside continuous ground.
  // Generating grind rails for them created thousands of artificial candidates.
  add({t:'mesh',p:origin,vertices,indices,uvs,colors,normals,tex:'desert-trail',smoothCollision:true,edgeGrinding:false,grp:2,nm:'Continuous carved canyon terrain'});
}

// Fill the launch excavation with a smaller, deliberately recessed death
// volume. Supported landings and ordinary road edges retain native grinds.
for(const gap of DESERT_GAPS){const s=(gap.from+gap.to)/2,p=desertPoint(s);add({t:'pit',p:[p[0],p[1]-12,p[2]],s:[24,2,gap.to-gap.from],yaw:desertYaw(s),invisible:true,grp:1,nm:`${gap.name} recovery`});}

const kinds:DecorKind[]=['deserthoodoospire','deserthoodoocap','deserthoodoofluted','deserthoodooneedle','deserthoodootwins','deserthoodoofin'];
// Native measured USGS terrain anchors the broad canyon silhouettes. Only
// elevation geometry is reused; our surface, placement and route are authored.
decorate('desertsurveyrim',[-246,95,-260],[320,138.12,320],-55,'Measured amphitheatre · west rim',21);
decorate('desertsurveyrim',[267,25,-590],[320,138.12,320],120,'Measured amphitheatre · east rim',21);
function tower(s:number,side:number,offset:number,h:number,w:number,index:number,depth=w*.8){
  s=core(s);
  const p=desertPoint(s,side*offset);p[1]=desertGround(p[0],p[2])-.8;
  decorate(kinds[index%kinds.length],p,[w,h,depth],random()*360,'Eroded sandstone hoodoo',20,offset<26);
}
// Tight slot (1:10–1:18): continuous close rock faces, daylight overhead.
for(let s=100;s<380;s+=19){
  for(const side of [-1,1]){
    const h=29+random()*24,w=10+random()*7;
    tower(s,side,desertWidth(core(s))/2+w*.55+1.8,h,w,Math.floor(random()*kinds.length));
    const p=desertPoint(core(s+3),side*(23+random()*6));p[1]=desertGround(p[0],p[2])-3;
    decorate('deserthoodoobuttress',p,[24,38+random()*28,25],desertYaw(core(s)),'Connected canyon wall',20);
  }
}
// Exposed switchbacks (1:20–1:38): tower garden downhill, massive fins uphill.
for(let s=390;s<865;s+=24){
  tower(s,1,17+random()*8,30+random()*38,13+random()*10,Math.floor(random()*kinds.length));
  if(Math.floor(s/24)%2===0)tower(s,-1,20+random()*14,22+random()*31,6+random()*9,Math.floor(random()*kinds.length));
}
// Individually varied pinnacles across the basin establish the reference's
// hundreds of vertically eroded silhouettes and long parallax vistas.
for(let row=0;row<10;row++)for(let col=0;col<12;col++){
  const x=-210+col*32+(random()-.5)*22,z=-60-row*79+(random()-.5)*30,n=nearest(x,z);
  if(n.distance<33||n.distance>140)continue;
  const h=22+random()*58,w=5+random()*15;
  const kind=kinds[Math.floor(random()*kinds.length)];
  decorate(kind,[x,desertGround(x,z)-2,z],[w,h,w*(.6+random()*.5)],random()*360,'Distant native hoodoo field',21);
  if(col%3===0)decorate('deserthoodoobuttress',[x+8,desertGround(x+8,z)-5,z],[25,h*.72,24],random()*360,'Joined sandstone mesa',21);
}
// The paired capstones from the open-valley reveal at about 1:40.
tower(910,-1,21,35,15,4);tower(927,1,24,39,13,1);
tower(970,1,36,46,18,2);tower(1040,-1,29,28,10,1);

// The new upper rim has open amphitheatre views between distinct turns;
// the lower route moves through capstone gates, a wooded wash and pine slalom.
for(let s=25;s<DESERT_CANYON_START-30;s+=34)for(const side of [-1,1]){
  const offset=side*(29+random()*48),p=desertPoint(s,offset);p[1]=desertGround(p[0],p[2])-2;
  const h=15+random()*28;
  groundedRock(s<140?'deserthoodoobuttress':kinds[Math.floor(random()*kinds.length)],p,[14+random()*12,h,14+random()*9],random()*360,'Upper-rim sandstone terraces',21);
}
for(let at=30;at<lengths[2]-100;at+=38){
  const s=valley(at),side=Math.floor(at/38)%2?1:-1,p=desertPoint(s,side*(23+random()*24));p[1]=desertGround(p[0],p[2])-1;
  groundedRock(at<440?'deserthoodoocap':'deserthoodoolow',p,[12+random()*10,at<440?20+random()*15:6+random()*9,10+random()*7],random()*360,'Lower valley capstone and shelf',20);
}

// Existing vegetation only: complete Country Club pines, Custard bank scrub,
// Treehouse leafy thickets, and Carlisle's fine dry/olive grass clumps.
for(let i=0;i<220;i++){
  const s=15+random()*(DESERT_LENGTH-35),side=random()<.5?-1:1;
  if(s>core(110)&&s<core(385)&&i%4!==0)continue;
  const u=side*(15+random()*78),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2]);
  const h=10+random()*14;
  decorate('countryumbrellapine',p,[h*.43,h,h*.42],random()*360,'Existing pine library · canyon woodland',30);
}
for(let s=valley(520);s<DESERT_LENGTH-150;s+=25)for(const side of [-1,1]){
  const p=desertPoint(s,side*(14+random()*14));p[1]=desertGround(p[0],p[2]);const h=12+random()*8;
  decorate('countryumbrellapine',p,[h*.43,h,h*.42],random()*360,'Lower woodland · close pine canopy',30);
}
for(let i=0;i<170;i++){
  const s=core(880)+random()*(DESERT_LENGTH-core(900)),u=(random()<.5?-1:1)*(11+random()*72),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2]);
  const h=4.5+random()*5;
  decorate(i%3===0&&s<DESERT_CANYON_END?'treehousebush':'custardbankshrub',p,[h*1.4,h,h*1.3],random()*360,'Existing valley tree and scrub library',30);
}
for(let i=0;i<740;i++){
  const s=12+random()*(DESERT_LENGTH-25),side=random()<.5?-1:1,u=side*(desertWidth(s)/2+1+random()*26),p=desertPoint(s,u);
  p[1]=desertGround(p[0],p[2]);
  if(i%5===0){const h=.7+random()*.9;decorate('custardbankshrub',p,[h*2.5,h,h*2.2],random()*360,'Low sage-green canyon scrub',31);}
  else {const h=.24+random()*.38;decorate(i%3?'coastv2grassb':'coastv2grass',p,[h*3.1,h,h*2.8],random()*360,'Dry grass at trail shoulders',31);}
}
for(let i=0;i<370;i++){
  const s=45+random()*(DESERT_LENGTH-60),side=random()<.5?-1:1,u=side*(desertWidth(s)/2+1.2+random()*22),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2])-.12;
  const scale=.24+random()*1.35;
  decorate('deserttalus',p,[scale*2.2,scale,scale*1.6],random()*360,'Eroded sandstone scree',22,Math.abs(u)<13);
}

// Event dressings from the reference: slender purple/teal flag pairs, mesh
// safety fencing, repeated arrow boards, and timber observation platforms.
const dressingBatches=new Map<string,{vertices:number[];indices:number[]}>();
function flushDressing(color:string){
  const batch=dressingBatches.get(color);if(!batch?.vertices.length)return;
  add({t:'mesh',p:[0,0,0],...batch,color,tex:'solid',solid:false,grp:40,nm:'Batched course furniture'});
  dressingBatches.delete(color);
}
function box(p:Point,size:Point,color:string,nm:string,yaw=0,solid=false){
  if(solid)return add({t:'platform',p,s:size,color,tex:'wood',yaw,grp:40,nm});
  let batch=dressingBatches.get(color);if(!batch){batch={vertices:[],indices:[]};dressingBatches.set(color,batch);}
  const geometry=new THREE.BoxGeometry(...size).rotateY(yaw*Math.PI/180).translate(...p),offset=batch.vertices.length/3;
  batch.vertices.push(...Array.from(geometry.attributes.position.array).map(round));
  batch.indices.push(...Array.from(geometry.index!.array).map(i=>i+offset));geometry.dispose();
  if(batch.vertices.length>=7200)flushDressing(color);
}
function banner(s:number,side:number){
  const u=side*(desertWidth(s)/2+(s<136?-.15:3)),p=desertPoint(s,u),yaw=desertYaw(s),h=5.2;
  p[1]=Math.max(p[1],desertGround(p[0],p[2]));
  box([p[0],p[1]+h/2,p[2]],[.07,h,.07],'#d6a35e','Course flag pole');
  const vertices:number[]=[],indices:number[]=[],colors:number[]=[];
  for(let y=0;y<=20;y++)for(let x=0;x<=2;x++){
    const t=y/20,across=x/2,wx=across*(.9-.2*smooth(.83,1,t));
    vertices.push(wx,1+t*4.4,Math.sin(t*4.8)*.17*across);
    const color=new THREE.Color(across<.3?'#28b9bf':'#42336c');color.toArray(colors,colors.length);
    if(y<20&&x<2){const k=y*3+x;indices.push(k,k+3,k+1,k+1,k+3,k+4);}
  }
  add({t:'mesh',p,vertices,indices,colors,yaw,tex:'solid',solid:false,doubleSided:true,grp:40,nm:'Purple and turquoise course flag'});
}
for(const s of [14,46,94,168,254,358,454,551,648,743,843,929,1003,1099,1215])for(const side of [-1,1])banner(core(s),side);
for(const s of [8,60,88,164,300,460,610,valley(75),valley(250),valley(470),valley(690),valley(755),valley(945),valley(1170),DESERT_LENGTH-105])for(const side of [-1,1])banner(s,side);
function fence(a:number,b:number,side:number){
  for(let s=a;s<b;s+=4){
    const u=side*(desertWidth(s)/2+5),p=desertPoint(s,u),q=desertPoint(Math.min(s+4,b),u),yaw=desertYaw(s);
    box([p[0],p[1]+.72,p[2]],[.1,1.7,.1],'#644c39','Safety fence post');
    for(const h of [.25,.55,.85,1.15]){const c:Point=[(p[0]+q[0])/2,(p[1]+q[1])/2+h,(p[2]+q[2])/2];box(c,[.035,.035,Math.hypot(q[0]-p[0],q[2]-p[2])],'#6a6250','Woven safety fence strand',yaw);}
    for(let t=.2;t<1;t+=.2)box([mix(p[0],q[0],t),mix(p[1],q[1],t)+.7,mix(p[2],q[2],t)],[.025,1.15,.025],'#6a6250','Woven safety fence strand',yaw);
    add({t:'wall',p,s:[.13,1.25,4],yaw,invisible:true,grp:40,nm:'Race fence contact'});
  }
}
fence(core(9),core(49),-1);fence(core(330),core(384),-1);fence(core(428),core(481),-1);fence(core(575),core(632),1);fence(core(745),core(780),-1);
fence(175,220,-1);fence(380,430,1);fence(540,580,-1);fence(valley(330),valley(390),1);fence(valley(960),valley(1010),-1);
function arrowBoard(s:number,side:number){
  const p=desertPoint(s,side*(desertWidth(s)/2+2.6));p[1]+=1.2;const yaw=desertYaw(s)+side*25;
  add({t:'mesh',p,yaw,vertices:[-2,0,0,2,0,0,2,1.1,0,-2,1.1,0],indices:[0,1,2,0,2,3],color:'#e9dcc0',tex:'solid',solid:false,doubleSided:true,grp:40,nm:'Hairpin direction board'});
  for(let i=0;i<5;i++){
    const x=-1.75+i*.72;
    add({t:'mesh',p,yaw,vertices:[x,0,.012,x+.23,0,.012,x+.58,.55,.012,x+.23,1.1,.012,x,1.1,.012,x+.35,.55,.012],indices:[0,1,2,0,2,5,5,2,3,5,3,4],tex:'solid',color:'#493831',solid:false,doubleSided:true,grp:40,nm:'Repeated dark chevron'});
  }
}
for(const s of [340,366,445,469,596,616,757])arrowBoard(core(s),s===596||s===616?1:-1);
for(const s of [340,515,valley(320),valley(610),valley(970),valley(1260)])arrowBoard(s,Math.floor(s/100)%2?1:-1);
for(const s of [core(30),core(960),220,DESERT_LENGTH-110]){
  const p=desertPoint(s,15),ground=desertGround(p[0],p[2]);
  box([p[0],ground+2.4,p[2]],[6,.3,5],'#49342c','Timber event viewing deck',0,true);
  for(const dx of [-2.7,2.7])for(const dz of [-2.2,2.2])box([p[0]+dx,ground+1.2,p[2]+dz],[.24,2.4,.24],'#594334','Viewing deck timber leg');
  decorate('treehouseporchhut',[p[0]+3,ground,p[2]-3],[6,4,5],180,'Existing timber event shelter',40);
}

for(const color of dressingBatches.keys())flushDressing(color);
for(let i=0;i<DESERT_CHECKPOINTS.length;i++){
  const s=DESERT_CHECKPOINTS[i],p=desertPoint(s,2.7);
  add({t:'checkpoint',p,grp:50,nm:`${i+1} · ${DESERT_CHECKPOINT_NAMES[i]}`});
}
for(let s=0;s<=DESERT_LENGTH;s+=12)add({t:'camnode',p:desertPoint(s),radius:5,grp:51,nm:'Continuous descending camera lane'});
add({t:'camnode',p:desertPoint(DESERT_LENGTH),radius:4,grp:51});
const finish=desertPoint(DESERT_LENGTH-16);
add({t:'gate',p:finish,yaw:desertYaw(DESERT_LENGTH-16),grp:50,nm:'Bryce Canyon finish'});
for(let s=115;s<DESERT_LENGTH-45;s+=57){const p=desertPoint(s);p[1]+=1;add({t:'wumpa',p,grp:50});}
for(const s of [65,70,75,80]){const p=desertPoint(s);p[1]=292.6+Math.sin((s-65)/15*Math.PI)*1.6;add({t:'wumpa',p,grp:50,nm:'Boardwalk jump arc'});}
add({t:'crystal',p:desertPoint(DESERT_LENGTH-30),grp:50,nm:'Canyon descent crystal'});
return C;
}

export const DESERT_CANYON_LEVEL:CustomLevelData={
  v:1,name:'Bryce Canyon · Hoodoo Run',spawn:desertPoint(6).map((n,i)=>i===1?n+.35:n) as Point,startWarpPad:false,
  killY:-250,sky:'day',jungleStyle:'painterly',hugeDropBail:false,
  keepPlayFog:true,cameraLookAhead:8,cameraAirLift:.12,
  cameraRig:{camDist:6.2,camHeight:4.2,camPitch:17,camFov:67},
  atmosphere:{backdrop:'sky',fogEnabled:true,fogNear:190,fogFar:740,fogColor:'#dec8b2',
    drawDistance:900,ambientSky:'#c6d8ee',ambientGround:'#c38c5b',ambientIntensity:1.65,
    sunColor:'#fff1d5',sunIntensity:3.1,sunDirection:[-.58,.6,-.48],fillColor:'#b0c8e3',fillIntensity:.45,shadowStrength:.8,
    fallbackTop:'#6b9fcd',fallbackBottom:'#e4dbcb',fallbackFog:'#dec8b2',fallbackStars:false,fallbackRidges:false,
    fallbackSunColor:'#fff4db',fallbackSunU:.23,fallbackSunV:.23},
  components:[],groups:[
    {id:1,nm:'Boardwalk launch and complete descent',editorOnly:true},{id:2,nm:'Carved Bryce Canyon landform',editorOnly:true},
    {id:20,nm:'Near RockGenerator hoodoos',editorOnly:true},{id:21,nm:'Native sandstone skyline',editorOnly:true},
    {id:22,nm:'Eroded talus',editorOnly:true},{id:30,nm:'Existing tree and shrub library',editorOnly:true},
    {id:31,nm:'Existing fine grasses and scrub',editorOnly:true},{id:40,nm:'Reference race dressings',editorOnly:true},
    {id:50,nm:'Playable checkpoints and finish',editorOnly:true},{id:51,nm:'Ordered camera course',editorOnly:true},
  ],
};
lazySourceField(DESERT_CANYON_LEVEL,'components',buildComponents);
