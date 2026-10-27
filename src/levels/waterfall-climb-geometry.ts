import type {CustomComponent} from '../level';
import {BufferGeometry,Float32BufferAttribute,CatmullRomCurve3,Vector3} from 'three';
type P=[number,number,number];
const q=(n:number)=>Math.round(n*10000)/10000;

/** Closed, bevelled stone with a broad flat crown. Contact uses these same
 * triangles; there is no rectangular invisible support under the corners. */
export function waterfallStone(name:string,p:P,w:number,d:number,group:number):CustomComponent {
 const x=w/2,z=d/2,b=Math.min(1.1,w*.14,d*.14);
 const rim=[[-x,-z+b],[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],[x-b,z],[-x+b,z],[-x,z-b]];
 const vertices:number[]=[0,0,0],indices:number[]=[],uvs:number[]=[.5,.5],colors:number[]=[.92,.98,.80];
 for(const [i,[xx,zz]]of rim.entries()){vertices.push(xx,0,zz);uvs.push(xx/5,zz/5);const g=.91+.04*Math.sin(i*2);colors.push(g,g,.78);}
 for(let i=0;i<8;i++)indices.push(0,(i+1)%8+1,i+1);
 const grindTopTriangles=indices.length/3;
 let prev=1;
 for(const [row,[scale,y]]of [[1,-.24],[.97,-.7],[.91,-1.35],[.75,-3.0]].entries()){
  const start=vertices.length/3;
  for(const [i,[xx,zz]]of rim.entries()){
   const r=scale*(1+(row?Math.sin(i*2.4+group)*.035:0));vertices.push(q(xx*r),y,q(zz*r));uvs.push((i/8)*(w+d)/5,y/5);
   const shade=.87-row*.07;colors.push(shade*.82,shade,.78*shade);
  }
  for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(prev+i,prev+j,start+i,prev+j,start+j,start+i);}prev=start;
 }
 const bottom=vertices.length/3;vertices.push(0,-3,0);uvs.push(0,0);colors.push(.5,.58,.45);
 for(let i=0;i<8;i++)indices.push(bottom,prev+i,prev+(i+1)%8);
 return{t:'mesh',p,vertices,indices,uvs,colors,solid:true,solidSides:true,grindTopTriangles,flatShading:true,
  tex:'coast-bedrock',color:'#e3d6ad',grp:group,nm:name};
}

/** A continuous authored root, worn spillway or stone aqueduct. The crown,
 * curved sides and closed underside form one solid rather than a box chain. */
export function waterfallRibbon(name:string,points:P[],widths:number[],group:number):CustomComponent {
 const root=/cedar|root/i.test(name),race=/Millrace/i.test(name),bank=/Root bank/i.test(name);
 const origin=points[0],vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[];
 const rows:{centre:P;left:P;right:P}[]=[],total=points.slice(1).reduce((n,p,i)=>n+Math.hypot(...p.map((v,k)=>v-points[i][k])),0);
 const count=Math.ceil(total/2.2),curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p)),false,'centripetal');
 const at=(t:number):{p:P;w:number}=>{
  const s=Math.min(points.length-1-1e-8,Math.max(0,t)*(points.length-1)),i=Math.floor(s),u=s-i;
  const p=curve.getPoint(Math.min(1,Math.max(0,t))).toArray() as P;
  return{p,w:widths[i]+(widths[i+1]-widths[i])*u};
 };
 const columns=[-1,-.82,-.58,0,.58,.82,1];
 for(let i=0;i<=count;i++){
  const t=i/count,{p,w}=at(t),a=at(Math.max(0,t-.001)).p,b=at(Math.min(1,t+.001)).p;
  const n=Math.hypot(b[0]-a[0],b[2]-a[2]),nx=-(b[2]-a[2])/n,nz=(b[0]-a[0])/n;
  const cross=(u:number):P=>[p[0]+nx*w/2*u,p[1]+(race?Math.max(0,(Math.abs(u)-.58)/.42)**2*.9:root?-(Math.abs(u)**6)*.22:0),p[2]+nz*w/2*u];
  rows.push({centre:p,left:cross(-1),right:cross(1)});
  for(const u of columns){const point=cross(u);vertices.push(...point.map((v,k)=>q(v-origin[k])));uvs.push((u+1)*w/8,t*total/(root?8:6));
   const edge=Math.abs(u),shade=.96-.13*edge,green=bank||!root;colors.push(shade*(green?.82:1),shade*(green?1:.82),shade*(green?.65:.56));}
 }
 for(let i=0;i<count;i++)for(let j=0;j<6;j++){const a=i*7+j,b=(i+1)*7+j;indices.push(a,a+1,b,a+1,b+1,b);}
 const grindTopTriangles=indices.length/3;
 for(const side of [0,6]){
  let previous=-1;
  for(let i=0;i<=count;i++){
   const top=i*7+side,{centre:p}=rows[i],edge=side===0?rows[i].left:rows[i].right;
   const depth=root?3.4+Math.sin(i*.2)*.6:1.5,id=vertices.length/3;
   const base:P=[p[0]+(edge[0]-p[0])*.79,p[1]-depth,p[2]+(edge[2]-p[2])*.79];
   vertices.push(...base.map((v,k)=>q(v-origin[k])));uvs.push(i/count*total/6,depth/6);colors.push(root?.45:.62,root?.37:.68,root?.25:.49);
   if(i){const pt=(i-1)*7+side;if(side===0)indices.push(pt,top,previous,top,id,previous);else indices.push(pt,previous,top,top,previous,id);}previous=id;
  }
 }
 const left=(count+1)*7,right=left+count+1;
 for(let i=0;i<count;i++)indices.push(left+i,left+i+1,right+i,right+i,left+i+1,right+i+1);
 for(const i of [0,count]){
  const a=i*7,lo=left+i,hi=right+i;
  for(let j=0;j<6;j++)if(i===0)indices.push(a+j+1,a+j,lo);else indices.push(a+j,a+j+1,lo);
  if(i===0)indices.push(a+6,lo,hi);else indices.push(a+6,hi,lo);
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const normals=Array.from(geometry.getAttribute('normal').array);geometry.dispose();
 // Smooth the ride crown without averaging its normals into the vertical sides.
 const crown=new Array((count+1)*7*3).fill(0),ab=new Vector3(),ac=new Vector3(),normal=new Vector3();
 for(let k=0;k<grindTopTriangles*3;k+=3){const [a,b,c]=indices.slice(k,k+3).map(i=>new Vector3(...vertices.slice(i*3,i*3+3)));normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));for(const i of indices.slice(k,k+3))for(let axis=0;axis<3;axis++)crown[i*3+axis]+=normal.getComponent(axis);}
 for(let i=0;i<crown.length;i+=3){normal.fromArray(crown,i).normalize();for(let axis=0;axis<3;axis++)normals[i+axis]=q(normal.getComponent(axis));}
 return{t:'mesh',p:origin,vertices,indices,normals,uvs,colors,solid:true,solidSides:true,grindTopTriangles,smoothCollision:true,
  tex:root?'wood':'coast-bedrock',color:bank?'#cfcd93':root?'#d1ad77':'#d6c99b',grp:group,nm:name};
}

export function waterfallLeaf(w:number,d:number,h:number):Pick<CustomComponent,'vertices'|'indices'|'uvs'|'colors'|'grindTopTriangles'> {
 const vertices:number[]=[0,h/2,0],indices:number[]=[],uvs:number[]=[.5,.5],colors:number[]=[.79,1,.35],n=24;
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;vertices.push(Math.cos(a)*w/2,h/2,Math.sin(a)*d/2);uvs.push(.5+.5*Math.cos(a),.5+.5*Math.sin(a));const g=.65+.16*Math.sin(a*7)**2;colors.push(g*.7,g,.22);}
 for(let i=0;i<n;i++)indices.push(0,(i+1)%n+1,i+1);
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;vertices.push(Math.cos(a)*w*.47,-h/2,Math.sin(a)*d*.47);uvs.push(i/n,1);colors.push(.22,.39,.12);}
 for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i+1,j+1,n+i+1,j+1,n+j+1,n+i+1);}
 const b=vertices.length/3;vertices.push(0,-h/2,0);uvs.push(0,0);colors.push(.2,.3,.1);for(let i=0;i<n;i++)indices.push(b,n+i+1,n+(i+1)%n+1);
 return{vertices,indices,uvs,colors,grindTopTriangles:n};
}
