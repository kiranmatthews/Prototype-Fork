// Independent published source fixture: 73aedc485d09c90ba3e0406d6abf5488fbb6506d.
// Preserve the old generator rather than duplicating its 1.2 MB snapshot.
import type {CustomComponent, CustomLevelData} from '../../src/level';
import {buildCarlisleBoxes} from '../../src/levels/carlisle-boxes';
import originalEntry from '../carlisle-coast/original-course.json';

type Point=[number,number,number];
const rad=Math.PI/180;
const round=(v:number)=>Math.round(v*4096)/4096;
// Keep the coast's full gameplay topology: jumps, dangerous crate choices,
// timed crossings, foot routes and compulsory grinds. Bend geometry, not feel.
const bend=(s:number)=>22*(Math.sin((s+100)*2*Math.PI/310)-Math.sin(100*2*Math.PI/310))
  +5*(Math.sin((s+42.5)*2*Math.PI/560)-Math.sin(42.5*2*Math.PI/560));
const crossBend=(x:number)=>8*Math.sin(x*2*Math.PI/152);
export function custardWarp(p:Point):Point {
  return [p[0]+bend(-p[2]),p[1],p[2]+crossBend(p[0])].map(round) as Point;
}
export const CUSTARD_CREEK_END=2447;
const C:CustomComponent[]=[];
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const reference=originalEntry.data as unknown as CustomLevelData;
const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
const removed=new Set([1,...range(20,30),...range(71,86),...range(121,123),175,176,...range(242,253),276,490,493,499,502]);
const core=reference.components.flatMap((source,i)=>{
  if(removed.has(i)||source.t==='crate'||source.t==='comboorb')return [];
  const c=clone(source);c.nm=`Test Course ${i}`;
  if(i===132)c.pts=[[0,0,0,0],[0,-23,0,2.98],[0,-63,0,3.2],[0,-88,0,5.96],[0,-128,0,6.2],[0,-150,0,9]];
  if(i===92)c.cameraCutaway=true;
  if(i===69){c.p[0]=0;c.s![0]=22;}
  return [c];
});
const boxes=buildCarlisleBoxes(reference);
// Pin the authored gameplay reference rather than borrowing mutable runtime
// art or editor state from another level under active development.
const original:CustomLevelData={...clone(reference),components:[...core,...boxes.components],groups:[...(reference.groups??[]),...boxes.groups]};
const sourceTop=(c:CustomComponent,x:number,z:number)=>{
  const yaw=(c.yaw??0)*rad,dx=x-c.p[0],dz=z-c.p[2];
  const lx=dx*Math.cos(yaw)-dz*Math.sin(yaw),lz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  if(c.t==='platform'&&c.s&&Math.abs(lx)<=c.s[0]/2+.01&&Math.abs(lz)<=c.s[2]/2+.01)return c.p[1]+c.s[1]/2;
  if(c.t==='ramp'&&Math.abs(lx)<=(c.w??12)/2+.01&&Math.abs(lz)<=(c.len??40)/2+.01)
    return c.p[1]+(c.rise??4)*(.5-lz/(c.len??40));
  return null;
};
function floorHeight(x:number,z:number):number {
  const heights=original.components.map(c=>sourceTop(c,x,z)).filter((h):h is number=>h!==null);
  if(heights.length)return Math.max(...heights);
  const nearest=original.components.filter(c=>c.t==='platform'&&c.s)
    .sort((a,b)=>Math.hypot(a.p[0]-x,a.p[2]-z)-Math.hypot(b.p[0]-x,b.p[2]-z))[0];
  return nearest?nearest.p[1]+nearest.s![1]/2:0;
}
function guideHeight(x:number,z:number):number {
  // The higher optional crate ledge must not lift the main camera lane.
  if(x>=118&&x<=136&&Math.abs(z+1720)<12)return -16.6;
  return floorHeight(x,z);
}
function localWorld(c:CustomComponent,x:number,y:number,z:number):Point {
  const a=(c.yaw??0)*rad;
  return [c.p[0]+x*Math.cos(a)+z*Math.sin(a),c.p[1]+y,c.p[2]-x*Math.sin(a)+z*Math.cos(a)];
}
// Closed, sampled solids preserve original top heights and actual gaps.
// Nothing fills the missing ground under the coast's challenge crossings.
function surface(c:CustomComponent):CustomComponent {
  const w=c.t==='ramp'?(c.w??12):c.s![0],d=c.t==='ramp'?(c.len??40):c.s![2];
  const top=(z:number)=>c.t==='ramp'?(c.rise??4)*(.5-z/d):c.s![1]/2;
  const bottom=c.t==='ramp'?Math.min(0,c.rise??4)-1:-c.s![1]/2;
  const nx=Math.max(1,Math.ceil(w/3)),nz=Math.max(1,Math.ceil(d/2));
  const p=custardWarp(c.p),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(const lower of [false,true])for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++) {
    const x=-w/2+w*ix/nx,z=d/2-d*iz/nz,q=custardWarp(localWorld(c,x,lower?bottom:top(z),z));
    vertices.push(round(q[0]-p[0]),round(q[1]-p[1]),round(q[2]-p[2]));uvs.push(x/4,z/4);
  }
  const row=nx+1,count=row*(nz+1);
  const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,c,b,d);
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++) {
    const a=iz*row+ix,b=a+1,n=a+row;quad(a,b,n,n+1);quad(a+count,n+count,b+count,n+count+1);
  }
  const edge:number[]=[];
  for(let ix=0;ix<=nx;ix++)edge.push(ix);
  for(let iz=1;iz<=nz;iz++)edge.push(iz*row+nx);
  for(let ix=nx-1;ix>=0;ix--)edge.push(nz*row+ix);
  for(let iz=nz-1;iz>0;iz--)edge.push(iz*row);
  for(let i=0;i<edge.length;i++) {const a=edge[i],b=edge[(i+1)%edge.length];quad(b,a,b+count,a+count);}
  return {t:'mesh',p,vertices,indices,uvs,color:c.color,tex:c.tex,edgeGrinding:false,
    ...(c.invisible?{invisible:true}:{}),...(c.grp!==undefined?{grp:c.grp}:{}),nm:c.nm};
}
// Ground raycasts own support; thin boundary walls keep a jumping body out
// of the closed floors' sides. Their tops sit below the riding face, as in
// the ordinary platform collider, so supported carving never hits a wall.
function surfaceSideColliders(c:CustomComponent):CustomComponent[] {
  const ramp=c.t==='ramp',w=ramp?(c.w??12):c.s![0],d=ramp?(c.len??40):c.s![2];
  const thickness=.12,inset=thickness/2;
  const top=(z:number)=>ramp?(c.rise??4)*(.5-z/d):c.s![1]/2;
  const height=ramp?1:c.s![1];
  if(height<=.25)return [];
  const points:Point[][]=[];
  const edge=(a:[number,number],b:[number,number])=>{
    const count=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    return Array.from({length:count+1},(_,i)=>{
      const x=a[0]+(b[0]-a[0])*i/count,z=a[1]+(b[1]-a[1])*i/count;
      return custardWarp(localWorld(c,x,top(z)-height,z));
    });
  };
  const corners:[number,number][]=[[-w/2+inset,d/2-inset],[w/2-inset,d/2-inset],
    [w/2-inset,-d/2+inset],[-w/2+inset,-d/2+inset]];
  if(ramp)for(let i=0;i<4;i++)points.push(edge(corners[i],corners[(i+1)%4]));
  else points.push(corners.flatMap((a,i)=>edge(a,corners[(i+1)%4]).slice(0,-1)));
  return points.map((outline,i)=>{
    const p=outline[0];
    return {t:'wallpath',p,w:thickness,rise:height-.05,collisionHeight:height-.05,
      invisible:true,curve:'corner',closed:!ramp,edgeGrinding:false,
      ...(c.grp!==undefined?{grp:c.grp}:{}),nm:`${c.nm} side collision${ramp?' '+i:''}`,
      pts:outline.map(q=>[round(q[0]-p[0]),round(q[2]-p[2]),0,round(q[1]-p[1])])};
  });
}
function warpedCrumble(c:CustomComponent):CustomComponent {
  const size=c.s??[3,1,3],a=custardWarp(localWorld(c,0,0,size[2]/2)),b=custardWarp(localWorld(c,0,0,-size[2]/2));
  // A rigid pad follows the warped centreline chord. Fitting its original
  // end points keeps the coast's small seams instead of opening side gaps.
  return {...c,p:[round((a[0]+b[0])/2),c.p[1],round((a[2]+b[2])/2)],
    yaw:round(Math.atan2(a[0]-b[0],a[2]-b[2])/rad),s:[size[0],size[1],round(Math.hypot(a[0]-b[0],a[2]-b[2]))]};
}
function warpedPath(c:CustomComponent):CustomComponent {
  let knots:Point[];
  if(c.pts?.length) {
    const raw=c.pts.map(q=>localWorld(c,q[0],q[3]??0,q[1]));knots=[raw[0]];
    for(let i=1;i<raw.length-1;i++) {
      const a=raw[i-1],b=raw[i],d=raw[i+1],before=Math.hypot(...b.map((v,j)=>v-a[j])),after=Math.hypot(...d.map((v,j)=>v-b[j]));
      const cut=Math.min(c.pts[i][2]??0,before*.49,after*.49);
      if(cut<.001){knots.push(b);continue;}
      const entry=b.map((v,j)=>v+(a[j]-v)*cut/before) as Point,exit=b.map((v,j)=>v+(d[j]-v)*cut/after) as Point;
      const n=Math.max(3,Math.ceil(cut*2));
      for(let j=0;j<=n;j++){const t=j/n;knots.push(entry.map((v,k)=>v*(1-t)*(1-t)+2*b[k]*t*(1-t)+exit[k]*t*t) as Point);}
    }
    knots.push(raw[raw.length-1]);
  }
  else {const len=c.len??20;knots=[localWorld(c,0,0,len/2),localWorld(c,0,0,-len/2)];}
  const points:Point[]=[];
  for(let i=1;i<knots.length;i++) {
    const a=knots[i-1],b=knots[i],n=Math.max(1,Math.ceil(Math.hypot(...b.map((v,j)=>v-a[j]))/3));
    for(let j=0;j<n;j++)points.push(custardWarp(a.map((v,k)=>v+(b[k]-v)*j/n) as Point));
  }
  points.push(custardWarp(knots[knots.length-1]));
  const p=points[0];
  return {...c,p,yaw:0,pts:points.map(q=>[round(q[0]-p[0]),round(q[2]-p[2]),0,round(q[1]-p[1])]),
    ...(c.t==='vertramp'?{curve:'spline' as const}:{} )};
}
function warpedWall(c:CustomComponent):CustomComponent {
  const w=c.s![0],d=c.s![2],length=Math.max(w,d),n=Math.max(1,Math.ceil(length/3)),outline:Point[]=[];
  for(let i=0;i<=n;i++)outline.push(custardWarp(localWorld(c,w>=d?-w/2+w*i/n:0,0,w>=d?0:d/2-d*i/n)));
  const p=custardWarp(c.p);
  return {t:'wallpath',p,w:Math.min(w,d),rise:c.s![1],collisionHeight:c.collisionHeight??c.s![1],
    color:c.color,tex:c.tex,invisible:c.invisible,cameraCutaway:c.cameraCutaway,grp:c.grp,nm:c.nm,
    pts:outline.map(q=>[round(q[0]-p[0]),round(q[2]-p[2])]),curve:'corner'};
}
function warpedSceneryMesh(c:CustomComponent):CustomComponent {
  const p=custardWarp(c.p),v=c.vertices??[],scale=c.s??[1,1,1],vertices:number[]=[];
  for(let i=0;i<v.length;i+=3) {
    const q=custardWarp(localWorld(c,v[i]*scale[0],v[i+1]*scale[1],v[i+2]*scale[2]));
    vertices.push(round(q[0]-p[0]),round(q[1]-p[1]),round(q[2]-p[2]));
  }
  const out={...c,p,vertices,yaw:0,s:[1,1,1] as Point};delete out.normals;return out;
}
export const CUSTARD_CREEK_SOURCE_COMPONENTS=clone(original.components);
// Original rolling hazards keep their speeds and ranges. Widen only their
// landing arenas enough to support their existing world-axis patrols.
for(const c of CUSTARD_CREEK_SOURCE_COMPONENTS) {
  if(c.nm==='Test Course 4'&&c.s)c.s[0]=15;
  if(c.nm==='Test Course 40'&&c.s)c.s[0]=16;
  if(c.nm==='Test Course 66'&&c.s)c.s[0]=14;
  if(c.t==='stone'&&c.p[0]<30)c.p[0]=0;
}
for(const source of CUSTARD_CREEK_SOURCE_COMPONENTS) {
  const c=clone(source);
  if(c.t==='zone'||c.t==='camnode')continue;
  if(c.t==='checkpoint')c.p[1]=floorHeight(c.p[0],c.p[2]);
  // The swept halfpipe owns the visible flat. Keep the original underlay
  // collision, but avoid two coplanar material skins fighting in play.
  if(c.nm==='Test Course 11')c.invisible=true;
  c.nm=(c.nm??c.t).replace('Test Course','Creek encounter');
  if(c.t==='platform'||c.t==='ramp')C.push(surface(c),...surfaceSideColliders(c));
  else if(c.t==='crumble')C.push(warpedCrumble(c));
  else if(c.t==='rail'||c.t==='rope'||c.t==='vertramp')C.push(warpedPath(c));
  else if(c.t==='wall'&&c.s)C.push(warpedWall(c));
  else if(c.t==='mesh')C.push(warpedSceneryMesh(c));
  else {c.p=custardWarp(c.p);C.push(c);}
}
const lane:Point[]=[];
for(let z=8;z>=-1704;z-=8)lane.push([0,guideHeight(0,z)+.8,z]);
for(let i=1;i<=12;i++) {const a=i*Math.PI/24,x=16-16*Math.cos(a),z=-1704-16*Math.sin(a);lane.push([x,guideHeight(x,z)+.8,z]);}
for(let x=24;x<=140;x+=8)lane.push([x,guideHeight(x,-1720)+.8,-1720]);
for(let i=1;i<=12;i++) {const a=i*Math.PI/24,x=140+12*Math.sin(a),z=-1732+12*Math.cos(a);lane.push([x,guideHeight(x,z)+.8,z]);}
for(let z=-1740;z>=-2310;z-=8)lane.push([152,guideHeight(152,z)+.8,z]);
lane.push([152,-25.2,-2310]);
export const CUSTARD_CREEK_CAMERA=lane.map((p,i)=>{
  let height=0,weight=0;
  for(let j=Math.max(0,i-2);j<=Math.min(lane.length-1,i+2);j++){const w=3-Math.abs(j-i);height+=lane[j][1]*w;weight+=w;}
  return custardWarp([p[0],height/weight,p[2]]);
});
for(const p of CUSTARD_CREEK_CAMERA)C.push({t:'camnode',p,radius:0,nm:'Creek continuous course camera'});
export const CUSTARD_CREEK_GAMEPLAY=Object.fromEntries(
  ['enemy','stone','crusher','pendulum','mover','ropeswing','crumble','rail','vertramp','checkpoint','crate','gate'].map(t=>[t,C.filter(c=>c.t===t).length]));
export const CUSTARD_CREEK_BOX_SECTIONS=boxes.sections;
export const CUSTARD_CREEK_LEVEL:CustomLevelData={
  ...clone(original),name:'Custard Creek',sky:'coast',spawn:custardWarp(original.spawn),
  medalTimes:{gold:180,silver:210,bronze:255},components:C,
};
