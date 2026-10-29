import { BoxGeometry, ShapeGeometry } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { MALL_LEVEL, mallPoint, mallSupport } from './mall';
import { SCHOOL_MIAMI_LEVEL, SCHOOL_TABLES } from './school-miami';
import { KONA_LEVEL, KONA_SNAKE, konaSupport } from './kona';
import { WAREHOUSE_REFERENCE_LEVEL } from './codex-lab';
import { sourceAssembly, transformPoint, type SourceTransform } from './mayfield-source';

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
  const bounds=geo.boundingBox!;const span=bounds.max.x-bounds.min.x,scale=Math.min(1,width/span);
  geo.scale(scale,scale,1);geo.translate(-(bounds.min.x+bounds.max.x)/2*scale,0,0);
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
function rail(nm:string,points:P[],color=palette.teal) {const p=points[0];return add({t:'rail',nm,p:[...p],pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),color});}
function fruit(s:number,x=0,y=0){add({t:'wumpa',p:[x,y+1,-s]});}
function crate(s:number,x=0,y=0,kind:CustomComponent['kind']='wood'){add({t:'crate',p:[x,y,-s],kind});}
export const MAYFIELD_ROUTE:P[]=[];
export const MAYFIELD_CHECKPOINTS:{s:number;y:number;x:number;name:string}[]=[];
export const MAYFIELD_GAPS:{a:number;b:number;y:number;w:number}[]=[];
export const MAYFIELD_SOURCE_PROVENANCE:{source:string;assembly:string;components:number;triangles:number;solid:number;transform:SourceTransform;cut?:[number,number]}[]=[];
function reuse(source:string,level:CustomLevelData,pick:(c:CustomComponent)=>boolean,t:SourceTransform,label:string,cut?:[number,number]) {
  const parts=sourceAssembly(level,pick,t,label,group,cut);C.push(...parts);
  MAYFIELD_SOURCE_PROVENANCE.push({source,assembly:label,components:parts.length,triangles:parts.reduce((n,c)=>n+(c.indices?.length??0)/3,0),solid:parts.filter(c=>c.solid!==false&&['mesh','platform','ramp','vertramp'].includes(c.t)).length,transform:t,cut});return parts;
}
function route(points:P[]){MAYFIELD_ROUTE.push(...points);}
function cp(p:P,name:string){MAYFIELD_CHECKPOINTS.push({s:-p[2],y:p[1],x:p[0],name});add({t:'checkpoint',p,nm:name});}
function join(a:P,b:P,width=24,nm='Mayfield connecting concourse'){
  const dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz),nx=-dz/d*width/2,nz=dx/d*width/2;
  const vertices=[a[0]-nx,a[1],a[2]-nz,a[0]+nx,a[1],a[2]+nz,b[0]-nx,b[1],b[2]-nz,b[0]+nx,b[1],b[2]+nz];
  const bottom=vertices.map((v,i)=>v-(i%3===1?1.2:0));vertices.push(...bottom);
  add({t:'mesh',nm,p:[0,0,0],vertices,indices:[0,3,2,0,1,3,4,6,7,4,7,5,0,2,6,0,6,4,1,5,7,1,7,3],color:palette.tile,tex:'pavement',doubleSided:true,solid:true,solidSides:true});
  for(let t=.35;t<1;t+=.35){const y=a[1]+(b[1]-a[1])*t;if(y>3)slab('Concourse support pier',a[0]+dx*t,-a[2]-dz*t,y-1.2,4,4,y-.2,palette.cream);}
  // Real side kerbs make the reconfigured portals legible without blocking travel.
  for(const side of[-1,1])rail('Concourse outside handrail',[[a[0]+side*nx,a[1]+.7,a[2]+side*nz],[b[0]+side*nx,b[1]+.7,b[2]+side*nz]]);
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
  if(portals.some(([u,v])=>{const dx=v[0]-u[0],dz=v[2]-u[2],t=Math.max(0,Math.min(1,((mid[0]-u[0])*dx+(mid[2]-u[2])*dz)/(dx*dx+dz*dz)));return Math.hypot(mid[0]-u[0]-dx*t,mid[2]-u[2]-dz*t)<8;}))continue;const i=vertices.length/3;vertices.push(...a,...b,b[0],bottom,b[2],a[0],bottom,a[2]);indices.push(i,i+1,i+2,i,i+2,i+3);if(vertices.length>11000)flush();}flush();
}
function mallRoute(t:SourceTransform,points:[number,number][],ceiling:number){return points.map(([x,s])=>transformPoint([x,mallSupport(x,-s,ceiling),-s],t));}
const sourceMain=[[-13100,760],[-10800,780],[-10000,1000],[-7700,1000],[-6850,900],[-6550,870],[-6250,660],[-5500,550],[-4000,550],[-3500,480],[-3100,525],[-2700,700],[-2300,925],[-1900,1300],[-1500,1500],[-1100,1900],[-900,2300],[-1000,2900],[-1300,3000],[-1600,3350],[-1600,4300],[-1750,4900],[-1700,5450],[-1500,5800],[-1200,6050],[-500,6180],[-100,6100],[300,6000],[1800,5800],[3500,5800],[5400,5800],[6500,5800],[7600,5800]];

section(800,'01 · Original Mall upper galleria, fountain and escalators');
const upper:SourceTransform={pivot:[15,118.786,-80],target:[0,100,0],scale:[.96,1,.92]};
const upperParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign',upper,'Mall upper galleria',[60,465]);
const upperPath=mallRoute(upper,[[15,80],[15,100],[15,180],[28,232],[28,300],[16,350],[15.2,361],[5.75,374.56],[.8,408],[.8,465]],120);
route(upperPath);sign('MAYFIELD MALL',18,113,28);cp(upperPath[2],'Galleria escalators');cp(upperPath[6],'Fountain gallery');
// Full-size source directories now stand on the ground-floor route rather than
// their original upper balconies. Their bodies have fitted ordinary contact.
for(const [x,station,yaw]of [[28,72,-12],[-28,190,18]]){
 reuse('mall',MALL_LEVEL,c=>c.breakable==='sign'&&c.breakGroup===33,{pivot:[-15.99,136.87,-133.22],target:[x,100,-station],scale:[1,1,1],yaw},'Mall / relocated directory');
 add({t:'wall',nm:'Directory fitted body',p:[x,100,-station],s:[10.4,7.12,.35],yaw,invisible:true});
}
add({t:'clock',p:[-5,100,-8],nm:'Mayfield time trial'});
for(const [i,p]of upperPath.entries())if(i>0&&i<upperPath.length-1){fruit(-p[2],p[0],p[1]);if(i%2===0)crate(-p[2]+6,p[0]+4,p[1]);}

const gymY=upperPath[upperPath.length-1][1],arcadeY=gymY-10.5;
section(801,'02 · School Miami gym, banks and downhill courtyard');
const gym:SourceTransform={pivot:[97,0,29],target:[0,gymY,-385],scale:[.9,.9,.9],yaw:180};
// Keep the complete gym: roof/skylight, basketball floor, two banks, full rails,
// hoop quarter and architectural skin. Open a second door in the south wall.
const schoolGym:CustomLevelData={...SCHOOL_MIAMI_LEVEL,components:SCHOOL_MIAMI_LEVEL.components.flatMap(c=>{
 if(c.nm!=='Gym south wall')return[c];
 return [[45.2,75],[119,149]].map(([a,b])=>({...c,p:[(a+b)/2,c.p[1],c.p[2]] as P,s:[b-a,c.s![1],c.s![2]] as P}));
})};
reuse('school-miami',schoolGym,c=>c.grp===8,gym,'School Miami / complete gym');
const gymPath=[[97,0,29],[97,0,39],[79,0,58],[79,0,82],[80,0,98]].map(p=>transformPoint(p as P,gym));
join(upperPath[upperPath.length-1],gymPath[0],40);route(gymPath);
slab('Gym supported maple subfloor',0,416.1,gymY,94,64,.8,'#b8a47e');cp(gymPath[2],'Food court gym');
const downhill:SourceTransform={pivot:[84,0,-10],target:[15.3,gymY,-459],scale:[1.05,1.05,1.05]};
reuse('school-miami',SCHOOL_MIAMI_LEVEL,c=>c.nm?.startsWith('Handicap')===true||c.nm?.startsWith('Long blue canopy')===true,downhill,'School Miami / downhill canopy');
const hillPath=[[84,0,-10],[82,-1,-25],[79,-5,-42],[76,-9,-60],[74,-10,-74]].map(p=>transformPoint(p as P,downhill));
join(gymPath[gymPath.length-1],hillPath[0],28);route(hillPath);
// Rearranged full-size table-and-bench clusters occupy the new gym approaches.
for(const [i,table]of SCHOOL_TABLES.slice(0,4).entries()){
 const pivot=table.p.map(n=>n*2) as P;
 reuse('school-miami',SCHOOL_MIAMI_LEVEL,c=>c.nm?.startsWith(table.name)===true,{pivot,target:[i%2?-23:25,gymY,-362-Math.floor(i/2)*10],scale:[1,1,1],yaw:i%2?25:-20},'School table and rail cluster');
}
sign('FOOD + FRIENDS',371,gymY+11,29,palette.pink);

section(802,'03 · Original Mall crossrail arcade / reordered architectural bay');
const arcade:SourceTransform={pivot:[237,38.583,-790],target:[0,arcadeY,-548],scale:[1.08,1,.95]};
const arcadeParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign',arcade,'Mall crossrail arcade',[790,988]);
const arcadePath=mallRoute(arcade,[[221,790],[221,815],[221,850],[221,875],[237,910],[237,950],[237,988]],60);
join(hillPath[hillPath.length-1],arcadePath[0],30);route(arcadePath);cp(arcadePath[2],'Crossrail arcade');
sign('SIDE QUEST ARCADE',554,arcadeY+12.5,31,palette.teal);

section(803,'04 · Warehouse source roll-ins, halfpipe, banks and industrial shell');
const warehouseFloor=arcadeY-10.8675;
const roll:SourceTransform={pivot:[-5.355,9.45,24.36],target:[0,arcadeY,-765],scale:[1.15,1.15,1.15]};
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.nm?.startsWith('Left smooth roll-in')===true,roll,'Warehouse / original eased roll-in');
const rollEnd=transformPoint([-5.355,0,-4.41],roll);
const rollPath=[transformPoint([-5.355,9.45,24.36],roll),transformPoint([-5.355,4.725,9.975],roll),rollEnd];
join(arcadePath[arcadePath.length-1],rollPath[0],24);route(rollPath);
floor(796,924,warehouseFloor,96,'#aaa99d');
const half:SourceTransform={pivot:[0,0,-28.35],target:[0,warehouseFloor,-830],scale:[1.05,1.05,1.05],yaw:90};
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===501,half,'Warehouse / original halfpipe and suspended room');
const halfPath=[[0,0,-28.35],[20,0,-28.35],[41.37,0,-28.35]].map(p=>transformPoint(p as P,half));
route([[0,warehouseFloor,-812],...halfPath,[0,warehouseFloor,-908]]);cp([0,warehouseFloor,-814],'Warehouse roll-in');
// Actual kicker pair, Big Rail and taxi swap sides and separate into new lines.
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===503,{pivot:[-12.6,0,-16.17],target:[29,warehouseFloor,-802],scale:[1,1,1],yaw:18},'Warehouse / rearranged kicker and Big Rail');
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.nm?.startsWith('Taxi')===true,{pivot:[14.8,0,-56.1],target:[-32,warehouseFloor,-883],scale:[1.2,1.2,1.2],yaw:48},'Warehouse / relocated taxi');
const shell:SourceTransform={pivot:[0,0,-15],target:[0,warehouseFloor,-838],scale:[1.15,1.15,1.15]};
reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.grp===506||(c.grp===504&&c.nm?.includes('Weathered warehouse wall bay')===true),shell,'Warehouse / roof and original wall bays');
for(const x of[-49,49])wall('Warehouse side contact',x,760,925,warehouseFloor,30,'#a8a295');
// Move complete warehouse source box stacks into two loading islands.
for(const x of[-30,30])reuse('warehouse-reference',WAREHOUSE_REFERENCE_LEVEL,c=>c.t==='crate'&&c.nm==='Source Box 1',{pivot:[-25,0,-70],target:[x,warehouseFloor,-902],scale:[1,1,1]},'Warehouse / box stack');
sign('MAYFIELD LOADING',745,arcadeY+11.5,30,palette.purple);

section(804,'05 · Kona original spinal grooves, timber vert and snake run');
const grooves:SourceTransform={pivot:[-1.43325,.000111,94],target:[0,warehouseFloor,-950],scale:[1,1,1],yaw:180};
reuse('kona',KONA_LEVEL,c=>c.grp===131,grooves,'Kona / complete spinal grooves');
const groovePath=[94,99,110,124,133].map(z=>transformPoint([-1.43325,konaSupport(-1.43325,z,6,130),z],grooves));
// Source endpoints outside the flat floor are joined at their actual elevation.
for(const p of groovePath)if(!Number.isFinite(p[1]))p[1]=warehouseFloor;
join([0,warehouseFloor,-924],groovePath[1],11);route(groovePath);cp(groovePath[2],'Kona spinal grooves');
reuse('kona',KONA_LEVEL,c=>c.grp===89,{pivot:[-40.27775,0,111.75],target:[-75,warehouseFloor,-969],scale:[1.05,1.05,1.05],yaw:180},'Kona / complete timber vert and roll-in');
const snakeStart=KONA_SNAKE.points[0],snake:SourceTransform={pivot:snakeStart,target:[0,warehouseFloor,-1020],scale:[.95,.95,.95],yaw:-90};
const snakeParts=reuse('kona',KONA_LEVEL,c=>c.grp===34,snake,'Kona / original snake run');
slab('Kona garden terrace foundation',-35,1070,warehouseFloor-2.5,150,180,warehouseFloor-1.5,'#9eae9a');
const snakePath=KONA_SNAKE.points.filter((_,i)=>i%12===0||i===KONA_SNAKE.points.length-1).map(p=>transformPoint(p,snake));
join(groovePath[groovePath.length-2],snakePath[0],11);route(snakePath);cp(snakePath[11],'Kona snake bends');
reuse('kona',KONA_LEVEL,c=>c.grp===25,{pivot:[41.77,6.06,6.845],target:[21,warehouseFloor,-1002],scale:[1.2,1.2,1.2],yaw:35},'Kona / snake kiosk');
slab('Kona junction / kiosk court',10,1002,warehouseFloor,44,22,.8,palette.cream);

section(805,'06 · Original Mall angled atrium, hanging bridge and great descent');
const atrium:SourceTransform={pivot:[7.55,92.443,-485],target:[-2.4,snakePath[snakePath.length-1][1],-1200],scale:[.95,.95,.95],yaw:15};
const atriumParts=reuse('mall',MALL_LEVEL,c=>c.breakable!=='sign',atrium,'Mall / angled atrium and suspended crossing',[485,790]);
const atriumSource=sourceMain.map(([x,z])=>mallPoint(x,0,z)).filter(p=>-p[2]>=485&&-p[2]<=790).map(p=>-p[2]>700?[221,p[1],p[2]] as P:p);
const atriumPath=[transformPoint([7.55,mallSupport(7.55,-485,94),-485],atrium),...atriumSource.map(p=>transformPoint([p[0],mallSupport(p[0],p[2],94),p[2]],atrium)),transformPoint([221,mallSupport(221,-790,60),-790],atrium)];
join(snakePath[snakePath.length-1],atriumPath[0],26);route(atriumPath);cp(atriumPath[2],'Angled atrium');cp(atriumPath[12],'Suspended crossing');
const end=atriumPath[atriumPath.length-1],exit:P=[end[0]-20,end[1],end[2]-45];
join(end,exit,30);route([exit]);
add({t:'crystal',p:[exit[0]+3,exit[1]+1,exit[2]+10],nm:'Mayfield crystal'});
add({t:'gate',p:exit,yaw:24,nm:'Mayfield Mall exit'});

skirt(snakeParts,warehouseFloor-2.5,[[groovePath[groovePath.length-2],snakePath[0]],[snakePath[snakePath.length-1],atriumPath[0]]]);
foundation(upperParts,'Mall galleria foundation');foundation(arcadeParts,'Mall arcade foundation');foundation(atriumParts,'Mall atrium foundation');
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
  v:1,name:'Mayfield Mall',spawn:[upperPath[0][0],upperPath[0][1]+.12,upperPath[0][2]+1],killY:-26,startWarpPad:false,
  skatepark:false,alwaysSkate:false,sky:'day',keepPlayFog:true,jungleDepthFade:false,
  cameraRig:{camDist:10,camHeight:5,camPitch:18,camFov:68},cameraLookAhead:5,
  relicTime:100,medalTimes:{gold:100,silver:150,bronze:240},
  atmosphere:{fogEnabled:true,fogNear:100,fogFar:340,fogColor:'#c4d6da',drawDistance:440,
    ambientSky:'#fff1dc',ambientGround:'#869296',ambientIntensity:1.5,sunColor:'#fff0ce',sunIntensity:1.4,fillColor:'#b9dce2',fillIntensity:.6,shadowStrength:.4,backdrop:'fog'},
  components:C,groups,
};
