import { Vector3 } from 'three';
import survey from '../../docs/mall/source-survey.json';
import type { CustomComponent, CustomLevelData } from '../level';
import { mallVisuals } from './mall-art';

type P = [number, number, number];
type Triangle = { a:P; b:P; c:P; d:number; source:number };
const C:CustomComponent[]=[];
const add=(c:CustomComponent)=>{C.push(c);return c;};
// One uniform scale; all source relationships and elevations remain intact.
// The survey is a PS1 conversion, not a verified retail-disc extraction.
// The tightest arcade beam leaves 3.19 m on the normal lane at this scale,
// clearing the existing ~3.02 m visible rider. Collision-capsule dimensions
// alone would allow a much smaller scene while the rider clips its ceilings.
export const MALL_SCALE=.045;
export const MALL_ORIGIN:P=[-14573.5751953125,-2324.921875,532.1126708984375];
export const mallPoint=(x:number,y:number,z:number):P=>[(z-MALL_ORIGIN[2])*MALL_SCALE,(y-MALL_ORIGIN[1])*MALL_SCALE,-(x-MALL_ORIGIN[0])*MALL_SCALE];
export const mallSourcePoint=(x:number,y:number,z:number):P=>[MALL_ORIGIN[0]-z/MALL_SCALE,MALL_ORIGIN[1]+y/MALL_SCALE,MALL_ORIGIN[2]+x/MALL_SCALE];
const pos=(v:number[],i:number):P=>v.slice(i*3,i*3+3) as P;
// Weld duplicate material/sector seams in source units so choosing a uniform
// world scale cannot change the transition or rail graph's connectivity.
const sourceKey=(x:number)=>Math.round(x*100+1e-6);
const key=(p:P)=>mallSourcePoint(...p).map(sourceKey).join(',');
const columnKey=(p:P)=>{const q=mallSourcePoint(...p);return `${sourceKey(q[0])},${sourceKey(q[2])}`;};
const normal=(a:P,b:P,c:P)=>new Vector3(...b).sub(new Vector3(...a)).cross(new Vector3(...c).sub(new Vector3(...a))).normalize();
const floor:Triangle[]=[];
export function mallSupport(x:number,z:number,ceiling=Infinity):number {
 let y=-Infinity;
 for(const t of floor){const {a,b,c,d}=t;
  if(x<Math.min(a[0],b[0],c[0])-.00001||x>Math.max(a[0],b[0],c[0])+.00001||z<Math.min(a[2],b[2],c[2])-.00001||z>Math.max(a[2],b[2],c[2])+.00001)continue;
  const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/d,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/d;
  if(u<-.00001||v<-.00001||u+v>1.00001)continue;
  const h=u*a[1]+v*b[1]+(1-u-v)*c[1];if(h<=ceiling&&h>y)y=h;
 }return y;
}
export function mallSourceSupport(x:number,z:number,ceiling=2000):number {
 const p=mallPoint(x,ceiling,z),h=mallSupport(p[0],p[2],p[1]);return h/MALL_SCALE+MALL_ORIGIN[1];
}

// Subdivision inserts tangent midpoints on smooth interior edges only. Every
// measured control vertex and architectural boundary is retained.
function refine(v:number[],ix:number[],passes=3):{v:number[];ix:number[]} {
 for(let pass=0;pass<passes;pass++){
  const points=Array.from({length:v.length/3},(_,i)=>new Vector3(...pos(v,i))),ns=points.map(()=>new Vector3()),fs:Vector3[]=[],edges=new Map<string,{a:number;b:number;faces:number[]}>();
  const pointKeys=points.map(p=>key(p.toArray() as P)),edgeKey=(a:number,b:number)=>[pointKeys[a],pointKeys[b]].sort().join('|');
  const welded=new Map<string,{normal:Vector3;vertical:Vector3}>();
  for(let i=0;i<ix.length;i+=3){const ids=ix.slice(i,i+3),n=points[ids[1]].clone().sub(points[ids[0]]).cross(points[ids[2]].clone().sub(points[ids[0]])).normalize();fs.push(n);for(const id of ids)ns[id].add(n);
   for(const id of ids){const k=pointKeys[id];if(!welded.has(k))welded.set(k,{normal:new Vector3(),vertical:new Vector3()});const w=welded.get(k)!;w.normal.add(n);if(Math.abs(n.y)<.0001)w.vertical.add(n);}
   for(let j=0;j<3;j++){const a=Math.min(ids[j],ids[(j+1)%3]),b=Math.max(ids[j],ids[(j+1)%3]),k=edgeKey(a,b);if(!edges.has(k))edges.set(k,{a,b,faces:[]});edges.get(k)!.faces.push(i/3);}
  }
  // The PS1 mesh duplicates vertices at its material seams. Share tangent
  // evidence there without moving or discarding any measured control point.
  // A straight vertical extension supplies the upper quarter's vertical
  // tangent; averaging it with the slope would bend that extension backward.
  ns.forEach((n,i)=>{const w=welded.get(pointKeys[i]),vertical=verticalTangents.get(pointKeys[i]);if(vertical)n.copy(vertical);else if(w)n.copy(w.vertical.lengthSq()>1e-8?w.vertical:w.normal);n.normalize();});const mids=new Map<string,number>();
  for(const [k,e] of edges){const a=points[e.a],b=points[e.b],p=a.clone().add(b).multiplyScalar(.5),delta=b.clone().sub(a);
   if(e.faces.length===2&&fs[e.faces[0]].dot(fs[e.faces[1]])>.7&&e.faces.every(i=>fs[i].y>=0&&fs[i].y<.999))p.addScaledVector(ns[e.a],-delta.dot(ns[e.a])/8).addScaledVector(ns[e.b],delta.dot(ns[e.b])/8);
   mids.set(k,v.length/3);v.push(p.x,p.y,p.z);
  }
  const next:number[]=[],mid=(a:number,b:number)=>mids.get(edgeKey(a,b))!;
  for(let i=0;i<ix.length;i+=3){const [a,b,c]=ix.slice(i,i+3),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}ix=next;
 }return{v,ix};
}
const sourceName=(id:number)=>id===18?'Entrance / first concourse':id===42?'Courtyard / exit':id===43?'Atrium / crossrail arcade':id>=33&&id<=37?'Directory':id===19||id===20||id===38?'Glass doorway':`Mall detail ${id}`;
export const MALL_WALLS:{a:P;b:P;height:number;source:number}[]=[];
export const MALL_SURVEY_STATS={sourceTriangles:0,solidTriangles:0,vertTriangles:0,visualTriangles:0,wallSegments:0,railEdges:0,railPaths:0};
type WallPatch={ends:P[][];source:number;vertices:Set<string>};
const allWalls=new Map<string,WallPatch[]>();
// Collision sectors cut through continuous ramps: the south courtyard's
// vertical extension is in sector 43 while its curve is in sector 42. Find
// transition neighbours and lip tangents across that storage boundary too.
const transitionFaces=new Map<string,{points:P[];n:Vector3;flag:number}>(),transitionEdges=new Map<string,string[]>();
for(const s of survey.meshes){if(s.id<18||s.id>=54)continue;
 for(let i=0;i<s.indices.length;i+=3){const points=s.indices.slice(i,i+3).map(j=>mallPoint(...pos(s.vertices,j))),id=`${s.id}:${i/3}`,n=normal(...points as [P,P,P]);transitionFaces.set(id,{points,n,flag:s.flags[i/3]});
  for(let j=0;j<3;j++){const k=[key(points[j]),key(points[(j+1)%3])].sort().join('|');if(!transitionEdges.has(k))transitionEdges.set(k,[]);transitionEdges.get(k)!.push(id);}
 }
}
const transitionSet=new Set<string>(),transitionQueue:string[]=[],verticalTangents=new Map<string,Vector3>();
for(const [id,f] of transitionFaces)if((f.flag&8)&&!(f.flag&16)&&f.n.y>=-.001){transitionSet.add(id);transitionQueue.push(id);}
for(let q=0;q<transitionQueue.length;q++){const f=transitionFaces.get(transitionQueue[q])!;for(let j=0;j<3;j++){
 const k=[key(f.points[j]),key(f.points[(j+1)%3])].sort().join('|');
 for(const id of transitionEdges.get(k)??[]){const g=transitionFaces.get(id)!;if(transitionSet.has(id)||(g.flag&16)||g.n.y<-.001||g.n.y>.9995||g.n.dot(f.n)<.7)continue;transitionSet.add(id);transitionQueue.push(id);}
}}
for(const id of transitionSet){const f=transitionFaces.get(id)!;if(Math.abs(f.n.y)>.0001)continue;for(const p of f.points){const k=key(p);if(!verticalTangents.has(k))verticalTangents.set(k,new Vector3());verticalTangents.get(k)!.add(f.n);}}
verticalTangents.forEach(n=>n.normalize());
for(const s of survey.meshes){
 // The small local cereal/water objects are conversion additions. The actual
 // static architecture already has world positions; do not add node offsets.
 if(s.id<18||s.id>=54)continue;
 const v:number[]=[];for(let i=0;i<s.vertices.length;i+=3)v.push(...mallPoint(...s.vertices.slice(i,i+3) as P));
 const faces=Array.from({length:s.indices.length/3},(_,i)=>({ids:s.indices.slice(i*3,i*3+3),flag:s.flags[i],n:new Vector3()}));
 const adjacency=new Map<string,number[]>();
 for(let i=0;i<faces.length;i++){const f=faces[i];f.n=normal(...f.ids.map(j=>pos(v,j)) as [P,P,P]);
  for(let j=0;j<3;j++){const k=[key(pos(v,f.ids[j])),key(pos(v,f.ids[(j+1)%3]))].sort().join('|');if(!adjacency.has(k))adjacency.set(k,[]);adjacency.get(k)!.push(i);}
 }
 // VERT marks the upper part of a transition in the source. Extend the native
 // riding classification down its connected, smoothly changing slope to its
 // flat toe, without treating an adjacent architectural wall as a quarter.
 const curved=new Set<number>();faces.forEach((_f,i)=>{if(transitionSet.has(`${s.id}:${i}`))curved.add(i);});
 const batches=new Map<string,{ix:number[];vert:boolean;solid:boolean;color:string;tex:string}>();
 for(let i=0;i<faces.length;i++){
  const f=faces[i],points=f.ids.map(j=>pos(v,j)),vert=curved.has(i),glass=[19,20,38].includes(s.id),directory=s.id>=33&&s.id<=37;
  const solid=!(f.flag&16)&&!glass&&!directory;
  MALL_SURVEY_STATS.sourceTriangles++;if(solid)MALL_SURVEY_STATS.solidTriangles++;else MALL_SURVEY_STATS.visualTriangles++;if(vert)MALL_SURVEY_STATS.vertTriangles++;
  const color=glass?'#88b5bf':directory?'#346761':s.terrain[i]===24?'#528d9b':vert?'#b6b8a8':f.n.y>.55?'#c4bda7':f.n.y<-.3?'#73847e':'#839991';
  const tex=glass||directory?'solid':vert?'stone':f.n.y>.55?'pavement':'stone';
  const k=`${solid}:${vert}:${color}:${tex}`;if(!batches.has(k))batches.set(k,{ix:[],vert,solid,color,tex});batches.get(k)!.ix.push(...f.ids);
  if(!solid||vert||Math.abs(f.n.y)>.025)continue;
  const columns=new Map<string,P[]>();for(const p of points){const k=columnKey(p);if(!columns.has(k))columns.set(k,[]);columns.get(k)!.push(p);}
  if(columns.size!==2)continue;
  const keys=[...columns.keys()].sort(),wk=keys.join('|');
  if(!allWalls.has(wk))allWalls.set(wk,[]);
  const patches=allWalls.get(wk)!,shared=patches.filter(p=>points.filter(q=>p.vertices.has(key(q))).length>=2);
  const patch=shared[0]??{ends:[[],[]],source:s.id,vertices:new Set<string>()};
  if(!shared.length)patches.push(patch);
  for(const other of shared.slice(1)){other.ends.forEach((v,i)=>patch.ends[i].push(...v));other.vertices.forEach(v=>patch.vertices.add(v));patches.splice(patches.indexOf(other),1);}
  keys.forEach((k,j)=>patch.ends[j].push(...columns.get(k)!));points.forEach(p=>patch.vertices.add(key(p)));
 }
 // A PS1 wall can have one long bottom edge and two shorter top edges. Such
 // a three-triangle fan has no matching rectangular pair; recover its whole
 // connected vertical patch before measuring the two end columns. Otherwise
 // the garden's curved skirt would have an opening beneath its raised top.
 const hard=(i:number)=>!(faces[i].flag&16)&&!curved.has(i)&&Math.abs(faces[i].n.y)<.025&&!([19,20,38].includes(s.id)||s.id>=33&&s.id<=37);
 const visited=new Set<number>();
 for(let seed=0;seed<faces.length;seed++){
  if(!hard(seed)||visited.has(seed))continue;
  const patch=[seed];visited.add(seed);
  for(let q=0;q<patch.length;q++){const f=faces[patch[q]];for(let j=0;j<3;j++){
   const k=[key(pos(v,f.ids[j])),key(pos(v,f.ids[(j+1)%3]))].sort().join('|');
   for(const i of adjacency.get(k)??[])if(!visited.has(i)&&hard(i)&&Math.abs(faces[i].n.dot(faces[seed].n))>.995){visited.add(i);patch.push(i);}
  }}
  const patchSet=new Set(patch),points=patch.flatMap(i=>faces[i].ids.map(j=>pos(v,j)));
  for(const i of patch){const f=faces[i];for(let j=0;j<3;j++){
   const a=pos(v,f.ids[j]),b=pos(v,f.ids[(j+1)%3]),c=pos(v,f.ids[(j+2)%3]);
   const k=[key(a),key(b)].sort().join('|');if((adjacency.get(k)??[]).some(n=>n!==i&&patchSet.has(n)))continue;
   const dx=b[0]-a[0],dz=b[2]-a[2],len2=dx*dx+dz*dz;if(len2<.0064)continue;
   const t=((c[0]-a[0])*dx+(c[2]-a[2])*dz)/len2;if(c[1]-a[1]-(b[1]-a[1])*t<.1)continue;
   // The upper and lower boundary may use different subdivisions. Intersect
   // the patch in a vertical plane at each lower endpoint, rather than
   // requiring an upper vertex directly above it (the long graded curbs do
   // not have those paired vertices).
   const len=Math.sqrt(len2),ux=dx/len,uz=dz/len;
   const ends=[a,b].map((p,end)=>{
    let top=p[1];const target=end*len;
    for(const n of patch){const ids=faces[n].ids;for(let e=0;e<3;e++){
     const u=pos(v,ids[e]),w=pos(v,ids[(e+1)%3]),su=(u[0]-a[0])*ux+(u[2]-a[2])*uz,sw=(w[0]-a[0])*ux+(w[2]-a[2])*uz;
     if(target<Math.min(su,sw)-.0001||target>Math.max(su,sw)+.0001)continue;
     const t=Math.abs(sw-su)<.00001?0:Math.max(0,Math.min(1,(target-su)/(sw-su))),q=u.map((x,j)=>x+(w[j]-x)*t) as P;
     if(Math.abs((q[0]-p[0])*uz-(q[2]-p[2])*ux)<.12)top=Math.max(top,q[1],...(Math.abs(sw-su)<.00001?[u[1],w[1]]:[]));
    }}
    return[p,[p[0],top,p[2]] as P];
   });
   if(ends.some(e=>e[1][1]-e[0][1]<.24))continue;
   const keys=[a,b].map(columnKey),order=keys[0]<keys[1]?[0,1]:[1,0],wk=order.map(i=>keys[i]).join('|');
   if(!allWalls.has(wk))allWalls.set(wk,[]);
   const candidates=allWalls.get(wk)!,vs=new Set(points.map(key));
   const existing=candidates.find(p=>p.ends.flat().some(q=>vs.has(key(q))));
   if(existing)order.forEach((i,j)=>existing.ends[j].push(...ends[i]));
   else candidates.push({ends:order.map(i=>ends[i]),source:s.id,vertices:vs});
  }}
 }
 for(const b of batches.values()){
  if(b.vert)continue; // Continuous spatial transition meshes are emitted below.
  const data={v:[...v],ix:b.ix};
  if(b.solid)for(let i=0;i<data.ix.length;i+=3){const [a,b,c]=data.ix.slice(i,i+3).map(j=>pos(data.v,j)),d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(d<-.000001)floor.push({a,b,c,d,source:s.id});}
  for(let start=0;start<data.ix.length;start+=3600){const map=new Map<number,number>(),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
   for(const i of data.ix.slice(start,start+3600)){if(!map.has(i)){map.set(i,map.size);const p=pos(data.v,i);vertices.push(...p);uvs.push(p[0]/3,(b.color==='#839991'?p[1]:p[2])/3);}indices.push(map.get(i)!);}
   add({t:'mesh',p:[0,0,0],vertices,indices,uvs,solid:b.solid,vert:b.vert,...(b.solid&&b.vert?{skateCamera:true}:{}),color:b.color,tex:b.tex,doubleSided:true,edgeGrinding:false,grp:s.id+1,nm:`${sourceName(s.id)} / ${b.vert?'transition':b.solid?'surface':'detail'}`});
  }
 }
}
// A native mesh ride follows the mesh it is currently touching. Source sector
// and arbitrary triangle-count splits therefore cannot cut a quarter in two.
// Overlapping spatial chunks keep each contact neighbourhood in one mesh,
// including its straight vertical extension, without changing the runtime.
const transitionVertices:number[]=[],transitionIndices:number[]=[];
for(const id of transitionSet){const f=transitionFaces.get(id)!;for(const p of f.points){transitionIndices.push(transitionVertices.length/3);transitionVertices.push(...p);}}
const transition=refine(transitionVertices,transitionIndices),cells=new Map<string,number[]>(),cellSize=240*MALL_SCALE,halo=1.2;
for(let i=0;i<transition.ix.length;i+=3){
 const ids=transition.ix.slice(i,i+3),points=ids.map(j=>pos(transition.v,j)),[a,b,c]=points,d=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
 if(d<-.000001)floor.push({a,b,c,d,source:-1});
 const lo=[0,1,2].map(j=>Math.floor((Math.min(...points.map(p=>p[j]))-halo)/cellSize)),hi=[0,1,2].map(j=>Math.floor((Math.max(...points.map(p=>p[j]))+halo)/cellSize));
 for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
  const k=`${x}:${y}:${z}`;if(!cells.has(k))cells.set(k,[]);cells.get(k)!.push(...ids);
 }
}
for(const [cell,ix] of cells){
 const map=new Map<number,number>(),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(const i of ix){if(!map.has(i)){map.set(i,map.size);const p=pos(transition.v,i);vertices.push(...p);uvs.push(p[0]/3,p[2]/3);}indices.push(map.get(i)!);}
 if(indices.length>12288||vertices.length>12288)throw Error(`Mall transition cell ${cell} exceeds the native mesh bounds`);
 add({t:'mesh',p:[0,0,0],vertices,indices,uvs,solid:true,vert:true,skateCamera:true,color:'#b6b8a8',tex:'stone',doubleSided:true,edgeGrinding:false,grp:63,nm:'Mall continuous transition'});
}
// Native two-sided wall contacts complement the mesh's vertical raycasts.
// Only coincident source columns merge; a door's lintel cannot seal its gap.
for(const {ends,source} of [...allWalls.values()].flat()){
 const a=ends[0].reduce((p,q)=>p[1]<q[1]?p:q),b=ends[1].reduce((p,q)=>p[1]<q[1]?p:q);
 const height=Math.min(Math.max(...ends[0].map(p=>p[1]-a[1])),Math.max(...ends[1].map(p=>p[1]-b[1])));
 if(height<.24||Math.hypot(a[0]-b[0],a[2]-b[2])<.08)continue;
 MALL_WALLS.push({a,b,height,source});add({t:'wallpath',p:a,pts:[[0,0,0,0],[b[0]-a[0],b[2]-a[2],0,b[1]-a[1]]],w:.1,rise:height,invisible:true,edgeGrinding:false,curve:'corner',grp:source+1,nm:`${sourceName(source)} / wall`});
}
MALL_SURVEY_STATS.wallSegments=MALL_WALLS.length;

// Conversion nodes contain duplicate returns (A→B→A). Reconstruct the unique
// undirected graph first, then stop paths at junctions and preserve true loops.
const railPoints:P[]=[],nodeMap=new Map<number,number>(),pointMap=new Map<string,number>();
for(const n of survey.railNodes){const p=mallPoint(...n.p as P),k=key(p);if(!pointMap.has(k)){pointMap.set(k,railPoints.length);railPoints.push(p);}nodeMap.set(n.index,pointMap.get(k)!);}
const edges=new Set<string>(),neighbours=railPoints.map(()=>new Set<number>()),edgeKey=(a:number,b:number)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
for(const n of survey.railNodes)for(const link of n.links){const a=nodeMap.get(n.index)!,b=nodeMap.get(link)!;if(a===b||new Vector3(...railPoints[a]).distanceTo(new Vector3(...railPoints[b]))<.01)continue;const k=edgeKey(a,b);if(edges.has(k))continue;edges.add(k);neighbours[a].add(b);neighbours[b].add(a);}
const used=new Set<string>();
export const MALL_RAILS:{points:P[];closed:boolean;coping:boolean}[]=[];
function rail(a:number,b:number){
 const ids=[a];let prev=a,now=b;used.add(edgeKey(prev,now));
 for(let guard=0;guard<railPoints.length;guard++){
  ids.push(now);if(now===a||neighbours[now].size!==2)break;
  const next=[...neighbours[now]].find(n=>n!==prev)!;if(used.has(edgeKey(now,next)))break;used.add(edgeKey(now,next));prev=now;now=next;
 }
 const closed=ids.length>2&&ids[ids.length-1]===a;if(closed)ids.pop();
 const points=ids.map(i=>railPoints[i]),p=points[0],clearance=points.map(q=>q[1]-mallSupport(q[0],q[2],q[1]+.15)).filter(Number.isFinite).sort((a,b)=>a-b);
 const coping=clearance.length>0&&clearance[Math.floor(clearance.length/2)]<.24;
 const i=MALL_RAILS.length;MALL_RAILS.push({points,closed,coping});
 add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),curve:'corner',closed,coping,invisible:true,grp:61,nm:`Measured ${coping?'coping':'grind'} ${i+1}`});
}
for(let a=0;a<neighbours.length;a++)if(neighbours[a].size!==2)for(const b of neighbours[a])if(!used.has(edgeKey(a,b)))rail(a,b);
for(const k of edges)if(!used.has(k)){const [a,b]=k.split(':').map(Number);rail(a,b);}
MALL_SURVEY_STATS.railEdges=edges.size;MALL_SURVEY_STATS.railPaths=MALL_RAILS.length;

export const MALL_CHECKPOINTS:P[]=[[-13100,315,800],[-6550,315,800],[-3300,-270,0],[800,-1100,5800],[10800,-1512,5800]].map(([x,y,z])=>{const p=mallPoint(x,y+10,z);p[1]=mallSupport(p[0],p[2],p[1]);return p;});
for(const [i,p] of MALL_CHECKPOINTS.entries())add({t:'checkpoint',p,grp:62,nm:`Mall checkpoint ${i+1}`});
const lane:P[]=[[-14573,1120,532],[-13450,1260,532],[-13850,1110,150],[-15450,716,150],[-15700,757,530],[-15100,607,530],[-13400,314,530],[-11000,315,850],[-7000,315,900],[-3800,-270,700],[-2200,-270,1900],[-1100,-920,4300],[-700,-1512,5800],[5500,-1512,5800],[10800,-1512,5800],[14500,-2324,5800],[15800,-2324,5800]];
for(const p of lane)add({t:'camnode',p:mallPoint(...p),radius:3,grp:62,nm:'Mall course direction'});
// The crossing sculpture sits above the arcade's central riding lane. A low
// local chase arm looks underneath it instead of placing the lens in its
// sloping underside; all geometry and movement remain source-owned.
add({t:'camnode',p:mallPoint(4300,-1380,5800),s:[30,20,90],yaw:0,radius:3,cameraView:true,
 cameraPosition:[0,.4,7],cameraTarget:[0,0,0],cameraFollowDistance:7,cameraFollowTargetHeight:1.5,cameraFov:49,
 grp:62,nm:'Crossrail arcade camera'});
const finish=mallPoint(15750,-2324.921875,5780);finish[1]=mallSupport(finish[0],finish[2],finish[1]+1);
add({t:'gate',p:finish,yaw:0,grp:62,nm:'Mall parking finish'});
add({t:'pit',p:[100,-10,-700],s:[550,1,1700],invisible:true,grp:62,nm:'Below-mall recovery'});
const spawn=mallPoint(-14573.5751953125,1120.4754638671875,532.1126708984375);spawn[1]=mallSupport(spawn[0],spawn[2],spawn[1]+.1)+.12;
for(const c of C)if(c.t==='mesh')c.invisible=true;
C.push(...mallVisuals(mallPoint));
export const MALL_LEVEL:CustomLevelData={v:1,name:'Mall · New York',spawn,killY:-12,startWarpPad:false,skatepark:true,sky:'day',keepPlayFog:true,jungleDepthFade:false,
 atmosphere:{fogEnabled:true,fogNear:65,fogFar:230,fogColor:'#b8c6ca',ambientSky:'#c8d4d0',ambientGround:'#858378',ambientIntensity:1.45,sunColor:'#f4ebcf',sunIntensity:1.1,fillColor:'#a9c5cd',fillIntensity:.55,shadowStrength:.25,backdrop:'fog',drawDistance:290},
 components:C,groups:[...survey.meshes.filter(s=>s.id>=18&&s.id<54).map(s=>({id:s.id+1,nm:sourceName(s.id),editorOnly:true})),{id:61,nm:'Measured grind paths',editorOnly:true},{id:62,nm:'Course flow',editorOnly:true},{id:63,nm:'Continuous transitions',editorOnly:true},{id:64,nm:'PS1 Mall scenery',editorOnly:true}]};
