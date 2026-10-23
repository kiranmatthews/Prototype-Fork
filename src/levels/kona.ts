import { CatmullRomCurve3, Triangle, Vector3 } from 'three';
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
type RefinedSurface={vertices:number[];indices:number[];normals?:number[]};
type CrossCurve={a:Vector3;b:Vector3;ta:Vector3;tb:Vector3};
function sampleCrossCurve(c:CrossCurve,t:number){
 const length=c.a.distanceTo(c.b),t2=t*t,t3=t2*t;
 const p=c.a.clone().multiplyScalar(2*t3-3*t2+1).addScaledVector(c.ta,(t3-2*t2+t)*length).addScaledVector(c.b,-2*t3+3*t2).addScaledVector(c.tb,(t3-t2)*length);
 const tangent=c.a.clone().multiplyScalar(6*t2-6*t).addScaledVector(c.ta,(3*t2-4*t+1)*length).addScaledVector(c.b,-6*t2+6*t).addScaledVector(c.tb,(3*t2-2*t)*length).normalize();
 const side=Math.sign(c.b.x-c.a.x),normal=new Vector3(-side*tangent.y,side*tangent.x,0).normalize();
 return {p,normal};
}
function refineCrossSection(vertices:number[],indices:number[]):RefinedSurface {
 const points=Array.from({length:vertices.length/3},(_,i)=>position(vertices,i));
 const key=(p:Vector3)=>`${p.x.toFixed(5)}:${p.y.toFixed(5)}`;
 const curves=new Map<string,CrossCurve>();
 const tangents=new Map<string,Vector3>(),flats=new Set<string>();
 const faceCurve:(string|null)[]=[];
 for(let i=0;i<indices.length;i+=3){
  const ps=indices.slice(i,i+3).map(j=>points[j]),n=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).normalize();
  if(n.y>.995)ps.forEach(p=>flats.add(key(p)));
  const cross=[...new Map(ps.map(p=>[key(p),p])).values()].sort((a,b)=>a.y-b.y);
  if(cross.length!==2||n.y<0||n.y>.995||Math.abs(n.z)>.001){faceCurve.push(null);continue;}
  const [a,b]=cross.map(p=>new Vector3(p.x,p.y,0)),id=`${key(a)}|${key(b)}`;faceCurve.push(id);
  if(curves.has(id))continue;
  const t=b.clone().sub(a).normalize();curves.set(id,{a,b,ta:t.clone(),tb:t.clone()});
  for(const p of [a,b]){const k=key(p);if(!tangents.has(k))tangents.set(k,new Vector3());tangents.get(k)!.add(t);}
 }
 for(const c of curves.values()){
  c.ta.copy(tangents.get(key(c.a))!).normalize();c.tb.copy(tangents.get(key(c.b))!).normalize();
  if(flats.has(key(c.a)))c.ta.set(Math.sign(c.b.x-c.a.x),0,0);
  if(flats.has(key(c.b))){
   const chord=c.b.clone().sub(c.a).normalize();
   // A steep transition ends vertically; the inset timber roll-in is a
   // deliberate bank and must retain its drive-over exit onto the deck.
   if(Math.abs(chord.x)<.35)c.tb.set(0,1,0);else c.tb.copy(chord);
  }
 }
 const v:number[]=[],ix:number[]=[],normals:number[]=[];
 for(let i=0;i<indices.length;i+=3){
  const ps=indices.slice(i,i+3).map(j=>points[j]),c=curves.get(faceCurve[i/3]??'');
  const faceNormal=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).normalize();
  const edges=ps.map((a,j)=>{const k=(j+1)%3,b=ps[k],low=a.y<=b.y?a:b,high=a.y<=b.y?b:a;return {j,k,curve:curves.get(`${key(low)}|${key(high)}`),reverse:a!==low};});
  const stitched=!c&&faceNormal.y>0&&faceNormal.y<.995&&edges.some(e=>e.curve);
  const vertexNormals=ps.map(()=>new Vector3());
  if(stitched)for(const e of edges)if(e.curve){vertexNormals[e.j].add(sampleCrossCurve(e.curve,e.reverse?1:0).normal);vertexNormals[e.k].add(sampleCrossCurve(e.curve,e.reverse?0:1).normal);}
  vertexNormals.forEach(n=>n.lengthSq()?n.normalize():n.copy(faceNormal));
  let tris=[ps];
  if(c||stitched)for(let pass=0;pass<3;pass++)tris=tris.flatMap(([a,b,d])=>{
   const ab=a.clone().add(b).multiplyScalar(.5),bd=b.clone().add(d).multiplyScalar(.5),da=d.clone().add(a).multiplyScalar(.5);
   return [[a,ab,da],[ab,b,bd],[da,bd,d],[ab,bd,da]];
  });
  for(const tri of tris)for(const q of tri){
   const p=q.clone(),normal=faceNormal.clone();
   if(c){const delta=c.b.clone().sub(c.a),t=Math.max(0,Math.min(1,new Vector3(q.x-c.a.x,q.y-c.a.y,0).dot(delta)/delta.lengthSq())),sample=sampleCrossCurve(c,t);
    p.copy(sample.p);p.z=q.z;normal.copy(sample.normal);
   }else if(stitched){
    // Variable-height lips have three distinct cross-section points. Blend
    // the same edge curves used by their neighbours into the triangle, so
    // refinement cannot leave a straight edge beside a curved one.
    const weights=Triangle.getBarycoord(q,ps[0],ps[1],ps[2],new Vector3())!.toArray();
    normal.set(0,0,0);vertexNormals.forEach((n,j)=>normal.addScaledVector(n,weights[j]));
    for(const e of edges)if(e.curve){const weight=weights[e.j]+weights[e.k];if(weight<1e-8)continue;
     const t=weights[e.k]/weight,sample=sampleCrossCurve(e.curve,e.reverse?1-t:t),linear=ps[e.j].clone().lerp(ps[e.k],t);sample.p.z=linear.z;
     p.addScaledVector(sample.p.sub(linear),weight*weight);
     const linearNormal=vertexNormals[e.j].clone().lerp(vertexNormals[e.k],t);normal.addScaledVector(sample.normal.sub(linearNormal),weight*weight);
    }
    normal.normalize();
   }
   ix.push(v.length/3);v.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);
  }
 }
 return {vertices:v,indices:ix,normals};
}
function refine(vertices:number[],indices:number[],passes=2,cylindrical=false):RefinedSurface {
 if(cylindrical)return refineCrossSection(vertices,indices);
 for(let pass=0;pass<passes;pass++){
  const points=Array.from({length:vertices.length/3},(_,i)=>position(vertices,i)),normals=points.map(()=>new Vector3()),faces:Vector3[]=[],edges=new Map<string,{a:number;b:number;faces:number[]}>();
  for(let i=0;i<indices.length;i+=3){const ids=indices.slice(i,i+3),n=new Vector3().subVectors(points[ids[1]],points[ids[0]]).cross(new Vector3().subVectors(points[ids[2]],points[ids[0]])).normalize();faces.push(n);for(const id of ids)normals[id].add(n);
   for(let j=0;j<3;j++){const a=Math.min(ids[j],ids[(j+1)%3]),b=Math.max(ids[j],ids[(j+1)%3]),key=`${a}:${b}`;if(!edges.has(key))edges.set(key,{a,b,faces:[]});edges.get(key)!.faces.push(i/3);}
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
 let vertices:number[]=[],normals:number[]|undefined;for(let i=0;i<s.vertices.length;i+=3)vertices.push(...konaPoint(...s.vertices.slice(i,i+3) as P));
 if(curved.has(s.id)&&rideable)({vertices,indices,normals}=refine(vertices,indices,2,[78,88,130].includes(s.id)));
 else {vertices=indices.flatMap(i=>vertices.slice(i*3,i*3+3));indices=vertices.map((_,i)=>i).filter(i=>i<vertices.length/3);}
 // Checkpoints and route probes use the actual refined collision surface.
 if(!railsOnly.has(s.id)&&!poles.has(s.id))for(let i=0;i<indices.length;i+=3){const p=indices.slice(i,i+3).map(j=>vertices.slice(j*3,j*3+3) as P);triangles.push({a:p[0],b:p[1],c:p[2],id:s.id});}
 let color=colors.concrete;if(grass.has(s.id))color=colors.grass;if(roofs.has(s.id))color=colors.roof;if(s.id===33||s.id===76)color=colors.blue;if(s.id===23)color='#ffffff';if(s.id===88)color=colors.wood;if(s.id===130)color=colors.cream;if(railsOnly.has(s.id))color=colors.rail;
 for(let start=0;start<indices.length;start+=3600){const ids=indices.slice(start,start+3600),map=new Map<number,number>(),v:number[]=[],ix:number[]=[],cs:number[]=[],ns:number[]=[];
  for(const id of ids){if(!map.has(id)){map.set(id,map.size);v.push(...vertices.slice(id*3,id*3+3));if(normals)ns.push(...normals.slice(id*3,id*3+3));}ix.push(map.get(id)!);}
  // A worn concrete bottom remains visible within the red pro bowl.
  if(s.id===23)for(let i=0;i<v.length;i+=3){const worn=v[i+1]<1.3;cs.push(...(worn?[.65,.70,.64]:[.67,.36,.38]));}
  add({t:'mesh',p:[0,0,0],vertices:v,indices:ix,...(ns.length?{normals:ns,smoothCollision:true}:{}),...(cs.length?{colors:cs}:{}),color,tex:'solid',nm:names[s.id]??(roofs.has(s.id)?'Clubhouse roofs':grass.has(s.id)?'Grass terrace':railsOnly.has(s.id)?'Rail and fence structure':poles.has(s.id)?'Park light mast':'Kona / concrete and architecture'),grp:s.id+1,edgeGrinding:false,vert:rideable&&vert.has(s.id),...(rideable&&curved.has(s.id)?{skateCamera:vert.has(s.id),gravityTrack:s.id===33}:{}),...(railsOnly.has(s.id)||poles.has(s.id)?{solid:false}:{}),doubleSided:true});
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
  if(columns.size!==2){
   // Raised roll-ins have triangular end caps with three distinct columns.
   // Their vertical footprint is still a straight wall. Close the footprint
   // down into the solid ramp body; the measured riding mesh owns its top.
   // Dropping these faces let an angled rider cross the step sideways.
   if(!curved.has(s.id)||Math.abs(normal.y)>.01)continue;
   const pairs=[[points[0],points[1]],[points[1],points[2]],[points[2],points[0]]].sort((u,v)=>Math.hypot(v[1][0]-v[0][0],v[1][2]-v[0][2])-Math.hypot(u[1][0]-u[0][0],u[1][2]-u[0][2]));
   const [a,b]=pairs[0],bottom=Math.min(...points.map(p=>p[1])),top=Math.max(...points.map(p=>p[1]));
   columns.clear();
   for(const p of [a,b])columns.set(`${p[0].toFixed(4)},${p[2].toFixed(4)}`,[[p[0],bottom,p[2]],[p[0],top,p[2]]]);
  }
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
