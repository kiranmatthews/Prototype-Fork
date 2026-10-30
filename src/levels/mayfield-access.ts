import type {CustomComponent} from '../level';
export type MallPoint=[number,number,number];
type Add=(component:CustomComponent)=>CustomComponent;

/** Close a landing between two sampled floor edges, including its underside.
 * Edge heights may differ: the landing follows the actual source cross-section. */
export function mallLanding(add:Add,name:string,a:MallPoint[],b:MallPoint[],color='#d6ddd1'){
 if(a.length!==b.length||a.length<2)throw Error('Landing edges must match');
 const vertices:number[]=[],indices:number[]=[];
 for(const row of[a,b])for(const p of row)vertices.push(p[0],p[1]+.012,p[2],p[0],p[1]-.65,p[2]);
 const n=a.length*2;
 const face=(i:number,j:number,k:number,up:boolean)=>{
  const ny=(vertices[j*3+2]-vertices[i*3+2])*(vertices[k*3]-vertices[i*3])-(vertices[j*3]-vertices[i*3])*(vertices[k*3+2]-vertices[i*3+2]);
  indices.push(i,...((ny>0)===up?[j,k]:[k,j]));
 };
 for(let i=0;i<a.length-1;i++){
  const k=i*2,j=k+2;
  face(k,j,n+j,true);face(k,n+j,n+k,true);
  face(k+1,n+j+1,j+1,false);face(k+1,n+k+1,n+j+1,false);
  indices.push(k,k+1,j+1,k,j+1,j,n+k,n+j+1,n+k+1,n+k,n+j,n+j+1);
 }
 for(const k of[0,n-2])indices.push(k,n+k,k+1,k+1,n+k,n+k+1);
 add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,solid:true,solidSides:true,doubleSided:true,color,tex:'pavement'});
}

/** A closed, mitered walkway. Turns share their complete edge, rather than
 * overlapping independent rectangular bridges with triangular gaps. */
export function mallWalkway(add:Add,name:string,points:MallPoint[],width:number,guards=true,color='#d6ddd1',openings:MallPoint[]=[]){
 const sides=points.map((p,i)=>{
  const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  const normal=(a:MallPoint,b:MallPoint)=>{const dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz);return[-dz/d,dx/d];};
  const n0=normal(i?before:p,i?p:after),n1=normal(i<points.length-1?p:before,i<points.length-1?after:p);
  const sx=n0[0]+n1[0],sz=n0[1]+n1[1],d=Math.hypot(sx,sz),nx=sx/d,nz=sz/d;
  const m=Math.min(width, width/2/Math.max(.5,nx*n0[0]+nz*n0[1]));
  return[-1,1].map(s=>[p[0]+s*nx*m,p[1],p[2]+s*nz*m] as MallPoint);
 });
 const vertices:number[]=[],indices:number[]=[];
 // A centimetre of clearance prevents flicker where a fitted landing overlaps
 // the original floor; it remains well below the ordinary step tolerance.
 for(const edge of sides)for(const p of edge)vertices.push(p[0],p[1]+.012,p[2],p[0],p[1]-.65,p[2]);
 for(let i=0;i<points.length-1;i++){
  const a=i*4,b=a+4;
  indices.push(a,a+2,b+2,a,b+2,b,a+1,b+3,a+3,a+1,b+1,b+3,a,b,a+1,a+1,b,b+1,a+2,a+3,b+3,a+2,b+3,b+2);
 }
 const e=(points.length-1)*4;indices.push(0,1,3,0,3,2,e,e+2,e+3,e,e+3,e+1);
 add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,solid:true,solidSides:true,doubleSided:true,color,tex:'pavement'});
 if(guards)for(let side=0;side<2;side++)for(let i=1;i<points.length;i++){
  const a=sides[i-1][side],b=sides[i][side],dx=b[0]-a[0],dz=b[2]-a[2],d2=dx*dx+dz*dz;
  let spans:[[number,number]]|[number,number][]=[[0,1]];
  for(const p of openings){
   const t=((p[0]-a[0])*dx+(p[2]-a[2])*dz)/d2,r=width*1.6;
   if(Math.abs(a[1]+(b[1]-a[1])*Math.max(0,Math.min(1,t))-p[1])>2)continue;
   const distance2=(a[0]+dx*t-p[0])**2+(a[2]+dz*t-p[2])**2;
   if(distance2>=r*r)continue;
   const h=Math.sqrt((r*r-distance2)/d2),lo=t-h,hi=t+h;
   spans=spans.flatMap(([u,v])=>hi<=u||lo>=v?[[u,v]]:[...(lo>u?[[u,lo]]:[]),...(hi<v?[[hi,v]]:[])]) as [number,number][];
  }
  const at=(t:number)=>a.map((v,k)=>v+(b[k]-v)*t) as MallPoint;
  for(const [u,v]of spans)if(v-u>1e-4)mallGuard(add,`${name} / parapet`,at(u),at(v));
 }
 return sides;
}

export function mallGuard(add:Add,name:string,a:MallPoint,b:MallPoint){
 mallGuardPath(add,name,[a,b]);
}
export function mallGuardPath(add:Add,name:string,points:MallPoint[]){
 const vertices:number[]=[],indices:number[]=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=Math.hypot(b[0]-a[0],b[2]-a[2]);
  const nx=-(b[2]-a[2])/d*.11,nz=(b[0]-a[0])/d*.11;
  vertices.push(p[0]-nx,p[1],p[2]-nz,p[0]+nx,p[1],p[2]+nz,p[0]-nx,p[1]+1.04,p[2]-nz,p[0]+nx,p[1]+1.04,p[2]+nz);
  if(i){const a=(i-1)*4,b=i*4;indices.push(a,a+2,b+2,a,b+2,b,a+1,b+3,a+3,a+1,b+1,b+3,a+2,a+3,b+3,a+2,b+3,b+2,a,b+1,a+1,a,b,b+1);}
 }
 const e=(points.length-1)*4;indices.push(0,1,3,0,3,2,e,e+2,e+3,e,e+3,e+1);
 const colors=Array.from({length:vertices.length/3},(_,i)=>i%4<2?[.9,.835,.73]:[.3,.624,.61]).flat();
 // The continuous teal cap is itself grindable. Using the actual parapet edge
 // avoids a second, overlapping procedural rail along every added guard.
 add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,colors,solid:true,solidSides:true,doubleSided:true,color:'#ffffff',tex:'solid'});
}
