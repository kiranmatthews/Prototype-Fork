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
const knots:Point[]=[
  [0,210,16],[0,210,-16],[3,211,-43],[20,187,-92],
  [27,169,-139],[3,151,-185],[-21,139,-228],[9,126,-268],
  [47,113,-293],[76,104,-325],[56,93,-362],[3,82,-396],
  [-35,73,-427],[-53,63,-463],[-15,52,-496],[27,44,-519],
  [60,36,-551],[45,27,-589],[12,18,-626],[-4,12,-667],
  [-34,6,-710],[-34,1,-756],[11,-8,-808],[43,-20,-851],
  [28,-29,-901],[-13,-36,-948],[-26,-41,-997],[1,-45,-1050],
  [7,-45,-1080],
];
const curve=new THREE.CatmullRomCurve3(knots.map(p=>new THREE.Vector3(...p)),false,'centripetal');
curve.arcLengthDivisions=2400;
export const DESERT_LENGTH=curve.getLength();
export const DESERT_CHECKPOINTS=[38,128,315,510,730,940,1100,DESERT_LENGTH-45];
export function desertPoint(s:number,offset=0):Point{
  const t=clamp(s/DESERT_LENGTH),p=curve.getPointAt(t),d=curve.getTangentAt(t);
  const norm=Math.hypot(d.x,d.z);
  return [p.x-d.z/norm*offset,p.y,p.z+d.x/norm*offset];
}
export function desertYaw(s:number):number{const t=curve.getTangentAt(clamp(s/DESERT_LENGTH));return Math.atan2(-t.x,-t.z)*180/Math.PI;}
// Explicit samples also serve terrain carving and independent clearance probes.
const count=Math.ceil(DESERT_LENGTH/3);
const samples=Array.from({length:count+1},(_,i)=>({s:i/count*DESERT_LENGTH,p:desertPoint(i/count*DESERT_LENGTH)}));
function nearest(x:number,z:number){
  let distance=Infinity,s=0,y=samples[0].p[1],px=0,pz=16;
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i],dx=b.p[0]-a.p[0],dz=b.p[2]-a.p[2];
    const t=clamp(((x-a.p[0])*dx+(z-a.p[2])*dz)/(dx*dx+dz*dz));
    const qx=a.p[0]+dx*t,qz=a.p[2]+dz*t,d=(qx-x)**2+(qz-z)**2;
    if(d<distance){distance=d;s=mix(a.s,b.s,t);y=mix(a.p[1],b.p[1],t);px=qx;pz=qz;}
  }
  return {s,y,distance:Math.sqrt(distance),x:px,z:pz};
}
export function desertWidth(s:number):number{
  return 13-5*smooth(80,140,s)+3*smooth(350,520,s)+3*smooth(850,1050,s);
}
export function desertGround(x:number,z:number):number{
  const near=nearest(x,z),d=near.distance;
  const terrainNoise=noise.fbm(x*.012,3.7,z*.012,4,2,.5);
  const canyon=smooth(75,125,near.s)*(1-smooth(740,940,near.s));
  const side=x<near.x?-1:1;
  const hills=(14+26*canyon+(side>0?22*canyon:0))*smooth(9,58,d);
  const terraces=(Math.sin(z*.024+x*.035)*3+terrainNoise*17)*smooth(10,45,d);
  const ridge=22*Math.sin(z*.005+1.3)**2*smooth(85,210,d);
  const gap=near.s>67&&near.s<73&&d<12?18:0;
  return near.y-.24+hills+terraces+ridge-gap;
}

function buildComponents():CustomComponent[]{
let seed=71115;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const C:CustomComponent[]=[];
const add=(c:CustomComponent)=>{C.push(c);return c;};
const decorate=(kind:DecorKind,p:Point,size:Point,yaw:number,nm:string,grp=30,solid=false)=>add({t:'decor',dkind:kind,p:p.map(round) as Point,s:size,yaw,scenerySolid:solid,grp,nm});

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
    if(i<last&&j<cols&&!(s>67&&s<73)){
      const k=(i-first)*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
    }
  }
  add({t:'mesh',p:origin,vertices,indices,uvs,colors,normals,tex:'desert-trail',smoothCollision:true,gravityTrack:true,grp:1,nm:`Packed sandstone trail ${first}`});
}

// The valley is an actual landform with a carved trail, not floating road
// strips against a skybox. Fixed meshes retain detail in native/MAX rendering.
const x0=-260,x1=260,z0=56,z1=-1152,grid=4;
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
  add({t:'mesh',p:origin,vertices,indices,uvs,colors,normals,tex:'desert-trail',smoothCollision:true,grp:2,nm:'Continuous carved canyon terrain'});
}

// Fill the launch excavation with a smaller, deliberately recessed death
// volume. Supported landings and ordinary road edges retain native grinds.
const gapPoint=desertPoint(70);add({t:'pit',p:[gapPoint[0],gapPoint[1]-12,gapPoint[2]],s:[18,2,5],yaw:desertYaw(70),invisible:true,grp:1,nm:'Rim jump recovery'});

const kinds:DecorKind[]=['deserthoodoospire','deserthoodoocap','deserthoodoofluted','deserthoodooneedle','deserthoodootwins','deserthoodoofin'];
// Native measured USGS terrain anchors the broad canyon silhouettes. Only
// elevation geometry is reused; our surface, placement and route are authored.
decorate('desertsurveyrim',[-246,95,-260],[320,138.12,320],-55,'Measured amphitheatre · west rim',21);
decorate('desertsurveyrim',[267,25,-590],[320,138.12,320],120,'Measured amphitheatre · east rim',21);
function tower(s:number,side:number,offset:number,h:number,w:number,index:number,depth=w*.8){
  const p=desertPoint(s,side*offset);p[1]=desertGround(p[0],p[2])-.8;
  decorate(kinds[index%kinds.length],p,[w,h,depth],random()*360,'Eroded sandstone hoodoo',20,offset<26);
}
// Tight slot (1:10–1:18): continuous close rock faces, daylight overhead.
for(let s=100;s<380;s+=19){
  for(const side of [-1,1]){
    const h=29+random()*24,w=10+random()*7;
    tower(s,side,desertWidth(s)/2+w*.55+1.8,h,w,Math.floor(random()*kinds.length));
    const p=desertPoint(s+3,side*(23+random()*6));p[1]=desertGround(p[0],p[2])-3;
    decorate('deserthoodoobuttress',p,[24,38+random()*28,25],desertYaw(s),'Connected canyon wall',20);
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

// Existing vegetation only: complete Country Club pines, Custard bank scrub,
// Treehouse leafy thickets, and Carlisle's fine dry/olive grass clumps.
for(let i=0;i<88;i++){
  const s=15+random()*(DESERT_LENGTH-35),side=random()<.5?-1:1;
  if(s>110&&s<385&&i%4!==0)continue;
  const u=side*(15+random()*78),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2]);
  const h=10+random()*14;
  decorate('countryumbrellapine',p,[h*.43,h,h*.42],random()*360,'Existing pine library · canyon woodland',30);
}
for(let i=0;i<54;i++){
  const s=880+random()*(DESERT_LENGTH-900),u=(random()<.5?-1:1)*(11+random()*72),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2]);
  const h=4.5+random()*5;
  decorate(i%3===0?'treehousebush':'custardbankshrub',p,[h*1.4,h,h*1.3],random()*360,'Existing valley tree and scrub library',30);
}
for(let i=0;i<280;i++){
  const s=12+random()*(DESERT_LENGTH-25),side=random()<.5?-1:1,u=side*(desertWidth(s)/2+1+random()*26),p=desertPoint(s,u);
  p[1]=desertGround(p[0],p[2]);
  if(i%5===0){const h=.7+random()*.9;decorate('custardbankshrub',p,[h*2.5,h,h*2.2],random()*360,'Low sage-green canyon scrub',31);}
  else {const h=.24+random()*.38;decorate(i%3?'coastv2grassb':'coastv2grass',p,[h*3.1,h,h*2.8],random()*360,'Dry grass at trail shoulders',31);}
}
for(let i=0;i<150;i++){
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
  const u=side*(desertWidth(s)/2+3),p=desertPoint(s,u),yaw=desertYaw(s),h=5.2;
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
for(const s of [14,46,94,168,254,358,454,551,648,743,843,929,1003,1099,1215])for(const side of [-1,1])banner(s,side);
function fence(a:number,b:number,side:number){
  for(let s=a;s<b;s+=4){
    const u=side*(desertWidth(s)/2+5),p=desertPoint(s,u),q=desertPoint(Math.min(s+4,b),u),yaw=desertYaw(s);
    box([p[0],p[1]+.72,p[2]],[.1,1.7,.1],'#644c39','Safety fence post');
    for(const h of [.25,.55,.85,1.15]){const c:Point=[(p[0]+q[0])/2,(p[1]+q[1])/2+h,(p[2]+q[2])/2];box(c,[.035,.035,Math.hypot(q[0]-p[0],q[2]-p[2])],'#6a6250','Woven safety fence strand',yaw);}
    for(let t=.2;t<1;t+=.2)box([mix(p[0],q[0],t),mix(p[1],q[1],t)+.7,mix(p[2],q[2],t)],[.025,1.15,.025],'#6a6250','Woven safety fence strand',yaw);
    add({t:'wall',p,s:[.13,1.25,4],yaw,invisible:true,grp:40,nm:'Race fence contact'});
  }
}
fence(9,49,-1);fence(330,384,-1);fence(428,481,-1);fence(575,632,1);fence(745,780,-1);
function arrowBoard(s:number,side:number){
  const p=desertPoint(s,side*(desertWidth(s)/2+2.6));p[1]+=1.2;const yaw=desertYaw(s)+side*25;
  add({t:'mesh',p,yaw,vertices:[-2,0,0,2,0,0,2,1.1,0,-2,1.1,0],indices:[0,1,2,0,2,3],color:'#e9dcc0',tex:'solid',solid:false,doubleSided:true,grp:40,nm:'Hairpin direction board'});
  for(let i=0;i<5;i++){
    const x=-1.75+i*.72;
    add({t:'mesh',p,yaw,vertices:[x,0,.012,x+.23,0,.012,x+.58,.55,.012,x+.23,1.1,.012,x,1.1,.012,x+.35,.55,.012],indices:[0,1,2,0,2,5,5,2,3,5,3,4],tex:'solid',color:'#493831',solid:false,doubleSided:true,grp:40,nm:'Repeated dark chevron'});
  }
}
for(const s of [340,366,445,469,596,616,757])arrowBoard(s,s===596||s===616?1:-1);
for(const s of [30,960]){
  const p=desertPoint(s,15),ground=desertGround(p[0],p[2]);
  box([p[0],ground+2.4,p[2]],[6,.3,5],'#49342c','Timber event viewing deck',0,true);
  for(const dx of [-2.7,2.7])for(const dz of [-2.2,2.2])box([p[0]+dx,ground+1.2,p[2]+dz],[.24,2.4,.24],'#594334','Viewing deck timber leg');
  decorate('treehouseporchhut',[p[0]+3,ground,p[2]-3],[6,4,5],180,'Existing timber event shelter',40);
}

for(const color of dressingBatches.keys())flushDressing(color);
for(let i=0;i<DESERT_CHECKPOINTS.length;i++){
  const s=DESERT_CHECKPOINTS[i],p=desertPoint(s,2.7);
  add({t:'checkpoint',p,grp:50,nm:`${i+1} · ${['Rim overlook','Slot canyon','Sunlit narrows','Switchback terraces','Hoodoo garden','Pine valley','Free-ride basin','Valley finish'][i]}`});
}
for(let s=0;s<=DESERT_LENGTH;s+=12)add({t:'camnode',p:desertPoint(s),radius:5,grp:51,nm:'Continuous descending camera lane'});
add({t:'camnode',p:desertPoint(DESERT_LENGTH),radius:4,grp:51});
const finish=desertPoint(DESERT_LENGTH-16);
add({t:'gate',p:finish,yaw:desertYaw(DESERT_LENGTH-16),grp:50,nm:'Bryce Canyon finish'});
for(let s=115;s<DESERT_LENGTH-45;s+=57){const p=desertPoint(s);p[1]+=1;add({t:'wumpa',p,grp:50});}
add({t:'crystal',p:desertPoint(DESERT_LENGTH-30),grp:50,nm:'Canyon descent crystal'});
return C;
}

export const DESERT_CANYON_LEVEL:CustomLevelData={
  v:1,name:'Bryce Canyon · Hoodoo Run',spawn:[0,210.35,11],startWarpPad:false,
  killY:-140,sky:'day',jungleStyle:'painterly',hugeDropBail:false,
  keepPlayFog:true,cameraLookAhead:8,cameraAirLift:.12,
  cameraRig:{camDist:6.2,camHeight:4.2,camPitch:17,camFov:67},
  atmosphere:{backdrop:'sky',fogEnabled:true,fogNear:190,fogFar:740,fogColor:'#dec8b2',
    drawDistance:900,ambientSky:'#c6d8ee',ambientGround:'#c38c5b',ambientIntensity:1.65,
    sunColor:'#fff1d5',sunIntensity:3.1,sunDirection:[-.58,.6,-.48],fillColor:'#b0c8e3',fillIntensity:.45,shadowStrength:.8,
    fallbackTop:'#6b9fcd',fallbackBottom:'#e4dbcb',fallbackFog:'#dec8b2',fallbackStars:false,fallbackRidges:false,
    fallbackSunColor:'#fff4db',fallbackSunU:.23,fallbackSunV:.23},
  components:[],groups:[
    {id:1,nm:'Continuous descent and rim jump',editorOnly:true},{id:2,nm:'Carved Bryce Canyon landform',editorOnly:true},
    {id:20,nm:'Near RockGenerator hoodoos',editorOnly:true},{id:21,nm:'Native sandstone skyline',editorOnly:true},
    {id:22,nm:'Eroded talus',editorOnly:true},{id:30,nm:'Existing tree and shrub library',editorOnly:true},
    {id:31,nm:'Existing fine grasses and scrub',editorOnly:true},{id:40,nm:'Reference race dressings',editorOnly:true},
    {id:50,nm:'Playable checkpoints and finish',editorOnly:true},{id:51,nm:'Ordered camera course',editorOnly:true},
  ],
};
lazySourceField(DESERT_CANYON_LEVEL,'components',buildComponents);
