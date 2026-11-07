import * as THREE from 'three';
import {SimplexNoise} from '../../vendor/rock-generator/noise.js';
import type {CustomComponent,CustomLevelData,DecorKind} from '../level';
import {lazySourceField} from './lazy-source';
import {VISTA_KNOTS,vistaHeight,vistaColour,buildVista} from './desert-vista';
import {desertPlantSize,type DesertPlantKind} from '../desertPlants';

type Point=[number,number,number];
/** User replay 2026-11-07T10-17-59, reconstructed with its omitted sixteen
 * review checkpoint skips. This is the supported final feet position. */
export const DESERT_YELLOW_GEM:Point=[300.0149,-909.0452,-4757.2115];
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
  [0,350,660],[0,349,625],[0,349,607],[0,351,592],[0,341,582],[0,339,564],
  [8,333,531],[26,319,488],[63,302,447],[79,282,393],[49,271,350],
  [-6,255,310],[-61,241,264],[-72,232,208],[-43,221,158],[-11,214,104],
  [0,210,60],[0,210,16],
];
const valleyKnots:Point[]=[
  [7,-45,-1080],[13,-48,-1110],[50,-65,-1160],[104,-90,-1220],
  [126,-108,-1290],[96,-135,-1350],[36,-145,-1395],[-34,-164,-1440],
  [-85,-189,-1500],[-104,-209,-1570],[-74,-226,-1635],[-9,-243,-1680],
  [65,-268,-1730],[107,-280,-1790],[85,-307,-1845],[20,-329,-1895],
  [-56,-346,-1940],[-92,-369,-2010],[-57,-389,-2075],[8,-411,-2125],
  [61,-428,-2180],[49,-446,-2230],[0,-460,-2270],[0,-470,-2320],
];
const curves=[upperKnots,canyonKnots,valleyKnots,VISTA_KNOTS].map(knots=>{
  const curve=new THREE.CatmullRomCurve3(knots.map(p=>new THREE.Vector3(...p)),false,'centripetal');
  curve.arcLengthDivisions=2400;return curve;
});
const lengths=curves.map(curve=>curve.getLength());
export const DESERT_CANYON_START=lengths[0],DESERT_CANYON_END=lengths[0]+lengths[1];
export const DESERT_VISTA_START=lengths[0]+lengths[1]+lengths[2];
export const DESERT_LENGTH=lengths.reduce((sum,n)=>sum+n,0);
const core=(s:number)=>DESERT_CANYON_START+s;
const valley=(s:number)=>DESERT_CANYON_END+s;
export const DESERT_GAPS=[{from:68,to:80,chargeFrom:43,releaseAt:66.5,name:'Boardwalk launch'},{from:core(67),to:core(73),chargeFrom:core(47),releaseAt:core(63),name:'Canyon rim jump'}];
export const DESERT_CHECKPOINTS=[14,155,380,610,core(38),core(315),core(730),core(1100),valley(120),valley(400),valley(720),valley(1040),DESERT_VISTA_START-70,DESERT_VISTA_START+400,DESERT_VISTA_START+820,DESERT_VISTA_START+1050,DESERT_LENGTH-95];
export const DESERT_CHECKPOINT_NAMES=['Boardwalk start','Upper landing','Rim traverse','Overlook approach','Canyon rim','Sunlit narrows','Hoodoo garden','Cactus valley','Cathedral ledge','Cactus switchbacks','Creek bridge','Lower rock chute','Rim gateway','Eagle ledge','Desert basin','River overlook','Sunset promontory'];
function routeAt(s:number){
  const at=clamp(s,0,DESERT_LENGTH),index=at<DESERT_CANYON_START?0:at<DESERT_CANYON_END?1:at<DESERT_VISTA_START?2:3;
  return {curve:curves[index],t:clamp((at-(index===0?0:index===1?DESERT_CANYON_START:index===2?DESERT_CANYON_END:DESERT_VISTA_START))/lengths[index])};
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
export function elevationAtZ(z:number){
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
  if(s>DESERT_VISTA_START)return 9.4+1.2*Math.sin((s-DESERT_VISTA_START)*.012)+.6*noise.noise3D(s*.02,2,1)+1.6*smooth(DESERT_LENGTH-100,DESERT_LENGTH,s);
  if(s<DESERT_CANYON_START)return 9-1.5*smooth(138,210,s);
  if(s>DESERT_CANYON_END)return 8.8-1.2*smooth(60,180,s-DESERT_CANYON_END);
  const at=s-DESERT_CANYON_START;return 13-5*smooth(80,140,at)+3*smooth(350,520,at)+3*smooth(850,1050,at);
}
export function desertTrailHeight(s:number,u:number):number{
  const center=desertPoint(s),w=desertWidth(s)/2;
  const crown=-.12*(u/w)**2;
  const ripples=(noise.noise3D(s*.09,u*.14,5)*.035+Math.sin(s*.31)*.025)*smooth(25,45,s);
  return center[1]+crown+ripples;
}
const creekOffset=(local:number)=>mix(-17,17,smooth(670,790,local));
export function desertGround(x:number,z:number):number{
  const longitudinal=elevationAtZ(z);
  const vistaGround=()=>{
    let y=vistaHeight(x,z,longitudinal);
    if(Math.abs(x-longitudinal.x)<45){
      const q=nearest(x,z),half=desertWidth(q.s)/2;
      const blend=1-smooth(half+.3,half+10,q.distance);
      y=mix(y,desertTrailHeight(q.s,q.distance)-.07,blend);
    }
    return y;
  };
  if(z<=-2420||(z<-2100&&Math.abs(x)>=500))return vistaGround();
  const near=nearest(x,z),d=near.distance;
  // Blend distant hills onto a continuous longitudinal profile. Nearest-bend
  // Voronoi boundaries must not become vertical cliffs between switchbacks.
  const far=smooth(18,70,d),baseY=mix(near.y,longitudinal.y,far);
  const terrainS=mix(near.s,longitudinal.s,far);
  const terrainNoise=noise.fbm(x*.018,3.7,z*.018,4,2,.5);
  const local=terrainS-DESERT_CANYON_END;
  const slot=smooth(core(60),core(140),terrainS)*(1-smooth(core(700),core(980),terrainS));
  const opening=1-smooth(180,330,terrainS);
  const lower=smooth(860,970,local)*(1-smooth(1260,1400,local));
  const gorge=Math.max(slot,opening,lower);
  const half=desertWidth(terrainS)/2;
  const east=smooth(-15,15,x-longitudinal.x);
  const exposed=smooth(240,340,local)*(1-smooth(780,900,local));
  const hills=(13+25*gorge+17*east-16*exposed*(1-east))*smooth(half+2,half+38,d);
  const ribs=Math.abs(noise.noise3D(x*.018,2,z*.024));
  const terraces=(terrainNoise*9+ribs*6)*smooth(half+2,half+36,d);
  const ridge=(22+28*Math.sin(z*.0038+1.3)**2)*smooth(60,175,d);

  const gap=DESERT_GAPS.some(g=>near.s>g.from&&near.s<g.to)&&d<14?20:0;
  const boardwalk=18*(1-smooth(105,145,near.s))*(1-smooth(13,30,d));
  const wash=9*(smooth(valley(680),valley(698),near.s)-smooth(valley(742),valley(760),near.s))*(1-smooth(18,45,d));
  let ground=baseY-.24+hills+terraces+ridge-Math.max(gap,boardwalk,wash);
  const creekLocal=near.s-DESERT_CANYON_END;
  if(creekLocal>550&&creekLocal<950){
    const center=desertPoint(near.s),right=desertPoint(near.s,1);
    const u=(x-center[0])*(right[0]-center[0])+(z-center[2])*(right[2]-center[2]);
    const mask=smooth(550,575,creekLocal)*(1-smooth(925,950,creekLocal));
    ground=mix(ground,near.y-9.2,mask*(1-smooth(3.1,6.3,Math.abs(u-creekOffset(creekLocal)))));
  }
  const vistaBlend=Math.max(smooth(-2250,-2420,z),z<-2100?smooth(300,500,Math.abs(x)):0);
  return mix(ground,vistaGround(),vistaBlend);
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
boardwalk(valley(700),valley(745),'Lower canyon · creek crossing',true,10);
// A descending rocky creek changes banks under the bridge. Native stream
// materials keep its water moving and the banks are cut into the same terrain.
{
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],from=valley(570),to=valley(930),rows=120,cols=8;
  const origin=desertPoint(from);
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const s=mix(from,to,i/rows),u=creekOffset(s-DESERT_CANYON_END)+(j/cols*2-1)*3.0,p=desertPoint(s,u);
    vertices.push(p[0]-origin[0],p[1]-origin[1]-8.25,p[2]-origin[2]);uvs.push(j/cols*1.5,i*.7);
    if(i<rows&&j<cols){const a=i*(cols+1)+j;indices.push(a,a+1,a+cols+1,a+1,a+cols+2,a+cols+1);}
  }
  add({t:'mesh',p:origin,vertices,indices,uvs,tex:'custard-water',materialStyle:'jungle-stream',color:'#7d9d91',opacity:.92,solid:false,lethal:true,doubleSided:true,castShadow:false,grp:22,nm:'Descending creek below the timber crossing'});
}

// A continuous, metre-sampled riding surface. The visual trail and its
// collision share vertices and smooth normals, including all banked bends.
const trailHeight=desertTrailHeight;
function trailNormal(s:number,u:number):number[]{
  const sample=(at:number,side:number)=>{const p=desertPoint(at,side);p[1]=trailHeight(at,side);return new THREE.Vector3(...p);};
  const across=sample(s,u+.1).sub(sample(s,u-.1));
  const along=sample(s+.1,u).sub(sample(s-.1,u));
  return across.cross(along).normalize().toArray().map(round);
}
const trailRows=Math.ceil(DESERT_LENGTH/1.6),step=DESERT_LENGTH/trailRows,cols=12;
for(let first=0;first<trailRows;first+=32){
  const vista=first*step>DESERT_VISTA_START;
  const last=Math.min(first+32,trailRows),origin=desertPoint(first*step),vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normals:number[]=[];
  for(let i=first;i<=last;i++)for(let j=0;j<=cols;j++){
    const s=i*step,u=(j/cols*2-1)*desertWidth(s)/2,p=desertPoint(s,u);
    vertices.push(round(p[0]-origin[0]),round(trailHeight(s,u)-origin[1]),round(p[2]-origin[2]));
    uvs.push(round(u),round(s));
    normals.push(...trailNormal(s,u));
    const shade=round(mix(.96,.83,smooth(.5,.98,Math.abs(u)/(desertWidth(s)/2)))+.035*noise.noise3D(s*.08,u*.17,1));
    if(vista){
      const colour=vistaColour(p[0],p[1],p[2],p[0]-elevationAtZ(p[2]).x,1);
      colour.multiplyScalar(1+.055*(1-smooth(0,1,Math.abs(u)/(desertWidth(s)/2))));
      colors.push(...colour.toArray());
    }else colors.push(shade,shade,shade);
    const onTimber=s<132||(s>valley(702)&&s<valley(742));
    if(i<last&&j<cols&&!onTimber&&!DESERT_GAPS.some(g=>s+step>g.from&&s<g.to)){
      const k=(i-first)*(cols+1)+j;indices.push(k,k+1,k+cols+1,k+1,k+cols+2,k+cols+1);
    }
  }
  if(indices.length)add({t:'mesh',p:origin,vertices,indices,uvs,colors,normals,tex:vista?'desert-sandstone':'desert-trail',smoothCollision:true,gravityTrack:true,grp:1,nm:`Packed sandstone trail ${first}`});
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

// Connected fins and rooted scree belong to the landform. Each wall follows
// a contour; outer rows break the horizon instead of isolated props on dunes.
for(const [from,to] of [[18,DESERT_CANYON_START-12],[valley(10),DESERT_VISTA_START-28]]){
  for(let s=from;s<to;s+=23)for(const side of [-1,1]){
    const local=s-DESERT_CANYON_END;
    const woodland=local>260&&local<850;
    if(woodland&&side===-1&&Math.floor(s/23)%4!==0)continue;
    if(woodland&&Math.floor(s/23)%2!==0)continue;
    const width=20+random()*12,depth=10+random()*6;
    const near=desertWidth(s)/2+depth*.55+(woodland?12:4)+random()*5;
    const p=desertPoint(s,side*near);
    const h=(woodland?17:25)+random()*(woodland?13:22)+(s<200?12:0);
    groundedRock(random()<.55?'deserthoodoofin':'deserthoodoofluted',p,[width,h,depth],desertYaw(s)+90+(random()-.5)*18,'Joined fluted canyon face',20);
    // Slightly separated pinnacles break the ridgeline at different heights.
    if(Math.floor(s/23)%2===0){
      const q=desertPoint(s+6,side*(near+14+random()*10));
      groundedRock(kinds[Math.floor(random()*kinds.length)],q,[12+random()*8,28+random()*32,12+random()*8],random()*360,'Pale capped skyline pinnacle',21);
    }
  }
  for(let s=from;s<to;s+=51)for(const side of [-1,1]){
    const p=desertPoint(s,side*(80+random()*65));
    groundedRock('deserthoodoobuttress',p,[44+random()*24,36+random()*30,26+random()*16],desertYaw(s)+90+(random()-.5)*30,'Eroded amphitheatre ridge',21);
  }
}

// Oversized desert silhouettes read as designed groups from the chase camera.
// Clearance includes each plant's full rotated footprint, not just its trunk.
const plant=(kind:DesertPlantKind,s:number,u:number,h:number,rotation:number,nm:string,grp=30)=>{
  const size=desertPlantSize(kind,h),radius=Math.hypot(size[0],size[2])*.5;
  u=Math.sign(u||1)*Math.max(Math.abs(u),desertWidth(s)/2+radius+1.8);
  const p=desertPoint(s,u);p[1]=desertGround(p[0],p[2])-h*.045;
  decorate(kind,p,size,rotation,nm,grp);
};
for(let i=0;i<255;i++){
  const s=25+random()*(DESERT_VISTA_START-60),side=random()<.5?-1:1;
  if(random()>.42+.42*(.5+.5*Math.sin(s*.017)))continue;
  plant('canyonsaguaro',s,side*(desertWidth(s)/2+9+random()*22),8+random()*6,
    desertYaw(s)+(side<0?35:145)+(random()-.5)*35,'Oversized curved cactus framing the trail',30);
}
for(let i=0;i<80;i++){
  const s=30+random()*(DESERT_VISTA_START-60),u=(random()<.5?-1:1)*(45+random()*95);
  plant('canyonsaguaro',s,u,9+random()*7,random()*360,'Tall cactus silhouette on sandstone shelves',30);
}
// Repeating broad, staggered groups have breathing room between them. A tall
// cactus, a squat cluster and a sweeping tuft make a readable cartoon rhythm.
for(let s=22,patch=0;s<DESERT_VISTA_START-24;s+=36+random()*16,patch++){
  const side=patch%3===0?-1:1,edge=desertWidth(s)/2;
  const members:Array<[DesertPlantKind,number,number,number]>=[
    ['canyonpricklypear',0,5,2.5+random()*2],
    ['canyonbarrel',5.8,8,1.9+random()*1.65],
    ['canyondryweed',-5.2,6.8,2.0+random()*1.55],
    ['canyondrygrass',-2.7,2.7,1.3+random()*.9],
    ['canyondrygrass',7.8,4.2,1.1+random()*.9],
    ['canyondrygrass',2.4,10.2,1.6+random()*.8],
    ['canyondryweed',7.2,13,1.9+random()*1.3],
  ];
  for(const [kind,ds,offset,h] of members)
    plant(kind,s+ds,side*(edge+offset),h,desertYaw(s)+(side<0?25:155)+(random()-.5)*55,'Bold asymmetric cactus and dry-weed group',31);
  // A smaller counter-group keeps the road visually framed without symmetry.
  for(let j=0;j<3;j++){
    const kind:DesertPlantKind=j===0?'canyonbarrel':j===1?'canyondryweed':'canyondrygrass';
    plant(kind,s+14+j*3.2,-side*(edge+4+j*3),j===0?2.1+random():1.4+random(),random()*360,'Offset desert counter-group',31);
  }
}
for(const [s,side,h] of [[32,-1,17],[132,1,19],[360,-1,16],[590,1,18],[core(295),-1,18],[core(710),1,20],[valley(380),-1,18],[valley(1010),1,19]]){
  plant('canyonsaguaro',s,side*(desertWidth(s)/2+11),h,desertYaw(s)+(side<0?30:150),'Landmark cartoon cactus at the next bend',30);
  plant('canyonpricklypear',s+9,side*(desertWidth(s)/2+7),4.4,desertYaw(s)+60,'Oversized paddle cactus beside the landmark',30);
}
for(let i=0;i<370;i++){
  const s=45+random()*(DESERT_VISTA_START-60),side=random()<.5?-1:1,u=side*(desertWidth(s)/2+1.2+random()*22),p=desertPoint(s,u);p[1]=desertGround(p[0],p[2])-.12;
  const scale=.24+random()*1.35;
  decorate('deserttalus',p,[scale*2.2,scale,scale*1.6],random()*360,'Eroded sandstone scree',22,Math.abs(u)<13);
}

// Timber observation platforms and the existing safety fencing. Course
// flags and directional road signs were removed at the user’s request.
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
for(const s of [core(30),core(960),220,DESERT_VISTA_START-110]){
  const p=desertPoint(s,15),ground=desertGround(p[0],p[2]);
  box([p[0],ground+2.4,p[2]],[6,.3,5],'#49342c','Timber event viewing deck',0,true);
  for(const dx of [-2.7,2.7])for(const dz of [-2.2,2.2])box([p[0]+dx,ground+1.2,p[2]+dz],[.24,2.4,.24],'#594334','Viewing deck timber leg');
  decorate('treehouseporchhut',[p[0]+3,ground,p[2]-3],[6,4,5],180,'Existing timber event shelter',40);
}

C.push(...buildVista({start:DESERT_VISTA_START,length:DESERT_LENGTH,point:desertPoint,yaw:desertYaw,profile:elevationAtZ,ground:desertGround,width:desertWidth}));
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
for(const s of [65,70,75,80]){const p=desertPoint(s);p[1]=352.6+Math.sin((s-65)/15*Math.PI)*1.6;add({t:'wumpa',p,grp:50,nm:'Boardwalk jump arc'});}
add({t:'crystal',p:desertPoint(DESERT_LENGTH-30),grp:50,nm:'Canyon descent crystal'});
add({t:'colouredgem',gemColour:'yellow',p:[...DESERT_YELLOW_GEM],grp:50,nm:'Yellow hidden gem · replay destination beyond the finish'});
return C;
}

export const DESERT_CANYON_LEVEL:CustomLevelData={
  v:1,name:'Bryce Canyon · Hoodoo Run',spawn:desertPoint(6).map((n,i)=>i===1?n+.35:n) as Point,startWarpPad:false,
  killY:-1700,sky:'bryce-golden-hour',jungleStyle:'painterly',hugeDropBail:false,
  keepPlayFog:true,cameraLookAhead:14,cameraAirLift:.12,
  cameraRig:{camDist:8,camHeight:3.6,camPitch:9,camFov:70},
  atmosphere:{backdrop:'painted sky',fogEnabled:true,fogNear:650,fogFar:1850,fogColor:'#d7b4a7',
    drawDistance:2000,ambientSky:'#9aaece',ambientGround:'#9d6137',ambientIntensity:.92,
    sunColor:'#ffdab0',sunIntensity:4.1,sunDirection:[.67,.5,.55],fillColor:'#98aad0',fillIntensity:.24,shadowStrength:1,
    fallbackTop:'#7aa7d5',fallbackBottom:'#f4d4bd',fallbackFog:'#dfbcb1',fallbackStars:false,fallbackRidges:false,
    fallbackSunColor:'#fff2d5',fallbackSunU:.68,fallbackSunV:.17},
  components:[],groups:[
    {id:1,nm:'Boardwalk launch and complete descent',editorOnly:true},{id:2,nm:'Carved Bryce Canyon landform',editorOnly:true},
    {id:20,nm:'Near RockGenerator hoodoos',editorOnly:true},{id:21,nm:'Native sandstone skyline',editorOnly:true},
    {id:22,nm:'Eroded talus',editorOnly:true},{id:30,nm:'Sculpted desert cacti',editorOnly:true},
    {id:31,nm:'Sculpted dry weeds and grasses',editorOnly:true},{id:40,nm:'Reference race dressings',editorOnly:true},
    {id:60,nm:'Vast valley and opposite mesas',editorOnly:true},{id:61,nm:'Exposed ledge and native conifer groves',editorOnly:true},
    {id:62,nm:'Traversable slopes and basin',editorOnly:true},
    {id:50,nm:'Playable checkpoints and finish',editorOnly:true},{id:51,nm:'Ordered camera course',editorOnly:true},
  ],
};
lazySourceField(DESERT_CANYON_LEVEL,'components',buildComponents);
