import { BoxGeometry, BufferGeometry, Float32BufferAttribute, ShapeGeometry } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { MALL_LEVEL, mallPoint, mallSupport } from './mall';
import { SCHOOL_MIAMI_LEVEL, SCHOOL_TABLES, SCHOOL_LONG_CANOPY, SCHOOL_STAIRS } from './school-miami';
import { KONA_LEVEL, KONA_SNAKE, konaSupport } from './kona';
import { WAREHOUSE_REFERENCE_LEVEL } from './codex-lab';
import { sourceAssembly, sourceDoorway, transformPoint, type SourceTransform } from './mayfield-source';
import {mallWalkway, mallGuard, mallGuardPath, mallLanding} from './mayfield-access';

type P = [number, number, number];
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [];
let group = 800;
const palette = {cream:'#f4dfb5',tile:'#d6ddd1',teal:'#4c9f9b',purple:'#8064a0',pink:'#d98698',blue:'#7eafc2',ink:'#343d58',yellow:'#f6c66f',green:'#689c7a'};
const add = (c: CustomComponent) => { c.grp = group; C.push(c); return c; };
function section(id:number,nm:string) { group=id; groups.push({id,nm,editorOnly:true}); }
function slab(nm:string,x:number,s:number,y:number,w:number,d:number,h=.6,color=palette.tile) {
  return add({t:'platform',nm,p:[x,y-h/2,-s],s:[w,h,d],tex:'solid',color});
}
const paint = new Map<string,{vertices:number[];indices:number[];color:string;grp:number}>();
function geometry(_nm:string,geo:BoxGeometry|ShapeGeometry,p:P,color:string,yaw=0) {
  geo.rotateY(yaw*Math.PI/180); geo.translate(...p);
  const key=`${group}/${color}`;
  // Split batches before the editor's 4,096-vertex mesh limit, retaining every triangle.
  let b=paint.get(key); let k=key;
  for(let i=0;b && b.vertices.length+geo.attributes.position.count*3>12000;i++){k=`${key}/${i}`;b=paint.get(k);}
  if(!b){b={vertices:[],indices:[],color,grp:group};paint.set(k,b);}
  const offset=b.vertices.length/3;
  b.vertices.push(...Array.from(geo.attributes.position.array));
  b.indices.push(...(geo.index?Array.from(geo.index.array):Array.from({length:geo.attributes.position.count},(_,i)=>i)).map(i=>i+offset));
  geo.dispose();
}
function box(nm:string,p:P,s:P,color:string,yaw=0){geometry(nm,new BoxGeometry(...s),p,color,yaw);}
const font = new FontLoader().parse(fontData);
function text(label:string,p:P,height:number,width:number,color=palette.cream,yaw=0) {
  const geo=new ShapeGeometry(font.generateShapes(label,height),4); geo.computeBoundingBox();
  const bounds=geo.boundingBox!;const span=bounds.max.x-bounds.min.x,scale=Math.min(1,width/span),center=(bounds.min.x+bounds.max.x)/2;
  geo.scale(scale,scale,1);geo.translate(-center*scale,0,0);
  // Long signage is split into triangle chunks by geometry(), with no detail swaps.
  geometry(label,geo,p,color,yaw);
}
function sign(label:string,s:number,y:number,w=17,color=palette.purple,x=0) {
  box(`${label} sign`,[x,y,-s],[w,2.3,.35],color);
  box('Sign cream rim',[x,y-1.12,-s+.05],[w+.35,.13,.45],palette.yellow);
  text(label,[x,y-.52,-s+.19],1.25,w-1.2);
}
function wall(nm:string,x:number,a:number,b:number,y:number,h:number,color:string){
  return add({t:'wall',nm,p:[x,y,-(a+b)/2],s:[.7,h,b-a],tex:'solid',color});
}
function floor(a:number,b:number,y:number,w:number,color=palette.tile) {
  slab('Concourse · continuous supported floor',0,(a+b)/2,y,w,b-a,.8,color);
  for(const x of [-w/2+1.1,w/2-1.1]) box('Teal tile border',[x,y+.012,-(a+b)/2],[.65,.018,b-a],palette.teal);
  for(let s=a+3;s<b-1;s+=6)box('Floor tile joint',[0,y+.012,-s],[w-.3,.012,.045],'#b4beb7');
}
function fruit(s:number,x=0,y=0){add({t:'wumpa',p:[x,y+1,-s]});}
function crate(s:number,x=0,y=0,kind:CustomComponent['kind']='wood'){add({t:'crate',p:[x,y,-s],kind});}
export const MAYFIELD_ROUTE:P[]=[];
export const MAYFIELD_CHECKPOINTS:{s:number;y:number;x:number;name:string}[]=[];
export const MAYFIELD_GAPS:{a:number;b:number;y:number;w:number}[]=[];
export const MAYFIELD_SOURCE_PROVENANCE:{source:string;assembly:string;components:number;triangles:number;solid:number;transform:SourceTransform;cut?:[number,number]}[]=[];
export const MAYFIELD_JOINS:{name:string;points:P[];width:number}[]=[];
export const MAYFIELD_EXPLORATION_LINES:{name:string;points:P[]}[]=[];
function reuse(source:string,level:CustomLevelData,pick:(c:CustomComponent)=>boolean,t:SourceTransform,label:string,cut?:[number,number]) {
  const parts=sourceAssembly(level,pick,t,label,group,cut);
  for(const c of parts)if(c.t==='mesh'&&c.solid!==false&&!c.vert)c.solidSides=true;
  C.push(...parts);
  MAYFIELD_SOURCE_PROVENANCE.push({source,assembly:label,components:parts.length,triangles:parts.reduce((n,c)=>n+(c.indices?.length??0)/3,0),solid:parts.filter(c=>c.solid!==false&&['mesh','platform','ramp','vertramp'].includes(c.t)).length,transform:t,cut});return parts;
}
function route(points:P[]){MAYFIELD_ROUTE.push(...points);}
function cp(p:P,name:string){MAYFIELD_CHECKPOINTS.push({s:-p[2],y:p[1],x:p[0],name});add({t:'checkpoint',p,nm:name});}
function join(a:P,b:P,width=24,nm='Mayfield connecting concourse',guards=true){
  const dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz);
  // Overlap the receiving landing across the whole width. A centre-point
  // contact alone leaves wedges at oblique source cuts and cracks at end faces.
  const at=(t:number)=>a.map((v,i)=>v+(b[i]-v)*t) as P;
  mallWalkway(add,nm,[at(-2/d),at(1+2/d)],width,guards);MAYFIELD_JOINS.push({name:nm,points:[a,b],width});
  for(let t=.35;t<1;t+=.35){const y=a[1]+(b[1]-a[1])*t;if(y>3)slab('Concourse support pier',a[0]+dx*t,-a[2]-dz*t,y-1.2,4,4,y-.2,palette.cream);}
}
// A full-width apron meets each sliced Mall floor on its own cut plane.
// The outer edge is level, with an opening only where the next concourse joins.
function mallApron(nm:string,t:SourceTransform,station:number,direction:number,x0:number,x1:number,ceiling:number,centre:number,base:number,opening=30){
 const inner:P[]=[],outer:P[]=[];
 for(let i=0;i<=24;i++){
  const x=x0+(x1-x0)*i/24,y=mallSupport(x,-station,ceiling);
  inner.push(transformPoint([x,Number.isFinite(y)?y:base,-station-direction*.35],t));
  outer.push(transformPoint([x,base,-station+direction*12],t));
 }
 mallLanding(add,nm,inner,outer);
 const p=(x:number)=>transformPoint([x,base,-station+direction*12],t);
 mallGuard(add,nm+' / left edge',outer[0],inner[0]);mallGuard(add,nm+' / right edge',outer[24],inner[24]);
 if(centre-opening/2>x0)mallGuard(add,nm+' / outer left',p(x0),p(Math.min(x1,centre-opening/2)));
 if(centre+opening/2<x1)mallGuard(add,nm+' / outer right',p(Math.max(x0,centre+opening/2)),p(x1));
 return p(centre);
}
function foundation(parts:CustomComponent[],name:string){
 const lo:P=[Infinity,Infinity,Infinity],hi:P=[-Infinity,-Infinity,-Infinity];
 for(const c of parts)if(c.t==='mesh'&&c.vertices)for(let i=0;i<c.vertices.length;i+=3)for(let k=0;k<3;k++){const n=c.p[k]+c.vertices[i+k];lo[k]=Math.min(lo[k],n);hi[k]=Math.max(hi[k],n);}
 if(!Number.isFinite(lo[0])||lo[1]<2)return;
 slab(name,(lo[0]+hi[0])/2,-(lo[2]+hi[2])/2,lo[1]-.4,hi[0]-lo[0],hi[2]-lo[2],lo[1]+.6,'#a7a395');
}
function skirt(parts:CustomComponent[],bottom:number,portals:[P,P][]){
 const edges=new Map<string,{a:P;b:P;n:number}>(),key=(p:P)=>p.map(v=>v.toFixed(4)).join(',');
 for(const c of parts)if(c.t==='mesh'&&c.vertices&&c.solid!==false){const ids=c.indices!;for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){
  const a=c.vertices.slice(ids[i+j]*3,ids[i+j]*3+3).map((v,k)=>v+c.p[k]) as P,b=c.vertices.slice(ids[i+(j+1)%3]*3,ids[i+(j+1)%3]*3+3).map((v,k)=>v+c.p[k]) as P,k=[key(a),key(b)].sort().join('|');const edge=edges.get(k);if(edge)edge.n++;else edges.set(k,{a,b,n:1});
 }}
 let vertices:number[]=[],indices:number[]=[];const flush=()=>{if(vertices.length){add({t:'mesh',nm:'Kona terrace / fitted concrete skirt',p:[0,0,0],vertices,indices,solid:true,solidSides:true,doubleSided:true,color:'#7c9a91',tex:'solid',edgeGrinding:false});vertices=[];indices=[];}};
 for(const {a,b,n}of edges.values())if(n===1&&Math.max(a[1],b[1])>bottom+.1){
  // The source snake loops above its approach. Keep a full-height portal
  // through the added foundation, beneath the intact elevated riding mesh.
  const mid=a.map((v,i)=>(v+b[i])/2) as P;
  if(portals.some(([u,v])=>{const dx=v[0]-u[0],dz=v[2]-u[2],t=Math.max(0,Math.min(1,((mid[0]-u[0])*dx+(mid[2]-u[2])*dz)/(dx*dx+dz*dz)));return Math.hypot(mid[0]-u[0]-dx*t,mid[2]-u[2]-dz*t)<14;}))continue;const i=vertices.length/3;vertices.push(...a,...b,b[0],bottom,b[2],a[0],bottom,a[2]);indices.push(i,i+1,i+2,i,i+2,i+3);if(vertices.length>11000)flush();}flush();
}
function mallRoute(t:SourceTransform,points:[number,number][],ceiling:number){return points.map(([x,s])=>transformPoint([x,mallSupport(x,-s,ceiling),-s],t));}
const sourceMain=[[-13100,760],[-10800,780],[-10000,1000],[-7700,1000],[-6850,900],[-6550,870],[-6250,660],[-5500,550],[-4000,550],[-3500,480],[-3100,525],[-2700,700],[-2300,925],[-1900,1300],[-1500,1500],[-1100,1900],[-900,2300],[-1000,2900],[-1300,3000],[-1600,3350],[-1600,4300],[-1750,4900],[-1700,5450],[-1500,5800],[-1200,6050],[-500,6180],[-100,6100],[300,6000],[1800,5800],[3500,5800],[5400,5800],[6500,5800],[7600,5800]];

const upper:SourceTransform={pivot:[15,118.786,-80],target:[0,100,0],scale:[.96,1,.92]};
section(799,'00 · Mall parking garage, quarter pipes and stacked descent');
const parkingParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign'&&c.breakable!=='glass',upper,'Mall parking garage',[-65,60]);
for(const c of parkingParts)if(c.t==='mesh'&&c.solid!==false){
 if(c.vert&&c.vertices&&c.indices){
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(c.vertices,3));geometry.setIndex(c.indices);geometry.computeVertexNormals();
  c.normals=Array.from(geometry.attributes.normal.array);c.smoothCollision=true;geometry.dispose();
 }
 else c.solidSides=true;
}
// The source wall's straight lower chords sit just above the refined quarter
// surface. Extend those side contacts inside the visible wall to seal the gap;
// the riding mesh and its vertical tangent remain intact.
const quarterSides=[-21.946701,7.360911].map(x=>transformPoint([x,0,0],upper)[0]);
for(const c of parkingParts)if(c.t==='wallpath'&&quarterSides.some(x=>Math.abs(c.p[0]-x)<.01)&&c.p[2]>24&&c.p[2]<44){
 c.p[1]-=.65;c.rise=(c.rise??0)+.65;
 if(c.wallHeights)c.wallHeights=c.wallHeights.map(h=>h+.65) as [number,number];
}
const parkingHeader=transformPoint([-10,172,-51],upper);
sign('MAYFIELD PARKING',-parkingHeader[2],parkingHeader[1],25,palette.teal,parkingHeader[0]);
// Retain the source entrance's three overlapping storeys and both end quarters.
// The conventional route turns across their flat toes, then descends the two
// original sloping corridors. Riding a vertical wall is an optional skate line.
const parkingSource:[number,number,number][]=[
 [0,0,156],[0,18,156],[0,30,156],[-3,37,157],[-8.5,40,158],[-14,37,158],[-17,30,156],
 [-17,18,155],[-17,-4,150],[-17,-26,141],[-17,-37,138],[-13,-42,138],[-6,-42,138],[0,-37,138],
 [0,-20,133],[0,0,126],[0,20,121],[0,44,120],[0,60,120],[10,70,120],
];
export const MAYFIELD_PARKING_ROUTE=parkingSource.map(([x,s,ceiling])=>transformPoint([x,mallSupport(x,-s,ceiling),-s],upper));
route(MAYFIELD_PARKING_ROUTE);
cp(MAYFIELD_PARKING_ROUTE[17],'Parking garage exit');

section(800,'01 · Original Mall upper galleria, fountain and escalators');
const upperParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign',upper,'Mall upper galleria',[60,465]);
const upperPath=mallRoute(upper,[[15,80],[15,100],[15,180],[28,232],[28,300],[16,350],[15.2,361],[5.75,374.56],[.8,408],[.8,465]],120);
route(upperPath);sign('MAYFIELD MALL',18,113,28);cp(upperPath[2],'Galleria escalators');cp(upperPath[6],'Fountain gallery');
// Full-size source directories now stand on the ground-floor route rather than
// their original upper balconies. Their bodies have fitted ordinary contact.
for(const [x,station,yaw]of [[28,72,-12],[-28,190,18]]){
 reuse('mall',MALL_LEVEL,c=>c.breakable==='sign'&&c.breakGroup===33,{pivot:[-15.99,136.87,-133.22],target:[x,100,-station],scale:[1,1,1],yaw},'Mall / relocated directory');
 add({t:'wall',nm:'Directory fitted body',p:[x,100,-station],s:[10.4,7.12,.35],yaw,invisible:true});
}
// Add ordinary access to the source sculpture mezzanine and upper balcony.
// These narrow side stairs preserve the fountain, sculpture and original decks.
const mezzanineJunction:P=[-50,119.8,-280];
const mezzanineAccess:P[]=[[-50,100,-210],[-50,119.8,-270],mezzanineJunction,[-30,119.8,-280],[-18,116.687,-280]];
mallWalkway(add,'Galleria / sculpture mezzanine stair',mezzanineAccess,5.5);
// Reach the front balcony through the open interior beside the fountain.
// The former outside catwalk intersected the source building's tall facade.
const balconyAccess:P[]=[[-3,100,-245],[-3,123.3,-155],[-10,123.3,-155],[-10,123.3,-94],[-20,120.5928,-85]];
mallWalkway(add,'Galleria / upper balcony promenade',balconyAccess,5.5);
const mezzanineApproach:P[]=[upperPath[4],[-42,100,-202.4],[-50,100,-202.4],...mezzanineAccess];
MAYFIELD_EXPLORATION_LINES.push(
 {name:'Galleria sculpture mezzanine',points:mezzanineApproach},
 {name:'Galleria upper balcony',points:[upperPath[5],...balconyAccess]},
);
const parkingStart=MAYFIELD_PARKING_ROUTE[0];
add({t:'clock',p:[parkingStart[0]-3,parkingStart[1],parkingStart[2]-6],nm:'Mayfield time trial'});
for(const [i,p]of upperPath.entries())if(i>0&&i<upperPath.length-1){fruit(-p[2],p[0],p[1]);if(i%2===0)crate(-p[2]+6,p[0]+4,p[1]);}

const gymY=upperPath[upperPath.length-1][1],arcadeY=gymY-10.5;
section(801,'02 · School Miami gym, banks and downhill courtyard');
const gym:SourceTransform={pivot:[97,0,29],target:[0,gymY,-385],scale:[.9,.9,.9],yaw:180};
// Keep the complete gym: roof/skylight, basketball floor, two banks, full rails,
// hoop quarter and architectural skin. Open a second door in the south wall.
const schoolGym:CustomLevelData={...SCHOOL_MIAMI_LEVEL,components:SCHOOL_MIAMI_LEVEL.components.flatMap(c=>{
 if(c.nm==='Gym entrance wall'){
  const [a,b]=c.p[0]<97?[45.2,62]:[132,149];
  return [{...c,p:[(a+b)/2,c.p[1],c.p[2]] as P,s:[b-a,c.s![1],c.s![2]] as P}];
 }
 if(c.nm==='Gym central door lintel')return[{...c,p:[97,c.p[1],c.p[2]] as P,s:[70,c.s![1],c.s![2]] as P}];
 if(c.nm!=='Gym south wall')return[c];
 return [[45.2,60],[134,149]].map(([a,b])=>({...c,p:[(a+b)/2,c.p[1],c.p[2]] as P,s:[b-a,c.s![1],c.s![2]] as P}));
})};
const gymParts=reuse('school-miami',schoolGym,c=>c.grp===8,gym,'School Miami / complete gym');
// Keep the detached source pavilion and glazed passage as a supported shop
// terrace beside the food court, rather than leave them hanging in empty space.
for(const c of gymParts)if(c.nm?.includes('West entrance pavilion')||c.nm?.includes('Closed glazed west passage')){c.p[0]-=60;c.p[2]-=12;}
const gymPath=[[97,0,29],[97,0,39],[79,0,58],[79,0,82],[80,0,98]].map(p=>transformPoint(p as P,gym));
join(upperPath[upperPath.length-1],gymPath[0],40,'Food court entrance landing',false);route(gymPath);
slab('Food court / complete table and pavilion plaza',13.5,361,gymY,113,54,1.2,palette.cream);
for(const [a,b]of[
 [[-43,gymY,-334],[70,gymY,-334]],[[70,gymY,-334],[70,gymY,-388]],
 [[70,gymY,-388],[47,gymY,-388]],[[-43,gymY,-334],[-43,gymY,-371]],
 [[-43,gymY,-384],[-43,gymY,-388]],
] as [P,P][])mallGuard(add,'Food court perimeter',a,b);
slab('Gym supported maple subfloor',0,416.1,gymY,94,64,.8,'#b8a47e');cp(gymPath[2],'Food court gym');
add({t:'wall',nm:'Gym courtyard / continuous window lintel',p:[0,gymY+8.2,-447.1],s:[66.6,4.4,.82],color:'#a18e72',tex:'wood'});
const downhill:SourceTransform={pivot:[84,0,-10],target:[15.3,gymY,-459],scale:[1.05,1.05,1.05]};
reuse('school-miami',SCHOOL_MIAMI_LEVEL,c=>c.nm?.startsWith('Handicap')===true,downhill,'School Miami / downhill ramp');
const canopy:SourceTransform={pivot:SCHOOL_LONG_CANOPY[0].map(n=>n*2) as P,target:[21.6,gymY+7.14,-451],scale:[1.05,1.05,.78]};
reuse('school-miami',SCHOOL_MIAMI_LEVEL,c=>c.nm?.startsWith('Long blue canopy')===true,canopy,'School Miami / accessible blue canopy');
const canopyPath=SCHOOL_LONG_CANOPY.map(p=>transformPoint(p.map(n=>n*2) as P,canopy));
const hillPath=[[84,0,-10],[82,-1,-25],[79,-5,-42],[76,-9,-60],[74,-10,-74]].map(p=>transformPoint(p as P,downhill));
join(gymPath[gymPath.length-1],hillPath[0],28,'Gym exit / downhill landing',false);route(hillPath);
slab('Gym exit / full-width service landing',15.3,453,gymY,32,15,1.2,palette.cream);
const rampEdge=Array.from({length:65},(_,i)=>{const t=i/64;return[84-10*t,-10*t*t*(3-2*t),-10-64*t] as P;});
for(const side of[-1,1])mallGuardPath(add,'Courtyard downhill edge',rampEdge.map(p=>transformPoint([p[0]+side*SCHOOL_STAIRS.width*64/Math.hypot(10,64),p[1],p[2]-side*SCHOOL_STAIRS.width*10/Math.hypot(10,64)],downhill)));
// Rearranged full-size table-and-bench clusters occupy the new gym approaches.
for(const [i,table]of SCHOOL_TABLES.slice(0,4).entries()){
 const pivot=table.p.map(n=>n*2) as P;
 reuse('school-miami',SCHOOL_MIAMI_LEVEL,c=>c.nm?.startsWith(table.name)===true,{pivot,target:[i%2?-23:25,gymY,-362-Math.floor(i/2)*10],scale:[1,1,1],yaw:i%2?25:-20},'School table and rail cluster');
}
sign('FOOD + FRIENDS',371,gymY+11,29,palette.pink);

const roofY=gymY+12.6;
const upperExit=[transformPoint([15,mallSupport(15,-450,125),-450],upper),[0,100,-361] as P,[0,roofY,-392] as P];
mallWalkway(add,'Galleria high lane / gym roof skywalk',upperExit,8);
const lowerExit=[transformPoint([-40,mallSupport(-40,-460,110),-460],upper),[-53,73.6570669,-357] as P,[-53,gymY,-378] as P,[-39,gymY,-378] as P];
mallWalkway(add,'Galleria lower lane / food court return',lowerExit,7);
const roofAscent:P[]=[[53,gymY,-373],[53,roofY,-415],[37,roofY,-415]];
mallWalkway(add,'Food court / roof access ramp',roofAscent,7);
const pavilionAscent:P[]=[[33,gymY,-381],[33,gymY+6.84,-359],[33,gymY+6.84,-350]];
mallWalkway(add,'Food court / pavilion and glazed terrace ramp',[...pavilionAscent,[33,gymY+6.84,-346],[44,gymY+6.84,-346],[65,gymY+6.84,-346]],6);
// The original skylight remains visible beneath a fitted walkable glass pane.
const skylightGlass=new BoxGeometry(8.5,.18,7);
add({t:'mesh',nm:'Gym roof / fitted skylight glazing',p:[-8.82,roofY-.09,-429.46],vertices:Array.from(skylightGlass.attributes.position.array),indices:Array.from(skylightGlass.index!.array),color:'#8fcbd5',tex:'solid',opacity:.48,solid:true,solidSides:true});skylightGlass.dispose();
mallWalkway(add,'Gym roof / canopy access',[[37,roofY,-439],[41,roofY,-453],[21.6,canopyPath[0][1],-453],canopyPath[1]],6);
MAYFIELD_EXPLORATION_LINES.push(
 {name:'Galleria lower exit to food court',points:[...lowerExit,[0,gymY,-378]]},
 {name:'Galleria high lane to gym roof',points:[upperPath[5],[0,100,-300],...upperExit]},
 {name:'Food court roof and canopy',points:[[0,gymY,-376],[53,gymY,-365],...roofAscent,[32,roofY,-415],[32,roofY,-430],[37,roofY,-434],[37,roofY,-439],[41,roofY,-453],[21.6,canopyPath[0][1],-453],...canopyPath.slice(1)]},
 {name:'Pavilion and glazed passage terrace',points:[[0,gymY,-376],[13,gymY,-381],[33,gymY,-383],...pavilionAscent,[33,gymY+6.84,-346],[44,gymY+6.84,-346],[65,gymY+6.84,-346]]},
);

section(802,'03 · Original Mall crossrail arcade / reordered architectural bay');
const arcade:SourceTransform={pivot:[237,38.583,-790],target:[0,arcadeY,-548],scale:[1.08,1,.95]};
const arcadeParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign',arcade,'Mall crossrail arcade',[790,988]);
const arcadePath=mallRoute(arcade,[[221,790],[221,815],[221,850],[221,875],[237,910],[237,950],[237,988]],60);
const arcadeEntry=mallApron('Arcade / fitted entry landing',arcade,790,1,193,280,40.1,221,mallSupport(221,-790,40.1),180);
// A broad turning court closes the full diagonal junction at the downhill toe.
// Its edges meet the arcade apron at the same grade; it is not a narrow bridge
// cutting across an otherwise unsupported corner.
mallLanding(add,'Courtyard / broad turning landing',[[-47.52,arcadeY+.5,-516],[46.44,arcadeY+.5,-516]],[[-47.52,arcadeEntry[1],-537],[46.44,arcadeEntry[1],-537]]);
for(const [a,b]of[
 [[-47.52,arcadeY+.5,-516],[-10,arcadeY+.5,-516]],[[22,arcadeY+.5,-516],[46.44,arcadeY+.5,-516]],
 [[-47.52,arcadeY+.5,-516],[-47.52,arcadeEntry[1],-537]],[[46.44,arcadeY+.5,-516],[46.44,arcadeEntry[1],-537]],
] as [P,P][])mallGuard(add,'Courtyard turning court perimeter',a,b);
MAYFIELD_JOINS.push({name:'Courtyard to arcade',points:[hillPath[hillPath.length-1],arcadeEntry],width:28});
route([arcadeEntry,...arcadePath]);cp(arcadePath[2],'Crossrail arcade');
const canopyReturn:P[]=[...canopyPath.slice(-2),[40,69,-530.56],[40,arcadePath[0][1],-540],[22,arcadePath[0][1],-540]];
mallWalkway(add,'Canopy / arcade return',canopyReturn,7);
MAYFIELD_EXPLORATION_LINES.find(l=>l.name==='Food court roof and canopy')!.points.push(...canopyReturn.slice(2),[arcadePath[0][0],arcadePath[0][1],-540],arcadePath[0]);
// Both original two-storey arcade terraces now have entrances and roof stairs.
for(const side of[-1,1]){
 const lower=75.6024,upperRoof=83.8288,main=arcadePath[arcadePath.length-1][1];
 const terrace:P[]=[[side*12,main,-743],[side*33,lower,-743],[side*33,lower,-728]];
 mallWalkway(add,'Arcade / '+(side<0?'west':'east')+' terrace stair',terrace,6,true,palette.tile,[terrace[0]]);
 const roof:P[]=[[side*44,lower,-731],[side*44,lower,-751],[side*62,upperRoof,-751],[side*62,upperRoof,-722],[side*45,upperRoof,-722]];
 mallWalkway(add,'Arcade / '+(side<0?'west':'east')+' upper terrace stair',roof,5);
 MAYFIELD_EXPLORATION_LINES.push({name:'Arcade '+(side<0?'west':'east')+' terraces',points:[[0,main,-733],[0,main,-743],...terrace,[side*33,lower,-724],[side*44,lower,-724],...roof]});
}
sign('SIDE QUEST ARCADE',554,arcadeY+12.5,31,palette.teal);
export const MAYFIELD_BONUS_ENTRY=transformPoint([214,mallSupport(214,-865,60),-865],arcade);
export const MAYFIELD_BONUS_RETURN=transformPoint([221,mallSupport(221,-869,60)+.1,-869],arcade);
add({t:'bonusplatform',p:MAYFIELD_BONUS_ENTRY,to:MAYFIELD_BONUS_RETURN,nm:'After Hours / arcade bonus entrance'});
sign('AFTER HOURS BONUS',-MAYFIELD_BONUS_ENTRY[2],MAYFIELD_BONUS_ENTRY[1]+5.4,12,palette.purple,MAYFIELD_BONUS_ENTRY[0]+5.6);


section(803,'04 · Warehouse source roll-ins, halfpipe, banks and industrial shell');
const warehouseFloor=arcadeY-10.8675;
const roll:SourceTransform={pivot:[-5.355,9.45,24.36],target:[0,arcadeY,-765],scale:[2.05,1.15,1.15]};
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.nm?.startsWith('Left smooth roll-in')===true,roll,'Warehouse / original eased roll-in');
const rollEnd=transformPoint([-5.355,0,-4.41],roll);
const rollPath=[transformPoint([-5.355,9.45,24.36],roll),transformPoint([-5.355,4.725,9.975],roll),rollEnd];
const arcadeExit=mallApron('Arcade / fitted loading landing',arcade,988,-1,193,280,40.1,237,mallSupport(237,-988,40.1),24);
join(arcadeExit,rollPath[0],20,'Arcade to loading roll-in');route([arcadeExit,...rollPath]);
floor(760,924,warehouseFloor,96,'#aaa99d');
for(const side of[-1,1])mallGuardPath(add,'Loading roll-in edge',Array.from({length:17},(_,i)=>{const t=i/16;return[side*10.978,arcadeY-10.8675*t*t*(3-2*t),-765-33.0855*t] as P;}));
const half:SourceTransform={pivot:[0,0,-28.35],target:[0,warehouseFloor,-830],scale:[1.05,1.05,1.05],yaw:90};
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===501,half,'Warehouse / original halfpipe and suspended room');
const halfPath=[[0,0,-28.35],[20,0,-28.35],[41.37,0,-28.35]].map(p=>transformPoint(p as P,half));
route([[0,warehouseFloor,-812],...halfPath,[0,warehouseFloor,-908]]);cp([0,warehouseFloor,-814],'Warehouse roll-in');
// Actual kicker pair, Big Rail and taxi swap sides and separate into new lines.
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===503,{pivot:[-12.6,0,-16.17],target:[29,warehouseFloor,-802],scale:[1,1,1],yaw:18},'Warehouse / rearranged kicker and Big Rail');
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.nm?.startsWith('Taxi')===true,{pivot:[14.8,0,-56.1],target:[-32,warehouseFloor,-883],scale:[1.2,1.2,1.2],yaw:48},'Warehouse / relocated taxi');
const shell:SourceTransform={pivot:[0,0,-15],target:[0,warehouseFloor,-838],scale:[1.15,1.15,1.15]};
const warehouseShell=reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===506||(c.grp===504&&c.nm?.includes('Weathered warehouse wall bay')===true),shell,'Warehouse / roof and original wall bays');
// Fit the retained wall bays to the loading floor. Open generous headers at
// the entry, exit and side alcoves; opaque panels no longer hang across routes.
for(const c of warehouseShell)if(c.nm?.includes('Weathered warehouse wall bay')&&c.vertices){
 const v=c.vertices,xs=v.filter((_,i)=>i%3===0),zs=v.filter((_,i)=>i%3===2),ys=v.filter((_,i)=>i%3===1);
 const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,bottom=Math.min(...ys);
 const entry=z>-763,exit=z<-911&&Math.min(...xs)<18&&Math.max(...xs)>-13;
 const sideDoor=(Math.abs(x-23.081)<.1&&z>-822&&z<-790)||Math.abs(z+821.337)<.1||Math.abs(z+900.1)<.1;
 const base=entry?arcadeY+5:exit||sideDoor?warehouseFloor+11:warehouseFloor;
 for(let i=1;i<v.length;i+=3)if(Math.abs(v[i]-bottom)<.01)v[i]=base;
 c.solid=true;c.solidSides=true;c.doubleSided=true;
 for(const i of[0,1]){const px=i?Math.max(...xs):Math.min(...xs),pz=i?Math.max(...zs):Math.min(...zs);box('Loading wall / structural upright',[px,(warehouseFloor+83.93)/2,pz],[.3,83.93-warehouseFloor,.3],'#71583b');}
}

for(const x of[-49,49])wall('Warehouse side contact',x,760,925,warehouseFloor,30,'#a8a295');
// Move complete warehouse source box stacks into two loading islands.
for(const x of[-30,30])reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.t==='crate'&&c.nm==='Source Box 1',{pivot:[-25,0,-70],target:[x,warehouseFloor,-902],scale:[1,1,1]},'Warehouse / box stack');
const roomFloor=warehouseFloor+10.00125,roomRoof=warehouseFloor+17.388;
const roomAccess:P[]=[[28,warehouseFloor,-825],[28,roomFloor,-851],[28,roomFloor,-867.5],[-28,roomFloor,-867.5],[-28,warehouseFloor,-911]];
mallWalkway(add,'Loading / suspended office access',roomAccess,6);
for(const x of[-28,28])slab('Office access / steel support',x,867.5,roomFloor-.65,1,1,roomFloor-warehouseFloor-.65,palette.ink);
MAYFIELD_EXPLORATION_LINES.push({name:'Warehouse suspended office and west return',points:[[0,warehouseFloor,-812],[16,warehouseFloor,-808],[16,warehouseFloor,-795],[35,warehouseFloor,-795],[35,warehouseFloor,-820],[28,warehouseFloor,-820],...roomAccess,[0,warehouseFloor,-916]]});
// Roof access starts beyond the west end of the room bridge, keeping its
// bank-to-bank opening clear. The source office remains a complete building.
const roomRoofAccess:P[]=[[-39,warehouseFloor,-920],[-43,warehouseFloor,-920],[-43,roomRoof,-861],[-14,roomRoof,-861],[-14,roomRoof,-867.5],[0,roomRoof,-867.5]];
mallWalkway(add,'Loading / office roof service stairs',roomRoofAccess,4);
MAYFIELD_EXPLORATION_LINES.push({name:'Warehouse office roof',points:[[0,warehouseFloor,-916],[-35,warehouseFloor,-920],...roomRoofAccess]});
sign('MAYFIELD LOADING',745,arcadeY+11.5,30,palette.purple);

section(804,'05 · Kona original spinal grooves, timber vert and snake run');
const grooves:SourceTransform={pivot:[-1.43325,.000111,94],target:[0,warehouseFloor,-950],scale:[1,1,1],yaw:180};
reuse('kona',KONA_LEVEL,c=>c.grp===131,grooves,'Kona / complete spinal grooves');
const groovePath=[94,99,110,124,133].map(z=>transformPoint([-1.43325,konaSupport(-1.43325,z,6,130),z],grooves));
// Source endpoints outside the flat floor are joined at their actual elevation.
for(const p of groovePath)if(!Number.isFinite(p[1]))p[1]=warehouseFloor;
join([0,warehouseFloor,-924],groovePath[0],11,'Loading to Kona');route(groovePath);cp(groovePath[2],'Kona spinal grooves');
slab('Kona / groove entrance landing',0,953,warehouseFloor,14,12,1.2,palette.tile);
const timber:SourceTransform={pivot:[-40.27775,0,111.75],target:[-75,warehouseFloor,-969],scale:[1.05,1.05,1.05],yaw:180};
reuse('kona',KONA_LEVEL,c=>c.grp===89,timber,'Kona / complete timber vert and roll-in');
const snakeStart=KONA_SNAKE.points[0],snake:SourceTransform={pivot:snakeStart,target:[0,warehouseFloor,-1080],scale:[.95,.95,.95],yaw:-90};
const snakeParts=reuse('kona',KONA_LEVEL,c=>c.grp===34,snake,'Kona / original snake run');
slab('Kona garden terrace foundation',-35,1100,warehouseFloor-.6,150,240,warehouseFloor+.4,'#9eae9a');
const snakePath=KONA_SNAKE.points.filter((_,i)=>i%12===0||i===KONA_SNAKE.points.length-1).map(p=>transformPoint(p,snake));
const snakeToe:P=[0,warehouseFloor,-1023],snakeHead:P=[0,64.291618,-1040];
join(groovePath[groovePath.length-1],snakeToe,11,'Kona court / snake approach',false);
join(snakeToe,snakeHead,11,'Kona / raised snake entrance');
mallWalkway(add,'Kona / snake head landing',[snakeHead,[0,64.291618,-1049]],11);
slab('Kona / connected circulation plaza',-35,1010,warehouseFloor,150,44,1.2,palette.tile);
// Enter the retained snake through its raised head deck, then ride its actual
// sloping floor. The snake no longer overlaps the neighbouring mini-pipe decks.
const snakeHeadRoute:P[]=[snakeToe,snakeHead,[0,64.291618,-1047],[0,64.291618,-1053],[0,64.13186156,-1057],[0,62.78554054,-1061],[0,61.38158505,-1065],[0,59.92046298,-1069],[0,58.66695882,-1073],[0,58.31163954,-1077]];
route([...snakeHeadRoute,...snakePath]);cp(snakePath[11],'Kona snake bends');
reuse('kona',KONA_LEVEL,c=>c.grp===25,{pivot:[41.77,6.06,6.845],target:[21,warehouseFloor,-1002],scale:[1.2,1.2,1.2],yaw:35},'Kona / snake kiosk');
slab('Kona junction / kiosk court',10,1002,warehouseFloor,44,22,.8,palette.cream);

// The full Kona assembly has three separated coping decks and a second
// large timber pipe. Connect them from a common, supported return court.
slab('Kona / timber approach apron',-91,998,warehouseFloor,30,24,1.2,palette.tile);
mallWalkway(add,'Kona / timber pipe entrance',[[-75,warehouseFloor,-996],[-75,warehouseFloor,-977]],10,false);
MAYFIELD_EXPLORATION_LINES.push({name:'Kona timber floor',points:[[0,warehouseFloor,-1004],[0,warehouseFloor,-1005],[-75,warehouseFloor,-1005],[-75,warehouseFloor,-996],[-75,warehouseFloor,-977],[-75,warehouseFloor,-965]]});
const timberLeftY=warehouseFloor+8.4,timberRightY=warehouseFloor+8.00322;
const timberLeft:P[]=[[-101,warehouseFloor,-1000],[-101,timberLeftY,-969],[-91.5,timberLeftY,-969]];
const timberRight:P[]=[[-57,warehouseFloor,-1000],[-57,timberRightY,-987],[-57,timberRightY,-977]];
mallWalkway(add,'Kona / west timber deck stair',timberLeft,4);
mallWalkway(add,'Kona / roll-in deck stair',timberRight,4);
MAYFIELD_EXPLORATION_LINES.push(
 {name:'Kona west timber deck',points:[[0,warehouseFloor,-1004],[0,warehouseFloor,-1005],[-101,warehouseFloor,-1005],...timberLeft]},
 {name:'Kona timber roll-in deck',points:[[0,warehouseFloor,-1004],[0,warehouseFloor,-1005],[-57,warehouseFloor,-1005],...timberRight]},
);
for(const x of[-35,-10,11]){
 // Enter at the end of each deck, leaving its central vert landing clear.
 const top=warehouseFloor+2.78875,access:P[]=[[x,warehouseFloor,-999],[x,top+1,-993],[x,top+1,-979],[x,top,-976]];
 mallWalkway(add,'Kona / spinal deck access '+x,access,3);
 MAYFIELD_EXPLORATION_LINES.push({name:'Kona spinal deck '+x,points:[[0,warehouseFloor,-1004],[0,warehouseFloor,-1005],[x,warehouseFloor,-1005],...access,[x,top,-970]]});
}
mallWalkway(add,'Kona / garden return bank',[[-101,warehouseFloor-.6,-1038],[-101,warehouseFloor,-1033],[-101,warehouseFloor,-1028]],10,false);
MAYFIELD_EXPLORATION_LINES.push({name:'Kona lower garden recovery',points:[[-101,warehouseFloor-.6,-1090],[-101,warehouseFloor-.6,-1038],[-101,warehouseFloor,-1033],[-101,warehouseFloor,-1028],[-101,warehouseFloor,-1005],[-42,warehouseFloor,-1005],[0,warehouseFloor,-1005],[0,warehouseFloor,-1004]]});
section(805,'06 · Original Mall angled atrium, hanging bridge and great descent');
const atrium:SourceTransform={pivot:[7.55,92.443,-485],target:[-2.4,snakePath[snakePath.length-1][1],-1260],scale:[.95,.95,.95],yaw:15};
const atriumWithDoor=sourceDoorway(MALL_LEVEL,[-105,120.8,-492],[-95,128.8,-490]);
const atriumParts=reuse('mall',atriumWithDoor,c=>c.breakable!=='sign',atrium,'Mall / angled atrium and suspended crossing',[485,790]);
const atriumSource=[...sourceMain.map(([x,z])=>mallPoint(x,0,z)).filter(p=>-p[2]>=485&&-p[2]<700),[245,0,-700] as P,[242,0,-735] as P];
const atriumPath=[transformPoint([7.55,mallSupport(7.55,-485,94),-485],atrium),...atriumSource.map(p=>transformPoint([p[0],mallSupport(p[0],p[2],94),p[2]],atrium)),transformPoint([221,mallSupport(221,-790,60),-790],atrium)];
const atriumEntry=mallApron('Atrium / fitted entry landing',atrium,485,1,-54,32,94,7.55,mallSupport(7.55,-485,94),38);
join(snakePath[snakePath.length-1],atriumEntry,24,'Snake to grand atrium');route([atriumEntry,...atriumPath]);cp(atriumPath[2],'Angled atrium');cp(atriumPath[12],'Suspended crossing');
// A side stair also reaches the original atrium's large upper floor. The
// route begins inside the new entry apron and goes around the existing wall.
const atriumUpperSource:P[]=[[-35,93,-480],[-100,121.85,-480],[-100,121.85,-502],[-100,121.15,-520]];
const atriumUpper=atriumUpperSource.map(p=>transformPoint(p,atrium));
mallWalkway(add,'Grand atrium / upper gallery stair',atriumUpper,7);
for(const x of[-105,-95])box('Upper gallery doorway jamb',transformPoint([x,125,-490.8],atrium),[.5,7.6,.6],palette.teal,15);
box('Upper gallery doorway lintel',transformPoint([-100,128.8,-490.8],atrium),[10,.5,.6],palette.teal,15);
MAYFIELD_EXPLORATION_LINES.push({name:'Grand atrium upper gallery',points:[atriumPath[0],transformPoint([-25,93,-480],atrium),...atriumUpper,transformPoint([-90,121.15,-550],atrium),transformPoint([-60,121.15,-570],atrium),transformPoint([-30,121.15,-570],atrium)]});
const end=atriumPath[atriumPath.length-1],exit:P=[end[0]-20,end[1],end[2]-45];
const atriumExit=mallApron('Atrium / fitted exit landing',atrium,790,-1,198,273,40.1,221,mallSupport(221,-790,40.1),180);
// One continuous tapered court replaces the overlapping bridge and finish slab.
// Its front edge follows the rotated Mall cut; its far edge holds the exit pad.
const finishFront=[198,273].map(x=>transformPoint([x,mallSupport(221,-790,40.1),-802],atrium));
const finishBack:P[]=[[exit[0]-24,exit[1],exit[2]-15],[exit[0]+24,exit[1],exit[2]-15]];
mallLanding(add,'Mayfield / complete finish court',finishFront,finishBack);
for(const [a,b]of[[finishFront[0],finishBack[0]],[finishFront[1],finishBack[1]],[finishBack[0],finishBack[1]]])mallGuard(add,'Finish court perimeter',a,b);
MAYFIELD_JOINS.push({name:'Atrium to finish court',points:[atriumExit,exit],width:28});route([atriumExit,exit]);
add({t:'crystal',p:[exit[0]+3,exit[1]+1,exit[2]+10],nm:'Mayfield crystal'});
add({t:'gate',p:exit,yaw:24,nm:'Mayfield Mall exit'});

skirt(snakeParts,warehouseFloor-.6,[[snakeToe,snakeHead],[snakePath[snakePath.length-1],atriumPath[0]]]);
foundation(parkingParts,'Mall parking garage foundation');foundation(upperParts,'Mall galleria foundation');foundation(arcadeParts,'Mall arcade foundation');foundation(atriumParts,'Mall atrium foundation');
slab('Loading hall structural foundation',0,840,warehouseFloor-1,98,180,warehouseFloor,'#9d9d92');
slab('Kona pipe court foundation',-38,970,warehouseFloor-.7,140,52,warehouseFloor+.3,'#aaa98f');
slab('Kona return court',-40,996,warehouseFloor,110,23,.8,palette.tile);
section(806,'Mayfield flow, source-scale signs and recovery');
for(const p of MAYFIELD_ROUTE)add({t:'camnode',p:[...p],radius:5,nm:'Mayfield ordered corridor'});
// Mark the remixed forward route with ordinary collectibles, preserving normal inputs.
for(let i=2;i<MAYFIELD_ROUTE.length-1;i+=3){const p=MAYFIELD_ROUTE[i];fruit(-p[2],p[0],p[1]);}
add({t:'pit',p:[0,-22,-800],s:[650,1,2300],invisible:true,nm:'Mayfield below-course recovery'});
for(const b of paint.values())C.push({t:'mesh',nm:'Mayfield signs and connective trim',p:[0,0,0],vertices:b.vertices,indices:b.indices,solid:false,edgeGrinding:false,color:b.color,tex:'solid',grp:b.grp});
export const MAYFIELD_VERT_TESTS=[
 {name:'Warehouse source halfpipe',p:transformPoint([20,0,-28.35],half)},
 {name:'Kona source spinal grooves',p:transformPoint([-1.43325,.000111,118],grooves)},
 {name:'Kona source timber vert',p:[-75,warehouseFloor+.00011655,-969] as P},
];
export const MAYFIELD_LENGTH=MAYFIELD_ROUTE.reduce((n,p,i)=>i?n+Math.hypot(p[0]-MAYFIELD_ROUTE[i-1][0],p[2]-MAYFIELD_ROUTE[i-1][2]):0,0);
export const MAYFIELD_MALL_LEVEL:CustomLevelData={
  v:1,name:'Mayfield Mall',spawn:[parkingStart[0],parkingStart[1]+.12,parkingStart[2]+1],killY:-26,startWarpPad:false,
  skatepark:false,alwaysSkate:false,sky:'day',keepPlayFog:true,jungleDepthFade:false,
  cameraRig:{camDist:10,camHeight:5,camPitch:18,camFov:68},cameraLookAhead:5,
  relicTime:100,medalTimes:{gold:100,silver:150,bronze:240},
  atmosphere:{fogEnabled:true,fogNear:100,fogFar:340,fogColor:'#c4d6da',drawDistance:440,
    ambientSky:'#fff1dc',ambientGround:'#869296',ambientIntensity:1.5,sunColor:'#fff0ce',sunIntensity:1.4,fillColor:'#b9dce2',fillIntensity:.6,shadowStrength:.4,backdrop:'fog'},
  components:C,groups,
};
