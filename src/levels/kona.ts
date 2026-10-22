import { CatmullRomCurve3, Vector3 } from 'three';
import survey from './kona-survey.json';
import type { CustomComponent, CustomLevelData } from '../level';

type P=[number,number,number];
const C:CustomComponent[]=[];
// The first survey pass was half-sized beside the live character. Double the
// whole park uniformly: mini transitions are now 2.789 m, not 1.394 m.
// Keep the skater and movement tuning intact.
export const KONA_SCALE=.025;
export const konaPoint=(x:number,y:number,z:number):P=>[-z*KONA_SCALE-35,(y+448.44444)*KONA_SCALE,x*KONA_SCALE-15];
const colors={concrete:'#a5b2a9',blue:'#7da5af',red:'#ac5c61',cream:'#c2c9b4',wood:'#b18e52',grass:'#35573b',roof:'#353a42',rail:'#9c5046'};
const names:Record<number,string>={12:'Clover pool',16:'Freestyle basin',23:'Tombstone',33:'Snake run',76:'Lower kidney / J-run',78:'Street / long boundary quarter',88:'Over the roll-in / timber vert',130:'Spinal grooves',144:'Freestyle / banana',57:'Street / north kicker',117:'Street / south catcher',29:'Street / stair bank',24:'Snake head kiosk',15:'North kiosk'};
const curved=new Set([12,16,23,33,76,78,88,130,144,29]);
const vert=new Set([12,16,23,76,78,88,130,29]);
const grass=new Set([2,65,70,102,106,127,132]);
const roofs=new Set([61,63,69,74,87,126,155,158]);
const railsOnly=new Set([5,25,27,37,50,79,81,85,92,96,100,118,120,142,146,147,151,161,164]);
const poles=new Set([10,13,17,26,66,68,71,90,91,104,162]);
const add=(c:CustomComponent)=>{C.push(c);return c;};
const position=(v:number[],i:number)=>new Vector3(v[i*3],v[i*3+1],v[i*3+2]);
const triangles:{a:P;b:P;c:P;id:number}[]=[];
// The survey's floor owns its actual grades. No broad foundation underneath
// the bowls, and no overlay following a different approximation of the slope.
export function konaSupport(x:number,z:number,ceiling=100,only?:number):number {
 let y=-Infinity;
 for(const t of triangles){if(only!==undefined&&t.id!==only)continue;const {a,b,c}=t,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(d)<1e-7)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
  if(u<-.00001||v<-.00001||u+v>1.00001)continue;const h=u*a[1]+v*b[1]+(1-u-v)*c[1];if(h<ceiling&&h>y)y=h;
 }return y;
}
export const KONA_PROJECTION={origin:[570,390],x:[5,-2.4],z:[3.7,3.243243243],y:4.733};
export function konaMapPoint(u:number,v:number,height?:number):P {
 let y=(height??4)/2,x=0,z=0;for(let i=0;i<(height===undefined?8:1);i++){const a=u-570,b=v-390+4.733*y,d=5*3.243243243+3.7*2.4;x=((3.243243243*a-3.7*b)/d+35)*2-35;z=((2.4*a+5*b)/d+15)*2-15;if(height===undefined){const h=konaSupport(x,z);if(Number.isFinite(h))y=h/2;}}return[x,y*2,z];
}
export const konaGrade=(x:number,z:number)=>konaSupport(x,z);

// Refine the curved concrete while retaining every measured vertex and hard
// edge. Cubic tangent midpoints take the original low-poly transition facets
// down to small skateable intervals; architectural corners stay sharp.
function refine(vertices:number[],indices:number[],passes=2,cylindrical=false):{vertices:number[];indices:number[]} {
 for(let pass=0;pass<passes;pass++){
  const points=Array.from({length:vertices.length/3},(_,i)=>position(vertices,i)),normals=points.map(()=>new Vector3()),faces:Vector3[]=[],edges=new Map<string,{a:number;b:number;faces:number[]}>();
  for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),n=new Vector3().subVectors(points[ids[1]],points[ids[0]]).cross(new Vector3().subVectors(points[ids[2]],points[ids[0]])).normalize();faces.push(n);for(const id of ids)normals[id].add(n);
   for(let j=0;j<3;j++){const a=Math.min(ids[j],ids[(j+1)%3]),b=Math.max(ids[j],ids[(j+1)%3]),key=`${a}:${b}`;if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key)!.faces.push(i/3);}
  }
  if(cylindrical){
   const crossNormals=new Map<string,{normal:Vector3;minY:number;maxY:number}>(),flats=new Set<string>();
   for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),n=faces[i/3];if(n.y<.0001)continue;
    for(const id of ids){const p=points[id],key=`${p.x.toFixed(5)}:${p.y.toFixed(5)}`;
     if(n.y>.98){flats.add(key);continue;}
     if(!crossNormals.has(key))crossNormals.set(key,{normal:new Vector3(),minY:p.y,maxY:p.y});
     const entry=crossNormals.get(key)!;entry.normal.add(new Vector3(n.x,n.y,0));
     for(const j of ids){entry.minY=Math.min(entry.minY,points[j].y);entry.maxY=Math.max(entry.maxY,points[j].y);}
    }
   }
   for(let i=0;i<points.length;i++){const p=points[i],key=`${p.x.toFixed(5)}:${p.y.toFixed(5)}`,entry=crossNormals.get(key);
    normals[i].copy(entry?.normal??new Vector3(0,1,0));
    // A deck must not flatten the curve's lip tangent. That average turned
    // the last few centimetres back into a bank, so a rider drove over it
    // instead of launching/returning. The toe is horizontal, the lip vertical.
    if(entry&&flats.has(key)){
     if(entry.minY<p.y-1e-5&&entry.maxY<=p.y+1e-5)normals[i].y=0;
     if(entry.maxY>p.y+1e-5&&entry.minY>=p.y-1e-5)normals[i].set(0,1,0);
    }
   }
  }
  normals.forEach(n=>n.normalize());const mid=new Map<string,number>();
  for(const [key,e] of edges){const a=points[e.a],b=points[e.b],p=a.clone().add(b).multiplyScalar(.5),delta=b.clone().sub(a);
   if(e.faces.length===2&&faces[e.faces[0]].dot(faces[e.faces[1]])>.55&&e.faces.every(i=>faces[i].y>.02&&faces[i].y<.98)){p.addScaledVector(normals[e.a],-delta.dot(normals[e.a])/8).addScaledVector(normals[e.b],delta.dot(normals[e.b])/8);}
   mid.set(key,vertices.length/3);vertices.push(p.x,p.y,p.z);
  }
  const next:number[]=[],at=(a:number,b:number)=>mid.get(`${Math.min(a,b)}:${Math.max(a,b)}`)!;
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=indices.slice(i,i+3),ab=at(a,b),bc=at(b,c),ca=at(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}indices=next;
 }return{vertices,indices};
}
function surface(s:typeof survey.meshes[number],indices:number[],rideable:boolean) {
 if(!indices.length)return;
 let vertices:number[]=[];for(let i=0;i<s.vertices.length;i+=3)vertices.push(...konaPoint(...s.vertices.slice(i,i+3) as P));
 if(curved.has(s.id)&&rideable)({vertices,indices}=refine(vertices,indices,2,[78,88,130].includes(s.id)));
 else {vertices=indices.flatMap(i=>vertices.slice(i*3,i*3+3));indices=vertices.map((_,i)=>i).filter(i=>i<vertices.length/3);}
 // Checkpoints and route probes use the actual refined collision surface.
 if(!railsOnly.has(s.id)&&!poles.has(s.id))for(let i=0;i<indices.length;i+=3){const p=indices.slice(i,i+3).map(j=>vertices.slice(j*3,j*3+3) as P);triangles.push({a:p[0],b:p[1],c:p[2],id:s.id});}
 let color=colors.concrete;if(grass.has(s.id))color=colors.grass;if(roofs.has(s.id))color=colors.roof;if(s.id===33||s.id===76)color=colors.blue;if(s.id===23)color='#ffffff';if(s.id===88)color=colors.wood;if(s.id===130)color=colors.cream;if(railsOnly.has(s.id))color=colors.rail;
 for(let start=0;start<indices.length;start+=3600){const ids=indices.slice(start,start+3600),map=new Map<number,number>(),v:number[]=[],ix:number[]=[],cs:number[]=[];
  for(const id of ids){if(!map.has(id)){map.set(id,map.size);v.push(...vertices.slice(id*3,id*3+3));}ix.push(map.get(id)!);}
  // A worn concrete bottom remains visible within the red pro bowl.
  if(s.id===23)for(let i=0;i<v.length;i+=3){const worn=v[i+1]<1.3;cs.push(...(worn?[.65,.70,.64]:[.67,.36,.38]));}
  add({t:'mesh',p:[0,0,0],vertices:v,indices:ix,...(cs.length?{colors:cs}:{}),color,tex:'solid',nm:names[s.id]??(roofs.has(s.id)?'Clubhouse roofs':grass.has(s.id)?'Grass terrace':railsOnly.has(s.id)?'Rail and fence structure':poles.has(s.id)?'Park light mast':'Kona / concrete and architecture'),grp:s.id+1,edgeGrinding:false,vert:rideable&&vert.has(s.id),...(rideable&&curved.has(s.id)?{skateCamera:vert.has(s.id),gravityTrack:s.id===33}:{}),...(railsOnly.has(s.id)||poles.has(s.id)?{solid:false}:{}),doubleSided:true});
 }
}

// Ground raycasts cannot stop a horizontal approach to a vertical triangle.
// Rebuild the source's hard wall faces as native, two-sided wallpath colliders.
// The source VERT flag (8) keeps the actual riding face open; backs/end caps
// and the park boundary remain solid. Coincident triangle halves share a wall.
export const KONA_WALLS:{a:P;b:P;height:number;source:number}[]=[];
for(const s of survey.meshes){
 const riding:number[]=[],hard:number[]=[],walls=new Map<string,{ends:P[][]}>();
 for(let i=0;i<s.indices.length;i+=3){
  const ids=s.indices.slice(i,i+3),points=ids.map(j=>konaPoint(...s.vertices.slice(j*3,j*3+3) as P));
  const [a,b,c]=points.map(p=>new Vector3(...p)),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const wall=Math.abs(normal.y)<.08&&(s.flags[i/3]&8)===0;
  (wall?hard:riding).push(...ids);
  if(!wall||railsOnly.has(s.id)||poles.has(s.id))continue;
  const columns=new Map<string,P[]>();
  for(const p of points){const key=`${p[0].toFixed(4)},${p[2].toFixed(4)}`;if(!columns.has(key))columns.set(key,[]);columns.get(key)!.push(p);}
  if(columns.size!==2)continue;
  const keys=[...columns.keys()].sort(),key=keys.join('|');
  if(!walls.has(key))walls.set(key,{ends:[[],[]]});
  const ends=walls.get(key)!.ends;keys.forEach((key,j)=>ends[j].push(...columns.get(key)!));
 }
 surface(s,riding,true);surface(s,hard,false);
 for(const {ends} of walls.values()){
  const a=ends[0].reduce((p,q)=>p[1]<q[1]?p:q),b=ends[1].reduce((p,q)=>p[1]<q[1]?p:q);
  const height=Math.max(...ends[0].map(p=>p[1]-a[1]),...ends[1].map(p=>p[1]-b[1]));
  if(height<.24||Math.hypot(a[0]-b[0],a[2]-b[2])<.1)continue;
  KONA_WALLS.push({a,b,height,source:s.id});
  add({t:'wallpath',p:a,pts:[[0,0,0,0],[b[0]-a[0],b[2]-a[2],0,b[1]-a[1]]],w:.12,rise:height,invisible:true,curve:'corner',nm:`Kona solid wall / ${s.id}`,grp:s.id+1});
 }
}

export const KONA_RAILS:{points:P[];coping:boolean}[]=[];
for(const [i,path] of survey.rails.entries()){
 const points=path.map(p=>konaPoint(...p as P)),p=points[0];
 // Source grind paths include the pool lips and terrace edges. Flush coping
 // uses the runtime's existing coping behavior instead of tripping a rider.
 const clearance=points.map(q=>q[1]-konaSupport(q[0],q[2],q[1]+.25)).filter(Number.isFinite);
 const coping=clearance.length>0&&clearance.sort((a,b)=>a-b)[Math.floor(clearance.length/2)]<.24;
 KONA_RAILS.push({points,coping});add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),invisible:true,coping,nm:`Kona / ${coping?'coping':'rail'} ${i+1}`,grp:170});
}
const onGround=(x:number,z:number,id?:number):P=>{const p=konaPoint(x,-448.44444,z);p[1]=konaSupport(p[0],p[2],100,id);return p;};
const sourceCurve=(points:[number,number][],id:number):P[]=>{
 const c=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(...onGround(x,z,id))),false,'centripetal'),n=Math.ceil(c.getLength()/.55);
 return Array.from({length:n+1},(_,i)=>{const p=c.getPointAt(i/n);p.y=konaSupport(p.x,p.z,100,id);return p.toArray() as P;});
};
export const KONA_SNAKE={points:sourceCurve([[300,-4100],[900,-4120],[1600,-4080],[2350,-4010],[2800,-3800],[2920,-3450],[2650,-3150],[2100,-3070],[1650,-3080],[1450,-2820],[1450,-2430],[1650,-2000],[1950,-1570],[2180,-1130],[2140,-800],[1920,-550],[1550,-350],[1100,-220],[700,-80],[400,150]],33)};
export const KONA_BOWLS=[
 {name:'Freestyle basin',id:16,centre:onGround(-1450,-1850,16)},
 {name:'Tombstone',id:23,centre:onGround(400,-1350,23)},
 {name:'Clover pool',id:12,centre:onGround(1700,850,12)},
 {name:'Lower kidney / J-run',id:76,centre:onGround(2330,2670,76)},
].map(b=>({...b,bottom:b.centre[1]}));
// Cross direction is X in our Y-up world; lengths run Z. These surveyed
// sections intentionally keep the unequal mini heights and timber roll-in.
export const KONA_PIPES=[
 {name:'Spinal grooves / west mini',centre:onGround(5032.44,-1342.67,130),radius:2.788,flat:6.610,length:26.44},
 {name:'Spinal grooves / east mini',centre:onGround(5032.44,-2165.33,130),radius:2.788,flat:6.154,length:26.44},
 {name:'Over the roll-in / timber vert',centre:onGround(5070,211.11,88),radius:6.866,flat:7.178,length:28.334},
];
export const KONA_JUMP={a:onGround(4650,-4290),b:onGround(6050,-4290)};
export const KONA_SPAWN=onGround(-1600,1500);KONA_SPAWN[1]+=.12;
// Aim the existing park controller into the skating area at arrival.
add({t:'zone',p:KONA_SPAWN,s:[12,10,12],dir:'E',nm:'Arrival facing into Kona',grp:171});
export const KONA_CHECKPOINTS=[
 {name:'Freestyle',p:onGround(-1900,-800)},
 {name:'Snake head',p:onGround(1550,-5150)},
 {name:'Lower pools',p:onGround(2800,1100)},
 {name:'Spinal grooves',p:onGround(4100,-1900)},
 {name:'Street course',p:onGround(6500,-3200)},
];
for(const cp of KONA_CHECKPOINTS)add({t:'checkpoint',nm:cp.name,p:cp.p,grp:171});
const gate=onGround(-1300,450);add({t:'gate',nm:'Giga Kona / session exit',p:gate,yaw:0,grp:171});
for(const p of [KONA_SPAWN,...KONA_CHECKPOINTS.map(cp=>cp.p),...KONA_SNAKE.points.filter((_,i)=>i%24===0)])add({t:'camnode',p,grp:171});
export const KONA_LEVEL:CustomLevelData={
 v:1,name:'Kona · PS1',skatepark:true,spawn:KONA_SPAWN,killY:-36,sky:'night',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:270,fogFar:530,fogColor:'#292333',backdrop:'fog',ambientSky:'#c8d9df',ambientGround:'#5e696a',ambientIntensity:1.45,sunColor:'#cedbe0',sunIntensity:1.25,fillColor:'#aab4d3',fillIntensity:.5,drawDistance:640,shadowStrength:.5},components:C,
 groups:[...survey.meshes.map(s=>({id:s.id+1,nm:names[s.id]??`Kona surface ${s.id+1}`,editorOnly:true})),{id:170,nm:'Measured grind lines',editorOnly:true},{id:171,nm:'Session and camera',editorOnly:true}],
};
