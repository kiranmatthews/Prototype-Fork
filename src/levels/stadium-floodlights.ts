import type {CustomComponent} from '../level';
import {cartRallyFrame,stadiumPoint} from './cart-stadium-layout';

type V=[number,number,number];
/** Six recessed lamps in a braced, chunky tower. Three static material batches
 * per fixture, plus a depth-tested lens halo. Full geometry at every distance. */
export function stadiumFloodlight(s:number,side:number):CustomComponent[]{
 const origin=stadiumPoint(s,side*42,0),f=cartRallyFrame(s),tilt=.62,ct=Math.cos(tilt),st=Math.sin(tilt);
 const batches=Array.from({length:3},()=>({vertices:[] as number[],colors:[] as number[]}));
 const world=(p:V,head:boolean):V=>{
  const [x,y,z]=p,Y=head?33+y*ct-z*st:y,Z=head?y*st+z*ct:z;
  return [x*f.dx/f.n-Z*side/f.n,Y,-x/f.n-Z*side*f.nz];
 };
 const tri=(batch:number,a:V,b:V,c:V,colour:V,head=true)=>{for(const p of side>0?[a,c,b]:[a,b,c]){batches[batch].vertices.push(...world(p,head).map(v=>Math.round(v*1e5)/1e5));batches[batch].colors.push(...colour);}};
 const quad=(batch:number,a:V,b:V,c:V,d:V,colour:V,head=true)=>{tri(batch,a,b,c,colour,head);tri(batch,a,c,d,colour,head);};
 const box=(centre:V,size:V,colour:V,head=true)=>{
  const v:V[]=[];for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])v.push([centre[0]+x*size[0]/2,centre[1]+y*size[1]/2,centre[2]+z*size[2]/2]);
  for(const [a,b,c,d]of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[2,6,7,3],[0,1,5,4]])quad(0,v[a],v[b],v[c],v[d],colour,head);
 };
 const beam=(a:V,b:V,width:number,colour:V)=>{
  const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy),rx=-dy/n*width/2,ry=dx/n*width/2;
  const v:V[]=[];for(const z of [-width/2,width/2])for(const p of [a,b])for(const sign of [-1,1])v.push([p[0]+rx*sign,p[1]+ry*sign,p[2]+z]);
  for(const [a,b,c,d]of [[0,2,3,1],[4,5,7,6],[0,4,6,2],[1,3,7,5],[2,6,7,3],[0,1,5,4]])quad(0,v[a],v[b],v[c],v[d],colour,false);
 };
 const teal:V=[.055,.15,.15],edge:V=[.20,.33,.31],brass:V=[.55,.36,.14];
 // Twin tapered legs, large collar, access ladder, triangular cross braces.
 beam([-.85,13,-1.1],[-.38,32,-1.1],.48,teal);beam([.85,13,-1.1],[.38,32,-1.1],.48,teal);
 box([0,30.7,-1.1],[4.8,.44,.75],edge,false);
 for(let y=15;y<31;y+=3){const w=.85-(y-13)*.024;beam([-w,y,-1.1],[w-.072,y+3,-1.1],.14,edge);}
 for(let y=15;y<31;y+=.65)box([0,y,-1.52],[.64,.065,.09],brass,false);
 box([0,0,-.56],[7.4,4.65,.34],teal);
 for(const y of [-2.28,2.28])box([0,y,-.02],[7.55,.24,1.1],edge);
 for(const x of [-3.64,3.64])box([x,0,-.02],[.24,4.65,1.1],edge);
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=(col-1)*2.32,y=(row-.5)*2.12;
  // Deep octagonal barrel, rolled brass rim, silver reflector, warm optic.
  const ring=(batch:number,r0:number,z0:number,r1:number,z1:number,colour:V)=>{
   for(let i=0;i<12;i++){
    const a=(i+.5)*Math.PI/6,b=(i+1.5)*Math.PI/6;
    const p=(r:number,z:number,t:number):V=>[x+Math.cos(t)*r,y+Math.sin(t)*r,z];
    quad(batch,p(r0,z0,a),p(r0,z0,b),p(r1,z1,b),p(r1,z1,a),colour);
   }
  };
  ring(0,.74,-.52,1.0,.27,teal);ring(0,1.0,.27,.87,.36,brass);
  ring(1,.87,.36,.61,-.08,[.66,.71,.67]);ring(1,.61,-.08,.39,-.14,[.37,.46,.47]);
  ring(2,.58,-.055,0,-.045,[1.0,.85,.51]);
  // Protective visor and a deliberately oversized fastener read from the track.
  box([x,y+1.0,.20],[1.9,.13,.65],edge);box([x,y-1.02,.12],[.24,.16,.28],brass);
 }
 const fixtures=batches.map((b,i):CustomComponent=>{
  const vertices:number[]=[],colors:number[]=[],indices:number[]=[],shared=new Map<string,number>();
  for(let at=0;at<b.vertices.length;at+=3){const p=b.vertices.slice(at,at+3),c=b.colors.slice(at,at+3),key=[...p,...c].join(',');let index=shared.get(key);if(index===undefined){index=vertices.length/3;shared.set(key,index);vertices.push(...p);colors.push(...c);}indices.push(index);}
  return {t:'mesh',nm:['Stadium floodlight tower and housings','Floodlight silver reflectors','Floodlight warm lenses'][i],p:origin,vertices,indices,colors,tex:'solid',color:'#ffffff',solid:false,castShadow:false,flatShading:true,...(i===2?{tex:'rally-lamp',emissive:'#edf6ff',rise:33,amp:7500,radius:135,to:stadiumPoint(s,-side*4,0)}:{})};});
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(let row=0;row<2;row++)for(let col=0;col<3;col++){
  const x=(col-1)*2.32,y=(row-.5)*2.12,n=vertices.length/3;
  for(const [u,v]of [[0,0],[1,0],[0,1],[1,1]]){vertices.push(...world([x+(u-.5)*3.3,y+(v-.5)*3.3,.39],true));uvs.push(u,v);}
  indices.push(n,n+1,n+2,n+1,n+3,n+2);
 }
 fixtures.push({t:'mesh',nm:'Floodlight lens glow',p:origin,vertices,indices,uvs,tex:'rally-lamp-glow',solid:false,castShadow:false,doubleSided:true});
 return fixtures;
}
